# Deployment-ready graduate flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the graduate resume flow deployable, truthful, and easy to complete on desktop and mobile.

**Architecture:** Retain the React/Vite and Express boundaries. Extract client-only helpers for creator sync state and real line-pair change examples so they can be unit-tested; leave persisted profile shape and API endpoint unchanged. Improve the existing views and CSS without changing resume-analysis evidence rules.

**Tech Stack:** React 19, TypeScript, Vite, Express 5, Node built-in test runner, Playwright CLI.

## Global Constraints

- LocalStorage remains the durable draft copy when remote sync is unavailable.
- Creator requests keep `X-Visitor-Id` and use `/api/creator/profile`.
- Samples and generated copy may not claim unverified experience or results.
- Preserve unrelated existing uncommitted workspace changes.

---

### Task 1: Creator sync status

**Files:**
- Create: `src/services/creatorSync.ts`
- Create: `src/services/creatorSync.test.mjs`
- Modify: `src/components/CreatorView.tsx`
- Test: `server/app.test.mjs`

**Interfaces:**
- Produces: `creatorSyncMessage(result: "synced" | "server-error" | "network-error"): string`.
- Consumes: `getApiBase()` and the existing profile JSON shape.

- [ ] **Step 1: Write the failing client and API tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { creatorSyncMessage } from "./creatorSync.ts";

test("creator sync keeps the local copy explicit after a server failure", () => {
  assert.match(creatorSyncMessage("server-error"), /仍保存在此设备/);
});
```

Add an API test that POSTs a creator profile then GETs it using the same visitor header and expects 201 followed by 200.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/services/creatorSync.test.mjs server/app.test.mjs`

Expected: FAIL because `creatorSync.ts` does not exist.

- [ ] **Step 3: Implement the minimal sync helper and UI retry**

```ts
export function creatorSyncMessage(result: "synced" | "server-error" | "network-error") {
  return result === "synced" ? "草稿已自动保存" : "同步未完成，内容仍保存在此设备";
}
```

In `CreatorView`, centralize the POST operation in a callback, map non-OK and rejected responses through the helper, and render a retry button only while remote sync failed.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `node --test src/services/creatorSync.test.mjs server/app.test.mjs`

Expected: PASS.

### Task 2: Graduate sample and evidence wizard

**Files:**
- Modify: `src/data/sampleCases.ts`
- Modify: `src/components/FollowUpView.tsx`
- Create: `src/services/followUpPager.ts`
- Create: `src/services/followUpPager.test.mjs`
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/LandingView.tsx`

**Interfaces:**
- Produces: `clampQuestionIndex(index: number, total: number): number`.
- Consumes: `FollowUpQuestion[]`, answers keyed by question id, and `SampleResumeCase`.

- [ ] **Step 1: Write failing pager tests**

```js
test("question pager never moves beyond the final question", () => {
  assert.equal(clampQuestionIndex(8, 3), 2);
});
test("question pager starts at zero for an empty question list", () => {
  assert.equal(clampQuestionIndex(0, 0), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/services/followUpPager.test.mjs`

Expected: FAIL because the pager module does not exist.

- [ ] **Step 3: Implement minimal graduate-focused UX**

```ts
export function clampQuestionIndex(index: number, total: number) {
  return total < 1 ? 0 : Math.max(0, Math.min(index, total - 1));
}
```

Add one `graduate-data-analyst` reference case before experienced cases, use it for the home and landing sample actions, and update copy to identify it as an 应届生课程项目参考。 Render only the active follow-up question with previous/next controls, unchanged answers, progress, and the existing draft-generation escape hatch.

- [ ] **Step 4: Run pager tests to verify they pass**

Run: `node --test src/services/followUpPager.test.mjs`

Expected: PASS.

### Task 3: Truthful change examples

**Files:**
- Create: `src/services/changeExamples.ts`
- Create: `src/services/changeExamples.test.mjs`
- Modify: `src/components/EditorView.tsx`

**Interfaces:**
- Produces: `buildChangeExamples(source: string, output: string): Array<{before: string; after: string; kind: "rewrite" | "reordered"}>`.
- Consumes: non-empty source and output resume lines.

- [ ] **Step 1: Write a failing pairing test**

```js
test("does not label adjacent reordered lines as a rewrite", () => {
  assert.deepEqual(buildChangeExamples("A\nB", "B\nA"), [{ before: "A", after: "A", kind: "reordered" }]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/services/changeExamples.test.mjs`

Expected: FAIL because the change-example module does not exist.

- [ ] **Step 3: Implement pairing and presentation**

Implement a deterministic line matcher: identical lines at a different index become `reordered`; only non-identical source/output pairs are `rewrite`. Replace the editor-local helper with the service result and render kind-specific labels and copy.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/services/changeExamples.test.mjs`

Expected: PASS.

### Task 4: Responsive and resource fixes

**Files:**
- Modify: `src/styles.css`
- Create: `public/favicon.svg`
- Modify: `index.html`

**Interfaces:**
- Produces: no-wrap creator actions at widths above the compact breakpoint and clear mobile call-to-action buttons.
- Consumes: existing creator and landing CSS class names.

- [ ] **Step 1: Add a failing static resource assertion**

Add a Node test that reads `index.html`, extracts the favicon link, and asserts the referenced file exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/services/staticAssets.test.mjs`

Expected: FAIL because the favicon link/file does not exist.

- [ ] **Step 3: Add minimal styles and favicon**

Add a compact creator breakpoint before 1024px that hides status text and changes actions to icon-sized/short labels without wrapping. At mobile width, style `.apple-actions` buttons as distinct primary and secondary pills. Add a monochrome SVG favicon and reference it in `index.html`.

- [ ] **Step 4: Run static test to verify it passes**

Run: `node --test src/services/staticAssets.test.mjs`

Expected: PASS.

### Task 5: Full verification and deployment handoff

**Files:**
- Modify: `DEPLOYMENT.md` only if its commands differ from verified commands.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Run browser smoke tests**

Start API and Vite services, use Playwright at desktop and 390px widths to verify creator sync, graduate sample, one-question evidence paging, CTA visibility, and no favicon/profile console errors.

- [ ] **Step 4: Review final diff and commit only task files**

Run: `git diff --check` and `git status --short`.

Stage only files changed by these tasks, commit with `fix: make graduate resume flow deployment-ready`, then report the exact deploy commands from `DEPLOYMENT.md`.
