import type {
  AssetErrorCode,
  AssetHandle,
  AssetLoadReport,
  AssetPort,
  AssetResult,
  GameAssetKind,
} from '@infinite-flow/runtime';

const GAME_ASSET_KINDS: readonly GameAssetKind[] = [
  'character',
  'npc',
  'monster',
  'equipment',
  'pet',
  'item',
  'dungeon',
  'scene',
  'fallback',
];

const DEFAULT_RETRYABLE: Readonly<Record<AssetErrorCode, boolean>> = {
  'unknown-key': false,
  'revision-mismatch': false,
  offline: true,
  timeout: true,
  integrity: false,
  decode: false,
  quota: true,
  unsupported: false,
  cancelled: true,
};

export type CocosManifestAsset = Readonly<{
  key: string;
  kind: GameAssetKind;
  resourcePath: string;
  manifestRevision?: string;
  groups?: readonly string[];
}>;

export type CocosAssetManifest = Readonly<{
  manifestRevision: string;
  assets: readonly CocosManifestAsset[];
}>;

export interface CocosAssetLoader {
  peek(resourcePath: string): unknown | null;
  load(resourcePath: string): Promise<unknown>;
  release(nativeHandle: unknown): void;
}

export type ClassifiedAssetError = Readonly<{
  code: AssetErrorCode;
  retryable: boolean;
}>;

export type CocosAssetPortOptions = Readonly<{
  manifest: CocosAssetManifest;
  loader: CocosAssetLoader;
  fallbackFactory: (kind: GameAssetKind) => unknown;
  classifyError?: (
    error: unknown,
    asset: CocosManifestAsset,
  ) => ClassifiedAssetError;
  onDiagnostic?: (diagnostic: Readonly<{
    key: string;
    revision: string;
    code: AssetErrorCode;
    cause?: unknown;
  }>) => void;
}>;

type CachedAsset = Readonly<{
  handle: AssetHandle;
  resourcePath: string;
}>;

function isGameAssetKind(value: string): value is GameAssetKind {
  return GAME_ASSET_KINDS.includes(value as GameAssetKind);
}

function errorSearchText(error: unknown): string {
  if (typeof error === 'string') return error.toLowerCase();
  if (error === null || typeof error !== 'object') return '';
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  return [candidate.code, candidate.name, candidate.message]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
}

/**
 * Converts ordinary Creator errors into the existing runtime taxonomy without
 * exposing their message. `unknown-key` is the compatibility code for a
 * manifest-known key whose native resource/path is missing; the public runtime
 * contract intentionally has no separate `missing` code.
 */
export function classifyCocosAssetError(
  error: unknown,
): ClassifiedAssetError {
  if (error !== null && typeof error === 'object') {
    const candidate = error as { code?: unknown; retryable?: unknown };
    if (
      typeof candidate.code === 'string' &&
      candidate.code in DEFAULT_RETRYABLE
    ) {
      const code = candidate.code as AssetErrorCode;
      return {
        code,
        retryable:
          code === 'cancelled' && typeof candidate.retryable === 'boolean'
            ? candidate.retryable
            : DEFAULT_RETRYABLE[code],
      };
    }
  }
  const text = errorSearchText(error);
  if (/timeout|timed[\s_-]*out|\betimedout\b/.test(text)) {
    return { code: 'timeout', retryable: true };
  }
  if (
    /offline|network|internet|disconnected|connection\s*(?:failed|refused|reset)|\beconn\w*\b|\bdns\b|\benotfound\b/.test(text)
  ) {
    return { code: 'offline', retryable: true };
  }
  if (
    /missing|not\s*found|\benoent\b|no\s*such\s*file|does\s*not\s*exist|path\s*(?:missing|unavailable|absent)/.test(text)
  ) {
    return { code: 'unknown-key', retryable: false };
  }
  if (/parse|decode|invalid|malformed|syntax|json/.test(text)) {
    return { code: 'decode', retryable: false };
  }
  if (/\bpath\s*error\b/.test(text)) {
    return { code: 'unknown-key', retryable: false };
  }
  // Unknown Creator errors are conservative and never presented as offline.
  return { code: 'decode', retryable: false };
}

