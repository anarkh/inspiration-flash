import { EventEmitter } from "node:events";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { TERMINAL_LOG_DIR } from "../core/constants.js";
const streams = new Map();
const tails = new Map();
export function createTerminalSession(runId, agent, cwd, onStart) {
    const terminalId = terminalKey(runId, agent.kind);
    const logPath = terminalLogPath(runId, agent.kind);
    let queue = Promise.resolve();
    const session = {
        terminalId,
        logPath,
        backend: "capture",
        flush: () => queue,
        capture: {
            onStart(info) {
                const commandLine = formatCommandLine(info.command, info.args);
                const header = [
                    `\x1b[90m# Agent Bridge terminal\x1b[0m`,
                    `\x1b[90m# run: ${runId}\x1b[0m`,
                    `\x1b[90m# agent: ${agent.label}\x1b[0m`,
                    `\x1b[90m# cwd: ${cwd}\x1b[0m`,
                    `\x1b[90m# pid: ${info.pid}\x1b[0m`,
                    `\x1b[90m$ ${commandLine}\x1b[0m`,
                    ""
                ].join("\r\n");
                queue = writeTerminalLog(logPath, header);
                publishTerminalEvent(terminalId, { type: "start", data: header, pid: info.pid });
                onStart?.(info, session);
            },
            onStdout(chunk) {
                queue = queue.then(() => appendTerminalLog(logPath, chunk));
                publishTerminalEvent(terminalId, { type: "stdout", data: chunk.toString("utf8") });
            },
            onStderr(chunk) {
                queue = queue.then(() => appendTerminalLog(logPath, chunk));
                publishTerminalEvent(terminalId, { type: "stderr", data: chunk.toString("utf8") });
            },
            onClose(code) {
                const footer = `\r\n\x1b[90m# process exited with code ${code ?? "unknown"}\x1b[0m\r\n`;
                queue = queue.then(() => appendTerminalLog(logPath, Buffer.from(footer)));
                publishTerminalEvent(terminalId, { type: "close", data: footer, code });
            }
        }
    };
    void mkdir(join(TERMINAL_LOG_DIR, runId), { recursive: true });
    return session;
}
export async function readTerminalLog(runId, kind) {
    return readFile(terminalLogPath(runId, kind), "utf8").catch(() => "");
}
export function subscribeTerminalLog(terminalId, listener) {
    const stream = streamFor(terminalId);
    stream.on("event", listener);
    return () => stream.off("event", listener);
}
export function ensureTerminalLogTail(terminalId, logPath, fromEnd = true) {
    if (tails.has(terminalId)) {
        return;
    }
    let offset = 0;
    void readFile(logPath).then((buffer) => {
        offset = fromEnd ? buffer.length : 0;
    }).catch(() => undefined);
    const timer = setInterval(async () => {
        const buffer = await readFile(logPath).catch(() => null);
        if (!buffer) {
            return;
        }
        if (buffer.length < offset) {
            offset = 0;
        }
        if (buffer.length === offset) {
            return;
        }
        const chunk = buffer.subarray(offset);
        offset = buffer.length;
        publishTerminalEvent(terminalId, { type: "stdout", data: chunk.toString("utf8") });
    }, 200);
    timer.unref?.();
    tails.set(terminalId, timer);
}
export function terminalKey(runId, kind) {
    return `${runId}:${kind}`;
}
export function terminalLogPath(runId, kind) {
    return join(TERMINAL_LOG_DIR, runId, `${safeSegment(kind)}.ansi.log`);
}
function streamFor(terminalId) {
    let stream = streams.get(terminalId);
    if (!stream) {
        stream = new EventEmitter();
        stream.setMaxListeners(100);
        streams.set(terminalId, stream);
    }
    return stream;
}
export function publishTerminalEvent(terminalId, event) {
    streamFor(terminalId).emit("event", event);
}
export async function writeTerminalLog(path, text) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, "utf8");
}
export async function appendTerminalLog(path, chunk) {
    await appendFile(path, chunk);
}
function safeSegment(value) {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
export function formatCommandLine(command, args) {
    const line = shellQuote([command, ...args]);
    return line.length <= 2000
        ? line
        : `${line.slice(0, 2000)} ... [truncated ${line.length - 2000} chars]`;
}
export function shellQuote(parts) {
    return parts.map((part) => /^[a-zA-Z0-9_./:=@%+-]+$/.test(part)
        ? part
        : `'${part.replaceAll("'", "'\\''")}'`).join(" ");
}
//# sourceMappingURL=logs.js.map