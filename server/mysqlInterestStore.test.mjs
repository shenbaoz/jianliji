import assert from "node:assert/strict";
import test from "node:test";
import { createMysqlInterestStore } from "./mysqlInterestStore.mjs";

function createDb() {
  const rows = [];
  const calls = [];

  return {
    calls,
    async query(sql, params = []) {
      const normalizedSql = sql.trim();
      calls.push({ sql: normalizedSql, params });

      if (normalizedSql.startsWith("CREATE TABLE")) {
        return [[], undefined];
      }

      if (normalizedSql.startsWith("SELECT")) {
        return [
          [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50),
          undefined
        ];
      }

      if (normalizedSql.startsWith("INSERT INTO unlock_interests")) {
        const [id, createdAt, source, candidateName, targetRole, planId, contact, note] = params;
        const next = {
          id,
          created_at: createdAt,
          source,
          candidate_name: candidateName,
          target_role: targetRole,
          plan_id: planId,
          contact,
          note
        };
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) rows[index] = next;
        else rows.push(next);
        return [{ affectedRows: 1 }, undefined];
      }

      if (normalizedSql.startsWith("DELETE FROM unlock_interests")) {
        const index = rows.findIndex((row) => row.id === params[0]);
        if (index >= 0) rows.splice(index, 1);
        return [{ affectedRows: index >= 0 ? 1 : 0 }, undefined];
      }

      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    }
  };
}

function lead(overrides = {}) {
  return {
    id: "lead-1",
    createdAt: "2026-07-21T07:00:00.000Z",
    source: "result",
    candidateName: "张三",
    targetRole: "前端工程师",
    planId: "jd-fit",
    contact: "wx: test-user",
    note: "想先试岗位定制版",
    ...overrides
  };
}

test("mysql interest store creates schema and lists newest leads first", async () => {
  const db = createDb();
  const store = createMysqlInterestStore(db);

  await store.ensureSchema();
  await store.save(lead({ id: "old", createdAt: "2026-07-21T06:00:00.000Z" }));
  await store.save(lead({ id: "new", createdAt: "2026-07-21T06:30:00.000Z", planId: "complete" }));

  const leads = await store.list();

  assert.match(db.calls[0].sql, /CREATE TABLE IF NOT EXISTS unlock_interests/);
  assert.deepEqual(leads.map((item) => item.id), ["new", "old"]);
  assert.equal(leads[0].planId, "complete");
});

test("mysql interest store updates existing leads and deletes by id", async () => {
  const db = createDb();
  const store = createMysqlInterestStore(db);

  await store.save(lead({ id: "same", planId: "jd-fit" }));
  await store.save(lead({ id: "same", planId: "complete", note: "更新备注" }));
  await store.save(lead({ id: "remove" }));
  await store.delete("remove");

  const leads = await store.list();

  assert.deepEqual(leads.map((item) => item.id), ["same"]);
  assert.equal(leads[0].planId, "complete");
  assert.equal(leads[0].note, "更新备注");
});

test("mysql interest store requires source and plan id", async () => {
  const store = createMysqlInterestStore(createDb());

  await assert.rejects(
    () => store.save(lead({ source: "", planId: "" })),
    /source and planId are required/
  );
});
