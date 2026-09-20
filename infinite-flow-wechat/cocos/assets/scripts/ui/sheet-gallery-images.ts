// Best-effort raster preloader for the layout gallery (?gallery=2). It walks
// the same config manifest + resources bundles as production but performs no
// UUID/revision pinning: this is a debug surface, and any missing key simply
// stays absent so the sheet's glyph/vector fallback takes over. Renders stay
// synchronous — the controller awaits settle before mounting a style.
import {
  assetManager,
  ImageAsset,
  JsonAsset,
  SpriteFrame,
  type AssetManager,
} from 'cc';
import {
  EMPTY_SHEET_IMAGE_LIBRARY,
  type SheetImage,
  type SheetImageLibrary,
} from './sheet-kit';

const CONFIG_BUNDLE_NAME = 'config';
const RESOURCES_BUNDLE_NAME = 'resources';
const MANIFEST_PATH = 'asset-manifest';

export interface GalleryImageLibraryHandle {
  readonly images: SheetImageLibrary;
  /** Release every lease acquired during preload; safe to call once. */
  dispose(): void;
}

interface ManifestEntryShape {
  readonly key?: unknown;
  readonly resourcePath?: unknown;
}

function loadBundle(name: string): Promise<AssetManager.Bundle> {
  return new Promise((resolve, reject) => {
    assetManager.loadBundle(name, (error: Error | null | undefined, bundle?: AssetManager.Bundle) => {
      if (error !== null && error !== undefined) {
        reject(error);
        return;
      }
      if (bundle === undefined || bundle === null) {
        reject(new Error(`Gallery image bundle ${name} returned no bundle`));
        return;
      }
      resolve(bundle);
    });
  });
}

function loadManifestEntryMap(bundle: AssetManager.Bundle): Promise<ReadonlyMap<string, string>> {
  return new Promise((resolve, reject) => {
    bundle.load(MANIFEST_PATH, JsonAsset, (error: Error | null | undefined, asset?: JsonAsset) => {
      if (error !== null && error !== undefined) {
        reject(error);
        return;
      }
      if (asset === undefined || asset === null) {
        reject(new Error('Gallery manifest JsonAsset missing'));
        return;
      }
      const json = asset.json as unknown;
      const entries = (json as { assets?: unknown })?.assets;
      if (!Array.isArray(entries)) {
        asset.decRef();
        reject(new Error('Gallery manifest has no assets list'));
        return;
      }
      const map = new Map<string, string>();
      for (const candidate of entries) {
        const entry = candidate as ManifestEntryShape;
        if (typeof entry?.key === 'string' && typeof entry.resourcePath === 'string') {
          map.set(entry.key, entry.resourcePath);
        }
      }
      // The JsonAsset lease ends here; only the derived path map is retained.
      asset.decRef();
      resolve(map);
    });
  });
}

function loadImage(bundle: AssetManager.Bundle, resourcePath: string): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    bundle.load(resourcePath, ImageAsset, (error: Error | null | undefined, image?: ImageAsset) => {
      if (error !== null && error !== undefined) {
        reject(error);
        return;
      }
      if (image === undefined || image === null) {
        reject(new Error(`Gallery image load returned nothing for ${resourcePath}`));
        return;
      }
      resolve(image);
    });
  });
}

/**
 * Load every requested manifest key best-effort. Unknown keys and failed
 * loads are silently omitted (the figure slot's fallback then paints). The
 * config/resources bundles themselves stay with the engine cache, as in
 * production; only the acquired ImageAsset/frame leases are released.
 */
export async function preloadGalleryImages(keys: readonly string[]): Promise<GalleryImageLibraryHandle> {
  const uniqueKeys = Array.from(new Set(keys));
  if (uniqueKeys.length === 0) {
    return { images: EMPTY_SHEET_IMAGE_LIBRARY, dispose() {} };
  }
  let configBundle: AssetManager.Bundle | undefined;
  let resourcesBundle: AssetManager.Bundle | undefined;
  try {
    configBundle = await loadBundle(CONFIG_BUNDLE_NAME);
    const pathByKey = await loadManifestEntryMap(configBundle);
    resourcesBundle = await loadBundle(RESOURCES_BUNDLE_NAME);
    const outcomes = await Promise.allSettled(uniqueKeys.map(async (key): Promise<[string, SheetImage, ImageAsset] | null> => {
      const resourcePath = pathByKey.get(key);
      if (resourcePath === undefined) return null;
      const image = await loadImage(resourcesBundle!, resourcePath);
      image.addRef();
      const frame = SpriteFrame.createWithImage(image);
      if (frame.texture === null) {
        image.decRef();
        frame.destroy();
        return null;
      }
      return [key, { frame, width: image.width, height: image.height }, image];
    }));
    const library = new Map<string, SheetImage>();
    const leases: Array<{ frame: SpriteFrame; image: ImageAsset }> = [];
    for (const outcome of outcomes) {
      if (outcome.status !== 'fulfilled' || outcome.value === null) continue;
      const [key, sheetImage, image] = outcome.value;
      library.set(key, sheetImage);
      leases.push({ frame: sheetImage.frame as SpriteFrame, image });
    }
    const images: SheetImageLibrary = Object.freeze({
      get(key: string): SheetImage | undefined {
        return library.get(key);
      },
    });
    let disposed = false;
    return {
      images,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const { frame, image } of leases) {
          frame.destroy();
          image.decRef();
        }
        library.clear();
      },
    };
  } catch {
    // Either bundle being unavailable means an entirely glyph/vector gallery.
    return { images: EMPTY_SHEET_IMAGE_LIBRARY, dispose() {} };
  }
}
