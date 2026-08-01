import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile views reuse desktop generation save and export handlers", async () => {
  const [app, creator, editor] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/CreatorView.tsx"),
    read("src/components/EditorView.tsx")
  ]);

  assert.match(app, /onGenerate=\{generateFromCreator\}/);
  assert.match(creator, /await onGenerate\(creatorProfileToResumeInput\(profile\)\)/);
  assert.match(editor, /onClick=\{handleSave\}/);
  assert.match(editor, /onClick=\{handleDownloadPdf\}/);
});

test("generation buttons do not pass a click event as resume input", async () => {
  const app = await read("src/App.tsx");

  assert.doesNotMatch(app, /onGenerate=\{runGeneration\}/);
  assert.match(app, /onGenerate=\{\(\) => void runGeneration\(\)\}/);
});

test("the A4 editor preview is scaled to its actual mobile container", async () => {
  const editor = await read("src/components/EditorView.tsx");

  assert.match(editor, /new ResizeObserver\(updatePreviewScale\)/);
  assert.match(editor, /window\.addEventListener\("resize", updatePreviewScale\)/);
  assert.match(editor, /transform: `scale\(\$\{previewScale\}\)`/);
  assert.match(editor, /height: previewHeight > 0 \? `\$\{previewHeight\}px` : undefined/);
});

test("shared pages expose the responsive presentation contract", async () => {
  const [app, shell, home, creator, editor, css] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/ProductShell.tsx"),
    read("src/components/HomeView.tsx"),
    read("src/components/CreatorView.tsx"),
    read("src/components/EditorView.tsx"),
    read("src/styles.css")
  ]);

  assert.match(app, /app-toast/);
  assert.match(shell, /workflow-mobile-summary/);
  assert.match(home, /mobile-view-tabs/);
  assert.match(creator, /creator-step-progress/);
  assert.match(editor, /editor-mobile-tabs/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
});
