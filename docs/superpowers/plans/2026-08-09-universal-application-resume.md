# Universal Application Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one evidence-based resume for a user-selected group of similar roles without requiring a company JD.

**Architecture:** The existing analyzer remains the single source of resume rewriting and safety validation. The app will treat `targetRole` as the required optimization direction while passing an empty optional JD through the generation path. The existing resume and creator screens will expose only that direction and route straight to the editor.

**Tech Stack:** React 19, TypeScript, Vite, Node.js test runner, existing resume analyzer and AI provider boundary.

## Global Constraints

- A user must be able to generate from real resume evidence and self-entered `targetRole` alone.
- `jobDescription` is optional and is not shown in the default workflow.
- Do not generate scores, fabricated metrics, skills, or experience.
- Keep contact-detail redaction and current AI safety checks intact.

---

### Task 1: Make the existing-resume path direction-first

**Files:**
- Modify: `src/App.tsx:119-137`
- Modify: `src/components/JobView.tsx`
- Test: `server/universalApplicationFlow.test.mjs`

**Interfaces:**
- Consumes: `ResumeInput.targetRole`, `analyzeResume(input)`, `runGeneration(input, report, answers, allowExternalAi)`.
- Produces: a direct editor transition after a role-only optimization request.

- [ ] **Step 1: Write the failing test**

```js
assert.match(app, /input\.resumeText\.trim\(\)\.length > 20 && input\.targetRole\.trim\(\)\.length > 1/);
assert.doesNotMatch(job, /jobDescription\.trim\(\)\.length/);
assert.match(job, /placeholder="例如：内容运营、新媒体运营"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/universalApplicationFlow.test.mjs`

Expected: FAIL because the current path requires `jobDescription`.

- [ ] **Step 3: Write minimal implementation**

```ts
const canAnalyze = resumeReady && input.targetRole.trim().length > 1;
const nextReport = analyzeResume({ ...input, jobDescription: input.jobDescription.trim() });
await runGeneration(input, nextReport, {}, true);
```

Replace the default job page with one `targetRole` field and a direct “生成通用投递版” action.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/universalApplicationFlow.test.mjs && npm run build`

Expected: PASS and TypeScript build exits 0.

- [ ] **Step 5: Commit**

```bash
git add server/universalApplicationFlow.test.mjs src/App.tsx src/components/JobView.tsx
git commit -m "feat: generate universal role-targeted resumes"
```

### Task 2: Align the beginner generator with the same direction-first rule

**Files:**
- Modify: `src/components/CreatorView.tsx:6-87`
- Modify: `src/services/creatorResume.ts`
- Test: `server/universalApplicationFlow.test.mjs`

**Interfaces:**
- Consumes: `CreatorProfile.basics.targetRole`, `creatorProfileToResumeInput(profile)`.
- Produces: beginner resume input with a direction and no required JD.

- [ ] **Step 1: Extend the failing test**

```js
assert.match(creator, /求职方向/);
assert.doesNotMatch(creator, /招聘信息 \/ 岗位要求/);
assert.doesNotMatch(creator, /jobDescription.*粘贴岗位职责/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/universalApplicationFlow.test.mjs`

Expected: FAIL because beginner creation still displays the optional JD textarea.

- [ ] **Step 3: Write minimal implementation**

```tsx
<label>求职方向
  <small>填一类相近岗位，例如“内容运营、新媒体运营”。</small>
  <input value={basics.targetRole} onChange={(event) => onChange("targetRole", event.target.value)} />
</label>
```

Remove the beginner JD field and clear any legacy saved `jobDescription` when converting profile data to a resume input.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/universalApplicationFlow.test.mjs && npm run build`

Expected: PASS and TypeScript build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/CreatorView.tsx src/services/creatorResume.ts server/universalApplicationFlow.test.mjs
git commit -m "feat: simplify beginner resume direction"
```

### Task 3: Verify and deploy

**Files:**
- Modify: `dist/` via `npm run build`

- [ ] **Step 1: Run the full suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Package production assets**

Run: `Compress-Archive -Path dist/* -DestinationPath <unique-temp-archive> -CompressionLevel Optimal`

Expected: a non-empty archive containing `index.html` and `assets/`.

- [ ] **Step 3: Deploy with rollback backup**

Run in the existing Baota server terminal:

```sh
set -e; cd /www/wwwroot/znhil-resume-app; cp -a dist dist.backup-<timestamp>; unzip -o /www/wwwroot/<archive> -d dist; chown -R www:www dist; echo DEPLOYED
```

- [ ] **Step 4: Verify the live workflow**

Open `https://znhil.xyz/`, enter the resume path, and confirm the page reports three steps and requires a direction rather than a JD.

