# 简历记

简历记是一款面向中文求职场景的开源简历整理工具。它从用户真实经历出发，提炼可核实的核心优势、优化表达与信息顺序，并生成可继续编辑和下载的投递版本。

在线体验：[https://znhil.xyz/](https://znhil.xyz/)

## 主要功能

- 导入 PDF、DOCX、TXT 简历
- 自动识别姓名、教育和经历等基础信息
- 根据求职方向整理内容和前置岗位证据
- 拦截原简历无法核实的新增数字、工具和职责升级
- AI 结果不安全时，使用原始事实生成保底优化版本
- 导出 PDF 和可编辑 Word 文档
- 适配电脑端与手机端
- 上传文件定时清理，生产环境支持 MySQL 持久化

## 技术栈

- React 19、TypeScript、Vite
- Node.js、Express
- MySQL
- DeepSeek，可选 Kimi 作为临时故障备用服务

## 本地运行

需要 Node.js 20 或更高版本。

```bash
git clone https://github.com/shenbaoz/jianliji.git
cd jianliji
npm install
# macOS / Linux：cp .env.example .env
# Windows：copy .env.example .env
npm run dev
```

请在 `.env` 中填写本地所需配置。API 密钥、数据库密码和管理密码只能保存在服务端环境变量中，不能写入前端代码或提交到 Git。

## 测试与构建

```bash
npm test
npm run build
```

## 部署

生产部署要求 HTTPS、MySQL、仅监听本机的后端服务以及严格的跨域配置。详细步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 反馈与贡献

- 发现错误或有功能建议，请提交 [Issue](https://github.com/shenbaoz/jianliji/issues)。
- 欢迎 Fork 项目并提交 Pull Request。
- 提交示例简历时，请先删除姓名、电话、邮箱、住址等个人信息。

贡献说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 隐私与安全

- 不要在 Issue、日志或测试文件中提交真实个人简历和联系方式。
- 不要提交 `.env`、数据库备份、上传文件或任何密钥。
- 管理功能由服务端身份验证保护，公开页面不提供管理入口。
- 生产环境上传文件会按配置的保留时间自动清理。

## 开源许可

本项目采用 [MIT License](LICENSE)。你可以学习、修改、分发和商用代码，但必须保留原许可证和版权声明。
