# Commercial Universal Resume Refining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing role/JD-driven workflow into a commercially usable universal resume-refining flow that visibly improves content while preserving the original file's page count and fixed visual assets.

**Architecture:** Keep parsing, AI-provider isolation, source-evidence checks and version storage. Replace the role/JD report and follow-up path with one universal-refining orchestration path that produces source-grounded changes and applies them with page-local reflow. The public browser experience contains only upload, refining progress, original/refined comparison and download.

**Tech Stack:** React 19, TypeScript, Vite, Express 5, Node test runner, DeepSeek/Kimi provider adapter, PyMuPDF, pdf.js/pdf-lib and Mammoth.

## Global Constraints

- No public JD, target-role, score, ATS, follow-up, account, payment or subscription prompt.
- No public AI branding, provider/model name or diagnostic report.
- Page count must match the source exactly.
- Images, avatar, background image, logo and icon position/size must match the source.
- Do not add bold, colour or other new emphasis styles.
- Text can only reflow inside existing page text regions; ungrounded facts are forbidden.
- An unsafe page is restored unchanged instead of being delivered broken.

---

### Task 1: Universal content contract and quality gate

**Files:**
- Modify: `src/types.ts`, `src/services/aiOptimize.ts`, `server/aiProvider.mjs`, `server/resumeOptimizationPrompts.mjs`, `server/resumeQualityGate.mjs`
- Test: `server/aiProvider.test.mjs`, `server/resumeOptimizationPrompts.test.mjs`, `server/resumeQualityGate.test.mjs`

**Interfaces:**
- Produce `UniversalRefinement = { text, changes, quality: { verdict: "ready" | "unchanged", checks }, safe }`.
- Browser entry point: `optimizeUniversalResume(resumeText: string): Promise<UniversalRefinement>`.
- Server gate: `evaluateUniversalRefinement({ sourceText, draft, changes })`.

- [ ] **Step 1: Write failing tests**

```js
test("universal refinement does not require a job description or target role", () => {
  assert.doesNotMatch(JSON.stringify(buildUniversalRefineMessages({ resumeText: "教育经历\n某大学" })), /JD|匹配度|评分/);
});
test("universal quality gate accepts substantive deletion and rewriting", () => {
  const result = evaluateUniversalRefinement({
    sourceText: "自我评价：本人认真负责\n实习：负责推文撰写和发布",
    draft: "实习经历\n- 负责公众号推文撰写与发布。",
    changes: [{ before: "自我评价：本人认真负责", after: "" }, { before: "负责推文撰写和发布", after: "负责公众号推文撰写与发布。" }]
  });
  assert.equal(result.passed, true);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test server/resumeOptimizationPrompts.test.mjs server/resumeQualityGate.test.mjs server/aiProvider.test.mjs`

Expected: FAIL because universal functions and contract do not exist.

- [ ] **Step 3: Implement minimal contract**

```ts
export type UniversalRefinement = {
  text: string;
  changes: Array<{ before: string; after: string }>;
  quality: { verdict: "ready" | "unchanged"; checks: string[] };
  safe: boolean;
};
export async function optimizeUniversalResume(resumeText: string) {
  return requestUniversalRefinement({ resumeText });
}
```

Implement a universal prompt that permits deletion, merging and rewriting only from source evidence. Reuse contact redaction and `findUnverifiedClaims`; reject zero meaningful changes and synonym-only edits.

- [ ] **Step 4: Verify passing tests**

Run: `node --test server/resumeOptimizationPrompts.test.mjs server/resumeQualityGate.test.mjs server/aiProvider.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/services/aiOptimize.ts server/aiProvider.mjs server/resumeOptimizationPrompts.mjs server/resumeQualityGate.mjs server/aiProvider.test.mjs server/resumeOptimizationPrompts.test.mjs server/resumeQualityGate.test.mjs
git commit -m "feat: add universal resume refinement contract"
```

### Task 2: Page-local PDF reflow with fidelity verification

**Files:**
- Modify: `server/pdfEditor.mjs`, `server/vendor/pymupdf_official_replace.py`
- Test: `server/pdfEditor.test.mjs`, `server/pdfFontkit.test.mjs`

**Interfaces:**
- Preserve `createEditedPdfVersions({ originalResumeFileUrl, text, changes, uploadDir })`.
- Extend its result with `unchangedPages: number[]` and `pageCountVerified: true`.
- Add Python `build_page_regions(page, changes)` and `can_commit_page(page, fixed_image_rects)`.

