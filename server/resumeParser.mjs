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
  if (isGarbledText(normalized)) {
    throw new ResumeParseError("未能正确识别该 PDF 的文字（可能是字体编码异常），请重新导出为文本型 PDF、上传 DOCX 或直接粘贴简历文字继续。");
  }

  const candidateName = extractCandidateName(normalized) || undefined;
  return { filename, text: normalized, candidateName, basicInfo: extractBasicInfo(normalized, candidateName) };
}

// 从解析文本中提取基础信息（姓名/电话/邮箱/学校/专业/学历），
// 让前端上传简历后自动预填，用户只需确认或修改，无需从零填写。
export function extractBasicInfo(text, providedName) {
  const source = String(text || "");
  const name = providedName || extractCandidateName(source);
  // 兼容 "15244614693" 与 "152-4461-4693" / "152 4461 4693" 两种常见格式（3-4-4 分段）
  const cnPhone = (source.match(/(?<!\d)1[3-9]\d[- ]?\d{4}[- ]?\d{4}(?!\d)/) || [])[0] || "";
  // 国际电话兜底："+90 552 219 01 50" / "+91-8920581205"（清洗分隔符后统一为 + 前缀纯数字）
  const intlPhone = cnPhone ? "" : (source.match(/(?<![+\d])\+\d{1,3}(?:[\s-]?\d{2,4}){2,6}(?!\d)/) || [])[0] || "";
  const phone = (cnPhone || intlPhone).replace(/[\s-]/g, "");
  const email = (source.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i) || [])[0] || "";
  const eduSection = extractEducationSection(source);
  const school = extractSchoolName(eduSection || source);
  const major = extractMajor(eduSection || source);
  const degree = extractDegree(source);
  const basic = {
    name: name || "",
    phone,
    email,
    school,
    major,
    degree
  };
  return Object.values(basic).some(Boolean) ? basic : undefined;
}

function extractEducationSection(text) {
  const lines = String(text || "").split(/\n+/);
  const headingIndex = lines.findIndex((line) => /^(?:教育背景|教育经历|教育信息|EDUCATION(?:\s+HISTORY)?)$/i.test(line.trim()));
  if (headingIndex < 0) return "";
  const section = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^(?:工作经历|实习经历|项目经历|校园经历|技能|专业技能|证书|荣誉|自我评价|求职意向|求职目标)[:：]?$/.test(line)) break;
    section.push(line);
    if (section.length >= 4) break;
  }
  return section.join("\n");
}

