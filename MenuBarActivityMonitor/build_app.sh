#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🔨 正在编译 Release 版本..."
swift build -c release

APP_NAME="MenuBar Activity Monitor"
APP_BUNDLE="$DIR/build/$APP_NAME.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "📦 正在创建 macOS App Bundle: $APP_BUNDLE"
rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS"
mkdir -p "$RESOURCES"

# 复制可执行文件
cp "$DIR/.build/release/MenuBarActivityMonitor" "$MACOS/MenuBarActivityMonitor"

# 创建 Info.plist (LSUIElement=true 使其作为纯 MenuBar 小组件运行，不占 Dock)
cat << 'EOF' > "$CONTENTS/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>MenuBarActivityMonitor</string>
    <key>CFBundleIdentifier</key>
    <string>com.menubar.activitymonitor</string>
    <key>CFBundleName</key>
    <string>MenuBar Activity Monitor</string>
    <key>CFBundleDisplayName</key>
    <string>MenuBar Activity Monitor</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.1</string>
    <key>CFBundleVersion</key>
    <string>2</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "🔏 正在添加本机 ad-hoc 签名..."
codesign --force --sign - "$APP_BUNDLE"

echo "✅ 构建完成！应用生成在: $APP_BUNDLE"
echo ""
echo "你可以直接双击运行，或执行命令启动："
echo "  open \"$APP_BUNDLE\""
echo "若要长期使用，可将其移动到 /Applications 目录下。"
