import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  fsyncSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ToolchainBoundaryError,
  captureStableDescriptor,
  captureStableFile,
  withoutCapturedContent,
} from "./file-attestation.mjs";

const SNAPSHOT_PREFIX = "infinite-flow-wechat-build-";
const SNAPSHOT_NAME = "wechat-build-config.json";
const activeSnapshots = new WeakSet();

function sameIdentity(left, right) {
  return left.device === right.device
    && left.inode === right.inode
    && left.mode === right.mode
    && left.size === right.size
    && left.modifiedNs === right.modifiedNs
    && left.changedNs === right.changedNs;
}

function sameFilesystemObject(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    offset += writeSync(fd, bytes, offset, bytes.length - offset, offset);
  }
}

function exactFailureCleanup({ directory, path, createdStat, writeFd, readFd }) {
  if (writeFd !== undefined) {
    try {
      closeSync(writeFd);
    } catch {
      // Keep the original boundary failure.
    }
  }
  if (readFd !== undefined) {
    try {
      closeSync(readFd);
    } catch {
      // Keep the original boundary failure.
    }
  }
  try {
    if (
      existsSync(path)
      && createdStat
      && sameFilesystemObject(lstatSync(path, { bigint: true }), createdStat)
    ) {
      unlinkSync(path);
    }
    if (existsSync(directory)) {
      rmdirSync(directory);
    }
  } catch {
    // Never broaden cleanup to recursive deletion.
  }
}

export function createBuildConfigSnapshot(sourcePath) {
  const sourceCapture = captureStableFile(sourcePath, { includeContent: true });
  let parsedConfig;
  try {
    parsedConfig = JSON.parse(sourceCapture.content.toString("utf8"));
  } catch {
    throw new ToolchainBoundaryError("build-config-invalid-json");
  }

  const directory = mkdtempSync(join(tmpdir(), SNAPSHOT_PREFIX));
  const path = join(directory, SNAPSHOT_NAME);
  let writeFd;
  let readFd;
  let createdStat;
  try {
    chmodSync(directory, 0o700);
    writeFd = openSync(path, "wx+", 0o600);
    createdStat = fstatSync(writeFd, { bigint: true });
    const noFollow = constants.O_NOFOLLOW ?? 0;
    readFd = openSync(path, constants.O_RDONLY | noFollow);
    const readStat = fstatSync(readFd, { bigint: true });
    if (!sameFilesystemObject(createdStat, readStat)) {
      throw new ToolchainBoundaryError("snapshot-object-drift");
    }

    // Remove every pathname before populating the object. After this point the
    // build bytes are reachable only through the two retained descriptors.
    unlinkSync(path);
    rmdirSync(directory);
    writeAll(writeFd, sourceCapture.content);
    fsyncSync(writeFd);
    fchmodSync(writeFd, 0o400);
    closeSync(writeFd);
    writeFd = undefined;

    const descriptorStat = fstatSync(readFd, { bigint: true });
    if (descriptorStat.nlink !== 0n || (descriptorStat.mode & 0o777n) !== 0o400n) {
      throw new ToolchainBoundaryError("snapshot-not-anonymous-readonly");
    }
    const snapshotCapture = captureStableDescriptor(readFd);
    if (snapshotCapture.sha256 !== sourceCapture.sha256) {
      throw new ToolchainBoundaryError("snapshot-content-mismatch");
    }

    const snapshot = Object.freeze({
      descriptor: readFd,
      parsedConfig,
      sourceAttestation: Object.freeze(withoutCapturedContent(sourceCapture)),
      snapshotAttestation: Object.freeze(snapshotCapture),
    });
    activeSnapshots.add(snapshot);
    readFd = undefined;
    return snapshot;
  } catch (error) {
    exactFailureCleanup({
      directory,
      path,
      createdStat,
      writeFd,
      readFd,
    });
    throw error;
  }
}

export function assertBuildConfigSnapshotUnchanged(snapshot) {
  if (!snapshot || !activeSnapshots.has(snapshot)) {
    throw new ToolchainBoundaryError("snapshot-inactive");
  }
  const descriptorStat = fstatSync(snapshot.descriptor, { bigint: true });
  if (descriptorStat.nlink !== 0n || (descriptorStat.mode & 0o777n) !== 0o400n) {
    throw new ToolchainBoundaryError("snapshot-not-anonymous-readonly");
  }
  const current = captureStableDescriptor(snapshot.descriptor);
  if (!sameIdentity(current.identity, snapshot.snapshotAttestation.identity)) {
    throw new ToolchainBoundaryError("snapshot-object-drift");
  }
  if (current.sha256 !== snapshot.snapshotAttestation.sha256) {
    throw new ToolchainBoundaryError("snapshot-content-drift");
  }
  return snapshot.descriptor;
}

export function disposeBuildConfigSnapshot(snapshot) {
  if (!snapshot || !activeSnapshots.has(snapshot)) {
    throw new ToolchainBoundaryError("snapshot-cleanup-boundary-rejected");
  }

  let closeAllowed = false;
  let boundaryError = null;
  try {
    const current = captureStableDescriptor(snapshot.descriptor);
    closeAllowed = sameIdentity(
      current.identity,
      snapshot.snapshotAttestation.identity,
    );
    if (!closeAllowed || current.sha256 !== snapshot.snapshotAttestation.sha256) {
      boundaryError = new ToolchainBoundaryError(
        "snapshot-cleanup-boundary-rejected",
      );
    }
  } catch {
    boundaryError = new ToolchainBoundaryError(
      "snapshot-cleanup-boundary-rejected",
    );
  }

  activeSnapshots.delete(snapshot);
  if (closeAllowed) closeSync(snapshot.descriptor);
  if (boundaryError) throw boundaryError;
}
