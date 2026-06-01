package com.cyberliveroom.ui

import android.os.Bundle
import android.text.format.DateFormat
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cyberliveroom.data.RoomStore
import com.cyberliveroom.domain.ChatMessage
import com.cyberliveroom.domain.ContextSummary
import com.cyberliveroom.domain.Ids
import com.cyberliveroom.domain.MemoryRecord
import com.cyberliveroom.domain.ModelConfig
import com.cyberliveroom.domain.RoomEngine
import com.cyberliveroom.domain.RoomSnapshot

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CyberLiveRoomApp()
        }
    }
}

private enum class RoomTab(val label: String) {
    Room("Room"),
    Config("Config"),
    Memory("Memory")
}

@Composable
fun CyberLiveRoomApp() {
    val colors = darkColorScheme(
        primary = Color(0xFF39A0FF),
        secondary = Color(0xFF4FD18B),
        tertiary = Color(0xFFFF7A45),
        background = Color(0xFF111318),
        surface = Color(0xFF202632)
    )

    MaterialTheme(colorScheme = colors) {
        val context = LocalContext.current
        val store = remember { RoomStore(context) }
        val snapshot = remember { store.load() }
        val engine = remember { RoomEngine() }
        val models = remember { mutableStateListOf<ModelConfig>().apply { addAll(snapshot.models) } }
        val messages = remember { mutableStateListOf<ChatMessage>().apply { addAll(snapshot.messages) } }
        val memories = remember { mutableStateListOf<MemoryRecord>().apply { addAll(snapshot.memories) } }
        val summaries = remember { mutableStateListOf<ContextSummary>().apply { addAll(snapshot.summaries) } }
        var tokenBudget by remember { mutableStateOf(snapshot.tokenBudget) }
        var tab by remember { mutableStateOf(RoomTab.Room) }

        LaunchedEffect(models.toList(), messages.toList(), memories.toList(), summaries.toList(), tokenBudget) {
            store.save(
                RoomSnapshot(
                    models = models.toList(),
                    messages = messages.toList(),
                    memories = memories.toList(),
                    summaries = summaries.toList(),
                    tokenBudget = tokenBudget
                )
            )
        }

        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().padding(16.dp)) {
                Header(models = models, memories = memories, summaries = summaries)
                TabRow(selectedTabIndex = tab.ordinal) {
                    RoomTab.entries.forEach { item ->
                        Tab(
                            selected = tab == item,
                            onClick = { tab = item },
                            text = { Text(item.label) }
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                when (tab) {
                    RoomTab.Room -> RoomScreen(
                        engine = engine,
                        models = models,
                        messages = messages,
                        memories = memories,
                        summaries = summaries,
                        tokenBudget = tokenBudget
                    )
                    RoomTab.Config -> ConfigScreen(models = models)
                    RoomTab.Memory -> MemoryScreen(
                        engine = engine,
                        messages = messages,
                        memories = memories,
                        summaries = summaries,
                        tokenBudget = tokenBudget,
                        onBudgetChange = { tokenBudget = it }
                    )
                }
            }
        }
    }
}

@Composable
private fun Header(
    models: List<ModelConfig>,
    memories: List<MemoryRecord>,
    summaries: List<ContextSummary>
) {
    Column {
        Text("Cyber Live Room", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "${models.count { it.enabled }} enabled models / ${memories.size} memories / ${summaries.size} summaries",
            color = Color(0xFFAEB8C6)
        )
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun RoomScreen(
    engine: RoomEngine,
    models: MutableList<ModelConfig>,
    messages: MutableList<ChatMessage>,
    memories: MutableList<MemoryRecord>,
    summaries: MutableList<ContextSummary>,
    tokenBudget: Int
) {
    var hostText by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AudienceRow(models.filter { it.enabled })
        OutlinedTextField(
            value = hostText,
            onValueChange = { hostText = it },
            label = { Text("Host broadcast") },
            placeholder = { Text("Ask the model audience to debate a plan or decision.") },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    val text = hostText.trim()
                    if (text.isNotEmpty()) {
                        val result = engine.discuss(text, models, memories, summaries)
                        messages.addAll(result.messages)
                        result.capturedMemory?.let { memories.add(it) }
                        val compacted = engine.compactIfNeeded(messages, memories, summaries, tokenBudget)
                        messages.clear()
                        messages.addAll(compacted.first)
                        compacted.second?.let { summaries.add(it) }
                        hostText = ""
                    }
                }
            ) {
                Text("Go Live")
            }
            TextButton(
                onClick = {
                    hostText = "Debate the MVP scope for Cyber Live Room: configurable models, memory, and context compression."
                }
            ) {
                Text("Seed Demo")
            }
            TextButton(
                onClick = {
                    val compacted = engine.compactIfNeeded(messages, memories, summaries, tokenBudget, force = true)
                    messages.clear()
                    messages.addAll(compacted.first)
                    compacted.second?.let { summaries.add(it) }
                }
            ) {
                Text("Compact")
            }
        }
        Divider(color = Color(0xFF384250))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
            if (messages.isEmpty()) {
                item { Text("The room is quiet. Send a host broadcast to start.", color = Color(0xFFAEB8C6)) }
            }
            items(messages, key = { it.id }) { message ->
                MessageCard(message)
            }
        }
    }
}

