import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("production entry defers sample library and PDF editor code", async () => {
  const assets = await readdir(join(process.cwd(), "dist", "assets"));
  const entryName = assets.find((name) => /^app-.*\.js$/.test(name));
  assert.ok(entryName, "production app entry was not built");
  const entry = await readFile(join(process.cwd(), "dist", "assets", entryName), "utf8");

  assert.doesNotMatch(entry, /校园消费数据分析/);
  assert.doesNotMatch(entry, /PDF 同步失败/);
});
