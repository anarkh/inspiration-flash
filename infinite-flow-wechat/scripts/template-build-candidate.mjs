import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  ToolchainBoundaryError,
  captureStableFile,
} from "./file-attestation.mjs";

const TRUSTED_GIT = "/usr/bin/git";
const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const TRUSTED_GIT_ENV = Object.freeze({
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  HOME: "/var/empty",
  LANG: "C",
  LC_ALL: "C",
  PATH: "/usr/bin:/bin",
});

function reject(code) {
  throw new ToolchainBoundaryError(code);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function identityFields(identity) {
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

function sameIdentity(left, right) {
  return identityFields(left).every(
    (value, index) => value === identityFields(right)[index],
  );
}

function runTrustedGit(repositoryRoot, args, run = spawnSync) {
  const result = run(
    TRUSTED_GIT,
    ["--no-optional-locks", "-C", repositoryRoot, ...args],
    {
      encoding: null,
      env: TRUSTED_GIT_ENV,
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  if (result.error || result.signal || result.status !== 0) {
    reject("template-candidate-git-probe-failed");
  }
  return Buffer.from(result.stdout);
}

function exactHash(bytes, label) {
  const value = bytes.toString("utf8").trim();
  if (!SHA_PATTERN.test(value)) reject(`template-candidate-${label}-invalid`);
  return value;
}

function parseNulPaths(bytes) {
  const paths = [];
  let start = 0;
  for (let index = 0; index <= bytes.length; index += 1) {
    if (index !== bytes.length && bytes[index] !== 0) continue;
    if (index === start) {
      if (index !== bytes.length) reject("template-candidate-path-empty");
      start = index + 1;
      continue;
    }
    const encoded = bytes.subarray(start, index);
    const decoded = encoded.toString("utf8");
    if (decoded.includes("\uFFFD") || !Buffer.from(decoded, "utf8").equals(encoded)) {
      reject("template-candidate-path-encoding-invalid");
    }
    paths.push(decoded);
    start = index + 1;
  }
  return paths;
}

function normalizeScope(repositoryRoot, projectRoot) {
  const scope = relative(repositoryRoot, projectRoot).split(sep).join("/");
  if (
    scope.length === 0
    || scope === "."
    || scope === ".."
    || scope.startsWith("../")
    || isAbsolute(scope)
    || scope.includes("\\")
  ) {
    reject("template-candidate-project-scope-invalid");
  }
  return scope;
}

function probe(repositoryRoot, scope, run) {
  const head = runTrustedGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD"],
    run,
  );
  const tree = runTrustedGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD^{tree}"],
    run,
  );
  const status = runTrustedGit(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
    "--",
    scope,
  ], run);
  const inventory = runTrustedGit(repositoryRoot, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--full-name",
    "-z",
    "--",
    scope,
  ], run);
  return Object.freeze({
    head: exactHash(head, "head"),
    tree: exactHash(tree, "tree"),
    status,
    inventory,
  });
}

function sameProbe(left, right) {
  return left.head === right.head
    && left.tree === right.tree
    && left.status.equals(right.status)
    && left.inventory.equals(right.inventory);
}

function assertContainedInventoryPath(path, scope) {
  if (
    path !== scope
    && !path.startsWith(`${scope}/`)
  ) {
    reject("template-candidate-path-outside-project");
  }
  const segments = path.split("/");
  if (
    path.includes("\\")
    || isAbsolute(path)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    reject("template-candidate-path-invalid");
  }
  return path;
}

function captureEntry(repositoryRoot, path, captureFile) {
  const absolutePath = resolve(repositoryRoot, path);
  let pathStat;
  try {
    pathStat = lstatSync(absolutePath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return Object.freeze({ path, kind: "absent", bytes: 0, sha256: null });
    }
    reject("template-candidate-path-unreadable");
  }
  if (pathStat.isSymbolicLink()) reject("template-candidate-symlink-forbidden");
  if (!pathStat.isFile()) reject("template-candidate-special-object-forbidden");
  const capture = captureFile(absolutePath);
  if (
    capture.canonicalPath !== absolutePath
    || !sameIdentity(capture.identity, statIdentity(pathStat))
  ) {
    reject("template-candidate-path-identity-drift");
  }
  return Object.freeze({
    path,
    kind: "file",
    bytes: Number(capture.identity.size),
    sha256: capture.sha256,
    identity: capture.identity,
  });
}

