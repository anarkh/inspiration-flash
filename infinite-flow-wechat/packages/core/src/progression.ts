import type { BloodlineHitEffect } from './bloodline-system';
import { COMBAT_FOCUS_MAX } from './combat-focus';
import { ART_DEFENSE_SHARE, calculateArtHit, calculatePhysicalHit, getSpeedEvasionPercent, mitigateDamage } from './combat-math';
import type { CompanionBattleEffect } from './companion-system';
import type { EquipmentKeywordId } from './equipment-keywords';
import type { PetSupport } from './pet-system';

export type ProgressionReadiness = 'ready' | 'hard' | 'deadly';

export type ProgressionStats = {
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  resistance: number;
  speed: number;
  trapCheck: number;
};

/** Everything that changes how a fight goes, as it stands before the fight. */
export type ProgressionLoadout = {
  stats: ProgressionStats;
  keywords?: Readonly<Partial<Record<EquipmentKeywordId, number>>>;
  companion?: CompanionBattleEffect;
  bloodline?: BloodlineHitEffect;
  pet?: PetSupport;
  /** The weapon skill (or charged strike) against the reference target from getPowerReferenceTarget. */
  weaponSkill?: Readonly<{ damage: number; damageKind: 'physical' | 'art' }>;
};

export type PlayerPowerBreakdown = {
  /** Damage dealt per turn, the companion's strike included. */
  offense: number;
  /** HP after defense, 术抗, evasion, shields and heals: the damage it takes to bring you down. */
  survival: number;
  combat: number;
  exploration: number;
  total: number;
};

/**
 * Power is measured against a reference enemy: 30 defense, half its damage physical and half art, 60% of your
 * speed (as the fitted monsters are), over a 4-turn fight. Damage per turn follows the focus gauge for a stretch
 * of turns, half in ordinary fights and half in elite or boss fights.
 */
const REFERENCE_DEFENSE = 30;
const REFERENCE_SPEED_RATE = 0.6;
const REFERENCE_FIGHT_TURNS = 4;
/** Turns the scale so a new save sits near its old power of about 180. */
const COMBAT_POWER_SCALE = 4;
const TRAP_CHECK_POWER = 1.5;
/** Heavy blows (every third turn, at 1.5x) carry about a quarter of the damage, and 预判 softens only them. */
const FORESIGHT_SHARE = 0.25;
/** 斩杀 (a wounded enemy) and 凝神 (a full focus gauge) each apply to about a third of the hits. */
const LATE_FIGHT_SHARE = 1 / 3;

const FOCUS_CYCLE_TURNS = 12;
/** Elite and boss fights land a heavy blow every third turn (turn 2, 5, ...); guarding it as advised fills 2 focus. */
const HEAVY_BLOW_EVERY = 3;
const GUARDED_HEAVY_FOCUS = 2;
const CHARGED_STRIKE_RATE = 1.8;

type FocusCycle = { physical: number; art: number; skill: number; physicalHits: number; artHits: number; skillHits: number };

/**
 * A stretch of turns played the way the focus rules reward: the weapon skill on a full gauge, an art when it outhits
 * an attack and there is focus to spend, otherwise an attack (+1 focus).
 */
function playFocusCycle(struck: number, artHit: number, skill: number, heavyBlows: boolean, companion?: CompanionBattleEffect): FocusCycle {
  const cycle: FocusCycle = { physical: 0, art: 0, skill: 0, physicalHits: 0, artHits: 0, skillHits: 0 };
  let focus = 0;
  for (let turn = 1; turn <= FOCUS_CYCLE_TURNS; turn += 1) {
    if (heavyBlows && turn % HEAVY_BLOW_EVERY === 2) {
      focus = Math.min(COMBAT_FOCUS_MAX, focus + GUARDED_HEAVY_FOCUS);
    } else if (focus === COMBAT_FOCUS_MAX) {
      cycle.skill += skill;
      cycle.skillHits += 1;
      focus = 0;
    } else if (artHit > struck && focus > 0) {
      cycle.art += artHit;
      cycle.artHits += 1;
      focus -= 1;
    } else {
      cycle.physical += struck;
      cycle.physicalHits += 1;
      focus = Math.min(COMBAT_FOCUS_MAX, focus + 1);
    }
    if (companion && companion.focusEvery > 0 && turn % companion.focusEvery === 0) {
      focus = Math.min(COMBAT_FOCUS_MAX, focus + companion.focusGain);
    }
  }
  return cycle;
}

