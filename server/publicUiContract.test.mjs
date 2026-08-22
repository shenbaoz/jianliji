import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public start flow exposes the redesigned entry points", async () => {
  const source = await read("src/components/ResumeStartView.tsx");
  assert.match(source, /start-choose-card-bottom/);
  assert.doesNotMatch(source, /不需要登录|当前免费开放|约 1 分钟/);
});

test("from-zero flow explains the minimum experience length before generation", async () => {
  const source = await read("src/components/ResumeStartView.tsx");
  assert.match(source, /必须超过 10 个字/);
  assert.match(source, /真实经历/);
  assert.match(source, /facts\.trim\(\)\.length > 10/);
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
  assert.match(editor, /复制成功|已复制/);
  assert.match(editor, /navigator\.clipboard\.writeText/);
});

test("every export click opens the price feedback gate", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.doesNotMatch(editor, /exportUnlocked/);
  assert.match(editor, /const requestExport = \(action: \(\) => void\) => \{[\s\S]*?setGateAction/);
});

test("result-page feedback unlocks later downloads without asking again", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /提交反馈/);
  assert.match(editor, /feedbackSubmitted/);
  assert.match(editor, /sessionStorage/);
  assert.match(editor, /feedbackSubmitted \? handleDownloadPdf\(\) : requestExport\(handleDownloadPdf\)/);
  assert.match(editor, /feedbackSubmitted \? handleDownloadWord\(\) : requestExport\(handleDownloadWord\)/);
  assert.match(editor, /提交反馈并关闭/);
});

test("final resume is read-only with PDF as the primary export", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /你的简历成稿已生成/);
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

test("mobile homepage keeps the full hero scrollable instead of clipping the resume preview", async () => {
  const styles = await read("src/styles.css");
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?body:has\(\.apple-style-home\) \{\s*overflow-y:\s*auto/);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.public-editorial-shell \.apple-style-home \{[\s\S]*?height:\s*auto/);
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.public-editorial-shell \.apple-hero-page \{[\s\S]*?overflow:\s*visible/);
});

test("export feedback dialog is compact and centered without a white card", async () => {
  const source = await read("src/styles.css");
  assert.match(source, /\.public-editorial-shell \.export-gate-overlay\s*\{[^}]*place-items:\s*center/);
  assert.match(source, /\.public-editorial-shell \.export-gate-card\s*\{[^}]*background:\s*#fff/);
  assert.match(source, /\.public-editorial-shell \.export-gate-card\s*\{[^}]*width:\s*min\(360px/);
  assert.match(source, /\.public-editorial-shell \.export-gate-overlay\s*\{[^}]*position:\s*fixed/);
});

test("PDF import preview does not eagerly duplicate the whole file as a data URL", async () => {
  const source = await read("src/services/resumeOriginalPreview.ts");
  assert.match(source, /if \(\/\\\.pdf\$\/i\.test\(file\.name\)\) \{[\s\S]*?fileUrl: URL\.createObjectURL\(file\)[\s\S]*?\}\s*\n\s*const dataUrl = await fileToDataUrl\(file\);/);
});

test("PDF export uses the attachment URL in the WeChat/mobile-safe path", async () => {
  const source = await read("src/components/EditorView.tsx");
  assert.match(source, /window\.location\.assign\(withDownloadFlag\(preparedPdf\.fileUrl\)\)/);
});

test("PDF import export preserves the source layout when safe", async () => {
  const source = await read("src/services/pdfFileEditor.ts");
  assert.doesNotMatch(source, /outputMode:\s*"generated-template"/);
});

test("final export actions render visible download feedback", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /exportMessage &&/);
  assert.match(editor, /role="status"/);
});

test("generated PDF places the portrait above the header rule", async () => {
  const source = await read("server/vendor/pymupdf_official_replace.py");
  assert.match(source, /y\s*=\s*max\(y,\s*126\s*if\s*portrait\s*else\s*y\)/);
});

test("from-zero flow accepts an optional portrait and sends it into generated PDF export", async () => {
  const [types, start, app, pdfEditor] = await Promise.all([
    read("src/types.ts"),
    read("src/components/ResumeStartView.tsx"),
    read("src/App.tsx"),
    read("src/services/pdfFileEditor.ts")
  ]);
  assert.match(types, /portraitDataUrl\?: string/);
  assert.match(start, /accept="image\/(?:jpeg|png)/);
  assert.match(app, /createGeneratedPdf\(refined\.text, normalized\.portraitDataUrl, normalized\.candidateName\)/);
  assert.match(pdfEditor, /portraitDataUrl/);
});

test("all export actions remain behind the price and feedback gate", async () => {
  const editor = await read("src/components/EditorView.tsx");
  assert.match(editor, /feedbackSubmitted \? handleDownloadPdf\(\) : requestExport\(handleDownloadPdf\)/);
  assert.match(editor, /feedbackSubmitted \? handleDownloadWord\(\) : requestExport\(handleDownloadWord\)/);
  assert.match(editor, /提交反馈并下载/);
  assert.match(editor, /9\.9 元/);
  assert.match(editor, /19\.9 元/);
  assert.match(editor, /29\.9 元/);
  assert.doesNotMatch(editor, /不愿意付费|19\.9 元及以上|当前免费|免费下载/);
  assert.match(editor, /哪里让你觉得值，或不值/);
});

test("generated PDF keeps all source content while fitting one page", async () => {
  const source = await read("server/vendor/pymupdf_official_replace.py");
  assert.match(source, /generated resume must remain one page/);
  assert.match(source, /coverage < 0\.55/);
  assert.doesNotMatch(source, /columns\s*=|column_index/);
});

test("editor preview uses the recommended single-column reading flow", async () => {
  const styles = await read("src/styles.css");
  assert.match(styles, /Recommended deliverable layout: one-page, single-column reading flow/);
  assert.match(styles, /\.resume-section\s*\{\s*display:\s*block;/);
});

test("generated PDF header keeps compact personal information", async () => {
  const source = await read("server/vendor/pymupdf_official_replace.py");
  assert.match(source, /personal_fields/);
  assert.match(source, /性别/);
  assert.match(source, /电子邮箱/);
  assert.match(source, /联系方式/);
});

test("AI content is not discarded when optional PDF preparation fails", async () => {
  const app = await read("src/App.tsx");
  const resultIndex = app.indexOf("setResult({ text: refined.text");
  const pdfIndex = app.indexOf("const preparedPdf =");
  assert.ok(resultIndex >= 0, "the generated AI content must be committed to UI state");
  assert.ok(pdfIndex >= 0, "PDF preparation must remain an explicit step");
  assert.ok(resultIndex < pdfIndex, "the editor must not wait for optional PDF preparation");
  assert.match(app, /PDF.*准备|PDF.*失败|pdf/i);
});

test("footer exposes the required public security registration", async () => {
  const footer = await read("src/components/Footer.tsx");
  assert.match(footer, /beian\.mps\.gov\.cn\/\#\/query\/webSearch\?code=51070302110762/);
  assert.match(footer, /川公网安备51070302110762号/);
  assert.match(footer, /备案图标\.png/);
});
