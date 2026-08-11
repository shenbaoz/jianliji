import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public refinement starts from an uploaded resume and never asks for a role or job description", async () => {
  const [app, home] = await Promise.all([read("src/App.tsx"), read("src/components/HomeView.tsx")]);

  assert.match(app, /optimizeUniversalResume/);
  assert.doesNotMatch(app, /JobView|ReportView|FollowUpView|CreatorView|CaseLibraryView/);
  assert.doesNotMatch(home, /onLoadSample|样稿|目标岗位|岗位 JD/);
  assert.match(home, /onRefine/);
});

test("public refinement shows neutral progress and does not expose AI, score, or diagnostic language", async () => {
  const [app, landing, editor] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/LandingView.tsx"),
    read("src/components/EditorView.tsx")
  ]);
  const publicSurface = `${app}\n${landing}\n${editor}`;

  assert.match(publicSurface, /正在整理你的简历/);
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

test("the public header contains only home and refine navigation", async () => {
  const header = await read("src/components/Header.tsx");

  assert.doesNotMatch(header, /案例库|从 0 创建|onOpenCases|onOpenCreator/);
  assert.match(header, /开始整理/);
});
