// Real-time action fights built from the committed turn-based combat (an "action encounter"): which enemies take
// part, with which numbers, as the exact config createWorld takes. This module holds the mapping tables and the pure
// composition from plain domain numbers to that config; game.ts reads the committed state into those numbers
// (buildActionEncounter) and settles a replayed fight (resolveActionCombat).
//
// Runtime leaf: only types come from './game', so game.ts imports this module without a cycle, and the sim
// (./action-combat) stays standalone.
import { DEFAULT_ENEMY_ARCHETYPES, DEFAULT_ENEMY_RULES, DEFAULT_HERO_TUNING, DEFAULT_REPLAY_MAX_TICKS } from './action-combat/index';
import type {
  ActionEnemy,
  ActionStage,
  ActionWorld,
  ActionWorldConfig,
  BossArchetype,
  EnemyArchetype,
  HeroComboStep,
  HeroTuning,
  HurtSize,
  MeleeArchetype,
  RangedArchetype,
  StageSpawn,
} from './action-combat/index';
import type { DungeonId, ItemId, MonsterId, PetId } from './game';

/** normal = the room's own monster x3; elite = the elite + 2 of the chapter's normal monster; boss = the boss + adds. */
export type ActionEncounterRank = 'normal' | 'elite' | 'boss' | 'pursuer';
/** The behaviour kit a member fights with (see ACTION_MONSTER_KITS for melee / ranged). */
export type ActionEncounterKit = 'melee' | 'ranged' | 'elite' | 'boss';

/** Which turn-based basic hit one full combo deals: the plain attack or the art, whichever hits the room's monster harder. */
export type ActionComboKind = 'physical' | 'art';

/**
 * Every constant of the mapping. Damage keeps turn-based units: one full three-hit combo deals the hero's best
 * turn-based basic hit on the room's monster (the plain attack or, while methods are not sealed, the art: the
 * turn-based fights are balanced on that best hit), and every enemy strike is the turn-based counter hit times its
 * move ratio, so HP bars and damage numbers read like the turn-based fight. Durations are tuned through hpFactor
 * (scripts/balance/action-calibrate.ts).
 */
export const ACTION_ENCOUNTER_TUNING = {
  /** Share of the best basic hit each combo step deals: the prototype's 22 / 22 / 40 of 84. */
  comboShares: [22 / 84, 22 / 84, 40 / 84],
  /**
   * Member HP = the fully scaled monster max HP (boss, law, protocol, inferno, pressure and pursuit fusion included)
   * times this factor, by the member's kit (pack members and adds use their own melee / ranged factor). Calibrated
   * with the competent bot at each chapter's reference hero: normal rooms 15-25 s, elite 30-40 s, boss 60-90 s, a
   * lone pursuer (its lair room's monster) 15-25 s. The opening chapters run somewhat shorter, a gentle ramp (see
   * the calibration script's table).
   */
  hpFactor: { melee: 2.7, ranged: 1.55, elite: 3.3, boss: 3.6, pursuer: 5.4 },
  /** Enemy strike = turn-based counter hit x ratio: the prototype's damage relative to its 15-damage claw. */
  moveRatio: { claw: 1, lunge: 1.2, spark: 1, panic: 1, swing: 1.2, charge: 28 / 15, heavy: 3 },
  /** Drawn height in px by kit; the base kit's hurtbox and body radius scale with it. */
  size: { melee: 140, ranged: 110, elite: 170, boss: 185 },
  /** Elites fight with the boss kit, lower poise, no enrage and no armour above half HP. */
  elite: { maxPoise: 80 },
  /** One-hand controls are the only production scheme (world.assist). */
  assist: 2,
  /** Replay bound for a committed fight: 10 minutes of sim time. */
  maxTicks: DEFAULT_REPLAY_MAX_TICKS,
  /** A single-wave arena for a 390 px wide view; spawns past the right edge walk in. */
  stage: { width: 600, depth: 200, margin: 24, heroSpawn: { x: 170, z: 110 } },
} as const;

/**
 * Melee or ranged for every monster when it fights with a normal kit (as a normal room's monster, a pack member or an
 * add). Ranged = shooters and casters by their art and description; elites and bosses use the elite / boss kits in
 * their own rooms, their entry here only applies if they ever appear as a pack member.
 */
