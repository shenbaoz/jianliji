// Word 导出：保留原版（照片、页面、分区、版式）的服务端实现。
// - PDF 源：复用 pdfEditor 的"原版式 + 替换文字"精修结果，再用 pdf2docx 转成可编辑 docx。
// - DOCX 源：直接在源 docx 的 word/document.xml 里替换段落文字，照片与版式原样保留。
import JSZip from "jszip";
import mammoth from "mammoth";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

const paragraphPattern = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
const textNodePattern = /<w:t\b[^>]*>[\s\S]*?<\/w:t>/g;
const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf]/g;
const garbledPattern = /\ufffd/;

export function getResumeLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\-•·]\s*/, "").trim())
    .filter(Boolean);
}

// 把优化后的成品文字按顺序写回源 DOCX 的段落（保留照片、表格、分区版式）。
// 段落数不足时追加新段落；段落数多余时清空多余段落的文字但保留其结构。
export async function editDocxText({ docxBuffer, text }) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("没有找到 DOCX 正文内容。");
  const lines = getResumeLines(text);
  if (!lines.length) throw new Error("成品文字不能为空。");

  let lineIndex = 0;
  const edited = documentXml.replace(paragraphPattern, (paragraphXml) => {
    if (!hasVisibleText(paragraphXml)) return paragraphXml;
    if (lineIndex >= lines.length) return clearParagraphText(paragraphXml);
    return setParagraphText(paragraphXml, lines[lineIndex++]);
  });

  let extra = "";
  for (; lineIndex < lines.length; lineIndex += 1) {
    extra += simpleParagraph(lines[lineIndex]);
  }
  zip.file("word/document.xml", edited.replace("</w:body>", `${extra}</w:body>`));
  const output = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  // DOCX 包完整性：损坏的输出绝不能交给用户
  const checkZip = await JSZip.loadAsync(output);
  if (!checkZip.file("[Content_Types].xml") || !checkZip.file("word/document.xml")) {
    throw new Error("Word 文档结构不完整，请重试或换一份简历。");
  }
  return output;
}

function hasVisibleText(paragraphXml) {
  return /<w:t\b[^>]*>\s*[^<\s][^<]*<\/w:t>/.test(paragraphXml);
}

function setParagraphText(paragraphXml, line) {
  const escaped = escapeXml(line);
  let replaced = false;
  const output = paragraphXml.replace(textNodePattern, (node) => {
    if (!replaced) {
      replaced = true;
      return node.replace(/>[\s\S]*?<\//, `>${escaped}</`);
    }
    return node.replace(/>[\s\S]*?<\//, "></");
  });
  if (!replaced) {
    // 段落里只有图片/形状没有文字节点：在末尾补一个文字 run
    return paragraphXml.replace("</w:p>", `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`);
  }
  return output;
}

function clearParagraphText(paragraphXml) {
  return paragraphXml.replace(textNodePattern, (node) => node.replace(/>[\s\S]*?<\//, "></"));
}

function simpleParagraph(line) {
  return `<w:p><w:pPr><w:spacing w:after="40" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 用 pdf2docx 把已精修的 clean PDF（原版式 + 优化文字）转成可编辑 docx，
// 转换后校验 DOCX 包完整性、中文字保留率与乱码（借鉴格式工坊 pdf2docx_convert.py 的质量检查）。
// deliveryMode 为 "generated-template" 时关闭表格检测：模板顶部装饰线会被 pdf2docx
// 误判成表格并吞掉照片，而生成模板本身没有真实表格，关闭检测即可保留照片。
export async function convertPdfToDocx({ pdfPath, docxPath, deliveryMode }) {
  const payload = await runPdfToDocx({
    pdf_path: pdfPath,
    docx_path: docxPath,
    table_detection: deliveryMode !== "generated-template"
  });
  await verifyConvertedDocx(docxPath, payload);
  return payload;
}

async function verifyConvertedDocx(docxPath, payload) {
  const buffer = await readFile(docxPath);
  const extracted = (await mammoth.extractRawText({ buffer })).value || "";
  if (garbledPattern.test(extracted)) {
    await rm(docxPath, { force: true }).catch(() => {});
    throw new Error("Word 转换结果包含乱码字符，请重试或换一份简历。");
  }
  // 照片保留：源 PDF 有证件照但转换结果一张图片都没有 → 说明版式处理把照片吞了，
  // 这种"缺照片"的输出不能交给用户。
  const sourcePortraits = Number(payload?.source_portraits) || 0;
  if (sourcePortraits > 0) {
    const mediaCount = Object.keys((await JSZip.loadAsync(buffer)).files)
      .filter((name) => name.startsWith("word/media/")).length;
    if (mediaCount === 0) {
      await rm(docxPath, { force: true }).catch(() => {});
      throw new Error("Word 转换未能保留简历照片，请重试或换一份简历。");
    }
  }
  // NFKC 归一化后再统计中文：兼容字（⼤=大）也算中文，避免漏报转换丢字
  const renderedCjk = (extracted.normalize("NFKC").match(cjkPattern) || []).length;
  const sourceCjk = Number(payload?.source_cjk) || 0;
  if (sourceCjk > 0 && renderedCjk / sourceCjk < 0.6) {
    await rm(docxPath, { force: true }).catch(() => {});
    throw new Error("Word 转换丢失了较多文字，请重试或换一份简历。");
  }
}

function runPdfToDocx({ pdf_path: pdfPath, docx_path: docxPath, table_detection }) {
  const python = process.env.PYMUPDF_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = join(process.cwd(), "server", "vendor", "pdf2docx_convert.py");
  const timeoutMs = Number(process.env.PDF2DOCX_TIMEOUT_MS || 120_000);
  const outputLimit = 2 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new Error("Word 转换超时，请稍后重试或换一份简历。")));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (stdout.length < outputLimit) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < outputLimit) stderr += chunk;
    });
    child.stdin.on("error", (error) => {
      settle(() => reject(new Error(`Word 转换组件提前退出：${error?.code || "stdin error"}`)));
    });
    child.on("error", () => settle(() => reject(new Error("Word 转换组件未安装，请安装 requirements-pdf.txt 中的依赖。"))));
    child.on("close", (code) => {
      try {
        // pymupdf 会把 fitz deprecation warning 打到 stdout，只取 JSON 行
        const jsonLine = stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line.startsWith("{"));
        const payload = jsonLine ? JSON.parse(jsonLine) : null;
        if (code === 0 && payload?.ok) {
          settle(() => resolve(payload));
          return;
        }
        const message = payload?.error
          || (code !== 0 ? (stderr.trim() || "pdf2docx 进程异常退出") : "Word 转换失败。");
        settle(() => reject(new Error(message)));
      } catch {
        settle(() => reject(new Error(code !== 0 ? (stderr.trim() || "pdf2docx 进程异常退出") : "Word 转换组件返回了无效结果。")));
      }
    });
    child.stdin.end(JSON.stringify({ pdf_path: pdfPath, docx_path: docxPath, table_detection: table_detection !== false }));
  });
}
