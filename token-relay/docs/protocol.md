# Token Relay 协议 v1

本文定义 Token Relay MVP 的五条接口边界：匿名公开模型目录、Consumer 使用的
OpenAI-compatible 及 Anthropic Messages HTTP API、账号密码认证/账户 HTTP API、
管理员使用的同源 HTTP API，以及 Provider SDK 使用的 WebSocket 协议。共享
TypeScript 类型以 `packages/protocol/src/index.ts` 为准，当前 Provider wire
protocol 版本为 `1`。

## 角色与凭据

| 角色 | 凭据 | 使用位置 | 权限 |
| --- | --- | --- | --- |
| Admin | `TOKEN_RELAY_ADMIN_TOKEN` | `Authorization: Bearer …` | 配置与查看整个中转服务 |
| 账户用户 | 用户名 + 密码换取随机 opaque session | `Secure; HttpOnly; SameSite=Lax` Cookie | 管理本人资源；从已公开且当前可用的其他 Provider 创建 Consumer |
| Provider SDK | 一次性展示的 `providerToken` | WebSocket Upgrade 的 `Authorization: Bearer …` | 仅连接自己的 Provider、接收分配给自己的任务 |
| Consumer | 一次性展示的 `apiKey` | `Authorization: Bearer …`；Anthropic 客户端也可用 `x-api-key: …` | 仅调用绑定的 Provider 与模型，并受配额和并发限制 |
| Relay job | 每个任务随机生成的 `leaseToken` | Provider WebSocket 消息体 | 仅提交对应任务的结果或失败 |

Admin token 由部署者通过环境变量提供。Provider token 和 Consumer API key 只在
创建或轮换时返回完整值；服务端持久化哈希和可识别前缀，不应持久化明文。
密码只持久化带随机盐的 `scrypt` 哈希；用户 session 只持久化哈希。

## 公开模型目录

### `GET /models`

无需认证，返回自包含的模型目录 HTML 页面。页面只能调用匿名只读的目录接口；
登录后的直接接入另行使用同源 HttpOnly session 调用账户 API，页面脚本不能读取
Cookie 明文。响应不得嵌入 Admin token、Provider token、Consumer key 或用户身份。

### `GET /catalog/v1/models`

无需认证，返回所有 `listed = true` 且 `enabled = true` Provider 最近一次成功上报
的模型。目录项即使在 Provider 离线时仍可展示，但只有 `online = true`、
`available = true` 的项可用于新建跨用户 Consumer。`available` 必须由实时 Provider
连接重新计算，不能只根据持久化的最后上报模型推断。

目录响应包含模型名、类别、Provider 的公开 id/名称、所有权提示、在线状态和可接入
状态，不得包含 `ownerUserId`、账号凭据、Provider token 前缀、Token/积分额度、并发
计数、请求统计或其他非公开配置：

```json
{
  "viewer": {
    "authenticated": false
  },
  "families": [
    { "id": "all", "label": "全部" },
    { "id": "gpt", "label": "GPT" },
    { "id": "claude", "label": "Claude" },
    { "id": "gemini", "label": "Gemini" },
    { "id": "deepseek", "label": "DeepSeek" },
    { "id": "qwen", "label": "Qwen" },
    { "id": "doubao", "label": "Doubao" },
    { "id": "other", "label": "其他" }
  ],
  "providers": [
    {
      "id": "provider_...",
      "name": "上海工作站",
      "listed": true,
      "ownedByCurrentUser": false,
      "online": true,
      "models": ["deepseek-r1"],
      "bindable": true,
      "available": true,
      "unavailableReason": null
    }
  ],
  "models": [
    {
      "key": "provider_...:deepseek-r1",
      "providerId": "provider_...",
      "providerName": "上海工作站",
      "id": "deepseek-r1",
      "family": "deepseek",
      "ownedByCurrentUser": false,
      "online": true,
      "bindable": true,
      "available": true,
      "unavailableReason": null
    }
  ]
}
```

