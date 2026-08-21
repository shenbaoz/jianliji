"""Thin CLI adapter around PyMuPDF's official text redaction APIs.

Core PDF operations come directly from https://github.com/pymupdf/PyMuPDF:
Page.get_text(), Page.add_redact_annot(), Page.apply_redactions(),
Page.insert_htmlbox(), and Page.draw_line(). PyMuPDF is AGPL-3.0 or
commercially licensed. This file only maps the website JSON contract to those
public APIs.
"""

import html
import json
import os
import re
import sys
import base64
import unicodedata

import pymupdf


def normalize(value):
    value = re.sub(r"\s+", "", str(value or ""))
    value = re.sub(r"^[•·\-]+", "", value)
    return re.sub(r"[，。；：、,.!！?？]", "", value)


def extract_source_portrait(source_path):
    """Return the most likely resume headshot without inventing an image."""
    document = pymupdf.open(source_path)
    candidates = []
    try:
        for page_number in range(min(2, document.page_count)):
            page = document[page_number]
            for image in page.get_images(full=True):
                xref = image[0]
                metadata = document.extract_image(xref)
                image_bytes = metadata.get("image")
                width = int(metadata.get("width") or 0)
                height = int(metadata.get("height") or 0)
                if not image_bytes or len(image_bytes) > 1_500_000:
                    continue
                ratio = width / max(1, height)
                if ratio < 0.45 or ratio > 1.5:
                    continue
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                for rect in rects:
                    # Resume portraits are normally compact images near the upper edge.
                    if rect.y0 > page.rect.height * 0.48:
                        continue
                    if rect.width < 32 or rect.height < 32:
                        continue
                    position_bonus = 2 if rect.x0 > page.rect.width * 0.45 else 0
                    shape_bonus = 2 if 0.7 <= ratio <= 1.25 else 0
                    score = position_bonus + shape_bonus + min(rect.width * rect.height / 2500, 4)
                    candidates.append((score, metadata.get("ext") or "png", image_bytes))
    finally:
        document.close()
    if not candidates:
        return None
    _, extension, image_bytes = max(candidates, key=lambda item: item[0])
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(extension.lower(), "png")
    return {"bytes": image_bytes, "data_url": f"data:image/{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"}


def decode_portrait_data_url(value):
    match = re.match(r"^data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)$", str(value or ""))
    if not match:
        return None
    try:
        image_bytes = base64.b64decode(match.group(2), validate=True)
        if not image_bytes or len(image_bytes) > 1_500_000:
            return None
        return {"bytes": image_bytes, "data_url": str(value)}
    except (ValueError, base64.binascii.Error):
        return None


def rect_key(rect):
    return tuple(round(float(value), 3) for value in rect)


def page_lines(page):
    lines = []
    for block in page.get_text("dict", sort=True).get("blocks", []):
        for line in block.get("lines", []):
            spans = [span for span in line.get("spans", []) if span.get("text", "")]
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text:
                continue
            lines.append(
                {
                    "text": text,
                    "rect": pymupdf.Rect(line["bbox"]),
                    "font_size": max((float(span.get("size", 8)) for span in spans), default=8),
                    "color": int(spans[0].get("color", 0)) if spans else 0,
                }
            )
    return lines


def matching_lines(page, before, region=None, excluded=None):
    candidate = normalize(before)
    if len(candidate) < 4:
        return None
    excluded = excluded or set()
    lines = [
        line
        for line in page_lines(page)
        if (region is None or line["rect"].intersects(region))
        and rect_key(line["rect"]) not in excluded
    ]
    for start in range(len(lines)):
        combined = ""
        for end in range(start, min(len(lines), start + 8)):
            combined += normalize(lines[end]["text"])
            if combined == candidate or (
                len(candidate) >= 8
                and candidate in combined
                and len(combined) <= len(candidate) * 1.1
            ):
                return lines[start : end + 1]
            if len(combined) > len(candidate) * 1.35:
                break
    return None


