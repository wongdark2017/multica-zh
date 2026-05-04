# 贡献指南

本指南说明 Multica 代码库贡献者的本地开发流程。

内容包括：

- 首次设置
- 主 checkout 中的日常开发
- 隔离的 worktree 开发
- 共享 PostgreSQL 模型
- 测试与验证
- 全栈隔离测试（从源码运行后端、前端和 daemon）
- 故障排查与破坏性重置选项

## 开发模型

本地开发使用一个共享 PostgreSQL 容器，并为每个 checkout 使用一个独立数据库。

- 主 checkout 通常使用 `.env` 和 `POSTGRES_DB=multica`
- 每个 Git worktree 使用自己的 `.env.worktree`
- 每个 checkout 都连接到同一个 PostgreSQL host：`localhost:5432`
- 隔离发生在数据库层面，而不是启动单独的 Docker Compose 项目
- 后端和前端端口仍然按 worktree 保持唯一

这样可以保持 Docker 简单，同时隔离 schema 和数据。

## 前置条件

- Node.js `v20+`
- `pnpm` `v10.28+`
- Go `v1.26+`
- Docker

## 重要规则

- 主 checkout 应使用 `.env`。
- worktree 应使用 `.env.worktree`。
- 不要把 `.env` 复制到 worktree 目录。

原因：

- 当前命令流程会优先使用 `.env`，再使用 `.env.worktree`
- 如果 worktree 中存在 `.env`，它可能会意外指回主数据库

## 环境文件

### 主 Checkout

创建一次 `.env`：

```bash
cp .env.example .env
```

默认情况下，`.env` 指向：

```bash
POSTGRES_DB=multica
POSTGRES_PORT=5432
DATABASE_URL=postgres://multica:multica@localhost:5432/multica?sslmode=disable
PORT=8080
FRONTEND_PORT=3000
```

### Worktree

在 worktree 内生成 `.env.worktree`：

```bash
make worktree-env
```

它会生成类似这样的值：

```bash
POSTGRES_DB=multica_my_feature_702
POSTGRES_PORT=5432
PORT=18782
FRONTEND_PORT=13702
DATABASE_URL=postgres://multica:multica@localhost:5432/multica_my_feature_702?sslmode=disable
```

说明：

- `POSTGRES_DB` 对每个 worktree 唯一
- `POSTGRES_PORT` 固定为 `5432`
- 后端和前端端口从 worktree 路径哈希派生
- `make worktree-env` 会拒绝覆盖已存在的 `.env.worktree`

重新生成 worktree 环境文件：

```bash
FORCE=1 make worktree-env
```

## 首次设置

### 快速开始（推荐）

从任意 checkout（主 checkout 或 worktree）运行：

```bash
make dev
```

这条命令会：

- 自动检测当前处于主 checkout 还是 worktree
- 如果不存在合适的环境文件，则创建 `.env` 或 `.env.worktree`
- 检查前置条件（Node.js、pnpm、Go、Docker）是否已安装
- 安装 JavaScript 依赖
- 确保共享 PostgreSQL 容器正在运行
- 如果应用数据库不存在，则创建它
- 运行所有 migrations
- 启动后端和前端

### 显式设置（高级）

如果你希望分别控制设置和启动：

#### 主 Checkout

```bash
cp .env.example .env
make setup-main
make start-main
```

停止：

```bash
make stop-main
```

#### Worktree

```bash
make worktree-env
make setup-worktree
make start-worktree
```

停止：

```bash
make stop-worktree
```

## 推荐日常流程

### 主 Checkout

当你希望为 `main` 保持一个稳定的本地环境时，使用主 checkout。

```bash
make start-main
make stop-main
make check-main
```

### Feature Worktree

当你希望拥有隔离数据和独立应用端口时，使用 worktree。

```bash
git worktree add ../multica-feature -b feat/my-change main
cd ../multica-feature
make dev
```

