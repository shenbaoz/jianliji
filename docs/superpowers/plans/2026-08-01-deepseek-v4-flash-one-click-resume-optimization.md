# DeepSeek V4 Flash 一键高质量简历优化实施计划

> **Required sub-skill:** Execute this plan with `superpowers:executing-plans`; use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before deployment claims.

**Goal:** 将现有单次保守改写升级为一次点击完成“岗位策略分析 → 强力重写 → 招聘者质检 → 必要时自动修复”的成品流程，让信息较少、表达混乱的小白简历也能得到可直接投递的基础版本，同时不编造事实、不把待确认内容混进正文。

**Architecture:** 保留现有 `/api/ai/optimize` 接口和数据库结构，在服务端 AI Provider 内部编排 DeepSeek `deepseek-v4-flash` 的三阶段调用。策略阶段与质检阶段返回严格 JSON，重写与修复阶段返回纯简历正文；确定性质量门槛与模型质检共同决定是否触发最多一次自动修复。前端只接收最终正文、质量摘要及最多三条正文外补强建议。DeepSeek 整体不可用时才由现有 Kimi 客户端接管，任何供应商都必须经过同一安全校验。

**Tech Stack:** React 19、TypeScript、Vite、Express、Node.js `fetch`、Node test runner、DeepSeek OpenAI-compatible API、Docker/宝塔 Nginx。

---

## Task 1：迁移到 DeepSeek V4 Flash 正式模型

**Files:**
- Modify: `server/aiProvider.test.mjs`
- Modify: `server/aiProvider.mjs`
- Modify: `.env.example`
- Modify: `README.md`

1. 在 `server/aiProvider.test.mjs` 增加失败测试：未显式传 `model` 时，请求体的 `model` 必须等于 `deepseek-v4-flash`；测试同时断言仓库配置示例不再包含 `DEEPSEEK_MODEL=deepseek-chat`。
2. 运行 `node --test server/aiProvider.test.mjs`，确认新断言因旧默认值失败。
3. 将 `createDeepSeekClient` 默认模型和 `.env.example` 改为 `deepseek-v4-flash`，并在 `README.md` 的生产配置说明中同步模型名；保留环境变量覆盖能力。
4. 再运行 `node --test server/aiProvider.test.mjs`，确认模型迁移测试通过。
5. 提交本任务：`git add server/aiProvider.mjs server/aiProvider.test.mjs .env.example README.md && git commit -m "feat: migrate resume optimization to DeepSeek V4 Flash"`。

## Task 2：建立三阶段一键优化编排

**Files:**
- Modify: `server/aiProvider.mjs`
- Modify: `server/aiProvider.test.mjs`
- Add: `server/resumeOptimizationPrompts.mjs`
- Add: `server/resumeOptimizationPrompts.test.mjs`

1. 先在 `server/resumeOptimizationPrompts.test.mjs` 写提示词契约测试，要求：
   - 策略阶段识别目标岗位、关键词、证据库存、缺口及小白重建模式；
   - 重写阶段遵循“沈保自”标杆的单页感、岗位明确、三项核心优势、证据化要点和快速扫读结构；
   - 运营/校园经历的证据挖掘参考“杜小艳”标杆，但禁止复制个人信息和模板；
   - 三个阶段都禁止虚构公司、职务、项目、工具、证书、数字与结果；
   - 最终正文不包含分析说明、补充建议或 `[待确认]`。
2. 运行 `node --test server/resumeOptimizationPrompts.test.mjs`，确认模块不存在或导出缺失导致失败。
3. 新建 `server/resumeOptimizationPrompts.mjs`，导出 `buildStrategyMessages`、`buildRewriteMessages`、`buildQaMessages`、`buildRepairMessages`。策略与 QA 明确要求 JSON；重写与修复明确要求纯简历正文。输入中携带目标岗位、JD、脱敏后的原简历和用户提供的真实证据。
4. 在 `server/aiProvider.test.mjs` 增加三阶段编排测试：使用顺序返回策略 JSON、简历正文、QA JSON 的 fake fetch；断言恰好三次请求、每次模型均为 `deepseek-v4-flash`、后续阶段确实接收到前序产物，并且 API 最终只返回正文而非内部分析。
5. 运行该测试，确认当前单调用实现失败。
6. 在 `server/aiProvider.mjs` 提取内部 `requestCompletion(messages, { responseFormat })`，实现 `optimize()` 的三阶段顺序调用与严格 JSON 解析。策略最小结构为 `{ mode, targetRole, keywords, evidence, gaps }`；QA 最小结构为 `{ verdict, score, issues, suggestions }`。
7. 保留现有联系方式脱敏、提示注入隔离和错误语义；单次用户点击只能创建一次服务端优化作业。
8. 运行 `node --test server/resumeOptimizationPrompts.test.mjs server/aiProvider.test.mjs`，确认通过。
9. 提交本任务：`git add server/resumeOptimizationPrompts.mjs server/resumeOptimizationPrompts.test.mjs server/aiProvider.mjs server/aiProvider.test.mjs && git commit -m "feat: add multi-stage resume optimization pipeline"`。