`family` id 集合固定为 `gpt`、`claude`、`gemini`、`deepseek`、`qwen`、
`doubao`、`other`，页面标签显示为 `GPT`、`Claude`、`Gemini`、`DeepSeek`、
`Qwen`、`Doubao`、`Other`。匹配模型名时忽略大小写；同时命中 `deepseek` 和
`qwen` 时必须优先归入 `deepseek`。API 不接受类别或搜索查询参数；`/models` 页面
在已返回的脱敏集合上做大小写不敏感搜索和 `all`/类别筛选。筛选不得改变底层授权
或扩大结果集合。

匿名请求的 `ownedByCurrentUser` 为 `false`。若请求带有效的同源用户 session，
接口仍保持只读，但可把本人 Provider 标记为 `ownedByCurrentUser = true`，以便页面
允许私有自用绑定。`bindable` 表示当前在线并实际 advertise 该精确模型；
`available` 还要求 Provider 有剩余 Token 额度和并发容量。`unavailableReason`
使用 `provider_offline`、`no_models`、`model_unavailable`、`quota_exhausted`
或 `at_capacity` 等固定安全错误码。

## Consumer HTTP API

### `GET /v1/models`

使用 Consumer API key 认证。返回当前 Consumer 被允许调用的模型。模型列表不能
因为 Provider 上报了额外模型而扩大；Consumer 的显式绑定始终是授权边界。
它与匿名 `/catalog/v1/models` 是不同接口。

### `POST /v1/chat/completions`

使用 Consumer API key 认证。MVP 接受非流式 OpenAI Chat Completions 子集：

```json
{
  "model": "codex",
  "messages": [
    {
      "role": "system",
      "content": "回答要简洁。"
    },
    {
      "role": "user",
      "content": "解释这个错误。"
    }
  ],
  "max_tokens": 800,
  "temperature": 0.2,
  "stream": false,
  "user": "optional-caller-id"
}
```

字段约束：

- `model` 必须与 Consumer 创建时绑定的模型完全一致。
- `messages` 必须是非空数组；角色支持 `system`、`developer`、`user` 和
  `assistant`，`content` 为字符串。
- `max_tokens` 与 `max_completion_tokens` 二选一；两者均表示允许的最大输出。
- `stream` 省略或为 `false`；协议 v1 不接受 `true`。
- Relay 在分配任务前同时校验 Consumer/Provider 的启用状态、Token 配额、并发
  配额、Provider 在线状态及模型上报状态。

成功响应：

```json
{
  "id": "chatcmpl_01...",
  "object": "chat.completion",
  "created": 1785312000,
  "model": "codex",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "模型返回内容"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 18,
    "total_tokens": 60
  }
}
```

错误使用 OpenAI 风格的 JSON error envelope，并返回相应 HTTP 状态。调用方必须
将 `401` 视为 API key 无效，将 `429` 视为额度或并发限制，将 `503` 视为
Provider 暂不可用，将网关超时视为结果未知而不是自动重复计费请求。

### `POST /v1/messages`

使用 Consumer API key 认证，接受 Claude Code 所需的 Anthropic Messages
纯文本子集。URL 可带查询参数，例如 Claude Code 使用的
`/v1/messages?beta=true`；路由只按 pathname 匹配。请求示例：

```json
{
  "model": "claude-relay",
  "max_tokens": 512,
  "system": [
    {
      "type": "text",
      "text": "回答要简洁。",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "解释这个错误。" }
      ]
    }
  ],
  "stream": true,
  "tools": []
}
```

字段与兼容性约束：

- `model` 必须与 Consumer 的模型绑定精确一致，`max_tokens` 为必填正整数且不大于
  32768。
- `system` 和每条 `messages[].content` 可为字符串或有序 `text` block 数组；
  Relay 按顺序拼接同一字段内的文本。消息角色只支持 `user` 和 `assistant`，
  顶层 `system` 转换为 Relay 的 `system` 消息。
- `cache_control`、`metadata`、`output_config`、`thinking` 及其他开放列表扩展字段
  被容忍但不改变 Provider job。`tools` 省略或为空数组时可接受；非空工具定义、
  `tool_use` / `tool_result`、图片及其他非文本 block 会以 `400` 明确拒绝。
- `stream` 可为 `true` 或 `false`。Provider wire protocol 只传最终结果，所以
  `true` 会在 Provider 完成后以一个 `text_delta` 发送完整文本，而不承诺实时增量。