export const ACTION_MONSTER_KITS = {
  fog_lesser_demon: 'melee',
  tower_butcher: 'melee',
  tide_boatman: 'melee',
  mirror_thread_spider: 'melee',
  rail_wraith: 'melee',
  mine_shell_guard: 'melee',
  spark_imp: 'ranged',
  portal_molt_beast: 'melee',
  plague_orderly: 'melee',
  pulse_doctor: 'melee',
  ash_duelist: 'melee',
  furnace_judge: 'melee',
  paper_librarian: 'ranged',
  dream_jailer: 'melee',
  void_knight: 'melee',
  main_god_echo: 'melee',
  clockwork_scout: 'ranged',
  epoch_sentinel: 'melee',
  zero_hour_regent: 'melee',
  verdict_usher: 'melee',
  paradox_bailiff: 'melee',
  zero_sum_auditor: 'melee',
  entropy_deckhand: 'melee',
  dissipation_navigator: 'melee',
  last_helmsman: 'melee',
  parallax_hunter: 'ranged',
  mirror_chorus: 'melee',
  nameless_reflection: 'melee',
  erasure_copyist: 'melee',
  palimpsest_censor: 'melee',
  last_redactor: 'melee',
  reserve_bailiff: 'melee',
  inheritance_mimic: 'melee',
  estate_auctioneer: 'melee',
  gene_stalker: 'melee',
  mutation_guardian: 'melee',
  primal_curator: 'melee',
  frequency_leech: 'melee',
  dead_air_mimic: 'ranged',
  broadcast_warden: 'melee',
  last_broadcaster: 'melee',
  mimic_survivor: 'melee',
  rogue_sentry: 'ranged',
  shelter_enforcer: 'melee',
  evacuation_horror: 'melee',
  shelter_overseer: 'melee',
  hostile_witness: 'ranged',
  archive_censor: 'melee',
  perjury_hound: 'melee',
  false_testimony_judge: 'melee',
  cue_stalker: 'melee',
  continuity_editor: 'melee',
  retake_double: 'melee',
  final_cut_director: 'melee',
  sweep_sentinel: 'ranged',
  phase_hunter_drone: 'ranged',
  blindspot_auditor: 'melee',
  exposure_double: 'melee',
  all_sight_warden: 'melee',
} as const satisfies Readonly<Record<MonsterId, 'melee' | 'ranged'>>;

/** One enemy as the domain sees it: fully scaled stats reduced to the numbers the mapping needs. */
export type ActionEncounterFoe = Readonly<{
  monsterId: MonsterId;
  name: string;
  /** Fully scaled max HP (turn-based units). */
  maxHp: number;
  /** The turn-based counter hit against the hero. */
  hit: number;
  /** The hero's turn-based basic attack against this foe. */
  attackHit: number;
  /** The hero's turn-based art hit against this foe. */
  artHit: number;
  /** A boss still sealed: the awakened phase's counter hit and the hero's hits against it (its enraged state). */
  awakened?: Readonly<{ hit: number; attackHit: number; artHit: number }>;
}>;

/** A capture the room offers: the pet, its item, and the turn-based weak threshold on the primary monster's HP. */
export type ActionCaptureOffer = Readonly<{
  petId: PetId;
  itemId: ItemId;
  /** Capture works at or below this many turn-based HP. */
  thresholdHp: number;
  /** The primary monster's turn-based max HP. */
  maxHp: number;
}>;

export type ActionEncounterInput = Readonly<{
  seed: number;
  dungeonId: DungeonId;
  nodeId: string;
  rank: ActionEncounterRank;
  hero: Readonly<{
    maxHp: number;
    hp: number;
    focus: number;
    /** The turn-based art hit against the primary monster; sealed when the chapter seals methods. */
    spell: Readonly<{ damage: number; sealed: boolean }>;
    /** The equipped weapon's skill resolved against the primary monster. */
    skill: Readonly<{ name: string; damage: number; damageKind: 'physical' | 'art'; heal: number }>;
    /** Healing pills usable in this fight and the HP one restores (healing modifiers applied). */
    pill: Readonly<{ count: number; heal: number }>;
  }>;
  /** The room's own monster (the boss, the elite, the pursuer or the normal room's monster). */
  primary: ActionEncounterFoe;
  /** Its current share of max HP (a fight can open below full, e.g. after a replay release). */
  primaryHpShare: number;
  /** Elite and boss rooms: the chapter's normal monster that fills the pack. */
  pack?: ActionEncounterFoe;
  capture?: ActionCaptureOffer;
}>;

export type ActionEncounterMember = Readonly<{
  /** Key of its archetype in config.archetypes (the sim's ActionEnemy.archetype). */
  archetype: string;
  monsterId: MonsterId;
  name: string;
  kit: ActionEncounterKit;
  /** The room's own monster: capture and boss awakening read it. */
  primary: boolean;
  /** Sim HP at full health. */
  maxHp: number;
  /** Seconds after the fight starts before it appears. */
  delay: number;
}>;

