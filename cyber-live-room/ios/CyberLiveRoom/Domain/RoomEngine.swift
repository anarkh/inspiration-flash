import Foundation

final class RoomEngine {
    func discuss(
        hostText: String,
        models: [ModelConfig],
        memories: [MemoryRecord],
        summaries: [ContextSummary]
    ) -> DiscussionResult {
        let enabled = models.filter(\.enabled)
        let capturedMemory = captureMemory(hostText)
        var messages = [
            ChatMessage(
                id: Ids.next("msg"),
                kind: .host,
                author: "Host",
                provider: nil,
                text: hostText,
                colorHex: "#4FD18B",
                createdAt: Date()
            )
        ]

        if let capturedMemory {
            messages.append(
                ChatMessage(
                    id: Ids.next("msg"),
                    kind: .system,
                    author: "Memory",
                    provider: nil,
                    text: "Saved memory: \(capturedMemory.text)",
                    colorHex: "#9B7CFF",
                    createdAt: Date()
                )
            )
        }

        guard !enabled.isEmpty else {
            messages.append(
                ChatMessage(
                    id: Ids.next("msg"),
                    kind: .system,
                    author: "Room Director",
                    provider: nil,
                    text: "No audience models are enabled. Enable a model in Config before starting a discussion.",
                    colorHex: "#9B7CFF",
                    createdAt: Date()
                )
            )
            return DiscussionResult(messages: messages, capturedMemory: capturedMemory)
        }

        let firstRound = enabled.map { model in
            ChatMessage(
                id: Ids.next("msg"),
                kind: .model,
                author: model.name,
                provider: model.provider,
                text: reply(for: model, hostText: hostText, memories: memories, summaries: summaries, peer: nil),
                colorHex: model.colorHex,
                createdAt: Date()
            )
        }
        messages.append(contentsOf: firstRound)

        if enabled.count > 1 {
            for (index, model) in enabled.enumerated() {
                let peer = firstRound[(index + enabled.count - 1) % enabled.count]
                messages.append(
                    ChatMessage(
                        id: Ids.next("msg"),
                        kind: .model,
                        author: model.name,
                        provider: model.provider,
                        text: reply(for: model, hostText: hostText, memories: memories, summaries: summaries, peer: peer),
                        colorHex: model.colorHex,
                        createdAt: Date()
                    )
                )
            }
        }

        return DiscussionResult(messages: messages, capturedMemory: capturedMemory)
    }

    func compactIfNeeded(
        messages: [ChatMessage],
        memories: [MemoryRecord],
        summaries: [ContextSummary],
        tokenBudget: Int,
        force: Bool = false
    ) -> ([ChatMessage], ContextSummary?) {
        let activeText = (messages.map(\.text) + memories.map(\.text) + summaries.suffix(4).map(\.text)).joined(separator: " ")
        let shouldCompact = force || estimateTokens(activeText) > tokenBudget || messages.count > 18
        guard shouldCompact, messages.count >= 8 else { return (messages, nil) }

        let keepCount = 8
        let compacted = Array(messages.dropLast(keepCount))
        guard !compacted.isEmpty else { return (messages, nil) }

        let summary = ContextSummary(
            id: Ids.next("sum"),
            text: summarizeMessages(compacted),
            messageCount: compacted.count,
            createdAt: Date()
        )
        let notice = ChatMessage(
            id: Ids.next("msg"),
            kind: .system,
            author: "Context Compressor",
            provider: nil,
            text: "Compressed \(compacted.count) older messages into a carry-forward summary.",
            colorHex: "#9B7CFF",
            createdAt: Date()
        )
        return ([notice] + messages.suffix(keepCount), summary)
    }

    func estimateTokens(_ text: String) -> Int {
        guard !text.isEmpty else { return 0 }
        return max(1, Int(ceil(Double(text.count) / 4.0)))
    }

    private func reply(
        for model: ModelConfig,
        hostText: String,
        memories: [MemoryRecord],
        summaries: [ContextSummary],
        peer: ChatMessage?
    ) -> String {
        let role = classify(model)
        let memoryLine = memories.last.map { "I will keep \"\(String($0.text.prefix(96)))\" in scope." }
            ?? "I do not have durable memory yet."
        let summaryLine = summaries.isEmpty
            ? "No compressed context is needed yet."
            : "I also see \(summaries.count) compressed context record(s)."

        if let peer {
            return "Reacting to \(peer.author): \(reaction(role)). " +
                "The next move is \(nextMove(role)). " +
                "The main risk is \(risk(role)). \(memoryLine) \(summaryLine)"
        }

        return "\(opener(role)) \"\(String(hostText.prefix(120)))\". " +
            "I would prioritize \(priority(role)). " +
            "Watch for \(risk(role)). \(memoryLine) \(summaryLine)"
    }

