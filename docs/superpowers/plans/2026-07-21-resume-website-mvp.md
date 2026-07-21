# Resume Website MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first publishable local website for 一岗一简历, with a complete front-end workflow for job-specific resume optimization and no live WeChat Pay integration.

**Architecture:** Create a Vite + React + TypeScript single-page app that can be opened in VS Code and run locally. Use local browser state for the first pass so the product flow is visible immediately, while keeping service modules separated for future backend, AI, database, and payment integration.

**Tech Stack:** Vite, React, TypeScript, CSS modules/plain CSS, localStorage, browser File APIs.

## Global Constraints

- Build as a normal website codebase that opens directly in VS Code.
- Do not integrate real WeChat Pay in this implementation pass.
- Keep payment/order boundaries clean for future WeChat Pay integration.
- The system must not invent user achievements; demo AI behavior must be labelled as prototype logic.
- Prioritize PDF export over Word export for the first release.
- Keep the first implementation focused on a working product workflow, not a marketing landing page.

---

## File Structure

- `package.json`: npm scripts and dependencies.
- `index.html`: Vite HTML entry.
- `vite.config.ts`: Vite config.
- `tsconfig.json`: TypeScript config.
- `src/main.tsx`: React entry.
- `src/App.tsx`: Main workflow shell and route state.
- `src/styles.css`: App styling.
- `src/types.ts`: Shared product types.
- `src/data/templates.ts`: Resume template metadata.
- `src/services/resumeAnalyzer.ts`: Prototype JD/resume analysis logic.
- `src/services/storage.ts`: Local version persistence.
- `src/components/Header.tsx`: Top navigation.
- `src/components/WorkflowStepper.tsx`: Current workflow indicator.
- `src/components/HomeView.tsx`: Start screen with resume and JD inputs.
- `src/components/ReportView.tsx`: Job match and resume diagnosis.
- `src/components/FollowUpView.tsx`: AI follow-up questions.
- `src/components/ResultView.tsx`: Before/after and optimized resume.
- `src/components/EditorView.tsx`: Editable resume preview and template selection.
- `src/components/ProfileView.tsx`: Saved versions.
- `src/components/AdminView.tsx`: Internal admin preview.

---

### Task 1: Scaffold The Website

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Produces: A Vite React app runnable with `npm install` and `npm run dev`.

- [ ] **Step 1: Create Vite React project files**

Create the base app files listed above.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies install successfully and `package-lock.json` is created.

- [ ] **Step 3: Run development server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite starts and prints a local URL.

- [ ] **Step 4: Commit**

Run:

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json src
git commit -m "feat: scaffold resume website"
```

---

### Task 2: Build The Main Product Workflow

**Files:**
- Create: `src/types.ts`
- Create: `src/components/Header.tsx`
- Create: `src/components/WorkflowStepper.tsx`
- Create: `src/components/HomeView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `ResumeInput`, `JobInput`, `WorkflowStep` types.
- Produces: user can paste resume text and job description, then move to the report screen.

- [ ] **Step 1: Add shared types**

Define resume input, job input, report, follow-up question, optimized resume, saved version, and template types.

- [ ] **Step 2: Add header and stepper components**

Build navigation for workflow steps: start, report, follow-up, result, editor, saved, admin.

- [ ] **Step 3: Add home input screen**

Build form fields for resume text, job description, target role, and optional file upload.

- [ ] **Step 4: Wire App state**

Store current step, resume text, job description, analysis report, follow-up answers, optimized resume, and selected template.

- [ ] **Step 5: Verify in browser**

Run: `npm run dev -- --host 127.0.0.1`

Expected: user can enter resume/JD and proceed to report placeholder without errors.

- [ ] **Step 6: Commit**

Run:

```bash
git add src
git commit -m "feat: add resume workflow shell"
```

---

### Task 3: Add Prototype Resume Analysis

