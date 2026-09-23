import { closeSync } from "node:fs";
import { assertCreatorExecutableUnchanged } from "./cocos-creator-version.mjs";
import { assertBuildConfigSnapshotUnchanged } from "./build-config-snapshot.mjs";
import { openAttestedFileDescriptor } from "./file-attestation.mjs";
import { spawnMacosBoundCreator } from "./macos-bound-launcher.mjs";

export function spawnAttestedCreatorBuild({
  creatorAttestation,
  configSnapshot,
  cocosProject,
  platform,
  cwd,
  launcherSourceSha256,
  interposeForTest,
  suppressOutput,
}) {
  const configDescriptor = assertBuildConfigSnapshotUnchanged(configSnapshot);
  const canonicalCreator = assertCreatorExecutableUnchanged(creatorAttestation);
  const executableDescriptor = openAttestedFileDescriptor(
    creatorAttestation,
    { requireExecutable: true },
  );
  try {
    return spawnMacosBoundCreator({
      executableDescriptor,
      executablePath: canonicalCreator,
      executableSha256: creatorAttestation.sha256,
      configDescriptor,
      configSha256: configSnapshot.snapshotAttestation.sha256,
      cocosProject,
      platform,
      cwd,
      launcherSourceSha256,
      interposeForTest,
      suppressOutput,
    });
  } finally {
    closeSync(executableDescriptor);
  }
}
