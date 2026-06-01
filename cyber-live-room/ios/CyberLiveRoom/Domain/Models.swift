import Foundation
import SwiftUI

struct ModelConfig: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var provider: String
    var modelId: String
    var endpoint: String
    var persona: String
    var temperature: Double
    var colorHex: String
    var enabled: Bool
}

struct ChatMessage: Identifiable, Codable, Equatable {
    var id: String
    var kind: MessageKind
    var author: String
    var provider: String?
    var text: String
    var colorHex: String
    var createdAt: Date
}

struct MemoryRecord: Identifiable, Codable, Equatable {
    var id: String
    var text: String
    var source: String
    var createdAt: Date
}

struct ContextSummary: Identifiable, Codable, Equatable {
    var id: String
    var text: String
    var messageCount: Int
    var createdAt: Date
}

struct DiscussionResult {
    var messages: [ChatMessage]
    var capturedMemory: MemoryRecord?
}

struct RoomSnapshot: Codable {
    var models: [ModelConfig]
    var messages: [ChatMessage]
    var memories: [MemoryRecord]
    var summaries: [ContextSummary]
    var tokenBudget: Int
}

enum MessageKind: String, Codable {
    case host
    case model
    case system
}

enum Ids {
    static func next(_ prefix: String) -> String {
        "\(prefix)-\(UUID().uuidString)"
    }
}

enum SeedData {
    static let defaultModels = [
        ModelConfig(
            id: "model-strategist",
            name: "Strategist",
            provider: "OpenAI",
            modelId: "gpt-discussion",
            endpoint: "",
            persona: "Product strategist focused on user value, positioning, and next steps.",
            temperature: 0.7,
            colorHex: "#39A0FF",
            enabled: true
        ),
        ModelConfig(
            id: "model-engineer",
            name: "Engineer",
            provider: "Anthropic",
            modelId: "claude-discussion",
            endpoint: "",
            persona: "Senior engineer focused on architecture, edge cases, and implementation risk.",
            temperature: 0.45,
            colorHex: "#FF7A45",
            enabled: true
        ),
        ModelConfig(
            id: "model-critic",
            name: "Critic",
            provider: "Google",
            modelId: "gemini-discussion",
            endpoint: "",
            persona: "Adversarial reviewer focused on gaps, weak assumptions, and missing evidence.",
            temperature: 0.6,
            colorHex: "#9B7CFF",
            enabled: true
        )
    ]

    static let defaultMemory = MemoryRecord(
        id: Ids.next("mem"),
        text: "The host prefers concrete tradeoffs, clear recommendations, and implementation-ready discussion.",
        source: "system-seed",
        createdAt: Date()
    )
}

extension RoomSnapshot {
    static let empty = RoomSnapshot(
        models: SeedData.defaultModels,
        messages: [],
        memories: [SeedData.defaultMemory],
        summaries: [],
        tokenBudget: 900
    )
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let red = Double((value >> 16) & 0xFF) / 255.0
        let green = Double((value >> 8) & 0xFF) / 255.0
        let blue = Double(value & 0xFF) / 255.0
        self.init(red: red, green: green, blue: blue)
    }
}

func initials(_ name: String) -> String {
    let parts = name.split(separator: " ").prefix(2)
    let value = parts.map { String($0.prefix(1)).uppercased() }.joined()
    return value.isEmpty ? "AI" : value
}

