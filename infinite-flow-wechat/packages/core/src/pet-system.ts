import type { DerivedStats, ItemId, MonsterId, PetDefinition, PetId } from './game';

export type PetPassiveTag = 'trap_scout' | 'combat_assist' | 'portal_anchor';

export type CultivablePetDefinition = PetDefinition & {
  passiveTags: readonly PetPassiveTag[];
  trainingMaterial: ItemId;
};

export type PetUpgradeCost = {
  rewardPoints: number;
  lingyun: number;
  items: Partial<Record<ItemId, number>>;
};

export const PETS: Record<PetId, CultivablePetDefinition> = {
  contract_sprite: {
    id: 'contract_sprite',
    name: '契约小灵',
    description: '主神空间可直接签约的基础灵宠，稳定提升灵力。',
    source: 'shop',
    cost: { rewardPoints: 280 },
    bonus: { spirit: 1, artPower: 3 },
    perLevel: { artPower: 2 },
    maxLevel: 3,
    passiveTags: ['combat_assist'],
    trainingMaterial: 'focus_incense'
  },
  mist_kitten: {
    id: 'mist_kitten',
    name: '雾爪幼兽',
    description: '从妖塔雾里捕获的小兽，擅长提前嗅出陷阱。',
    source: 'capture',
    captureFrom: 'fog_lesser_demon',
    captureItem: 'capture_net',
    bonus: { luck: 1, trapCheck: 2 },
    perLevel: { speed: 1 },
    maxLevel: 3,
    passiveTags: ['trap_scout'],
    trainingMaterial: 'hidden_stone'
  },
  ash_hound: {
    id: 'ash_hound',
    name: '烬火犬',
    description: '火场中追逐灵蕴的猎犬，提升近战爆发。',
    source: 'capture',
    captureFrom: 'spark_imp',
    captureItem: 'spirit_bait',
    bonus: { attack: 4, speed: 1 },
    perLevel: { attack: 2 },
    maxLevel: 3,
    passiveTags: ['combat_assist'],
    trainingMaterial: 'demon_bone'
  },
  mirror_moth: {
    id: 'mirror_moth',
    name: '镜翼蛾',
    description: '栖在倒影中的灵宠，适合幻觉和传送门副本。',
    source: 'capture',
    captureFrom: 'mirror_thread_spider',
    captureItem: 'capture_net',
    bonus: { spirit: 1, speed: 2 },
    perLevel: { artPower: 2 },
    maxLevel: 3,
    passiveTags: ['portal_anchor'],
    trainingMaterial: 'mirror_shell'
  },
  starling_drone: {
    id: 'starling_drone',
    name: '星铁浮蜂',
    description: '矿井中拆下的半灵械宠物，增强防御和术法。',
    source: 'shop',
    cost: { rewardPoints: 520, items: { star_iron: 1 } },
    bonus: { defense: 3, artPower: 3 },
    perLevel: { defense: 1, artPower: 1 },
    maxLevel: 3,
    passiveTags: ['combat_assist'],
    trainingMaterial: 'star_iron'
  },
  void_whelp: {
    id: 'void_whelp',
    name: '虚空幼蜥',
    description: '裂隙中驯化的高阶宠物，适合终盘战力突破。',
    source: 'capture',
    captureFrom: 'portal_molt_beast',
    captureItem: 'spirit_bait',
    bonus: { body: 1, spirit: 1, attack: 3 },
    perLevel: { attack: 2, artPower: 2 },
    maxLevel: 3,
    passiveTags: ['portal_anchor'],
    trainingMaterial: 'rift_dust'
  }
};

export type CapturePetFailureReason = 'not-capture-pet' | 'wrong-monster' | 'missing-item' | 'not-weakened';

export type CapturePetStatus =
  | {
      ok: true;
      captureItem: ItemId;
      weakThreshold: number;
    }
  | {
      ok: false;
      reason: CapturePetFailureReason;
      weakThreshold?: number;
    };

function addStats(target: Partial<DerivedStats>, source: Partial<DerivedStats>): void {
  for (const [key, value] of Object.entries(source) as Array<[keyof DerivedStats, number]>) {
    target[key] = (target[key] ?? 0) + value;
  }
}

export function getPetStatBonus(pet: PetDefinition, level: number): Partial<DerivedStats> {
  const safeLevel = Math.max(1, Math.min(pet.maxLevel, Math.floor(level)));
  const bonus: Partial<DerivedStats> = {};

  addStats(bonus, pet.bonus);
  for (let i = 1; i < safeLevel; i += 1) {
    addStats(bonus, pet.perLevel);
  }

  return bonus;
}

export function getPetUpgradeCost(pet: CultivablePetDefinition, targetLevel: number): PetUpgradeCost {
  // Pets enter the roster at level 1, so only higher target levels require cultivation cost.
  const safeTargetLevel = Math.max(1, Math.min(pet.maxLevel, Math.floor(targetLevel)));
  const growthStep = Math.max(0, safeTargetLevel - 1);
  const items: Partial<Record<ItemId, number>> = {};

  if (growthStep > 0) {
    items[pet.trainingMaterial] = growthStep;
  }

  return {
    rewardPoints: 120 * growthStep,
    lingyun: 2 * growthStep,
    items
  };
}

export function getPetPassiveTags(pet: CultivablePetDefinition): readonly PetPassiveTag[] {
  return pet.passiveTags;
}

export function getPetIdsByPassiveTag(
  tag: PetPassiveTag,
  pets: Record<PetId, CultivablePetDefinition> = PETS
): PetId[] {
  return Object.values(pets)
    .filter((pet) => pet.passiveTags.includes(tag))
    .map((pet) => pet.id);
}

export function getPetCaptureThreshold(monsterMaxHp: number, hasBeastTaming = false): number {
  return monsterMaxHp * (hasBeastTaming ? 0.5 : 0.35);
}

export function canCapturePet({
  pet,
  monsterId,
  monsterMaxHp,
  monsterHp,
  itemCount,
  hasBeastTaming = false
}: {
  pet: PetDefinition;
  monsterId: MonsterId;
  monsterMaxHp: number;
  monsterHp: number;
  itemCount: number;
  hasBeastTaming?: boolean;
}): CapturePetStatus {
  const captureItem = pet.captureItem ?? 'capture_net';

  if (pet.source !== 'capture') return { ok: false, reason: 'not-capture-pet' };
  if (pet.captureFrom !== monsterId) return { ok: false, reason: 'wrong-monster' };
  if (itemCount <= 0) return { ok: false, reason: 'missing-item' };

  const weakThreshold = getPetCaptureThreshold(monsterMaxHp, hasBeastTaming);
  if (monsterHp > weakThreshold) {
    return { ok: false, reason: 'not-weakened', weakThreshold };
  }

  return { ok: true, captureItem, weakThreshold };
}