**Files:**
- Create: `src/services/resumeAnalyzer.ts`
- Create: `src/components/ReportView.tsx`
- Create: `src/components/FollowUpView.tsx`
- Create: `src/components/ResultView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `ResumeInput`, `JobInput`.
- Produces: `analyzeResume(resumeText: string, jobDescription: string): AnalysisReport`.
- Produces: `generateFollowUpQuestions(report: AnalysisReport): FollowUpQuestion[]`.
- Produces: `generateOptimizedResume(args): OptimizedResume`.

- [ ] **Step 1: Add prototype analyzer service**

Implement deterministic keyword and structure analysis. Mark the output as prototype logic.

- [ ] **Step 2: Add report view**

Display match score, matched keywords, missing keywords, strengths, issues, and suggested fixes.

- [ ] **Step 3: Add follow-up view**

Show targeted questions and collect answers.

- [ ] **Step 4: Add result view**

Show original snippets, optimized snippets, and final resume draft.

- [ ] **Step 5: Verify workflow**

Run: `npm run dev -- --host 127.0.0.1`

Expected: resume + JD input creates a report, follow-up questions, and an optimized result.

- [ ] **Step 6: Commit**

Run:

```bash
git add src
git commit -m "feat: add prototype resume analysis flow"
```

---

### Task 4: Add Editor, Templates, And Saved Versions

**Files:**
- Create: `src/data/templates.ts`
- Create: `src/services/storage.ts`
- Create: `src/components/EditorView.tsx`
- Create: `src/components/ProfileView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `resumeTemplates`.
- Produces: `saveVersion(version: SavedResumeVersion): void`.
- Produces: `loadVersions(): SavedResumeVersion[]`.

- [ ] **Step 1: Add template data**

Create template metadata for fresh graduate, career change, internet operations, product manager, software engineer, marketing, finance, public sector, simple one-page, and business professional.

- [ ] **Step 2: Add local storage service**

Implement save/load/delete for resume versions in localStorage.

- [ ] **Step 3: Add editor view**

Allow users to edit the final resume text, choose a template, preview, save version, and print/export through browser print.

- [ ] **Step 4: Add profile view**

Show saved resume versions and allow loading a saved version.

- [ ] **Step 5: Verify persistence**

Run: `npm run dev -- --host 127.0.0.1`

Expected: saved versions remain after refresh.

- [ ] **Step 6: Commit**

Run:

```bash
git add src
git commit -m "feat: add resume editor and saved versions"
```

---

### Task 5: Add Admin Preview And Polish

**Files:**
- Create: `src/components/AdminView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: saved versions from localStorage.
- Produces: internal admin preview for users/orders/resume records placeholders.

- [ ] **Step 1: Add admin preview**

Display internal statistics based on local saved versions and static future payment placeholders.

- [ ] **Step 2: Add no-payment pricing panel**

Show that WeChat Pay is not connected yet and export/payment gates are placeholders.

- [ ] **Step 3: Polish responsive styling**

Verify the app on desktop and mobile widths, making sure controls do not overlap.

- [ ] **Step 4: Add README**

Document how to open in VS Code, install dependencies, run locally, and where the main files live.

- [ ] **Step 5: Final verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: all screens can be reached and no console-blocking runtime errors appear.

- [ ] **Step 6: Commit**

Run:

```bash
git add README.md src
git commit -m "feat: add admin preview and docs"
```

---

## Self-Review

- Spec coverage: The plan covers local VS Code workflow, resume import, JD input, report, AI-style follow-up, optimized resume, before/after comparison, templates, editor, version management, admin preview, and deferred WeChat Pay.
- Known gap: Real backend, real AI API, real authentication, real payment, PDF rendering service, Word export, and production hosting are intentionally deferred to later implementation plans after the local MVP is visible.
- Placeholder scan: No task relies on undefined future code for the local MVP.
- Type consistency: Shared types are defined in Task 2 and consumed by later service/component tasks.
