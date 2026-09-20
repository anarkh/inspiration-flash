// Self-check for the NON_RELEASE DevTools smoke vertical slice.
//
// Derives a throwaway copy, starts the loopback server on an ephemeral port,
// and asserts:
//   - the derived copy is marked NON_RELEASE and points at loopback only;
//   - the 22 MB remote bundle is not folded back into the main package;
//   - the versioned remote config and a native asset are served correctly;
//   - traversal, symlink, directory-listing and non-GET requests are refused;
//   - the verified source build is byte-for-byte unchanged.
//
// Exit code is non-zero on the first failed assertion.

import { createHash } from "node:crypto";
import http from "node:http";
import { existsSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  GAME_TOURIST_APPID,
  LOOPBACK_HOST,
  SMOKE_DIR_BASENAME,
  deriveDevtoolsSmoke,
  treeSha256,
} from "./derive-devtools-smoke.mjs";
import { createLoopbackServer } from "./loopback-static-server.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(projectRoot, "cocos/build/wechatgame");
const selfcheckDest = resolve(projectRoot, "cocos/build", `${SMOKE_DIR_BASENAME}.selfcheck`);

const checks = [];
let failed = false;

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) failed = true;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function findSettingsFile(root) {
  const matches = readdirSync(join(root, "src")).filter(
    (name) => /^settings(?:\.[0-9a-z_-]+)?\.json$/i.test(name),
  );
  if (matches.length !== 1) throw new Error(`settings not unique: ${matches}`);
  return join(root, "src", matches[0]);
}

