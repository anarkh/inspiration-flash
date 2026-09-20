import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { spawnAttestedCreatorBuild } from "./attested-creator-build.mjs";
import {
  assertBuildConfigSnapshotUnchanged,
  createBuildConfigSnapshot,
  disposeBuildConfigSnapshot,
} from "./build-config-snapshot.mjs";
import {
  assertCreatorExecutableUnchanged,
  attestCreatorExecutable,
} from "./cocos-creator-version.mjs";
import {
  ToolchainBoundaryError,
  assertStableFileUnchanged,
  captureStableFile,
} from "./file-attestation.mjs";
import { inspectNpmToolchain } from "./npm-toolchain.mjs";
import {
  assertBuildConfigVerificationUnchanged,
  assertBuildSourceUnchanged,
  assertFreshBuildOutput,
  assertGitCandidateUnchanged,
  attestAbsentOutputRoot,
  captureBuildSourceAttestation,
  captureGitCandidate,
} from "./build-subject-attestation.mjs";
import {
  WechatBuildContractError,
  resolveWechatBuildOutputRoot,
  verifyWechatBuildConfig,
  verifyWechatBuildConfigFile,
} from "./verify-wechat-build-config.mjs";
import { verifyWechatBuildOutput } from "./verify-wechat-build-output.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  readFileSync(resolve(projectRoot, "toolchain/cocos-toolchain.lock.json"), "utf8"),
);
const creatorBin = process.env.COCOS_CREATOR_BIN;
const configPath = process.env.COCOS_WECHAT_BUILD_CONFIG;
const cocosProject = realpathSync(resolve(projectRoot, "cocos"));
const npmToolchain = inspectNpmToolchain();
const npmExecutable = npmToolchain.cliPath;

function requireFile(label, path) {
  if (!path || !existsSync(path)) {
    console.error(`${label} is missing: ${path ?? "(unset)"}`);
    process.exit(2);
  }
}

requireFile("COCOS_CREATOR_BIN", creatorBin);
requireFile("COCOS_WECHAT_BUILD_CONFIG", configPath);
const cocosPackagePath = resolve(cocosProject, "package.json");
requireFile("Cocos project package.json", cocosPackagePath);

if (
  !npmExecutable
  || npmToolchain.version !== lock.local.npmVersion
) {
  console.error(
    `Run this build through npm ${lock.local.npmVersion}; runner attestation failed `
      + `(${npmToolchain.error ?? npmToolchain.version ?? "unknown"}).`,
  );
  process.exit(2);
}

