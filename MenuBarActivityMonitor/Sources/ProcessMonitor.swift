import Foundation
import AppKit
import Darwin
import MachO
import Combine
import ServiceManagement

public final class ProcessMonitor: ObservableObject {
    @Published public var processes: [ProcessItem] = []
    @Published public var groupedProcesses: [ProcessItem] = []
    @Published public var systemStats: SystemStats = SystemStats()
    @Published public var isUpdating: Bool = false
    @Published public var isGroupedByApp: Bool = true

    @Published public var menuBarDisplayMode: MenuBarDisplayMode = .cpuOnly {
        didSet {
            UserDefaults.standard.set(menuBarDisplayMode.rawValue, forKey: "menuBarDisplayMode")
        }
    }

    @Published public var isLaunchAtLogin: Bool = false

    @Published public var isPopoverVisible: Bool = false {
        didSet {
            resetTimer()
            if isPopoverVisible {
                refresh()
            }
        }
    }

    @Published public var refreshInterval: Double = 1.5 {
        didSet {
            UserDefaults.standard.set(refreshInterval, forKey: "refreshInterval")
            resetTimer()
            if refreshInterval > 0 && isPopoverVisible {
                refresh()
            }
        }
    }

    public var refreshIntervalText: String {
        if refreshInterval == 0 {
            return "暂停"
        } else if refreshInterval == 1.0 {
            return "1.0s"
        } else if refreshInterval == 1.5 {
            return "1.5s"
        } else if refreshInterval == 3.0 {
            return "3.0s"
        } else if refreshInterval == 5.0 {
            return "5.0s"
        } else {
            return String(format: "%.1fs", refreshInterval)
        }
    }

    private var timer: AnyCancellable?
    private var sleepObservers: [NSObjectProtocol] = []
    private var isSleeping: Bool = false

    private let queue = DispatchQueue(label: "com.activitymonitor.collector", qos: .utility)

    // CPU delta tracking
    private var prevProcessTimes: [pid_t: UInt64] = [:]
    private var prevMachTime: UInt64 = 0
    private var prevHostCpu: (user: UInt32, sys: UInt32, idle: UInt32, nice: UInt32)?

    // Network delta tracking
    private var prevNetIn: UInt64 = 0
    private var prevNetOut: UInt64 = 0
    private var prevNetTime: Date = Date()

    // History tracking for sparklines (up to 25 samples)
    private var cpuHistoryBuffer: [Double] = []
    private var memHistoryBuffer: [Double] = []

    // Static metadata cache per PID (name, path, appName, icon)
    private struct ProcessMetadata {
        let name: String
        let appName: String
        let execPath: String
        let icon: NSImage?
    }
    private var metaCache: [pid_t: ProcessMetadata] = [:]
    private let defaultIcon: NSImage

    public init() {
        self.defaultIcon = NSWorkspace.shared.icon(for: .application)

        // Restore saved settings
        if let savedMode = UserDefaults.standard.string(forKey: "menuBarDisplayMode"),
           let mode = MenuBarDisplayMode(rawValue: savedMode) {
            self.menuBarDisplayMode = mode
        }
        if let savedInterval = UserDefaults.standard.object(forKey: "refreshInterval") as? Double {
            self.refreshInterval = savedInterval
        }

        checkLaunchAtLoginStatus()
        setupSleepWakeListeners()
        start()
    }

