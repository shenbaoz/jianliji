# Public Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle every public resume workflow page to the approved Octolane-reference editorial canvas, with a reduced-motion-safe ambient light band and default AI generation.

**Architecture:** Keep existing React routes, workflow handlers, AI generation rules, storage, and administrator screens. Add public-only style tokens and visual wrappers; remove only public AI consent controls. The redesign is CSS-led so all workflow pages share one visual language without changing the optimization algorithm.

**Tech Stack:** React 19, TypeScript, Vite, CSS, Node built-in test runner.

## Tasks

### Task 1: Establish public visual-contract tests

Files: `server/publicDesign.test.mjs` (new), `server/mobileParity.test.mjs` (modify).

1. Write source-level assertions for the public root classes, static motion preference rule, and absence of user consent checkboxes.
2. Run `node --test server/publicDesign.test.mjs` and observe failure before the public code changes.
3. Keep the assertions focused on visible contract markers, not implementation details.

### Task 2: Make AI generation direct

Files: `src/App.tsx`, `src/components/CreatorView.tsx`, `src/components/JobView.tsx`.

1. Set the generation path to external AI by default.
2. Remove public consent props, checkbox JSX, and consent-only validation while retaining existing input validation.
3. Run focused public-design tests and TypeScript build.

### Task 3: Apply the reference canvas to every public workflow page

Files: `src/App.tsx`, `src/components/LandingView.tsx`, `src/components/HomeView.tsx`, `src/components/JobView.tsx`, `src/components/CreatorView.tsx`, `src/components/ReportView.tsx`, `src/components/FollowUpView.tsx`, `src/components/EditorView.tsx`, `src/components/ProfileView.tsx`, `src/styles.css`.

1. Add one public-page shell and use a shared editorial canvas class on public page sections.
2. Preserve all existing actions and data fields while reducing visible copy to short, direct Chinese guidance.
3. Add one animated spectral band and a `prefers-reduced-motion` static fallback.
4. Do not alter `AdminView.tsx` or `src/services/resumeAnalyzer.ts`.

### Task 4: Verify and deploy

Files: public UI files and deployment artifacts only.

1. Run `npm test` and inspect the changed-file diff for unwanted algorithm or admin changes.
2. Build production assets and preview desktop and mobile public routes.
3. Deploy only after successful checks, using the existing 宝塔 production configuration and health-check the deployed site.
