import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  WechatBuildContractError,
  assertFullEditorBuildConfig,
  loadWechatBundleProfiles,
} from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const defaultProfilePath = resolve(
  projectRoot,
  "toolchain/wechat-bundle-profiles.json",
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function statIdentity(stat) {
  return Object.freeze({
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: stat.mode.toString(),
    nlink: stat.nlink.toString(),
    uid: stat.uid.toString(),
    gid: stat.gid.toString(),
    rdev: stat.rdev.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    ctimeNs: stat.ctimeNs.toString(),
  });
}

function sameIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function sameFilesystemObject(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function fragmentFailure(code, index, detail) {
  throw new WechatBuildContractError(code, [`fragments.${index}:${detail}`]);
}

/**
 * Capture bytes from the configured pathname itself. Unlike realpath-based
 * helpers, this intentionally rejects a symbolic-link leaf before opening it.
 */
function captureStableNoFollowFile(configuredPath, index) {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    fragmentFailure(
      "editor-fragment-capture-unsupported",
      index,
      "o_nofollow-required",
    );
  }
  if (!nonEmptyString(configuredPath)) {
    fragmentFailure("editor-fragment-path-invalid", index, "path-required");
  }

  const absolutePath = resolve(configuredPath);
  let pathBefore;
  try {
    pathBefore = lstatSync(absolutePath, { bigint: true });
  } catch {
    fragmentFailure("editor-fragment-unreadable", index, "regular-file-required");
  }
  if (pathBefore.isSymbolicLink()) {
    fragmentFailure("editor-fragment-symlink-forbidden", index, "symlink-forbidden");
  }
  if (!pathBefore.isFile()) {
    fragmentFailure("editor-fragment-unreadable", index, "regular-file-required");
  }

  let descriptor;
  try {
    descriptor = openSync(
      absolutePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    const descriptorBefore = fstatSync(descriptor, { bigint: true });
    if (
      !descriptorBefore.isFile()
      || !sameIdentity(statIdentity(pathBefore), statIdentity(descriptorBefore))
    ) {
      fragmentFailure(
        "editor-fragment-capture-unstable",
        index,
        "pathname-fd-identity-binding-required",
      );
    }

    const bytes = readFileSync(descriptor);
    const descriptorAfter = fstatSync(descriptor, { bigint: true });
    let pathAfter;
    try {
      pathAfter = lstatSync(absolutePath, { bigint: true });
    } catch {
      fragmentFailure(
        "editor-fragment-capture-unstable",
        index,
        "pathname-stability-required",
      );
    }
    if (
      pathAfter.isSymbolicLink()
      || !pathAfter.isFile()
      || !sameIdentity(
        statIdentity(descriptorBefore),
        statIdentity(descriptorAfter),
      )
      || !sameIdentity(statIdentity(descriptorBefore), statIdentity(pathAfter))
    ) {
      fragmentFailure(
        "editor-fragment-capture-unstable",
        index,
        "stable-no-follow-capture-required",
      );
    }
    return Object.freeze({ bytes, sha256: sha256(bytes) });
  } catch (error) {
    if (error instanceof WechatBuildContractError) throw error;
    fragmentFailure("editor-fragment-unreadable", index, "no-follow-read-required");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function parseCapturedFragment(capture, index) {
  let parsed;
  try {
    parsed = JSON.parse(capture.bytes.toString("utf8"));
  } catch {
    fragmentFailure("editor-fragment-invalid-json", index, "valid-json-required");
  }
  if (!isRecord(parsed)) {
    fragmentFailure("editor-fragment-shape-invalid", index, "object-required");
  }
  return Object.freeze({ parsed, sha256: capture.sha256 });
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

function withoutBundleConfigs(config) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => key !== "bundleConfigs"),
  );
}

function assertOfficialEditorFragment(config, index, profile) {
  const failures = [];
  if (config.__version__ !== profile.creator.builderConfigVersion) {
    failures.push(`fragments.${index}.__version__:profile-version-required`);
  }
  if (config.platform !== profile.creator.platform) {
    failures.push(`fragments.${index}.platform:profile-platform-required`);
  }
  for (const field of [
    "taskName",
    "startScene",
    "buildPath",
    "name",
    "outputName",
  ]) {
    if (!nonEmptyString(config[field])) {
      failures.push(`fragments.${index}.${field}:nonempty-string-required`);
    }
  }
  if (!Array.isArray(config.scenes) || config.scenes.length === 0) {
    failures.push(`fragments.${index}.scenes:nonempty-array-required`);
  } else {
    config.scenes.forEach((scene, sceneIndex) => {
      if (
        !isRecord(scene)
        || !nonEmptyString(scene.url)
        || !nonEmptyString(scene.uuid)
      ) {
        failures.push(
          `fragments.${index}.scenes.${sceneIndex}:editor-scene-required`,
        );
      }
    });
  }
  if (!isRecord(config.packages) || !isRecord(config.packages.wechatgame)) {
    failures.push(`fragments.${index}.packages.wechatgame:object-required`);
  } else if (typeof config.packages.wechatgame.appid !== "string") {
    failures.push(`fragments.${index}.packages.wechatgame.appid:string-required`);
  }
  if (!Array.isArray(config.bundleConfigs)) {
    failures.push(`fragments.${index}.bundleConfigs:array-required`);
  } else {
    config.bundleConfigs.forEach((bundle, bundleIndex) => {
      if (!isRecord(bundle)) {
        failures.push(
          `fragments.${index}.bundleConfigs.${bundleIndex}:object-required`,
        );
        return;
      }
      if (!nonEmptyString(bundle.name) || bundle.name !== bundle.name.trim()) {
        failures.push(
          `fragments.${index}.bundleConfigs.${bundleIndex}.name:canonical-name-required`,
        );
      }
      if (typeof bundle.root !== "string") {
        failures.push(
          `fragments.${index}.bundleConfigs.${bundleIndex}.root:string-required`,
        );
      }
      if (typeof bundle.output !== "boolean") {
        failures.push(
          `fragments.${index}.bundleConfigs.${bundleIndex}.output:boolean-required`,
        );
      }
      if (bundle.uuid !== undefined && !nonEmptyString(bundle.uuid)) {
        failures.push(
          `fragments.${index}.bundleConfigs.${bundleIndex}.uuid:nonempty-string-required`,
        );
      }
    });
  }
  if (failures.length > 0) {
    throw new WechatBuildContractError(
      "editor-fragment-shape-invalid",
      failures,
    );
  }
}

function expectedEditorRoot(metadataPath, bundleName) {
  const prefix = "cocos/assets/";
  if (
    typeof metadataPath !== "string"
    || !metadataPath.startsWith(prefix)
    || !metadataPath.endsWith(".meta")
  ) {
    throw new WechatBuildContractError("profile-contract-invalid", [
      `${bundleName}.metadataPath:editor-root-derivation-required`,
    ]);
  }
  return `db://assets/${metadataPath.slice(prefix.length, -".meta".length)}`;
}

function mergeBundleConfigs(fragments) {
  const merged = [];
  const canonicalByName = new Map();
  for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex += 1) {
    for (const bundle of fragments[fragmentIndex].parsed.bundleConfigs) {
      const canonical = canonicalJson(bundle);
      const previous = canonicalByName.get(bundle.name);
      if (previous === undefined) {
        canonicalByName.set(bundle.name, canonical);
        merged.push(structuredClone(bundle));
      } else if (previous !== canonical) {
        throw new WechatBuildContractError("editor-bundle-conflict", [
          "bundleConfigs:duplicate-definitions-must-be-deep-equal",
        ]);
      }
    }
  }
  return merged;
}

function assertRequiredEditorBundles(bundleConfigs, profile) {
  for (const name of ["main", "internal"]) {
    const bundle = bundleConfigs.find((candidate) => candidate.name === name);
    if (!bundle) {
      throw new WechatBuildContractError("editor-bundle-missing", [
        `bundleConfigs.${name}:exactly-one-required`,
      ]);
    }
    if (bundle.root !== "" || bundle.output !== true) {
      throw new WechatBuildContractError(
        "editor-builtin-bundle-shape-invalid",
        [`bundleConfigs.${name}:editor-builtin-shape-required`],
      );
    }
  }
  for (const bundleProfile of [profile.configBundle, profile.bundle]) {
    const bundle = bundleConfigs.find(
      (candidate) => candidate.name === bundleProfile.name,
    );
    if (!bundle) {
      throw new WechatBuildContractError("editor-bundle-missing", [
        `bundleConfigs.${bundleProfile.name}:exactly-one-required`,
      ]);
    }
    const root = expectedEditorRoot(
      bundleProfile.metadataPath,
      bundleProfile.name,
    );
    const failures = [];
    if (bundle.root !== root) {
      failures.push(
        `bundleConfigs.${bundleProfile.name}.root:profile-editor-root-required`,
      );
    }
    if (bundle.uuid !== bundleProfile.uuid) {
      failures.push(
        `bundleConfigs.${bundleProfile.name}.uuid:profile-uuid-required`,
      );
    }
    if (bundle.output !== true) {
      failures.push(
        `bundleConfigs.${bundleProfile.name}.output:selected-editor-bundle-required`,
      );
    }
    if (failures.length > 0) {
      throw new WechatBuildContractError(
        "editor-bundle-profile-mismatch",
        failures,
      );
    }
  }
}

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    offset += writeSync(
      descriptor,
      bytes,
      offset,
      bytes.length - offset,
      offset,
    );
  }
}

