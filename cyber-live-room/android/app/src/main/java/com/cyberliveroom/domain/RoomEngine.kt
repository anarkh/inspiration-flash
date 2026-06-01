package com.cyberliveroom.domain

import java.util.Locale
import kotlin.math.ceil

object Ids {
    fun next(prefix: String): String = "$prefix-${System.currentTimeMillis()}-${(1000..9999).random()}"
}

class RoomEngine {
    fun discuss(
        hostText: String,
        models: List<ModelConfig>,
        memories: List<MemoryRecord>,
        summaries: List<ContextSummary>
    ): DiscussionResult {
        val enabled = models.filter { it.enabled }
        val capturedMemory = captureMemory(hostText)
        val messages = mutableListOf(
            ChatMessage(
                id = Ids.next("msg"),
                kind = MessageKind.Host,
                author = "Host",
                provider = null,
                text = hostText,
                color = 0xFF4FD18B
            )
        )

        if (capturedMemory != null) {
            messages += ChatMessage(
                id = Ids.next("msg"),
                kind = MessageKind.System,
                author = "Memory",
                provider = null,
                text = "Saved memory: ${capturedMemory.text}",
                color = 0xFF9B7CFF
            )
        }

        if (enabled.isEmpty()) {
            messages += ChatMessage(
                id = Ids.next("msg"),
                kind = MessageKind.System,
                author = "Room Director",
                provider = null,
                text = "No audience models are enabled. Enable a model in Config before starting a discussion.",
                color = 0xFF9B7CFF
            )
            return DiscussionResult(messages, capturedMemory)
        }

        val firstRound = enabled.map { model ->
            ChatMessage(
                id = Ids.next("msg"),
                kind = MessageKind.Model,
                author = model.name,
                provider = model.provider,
                text = replyFor(model, hostText, memories, summaries, null),
                color = model.color
            )
        }
        messages += firstRound

        if (enabled.size > 1) {
            enabled.forEachIndexed { index, model ->
                val peer = firstRound[(index + enabled.size - 1) % enabled.size]
                messages += ChatMessage(
                    id = Ids.next("msg"),
                    kind = MessageKind.Model,
                    author = model.name,
                    provider = model.provider,
                    text = replyFor(model, hostText, memories, summaries, peer),
                    color = model.color
                )
            }
        }

        return DiscussionResult(messages, capturedMemory)
    }

    fun compactIfNeeded(
        messages: List<ChatMessage>,
        memories: List<MemoryRecord>,
        summaries: List<ContextSummary>,
        tokenBudget: Int,
        force: Boolean = false
    ): Pair<List<ChatMessage>, ContextSummary?> {
        val activeTokens = estimateTokens(
            (messages.map { it.text } + memories.map { it.text } + summaries.takeLast(4).map { it.text })
                .joinToString(" ")
        )
        if ((!force && activeTokens <= tokenBudget && messages.size <= 18) || messages.size < 8) {
            return messages to null
        }

        val keepCount = 8
        val compacted = messages.dropLast(keepCount)
        if (compacted.isEmpty()) return messages to null

        val summary = ContextSummary(
            id = Ids.next("sum"),
            text = summarizeMessages(compacted),
            messageCount = compacted.size
        )
        val notice = ChatMessage(
            id = Ids.next("msg"),
            kind = MessageKind.System,
            author = "Context Compressor",
            provider = null,
            text = "Compressed ${compacted.size} older messages into a carry-forward summary.",
            color = 0xFF9B7CFF
        )
        return listOf(notice) + messages.takeLast(keepCount) to summary
    }

    fun estimateTokens(text: String): Int {
        if (text.isBlank()) return 0
        return ceil(text.length / 4.0).toInt().coerceAtLeast(1)
    }

    private fun replyFor(
        model: ModelConfig,
        hostText: String,
        memories: List<MemoryRecord>,
        summaries: List<ContextSummary>,
        peer: ChatMessage?
    ): String {
        val role = classify(model)
        val memoryLine = memories.lastOrNull()?.let {
            "I will keep \"${it.text.take(96)}\" in scope."
        } ?: "I do not have durable memory yet."
        val summaryLine = if (summaries.isNotEmpty()) {
            "I also see ${summaries.size} compressed context record(s)."
        } else {
            "No compressed context is needed yet."
        }

        if (peer != null) {
            return "Reacting to ${peer.author}: ${reaction(role)}. " +
                "The next move is ${nextMove(role)}. " +
                "The main risk is ${risk(role)}. $memoryLine $summaryLine"
        }

        return "${opener(role)} \"${hostText.take(120)}\". " +
            "I would prioritize ${priority(role)}. " +
            "Watch for ${risk(role)}. $memoryLine $summaryLine"
    }

