import Foundation

@MainActor
final class RoomViewModel: ObservableObject {
    @Published var models: [ModelConfig]
    @Published var messages: [ChatMessage]
    @Published var memories: [MemoryRecord]
    @Published var summaries: [ContextSummary]
    @Published var tokenBudget: Int

    private let engine = RoomEngine()
    private let store = RoomStore()

    init() {
        let snapshot = store.load()
        models = snapshot.models
        messages = snapshot.messages
        memories = snapshot.memories
        summaries = snapshot.summaries
        tokenBudget = snapshot.tokenBudget
    }

    var enabledModels: [ModelConfig] {
        models.filter(\.enabled)
    }

    var activeTokens: Int {
        let text = (messages.map(\.text) + memories.map(\.text) + summaries.suffix(4).map(\.text)).joined(separator: " ")
        return engine.estimateTokens(text)
    }

    func send(_ hostText: String) {
        let trimmed = hostText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let result = engine.discuss(hostText: trimmed, models: models, memories: memories, summaries: summaries)
        messages.append(contentsOf: result.messages)
        if let memory = result.capturedMemory {
            memories.append(memory)
        }
        compact(force: false)
        save()
    }

    func compact(force: Bool) {
        let result = engine.compactIfNeeded(
            messages: messages,
            memories: memories,
            summaries: summaries,
            tokenBudget: tokenBudget,
            force: force
        )
        messages = result.0
        if let summary = result.1 {
            summaries.append(summary)
        }
        save()
    }

    func addModel(name: String, provider: String, modelId: String, endpoint: String, persona: String) {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !persona.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }

        let colors = ["#39A0FF", "#FF7A45", "#4FD18B", "#9B7CFF"]
        models.append(
            ModelConfig(
                id: Ids.next("model"),
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                provider: provider.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Custom" : provider,
                modelId: modelId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "simulation-model" : modelId,
                endpoint: endpoint.trimmingCharacters(in: .whitespacesAndNewlines),
                persona: persona.trimmingCharacters(in: .whitespacesAndNewlines),
                temperature: 0.7,
                colorHex: colors.randomElement() ?? "#39A0FF",
                enabled: true
            )
        )
        save()
    }

    func toggleModel(_ model: ModelConfig) {
        guard let index = models.firstIndex(where: { $0.id == model.id }) else { return }
        models[index].enabled.toggle()
        save()
    }

    func deleteModel(_ model: ModelConfig) {
        models.removeAll { $0.id == model.id }
        save()
    }

    func addMemory(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        memories.append(MemoryRecord(id: Ids.next("mem"), text: trimmed, source: "manual", createdAt: Date()))
        save()
    }

    func forgetMemory(_ memory: MemoryRecord) {
        memories.removeAll { $0.id == memory.id }
        save()
    }

    func clearTranscript() {
        messages = []
        save()
    }

    func clearSummaries() {
        summaries = []
        save()
    }

    func save() {
        store.save(
            RoomSnapshot(
                models: models,
                messages: messages,
                memories: memories,
                summaries: summaries,
                tokenBudget: tokenBudget
            )
        )
    }
}

