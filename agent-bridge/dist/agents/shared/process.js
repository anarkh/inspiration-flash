import { spawn } from "node:child_process";
import { detectKnownAgentError, firstKnownAgentErrorLine } from "../../core/agent-errors.js";
export async function spawnWithInput(command, args, input, options) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ["pipe", "pipe", "pipe"]
        });
        if (child.pid) {
            options.capture?.onStart?.({
                pid: child.pid,
                command,
                args,
                cwd: options.cwd
            });
        }
        const stdout = [];
        const stderr = [];
        let timer = null;
        const rejectOnce = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            reject(error);
        };
        const resolveOnce = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timer) {
                clearTimeout(timer);
            }
            resolve(result);
        };
        const inspectFatalOutput = () => {
            if (settled) {
                return;
            }
            const stdoutText = Buffer.concat(stdout).toString("utf8");
            const stderrText = Buffer.concat(stderr).toString("utf8");
            const output = [stderrText, stdoutText].filter(Boolean).join("\n");
            const knownError = detectKnownAgentError(output);
            if (!knownError) {
                return;
            }
            const line = firstKnownAgentErrorLine(output, knownError) ?? knownError.title("Agent");
            child.kill("SIGTERM");
            rejectOnce(buildCommandError(`Agent command produced ${knownError.kind} output: ${line}`, stdout, stderr, null));
        };
        timer = setTimeout(() => {
            const error = buildCommandError(`Agent command timed out after ${options.timeout} ms`, stdout, stderr, null);
            child.kill("SIGTERM");
            rejectOnce(error);
        }, options.timeout);
        child.stdout.on("data", (chunk) => {
            const buffer = Buffer.from(chunk);
            stdout.push(buffer);
            options.capture?.onStdout?.(buffer);
            inspectFatalOutput();
        });
        child.stderr.on("data", (chunk) => {
            const buffer = Buffer.from(chunk);
            stderr.push(buffer);
            options.capture?.onStderr?.(buffer);
            inspectFatalOutput();
        });
        child.on("error", (error) => {
            rejectOnce(error);
        });
        child.on("close", (code) => {
            options.capture?.onClose?.(code);
            const result = {
                stdout: Buffer.concat(stdout).toString("utf8"),
                stderr: Buffer.concat(stderr).toString("utf8")
            };
            if (code === 0) {
                resolveOnce(result);
                return;
            }
            rejectOnce(buildCommandError(`Agent command exited with code ${code}`, stdout, stderr, code));
        });
        child.stdin.end(input);
    });
}
function buildCommandError(message, stdout, stderr, code) {
    const error = new Error(message);
    error.stdout = Buffer.concat(stdout).toString("utf8");
    error.stderr = Buffer.concat(stderr).toString("utf8");
    error.code = code;
    return error;
}
//# sourceMappingURL=process.js.map