def build_page_regions(page, changes):
    """Match changes once against the source page and return disjoint regions."""
    regions = []
    claimed_lines = set()
    for change in changes:
        matched_lines = matching_lines(page, change.get("before", ""), excluded=claimed_lines)
        if matched_lines is None:
            continue
        source_rect = pymupdf.Rect(matched_lines[0]["rect"])
        for matched_line in matched_lines[1:]:
            source_rect |= matched_line["rect"]
        if any(source_rect.intersects(region["source_rect"]) for region in regions):
            continue
        claimed_lines.update(rect_key(line["rect"]) for line in matched_lines)
        regions.append(
            {
                "change": change,
                "matched_lines": matched_lines,
                "source_rect": source_rect,
                "font_size": min(max(max(line["font_size"] for line in matched_lines), 7), 14),
                "color": matched_lines[0]["color"],
            }
        )
    return regions


def split_for_pdf_lines(text, source_lines):
    """Keep natural break opportunities while retaining the source line rhythm."""
    if len(source_lines) <= 1:
        return [text.strip()]
    source_lengths = [max(1, len(line["text"])) for line in source_lines]
    source_total = sum(source_lengths)
    parts = []
    start = 0
    consumed_weight = 0
    for index, source_length in enumerate(source_lengths[:-1]):
        consumed_weight += source_length
        ideal = round(len(text) * consumed_weight / source_total)
        minimum = start + 1
        maximum = len(text) - (len(source_lines) - index - 1)
        ideal = min(max(ideal, minimum), maximum)
        candidates = [
            position
            for position in range(max(minimum, ideal - 8), min(maximum, ideal + 8) + 1)
            if text[position - 1] in " ，。；：、,.!！?？|/"
        ]
        end = min(candidates, key=lambda position: abs(position - ideal)) if candidates else ideal
        parts.append(text[start:end].strip())
        start = end
    parts.append(text[start:].strip())
    return parts


def css_color(value):
    return f"#{int(value) & 0xFFFFFF:06x}"


def insert_html(page, rect, text_lines, font_size, color, overlay=True):
    """Use Story layout so CJK glyphs remain visible and extractable."""
    css = (
        "* { margin: 0; padding: 0; letter-spacing: 0; } "
        f"body {{ color: {css_color(color)}; font-family: \"Noto Sans CJK SC\",\"Source Han Sans SC\",\"Microsoft YaHei\",sans-serif; "
        f"font-size: {font_size}px; font-weight: normal; line-height: 1.15; }}"
    )
    return page.insert_htmlbox(
        rect,
        "<br>".join(html.escape(line) for line in text_lines),
        css=css,
        scale_low=0.92,
        overlay=overlay,
    )


def dark_pixel_count(page, rect, font_size):
    clip = pymupdf.Rect(
        rect.x0,
        rect.y0 - font_size * 0.25,
        rect.x1,
        rect.y1 + font_size * 0.25,
    ) & page.rect
    pixmap = page.get_pixmap(
        matrix=pymupdf.Matrix(2, 2),
        clip=clip,
        colorspace=pymupdf.csGRAY,
        alpha=False,
    )
    return sum(1 for value in pixmap.samples if value < 180)


def image_geometry(page):
    images = {}
    for image in page.get_images(full=True):
        xref, width, height = int(image[0]), int(image[2]), int(image[3])
        for rect in page.get_image_rects(xref):
            key = (width, height, *rect_key(rect))
            images[key] = {"width": width, "height": height, "rect": pymupdf.Rect(rect)}
    return [images[key] for key in sorted(images)]


def text_rects(page):
    rects = []
    for block in page.get_text("dict", sort=True).get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                if span.get("text", "").strip():
                    rects.append(pymupdf.Rect(span["bbox"]))
    return rects


def fixed_image_rects(page):
    spans = text_rects(page)
    fixed = []
    for image in image_geometry(page):
        allowed_overlaps = {
            rect_key(span) for span in spans if span.intersects(image["rect"])
        }
        fixed.append({**image, "allowed_overlaps": allowed_overlaps})
    return fixed


def same_image_geometry(current, fixed):
    current_keys = [
        (image["width"], image["height"], *rect_key(image["rect"]))
        for image in image_geometry(current)
    ]
    fixed_keys = [
        (image["width"], image["height"], *rect_key(image["rect"]))
        for image in fixed
    ]
    return current_keys == fixed_keys


def can_commit_page(page, fixed_image_rects):
    """Reject image movement and every text/image intersection not in the source."""
    if not same_image_geometry(page, fixed_image_rects):
        return False
    spans = text_rects(page)
    for image in fixed_image_rects:
        current_overlaps = {
            rect_key(span) for span in spans if span.intersects(image["rect"])
        }
        if not current_overlaps.issubset(image["allowed_overlaps"]):
            return False
    return True


