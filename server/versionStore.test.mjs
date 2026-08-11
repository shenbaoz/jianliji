import assert from "node:assert/strict";
import test from "node:test";
import { createVersionStore } from "./versionStore.mjs";

function createDb({ idColumnLength = 64 } = {}) {
  const rows = [];
  const calls = [];
  let maxVersionIdLength = idColumnLength;

  return {
    calls,
    async query(sql, params = []) {
      const normalizedSql = sql.trim();
      calls.push({ sql: normalizedSql, params });

      if (normalizedSql.startsWith("CREATE TABLE")) {
        return [[], undefined];
      }

      if (normalizedSql.startsWith("ALTER TABLE")) {
        const widthMatch = normalizedSql.match(/MODIFY COLUMN id VARCHAR\((\d+)\)/i);
        if (widthMatch) maxVersionIdLength = Number(widthMatch[1]);
        return [[], undefined];
      }

      if (normalizedSql.startsWith("SELECT")) {
        if (!normalizedSql.includes("WHERE visitor_id = ?")) {
          const limit = Number(params[0]) || 1000;
          return [[...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit), undefined];
        }
        const visitorId = params[0] || "legacy";
        return [
          [...rows]
            .filter((row) => row.visitor_id === visitorId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 20),
          undefined
        ];
      }

      if (normalizedSql.startsWith("INSERT INTO resume_versions")) {
        const [
          id,
          createdAt,
          candidateName,
          targetRole,
          score,
          templateId,
          resumeText,
          jobDescription,
          optimizedText,
          originalResumeHtml,
          originalResumeFileName,
          originalResumeMimeType,
          originalResumeFileUrl,
          visitorId = "legacy"
        ] = params;
        if (id.length > maxVersionIdLength) {
          throw new Error(`Data too long for column 'id' (maximum ${maxVersionIdLength})`);
        }
        const next = {
          id,
          created_at: createdAt,
          candidate_name: candidateName,
          target_role: targetRole,
          score,
          template_id: templateId,
          resume_text: resumeText,
          job_description: jobDescription,
          optimized_text: optimizedText,
          original_resume_html: originalResumeHtml,
          original_resume_file_name: originalResumeFileName,
          original_resume_mime_type: originalResumeMimeType,
          original_resume_file_url: originalResumeFileUrl,
          visitor_id: visitorId
        };
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) rows[index] = next;
        else rows.push(next);
        return [{ affectedRows: 1 }, undefined];
      }

      if (normalizedSql.startsWith("DELETE FROM resume_versions")) {
        if (normalizedSql.includes("NOT IN")) {
          const visitorId = params[0];
          const keep = new Set(
            rows
              .filter((row) => row.visitor_id === visitorId)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 20)
              .map((row) => row.id)
          );
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            if (rows[index].visitor_id === visitorId && !keep.has(rows[index].id)) rows.splice(index, 1);
          }
          return [{ affectedRows: 1 }, undefined];
        }
        if (normalizedSql.includes("WHERE id = ? AND visitor_id = ?")) {
          const visitorId = params[1] || "legacy";
          const index = rows.findIndex((row) => row.id === params[0] && row.visitor_id === visitorId);
          if (index >= 0) rows.splice(index, 1);
          return [{ affectedRows: index >= 0 ? 1 : 0 }, undefined];
        }
        if (normalizedSql.includes("WHERE visitor_id = ?")) {
          let affectedRows = 0;
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            if (rows[index].visitor_id === params[0]) {
              rows.splice(index, 1);
              affectedRows += 1;
            }
          }
          return [{ affectedRows }, undefined];
        }
        const index = rows.findIndex((row) => row.id === params[0]);
        if (index >= 0) rows.splice(index, 1);
        return [{ affectedRows: index >= 0 ? 1 : 0 }, undefined];
      }

      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    }
  };
}

function version(overrides = {}) {
  return {
    id: "version-1",
    createdAt: "2026-07-21T06:30:00.000Z",
    candidateName: "张三",
    targetRole: "前端工程师",
    score: 88,
    templateId: "classic",
    resumeText: "原始简历",
    jobDescription: "岗位 JD",
    optimizedText: "优化后简历",
    originalResumeHtml: undefined,
    originalResumeFileName: undefined,
    originalResumeMimeType: undefined,
    originalResumeFileUrl: undefined,
    ...overrides
  };
}

