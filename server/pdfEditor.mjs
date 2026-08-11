import { access } from "node:fs/promises";
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
export async function createEditedPdfVersions({ originalResumeFileUrl, text, changes = [], uploadDir = defaultUploadDir }) {
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
    changes: pendingChanges
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
    pageCountVerified: true
  };
}

export async function createEditedPdf(options) {
  const { cleanOutputName } = await createEditedPdfVersions(options);
  return cleanOutputName;
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

export function groupPdfTextItemsIntoLines(items) {
  const rows = [];
  items
    .map((item) => {
      if (!item?.str?.trim()) return null;
      const [, , , fontHeight, x, y] = item.transform;
      return {
        text: item.str,
        x,
        y,
        width: typeof item.width === "number" ? item.width : item.str.length * Math.abs(fontHeight) * 0.6,
        fontHeight: Math.max(Math.abs(fontHeight) || 8, 7)
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .forEach((item) => {
      const row = rows.find((current) => Math.abs(current[0].y - item.y) < Math.max(4, item.fontHeight * 0.45));
      if (row) row.push(item);
      else rows.push([item]);
    });

  return rows.map((row) => {
    const sorted = row.slice().sort((left, right) => left.x - right.x);
    const first = sorted[0];
    const right = Math.max(...sorted.map((item) => item.x + item.width));
    return {
      text: sorted.map((item) => item.text).join(" ").trim(),
      x: first.x,
      y: Math.min(...sorted.map((item) => item.y)),
      width: right - first.x,
      fontHeight: Math.max(...sorted.map((item) => item.fontHeight))
    };
  });
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
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => reject(new Error("PDF 精修组件未安装，请安装 requirements-pdf.txt 中的依赖。")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`PDF 精修失败：${stderr.trim() || "PyMuPDF 进程异常退出"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("PDF 精修组件返回了无效结果。"));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
