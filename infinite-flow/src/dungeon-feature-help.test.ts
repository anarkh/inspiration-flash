import { describe, expect, it } from 'vitest';
import {
  DUNGEON_FEATURE_HELP,
  DUNGEON_FEATURE_HELP_IDS,
  DUNGEON_FEATURE_HELP_VERSION,
  isDungeonFeatureHelpId
} from './dungeon-feature-help';

describe('dungeon feature help', () => {
  it('keeps the MVP dungeon systems in one versioned, migration-friendly registry', () => {
    expect(DUNGEON_FEATURE_HELP_VERSION).toBe(17);
    expect(DUNGEON_FEATURE_HELP_IDS).toEqual([
      'difficulty',
      'playerPower',
      'infernoTier',
      'proceduralMap',
      'equipmentRoll',
      'hiddenTask',
      'directive',
      'pressure',
      'pursuit',
      'companion',
      'combatFlow',
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
    expect(DUNGEON_FEATURE_HELP.equipmentHunt.mechanic).toContain('不需要入场前选择追猎目标');
    expect(DUNGEON_FEATURE_HELP.equipmentHunt.mechanic).toContain('旧存档的定向追猎');
    expect(DUNGEON_FEATURE_HELP.playerPower.summary).toContain('当前有效装配');
    expect(DUNGEON_FEATURE_HELP.playerPower.readout).toContain('未出战灵宠不会直接增加战力');
    expect(DUNGEON_FEATURE_HELP.lootBag.mechanic).toContain('每清理 3 个非出口节点');
    expect(DUNGEON_FEATURE_HELP.lootBag.mechanic).toContain('节点不能重复领取');
    expect(DUNGEON_FEATURE_HELP.lootBag.mechanic).toContain('至少 3 个非出口节点');
    expect(DUNGEON_FEATURE_HELP.lootBag.mechanic).toContain('不会叠加额外回收奖励');
    expect(DUNGEON_FEATURE_HELP.equipmentMemory.summary).toContain('装备完成铭刻后解锁');
    expect(DUNGEON_FEATURE_HELP.relic.summary).toContain('随机强化');
    expect(DUNGEON_FEATURE_HELP.fogMap.mechanic).toContain('相邻区域');
    expect(DUNGEON_FEATURE_HELP.fogMap.mechanic).toContain('类型和名称');
    expect(DUNGEON_FEATURE_HELP.fogMap.mechanic).toContain('已侦察');
    expect(DUNGEON_FEATURE_HELP.fogMap.readout).toContain('问号只代表从未侦察');
    expect(DUNGEON_FEATURE_HELP.law.readout).toContain('“律”表示法则地标');
    expect(DUNGEON_FEATURE_HELP.law.readout).toContain('悬停');
    expect(DUNGEON_FEATURE_HELP.directive.mechanic).toContain('持续累计到本局结算');
    expect(DUNGEON_FEATURE_HELP.directive.summary).toContain('不会阻断');
    expect(DUNGEON_FEATURE_HELP.directive.mechanic).toContain('永久拥有');
    expect(DUNGEON_FEATURE_HELP.pressure.mechanic).toContain('非出口节点仅在首次清理时');
    expect(DUNGEON_FEATURE_HELP.pressure.mechanic).toContain('15% 降至 5%，再降至 0%');
    expect(DUNGEON_FEATURE_HELP.pressure.guidance).toContain('越早离开');
    expect(DUNGEON_FEATURE_HELP.pressure.guidance).toContain('出口加成也越高');
    expect(DUNGEON_FEATURE_HELP.combatFlow.mechanic).toContain('每一门入场功法战技');
    expect(DUNGEON_FEATURE_HELP.combatFlow.summary).toContain('敌方在左、轮回者在右');
    expect(DUNGEON_FEATURE_HELP.combatFlow.mechanic).toContain('右侧技能盘');
    expect(DUNGEON_FEATURE_HELP.combatFlow.mechanic).toContain('卡面只保留');
    expect(DUNGEON_FEATURE_HELP.combatFlow.mechanic).toContain('问号');
    expect(DUNGEON_FEATURE_HELP.combatFlow.guidance).toContain('主动撤离');
    expect(DUNGEON_FEATURE_HELP.method.summary).toContain('所有入场时已经学会的功法');
    expect(DUNGEON_FEATURE_HELP.method.mechanic).toContain('旧版 MVP 的单主修快照');
    expect(DUNGEON_FEATURE_HELP.bossSeal.title).toBe('出口封印');
    expect(DUNGEON_FEATURE_HELP.bossSeal.mechanic).toContain('首领节点可以按地图路线正常进入');
    expect(DUNGEON_FEATURE_HELP.infernoTier.mechanic).toContain('不能跳层');
    expect(DUNGEON_FEATURE_HELP.proceduralMap.mechanic).toContain('完整写入本轮存档');
    expect(DUNGEON_FEATURE_HELP.equipmentRoll.mechanic).toContain('1.5 倍强力词条');
  });

  it('explains how picked-up tactical supplies interact with the frozen entry loadout', () => {
    const lootBag = DUNGEON_FEATURE_HELP.lootBag;
    const pickupRules = lootBag.mechanic.split('。').filter(Boolean).slice(-3);

    expect(pickupRules).toEqual([
      '局内拾取的战术补给会先进入未结算战利品',
      '只有该类型已存在于入场携行快照时，拾取数量才可在本局使用',
      '未在快照中的类型必须先成功带回主神空间，再于下次入场前配置进携行槽'
    ]);
    expect(lootBag.readout.split('\n')).toEqual([
      '本局可用：局内拾取的战术补给先进入未结算战利品；仅当该类型已在入场携行快照中，拾取数量才可在本局使用。',
      '结算带回：奖励点、灵蕴、物品和装备均为未结算数量；通关全部带回，未消耗补给按离开结果结算；未携行类型须成功带回后，才能在下次入场前配置进携行槽。',
      '撤退/濒死损失：清理 3 个非出口节点后袋中收益固化；主动撤退带回 50%，濒死只带回 20% 奖励点，装备不能带回；不足 3 个节点时离开会全部遗失。'
    ]);
    expect(lootBag.keywords).toContain('携行快照');
  });
});
