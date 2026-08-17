import JSZip from "jszip";
import { getApiBase } from "./apiBase";
import { getVisitorHeaders } from "./storage";

// Word 导出：
// - 有原版源文件（PDF/DOCX）时，优先走服务端 /api/export-word 生成"原版 Word"
//   （PDF 源：转换已精修的成品 PDF，保留照片/版式；DOCX 源：直接在源文档上替换文字）。
// - 无源文件或服务端不可用时，回退到客户端 jszip 纯文本生成。

export type WordExportSource = {
  pdfUrl?: string;
  docxUrl?: string;
  deliveryMode?: "source-template" | "generated-template";
};

export async function downloadResumeWord(text: string, fileName = "优化后简历.docx", source?: WordExportSource): Promise<boolean> {
  if (source?.pdfUrl || source?.docxUrl) {
    try {
      const fileUrl = await requestServerWord(text, source);
      triggerDownload(fileUrl);
      return true;
    } catch {
      // 服务端原版导出失败（如转换组件未部署）：回退纯文本导出
    }
  }
  await downloadClientWord(text, fileName);
  return false;
}

async function requestServerWord(text: string, source: WordExportSource) {
  const response = await fetch(`${getApiBase()}/api/export-word`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getVisitorHeaders() },
    body: JSON.stringify({
      text,
      pdfUrl: source.pdfUrl || undefined,
      docxUrl: source.docxUrl || undefined,
      deliveryMode: source.deliveryMode || undefined
    })
  });
  const payload = (await response.json().catch(() => ({}))) as { fileUrl?: string; error?: string } | null;
  if (!response.ok || !payload?.fileUrl) throw new Error(payload?.error || "Word 导出失败。");
  return payload.fileUrl.startsWith("/api/") ? `${getApiBase()}${payload.fileUrl}` : payload.fileUrl;
}

function triggerDownload(fileUrl: string) {
  if (/MicroMessenger|wxwork/i.test(navigator.userAgent)) {
    window.location.assign(fileUrl);
    return;
  }
  const url = new URL(fileUrl, window.location.href);
  url.searchParams.set("download", "1");
  const link = document.createElement("a");
  link.href = url.toString();
  link.download = "优化后简历.docx";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadClientWord(text: string, fileName: string) {
  const documentXml = buildDocumentXml(text);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.file("_rels/.rels", rootRelsXml());
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", documentRelsXml());
  zip.file("word/styles.xml", stylesXml());
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE"
  });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

function buildDocumentXml(text: string) {
  const blocks = parseResumeBlocks(text);
  const paragraphs = blocks.map(renderParagraph).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

type Block =
  | { kind: "name"; text: string }
  | { kind: "target"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "line"; text: string; bullet: boolean };

const sectionTitles = new Set([
  "个人优势",
  "核心优势",
  "工作经历 / 实习经历",
  "工作经历",
  "实习经历",
  "实习及项目经历",
  "项目与实习经历",
  "核心经历",
  "关键成果",
  "代表成果",
  "项目经历",
  "校园项目",
  "校园经历",
  "教育经历",
  "教育背景",
  "技能关键词",
  "技能",
  "技能与优势",
  "专业技能",
  "个人技能",
  "技能与工具",
  "技能特长",
  "技能清单",
  "自我评价",
  "证书",
  "荣誉",
  "获奖经历",
  "奖项荣誉",
  "荣誉奖项"
]);

const hiddenSections = new Set(["可继续补充的真实证据", "投递版本建议", "优化说明"]);

const EAST_ASIA_FONT = "微软雅黑";
const LATIN_FONT = "Microsoft YaHei";
const ACCENT_COLOR = "173C33";

function parseResumeBlocks(text: string): Block[] {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const blocks: Block[] = [];
  const firstLine = lines[0];
  const nameMatch = firstLine.match(/^姓\s*名\s*[:：]\s*(.+)$/);
  if (nameMatch) {
    blocks.push({ kind: "name", text: nameMatch[1].trim() });
  } else if (!/^(?:求职目标|求职意向|联系方式)\s*[:：]/.test(firstLine)) {
    blocks.push({ kind: "name", text: firstLine });
  } else {
    blocks.push({ kind: "name", text: "" });
  }

  lines.slice(1).forEach((line) => {
    if (/^求职目标\s*[:：]/.test(line)) {
      blocks.push({ kind: "target", text: line.replace(/^求职目标\s*[:：]\s*/, "求职意向：") });
      return;
    }
    if (/^求职意向\s*[:：]/.test(line)) {
      blocks.push({ kind: "target", text: line });
      return;
    }
    if (/^联系方式\s*[:：]/.test(line)) {
      blocks.push({ kind: "contact", text: line });
      return;
    }
    if (sectionTitles.has(line)) {
      if (!hiddenSections.has(line)) blocks.push({ kind: "heading", text: line });
      return;
    }
    if (/^技能\s*[:：]/.test(line)) {
      blocks.push({ kind: "heading", text: "技能" });
      blocks.push({ kind: "line", text: line.replace(/^技能\s*[:：]\s*/, ""), bullet: false });
      return;
    }
    blocks.push({ kind: "line", text: line.replace(/^[-•·▪◦●]\s*/, ""), bullet: /^[-•·▪◦●]/.test(line) });
  });
  return blocks;
}

function renderParagraph(block: Block) {
  const text = escapeXml(block.text);
  switch (block.kind) {
    case "name": {
      if (!block.text) return "";
      return paragraph(run(text, { size: 52, bold: true }), { align: "center", before: 240, after: 120 });
    }
    case "target": {
      return paragraph(run(text, { size: 24 }), { align: "center", after: 120 });
    }
    case "contact": {
      return paragraph(run(text, { size: 20, color: "555555" }), { align: "center", after: 200 });
    }
    case "heading": {
      return paragraph(run(text, { size: 28, bold: true, color: ACCENT_COLOR }), { before: 200, after: 80 });
    }
    case "line": {
      const prefix = block.bullet ? "• " : "";
      return paragraph(run(prefix + text, { size: 21 }), { indent: block.bullet ? 360 : 0, after: 40 });
    }
  }
}

function paragraph(runsXml: string, pPr: Record<string, unknown> = {}) {
  const props: string[] = [];
  if (pPr.align) props.push(`<w:jc w:val="${pPr.align}"/>`);
  if (pPr.before !== undefined || pPr.after !== undefined) {
    props.push(`<w:spacing w:before="${pPr.before ?? 0}" w:after="${pPr.after ?? 0}" w:line="300" w:lineRule="auto"/>`);
  }
  if (pPr.indent) props.push(`<w:ind w:left="${pPr.indent}" w:hanging="${pPr.indent}"/>`);
  const pPrXml = props.length ? `<w:pPr>${props.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${runsXml}</w:p>`;
}

function run(text: string, rPr: { size?: number; bold?: boolean; color?: string } = {}) {
  const props: string[] = [];
  if (rPr.bold) props.push("<w:b/>");
  if (rPr.color) props.push(`<w:color w:val="${rPr.color}"/>`);
  props.push(`<w:sz w:val="${rPr.size ?? 21}"/>`);
  props.push(`<w:szCs w:val="${rPr.size ?? 21}"/>`);
  props.push(`<w:rFonts w:ascii="${LATIN_FONT}" w:eastAsia="${EAST_ASIA_FONT}" w:hAnsi="${LATIN_FONT}"/>`);
  return `<w:r><w:rPr>${props.join("")}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${LATIN_FONT}" w:eastAsia="${EAST_ASIA_FONT}" w:hAnsi="${LATIN_FONT}"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="60" w:line="300" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;
}

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
