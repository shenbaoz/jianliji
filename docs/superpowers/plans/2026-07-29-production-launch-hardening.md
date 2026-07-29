# 简历记生产上线收口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复三轮审查和两份真实简历验收发现的安全、质量、管理、移动端与性能问题，交付可隔离部署到 `/resume-fit/` 的生产版本。

**Architecture:** 保留 React/Vite 前端与 Express/MySQL 后端。把文件鉴权、AI 出站脱敏、版本管理和文本规范化拆成可独立测试的服务边界；管理接口只通过 HttpOnly 会话访问全站数据，普通接口保持访客隔离。

**Tech Stack:** React 19、TypeScript、Vite 6、Express 5、MySQL、Node.js 内置测试、Playwright、Nginx。

## Global Constraints

- 不修改服务器根站和 `/leka-showcase/` 的文件、Nginx location、上游或进程。
- 不在前端、日志、仓库或构建产物中保存管理密码、数据库密码或模型密钥。
- 普通版本接口继续按访客隔离，只有受保护的管理接口可以读取全站数据。
- 两份真实简历不得出现残句、未命名、证据漏判或虚假修改对比。
- 每项行为修改先观察回归测试按预期失败，再写最小实现。
- 保留并绕开与本轮无关的用户未提交改动。

---

### Task 1: 统一 AI 出站脱敏和成本边界

**Files:**
- Modify: `server/aiProvider.mjs`
- Modify: `server/aiProvider.test.mjs`
- Modify: `server/app.mjs`
- Modify: `server/app.test.mjs`
- Modify: `src/components/DataPrivacyView.tsx`
- Modify: `src/components/JobView.tsx`

**Interfaces:**
- Produces: `redactAiPayload({ resumeText, targetRole, jobDescription, evidenceAnswers }): { payload, replacements }`
- Produces: `restoreAiOutput(text, replacements): string`
- Consumes: `AI_TIMEOUT_MS`, `AI_RATE_LIMIT_MAX` and the existing primary/fallback AI clients.

- [ ] **Step 1: Add failing redaction regressions**

Add tests that send `张三`, a mainland ID number, a detailed street address, phone, email and the same data inside `evidenceAnswers`. Assert that the fake provider receives none of them while the returned draft can restore only phone/email placeholders that originated in the resume.

```js
test("redacts identity and evidence answers from the complete AI payload", async () => {
  const seen = [];
  const client = createDeepSeekClient({
    apiKey: "test",
    fetchImpl: async (_url, init) => {
      seen.push(init.body);
      return jsonResponse({ choices: [{ message: { content: "安全草稿" } }] });
    },
  });
  await client.optimize({
    resumeText: "张三 110101199001011234 13800138000 zhang@example.com",
    targetRole: "运营",
    jobDescription: "北京市朝阳区建国路88号",
    evidenceAnswers: ["联系人张三，电话13800138000"],
  });
  assert.doesNotMatch(seen[0], /张三|110101199001011234|13800138000|zhang@example\.com|建国路88号/);
});
```

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/aiProvider.test.mjs server/app.test.mjs`

Expected: FAIL because names, IDs, addresses or evidence answers remain in the provider request and the AI route has no dedicated limiter/timeout assertion.

- [ ] **Step 3: Implement one outbound privacy boundary**

Create a single payload redactor used immediately before every provider request. Detect the candidate name from the first short resume lines, redact mainland IDs and address-like strings, and apply contact redaction to every string field and evidence answer. Keep school/company/project evidence unchanged and update the privacy copy to say so accurately.

Add a dedicated limiter to `/api/ai/optimize`, cap string lengths and evidence count, pass an `AbortSignal.timeout()` signal to provider fetches, and classify timeout/429/5xx as temporary failures eligible for the existing fallback.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/aiProvider.test.mjs server/app.test.mjs`

Expected: PASS.

Commit only Task 1 files with: `fix: protect AI privacy and request cost`

### Task 2: 验证真实文件类型并保护上传文件

