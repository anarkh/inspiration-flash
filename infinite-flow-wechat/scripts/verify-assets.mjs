import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { inflateSync } from "node:zlib";
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
const EXPECTED_ASSET_COUNT = 324;
const HERO_WALK_KEY = "character:reincarnator_walk";
const HERO_WALK_SHA256 = "897deadd34e18c9e3c8e7d52461a8fddac5272503696e263cee2e7baec6bb918";
const DUNGEON_TRANSITION_GATE_KEY = "scene:dungeon_transition_gate";
const HUB_DUNGEON_PORTAL_KEY = "scene:hub_dungeon_portal";
const HUB_DUNGEON_PORTAL_SHA256 = "e77658a165eab7c3fe527b309909bca1d0be7c4fddd4ab5d4c75905a33927d4e";
// The 黑白水墨 battle controls: one transparent strip the battle scene cuts into its six controls,
// shipped at half size so phones minify it without mipmaps and keep the thin ink outlines.
const BATTLE_CONTROLS_KEY = "scene:battle_controls_ink";
const BATTLE_CONTROLS_SOURCE_SHA256 = "74914479f4bd2979f1cd5f02064e26abffa7e5bc254e0d8b4772706da0ffe553";
const BATTLE_CONTROLS_TARGET_SHA256 = "98a6783f409940999139a4f3a3745cda3710c18049d82d855d10b0d48aec19b3";
const COURTYARD_ASSET_SPECS = [
  { key: "scene:hub_courtyard_walk", file: "walk-sanctuary-v1.png", sourceFile: "walk-sanctuary-v1.png", width: 2172, height: 724, fit: "cover", hasAlpha: false },
  { key: "scene:courtyard_pillar", file: "pillar-v1.png", sourceFile: "courtyard-props/pillar-v1.png", width: 870, height: 1808, fit: "contain", hasAlpha: true },
  { key: "scene:courtyard_crate", file: "crate-v1.png", sourceFile: "courtyard-props/crate-v1.png", width: 1457, height: 1080, fit: "contain", hasAlpha: true },
  { key: "scene:courtyard_altar", file: "altar-v1.png", sourceFile: "courtyard-props/altar-v1.png", width: 1500, height: 1049, fit: "contain", hasAlpha: true },
  { key: "scene:courtyard_lamp", file: "lamp-v1.png", sourceFile: "courtyard-props/lamp-v1.png", width: 930, height: 1691, fit: "contain", hasAlpha: true },
];
const COURTYARD_ASSET_KEYS = new Set(COURTYARD_ASSET_SPECS.map((asset) => asset.key));
const COURTYARD_PROP_KEYS = new Set(COURTYARD_ASSET_SPECS.filter((asset) => asset.hasAlpha).map((asset) => asset.key));
const NPC_WORLD_SLUGS = [
  "equipment-quartermaster",
  "supply-trader",
  "pet-keeper",
  "method-master",
  "bloodline-priest",
  "companion-guide",
  "main-god-projection",
];
const NPC_WORLD_ASSET_KEYS = new Set(NPC_WORLD_SLUGS.map((slug) => (
  `npc:${slug.replaceAll("-", "_")}_world`
)));
// Full-body duel-stage figures for the companions and pets; their portraits stay separate assets.
const PARTY_WORLD_SPECS = [
  { key: "character:companion_qin_che_world", folder: "character", slug: "qin-che", sha256: "006f6006f12f1fc9d1c086eef8b91aee93b222cdd6b24b29b3d35a025c3e5c2d" },
  { key: "character:companion_zhou_yingxue_world", folder: "character", slug: "zhou-yingxue", sha256: "88a7c0d1a2eed61a866cb33860908e8bff2f8f8ef29e3bdba8a62ca83cf20431" },
  { key: "character:companion_lu_guanlan_world", folder: "character", slug: "lu-guanlan", sha256: "31b3729bfbe104afb9c47b66a41e89da0152487fefc69d42ed01f147e017781b" },
  { key: "pet:contract_sprite_world", folder: "pet", slug: "contract-sprite", sha256: "03ed6ff4e8a3b0e3f40d42e3b01978e213ac728a57b13653491e3c5570b31d82" },
  { key: "pet:ash_hound_world", folder: "pet", slug: "ash-hound", sha256: "81e539dcec6dffb598de1fbebf4daf05704090159668cce8a2252bb1e9df01c0" },
  { key: "pet:starling_drone_world", folder: "pet", slug: "starling-drone", sha256: "2676741b75cce86c65259bd86ac3f113f5b10367c7c369bf74a09dee982a3947" },
  { key: "pet:mist_kitten_world", folder: "pet", slug: "mist-kitten", sha256: "f17879f60589b4209035c545e80ffbc8f2a87f3e01b0c63df9a5727f4a6e36a2" },
  { key: "pet:mirror_moth_world", folder: "pet", slug: "mirror-moth", sha256: "11addc57b1860a8badad3540ec6428b1de3d03923650e109ba466c074454cf41" },
  { key: "pet:void_whelp_world", folder: "pet", slug: "void-whelp", sha256: "c849a624a54fbc6c28cc4be2e27d3144b224230bb33b23e34f556df62e86c439" },
];
const PARTY_WORLD_ASSET_KEYS = new Set(PARTY_WORLD_SPECS.map((spec) => spec.key));
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
const STYLE_REFRESH_ASSET_SPECS = [
  {"key":"scene:dungeon_prop_chest","candidate":"chest-proposed.png","resourceFile":"dungeon-world/chest-v1.png","width":1254,"height":1254,"sha256":"d5abfec22278040a8a276832d7a2009d5e2044536ba9f31346317f6dc47695a5","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_exit","candidate":"exit-proposed.png","resourceFile":"dungeon-world/exit-v1.png","width":1145,"height":1374,"sha256":"81b674164ee006184f36559629092dee769dc78e8a30c1ed154e423cd0c645f9","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_event","candidate":"event-proposed.png","resourceFile":"dungeon-world/event-v1.png","width":1254,"height":1254,"sha256":"351c5b7cbe3752612e078154c1ddc479f34d8714a6b0727134964f980c0cc9ed","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_trap","candidate":"trap-proposed.png","resourceFile":"dungeon-world/trap-v1.png","width":1254,"height":1254,"sha256":"e48901773ef4f794848b43adc7d19042617167157bdb620db9932e871def1931","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_survey","candidate":"survey-proposed.png","resourceFile":"dungeon-world/survey-v1.png","width":1254,"height":1254,"sha256":"7a41a55d8c139bf035cf6a7623e9314acf8d882ff4887cd6e78c31fbc35b2f90","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_relic","candidate":"relic-proposed.png","resourceFile":"dungeon-world/relic-v1.png","width":1254,"height":1254,"sha256":"5533b22ce3a44154262b3fe81e0fa81f17f0ec3f4c3385bc6df9c247b67e9359","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_shrine","candidate":"shrine-proposed.png","resourceFile":"dungeon-world/shrine-v1.png","width":1254,"height":1254,"sha256":"6552dc80311d080afa82871c116c90939d84af9cf676a85ea1c325c708ab30a1","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_law","candidate":"law-proposed.png","resourceFile":"dungeon-world/law-v1.png","width":1254,"height":1254,"sha256":"16ec2a64c56a4a53879bcef9e43d260469a4dc369d7508744973e1a76918cd23","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"scene:dungeon_prop_debris","candidate":"debris-proposed.png","resourceFile":"dungeon-world/debris-v1.png","width":1536,"height":1024,"sha256":"d0dea6331d34acd63b0c7da6f74ae8fc5dd1223a02fec0cd947bb4de7fce8371","hasAlpha":true,"sourceRevision":1,"role":"scene","fit":"contain"},
  {"key":"item:method_mist_breathing","candidate":"mist-breathing-proposed.png","resourceFile":"item/mist-breathing-v2.png","width":1254,"height":1254,"sha256":"fee646891c9b7872ae1ec5bf3a13e4b4773eb43b6454023e06fcee602356b6ef","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_iron_body","candidate":"iron-body-proposed.png","resourceFile":"item/iron-body-v2.png","width":1254,"height":1254,"sha256":"9637c4b4d1258819769ecbc7d4e538693282e4bea78a9f8df7555221de8f65ab","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_cloud_step","candidate":"cloud-step-proposed.png","resourceFile":"item/cloud-step-v2.png","width":1254,"height":1254,"sha256":"b6bce8615c31b315f893d95c45b399b5dd3968565a5a930a6b9b97b70181a30e","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_gate_sense","candidate":"gate-sense-proposed.png","resourceFile":"item/gate-sense-v2.png","width":1254,"height":1254,"sha256":"e697e7079cac7f5baa47d158126585dee45835d6a4690eab81be2cfc5c668581","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_star_core_method","candidate":"star-core-method-proposed.png","resourceFile":"item/star-core-method-v2.png","width":1254,"height":1254,"sha256":"20749ad83ad69787f4517d2c2fedcc103ebe5389432ec56519fe446d25501f78","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_beast_taming","candidate":"beast-taming-proposed.png","resourceFile":"item/beast-taming-v2.png","width":1254,"height":1254,"sha256":"d38e051e0f5602acc0238f1ea488c833ed61bbe94dcb35d98e63fbfef1ef9a25","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:method_void_heart","candidate":"void-heart-proposed.png","resourceFile":"item/void-heart-v2.png","width":1254,"height":1254,"sha256":"bdfbea5b45d0eefb465100bc1be99f42875361fd5093828712b197356df3a5d1","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:bloodline_titan_marrow","candidate":"titan-marrow-proposed.png","resourceFile":"item/titan-marrow-v2.png","width":1254,"height":1254,"sha256":"8858a2b1df6c9b2248acc7a18ea58f1e3031c53cf96bb9b3fd0746834d88e2c1","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:bloodline_void_symbiote","candidate":"void-symbiote-proposed.png","resourceFile":"item/void-symbiote-v2.png","width":1254,"height":1254,"sha256":"72888c3a04bfaad75230b216e0b067bdc67f7b944b963e64e1622239bb5958ef","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:bloodline_bastion_chitin","candidate":"bastion-chitin-proposed.png","resourceFile":"item/bastion-chitin-v2.png","width":1254,"height":1254,"sha256":"9a571e47a73e3dee8a1724860cf36e0c42b0483035c82b54298c69bee6e1917b","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"item:bloodline_phoenix_ember","candidate":"phoenix-ember-proposed.png","resourceFile":"item/phoenix-ember-v2.png","width":1254,"height":1254,"sha256":"e176580c531b22261c6af7137253b4806e77bee2a9eb3dfe636c2599cdebb599","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"equipment:rebirth_amulet","candidate":"rebirth-amulet-proposed.png","resourceFile":"equipment/rebirth-amulet-v2.png","width":1122,"height":1402,"sha256":"f048795bad3b3c6a1fed13ccf1cce52620c71f491c88f49662fabdf918656f01","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"equipment:triage_visor","candidate":"triage-visor-proposed.png","resourceFile":"equipment/triage-visor-v2.png","width":1254,"height":1254,"sha256":"5d662827b0cca639cc1e40ed63dc9dc3d1eb1521c8cdbf611fb2511a8e606ea9","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"equipment:forensic_visor","candidate":"forensic-visor-proposed.png","resourceFile":"equipment/forensic-visor-v2.png","width":1254,"height":1254,"sha256":"164d5a3293f2be13845aaed76efd8e51388ebb85a4fe20756d4a28d5e326b8da","hasAlpha":true,"sourceRevision":2,"role":"icon","fit":"contain"},
  {"key":"character:reincarnator","candidate":"hero-portrait-proposed.png","resourceFile":"character/reincarnator-v2.png","width":1254,"height":1254,"sha256":"3350c54b38817f003ffbe4acb914c502f9d2c0fef82384b4c68b766b24c456af","hasAlpha":false,"sourceRevision":2,"role":"portrait","fit":"cover"},
  {"key":"npc:companion_guide","candidate":"guide-portrait-proposed.png","resourceFile":"npc/companion-guide-v2.png","width":1254,"height":1254,"sha256":"82989830693f0666bcfe18cc4d8fccdcb86bdc9beaaa97a34ee54eb05fe09c25","hasAlpha":false,"sourceRevision":2,"role":"portrait","fit":"contain"},
  {"key":"dungeon:mirror_cycle_city","candidate":"mirror-banner-proposed.png","resourceFile":"dungeon/mirror-cycle-city-v2.png","width":2172,"height":724,"sha256":"6da074afcd4e0bb6eb8436caf285964d143d84b9bb9ab085e244faf21dfd7d42","hasAlpha":false,"sourceRevision":2,"role":"banner","fit":"cover"},
];
const STYLE_REFRESH_ASSET_KEYS = new Set(STYLE_REFRESH_ASSET_SPECS.map((asset) => asset.key));
const STYLE_REFRESH_ALPHA_KEYS = new Set(STYLE_REFRESH_ASSET_SPECS.filter((asset) => asset.hasAlpha).map((asset) => asset.key));
const RUN_RELIC_ICON_SPECS = [
  { id: "mist_edge", sha256: "0aa124c76590ac6270582bda32f15e3c86d3252f0115a7f87c873d5d8a751041" },
  { id: "focus_prism", sha256: "09e69b57bfa267ccb6209b2bdd262c3dc7a4d7fd74f24eac3a6a102647fbfc2b" },
  { id: "hunter_clock", sha256: "2bfe18c3da4f8627de4613b38b8c482e99c96184ffd9dbb18cedb77128c5b0b9" },
  { id: "bone_shell", sha256: "cd364a363de8ee47e22d5920d6c479e6a955b302950049ee7285d69196f7935b" },
  { id: "mending_thread", sha256: "469f833c44b4f4914a3c75e08293361a7b86d1f1365e898103600fa7d7ec214c" },
  { id: "iron_echo", sha256: "84ce2a7a4a4da7e4bdbdacee82b9f5b43554559795b48522f107e6296127ed8b" },
  { id: "rift_step", sha256: "0f144fbced4e372900822f58aff2da20e84ea06cf552c4b23c8ba6c5db919e51" },
  { id: "gate_anchor", sha256: "87d73c4fe847116a7a36e9b4a3d8bf3ab41fcabf0588314bf223d92cfdfd88bb" },
  { id: "lucky_map", sha256: "b69e988ef0913323aec11c70862904b0647585cdeb8ea77b5ef0dd05d2574e55" },
];
const RUN_RELIC_ICON_KEYS = new Set(RUN_RELIC_ICON_SPECS.map(({ id }) => `item:run_relic_${id}`));
const FROZEN_PRE_WORLD_ASSET_COUNT = 182;
const FROZEN_PRE_WORLD_ENTRIES_SHA256 = "b0a3dbe7bcea4388976435d7a86e0f34a80cca0f540d891967c1407f6fae4754";
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

function pngRgbaAlpha(bytes) {
  const { width, height } = pngDimensions(bytes);
  if (bytes[24] !== 8 || bytes[25] !== 6 || bytes[26] !== 0
    || bytes[27] !== 0 || bytes[28] !== 0) {
    throw new Error("sprite must be a non-interlaced 8-bit RGBA PNG");
  }
  const chunks = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (offset + length + 12 > bytes.length) throw new Error("truncated PNG chunk");
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(chunks));
  if (raw.length !== (stride + 1) * height) throw new Error("invalid RGBA PNG pixel length");
  let previous = Buffer.alloc(stride);
  let current = Buffer.alloc(stride);
  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let y = 0; y < height; y += 1) {
    const offset = y * (stride + 1);
    const filter = raw[offset];
    if (filter > 4) throw new Error("unsupported PNG row filter");
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? current[x - 4] : 0;
      const above = previous[x];
      const upperLeft = x >= 4 ? previous[x - 4] : 0;
      let prediction = 0;
      if (filter === 1) prediction = left;
      else if (filter === 2) prediction = above;
      else if (filter === 3) prediction = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const p = left + above - upperLeft;
        const a = Math.abs(p - left);
        const b = Math.abs(p - above);
        const c = Math.abs(p - upperLeft);
        prediction = a <= b && a <= c ? left : b <= c ? above : upperLeft;
      }
      current[x] = (raw[offset + 1 + x] + prediction) & 255;
      if (x % 4 === 3) {
        if (current[x] === 0) transparentPixels += 1;
        else visiblePixels += 1;
      }
    }
    [previous, current] = [current, previous];
  }
  return { transparentPixels, visiblePixels };
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
const monsterWorldAssets = assets.filter((asset) => (
  asset.key.startsWith("monster:") && asset.key.endsWith("_world")
));
const monsterWorldKeys = new Set(monsterWorldAssets.map((asset) => asset.key));
const originalAssets = assets.filter((asset) => !asset.key.startsWith("scene:dungeon_world_")
  && !NPC_GRID_ASSET_KEYS.has(asset.key) && !NPC_WORLD_ASSET_KEYS.has(asset.key)
  && !monsterWorldKeys.has(asset.key) && !PARTY_WORLD_ASSET_KEYS.has(asset.key) && !COURTYARD_ASSET_KEYS.has(asset.key)
  && asset.key !== DUNGEON_TRANSITION_GATE_KEY && asset.key !== HUB_DUNGEON_PORTAL_KEY && asset.key !== BATTLE_CONTROLS_KEY
  && !asset.key.startsWith("scene:dungeon_prop_") && !RUN_RELIC_ICON_KEYS.has(asset.key));
