# 自部署指南

用几分钟把 Multica 部署到你自己的基础设施上。

## 架构

| 组件 | 说明 | 技术 |
|---|---|---|
| **Backend** | REST API + WebSocket server | Go 单二进制 |
| **Frontend** | Web 应用 | Next.js 16 |
| **Database** | 主数据存储 | PostgreSQL 17 + pgvector |

每个需要在本机运行 AI agent 的用户，还要安装 **`multica` CLI**，并在自己的机器上运行 **agent daemon**。

## 快速安装（推荐）

两条命令完成 server、CLI 和配置：

```bash
# 1. 安装 CLI，并部署自托管 server
curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash -s -- --with-server

# 2. 配置 CLI、完成认证并启动 daemon
multica setup self-host
```

这个流程会安装 `multica` CLI，拉取最新自部署资源，从 GHCR 拉取官方 Multica 镜像，并把所有东西配置为 localhost。

打开 http://localhost:3000 登录。推荐在 `.env` 中配置 `RESEND_API_KEY`，使用真实邮件验证码；如果不配置 Resend，可以从 backend 日志里复制生成的验证码。详见 [第 2 步：登录](#第-2-步登录)。

> **前置条件：** 必须安装 Docker 和 Docker Compose。安装脚本会检查它们，缺失时会给出安装链接。
>
> **只需要 CLI？** 如果 self-host server 已经在运行，而你只想在 macOS/Linux 机器上安装 CLI：
>
> ```bash
> brew install multica-ai/tap/multica
> ```

---

## 分步安装（备选）

如果你想手动执行每一步：

### 第 1 步：启动 server

**前置条件：** Docker 和 Docker Compose。

```bash
git clone https://github.com/multica-ai/multica.git
cd multica
make selfhost
```

`make selfhost` 会从示例自动创建 `.env`，生成随机 `JWT_SECRET`，并通过 Docker Compose 启动所有服务。

默认会从 GHCR 拉取最新稳定镜像。若要从当前 checkout 构建 backend/web，运行 `make selfhost-build`。如果选中的 GHCR tag 尚未发布，`make selfhost` 会提示你回退到 `make selfhost-build`。

准备就绪后：

- **Frontend：** http://localhost:3000
- **Backend API：** http://localhost:8080

> **说明：** 如果想手动运行 Docker Compose，请看 [手动 Docker Compose 安装](#手动-docker-compose-安装)。

### 第 2 步：登录

在浏览器打开 http://localhost:3000。Docker self-host stack 默认 `APP_ENV=production`，没有固定验证码。任选一种登录方式：

- **推荐（生产）：** 在 `.env` 中配置 `RESEND_API_KEY`，然后重启 backend。真实验证码会发送到你输入的邮箱。见 [高级配置 → Email](SELF_HOSTING_ADVANCED.md#email认证必需)。
- **未配置 email：** 验证码由 server 生成，并打印到 backend 容器日志（搜索 `[DEV] Verification code for ...:`）。适合单机临时测试。
- **本地/私有确定性测试：** 在 `.env` 中设置 `APP_ENV=development` 和 `MULTICA_DEV_VERIFICATION_CODE=888888`，然后重启 backend。`APP_ENV=production` 时该固定验证码会被忽略。

`ALLOW_SIGNUP` 和 `GOOGLE_CLIENT_ID` 修改后也只需要重启 backend / compose stack。Web UI 会在运行时从 `/api/config` 读取它们，不需要重新构建 web。

> **警告：** 不要在公网可访问实例上设置 `MULTICA_DEV_VERIFICATION_CODE`。任何知道 email 的人都能用固定验证码登录。

### 第 3 步：安装 CLI 并启动 daemon

daemon 运行在你的本机，不在 Docker 里。它检测已安装的 AI agent CLI，向 server 注册 runtime，并在 agent 被分配任务时执行工作。

每个想在本机运行 AI agent 的团队成员都需要：

#### a. 安装 CLI 和至少一个 AI agent

```bash
brew install multica-ai/tap/multica
```

还需要至少安装一个 AI agent CLI：

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（`claude` 在 PATH 中）
- [Codex](https://github.com/openai/codex)（`codex` 在 PATH 中）
- [GitHub Copilot CLI](https://docs.github.com/en/copilot)（`copilot` 在 PATH 中）
- [OpenClaw](https://github.com/openclaw/openclaw)（`openclaw` 在 PATH 中）
- [OpenCode](https://github.com/anomalyco/opencode)（`opencode` 在 PATH 中）
- [Hermes](https://github.com/NousResearch/hermes)（`hermes` 在 PATH 中）
- Gemini（`gemini` 在 PATH 中）
- [Pi](https://pi.dev/)（`pi` 在 PATH 中）
- [Cursor Agent](https://cursor.com/)（`cursor-agent` 在 PATH 中）
- Kimi（`kimi` 在 PATH 中）
- Kiro CLI（`kiro-cli` 在 PATH 中）

#### b. 一条命令配置

```bash
multica setup self-host
```

它会自动：

1. 配置 CLI 连接 `localhost`（8080/3000 端口）
2. 打开浏览器完成认证
3. 发现你的工作区
4. 在后台启动 daemon

有自定义域名的内网/生产部署：

```bash
multica setup self-host --server-url https://api.example.com --app-url https://app.example.com
```

验证 daemon 是否运行：

```bash
multica daemon status
```

> **备选：** 如果想手动配置 CLI，见 [手动 CLI 配置](#手动-cli-配置)。

### 第 4 步：验证并开始使用

1. 在 http://localhost:3000 打开工作区
2. 进入 **设置 → 运行时**，确认能看到你的机器
3. 进入 **设置 → 智能体** 创建新 agent
4. 创建一个 issue 并分配给 agent；它会自动接手任务

## 停止服务

如果通过安装脚本安装：

```bash
curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash -s -- --stop
```

如果手动 clone 了仓库：

```bash
# 停止 Docker Compose 服务（backend、frontend、database）
make selfhost-stop

# 停止本地 daemon
multica daemon stop
```

## 切换到 Multica Cloud

如果你之前在自部署，想把 CLI 切到 [Multica Cloud](https://multica.ai)：

```bash
multica setup
```

这会把 CLI 重新配置到 multica.ai，重新认证并重启 daemon。覆盖现有配置前会提示确认。

> 本地 Docker 服务不会受影响。如果不再需要，请单独停止它们。

## 升级

```bash
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```

如果想固定版本，在 `.env` 中把 `MULTICA_IMAGE_TAG` pin 到具体版本，例如 `v0.2.4`。迁移会在 backend 启动时自动运行。如果选中的 GHCR tag 尚未发布，回退到 `make selfhost-build`，或运行：

```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build
```

---

## 手动 Docker Compose 安装

如果不想用 `make selfhost`，可以手动执行：

```bash
git clone https://github.com/multica-ai/multica.git
cd multica
cp .env.example .env
```

编辑 `.env`，至少修改 `JWT_SECRET`：

```bash
JWT_SECRET=$(openssl rand -hex 32)
```

启动服务：

```bash
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```

## 手动 CLI 配置

如果不想用 `multica setup`：

```bash
# 指向本地 server
multica config set server_url http://localhost:8080
multica config set app_url http://localhost:3000

# 登录（打开浏览器）
multica login

# 启动 daemon
multica daemon start
```

生产 TLS 部署：

```bash
multica config set app_url https://app.example.com
multica config set server_url https://api.example.com
multica login
multica daemon start
```

## 高级配置

环境变量、无 Docker 手动安装、反向代理、数据库设置等内容，见 [高级配置指南](SELF_HOSTING_ADVANCED.md)。
