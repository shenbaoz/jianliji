import mammoth from "mammoth";
import JSZip from "jszip";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export class ResumeParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResumeParseError";
  }
}

const pdfExtractPython = process.env.PYMUPDF_PYTHON || (process.platform === "win32" ? "python" : "python3");
const PDF_EXTRACT_TIMEOUT_MS = Number(process.env.PDF_EXTRACT_TIMEOUT_MS || 30_000);

// Extract PDF text with the same PyMuPDF engine that generates our PDFs.
// pdfjs-based parsers (pdf-parse 1.x) mis-map some CJK glyphs in
// PyMuPDF-generated files, so prefer PyMuPDF and keep pdf-parse as fallback.
async function extractPdfTextWithPyMuPDF(buffer) {
  const script = join(dirname(fileURLToPath(import.meta.url)), "vendor", "pdf_text_extract.py");
  const tempDir = await mkdtemp(join(tmpdir(), "resume-pdf-extract-"));
  const pdfPath = join(tempDir, "input.pdf");
  await writeFile(pdfPath, buffer);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(pdfExtractPython, [script], {
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
        settle(() => reject(new Error("PDF 解析超时")));
      }, PDF_EXTRACT_TIMEOUT_MS);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.stdin.on("error", () => settle(() => reject(new Error("PDF 解析组件提前退出"))));
      child.on("error", () => settle(() => reject(new Error("PDF 解析组件未安装"))));
      child.on("close", (code) => {
        if (code !== 0) {
          settle(() => reject(new Error(`PDF 解析失败：${stderr.trim() || "PyMuPDF 进程异常退出"}`)));
          return;
        }
        try {
          const payload = JSON.parse(stdout);
          settle(() => (payload.ok ? resolve(payload.text || "") : reject(new Error(payload.error || "PDF 解析失败"))));
        } catch {
          settle(() => reject(new Error("PDF 解析输出无效")));
        }
      });
      child.stdin.end(JSON.stringify({ filePath: pdfPath }));
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function parseResumeFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new Error("文件内容不能为空");
  }

  const filename = typeof file.originalname === "string" ? file.originalname : "resume";
  const lowerName = filename.toLowerCase();
  const fileType = await detectResumeFileType(file.buffer);
  if (
    (lowerName.endsWith(".pdf") && fileType !== "pdf") ||
    (lowerName.endsWith(".docx") && fileType !== "docx")
  ) {
    throw new ResumeParseError("文件内容与扩展名不一致，请上传真实的 PDF、DOCX 或 TXT 简历。");
  }
  let text = "";

  if (fileType === "pdf") {
    try {
      text = await extractPdfTextWithPyMuPDF(file.buffer);
    } catch (extractError) {
      // PyMuPDF unavailable: fall back to pdf-parse so DOCX/TXT flows and
      // environments without Python still work.
      let parsePdf;
      try {
        let pdfParseModule;
        try {
          pdfParseModule = await import("pdf-parse");
        } catch {
          // v1's package entry runs an example on ESM import; its parser module
          // itself is safe to require and remains compatible with Node 16.
          parsePdf = async () => require("pdf-parse/lib/pdf-parse.js")(file.buffer);
        }
        // pdf-parse v1 supports the Node 16 runtime used by the production host;
        // keep the v2 path so local upgrades remain compatible.
        if (pdfParseModule) parsePdf = typeof pdfParseModule.default === "function"
          ? async () => pdfParseModule.default(file.buffer)
          : typeof pdfParseModule.PDFParse === "function"
            ? async () => {
              const parser = new pdfParseModule.PDFParse({ data: file.buffer });
              return parser.getText();
            }
            : async () => require("pdf-parse/lib/pdf-parse.js")(file.buffer);
      } catch {
        throw new Error("当前服务器暂不支持 PDF 解析，请先上传 DOCX 或 TXT 简历。");
      }
      try {
        const parsed = await parsePdf();
        text = parsed.text || "";
      } catch {
        throw new ResumeParseError("PDF 文件无法读取，请确认文件未损坏、未加密且不是扫描件图片；也可以粘贴简历文字继续。");
      }
    }
  } else if (fileType === "docx") {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    text = parsed.value || "";
  } else if (fileType === "txt") {
    text = file.buffer.toString("utf8");
  } else if (lowerName.endsWith(".doc")) {
    throw new ResumeParseError("暂不支持旧版 .doc 格式，请另存为 .docx 或 PDF 后上传。");
  } else {
    throw new ResumeParseError("暂不支持该文件格式，请上传 PDF、DOCX 或 TXT 简历。");
  }

  const normalized = normalizeResumeText(text);
  if (!normalized) {
    throw new ResumeParseError("没有提取到有效文本，请确认文件不是扫描件图片，或直接粘贴简历文字继续。");
  }

  const candidateName = extractCandidateName(normalized) || undefined;
  return {
    filename,
    text: normalized,
    candidateName,
    basicInfo: extractBasicInfo(normalized, candidateName)
  };
}

