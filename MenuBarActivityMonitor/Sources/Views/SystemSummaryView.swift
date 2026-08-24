import SwiftUI

public struct SystemSummaryView: View {
    public let stats: SystemStats

    public init(stats: SystemStats) {
        self.stats = stats
    }

    public var body: some View {
        VStack(spacing: 8) {
            // Metrics Cards Row
            HStack(spacing: 10) {
                // CPU Card
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        Image(systemName: "cpu")
                            .foregroundColor(.blue)
                            .font(.system(size: 11))
                        Text("CPU 负载")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(String(format: "%.1f%%", stats.totalCpuPercent))
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(cpuColor(stats.totalCpuPercent))
                    }

                    // Mini Sparkline Chart
                    SparklineView(data: stats.cpuHistory, lineColor: cpuColor(stats.totalCpuPercent), maxValue: 100.0)
                        .frame(height: 24)
                        .padding(.vertical, 1)

                    HStack {
                        Text("用户: \(String(format: "%.0f%%", stats.userCpuPercent))")
                        Spacer()
                        Text("系统: \(String(format: "%.0f%%", stats.systemCpuPercent))")
                    }
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
                }
                .padding(8)
                .background(Color(NSColor.controlBackgroundColor).opacity(0.7))
                .cornerRadius(8)

                // Memory Card
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        Image(systemName: "memorychip")
                            .foregroundColor(.purple)
                            .font(.system(size: 11))
                        Text("物理内存")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(String(format: "%.0f%%", stats.memoryUsagePercent))
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(memColor(stats.memoryUsagePercent))
                    }

                    // Mini Sparkline Chart
                    SparklineView(data: stats.memHistory, lineColor: memColor(stats.memoryUsagePercent), maxValue: 100.0)
                        .frame(height: 24)
                        .padding(.vertical, 1)

                    HStack {
                        Text("\(stats.formattedUsedMemory) / \(stats.formattedTotalMemory)")
                        Spacer()
                        Text("\(stats.totalProcesses) 进程")
                    }
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
                }
                .padding(8)
                .background(Color(NSColor.controlBackgroundColor).opacity(0.7))
                .cornerRadius(8)
            }

            // Real-time Network Bandwidth Bar
            HStack(spacing: 12) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.down.circle.fill")
                        .foregroundColor(.green.opacity(0.85))
                        .font(.system(size: 10))
                    Text(stats.formattedDownloadSpeed)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                }

                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.circle.fill")
                        .foregroundColor(.cyan.opacity(0.85))
                        .font(.system(size: 10))
                    Text(stats.formattedUploadSpeed)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                }

                Spacer()

                Text("网络 I/O")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color(NSColor.controlBackgroundColor).opacity(0.4))
            .cornerRadius(6)
        }
    }

    private func cpuColor(_ percent: Double) -> Color {
        if percent >= 75.0 {
            return .red
        } else if percent >= 40.0 {
            return .orange
        } else {
            return .blue
        }
    }

    private func memColor(_ percent: Double) -> Color {
        if percent >= 85.0 {
            return .red
        } else if percent >= 70.0 {
            return .orange
        } else {
            return .purple
        }
    }
}
