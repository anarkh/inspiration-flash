import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ToolchainBoundaryError,
  captureStableFile,
} from "./file-attestation.mjs";

const GIT_HASH_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EMPTY_STATUS_SHA256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const WORKSPACE_PACKAGE_NAMES = Object.freeze([
  "core",
  "runtime",
  "application",
  "save-codec",
  "client",
  "presentation",
]);

function reject(code) {
  throw new ToolchainBoundaryError(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fileIdentityFields(identity) {
  return [
    identity.device,
    identity.inode,
    identity.mode,
    identity.size,
    identity.modifiedNs,
    identity.changedNs,
  ];
}

function statIdentity(stat) {
  return Object.freeze({
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
    modifiedNs: stat.mtimeNs.toString(),
    changedNs: stat.ctimeNs.toString(),
  });
}

function sameFileIdentity(left, right) {
  return fileIdentityFields(left).every(
    (value, index) => value === fileIdentityFields(right)[index],
  );
}

function statusBuffer(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value === "string") return Buffer.from(value, "utf8");
  reject("git-candidate-status-invalid");
}

function exactGitHash(value, label) {
  const text = Buffer.isBuffer(value)
    ? value.toString("utf8").trim()
    : typeof value === "string"
      ? value.trim()
      : "";
  if (!GIT_HASH_PATTERN.test(text)) reject(`git-candidate-${label}-invalid`);
  return text;
}

/**
 * Pure constructor used by the production capture and the self-check. The raw
 * porcelain status never enters a success report because it can contain local
 * filenames; only its byte length and digest are retained.
 */
export function createGitCandidateFromProbe({
  gitRoot,
  head,
  tree,
  status,
}, { requireClean = true } = {}) {
  if (typeof gitRoot !== "string" || !isAbsolute(gitRoot)) {
    reject("git-candidate-root-invalid");
  }
  const bytes = statusBuffer(status);
  if (requireClean && bytes.length !== 0) reject("git-candidate-not-clean");
  return Object.freeze({
    schemaVersion: 1,
    gitRoot: resolve(gitRoot),
    head: exactGitHash(head, "head"),
    tree: exactGitHash(tree, "tree"),
    statusBytes: bytes.length,
    statusSha256: sha256(bytes),
    clean: bytes.length === 0,
  });
}

function runGit(repositoryPath, args, run = spawnSync) {
  const result = run("git", ["-C", repositoryPath, ...args], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.signal || result.status !== 0) {
    reject("git-candidate-probe-failed");
  }
  return result.stdout;
}

/** Capture HEAD, HEAD^{tree}, and the complete v1 status including untracked files. */
export function captureGitCandidate(
  repositoryPath,
  { requireClean = true, run = spawnSync } = {},
) {
  let configuredRoot;
  try {
    configuredRoot = realpathSync.native(resolve(repositoryPath));
  } catch {
    reject("git-candidate-root-unreadable");
  }
  const discoveredRoot = runGit(
    configuredRoot,
    ["rev-parse", "--show-toplevel"],
    run,
  ).toString("utf8").trim();
  let gitRoot;
  try {
    gitRoot = realpathSync.native(discoveredRoot);
  } catch {
    reject("git-candidate-root-unreadable");
  }
  return createGitCandidateFromProbe({
    gitRoot,
    head: runGit(gitRoot, ["rev-parse", "--verify", "HEAD"], run),
    tree: runGit(gitRoot, ["rev-parse", "--verify", "HEAD^{tree}"], run),
    status: runGit(
      gitRoot,
      [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ],
      run,
    ),
  }, { requireClean });
}

export function assertGitCandidateUnchanged(expected, current) {
  for (const field of ["gitRoot", "head", "tree", "statusBytes", "statusSha256"]) {
    if (expected?.[field] !== current?.[field]) {
      reject(`git-candidate-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-drift`);
    }
  }
  if (!expected.clean || !current.clean || current.statusSha256 !== EMPTY_STATUS_SHA256) {
    reject("git-candidate-status-drift");
  }
  return current;
}

function defaultInspectOutputRoot(path) {
  try {
    const stat = lstatSync(path, { bigint: true });
    return Object.freeze({
      exists: true,
      directory: stat.isDirectory(),
      symbolicLink: stat.isSymbolicLink(),
    });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return Object.freeze({
        exists: false,
        directory: false,
        symbolicLink: false,
      });
    }
    reject("build-output-path-unreadable");
  }
}

/**
 * Records an exact, lexical output leaf without creating or deleting it.
 * lstat semantics deliberately treat a dangling symlink as pre-existing.
 */
