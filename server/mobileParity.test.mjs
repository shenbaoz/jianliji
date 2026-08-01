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
