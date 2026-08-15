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

import pymupdf


def normalize(value):
    value = re.sub(r"\s+", "", str(value or ""))
    value = re.sub(r"^[•·\-]+", "", value)
    return re.sub(r"[，。；：、,.!！?？]", "", value)


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
    }


def generated_lines(value, width=46):
    result = []
    for source_line in str(value or "").splitlines():
        line = source_line.strip()
        if not line:
            continue
        prefix = ""
        if line.startswith(("-", "•", "·")):
            prefix, line = "• ", line[1:].strip()
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


def create_generated_resume_pdf(payload):
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
    has_header_name = bool(lines and len(normalize(lines[0])) <= 20)
    name = lines[0] if has_header_name else "求职者"
    page.insert_text((margin, y), name, fontname=font_name, fontsize=21, color=(0.08, 0.20, 0.18))
    y += 34
    page.draw_line((margin, y), (549, y), color=(0.08, 0.28, 0.24), width=1.5)
    y += 22

    body_lines = lines[1:] if has_header_name else lines
    for original_line in body_lines:
        heading = normalize(original_line) in {"核心优势", "教育背景", "实习经历", "工作经历", "项目经历", "校园经历", "技能", "技能特长", "专业技能", "荣誉", "证书"}
        wrapped = generated_lines(original_line, 46)
        needed = (22 if heading else 0) + len(wrapped) * 21 + 5
        if y + needed > 790:
            page = document.new_page(width=595, height=842)
            page.insert_font(fontname=font_name, fontfile=font_path)
            y = 50
        if heading:
            page.draw_rect((margin, y, 549, y + 18), color=None, fill=(0.91, 0.95, 0.93), overlay=True)
            page.insert_text((margin + 6, y + 13), original_line, fontname=font_name, fontsize=11, color=(0.08, 0.28, 0.24))
            y += 26
            continue
        for line, _ in wrapped:
            spare = page.insert_textbox((margin, y, 549, y + 20), line, fontname=font_name, fontsize=10.5, color=(0.08, 0.10, 0.10), lineheight=1.1)
            if spare < 0:
                raise RuntimeError("generated resume line did not fit")
            y += 21
        y += 4

    document.save(payload["clean_path"], garbage=4, deflate=True)
    document.save(payload["review_path"], garbage=4, deflate=True)
    document.close()
    verified = pymupdf.open(payload["clean_path"])
    extracted = "".join(page.get_text() for page in verified)
    verified.close()
    required = [normalize(line) for line in body_lines if len(normalize(line)) >= 4]
    if "□" in extracted or "�" in extracted or any(item not in normalize(extracted) for item in required):
        raise RuntimeError("generated resume text verification failed")
    return {"portraitApplied": False, "textVerified": True}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    result = create_versions(request)
    if result["changedLineCount"] == 0:
        generated = create_generated_resume_pdf(request)
        result["deliveryMode"] = "generated-template"
        result.update(generated)
    else:
        result["deliveryMode"] = "source-template"
        result["portraitApplied"] = False
    json.dump(result, sys.stdout, ensure_ascii=False)
