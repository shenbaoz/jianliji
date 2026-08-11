const tableName = "resume_versions";

export function createVersionStore(db) {
  return {
    async ensureSchema() {
      await db.query(`
CREATE TABLE IF NOT EXISTS ${tableName} (
  id VARCHAR(128) PRIMARY KEY,
  created_at VARCHAR(40) NOT NULL,
  candidate_name VARCHAR(255) NOT NULL,
  target_role VARCHAR(255) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  template_id VARCHAR(80) NOT NULL,
  resume_text MEDIUMTEXT NOT NULL,
  job_description MEDIUMTEXT NOT NULL,
  optimized_text MEDIUMTEXT NOT NULL,
  original_resume_html MEDIUMTEXT NULL,
  original_resume_file_name VARCHAR(255) NULL,
  original_resume_mime_type VARCHAR(255) NULL,
  original_resume_file_url TEXT NULL,
  visitor_id VARCHAR(80) NOT NULL DEFAULT 'legacy',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_visitor_created_at (visitor_id, created_at),
  INDEX idx_created_at (created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await ensureVisitorColumn(db);
      await ensureOriginalResumeColumns(db);
      await ensureVersionIdWidth(db);
    },

    async list(visitorId = "legacy") {
      const [rows] = await db.query(`
SELECT id, created_at, candidate_name, target_role, score, template_id, resume_text, job_description, optimized_text, original_resume_html, original_resume_file_name, original_resume_mime_type, original_resume_file_url
FROM ${tableName}
WHERE visitor_id = ?
ORDER BY created_at DESC
LIMIT 20`, [visitorId]);
      return rows.map(fromRow);
    },

    async listAll(limit = 1000) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000));
      const [rows] = await db.query(`
SELECT id, created_at, candidate_name, target_role, score, template_id, resume_text, job_description, optimized_text, original_resume_html, original_resume_file_name, original_resume_mime_type, original_resume_file_url, visitor_id
FROM ${tableName}
ORDER BY created_at DESC
LIMIT ?`, [safeLimit]);
      return rows.map(fromAdminRow);
    },

    async save(version, visitorId = "legacy") {
      const normalized = normalizeVersion(version);
      await db.query(
        `INSERT INTO ${tableName}
(id, created_at, candidate_name, target_role, score, template_id, resume_text, job_description, optimized_text, original_resume_html, original_resume_file_name, original_resume_mime_type, original_resume_file_url, visitor_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
created_at = VALUES(created_at),
candidate_name = VALUES(candidate_name),
target_role = VALUES(target_role),
score = VALUES(score),
template_id = VALUES(template_id),
resume_text = VALUES(resume_text),
job_description = VALUES(job_description),
optimized_text = VALUES(optimized_text),
original_resume_html = VALUES(original_resume_html),
original_resume_file_name = VALUES(original_resume_file_name),
original_resume_mime_type = VALUES(original_resume_mime_type),
original_resume_file_url = VALUES(original_resume_file_url),
visitor_id = VALUES(visitor_id)`,
        [
          versionKey(visitorId, normalized.id),
          normalized.createdAt,
          normalized.candidateName,
          normalized.targetRole,
          normalized.score,
          normalized.templateId,
          normalized.resumeText,
          normalized.jobDescription,
          normalized.optimizedText,
          normalized.originalResumeHtml,
          normalized.originalResumeFileName,
          normalized.originalResumeMimeType,
          normalized.originalResumeFileUrl,
          visitorId
        ]
      );
      await db.query(
        `DELETE FROM ${tableName}
WHERE visitor_id = ?
  AND id NOT IN (
    SELECT id FROM (
      SELECT id FROM ${tableName}
      WHERE visitor_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    ) AS recent_versions
  )`,
        [visitorId, visitorId]
      );
      return normalized;
    },

    async delete(id, visitorId = "legacy") {
      await db.query(`DELETE FROM ${tableName} WHERE id = ? AND visitor_id = ?`, [versionKey(visitorId, id), visitorId]);
    },

    async deleteAny(id) {
      await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    },

    async deleteAll(visitorId) {
      await db.query(`DELETE FROM ${tableName} WHERE visitor_id = ?`, [visitorId]);
    }
  };
}

async function ensureVisitorColumn(db) {
  try {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN visitor_id VARCHAR(80) NOT NULL DEFAULT 'legacy'`);
  } catch (error) {
    if (!String(error?.message || "").includes("Duplicate column name")) throw error;
  }

  try {
    await db.query(`ALTER TABLE ${tableName} ADD INDEX idx_visitor_created_at (visitor_id, created_at)`);
  } catch (error) {
    if (!String(error?.message || "").includes("Duplicate key name")) throw error;
  }
}

async function ensureOriginalResumeColumns(db) {
  const columns = [
    ["original_resume_html", "MEDIUMTEXT NULL"],
    ["original_resume_file_name", "VARCHAR(255) NULL"],
    ["original_resume_mime_type", "VARCHAR(255) NULL"],
    ["original_resume_file_url", "TEXT NULL"]
  ];

  for (const [name, definition] of columns) {
    try {
      await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${definition}`);
    } catch (error) {
      if (!String(error?.message || "").includes("Duplicate column name")) throw error;
    }
  }
}

async function ensureVersionIdWidth(db) {
  await db.query(`ALTER TABLE ${tableName} MODIFY COLUMN id VARCHAR(128) NOT NULL`);
}

function normalizeVersion(version) {
  if (!version || typeof version !== "object") {
    throw new Error("Version payload is required");
  }

  return {
    id: asText(version.id, "id"),
    createdAt: asText(version.createdAt, "createdAt"),
    candidateName: asText(version.candidateName, "candidateName"),
    targetRole: asText(version.targetRole, "targetRole"),
    score: Number.isFinite(Number(version.score)) ? Number(version.score) : 0,
    templateId: asText(version.templateId, "templateId"),
    resumeText: asText(version.resumeText, "resumeText"),
    jobDescription: asText(version.jobDescription, "jobDescription"),
    optimizedText: asText(version.optimizedText, "optimizedText"),
    originalResumeHtml: optionalText(version.originalResumeHtml),
    originalResumeFileName: optionalText(version.originalResumeFileName),
    originalResumeMimeType: optionalText(version.originalResumeMimeType),
    originalResumeFileUrl: optionalText(version.originalResumeFileUrl)
  };
}

function asText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function fromRow(row) {
  return {
    id: publicId(row.id),
    createdAt: row.created_at,
    candidateName: row.candidate_name,
    targetRole: row.target_role,
    score: Number(row.score),
    templateId: row.template_id,
    resumeText: row.resume_text,
    jobDescription: row.job_description,
    optimizedText: row.optimized_text,
    originalResumeHtml: row.original_resume_html || undefined,
    originalResumeFileName: row.original_resume_file_name || undefined,
    originalResumeMimeType: row.original_resume_mime_type || undefined,
    originalResumeFileUrl: row.original_resume_file_url || undefined
  };
}

function fromAdminRow(row) {
  return {
    ...fromRow(row),
    id: row.id,
    visitorId: row.visitor_id
  };
}

function versionKey(visitorId, id) {
  return `${visitorId}:${id}`;
}

function publicId(id) {
  const separator = id.indexOf(":");
  return separator >= 0 ? id.slice(separator + 1) : id;
}
