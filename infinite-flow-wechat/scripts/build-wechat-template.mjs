import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
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
  attestAbsentOutputRoot,
  captureBuildSourceAttestation,
} from "./build-subject-attestation.mjs";
import {
  assertTemplateBuildCandidateContentUnchanged,
  assertTemplateBuildCandidateUnchanged,
  captureTemplateBuildCandidate,
} from "./template-build-candidate.mjs";
import {
  WechatBuildContractError,
  resolveWechatBuildOutputRoot,
  verifyWechatBuildConfig,
  verifyWechatBuildConfigFile,
} from "./verify-wechat-build-config.mjs";
import { verifyWechatBuildOutput } from "./verify-wechat-build-output.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(projectRoot, "..");
const profilePath = resolve(projectRoot, "toolchain/wechat-bundle-profiles.json");
const lockPath = resolve(projectRoot, "toolchain/cocos-toolchain.lock.json");

function reject(code) {
  throw new ToolchainBoundaryError(code);
}

function parseStableJson(path, code) {
  const capture = captureStableFile(path, { includeContent: true });
  let value;
  try {
    value = JSON.parse(capture.content.toString("utf8"));
  } catch {
    reject(code);
  }
  return Object.freeze({ capture, value });
}

function requireRegularFile(path, code) {
  if (typeof path !== "string" || path.length === 0 || !existsSync(path)) {
    reject(code);
  }
  return path;
}

function assertRunnerEnvironment(environment) {
  if (process.execArgv.length !== 0) reject("template-runner-node-flags-forbidden");
  for (const name of Object.keys(environment)) {
    if (
      [
        "ELECTRON_RUN_AS_NODE",
        "NODE_OPTIONS",
        "NODE_PATH",
        "NODE_REPL_EXTERNAL_MODULE",
      ].includes(name)
      || name.startsWith("DYLD_")
      || name.startsWith("LD_")
      || name.startsWith("__XPC_DYLD_")
    ) {
      reject("template-runner-injection-environment-forbidden");
    }
  }
}

function preflightEnvironment(environment) {
  const clean = { ...environment };
  delete clean.COCOS_CREATOR_BIN;
  delete clean.COCOS_WECHAT_BUILD_CONFIG;
  return clean;
}

function runPreflight(label, executable, args, environment) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: preflightEnvironment(environment),
    stdio: "inherit",
  });
  if (result.error || result.signal || result.status !== 0) {
    reject(`template-preflight-${label}-failed`);
  }
}

export function assertTemplateNonReleaseEligibility(value, label = "template") {
  if (
    value?.gate !== "template"
    || value?.mode !== "remote"
    || value?.releaseEligible !== false
    || value?.nonRelease !== true
  ) {
    throw new WechatBuildContractError("template-eligibility-invalid", [
      `${label}:template-remote-non-release-required`,
    ]);
  }
  return value;
}

function assertTemplateVerificationUnchanged(expected, current) {
  assertBuildConfigVerificationUnchanged(expected, current);
  assertTemplateNonReleaseEligibility(current, "config");
  for (const field of ["gate", "nonRelease", "releaseEligible"]) {
    if (expected[field] !== current[field]) {
      reject(`template-build-config-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-drift`);
    }
  }
  return current;
}

function assertExpectedOutputRoot(outputRoot, cocosProject) {
  const expected = resolve(cocosProject, "build/wechatgame");
  const fromProject = relative(cocosProject, outputRoot);
  if (
    outputRoot !== expected
    || fromProject === ".."
    || fromProject.startsWith(`..${sep}`)
    || isAbsolute(fromProject)
  ) {
    reject("template-build-output-root-unexpected");
  }
  return outputRoot;
}