def horizontal_overlap(left, right):
    return min(left.x1, right.x1) - max(left.x0, right.x0) > 0.5


def expanded_text_rect(page, matched_lines, font_size, images):
    """Grow only downward, stopping at source text, fixed images or the page."""
    rect = pymupdf.Rect(matched_lines[0]["rect"])
    for matched_line in matched_lines[1:]:
        rect |= matched_line["rect"]
    matched_keys = {rect_key(line["rect"]) for line in matched_lines}
    lower_boundary = page.rect.y1 - font_size * 0.3
    for line in page_lines(page):
        if rect_key(line["rect"]) in matched_keys:
            continue
        if line["rect"].y0 >= rect.y1 - 0.5 and horizontal_overlap(rect, line["rect"]):
            lower_boundary = min(lower_boundary, line["rect"].y0 - font_size * 0.15)
    for image in images:
        image_rect = image["rect"]
        if image_rect.y0 >= rect.y1 - 0.5 and horizontal_overlap(rect, image_rect):
            lower_boundary = min(lower_boundary, image_rect.y0 - font_size * 0.15)
    return pymupdf.Rect(
        rect.x0,
        max(page.rect.y0, rect.y0 - font_size * 0.3),
        rect.x1,
        min(lower_boundary, page.rect.y1 - font_size * 0.3),
    )


def page_size_matches(page, source_page):
    return rect_key(page.rect) == rect_key(source_page.rect)


def restore_source_page(document, source_document, page_number):
    document.delete_page(page_number)
    document.insert_pdf(
        source_document,
        from_page=page_number,
        to_page=page_number,
        start_at=page_number,
    )