@Composable
private fun AudienceRow(models: List<ModelConfig>) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        models.forEach { model ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF202632))
                    .border(BorderStroke(1.dp, Color(model.color)), RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Avatar(model.name, model.color)
                Text(model.name, modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}

@Composable
private fun MessageCard(message: ChatMessage) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF202632)),
        border = BorderStroke(1.dp, Color(message.color)),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(message.author, fontWeight = FontWeight.Bold)
                Text("${message.provider ?: message.kind.name} / ${formatTime(message.createdAt)}", color = Color(0xFFAEB8C6))
            }
            Spacer(Modifier.height(8.dp))
            Text(message.text)
        }
    }
}

@Composable
private fun ConfigScreen(models: MutableList<ModelConfig>) {
    var name by remember { mutableStateOf("") }
    var provider by remember { mutableStateOf("Custom") }
    var modelId by remember { mutableStateOf("simulation-model") }
    var endpoint by remember { mutableStateOf("") }
    var persona by remember { mutableStateOf("") }
    var enabled by remember { mutableStateOf(true) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Add Model", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        OutlinedTextField(name, { name = it }, label = { Text("Display name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(provider, { provider = it }, label = { Text("Provider") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(modelId, { modelId = it }, label = { Text("Provider model id") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(endpoint, { endpoint = it }, label = { Text("Endpoint") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(persona, { persona = it }, label = { Text("Persona") }, minLines = 3, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = enabled, onCheckedChange = { enabled = it })
            Text("Enabled in room")
        }
        Button(
            onClick = {
                if (name.isNotBlank() && persona.isNotBlank()) {
                    models.add(
                        ModelConfig(
                            id = Ids.next("model"),
                            name = name.trim(),
                            provider = provider.trim().ifBlank { "Custom" },
                            modelId = modelId.trim().ifBlank { "simulation-model" },
                            endpoint = endpoint.trim(),
                            persona = persona.trim(),
                            temperature = 0.7f,
                            color = listOf(0xFF39A0FF, 0xFFFF7A45, 0xFF4FD18B, 0xFF9B7CFF).random(),
                            enabled = enabled
                        )
                    )
                    name = ""
                    provider = "Custom"
                    modelId = "simulation-model"
                    endpoint = ""
                    persona = ""
                    enabled = true
                }
            }
        ) {
            Text("Save Model")
        }
        Divider(color = Color(0xFF384250))
        Text("Configured Models", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        models.forEachIndexed { index, model ->
            ModelConfigCard(
                model = model,
                onToggle = { models[index] = model.copy(enabled = !model.enabled) },
                onDelete = { models.removeAt(index) }
            )
        }
    }
}

@Composable
private fun ModelConfigCard(model: ModelConfig, onToggle: () -> Unit, onDelete: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF202632)), shape = RoundedCornerShape(8.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text(model.name, fontWeight = FontWeight.Bold)
                    Text("${model.provider} / ${model.modelId}", color = Color(0xFFAEB8C6))
                }
                Avatar(model.name, model.color)
            }
            Text(model.persona, color = Color(0xFFAEB8C6))
            Text("Endpoint: ${model.endpoint.ifBlank { "simulation adapter" }}", color = Color(0xFFAEB8C6))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onToggle) { Text(if (model.enabled) "Disable" else "Enable") }
                TextButton(onClick = onDelete) { Text("Delete") }
            }
        }
    }
}

