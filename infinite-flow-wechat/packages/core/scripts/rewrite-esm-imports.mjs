import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const distRoot = join(packageRoot, 'dist');

async function listJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolute] : [];
  }));
  return nested.flat();
}

function hasRuntimeExtension(specifier) {
  return extname(specifier) !== '';
}

function rewriteRelativeSpecifier(_match, prefix, quote, specifier) {
  if (hasRuntimeExtension(specifier)) return `${prefix}${quote}${specifier}${quote}`;
  return `${prefix}${quote}${specifier}.js${quote}`;
}

const staticOrDynamicImport = /(from\s+|import\s*\(\s*|import\s+)(['"])(\.\.?\/[^'"\n]+)\2/g;

for (const file of await listJavaScriptFiles(distRoot)) {
  const source = await readFile(file, 'utf8');
  const rewritten = source.replace(staticOrDynamicImport, rewriteRelativeSpecifier);
  if (rewritten !== source) await writeFile(file, rewritten, 'utf8');
}
