# Cocos runtime asset provenance

This snapshot was derived from the Web runtime asset contract at source commit
`2645f0232542684d27de1abc321bb26913320420` (2026-08-07):

- `infinite-flow/src/game-assets.ts` (`GAME_ASSET_MANIFEST_VERSION = 1`)
- `infinite-flow/src/game-assets.test.ts`
- `infinite-flow/scripts/asset-inventory.ts`
- `infinite-flow/docs/knowledge-base/04-assets-and-ui-contract.md`
- `infinite-flow/docs/knowledge-base/05-mini-game-migration-plan.md`

Only files referenced by `GAME_ASSET_MANIFEST` were selected for the initial snapshot. It contains exactly
187 Cocos runtime files grouped under `assets/resources/<kind>/`: 1 character,
6 NPCs, 59 monsters, 65 equipment, 6 pets, 30 items, 19 dungeons, and 1 scene.
The 185 PNG sources are byte copies; the two SVG sources are deterministically
rasterized PNG derivatives described below.

The current Cocos manifest adds one original walking atlas and 19 dungeon world
backgrounds to that unchanged snapshot: 207 PNG runtime assets in total, including
2 character assets and 20 scenes. Their source PNGs and exact generation prompts
live in `infinite-flow-wechat/art-source/`; they do not change the Web source
manifest or replace the existing character portrait, dungeon banners, or hub scene.

## Target manifest

`assets/config/asset-manifest.json` preserves every original stable `<kind>:<entityId>`
key and all Web metadata. Each entry also records:

- `resourcePath`: extensionless path relative to `assets/resources`, suitable as
  the base Cocos resources lookup path after import.
- `resourceFile`: physical file path relative to `assets/resources`.
- `sourceFile`: repository-relative authoritative source file.
- `webSourcePath`: the authoritative Web manifest source path, for migrated Web assets.
- `sourceSha256` / `targetSha256`: lowercase SHA-256 of authoritative source and
  target bytes.
- `transformation`: operation, tool, tool/platform version, command when relevant,
  and verified target dimensions.
- `cocosImageImport`: whether the physical target format is supported for Cocos
  image import.

Manifest revision
`sha256:c4a23d779df900b49cd9eae86d7be7ce5be7be03e6737e42e03cd0a3294b9ced`
is the SHA-256 of compact `JSON.stringify` output for the ordered object
`{ schemaVersion, sourceManifest, resourceRoot, assets }`. It binds stable keys,
target paths, metadata, source revision, source commit, both byte hashes, and all
transformation audit data.

## Cocos walking atlas

`character:reincarnator_walk` resolves to
`character/reincarnator-walk-v1` through the same `ManifestCocosAssetPort` as the
other resources. `character:reincarnator` remains the original portrait key.

- Authoritative source: `infinite-flow-wechat/art-source/reincarnator-walk-v1.png`.
- Exact generation prompt: `infinite-flow-wechat/art-source/reincarnator-walk-v1.prompt.txt`.
- Cocos target: `assets/resources/character/reincarnator-walk-v1.png`.
- Generation: built-in `image_gen`, 2026-09-07; original RGBA PNG, with no image post-processing.
- Verified dimensions: 1254 × 1254, 8-bit RGBA, 1,190,135 bytes. The prompt requested
  1024 × 1024; runtime cells use the actual dimensions divided into four rows and
  four columns. Rows face down, left, right, and up, with four walking frames per row.
- Source and target SHA-256:
  `60ab8c83067b17079d4eed210a1764bef65af66cca2585afffbe61472f1548a9`.
- Transfer: byte-identical `cp`, macOS 26.5.1 (25F80); source alpha remains intact.
- New image UUID: `3fb66656-ebec-4df1-b04a-1ffd729428ba`, with a texture redirect
  using the existing Creator 3.8.8 metadata format. This is source metadata, not
  evidence that Creator preview or a device accepted the new candidate.

The 188-asset snapshot before dungeon world backgrounds was 23,491,414 bytes.
Removing this atlas and the 19 added background entries leaves the original
ordered 187 entries byte-for-byte equivalent under
compact JSON serialization (SHA-256
`1a01fae99f7faba6d7285b7fd416ecfb0e4432913956396a65234f392202715c`).

## Cocos dungeon world backgrounds

The 19 original dungeon IDs each have one square, top-down exploration background.
These are additional scene assets; the original dungeon banners and the hub scene
remain unchanged. Their stable key is `scene:dungeon_world_<dungeonId>`, their
`kind` and `role` are `scene`, and their `entityId` is
`dungeon_world_<dungeonId>`.

