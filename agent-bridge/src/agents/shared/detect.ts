import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

const SHELL_DETECT_TIMEOUT_MS = 8_000;

export async function findExecutable(name: string, extraCandidates: string[]): Promise<string | null> {
  const candidates = [
    ...await userShellCandidates(name),
    ...pathCandidates(name),
    ...extraCandidates
  ];
  for (const candidate of unique(candidates)) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function pathCandidates(name: string): string[] {
  const entries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  return entries.map((entry) => join(entry, name));
}

async function userShellCandidates(name: string): Promise<string[]> {
  if (!/^[a-zA-Z0-9._+-]+$/.test(name)) {
    return [];
  }
  const shell = process.env.SHELL;
  if (!shell || !isAbsolute(shell)) {
    return [];
  }
  const output = await collectShellOutput(shell, ["-ilc", `command -v ${name}`]).catch(() => "");
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => isAbsolute(line));
}

function collectShellOutput(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve("");
    }, SHELL_DETECT_TIMEOUT_MS);
    child.stdout?.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