**Files:**
- Modify: `server/resumeParser.mjs`
- Modify: `server/resumeParser.test.mjs`
- Modify: `server/app.mjs`
- Modify: `server/app.test.mjs`
- Modify: `server/pdfEditor.mjs`
- Modify: `server/pdfEditor.test.mjs`
- Modify: `src/services/resumeFileParser.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `detectResumeFileType(buffer): "pdf" | "docx" | "txt" | null`
- Produces: authenticated `GET /api/resume-files/:name`
- Consumes: validated visitor ID and server-generated stored filename.

- [ ] **Step 1: Add failing magic-byte and ownership tests**

Test that an HTML/SVG buffer named `.txt` with `application/octet-stream` is rejected, valid PDF begins `%PDF-`, valid DOCX is a ZIP containing `[Content_Types].xml` and `word/document.xml`, and UTF-8 text rejects NUL/control-heavy binary data.

In `server/app.test.mjs`, upload as visitor A, then assert anonymous and visitor B file reads return 401/404 while visitor A receives the file with `no-store`, attachment and `nosniff` headers.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/resumeParser.test.mjs server/app.test.mjs server/pdfEditor.test.mjs`

Expected: FAIL because extension/MIME can be spoofed and the file route is currently anonymous.

- [ ] **Step 3: Implement detection and ownership metadata**

Validate the in-memory upload before writing. Save with a random server-generated basename and fixed detected extension. Persist file owner metadata next to the stored file or through the injected file registry used by tests. Replace the anonymous send route with visitor ownership validation and safe response headers. Make PDF editing resolve only owned stored files.

Add `data/uploads/` and generated metadata to `.gitignore`; do not delete existing user files during implementation.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/resumeParser.test.mjs server/app.test.mjs server/pdfEditor.test.mjs`

Expected: PASS.

Commit only Task 2 files with: `fix: secure uploaded resume files`

### Task 3: 管理员全站版本、访客清除和容量上限

**Files:**
- Modify: `server/versionStore.mjs`
- Modify: `server/versionStore.test.mjs`
- Modify: `server/fileVersionStore.mjs`
- Modify: `server/fileVersionStore.test.mjs`
- Modify: `server/app.mjs`
- Modify: `server/app.test.mjs`
- Modify: `src/services/storage.ts`
- Modify: `src/components/AdminView.tsx`
- Modify: `src/components/DataPrivacyView.tsx`

**Interfaces:**
- Produces: `versionStore.listAll(limit, offset)`, `versionStore.deleteAny(id)`, `versionStore.deleteAll(visitorId)`.
- Produces: protected `/api/admin/versions`, `/api/admin/versions/:id` and visitor `/api/versions` bulk delete.
- Consumes: existing administrator session and `VERSION_LIMIT_PER_VISITOR` defaulting to 20.

- [ ] **Step 1: Add failing store and route tests**

Save versions for two visitors. Assert ordinary listing returns one visitor only, authenticated admin listing returns both, unauthenticated admin calls return 401, and an admin can delete either visitor's version.

Save 21 versions for one visitor and assert only the newest 20 remain. Bulk-delete one visitor and assert the other visitor is untouched.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/versionStore.test.mjs server/fileVersionStore.test.mjs server/app.test.mjs`

Expected: FAIL because admin listing reuses visitor data, bulk delete is missing and old versions are retained.

- [ ] **Step 3: Implement store and API boundaries**

Add explicit all-visitor methods to both MySQL and file stores. Enforce the per-visitor cap after writes. Add administrator-only routes and make `AdminView` use them with `credentials: "include"`. Make the privacy page call visitor bulk delete and report partial file-cleanup failures without claiming success.

