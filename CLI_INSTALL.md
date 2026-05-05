# Multica CLI：给 AI 智能体的安装指南

> **读者：** 这份文档给 AI 智能体（Claude Code、Codex 等）逐步读取和执行。每一步都包含要运行的 shell 命令、预期结果和失败处理。

## 给用户的一句话指令

把这句话交给你的 AI 智能体：

```text
Fetch https://github.com/multica-ai/multica/blob/main/CLI_INSTALL.md and follow the instructions to install Multica CLI, log in, and start the daemon on this machine.
```

---

## 第 1 步：检查是否已安装 Multica CLI

运行：

```bash
multica version
```

- **如果输出版本号**（例如 `multica v0.x.x`）：跳到 **第 3 步**。
- **如果提示 command not found**：继续 **第 2 步**。

---

## 第 2 步：安装 Multica CLI

> **Windows 用户：** 直接跳到 [选项 C：Windows（PowerShell）](#选项-cwindowspowershell)。

### 选项 A：Homebrew（macOS/Linux 推荐）

先检查 Homebrew 是否可用：

```bash
which brew
```

如果找到了 `brew`，用 Homebrew 安装：

```bash
brew install multica-ai/tap/multica
```

然后验证：

```bash
multica version
```

如果能正常输出版本号，跳到 **第 3 步**。

后续升级：

```bash
brew upgrade multica-ai/tap/multica
```

### 选项 B：从 GitHub Releases 下载（macOS/Linux，无 Homebrew）

如果没有 Homebrew，直接下载二进制。

检测 OS 和架构，并下载对应压缩包：

```bash
OS=$(uname -s | tr '[:upper:]' '[:lower:]')   # "darwin" or "linux"
ARCH=$(uname -m)                                # "x86_64" or "arm64"

# Normalize architecture name
if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
fi

# Get the latest release tag from GitHub
LATEST=$(curl -sI https://github.com/multica-ai/multica/releases/latest | grep -i '^location:' | sed 's/.*tag\///' | tr -d '\r\n')

# Download and extract
VERSION="${LATEST#v}"
curl -sL "https://github.com/multica-ai/multica/releases/download/${LATEST}/multica-cli-${VERSION}-${OS}-${ARCH}.tar.gz" -o /tmp/multica.tar.gz
tar -xzf /tmp/multica.tar.gz -C /tmp multica
sudo mv /tmp/multica /usr/local/bin/multica
rm /tmp/multica.tar.gz
```

验证：

```bash
multica version
```

**如果失败：**

- 检查 `/usr/local/bin` 是否在 `$PATH` 中。
- Linux 上可能需要执行 `chmod +x /usr/local/bin/multica`。
- 如果没有 `sudo`，安装到用户可写目录：`mv /tmp/multica ~/.local/bin/multica`，并确认 `~/.local/bin` 在 `$PATH` 中。

### 选项 C：Windows（PowerShell）

在 PowerShell 中运行（不需要管理员权限）：

```powershell
irm https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.ps1 | iex
```

脚本会从 GitHub Releases 下载最新 Windows 二进制，安装到 `%USERPROFILE%\.multica\bin\`，并加入用户 PATH。

验证：

```powershell
multica version
```

**如果失败：**

- 重启终端，让新的 PATH 生效。
- 如果使用 Scoop，安装脚本会自动使用它：`scoop bucket add multica https://github.com/multica-ai/scoop-bucket.git && scoop install multica`
- 如果执行策略阻止脚本：先运行 `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`，再重新执行安装命令。

---

## 第 3 步：登录

运行：

```bash
multica login
```

**重要：** 这个命令会打开浏览器做 OAuth 登录。请告诉用户：

> “浏览器会打开 Multica 登录页。请在浏览器里完成认证，然后回到终端。”

等待命令完成。它会自动发现用户所属的所有工作区，并加入 daemon watch list。

验证：

```bash
multica auth status
```

预期输出应包含已认证用户和 server URL。

**如果登录失败：**

- 如果没有浏览器（headless 环境），用户可以在 `https://app.multica.ai/settings` 创建 Personal Access Token，然后运行：`multica login --token <mul_...>`。也可以传空值 `--token=` 进入交互输入，避免 token 出现在 shell history。
- 如果需要自定义 server URL，先运行 `multica config set server_url <url>`，再登录。

---

## 第 4 步：启动 daemon

先检查 daemon 是否已运行：

```bash
multica daemon status
```

- **如果状态是 `running`**：跳到 **第 5 步**。
- **如果状态是 `stopped`**：启动它：

```bash
multica daemon start
```

等待 3 秒后验证：

```bash
multica daemon status
```

预期输出应显示 `running`，并列出检测到的 agents，例如 `claude`、`codex`、`copilot`、`opencode`、`openclaw`、`hermes`、`gemini`、`pi`、`cursor-agent`。

**如果 daemon 启动失败：**

- 查看日志：`multica daemon logs`
- 如果端口冲突，daemon 可能已经在另一个 profile 下运行。
- 如果没有检测到 agents，确认至少安装了一个 AI CLI（`claude`、`codex`、`copilot`、`opencode`、`openclaw`、`hermes`、`gemini`、`pi` 或 `cursor-agent`），并且它在 `$PATH` 中。

---

## 第 5 步：验证整体可用

运行：

```bash
multica daemon status
```

确认：

1. 状态是 `running`
2. 至少列出一个 agent（例如 `claude`、`codex`、`copilot`、`opencode`、`openclaw`、`hermes`、`gemini`、`pi` 或 `cursor-agent`）
3. 至少有一个工作区被监听

如果 agent 列表为空，告诉用户：

> “Multica daemon 已经运行，但没有检测到 AI agent CLI。请至少安装一个支持的 CLI（`claude`、`codex`、`copilot`、`opencode`、`openclaw`、`hermes`、`gemini`、`pi` 或 `cursor-agent`），然后用 `multica daemon stop && multica daemon start` 重启 daemon。”

---

## 总结

全部步骤完成后，告诉用户：

> “Multica CLI 已安装，daemon 已运行。你工作区里的 agents 现在可以在这台机器上执行任务。可以用 `multica workspace list` 管理工作区，用 `multica daemon logs -f` 查看 daemon 日志。”
