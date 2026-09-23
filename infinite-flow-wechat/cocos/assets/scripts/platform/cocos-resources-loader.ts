import type { CocosAssetLoader } from './cocos-asset-port';

/** Creator callback errors are absent as either `null` or `undefined`. */
export type CocosCallbackError = Error | null | undefined;

export function isCocosCallbackSuccess(
  error: unknown,
): error is null | undefined {
  return error === null || error === undefined;
}

export interface CocosResourcesLike {
  get(path: string, assetType?: unknown): unknown | null;
  load(
    path: string,
    assetType: unknown,
    callback: (error: CocosCallbackError, asset?: unknown) => void,
  ): void;
  release(asset: unknown): void;
}

/**
 * Small composition bridge. The Cocos entrypoint imports `resources`/the asset
 * constructor from `cc` and injects them here; this module itself stays cc-free
 * so storage, lifecycle, and asset policy can run in plain TypeScript tests.
 */
export class CocosResourcesLoader implements CocosAssetLoader {
  constructor(
    private readonly resources: CocosResourcesLike,
    private readonly assetType: unknown,
  ) {}

  peek(resourcePath: string): unknown | null {
    return this.resources.get(resourcePath, this.assetType);
  }

  load(resourcePath: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.resources.load(resourcePath, this.assetType, (error, asset) => {
        if (!isCocosCallbackSuccess(error)) {
          reject(error);
          return;
        }
        if (asset === undefined || asset === null) {
          reject(new Error(`Cocos loaded no asset for ${resourcePath}`));
          return;
        }
        resolve(asset);
      });
    });
  }

  release(nativeHandle: unknown): void {
    this.resources.release(nativeHandle);
  }
}