## Task 3：增加确定性质量门槛与一次自动修复

**Files:**
- Add: `server/resumeQualityGate.mjs`
- Add: `server/resumeQualityGate.test.mjs`
- Modify: `server/aiProvider.mjs`
- Modify: `server/aiProvider.test.mjs`

1. 在 `server/resumeQualityGate.test.mjs` 先覆盖五类规则：正文非空且不少于 180 个字符；包含教育/经历/技能中的必要结构；目标岗位可见；不含分析说明、补强建议、`[待确认]` 或 TODO；不新增原文及真实证据中不存在的数字、工具或确定性事实。
2. 加入五个去标识化输入夹具：应届生、只有校园经历、只有课程项目、转行者、结构混乱文本；其中有基本事实者都必须被判定为可生成基础版本，不能仅返回“信息不足”。
3. 运行 `node --test server/resumeQualityGate.test.mjs`，确认失败。
4. 实现 `evaluateResumeQuality({ sourceText, evidenceAnswers, targetRole, draft, qa })`，返回 `{ passed, score, checks, reviewFlags }`。复用并收紧 `findUnverifiedClaims`，确保新增数字或工具直接阻断，普通措辞升级不误判为虚构。
5. 在 `server/aiProvider.test.mjs` 增加自动修复测试：前三次响应产生不合格正文/QA，第四次为合格修复稿；断言最多调用四次、修复提示包含具体失败项、最终返回修复稿。另加“合格时不修复”和“修复后仍不安全则抛错”测试。
6. 在 `server/aiProvider.mjs` 接入质量门槛：QA 或确定性检查失败时仅调用一次 `buildRepairMessages`；修复稿再次检查，不通过时抛出安全错误，让前端使用本地规则稿，绝不将危险文本交付用户。
7. 标准化返回结构：`{ provider, model, text, suggestions, reviewFlags, safe, quality: { verdict, score, checks } }`。`suggestions` 最多三条，且不写入 `text`。
8. 运行 `node --test server/resumeQualityGate.test.mjs server/aiProvider.test.mjs`，确认通过。
9. 提交本任务：`git add server/resumeQualityGate.mjs server/resumeQualityGate.test.mjs server/aiProvider.mjs server/aiProvider.test.mjs && git commit -m "feat: enforce resume quality gate and automatic repair"`。

## Task 4：保持 DeepSeek/Kimi 降级链路的一致安全性

**Files:**
- Modify: `server/aiProvider.mjs`
- Modify: `server/aiProvider.test.mjs`
- Modify: `server/index.mjs`

1. 写失败测试覆盖：DeepSeek 任一阶段网络失败时，Kimi 从完整策略阶段重新开始；DeepSeek 返回内容不合格不是供应商故障，不能绕过质量门槛直接交付；Kimi 的最终结果也必须通过相同质量与真实性检查。
2. 运行 `node --test server/aiProvider.test.mjs`，确认旧 fallback 语义无法满足全部断言。
3. 调整 provider 组合方式，使模型客户端只负责请求，统一流水线负责阶段编排和质量门槛；fallback 包裹完整流水线，避免在同一份简历中混用两个供应商的中间产物。
4. 保持 `/api/ai/optimize` 路由和数据库零改动，确保旧前端字段仍兼容。
5. 运行 `node --test server/aiProvider.test.mjs server/app.test.mjs`，确认通过。
6. 提交本任务：`git add server/aiProvider.mjs server/aiProvider.test.mjs server/index.mjs && git commit -m "fix: preserve safe full-pipeline AI fallback"`。

