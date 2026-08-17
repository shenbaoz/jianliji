import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public refinement uses the fact-safe optimize contract without exposing provider names or a consent detour", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /optimizeWithDeepSeek\(normalized/);
  assert.doesNotMatch(app, /aiConsent|jobDescription\.trim/);
});
