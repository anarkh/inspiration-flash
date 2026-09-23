import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { loadWechatBundleProfiles } from "./verify-wechat-build-config.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(projectRoot, "..");
const manifestPath = resolve(
  projectRoot,
  "cocos/assets/config/asset-manifest.json",
);
const assetRoot = resolve(projectRoot, "cocos/assets");
const resourceRoot = resolve(projectRoot, "cocos/assets/resources");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const EXPECTED_ASSET_COUNT = 223;
const NPC_GRID_ASSET_KEYS = new Set([
  "item:method_mist_breathing",
  "item:method_iron_body",
  "item:method_cloud_step",
  "item:method_gate_sense",
  "item:method_star_core_method",
  "item:method_beast_taming",
  "item:method_void_heart",
  "item:bloodline_titan_marrow",
  "item:bloodline_void_symbiote",
  "item:bloodline_bastion_chitin",
  "item:bloodline_phoenix_ember",
  "character:companion_qin_che",
  "character:companion_zhou_yingxue",
  "character:companion_lu_guanlan",
  "npc:bloodline_priest",
  "npc:companion_guide",
]);
const FROZEN_PRE_WORLD_ASSET_COUNT = 188;
const FROZEN_PRE_WORLD_ENTRIES_SHA256 = "37b55ba133a83ba2c1b713d437be2b24345dbf01314ce91275b475033d39906f";
const failures = [];
let bundleProfile;
try {
  bundleProfile = loadWechatBundleProfiles().profile;
} catch (error) {
  failures.push(`WeChat bundle profile contract invalid: ${error?.code ?? "unknown"}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function listDirectories(directory) {
  const directories = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = resolve(directory, entry.name);
    directories.push(path, ...listDirectories(path));
  }
  return directories;
}

function asPosix(path) {
  return path.split(sep).join("/");
}

function sortedRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  )));
}

function pngDimensions(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("not a PNG file");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function sameStringSet(actual, expected) {
  return (
    Array.isArray(actual)
    && actual.every((value) => typeof value === "string")
    && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  );
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expectedImporter(targetPath, directoryPaths) {
  if (directoryPaths.has(targetPath)) return "directory";
  if (targetPath.endsWith(".png")) return "image";
  if (targetPath.endsWith(".ts")) return "typescript";
  if (targetPath.endsWith(".scene")) return "scene";
  if (targetPath.endsWith(".json")) return "json";
  if (targetPath.endsWith(".md")) return "text";
  return undefined;
}

function validateImageMeta(meta, displayPath) {
  if (!sameStringSet(meta.files, [".json", ".png"])) {
    failures.push(`image meta files must be .json/.png: ${displayPath}`);
  }
  const redirect = meta.userData?.redirect;
  const redirectPrefix = `${meta.uuid}@`;
  if (typeof redirect !== "string" || !redirect.startsWith(redirectPrefix)) {
    failures.push(`image meta redirect must derive from its UUID: ${displayPath}`);
    return;
  }
  const subMetaId = redirect.slice(redirectPrefix.length);
  const subMeta = meta.subMetas?.[subMetaId];
  if (!isRecord(subMeta)) {
    failures.push(`image meta redirect target is missing: ${displayPath}`);
    return;
  }
  if (
    subMeta.importer !== "texture"
    || subMeta.uuid !== redirect
    || subMeta.id !== subMetaId
    || subMeta.name !== "texture"
    || subMeta.userData?.imageUuidOrDatabaseUri !== meta.uuid
  ) {
    failures.push(`image texture submeta/redirect is inconsistent: ${displayPath}`);
  }
}

function readCreatorMeta(path, label) {
  try {
    const meta = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(meta)) {
      failures.push(`${label} must contain a JSON object`);
      return null;
    }
    return meta;
  } catch {
    failures.push(`${label} must be readable JSON`);
    return null;
  }
}

function validateDirectoryBundleContract(bundle, label) {
  const meta = readCreatorMeta(resolve(projectRoot, bundle.metadataPath), label);
  if (!meta) return;
  const expectedUserData = {
    isBundle: true,
    bundleConfigID: bundle.bundleConfigID,
    bundleName: bundle.name,
    priority: bundle.priority,
  };
  if (meta.ver !== bundle.metadataVersion) {
    failures.push(`${label} Creator metadata version differs from pinned bundle contract`);
  }
  if (
    meta.importer !== "directory"
    || meta.imported !== true
    || meta.uuid !== bundle.uuid
    || !sameStringSet(meta.files, [])
    || !isRecord(meta.subMetas)
    || Object.keys(meta.subMetas).length !== 0
  ) {
    failures.push(`${label} directory identity differs from pinned bundle contract`);
  }
  if (JSON.stringify(meta.userData) !== JSON.stringify(expectedUserData)) {
    failures.push(`${label} userData differs from pinned bundle contract`);
  }
}

function validateBundleContracts() {
  if (!bundleProfile) return;
  validateDirectoryBundleContract(bundleProfile.bundle, "resources.meta");
  validateDirectoryBundleContract(bundleProfile.configBundle, "config.meta");

  const configBundle = bundleProfile.configBundle;
  const manifestMetaPath = resolve(projectRoot, configBundle.manifestMetadataPath);
  const manifestMeta = readCreatorMeta(manifestMetaPath, "asset-manifest.json.meta");
  if (!manifestMeta) return;
  if (
    manifestMeta.ver !== configBundle.manifestMetadataVersion
    || manifestMeta.importer !== "json"
    || manifestMeta.imported !== true
    || manifestMeta.uuid !== configBundle.manifestUuid
    || !sameStringSet(manifestMeta.files, [".json"])
    || !isRecord(manifestMeta.subMetas)
    || Object.keys(manifestMeta.subMetas).length !== 0
    || !isRecord(manifestMeta.userData)
    || Object.keys(manifestMeta.userData).length !== 0
  ) {
    failures.push("asset-manifest.json.meta identity differs from pinned config bundle contract");
  }
  const sourceManifestPath = resolve(projectRoot, bundleProfile.source.manifestPath);
  if (`${sourceManifestPath}.meta` !== manifestMetaPath) {
    failures.push("config bundle manifest metadata path must identify the pinned source manifest");
  }
}

function validateCreatorMetadata() {
  const assetFiles = listFiles(assetRoot);
  const assetDirectories = listDirectories(assetRoot);
  const directoryPaths = new Set(assetDirectories);
  const contentFiles = assetFiles.filter((path) => !path.endsWith(".meta"));
  const metaFiles = assetFiles.filter((path) => path.endsWith(".meta"));
  const expectedTargets = [...contentFiles, ...assetDirectories];

  for (const targetPath of expectedTargets) {
    if (!existsSync(`${targetPath}.meta`)) {
      failures.push(`Creator metadata missing: ${asPosix(relative(assetRoot, targetPath))}`);
    }
  }
  for (const metaPath of metaFiles) {
    const targetPath = metaPath.slice(0, -".meta".length);
    if (!existsSync(targetPath)) {
      failures.push(`orphan Creator metadata: ${asPosix(relative(assetRoot, metaPath))}`);
    }
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const uuids = new Map();
  for (const metaPath of metaFiles) {
    const displayPath = asPosix(relative(assetRoot, metaPath));
    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch (error) {
      failures.push(`Creator metadata is not valid JSON: ${displayPath}: ${String(error)}`);
      continue;
    }
    if (!isRecord(meta)) {
      failures.push(`Creator metadata must be an object: ${displayPath}`);
      continue;
    }
    if (typeof meta.uuid !== "string" || !uuidPattern.test(meta.uuid)) {
      failures.push(`Creator metadata UUID has invalid format: ${displayPath}`);
    } else {
      const previous = uuids.get(meta.uuid);
      if (previous !== undefined) {
        failures.push(`duplicate Creator metadata UUID: ${previous} and ${displayPath}`);
      } else {
        uuids.set(meta.uuid, displayPath);
      }
    }
    if (meta.imported !== true) {
      failures.push(`Creator metadata is not marked imported: ${displayPath}`);
    }
    const targetPath = metaPath.slice(0, -".meta".length);
    const importer = expectedImporter(targetPath, directoryPaths);
    if (importer === undefined || meta.importer !== importer) {
      failures.push(
        `Creator metadata importer mismatch: ${displayPath}; expected ${String(importer)}, got ${String(meta.importer)}`,
      );
    }
    if (importer === "directory") {
      if (!sameStringSet(meta.files, []) || !isRecord(meta.subMetas) || Object.keys(meta.subMetas).length !== 0) {
        failures.push(`directory metadata has unexpected generated files/submetas: ${displayPath}`);
      }
    } else if (importer === "image") {
      validateImageMeta(meta, displayPath);
    }
  }

  return { contentFiles, metaFiles, uuids };
}

if (manifest.schemaVersion !== 2) failures.push("schemaVersion must be 2");
if (!Array.isArray(manifest.assets)) failures.push("assets must be an array");

const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
if (manifest.assetCount !== EXPECTED_ASSET_COUNT || assets.length !== EXPECTED_ASSET_COUNT) {
  failures.push(
    `expected ${EXPECTED_ASSET_COUNT} assets, manifest says ${String(manifest.assetCount)} and contains ${assets.length}`,
  );
}

const npcGridAssets = assets.filter((asset) => NPC_GRID_ASSET_KEYS.has(asset.key));
if (npcGridAssets.length !== 16) failures.push("NPC grid must include all 16 approved artworks");
const originalAssets = assets.filter((asset) => !asset.key.startsWith("scene:dungeon_world_") && !NPC_GRID_ASSET_KEYS.has(asset.key));
if (originalAssets.length !== FROZEN_PRE_WORLD_ASSET_COUNT
  || sha256(JSON.stringify(originalAssets)) !== FROZEN_PRE_WORLD_ENTRIES_SHA256) {
  failures.push("the original 187 Web assets and walking atlas must remain unchanged");
}
const dungeonIds = originalAssets.filter((asset) => asset.kind === "dungeon").map((asset) => asset.entityId);
const worldAssets = assets.filter((asset) => asset.key.startsWith("scene:dungeon_world_"));
const expectedWorldKeys = dungeonIds.map((id) => `scene:dungeon_world_${id}`);
if (dungeonIds.length !== 19 || !sameStringSet(worldAssets.map((asset) => asset.key), expectedWorldKeys)) {
  failures.push("dungeon-world backgrounds must cover exactly the 19 original dungeon IDs");
}
for (const asset of worldAssets) {
  const dungeonId = asset.key.slice("scene:dungeon_world_".length);
  if (asset.kind !== "scene" || asset.entityId !== `dungeon_world_${dungeonId}`
    || asset.role !== "scene" || asset.fit !== "cover"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/art-source/dungeon-world/${dungeonId}-v1.png`
    || asset.resourceFile !== `dungeon-world/${dungeonId}-v1.png`
    || asset.resourcePath !== `dungeon-world/${dungeonId}-v1`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`dungeon-world provenance or versioned identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (!Number.isSafeInteger(asset.width) || asset.width <= 0 || asset.width !== asset.height
    || asset.width !== dimensions?.width || asset.height !== dimensions?.height) {
    failures.push(`dungeon-world target must retain its actual square PNG dimensions: ${asset.key}`);
  }
}

const keys = new Set();
const resourceFiles = new Set();
const resourcePaths = new Set();
const kindCounts = {};
const formatCounts = {};
let resourceBytes = 0;

for (const asset of assets) {
  if (keys.has(asset.key)) failures.push(`duplicate key: ${asset.key}`);
  keys.add(asset.key);
  if (`${asset.kind}:${asset.entityId}` !== asset.key) {
    failures.push(`key identity mismatch: ${asset.key}`);
  }
  if (resourceFiles.has(asset.resourceFile)) {
    failures.push(`duplicate resourceFile: ${asset.resourceFile}`);
  }
  resourceFiles.add(asset.resourceFile);
  if (resourcePaths.has(asset.resourcePath)) {
    failures.push(`duplicate resourcePath: ${asset.resourcePath}`);
  }
  resourcePaths.add(asset.resourcePath);

  kindCounts[asset.kind] = (kindCounts[asset.kind] ?? 0) + 1;
  formatCounts[asset.targetFormat] = (formatCounts[asset.targetFormat] ?? 0) + 1;

  const targetPath = resolve(resourceRoot, asset.resourceFile);
  const relativeTarget = relative(resourceRoot, targetPath);
  if (relativeTarget.startsWith("..") || resolve(resourceRoot, relativeTarget) !== targetPath) {
    failures.push(`resourceFile escapes resource root: ${asset.resourceFile}`);
    continue;
  }

  try {
    const targetBytes = readFileSync(targetPath);
    resourceBytes += targetBytes.length;
    const actualTargetHash = sha256(targetBytes);
    if (actualTargetHash !== asset.targetSha256) {
      failures.push(`target SHA-256 mismatch: ${asset.key}`);
    }
    const dimensions = pngDimensions(targetBytes);
    const expectedDimensions = asset.transformation?.targetDimensions;
    if (
      dimensions.width !== expectedDimensions?.width
      || dimensions.height !== expectedDimensions?.height
    ) {
      failures.push(`target dimensions mismatch: ${asset.key}`);
    }
  } catch (error) {
    failures.push(`target unreadable: ${asset.key}: ${String(error)}`);
  }

  const sourcePath = resolve(repositoryRoot, asset.sourceFile);
  const relativeSource = relative(repositoryRoot, sourcePath);
  if (relativeSource.startsWith("..") || resolve(repositoryRoot, relativeSource) !== sourcePath) {
    failures.push(`sourceFile escapes repository root: ${asset.sourceFile}`);
    continue;
  }
  try {
    const actualSourceHash = sha256(readFileSync(sourcePath));
    if (actualSourceHash !== asset.sourceSha256) {
      failures.push(`source SHA-256 mismatch: ${asset.key}`);
    }
    if (
      asset.transformation?.operation === "byte-copy"
      && actualSourceHash !== asset.targetSha256
    ) {
      failures.push(`byte-copy is not byte-identical: ${asset.key}`);
    }
  } catch (error) {
    failures.push(`source unreadable: ${asset.key}: ${String(error)}`);
  }
}

if (JSON.stringify(sortedRecord(kindCounts)) !== JSON.stringify(sortedRecord(manifest.kindCounts))) {
  failures.push("kindCounts do not match ordered asset entries");
}
if (
  JSON.stringify(sortedRecord(formatCounts))
  !== JSON.stringify(sortedRecord(manifest.formatCounts?.target ?? {}))
) {
  failures.push("formatCounts do not match ordered asset entries");
}
if (formatCounts.png !== EXPECTED_ASSET_COUNT || Object.keys(formatCounts).length !== 1) {
  failures.push(`Cocos target must contain exactly ${EXPECTED_ASSET_COUNT} PNG manifest entries`);
}

const resourceTreeFiles = listFiles(resourceRoot)
  .map((path) => asPosix(relative(resourceRoot, path)))
  .sort();
const physicalFiles = resourceTreeFiles.filter((path) => path.endsWith(".png"));
const declaredFiles = [...resourceFiles].sort();
if (JSON.stringify(physicalFiles) !== JSON.stringify(declaredFiles)) {
  failures.push("physical resource files differ from manifest declarations");
}
const resourceDirectoryMetaFiles = listDirectories(resourceRoot)
  .map((path) => `${asPosix(relative(resourceRoot, path))}.meta`);
const expectedResourceTreeFiles = [
  ...declaredFiles,
  ...declaredFiles.map((path) => `${path}.meta`),
  ...resourceDirectoryMetaFiles,
].sort();
if (JSON.stringify(resourceTreeFiles) !== JSON.stringify(expectedResourceTreeFiles)) {
  failures.push("resource tree must contain only manifest PNGs and their Creator metadata");
}

const creatorMetadata = validateCreatorMetadata();
validateBundleContracts();
const imageMetaCount = creatorMetadata.metaFiles.filter((path) => path.endsWith(".png.meta")).length;
if (imageMetaCount !== EXPECTED_ASSET_COUNT) failures.push(`expected ${EXPECTED_ASSET_COUNT} image metas, found ${imageMetaCount}`);

const revisionPayload = {
  schemaVersion: manifest.schemaVersion,
  sourceManifest: manifest.sourceManifest,
  resourceRoot: manifest.resourceRoot,
  assets: manifest.assets,
};
const actualRevision = `sha256:${sha256(JSON.stringify(revisionPayload))}`;
if (manifest.manifestRevision !== actualRevision) {
  failures.push(
    `manifestRevision mismatch: expected ${manifest.manifestRevision}, calculated ${actualRevision}`,
  );
}
if (bundleProfile) {
  if (manifest.manifestRevision !== bundleProfile.source.manifestRevision) {
    failures.push("manifestRevision differs from pinned WeChat bundle profile");
  }
  if (
    manifest.assetCount !== bundleProfile.source.assetCount
    || assets.length !== bundleProfile.source.assetCount
  ) {
    failures.push("asset count differs from pinned WeChat bundle profile");
  }
  if (resourceBytes !== bundleProfile.source.resourceBytes) {
    failures.push(
      `resource bytes differ from pinned WeChat bundle profile: ${resourceBytes}`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    assets: assets.length,
    physicalFiles: physicalFiles.length,
    creatorMetadata: creatorMetadata.metaFiles.length,
    creatorUuids: creatorMetadata.uuids.size,
    kinds: kindCounts,
    formats: formatCounts,
    resourceBytes,
    bundle: bundleProfile ? {
      name: bundleProfile.bundle.name,
      uuid: bundleProfile.bundle.uuid,
      priority: bundleProfile.bundle.priority,
      localConfig: {
        name: bundleProfile.configBundle.name,
        uuid: bundleProfile.configBundle.uuid,
        manifestUuid: bundleProfile.configBundle.manifestUuid,
      },
    } : null,
    manifestRevision: actualRevision,
  }, null, 2));
}
