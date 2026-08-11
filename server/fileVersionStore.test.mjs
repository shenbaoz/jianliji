import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createFileVersionStore } from "./fileVersionStore.mjs";

function version(id, createdAt) {
  return {
    id,
    createdAt,
    candidateName: "张三",
    targetRole: "前端工程师",
    score: 88,
    templateId: "classic",
    resumeText: "原始简历",
    jobDescription: "岗位 JD",
    optimizedText: "优化后简历"
  };
}

test("file version store persists versions between instances", async () => {
  const dir = await mkdtemp(join(tmpdir(), "resume-store-"));
  const file = join(dir, "versions.json");

  try {
    const first = createFileVersionStore(file);
    await first.ensureSchema();
    await first.save(version("old", "2026-07-21T06:00:00.000Z"));
    await first.save(version("new", "2026-07-21T06:20:00.000Z"));

    const second = createFileVersionStore(file);
    const versions = await second.list();

    assert.deepEqual(versions.map((item) => item.id), ["new", "old"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file version store deletes versions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "resume-store-"));
  const file = join(dir, "versions.json");

  try {
    const store = createFileVersionStore(file);
    await store.save(version("keep", "2026-07-21T06:00:00.000Z"));
    await store.save(version("remove", "2026-07-21T06:10:00.000Z"));
    await store.delete("remove");

    assert.deepEqual((await store.list()).map((item) => item.id), ["keep"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file version store isolates versions by visitor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "resume-store-"));
  const file = join(dir, "versions.json");

  try {
    const store = createFileVersionStore(file);
    await store.save(version("shared", "2026-07-21T06:00:00.000Z"), "visitor-a");
    await store.save(version("shared", "2026-07-21T06:10:00.000Z"), "visitor-b");
    await store.save(version("a-only", "2026-07-21T06:20:00.000Z"), "visitor-a");

    assert.deepEqual((await store.list("visitor-a")).map((item) => item.id), ["a-only", "shared"]);
    assert.deepEqual((await store.list("visitor-b")).map((item) => item.id), ["shared"]);

    await store.delete("shared", "visitor-a");

    assert.deepEqual((await store.list("visitor-a")).map((item) => item.id), ["a-only"]);
    assert.deepEqual((await store.list("visitor-b")).map((item) => item.id), ["shared"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("file version store exposes all visitors only through admin methods and keeps twenty versions per visitor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "resume-store-"));
  const file = join(dir, "versions.json");

  try {
    const store = createFileVersionStore(file);
    for (let index = 0; index < 21; index += 1) {
      await store.save(version(`a-${index}`, `2026-07-21T06:${String(index).padStart(2, "0")}:00.000Z`), "visitor-a");
    }
    await store.save(version("shared", "2026-07-21T07:00:00.000Z"), "visitor-b");

    assert.equal((await store.list("visitor-a")).length, 20);
    const all = await store.listAll();
    assert.equal(all.length, 21);
    assert.ok(all.some((item) => item.id === "visitor-b:shared" && item.visitorId === "visitor-b"));

    await store.deleteAny("visitor-b:shared");
    assert.deepEqual(await store.list("visitor-b"), []);

    await store.deleteAll("visitor-a");
    assert.deepEqual(await store.list("visitor-a"), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
