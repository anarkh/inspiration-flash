import Foundation
import AppKit
import Darwin
import MachO
import Combine
import ServiceManagement

@inline(__always)
func normalizedPIDCount(reportedCount: Int32, capacity: Int) -> Int {
    guard reportedCount > 0, capacity > 0 else { return 0 }
    return min(Int(reportedCount), capacity)
}

final class ProcessGroupAccumulator {
    let groupKey: String
    let appName: String
    let executablePath: String
    private(set) var icon: NSImage?
    private(set) var cpuPercent: Double = 0
    private(set) var memoryBytes: UInt64 = 0
    private(set) var threads: Int32 = 0
    private(set) var pids: [pid_t] = []

    init(groupKey: String, appName: String, executablePath: String, icon: NSImage?) {
        self.groupKey = groupKey
        self.appName = appName
        self.executablePath = executablePath
        self.icon = icon
        pids.reserveCapacity(4)
    }

    func add(pid: pid_t, icon: NSImage?, cpuPercent: Double, memoryBytes: UInt64, threads: Int32) {
        self.cpuPercent += max(0, cpuPercent)
        self.memoryBytes += memoryBytes
        self.threads += threads
        pids.append(pid)
        if self.icon == nil, let icon {
            self.icon = icon
        }
    }

    func makeProcessItem() -> ProcessItem {
        ProcessItem(
            pid: pids.first ?? 0,
            name: appName,
            executablePath: executablePath,
            icon: icon,
            cpuPercent: cpuPercent,
            memoryBytes: memoryBytes,
            threads: threads,
            subprocessCount: pids.count,
            isGroup: pids.count > 1,
            groupPids: pids,
            stableID: "group:\(groupKey)"
        )
    }
}

public final class ProcessMonitor: ObservableObject {
    static let defaultRefreshInterval = 5.0

    @Published public var processes: [ProcessItem] = []
    @Published public var groupedProcesses: [ProcessItem] = []
    @Published public var systemStats: SystemStats = SystemStats()
    public private(set) var isUpdating: Bool = false
    @Published public var isGroupedByApp: Bool = true

    @Published public var menuBarDisplayMode: MenuBarDisplayMode = .cpuOnly {
        didSet {
            UserDefaults.standard.set(menuBarDisplayMode.rawValue, forKey: "menuBarDisplayMode")
        }
    }

    @Published public var isLaunchAtLogin: Bool = false

    public var isPopoverVisible: Bool = false {
        didSet {
            guard isPopoverVisible != oldValue else { return }
            resetTimer()
            if isPopoverVisible {
                refresh()
            }
        }
    }

    @Published public var refreshInterval: Double = ProcessMonitor.defaultRefreshInterval {
        didSet {
            guard refreshInterval != oldValue else { return }
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
    private var isStarted: Bool = false
    private var lifecycleGeneration: UInt = 0

    private let queue = DispatchQueue(label: "com.activitymonitor.collector", qos: .utility)

    // CPU delta tracking
    private var prevProcessTimes: [pid_t: UInt64] = [:]
    private var prevMachTime: UInt64 = 0
    private var prevHostCpu: (user: UInt32, sys: UInt32, idle: UInt32, nice: UInt32)?
    private var lastTotalProcessCount: Int = 0

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
        let appBundlePath: String?
        let icon: NSImage?
    }

    private struct ExecutableMetadata {
        let appBundlePath: String?
        let standaloneIcon: NSImage?
    }

    private struct AppBundleMetadata {
        let appName: String
        let icon: NSImage
    }

    private var metaCache: [pid_t: ProcessMetadata] = [:]
    private var executableMetadataCache: [String: ExecutableMetadata] = [:]
    private var appBundleMetadataCache: [String: AppBundleMetadata] = [:]
    private let defaultIcon: NSImage

    private static let helperNameRegex = try! NSRegularExpression(
        pattern: "\\s+Helper.*$",
        options: .caseInsensitive
    )

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
        let center = NSWorkspace.shared.notificationCenter
        sleepObservers.forEach { center.removeObserver($0) }
    }

