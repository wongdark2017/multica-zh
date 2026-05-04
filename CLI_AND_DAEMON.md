# CLI 与 Agent Daemon 指南

`multica` CLI 用来把你的本地机器连接到 Multica。它负责认证、工作区管理、问题跟踪，并运行可在本地执行 AI 任务的 agent daemon。

## 安装

### Homebrew（macOS/Linux）

```bash
brew install multica-ai/tap/multica
```

### 从源码构建

```bash
git clone https://github.com/multica-ai/multica.git
cd multica
make build
cp server/bin/multica /usr/local/bin/multica
```

### 更新

```bash
brew upgrade multica-ai/tap/multica
```

对于安装脚本或手动安装，请使用：

```bash
multica update
```

`multica update` 会自动检测安装方式并执行相应升级。

## 快速开始

```bash
# 一条命令完成设置：配置、认证并启动 daemon
multica setup

# 自托管（本地）部署：
multica setup self-host
```

也可以逐步执行：

```bash
# 1. 认证（打开浏览器登录）
multica login

# 2. 启动 agent daemon
multica daemon start

# 3. 完成 — 你已监听的工作区中的 agents 现在可以在这台机器上执行任务
```

`multica login` 会自动发现你所属的所有工作区，并把它们加入 daemon 的监听列表。

## 认证

### 浏览器登录

```bash
multica login
```

打开浏览器进行 OAuth 认证，创建一个 90 天有效的个人访问令牌，并自动配置你的工作区。

### 令牌登录

```bash
multica login --token <mul_...>
```

直接使用个人访问令牌认证，适合无头环境。传入空值 `--token=` 可进入交互式提示，避免令牌进入 shell 历史记录。

### 检查状态

```bash
multica auth status
```

显示当前服务器、用户和令牌有效性。

### 登出

```bash
multica auth logout
```

移除已保存的认证令牌。

## Agent Daemon

daemon 是本地 agent 运行时。它会检测你机器上可用的 AI CLI，将它们注册到 Multica 服务器，并在 agents 被分配工作时执行任务。

### 启动

```bash
multica daemon start
```

默认情况下，daemon 在后台运行，并把日志写入 `~/.multica/daemon.log`。

以前台模式运行（便于调试）：

```bash
multica daemon start --foreground
```

### 停止

```bash
multica daemon stop
```

### 状态

```bash
multica daemon status
multica daemon status --output json
```

显示 PID、运行时长、检测到的 agents 和已监听的工作区。

### 日志

```bash
multica daemon logs              # 最近 50 行
multica daemon logs -f           # 跟随输出（tail -f）
multica daemon logs -n 100       # 最近 100 行
```

### 支持的 Agents

daemon 会从你的 PATH 中自动检测这些 AI CLI：