export function createTemplateBuildSuccessSummary({
  creatorVersion,
  candidate,
  postBuildCandidate,
  configVerification,
  outputVerification,
}) {
  assertTemplateNonReleaseEligibility(configVerification, "config");
  assertTemplateNonReleaseEligibility(outputVerification, "output");
  return Object.freeze({
    ok: true,
    label: "NON_RELEASE_TEMPLATE_BUILD_VALID",
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
    creatorVersion,
    candidate: Object.freeze({
      head: candidate.head,
      tree: candidate.tree,
      statusSha256: candidate.statusSha256,
      entryCount: candidate.entryCount,
      fileCount: candidate.fileCount,
      absentCount: candidate.absentCount,
      totalBytes: candidate.totalBytes,
      contentTreeSha256: candidate.contentTreeSha256,
      identityTreeSha256: candidate.identityTreeSha256,
      postBuildIdentityTreeSha256: postBuildCandidate.identityTreeSha256,
      identityStable:
        candidate.identityTreeSha256 === postBuildCandidate.identityTreeSha256,
    }),
    configSha256: configVerification.configSha256,
    profileSha256: configVerification.profileSha256,
    tracedAssets: outputVerification.tracedAssets,
    packageBytes: outputVerification.packageBytes,
    bundleBytes: outputVerification.bundleBytes,
    treeSha256: outputVerification.treeSha256,
    packageSha256: outputVerification.packageSha256,
    bundleTreeSha256: outputVerification.bundleTreeSha256,
  });
}