def create_versions(payload):
    pymupdf.TOOLS.set_small_glyph_heights(True)
    portrait = extract_source_portrait(payload["source_path"])
    source_document = pymupdf.open(payload["source_path"])
    document = pymupdf.open(payload["source_path"])
    review_marks = []
    applied_records = []
    unchanged_pages = set()
    pending = [
        {"id": index, "before": change["before"], "after": change["after"]}
        for index, change in enumerate(payload.get("changes", []))
    ]

    for page_number in range(document.page_count):
        source_page = source_document[page_number]
        page = document[page_number]
        fixed_images = fixed_image_rects(source_page)
        regions = build_page_regions(source_page, pending)
        if not regions:
            continue

        prepared = []
        unsafe_page = False
        for region in regions:
            change = region["change"]
            source_length = len(normalize(change["before"]))
            target_length = len(normalize(change["after"]))
            length_ratio = target_length / max(1, source_length)
            if length_ratio < 0.45 or length_ratio > 2.2:
                unsafe_page = True
                break

            font_size = region["font_size"]
            write_rect = expanded_text_rect(
                source_page, region["matched_lines"], font_size, fixed_images
            )
            if write_rect.is_empty or write_rect.height <= font_size * 0.9:
                unsafe_page = True
                break
            if any(write_rect.intersects(image["rect"]) for image in fixed_images):
                unsafe_page = True
                break
            if any(write_rect.intersects(item["write_rect"]) for item in prepared):
                unsafe_page = True
                break

            replacement_lines = split_for_pdf_lines(change["after"], region["matched_lines"])
            trial = pymupdf.open()
            trial_page = trial.new_page(width=source_page.rect.width, height=source_page.rect.height)
            spare_height, _ = insert_html(
                trial_page,
                write_rect,
                replacement_lines,
                font_size,
                region["color"],
                overlay=True,
            )
            trial.close()
            if spare_height < 0:
                unsafe_page = True
                break
            prepared.append(
                {
                    **region,
                    "write_rect": write_rect,
                    "replacement_lines": replacement_lines,
                    "source_ink": dark_pixel_count(source_page, region["source_rect"], font_size),
                }
            )

        if unsafe_page:
            unchanged_pages.add(page_number)
            continue

        before_page_edit = document.tobytes(garbage=4, deflate=True)
        try:
            for item in prepared:
                for matched_line in item["matched_lines"]:
                    page.add_redact_annot(matched_line["rect"], fill=(1, 1, 1), cross_out=False)
            page.apply_redactions(images=0, graphics=0, text=0)
            page = document.reload_page(page)
            for item in prepared:
                spare_height, _ = insert_html(
                    page,
                    item["write_rect"],
                    item["replacement_lines"],
                    item["font_size"],
                    item["color"],
                    overlay=True,
                )
                if spare_height < 0:
                    raise RuntimeError("PyMuPDF refused a replacement that no longer fits")
            page = document.reload_page(page)

            page_marks = []
            page_applied = []
            for item in prepared:
                change = item["change"]
                expected_text = normalize(change["after"])
                written_text = normalize(page.get_textbox(item["write_rect"]))
                written_lines = matching_lines(page, change["after"], region=item["write_rect"])
                replacement_ink = dark_pixel_count(page, item["write_rect"], item["font_size"])
                if (
                    expected_text not in written_text
                    or written_lines is None
                    or replacement_ink < max(8, item["source_ink"] * 0.25)
                ):
                    raise RuntimeError("replacement text did not survive extraction and rendering checks")
                page_marks.append(
                    (page_number, [tuple(line["rect"]) for line in written_lines])
                )
                page_applied.append(
                    {
                        "page": page_number,
                        "id": change["id"],
                        "before": change["before"],
                        "after": change["after"],
                    }
                )

            if (
                document.page_count != source_document.page_count
                or not page_size_matches(page, source_page)
                or not can_commit_page(page, fixed_images)
            ):
                raise RuntimeError("page fidelity verification failed")
        except Exception:
            document.close()
            document = pymupdf.open(stream=before_page_edit, filetype="pdf")
            unchanged_pages.add(page_number)
            continue

        committed_ids = {record["id"] for record in page_applied}
        pending = [change for change in pending if change["id"] not in committed_ids]
        review_marks.extend(page_marks)
        applied_records.extend(page_applied)

    if document.page_count != source_document.page_count:
        document.close()
        source_document.close()
        raise RuntimeError("PDF page count changed during refinement")
    for page_number in range(document.page_count):
        if not page_size_matches(document[page_number], source_document[page_number]):
            document.close()
            source_document.close()
            raise RuntimeError(f"PDF page dimensions changed on page {page_number}")

    document.save(payload["clean_path"], garbage=4, deflate=True)
    document.close()

    clean = pymupdf.open(payload["clean_path"])
    failed_after_save = []
    if clean.page_count == source_document.page_count:
        for page_number in range(clean.page_count):
            if not page_size_matches(clean[page_number], source_document[page_number]) or not can_commit_page(
                clean[page_number], fixed_image_rects(source_document[page_number])
            ):
                failed_after_save.append(page_number)
    else:
        clean.close()
        source_document.close()
        raise RuntimeError("saved PDF page count differs from the source")
    clean.close()

    if failed_after_save:
        repaired_path = f"{payload['clean_path']}.repaired"
        repaired = pymupdf.open(payload["clean_path"])
        for page_number in failed_after_save:
            restore_source_page(repaired, source_document, page_number)
            unchanged_pages.add(page_number)
        repaired.save(repaired_path, garbage=4, deflate=True)
        repaired.close()
        os.replace(repaired_path, payload["clean_path"])
        failed_set = set(failed_after_save)
        review_marks = [mark for mark in review_marks if mark[0] not in failed_set]
        applied_records = [record for record in applied_records if record["page"] not in failed_set]

    verified_clean = pymupdf.open(payload["clean_path"])
    page_count_verified = verified_clean.page_count == source_document.page_count
    if not page_count_verified:
        verified_clean.close()
        source_document.close()
        raise RuntimeError("final PDF page-count verification failed")
    for page_number in range(verified_clean.page_count):
        if not page_size_matches(verified_clean[page_number], source_document[page_number]) or not can_commit_page(
            verified_clean[page_number], fixed_image_rects(source_document[page_number])
        ):
            verified_clean.close()
            source_document.close()
            raise RuntimeError(f"final PDF fidelity verification failed on page {page_number}")
    verified_clean.close()

    review = pymupdf.open(payload["clean_path"])
    for page_number, coordinate_group in review_marks:
        for coordinates in coordinate_group:
            rect = pymupdf.Rect(coordinates)
            y = min(review[page_number].rect.y1 - 1, rect.y1 + 0.5)
            review[page_number].draw_line(
                pymupdf.Point(rect.x0, y),
                pymupdf.Point(rect.x1, y),
                color=(1, 0, 0),
                width=1.5,
                overlay=True,
            )
    review.save(payload["review_path"], garbage=4, deflate=True)
    review.close()

    verified_review = pymupdf.open(payload["review_path"])
    if verified_review.page_count != source_document.page_count:
        verified_review.close()
        source_document.close()
        raise RuntimeError("review PDF page count differs from the source")
    for page_number in range(verified_review.page_count):
        if not page_size_matches(verified_review[page_number], source_document[page_number]) or not same_image_geometry(
            verified_review[page_number], fixed_image_rects(source_document[page_number])
        ):
            verified_review.close()
            source_document.close()
            raise RuntimeError(f"review PDF fidelity verification failed on page {page_number}")
    verified_review.close()
    source_document.close()

    return {
        "changedLineCount": len(review_marks),
        "appliedChanges": [
            {"before": record["before"], "after": record["after"]}
            for record in applied_records
        ],
        "unchangedPages": sorted(unchanged_pages),
        "pageCountVerified": True,
        "portraitApplied": portrait is not None,
        "portraitDataUrl": portrait["data_url"] if portrait else None,
        "portrait": portrait,
    }