export function attestAbsentOutputRoot(
  outputRoot,
  { inspectOutputRoot = defaultInspectOutputRoot } = {},
) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0) {
    reject("build-output-path-invalid");
  }
  const exactRoot = resolve(outputRoot);
  const before = inspectOutputRoot(exactRoot);
  if (!before || typeof before.exists !== "boolean") {
    reject("build-output-freshness-inspection-invalid");
  }
  if (before?.exists) reject("build-output-preexisting");
  return Object.freeze({
    schemaVersion: 1,
    outputRoot: exactRoot,
    existedBeforeBuild: false,
  });
}

/** Only a Creator success exit plus an absent-to-real-directory transition is fresh. */
export function assertFreshBuildOutput({
  attestation,
  result,
  successExitCode,
  inspectOutputRoot = defaultInspectOutputRoot,
}) {
  if (
    result?.error
    || result?.signal
    || result?.status !== successExitCode
  ) {
    reject("creator-build-not-successful");
  }
  if (!attestation || attestation.existedBeforeBuild !== false) {
    reject("build-output-freshness-attestation-invalid");
  }
  const after = inspectOutputRoot(attestation.outputRoot);
  if (!after || typeof after.exists !== "boolean") {
    reject("build-output-freshness-inspection-invalid");
  }
  if (!after?.exists) reject("build-output-not-created");
  if (after.symbolicLink || !after.directory) reject("build-output-root-invalid");
  return Object.freeze({
    ok: true,
    outputRoot: attestation.outputRoot,
    createdByBuildWindow: true,
  });
}

function normalizedRelativeFilePath(path) {
  const segments = typeof path === "string" ? path.split("/") : [];
  if (
    typeof path !== "string"
    || path.length === 0
    || isAbsolute(path)
    || path.includes("\\")
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    reject("build-dist-path-invalid");
  }
  return path;
}

/** Pure deterministic tree constructor used by filesystem capture and tests. */
export function createDistTreeAttestationFromEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    reject("build-dist-regular-files-required");
  }
  const normalized = entries.map((entry) => {
    if (entry?.kind !== "file") reject("build-dist-special-object-forbidden");
    const path = normalizedRelativeFilePath(entry.path);
    if (
      !Number.isSafeInteger(entry.bytes)
      || entry.bytes < 0
      || !SHA256_PATTERN.test(entry.sha256 ?? "")
      || !entry.identity
      || fileIdentityFields(entry.identity).some(
        (value) => typeof value !== "string" || value.length === 0,
      )
      || Number(entry.identity.size) !== entry.bytes
    ) {
      reject("build-dist-file-attestation-invalid");
    }
    return Object.freeze({
      kind: "file",
      path,
      bytes: entry.bytes,
      sha256: entry.sha256,
      identity: entry.identity,
    });
  }).sort((left, right) => left.path.localeCompare(right.path));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].path === normalized[index].path) {
      reject("build-dist-path-duplicate");
    }
  }
  const contentPayload = normalized.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
  ].join("\0")).join("\n");
  const identityPayload = normalized.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
    ...fileIdentityFields(entry.identity),
  ].join("\0")).join("\n");
  return Object.freeze({
    schemaVersion: 1,
    fileCount: normalized.length,
    totalBytes: normalized.reduce((total, entry) => total + entry.bytes, 0),
    contentTreeSha256: sha256(Buffer.from(contentPayload, "utf8")),
    identityTreeSha256: sha256(Buffer.from(identityPayload, "utf8")),
  });
}

export function assertDistTreeUnchanged(expected, current) {
  for (const field of [
    "fileCount",
    "totalBytes",
    "contentTreeSha256",
    "identityTreeSha256",
  ]) {
    if (expected?.[field] !== current?.[field]) reject(`build-dist-${field}-drift`);
  }
  return current;
}

function scanRegularTree(directory, projectRoot, captureFile, output) {
  let beforeStat;
  try {
    beforeStat = lstatSync(directory, { bigint: true });
  } catch {
    reject("build-dist-directory-missing");
  }
  if (beforeStat.isSymbolicLink() || !beforeStat.isDirectory()) {
    reject("build-dist-real-directory-required");
  }
  const beforeIdentity = statIdentity(beforeStat);
  let children;
  try {
    children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    reject("build-dist-directory-unreadable");
  }
  for (const child of children) {
    const childPath = resolve(directory, child.name);
    let childStat;
    try {
      childStat = lstatSync(childPath, { bigint: true });
    } catch {
      reject("build-dist-tree-drift-during-read");
    }
    if (childStat.isSymbolicLink()) reject("build-dist-symlink-forbidden");
    if (childStat.isDirectory()) {
      scanRegularTree(childPath, projectRoot, captureFile, output);
      continue;
    }
    if (!childStat.isFile()) reject("build-dist-special-object-forbidden");
    const captured = captureFile(childPath);
    const path = assertWithinRoot(projectRoot, captured.canonicalPath);
    if (resolve(projectRoot, ...path.split("/")) !== childPath) {
      reject("build-dist-canonical-path-drift");
    }
    output.push(Object.freeze({
      kind: "file",
      path,
      bytes: Number(captured.identity.size),
      sha256: captured.sha256,
      identity: captured.identity,
    }));
  }
  let afterStat;
  try {
    afterStat = lstatSync(directory, { bigint: true });
  } catch {
    reject("build-dist-tree-drift-during-read");
  }
  if (
    afterStat.isSymbolicLink()
    || !afterStat.isDirectory()
    || !sameFileIdentity(beforeIdentity, statIdentity(afterStat))
  ) {
    reject("build-dist-tree-drift-during-read");
  }
}

