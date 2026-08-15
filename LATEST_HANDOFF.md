# 简历优化项目最新接手状态

更新时间：2026-08-15

## 当前目录

- 开发与修复入口：`C:\Users\29438\Desktop\简历优化`
- 当前线上网站：`https://znhil.xyz/`
- 本地生产构建：`dist/`（每次 `npm run build` 重新生成）
- 发布快照目录 `release-znhil-final/` 已于 2026-08-15 删除（它与根目录源码逐字节相同，纯冗余；发布以 `dist/` + git 记录为准）。

## 已同步的线上版本

- 前端入口资源：`app-DiuU7uFg.js`（以 `dist/assets/` 实际文件名为准）
- PDF.js worker：`pdf.worker-Dg_VPFYK.mjs`
- 前端已经包含 PDF worker MIME 缓存版本参数。
- `server/pdfEditor.mjs` 与上次线上发布使用的 PDF 编辑器 SHA-256 一致。
- 后端入口统一使用 `server/app.mjs`（线上通过部署脚本 `deploy-znhil-release.sh` 结合 `patch-production-ai-route.mjs` 生成生产版 `app.mjs`）。

## 当前验证

- `npm run build`：通过。
- `npm test`：139 项通过，0 项失败。
- 构建仍有一个 Vite 大分块警告，不影响当前运行。

## 2026-08-15 目录精简记录

- 删除 `tmp/`（克隆仓库参考，97MB）、根目录 4 个过时发布包、`release-znhil-final/` 冗余快照、`deploy/` 旧 tar.gz 与一次性 ship 脚本、`.playwright-cli/`、`output/`、`server/vendor/__pycache__/`。
- 删除 ONLYOFFICE 全套遗留（功能从未实现）：`.env.example` 配置、`deploy/docker-compose.onlyoffice.yml`、`deploy/nginx-znhil.conf` 的 `/onlyoffice/` 反代、`productionConfig.mjs` 校验及测试、`DEPLOYMENT.md` 段落。
- 删除历史开发计划/规格文档（`docs/superpowers/`）与孤立的 `resuml-ISC.txt` 许可证文件、过时的 `DEPLOY-NOW.md`。
- 代码清理：ProductShell 5 个死组件与 14 个未用常量、storage.ts 6 个死导出、types.ts 死类型与 WorkflowStep 7 个未用视图值、aiOptimize 死函数、AdminView 未用 import、styles.css 大量死选择器、pdfFontkit 及 `@pdf-lib/fontkit`/`pdfjs-dist` 死依赖。
- 保留说明：`createEditedPdf` 被部署脚本 smoke test 使用；`changeExamples` 两个函数被 graduateFlow 测试覆盖；fastPolish 链（patch-proposal/resumeStructure）为有意保留的快捷路径。

## 尚未修复的问题

用户真实 PDF 已能正常加载并保留原照片与版式，但优化文字被强行写回单个原始文本行时会出现：

- 字距异常拉开；
- 新旧文字重叠；
- 原文字残留；
- 长句缩得过小或超出原区域。

问题集中在 `server/pdfEditor.mjs` 的文本定位、擦除区域、换行和安全适配逻辑。不要继续用“把任意长文本缩进单行”的方式打补丁。修复时必须先添加能复现该视觉问题的失败测试，并用真实 PDF 渲染成 PNG 检查；红线只出现在 review PDF，clean/export PDF 不得带红线。

## 接手限制

- 先修复并本地测试，再部署。
- 保留用户原 PDF 的照片、页面、分区和版式，只改文字。
- 不整体覆盖线上后端，只做经过灰度验证的精确更新。
- 当前线上版本保持不动，尚未部署本次任何修复。
