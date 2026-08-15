# Truthful Optimized PDF Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every uploaded PDF produces a downloadable, visibly optimized resume that customers can obtain in one simple flow and HR can scan quickly.

**Architecture:** Keep PyMuPDF source-template writeback as the first path. When no safe source edit is written, render the verified optimized text to a native professional A4 template, optionally retaining a uniquely identified source portrait. The API returns the verified delivery mode; the editor exposes one default optimized result and keeps template switching optional.

**Tech Stack:** Node.js 20, Express, React 19, TypeScript, PyMuPDF, PDF.js, Node test runner, PDFKit fixtures.

## Global Constraints

- The main customer journey is only upload, wait, and download; no template choice is required.
- Never label an unchanged original PDF as optimized.
- A safe source-template write keeps the original layout and all imagery.
- Generated PDFs must embed a configured Chinese font and fail validation on `□` or `�` glyphs.
- Extract a source portrait only where exactly one portrait-shaped candidate is reliable; otherwise omit it.
- The default content order is recruiter-first: targeted headline, three evidence-backed highlights, experience, education, then skills.
- Use three native visual styles as reference-inspired layouts: `hr-classic`, `campus-photo`, and `modern-sidebar`; do not copy third-party source implementations.

---

### Task 1: Add a verified generated-PDF fallback

**Files:**
- Create: `server/generatedResumePdf.mjs`
- Create: `server/generatedResumePdf.test.mjs`
- Modify: `server/pdfEditor.mjs`
- Modify: `server/vendor/pymupdf_official_replace.py`

**Interfaces:**
- `createGeneratedResumePdf({ sourcePath, outputPath, optimizedText, fontPath, templateId }): Promise<{ portraitApplied: boolean, textVerified: true }>`.
- `createEditedPdfVersions(...)` returns its existing fields plus `deliveryMode: "source-template" | "generated-template"` and `portraitApplied: boolean`.

- [ ] **Step 1: Write the failing fallback test**

```js
test("zero safe source edits creates a readable optimized template PDF", async () => {
  const result = await createEditedPdfVersions({
    originalResumeFileUrl: `/api/resume-files/${sourceName}`,
    text: "测试用户\n核心优势\n- 独立策划并落地活动执行，沉淀现场协同清单。",
    changes: [{ before: "不存在的原句", after: "独立策划并落地活动执行，沉淀现场协同清单。" }],
    uploadDir
  });
  assert.equal(result.deliveryMode, "generated-template");
  assert.match((await parseResult(result.cleanOutputName)).text, /独立策划并落地活动执行/);
});
```

- [ ] **Step 2: Run the failing fallback test**

Run: `node --test server/generatedResumePdf.test.mjs`

Expected: FAIL because `deliveryMode` and the generated fallback do not exist.

- [ ] **Step 3: Implement the renderer and fallback branch**

Add `createGeneratedResumePdf` and a `render_generated_template` command in the existing Python worker. It must make an A4 `hr-classic` document using the supplied Chinese font, write recruiter-first sections from `optimizedText`, reopen the PDF, and verify normalized optimized lines are extractable. Call it only if verified source-template writeback reports zero changed lines; preserve `changedLineCount: 0` and set `deliveryMode: "generated-template"`.

- [ ] **Step 4: Run the fallback test again**

Run: `node --test server/generatedResumePdf.test.mjs server/pdfEditor.test.mjs`

Expected: PASS with an extractable optimized sentence and all existing source-template tests green.

- [ ] **Step 5: Commit the fallback**

Run: `git add server/generatedResumePdf.mjs server/generatedResumePdf.test.mjs server/pdfEditor.mjs server/pdfEditor.test.mjs server/vendor/pymupdf_official_replace.py && git commit -m "feat: generate optimized PDF when source writeback is unsafe"`

### Task 2: Add conservative photo handling and the three native styles

**Files:**
- Modify: `server/vendor/pymupdf_official_replace.py`
- Modify: `server/generatedResumePdf.mjs`
- Modify: `server/generatedResumePdf.test.mjs`

**Interfaces:**
- Renderer accepts `templateId` values `hr-classic`, `campus-photo`, and `modern-sidebar`.
- Renderer reports `portraitApplied: boolean`.

- [ ] **Step 1: Write failing photo and style tests**

```js
test("campus-photo keeps one reliable source portrait", async () => {
  const output = await createGeneratedResumePdf({ sourcePath: singlePortraitPdf, outputPath, optimizedText, fontPath, templateId: "campus-photo" });
  assert.equal(output.portraitApplied, true);
});
test("ambiguous source images never become a portrait", async () => {
  const output = await createGeneratedResumePdf({ sourcePath: multiImagePdf, outputPath, optimizedText, fontPath, templateId: "campus-photo" });
  assert.equal(output.portraitApplied, false);
});
```

- [ ] **Step 2: Run the photo tests**

Run: `node --test server/generatedResumePdf.test.mjs`

Expected: FAIL because the renderer has no photo-selection contract.

- [ ] **Step 3: Implement native styles and source-photo selection**

