import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { renderWechatBuildConfig } from "./render-wechat-build-config.mjs";
import {
  WechatBuildContractError,
  assertFullEditorBuildConfig,
  inspectWechatBuildConfigFile,
  loadWechatBundleProfiles,
  templateRemoteServer,
  validateProjectBundlePolicy,
  verifyWechatBuildConfig,
  verifyWechatBuildConfigFile,
} from "./verify-wechat-build-config.mjs";
import {
  verifyWechatBuildOutput,
} from "./verify-wechat-build-output.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const rendererCli = resolve(projectRoot, "scripts/render-wechat-build-config.mjs");
const configVerifierCli = resolve(
  projectRoot,
  "scripts/verify-wechat-build-config.mjs",
);
const outputVerifierCli = resolve(
  projectRoot,
  "scripts/verify-wechat-build-output.mjs",
);
const manifest = JSON.parse(readFileSync(
  resolve(projectRoot, "cocos/assets/config/asset-manifest.json"),
  "utf8",
));
const resourcesFixtureVersion = "resources-fixture-v1";
const configFixtureVersion = "config-fixture-v1";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fullEditorConfig(buildPath) {
  return {
    __version__: "1.3.9",
    taskName: "wechatgame-contract-fixture",
    platform: "wechatgame",
    scenes: [{
      url: "db://assets/InfiniteFlow.scene",
      uuid: "e46d7337-8fd9-4f73-9f53-e8d72bd643de",
    }],
    skipCompressTexture: false,
    sourceMaps: false,
    experimentalEraseModules: false,
    bundleCommonChunk: true,
    startScene: "e46d7337-8fd9-4f73-9f53-e8d72bd643de",
    buildPath,
    debug: false,
    mangleProperties: false,
    inlineEnum: true,
    inlineSpriteFrames: false,
    md5Cache: false,
    mainBundleCompressionType: "merge_dep",
    mainBundleIsRemote: true,
    useBuiltinServer: true,
    server: "",
    startSceneAssetBundle: true,
    moveRemoteBundleScript: false,
    customLayers: [],
    sortingLayers: [],
    splashScreen: {
      displayRatio: 0.4,
      totalTime: 0,
      watermarkLocation: "default",
      autoFit: true,
    },
    name: "infinite-flow-wechat-fixture",
    outputName: "wechatgame",
    resolution: { width: 720, height: 1280, policy: 4 },
    packages: {
      wechatgame: {
        appid: "",
        buildOpenDataContextTemplate: false,
        orientation: "portrait",
        separateEngine: false,
        highPerformanceMode: false,
        wasmSubpackage: false,
        subpackages: [{ name: "unrelated", root: "subpackages/unrelated/" }],
        preservePackageUnknown: { nested: true },
      },
    },
    bundleConfigs: [{
      root: "opaque-editor-generated-root",
      name: "resources",
      uuid: "fb6cd6ef-57d2-4cf7-8286-327137b480cc",
      priority: 1,
      compressionType: "none",
      isRemote: false,
      output: true,
      preserveBundleUnknown: { nested: true },
    }, {
      root: "opaque-editor-generated-config-root",
      name: "config",
      uuid: "fd882dc1-24c1-4b13-aac4-76960c1783ee",
      priority: 9,
      compressionType: "merge_dep",
      isRemote: false,
      output: true,
      preserveBundleUnknown: { local: true },
    }],
    nativeCodeBundleMode: "wasm",
    preserveTopLevelUnknown: { nested: [1, 2, 3] },
  };
}

function officialCreator388Config(buildPath) {
  return {
    __version__: "1.3.9",
    taskName: "wechatgame-official-3.8.8-fixture",
    platform: "wechatgame",
    scenes: [{ url: "db://assets/InfiniteFlow.scene" }],
    skipCompressTexture: false,
    sourceMaps: "false",
    experimentalEraseModules: false,
    bundleCommonChunk: true,
    startScene: "e46d7337-8fd9-4f73-9f53-e8d72bd643de",
    buildPath,
    debug: false,
    mangleProperties: false,
    inlineEnum: true,
    md5Cache: false,
    mainBundleCompressionType: "merge_dep",
    mainBundleIsRemote: true,
    useBuiltinServer: true,
    server: "",
    startSceneAssetBundle: true,
    name: "infinite-flow-wechat-official-fixture",
    outputName: "wechatgame",
    packages: {
      wechatgame: {
        appid: "",
        buildOpenDataContextTemplate: "",
        orientation: "portrait",
        separateEngine: false,
        highPerformanceMode: false,
      },
    },
    bundleConfigs: [{
      name: "main",
      root: "",
      uuid: "main-bundle-fixture",
      output: true,
    }, {
      name: "internal",
      root: "",
      uuid: "internal-bundle-fixture",
      output: true,
    }, {
      name: "config",
      root: "db://assets/config",
      uuid: "fd882dc1-24c1-4b13-aac4-76960c1783ee",
      output: true,
    }, {
      name: "resources",
      root: "db://assets/resources",
      uuid: "fb6cd6ef-57d2-4cf7-8286-327137b480cc",
      output: true,
    }],
    nativeCodeBundleMode: "wasm",
  };
}

