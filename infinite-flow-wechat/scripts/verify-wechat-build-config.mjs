import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ToolchainBoundaryError,
  captureStableFile,
} from "./file-attestation.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const cocosProjectRoot = resolve(projectRoot, "cocos");
const defaultProfilePath = resolve(
  projectRoot,
  "toolchain/wechat-bundle-profiles.json",
);
const defaultBuilderSettingsPath = resolve(
  projectRoot,
  "cocos/settings/v2/packages/builder.json",
);
const defaultResourcesMetadataPath = resolve(
  projectRoot,
  "cocos/assets/resources.meta",
);
const defaultConfigMetadataPath = resolve(projectRoot, "cocos/assets/config.meta");
const compressionTypes = new Set([
  "none",
  "merge_dep",
  "merge_all_json",
  "subpackage",
  "zip",
]);
const nativeCodeBundleModes = new Set(["wasm", "asmjs", "both"]);
const orientations = new Set(["auto", "landscape", "portrait"]);
const expectedPinnedProfile = Object.freeze({
  schemaVersion: 1,
  creatorVersion: "3.8.8",
  builderConfigVersion: "1.3.9",
  platform: "wechatgame",
  manifestRevision:
    "sha256:c4a23d779df900b49cd9eae86d7be7ce5be7be03e6737e42e03cd0a3294b9ced",
  assetCount: 207,
  resourceBytes: 76_702_709,
  manifestPath: "cocos/assets/config/asset-manifest.json",
  bundleName: "resources",
  bundleUuid: "fb6cd6ef-57d2-4cf7-8286-327137b480cc",
  bundleMetadataPath: "cocos/assets/resources.meta",
  builderMetadataVersion: "1.2.0",
  bundleConfigID: "resources-remote-wechat-v1",
  builderSettingsPath: "cocos/settings/v2/packages/builder.json",
  priority: 8,
  configBundle: Object.freeze({
    name: "config",
    uuid: "fd882dc1-24c1-4b13-aac4-76960c1783ee",
    metadataPath: "cocos/assets/config.meta",
    metadataVersion: "1.2.0",
    bundleConfigID: "default",
    priority: 9,
    rootPolicy: "preserve-editor-generated",
    manifestPath: "asset-manifest",
    manifestUuid: "3d0842ec-43f7-4b5f-961f-39edb535ccd7",
    manifestMetadataPath: "cocos/assets/config/asset-manifest.json.meta",
    manifestMetadataVersion: "2.0.1",
    bundleConfig: Object.freeze({
      isRemote: false,
      compressionType: "merge_dep",
      output: true,
    }),
  }),
  appIdEnv: "COCOS_WECHAT_APPID",
  remoteBaseUrlEnv: "COCOS_WECHAT_REMOTE_BASE_URL",
  templateAppId: "wx0000000000000000",
  templateRemoteBaseUrl: "https://assets.invalid/",
  creatorDefaultAppIdSha256:
    "f7d04fb3a80b08dedbbc8c5129f468e320615941c98bfd187a445342c853eae7",
  remotePathPrefix: "infinite-flow/resources",
  repositorySourceByteEvidenceBoundaryBytes: 4_194_304,
});

