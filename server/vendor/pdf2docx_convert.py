#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert a PDF (typically the already-edited clean resume PDF that keeps the
original layout, photos and sections) into an editable DOCX using pdf2docx,
then run the same integrity checks the resume pipeline requires:

1. DOCX package integrity (ZIP + [Content_Types].xml + word/document.xml)
2. Scanned-PDF detection (no text layer -> fail with a clear message)
3. Source text extraction for the Node side to compare CJK preservation and
   detect garbled output (U+FFFD / tofu) in the converted docx.

Input:  JSON on stdin: {"pdf_path": "...", "docx_path": "..."}
Output: JSON on stdout:
  {"ok": true, "source_text": "...", "source_cjk": n, "source_chars": n}
  or {"ok": false, "error": "..."}
"""
import sys
import io
import os
import re
import json
import logging
from zipfile import BadZipFile, ZipFile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
logging.getLogger("pdf2docx").setLevel(logging.ERROR)

_CJK_PATTERN = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
_SOURCE_TEXT_LIMIT = 200_000


def count_source_portraits(pdf_path):
    """统计源 PDF 前两页里"看起来像证件照"的图片数量。

    判定条件与 pymupdf_official_replace.py 的 extract_source_portrait 一致：
    宽高比 0.45-1.5、位于页面上半部、尺寸不小于 32pt。装饰条、水印等
    超宽/超矮图片不算。Node 侧用它做"照片保留"质量检查。
    """
    try:
        import pymupdf  # PyMuPDF
    except ImportError:
        try:
            import fitz as pymupdf  # older alias
        except ImportError:
            return 0
    try:
        document = pymupdf.open(pdf_path)
        count = 0
        try:
            for page_number in range(min(2, document.page_count)):
                page = document[page_number]
                for image in page.get_images(full=True):
                    xref = image[0]
                    metadata = document.extract_image(xref)
                    width = int(metadata.get("width") or 0)
                    height = int(metadata.get("height") or 0)
                    image_bytes = metadata.get("image")
                    if not image_bytes or len(image_bytes) > 1_500_000:
                        continue
                    ratio = width / max(1, height)
                    if ratio < 0.45 or ratio > 1.5:
                        continue
                    rects = page.get_image_rects(xref)
                    if not rects:
                        continue
                    for rect in rects:
                        if rect.y0 > page.rect.height * 0.48:
                            continue
                        if rect.width < 32 or rect.height < 32:
                            continue
                        count += 1
        finally:
            document.close()
        return count
    except Exception:  # noqa: BLE001 - best-effort
        return 0


def check_docx_integrity(docx_path):
    """DOCX 本质是 ZIP 归档，至少必须包含 [Content_Types].xml 与
    word/document.xml；损坏的归档立即失败，避免把打不开的文件交给用户。"""
    required_entries = {"[Content_Types].xml", "word/document.xml"}
    with ZipFile(docx_path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("DOCX archive contains a corrupt entry")
        names = set(archive.namelist())
        missing = required_entries - names
        if missing:
            raise RuntimeError(f"DOCX archive is missing required entries: {sorted(missing)}")


def extract_pdf_text(pdf_path):
    try:
        import pymupdf  # PyMuPDF
    except ImportError:
        try:
            import fitz as pymupdf  # older alias
        except ImportError:
            return "", 0, 0
    try:
        document = pymupdf.open(pdf_path)
        try:
            text = "\n".join(page.get_text() for page in document)
        finally:
            document.close()
    except Exception:  # noqa: BLE001 - extraction is best-effort
        return "", 0, 0
    chars = len(text.strip())
    return text[: _SOURCE_TEXT_LIMIT], len(_CJK_PATTERN.findall(text)), chars


def main():
    try:
        request = json.load(sys.stdin)
        pdf_path = request.get("pdf_path")
        docx_path = request.get("docx_path")
        if not pdf_path or not docx_path:
            raise RuntimeError("pdf_path and docx_path are required")
        if not os.path.exists(pdf_path):
            raise RuntimeError("source pdf does not exist")

        source_text, source_cjk, source_chars = extract_pdf_text(pdf_path)
        if source_chars == 0:
            raise RuntimeError("该 PDF 没有文字层（可能是扫描件图片），Word 导出需要先转成文字版简历再导出。")

        source_portraits = count_source_portraits(pdf_path)

        from pdf2docx import Converter

        converter = Converter(pdf_path)
        try:
            # 生成模板（generated-template）没有真实表格，但顶部装饰线会让
            # pdf2docx 误判成表格并把照片吞掉；关闭表格检测以保留照片。
            if request.get("table_detection") is False:
                converter.convert(docx_path, parse_stream_table=False, parse_lattice_table=False)
            else:
                converter.convert(docx_path)
        finally:
            converter.close()
        if not os.path.exists(docx_path) or os.path.getsize(docx_path) == 0:
            raise RuntimeError("conversion produced an empty docx")

        check_docx_integrity(docx_path)
        print(json.dumps({
            "ok": True,
            "source_text": source_text,
            "source_cjk": source_cjk,
            "source_chars": source_chars,
            "source_portraits": source_portraits
        }, ensure_ascii=False))
    except Exception as error:  # noqa: BLE001 - report any failure back to Node
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