const frozenOriginalAssets = originalAssets.filter((asset) => (
  !STYLE_REFRESH_ASSET_KEYS.has(asset.key) && asset.key !== HERO_WALK_KEY
));
if (frozenOriginalAssets.length !== FROZEN_PRE_WORLD_ASSET_COUNT
  || sha256(JSON.stringify(frozenOriginalAssets)) !== FROZEN_PRE_WORLD_ENTRIES_SHA256) {
  failures.push("the 182 original Web assets outside the approved style and hero walking refreshes must remain unchanged");
}
const heroWalkAssets = assets.filter((asset) => asset.key === HERO_WALK_KEY);
if (heroWalkAssets.length !== 1) {
  failures.push("hero walking must include exactly one approved v2 atlas");
}
for (const asset of heroWalkAssets) {
  if (asset.kind !== "character" || asset.entityId !== "reincarnator_walk"
    || asset.role !== "sprite-sheet" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 2
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== "infinite-flow-wechat/art-source/hero-redesign/reincarnator-walk-v2.png"
    || asset.resourceFile !== "character/reincarnator-walk-v2.png"
    || asset.resourcePath !== "character/reincarnator-walk-v2"
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== HERO_WALK_SHA256 || asset.targetSha256 !== HERO_WALK_SHA256
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`hero walking provenance or approved v2 image identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1254 || asset.height !== 1254
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`hero walking must retain its approved 1254x1254 PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.uuid !== "3fb66656-ebec-4df1-b04a-1ffd729428ba"
    || meta?.userData?.type !== "texture" || meta?.userData?.hasAlpha !== true) {
    failures.push(`hero walking image metadata must preserve its UUID and transparent texture import: ${asset.key}`);
  }
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

const npcWorldAssets = assets.filter((asset) => NPC_WORLD_ASSET_KEYS.has(asset.key));
if (!sameStringSet(npcWorldAssets.map((asset) => asset.key), NPC_WORLD_ASSET_KEYS)) {
  failures.push("NPC world portraits must cover exactly the seven hub NPC identities");
}
for (const asset of npcWorldAssets) {
  const id = asset.key.slice("npc:".length, -"_world".length);
  const slug = id.replaceAll("_", "-");
  if (!assets.some((candidate) => candidate.key === `npc:${id}`)
    || asset.kind !== "npc" || asset.entityId !== `${id}_world`
    || asset.role !== "portrait" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/art-source/npc-world/${slug}-v1.png`
    || asset.resourceFile !== `npc/${slug}-world-v1.png`
    || asset.resourcePath !== `npc/${slug}-world-v1`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`NPC world provenance or versioned identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1024 || asset.height !== 1536
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`NPC world portraits must retain their original 1024x1536 PNG dimensions: ${asset.key}`);
  }
}

