// Chinese display labels for the loadout item categories already present on
// the VM (`loadout.items[].category`). Gallery-only UI projection text; the
// domain modules stay untouched.
import type { TacticalItemCategory } from '@infinite-flow/core/tactical-loadout';

export const ITEM_CATEGORY_LABEL: Readonly<Record<TacticalItemCategory, string>> = Object.freeze({
  combat: '战用',
  ward: '防护',
  portal: '门钥',
  capture: '捕伏',
});

export function itemCategoryLabel(category: TacticalItemCategory): string {
  return ITEM_CATEGORY_LABEL[category];
}
