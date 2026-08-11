# Three-Step AI Home Production Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a three-step AI resume flow and a larger production landing hero to znhil.xyz.

**Architecture:** Keep the existing React routing and independent version-history route. Derive the visible progress rail from the three primary stages only, update the landing presentation through scoped CSS, and preserve the existing AI fallback path.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, Express, Nginx, PM2.

## Global Constraints

- The visible workflow is exactly: 导入简历 → 求职方向 → AI 生成简历.
- History remains accessible but is not a workflow stage.
- The default flow never visits the analysis or evidence-question pages.
- Deployment only updates `/www/wwwroot/znhil-resume-app`.

---

### Task 1: Lock the three-step contract

**Files:**
- Modify: `server/streamlinedFlow.test.mjs`
- Modify: `src/components/ProductShell.tsx`

**Interfaces:**
- Consumes: `WorkflowStep` and `WorkflowRail`.
- Produces: a three-item `workflowStages` array used by desktop and mobile progress UI.

- [ ] Add a regression assertion that the rendered stage model has three primary entries, excludes `versions`, and labels the final entry “AI 生成简历”.
- [ ] Run `node --test server/streamlinedFlow.test.mjs` and confirm it fails on the old four-stage model.
- [ ] Remove history from `workflowStages`, rename the final stage, and keep history navigation independent.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Enlarge the landing first viewport

**Files:**
- Modify: `server/publicDesign.test.mjs`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.public-editorial-shell .editorial-*` selectors.
- Produces: viewport-filling desktop and responsive mobile landing geometry.

- [ ] Add regression assertions for viewport-based hero height, enlarged desktop title, and larger action controls.
- [ ] Run `node --test server/publicDesign.test.mjs` and confirm it fails on the old fixed 520px hero.
- [ ] Update the scoped landing CSS without changing visible copy or adding sections.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Verify, deploy, and smoke-test production

**Files:**
- Modify only the verified files from Tasks 1 and 2 plus their tests and docs.

**Interfaces:**
- Consumes: `npm test`, the existing production bundle, PM2 service `znhil-resume-api`, and `https://znhil.xyz`.
- Produces: verified production static assets and a healthy existing API process.

- [ ] Run `npm test` and confirm build plus all Node tests pass.
- [ ] Start the local app, verify desktop and mobile landing layouts, and exercise “开始生成”.
- [ ] Create a rollback copy of the remote `dist`, deploy the verified bundle, and reload the existing API only if server code changed.
- [ ] Verify production page identity, three-step UI, console health, `/api/health`, and one non-sensitive AI generation request.
