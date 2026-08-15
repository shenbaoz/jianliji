import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile views reuse refinement and final export handlers", async () => {
  const [app, editor] = await Promise.all([read("src/App.tsx"), read("src/components/EditorView.tsx")]);
  assert.match(app, /onGenerate=\{refine\}/);
  assert.match(editor, /onClick=\{handleDownloadPdf\}/);
  assert.doesNotMatch(editor, /onClick=\{handleSave\}/);
});

test("refinement button does not pass a click event as resume input", async () => {
  const app = await read("src/App.tsx");

  assert.doesNotMatch(app, /onGenerate=\{refine\(\)\}/);
  assert.match(app, /onGenerate=\{refine\}/);
});

test("the A4 editor preview stays readable inside its mobile viewport", async () => {
  const editor = await read("src/components/EditorView.tsx");

  assert.match(editor, /editor-preview-viewport/);
  assert.match(editor, /w-\[210mm\]/);
  assert.doesNotMatch(editor, /new ResizeObserver\(updatePreviewScale\)/);
});

test("shared pages expose the responsive presentation contract", async () => {
  const [app, shell, home, editor, css] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/ProductShell.tsx"),
    read("src/components/HomeView.tsx"),
    read("src/components/EditorView.tsx"),
    read("src/styles.css")
  ]);

  assert.match(app, /app-toast/);
  assert.match(shell, /workflow-mobile-summary/);
  assert.match(home, /mobile-view-tabs/);
  assert.doesNotMatch(editor, /editor-mobile-tabs/);
  assert.match(editor, /max-w-\[1100px\]/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
});

test("the resume preview recognizes the AI core-advantages section", async () => {
  const documentSource = await read("src/components/ResumeDocument.tsx");

  assert.match(documentSource, /sectionTitles[\s\S]*"核心优势"/);
  assert.match(documentSource, /sectionTitles[\s\S]*"技能与优势"/);
  assert.match(documentSource, /sectionTitles[\s\S]*"技能特长"/);
  assert.doesNotMatch(documentSource, /contactParts\[0\][\s\S]*1\*{10}/);
  assert.match(documentSource, /\{parsed\.phone &&/);
  assert.match(documentSource, /\{parsed\.email &&/);
});
