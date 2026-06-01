# Cyber Live Room iOS

Native SwiftUI implementation of the Cyber Live Room prototype.

## Stack

- SwiftUI
- ObservableObject view model
- Codable persistence in UserDefaults
- Offline simulation room engine

## What Is Implemented

- Room tab with host broadcast input, audience model cards, and transcript.
- Config tab for adding, enabling, disabling, and deleting audience models.
- Memory tab for pinned memory, context budget, and compressed summaries.
- Room engine with memory capture and context compression.

## Source Layout

- `App/`: SwiftUI app entrypoint.
- `Domain/`: state models, seed data, discussion engine, memory capture, and compression.
- `Data/`: `UserDefaults` snapshot persistence.
- `Presentation/ViewModels/`: observable room state and actions.
- `Presentation/Views/`: SwiftUI screens and reusable cards.

## Run

Open `CyberLiveRoom.xcodeproj` in Xcode and run the `CyberLiveRoom`
scheme on an iOS simulator.