之后的日常命令为：

```bash
make dev              # 启动（如有需要会重新执行设置，幂等）
make stop-worktree    # 停止
make check-worktree   # 验证
```

## 同时运行主 checkout 和 worktree

这是被一等支持的流程。

示例：

- 主 checkout
  - database：`multica`
  - backend：`8080`
  - frontend：`3000`
- worktree checkout
  - database：`multica_my_feature_702`
  - backend：生成的 worktree 端口，例如 `18782`
  - frontend：生成的 worktree 端口，例如 `13702`

两个 checkout 使用：

- 同一个 PostgreSQL 容器
- 同一个 PostgreSQL 端口：`5432`

但它们不会共享应用数据，因为各自使用不同数据库。

## 命令参考

### 共享基础设施

启动共享 PostgreSQL 容器：

```bash
make db-up
```

停止共享 PostgreSQL 容器：

```bash
make db-down
```

注意：

- `make db-down` 会停止容器，但保留 Docker volume
- 你的本地数据库会被保留

### 应用生命周期

主 checkout：

```bash
make setup-main
make start-main
make stop-main
make check-main
```

Worktree：

```bash
make worktree-env
make setup-worktree
make start-worktree
make stop-worktree
make check-worktree
```

当前 checkout 的通用 targets：

```bash
make setup
make start
make stop
make check
make dev
make test
make migrate-up
make migrate-down
```

这些通用 targets 要求当前目录中存在有效的环境文件。

## 数据库创建机制

数据库创建是自动完成的。

以下命令都会在继续执行前确保目标数据库存在：

- `make setup`
- `make start`
- `make dev`
- `make test`
- `make migrate-up`
- `make migrate-down`
- `make check`

该逻辑位于 `scripts/ensure-postgres.sh`。

## 测试

运行所有本地检查：

```bash
make check-main
```

或从 worktree 运行：

```bash
make check-worktree
```

它会运行：

1. TypeScript typecheck
2. TypeScript unit tests
3. Go tests
4. Playwright E2E tests

说明：

- Go tests 会创建自己的 fixture data
- E2E tests 会创建自己的 workspace 和 issue fixtures
- 检查流程只会在后端/前端尚未运行时启动它们

## 本地 Codex Daemon

运行本地 daemon：

```bash
make daemon
```

daemon 使用 CLI 已保存的令牌认证（`multica login`）。它会为 CLI 配置中所有已监听工作区注册运行时。

## 全栈隔离测试

本节说明如何从源码在完全隔离的环境中运行完整栈（后端、前端、daemon）。这适合测试跨多个组件的端到端变更，或用于需要零人工干预的自动化 CI/AI 工作流。

### 为什么不只用 `make daemon`？

`make daemon` 使用系统安装版 CLI 中保存的令牌，并连接到 `~/.multica/config.json` 中配置的任意服务器。这适合日常开发连接共享服务器，但完全隔离测试需要：

- 本地后端和前端（从源码运行）
- 带独立 profile 的本地 daemon（从源码运行）
- 自动认证（无需浏览器登录）
- 不干扰你的生产 CLI 配置

### 动态 Profile 命名

每个 worktree 必须使用唯一 daemon profile，避免多个功能并行运行时发生冲突。

profile 名称从 worktree 目录派生，使用与 `scripts/init-worktree-env.sh` 相同的 slug + hash 模式：

```bash
WORKTREE_DIR="$(basename "$PWD")"
SLUG="$(printf '%s' "$WORKTREE_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g; s/__*/_/g; s/^_//; s/_$//')"
HASH="$(printf '%s' "$PWD" | cksum | awk '{print $1}')"
OFFSET=$((HASH % 1000))
PROFILE="dev-${SLUG}-${OFFSET}"
```

示例：位于 `../multica-feat-auth` 的 worktree 会生成 profile `dev-multica_feat_auth-347`，并与该 worktree 的端口和数据库分配匹配。