function isClassifiedAssetError(value: unknown): value is ClassifiedAssetError {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { code?: unknown; retryable?: unknown };
  return (
    typeof candidate.code === 'string' &&
    candidate.code in DEFAULT_RETRYABLE &&
    typeof candidate.retryable === 'boolean'
  );
}

function failure(
  key: string,
  revision: string,
  classified: ClassifiedAssetError,
): Extract<AssetResult<never>, { ok: false }> {
  return {
    ok: false,
    key,
    revision,
    code: classified.code,
    retryable: classified.retryable,
  };
}

/** Manifest-keyed AssetPort with group reference counting and visible fallback handles. */
export class ManifestCocosAssetPort implements AssetPort {
  readonly manifestRevision: string;

  private readonly assets = new Map<string, CocosManifestAsset>();
  private readonly groups = new Map<string, readonly string[]>();
  private readonly cache = new Map<string, CachedAsset>();
  private readonly lastFailures = new Map<
    string,
    Extract<AssetResult<never>, { ok: false }>
  >();
  private readonly loadedByGroup = new Map<string, Set<string>>();
  private readonly loadedByDirectKey = new Map<string, number>();
  private readonly referenceCounts = new Map<string, number>();
  private readonly inFlightKeys = new Map<string, Promise<AssetHandle>>();
  private readonly inFlightGroups = new Map<string, Promise<AssetLoadReport>>();
  private readonly pendingReleaseGroups = new Set<string>();
  private readonly fallbackHandles = new Map<GameAssetKind, AssetHandle>();

  constructor(private readonly options: CocosAssetPortOptions) {
    this.manifestRevision = options.manifest.manifestRevision;
    if (this.manifestRevision.length === 0) {
      throw new Error('Asset manifest revision must not be empty');
    }
    const mutableGroups = new Map<string, string[]>();
    for (const asset of options.manifest.assets) {
      if (
        asset.key.length === 0 ||
        asset.resourcePath.length === 0 ||
        !isGameAssetKind(asset.kind) ||
        this.assets.has(asset.key)
      ) {
        throw new Error(`Invalid or duplicate asset manifest key: ${asset.key}`);
      }
      this.assets.set(
        asset.key,
        Object.freeze({
          ...asset,
          groups:
            asset.groups === undefined
              ? undefined
              : Object.freeze([...asset.groups]),
        }),
      );
      const groupNames = new Set(['all', asset.kind, ...(asset.groups ?? [])]);
      for (const group of groupNames) {
        if (group.length === 0) throw new Error(`Empty group for ${asset.key}`);
        const keys = mutableGroups.get(group) ?? [];
        keys.push(asset.key);
        mutableGroups.set(group, keys);
      }
    }
    for (const [group, keys] of mutableGroups) {
      this.groups.set(group, Object.freeze([...keys].sort()));
    }
  }

  resolve(key: string): AssetResult<AssetHandle> {
    const asset = this.assets.get(key);
    if (asset === undefined) {
      return failure(key, this.manifestRevision, {
        code: 'unknown-key',
        retryable: false,
      });
    }
    if (
      asset.manifestRevision !== undefined &&
      asset.manifestRevision !== this.manifestRevision
    ) {
      return failure(key, this.manifestRevision, {
        code: 'revision-mismatch',
        retryable: false,
      });
    }

    const cached = this.cache.get(this.cacheKey(key));
    if (cached !== undefined) {
      return {
        ok: true,
        value: cached.handle,
        key,
        revision: this.manifestRevision,
      };
    }
    let nativeHandle: unknown | null;
    try {
      nativeHandle = this.options.loader.peek(asset.resourcePath);
    } catch (cause) {
      const classified = this.classifyError(cause, asset);
      const item = failure(key, this.manifestRevision, classified);
      this.lastFailures.set(key, item);
      this.emitDiagnostic(key, classified.code, cause);
      return item;
    }
    if (nativeHandle !== null && nativeHandle !== undefined) {
      const handle = Object.freeze({
        manifestRevision: this.manifestRevision,
        nativeHandle,
      });
      this.cache.set(this.cacheKey(key), {
        handle,
        resourcePath: asset.resourcePath,
      });
      this.lastFailures.delete(key);
      return {
        ok: true,
        value: handle,
        key,
        revision: this.manifestRevision,
      };
    }
    return (
      this.lastFailures.get(key) ??
      failure(key, this.manifestRevision, {
        // The protocol has no "known but not loaded" code. `cancelled` keeps
        // this state retryable without misclassifying a local asset as offline.
        code: 'cancelled',
        retryable: true,
      })
    );
  }