export class WechatBuildContractError extends Error {
  constructor(code, failures = []) {
    super(code);
    this.name = "WechatBuildContractError";
    this.code = code;
    this.failures = Object.freeze([...failures]);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256String(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function addExactFailure(failures, actual, expected, path) {
  if (!sameJson(actual, expected)) failures.push(`${path}:unexpected-value`);
}

function parseJsonCapture(path) {
  const capture = captureStableFile(path, { includeContent: true });
  let parsed;
  try {
    parsed = JSON.parse(capture.content.toString("utf8"));
  } catch {
    throw new WechatBuildContractError("json-invalid", ["json:invalid"]);
  }
  return { capture, parsed };
}

function validatePinnedProfile(profile) {
  const failures = [];
  if (!isRecord(profile)) return ["profile:object-required"];
  addExactFailure(
    failures,
    profile.schemaVersion,
    expectedPinnedProfile.schemaVersion,
    "schemaVersion",
  );
  addExactFailure(
    failures,
    profile.creator?.version,
    expectedPinnedProfile.creatorVersion,
    "creator.version",
  );
  addExactFailure(
    failures,
    profile.creator?.builderConfigVersion,
    expectedPinnedProfile.builderConfigVersion,
    "creator.builderConfigVersion",
  );
  addExactFailure(
    failures,
    profile.creator?.platform,
    expectedPinnedProfile.platform,
    "creator.platform",
  );
  addExactFailure(
    failures,
    profile.source?.manifestRevision,
    expectedPinnedProfile.manifestRevision,
    "source.manifestRevision",
  );
  addExactFailure(
    failures,
    profile.source?.assetCount,
    expectedPinnedProfile.assetCount,
    "source.assetCount",
  );
  addExactFailure(
    failures,
    profile.source?.resourceBytes,
    expectedPinnedProfile.resourceBytes,
    "source.resourceBytes",
  );
  addExactFailure(
    failures,
    profile.source?.manifestPath,
    expectedPinnedProfile.manifestPath,
    "source.manifestPath",
  );
  addExactFailure(
    failures,
    profile.bundle?.name,
    expectedPinnedProfile.bundleName,
    "bundle.name",
  );
  addExactFailure(
    failures,
    profile.bundle?.uuid,
    expectedPinnedProfile.bundleUuid,
    "bundle.uuid",
  );
  addExactFailure(
    failures,
    profile.bundle?.metadataPath,
    expectedPinnedProfile.bundleMetadataPath,
    "bundle.metadataPath",
  );
  addExactFailure(
    failures,
    profile.bundle?.metadataVersion,
    expectedPinnedProfile.builderMetadataVersion,
    "bundle.metadataVersion",
  );
  addExactFailure(
    failures,
    profile.bundle?.bundleConfigID,
    expectedPinnedProfile.bundleConfigID,
    "bundle.bundleConfigID",
  );
  addExactFailure(
    failures,
    profile.bundle?.builderSettingsPath,
    expectedPinnedProfile.builderSettingsPath,
    "bundle.builderSettingsPath",
  );
  addExactFailure(
    failures,
    profile.bundle?.priority,
    expectedPinnedProfile.priority,
    "bundle.priority",
  );
  addExactFailure(
    failures,
    profile.bundle?.rootPolicy,
    "preserve-editor-generated",
    "bundle.rootPolicy",
  );
  for (const [field, expected] of Object.entries(
    expectedPinnedProfile.configBundle,
  )) {
    addExactFailure(
      failures,
      profile.configBundle?.[field],
      expected,
      `configBundle.${field}`,
    );
  }
  if (profile.configBundle?.name === profile.bundle?.name) {
    failures.push("configBundle.name:must-differ-from-resources-bundle");
  }
  for (const [field, expected] of [
    ["appIdEnv", expectedPinnedProfile.appIdEnv],
    ["remoteBaseUrlEnv", expectedPinnedProfile.remoteBaseUrlEnv],
    ["templateAppId", expectedPinnedProfile.templateAppId],
    ["templateRemoteBaseUrl", expectedPinnedProfile.templateRemoteBaseUrl],
    ["creatorDefaultAppIdSha256", expectedPinnedProfile.creatorDefaultAppIdSha256],
    ["remotePathPrefix", expectedPinnedProfile.remotePathPrefix],
  ]) {
    addExactFailure(failures, profile.wechat?.[field], expected, `wechat.${field}`);
  }
  addExactFailure(
    failures,
    profile.wechat?.repositorySourceByteEvidenceBoundaryBytes,
    expectedPinnedProfile.repositorySourceByteEvidenceBoundaryBytes,
    "wechat.repositorySourceByteEvidenceBoundaryBytes",
  );
  if (
    profile.source?.resourceBytes
    <= profile.wechat?.repositorySourceByteEvidenceBoundaryBytes
  ) {
    failures.push("source.resourceBytes:must-exceed-repository-source-byte-evidence-boundary");
  }

  const requiredPackageFields = [
    "appid",
    "buildOpenDataContextTemplate",
    "orientation",
    "separateEngine",
    "highPerformanceMode",
    "wasmSubpackage",
  ];
  if (
    !Array.isArray(profile.wechat?.requiredPackageFields)
    || !sameJson(
      [...profile.wechat.requiredPackageFields].sort(),
      [...requiredPackageFields].sort(),
    )
  ) {
    failures.push("wechat.requiredPackageFields:unexpected-value");
  }
  if (!/^wx[0-9a-f]{16}$/i.test(profile.wechat?.templateAppId ?? "")) {
    failures.push("wechat.templateAppId:invalid-shape");
  }
  if (!/^[0-9a-f]{64}$/.test(profile.wechat?.creatorDefaultAppIdSha256 ?? "")) {
    failures.push("wechat.creatorDefaultAppIdSha256:sha256-required");
  }
  for (const name of ["remote", "subpackage-smoke"]) {
    if (!isRecord(profile.modes?.[name])) failures.push(`modes.${name}:missing`);
  }
  addExactFailure(
    failures,
    profile.modes?.remote?.releaseEligible,
    true,
    "modes.remote.releaseEligible",
  );
  addExactFailure(
    failures,
    profile.modes?.remote?.label,
    "REMOTE_RELEASE",
    "modes.remote.label",
  );
  addExactFailure(
    failures,
    profile.modes?.remote?.bundleConfig,
    { isRemote: true, compressionType: "merge_dep", output: true },
    "modes.remote.bundleConfig",
  );
  addExactFailure(
    failures,
    profile.modes?.remote?.buildOverrides,
    {
      mainBundleIsRemote: false,
      useBuiltinServer: false,
      startSceneAssetBundle: false,
      moveRemoteBundleScript: true,
      md5Cache: true,
    },
    "modes.remote.buildOverrides",
  );
  addExactFailure(
    failures,
    profile.modes?.["subpackage-smoke"]?.releaseEligible,
    false,
    "modes.subpackage-smoke.releaseEligible",
  );
  addExactFailure(
    failures,
    profile.modes?.["subpackage-smoke"]?.projectPolicyCompatible,
    false,
    "modes.subpackage-smoke.projectPolicyCompatible",
  );
  addExactFailure(
    failures,
    profile.modes?.["subpackage-smoke"]?.label,
    "NON_RELEASE_SUBPACKAGE_SMOKE",
    "modes.subpackage-smoke.label",
  );
  addExactFailure(
    failures,
    profile.modes?.["subpackage-smoke"]?.bundleConfig,
    { isRemote: false, compressionType: "subpackage", output: true },
    "modes.subpackage-smoke.bundleConfig",
  );
  addExactFailure(
    failures,
    profile.modes?.["subpackage-smoke"]?.buildOverrides,
    {
      mainBundleIsRemote: false,
      useBuiltinServer: false,
      startSceneAssetBundle: false,
      moveRemoteBundleScript: true,
      md5Cache: true,
      server: "",
    },
    "modes.subpackage-smoke.buildOverrides",
  );
  const nonReleaseReason = profile.modes?.["subpackage-smoke"]?.reason;
  if (
    typeof nonReleaseReason !== "string"
    || !nonReleaseReason.includes("statically bound")
    || !nonReleaseReason.includes("every config verification gate rejects it")
  ) {
    failures.push("modes.subpackage-smoke.reason:static-policy-disclaimer-required");
  }
  return failures;
}

const localMergeDepOptions = Object.freeze({
  isRemote: false,
  compressionType: "merge_dep",
});

export function validateProjectBundlePolicy(
  profile,
  { builderSettings, resourcesMetadata, configMetadata },
) {
  const failures = [];
  const presetID = profile?.bundle?.bundleConfigID;
  if (!nonEmptyString(presetID) || presetID === "default") {
    failures.push("bundle.bundleConfigID:custom-non-default-required");
  }
  addExactFailure(
    failures,
    resourcesMetadata?.userData?.bundleConfigID,
    presetID,
    "resources.meta.userData.bundleConfigID",
  );
  addExactFailure(
    failures,
    resourcesMetadata?.userData?.isBundle,
    true,
    "resources.meta.userData.isBundle",
  );
  addExactFailure(
    failures,
    resourcesMetadata?.userData?.bundleName,
    profile?.bundle?.name,
    "resources.meta.userData.bundleName",
  );
  addExactFailure(
    failures,
    configMetadata?.userData?.bundleConfigID,
    "default",
    "config.meta.userData.bundleConfigID",
  );
  if (configMetadata?.userData?.bundleConfigID === presetID) {
    failures.push("config.meta.userData.bundleConfigID:resources-preset-sharing-forbidden");
  }

  addExactFailure(
    failures,
    builderSettings?.__version__,
    profile?.creator?.builderConfigVersion,
    "builder.__version__",
  );
  const preset = builderSettings?.bundleConfig?.custom?.[presetID];
  if (!isRecord(preset)) {
    failures.push("builder.bundleConfig.custom.resources-preset:missing");
    return failures;
  }
  const configs = preset.configs;
  if (!isRecord(configs)) {
    failures.push("builder.bundleConfig.custom.resources-preset.configs:missing");
    return failures;
  }
  for (const platform of ["native", "web"]) {
    addExactFailure(
      failures,
      configs[platform]?.preferredOptions,
      localMergeDepOptions,
      `builder.resources-preset.configs.${platform}.preferredOptions`,
    );
    addExactFailure(
      failures,
      configs[platform]?.fallbackOptions,
      localMergeDepOptions,
      `builder.resources-preset.configs.${platform}.fallbackOptions`,
    );
  }
  addExactFailure(
    failures,
    configs.miniGame?.preferredOptions,
    localMergeDepOptions,
    "builder.resources-preset.configs.miniGame.preferredOptions",
  );
  addExactFailure(
    failures,
    configs.miniGame?.fallbackOptions,
    localMergeDepOptions,
    "builder.resources-preset.configs.miniGame.fallbackOptions",
  );
  addExactFailure(
    failures,
    configs.miniGame?.configMode,
    "overwrite",
    "builder.resources-preset.configs.miniGame.configMode",
  );
  addExactFailure(
    failures,
    configs.miniGame?.overwriteSettings,
    { wechatgame: { isRemote: true, compressionType: "merge_dep" } },
    "builder.resources-preset.configs.miniGame.overwriteSettings",
  );
  return failures;
}

function assertProjectBundlePolicy(profile) {
  let policy;
  try {
    policy = {
      builderSettings: parseJsonCapture(defaultBuilderSettingsPath).parsed,
      resourcesMetadata: parseJsonCapture(defaultResourcesMetadataPath).parsed,
      configMetadata: parseJsonCapture(defaultConfigMetadataPath).parsed,
    };
  } catch (error) {
    if (error instanceof WechatBuildContractError) throw error;
    throw new WechatBuildContractError("project-bundle-policy-unreadable", [
      "projectBundlePolicy:unreadable",
    ]);
  }
  const failures = validateProjectBundlePolicy(profile, policy);
  if (failures.length > 0) {
    throw new WechatBuildContractError("project-bundle-policy-invalid", failures);
  }
}

export function loadWechatBundleProfiles(path = defaultProfilePath) {
  let captured;
  try {
    captured = parseJsonCapture(path);
  } catch (error) {
    if (error instanceof WechatBuildContractError) throw error;
    const code = error instanceof ToolchainBoundaryError
      ? error.code
      : "profile-unreadable";
    throw new WechatBuildContractError(code, ["profile:unreadable"]);
  }
  const failures = validatePinnedProfile(captured.parsed);
  if (failures.length > 0) {
    throw new WechatBuildContractError("profile-contract-invalid", failures);
  }
  assertProjectBundlePolicy(captured.parsed);
  return Object.freeze({
    path: captured.capture.canonicalPath,
    sha256: captured.capture.sha256,
    profile: captured.parsed,
  });
}

function inspectEditorConfigShape(config, profile) {
  const failures = [];
  if (!isRecord(config)) {
    return { failures: ["config:object-required"], bundle: null };
  }
  addExactFailure(
    failures,
    config.__version__,
    profile.creator.builderConfigVersion,
    "__version__",
  );
  addExactFailure(
    failures,
    config.platform,
    profile.creator.platform,
    "platform",
  );

  for (const field of [
    "taskName",
    "startScene",
    "buildPath",
    "name",
    "outputName",
  ]) {
    if (!nonEmptyString(config[field])) failures.push(`${field}:nonempty-string-required`);
  }
  for (const field of [
    "skipCompressTexture",
    "experimentalEraseModules",
    "bundleCommonChunk",
    "debug",
    "mangleProperties",
    "inlineEnum",
    "md5Cache",
    "mainBundleIsRemote",
    "useBuiltinServer",
    "startSceneAssetBundle",
  ]) {
    if (typeof config[field] !== "boolean") failures.push(`${field}:boolean-required`);
  }
  for (const field of ["inlineSpriteFrames", "moveRemoteBundleScript"]) {
    if (config[field] !== undefined && typeof config[field] !== "boolean") {
      failures.push(`${field}:boolean-required`);
    }
  }
  if (
    typeof config.sourceMaps !== "boolean"
    && !["inline", "false"].includes(config.sourceMaps)
  ) {
    failures.push("sourceMaps:boolean-inline-or-false-string-required");
  }
  if (!compressionTypes.has(config.mainBundleCompressionType)) {
    failures.push("mainBundleCompressionType:unsupported");
  }
  if (!nativeCodeBundleModes.has(config.nativeCodeBundleMode)) {
    failures.push("nativeCodeBundleMode:unsupported");
  }
  if (config.customLayers !== undefined && !Array.isArray(config.customLayers)) {
    failures.push("customLayers:array-required");
  }
  if (config.sortingLayers !== undefined && !Array.isArray(config.sortingLayers)) {
    failures.push("sortingLayers:array-required");
  }
  if (config.splashScreen !== undefined && !isRecord(config.splashScreen)) {
    failures.push("splashScreen:object-required");
  }
  if (config.resolution !== undefined && !isRecord(config.resolution)) {
    failures.push("resolution:object-required");
  } else if (config.resolution !== undefined) {
    for (const field of ["width", "height", "policy"]) {
      if (!Number.isFinite(config.resolution[field])) {
        failures.push(`resolution.${field}:finite-number-required`);
      }
    }
  }
  if (!Array.isArray(config.scenes) || config.scenes.length === 0) {
    failures.push("scenes:nonempty-array-required");
  } else {
    config.scenes.forEach((scene, index) => {
      if (!isRecord(scene)) {
        failures.push(`scenes.${index}:object-required`);
        return;
      }
      if (!nonEmptyString(scene.url)) failures.push(`scenes.${index}.url:required`);
      if (scene.uuid !== undefined && !nonEmptyString(scene.uuid)) {
        failures.push(`scenes.${index}.uuid:nonempty-string-required`);
      }
    });
  }

  const wechat = config.packages?.wechatgame;
  if (!isRecord(config.packages) || !isRecord(wechat)) {
    failures.push("packages.wechatgame:object-required");
  } else {
    if (typeof wechat.appid !== "string") failures.push("packages.wechatgame.appid:string-required");
    if (
      typeof wechat.buildOpenDataContextTemplate !== "boolean"
      && wechat.buildOpenDataContextTemplate !== ""
    ) {
      failures.push(
        "packages.wechatgame.buildOpenDataContextTemplate:boolean-or-empty-string-required",
      );
    }
    for (const field of ["separateEngine", "highPerformanceMode"]) {
      if (typeof wechat[field] !== "boolean") {
        failures.push(`packages.wechatgame.${field}:boolean-required`);
      }
    }
    if (
      wechat.wasmSubpackage !== undefined
      && typeof wechat.wasmSubpackage !== "boolean"
    ) {
      failures.push("packages.wechatgame.wasmSubpackage:boolean-required");
    }
    if (!orientations.has(wechat.orientation)) {
      failures.push("packages.wechatgame.orientation:unsupported");
    }
    if (wechat.subpackages !== undefined) {
      if (!Array.isArray(wechat.subpackages)) {
        failures.push("packages.wechatgame.subpackages:array-required");
      } else {
        for (const item of wechat.subpackages) {
          if (!isRecord(item) || !nonEmptyString(item.name) || !nonEmptyString(item.root)) {
            failures.push("packages.wechatgame.subpackages:invalid-entry");
            continue;
          }
          if (item.name === profile.bundle.name) {
            failures.push("packages.wechatgame.subpackages:legacy-resources-entry-forbidden");
          }
          if (
            item.name === profile.configBundle.name
            || item.root === `subpackages/${profile.configBundle.name}/`
          ) {
            failures.push("packages.wechatgame.subpackages:config-bundle-forbidden");
          }
        }
      }
    }
  }

  let bundle = null;
  let configBundle = null;
  if (!Array.isArray(config.bundleConfigs)) {
    failures.push("bundleConfigs:editor-exported-array-required");
  } else {
    const names = new Set();
    config.bundleConfigs.forEach((candidate, index) => {
      if (!isRecord(candidate)) {
        failures.push(`bundleConfigs.${index}:object-required`);
        return;
      }
      if (!nonEmptyString(candidate.name)) {
        failures.push(`bundleConfigs.${index}.name:nonempty-string-required`);
      } else if (names.has(candidate.name)) {
        failures.push(`bundleConfigs.${candidate.name}:duplicate-name-forbidden`);
      } else {
        names.add(candidate.name);
      }
      if (typeof candidate.root !== "string") {
        failures.push(`bundleConfigs.${candidate.name ?? index}.root:string-required`);
      }
      if (candidate.priority !== undefined && !Number.isFinite(candidate.priority)) {
        failures.push(`bundleConfigs.${candidate.name ?? index}.priority:number-required`);
      }
      if (candidate.isRemote !== undefined && typeof candidate.isRemote !== "boolean") {
        failures.push(`bundleConfigs.${candidate.name ?? index}.isRemote:boolean-required`);
      }
      if (
        candidate.compressionType !== undefined
        && !compressionTypes.has(candidate.compressionType)
      ) {
        failures.push(`bundleConfigs.${candidate.name ?? index}.compressionType:unsupported`);
      }
      if (candidate.output !== undefined && typeof candidate.output !== "boolean") {
        failures.push(`bundleConfigs.${candidate.name ?? index}.output:boolean-required`);
      }
    });

    const matches = config.bundleConfigs.filter(
      (candidate) => isRecord(candidate) && candidate.name === profile.bundle.name,
    );
    if (matches.length !== 1) {
      failures.push("bundleConfigs.resources:exactly-one-required");
    } else {
      [bundle] = matches;
      addExactFailure(
        failures,
        bundle.uuid,
        profile.bundle.uuid,
        "bundleConfigs.resources.uuid",
      );
      if (!nonEmptyString(bundle.root)) {
        failures.push("bundleConfigs.resources.root:editor-generated-value-required");
      }
      addExactFailure(
        failures,
        bundle.output,
        true,
        "bundleConfigs.resources.output",
      );
    }

    const configMatches = config.bundleConfigs.filter(
      (candidate) => (
        isRecord(candidate)
        && candidate.name === profile.configBundle.name
      ),
    );
    if (configMatches.length !== 1) {
      failures.push("bundleConfigs.config:exactly-one-required");
    } else {
      [configBundle] = configMatches;
      addExactFailure(
        failures,
        configBundle.uuid,
        profile.configBundle.uuid,
        "bundleConfigs.config.uuid",
      );
      if (!nonEmptyString(configBundle.root)) {
        failures.push("bundleConfigs.config.root:editor-generated-value-required");
      }
      addExactFailure(
        failures,
        configBundle.output,
        true,
        "bundleConfigs.config.output",
      );
    }
  }
  return { failures, bundle, configBundle };
}

export function assertFullEditorBuildConfig(config, profile) {
  const inspection = inspectEditorConfigShape(config, profile);
  if (inspection.failures.length > 0) {
    throw new WechatBuildContractError(
      "editor-build-config-incomplete",
      inspection.failures,
    );
  }
  return inspection.bundle;
}

export function manifestRevisionToken(profile) {
  return profile.source.manifestRevision.slice("sha256:".length);
}

export function makeVersionedRemoteServer(baseUrl, profile) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new WechatBuildContractError("remote-base-url-invalid", [
      "remoteBaseUrl:absolute-url-required",
    ]);
  }
  if (parsed.username || parsed.password) {
    throw new WechatBuildContractError("remote-base-url-invalid", [
      "remoteBaseUrl:credentials-forbidden",
    ]);
  }
  parsed.search = "";
  parsed.hash = "";
  const basePath = parsed.pathname.replace(/^\/+|\/+$/g, "");
  const suffix = [
    profile.wechat.remotePathPrefix.replace(/^\/+|\/+$/g, ""),
    manifestRevisionToken(profile),
  ].filter(Boolean).join("/");
  parsed.pathname = `/${[basePath, suffix].filter(Boolean).join("/")}/`;
  return parsed.toString();
}

export function templateRemoteServer(profile) {
  return makeVersionedRemoteServer(profile.wechat.templateRemoteBaseUrl, profile);
}

function inferMode(config, bundle, profile) {
  for (const [name, mode] of Object.entries(profile.modes)) {
    if (
      bundle.isRemote === mode.bundleConfig.isRemote
      && bundle.compressionType === mode.bundleConfig.compressionType
      && bundle.output === mode.bundleConfig.output
    ) {
      return name;
    }
  }
  return null;
}

function isReservedProductionAppId(appid, profile) {
  return appid === profile.wechat.templateAppId
    || sha256String(appid) === profile.wechat.creatorDefaultAppIdSha256
    || /(?:placeholder|changeme|dummy|sample|template|invalid)/i.test(appid);
}

function validateProductionServer(server, profile, failures) {
  if (!nonEmptyString(server)) {
    failures.push("server:nonempty-production-url-required");
    return;
  }
  let parsed;
  try {
    parsed = new URL(server);
  } catch {
    failures.push("server:absolute-url-required");
    return;
  }
  if (parsed.protocol !== "https:") failures.push("server:https-required");
  if (parsed.username || parsed.password) failures.push("server:credentials-forbidden");
  if (parsed.search || parsed.hash) failures.push("server:query-and-fragment-forbidden");
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname === "example.com"
    || hostname.endsWith(".example.com")
    || hostname === "example.net"
    || hostname.endsWith(".example.net")
    || hostname === "example.org"
    || hostname.endsWith(".example.org")
    || hostname.endsWith(".invalid")
    || hostname.endsWith(".test")
  ) {
    failures.push("server:sentinel-host-forbidden");
  }
  const requiredSuffix = `/${profile.wechat.remotePathPrefix.replace(/^\/+|\/+$/g, "")}/${manifestRevisionToken(profile)}/`;
  if (!parsed.pathname.endsWith(requiredSuffix)) {
    failures.push("server:manifest-versioned-path-required");
  }
  if (!server.endsWith("/")) failures.push("server:trailing-slash-required");
}

