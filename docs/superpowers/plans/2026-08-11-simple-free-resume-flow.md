# Simple Free Resume Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free no-JD flow that generates a first resume for novices and optimizes existing resumes.

**Architecture:** Add a compact two-path entry component. Existing-resume users provide content and one target direction; novice users provide a direction and a factual free-text description. Both map to the existing fact-safe AI pipeline and common editor.

**Tech Stack:** React 19, TypeScript, Vite, Express, Node test runner, existing DeepSeek/Kimi integration.

## Constraints

- No login, payment, JD, download limit, or template lock.
- Never fabricate facts.
- Blank existing-resume direction becomes `通用求职版`.
- Sparse information returns an actionable one-question prompt rather than a generic rejection.

### Task 1: No-JD AI contract

**Files:** `server/app.mjs`, `server/app.test.mjs`, `src/services/aiOptimize.ts`

- [ ] Add a failing route test posting a resume, a target direction, and no JD; require HTTP 200 and an AI response.
- [ ] Run that exact test and confirm it fails for the intended contract gap.
- [ ] Normalize blank `targetRole` to `通用求职版`; retain fact-safe `resume` and `creator` pipelines.
- [ ] Run the focused test and all server tests.
- [ ] Commit the task.

### Task 2: Compact user entry

**Files:** `src/components/ResumeStartView.tsx`, `src/App.tsx`, `src/types.ts`, `server/streamlinedFlow.test.mjs`

- [ ] Write failing source-contract tests for two paths labelled “我有简历，帮我优化” and “我是小白，从零开始”, with no JD label.
- [ ] Run the tests and confirm their expected failure.
- [ ] Implement the chooser and compact forms: existing resume accepts file/text plus direction; novice accepts direction plus factual free text.
- [ ] Map novice data to `sourceMode: 'creator'`; map existing data to `sourceMode: 'resume'`; send both through `optimizeWithDeepSeek`.
- [ ] Run UI contract tests and `npm run build`.
- [ ] Commit the task.

### Task 3: Useful sparse-result behavior

**Files:** `server/resumeOptimizationPrompts.mjs`, `server/resumeQualityGate.mjs`, respective test files

- [ ] Write failing tests that a sparse factual creator input remains fact-safe and returns one/two short evidence questions.
- [ ] Run the focused tests and confirm expected failure.
- [ ] Add the safe fallback and user-facing actionable copy without weakening fabricated-claim detection.
- [ ] Run `npm test`.
- [ ] Commit the task.

### Task 4: Release verification

**Files:** `DEPLOY-NOW.md`

- [ ] Add manual acceptance checks for both free paths.
- [ ] Run `npm test` and build a release archive.
- [ ] Deploy with the proven staging-and-rollback script.
- [ ] Verify public home and `/api/health` return HTTP 200.