### 启动隔离环境

所有步骤都从 worktree 根目录（包含 Makefile 的位置）运行。

#### 1. 启动后端、前端和数据库

```bash
make dev
```

等待后端健康：

```bash
PORT=$(grep '^PORT=' .env.worktree 2>/dev/null || grep '^PORT=' .env | head -1 | cut -d= -f2)
PORT=${PORT:-8080}
SERVER="http://localhost:${PORT}"

for i in $(seq 1 30); do
  curl -sf "$SERVER/health" > /dev/null 2>&1 && break
  sleep 2
done
```

#### 2. 创建测试用户和令牌（自动认证）

为了让本地自动化具有确定性，请在启动后端前，在环境文件中设置 `MULTICA_DEV_VERIFICATION_CODE=888888`：

```bash
curl -s -X POST "$SERVER/auth/send-code" \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@localhost"}'

JWT=$(curl -s -X POST "$SERVER/auth/verify-code" \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@localhost", "code": "888888"}' | jq -r '.token')

PAT=$(curl -s -X POST "$SERVER/api/tokens" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "auto-dev", "expires_in_days": 365}' | jq -r '.token')
```

#### 3. 创建工作区

```bash
WS=$(curl -s -X POST "$SERVER/api/workspaces" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dev", "slug": "dev"}' | jq -r '.id')
```

#### 4. 计算 profile 名称并写入 CLI 配置

```bash
# 计算 profile（见上文“动态 Profile 命名”）
WORKTREE_DIR="$(basename "$PWD")"
SLUG="$(printf '%s' "$WORKTREE_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g; s/__*/_/g; s/^_//; s/_$//')"
HASH="$(printf '%s' "$PWD" | cksum | awk '{print $1}')"
OFFSET=$((HASH % 1000))
PROFILE="dev-${SLUG}-${OFFSET}"

FRONTEND_PORT=$(grep '^FRONTEND_PORT=' .env.worktree 2>/dev/null || grep '^FRONTEND_PORT=' .env | head -1 | cut -d= -f2)
FRONTEND_PORT=${FRONTEND_PORT:-3000}

CONFIG_DIR="$HOME/.multica/profiles/$PROFILE"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.json" << EOF
{
  "server_url": "$SERVER",
  "app_url": "http://localhost:${FRONTEND_PORT}",
  "token": "$PAT",
  "workspace_id": "$WS",
  "watched_workspaces": [{"id": "$WS", "name": "Dev"}]
}
EOF
```

#### 5. 从源码启动 daemon

```bash
make cli ARGS="daemon start --profile $PROFILE"
```

daemon 会从当前 worktree 的 Go 源码运行，并连接到本地后端。Agent 执行的 `multica` 命令会自动使用同一个二进制（daemon 会把自己的目录前置到 `PATH`）。

### 停止隔离环境

```bash
# 计算 profile（相同公式）
PROFILE="dev-$(printf '%s' "$(basename "$PWD")" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g; s/__*/_/g; s/^_//; s/_$//')-$(( $(printf '%s' "$PWD" | cksum | awk '{print $1}') % 1000 ))"

# 1. 停止 daemon
make cli ARGS="daemon stop --profile $PROFILE"

# 2. 停止后端 + 前端
make stop            # 主 checkout
make stop-worktree   # worktree checkout

# 3.（可选）停止共享 PostgreSQL
make db-down

# 4.（可选）清理构建产物
make clean

# 5.（可选）移除 profile 配置
rm -rf "$HOME/.multica/profiles/$PROFILE"
```

### 桌面应用本地测试

要让 Electron 桌面应用连接本地后端：

```bash
# 后端启动后（make dev）
pnpm dev:desktop
```

它会自动：

1. 将 `server/cmd/multica` 中的 `multica` CLI 编译到 `apps/desktop/resources/bin/multica`
2. 创建一个名为 `desktop-localhost-<PORT>` 的隔离 profile
3. 启动并管理自己的 daemon 实例
4. 连接到本地后端

