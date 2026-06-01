package com.cyberliveroom.data

import android.content.Context
import com.cyberliveroom.domain.ChatMessage
import com.cyberliveroom.domain.ContextSummary
import com.cyberliveroom.domain.MemoryRecord
import com.cyberliveroom.domain.MessageKind
import com.cyberliveroom.domain.ModelConfig
import com.cyberliveroom.domain.RoomSnapshot
import com.cyberliveroom.domain.SeedData
import org.json.JSONArray
import org.json.JSONObject

class RoomStore(context: Context) {
    private val prefs = context.getSharedPreferences("cyber-live-room", Context.MODE_PRIVATE)

    fun load(): RoomSnapshot {
        val raw = prefs.getString("snapshot", null) ?: return defaultSnapshot()
        return try {
            val json = JSONObject(raw)
            RoomSnapshot(
                models = json.getJSONArray("models").mapObjects(::modelFromJson),
                messages = json.getJSONArray("messages").mapObjects(::messageFromJson),
                memories = json.getJSONArray("memories").mapObjects(::memoryFromJson),
                summaries = json.getJSONArray("summaries").mapObjects(::summaryFromJson),
                tokenBudget = json.optInt("tokenBudget", 900)
            )
        } catch (_: Exception) {
            defaultSnapshot()
        }
    }

    fun save(snapshot: RoomSnapshot) {
        val json = JSONObject()
            .put("models", JSONArray(snapshot.models.map(::modelToJson)))
            .put("messages", JSONArray(snapshot.messages.map(::messageToJson)))
            .put("memories", JSONArray(snapshot.memories.map(::memoryToJson)))
            .put("summaries", JSONArray(snapshot.summaries.map(::summaryToJson)))
            .put("tokenBudget", snapshot.tokenBudget)
        prefs.edit().putString("snapshot", json.toString()).apply()
    }

    private fun defaultSnapshot() = RoomSnapshot(
        models = SeedData.defaultModels,
        messages = emptyList(),
        memories = listOf(SeedData.defaultMemory),
        summaries = emptyList(),
        tokenBudget = 900
    )

    private fun modelToJson(model: ModelConfig) = JSONObject()
        .put("id", model.id)
        .put("name", model.name)
        .put("provider", model.provider)
        .put("modelId", model.modelId)
        .put("endpoint", model.endpoint)
        .put("persona", model.persona)
        .put("temperature", model.temperature.toDouble())
        .put("color", model.color)
        .put("enabled", model.enabled)

    private fun modelFromJson(json: JSONObject) = ModelConfig(
        id = json.getString("id"),
        name = json.getString("name"),
        provider = json.getString("provider"),
        modelId = json.optString("modelId", "simulation-model"),
        endpoint = json.optString("endpoint", ""),
        persona = json.getString("persona"),
        temperature = json.optDouble("temperature", 0.7).toFloat(),
        color = json.optLong("color", 0xFF39A0FF),
        enabled = json.optBoolean("enabled", true)
    )

    private fun messageToJson(message: ChatMessage) = JSONObject()
        .put("id", message.id)
        .put("kind", message.kind.name)
        .put("author", message.author)
        .put("provider", message.provider)
        .put("text", message.text)
        .put("color", message.color)
        .put("createdAt", message.createdAt)

    private fun messageFromJson(json: JSONObject) = ChatMessage(
        id = json.getString("id"),
        kind = MessageKind.valueOf(json.getString("kind")),
        author = json.getString("author"),
        provider = json.optString("provider").ifBlank { null },
        text = json.getString("text"),
        color = json.optLong("color", 0xFF384250),
        createdAt = json.optLong("createdAt", System.currentTimeMillis())
    )

    private fun memoryToJson(memory: MemoryRecord) = JSONObject()
        .put("id", memory.id)
        .put("text", memory.text)
        .put("source", memory.source)
        .put("createdAt", memory.createdAt)

    private fun memoryFromJson(json: JSONObject) = MemoryRecord(
        id = json.getString("id"),
        text = json.getString("text"),
        source = json.optString("source", "manual"),
        createdAt = json.optLong("createdAt", System.currentTimeMillis())
    )

    private fun summaryToJson(summary: ContextSummary) = JSONObject()
        .put("id", summary.id)
        .put("text", summary.text)
        .put("messageCount", summary.messageCount)
        .put("createdAt", summary.createdAt)

    private fun summaryFromJson(json: JSONObject) = ContextSummary(
        id = json.getString("id"),
        text = json.getString("text"),
        messageCount = json.optInt("messageCount", 0),
        createdAt = json.optLong("createdAt", System.currentTimeMillis())
    )
}

private fun <T> JSONArray.mapObjects(transform: (JSONObject) -> T): List<T> =
    (0 until length()).map { index -> transform(getJSONObject(index)) }
