# AI Refining Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the transient normal-loading toast with a persistent, honest AI refining progress state that prevents duplicate generation.

**Architecture:** `App.tsx` owns request lifecycle state and renders one global overlay. `JobView.tsx` receives the state for button semantics, while CSS supplies responsive and reduced-motion presentation without new dependencies.

**Tech Stack:** React, TypeScript, Vite, CSS, Node test runner.

## Global Constraints

- Keep the public workflow at exactly three stages.
- Do not change the AI request payload or backend API.
- Show elapsed time instead of a fabricated percentage.
- Keep fallback and validation messages in the existing toast.

---

### Task 1: Add the loading-state contract test

**Files:**
- Modify: `server/streamlinedFlow.test.mjs`

**Interfaces:**
- Consumes: source files `src/App.tsx` and `src/components/JobView.tsx`.
- Produces: a regression test that requires the persistent overlay copy, lifecycle state, and disabled buttons.

- [ ] **Step 1: Write the failing test** that asserts the new overlay copy exists, the old DeepSeek loading toast is absent, and `JobView` disables generation while `isGenerating` is true.
- [ ] **Step 2: Run test to verify it fails** with `node --test server/streamlinedFlow.test.mjs`.
- [ ] **Step 3: Do not alter production code until the failure is observed.**

### Task 2: Implement request lifecycle and overlay

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/JobView.tsx`
- Modify: `src/index.css`
- Test: `server/streamlinedFlow.test.mjs`

**Interfaces:**
- Consumes: `optimizeWithDeepSeek()` and the existing `runGeneration()` flow.
- Produces: `isGenerating: boolean`, an `AiRefiningOverlay` component, and `JobView`'s `isGenerating` prop.

- [ ] **Step 1: Add lifecycle state and a synchronous in-flight ref** so duplicate requests return before calling the AI service.
- [ ] **Step 2: Wrap the external AI request in `try/catch/finally`** so loading state always clears while existing fallback behavior remains intact.
- [ ] **Step 3: Render the overlay** with elapsed seconds, a 30–60 second expectation, and the long-wait message after 60 seconds.
- [ ] **Step 4: Pass `isGenerating` into `JobView`** and disable both generation buttons while changing their label to “AI 正在精修…”.
- [ ] **Step 5: Add responsive CSS and reduced-motion rules** for the overlay, spinner, and indeterminate progress bar.
- [ ] **Step 6: Run the focused test** with `node --test server/streamlinedFlow.test.mjs` and expect all tests to pass.

### Task 3: Verify and deploy the static frontend

**Files:**
- Verify: generated `dist/`
- Deploy: `/www/wwwroot/znhil-resume-app/dist`

**Interfaces:**
- Consumes: the passing production build.
- Produces: an atomically replaced static bundle while the production backend remains untouched.

- [ ] **Step 1: Run the full suite** with `npm test` and require a zero exit code.
- [ ] **Step 2: Test locally in a real browser** at desktop and 390×844, including start, elapsed-time visibility, completion, and console errors.
- [ ] **Step 3: Upload only `dist`** to a uniquely named staging path and verify its checksum and referenced assets.
- [ ] **Step 4: Atomically replace the production static directory** after creating a uniquely named backup; do not rebuild or restart the backend container.
- [ ] **Step 5: Verify the live website** through the same desktop/mobile checks plus `/api/health` and protected-site status checks.
