# Evidence-Based Resume Tailoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce materially role-focused resume drafts while preserving factual truth and without adding mandatory user steps.

**Architecture:** The default existing-resume request will use a strategy-first pipeline. It first identifies evidence to lead with or condense, then writes a role-specific draft. A quality gate verifies both claim safety and whether selected evidence moved into prominent positions.

**Tech Stack:** Node.js ESM, Zod, node:test, React 19, TypeScript.

## Global Constraints

- Preserve companies, roles, dates, contact fields, and every factual claim from the source or a user answer.
- Never invent metrics, tools, skills, ownership, projects, or employment.
- Upload plus target role remains the only mandatory flow; JD and one high-value follow-up answer are optional.
- Existing-resume tailoring may reorder or condense content, but must not relabel campus, course, volunteer, or part-time work as formal employment.
- A safe but near-identical draft is a failed deep-tailoring result.

---

### Task 1: Add deterministic role-fit impact validation

**Files:**
- Create: `server/resumeTailoringQuality.mjs`
- Create: `server/resumeTailoringQuality.test.mjs`

**Interfaces:**
- Produces: `evaluateRoleFitImpact({ sourceText, draftText, strategy })` returning `{ passed, checks, highlights }`.
- Consumes: `strategy.priorityEvidence`, `strategy.deprioritizedEvidence`, and `strategy.highlights` arrays.
- Used by: `evaluateResumeQuality` in Task 2.

- [ ] **Step 1: Write the failing test**

```js
test("requires priority evidence to move into the opening half", () => {
  const result = evaluateRoleFitImpact({
    sourceText: "教育\n技能\n门店推广\n小红书运营：输出 150+ 篇内容",
    draftText: "教育\n技能\n门店推广\n小红书运营：输出 150+ 篇内容",
    strategy: { priorityEvidence: ["小红书运营：输出 150+ 篇内容"], highlights: ["前置内容运营证据"] }
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => item.includes("未前置")));
});

test("accepts priority evidence at the top of the result", () => {
  const result = evaluateRoleFitImpact({
    sourceText: "教育\n门店推广\n小红书运营：输出 150+ 篇内容",
    draftText: "核心优势\n小红书运营：输出 150+ 篇内容\n教育\n门店推广",
    strategy: { priorityEvidence: ["小红书运营：输出 150+ 篇内容"], highlights: ["前置内容运营证据"] }
  });
  assert.equal(result.passed, true);
});
```

- [ ] **Step 2: Run it and verify failure**

Run: `node --test server/resumeTailoringQuality.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the smallest validator**

```js
export function evaluateRoleFitImpact({ sourceText, draftText, strategy = {} }) {
  const draft = normalize(draftText);
  const checks = (strategy.priorityEvidence || []).flatMap((item) => {
    const position = draft.indexOf(normalize(item));
    return position >= 0 && position / Math.max(1, draft.length) > 0.5
      ? [`岗位优先证据未前置：${item}`] : [];
  });
  return { passed: checks.length === 0, checks, highlights: (strategy.highlights || []).slice(0, 3) };
}
function normalize(value) { return String(value || "").replace(/[\s，。；、:：|｜\-•·]/g, ""); }
```

- [ ] **Step 4: Run it and verify success**

Run: `node --test server/resumeTailoringQuality.test.mjs`

Expected: PASS with two tests.

- [ ] **Step 5: Commit**

Run: `git add server/resumeTailoringQuality.mjs server/resumeTailoringQuality.test.mjs && git commit -m "test: define role-fit tailoring quality gate"`

### Task 2: Make strategy-first tailoring the default existing-resume path

**Files:**
- Modify: `server/resumeOptimizationPrompts.mjs`
- Modify: `server/aiProvider.mjs`
- Modify: `server/resumeQualityGate.mjs`
- Modify: `server/aiProvider.test.mjs`

**Interfaces:**
- Consumes: `evaluateRoleFitImpact` from Task 1.
- Produces: optimize response field `highlights: string[]`; a safe but unchanged role ordering returns `quality.verdict === "needs_evidence"`.

- [ ] **Step 1: Write the failing pipeline tests**

```js
test("uses strategy-first drafting for an existing resume", async () => {
  const result = await client.optimize({
    resumeText: "教育\n门店推广\n小红书运营：输出 150+ 篇内容",
    targetRole: "新媒体运营", sourceMode: "resume"
  });
  assert.equal(requests.length, 3);
  assert.match(requests[0].messages[0].content, /priorityEvidence/);
  assert.doesNotMatch(requests[0].messages[0].content, /JSON Patch/);
  assert.deepEqual(result.highlights, ["前置小红书内容运营证据"]);
});