@Composable
private fun MemoryScreen(
    engine: RoomEngine,
    messages: MutableList<ChatMessage>,
    memories: MutableList<MemoryRecord>,
    summaries: MutableList<ContextSummary>,
    tokenBudget: Int,
    onBudgetChange: (Int) -> Unit
) {
    var memoryText by remember { mutableStateOf("") }
    val activeTokens = engine.estimateTokens(
        (messages.map { it.text } + memories.map { it.text } + summaries.takeLast(4).map { it.text }).joinToString(" ")
    )

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Room Memory", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text("Active context: $activeTokens tokens / budget: $tokenBudget", color = Color(0xFFAEB8C6))
        Slider(
            value = tokenBudget.toFloat(),
            onValueChange = { onBudgetChange(it.toInt()) },
            valueRange = 300f..2200f,
            steps = 18
        )
        OutlinedTextField(
            value = memoryText,
            onValueChange = { memoryText = it },
            label = { Text("Pinned memory") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = {
                    if (memoryText.isNotBlank()) {
                        memories.add(MemoryRecord(id = Ids.next("mem"), text = memoryText.trim(), source = "manual"))
                        memoryText = ""
                    }
                }
            ) {
                Text("Add Memory")
            }
            TextButton(
                onClick = {
                    val compacted = engine.compactIfNeeded(messages, memories, summaries, tokenBudget, force = true)
                    messages.clear()
                    messages.addAll(compacted.first)
                    compacted.second?.let { summaries.add(it) }
                }
            ) {
                Text("Compact Now")
            }
        }
        memories.forEachIndexed { index, memory ->
            MemoryCard(memory, onForget = { memories.removeAt(index) })
        }
        Divider(color = Color(0xFF384250))
        Text("Compressed Context", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        if (summaries.isEmpty()) Text("No compressed summaries yet.", color = Color(0xFFAEB8C6))
        summaries.asReversed().forEach { summary ->
            SummaryCard(summary)
        }
    }
}

@Composable
private fun MemoryCard(memory: MemoryRecord, onForget: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF202632)), shape = RoundedCornerShape(8.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(memory.text)
            Text("${memory.source} / ${formatTime(memory.createdAt)}", color = Color(0xFFAEB8C6))
            TextButton(onClick = onForget) { Text("Forget") }
        }
    }
}

@Composable
private fun SummaryCard(summary: ContextSummary) {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF202632)), shape = RoundedCornerShape(8.dp)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(summary.text)
            Text("${summary.messageCount} messages / ${formatTime(summary.createdAt)}", color = Color(0xFFAEB8C6))
        }
    }
}

@Composable
private fun Avatar(name: String, color: Long) {
    Surface(
        modifier = Modifier.size(36.dp),
        shape = CircleShape,
        color = Color(0xFF111318),
        border = BorderStroke(2.dp, Color(color))
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(initials(name), color = Color(color), fontWeight = FontWeight.Bold)
        }
    }
}

private fun initials(name: String): String =
    name.split(Regex("\\s+")).filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
        .ifBlank { "AI" }

private fun formatTime(timestamp: Long): String =
    DateFormat.format("HH:mm", timestamp).toString()
