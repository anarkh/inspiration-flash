import SwiftUI
import AppKit

enum ProcessOrdering {
    static func precedes(
        _ lhs: ProcessItem,
        _ rhs: ProcessItem,
        by key: ProcessSortKey,
        ascending: Bool
    ) -> Bool {
        let comparison: ComparisonResult
        switch key {
        case .cpu:
            comparison = compare(lhs.cpuPercent, rhs.cpuPercent)
        case .memory:
            comparison = compare(lhs.memoryBytes, rhs.memoryBytes)
        case .name:
            comparison = lhs.name.localizedCaseInsensitiveCompare(rhs.name)
        case .pid:
            comparison = compare(lhs.pid, rhs.pid)
        }

        if comparison == .orderedSame {
            return lhs.pid < rhs.pid
        }

        return ascending
            ? comparison == .orderedAscending
            : comparison == .orderedDescending
    }

    private static func compare<T: Comparable>(_ lhs: T, _ rhs: T) -> ComparisonResult {
        if lhs < rhs { return .orderedAscending }
        if lhs > rhs { return .orderedDescending }
        return .orderedSame
    }
}

public struct ContentView: View {
    @ObservedObject public var monitor: ProcessMonitor

    @State private var searchText: String = ""
    @State private var sortKey: ProcessSortKey = .cpu
    @State private var isAscending: Bool = false
    @State private var maxDisplayCount: Int = 40

    public init(monitor: ProcessMonitor) {
        self.monitor = monitor
    }

    private var activeList: [ProcessItem] {
        return monitor.isGroupedByApp ? monitor.groupedProcesses : monitor.processes
    }

    private var filteredAndSortedProcesses: [ProcessItem] {
        var list = activeList

        // Search Filter
        if !searchText.isEmpty {
            let lower = searchText.lowercased()
            list = list.filter {
                $0.name.lowercased().contains(lower) ||
                "\($0.pid)".contains(lower) ||
                $0.groupPids.contains { "\($0)".contains(lower) }
            }
        }

        // Sort
        list.sort { a, b in
            ProcessOrdering.precedes(a, b, by: sortKey, ascending: isAscending)
        }

        return Array(list.prefix(maxDisplayCount))
    }

    private func toggleSort(by key: ProcessSortKey) {
        if sortKey == key {
            isAscending.toggle()
        } else {
            sortKey = key
            // Default to descending for resource metrics, ascending for names
            isAscending = (key == .name || key == .pid)
        }
    }

    public var body: some View {
        let displayedProcesses = filteredAndSortedProcesses

        VStack(spacing: 0) {
            // 1. System Overview Section
            SystemSummaryView(stats: monitor.systemStats)
                .padding(.horizontal, 12)
                .padding(.top, 10)
                .padding(.bottom, 8)

            Divider()

            // 2. Search & View Mode Switch Row
            HStack(spacing: 10) {
                // Search Input
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.system(size: 11))

                    TextField("搜索应用名或 PID...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 11))

                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                                .font(.system(size: 11))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(6)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.18), lineWidth: 1)
                )

