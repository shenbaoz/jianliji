import { normalizeLead } from "./interestLead.mjs";

const tableName = "unlock_interests";

export function createMysqlInterestStore(db) {
  return {
    async ensureSchema() {
      await db.query(`
CREATE TABLE IF NOT EXISTS ${tableName} (
  id VARCHAR(64) PRIMARY KEY,
  created_at VARCHAR(40) NOT NULL,
  source VARCHAR(40) NOT NULL,
  candidate_name VARCHAR(255) NOT NULL,
  target_role VARCHAR(255) NOT NULL,
  plan_id VARCHAR(80) NOT NULL,
  contact VARCHAR(255) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_plan_id (plan_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },

    async list() {
      const [rows] = await db.query(`
SELECT id, created_at, source, candidate_name, target_role, plan_id, contact, note
FROM ${tableName}
ORDER BY created_at DESC
LIMIT 50`);
      return rows.map(fromRow);
    },

    async save(lead) {
      const normalized = normalizeLead(lead);
      await db.query(
        `INSERT INTO ${tableName}
(id, created_at, source, candidate_name, target_role, plan_id, contact, note)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
created_at = VALUES(created_at),
source = VALUES(source),
candidate_name = VALUES(candidate_name),
target_role = VALUES(target_role),
plan_id = VALUES(plan_id),
contact = VALUES(contact),
note = VALUES(note)`,
        [
          normalized.id,
          normalized.createdAt,
          normalized.source,
          normalized.candidateName,
          normalized.targetRole,
          normalized.planId,
          normalized.contact,
          normalized.note
        ]
      );
      await pruneToNewestFifty();
      return normalized;
    },

    async delete(id) {
      await db.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    }
  };

  // 与文件版保持一致:只保留最新的 50 条。
  async function pruneToNewestFifty() {
    await db.query(
      `DELETE FROM ${tableName}
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id FROM ${tableName} ORDER BY created_at DESC, id DESC LIMIT 50
  ) AS keep_ids
)`
    );
  }
}

function fromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    candidateName: row.candidate_name,
    targetRole: row.target_role,
    planId: row.plan_id,
    contact: row.contact,
    note: row.note
  };
}