export function createTemplateCandidateFromEntries({
  head,
  tree,
  status,
  inventory,
  entries,
}) {
  if (!SHA_PATTERN.test(head ?? "") || !SHA_PATTERN.test(tree ?? "")) {
    reject("template-candidate-git-identity-invalid");
  }
  if (!Buffer.isBuffer(status) || !Buffer.isBuffer(inventory)) {
    reject("template-candidate-probe-bytes-invalid");
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    reject("template-candidate-entries-required");
  }
  const sorted = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    if (
      typeof entry?.path !== "string"
      || entry.path.length === 0
      || (index > 0 && sorted[index - 1].path === entry.path)
      || !["file", "absent"].includes(entry.kind)
    ) {
      reject("template-candidate-entry-invalid");
    }
    if (entry.kind === "file" && (
      !Number.isSafeInteger(entry.bytes)
      || entry.bytes < 0
      || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? "")
      || !entry.identity
      || identityFields(entry.identity).some((value) => typeof value !== "string")
    )) {
      reject("template-candidate-file-entry-invalid");
    }
  }
  const pathPayload = sorted.map((entry) => `${entry.kind}\0${entry.path}`).join("\n");
  const contentPayload = sorted.map((entry) => entry.kind === "file"
    ? `${entry.path}\0${entry.bytes}\0${entry.sha256}`
    : `${entry.path}\0absent`).join("\n");
  const identityPayload = sorted.map((entry) => entry.kind === "file"
    ? `${entry.path}\0${entry.bytes}\0${entry.sha256}\0${identityFields(entry.identity).join("\0")}`
    : `${entry.path}\0absent`).join("\n");
  return Object.freeze({
    schemaVersion: 1,
    head,
    tree,
    statusBytes: status.length,
    statusSha256: sha256(status),
    inventoryBytes: inventory.length,
    inventorySha256: sha256(inventory),
    entryCount: sorted.length,
    fileCount: sorted.filter((entry) => entry.kind === "file").length,
    absentCount: sorted.filter((entry) => entry.kind === "absent").length,
    totalBytes: sorted.reduce(
      (total, entry) => total + (entry.kind === "file" ? entry.bytes : 0),
      0,
    ),
    pathSetSha256: sha256(Buffer.from(pathPayload, "utf8")),
    contentTreeSha256: sha256(Buffer.from(contentPayload, "utf8")),
    identityTreeSha256: sha256(Buffer.from(identityPayload, "utf8")),
  });
}

export function captureTemplateBuildCandidate({
  repositoryRoot,
  projectRoot,
  run = spawnSync,
  captureFile = captureStableFile,
}) {
  captureStableFile(TRUSTED_GIT, { requireExecutable: true });
  let canonicalRepository;
  let canonicalProject;
  try {
    canonicalRepository = realpathSync.native(resolve(repositoryRoot));
    canonicalProject = realpathSync.native(resolve(projectRoot));
  } catch {
    reject("template-candidate-root-unreadable");
  }
  const discovered = runTrustedGit(
    canonicalRepository,
    ["rev-parse", "--show-toplevel"],
    run,
  ).toString("utf8").trim();
  if (realpathSync.native(discovered) !== canonicalRepository) {
    reject("template-candidate-repository-root-mismatch");
  }
  const scope = normalizeScope(canonicalRepository, canonicalProject);
  const before = probe(canonicalRepository, scope, run);
  const paths = parseNulPaths(before.inventory)
    .map((path) => assertContainedInventoryPath(path, scope));
  if (new Set(paths).size !== paths.length) {
    reject("template-candidate-path-duplicate");
  }
  paths.sort((left, right) => left.localeCompare(right));
  const entries = paths.map((path) => (
    captureEntry(canonicalRepository, path, captureFile)
  ));
  const after = probe(canonicalRepository, scope, run);
  if (!sameProbe(before, after)) reject("template-candidate-probe-drift");
  return createTemplateCandidateFromEntries({
    ...before,
    entries,
  });
}

export function assertTemplateBuildCandidateUnchanged(expected, current) {
  for (const field of [
    "head",
    "tree",
    "statusBytes",
    "statusSha256",
    "inventoryBytes",
    "inventorySha256",
    "entryCount",
    "fileCount",
    "absentCount",
    "totalBytes",
    "pathSetSha256",
    "contentTreeSha256",
    "identityTreeSha256",
  ]) {
    if (expected?.[field] !== current?.[field]) {
      reject(`template-candidate-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-drift`);
    }
  }
  return current;
}

/**
 * Creator may rewrite an Editor-owned settings file with byte-identical
 * content while building. The strict identity comparison remains mandatory
 * immediately before spawn. Across the Creator execution window, this
 * content comparison still binds the full dirty candidate path set and bytes
 * without treating a byte-identical Editor rewrite as a release claim.
 */
export function assertTemplateBuildCandidateContentUnchanged(expected, current) {
  for (const field of [
    "head",
    "tree",
    "statusBytes",
    "statusSha256",
    "inventoryBytes",
    "inventorySha256",
    "entryCount",
    "fileCount",
    "absentCount",
    "totalBytes",
    "pathSetSha256",
    "contentTreeSha256",
  ]) {
    if (expected?.[field] !== current?.[field]) {
      reject(`template-candidate-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-drift`);
    }
  }
  return current;
}