function collectExportTargets(value, output) {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reject("build-dist-package-exports-invalid");
  }
  for (const child of Object.values(value)) collectExportTargets(child, output);
}

function runtimeExportTarget(packageJson) {
  const rootExport = packageJson.exports?.["."];
  if (typeof rootExport === "string") return rootExport;
  if (rootExport && typeof rootExport.default === "string") return rootExport.default;
  if (typeof packageJson.main === "string") return packageJson.main;
  reject("build-dist-runtime-export-missing");
}

/**
 * Creator source uses bare @infinite-flow/* imports. All package export maps
 * and Node workspace resolution point to these ignored dist trees, so they are
 * explicit production build inputs rather than disposable verification output.
 */
export function captureWorkspaceDistAttestation({
  projectRoot,
  captureFile = captureStableFile,
  resolvePackage,
}) {
  let root;
  try {
    root = realpathSync.native(resolve(projectRoot));
  } catch {
    reject("build-source-root-unreadable");
  }
  const requireFromProject = createRequire(resolve(root, "package.json"));
  const resolveBarePackage = resolvePackage
    ?? ((specifier) => requireFromProject.resolve(specifier));
  const files = [];
  const resolutionEvidence = [];
  for (const shortName of WORKSPACE_PACKAGE_NAMES) {
    const packageName = `@infinite-flow/${shortName}`;
    const packageRoot = resolve(root, "packages", shortName);
    const packageJsonCapture = captureFile(
      resolve(packageRoot, "package.json"),
      { includeContent: true },
    );
    let packageJson;
    try {
      packageJson = JSON.parse(packageJsonCapture.content.toString("utf8"));
    } catch {
      reject("build-dist-package-json-invalid");
    }
    if (packageJson.name !== packageName || !packageJson.exports) {
      reject("build-dist-package-exports-invalid");
    }
    const exportTargets = new Set();
    collectExportTargets(packageJson.exports, exportTargets);
    for (const optionalTarget of [packageJson.main, packageJson.types]) {
      if (typeof optionalTarget === "string") exportTargets.add(optionalTarget);
    }
    if (
      exportTargets.size === 0
      || [...exportTargets].some((target) => !target.startsWith("./dist/"))
    ) {
      reject("build-dist-package-export-outside-dist");
    }

    const packageFiles = [];
    scanRegularTree(resolve(packageRoot, "dist"), root, captureFile, packageFiles);
    const packagePaths = new Set(packageFiles.map((entry) => (
      `./${relative(packageRoot, resolve(root, ...entry.path.split("/"))).split(sep).join("/")}`
    )));
    if ([...exportTargets].some((target) => !packagePaths.has(target))) {
      reject("build-dist-package-export-missing");
    }
    files.push(...packageFiles);

    let resolvedEntry;
    try {
      resolvedEntry = realpathSync.native(resolveBarePackage(packageName));
    } catch {
      reject("build-dist-bare-package-unresolvable");
    }
    const expectedEntry = realpathSync.native(resolve(
      packageRoot,
      runtimeExportTarget(packageJson),
    ));
    if (resolvedEntry !== expectedEntry) reject("build-dist-bare-package-resolution-drift");
    resolutionEvidence.push([
      packageName,
      assertWithinRoot(root, expectedEntry),
      packageJsonCapture.sha256,
      ...fileIdentityFields(packageJsonCapture.identity),
    ].join("\0"));
  }
  const tree = createDistTreeAttestationFromEntries(files);
  return Object.freeze({
    ...tree,
    packageCount: WORKSPACE_PACKAGE_NAMES.length,
    resolutionSha256: sha256(Buffer.from(
      resolutionEvidence.sort().join("\n"),
      "utf8",
    )),
  });
}

function assertWithinRoot(root, path) {
  const pathFromRoot = relative(root, path);
  if (
    pathFromRoot === ".."
    || pathFromRoot.startsWith(`..${sep}`)
    || isAbsolute(pathFromRoot)
  ) {
    reject("build-source-path-escaped-project");
  }
  return pathFromRoot.split(sep).join("/");
}