    public func start() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.start() }
            return
        }
        guard !isSleeping, !isStarted else { return }

        isStarted = true
        lifecycleGeneration &+= 1
        let generation = lifecycleGeneration
        resetTimer()

        // Establish CPU/network deltas without building process metadata or UI models.
        queue.async { [weak self] in
            guard let self = self else { return }
            self.primeBaselines()
            Thread.sleep(forTimeInterval: 0.2)
            DispatchQueue.main.async { [weak self] in
                guard let self,
                      self.isStarted,
                      !self.isSleeping,
                      self.lifecycleGeneration == generation else { return }
                self.refresh()
            }
        }
    }

    public func stop() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.stop() }
            return
        }

        isStarted = false
        lifecycleGeneration &+= 1
        isUpdating = false
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
        guard !isSleeping else { return }
        isSleeping = true
        stop()
    }

    private func handleSystemWake() {
        guard isSleeping else { return }
        isSleeping = false
        start()
    }

    private func resetTimer() {
        timer?.cancel()
        timer = nil
        guard isStarted, !isSleeping, refreshInterval > 0 else { return }

        // When closed, update at 2.5s interval to minimize CPU; when open, use refreshInterval
        let interval = isPopoverVisible ? refreshInterval : max(2.5, refreshInterval)
        timer = Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.refresh()
            }
    }

    public func refresh() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in self?.refresh() }
            return
        }
        guard isStarted, !isUpdating, !isSleeping else { return }

        isUpdating = true
        let generation = lifecycleGeneration
        let shouldCollectProcesses = isPopoverVisible || processes.isEmpty

        queue.async { [weak self] in
            guard let self = self else { return }
            let snapshot = self.collectData(includeProcesses: shouldCollectProcesses)

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard self.isStarted,
                      !self.isSleeping,
                      self.lifecycleGeneration == generation else { return }

                if (self.isPopoverVisible || self.processes.isEmpty),
                   let newProcesses = snapshot.processes,
                   let newGrouped = snapshot.groupedProcesses {
                    self.processes = newProcesses
                    self.groupedProcesses = newGrouped
                }
                self.systemStats = snapshot.systemStats
                self.isUpdating = false
            }
        }
    }

    private struct CollectionSnapshot {
        let processes: [ProcessItem]?
        let groupedProcesses: [ProcessItem]?
        let systemStats: SystemStats
    }

    static func listAllPIDs() -> [pid_t] {
        let estimatedCount = max(0, Int(proc_listallpids(nil, 0)))
        var capacity = max(256, estimatedCount + 64)

        for attempt in 0..<3 {
            var pids = [pid_t](repeating: 0, count: capacity)
            let reportedCount = pids.withUnsafeMutableBytes { buffer in
                proc_listallpids(buffer.baseAddress, Int32(buffer.count))
            }
            let count = normalizedPIDCount(reportedCount: reportedCount, capacity: capacity)

            if reportedCount < Int32(capacity) || attempt == 2 {
                pids.removeLast(capacity - count)
                pids.removeAll { $0 <= 0 }
                return pids
            }
            capacity *= 2
        }

        return []
    }

    // Warm only the delta state. In particular, this must not resolve names,
    // bundle paths, or icons, since the first visible snapshot will do that once.
    func primeBaselines() {
        let nowMach = mach_absolute_time()
        let pids = Self.listAllPIDs()
        lastTotalProcessCount = pids.count
        var currentTimes: [pid_t: UInt64] = [:]
        currentTimes.reserveCapacity(pids.count)

        for pid in pids where pid > 0 {
            var procInfo = proc_taskinfo()
            let infoSize = Int32(MemoryLayout<proc_taskinfo>.size)
            guard proc_pidinfo(pid, PROC_PIDTASKINFO, 0, &procInfo, infoSize) == infoSize else {
                continue
            }
            currentTimes[pid] = procInfo.pti_total_user + procInfo.pti_total_system
        }

        prevProcessTimes = currentTimes
        prevMachTime = nowMach

        var ignoredStats = collectHostSystemStats()
        collectNetworkStats(into: &ignoredStats)
    }

    private func collectData(includeProcesses: Bool) -> CollectionSnapshot {
        let nowMach = mach_absolute_time()
        var newSystemStats = collectHostSystemStats()
        collectNetworkStats(into: &newSystemStats)
        newSystemStats.totalProcesses = lastTotalProcessCount

        // Update history buffers
        cpuHistoryBuffer.append(newSystemStats.totalCpuPercent)
        if cpuHistoryBuffer.count > 25 { cpuHistoryBuffer.removeFirst() }

        memHistoryBuffer.append(newSystemStats.memoryUsagePercent)
        if memHistoryBuffer.count > 25 { memHistoryBuffer.removeFirst() }

        newSystemStats.cpuHistory = cpuHistoryBuffer
        newSystemStats.memHistory = memHistoryBuffer

        // When the popover is closed, keep only low-cost system stats current.
        if !includeProcesses && prevMachTime > 0 {
            return CollectionSnapshot(processes: nil, groupedProcesses: nil, systemStats: newSystemStats)
        }

        // Collect all running PIDs
        let pids = Self.listAllPIDs()
        let count = pids.count

        newSystemStats.totalProcesses = count
        lastTotalProcessCount = count

        var rawItems: [ProcessItem] = []
        rawItems.reserveCapacity(count)
        var currentTimes: [pid_t: UInt64] = [:]
        currentTimes.reserveCapacity(count)
        var activePids = Set<pid_t>()
        activePids.reserveCapacity(count)
        var activeExecutablePaths = Set<String>()
        activeExecutablePaths.reserveCapacity(count)
        var activeAppBundlePaths = Set<String>()
        activeAppBundlePaths.reserveCapacity(min(count, 128))

        let dMach = Double(prevMachTime > 0 && nowMach > prevMachTime ? (nowMach - prevMachTime) : 0)

        // App Grouping helper
        var groupsMap: [String: ProcessGroupAccumulator] = [:]
        groupsMap.reserveCapacity(min(count, 256))

        for pid in pids {
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
            if !metadata.execPath.isEmpty {
                activeExecutablePaths.insert(metadata.execPath)
            }
            if let appBundlePath = metadata.appBundlePath {
                activeAppBundlePaths.insert(appBundlePath)
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
            let groupKey = metadata.appBundlePath.map { "app:\($0)" } ?? "name:\(metadata.appName)"
            let group: ProcessGroupAccumulator
            if let existing = groupsMap[groupKey] {
                group = existing
            } else {
                let newGroup = ProcessGroupAccumulator(
                    groupKey: groupKey,
                    appName: metadata.appName,
                    executablePath: metadata.execPath,
                    icon: metadata.icon
                )
                groupsMap[groupKey] = newGroup
                group = newGroup
            }
            group.add(
                pid: pid,
                icon: metadata.icon,
                cpuPercent: cpuPercent,
                memoryBytes: memBytes,
                threads: procInfo.pti_threadnum
            )
        }

        // Build grouped items list
        var groupedItems: [ProcessItem] = []
        groupedItems.reserveCapacity(groupsMap.count)
        for group in groupsMap.values {
            groupedItems.append(group.makeProcessItem())
        }

        // Clean stale cache entries periodically while retaining normal reuse.
        if metaCache.count > activePids.count + 50 {
            metaCache = metaCache.filter { activePids.contains($0.key) }
        }
        if executableMetadataCache.count > activeExecutablePaths.count + 128 {
            executableMetadataCache = executableMetadataCache.filter { activeExecutablePaths.contains($0.key) }
        }
        if appBundleMetadataCache.count > activeAppBundlePaths.count + 32 {
            appBundleMetadataCache = appBundleMetadataCache.filter { activeAppBundlePaths.contains($0.key) }
        }

        prevProcessTimes = currentTimes
        prevMachTime = nowMach

        return CollectionSnapshot(
            processes: rawItems,
            groupedProcesses: groupedItems,
            systemStats: newSystemStats
        )
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

        let appInfo = resolveAppInfo(for: execPath, fallbackName: name)
        return ProcessMetadata(
            name: name,
            appName: appInfo.appName,
            execPath: execPath,
            appBundlePath: appInfo.appBundlePath,
            icon: appInfo.icon
        )
    }

    private func resolveAppInfo(
        for execPath: String,
        fallbackName: String
    ) -> (appName: String, appBundlePath: String?, icon: NSImage?) {
        guard !execPath.isEmpty else {
            return (cleanProcessName(fallbackName), nil, defaultIcon)
        }

        let executableMetadata: ExecutableMetadata
        if let cached = executableMetadataCache[execPath] {
            executableMetadata = cached
        } else {
            var appBundlePath: String?
            var currentPath = execPath
            while currentPath != "/" && !currentPath.isEmpty {
                if currentPath.hasSuffix(".app") {
                    appBundlePath = currentPath
                    break
                }
                currentPath = (currentPath as NSString).deletingLastPathComponent
            }

            let standaloneIcon: NSImage?
            if appBundlePath == nil {
                standaloneIcon = FileManager.default.fileExists(atPath: execPath)
                    ? NSWorkspace.shared.icon(forFile: execPath)
                    : defaultIcon
            } else {
                standaloneIcon = nil
            }

            let resolved = ExecutableMetadata(
                appBundlePath: appBundlePath,
                standaloneIcon: standaloneIcon
            )
            executableMetadataCache[execPath] = resolved
            executableMetadata = resolved
        }

        if let appBundlePath = executableMetadata.appBundlePath {
            let appMetadata: AppBundleMetadata
            if let cached = appBundleMetadataCache[appBundlePath] {
                appMetadata = cached
            } else {
                let bundleUrl = URL(fileURLWithPath: appBundlePath)
                let resolved = AppBundleMetadata(
                    appName: bundleUrl.deletingPathExtension().lastPathComponent,
                    icon: NSWorkspace.shared.icon(forFile: appBundlePath)
                )
                appBundleMetadataCache[appBundlePath] = resolved
                appMetadata = resolved
            }
            return (appMetadata.appName, appBundlePath, appMetadata.icon)
        }

        return (cleanProcessName(fallbackName), nil, executableMetadata.standaloneIcon)
    }

    private func cleanProcessName(_ raw: String) -> String {
        // Simplify common helper patterns: "Google Chrome Helper (Renderer)" -> "Google Chrome"
        let name = Self.helperNameRegex.stringByReplacingMatches(
            in: raw,
            options: [],
            range: NSRange(location: 0, length: raw.utf16.count),
            withTemplate: ""
        )
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
