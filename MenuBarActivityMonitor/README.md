# MenuBar Activity Monitor

MenuBar Activity Monitor 是一个运行在 macOS 菜单栏中的原生系统监控工具。它实时展示 CPU、内存和网络 I/O，并提供进程搜索、排序、聚合与终止操作。

本目录是 `inspiration-flash` 仓库中的独立 Swift 子项目，不依赖仓库内其他应用。

## 环境要求

- macOS 13 Ventura 或更高版本
- Swift 5.9 或兼容工具链，可通过 Xcode 或 Xcode Command Line Tools 安装

项目仅使用 SwiftUI、AppKit、Darwin/Mach 和 ServiceManagement 等系统框架，没有第三方依赖。

## 快速运行

从 `inspiration-flash` 仓库根目录执行：

```bash
cd MenuBarActivityMonitor
swift run
```

构建完成后，菜单栏会出现 CPU 图标和当前 CPU 使用率。点击图标即可打开监控面板。使用 `Control-C` 结束从终端启动的进程；也可以点击面板右下角的电源按钮退出。

## 构建 macOS 应用

打包脚本会先执行 release 构建，再生成本地 `.app`：

```bash
cd MenuBarActivityMonitor
./build_app.sh
open "build/MenuBar Activity Monitor.app"
```

生成物位于 `build/MenuBar Activity Monitor.app`，不会提交到 Git。脚本会添加本机 ad-hoc 签名，但不会添加 Developer ID 签名或进行 Apple 公证；该应用包适合本机开发和使用，不应直接作为面向其他用户的正式发行包。

首次安装且目标路径不存在时，可以复制到 `/Applications`：

```bash
cp -R "build/MenuBar Activity Monitor.app" /Applications/
open "/Applications/MenuBar Activity Monitor.app"
```

如果 `/Applications/MenuBar Activity Monitor.app` 已存在，先从菜单栏退出旧版本，再通过 Finder 用新构建的应用替换旧应用。不要同时启动构建目录和 `/Applications` 中的两个副本：它们共享 bundle ID `com.menubar.activitymonitor`，macOS 会把它们视为同一个登录项应用，并可能终止后启动的副本。保留该 bundle ID 可以延续已有的偏好设置和登录启动身份。

## 使用方法

- 菜单栏：在设置菜单中切换仅图标、CPU、CPU 与内存、CPU 与网速四种显示模式。
- 系统概览：查看 CPU 用户态/系统态占比、内存使用量、进程数和实时网络速率。
- 进程视图：在“应用聚合”和“全量进程”之间切换，并按名称、PID、CPU 或内存排序。
- 搜索：输入应用名、进程名或 PID 过滤当前列表。
- 刷新：选择 1 秒、1.5 秒、3 秒、5 秒或暂停，也可以手动刷新。
- 系统工具：点击“活动监视器”打开 macOS 自带的 Activity Monitor。
- 登录启动：使用齿轮菜单中的“开机自动启动”。该能力依赖应用包身份，建议从已安装的 `.app` 中设置；使用 `swift run` 时注册可能失败。

### 终止进程前先确认目标

进程行悬停按钮会发送 `SIGTERM`；右键菜单还可以发送 `SIGKILL`。应用聚合模式下，操作会作用于该分组列出的全部 PID。系统只允许终止当前用户有权限控制的进程，受保护的系统进程可能不会响应。

`SIGKILL` 不允许目标进程清理状态，可能导致未保存数据丢失。需要结束单个进程时，先切换到“全量进程”，核对名称和 PID，再执行操作。

## 开发与验证

```bash
cd MenuBarActivityMonitor
swift build
swift build -c release
./build_app.sh
plutil -lint "build/MenuBar Activity Monitor.app/Contents/Info.plist"
codesign --verify --deep --strict "build/MenuBar Activity Monitor.app"
```

上述命令应全部以状态码 `0` 结束，并生成可执行文件 `build/MenuBar Activity Monitor.app/Contents/MacOS/MenuBarActivityMonitor`。当前项目没有自动化测试 target，编译、打包和本机菜单栏冒烟检查是主要验证方式。

常用清理命令：

```bash
swift package clean
```

源码入口与职责：

- `Sources/App.swift`：菜单栏应用入口和展示模式。
- `Sources/ProcessMonitor.swift`：系统指标、进程、网络采集以及进程控制。
- `Sources/ProcessModel.swift`：进程和系统指标模型。
- `Sources/Views/`：监控面板、进程行和趋势图等 SwiftUI 视图。
- `build_app.sh`：release 编译和 `.app` 目录结构生成。

## 数据与权限说明

应用通过 macOS 本地系统接口读取运行中的进程和资源统计，不配置网络服务，也不上传采集数据。部分系统或其他用户的进程可能只返回有限信息；这是 macOS 权限边界，不代表采集失败。
