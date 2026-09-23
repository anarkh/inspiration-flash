import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnAttestedCreatorBuild } from "./attested-creator-build.mjs";
import {
  assertBuildConfigSnapshotUnchanged,
  createBuildConfigSnapshot,
  disposeBuildConfigSnapshot,
} from "./build-config-snapshot.mjs";
import {
  assertCreatorExecutableUnchanged,
  attestCreatorExecutable,
  creatorVersionMatches,
  detectCreatorVersion,
} from "./cocos-creator-version.mjs";
import {
  ToolchainBoundaryError,
  assertStableFileUnchanged,
  captureStableDescriptor,
  captureStableFile,
} from "./file-attestation.mjs";
import {
  attestMacosBoundLauncherSource,
  resolveTrustedMacosCompiler,
  resolveTrustedMacosSdk,
} from "./macos-bound-launcher.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  readFileSync(resolve(projectRoot, "toolchain/cocos-toolchain.lock.json"), "utf8"),
);
const launcherSourceSha256 = lock.production.macosBoundLauncherSourceSha256;
const fixtureRoot = mkdtempSync(join(tmpdir(), "infinite-flow-toolchain-contract-"));
let assertionCount = 0;

function equal(actual, expected) {
  assert.equal(actual, expected);
  assertionCount += 1;
}

function deepEqual(actual, expected) {
  assert.deepEqual(actual, expected);
  assertionCount += 1;
}

function boundaryError(action, acceptedCodes) {
  assert.throws(action, (error) => {
    return error instanceof ToolchainBoundaryError
      && acceptedCodes.includes(error.code);
  });
  assertionCount += 1;
}

function writeCreatorPlist(contents) {
  const plist = join(contents, "Info.plist");
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleShortVersionString</key><string>3.8.8</string>
</dict></plist>`,
  );
  return plist;
}

function makeCreatorApp(name, script = "#!/bin/sh\nexit 36\n") {
  const contents = join(fixtureRoot, `${name}.app`, "Contents");
  const executable = join(contents, "MacOS", "CocosCreator");
  mkdirSync(join(contents, "MacOS"), { recursive: true });
  writeFileSync(executable, script);
  chmodSync(executable, 0o755);
  return { executable, plist: writeCreatorPlist(contents) };
}

function creatorFixtureSource(executionMarkerVariable, exitStatus) {
  return `
#include <fcntl.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void mark(const char *path) {
  if (path == NULL || path[0] == '\\0') return;
  int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (fd >= 0) {
    (void)write(fd, "ran", 3);
    (void)close(fd);
  }
}

