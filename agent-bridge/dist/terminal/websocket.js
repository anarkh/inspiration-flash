import { createHash } from "node:crypto";
import { ensureTerminalLogTail, readTerminalLog, subscribeTerminalLog, terminalLogPath } from "./logs.js";
import { resizeTerminal, sendTerminalInput } from "./tmux.js";
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
export async function handleTerminalWebSocket(request, socket, head, runId, kind) {
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") {
        socket.destroy();
        return;
    }
    const terminalId = `${runId}:${kind}`;
    const accept = createHash("sha1").update(`${key}${WS_GUID}`).digest("base64");
    socket.write([
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "",
        ""
    ].join("\r\n"));
    writeFrame(socket, await readTerminalLog(runId, kind));
    ensureTerminalLogTail(terminalId, terminalLogPath(runId, kind), true);
    const unsubscribe = subscribeTerminalLog(terminalId, (event) => {
        if (event.data) {
            writeFrame(socket, event.data);
        }
    });
    const parser = createFrameParser(async (message) => {
        const resize = parseResizeMessage(message);
        if (resize) {
            await resizeTerminal(terminalId, resize.cols, resize.rows).catch(() => false);
            return;
        }
        await sendTerminalInput(terminalId, message).catch(() => false);
    }, () => {
        unsubscribe();
        socket.end();
    });
    socket.on("data", (chunk) => parser(Buffer.from(chunk)));
    socket.on("close", unsubscribe);
    socket.on("error", unsubscribe);
    if (head.length > 0) {
        parser(head);
    }
}
function writeFrame(socket, text) {
    if (!socket.writable || text.length === 0) {
        return;
    }
    const payload = Buffer.from(text, "utf8");
    const header = frameHeader(payload.length);
    socket.write(Buffer.concat([header, payload]));
}
function frameHeader(length) {
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
function createFrameParser(onText, onClose) {
    let pending = Buffer.alloc(0);
    return (chunk) => {
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
            }
            else if (length === 127) {
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
            let mask = null;
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
function unmask(payload, mask) {
    const output = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 1) {
        output[index] = payload[index] ^ mask[index % 4];
    }
    return output;
}
function parseResizeMessage(message) {
    if (!message.startsWith("\x1b]agent-bridge;")) {
        return null;
    }
    const text = message.slice("\x1b]agent-bridge;".length);
    try {
        const value = JSON.parse(text);
        if (typeof value === "object" && value !== null) {
            const record = value;
            const cols = Number(record.cols);
            const rows = Number(record.rows);
            if (record.type === "resize" && Number.isFinite(cols) && Number.isFinite(rows)) {
                return {
                    cols,
                    rows
                };
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
//# sourceMappingURL=websocket.js.map