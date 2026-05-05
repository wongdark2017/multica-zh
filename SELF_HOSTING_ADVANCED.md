# 自部署：高级配置

这份文档说明 Multica 自部署的高级配置。快速上手请看 [SELF_HOSTING.md](SELF_HOSTING.md)。

## 配置

所有配置都通过环境变量完成。建议从 `.env.example` 复制一份开始。

### 必填变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgres://multica:multica@localhost:5432/multica?sslmode=disable` |
| `JWT_SECRET` | **必须修改默认值。** 用于签发 JWT 的密钥，应使用足够长的随机字符串。 | `openssl rand -hex 32` |
| `FRONTEND_ORIGIN` | 前端访问地址，用于 CORS | `https://app.example.com` |

### 数据库连接池调优（可选）

这些值有合理默认值，只在大规模或资源受限部署时需要调整。优先级：环境变量 -> `DATABASE_URL` 上的 `pool_*` query param -> 内置默认。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_MAX_CONNS` | 每个 pod 的 pgxpool 最大连接数。`pod_count × DATABASE_MAX_CONNS` 应明显低于 Postgres `max_connections`。如果前面有 PgBouncer / RDS Proxy / Supavisor，可适当调高。 | `25` |
| `DATABASE_MIN_CONNS` | 每个 pod 的 pgxpool 预热基线连接数，会自动 clamp 到 `DATABASE_MAX_CONNS`。 | `5` |

### Email（认证必需）

Multica 使用 [Resend](https://resend.com) 发送邮箱验证码。

| 变量 | 说明 |
|---|---|
| `RESEND_API_KEY` | 你的 Resend API key |
| `RESEND_FROM_EMAIL` | 发件邮箱，默认 `noreply@multica.ai` |

> **说明：** 如果未配置 Resend，生成的验证码会打印到 backend 日志。固定本地测试验证码默认关闭；私有测试实例可设置 `APP_ENV=development` 和 6 位 `MULTICA_DEV_VERIFICATION_CODE` 开启。`APP_ENV=production` 时会忽略该值。

### Google OAuth（可选）

| 变量 | 说明 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL，例如 `https://app.example.com/auth/callback` |

修改后重启 backend / compose stack 生效。Web UI 会在运行时从 `/api/config` 读取 `GOOGLE_CLIENT_ID`，不需要重新构建 web。

### 注册控制（可选）

| 变量 | 说明 |
|---|---|
| `ALLOW_SIGNUP` | 设为 `false` 可禁用私有实例上的新用户注册 |
| `ALLOWED_EMAIL_DOMAINS` | 可选，逗号分隔的 email domain allowlist |
| `ALLOWED_EMAILS` | 可选，逗号分隔的精确 email allowlist |

修改后重启 backend / compose stack 生效。Web UI 会在运行时从 `/api/config` 读取 `ALLOW_SIGNUP`，不需要重新构建 web。

### 文件存储（可选）

上传文件和附件可以配置 S3 与 CloudFront：

| 变量 | 说明 |
|---|---|
| `S3_BUCKET` | S3 bucket 名称 |
| `S3_REGION` | AWS region，默认 `us-west-2` |
| `CLOUDFRONT_DOMAIN` | CloudFront distribution domain |
| `CLOUDFRONT_KEY_PAIR_ID` | 用于 signed URL 的 CloudFront key pair ID |
| `CLOUDFRONT_PRIVATE_KEY` | CloudFront private key（PEM 格式） |

### Cookie

| 变量 | 说明 |
|---|---|
| `COOKIE_DOMAIN` | session + CloudFront cookie 的可选 `Domain` 属性。单 host 部署（localhost、LAN IP 或单 hostname）请留空。只有当前端和后端位于同一注册域名下的不同子域（例如 `.example.com`）时才设置。**不要使用 IP literal**：RFC 6265 禁止在 cookie `Domain` 中使用 IP 地址，浏览器会丢弃这类 `Set-Cookie`。 |

session cookie 的 `Secure` flag 会根据 `FRONTEND_ORIGIN` scheme 自动推导：HTTPS origin 得到 `Secure` cookie；普通 HTTP origin（LAN / private-network self-host）使用 non-secure cookie，浏览器才能保存。

