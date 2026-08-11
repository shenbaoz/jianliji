# Resume-Fit Security and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or equivalent task-by-task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the resume service at `/resume-fit/` without changing the root or `/leka-showcase/`, while addressing the identified MySQL, admin-data exposure, and PDF error issues.

**Architecture:** Keep the service as an isolated Node process bound to loopback and expose it only through an additive Nginx location for `/resume-fit/`. The API owns authentication: an environment-supplied administrator password creates an HttpOnly session cookie, and admin-only data endpoints require that session. Error responses remain safe for users but distinguish invalid/empty uploads from server failures.

**Tech Stack:** Node.js ESM, Express 5, mysql2, Vite/React, Baota Nginx, Node test runner.

## Global Constraints

- Do not modify the existing root or `/leka-showcase/` files, location rules, upstreams, or process definitions.
- Do not expose the Node service directly on a public port.
- Keep user resume-version APIs visitor-scoped.
- Never put the administrator password in frontend code, source control, logs, or client storage.

---

### Task 1: Regression-test and protect administrator data

**Files:**
- Create: `server/app.test.mjs`
- Modify: `server/app.mjs`
- Modify: `src/services/storage.ts`
- Modify: `src/components/AdminView.tsx`

- [ ] Write API tests proving health returns only `{ ok: true }`, public lead submission still works, and listing/deleting leads is rejected before login.
- [ ] Add a password login, opaque HttpOnly session cookie, logout endpoint, and an `requireAdmin` guard for administrative reads/deletes.
- [ ] Add an admin login state in the dashboard; request data only after a successful session check and include cookies in requests.
- [ ] Run `node --test server/app.test.mjs` and then the full suite.

### Task 2: Make parsing failures actionable and verifiable

**Files:**
- Modify: `server/app.mjs`
- Modify: `server/resumeParser.test.mjs`
- Modify: `src/services/resumeFileParser.ts`

- [ ] Add a failing regression assertion for parser errors returning a 422 client error rather than an opaque 500/502-class failure.
- [ ] Map expected parse and validation errors to 422 with a safe, actionable message; leave unexpected faults as generic 500 responses with server-side logging.
- [ ] Preserve the currently selected file and show the returned specific message in the upload UI.
- [ ] Run targeted parser/API tests and the full suite.

### Task 3: Build and deploy in an isolated route

**Files:**
- Modify: `server/index.mjs`
- Create: deployment files in the new server-only application directory.

- [ ] Bind the production process to `127.0.0.1` and retain the existing MySQL schema migration on startup.
- [ ] Build the static bundle and deploy it to a fresh, dedicated Baota directory.
- [ ] Add only an isolated `/resume-fit/` reverse-proxy/static location, with HTTPS if an existing certificate is configured; do not alter root or `/leka-showcase/` location blocks.
- [ ] Start the isolated service, probe `/resume-fit/` and its API, then verify root and `/leka-showcase/` still return their prior responses.
