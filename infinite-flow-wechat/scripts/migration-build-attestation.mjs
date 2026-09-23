import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { endianness, tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { deflateSync } from "node:zlib";

import {
  assertStableFileUnchanged,
  captureStableFile,
} from "./file-attestation.mjs";
import { inspectNpmToolchain } from "./npm-toolchain.mjs";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40,64}$/;
const WORKSPACE_PACKAGES = Object.freeze([
  "core",
  "runtime",
  "application",
  "save-codec",
  "client",
  "presentation",
]);
const SUPPORTED_CAPABILITIES = Object.freeze(["esbuild"]);
const BUILD_PLAN = Object.freeze([
  Object.freeze({ package: "core", config: "tsconfig.build.json" }),
  Object.freeze({
    package: "core",
    postprocess: "scripts/rewrite-esm-imports.mjs",
  }),
  Object.freeze({ package: "runtime", config: "tsconfig.json" }),
  Object.freeze({ package: "application", config: "tsconfig.build.json" }),
  Object.freeze({ package: "save-codec", config: "tsconfig.build.json" }),
  Object.freeze({ package: "client", config: "tsconfig.build.json" }),
  Object.freeze({ package: "presentation", config: "tsconfig.build.json" }),
]);
const ESBUILD_BINARY_OVERRIDE = "ESBUILD_BINARY_PATH";
const ESBUILD_PLATFORM_BINARIES = Object.freeze({
  "aix-ppc64-BE": Object.freeze(["@esbuild/aix-ppc64", "bin/esbuild"]),
  "android-arm-LE": Object.freeze(["@esbuild/android-arm", "bin/esbuild"]),
  "android-arm64-LE": Object.freeze(["@esbuild/android-arm64", "bin/esbuild"]),
  "android-x64-LE": Object.freeze(["@esbuild/android-x64", "bin/esbuild"]),
  "darwin-arm64-LE": Object.freeze(["@esbuild/darwin-arm64", "bin/esbuild"]),
  "darwin-x64-LE": Object.freeze(["@esbuild/darwin-x64", "bin/esbuild"]),
  "freebsd-arm64-LE": Object.freeze(["@esbuild/freebsd-arm64", "bin/esbuild"]),
  "freebsd-x64-LE": Object.freeze(["@esbuild/freebsd-x64", "bin/esbuild"]),
  "linux-arm-LE": Object.freeze(["@esbuild/linux-arm", "bin/esbuild"]),
  "linux-arm64-LE": Object.freeze(["@esbuild/linux-arm64", "bin/esbuild"]),
  "linux-ia32-LE": Object.freeze(["@esbuild/linux-ia32", "bin/esbuild"]),
  "linux-loong64-LE": Object.freeze(["@esbuild/linux-loong64", "bin/esbuild"]),
  "linux-mips64el-LE": Object.freeze(["@esbuild/linux-mips64el", "bin/esbuild"]),
  "linux-ppc64-LE": Object.freeze(["@esbuild/linux-ppc64", "bin/esbuild"]),
  "linux-riscv64-LE": Object.freeze(["@esbuild/linux-riscv64", "bin/esbuild"]),
  "linux-s390x-BE": Object.freeze(["@esbuild/linux-s390x", "bin/esbuild"]),
  "linux-x64-LE": Object.freeze(["@esbuild/linux-x64", "bin/esbuild"]),
  "netbsd-x64-LE": Object.freeze(["@esbuild/netbsd-x64", "bin/esbuild"]),
  "openbsd-x64-LE": Object.freeze(["@esbuild/openbsd-x64", "bin/esbuild"]),
  "sunos-x64-LE": Object.freeze(["@esbuild/sunos-x64", "bin/esbuild"]),
  "win32-arm64-LE": Object.freeze(["@esbuild/win32-arm64", "esbuild.exe"]),
  "win32-ia32-LE": Object.freeze(["@esbuild/win32-ia32", "esbuild.exe"]),
  "win32-x64-LE": Object.freeze(["@esbuild/win32-x64", "esbuild.exe"]),
});

export class MigrationBuildAttestationError extends Error {
  constructor(code) {
    super(code);
    this.name = "MigrationBuildAttestationError";
    this.code = code;
  }
}