export type ActionEncounter = Readonly<{
  dungeonId: DungeonId;
  nodeId: string;
  rank: ActionEncounterRank;
  /** Exactly what createWorld takes. */
  config: ActionWorldConfig;
  roster: readonly ActionEncounterMember[];
  /** config.archetypes key of the room's own monster. */
  primaryArchetype: string;
  /** The room's own monster in turn-based numbers. */
  primary: ActionEncounterFoe;
  /** One full combo's damage on the room's monster and the basic hit it stands for (also the hit kind every member's mitigation is measured with). */
  combo: Readonly<{ kind: ActionComboKind; damage: number }>;
  /** Upper bound on a committed log's ticks. */
  maxTicks: number;
  hero: ActionEncounterInput['hero'];
  capture?: ActionCaptureOffer;
}>;

const PRIMARY = 'primary';
const PACK = 'pack';
/** The melee-kit member of a normal room whose own monster is a shooter. */
const PACK_MELEE = 'pack-melee';

interface SpawnPlan {
  readonly role: 'primary' | 'pack';
  readonly x: number;
  readonly z: number;
  readonly delay?: number;
}

/**
 * Where each rank's members start (x past the arena's right edge walks in) and when they join. In a normal room
 * whose monster is ranged, the first pack member fights with the melee kit, so the hero is not only chasing shooters.
 */
const SPAWN_PLANS: Readonly<Record<ActionEncounterRank, readonly SpawnPlan[]>> = {
  normal: [
    { role: 'primary', x: 470, z: 64 },
    { role: 'pack', x: 545, z: 150 },
    { role: 'pack', x: 650, z: 104 },
  ],
  elite: [
    { role: 'primary', x: 500, z: 104 },
    { role: 'pack', x: 560, z: 40 },
    { role: 'pack', x: 650, z: 160, delay: 2 },
  ],
  boss: [
    { role: 'primary', x: 480, z: 104 },
    { role: 'pack', x: 650, z: 46, delay: 1.5 },
    { role: 'pack', x: 650, z: 160, delay: 16 },
  ],
  pursuer: [{ role: 'primary', x: 480, z: 104 }],
};

const BASE_KITS = {
  melee: DEFAULT_ENEMY_ARCHETYPES.fogDemon as MeleeArchetype,
  ranged: DEFAULT_ENEMY_ARCHETYPES.sparkImp as RangedArchetype,
  boss: DEFAULT_ENEMY_ARCHETYPES.towerButcher as BossArchetype,
};

function positive(value: number, what: string): number {
  if (!(Number.isFinite(value) && value > 0)) throw new Error(`Action encounter ${what} must be a positive number, got ${value}`);
  return value;
}

function nonNegative(value: number, what: string): number {
  if (!(Number.isFinite(value) && value >= 0)) throw new Error(`Action encounter ${what} must be a non-negative number, got ${value}`);
  return value;
}

/** The base kit's body (height, hurtbox, separation radius) at another drawn height. */
function bodyAt(base: { readonly height: number; readonly hurt: Readonly<HurtSize>; readonly radius: number }, height: number) {
  const k = height / base.height;
  return {
    height,
    hurt: { halfW: Math.round(base.hurt.halfW * k), halfD: Math.round(base.hurt.halfD * k) },
    radius: Math.round(base.radius * k),
  };
}

/** The normal kit (melee / ranged) a monster fights with outside its own elite / boss room. */
export function getActionMonsterKit(monsterId: MonsterId): 'melee' | 'ranged' {
  return ACTION_MONSTER_KITS[monsterId];
}

/** Each plan's kit and archetype key (normal rooms of a ranged monster: ranged, melee, ranged). */
function membersOf(plans: readonly SpawnPlan[], input: ActionEncounterInput, pack: ActionEncounterFoe): { plan: SpawnPlan; foe: ActionEncounterFoe; kit: ActionEncounterKit; key: string }[] {
  const mixShooters = input.rank === 'normal' && getActionMonsterKit(input.primary.monsterId) === 'ranged';
  let firstPack = true;
  return plans.map((plan) => {
    if (plan.role === 'primary') {
      const kit: ActionEncounterKit = input.rank === 'boss' ? 'boss' : input.rank === 'elite' || input.rank === 'pursuer' ? 'elite' : getActionMonsterKit(input.primary.monsterId);
      return { plan, foe: input.primary, kit, key: PRIMARY };
    }
    const melee = mixShooters && firstPack;
    firstPack = false;
    return melee
      ? { plan, foe: pack, kit: 'melee' as const, key: PACK_MELEE }
      : { plan, foe: pack, kit: getActionMonsterKit(pack.monsterId), key: PACK };
  });
}

