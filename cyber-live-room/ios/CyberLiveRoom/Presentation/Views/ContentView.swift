import SwiftUI

struct ContentView: View {
    @StateObject private var room = RoomViewModel()

    var body: some View {
        TabView {
            RoomScreen(room: room)
                .tabItem { Label("Room", systemImage: "dot.radiowaves.left.and.right") }
            ConfigScreen(room: room)
                .tabItem { Label("Config", systemImage: "slider.horizontal.3") }
            MemoryScreen(room: room)
                .tabItem { Label("Memory", systemImage: "brain.head.profile") }
        }
    }
}

struct RoomScreen: View {
    @ObservedObject var room: RoomViewModel
    @State private var hostText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    StatusStrip(room: room)
                    AudienceStrip(models: room.enabledModels)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Host broadcast").font(.headline)
                        TextEditor(text: $hostText)
                            .frame(minHeight: 116)
                            .padding(8)
                            .background(.thinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        HStack {
                            Button("Go Live") {
                                room.send(hostText)
                                hostText = ""
                            }
                            .buttonStyle(.borderedProminent)
                            Button("Seed Demo") {
                                hostText = "Debate the MVP scope for Cyber Live Room: configurable models, memory, and context compression."
                            }
                            Button("Compact") {
                                room.compact(force: true)
                            }
                        }
                    }
                    Divider()
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Live Transcript").font(.headline)
                            Spacer()
                            Button("Clear", role: .destructive) {
                                room.clearTranscript()
                            }
                        }
                        if room.messages.isEmpty {
                            Text("The room is quiet. Send a host broadcast to start.")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(room.messages) { message in
                                MessageCard(message: message)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Cyber Live Room")
        }
    }
}

struct ConfigScreen: View {
    @ObservedObject var room: RoomViewModel
    @State private var name = ""
    @State private var provider = "Custom"
    @State private var modelId = "simulation-model"
    @State private var endpoint = ""
    @State private var persona = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Add Model").font(.title2.bold())
                    TextField("Display name", text: $name)
                        .textFieldStyle(.roundedBorder)
                    TextField("Provider", text: $provider)
                        .textFieldStyle(.roundedBorder)
                    TextField("Provider model id", text: $modelId)
                        .textFieldStyle(.roundedBorder)
                    TextField("Endpoint", text: $endpoint)
                        .textFieldStyle(.roundedBorder)
                    TextField("Persona", text: $persona, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...5)
                    Button("Save Model") {
                        room.addModel(
                            name: name,
                            provider: provider,
                            modelId: modelId,
                            endpoint: endpoint,
                            persona: persona
                        )
                        name = ""
                        provider = "Custom"
                        modelId = "simulation-model"
                        endpoint = ""
                        persona = ""
                    }
                    .buttonStyle(.borderedProminent)

                    Divider()
                    Text("Configured Models").font(.title2.bold())
                    ForEach(room.models) { model in
                        ModelConfigCard(
                            model: model,
                            onToggle: { room.toggleModel(model) },
                            onDelete: { room.deleteModel(model) }
                        )
                    }
                }
                .padding()
            }
            .navigationTitle("Config")
        }
    }
}

struct MemoryScreen: View {
    @ObservedObject var room: RoomViewModel
    @State private var memoryText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Room Memory").font(.title2.bold())
                    Text("Active context: \(room.activeTokens) tokens / budget: \(room.tokenBudget)")
                        .foregroundStyle(.secondary)
                    Slider(
                        value: Binding(
                            get: { Double(room.tokenBudget) },
                            set: {
                                room.tokenBudget = Int($0)
                                room.save()
                            }
                        ),
                        in: 300...2200,
                        step: 100
                    )
                    TextField("Pinned memory", text: $memoryText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...5)
                    HStack {
                        Button("Add Memory") {
                            room.addMemory(memoryText)
                            memoryText = ""
                        }
                        .buttonStyle(.borderedProminent)
                        Button("Compact Now") {
                            room.compact(force: true)
                        }
                    }
                    ForEach(room.memories) { memory in
                        MemoryCard(memory: memory, onForget: { room.forgetMemory(memory) })
                    }

                    Divider()
                    HStack {
                        Text("Compressed Context").font(.title2.bold())
                        Spacer()
                        Button("Clear", role: .destructive) {
                            room.clearSummaries()
                        }
                    }
                    if room.summaries.isEmpty {
                        Text("No compressed summaries yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(room.summaries.reversed()) { summary in
                            SummaryCard(summary: summary)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Memory")
        }
    }
}

struct StatusStrip: View {
    @ObservedObject var room: RoomViewModel

    var body: some View {
        HStack {
            Label("\(room.enabledModels.count) enabled", systemImage: "person.3")
            Spacer()
            Label("\(room.memories.count) memories", systemImage: "tray.full")
            Spacer()
            Label("\(room.summaries.count) summaries", systemImage: "rectangle.compress.vertical")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}

struct AudienceStrip: View {
    var models: [ModelConfig]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(models) { model in
                    HStack {
                        AvatarView(name: model.name, colorHex: model.colorHex)
                        VStack(alignment: .leading) {
                            Text(model.name).font(.headline)
                            Text(model.provider).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(10)
                    .background(.thinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(hex: model.colorHex), lineWidth: 1)
                    )
                }
            }
        }
    }
}

struct MessageCard: View {
    var message: ChatMessage

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(message.author).font(.headline)
                Spacer()
                Text("\(message.provider ?? message.kind.rawValue) / \(message.createdAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(message.text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(hex: message.colorHex), lineWidth: 1)
        )
    }
}

struct ModelConfigCard: View {
    var model: ModelConfig
    var onToggle: () -> Void
    var onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading) {
                    Text(model.name).font(.headline)
                    Text("\(model.provider) / \(model.modelId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                AvatarView(name: model.name, colorHex: model.colorHex)
            }
            Text(model.persona).foregroundStyle(.secondary)
            Text("Endpoint: \(model.endpoint.isEmpty ? "simulation adapter" : model.endpoint)")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button(model.enabled ? "Disable" : "Enable", action: onToggle)
                Button("Delete", role: .destructive, action: onDelete)
            }
        }
        .padding()
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct MemoryCard: View {
    var memory: MemoryRecord
    var onForget: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(memory.text)
            Text("\(memory.source) / \(memory.createdAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Forget", role: .destructive, action: onForget)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct SummaryCard: View {
    var summary: ContextSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(summary.text)
                .font(.callout)
                .textSelection(.enabled)
            Text("\(summary.messageCount) messages / \(summary.createdAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct AvatarView: View {
    var name: String
    var colorHex: String

    var body: some View {
        Text(initials(name))
            .font(.caption.bold())
            .foregroundStyle(Color(hex: colorHex))
            .frame(width: 36, height: 36)
            .background(Color.black.opacity(0.28))
            .clipShape(Circle())
            .overlay(Circle().stroke(Color(hex: colorHex), lineWidth: 2))
    }
}
