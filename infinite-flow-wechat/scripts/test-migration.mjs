import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import {
  caseRunners,
  implementedFixtureScenarioIds,
  validateCaseRunnerRegistry,
} from "../acceptance/cases/case-runners.mjs";
import {
  AcceptanceAssertionError,
  AcceptanceBlockedError,
  implementedCaseFunctions,
} from "../acceptance/cases/implemented-cases.mjs";
import {
  MigrationBuildAttestationError,
  prepareMigrationFormalBoundary,
  prepareMigrationBuildAttestation,
} from "./migration-build-attestation.mjs";

const RUNNER_SCHEMA_VERSION = 1;
const RUNNER_ID = "infinite-flow-migration-acceptance";
const FROZEN_ACCEPTANCE_MANIFEST_SHA256 =
  "9c9da7e7f83c05422b3b1ac2ad77cc0260fd8dcd1b0df2d62f3b5556af4867c7";
const scriptDirectory = dirname(resolve(process.argv[1]));
const scriptProjectRoot = resolve(scriptDirectory, "..");
const defaultRepositoryRoot = resolve(scriptProjectRoot, "..");
const selfTestEnabled = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST === "1";
const selfTestRepositoryOverride =
  process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT;
const selfTestProjectOverride = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT;
const repositoryRoot =
  selfTestEnabled &&
  typeof process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT === "string"
    ? resolve(process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT)
    : defaultRepositoryRoot;
const projectRoot =
  selfTestEnabled &&
  typeof process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT === "string"
    ? resolve(process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT)
    : scriptProjectRoot;
const selfTestSandbox = resolveCanonicalSelfTestSandbox();
const selfTestSandboxEnabled = selfTestSandbox !== undefined;
const acceptanceManifestPath = resolve(
  projectRoot,
  "acceptance/migration-acceptance-manifest.json",
);
const fixtureManifestPath = resolve(projectRoot, "acceptance/fixtures/manifest.json");
const assetManifestPath = resolve(
  projectRoot,
  "cocos/assets/config/asset-manifest.json",
);
const packagePath = resolve(projectRoot, "package.json");
const WORKSPACE_PACKAGES = Object.freeze([
  "core",
  "runtime",
  "application",
  "save-codec",
  "client",
  "presentation",
]);
const workspaceEntryPaths = Object.freeze(Object.fromEntries(
  WORKSPACE_PACKAGES.map((name) => [
    name,
    resolve(projectRoot, `packages/${name}/dist/index.js`),
  ]),
));

class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function parseCli(argv) {
  const options = {
    acId: undefined,
    candidateId: undefined,
    evidencePath: undefined,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--ac", "--candidate-id", "--evidence"].includes(argument)) {
      throw new CliError("invalid-arguments", "unsupported or incomplete command line");
    }
    if (seen.has(argument)) {
      throw new CliError("invalid-arguments", `${argument} may be supplied only once`);
    }
    seen.add(argument);
    const value = argv[index + 1];
    if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
      throw new CliError("invalid-arguments", `${argument} requires a value`);
    }
    index += 1;
    if (argument === "--ac") options.acId = value;
    if (argument === "--candidate-id") options.candidateId = value;
    if (argument === "--evidence") options.evidencePath = resolve(process.cwd(), value);
  }

  if (options.acId === undefined) {
    throw new CliError("zero-selection", "exactly one --ac <AC-ID> selection is required");
  }
  if (!/^AC-(?:[A-Z]+-)+(?:\d{2}|\d{3})$/.test(options.acId)) {
    throw new CliError("unknown-ac", "the selected AC ID is not in the frozen registry");
  }
  if (
    options.candidateId !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(options.candidateId)
  ) {
    throw new CliError(
      "invalid-candidate-id",
      "candidate ID must be 1-80 safe identifier characters",
    );
  }
  const fault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_FAULT;
  const selfTestOnlyEnvironment = [
    fault,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIRTY,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_BUILD_DIRTY,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_IMPORT_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_ATTESTATION_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_FINAL_SEAL_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EXECUTION_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_BUILD_SOURCE_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_GIT_BLOB_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_CLEANUP_FAILURE,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD,
  ];
  if (selfTestOnlyEnvironment.some((value) => value !== undefined) && !selfTestEnabled) {
    throw new CliError(
      "self-test-only-option",
      "migration self-test environment overrides are unavailable in production runs",
    );
  }
  const postWriteDirty = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIRTY;
  const postBuildDirty = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_BUILD_DIRTY;
  for (const [label, value] of [
    ["post-write", postWriteDirty],
    ["post-build", postBuildDirty],
  ]) {
    if (value === undefined) continue;
    if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value)) continue;
    throw new CliError(
      "invalid-self-test-drift-path",
      `self-test ${label} drift path must be a single safe filename`,
    );
  }
  for (const value of [
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_IMPORT_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_ATTESTATION_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_FINAL_SEAL_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EXECUTION_DIST_DRIFT,
  ]) {
    if (
      value !== undefined
      && !["runtime-index", "runtime-index-replace", "runtime-resolution"].includes(value)
    ) {
      throw new CliError(
        "invalid-self-test-dist-drift",
        "self-test dist drift must select a fixed runtime index or resolution target",
      );
    }
  }
  const sandboxOnlyEnvironment = [
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_FINAL_SEAL_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EXECUTION_DIST_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_BUILD_SOURCE_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_GIT_BLOB_DRIFT,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_CLEANUP_FAILURE,
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT,
  ];
  if (sandboxOnlyEnvironment.some((value) => value !== undefined) && !selfTestSandboxEnabled) {
    throw new CliError(
      "self-test-sandbox-required",
      "build/evidence fault hooks require an external temporary self-test repository",
    );
  }
  const buildSourceFault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_BUILD_SOURCE_DRIFT;
  if (
    buildSourceFault !== undefined
    && !["runtime-source", "runtime-source-replace", "runtime-source-addition"].includes(
      buildSourceFault,
    )
  ) {
    throw new CliError("invalid-self-test-source-drift", "invalid build-source fault");
  }
  const toolchainFault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT;
  if (
    toolchainFault !== undefined
    && ![
      "node-content",
      "node-identity",
      "node-resolution",
      "npm-content",
      "npm-identity",
      "npm-resolution",
      "typescript-content",
      "typescript-identity",
      "typescript-resolution",
      "esbuild-binary-content",
    ].includes(toolchainFault)
  ) {
    throw new CliError("invalid-self-test-toolchain-drift", "invalid toolchain fault");
  }
  const cleanupFailure = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_CLEANUP_FAILURE;
  if (cleanupFailure !== undefined && cleanupFailure !== "1") {
    throw new CliError("invalid-self-test-cleanup-failure", "invalid cleanup fault");
  }
  const gitBlobFault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_GIT_BLOB_DRIFT;
  if (gitBlobFault !== undefined && gitBlobFault !== "replace-build-blob") {
    throw new CliError("invalid-self-test-git-blob-drift", "invalid Git blob fault");
  }
  const evidenceBoundaryFault =
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT;
  if (
    evidenceBoundaryFault !== undefined
    && !["parent-rename", "parent-symlink-to-repository"].includes(evidenceBoundaryFault)
  ) {
    throw new CliError("invalid-self-test-evidence-boundary", "invalid evidence fault");
  }
  const passMethod = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD;
  if (passMethod !== undefined && passMethod !== "AC-STATE-006:A-AC") {
    throw new CliError(
      "invalid-self-test-pass-method",
      "self-test synthetic method PASS is fixed to AC-STATE-006:A-AC",
    );
  }
  return options;
}

function captureGitIdentity(formalBoundary) {
  const status = git(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    formalBoundary,
  );
  return {
    gitHeadSha: git(["rev-parse", "HEAD"], formalBoundary),
    gitHeadTreeSha: git(["rev-parse", "HEAD^{tree}"], formalBoundary),
    status,
    statusSha256: sha256(status),
    worktreeClean: status === "",
  };
}