- [ ] **Step 1: Write failing tests**

```js
test("reflows text without changing page count or image geometry", async () => {
  const result = await createEditedPdfVersions({ originalResumeFileUrl, text: refined, changes, uploadDir });
  const output = await PdfLibDocument.load(await readFile(join(uploadDir, result.cleanOutputName)));
  assert.equal(output.getPageCount(), source.getPageCount());
  assert.deepEqual(imageRects(output), imageRects(source));
  assert.equal(result.pageCountVerified, true);
});
test("restores a page when reflow intersects an image", async () => {
  const result = await createEditedPdfVersions({ originalResumeFileUrl, text: oversized, changes, uploadDir });
  assert.deepEqual(result.unchangedPages, [0]);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test server/pdfEditor.test.mjs server/pdfFontkit.test.mjs`

Expected: FAIL because image-geometry and per-page rollback metadata do not exist.

- [ ] **Step 3: Implement reflow**

For each page, capture its pre-edit bytes and image rectangles. Union matched source text lines into disjoint text regions. Redact only source text in those regions and insert refined text using the source font size, normal weight and source colour. Expansion stops at the nearest source text, image rectangle or page boundary. Verify source page count, dimensions, all image rectangles, text extraction and no text/image intersection; restore the saved page and report its index when any check fails.

- [ ] **Step 4: Verify passing tests**

Run: `node --test server/pdfEditor.test.mjs server/pdfFontkit.test.mjs`

Expected: PASS, including wrapped-line and preservation tests.

- [ ] **Step 5: Commit**

```bash
git add server/pdfEditor.mjs server/vendor/pymupdf_official_replace.py server/pdfEditor.test.mjs server/pdfFontkit.test.mjs
git commit -m "feat: reflow refined text within source PDF pages"
```

### Task 3: Replace public flow with upload, refine and completion

**Files:**
- Modify: `src/App.tsx`, `src/types.ts`, `src/components/LandingView.tsx`, `src/components/HomeView.tsx`, `src/components/Header.tsx`, `src/components/EditorView.tsx`, `src/styles.css`
- Delete: `src/components/JobView.tsx`, `src/components/ReportView.tsx`, `src/components/FollowUpView.tsx`
- Test: `server/streamlinedFlow.test.mjs`, `server/publicDesign.test.mjs`, `server/mobileParity.test.mjs`

**Interfaces:**
- Public `WorkflowStep` is `"home" | "workspace" | "editor"`; existing admin/version routes remain internal.
- `HomeView` invokes `onRefine()`; `EditorView` displays original/refined tabs and download only.

- [ ] **Step 1: Write failing public-flow tests**

```js
test("public flow contains upload, refine and completion only", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /JobView|ReportView|FollowUpView|jobDescription/);
  assert.match(app, /view === "workspace"/);
  assert.match(app, /view === "editor"/);
});
test("public copy hides AI, scores, ATS, job and JD", async () => {
  assert.doesNotMatch(await readPublicComponents(), /AI|评分|ATS|岗位|JD/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test server/streamlinedFlow.test.mjs server/publicDesign.test.mjs server/mobileParity.test.mjs`

Expected: FAIL because role/JD/report/follow-up views remain wired.

- [ ] **Step 3: Implement the flow**

```tsx
const refineResume = async () => {
  if (!hasResume || generationInFlight.current) return;
  generationInFlight.current = true;
  setIsGenerating(true);
  try {
    const result = await optimizeUniversalResume(input.resumeText);
    setOptimized(result);
    setEditedText(result.text);
    go("editor");
  } finally {
    generationInFlight.current = false;
    setIsGenerating(false);
  }
};
```

Use the landing promise “上传旧简历，保留模板，整理成可投递版本”. Remove public samples, job input, report and questions. Completion displays original/refined tabs and neutral `已删减 / 已整理 / 已重写` change items with standard body typography.

- [ ] **Step 4: Verify build and focused tests**

Run: `npm run build; node --test server/streamlinedFlow.test.mjs server/publicDesign.test.mjs server/mobileParity.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/types.ts src/components/LandingView.tsx src/components/HomeView.tsx src/components/Header.tsx src/components/EditorView.tsx src/styles.css server/streamlinedFlow.test.mjs server/publicDesign.test.mjs server/mobileParity.test.mjs
git rm src/components/JobView.tsx src/components/ReportView.tsx src/components/FollowUpView.tsx
git commit -m "feat: simplify public flow to universal resume refining"
```