In the Python worker, choose a photo only when first-page image inventory contains exactly one image with aspect ratio 0.75–1.35 and both dimensions at least 80 pixels. Draw it without crop or color modification only in `campus-photo`. Implement `hr-classic` as the default single-column recruiter layout and `modern-sidebar` as an optional skills-forward layout. Default template selection must use `campus-photo` for student resumes with a usable portrait, otherwise `hr-classic`.

- [ ] **Step 4: Run the photo and style tests again**

Run: `node --test server/generatedResumePdf.test.mjs`

Expected: PASS; one reliable portrait survives and ambiguous images are omitted.

- [ ] **Step 5: Commit styles and photo behavior**

Run: `git add server/vendor/pymupdf_official_replace.py server/generatedResumePdf.mjs server/generatedResumePdf.test.mjs && git commit -m "feat: add recruiter-ready generated resume styles"`

### Task 3: Expose one simple, truthful customer result

**Files:**
- Modify: `server/app.mjs`
- Modify: `src/services/pdfFileEditor.ts`
- Modify: `src/components/EditorView.tsx`
- Create: `server/pdfDeliveryMode.test.mjs`

**Interfaces:**
- `/api/edit-pdf` returns `deliveryMode` and `portraitApplied` with the existing file URLs.
- `createEditedPdfPreview(...)` returns those fields.
- `EditorView` enables download only when a verified optimized file URL and delivery mode exist.

- [ ] **Step 1: Write failing API/UI contract tests**

```js
test("edit-pdf returns an optimized generated delivery instead of an unchanged original", async () => {
  const response = await request(app).post("/api/edit-pdf").send(fallbackPayload);
  assert.equal(response.status, 200);
  assert.equal(response.body.deliveryMode, "generated-template");
  assert.ok(response.body.fileUrl);
});
test("editor copy never calls a zero-write source PDF an optimized result", async () => {
  const source = await readFile("src/components/EditorView.tsx", "utf8");
  assert.doesNotMatch(source, /未定位到可安全替换的原句，已保留原文件/);
});
```

- [ ] **Step 2: Run the contract tests**

Run: `node --test server/pdfDeliveryMode.test.mjs`

Expected: FAIL because the route omits delivery mode and the editor has the original-file fallback copy.

- [ ] **Step 3: Implement the customer-facing result state**

Forward renderer metadata in the API response. In `EditorView`, use the verified `fileUrl` for the refined preview in both modes, keep the upload only on the original tab, and show only “优化后的简历已生成，可下载。” after successful output. Keep `换模板` hidden until a generated result exists; it must call only `/api/edit-pdf` with another template ID and never call AI optimization.

- [ ] **Step 4: Run the contract tests and production build**

Run: `node --test server/pdfDeliveryMode.test.mjs && npm run build`

Expected: PASS and Vite completes with exit code 0.

- [ ] **Step 5: Commit the simple delivery UI**

Run: `git add server/app.mjs src/services/pdfFileEditor.ts src/components/EditorView.tsx server/pdfDeliveryMode.test.mjs && git commit -m "feat: deliver verified optimized resume PDFs"`

### Task 4: Enforce Chinese readability and verify the supplied PDFs

**Files:**
- Modify: `server/generatedResumePdf.test.mjs`
- Modify: `server/pdfFontkit.test.mjs`

- [ ] **Step 1: Write the failing Chinese rendering test**

```js
test("every native style contains readable Chinese optimized content", async () => {
  for (const templateId of ["hr-classic", "campus-photo", "modern-sidebar"]) {
    const result = await createGeneratedResumePdf({ sourcePath, outputPath: join(uploadDir, `${templateId}.pdf`), optimizedText: "核心优势\n独立运营小红书，累计输出求职攻略 150+ 篇。", fontPath, templateId });
    const parsed = await parseGenerated(templateId);
    assert.match(parsed.text.replace(/\s+/g, ""), /独立运营小红书累计输出求职攻略150篇/);
    assert.doesNotMatch(parsed.text, /□|�/);
  }
});
```

- [ ] **Step 2: Run the Chinese rendering test**

Run: `node --test server/generatedResumePdf.test.mjs`

Expected: FAIL until all renderer paths embed the configured Chinese font and validate output.

- [ ] **Step 3: Implement font verification and run the complete release checks**

Reject a generated PDF when its parsed content loses an expected normalized line or contains replacement glyphs. Then run `npm test` and confirm its exit code is zero.

- [ ] **Step 4: Run browser smoke tests with `沈保自(1).pdf` and `杜小艳-六月底到-可实习两个月.pdf`**

For each file, verify upload, completion, enabled download, a refined preview whose visible text differs from the original, readable Chinese text, and no `□` or `�` glyphs.

- [ ] **Step 5: Commit test coverage**

Run: `git add server/generatedResumePdf.test.mjs server/pdfFontkit.test.mjs && git commit -m "test: verify readable optimized resume PDF output"`

## Plan self-review

- Every spec requirement maps to Tasks 1–4: real output, optional templates, portrait protection, customer simplicity, HR-first hierarchy, and Chinese readability.
- `deliveryMode` values and renderer inputs are consistent across the API and UI tasks.
- No step uses a placeholder; each test, command, and expected result is concrete.