def normalize_compat_characters(value):
    """仅把 CJK 兼容字（⼤=大、⼠=士、⼯=工，U+2F00 康熙部首区）规范化为标准汉字。

    不能用全局 NFKC：它会把全角标点（，（）规范成半角（, (），破坏中文排版。
    """
    return "".join(
        unicodedata.normalize("NFKC", ch) if (0x2E80 <= ord(ch) <= 0x2FDF) else ch
        for ch in str(value or "")
    )


def generated_lines(value, width=46):
    result = []
    for source_line in str(value or "").splitlines():
        # CJK 兼容字规范化为标准汉字，FontAwesome 等 PUA 图标字符
        # 直接移除：这些字符会让 pdf2docx 转 Word 时丢字，且在中文字体下只是方框。
        line = normalize_compat_characters(source_line)
        line = "".join(ch for ch in line if not (0xE000 <= ord(ch) <= 0xF8FF))
        line = line.replace("\x00", "").replace("�", "").replace("□", "").strip()
        if not line:
            continue
        prefix = ""
        if line.startswith(("-", "•", "·", "", "▪", "◦", "●", "○")):
            prefix, line = "- ", line[1:].strip()
        while len(line) > width:
            cut = width
            for index in range(width, max(12, width - 10), -1):
                if line[index - 1] in "，。；：、,.;: /|":
                    cut = index
                    break
            result.append((prefix + line[:cut].strip(), False))
            prefix = "  "
            line = line[cut:].strip()
        result.append((prefix + line, False))
    return result


