# Cyber Live Room

Cyber Live Room is a multi-platform prototype for an AI discussion room.
The user is the host. Each configured model is an audience member that can
answer the host and then react to the other models.

This repository contains three implementations of the same product shape:

- `web/`: Node-hosted browser implementation with local file persistence.
- `android/`: native Android source structure.
- `ios/`: native SwiftUI source structure.
- `shared/`: shared product rules, data model, and behavior notes.

## Source Layout

```text
cyber-live-room/
  shared/                         Product rules and shared model notes
  web/src/data/                   Defaults and server-backed persistence client
  web/server/                     Node HTTP server, local file store, provider proxy
  web/src/domain/                 Discussion, memory, and compression engine
  web/src/ui/                     DOM rendering
  web/src/app.js                  Browser entrypoint and event wiring
  android/app/src/main/java/com/cyberliveroom/domain/
                                  Kotlin state models and room engine
  android/app/src/main/java/com/cyberliveroom/data/
                                  Android persistence
  android/app/src/main/java/com/cyberliveroom/ui/
                                  Compose activity and screens
  ios/CyberLiveRoom/Domain/       Swift models and room engine
  ios/CyberLiveRoom/Data/         UserDefaults persistence
  ios/CyberLiveRoom/Presentation/ SwiftUI views and view model
  ios/CyberLiveRoom/App/          SwiftUI app entrypoint
```

## Core Features

- Live-room layout with host input, audience model cards, and a transcript.
- Config page for adding, editing, enabling, disabling, and deleting models.
- Multi-model discussion loop: each enabled model responds to the host, then
  later rounds can reference earlier model comments.
- Memory system: explicit user memories, auto-captured preference memories,
  editable memory list, and memory injection into future model context.
- Context compression: older transcript messages are summarized into compact
  carry-forward records once the token budget is exceeded.
- Offline simulation adapter by default, plus per-model provider, endpoint,
  model id, and API key fields. Real provider requests are proxied through the
  local Node service.

## Run The Web App

From the web package:

```bash
cd cyber-live-room/web
npm start
```

Then open:

`http://127.0.0.1:52330/`

The app stores room state and model configuration in
`~/.cyber-live-room/state.json` by default. Override that location with
`CYBER_LIVE_ROOM_DATA_DIR=/path/to/data`.

## Platform Notes

The Web implementation is the reference experience and is fully runnable as a
static page. Android and iOS contain native app code that mirrors the same
state model and product logic. They are intentionally dependency-light and are
ready to wire into real provider SDKs or HTTP backends.

The current machine does not have Gradle or the Android SDK available, so the
Android project has not been compiled here. The iOS project includes an Xcode
project and has been built with:

`xcodebuild -project cyber-live-room/ios/CyberLiveRoom.xcodeproj -scheme CyberLiveRoom -destination generic/platform=iOS -derivedDataPath /private/tmp/CyberLiveRoomDerivedData CODE_SIGNING_ALLOWED=NO build`

The Web JavaScript has been syntax-checked with:

`find cyber-live-room/web/src -name '*.js' -exec node --check {} \;`
