import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import type { SkillPackSummary } from "./skill-packs.ts";

export interface SkillPackGuidance {
  content: string;
  sha256: string;
  bytes: number;
}

export interface SkillPackGuidanceAudit {
  sha256: string;
  bytes: number;
}

export interface AuditedSkillPackSummary extends SkillPackSummary {
  guidance: SkillPackGuidanceAudit;
}

export type SkillPackGuidanceMap = ReadonlyMap<string, SkillPackGuidance>;

const maxSkillPackGuidanceBytes = 64 * 1024;
const maxCombinedSkillPackGuidanceBytes = 128 * 1024;

/** Loads selected `SKILL.md` files with bounded UTF-8 content and digest metadata. */
export async function loadSkillPackGuidance(
  workspace: string,
  skillPacks: SkillPackSummary[]
): Promise<Map<string, SkillPackGuidance>> {
  const guidance = new Map<string, SkillPackGuidance>();
  let combinedBytes = 0;

  for (const skillPack of skillPacks) {
    const path = resolveSkillPackGuidancePath(workspace, skillPack.path);
    const metadata = await stat(path);
    assertGuidanceSize(skillPack, metadata.size, maxSkillPackGuidanceBytes);

    const bytes = await readFile(path);
    assertGuidanceSize(skillPack, bytes.byteLength, maxSkillPackGuidanceBytes);
    combinedBytes += bytes.byteLength;
    if (combinedBytes > maxCombinedSkillPackGuidanceBytes) {
      throw new Error(
        `Combined Skill Pack guidance exceeds ${maxCombinedSkillPackGuidanceBytes} bytes`
      );
    }

    guidance.set(skillPack.path, {
      content: decodeSkillPackGuidance(skillPack, bytes),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.byteLength
    });
  }

  return guidance;
}

/** Produces event-safe Skill Pack summaries without persisting full instruction bodies. */
export function createAuditedSkillPackSummaries(
  skillPacks: SkillPackSummary[],
  guidance: SkillPackGuidanceMap
): AuditedSkillPackSummary[] {
  return skillPacks.map((skillPack) => {
    const loaded = guidance.get(skillPack.path);
    if (!loaded) {
      throw new Error(`Skill Pack guidance was not loaded: ${skillPack.path}`);
    }
    return {
      ...skillPack,
      guidance: {
        sha256: loaded.sha256,
        bytes: loaded.bytes
      }
    };
  });
}

/** Rejects resume when a selected `SKILL.md` no longer matches its recorded audit digest. */
export function verifySkillPackGuidanceDigests(
  guidance: SkillPackGuidanceMap,
  expectedDigests: ReadonlyMap<string, string>
): void {
  for (const [path, expectedDigest] of expectedDigests) {
    const loaded = guidance.get(path);
    if (!loaded) {
      throw new Error(`Skill Pack guidance was not loaded: ${path}`);
    }
    if (loaded.sha256 !== expectedDigest) {
      throw new Error(`Skill Pack guidance changed since Task Run started: ${path}`);
    }
  }
}

/** Resolves workspace-relative Skill paths while preserving external absolute paths. */
function resolveSkillPackGuidancePath(workspace: string, path: string): string {
  return isAbsolute(path) ? path : resolve(workspace, path);
}

/** Rejects one oversized Skill file before it can consume model context. */
function assertGuidanceSize(skillPack: SkillPackSummary, bytes: number, limit: number): void {
  if (bytes > limit) {
    throw new Error(`Skill Pack guidance exceeds ${limit} bytes: ${skillPack.path}`);
  }
}

/** Decodes Skill guidance as strict UTF-8 so invalid bytes cannot change during audit hashing. */
function decodeSkillPackGuidance(skillPack: SkillPackSummary, bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Skill Pack guidance must be valid UTF-8: ${skillPack.path}`);
  }
}
