import { describe, expect, it } from 'vitest';
import {
  DUNGEON_FEATURE_HELP,
  DUNGEON_FEATURE_HELP_IDS,
  DUNGEON_FEATURE_HELP_VERSION,
  isDungeonFeatureHelpId
} from './dungeon-feature-help';

describe('dungeon feature help', () => {
  it('keeps the MVP dungeon systems in one versioned, migration-friendly registry', () => {
    expect(DUNGEON_FEATURE_HELP_VERSION).toBe(3);
    expect(DUNGEON_FEATURE_HELP_IDS).toEqual([
      'difficulty',
      'hiddenTask',
      'pressure',
      'pursuit',
      'companion',
      'method',
      'tacticalLoadout',
      'fieldSurvey',
      'soulSkill',
      'relic',
      'law',
      'lawSector',
      'equipmentHunt',
      'equipmentMemory',
      'lootBag',
      'bossSeal',
      'fogMap'
    ]);
    expect(JSON.parse(JSON.stringify(DUNGEON_FEATURE_HELP))).toEqual(DUNGEON_FEATURE_HELP);
  });

  it('gives every feature a complete player-facing explanation', () => {
    for (const id of DUNGEON_FEATURE_HELP_IDS) {
      const entry = DUNGEON_FEATURE_HELP[id];
      expect(entry.title.trim()).not.toBe('');
      expect(entry.summary.trim()).not.toBe('');
      expect(entry.mechanic.trim()).not.toBe('');
      expect(entry.guidance.trim()).not.toBe('');
      expect(entry.readout.trim()).not.toBe('');
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.keywords.every((keyword) => keyword.trim().length > 0)).toBe(true);
    }
  });

  it('recognizes only registered feature ids', () => {
    expect(isDungeonFeatureHelpId('relic')).toBe(true);
    expect(isDungeonFeatureHelpId('lawSector')).toBe(true);
    expect(isDungeonFeatureHelpId('unknown')).toBe(false);
  });

  it('preserves the MVP decisions needed by future clients', () => {
    expect(DUNGEON_FEATURE_HELP.equipmentHunt.summary).toContain('新版 MVP');
    expect(DUNGEON_FEATURE_HELP.equipmentHunt.mechanic).toContain('不再要求选择追猎目标');
    expect(DUNGEON_FEATURE_HELP.equipmentMemory.summary).toContain('装备完成铭刻后解锁');
    expect(DUNGEON_FEATURE_HELP.relic.summary).toContain('随机强化');
    expect(DUNGEON_FEATURE_HELP.fogMap.mechanic).toContain('相邻区域');
    expect(DUNGEON_FEATURE_HELP.method.summary).toContain('所有入场时已经学会的功法');
    expect(DUNGEON_FEATURE_HELP.method.mechanic).toContain('旧版 MVP 的单主修快照');
  });
});
