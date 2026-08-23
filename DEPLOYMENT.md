# 生产部署

以下步骤适用于独立 HTTPS 域名部署。示例端口来自 `.env.example`，可以通过环境变量调整。

## 1. 环境要求

- Node.js 20 或更高版本
- MySQL 8 或兼容版本
- Nginx
- PM2
- Python 3，以及 `requirements-pdf.txt` 中的 PDF/Word 转换依赖

复制 `.env.example` 为 `.env`，替换所有占位值。生产环境必须满足：

- `BACKEND_HOST=127.0.0.1`
- `CORS_ORIGIN` 使用正式 HTTPS 域名
- `ADMIN_PASSWORD` 使用至少 20 位随机密码
- `REQUIRE_MYSQL=true`
- AI 密钥只保存在服务端

不要上传本地 `.env`、用户简历、数据库备份或日志。

## 2. 安装与构建

```bash
npm ci
pip install -r requirements-pdf.txt
npm test
npm run build
```

只有完整测试和构建成功后才能发布。

## 3. 启动服务

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

更新版本时使用可回滚的目录切换，再执行：

```bash
pm2 restart znhil-resume-api --update-env
```

后端端口只能监听 `127.0.0.1`，不能直接开放到公网。

## 4. Nginx

`deploy/nginx-znhil.conf` 提供独立域名示例。使用前必须替换域名、证书路径、站点目录和后端端口。

```bash
nginx -t
```

配置检查成功后才能 reload。不要把示例配置直接覆盖同一服务器上的其他站点配置。

## 5. 上线验收

- 首页和 `/api/health` 返回 HTTP 200
- 上传 PDF、DOCX、TXT 均能正常解析
- 使用脱敏测试简历完成优化，并确认结果确有变化且没有新增事实
- PDF 与 Word 均能下载和打开
- 未登录请求无法读取管理数据
- 上传文件链接需要有效令牌，过期文件会自动清理
- 响应包含 CSP、HSTS、`nosniff` 和拒绝嵌入页面的安全头
- 电脑端和 390×844 手机视口均完成真实浏览器检查