function publicGitIdentity(identity) {
  return {
    gitHeadSha: identity.gitHeadSha,
    gitHeadTreeSha: identity.gitHeadTreeSha,
    statusSha256: identity.statusSha256,
    worktreeClean: identity.worktreeClean,
  };
}

function sameGitIdentity(left, right) {
  return (
    left.gitHeadSha === right.gitHeadSha &&
    left.gitHeadTreeSha === right.gitHeadTreeSha &&
    left.status === right.status
  );
}

function pathIsInside(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`));
}

function pathIsStrictlyInside(root, candidate) {
  return root !== candidate && pathIsInside(root, candidate);
}

function resolveCanonicalSelfTestSandbox() {
  if (
    !selfTestEnabled
    || typeof selfTestRepositoryOverride !== "string"
    || typeof selfTestProjectOverride !== "string"
  ) {
    return undefined;
  }
  try {
    const canonicalTemporaryRoot = realpathSync.native(tmpdir());
    const canonicalRepository = realpathSync.native(repositoryRoot);
    const canonicalProject = realpathSync.native(projectRoot);
    const canonicalSandboxRoot = dirname(canonicalRepository);
    const configuredSandboxRoot = dirname(repositoryRoot);
    const sandboxRootStat = lstatSync(canonicalSandboxRoot, { bigint: true });
    const repositoryStat = lstatSync(canonicalRepository, { bigint: true });
    if (
      canonicalRepository !== canonicalProject
      || realpathSync.native(configuredSandboxRoot) !== canonicalSandboxRoot
      || !pathIsStrictlyInside(canonicalTemporaryRoot, canonicalSandboxRoot)
      || dirname(canonicalRepository) !== canonicalSandboxRoot
      || sandboxRootStat.isSymbolicLink()
      || !sandboxRootStat.isDirectory()
      || (Number(sandboxRootStat.mode) & 0o777) !== 0o700
      || repositoryStat.isSymbolicLink()
      || !repositoryStat.isDirectory()
      || realpathSync.native(canonicalSandboxRoot) !== canonicalSandboxRoot
    ) {
      return undefined;
    }
    return {
      configuredRootPath: configuredSandboxRoot,
      repositoryPath: canonicalRepository,
      rootIdentity: directoryBoundaryIdentity(sandboxRootStat),
      rootPath: canonicalSandboxRoot,
    };
  } catch {
    return undefined;
  }
}

function assertSelfTestSandboxBoundary() {
  if (selfTestSandbox === undefined) {
    throw new CliError(
      "self-test-sandbox-required",
      "build/evidence fault hooks require a canonical temporary self-test sandbox",
    );
  }
  let rootStat;
  let repositoryStat;
  try {
    rootStat = lstatSync(selfTestSandbox.rootPath, { bigint: true });
    repositoryStat = lstatSync(selfTestSandbox.repositoryPath, { bigint: true });
  } catch {
    throw new CliError(
      "self-test-sandbox-drift",
      "the canonical temporary self-test sandbox disappeared",
    );
  }
  if (
    rootStat.isSymbolicLink()
    || !rootStat.isDirectory()
    || repositoryStat.isSymbolicLink()
    || !repositoryStat.isDirectory()
    || realpathSync.native(selfTestSandbox.rootPath) !== selfTestSandbox.rootPath
    || realpathSync.native(selfTestSandbox.repositoryPath)
      !== selfTestSandbox.repositoryPath
    || !sameDirectoryBoundaryIdentity(
      selfTestSandbox.rootIdentity,
      directoryBoundaryIdentity(rootStat),
    )
  ) {
    throw new CliError(
      "self-test-sandbox-drift",
      "the canonical temporary self-test sandbox identity drifted",
    );
  }
}

function assertPathDoesNotExist(path, code, message) {
  try {
    lstatSync(path);
  } catch (error) {
    if (error !== null && typeof error === "object" && error.code === "ENOENT") return;
    throw new CliError(code, message);
  }
  throw new CliError(code, message);
}

function prepareSelfTestEvidenceFaultParent(evidencePath) {
  const fault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT;
  if (fault === undefined) return undefined;
  assertSelfTestSandboxBoundary();

  const configuredTargetPath = resolve(evidencePath);
  const targetPath = pathIsInside(
    selfTestSandbox.configuredRootPath,
    configuredTargetPath,
  )
    ? resolve(
      selfTestSandbox.rootPath,
      relative(selfTestSandbox.configuredRootPath, configuredTargetPath),
    )
    : configuredTargetPath;
  const parentPath = dirname(targetPath);
  const movedParentPath = `${parentPath}.self-test-moved`;
  const rootPath = selfTestSandbox.rootPath;
  if (
    dirname(parentPath) !== rootPath
    || !pathIsStrictlyInside(rootPath, parentPath)
    || !pathIsStrictlyInside(parentPath, targetPath)
    || dirname(targetPath) !== parentPath
    || !pathIsStrictlyInside(rootPath, movedParentPath)
    || dirname(movedParentPath) !== rootPath
    || pathIsInside(selfTestSandbox.repositoryPath, parentPath)
    || pathIsInside(parentPath, selfTestSandbox.repositoryPath)
  ) {
    throw new CliError(
      "self-test-evidence-sandbox-escape",
      "evidence boundary faults require a runner-owned sacrifice directory inside the canonical self-test sandbox",
    );
  }

  assertPathDoesNotExist(
    parentPath,
    "self-test-evidence-sacrifice-exists",
    "the evidence boundary fault sacrifice directory must not already exist",
  );
  assertPathDoesNotExist(
    movedParentPath,
    "self-test-evidence-moved-target-exists",
    "the evidence boundary fault moved target must not already exist",
  );
  assertSelfTestSandboxBoundary();
  try {
    mkdirSync(parentPath, { mode: 0o700, recursive: false });
  } catch {
    throw new CliError(
      "self-test-evidence-sacrifice-create-failed",
      "the evidence boundary fault sacrifice directory could not be created exclusively",
    );
  }
  let parentStat;
  try {
    parentStat = lstatSync(parentPath, { bigint: true });
  } catch {
    throw new CliError(
      "self-test-evidence-sacrifice-create-failed",
      "the evidence boundary fault sacrifice directory disappeared",
    );
  }
  if (
    parentStat.isSymbolicLink()
    || !parentStat.isDirectory()
    || realpathSync.native(parentPath) !== parentPath
    || (Number(parentStat.mode) & 0o777) !== 0o700
  ) {
    throw new CliError(
      "self-test-evidence-sacrifice-create-failed",
      "the evidence boundary fault sacrifice directory is unsafe",
    );
  }
  assertSelfTestSandboxBoundary();
  return {
    movedParentPath,
    parentIdentity: directoryBoundaryIdentity(parentStat),
    parentPath,
    rootIdentity: selfTestSandbox.rootIdentity,
    rootPath,
  };
}

function validateEvidenceLocation(evidencePath) {
  const selfTestFaultBoundary = prepareSelfTestEvidenceFaultParent(evidencePath);
  let canonicalRepository;
  let canonicalParent;
  try {
    canonicalRepository = realpathSync.native(repositoryRoot);
    canonicalParent = realpathSync.native(dirname(evidencePath));
  } catch {
    throw new CliError(
      "evidence-parent-unavailable",
      "evidence parent and repository root must already exist",
    );
  }
  const canonicalTarget = resolve(canonicalParent, basename(evidencePath));
  if (pathIsInside(canonicalRepository, canonicalTarget)) {
    throw new CliError(
      "evidence-inside-repository",
      "formal evidence directories must be outside the git repository",
    );
  }
  let parentStat;
  try {
    parentStat = lstatSync(canonicalParent, { bigint: true });
  } catch {
    throw new CliError("evidence-parent-unavailable", "evidence parent is unavailable");
  }
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new CliError("evidence-parent-invalid", "evidence parent must be a real directory");
  }
  return {
    parentPath: canonicalParent,
    parentIdentity: directoryBoundaryIdentity(parentStat),
    selfTestFaultBoundary,
    targetPath: canonicalTarget,
  };
}

function directoryBoundaryIdentity(stat) {
  return {
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: stat.mode.toString(),
  };
}

function sameDirectoryBoundaryIdentity(left, right) {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode;
}

function assertEvidenceBoundary(boundary) {
  let parentStat;
  let directoryStat;
  let canonicalParent;
  let canonicalDirectory;
  try {
    parentStat = lstatSync(boundary.parentPath, { bigint: true });
    directoryStat = lstatSync(boundary.targetPath, { bigint: true });
    canonicalParent = realpathSync.native(boundary.parentPath);
    canonicalDirectory = realpathSync.native(boundary.targetPath);
  } catch {
    throw new CliError("evidence-boundary-drift", "evidence directory boundary disappeared");
  }
  if (
    parentStat.isSymbolicLink()
    || !parentStat.isDirectory()
    || directoryStat.isSymbolicLink()
    || !directoryStat.isDirectory()
    || canonicalParent !== boundary.parentPath
    || canonicalDirectory !== boundary.targetPath
    || !sameDirectoryBoundaryIdentity(
      boundary.parentIdentity,
      directoryBoundaryIdentity(parentStat),
    )
    || !sameDirectoryBoundaryIdentity(
      boundary.directoryIdentity,
      directoryBoundaryIdentity(directoryStat),
    )
    || (Number(directoryStat.mode) & 0o777) !== 0o700
  ) {
    throw new CliError("evidence-boundary-drift", "evidence directory identity drifted");
  }
}

function git(args, formalBoundary) {
  if (formalBoundary !== undefined) {
    try {
      return formalBoundary.runGit(args, { encoding: "utf8" }).trim();
    } catch (error) {
      if (error instanceof MigrationBuildAttestationError) throw error;
      throw new AcceptanceBlockedError(
        `trusted git ${args[0]} could not establish candidate identity`,
      );
    }
  }
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || result.signal !== null) {
    throw new AcceptanceBlockedError(`git ${args[0]} could not establish candidate identity`);
  }
  return result.stdout.trim();
}

function readJson(path, label) {
  let raw;
  try {
    raw = readFileSync(path);
  } catch (error) {
    throw new AcceptanceBlockedError(`${label} is unavailable: ${String(error)}`);
  }
  try {
    return { raw, value: JSON.parse(raw.toString("utf8")) };
  } catch (error) {
    throw new AcceptanceBlockedError(`${label} is not valid JSON: ${String(error)}`);
  }
}

function loadAcceptanceRegistry() {
  const { raw, value: manifest } = readJson(
    acceptanceManifestPath,
    "acceptance manifest",
  );
  const manifestSha256 = sha256(raw);
  const failures = [];
  if (manifestSha256 !== FROZEN_ACCEPTANCE_MANIFEST_SHA256) {
    failures.push(
      `acceptance manifest SHA-256 drifted from ${FROZEN_ACCEPTANCE_MANIFEST_SHA256}`,
    );
  }
  if (manifest?.schemaVersion !== 1 || manifest?.acceptanceVersion !== "v2") {
    failures.push("acceptance manifest schema/version is not the frozen v2 contract");
  }
  if (!Array.isArray(manifest?.cases) || manifest.cases.length !== 103) {
    failures.push("acceptance manifest must contain exactly 103 cases");
  }
  failures.push(...validateCaseRunnerRegistry(manifest));
  return { manifest, manifestSha256, failures };
}

function sameStrings(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.every((value) => typeof value === "string") &&
    JSON.stringify(actual) === JSON.stringify(expected)
  );
}

function loadImplementedFixture(fixtureId) {
  const expectedScenarioIds = implementedFixtureScenarioIds[fixtureId];
  if (expectedScenarioIds === undefined) {
    throw new AcceptanceBlockedError(`${fixtureId} has no executable fixture registration`);
  }
  const { raw: manifestRaw, value: fixtureManifest } = readJson(
    fixtureManifestPath,
    "fixture manifest",
  );
  const manifestSha256 = sha256(manifestRaw);
  const expectedFixtureIds = Object.keys(implementedFixtureScenarioIds).sort();
  const entries = Array.isArray(fixtureManifest?.fixtures)
    ? fixtureManifest.fixtures
    : [];
  const actualFixtureIds = entries
    .map((entry) => entry?.fixtureId)
    .filter((id) => typeof id === "string")
    .sort();
  if (
    fixtureManifest?.schemaVersion !== 1 ||
    JSON.stringify(actualFixtureIds) !== JSON.stringify(expectedFixtureIds)
  ) {
    throw new AcceptanceBlockedError(
      "fixture manifest must contain exactly the independently pinned executable fixtures",
    );
  }
  const entry = entries.find((candidate) => candidate?.fixtureId === fixtureId);
  if (
    entry === undefined ||
    typeof entry.path !== "string" ||
    !/^[a-z0-9-]+\.json$/.test(entry.path) ||
    typeof entry.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(entry.sha256) ||
    !sameStrings(entry.scenarioIds, expectedScenarioIds)
  ) {
    throw new AcceptanceBlockedError(`${fixtureId} fixture manifest entry is invalid`);
  }
  const fixturePath = resolve(projectRoot, "acceptance/fixtures", entry.path);
  const { raw: fixtureRaw, value: fixture } = readJson(fixturePath, `${fixtureId} fixture`);
  const fixtureSha256 = sha256(fixtureRaw);
  if (fixtureSha256 !== entry.sha256) {
    throw new AcceptanceBlockedError(`${fixtureId} fixture SHA-256 does not match its manifest`);
  }
  if (
    fixture?.schemaVersion !== 1 ||
    fixture?.fixtureId !== fixtureId ||
    !sameStrings(fixture.scenarioIds, expectedScenarioIds)
  ) {
    throw new AcceptanceBlockedError(`${fixtureId} fixture identity/scenario set drifted`);
  }
  if (Array.isArray(fixture.scenarios)) {
    const actualScenarioIds = fixture.scenarios.map((scenario) => scenario?.id);
    if (!sameStrings(actualScenarioIds, expectedScenarioIds)) {
      throw new AcceptanceBlockedError(
        `${fixtureId} executable scenarios do not equal the pinned complete set`,
      );
    }
  }
  return {
    fixture,
    fixtureManifestSha256: manifestSha256,
    fixtureSha256,
    scenarioIds: [...expectedScenarioIds],
  };
}

async function loadBuiltDependencies(entryPaths = workspaceEntryPaths) {
  if (
    entryPaths === null
    || typeof entryPaths !== "object"
    || JSON.stringify(Object.keys(entryPaths).sort())
      !== JSON.stringify([...WORKSPACE_PACKAGES].sort())
  ) {
    throw new AcceptanceBlockedError("all six fixed workspace entry paths are required");
  }
  const modules = {};
  for (const name of WORKSPACE_PACKAGES) {
    try {
      modules[name] = await import(pathToFileURL(entryPaths[name]).href);
    } catch (error) {
      throw new AcceptanceBlockedError(
        `built @infinite-flow/${name} dist is required: ${String(error)}`,
      );
    }
  }
  const requiredFunctions = {
    core: ["createInitialState"],
    runtime: [
      "asNonZeroUint32",
      "canonicalStringify",
      "deriveSeedV1",
      "encodeUtf8",
      "hashCanonicalJson",
    ],
    application: ["reduceGameCommand", "validateGameCommand"],
    "save-codec": ["decodeWebV1"],
    client: ["createInfiniteFlowClient"],
    presentation: ["buildGameViewModel"],
  };
  for (const [packageName, names] of Object.entries(requiredFunctions)) {
    for (const name of names) {
      if (typeof modules[packageName][name] !== "function") {
        throw new AcceptanceBlockedError(
          `built @infinite-flow/${packageName} export is missing: ${name}`,
        );
      }
    }
  }
  const client = modules.client;
  if (
    !Number.isSafeInteger(client.CLIENT_SCHEMA_VERSION) ||
    typeof client.CLIENT_CONTENT_VERSION !== "string" ||
    client.CLIENT_CONTENT_VERSION.length === 0
  ) {
    throw new AcceptanceBlockedError("built client version identity exports are invalid");
  }
  return {
    core: modules.core,
    runtime: modules.runtime,
    application: modules.application,
    saveCodec: modules["save-codec"],
    client,
    presentation: modules.presentation,
  };
}

function blockedExecutionAttestation(error) {
  const code = error instanceof MigrationBuildAttestationError
    ? error.code
    : error instanceof AcceptanceBlockedError
      ? "migration-build-candidate-identity-drift"
      : "migration-build-attestation-failed";
  return {
    schemaVersion: 1,
    status: "BLOCKED",
    reasonCode: code,
  };
}

function attestationReasonCode(error, fallback) {
  return error instanceof MigrationBuildAttestationError ? error.code : fallback;
}

function injectPostBuildIdentityDrift() {
  const relativePath = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_BUILD_DIRTY;
  if (!selfTestEnabled || relativePath === undefined) return;
  writeFileSync(resolve(repositoryRoot, relativePath), "post-build source drift\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

function injectDistDrift(environmentName) {
  if (!selfTestEnabled) return;
  const fault = process.env[environmentName];
  const runtimeIndex = resolve(projectRoot, "packages/runtime/dist/index.js");
  if (fault === "runtime-index") {
    appendFileSync(runtimeIndex, `\n// ${environmentName}\n`, { encoding: "utf8" });
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
    const resolution = resolve(projectRoot, "node_modules/@infinite-flow/runtime");
    unlinkSync(resolution);
    symlinkSync(resolve(projectRoot, "packages/client"), resolution, "dir");
  }
}

