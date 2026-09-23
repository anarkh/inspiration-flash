import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { transform } from "esbuild";
import ts from "typescript";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageBuilds = [
  ["core", "tsconfig.build.json"],
  ["runtime", "tsconfig.json"],
  ["application", "tsconfig.build.json"],
  ["client", "tsconfig.build.json"],
  ["presentation", "tsconfig.build.json"],
  ["save-codec", "tsconfig.build.json"],
];
const configuredPackageNames = new Set(packageBuilds.map(([packageName]) => `@infinite-flow/${packageName}`));

// ECMAScript built-ins introduced after ES2020. TypeScript's ES2020 lib catches
// normal source usage; this emitted-code scan also catches JS injection and `any`.
const forbiddenGlobals = new Map([
  ["AggregateError", "ES2021"],
  ["AsyncDisposableStack", "ES2024"],
  ["DisposableStack", "ES2024"],
  ["FinalizationRegistry", "ES2021"],
  ["Float16Array", "ES2025"],
  ["Iterator", "ES2025"],
  ["SuppressedError", "ES2024"],
  ["WeakRef", "ES2021"],
]);
const forbiddenStaticMembers = new Map([
  ["Array.fromAsync", "ES2024"],
  ["Atomics.waitAsync", "ES2024"],
  ["Map.groupBy", "ES2024"],
  ["Math.f16round", "ES2025"],
  ["Object.groupBy", "ES2024"],
  ["Object.hasOwn", "ES2022"],
  ["Promise.any", "ES2021"],
  ["Promise.try", "ES2025"],
  ["Promise.withResolvers", "ES2024"],
  ["RegExp.escape", "ES2025"],
]);
const forbiddenInstanceMembers = new Map([
  ["at", "ES2022"],
  ["findLast", "ES2023"],
  ["findLastIndex", "ES2023"],
  ["isWellFormed", "ES2024"],
  ["replaceAll", "ES2021"],
  ["toReversed", "ES2023"],
  ["toSorted", "ES2023"],
  ["toSpliced", "ES2023"],
  ["toWellFormed", "ES2024"],
]);

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScriptFiles(path));
    else if (entry.isFile() && extname(entry.name) === ".js") files.push(path);
  }
  return files;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function collectExportTargets(exportsValue, targets = []) {
  if (typeof exportsValue === "string") targets.push(exportsValue);
  else if (exportsValue && typeof exportsValue === "object") {
    for (const value of Object.values(exportsValue)) collectExportTargets(value, targets);
  }
  return targets;
}

async function discoverCocosWorkspaceDependencies() {
  const packagesDirectory = join(projectRoot, "packages");
  const workspacePackages = new Map();
  for (const entry of await readdir(packagesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(packagesDirectory, entry.name);
    let manifest;
    try {
      manifest = await readJson(join(directory, "package.json"));
    } catch {
      continue;
    }
    if (typeof manifest.name === "string" && manifest.name.startsWith("@infinite-flow/")) {
      workspacePackages.set(manifest.name, { directory, manifest });
    }
  }

  const cocosManifest = await readJson(join(projectRoot, "cocos", "package.json"));
  const queue = Object.keys(cocosManifest.dependencies ?? {}).filter((name) => name.startsWith("@infinite-flow/"));
  const discovered = new Set();
  while (queue.length > 0) {
    const name = queue.shift();
    if (discovered.has(name)) continue;
    discovered.add(name);
    const workspacePackage = workspacePackages.get(name);
    if (!workspacePackage) throw new Error(`Cocos dependency ${name} is not a local workspace package`);
    const runtimeDependencies = {
      ...workspacePackage.manifest.dependencies,
      ...workspacePackage.manifest.optionalDependencies,
    };
    for (const dependency of Object.keys(runtimeDependencies)) {
      if (dependency.startsWith("@infinite-flow/") && !discovered.has(dependency)) queue.push(dependency);
    }
  }
  return { discovered, workspacePackages };
}

async function assertDependencyCoverageAndExports() {
  const { discovered, workspacePackages } = await discoverCocosWorkspaceDependencies();
  const missing = [...discovered].filter((name) => !configuredPackageNames.has(name));
  const stale = [...configuredPackageNames].filter((name) => !discovered.has(name));
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `Cocos dependency coverage differs from ES2020 gate; missing: ${missing.join(", ") || "none"}; stale: ${stale.join(", ") || "none"}`,
    );
  }
  for (const name of discovered) {
    const { directory, manifest } = workspacePackages.get(name);
    const targets = collectExportTargets(manifest.exports);
    if (targets.length === 0) throw new Error(`${name}: package exports declare no targets`);
    for (const target of targets) {
      if (!target.startsWith("./")) throw new Error(`${name}: unsupported non-relative export target ${target}`);
      if (target.includes("*")) throw new Error(`${name}: wildcard export targets require explicit ES2020 gate support: ${target}`);
      try {
        await access(resolve(directory, target));
      } catch {
        throw new Error(`${name}: exported target does not exist: ${target}`);
      }
    }
  }
}

function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return undefined;
}

