import { describe, expect, it } from 'vitest';
import {
  buyItem,
  buyPet,
  capturePet,
  configureTacticalLoadout,
  createInitialState,
  enterDungeon,
  getDerivedStats,
  selectNode
} from './game';
import {
  canCapturePet,
  getPetIdsByPassiveTag,
  getPetPassiveTags,
  getPetStatBonus,
  getPetUpgradeCost,
  PETS
} from './pet-system';

function totalMaterials(cost: ReturnType<typeof getPetUpgradeCost>): number {
  return Object.values(cost.items).reduce((sum, count = 0) => sum + count, 0);
}

describe('pet system', () => {
  it('defines both shop and capture pets for the first playable slice', () => {
    const pets = Object.values(PETS);

    expect(pets).toHaveLength(6);
    expect(pets.some((pet) => pet.source === 'shop' && pet.cost)).toBe(true);
    expect(pets.some((pet) => pet.source === 'capture' && pet.captureFrom && pet.captureItem)).toBe(true);
  });

  it('buys a shop pet by spending resources and making it active', () => {
    const state = createInitialState();
    const baseStats = getDerivedStats(state);
    const bought = buyPet(state, 'contract_sprite');

    expect(bought.rewardPoints).toBe(state.rewardPoints - PETS.contract_sprite.cost!.rewardPoints!);
    expect(bought.ownedPets).toContain('contract_sprite');
    expect(bought.petLevels.contract_sprite).toBe(1);
    expect(bought.activePet).toBe('contract_sprite');
    expect(getDerivedStats(bought).spirit).toBeGreaterThan(baseStats.spirit);
  });

  it('rejects invalid pet purchases without spending resources', () => {
    const state = createInitialState();
    const captureOnly = buyPet(state, 'mist_kitten');
    const bought = buyPet(state, 'contract_sprite');
    const duplicate = buyPet(bought, 'contract_sprite');

    expect(captureOnly.rewardPoints).toBe(state.rewardPoints);
    expect(captureOnly.ownedPets).not.toContain('mist_kitten');
    expect(duplicate.rewardPoints).toBe(bought.rewardPoints);
    expect(duplicate.ownedPets.filter((petId) => petId === 'contract_sprite')).toHaveLength(1);
  });

  it('calculates level-scaled active pet bonuses', () => {
    expect(getPetStatBonus(PETS.contract_sprite, 3)).toEqual({ spirit: 1, artPower: 7 });
    expect(getPetStatBonus(PETS.ash_hound, 99)).toEqual({ attack: 8, speed: 1 });
  });

  it('scales upgrade costs across reward points, lingyun, and materials', () => {
    const level2 = getPetUpgradeCost(PETS.contract_sprite, 2);
    const level3 = getPetUpgradeCost(PETS.contract_sprite, 3);

    expect(level3.rewardPoints).toBeGreaterThan(level2.rewardPoints);
    expect(level3.lingyun).toBeGreaterThan(level2.lingyun);
    expect(totalMaterials(level3)).toBeGreaterThan(totalMaterials(level2));
  });

  it('does not charge cultivation resources for the starting pet level', () => {
    expect(getPetUpgradeCost(PETS.contract_sprite, 1)).toEqual({
      rewardPoints: 0,
      lingyun: 0,
      items: {}
    });
  });

  it('derives distinct passive tags from pet definitions', () => {
    expect(getPetPassiveTags(PETS.mist_kitten)).toEqual(['trap_scout']);
    expect(getPetPassiveTags(PETS.ash_hound)).toEqual(['combat_assist']);
    expect(getPetPassiveTags(PETS.mirror_moth)).toEqual(['portal_anchor']);
    expect(getPetIdsByPassiveTag('trap_scout')).toContain('mist_kitten');
    expect(getPetIdsByPassiveTag('combat_assist')).toContain('ash_hound');
    expect(getPetIdsByPassiveTag('portal_anchor')).toContain('mirror_moth');
  });

  it('increases level bonuses and clamps levels above the pet maximum', () => {
    const level1 = getPetStatBonus(PETS.ash_hound, 1);
    const level3 = getPetStatBonus(PETS.ash_hound, 3);
    const overMax = getPetStatBonus(PETS.ash_hound, 99);

    expect(level3.attack).toBeGreaterThan(level1.attack!);
    expect(overMax).toEqual(level3);
    expect(getPetUpgradeCost(PETS.ash_hound, 99)).toEqual(
      getPetUpgradeCost(PETS.ash_hound, PETS.ash_hound.maxLevel)
    );
  });

  it('captures a weakened matching monster by consuming the required tool', () => {
    const prepared = configureTacticalLoadout(buyItem(createInitialState(), 'capture_net'), ['capture_net']);
    const combat = selectNode(enterDungeon(prepared, 'demon_tower_1'), 'fog_lesser_demon');
    const weakened = {
      ...combat,
      combat: {
        ...combat.combat!,
        monsterHp: 10
      }
    };

    const captured = capturePet(weakened, 'mist_kitten');

    expect(captured.phase).toBe('explore');
    expect(captured.inventory.capture_net).toBe(prepared.inventory.capture_net - 1);
    expect(captured.ownedPets).toContain('mist_kitten');
    expect(captured.activePet).toBe('mist_kitten');
    expect(captured.run?.clearedNodeIds).toContain('fog_lesser_demon');
  });

  it('reports capture error conditions before changing combat state', () => {
    const noToolCombat = selectNode(enterDungeon(createInitialState(), 'demon_tower_1'), 'fog_lesser_demon');
    const noTool = {
      ...noToolCombat,
      combat: {
        ...noToolCombat.combat!,
        monsterHp: 10
      }
    };

    const wrongMonster = canCapturePet({
      pet: PETS.mirror_moth,
      monsterId: noTool.combat.monsterId,
      monsterMaxHp: 42,
      monsterHp: 10,
      itemCount: 1
    });
    const missingTool = capturePet(noTool, 'mist_kitten');
    const healthy = capturePet(buyItem(noToolCombat, 'capture_net'), 'mist_kitten');

    expect(wrongMonster).toEqual({ ok: false, reason: 'wrong-monster' });
    expect(missingTool.phase).toBe('combat');
    expect(missingTool.ownedPets).not.toContain('mist_kitten');
    expect(healthy.phase).toBe('combat');
    expect(healthy.ownedPets).not.toContain('mist_kitten');
  });
});