## Task 5：前端呈现真正的一键成品与正文外建议

**Files:**
- Modify: `src/services/aiOptimize.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/EditorView.tsx`
- Add: `src/services/aiOptimizeResult.ts`
- Add: `server/aiOptimizeResultContract.test.mjs`

1. 在 `server/aiOptimizeResultContract.test.mjs` 写前端契约测试：解析 `suggestions`、`quality`；正文清洗必须移除误混入的说明段落；待确认建议只能显示在正文外；质量通过时摘要展示模型与“一键完成策略分析、重写和质检”。
2. 运行 `node --test server/aiOptimizeResultContract.test.mjs`，确认失败。
3. 新建纯函数模块 `src/services/aiOptimizeResult.ts`，导出 `normalizeAiOptimizeResult` 与 `stripNonResumeNotes`；让服务层与编辑器共用清洗逻辑，避免前后端出现两套不一致规则。
4. 扩展 `AiOptimizeResponse` 和 `OptimizedResume`：加入可选 `suggestions`、`quality`、`provider`、`model`。在 `App.tsx` 中把服务端最终正文直接作为成品，把最多三条建议存为正文外元数据，不再把“新增信息请确认”拼入简历正文。
5. 在 `EditorView.tsx` 的投递前检查区展示质量分数、检查摘要与最多三条可选补强建议；明确这些建议不会出现在导出内容中。保持现有真实性勾选与阻断检查。
6. 运行 `node --test server/aiOptimizeResultContract.test.mjs` 和 `npm run build`，确认类型、构建和契约都通过。
7. 提交本任务：`git add src/services/aiOptimize.ts src/services/aiOptimizeResult.ts src/types.ts src/App.tsx src/components/EditorView.tsx server/aiOptimizeResultContract.test.mjs && git commit -m "feat: present one-click recruiter-ready resume results"`。

## Task 6：把“没有简历”创建器接入同一成品流水线

