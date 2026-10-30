import { Material, builtinResMgr, gfx } from 'cc';

/**
 * Additive blending for the battle's light. The approved prototype drew its effects canvas with `lighter` and brightened
 * its afterimages, so light adds to the stage instead of covering the fighters under it. Each material reuses the
 * engine's own sprite or graphics effect and is shared by every renderer of that kind, so their draws still batch.
 */
const materials = new Map<string, Material>();

function additive(base: string, source: gfx.BlendFactor, defines: Readonly<Record<string, boolean>>): Material {
  const cached = materials.get(base);
  if (cached !== undefined) return cached;
  const material = new Material();
  material.initialize({
    effectAsset: builtinResMgr.get<Material>(base).effectAsset,
    defines,
    states: { blendState: { targets: [{ blend: true, blendSrc: source, blendDst: gfx.BlendFactor.ONE,
      blendSrcAlpha: source, blendDstAlpha: gfx.BlendFactor.ONE_MINUS_SRC_ALPHA }] } },
  });
  materials.set(base, material);
  return material;
}

/** Sprites output straight colour, so the source is weighted by its alpha. */
export const additiveSpriteMaterial = (): Material => additive('ui-sprite-material', gfx.BlendFactor.SRC_ALPHA, { USE_TEXTURE: true });
/**
 * The graphics shader already multiplies its colour by alpha (the engine blends it with ONE), so it adds as is. Graphics
 * draws in local space; the engine turns USE_LOCAL on for its own graphics material the same way.
 */
export const additiveGraphicsMaterial = (): Material => additive('ui-graphics-material', gfx.BlendFactor.ONE, { USE_LOCAL: true });
