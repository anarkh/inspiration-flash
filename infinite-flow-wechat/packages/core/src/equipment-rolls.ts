import type { DerivedStats, EquipmentId, EquipmentSlot } from './game';

export const EQUIPMENT_ROLL_RULES_VERSION = 1 as const;

export const EQUIPMENT_ROLL_STAT_KEYS = [
  'body',
  'spirit',
  'agility',
  'luck',
  'maxHp',
  'attack',
  'artPower',
  'defense',
  'speed',
  'trapCheck'
] as const satisfies readonly (keyof DerivedStats)[];

export type EquipmentRollStat = (typeof EQUIPMENT_ROLL_STAT_KEYS)[number];
export type EquipmentRollQuality = 'magic' | 'rare' | 'legendary' | 'ancestral';

export type EquipmentRolledAffix = Readonly<{
  stat: EquipmentRollStat;
  value: number;
  minimum: number;
  maximum: number;
  greater: boolean;
}>;

export type EquipmentRoll = Readonly<{
  rulesVersion: typeof EQUIPMENT_ROLL_RULES_VERSION;
  seed: number;
  sourceTier: number;
  itemPower: number;
  quality: EquipmentRollQuality;
  affixes: readonly EquipmentRolledAffix[];
}>;

export type EquipmentRollMap = Readonly<Partial<Record<EquipmentId, EquipmentRoll>>>;

export type EquipmentRollInput = Readonly<{
  equipmentId: EquipmentId;
  slot: EquipmentSlot;
  base: Readonly<Partial<DerivedStats>>;
  sourceTier: number;
  seed: number;
}>;

const UINT32_MAX = 0xffff_ffff;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const SLOT_FALLBACK_AFFIXES: Readonly<
  Record<EquipmentSlot, readonly Readonly<[EquipmentRollStat, number]>[]>
> = {
  weapon: [['attack', 6], ['speed', 1]],
  head: [['trapCheck', 2], ['spirit', 1]],
  armor: [['maxHp', 12], ['defense', 2]],
  hands: [['attack', 2], ['defense', 1]],
  feet: [['speed', 2], ['trapCheck', 1]],
  waist: [['maxHp', 8], ['defense', 2]],
  charm: [['artPower', 3], ['spirit', 1]]
};

function clampSafeInteger(value: number, minimum = 0): number {
  if (!Number.isFinite(value)) return MAX_SAFE_INTEGER;
  return Math.min(MAX_SAFE_INTEGER, Math.max(minimum, Math.floor(value)));
}

function normalizeTier(value: number): number {
  return Number.isSafeInteger(value) && value >= 1 ? value : 1;
}