function extractSchoolName(text) {
  const source = String(text || "");
  const candidates = source.match(/[\u4e00-\u9fff]{2,12}(?:大学|学院|学校)/g) || [];
  for (const candidate of candidates) {
    if (!/(公司|集团|研究院|培训|机构|学校简介)/.test(candidate)) return candidate;
  }
  // 英文大学名（如 "Vellore Institute of Technology"、"University of Toronto"、"Boğaziçi University"）
  // 使用 Unicode 字母类 \p{L} 支持带变音符号的拉丁字符（土耳其语 ğ/ç/ı 等），
  // 否则 "Boğaziçi University" 这类校名会因字符超出 [A-Za-z] 范围而漏匹配。
  const enCandidates = source.match(/\p{Lu}[\p{L}&.'\- ]{2,40}?(?:University|Institute of Technology|Institute|College|Academy)/gu) || [];
  for (const candidate of enCandidates) {
    const school = candidate.replace(/[\s,，]+$/, "").trim();
    if (school.length >= 3 && !/(?:Training|Language)/i.test(school)) return school;
  }
  return "";
}

function extractMajor(text) {
  const source = String(text || "");
  // 注意：冒号必填，否则会误匹配"专业技能："中的"专业"+"技能"
  const labeled = source.match(/(?:专业|主修)[:：]\s*([\u4e00-\u9fffA-Za-z]{2,30})/);
  if (labeled) return labeled[1].trim();
  // "XX专业" 仅匹配独立行（行内容就是专业名），避免把"上海物理学专业（射电天文方向）直博研究生"这类
  // 简介句误判为专业（匹配出"上海物理学"）
  const unlabeled = source.match(/^([\u4e00-\u9fffA-Za-z]{2,8}专业)[:：]?$/m);
  if (unlabeled) return unlabeled[1].replace(/专业$/, "");
  // 教育行紧凑格式："某某大学 数字媒体技术 本科" → 去掉学校、学院与学历后的中间词。
  // 学校与专业/学历可能分居两行（如 "上海交通大学\n物理学 博士"），取学校行及紧随其后的
  // 非日期、非成绩行拼接处理（日期行如 "2021.09—2024.06（预计）"、成绩行如 "GPA: 5/5 · Rank: 0%"
  // 或 "专业前20%" 会被跳过或清理，避免 "GPARank" 这类残留污染专业名）。
  const eduLines = source.split(/\n+/);
  const schoolIdx = eduLines.findIndex((line) => /(?:大学|学院)/.test(line));
  let compactSrc = "";
  if (schoolIdx >= 0) {
    compactSrc = eduLines[schoolIdx];
    let j = schoolIdx + 1;
    while (j < eduLines.length && /^\s*\d{4}\s*[./年]/.test(eduLines[j])) j++;
    while (j < eduLines.length && /\b(?:GPA|CGPA|Rank|排名|成绩|绩点)\b/i.test(eduLines[j])) j++;
    if (j < eduLines.length) compactSrc += " " + eduLines[j];
  }
  if (compactSrc) {
    const cleaned = compactSrc
      .replace(/[\u4e00-\u9fff]{2,12}(?:大学|学院)/, "")
      .replace(/(?:博士研究生|硕士研究生|本科|专科|大专|高中|博士|硕士|学士|研究生|学术型|专业型|预计|在读)/g, "")
      .replace(/[\u4e00-\u9fff]{2,10}学院/g, "")
      .replace(/专业前\d+%/, "")
      .replace(/\b(?:GPA|CGPA|Rank|排名|绩点)\b/gi, "")
      .replace(/[^\u4e00-\u9fffA-Za-z]/g, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 30) return cleaned;
  }
  // 英文专业："B.Tech - Computer Science and Engineering" / "B.S. in Computer Science" /
  // "Master of Science in Data Science" / "Diploma in Business Communications" /
  // "Bachelor of Science, Industrial Engineering"（真正专业在逗号后）。
  // 关键约束：
  //  1) 学位缩写加词边界：防止 "RBAC" 中间的 "BA"、"MSMQ" 中间的 "MS" 被误匹配；
  //  2) MS/MSc 后排除 SQL/Server/Office 等产品名上下文："MS SQL Server" 是技术栈不是学位；
  //  3) 学位后必须是 "of/in/major in"、分隔符或学位领域词（Science/Arts/Engineering…）之一，
  //     防止 "MS Office" 这类技术名词被当成 "MS + 专业"；
  //  4) 捕获组不含逗号：防止 "Science, Industrial Engineering" 贪心吞掉逗号后的列表；
  //  5) 学位领域词（Science/Arts/Engineering/Technology 等）是学位名的一部分，跳过并取其后的真实专业；
  //  6) 全正则 [ \t] 不跨换行，避免跨行吞入学校名。
  const enDegree = source.match(
    /\b(?:B\.?Tech|B\.?S\.?C?\.?|B\.?A\.?|M\.?S\.?C?\.?|M\.?Sc|M\.?A\.?|M\.?Eng|MBA|Ph\.?D|Diploma|Associate(?:'s)?|Bachelor(?:'s)?|Master(?:'s)?|Doctorate)\b(?!\s*(?:SQL|Server|Office|Access|Excel|Word|Project|Visio|Dynamics)\b)[ \t]*(?:(?:of|in|major(?:ing)? in)\b[ \t]+)?(?:Science|Arts|Engineering|Technology|Applied Science|Computer Science)?[ \t]*[-–—:：,]?[ \t]*(?:(?:in|of|major(?:ing)? in)\b)?[ \t]*([A-Z][A-Za-z& ]{2,40})/i
  );
  if (enDegree) {
    const enMajor = enDegree[1].trim();
    // 仅捕获到学位领域词本身（如 "Bachelor of Science" 后无逗号/无 in/of 引导的真实专业）视为无效，
    // 避免把 "Science" 当成专业。
    if (enMajor.length >= 3 && !/^(?:Science|Arts|Engineering|Technology)$/i.test(enMajor)) return enMajor;
  }
  return "";
}

function extractDegree(text) {
  // 英文学位缩写加词边界 + 排除 MS 产品名（SQL/Office/Excel…）：
  // 防止 "RBAC" 中的 "BA"（B\.?A 无边界）、"MS SQL" 中的 "MS" 被误匹配为学历。
  const match = String(text || "").match(/(?:博士研究生|硕士研究生|本科|专科|大专|高中|博士|硕士|学士|\b(?:B\.?Tech|B\.?S\.?C?\.?|B\.?A\.?|Bachelor(?:'s)?|M\.?S\.?C?\.?|M\.?Sc|M\.?A\.?|Master(?:'s)?|Ph\.?D|Doctorate|MBA|M\.?Eng|B\.?Eng|Diploma|Associate(?:'s)?)\b(?!\s*(?:SQL|Server|Office|Access|Excel|Word|Project|Visio|Dynamics)\b))/i);
  return match ? match[0] : "";
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
  return fixTwoColumnDateOrder(joined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 双栏布局日期错序修复：PDF 双栏（如 LaTeX 简历）常把"开始日期"放在组织名上方、"
// 结束日期"放在下方，文本提取后呈现为 "2018.08\n数据工程师@某公司\n2018.04"（开始>结束）。
// 识别该三行模式并按时间升序合并为一行，避免 AI 优化后出现"2018.08 - 2018.04"这类颠倒时间。
function fixTwoColumnDateOrder(lines) {
  const result = [...lines];
  for (let i = 0; i < result.length - 2; i++) {
    const d1 = result[i].trim();
    const mid = result[i + 1].trim();
    const d2 = result[i + 2].trim();
    if (!/^\d{4}[./年]\s*\d{1,2}$/.test(d1) || !/^\d{4}[./年]\s*\d{1,2}$/.test(d2)) continue;
    if (/\d/.test(mid) || /^\d{4}/.test(mid)) continue;
    const n1 = toMonthNumber(d1);
    const n2 = toMonthNumber(d2);
    if (n1 > n2) result.splice(i, 3, `${d2} - ${d1} ${mid}`);
  }
  return result;
}

function toMonthNumber(str) {
  const m = String(str).trim().match(/^(\d{4})[./年]\s*(\d{1,2})$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
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

// 常见简历段落标题——中文名提取时需排除，避免把"个人技能"这类标题误判为姓名
const resumeHeadingBlacklist = new Set([
  "个人技能", "专业技能", "技能清单", "职业技能", "教育背景", "教育经历", "教育信息",
  "工作经历", "实习经历", "项目经历", "项目经验", "校园经历", "证书荣誉", "荣誉奖项",
  "获奖情况", "自我评价", "个人评价", "求职意向", "求职目标", "联系方式", "基本信息",
  "兴趣爱好", "语言能力", "资格证书", "主修课程", "核心课程", "工作经验", "个人简介",
  "自我描述", "技能特长", "培训经历", "社会实践", "学生会经历", "社团经历", "发表论文",
  "科研成果", "项目实践", "校内实践", "实践经历", "个人总结", "在校经历", "个人经历"
]);

// 英文简历段落标题——拼音/英文姓名提取时排除
const enHeadingBlacklist = new Set([
  "EDUCATION", "EXPERIENCE", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE", "PROJECT EXPERIENCE",
  "PROJECTS", "SKILLS", "TECHNICAL SKILLS", "CORE COMPETENCIES", "CONTACT", "CONTACT INFORMATION",
  "SUMMARY", "PROFESSIONAL SUMMARY", "PERSONAL PROFILE", "OBJECTIVE", "CAREER OBJECTIVE", "LANGUAGES",
  "AWARDS", "CERTIFICATIONS", "INTERESTS", "REFERENCES", "LEADERSHIP EXPERIENCE", "RESEARCH EXPERIENCE",
  "ADDITIONAL INFORMATION", "PERSONAL INFORMATION", "PUBLICATIONS", "ACTIVITIES", "VOLUNTEER EXPERIENCE",
  "ACADEMIC BACKGROUND", "PROFESSIONAL PROFILE", "WORK HISTORY", "EMPLOYMENT HISTORY"
]);

// 英文职位头衔词：英文简历第一行常是职位（如 "Senior Data Scientist"），不得当姓名
const enJobTitlePattern = /(?:Scientist|Engineer|Developer|Programmer|Manager|Analyst|Architect|Consultant|Designer|Researcher|Specialist|Director|Administrator|Coordinator|Officer|Freelancer|Intern|Student|Teacher|Professor|Accountant|Marketer|Operator|Technician|Supervisor|Lead|Principal|Founder|Co-?Founder|CTO|CEO|COO|CFO|VP)/i;
// 简历标题词：文档第一行的 "Curriculum Vitae"/"CV"/"Resume" 只是标题
const enTitleBlacklist = /^(?:Curriculum Vitae|CV|Resume|Résumé|个人简历|求职简历|求职者|简历)$/i;
// 单个英文姓名词（支持带变音符号的拉丁字符，如土耳其语 Büyükkınacı 含 ü/ı）
const isEnNameWord = (s) => /^[\p{Lu}][\p{Ll}'\-]{1,20}$/u.test(s);

function extractCandidateName(text) {
  const source = String(text || "");
  const allLines = source.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const lines = allLines.slice(0, 8);
  const name = lines
    .map((line) => line.trim().replace(/^姓\s*名\s*[:：]\s*/, "").replace(/\s+/g, ""))
    .find((line) => /^[\u4e00-\u9fff·]{2,4}$/.test(line) && !resumeSectionHeading.test(line) && !resumeHeadingBlacklist.has(line) && !/^(个人简历|求职简历|求职者|姓名)$/.test(line)) || "";
  if (!name) {
    // 英文/拼音姓名（如 "CHEN SU" / "John Doe"）：仅取前 3 行，排除段落标题、简历标题、职位头衔
    const enName = lines
      .slice(0, 3)
      .map((line) => line.trim())
      .find((line) => /^[A-Z][A-Za-z]{1,20}(?:\s[A-Z][A-Za-z]{1,20}){1,3}$/.test(line)
        && !enHeadingBlacklist.has(line.toUpperCase())
        && !enTitleBlacklist.test(line)
        && !enJobTitlePattern.test(line)) || "";
    if (enName) return enName;
    // 双栏布局兜底：双栏 PDF 的文本顺序错乱，姓名/联系方式常被排到文档尾部，
    // 但其下方紧邻一行职位头衔（如 "Muhammed\nBüyükkınacı\nSenior Data Scientist"）。
    // 在全文档中找"职位头衔行"，取其前 1-2 行作为姓名。
    for (let i = 0; i < allLines.length; i++) {
      if (!enJobTitlePattern.test(allLines[i])) continue;
      const prev1 = allLines[i - 1] || "";
      const prev2 = allLines[i - 2] || "";
      const isCleanWord = (s) => isEnNameWord(s) && !enHeadingBlacklist.has(s.toUpperCase()) && !enTitleBlacklist.test(s) && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Current)\b/i.test(s);
      if (isCleanWord(prev1) && isCleanWord(prev2)) return `${prev2} ${prev1}`;
      if (isCleanWord(prev1) && !/^\d/.test(prev1)) return prev1;
    }
  }
  // 清洗"性别"错位粘连：PDF 两栏布局"姓名：杜小艳 | 性别：女"提取为"姓名：杜小艳性\n别：女"
  const nameLineIdx = lines.findIndex((line) => /姓\s*名/.test(line));
  if (/性$/.test(name) && nameLineIdx >= 0 && /^别\s*[:：]/.test(lines[nameLineIdx + 1] || "")) {
    return name.slice(0, -1);
  }
  return name;
}

// 乱码检测：部分 PDF 使用非标准字体编码，pymupdf/pdf-parse 提取出的文本为乱码符号。
// 以"可读字符（汉字 + 3 字符以上英文单词）"占比判断，过低则判定为乱码，避免污染后续 AI 优化。
function isGarbledText(text) {
  const source = String(text || "");
  if (source.length < 40) return false;
  const hanzi = (source.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishChars = (source.match(/[A-Za-z]{3,}/g) || []).reduce((sum, word) => sum + word.length, 0);
  const readable = hanzi + englishChars;
  return readable / source.length < 0.3;
}