在 Desktop UI 中使用 `dev@localhost` 和后端日志中生成的验证码登录。如果你在启动后端前设置了 `MULTICA_DEV_VERIFICATION_CODE=888888`，也可以直接使用 `888888`。

如果后端运行在非默认端口（worktree），请创建 `apps/desktop/.env.development.local`：

```bash
VITE_API_URL=http://localhost:<backend-port>
VITE_WS_URL=ws://localhost:<backend-port>/ws
```

### 隔离保证

此流程不会触碰系统安装的 `multica` 或默认的 `~/.multica/config.json`：

| 资源 | 系统/生产 | 本地开发（每个 worktree） |
|---|---|---|
| Config | `~/.multica/config.json` | `~/.multica/profiles/dev-<slug>-<hash>/config.json` |
| Daemon PID | `~/.multica/daemon.pid` | `~/.multica/profiles/dev-<slug>-<hash>/daemon.pid` |
| Health port | `19514` | `19514 + 1 + (name_hash % 1000)` |
| Workspaces dir | `~/multica_workspaces/` | `~/multica_workspaces_dev-<slug>-<hash>/` |
| Database | remote / production | local Docker：`multica_<slug>_<hash>` |
| Desktop profile | `desktop-api.multica.ai` | `desktop-localhost-<port>` |

多个 worktree 可以同时运行且互不冲突。

## 故障排查

### 缺少环境文件

如果看到：

```text
Missing env file: .env
```

或：

```text
Missing env file: .env.worktree
```

请先创建预期的环境文件。

主 checkout：

```bash
cp .env.example .env
```

Worktree：

```bash
make worktree-env
```

### 检查 checkout 使用哪个数据库

查看环境文件：

```bash
cat .env
cat .env.worktree
```

关注：

- `POSTGRES_DB`
- `DATABASE_URL`
- `PORT`
- `FRONTEND_PORT`

### 列出共享 PostgreSQL 中的所有本地数据库

```bash
docker compose exec -T postgres psql -U multica -d postgres -At -c "select datname from pg_database order by datname;"
```

### Worktree 意外使用主数据库

检查 worktree 中是否存在 `.env`。

它不应该存在。

安全的 worktree 设置方式是：

```bash
make worktree-env
make setup-worktree
make start-worktree
```

### 应用停止但 PostgreSQL 仍在运行

这是预期行为。

- `make stop`
- `make stop-main`
- `make stop-worktree`

只会停止后端/前端进程。

要停止共享 PostgreSQL 容器：

```bash
make db-down
```

## 破坏性重置

如果你想停止 PostgreSQL 并保留本地数据库：

```bash
make db-down
```

如果你想为当前 checkout 使用全新数据库（删除 `POSTGRES_DB` 中命名的数据库，重新创建并运行所有 migrations）：

```bash
make stop        # 先停止后端/前端
make db-reset
make start
```

- 只影响当前环境的数据库；其他 worktree 数据库不受影响
- 如果 `DATABASE_URL` 指向远程 host，会拒绝运行
- 传入 `ENV_FILE=.env.worktree` 可指定某个 worktree

如果你想清空本仓库所有本地 PostgreSQL 数据：

```bash
docker compose down -v
```

警告：

- 这会删除共享 Docker volume
- 这会删除该 volume 中的主数据库和所有 worktree 数据库
- 之后必须重新运行 `make setup-main` 或 `make setup-worktree`

## 常用流程

### 稳定主环境

```bash
make dev
```

### Feature Worktree

```bash
git worktree add ../multica-feature -b feat/my-change main
cd ../multica-feature
make dev
```

### 回到已配置的 Worktree

```bash
cd ../multica-feature
make start-worktree
```

### 推送前验证

主 checkout：

```bash
make check-main
```

Worktree：

```bash
make check-worktree
```
