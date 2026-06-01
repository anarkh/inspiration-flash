# Cyber Live Room

Local Node-hosted web app for running a multi-model discussion room.

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:52330/
```

Use a different port if needed:

```bash
PORT=8899 npm start
```

## Package

Create a local npm tarball:

```bash
npm pack
```

Install the package globally from the tarball:

```bash
npm install -g cyber-live-room-0.1.0.tgz
cyber-live-room
```

## Local Data

The server stores configuration and transcript state in:

```text
~/.cyber-live-room/state.json
```

Override the storage directory:

```bash
CYBER_LIVE_ROOM_DATA_DIR=/path/to/data npm start
```

The browser only talks to this Node server. Provider API requests are made by
Node through `/api/model`, so browser CORS does not block model calls.