                // View Mode Switch: Segmented Picker (应用聚合 vs 全量进程)
                Picker("", selection: $monitor.isGroupedByApp) {
                    Text("应用聚合").tag(true)
                    Text("全量进程").tag(false)
                }
                .pickerStyle(.segmented)
                .frame(width: 135)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // 3. Process Table Header with Interactive Sort Buttons
            HStack(spacing: 8) {
                // Name Header Button
                Button(action: { toggleSort(by: .name) }) {
                    HStack(spacing: 3) {
                        Text(monitor.isGroupedByApp ? "应用 (聚合)" : "进程名 / PID")
                            .font(.system(size: 10, weight: .semibold))
                        if sortKey == .name {
                            Image(systemName: isAscending ? "chevron.up" : "chevron.down")
                                .font(.system(size: 8, weight: .bold))
                        }
                    }
                }
                .buttonStyle(.plain)
                .foregroundColor(sortKey == .name ? .primary : .secondary)
                .frame(maxWidth: .infinity, alignment: .leading)

                // CPU Header Button
                Button(action: { toggleSort(by: .cpu) }) {
                    HStack(spacing: 3) {
                        Spacer()
                        Text("CPU")
                            .font(.system(size: 10, weight: .semibold))
                        if sortKey == .cpu {
                            Image(systemName: isAscending ? "chevron.up" : "chevron.down")
                                .font(.system(size: 8, weight: .bold))
                        }
                    }
                    .frame(width: 54, alignment: .trailing)
                }
                .buttonStyle(.plain)
                .foregroundColor(sortKey == .cpu ? .blue : .secondary)

                // Memory Header Button
                Button(action: { toggleSort(by: .memory) }) {
                    HStack(spacing: 3) {
                        Spacer()
                        Text("内存")
                            .font(.system(size: 10, weight: .semibold))
                        if sortKey == .memory {
                            Image(systemName: isAscending ? "chevron.up" : "chevron.down")
                                .font(.system(size: 8, weight: .bold))
                        }
                    }
                    .frame(width: 68, alignment: .trailing)
                }
                .buttonStyle(.plain)
                .foregroundColor(sortKey == .memory ? .purple : .secondary)

                Spacer()
                    .frame(width: 16)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            .background(Color.secondary.opacity(0.06))

            Divider()

            // 4. Process List
            if displayedProcesses.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 28))
                        .foregroundColor(.secondary)
                    Text("未找到匹配的进程")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(height: 270)
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(displayedProcesses) { item in
                            ProcessRowView(item: item) { targetItem, force in
                                monitor.killProcess(item: targetItem, force: force)
                            }
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                }
                .frame(height: 270)
            }

            Divider()

            // 5. Bottom Toolbar & Preferences Menu
            HStack(spacing: 10) {
                // Quick Refresh Interval Selector
                Menu {
                    refreshIntervalOptions
                } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "timer")
                            .font(.system(size: 10))
                        Text(monitor.refreshIntervalText)
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                    }
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("更改刷新频率")

                // Manual refresh button
                Button(action: {
                    monitor.refresh()
                }) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 11))
                }
                .buttonStyle(.plain)
                .help("立即刷新")

                // Preferences Menu (Gear Icon)
                Menu {
                    Section("菜单栏显示样式") {
                        ForEach(MenuBarDisplayMode.allCases) { mode in
                            Button(action: { monitor.menuBarDisplayMode = mode }) {
                                HStack {
                                    Text(mode.rawValue)
                                    if monitor.menuBarDisplayMode == mode {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    }

                    Section("数据刷新频率") {
                        refreshIntervalOptions
                    }

                    Section("系统选项") {
                        Button(action: {
                            monitor.toggleLaunchAtLogin()
                        }) {
                            HStack {
                                Text("开机自动启动")
                                if monitor.isLaunchAtLogin {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 11))
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                .help("偏好设置")

                Spacer()

                // Open Native Activity Monitor
                Button(action: {
                    monitor.openActivityMonitor()
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chart.bar.xaxis")
                        Text("活动监视器")
                    }
                    .font(.system(size: 10))
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                // Quit App
                Button(action: {
                    NSApplication.shared.terminate(nil)
                }) {
                    Image(systemName: "power")
                        .foregroundColor(.red.opacity(0.85))
                        .font(.system(size: 11))
                }
                .buttonStyle(.plain)
                .help("退出小组件")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.windowBackgroundColor).opacity(0.5))
        }
        .frame(width: 380)
        .onAppear {
            monitor.isPopoverVisible = true
        }
        .onDisappear {
            monitor.isPopoverVisible = false
        }
    }

    @ViewBuilder
    private var refreshIntervalOptions: some View {
        let intervals: [(Double, String)] = [
            (1.0, "1.0 秒 (高频)"),
            (1.5, "1.5 秒"),
            (3.0, "3.0 秒 (节能)"),
            (5.0, "5.0 秒 (推荐)"),
            (0.0, "暂停自动刷新")
        ]

        ForEach(intervals, id: \.0) { item in
            Button(action: {
                monitor.refreshInterval = item.0
            }) {
                HStack {
                    Text(item.1)
                    if monitor.refreshInterval == item.0 {
                        Image(systemName: "checkmark")
                    }
                }
            }
        }
    }
}
