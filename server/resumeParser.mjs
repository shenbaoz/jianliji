import mammoth from "mammoth";
import JSZip from "jszip";

export class ResumeParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResumeParseError";
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
    let PDFParse;
    try {
      ({ PDFParse } = await import("pdf-parse"));
    } catch {
      throw new Error("当前服务器暂不支持 PDF 解析，请先上传 DOCX 或 TXT 简历。");
    }
    try {
      const parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      text = parsed.text || "";
    } catch {
      throw new ResumeParseError("PDF 文件无法读取，请确认文件未损坏、未加密且不是扫描件图片；也可以粘贴简历文字继续。");
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

  return { filename, text: normalized, candidateName: extractCandidateName(normalized) || undefined };
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
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeSpacedChineseName(line.trimEnd()))
    .filter((line) => !/^--\s+\d+\s+of\s+\d+\s+--$/.test(line.trim()))
    .filter((line, index, source) => {
      if (!line.trim()) return true;
      const normalized = line.trim();
      return source.findIndex((candidate) => candidate.trim() === normalized) === index || !isLikelyRepeatedPageHeader(normalized);
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
