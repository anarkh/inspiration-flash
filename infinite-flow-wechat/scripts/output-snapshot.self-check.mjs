import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WechatBuildContractError,
} from "./verify-wechat-build-config.mjs";
import {
  verifyFrozenTreeSnapshotForTesting,
} from "./verify-wechat-build-output.mjs";

const temporaryRoot = mkdtempSync(join(tmpdir(), "if-output-snapshot-"));
let assertions = 0;

function fixture(name) {
  const root = join(temporaryRoot, name);
  mkdirSync(join(root, "assets", "config"), { recursive: true });
  writeFileSync(join(root, "game.json"), '{"marker":"game-A"}\n');
  writeFileSync(join(root, "project.config.json"), '{"marker":"project-A"}\n');
  writeFileSync(
    join(root, "assets", "config", "config.v1.json"),
    '{"marker":"config-A"}\n',
  );
  writeFileSync(join(root, "payload.bin"), Buffer.from([0, 1, 2, 3]));
  return root;
}

function frozenJsonPaths() {
  return [
    "game.json",
    "project.config.json",
    "assets/config/config.v1.json",
  ];
}

function expectContractFailure(run, allowedCodes, failurePattern) {
  let caught = null;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof WechatBuildContractError);
  assertions += 1;
  assert.ok(allowedCodes.includes(caught.code), `unexpected code: ${caught.code}`);
  assertions += 1;
  if (failurePattern) {
    assert.match(caught.failures.join("\n"), failurePattern);
    assertions += 1;
  }
  return caught;
}

function replaceWithSameLength(path, beforeMarker, afterMarker) {
  assert.equal(beforeMarker.length, afterMarker.length);
  assertions += 1;
  const replacement = `${path}.replacement`;
  writeFileSync(replacement, `{"marker":"${afterMarker}"}\n`);
  renameSync(replacement, path);
}

try {
  {
    const root = fixture("positive");
    const result = verifyFrozenTreeSnapshotForTesting({
      root,
      jsonPaths: frozenJsonPaths(),
    });
    assert.equal(result.parsedJson.get("game.json").marker, "game-A");
    assertions += 1;
    assert.match(result.treeSha256, /^[0-9a-f]{64}$/);
    assertions += 1;
  }

  {
    const root = fixture("file-symlink");
    const external = join(temporaryRoot, "external-game.json");
    writeFileSync(external, '{"marker":"game-A"}\n');
    unlinkSync(join(root, "game.json"));
    symlinkSync(external, join(root, "game.json"));
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({ root }),
      ["build-output-snapshot-unstable"],
      /symlink-forbidden|stable-no-follow-capture-required/,
    );
  }

  {
    const target = fixture("root-symlink-target");
    const root = join(temporaryRoot, "root-symlink");
    symlinkSync(target, root);
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({ root }),
      ["build-output-snapshot-unstable"],
      /real-directory-required/,
    );
  }

  for (const replacement of [
    { path: "game.json", before: "game-A", after: "game-B" },
    {
      path: "project.config.json",
      before: "project-A",
      after: "project-B",
    },
    {
      path: "assets/config/config.v1.json",
      before: "config-A",
      after: "config-B",
    },
  ]) {
    const root = fixture(`replace-${replacement.before}`);
    let observedFrozenMarker = null;
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        jsonPaths: frozenJsonPaths(),
        hooks: {
          afterInitialCapture() {
            replaceWithSameLength(
              join(root, ...replacement.path.split("/")),
              replacement.before,
              replacement.after,
            );
          },
          afterSemanticParse({ parsedJson }) {
            observedFrozenMarker = parsedJson.get(replacement.path).marker;
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /identity-stable-required|bytes-stable-required/,
    );
    assert.equal(observedFrozenMarker, replacement.before);
    assertions += 1;
  }

  {
    const root = fixture("path-add");
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        hooks: {
          afterSemanticParse() {
            writeFileSync(join(root, "late-file.txt"), "late\n");
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /path-set-stable-required/,
    );
  }

  {
    const root = fixture("path-delete");
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        hooks: {
          afterSemanticParse() {
            unlinkSync(join(root, "payload.bin"));
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /path-set-stable-required/,
    );
  }

  {
    const root = fixture("content-drift");
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        hooks: {
          afterSemanticParse() {
            writeFileSync(join(root, "payload.bin"), Buffer.from([3, 2, 1, 0]));
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /identity-stable-required|bytes-stable-required|fingerprint-stable-required/,
    );
  }

  {
    const root = fixture("directory-drift");
    const moved = join(temporaryRoot, "directory-drift-original-assets");
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        hooks: {
          afterSemanticParse() {
            renameSync(join(root, "assets"), moved);
            cpSync(moved, join(root, "assets"), { recursive: true });
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /directories:.*identity-stable-required/,
    );
  }

  {
    const root = fixture("root-identity-drift");
    const moved = join(temporaryRoot, "root-identity-drift-original");
    expectContractFailure(
      () => verifyFrozenTreeSnapshotForTesting({
        root,
        hooks: {
          afterSemanticParse() {
            renameSync(root, moved);
            cpSync(moved, root, { recursive: true });
          },
        },
      }),
      ["build-output-snapshot-drift"],
      /root:canonical-identity-stable-required/,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    assertions,
    suites: 11,
  }, null, 2));
} finally {
  // This is the exact mkdtemp-owned directory, never a caller-provided path.
  rmSync(temporaryRoot, { recursive: true, force: true });
}
