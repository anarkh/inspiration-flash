# Cyber Live Room Product Spec

## User Model

The user is the host of a live room. The host enters a topic, brief, or
question. Enabled models sit in the audience. Each model has a name, provider,
role, style, color, temperature, and endpoint metadata.

## Discussion Flow

1. The host publishes a message.
2. The room engine injects current memories and recent summaries.
3. Every enabled model gives a first-round response.
4. Additional rounds let models reference prior model positions.
5. The transcript is persisted locally.
6. If the estimated context budget is exceeded, old transcript items are
   compressed into a durable summary and only recent messages remain active.

## Memory System

Cyber Live Room uses three memory layers:

- Pinned memory: user-authored facts and preferences.
- Captured memory: simple automatic extraction from host messages, such as
  "remember ..." or "prefer ...".
- Session summaries: compressed transcript records created by the context
  compressor.

The prompt context for a model should be assembled in this order:

1. System product rule: the model is an audience member in a live room.
2. Model persona and provider metadata.
3. Pinned and captured memories.
4. Recent compressed summaries.
5. Recent active transcript.
6. Latest host message.

## Context Compression

Compression keeps the last active messages intact and summarizes older messages
into a structured record:

- Topics
- Host intent
- Model positions
- Decisions
- Open questions
- Carry-forward memory hints

This mirrors the practical behavior of coding assistants that keep durable
memory outside the short-term context window and summarize old conversation
state before continuing.

## API Adapter Contract

Real model adapters should receive:

```json
{
  "model": {
    "id": "string",
    "name": "string",
    "provider": "string",
    "endpoint": "string",
    "apiKey": "string",
    "modelId": "string",
    "temperature": 0.7,
    "persona": "string"
  },
  "context": {
    "memories": [],
    "summaries": [],
    "recentMessages": [],
    "hostMessage": "string"
  }
}
```

Adapters should return:

```json
{
  "text": "string",
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0
  }
}
```
