import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourceFiles = ['index.ts', 'tokens.ts', 'types.ts', 'view-model.ts'];
const sourceDirectory = new URL('../src/', import.meta.url);
const forbidden = [
  ['DOM global', /\b(?:document|window|navigator|localStorage|sessionStorage)\b/],
  ['WeChat API', /\bwx\s*\./],
  ['Cocos runtime import', /(?:from|import\s*)\s*['"]cc['"]/],
  ['implicit random', /Math\.random\s*\(/],
  ['wall clock', /\bDate(?:\.now\s*\(|\s*\()/],
  ['high-resolution clock', /performance\.now\s*\(/]
];

const failures = [];
for (const file of sourceFiles) {
  const source = readFileSync(new URL(file, sourceDirectory), 'utf8');
  for (const [label, pattern] of forbidden) {
    if (pattern.test(source)) failures.push(`${file}: ${label}`);
  }
}

const tsconfigPath = new URL('../tsconfig.json', import.meta.url);
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
const libraries = tsconfig.compilerOptions?.lib ?? [];
if (libraries.some((library) => String(library).toLowerCase().startsWith('dom'))) {
  failures.push(`${fileURLToPath(tsconfigPath)}: DOM library enabled`);
}

if (failures.length > 0) {
  throw new Error(`Presentation platform-neutral gate failed:\n${failures.join('\n')}`);
}

console.log(`presentation platform-neutral gate: ${sourceFiles.length} sources checked`);
