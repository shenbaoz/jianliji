import { randomUUID } from "node:crypto";

const tableName = "resume_creator_profiles";
const versionTableName = "resume_creator_versions";
const visitorPattern = /^[a-zA-Z0-9_-]{8,80}$/;

export function createCreatorStore(db) {
  return {
    async ensureSchema() {
      await db.query(`
CREATE TABLE IF NOT EXISTS ${tableName} (
  id CHAR(36) PRIMARY KEY,
  anonymous_id VARCHAR(80) NOT NULL UNIQUE,
  profile_json JSON NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  INDEX idx_creator_profile_updated (anonymous_id, updated_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await db.query(`
CREATE TABLE IF NOT EXISTS ${versionTableName} (
  id CHAR(36) PRIMARY KEY,
  anonymous_id VARCHAR(80) NOT NULL,
  title VARCHAR(120) NOT NULL,
  profile_json JSON NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  INDEX idx_creator_version_created (anonymous_id, created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },

    async getProfile(anonymousId) {
      requireVisitorId(anonymousId);
      const [rows] = await db.query(`SELECT profile_json FROM ${tableName} WHERE anonymous_id = ? LIMIT 1`, [anonymousId]);
      return rows[0] ? decodeJson(rows[0].profile_json) : null;
    },

    async saveProfile(anonymousId, profile) {
      requireVisitorId(anonymousId);
      const now = new Date().toISOString();
      const normalized = profile && typeof profile === "object" ? profile : {};
      await db.query(
        `INSERT INTO ${tableName} (id, anonymous_id, profile_json, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE profile_json = VALUES(profile_json), updated_at = VALUES(updated_at)`,
        [randomUUID(), anonymousId, JSON.stringify(normalized), now, now]
      );
      return normalized;
    },

    async listVersions(anonymousId) {
      requireVisitorId(anonymousId);
      const [rows] = await db.query(
        `SELECT id, title, profile_json, created_at FROM ${versionTableName} WHERE anonymous_id = ? ORDER BY created_at DESC LIMIT 30`,
        [anonymousId]
      );
      return rows.map((row) => ({ id: row.id, title: row.title, profile: decodeJson(row.profile_json), createdAt: row.created_at }));
    },

    async saveVersion(anonymousId, version) {
      requireVisitorId(anonymousId);
      const now = new Date().toISOString();
      const title = typeof version?.title === "string" && version.title.trim() ? version.title.trim().slice(0, 120) : "未命名简历";
      const profile = version?.profile && typeof version.profile === "object" ? version.profile : {};
      const id = typeof version?.id === "string" && /^[a-zA-Z0-9-]{8,80}$/.test(version.id) ? version.id : randomUUID();
      await db.query(`INSERT INTO ${versionTableName} (id, anonymous_id, title, profile_json, created_at) VALUES (?, ?, ?, ?, ?)`, [id, anonymousId, title, JSON.stringify(profile), now]);
      return { id, title, profile, createdAt: now };
    }
  };
}

function requireVisitorId(value) {
  if (typeof value !== "string" || !visitorPattern.test(value)) throw new Error("Anonymous visitor id is required");
}

function decodeJson(value) {
  if (typeof value === "object" && value !== null) return value;
  try { return JSON.parse(value); } catch { return {}; }
}
