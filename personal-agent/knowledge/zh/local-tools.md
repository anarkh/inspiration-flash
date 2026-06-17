# Local Tools

## 我们实现了什么

Personal Agent 现在有一个很小的本地文件系统工具目录：

- `list_files`：列出当前 workspace 下的文件。
- `read_file`：读取一个 workspace-relative 文件。
- `search_text`：在 workspace 文件中做精确文本搜索。
- `write_file`：提出一个 workspace-relative 文件写入请求，并返回确认请求。
- `run_command`：执行安全只读命令，并把更高风险命令转成安全结果。

工具执行器也接受少量明显的模型别名，例如 `list_directory` 和 `ls`，并把它们映射回 `list_files`。

## 在本项目中如何工作

runner 会通过 `executeLocalTool(workspace, tool, input)` 执行工具步骤。每个工具都会拿到当前 workspace root，并在接触文件系统之前校验自己的输入。

文件访问由 `resolveWorkspacePath` 约束。模型给出的路径必须解析到 workspace 内部。会逃出 workspace 的绝对路径和 `..` traversal 会被拒绝。

模型提示词会列出当前本地工具目录和输入形态：

```text
list_files {}
read_file {path}
search_text {query}
write_file {path, content}
run_command {command}
```

别名层刻意保持很小。它只处理真实模型输出中常见的自然命名，避免把公开工具目录变得过大。

`write_file` 不会立即写入文件。它会先校验目标路径仍在 workspace 内，计算一个小型 preview，然后返回 `confirmation_required`。runner 现在可以在 Confirmation Gate 批准后应用这个 proposed action。

`run_command` 使用 command policy：

- `safe-read` 命令会在 workspace 中以 `shell: false` 执行。
- `workspace-write` 命令会返回 `confirmation_required`。
- `dangerous` 命令会返回 `rejected`。

## 其他常见方案

**Provider-native tool calling**：
用模型 provider 原生的 function-calling schema 定义工具。这能获得更强的 schema 校验，但会把 loop 绑定到 provider-specific 格式。

**Shell command execution**：
允许模型运行任意 shell 命令。能力很强，但需要更严格的 policy layer；作为第一版工具面风险过高。

**External tool server**：
通过 MCP 或其他 tool server 暴露工具。这适合扩展大量工具，但在 core loop 成熟之前会增加部署和协议复杂度。

## 为什么选择当前方案

第一批 Local Tools 刻意选择简单、可审计的能力。它们足够让 agent 感知和总结 workspace，同时安全边界仍然容易理解。

## 优势

- 足够简单，便于学习和调试。
- Workspace path check 能保护任务目录之外的文件。
- 在明确确认路径存在前，文件写入不会真正发生。
- 安全命令不通过 shell 执行，降低 shell injection 风险。
- Canonical tool name 保持稳定。
- 小型别名层让真实模型输出不那么脆弱。
- 测试工具能力时不需要网络请求。

## 劣势

- Confirmed action 依赖当前 CLI 的 y/N prompt；暂时还没有更丰富的 policy UI。
- 命令解析刻意只支持简单命令行。
- 精确文本搜索不是语义检索。
- 别名处理是手工维护的，只覆盖已知模型漂移。
- 大 workspace 上递归列文件可能变慢。

## 评测

当前测试验证：

- 在临时 workspace 中读取、列文件和精确文本搜索。
- `write_file` 会返回确认请求，且不会直接修改文件系统。
- `run_command` 会在 workspace 中执行 `safe-read` 命令。
- `run_command` 会把 workspace-write 命令转成 `confirmation_required`。
- 已确认的 `write_file` action 会写入 proposed content。
- 已确认的 `run_command` action 会执行 proposed command。
- `run_command` 会把 dangerous 命令转成 `rejected`。
- 拒绝逃出 workspace 的路径。
- `list_directory` 这类常见模型别名。

这次 DeepSeek smoke test 暴露了 `list_directory` 别名缺口，现在已经由回归测试覆盖。

后续评测应增加：

- 大 workspace 性能检查。
- hidden file 和 ignore pattern 行为。
- 更丰富的 Confirmation Gate UX。
- 更丰富的工具 schema 校验。
- model-assisted tool error recovery。
