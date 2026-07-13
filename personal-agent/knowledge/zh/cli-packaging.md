# CLI Packaging

## 我们实现了什么

npm 包名现在是：

```text
@ranarkh/agent
```

安装后的 CLI 命令现在是：

```text
a-agent
```

`package.json` 和 `package-lock.json` 都暴露同样的 package name 和 binary mapping：

```json
{
  "name": "@ranarkh/agent",
  "bin": {
    "a-agent": "dist/cli/index.js"
  }
}
```

## 在本项目中如何工作

`src/cli/index.ts` 把用户可见的命令名放在一个 `cliCommandName` 常量里。help 输出、history 翻页提示和 CLI diagnostics 都使用这个常量，因此后续如果再次改命令名，不需要在无关逻辑里分散修改。

workspace 状态目录仍然是 `.personal-agent/`。这个目录保存 run state，刻意与 package name 和 executable name 分离。保持它稳定可以避免破坏已有本地 Task Runs。

## 其他常见方案

**全部一起改名**：
同时修改 package name、executable、state directory、docs 和 project folder。视觉上更一致，但会破坏已有 workspace state，并引入更大的迁移。

**保留旧 binary alias**：
同时暴露 `personal-agent` 和 `a-agent`。这有利于兼容，但会削弱命令改名，并让公开入口变成两个。

**只加命令 wrapper**：
保留旧 npm package name，只新增 `a-agent` wrapper。改动最小，但使用者安装时看到的 package identity 仍然是旧名称。

## 为什么选择当前方案

Owner 要求修改 package name 和触发命令。更新 package metadata 和用户可见 CLI 文案可以满足这个要求，同时不改变持久化 workspace state。

## 优势

- package identity 更短：`@ranarkh/agent`。
- 命令更短：`a-agent`。
- help 文案、错误提示和分页提示都与安装后的 binary 一致。
- 已有 `.personal-agent/` workspace 仍然可读。

## 劣势

- 旧文档或 shell history 中调用 `personal-agent` 的地方需要更新。
- 目前没有为旧 binary 保留兼容 alias。
- project folder 仍然叫 `personal-agent/`，所以 package identity 和仓库目录名并不完全一致。

## 评测

当前测试验证：

- `package.json` 使用 `@ranarkh/agent`，
- `package.json` 只暴露 `a-agent` binary，
- CLI help 会打印 `a-agent`，
- history pagination hints 会使用 `a-agent`。

后续评测应增加：

- install-style smoke test，从 `dist/` 中运行构建后的 `a-agent` binary，
- 如果未来修改 state directory，需要补 migration note。
