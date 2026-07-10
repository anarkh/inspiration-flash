import { createHash } from "node:crypto";
import type http from "node:http";
import type { Duplex } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { streamTerminalLogSnapshot, tailTerminalLog } from "./logs.ts";
import { resizeTerminal, sendTerminalInput } from "./tmux.ts";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export async function handleTerminalWebSocket(
  request: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  target: TerminalSocketTarget
): Promise<void> {
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    ""
  ].join("\r\n"));

  const releases: Array<() => void> = [];
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    for (const release of releases.splice(0)) {
      release();
    }
  };
  const addRelease = (release: () => void) => {
    if (cleanedUp) {
      release();
    } else {
      releases.push(release);
    }
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);

  const decoder = new StringDecoder("utf8");
  const snapshotOffset = await streamTerminalLogSnapshot(target.logPath, async (chunk) => {
    if (cleanedUp || socket.destroyed || !socket.writable) {
      return false;
    }
    const text = decoder.write(chunk);
    if (text && !writeFrame(socket, text)) {
      await waitForSocketDrain(socket);
    }
  });
  if (cleanedUp || socket.destroyed || !socket.writable) {
    return;
  }
  if (!target.tail) {
    const snapshotRemainder = decoder.end();
    if (snapshotRemainder) writeFrame(socket, snapshotRemainder);
  } else {
    addRelease(tailTerminalLog(target.logPath, snapshotOffset, async (data) => {
      if (!writeFrame(socket, data)) {
        await waitForSocketDrain(socket);
      }
    }, decoder));
  }
  const parser = createFrameParser(async (message) => {
    const resize = parseResizeMessage(message);
    if (resize) {
      await resizeTerminal(target.terminalId, resize.cols, resize.rows).catch(() => false);
      return;
    }
    await sendTerminalInput(target.terminalId, message).catch(() => false);
  }, () => {
    cleanup();
    socket.end();
  });
  socket.on("data", (chunk) => parser(Buffer.from(chunk)));
  if (head.length > 0) {
    parser(head);
  }
}

export interface TerminalSocketTarget {
  terminalId: string;
  logPath: string;
  tail: boolean;
}

function writeFrame(socket: Duplex, text: string): boolean {
  if (!socket.writable || text.length === 0) {
    return true;
  }
  const payload = Buffer.from(text, "utf8");
  const header = frameHeader(payload.length);
  return socket.write(Buffer.concat([header, payload]));
}

function waitForSocketDrain(socket: Duplex): Promise<void> {
  if (socket.destroyed || !socket.writable) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      socket.off("drain", done);
      socket.off("close", done);
      socket.off("error", done);
      resolve();
    };
    socket.once("drain", done);
    socket.once("close", done);
    socket.once("error", done);
  });
}

function frameHeader(length: number): Buffer {
  if (length < 126) {
    return Buffer.from([0x81, length]);
  }
  if (length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return header;
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return header;
}

function createFrameParser(onText: (message: string) => Promise<void>, onClose: () => void): (chunk: Buffer) => void {
  let pending = Buffer.alloc(0);
  return (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 2) {
      const first = pending[0];
      const second = pending[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (pending.length < offset + 2) {
          return;
        }
        length = pending.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (pending.length < offset + 8) {
          return;
        }
        const bigLength = pending.readBigUInt64BE(offset);
        if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          onClose();
          return;
        }
        length = Number(bigLength);
        offset += 8;
      }
      let mask: Buffer | null = null;
      if (masked) {
        const maskOffset = offset;
        mask = Buffer.from(pending.subarray(maskOffset, maskOffset + 4));
        offset += 4;
      }
      if (pending.length < offset + length) {
        return;
      }
      let payload = Buffer.from(pending.subarray(offset, offset + length));
      pending = pending.subarray(offset + length);
      if (mask) {
        payload = unmask(payload, mask);
      }
      if (opcode === 0x8) {
        onClose();
        return;
      }
      if (opcode === 0x1 || opcode === 0x2) {
        void onText(payload.toString("utf8"));
      }
    }
  };
}

function unmask(payload: Buffer, mask: Buffer): Buffer<ArrayBuffer> {
  const output = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    output[index] = payload[index] ^ mask[index % 4];
  }
  return output;
}

function parseResizeMessage(message: string): { cols: number; rows: number } | null {
  if (!message.startsWith("\x1b]agent-bridge;")) {
    return null;
  }
  const text = message.slice("\x1b]agent-bridge;".length);
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      const cols = Number(record.cols);
      const rows = Number(record.rows);
      if (record.type === "resize" && Number.isFinite(cols) && Number.isFinite(rows)) {
        return {
          cols,
          rows
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}