- Authoritative sources: `infinite-flow-wechat/art-source/dungeon-world/<dungeonId>-v1.png`.
- Exact prompts: `infinite-flow-wechat/art-source/dungeon-world/<dungeonId>-v1.prompt.txt`.
- Cocos targets: `assets/resources/dungeon-world/<dungeonId>-v1.png`.
- Generation: built-in `image_gen`, 2026-09-07; original PNG outputs with no image post-processing.
- All 19 measured files are 1254 × 1254, 8-bit RGB. Their combined size is
  53,211,295 bytes. Each source and target is byte-identical after
  `cp` on macOS 26.5.1 (25F80).
- Provenance: `source=project-original-generated`, `sourceRevision=1`, and
  `transformation.operation=byte-copy`. None has `webSourcePath`, so none
  changes the frozen Web snapshot.
- Creator metadata uses the existing image-to-texture redirect format with
  distinct UUIDs and a plain directory metadata entry. The new directory inherits
  the existing resources bundle; it does not define a new bundle.

| Dungeon ID | Chapter | PNG bytes | Source and target SHA-256 |
| --- | --- | ---: | --- |
| `demon_tower_1` | 妖塔一层 | 2,840,057 | `955674f151e05823f676b768e3585da4f64ede7fff15cea2486952cc4a84b88f` |
| `metro_abyss` | 镜潮地铁 | 2,803,389 | `3dac4b8f1116de1fc4c2ea86ae1324c3bef0f7e5340d6f6c5e37dc20dbdc9955` |
| `starfall_mine` | 星坠矿井 | 2,946,134 | `4112c489f19d8fd7513626abf1ecae5bc7e5bb4bbf08bf9e41bc0a0b3aeaca39` |
| `rust_hospital` | 锈疫病院 | 2,781,376 | `42f6c7dccba2a510278489d1e2a1858fbf456a27269d1909eb7ee2dc66007d39` |
| `ash_arena` | 灰烬竞技场 | 3,096,488 | `7456d653d34f2f040ef7dd638c4d4abc804614190419b59346fdb2a1df2e56a2` |
| `dream_archive` | 梦档案馆 | 2,583,221 | `b7ec527eeb1322c38c95cd2fc7d36b6084731e11a27fbc3482bb8a1b783deff9` |
| `void_citadel` | 虚界城 | 2,734,279 | `ad2f99e7dd243db53b7edde8cb4dd74ad60daae7c83853fa6b7af736ec592608` |
| `temporal_observatory` | 时序观测庭 | 3,263,864 | `099499f7bf0abf105de1b428354f48238ee669120082b4c9a8238f9a5dde6bfd` |
| `causal_clearinghouse` | 因果清算所 | 2,858,461 | `fb8f209e6be8d37c90d368c1828eb21af896a17aad7746b8f1da10f19fbf5728` |
| `entropy_ark` | 熵海方舟 | 2,885,397 | `8e97f12ffc1d620254692df885e2db0d5d2e926b78ec4f5d6f5b2b6be58cc948` |
| `mirror_cycle_city` | 镜海轮回城 | 3,203,723 | `7d2c6e4b864bdc90828c1625e1077e9517dedb1713420f96d10613439cd79dab` |
| `redaction_scriptorium` | 删界终稿院 | 2,667,174 | `bfc32f54936772e50a40226e9f5104b78969df38e13caefdc667e3ca3e0a099c` |
| `legacy_auction_court` | 亡队遗产拍卖庭 | 2,764,595 | `096f8eda3627d923f6d512fd8c8ba4939c6fcd1dbef94f73424f8e95440a99ce` |
| `genesis_vault` | 众生原型库 | 2,831,060 | `eccc934375cbba378af0fb11dc526210058f8382c75345a88895d5b06f9f11d8` |
| `silent_broadcast_tower` | 寂声广播塔 | 2,472,191 | `b0e85c70611998bb9d04f546f2d4ce5a5cb7042b5c3006f9ed6e627766bd46f9` |
| `lost_shelter` | 失联避难所 | 2,417,669 | `4803d14622f9ab18cde88154964f84f23b703721a4b83eed345f79946834add8` |
| `false_testimony_court` | 伪证裁定庭 | 2,655,842 | `66235262bf905bfa6a734ad104e72b471cda05cc5efb5cd7e9e3d1c10c4d4b91` |
| `combat_replay_stage` | 战痕复演场 | 2,527,150 | `84fb0bfa0be0d23712dcd44a177603f8d6f45e4fed0fdcae01352f135b57f0d6` |
| `panopticon_city` | 天幕监察城 | 2,879,225 | `59b033f7a65b70acd079a304f635aed3daf0cc31654382eb78eed3416f5d60b8` |

