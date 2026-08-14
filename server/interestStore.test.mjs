import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterestStore } from "./interestStore.mjs";

function lead(overrides = {}) {
  return {
    id: "lead-1",
    createdAt: "2026-07-21T07:00:00.000Z",
    source: "result",
    candidateName: "张三",
    targetRole: "前端工程师",
    planId: "jd-fit",
    contact: "wx: test-user",
    note: "想先试 19.9 岗位定制版",
    ...overrides
  };
}

test("interest store saves newest unlock leads first", async () => {
  const store = createInterestStore();

  await store.save(lead({ id: "old", createdAt: "2026-07-21T06:00:00.000Z" }));
  await store.save(lead({ id: "new", createdAt: "2026-07-21T06:30:00.000Z", planId: "complete" }));

  const leads = await store.list();

  assert.deepEqual(leads.map((item) => item.id), ["new", "old"]);
  assert.equal(leads[0].planId, "complete");
});

test("interest store requires a plan and source", async () => {
  const store = createInterestStore();

  await assert.rejects(
    () => store.save(lead({ source: "", planId: "" })),
    /source and planId are required/
  );
});

test("interest store deletes a lead by id", async () => {
  const store = createInterestStore();

  await store.save(lead({ id: "keep", createdAt: "2026-07-21T06:00:00.000Z" }));
  await store.save(lead({ id: "remove", createdAt: "2026-07-21T06:30:00.000Z" }));
  await store.delete("remove");

  const leads = await store.list();

  assert.deepEqual(leads.map((item) => item.id), ["keep"]);
});

test("interest store file mode persists leads atomically and caps long fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "interest-store-"));
  const filePath = join(dir, "leads.json");
  const store = createInterestStore(filePath);
  try {
    await store.ensureSchema();
    await store.save(lead({ id: "a".repeat(80), note: "b".repeat(3000) }));

    const leads = await store.list();
    assert.equal(leads.length, 1);
    assert.equal(leads[0].id.length, 64);
    assert.equal(leads[0].note.length, 2000);

    const raw = JSON.parse(await readFile(filePath, "utf8"));
    assert.equal(Array.isArray(raw), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