Set the admin Cookie path to `/` in development and `/resume-fit/` in production; set `Secure` only for production HTTPS.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/versionStore.test.mjs server/fileVersionStore.test.mjs server/app.test.mjs`

Expected: PASS.

Commit only Task 3 files with: `fix: separate admin and visitor resume data`

### Task 4: 修复真实 PDF 文本、姓名和岗位证据判断

**Files:**
- Modify: `server/resumeParser.mjs`
- Modify: `server/resumeParser.test.mjs`
- Modify: `src/services/resumeAnalyzer.ts`
- Modify: `server/resumeAnalyzerBehavior.test.mjs`
- Modify: `server/graduateFlow.test.mjs`
- Modify: `src/services/changeExamples.ts`

**Interfaces:**
- Produces: `normalizeResumeText(text): string`
- Produces: `extractCandidateName(text): string`
- Consumes: normalized resume text in requirement extraction, matching and local safe-draft generation.

- [ ] **Step 1: Add failing regressions from both real resumes**

Create minimal anonymized fixtures reproducing: a Chinese phrase split across PDF lines, a short name at the top, “岗位职责” followed by bullets, explicit skills/projects already present, and a generated line ending in `负责理…`.

Assert normalization joins only soft wraps, the name is extracted, headings are not requirements, existing evidence is marked matched, and every output bullet ends as a complete sentence without ellipsis truncation.

Add a change-example assertion that unrelated source/output lines are not paired as a rewrite.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/resumeParser.test.mjs server/resumeAnalyzerBehavior.test.mjs server/graduateFlow.test.mjs`

Expected: FAIL on the anonymized cases that currently produced “未命名人才”, false requirements, missed evidence or residual fragments.

- [ ] **Step 3: Implement minimal normalization and matching corrections**

Normalize Unicode and control characters, collapse repeated headers, join Chinese soft wraps only when neither side is a section boundary or bullet, and preserve meaningful paragraph breaks.

Extract a candidate name from the first short non-contact line while rejecting section labels, companies and schools. Segment job descriptions by heading and treat qualification sections and explicit screening clauses as requirements. Reject or repair incomplete generated bullets before output. Change examples must require identical-line movement or a defensible token-overlap threshold.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/resumeParser.test.mjs server/resumeAnalyzerBehavior.test.mjs server/graduateFlow.test.mjs`

Expected: PASS.

Commit only Task 4 files with: `fix: improve Chinese resume analysis quality`

### Task 5: 修复案例库、移动端操作和真实改动展示

**Files:**
- Modify: `src/components/CaseLibraryView.tsx`
- Modify: `src/data/sampleCases.ts`
- Modify: `src/components/EditorView.tsx`
- Modify: `src/components/LandingView.tsx`
- Modify: `src/components/HomeView.tsx`
- Modify: `src/styles.css`
- Modify: `server/graduateFlow.test.mjs`

**Interfaces:**
- Produces: deterministic `filterSampleCases(cases, category)` behavior for `"全部"` and concrete categories.
- Consumes: `buildChangeExamples` from Task 4.

- [ ] **Step 1: Add failing case/filter and static UI tests**

Assert “全部” returns every sample, “运营” returns at least one operation sample, and an unknown category produces an empty list suitable for an empty state. Add static assertions for a mobile action container that becomes full-width at 390 pixels.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/graduateFlow.test.mjs`

Expected: FAIL because current case categories do not satisfy “全部/运营” and the required empty-state hook is absent.

- [ ] **Step 3: Implement case and responsive corrections**

Normalize case category values, render a clear empty state with “查看全部”, and keep case selection wired to the optimizer. Render only verified `buildChangeExamples` results. At 390 pixels use vertically stacked full-width primary actions, preserve accessible labels and eliminate horizontal overflow.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/graduateFlow.test.mjs`

Expected: PASS.

Commit only Task 5 files with: `fix: polish cases and mobile resume flow`

### Task 6: 按需加载非首屏重模块

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/admin.tsx`
- Modify: `src/services/docxFileEditor.ts`
- Modify: `src/services/pdfFileEditor.ts`
- Modify: `src/services/pdfExport.ts`
- Modify: `vite.config.ts`
- Create: `server/bundleBoundary.test.mjs`

**Interfaces:**
- Produces: route/view-level `React.lazy` boundaries for creator, editor, cases, privacy and profile views.
- Consumes: existing dynamic imports inside DOCX/PDF/export services.

- [ ] **Step 1: Add a failing production-bundle boundary test**

