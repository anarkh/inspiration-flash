import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const packagesRoot = resolve(projectRoot, "packages");
const cocosScriptsRoot = resolve(projectRoot, "cocos/assets/scripts");
const generatedSuffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];

function collectGeneratedFiles(directory, results) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      collectGeneratedFiles(path, results);
    } else if (generatedSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
      results.push(path.slice(projectRoot.length + 1));
    }
  }
}

const packageDirectories = readdirSync(packagesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const generatedFiles = [];
let sourceRootCount = 0;

for (const packageName of packageDirectories) {
  const sourceRoot = resolve(packagesRoot, packageName, "src");
  if (!existsSync(sourceRoot)) continue;
  sourceRootCount += 1;
  collectGeneratedFiles(sourceRoot, generatedFiles);
}

if (existsSync(cocosScriptsRoot)) {
  sourceRootCount += 1;
  collectGeneratedFiles(cocosScriptsRoot, generatedFiles);
}

generatedFiles.sort();
if (generatedFiles.length > 0) {
  console.error("Generated JavaScript/declaration artifacts are forbidden in package src/:");
  for (const path of generatedFiles) console.error(`- ${path}`);
  process.exit(1);
}

console.log(
  `SOURCE_BOUNDARIES_VALID sourceRoots=${sourceRootCount} generatedArtifacts=0`,
);
