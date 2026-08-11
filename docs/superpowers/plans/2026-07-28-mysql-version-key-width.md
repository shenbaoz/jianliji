# MySQL Version Key Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow UUID-scoped resume versions to save to Baota-managed MySQL or MariaDB without primary-key truncation.

**Architecture:** The server keeps its existing `<visitorId>:<versionId>` isolation key. The database column is widened to 128 characters for new installations, and startup runs an idempotent `ALTER TABLE ... MODIFY COLUMN` for existing installations.

**Tech Stack:** Node.js ESM, mysql2, Node test runner, MySQL/MariaDB.

## Global Constraints

- Preserve existing version API responses and visitor isolation.
- Do not change unrelated storage, UI, or resume-analysis behavior.
- Verify the regression with a real store contract test before and after the implementation.

---

### Task 1: Make the schema handle UUID-scoped keys

**Files:**
- Modify: `server/versionStore.test.mjs`
- Modify: `server/versionStore.mjs`

**Interfaces:**
- Consumes: `createVersionStore(db)`.
- Produces: `save(version, visitorId)` succeeds with 36-character UUID values and `ensureSchema()` upgrades existing databases.

- [ ] **Step 1: Write the failing test**

Add a test using 36-character visitor and version UUIDs, with the test database emulating an existing 64-character `id` column. Assert that `ensureSchema()` upgrades the column and that `save()` then persists and lists the version.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/versionStore.test.mjs`

Expected: the UUID-scoped key exceeds 64 characters because no width migration has run.

- [ ] **Step 3: Write minimal implementation**

Create fresh tables with `id VARCHAR(128)` and add an idempotent `ALTER TABLE resume_versions MODIFY COLUMN id VARCHAR(128) NOT NULL` migration during schema initialization.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/versionStore.test.mjs`

Expected: all version-store tests pass.

- [ ] **Step 5: Run full verification**

Run: `npm test` and `npm run build`.

Expected: all tests pass and TypeScript/Vite production build exits successfully.
