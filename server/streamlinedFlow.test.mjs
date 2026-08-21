import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public start view offers simple existing-resume and novice paths without a job description", async () => {
  const [app, start] = await Promise.all([read("src/App.tsx"), read("src/components/ResumeStartView.tsx")]);

  assert.match(app, /optimizeWithDeepSeek/);
  assert.match(start, /已有简历/);
  assert.match(start, /从零创建/);
  assert.match(start, /求职方向/);
  assert.doesNotMatch(start, /岗位 JD/);
});

test("public refinement shows neutral progress and does not expose AI, score, or diagnostic language", async () => {
  const [app, start, landing, editor] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/ResumeStartView.tsx"),
    read("src/components/LandingView.tsx"),
    read("src/components/EditorView.tsx")
  ]);
  const publicSurface = `${start}\n${landing}\n${editor}`;

  assert.match(app, /正在生成简历/);
  assert.doesNotMatch(publicSurface, /DeepSeek|Kimi|AI |ATS|评分|匹配度|岗位分析|招聘者质检/);
});

test("completion presents a clean refined resume, concrete changes, and one download action", async () => {
  const editor = await read("src/components/EditorView.tsx");

  assert.match(editor, /可投递成稿/);
  assert.match(editor, /ResumeDocument/);
  assert.match(editor, /preparedPdf\?\.portraitDataUrl/);
  assert.match(editor, /已删减|已整理|已重写/);
  assert.match(editor, /handleDownloadPdf/);
  assert.doesNotMatch(editor, /<iframe/);
  assert.doesNotMatch(editor, /onClick=\{handleSaveVersion\}|qualityPositive && <QualityMeterCard|contentEditable/);
});

test("the public header contains only home and resume navigation", async () => {
  const header = await read("src/components/Header.tsx");

  assert.doesNotMatch(header, /案例库|onOpenCases/);
  assert.match(header, /开始优化/);
});

test("completion exports a generated PDF instead of relying on the browser print dialog", async () => {
  const [app, editor, pdfService] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/EditorView.tsx"),
    read("src/services/pdfFileEditor.ts")
  ]);

  assert.match(app, /createGeneratedPdf/);
  assert.match(pdfService, /\/api\/export-pdf/);
  assert.doesNotMatch(editor, /window\.print\(\)/);
  assert.match(editor, /searchParams\.set\("download", "1"\)/);
});
