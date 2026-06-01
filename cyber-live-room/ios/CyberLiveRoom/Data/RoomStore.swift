import Foundation

final class RoomStore {
    private let key = "cyber-live-room.snapshot.v1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> RoomSnapshot {
        guard let data = defaults.data(forKey: key) else {
            return .empty
        }
        do {
            return try JSONDecoder().decode(RoomSnapshot.self, from: data)
        } catch {
            return .empty
        }
    }

    func save(_ snapshot: RoomSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else {
            return
        }
        defaults.set(data, forKey: key)
    }
}

