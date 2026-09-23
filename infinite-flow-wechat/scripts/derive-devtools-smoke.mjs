// Derives the verified NON_RELEASE wechatgame build into an independent
// DevTools smoke copy: official game-tourist AppID (no real AppID) and a
// loopback-only remote server. The verified build is never modified.
//
// This is a NON_RELEASE smoke vertical slice:
//   - DevTools playable != real-device / release / persistence acceptance.
//   - The derived directory must never be reused as production evidence.
//   - No real AppID, CDN or token is read, written or printed.

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");

// Official PUBLIC WeChat game-tourist AppID. It is hardcoded in the DevTools
// bundle (constants TOURIST_APPID / GAME_TOURIST_APPID) and the DevTools UI
// displays it as "touristappid". It is not a real/personal AppID and grants
// no account access. Evidence: docs/04-devtools-smoke.md.
export const GAME_TOURIST_APPID = "wx6ac3f5090a6b99c5";

export const SMOKE_DIR_BASENAME = "wechatgame-devtools-smoke";
export const DEFAULT_SMOKE_PORT = 8947;
export const LOOPBACK_HOST = "127.0.0.1";
export const REMOTE_URL_PREFIX = "/remote/";

const NON_RELEASE_MARKER = "NON_RELEASE_SMOKE.md";
const DERIVED_MANIFEST = "devtools-smoke.derived.json";

export class DevtoolsSmokeError extends Error {
  constructor(code, details = []) {
    super(code);
    this.name = "DevtoolsSmokeError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, ...details) {
  throw new DevtoolsSmokeError(code, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        fail("smoke-source-symlink-forbidden", path);
      }
      if (stat.isDirectory()) {
        walk(path);
        continue;
      }
      if (!stat.isFile()) {
        fail("smoke-source-regular-files-only", path);
      }
      out.push(path);
    }
  };
  walk(root);
  return out;
}

// Stable content fingerprint of a tree: sorted "path\0sha256\n" lines.
export function treeSha256(root) {
  const lines = listFiles(root)
    .map((path) => {
      const rel = path.slice(root.length + 1).split(sep).join("/");
      return `${rel}\0${sha256(readFileSync(path))}`;
    })
    .sort();
  return sha256(Buffer.from(lines.join("\n"), "utf8"));
}

function findSettingsFile(root) {
  const srcDir = join(root, "src");
  if (!existsSync(srcDir)) fail("smoke-source-settings-missing", "src/");
  const matches = readdirSync(srcDir).filter(
    (name) => /^settings(?:\.[0-9a-z_-]+)?\.json$/i.test(name),
  );
  if (matches.length !== 1) {
    fail("smoke-source-settings-not-unique", ...matches);
  }
  return join(srcDir, matches[0]);
}

function readJson(path, code) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(code, path);
  }
  if (!isRecord(parsed)) fail(code, path);
  return parsed;
}

function assertSmokeDirName(destRoot) {
  const name = basename(destRoot);
  if (
    name !== SMOKE_DIR_BASENAME
    && !name.startsWith(`${SMOKE_DIR_BASENAME}.`)
  ) {
    // Fail-closed: never wipe a directory that is not clearly a smoke dir.
    fail("smoke-dest-name-unexpected", destRoot);
  }
}

function assertLooksLikeVerifiedBuild(root) {
  if (!existsSync(join(root, "project.config.json"))) {
    fail("smoke-source-not-a-build", root);
  }
  if (!existsSync(join(root, "remote", "resources"))) {
    fail("smoke-source-remote-resources-missing", root);
  }
  if (!existsSync(join(root, "src", "bundle-scripts", "resources"))) {
    fail("smoke-source-bundle-scripts-missing", root);
  }
  findSettingsFile(root);
}

function nonReleaseMarkerText({ sourceRoot, port, derivedAt }) {
  const serverUrl = `http://${LOOPBACK_HOST}:${port}/`;
  return [
    "# NON_RELEASE SMOKE COPY — DO NOT SHIP",
    "",
    "This directory is a **derived** DevTools smoke copy of the verified build.",
    "It exists only for local WeChat DevTools playability checks.",
    "",
    `- Derived from: \`${sourceRoot}\``,
    `- Derived at: ${derivedAt}`,
    `- AppID: official public game-tourist AppID (DevTools shows "touristappid") — no real AppID.`,
    `- Remote resources: \`${serverUrl}\` (loopback only, fail-closed static server).`,
    `- \`setting.urlCheck\` is disabled so the loopback HTTP origin is reachable.`,
    "",
    "## What this is NOT",
    "",
    "- NOT a release build and NOT release evidence.",
    "- DevTools playable does NOT mean real-device, release, CDN or persistence acceptance.",
    "- The 22 MB remote bundle stays remote; it is not folded back into the main package.",
    "- Do not upload this directory. Do not reuse it as production evidence.",
    "",
    "Regenerate with:",
    "",
    "```bash",
    "npm run wechat:devtools-smoke:derive",
    "npm run wechat:devtools-smoke:serve   # loopback remote server",
    "```",
    "",
  ].join("\n");
}