function injectExecutionContextDrift(executionContext) {
  if (!selfTestSandboxEnabled || executionContext === undefined) return;
  const executionDistFault =
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EXECUTION_DIST_DRIFT;
  if (executionDistFault !== undefined) {
    executionContext.injectSelfTestExecutionDistDrift(executionDistFault);
  }
  const sourceFault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_BUILD_SOURCE_DRIFT;
  if (sourceFault !== undefined) {
    executionContext.injectSelfTestBuildSourceDrift(sourceFault);
  }
  const toolchainFault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT;
  if (toolchainFault !== undefined) {
    executionContext.injectSelfTestToolchainDrift(toolchainFault);
  }
}

function createEvidenceDirectory(boundary) {
  const evidencePath = boundary.targetPath;
  try {
    const parentStat = lstatSync(boundary.parentPath, { bigint: true });
    if (
      parentStat.isSymbolicLink()
      || !parentStat.isDirectory()
      || realpathSync.native(boundary.parentPath) !== boundary.parentPath
      || !sameDirectoryBoundaryIdentity(
        boundary.parentIdentity,
        directoryBoundaryIdentity(parentStat),
      )
    ) {
      throw new CliError("evidence-boundary-drift", "evidence parent identity drifted");
    }
    mkdirSync(evidencePath, { mode: 0o700, recursive: false });
    const directoryStat = lstatSync(evidencePath, { bigint: true });
    if (
      directoryStat.isSymbolicLink()
      || !directoryStat.isDirectory()
      || realpathSync.native(evidencePath) !== evidencePath
      || (Number(directoryStat.mode) & 0o777) !== 0o700
    ) {
      throw new CliError("evidence-boundary-drift", "created evidence directory is unsafe");
    }
    boundary.directoryIdentity = directoryBoundaryIdentity(directoryStat);
    assertEvidenceBoundary(boundary);
  } catch (error) {
    if (error instanceof CliError) throw error;
    const code = error !== null && typeof error === "object" ? error.code : undefined;
    if (code === "EEXIST") {
      throw new CliError("evidence-exists", "evidence directory already exists; refusing overwrite");
    }
    throw new CliError("evidence-create-failed", "evidence directory could not be created exclusively");
  }
}

