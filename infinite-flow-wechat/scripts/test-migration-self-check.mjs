import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  caseRunners,
  validateCaseRunnerRegistration,
} from "../acceptance/cases/case-runners.mjs";
import { assetKeyRevisionCache } from "../acceptance/cases/implemented-cases.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const runnerPath = resolve(projectRoot, "scripts/test-migration.mjs");
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function equal(actual, expected, message) {
  assertions += 1;
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Assertion failed: ${message}; expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

function hash(bytes) {
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

function recomputeCanonicalHash(attestation, message) {
  const { canonicalSha256, ...payload } = attestation;
  equal(
    canonicalSha256,
    hash(Buffer.from(stableJson(payload), "utf8")),
    message,
  );
}

function exactKeys(value, expected, message) {
  equal(
    JSON.stringify(Object.keys(value).sort()),
    JSON.stringify([...expected].sort()),
    message,
  );
}

function assertSha256(value, message) {
  assert(typeof value === "string" && /^[0-9a-f]{64}$/.test(value), message);
}

function assertPositiveInteger(value, message) {
  assert(Number.isSafeInteger(value) && value > 0, message);
}

function assertFileAttestation(value, message) {
  exactKeys(
    value,
    ["canonicalPath", "configuredPath", "identity", "sha256"],
    `${message} exact keys`,
  );
  assert(
    typeof value.canonicalPath === "string" && value.canonicalPath.length > 0,
    `${message} canonical path`,
  );
  assert(
    typeof value.configuredPath === "string" && value.configuredPath.length > 0,
    `${message} configured path`,
  );
  assertSha256(value.sha256, `${message} content hash`);
  exactKeys(
    value.identity,
    ["changedNs", "device", "inode", "mode", "modifiedNs", "size"],
    `${message} identity keys`,
  );
  for (const [name, field] of Object.entries(value.identity)) {
    assert(typeof field === "string" && /^\d+$/.test(field), `${message} ${name}`);
  }
}

function invoke(args, extraEnv = {}, executable = process.execPath) {
  const result = spawnSync(executable, [runnerPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert(result.signal === null, `runner was not killed for ${args.join(" ")}`);
  const stdout = result.stdout;
  const lines = stdout.trimEnd().split("\n");
  equal(lines.length, 1, `stdout contains one JSON line for ${args.join(" ")}`);
  let report;
  try {
    report = JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`runner stdout is not JSON: ${stdout}; ${String(error)}`);
  }
  equal(report.exitCode, result.status, `JSON and process exit agree for ${args.join(" ")}`);
  return { ...result, report };
}

function invokeWithNodeArguments(nodeArguments, args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [...nodeArguments, runnerPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert(result.signal === null, `runner with Node arguments was not killed`);
  const lines = result.stdout.trimEnd().split("\n");
  equal(lines.length, 1, "Node-argument runner stdout contains one JSON line");
  const report = JSON.parse(lines[0]);
  equal(report.exitCode, result.status, "Node-argument JSON and process exit agree");
  return { ...result, report };
}

function checkPassCases() {
  const expectedScenarios = {
    "AC-CONTENT-001": 2,
    "AC-COMPAT-001": 2,
    "AC-COMPAT-002": 1,
    "AC-COMPAT-003": 1,
    "AC-COMPAT-004": 1,
    "AC-HASH-001": 15,
    "AC-SEED-002": 4,
    "AC-ASSET-002": 6,
    "AC-ASSET-003": 9,
  };
  for (const [id, scenarioCount] of Object.entries(expectedScenarios)) {
    const result = invoke(["--ac", id]);
    equal(result.status, 0, `${id} exits zero`);
    equal(result.report.status, "PASS", `${id} passes`);
    equal(result.stderr, "", `${id} emits no stderr diagnostics`);
    equal(result.report.fixture.scenarioIds.length, scenarioCount, `${id} full scenario count`);
    assert(
      result.report.methods.length > 0 &&
        result.report.methods.every(
          (method) => method.status === "PASS" && method.exitCode === 0,
        ),
      `${id} passes every required method`,
    );
    equal(result.report.methods.length, 1, `${id} has exactly one required method`);
    equal(result.report.methods[0].method, "A-AC", `${id} method is A-AC`);
    equal(
      result.report.methods[0].command,
      `npm run test:migration -- --ac ${id}`,
      `${id} reports the npm A-AC command`,
    );
    assert(
      /^[0-9a-f]{64}$/.test(result.report.subjectCanonicalHash),
      `${id} exposes a canonical subject digest`,
    );
    equal(result.report.candidate.formalEvidence, false, `${id} ordinary run is not formal evidence`);
    equal(result.report.candidate.releaseEligible, false, `${id} ordinary run cannot claim release evidence`);
  }
}

async function checkAssetManifestExtensionBoundaries() {
  const fixture = JSON.parse(readFileSync(
    resolve(projectRoot, "acceptance/fixtures/asset-key-revision-cache.json"),
    "utf8",
  ));
  const manifest = JSON.parse(readFileSync(
    resolve(projectRoot, "cocos/assets/config/asset-manifest.json"),
    "utf8",
  ));
  const cases = [
    ["current count drift", (value) => { value.assetCount -= 1; }, "assetCount field"],
    ["migrated metadata drift", (value) => { value.assets[0].alt = "changed"; }, "frozen Web manifestRevision"],
    ["migrated source removed", (value) => { delete value.assets[0].webSourcePath; }, "frozen Web asset count"],
    ["new atlas byte hash drift", (value) => {
      value.assets.find((asset) => asset.key === "character:reincarnator_walk").targetSha256 = "0".repeat(64);
    }, "physical SHA-256"],
    ["new dungeon-world byte hash drift", (value) => {
      value.assets.find((asset) => asset.key === "scene:dungeon_world_demon_tower_1").targetSha256 = "0".repeat(64);
    }, "physical SHA-256"],
    ["new dungeon-world cannot enter the frozen Web snapshot", (value) => {
      value.assets.find((asset) => asset.key === "scene:dungeon_world_demon_tower_1").webSourcePath = "/dungeon-world/demon_tower_1-v1.png";
    }, "frozen Web asset count"],
  ];
  for (const [label, mutate, expectedReason] of cases) {
    const assetManifest = structuredClone(manifest);
    mutate(assetManifest);
    assetManifest.manifestRevision = `sha256:${hash(Buffer.from(JSON.stringify({
      schemaVersion: assetManifest.schemaVersion,
      sourceManifest: assetManifest.sourceManifest,
      resourceRoot: assetManifest.resourceRoot,
      assets: assetManifest.assets,
    })))}`;
    let failure;
    try {
      await assetKeyRevisionCache({ fixture, projectRoot, assetManifest });
    } catch (error) {
      failure = error;
    }
    assert(failure?.message.includes(expectedReason), `${label} is rejected after revision recomputation`);
  }
}

function checkMethodRegistrations() {
  const expected = {
    "AC-CONTENT-001": "catalog19Dungeons",
    "AC-COMPAT-001": "webV1TwoEncounterAliases",
    "AC-COMPAT-002": "webV1EquipmentHunt",
    "AC-COMPAT-003": "webV1SingleMethodSnapshot",
    "AC-COMPAT-004": "webV1MissingRunSnapshots",
    "AC-HASH-001": "hashCanonicalJsonV1",
    "AC-SEED-002": "seedRootLabelGoldenV1",
    "AC-ASSET-002": "assetKeyRevisionCache",
    "AC-ASSET-003": "assetErrorTaxonomy",
  };
  for (const [id, implementation] of Object.entries(expected)) {
    const registration = caseRunners.find((entry) => entry.id === id);
    assert(registration !== undefined, `${id} registration exists`);
    exactKeys(
      registration.methodImplementations,
      ["A-AC"],
      `${id} has one method implementation mapping`,
    );
    equal(
      registration.methodImplementations["A-AC"],
      implementation,
      `${id} retains its A-AC implementation`,
    );
  }
  for (const id of ["AC-ASSET-002", "AC-ASSET-003"]) {
    const assetRegistration = caseRunners.find((entry) => entry.id === id);
    equal(
      JSON.stringify(assetRegistration.capabilities),
      JSON.stringify(["esbuild"]),
      `${id} declares esbuild as a registration capability`,
    );
  }
  for (const id of [
    "AC-CONTENT-001",
    "AC-COMPAT-001",
    "AC-COMPAT-002",
    "AC-COMPAT-003",
    "AC-COMPAT-004",
    "AC-HASH-001",
    "AC-SEED-002",
  ]) {
    const registration = caseRunners.find((entry) => entry.id === id);
    equal(registration.capabilities.length, 0, `${id} declares no tool capability`);
  }
  const invalidExternalImplementation = validateCaseRunnerRegistration({
    id: "AC-SELF-TEST-EXTERNAL",
    requiredMethods: ["A-AC", "A-SMOKE"],
    methodImplementations: { "A-SMOKE": "unsafeInProcessSmoke" },
    capabilities: [],
  });
  assert(
    invalidExternalImplementation.some((failure) =>
      failure.includes("A-SMOKE cannot use an in-process fixture implementation")),
    "registry rejects in-process implementations for external methods",
  );
}

function checkMultiMethodIsolation() {
  const outcome = invoke(
    ["--ac", "AC-STATE-006"],
    {
      INFINITE_FLOW_MIGRATION_SELF_TEST: "1",
      INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD: "AC-STATE-006:A-AC",
    },
  );
  equal(outcome.status, 2, "partial multi-method execution exits BLOCKED");
  equal(outcome.report.status, "BLOCKED", "partial multi-method aggregate is BLOCKED");
  equal(outcome.report.methods.length, 2, "multi-method case reports both required methods");
  const automated = outcome.report.methods.find((method) => method.method === "A-AC");
  const smoke = outcome.report.methods.find((method) => method.method === "A-SMOKE");
  equal(automated?.status, "PASS", "executed A-AC method alone passes");
  equal(automated?.exitCode, 0, "executed A-AC method exits zero");
  equal(smoke?.status, "BLOCKED", "unexecuted A-SMOKE remains BLOCKED");
  equal(smoke?.exitCode, 2, "unexecuted A-SMOKE retains blocked exit code");
  assert(
    smoke?.reason.includes("requires an independent external executor or sealed evidence"),
    "unexecuted A-SMOKE reports the missing external evidence boundary",
  );
  equal(
    outcome.report.candidate.releaseEligible,
    false,
    "partial multi-method result cannot be release eligible",
  );
  equal(
    outcome.report.subject.methodSubjects["A-AC"].selfTestOnly,
    true,
    "synthetic method PASS is explicitly self-test only",
  );

  const unguarded = invoke(
    ["--ac", "AC-STATE-006"],
    { INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD: "AC-STATE-006:A-AC" },
  );
  equal(unguarded.status, 64, "unguarded synthetic method PASS is rejected");
  equal(
    unguarded.report.error.code,
    "self-test-only-option",
    "synthetic method PASS cannot be enabled in production",
  );
}

function checkExitTaxonomy() {
  const zero = invoke([]);
  equal(zero.status, 64, "zero selection exits 64");
  equal(zero.report.error.code, "zero-selection", "zero selection error code");

  const unknown = invoke(["--ac", "AC-NOPE-999"]);
  equal(unknown.status, 64, "unknown selection exits 64");
  equal(unknown.report.error.code, "unknown-ac", "unknown selection error code");

  const blocked = invoke(["--ac", "AC-CONTENT-002"]);
  equal(blocked.status, 2, "known unimplemented case exits 2");
  equal(blocked.report.status, "BLOCKED", "known unimplemented case is BLOCKED");
  assert(
    blocked.report.methods.every(
      (method) => method.status === "BLOCKED" && method.exitCode === 2,
    ),
    "known unimplemented case never reports a false PASS",
  );

  const failed = invoke(
    ["--ac", "AC-HASH-001"],
    {
      INFINITE_FLOW_MIGRATION_SELF_TEST: "1",
      INFINITE_FLOW_MIGRATION_SELF_TEST_FAULT: "AC-HASH-001",
    },
  );
  equal(failed.status, 1, "injected assertion failure exits 1");
  equal(failed.report.status, "FAIL", "injected assertion failure is FAIL");
  assert(
    failed.report.methods.every(
      (method) => method.status === "FAIL" && method.exitCode === 1,
    ),
    "injected assertion failure marks every required method failed",
  );

  const productionFault = invoke(
    ["--ac", "AC-HASH-001"],
    { INFINITE_FLOW_MIGRATION_SELF_TEST_FAULT: "AC-HASH-001" },
  );
  equal(productionFault.status, 64, "unguarded fault injection is rejected");
  equal(
    productionFault.report.error.code,
    "self-test-only-option",
    "unguarded fault error code",
  );

  const productionRootOverride = invoke(
    ["--ac", "AC-HASH-001"],
    {
      INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT: projectRoot,
      INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT: projectRoot,
    },
  );
  equal(productionRootOverride.status, 64, "production root override exits 64");
  equal(
    productionRootOverride.report.error.code,
    "self-test-only-option",
    "production root override is rejected before execution",
  );
}

function checkStableDigest() {
  const first = invoke(["--ac", "AC-HASH-001"]);
  const second = invoke(["--ac", "AC-HASH-001"]);
  equal(
    first.report.subjectCanonicalHash,
    second.report.subjectCanonicalHash,
    "canonical subject digest is stable across repeated runs",
  );
  equal(
    JSON.stringify(first.report.subject),
    JSON.stringify(second.report.subject),
    "canonical subject input is stable across repeated runs",
  );
}

function evidenceSnapshot(directory) {
  return Object.fromEntries(
    readdirSync(directory)
      .sort()
      .map((name) => [name, hash(readFileSync(join(directory, name)))]),
  );
}

function directorySnapshot(directory) {
  const stat = lstatSync(directory, { bigint: true });
  return {
    canonicalPath: realpathSync.native(directory),
    device: stat.dev.toString(),
    entries: readdirSync(directory).sort(),
    inode: stat.ino.toString(),
    isDirectory: stat.isDirectory(),
    isSymbolicLink: stat.isSymbolicLink(),
    mode: stat.mode.toString(),
  };
}

function runGit(repository, args) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  equal(result.status, 0, `git ${args[0]} succeeds in clean-case fixture`);
  equal(result.signal, null, `git ${args[0]} is not killed in clean-case fixture`);
  return result.stdout.trim();
}

const workspacePackages = [
  "core",
  "runtime",
  "application",
  "save-codec",
  "client",
  "presentation",
];

function copyPath(source, destination) {
  mkdirSync(resolve(destination, ".."), { recursive: true, mode: 0o700 });
  cpSync(source, destination, { recursive: true, force: false });
}

function createCleanGitRepository(root) {
  const repository = join(root, "repository");
  mkdirSync(repository, { mode: 0o700 });
  runGit(repository, ["init", "--quiet"]);
  runGit(repository, ["config", "user.name", "Migration Runner Self Check"]);
  runGit(repository, ["config", "user.email", "migration-runner-self-check@example.invalid"]);
  for (const relativePath of [
    ".gitignore",
    "package.json",
    "package-lock.json",
    "acceptance",
    "toolchain/cocos-toolchain.lock.json",
    "cocos/assets/config/asset-manifest.json",
    "cocos/assets/resources",
    "cocos/assets/scripts/platform/cocos-asset-port.ts",
    "cocos/assets/scripts/platform/cocos-resources-loader.ts",
    "packages/save-codec/tests/fixtures",
    "scripts/test-migration.mjs",
    "scripts/migration-build-attestation.mjs",
    "scripts/file-attestation.mjs",
    "scripts/npm-toolchain.mjs",
  ]) {
    copyPath(resolve(projectRoot, relativePath), resolve(repository, relativePath));
  }
  for (const name of workspacePackages) {
    for (const relativePath of [
      "package.json",
      "tsconfig.json",
      ...(name === "runtime" ? [] : ["tsconfig.build.json"]),
      "src",
      ...(name === "core" ? ["scripts/rewrite-esm-imports.mjs"] : []),
    ]) {
      copyPath(
        resolve(projectRoot, "packages", name, relativePath),
        resolve(repository, "packages", name, relativePath),
      );
    }
  }
  for (const toolPath of ["typescript", "esbuild", "@esbuild"]) {
    copyPath(
      resolve(projectRoot, "node_modules", toolPath),
      resolve(repository, "node_modules", toolPath),
    );
  }
  writeFileSync(join(repository, "migration-self-check-subject.txt"), "stable\n", {
    mode: 0o600,
  });
  runGit(repository, ["add", "."]);
  runGit(repository, ["commit", "--quiet", "-m", "clean candidate"]);
  for (const name of workspacePackages) {
    copyPath(
      resolve(projectRoot, "packages", name, "dist"),
      resolve(repository, "packages", name, "dist"),
    );
  }
  const scope = resolve(repository, "node_modules/@infinite-flow");
  mkdirSync(scope, { recursive: true, mode: 0o700 });
  for (const name of workspacePackages) {
    symlinkSync(resolve(repository, "packages", name), resolve(scope, name), "dir");
  }
  equal(runGit(repository, ["status", "--porcelain=v1"]), "", "fixture repository starts clean");
  return repository;
}

function checkExclusiveEvidence() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "infinite-flow-migration-self-check-"));
  try {
    const repository = createCleanGitRepository(temporaryRoot);
    const selfTestEnvironment = {
      INFINITE_FLOW_MIGRATION_SELF_TEST: "1",
      INFINITE_FLOW_MIGRATION_SELF_TEST_REPOSITORY_ROOT: repository,
      INFINITE_FLOW_MIGRATION_SELF_TEST_PROJECT_ROOT: repository,
    };
    const insideRepository = join(repository, "unignored-evidence");
    const rejected = invoke(
      ["--ac", "AC-HASH-001", "--evidence", insideRepository],
      selfTestEnvironment,
    );
    equal(rejected.status, 64, "unignored in-repository evidence path is rejected");
    equal(
      rejected.report.error.code,
      "evidence-inside-repository",
      "in-repository path rejection code",
    );
    equal(existsSync(insideRepository), false, "rejected in-repository directory is not created");

    const partialMethodDirectory = join(temporaryRoot, "partial-method-candidate");
    const partialMethod = invoke(
      ["--ac", "AC-STATE-006", "--evidence", partialMethodDirectory],
      {
        ...selfTestEnvironment,
        INFINITE_FLOW_MIGRATION_SELF_TEST_PASS_METHOD: "AC-STATE-006:A-AC",
      },
    );
    equal(partialMethod.status, 2, "formal partial multi-method case exits BLOCKED");
    equal(
      partialMethod.report.methods.find((method) => method.method === "A-AC")?.status,
      "PASS",
      `formal partial multi-method case preserves its executed A-AC PASS (${String(partialMethod.report.executionAttestation?.reasonCode)})`,
    );
    equal(
      partialMethod.report.methods.find((method) => method.method === "A-SMOKE")?.status,
      "BLOCKED",
      "formal partial multi-method case preserves missing A-SMOKE as BLOCKED",
    );
    equal(
      partialMethod.report.candidate.releaseEligible,
      false,
      "formal partial multi-method case cannot be release eligible",
    );
    const partialMethodSeal = JSON.parse(
      readFileSync(join(partialMethodDirectory, "identity-attestation.json"), "utf8"),
    );
    equal(
      partialMethodSeal.status,
      "SELF_TEST_ONLY",
      "formal partial multi-method identity seal remains self-test only",
    );
    equal(
      partialMethodSeal.releaseEligible,
      false,
      "formal partial multi-method identity seal is not release eligible",
    );

    const evidenceDirectory = join(temporaryRoot, "candidate");
    const first = invoke([
      "--ac",
      "AC-HASH-001",
      "--candidate-id",
      "runner-self-check",
      "--evidence",
      evidenceDirectory,
    ], selfTestEnvironment);
    equal(
      first.status,
      0,
      `clean external evidence run passes (${first.stderr.trim()} / ${JSON.stringify(first.report)})`,
    );
    equal(first.report.status, "PASS", "clean external evidence result is PASS");
    equal(first.report.candidate.worktreeClean, true, "clean evidence records clean identity");
    equal(first.report.candidate.releaseEligible, false, "self-test evidence is never release eligible");
    equal(first.report.candidate.selfTestOnly, true, "synthetic evidence is marked self-test only");
    equal(
      first.report.executionAttestation.status,
      "ATTESTED",
      "clean evidence has a closed execution attestation",
    );
    recomputeCanonicalHash(
      first.report.executionAttestation.source,
      "source attestation canonical hash can be recomputed",
    );
    recomputeCanonicalHash(
      first.report.executionAttestation.toolchain,
      "toolchain attestation canonical hash can be recomputed",
    );
    recomputeCanonicalHash(
      first.report.executionAttestation.dist,
      "dist attestation canonical hash can be recomputed",
    );
    recomputeCanonicalHash(
      first.report.executionAttestation,
      "execution attestation canonical hash can be recomputed",
    );
    const { source, toolchain, dist } = first.report.executionAttestation;
    exactKeys(
      first.report.executionAttestation,
      [
        "capabilities",
        "canonicalSha256",
        "dist",
        "hashes",
        "schemaVersion",
        "source",
        "status",
        "toolchain",
      ],
      "execution attestation exact schema",
    );
    equal(
      first.report.executionAttestation.schemaVersion,
      1,
      "execution attestation schema version",
    );
    equal(
      first.report.executionAttestation.capabilities.length,
      0,
      "non-asset execution attestation binds an empty capability set",
    );
    exactKeys(
      first.report.executionAttestation.hashes,
      [
        "distAttestationSha256",
        "sourceAttestationSha256",
        "toolchainAttestationSha256",
      ],
      "execution attestation hash schema",
    );
    exactKeys(
      source,
      [
        "canonicalSha256",
        "contentTreeSha256",
        "fileCount",
        "gitHeadSha",
        "gitHeadTreeSha",
        "materializedContentTreeSha256",
        "materializedIdentityTreeSha256",
        "projectPath",
        "schemaVersion",
        "totalBytes",
      ],
      "source attestation exact schema",
    );
    equal(source.schemaVersion, 1, "source attestation schema version");
    equal(source.projectPath, ".", "source attestation project path");
    assert(/^[0-9a-f]{40,64}$/.test(source.gitHeadSha), "source attests HEAD");
    assert(/^[0-9a-f]{40,64}$/.test(source.gitHeadTreeSha), "source attests HEAD tree");
    assertPositiveInteger(source.fileCount, "source file count");
    assertPositiveInteger(source.totalBytes, "source byte count");
    for (const [name, value] of Object.entries({
      contentTreeSha256: source.contentTreeSha256,
      materializedContentTreeSha256: source.materializedContentTreeSha256,
      materializedIdentityTreeSha256: source.materializedIdentityTreeSha256,
    })) {
      assertSha256(value, `source ${name}`);
    }

    exactKeys(
      toolchain,
      [
        "buildPlanSha256",
        "canonicalSha256",
        "esbuild",
        "git",
        "lockSha256",
        "node",
        "npm",
        "packageJsonSha256",
        "packageLockSha256",
        "schemaVersion",
        "typescript",
      ],
      "toolchain attestation exact schema",
    );
    equal(toolchain.schemaVersion, 1, "toolchain attestation schema version");
    for (const [name, value] of Object.entries({
      buildPlanSha256: toolchain.buildPlanSha256,
      lockSha256: toolchain.lockSha256,
      packageJsonSha256: toolchain.packageJsonSha256,
      packageLockSha256: toolchain.packageLockSha256,
    })) {
      assertSha256(value, `toolchain ${name}`);
    }
    exactKeys(
      toolchain.git,
      [
        "canonicalSha256",
        "executable",
        "gitDirectory",
        "gitDirectoryIdentity",
        "repositoryIdentity",
        "schemaVersion",
        "strictReachableObjectValidation",
        "version",
      ],
      "Git attestation exact schema",
    );
    equal(toolchain.git.schemaVersion, 1, "Git attestation schema version");
    equal(
      toolchain.git.strictReachableObjectValidation,
      true,
      "Git attestation requires strict reachable-object validation",
    );
    assert(/^git version /.test(toolchain.git.version), "Git version is bound");
    recomputeCanonicalHash(toolchain.git, "Git attestation canonical hash can be recomputed");
    assertFileAttestation(toolchain.git.executable, "Git executable attestation");
    for (const [label, identity] of [
      ["Git directory", toolchain.git.gitDirectoryIdentity],
      ["repository", toolchain.git.repositoryIdentity],
    ]) {
      exactKeys(identity, ["device", "inode", "mode"], `${label} identity keys`);
      for (const field of Object.values(identity)) {
        assert(typeof field === "string" && /^\d+$/.test(field), `${label} identity value`);
      }
    }
    const { version: nodeVersion, ...nodeFile } = toolchain.node;
    equal(nodeVersion, "26.7.0", "Node version is bound");
    assertFileAttestation(nodeFile, "Node executable attestation");
    const { version: npmVersion, ...npmFile } = toolchain.npm;
    equal(npmVersion, "11.19.0", "npm version is bound");
    assertFileAttestation(npmFile, "npm CLI attestation");
    exactKeys(
      toolchain.typescript,
      [
        "canonicalRoot",
        "contentTreeSha256",
        "fileCount",
        "identityTreeSha256",
        "totalBytes",
        "version",
      ],
      "TypeScript attestation exact schema",
    );
    equal(toolchain.typescript.version, "5.9.3", "TypeScript version is bound");
    assert(
      typeof toolchain.typescript.canonicalRoot === "string"
        && toolchain.typescript.canonicalRoot.length > 0,
      "TypeScript canonical root is bound",
    );
    assertPositiveInteger(toolchain.typescript.fileCount, "TypeScript file count");
    assertPositiveInteger(toolchain.typescript.totalBytes, "TypeScript byte count");
    assertSha256(
      toolchain.typescript.contentTreeSha256,
      "TypeScript content tree hash",
    );
    assertSha256(
      toolchain.typescript.identityTreeSha256,
      "TypeScript identity tree hash",
    );
    exactKeys(toolchain.esbuild, ["required"], "non-asset esbuild schema");
    equal(toolchain.esbuild.required, false, "non-asset case does not use esbuild");

    exactKeys(
      dist,
      [
        "candidateIdentityTreeSha256",
        "candidateImportWindowStable",
        "candidateResolutionIdentitySha256",
        "canonicalSha256",
        "cleanRebuildMatchesCandidate",
        "contentTreeSha256",
        "executionIdentityTreeSha256",
        "executionImportWindowStable",
        "executionResolutionIdentitySha256",
        "fileCount",
        "importEntries",
        "importGraphEdgeCount",
        "importGraphSha256",
        "packageCount",
        "resolutionContentSha256",
        "schemaVersion",
        "totalBytes",
      ],
      "dist attestation exact schema",
    );
    equal(dist.schemaVersion, 1, "dist attestation schema version");
    equal(dist.packageCount, 6, "dist attests all six packages");
    assertPositiveInteger(dist.fileCount, "dist file count");
    assertPositiveInteger(dist.totalBytes, "dist byte count");
    assertPositiveInteger(dist.importGraphEdgeCount, "dist import graph edge count");
    for (const [name, value] of Object.entries({
      candidateIdentityTreeSha256: dist.candidateIdentityTreeSha256,
      candidateResolutionIdentitySha256: dist.candidateResolutionIdentitySha256,
      contentTreeSha256: dist.contentTreeSha256,
      executionIdentityTreeSha256: dist.executionIdentityTreeSha256,
      executionResolutionIdentitySha256: dist.executionResolutionIdentitySha256,
      importGraphSha256: dist.importGraphSha256,
      resolutionContentSha256: dist.resolutionContentSha256,
    })) {
      assertSha256(value, `dist ${name}`);
    }
    for (const [name, value] of Object.entries({
      candidateImportWindowStable: dist.candidateImportWindowStable,
      cleanRebuildMatchesCandidate: dist.cleanRebuildMatchesCandidate,
      executionImportWindowStable: dist.executionImportWindowStable,
    })) {
      equal(value, true, `dist ${name}`);
    }
    exactKeys(dist.importEntries, workspacePackages, "dist import entry keys");
    for (const [name, entry] of Object.entries(dist.importEntries)) {
      exactKeys(entry, ["path", "sha256"], `${name} import entry schema`);
      equal(
        entry.path,
        `packages/${name}/dist/index.js`,
        `${name} import entry path`,
      );
      assertSha256(entry.sha256, `${name} import entry hash`);
    }
    equal(
      first.report.executionAttestation.hashes.sourceAttestationSha256,
      first.report.executionAttestation.source.canonicalSha256,
      "execution source hash equals the nested source attestation hash",
    );
    equal(
      first.report.executionAttestation.hashes.toolchainAttestationSha256,
      first.report.executionAttestation.toolchain.canonicalSha256,
      "execution toolchain hash equals the nested toolchain attestation hash",
    );
    equal(
      first.report.executionAttestation.hashes.distAttestationSha256,
      first.report.executionAttestation.dist.canonicalSha256,
      "execution dist hash equals the nested dist attestation hash",
    );
    assert(
      /^[0-9a-f]{64}$/.test(first.report.executionAttestation.dist.importGraphSha256),
      "execution dist binds the closed import graph",
    );
    equal(
      first.report.executionAttestation.dist.cleanRebuildMatchesCandidate,
      true,
      "clean candidate dist is byte-identical to the isolated rebuild",
    );
    equal(
      first.report.candidate.gitHeadSha,
      runGit(repository, ["rev-parse", "HEAD"]),
      "clean evidence binds the fixture HEAD",
    );
    equal(runGit(repository, ["status", "--porcelain=v1"]), "", "evidence write keeps git clean");

    const assetEvidenceDirectory = join(temporaryRoot, "asset-candidate");
    const assetEvidence = invoke(
      ["--ac", "AC-ASSET-002", "--evidence", assetEvidenceDirectory],
      selfTestEnvironment,
    );
    equal(assetEvidence.status, 0, "formal asset case exits zero");
    equal(assetEvidence.report.status, "PASS", "formal asset case passes");
    equal(
      assetEvidence.report.executionAttestation.toolchain.esbuild.required,
      true,
      "formal asset case attests the esbuild package and platform binary tree",
    );
    equal(
      JSON.stringify(assetEvidence.report.executionAttestation.capabilities),
      JSON.stringify(["esbuild"]),
      "formal asset attestation binds the registration capability set",
    );
    const assetEsbuild = assetEvidence.report.executionAttestation.toolchain.esbuild;
    exactKeys(
      assetEsbuild,
      [
        "binary",
        "binaryRelativePath",
        "binaryVersion",
        "fileCount",
        "packageContentTreeSha256",
        "packageIdentityTreeSha256",
        "platformContentTreeSha256",
        "platformIdentityTreeSha256",
        "platformKey",
        "platformPackage",
        "required",
        "totalBytes",
        "version",
      ],
      "required esbuild attestation exact schema",
    );
    equal(
      assetEsbuild.version,
      "0.21.5",
      "formal asset case uses the package-lock esbuild version",
    );
    equal(
      assetEsbuild.binaryVersion,
      "0.21.5",
      "formal asset case probes the actual platform binary version",
    );
    assertPositiveInteger(assetEsbuild.fileCount, "esbuild attested file count");
    assertPositiveInteger(assetEsbuild.totalBytes, "esbuild attested byte count");
    for (const [name, value] of Object.entries({
      packageContentTreeSha256: assetEsbuild.packageContentTreeSha256,
      packageIdentityTreeSha256: assetEsbuild.packageIdentityTreeSha256,
      platformContentTreeSha256: assetEsbuild.platformContentTreeSha256,
      platformIdentityTreeSha256: assetEsbuild.platformIdentityTreeSha256,
    })) {
      assertSha256(value, `esbuild ${name}`);
    }
    for (const [name, value] of Object.entries({
      binaryRelativePath: assetEsbuild.binaryRelativePath,
      platformKey: assetEsbuild.platformKey,
      platformPackage: assetEsbuild.platformPackage,
    })) {
      assert(typeof value === "string" && value.length > 0, `esbuild ${name}`);
    }
    assertFileAttestation(assetEsbuild.binary, "esbuild binary attestation");
    recomputeCanonicalHash(
      assetEvidence.report.executionAttestation.toolchain,
      "asset case toolchain canonical hash can be recomputed",
    );
    equal(
      assetEvidence.report.candidate.releaseEligible,
      false,
      "self-test asset evidence cannot retain release eligibility",
    );
    equal(statSync(evidenceDirectory).mode & 0o777, 0o700, "evidence directory mode");
    const expectedFiles = [
      "case-evidence.json",
      "identity-attestation.json",
      "stderr.log",
      "stdout.json",
    ];
    equal(
      JSON.stringify(readdirSync(evidenceDirectory).sort()),
      JSON.stringify(expectedFiles),
      "evidence has the exact output file set",
    );
    for (const name of expectedFiles) {
      equal(statSync(join(evidenceDirectory, name)).mode & 0o777, 0o600, `${name} mode`);
    }
    equal(
      readFileSync(join(evidenceDirectory, "stdout.json"), "utf8"),
      first.stdout,
      "captured stdout is byte-identical",
    );
    equal(
      readFileSync(join(evidenceDirectory, "stderr.log"), "utf8"),
      first.stderr,
      "captured stderr is byte-identical",
    );
    const caseEvidence = JSON.parse(
      readFileSync(join(evidenceDirectory, "case-evidence.json"), "utf8"),
    );
    equal(caseEvidence.schemaVersion, 1, "case evidence schema version");
    equal(caseEvidence.type, "migration-case-evidence", "case evidence type");
    equal(
      JSON.stringify(Object.keys(caseEvidence.artifacts).sort()),
      JSON.stringify(["caseEvidence", "stderr", "stdout"]),
      "case evidence has the exact artifact key set",
    );
    equal(
      JSON.stringify(caseEvidence.result),
      JSON.stringify(first.report),
      "case evidence embeds the emitted structured result",
    );
    const stdoutBytes = readFileSync(join(evidenceDirectory, "stdout.json"));
    const stderrBytes = readFileSync(join(evidenceDirectory, "stderr.log"));
    equal(
      caseEvidence.artifacts.stdout.relativePath,
      "stdout.json",
      "case evidence uses a relative stdout path",
    );
    equal(
      caseEvidence.artifacts.stdout.bytes,
      stdoutBytes.byteLength,
      "stdout byte count can be recomputed",
    );
    equal(
      caseEvidence.artifacts.stdout.sha256,
      hash(stdoutBytes),
      "stdout SHA-256 can be recomputed",
    );
    equal(
      caseEvidence.artifacts.stderr.relativePath,
      "stderr.log",
      "case evidence uses a relative stderr path",
    );
    equal(
      caseEvidence.artifacts.stderr.bytes,
      stderrBytes.byteLength,
      "stderr byte count can be recomputed",
    );
    equal(
      caseEvidence.artifacts.stderr.sha256,
      hash(stderrBytes),
      "stderr SHA-256 can be recomputed",
    );
    equal(
      caseEvidence.artifacts.caseEvidence.relativePath,
      "case-evidence.json",
      "case evidence self-path is relative",
    );
    assert(
      caseEvidence.artifacts.caseEvidence.selfHashNotApplicableReason.length > 0,
      "case evidence explicitly avoids a circular self-hash",
    );
    equal(
      caseEvidence.subjectCanonicalHash,
      first.report.subjectCanonicalHash,
      "case evidence binds the canonical subject hash",
    );
    equal(
      caseEvidence.executionAttestation.canonicalSha256,
      first.report.executionAttestation.canonicalSha256,
      "case evidence binds the execution attestation hash",
    );
    equal(
      caseEvidence.executionAttestation.sourceAttestationSha256,
      first.report.executionAttestation.hashes.sourceAttestationSha256,
      "case evidence binds the source attestation hash",
    );
    equal(
      caseEvidence.executionAttestation.toolchainAttestationSha256,
      first.report.executionAttestation.hashes.toolchainAttestationSha256,
      "case evidence binds the toolchain attestation hash",
    );
    equal(
      caseEvidence.executionAttestation.distAttestationSha256,
      first.report.executionAttestation.hashes.distAttestationSha256,
      "case evidence binds the dist attestation hash",
    );
    equal(
      caseEvidence.validity.identityAttestationRelativePath,
      "identity-attestation.json",
      "case evidence requires the relative identity attestation",
    );
    equal(
      caseEvidence.validity.invalidatedByRelativePath,
      "identity-drift.json",
      "case evidence names its fail-closed drift marker",
    );
    const identityAttestation = JSON.parse(
      readFileSync(join(evidenceDirectory, "identity-attestation.json"), "utf8"),
    );
    equal(identityAttestation.schemaVersion, 1, "identity seal schema version");
    equal(
      identityAttestation.type,
      "migration-evidence-identity-attestation",
      "identity seal type",
    );
    equal(identityAttestation.status, "SELF_TEST_ONLY", "synthetic identity seal is explicit");
    equal(identityAttestation.selfTestOnly, true, "identity seal is marked self-test only");
    equal(identityAttestation.releaseEligible, false, "synthetic seal cannot retain eligibility");
    equal(
      JSON.stringify(Object.keys(identityAttestation.artifacts).sort()),
      JSON.stringify(["caseEvidence", "stderr", "stdout"]),
      "identity seal has the exact artifact key set",
    );
    equal(
      identityAttestation.executionAttestation.canonicalSha256,
      first.report.executionAttestation.canonicalSha256,
      "identity seal binds the execution attestation hash",
    );
    equal(
      stableJson(identityAttestation.executionAttestation.hashes),
      stableJson(first.report.executionAttestation.hashes),
      "identity seal hashes exactly equal the emitted execution hashes",
    );
    equal(
      identityAttestation.identity.gitHeadSha,
      first.report.candidate.gitHeadSha,
      "identity attestation rechecks the same HEAD",
    );
    for (const [name, artifact] of Object.entries(identityAttestation.artifacts)) {
      const bytes = readFileSync(join(evidenceDirectory, artifact.relativePath));
      equal(artifact.bytes, bytes.byteLength, `${name} attested byte count is reproducible`);
      equal(artifact.sha256, hash(bytes), `${name} attested SHA-256 is reproducible`);
    }
    const before = evidenceSnapshot(evidenceDirectory);
    const second = invoke([
      "--ac",
      "AC-HASH-001",
      "--evidence",
      evidenceDirectory,
    ], selfTestEnvironment);
    equal(second.status, 64, "existing evidence directory exits 64");
    equal(second.report.error.code, "evidence-exists", "existing evidence error code");
    equal(
      JSON.stringify(evidenceSnapshot(evidenceDirectory)),
      JSON.stringify(before),
      "second evidence attempt changes no bytes",
    );

    let negativeCase = 0;
    const expectFormalBlocked = (
      label,
      extraEnvironment = {},
      expectedReasonCode,
      acId = "AC-HASH-001",
      executable = process.execPath,
    ) => {
      negativeCase += 1;
      const directory = join(temporaryRoot, `negative-${negativeCase}-${label}`);
      const outcome = invoke(
        ["--ac", acId, "--evidence", directory],
        { ...selfTestEnvironment, ...extraEnvironment },
        executable,
      );
      equal(outcome.status, 2, `${label} exits BLOCKED`);
      equal(outcome.report.status, "BLOCKED", `${label} result is BLOCKED`);
      equal(
        outcome.report.candidate.releaseEligible,
        false,
        `${label} cannot retain release eligibility`,
      );
      if (expectedReasonCode !== undefined) {
        const actualReasonCode = outcome.report.executionAttestation?.reasonCode
          ?? outcome.report.evidenceIdentity?.reasonCode
          ?? outcome.report.error?.code;
        equal(actualReasonCode, expectedReasonCode, `${label} exact reason code`);
      }
      return { directory, outcome };
    };

    const esbuildOverride = expectFormalBlocked(
      "esbuild-binary-override",
      { ESBUILD_BINARY_PATH: resolve(repository, "malicious-esbuild") },
      "migration-build-esbuild-binary-override-forbidden",
      "AC-ASSET-002",
    );
    equal(
      existsSync(join(esbuildOverride.directory, "identity-attestation.json")),
      false,
      "esbuild override receives no final identity seal",
    );

    expectFormalBlocked(
      "git-directory-override",
      { GIT_DIR: resolve(repository, ".git") },
      "migration-formal-git-environment-forbidden",
    );

    const benignPreload = join(temporaryRoot, "benign-preload.mjs");
    writeFileSync(benignPreload, "export {};\n", { mode: 0o600 });
    expectFormalBlocked(
      "node-options-import-hook",
      { NODE_OPTIONS: `--import=${benignPreload}` },
      "migration-formal-node-options-forbidden",
    );
    const conditionsDirectory = join(temporaryRoot, "node-conditions-evidence");
    const conditions = invokeWithNodeArguments(
      ["--conditions=attack"],
      ["--ac", "AC-HASH-001", "--evidence", conditionsDirectory],
      selfTestEnvironment,
    );
    equal(conditions.status, 2, "Node conditions override exits BLOCKED");
    equal(conditions.report.status, "BLOCKED", "Node conditions result is BLOCKED");
    equal(
      conditions.report.executionAttestation.reasonCode,
      "migration-formal-node-exec-argv-forbidden",
      "Node conditions override has the exact reason code",
    );
    const loaderDirectory = join(temporaryRoot, "node-loader-evidence");
    const loader = invokeWithNodeArguments(
      ["--import", benignPreload],
      ["--ac", "AC-HASH-001", "--evidence", loaderDirectory],
      selfTestEnvironment,
    );
    equal(loader.status, 2, "Node import hook exits BLOCKED");
    equal(loader.report.status, "BLOCKED", "Node import hook result is BLOCKED");
    equal(
      loader.report.executionAttestation.reasonCode,
      "migration-formal-node-loader-hook-forbidden",
      "Node import hook has the exact reason code",
    );

    const fakeBin = join(temporaryRoot, "fake-bin");
    mkdirSync(fakeBin, { mode: 0o700 });
    const fakeGit = join(fakeBin, "git");
    writeFileSync(fakeGit, "#!/bin/sh\nexit 97\n", { mode: 0o700 });
    chmodSync(fakeGit, 0o700);
    const pathWrapperDirectory = join(temporaryRoot, "path-wrapper-evidence");
    const pathWrapper = invoke(
      ["--ac", "AC-HASH-001", "--evidence", pathWrapperDirectory],
      {
        ...selfTestEnvironment,
        PATH: `${fakeBin}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      },
    );
    equal(pathWrapper.status, 0, "PATH git wrapper cannot intercept formal probes");
    equal(pathWrapper.report.status, "PASS", "trusted absolute Git run still passes");

    const originalSourceBlob = runGit(repository, [
      "rev-parse",
      "HEAD:packages/runtime/src/index.ts",
    ]);
    const replacementBlobInput = join(temporaryRoot, "replacement-blob.txt");
    writeFileSync(replacementBlobInput, "malicious replacement blob\n", { mode: 0o600 });
    const replacementBlob = runGit(repository, [
      "hash-object",
      "-w",
      replacementBlobInput,
    ]);
    runGit(repository, ["replace", originalSourceBlob, replacementBlob]);
    const replacementEvidence = join(temporaryRoot, "replacement-ref-evidence");
    const replacementRun = invoke(
      ["--ac", "AC-HASH-001", "--evidence", replacementEvidence],
      selfTestEnvironment,
    );
    equal(replacementRun.status, 0, "replacement refs cannot redirect trusted Git reads");
    equal(replacementRun.report.status, "PASS", "replacement-ref candidate still uses HEAD bytes");
    runGit(repository, ["replace", "-d", originalSourceBlob]);

    const reachableObjectPath = resolve(
      repository,
      ".git/objects",
      originalSourceBlob.slice(0, 2),
      originalSourceBlob.slice(2),
    );
    assert(existsSync(reachableObjectPath), "reachable source blob is a loose fixture object");
    const reachableObjectBytes = readFileSync(reachableObjectPath);
    const reachableObjectMode = statSync(reachableObjectPath).mode & 0o777;
    try {
      chmodSync(reachableObjectPath, 0o600);
      writeFileSync(reachableObjectPath, "corrupt reachable object\n", {
        mode: 0o600,
      });
      expectFormalBlocked(
        "git-reachable-object-corruption",
        {},
        "migration-formal-git-object-graph-invalid",
      );
    } finally {
      writeFileSync(reachableObjectPath, reachableObjectBytes, {
        mode: reachableObjectMode,
      });
      chmodSync(reachableObjectPath, reachableObjectMode);
    }
    runGit(
      repository,
      ["fsck", "--strict", "--no-dangling", "HEAD"],
    );
    expectFormalBlocked(
      "git-blob-object-id-mismatch",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_GIT_BLOB_DRIFT: "replace-build-blob" },
      "migration-build-git-blob-content-mismatch",
    );

    const runtimeIndex = resolve(repository, "packages/runtime/dist/index.js");
    const runtimeIndexBytes = readFileSync(runtimeIndex);
    appendFileSync(runtimeIndex, "\n// direct ignored-dist tamper\n");
    const tampered = expectFormalBlocked(
      "tampered-dist",
      {},
      "migration-dist-does-not-match-clean-rebuild",
    );
    equal(
      tampered.outcome.report.executionAttestation.status,
      "BLOCKED",
      "direct ignored-dist tamper has no valid execution seal",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    appendFileSync(runtimeIndex, '\nimport "node:fs";\n');
    expectFormalBlocked(
      "dist-external-import",
      {},
      "migration-dist-external-import-forbidden",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const symlinkTarget = resolve(repository, "packages/runtime/dist/seed.js");
    unlinkSync(runtimeIndex);
    symlinkSync(symlinkTarget, runtimeIndex);
    expectFormalBlocked("dist-symlink", {}, "migration-dist-symlink-forbidden");
    unlinkSync(runtimeIndex);
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const extraDistFile = resolve(repository, "packages/runtime/dist/unexpected.js");
    writeFileSync(extraDistFile, "export const unexpected = true;\n", { mode: 0o600 });
    expectFormalBlocked(
      "dist-addition",
      {},
      "migration-dist-does-not-match-clean-rebuild",
    );
    unlinkSync(extraDistFile);

    const clientDeclaration = resolve(repository, "packages/client/dist/index.d.ts");
    const clientDeclarationBytes = readFileSync(clientDeclaration);
    unlinkSync(clientDeclaration);
    expectFormalBlocked("dist-removal", {}, "migration-dist-package-export-missing");
    writeFileSync(clientDeclaration, clientDeclarationBytes);

    const clientImplementation = resolve(
      repository,
      "packages/client/dist/infinite-flow-client.js",
    );
    const renamedImplementation = `${clientImplementation}.renamed`;
    renameSync(clientImplementation, renamedImplementation);
    expectFormalBlocked("dist-rename", {}, "migration-dist-import-target-unattested");
    renameSync(renamedImplementation, clientImplementation);

    const clientResolution = resolve(
      repository,
      "node_modules/@infinite-flow/client",
    );
    unlinkSync(clientResolution);
    symlinkSync(resolve(repository, "packages/core"), clientResolution, "dir");
    expectFormalBlocked(
      "workspace-resolution-drift",
      {},
      "migration-dist-bare-package-resolution-drift",
    );
    unlinkSync(clientResolution);
    symlinkSync(resolve(repository, "packages/client"), clientResolution, "dir");

    expectFormalBlocked(
      "post-import-dist-drift",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_POST_IMPORT_DIST_DRIFT: "runtime-index" },
      "migration-dist-candidate-tree-drift-during-run",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    expectFormalBlocked(
      "post-case-dist-drift",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT: "runtime-index" },
      "migration-dist-candidate-tree-drift-during-run",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const identityReplacement = expectFormalBlocked(
      "post-case-identity-replacement",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT: "runtime-index-replace" },
      "migration-dist-candidate-tree-drift-during-run",
    );
    equal(
      identityReplacement.outcome.report.executionAttestation.status,
      "BLOCKED",
      "same-content inode replacement invalidates the import/run attestation",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    expectFormalBlocked(
      "post-case-resolution-drift",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_POST_CASE_DIST_DRIFT: "runtime-resolution" },
      "migration-dist-workspace-resolution-drift",
    );
    const runtimeResolution = resolve(
      repository,
      "node_modules/@infinite-flow/runtime",
    );
    unlinkSync(runtimeResolution);
    symlinkSync(resolve(repository, "packages/runtime"), runtimeResolution, "dir");

    for (const [label, fault] of [
      ["execution-dist-content", "runtime-index"],
      ["execution-dist-identity", "runtime-index-replace"],
      ["execution-dist-resolution", "runtime-resolution"],
    ]) {
      expectFormalBlocked(
        label,
        { INFINITE_FLOW_MIGRATION_SELF_TEST_EXECUTION_DIST_DRIFT: fault },
        fault === "runtime-resolution"
          ? "migration-dist-workspace-resolution-drift"
          : "migration-dist-execution-tree-drift-during-run",
      );
    }

    for (const [label, fault] of [
      ["build-source-content", "runtime-source"],
      ["build-source-identity", "runtime-source-replace"],
      ["build-source-addition", "runtime-source-addition"],
    ]) {
      expectFormalBlocked(
        label,
        { INFINITE_FLOW_MIGRATION_SELF_TEST_BUILD_SOURCE_DRIFT: fault },
        fault === "runtime-source-addition"
          ? "migration-build-source-path-set-drift"
          : fault === "runtime-source-replace"
            ? "migration-build-source-tree-drift-during-run"
            : "migration-build-source-content-drift",
      );
    }

    const copiedNodeDirectory = resolve(
      repository,
      "node_modules/.migration-self-check-node",
    );
    mkdirSync(copiedNodeDirectory, { recursive: true, mode: 0o700 });
    const copiedNodeExecutables = {};
    for (const fault of ["content", "identity", "resolution"]) {
      const executable = resolve(copiedNodeDirectory, `node-${fault}`);
      cpSync(process.execPath, executable, { force: false });
      chmodSync(executable, statSync(process.execPath).mode & 0o777);
      copiedNodeExecutables[fault] = executable;
    }
    for (const fault of ["content", "identity", "resolution"]) {
      expectFormalBlocked(
        `node-${fault}-drift`,
        { INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT: `node-${fault}` },
        `migration-build-node-${fault}-drift`,
        "AC-HASH-001",
        copiedNodeExecutables[fault],
      );
    }

    const configuredNpmCli = process.env.npm_execpath ?? "";
    assert(configuredNpmCli.length > 0, "self-check is launched by the locked npm CLI");
    const canonicalNpmCli = realpathSync(configuredNpmCli);
    const canonicalNpmRoot = dirname(dirname(canonicalNpmCli));
    const npmCliRelativePath = relative(canonicalNpmRoot, canonicalNpmCli);
    assert(
      npmCliRelativePath !== ""
        && npmCliRelativePath !== ".."
        && !npmCliRelativePath.startsWith(`..${sep}`),
      "npm CLI resolves inside its package root",
    );
    const copiedNpmRoot = resolve(
      repository,
      "node_modules/.migration-self-check-npm",
    );
    copyPath(canonicalNpmRoot, copiedNpmRoot);
    const copiedNpmCli = resolve(copiedNpmRoot, npmCliRelativePath);
    for (const fault of ["content", "identity", "resolution"]) {
      expectFormalBlocked(
        `npm-${fault}-drift`,
        {
          INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT: `npm-${fault}`,
          npm_execpath: copiedNpmCli,
        },
        `migration-build-npm-${fault}-drift`,
      );
    }

    for (const fault of ["content", "identity", "resolution"]) {
      expectFormalBlocked(
        `typescript-${fault}-drift`,
        {
          INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT:
            `typescript-${fault}`,
        },
        `migration-build-typescript-${fault}-drift`,
      );
    }

    expectFormalBlocked(
      "esbuild-binary-runtime-drift",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_TOOLCHAIN_DRIFT:
          "esbuild-binary-content",
      },
      "migration-build-esbuild-binary-drift",
      "AC-ASSET-002",
    );

    const postWriteDist = expectFormalBlocked(
      "post-write-dist-drift",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT: "runtime-index" },
      "migration-dist-candidate-tree-drift-during-run",
    );
    equal(
      existsSync(join(postWriteDist.directory, "identity-attestation.json")),
      false,
      "write-window dist drift receives no stable identity seal",
    );
    equal(
      existsSync(join(postWriteDist.directory, "identity-drift.json")),
      true,
      "write-window dist drift persists an invalidation marker",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const postWriteIdentity = expectFormalBlocked(
      "post-write-dist-identity",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT:
          "runtime-index-replace",
      },
      "migration-dist-candidate-tree-drift-during-run",
    );
    equal(
      existsSync(join(postWriteIdentity.directory, "identity-attestation.json")),
      false,
      "write-window identity replacement receives no seal",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const postWriteResolution = expectFormalBlocked(
      "post-write-dist-resolution",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIST_DRIFT:
          "runtime-resolution",
      },
      "migration-dist-workspace-resolution-drift",
    );
    equal(
      existsSync(join(postWriteResolution.directory, "identity-attestation.json")),
      false,
      "write-window resolution drift receives no seal",
    );
    unlinkSync(runtimeResolution);
    symlinkSync(resolve(repository, "packages/runtime"), runtimeResolution, "dir");

    const postAttestationDist = expectFormalBlocked(
      "post-attestation-dist-drift",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_ATTESTATION_DIST_DRIFT:
          "runtime-index",
      },
      "migration-dist-candidate-tree-drift-during-run",
    );
    equal(
      existsSync(join(postAttestationDist.directory, "identity-attestation.json")),
      false,
      "attestation-window drift never promotes the provisional identity seal",
    );
    equal(
      existsSync(join(postAttestationDist.directory, "identity-drift.json")),
      true,
      "attestation-window drift invalidates that seal with a marker",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const postHardlinkDist = expectFormalBlocked(
      "post-hardlink-dist-drift",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_FINAL_SEAL_DIST_DRIFT:
          "runtime-index",
      },
      "migration-dist-candidate-tree-drift-during-run",
    );
    equal(
      existsSync(join(postHardlinkDist.directory, "identity-attestation.json")),
      false,
      "post-hardlink drift deletes or withholds the final seal",
    );
    equal(
      existsSync(join(postHardlinkDist.directory, "identity-drift.json")),
      true,
      "post-hardlink drift persists the invalidation marker",
    );
    writeFileSync(runtimeIndex, runtimeIndexBytes);

    const cleanupFailure = expectFormalBlocked(
      "cleanup-failure",
      { INFINITE_FLOW_MIGRATION_SELF_TEST_CLEANUP_FAILURE: "1" },
      "migration-build-cleanup-failed",
    );
    equal(
      existsSync(join(cleanupFailure.directory, "identity-attestation.json")),
      false,
      "cleanup failure never publishes the final seal",
    );
    equal(
      existsSync(join(cleanupFailure.directory, "identity-drift.json")),
      true,
      "cleanup failure persists an invalidation marker",
    );

    const postBuildSource = expectFormalBlocked(
      "post-build-source-drift",
      {
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_BUILD_DIRTY:
          "post-build-source-drift.txt",
      },
      "migration-build-candidate-identity-drift",
    );
    equal(
      existsSync(join(postBuildSource.directory, "identity-drift.json")),
      true,
      "build-window source drift persists an invalidation marker",
    );
    unlinkSync(resolve(repository, "post-build-source-drift.txt"));
    equal(runGit(repository, ["status", "--porcelain=v1"]), "", "source drift fixture restored");

    const runtimeSource = resolve(repository, "packages/runtime/src/index.ts");
    const runtimeSourceBytes = readFileSync(runtimeSource);
    appendFileSync(
      runtimeSource,
      '\nexport const MIGRATION_SELF_CHECK_SOURCE_REVISION = "commit-b";\n',
    );
    runGit(repository, ["add", "packages/runtime/src/index.ts"]);
    runGit(repository, ["commit", "--quiet", "-m", "source commit B"]);
    equal(runGit(repository, ["status", "--porcelain=v1"]), "", "commit B is clean");
    const stale = expectFormalBlocked(
      "stale-dist-from-commit-a",
      {},
      "migration-dist-does-not-match-clean-rebuild",
    );
    equal(
      stale.outcome.report.executionAttestation.reasonCode,
      "migration-dist-does-not-match-clean-rebuild",
      "stale commit-A dist is rejected against commit-B source",
    );
    writeFileSync(runtimeSource, runtimeSourceBytes);
    runGit(repository, ["add", "packages/runtime/src/index.ts"]);
    runGit(repository, ["commit", "--quiet", "-m", "restore source"]);

    appendFileSync(runtimeSource, "\nexport const = broken build;\n");
    runGit(repository, ["add", "packages/runtime/src/index.ts"]);
    runGit(repository, ["commit", "--quiet", "-m", "broken build input"]);
    const buildFailure = expectFormalBlocked(
      "build-failure",
      {},
      "migration-build-command-failed-runtime",
    );
    assert(
      buildFailure.outcome.report.executionAttestation.reasonCode.startsWith(
        "migration-build-command-failed-",
      ),
      "failed clean-HEAD build has no valid execution seal",
    );
    writeFileSync(runtimeSource, runtimeSourceBytes);
    runGit(repository, ["add", "packages/runtime/src/index.ts"]);
    runGit(repository, ["commit", "--quiet", "-m", "restore build input"]);
    equal(runGit(repository, ["status", "--porcelain=v1"]), "", "negative fixtures restore clean state");

    const occupiedFaultParent = join(temporaryRoot, "occupied-fault-parent");
    mkdirSync(occupiedFaultParent, { mode: 0o700 });
    const occupiedSentinel = join(occupiedFaultParent, "sentinel.txt");
    writeFileSync(occupiedSentinel, "occupied parent sentinel\n", { mode: 0o600 });
    const occupiedBefore = directorySnapshot(occupiedFaultParent);
    const occupiedSentinelBefore = hash(readFileSync(occupiedSentinel));
    const occupiedEvidence = join(occupiedFaultParent, "candidate");
    const occupiedMovedParent = `${occupiedFaultParent}.self-test-moved`;
    const occupied = invoke(
      ["--ac", "AC-HASH-001", "--evidence", occupiedEvidence],
      {
        ...selfTestEnvironment,
        INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT: "parent-rename",
      },
    );
    equal(occupied.status, 64, "occupied fault parent exits 64 before evidence creation");
    equal(
      occupied.report.error.code,
      "self-test-evidence-sacrifice-exists",
      "occupied fault parent has the exact rejection code",
    );
    equal(
      JSON.stringify(directorySnapshot(occupiedFaultParent)),
      JSON.stringify(occupiedBefore),
      "occupied fault parent preserves identity and entries",
    );
    equal(
      hash(readFileSync(occupiedSentinel)),
      occupiedSentinelBefore,
      "occupied fault parent preserves content bytes",
    );
    equal(existsSync(occupiedEvidence), false, "occupied fault parent gets no evidence child");
    equal(existsSync(occupiedMovedParent), false, "occupied fault parent is never moved");
    equal(
      lstatSync(occupiedFaultParent).isSymbolicLink(),
      false,
      "occupied fault parent remains a real directory",
    );
    rmSync(occupiedFaultParent, { recursive: true, force: true });

    const reservedFaultParent = join(temporaryRoot, "reserved-fault-parent");
    const reservedMovedParent = `${reservedFaultParent}.self-test-moved`;
    mkdirSync(reservedMovedParent, { mode: 0o700 });
    const reservedSentinel = join(reservedMovedParent, "sentinel.txt");
    writeFileSync(reservedSentinel, "reserved moved target sentinel\n", { mode: 0o600 });
    const reservedBefore = directorySnapshot(reservedMovedParent);
    const reservedSentinelBefore = hash(readFileSync(reservedSentinel));
    const reservedEvidence = join(reservedFaultParent, "candidate");
    const reserved = invoke(
      ["--ac", "AC-HASH-001", "--evidence", reservedEvidence],
      {
        ...selfTestEnvironment,
        INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT: "parent-symlink-to-repository",
      },
    );
    equal(reserved.status, 64, "reserved moved target exits 64 before parent creation");
    equal(
      reserved.report.error.code,
      "self-test-evidence-moved-target-exists",
      "reserved moved target has the exact rejection code",
    );
    equal(existsSync(reservedFaultParent), false, "reserved moved target creates no parent");
    equal(existsSync(reservedEvidence), false, "reserved moved target creates no evidence");
    equal(
      JSON.stringify(directorySnapshot(reservedMovedParent)),
      JSON.stringify(reservedBefore),
      "reserved moved target preserves identity and entries",
    );
    equal(
      hash(readFileSync(reservedSentinel)),
      reservedSentinelBefore,
      "reserved moved target preserves content bytes",
    );
    equal(
      lstatSync(reservedMovedParent).isSymbolicLink(),
      false,
      "reserved moved target remains a real directory",
    );
    rmSync(reservedMovedParent, { recursive: true, force: true });

    const externalRoot = mkdtempSync(join(tmpdir(), "infinite-flow-migration-outside-"));
    try {
      const externalParent = join(externalRoot, "must-remain-unchanged");
      mkdirSync(externalParent, { mode: 0o700 });
      const externalSentinel = join(externalParent, "sentinel.txt");
      writeFileSync(externalSentinel, "outside sandbox sentinel\n", { mode: 0o600 });
      const externalBefore = directorySnapshot(externalParent);
      const externalSentinelBefore = hash(readFileSync(externalSentinel));
      for (const [label, fault] of [
        ["outside-parent-rename", "parent-rename"],
        ["outside-parent-symlink", "parent-symlink-to-repository"],
      ]) {
        const externalEvidence = join(externalParent, `${label}-evidence`);
        const externalMovedParent = `${externalParent}.self-test-moved`;
        const escaped = invoke(
          ["--ac", "AC-HASH-001", "--evidence", externalEvidence],
          {
            ...selfTestEnvironment,
            INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT: fault,
          },
        );
        equal(escaped.status, 64, `${label} exits 64 before fault injection`);
        equal(
          escaped.report.error.code,
          "self-test-evidence-sandbox-escape",
          `${label} has the exact sandbox rejection code`,
        );
        equal(
          JSON.stringify(directorySnapshot(externalParent)),
          JSON.stringify(externalBefore),
          `${label} preserves the external parent identity and entries`,
        );
        equal(
          hash(readFileSync(externalSentinel)),
          externalSentinelBefore,
          `${label} preserves external content bytes`,
        );
        equal(existsSync(externalEvidence), false, `${label} creates no evidence directory`);
        equal(existsSync(externalMovedParent), false, `${label} creates no moved target`);
        equal(
          lstatSync(externalParent).isSymbolicLink(),
          false,
          `${label} leaves no external symlink`,
        );
      }
    } finally {
      rmSync(externalRoot, { recursive: true, force: true });
    }

    const rootBoundaryBefore = directorySnapshot(temporaryRoot);
    for (const [label, fault] of [
      ["root-parent-rename", "parent-rename"],
      ["root-parent-symlink", "parent-symlink-to-repository"],
    ]) {
      const rootEvidence = join(temporaryRoot, `${label}-evidence`);
      const escapedMovedRoot = `${temporaryRoot}.self-test-moved`;
      const escaped = invoke(
        ["--ac", "AC-HASH-001", "--evidence", rootEvidence],
        {
          ...selfTestEnvironment,
          INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT: fault,
        },
      );
      equal(escaped.status, 64, `${label} exits 64 before root rename`);
      equal(
        escaped.report.error.code,
        "self-test-evidence-sandbox-escape",
        `${label} rejects a moved target outside the sandbox root`,
      );
      equal(
        JSON.stringify(directorySnapshot(temporaryRoot)),
        JSON.stringify(rootBoundaryBefore),
        `${label} preserves the sandbox root identity and entries`,
      );
      equal(existsSync(rootEvidence), false, `${label} creates no root-level evidence`);
      equal(existsSync(escapedMovedRoot), false, `${label} creates no escaped moved root`);
      equal(
        lstatSync(temporaryRoot).isSymbolicLink(),
        false,
        `${label} leaves the sandbox root as a real directory`,
      );
    }

    for (const [label, fault] of [
      ["evidence-parent-rename", "parent-rename"],
      ["evidence-parent-symlink", "parent-symlink-to-repository"],
    ]) {
      const parent = join(temporaryRoot, `${label}-parent`);
      const directory = join(parent, `${label}-evidence`);
      const movedParent = `${parent}.self-test-moved`;
      const boundaryOutcome = invoke(
        ["--ac", "AC-HASH-001", "--evidence", directory],
        {
          ...selfTestEnvironment,
          INFINITE_FLOW_MIGRATION_SELF_TEST_EVIDENCE_BOUNDARY_DRIFT: fault,
        },
      );
      equal(boundaryOutcome.status, 2, `${label} exits BLOCKED`);
      equal(boundaryOutcome.report.status, "BLOCKED", `${label} result is BLOCKED`);
      equal(
        boundaryOutcome.report.error.code,
        "evidence-boundary-drift",
        `${label} has the exact boundary reason code`,
      );
      equal(
        existsSync(resolve(repository, `${label}-evidence`)),
        false,
        `${label} writes no evidence inside the repository`,
      );
      equal(existsSync(movedParent), true, `${label} retains the moved sacrifice directory`);
      equal(
        lstatSync(movedParent).isDirectory(),
        true,
        `${label} moved target is a real directory`,
      );
      equal(
        existsSync(join(movedParent, `${label}-evidence`)),
        true,
        `${label} moved target contains only the sacrificial evidence directory`,
      );
      if (fault === "parent-rename") {
        equal(existsSync(parent), false, `${label} leaves the original parent absent`);
      } else {
        equal(
          lstatSync(parent).isSymbolicLink(),
          true,
          `${label} retains the intentional in-sandbox fault symlink`,
        );
        equal(
          realpathSync.native(parent),
          realpathSync.native(repository),
          `${label} fault symlink targets only the sandbox repository`,
        );
      }
    }

    const driftDirectory = join(temporaryRoot, "candidate-drift");
    const drifted = invoke(
      ["--ac", "AC-HASH-001", "--evidence", driftDirectory],
      {
        ...selfTestEnvironment,
        INFINITE_FLOW_MIGRATION_SELF_TEST_POST_WRITE_DIRTY: "post-write-drift.txt",
      },
    );
    equal(drifted.status, 2, "post-write git identity drift exits 2");
    equal(drifted.report.status, "BLOCKED", "post-write identity drift is BLOCKED");
    equal(
      drifted.report.candidate.releaseEligible,
      false,
      "post-write identity drift revokes release eligibility",
    );
    equal(
      drifted.report.evidence.identityStatus,
      "DRIFTED",
      "post-write identity drift is explicit in the result",
    );
    equal(
      existsSync(join(driftDirectory, "identity-attestation.json")),
      false,
      "drifted evidence receives no stable identity attestation",
    );
    equal(
      existsSync(join(driftDirectory, "identity-drift.json")),
      true,
      "drifted evidence receives an invalidation marker",
    );
    const driftMarker = JSON.parse(
      readFileSync(join(driftDirectory, "identity-drift.json"), "utf8"),
    );
    equal(driftMarker.result.status, "BLOCKED", "drift marker embeds blocked result");
    equal(
      driftMarker.result.candidate.releaseEligible,
      false,
      "drift marker cannot claim release eligibility",
    );
    assert(
      runGit(repository, ["status", "--porcelain=v1"]).includes("post-write-drift.txt"),
      "post-write drift hook changed git identity before the recheck",
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

checkPassCases();
await checkAssetManifestExtensionBoundaries();
checkMethodRegistrations();
checkMultiMethodIsolation();
checkExitTaxonomy();
checkStableDigest();
checkExclusiveEvidence();

const EXPECTED_ASSERTIONS = 929;
if (assertions !== EXPECTED_ASSERTIONS) {
  throw new Error(
    `Assertion count drifted; expected ${EXPECTED_ASSERTIONS}, received ${assertions}`,
  );
}

console.log(
  JSON.stringify({
    ok: true,
    assertions,
    suites: [
      "pass-cases",
      "asset-manifest-extension-boundaries",
      "method-registration-capabilities",
      "multi-method-pass-isolation",
      "exit-taxonomy",
      "stable-canonical-digest",
      "exclusive-evidence",
      "clean-head-rebuild-attestation",
      "ignored-dist-negative-matrix",
      "import-case-write-attestation-drift",
      "source-drift-and-build-failure",
      "clean-post-write-identity",
      "trusted-git-and-node-process-boundary",
      "git-reachable-object-and-blob-oid-boundary",
      "node-npm-typescript-content-identity-resolution-drift",
      "execution-and-candidate-dist-drift",
      "materialized-source-and-import-graph",
      "esbuild-binary-and-cleanup-boundary",
      "evidence-directory-boundary",
      "self-test-release-ineligibility",
    ],
  }),
);
