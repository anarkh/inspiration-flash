package com.cyberliveroom.domain

data class ModelConfig(
    val id: String,
    val name: String,
    val provider: String,
    val modelId: String,
    val endpoint: String,
    val persona: String,
    val temperature: Float,
    val color: Long,
    val enabled: Boolean
)

data class ChatMessage(
    val id: String,
    val kind: MessageKind,
    val author: String,
    val provider: String?,
    val text: String,
    val color: Long,
    val createdAt: Long = System.currentTimeMillis()
)

data class MemoryRecord(
    val id: String,
    val text: String,
    val source: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class ContextSummary(
    val id: String,
    val text: String,
    val messageCount: Int,
    val createdAt: Long = System.currentTimeMillis()
)

enum class MessageKind {
    Host,
    Model,
    System
}

data class DiscussionResult(
    val messages: List<ChatMessage>,
    val capturedMemory: MemoryRecord?
)

data class RoomSnapshot(
    val models: List<ModelConfig>,
    val messages: List<ChatMessage>,
    val memories: List<MemoryRecord>,
    val summaries: List<ContextSummary>,
    val tokenBudget: Int
)

object SeedData {
    val defaultModels = listOf(
        ModelConfig(
            id = "model-strategist",
            name = "Strategist",
            provider = "OpenAI",
            modelId = "gpt-discussion",
            endpoint = "",
            persona = "Product strategist focused on user value, positioning, and next steps.",
            temperature = 0.7f,
            color = 0xFF39A0FF,
            enabled = true
        ),
        ModelConfig(
            id = "model-engineer",
            name = "Engineer",
            provider = "Anthropic",
            modelId = "claude-discussion",
            endpoint = "",
            persona = "Senior engineer focused on architecture, edge cases, and implementation risk.",
            temperature = 0.45f,
            color = 0xFFFF7A45,
            enabled = true
        ),
        ModelConfig(
            id = "model-critic",
            name = "Critic",
            provider = "Google",
            modelId = "gemini-discussion",
            endpoint = "",
            persona = "Adversarial reviewer focused on gaps, weak assumptions, and missing evidence.",
            temperature = 0.6f,
            color = 0xFF9B7CFF,
            enabled = true
        )
    )

    val defaultMemory = MemoryRecord(
        id = Ids.next("mem"),
        text = "The host prefers concrete tradeoffs, clear recommendations, and implementation-ready discussion.",
        source = "system-seed"
    )
}
