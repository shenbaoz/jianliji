import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("external AI generation uses the default AI flow without a consent gate", async () => {
  const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const jobSource = await readFile(new URL("../src/components/JobView.tsx", import.meta.url), "utf8");
  const creatorSource = await readFile(new URL("../src/components/CreatorView.tsx", import.meta.url), "utf8");

  assert.match(appSource, /allowExternalAi = true/);
  assert.match(appSource, /if \(!allowExternalAi\)[\s\S]*未发送给外部 AI/);
  assert.match(jobSource, /const canAnalyze = resumeReady && input\.targetRole\.trim\(\)\.length > 1;/);
  assert.match(appSource, /runGeneration\(nextInput, nextReport, \{\}, true\)/);
  assert.doesNotMatch(appSource, /aiConsent|setAiConsent/);
  assert.doesNotMatch(creatorSource, /aiConsent|onAiConsentChange|同意将脱敏后的简历内容发送给 DeepSeek/);
});