function normalizeSeed(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= UINT32_MAX
    ? value
    : 1;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function isEquipmentRollStat(value: unknown): value is EquipmentRollStat {
  return typeof value === 'string' &&
    (EQUIPMENT_ROLL_STAT_KEYS as readonly string[]).includes(value);
}

function getRollBasis(
  slot: EquipmentSlot,
  base: Readonly<Partial<DerivedStats>>
): Array<Readonly<[EquipmentRollStat, number]>> {
  const basis = EQUIPMENT_ROLL_STAT_KEYS.flatMap((stat) => {
    const value = base[stat];
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? [[stat, value] as const]
      : [];
  });
  const included = new Set(basis.map(([stat]) => stat));

  for (const fallback of SLOT_FALLBACK_AFFIXES[slot]) {
    if (basis.length >= 2) break;
    if (included.has(fallback[0])) continue;
    basis.push(fallback);
    included.add(fallback[0]);
  }

  return basis;
}

export function createEquipmentRollSeed(seed: number, equipmentId: EquipmentId): number {
  const mixed = stableHash(`${normalizeSeed(seed)}:${equipmentId}`);
  return mixed === 0 ? 1 : mixed;
}

export function getEquipmentRollPowerBounds(sourceTier: number): Readonly<{
  minimumPercent: number;
  maximumPercent: number;
}> {
  const tier = normalizeTier(sourceTier);
  // The linear term intentionally has no tier cap; the logarithmic term makes early layers
  // feel different without making layer 2 invalidate every prior item immediately.
  const tierGrowth = clampSafeInteger((tier - 1) * 0.8 + Math.log2(tier + 1) * 6);
  return {
    minimumPercent: clampSafeInteger(88 + tierGrowth, 1),
    maximumPercent: clampSafeInteger(112 + tierGrowth, 1)
  };
}

function getQuality(averagePercent: number, hasGreaterAffix: boolean): EquipmentRollQuality {
  if (hasGreaterAffix && averagePercent >= 135) return 'ancestral';
  if (hasGreaterAffix || averagePercent >= 116) return 'legendary';
  if (averagePercent >= 101) return 'rare';
  return 'magic';
}

export function createEquipmentRoll(input: EquipmentRollInput): EquipmentRoll {
  const sourceTier = normalizeTier(input.sourceTier);
  const seed = createEquipmentRollSeed(input.seed, input.equipmentId);
  const random = createRandom(seed);
  const bounds = getEquipmentRollPowerBounds(sourceTier);
  const basis = getRollBasis(input.slot, input.base);
  const greaterChance = Math.min(0.6, 0.08 + Math.log2(sourceTier + 1) * 0.05);
  const greaterIndex = random() < greaterChance
    ? Math.floor(random() * basis.length)
    : -1;
  let percentTotal = 0;

  const affixes = basis.map(([stat, basisValue], index): EquipmentRolledAffix => {
    const percent = bounds.minimumPercent +
      Math.floor(random() * (bounds.maximumPercent - bounds.minimumPercent + 1));
    const greater = index === greaterIndex;
    const greaterMultiplier = greater ? 1.5 : 1;
    const minimum = Math.max(1, Math.ceil(basisValue * bounds.minimumPercent / 100));
    const maximum = Math.max(
      minimum,
      Math.ceil(basisValue * bounds.maximumPercent / 100 * greaterMultiplier)
    );
    const value = Math.max(1, Math.ceil(basisValue * percent / 100 * greaterMultiplier));
    percentTotal += percent * greaterMultiplier;
    return { stat, value, minimum, maximum, greater };
  });
  const averagePercent = affixes.length > 0
    ? Math.round(percentTotal / affixes.length)
    : bounds.minimumPercent;
  const itemPower = clampSafeInteger(sourceTier * 1_000 + averagePercent, 1);

  return {
    rulesVersion: EQUIPMENT_ROLL_RULES_VERSION,
    seed,
    sourceTier,
    itemPower,
    quality: getQuality(averagePercent, greaterIndex >= 0),
    affixes
  };
}

export function getEquipmentRollStats(
  roll: EquipmentRoll | undefined
): Readonly<Partial<DerivedStats>> {
  if (!roll) return {};
  const stats: Partial<DerivedStats> = {};
  for (const affix of roll.affixes) stats[affix.stat] = affix.value;
  return stats;
}

export function getEquipmentRolledBaseStats(
  base: Readonly<Partial<DerivedStats>>,
  roll: EquipmentRoll | undefined
): Readonly<Partial<DerivedStats>> {
  if (!roll) return base;
  return { ...base, ...getEquipmentRollStats(roll) };
}

const STAT_SCORE_WEIGHTS: Readonly<Record<EquipmentRollStat, number>> = {
  body: 12,
  spirit: 12,
  agility: 12,
  luck: 10,
  maxHp: 1,
  attack: 5,
  artPower: 5,
  defense: 6,
  speed: 5,
  trapCheck: 3
};

export function getEquipmentRollScore(roll: EquipmentRoll | undefined): number {
  if (!roll) return 0;
  return roll.affixes.reduce(
    (total, affix) => total + affix.value * STAT_SCORE_WEIGHTS[affix.stat],
    0
  );
}

export function compareEquipmentRolls(
  candidate: EquipmentRoll,
  current: EquipmentRoll | undefined
): number {
  if (!current) return 1;
  const scoreDelta = getEquipmentRollScore(candidate) - getEquipmentRollScore(current);
  if (scoreDelta !== 0) return scoreDelta;
  if (candidate.sourceTier !== current.sourceTier) {
    return candidate.sourceTier > current.sourceTier ? 1 : -1;
  }
  return candidate.itemPower - current.itemPower;
}

export function isEquipmentRoll(value: unknown): value is EquipmentRoll {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EquipmentRoll>;
  if (
    candidate.rulesVersion !== EQUIPMENT_ROLL_RULES_VERSION ||
    !Number.isInteger(candidate.seed) ||
    (candidate.seed ?? 0) < 1 ||
    (candidate.seed ?? 0) > UINT32_MAX ||
    !Number.isSafeInteger(candidate.sourceTier) ||
    (candidate.sourceTier ?? 0) < 1 ||
    !Number.isSafeInteger(candidate.itemPower) ||
    (candidate.itemPower ?? 0) < 1 ||
    !['magic', 'rare', 'legendary', 'ancestral'].includes(String(candidate.quality)) ||
    !Array.isArray(candidate.affixes) ||
    candidate.affixes.length < 1
  ) {
    return false;
  }

  const seen = new Set<EquipmentRollStat>();
  return candidate.affixes.every((affix) => {
    if (!affix || typeof affix !== 'object') return false;
    const typed = affix as Partial<EquipmentRolledAffix>;
    if (
      !isEquipmentRollStat(typed.stat) ||
      seen.has(typed.stat) ||
      !Number.isSafeInteger(typed.value) ||
      (typed.value ?? 0) < 1 ||
      !Number.isSafeInteger(typed.minimum) ||
      (typed.minimum ?? 0) < 1 ||
      !Number.isSafeInteger(typed.maximum) ||
      (typed.maximum ?? 0) < (typed.minimum ?? 1) ||
      (typed.value ?? 0) < (typed.minimum ?? 1) ||
      (typed.value ?? 0) > (typed.maximum ?? 0) ||
      typeof typed.greater !== 'boolean'
    ) {
      return false;
    }
    seen.add(typed.stat);
    return true;
  });
}

export function sanitizeEquipmentRollMap(value: unknown): EquipmentRollMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Partial<Record<EquipmentId, EquipmentRoll>> = {};
  for (const [equipmentId, roll] of Object.entries(value)) {
    if (isEquipmentRoll(roll)) result[equipmentId as EquipmentId] = roll;
  }
  return result;
}
