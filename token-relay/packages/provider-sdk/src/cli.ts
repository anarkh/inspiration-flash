#!/usr/bin/env node
import {
  defaultProviderConfigPath,
  loadProviderConfig
} from "./config.ts";
import { ProviderClient } from "./client.ts";
import {
  doctorProvider,
  formatDoctorReport
} from "./doctor.ts";
import { consoleProviderLogger } from "./logger.ts";
import { PROVIDER_SDK_VERSION } from "./version.ts";

async function main(args: string[]): Promise<void> {
  const command = args[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    process.stdout.write(`${PROVIDER_SDK_VERSION}\n`);
    return;
  }
  const configPath = valueAfter(args.slice(1), "--config")
    ?? defaultProviderConfigPath();
  if (command === "doctor") {
    const config = await loadProviderConfig(configPath);
    const report = await doctorProvider(config);
    process.stdout.write(`${formatDoctorReport(report)}\n`);
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "start") {
    const config = await loadProviderConfig(configPath);
    const client = new ProviderClient(config, {
      logger: consoleProviderLogger
    });
    await client.start();
    const status = client.getStatus();
    process.stdout.write(
      `Provider ${status.providerId ?? "unknown"} ready with ${status.models.length} model(s).\n`
    );
    await waitForShutdownSignal();
    await client.stop();
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

function valueAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

function waitForShutdownSignal(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      resolve();
    };
    process.on("SIGINT", finish);
    process.on("SIGTERM", finish);
  });
}

function printHelp(): void {
  process.stdout.write(`token-relay-provider

Usage:
  token-relay-provider doctor [--config <provider.config.json>]
  token-relay-provider start [--config <provider.config.json>]
  token-relay-provider version

Environment:
  TOKEN_RELAY_PROVIDER_CONFIG   Default config path
  TOKEN_RELAY_PROVIDER_TOKEN    Provider bearer token
  TOKEN_RELAY_URL               Relay ws/wss URL
  TOKEN_RELAY_DEBUG=1           Enable debug logging
`);
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