test("rejects a safe but unchanged role ordering", () => {
  const quality = evaluateResumeQuality({
    sourceText: "教育\n门店推广\n小红书运营：输出 150+ 篇内容",
    draft: "教育\n门店推广\n小红书运营：输出 150+ 篇内容",
    targetRole: "新媒体运营", sourceMode: "resume",
    strategy: { priorityEvidence: ["小红书运营：输出 150+ 篇内容"], highlights: [] },
    qa: { verdict: "ready", score: 90 }
  });
  assert.equal(quality.passed, false);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test server/aiProvider.test.mjs server/resumeQualityGate.test.mjs`

Expected: FAIL because the existing-resume route enters the JSON-patch shortcut and the quality gate ignores strategy.

- [ ] **Step 3: Implement the pipeline**

1. Extend the strategy JSON with `priorityEvidence`, `deprioritizedEvidence`, and `highlights`.
2. Change existing-resume instructions to preserve factual employer/role/date data while permitting bullet reordering, evidence-led core-summary content, and concise peripheral bullets.
3. Remove the unconditional `tryApplyReactiveResumePatch` call for `sourceMode === "resume"`; reserve it for a future explicit fast-refine mode.
4. Pass `strategy` into `evaluateResumeQuality`, append role-fit checks from Task 1, and return its highlights.
5. Do not award a positive quality score when role-fit checks fail.

- [ ] **Step 4: Run focused tests and verify success**

Run: `node --test server/aiProvider.test.mjs server/resumeQualityGate.test.mjs server/resumeTailoringQuality.test.mjs`

Expected: PASS; existing-resume optimization makes strategy, draft, and QA calls, and unchanged ordering fails.

- [ ] **Step 5: Commit**

Run: `git add server/resumeOptimizationPrompts.mjs server/aiProvider.mjs server/resumeQualityGate.mjs server/aiProvider.test.mjs server/resumeTailoringQuality.mjs server/resumeTailoringQuality.test.mjs && git commit -m "feat: tailor resume content by role evidence"`

### Task 3: Display concise proof of the optimization without a new step

**Files:**
- Modify: `src/services/aiOptimize.ts`
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `src/components/EditorView.tsx`
- Modify: `src/styles.css`
- Test: `server/app.test.mjs`

**Interfaces:**
- Consumes: API `highlights?: string[]` from Task 2.
- Produces: `SavedResumeVersion.highlights: string[]` and an editor summary headed `本次优化重点`.

- [ ] **Step 1: Write the failing response and render tests**

```js
test("returns three or fewer tailoring highlights", async () => {
  const response = await optimizeRequest({ resumeText: "内容运营", targetRole: "新媒体运营" });
  assert.deepEqual(response.body.highlights, ["前置内容运营证据", "压缩低相关经历", "保留真实数据"]);
});
```

Add a component assertion that `EditorView` renders `本次优化重点` only when `highlights.length > 0`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test server/app.test.mjs`

Expected: FAIL because the optimize response and saved version have no highlights field.

- [ ] **Step 3: Implement the minimal display**

1. Add `highlights?: string[]` to the API response and `SavedResumeVersion`.
2. Carry the array through `optimizeWithDeepSeek`, `App.refine`, and the editor version object.
3. Render at most three non-interactive summary lines above the editor; do not add a wizard, modal, or required form.
4. Add responsive spacing and typography in `src/styles.css`.

- [ ] **Step 4: Verify the complete change**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Run the two real-resume benchmarks**

```text
杜小艳 + 新媒体运营：opening half includes Xiaohongshu or public-account evidence and one of 150+/50+/300+; generic self-evaluation is not promoted.
沈保自 + 信息流广告投放：opening half retains account-management, CPA, or cold-start evidence; no unsupported claim appears.
```

Expected: the first result is visibly reprioritized; the second is preserved unless the target role changes.

- [ ] **Step 6: Commit**

Run: `git add src/services/aiOptimize.ts src/App.tsx src/types.ts src/components/EditorView.tsx src/styles.css server/app.test.mjs && git commit -m "feat: show resume tailoring highlights"`