function injectEvidenceBoundaryDrift(boundary) {
  if (!selfTestSandboxEnabled || boundary === undefined) return;
  const fault = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT;
  if (fault === undefined) return;
  const faultBoundary = boundary.selfTestFaultBoundary;
  if (
    faultBoundary === undefined
    || boundary.parentPath !== faultBoundary.parentPath
    || !sameDirectoryBoundaryIdentity(
      boundary.parentIdentity,
      faultBoundary.parentIdentity,
    )
  ) {
    throw new CliError(
      "self-test-evidence-sandbox-drift",
      "evidence boundary fault lost its runner-owned sacrifice boundary",
    );
  }
  assertSelfTestSandboxBoundary();
  assertEvidenceBoundary(boundary);
  assertPathDoesNotExist(
    faultBoundary.movedParentPath,
    "self-test-evidence-moved-target-exists",
    "the evidence boundary fault moved target must not already exist",
  );
  if (
    faultBoundary.rootPath !== selfTestSandbox.rootPath
    || !sameDirectoryBoundaryIdentity(
      faultBoundary.rootIdentity,
      selfTestSandbox.rootIdentity,
    )
    || dirname(faultBoundary.parentPath) !== selfTestSandbox.rootPath
    || dirname(faultBoundary.movedParentPath) !== selfTestSandbox.rootPath
    || !pathIsStrictlyInside(
      selfTestSandbox.rootPath,
      faultBoundary.movedParentPath,
    )
  ) {
    throw new CliError(
      "self-test-evidence-sandbox-drift",
      "evidence boundary fault paths escaped the canonical self-test sandbox",
    );
  }
  renameSync(boundary.parentPath, faultBoundary.movedParentPath);
  if (fault === "parent-symlink-to-repository") {
    symlinkSync(selfTestSandbox.repositoryPath, boundary.parentPath, "dir");
  }
}

function methodCommand(method, acId) {
  const commands = {
    "A-AC": `npm run test:migration -- --ac ${acId}`,
    "A-WEB": `npm run test:web-oracle -- --ac ${acId}`,
    "A-SMOKE": `npm run smoke:minigame -- --ac ${acId}`,
    "M-DEVICE": `manual-device-fixture --ac ${acId}`,
    "A-RELEASE": `node scripts/test-migration.mjs --release ${acId}`,
    "R-REVIEW": `manual-release-review --ac ${acId}`,
    "A-DERIVE": "node scripts/test-migration.mjs --derive-final",
  };
  return commands[method] ?? `unregistered-method --ac ${acId}`;
}

function blockedMethods(registration, reason) {
  return registration.requiredMethods.map((method) => ({
    method,
    status: "BLOCKED",
    command: methodCommand(method, registration.id),
    exitCode: 2,
    reason,
  }));
}

function statusFromMethods(methods) {
  if (methods.some((method) => method.status === "FAIL")) {
    return { status: "FAIL", exitCode: 1 };
  }
  if (methods.length === 0 || methods.some((method) => method.status !== "PASS")) {
    return { status: "BLOCKED", exitCode: 2 };
  }
  return { status: "PASS", exitCode: 0 };
}

function diagnosticsFromMethods(methods) {
  return methods
    .filter((method) => method.status !== "PASS")
    .map((method) => `${method.method} ${method.status}: ${method.reason}`);
}