function writeExclusivePrivateJson(outputPath, bytes) {
  if (!nonEmptyString(outputPath) || !outputPath.endsWith(".local.json")) {
    throw new WechatBuildContractError("output-path-not-local-json", [
      "output:.local.json-suffix-required",
    ]);
  }
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    throw new WechatBuildContractError("output-capture-unsupported", [
      "output:o_nofollow-required",
    ]);
  }

  const absolutePath = resolve(outputPath);
  let parentStat;
  try {
    parentStat = lstatSync(dirname(absolutePath), { bigint: true });
  } catch {
    throw new WechatBuildContractError("output-parent-invalid", [
      "output.parent:existing-directory-required",
    ]);
  }
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new WechatBuildContractError("output-parent-invalid", [
      "output.parent:real-directory-required",
    ]);
  }

  let descriptor;
  let createdStat;
  try {
    descriptor = openSync(
      absolutePath,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      0o600,
    );
    createdStat = fstatSync(descriptor, { bigint: true });
    if (!createdStat.isFile()) {
      throw new WechatBuildContractError("output-object-invalid", [
        "output:regular-file-required",
      ]);
    }
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    fchmodSync(descriptor, 0o600);
    const finished = fstatSync(descriptor, { bigint: true });
    if ((finished.mode & 0o777n) !== 0o600n) {
      throw new WechatBuildContractError("output-permissions-invalid", [
        "output:mode-0600-required",
      ]);
    }
    const pathStat = lstatSync(absolutePath, { bigint: true });
    if (
      pathStat.isSymbolicLink()
      || !pathStat.isFile()
      || !sameFilesystemObject(pathStat, finished)
    ) {
      throw new WechatBuildContractError("output-object-invalid", [
        "output:pathname-fd-identity-binding-required",
      ]);
    }
    closeSync(descriptor);
    descriptor = undefined;
    const closedStat = lstatSync(absolutePath, { bigint: true });
    if (
      closedStat.isSymbolicLink()
      || !closedStat.isFile()
      || !sameFilesystemObject(closedStat, finished)
      || (closedStat.mode & 0o777n) !== 0o600n
    ) {
      throw new WechatBuildContractError("output-object-invalid", [
        "output:stable-private-file-required",
      ]);
    }
    return absolutePath;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Preserve the original output failure.
      }
    }
    if (createdStat !== undefined) {
      try {
        const current = lstatSync(absolutePath, { bigint: true });
        if (sameFilesystemObject(current, createdStat)) unlinkSync(absolutePath);
      } catch {
        // Only remove the exact filesystem object created by this call.
      }
    }
    if (error?.code === "EEXIST" || error?.code === "ELOOP") {
      throw new WechatBuildContractError("output-already-exists", [
        "output:refuse-overwrite",
      ]);
    }
    if (error instanceof WechatBuildContractError) throw error;
    throw new WechatBuildContractError("output-write-failed", [
      "output:exclusive-private-write-required",
    ]);
  }
}

