import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { creatorVersionMatches } from "./cocos-creator-version.mjs";
import { inspectNpmToolchain } from "./npm-toolchain.mjs";
import { attestMacosBoundLauncherSource } from "./macos-bound-launcher.mjs";
import { inspectWechatBuildConfigFile } from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  readFileSync(resolve(projectRoot, "toolchain/cocos-toolchain.lock.json"), "utf8"),
);
const requireProduction = process.argv.includes("--require-production");
const verbose = process.argv.includes("--verbose");
const creatorBin = process.env.COCOS_CREATOR_BIN ?? "";
const buildConfig = process.env.COCOS_WECHAT_BUILD_CONFIG ?? "";
const cocosProjectPackage = resolve(projectRoot, "cocos/package.json");
const cliHome = process.env.COCOS_CLI_HOME
  ?? resolve(homedir(), ".local/share/cocos-cli");
const cliExecutable = resolve(cliHome, "dist/cli.js");

function inspectBuildConfig(path) {
  if (!path || !existsSync(path)) {
    return {
      present: false,
      validWechatTarget: false,
      productionValid: false,
      attested: false,
      error: null,
    };
  }
  const inspection = inspectWechatBuildConfigFile(path, {
    gate: "production",
    expectedMode: "remote",
  });
  return {
    ...inspection,
    canonicalPath: verbose ? inspection.canonicalPath : undefined,
    sha256: verbose ? inspection.sha256 : undefined,
    failures: verbose ? inspection.failures : undefined,
  };
}

function declaredCreatorVersion(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8")).creator?.version ?? null;
  } catch {
    return null;
  }
}

function installedPackageVersion(packageName) {
  try {
    return JSON.parse(
      readFileSync(resolve(projectRoot, "node_modules", packageName, "package.json"), "utf8"),
    ).version ?? null;
  } catch {
    return null;
  }
}

function gitHead(path) {
  if (!existsSync(path)) return null;
  const result = spawnSync("git", ["-C", path, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function cliVersion(path) {
  if (!existsSync(path)) return null;
  const result = spawnSync(process.execPath, [path, "--version"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

const actualCliHead = gitHead(cliHome);
const actualCliVersion = cliVersion(cliExecutable);
const npmToolchain = inspectNpmToolchain();
const creatorVersion = requireProduction
  ? creatorVersionMatches(creatorBin, lock.production.creatorVersion)
  : {
      version: null,
      source: null,
      error: creatorBin ? "version-check-deferred" : "executable-unset",
      matches: false,
    };
const projectCreatorVersion = declaredCreatorVersion(cocosProjectPackage);
const configInspection = inspectBuildConfig(buildConfig);
const boundLauncherInspection = attestMacosBoundLauncherSource(
  lock.production.macosBoundLauncherSourceSha256,
);
const actualTypescriptVersion = installedPackageVersion("typescript");
const report = {
  local: {
    node: {
      expectedVersion: lock.local.nodeVersion,
      actualVersion: process.versions.node,
      pinned: process.versions.node === lock.local.nodeVersion,
    },
    npm: {
      expectedVersion: lock.local.npmVersion,
      actualVersion: npmToolchain.version,
      pinned: npmToolchain.version === lock.local.npmVersion,
      runnerError: npmToolchain.error,
      runnerPath: verbose ? npmToolchain.cliPath : undefined,
    },
    typescript: {
      expectedVersion: lock.local.typescriptVersion,
      actualVersion: actualTypescriptVersion,
      pinned: actualTypescriptVersion === lock.local.typescriptVersion,
    },
  },
  creator: {
    expectedVersion: lock.production.creatorVersion,
    executableConfigured: creatorBin.length > 0,
    executableName: creatorBin ? basename(creatorBin) : null,
    executable: verbose ? creatorBin || null : undefined,
    executablePresent: creatorBin.length > 0 && existsSync(creatorBin),
    executableAttested: creatorVersion.attested ?? false,
    canonicalExecutable: verbose ? creatorVersion.canonicalPath : undefined,
    executableSha256: verbose ? creatorVersion.sha256 : undefined,
    actualVersion: creatorVersion.version,
    versionSource: creatorVersion.source,
    versionError: creatorVersion.error,
    versionPinned: creatorVersion.matches,
    projectDeclaredVersion: projectCreatorVersion,
    projectVersionPinned: projectCreatorVersion === lock.production.creatorVersion,
  },
  macosBoundLauncher: {
    sourcePinned: boundLauncherInspection.pinned,
    sourceSha256: verbose ? boundLauncherInspection.sha256 : undefined,
  },
  wechatBuildConfig: {
    configured: buildConfig.length > 0,
    fileName: buildConfig ? basename(buildConfig) : null,
    path: verbose ? buildConfig || null : undefined,
    ...configInspection,
  },
  probeCli: {
    path: verbose ? cliHome : undefined,
    executable: verbose ? cliExecutable : undefined,
    executablePresent: existsSync(cliExecutable),
    expectedCommit: lock.probeCli.commit,
    actualCommit: actualCliHead,
    pinned: actualCliHead === lock.probeCli.commit,
    expectedVersion: lock.probeCli.version,
    actualVersion: actualCliVersion,
    built: actualCliVersion === lock.probeCli.version,
    productionWechatBuildSupported: false,
  },
};

console.log(JSON.stringify(report, null, 2));

if (
  !report.local.node.pinned
  || !report.local.npm.pinned
  || !report.local.typescript.pinned
  || !report.macosBoundLauncher.sourcePinned
) {
  console.error(
    `Local toolchain mismatch: expected Node ${lock.local.nodeVersion} / npm `
      + `${lock.local.npmVersion} / TypeScript ${lock.local.typescriptVersion}.`,
  );
  process.exitCode = 1;
}

if (requireProduction && (
  !report.creator.executablePresent
  || !report.creator.executableAttested
  || !report.creator.versionPinned
  || !report.creator.projectVersionPinned
  || !report.wechatBuildConfig.present
  || !report.wechatBuildConfig.attested
  || !report.wechatBuildConfig.productionValid
)) {
  console.error(
    `Production toolchain is incomplete: require Cocos Creator `
      + `${lock.production.creatorVersion} and a production-verified remote-bundle config.`,
  );
  process.exitCode = 1;
}
