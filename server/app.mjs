import express from "express";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { createEditedPdfVersions } from "./pdfEditor.mjs";
import { detectResumeFileType, parseResumeFile, ResumeParseError } from "./resumeParser.mjs";

const resumeUploadLimitBytes = 10 * 1024 * 1024;
const resumeUploadLimitMessage = "文件过大，请上传 10MB 以内的 PDF、DOCX 或 TXT 简历。";
const defaultUploadDir = resolve("data", "uploads");

export function createApp(versionStore, interestStore = null, storageStatus = null, creatorStore = null, aiClient = null, options = {}) {
  const app = express();
  const adminSessions = new Map();
  const adminSessionTtlMs = 8 * 60 * 60 * 1000;
  const healthCheck = typeof options.healthCheck === "function" ? options.healthCheck : null;
  const uploadDir = options.uploadDir || defaultUploadDir;
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
    if (req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }
    if (process.env.NODE_ENV === "production" && (req.secure || req.get("X-Forwarded-Proto") === "https")) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: resumeUploadLimitBytes, files: 1, fields: 20, parts: 30 }
  });

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "请求过于频繁，请稍后重试。" }
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "上传请求过于频繁，请稍后重试。" }
  });

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI 优化请求过于频繁，请稍后再试。" }
  });

  const pdfEditLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "PDF 编辑请求过于频繁，请稍后重试。" }
  });

  const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "登录尝试过于频繁，请 15 分钟后再试。" }
  });

  const interestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "提交过于频繁，请稍后重试。" }
  });

  app.use(generalLimiter);

  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:5173,http://127.0.0.1:5174")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const requestOrigin = req.get("Origin");
    res.setHeader("Access-Control-Allow-Origin", requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0]);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Visitor-Id");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const healthy = healthCheck ? await healthCheck() : true;
      res.status(healthy ? 200 : 503).json({ ok: healthy });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.post("/api/ai/optimize", aiLimiter, async (req, res, next) => {
    try {
      if (!aiClient) {
        res.status(503).json({ error: "AI 优化尚未配置。请由管理员在服务器设置 DEEPSEEK_API_KEY。" });
        return;
      }
      const { resumeText, targetRole, jobDescription = "", evidenceAnswers = [], sourceMode = "resume" } = req.body || {};
      const isUniversal = sourceMode === "universal";
      const normalizedTargetRole = typeof targetRole === "string" && targetRole.trim() ? targetRole.trim() : "通用求职版";
      if (
        typeof resumeText !== "string" || !resumeText.trim() ||
        (!isUniversal && (
          typeof jobDescription !== "string"
        ))
      ) {
        res.status(400).json({ error: "请补齐简历内容和求职方向。" });
        return;
      }
      const safeEvidenceAnswers = Array.isArray(evidenceAnswers) ? evidenceAnswers.filter((item) => typeof item === "string").slice(0, 20) : [];
      if (
        resumeText.length > 100_000 ||
        (typeof targetRole === "string" && targetRole.length > 200) ||
        (typeof jobDescription === "string" && jobDescription.length > 40_000) ||
        safeEvidenceAnswers.some((item) => item.length > 5_000)
      ) {
        res.status(413).json({ error: "提交内容过长，请精简简历、岗位描述或补充证据后重试。" });
        return;
      }
      const result = isUniversal && typeof aiClient.optimizeUniversal === "function"
        ? await aiClient.optimizeUniversal({ resumeText })
        : await aiClient.optimize({ resumeText, targetRole: normalizedTargetRole, jobDescription, evidenceAnswers: safeEvidenceAnswers, sourceMode: isUniversal ? "universal" : (sourceMode === "creator" ? "creator" : "resume"), skippedFollowUp: req.body?.skippedFollowUp === true });
      const text = typeof result?.text === "string"
        ? result.text
          .replace(/\{\{(?:PHONE|EMAIL)_\d+\}\}/g, "")
          .split(/\r?\n/)
          .filter((line) => !/^(?:(?:联系方式|电话|手机|邮箱)\s*[:：]?)?[\s|｜·/,，-]*$/.test(line))
          .join("\n")
          .trim()
        : result?.text;
      res.json({ ...result, text });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/session", (req, res) => {
    if (!isAdmin(req, adminSessions)) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    res.status(204).end();
  });

  app.post("/api/admin/session", adminLoginLimiter, (req, res) => {
    const configuredPassword = process.env.ADMIN_PASSWORD;
    const suppliedPassword = typeof req.body?.password === "string" ? req.body.password : "";
    if (!configuredPassword) {
      console.error("[admin auth] ADMIN_PASSWORD is not configured");
      res.status(503).json({ error: "管理台暂不可用，请联系网站管理员完成配置。" });
      return;
    }
    if (!safePasswordEqual(suppliedPassword, configuredPassword)) {
      res.status(401).json({ error: "密码不正确。" });
      return;
    }
    const token = randomUUID();
    adminSessions.set(token, Date.now() + adminSessionTtlMs);
    res.cookie("resume_admin_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure || req.get("X-Forwarded-Proto") === "https",
      path: adminCookiePath(),
      maxAge: adminSessionTtlMs
    });
    res.status(204).end();
  });

  app.delete("/api/admin/session", (req, res) => {
    const token = readCookie(req, "resume_admin_session");
    if (token) adminSessions.delete(token);
    res.clearCookie("resume_admin_session", { path: adminCookiePath() });
    res.status(204).end();
  });

  app.get("/api/admin/versions", requireAdmin(adminSessions), async (_req, res, next) => {
    try {
      res.json(await versionStore.listAll());
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/versions/:id", requireAdmin(adminSessions), async (req, res, next) => {
    try {
      const before = await versionStore.listAll();
      const removed = before.filter((item) => item.id === req.params.id);
      await versionStore.deleteAny(req.params.id);
      await deleteUnreferencedStoredFiles(uploadDir, removed, await versionStore.listAll());
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/parse-resume", uploadLimiter, upload.single("resume"), async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "请上传简历文件（PDF、DOCX 或 TXT）。" });
        return;
      }
      const parsed = await parseResumeFile(req.file);
      const detectedType = await detectResumeFileType(req.file.buffer);
      const savedFile = await saveUploadedResumeFile(req.file, uploadDir, getVisitorId(req), detectedType);
      res.json({
        ...parsed,
        originalResumeFileName: req.file.originalname,
        originalResumeMimeType: savedFile.mimeType,
        originalResumeFileUrl: storedFileUrl(savedFile.name, savedFile.token)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/resume-files/:name", async (req, res, next) => {
    try {
      if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(req.params.name)) {
        res.status(404).end();
        return;
      }
      const metadata = await authorizeStoredFile(uploadDir, req.params.name, req.query.token);
      if (!metadata) {
        res.status(404).end();
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", metadata.mimeType);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(metadata.originalName || req.params.name)}`);
      res.sendFile(join(uploadDir, req.params.name));
    } catch (error) {
      if (error?.code === "ENOENT") {
        res.status(404).end();
        return;
      }
      next(error);
    }
  });

  app.post("/api/edit-pdf", pdfEditLimiter, async (req, res, next) => {
    try {
      const source = parseStoredFileUrl(req.body?.originalResumeFileUrl);
      const sourceMetadata = source ? await authorizeStoredFile(uploadDir, source.name, source.token) : null;
      if (!sourceMetadata || sourceMetadata.fileType !== "pdf") {
        res.status(404).json({ error: "原 PDF 已失效，请重新上传简历。" });
        return;
      }
      const { cleanOutputName, reviewOutputName, changedLineCount, appliedChanges } = await createEditedPdfVersions({ ...(req.body || {}), uploadDir });
      const cleanMetadata = await registerStoredFile(uploadDir, cleanOutputName, {
        owner: sourceMetadata.owner,
        fileType: "pdf",
        mimeType: "application/pdf",
        originalName: `优化-${sourceMetadata.originalName || "resume.pdf"}`
      });
      const reviewMetadata = await registerStoredFile(uploadDir, reviewOutputName, {
        owner: sourceMetadata.owner,
        fileType: "pdf",
        mimeType: "application/pdf",
        originalName: `校对-${sourceMetadata.originalName || "resume.pdf"}`
      });
      res.json({
        fileUrl: storedFileUrl(cleanOutputName, cleanMetadata.token),
        reviewFileUrl: storedFileUrl(reviewOutputName, reviewMetadata.token),
        changedLineCount,
        appliedChanges
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/versions", async (req, res, next) => {
    try {
      res.json(await versionStore.list(getVisitorId(req)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/versions", async (req, res, next) => {
    try {
      res.status(201).json(await versionStore.save(req.body, getVisitorId(req)));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/versions/:id", async (req, res, next) => {
    try {
      const visitorId = getVisitorId(req);
      const before = await versionStore.list(visitorId);
      const removed = before.filter((item) => item.id === req.params.id);
      await versionStore.delete(req.params.id, visitorId);
      await deleteUnreferencedStoredFiles(uploadDir, removed, await versionStore.list(visitorId));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/versions", async (req, res, next) => {
    try {
      const visitorId = getVisitorId(req);
      const removed = await versionStore.list(visitorId);
      await versionStore.deleteAll(visitorId);
      const retained = typeof versionStore.listAll === "function" ? await versionStore.listAll() : [];
      await deleteUnreferencedStoredFiles(uploadDir, removed, retained);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  if (creatorStore) {
    app.get("/api/creator/profile", async (req, res, next) => {
      try {
        const profile = await creatorStore.getProfile(getVisitorId(req));
        if (!profile) {
          res.status(404).json({ error: "尚无创建中的简历。" });
          return;
        }
        res.json(profile);
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/creator/profile", async (req, res, next) => {
      try {
        res.status(201).json(await creatorStore.saveProfile(getVisitorId(req), req.body || {}));
      } catch (error) {
        next(error);
      }
    });

    app.get("/api/creator/versions", async (req, res, next) => {
      try {
        res.json(await creatorStore.listVersions(getVisitorId(req)));
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/creator/versions", async (req, res, next) => {
      try {
        res.status(201).json(await creatorStore.saveVersion(getVisitorId(req), req.body || {}));
      } catch (error) {
        next(error);
      }
    });
  }

  if (interestStore) {
    app.get("/api/interest", requireAdmin(adminSessions), async (_req, res, next) => {
      try {
        res.json(await interestStore.list());
      } catch (error) {
        next(error);
      }
    });

    app.post("/api/interest", interestLimiter, async (req, res, next) => {
      try {
        res.status(201).json(await interestStore.save(req.body));
      } catch (error) {
        next(error);
      }
    });

    app.delete("/api/interest/:id", requireAdmin(adminSessions), async (req, res, next) => {
      try {
        await interestStore.delete(req.params.id);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    });
  }

  const distPath = resolve("dist");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use("/resume-fit", express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      if (req.path !== "/" && !req.path.startsWith("/resume-fit")) {
        next();
        return;
      }
      res.sendFile(join(distPath, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: resumeUploadLimitMessage });
      return;
    }
    if (error && error.type === "entity.too.large") {
      res.status(413).json({ error: "请求体过大。" });
      return;
    }
    if (error instanceof ResumeParseError) {
      res.status(422).json({ error: error.message });
      return;
    }
    console.error("[server error]", error);
    res.status(500).json({ error: "服务器内部错误，请稍后重试。" });
  });

  return app;
}

function requireAdmin(sessions) {
  return (req, res, next) => {
    if (!isAdmin(req, sessions)) {
      res.status(401).json({ error: "需要管理员登录。" });
      return;
    }
    next();
  };
}

function isAdmin(req, sessions) {
  const token = readCookie(req, "resume_admin_session");
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessions.get(token)) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function readCookie(req, name) {
  const header = req.get("Cookie") || "";
  const item = header.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

function safePasswordEqual(supplied, expected) {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function adminCookiePath() {
  return "/";
}

async function saveUploadedResumeFile(file, uploadDir, owner, fileType) {
  const extensions = { pdf: ".pdf", docx: ".docx", txt: ".txt" };
  const mimeTypes = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain; charset=utf-8"
  };
  const extension = extensions[fileType];
  if (!extension) throw new ResumeParseError("无法确认真实文件类型，请上传 PDF、DOCX 或 TXT 简历。");
  const savedName = `${randomUUID()}${extension}`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, savedName), file.buffer);
  const metadata = await registerStoredFile(uploadDir, savedName, {
    owner,
    fileType,
    mimeType: mimeTypes[fileType],
    originalName: typeof file?.originalname === "string" ? file.originalname : savedName
  });
  return { name: savedName, ...metadata };
}

async function registerStoredFile(uploadDir, name, metadata) {
  const maxAgeHours = Math.max(1, Number(process.env.UPLOAD_MAX_AGE_HOURS) || 24);
  const stored = {
    ...metadata,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + maxAgeHours * 60 * 60 * 1000).toISOString()
  };
  await writeFile(join(uploadDir, `${name}.meta.json`), JSON.stringify(stored), "utf8");
  return stored;
}

async function authorizeStoredFile(uploadDir, name, token) {
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/i.test(token)) return null;
  const metadata = JSON.parse(await readFile(join(uploadDir, `${name}.meta.json`), "utf8"));
  if (metadata.token !== token || Date.parse(metadata.expiresAt) <= Date.now()) return null;
  return metadata;
}

function storedFileUrl(name, token) {
  return `/api/resume-files/${name}?token=${encodeURIComponent(token)}`;
}

function parseStoredFileUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, "http://resume.local");
    const match = url.pathname.match(/^\/api\/resume-files\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)$/);
    return match ? { name: match[1], token: url.searchParams.get("token") || "" } : null;
  } catch {
    return null;
  }
}

async function deleteUnreferencedStoredFiles(uploadDir, removedVersions, retainedVersions) {
  const retainedNames = new Set(
    retainedVersions
      .map((version) => parseStoredFileUrl(version.originalResumeFileUrl)?.name)
      .filter(Boolean)
  );
  const removedNames = new Set(
    removedVersions
      .map((version) => parseStoredFileUrl(version.originalResumeFileUrl)?.name)
      .filter((name) => name && !retainedNames.has(name))
  );
  await Promise.all(
    [...removedNames].flatMap((name) => [
      rm(join(uploadDir, name), { force: true }),
      rm(join(uploadDir, `${name}.meta.json`), { force: true })
    ])
  );
}

function getVisitorId(req) {
  const visitorId = req.get("X-Visitor-Id");
  if (typeof visitorId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(visitorId)) {
    throw new Error("Visitor id is required");
  }
  return visitorId;
}
