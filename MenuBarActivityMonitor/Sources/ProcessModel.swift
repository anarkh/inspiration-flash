import Foundation
import AppKit

public struct ProcessItem: Identifiable, Hashable {
    public var id: Int32 { pid }
    public let pid: pid_t
    public let name: String
    public let executablePath: String
    public let icon: NSImage?
    public let cpuPercent: Double
    public let memoryBytes: UInt64
    public let threads: Int32
    public let subprocessCount: Int
    public let isGroup: Bool
    public let groupPids: [pid_t]

    public init(
        pid: pid_t,
        name: String,
        executablePath: String,
        icon: NSImage?,
        cpuPercent: Double,
        memoryBytes: UInt64,
        threads: Int32,
        subprocessCount: Int = 1,
        isGroup: Bool = false,
        groupPids: [pid_t] = []
    ) {
        self.pid = pid
        self.name = name
        self.executablePath = executablePath
        self.icon = icon
        self.cpuPercent = cpuPercent
        self.memoryBytes = memoryBytes
        self.threads = threads
        self.subprocessCount = subprocessCount
        self.isGroup = isGroup
        self.groupPids = groupPids.isEmpty ? [pid] : groupPids
    }

    public var formattedMemory: String {
        let bytes = Double(memoryBytes)
        let kb = bytes / 1024.0
        let mb = kb / 1024.0
        let gb = mb / 1024.0

        if gb >= 1.0 {
            return String(format: "%.2f GB", gb)
        } else if mb >= 1.0 {
            return String(format: "%.1f MB", mb)
        } else if kb >= 1.0 {
            return String(format: "%.0f KB", kb)
        } else {
            return "\(memoryBytes) B"
        }
    }

    public var formattedCPU: String {
        return String(format: "%.1f%%", cpuPercent)
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(pid)
        hasher.combine(isGroup)
    }

    public static func == (lhs: ProcessItem, rhs: ProcessItem) -> Bool {
        return lhs.pid == rhs.pid && lhs.isGroup == rhs.isGroup
    }
}

public struct SystemStats {
    public var totalCpuPercent: Double = 0.0
    public var userCpuPercent: Double = 0.0
    public var systemCpuPercent: Double = 0.0

    public var usedMemoryBytes: UInt64 = 0
    public var totalMemoryBytes: UInt64 = 0

    public var totalProcesses: Int = 0

    // Network Speeds in Bytes/sec
    public var downloadSpeed: Double = 0.0
    public var uploadSpeed: Double = 0.0

    // Rolling history for sparkline charts (max 25 points)
    public var cpuHistory: [Double] = []
    public var memHistory: [Double] = []

    public var memoryUsagePercent: Double {
        guard totalMemoryBytes > 0 else { return 0.0 }
        return (Double(usedMemoryBytes) / Double(totalMemoryBytes)) * 100.0
    }

    public var formattedUsedMemory: String {
        let gb = Double(usedMemoryBytes) / 1024.0 / 1024.0 / 1024.0
        return String(format: "%.1f GB", gb)
    }

    public var formattedTotalMemory: String {
        let gb = Double(totalMemoryBytes) / 1024.0 / 1024.0 / 1024.0
        return String(format: "%.0f GB", gb)
    }

    public var formattedDownloadSpeed: String {
        return formatSpeed(downloadSpeed, symbol: "↓")
    }

    public var formattedUploadSpeed: String {
        return formatSpeed(uploadSpeed, symbol: "↑")
    }

    private func formatSpeed(_ bytesPerSec: Double, symbol: String) -> String {
        let kb = bytesPerSec / 1024.0
        let mb = kb / 1024.0
        if mb >= 1.0 {
            return String(format: "%@ %.1f MB/s", symbol, mb)
        } else {
            return String(format: "%@ %.0f KB/s", symbol, max(0, kb))
        }
    }
}

public enum ProcessSortKey: String, CaseIterable, Identifiable {
    case cpu = "CPU"
    case memory = "内存"
    case name = "名称"
    case pid = "PID"

    public var id: String { rawValue }
}

public enum MenuBarDisplayMode: String, CaseIterable, Identifiable {
    case cpuOnly = "仅 CPU"
    case cpuAndMem = "CPU + 内存"
    case cpuAndNet = "CPU + 网速"
    case iconOnly = "仅图标"

    public var id: String { rawValue }
}