  /**
   * Acquires one logical lease for a single manifest key. Concurrent callers
   * share the native Cocos load, but each successful call owns one release.
   * This is intentionally adapter-specific and does not widen AssetPort.
   */
  async preloadKey(key: string): Promise<AssetResult<AssetHandle>> {
    const asset = this.assets.get(key);
    if (asset === undefined) {
      return failure(key, this.manifestRevision, {
        code: 'unknown-key',
        retryable: false,
      });
    }
    if (
      asset.manifestRevision !== undefined
      && asset.manifestRevision !== this.manifestRevision
    ) {
      return failure(key, this.manifestRevision, {
        code: 'revision-mismatch',
        retryable: false,
      });
    }
    try {
      const handle = await this.loadKey(asset);
      this.loadedByDirectKey.set(
        key,
        (this.loadedByDirectKey.get(key) ?? 0) + 1,
      );
      this.referenceCounts.set(
        key,
        (this.referenceCounts.get(key) ?? 0) + 1,
      );
      return {
        ok: true,
        value: handle,
        key,
        revision: this.manifestRevision,
      };
    } catch (cause) {
      const classified = this.classifyError(cause, asset);
      const item = failure(key, this.manifestRevision, classified);
      this.lastFailures.set(key, item);
      this.emitDiagnostic(key, classified.code, cause);
      return item;
    }
  }

  /** Releases exactly one lease previously returned by preloadKey. */
  releaseKey(key: string): void {
    const directReferences = this.loadedByDirectKey.get(key) ?? 0;
    if (directReferences <= 0) return;
    if (directReferences === 1) this.loadedByDirectKey.delete(key);
    else this.loadedByDirectKey.set(key, directReferences - 1);
    this.releaseReference(key);
  }

  describeKey(key: string): Readonly<{
    resourcePath: string;
    syntheticGroup: string;
  }> | undefined {
    const asset = this.assets.get(key);
    return asset === undefined
      ? undefined
      : Object.freeze({
          resourcePath: asset.resourcePath,
          syntheticGroup: `@asset:${key}`,
        });
  }

  preload(group: string): Promise<AssetLoadReport> {
    // A new consumer arriving before the original load settles reacquires the
    // same group and cancels the earlier deferred release.
    this.pendingReleaseGroups.delete(group);
    const inFlight = this.inFlightGroups.get(group);
    if (inFlight !== undefined) return inFlight;
    const work = this.preloadGroup(group).finally(() => {
      this.inFlightGroups.delete(group);
      if (this.pendingReleaseGroups.delete(group)) this.release(group);
    });
    this.inFlightGroups.set(group, work);
    return work;
  }

  release(group: string): void {
    if (this.inFlightGroups.has(group)) {
      this.pendingReleaseGroups.add(group);
      return;
    }
    const loadedKeys = this.loadedByGroup.get(group);
    if (loadedKeys === undefined) return;
    this.loadedByGroup.delete(group);
    for (const key of loadedKeys) {
      this.releaseReference(key);
    }
  }

  fallback(kind: GameAssetKind): AssetHandle {
    const existing = this.fallbackHandles.get(kind);
    if (existing !== undefined) return existing;
    const handle = Object.freeze({
      manifestRevision: this.manifestRevision,
      nativeHandle: this.options.fallbackFactory(kind),
    });
    this.fallbackHandles.set(kind, handle);
    return handle;
  }

