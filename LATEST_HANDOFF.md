# 简历优化项目最新接手状态

更新时间：2026-08-20

## 2026-08-20 当前可交付状态

- 本地源码与 `dist/` 已重新构建同步；可部署包为根目录 `znhil-release-20260820-current.tar.gz`。
- 本地构建成功。完整测试当前为 154/160 通过；6 项失败来自旧界面文案断言、管理员会话断言与 `aiProvider` 测试导出不一致，尚未称为全绿。
- 线上 `https://znhil.xyz/` 仍在返回旧前端资源；宝塔连接曾超时，因此本次新包尚未完成线上切换。
- 目录已清理历史发布包、测试样例和临时可视化文件；保留源码、`dist/`、锁文件、运行数据及最新可部署包。

## 2026-08-17 本地待发布更新（基于昨日用户反馈）

用户反馈（微信截图）：导出最好能选 Word 而非只能 PDF（"PDF 改不了"）；希望有"基础信息板块"（姓名、学校等），并反馈"填了也没得"——填了基础信息但成稿里没有姓名。

- 新增 Word 导出：`src/services/wordExporter.ts` 用 jszip 客户端生成标准 .docx（UTF-8 + 微软雅黑，经 mammoth 读回验证不乱码）；`EditorView` 导出区改为"下载 Word"+"打印 / 保存 PDF"双按钮，用户自选格式。
- 原版 Word 导出（服务端）：新增 `/api/export-word` 与 `server/wordEditor.mjs`、`server/vendor/pdf2docx_convert.py`。
  - PDF 源：直接转换已精修的成品 PDF（原版式 + 优化文字 + 照片）为可编辑 docx（pdf2docx）。
  - DOCX 源：在源文档的 word/document.xml 上按顺序替换段落文字，保留照片、表格与版式。
  - 质量检查（借鉴 `Desktop\格式转化\format-workshop` 的 pdf2docx_convert.py / docx_quality_check.py）：
    DOCX 包完整性（ZIP + [Content_Types].xml + word/document.xml）、无文本层（扫描件）报错、
    中文字保留率 ≥60% 与 U+FFFD 乱码检测；不合格删除输出并报错。
  - 照片保留修复：pdf2docx 会把"姓名+顶部装饰线+多行文本+右上角照片"的顶部区域误判成表格，
    导致照片被吞掉（真实简历实测复现：沈保自/杜小艳）。修复：`generated-template` 模式转换时
    关闭表格检测（`parse_stream_table=False, parse_lattice_table=False`，生成模板无真实表格），
    前端经 `/api/export-word` 传 `deliveryMode`；`source-template` 保持表格检测（用户 PDF 可能有表格）。
  - 兼容字/图标修复：LaTeX 模板 PDF（如 Deedy 中文简历）文本层含 CJK 兼容字（⼤=大）与
    FontAwesome PUA 图标（\uF8xx），pdf2docx 转 Word 时这些字会丢失（"上海交通大学"变"上海交通学"）。
    修复：`pymupdf_official_replace.py` 生成模板文本插入前做 `unicodedata.normalize("NFKC")` +
    移除 PUA 字符；`wordEditor.mjs` 质量校验的 CJK 统计也先 NFKC 归一化。实测 Deedy 中文简历
    有效字符保留率从 82.6% 提升到 95.3%，"上海交通大学/硕士学位/软件工程"均为标准汉字。
  - 网上 5 份简历实测（Awesome-CV ×3、Deedy 中/英）：全部通过（无乱码、文字保留 ≥95%、照片保留）。
    已知边缘：Deedy 中文的日期"7th"前的 FontAwesome 日历图标在源 PDF 文本层即映射为 PUA 字符，
    清理后日期缺数字"7"（罕见 LaTeX 模板编码问题，真实 Word/WPS 简历不受影响）。
  - 照片保留质量检查：`pdf2docx_convert.py` 统计源 PDF 前两页的大头照数（宽高比 0.45-1.5、
    页面上半部、≥32pt，与 `pymupdf_official_replace.py` 的证件照判定一致），`wordEditor.mjs`
    转换后若"源有大头照但 docx 无任何图片"则删输出并报错（防"缺照片"的差输出），前端回退纯文本。
  - source-template 端到端实测：简单文本型 PDF 编辑成功（changedLineCount=1）→ Word 转换文字完整；
    真实复杂 PDF（沈保自/杜小艳，含照片/表格）被编辑引擎安全保护回退 generated-template（设计行为），
    Word 侧由模板模式覆盖；复杂版式（LibreOffice 生成的中文表格简历）链路全通过（96.6% 文字、无乱码、
    表格内容完整保留为文本流）。
  - 部署准备：`RELEASE_CHECKLIST.md` 发布步骤补充 `pip install -r requirements-pdf.txt`（PyMuPDF+pdf2docx），
    并新增"Word 导出服务器验收"清单（含照片 PDF / DOCX 源 / 扫描件 / 中文保留四项）。
  - 无源文件或服务端失败时，前端自动回退到客户端纯文本 docx；`requirements-pdf.txt` 新增 `pdf2docx==0.5.8`。
  - 注意：`pdf2docx` 依赖 PyMuPDF；pymupdf 的 fitz deprecation warning 会打到 stdout，`wordEditor.mjs` 解析 JSON 时已按行过滤；失败时优先取 stdout JSON 里的 error 提示。