function stableSourceFile(path, root, captureFile) {
  const captured = captureFile(path);
  const relativePath = assertWithinRoot(root, captured.canonicalPath);
  return Object.freeze({
    relativePath,
    sha256: captured.sha256,
    identity: captured.identity,
  });
}

/**
 * Bind the manifest, each Cocos resource byte stream, and every corresponding
 * metadata file. Git binds the rest of the source candidate; this attestation
 * makes the production asset subject explicit and independently re-checkable.
 */
export function captureBuildSourceAttestation({
  projectRoot,
  profile,
  captureFile = captureStableFile,
}) {
  let root;
  try {
    root = realpathSync.native(resolve(projectRoot));
  } catch {
    reject("build-source-root-unreadable");
  }
  const manifestPath = resolve(root, profile?.source?.manifestPath ?? "");
  assertWithinRoot(root, manifestPath);
  const manifestCapture = captureFile(manifestPath, { includeContent: true });
  assertWithinRoot(root, manifestCapture.canonicalPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestCapture.content.toString("utf8"));
  } catch {
    reject("build-source-manifest-invalid");
  }
  if (
    !Array.isArray(manifest.assets)
    || manifest.assets.length !== profile.source.assetCount
    || manifest.manifestRevision !== profile.source.manifestRevision
    || typeof manifest.resourceRoot !== "string"
  ) {
    reject("build-source-manifest-contract-invalid");
  }

  const resourceRoot = resolve(root, manifest.resourceRoot);
  assertWithinRoot(root, resourceRoot);
  const entries = [];
  let resourceBytes = 0;
  for (const asset of manifest.assets) {
    if (
      typeof asset?.key !== "string"
      || typeof asset.resourceFile !== "string"
    ) {
      reject("build-source-manifest-contract-invalid");
    }
    const resourcePath = resolve(resourceRoot, asset.resourceFile);
    assertWithinRoot(resourceRoot, resourcePath);
    const resource = stableSourceFile(resourcePath, root, captureFile);
    const metadata = stableSourceFile(`${resourcePath}.meta`, root, captureFile);
    resourceBytes += Number(resource.identity.size);
    entries.push(Object.freeze({
      key: asset.key,
      resource,
      metadata,
    }));
  }
  if (resourceBytes !== profile.source.resourceBytes) {
    reject("build-source-resource-bytes-drift");
  }
  const workspaceDist = captureWorkspaceDistAttestation({
    projectRoot: root,
    captureFile,
  });
  entries.sort((left, right) => left.key.localeCompare(right.key));
  const identityPayload = entries.map(({ key, resource, metadata }) => [
    key,
    resource.relativePath,
    resource.sha256,
    ...fileIdentityFields(resource.identity),
    metadata.relativePath,
    metadata.sha256,
    ...fileIdentityFields(metadata.identity),
  ].join("\0")).join("\n");
  const manifestIdentityPayload = [
    assertWithinRoot(root, manifestCapture.canonicalPath),
    manifestCapture.sha256,
    ...fileIdentityFields(manifestCapture.identity),
  ].join("\0");
  return Object.freeze({
    schemaVersion: 1,
    manifestRevision: manifest.manifestRevision,
    manifestSha256: manifestCapture.sha256,
    manifestIdentitySha256: sha256(Buffer.from(manifestIdentityPayload, "utf8")),
    assetCount: entries.length,
    resourceBytes,
    assetIdentitySha256: sha256(Buffer.from(identityPayload, "utf8")),
    distPackageCount: workspaceDist.packageCount,
    distFileCount: workspaceDist.fileCount,
    distBytes: workspaceDist.totalBytes,
    distContentTreeSha256: workspaceDist.contentTreeSha256,
    distIdentityTreeSha256: workspaceDist.identityTreeSha256,
    distResolutionSha256: workspaceDist.resolutionSha256,
  });
}

export function assertBuildSourceUnchanged(expected, current) {
  for (const field of [
    "manifestRevision",
    "manifestSha256",
    "manifestIdentitySha256",
    "assetCount",
    "resourceBytes",
    "assetIdentitySha256",
    "distPackageCount",
    "distFileCount",
    "distBytes",
    "distContentTreeSha256",
    "distIdentityTreeSha256",
    "distResolutionSha256",
  ]) {
    if (expected?.[field] !== current?.[field]) reject(`build-source-${field}-drift`);
  }
  return current;
}

export function assertBuildConfigVerificationUnchanged(expected, current) {
  for (const field of [
    "configCanonicalPath",
    "configSha256",
    "profileSha256",
    "mode",
    "releaseEligible",
  ]) {
    if (expected?.[field] !== current?.[field]) reject(`build-config-${field}-drift`);
  }
  return current;
}
