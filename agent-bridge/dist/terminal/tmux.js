import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { BYPASS_ENV } from "../core/constants.js";
import { detectKnownAgentError, firstKnownAgentErrorLine } from "../core/agent-errors.js";
import { appendTerminalLog, ensureTerminalLogTail, formatCommandLine, publishTerminalEvent, shellQuote, writeTerminalLog } from "./logs.js";
const TMUX_BACKEND_ENV = "AGENT_BRIDGE_TERMINAL_BACKEND";
const TMUX_BIN_ENV = "AGENT_BRIDGE_TMUX";
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 36;
let cachedTmux;
class KnownFatalOutputError extends Error {
    kind;
    line;
    constructor(kind, line) {
        super(`Agent command produced ${kind} output: ${line}`);
        this.kind = kind;
        this.line = line;
    }
}
export function attachTmuxRunner(session, options) {
    const tmux = tmuxBinary();
    if (!tmux) {
        return;
    }
    session.backend = "tmux";
    session.tmuxSession = tmuxSessionName(session.terminalId);
    session.runner = {
        run: (command, args, input, runOptions) => runInTmux(tmux, session, options, command, args, input, runOptions)
    };
}
export async function sendTerminalInput(terminalId, data) {
    const tmux = tmuxBinary();
    if (!tmux || data.length === 0) {
        return false;
    }
    const sessionName = tmuxSessionName(terminalId);
    if (!await hasSession(tmux, sessionName)) {
        return false;
    }
    if (data === "\x03") {
        await execTmux(tmux, ["send-keys", "-t", sessionName, "C-c"]);
        return true;
    }
    if (data === "\x04") {
        await execTmux(tmux, ["send-keys", "-t", sessionName, "C-d"]);
        return true;
    }
    const bufferName = `agent-bridge-${createHash("sha1").update(`${terminalId}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 12)}`;
    await execTmux(tmux, ["load-buffer", "-b", bufferName, "-"], data);
    await execTmux(tmux, ["paste-buffer", "-d", "-b", bufferName, "-t", sessionName]);
    return true;
}
export async function resizeTerminal(terminalId, cols, rows) {
    const tmux = tmuxBinary();
    if (!tmux) {
        return false;
    }
    const sessionName = tmuxSessionName(terminalId);
    if (!await hasSession(tmux, sessionName)) {
        return false;
    }
    await execTmux(tmux, [
        "resize-window",
        "-t",
        sessionName,
        "-x",
        String(Math.max(40, Math.floor(cols))),
        "-y",
        String(Math.max(12, Math.floor(rows)))
    ]);
    return true;
}
export function tmuxSessionName(terminalId) {
    const hash = createHash("sha1").update(terminalId).digest("hex").slice(0, 12);
    const readable = terminalId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48);
    return `agent-bridge-${readable}-${hash}`;
}
function tmuxBinary() {
    const mode = process.env[TMUX_BACKEND_ENV];
    if (mode === "capture") {
        return null;
    }
    if (cachedTmux !== undefined) {
        return cachedTmux;
    }
    const configured = process.env[TMUX_BIN_ENV];
    if (configured) {
        cachedTmux = configured;
        return cachedTmux;
    }
    const result = spawnSync("tmux", ["-V"], { stdio: "ignore" });
    cachedTmux = result.status === 0 ? "tmux" : null;
    return cachedTmux;
}
async function runInTmux(tmux, session, attachOptions, command, args, input, runOptions) {
    const sessionName = session.tmuxSession ?? tmuxSessionName(session.terminalId);
    const workDir = dirname(session.logPath);
    await mkdir(workDir, { recursive: true });
    const inputPath = join(workDir, "stdin.txt");
    const exitPath = join(workDir, "exit-code.txt");
    const donePath = join(workDir, "done");
    const scriptPath = join(workDir, "command.sh");
    await Promise.all([
        writeFile(inputPath, input, "utf8"),
        rm(exitPath, { force: true }),
        rm(donePath, { force: true })
    ]);
    if (await hasSession(tmux, sessionName)) {
        await execTmux(tmux, ["kill-session", "-t", sessionName]).catch(() => undefined);
    }
    await execTmux(tmux, [
        "new-session",
        "-d",
        "-s",
        sessionName,
        "-c",
        runOptions.cwd,
        "-x",
        String(DEFAULT_COLS),
        "-y",
        String(DEFAULT_ROWS)
    ]);
    const panePid = await paneProcessId(tmux, sessionName);
    const commandLine = formatCommandLine(command, args);
    const header = [
        `\x1b[90m# Agent Bridge tmux terminal\x1b[0m`,
        `\x1b[90m# run: ${attachOptions.runId}\x1b[0m`,
        `\x1b[90m# agent: ${attachOptions.agent.label}\x1b[0m`,
        `\x1b[90m# cwd: ${attachOptions.cwd}\x1b[0m`,
        `\x1b[90m# tmux: ${sessionName}\x1b[0m`,
        `\x1b[90m# pane pid: ${panePid}\x1b[0m`,
        `\x1b[90m$ ${commandLine}\x1b[0m`,
        ""
    ].join("\r\n");
    await writeTerminalLog(session.logPath, header);
    await execTmux(tmux, ["pipe-pane", "-o", "-t", sessionName, `cat >> ${shellQuote([session.logPath])}`]);
    ensureTerminalLogTail(session.terminalId, session.logPath, true);
    publishTerminalEvent(session.terminalId, { type: "start", data: header, pid: panePid });
    attachOptions.onStart?.({
        pid: panePid,
        command,
        args,
        cwd: runOptions.cwd
    }, session);
    await writeCommandScript(scriptPath, {
        command,
        args,
        inputPath,
        exitPath,
        donePath,
        env: runOptions.env
    });
    await execTmux(tmux, ["send-keys", "-t", sessionName, "-l", `sh ${shellQuote([scriptPath])}`]);
    await execTmux(tmux, ["send-keys", "-t", sessionName, "C-m"]);
    try {
        await waitForCommandDone(donePath, session.logPath, runOptions.timeout);
    }
    catch (error) {
        await execTmux(tmux, ["send-keys", "-t", sessionName, "C-c"]).catch(() => undefined);
        const output = await readFile(session.logPath, "utf8").catch(() => "");
        const footer = error instanceof KnownFatalOutputError
            ? `\r\n\x1b[90m# process interrupted after ${error.kind} output\x1b[0m\r\n`
            : `\r\n\x1b[90m# process timed out after ${runOptions.timeout} ms\x1b[0m\r\n`;
        await appendTerminalLog(session.logPath, footer);
        publishTerminalEvent(session.terminalId, { type: "close", data: footer, code: null });
        const message = error instanceof Error ? error.message : String(error);
        const timeout = new Error(`${message}\n\nTerminal tail:\n${output.slice(-2000)}`);
        timeout.stdout = output;
        timeout.stderr = "";
        timeout.code = null;
        throw timeout;
    }
    await delay(200);
    const output = await readFile(session.logPath, "utf8").catch(() => "");
    const code = Number.parseInt((await readFile(exitPath, "utf8").catch(() => "1")).trim(), 10);
    const exitCode = Number.isInteger(code) ? code : 1;
    const footer = `\r\n\x1b[90m# process exited with code ${exitCode}\x1b[0m\r\n`;
    await appendTerminalLog(session.logPath, footer);
    publishTerminalEvent(session.terminalId, { type: "close", data: footer, code: exitCode });
    const result = {
        stdout: output,
        stderr: ""
    };
    if (exitCode === 0) {
        return result;
    }
    const error = new Error(`Agent command exited with code ${exitCode}`);
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    error.code = exitCode;
    throw error;
}
async function writeCommandScript(scriptPath, options) {
    const command = shellQuote([
        ...envCommandPrefix(options.env),
        options.command,
        ...options.args
    ]);
    const script = [
        "#!/bin/sh",
        "set +e",
        `${command} < ${shellQuote([options.inputPath])}`,
        "agent_bridge_code=$?",
        "printf '\\r\\n\\033[90m# agent-bridge command exit code %s\\033[0m\\r\\n' \"$agent_bridge_code\"",
        `printf '%s\\n' "$agent_bridge_code" > ${shellQuote([options.exitPath])}`,
        `touch ${shellQuote([options.donePath])}`
    ].join("\n");
    await writeFile(scriptPath, script, "utf8");
    await chmod(scriptPath, 0o700);
}
function envCommandPrefix(env) {
    const selected = [
        "HOME",
        "PATH",
        "SHELL",
        "USER",
        "LOGNAME",
        "TMPDIR",
        "XDG_CONFIG_HOME",
        "XDG_STATE_HOME",
        BYPASS_ENV
    ];
    const values = selected
        .map((key) => [key, env[key]])
        .filter((entry) => typeof entry[1] === "string" && entry[1].length > 0);
    return values.length === 0
        ? []
        : ["env", ...values.map(([key, value]) => `${key}=${value}`)];
}
async function waitForCommandDone(donePath, logPath, timeout) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        if (await stat(donePath).then(() => true, () => false)) {
            return;
        }
        const output = await readFile(logPath, "utf8").catch(() => "");
        const knownError = detectKnownAgentError(output);
        if (knownError) {
            const line = firstKnownAgentErrorLine(output, knownError) ?? knownError.title("Agent");
            throw new KnownFatalOutputError(knownError.kind, line);
        }
        await delay(200);
    }
    throw new Error(`Agent command timed out after ${timeout} ms`);
}
async function paneProcessId(tmux, sessionName) {
    const output = await execTmux(tmux, ["display-message", "-p", "-t", sessionName, "#{pane_pid}"]);
    const pid = Number.parseInt(output.trim(), 10);
    return Number.isInteger(pid) ? pid : 0;
}
async function hasSession(tmux, sessionName) {
    const result = await execTmuxStatus(tmux, ["has-session", "-t", sessionName]);
    return result === 0;
}
async function execTmux(tmux, args, input) {
    const result = await spawnCollect(tmux, args, input);
    if (result.code === 0) {
        return result.stdout;
    }
    throw new Error(`tmux ${args[0] ?? ""} failed: ${result.stderr || result.stdout}`.trim());
}
async function execTmuxStatus(tmux, args) {
    const result = await spawnCollect(tmux, args);
    return result.code ?? 1;
}
function spawnCollect(command, args, input) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
        child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", (code) => resolve({
            code,
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: Buffer.concat(stderr).toString("utf8")
        }));
        child.stdin.end(input ?? "");
    });
}
//# sourceMappingURL=tmux.js.map