import { describe, expect, it } from 'vitest';
import { EQUIPMENT, ITEMS } from './game';
import { DUNGEONS, MONSTERS } from './level-content';
import { PETS } from './pet-system';
import {
  GAME_ASSET_MANIFEST,
  GAME_ASSET_MANIFEST_VERSION,
  getGameAsset,
  getGameAssetCoverage,
  listGameAssets
} from './game-assets';

describe('game asset manifest', () => {
  it('keeps a serializable, UI-neutral schema for future clients', () => {
    expect(GAME_ASSET_MANIFEST_VERSION).toBe(1);
    expect(JSON.parse(JSON.stringify(GAME_ASSET_MANIFEST))).toEqual(GAME_ASSET_MANIFEST);

    for (const asset of listGameAssets()) {
      expect(asset.key).toBe(`${asset.kind}:${asset.entityId}`);
      expect(asset.src.startsWith('/')).toBe(true);
      expect(asset.alt.length).toBeGreaterThan(0);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
    }
  });

  it('ships the current visual batches without duplicate runtime paths', () => {
    expect(listGameAssets('character')).toHaveLength(1);
    expect(listGameAssets('npc')).toHaveLength(6);
    expect(listGameAssets('pet')).toHaveLength(6);
    expect(listGameAssets('monster')).toHaveLength(57);
    expect(listGameAssets('equipment')).toHaveLength(63);
    expect(listGameAssets('item')).toHaveLength(30);
    expect(listGameAssets('dungeon')).toHaveLength(19);
    expect(new Set(listGameAssets().map(({ src }) => src)).size).toBe(listGameAssets().length);
  });

  it('covers every catalogued visual entity', () => {
    expect(getGameAssetCoverage('pet', Object.keys(PETS))).toEqual({
      covered: 6,
      total: 6,
      missingIds: []
    });
    expect(getGameAssetCoverage('monster', Object.keys(MONSTERS))).toEqual({
      covered: 57,
      total: 57,
      missingIds: []
    });
    expect(getGameAssetCoverage('equipment', Object.keys(EQUIPMENT))).toEqual({
      covered: 63,
      total: 63,
      missingIds: []
    });
    expect(getGameAssetCoverage('item', Object.keys(ITEMS))).toEqual({
      covered: 30,
      total: 30,
      missingIds: []
    });
    expect(getGameAssetCoverage('dungeon', Object.keys(DUNGEONS))).toEqual({
      covered: 19,
      total: 19,
      missingIds: []
    });
    expect(getGameAsset('npc', 'forge_smith')?.source).toBe('project-original-generated');
    expect(getGameAsset('dungeon', 'entropy_ark')?.source).toBe('project-original-generated');
  });
});
