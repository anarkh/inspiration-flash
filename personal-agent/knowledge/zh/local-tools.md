# Local Tools

## 我们实现了什么

Personal Agent 现在有一个由类型化 Tool Registry 支撑的小型本地文件系统工具目录：

- `list_files`：列出当前 workspace 下的文件。
- `read_file`：读取一个 workspace-relative 文件。
- `search_text`：在 workspace 文件中做精确文本搜索。
- `write_file`：提出一个 workspace-relative 文件写入请求，并返回确认请求。
- `run_command`：执行安全只读命令，并把更高风险命令转成安全结果。

每个 definition 都声明 canonical name、aliases、description、input schema、output schema、类型化实现，以及可选的 confirmed-action handler。工具执行器也接受少量明显的模型别名，例如 `list_directory` 和 `ls`，并通过同一个 registry entry 解析到 `list_files`。

非法名称、输入、输出和 confirmed action 都会变成带阶段信息的 runtime error。runner 会把这些异常转成持久化的 `tool_error` observation，而不是直接丢失整个 Task Run。

## 在本项目中如何工作

runner 仍然通过 `executeLocalTool(workspace, tool, input)` 执行工具步骤，但这个函数不再包含硬编码 dispatch switch。`createToolRegistry` 会在模块启动时校验每个 definition，并拒绝非法 schema 或 name/alias 冲突。每次调用时，它依次解析名称、校验输入、执行类型化实现、校验输出。

实现按职责拆成四层：`tool-registry.ts` 负责与 provider 无关的运行时契约，`local-tool-catalog.ts` 负责内置工具定义和 schema，`local-tool-implementations.ts` 负责文件系统与进程行为，`local-tools.ts` 保留为 runner 和 provider 使用的小型 facade。这样工具目录继续增长时，不会再把所有职责堆进一个臃肿文件。

共享的 compact JSON Schema 实现已移动到 `core/`，因为 Skill eval 与 Tool Registry 都会使用它。工具 schema 使用 closed object、用 `minLength` 约束必填字符串，并用 `anyOf` 表达 `command_result`、`confirmation_required`、`rejected` 这类判别联合结果。

文件访问由 `resolveWorkspacePath` 约束。模型给出的路径必须解析到 workspace 内部。会逃出 workspace 的绝对路径和 `..` traversal 会被拒绝。

模型提示词不再维护第二份硬编码列表，而是从 registry descriptor 生成当前本地工具目录。概念上会暴露：

```text
list_files {}
read_file {path}
search_text {query}
write_file {path, content}
run_command {command}
```

Alias 只是 runtime compatibility name，不会被宣传成独立工具。这样既能处理真实模型输出中常见的自然命名，又不会扩大公开工具目录。

`write_file` 不会立即写入文件。它会先校验目标路径仍在 workspace 内，计算一个小型 preview，然后返回 `confirmation_required`。批准后，registry 会把 action 路由回同一个工具 definition，再次校验 action schema，执行写入，并校验 confirmed output。

`run_command` 使用 command policy：

- `safe-read` 命令会在 workspace 中以 `shell: false` 执行。
- `workspace-write` 命令会返回 `confirmation_required`。
- `dangerous` 命令会返回 `rejected`。

当 registry 解析、schema 校验或实现执行失败时，持久化结果形态如下：

```json
{
  "type": "tool_error",
  "tool": "read_file",
  "phase": "input_validation",
  "reason": "Local Tool read_file input failed schema validation: $.path is required"
}
```

模型会在下一轮收到这个 observation，并可以修复调用。确定性 evaluation 会把 `tool_error` 视为未成功。

## 其他常见方案

**Provider-native tool calling**：
用模型 provider 原生的 function-calling schema 定义工具。这能获得更强的 schema 校验，但会把 loop 绑定到 provider-specific 格式。

**Zod、TypeBox 或 Ajv registry**：
使用成熟 schema 库并推导或生成 TypeScript 类型。它们提供更完整的 JSON Schema 能力和生态工具，但会增加依赖，也会隐藏本学习项目当前希望显式展示的一部分校验机制。

**硬编码 dispatch switch**：
根据工具名分支，让每个实现自行解析输入。初期很小，但 catalog metadata、prompt 文档、confirmation routing 和 validation 会逐渐形成多份事实来源。这是项目之前的实现方式。

**Shell command execution**：
允许模型运行任意 shell 命令。能力很强，但需要更严格的 policy layer；作为第一版工具面风险过高。

**External tool server**：
通过 MCP 或其他 tool server 暴露工具。这适合扩展大量工具，但在 core loop 成熟之前会增加部署和协议复杂度。

## 为什么选择当前方案

第一批 Local Tools 仍然刻意保持简单、可审计。小型 first-party registry 让执行契约保持可见，也建立了未来接入 `codex/agent-ability` 工具所需的 adapter boundary。Skill guidance 本身仍不能注册或执行代码。

## 优势

- 足够简单，便于学习和调试。
- Workspace path check 能保护任务目录之外的文件。
- 在明确确认路径存在前，文件写入不会真正发生。
- 安全命令不通过 shell 执行，降低 shell injection 风险。
- Canonical tool name 保持稳定。
- 小型别名层让真实模型输出不那么脆弱。
- 输入、普通输出、confirmed action 和 confirmed output 在同一边界校验。
- Provider prompt schema 与执行时 descriptor 来自同一个事实来源。
- 非法调用会变成可检查 event，并允许模型下一轮修复。
- 测试工具能力时不需要网络请求。

## 劣势

- Confirmed action 依赖当前 CLI 的 y/N prompt；暂时还没有更丰富的 policy UI。
- 命令解析刻意只支持简单命令行。
- 精确文本搜索不是语义检索。
- 别名处理是手工维护的，只覆盖已知模型漂移。
- 大 workspace 上递归列文件可能变慢。
- Compact schema validator 不是完整 JSON Schema 2020-12。
- TypeScript interface 与 JSON-style schema 是显式配对的，编译器无法证明二者完全一致。
- 本增量还没有实现每工具权限、取消、可配置超时、输出上限与脱敏。
- Skill Pack scripts 仍然只是 inventory，尚不能进入 registry。

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
- Registry 启动时拒绝非法 schema 和 alias 冲突。
- 实现执行前的 input validation。
- 普通输出和 confirmed output validation。
- 从 schema 生成 provider catalog。
- 模型调用非法时持久化 `tool_error` observation。
- 一个针对非法输入、预期 Task Evaluation verdict 为 `fail` 的 Golden Task Run fixture。
- Compact schema 的 `minLength` 和 `anyOf` 行为。

这次 DeepSeek smoke test 暴露了 `list_directory` 别名缺口，现在已经由回归测试覆盖。

后续评测应增加：

- 大 workspace 性能检查。
- hidden file 和 ignore pattern 行为。
- 更丰富的 Confirmation Gate UX。
- 权限、超时、取消、输出上限和脱敏的 failure injection。
- 经过批准的 Skill Pack script 注册与执行。
- model-assisted tool error recovery。