    deinit {
        sleepObservers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    public func start() {
        resetTimer()
        // Baseline warmup
        queue.async { [weak self] in
            guard let self = self else { return }
            _ = self.collectData()
            Thread.sleep(forTimeInterval: 0.2)
            self.refresh()
        }
    }

    public func stop() {
        timer?.cancel()
        timer = nil
    }

    private func setupSleepWakeListeners() {
        let center = NSWorkspace.shared.notificationCenter

        sleepObservers.append(
            center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
                self?.handleSystemSleep()
            }
        )
        sleepObservers.append(
            center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
                self?.handleSystemWake()
            }
        )
        sleepObservers.append(
            center.addObserver(forName: NSWorkspace.screensDidSleepNotification, object: nil, queue: .main) { [weak self] _ in
                self?.handleSystemSleep()
            }
        )
        sleepObservers.append(
            center.addObserver(forName: NSWorkspace.screensDidWakeNotification, object: nil, queue: .main) { [weak self] _ in
                self?.handleSystemWake()
            }
        )
    }

    private func handleSystemSleep() {
        isSleeping = true
        stop()
    }

    private func handleSystemWake() {
        isSleeping = false
        start()
    }

    private func resetTimer() {
        timer?.cancel()
        guard !isSleeping, refreshInterval > 0 else { return }

        // When closed, update at 2.5s interval to minimize CPU; when open, use refreshInterval
        let interval = isPopoverVisible ? refreshInterval : max(2.5, refreshInterval)
        timer = Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.refresh()
            }
    }

    public func refresh() {
        guard !isUpdating, !isSleeping else { return }
        isUpdating = true

        queue.async { [weak self] in
            guard let self = self else { return }
            let (newProcesses, newGrouped, newSystemStats) = self.collectData()

            DispatchQueue.main.async {
                if self.isPopoverVisible || self.processes.isEmpty {
                    self.processes = newProcesses
                    self.groupedProcesses = newGrouped
                }
                self.systemStats = newSystemStats
                self.isUpdating = false
            }
        }
    }

    private func collectData() -> ([ProcessItem], [ProcessItem], SystemStats) {
        let nowMach = mach_absolute_time()
        var newSystemStats = collectHostSystemStats()
        collectNetworkStats(into: &newSystemStats)

        // Update history buffers
        cpuHistoryBuffer.append(newSystemStats.totalCpuPercent)
        if cpuHistoryBuffer.count > 25 { cpuHistoryBuffer.removeFirst() }

        memHistoryBuffer.append(newSystemStats.memoryUsagePercent)
        if memHistoryBuffer.count > 25 { memHistoryBuffer.removeFirst() }

        newSystemStats.cpuHistory = cpuHistoryBuffer
        newSystemStats.memHistory = memHistoryBuffer

        // If popover is closed and baseline exists, skip process scanning for near-zero idle CPU
        if !isPopoverVisible && prevMachTime > 0 && !processes.isEmpty {
            return (self.processes, self.groupedProcesses, newSystemStats)
        }

        // Collect all running PIDs
        var pids = [pid_t](repeating: 0, count: 4096)
        let bytes = proc_listallpids(&pids, Int32(MemoryLayout<pid_t>.size * pids.count))
        let count = max(0, Int(bytes) / MemoryLayout<pid_t>.size)

        newSystemStats.totalProcesses = count

        var rawItems: [ProcessItem] = []
        var currentTimes: [pid_t: UInt64] = [:]
        var activePids = Set<pid_t>()
        activePids.reserveCapacity(count)

        let dMach = Double(prevMachTime > 0 && nowMach > prevMachTime ? (nowMach - prevMachTime) : 0)

        // App Grouping helper
        var groupsMap: [String: (appName: String, icon: NSImage?, cpu: Double, mem: UInt64, threads: Int32, pids: [pid_t], path: String)] = [:]

        for i in 0..<count {
            let pid = pids[i]
            guard pid > 0 else { continue }
            activePids.insert(pid)

            var procInfo = proc_taskinfo()
            let infoSize = Int32(MemoryLayout<proc_taskinfo>.size)
            let res = proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &procInfo, infoSize)
            guard res == infoSize else { continue }

            let metadata: ProcessMetadata
            if let cached = metaCache[pid] {
                metadata = cached
            } else {
                metadata = fetchProcessMetadata(pid: pid)
                metaCache[pid] = metadata
            }

            let totalCpuTime = procInfo.pti_total_user + procInfo.pti_total_system
            currentTimes[pid] = totalCpuTime

            var cpuPercent: Double = 0.0
            if let prevTime = prevProcessTimes[pid], dMach > 0 {
                let dTicks = Double(totalCpuTime >= prevTime ? (totalCpuTime - prevTime) : 0)
                cpuPercent = (dTicks / dMach) * 100.0
            }

            let memBytes = UInt64(procInfo.pti_resident_size)

            let item = ProcessItem(
                pid: pid,
                name: metadata.name,
                executablePath: metadata.execPath,
                icon: metadata.icon,
                cpuPercent: max(0.0, cpuPercent),
                memoryBytes: memBytes,
                threads: procInfo.pti_threadnum,
                subprocessCount: 1,
                isGroup: false,
                groupPids: [pid]
            )
            rawItems.append(item)

            // Aggregate into groups
            let groupKey = metadata.appName
            if var existing = groupsMap[groupKey] {
                existing.cpu += max(0.0, cpuPercent)
                existing.mem += memBytes
                existing.threads += procInfo.pti_threadnum
                existing.pids.append(pid)
                if existing.icon == nil && metadata.icon != nil {
                    existing.icon = metadata.icon
                }
                groupsMap[groupKey] = existing
            } else {
                groupsMap[groupKey] = (
                    appName: metadata.appName,
                    icon: metadata.icon,
                    cpu: max(0.0, cpuPercent),
                    mem: memBytes,
                    threads: procInfo.pti_threadnum,
                    pids: [pid],
                    path: metadata.execPath
                )
            }
        }

        // Build grouped items list
        var groupedItems: [ProcessItem] = []
        for (_, val) in groupsMap {
            let primaryPid = val.pids.first ?? 0
            let isGroup = val.pids.count > 1
            let item = ProcessItem(
                pid: primaryPid,
                name: val.appName,
                executablePath: val.path,
                icon: val.icon,
                cpuPercent: val.cpu,
                memoryBytes: val.mem,
                threads: val.threads,
                subprocessCount: val.pids.count,
                isGroup: isGroup,
                groupPids: val.pids
            )
            groupedItems.append(item)
        }

        // Clean dead PIDs from cache periodically
        if metaCache.count > activePids.count + 50 {
            metaCache = metaCache.filter { activePids.contains($0.key) }
        }

        prevProcessTimes = currentTimes
        prevMachTime = nowMach

        return (rawItems, groupedItems, newSystemStats)
    }

    private func fetchProcessMetadata(pid: pid_t) -> ProcessMetadata {
        var nameBuffer = [CChar](repeating: 0, count: 256)
        proc_name(pid, &nameBuffer, 256)
        var name = String(cString: nameBuffer).trimmingCharacters(in: .whitespacesAndNewlines)

        var pathBuffer = [CChar](repeating: 0, count: 1024)
        proc_pidpath(pid, &pathBuffer, 1024)
        let execPath = String(cString: pathBuffer).trimmingCharacters(in: .whitespacesAndNewlines)

        if name.isEmpty && !execPath.isEmpty {
            name = (execPath as NSString).lastPathComponent
        }
        if name.isEmpty {
            name = "PID \(pid)"
        }

        let (appName, icon) = resolveAppInfo(for: execPath, fallbackName: name)
        return ProcessMetadata(name: name, appName: appName, execPath: execPath, icon: icon)
    }

    private func resolveAppInfo(for execPath: String, fallbackName: String) -> (appName: String, icon: NSImage?) {
        guard !execPath.isEmpty else {
            return (cleanProcessName(fallbackName), defaultIcon)
        }

        var currentPath = execPath
        while currentPath != "/" && !currentPath.isEmpty {
            if currentPath.hasSuffix(".app") {
                let bundleUrl = URL(fileURLWithPath: currentPath)
                let bundleName = bundleUrl.deletingPathExtension().lastPathComponent
                let icon = NSWorkspace.shared.icon(forFile: currentPath)
                return (bundleName, icon)
            }
            currentPath = (currentPath as NSString).deletingLastPathComponent
        }

        let cleaned = cleanProcessName(fallbackName)
        let icon = FileManager.default.fileExists(atPath: execPath) ? NSWorkspace.shared.icon(forFile: execPath) : defaultIcon
        return (cleaned, icon)
    }

    private func cleanProcessName(_ raw: String) -> String {
        var name = raw
        // Simplify common helper patterns: "Google Chrome Helper (Renderer)" -> "Google Chrome"
        if let regex = try? NSRegularExpression(pattern: "\\s+Helper.*$", options: .caseInsensitive) {
            name = regex.stringByReplacingMatches(in: name, options: [], range: NSRange(location: 0, length: name.utf16.count), withTemplate: "")
        }
        return name.isEmpty ? raw : name
    }

    private func collectHostSystemStats() -> SystemStats {
        var stats = SystemStats()

        // 1. Host CPU (Mach kernel statistics)
        var cpuLoad = host_cpu_load_info()
        var count = mach_msg_type_number_t(MemoryLayout<host_cpu_load_info>.size / MemoryLayout<integer_t>.size)
        let kerr = withUnsafeMutablePointer(to: &cpuLoad) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, $0, &count)
            }
        }

        if kerr == KERN_SUCCESS {
            let u = cpuLoad.cpu_ticks.0
            let s = cpuLoad.cpu_ticks.1
            let i = cpuLoad.cpu_ticks.2
            let n = cpuLoad.cpu_ticks.3

            if let prev = prevHostCpu {
                let dUser = Double(u >= prev.user ? u - prev.user : 0)
                let dSys = Double(s >= prev.sys ? s - prev.sys : 0)
                let dIdle = Double(i >= prev.idle ? i - prev.idle : 0)
                let dNice = Double(n >= prev.nice ? n - prev.nice : 0)

                let totalTicks = dUser + dSys + dIdle + dNice
                if totalTicks > 0 {
                    stats.userCpuPercent = (dUser / totalTicks) * 100.0
                    stats.systemCpuPercent = (dSys / totalTicks) * 100.0
                    stats.totalCpuPercent = ((dUser + dSys + dNice) / totalTicks) * 100.0
                }
            }
            prevHostCpu = (u, s, i, n)
        }

        // 2. Host VM / Memory
        var vmStat = vm_statistics64()
        var vmCount = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)
        let vmErr = withUnsafeMutablePointer(to: &vmStat) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(vmCount)) {
                host_statistics64(mach_host_self(), HOST_VM_INFO64, $0, &vmCount)
            }
        }

        if vmErr == KERN_SUCCESS {
            let pageSize = UInt64(vm_kernel_page_size)
            let total = ProcessInfo.processInfo.physicalMemory
            let active = UInt64(vmStat.active_count) * pageSize
            let wired = UInt64(vmStat.wire_count) * pageSize
            let compressor = UInt64(vmStat.compressor_page_count) * pageSize
            let used = active + wired + compressor

            stats.totalMemoryBytes = total
            stats.usedMemoryBytes = min(total, used)
        }

        return stats
    }

    private func collectNetworkStats(into stats: inout SystemStats) {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return }
        defer { freeifaddrs(ifaddr) }

        var currentIn: UInt64 = 0
        var currentOut: UInt64 = 0

        var ptr = first
        while true {
            let flags = Int32(ptr.pointee.ifa_flags)
            let family = ptr.pointee.ifa_addr.pointee.sa_family

            if (flags & IFF_UP) != 0 && (flags & IFF_RUNNING) != 0 && (flags & IFF_LOOPBACK) == 0 && family == UInt8(AF_LINK) {
                if let data = ptr.pointee.ifa_data?.assumingMemoryBound(to: if_data.self) {
                    currentIn += UInt64(data.pointee.ifi_ibytes)
                    currentOut += UInt64(data.pointee.ifi_obytes)
                }
            }
            guard let next = ptr.pointee.ifa_next else { break }
            ptr = next
        }

        let now = Date()
        let dt = now.timeIntervalSince(prevNetTime)
        if dt > 0.3 && prevNetIn > 0 {
            let dIn = Double(currentIn >= prevNetIn ? currentIn - prevNetIn : 0)
            let dOut = Double(currentOut >= prevNetOut ? currentOut - prevNetOut : 0)
            stats.downloadSpeed = dIn / dt
            stats.uploadSpeed = dOut / dt
        }

        prevNetIn = currentIn
        prevNetOut = currentOut
        prevNetTime = now
    }

    // Kill single or group of processes
    public func killProcess(item: ProcessItem, force: Bool = false) {
        let sig = force ? SIGKILL : SIGTERM
        for p in item.groupPids {
            kill(p, sig)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.refresh()
        }
    }

    // Launch at Login support (macOS 13+)
    public func checkLaunchAtLoginStatus() {
        if #available(macOS 13.0, *) {
            self.isLaunchAtLogin = SMAppService.mainApp.status == .enabled
        }
    }

    public func toggleLaunchAtLogin() {
        if #available(macOS 13.0, *) {
            do {
                if SMAppService.mainApp.status == .enabled {
                    try SMAppService.mainApp.unregister()
                    self.isLaunchAtLogin = false
                } else {
                    try SMAppService.mainApp.register()
                    self.isLaunchAtLogin = true
                }
            } catch {
                print("Launch at login error: \(error)")
            }
        }
    }

    // Open macOS Activity Monitor
    public func openActivityMonitor() {
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.ActivityMonitor") {
            NSWorkspace.shared.openApplication(at: url, configuration: .init(), completionHandler: nil)
        } else {
            NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Utilities/Activity Monitor.app"))
        }
    }
}