export function runWechatTemplateBuild({
  environment = process.env,
  runPreflightStep = runPreflight,
  spawnCreator = spawnAttestedCreatorBuild,
} = {}) {
  assertRunnerEnvironment(environment);
  const creatorBin = requireRegularFile(
    environment.COCOS_CREATOR_BIN,
    "template-creator-executable-missing",
  );
  const configPath = requireRegularFile(
    environment.COCOS_WECHAT_BUILD_CONFIG,
    "template-build-config-missing",
  );
  const stableLock = parseStableJson(lockPath, "template-toolchain-lock-invalid");
  const lock = stableLock.value;
  const npmToolchain = inspectNpmToolchain(environment);
  if (
    !npmToolchain.cliPath
    || npmToolchain.version !== lock.local?.npmVersion
  ) {
    reject("template-npm-toolchain-unattested");
  }
  const npmAttestation = captureStableFile(npmToolchain.cliPath);
  const nodeAttestation = captureStableFile(process.execPath, {
    requireExecutable: true,
  });

  runPreflightStep(
    "repository-verification",
    process.execPath,
    [npmToolchain.cliPath, "run", "verify"],
    environment,
  );
  runPreflightStep(
    "creator-declaration-typecheck",
    process.execPath,
    [
      npmToolchain.cliPath,
      "run",
      "typecheck:creator",
      "-w",
      "infinite-flow-wechat-cocos",
    ],
    environment,
  );

  const cocosProject = realpathSync.native(resolve(projectRoot, "cocos"));
  const stableCocosPackage = parseStableJson(
    resolve(cocosProject, "package.json"),
    "template-cocos-package-invalid",
  );
  if (stableCocosPackage.value.creator?.version !== lock.production.creatorVersion) {
    reject("template-cocos-version-declaration-mismatch");
  }
  const creatorAttestation = attestCreatorExecutable(
    creatorBin,
    lock.production.creatorVersion,
  );
  const sourceVerification = assertTemplateNonReleaseEligibility(
    verifyWechatBuildConfigFile(configPath, {
      gate: "template",
      expectedMode: "remote",
    }),
    "config",
  );
  const profileAttestation = captureStableFile(profilePath);
  if (profileAttestation.sha256 !== sourceVerification.profileSha256) {
    reject("template-build-profile-verification-drift");
  }

  let configSnapshot;
  let result;
  let outputVerification;
  let candidate;
  let postBuildCandidate;
  try {
    configSnapshot = createBuildConfigSnapshot(configPath);
    if (configSnapshot.sourceAttestation.sha256 !== sourceVerification.configSha256) {
      reject("template-build-config-snapshot-drift");
    }
    const buildConfig = configSnapshot.parsedConfig;
    assertTemplateNonReleaseEligibility(verifyWechatBuildConfig(buildConfig, {
      gate: "template",
      expectedMode: "remote",
      profile: sourceVerification.profile,
    }), "snapshot");
    const sourceAttestation = captureBuildSourceAttestation({
      projectRoot,
      profile: sourceVerification.profile,
    });
    candidate = captureTemplateBuildCandidate({
      repositoryRoot,
      projectRoot,
    });
    const outputRoot = assertExpectedOutputRoot(
      resolveWechatBuildOutputRoot(buildConfig, cocosProject),
      cocosProject,
    );
    let outputFreshness = attestAbsentOutputRoot(outputRoot);

    const assertBuildSubjectUnchanged = ({ requireCandidateIdentity }) => {
      assertStableFileUnchanged(stableLock.capture);
      assertStableFileUnchanged(stableCocosPackage.capture);
      assertStableFileUnchanged(nodeAttestation, { requireExecutable: true });
      assertStableFileUnchanged(npmAttestation);
      assertBuildConfigSnapshotUnchanged(configSnapshot);
      assertCreatorExecutableUnchanged(creatorAttestation);
      assertStableFileUnchanged(profileAttestation);
      assertStableFileUnchanged(configSnapshot.sourceAttestation);
      const currentVerification = assertTemplateVerificationUnchanged(
        sourceVerification,
        verifyWechatBuildConfigFile(configPath, {
          gate: "template",
          expectedMode: "remote",
        }),
      );
      assertBuildSourceUnchanged(sourceAttestation, captureBuildSourceAttestation({
        projectRoot,
        profile: currentVerification.profile,
      }));
      const currentCandidate = captureTemplateBuildCandidate({
        repositoryRoot,
        projectRoot,
      });
      if (requireCandidateIdentity) {
        assertTemplateBuildCandidateUnchanged(candidate, currentCandidate);
      } else {
        assertTemplateBuildCandidateContentUnchanged(candidate, currentCandidate);
        postBuildCandidate = currentCandidate;
      }
      assertStableFileUnchanged(stableLock.capture);
      assertStableFileUnchanged(stableCocosPackage.capture);
      assertBuildConfigSnapshotUnchanged(configSnapshot);
      assertCreatorExecutableUnchanged(creatorAttestation);
    };

    assertBuildSubjectUnchanged({ requireCandidateIdentity: true });
    outputFreshness = attestAbsentOutputRoot(outputRoot);
    result = spawnCreator({
      creatorAttestation,
      configSnapshot,
      cocosProject,
      platform: lock.production.platform,
      cwd: projectRoot,
      launcherSourceSha256: lock.production.macosBoundLauncherSourceSha256,
      suppressOutput: true,
    });
    if (!result.error && result.status === lock.production.successExitCode) {
      assertBuildSubjectUnchanged({ requireCandidateIdentity: false });
      const freshOutput = assertFreshBuildOutput({
        attestation: outputFreshness,
        result,
        successExitCode: lock.production.successExitCode,
      });
      const verified = assertTemplateNonReleaseEligibility(
        verifyWechatBuildOutput({
          config: buildConfig,
          gate: "template",
          expectedMode: "remote",
          profile: sourceVerification.profile,
          outputRoot: freshOutput.outputRoot,
        }),
        "output",
      );
      assertBuildSubjectUnchanged({ requireCandidateIdentity: false });
      outputVerification = verified;
    }
  } finally {
    if (configSnapshot) disposeBuildConfigSnapshot(configSnapshot);
  }

  if (result?.error || result?.status !== lock.production.successExitCode) {
    reject("template-creator-build-unsuccessful");
  }
  if (!outputVerification || !candidate || !postBuildCandidate) {
    reject("template-output-unverified");
  }
  return createTemplateBuildSuccessSummary({
    creatorVersion: lock.production.creatorVersion,
    candidate,
    postBuildCandidate,
    configVerification: sourceVerification,
    outputVerification,
  });
}

function isMainModule() {
  return Boolean(process.argv[1])
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    console.log(JSON.stringify(runWechatTemplateBuild(), null, 2));
  } catch (error) {
    const code = error instanceof ToolchainBoundaryError
      || error instanceof WechatBuildContractError
      ? error.code
      : "template-build-boundary-failed";
    console.error(JSON.stringify({ ok: false, code }, null, 2));
    process.exitCode = 1;
  }
}
