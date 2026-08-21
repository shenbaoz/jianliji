import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const defaultUploadDir = join(process.cwd(), "data", "uploads");

const chineseFontCandidates = [
  process.env.CHINESE_FONT_PATH,
  process.env.RESUME_PDF_FONT_PATH,
  join(process.cwd(), "data", "fonts", "simhei.ttf"),
  join(process.cwd(), "data", "fonts", "DroidSansFallbackFull.ttf"),
  join(process.cwd(), "data", "fonts", "NotoSansSC-Regular.ttf"),
  "C:\\Windows\\Fonts\\simhei.ttf",
  "C:\\Windows\\Fonts\\msyh.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
  "/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf",
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc"
].filter(Boolean);

let cachedFontPath = null;

async function findChineseFontPath() {
  if (cachedFontPath) return cachedFontPath;
  for (const candidate of chineseFontCandidates) {
    try {
      await access(candidate);
      cachedFontPath = candidate;
      console.log(`[pdfEditor] Using font: ${candidate}`);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    "未找到可用的中文字体文件。请通过环境变量 CHINESE_FONT_PATH 指定字体路径，或将字体文件放到 data/fonts/ 目录。"
  );
}
export async function createEditedPdfVersions({ originalResumeFileUrl, text, changes = [], candidateName, outputMode = "auto", uploadDir = defaultUploadDir }) {
  const sourceName = getUploadFileName(originalResumeFileUrl);
  const sourcePath = join(uploadDir, sourceName);
  const lines = getResumeLines(text);
  if (!lines.length) throw new Error("成品文字不能为空。");
  const pendingChanges = getValidatedChanges(changes);
  const cleanOutputName = `${randomUUID()}.pdf`;
  const reviewOutputName = `${randomUUID()}.pdf`;
  const result = await runPyMuPdfEditor({
    source_path: sourcePath,
    clean_path: join(uploadDir, cleanOutputName),
    review_path: join(uploadDir, reviewOutputName),
    font_path: await findChineseFontPath(),
    changes: pendingChanges,
    optimized_text: text,
    candidate_name: typeof candidateName === "string" ? candidateName.trim().slice(0, 80) : "",
    force_generated: outputMode === "generated-template"
  });
  if (result.pageCountVerified !== true) {
    throw new Error("PDF 精修失败：成品页数未通过校验。");
  }
  return {
    cleanOutputName,
    reviewOutputName,
    changedLineCount: result.changedLineCount,
    appliedChanges: Array.isArray(result.appliedChanges) ? result.appliedChanges : [],
    unchangedPages: Array.isArray(result.unchangedPages) ? result.unchangedPages : [],
    pageCountVerified: true,
    deliveryMode: result.deliveryMode === "generated-template" ? "generated-template" : "source-template",
    portraitApplied: result.portraitApplied === true,
    portraitDataUrl: typeof result.portraitDataUrl === "string" ? result.portraitDataUrl : undefined
  };
}

export async function createEditedPdf(options) {
  const { cleanOutputName } = await createEditedPdfVersions(options);
  return cleanOutputName;
}

export async function createGeneratedResumePdf({ text, portraitDataUrl, candidateName, uploadDir = defaultUploadDir }) {
  const lines = getResumeLines(text);
  if (!lines.length) throw new Error("成品文字不能为空。");
  const cleanOutputName = `${randomUUID()}.pdf`;
  const reviewOutputName = `${randomUUID()}.pdf`;
  const reviewPath = join(uploadDir, reviewOutputName);
  try {
    const result = await runPyMuPdfEditor({
      force_generated: true,
      clean_path: join(uploadDir, cleanOutputName),
      review_path: reviewPath,
      font_path: await findChineseFontPath(),
      optimized_text: text,
      portrait_data_url: portraitDataUrl || "",
      candidate_name: typeof candidateName === "string" ? candidateName.trim().slice(0, 80) : ""
    });
    if (result.textVerified !== true) throw new Error("成品 PDF 文字校验失败。");
    return { cleanOutputName, portraitApplied: result.portraitApplied === true };
  } finally {
    await rm(reviewPath, { force: true });
  }
}

function getUploadFileName(fileUrl) {
  if (typeof fileUrl !== "string") throw new Error("缺少原 PDF 文件。");
  const match = fileUrl.match(/\/api\/resume-files\/([a-zA-Z0-9_-]+\.pdf)(?:$|\?)/i);
  if (!match) throw new Error("原 PDF 文件地址无效。");
  return match[1];
}

function getResumeLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\-•·]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeReviewText(value) {
  return String(value || "").replace(/\s+/g, "").replace(/^[•·\-]+/, "").replace(/[，。；：、,.!！?？]/g, "");
}

function getValidatedChanges(changes) {
  if (!Array.isArray(changes)) return [];
  return changes.slice(0, 200).flatMap((change) => {
    const before = typeof change?.before === "string" ? change.before.trim().slice(0, 2000) : "";
    const after = typeof change?.after === "string" ? change.after.trim().slice(0, 2000) : "";
    return before && after && normalizeReviewText(before) !== normalizeReviewText(after) ? [{ before, after }] : [];
  });
}

function runPyMuPdfEditor(payload) {
  const python = process.env.PYMUPDF_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = join(process.cwd(), "server", "vendor", "pymupdf_official_replace.py");
  const timeoutMs = Number(process.env.PYMUPDF_TIMEOUT_MS || 120_000);
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
      settle(() => reject(new Error("PDF 精修超时，请稍后重试或换一份简历。")));
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
      settle(() => reject(new Error(`PDF 精修组件提前退出：${error?.code || "stdin error"}`)));
    });
    child.on("error", () => settle(() => reject(new Error("PDF 精修组件未安装，请安装 requirements-pdf.txt 中的依赖。"))));
    child.on("close", (code) => {
      if (code !== 0) {
        settle(() => reject(new Error(`PDF 精修失败：${stderr.trim() || "PyMuPDF 进程异常退出"}`)));
        return;
      }
      try {
        settle(() => resolve(JSON.parse(stdout)));
      } catch {
        settle(() => reject(new Error("PDF 精修组件返回了无效结果。")));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
