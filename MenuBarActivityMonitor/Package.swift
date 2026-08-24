// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MenuBarActivityMonitor",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "MenuBarActivityMonitor",
            targets: ["MenuBarActivityMonitor"]
        )
    ],
    targets: [
        .executableTarget(
            name: "MenuBarActivityMonitor",
            path: "Sources"
        ),
        .testTarget(
            name: "MenuBarActivityMonitorTests",
            dependencies: ["MenuBarActivityMonitor"],
            path: "Tests/Unit"
        )
    ]
)