def create_generated_resume_pdf(payload, portrait=None):
    """Render a readable, recruiter-first fallback when source-template edits are unsafe."""
    text = str(payload.get("optimized_text") or "").strip()
    if not text:
        raise RuntimeError("generated resume requires optimized text")
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    font_name = "ResumeCN"
    font_path = payload.get("font_path")
    if not font_path or not os.path.exists(font_path):
        raise RuntimeError("generated resume requires a configured Chinese font")
    page.insert_font(fontname=font_name, fontfile=font_path)
    margin = 46
    y = 50
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    # 1) 优先从全文任意一行找"姓名：XXX"（不只是第一行），避免用户把姓名写在中间导致错取
    labeled_name = None
    for line in lines:
        m = re.match(r"^姓\s*名\s*[:：]\s*(.+)$", line)
        if m:
            labeled_name = m
            break
    first_line = lines[0] if lines else ""
    # "姓名：" 也属于元信息行，不应当成 standalone 姓名行
    is_meta_line = bool(re.match(r"^(?:求职目标|求职意向|目标岗位|联系方式|姓\s*名)\s*[:：]", first_line))
    # 姓名优先级：labeled_name(全文任意行"姓名：XXX") > 首行非元信息时的首段 > "求职者"
    if labeled_name:
        name = labeled_name.group(1).strip()
        has_header_name = True
    elif not is_meta_line and first_line:
        name = first_line
        has_header_name = len(normalize(first_line)) <= 20
    else:
        name = "求职者"
        has_header_name = False
    page.insert_text((margin, y), name, fontname=font_name, fontsize=21, color=(0.08, 0.20, 0.18))
    if portrait:
        page.insert_image(pymupdf.Rect(478, 38, 537, 112), stream=portrait["bytes"], keep_proportion=True)
    personal_fields = []
    personal_patterns = [
        ("性别", r"^性\s*别\s*[:：]\s*(.+)$"),
        ("政治面貌", r"^政治\s*面貌\s*[:：]\s*(.+)$"),
        ("籍贯", r"^籍\s*贯\s*[:：]\s*(.+)$"),
        ("出生年月", r"^出生年月\s*[:：]\s*(.+)$"),
        ("邮箱", r"^(?:电子邮箱|邮箱|电\s*邮)\s*[:：]\s*(.+)$"),
        ("电话", r"^(?:联系方式|电话|手机)\s*[:：]\s*(.+)$"),
    ]
    for label, pattern in personal_patterns:
        match = next((re.match(pattern, line) for line in lines if re.match(pattern, line)), None)
        if match:
            personal_fields.append(f"{label}：{match.group(1).strip()}")
    if personal_fields:
        first_row = "　｜　".join(personal_fields[:4])
        page.insert_text((margin, 80), first_row, fontname=font_name, fontsize=8.5, color=(0.25, 0.31, 0.29))
        for row_index, field in enumerate(personal_fields[4:]):
            page.insert_text((margin, 94 + row_index * 13), field, fontname=font_name, fontsize=8.5, color=(0.25, 0.31, 0.29))
    y += 34
    y = max(y, 126 if portrait else y)
    page.draw_line((margin, y), (549, y), color=(0.08, 0.28, 0.24), width=1.5)
    y += 22

    # 过滤掉个人信息相关行，避免混入section：
    #   (1) 所有"字段名：值"格式（政治面貌、性别、民族、籍贯、出生年月、电子邮箱、电话、学历、专业等）
    #   (2) PDF两列布局导致的跨行拆分单字行：性、别、籍、贯、姓、名、学、专、电、邮、院、校
    #   (3) 求职目标/求职意向/目标岗位/联系方式/姓名 等元信息行
    _PERSONAL_FIELD_LINE_RE = re.compile(
        r"^(?:姓\s*名|名|性\s*别|别|政治面貌|政治\s*面貌|籍\s*贯|贯|出生年月|出生日期|出生|年龄|婚否|婚姻状况|身高|体重|血型|户口|身份证|住址|通讯地址|地址|邮编|邮政编码|国籍|民族|电话|手机|联系方式|电子邮箱|邮箱|电\s*邮|E[- ]?mail|电子邮件|求职意向|求职目标|目标岗位|期望职位|期望工作|期望地点|期望城市|期望薪资|薪资要求|可到岗时间|入职时间|毕业时间|毕业年份|毕业院校|学\s*历|专\s*业|学位|学院|系别|研究方向|导师|学制|学号|院\s*校)\s*[:：]"
    )
    _PERSONAL_SINGLE_CHAR_RE = re.compile(r"^(?:性|别|籍|贯|姓|名|学|专|电|邮|院|校)$")
    def _is_personal_info_line(ln):
        t = (ln or "").strip()
        if not t:
            return True
        if _PERSONAL_FIELD_LINE_RE.match(t):
            return True
        if len(t) <= 3 and _PERSONAL_SINGLE_CHAR_RE.match(t):
            return True
        return False
    body_lines_all = lines[1:] if has_header_name else lines
    body_lines = [ln for ln in body_lines_all if not _is_personal_info_line(ln)]
    section_names = {
        "核心优势", "个人优势", "教育背景", "教育经历", "实习经历", "工作经历", "项目经历",
        "校园经历", "校园实践经历", "实践经历", "技能", "技能关键词", "技能特长", "专业技能",
        "专业技能与工具", "荣誉", "荣誉奖项", "获奖经历", "奖项荣誉", "证书"
    }
    section_token = re.compile(r"(?<![\u4e00-\u9fff])(" + "|".join(re.escape(item) for item in sorted(section_names, key=len, reverse=True)) + r")(?:\s|[:：]|$)")
    entry_line = re.compile(r"(?:19|20)\d{2}[.年/\-]|[|｜]|—|–")
    expanded_body_lines = []
    for body_line in body_lines:
        current = body_line.strip()
        matches = list(section_token.finditer(current))
        if matches and matches[0].start() > 0:
            prefix = current[:matches[0].start()].strip()
            if prefix:
                expanded_body_lines.append(prefix)
            current = current[matches[0].start():].strip()
        expanded_body_lines.append(current)
    body_lines = expanded_body_lines
    merged_body_lines = []
    previous_is_block = False
    for body_line in body_lines:
        current = body_line.strip()
        is_heading = normalize(current) in section_names
        starts_block = is_heading or entry_line.search(current) is not None or current.startswith(("-", "•", "·", "", "▪", "◦", "●", "○"))
        if merged_body_lines and not starts_block and not previous_is_block:
            merged_body_lines[-1] = f"{merged_body_lines[-1]} {current}".strip()
        else:
            merged_body_lines.append(current)
        previous_is_block = starts_block
    body_lines = merged_body_lines
    available_height = 828 - 138
    base_height = sum(
        (14 if normalize(line) in section_names else 0)
        + len(generated_lines(line, 64)) * 13
        + 2
        for line in body_lines
    )
    # 长简历仍保持单页，但只通过字号、行距和可用行宽做比例压缩，正文不删减。
    layout_scale = min(1.0, available_height / max(available_height, base_height))
    wrap_width = max(64, int(64 / max(layout_scale, 0.62)))
    row_height = 13 * layout_scale
    heading_height = 14 * layout_scale
    y = 138
    for original_line in body_lines:
        heading = normalize(original_line) in section_names
        entry = not heading and entry_line.search(original_line) is not None
        wrapped = generated_lines(original_line, wrap_width)
        needed = (heading_height if heading else 0) + len(wrapped) * row_height + 2 * layout_scale
        if y + needed > 828:
            raise RuntimeError("generated resume exceeds the one-page layout")
        if heading:
            page.draw_rect((margin, y, 549, y + heading_height - 1), color=None, fill=(0.91, 0.95, 0.93), overlay=True)
            page.insert_text((margin + 5, y + heading_height - 3), original_line, fontname=font_name, fontsize=8.5 * layout_scale, color=(0.08, 0.28, 0.24))
            y += heading_height
            continue
        if entry:
            page.draw_line((margin, y + row_height - 2), (min(549, margin + 118), y + row_height - 2), color=(0.08, 0.28, 0.24), width=0.65, overlay=True)
        for line, _ in wrapped:
            spare = page.insert_textbox((margin, y, 549, y + row_height), line, fontname=font_name, fontsize=(7.6 if entry else 7) * layout_scale, color=(0.08, 0.20, 0.18) if entry else (0.08, 0.10, 0.10), lineheight=1.0)
            if spare < 0:
                raise RuntimeError("generated resume line did not fit")
            y += row_height
        y += 2 * layout_scale

    document.save(payload["clean_path"], garbage=4, deflate=True)
    document.save(payload["review_path"], garbage=4, deflate=True)
    document.close()
    verified = pymupdf.open(payload["clean_path"])
    if verified.page_count != 1:
        verified.close()
        raise RuntimeError("generated resume must remain one page")
    extracted = "".join(page.get_text() for page in verified)
    verified.close()
    expected = normalize("".join(body_lines))
    actual = normalize(extracted)
    coverage = len(actual) / max(1, len(expected))
    if "□" in extracted or "�" in extracted or coverage < 0.55:
        raise RuntimeError("generated resume text verification failed")
    return {"portraitApplied": portrait is not None, "portraitDataUrl": portrait["data_url"] if portrait else None, "textVerified": True}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    if request.get("force_generated"):
        portrait = decode_portrait_data_url(request.get("portrait_data_url")) or (extract_source_portrait(request["source_path"]) if request.get("source_path") else None)
        result = {
            "changedLineCount": 0,
            "appliedChanges": [],
            "unchangedPages": [],
            "pageCountVerified": True,
            "deliveryMode": "generated-template",
        }
        result.update(create_generated_resume_pdf(request, portrait))
    else:
        result = create_versions(request)
    if not request.get("force_generated") and result["changedLineCount"] == 0:
        generated = create_generated_resume_pdf(request, result.pop("portrait", None))
        result["deliveryMode"] = "generated-template"
        result.update(generated)
    elif not request.get("force_generated"):
        result["deliveryMode"] = "source-template"
        result.pop("portrait", None)
    json.dump(result, sys.stdout, ensure_ascii=False)
