import { existsSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const NPM_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function inspectNpmToolchain(environment = process.env) {
  const configuredPath = environment.npm_execpath ?? "";
  if (!configuredPath) {
    return { cliPath: null, version: null, error: "npm-execpath-unset" };
  }
  if (!existsSync(configuredPath)) {
    return { cliPath: null, version: null, error: "npm-execpath-not-found" };
  }

  let cliPath;
  try {
    cliPath = realpathSync(configuredPath);
    if (!statSync(cliPath).isFile()) {
      return { cliPath: null, version: null, error: "npm-execpath-not-file" };
    }
  } catch {
    return { cliPath: null, version: null, error: "npm-execpath-unreadable" };
  }

  const probe = spawnSync(process.execPath, [cliPath, "--version"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (probe.error || probe.signal || probe.status !== 0) {
    return { cliPath, version: null, error: "npm-version-probe-failed" };
  }

  const version = probe.stdout.trim();
  if (!NPM_VERSION_PATTERN.test(version)) {
    return { cliPath, version: null, error: "npm-version-unparseable" };
  }
  return { cliPath, version, error: null };
}