export function composeWechatEditorBuildConfig({
  fragmentPaths,
  outputPath,
  profilePath = defaultProfilePath,
}) {
  if (!Array.isArray(fragmentPaths) || fragmentPaths.length < 2) {
    throw new WechatBuildContractError("editor-fragments-insufficient", [
      "fragments:at-least-two-required",
    ]);
  }

  const loadedProfile = loadWechatBundleProfiles(profilePath);
  const fragments = fragmentPaths.map((path, index) => (
    parseCapturedFragment(captureStableNoFollowFile(path, index), index)
  ));
  fragments.forEach((fragment, index) => {
    assertOfficialEditorFragment(fragment.parsed, index, loadedProfile.profile);
  });

  const referenceTopLevel = canonicalJson(
    withoutBundleConfigs(fragments[0].parsed),
  );
  for (let index = 1; index < fragments.length; index += 1) {
    if (
      canonicalJson(withoutBundleConfigs(fragments[index].parsed))
      !== referenceTopLevel
    ) {
      throw new WechatBuildContractError("editor-fragment-top-level-conflict", [
        `fragments.${index}:top-level-config-must-match-fragment-0`,
      ]);
    }
  }

  const bundleConfigs = mergeBundleConfigs(fragments);
  assertRequiredEditorBundles(bundleConfigs, loadedProfile.profile);
  const composed = structuredClone(fragments[0].parsed);
  composed.bundleConfigs = bundleConfigs;
  assertFullEditorBuildConfig(composed, loadedProfile.profile);
  const serialized = Buffer.from(`${JSON.stringify(composed, null, 2)}\n`, "utf8");
  const absoluteOutputPath = writeExclusivePrivateJson(outputPath, serialized);

  return Object.freeze({
    ok: true,
    fragmentCount: fragments.length,
    fragmentSha256s: Object.freeze(fragments.map((fragment) => fragment.sha256)),
    bundleCount: bundleConfigs.length,
    bundleNames: Object.freeze(bundleConfigs.map((bundle) => bundle.name)),
    outputPath: absoluteOutputPath,
    outputSha256: sha256(serialized),
    profileSha256: loadedProfile.sha256,
  });
}