| CLI | 命令 | 说明 |
|-----|---------|-------------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude` | Anthropic 的编码 agent |
| [Codex](https://github.com/openai/codex) | `codex` | OpenAI 的编码 agent |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot) | `copilot` | GitHub 的编码 agent（模型由你的 GitHub 权益路由） |
| OpenCode | `opencode` | 开源编码 agent |
| OpenClaw | `openclaw` | 开源编码 agent |
| Hermes | `hermes` | Nous Research 编码 agent |
| Gemini | `gemini` | Google 的编码 agent |
| [Pi](https://pi.dev/) | `pi` | Pi 编码 agent |
| [Cursor Agent](https://cursor.com/) | `cursor-agent` | Cursor 的无头编码 agent |
| Kimi | `kimi` | Moonshot 编码 agent |
| Kiro CLI | `kiro-cli` | Kiro ACP 编码 agent |

你至少需要安装其中一个。daemon 会把每个检测到的 CLI 注册为可用运行时。

### 工作原理

1. 启动时，daemon 检测已安装的 agent CLI，并为每个已监听工作区中的每个 agent 注册运行时
2. 它按可配置间隔轮询服务器（默认 `3s`），获取已认领的任务
3. 任务到达时，它会创建隔离的工作区目录，启动 agent CLI，并把结果流式传回
4. 它会定期发送心跳（默认 `15s`），让服务器知道 daemon 仍在线
5. 关闭时，所有运行时都会注销

### 配置

daemon 行为可通过 flags 或环境变量配置：

| 设置 | Flag | 环境变量 | 默认值 |
|---------|------|--------------|---------|
| 轮询间隔 | `--poll-interval` | `MULTICA_DAEMON_POLL_INTERVAL` | `3s` |
| 心跳间隔 | `--heartbeat-interval` | `MULTICA_DAEMON_HEARTBEAT_INTERVAL` | `15s` |
| Agent 超时 | `--agent-timeout` | `MULTICA_AGENT_TIMEOUT` | `2h` |
| Codex 语义空闲超时 | `--codex-semantic-inactivity-timeout` | `MULTICA_CODEX_SEMANTIC_INACTIVITY_TIMEOUT` | `10m` |
| 最大并发任务数 | `--max-concurrent-tasks` | `MULTICA_DAEMON_MAX_CONCURRENT_TASKS` | `20` |
| Daemon ID | `--daemon-id` | `MULTICA_DAEMON_ID` | hostname |
| 设备名称 | `--device-name` | `MULTICA_DAEMON_DEVICE_NAME` | hostname |
| 运行时名称 | `--runtime-name` | `MULTICA_AGENT_RUNTIME_NAME` | `Local Agent` |
| 工作区根目录 | — | `MULTICA_WORKSPACES_ROOT` | `~/multica_workspaces` |
| GC 启用 | — | `MULTICA_GC_ENABLED` | `true`（设为 `false`/`0` 可禁用） |
| GC 扫描间隔 | — | `MULTICA_GC_INTERVAL` | `1h` |
| GC TTL（done/cancelled issues） | — | `MULTICA_GC_TTL` | `24h` |
| GC 孤儿 TTL（无 `.gc_meta.json`） | — | `MULTICA_GC_ORPHAN_TTL` | `72h` |
| GC 构件 TTL（open issues） | — | `MULTICA_GC_ARTIFACT_TTL` | `12h`（设为 `0` 可禁用） |
| GC 构件模式 | — | `MULTICA_GC_ARTIFACT_PATTERNS` | `node_modules,.next,.turbo` |

#### 工作区垃圾回收

daemon 会定期扫描 `MULTICA_WORKSPACES_ROOT`，并通过三种模式回收磁盘空间：

- **完整任务清理** — 当 issue 状态为 `done` 或 `cancelled`，且空闲时间超过 `MULTICA_GC_TTL` 时，移除整个任务目录。
- **孤儿清理** — 没有 `.gc_meta.json` 的任务目录（例如 daemon 崩溃后遗留）在超过 `MULTICA_GC_ORPHAN_TTL` 后会被移除。
- **仅构件清理** — 当任务完成时间至少达到 `MULTICA_GC_ARTIFACT_TTL`，但 issue 仍处于打开状态时，移除目录基本名匹配 `MULTICA_GC_ARTIFACT_PATTERNS` 的可再生成构建输出；其余工作目录内容（源码、`.git`、`output/`、`logs/`、`.gc_meta.json`）会保留，以便 agent 在下一次任务中继续使用同一个工作目录。

模式只匹配 basename。包含 `/` 或 `\` 的条目会被静默丢弃，且永远不会进入 `.git` 子树。默认列表（`node_modules`、`.next`、`.turbo`）有意保持较窄；如果你的仓库持续产生其他可再生成目录，可以按部署扩展它，例如 `MULTICA_GC_ARTIFACT_PATTERNS=node_modules,.next,.turbo,target,__pycache__`。要完全禁用构件清理，请设置 `MULTICA_GC_ARTIFACT_TTL=0`。

Agent 专用覆盖项：

| 变量 | 说明 |
|----------|-------------|
| `MULTICA_CLAUDE_PATH` | 自定义 `claude` 二进制路径 |
| `MULTICA_CLAUDE_MODEL` | 覆盖使用的 Claude 模型 |
| `MULTICA_CLAUDE_ARGS` | Claude Code 运行的默认额外参数 |
| `MULTICA_CODEX_PATH` | 自定义 `codex` 二进制路径 |
| `MULTICA_CODEX_MODEL` | 覆盖使用的 Codex 模型 |
| `MULTICA_CODEX_ARGS` | Codex 运行的默认额外参数 |
| `MULTICA_COPILOT_PATH` | 自定义 `copilot` 二进制路径 |
| `MULTICA_COPILOT_MODEL` | 覆盖使用的 Copilot 模型（注意：GitHub Copilot 会通过你的账号权益路由模型，因此该设置不一定生效） |
| `MULTICA_OPENCODE_PATH` | 自定义 `opencode` 二进制路径 |
| `MULTICA_OPENCODE_MODEL` | 覆盖使用的 OpenCode 模型 |
| `MULTICA_OPENCLAW_PATH` | 自定义 `openclaw` 二进制路径 |
| `MULTICA_OPENCLAW_MODEL` | 覆盖使用的 OpenClaw 模型 |
| `MULTICA_HERMES_PATH` | 自定义 `hermes` 二进制路径 |
| `MULTICA_HERMES_MODEL` | 覆盖使用的 Hermes 模型 |
| `MULTICA_GEMINI_PATH` | 自定义 `gemini` 二进制路径 |
| `MULTICA_GEMINI_MODEL` | 覆盖使用的 Gemini 模型 |
| `MULTICA_PI_PATH` | 自定义 `pi` 二进制路径 |
| `MULTICA_PI_MODEL` | 覆盖使用的 Pi 模型 |
| `MULTICA_CURSOR_PATH` | 自定义 `cursor-agent` 二进制路径 |
| `MULTICA_CURSOR_MODEL` | 覆盖使用的 Cursor Agent 模型 |
| `MULTICA_KIMI_PATH` | 自定义 `kimi` 二进制路径 |
| `MULTICA_KIMI_MODEL` | 覆盖使用的 Kimi 模型 |
| `MULTICA_KIRO_PATH` | 自定义 `kiro-cli` 二进制路径 |
| `MULTICA_KIRO_MODEL` | 覆盖使用的 Kiro 模型 |

`MULTICA_CLAUDE_ARGS` 和 `MULTICA_CODEX_ARGS` 会按 POSIX shellword 引号规则解析，因此像 `--model "gpt-5.1 codex" --sandbox read-only` 这样的值会像 shell 命令行一样被拆分。Agent 参数应用顺序为：Multica 硬编码默认值、daemon 级环境默认值、任务中的每个 agent `custom_args`。

### 自托管服务器

连接到自托管 Multica 实例时，最简单的方法是：

```bash
# 一条命令 — 配置 localhost、认证并启动 daemon
multica setup self-host

