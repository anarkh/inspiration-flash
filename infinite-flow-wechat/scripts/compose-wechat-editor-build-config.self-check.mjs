import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  composeWechatEditorBuildConfig,
} from "./compose-wechat-editor-build-config.mjs";
import {
  WechatBuildContractError,
  loadWechatBundleProfiles,
} from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const composerCli = resolve(
  projectRoot,
  "scripts/compose-wechat-editor-build-config.mjs",
);
const loadedProfile = loadWechatBundleProfiles();
const profile = loadedProfile.profile;
const configRoot = "db://assets/config";
const resourcesRoot = "db://assets/resources";
const temporaryRoot = mkdtempSync(
  join(tmpdir(), "if-wechat-editor-compose-self-check-"),
);
const redactedAppId = "REDACTED_APP_ID_FIXTURE";
const redactedServer = "https://redacted.invalid/fixture/";
const redactedBuildPath = "/REDACTED/creator-build";
let assertions = 0;
let suites = 0;

function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}

function checkOk(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return path;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function withoutBundles(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => key !== "bundleConfigs"),
  );
}

function expectContractError(run, expectedCode, failurePattern, outputPath) {
  let caught;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  checkOk(caught instanceof WechatBuildContractError, "contract error required");
  check(caught.code, expectedCode);
  if (failurePattern !== undefined) {
    assert.match(caught.failures.join("\n"), failurePattern);
    assertions += 1;
  }
  if (outputPath !== undefined) check(existsSync(outputPath), false);
}

function commonBundles({ reverseKeyOrder = false } = {}) {
  if (reverseKeyOrder) {
    return [
      { output: true, root: "", name: "main" },
      { output: true, root: "", name: "internal" },
    ];
  }
  return [
    { name: "main", root: "", output: true },
    { name: "internal", root: "", output: true },
  ];
}

function targetBundle(bundleProfile, root) {
  return {
    root,
    name: bundleProfile.name,
    output: true,
    uuid: bundleProfile.uuid,
  };
}

function fullOfficialTopLevel(bundleConfigs) {
  return {
    __version__: profile.creator.builderConfigVersion,
    taskName: "redacted-wechat-editor-fixture",
    platform: profile.creator.platform,
    buildMode: "build",
    scenes: [{
      url: "db://assets/Redacted.scene",
      uuid: "00000000-0000-4000-8000-000000000001",
    }],
    skipCompressTexture: false,
    sourceMaps: "false",
    experimentalEraseModules: false,
    bundleCommonChunk: true,
    startScene: "00000000-0000-4000-8000-000000000001",
    buildPath: redactedBuildPath,
    debug: false,
    mangleProperties: false,
    inlineEnum: true,
    md5Cache: false,
    mainBundleCompressionType: "merge_dep",
    mainBundleIsRemote: false,
    useBuiltinServer: false,
    server: redactedServer,
    startSceneAssetBundle: false,
    name: "redacted-project",
    outputName: "wechatgame",
    packages: {
      wechatgame: {
        orientation: "portrait",
        appid: redactedAppId,
        buildOpenDataContextTemplate: "",
        separateEngine: false,
        highPerformanceMode: false,
        __version__: "1.0.4",
      },
    },
    bundleConfigs,
    nativeCodeBundleMode: "wasm",
    wasmCompressionMode: false,
    overwriteProjectSettings: {
      include: [],
      exclude: [],
    },
    engineModulesConfigKey: "default",
    polyfills: {
      asyncFunctions: true,
    },
    packAutoAtlas: true,
    binGroupConfig: {
      enable: false,
    },
    md5CacheOptions: {},
    useSplashScreen: true,
  };
}

function fixturePath(name) {
  return join(temporaryRoot, `${name}.json`);
}

function outputPath(name) {
  return join(temporaryRoot, `${name}.local.json`);
}

function compose(fragmentPaths, output) {
  return composeWechatEditorBuildConfig({
    fragmentPaths,
    outputPath: output,
  });
}