### Server

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | Backend server 端口 |
| `METRICS_ADDR` | 空 | 可选 Prometheus metrics listener，例如 `127.0.0.1:9090` |
| `FRONTEND_PORT` | `3000` | Frontend 端口 |
| `CORS_ALLOWED_ORIGINS` | `FRONTEND_ORIGIN` 的值 | 逗号分隔的允许 origin |
| `LOG_LEVEL` | `info` | 日志级别：`debug`、`info`、`warn`、`error` |

### CLI / Daemon

这些变量配置在每个用户自己的机器上，不在 server 上：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `MULTICA_SERVER_URL` | `ws://localhost:8080/ws` | daemon -> server 的 WebSocket URL |
| `MULTICA_APP_URL` | `http://localhost:3000` | CLI 登录流程使用的前端 URL |
| `MULTICA_DAEMON_POLL_INTERVAL` | `3s` | daemon 拉取任务的频率 |
| `MULTICA_DAEMON_HEARTBEAT_INTERVAL` | `15s` | 心跳频率 |

Agent 专属 override：

| 变量 | 说明 |
|---|---|
| `MULTICA_CLAUDE_PATH` | 自定义 `claude` binary 路径 |
| `MULTICA_CLAUDE_MODEL` | 覆盖 Claude 使用的模型 |
| `MULTICA_CODEX_PATH` | 自定义 `codex` binary 路径 |
| `MULTICA_CODEX_MODEL` | 覆盖 Codex 使用的模型 |
| `MULTICA_COPILOT_PATH` | 自定义 `copilot`（GitHub Copilot CLI）binary 路径 |
| `MULTICA_COPILOT_MODEL` | 覆盖 Copilot 使用的模型；注意 GitHub Copilot 会按账号 entitlement 路由模型，可能不会完全遵守 |
| `MULTICA_OPENCODE_PATH` | 自定义 `opencode` binary 路径 |
| `MULTICA_OPENCODE_MODEL` | 覆盖 OpenCode 使用的模型 |
| `MULTICA_OPENCLAW_PATH` | 自定义 `openclaw` binary 路径 |
| `MULTICA_OPENCLAW_MODEL` | 覆盖 OpenClaw 使用的模型 |
| `MULTICA_HERMES_PATH` | 自定义 `hermes` binary 路径 |
| `MULTICA_HERMES_MODEL` | 覆盖 Hermes 使用的模型 |
| `MULTICA_GEMINI_PATH` | 自定义 `gemini` binary 路径 |
| `MULTICA_GEMINI_MODEL` | 覆盖 Gemini 使用的模型 |
| `MULTICA_PI_PATH` | 自定义 `pi` binary 路径 |
| `MULTICA_PI_MODEL` | 覆盖 Pi 使用的模型 |
| `MULTICA_CURSOR_PATH` | 自定义 `cursor-agent` binary 路径 |
| `MULTICA_CURSOR_MODEL` | 覆盖 Cursor Agent 使用的模型 |

## 数据库设置

Multica 需要 PostgreSQL 17 和 pgvector extension。

### 使用 Docker Compose（推荐）

`docker-compose.selfhost.yml` 已包含 PostgreSQL，不需要单独设置。

### 使用自己的 PostgreSQL

如果使用已有 PostgreSQL，请确认 pgvector extension 可用：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

然后在 `.env` 中设置 `DATABASE_URL`，并从 compose 文件中移除 `postgres` 服务。

### 手动运行迁移

Docker Compose 安装会自动运行迁移。如果需要手动运行：

```bash
# 使用构建出的二进制
./server/bin/migrate up

# 或从源码运行
cd server && go run ./cmd/migrate up
```

## 手动安装（不使用 Docker Compose）

如果想手动构建并运行服务：

**前置条件：** Go 1.26+、Node.js 20+、pnpm 10.28+、PostgreSQL 17 + pgvector。

```bash
# 启动 PostgreSQL（或使用：docker compose up -d postgres）

# 构建 backend
make build

# 运行数据库迁移
DATABASE_URL="your-database-url" ./server/bin/migrate up

# 启动 backend server
DATABASE_URL="your-database-url" PORT=8080 JWT_SECRET="your-secret" ./server/bin/server
```

前端：

```bash
pnpm install
pnpm build

# 启动前端（production mode）
cd apps/web
REMOTE_API_URL=http://localhost:8080 pnpm start
```

## 反向代理

