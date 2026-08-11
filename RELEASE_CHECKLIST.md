# 简历记上线清单

## 发布前

1. 将 `.env.example` 复制为 `.env`，替换全部占位值。
2. 确认 `CORS_ORIGIN` 是正式 HTTPS 域名且不带尾部斜杠。
3. 确认 `ADMIN_PASSWORD` 至少 20 位、`REQUIRE_MYSQL=true`，并填写 MySQL 与 DeepSeek 配置。
4. 运行 `npm ci && npm test`。测试命令会先执行生产构建。

## 发布

1. 上传项目到 `/www/wwwroot/resume-fit/`，不要上传本地 `.env` 或任何用户数据。
2. 运行 `pm2 start ecosystem.config.cjs`；更新版本使用 `pm2 reload resume-fit-api --update-env`。
3. 将 `deploy/nginx-resume-fit.conf` 的三个 `location` 块加入现有 HTTPS 站点，并按实际目录调整 `alias`。
4. 必须先运行 `nginx -t`，成功后才能 reload。

## 验收

- `/resume-fit/` 首页、案例库、简历导入、岗位匹配、补充证据、编辑、保存与删除版本可用。
- `/resume-fit/admin.html` 需要后台密码才能读取数据。
- `/resume-fit/api/health` 返回 `{"ok":true}`。
- 3001 端口仅监听 `127.0.0.1`，不开放公网。
- 页面无横向滚动、无控制台错误，不请求用户本机地址。
- `data/uploads/` 初始为空，数据库使用全新库或已清空的专用库。

## znhil.xyz 手机端一致性验收（2026-08-01）

- [x] 360×800、390×844、430×932 手机视口无横向溢出或固定栏遮挡。
- [x] 手机端已有简历与从零生成流程均进入同一个质量审核和编辑器。
- [x] 手机端保存、历史恢复和 PDF 导出复用桌面端处理函数。
- [x] 工作流步骤在手机端显示当前步骤名称与进度，不再只显示图标。
- [x] 成品 A4 预览按实际容器宽度缩放，旋转和尺寸变化后重新计算。
- [x] 81 项自动化测试全部通过，生产构建成功。
- [x] 线上健康检查返回 `{"ok":true}`，DeepSeek `deepseek-v4-flash` 实测 `safe=true`、`verdict=ready`。
- [x] 部署前后两个受保护网站状态、字节数和标题完全一致。
