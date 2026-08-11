# 部署清单 — 简历记 znhil.xyz（2026-08-09 最新版）

> 构建产物已就绪：`dist/` 已重建，123/123 测试通过。

## 一、前端（dist/ 全量替换）

将本地 `C:\Users\29438\Desktop\简历优化\dist\` 上传到服务器 Nginx 站点目录（如 `/www/wwwroot/znhil.xyz/resume-fit/`），覆盖旧文件。

- 必须替换：`index.html`、`assets/`（21 个文件）、`favicon.svg`、`admin.html`
- 本次新增：OG 社交分享标签已注入 index.html（微信/搜索引擎可正确抓取）

## 二、服务端（server/ 同步更新）

以下文件本次有改动，**必须**同步：

| 文件 | 改动内容 |
|------|---------|
| `server/aiProvider.mjs` | Kimi→kimi-k3、DeepSeek reasoning_effort、temperature 适配、patch 降级 + QA 兜底、重试机制 |
| `server/app.mjs` | skippedFollowUp 透传、错误中间件 null check |
| `server/resumeOptimizationPrompts.mjs` | 纯中文 Prompt + 改写铁律 + few-shot 范例 + 保守改写策略 |
| `server/resumeQualityGate.mjs` | 正向质量指标（动词/量化覆盖率）、score 保底 65、章节保留检查 |
| `server/resumeStructure.mjs` | **新增**：结构化简历解析（章节→条目→行 + 角色标注） |
| `server/vendor/reactive-resume/patch-proposal.mjs` | 中文 Prompt + few-shot + 结构化标注接入 |
| `server/vendor/pymupdf_official_replace.py` | PDF 写回视觉修复（中文字体、自然换行、行数放宽） |
| `server/aiProvider.test.mjs` | 测试断言同步 |
| `server/resumeStructure.test.mjs` | **新增**：结构化解析测试 |
| `server/pdfEditor.test.mjs` | 原有（无改动，确认存在即可） |

**新增文件务必一并上传**：`server/resumeStructure.mjs`、`server/resumeStructure.test.mjs`（若不需要测试可不传测试文件）。

## 三、环境变量（服务器 .env 必须改！）

```ini
# 必须改为 V4 新模型（deepseek-chat 旧接口已停用）
DEEPSEEK_MODEL=deepseek-v4-flash
# 必须改为 kimi-k3（moonshot-v1-8k 已于 2026-08-31 下线）
KIMI_MODEL=kimi-k3
```

⚠️ **若 .env 里没有这两行**，代码默认值已是新模型，不用管。
⚠️ **若 .env 里有旧值**（deepseek-chat / moonshot-v1-8k），会覆盖代码默认值，必须改。

## 四、Python 依赖（必须装）

```bash
pip install pymupdf
```

PDF 原文件写回依赖此库。服务器若未装，PDF 编辑功能会报"PDF 精修组件未安装"。

## 五、PM2 重启

```bash
pm2 restart resume-fit   # 按你的 ecosystem.config.cjs 中的进程名
```

## 六、部署后验证

1. 打开 https://znhil.xyz/resume-fit/ 首页正常
2. 上传一份简历 → 填目标岗位 → 点击分析（应出现"精修中"提示，约 30-60 秒）
3. 编辑器应显示"本次优化改动"对比卡片 + "成稿质量达标度"进度条
4. 导出 PDF 正常
5. 若 AI 失败：检查 PM2 日志中是否有 API 错误

## 七、本次改动全部清单（回顾）

- **AI 优化质量**：纯中文 Prompt、改写铁律 7 条、few-shot 范例 3 组、结构化简历解析、岗位关键词对齐
- **可靠性**：patch 路径失败自动降级、DeepSeek 3 次重试、Kimi fallback、本地规则兜底
- **事实安全**：脱敏、未核实数字/工具拦截、能力表述降级
- **PDF 写回**：中文字体、长句自然换行、视觉验证通过
- **付费感知**：优化前后对比卡片、达标度进度条
- **模型升级**：DeepSeek V4-Flash 主 + Kimi K3 备（已避开旧模型下线）