export function verifyWechatBuildConfig(
  config,
  { gate, expectedMode, profile },
) {
  if (gate !== "template" && gate !== "production") {
    throw new WechatBuildContractError("verification-gate-invalid", [
      "gate:template-or-production-required",
    ]);
  }
  const bundle = assertFullEditorBuildConfig(config, profile);
  const configBundle = config.bundleConfigs.find(
    (candidate) => candidate?.name === profile.configBundle.name,
  );
  const failures = [];
  const modeName = inferMode(config, bundle, profile);
  if (modeName === null) failures.push("mode:profile-state-unrecognized");
  if (expectedMode !== undefined && modeName !== expectedMode) {
    failures.push("mode:does-not-match-requested-profile");
  }
  const mode = modeName === null ? null : profile.modes[modeName];
  if (mode?.projectPolicyCompatible === false) {
    failures.push("mode:project-bundle-policy-incompatible");
  }
  if (mode) {
    addExactFailure(
      failures,
      bundle.priority,
      profile.bundle.priority,
      "bundleConfigs.resources.priority",
    );
    for (const [field, expected] of Object.entries(mode.bundleConfig)) {
      addExactFailure(
        failures,
        bundle[field],
        expected,
        `bundleConfigs.resources.${field}`,
      );
    }
    for (const [field, expected] of Object.entries(mode.buildOverrides)) {
      addExactFailure(failures, config[field], expected, field);
    }
  }
  addExactFailure(
    failures,
    configBundle.priority,
    profile.configBundle.priority,
    "bundleConfigs.config.priority",
  );
  for (const [field, expected] of Object.entries(
    profile.configBundle.bundleConfig,
  )) {
    addExactFailure(
      failures,
      configBundle[field],
      expected,
      `bundleConfigs.config.${field}`,
    );
  }
  for (const candidate of config.bundleConfigs) {
    if (
      candidate.name !== profile.bundle.name
      && (
        candidate.isRemote === true
        || candidate.compressionType === "subpackage"
      )
    ) {
      failures.push("bundleConfigs.remote-or-subpackage:resources-only");
    }
  }
  addExactFailure(
    failures,
    bundle.uuid,
    profile.bundle.uuid,
    "bundleConfigs.resources.uuid",
  );
  addExactFailure(
    failures,
    configBundle.uuid,
    profile.configBundle.uuid,
    "bundleConfigs.config.uuid",
  );
  if (!nonEmptyString(bundle.root)) {
    failures.push("bundleConfigs.resources.root:editor-generated-value-required");
  }
  if (!nonEmptyString(configBundle.root)) {
    failures.push("bundleConfigs.config.root:editor-generated-value-required");
  }
  if (bundle.root === configBundle.root) {
    failures.push("bundleConfigs.config.root:must-differ-from-resources-bundle");
  }
  if (typeof config.packages.wechatgame.wasmSubpackage !== "boolean") {
    failures.push("packages.wechatgame.wasmSubpackage:boolean-required");
  }

  const appid = config.packages.wechatgame.appid;
  if (gate === "template") {
    addExactFailure(
      failures,
      appid,
      profile.wechat.templateAppId,
      "packages.wechatgame.appid",
    );
    if (modeName === "remote") {
      addExactFailure(
        failures,
        config.server,
        templateRemoteServer(profile),
        "server",
      );
    }
  } else {
    if (!mode?.releaseEligible) failures.push("mode:non-release-profile-forbidden");
    if (!/^wx[0-9a-f]{16}$/i.test(appid)) {
      failures.push("packages.wechatgame.appid:production-shape-required");
    } else if (isReservedProductionAppId(appid, profile)) {
      failures.push("packages.wechatgame.appid:sentinel-forbidden");
    }
    if (modeName === "remote") validateProductionServer(config.server, profile, failures);
  }

  if (failures.length > 0) {
    throw new WechatBuildContractError("wechat-build-config-contract-invalid", failures);
  }
  const releaseEligible = gate === "production"
    && modeName === "remote"
    && mode.releaseEligible === true;
  return Object.freeze({
    ok: true,
    gate,
    mode: modeName,
    releaseEligible,
    nonRelease: !releaseEligible,
    bundleRoot: bundle.root,
    configBundleRoot: configBundle.root,
  });
}

