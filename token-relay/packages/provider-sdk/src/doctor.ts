import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import type {
  DoctorCheck,
  DoctorReport,
  ProcessEnvironment,
  ResolvedProviderConfig
} from "./types.ts";

export async function doctorProvider(
  config: ResolvedProviderConfig,
  env: ProcessEnvironment = process.env
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [{
    name: "config",
    status: "ok",
    message: `${Object.keys(config.models).length} model(s), concurrency ${config.concurrency}.`
  }, {
    name: "relay",
    status: config.relayUrl.startsWith("wss://") ? "ok" : "warning",
    message: config.relayUrl.startsWith("wss://")
      ? `Secure relay endpoint ${redactUrl(config.relayUrl)}.`
      : `Relay endpoint ${redactUrl(config.relayUrl)} is not TLS protected.`
  }];

  const commandResults = new Map<string, string | null>();
  for (const [model, target] of Object.entries(config.models)) {
    const command = target.command ?? (target.adapter === "claude" ? "claude" : target.adapter);
    let resolved = commandResults.get(command);
    if (resolved === undefined) {
      resolved = await findExecutable(command, env);
      commandResults.set(command, resolved);
    }
    checks.push({
      name: `model:${model}`,
      status: resolved ? "ok" : "error",
      message: resolved
        ? `${target.adapter} -> ${resolved}`
        : `Executable ${JSON.stringify(command)} was not found or is not executable.`
    });
    if (target.adapter === "custom") {
      checks.push({
        name: `sandbox:${model}`,
        status: "warning",
        message: "Custom adapters must enforce their own read-only sandbox."
      });
    }
  }

  return {
    ok: checks.every((check) => check.status !== "error"),
    checks
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const symbol = {
    ok: "OK",
    warning: "WARN",
    error: "ERROR"
  } as const;
  return [
    "Token Relay provider doctor",
    ...report.checks.map((check) => (
      `[${symbol[check.status]}] ${check.name}: ${check.message}`
    )),
    report.ok ? "Doctor completed successfully." : "Doctor found blocking errors."
  ].join("\n");
}

async function findExecutable(
  command: string,
  env: ProcessEnvironment
): Promise<string | null> {
  const candidates = isAbsolute(command)
    ? [command]
    : (env.PATH ?? "")
        .split(delimiter)
        .filter(Boolean)
        .map((entry) => join(entry, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue looking through PATH.
    }
  }
  return null;
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    return url.toString();
  } catch {
    return "[invalid URL]";
  }
}
