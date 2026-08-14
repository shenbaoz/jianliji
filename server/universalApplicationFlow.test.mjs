import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public flow accepts a compact factual input and normalizes a blank direction", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /nextInput\.resumeText\.trim\(\)\.length < 11/);
  assert.match(app, /targetRole: nextInput\.targetRole\.trim\(\) \|\| "通用求职版"/);
  assert.doesNotMatch(app, /JobView/);
});