# 或用于带自定义域名的本地部署：
multica setup self-host --server-url https://api.example.com --app-url https://app.example.com
```

也可以手动配置：

```bash
# 单独设置 URL
multica config set server_url http://localhost:8080
multica config set app_url http://localhost:3000

# 使用 TLS 的生产环境：
# multica config set server_url https://api.example.com
# multica config set app_url https://app.example.com

multica login
multica daemon start
```

### 配置档案

配置档案允许你在同一台机器上运行多个 daemon，例如一个用于生产环境，一个用于预发服务器。

```bash
# 设置预发配置档案
multica setup self-host --profile staging --server-url https://api-staging.example.com --app-url https://staging.example.com

# 启动该配置档案的 daemon
multica daemon start --profile staging

# 默认配置档案单独运行
multica daemon start
```

每个配置档案都有自己的配置目录（`~/.multica/profiles/<name>/`）、daemon 状态、健康检查端口和工作区根目录。

## 工作区

### 列出工作区

```bash
multica workspace list
```

已监听的工作区会用 `*` 标记。daemon 只处理已监听工作区的任务。

### 监听/取消监听

```bash
multica workspace watch <workspace-id>
multica workspace unwatch <workspace-id>
```

### 获取详情

```bash
multica workspace get <workspace-id>
multica workspace get <workspace-id> --output json
```

### 列出成员

```bash
multica workspace members <workspace-id>
```

## Issues

### 列出 Issues

```bash
multica issue list
multica issue list --status in_progress
multica issue list --priority urgent --assignee "Agent Name"
multica issue list --limit 20 --output json
```

可用过滤器：`--status`、`--priority`、`--assignee`、`--project`、`--limit`。

### 获取 Issue

```bash
multica issue get <id>
multica issue get <id> --output json
```

### 创建 Issue

```bash
multica issue create --title "Fix login bug" --description "..." --priority high --assignee "Lambda"
```

Flags：`--title`（必填）、`--description`、`--status`、`--priority`、`--assignee`、`--parent`、`--project`、`--due-date`。

### 更新 Issue

```bash
multica issue update <id> --title "New title" --priority urgent
```

### 分配 Issue

```bash
multica issue assign <id> --to "Lambda"
multica issue assign <id> --unassign
```

### 修改状态

```bash
multica issue status <id> in_progress
```

有效状态：`backlog`、`todo`、`in_progress`、`in_review`、`done`、`blocked`、`cancelled`。

### 评论

```bash
# 列出评论
multica issue comment list <issue-id>

# 添加评论
multica issue comment add <issue-id> --content "Looks good, merging now"

# 回复特定评论
multica issue comment add <issue-id> --parent <comment-id> --content "Thanks!"

# 删除评论
multica issue comment delete <comment-id>
```

### 订阅者

```bash
# 列出 issue 的订阅者
multica issue subscriber list <issue-id>

# 订阅当前用户到 issue
multica issue subscriber add <issue-id>

# 按名称订阅另一个成员或 agent
multica issue subscriber add <issue-id> --user "Lambda"

# 取消订阅当前用户
multica issue subscriber remove <issue-id>

# 取消订阅另一个成员或 agent
multica issue subscriber remove <issue-id> --user "Lambda"
```

订阅者会收到 issue 活动通知（新评论、状态变更等）。不传 `--user` 时，命令作用于调用者本人。

### 执行历史

```bash
# 列出 issue 的所有执行运行
multica issue runs <issue-id>
multica issue runs <issue-id> --output json

