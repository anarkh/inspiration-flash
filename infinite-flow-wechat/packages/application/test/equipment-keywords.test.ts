import {
  createInitialState, DUNGEON_ORDER, enterDungeon, EQUIPMENT, EQUIPMENT_KEYWORD_ASSIGNMENTS, getCombatEncounterProfile, getDerivedStats,
  getEquipmentKeyword, getEquipmentSourceChapter, getHealingPillBaseHealing, getWornEquipmentKeywords, performCombatAction,
  selectNode, type EquipmentId, type GameState
} from '@infinite-flow/core';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Every piece first offered from chapter 9 on carries one keyword, and its recorded chapter matches the loot pools.
const late = (Object.keys(EQUIPMENT) as EquipmentId[]).filter(id => getEquipmentSourceChapter(id) >= 9);
assert(late.length === 42 && Object.keys(EQUIPMENT_KEYWORD_ASSIGNMENTS).length === 42, 'the 42 late pieces each carry a keyword');
for (const id of late) {
  assert(EQUIPMENT_KEYWORD_ASSIGNMENTS[id]?.chapter === getEquipmentSourceChapter(id), `${id}: keyword chapter matches its first offer`);
}
assert((Object.keys(EQUIPMENT) as EquipmentId[]).every(id => getEquipmentSourceChapter(id) >= 9 || !getEquipmentKeyword(id, 3)),
  'earlier gear has no keyword');

// Values grow with level and with the chapter the piece is first offered in; the same keyword counts once, at its highest.
assert(getEquipmentKeyword('causal_visor', 1)?.value === 12 && getEquipmentKeyword('causal_visor', 3)?.value === 20, 'chapter 9 gear uses the base values');
assert(getEquipmentKeyword('redline_edge', 3)?.value === 29, 'chapter 12 gear is 15% stronger (25% -> 29%)');
assert(getEquipmentKeyword('predictive_visor', 3)?.value === 30, 'chapter 19 gear is 50% stronger');
assert(getEquipmentKeyword('redline_edge', 3)?.readout.startsWith('斩杀：'), 'a keyword reads with its name first');
assert(getWornEquipmentKeywords(['return_anchor_belt', 'buffer_plate'], { return_anchor_belt: 3, buffer_plate: 1 }).bulwark === 18,
  'two pieces with the same keyword count only the higher value');

function wear(ids: EquipmentId[], level = 3): GameState {
  const base = createInitialState();
  const equipped = { ...base.equipped };
  for (const id of ids) equipped[EQUIPMENT[id].slot] = id;
  const state: GameState = {
    ...base,
    ownedEquipment: [...base.ownedEquipment, ...ids],
    equipmentLevels: { ...base.equipmentLevels, ...Object.fromEntries(ids.map(id => [id, level])) },
    equipped
  };
  const maxHp = getDerivedStats(state).maxHp;
  return { ...state, player: { ...state.player, maxHp, hp: maxHp } };
}

function fight(state: GameState, nodeId: string, turn: number, patch: Partial<NonNullable<GameState['combat']>> = {},
  dungeonId: Parameters<typeof enterDungeon>[1] = 'demon_tower_1'): GameState {
  const entered = enterDungeon({ ...state, completedDungeonIds: dungeonId === 'demon_tower_1' ? state.completedDungeonIds : [...DUNGEON_ORDER] },
    dungeonId, 'standard', undefined, { flowVersion: 2, hiddenTaskSeed: 7 });
  const started = selectNode({ ...entered, phase: 'explore', run: { ...entered.run!, currentNodeId: nodeId } }, nodeId);
  assert(started.phase === 'combat' && started.combat, `${nodeId} starts a fight`);
  // Out of reach of the counter, so a fresh hero survives any fight and only the outgoing hit is compared.
  const sturdy = dungeonId === 'demon_tower_1' ? started.player : { ...started.player, hp: 1_000_000, maxHp: 1_000_000 };
  return { ...started, player: sturdy, combat: { ...started.combat, turn, ...patch } };
}

const dealt = (before: GameState, action: Parameters<typeof performCombatAction>[1]) => {
  const after = performCombatAction(before, action);
  return { damage: before.combat!.monsterHp - (after.combat?.monsterHp ?? 0), after };
};
const boosted = (base: number, percent: number) => Math.ceil((base * (100 + percent)) / 100);

