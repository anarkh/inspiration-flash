import { encodeUtf8 } from './canonical-json.js';

export const UINT32_MAX = 0xffff_ffff;
const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;

declare const nonZeroUint32Brand: unique symbol;
export type NonZeroUint32 = number & {
  readonly [nonZeroUint32Brand]: 'NonZeroUint32';
};

export class SeedValidationError extends Error {
  readonly code:
    | 'invalid-uint32'
    | 'unsupported-rules-version'
    | 'missing-inferno-seed'
    | 'unexpected-inferno-seed'
    | 'invalid-inferno-tier'
    | 'invalid-portal-hop';

  constructor(code: SeedValidationError['code'], message: string) {
    super(message);
    this.name = 'SeedValidationError';
    this.code = code;
  }
}

export function isNonZeroUint32(value: unknown): value is NonZeroUint32 {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= UINT32_MAX
  );
}

export function asNonZeroUint32(
  value: unknown,
  fieldName = 'seed',
): NonZeroUint32 {
  if (!isNonZeroUint32(value)) {
    throw new SeedValidationError(
      'invalid-uint32',
      `${fieldName} must be an integer in 1..0xffffffff`,
    );
  }
  return value;
}

export type SeedRulesVersion = 1;

export type SeedBundle = Readonly<{
  rulesVersion: SeedRulesVersion;
  hiddenTaskSeed: NonZeroUint32;
  infernoMapSeed?: NonZeroUint32;
}>;

export type RunSeedInput =
  | { kind: 'bundle'; seeds: SeedBundle }
  | {
      kind: 'root';
      rulesVersion: SeedRulesVersion;
      rootSeed: NonZeroUint32;
    };

export type SeedLineageV0 = Readonly<{
  rulesVersion: 0;
  hiddenTaskSeed?: NonZeroUint32;
  infernoMapSeed?: NonZeroUint32;
}>;

export type SeedLineageV1 =
  | Readonly<{
      rulesVersion: 1;
      source: 'root';
      rootSeed: NonZeroUint32;
      hiddenTaskSeed: NonZeroUint32;
      infernoMapSeed?: NonZeroUint32;
      portalDerivationRoot: NonZeroUint32;
      portalHopIndex: number;
    }>
  | Readonly<{
      rulesVersion: 1;
      source: 'bundle';
      hiddenTaskSeed: NonZeroUint32;
      infernoMapSeed?: NonZeroUint32;
      portalDerivationRoot: NonZeroUint32;
      portalHopIndex: number;
    }>;

export type SeedLineage = SeedLineageV0 | SeedLineageV1;

/** Exact seed:v1 FNV-1a derivation from the migration contract. */
export function deriveSeedV1(
  rootSeed: NonZeroUint32,
  label: string,
): NonZeroUint32 {
  const root = asNonZeroUint32(rootSeed, 'rootSeed');
  let hash = (2166136261 ^ root) >>> 0;
  for (const byte of encodeUtf8(`seed:v1:${label}`)) {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  }
  return (hash === 0 ? 1 : hash) as NonZeroUint32;
}

export type EntrySeedContext = Readonly<{
  dungeonId: string;
  /** Present only for inferno entry; tiers are positive safe integers. */
  infernoTier?: number;
}>;

function validateRulesVersion(value: unknown): asserts value is 1 {
  if (value !== 1) {
    throw new SeedValidationError(
      'unsupported-rules-version',
      'New seed lineages accept only rulesVersion 1',
    );
  }
}

function validateContext(context: EntrySeedContext): void {
  if (context.dungeonId.length === 0) {
    throw new SeedValidationError(
      'invalid-uint32',
      'dungeonId must not be empty',
    );
  }
  if (
    context.infernoTier !== undefined &&
    (!Number.isSafeInteger(context.infernoTier) || context.infernoTier < 1)
  ) {
    throw new SeedValidationError(
      'invalid-inferno-tier',
      'infernoTier must be a positive safe integer',
    );
  }
}

