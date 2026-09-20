import { createHash } from "node:crypto";
import {
  closeSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { captureStableFile } from "./file-attestation.mjs";
import {
  WechatBuildContractError,
  assertFullEditorBuildConfig,
  loadWechatBundleProfiles,
  makeVersionedRemoteServer,
  templateRemoteServer,
  verifyWechatBuildConfig,
} from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const defaultProfilePath = resolve(
  projectRoot,
  "toolchain/wechat-bundle-profiles.json",
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseCapturedJson(path) {
  const capture = captureStableFile(path, { includeContent: true });
  let parsed;
  try {
    parsed = JSON.parse(capture.content.toString("utf8"));
  } catch {
    throw new WechatBuildContractError("editor-build-config-invalid-json", [
      "base:invalid-json",
    ]);
  }
  return { capture, parsed };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    offset += writeSync(fd, bytes, offset, bytes.length - offset, offset);
  }
}

function sameFilesystemObject(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function writeExclusivePrivateJson(outputPath, bytes) {
  if (!outputPath.endsWith(".local.json")) {
    throw new WechatBuildContractError("output-path-not-local-json", [
      "output:.local.json-suffix-required",
    ]);
  }
  let parent;
  try {
    parent = statSync(dirname(outputPath));
  } catch {
    throw new WechatBuildContractError("output-parent-invalid", [
      "output.parent:existing-directory-required",
    ]);
  }
  if (!parent.isDirectory()) {
    throw new WechatBuildContractError("output-parent-invalid", [
      "output.parent:directory-required",
    ]);
  }

  let fd;
  let createdStat;
  try {
    fd = openSync(outputPath, "wx", 0o600);
    createdStat = fstatSync(fd, { bigint: true });
    if (!createdStat.isFile()) {
      throw new WechatBuildContractError("output-object-invalid", [
        "output:regular-file-required",
      ]);
    }
    writeAll(fd, bytes);
    fsyncSync(fd);
    fchmodSync(fd, 0o600);
    const finished = fstatSync(fd, { bigint: true });
    if ((finished.mode & 0o777n) !== 0o600n) {
      throw new WechatBuildContractError("output-permissions-invalid", [
        "output:mode-0600-required",
      ]);
    }
    closeSync(fd);
    fd = undefined;
  } catch (error) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Preserve the original rendering failure.
      }
    }
    if (createdStat) {
      try {
        const current = lstatSync(outputPath, { bigint: true });
        if (sameFilesystemObject(current, createdStat)) unlinkSync(outputPath);
      } catch {
        // Only remove the exact file descriptor object created by this call.
      }
    }
    if (error?.code === "EEXIST") {
      throw new WechatBuildContractError("output-already-exists", [
        "output:refuse-overwrite",
      ]);
    }
    throw error;
  }
}

function assertLocalJsonIgnoreRule() {
  const captured = captureStableFile(resolve(projectRoot, ".gitignore"), {
    includeContent: true,
  });
  const rules = captured.content.toString("utf8").split(/\r?\n/);
  if (!rules.includes("*.local.json")) {
    throw new WechatBuildContractError("local-json-ignore-rule-missing", [
      ".gitignore:*.local.json-rule-required",
    ]);
  }
}

function requiredEnvironmentValue(environment, name, field) {
  const value = environment[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WechatBuildContractError("render-credential-missing", [
      `${field}:environment-value-required`,
    ]);
  }
  return value.trim();
}

