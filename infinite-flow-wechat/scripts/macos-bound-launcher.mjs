import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  ToolchainBoundaryError,
  captureStableFile,
} from "./file-attestation.mjs";

const XCRUN = "/usr/bin/xcrun";
const SOURCE_PATH = resolve(
  import.meta.dirname,
  "../toolchain/macos-bound-launcher.py",
);
const TRUST_DISCOVERY_ENV = Object.freeze({
  HOME: "/var/empty",
  LANG: "C",
  LC_ALL: "C",
  PATH: "/usr/bin:/bin",
  TMPDIR: "/private/tmp",
});
const INJECTION_ENVIRONMENT_NAMES = new Set([
  "COCOS_WECHAT_BUILD_CONFIG",
  "DEVELOPER_DIR",
  "ELECTRON_RUN_AS_NODE",
  "NODE_OPTIONS",
  "NODE_PATH",
]);
let cachedInterpreter;

function fail(code) {
  throw new ToolchainBoundaryError(code);
}

function assertRootOwnedPath(
  path,
  { executable = false, directory = false, code = "bound-launch-tool-untrusted" } = {},
) {
  let canonical;
  try {
    canonical = realpathSync.native(path);
  } catch {
    fail(code);
  }
  let cursor = canonical;
  let first = true;
  while (true) {
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o022) !== 0) {
      fail(code);
    }
    if (first) {
      if (
        (directory ? !stat.isDirectory() : !stat.isFile())
        || (executable && (stat.mode & 0o111) === 0)
      ) {
        fail(code);
      }
      first = false;
    } else if (!stat.isDirectory()) {
      fail(code);
    }
    if (cursor === "/") break;
    cursor = dirname(cursor);
  }
  return canonical;
}

function assertRootOwnedSearchLocation(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    fail("bound-launch-interpreter-untrusted");
  }
  let existing = path;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) fail("bound-launch-interpreter-untrusted");
    existing = parent;
  }
  assertRootOwnedPath(existing, {
    directory: true,
    code: "bound-launch-interpreter-untrusted",
  });
}

function runXcrun(arguments_) {
  assertRootOwnedPath(XCRUN, {
    executable: true,
    code: "bound-launch-tool-untrusted",
  });
  const discovery = spawnSync(XCRUN, arguments_, {
    encoding: "utf8",
    env: TRUST_DISCOVERY_ENV,
    timeout: 10_000,
  });
  if (
    discovery.error
    || discovery.signal
    || discovery.status !== 0
    || !discovery.stdout.trim()
  ) {
    fail("bound-launch-tool-unavailable");
  }
  return discovery.stdout.trim();
}

export function resolveTrustedMacosCompiler() {
  if (process.platform !== "darwin") fail("bound-launch-macos-required");
  return assertRootOwnedPath(runXcrun(["--find", "clang"]), {
    executable: true,
    code: "bound-launch-compiler-untrusted",
  });
}

export function resolveTrustedMacosSdk() {
  if (process.platform !== "darwin") fail("bound-launch-macos-required");
  return assertRootOwnedPath(
    runXcrun(["--sdk", "macosx", "--show-sdk-path"]),
    { directory: true, code: "bound-launch-compiler-untrusted" },
  );
}

function resolveTrustedMacosPython() {
  if (process.platform !== "darwin") fail("bound-launch-macos-required");
  if (cachedInterpreter) return cachedInterpreter;

  const interpreter = assertRootOwnedPath(runXcrun(["--find", "python3"]), {
    executable: true,
    code: "bound-launch-interpreter-untrusted",
  });
  const probe = spawnSync(
    interpreter,
    ["-I", "-S", "-E", "-c", "import sys\nprint(sys.executable)\nprint(*sys.path, sep='\\n')"],
    {
      encoding: "utf8",
      env: TRUST_DISCOVERY_ENV,
      timeout: 10_000,
    },
  );
  if (probe.error || probe.signal || probe.status !== 0) {
    fail("bound-launch-interpreter-unavailable");
  }
  const [reportedExecutable, ...searchPaths] = probe.stdout
    .split("\n")
    .filter((entry) => entry.length > 0);
  if (
    !reportedExecutable
    || realpathSync.native(reportedExecutable) !== interpreter
    || searchPaths.length === 0
  ) {
    fail("bound-launch-interpreter-untrusted");
  }
  for (const searchPath of searchPaths) {
    assertRootOwnedSearchLocation(searchPath);
  }
  cachedInterpreter = interpreter;
  return interpreter;
}