export async function detectResumeFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";

  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    try {
      const archive = await JSZip.loadAsync(buffer);
      const uncompressedLimitBytes = Number(process.env.DOCX_UNCOMPRESSED_LIMIT_MB || 100) * 1024 * 1024;
      const oversized = Object.values(archive.files).some((entry) => {
        const size = entry?._data?.uncompressedSize;
        return typeof size === "number" && size > uncompressedLimitBytes;
      });
      if (oversized) {
        throw new ResumeParseError("DOCX 解压后体积过大，请精简文档中的图片或内容后重试。");
      }
      if (archive.file("[Content_Types].xml") && archive.file("word/document.xml")) return "docx";
    } catch (error) {
      if (error instanceof ResumeParseError) throw error;
      return null;
    }
    return null;
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
  if (/<\s*(?:html|svg|script|iframe|object)\b/i.test(text)) return null;
  const disallowedControls = [...text].filter((character) => {
    const code = character.charCodeAt(0);
    return code === 0 || (code < 32 && ![9, 10, 13].includes(code));
  }).length;
  return disallowedControls / Math.max(text.length, 1) > 0.01 ? null : "txt";
}

export function normalizeResumeText(text) {
  const seenLines = new Set();
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeSpacedChineseName(line.trimEnd()))
    .filter((line) => !/^--\s+\d+\s+of\s+\d+\s+--$/.test(line.trim()))
    .filter((line) => {
      if (!line.trim()) return true;
      const normalized = line.trim();
      if (seenLines.has(normalized)) return !isLikelyRepeatedPageHeader(normalized);
      seenLines.add(normalized);
      return true;
    });
  const joined = [];
  for (const line of lines) {
    const previous = joined.at(-1);
    if (previous && shouldJoinChineseSoftWrap(previous, line, joined.length - 1)) joined[joined.length - 1] = `${previous}${line.trimStart()}`;
    else joined.push(line);
  }
  return joined
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const resumeSectionHeading = /^(?:个人信息|求职意向|教育经历|工作经历|实习经历|项目经历|校园经历|技能|专业技能|证书|荣誉|自我评价)$/;

function shouldJoinChineseSoftWrap(previous, next, previousIndex) {
  const left = previous.trim();
  const right = next.trim();
  if (!left || !right || resumeSectionHeading.test(left) || resumeSectionHeading.test(right)) return false;
  // 双栏 PDF 常把"姓名"、"性别"等字段标签拆成两行。标签值已完整时，
  // 绝不能再与下一列的单字标签拼接（例如"姓名：杜小艳" + "性"）。
  if (/[:：]/.test(left)) return false;
  if (previousIndex === 0 && /^[\u4e00-\u9fff·]{2,4}$/.test(left)) return false;
  if (/[。；;：:！？!?]$/.test(left) || /^[-•·▪●\d]/.test(right)) return false;
  return left.length <= 6 && /[\u4e00-\u9fff]$/.test(left) && /^[\u4e00-\u9fff，、]/.test(right);
}

function normalizeSpacedChineseName(line) {
  const trimmed = line.trim();
  return /^(?:[\u4e00-\u9fff·]\s+){1,5}[\u4e00-\u9fff·]$/.test(trimmed)
    ? trimmed.replace(/\s+/g, "")
    : line;
}

function isLikelyRepeatedPageHeader(line) {
  return line.length <= 30 && /^(?:个人简历|求职简历|简历|Resume)$/i.test(line);
}

function extractCandidateName(text) {
  return String(text || "")
    .split(/\n+/)
    .slice(0, 8)
    .map((line) => line.trim().replace(/^姓\s*名\s*[:：]\s*/, "").replace(/\s+/g, ""))
    .find((line) => /^[\u4e00-\u9fff·]{2,4}$/.test(line) && !resumeSectionHeading.test(line) && !/^(个人简历|求职简历|求职者)$/.test(line)) || "";
}

function extractBasicInfo(text, candidateName) {
  const source = String(text || "");
  const school = source.match(/([\u4e00-\u9fff]{2,16}(?:大学|学院))/)?.[1] || "";
  const degree = source.match(/(?:高中|大专|本科|硕士|博士)/)?.[0] || "";
  const educationWindow = school ? source.slice(source.indexOf(school) + school.length, source.indexOf(school) + school.length + 100) : "";
  const major = educationWindow.match(/([\u4e00-\u9fff]{2,20})\s*[/｜|]\s*(?:高中|大专|本科|硕士|博士)/)?.[1] || "";

  return {
    name: candidateName || "",
    phone: source.match(/1[3-9]\d[- ]?\d{4}[- ]?\d{4}/)?.[0] || "",
    email: source.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "",
    school,
    major,
    degree
  };
}
