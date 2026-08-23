import { summarize } from "./usageEventStore.mjs";

const tableName = "resume_usage_events";

export function createMysqlUsageEventStore(db) {
  return {
    async ensureSchema() {
      await db.query(`
CREATE TABLE IF NOT EXISTS ${tableName} (
  id CHAR(36) PRIMARY KEY,
  visitor_id VARCHAR(80) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  candidate_name VARCHAR(255) NOT NULL DEFAULT '',
  target_role VARCHAR(255) NOT NULL DEFAULT '',
  school VARCHAR(255) NOT NULL DEFAULT '',
  major VARCHAR(255) NOT NULL DEFAULT '',
  degree VARCHAR(255) NOT NULL DEFAULT '',
  INDEX idx_usage_type_visitor (event_type, visitor_id),
  INDEX idx_usage_created_at (created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      for (const column of ["candidate_name", "target_role", "school", "major", "degree"]) {
        const [existing] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [column]);
        if (existing.length === 0) {
          await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${column} VARCHAR(255) NOT NULL DEFAULT ''`);
        }
      }
    },

    async record({ visitorId, eventType, candidateName = "", targetRole = "", school = "", major = "", degree = "" }) {
      await db.query(
        `INSERT INTO ${tableName} (id, visitor_id, event_type, created_at, candidate_name, target_role, school, major, degree) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
        [visitorId, eventType, new Date().toISOString(), candidateName, targetRole, school, major, degree]
      );
    },

    async getStats() {
      const [rows] = await db.query(`SELECT id, visitor_id AS visitorId, event_type AS eventType, created_at AS createdAt, candidate_name AS candidateName, target_role AS targetRole, school, major, degree FROM ${tableName} ORDER BY created_at DESC LIMIT 500`);
      return summarize(deduplicateRows(rows));
    }
  };
}

function deduplicateRows(rows) {
  const kept = [];
  for (const row of rows) {
    const duplicate = kept.some((item) => item.eventType === row.eventType
      && ["candidateName", "targetRole", "school", "major", "degree"].every((key) => (item[key] || "") === (row[key] || ""))
      && Math.abs(Date.parse(item.createdAt) - Date.parse(row.createdAt)) <= 10 * 60 * 1000);
    if (!duplicate) kept.push(row);
  }
  return kept;
}