export function deriveDevtoolsSmoke({
  sourceRoot = resolve(projectRoot, "cocos/build/wechatgame"),
  destRoot = resolve(projectRoot, "cocos/build", SMOKE_DIR_BASENAME),
  port = DEFAULT_SMOKE_PORT,
  force = false,
  derivedAt = new Date().toISOString(),
} = {}) {
  const source = resolve(sourceRoot);
  const dest = resolve(destRoot);
  if (source === dest) fail("smoke-source-dest-same");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    fail("smoke-port-invalid", String(port));
  }
  assertLooksLikeVerifiedBuild(source);
  assertSmokeDirName(dest);

  const sourceTreeSha256 = treeSha256(source);

  if (existsSync(dest)) {
    const marker = join(dest, NON_RELEASE_MARKER);
    if (!force && !existsSync(marker)) {
      // Refuse to wipe an existing directory that is not marked as ours.
      fail("smoke-dest-exists-unmarked", dest);
    }
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });

  // Patch project.config.json: tourist AppID + loopback-friendly urlCheck.
  const projectConfigPath = join(dest, "project.config.json");
  const projectConfig = readJson(projectConfigPath, "smoke-project-config-invalid");
  projectConfig.appid = GAME_TOURIST_APPID;
  if (!isRecord(projectConfig.setting)) projectConfig.setting = {};
  projectConfig.setting.urlCheck = false;
  if (typeof projectConfig.projectname === "string") {
    projectConfig.projectname = `${projectConfig.projectname}-devtools-smoke`;
  }
  writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`);

  // Patch versioned settings: remote server -> loopback.
  const settingsPath = findSettingsFile(dest);
  const settings = readJson(settingsPath, "smoke-settings-invalid");
  if (!isRecord(settings.assets)) fail("smoke-settings-assets-missing", settingsPath);
  const remoteBundles = settings.assets.remoteBundles;
  if (!Array.isArray(remoteBundles) || !remoteBundles.includes("resources")) {
    fail("smoke-settings-remote-bundles-missing", settingsPath);
  }
  const serverUrl = `http://${LOOPBACK_HOST}:${port}/`;
  settings.assets.server = serverUrl;
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  // Prominent NON_RELEASE markers.
  writeFileSync(
    join(dest, NON_RELEASE_MARKER),
    nonReleaseMarkerText({ sourceRoot: source, port, derivedAt }),
  );
  const manifest = Object.freeze({
    derived: true,
    nonRelease: true,
    releaseEligible: false,
    notForProductionEvidence: true,
    derivedFrom: source,
    derivedFromTreeSha256: sourceTreeSha256,
    derivedAt,
    appidMode: "game-tourist",
    appid: GAME_TOURIST_APPID,
    port,
    host: LOOPBACK_HOST,
    remoteServerUrl: serverUrl,
    remoteUrlPrefix: REMOTE_URL_PREFIX,
    remoteRoot: join(dest, "remote"),
    urlCheckDisabled: true,
    generator: "scripts/derive-devtools-smoke.mjs",
  });
  writeFileSync(
    join(dest, DERIVED_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return Object.freeze({
    ok: true,
    label: "NON_RELEASE_DEVTOOLS_SMOKE_DERIVED",
    sourceRoot: source,
    destRoot: dest,
    settingsPath: settingsPath.slice(dest.length + 1),
    sourceTreeSha256,
    destTreeSha256: treeSha256(dest),
    port,
    remoteServerUrl: serverUrl,
    nonRelease: true,
    releaseEligible: false,
  });
}

function parseCli(argv) {
  const options = { force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--source") {
      options.sourceRoot = argv[++index];
      continue;
    }
    if (arg === "--dest") {
      options.destRoot = argv[++index];
      continue;
    }
    if (arg === "--port") {
      options.port = Number.parseInt(argv[++index], 10);
      continue;
    }
    fail("smoke-cli-unsupported-argument", arg);
  }
  return options;
}

function isMainModule() {
  return Boolean(process.argv[1])
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    console.log(JSON.stringify(deriveDevtoolsSmoke(parseCli(process.argv.slice(2))), null, 2));
  } catch (error) {
    const code = error instanceof DevtoolsSmokeError
      ? error.code
      : "smoke-derive-failed";
    console.error(JSON.stringify({
      ok: false,
      code,
      details: error instanceof DevtoolsSmokeError ? error.details : [String(error)],
    }, null, 2));
    process.exitCode = 1;
  }
}