function writeEvidence(result, evidencePath, diagnostics, evidenceBoundary) {
  const evidence = result.evidence;
  const stdout = `${stableJson(result)}\n`;
  const stderr = diagnostics.length === 0 ? "" : `${diagnostics.join("\n")}\n`;
  const caseEvidence = `${stableJson({
    schemaVersion: RUNNER_SCHEMA_VERSION,
    type: "migration-case-evidence",
    result,
    artifacts: {
      stdout: {
        relativePath: evidence.stdoutPath,
        bytes: Buffer.byteLength(stdout),
        sha256: sha256(stdout),
      },
      stderr: {
        relativePath: evidence.stderrPath,
        bytes: Buffer.byteLength(stderr),
        sha256: sha256(stderr),
      },
      caseEvidence: {
        relativePath: evidence.caseEvidencePath,
        selfHashNotApplicableReason:
          "case-evidence.json cannot contain its own byte hash without a circular definition",
      },
    },
    validity: {
      identityAttestationRelativePath: evidence.identityAttestationPath,
      invalidatedByRelativePath: evidence.identityDriftPath,
      rule:
        "valid only when the identity attestation seals the matching clean-HEAD source/toolchain/dist execution hash and identity-drift.json is absent",
    },
    subjectCanonicalHash: result.subjectCanonicalHash,
    executionAttestation: result.executionAttestation === undefined
      ? { status: "NOT_APPLICABLE" }
      : {
          status: result.executionAttestation.status,
          canonicalSha256: result.executionAttestation.canonicalSha256 ?? null,
          sourceAttestationSha256:
            result.executionAttestation.hashes?.sourceAttestationSha256 ?? null,
          toolchainAttestationSha256:
            result.executionAttestation.hashes?.toolchainAttestationSha256 ?? null,
          distAttestationSha256:
            result.executionAttestation.hashes?.distAttestationSha256 ?? null,
        },
  })}\n`;
  const files = [
    [resolve(evidencePath, evidence.stdoutPath), stdout],
    [resolve(evidencePath, evidence.stderrPath), stderr],
    [resolve(evidencePath, evidence.caseEvidencePath), caseEvidence],
  ];
  for (const [path, content] of files) {
    assertEvidenceBoundary(evidenceBoundary);
    writeFileSync(path, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    assertEvidenceBoundary(evidenceBoundary);
  }
  return {
    stdout,
    artifacts: {
      stdout: {
        relativePath: evidence.stdoutPath,
        bytes: Buffer.byteLength(stdout),
        sha256: sha256(stdout),
      },
      stderr: {
        relativePath: evidence.stderrPath,
        bytes: Buffer.byteLength(stderr),
        sha256: sha256(stderr),
      },
      caseEvidence: {
        relativePath: evidence.caseEvidencePath,
        bytes: Buffer.byteLength(caseEvidence),
        sha256: sha256(caseEvidence),
      },
    },
  };
}

function injectPostWriteIdentityDrift() {
  const relativePath = process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIRTY;
  if (!selfTestEnabled || relativePath === undefined) return;
  writeFileSync(resolve(repositoryRoot, relativePath), "post-write identity drift\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

function identityDriftResult(result, baseline, current, reason, reasonCode) {
  const drifted = structuredClone(result);
  drifted.status = "BLOCKED";
  drifted.exitCode = 2;
  drifted.candidate.releaseEligible = false;
  drifted.candidate.worktreeClean = current?.worktreeClean ?? false;
  drifted.candidate.immutableIdentity = "evidence-attestation-drift";
  drifted.methods = drifted.methods.map((method) => ({
    ...method,
    status: "BLOCKED",
    exitCode: 2,
    reason,
  }));
  drifted.evidence.identityStatus = "DRIFTED";
  drifted.evidenceIdentity = {
    status: "DRIFTED",
    reason,
    reasonCode,
    baseline: publicGitIdentity(baseline),
    ...(current === undefined ? {} : { observed: publicGitIdentity(current) }),
  };
  if (drifted.executionAttestation !== undefined) {
    drifted.executionAttestationSeal = {
      status: "DRIFTED",
      reason,
      reasonCode,
      canonicalSha256: drifted.executionAttestation.canonicalSha256 ?? null,
    };
  }
  return drifted;
}

function emitIdentityDrift(
  result,
  baseline,
  current,
  reason,
  evidencePath,
  artifacts,
  reasonCode,
  evidenceBoundary,
) {
  const drifted = identityDriftResult(result, baseline, current, reason, reasonCode);
  try {
    assertEvidenceBoundary(evidenceBoundary);
    const marker = {
      schemaVersion: RUNNER_SCHEMA_VERSION,
      type: "migration-evidence-identity-drift",
      result: drifted,
      artifacts,
    };
    writeFileSync(
      resolve(evidencePath, result.evidence.identityDriftPath),
      `${stableJson(marker)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    assertEvidenceBoundary(evidenceBoundary);
  } catch {
    // The nonzero process result still fails closed if the invalidation marker
    // itself cannot be persisted.
  }
  const driftDiagnostics = diagnosticsFromMethods(drifted.methods);
  process.exitCode = 2;
  process.stdout.write(`${stableJson(drifted)}\n`);
  process.stderr.write(`${driftDiagnostics.join("\n")}\n`);
}

function recheckIdentity(baseline, formalBoundary) {
  try {
    const current = captureGitIdentity(formalBoundary);
    return {
      current,
      matches: sameGitIdentity(baseline, current),
    };
  } catch {
    return { current: undefined, matches: false };
  }
}

function emitAndExit(
  result,
  diagnostics = [],
  evidencePath,
  identityBaseline,
  executionContext,
  evidenceBoundary,
  formalBoundary,
) {
  let stdout = `${stableJson(result)}\n`;
  let executionCleaned = false;
  const cleanupExecution = () => {
    if (executionContext === undefined || executionCleaned) return;
    try {
      executionContext.cleanup();
    } finally {
      executionCleaned = true;
    }
  };
  try {
    if (evidencePath !== undefined) {
      let written;
      try {
        assertEvidenceBoundary(evidenceBoundary);
        written = writeEvidence(result, evidencePath, diagnostics, evidenceBoundary);
        stdout = written.stdout;
        injectPostWriteIdentityDrift();
        injectDistDrift("INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT");
      } catch (error) {
        const code = error instanceof CliError ? error.code : "evidence-write-failed";
        const failure = {
          schemaVersion: RUNNER_SCHEMA_VERSION,
          runner: RUNNER_ID,
          status: "BLOCKED",
          exitCode: 2,
          error: {
            code,
            message: "exclusive evidence files could not be written within the captured boundary",
          },
        };
        diagnostics = [`${code}: evidence bundle is incomplete`];
        stdout = `${stableJson(failure)}\n`;
        process.exitCode = 2;
        process.stdout.write(stdout);
        process.stderr.write(`${diagnostics.join("\n")}\n`);
        return;
      }
      const unavailableIdentity = {
        gitHeadSha: "unavailable",
        gitHeadTreeSha: "unavailable",
        status: "unavailable",
        statusSha256: sha256("unavailable"),
        worktreeClean: false,
      };
      const invalidate = (current, reason, reasonCode) => {
        emitIdentityDrift(
          result,
          identityBaseline ?? unavailableIdentity,
          current,
          reason,
          evidencePath,
          written.artifacts,
          reasonCode,
          evidenceBoundary,
        );
      };
      if (identityBaseline === undefined) {
        invalidate(
          undefined,
          "candidate identity baseline was unavailable after evidence write",
          "migration-evidence-identity-baseline-unavailable",
        );
        return;
      }
      const checkGitIdentity = (reason, reasonCode) => {
        const checked = recheckIdentity(identityBaseline, formalBoundary);
        if (!checked.matches) {
          invalidate(checked.current, reason, reasonCode);
          return undefined;
        }
        return checked.current;
      };
      let currentIdentity = checkGitIdentity(
        "git HEAD, HEAD tree, or worktree/index status changed while evidence was written",
        "migration-evidence-git-drift-after-write",
      );
      if (currentIdentity === undefined) return;
      if (executionContext !== undefined) {
        try {
          executionContext.assertUnchangedAfterEvidence();
        } catch (error) {
          invalidate(
            currentIdentity,
            `execution source/toolchain/dist drifted after evidence write: ${
              error instanceof Error ? error.message : "unknown attestation failure"
            }`,
            attestationReasonCode(error, "migration-evidence-execution-drift-after-write"),
          );
          return;
        }
      } else if (result.candidate?.releaseEligible === true) {
        invalidate(
          currentIdentity,
          "release eligibility had no live execution attestation to seal",
          "migration-evidence-execution-attestation-missing",
        );
        return;
      }
      const pendingAttestationPath = resolve(
        evidencePath,
        ".identity-attestation.json.pending",
      );
      const hardlinkedAttestationPath = resolve(
        evidencePath,
        ".identity-attestation.json.hardlinked",
      );
      const finalAttestationPath = resolve(
        evidencePath,
        result.evidence.identityAttestationPath,
      );
      const discard = (...paths) => {
        for (const path of paths) {
          try {
            unlinkSync(path);
          } catch {
            // Missing provisional/final seals are already fail closed.
          }
        }
      };
      try {
        assertEvidenceBoundary(evidenceBoundary);
        const attestation = {
          schemaVersion: RUNNER_SCHEMA_VERSION,
          type: "migration-evidence-identity-attestation",
          status: selfTestEnabled ? "SELF_TEST_ONLY" : "STABLE",
          selfTestOnly: selfTestEnabled,
          releaseEligible: result.candidate.releaseEligible,
          identity: publicGitIdentity(currentIdentity),
          artifacts: written.artifacts,
          executionAttestation: result.executionAttestation === undefined
            ? { status: "NOT_APPLICABLE" }
            : {
                status: result.executionAttestation.status,
                canonicalSha256: result.executionAttestation.canonicalSha256 ?? null,
                hashes: result.executionAttestation.hashes ?? null,
              },
        };
        writeFileSync(
          pendingAttestationPath,
          `${stableJson(attestation)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 },
        );
        assertEvidenceBoundary(evidenceBoundary);
        injectDistDrift(
          "INFINITE_FLOW_MIGRATION_SELF_TEST_POST_ATTESTATION_DIST_DRIFT",
        );
      } catch (error) {
        discard(pendingAttestationPath);
        invalidate(
          currentIdentity,
          "identity attestation could not be created exclusively",
          error instanceof CliError
            ? error.code
            : "migration-evidence-identity-attestation-write-failed",
        );
        return;
      }
      currentIdentity = checkGitIdentity(
        "git identity changed while the provisional identity attestation was written",
        "migration-evidence-git-drift-before-hardlink",
      );
      if (currentIdentity === undefined) {
        discard(pendingAttestationPath);
        return;
      }
      if (executionContext !== undefined) {
        try {
          executionContext.assertUnchangedAfterEvidence();
        } catch (error) {
          discard(pendingAttestationPath);
          invalidate(
            currentIdentity,
            `execution source/toolchain/dist drifted before provisional hardlink: ${
              error instanceof Error ? error.message : "unknown attestation failure"
            }`,
            attestationReasonCode(error, "migration-evidence-execution-drift-before-hardlink"),
          );
          return;
        }
      }
      try {
        assertEvidenceBoundary(evidenceBoundary);
        linkSync(pendingAttestationPath, hardlinkedAttestationPath);
        unlinkSync(pendingAttestationPath);
        assertEvidenceBoundary(evidenceBoundary);
        injectDistDrift(
          "INFINITE_FLOW_MIGRATION_SELF_TEST_POST_FINAL_SEAL_DIST_DRIFT",
        );
      } catch (error) {
        discard(pendingAttestationPath, hardlinkedAttestationPath);
        invalidate(
          currentIdentity,
          "provisional identity attestation could not be hardlinked exclusively",
          error instanceof CliError
            ? error.code
            : "migration-evidence-identity-hardlink-failed",
        );
        return;
      }
      currentIdentity = checkGitIdentity(
        "git identity changed after the provisional seal hardlink",
        "migration-evidence-git-drift-after-hardlink",
      );
      if (currentIdentity === undefined) {
        discard(hardlinkedAttestationPath);
        return;
      }
      try {
        formalBoundary?.assertRepositoryObjects();
      } catch (error) {
        discard(hardlinkedAttestationPath);
        invalidate(
          currentIdentity,
          "trusted Git reachable object validation failed after provisional hardlink",
          attestationReasonCode(error, "migration-formal-git-object-graph-invalid"),
        );
        return;
      }
      if (executionContext !== undefined) {
        try {
          executionContext.assertUnchangedAfterEvidence();
        } catch (error) {
          discard(hardlinkedAttestationPath);
          invalidate(
            currentIdentity,
            `execution source/toolchain/dist drifted after provisional hardlink: ${
              error instanceof Error ? error.message : "unknown attestation failure"
            }`,
            attestationReasonCode(error, "migration-evidence-execution-drift-after-hardlink"),
          );
          return;
        }
      }
      try {
        if (
          selfTestSandboxEnabled
          && process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_CLEANUP_FAILURE === "1"
        ) {
          executionContext?.injectSelfTestCleanupFailure();
        }
        cleanupExecution();
      } catch (error) {
        discard(hardlinkedAttestationPath, finalAttestationPath);
        invalidate(
          currentIdentity,
          "isolated execution context cleanup failed before final seal promotion",
          attestationReasonCode(error, "migration-build-cleanup-failed"),
        );
        return;
      }
      currentIdentity = checkGitIdentity(
        "git identity changed after isolated execution cleanup",
        "migration-evidence-git-drift-after-cleanup",
      );
      if (currentIdentity === undefined) {
        discard(hardlinkedAttestationPath);
        return;
      }
      if (executionContext !== undefined) {
        try {
          executionContext.assertExternalUnchangedAfterCleanup();
        } catch (error) {
          discard(hardlinkedAttestationPath);
          invalidate(
            currentIdentity,
            `candidate/toolchain drifted after isolated execution cleanup: ${
              error instanceof Error ? error.message : "unknown attestation failure"
            }`,
            attestationReasonCode(error, "migration-evidence-external-drift-after-cleanup"),
          );
          return;
        }
      }
      try {
        assertEvidenceBoundary(evidenceBoundary);
        linkSync(hardlinkedAttestationPath, finalAttestationPath);
        unlinkSync(hardlinkedAttestationPath);
        assertEvidenceBoundary(evidenceBoundary);
      } catch (error) {
        discard(hardlinkedAttestationPath, finalAttestationPath);
        invalidate(
          currentIdentity,
          "final identity attestation could not be promoted exclusively after cleanup",
          error instanceof CliError
            ? error.code
            : "migration-evidence-identity-seal-promotion-failed",
        );
        return;
      }
      currentIdentity = checkGitIdentity(
        "git identity changed after final identity seal promotion",
        "migration-evidence-git-drift-after-seal",
      );
      if (currentIdentity === undefined) {
        discard(finalAttestationPath);
        return;
      }
      try {
        formalBoundary?.assertRepositoryObjects();
      } catch (error) {
        discard(finalAttestationPath);
        invalidate(
          currentIdentity,
          "trusted Git reachable object validation failed after final seal promotion",
          attestationReasonCode(error, "migration-formal-git-object-graph-invalid"),
        );
        return;
      }
      if (executionContext !== undefined) {
        try {
          executionContext.assertExternalUnchangedAfterCleanup();
          assertEvidenceBoundary(evidenceBoundary);
        } catch (error) {
          discard(finalAttestationPath);
          invalidate(
            currentIdentity,
            `candidate/toolchain/evidence boundary drifted after final seal: ${
              error instanceof Error ? error.message : "unknown attestation failure"
            }`,
            error instanceof CliError
              ? error.code
              : attestationReasonCode(error, "migration-evidence-drift-after-seal"),
          );
          return;
        }
      }
    }
    process.exitCode = result.exitCode;
    process.stdout.write(stdout);
    if (diagnostics.length > 0) process.stderr.write(`${diagnostics.join("\n")}\n`);
  } finally {
    if (!executionCleaned) {
      try {
        cleanupExecution();
      } catch {
        // Every success path cleans before final seal promotion. Here the
        // emitted result is already non-release evidence or a fail-closed
        // process result, so a cleanup error cannot upgrade validity.
      }
    }
  }
}

function usageFailure(error) {
  const result = {
    schemaVersion: RUNNER_SCHEMA_VERSION,
    runner: RUNNER_ID,
    status: "ERROR",
    exitCode: 64,
    error: {
      code: error instanceof CliError ? error.code : "invalid-arguments",
      message: error instanceof Error ? error.message : "invalid command line",
    },
  };
  emitAndExit(result, [`${result.error.code}: ${result.error.message}`]);
}

async function main() {
  let options;
  try {
    options = parseCli(process.argv.slice(2));
  } catch (error) {
    usageFailure(error);
    return;
  }

  let registry;
  try {
    registry = loadAcceptanceRegistry();
  } catch (error) {
    const result = {
      schemaVersion: RUNNER_SCHEMA_VERSION,
      runner: RUNNER_ID,
      status: "BLOCKED",
      exitCode: 2,
      selectedAcId: options.acId,
      error: {
        code: "registry-unavailable",
        message: error instanceof Error ? error.message : "acceptance registry unavailable",
      },
    };
    emitAndExit(result, [`registry-unavailable: ${result.error.message}`]);
    return;
  }

  const registration = caseRunners.find((entry) => entry.id === options.acId);
  if (registration === undefined) {
    usageFailure(new CliError("unknown-ac", "the selected AC ID is not in the frozen registry"));
    return;
  }
  const manifestCase = Array.isArray(registry.manifest?.cases)
    ? registry.manifest.cases.find((entry) => entry?.id === options.acId)
    : undefined;
  if (manifestCase === undefined) {
    const message = "selected registered AC is missing from the frozen acceptance manifest";
    emitAndExit(
      {
        schemaVersion: RUNNER_SCHEMA_VERSION,
        runner: RUNNER_ID,
        status: "BLOCKED",
        exitCode: 2,
        selectedAcId: options.acId,
        error: { code: "registry-mismatch", message },
      },
      [`registry-mismatch: ${message}`],
    );
    return;
  }

  let evidencePath;
  let evidenceBoundary;
  if (options.evidencePath !== undefined) {
    evidencePath = options.evidencePath;
    try {
      evidenceBoundary = validateEvidenceLocation(evidencePath);
      createEvidenceDirectory(evidenceBoundary);
      evidencePath = evidenceBoundary.targetPath;
      injectEvidenceBoundaryDrift(evidenceBoundary);
    } catch (error) {
      usageFailure(error);
      return;
    }
  }
  const formalEvidence = evidencePath !== undefined;

  let gitHeadSha = "unavailable";
  let gitHeadTreeSha = "unavailable";
  let worktreeClean = false;
  let gitIdentity;
  let packageVersion = "unavailable";
  let clientSchemaVersion = null;
  let contentVersion = "unavailable";
  let assetManifest = null;
  let assetManifestRevision = "unavailable";
  let core;
  let runtime;
  let application;
  let saveCodec;
  let client;
  let presentation;
  let identityBlock;
  let executionContext;
  let executionAttestation;
  let formalBoundary;
  try {
    if (formalEvidence) {
      formalBoundary = prepareMigrationFormalBoundary({ repositoryRoot });
    }
    gitIdentity = captureGitIdentity(formalBoundary);
    gitHeadSha = gitIdentity.gitHeadSha;
    gitHeadTreeSha = gitIdentity.gitHeadTreeSha;
    worktreeClean = gitIdentity.worktreeClean;
    packageVersion = readJson(packagePath, "package metadata").value.version;
    assetManifest = readJson(assetManifestPath, "asset manifest").value;
    assetManifestRevision = assetManifest.manifestRevision;
    if (formalEvidence) {
      if (!worktreeClean) {
        throw new AcceptanceBlockedError(
          "formal evidence requires a clean git index/worktree before any build or import",
        );
      }
      executionContext = prepareMigrationBuildAttestation({
        repositoryRoot,
        projectRoot,
        toolchainInstallationRoot: selfTestSandboxEnabled ? projectRoot : scriptProjectRoot,
        gitHeadSha,
        gitHeadTreeSha,
        capabilities: registration.capabilities,
        allowSelfTestFaults: selfTestSandboxEnabled,
        selfTestGitBlobFault:
          process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_GIT_BLOB_DRIFT,
        formalBoundary,
      });
      injectPostBuildIdentityDrift();
      const postBuildIdentity = recheckIdentity(gitIdentity, formalBoundary);
      if (!postBuildIdentity.matches) {
        throw new AcceptanceBlockedError(
          "git identity drifted while the clean-HEAD package graph was rebuilt",
        );
      }
      ({ core, runtime, application, saveCodec, client, presentation } =
        await loadBuiltDependencies(executionContext.entryPaths));
      injectDistDrift("INFINITE_FLOW_MIGRATION_SELF_TEST_POST_IMPORT_DIST_DRIFT");
      executionAttestation = executionContext.attestImportWindow();
      const postImportIdentity = recheckIdentity(gitIdentity, formalBoundary);
      if (!postImportIdentity.matches) {
        throw new AcceptanceBlockedError(
          "git identity drifted while rebuilt package bytes were imported",
        );
      }
    } else {
      ({ core, runtime, application, saveCodec, client, presentation } =
        await loadBuiltDependencies());
    }
    clientSchemaVersion = client.CLIENT_SCHEMA_VERSION;
    contentVersion = client.CLIENT_CONTENT_VERSION;
  } catch (error) {
    executionContext?.cleanup();
    executionContext = undefined;
    if (formalEvidence) executionAttestation = blockedExecutionAttestation(error);
    identityBlock = error instanceof Error ? error.message : "candidate identity is unavailable";
  }

  const candidateId = options.candidateId ??
    (gitHeadSha === "unavailable" ? "unavailable" : `git-${gitHeadSha.slice(0, 12)}`);
  const candidate = {
    id: candidateId,
    gitHeadSha,
    gitHeadTreeSha,
    packageVersion,
    schemaVersion: clientSchemaVersion,
    contentVersion,
    rulesVersions: {
      canonicalHash: 1,
      gameAssetManifest: 1,
      seed: 1,
    },
    assetManifestRevision,
    worktreeClean,
    selfTestOnly: selfTestEnabled,
    immutableIdentity: formalEvidence
      ? executionAttestation?.status === "ATTESTED"
        ? selfTestEnabled
          ? "self-test-clean-head-rebuild-execution-attested"
          : "clean-head-rebuild-execution-attested"
        : "formal-execution-unattested"
      : worktreeClean
        ? "clean-git-head-unattested-dist"
        : "unattested-working-tree",
    formalEvidence,
    releaseEligible:
      formalEvidence
      && !selfTestEnabled
      && worktreeClean
      && executionAttestation?.status === "ATTESTED",
  };

  let fixtureManifestSha256 = null;
  try {
    fixtureManifestSha256 = sha256(readFileSync(fixtureManifestPath));
  } catch {
    // An executable case turns this into a structured fixture BLOCKED result.
  }
  let fixtureEvidence = {
    id: registration.fixtureId,
    fixtureManifestSha256,
    fixtureSha256: null,
    scenarioIds: [],
    notApplicableReason: "fixture did not execute",
  };
  let loadedFixture;
  let fixtureBlock;
  if (Object.keys(registration.methodImplementations).length > 0) {
    try {
      loadedFixture = loadImplementedFixture(registration.fixtureId);
      fixtureEvidence = {
        id: registration.fixtureId,
        fixtureManifestSha256: loadedFixture.fixtureManifestSha256,
        fixtureSha256: loadedFixture.fixtureSha256,
        scenarioIds: loadedFixture.scenarioIds,
      };
    } catch (error) {
      fixtureBlock = error instanceof Error ? error.message : "executable fixture is unavailable";
    }
  }
  let methods;
  let subject = {
    caseId: registration.id,
    status: "BLOCKED",
    reason: "case did not execute",
  };
  const methodSubjects = {};
  const syntheticPassSelection =
    process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD;

  if (registry.failures.length > 0) {
    const reason = `runner/manifest registry mismatch: ${registry.failures.join("; ")}`;
    methods = blockedMethods(registration, reason);
    subject = { caseId: registration.id, status: "BLOCKED", reason };
  } else if (identityBlock !== undefined) {
    methods = blockedMethods(registration, identityBlock);
    subject = { caseId: registration.id, status: "BLOCKED", reason: identityBlock };
  } else if (formalEvidence && !worktreeClean) {
    const reason =
      "formal evidence requires a clean git index/worktree before clean-HEAD rebuild and execution attestation";
    methods = blockedMethods(registration, reason);
    subject = { caseId: registration.id, status: "BLOCKED", reason };
  } else {
    methods = [];
    for (const method of registration.requiredMethods) {
      const command = methodCommand(method, registration.id);
      const syntheticPass = selfTestEnabled
        && syntheticPassSelection === `${registration.id}:${method}`;
      const implementationName = registration.methodImplementations[method];
      if (method !== "A-AC") {
        const reason = `${method} requires an independent external executor or sealed evidence`;
        methods.push({ method, status: "BLOCKED", command, exitCode: 2, reason });
        continue;
      }
      if (!syntheticPass && implementationName === undefined) {
        const reason = "A-AC fixture runner is not registered";
        methods.push({ method, status: "BLOCKED", command, exitCode: 2, reason });
        continue;
      }
      if (syntheticPass) {
        methodSubjects[method] = {
          caseId: registration.id,
          method,
          selfTestOnly: true,
          status: "PASS",
        };
        methods.push({ method, status: "PASS", command, exitCode: 0 });
        continue;
      }
      if (fixtureBlock !== undefined || loadedFixture === undefined) {
        const reason = fixtureBlock ?? "executable fixture is unavailable";
        methodSubjects[method] = { caseId: registration.id, method, status: "BLOCKED", reason };
        methods.push({ method, status: "BLOCKED", command, exitCode: 2, reason });
        continue;
      }
      try {
        const implementation = implementedCaseFunctions[implementationName];
        if (typeof implementation !== "function") {
          throw new AcceptanceBlockedError(
            `${implementationName} implementation is not exported for ${method}`,
          );
        }
        const methodSubject = await implementation({
          fixture: loadedFixture.fixture,
          core,
          runtime,
          application,
          saveCodec,
          client,
          presentation,
          projectRoot,
          assetManifest,
        });
        if (
          process.env.INFINITE_FLOW_MIGRATION_SELF_TEST === "1"
          && process.env.INFINITE_FLOW_MIGRATION_SELF_TEST_FAULT === registration.id
        ) {
          throw new AcceptanceAssertionError("self-check injected assertion failure");
        }
        if (Array.isArray(methodSubject.scenarios)) {
          const executedScenarioIds = methodSubject.scenarios.map((scenario) => scenario.id);
          if (!sameStrings(executedScenarioIds, loadedFixture.scenarioIds)) {
            throw new AcceptanceAssertionError(
              "executed scenario IDs do not equal the pinned complete fixture set",
            );
          }
        }
        methodSubjects[method] = methodSubject;
        methods.push({ method, status: "PASS", command, exitCode: 0 });
      } catch (error) {
        const blockedFailure = error instanceof AcceptanceBlockedError;
        const status = blockedFailure ? "BLOCKED" : "FAIL";
        const exitCode = blockedFailure ? 2 : 1;
        const reason = error instanceof Error ? error.message : "case execution failed";
        methodSubjects[method] = { caseId: registration.id, method, status, reason };
        methods.push({ method, status, command, exitCode, reason });
      }
    }
  }

  const aggregate = statusFromMethods(methods);
  const methodSubjectEntries = Object.entries(methodSubjects);
  if (registration.requiredMethods.length === 1 && methodSubjectEntries.length === 1) {
    subject = methodSubjectEntries[0][1];
  } else if (methodSubjectEntries.length > 0) {
    subject = {
      caseId: registration.id,
      status: aggregate.status,
      methodSubjects,
    };
  }
  let subjectCanonicalHash = null;
  let subjectCanonicalHashNotApplicableReason;
  if (runtime !== undefined) {
    try {
      subjectCanonicalHash = await runtime.hashCanonicalJson(
        subject,
        new runtime.PortableSha256HashPort(),
      );
    } catch (error) {
      if (aggregate.status === "PASS") {
        const reason = `subject canonical hash failed: ${String(error)}`;
        methods = methods.map((method) => ({
          ...method,
          status: "FAIL",
          exitCode: 1,
          reason,
        }));
        Object.assign(aggregate, { status: "FAIL", exitCode: 1 });
      }
      subjectCanonicalHashNotApplicableReason = "subject was not canonical-hashable";
    }
  } else {
    subjectCanonicalHashNotApplicableReason = "built runtime hash implementation was unavailable";
  }
  if (executionContext !== undefined) {
    injectDistDrift("INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT");
    injectExecutionContextDrift(executionContext);
    try {
      executionContext.assertUnchangedAfterCase();
      const postCaseIdentity = recheckIdentity(gitIdentity, formalBoundary);
      if (!postCaseIdentity.matches) {
        throw new AcceptanceBlockedError(
          "git identity drifted while the acceptance case executed",
        );
      }
    } catch (error) {
      const reason = `formal execution attestation drifted before evidence write: ${
        error instanceof Error ? error.message : "unknown attestation failure"
      }`;
      methods = blockedMethods(registration, reason);
      Object.assign(aggregate, { status: "BLOCKED", exitCode: 2 });
      subject = { caseId: registration.id, status: "BLOCKED", reason };
      subjectCanonicalHash = null;
      subjectCanonicalHashNotApplicableReason =
        "execution source/toolchain/dist identity drifted before evidence write";
      executionAttestation = blockedExecutionAttestation(error);
      executionContext.cleanup();
      executionContext = undefined;
    }
  }
  candidate.releaseEligible =
    formalEvidence
    && !selfTestEnabled
    && worktreeClean
    && aggregate.status === "PASS"
    && executionAttestation?.status === "ATTESTED"
    && executionContext !== undefined;
  if (formalEvidence) {
    candidate.immutableIdentity = executionAttestation?.status === "ATTESTED"
      && executionContext !== undefined
      ? selfTestEnabled
        ? "self-test-clean-head-rebuild-execution-attested"
        : "clean-head-rebuild-execution-attested"
      : "formal-execution-unattested";
  }

  const result = {
    schemaVersion: RUNNER_SCHEMA_VERSION,
    runner: RUNNER_ID,
    status: aggregate.status,
    exitCode: aggregate.exitCode,
    case: {
      id: manifestCase.id,
      priority: manifestCase.priority,
      kind: manifestCase.kind,
      name: manifestCase.name,
      fixtureId: manifestCase.fixtureId,
      expected: manifestCase.expected,
      requiredMethods: manifestCase.methods,
    },
    candidate,
    acceptance: {
      version: registry.manifest.acceptanceVersion,
      manifestSha256: registry.manifestSha256,
    },
    fixture: fixtureEvidence,
    methods,
    transitionHashes: {
      notApplicableReason:
        aggregate.status === "PASS"
          ? "fixture assertions are bound by the canonical method subject; no application-session event trace was executed"
          : "case did not complete, so before/after/events hashes are not applicable",
    },
    subjectCanonicalHash,
    ...(subjectCanonicalHashNotApplicableReason === undefined
      ? {}
      : { subjectCanonicalHashNotApplicableReason }),
    ...(executionAttestation === undefined ? {} : { executionAttestation }),
    subject,
    ...(evidencePath === undefined
      ? {}
      : {
          evidence: {
            directory: evidencePath,
            stdoutPath: "stdout.json",
            stderrPath: "stderr.log",
            caseEvidencePath: "case-evidence.json",
            identityAttestationPath: "identity-attestation.json",
            identityDriftPath: "identity-drift.json",
            identityStatus: "REQUIRES_STABLE_ATTESTATION",
          },
        }),
  };
  const diagnostics = diagnosticsFromMethods(methods);
  emitAndExit(
    result,
    diagnostics,
    evidencePath,
    gitIdentity,
    executionContext,
    evidenceBoundary,
    formalBoundary,
  );
}

await main();