# 查看特定执行运行的消息
multica issue run-messages <task-id>
multica issue run-messages <task-id> --output json

# 增量获取（只获取给定序号之后的消息）
multica issue run-messages <task-id> --since 42 --output json
```

`runs` 命令会显示一个 issue 的所有过去和当前执行，包括正在运行的任务。`run-messages` 命令会显示单次运行的详细消息日志（工具调用、思考、文本、错误）。使用 `--since` 可高效轮询进行中的运行。

## 项目

项目用于组合相关 issues（例如 sprint、epic、workstream）。每个项目属于一个工作区，并可选择设置负责人（成员或 agent）。

### 列出项目

```bash
multica project list
multica project list --status in_progress
multica project list --output json
```

可用过滤器：`--status`。

### 获取项目

```bash
multica project get <id>
multica project get <id> --output json
```

### 创建项目

```bash
multica project create --title "2026 Week 16 Sprint" --icon "🏃" --lead "Lambda"
```

Flags：`--title`（必填）、`--description`、`--status`、`--icon`、`--lead`。

### 更新项目

```bash
multica project update <id> --title "New title" --status in_progress
multica project update <id> --lead "Lambda"
```

Flags：`--title`、`--description`、`--status`、`--icon`、`--lead`。

### 修改状态

```bash
multica project status <id> in_progress
```

有效状态：`planned`、`in_progress`、`paused`、`completed`、`cancelled`。

### 删除项目

```bash
multica project delete <id>
```

### 将 Issues 关联到项目

在 `issue create` / `issue update` 中使用 `--project` flag 可把 issue 附加到项目；在 `issue list` 中使用它可按项目过滤 issues：

```bash
multica issue create --title "Login bug" --project <project-id>
multica issue update <issue-id> --project <project-id>
multica issue list --project <project-id>
```

## 设置

```bash
# Multica Cloud 一条命令设置：配置、认证并启动 daemon
multica setup

# 本地自托管部署
multica setup self-host

# 自定义端口
multica setup self-host --port 9090 --frontend-port 4000

# 带自定义域名的本地部署
multica setup self-host --server-url https://api.example.com --app-url https://app.example.com
```

`multica setup` 会配置 CLI、打开浏览器进行认证并启动 daemon。使用 `multica setup self-host` 可连接到自托管服务器，而不是 Multica Cloud。

## 配置

### 查看配置

```bash
multica config show
```

显示配置文件路径、server URL、app URL 和默认工作区。

### 设置值

```bash
multica config set server_url https://api.example.com
multica config set app_url https://app.example.com
multica config set workspace_id <workspace-id>
```

## Autopilot 命令

Autopilots 是定时/触发式自动化，会分派 agent 任务（通过创建 issue 或直接运行 agent）。

### 列出 Autopilots

```bash
multica autopilot list
multica autopilot list --status active --output json
```

### 获取 Autopilot 详情

```bash
multica autopilot get <id>
multica autopilot get <id> --output json   # 包含 triggers
```

### 创建/更新/删除

```bash
multica autopilot create \
  --title "Nightly bug triage" \
  --description "Scan todo issues and prioritize." \
  --agent "Lambda" \
  --mode create_issue

multica autopilot update <id> --status paused
multica autopilot update <id> --description "New prompt"
multica autopilot delete <id>
```

`--mode` 当前只接受 `create_issue`（每次运行都会创建新 issue 并分配给 agent）。服务端数据模型也定义了 `run_only`，但 daemon 任务路径尚无法为没有 issue 的运行解析工作区，因此 CLI 暂未暴露它。`--agent` 接受名称或 UUID。

### 手动触发

```bash
multica autopilot trigger <id>            # 触发一次 autopilot 并返回运行
```

### 运行历史

```bash
multica autopilot runs <id>
multica autopilot runs <id> --limit 50 --output json
```

### 定时触发器

```bash
multica autopilot trigger-add <autopilot-id> --cron "0 9 * * 1-5" --timezone "America/New_York"
multica autopilot trigger-update <autopilot-id> <trigger-id> --enabled=false
multica autopilot trigger-delete <autopilot-id> <trigger-id>
```

CLI 当前只暴露基于 cron 的 `schedule` 触发器。数据模型也定义了 `webhook` 和 `api` 类型，但目前没有服务端端点触发它们，因此这里未展示。

## 其他命令

```bash
multica version              # 显示 CLI 版本和 commit hash
multica update               # 更新到最新版本
multica agent list           # 列出当前工作区中的 agents
```

## 输出格式

大多数命令支持两种 `--output` 格式：

- `table` — 适合人阅读的表格（列表命令默认值）
- `json` — 结构化 JSON（适合脚本和自动化）

```bash
multica issue list --output json
multica daemon status --output json
```