try {
  const emptyConfig = fullOfficialTopLevel([]);
  const configOnly = fullOfficialTopLevel([
    ...commonBundles(),
    targetBundle(profile.configBundle, configRoot),
  ]);
  const resourcesOnly = fullOfficialTopLevel([
    ...commonBundles({ reverseKeyOrder: true }),
    targetBundle(profile.bundle, resourcesRoot),
  ]);
  const emptyPath = writeJson(fixturePath("empty"), emptyConfig);
  const configPath = writeJson(fixturePath("config-only"), configOnly);
  const resourcesPath = writeJson(
    fixturePath("resources-only"),
    resourcesOnly,
  );

  {
    const output = outputPath("positive");
    const previousUmask = process.umask(0);
    let result;
    try {
      result = compose([emptyPath, configPath, resourcesPath], output);
    } finally {
      process.umask(previousUmask);
    }
    const bytes = readFileSync(output);
    const composed = JSON.parse(bytes.toString("utf8"));
    check(result.fragmentCount, 3);
    check(result.bundleCount, 4);
    check(result.outputSha256, sha256(bytes));
    check(statSync(output).mode & 0o777, 0o600);
    check(withoutBundles(composed), withoutBundles(emptyConfig));
    check(
      composed.bundleConfigs.map((bundle) => bundle.name),
      ["main", "internal", "config", "resources"],
    );
    check(
      composed.bundleConfigs.find((bundle) => bundle.name === "config"),
      targetBundle(profile.configBundle, configRoot),
    );
    check(
      composed.bundleConfigs.find((bundle) => bundle.name === "resources"),
      targetBundle(profile.bundle, resourcesRoot),
    );
    check(composed.packages.wechatgame.appid, redactedAppId);
    suites += 1;

    const beforeOverwrite = Buffer.from(bytes);
    expectContractError(
      () => compose([configPath, resourcesPath], output),
      "output-already-exists",
      /refuse-overwrite/,
    );
    check(readFileSync(output), beforeOverwrite);
    check(statSync(output).mode & 0o777, 0o600);
    suites += 1;
  }

  {
    const driftedEmpty = structuredClone(emptyConfig);
    driftedEmpty.server = "https://redacted.invalid/drift/";
    const driftedPath = writeJson(fixturePath("empty-field-drift"), driftedEmpty);
    const output = outputPath("field-drift");
    expectContractError(
      () => compose([configPath, resourcesPath, driftedPath], output),
      "editor-fragment-top-level-conflict",
      /top-level-config-must-match/,
      output,
    );
    suites += 1;
  }

  {
    const badRoot = structuredClone(configOnly);
    badRoot.bundleConfigs.at(-1).root = "db://assets/REDACTED_WRONG_ROOT";
    const badRootPath = writeJson(fixturePath("root-mismatch"), badRoot);
    const output = outputPath("root-mismatch");
    expectContractError(
      () => compose([badRootPath, resourcesPath], output),
      "editor-bundle-profile-mismatch",
      /bundleConfigs\.config\.root:profile-editor-root-required/,
      output,
    );
    suites += 1;
  }

  {
    const badUuid = structuredClone(resourcesOnly);
    badUuid.bundleConfigs.at(-1).uuid =
      "00000000-0000-4000-8000-000000000002";
    const badUuidPath = writeJson(fixturePath("uuid-mismatch"), badUuid);
    const output = outputPath("uuid-mismatch");
    expectContractError(
      () => compose([configPath, badUuidPath], output),
      "editor-bundle-profile-mismatch",
      /bundleConfigs\.resources\.uuid:profile-uuid-required/,
      output,
    );
    suites += 1;
  }

  {
    const conflictingDuplicate = structuredClone(resourcesOnly);
    conflictingDuplicate.bundleConfigs.push({
      ...targetBundle(profile.configBundle, configRoot),
      output: false,
    });
    const conflictPath = writeJson(
      fixturePath("duplicate-conflict"),
      conflictingDuplicate,
    );
    const output = outputPath("duplicate-conflict");
    expectContractError(
      () => compose([configPath, conflictPath], output),
      "editor-bundle-conflict",
      /duplicate-definitions-must-be-deep-equal/,
      output,
    );
    suites += 1;
  }

  {
    const output = outputPath("missing-resources");
    expectContractError(
      () => compose([emptyPath, configPath], output),
      "editor-bundle-missing",
      /bundleConfigs\.resources:exactly-one-required/,
      output,
    );
    suites += 1;
  }

  {
    const symlinkPath = fixturePath("config-symlink");
    symlinkSync(configPath, symlinkPath);
    const output = outputPath("input-symlink");
    expectContractError(
      () => compose([symlinkPath, resourcesPath], output),
      "editor-fragment-symlink-forbidden",
      /symlink-forbidden/,
      output,
    );
    suites += 1;
  }

  {
    const sentinelPath = fixturePath("output-symlink-sentinel");
    const sentinelBytes = Buffer.from("REDACTED_SENTINEL\n", "utf8");
    writeFileSync(sentinelPath, sentinelBytes, { mode: 0o600 });
    const output = outputPath("output-symlink");
    symlinkSync(sentinelPath, output);
    expectContractError(
      () => compose([configPath, resourcesPath], output),
      "output-already-exists",
      /refuse-overwrite/,
    );
    check(readFileSync(sentinelPath), sentinelBytes);
    check(statSync(sentinelPath).mode & 0o777, 0o600);
    suites += 1;
  }

  {
    const output = outputPath("cli-positive");
    const cli = spawnSync(process.execPath, [
      composerCli,
      "--fragment",
      configPath,
      "--fragment",
      resourcesPath,
      "--output",
      output,
    ], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    check(cli.status, 0, cli.stderr);
    const log = `${cli.stdout}${cli.stderr}`;
    for (const forbidden of [
      redactedAppId,
      redactedServer,
      redactedBuildPath,
      configRoot,
      resourcesRoot,
      profile.configBundle.uuid,
      profile.bundle.uuid,
    ]) {
      check(log.includes(forbidden), false, "CLI leaked a protected config value");
    }
    const report = JSON.parse(cli.stdout);
    check(report.fragmentCount, 2);
    check(report.bundleCount, 4);
    check(report.bundleNames, ["config", "internal", "main", "resources"]);
    checkOk(/^[0-9a-f]{64}$/.test(report.outputSha256));
    check(statSync(output).mode & 0o777, 0o600);
    suites += 1;
  }
} finally {
  // This is the exact directory created above; never clean a caller path.
  rmSync(temporaryRoot, { recursive: true, force: true });
  check(existsSync(temporaryRoot), false);
}

console.log(JSON.stringify({
  ok: true,
  assertions,
  suites,
}, null, 2));