/** The turn-based basic hit of `kind` against a foe. */
function basicHitOf(foe: Readonly<{ attackHit: number; artHit: number }>, kind: ActionComboKind, what: string): number {
  return positive(kind === 'art' ? foe.artHit : foe.attackHit, `${what} ${kind} hit`);
}

function hpFactorOf(kit: ActionEncounterKit, rank: ActionEncounterRank): number {
  const F = ACTION_ENCOUNTER_TUNING.hpFactor;
  if (kit === 'elite') return rank === 'pursuer' ? F.pursuer : F.elite;
  return F[kit];
}

/** A foe's archetype: its kit's AI and timings with the foe's damage, HP, body and per-target mitigation. */
function archetypeOf(foe: ActionEncounterFoe, kit: ActionEncounterKit, hp: number, damageTaken: number, comboKind: ActionComboKind): EnemyArchetype {
  const R = ACTION_ENCOUNTER_TUNING.moveRatio;
  const T = ACTION_ENCOUNTER_TUNING;
  const hit = positive(foe.hit, `${foe.monsterId} hit`);
  const identity = { name: foe.name, sprite: foe.monsterId, hp, damageTaken };
  if (kit === 'melee') {
    const base = BASE_KITS.melee;
    const claw = { ...base.moves.claw, damage: hit * R.claw };
    const lunge = { ...base.moves.lunge, damage: hit * R.lunge };
    return { ...base, ...bodyAt(base, T.size.melee), ...identity, attack: claw, moves: { claw, lunge } };
  }
  if (kit === 'ranged') {
    const base = BASE_KITS.ranged;
    const spark = { ...base.moves.spark, damage: hit * R.spark };
    const panic = { ...base.moves.panic, damage: hit * R.panic };
    return { ...base, ...bodyAt(base, T.size.ranged), ...identity, attack: spark, moves: { spark, panic } };
  }
  const base = BASE_KITS.boss;
  const swing = { ...base.moves.swing, damage: hit * R.swing };
  const heavy = { ...base.moves.heavy, damage: hit * R.heavy };
  const charge = { ...base.moves.charge, damage: hit * R.charge };
  const kitFields = kit === 'elite'
    ? { maxPoise: T.elite.maxPoise, armorAboveHalf: 1, enrage: null }
    : {
        enrage: base.enrage === null ? null : {
          ...base.enrage,
          // The awakened phase's atk / def bonus, as the enraged boss's damage dealt / taken.
          damageScale: foe.awakened ? positive(foe.awakened.hit, 'awakened hit') / hit : 1,
          damageTakenScale: foe.awakened ? basicHitOf(foe.awakened, comboKind, 'awakened') / basicHitOf(foe, comboKind, foe.monsterId) : 1,
        },
      };
  return { ...base, ...bodyAt(base, T.size[kit]), ...identity, attack: swing, moves: { swing, heavy, charge }, ...kitFields };
}

/** The best basic hit available in this fight: the art only counts while methods are not sealed. */
function comboKindOf(input: ActionEncounterInput): ActionComboKind {
  return !input.hero.spell.sealed && input.primary.artHit > input.primary.attackHit ? 'art' : 'physical';
}

function heroTuningOf(input: ActionEncounterInput, comboHit: number): HeroTuning {
  const H = DEFAULT_HERO_TUNING;
  const shares = ACTION_ENCOUNTER_TUNING.comboShares;
  const step = (index: 0 | 1 | 2): HeroComboStep => ({ ...H.combo[index], damage: comboHit * shares[index] });
  const combo = [step(0), step(1), step(2)] as const;
  const { spell, skill, pill } = input.hero;
  return {
    ...H,
    hp: input.hero.maxHp,
    combo,
    skill: { ...H.skill, name: skill.name, damage: nonNegative(skill.damage, 'skill damage'), ...(skill.heal > 0 ? { heal: skill.heal } : {}) },
    spell: { ...H.spell, damage: nonNegative(spell.damage, 'spell damage'), ...(spell.sealed ? { sealed: true } : {}) },
    item: { ...H.item, pills: pill.count, heal: pill.heal },
  };
}

/** Deterministic 32-bit seed from run facts (FNV-1a over the parts, then a murmur finaliser); never 0. */
export function hashActionEncounterSeed(parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0x1f, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) || 1;
}