int main(int argc, char **argv) {
  mark(getenv("${executionMarkerVariable}"));
  const char *configured = NULL;
  for (int index = 0; index < argc; index += 1) {
    if (strncmp(argv[index], "configPath=", 11) == 0) {
      configured = argv[index] + 11;
      break;
    }
  }
  if (configured == NULL) return 34;
  const char *separator = strstr(configured, ";platform=");
  if (separator == NULL || separator == configured ||
      (size_t)(separator - configured) >= PATH_MAX) return 34;
  char config_path[PATH_MAX];
  size_t path_length = (size_t)(separator - configured);
  memcpy(config_path, configured, path_length);
  config_path[path_length] = '\\0';
  int config_fd = open(config_path, O_RDONLY);
  if (config_fd < 0) return 34;
  char content[4096];
  ssize_t count = read(config_fd, content, sizeof(content) - 1);
  (void)close(config_fd);
  if (count < 0) return 34;
  content[count] = '\\0';
  if (strstr(content, "TEST_APP_ID_NOT_A_CREDENTIAL") != NULL) {
    mark(getenv("CREATOR_ORIGINAL_CONFIG_MARKER"));
  }
  if (strstr(content, "TEST_REPLACEMENT_NOT_A_CREDENTIAL") != NULL) {
    mark(getenv("CREATOR_REPLACEMENT_CONFIG_MARKER"));
  }
  return ${exitStatus};
}
`;
}

function makeSignedCreatorApp(name, executionMarkerVariable, exitStatus = 36) {
  const contents = join(fixtureRoot, `${name}.app`, "Contents");
  const executable = join(contents, "MacOS", "CocosCreator");
  const source = join(fixtureRoot, `${name}.c`);
  mkdirSync(join(contents, "MacOS"), { recursive: true });
  const plist = writeCreatorPlist(contents);
  writeFileSync(
    source,
    creatorFixtureSource(executionMarkerVariable, exitStatus),
  );
  const compiler = resolveTrustedMacosCompiler();
  const sdk = resolveTrustedMacosSdk();
  const compilation = spawnSync(
    compiler,
    ["-std=c11", "-O2", "-isysroot", sdk, source, "-o", executable],
    { encoding: "utf8", env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin" } },
  );
  assert.equal(compilation.status, 0, compilation.stderr);
  const signing = spawnSync(
    "/usr/bin/codesign",
    ["--force", "--sign", "-", "--options", "runtime", executable],
    { encoding: "utf8" },
  );
  assert.equal(signing.status, 0, signing.stderr);
  return { executable, plist };
}

function writeWechatConfig(path, appId) {
  writeFileSync(path, wechatConfigContent(appId));
}

function wechatConfigContent(appId) {
  return JSON.stringify({
    platform: "wechatgame",
    packages: { wechatgame: { appid: appId } },
  });
}

function spawnFixtureBuild({ creator, configSnapshot, interposeForTest }) {
  return spawnAttestedCreatorBuild({
    creatorAttestation: attestCreatorExecutable(creator.executable, "3.8.8"),
    configSnapshot,
    cocosProject: fixtureRoot,
    platform: "wechatgame",
    cwd: fixtureRoot,
    launcherSourceSha256,
    interposeForTest,
  });
}

try {
  const launcherSource = attestMacosBoundLauncherSource(launcherSourceSha256);
  equal(launcherSource.pinned, true);
  equal(launcherSource.sha256, launcherSourceSha256);

  const primary = makeCreatorApp("Creator");
  deepEqual(detectCreatorVersion(primary.executable), {
    version: "3.8.8",
    source: "macos-app-bundle",
    error: null,
  });
  equal(creatorVersionMatches(primary.executable, "3.8.8").matches, true);
  equal(creatorVersionMatches(primary.executable, "3.8.8").version, "3.8.8");
  equal(creatorVersionMatches(primary.executable, "3.8.7").matches, false);
  equal(detectCreatorVersion(join(fixtureRoot, "missing")).error, "executable-not-found");

  const primaryAttestation = attestCreatorExecutable(primary.executable, "3.8.8");
  equal(primaryAttestation.canonicalPath, realpathSync.native(primary.executable));
  equal(primaryAttestation.sha256.length, 64);
  equal(
    assertCreatorExecutableUnchanged(primaryAttestation),
    realpathSync.native(primary.executable),
  );

  const replaced = makeCreatorApp("Replaced");
  const replacedAttestation = attestCreatorExecutable(replaced.executable, "3.8.8");
  renameSync(replaced.executable, `${replaced.executable}.attested`);
  writeFileSync(replaced.executable, "#!/bin/sh\nexit 36\n");
  chmodSync(replaced.executable, 0o755);
  boundaryError(
    () => assertCreatorExecutableUnchanged(replacedAttestation),
    ["file-identity-drift", "file-fingerprint-drift"],
  );

  const evidenceDrift = makeCreatorApp("EvidenceDrift");
  const evidenceAttestation = attestCreatorExecutable(
    evidenceDrift.executable,
    "3.8.8",
  );
  writeFileSync(
    evidenceDrift.plist,
    readFileSync(evidenceDrift.plist, "utf8").replace("3.8.8", "3.8.7"),
  );
  boundaryError(
    () => assertCreatorExecutableUnchanged(evidenceAttestation),
    ["file-identity-drift", "file-fingerprint-drift"],
  );

  const linkA = makeCreatorApp("LinkA");
  const linkB = makeCreatorApp("LinkB");
  const configuredLink = join(fixtureRoot, "configured-creator");
  symlinkSync(linkA.executable, configuredLink);
  const linkedAttestation = attestCreatorExecutable(configuredLink, "3.8.8");
  unlinkSync(configuredLink);
  symlinkSync(linkB.executable, configuredLink);
  boundaryError(
    () => assertCreatorExecutableUnchanged(linkedAttestation),
    ["file-canonical-path-drift"],
  );

  const captured = captureStableFile(primary.executable);
  boundaryError(
    () => assertStableFileUnchanged({ ...captured, sha256: "0".repeat(64) }),
    ["file-fingerprint-drift"],
  );

  const configPath = join(fixtureRoot, "wechat-build-config.json");
  writeWechatConfig(configPath, "TEST_APP_ID_NOT_A_CREDENTIAL");
  const configSnapshot = createBuildConfigSnapshot(configPath);
  const configStat = fstatSync(configSnapshot.descriptor, { bigint: true });
  equal(configStat.nlink, 0n);
  equal(configStat.mode & 0o777n, 0o400n);
  equal(assertBuildConfigSnapshotUnchanged(configSnapshot), configSnapshot.descriptor);
  const capturedConfig = captureStableDescriptor(
    configSnapshot.descriptor,
    { includeContent: true },
  ).content.toString("utf8");
  writeWechatConfig(configPath, "TEST_REPLACEMENT_NOT_A_CREDENTIAL");
  equal(
    captureStableDescriptor(
      configSnapshot.descriptor,
      { includeContent: true },
    ).content.toString("utf8"),
    capturedConfig,
  );

  if (process.platform === "darwin") {
    const positiveCreator = makeSignedCreatorApp(
      "PositiveCreator",
      "CREATOR_ORIGINAL_EXEC_MARKER",
    );
    const positiveResult = spawnFixtureBuild({
      creator: positiveCreator,
      configSnapshot,
    });
    equal(positiveResult.status, 36);
    disposeBuildConfigSnapshot(configSnapshot);
    boundaryError(
      () => assertBuildConfigSnapshotUnchanged(configSnapshot),
      ["snapshot-inactive"],
    );
    assert.throws(() => fstatSync(configSnapshot.descriptor), { code: "EBADF" });
    assertionCount += 1;

    // The hook runs after the native helper's final executable/config hashes
    // and before posix_spawn. Replacing the source config cannot redirect the
    // child away from the anonymous descriptor object.
    writeWechatConfig(configPath, "TEST_APP_ID_NOT_A_CREDENTIAL");
    const interposedConfig = createBuildConfigSnapshot(configPath);
    const configCreator = makeSignedCreatorApp(
      "ConfigInterpositionCreator",
      "CREATOR_ORIGINAL_EXEC_MARKER",
      0,
    );
    const originalExecMarker = join(fixtureRoot, "original-exec.marker");
    const originalConfigMarker = join(fixtureRoot, "original-config.marker");
    const replacementConfigMarker = join(fixtureRoot, "replacement-config.marker");
    process.env.CREATOR_ORIGINAL_EXEC_MARKER = originalExecMarker;
    process.env.CREATOR_ORIGINAL_CONFIG_MARKER = originalConfigMarker;
    process.env.CREATOR_REPLACEMENT_CONFIG_MARKER = replacementConfigMarker;
    const configInterpositionResult = spawnFixtureBuild({
      creator: configCreator,
      configSnapshot: interposedConfig,
      interposeForTest: {
        writeFiles: [{
          path: configPath,
          contentHex: Buffer.from(
            wechatConfigContent("TEST_REPLACEMENT_NOT_A_CREDENTIAL"),
          ).toString("hex"),
        }],
        probeConfigWrite: true,
      },
    });
    equal(configInterpositionResult.status, 0);
    equal(existsSync(originalExecMarker), true);
    equal(existsSync(originalConfigMarker), true);
    equal(existsSync(replacementConfigMarker), false);
    equal(assertBuildConfigSnapshotUnchanged(interposedConfig), interposedConfig.descriptor);
    disposeBuildConfigSnapshot(interposedConfig);

    // The executable path is replaced in the same final-check-to-spawn seam.
    // Darwin creates the substitute suspended; CDHash mismatch kills it before
    // any user-space instruction (including main's marker write) can execute.
    writeWechatConfig(configPath, "TEST_APP_ID_NOT_A_CREDENTIAL");
    const executableConfig = createBuildConfigSnapshot(configPath);
    const originalCreator = makeSignedCreatorApp(
      "ExecutableInterpositionCreator",
      "CREATOR_ORIGINAL_EXEC_MARKER_2",
    );
    const substituteCreator = makeSignedCreatorApp(
      "ExecutableSubstituteCreator",
      "CREATOR_REPLACEMENT_EXEC_MARKER",
    );
    const originalExecMarker2 = join(fixtureRoot, "original-exec-2.marker");
    const replacementExecMarker = join(fixtureRoot, "replacement-exec.marker");
    const originalConfigMarker2 = join(fixtureRoot, "original-config-2.marker");
    const replacementConfigMarker2 = join(fixtureRoot, "replacement-config-2.marker");
    process.env.CREATOR_ORIGINAL_EXEC_MARKER_2 = originalExecMarker2;
    process.env.CREATOR_REPLACEMENT_EXEC_MARKER = replacementExecMarker;
    process.env.CREATOR_ORIGINAL_CONFIG_MARKER = originalConfigMarker2;
    process.env.CREATOR_REPLACEMENT_CONFIG_MARKER = replacementConfigMarker2;
    const originalAttestation = attestCreatorExecutable(
      originalCreator.executable,
      "3.8.8",
    );
    boundaryError(
      () => spawnAttestedCreatorBuild({
        creatorAttestation: originalAttestation,
        configSnapshot: executableConfig,
        cocosProject: fixtureRoot,
        platform: "wechatgame",
        cwd: fixtureRoot,
        launcherSourceSha256,
        interposeForTest: {
          renames: [
            [originalCreator.executable, `${originalCreator.executable}.attested`],
            [substituteCreator.executable, originalCreator.executable],
          ],
          writeFiles: [{
            path: configPath,
            contentHex: Buffer.from(
              wechatConfigContent("TEST_REPLACEMENT_NOT_A_CREDENTIAL"),
            ).toString("hex"),
          }],
        },
      }),
      ["bound-launch-child-image-mismatch"],
    );
    equal(existsSync(originalExecMarker2), false);
    equal(existsSync(replacementExecMarker), false);
    equal(existsSync(originalConfigMarker2), false);
    equal(existsSync(replacementConfigMarker2), false);
    equal(assertBuildConfigSnapshotUnchanged(executableConfig), executableConfig.descriptor);
    disposeBuildConfigSnapshot(executableConfig);
  } else {
    boundaryError(
      () => spawnFixtureBuild({ creator: primary, configSnapshot }),
      ["bound-launch-macos-required"],
    );
    disposeBuildConfigSnapshot(configSnapshot);
  }

  if (process.platform !== "win32") {
    const probe = join(fixtureRoot, "creator-probe");
    writeFileSync(probe, "#!/bin/sh\nprintf 'Cocos Creator 3.8.8\\n'\n");
    chmodSync(probe, 0o755);
    deepEqual(detectCreatorVersion(probe), {
      version: "3.8.8",
      source: "creator---version",
      error: null,
    });

    const failingProbe = join(fixtureRoot, "creator-failing-probe");
    writeFileSync(
      failingProbe,
      "#!/bin/sh\nprintf 'Cocos Creator 3.8.8\\n'\nexit 7\n",
    );
    chmodSync(failingProbe, 0o755);
    equal(detectCreatorVersion(failingProbe).error, "version-probe-failed");

    const ambiguousProbe = join(fixtureRoot, "creator-ambiguous-probe");
    writeFileSync(ambiguousProbe, "#!/bin/sh\nprintf 'dependency 3.8.8\\n'\n");
    chmodSync(ambiguousProbe, 0o755);
    equal(detectCreatorVersion(ambiguousProbe).error, "version-unverifiable");

    const nonExecutableProbe = join(fixtureRoot, "creator-not-executable");
    writeFileSync(nonExecutableProbe, "Cocos Creator 3.8.8\n");
    chmodSync(nonExecutableProbe, 0o644);
    equal(detectCreatorVersion(nonExecutableProbe).error, "executable-not-runnable");
  }

  console.log(`TOOLCHAIN_CONTRACT_VALID assertions=${assertionCount}`);
} finally {
  for (const variable of [
    "CREATOR_ORIGINAL_EXEC_MARKER",
    "CREATOR_ORIGINAL_EXEC_MARKER_2",
    "CREATOR_REPLACEMENT_EXEC_MARKER",
    "CREATOR_ORIGINAL_CONFIG_MARKER",
    "CREATOR_REPLACEMENT_CONFIG_MARKER",
  ]) {
    delete process.env[variable];
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
}