    private fun captureMemory(text: String): MemoryRecord? {
        val patterns = listOf(
            Regex("remember(?: that|:)?\\s+(.+)", RegexOption.IGNORE_CASE),
            Regex("keep in mind(?: that|:)?\\s+(.+)", RegexOption.IGNORE_CASE),
            Regex("i prefer\\s+(.+)", RegexOption.IGNORE_CASE),
            Regex("my preference is\\s+(.+)", RegexOption.IGNORE_CASE)
        )
        val value = patterns.firstNotNullOfOrNull { regex ->
            regex.find(text)?.groupValues?.getOrNull(1)
        }?.trim()?.take(220)

        return value?.takeIf { it.isNotBlank() }?.let {
            MemoryRecord(
                id = Ids.next("mem"),
                text = it,
                source = "auto-capture"
            )
        }
    }

    private fun summarizeMessages(messages: List<ChatMessage>): String {
        val hostIntent = messages
            .filter { it.kind == MessageKind.Host }
            .takeLast(3)
            .joinToString(" | ") { it.text.take(120) }
            .ifBlank { "No host messages." }
        val topics = topKeywords(messages.joinToString(" ") { it.text }).joinToString(", ")
            .ifBlank { "general discussion" }
        val positions = messages
            .filter { it.kind == MessageKind.Model }
            .groupBy { it.author }
            .map { (author, lines) -> "$author: ${lines.takeLast(2).joinToString(" / ") { it.text.take(90) }}" }
            .joinToString("\n")
            .ifBlank { "No model positions." }
        val questions = messages
            .filter { it.kind == MessageKind.Host && it.text.contains("?") }
            .joinToString(" | ") { it.text.take(100) }
            .ifBlank { "None captured." }

        return listOf(
            "Topics: $topics",
            "Host intent: $hostIntent",
            "Model positions:\n$positions",
            "Open questions: $questions",
            "Carry-forward memory hints: preserve decisions, unresolved risks, and host preferences from this block."
        ).joinToString("\n")
    }

    private fun topKeywords(text: String): List<String> {
        val stop = setOf("the", "and", "for", "with", "that", "this", "room", "model", "should", "would")
        return text
            .lowercase(Locale.US)
            .replace(Regex("[^a-z0-9\\s-]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length > 3 && it !in stop }
            .groupingBy { it }
            .eachCount()
            .entries
            .sortedByDescending { it.value }
            .take(6)
            .map { it.key }
    }

    private fun classify(model: ModelConfig): String {
        val haystack = "${model.name} ${model.persona}".lowercase(Locale.US)
        return when {
            "engineer" in haystack || "architecture" in haystack -> "engineer"
            "critic" in haystack || "risk" in haystack || "adversarial" in haystack -> "critic"
            "design" in haystack || "ux" in haystack -> "designer"
            "product" in haystack || "strategy" in haystack || "user" in haystack -> "strategist"
            else -> "generalist"
        }
    }

    private fun opener(role: String) = when (role) {
        "engineer" -> "From an implementation angle, I hear"
        "critic" -> "The weak point to test is"
        "designer" -> "From the room experience angle, I hear"
        "strategist" -> "From a product angle, I hear"
        else -> "My read is"
    }

    private fun priority(role: String) = when (role) {
        "engineer" -> "a clean room state and provider adapter contract"
        "critic" -> "proof that multiple model voices improve decisions"
        "designer" -> "clear turn-taking and visible model identity"
        "strategist" -> "the host workflow: ask, compare, save memory, decide"
        else -> "one workflow that proves the room creates better answers"
    }

    private fun risk(role: String) = when (role) {
        "engineer" -> "state divergence between transcript, memory, and provider calls"
        "critic" -> "many models creating noise without judgment"
        "designer" -> "configuration overwhelming the host before trust is earned"
        "strategist" -> "shipping provider setup before the discussion loop feels valuable"
        else -> "unclear ownership of what should become memory"
    }

    private fun nextMove(role: String) = when (role) {
        "engineer" -> "reuse the same room engine rules across platforms"
        "critic" -> "force each model to state a decision, a risk, and evidence"
        "designer" -> "make speaking order and saved memory visible"
        "strategist" -> "ship offline simulation first to validate the host workflow"
        else -> "turn the host prompt into a decision-oriented discussion"
    }

    private fun reaction(role: String) = when (role) {
        "engineer" -> "the data contract needs to be explicit"
        "critic" -> "the room must prove the extra voices add judgment"
        "designer" -> "this should become a visible host control"
        "strategist" -> "this should map to a first-session success metric"
        else -> "this needs one concrete next step"
    }
}
