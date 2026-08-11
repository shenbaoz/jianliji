import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("resume optimization skips the diagnostic detour and generates from the job page", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../src/components/ProductShell.tsx", import.meta.url), "utf8");
  const start = app.indexOf("const runAnalysis");
  const end = app.indexOf("const runGeneration", start);
  const analysisHandler = app.slice(start, end);

  assert.match(analysisHandler, /await runGeneration\(universalInput, nextReport, \{\}, true\)/);
  assert.doesNotMatch(analysisHandler, /go\("analysis"\)/);
  assert.doesNotMatch(shell, /匹配诊断|补充证据/);
});

test("the visible workflow is exactly three steps and ends with AI generation", async () => {
  const shell = await readFile(new URL("../src/components/ProductShell.tsx", import.meta.url), "utf8");
  const stagesStart = shell.indexOf("export const workflowStages");
  const stagesEnd = shell.indexOf("];", stagesStart);
  const stages = shell.slice(stagesStart, stagesEnd);

  assert.equal((stages.match(/id:/g) || []).length, 3);
  assert.match(stages, /id: "workspace"[\s\S]*id: "job"[\s\S]*id: "editor"/);
  assert.match(stages, /label: "AI 生成简历"/);
  assert.doesNotMatch(stages, /id: "versions"/);
});

test("AI generation shows persistent refining progress and blocks duplicate submissions", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const job = await readFile(new URL("../src/components/JobView.tsx", import.meta.url), "utf8");

  assert.match(app, /const \[isGenerating, setIsGenerating\] = useState\(false\)/);
  assert.match(app, /正在精修/);
  assert.match(app, /通常需要 30–60 秒/);
  assert.match(app, /isGenerating && <AiRefiningOverlay/);
  assert.doesNotMatch(app, /AI 正在精修简历/);
  assert.doesNotMatch(app, /setValidationMessage\("正在使用 DeepSeek 精修简历/);
  assert.match(job, /isGenerating: boolean/);
  assert.match(job, /disabled=\{!canAnalyze \|\| isGenerating\}/);
  assert.match(job, /正在精修…/);
});

test("review marks are rendered on the right PDF preview instead of the left comparison copy", async () => {
  const editor = await readFile(new URL("../src/components/EditorView.tsx", import.meta.url), "utf8");
  const pdfService = await readFile(new URL("../src/services/pdfFileEditor.ts", import.meta.url), "utf8");

  assert.doesNotMatch(editor, /className="optimized-change /);
  assert.match(editor, /reviewFileUrl/);
  assert.match(editor, /buildResumeChangeSet/);
  assert.match(editor, /workerUrl\.searchParams\.set\("mime", "application-javascript-v1"\)/);
  assert.match(pdfService, /reviewFileUrl/);
  assert.match(pdfService, /changes/);
  assert.match(editor, /toDataURL\("image\/png"\)/);
  assert.match(editor, /setRenderedPages\(\[\]\)/, "the old clean preview must disappear while the redline PDF renders");
  assert.match(editor, /<img/);
  assert.doesNotMatch(editor, /function PdfFilePreview[\s\S]*<iframe/);
});

test("the final page has one home exit and no restart or diagnostic navigation", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const header = await readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../src/components/EditorView.tsx", import.meta.url), "utf8");

  assert.match(app, /finalOnly=\{view === "editor"\}/);
  assert.match(header, /finalOnly/);
  assert.doesNotMatch(editor, /返回诊断/);
});

test("the final page shows the finished resume without comparison, AI score, or optional suggestion panels", async () => {
  const editor = await readFile(new URL("../src/components/EditorView.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(editor, /优化了哪里/);
  assert.doesNotMatch(editor, /可选补强（不会进入简历正文）/);
  assert.doesNotMatch(editor, /AI 招聘者质检/);
  assert.doesNotMatch(editor, /changeExamples\.map/);
});

test("the PDF writer receives the exact patches produced by Reactive Resume", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const editor = await readFile(new URL("../src/components/EditorView.tsx", import.meta.url), "utf8");
  const types = await readFile(new URL("../src/types.ts", import.meta.url), "utf8");

  assert.match(types, /changes\?: Array<\{ before: string; after: string \}>/);
  assert.match(app, /changes: aiResult\.changes/);
  assert.match(app, /changes: optimized\.changes/);
  assert.match(editor, /currentVersion\?\.changes \|\| buildResumeChangeSet/);
});

test("the final screen puts changes directly in the resume instead of a left explanation pane", async () => {
  const editor = await readFile(new URL("../src/components/EditorView.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(editor, /优化后的简历文字|最后检查|投递前质检|editor-edit-pane/);
  assert.doesNotMatch(editor, /<textarea/);
  assert.match(editor, /max-w-\[1100px\]/);
  assert.match(editor, /正在生成成品简历/);
});
