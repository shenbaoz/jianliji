# Instant One-Page Resume Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete, recruiter-ready resume immediately after the single optimization wait.

**Architecture:** The optimization request will return both the refined resume text and finished PDF delivery metadata before the app navigates to the result page. The server will create a professional one-page-first PDF and extract an existing portrait from the source PDF for both the PDF and a first-party HTML result preview. The result view will render the prepared resume data itself and never embed a browser PDF viewer.

**Tech Stack:** React, TypeScript, Express, PyMuPDF, node:test.

## Global Constraints

- Do not invent or alter candidate facts.
- Preserve a source portrait when one exists; never generate a portrait when it does not.
- One page is preferred; two pages are allowed when retaining verified key facts requires it.
- No iframe or browser-native PDF viewer on the result page.
- The only customer-visible wait is the existing optimization overlay.

---

### Task 1: Return prebuilt PDF delivery from the optimization flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/services/pdfFileEditor.ts`
- Modify: `src/types.ts`
- Test: `server/app.test.mjs`

- [ ] **Step 1: Add a delivery result to the current result state**

```ts
type PreparedPdf = { fileUrl: string; reviewFileUrl: string; deliveryMode: PdfDeliveryMode; portraitDataUrl?: string };
```

- [ ] **Step 2: Build the PDF before `go("editor")` for uploaded PDFs**

```ts
const preparedPdf = await createEditedPdfPreview(normalized.originalResumeFileUrl, refined.text, refined.changes || []);
setResult({ text: refined.text, changes: refined.changes || [], highlights: refined.highlights || [], preparedPdf });
go("editor");
```

- [ ] **Step 3: Verify the editor receives a prepared PDF without starting another request**

Run: `node --test server/app.test.mjs`

### Task 2: Preserve source portrait and produce a compact PDF

**Files:**
- Modify: `server/vendor/pymupdf_official_replace.py`
- Modify: `server/pdfEditor.mjs`
- Test: `server/pdfEditor.test.mjs`

- [ ] **Step 1: Add a failing test for a source PDF containing an image**

```js
assert.equal(result.portraitApplied, true);
assert.ok(result.portraitDataUrl.startsWith("data:image/"));
```

- [ ] **Step 2: Extract the largest portrait-like source image and return a data URL**

```py
portrait = extract_source_portrait(source_document)
result["portraitApplied"] = portrait is not None
result["portraitDataUrl"] = portrait_data_url(portrait) if portrait else None
```

- [ ] **Step 3: Use the portrait in the generated one-page-first layout and compact repeated lines before opening a second page**

```py
insert_portrait(page, portrait, x=474, y=42, width=58, height=72)
```

- [ ] **Step 4: Run focused PDF tests**

Run: `node --test server/pdfEditor.test.mjs`

### Task 3: Replace PDF viewer with a first-party result preview

**Files:**
- Modify: `src/components/EditorView.tsx`
- Modify: `src/components/ResumeDocument.tsx`
- Test: `src/components/EditorView.test.tsx` if present, otherwise browser validation

- [ ] **Step 1: Remove `PdfFilePreview` and every iframe path from the result page**

```tsx
<ResumeDocument text={editableResumeText} template={template} portraitDataUrl={preparedPdf?.portraitDataUrl} compact />
```

- [ ] **Step 2: Render a stable paper skeleton only while the single optimization overlay is active**

```tsx
{preparedPdf ? <ResumeDocument ... /> : <ResultSkeleton />}
```

- [ ] **Step 3: Keep download linked to the already-prepared clean PDF**

```ts
link.href = preparedPdf.fileUrl;
```

### Task 4: Verify actual customer flows and deploy

**Files:**
- Modify only if an observed failure requires it.

- [ ] **Step 1: Run build and server tests**

Run: `npm run build && node --test server/app.test.mjs server/pdfEditor.test.mjs`

- [ ] **Step 2: Run both supplied PDF flows in the live browser**

Expected: one wait, immediate white A4 result page, no PDF toolbar, portrait preserved when present, and successful download.

- [ ] **Step 3: Package without `.env`, `.env.local`, uploads, or test output; deploy through Baota**

- [ ] **Step 4: Re-run both live flows after deployment and record results**