function createBundleFixture(root, config, modeName, profile) {
  mkdirSync(root, { recursive: true });
  writeJson(resolve(root, "game.json"), modeName === "remote"
    ? { deviceOrientation: "portrait" }
    : {
        deviceOrientation: "portrait",
        subpackages: [{
          name: "resources",
          root: "subpackages/resources/",
        }],
      });
  writeJson(resolve(root, "project.config.json"), {
    appid: config.packages.wechatgame.appid,
    projectname: "fixture",
  });
  writeFileSync(resolve(root, "game.js"), "// fixture package entry\n", "utf8");
  const settingsDirectory = resolve(root, "src");
  mkdirSync(settingsDirectory, { recursive: true });
  writeJson(resolve(settingsDirectory, "settings.fixture.json"), {
    assets: {
      server: modeName === "remote" ? config.server : "",
      remoteBundles: modeName === "remote" ? ["resources"] : [],
      bundleVers: {
        resources: resourcesFixtureVersion,
        config: configFixtureVersion,
      },
      subpackages: modeName === "subpackage-smoke" ? ["resources"] : [],
      projectBundles: ["resources", "config"],
    },
  });

  const configRoot = resolve(root, "assets/config");
  mkdirSync(resolve(configRoot, "import"), { recursive: true });
  writeJson(resolve(configRoot, `config.${configFixtureVersion}.json`), {
    paths: {
      [profile.configBundle.manifestPath]: [0, 0],
    },
    uuids: [profile.configBundle.manifestUuid],
  });
  writeFileSync(
    resolve(configRoot, `index.${configFixtureVersion}.js`),
    "// fixture local config bundle entry\n",
    "utf8",
  );
  writeJson(resolve(configRoot, "import/asset-manifest.json"), {
    manifestRevision: manifest.manifestRevision,
  });

  const bundleRoot = resolve(
    root,
    modeName === "remote" ? "remote/resources" : "subpackages/resources",
  );
  mkdirSync(resolve(bundleRoot, "native"), { recursive: true });
  writeJson(resolve(bundleRoot, `config.${resourcesFixtureVersion}.json`), {
    paths: Object.fromEntries(
      manifest.assets.map((asset, index) => [asset.resourcePath, [index, 0]]),
    ),
  });
  if (modeName === "subpackage-smoke") {
    writeFileSync(
      resolve(bundleRoot, "game.js"),
      "// fixture subpackage bundle entry\n",
      "utf8",
    );
  }
  writeFileSync(resolve(bundleRoot, "native/payload.bin"), "fixture", "utf8");
  if (modeName === "remote") {
    const scriptRoot = resolve(root, "src/bundle-scripts/resources");
    mkdirSync(scriptRoot, { recursive: true });
    writeFileSync(
      resolve(scriptRoot, `index.${resourcesFixtureVersion}.js`),
      "// fixture moved remote bundle entry\n",
      "utf8",
    );
  }
}

function expectContractError(callback, expectedCode) {
  assert.throws(callback, (error) => (
    error instanceof WechatBuildContractError && error.code === expectedCode
  ));
}

function expectFailure(callback, expectedFailure) {
  assert.throws(callback, (error) => (
    error instanceof WechatBuildContractError
    && error.failures.includes(expectedFailure)
  ));
}

function assertEligibility(
  result,
  { gate, mode, releaseEligible, nonRelease },
) {
  assert.deepEqual({
    gate: result.gate,
    mode: result.mode,
    releaseEligible: result.releaseEligible,
    nonRelease: result.nonRelease,
  }, {
    gate,
    mode,
    releaseEligible,
    nonRelease,
  });
}

function parseSuccessfulCliJson(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function assertRejectedCli(
  result,
  { code, failure },
) {
  assert.notEqual(result.status, 0, result.stdout);
  const output = JSON.parse(result.stderr);
  assert.equal(output.ok, false);
  assert.equal(output.code, code);
  assert.ok(output.failures.includes(failure));
  assert.notEqual(output.releaseEligible, true);
  assert.notEqual(output.nonRelease, false);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "infinite-flow-wechat-bundle-test-"));
