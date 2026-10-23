import { resolve, relative, dirname } from "node:path";
import ts from "typescript";

// The Cocos/WeChat build lowers [...x] to [].concat(x) and f(...x) to f.apply(void 0, x).
// Both only work when x is a real array: a Set, a Map, an iterator or a string silently
// becomes a single element (or no arguments) in the shipped game, while Node tests pass.
// Every spread operand in shipped source must therefore have an array or tuple type;
// use Array.from(...) for anything else.

const projectRoot = resolve(import.meta.dirname, "..");
const configs = [
  "packages/core/tsconfig.build.json",
  "packages/runtime/tsconfig.json",
  "packages/application/tsconfig.build.json",
  "packages/save-codec/tsconfig.build.json",
  "packages/client/tsconfig.build.json",
  "packages/presentation/tsconfig.build.json",
  "cocos/tsconfig.headless.json",
];

function isShippedSource(file) {
  if (file.startsWith("..") || file.includes("node_modules") || /\/(test|tests|headless)\//.test(file)) return false;
  return (file.startsWith("packages/") && file.includes("/src/")) || file.startsWith("cocos/assets/scripts/");
}

const findings = new Set();
let checked = 0;
for (const config of configs) {
  const configPath = resolve(projectRoot, config);
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(`${config}: ${ts.flattenDiagnosticMessageText(read.error.messageText, "\n")}`);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const isArrayLike = (type) => type.isUnion()
    ? type.types.every(isArrayLike)
    : checker.isArrayType(type) || checker.isTupleType(type) || (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Never)) !== 0;
  for (const sourceFile of program.getSourceFiles()) {
    const file = relative(projectRoot, sourceFile.fileName);
    if (sourceFile.isDeclarationFile || !isShippedSource(file)) continue;
    const visit = (node) => {
      if (ts.isSpreadElement(node)) {
        checked += 1;
        const type = checker.getTypeAtLocation(node.expression);
        if (!isArrayLike(type)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.add(`${file}:${line + 1} spreads ${checker.typeToString(type)}: ${node.getText().slice(0, 80)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

if (findings.size > 0) {
  console.error(Array.from(findings).sort().join("\n"));
  console.error(`${findings.size} spread(s) of a non-array value; the Cocos/WeChat build breaks them. Use Array.from(...).`);
  process.exit(1);
}
if (checked === 0) throw new Error("No spread operands were checked; the source configuration is wrong.");
console.log(`Target-safe spreads verified: ${checked} spread operands in shipped package and Cocos sources are arrays or tuples.`);
