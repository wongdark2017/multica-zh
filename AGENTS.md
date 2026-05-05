# 仓库指南

本文件为 AI 代理在本仓库中处理代码时提供指导。

> **单一事实来源：** 本文件只是简明索引。
> 所有权威的架构说明、编码规则、命令和约定
> 都位于项目根目录的 **CLAUDE.md**。请先阅读该文件。

## 快速参考

### 架构

Go 后端 + 单仓库前端（pnpm workspaces + Turborepo），并带有共享包。

- `server/` — Go 后端（Chi router、sqlc、gorilla/websocket）
- `apps/web/` — Next.js 前端（App Router）
- `apps/desktop/` — Electron 桌面应用
- `packages/core/` — 无界面的业务逻辑（Zustand stores、React Query hooks、API client）
- `packages/ui/` — 原子 UI 组件（shadcn/Base UI，无业务逻辑）
- `packages/views/` — 共享业务页面/组件
- `packages/tsconfig/` — 共享 TypeScript 配置

### 状态管理（关键）

- **React Query** 管理所有服务端状态（issues、members、agents、inbox、workspace list）
- **Zustand** 管理所有客户端状态（当前工作区选择、视图过滤器、草稿、模态框）
- 所有 Zustand stores 都位于 `packages/core/`，绝不放在 `packages/views/` 或应用目录中
- WS 事件只负责使 React Query 失效，绝不直接写入 stores

### 包边界（硬性规则）

- `packages/core/` — 不允许 react-dom、localStorage、process.env
- `packages/ui/` — 不允许导入 `@multica/core`
- `packages/views/` — 不允许 `next/*`、`react-router-dom`，路由必须使用 `NavigationAdapter`
- `apps/web/platform/` — 唯一允许使用 Next.js API 的位置

### 命令

```bash
make dev              # 自动设置并启动所有服务
pnpm typecheck        # TypeScript 检查
pnpm test             # TS 单元测试（Vitest）
make test             # Go 测试
make check            # 完整验证流水线
```

完整命令参考见 CLAUDE.md。
