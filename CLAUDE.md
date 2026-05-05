# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库中处理代码时提供指导。

## 项目上下文

Multica 是一个 AI-native 的任务管理平台，类似 Linear，但把 AI agents 作为一等公民。

- Agents 可以被分配 issues、创建 issues、评论并修改状态
- 支持本地（daemon）和云端 agent runtimes
- 面向 2-10 人的 AI-native 团队构建

## 架构

**Go 后端 + 单仓库前端（pnpm workspaces + Turborepo），并带有共享包。**

- `server/` — Go 后端（Chi router、用于 DB 的 sqlc、用于实时通信的 gorilla/websocket）
- `apps/web/` — Next.js 前端（App Router）
- `apps/desktop/` — Electron 桌面应用（electron-vite）
- `packages/core/` — 无界面的业务逻辑（不依赖 react-dom，可跨平台复用）
- `packages/ui/` — 原子 UI 组件（无业务逻辑）
- `packages/views/` — 共享业务页面/组件（不导入 next/*，不导入 react-router）
- `packages/tsconfig/` — 共享 TypeScript 配置

### 关键架构决策

**Internal Packages 模式** — 所有共享包都导出原始 `.ts`/`.tsx` 文件（不预编译）。消费它们的应用 bundler 会直接编译这些文件。这带来零配置 HMR 和即时 go-to-definition。

**依赖方向：** `views/ → core/ + ui/`。Core 和 UI 彼此独立。任何包都不得导入 `next/*`、`react-router-dom` 或应用专属代码。

**平台桥接：** `packages/core/platform/` 提供 `CoreProvider`，用于初始化 API client、auth/workspace stores、WS connection 和 QueryClient。每个应用都用 `<CoreProvider>` 包裹根节点，并提供自己的 `NavigationAdapter` 处理路由。

**pnpm catalog** — `pnpm-workspace.yaml` 定义 `catalog:` 来固定版本。所有共享依赖都使用 `catalog:` 引用，保证所有包使用同一版本。添加新的共享依赖（包括测试依赖）时，必须先加入 catalog。

### 状态管理

该架构依赖服务端状态和客户端状态的严格分离。混用二者是破坏架构最常见的方式。

- **TanStack Query 管理所有服务端状态。** Issues、users、workspaces、inbox，任何从 API 获取的数据都存放在 Query cache 中。WS 事件通过 invalidation 保持其新鲜；不要使用 polling，也不要用 `staleTime` 规避。
- **Zustand 管理所有客户端状态。** UI 选择、过滤器、草稿、modal 状态、导航历史。Stores 位于 `packages/core/`（绝不在 `packages/views/` 中），这样两个应用可以共享。
- **React Context** 仅用于跨切面的平台管线，例如 `WorkspaceIdProvider`、`NavigationProvider`。不要把它用于一般状态。
- **Auth 和 workspace stores 是唯一允许直接调用 `api.*` 的 stores**，因为它们管理的是 queries 运行前必须存在的关键状态。它们通过 factory + injected dependencies 创建，并由 platform layer 注册。

**硬性规则 — 架构靠这些规则保持一致：**

- **绝不把服务端数据复制到 Zustand。** 如果数据来自 API，它就属于 Query cache。复制到 store 会产生两个事实来源，并最终漂移。
- **Workspace-scoped queries 必须以 `wsId` 作为 key。** 这样切换工作区才会自动生效：cache key 改变，正确数据出现，无需手动 invalidation。
- **Mutations 默认是 optimistic。** 先本地应用变更，再发送请求；失败则回滚，settle 时 invalidate。用户不应等待服务器。
- **WS 事件只 invalidate queries，绝不直接写入 stores。** 这能让 cache 保持为单一事实来源，并避免竞态。
- **只持久化值得跨重启保留的内容**（用户偏好、草稿、tab 布局）。**不要持久化临时 UI 状态**（modal 开关、瞬时选择）或服务端数据。

**常见 Zustand 陷阱：**

- Selectors 必须返回稳定引用。每次调用都返回新建 object 或 array（例如 `s => ({ a: s.a, b: s.b })` 或 `s => s.items.map(...)`）会触发无限重渲染。请分别选择 primitives，或使用 shallow comparison。
- 需要 workspace context 的 hooks 应接受 `wsId` 参数，而不是在内部调用 `useWorkspaceId()`。这样它们才能在 `WorkspaceIdProvider` 外部工作，例如 workspace 尚未加载前渲染的 sidebar。

## 命令

```bash
# 一条命令开发（自动设置并启动所有内容）
make dev              # 自动创建 env、安装依赖、启动 DB、迁移并启动 app

# 显式设置与运行（如果你希望拆开步骤）
make setup            # 首次：确保共享 DB、创建 app DB、迁移
make start            # 同时启动后端和前端
make stop             # 停止当前 checkout 的 app 进程
make db-down          # 停止共享 PostgreSQL 容器

# 前端（所有命令都通过 Turborepo）
pnpm install
pnpm dev:web          # Next.js dev server（端口 3000）
pnpm dev:desktop      # Electron dev（electron-vite，HMR）
pnpm build            # 构建所有前端应用
pnpm typecheck        # TypeScript 检查（所有 packages + apps，经 turbo）
pnpm lint             # ESLint
pnpm test             # TS tests（Vitest，所有 packages + apps，经 turbo）

# 后端（Go）
make server           # 仅运行 Go server（端口 8080）
make daemon           # 运行本地 daemon
make build            # 构建 server + CLI binaries 到 server/bin/
make cli ARGS="..."   # 运行 multica CLI（例如 make cli ARGS="config"）
make test             # Go tests
make sqlc             # 编辑 server/pkg/db/queries/ 中 SQL 后重新生成 sqlc code
make migrate-up       # 运行数据库 migrations
make migrate-down     # 回滚 migrations

# 运行单个 TS test（适用于任何带 test script 的 package）
pnpm --filter @multica/views exec vitest run auth/login-page.test.tsx
pnpm --filter @multica/core exec vitest run runtimes/version.test.ts
pnpm --filter @multica/web exec vitest run app/\(auth\)/login/page.test.tsx

# 运行单个 Go test
cd server && go test ./internal/handler/ -run TestName

# 运行单个 E2E test（需要后端 + 前端已启动）
pnpm exec playwright test e2e/tests/specific-test.spec.ts

# Desktop build & package
pnpm --filter @multica/desktop build      # 编译 TS → JS（读取 .env.production）
pnpm --filter @multica/desktop package    # 打包为 .app/.dmg/.exe（仅当前平台）

# shadcn — 配置位于 packages/ui/components.json（Base UI variant，base-nova style）
pnpm ui:add badge                # 将组件添加到 packages/ui/components/ui/

# 基础设施
make db-up            # 启动共享 PostgreSQL（pgvector/pg17 image）
make db-down          # 停止共享 PostgreSQL
make db-reset         # 删除并重建当前 env 的 DB，然后重新运行 migrations（仅本地；先停止后端）
```

### CI 要求

CI 运行在 Node 22 和 Go 1.26.1 上，并使用 `pgvector/pgvector:pg17` PostgreSQL service。见 `.github/workflows/ci.yml`。

### Worktree 支持

所有 checkouts 共享一个 PostgreSQL 容器。隔离发生在数据库层面：每个 worktree 都通过 `.env.worktree` 获得自己的 DB 名称和唯一端口。主 checkout 使用 `.env`。

`make dev` 会自动检测 worktree 并处理所有事情。需要显式控制时：

```bash
make worktree-env       # 生成带唯一 DB/ports 的 .env.worktree
make setup-worktree     # 使用 .env.worktree 设置
make start-worktree     # 使用 .env.worktree 启动
```

## 编码规则

- 启用 TypeScript strict mode；保持类型明确。
- Go code 遵循标准 Go 约定（gofmt、go vet）。
- 代码中的注释 **只能使用英文**。
- 优先使用既有 patterns/components，不要引入平行抽象。
- 除非用户明确要求 backwards compatibility，否则**不要**添加兼容层、fallback paths、dual-write logic、legacy adapters 或临时 shims。
- 如果某个 flow 或 API 正被替换，且产品尚未上线，优先移除旧路径，而不是同时保留新旧行为。
- 避免宽泛 refactors，除非任务需要。
- 新的全局（pre-workspace）routes 必须使用单个词（`/login`、`/inbox`）或 `/{noun}/{verb}` 组合（`/workspaces/new`）。绝不要添加带连字符的词组 root routes（`/new-workspace`、`/create-team`），它们会与常见用户 workspace 名称冲突，并迫使无止境的 reserved-slug 审计。保留 noun（`workspaces`）会自动保护整个 `/workspaces/*` 子树。

### Backend Handler UUID 解析约定

`server/internal/handler/` 中的每个 Go handler 都遵循这些规则。该约定存在是因为 `util.ParseUUID` 过去会在输入无效时静默返回 zero UUID，这导致了 #1661：`DELETE` 返回 204 success，但 SQL `DELETE` 匹配了零行。

- **接受 UUID 或人类可读标识符的资源 path params**（例如 issue 的 `chi.URLParam(r, "id")`，它同时接受 `MUL-123` 和 UUID）必须通过专用 loader 解析（`loadIssueForUser` / `loadSkillForUser` / `loadAgentForUser` / `requireDaemonRuntimeAccess`）。解析后，所有后续 DB calls，尤其是 `Queries.Delete*` / `Queries.Update*`，必须使用已解析对象的 `entity.ID`。写入 query 时绝不要把原始 URL string 再传给 `parseUUID`。
- **来自 request boundary 的纯 UUID 输入**（始终是 UUID 的 URL params、request body fields、query params、headers）必须用 `parseUUIDOrBadRequest(w, s, fieldName)` 验证。输入无效时，它会写入 400 并返回 `ok=false`，随后必须立即 return。
- **可信 UUID round-trips**（sqlc 返回的 UUID 再传回 queries、test fixtures）使用 `parseUUID(s)`，它会调用 `util.MustParseUUID` 并在输入无效时 panic。这里的 panic 说明有未经保护的用户输入字符串漏了进来，这是一个真实 bug。`chi` 的 `middleware.Recoverer` 会把 panic 转成 500，让进程继续运行。
- **`util.ParseUUID(s) (pgtype.UUID, error)`** 是 handler package 外唯一安全的变体。必须始终检查 error。

添加 `Queries.Delete*` 或 `Queries.Update*` 调用时，先问：“这个 UUID 来自哪里？”如果答案是“未经验证的原始用户输入”，请先通过 `parseUUIDOrBadRequest` 或 loader。

### 包边界规则

这些是硬约束。违反它们会破坏跨平台架构：

- `packages/core/` — 不允许 react-dom，不允许 localStorage（使用 StorageAdapter），不允许 process.env，不允许 UI libraries。**所有共享 Zustand stores 都位于这里**，包括与 view 相关的 stores（filters、view modes）；stores 是纯状态，不是 UI。
- `packages/ui/` — 不允许导入 `@multica/core`（纯 UI，无业务逻辑）。
- `packages/views/` — 不允许 `next/*` imports，不允许 `react-router-dom` imports，不允许 stores。所有 routing 都使用 `NavigationAdapter`。
- `apps/web/platform/` — 唯一允许使用 Next.js APIs（`next/navigation`）的位置。
- `apps/desktop/src/renderer/src/platform/` — 唯一允许接入 react-router-dom navigation wiring 的位置。

### 禁止重复规则

**如果同一逻辑同时存在于两个应用中，就必须抽取到共享包。**

这适用于所有内容：components、hooks、guards、providers、utility functions。决策流程：

1. 这段代码依赖 Next.js 或 Electron APIs 吗？→ 留在对应 app。
2. 它依赖 `react-router-dom` 或 `next/navigation` 吗？→ 留在 app 的 `platform/` layer。
3. 其他所有内容 → 属于 `packages/core/`（headless logic）或 `packages/views/`（UI components）。

当两个应用对同一概念需要不同表现（例如不同 loading UI）时，将共享逻辑抽取为带 props/slots 的组件来表达差异。不要复制逻辑。

### 跨平台开发规则

添加新页面或功能时：

1. **新页面组件** → 添加到 `packages/views/<domain>/`。绝不要导入 `next/*` 或 `react-router-dom`。
2. **同时接入两个应用** → 在 `apps/web/app/` 添加 route（Next.js page file），并在 desktop router 中添加 route。**例外**：pre-workspace transition flows（创建 workspace、接受 invite）不是 desktop routes，而是 `WindowOverlay` state。见 *Desktop-specific Rules → Route categories*。
3. **导航** → 使用 `useNavigation().push()` 或 `<AppLink>`。共享代码中绝不使用 framework-specific link/router APIs。
4. **共享 guards/providers** → 使用 `packages/views/layout/` 中的 `DashboardGuard`。不要为每个 app 创建单独 guard logic。
5. **平台专属 UI** → 如果某个功能仅 web 或仅 desktop 使用，放在对应 app 中。通过 shared layout components 上的 props slots（`extra`、`topSlot`）注入平台专属 UI。
6. **需要 workspace context 的新 hooks** → 接受 `wsId` 参数，而不是读取 `useWorkspaceId()` Context，这样它们在 `WorkspaceIdProvider` 内外都能工作。

### CSS 架构

两个应用共享来自 `packages/ui/styles/` 的同一套 CSS 基础。

- **Design tokens** → 使用 semantic tokens（`bg-background`、`text-muted-foreground`）。绝不使用硬编码 Tailwind colors（`text-red-500`、`bg-gray-100`）。
- **Shared styles** → `packages/ui/styles/`。绝不在 app CSS 中重复 scrollbar styling、keyframes 或 base layer rules。
- **`@source` directives** → 两个应用都会扫描共享 packages，让 Tailwind 看到所有 class names。

## Desktop-specific Rules

这些规则仅适用于 `apps/desktop/`。Web 有不同约束（URL bar、SSR、无 tabs），不共享这些关注点。本节每条规则都来自已经修复过的具体 bug，请把它们视为强制规则，而不是建议。

### Route categories

Desktop app 中的每条 path 都且只能属于一个类别。选错类别会复现已经修复过的 bug。

- **Session routes** — workspace-scoped pages（`/:slug/issues`、`/:slug/settings`）。它们由 `WorkspaceRouteLayout` 下的 per-tab memory router 渲染，是合法的 tab destinations。
- **Transition flows** — pre-workspace / one-shot actions（创建 workspace、接受 invite）。**不是 routes。** 它们作为 `WindowOverlay` state 存在，当 navigation adapter 看到 `push('/workspaces/new')` 或 `push('/invite/<id>')` 时 dispatch。Shared view（`NewWorkspacePage`、`InvitePage`）提供内容，overlay wrapper 提供平台 chrome。
- **Error / stale states** — “workspace not available”、指向已撤销 workspace 的 tabs。**不是 pages。** `WorkspaceRouteLayout` 会通过从 store 中移除 stale tab group 自动修复；用户不会进入显式 error screen。Web 保留 `NoAccessPage`（可分享 URL 让错误状态有意义）；desktop 没有 URL bar，因此 stale = 静默修复。

**在 desktop 添加新的 pre-workspace flow**：在 `stores/window-overlay-store.ts` 中注册新的 `WindowOverlay` type。不要把它添加到 `routes.tsx`。如果 shared view 需要在两个平台使用，请在 web 添加 route（`apps/web/app/(auth)/...`），并在 desktop 添加 overlay type；shared view component 是同一个。

### Workspace context

`@multica/core/platform` 中的 `setCurrentWorkspace(slug, uuid)` 是 active workspace 的单一事实来源。`WorkspaceRouteLayout` 会在 mount 时设置它；unmount 不会清空。离开 workspace context 的代码（leave/delete workspace、强制导航到 overlay）必须显式调用 `setCurrentWorkspace(null, null)`。

### Workspace destructive operations

Leave / Delete workspace flows 必须按以下顺序执行，否则 concurrent refetches 会竞态并导致 renderer hard-reload：

1. 从 cached workspace list 读取 destination。
2. `setCurrentWorkspace(null, null)`。
3. `navigation.push(destination)`。
4. 然后 `await mutation.mutateAsync(workspaceId)`。

### Tab isolation

Tabs 在 `stores/tab-store.ts` 中按 workspace 分组。TabBar 只显示 active workspace 的 tabs；cross-workspace tab leakage 在结构上不可能发生（没有扁平全局 tabs array）。

Cross-workspace `push(path)` 会被 navigation adapter（`platform/navigation.tsx`）检测到，并翻译为 `switchWorkspace(slug, targetPath)`，**不是**当前 tab router 内部导航。不要绕过 adapter；共享代码中始终通过 `useNavigation()`。

### Drag region（macOS）

每个 full-window desktop view（dashboard shell 外的所有内容）都必须把 `@multica/views/platform` 的 `<DragStrip />` 作为 page root 的第一个 flex child 挂载，否则用户无法拖动窗口。顶部 48px 内的交互式 UI 需要 `WebkitAppRegion: "no-drag"` 才能保持可点击。

## UI/UX 规则

- 优先使用 shadcn components，而不是自定义实现。从项目根目录通过 `pnpm ui:add <component>` 安装，它会添加到 `packages/ui/components/ui/`。所有组件都使用 Base UI primitives（`@base-ui/react`），不是 Radix。
- 使用 shadcn design tokens 进行样式设置。避免硬编码 color values。
- 除非设计明确要求，不要引入额外状态（useState、context、reducers）。
- 高度关注 **overflow**（长文本截断、可滚动容器）、**alignment** 和 **spacing** 一致性。
- **如果组件在 web 和 desktop 中完全相同，它属于共享包。** 不要在 apps 之间复制粘贴。

## 测试规则

### 测试写在哪里

Tests 跟随代码，而不是 app。这是该 monorepo 中最重要的测试原则：

| 测试对象 | 测试位置 | 原因 |
|---|---|---|
| 共享业务逻辑（stores、queries、hooks） | `packages/core/*.test.ts` | 不需要 DOM，纯逻辑 |
| 共享 UI components（pages、forms、modals） | `packages/views/*.test.tsx` | jsdom，无 framework mocks |
| 平台专属接线（cookies、redirects、searchParams） | `apps/web/*.test.tsx` 或 `apps/desktop/` | 需要 framework-specific mocks |
| 端到端用户 flows | `e2e/*.spec.ts` | 真实 browser，真实 backend |

**绝不要在 app 的 test file 中测试 shared component behavior。** 如果为了测试 `@multica/views` 中的组件而需要 mock `next/navigation` 或 `react-router-dom`，说明测试位置错了。请把它移到 `packages/views/`，并改为 mock `@multica/core`。

### 测试基础设施

- `packages/core/` — Vitest，Node environment（无 DOM）
- `packages/views/` — Vitest，jsdom environment，`@testing-library/react`
- `apps/web/` — Vitest，jsdom environment，framework-specific mocks
- `e2e/` — Playwright
- `server/` — Go standard `go test`

所有 test deps 都位于 pnpm catalog 中，以统一版本。

### Mocking 约定

- 使用 `vi.hoisted()` + `Object.assign(selectorFn, { getState })` 模式 mock `@multica/core` stores（Zustand stores 既可调用，也有 `.getState()`）。
- Mock `@multica/core/api` 处理 API calls。
- 在 `packages/views/` tests 中：绝不要 mock `next/*` 或 `react-router-dom`，因为这里不存在它们。
- 在 `apps/web/` tests 中：只为 platform-specific behavior mock framework-specific APIs。

### TDD 工作流

1. 先在**正确 package** 中写 failing test。
2. 编写实现。
3. 运行 `pnpm test`（Turborepo 会发现所有 packages）。
4. Green → 完成。

### Go tests

标准 `go test`。Tests 应在 test database 中创建自己的 fixture data。

### E2E tests

E2E tests 应自包含。使用 `TestApiClient` fixture 进行数据 setup/teardown：

```typescript
import { loginAsDefault, createTestApi } from "./helpers";
import type { TestApiClient } from "./fixtures";

let api: TestApiClient;

test.beforeEach(async ({ page }) => {
  api = await createTestApi();
  await loginAsDefault(page);
});

test.afterEach(async () => {
  await api.cleanup();
});

test("example", async ({ page }) => {
  const issue = await api.createIssue("Test Issue");
  await page.goto(`/issues/${issue.id}`);
});
```

## Commit 规则

- 使用按逻辑意图分组的 atomic commits。
- Conventional format：`feat(scope)`、`fix(scope)`、`refactor(scope)`、`docs`、`test(scope)`、`chore(scope)`。

## 最小 Pre-Push 检查

```bash
make check    # 运行所有检查：typecheck、unit tests、Go tests、E2E
```

仅在用户明确要求时运行验证。

用户请求 targeted checks 时：

```bash
pnpm typecheck        # 仅 TypeScript type errors
pnpm test             # 仅 TS unit tests（Vitest，所有 packages）
make test             # 仅 Go tests
pnpm exec playwright test   # 仅 E2E（需要后端 + 前端已运行）
```

## AI Agent 验证循环

写入或修改代码后，始终运行完整验证流水线：

```bash
make check
```

**工作流：**

- 编写代码满足需求
- 运行 `make check`
- 如果任何步骤失败，读取错误输出、修复代码并重新运行
- 重复直到所有检查通过
- 之后才认为任务完成

**快速迭代：** 如果你知道只影响 TypeScript 或 Go，可以先运行单项检查以加快反馈，然后在标记完成前以完整 `make check` 收尾。

## CLI Release

**前置条件：** 每次 Production deployment 都必须伴随一个 CLI release。

1. 在 `main` branch 创建 tag：`git tag v0.x.x`
2. 推送 tag：`git push origin v0.x.x`
3. GitHub Actions 会自动触发 `release.yml`：运行 Go tests → GoReleaser 构建多平台 binaries → 发布到 GitHub Releases + Homebrew tap

默认每次 release bump patch version（例如 `v0.1.12` → `v0.1.13`），除非用户指定具体版本。

## Multi-tenancy

所有 queries 都按 `workspace_id` 过滤。Membership checks 控制访问。`X-Workspace-ID` header 将 requests 路由到正确 workspace。

## Agent Assignees

Assignees 是 polymorphic，可以是 member 或 agent。Issues 上使用 `assignee_type` + `assignee_id`。Agents 使用独特样式渲染（紫色背景、robot icon）。
