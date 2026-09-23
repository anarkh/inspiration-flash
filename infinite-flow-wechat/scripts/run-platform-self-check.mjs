import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "infinite-flow-platform-"));
const bundlePath = join(temporaryDirectory, "self-check.mjs");

try {
  await build({
    entryPoints: [
      join(projectRoot, "cocos/headless/platform.self-check.ts"),
    ],
    outfile: bundlePath,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
      },
    },
    alias: {
      "@infinite-flow/runtime": join(
        projectRoot,
        "packages/runtime/src/index.ts",
      ),
    },
    logLevel: "warning",
  });

  const selfCheck = await import(pathToFileURL(bundlePath).href);
  const report = await selfCheck.runPlatformSelfCheck();
  const expectedSuites = [
    "storage-journal",
    "secure-seeds",
    "lifecycle",
    "assets",
  ];

  if (
    report.assertions !== 90
    || JSON.stringify(report.suites) !== JSON.stringify(expectedSuites)
  ) {
    throw new Error(`Unexpected platform self-check report: ${JSON.stringify(report)}`);
  }

  console.log(`PLATFORM_SELF_CHECK_VALID ${JSON.stringify(report)}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
