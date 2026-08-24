import SwiftUI
import AppKit

public struct ProcessRowView: View {
    public let item: ProcessItem
    public let onKill: (ProcessItem, Bool) -> Void

    @State private var isHovering: Bool = false

    public init(item: ProcessItem, onKill: @escaping (ProcessItem, Bool) -> Void) {
        self.item = item
        self.onKill = onKill
    }

    public var body: some View {
        HStack(spacing: 8) {
            // Process Icon
            if let icon = item.icon {
                Image(nsImage: icon)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 18, height: 18)
            } else {
                Image(systemName: "app.fill")
                    .resizable()
                    .frame(width: 18, height: 18)
                    .foregroundColor(.secondary)
            }

            // Name and PID / Subprocess Count
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(item.name)
                        .font(.system(size: 12, weight: .medium))
                        .lineLimit(1)
                        .truncationMode(.tail)

                    if item.subprocessCount > 1 {
                        Text("\(item.subprocessCount)")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.secondary.opacity(0.18))
                            .cornerRadius(4)
                    }
                }

                if item.isGroup {
                    Text("主 PID: \(item.pid) · 共 \(item.subprocessCount) 个进程")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.secondary)
                } else {
                    Text("PID: \(item.pid)")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 8)

            // CPU Usage
            Text(item.formattedCPU)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(cpuColor(item.cpuPercent))
                .frame(width: 54, alignment: .trailing)

            // Memory Usage
            Text(item.formattedMemory)
                .font(.system(size: 11, weight: .regular, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(width: 68, alignment: .trailing)

            // Actions (Hover)
            if isHovering {
                Button(action: {
                    onKill(item, false)
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red.opacity(0.85))
                        .font(.system(size: 13))
                }
                .buttonStyle(.plain)
                .help(item.isGroup ? "终止该应用的全部 \(item.subprocessCount) 个进程" : "终止进程 (SIGTERM)")
                .frame(width: 16)
            } else {
                Spacer()
                    .frame(width: 16)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, 6)
        .background(isHovering ? Color.secondary.opacity(0.12) : Color.clear)
        .cornerRadius(6)
        .onHover { hovering in
            isHovering = hovering
        }
        .contextMenu {
            if item.isGroup {
                Button("退出全部 \(item.subprocessCount) 个相关进程") {
                    onKill(item, false)
                }
                Button("强制退出全部进程 (Force Kill)") {
                    onKill(item, true)
                }
            } else {
                Button("退出进程 (Quit)") {
                    onKill(item, false)
                }
                Button("强制退出进程 (Force Kill)") {
                    onKill(item, true)
                }
            }
            Divider()
            if !item.executablePath.isEmpty {
                Button("在访达中显示 (Reveal in Finder)") {
                    let url = URL(fileURLWithPath: item.executablePath)
                    NSWorkspace.shared.activateFileViewerSelecting([url])
                }
            }
            Button("复制 PID 列表") {
                NSPasteboard.general.clearContents()
                let pidsStr = item.groupPids.map { "\($0)" }.joined(separator: ", ")
                NSPasteboard.general.setString(pidsStr, forType: .string)
            }
            Button("复制应用名称") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(item.name, forType: .string)
            }
        }
    }

    private func cpuColor(_ percent: Double) -> Color {
        if percent >= 50.0 {
            return .red
        } else if percent >= 15.0 {
            return .orange
        } else if percent >= 1.0 {
            return .primary
        } else {
            return .secondary
        }
    }
}
