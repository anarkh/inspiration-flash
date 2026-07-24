import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERAL_TACTICAL_SLOTS,
  TACTICAL_ITEM_IDS,
  createTacticalLoadoutSnapshot,
  getTacticalItemCategory,
  isTacticalItemCarried,
  normalizeTacticalLoadout,
  validateTacticalLoadout,
  type TacticalRigSlot
} from './tactical-loadout';

describe('tactical loadout rules', () => {
  it('defines only tactical items and maps every item to its loadout category', () => {
    expect(TACTICAL_ITEM_IDS).toEqual([
      'healing_pill',
      'thunder_talisman',
      'dispel_talisman',
      'gate_sigil',
      'echo_coin',
      'capture_net',
      'spirit_bait',
      'armor_patch',
      'focus_incense'
    ]);
    expect(TACTICAL_ITEM_IDS.map((itemId) => [itemId, getTacticalItemCategory(itemId)])).toEqual([
      ['healing_pill', 'combat'],
      ['thunder_talisman', 'combat'],
      ['dispel_talisman', 'ward'],
      ['gate_sigil', 'portal'],
      ['echo_coin', 'portal'],
      ['capture_net', 'capture'],
      ['spirit_bait', 'capture'],
      ['armor_patch', 'ward'],
      ['focus_incense', 'ward']
    ]);
    expect(getTacticalItemCategory('demon_bone')).toBeUndefined();
    expect(getTacticalItemCategory('unknown_item')).toBeUndefined();
  });

  it('deduplicates by item type while preserving first occurrence order', () => {
    expect(normalizeTacticalLoadout([
      'echo_coin',
      'healing_pill',
      'echo_coin',
      'capture_net',
      'healing_pill',
      'echo_coin'
    ])).toEqual({
      normalizedItemIds: ['echo_coin', 'healing_pill', 'capture_net'],
      invalidItemIds: [],
      duplicateItemIds: ['echo_coin', 'healing_pill']
    });
  });

  it('reports material and unknown inputs instead of counting them as capacity', () => {
    const validation = validateTacticalLoadout([
      'demon_bone',
      'mystery_item',
      'healing_pill',
      'demon_bone'
    ]);

    expect(validation.normalizedItemIds).toEqual(['healing_pill']);
    expect(validation.invalidItemIds).toEqual(['demon_bone', 'mystery_item']);
    expect(validation.duplicateItemIds).toEqual(['demon_bone']);
    expect(validation.generalSlotItemIds).toEqual(['healing_pill']);
    expect(validation.isValid).toBe(false);
    expect(validation.reasons.join(' ')).toContain('demon_bone');
    expect(validation.reasons.join(' ')).toContain('mystery_item');
  });

  it('uses exactly three general slots when no specialized slots are supplied', () => {
    const validation = validateTacticalLoadout(['healing_pill', 'dispel_talisman', 'gate_sigil']);

    expect(DEFAULT_GENERAL_TACTICAL_SLOTS).toBe(3);
    expect(validation.specializedSlotAssignments).toEqual([]);
    expect(validation.generalSlotItemIds).toEqual(['healing_pill', 'dispel_talisman', 'gate_sigil']);
    expect(validation.generalSlotsUsed).toBe(3);
    expect(validation.generalSlotsAvailable).toBe(3);
    expect(validation.overflowItemIds).toEqual([]);
    expect(validation.isValid).toBe(true);
  });

  it('fills multiple same-category slots with distinct item types', () => {
    const rigSlots: TacticalRigSlot[] = [{ category: 'combat' }, { category: 'combat' }];
    const validation = validateTacticalLoadout(
      ['healing_pill', 'gate_sigil', 'thunder_talisman'],
      rigSlots
    );

    expect(validation.specializedSlotAssignments).toEqual([
      { slotIndex: 0, category: 'combat', itemId: 'healing_pill' },
      { slotIndex: 1, category: 'combat', itemId: 'thunder_talisman' }
    ]);
    expect(validation.generalSlotItemIds).toEqual(['gate_sigil']);
    expect(validation.isValid).toBe(true);
  });

  it('lets an any slot accept the first remaining tactical category', () => {
    const validation = validateTacticalLoadout(
      ['capture_net', 'focus_incense'],
      [{ category: 'any' }]
    );

    expect(validation.specializedSlotAssignments).toEqual([
      { slotIndex: 0, category: 'any', itemId: 'capture_net' }
    ]);
    expect(validation.generalSlotItemIds).toEqual(['focus_incense']);
    expect(validation.isValid).toBe(true);
  });

  it('reserves exact slots before any slots to produce an optimal fit', () => {
    const validation = validateTacticalLoadout(
      [
        'healing_pill',
        'dispel_talisman',
        'gate_sigil',
        'capture_net',
        'armor_patch',
        'focus_incense',
        'echo_coin'
      ],
      [{ category: 'any' }, { category: 'combat' }, { category: 'portal' }]
    );

    expect(validation.specializedSlotAssignments).toEqual([
      { slotIndex: 0, category: 'any', itemId: 'dispel_talisman' },
      { slotIndex: 1, category: 'combat', itemId: 'healing_pill' },
      { slotIndex: 2, category: 'portal', itemId: 'gate_sigil' }
    ]);
    expect(validation.generalSlotItemIds).toEqual(['capture_net', 'armor_patch', 'focus_incense']);
    expect(validation.overflowItemIds).toEqual(['echo_coin']);
    expect(validation.reasons[0]).toContain('echo_coin');
  });

  it('reports deterministic overflow after filling general slots in normalized order', () => {
    const validation = validateTacticalLoadout([
      'healing_pill',
      'dispel_talisman',
      'gate_sigil',
      'capture_net',
      'spirit_bait'
    ]);

    expect(validation.generalSlotItemIds).toEqual(['healing_pill', 'dispel_talisman', 'gate_sigil']);
    expect(validation.generalSlotsUsed).toBe(3);
    expect(validation.overflowItemIds).toEqual(['capture_net', 'spirit_bait']);
    expect(validation.isValid).toBe(false);
    expect(validation.reasons).toEqual([
      '专用槽匹配后仍超出 3 个通用槽，溢出：capture_net、spirit_bait。'
    ]);
  });

  it('does not mutate item or rig slot inputs while fitting', () => {
    const itemIds = Object.freeze(['healing_pill', 'gate_sigil', 'healing_pill']);
    const rigSlots = Object.freeze([Object.freeze({ category: 'any' as const })]);

    validateTacticalLoadout(itemIds, rigSlots);

    expect(itemIds).toEqual(['healing_pill', 'gate_sigil', 'healing_pill']);
    expect(rigSlots).toEqual([{ category: 'any' }]);
  });

  it('treats a missing legacy snapshot as unlimited only for known tactical items', () => {
    for (const itemId of TACTICAL_ITEM_IDS) {
      expect(isTacticalItemCarried(undefined, itemId)).toBe(true);
    }
    expect(isTacticalItemCarried(undefined, 'demon_bone')).toBe(false);
    expect(isTacticalItemCarried(undefined, 'unknown_item')).toBe(false);

    const snapshot = createTacticalLoadoutSnapshot(['healing_pill', 'echo_coin']);
    expect(isTacticalItemCarried(snapshot, 'healing_pill')).toBe(true);
    expect(isTacticalItemCarried(snapshot, 'thunder_talisman')).toBe(false);
  });

  it('creates a versioned, deduplicated snapshot with a copied item list', () => {
    const source = ['healing_pill', 'echo_coin', 'healing_pill'];
    const snapshot = createTacticalLoadoutSnapshot(source);

    source[0] = 'demon_bone';
    source.push('capture_net');

    expect(snapshot).toEqual({ rulesVersion: 1, itemIds: ['healing_pill', 'echo_coin'] });
    expect(snapshot.itemIds).not.toBe(source);
    expect(() => createTacticalLoadoutSnapshot(['healing_pill', 'demon_bone'])).toThrow(TypeError);
  });
});