function staticMemberName(node) {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return undefined;
  const property = memberName(node);
  return property && ts.isIdentifier(node.expression) ? `${node.expression.text}.${property}` : undefined;
}

function findForbiddenBuiltins(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const failures = [];
  const visit = (node) => {
    if (ts.isIdentifier(node)) {
      const edition = forbiddenGlobals.get(node.text);
      const isPropertyName = (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
        || (ts.isPropertyAssignment(node.parent) && node.parent.name === node);
      if (edition && !isPropertyName) failures.push(`${node.text} (${edition})`);
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const staticName = staticMemberName(node);
      const staticEdition = staticName && forbiddenStaticMembers.get(staticName);
      if (staticEdition) failures.push(`${staticName} (${staticEdition})`);
      const property = memberName(node);
      const instanceEdition = property && forbiddenInstanceMembers.get(property);
      if (instanceEdition && !staticEdition) failures.push(`.${property} (${instanceEdition})`);
    }
    if (
      ts.isNewExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "Error"
      && (node.arguments?.length ?? 0) > 1
    ) {
      failures.push("Error options/cause (ES2022)");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...new Set(failures)];
}

async function assertCompilerContract(packageName, configName) {
  const configPath = join(projectRoot, "packages", packageName, configName);
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath));
  if (parsed.errors.length > 0) {
    throw new Error(ts.formatDiagnostics(parsed.errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => projectRoot,
      getNewLine: () => "\n",
    }));
  }
  if (parsed.options.target !== ts.ScriptTarget.ES2020) {
    throw new Error(`${packageName}: resolved build target must be ES2020`);
  }
  const libs = parsed.options.lib ?? [];
  if (libs.length !== 1 || !libs[0].endsWith("lib.es2020.d.ts")) {
    throw new Error(`${packageName}: resolved lib must be exactly ES2020, got ${libs.join(", ") || "default"}`);
  }
}

async function assertEs2020Syntax(source, fileName) {
  const shared = {
    charset: "utf8",
    format: "esm",
    legalComments: "none",
    loader: "js",
    minifyWhitespace: true,
  };
  const esNext = await transform(source, { ...shared, target: "esnext" });
  const es2020 = await transform(source, { ...shared, target: "es2020" });
  if (esNext.code !== es2020.code) {
    throw new Error(`${fileName}: contains syntax that esbuild must downlevel for ES2020`);
  }
}

function runDetectorSelfCheck() {
  const findings = findForbiddenBuiltins(
    "Promise.any([]); value.replaceAll('a', 'b'); new WeakRef(value); Object.hasOwn({}, 'x'); new Error('x', { cause: value });",
    "self-check.js",
  );
  for (const expected of ["Promise.any (ES2021)", ".replaceAll (ES2021)", "WeakRef (ES2021)", "Object.hasOwn (ES2022)", "Error options/cause (ES2022)"]) {
    if (!findings.includes(expected)) throw new Error(`built-in detector self-check missed ${expected}`);
  }
  if (findForbiddenBuiltins("const text = 'Promise.any and .replaceAll';", "self-check.js").length > 0) {
    throw new Error("built-in detector self-check treated string content as code");
  }
}

runDetectorSelfCheck();
await assertEs2020Syntax("const value = input?.value ?? 0;", "syntax-self-check-es2020.js");
for (const [source, fileName] of [
  ["value ??= 1;", "syntax-self-check-es2021.js"],
  ["class Candidate { field = 1; }", "syntax-self-check-es2022-class-field.js"],
]) {
  let rejectedPostEs2020Syntax = false;
  try {
    await assertEs2020Syntax(source, fileName);
  } catch {
    rejectedPostEs2020Syntax = true;
  }
  if (!rejectedPostEs2020Syntax) throw new Error(`syntax detector self-check accepted ${fileName}`);
}

const failures = [];
let checkedFiles = 0;
try {
  await assertDependencyCoverageAndExports();
} catch (error) {
  failures.push(String(error instanceof Error ? error.message : error));
}
for (const [packageName, configName] of packageBuilds) {
  try {
    await assertCompilerContract(packageName, configName);
  } catch (error) {
    failures.push(String(error instanceof Error ? error.message : error));
  }
  const distDir = join(projectRoot, "packages", packageName, "dist");
  let files;
  try {
    files = await collectJavaScriptFiles(distDir);
  } catch (error) {
    failures.push(`${packageName}: dist is missing or unreadable; run the build first (${String(error)})`);
    continue;
  }
  if (files.length === 0) failures.push(`${packageName}: dist contains no JavaScript files`);
  for (const file of files) {
    checkedFiles += 1;
    const displayName = relative(projectRoot, file);
    const source = await readFile(file, "utf8");
    try {
      await assertEs2020Syntax(source, displayName);
    } catch (error) {
      failures.push(String(error instanceof Error ? error.message : error));
    }
    const builtins = findForbiddenBuiltins(source, displayName);
    if (builtins.length > 0) failures.push(`${displayName}: post-ES2020 built-ins: ${builtins.join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("ES2020 dist verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`ES2020 dist verification passed (${packageBuilds.length} packages, ${checkedFiles} JavaScript files).`);
}
