import { createHash } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";

const READ_BUFFER_BYTES = 1024 * 1024;

export class ToolchainBoundaryError extends Error {
  constructor(code) {
    super(code);
    this.name = "ToolchainBoundaryError";
    this.code = code;
  }
}

function fileIdentity(stat) {
  return {
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: stat.mode.toString(),
    size: stat.size.toString(),
    modifiedNs: stat.mtimeNs.toString(),
    changedNs: stat.ctimeNs.toString(),
  };
}

function sameIdentity(left, right) {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.size === right.size
    && left.modifiedNs === right.modifiedNs
    && left.changedNs === right.changedNs;
}

function readAndHashDescriptor(fd, includeContent) {
  const hash = createHash("sha256");
  const retained = includeContent ? [] : null;
  const buffer = Buffer.allocUnsafe(READ_BUFFER_BYTES);
  let position = 0;

  while (true) {
    const bytesRead = readSync(fd, buffer, 0, buffer.length, position);
    if (bytesRead === 0) break;
    const chunk = buffer.subarray(0, bytesRead);
    hash.update(chunk);
    if (retained) retained.push(Buffer.from(chunk));
    position += bytesRead;
  }

  return {
    sha256: hash.digest("hex"),
    content: retained ? Buffer.concat(retained) : undefined,
  };
}

export function captureStableDescriptor(
  fd,
  { includeContent = false } = {},
) {
  if (!Number.isInteger(fd) || fd < 0) {
    throw new ToolchainBoundaryError("file-descriptor-invalid");
  }

  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) {
      throw new ToolchainBoundaryError("file-not-regular");
    }
    const beforeIdentity = fileIdentity(before);
    const captured = readAndHashDescriptor(fd, includeContent);
    const afterIdentity = fileIdentity(fstatSync(fd, { bigint: true }));
    if (!sameIdentity(beforeIdentity, afterIdentity)) {
      throw new ToolchainBoundaryError("file-drift-during-read");
    }
    return {
      identity: beforeIdentity,
      sha256: captured.sha256,
      content: captured.content,
    };
  } catch (error) {
    if (error instanceof ToolchainBoundaryError) throw error;
    throw new ToolchainBoundaryError("file-descriptor-unreadable");
  }
}

export function captureStableFile(
  configuredPath,
  { requireExecutable = false, includeContent = false } = {},
) {
  if (typeof configuredPath !== "string" || configuredPath.length === 0) {
    throw new ToolchainBoundaryError("file-path-unset");
  }

  const absoluteConfiguredPath = resolve(configuredPath);
  let canonicalPath;
  try {
    canonicalPath = realpathSync.native(absoluteConfiguredPath);
  } catch {
    throw new ToolchainBoundaryError("file-not-found");
  }

  if (requireExecutable && process.platform !== "win32") {
    try {
      accessSync(canonicalPath, constants.X_OK);
    } catch {
      throw new ToolchainBoundaryError("file-not-executable");
    }
  }

  let fd;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    fd = openSync(canonicalPath, constants.O_RDONLY | noFollow);
    const captured = captureStableDescriptor(fd, { includeContent });
    const beforeIdentity = captured.identity;

    const pathIdentity = fileIdentity(statSync(canonicalPath, { bigint: true }));
    const configuredRealpath = realpathSync.native(absoluteConfiguredPath);
    if (
      configuredRealpath !== canonicalPath
      || !sameIdentity(beforeIdentity, pathIdentity)
    ) {
      throw new ToolchainBoundaryError("file-path-drift-during-read");
    }

    return {
      configuredPath: absoluteConfiguredPath,
      canonicalPath,
      identity: beforeIdentity,
      sha256: captured.sha256,
      content: captured.content,
    };
  } catch (error) {
    if (error instanceof ToolchainBoundaryError) throw error;
    throw new ToolchainBoundaryError("file-unreadable");
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function openAttestedFileDescriptor(
  attestation,
  { requireExecutable = false } = {},
) {
  let fd;
  try {
    if (requireExecutable && process.platform !== "win32") {
      try {
        accessSync(attestation.canonicalPath, constants.X_OK);
      } catch {
        throw new ToolchainBoundaryError("file-not-executable");
      }
    }

    const noFollow = constants.O_NOFOLLOW ?? 0;
    fd = openSync(attestation.canonicalPath, constants.O_RDONLY | noFollow);
    const current = captureStableDescriptor(fd);
    if (!sameIdentity(current.identity, attestation.identity)) {
      throw new ToolchainBoundaryError("file-identity-drift");
    }
    if (current.sha256 !== attestation.sha256) {
      throw new ToolchainBoundaryError("file-fingerprint-drift");
    }

    const configuredRealpath = realpathSync.native(attestation.configuredPath);
    const pathIdentity = fileIdentity(
      statSync(attestation.canonicalPath, { bigint: true }),
    );
    if (configuredRealpath !== attestation.canonicalPath) {
      throw new ToolchainBoundaryError("file-canonical-path-drift");
    }
    if (!sameIdentity(current.identity, pathIdentity)) {
      throw new ToolchainBoundaryError("file-path-drift-during-read");
    }

    return fd;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (error instanceof ToolchainBoundaryError) throw error;
    throw new ToolchainBoundaryError("file-unreadable");
  }
}

export function withoutCapturedContent(attestation) {
  const { content: _content, ...publicAttestation } = attestation;
  return publicAttestation;
}

export function assertStableFileUnchanged(
  attestation,
  { requireExecutable = false } = {},
) {
  const current = captureStableFile(attestation.configuredPath, {
    requireExecutable,
  });
  if (current.canonicalPath !== attestation.canonicalPath) {
    throw new ToolchainBoundaryError("file-canonical-path-drift");
  }
  if (!sameIdentity(current.identity, attestation.identity)) {
    throw new ToolchainBoundaryError("file-identity-drift");
  }
  if (current.sha256 !== attestation.sha256) {
    throw new ToolchainBoundaryError("file-fingerprint-drift");
  }
  return current.canonicalPath;
}
