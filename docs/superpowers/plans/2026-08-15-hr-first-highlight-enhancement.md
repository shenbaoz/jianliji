# HR 优先的画龙点睛增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已有简历的优化结果用少量、可核实的亮点帮助 HR 快速识别候选人与目标岗位的匹配度，同时避免过度重写。

**Architecture:** 扩展现有策略和改写提示词，明确顶部摘要及最相关一至两段经历的首条增强规则；扩展质量门禁，拒绝无法从原文核实的顶部成果。既有岗位证据前置和弱相关经历后置逻辑保持不变。

**Tech Stack:** Node.js ESM、Node 内置测试框架、现有 AI 提示词管线、现有岗位效果质量门禁。

## Global Constraints

- 仅强化个人概述和与目标岗位最相关的一至两段经历。
- 不得编造公司、职位、项目、数字、成果、工具、技能、证书、时间或任职关系。
- 开头摘要不超过三行，只能复用原简历事实。
- 低相关经历保留，但可压缩为一条短描述并置于核心证据之后。
- 不把校园、课程、志愿或兼职经历伪装为正式工作经历。
- 输出给用户的优化重点最多三条，必须具体且可核实。

---

### Task 1: 在岗位策略与改写提示中加入克制增强边界

**Files:**

- Modify: `server/resumeOptimizationPrompts.mjs:60-170`
- Test: `server/resumeOptimizationPrompts.test.mjs`

**Interfaces:**

- Consumes: `buildStrategyMessages(input)` 与 `buildRewriteMessages(input, strategy)`。
- Produces: 策略 JSON 的 `structure` 指令，以及已有简历模式下的开头摘要、核心经历首条和低相关经历约束。

- [ ] **Step 1: 写出失败的提示词测试**

```js
test("existing-resume prompts require restrained HR-first highlights", () => {
  const resumeInput = { ...input, sourceMode: "resume" };
  const strategy = buildStrategyMessages(resumeInput).map((item) => item.content).join("\n");
  const rewrite = buildRewriteMessages(resumeInput, {}).map((item) => item.content).join("\n");
  assert.match(strategy, /开头摘要|核心经历首条/);
  assert.match(rewrite, /一至两段经历/);
  assert.match(rewrite, /没有原始指标时不得补造数字/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test server/resumeOptimizationPrompts.test.mjs`

Expected: 新测试失败，因为当前提示词尚未限制为一至两段核心经历。

- [ ] **Step 3: 最小实现提示词约束**

在已有简历的策略提示中要求 `structure` 标明：顶部三行摘要、最相关一至两段经历的首条、低相关经历压缩。在改写提示中加入：顶部“核心优势”最多三行；每段重点采用“动作 + 场景 + 真实结果（如有）”；无原始指标时写清动作和场景；其余经历保持原意，禁止全篇重写制造差异。

- [ ] **Step 4: 运行提示词测试并确认通过**

Run: `node --test server/resumeOptimizationPrompts.test.mjs`

Expected: PASS。

- [ ] **Step 5: 提交任务变更**

```bash
git add server/resumeOptimizationPrompts.mjs server/resumeOptimizationPrompts.test.mjs
git commit -m "feat: add restrained HR-first resume highlights"
```

### Task 2: 为开头亮点和克制增强增加可核实质量检查

**Files:**

- Modify: `server/resumeTailoringQuality.mjs:1-180`
- Test: `server/resumeTailoringQuality.test.mjs`

**Interfaces:**

- Consumes: `evaluateRoleFitImpact({ sourceText, draftText, strategy })`。
- Produces: 保持 `{ passed, checks, highlights, alreadyWellTailored }`；新增顶部亮点事实锚点失败项。

- [ ] **Step 1: 写出失败的质量门禁测试**

```js
test("顶部亮点不能使用原简历之外的成果", () => {
  const result = evaluateRoleFitImpact({
    sourceText,
    draftText: ["核心优势", "- 主导账号增长 300%，实现千万级曝光", "- 小红书运营：输出 150+ 篇内容", "- 公众号运营：每周产出 3-4 篇深度原创"].join("\n"),
    strategy
  });
  assert.equal(result.passed, false);
  assert.ok(result.checks.some((item) => /顶部亮点|未核实/.test(item)));
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test server/resumeTailoringQuality.test.mjs`

Expected: 新测试失败，因为质量门禁当前不检查顶部新增句是否可追溯。

- [ ] **Step 3: 最小实现摘要事实锚点检查**

新增仅检查 `核心优势` 或开头前三行的辅助函数：逐条匹配原文中的数字、连续文本片段和双字词。若开头亮点既不命中原文数字、也不含足够事实锚点，则追加 `顶部亮点包含无法在原简历核实的结果`。允许保守摘要，不要求逐字相同。

- [ ] **Step 4: 运行质量门禁测试并确认通过**

Run: `node --test server/resumeTailoringQuality.test.mjs`

Expected: PASS；既有“顶部摘要压缩原句”测试仍通过。

- [ ] **Step 5: 提交任务变更**

```bash
git add server/resumeTailoringQuality.mjs server/resumeTailoringQuality.test.mjs
git commit -m "feat: verify HR-first resume highlights"
```

### Task 3: 用两份真实简历完成回归、构建与线上发布

**Files:**

- Test: `server/*.test.mjs`
- Test inputs: `C:/Users/29438/Desktop/沈保自(1).pdf`、`C:/Users/29438/Desktop/杜小艳-六月底到-可实习两个月.pdf`

**Interfaces:**

- Consumes: 已配置的 AI 提供方、现有优化 API、`evaluateRoleFitImpact` 质量结果。
- Produces: 两份 `ready` 成稿、全量绿色测试、通过健康检查的生产容器。

- [ ] **Step 1: 运行全量自动测试**

Run: `npm test`

Expected: 构建成功，全部 Node 测试通过。

- [ ] **Step 2: 运行真实简历回归**

对杜小艳简历使用“新媒体运营实习生”，验证成稿前半部分包含内容、账号或社群事实和已有数据；对沈保自简历使用“信息流广告投放实习生”，验证前半部分包含账户、成本或冷启动事实。两者必须为 `ready`，且没有未核实顶部成果。

- [ ] **Step 3: 生成并校验发布包**

打包 `dist`、完整 `server`、`package.json` 与 `package-lock.json`；校验包内有 `dist/index.html`、`server/index.mjs`、`server/resumeTailoringQuality.mjs`。

- [ ] **Step 4: 隔离预发布健康检查**

在服务器复制完整 `dist` 与 `server` 到临时构建容器，以端口 `3199` 启动，并检查 `/api/health` 返回 `{"ok":true}`。

- [ ] **Step 5: 切换线上并执行回滚保护**

保留旧容器与旧 `dist` 目录作为时间戳备份。仅当预发布检查成功后才替换 `resume-fit-isolated`；正式容器检查 `http://127.0.0.1:3102/api/health` 与 `https://znhil.xyz/`，任一失败即恢复旧容器和旧 `dist`。

- [ ] **Step 6: 推送发布结果**

Run: `git push origin codex/mobile-desktop-parity`

Expected: 远程分支包含代码、测试和设计记录；生产站点健康检查通过。