const HARD_POWER_RATIO = 0.72;

/** The enemy power is measured against, as the weapon skill sees it (破甲 already applied). */
export function getPowerReferenceTarget(
  stats: Readonly<Pick<ProgressionStats, 'speed'>>,
  keywords: ProgressionLoadout['keywords'] = {}
): { defense: number; speed: number } {
  return {
    defense: (REFERENCE_DEFENSE * (100 - (keywords.pierce ?? 0))) / 100,
    speed: Math.round(stats.speed * REFERENCE_SPEED_RATE)
  };
}

export function getPlayerPowerBreakdown(loadout: ProgressionLoadout): PlayerPowerBreakdown {
  const { stats, keywords = {}, companion, bloodline, pet } = loadout;
  const target = getPowerReferenceTarget(stats, keywords);
  const struck = calculatePhysicalHit(stats.attack, target.defense);
  const artHit = calculateArtHit(stats.artPower, target.defense);
  const weaponSkill = loadout.weaponSkill ?? { damage: Math.ceil(struck * CHARGED_STRIKE_RATE), damageKind: 'physical' as const };
  const hitBoost = (keywords.opening ?? 0) / REFERENCE_FIGHT_TURNS + ((keywords.execute ?? 0) + (keywords.composure ?? 0)) * LATE_FIGHT_SHARE;
  const perTurn = (cycle: FocusCycle): number => {
    let damage =
      (cycle.physical * (100 + hitBoost) +
        cycle.art * (100 + hitBoost + (keywords.art_mastery ?? 0)) +
        cycle.skill * (100 + hitBoost + (keywords.skill_mastery ?? 0))) /
      100;
    if (bloodline) {
      const physicalHits = cycle.physicalHits + (weaponSkill.damageKind === 'physical' ? cycle.skillHits : 0);
      const artHits = cycle.artHits + (weaponSkill.damageKind === 'art' ? cycle.skillHits : 0);
      damage += physicalHits * bloodline.forceDamage + artHits * bloodline.artDamage;
    }
    return damage / FOCUS_CYCLE_TURNS;
  };
  let hit = (perTurn(playFocusCycle(struck, artHit, weaponSkill.damage, false, companion))
    + perTurn(playFocusCycle(struck, artHit, weaponSkill.damage, true, companion))) / 2;
  if (pet?.kind === 'assist') hit = (hit * (100 + pet.damagePercent)) / 100;
  let offense = hit;
  if (companion) {
    const base = companion.strikeStat === 'best' ? Math.max(stats.attack, stats.artPower) : stats[companion.strikeStat];
    offense += mitigateDamage((base * companion.strikePercent) / 100, REFERENCE_DEFENSE * ART_DEFENSE_SHARE);
  }

  let health = stats.maxHp;
  if (companion) health += (stats.maxHp * companion.emergencyHealPercent) / 100;
  if (bloodline) {
    health += Math.min(bloodline.barrierCap, bloodline.barrier * REFERENCE_FIGHT_TURNS);
    health += ((hit * bloodline.lifestealPercent) / 100) * REFERENCE_FIGHT_TURNS;
  }
  if (pet?.kind === 'ward') health += Math.min(pet.cap, pet.shield * REFERENCE_FIGHT_TURNS);
  const takenShare = 0.5 * (100 / (100 + stats.defense)) + 0.5 * (100 / (100 + stats.resistance));
  const evasion = getSpeedEvasionPercent(stats.speed, Math.round(stats.speed * REFERENCE_SPEED_RATE));
  let survival = (health / takenShare) * (100 / (100 - evasion));
  if (pet?.kind === 'warn') survival *= 100 / (100 - pet.counterCutPercent / pet.every);
  if (keywords.foresight) survival *= 100 / (100 - keywords.foresight * FORESIGHT_SHARE);

  const combat = Math.round(COMBAT_POWER_SCALE * Math.sqrt(offense * survival));
  const exploration = Math.round(stats.trapCheck * TRAP_CHECK_POWER);
  return {
    offense: Math.round(offense),
    survival: Math.round(survival),
    combat,
    exploration,
    total: combat + exploration
  };
}

export function getReadinessFromPower(playerPower: number, recommendedPower: number): ProgressionReadiness {
  if (playerPower >= recommendedPower) return 'ready';
  if (playerPower >= Math.floor(recommendedPower * HARD_POWER_RATIO)) return 'hard';
  return 'deadly';
}