export function verifyWechatBuildConfigFile(
  path,
  { gate, expectedMode, profilePath = defaultProfilePath } = {},
) {
  const loadedProfile = loadWechatBundleProfiles(profilePath);
  let captured;
  try {
    captured = parseJsonCapture(path);
  } catch (error) {
    if (error instanceof WechatBuildContractError) throw error;
    const code = error instanceof ToolchainBoundaryError
      ? error.code
      : "build-config-unreadable";
    throw new WechatBuildContractError(code, ["config:unreadable"]);
  }
  const verification = verifyWechatBuildConfig(captured.parsed, {
    gate,
    expectedMode,
    profile: loadedProfile.profile,
  });
  return Object.freeze({
    ...verification,
    config: captured.parsed,
    configSha256: captured.capture.sha256,
    configCanonicalPath: captured.capture.canonicalPath,
    profile: loadedProfile.profile,
    profileSha256: loadedProfile.sha256,
  });
}

export function inspectWechatBuildConfigFile(
  path,
  { gate = "production", expectedMode, profilePath = defaultProfilePath } = {},
) {
  try {
    const result = verifyWechatBuildConfigFile(path, {
      gate,
      expectedMode,
      profilePath,
    });
    return Object.freeze({
      present: true,
      attested: true,
      validWechatTarget: true,
      productionValid: result.releaseEligible,
      gate,
      mode: result.mode,
      releaseEligible: result.releaseEligible,
      nonRelease: result.nonRelease,
      sha256: result.configSha256,
      canonicalPath: result.configCanonicalPath,
      error: null,
      failures: [],
    });
  } catch (error) {
    return Object.freeze({
      present: true,
      attested: !(error instanceof ToolchainBoundaryError),
      validWechatTarget: false,
      productionValid: false,
      gate,
      mode: null,
      releaseEligible: false,
      nonRelease: true,
      error: error instanceof WechatBuildContractError
        ? error.code
        : "build-config-unreadable",
      failures: error instanceof WechatBuildContractError
        ? [...error.failures]
        : ["config:unreadable"],
    });
  }
}

