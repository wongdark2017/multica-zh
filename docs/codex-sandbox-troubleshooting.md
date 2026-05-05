# Codex 沙箱排障（macOS `no such host`）

这份文档说明导致 [MUL-963][mul-963] 的失败模式，以及 daemon 在为每个 Codex 任务写入 `config.toml` 时采用的决策矩阵。

[mul-963]: https://multica-api.copilothub.ai/issues/28c34ad2-102a-4f46-91ac-336ed78c5859

## 症状指纹

| 错误文本 | 可能原因 |
| --- | --- |
| `dial tcp: lookup HOST: no such host` | **Codex Seatbelt 沙箱阻止 DNS**（macOS，`workspace-write` 模式）。 |
| `dial tcp IP:PORT: connect: connection refused` | server/daemon 没在该端口运行（应用层问题，不是沙箱）。 |
| `dial tcp IP:PORT: i/o timeout` | 容器级网络策略或防火墙（不是 Codex 沙箱）。 |
| `x509: certificate signed by unknown authority` | TLS/CA 问题，和本问题无关。 |

如果你在 **macOS 的 Codex 会话内部**看到 `no such host`，但在同一台机器的普通 shell 里运行 `curl https://multica-api.copilothub.ai` 正常，就命中了下面的 Seatbelt 问题。

## 根因

上游问题：[openai/codex#10390][codex-10390]。在 macOS 上，Codex 的 Seatbelt profile 对 `sandbox_mode = "workspace-write"` 会静默忽略 `[sandbox_workspace_write] network_access = true`。Seatbelt policy 硬编码了 `CODEX_SANDBOX_NETWORK_DISABLED=1`，会阻止 DNS/UDP syscall。Go 的 `net.LookupHost` 会把它表现成 `no such host`。

Linux（Landlock）**不受影响**，只有 macOS Seatbelt 受影响。

[codex-10390]: https://github.com/openai/codex/issues/10390

## daemon 现在怎么处理

Daemon 会在每个任务的 `$CODEX_HOME/config.toml` 中写入一段 *multica-managed* block，用 `# BEGIN multica-managed` / `# END multica-managed` 标记边界。标记之外的内容保持不变，用户仍可以调整 Codex 行为。

决策矩阵（见 [`server/internal/daemon/execenv/codex_sandbox.go`](../server/internal/daemon/execenv/codex_sandbox.go)）：

| 主机 OS | Codex 版本 | managed block 写入内容 |
| --- | --- | --- |
| non-darwin | 任意 | `sandbox_mode = "workspace-write"` + `sandbox_workspace_write.network_access = true`（dotted-key 形式） |
| darwin | ≥ `CodexDarwinNetworkAccessFixedVersion` | 同上（上游修复已生效） |
| darwin | 更旧 / 未知（当前默认） | `sandbox_mode = "danger-full-access"` + warn 级日志 |

managed block 总是提升到 `config.toml` 顶部，并使用 TOML dotted-key 语法，而不是 `[sandbox_workspace_write]` section header。这两个细节都很关键：如果 block 被放在用户自定义 table（例如 `[permissions.multica]`）之后，裸写的 `sandbox_mode = "..."` 会被解析成 `permissions.multica.sandbox_mode`，Codex 会静默忽略它。

`CodexDarwinNetworkAccessFixedVersion` 目前是空字符串，表示**尚无已知修复版本**。等带有上游修复的 Codex tagged release 发布后，再更新它。

当 daemon 回退到 `danger-full-access` 时，会写 WARN 日志：

```text
codex sandbox: falling back to danger-full-access on macOS
  reason=codex on macOS: seatbelt ignores sandbox_workspace_write.network_access (openai/codex#10390) ...
  codex_version=0.121.0
  hint=upgrade Codex CLI (e.g. `brew upgrade codex` or `npm i -g @openai/codex`) ...
  config_path=/.../codex-home/config.toml
```

## 快速自检命令

在宿主机 shell（沙箱外）运行：

```bash
# Multica API 本身是否可达？
curl -sSf https://multica-api.copilothub.ai/healthz
```

在 Codex 会话内部运行（daemon 写完 config 后）：

```bash
multica issue list --limit 1 --output json >/dev/null && echo OK
```

如果宿主机 `curl` 正常，但 Codex 会话内命令因为 `no such host` 失败，问题就在沙箱；检查 `$CODEX_HOME/config.toml` 中的 managed block，确认 daemon 选择了正确 policy。

## 选项和取舍

- **A. 域名限定的 `permissions` profile**（更严格）：等上游 `network_access` 修复可用后，优先写入 `permissions.multica` profile，只允许 `multica-api.copilothub.ai` 和 `multica-static.copilothub.ai`。这样可以保留文件系统沙箱。
- **B. `danger-full-access`**（当前 macOS fallback）：禁用整个 Seatbelt profile。在上游修复发布前，这是最简单可靠的绕过方式。
- **C. 升级 Codex CLI**：`brew upgrade codex` 或 `npm i -g @openai/codex`。一旦安装了包含 [openai/codex#10390][codex-10390] 的版本，就更新 `codex_sandbox.go` 里的 `CodexDarwinNetworkAccessFixedVersion`，选项 A / workspace-write 路径会自动接管。

## 需要人工验证时

```bash
# 查看 daemon 为某个任务写入的 managed block。
sed -n '/# BEGIN multica-managed/,/# END multica-managed/p' \
  ~/multica_workspaces/$WORKSPACE_ID/$TASK_SHORT/codex-home/config.toml
```

这个 block 是幂等的；重新运行任务会原地重写它。
