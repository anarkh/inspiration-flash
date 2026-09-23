import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import {
  WechatBuildContractError,
  resolveWechatBuildOutputRoot,
  verifyWechatBuildConfig,
  verifyWechatBuildConfigFile,
} from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const cocosProjectRoot = resolve(projectRoot, "cocos");
const textExtensions = new Set([
  ".json",
  ".js",
  ".cjs",
  ".mjs",
  ".txt",
  ".map",
  ".meta",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asPosix(path) {
  return path.split(sep).join("/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extension(path) {
  const match = /(?:^|\/)[^/]*(\.[^.\/]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? "";
}

const directoryOpenFlags = fsConstants.O_RDONLY
  | fsConstants.O_NOFOLLOW
  | fsConstants.O_DIRECTORY;
const fileOpenFlags = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;

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

function snapshotFailure(code, failure) {
  throw new WechatBuildContractError(code, [failure]);
}

function safeLstat(path, code, failure) {
  try {
    return lstatSync(path, { bigint: true });
  } catch {
    snapshotFailure(code, failure);
  }
}

function assertPathBoundToFd(path, fdIdentity, kind, code, failure) {
  const stat = safeLstat(path, code, failure);
  const typeMatches = kind === "directory" ? stat.isDirectory() : stat.isFile();
  if (stat.isSymbolicLink() || !typeMatches) snapshotFailure(code, failure);
  if (!sameIdentity(statIdentity(stat), fdIdentity)) snapshotFailure(code, failure);
}

function openPinnedPath(path, kind, code, failure) {
  const pathStat = safeLstat(path, code, failure);
  const typeMatches = kind === "directory"
    ? pathStat.isDirectory()
    : pathStat.isFile();
  if (pathStat.isSymbolicLink() || !typeMatches) snapshotFailure(code, failure);
  let fd;
  try {
    fd = openSync(path, kind === "directory" ? directoryOpenFlags : fileOpenFlags);
  } catch {
    snapshotFailure(code, failure);
  }
  try {
    const fdStat = fstatSync(fd, { bigint: true });
    const fdTypeMatches = kind === "directory"
      ? fdStat.isDirectory()
      : fdStat.isFile();
    const fdIdentity = statIdentity(fdStat);
    if (
      !fdTypeMatches
      || !sameIdentity(statIdentity(pathStat), fdIdentity)
    ) {
      snapshotFailure(code, failure);
    }
    return { fd, identity: fdIdentity };
  } catch (error) {
    try {
      closeSync(fd);
    } catch {
      // Preserve the original fail-closed error.
    }
    throw error;
  }
}

function closePinnedPaths(pinned, code, failure) {
  let firstError = null;
  for (const item of pinned) {
    if (item.fd === null) continue;
    try {
      const fdStat = fstatSync(item.fd, { bigint: true });
      if (!sameIdentity(statIdentity(fdStat), item.identity)) {
        snapshotFailure(code, failure);
      }
      assertPathBoundToFd(
        item.absolutePath,
        item.identity,
        item.kind,
        code,
        failure,
      );
    } catch (error) {
      firstError ??= error;
    }
  }
  for (const item of [...pinned].reverse()) {
    if (item.fd === null) continue;
    try {
      closeSync(item.fd);
      item.fd = null;
      assertPathBoundToFd(
        item.absolutePath,
        item.identity,
        item.kind,
        code,
        failure,
      );
    } catch (error) {
      firstError ??= error;
    }
  }
  for (const item of pinned) {
    try {
      assertPathBoundToFd(
        item.absolutePath,
        item.identity,
        item.kind,
        code,
        failure,
      );
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

function canonicalizeTreeRoot(root, code, missingFailure, invalidFailure) {
  const requestedRoot = resolve(root);
  let requestedStat;
  try {
    requestedStat = lstatSync(requestedRoot, { bigint: true });
  } catch {
    snapshotFailure(code, missingFailure);
  }
  if (requestedStat.isSymbolicLink() || !requestedStat.isDirectory()) {
    snapshotFailure(code, invalidFailure);
  }
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync.native(requestedRoot);
  } catch {
    snapshotFailure(code, invalidFailure);
  }
  const canonicalStat = safeLstat(canonicalRoot, code, invalidFailure);
  if (
    canonicalStat.isSymbolicLink()
    || !canonicalStat.isDirectory()
    || !sameIdentity(statIdentity(requestedStat), statIdentity(canonicalStat))
  ) {
    snapshotFailure(code, invalidFailure);
  }
  return Object.freeze({ requestedRoot, canonicalRoot });
}

function captureTreeSnapshot(root, {
  code = "build-output-snapshot-unstable",
  missingFailure = "outputRoot:directory-required",
  invalidFailure = "outputRoot:real-directory-required",
  emptyRequired = true,
} = {}) {
  if (
    !Number.isInteger(fsConstants.O_NOFOLLOW)
    || !Number.isInteger(fsConstants.O_DIRECTORY)
  ) {
    snapshotFailure(code, "filesystem:o_nofollow-and-o_directory-required");
  }
  const resolvedRoot = canonicalizeTreeRoot(
    root,
    code,
    missingFailure,
    invalidFailure,
  );
  const entries = [];
  const directories = [];
  const pinned = [];
  let captureError = null;

  function pin(path, kind, relativePath) {
    const failure = `${kind === "directory" ? "directory" : "file"}:${relativePath || "."}:stable-no-follow-capture-required`;
    const opened = openPinnedPath(path, kind, code, failure);
    const item = {
      absolutePath: path,
      fd: opened.fd,
      identity: opened.identity,
      kind,
      path: relativePath,
    };
    pinned.push(item);
    return item;
  }

  function walk(directory, relativeDirectory) {
    const directoryPin = pin(directory, "directory", relativeDirectory);
    directories.push(Object.freeze({
      path: relativeDirectory,
      identity: directoryPin.identity,
    }));
    let children;
    try {
      children = readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      snapshotFailure(
        code,
        `directory:${relativeDirectory || "."}:stable-no-follow-capture-required`,
      );
    }
    for (const child of children) {
      const absolutePath = resolve(directory, child.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      const stat = safeLstat(
        absolutePath,
        code,
        `path:${relativePath}:stable-no-follow-capture-required`,
      );
      if (stat.isSymbolicLink()) {
        snapshotFailure(code, `path:${relativePath}:symlink-forbidden`);
      }
      if (stat.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        snapshotFailure(code, `path:${relativePath}:regular-files-only`);
      }
      const filePin = pin(absolutePath, "file", relativePath);
      let bytes;
      try {
        bytes = readFileSync(filePin.fd);
        const afterRead = statIdentity(fstatSync(filePin.fd, { bigint: true }));
        if (!sameIdentity(afterRead, filePin.identity)) {
          snapshotFailure(
            code,
            `file:${relativePath}:stable-no-follow-capture-required`,
          );
        }
        assertPathBoundToFd(
          absolutePath,
          filePin.identity,
          "file",
          code,
          `file:${relativePath}:stable-no-follow-capture-required`,
        );
      } catch (error) {
        if (error instanceof WechatBuildContractError) throw error;
        snapshotFailure(
          code,
          `file:${relativePath}:stable-no-follow-capture-required`,
        );
      }
      entries.push(Object.freeze({
        path: relativePath,
        bytes: bytes.length,
        sha256: sha256(bytes),
        identity: filePin.identity,
        text: textExtensions.has(extension(relativePath))
          ? bytes.toString("utf8")
          : null,
      }));
      closePinnedPaths(
        [filePin],
        code,
        `file:${relativePath}:pathname-fd-identity-binding-required`,
      );
    }
    const afterRead = statIdentity(fstatSync(directoryPin.fd, { bigint: true }));
    if (!sameIdentity(afterRead, directoryPin.identity)) {
      snapshotFailure(
        code,
        `directory:${relativeDirectory || "."}:stable-no-follow-capture-required`,
      );
    }
    closePinnedPaths(
      [directoryPin],
      code,
      `directory:${relativeDirectory || "."}:pathname-fd-identity-binding-required`,
    );
  }

  try {
    walk(resolvedRoot.canonicalRoot, "");
  } catch (error) {
    captureError = error;
  }
  try {
    closePinnedPaths(
      pinned,
      code,
      "tree:pathname-fd-identity-binding-required",
    );
  } catch (error) {
    captureError ??= error;
  }
  if (captureError) throw captureError;
  if (emptyRequired && entries.length === 0) {
    snapshotFailure(code, "outputTree:nonempty-required");
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  directories.sort((left, right) => left.path.localeCompare(right.path));
  const canonicalAfter = canonicalizeTreeRoot(
    resolvedRoot.requestedRoot,
    code,
    missingFailure,
    invalidFailure,
  );
  if (canonicalAfter.canonicalRoot !== resolvedRoot.canonicalRoot) {
    snapshotFailure(code, "root:canonical-identity-stable-required");
  }
  const rootDirectory = directories.find((entry) => entry.path === "");
  const rootStat = safeLstat(
    canonicalAfter.canonicalRoot,
    code,
    "root:canonical-identity-stable-required",
  );
  if (
    !rootDirectory
    || !sameIdentity(rootDirectory.identity, statIdentity(rootStat))
  ) {
    snapshotFailure(code, "root:canonical-identity-stable-required");
  }
  return Object.freeze({
    canonicalRoot: resolvedRoot.canonicalRoot,
    requestedRoot: resolvedRoot.requestedRoot,
    rootIdentity: rootDirectory.identity,
    entries: Object.freeze(entries),
    directories: Object.freeze(directories),
    treeSha256: treeFingerprint(entries),
  });
}

function compareTreeSnapshots(before, after, code, label) {
  const failures = [];
  if (
    before.canonicalRoot !== after.canonicalRoot
    || !sameIdentity(before.rootIdentity, after.rootIdentity)
  ) {
    failures.push(`${label}.root:canonical-identity-stable-required`);
  }
  const compareItems = (leftItems, rightItems, kind) => {
    if (leftItems.length !== rightItems.length) {
      failures.push(`${label}.${kind}:path-set-stable-required`);
      return;
    }
    for (let index = 0; index < leftItems.length; index += 1) {
      const left = leftItems[index];
      const right = rightItems[index];
      if (left.path !== right.path) {
        failures.push(`${label}.${kind}:path-set-stable-required`);
        return;
      }
      if (!sameIdentity(left.identity, right.identity)) {
        failures.push(`${label}.${kind}:${left.path || "."}:identity-stable-required`);
      }
      if (
        kind === "files"
        && (left.bytes !== right.bytes || left.sha256 !== right.sha256)
      ) {
        failures.push(`${label}.${kind}:${left.path}:bytes-stable-required`);
      }
    }
  };
  compareItems(before.directories, after.directories, "directories");
  compareItems(before.entries, after.entries, "files");
  if (before.treeSha256 !== after.treeSha256) {
    failures.push(`${label}.tree:fingerprint-stable-required`);
  }
  if (failures.length > 0) throw new WechatBuildContractError(code, failures);
}

// Deliberately narrow test seam: production verification never supplies hooks.
// It lets the self-check mutate pathname state between the frozen semantic read
// and the mandatory second stable scan without weakening the production path.
export function verifyFrozenTreeSnapshotForTesting({
  root,
  jsonPaths = [],
  hooks = {},
}) {
  const initial = captureTreeSnapshot(root);
  hooks.afterInitialCapture?.(initial);
  const parsedJson = new Map();
  for (const path of jsonPaths) {
    const entry = entryAt(initial.entries, path);
    if (!entry || entry.text === null) {
      throw new WechatBuildContractError("build-output-json-invalid", [
        `${path}:frozen-json-entry-required`,
      ]);
    }
    parsedJson.set(path, parseJsonText(entry.text, path));
  }
  hooks.afterSemanticParse?.(Object.freeze({ initial, parsedJson }));
  const final = captureTreeSnapshot(root);
  compareTreeSnapshots(
    initial,
    final,
    "build-output-snapshot-drift",
    "outputTree",
  );
  return Object.freeze({
    parsedJson,
    treeSha256: initial.treeSha256,
  });
}

function treeFingerprint(entries) {
  const payload = entries
    .map((entry) => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`)
    .join("");
  return sha256(Buffer.from(payload, "utf8"));
}

function totalBytes(entries) {
  return entries.reduce((total, entry) => total + entry.bytes, 0);
}

function entriesUnder(entries, prefix) {
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return entries.filter((entry) => entry.path.startsWith(normalized));
}

function parseJsonText(text, label, code = "build-output-json-invalid") {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new WechatBuildContractError(code, [
      `${label}:valid-json-required`,
    ]);
  }
  if (!isRecord(parsed)) {
    throw new WechatBuildContractError(code, [
      `${label}:object-required`,
    ]);
  }
  return parsed;
}

function entryAt(entries, path) {
  return entries.find((entry) => entry.path === path) ?? null;
}

function frozenPathExists(snapshot, path) {
  return snapshot.entries.some((entry) => entry.path === path)
    || snapshot.directories.some((entry) => entry.path === path);
}

function requirePathAbsent(failures, snapshot, path) {
  if (frozenPathExists(snapshot, path)) failures.push(`${path}:must-be-absent`);
}

function generatedBundleVersion(settings, bundleName, failures) {
  const version = settings.assets?.bundleVers?.[bundleName];
  if (
    !isRecord(settings.assets?.bundleVers)
    || typeof version !== "string"
    || !/^[0-9a-z_-]+$/i.test(version)
  ) {
    failures.push(`settings.assets.bundleVers.${bundleName}:version-required`);
    return null;
  }
  return version;
}

function hasEntry(entries, path) {
  return entries.some((entry) => entry.path === path);
}

function verifyRemoteVersionedBundleLayout(
  failures,
  snapshot,
  entries,
  bundleName,
  version,
) {
  requirePathAbsent(failures, snapshot, `assets/${bundleName}`);
  if (!version) return;
  const configPath = `remote/${bundleName}/config.${version}.json`;
  if (!hasEntry(entries, configPath)) {
    failures.push(`${configPath}:version-bound-generated-config-required`);
  }
  const scriptPath = `src/bundle-scripts/${bundleName}/index.${version}.js`;
  if (!hasEntry(entries, scriptPath)) {
    failures.push(`${scriptPath}:version-bound-moved-script-required`);
  }
}

function verifyLocalVersionedBundleLayout(
  failures,
  entries,
  bundleName,
  version,
) {
  if (!version) return;
  const scriptPath = `assets/${bundleName}/index.${version}.js`;
  if (!hasEntry(entries, scriptPath)) {
    failures.push(`${scriptPath}:version-bound-local-script-required`);
  }
}

function requireStringArrayMembership(failures, value, member, path, expected) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    failures.push(`${path}:string-array-required`);
    return;
  }
  if (value.includes(member) !== expected) {
    failures.push(`${path}:${expected ? "bundle-required" : "bundle-forbidden"}`);
  }
}

function requireExactStringArray(failures, value, expected, path) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return;
  }
  const actualSorted = [...value].sort();
  const expectedSorted = [...expected].sort();
  if (JSON.stringify(actualSorted) !== JSON.stringify(expectedSorted)) {
    failures.push(`${path}:exact-profile-bundles-required`);
  }
}

function collectJsonStrings(value, output) {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, output);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, item] of Object.entries(value)) {
    output.add(key);
    collectJsonStrings(item, output);
  }
}

function compressCocosUuid(uuid) {
  const hex = uuid.replaceAll("-", "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return uuid;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let compressed = hex.slice(0, 2);
  for (let index = 2; index < hex.length; index += 3) {
    const value = Number.parseInt(hex.slice(index, index + 3), 16);
    compressed += alphabet[value >> 6];
    compressed += alphabet[value & 63];
  }
  return compressed;
}

function loadManifestTrace(profile) {
  const failures = [];
  const manifestPath = resolve(projectRoot, profile.source.manifestPath);
  const manifestDirectory = dirname(manifestPath);
  const manifestSnapshot = captureTreeSnapshot(manifestDirectory, {
    code: "manifest-trace-snapshot-unstable",
    missingFailure: "assetManifest:parent-directory-required",
    invalidFailure: "assetManifest:real-parent-directory-required",
  });
  const manifestRelativePath = asPosix(relative(manifestDirectory, manifestPath));
  const manifestEntry = entryAt(manifestSnapshot.entries, manifestRelativePath);
  if (!manifestEntry || manifestEntry.text === null) {
    throw new WechatBuildContractError("manifest-trace-contract-invalid", [
      "assetManifest:stable-regular-json-required",
    ]);
  }
  const manifest = parseJsonText(
    manifestEntry.text,
    "assetManifest",
    "manifest-trace-contract-invalid",
  );
  if (manifest.manifestRevision !== profile.source.manifestRevision) {
    failures.push("assetManifest.manifestRevision:pinned-value-required");
  }
  if (
    manifest.assetCount !== profile.source.assetCount
    || !Array.isArray(manifest.assets)
    || manifest.assets.length !== profile.source.assetCount
  ) {
    failures.push("assetManifest.assets:pinned-count-required");
  }
  const traces = [];
  const paths = new Set();
  let resourceBytes = 0;
  const resourceRoot = typeof manifest.resourceRoot === "string"
    ? resolve(projectRoot, manifest.resourceRoot)
    : null;
  if (!resourceRoot) {
    failures.push("assetManifest.resourceRoot:string-required");
  }
  const resourceSnapshot = resourceRoot
    ? captureTreeSnapshot(resourceRoot, {
        code: "manifest-trace-snapshot-unstable",
        missingFailure: "assetManifest.resourceRoot:directory-required",
        invalidFailure: "assetManifest.resourceRoot:real-directory-required",
      })
    : null;
  if (Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) {
      if (
        !isRecord(asset)
        || typeof asset.key !== "string"
        || typeof asset.resourcePath !== "string"
        || typeof asset.resourceFile !== "string"
      ) {
        failures.push("assetManifest.assets:trace-fields-required");
        continue;
      }
      if (paths.has(asset.resourcePath)) {
        failures.push("assetManifest.assets:resourcePath-unique-required");
      }
      paths.add(asset.resourcePath);
      if (!resourceRoot || !resourceSnapshot) continue;
      const resourceFile = resolve(resourceRoot, asset.resourceFile);
      const resourceRelativePath = asPosix(relative(resourceRoot, resourceFile));
      if (
        resourceRelativePath === ".."
        || resourceRelativePath.startsWith("../")
        || isAbsolute(resourceRelativePath)
      ) {
        failures.push("assetManifest.assets:resource-file-contained-required");
        continue;
      }
      const resourceEntry = entryAt(resourceSnapshot.entries, resourceRelativePath);
      const metaEntry = entryAt(
        resourceSnapshot.entries,
        `${resourceRelativePath}.meta`,
      );
      if (!resourceEntry) {
        failures.push("assetManifest.assets:resource-file-required");
        continue;
      }
      if (!metaEntry || metaEntry.text === null) {
        failures.push("assetManifest.assets:resource-meta-required");
        continue;
      }
      let meta;
      try {
        meta = parseJsonText(
          metaEntry.text,
          "resourceMeta",
          "manifest-trace-contract-invalid",
        );
      } catch (error) {
        failures.push(...error.failures);
        continue;
      }
      if (typeof meta.uuid !== "string" || typeof meta.userData?.redirect !== "string") {
        failures.push("resourceMeta:image-and-texture-uuid-required");
      }
      resourceBytes += resourceEntry.bytes;
      traces.push(Object.freeze({
        key: asset.key,
        resourcePath: asset.resourcePath,
        imageUuid: meta.uuid,
        textureUuid: meta.userData?.redirect,
      }));
    }
  }
  if (resourceBytes !== profile.source.resourceBytes) {
    failures.push("assetManifest.assets:pinned-resource-bytes-required");
  }
  if (failures.length > 0) {
    throw new WechatBuildContractError("manifest-trace-contract-invalid", failures);
  }
  const tracePayload = traces
    .map((trace) => [
      trace.key,
      trace.resourcePath,
      trace.imageUuid,
      trace.textureUuid,
    ].join("\0"))
    .join("\n");
  return Object.freeze({
    traces,
    sha256: sha256(Buffer.from(tracePayload, "utf8")),
    manifestSnapshot,
    resourceSnapshot,
  });
}

function compareManifestTraces(before, after) {
  compareTreeSnapshots(
    before.manifestSnapshot,
    after.manifestSnapshot,
    "manifest-trace-snapshot-drift",
    "assetManifest",
  );
  compareTreeSnapshots(
    before.resourceSnapshot,
    after.resourceSnapshot,
    "manifest-trace-snapshot-drift",
    "resourceTree",
  );
  if (before.sha256 !== after.sha256) {
    throw new WechatBuildContractError("manifest-trace-snapshot-drift", [
      "manifestTrace:fingerprint-stable-required",
    ]);
  }
}

function locateSettings(entries) {
  const candidates = entries.filter((entry) => (
    /^settings(?:\.[0-9a-z_-]+)?\.json$/i.test(basename(entry.path))
  ));
  const matches = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.text);
      if (isRecord(parsed?.assets)) matches.push({ entry: candidate, parsed });
    } catch {
      throw new WechatBuildContractError("build-settings-invalid", [
        "settings:valid-json-required",
      ]);
    }
  }
  if (matches.length !== 1) {
    throw new WechatBuildContractError("build-settings-not-unique", [
      "settings:exactly-one-assets-settings-file-required",
    ]);
  }
  return matches[0].parsed;
}

function verifyBundleConfigTrace(
  bundleEntries,
  manifestTrace,
  requireScript,
  version,
) {
  const failures = [];
  const configs = bundleEntries.filter((entry) => (
    /^config(?:\.[0-9a-z_-]+)?\.json$/i.test(basename(entry.path))
  ));
  const expectedName = version ? `config.${version}.json` : null;
  const expectedConfigs = expectedName
    ? configs.filter((entry) => basename(entry.path) === expectedName)
    : [];
  if (configs.length !== 1 || expectedConfigs.length !== 1) {
    throw new WechatBuildContractError("bundle-config-missing", [
      "bundle.config:exact-version-bound-generated-json-required",
    ]);
  }
  const strings = new Set();
  for (const config of expectedConfigs) {
    let parsed;
    try {
      parsed = JSON.parse(config.text);
    } catch {
      failures.push("bundle.config:valid-json-required");
      continue;
    }
    collectJsonStrings(parsed, strings);
  }
  const missing = manifestTrace.traces.filter(
    (trace) => !strings.has(trace.resourcePath),
  );
  if (missing.length > 0) {
    failures.push(`bundle.config:missing-manifest-resource-paths:${missing.length}`);
  }
  if (
    requireScript
    && !bundleEntries.some((entry) => extension(entry.path) === ".js")
  ) {
    failures.push("bundle.script:generated-javascript-required");
  }
  if (
    !bundleEntries.some((entry) => (
      extension(entry.path) !== ".json"
      && extension(entry.path) !== ".js"
      && extension(entry.path) !== ".map"
    ))
  ) {
    failures.push("bundle.native:payload-required");
  }
  if (failures.length > 0) {
    throw new WechatBuildContractError("bundle-manifest-trace-invalid", failures);
  }
  return Object.freeze({
    configFiles: expectedConfigs.length,
    tracedAssets: manifestTrace.traces.length,
  });
}

function verifyLocalConfigBundleTrace(
  configEntries,
  profile,
  version,
) {
  const failures = [];
  const expectedName = version ? `config.${version}.json` : null;
  const generatedConfigs = configEntries.filter((entry) => (
    /^config(?:\.[0-9a-z_-]+)?\.json$/i.test(basename(entry.path))
  ));
  const matches = expectedName
    ? generatedConfigs.filter((entry) => basename(entry.path) === expectedName)
    : [];
  if (generatedConfigs.length !== 1 || matches.length !== 1) {
    failures.push("configBundle.config:exact-version-bound-generated-json-required");
  } else {
    let parsed;
    try {
      parsed = JSON.parse(matches[0].text);
    } catch {
      failures.push("configBundle.config:valid-json-required");
    }
    if (parsed !== undefined) {
      const strings = new Set();
      collectJsonStrings(parsed, strings);
      if (!strings.has(profile.configBundle.manifestPath)) {
        failures.push("configBundle.config:manifest-resource-path-required");
      }
      const manifestUuidForms = new Set([
        profile.configBundle.manifestUuid,
        compressCocosUuid(profile.configBundle.manifestUuid),
      ]);
      if (![...manifestUuidForms].some((uuid) => strings.has(uuid))) {
        failures.push("configBundle.config:manifest-uuid-required");
      }
    }
  }
  if (failures.length > 0) {
    throw new WechatBuildContractError(
      "config-bundle-manifest-trace-invalid",
      failures,
    );
  }
  return Object.freeze({
    configFiles: matches.length,
    manifestUuid: profile.configBundle.manifestUuid,
  });
}

function verifyGameAndProjectJson(
  entries,
  config,
  modeName,
  bundleName,
  configBundleName,
  failures,
) {
  const gameEntry = entryAt(entries, "game.json");
  const projectConfigEntry = entryAt(entries, "project.config.json");
  if (!gameEntry) failures.push("game.json:required");
  if (!projectConfigEntry) failures.push("project.config.json:required");
  if (failures.length > 0) return;
  const game = parseJsonText(gameEntry.text, "game.json");
  const projectConfig = parseJsonText(
    projectConfigEntry.text,
    "project.config.json",
  );
  if (projectConfig.appid !== config.packages.wechatgame.appid) {
    failures.push("project.config.json.appid:must-match-attested-config");
  }
  const subpackages = game.subpackages ?? [];
  if (!Array.isArray(subpackages)) {
    failures.push("game.json.subpackages:array-required-when-present");
    return;
  }
  const resourcesEntries = subpackages.filter(
    (item) => isRecord(item) && item.name === bundleName,
  );
  const configEntries = subpackages.filter((item) => (
    isRecord(item)
    && (
      item.name === configBundleName
      || item.root === `subpackages/${configBundleName}/`
    )
  ));
  if (configEntries.length !== 0) {
    failures.push("game.json.subpackages:config-bundle-forbidden");
  }
  if (modeName === "remote" && resourcesEntries.length !== 0) {
    failures.push("game.json.subpackages:remote-bundle-forbidden");
  }
  if (modeName === "subpackage-smoke") {
    if (
      resourcesEntries.length !== 1
      || resourcesEntries[0].root !== `subpackages/${bundleName}/`
    ) {
      failures.push("game.json.subpackages:exact-resources-root-required");
    }
  }
}

export function verifyWechatBuildOutput({
  config,
  gate,
  expectedMode,
  profile,
  outputRoot,
  expectedTreeSha256,
  expectedPackageSha256,
}) {
  const configVerification = verifyWechatBuildConfig(config, {
    gate,
    expectedMode,
    profile,
  });
  const modeName = configVerification.mode;
  const bundleName = profile.bundle.name;
  const configBundleName = profile.configBundle.name;
  const root = outputRoot
    ? resolve(outputRoot)
    : resolveWechatBuildOutputRoot(config, cocosProjectRoot);
  const outputSnapshot = captureTreeSnapshot(root);
  const entries = outputSnapshot.entries;
  const failures = [];
  const settings = locateSettings(entries);
  const manifestTrace = loadManifestTrace(profile);
  const bundlePrefix = modeName === "remote"
    ? `remote/${bundleName}`
    : `subpackages/${bundleName}`;
  const bundleEntries = entriesUnder(entries, bundlePrefix);
  const configBundlePrefix = `assets/${configBundleName}`;
  const configBundleEntries = entriesUnder(entries, configBundlePrefix);
  if (bundleEntries.length === 0) failures.push(`${bundlePrefix}:bundle-tree-required`);
  if (configBundleEntries.length === 0) {
    failures.push(`${configBundlePrefix}:local-bundle-tree-required`);
  }
  requirePathAbsent(failures, outputSnapshot, `remote/${configBundleName}`);
  requirePathAbsent(failures, outputSnapshot, `subpackages/${configBundleName}`);

  let bundleVersion = null;
  let configBundleVersion = null;
  if (isRecord(settings.assets)) {
    bundleVersion = generatedBundleVersion(settings, bundleName, failures);
    configBundleVersion = generatedBundleVersion(
      settings,
      configBundleName,
      failures,
    );
  }
  verifyLocalVersionedBundleLayout(
    failures,
    entries,
    configBundleName,
    configBundleVersion,
  );

  if (modeName === "remote") {
    verifyRemoteVersionedBundleLayout(
      failures,
      outputSnapshot,
      entries,
      bundleName,
      bundleVersion,
    );
    requirePathAbsent(failures, outputSnapshot, `subpackages/${bundleName}`);
  } else {
    requirePathAbsent(failures, outputSnapshot, `assets/${bundleName}`);
    requirePathAbsent(failures, outputSnapshot, `remote/${bundleName}`);
    if (!hasEntry(entries, `${bundlePrefix}/game.js`)) {
      failures.push(`${bundlePrefix}/game.js:subpackage-entry-required`);
    }
  }

  if (!isRecord(settings.assets)) {
    failures.push("settings.assets:object-required");
  } else {
    requireStringArrayMembership(
      failures,
      settings.assets.projectBundles,
      bundleName,
      "settings.assets.projectBundles",
      true,
    );
    requireStringArrayMembership(
      failures,
      settings.assets.projectBundles,
      configBundleName,
      "settings.assets.projectBundles",
      true,
    );
    requireStringArrayMembership(
      failures,
      settings.assets.remoteBundles,
      bundleName,
      "settings.assets.remoteBundles",
      modeName === "remote",
    );
    requireStringArrayMembership(
      failures,
      settings.assets.remoteBundles,
      configBundleName,
      "settings.assets.remoteBundles",
      false,
    );
    requireExactStringArray(
      failures,
      settings.assets.remoteBundles,
      modeName === "remote" ? [bundleName] : [],
      "settings.assets.remoteBundles",
    );
    requireStringArrayMembership(
      failures,
      settings.assets.subpackages,
      bundleName,
      "settings.assets.subpackages",
      modeName === "subpackage-smoke",
    );
    requireStringArrayMembership(
      failures,
      settings.assets.subpackages,
      configBundleName,
      "settings.assets.subpackages",
      false,
    );
    requireExactStringArray(
      failures,
      settings.assets.subpackages,
      modeName === "subpackage-smoke" ? [bundleName] : [],
      "settings.assets.subpackages",
    );
    const expectedServer = modeName === "remote" ? config.server : "";
    if (settings.assets.server !== expectedServer) {
      failures.push("settings.assets.server:must-match-attested-config");
    }
  }
  verifyGameAndProjectJson(
    entries,
    config,
    modeName,
    bundleName,
    configBundleName,
    failures,
  );

  if (failures.length > 0) {
    throw new WechatBuildContractError("wechat-build-output-layout-invalid", failures);
  }
  const trace = verifyBundleConfigTrace(
    bundleEntries,
    manifestTrace,
    modeName === "subpackage-smoke",
    bundleVersion,
  );
  const configTrace = verifyLocalConfigBundleTrace(
    configBundleEntries,
    profile,
    configBundleVersion,
  );
  const packageEntries = modeName === "remote"
    ? entries.filter((entry) => !entry.path.startsWith("remote/"))
    : entries;
  if (packageEntries.length === 0) {
    throw new WechatBuildContractError("wechat-package-empty", [
      "packageTree:nonempty-required",
    ]);
  }
  const treeSha256 = treeFingerprint(entries);
  const packageSha256 = treeFingerprint(packageEntries);
  const bundleTreeSha256 = treeFingerprint(bundleEntries);
  const packageBytes = totalBytes(packageEntries);
  const bundleBytes = totalBytes(bundleEntries);
  if (expectedTreeSha256 && treeSha256 !== expectedTreeSha256) {
    throw new WechatBuildContractError("build-tree-hash-mismatch", [
      "outputTree:expected-sha256-required",
    ]);
  }
  if (expectedPackageSha256 && packageSha256 !== expectedPackageSha256) {
    throw new WechatBuildContractError("package-tree-hash-mismatch", [
      "packageTree:expected-sha256-required",
    ]);
  }

  const finalOutputSnapshot = captureTreeSnapshot(root);
  compareTreeSnapshots(
    outputSnapshot,
    finalOutputSnapshot,
    "build-output-snapshot-drift",
    "outputTree",
  );
  const finalManifestTrace = loadManifestTrace(profile);
  compareManifestTraces(manifestTrace, finalManifestTrace);

  return Object.freeze({
    ok: true,
    gate,
    mode: modeName,
    releaseEligible: configVerification.releaseEligible,
    nonRelease: configVerification.nonRelease,
    files: entries.length,
    packageFiles: packageEntries.length,
    bundleFiles: bundleEntries.length,
    packageBytes,
    bundleBytes,
    sourceResourceBytes: profile.source.resourceBytes,
    repositorySourceByteEvidenceBoundaryBytes:
      profile.wechat.repositorySourceByteEvidenceBoundaryBytes,
    tracedAssets: trace.tracedAssets,
    bundleConfigFiles: trace.configFiles,
    configBundleFiles: configBundleEntries.length,
    configBundleConfigFiles: configTrace.configFiles,
    configBundleManifestUuid: configTrace.manifestUuid,
    manifestTraceSha256: manifestTrace.sha256,
    treeSha256,
    packageSha256,
    bundleTreeSha256,
  });
}

export function verifyWechatBuildOutputFile({
  configPath,
  gate,
  expectedMode,
  profilePath,
  outputRoot,
  expectedTreeSha256,
  expectedPackageSha256,
}) {
  const configResult = verifyWechatBuildConfigFile(configPath, {
    gate,
    expectedMode,
    profilePath,
  });
  return verifyWechatBuildOutput({
    config: configResult.config,
    gate,
    expectedMode,
    profile: configResult.profile,
    outputRoot,
    expectedTreeSha256,
    expectedPackageSha256,
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
    const optionMap = {
      "--config": "configPath",
      "--mode": "expectedMode",
      "--profile-file": "profilePath",
      "--output": "outputRoot",
      "--expect-tree-sha256": "expectedTreeSha256",
      "--expect-package-sha256": "expectedPackageSha256",
    };
    if (Object.hasOwn(optionMap, argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new WechatBuildContractError("cli-invalid", [`${argument}:value-required`]);
      }
      const key = optionMap[argument];
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
      "usage: --config FILE (--template|--production) [--mode MODE] [--output DIR]",
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
    const result = verifyWechatBuildOutputFile(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const code = error instanceof WechatBuildContractError
      ? error.code
      : "wechat-build-output-verification-failed";
    const failures = error instanceof WechatBuildContractError
      ? error.failures
      : ["output:verification-failed"];
    console.error(JSON.stringify({ ok: false, code, failures }, null, 2));
    process.exitCode = 1;
  }
}
