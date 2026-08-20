import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public start flow exposes the redesigned entry points", async () => {
  const source = await read("src/components/ResumeStartView.tsx");
  assert.match(source, /start-choose-card-meta/);
  assert.doesNotMatch(source, /不需要登录|当前免费开放|约 1 分钟/);
});

test("public entry surfaces keep the interface focused on file-first actions", async () => {
  const landing = await read("src/components/LandingView.tsx");
  const footer = await read("src/components/Footer.tsx");
  assert.doesNotMatch(landing, /不需要登录|当前免费开放|约 1 分钟/);
  assert.doesNotMatch(footer, /当前免费开放/);
});

test("export feedback shows the owner's WeChat contact", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /微信/);
  assert.match(editor, /18142560091/);
});

test("final resume is read-only with PDF as the primary export", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /成稿已整理完成/);
  assert.match(editor, /下载 PDF/);
  assert.doesNotMatch(editor, /可继续编辑|打印 \/ 保存 PDF|contentEditable/);
  assert.match(editor, /className="editor-primary-export\b/);
  assert.doesNotMatch(editor, /已生成成稿|className=\{canPublish/);
});

test("file import is the only resume input and job direction comes first", async () => {
  const source = await read("src/components/HomeView.tsx");
  const start = await read("src/components/ResumeStartView.tsx");
  const landing = await read("src/components/LandingView.tsx");
  const styles = await read("src/styles.css");
  assert.doesNotMatch(`${source}\n${start}\n${landing}`, /粘贴内容|粘贴文字|或文字|resume-textarea/);
  assert.match(styles, /\.public-editorial-shell \.job-direction\s*\{[^}]*order:\s*0/);
  assert.match(styles, /\.public-editorial-shell \.upload-card\s*\{[^}]*order:\s*1/);
});

test("public upload flow keeps the primary action and preview empty state", async () => {
  const source = await read("src/components/HomeView.tsx");
  assert.match(source, /upload-stage/);
  assert.match(source, /resume-empty-state-skeleton/);
  assert.match(source, /mobile-view-tabs/);
});

test("public styling defines the unified monochrome action system", async () => {
  const source = await read("src/styles.css");
  assert.match(source, /--accent: #202022/);
  assert.match(source, /\.public-primary-button/);
  assert.match(source, /\.start-choose-card-meta/);
});

test("export feedback dialog is compact and centered without a white card", async () => {
  const source = await read("src/styles.css");
  assert.match(source, /\.public-editorial-shell \.export-gate-overlay\s*\{[^}]*place-items:\s*center/);
  assert.match(source, /\.public-editorial-shell \.export-gate-card\s*\{[^}]*background:\s*#fff/);
  assert.match(source, /\.public-editorial-shell \.export-gate-card\s*\{[^}]*width:\s*min\(360px/);
});

test("PDF import preview does not eagerly duplicate the whole file as a data URL", async () => {
  const source = await read("src/services/resumeOriginalPreview.ts");
  assert.match(source, /if \(\/\\\.pdf\$\/i\.test\(file\.name\)\) \{[\s\S]*?fileUrl: URL\.createObjectURL\(file\)[\s\S]*?\}\s*\n\s*const dataUrl = await fileToDataUrl\(file\);/);
});

test("PDF export uses the attachment URL in the WeChat/mobile-safe path", async () => {
  const source = await read("src/components/EditorView.tsx");
  assert.match(source, /window\.location\.assign\(withDownloadFlag\(preparedPdf\.fileUrl\)\)/);
});