async function httpGet(port, path, { method = "GET" } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = http.request({
      host: LOOPBACK_HOST,
      port,
      path,
      method,
      headers: { Connection: "close" },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolvePromise({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.on("error", rejectPromise);
    request.end();
  });
}

async function main() {
  // The verified build must exist and is fingerprinted before any work.
  const sourceBefore = treeSha256(sourceRoot);

  // Re-derive into the throwaway self-check dest on an ephemeral port.
  const derived = deriveDevtoolsSmoke({
    sourceRoot,
    destRoot: selfcheckDest,
    port: 0,
    force: true,
  });

  check("derive.label", derived.label === "NON_RELEASE_DEVTOOLS_SMOKE_DERIVED");
  check("derive.nonRelease", derived.nonRelease === true);
  check("derive.releaseEligible", derived.releaseEligible === false);
  check("derive.sourceHash", derived.sourceTreeSha256 === sourceBefore);

  // project.config.json: tourist AppID + urlCheck off.
  const projectConfig = readJson(join(selfcheckDest, "project.config.json"));
  check("projectConfig.appid", projectConfig.appid === GAME_TOURIST_APPID,
    `got ${projectConfig.appid}`);
  check("projectConfig.urlCheckOff", projectConfig.setting?.urlCheck === false);
  check("projectConfig.compileTypeGame", projectConfig.compileType === "game");

  // settings: remote server points at loopback, remote bundle stays remote.
  const settings = readJson(findSettingsFile(selfcheckDest));
  const expectedServer = `http://${LOOPBACK_HOST}:0/`;
  check("settings.serverLoopback", settings.assets?.server === expectedServer,
    `got ${settings.assets?.server}`);
  check("settings.remoteBundles", Array.isArray(settings.assets?.remoteBundles)
    && settings.assets.remoteBundles.includes("resources"));
  const resourcesVersion = settings.assets?.bundleVers?.resources;
  check("settings.resourcesVersion", typeof resourcesVersion === "string"
    && /^[0-9a-z_-]+$/i.test(resourcesVersion), `got ${resourcesVersion}`);

  // Markers.
  check("marker.nonReleaseFile", existsSync(join(selfcheckDest, "NON_RELEASE_SMOKE.md")));
  const derivedManifest = readJson(join(selfcheckDest, "devtools-smoke.derived.json"));
  check("marker.manifestNonRelease", derivedManifest.nonRelease === true
    && derivedManifest.releaseEligible === false
    && derivedManifest.notForProductionEvidence === true);
  check("marker.manifestSourceHash", derivedManifest.derivedFromTreeSha256 === sourceBefore);

  // The 22 MB remote bundle must not be folded back into the main package.
  check("layout.assetsResourcesAbsent", !existsSync(join(selfcheckDest, "assets", "resources")));
  check("layout.remoteResourcesPresent", existsSync(join(selfcheckDest, "remote", "resources")));
  check("layout.bundleScriptInMainPackage", existsSync(
    join(selfcheckDest, "src", "bundle-scripts", "resources", `index.${resourcesVersion}.js`),
  ));

  // Start the loopback server on the derived remote tree.
  const remoteRoot = join(selfcheckDest, "remote");
  const instance = createLoopbackServer({ root: remoteRoot, port: 0 });
  await instance.listen();
  const port = instance.address.port;
  check("server.boundToLoopback", instance.address.address === LOOPBACK_HOST,
    `bound to ${instance.address.address}`);

  try {
    // Positive: versioned remote config.
    const configPath = `/remote/resources/config.${resourcesVersion}.json`;
    const configResponse = await httpGet(port, configPath);
    const configOnDisk = readFileSync(join(remoteRoot, "resources", `config.${resourcesVersion}.json`));
    check("http.configStatus", configResponse.status === 200,
      `got ${configResponse.status}`);
    check("http.configContentType", String(configResponse.headers["content-type"]).includes("application/json"));
    check("http.configBody", sha256(configResponse.body) === sha256(configOnDisk));

    // Positive: a native asset (first file under native/).
    const nativeDir = join(remoteRoot, "resources", "native");
    let nativeRel = null;
    outer: for (const bucket of readdirSync(nativeDir).sort()) {
      for (const file of readdirSync(join(nativeDir, bucket)).sort()) {
        nativeRel = `resources/native/${bucket}/${file}`;
        break outer;
      }
    }
    check("http.nativeSampleFound", nativeRel !== null);
    if (nativeRel) {
      const nativeResponse = await httpGet(port, `/remote/${nativeRel}`);
      const nativeOnDisk = readFileSync(join(remoteRoot, nativeRel));
      check("http.nativeStatus", nativeResponse.status === 200,
        `got ${nativeResponse.status}`);
      check("http.nativeContentType", String(nativeResponse.headers["content-type"]).includes("image/png"));
      check("http.nativeBody", sha256(nativeResponse.body) === sha256(nativeOnDisk));
    }

    // Positive: an import asset.
    const importDir = join(remoteRoot, "resources", "import");
    let importRel = null;
    outer2: for (const bucket of readdirSync(importDir).sort()) {
      for (const file of readdirSync(join(importDir, bucket)).sort()) {
        importRel = `resources/import/${bucket}/${file}`;
        break outer2;
      }
    }
    if (importRel) {
      const importResponse = await httpGet(port, `/remote/${importRel}`);
      check("http.importStatus", importResponse.status === 200,
        `got ${importResponse.status}`);
    }

    // Negative: outside the prefix.
    const rootResponse = await httpGet(port, "/");
    check("negative.rootRefused", rootResponse.status === 403,
      `got ${rootResponse.status}`);
    const gameJsResponse = await httpGet(port, "/game.js");
    check("negative.gameJsRefused", gameJsResponse.status === 403,
      `got ${gameJsResponse.status}`);

    // Negative: traversal (encoded and plain).
    const traversalEncoded = await httpGet(port, "/remote/%2e%2e/%2e%2e/game.js");
    check("negative.traversalEncoded", traversalEncoded.status === 403,
      `got ${traversalEncoded.status}`);
    const traversalPlain = await httpGet(port, "/remote/resources/../../game.js");
    check("negative.traversalPlain", traversalPlain.status === 403,
      `got ${traversalPlain.status}`);
    const traversalDeep = await httpGet(port, "/remote/..%2f..%2f..%2fetc%2fpasswd");
    check("negative.traversalDeep", traversalDeep.status === 403,
      `got ${traversalDeep.status}`);

    // Negative: directory listing.
    const dirResponse = await httpGet(port, "/remote/resources/");
    check("negative.directoryRefused", dirResponse.status === 403,
      `got ${dirResponse.status}`);

    // Negative: symlink inside the tree.
    const linkPath = join(remoteRoot, "resources", "evil-link.png");
    symlinkSync(join(selfcheckDest, "game.js"), linkPath);
    try {
      const linkResponse = await httpGet(port, "/remote/resources/evil-link.png");
      check("negative.symlinkRefused", linkResponse.status === 403,
        `got ${linkResponse.status}`);
    } finally {
      rmSync(linkPath, { force: true });
    }

    // Negative: non-GET method.
    const postResponse = await httpGet(port, configPath, { method: "POST" });
    check("negative.postRefused", postResponse.status === 405,
      `got ${postResponse.status}`);

    // Negative: missing file under the prefix.
    const missingResponse = await httpGet(port, "/remote/resources/does-not-exist.json");
    check("negative.missingIs404", missingResponse.status === 404,
      `got ${missingResponse.status}`);
  } finally {
    await instance.close();
  }

  // Output guard: the Cocos/WeChat target must not downgrade [...new Set(x)]
  // to [].concat(new Set(x)), which puts the Set object itself in the array
  // instead of its values. Scan the game chunk for the dangerous pattern.
  const chunksDir = join(sourceRoot, "src", "chunks");
  if (existsSync(chunksDir)) {
    const chunkFiles = readdirSync(chunksDir).filter((f) => f.endsWith(".js"));
    let dangerousFound = false;
    let dangerousDetail = "";
    for (const chunkFile of chunkFiles) {
      const chunkPath = join(chunksDir, chunkFile);
      const chunkContent = readFileSync(chunkPath, "utf8");
      if (chunkContent.includes("concat(new Set")) {
        dangerousFound = true;
        dangerousDetail = `${chunkFile} contains concat(new Set(`;
        break;
      }
    }
    check("output.noDowngradedSetSpread", !dangerousFound, dangerousDetail);
  } else {
    check("output.noDowngradedSetSpread", false, "src/chunks directory missing");
  }

  // The verified source build must be byte-for-byte unchanged.
  const sourceAfter = treeSha256(sourceRoot);
  check("source.unchanged", sourceBefore === sourceAfter,
    `before=${sourceBefore} after=${sourceAfter}`);

  // Throwaway dest is removed; the real smoke dir is produced by `derive`.
  rmSync(selfcheckDest, { recursive: true, force: true });
  check("selfcheck.destCleaned", !existsSync(selfcheckDest));

  const summary = {
    ok: !failed,
    label: "NON_RELEASE_DEVTOOLS_SMOKE_SELF_CHECK",
    sourceRoot,
    sourceTreeSha256: sourceBefore,
    checks,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    label: "NON_RELEASE_DEVTOOLS_SMOKE_SELF_CHECK",
    code: "self-check-crashed",
    error: String(error?.message ?? error),
  }, null, 2));
  process.exitCode = 1;
});