export function resolveWechatBuildOutputRoot(
  config,
  baseCocosProjectRoot = cocosProjectRoot,
) {
  if (!nonEmptyString(config?.buildPath) || !nonEmptyString(config?.outputName)) {
    throw new WechatBuildContractError("build-output-path-invalid", [
      "buildPath-and-outputName:required",
    ]);
  }
  let buildPath = config.buildPath;
  if (buildPath.startsWith("project://")) {
    buildPath = resolve(baseCocosProjectRoot, buildPath.slice("project://".length));
  } else if (!isAbsolute(buildPath)) {
    buildPath = resolve(baseCocosProjectRoot, buildPath);
  }
  return resolve(buildPath, config.outputName);
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--template" || argument === "--production") {
      if (options.gate) throw new WechatBuildContractError("cli-invalid", ["gate:duplicate"]);
      options.gate = argument.slice(2);
      continue;
    }
    if (["--config", "--mode", "--profile-file"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new WechatBuildContractError("cli-invalid", [`${argument}:value-required`]);
      }
      const key = argument === "--config"
        ? "configPath"
        : argument === "--mode"
          ? "expectedMode"
          : "profilePath";
      if (options[key] !== undefined) {
        throw new WechatBuildContractError("cli-invalid", [`${argument}:duplicate`]);
      }
      options[key] = value;
      index += 1;
      continue;
    }
    throw new WechatBuildContractError("cli-invalid", ["argument:unsupported"]);
  }
  if (!options.gate || !options.configPath) {
    throw new WechatBuildContractError("cli-invalid", [
      "usage: --config FILE (--template|--production) [--mode MODE]",
    ]);
  }
  return options;
}

function isMainModule() {
  return Boolean(process.argv[1])
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const options = parseCli(process.argv.slice(2));
    const result = verifyWechatBuildConfigFile(options.configPath, {
      gate: options.gate,
      expectedMode: options.expectedMode,
      profilePath: options.profilePath,
    });
    console.log(JSON.stringify({
      ok: true,
      gate: result.gate,
      mode: result.mode,
      releaseEligible: result.releaseEligible,
      nonRelease: result.nonRelease,
      creatorVersion: result.profile.creator.version,
      builderConfigVersion: result.profile.creator.builderConfigVersion,
      configSha256: result.configSha256,
      profileSha256: result.profileSha256,
    }, null, 2));
  } catch (error) {
    const code = error instanceof WechatBuildContractError
      ? error.code
      : "wechat-build-config-verification-failed";
    const failures = error instanceof WechatBuildContractError
      ? error.failures
      : ["verification:failed"];
    console.error(JSON.stringify({ ok: false, code, failures }, null, 2));
    process.exitCode = 1;
  }
}
