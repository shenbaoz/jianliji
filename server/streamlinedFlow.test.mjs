import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public start view offers simple existing-resume and novice paths without a job description", async () => {
  const [app, start] = await Promise.all([read("src/App.tsx"), read("src/components/ResumeStartView.tsx")]);

  assert.match(app, /optimizeWithDeepSeek/);
  assert.match(start, /我有简历，帮我优化/);
  assert.match(start, /我是小白，从零开始/);
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

  assert.match(app, /正在整理你的简历/);
  assert.doesNotMatch(publicSurface, /DeepSeek|Kimi|AI |ATS|评分|匹配度|岗位分析|招聘者质检/);
});

test("completion presents original and refined views, concrete changes, and one download action", async () => {
  const editor = await read("src/components/EditorView.tsx");

  assert.match(editor, /原版/);
  assert.match(editor, /整理后/);
  assert.match(editor, /已删减|已整理|已重写/);
  assert.match(editor, /handleDownloadPdf/);
  assert.doesNotMatch(editor, /onClick=\{handleSaveVersion\}|qualityPositive && <QualityMeterCard|contentEditable/);
});

test("the public header contains only home and resume navigation", async () => {
  const header = await read("src/components/Header.tsx");

  assert.doesNotMatch(header, /案例库|onOpenCases/);
  assert.match(header, /开始做简历/);
});