const courtyardAssets = assets.filter((asset) => COURTYARD_ASSET_KEYS.has(asset.key));
if (!sameStringSet(courtyardAssets.map((asset) => asset.key), COURTYARD_ASSET_KEYS)) {
  failures.push("hub courtyard must include its approved background and four props");
}
for (const asset of courtyardAssets) {
  const spec = COURTYARD_ASSET_SPECS.find((candidate) => candidate.key === asset.key);
  if (asset.kind !== "scene" || asset.entityId !== asset.key.slice("scene:".length)
    || asset.role !== "scene" || asset.fit !== spec.fit
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/prototype/hub-draw/assets/${spec.sourceFile}`
    || asset.resourceFile !== `hub-courtyard/${spec.file}`
    || asset.resourcePath !== `hub-courtyard/${spec.file.slice(0, -".png".length)}`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`hub courtyard provenance or versioned identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== spec.width || asset.height !== spec.height
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`hub courtyard must retain its approved PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== spec.hasAlpha) {
    failures.push(`hub courtyard image metadata must preserve its alpha format: ${asset.key}`);
  }
}

const dungeonTransitionGates = assets.filter((asset) => asset.key === DUNGEON_TRANSITION_GATE_KEY);
if (dungeonTransitionGates.length !== 1) {
  failures.push("dungeon transition must include its approved stone gate");
}
for (const asset of dungeonTransitionGates) {
  if (asset.kind !== "scene" || asset.entityId !== "dungeon_transition_gate"
    || asset.role !== "scene" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== "infinite-flow-wechat/prototype/dungeon-transition/assets/ruined-stone-gate-v1.png"
    || asset.resourceFile !== "dungeon-world/ruined-stone-gate-v1.png"
    || asset.resourcePath !== "dungeon-world/ruined-stone-gate-v1"
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`dungeon gate provenance or versioned identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1073 || asset.height !== 1465
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`dungeon gate must retain its approved PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== true) {
    failures.push(`dungeon gate image metadata must preserve alpha: ${asset.key}`);
  }
}

const hubDungeonPortals = assets.filter((asset) => asset.key === HUB_DUNGEON_PORTAL_KEY);
if (hubDungeonPortals.length !== 1) {
  failures.push("hub dungeon entrance must include its approved Wanxiang scroll portal");
}
for (const asset of hubDungeonPortals) {
  if (asset.kind !== "scene" || asset.entityId !== "hub_dungeon_portal"
    || asset.role !== "scene" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== "infinite-flow-wechat/prototype/hub-portals-ten/assets/hub-portal-07.png"
    || asset.resourceFile !== "hub-courtyard/wanxiang-scroll-portal-v1.png"
    || asset.resourcePath !== "hub-courtyard/wanxiang-scroll-portal-v1"
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== HUB_DUNGEON_PORTAL_SHA256
    || asset.targetSha256 !== HUB_DUNGEON_PORTAL_SHA256
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`hub dungeon portal provenance or approved image identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1018 || asset.height !== 1545
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`hub dungeon portal must retain its approved PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== true) {
    failures.push(`hub dungeon portal image metadata must preserve alpha: ${asset.key}`);
  }
}

const battleControls = assets.filter((asset) => asset.key === BATTLE_CONTROLS_KEY);
if (battleControls.length !== 1) {
  failures.push("battle must include its approved ink control strip");
}
for (const asset of battleControls) {
  if (asset.kind !== "scene" || asset.entityId !== "battle_controls_ink"
    || asset.role !== "scene" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== "infinite-flow-wechat/art-source/battle-ui/style-exploration-v6/ink-muted-palettes/black-white-overlay.png"
    || asset.resourceFile !== "scene/battle-controls-ink-v1.png"
    || asset.resourcePath !== "scene/battle-controls-ink-v1"
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== BATTLE_CONTROLS_SOURCE_SHA256
    || asset.targetSha256 !== BATTLE_CONTROLS_TARGET_SHA256
    || asset.transformation?.operation !== "resize-png" || asset.transformation?.tool !== "sips") {
    failures.push(`battle controls provenance or approved image identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  const sourceDimensions = asset.transformation?.sourceDimensions;
  if (asset.width !== 1086 || asset.height !== 362
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height
    || sourceDimensions?.width !== 2172 || sourceDimensions?.height !== 724) {
    failures.push(`battle controls must be the approved 2172x724 strip at exactly half size: ${asset.key}`);
  }
  try {
    const source = pngDimensions(readFileSync(resolve(repositoryRoot, asset.sourceFile)));
    if (source.width !== 2172 || source.height !== 724) failures.push(`battle controls source dimensions mismatch: ${asset.key}`);
  } catch (error) {
    failures.push(`battle controls source unreadable: ${asset.key}: ${String(error)}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== true) {
    failures.push(`battle controls image metadata must preserve alpha: ${asset.key}`);
  }
}

const styleRefreshAssets = assets.filter((asset) => STYLE_REFRESH_ASSET_KEYS.has(asset.key));
if (!sameStringSet(styleRefreshAssets.map((asset) => asset.key), STYLE_REFRESH_ASSET_KEYS)) {
  failures.push("style refresh must include all 26 approved artworks");
}
for (const asset of styleRefreshAssets) {
  const spec = STYLE_REFRESH_ASSET_SPECS.find((candidate) => candidate.key === asset.key);
  if (asset.role !== spec.role || asset.fit !== spec.fit
    || asset.source !== "project-original-generated" || asset.sourceRevision !== spec.sourceRevision
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/prototype/style-refresh/assets/${spec.candidate}`
    || asset.resourceFile !== spec.resourceFile
    || asset.resourcePath !== spec.resourceFile.slice(0, -".png".length)
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== spec.sha256 || asset.targetSha256 !== spec.sha256
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`style refresh provenance or approved image identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== spec.width || asset.height !== spec.height
    || dimensions?.width !== spec.width || dimensions?.height !== spec.height) {
    failures.push(`style refresh must retain its approved PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== spec.hasAlpha) {
    failures.push(`style refresh image metadata must preserve alpha format: ${asset.key}`);
  }
}

const monsterIds = originalAssets.filter((asset) => asset.kind === "monster").map((asset) => asset.entityId);
if (monsterIds.length !== 59 || !sameStringSet(
  monsterWorldAssets.map((asset) => asset.key),
  monsterIds.map((id) => `monster:${id}_world`),
)) {
  failures.push("monster world sprites must cover exactly the 59 original monster identities");
}
for (const asset of monsterWorldAssets) {
  const id = asset.key.slice("monster:".length, -"_world".length);
  const slug = id.replaceAll("_", "-");
  if (asset.kind !== "monster" || asset.entityId !== `${id}_world`
    || asset.role !== "portrait" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/art-source/monster-world/${slug}-world-v1.png`
    || asset.resourceFile !== `monster-world/${slug}-world-v1.png`
    || asset.resourcePath !== `monster-world/${slug}-world-v1`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`monster world provenance or versioned identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1024 || asset.height !== 1536
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`monster world sprites must retain their original 1024x1536 PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== true) {
    failures.push(`monster world image metadata must preserve alpha: ${asset.key}`);
  }
}

const partyWorldAssets = assets.filter((asset) => PARTY_WORLD_ASSET_KEYS.has(asset.key));
if (!sameStringSet(partyWorldAssets.map((asset) => asset.key), PARTY_WORLD_ASSET_KEYS)) {
  failures.push("party world figures must cover exactly the three companions and six pets");
}
for (const asset of partyWorldAssets) {
  const spec = PARTY_WORLD_SPECS.find((candidate) => candidate.key === asset.key);
  const portraitKey = asset.key.slice(0, -"_world".length);
  if (!assets.some((candidate) => candidate.key === portraitKey)
    || asset.kind !== spec.folder || asset.entityId !== asset.key.slice(`${spec.folder}:`.length)
    || asset.role !== "portrait" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/art-source/party-world/${spec.slug}-world-v1.png`
    || asset.resourceFile !== `${spec.folder}/${spec.slug}-world-v1.png`
    || asset.resourcePath !== `${spec.folder}/${spec.slug}-world-v1`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== spec.sha256 || asset.targetSha256 !== spec.sha256
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`party world provenance or approved image identity mismatch: ${asset.key}`);
  }
  const dimensions = asset.transformation?.targetDimensions;
  if (asset.width !== 1024 || asset.height !== 1536
    || dimensions?.width !== asset.width || dimensions?.height !== asset.height) {
    failures.push(`party world figures must retain their original 1024x1536 PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== true) {
    failures.push(`party world image metadata must preserve alpha: ${asset.key}`);
  }
}

const runRelicIcons = assets.filter((asset) => asset.key.startsWith("item:run_relic_"));
if (!sameStringSet(runRelicIcons.map((asset) => asset.key), RUN_RELIC_ICON_KEYS)) {
  failures.push("run relic HUD must include exactly the nine approved icon identities");
}
for (const asset of runRelicIcons) {
  const spec = RUN_RELIC_ICON_SPECS.find(({ id }) => asset.key === `item:run_relic_${id}`);
  if (!spec) continue;
  if (asset.kind !== "item" || asset.entityId !== `run_relic_${spec.id}`
    || asset.role !== "icon" || asset.fit !== "contain"
    || asset.source !== "project-original-generated" || asset.sourceRevision !== 1
    || Object.prototype.hasOwnProperty.call(asset, "webSourcePath")
    || asset.sourceFile !== `infinite-flow-wechat/prototype/hud-buff-icons-v1/assets/${spec.id}.png`
    || asset.resourceFile !== `run-relic/${spec.id}-v1.png`
    || asset.resourcePath !== `run-relic/${spec.id}-v1`
    || asset.sourceFormat !== "png" || asset.targetFormat !== "png"
    || asset.cocosImageImport !== "supported"
    || asset.sourceSha256 !== spec.sha256 || asset.targetSha256 !== spec.sha256
    || asset.transformation?.operation !== "byte-copy") {
    failures.push(`run relic icon provenance or approved image identity mismatch: ${asset.key}`);
  }
  if (asset.width !== 1254 || asset.height !== 1254
    || asset.transformation?.targetDimensions?.width !== asset.width
    || asset.transformation?.targetDimensions?.height !== asset.height) {
    failures.push(`run relic icon must retain its approved 1254x1254 PNG dimensions: ${asset.key}`);
  }
  const meta = readCreatorMeta(resolve(resourceRoot, `${asset.resourceFile}.meta`), asset.key);
  if (meta?.userData?.hasAlpha !== false) {
    failures.push(`run relic icon image metadata must preserve its RGB format: ${asset.key}`);
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
    if (monsterWorldKeys.has(asset.key) || PARTY_WORLD_ASSET_KEYS.has(asset.key) || COURTYARD_PROP_KEYS.has(asset.key)
      || STYLE_REFRESH_ALPHA_KEYS.has(asset.key) || asset.key === HERO_WALK_KEY
      || asset.key === DUNGEON_TRANSITION_GATE_KEY || asset.key === HUB_DUNGEON_PORTAL_KEY || asset.key === BATTLE_CONTROLS_KEY) {
      const alpha = pngRgbaAlpha(targetBytes);
      if (alpha.transparentPixels === 0 || alpha.visiblePixels === 0) {
        failures.push(`world sprite must have both transparent and visible pixels: ${asset.key}`);
      }
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
    const sourceBytes = readFileSync(sourcePath);
    const actualSourceHash = sha256(sourceBytes);
    if (actualSourceHash !== asset.sourceSha256) {
      failures.push(`source SHA-256 mismatch: ${asset.key}`);
    }
    if (
      asset.transformation?.operation === "byte-copy"
      && actualSourceHash !== asset.targetSha256
    ) {
      failures.push(`byte-copy is not byte-identical: ${asset.key}`);
    }
    if (monsterWorldKeys.has(asset.key) || PARTY_WORLD_ASSET_KEYS.has(asset.key) || COURTYARD_ASSET_KEYS.has(asset.key)
      || STYLE_REFRESH_ASSET_KEYS.has(asset.key) || RUN_RELIC_ICON_KEYS.has(asset.key) || asset.key === HERO_WALK_KEY
      || asset.key === DUNGEON_TRANSITION_GATE_KEY || asset.key === HUB_DUNGEON_PORTAL_KEY) {
      const dimensions = pngDimensions(sourceBytes);
      if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
        failures.push(`world source dimensions mismatch: ${asset.key}`);
      }
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
    monsterWorldSprites: monsterWorldAssets.length,
    partyWorldFigures: partyWorldAssets.length,
    courtyardAssets: courtyardAssets.length,
    dungeonTransitionGates: dungeonTransitionGates.length,
    hubDungeonPortals: hubDungeonPortals.length,
    battleControls: battleControls.length,
    styleRefreshAssets: styleRefreshAssets.length,
    runRelicIcons: runRelicIcons.length,
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
