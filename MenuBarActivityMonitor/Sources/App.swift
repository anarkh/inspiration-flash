import SwiftUI
import AppKit

@main
struct MenuBarActivityMonitorApp: App {
    @StateObject private var monitor = ProcessMonitor()
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        MenuBarExtra {
            ContentView(monitor: monitor)
        } label: {
            menuBarLabel
        }
        .menuBarExtraStyle(.window)
    }

    @ViewBuilder
    private var menuBarLabel: some View {
        HStack(spacing: 4) {
            Image(systemName: "cpu")
                .foregroundColor(monitor.systemStats.totalCpuPercent >= 75.0 ? .red : .primary)

            switch monitor.menuBarDisplayMode {
            case .iconOnly:
                EmptyView()

            case .cpuOnly:
                Text(String(format: "%.0f%%", monitor.systemStats.totalCpuPercent))
                    .font(.system(size: 11, weight: .medium, design: .monospaced))

            case .cpuAndMem:
                Text("\(String(format: "%.0f%%", monitor.systemStats.totalCpuPercent)) | \(monitor.systemStats.formattedUsedMemory)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))

            case .cpuAndNet:
                Text("\(String(format: "%.0f%%", monitor.systemStats.totalCpuPercent)) | \(monitor.systemStats.formattedDownloadSpeed)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Run purely in Menu Bar without showing in the macOS Dock
        NSApp.setActivationPolicy(.accessory)
    }
}