    private func captureMemory(_ text: String) -> MemoryRecord? {
        let lower = text.lowercased()
        let triggers = [
            "remember that ",
            "remember: ",
            "remember ",
            "keep in mind that ",
            "keep in mind: ",
            "i prefer ",
            "my preference is "
        ]

        for trigger in triggers {
            if let range = lower.range(of: trigger) {
                let value = text[range.upperBound...].trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty {
                    return MemoryRecord(
                        id: Ids.next("mem"),
                        text: String(value.prefix(220)),
                        source: "auto-capture",
                        createdAt: Date()
                    )
                }
            }
        }
        return nil
    }

    private func summarizeMessages(_ messages: [ChatMessage]) -> String {
        let hostIntent = messages
            .filter { $0.kind == .host }
            .suffix(3)
            .map { String($0.text.prefix(120)) }
            .joined(separator: " | ")
        let topics = topKeywords(messages.map(\.text).joined(separator: " ")).joined(separator: ", ")
        let positions = Dictionary(grouping: messages.filter { $0.kind == .model }, by: \.author)
            .map { author, lines in
                "\(author): \(lines.suffix(2).map { String($0.text.prefix(90)) }.joined(separator: " / "))"
            }
            .sorted()
            .joined(separator: "\n")
        let questions = messages
            .filter { $0.kind == .host && $0.text.contains("?") }
            .map { String($0.text.prefix(100)) }
            .joined(separator: " | ")

        return [
            "Topics: \(topics.isEmpty ? "general discussion" : topics)",
            "Host intent: \(hostIntent.isEmpty ? "No host messages." : hostIntent)",
            "Model positions:\n\(positions.isEmpty ? "No model positions." : positions)",
            "Open questions: \(questions.isEmpty ? "None captured." : questions)",
            "Carry-forward memory hints: preserve decisions, unresolved risks, and host preferences from this block."
        ].joined(separator: "\n")
    }

    private func topKeywords(_ text: String) -> [String] {
        let stop: Set<String> = ["the", "and", "for", "with", "that", "this", "room", "model", "should", "would"]
        let words = text
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { $0.count > 3 && !stop.contains($0) }
        let counts = Dictionary(grouping: words, by: { $0 }).mapValues(\.count)
        return counts.sorted { $0.value > $1.value }.prefix(6).map(\.key)
    }

    private func classify(_ model: ModelConfig) -> String {
        let haystack = "\(model.name) \(model.persona)".lowercased()
        if haystack.contains("engineer") || haystack.contains("architecture") { return "engineer" }
        if haystack.contains("critic") || haystack.contains("risk") || haystack.contains("adversarial") { return "critic" }
        if haystack.contains("design") || haystack.contains("ux") { return "designer" }
        if haystack.contains("product") || haystack.contains("strategy") || haystack.contains("user") { return "strategist" }
        return "generalist"
    }

    private func opener(_ role: String) -> String {
        switch role {
        case "engineer": return "From an implementation angle, I hear"
        case "critic": return "The weak point to test is"
        case "designer": return "From the room experience angle, I hear"
        case "strategist": return "From a product angle, I hear"
        default: return "My read is"
        }
    }

    private func priority(_ role: String) -> String {
        switch role {
        case "engineer": return "a clean room state and provider adapter contract"
        case "critic": return "proof that multiple model voices improve decisions"
        case "designer": return "clear turn-taking and visible model identity"
        case "strategist": return "the host workflow: ask, compare, save memory, decide"
        default: return "one workflow that proves the room creates better answers"
        }
    }

    private func risk(_ role: String) -> String {
        switch role {
        case "engineer": return "state divergence between transcript, memory, and provider calls"
        case "critic": return "many models creating noise without judgment"
        case "designer": return "configuration overwhelming the host before trust is earned"
        case "strategist": return "shipping provider setup before the discussion loop feels valuable"
        default: return "unclear ownership of what should become memory"
        }
    }

    private func nextMove(_ role: String) -> String {
        switch role {
        case "engineer": return "reuse the same room engine rules across platforms"
        case "critic": return "force each model to state a decision, a risk, and evidence"
        case "designer": return "make speaking order and saved memory visible"
        case "strategist": return "ship offline simulation first to validate the host workflow"
        default: return "turn the host prompt into a decision-oriented discussion"
        }
    }

    private func reaction(_ role: String) -> String {
        switch role {
        case "engineer": return "the data contract needs to be explicit"
        case "critic": return "the room must prove the extra voices add judgment"
        case "designer": return "this should become a visible host control"
        case "strategist": return "this should map to a first-session success metric"
        default: return "this needs one concrete next step"
        }
    }
}

