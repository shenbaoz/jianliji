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
  INDEX idx_usage_type_visitor (event_type, visitor_id),
  INDEX idx_usage_created_at (created_at)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },

    async record({ visitorId, eventType }) {
      await db.query(
        `INSERT INTO ${tableName} (id, visitor_id, event_type, created_at) VALUES (UUID(), ?, ?, ?)`,
        [visitorId, eventType, new Date().toISOString()]
      );
    },

    async getStats() {
      const [rows] = await db.query(`SELECT visitor_id AS visitorId, event_type AS eventType FROM ${tableName}`);
      return summarize(rows);
    }
  };
}
