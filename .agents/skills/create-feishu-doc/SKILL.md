---
name: create-feishu-doc
description: 使用 DeepSeek 起草并创建真实的飞书文档。当用户要求根据背景、调研、会议内容或方案新建飞书/Lark文档时使用。
---

# 创建飞书文档

1. 整理完整背景、方案和文档要求，移除凭证及非必要敏感信息。
2. 使用绝对路径运行本 Skill 自带的 `scripts/deepseek-doc-writer`，并通过标准输入发送材料。

3. 核对返回草稿中的事实和结论，再按 `lark-doc` Skill 创建真实飞书文档并返回链接。

如果生成器失败或拒绝输入，直接说明原因，不要悄悄换用其他外部模型。

API key 必须保存在 macOS 钥匙串的 `codex-deepseek-doc-writer` 服务中，不得写入仓库或文档材料。
