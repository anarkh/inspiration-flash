# Confirmation Gates

## 我们实现了什么

runner 现在会处理 `confirmation_required` 工具结果。当工具提出一个 gated action 时，runner 会先调用确认回调，再决定是否应用。

CLI 实现会把 tool、reason、preview 和 action 打印到终端，然后询问：

```text
Approve this action? (y/N)
```

只有 `y` 和 `yes` 会批准 action。非交互式 stdin 默认拒绝，这样脚本和 CI 不会卡住等待输入。

## 在本项目中如何工作

Local Tools 会对文件写入和 workspace-writing 命令返回 `confirmation_required`。runner 使用 `isConfirmationRequired` 检测这个形态。

如果 Owner 批准：

- `write_file` 会在需要时创建父目录，并写入 proposed content。
- `run_command` 会重新检查 command policy，拒绝 dangerous command，并以不经过 shell 的方式执行已批准的非危险命令。

如果 Owner 拒绝，或没有确认回调，runner 会记录一个 `confirmation_denied` tool result，并继续模型 loop。

## 其他常见方案

**Always auto-apply**：
速度快、体验顺滑，但对于能改文件或运行命令的 personal agent 来说不安全。

**Static allowlist only**：
对已知 action 避免频繁确认，但容易隐藏重要上下文；在工具目录还在变化时也比较脆弱。

**Policy engine**：
正式 policy layer 可以表达更丰富的规则、角色和作用域。后续有价值，但比当前 MVP 所需更重。

## 为什么选择当前方案

本项目是 CLI-first 且学习导向。Owner 应该在 workspace 被修改前看到 proposed action。简单 y/N gate 可以先教会 agent safety pattern，同时不过早引入完整 policy runtime。

## 优势

- 高影响工具 action 需要 Owner 明确批准。
- 被拒绝的 action 会作为 observation 回传给模型。
- 非交互式运行默认 fail closed，不会挂起。
- 已确认命令仍以 `shell: false` 执行。

## 劣势

- 当前 prompt 只有 approve/deny 两种选择。
- 暂无 edit-before-approve 流程。
- 暂无针对重复命令的持久信任策略。
- 很长的 action payload 会让终端输出变吵。

## 评测

当前测试验证：

- 已确认的 `write_file` action 会被应用。
- 被拒绝的 confirmation 会被记录，且不会应用。
- 已确认的 workspace-write command 会执行。
- 终端提示会包含 reason、preview 和 action。
- approval parsing 只接受 `y` 和 `yes`。

后续评测应增加：

- 带 pseudo-terminal 的 CLI end-to-end 测试。
- edit-before-approve 工作流。
- 持久 policy profiles。
- Run Export 中的审计摘要。