The full resource set is now 76,702,709 bytes across 207 PNGs.
The runtime and WeChat profile pin this exact revision, count, and byte total.
The existing remote-only resources placement and source-byte evidence boundary
remain unchanged; these source checks are not proof of a successful Creator
build, remote deployment, or device run.

Removing the 19 `scene:dungeon_world_` entries leaves the previous ordered 188
entries unchanged under compact JSON serialization (SHA-256
`37b55ba133a83ba2c1b713d437be2b24345dbf01314ce91275b475033d39906f`).
The old PNG files and their Creator metadata also remain byte-for-byte unchanged.
`npm run assets:verify`
checks exact 19-ID coverage, square dimensions, versioned identities, provenance,
physical source/target hashes, and the frozen 188-entry projection.

## Deliberate exclusions

The eight files present in `infinite-flow/public/` but absent from the stable
runtime manifest were not copied:

- `combat-replay-stage.svg`
- `false-testimony-court.svg`
- `genesis-vault.svg`
- `legacy-auction-court.svg`
- `lost-shelter.svg`
- `panopticon-city.svg`
- `redaction-scriptorium.svg`
- `silent-broadcast-tower.svg`

`infinite-flow/art-source/` was also excluded. Its prompts and uncropped generation
atlases are production source material, not runtime assets.

## SVG authority and Cocos PNG derivation

The Web source set contains 185 PNG files and two SVG files. Cocos Creator 3.8
documents PNG among its supported image formats but does not list SVG. The Cocos
initial target therefore contains 187 PNG files and no SVG files; the added walking
atlas and 19 world backgrounds bring the current target to 207 PNG files.
The original SVGs remain the authoritative, unchanged Web sources and are referenced by `sourceFile`,
`webSourcePath`, and `sourceSha256` in the target manifest.

| Stable key | Authoritative source | Cocos target | Target size | Source SHA-256 | Target SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| `dungeon:mirror_cycle_city` | `infinite-flow/public/mirror-cycle-city.svg` | `dungeon/mirror-cycle-city.png` | 720 × 180 | `49913a3a74e0d752288de4f631436f5927b1c06ef638bbc16bd36a35cc3095b3` | `7e82295cfbb86c1d8babd7433d1a2ff8a908e57381ac63292947dcaa17ac3f80` |
| `scene:main_god_space` | `infinite-flow/public/main-god-space.svg` | `scene/main-god-space.png` | 1600 × 900 | `63679dcc79449c35ae3303c848fba51af51230720a87de1a1c57271948d310f0` | `a21decb68d2608a054072c79fc2708ba2081849010a1c5534ec96deb3cf66c3a` |

Both derivatives were created with:

```text
sips -s format png <sourceFile> --out <resourceFile>
```

Audit environment: `sips-316`, macOS `26.5.1` build `25F80`. Two independent
conversions of each SVG produced byte-identical target hashes and the exact target
dimensions above. `sips` emitted a non-fatal CoreSVG diagnostic while returning
exit code 0; both outputs passed byte-repeatability, PNG signature, dimension, and
visual-content checks.

Future regeneration must use an explicitly recorded tool/version and update the
target hash plus `manifestRevision`; never replace or edit the authoritative Web
SVG to accommodate the Cocos importer.

References:

- [Cocos Creator 3.8 image formats](https://docs.cocos.com/creator/3.8/manual/en/asset/image.html)
- [Cocos Creator 3.8 resources and SpriteFrame loading](https://docs.cocos.com/creator/3.8/manual/en/asset/asset-manager.html)

The first import was completed by the installed Cocos Creator 3.8.8 editor. Its
generated `.meta` files are checked in so a clean clone preserves scene/script and
image UUID identity. The original import produced 214 metadata files; moving the
platform-only self-check and its tsconfig out of `assets/` removed those two subjects
and their metadata, leaving 212 exact content/directory pairs with no orphan.

`npm run assets:verify` requires every asset and subdirectory to have parseable
Creator metadata, unique canonical UUIDs, the expected importer, and—on all 207
PNGs—a valid image-to-texture redirect. The `resources/` tree may contain only the
207 manifest PNGs, their image metadata, and directory metadata; SVGs and unrelated
files remain forbidden. Creator UUIDs are adapter identity only and never replace
the manifest's stable domain keys.
