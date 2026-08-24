import Darwin
import Testing
@testable import MenuBarActivityMonitor

@Suite("Process ordering")
struct ProcessOrderingTests {
    @Test("An item never precedes itself")
    func equalItemNeverPrecedesItself() {
        let item = makeItem(pid: 42, name: "Example", cpu: 0, memory: 128)

        #expect(!ProcessOrdering.precedes(item, item, by: .cpu, ascending: false))
        #expect(!ProcessOrdering.precedes(item, item, by: .memory, ascending: false))
        #expect(!ProcessOrdering.precedes(item, item, by: .name, ascending: false))
        #expect(!ProcessOrdering.precedes(item, item, by: .pid, ascending: false))
    }

    @Test("Equal resource values use PID as a stable tie-break")
    func descendingResourceSortUsesStablePIDTieBreak() {
        let lowerPID = makeItem(pid: 10, name: "Lower", cpu: 3, memory: 512)
        let higherPID = makeItem(pid: 20, name: "Higher", cpu: 3, memory: 512)

        #expect(ProcessOrdering.precedes(lowerPID, higherPID, by: .cpu, ascending: false))
        #expect(!ProcessOrdering.precedes(higherPID, lowerPID, by: .cpu, ascending: false))
        #expect(ProcessOrdering.precedes(lowerPID, higherPID, by: .memory, ascending: false))
        #expect(!ProcessOrdering.precedes(higherPID, lowerPID, by: .memory, ascending: false))
    }

    @Test("Sort direction is applied explicitly")
    func sortDirectionIsAppliedExplicitly() {
        let low = makeItem(pid: 10, name: "Alpha", cpu: 1, memory: 128)
        let high = makeItem(pid: 20, name: "Beta", cpu: 9, memory: 1024)

        #expect(ProcessOrdering.precedes(low, high, by: .cpu, ascending: true))
        #expect(ProcessOrdering.precedes(high, low, by: .cpu, ascending: false))
        #expect(ProcessOrdering.precedes(low, high, by: .name, ascending: true))
        #expect(ProcessOrdering.precedes(high, low, by: .name, ascending: false))
    }

    private func makeItem(
        pid: pid_t,
        name: String,
        cpu: Double,
        memory: UInt64
    ) -> ProcessItem {
        ProcessItem(
            pid: pid,
            name: name,
            executablePath: "/tmp/\(name)",
            icon: nil,
            cpuPercent: cpu,
            memoryBytes: memory,
            threads: 1
        )
    }
}
