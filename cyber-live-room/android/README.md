# Cyber Live Room Android

Native Android implementation of the Cyber Live Room prototype.

## Stack

- Kotlin
- Jetpack Compose
- Material 3
- Offline simulation room engine

## What Is Implemented

- Room tab with host broadcast input, audience model cards, and transcript.
- Config tab for adding, enabling, disabling, and deleting audience models.
- Memory tab for pinned memory, token budget, and compressed summaries.
- Room engine with memory capture and context compression.

## Source Layout

- `domain/`: state models, seed data, discussion engine, memory capture, and compression.
- `data/`: `SharedPreferences` snapshot persistence.
- `ui/`: Compose activity, screens, cards, and input flows.

## Run

Open `cyber-live-room/android` in Android Studio and sync Gradle.

The current execution environment does not include Gradle or Android SDK tools,
so this project has not been compiled in this workspace.