- Anthropic 路径与 OpenAI 路径共用同一个模型授权、Provider 可用性、原子额度/
  并发预留、dispatch 和结算实现，不会选择第二个 Provider 或绕过配额。

非流式成功响应：

```json
{
  "id": "msg_01...",
  "type": "message",
  "role": "assistant",
  "model": "claude-relay",
  "content": [
    { "type": "text", "text": "模型返回内容" }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 42,
    "output_tokens": 18
  }
}
```

流式响应使用 `text/event-stream`，依序发送：

1. `message_start`
2. `content_block_start`
3. `content_block_delta`（`delta.type = "text_delta"`）
4. `content_block_stop`
5. `message_delta`（最终 `stop_reason` 与累计 `output_tokens`）
6. `message_stop`

`ProviderResult.finishReason` 的 `stop` 与 `length` 分别映射为 `end_turn` 与
`max_tokens`。输入用量与 OpenAI 路径一样，包含 Relay prompt 包装的估算/报告值。

错误响应使用 Anthropic envelope，并在 header 和 body 中提供 Relay 生成的
request id：

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Tool definitions and tool use are not supported by this relay."
  },
  "request_id": "req_01..."
}
```

状态码会映射为 Anthropic error type：`401 authentication_error`、
`403 permission_error`、`404 not_found_error`、`413 request_too_large`、
`429 rate_limit_error`、`503 overloaded_error`，其他 `5xx` 为 `api_error`。

## 账号密码认证 HTTP API

用户名规范化为 `trim → Unicode NFKC → lowercase`，结果长度为 3–64 且必须匹配
`^[a-z0-9._-]+$`。唯一性约束使用该规范化值，因此登录和注册都对
ASCII 大小写不敏感。密码必须为 12–128 个 Unicode code point，UTF-8 不超过
512 bytes；显示名称可选，去除首尾空白后为 1–64 个字符。

所有认证响应均设置 `Cache-Control: no-store`。所有认证 POST 都只接受 JSON，并
要求 `Origin` 与服务端可信 origin 精确一致；`Sec-Fetch-Site: cross-site` 被拒绝。
默认回环启动的可信 origin 在 listen 后由实际地址推导，所以
`127.0.0.1:8787` 无需配置 `TOKEN_RELAY_PUBLIC_URL`。非回环部署必须显式配置外部
HTTPS origin，不能根据请求的任意 Host 或 `X-Forwarded-*` 推导。

### `GET /auth/v1/session`

始终返回 `200` 和 `Cache-Control: no-store`。未登录时：

```json
{
  "authenticated": false
}
```

已登录时返回不含密码或密码哈希的公开用户信息和本地会话过期时间：

```json
{
  "authenticated": true,
  "user": {
    "id": "user_...",
    "username": "alice.user",
    "displayName": "Alice"
  },
  "expiresAt": "2026-08-29T08:00:00.000Z"
}
```

### `POST /auth/v1/register`

请求：

```json
{
  "username": "Alice.User",
  "password": "至少十二个字符的密码",
  "displayName": "Alice"
}
```

成功返回 `201`、已认证 session body 和 `Set-Cookie`。用户名重复统一返回
`409 username_unavailable`，响应不说明原始用户名、历史登录状态或账户资源。
密码经 `scrypt`、每账户独立随机盐和固定的参数上限计算后才进入 SQLite；表中没有
明文密码列。

### `POST /auth/v1/login`

请求只包含 `username` 和 `password`。成功返回 `200`、与 session 查询相同的 body
及新的 `Set-Cookie`。用户不存在、密码错误和账户已禁用都返回同一个
`401 invalid_credentials`，防止账号枚举；失败尝试超过进程内限制时返回
`429 too_many_login_attempts`。分布式部署仍必须使用反向代理或共享限流系统。

注册和登录成功都颁发新的高熵 opaque token，SQLite 仅保存 token 哈希和过期时间。
HTTPS 使用 `__Host-token-relay-session`，回环 HTTP 使用
`token-relay-session`；Cookie 均设置 `Path=/; HttpOnly; SameSite=Lax` 和有界
`Max-Age`，HTTPS 额外设置 `Secure`。

### `POST /auth/v1/logout`

请求体为 JSON 对象并要求精确同源。Relay 服务端撤销当前 session、清除 Cookie，
返回 `204`。其他浏览器或设备上的独立 session 不受影响。

## 用户账户 HTTP API

全部 `/account/v1/*` 路由只接受有效用户 Cookie。非 GET 请求还要求精确同源
`Origin`；Admin Bearer、Provider token 和 Consumer API key 均不能替代用户会话。

### `GET /account/v1/overview`

返回公开用户信息、本人 `providers`、本人 `consumers`、本人 Consumer 的最近
`requests`、本人 Provider 服务的有界最近记录、本人 Provider 与公开目录中当前可
绑定的 `availableProviders`、积分账本以及账户级 `summary`。账户对象包含
`pointBalance`、`pointsReserved`、`availablePoints`；统计必须分别报告
Consumer 侧消耗和 Provider 侧提供的 Token/请求数，不能只从最近请求列表推导。
不返回完整 Provider token、Consumer API key、密码信息或其他用户的私有资源。

### 资源管理

- `POST /account/v1/providers`：创建本人 Provider，一次性返回 `providerToken`。
  数据库默认 `listed = false`；用户自助 API/UI 显式传入 `listed = true`，避免依赖
  数据库隐含默认。
- `PATCH /account/v1/providers/:id`：修改本人 Provider，包括切换 `listed`。
- `POST /account/v1/providers/:id/rotate-token`：轮换本人 Provider token 并断开旧
  SDK 连接。
- `POST /account/v1/consumers`：创建本人 Consumer。本人 Provider 可以未公开，但
  必须已启用、在线并正在上报所选模型；跨所有者 Provider 还必须已由所有者设为
  `listed`。
- `PATCH /account/v1/consumers/:id`：修改本人 Consumer；变更路由时重复上述校验。
- `POST /account/v1/consumers/:id/rotate-key`：轮换本人 Consumer API key。

所有按 id 的用户操作都在数据库查询中同时约束 `owner_user_id`；跨用户 id 返回
`404`，避免泄漏私有资源是否存在。公开 Provider 只能通过经过脱敏的目录投影发现。
关闭 `listed` 只阻止新的跨用户绑定；既有 Consumer 保持原绑定，不会被自动删除或
改派。Admin API 保持独立的全局 root 权限。

## Admin HTTP API

全部接口要求 Admin Bearer token，响应必须使用 `Cache-Control: no-store`。管理页
通过同源请求调用这些接口，不使用 Cookie 认证。

### `GET /admin/v1/overview`

返回管理页一次渲染所需的数据：

```json
{
  "providers": [
    {
      "id": "provider_...",
      "name": "上海工作站",
      "enabled": true,
      "listed": true,
      "advertisedModels": ["codex"],
      "advertisedModelsUpdatedAt": "2026-07-30T08:00:00.000Z",
      "tokenLimit": 1000000,
      "tokensUsed": 1200,
      "tokensReserved": 0,
      "remainingTokens": 998800,
      "overageTokens": 0,
      "maxConcurrent": 2,
      "activeRequests": 0,
      "online": true,
      "models": ["codex"],
      "sdkVersion": "0.1.0",
      "advertisedConcurrency": 2,
      "connectedAt": "2026-07-30T08:00:00.000Z",
      "lastHeartbeatAt": "2026-07-30T08:01:00.000Z",
      "providerTokenPrefix": "tr_provider_…"
    }
  ],
  "consumers": [
    {
      "id": "consumer_...",
      "name": "设计团队",
      "enabled": true,
      "providerId": "prv_...",
      "providerName": "上海工作站",
      "model": "codex",
      "tokenLimit": 100000,
      "tokensUsed": 1200,
      "tokensReserved": 0,
      "remainingTokens": 98800,
      "overageTokens": 0,
      "maxConcurrent": 1,
      "activeRequests": 0,
      "apiKeyPrefix": "tr_consumer_…"
    }
  ],
  "requests": [],
  "summary": {}
}
```

`requests` 为按时间倒序的有界最近请求集合，不得包含消息正文、完整密钥或
`leaseToken`。

### `POST /admin/v1/providers`

请求：

```json
{
  "name": "上海工作站",
  "listed": false
}
```

成功响应只在本次返回完整 Token：

```json
{
  "provider": {
    "id": "provider_...",
    "name": "上海工作站"
  },
  "providerToken": "tr_provider_..."
}
```

### `POST /admin/v1/consumers`

请求：

```json
{
  "name": "设计团队",
  "providerId": "prv_...",
  "model": "codex",
  "tokenLimit": 100000,
  "maxConcurrent": 1
}
```

成功响应只在本次返回完整 API key：

```json
{
  "consumer": {
    "id": "consumer_...",
    "name": "设计团队"
  },
  "apiKey": "tr_consumer_..."
}
```

### 更新与轮换

- `PATCH /admin/v1/providers/:id`
- `PATCH /admin/v1/consumers/:id`
- `POST /admin/v1/providers/:id/rotate-token`
- `POST /admin/v1/consumers/:id/rotate-key`

轮换响应与创建响应一样，只展示一次新凭据。新凭据生效后旧凭据立即失效；调用方
应先安排短暂停机，避免把“同时接受新旧密钥”当作隐含能力。

Admin 创建的 `ownerUserId = null` Provider/Consumer 保持旧版运维语义，不参与用户
积分预留或结算。Admin 可以设置 `listed`，但公开目录仍只展示已启用且确有最后上报
模型的 Provider。

## Provider WebSocket

连接地址为 `/provider/v1/connect`，生产环境必须使用 `wss://`。SDK 在 HTTP
Upgrade 请求中携带 Provider Bearer token。浏览器原生 WebSocket 无法安全设置该
Header，因此 Provider SDK 是 Node 客户端，不是浏览器脚本。

所有帧均为 UTF-8 JSON 文本。客户端连接后首先发送 `hello`：

```json
{
  "type": "hello",
  "protocolVersion": 1,
  "sdkVersion": "0.1.0",
  "models": ["codex", "claude"],
  "concurrency": 2
}
```

服务端认证并接受能力声明后返回：

```json
{
  "type": "ready",
  "protocolVersion": 1,
  "providerId": "prv_...",
  "heartbeatIntervalMs": 15000
}
```

SDK 应按服务端给出的周期发送心跳；模型和并发发生变化时也应立即发送：

```json
{
  "type": "heartbeat",
  "models": ["codex", "claude"],
  "concurrency": 2
}
```

Relay 会持久化最后一次有效 `hello`/`heartbeat` 的规范化模型列表和上报时间，供
Provider 离线后继续在公开目录显示。持久化能力只用于发现；实时路由与跨用户新建
Consumer 必须同时检查当前连接在线并仍 advertise 精确模型名。

### Job

Relay 只向绑定的 Provider 且已上报对应模型的连接发送任务：

```json
{
  "type": "job",
  "job": {
    "id": "job_...",
    "leaseToken": "tr_lease_...",
    "model": "codex",
    "messages": [
      {
        "role": "user",
        "content": "你好"
      }
    ],
    "maxOutputTokens": 800,
    "temperature": 0.2,
    "createdAt": "2026-07-30T08:00:00.000Z",
    "deadlineAt": "2026-07-30T08:05:00.000Z"
  }
}
```

`leaseToken` 同时绑定 Provider、job 和租约期限。SDK 不得记录它，也不得用一个
job 的租约提交另一个 job。

协议 v1 没有独立的 Provider `accepted` 帧。积分语义中的“已接受”以 Relay 成功把
job 写入当前已认证连接并原子地把 request 从 `reserved` 转为 `dispatched` 为准；
在此之前的发送失败必须走完整回滚。若未来要求 Provider 进程级确认，需要提升协议
版本并增加显式 ACK，不能悄悄改变 v1 的结算边界。

成功结果：

```json
{
  "type": "result",
  "jobId": "job_...",
  "leaseToken": "tr_lease_...",
  "result": {
    "content": "模型返回内容",
    "finishReason": "stop",
    "usage": {
      "promptTokens": 8,
      "completionTokens": 6,
      "totalTokens": 14,
      "estimated": true
    }
  }
}
```

失败结果：

```json
{
  "type": "failure",
  "jobId": "job_...",
  "leaseToken": "tr_lease_...",
  "error": {
    "code": "MODEL_EXECUTION_FAILED",
    "message": "本地模型命令执行失败",
    "retryable": false
  }
}
```

服务端接受最终结果后返回 `{"type":"ack","jobId":"job_..."}`。服务端可发送
`cancel`，SDK 应终止仍在运行的本地任务并释放并发槽。协议或状态错误通过
`error` 帧返回；未知消息类型、版本不匹配、过期租约和错误 Provider 的结果都必须
被拒绝。

## 生命周期与计量

1. Relay 收到 Consumer 请求后，用与内置 SDK 相同的 Relay prompt 包装估算输入
   Token，并加上最大输出上限得到 `R`，预留 Consumer 与 Provider Token 配额及
   并发槽。
2. 若 Consumer 与 Provider 都有非空且不同的 `owner_user_id`，同一事务还必须在
   Consumer 所有者账户预留 `R` 积分；只有 `availablePoints >= R` 才能继续。
   任一 owner 为空时不计积分；owner 相同时不要求余额，也不占用净积分预留。
3. 只有全部预留成功才创建 job，并发送给目标 Provider。
4. Provider 返回最终 usage；若 Adapter 无法获得原生 usage，可返回明确标记
   `estimated: true` 的估算值。
5. Relay 对 usage 应用服务端估算下界与异常大数防护，得到完整 accountable Token
   数 `A`。在一个原子结算中释放预留、记入 Token 用量、从 Consumer 所有者扣除
   `A` 积分并向 Provider 所有者增加 `A` 积分，然后完成请求记录。
6. Provider 未接受任务前的超时、取消、断线或失败必须完整释放积分/Token 预留和
   并发槽，不产生 Consumer 扣款或 Provider 收益，并留下不含正文的诊断记录。

CLI 未必提供硬输出 Token 参数，也可能忽略提示中的上限。因此结算 usage 可以高于
预留值。积分结算不以 `R` 封顶：当 `A > R` 时，Consumer 所有者余额允许变为负数，
Provider 所有者仍获得完整 `A` 积分；负的 `availablePoints` 会阻止后续跨所有者
预留。Token 额度同样可能出现 `overageTokens`，后续请求会被额度检查拒绝。Relay
仍会拒绝远高于授权范围的异常 usage，避免 Provider 用伪造大数破坏计数器；这不是
可审计的现金计费系统。

同一用户同时拥有 Consumer 与 Provider 时，每个已结算请求仍写两条关联同一
request id 的账本记录：`consumer_spend = -A` 与 `provider_earn = +A`。二者使余额
净变化为零，但 `consumerTokensUsed` 与 `providerTokensServed` 分别增加，保留双角色
统计。初始积分使用唯一的 `initial_grant` 记录；同一用户重复登录或服务
重启不得再次赠送。

并发重试必须通过服务端持有的 request/job 状态防止重复结算。协议 v1 不承诺跨
进程的 exactly-once 模型执行；调用方不应在未知结果时盲目重试非幂等任务。

迁移旧数据库时，已有用户各获得一次当前配置的 opening grant，已有 Provider 的
`listed` 默认为 `false`，历史请求不追溯生成收支。迁移与第二次启动必须幂等；修改
`TOKEN_RELAY_INITIAL_POINTS` 不得重写已有余额。旧版/Admin
`owner_user_id = NULL` 资源继续可用且不参与积分。

账号密码版本不再提供微信 OAuth 路由，也不读取旧 identity/state。全新数据库只创建
`users`、`password_identities` 和 `user_sessions` 等当前账户表；升级数据库中已存在
的旧微信表为避免破坏性迁移而原样保留，但运行时不使用。只有旧身份、没有
`password_identities` 记录的用户无法通过账号密码入口登录。

## 兼容性

- `protocolVersion` 不匹配时立即关闭 Provider 连接，不能猜测字段语义。
- 同一主版本内新增字段时，接收方应忽略未知字段；缺少当前版本必需字段则拒绝消息。
- 模型名称是大小写敏感的精确字符串。
- 时间使用 UTC ISO 8601；OpenAI HTTP 响应中的 `created` 使用 Unix 秒。
- Provider 协议 v1 仅支持最终文本响应，不支持工具调用、图片、音频、文件或流式
  增量；Anthropic SSE 是最终结果的 Consumer-side 兼容封装。
