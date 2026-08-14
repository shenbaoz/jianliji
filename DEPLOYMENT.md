# 宝塔部署

此文件夹可作为完整项目上传。不要上传 `node_modules`；服务器进入项目目录后安装依赖即可。

## 1. 环境

- Node.js 20 或更高版本
- 宝塔 MySQL
- Nginx

复制 `.env.example` 为 `.env`，填写数据库名、用户名和密码，并设置：

- `CORS_ORIGIN`：你的正式 HTTPS 域名，例如 `https://resume.example.com`；
- `ADMIN_PASSWORD`：长随机密码；
- `DEEPSEEK_API_KEY`：仅保存在服务器上；可选填写 `KIMI_API_KEY` 作为 DeepSeek 临时故障时的备用服务。

生产启动会主动拒绝通配跨域、非 HTTPS 来源、公开后端监听、弱后台密码、数据库回退和缺失的 DeepSeek 密钥。`REQUIRE_MYSQL=true` 已开启：数据库连接有问题时，服务会直接报错，而不是静默使用服务器文件保存。不要把 `.env` 上传到公开仓库，也不要把任何 API 密钥放进 `VITE_` 环境变量。

## 2. 安装、构建、启动

```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

### 原文件编辑（ONLYOFFICE）

原版简历编辑使用官方 ONLYOFFICE Document Server，不再由本项目改写 PDF 字体或版式。在服务器项目目录创建 `.env` 后执行：

```bash
docker compose -f deploy/docker-compose.onlyoffice.yml up -d
```

将 Document Server 仅绑定到本机 `127.0.0.1:8088`，然后使用 `deploy/nginx-znhil.conf` 中的 `/onlyoffice/` 反向代理。Node API 与 Document Server 必须使用同一个 `ONLYOFFICE_JWT_SECRET`；`ONLYOFFICE_CALLBACK_TOKEN` 必须是另一条至少 32 位的随机值。部署前须保留 ONLYOFFICE 的版权和许可证声明，并遵守其 AGPLv3 条款。

接口固定监听 `127.0.0.1:3102`，不需要也不应开放 3102 公网端口。发布新版本时先运行 `npm ci && npm test && npm run build`，成功后再执行 `pm2 reload resume-fit-api --update-env`。

## 3. Nginx

本项目固定部署在 `/resume-fit/` 路径。把 [`deploy/nginx-resume-fit.conf`](deploy/nginx-resume-fit.conf) 中的 `/www/wwwroot/resume-fit/dist/` 改为服务器实际路径，然后只把该文件中的三个 `location` 块加入现有 HTTPS `server` 块。配置不会接管站点根路径，也不会影响 `/leka-showcase/`。执行 `nginx -t` 成功后才能 reload。

## 4. 上线检查

```bash
curl http://127.0.0.1:3102/api/health
curl -I https://你的域名/resume-fit/
curl -I https://你的域名/resume-fit/api/health
```

然后访问 `https://你的域名/resume-fit/`，上传一份非敏感测试简历，保存版本并确认 MySQL 中生成表：`resume_versions`、`resume_unlock_interests`、`resume_creator_profiles`、`resume_creator_versions`。最后确认 AI、上传、保存、删除版本接口均正常，页面没有请求 `127.0.0.1`，响应包含 CSP、HSTS、`nosniff` 和拒绝嵌入页面的安全头。
