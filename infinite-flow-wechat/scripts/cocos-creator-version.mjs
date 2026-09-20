import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ToolchainBoundaryError,
  assertStableFileUnchanged,
  captureStableFile,
  withoutCapturedContent,
} from "./file-attestation.mjs";

const VERSION_PATTERN = /^(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;
const CREATOR_OUTPUT_PATTERN = /(?:^|\n)\s*Cocos Creator(?:\s+version)?\s+v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\s*(?:\n|$)/i;

function parseVersion(value) {
  if (typeof value !== "string") return null;
  return value.trim().match(VERSION_PATTERN)?.[1] ?? null;
}

function macBundleInfoPlist(executable) {
  const marker = ".app/Contents/";
  const markerIndex = executable.indexOf(marker);
  if (markerIndex < 0) return null;
  return `${executable.slice(0, markerIndex + marker.length)}Info.plist`;
}

function readMacBundleVersion(plistBytes) {
  const plutil = spawnSync(
    "/usr/bin/plutil",
    ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", "-"],
    { encoding: "utf8", input: plistBytes, timeout: 5_000 },
  );
  const parsed = parseVersion(plutil.stdout);
  if (parsed) return parsed;

  // Keep an XML-plist fallback for stripped-down macOS build hosts.
  const text = plistBytes.toString("utf8");
  const match = text.match(
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
  );
  return parseVersion(match?.[1]);
}

function mapExecutableError(error, configured) {
  if (!(error instanceof ToolchainBoundaryError)) return "executable-unreadable";
  if (error.code === "file-not-found") {
    return configured ? "executable-not-found" : "executable-unset";
  }
  if (error.code === "file-not-regular") return "executable-not-file";
  if (error.code === "file-not-executable") return "executable-not-runnable";
  return error.code;
}

function inspectCreatorVersion(executable) {
  if (!executable) {
    return { version: null, source: null, error: "executable-unset" };
  }

  let executableAttestation;
  try {
    executableAttestation = withoutCapturedContent(captureStableFile(executable, {
      requireExecutable: true,
    }));
  } catch (error) {
    return {
      version: null,
      source: null,
      error: mapExecutableError(error, executable),
    };
  }

  const plistPath = macBundleInfoPlist(executableAttestation.canonicalPath);
  if (plistPath && existsSync(plistPath)) {
    try {
      const plistCapture = captureStableFile(plistPath, { includeContent: true });
      const version = readMacBundleVersion(plistCapture.content);
      if (version) {
        assertStableFileUnchanged(executableAttestation, {
          requireExecutable: true,
        });
        return {
          version,
          source: "macos-app-bundle",
          error: null,
          executableAttestation,
          versionEvidence: withoutCapturedContent(plistCapture),
        };
      }
    } catch (error) {
      return {
        version: null,
        source: null,
        error: error instanceof ToolchainBoundaryError
          ? `version-evidence-${error.code}`
          : "version-unverifiable",
      };
    }
  }

  // A Windows file-version attestor has not yet been verified for Creator 3.8.8.
  // Refuse production rather than guessing from a directory name or stdout.
  if (process.platform === "win32") {
    return { version: null, source: null, error: "version-source-unsupported" };
  }

  // Non-macOS POSIX installations do not have Info.plist. Only accept a clean
  // zero-exit probe whose line identifies Cocos Creator explicitly. Revalidating
  // the exact executable after the probe binds the version to the captured bytes.
  const probe = spawnSync(executableAttestation.canonicalPath, ["--version"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (probe.error?.code === "ETIMEDOUT") {
    return { version: null, source: null, error: "version-probe-timeout" };
  }
  if (probe.error || probe.signal || probe.status !== 0) {
    return { version: null, source: null, error: "version-probe-failed" };
  }

  try {
    assertStableFileUnchanged(executableAttestation, { requireExecutable: true });
  } catch (error) {
    return {
      version: null,
      source: null,
      error: error instanceof ToolchainBoundaryError
        ? `version-probe-${error.code}`
        : "version-probe-drift",
    };
  }

  const output = `${probe.stdout ?? ""}\n${probe.stderr ?? ""}`;
  const probedVersion = output.match(CREATOR_OUTPUT_PATTERN)?.[1] ?? null;
  if (probedVersion) {
    return {
      version: probedVersion,
      source: "creator---version",
      error: null,
      executableAttestation,
      versionEvidence: null,
    };
  }

  return { version: null, source: null, error: "version-unverifiable" };
}

export function detectCreatorVersion(executable) {
  const inspected = inspectCreatorVersion(executable);
  return {
    version: inspected.version,
    source: inspected.source,
    error: inspected.error,
  };
}

export function attestCreatorExecutable(executable, expectedVersion) {
  const inspected = inspectCreatorVersion(executable);
  if (inspected.error || !inspected.executableAttestation) {
    throw new ToolchainBoundaryError(inspected.error ?? "version-unverifiable");
  }
  if (inspected.version !== expectedVersion) {
    throw new ToolchainBoundaryError("creator-version-mismatch");
  }
  return Object.freeze({
    ...inspected.executableAttestation,
    version: inspected.version,
    versionSource: inspected.source,
    versionEvidence: inspected.versionEvidence
      ? Object.freeze(inspected.versionEvidence)
      : null,
  });
}

export function assertCreatorExecutableUnchanged(attestation) {
  const canonicalPath = assertStableFileUnchanged(attestation, {
    requireExecutable: true,
  });
  if (attestation.versionEvidence) {
    assertStableFileUnchanged(attestation.versionEvidence);
  }
  return canonicalPath;
}

export function creatorVersionMatches(executable, expectedVersion) {
  try {
    const attestation = attestCreatorExecutable(executable, expectedVersion);
    return {
      version: attestation.version,
      source: attestation.versionSource,
      error: null,
      expectedVersion,
      matches: true,
      attested: true,
      canonicalPath: attestation.canonicalPath,
      sha256: attestation.sha256,
    };
  } catch (error) {
    const detected = detectCreatorVersion(executable);
    return {
      ...detected,
      expectedVersion,
      matches: false,
      attested: false,
      canonicalPath: null,
      sha256: null,
      error: error instanceof ToolchainBoundaryError
        ? error.code
        : detected.error,
    };
  }
}