/** The encounter for plain domain numbers: roster, stage and the createWorld config. Pure and deterministic. */
export function composeActionEncounter(input: ActionEncounterInput): ActionEncounter {
  const T = ACTION_ENCOUNTER_TUNING;
  const plans = SPAWN_PLANS[input.rank];
  const pack = input.pack ?? input.primary;
  const archetypes: Record<string, EnemyArchetype> = {};
  const roster: ActionEncounterMember[] = [];
  const spawns: StageSpawn[] = [];
  const comboKind = comboKindOf(input);
  const comboHit = basicHitOf(input.primary, comboKind, input.primary.monsterId);
  for (const { plan, foe, kit, key } of membersOf(plans, input, pack)) {
    const maxHp = Math.max(1, Math.round(positive(foe.maxHp, `${foe.monsterId} max HP`) * hpFactorOf(kit, input.rank)));
    if (!archetypes[key]) {
      // The hero's numbers are against the primary monster; another foe's defense scales what it takes, measured
      // with the same basic hit the combo stands for.
      const damageTaken = foe === input.primary ? 1 : basicHitOf(foe, comboKind, foe.monsterId) / comboHit;
      archetypes[key] = archetypeOf(foe, kit, maxHp, damageTaken, comboKind);
    }
    const delay = plan.delay ?? 0;
    const startHp = plan.role === 'primary' && input.primaryHpShare < 1
      ? Math.min(maxHp, Math.max(1, Math.round(maxHp * input.primaryHpShare)))
      : undefined;
    spawns.push({
      archetype: key,
      x: plan.x,
      z: plan.z,
      ...(delay > 0 ? { delay } : {}),
      ...(plan.role === 'primary' && kit === 'boss' ? { boss: true } : {}),
      ...(startHp === undefined || startHp === maxHp ? {} : { startHp }),
    });
    roster.push({ archetype: key, monsterId: foe.monsterId, name: foe.name, kit, primary: plan.role === 'primary', maxHp, delay });
  }
  const stage: ActionStage = {
    id: `action-${input.dungeonId}-${input.nodeId}`,
    name: input.primary.name,
    width: T.stage.width,
    depth: T.stage.depth,
    margin: T.stage.margin,
    heroSpawn: { x: T.stage.heroSpawn.x, z: T.stage.heroSpawn.z },
    waves: [{ name: input.primary.name, triggerX: 0, arena: { left: 0, right: T.stage.width }, spawns }],
  };
  const hero = heroTuningOf(input, comboHit);
  const config: ActionWorldConfig = {
    seed: input.seed,
    stage,
    hero,
    archetypes,
    rules: DEFAULT_ENEMY_RULES,
    assist: T.assist,
    heroStart: { hp: Math.max(0, Math.min(hero.hp, input.hero.hp)), focus: input.hero.focus },
  };
  return {
    dungeonId: input.dungeonId,
    nodeId: input.nodeId,
    rank: input.rank,
    config,
    roster,
    primaryArchetype: PRIMARY,
    primary: input.primary,
    combo: { kind: comboKind, damage: comboHit },
    maxTicks: T.maxTicks,
    hero: input.hero,
    ...(input.capture ? { capture: input.capture } : {}),
  };
}

function primaryMember(encounter: ActionEncounter): ActionEncounterMember {
  const member = encounter.roster.find(entry => entry.primary);
  if (!member) throw new Error(`Action encounter ${encounter.nodeId} has no primary member`);
  return member;
}

/**
 * The primary monster's remaining HP in turn-based units, in a world built from this encounter (rounded up, so a
 * sliver of sim HP is still at least 1). Before the first tick it is the HP the fight opened with; once the primary
 * is down (or its corpse is gone) it is 0.
 */
export function getActionPrimaryMonsterHp(encounter: ActionEncounter, world: ActionWorld, domainMaxHp: number): number {
  const member = primaryMember(encounter);
  let simHp: number;
  if (world.tick === 0) {
    const spawn = encounter.config.stage?.waves[0]?.spawns.find(entry => entry.archetype === member.archetype);
    simHp = spawn?.startHp ?? member.maxHp;
  } else {
    const entity = world.entities.find((e): e is ActionEnemy => e.kind === 'enemy' && e.archetype === member.archetype);
    simHp = entity ? entity.hp : 0;
  }
  return Math.ceil((simHp * domainMaxHp) / member.maxHp);
}

/** True while the fight is on, the primary monster is alive and weak enough for the room's capture offer. */
export function canCaptureInActionWorld(encounter: ActionEncounter, world: ActionWorld): boolean {
  const offer = encounter.capture;
  if (!offer || world.phase !== 'fight') return false;
  const hp = getActionPrimaryMonsterHp(encounter, world, offer.maxHp);
  return hp > 0 && hp <= offer.thresholdHp;
}
