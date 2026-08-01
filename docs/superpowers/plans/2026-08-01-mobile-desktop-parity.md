# Mobile/Desktop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished 360px–430px mobile experience that uses exactly the same resume import, from-scratch creation, DeepSeek generation, quality gate, versioning, and export logic as desktop.

**Architecture:** Keep `App.tsx` and the existing services as the single business/data flow. Add a small responsive presentation contract to shared components, give the editor a view-only mobile edit/preview switch, and consolidate final mobile overrides in `styles.css`; no mobile-specific API, AI prompt, database, or state store will be introduced.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind utility classes, shared CSS, Vite 6, Node test runner, Chrome responsive testing.

## Global Constraints

- Mobile is not a reduced feature version; all workflow actions and result quality must match desktop.
- Supported acceptance viewports are 360×800, 390×844, 430×932, and desktop 1440px.
- Mobile inputs use at least 16px font size and primary touch targets use at least 44px height.
- Do not change the confirmed DeepSeek model or resume quality rules.
- Deploy only to `/www/wwwroot/znhil-resume-app`, its existing application container, and database `znhil_resume_20260730`.
- Do not modify or affect `http://218.244.153.12/` or `http://218.244.153.12/leka-showcase/`.

---

## File Structure

- Create `server/mobileParity.test.mjs`: source-level regression checks for shared handlers and required mobile presentation hooks.
- Modify `src/App.tsx`: replace the fixed-width validation notice with a responsive, accessible shared toast hook.
- Modify `src/components/ProductShell.tsx`: expose current-step mobile progress without changing workflow state.
- Modify `src/components/HomeView.tsx`: identify the existing mobile tabs/action area and reserve safe content space.
- Modify `src/components/CreatorView.tsx`: add semantic busy/step hooks while continuing to call the existing `onGenerate` handler.
- Modify `src/components/EditorView.tsx`: add a view-only mobile edit/preview tab state and shared bottom actions.
- Modify `src/styles.css`: add one final coherent mobile layer for safe areas, sizing, overflow, creator, workflow, editor, reports, history, and toast.
- Modify `RELEASE_CHECKLIST.md`: record mobile parity and protected-site checks.

### Task 1: Lock the shared-logic mobile contract

**Files:**
- Create: `server/mobileParity.test.mjs`
- Read: `src/App.tsx`
- Read: `src/components/HomeView.tsx`
- Read: `src/components/CreatorView.tsx`
- Read: `src/components/EditorView.tsx`
- Read: `src/components/ProductShell.tsx`

**Interfaces:**
- Consumes: existing `onNext`, `onGenerate`, `onSave`, and `handleDownloadPdf` handlers.
- Produces: regression tests that require shared handlers and stable mobile class hooks.

- [ ] **Step 1: Write failing source-contract tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile views reuse desktop generation save and export handlers", async () => {
  const [app, creator, editor] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/CreatorView.tsx"),
    read("src/components/EditorView.tsx")
  ]);
  assert.match(app, /onGenerate=\{generateFromCreator\}/);
  assert.match(creator, /await onGenerate\(creatorProfileToResumeInput\(profile\)\)/);
  assert.match(editor, /onClick=\{handleSave\}/);
  assert.match(editor, /onClick=\{handleDownloadPdf\}/);
});