// 先手: an art on the first turn hits harder than the same art on the next (the butcher's armor only stops physical hits).
const opening = wear(['legacy_gavel']);
const openingValue = getEquipmentKeyword('legacy_gavel', 3)!.value;
const first = dealt(fight(opening, 'butcher_turn', 1, { weaponFocus: 1 }), 'art');
const second = dealt(fight(opening, 'butcher_turn', 2, { weaponFocus: 1 }), 'art');
assert(first.damage === boosted(second.damage, openingValue), '先手 raises a first-turn hit by its value');
assert(first.after.combat!.log.some(line => line.includes('先手')), 'the battle log names the keyword that fired');

// 斩杀 against a wounded enemy (a sturdy chapter 19 auditor, so the boosted hit does not just finish it); 凝神 on a full focus gauge.
const execute = wear(['redline_edge']);
const healthy = fight(execute, 'blindspot_auditor_north', 2, {}, 'panopticon_city');
const wounded = { ...healthy, combat: { ...healthy.combat!, monsterHp: Math.floor(getCombatEncounterProfile(healthy)!.monster.maxHp * 0.3) } };
assert(dealt(wounded, 'attack').damage === boosted(dealt(healthy, 'attack').damage, getEquipmentKeyword('redline_edge', 3)!.value),
  '斩杀 raises hits on an enemy at 30% or less');
const composure = wear(['parallax_visor']);
assert(dealt(fight(composure, 'fog_lesser_demon', 2, { weaponFocus: 3 }), 'attack').damage
  === boosted(dealt(fight(composure, 'fog_lesser_demon', 2, { weaponFocus: 0 }), 'attack').damage, getEquipmentKeyword('parallax_visor', 3)!.value),
  '凝神 raises hits made on a full focus gauge');

// 破甲 counts only part of the target's defense.
const pierce = wear(['helix_cleaver']);
const pierceFight = fight(pierce, 'blindspot_auditor_north', 2, {}, 'panopticon_city');
const defense = getCombatEncounterProfile(pierceFight)!.monster.defense;
const pierced = Math.floor((defense * (100 - getEquipmentKeyword('helix_cleaver', 3)!.value)) / 100);
assert(dealt(pierceFight, 'attack').damage === Math.max(3, getDerivedStats(pierceFight).attack - Math.floor(pierced * 0.6)),
  '破甲 attacks through the reduced defense');

// 药效 strengthens the healing pill; 术法精通 marks the arts it raises.
const potency = wear(['rebirth_amulet']);
assert(getHealingPillBaseHealing(potency) === Math.floor((potency.player.maxHp / 2) * (100 + getEquipmentKeyword('rebirth_amulet', 3)!.value) / 100),
  '药效 raises the pill by its value');
const auditor = (ids: EquipmentId[], turn: number, patch: Partial<NonNullable<GameState['combat']>> = {}) =>
  fight(wear(ids), 'blindspot_auditor_north', turn, patch, 'panopticon_city');
const artLog = dealt(auditor(['entropy_compass'], 2, { weaponFocus: 1 }), 'art').after.combat!.log;
assert(artLog.some(line => line.startsWith('术法精通：')), '术法精通 raises arts');

// Guard keywords: 预判 against the heavy blow (turn 2), 坚壁, 反震 thrown back and 回春 after the turn.
const guardStart = auditor(['causal_visor', 'return_anchor_belt', 'palimpsest_mantle'], 2);
const guarded = performCombatAction(guardStart, 'guard');
const guardLog = guarded.combat!.log;
assert(guardLog.some(line => line.startsWith('预判：重击伤害降低 20%')), '预判 softens the heavy blow');
assert(guardLog.some(line => line.startsWith('坚壁：')), '坚壁 trims a guarded hit');
const riposte = Number(guardLog.find(line => line.startsWith('反震：'))?.match(/反弹 (\d+) 点/)?.[1]);
assert(riposte > 0 && guardStart.combat!.monsterHp - guarded.combat!.monsterHp === riposte, '反震 throws the reported damage back at the enemy');
// 回春 uses the hero's real health, so it is checked in a chapter 1 fight that starts 20 HP short.
const renewalFight = fight(wear(['phaseweave_mantle']), 'fog_lesser_demon', 3);
const renewalStart = { ...renewalFight, player: { ...renewalFight.player, hp: renewalFight.player.maxHp - 20 } };
const renewed = performCombatAction(renewalStart, 'guard');
const healed = Number(renewed.combat!.log.find(line => line.startsWith('回春：'))?.match(/回复 (\d+) 点/)?.[1]);
const hit = Number(renewed.combat!.log.find(line => /反击造成 \d+ 点伤害/.test(line))?.match(/造成 (\d+) 点/)?.[1]);
assert(healed > 0 && renewed.player.hp === Math.min(renewed.player.maxHp, renewalStart.player.hp - hit + healed), '回春 heals after the guarded hit');