### Task 4: DOCX asset preservation and visible change proof

**Files:**
- Modify: `src/services/docxFileEditor.ts`, `src/services/changeExamples.ts`, `src/components/EditorView.tsx`
- Test: `server/changeExamples.test.mjs`, `server/streamlinedFlow.test.mjs`

**Interfaces:**
- `buildResumeChangeSet(before, after)` returns `{ before, after, kind: "deleted" | "rewritten" | "reordered" }[]`, including deletions.
- `applyTextToDocxPreview()` changes only text runs and rejects an output whose media or document-section ZIP entries differ from its source.

- [ ] **Step 1: Write failing tests**

```js
test("change set exposes deletion and rewrite", () => {
  assert.deepEqual(buildResumeChangeSet("自我评价：认真负责\n负责推文", "负责公众号推文撰写"), [
    { before: "自我评价：认真负责", after: "", kind: "deleted" },
    { before: "负责推文", after: "负责公众号推文撰写", kind: "rewritten" }
  ]);
});
test("DOCX refinement keeps media and section properties", async () => {
  const output = await applyTextToDocxPreview(fixtureWithImage, refinedText);
  assert.deepEqual(readDocxMedia(output), readDocxMedia(fixtureWithImage));
  assert.deepEqual(readDocxSectionProperties(output), readDocxSectionProperties(fixtureWithImage));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test server/changeExamples.test.mjs server/streamlinedFlow.test.mjs`

Expected: FAIL because deletion and DOCX fixed-asset invariants are absent.

- [ ] **Step 3: Implement the constraints**

Keep OOXML `word/media/*`, relationships, section properties and paragraph style IDs intact. Add deletion-aware semantic diffing before existing rewrite pairing. Render the returned changes beneath completion tabs without colour or bold text.

- [ ] **Step 4: Verify full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit and push only scoped files**

```bash
git add src/services/docxFileEditor.ts src/services/changeExamples.ts src/components/EditorView.tsx server/changeExamples.test.mjs server/streamlinedFlow.test.mjs
git commit -m "feat: preserve DOCX assets and show refining changes"
git push
```

### Task 5: Commercial release acceptance suite

**Files:**
- Create: `server/fixtures/universal-refining/README.md`, `server/universalRefiningAcceptance.test.mjs`
- Modify: `RELEASE_CHECKLIST.md`, `README.md`

- [ ] **Step 1: Add a failing fixture-driven acceptance test**

```js
for (const fixture of fixtures) {
  const result = await refineFixture(fixture);
  assert.equal(result.pageCount, fixture.expectedPageCount);
  assert.equal(result.imageCount, fixture.expectedImageCount);
  assert.ok(fixture.requiredChangeKinds.every((kind) => result.changeKinds.includes(kind)));
  assert.equal(result.unverifiedClaims.length, 0);
}
```

- [ ] **Step 2: Verify failure**

Run: `node --test server/universalRefiningAcceptance.test.mjs`

Expected: FAIL until fixtures and manifest data exist.

- [ ] **Step 3: Add synthetic fixtures and release rule**

Add non-personal one-page PDF with avatar, two-page PDF with logo, DOCX with image, and unsupported scanned PDF fixtures. Document that all supported fixtures must pass source-fidelity and meaningful-change checks; unsupported files must remain unchanged and show an actionable message.

- [ ] **Step 4: Verify release**

Run: `npm test; node --test server/universalRefiningAcceptance.test.mjs`

Expected: PASS, followed by visual inspection of every rendered fixture.

- [ ] **Step 5: Commit and push**

```bash
git add server/fixtures/universal-refining server/universalRefiningAcceptance.test.mjs RELEASE_CHECKLIST.md README.md
git commit -m "test: add universal refining release gate"
git push
```

## Self-review

- Tasks 1–4 cover every approved product constraint: no JD/score/AI UI, substantive source-grounded refining, fixed images, fixed page count, same-page text reflow, and visible before/after proof.
- Task 5 provides the repeatable evidence required before treating the release as commercial-ready.
- Payment, accounts, job-specific tailoring and reconstruction of scanned/encrypted PDFs remain explicitly out of scope.