test("shared pages expose the responsive presentation contract", async () => {
  const [app, shell, home, creator, editor, css] = await Promise.all([
    read("src/App.tsx"),
    read("src/components/ProductShell.tsx"),
    read("src/components/HomeView.tsx"),
    read("src/components/CreatorView.tsx"),
    read("src/components/EditorView.tsx"),
    read("src/styles.css")
  ]);
  assert.match(app, /app-toast/);
  assert.match(shell, /workflow-mobile-summary/);
  assert.match(home, /mobile-view-tabs/);
  assert.match(creator, /creator-step-progress/);
  assert.match(editor, /editor-mobile-tabs/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
});
```

- [ ] **Step 2: Run the new test and verify failure**

Run: `node --test server/mobileParity.test.mjs`

Expected: the shared-handler test passes; presentation-contract test fails because the new class hooks do not exist yet.

- [ ] **Step 3: Commit only the failing test**

```powershell
git add -- server/mobileParity.test.mjs
git commit -m "test: define mobile parity contract"
```

### Task 2: Make the shared shell and feedback mobile-safe

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ProductShell.tsx`
- Modify: `src/styles.css`
- Test: `server/mobileParity.test.mjs`

**Interfaces:**
- Consumes: `WorkflowStep`, `workflowStages`, and existing `validationMessage` state.
- Produces: `.app-toast`, `.workflow-progress-copy`, and `.workflow-mobile-summary` hooks.

- [ ] **Step 1: Give the validation message a responsive accessible hook**

Replace the validation notice wrapper with:

```tsx
<div className="app-toast" role="status" aria-live="polite">
  {validationMessage}
</div>
```

- [ ] **Step 2: Add current-step mobile progress without changing workflow logic**

In `WorkflowRail`, derive the active stage and render:

```tsx
const activeStage = workflowStages[activeIndex];
const completed = Math.min(activeIndex + 1, progressStages.length);

<p className="workflow-progress-copy">已完成 {completed} / {progressStages.length} 步 · 约还需 2 分钟</p>
<p className="workflow-mobile-summary" aria-label={`当前是第 ${completed} 步，共 ${progressStages.length} 步`}>
  <span>第 {completed}/{progressStages.length} 步</span>
  <strong>{activeStage.label}</strong>
</p>
```

- [ ] **Step 3: Add the base safe-area and toast CSS contract**

Append a named final section to `styles.css` containing:

```css
:root {
  --mobile-page-gutter: 16px;
  --mobile-action-height: 68px;
}

.app-toast {
  position: fixed;
  top: max(64px, env(safe-area-inset-top));
  left: 50%;
  z-index: 80;
  width: min(560px, calc(100vw - 32px));
  transform: translateX(-50%);
  border: 1px solid #f5d48a;
  border-radius: 12px;
  background: #fffbeb;
  padding: 12px 16px;
  color: #78350f;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  font-size: 14px;
  line-height: 1.5;
}

.workflow-mobile-summary { display: none; }
```

- [ ] **Step 4: Run the focused test**

Run: `node --test server/mobileParity.test.mjs`

Expected: failure now points only to Home, Creator, Editor, or the final 767px media query.

- [ ] **Step 5: Commit the shell contract**

```powershell
git add -- src/App.tsx src/components/ProductShell.tsx src/styles.css
git commit -m "feat: make workflow shell mobile safe"
```

### Task 3: Polish import and from-scratch creation on mobile

**Files:**
- Modify: `src/components/HomeView.tsx`
- Modify: `src/components/CreatorView.tsx`
- Modify: `src/styles.css`
- Test: `server/mobileParity.test.mjs`

**Interfaces:**
- Consumes: `MobileTab`, `tab`, `setTab`, `CreatorProfile`, `validateCreatorProfile`, and the existing `onGenerate(ResumeInput)` callback.
- Produces: `.mobile-view-tabs`, `.creator-step-progress`, `.creator-form-actions`, and safe mobile form layout.

- [ ] **Step 1: Identify the existing import tabs semantically**

Change only the existing HomeView mobile nav class and label:

```tsx
<nav className="mobile-view-tabs fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="简历导入视图">
```

- [ ] **Step 2: Expose creator progress and action hooks**

Keep the existing step and `onGenerate` logic, while changing the progress paragraph and footer to:

```tsx
<p className="creator-kicker creator-step-progress" aria-live="polite">第 {step + 1} 步 / 共 {labels.length} 步 · {labels[step]}</p>
...
<footer className="creator-form-actions">...</footer>
```

Do not add a second generation function or any mobile-only validation path.

- [ ] **Step 3: Add focused mobile layout rules**

Inside the final `@media (max-width: 767px)` block, add rules that:

```css
@media (max-width: 767px) {
  html, body, #root { max-width: 100%; overflow-x: clip; }
  .page-shell { width: calc(100% - 32px) !important; padding: 32px 0 calc(96px + env(safe-area-inset-bottom)) !important; }
  .page-shell .panel-title h1 { font-size: clamp(32px, 10vw, 40px) !important; }
  .workflow-progress-copy, .workflow-rail { display: none; }
  .workflow-mobile-summary { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 12px; }
  .mobile-view-tabs { min-height: calc(var(--mobile-action-height) + env(safe-area-inset-bottom)); }
  .creator-page input, .creator-page textarea, .page-shell input, .page-shell textarea, .page-shell select { font-size: 16px !important; }
  .creator-form { width: 100%; padding: 36px var(--mobile-page-gutter) calc(112px + env(safe-area-inset-bottom)); }
  .creator-form-actions { position: sticky; bottom: 0; z-index: 4; margin-inline: calc(var(--mobile-page-gutter) * -1); padding: 12px var(--mobile-page-gutter) max(12px, env(safe-area-inset-bottom)); background: rgba(255,255,255,.96); }
  .creator-next { min-height: 48px; flex: 1; }
  .creator-modal { align-items: start; overflow-y: auto; padding: 12px; }
  .creator-modal article { min-height: 0; padding: 52px 20px 28px; }
}
```

- [ ] **Step 4: Run contract and build checks**

Run: `node --test server/mobileParity.test.mjs`

Expected: failure only for Editor hook.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

- [ ] **Step 5: Commit the two entry flows**

```powershell
git add -- src/components/HomeView.tsx src/components/CreatorView.tsx src/styles.css
git commit -m "feat: polish mobile resume entry flows"
```

### Task 4: Give the final editor a complete mobile workflow

**Files:**
- Modify: `src/components/EditorView.tsx`
- Modify: `src/styles.css`
- Test: `server/mobileParity.test.mjs`

**Interfaces:**
- Consumes: existing `handleSave`, `handleDownloadPdf`, `canPublish`, editable text state, confirmations, and preview content.
- Produces: `EditorMobileView = "edit" | "preview"`, `.editor-mobile-tabs`, `.editor-pane`, `.editor-mobile-actions`.

- [ ] **Step 1: Add a presentation-only mobile tab state**

Near the existing state declarations add:

```tsx
type EditorMobileView = "edit" | "preview";
const [mobileView, setMobileView] = useState<EditorMobileView>("edit");
```

The state must not copy or transform resume data.

- [ ] **Step 2: Add accessible editor tabs**

Before the two-column editor grid render:

```tsx
<nav className="editor-mobile-tabs" aria-label="成品简历视图">
  <button type="button" aria-current={mobileView === "edit" ? "page" : undefined} onClick={() => setMobileView("edit")}>检查与编辑</button>
  <button type="button" aria-current={mobileView === "preview" ? "page" : undefined} onClick={() => setMobileView("preview")}>成品预览</button>
</nav>
```

Apply `editor-pane is-active` to the selected aside/preview and `editor-pane` to the other. Desktop CSS keeps both panes visible.

- [ ] **Step 3: Reuse the exact save/export handlers in a mobile action bar**

Render a mobile-only bar after the grid:

```tsx
<div className="editor-mobile-actions" aria-label="保存与导出">
  <button type="button" onClick={handleSave} disabled={!canPublish}><Save size={16} />保存版本</button>
  <button type="button" onClick={handleDownloadPdf} disabled={!canPublish}><Download size={16} />保存 PDF</button>
</div>
```

- [ ] **Step 4: Add mobile editor and paper scaling CSS**

Inside the final 767px block:

```css
@media (max-width: 767px) {
  .editor-mobile-tabs { display: grid; grid-template-columns: 1fr 1fr; position: sticky; top: 52px; z-index: 20; }
  .editor-mobile-tabs button { min-height: 48px; border: 1px solid #d2d2d7; background: #fff; font-size: 14px; }
  .editor-mobile-tabs button[aria-current="page"] { background: #1d1d1f; color: #fff; }
  .editor-pane { display: none; min-width: 0; }
  .editor-pane.is-active { display: block; }
  .resume-print-area { width: 210mm; transform: scale(calc((100vw - 64px) / 793.7)); transform-origin: top left; }
  .editor-preview-viewport { overflow: hidden; min-height: calc((100vw - 64px) * 1.414); }
  .editor-mobile-actions { position: fixed; inset-inline: 0; bottom: 0; z-index: 50; display: grid; grid-template-columns: 1fr 1.35fr; gap: 8px; padding: 10px 16px max(10px, env(safe-area-inset-bottom)); background: rgba(255,255,255,.97); border-top: 1px solid #d2d2d7; }
  .editor-mobile-actions button { min-height: 48px; border-radius: 999px; }
}
@media (min-width: 768px) {
  .editor-mobile-tabs, .editor-mobile-actions { display: none; }
}
```

Use a CSS custom property or measured wrapper if the existing `ResumeDocument` rendered dimensions require adjusting the preview height; the paper itself must remain A4 for print.

- [ ] **Step 5: Run the focused contract and full suite**

Run: `node --test server/mobileParity.test.mjs`

Expected: all mobile parity tests pass.

Run: `npm test`

Expected: build succeeds and all existing plus new Node tests pass.

- [ ] **Step 6: Commit the editor**

```powershell
git add -- src/components/EditorView.tsx src/styles.css
git commit -m "feat: complete mobile resume editor workflow"
```

### Task 5: Browser verification, release guard, and isolated deployment

**Files:**
- Modify: `RELEASE_CHECKLIST.md`
- Read: `DEPLOYMENT.md`
- Read: `deploy/nginx/znhil.xyz.conf`
- Verify: built `dist/` output and deployed `https://znhil.xyz`

**Interfaces:**
- Consumes: the production build, existing isolated znhil deployment configuration, and live health endpoint.
- Produces: verified production UI and written protected-site baselines.

- [ ] **Step 1: Record pre-deployment protected-site baselines**

Request both protected URLs read-only and record HTTP status, UTF-8 response byte length, and `<title>`:

```powershell
@'
const urls = ['http://218.244.153.12/','http://218.244.153.12/leka-showcase/'];
for (const url of urls) {
  const response = await fetch(url);
  const text = await response.text();
  console.log(JSON.stringify({url,status:response.status,bytes:Buffer.byteLength(text,'utf8'),title:text.match(/<title>(.*?)<\/title>/is)?.[1] || ''}));
}
'@ | node -
```

Expected baseline:

- Root: status 200, UTF-8 bytes 26547, title `慈派科技 | 您的家庭健康伙伴`.
- Leka: status 200, UTF-8 bytes 588, title `海南乐卡科技有限公司`.

- [ ] **Step 2: Verify four viewports in Chrome**

At 360×800, 390×844, 430×932, and 1440px verify the landing page, import, creator, job, report, questions, editor, and history views. At each mobile width assert `document.documentElement.scrollWidth === window.innerWidth`, all primary controls are visible, and no fixed bar covers focused inputs.

- [ ] **Step 3: Run both full workflows locally**

Use the existing resume flow and the from-scratch flow. Verify both reach the same editor, show AI quality output, preserve text through edit/preview switching, save a version, restore it from history, and expose PDF export only after the same confirmations.

- [ ] **Step 4: Update the release checklist with exact mobile checks**

Add these checked entries:

```markdown
- [x] 360×800、390×844、430×932 手机视口无横向溢出或固定栏遮挡
- [x] 手机端已有简历与从零生成流程均进入同一个质量审核和编辑器
- [x] 手机端保存、历史恢复和 PDF 导出复用桌面端处理函数
- [x] 部署前后两个受保护网站状态、字节数和标题完全一致
```

- [ ] **Step 5: Build and deploy only the isolated application**

Run the documented znhil deployment procedure, targeting only `/www/wwwroot/znhil-resume-app` and the existing `znhil-resume-api` container. Do not restart shared nginx globally when a configuration reload scoped through the existing tested procedure is sufficient.

- [ ] **Step 6: Verify production and protected sites after deployment**

Check `https://znhil.xyz`, its health endpoint, one real DeepSeek generation, and all four viewports. Repeat the exact protected-site baseline command and require byte-for-byte matching results before declaring completion.

- [ ] **Step 7: Run final tests and commit the release evidence**

Run: `npm test`

Expected: all tests pass.

```powershell
git add -- RELEASE_CHECKLIST.md
git commit -m "docs: record mobile production verification"
```
