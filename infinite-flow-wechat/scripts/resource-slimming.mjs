// Texture sizes for the Cocos replacement art, set by the size it is drawn at. The frozen 182 Web originals, the
// hero walk atlas and the battle control strip (both cut by pixel frame tables) have no rule and keep their bytes.
//
// Drawn sizes were measured in the real web-mobile build at 430x932 design points (the widest supported phone);
// at a device pixel ratio of 3 the largest draws need: monster figures 474 px, NPC figures 681 px, companion and
// pet figures 336 px, courtyard props 541 px, the hub portal 812 px, dungeon props 342 px, the dungeon gate
// 270 px, icons 198 px, portraits 240 px. Room backdrops (2796 px) and the courtyard panorama are drawn larger
// than their sources, so they keep their size. Opaque art is stored as JPEG; art with transparency stays PNG.
export const SLIMMING_TOOL = Object.freeze({ tool: 'sips', version: 'sips-316' });
export const JPEG_QUALITY = 88;

const STYLE_ICON_KEYS = new Set([
  'item:method_mist_breathing', 'item:method_iron_body', 'item:method_cloud_step', 'item:method_gate_sense',
  'item:method_star_core_method', 'item:method_beast_taming', 'item:method_void_heart',
  'item:bloodline_titan_marrow', 'item:bloodline_void_symbiote', 'item:bloodline_bastion_chitin', 'item:bloodline_phoenix_ember',
  'equipment:rebirth_amulet', 'equipment:triage_visor', 'equipment:forensic_visor',
]);
const COURTYARD_PROP_KEYS = new Set(['scene:courtyard_pillar', 'scene:courtyard_crate', 'scene:courtyard_altar', 'scene:courtyard_lamp']);
const FIGURE_KEY = /^(monster:.+|character:companion_.+|pet:.+)_world$/;
const NPC_FIGURE_KEY = /^npc:.+_world$/;

/**
 * The texture an asset ships as: `format` and, when set, the long side it is scaled down to (never up).
 * Returns undefined for assets that ship their source bytes or keep an earlier transformation.
 */
export function slimmingPlan(key) {
  if (key.startsWith('scene:dungeon_world_') || key === 'scene:hub_courtyard_walk' || key === 'dungeon:mirror_cycle_city') return { format: 'jpg' };
  if (key.startsWith('item:run_relic_')) return { format: 'jpg', longSide: 384 };
  if (key === 'character:reincarnator' || key === 'npc:companion_guide') return { format: 'jpg', longSide: 512 };
  if (FIGURE_KEY.test(key) || COURTYARD_PROP_KEYS.has(key)) return { format: 'png', longSide: 768 };
  if (NPC_FIGURE_KEY.test(key) || key === 'scene:hub_dungeon_portal') return { format: 'png', longSide: 1024 };
  if (key.startsWith('scene:dungeon_prop_') || key === 'scene:dungeon_transition_gate') return { format: 'png', longSide: 512 };
  if (STYLE_ICON_KEYS.has(key)) return { format: 'png', longSide: 384 };
  return undefined;
}

/** Target dimensions for a source of `width` x `height` under `plan`: the long side capped, the aspect kept (sips rounds the short side down). */
export function slimmedDimensions(plan, width, height) {
  const long = Math.max(width, height);
  if (!plan.longSide || long <= plan.longSide) return { width, height };
  const scale = plan.longSide / long;
  return width >= height
    ? { width: plan.longSide, height: Math.floor(height * scale) }
    : { width: Math.floor(width * scale), height: plan.longSide };
}

/** The manifest operation for a plan applied to a source of the given size. */
export function slimmingOperation(plan, width, height) {
  if (plan.format === 'jpg') return 'encode-jpeg';
  const target = slimmedDimensions(plan, width, height);
  return target.width === width && target.height === height ? 'byte-copy' : 'resize-png';
}
