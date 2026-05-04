# 自部署安装流程（给 AI 智能体执行）

这份文档面向 AI 智能体执行。请严格按步骤在本机部署一个 Multica 实例，并把 CLI / daemon 连接到它。

## 前置条件

- 已安装 Docker 和 Docker Compose
- 已安装 Homebrew（用于安装 CLI）
- `PATH` 中至少有一个 AI agent CLI，例如 `claude` 或 `codex`

## 安装

```bash
# 安装 CLI，并部署自托管 server
curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash -s -- --with-server

# 将 CLI 配到 localhost，完成认证，并启动 daemon
multica setup self-host
```

先等待 server 输出 `✓ Multica server is running and CLI is ready!`，再运行 `multica setup self-host`。

**预期结果：**

- 前端地址：http://localhost:3000
- 后端地址：http://localhost:8080
- `multica` CLI 已安装，并配置为连接 localhost

## 备选：手动安装

```bash
git clone https://github.com/multica-ai/multica.git
cd multica
make selfhost
brew install multica-ai/tap/multica
multica setup self-host
```

`multica setup self-host` 会：

1. 配置 CLI 连接 localhost:8080 / localhost:3000
2. 打开浏览器登录；如果配置了 Resend，使用邮件验证码；如果未配置 Resend，使用后端日志里打印的验证码
3. 自动发现工作区
4. 在后台启动 daemon

## 验证

```bash
multica daemon status
```

应显示 `running`，并列出检测到的 agent。

## 停止

```bash
# 停止 daemon
multica daemon stop

# 停止所有 Docker 服务
cd multica
make selfhost-stop
```

## 自定义端口

如果默认端口 8080 / 3000 已被占用：

1. 编辑 `.env`，修改 `PORT` 和 `FRONTEND_PORT`
2. 运行 `make selfhost`
3. 运行 `multica setup self-host --port <PORT> --frontend-port <FRONTEND_PORT>`

## 排查问题

- **后端未就绪：** `docker compose -f docker-compose.selfhost.yml logs backend`
- **前端未就绪：** `docker compose -f docker-compose.selfhost.yml logs frontend`
- **Daemon 问题：** `multica daemon logs`
- **健康检查：** `curl http://localhost:8080/health` 检查存活；`curl http://localhost:8080/readyz` 检查依赖是否就绪