function parseCli(argv) {
  const options = { fragmentPaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--fragment", "--output", "--profile-file"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new WechatBuildContractError("cli-invalid", [
          `${argument}:value-required`,
        ]);
      }
      if (argument === "--fragment") {
        options.fragmentPaths.push(value);
      } else {
        const key = argument === "--output" ? "outputPath" : "profilePath";
        if (options[key] !== undefined) {
          throw new WechatBuildContractError("cli-invalid", [
            `${argument}:duplicate`,
          ]);
        }
        options[key] = value;
      }
      index += 1;
      continue;
    }
    throw new WechatBuildContractError("cli-invalid", [
      "argument:unsupported",
    ]);
  }
  if (options.fragmentPaths.length < 2 || !options.outputPath) {
    throw new WechatBuildContractError("cli-invalid", [
      "usage: --fragment FILE --fragment FILE [--fragment FILE ...] --output FILE.local.json",
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
    const result = composeWechatEditorBuildConfig(
      parseCli(process.argv.slice(2)),
    );
    // Do not print AppID, server URL, build path, bundle root, or bundle UUID.
    console.log(JSON.stringify({
      ok: true,
      fragmentCount: result.fragmentCount,
      fragmentSha256s: result.fragmentSha256s,
      bundleCount: result.bundleCount,
      bundleNames: [...result.bundleNames].sort(),
      outputSha256: result.outputSha256,
      profileSha256: result.profileSha256,
    }, null, 2));
  } catch (error) {
    const code = error instanceof WechatBuildContractError
      ? error.code
      : "editor-build-config-compose-failed";
    const failures = error instanceof WechatBuildContractError
      ? error.failures
      : ["compose:failed"];
    console.error(JSON.stringify({ ok: false, code, failures }, null, 2));
    process.exitCode = 1;
  }
}
