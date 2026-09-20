import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertTemplateNonReleaseEligibility,
  createTemplateBuildSuccessSummary,
  runWechatTemplateBuild,
} from "./build-wechat-template.mjs";
import {
  assertTemplateBuildCandidateContentUnchanged,
  assertTemplateBuildCandidateUnchanged,
  captureTemplateBuildCandidate,
  createTemplateCandidateFromEntries,
} from "./template-build-candidate.mjs";

let assertions = 0;
let suites = 0;

function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}

function checkOk(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function expectCode(run, expectedCode) {
  let caught;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  checkOk(caught instanceof Error, "expected an error");
  check(caught.code, expectedCode);
}

function git(repository, args) {
  const result = spawnSync(
    "/usr/bin/git",
    ["--no-optional-locks", "-C", repository, ...args],
    {
      encoding: "utf8",
      env: {
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_NO_REPLACE_OBJECTS: "1",
        GIT_OPTIONAL_LOCKS: "0",
        HOME: "/var/empty",
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixtureIdentity(seed, bytes) {
  return {
    device: seed,
    inode: `${Number(seed) + 1}`,
    mode: "33188",
    size: String(bytes),
    modifiedNs: `${Number(seed) + 2}`,
    changedNs: `${Number(seed) + 3}`,
  };
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "if-wechat-template-build-test-"));
try {
  {
    const candidate = createTemplateCandidateFromEntries({
      head: "a".repeat(40),
      tree: "b".repeat(40),
      status: Buffer.from("dirty", "utf8"),
      inventory: Buffer.from("project/a.txt\0project/deleted.txt\0", "utf8"),
      entries: [{
        path: "project/a.txt",
        kind: "file",
        bytes: 3,
        sha256: "c".repeat(64),
        identity: fixtureIdentity("10", 3),
      }, {
        path: "project/deleted.txt",
        kind: "absent",
        bytes: 0,
        sha256: null,
      }],
    });
    check(candidate.entryCount, 2);
    check(candidate.fileCount, 1);
    check(candidate.absentCount, 1);
    check(candidate.totalBytes, 3);
    check(candidate.statusBytes, 5);
    checkOk(/^[0-9a-f]{64}$/.test(candidate.contentTreeSha256));
    checkOk(/^[0-9a-f]{64}$/.test(candidate.identityTreeSha256));
    expectCode(() => createTemplateCandidateFromEntries({
      head: candidate.head,
      tree: candidate.tree,
      status: Buffer.alloc(0),
      inventory: Buffer.alloc(0),
      entries: [],
    }), "template-candidate-entries-required");
    suites += 1;
  }

  {
    const repository = join(temporaryRoot, "repository");
    const project = join(repository, "infinite-flow-wechat");
    mkdirSync(project, { recursive: true, mode: 0o700 });
    writeFileSync(join(project, ".gitignore"), "ignored.tmp\n", "utf8");
    writeFileSync(join(project, "tracked.txt"), "tracked-v1\n", "utf8");
    writeFileSync(join(project, "deleted.txt"), "delete-me\n", "utf8");
    git(repository, ["init", "-q"]);
    git(repository, ["add", "infinite-flow-wechat"]);
    git(repository, [
      "-c", "user.name=Template Test",
      "-c", "user.email=template@example.invalid",
      "commit", "-q", "-m", "fixture",
    ]);
    writeFileSync(join(project, "tracked.txt"), "tracked-v2\n", "utf8");
    unlinkSync(join(project, "deleted.txt"));
    writeFileSync(join(project, "untracked.txt"), "untracked\n", "utf8");

    const first = captureTemplateBuildCandidate({
      repositoryRoot: repository,
      projectRoot: project,
    });
    const second = captureTemplateBuildCandidate({
      repositoryRoot: repository,
      projectRoot: project,
    });
    assertTemplateBuildCandidateUnchanged(first, second);
    check(first.entryCount, 4);
    check(first.fileCount, 3);
    check(first.absentCount, 1);
    checkOk(first.statusBytes > 0);
    check(first.contentTreeSha256, second.contentTreeSha256);
    check(first.identityTreeSha256, second.identityTreeSha256);

    writeFileSync(join(project, "ignored.tmp"), "ignored mutation\n", "utf8");
    const afterIgnored = captureTemplateBuildCandidate({
      repositoryRoot: repository,
      projectRoot: project,
    });
    assertTemplateBuildCandidateUnchanged(first, afterIgnored);
    check(first.contentTreeSha256, afterIgnored.contentTreeSha256);

    writeFileSync(join(project, "untracked.txt"), "changed\n", "utf8");
    const changed = captureTemplateBuildCandidate({
      repositoryRoot: repository,
      projectRoot: project,
    });
    expectCode(
      () => assertTemplateBuildCandidateUnchanged(first, changed),
      "template-candidate-total-bytes-drift",
    );
    expectCode(
      () => assertTemplateBuildCandidateContentUnchanged(first, changed),
      "template-candidate-total-bytes-drift",
    );

    symlinkSync("tracked.txt", join(project, "untracked-link"));
    expectCode(() => captureTemplateBuildCandidate({
      repositoryRoot: repository,
      projectRoot: project,
    }), "template-candidate-symlink-forbidden");
    unlinkSync(join(project, "untracked-link"));
    suites += 1;
  }

  {
    const config = {
      gate: "template",
      mode: "remote",
      releaseEligible: false,
      nonRelease: true,
      configSha256: "d".repeat(64),
      profileSha256: "e".repeat(64),
    };
    const output = {
      ...config,
      tracedAssets: 187,
      packageBytes: 100,
      bundleBytes: 200,
      treeSha256: "1".repeat(64),
      packageSha256: "2".repeat(64),
      bundleTreeSha256: "3".repeat(64),
    };
    check(assertTemplateNonReleaseEligibility(config), config);
    expectCode(() => assertTemplateNonReleaseEligibility({
      ...config,
      releaseEligible: true,
      nonRelease: false,
    }), "template-eligibility-invalid");
    const summaryCandidate = {
      head: "a".repeat(40),
      tree: "b".repeat(40),
      statusSha256: "c".repeat(64),
      entryCount: 4,
      fileCount: 3,
      absentCount: 1,
      totalBytes: 12,
      contentTreeSha256: "4".repeat(64),
      identityTreeSha256: "5".repeat(64),
    };
    const summary = createTemplateBuildSuccessSummary({
      creatorVersion: "3.8.8",
      candidate: summaryCandidate,
      postBuildCandidate: {
        ...summaryCandidate,
        identityTreeSha256: "6".repeat(64),
      },
      configVerification: config,
      outputVerification: output,
    });
    check(summary.label, "NON_RELEASE_TEMPLATE_BUILD_VALID");
    check(summary.releaseEligible, false);
    check(summary.nonRelease, true);
    check(summary.candidate.identityStable, false);
    check(summary.tracedAssets, 187);
    check(Object.hasOwn(summary, "outputPath"), false);
    check(Object.hasOwn(summary, "config"), false);
    suites += 1;
  }

  {
    expectCode(
      () => runWechatTemplateBuild({ environment: {} }),
      "template-creator-executable-missing",
    );
    expectCode(
      () => runWechatTemplateBuild({
        environment: { NODE_OPTIONS: "--experimental-loader=forbidden" },
      }),
      "template-runner-injection-environment-forbidden",
    );
    suites += 1;
  }

  console.log(JSON.stringify({
    ok: true,
    assertions,
    suites,
    creatorInvoked: false,
    releaseEligible: false,
    nonRelease: true,
  }, null, 2));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
