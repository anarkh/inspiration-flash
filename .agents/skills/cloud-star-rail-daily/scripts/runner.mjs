#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SKILL_DIR = path.resolve(new URL("..", import.meta.url).pathname);
const CONFIG_PATH = path.join(SKILL_DIR, "config.local.json");
const EXAMPLE_CONFIG_PATH = path.join(SKILL_DIR, "config.local.example.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadConfig() {
  return readJsonIfExists(CONFIG_PATH) || readJsonIfExists(EXAMPLE_CONFIG_PATH) || {};
}

function parseArgs(argv) {
  const args = {
    mode: "claim-only",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mode") {
      args.mode = argv[++i];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`cloud-star-rail-daily runner

Usage:
  node scripts/runner.mjs --mode claim-only --dry-run
  node scripts/runner.mjs --mode resource-spending --dry-run

This is a conservative runner skeleton. Real browser clicks require calibrated
Visual Checkpoints and Codex in-app browser control from the skill workflow.`);
}

function buildPlan(mode, config) {
  const fallback = config.fallback_farming_target;

  const shared = [
    "Open Cloud Honkai: Star Rail in the in-app browser",
    "Enter Login Handoff if no login session exists",
    "Wait for Manual Resume after user login",
    "Close only Known Dismissible Popups",
  ];

  if (mode === "claim-only") {
    return [
      ...shared,
      "Claim available daily rewards",
      "Skip resource spending",
      "Emit Run Report",
      "Perform Browser Close Exit",
    ];
  }

  if (mode === "resource-spending") {
    return [
      ...shared,
      "Open Survival Index",
      "Open Training Target",
      "Use Recommended Relic Cavern when present",
      fallback
        ? `Fallback target if needed: ${fallback.name}, Run Count ${fallback.run_count}`
        : "Safe Pause if no Training Target exists and no fallback is configured",
      "Compute Affordable Run Count from visible Trailblaze Power",
      "Run only Affordable Run Count",
      "Claim battle and daily rewards",
      "Emit Run Report",
      "Perform Browser Close Exit",
    ];
  }

  throw new Error(`Unsupported mode: ${mode}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const plan = buildPlan(args.mode, config);

  console.log(JSON.stringify(
    {
      status: args.dryRun ? "dry_run" : "needs_browser_calibration",
      mode: args.mode,
      config_path: fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_CONFIG_PATH,
      plan,
      next_step: "Calibrate Visual Checkpoints in the Codex in-app browser before enabling real clicks.",
    },
    null,
    2
  ));

  if (!args.dryRun) {
    process.exitCode = 2;
  }
}

main();