function helperEnvironment() {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (
      INJECTION_ENVIRONMENT_NAMES.has(name)
      || name.startsWith("DYLD_")
      || name.startsWith("LD_")
      || name.startsWith("PYTHON")
      || name.startsWith("__XPC_DYLD_")
    ) {
      delete environment[name];
    }
  }
  return environment;
}

function validateTestInterposition(interposition) {
  if (interposition === undefined) return null;
  if (
    interposition === null
    || Object.getPrototypeOf(interposition) !== Object.prototype
    || Object.keys(interposition).some(
      (key) => !["renames", "writeFiles", "probeConfigWrite"].includes(key),
    )
  ) {
    fail("bound-launch-test-hook-invalid");
  }
  return interposition;
}

function validateSourceHash(expectedSourceSha256) {
  if (
    typeof expectedSourceSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(expectedSourceSha256)
  ) {
    fail("bound-launch-source-fingerprint-invalid");
  }
}

export function spawnMacosBoundCreator({
  executableDescriptor,
  executablePath,
  executableSha256,
  configDescriptor,
  configSha256,
  cocosProject,
  platform,
  cwd,
  launcherSourceSha256,
  interposeForTest,
  suppressOutput = false,
}) {
  if (process.platform !== "darwin") fail("bound-launch-macos-required");
  validateSourceHash(launcherSourceSha256);
  const source = captureStableFile(SOURCE_PATH, { includeContent: true });
  if (source.sha256 !== launcherSourceSha256) {
    fail("bound-launch-source-fingerprint-drift");
  }
  const sourceText = source.content.toString("utf8");
  if (sourceText.includes("\0") || !Buffer.from(sourceText).equals(source.content)) {
    fail("bound-launch-source-invalid");
  }

  const payload = JSON.stringify({
    executablePath,
    executableSha256,
    configSha256,
    cocosProject,
    platform,
    cwd,
    testInterposition: validateTestInterposition(interposeForTest),
  });
  const interpreter = resolveTrustedMacosPython();
  const result = spawnSync(
    interpreter,
    ["-I", "-S", "-E", "-c", sourceText, payload],
    {
      cwd,
      env: helperEnvironment(),
      maxBuffer: 64 * 1024,
      stdio: [
        "inherit",
        suppressOutput ? "ignore" : "inherit",
        suppressOutput ? "ignore" : "inherit",
        executableDescriptor,
        configDescriptor,
        "pipe",
      ],
    },
  );

  const boundaryStatus = result.output?.[5]?.toString("ascii") ?? "";
  const boundaryMatch = /^BOUNDARY_ERROR:(bound-launch-[a-z0-9-]+)\n$/.exec(
    boundaryStatus,
  );
  if (boundaryMatch) fail(boundaryMatch[1]);
  if (boundaryStatus.length !== 0) fail("bound-launch-helper-protocol-invalid");
  if (result.error || result.signal || !Number.isInteger(result.status)) {
    fail("bound-launch-helper-failed");
  }
  return { status: result.status, signal: null, error: null };
}

export function attestMacosBoundLauncherSource(expectedSourceSha256) {
  validateSourceHash(expectedSourceSha256);
  const source = captureStableFile(SOURCE_PATH);
  return Object.freeze({
    path: SOURCE_PATH,
    sha256: source.sha256,
    pinned: source.sha256 === expectedSourceSha256,
  });
}