export function renderWechatBuildConfig({
  basePath,
  outputPath,
  modeName,
  gate,
  environment = process.env,
  profilePath = defaultProfilePath,
}) {
  if (gate !== "template" && gate !== "production") {
    throw new WechatBuildContractError("render-gate-invalid", [
      "gate:template-or-production-required",
    ]);
  }
  const loadedProfile = loadWechatBundleProfiles(profilePath);
  const profile = loadedProfile.profile;
  const mode = profile.modes[modeName];
  if (!isRecord(mode)) {
    throw new WechatBuildContractError("render-mode-invalid", [
      "mode:remote-or-subpackage-smoke-required",
    ]);
  }
  if (gate === "production" && !mode.releaseEligible) {
    throw new WechatBuildContractError("render-mode-non-release", [
      "mode:non-release-profile-forbidden",
    ]);
  }

  const capturedBase = parseCapturedJson(basePath);
  const baseBundle = assertFullEditorBuildConfig(capturedBase.parsed, profile);
  const baseConfigBundle = capturedBase.parsed.bundleConfigs.find(
    (candidate) => candidate?.name === profile.configBundle.name,
  );
  const rendered = deepClone(capturedBase.parsed);
  const renderedBundle = rendered.bundleConfigs.find(
    (candidate) => candidate?.name === profile.bundle.name,
  );
  const renderedConfigBundle = rendered.bundleConfigs.find(
    (candidate) => candidate?.name === profile.configBundle.name,
  );
  if (!renderedBundle || renderedBundle.root !== baseBundle.root) {
    throw new WechatBuildContractError("editor-bundle-root-not-preserved", [
      "bundleConfigs.resources.root:must-remain-editor-generated",
    ]);
  }
  if (
    !baseConfigBundle
    || !renderedConfigBundle
    || renderedConfigBundle.root !== baseConfigBundle.root
  ) {
    throw new WechatBuildContractError("editor-bundle-root-not-preserved", [
      "bundleConfigs.config.root:must-remain-editor-generated",
    ]);
  }

  renderedBundle.priority = profile.bundle.priority;
  Object.assign(renderedBundle, mode.bundleConfig);
  renderedConfigBundle.priority = profile.configBundle.priority;
  Object.assign(renderedConfigBundle, profile.configBundle.bundleConfig);
  Object.assign(rendered, mode.buildOverrides);
  if (rendered.packages.wechatgame.wasmSubpackage === undefined) {
    rendered.packages.wechatgame.wasmSubpackage = false;
  }
  rendered.packages.wechatgame.appid = gate === "template"
    ? profile.wechat.templateAppId
    : requiredEnvironmentValue(
      environment,
      profile.wechat.appIdEnv,
      "packages.wechatgame.appid",
    );

  if (modeName === "remote") {
    rendered.server = gate === "template"
      ? templateRemoteServer(profile)
      : makeVersionedRemoteServer(
        requiredEnvironmentValue(
          environment,
          profile.wechat.remoteBaseUrlEnv,
          "server",
        ),
        profile,
      );
  }

  const verification = verifyWechatBuildConfig(rendered, {
    gate,
    expectedMode: modeName,
    profile,
  });
  if (
    renderedBundle.root !== baseBundle.root
    || renderedBundle.uuid !== baseBundle.uuid
    || renderedConfigBundle.root !== baseConfigBundle.root
    || renderedConfigBundle.uuid !== baseConfigBundle.uuid
  ) {
    throw new WechatBuildContractError("editor-bundle-identity-not-preserved", [
      "bundleConfigs:root-and-uuid-must-remain-editor-generated",
    ]);
  }
  const serialized = Buffer.from(`${JSON.stringify(rendered, null, 2)}\n`, "utf8");
  const absoluteOutput = resolve(outputPath);
  assertLocalJsonIgnoreRule();
  writeExclusivePrivateJson(absoluteOutput, serialized);
  return Object.freeze({
    ok: true,
    gate,
    mode: verification.mode,
    releaseEligible: verification.releaseEligible,
    nonRelease: verification.nonRelease,
    outputPath: absoluteOutput,
    outputFile: basename(absoluteOutput),
    outputSha256: createHash("sha256").update(serialized).digest("hex"),
    baseSha256: capturedBase.capture.sha256,
    profileSha256: loadedProfile.sha256,
    rendered,
  });
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
    if (["--base", "--output", "--mode", "--profile-file"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new WechatBuildContractError("cli-invalid", [`${argument}:value-required`]);
      }
      const key = argument === "--base"
        ? "basePath"
        : argument === "--output"
          ? "outputPath"
          : argument === "--mode"
            ? "modeName"
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
  if (!options.gate || !options.basePath || !options.outputPath || !options.modeName) {
    throw new WechatBuildContractError("cli-invalid", [
      "usage: --base FILE --output FILE.local.json --mode MODE (--template|--production)",
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
    const result = renderWechatBuildConfig(options);
    // Never print AppID, remote server, the parsed config, or credential env values.
    console.log(JSON.stringify({
      ok: true,
      gate: result.gate,
      mode: result.mode,
      releaseEligible: result.releaseEligible,
      nonRelease: result.nonRelease,
      outputFile: result.outputFile,
      outputSha256: result.outputSha256,
      baseSha256: result.baseSha256,
      profileSha256: result.profileSha256,
    }, null, 2));
  } catch (error) {
    const code = error instanceof WechatBuildContractError
      ? error.code
      : "wechat-build-config-render-failed";
    const failures = error instanceof WechatBuildContractError
      ? error.failures
      : ["render:failed"];
    console.error(JSON.stringify({ ok: false, code, failures }, null, 2));
    process.exitCode = 1;
  }
}