**Files:**
- Modify: `src/components/CreatorView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Add: `src/services/creatorResume.ts`
- Add: `server/creatorResumeContract.test.mjs`
- Modify: `server/resumeOptimizationPrompts.mjs`
- Modify: `server/resumeOptimizationPrompts.test.mjs`

1. 在 `server/creatorResumeContract.test.mjs` 先写纯函数契约测试，覆盖创建器最低生成条件：目标岗位、有效手机号或邮箱、基本教育信息，以及至少一项真实项目/活动/兼职/技能证据；缺少字段时返回精确错误，不能向 AI 发送空壳资料。
2. 增加三类从零用户夹具：只有课程项目、只有社团/志愿活动、只有兼职与基础技能；断言事实稿保留原始字段，不把课程/校园/个人经历冒充正式实习，不新增数字、工具或证书。
3. 运行 `node --test server/creatorResumeContract.test.mjs`，确认模块不存在导致失败。
4. 新建 `src/services/creatorResume.ts`，导出 `validateCreatorProfile`、`creatorProfileToResumeInput` 和 `buildCreatorEvidencePrompts`。转换后的 `ResumeInput` 带 `sourceMode: "creator"`，`resumeText` 是带清晰栏目和事实来源的结构化原始稿；没有 JD 时生成仅用于策略匹配的通用岗位说明，不将其当作候选人证据。
5. 扩展创建器资料：加入可选岗位 JD、经历类型（课程项目/毕业设计/竞赛/社团/学生工作/志愿/兼职/个人作品）、实际动作、方法/工具、可确认结果。表单提示使用小白能理解的语言，并允许跳过不存在的经历。
6. 将 `CreatorView` 改为接收 `onGenerate(input)`：完成时先本地校验，再把事实稿交给 `App.tsx`；App 复用现有分析、可选证据与 `runGeneration` 流程，生成成功后进入同一个编辑、模板、保存和导出页面，而不是只弹出静态预览。
7. 在策略/重写提示中处理 `sourceMode: creator`：从教育、课程、校园、兼职和个人实践选择相关证据，生成三项核心优势；明确禁止把学习或协助经历升级为正式任职。最多三条补强问题仍置于正文外。
8. 运行 `node --test server/creatorResumeContract.test.mjs server/resumeOptimizationPrompts.test.mjs` 和 `npm run build`，确认三类无简历用户都能进入成品链路且类型检查通过。
9. 提交本任务：`git add src/components/CreatorView.tsx src/App.tsx src/types.ts src/services/creatorResume.ts server/creatorResumeContract.test.mjs server/resumeOptimizationPrompts.mjs server/resumeOptimizationPrompts.test.mjs && git commit -m "feat: generate first resumes from structured facts"`。

## Task 7：用双标杆和小白样本做验收

**Files:**
- Add: `server/fixtures/resumeQualityCases.mjs`
- Add: `server/resumeAcceptance.test.mjs`
- Modify: `docs/superpowers/specs/2026-08-01-deepseek-v4-flash-strong-resume-optimization-design.md`

1. 将两份 PDF 的设计结论转为去标识化验收规则，不复制姓名、联系方式或完整原文：主标杆“沈保自”用于单页扫读、目标岗位、三项优势、证据化经历和技能匹配；辅标杆“杜小艳”用于运营、校园、活动与内容经历的证据挖掘。
2. 在 `server/fixtures/resumeQualityCases.mjs` 保存五类已有弱简历输入、三类完全无简历创建器输入及期望结构；在 `server/resumeAcceptance.test.mjs` 用固定模型响应测试每类最终正文均达到基础投递门槛、没有正文内待确认项、没有未核实数字或工具，也没有把校园/课程/兼职冒充正式任职。
3. 运行 `node --test server/resumeAcceptance.test.mjs`，确认测试先失败，再补齐编排/门槛中的最小实现差距。
4. 运行 `npm test`，要求构建与全部测试通过；记录测试总数和结果，不接受只跑局部测试作为完成证据。
5. 提交本任务：`git add server/fixtures/resumeQualityCases.mjs server/resumeAcceptance.test.mjs docs/superpowers/specs/2026-08-01-deepseek-v4-flash-strong-resume-optimization-design.md && git commit -m "test: add novice resume quality acceptance suite"`。

## Task 8：隔离部署最新版本并做线上真实验收

**Files:**
- Modify only on server: `/www/wwwroot/znhil-resume-app/.env`
- Deploy only to: `/www/wwwroot/znhil-resume-app`
- Restart only: `znhil-resume-api`

1. 部署前记录保护站点精确基线：
   - `http://218.244.153.12/`：HTTP 200、UTF-8 字节数 26547、标题“慈派科技 | 您的家庭健康伙伴”；
   - `http://218.244.153.12/leka-showcase/`：HTTP 200、UTF-8 字节数 588、标题“海南乐卡科技有限公司”。
2. 本地执行 `npm test` 和生产构建；只打包本项目需要的 `dist`、`server`、`package*.json` 与运行配置，不包含 `.git`、本地 PDF、测试临时渲染图或任何 API 密钥。
3. 通过已登录宝塔会话仅更新 `/www/wwwroot/znhil-resume-app`，先在该目录内创建可回滚备份；不得编辑保护站点目录、Nginx 配置块、数据库或容器。
4. 在新站自己的 `.env` 中设置 `DEEPSEEK_MODEL=deepseek-v4-flash`，保留现有 DeepSeek 密钥和 Kimi fallback 密钥；不得把密钥输出到终端记录或浏览器页面。
5. 仅重启 `znhil-resume-api`，验证容器健康、`https://znhil.xyz/api/health` 正常、首页与静态资源无 4xx/5xx。
6. 使用去标识化的小白样本发起一次真实线上优化，核验响应模型为 `deepseek-v4-flash`、正文完整、建议位于正文外、质量门槛通过；如触发 fallback，要记录原因并修复 DeepSeek 配置后重测，不能把 fallback 当作升级成功。
7. 用 Chrome 分别检查桌面端和手机宽度：上传/粘贴优化链路与“没有简历”创建链路都要完成一次；核验一次点击、等待态、最终正文、质量检查、补强建议、保存、模板和导出前阻断均正常。确认手机端不仅样式变化，两条链路都与桌面端使用同一优化流水线。
8. 部署后再次请求两个保护站点，HTTP 状态、UTF-8 字节数和标题必须与步骤 1 完全一致。任何差异都立即停止并只回滚新站目录/容器。
9. 最后执行一次线上烟雾测试并保存不含隐私和密钥的结果摘要；只有本地全测、线上 AI 真测、桌面/移动检查和保护站点一致性全部通过后，才向用户声明部署完成。
