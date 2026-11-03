# 小知 · Dify 智能客服

简洁、适配手机的客服聊天页面，连接你自己的 Dify Chatflow。支持快捷提问、连续追问、新建会话、复制回答、等待状态与失败重试。

**[在线体验小知客服](https://transition-aaa-lexmark-affairs.trycloudflare.com)**（临时地址，需要维护者的电脑、Docker 与分享进程保持运行；分享进程重启后地址会变化。）

前端和代理使用 Node.js 原生模块，没有额外 npm 运行依赖。Dify API 密钥只在服务端使用；访客使用独立的匿名会话。

## 本地运行

需要 Node.js 22 或更新版本，以及正在运行的 Dify。

1. 复制 `.env.example` 为 `.env`。
2. 在 Dify 应用的 API 访问页面获取应用密钥，填入 `.env` 的 `DIFY_API_KEY`。`DIFY_API_BASE` 默认是 `http://localhost/v1`。
3. 在项目目录执行 `npm start`，打开 `http://localhost:3210`。
4. 执行 `npm test` 验证服务端边界与会话隔离。

`.env`、临时运行文件、日志不会提交到 GitHub。不要把真实密钥写进前端代码。

## 临时分享

Windows 下执行 `powershell -ExecutionPolicy Bypass -File ./start-share.ps1`。脚本使用 Cloudflare 官方发布的 cloudflared，生成临时 HTTPS 链接，只转发本项目的聊天页面与接口，不转发 Dify 控制台。

电脑、Docker、Node 服务与分享通道需要持续运行。电脑休眠、断网或关闭 Docker 后，访客将无法使用。重新启动分享通道时链接会变化。`stop-share.ps1` 可关闭此项目启动的进程。

临时通道不支持 SSE，因此采用完整回答模式；回答期间显示等待状态。无需把 Dify 后台或数据库端口开放到公网。访客提问会由你的 Dify 实例处理，模型调用计入你配置的供应商用量。

## GitHub 与部署

GitHub 用于保存源码。GitHub Pages 只能托管静态文件，无法运行本项目代理，也无法安全保管 Dify 密钥；仅开启 Pages 不会使本机客服自动公网可用。当前试用链接由本机分享通道提供。

后续可把整个 Node 应用部署到支持 Node.js 的主机，配置服务端环境变量，并把 Dify 后端迁移到该主机可访问的位置。公共正式服务还需要根据访问量配置身份验证、配额与稳定域名。

## 当前能力

提供知识库购物/物流/售后规则咨询。不能代办退款、取消订单或直接转接人工；具体政策与业务结果以实际平台为准。聊天记录在当前页面内保存，刷新后界面清空；服务端匿名会话最多保留 24 小时，重启服务后失效。Dify 自身可能保存运行记录。
