import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { editDocxText, convertPdfToDocx } from "./wordEditor.mjs";

const execFileAsync = promisify(execFile);
const python = process.platform === "win32" ? "python" : "python3";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function createDocxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p><w:r><w:t>姓名：测试用户</w:t></w:r></w:p>
    <w:p><w:r><w:t>教育背景</w:t></w:r></w:p>
    <w:p><w:r><w:t>某大学 新闻学本科</w:t></w:r><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId99"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
  </w:body>
</w:document>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId99" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`);
  zip.file("word/media/image1.png", PNG);
  return zip.generateAsync({ type: "nodebuffer" });
}

async function textOf(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.replace(/\s+/g, " ").trim();
}

test("editDocxText replaces paragraphs in order, appends extra lines and keeps the embedded image", async () => {
  const fixture = await createDocxFixture();
  const edited = await editDocxText({ docxBuffer: fixture, text: "姓名：张三\n教育背景\n某大学 新闻学\n技能\n剪映" });

  const zip = await JSZip.loadAsync(edited);
  assert.ok(zip.file("word/media/image1.png"), "source photo must survive the text replacement");

  const text = await textOf(edited);
  assert.ok(text.includes("姓名：张三"));
  assert.ok(text.includes("教育背景"));
  assert.ok(text.includes("某大学 新闻学"));
  assert.ok(text.includes("技能"));
  assert.ok(text.includes("剪映"));
  assert.ok(!text.includes("测试用户"), "original paragraph text must be replaced");
});

test("editDocxText clears surplus paragraphs instead of dropping the layout", async () => {
  const fixture = await createDocxFixture();
  const edited = await editDocxText({ docxBuffer: fixture, text: "姓名：张三\n教育背景" });

  const zip = await JSZip.loadAsync(edited);
  assert.ok(zip.file("word/media/image1.png"), "photo must survive even when paragraphs are cleared");

  const text = await textOf(edited);
  assert.ok(text.includes("姓名：张三"));
  assert.ok(text.includes("教育背景"));
  assert.ok(!text.includes("某大学"), "surplus paragraph text must be cleared");
});

test("editDocxText escapes XML metacharacters in the replacement text", async () => {
  const fixture = await createDocxFixture();
  const edited = await editDocxText({ docxBuffer: fixture, text: "张三 & 团队 <运营> \"引号\"\n教育背景" });
  const text = await textOf(edited);
  assert.ok(text.includes("张三 & 团队 <运营> \"引号\""));
});

test("convertPdfToDocx turns an edited PDF into an editable docx while keeping images", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf2docx-"));
  const pdfPath = join(uploadDir, "source.pdf");
  const docxPath = join(uploadDir, "out.docx");
  await writeFile(pdfPath, await createPdfBuffer(["Name: Test User", "Education: Test University", "Managed event operations"], true));
  try {
    await convertPdfToDocx({ pdfPath, docxPath, deliveryMode: "source-template" });
    const bytes = await readFile(docxPath);
    const zip = await JSZip.loadAsync(bytes);
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
    assert.ok(media.length > 0, "converted docx must keep the source image");
    const text = await textOf(bytes);
    assert.ok(text.includes("Test User"));
    assert.ok(text.includes("Managed event operations"));
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

test("generated-template mode disables table detection so the top-right photo survives conversion", async () => {
  const uploadDir = await mkdtemp(join(tmpdir(), "resume-pdf2docx-template-"));
  const pdfPath = join(uploadDir, "template.pdf");
  // 复刻生成模板的版式：姓名 + 顶部装饰线 + 多行正文 + 右上角照片。
  // 这种布局会让 pdf2docx 把顶部区域误判成表格并吞掉照片。
  await createTemplatePdf(pdfPath);
  try {
    const docxPath = join(uploadDir, "template.docx");
    await convertPdfToDocx({ pdfPath, docxPath, deliveryMode: "generated-template" });
    const zip = await JSZip.loadAsync(await readFile(docxPath));
    const media = Object.keys(zip.files).filter((name) => name.startsWith("word/media/"));
    assert.ok(media.length > 0, "generated-template conversion must keep the top-right photo");
    const text = await textOf(await readFile(docxPath));
    assert.ok(text.includes("测试用户"));
  } finally {
    await rm(uploadDir, { recursive: true, force: true });
  }
});

async function createTemplatePdf(pdfPath) {
  const script = [
    "import pymupdf",
    "import io",
    "from PIL import Image",
    "import sys",
    `out = ${JSON.stringify(pdfPath)}`,
    "doc = pymupdf.open()",
    "page = doc.new_page(width=595, height=842)",
    "page.insert_font(fontname='CN', fontfile=r'C:\\Windows\\Fonts\\simhei.ttf')",
    "page.insert_text((46, 50), '测试用户', fontname='CN', fontsize=21)",
    "page.draw_line((46, 84), (549, 84), color=(0.08, 0.28, 0.24), width=1.5)",
    "buf = io.BytesIO()",
    "Image.new('RGB', (60, 80), (120, 140, 160)).save(buf, format='PNG')",
    "page.insert_image(pymupdf.Rect(478, 38, 537, 112), stream=buf.getvalue(), keep_proportion=True)",
    "lines = ['联系方式：13800138000', '求职目标：内容运营', '核心优势', '- 独立运营公众号，实现稳定周更']",
    "y = 106",
    "for line in lines:",
    "    page.insert_text((46, y), line, fontname='CN', fontsize=10.5)",
    "    y += 21",
    "doc.save(out, garbage=4, deflate=True)",
    "doc.close()"
  ].join("\n");
  await execFileAsync(python, ["-c", script], { env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } });
}

function createPdfBuffer(lines, includeImage = false) {
  return new Promise((resolve) => {
    const chunks = [];
    const doc = new PDFDocument();
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    if (includeImage) {
      doc.image(PNG, 455, 45, { width: 54, height: 54 });
    }
    lines.forEach((line) => doc.text(line));
    doc.end();
  });
}