function reject(code) {
  throw new MigrationBuildAttestationError(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobObjectId(bytes, expectedObjectId) {
  const algorithm = expectedObjectId.length === 40
    ? "sha1"
    : expectedObjectId.length === 64
      ? "sha256"
      : undefined;
  if (algorithm === undefined) reject("migration-build-git-object-format-invalid");
  return createHash(algorithm)
    .update(Buffer.from(`blob ${bytes.byteLength}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function withCanonicalHash(payload) {
  return Object.freeze({
    ...payload,
    canonicalSha256: sha256(Buffer.from(stableJson(payload), "utf8")),
  });
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

function sameIdentity(left, right) {
  return fileIdentityFields(left).every(
    (value, index) => value === fileIdentityFields(right)[index],
  );
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

function directoryIdentity(stat) {
  return Object.freeze({
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: stat.mode.toString(),
  });
}

function sameDirectoryIdentity(left, right) {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode;
}

function pathInside(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function canonicalDirectory(path, code) {
  let canonical;
  let stat;
  try {
    const lexicalStat = lstatSync(path, { bigint: true });
    if (lexicalStat.isSymbolicLink() || !lexicalStat.isDirectory()) reject(code);
    canonical = realpathSync.native(path);
    stat = lstatSync(canonical, { bigint: true });
  } catch (error) {
    if (error instanceof MigrationBuildAttestationError) throw error;
    reject(code);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) reject(code);
  return canonical;
}

function formalNodeHookReason() {
  if (
    Object.prototype.hasOwnProperty.call(process.env, "NODE_OPTIONS")
    && process.env.NODE_OPTIONS?.trim() !== ""
  ) {
    return "migration-formal-node-options-forbidden";
  }
  if (
    Object.prototype.hasOwnProperty.call(process.env, "NODE_PATH")
    && process.env.NODE_PATH?.trim() !== ""
  ) {
    return "migration-formal-node-path-forbidden";
  }
  const hookFlags = new Set([
    "--loader",
    "--experimental-loader",
    "--require",
    "-r",
    "--import",
  ]);
  for (let index = 0; index < process.execArgv.length; index += 1) {
    const argument = process.execArgv[index];
    if (
      hookFlags.has(argument)
      || argument.startsWith("--loader=")
      || argument.startsWith("--experimental-loader=")
      || argument.startsWith("--require=")
      || (argument.startsWith("-r") && argument !== "-r")
      || argument.startsWith("--import=")
    ) {
      return "migration-formal-node-loader-hook-forbidden";
    }
  }
  if (process.execArgv.length !== 0) {
    return "migration-formal-node-exec-argv-forbidden";
  }
  return undefined;
}

function rejectAmbientFormalEnvironment() {
  rejectEsbuildBinaryOverride();
  const inertGitEnvironment = new Set([
    "GIT_ASKPASS",
    "GIT_EDITOR",
    "GIT_PAGER",
    "GIT_SEQUENCE_EDITOR",
    "GIT_TERMINAL_PROMPT",
  ]);
  if (
    Object.keys(process.env).some(
      (name) => name.startsWith("GIT_") && !inertGitEnvironment.has(name),
    )
  ) {
    reject("migration-formal-git-environment-forbidden");
  }
  const nodeHookReason = formalNodeHookReason();
  if (nodeHookReason !== undefined) reject(nodeHookReason);
}

function trustedGitExecutablePath() {
  const candidates = process.platform === "win32"
    ? []
    : process.platform === "darwin"
      ? ["/usr/bin/git"]
      : ["/usr/bin/git", "/bin/git"];
  for (const candidate of candidates) {
    try {
      const stat = lstatSync(candidate, { bigint: true });
      if (!stat.isSymbolicLink() && stat.isFile()) return candidate;
    } catch {
      // Continue to the next fixed system location.
    }
  }
  reject("migration-formal-git-executable-unavailable");
}

function cleanGitEnvironment() {
  return {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    HOME: "/nonexistent-infinite-flow-migration-home",
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    TZ: "UTC",
  };
}

function runTrustedGitUnchecked(boundary, args, { encoding = null } = {}) {
  const result = spawnSync(boundary.gitExecutable.canonicalPath, [
    "--git-dir",
    boundary.gitDirectory,
    "--work-tree",
    boundary.repositoryRoot,
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    ...args,
  ], {
    encoding,
    env: cleanGitEnvironment(),
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.signal || result.status !== 0) {
    reject("migration-build-git-probe-failed");
  }
  return result.stdout;
}

function runTrustedGit(boundary, args, options) {
  boundary.assertUnchanged();
  return runTrustedGitUnchecked(boundary, args, options);
}

export function prepareMigrationFormalBoundary({ repositoryRoot }) {
  rejectAmbientFormalEnvironment();
  const canonicalRepository = canonicalDirectory(
    repositoryRoot,
    "migration-formal-repository-root-invalid",
  );
  const gitDirectory = canonicalDirectory(
    resolve(canonicalRepository, ".git"),
    "migration-formal-git-directory-invalid",
  );
  const repositoryIdentity = directoryIdentity(
    lstatSync(canonicalRepository, { bigint: true }),
  );
  const gitDirectoryIdentity = directoryIdentity(
    lstatSync(gitDirectory, { bigint: true }),
  );
  let gitExecutable;
  try {
    gitExecutable = captureStableFile(trustedGitExecutablePath(), {
      requireExecutable: true,
    });
  } catch (error) {
    if (error instanceof MigrationBuildAttestationError) throw error;
    reject("migration-formal-git-executable-unattested");
  }
  const versionResult = spawnSync(gitExecutable.canonicalPath, ["--version"], {
    encoding: "utf8",
    env: cleanGitEnvironment(),
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
  if (
    versionResult.error
    || versionResult.signal
    || versionResult.status !== 0
    || !/^git version \d+\.\d+(?:\.\d+)?/.test(versionResult.stdout.trim())
  ) {
    reject("migration-formal-git-version-unattested");
  }
  const boundary = {
    repositoryRoot: canonicalRepository,
    gitDirectory,
    gitExecutable,
    version: versionResult.stdout.trim(),
    assertUnchanged() {
      rejectAmbientFormalEnvironment();
      assertCapturedFileUnchanged(
        gitExecutable,
        { requireExecutable: true },
        "migration-formal-git-executable-drift",
      );
      let currentRepositoryIdentity;
      let currentGitDirectoryIdentity;
      try {
        currentRepositoryIdentity = directoryIdentity(
          lstatSync(canonicalRepository, { bigint: true }),
        );
        currentGitDirectoryIdentity = directoryIdentity(
          lstatSync(gitDirectory, { bigint: true }),
        );
      } catch {
        reject("migration-formal-git-directory-drift");
      }
      if (
        !sameDirectoryIdentity(
          repositoryIdentity,
          currentRepositoryIdentity,
        )
        || !sameDirectoryIdentity(
          gitDirectoryIdentity,
          currentGitDirectoryIdentity,
        )
        || canonicalDirectory(
          resolve(canonicalRepository, ".git"),
          "migration-formal-git-directory-drift",
        ) !== gitDirectory
      ) {
        reject("migration-formal-git-directory-drift");
      }
    },
  };
  boundary.publicAttestation = withCanonicalHash({
    schemaVersion: 1,
    version: boundary.version,
    executable: publicFileIdentity(gitExecutable),
    gitDirectory,
    repositoryIdentity,
    gitDirectoryIdentity,
    strictReachableObjectValidation: true,
  });
  boundary.runGit = (args, options) => runTrustedGit(boundary, args, options);
  boundary.assertRepositoryObjects = () => {
    boundary.assertUnchanged();
    try {
      runTrustedGitUnchecked(boundary, ["fsck", "--strict", "--no-dangling", "HEAD"], {
        encoding: "utf8",
      });
    } catch {
      reject("migration-formal-git-object-graph-invalid");
    }
  };
  boundary.assertUnchanged();
  try {
    boundary.assertRepositoryObjects();
  } catch {
    reject("migration-formal-git-object-graph-invalid");
  }
  return boundary;
}

function normalizedProjectPath(repositoryRoot, projectRoot) {
  const path = relative(repositoryRoot, projectRoot);
  if (path === "") return "";
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    reject("migration-build-project-outside-repository");
  }
  return path.split(sep).join("/");
}

function isBuildInput(relativePath) {
  if (
    relativePath === "package.json"
    || relativePath === "package-lock.json"
    || relativePath === "toolchain/cocos-toolchain.lock.json"
  ) {
    return true;
  }
  const match = /^packages\/([^/]+)\/(.+)$/.exec(relativePath);
  if (!match || !WORKSPACE_PACKAGES.includes(match[1])) return false;
  const packagePath = match[2];
  return packagePath === "package.json"
    || packagePath === "tsconfig.json"
    || packagePath === "tsconfig.build.json"
    || packagePath.startsWith("src/")
    || (match[1] === "core" && packagePath === "scripts/rewrite-esm-imports.mjs");
}

function parseGitTree(raw, projectPath) {
  const prefix = projectPath === "" ? "" : `${projectPath}/`;
  const entries = [];
  for (const record of raw.toString("utf8").split("\0")) {
    if (record.length === 0) continue;
    const match = /^(\d{6}) (\S+) ([0-9a-f]{40,64})\t(.+)$/.exec(record);
    if (!match) reject("migration-build-git-tree-invalid");
    const [, mode, type, object, repositoryPath] = match;
    if (type !== "blob" || !["100644", "100755"].includes(mode)) {
      reject("migration-build-git-special-input-forbidden");
    }
    if (prefix && !repositoryPath.startsWith(prefix)) {
      reject("migration-build-git-tree-path-invalid");
    }
    const relativePath = prefix ? repositoryPath.slice(prefix.length) : repositoryPath;
    if (!isBuildInput(relativePath)) continue;
    if (
      relativePath.length === 0
      || relativePath.includes("\\")
      || relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) {
      reject("migration-build-git-tree-path-invalid");
    }
    entries.push({ mode, object, relativePath });
  }
  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (entries.length === 0) reject("migration-build-source-inputs-missing");
  return entries;
}

function materializeBuildInputs({
  formalBoundary,
  projectRoot,
  headSha,
  headTreeSha,
  outputRoot,
}) {
  if (!GIT_OBJECT_PATTERN.test(headSha ?? "")) reject("migration-build-head-invalid");
  const repositoryRoot = formalBoundary.repositoryRoot;
  const projectPath = normalizedProjectPath(repositoryRoot, projectRoot);
  const observedTree = formalBoundary.runGit([
    "rev-parse",
    `${headSha}^{tree}`,
  ], { encoding: "utf8" }).trim();
  if (observedTree !== headTreeSha) {
    reject("migration-build-head-tree-relationship-invalid");
  }
  const selector = projectPath === "" ? "." : projectPath;
  const rawTree = formalBoundary.runGit([
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    headSha,
    "--",
    selector,
  ]);
  const entries = parseGitTree(rawTree, projectPath);
  const materialized = [];
  for (const entry of entries) {
    const bytes = formalBoundary.runGit(["cat-file", "blob", entry.object]);
    if (gitBlobObjectId(bytes, entry.object) !== entry.object) {
      reject("migration-build-git-blob-content-mismatch");
    }
    const destination = resolve(outputRoot, ...entry.relativePath.split("/"));
    if (!pathInside(outputRoot, destination)) reject("migration-build-output-path-escaped");
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    writeFileSync(destination, bytes, {
      flag: "wx",
      mode: entry.mode === "100755" ? 0o700 : 0o600,
    });
    materialized.push(Object.freeze({
      path: entry.relativePath,
      gitMode: entry.mode,
      gitBlob: entry.object,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }));
  }
  const required = new Set([
    "package.json",
    "package-lock.json",
    "toolchain/cocos-toolchain.lock.json",
    ...WORKSPACE_PACKAGES.flatMap((name) => [
      `packages/${name}/package.json`,
      `packages/${name}/tsconfig.json`,
    ]),
    ...WORKSPACE_PACKAGES
      .filter((name) => name !== "runtime")
      .map((name) => `packages/${name}/tsconfig.build.json`),
    "packages/core/scripts/rewrite-esm-imports.mjs",
  ]);
  const actual = new Set(materialized.map((entry) => entry.path));
  if ([...required].some((path) => !actual.has(path))) {
    reject("migration-build-required-source-input-missing");
  }
  const payload = materialized.map((entry) => [
    entry.path,
    entry.gitMode,
    entry.gitBlob,
    String(entry.bytes),
    entry.sha256,
  ].join("\0")).join("\n");
  return {
    projectPath: projectPath || ".",
    entries: materialized,
    fileCount: materialized.length,
    totalBytes: materialized.reduce((sum, entry) => sum + entry.bytes, 0),
    contentTreeSha256: sha256(Buffer.from(payload, "utf8")),
  };
}

function scanMaterializedBuildInputs(buildRoot, expectedEntries) {
  const actualPaths = [];
  const walk = (directory) => {
    const children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const path = resolve(directory, child.name);
      const relativePath = relative(buildRoot, path).split(sep).join("/");
      if (
        relativePath === "node_modules"
        || relativePath.startsWith("node_modules/")
        || /^(?:packages\/[^/]+\/dist)(?:\/|$)/.test(relativePath)
      ) {
        continue;
      }
      const stat = lstatSync(path, { bigint: true });
      if (stat.isSymbolicLink()) {
        if (isBuildInput(relativePath)) reject("migration-build-source-symlink-forbidden");
        continue;
      }
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (isBuildInput(relativePath)) {
        if (!stat.isFile()) reject("migration-build-source-file-not-regular");
        actualPaths.push(relativePath);
      }
    }
  };
  walk(buildRoot);
  actualPaths.sort((left, right) => left.localeCompare(right));
  const expectedPaths = expectedEntries.map((entry) => entry.path).sort();
  if (stableJson(actualPaths) !== stableJson(expectedPaths)) {
    reject("migration-build-source-path-set-drift");
  }
  const entries = [];
  for (const expected of expectedEntries) {
    const path = resolve(buildRoot, ...expected.path.split("/"));
    let lexicalStat;
    let captured;
    try {
      lexicalStat = lstatSync(path, { bigint: true });
      if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
        reject("migration-build-source-file-not-regular");
      }
      captured = captureStableFile(path);
    } catch (error) {
      if (error instanceof MigrationBuildAttestationError) throw error;
      reject("migration-build-source-file-unattested");
    }
    if (
      captured.configuredPath !== path
      || captured.canonicalPath !== path
      || captured.sha256 !== expected.sha256
      || Number(captured.identity.size) !== expected.bytes
    ) {
      reject("migration-build-source-content-drift");
    }
    entries.push({
      path: expected.path,
      bytes: expected.bytes,
      sha256: captured.sha256,
      identity: captured.identity,
    });
  }
  const contentPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
  ].join("\0")).join("\n");
  const identityPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
    ...fileIdentityFields(entry.identity),
  ].join("\0")).join("\n");
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    contentTreeSha256: sha256(Buffer.from(contentPayload, "utf8")),
    identityTreeSha256: sha256(Buffer.from(identityPayload, "utf8")),
  };
}

function sameMaterializedSourceIdentity(left, right) {
  return left.fileCount === right.fileCount
    && left.totalBytes === right.totalBytes
    && left.contentTreeSha256 === right.contentTreeSha256
    && left.identityTreeSha256 === right.identityTreeSha256;
}

function readMaterializedJson(root, relativePath, code) {
  try {
    return JSON.parse(readFileSync(resolve(root, ...relativePath.split("/")), "utf8"));
  } catch {
    reject(code);
  }
}

function scanRegularTree(directory, root, output) {
  let before;
  try {
    before = lstatSync(directory, { bigint: true });
  } catch {
    reject("migration-dist-directory-missing");
  }
  if (before.isSymbolicLink() || !before.isDirectory()) {
    reject("migration-dist-real-directory-required");
  }
  const beforeIdentity = statIdentity(before);
  let children;
  try {
    children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    reject("migration-dist-directory-unreadable");
  }
  for (const child of children) {
    const path = resolve(directory, child.name);
    let stat;
    try {
      stat = lstatSync(path, { bigint: true });
    } catch {
      reject("migration-dist-tree-drift-during-read");
    }
    if (stat.isSymbolicLink()) reject("migration-dist-symlink-forbidden");
    if (stat.isDirectory()) {
      scanRegularTree(path, root, output);
      continue;
    }
    if (!stat.isFile()) reject("migration-dist-special-object-forbidden");
    const captured = captureStableFile(path);
    if (captured.canonicalPath !== path || !pathInside(root, path)) {
      reject("migration-dist-canonical-path-drift");
    }
    output.push(Object.freeze({
      path: relative(root, path).split(sep).join("/"),
      bytes: Number(captured.identity.size),
      sha256: captured.sha256,
      identity: captured.identity,
    }));
  }
  let after;
  try {
    after = lstatSync(directory, { bigint: true });
  } catch {
    reject("migration-dist-tree-drift-during-read");
  }
  if (
    after.isSymbolicLink()
    || !after.isDirectory()
    || !sameIdentity(beforeIdentity, statIdentity(after))
  ) {
    reject("migration-dist-tree-drift-during-read");
  }
}

function runtimeExport(packageJson) {
  const root = packageJson?.exports?.["."];
  if (typeof root === "string") return root;
  if (root && typeof root.default === "string") return root.default;
  if (typeof packageJson?.main === "string") return packageJson.main;
  reject("migration-dist-runtime-export-missing");
}

function collectExportTargets(value, output) {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    reject("migration-dist-package-exports-invalid");
  }
  for (const child of Object.values(value)) collectExportTargets(child, output);
}

function scanDistImportGraph(root, entries, typescriptApi) {
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const requireFromProject = createRequire(resolve(root, "package.json"));
  const edges = [];
  for (const entry of entries) {
    if (!/\.(?:c|m)?js$/.test(entry.path)) continue;
    const sourcePath = resolve(root, ...entry.path.split("/"));
    let captured;
    try {
      captured = captureStableFile(sourcePath, { includeContent: true });
    } catch {
      reject("migration-dist-import-source-unattested");
    }
    if (
      captured.sha256 !== entry.sha256
      || !sameIdentity(captured.identity, entry.identity)
    ) {
      reject("migration-dist-import-source-drift");
    }
    const sourceFile = typescriptApi.createSourceFile(
      entry.path,
      captured.content.toString("utf8"),
      typescriptApi.ScriptTarget.ES2020,
      true,
      typescriptApi.ScriptKind.JS,
    );
    if (sourceFile.parseDiagnostics.length !== 0) {
      reject("migration-dist-import-graph-parse-failed");
    }
    const sourceMatch = /^packages\/([^/]+)\/dist\//.exec(entry.path);
    if (!sourceMatch || !WORKSPACE_PACKAGES.includes(sourceMatch[1])) {
      reject("migration-dist-import-source-outside-package");
    }
    const sourcePackage = sourceMatch[1];
    const recordSpecifier = (specifierNode) => {
      if (!specifierNode || !typescriptApi.isStringLiteralLike(specifierNode)) {
        reject("migration-dist-dynamic-import-nonliteral-forbidden");
      }
      const specifier = specifierNode.text;
      let targetPath;
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        if (specifier.includes("?") || specifier.includes("#")) {
          reject("migration-dist-import-specifier-invalid");
        }
        const absoluteTarget = resolve(dirname(sourcePath), specifier);
        const packageDistRoot = resolve(root, "packages", sourcePackage, "dist");
        if (!pathInside(packageDistRoot, absoluteTarget)) {
          reject("migration-dist-relative-import-escaped-package");
        }
        targetPath = relative(root, absoluteTarget).split(sep).join("/");
      } else {
        const packageMatch = /^@infinite-flow\/([^/]+)(?:\/.*)?$/.exec(specifier);
        if (!packageMatch || !WORKSPACE_PACKAGES.includes(packageMatch[1])) {
          reject("migration-dist-external-import-forbidden");
        }
        let resolvedTarget;
        try {
          resolvedTarget = realpathSync.native(requireFromProject.resolve(specifier));
        } catch {
          reject("migration-dist-workspace-import-unresolvable");
        }
        const packageDistRoot = resolve(root, "packages", packageMatch[1], "dist");
        if (!pathInside(packageDistRoot, resolvedTarget)) {
          reject("migration-dist-workspace-import-resolution-drift");
        }
        targetPath = relative(root, resolvedTarget).split(sep).join("/");
      }
      if (!entryByPath.has(targetPath)) {
        reject("migration-dist-import-target-unattested");
      }
      edges.push({ source: entry.path, specifier, target: targetPath });
    };
    const visit = (node) => {
      if (
        (typescriptApi.isImportDeclaration(node)
          || typescriptApi.isExportDeclaration(node))
        && node.moduleSpecifier !== undefined
      ) {
        recordSpecifier(node.moduleSpecifier);
      } else if (
        typescriptApi.isImportEqualsDeclaration(node)
        && typescriptApi.isExternalModuleReference(node.moduleReference)
      ) {
        recordSpecifier(node.moduleReference.expression);
      } else if (
        typescriptApi.isCallExpression(node)
        && node.expression.kind === typescriptApi.SyntaxKind.ImportKeyword
      ) {
        if (node.arguments.length !== 1) {
          reject("migration-dist-dynamic-import-nonliteral-forbidden");
        }
        recordSpecifier(node.arguments[0]);
      } else if (
        typescriptApi.isCallExpression(node)
        && typescriptApi.isIdentifier(node.expression)
        && node.expression.text === "require"
      ) {
        if (node.arguments.length !== 1) {
          reject("migration-dist-dynamic-require-forbidden");
        }
        recordSpecifier(node.arguments[0]);
      }
      typescriptApi.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  edges.sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
  return {
    edgeCount: edges.length,
    sha256: sha256(Buffer.from(stableJson(edges), "utf8")),
  };
}

function scanWorkspaceDist(projectRoot, typescriptApi) {
  const root = canonicalDirectory(projectRoot, "migration-dist-project-root-invalid");
  const requireFromProject = createRequire(resolve(root, "package.json"));
  const entries = [];
  const entryPaths = {};
  const resolutionEntries = [];
  for (const name of WORKSPACE_PACKAGES) {
    const packageRoot = resolve(root, "packages", name);
    canonicalDirectory(packageRoot, "migration-dist-package-root-invalid");
    const packageJsonPath = resolve(packageRoot, "package.json");
    let packageJson;
    let packageJsonCapture;
    try {
      const stat = lstatSync(packageJsonPath, { bigint: true });
      if (stat.isSymbolicLink() || !stat.isFile()) reject("migration-dist-package-json-invalid");
      packageJsonCapture = captureStableFile(packageJsonPath, { includeContent: true });
      packageJson = JSON.parse(packageJsonCapture.content.toString("utf8"));
    } catch (error) {
      if (error instanceof MigrationBuildAttestationError) throw error;
      reject("migration-dist-package-json-invalid");
    }
    const packageName = `@infinite-flow/${name}`;
    if (packageJson.name !== packageName || !packageJson.exports) {
      reject("migration-dist-package-exports-invalid");
    }
    const targets = new Set();
    collectExportTargets(packageJson.exports, targets);
    for (const optional of [packageJson.main, packageJson.types]) {
      if (typeof optional === "string") targets.add(optional);
    }
    if (
      targets.size === 0
      || [...targets].some((target) => !target.startsWith("./dist/"))
    ) {
      reject("migration-dist-package-export-outside-dist");
    }
    const packageEntries = [];
    scanRegularTree(resolve(packageRoot, "dist"), root, packageEntries);
    const relativePackagePaths = new Set(packageEntries.map((entry) => (
      `./${relative(packageRoot, resolve(root, ...entry.path.split("/"))).split(sep).join("/")}`
    )));
    if ([...targets].some((target) => !relativePackagePaths.has(target))) {
      reject("migration-dist-package-export-missing");
    }
    entries.push(...packageEntries);

    const target = runtimeExport(packageJson);
    const expectedEntry = resolve(packageRoot, target);
    const workspaceResolutionPath = resolve(root, "node_modules/@infinite-flow", name);
    let resolvedEntry;
    let canonicalExpected;
    let resolutionIdentity;
    let resolutionTarget;
    try {
      resolutionIdentity = statIdentity(lstatSync(workspaceResolutionPath, { bigint: true }));
      resolutionTarget = realpathSync.native(workspaceResolutionPath);
      resolvedEntry = realpathSync.native(requireFromProject.resolve(packageName));
      canonicalExpected = realpathSync.native(expectedEntry);
    } catch {
      reject("migration-dist-bare-package-unresolvable");
    }
    if (resolvedEntry !== canonicalExpected || canonicalExpected !== expectedEntry) {
      reject("migration-dist-bare-package-resolution-drift");
    }
    if (resolutionTarget !== packageRoot) {
      reject("migration-dist-workspace-resolution-drift");
    }
    resolutionEntries.push(Object.freeze({
      packageName,
      workspacePath: `node_modules/@infinite-flow/${name}`,
      targetPath: `packages/${name}`,
      entryPath: relative(root, expectedEntry).split(sep).join("/"),
      packageJsonSha256: packageJsonCapture.sha256,
      identity: resolutionIdentity,
    }));
    entryPaths[name] = relative(root, expectedEntry).split(sep).join("/");
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  if (entries.length === 0) reject("migration-dist-regular-files-required");
  const importGraph = scanDistImportGraph(root, entries, typescriptApi);
  const contentPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
  ].join("\0")).join("\n");
  const identityPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
    ...fileIdentityFields(entry.identity),
  ].join("\0")).join("\n");
  const resolutionContentPayload = resolutionEntries.map((entry) => [
    entry.packageName,
    entry.workspacePath,
    entry.targetPath,
    entry.entryPath,
    entry.packageJsonSha256,
  ].join("\0")).join("\n");
  const resolutionIdentityPayload = resolutionEntries.map((entry) => [
    entry.packageName,
    entry.workspacePath,
    entry.targetPath,
    entry.entryPath,
    entry.packageJsonSha256,
    ...fileIdentityFields(entry.identity),
  ].join("\0")).join("\n");
  return Object.freeze({
    entries: Object.freeze(entries),
    entryPaths: Object.freeze(entryPaths),
    packageCount: WORKSPACE_PACKAGES.length,
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    contentTreeSha256: sha256(Buffer.from(contentPayload, "utf8")),
    identityTreeSha256: sha256(Buffer.from(identityPayload, "utf8")),
    resolutionContentSha256: sha256(Buffer.from(resolutionContentPayload, "utf8")),
    resolutionIdentitySha256: sha256(Buffer.from(resolutionIdentityPayload, "utf8")),
    importGraphEdgeCount: importGraph.edgeCount,
    importGraphSha256: importGraph.sha256,
  });
}

function sameDistContent(left, right) {
  return left.packageCount === right.packageCount
    && left.fileCount === right.fileCount
    && left.totalBytes === right.totalBytes
    && left.contentTreeSha256 === right.contentTreeSha256
    && left.resolutionContentSha256 === right.resolutionContentSha256
    && left.importGraphEdgeCount === right.importGraphEdgeCount
    && left.importGraphSha256 === right.importGraphSha256;
}

function sameDistIdentity(left, right) {
  return sameDistContent(left, right)
    && left.identityTreeSha256 === right.identityTreeSha256
    && left.resolutionIdentitySha256 === right.resolutionIdentitySha256;
}

function scanToolTree(root) {
  const entries = [];
  scanRegularTree(root, root, entries);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const contentPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
  ].join("\0")).join("\n");
  const identityPayload = entries.map((entry) => [
    entry.path,
    String(entry.bytes),
    entry.sha256,
    ...fileIdentityFields(entry.identity),
  ].join("\0")).join("\n");
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    contentTreeSha256: sha256(Buffer.from(contentPayload, "utf8")),
    identityTreeSha256: sha256(Buffer.from(identityPayload, "utf8")),
  };
}

function rejectEsbuildBinaryOverride() {
  if (Object.prototype.hasOwnProperty.call(process.env, ESBUILD_BINARY_OVERRIDE)) {
    reject("migration-build-esbuild-binary-override-forbidden");
  }
}

function publicFileIdentity(attestation) {
  return {
    configuredPath: attestation.configuredPath,
    canonicalPath: attestation.canonicalPath,
    identity: attestation.identity,
    sha256: attestation.sha256,
  };
}

function assertCapturedFileUnchanged(attestation, options, code) {
  try {
    assertStableFileUnchanged(attestation, options);
  } catch {
    reject(code);
  }
}

function assertToolFileUnchanged(attestation, options, codePrefix) {
  let current;
  try {
    current = captureStableFile(attestation.configuredPath, options);
  } catch {
    reject(`${codePrefix}-resolution-drift`);
  }
  if (current.canonicalPath !== attestation.canonicalPath) {
    reject(`${codePrefix}-resolution-drift`);
  }
  if (current.sha256 !== attestation.sha256) {
    reject(`${codePrefix}-content-drift`);
  }
  if (!sameIdentity(current.identity, attestation.identity)) {
    reject(`${codePrefix}-identity-drift`);
  }
}

function resolveEsbuildPlatformBinary(toolchainInstallationRoot) {
  const platformKey = `${process.platform}-${process.arch}-${endianness()}`;
  const specification = ESBUILD_PLATFORM_BINARIES[platformKey];
  if (specification === undefined) {
    reject("migration-build-esbuild-platform-unsupported");
  }
  const [packageName, binaryRelativePath] = specification;
  const requireFromToolchain = createRequire(
    resolve(toolchainInstallationRoot, "package.json"),
  );
  let configuredPath;
  try {
    configuredPath = requireFromToolchain.resolve(
      `${packageName}/${binaryRelativePath}`,
    );
  } catch {
    reject("migration-build-esbuild-binary-unresolvable");
  }
  const packageRoot = canonicalDirectory(
    resolve(toolchainInstallationRoot, "node_modules", ...packageName.split("/")),
    "migration-build-esbuild-platform-unavailable",
  );
  let lexicalStat;
  try {
    lexicalStat = lstatSync(configuredPath, { bigint: true });
  } catch {
    reject("migration-build-esbuild-binary-unresolvable");
  }
  if (lexicalStat.isSymbolicLink() || !lexicalStat.isFile()) {
    reject("migration-build-esbuild-binary-not-regular");
  }
  let binary;
  try {
    binary = captureStableFile(configuredPath, { requireExecutable: true });
  } catch {
    reject("migration-build-esbuild-binary-unattested");
  }
  if (
    binary.configuredPath !== configuredPath
    || binary.canonicalPath !== configuredPath
    || !pathInside(packageRoot, binary.canonicalPath)
  ) {
    reject("migration-build-esbuild-binary-resolution-drift");
  }
  return {
    binary,
    binaryRelativePath,
    packageName,
    packageRoot,
    platformKey,
  };
}

function probeEsbuildBinaryVersion(binaryPath, expectedVersion) {
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf8",
    env: {
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      TZ: "UTC",
    },
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
  if (
    result.error
    || result.signal
    || result.status !== 0
    || result.stdout.trim() !== expectedVersion
  ) {
    reject("migration-build-esbuild-binary-version-mismatch");
  }
  return result.stdout.trim();
}

function captureToolchain({
  buildRoot,
  toolchainInstallationRoot,
  requireEsbuild,
  formalBoundary,
}) {
  formalBoundary.assertUnchanged();
  const lockBytes = readFileSync(resolve(buildRoot, "toolchain/cocos-toolchain.lock.json"));
  const packageBytes = readFileSync(resolve(buildRoot, "package.json"));
  const packageLockBytes = readFileSync(resolve(buildRoot, "package-lock.json"));
  let lock;
  let packageJson;
  let packageLock;
  try {
    lock = JSON.parse(lockBytes.toString("utf8"));
    packageJson = JSON.parse(packageBytes.toString("utf8"));
    packageLock = JSON.parse(packageLockBytes.toString("utf8"));
  } catch {
    reject("migration-build-toolchain-metadata-invalid");
  }
  const expected = lock?.local;
  if (
    process.versions.node !== expected?.nodeVersion
    || packageJson?.engines?.node !== expected.nodeVersion
    || packageJson?.engines?.npm !== expected.npmVersion
    || packageJson?.packageManager !== `npm@${expected.npmVersion}`
    || packageJson?.devDependencies?.typescript !== expected.typescriptVersion
    || packageLock?.lockfileVersion !== 3
    || packageLock?.packages?.[""]?.engines?.node !== expected.nodeVersion
    || packageLock?.packages?.[""]?.engines?.npm !== expected.npmVersion
    || packageLock?.packages?.[""]?.devDependencies?.typescript !== expected.typescriptVersion
    || packageLock?.packages?.["node_modules/typescript"]?.version !== expected.typescriptVersion
  ) {
    reject("migration-build-toolchain-lock-mismatch");
  }
  const npm = inspectNpmToolchain();
  if (npm.error || npm.version !== expected.npmVersion || !npm.cliPath) {
    reject("migration-build-npm-runner-unattested");
  }
  const installationRoot = canonicalDirectory(
    toolchainInstallationRoot,
    "migration-build-toolchain-installation-root-invalid",
  );
  const typescriptConfiguredRoot = resolve(
    installationRoot,
    "node_modules/typescript",
  );
  const typescriptRoot = canonicalDirectory(
    typescriptConfiguredRoot,
    "migration-build-typescript-unavailable",
  );
  let installedTypescript;
  try {
    installedTypescript = JSON.parse(
      readFileSync(resolve(typescriptRoot, "package.json"), "utf8"),
    );
  } catch {
    reject("migration-build-typescript-metadata-invalid");
  }
  if (installedTypescript.version !== expected.typescriptVersion) {
    reject("migration-build-typescript-version-mismatch");
  }
  const node = captureStableFile(process.execPath, { requireExecutable: true });
  const npmCli = captureStableFile(npm.cliPath);
  const typescriptTree = scanToolTree(typescriptRoot);
  let typescriptApi;
  try {
    typescriptApi = createRequire(resolve(installationRoot, "package.json"))(
      resolve(typescriptRoot, "lib/typescript.js"),
    );
  } catch {
    reject("migration-build-typescript-api-unavailable");
  }
  if (
    typescriptApi?.version !== expected.typescriptVersion
    || typeof typescriptApi.createSourceFile !== "function"
  ) {
    reject("migration-build-typescript-api-invalid");
  }
  let esbuild;
  if (requireEsbuild) {
    const esbuildRoot = canonicalDirectory(
      resolve(installationRoot, "node_modules/esbuild"),
      "migration-build-esbuild-unavailable",
    );
    const esbuildPlatformRoot = canonicalDirectory(
      resolve(installationRoot, "node_modules/@esbuild"),
      "migration-build-esbuild-platform-unavailable",
    );
    let esbuildPackage;
    try {
      esbuildPackage = JSON.parse(readFileSync(resolve(esbuildRoot, "package.json"), "utf8"));
    } catch {
      reject("migration-build-esbuild-metadata-invalid");
    }
    const lockedEsbuild = packageLock?.packages?.["node_modules/esbuild"]?.version;
    if (
      typeof lockedEsbuild !== "string"
      || esbuildPackage.version !== lockedEsbuild
      || packageJson?.devDependencies?.esbuild === undefined
    ) {
      reject("migration-build-esbuild-version-mismatch");
    }
    const platform = resolveEsbuildPlatformBinary(installationRoot);
    const platformPackageVersion = packageLock?.packages?.[
      `node_modules/${platform.packageName}`
    ]?.version;
    let platformPackage;
    try {
      platformPackage = JSON.parse(
        readFileSync(resolve(platform.packageRoot, "package.json"), "utf8"),
      );
    } catch {
      reject("migration-build-esbuild-platform-metadata-invalid");
    }
    if (
      platformPackageVersion !== lockedEsbuild
      || platformPackage?.version !== lockedEsbuild
    ) {
      reject("migration-build-esbuild-platform-version-mismatch");
    }
    const binaryVersion = probeEsbuildBinaryVersion(
      platform.binary.canonicalPath,
      lockedEsbuild,
    );
    esbuild = {
      root: esbuildRoot,
      platformRoot: esbuildPlatformRoot,
      version: esbuildPackage.version,
      tree: scanToolTree(esbuildRoot),
      platformTree: scanToolTree(esbuildPlatformRoot),
      binary: platform.binary,
      binaryRelativePath: platform.binaryRelativePath,
      binaryVersion,
      packageName: platform.packageName,
      packageRoot: platform.packageRoot,
      platformKey: platform.platformKey,
      installationRoot,
    };
  }
  const publicAttestation = withCanonicalHash({
    schemaVersion: 1,
    lockSha256: sha256(lockBytes),
    packageJsonSha256: sha256(packageBytes),
    packageLockSha256: sha256(packageLockBytes),
    git: formalBoundary.publicAttestation,
    node: {
      version: process.versions.node,
      ...publicFileIdentity(node),
    },
    npm: {
      version: npm.version,
      ...publicFileIdentity(npmCli),
    },
    typescript: {
      version: installedTypescript.version,
      canonicalRoot: typescriptRoot,
      fileCount: typescriptTree.fileCount,
      totalBytes: typescriptTree.totalBytes,
      contentTreeSha256: typescriptTree.contentTreeSha256,
      identityTreeSha256: typescriptTree.identityTreeSha256,
    },
    ...(esbuild === undefined
      ? { esbuild: { required: false } }
      : {
          esbuild: {
            required: true,
            version: esbuild.version,
            fileCount: esbuild.tree.fileCount + esbuild.platformTree.fileCount,
            totalBytes: esbuild.tree.totalBytes + esbuild.platformTree.totalBytes,
            packageContentTreeSha256: esbuild.tree.contentTreeSha256,
            platformContentTreeSha256: esbuild.platformTree.contentTreeSha256,
            packageIdentityTreeSha256: esbuild.tree.identityTreeSha256,
            platformIdentityTreeSha256: esbuild.platformTree.identityTreeSha256,
            platformKey: esbuild.platformKey,
            platformPackage: esbuild.packageName,
            binaryRelativePath: esbuild.binaryRelativePath,
            binaryVersion: esbuild.binaryVersion,
            binary: publicFileIdentity(esbuild.binary),
          },
        }),
    buildPlanSha256: sha256(Buffer.from(stableJson(BUILD_PLAN), "utf8")),
  });
  return {
    node,
    npmCli,
    npmVersion: npm.version,
    installationRoot,
    typescriptConfiguredRoot,
    typescriptRoot,
    typescriptTree,
    typescriptApi,
    typescriptBin: resolve(typescriptRoot, "bin/tsc"),
    esbuild,
    formalBoundary,
    publicAttestation,
  };
}

function assertToolchainUnchanged(toolchain) {
  toolchain.formalBoundary.assertUnchanged();
  assertToolFileUnchanged(
    toolchain.node,
    { requireExecutable: true },
    "migration-build-node",
  );
  const currentNpm = inspectNpmToolchain();
  if (
    currentNpm.error
    || currentNpm.version !== toolchain.npmVersion
    || currentNpm.cliPath !== toolchain.npmCli.canonicalPath
  ) {
    reject("migration-build-npm-resolution-drift");
  }
  assertToolFileUnchanged(
    toolchain.npmCli,
    {},
    "migration-build-npm",
  );
  let currentTypescriptRoot;
  try {
    currentTypescriptRoot = canonicalDirectory(
      toolchain.typescriptConfiguredRoot,
      "migration-build-typescript-resolution-drift",
    );
  } catch {
    reject("migration-build-typescript-resolution-drift");
  }
  if (currentTypescriptRoot !== toolchain.typescriptRoot) {
    reject("migration-build-typescript-resolution-drift");
  }
  const typescriptTree = scanToolTree(toolchain.typescriptRoot);
  if (
    typescriptTree.contentTreeSha256 !== toolchain.typescriptTree.contentTreeSha256
  ) {
    reject("migration-build-typescript-content-drift");
  }
  if (typescriptTree.identityTreeSha256 !== toolchain.typescriptTree.identityTreeSha256) {
    reject("migration-build-typescript-identity-drift");
  }
  if (toolchain.esbuild !== undefined) {
    const resolved = resolveEsbuildPlatformBinary(toolchain.esbuild.installationRoot);
    if (
      resolved.packageName !== toolchain.esbuild.packageName
      || resolved.binaryRelativePath !== toolchain.esbuild.binaryRelativePath
      || resolved.platformKey !== toolchain.esbuild.platformKey
      || resolved.binary.configuredPath !== toolchain.esbuild.binary.configuredPath
      || resolved.binary.canonicalPath !== toolchain.esbuild.binary.canonicalPath
    ) {
      reject("migration-build-esbuild-binary-resolution-drift");
    }
    assertCapturedFileUnchanged(
      toolchain.esbuild.binary,
      { requireExecutable: true },
      "migration-build-esbuild-binary-drift",
    );
    const tree = scanToolTree(toolchain.esbuild.root);
    const platformTree = scanToolTree(toolchain.esbuild.platformRoot);
    if (
      tree.contentTreeSha256 !== toolchain.esbuild.tree.contentTreeSha256
      || tree.identityTreeSha256 !== toolchain.esbuild.tree.identityTreeSha256
      || platformTree.contentTreeSha256 !== toolchain.esbuild.platformTree.contentTreeSha256
      || platformTree.identityTreeSha256 !== toolchain.esbuild.platformTree.identityTreeSha256
    ) {
      reject("migration-build-esbuild-drift");
    }
  }
}

function createWorkspaceLinks(buildRoot) {
  const scope = resolve(buildRoot, "node_modules/@infinite-flow");
  mkdirSync(scope, { recursive: true, mode: 0o700 });
  for (const name of WORKSPACE_PACKAGES) {
    symlinkSync(resolve(buildRoot, "packages", name), resolve(scope, name), "dir");
  }
}

function runBuildStep(command, args, cwd, code) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
      SOURCE_DATE_EPOCH: "0",
      TZ: "UTC",
    },
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  if (result.error || result.signal || result.status !== 0) reject(code);
}

function executeBuild(buildRoot, toolchain) {
  for (const step of BUILD_PLAN) {
    const packageRoot = resolve(buildRoot, "packages", step.package);
    if (step.config) {
      runBuildStep(
        process.execPath,
        [toolchain.typescriptBin, "-p", resolve(packageRoot, step.config)],
        buildRoot,
        `migration-build-command-failed-${step.package}`,
      );
      continue;
    }
    runBuildStep(
      process.execPath,
      [resolve(packageRoot, step.postprocess)],
      buildRoot,
      `migration-build-postprocess-failed-${step.package}`,
    );
  }
}

function assertDistRootsAbsent(buildRoot) {
  for (const name of WORKSPACE_PACKAGES) {
    const path = resolve(buildRoot, "packages", name, "dist");
    try {
      lstatSync(path);
      reject("migration-build-dist-root-preexisting");
    } catch (error) {
      if (error instanceof MigrationBuildAttestationError) throw error;
      if (error?.code !== "ENOENT") reject("migration-build-dist-root-unreadable");
    }
  }
}

function removeTemporaryRoot(root) {
  if (
    typeof root !== "string"
    || !resolve(root).startsWith(resolve(tmpdir()) + sep)
    || !root.includes("infinite-flow-migration-build-")
  ) {
    reject("migration-build-cleanup-target-invalid");
  }
  rmSync(root, { recursive: true, force: true });
}

function normalizeCapabilities(capabilities) {
  if (
    !Array.isArray(capabilities)
    || capabilities.some(
      (capability, index) =>
        !SUPPORTED_CAPABILITIES.includes(capability)
        || capabilities.indexOf(capability) !== index,
    )
  ) {
    reject("migration-build-capabilities-invalid");
  }
  return Object.freeze([...capabilities].sort());
}

export function prepareMigrationBuildAttestation({
  repositoryRoot,
  projectRoot,
  toolchainInstallationRoot = projectRoot,
  gitHeadSha,
  gitHeadTreeSha,
  capabilities = [],
  allowSelfTestFaults = false,
  selfTestGitBlobFault,
  formalBoundary,
}) {
  rejectAmbientFormalEnvironment();
  const normalizedCapabilities = normalizeCapabilities(capabilities);
  const requireEsbuild = normalizedCapabilities.includes("esbuild");
  if (
    formalBoundary === undefined
    || typeof formalBoundary.runGit !== "function"
    || typeof formalBoundary.assertUnchanged !== "function"
  ) {
    reject("migration-formal-boundary-required");
  }
  formalBoundary.assertUnchanged();
  const canonicalRepository = canonicalDirectory(
    repositoryRoot,
    "migration-build-repository-root-invalid",
  );
  const canonicalProject = canonicalDirectory(
    projectRoot,
    "migration-build-project-root-invalid",
  );
  if (!pathInside(canonicalRepository, canonicalProject)) {
    reject("migration-build-project-outside-repository");
  }
  if (formalBoundary.repositoryRoot !== canonicalRepository) {
    reject("migration-formal-boundary-repository-mismatch");
  }
  if (!GIT_OBJECT_PATTERN.test(gitHeadTreeSha ?? "")) {
    reject("migration-build-tree-invalid");
  }
  const selfTestFaultsAllowed = allowSelfTestFaults === true
    && canonicalRepository === canonicalProject
    && pathInside(realpathSync.native(tmpdir()), canonicalRepository);
  if (allowSelfTestFaults && !selfTestFaultsAllowed) {
    reject("migration-build-self-test-fault-forbidden");
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), "infinite-flow-migration-build-"));
  chmodSync(temporaryRoot, 0o700);
  const canonicalTemporary = realpathSync.native(temporaryRoot);
  if (pathInside(canonicalRepository, canonicalTemporary)) {
    removeTemporaryRoot(temporaryRoot);
    reject("migration-build-temporary-root-inside-repository");
  }
  const buildRoot = resolve(canonicalTemporary, "subject");
  mkdirSync(buildRoot, { mode: 0o700 });
  let cleaned = false;
  let injectCleanupFailure = false;
  const selfTestRestorations = [];
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const restore of selfTestRestorations.reverse()) {
      try {
        restore();
      } catch {
        // Self-test mutations are limited to a temporary fixture; a failed
        // restoration cannot make an attestation valid and the fixture owner
        // removes the repository after the child exits.
      }
    }
    try {
      removeTemporaryRoot(temporaryRoot);
    } catch {
      reject("migration-build-cleanup-failed");
    }
    if (injectCleanupFailure) reject("migration-build-cleanup-failed");
  };
  try {
    if (selfTestGitBlobFault !== undefined) {
      if (!selfTestFaultsAllowed || selfTestGitBlobFault !== "replace-build-blob") {
        reject("migration-build-self-test-git-blob-fault-forbidden");
      }
      const projectPath = normalizedProjectPath(canonicalRepository, canonicalProject);
      const sourcePath = `${projectPath === "" ? "" : `${projectPath}/`}`
        + "packages/runtime/src/index.ts";
      const objectId = formalBoundary.runGit(
        ["rev-parse", `${gitHeadSha}:${sourcePath}`],
        { encoding: "utf8" },
      ).trim();
      if (!GIT_OBJECT_PATTERN.test(objectId)) {
        reject("migration-build-self-test-git-blob-object-invalid");
      }
      const objectPath = resolve(
        formalBoundary.gitDirectory,
        "objects",
        objectId.slice(0, 2),
        objectId.slice(2),
      );
      let originalObject;
      let originalMode;
      try {
        const objectStat = lstatSync(objectPath, { bigint: true });
        if (objectStat.isSymbolicLink() || !objectStat.isFile()) {
          reject("migration-build-self-test-git-blob-object-invalid");
        }
        originalObject = readFileSync(objectPath);
        originalMode = Number(objectStat.mode) & 0o777;
      } catch (error) {
        if (error instanceof MigrationBuildAttestationError) throw error;
        reject("migration-build-self-test-git-blob-object-invalid");
      }
      const replacement = Buffer.from(
        "export const MIGRATION_SELF_TEST_REPLACEMENT_BLOB = true;\n",
        "utf8",
      );
      const replacementObject = deflateSync(Buffer.concat([
        Buffer.from(`blob ${replacement.byteLength}\0`, "utf8"),
        replacement,
      ]));
      selfTestRestorations.push(() => {
        chmodSync(objectPath, 0o600);
        writeFileSync(objectPath, originalObject);
        chmodSync(objectPath, originalMode);
      });
      chmodSync(objectPath, 0o600);
      writeFileSync(objectPath, replacementObject);
      chmodSync(objectPath, originalMode);
    }
    const sourceCapture = materializeBuildInputs({
      formalBoundary,
      projectRoot: canonicalProject,
      headSha: gitHeadSha,
      headTreeSha: gitHeadTreeSha,
      outputRoot: buildRoot,
    });
    const materializedSource = scanMaterializedBuildInputs(
      buildRoot,
      sourceCapture.entries,
    );
    const source = withCanonicalHash({
      schemaVersion: 1,
      gitHeadSha,
      gitHeadTreeSha,
      projectPath: sourceCapture.projectPath,
      fileCount: sourceCapture.fileCount,
      totalBytes: sourceCapture.totalBytes,
      contentTreeSha256: sourceCapture.contentTreeSha256,
      materializedContentTreeSha256: materializedSource.contentTreeSha256,
      materializedIdentityTreeSha256: materializedSource.identityTreeSha256,
    });
    const toolchain = captureToolchain({
      buildRoot,
      toolchainInstallationRoot,
      requireEsbuild,
      formalBoundary,
    });
    createWorkspaceLinks(buildRoot);
    assertDistRootsAbsent(buildRoot);
    executeBuild(buildRoot, toolchain);
    const postBuildSource = scanMaterializedBuildInputs(
      buildRoot,
      sourceCapture.entries,
    );
    if (!sameMaterializedSourceIdentity(materializedSource, postBuildSource)) {
      reject("migration-build-source-tree-drift-during-run");
    }
    assertToolchainUnchanged(toolchain);
    const rebuiltDist = scanWorkspaceDist(buildRoot, toolchain.typescriptApi);
    const candidateDist = scanWorkspaceDist(canonicalProject, toolchain.typescriptApi);
    if (!sameDistContent(rebuiltDist, candidateDist)) {
      reject("migration-dist-does-not-match-clean-rebuild");
    }
    const entryPaths = Object.freeze(Object.fromEntries(
      WORKSPACE_PACKAGES.map((name) => [
        name,
        resolve(buildRoot, ...rebuiltDist.entryPaths[name].split("/")),
      ]),
    ));
    const importEntries = Object.freeze(Object.fromEntries(
      WORKSPACE_PACKAGES.map((name) => {
        const path = rebuiltDist.entryPaths[name];
        return [
          name,
          Object.freeze({
            path,
            sha256: rebuiltDist.entries.find((entry) => entry.path === path)?.sha256,
          }),
        ];
      }),
    ));
    if (
      Object.values(importEntries).some(
        (entry) => !SHA256_PATTERN.test(entry.sha256 ?? ""),
      )
    ) {
      reject("migration-dist-import-entry-unattested");
    }
    let attestation;
    const assertTreesAndToolsUnchanged = () => {
      const sourceCurrent = scanMaterializedBuildInputs(
        buildRoot,
        sourceCapture.entries,
      );
      if (!sameMaterializedSourceIdentity(materializedSource, sourceCurrent)) {
        reject("migration-build-source-tree-drift-during-run");
      }
      const rebuiltCurrent = scanWorkspaceDist(buildRoot, toolchain.typescriptApi);
      const candidateCurrent = scanWorkspaceDist(
        canonicalProject,
        toolchain.typescriptApi,
      );
      if (!sameDistIdentity(rebuiltDist, rebuiltCurrent)) {
        reject("migration-dist-execution-tree-drift-during-run");
      }
      if (!sameDistIdentity(candidateDist, candidateCurrent)) {
        reject("migration-dist-candidate-tree-drift-during-run");
      }
      assertToolchainUnchanged(toolchain);
    };
    const assertCandidateAndToolsUnchanged = () => {
      const candidateCurrent = scanWorkspaceDist(
        canonicalProject,
        toolchain.typescriptApi,
      );
      if (!sameDistIdentity(candidateDist, candidateCurrent)) {
        reject("migration-dist-candidate-tree-drift-during-run");
      }
      assertToolchainUnchanged(toolchain);
    };
    const requireSelfTestFaultAuthorization = () => {
      if (!selfTestFaultsAllowed) {
        reject("migration-build-self-test-fault-forbidden");
      }
    };
    const requireMutableSelfTestPath = (path) => {
      if (!pathInside(canonicalProject, path)) {
        reject("migration-build-self-test-toolchain-target-forbidden");
      }
    };
    const mutateToolFile = (attestation, fault, alternatePath) => {
      const path = attestation.configuredPath;
      requireMutableSelfTestPath(path);
      const original = readFileSync(path);
      const originalMode = Number.parseInt(attestation.identity.mode, 10) & 0o777;
      if (fault.endsWith("-content")) {
        selfTestRestorations.push(() => {
          writeFileSync(path, original);
          chmodSync(path, originalMode);
        });
        appendFileSync(path, "\n/* self-test-toolchain-content-drift */\n");
        return;
      }
      if (fault.endsWith("-identity")) {
        const replacement = `${path}.self-check-replacement`;
        writeFileSync(replacement, original, { flag: "wx", mode: originalMode });
        selfTestRestorations.push(() => {
          writeFileSync(path, original);
          chmodSync(path, originalMode);
        });
        renameSync(replacement, path);
        return;
      }
      if (fault.endsWith("-resolution")) {
        const originalPath = `${path}.self-check-original`;
        renameSync(path, originalPath);
        symlinkSync(alternatePath, path, "file");
        selfTestRestorations.push(() => {
          unlinkSync(path);
          renameSync(originalPath, path);
        });
        return;
      }
      reject("migration-build-self-test-toolchain-fault-invalid");
    };
    return {
      entryPaths,
      cleanup,
      attestImportWindow() {
        assertTreesAndToolsUnchanged();
        if (attestation === undefined) {
          const dist = withCanonicalHash({
            schemaVersion: 1,
            packageCount: rebuiltDist.packageCount,
            fileCount: rebuiltDist.fileCount,
            totalBytes: rebuiltDist.totalBytes,
            contentTreeSha256: rebuiltDist.contentTreeSha256,
            resolutionContentSha256: rebuiltDist.resolutionContentSha256,
            importGraphEdgeCount: rebuiltDist.importGraphEdgeCount,
            importGraphSha256: rebuiltDist.importGraphSha256,
            cleanRebuildMatchesCandidate: true,
            executionImportWindowStable: true,
            candidateImportWindowStable: true,
            executionIdentityTreeSha256: rebuiltDist.identityTreeSha256,
            candidateIdentityTreeSha256: candidateDist.identityTreeSha256,
            executionResolutionIdentitySha256: rebuiltDist.resolutionIdentitySha256,
            candidateResolutionIdentitySha256: candidateDist.resolutionIdentitySha256,
            importEntries,
          });
          const payload = {
            schemaVersion: 1,
            status: "ATTESTED",
            capabilities: normalizedCapabilities,
            source,
            toolchain: toolchain.publicAttestation,
            dist,
            hashes: {
              sourceAttestationSha256: source.canonicalSha256,
              toolchainAttestationSha256: toolchain.publicAttestation.canonicalSha256,
              distAttestationSha256: dist.canonicalSha256,
            },
          };
          attestation = withCanonicalHash(payload);
        }
        return attestation;
      },
      assertUnchangedAfterCase() {
        if (attestation === undefined) reject("migration-build-import-window-unattested");
        assertTreesAndToolsUnchanged();
        return attestation;
      },
      assertUnchangedAfterEvidence() {
        if (attestation === undefined) reject("migration-build-import-window-unattested");
        assertTreesAndToolsUnchanged();
        return attestation;
      },
      assertExternalUnchangedAfterCleanup() {
        assertCandidateAndToolsUnchanged();
        return attestation;
      },
      injectSelfTestExecutionDistDrift(fault) {
        requireSelfTestFaultAuthorization();
        const runtimeIndex = resolve(buildRoot, "packages/runtime/dist/index.js");
        if (fault === "runtime-index") {
          appendFileSync(runtimeIndex, "\n// self-test execution dist content drift\n");
          return;
        }
        if (fault === "runtime-index-replace") {
          const replacement = `${runtimeIndex}.self-check-replacement`;
          writeFileSync(replacement, readFileSync(runtimeIndex), {
            flag: "wx",
            mode: 0o600,
          });
          renameSync(replacement, runtimeIndex);
          return;
        }
        if (fault === "runtime-resolution") {
          const resolution = resolve(
            buildRoot,
            "node_modules/@infinite-flow/runtime",
          );
          unlinkSync(resolution);
          symlinkSync(resolve(buildRoot, "packages/client"), resolution, "dir");
          return;
        }
        reject("migration-build-self-test-dist-fault-invalid");
      },
      injectSelfTestToolchainDrift(fault) {
        requireSelfTestFaultAuthorization();
        if (["node-content", "node-identity", "node-resolution"].includes(fault)) {
          mutateToolFile(toolchain.node, fault, "/bin/sh");
          return;
        }
        if (["npm-content", "npm-identity", "npm-resolution"].includes(fault)) {
          mutateToolFile(toolchain.npmCli, fault, toolchain.typescriptBin);
          return;
        }
        if (
          [
            "typescript-content",
            "typescript-identity",
            "typescript-resolution",
          ].includes(fault)
        ) {
          if (fault === "typescript-resolution") {
            requireMutableSelfTestPath(toolchain.typescriptConfiguredRoot);
            const originalRoot = `${toolchain.typescriptConfiguredRoot}.self-check-original`;
            renameSync(toolchain.typescriptConfiguredRoot, originalRoot);
            symlinkSync(
              toolchain.esbuild?.root ?? resolve(canonicalProject, "node_modules/esbuild"),
              toolchain.typescriptConfiguredRoot,
              "dir",
            );
            selfTestRestorations.push(() => {
              unlinkSync(toolchain.typescriptConfiguredRoot);
              renameSync(originalRoot, toolchain.typescriptConfiguredRoot);
            });
            return;
          }
          const typescriptLibrary = captureStableFile(
            resolve(toolchain.typescriptRoot, "lib/typescript.js"),
          );
          mutateToolFile(typescriptLibrary, fault, toolchain.npmCli.canonicalPath);
          return;
        }
        if (fault === "esbuild-binary-content" && toolchain.esbuild !== undefined) {
          mutateToolFile(toolchain.esbuild.binary, fault, toolchain.typescriptBin);
          return;
        }
        reject("migration-build-self-test-toolchain-fault-invalid");
      },
      injectSelfTestBuildSourceDrift(fault) {
        requireSelfTestFaultAuthorization();
        const runtimeSource = resolve(buildRoot, "packages/runtime/src/index.ts");
        if (fault === "runtime-source") {
          appendFileSync(runtimeSource, "\n// self-test source content drift\n");
          return;
        }
        if (fault === "runtime-source-replace") {
          const replacement = `${runtimeSource}.self-check-replacement`;
          writeFileSync(replacement, readFileSync(runtimeSource), {
            flag: "wx",
            mode: 0o600,
          });
          renameSync(replacement, runtimeSource);
          return;
        }
        if (fault === "runtime-source-addition") {
          writeFileSync(
            resolve(buildRoot, "packages/runtime/src/self-check-addition.ts"),
            "export const SELF_CHECK_ADDITION = true;\n",
            { flag: "wx", mode: 0o600 },
          );
          return;
        }
        reject("migration-build-self-test-source-fault-invalid");
      },
      injectSelfTestCleanupFailure() {
        requireSelfTestFaultAuthorization();
        injectCleanupFailure = true;
      },
    };
  } catch (error) {
    cleanup();
    if (error instanceof MigrationBuildAttestationError) throw error;
    reject("migration-build-attestation-failed");
  }
}
