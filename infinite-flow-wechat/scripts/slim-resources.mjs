// Applies scripts/resource-slimming.mjs to the Cocos resources. Every planned texture is derived again from its
// recorded source with sips; when the format changes the Creator metadata moves with the file and keeps its UUID.
// The manifest entries, counts and revision and the pinned WeChat bundle profile are rewritten to match.
// Usage: node scripts/slim-resources.mjs   (macOS sips; then npm run assets:verify)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { JPEG_QUALITY, SLIMMING_TOOL, slimmedDimensions, slimmingOperation, slimmingPlan } from './resource-slimming.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const repositoryRoot = path.resolve(projectRoot, '..');
const manifestPath = path.join(projectRoot, 'cocos/assets/config/asset-manifest.json');
const profilePath = path.join(projectRoot, 'toolchain/wechat-bundle-profiles.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const resourceRoot = path.join(projectRoot, manifest.resourceRoot);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

/** Width and height from a PNG header or a JPEG start-of-frame marker. */
function imageSize(bytes, format) {
  if (format === 'png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  for (let offset = 2; offset + 9 < bytes.length;) {
    const marker = bytes[offset + 1];
    if (bytes[offset] !== 0xff) break;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('JPEG has no frame header');
}

const version = execFileSync('sips', ['--version'], { encoding: 'utf8' }).trim();
if (version !== SLIMMING_TOOL.version) throw new Error(`expected ${SLIMMING_TOOL.version}, found ${version}`);

let changed = 0;
for (const asset of manifest.assets) {
  const plan = slimmingPlan(asset.key);
  if (!plan) continue;
  const sourcePath = path.join(repositoryRoot, asset.sourceFile);
  const sourceBytes = fs.readFileSync(sourcePath);
  if (sha256(sourceBytes) !== asset.sourceSha256) throw new Error(`source differs from its recorded SHA-256: ${asset.key}`);
  if (asset.sourceFormat !== 'png') throw new Error(`slimming expects a PNG source: ${asset.key}`);
  const source = imageSize(sourceBytes, 'png');
  const target = slimmedDimensions(plan, source.width, source.height);
  const operation = slimmingOperation(plan, source.width, source.height);
  if (operation === 'byte-copy') throw new Error(`plan leaves the source as it is; drop its rule: ${asset.key}`);

  const resized = target.width !== source.width || target.height !== source.height;
  const args = [
    ...(plan.format === 'jpg' ? ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY)] : []),
    ...(resized ? ['-Z', String(plan.longSide)] : []),
  ];
  const resourceFile = `${asset.resourcePath}.${plan.format}`;
  const targetPath = path.join(resourceRoot, resourceFile);
  const previousPath = path.join(resourceRoot, asset.resourceFile);
  const meta = JSON.parse(fs.readFileSync(`${previousPath}.meta`, 'utf8'));
  if (plan.format === 'jpg' && meta.userData?.hasAlpha !== false) throw new Error(`JPEG cannot keep transparency: ${asset.key}`);

  execFileSync('sips', [...args, sourcePath, '--out', targetPath], { stdio: 'ignore' });
  if (resourceFile !== asset.resourceFile) {
    // Same asset, new file extension: the metadata (and its UUID) follows the file. Creator lists files sorted.
    writeJson(`${targetPath}.meta`, { ...meta, files: ['.json', `.${plan.format}`].sort() });
    fs.rmSync(`${previousPath}.meta`);
    fs.rmSync(previousPath);
  }
  const bytes = fs.readFileSync(targetPath);
  const actual = imageSize(bytes, plan.format);
  if (actual.width !== target.width || actual.height !== target.height) {
    throw new Error(`sips wrote ${actual.width}x${actual.height}, planned ${target.width}x${target.height}: ${asset.key}`);
  }
  asset.resourceFile = resourceFile;
  asset.targetFormat = plan.format;
  asset.width = target.width;
  asset.height = target.height;
  asset.targetSha256 = sha256(bytes);
  asset.transformation = {
    operation,
    tool: SLIMMING_TOOL.tool,
    version: SLIMMING_TOOL.version,
    command: `sips ${[...args, '<sourceFile>', '--out', '<resourceFile>'].join(' ')}`,
    ...(plan.format === 'jpg' ? { quality: JPEG_QUALITY } : {}),
    sourceDimensions: source,
    targetDimensions: target,
  };
  changed += 1;
}

const formats = {};
for (const asset of manifest.assets) formats[asset.targetFormat] = (formats[asset.targetFormat] ?? 0) + 1;
manifest.formatCounts.target = Object.fromEntries(Object.entries(formats).sort(([a], [b]) => (a < b ? -1 : 1)));
manifest.derivedAssetCount = manifest.assets.filter((asset) => asset.transformation.operation !== 'byte-copy').length;
const { schemaVersion, sourceManifest, resourceRoot: root, assets } = manifest;
manifest.manifestRevision = `sha256:${sha256(JSON.stringify({ schemaVersion, sourceManifest, resourceRoot: root, assets }))}`;
writeJson(manifestPath, manifest);

const resourceBytes = manifest.assets.reduce((sum, asset) => sum + fs.statSync(path.join(resourceRoot, asset.resourceFile)).size, 0);
const profiles = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
profiles.source.manifestRevision = manifest.manifestRevision;
profiles.source.resourceBytes = resourceBytes;
writeJson(profilePath, profiles);

console.log(JSON.stringify({ changed, formats: manifest.formatCounts.target, derivedAssetCount: manifest.derivedAssetCount, resourceBytes, manifestRevision: manifest.manifestRevision }, null, 2));