Build once inside the test fixture or inspect the Vite manifest and assert that the entry chunk does not directly import JSZip, docx-preview, html2canvas, jsPDF or PDF editor chunks.

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node --test server/bundleBoundary.test.mjs`

Expected: FAIL if any named heavy module remains an eager entry dependency.

- [ ] **Step 3: Add view and feature boundaries**

Convert non-default views to `React.lazy(() => import(...).then(module => ({ default: module.NamedView })))` and wrap the view area in one accessible Suspense fallback. Keep service imports inside action functions so the browser loads them only after the user enters the feature. Do not introduce a new state or routing library.

- [ ] **Step 4: Verify green and commit**

Run: `npm run build`

Run: `node --test server/bundleBoundary.test.mjs`

Expected: both PASS and the build output contains separate feature chunks.

Commit only Task 6 files with: `perf: defer resume editing modules`

### Task 7: 生产安全响应头和部署守卫

**Files:**
- Modify: `server/app.mjs`
- Modify: `server/app.test.mjs`
- Modify: `server/index.mjs`
- Modify: `.env.example`
- Modify: `DEPLOYMENT.md`
- Modify: `README.md`
- Create: `deploy/nginx-resume-fit.conf`
- Create: `deploy/ecosystem.config.cjs`

**Interfaces:**
- Produces: production startup validation and an isolated `/resume-fit/` deployment package.
- Consumes: `NODE_ENV`, `BACKEND_HOST`, `BACKEND_PORT`, `CORS_ORIGIN`, `ADMIN_PASSWORD`, MySQL and AI environment variables.

- [ ] **Step 1: Add failing header and production-startup tests**

Assert API responses include `nosniff`, restrictive referrer and permissions policies, and a CSP/frame rule appropriate for API responses. Spawn or call the startup validator with production settings and assert it rejects wildcard CORS, a missing/short admin password, missing MySQL requirement and a non-loopback backend host.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run: `node --test server/app.test.mjs`

Expected: FAIL because the complete header set and startup validator are absent.

- [ ] **Step 3: Implement production guards and isolated deployment files**

Add security headers without breaking file downloads. Validate production configuration before listening. Document a Node 20+ `npm ci && npm test && npm run build` release flow, loopback-only PM2 process, exact Nginx `/resume-fit/` alias/proxy rules, HTTPS-only HSTS and a rollback that switches only the resume-fit release directory/process.

- [ ] **Step 4: Verify green and commit**

Run: `node --test server/app.test.mjs`

Run: `npm run build`

Expected: PASS.

Commit only Task 7 files with: `chore: harden production deployment`

### Task 8: 全量自动化、真实简历验收和上线包

**Files:**
- Modify: only files required by defects reproduced during final verification.

**Interfaces:**
- Consumes: all preceding task behavior.
- Produces: verified build output, deployment archive and evidence-backed release report.

- [ ] **Step 1: Run complete automated gates**

Run: `npm test`

Run: `npm run build`

Run: `npm audit --omit=dev`

Run: `git diff --check`

Expected: all commands exit 0 and no production vulnerability is reported.

- [ ] **Step 2: Run two real-resume desktop flows**

For each provided PDF, upload, enter a realistic JD, inspect matching evidence, generate with the configured AI/fallback, edit, save, reopen and export. Assert a detected name, complete bullets, no false “岗位职责” requirement, no missed explicit evidence and only genuine change examples.

- [ ] **Step 3: Run mobile, privacy and admin flows**

At 390×844 verify home, import, cases, creator, editor and privacy deletion with no horizontal scroll or console errors. Verify anonymous admin access fails, authenticated admin sees versions from two visitors, and visitor deletion does not affect another visitor.

- [ ] **Step 4: Build the release archive and verify isolation**

Create an archive containing tracked source, lockfile, `deploy/`, `.env.example` and documentation while excluding `.env*` secrets, `node_modules`, `data/uploads`, local databases, logs and test PDFs. Extract it into a temporary directory, run `npm ci`, tests and build there.

- [ ] **Step 5: Deploy only when the server control channel is verifiably writable**

Before any server write, record HTTP responses for the root site, `/leka-showcase/` and current `/resume-fit/`. Deploy to a new release directory, start the independent loopback process, validate local health, switch only the `/resume-fit/` Nginx location, then recheck all three public paths.

If SSH or the Baota terminal cannot return readable command output, stop after producing the verified archive and exact commands; do not restart the server or modify existing Nginx.

- [ ] **Step 6: Final release commit**

Review `git status --short`, stage only files changed by Tasks 1–8, and commit with: `release: harden resume site for production`
