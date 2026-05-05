# 产品分析事件

这份文档是 Multica 发送到 PostHog 的分析事件单一事实来源。事件用于支撑 acquisition -> activation -> expansion 漏斗，并服务于每周活跃工作区（WAW）这个北极星指标。

设计背景见 [MUL-1122](https://github.com/multica-ai/multica)。

## 配置

所有分析事件发送都由环境变量控制（见 `.env.example`）：

| 变量 | 含义 | 默认值 |
|---|---|---|
| `POSTHOG_API_KEY` | PostHog project API key。为空时不发送任何事件。 | `""` |
| `POSTHOG_HOST` | PostHog host（美国/EU cloud，或自托管 URL）。 | `https://us.i.posthog.com` |
| `ANALYTICS_DISABLED` | 设为 `true`/`1` 时，即使设置了 `POSTHOG_API_KEY` 也强制使用 no-op client。 | `""` |

本地开发和自部署实例默认使用 `POSTHOG_API_KEY=""`，因此**除非 operator 明确 opt in，否则不会有事件离开进程**。

### 自部署实例

自部署者**绝不能继承 Multica 官方签发的 `POSTHOG_API_KEY`**，否则会把他们用户的行为发送到我们的分析项目。默认配置保证了这一点：

- `.env.example` 中 `POSTHOG_API_KEY=` 为空；Docker self-host compose 也不设置默认值。
- key 未设置时，`NewFromEnv` 返回 `NoopClient`，启动时记录 `analytics: POSTHOG_API_KEY not set, using noop client`，明确说明没有事件发送。
- 想使用自有分析的 operator 可以设置 `POSTHOG_API_KEY` 和 `POSTHOG_HOST`，指向自己的 PostHog project（Cloud 或 self-hosted PostHog）。
- 前端通过 `/api/config` 获取 key，因此自部署 server 的空配置也会自动禁用前端事件发送，不需要额外的前端 opt-out。

## 架构

```text
handler -> analytics.Client.Capture(Event)   <- 非阻塞，立即返回
                    |
                    v
           bounded queue (1024 events)
                    |
                    v
     background worker: batch + POST /batch/
                    |
                    v
                PostHog
```

- `analytics.Capture` **绝不能阻塞 request handler**。分析后端故障不能影响产品可用性；队列满时丢弃事件并计数（通过 `slog` 和 shutdown 时的 `dropped` counter 可见）。
- 当达到 `BatchSize` 或到达 `FlushEvery`（默认 10 秒）时 flush batch，以先发生者为准。
- `Close()` 会在 graceful shutdown 时排空剩余事件；由 `server/cmd/server/main.go` 通过 `defer` 调用。

## 身份模型

- **`distinct_id`**：登录态事件始终使用用户 UUID。前端 `posthog.identify(user.id)` 会把之前匿名事件合并到同一身份下，因此 signup 前的 UTM / referrer 归因不会丢失。
- **`workspace_id`**：存在时作为属性附加到每个事件。v1 使用 event property filtering（免费层）而不是 PostHog Groups Analytics（付费）计算工作区级指标。
- **PII**：事件携带 `email_domain`（例如 `gmail.com`），不携带完整 email。完整 email 只通过 person properties 的 `$set_once` 存一次，方便单用户调试，但不会随每个事件广播。
- **Person properties（`$set`）**：用于可变 cohort 信号，例如 role、use_case、team_size、platform_preference，这些值可能在 onboarding 中被用户合法修改。后端 `Event.Set` 映射到 `$set`；前端 helper 是 `@multica/core/analytics` 中的 `setPersonProperties()`。只有永远不应覆盖的值（email、初始归因、首次完成时间）才用 `$set_once`。

## 事件契约

### `signup`

创建新用户时触发。覆盖验证码登录和 Google OAuth 两个入口（`findOrCreateUser` 是唯一发送点）。

| 属性 | 类型 | 说明 |
|---|---|---|
| `email_domain` | string | 用户 email 的小写域名部分。 |
| `signup_source` | string | 前端 cookie `multica_signup_source` 中的不透明归因 bundle（UTM + referrer）。cookie 不存在时为空。 |
| `auth_method` | string | 可选。Google OAuth signup 为 `"google"`；验证码 signup 不设置。 |

通过 `$set_once` 设置的 person properties：

| 属性 | 类型 | 说明 |
|---|---|---|
| `email` | string | 完整 email。不随事件广播。 |
| `signup_source` | string | 同上，保存在 person 上便于后续分群。 |

### `workspace_created`

`CreateWorkspace` 事务成功提交后触发。

| 属性 | 类型 | 说明 |
|---|---|---|
| `workspace_id` | string (UUID) | 全局附加；这里列出只是为了清晰。 |

**关于“第一个工作区”的分群说明**：我们刻意不在发送时写入 `is_first_workspace` boolean。正确计算它需要额外列或事务内逻辑，而且并发创建时仍会竞态。PostHog 可以通过用户是否已有更早的 `workspace_created` 事件精确回答同一问题（使用 “first time user does X” funnel 或基于 `person_properties.$initial_event` 的 cohort），信息没有丢失。

### `runtime_registered`

第一次 upsert 某个 `(workspace_id, daemon_id, provider)` tuple 时触发。心跳和重复注册不会再次发送。首次检测使用 Postgres upsert RETURNING 子句里的 `xmax = 0`，不需要额外查询，也没有竞态。

| 属性 | 类型 | 说明 |
|---|---|---|
| `runtime_id` | string (UUID) | 新建的 `agent_runtime` row id。 |
| `provider` | string | 例如 `"codex"`、`"claude"`。 |
| `runtime_version` | string | agent runtime binary 的版本。 |
| `cli_version` | string | 注册它的 `multica` CLI 版本。 |

如果 daemon 通过成员 JWT/PAT 注册，`distinct_id` 使用已认证 owner 的 user id；daemon-token 注册回退到 `workspace:<workspace_id>`，避免 PostHog 把无关 daemon 归到同一个 “anonymous” person 下。

### `issue_executed`

**每个 issue 最多触发一次**：当该 issue 上第一个 task 到达 terminal `done` 状态时触发。由原子更新保障：

```sql
UPDATE issue SET first_executed_at = now()
WHERE id = $1 AND first_executed_at IS NULL
RETURNING *
```

重试、重新分配和评论触发的后续 task 都会命中 WHERE 条件并 no-op，因此 `>=1 / >=2 / >=5 / >=10` 漏斗 bucket 统计的是不同 issue，而不是 task。

| 属性 | 类型 | 说明 |
|---|---|---|
| `issue_id` | string (UUID) | Issue ID。 |
| `task_duration_ms` | int64 | `task.started_at` 到 `task.completed_at` 的墙钟时间。task 创建时已是完成状态时为 0（少见）。 |

`distinct_id` 优先使用 issue 的人类创建者，使 agent 执行事件落到 issue 作者的 person profile 中（与 `signup`、`workspace_created` 一致）。agent 创建的 issue 使用 `agent:` 前缀，避免 PostHog 把 agent 合并成用户记录。

**关于 workspace 第 N 次完成的序号说明**：我们刻意不在发送时写入 `nth_issue_for_workspace`。正确计算需要串行化事务或按 workspace 加 advisory lock；两个并发首次完成否则都可能读到 `count=1` 并发送 `n=1`。PostHog 可以在查询时通过 `row_number() OVER (PARTITION BY properties.workspace_id ORDER BY timestamp)` 回答同一问题，也可以表达 “workspace has had >=2 `issue_executed` events” 这种 funnel step。信息没有丢失。

### `team_invite_sent`

`CreateInvitation` 写入 DB row 后触发。

| 属性 | 类型 | 说明 |
|---|---|---|
| `invited_email_domain` | string | 小写域名；完整 email 保存在 invitation row，不进入事件。 |
| `invite_method` | string | 当前始终是 `"email"`。未来非 email 邀请流（分享链接、SCIM）应传自己的值。 |

`distinct_id` 是邀请人的 user id。

### `team_invite_accepted`

`AcceptInvitation` 在同一事务中标记 invitation accepted 并插入 member row 后触发。

| 属性 | 类型 | 说明 |
|---|---|---|
| `days_since_invite` | int64 | 从邀请创建到接受之间的完整天数。用于区分“当天接受”（warm）和“几周后从邮件里翻出来”（cold）。 |

`distinct_id` 是被邀请人的 user id；这是 expansion funnel 的闭环事件。

### `onboarding_questionnaire_submitted`

第一次 `PatchOnboarding` 将用户 questionnaire JSONB 从“至少一个 slot 为空”转为“三个字段都填完”（team_size、role、use_case）时触发。之后的修改不再触发，漏斗统计用户而不是编辑次数。

| 属性 | 类型 | 说明 |
|---|---|---|
| `team_size` | string | `solo` / `team` / `other`。 |
| `role` | string | `developer` / `product_lead` / `writer` / `founder` / `other`。 |
| `use_case` | string | `coding` / `planning` / `writing_research` / `explore` / `other`。 |
| `team_size_has_other` | bool | 用户填写 Q1 自由文本 escape 时为 `true`。 |
| `role_has_other` | bool | 同上，对应 Q2。 |
| `use_case_has_other` | bool | 同上，对应 Q3。 |

通过 `$set` 设置的 person properties（不是 once，用户提交前可以回去改）：

| 属性 | 类型 | 说明 |
|---|---|---|
| `team_size` | string | 镜像事件属性，方便 cohort 查询。 |
| `role` | string | 同上。 |
| `use_case` | string | 同上。 |

`distinct_id` 是用户 id。没有 `workspace_id`，因为 questionnaire 属于用户，不属于工作区。

### `agent_created`

每次成功 `POST /api/workspaces/:id/agents` 都触发。它不是 onboarding 专用事件；`is_first_agent_in_workspace` 属性用于从后续新增 agent 中隔离 Step 4 信号。

| 属性 | 类型 | 说明 |
|---|---|---|
| `agent_id` | string (UUID) | Agent ID。 |
| `provider` | string | agent 绑定的 runtime provider（`claude`、`codex` 等）。 |
| `template` | string | 用于初始化 agent 的 template slug（`coding` / `planning` / `writing` / `assistant`）。不是从 template picker 创建时为空。 |
| `is_first_agent_in_workspace` | bool | 插入前该 workspace 没有任何 agent 时为 `true`。 |

`distinct_id` 是已认证 owner 的 user id。

### `onboarding_completed`

第一次 `CompleteOnboarding` 真正把 `user.onboarded_at` 从 NULL 改为非空时触发。服务端重试是幂等的，但刻意不重复发送，所以漏斗只统计首次完成。客户端在 POST body 中发送 `completion_path`，标记用户从哪条路径退出 onboarding。

| 属性 | 类型 | 说明 |
|---|---|---|
| `completion_path` | string | `full` / `runtime_skipped` / `cloud_waitlist` / `skip_existing` / `unknown` 之一。见下方说明。 |
| `joined_cloud_waitlist` | bool | 从 `user.cloud_waitlist_email` 派生。与 `completion_path` 正交；用户可以提交 waitlist 表单后仍选择 CLI。 |

通过 `$set_once` 设置的 person properties：

| 属性 | 类型 | 说明 |
|---|---|---|
| `onboarded_at` | string (RFC3339) | 首次完成 onboarding 的时间戳。让 “users onboarded before X” 这类 cohort 可直接从 person_properties 查询。 |

`completion_path` 值：

- `full`：连接 runtime 后到达 Step 5（first_issue）。
- `runtime_skipped`：未连接 runtime 完成（用户在 Step 3 点击 Skip）。
- `cloud_waitlist`：提交 cloud waitlist 表单并跳过 Step 3。
- `skip_existing`：Welcome 页点击 “I've done this before”。用户已经有 workspace。
- `unknown`：旧客户端未发送 path 时的 fallback。上线后应接近 0。

### `cloud_waitlist_joined`

用户提交 Step 3 cloud waitlist 表单时由 `JoinCloudWaitlist` 触发。它不是完成信号，而是独立于主漏斗，用于估算 hosted-runtime 需求。

| 属性 | 类型 | 说明 |
|---|---|---|
| `has_reason` | bool | 自由文本 reason 字段是否存在。自由文本保存在 DB，不随事件广播。 |

`distinct_id` 是用户 id。

### `feedback_submitted`

`CreateFeedback` 在通过每用户每小时 rate-limit 检查并插入 `feedback` row 后触发。同一小时内被 429 限流的重试不会触发。自由文本 message 存在 DB 中，永不广播。

| 属性 | 类型 | 说明 |
|---|---|---|
| `message_length_bucket` | string | `0-100` / `100-500` / `500-2000` / `2000+`，按 `len(message)` 粗分，既能区分“短反馈”和“带复现步骤的 bug report”，又不泄露内容。 |
| `has_images` | bool | markdown 中至少包含一个 `![...](url)` 图片引用时为 `true`，表示可能是带视觉证据的 bug report。 |
| `platform` | string | `X-Client-Platform` header 中的客户端平台（`web` / `desktop`）。header 缺失时省略。 |
| `app_version` | string | `X-Client-Version` header 中的客户端版本。缺失时省略。 |

`distinct_id` 是提交者 user id；`workspace_id` 从 modal 当前工作区上下文附加，pre-workspace surface 发送反馈时可能为空。

### `starter_content_decided`

`ImportStarterContent` 和 `DismissStarterContent` 中，从 NULL 到 terminal state 的原子转换会触发。`branch` 属性和同一 workspace 下 ImportStarterContent 会发送的值一致，因此 import-vs-dismiss rate 可以按 branch 干净拆分。

| 属性 | 类型 | 说明 |
|---|---|---|
| `decision` | string | `imported` 或 `dismissed`。 |
| `branch` | string | `agent_guided`（decision 时 workspace 已有 >=1 agent）或 `self_serve`（无 agent）。 |

`distinct_id` 是用户 id；`workspace_id` 从请求 payload 附加。

### 仅前端事件

- `$pageview`：由 `apps/web/components/pageview-tracker.tsx` 在每次 Next.js App Router path 或 query-string 变化时触发。tracker 在 `WebProviders` 下只挂载一次，并驱动 acquisition funnel 的 `/ -> signup` 步骤。`initAnalytics` 中禁用了 posthog-js 自动 pageview capture，因此事件形态由我们控制。
- `onboarding_runtime_path_selected`：web 用户点击 Step 3 三个 fork card 之一时，由 `packages/views/onboarding/steps/step-platform-fork.tsx` 触发（发生在任何 server call 之前，所以是 frontend-only）。属性：`path`（`download_desktop` / `cli` / `cloud_waitlist`）、`source`（当前固定为 `step3`，为未来复用保留）、`is_mac`。同时写入 person property `platform_preference`（`web` / `desktop`）。注意：语义上的“下载意图”现在更适合用下面的 `download_intent_expressed`；`path: "download_desktop"` 只表示 Step 3 路径选择，不表示真正开始下载。
- `onboarding_runtime_detected`：desktop Step 3 中由 `packages/views/onboarding/steps/step-runtime-connect.tsx` 每次 mount 最多触发一次。扫描阶段结束时发送：可能是首次 runtime registration 立即成功，也可能是 5 秒空结果超时。它回答“用户进入 Step 3 时这台机器上是否安装了 AI CLI”这个问题；现有 funnel 无法回答，因为 bundled daemon 在零 CLI 时根本不会注册，`runtime_registered` 对这类用户静默。属性包括 `source`、`outcome`、`runtime_count`、`online_count`、`providers`、`has_claude` / `has_codex` / `has_cursor`、`detect_ms`。同时通过 `$set` 写入 `has_any_cli` 和 `detected_cli_count`。
- `download_intent_expressed`：用户点击指向 `/download` 页的 CTA 时触发。覆盖五个来源：`landing_hero` / `landing_footer` / `login` / `welcome` / `step3`。wrapper 位于 `packages/core/analytics/download.ts`（`captureDownloadIntent`）。同时写入 `platform_preference: "desktop"`。
- `download_page_viewed`：`/download` mount 且 OS 检测完成后触发一次（`apps/web/app/(landing)/download/download-client.tsx`）。属性：`detected_os`、`detected_arch`、`detect_confident`、`version_available`。同时通过 `$set_once` 写入 `first_detected_os` / `first_detected_arch`。
- `download_initiated`：用户点击 `/download` 上的具体安装包链接时触发。hero CTA 和 All Platforms 矩阵都会发送，用 `primary_cta` 区分。属性包括 `platform`、`arch`、`format`、`version`、`primary_cta`、`matched_detect`。
- `feedback_opened`：应用内 Feedback modal mount 时触发（用户从 Help launcher 点击 Feedback）。与后端 `feedback_submitted` 配对，用于计算表单完成率。wrapper 位于 `packages/core/analytics/feedback.ts`（`captureFeedbackOpened`）。属性：`source`（当前 `help_menu`，为未来入口保留）和可选 `workspace_id`。
- 归因不是单独事件；UTM + referrer origin 会在第一次匿名 pageview 时写入 `multica_signup_source` cookie，并由后端 `signup` 事件读取。cookie 写入时 URL encode（`encodeURIComponent`），读取时 URL decode（`url.QueryUnescape`）。JSON 不会被中途截断；单个值在 `JSON.stringify` 前限制为 96 字符，整个 payload 超过 512 字符时直接丢弃。因此 PostHog 要么看到完整 JSON，要么什么都看不到。

## 治理

添加、重命名或删除任何事件前：

1. 先更新本文档。
2. 更新 `server/internal/analytics/events.go` 中的常量和 helper。
3. PR 描述必须说明影响哪个现有 funnel / insight。