function runPreflight(label, executable, args) {
  console.log(`Running ${label}...`);
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${String(result.status)}.`);
    process.exit(result.status ?? 1);
  }
}

runPreflight(
  "production toolchain attestation",
  process.execPath,
  [resolve(projectRoot, "scripts/check-toolchain.mjs"), "--require-production"],
);
runPreflight(
  "repository verification",
  process.execPath,
  [npmExecutable, "run", "verify"],
);
runPreflight(
  "Creator declaration typecheck",
  process.execPath,
  [npmExecutable, "run", "typecheck:creator", "-w", "infinite-flow-wechat-cocos"],
);

let cocosPackage;
try {
  cocosPackage = JSON.parse(readFileSync(cocosPackagePath, "utf8"));
} catch {
  console.error("Cocos project package.json must be valid JSON.");
  process.exit(2);
}
if (cocosPackage.creator?.version !== lock.production.creatorVersion) {
  console.error(
    `Cocos project declaration must remain ${lock.production.creatorVersion}.`,
  );
  process.exit(2);
}

let configSnapshot;
let result;
let outputVerification;
let candidate;
let boundaryFailed = false;
try {
  // Production output is meaningful only for a committed, clean repository
  // subject. Capture the whole repository status, including every untracked
  // path, after preflight commands have finished and before Creator can run.
  candidate = captureGitCandidate(projectRoot, { requireClean: true });
  const creatorAttestation = attestCreatorExecutable(
    creatorBin,
    lock.production.creatorVersion,
  );
  // Verify the source before snapshotting, then bind that decision to the
  // anonymous read-only descriptor by comparing the two stable captures.
  const sourceVerification = verifyWechatBuildConfigFile(configPath, {
    gate: "production",
    expectedMode: "remote",
  });
  const profileAttestation = captureStableFile(resolve(
    projectRoot,
    "toolchain/wechat-bundle-profiles.json",
  ));
  if (profileAttestation.sha256 !== sourceVerification.profileSha256) {
    throw new ToolchainBoundaryError(
      "build-profile-drift-after-production-verification",
    );
  }
  configSnapshot = createBuildConfigSnapshot(configPath);
  if (
    configSnapshot.sourceAttestation.sha256
    !== sourceVerification.configSha256
  ) {
    throw new ToolchainBoundaryError(
      "build-config-drift-after-production-verification",
    );
  }
  const buildConfig = configSnapshot.parsedConfig;
  verifyWechatBuildConfig(buildConfig, {
    gate: "production",
    expectedMode: "remote",
    profile: sourceVerification.profile,
  });
  const sourceAttestation = captureBuildSourceAttestation({
    projectRoot,
    profile: sourceVerification.profile,
  });
  const outputRoot = resolveWechatBuildOutputRoot(buildConfig, cocosProject);
  let outputFreshness = attestAbsentOutputRoot(outputRoot);

  const assertBuildSubjectUnchanged = () => {
    assertBuildConfigSnapshotUnchanged(configSnapshot);
    assertCreatorExecutableUnchanged(creatorAttestation);
    assertStableFileUnchanged(profileAttestation);
    assertStableFileUnchanged(configSnapshot.sourceAttestation);
    assertGitCandidateUnchanged(
      candidate,
      captureGitCandidate(projectRoot, { requireClean: false }),
    );
    const currentVerification = verifyWechatBuildConfigFile(configPath, {
      gate: "production",
      expectedMode: "remote",
    });
    assertBuildConfigVerificationUnchanged(
      sourceVerification,
      currentVerification,
    );
    assertBuildSourceUnchanged(
      sourceAttestation,
      captureBuildSourceAttestation({
        projectRoot,
        profile: currentVerification.profile,
      }),
    );
    assertStableFileUnchanged(profileAttestation);
    assertStableFileUnchanged(configSnapshot.sourceAttestation);
    assertBuildConfigSnapshotUnchanged(configSnapshot);
    assertCreatorExecutableUnchanged(creatorAttestation);
    assertGitCandidateUnchanged(
      candidate,
      captureGitCandidate(projectRoot, { requireClean: false }),
    );
  };

  // Close the pre-spawn capture window across tracked source, ignored dist,
  // assets, profile, Creator and both forms of the config. The retained
  // executable and anonymous FD are asserted once more inside the launcher.
  assertBuildSubjectUnchanged();
  outputFreshness = attestAbsentOutputRoot(outputRoot);

  result = spawnAttestedCreatorBuild({
    creatorAttestation,
    configSnapshot,
    cocosProject,
    platform: lock.production.platform,
    cwd: projectRoot,
    launcherSourceSha256: lock.production.macosBoundLauncherSourceSha256,
  });
  if (!result.error && result.status === lock.production.successExitCode) {
    // Exit 36 is only Creator's protocol-level success. Re-bind every input
    // and require this exact output leaf to have transitioned absent -> real
    // directory before the existing output contract may inspect it.
    assertBuildSubjectUnchanged();
    const freshOutput = assertFreshBuildOutput({
      attestation: outputFreshness,
      result,
      successExitCode: lock.production.successExitCode,
    });
    const verifiedOutput = verifyWechatBuildOutput({
      config: buildConfig,
      gate: "production",
      expectedMode: "remote",
      profile: sourceVerification.profile,
      outputRoot: freshOutput.outputRoot,
    });
    // The output verifier reads both build output and source traces. Seal its
    // observation window before the success object becomes printable.
    assertBuildSubjectUnchanged();
    outputVerification = verifiedOutput;
  }
} catch (error) {
  boundaryFailed = true;
  const code = error instanceof ToolchainBoundaryError
    ? error.code
    : error instanceof WechatBuildContractError
      ? error.code
      : "attested-build-boundary-failed";
  console.error(`Creator build boundary rejected: ${code}.`);
  process.exitCode = 1;
} finally {
  if (configSnapshot) {
    try {
      disposeBuildConfigSnapshot(configSnapshot);
    } catch {
      boundaryFailed = true;
      console.error("Creator build config snapshot cleanup was rejected.");
      process.exitCode = 1;
    }
  }
}

if (boundaryFailed || !result) {
  process.exitCode = process.exitCode || 1;
} else if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else if (
  result.status === lock.production.successExitCode
  && outputVerification
) {
  console.log(JSON.stringify({
    ok: true,
    message: "Cocos Creator build and WeChat remote-bundle output verification succeeded.",
    candidate: {
      head: candidate.head,
      tree: candidate.tree,
      clean: candidate.clean,
      statusSha256: candidate.statusSha256,
    },
    mode: outputVerification.mode,
    tracedAssets: outputVerification.tracedAssets,
    packageBytes: outputVerification.packageBytes,
    bundleBytes: outputVerification.bundleBytes,
    treeSha256: outputVerification.treeSha256,
    packageSha256: outputVerification.packageSha256,
    bundleTreeSha256: outputVerification.bundleTreeSha256,
  }, null, 2));
  process.exitCode = 0;
} else {
  console.error(`Cocos Creator build exited with code ${String(result.status)}.`);
  process.exitCode = result.status ?? 1;
}