test("version store saves and lists versions using API field names", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  await store.ensureSchema();
  await store.save(version());
  const versions = await store.list();

  assert.equal(versions.length, 1);
  assert.deepEqual(versions[0], version());
  assert.match(db.calls[0].sql, /CREATE TABLE IF NOT EXISTS resume_versions/);
});

test("version store upgrades an existing 64-character key column before saving UUID-scoped versions", async () => {
  const db = createDb({ idColumnLength: 64 });
  const store = createVersionStore(db);
  const visitorId = "11111111-1111-1111-1111-111111111111";
  const versionId = "22222222-2222-2222-2222-222222222222";

  await store.ensureSchema();
  await store.save(version({ id: versionId }), visitorId);

  assert.deepEqual(await store.list(visitorId), [version({ id: versionId })]);
});

test("version store updates existing ids and returns newest versions first", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  await store.save(version({ id: "same", createdAt: "2026-07-21T06:00:00.000Z", score: 70 }));
  await store.save(version({ id: "same", createdAt: "2026-07-21T06:10:00.000Z", score: 92 }));
  await store.save(version({ id: "new", createdAt: "2026-07-21T06:20:00.000Z", score: 81 }));

  const versions = await store.list();

  assert.deepEqual(versions.map((item) => item.id), ["new", "same"]);
  assert.equal(versions.find((item) => item.id === "same").score, 92);
});

test("version store deletes a saved version", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  await store.save(version({ id: "keep" }));
  await store.save(version({ id: "remove" }));
  await store.delete("remove");

  const versions = await store.list();

  assert.deepEqual(versions.map((item) => item.id), ["keep"]);
});

test("version store isolates versions by visitor", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  await store.save(version({ id: "shared", createdAt: "2026-07-21T06:00:00.000Z" }), "visitor-a");
  await store.save(version({ id: "shared", createdAt: "2026-07-21T06:10:00.000Z" }), "visitor-b");
  await store.save(version({ id: "a-only", createdAt: "2026-07-21T06:20:00.000Z" }), "visitor-a");

  assert.deepEqual((await store.list("visitor-a")).map((item) => item.id), ["a-only", "shared"]);
  assert.deepEqual((await store.list("visitor-b")).map((item) => item.id), ["shared"]);

  await store.delete("shared", "visitor-a");

  assert.deepEqual((await store.list("visitor-a")).map((item) => item.id), ["a-only"]);
  assert.deepEqual((await store.list("visitor-b")).map((item) => item.id), ["shared"]);
});

test("version store gives administrators an all-visitor view and bulk deletion", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  await store.save(version({ id: "shared", createdAt: "2026-07-21T06:00:00.000Z" }), "visitor-a");
  await store.save(version({ id: "shared", createdAt: "2026-07-21T06:10:00.000Z" }), "visitor-b");

  const all = await store.listAll();
  assert.equal(all.length, 2);
  assert.ok(all.some((item) => item.id === "visitor-a:shared" && item.visitorId === "visitor-a"));
  assert.ok(all.some((item) => item.id === "visitor-b:shared" && item.visitorId === "visitor-b"));

  await store.deleteAny("visitor-b:shared");
  assert.deepEqual(await store.list("visitor-b"), []);
  assert.equal((await store.list("visitor-a")).length, 1);

  await store.deleteAll("visitor-a");
  assert.deepEqual(await store.list("visitor-a"), []);
});

test("version store removes records beyond the newest twenty for each visitor", async () => {
  const db = createDb();
  const store = createVersionStore(db);

  for (let index = 0; index < 21; index += 1) {
    await store.save(
      version({ id: `version-${index}`, createdAt: `2026-07-21T06:${String(index).padStart(2, "0")}:00.000Z` }),
      "visitor-a"
    );
  }

  const all = await store.listAll();
  assert.equal(all.filter((item) => item.visitorId === "visitor-a").length, 20);
  assert.equal(all.some((item) => item.id === "visitor-a:version-0"), false);
});