try {
  const loadedProfile = loadWechatBundleProfiles();
  const profile = loadedProfile.profile;
  const projectBundlePolicy = {
    builderSettings: JSON.parse(readFileSync(
      resolve(projectRoot, profile.bundle.builderSettingsPath),
      "utf8",
    )),
    resourcesMetadata: JSON.parse(readFileSync(
      resolve(projectRoot, profile.bundle.metadataPath),
      "utf8",
    )),
    configMetadata: JSON.parse(readFileSync(
      resolve(projectRoot, profile.configBundle.metadataPath),
      "utf8",
    )),
  };
  assert.equal(profile.creator.version, "3.8.8");
  assert.equal(profile.creator.builderConfigVersion, "1.3.9");
  assert.equal(profile.source.assetCount, 207);
  assert.equal(profile.source.resourceBytes, 76_702_709);
  assert.equal(profile.bundle.uuid, "fb6cd6ef-57d2-4cf7-8286-327137b480cc");
  assert.equal(profile.bundle.bundleConfigID, "resources-remote-wechat-v1");
  assert.deepEqual(validateProjectBundlePolicy(profile, projectBundlePolicy), []);
  const reorderedProjectBundlePolicy = JSON.parse(
    JSON.stringify(projectBundlePolicy),
  );
  const reorderedConfigs = reorderedProjectBundlePolicy.builderSettings
    .bundleConfig.custom[profile.bundle.bundleConfigID].configs;
  for (const platform of ["native", "web", "miniGame"]) {
    for (const field of ["preferredOptions", "fallbackOptions"]) {
      const options = reorderedConfigs[platform][field];
      reorderedConfigs[platform][field] = {
        compressionType: options.compressionType,
        isRemote: options.isRemote,
      };
    }
  }
  reorderedConfigs.miniGame.overwriteSettings = {
    wechatgame: {
      compressionType: "merge_dep",
      isRemote: true,
    },
  };
  assert.deepEqual(
    validateProjectBundlePolicy(profile, reorderedProjectBundlePolicy),
    [],
  );
  for (const { failure, mutate } of [{
    failure: "resources.meta.userData.bundleConfigID:unexpected-value",
    mutate(policy) {
      policy.resourcesMetadata.userData.bundleConfigID = "default";
    },
  }, {
    failure: "builder.bundleConfig.custom.resources-preset:missing",
    mutate(policy) {
      delete policy.builderSettings.bundleConfig.custom[profile.bundle.bundleConfigID];
    },
  }, {
    failure: "builder.resources-preset.configs.miniGame.configMode:unexpected-value",
    mutate(policy) {
      policy.builderSettings.bundleConfig.custom[
        profile.bundle.bundleConfigID
      ].configs.miniGame.configMode = "fallback";
    },
  }, {
    failure:
      "builder.resources-preset.configs.miniGame.overwriteSettings:unexpected-value",
    mutate(policy) {
      policy.builderSettings.bundleConfig.custom[
        profile.bundle.bundleConfigID
      ].configs.miniGame.overwriteSettings.wechatgame.isRemote = false;
    },
  }, {
    failure: "config.meta.userData.bundleConfigID:unexpected-value",
    mutate(policy) {
      policy.configMetadata.userData.bundleConfigID = profile.bundle.bundleConfigID;
    },
  }]) {
    const invalidPolicy = JSON.parse(JSON.stringify(projectBundlePolicy));
    mutate(invalidPolicy);
    assert.ok(validateProjectBundlePolicy(profile, invalidPolicy).includes(failure));
  }
  assert.equal(profile.configBundle.name, "config");
  assert.equal(
    profile.configBundle.uuid,
    "fd882dc1-24c1-4b13-aac4-76960c1783ee",
  );
  assert.equal(
    profile.configBundle.manifestUuid,
    "3d0842ec-43f7-4b5f-961f-39edb535ccd7",
  );
  assert.deepEqual(profile.configBundle.bundleConfig, {
    isRemote: false,
    compressionType: "merge_dep",
    output: true,
  });
  assert.equal(profile.modes.remote.releaseEligible, true);
  assert.equal(profile.modes["subpackage-smoke"].releaseEligible, false);
  assert.equal(profile.modes["subpackage-smoke"].projectPolicyCompatible, false);
  assert.ok(
    profile.source.resourceBytes
      > profile.wechat.repositorySourceByteEvidenceBoundaryBytes,
  );

  const officialBase = officialCreator388Config(resolve(
    temporaryRoot,
    "official-3.8.8-build",
  ));
  assert.equal(
    assertFullEditorBuildConfig(officialBase, profile).uuid,
    profile.bundle.uuid,
  );
  const officialShapeNegativeCases = [{
    failure: "debug:boolean-required",
    mutate(config) {
      delete config.debug;
    },
  }, {
    failure: "startScene:nonempty-string-required",
    mutate(config) {
      delete config.startScene;
    },
  }, {
    failure: "scenes.0.url:required",
    mutate(config) {
      delete config.scenes[0].url;
    },
  }, {
    failure: "packages.wechatgame.highPerformanceMode:boolean-required",
    mutate(config) {
      delete config.packages.wechatgame.highPerformanceMode;
    },
  }, {
    failure:
      "packages.wechatgame.buildOpenDataContextTemplate:boolean-or-empty-string-required",
    mutate(config) {
      config.packages.wechatgame.buildOpenDataContextTemplate = "false";
    },
  }, {
    failure: "packages.wechatgame.wasmSubpackage:boolean-required",
    mutate(config) {
      config.packages.wechatgame.wasmSubpackage = "false";
    },
  }, {
    failure: "sourceMaps:boolean-inline-or-false-string-required",
    mutate(config) {
      config.sourceMaps = "external";
    },
  }, {
    failure: "sourceMaps:boolean-inline-or-false-string-required",
    mutate(config) {
      config.sourceMaps = "true";
    },
  }, {
    failure: "bundleConfigs.resources.uuid:unexpected-value",
    mutate(config) {
      config.bundleConfigs.find(({ name }) => name === "resources").uuid =
        "wrong-resources-uuid";
    },
  }, {
    failure: "bundleConfigs.resources.root:editor-generated-value-required",
    mutate(config) {
      config.bundleConfigs.find(({ name }) => name === "resources").root = "";
    },
  }, {
    failure: "bundleConfigs.config.output:unexpected-value",
    mutate(config) {
      config.bundleConfigs.find(({ name }) => name === "config").output = false;
    },
  }];
  for (const { failure, mutate } of officialShapeNegativeCases) {
    const invalid = JSON.parse(JSON.stringify(officialBase));
    mutate(invalid);
    expectFailure(() => assertFullEditorBuildConfig(invalid, profile), failure);
  }
  const officialInlineSourceMaps = JSON.parse(JSON.stringify(officialBase));
  officialInlineSourceMaps.sourceMaps = "inline";
  assertFullEditorBuildConfig(officialInlineSourceMaps, profile);
  const officialTemplatePath = resolve(
    temporaryRoot,
    "official-3.8.8.template.local.json",
  );
  const officialBasePath = resolve(
    temporaryRoot,
    "official-3.8.8-editor-export.json",
  );
  writeJson(officialBasePath, officialBase);
  const officialTemplateRender = renderWechatBuildConfig({
    basePath: officialBasePath,
    outputPath: officialTemplatePath,
    modeName: "remote",
    gate: "template",
  });
  assertEligibility(officialTemplateRender, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  assert.equal(
    officialTemplateRender.rendered.packages.wechatgame.wasmSubpackage,
    false,
  );
  assert.deepEqual(
    officialTemplateRender.rendered.bundleConfigs.find(
      ({ name }) => name === profile.configBundle.name,
    ),
    {
      ...officialBase.bundleConfigs.find(
        ({ name }) => name === profile.configBundle.name,
      ),
      priority: profile.configBundle.priority,
      ...profile.configBundle.bundleConfig,
    },
  );
  expectFailure(() => verifyWechatBuildConfig(officialBase, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "bundleConfigs.config.priority:unexpected-value");
  const officialFinal = JSON.parse(JSON.stringify(officialBase));
  const officialResourcesBundle = officialFinal.bundleConfigs.find(
    ({ name }) => name === profile.bundle.name,
  );
  Object.assign(officialResourcesBundle, {
    priority: profile.bundle.priority,
    ...profile.modes.remote.bundleConfig,
  });
  const officialConfigBundle = officialFinal.bundleConfigs.find(
    ({ name }) => name === profile.configBundle.name,
  );
  Object.assign(officialConfigBundle, {
    priority: profile.configBundle.priority,
    ...profile.configBundle.bundleConfig,
  });
  Object.assign(officialFinal, profile.modes.remote.buildOverrides);
  officialFinal.packages.wechatgame.appid = profile.wechat.templateAppId;
  officialFinal.packages.wechatgame.wasmSubpackage = false;
  officialFinal.server = templateRemoteServer(profile);
  assertEligibility(verifyWechatBuildConfig(officialFinal, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const officialFinalMissingWasm = JSON.parse(JSON.stringify(officialFinal));
  delete officialFinalMissingWasm.packages.wechatgame.wasmSubpackage;
  expectFailure(() => verifyWechatBuildConfig(officialFinalMissingWasm, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "packages.wechatgame.wasmSubpackage:boolean-required");
  const officialFinalSharedTargetRoot = JSON.parse(JSON.stringify(officialFinal));
  officialFinalSharedTargetRoot.bundleConfigs.find(
    ({ name }) => name === profile.configBundle.name,
  ).root = officialFinalSharedTargetRoot.bundleConfigs.find(
    ({ name }) => name === profile.bundle.name,
  ).root;
  expectFailure(() => verifyWechatBuildConfig(officialFinalSharedTargetRoot, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "bundleConfigs.config.root:must-differ-from-resources-bundle");

  const remoteBasePath = resolve(temporaryRoot, "remote-editor-export.json");
  const remoteBuildPath = resolve(temporaryRoot, "remote-build");
  const remoteBase = fullEditorConfig(remoteBuildPath);
  writeJson(remoteBasePath, remoteBase);
  const remoteConfigPath = resolve(temporaryRoot, "remote.template.local.json");
  const remoteRender = renderWechatBuildConfig({
    basePath: remoteBasePath,
    outputPath: remoteConfigPath,
    modeName: "remote",
    gate: "template",
  });
  assert.equal(remoteRender.releaseEligible, false);
  assert.equal(remoteRender.nonRelease, true);
  const templateConfigVerification = verifyWechatBuildConfig(
    remoteRender.rendered,
    {
      gate: "template",
      expectedMode: "remote",
      profile,
    },
  );
  assertEligibility(templateConfigVerification, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const templateConfigFileVerification = verifyWechatBuildConfigFile(
    remoteConfigPath,
    {
      gate: "template",
      expectedMode: "remote",
    },
  );
  assertEligibility(templateConfigFileVerification, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const templateConfigInspection = inspectWechatBuildConfigFile(remoteConfigPath, {
    gate: "template",
    expectedMode: "remote",
  });
  assertEligibility(templateConfigInspection, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  assert.equal(templateConfigInspection.productionValid, false);
  const templateConfigCli = parseSuccessfulCliJson(spawnSync(process.execPath, [
    configVerifierCli,
    "--config",
    remoteConfigPath,
    "--template",
    "--mode",
    "remote",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
  }));
  assertEligibility(templateConfigCli, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const templateRendererConfigPath = resolve(
    temporaryRoot,
    "remote.template.cli.local.json",
  );
  const templateRendererCli = parseSuccessfulCliJson(spawnSync(
    process.execPath,
    [
      rendererCli,
      "--base",
      remoteBasePath,
      "--output",
      templateRendererConfigPath,
      "--mode",
      "remote",
      "--template",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  ));
  assert.deepEqual({
    gate: templateRendererCli.gate,
    mode: templateRendererCli.mode,
    releaseEligible: templateRendererCli.releaseEligible,
    nonRelease: templateRendererCli.nonRelease,
  }, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  assert.equal(statSync(remoteConfigPath).mode & 0o777, 0o600);
  assert.deepEqual(
    remoteRender.rendered.preserveTopLevelUnknown,
    remoteBase.preserveTopLevelUnknown,
  );
  assert.deepEqual(
    remoteRender.rendered.packages.wechatgame.preservePackageUnknown,
    remoteBase.packages.wechatgame.preservePackageUnknown,
  );
  assert.deepEqual(
    remoteRender.rendered.bundleConfigs[0].preserveBundleUnknown,
    remoteBase.bundleConfigs[0].preserveBundleUnknown,
  );
  assert.equal(remoteRender.rendered.bundleConfigs[0].root, remoteBase.bundleConfigs[0].root);
  assert.deepEqual(
    remoteRender.rendered.bundleConfigs[1],
    remoteBase.bundleConfigs[1],
  );
  expectContractError(() => renderWechatBuildConfig({
    basePath: remoteBasePath,
    outputPath: remoteConfigPath,
    modeName: "remote",
    gate: "template",
  }), "output-already-exists");
  expectContractError(() => verifyWechatBuildConfigFile(remoteConfigPath, {
    gate: "production",
    expectedMode: "remote",
  }), "wechat-build-config-contract-invalid");
  assertRejectedCli(spawnSync(process.execPath, [
    configVerifierCli,
    "--config",
    remoteConfigPath,
    "--production",
    "--mode",
    "remote",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
  }), {
    code: "wechat-build-config-contract-invalid",
    failure: "packages.wechatgame.appid:sentinel-forbidden",
  });

  const credentialProbe = `wx${randomBytes(8).toString("hex")}`;
  const serverProbe = `https://${randomBytes(8).toString("hex")}.assets-corp.internal/`;
  const productionConfigPath = resolve(temporaryRoot, "remote.production.local.json");
  const cliResult = spawnSync(process.execPath, [
    rendererCli,
    "--base",
    remoteBasePath,
    "--output",
    productionConfigPath,
    "--mode",
    "remote",
    "--production",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      [profile.wechat.appIdEnv]: credentialProbe,
      [profile.wechat.remoteBaseUrlEnv]: serverProbe,
    },
  });
  assert.equal(cliResult.status, 0, cliResult.stderr);
  const cliOutput = `${cliResult.stdout}${cliResult.stderr}`;
  assert.equal(cliOutput.includes(credentialProbe), false);
  assert.equal(cliOutput.includes(serverProbe), false);
  const productionRendererCli = JSON.parse(cliResult.stdout);
  assert.deepEqual({
    gate: productionRendererCli.gate,
    mode: productionRendererCli.mode,
    releaseEligible: productionRendererCli.releaseEligible,
    nonRelease: productionRendererCli.nonRelease,
  }, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  const productionConfigVerification = verifyWechatBuildConfigFile(
    productionConfigPath,
    {
      gate: "production",
      expectedMode: "remote",
    },
  );
  assertEligibility(productionConfigVerification, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  const productionConfigInspection = inspectWechatBuildConfigFile(
    productionConfigPath,
    {
      gate: "production",
      expectedMode: "remote",
    },
  );
  assertEligibility(productionConfigInspection, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  assert.equal(productionConfigInspection.productionValid, true);
  const productionConfigCli = parseSuccessfulCliJson(spawnSync(
    process.execPath,
    [
      configVerifierCli,
      "--config",
      productionConfigPath,
      "--production",
      "--mode",
      "remote",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  ));
  assertEligibility(productionConfigCli, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  const productionConfig = JSON.parse(readFileSync(productionConfigPath, "utf8"));
  const emptyAppIdConfig = JSON.parse(JSON.stringify(productionConfig));
  emptyAppIdConfig.packages.wechatgame.appid = "";
  expectFailure(() => verifyWechatBuildConfig(emptyAppIdConfig, {
    gate: "production",
    expectedMode: "remote",
    profile,
  }), "packages.wechatgame.appid:production-shape-required");
  expectFailure(() => verifyWechatBuildOutput({
    config: emptyAppIdConfig,
    gate: "production",
    expectedMode: "remote",
    profile,
    outputRoot: resolve(temporaryRoot, "invalid-production-output-must-not-read"),
  }), "packages.wechatgame.appid:production-shape-required");
  const emptyAppIdConfigPath = resolve(
    temporaryRoot,
    "remote.production.empty-appid.local.json",
  );
  writeJson(emptyAppIdConfigPath, emptyAppIdConfig);
  for (const verifierCli of [configVerifierCli, outputVerifierCli]) {
    assertRejectedCli(spawnSync(process.execPath, [
      verifierCli,
      "--config",
      emptyAppIdConfigPath,
      "--production",
      "--mode",
      "remote",
    ], {
      cwd: projectRoot,
      encoding: "utf8",
    }), {
      code: "wechat-build-config-contract-invalid",
      failure: "packages.wechatgame.appid:production-shape-required",
    });
  }
  const nonHttpsConfig = JSON.parse(JSON.stringify(productionConfig));
  nonHttpsConfig.server = nonHttpsConfig.server.replace("https:", "http:");
  expectFailure(() => verifyWechatBuildConfig(nonHttpsConfig, {
    gate: "production",
    expectedMode: "remote",
    profile,
  }), "server:https-required");
  const invalidHostConfig = JSON.parse(JSON.stringify(productionConfig));
  invalidHostConfig.server = invalidHostConfig.server.replace(
    new URL(invalidHostConfig.server).hostname,
    "assets.invalid",
  );
  expectFailure(() => verifyWechatBuildConfig(invalidHostConfig, {
    gate: "production",
    expectedMode: "remote",
    profile,
  }), "server:sentinel-host-forbidden");
  const remoteConfigBundle = JSON.parse(JSON.stringify(remoteRender.rendered));
  remoteConfigBundle.bundleConfigs[1].isRemote = true;
  expectFailure(() => verifyWechatBuildConfig(remoteConfigBundle, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "bundleConfigs.config.isRemote:unexpected-value");
  const legacyConfigSubpackage = JSON.parse(JSON.stringify(remoteRender.rendered));
  legacyConfigSubpackage.packages.wechatgame.subpackages.push({
    name: "config",
    root: "subpackages/config/",
  });
  expectFailure(() => verifyWechatBuildConfig(legacyConfigSubpackage, {
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "packages.wechatgame.subpackages:config-bundle-forbidden");

  const remoteOutputRoot = resolve(remoteBuildPath, "wechatgame");
  createBundleFixture(remoteOutputRoot, remoteRender.rendered, "remote", profile);
  const firstRemoteOutput = verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  });
  const repeatedRemoteOutput = verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  });
  assertEligibility(firstRemoteOutput, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const templateOutputCli = parseSuccessfulCliJson(spawnSync(
    process.execPath,
    [
      outputVerifierCli,
      "--config",
      remoteConfigPath,
      "--template",
      "--mode",
      "remote",
      "--output",
      remoteOutputRoot,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  ));
  assertEligibility(templateOutputCli, {
    gate: "template",
    mode: "remote",
    releaseEligible: false,
    nonRelease: true,
  });
  const productionOutputRoot = resolve(temporaryRoot, "remote-production-output");
  createBundleFixture(productionOutputRoot, productionConfig, "remote", profile);
  const productionOutput = verifyWechatBuildOutput({
    config: productionConfig,
    gate: "production",
    expectedMode: "remote",
    profile,
    outputRoot: productionOutputRoot,
  });
  assertEligibility(productionOutput, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  const productionOutputCli = parseSuccessfulCliJson(spawnSync(
    process.execPath,
    [
      outputVerifierCli,
      "--config",
      productionConfigPath,
      "--production",
      "--mode",
      "remote",
      "--output",
      productionOutputRoot,
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
    },
  ));
  assertEligibility(productionOutputCli, {
    gate: "production",
    mode: "remote",
    releaseEligible: true,
    nonRelease: false,
  });
  assert.equal(firstRemoteOutput.tracedAssets, 207);
  assert.equal(firstRemoteOutput.configBundleManifestUuid, profile.configBundle.manifestUuid);
  assert.equal(firstRemoteOutput.treeSha256, repeatedRemoteOutput.treeSha256);
  assert.equal(firstRemoteOutput.packageSha256, repeatedRemoteOutput.packageSha256);

  const settingsPath = resolve(remoteOutputRoot, "src/settings.fixture.json");
  const remoteSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
  remoteSettings.assets.bundleVers.resources = "mismatched-version";
  writeJson(settingsPath, remoteSettings);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "remote/resources/config.mismatched-version.json:version-bound-generated-config-required");
  remoteSettings.assets.bundleVers.resources = resourcesFixtureVersion;
  writeJson(settingsPath, remoteSettings);

  const movedScriptPath = resolve(
    remoteOutputRoot,
    `src/bundle-scripts/resources/index.${resourcesFixtureVersion}.js`,
  );
  rmSync(movedScriptPath);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), `src/bundle-scripts/resources/index.${resourcesFixtureVersion}.js:version-bound-moved-script-required`);
  writeFileSync(movedScriptPath, "// fixture moved remote bundle entry\n", "utf8");

  remoteSettings.assets.projectBundles = ["resources"];
  writeJson(settingsPath, remoteSettings);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "settings.assets.projectBundles:bundle-required");
  remoteSettings.assets.projectBundles = ["resources", "config"];
  remoteSettings.assets.remoteBundles.push("config");
  writeJson(settingsPath, remoteSettings);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "settings.assets.remoteBundles:bundle-forbidden");
  remoteSettings.assets.remoteBundles = ["resources"];
  writeJson(settingsPath, remoteSettings);
  remoteSettings.assets.subpackages = ["config"];
  writeJson(settingsPath, remoteSettings);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "settings.assets.subpackages:bundle-forbidden");
  remoteSettings.assets.subpackages = [];
  writeJson(settingsPath, remoteSettings);

  const configBundleConfigPath = resolve(
    remoteOutputRoot,
    `assets/config/config.${configFixtureVersion}.json`,
  );
  const configBundleConfig = JSON.parse(
    readFileSync(configBundleConfigPath, "utf8"),
  );
  configBundleConfig.uuids = [];
  writeJson(configBundleConfigPath, configBundleConfig);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "configBundle.config:manifest-uuid-required");
  configBundleConfig.uuids = [profile.configBundle.manifestUuid];
  writeJson(configBundleConfigPath, configBundleConfig);
  const configBundleScriptPath = resolve(
    remoteOutputRoot,
    `assets/config/index.${configFixtureVersion}.js`,
  );
  rmSync(configBundleScriptPath);
  expectFailure(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), `assets/config/index.${configFixtureVersion}.js:version-bound-local-script-required`);
  writeFileSync(
    configBundleScriptPath,
    "// fixture local config bundle entry\n",
    "utf8",
  );

  mkdirSync(resolve(remoteOutputRoot, "assets/resources"), { recursive: true });
  expectContractError(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "wechat-build-output-layout-invalid");
  rmSync(resolve(remoteOutputRoot, "assets/resources"), { recursive: true });
  const bundleConfigPath = resolve(
    remoteOutputRoot,
    `remote/resources/config.${resourcesFixtureVersion}.json`,
  );
  const bundleConfig = JSON.parse(readFileSync(bundleConfigPath, "utf8"));
  delete bundleConfig.paths[manifest.assets[0].resourcePath];
  writeJson(bundleConfigPath, bundleConfig);
  expectContractError(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  }), "bundle-manifest-trace-invalid");
  writeJson(bundleConfigPath, {
    paths: Object.fromEntries(
      manifest.assets.map((asset, index) => [asset.resourcePath, [index, 0]]),
    ),
  });
  writeFileSync(
    resolve(remoteOutputRoot, "game.js"),
    "// fixture package entry changed\n",
    "utf8",
  );
  const changedRemoteOutput = verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
  });
  assert.notEqual(changedRemoteOutput.treeSha256, firstRemoteOutput.treeSha256);
  assert.notEqual(changedRemoteOutput.packageSha256, firstRemoteOutput.packageSha256);
  expectContractError(() => verifyWechatBuildOutput({
    config: remoteRender.rendered,
    gate: "template",
    expectedMode: "remote",
    profile,
    expectedTreeSha256: firstRemoteOutput.treeSha256,
  }), "build-tree-hash-mismatch");

  const subpackageBasePath = resolve(temporaryRoot, "subpackage-editor-export.json");
  const subpackageBuildPath = resolve(temporaryRoot, "subpackage-build");
  writeJson(subpackageBasePath, fullEditorConfig(subpackageBuildPath));
  const subpackageConfigPath = resolve(
    temporaryRoot,
    "subpackage-smoke.template.local.json",
  );
  expectContractError(() => renderWechatBuildConfig({
    basePath: subpackageBasePath,
    outputPath: subpackageConfigPath,
    modeName: "subpackage-smoke",
    gate: "template",
  }), "wechat-build-config-contract-invalid");
  const subpackageConfig = fullEditorConfig(subpackageBuildPath);
  const subpackageBundle = subpackageConfig.bundleConfigs.find(
    ({ name }) => name === profile.bundle.name,
  );
  Object.assign(subpackageBundle, {
    priority: profile.bundle.priority,
    ...profile.modes["subpackage-smoke"].bundleConfig,
  });
  const subpackageConfigBundle = subpackageConfig.bundleConfigs.find(
    ({ name }) => name === profile.configBundle.name,
  );
  Object.assign(subpackageConfigBundle, {
    priority: profile.configBundle.priority,
    ...profile.configBundle.bundleConfig,
  });
  Object.assign(
    subpackageConfig,
    profile.modes["subpackage-smoke"].buildOverrides,
  );
  subpackageConfig.packages.wechatgame.appid = profile.wechat.templateAppId;
  subpackageConfig.packages.wechatgame.wasmSubpackage = false;
  writeJson(subpackageConfigPath, subpackageConfig);
  expectFailure(() => verifyWechatBuildConfig(subpackageConfig, {
    gate: "template",
    expectedMode: "subpackage-smoke",
    profile,
  }), "mode:project-bundle-policy-incompatible");
  assertRejectedCli(spawnSync(process.execPath, [
    configVerifierCli,
    "--config",
    subpackageConfigPath,
    "--template",
    "--mode",
    "subpackage-smoke",
  ], {
    cwd: projectRoot,
    encoding: "utf8",
  }), {
    code: "wechat-build-config-contract-invalid",
    failure: "mode:project-bundle-policy-incompatible",
  });
  expectContractError(() => renderWechatBuildConfig({
    basePath: subpackageBasePath,
    outputPath: resolve(temporaryRoot, "must-not-render.local.json"),
    modeName: "subpackage-smoke",
    gate: "production",
    environment: {
      [profile.wechat.appIdEnv]: credentialProbe,
      [profile.wechat.remoteBaseUrlEnv]: serverProbe,
    },
  }), "render-mode-non-release");

  console.log(JSON.stringify({
    ok: true,
    creatorVersion: profile.creator.version,
    builderConfigVersion: profile.creator.builderConfigVersion,
    assets: manifest.assets.length,
    sourceResourceBytes: profile.source.resourceBytes,
    repositorySourceByteEvidenceBoundaryBytes:
      profile.wechat.repositorySourceByteEvidenceBoundaryBytes,
    configBundleLocalAndManifestTraced: true,
    bundleVersionFilesBound: true,
    officialCreator388ShapeCovered: true,
    templateRemoteNonRelease: true,
    productionRemoteReleaseEligible: true,
    eligibilityApiCliOutputBound: true,
    subpackageSmokeProjectPolicyRejected: true,
    remoteTreeHashStable: true,
    rendererCredentialRedaction: true,
    creatorInvoked: false,
  }, null, 2));
} finally {
  const expectedPrefix = `${resolve(tmpdir())}${sep}infinite-flow-wechat-bundle-test-`;
  if (temporaryRoot.startsWith(expectedPrefix)) {
    chmodSync(temporaryRoot, 0o700);
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