export function createSeedLineageV1(
  input: RunSeedInput,
  context: EntrySeedContext,
): SeedLineageV1 {
  validateContext(context);
  const isInferno = context.infernoTier !== undefined;

  if (input.kind === 'root') {
    validateRulesVersion(input.rulesVersion);
    const rootSeed = asNonZeroUint32(input.rootSeed, 'rootSeed');
    const hiddenTaskSeed = deriveSeedV1(
      rootSeed,
      `entry:hidden-task:${context.dungeonId}`,
    );
    const infernoMapSeed = isInferno
      ? deriveSeedV1(
          rootSeed,
          `entry:inferno-map:${context.dungeonId}:tier:${context.infernoTier}`,
        )
      : undefined;
    return {
      rulesVersion: 1,
      source: 'root',
      rootSeed,
      hiddenTaskSeed,
      ...(infernoMapSeed === undefined ? {} : { infernoMapSeed }),
      portalDerivationRoot: rootSeed,
      portalHopIndex: 0,
    };
  }

  validateRulesVersion(input.seeds.rulesVersion);
  const hiddenTaskSeed = asNonZeroUint32(
    input.seeds.hiddenTaskSeed,
    'hiddenTaskSeed',
  );
  const infernoMapSeed =
    input.seeds.infernoMapSeed === undefined
      ? undefined
      : asNonZeroUint32(input.seeds.infernoMapSeed, 'infernoMapSeed');

  if (isInferno && infernoMapSeed === undefined) {
    throw new SeedValidationError(
      'missing-inferno-seed',
      'Inferno bundle entry requires infernoMapSeed',
    );
  }
  if (!isInferno && infernoMapSeed !== undefined) {
    throw new SeedValidationError(
      'unexpected-inferno-seed',
      'Non-inferno bundle entry must not include infernoMapSeed',
    );
  }

  return {
    rulesVersion: 1,
    source: 'bundle',
    hiddenTaskSeed,
    ...(infernoMapSeed === undefined ? {} : { infernoMapSeed }),
    portalDerivationRoot: infernoMapSeed ?? hiddenTaskSeed,
    portalHopIndex: 0,
  };
}

export type PortalSeedTransition = Readonly<{
  lineage: SeedLineageV1;
  infernoMapSeed?: NonZeroUint32;
}>;

/**
 * Advances a v1 portal lineage exactly once. All portal modes share this helper;
 * callers persist the returned lineage as part of the same command candidate.
 */
export function derivePortalSeedTransitionV1(
  lineage: SeedLineageV1,
  input: Readonly<{
    sourceDungeonId: string;
    sourceNodeId: string;
    targetDungeonId: string;
    targetIsInferno: boolean;
  }>,
): PortalSeedTransition {
  if (
    !Number.isSafeInteger(lineage.portalHopIndex) ||
    lineage.portalHopIndex < 0 ||
    lineage.portalHopIndex >= Number.MAX_SAFE_INTEGER
  ) {
    throw new SeedValidationError(
      'invalid-portal-hop',
      'portalHopIndex must be a non-negative incrementable safe integer',
    );
  }
  const hop = lineage.portalHopIndex + 1;
  const infernoMapSeed = input.targetIsInferno
    ? deriveSeedV1(
        asNonZeroUint32(
          lineage.portalDerivationRoot,
          'portalDerivationRoot',
        ),
        `portal:inferno-map:${input.sourceDungeonId}:${input.sourceNodeId}:${input.targetDungeonId}:hop:${hop}`,
      )
    : undefined;

  const nextLineage: SeedLineageV1 =
    lineage.source === 'root'
      ? {
          rulesVersion: 1,
          source: 'root',
          rootSeed: lineage.rootSeed,
          hiddenTaskSeed: lineage.hiddenTaskSeed,
          ...(infernoMapSeed === undefined ? {} : { infernoMapSeed }),
          portalDerivationRoot: lineage.portalDerivationRoot,
          portalHopIndex: hop,
        }
      : {
          rulesVersion: 1,
          source: 'bundle',
          hiddenTaskSeed: lineage.hiddenTaskSeed,
          ...(infernoMapSeed === undefined ? {} : { infernoMapSeed }),
          portalDerivationRoot: lineage.portalDerivationRoot,
          portalHopIndex: hop,
        };

  return {
    lineage: nextLineage,
    ...(infernoMapSeed === undefined ? {} : { infernoMapSeed }),
  };
}

export function deriveLegacyPortalInfernoSeed(
  previousInfernoMapSeed: NonZeroUint32,
  targetDungeonTier: number,
): NonZeroUint32 {
  const previous = asNonZeroUint32(
    previousInfernoMapSeed,
    'previousInfernoMapSeed',
  );
  if (
    !Number.isSafeInteger(targetDungeonTier) ||
    targetDungeonTier < 1 ||
    targetDungeonTier > Math.floor(Number.MAX_SAFE_INTEGER / 0x9e3779b1)
  ) {
    throw new SeedValidationError(
      'invalid-inferno-tier',
      'targetDungeonTier is outside the legacy formula safe range',
    );
  }
  const value =
    (previous + targetDungeonTier * 0x9e3779b1) % UINT32_MAX;
  return (value === 0 ? 1 : value) as NonZeroUint32;
}

/** Mulberry32 expressed as an explicit uint32 cursor. */
export class Uint32Prng {
  private state: number;

  constructor(seed: NonZeroUint32) {
    this.state = asNonZeroUint32(seed) >>> 0;
  }

  nextUint32(): number {
    this.state = (this.state + MULBERRY_INCREMENT) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  nextUnitInterval(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  getState(): number {
    return this.state >>> 0;
  }
}
