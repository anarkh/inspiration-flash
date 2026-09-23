import assert from "node:assert/strict";
import {
  assertBuildConfigVerificationUnchanged,
  assertBuildSourceUnchanged,
  assertDistTreeUnchanged,
  assertFreshBuildOutput,
  assertGitCandidateUnchanged,
  attestAbsentOutputRoot,
  createDistTreeAttestationFromEntries,
  createGitCandidateFromProbe,
} from "./build-subject-attestation.mjs";

const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const ROOT = "/fixture/repository";
const OUTPUT = "/fixture/repository/infinite-flow-wechat/cocos/build/wechatgame";
let assertions = 0;

function expectCode(code, callback) {
  assert.throws(callback, (error) => error?.code === code);
  assertions += 1;
}

function cleanCandidate(overrides = {}, options) {
  return createGitCandidateFromProbe({
    gitRoot: ROOT,
    head: HEAD,
    tree: TREE,
    status: Buffer.alloc(0),
    ...overrides,
  }, options);
}

function distEntry(path, hashCharacter, inode, bytes = 4) {
  return Object.freeze({
    kind: "file",
    path,
    bytes,
    sha256: hashCharacter.repeat(64),
    identity: Object.freeze({
      device: "1",
      inode: String(inode),
      mode: "33188",
      size: String(bytes),
      modifiedNs: "100",
      changedNs: "100",
    }),
  });
}

const clean = cleanCandidate();
assert.equal(clean.clean, true);
assert.equal(clean.statusBytes, 0);
assert.equal(assertGitCandidateUnchanged(clean, clean), clean);
assertions += 3;

expectCode("git-candidate-not-clean", () => cleanCandidate({
  status: " M infinite-flow-wechat/package.json\0",
}));
expectCode("git-candidate-not-clean", () => cleanCandidate({
  status: "?? local-untracked.txt\0",
}));

for (const [field, value, code] of [
  ["head", "3".repeat(40), "git-candidate-head-drift"],
  ["tree", "4".repeat(40), "git-candidate-tree-drift"],
  ["status", "?? drift.txt\0", "git-candidate-status-bytes-drift"],
]) {
  const changed = cleanCandidate({ [field]: value }, { requireClean: false });
  expectCode(code, () => assertGitCandidateUnchanged(clean, changed));
}
const sameLengthStatusDrift = cleanCandidate({
  status: "?? other.txt\0",
}, { requireClean: false });
expectCode(
  "git-candidate-status-sha256-drift",
  () => assertGitCandidateUnchanged(
    cleanCandidate({ status: "?? drift.txt\0" }, { requireClean: false }),
    sameLengthStatusDrift,
  ),
);

const configVerification = Object.freeze({
  configCanonicalPath: "/fixture/config.local.json",
  configSha256: "5".repeat(64),
  profileSha256: "6".repeat(64),
  mode: "remote",
  releaseEligible: true,
});
expectCode("build-config-profileSha256-drift", () => (
  assertBuildConfigVerificationUnchanged(configVerification, {
    ...configVerification,
    profileSha256: "7".repeat(64),
  })
));
expectCode("build-config-configSha256-drift", () => (
  assertBuildConfigVerificationUnchanged(configVerification, {
    ...configVerification,
    configSha256: "8".repeat(64),
  })
));

const sourceAttestation = Object.freeze({
  manifestRevision: "sha256:fixture",
  manifestSha256: "9".repeat(64),
  manifestIdentitySha256: "c".repeat(64),
  assetCount: 187,
  resourceBytes: 22_301_279,
  assetIdentitySha256: "a".repeat(64),
});
expectCode("build-source-assetIdentitySha256-drift", () => (
  assertBuildSourceUnchanged(sourceAttestation, {
    ...sourceAttestation,
    assetIdentitySha256: "b".repeat(64),
  })
));

const distEntries = [
  distEntry("packages/core/dist/index.js", "1", 11),
  distEntry("packages/runtime/dist/index.js", "2", 12),
];
const distTree = createDistTreeAttestationFromEntries(distEntries);
expectCode("build-dist-contentTreeSha256-drift", () => (
  assertDistTreeUnchanged(distTree, createDistTreeAttestationFromEntries([
    distEntry("packages/core/dist/index.js", "3", 11),
    distEntries[1],
  ]))
));
expectCode("build-dist-fileCount-drift", () => (
  assertDistTreeUnchanged(distTree, createDistTreeAttestationFromEntries([
    ...distEntries,
    distEntry("packages/client/dist/index.js", "4", 13),
  ]))
));
expectCode("build-dist-fileCount-drift", () => (
  assertDistTreeUnchanged(
    distTree,
    createDistTreeAttestationFromEntries([distEntries[0]]),
  )
));
expectCode("build-dist-contentTreeSha256-drift", () => (
  assertDistTreeUnchanged(distTree, createDistTreeAttestationFromEntries([
    distEntries[0],
    distEntry("packages/runtime/dist/renamed.js", "2", 12),
  ]))
));
expectCode("build-dist-identityTreeSha256-drift", () => (
  assertDistTreeUnchanged(distTree, createDistTreeAttestationFromEntries([
    distEntries[0],
    distEntry("packages/runtime/dist/index.js", "2", 99),
  ]))
));
expectCode("build-dist-special-object-forbidden", () => (
  createDistTreeAttestationFromEntries([{
    ...distEntries[0],
    kind: "symlink",
  }])
));

expectCode("build-output-preexisting", () => attestAbsentOutputRoot(OUTPUT, {
  inspectOutputRoot: () => ({
    exists: true,
    directory: true,
    symbolicLink: false,
  }),
}));

const absent = attestAbsentOutputRoot(OUTPUT, {
  inspectOutputRoot: () => ({
    exists: false,
    directory: false,
    symbolicLink: false,
  }),
});
expectCode("build-output-not-created", () => assertFreshBuildOutput({
  attestation: absent,
  result: { status: 36, signal: null, error: null },
  successExitCode: 36,
  inspectOutputRoot: () => ({
    exists: false,
    directory: false,
    symbolicLink: false,
  }),
}));

const fresh = assertFreshBuildOutput({
  attestation: absent,
  result: { status: 36, signal: null, error: null },
  successExitCode: 36,
  inspectOutputRoot: () => ({
    exists: true,
    directory: true,
    symbolicLink: false,
  }),
});
assert.deepEqual(fresh, {
  ok: true,
  outputRoot: OUTPUT,
  createdByBuildWindow: true,
});
assertions += 1;

console.log(JSON.stringify({
  ok: true,
  suites: 11,
  assertions,
  creatorInvoked: false,
  filesystemMutated: false,
}, null, 2));