  private async preloadGroup(group: string): Promise<AssetLoadReport> {
    const keys = this.groups.get(group);
    if (keys === undefined) {
      return {
        group,
        revision: this.manifestRevision,
        loadedKeys: [],
        failures: [
          failure(`@group:${group}`, this.manifestRevision, {
            code: 'unknown-key',
            retryable: false,
          }),
        ],
      };
    }
    const alreadyLoaded = this.loadedByGroup.get(group) ?? new Set<string>();
    const failures: Array<Extract<AssetResult<never>, { ok: false }>> = [];

    await Promise.all(
      keys.map(async (key) => {
        if (alreadyLoaded.has(key)) return;
        const asset = this.assets.get(key);
        if (asset === undefined) return;
        if (
          asset.manifestRevision !== undefined &&
          asset.manifestRevision !== this.manifestRevision
        ) {
          const mismatch = failure(key, this.manifestRevision, {
            code: 'revision-mismatch',
            retryable: false,
          });
          this.lastFailures.set(key, mismatch);
          failures.push(mismatch);
          return;
        }
        try {
          await this.loadKey(asset);
          alreadyLoaded.add(key);
          this.referenceCounts.set(key, (this.referenceCounts.get(key) ?? 0) + 1);
        } catch (cause) {
          const classified = this.classifyError(cause, asset);
          const item = failure(key, this.manifestRevision, classified);
          this.lastFailures.set(key, item);
          failures.push(item);
          this.emitDiagnostic(key, classified.code, cause);
        }
      }),
    );
    this.loadedByGroup.set(group, alreadyLoaded);
    return {
      group,
      revision: this.manifestRevision,
      loadedKeys: [...alreadyLoaded].sort(),
      failures: failures.sort((left, right) =>
        left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
      ),
    };
  }

  private loadKey(asset: CocosManifestAsset): Promise<AssetHandle> {
    const cacheKey = this.cacheKey(asset.key);
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached.handle);
    const inFlight = this.inFlightKeys.get(asset.key);
    if (inFlight !== undefined) return inFlight;
    const work = this.options.loader
      .load(asset.resourcePath)
      .then((nativeHandle) => {
        if (nativeHandle === null || nativeHandle === undefined) {
          throw { code: 'decode', retryable: false };
        }
        const handle = Object.freeze({
          manifestRevision: this.manifestRevision,
          nativeHandle,
        });
        this.cache.set(cacheKey, {
          handle,
          resourcePath: asset.resourcePath,
        });
        this.lastFailures.delete(asset.key);
        return handle;
      })
      .finally(() => this.inFlightKeys.delete(asset.key));
    this.inFlightKeys.set(asset.key, work);
    return work;
  }

  private cacheKey(assetKey: string): string {
    return `${this.manifestRevision}\u0000${assetKey}`;
  }

  private releaseReference(key: string): void {
    const references = this.referenceCounts.get(key) ?? 0;
    if (references > 1) {
      this.referenceCounts.set(key, references - 1);
      return;
    }
    if (references <= 0) return;
    this.referenceCounts.delete(key);
    const cacheKey = this.cacheKey(key);
    const cached = this.cache.get(cacheKey);
    if (cached === undefined) return;
    this.cache.delete(cacheKey);
    try {
      this.options.loader.release(cached.handle.nativeHandle);
    } catch (cause) {
      this.emitDiagnostic(key, 'unsupported', cause);
    }
  }

  private classifyError(
    cause: unknown,
    asset: CocosManifestAsset,
  ): ClassifiedAssetError {
    try {
      const classified = (this.options.classifyError ?? classifyCocosAssetError)(
        cause,
        asset,
      );
      if (isClassifiedAssetError(classified)) return classified;
    } catch {
      // A broken classifier must not turn a load failure into an untyped throw.
    }
    return classifyCocosAssetError(cause);
  }

  private emitDiagnostic(
    key: string,
    code: AssetErrorCode,
    cause: unknown,
  ): void {
    try {
      this.options.onDiagnostic?.({
        key,
        revision: this.manifestRevision,
        code,
        cause,
      });
    } catch {
      // Diagnostics are observational and must not affect AssetPort semantics.
    }
  }
}
