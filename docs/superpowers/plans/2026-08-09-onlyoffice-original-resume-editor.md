# ONLYOFFICE Original Resume Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current AI optimization flow, but replace custom PDF text rewriting with the official ONLYOFFICE editor for uploaded originals.

**Architecture:** The Node API retains upload, AI, ownership, and persistence. Official ONLYOFFICE Document Server edits DOCX/PDF and calls back to the API after saving. The frontend embeds ONLYOFFICE and shows the AI output as a copyable review aid.

**Tech Stack:** React/Vite, Node/Express, Docker Compose, official `onlyoffice/documentserver` image.

## Global Constraints

- Preserve AI optimization and original-file ownership checks.
- Do not retain a custom PDF text rewrite path.
- Keep the ONLYOFFICE JWT secret server-side and validate callback authorization.
- Keep required ONLYOFFICE attribution and comply with AGPLv3.

---

### Task 1: Deploy official Document Server

**Files:** `deploy/docker-compose.onlyoffice.yml`, `.env.example`, `DEPLOYMENT.md`, `deploy/nginx-znhil.conf`, `server/productionConfig.mjs`, `server/productionConfig.test.mjs`

- [ ] Add a failing production-config test for an invalid ONLYOFFICE URL or JWT secret.
- [ ] Add the official `onlyoffice/documentserver` service with JWT and internal networking only.
- [ ] Document the `/onlyoffice/` reverse proxy and environment variables.
- [ ] Re-run `node --test server/productionConfig.test.mjs`.

### Task 2: Secure server integration

**Files:** `server/onlyoffice.mjs`, `server/onlyoffice.test.mjs`, `server/app.mjs`, `server/app.test.mjs`

- [ ] Add failing tests for owner-only editor sessions, invalid callbacks, and save callback registration.
- [ ] Add `POST /api/original-document/editor-session` returning a signed ONLYOFFICE configuration.
- [ ] Add the signed ONLYOFFICE save callback that downloads and registers the edited file for the current owner.
- [ ] Run the focused API tests.

### Task 3: Use the official browser editor

**Files:** `src/services/onlyoffice.ts`, `src/components/OriginalDocumentEditor.tsx`, `src/components/EditorView.tsx`, `server/streamlinedFlow.test.mjs`

- [ ] Add a failing test asserting uploaded DOCX/PDF use `OriginalDocumentEditor` and no longer use `createEditedPdfPreview`.
- [ ] Load ONLYOFFICE's official `api.js`, request the server editor session, and destroy the editor on unmount.
- [ ] Keep AI output in a copyable, editable review panel.
- [ ] Run the focused test and `npm run build`.

### Task 4: Remove the unsafe custom implementation

**Files:** `src/services/pdfFileEditor.ts`, `server/pdfEditor.mjs`, `server/pdfFontkit.mjs`, dependent tests, `server/app.mjs`, `package.json`, `package-lock.json`

- [ ] Add a failing test proving `/api/edit-pdf` is absent.
- [ ] Remove only the old PDF rewrite route and dependencies; retain PDF parsing for AI extraction.
- [ ] Run `npm test` and manually save a DOCX and a PDF through ONLYOFFICE in production.

## Review

The plan preserves existing AI behavior and replaces only the document editing component with upstream ONLYOFFICE code.
