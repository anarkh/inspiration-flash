import AppKit
import Darwin
import Testing
@testable import MenuBarActivityMonitor

@Suite("Process collection")
struct ProcessCollectionTests {
    @Test("proc_listallpids return value is a PID count")
    func pidCountIsNotDividedByPIDSize() {
        let capacity = 8_192
        var pids = [pid_t](repeating: 0, count: capacity)
        let reportedCount = pids.withUnsafeMutableBytes { buffer in
            proc_listallpids(buffer.baseAddress, Int32(buffer.count))
        }
        let count = normalizedPIDCount(reportedCount: reportedCount, capacity: capacity)

        #expect(reportedCount > 0)
        #expect(count == min(Int(reportedCount), capacity))
        #expect(pids.prefix(count).contains(getpid()))
    }

    @Test("Dynamic PID enumeration includes the current process")
    func dynamicPIDEnumerationIncludesCurrentProcess() {
        let pids = ProcessMonitor.listAllPIDs()

        #expect(!pids.isEmpty)
        #expect(pids.contains(getpid()))
        #expect(pids.allSatisfy { $0 > 0 })
    }

    @Test("PID count normalization rejects invalid values and clamps overflow")
    func pidCountNormalizationBounds() {
        #expect(normalizedPIDCount(reportedCount: -1, capacity: 100) == 0)
        #expect(normalizedPIDCount(reportedCount: 0, capacity: 100) == 0)
        #expect(normalizedPIDCount(reportedCount: 75, capacity: 100) == 75)
        #expect(normalizedPIDCount(reportedCount: 120, capacity: 100) == 100)
        #expect(normalizedPIDCount(reportedCount: 10, capacity: 0) == 0)
    }

    @Test("Group accumulator aggregates in place")
    func groupAccumulatorAggregatesMetricsAndIcon() {
        let icon = NSImage(size: NSSize(width: 1, height: 1))
        let accumulator = ProcessGroupAccumulator(
            groupKey: "app:/Applications/Example.app",
            appName: "Example",
            executablePath: "/Applications/Example.app/Contents/MacOS/Example",
            icon: nil
        )

        accumulator.add(pid: 101, icon: nil, cpuPercent: 1.5, memoryBytes: 1_024, threads: 2)
        accumulator.add(pid: 102, icon: icon, cpuPercent: 2.5, memoryBytes: 2_048, threads: 3)
        let item = accumulator.makeProcessItem()

        #expect(item.pid == 101)
        #expect(item.groupPids == [101, 102])
        #expect(item.cpuPercent == 4.0)
        #expect(item.memoryBytes == 3_072)
        #expect(item.threads == 5)
        #expect(item.subprocessCount == 2)
        #expect(item.isGroup)
        #expect(item.icon === icon)
    }

    @Test("Group identity does not depend on its current primary PID")
    func groupIdentityIsStableAcrossPrimaryPIDChanges() {
        let first = ProcessGroupAccumulator(
            groupKey: "app:/Applications/Example.app",
            appName: "Example",
            executablePath: "/Applications/Example.app/Contents/MacOS/Example",
            icon: nil
        )
        first.add(pid: 101, icon: nil, cpuPercent: 0, memoryBytes: 0, threads: 1)

        let second = ProcessGroupAccumulator(
            groupKey: "app:/Applications/Example.app",
            appName: "Example",
            executablePath: "/Applications/Example.app/Contents/MacOS/Example",
            icon: nil
        )
        second.add(pid: 202, icon: nil, cpuPercent: 0, memoryBytes: 0, threads: 1)

        #expect(first.makeProcessItem().id == second.makeProcessItem().id)
    }

    @Test("Default refresh interval is five seconds")
    func defaultRefreshIntervalIsFiveSeconds() {
        #expect(ProcessMonitor.defaultRefreshInterval == 5.0)
    }
}
