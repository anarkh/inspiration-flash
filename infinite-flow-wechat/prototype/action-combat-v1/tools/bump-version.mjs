#!/usr/bin/env node
// Cache-busting for the prototype. The static server sends no cache headers, so every local URL the page loads
// carries ?v=N (one N everywhere). This tool:
//   node tools/bump-version.mjs           rewrites every ?v=<N> to N+1
//   node tools/bump-version.mjs --check   writes nothing; validates only
// Both modes fail (exit 1, nothing written) if a relative import / asset reference lacks ?v= or the N differ.
// Scanned: index.html, style.css, src/**/*.js, tests/**/*.{js,mjs} (tests import the same ?v= URLs as the page,
// otherwise Node would load a second copy of each module).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

function walk(dir, pattern) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path, pattern));
    else if (pattern.test(entry.name)) out.push(path);
  }
  return out;
}

const files = [
  join(ROOT, 'index.html'),
  join(ROOT, 'style.css'),
  ...walk(join(ROOT, 'src'), /\.js$/),
  ...walk(join(ROOT, 'tests'), /\.m?js$/),
];

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Every local URL in a file, with its line number. */
function references(path, text) {
  const found = [];
  const add = (regex, group) => {
    for (const match of text.matchAll(regex)) {
      const ref = match[group];
      if (!EXTERNAL.test(ref)) found.push({ ref, line: text.slice(0, match.index).split('\n').length });
    }
  };
  if (path.endsWith('.html')) add(/\b(?:src|href)\s*=\s*(['"])([^'"]+)\1/g, 2);
  else if (path.endsWith('.css')) add(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, 2);
  else {
    // Static and dynamic import specifiers, plus any string literal that is a relative path (asset URLs).
    add(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g, 2);
    add(/\bimport\s*\(?\s*(['"])([^'"]+)\1/g, 2);
    add(/(['"`])(\.{1,2}\/[^'"`\n]*?)\1/g, 2);
  }
  return found;
}

const problems = [];
const versions = new Map();
const contents = new Map();
for (const path of files) {
  const text = readFileSync(path, 'utf8');
  contents.set(path, text);
  const name = relative(ROOT, path);
  for (const { ref, line } of references(path, text)) {
    const problem = `${name}:${line}  missing ?v= on "${ref}"`;
    if (!/\?v=\d+(?:$|[&#])/.test(ref) && !problems.includes(problem)) problems.push(problem);
  }
  for (const match of text.matchAll(/\?v=(\d+)/g)) {
    const list = versions.get(match[1]) ?? [];
    list.push(name);
    versions.set(match[1], list);
  }
}
if (versions.size === 0) problems.push('no ?v= found at all');
if (versions.size > 1) {
  for (const [n, names] of versions) problems.push(`?v=${n} used in: ${[...new Set(names)].join(', ')}`);
  problems.push('all ?v= must share one number');
}

if (problems.length) {
  console.error(`bump-version: ${problems.length} problem(s), nothing written\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const [current] = versions.keys();
const count = [...versions.values()][0].length;
if (check) {
  console.log(`bump-version --check: OK, ${count} references at ?v=${current} across ${files.length} files`);
  process.exit(0);
}
const next = String(Number(current) + 1);
for (const [path, text] of contents) {
  const updated = text.replace(/\?v=\d+/g, `?v=${next}`);
  if (updated !== text) writeFileSync(path, updated);
}
console.log(`bump-version: ?v=${current} -> ?v=${next} (${count} references, ${files.length} files)`);