- 新增"基础信息"输入（姓名/电话/邮箱/学校/专业/学历）：从零创建（`ResumeStartView`）与已有简历优化（`HomeView`，折叠面板，解析文件时自动预填姓名/电话/邮箱/学校）两条流程都支持。
- 修复"填了也没得"：新增 `server/basicInfoMerge.mjs`，在 `/api/ai/optimize` 返回前把姓名/联系方式/教育信息确定性合并进成稿（首行"姓名：xxx"、联系方式行、教育背景栏目，均去重），不依赖 AI 是否输出姓名行。
- AI 提示词（`resumeOptimizationPrompts.mjs`）增加首行姓名指令与审校项；电话/邮箱不发送给 AI（路由层与 provider 双层剥离），只由服务端合并。
- 修复生成 PDF 与页面预览把"求职目标：xxx"当姓名的启发式问题（`pymupdf_official_replace.py`、`ResumeDocument.tsx`）。
- 验证：`npm test` 通过（含构建），172 项测试；新增 `basicInfoMerge.test.mjs`（15 项）、`wordEditor.test.mjs`（5 项，含生成模板照片保留回归）与 app.test.mjs 路由级 basicInfo/export-word 测试；docx 用 mammoth 端到端读回验证。
- 尚未部署到线上；`dist/` 已重新构建。

## 2026-08-16 本地待发布更新

- 本地源码与 `dist/` 已包含最新修复；尚未部署到 `https://znhil.xyz/`。
- 所有简历来源现在都由服务端生成可保存的 PDF：普通手机浏览器直接下载，微信内置浏览器打开 PDF 预览后可通过右上角菜单保存或转发；不再依赖 `window.print()`。
- 新增 `/api/export-pdf`，PDF 文件保留随机临时链接和访问令牌；无效浏览器标识会在生成前被拒绝，不会留下无主文件。
- 优化策略、改写、终审、修复四个阶段均增加经历归属保护：不同公司、活动和项目的内容不得串入相邻公司；归属不明内容必须独立保留。
- 生成 PDF 兼容“姓名：”首行、私有字体项目符号和不可打印字符，避免方框、乱码和标题异常。
- 真实样本已做本地解析、导出与页面渲染复查；公开职业中心样例也已做兼容性探测。
- 最新验证：`npm test` 通过，生产构建成功，144 项测试通过；390×844 手机视口交互无控制台错误。

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