生产环境建议在 backend 和 frontend 前面放反向代理，负责 TLS 和路由。

### Caddy（推荐）

```caddy
app.example.com {
    reverse_proxy localhost:3000
}

api.example.com {
    reverse_proxy localhost:8080
}
```

### Nginx

```nginx
# Frontend
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

前后端使用不同域名时，设置：

```bash
# Backend
FRONTEND_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com

# Frontend（仅当你通过 docker-compose.selfhost.build.yml 从源码构建 web image 时）
REMOTE_API_URL=https://api.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws
```

## LAN / 非 localhost 访问

默认情况下 Multica 面向 `localhost`。如果要从 LAN 中另一台机器访问，例如 `http://192.168.1.100:3000`，需要告诉 backend 接受该 origin：

```bash
# .env — 替换成你的 server LAN IP
FRONTEND_ORIGIN=http://192.168.1.100:3000
CORS_ALLOWED_ORIGINS=http://192.168.1.100:3000
```

然后重启 stack：

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

### LAN / 非 localhost 的 WebSocket

HTTP 请求（issues、comments、uploads）在 LAN 中默认可用，因为 Next.js rewrites 会把 `/api`、`/auth`、`/uploads` 代理到 backend。**WebSocket 不会默认可用**：Next.js rewrites 只转发 HTTP 请求，不处理 WebSocket 需要的 `Upgrade` handshake。如果你用 `http://<lan-ip>:3000` 打开应用，实时功能（chat streaming、实时 issue 更新、通知）会连接失败，直到你做其中一件事：

1. **在 stack 前放反向代理（推荐）。** Nginx 或 Caddy 负责 WebSocket upgrade，并转发到 backend 8080。上面的 Nginx 示例已经包含正确的 `location /ws { ... }`。
2. **把 WebSocket URL 构建进 web image。** 如果没有反向代理，使用 `NEXT_PUBLIC_WS_URL` 指向 backend（浏览器必须能访问 8080）：

   ```bash
   # In .env
   NEXT_PUBLIC_WS_URL=ws://<lan-ip>:8080/ws

   # 重新构建 web image，把 build-time 值写进去
   docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build
   ```

`NEXT_PUBLIC_WS_URL` 是 build-time 变量（见 `Dockerfile.web`），只在预构建 image 的 `environment:` 中设置不会生效；必须使用 `selfhost.build.yml` override 重新构建。

## 健康检查

Backend 暴露公开健康检查端点：

```text
GET /health
→ {"status":"ok"}

GET /readyz
→ {"status":"ok","checks":{"db":"ok","migrations":"ok"}}

GET /healthz
→ same response as /readyz
```

`/health` 用于基础存活/可达性检查。`/readyz` 用于依赖感知 readiness probe 和外部监控：数据库不可用或迁移未完全应用时应该失败。`/healthz` 保留为别名，方便 operator 使用。

## Prometheus Metrics

Backend 可以在独立 management listener 上暴露 Prometheus metrics：

```bash
METRICS_ADDR=127.0.0.1:9090 ./server/bin/server
curl http://127.0.0.1:9090/metrics
```

`METRICS_ADDR` 默认为空，因此不会启动 metrics listener。公网 API 端口不提供 `/metrics`，面向互联网部署时应保持如此。HTTP request metrics 只有在 metrics listener 启用后才开始累计。Metrics 可能暴露内部路由、流量、依赖状态和 runtime health。

Docker 或 Kubernetes 部署建议使用私有 scrape 路径：把 metrics listener 绑定到内部接口，并用私有网络、allowlist、NetworkPolicy 或代理认证保护。如果在容器内绑定 `METRICS_ADDR=0.0.0.0:9090`，只把该端口发布到可信网络，例如 host-local 映射 `127.0.0.1:9090:9090`。

## 升级

```bash
docker compose -f docker-compose.selfhost.yml pull
docker compose -f docker-compose.selfhost.yml up -d
```

如果想固定版本，在 `.env` 中把 `MULTICA_IMAGE_TAG` pin 到具体 release，例如 `v0.2.4`。迁移会在 backend 启动时自动运行，且是幂等的，重复运行不会产生影响。如果选中的 GHCR tag 尚未发布，回退到：

```bash
docker compose -f docker-compose.selfhost.yml -f docker-compose.selfhost.build.yml up -d --build
```
