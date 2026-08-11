import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a readable existing resume is the only public refinement requirement", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /input\.resumeText\.trim\(\)\.length < 21/);
  assert.doesNotMatch(app, /targetRole\.trim\(\)|JobView/);
});
