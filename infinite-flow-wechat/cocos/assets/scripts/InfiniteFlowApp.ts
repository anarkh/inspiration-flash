import {
  _decorator,
  assetManager,
  Component,
  ImageAsset,
  JsonAsset,
  SpriteFrame,
} from 'cc';
import type { AssetManager } from 'cc';
import {
  createInfiniteFlowClient,
  type InfiniteFlowClient,
  type InfiniteFlowDispatchResult,
} from '@infinite-flow/client';
import { getRouteContractById } from '@infinite-flow/core/route-contracts';
import {
  buildGameViewModel,
  type EntryProtocolDraft,
  type GameViewModel,
  type PresentationEvent,
  type PresentationLocalAction,
  type PresentationLocalUiState,
  type ViewActionModel,
} from '@infinite-flow/presentation';
import {
  InMemoryStoragePort,
  PortableSha256HashPort,
  SequenceSeedPort,
  type AssetErrorCode,
} from '@infinite-flow/runtime';
import {
  CocosResourcesLoader,
  ManifestCocosAssetPort,
  classifyCocosAssetError,
  createWxPlatformPorts,
  isCocosCallbackSuccess,
  missingRequiredWxLifecycleMethods,
  type CocosAssetManifest,
  type CocosResourcesLike,
  type InjectableWxPlatformApi,
  type PrefilledSecureSeedPort,
  type WxDurabilityBoundary,
} from './platform/index';
import {
  InfiniteFlowView,
  INFINITE_FLOW_PREVIEW_SAFE_INSETS,
  INFINITE_FLOW_SAFE_CONTENT_MINIMUM,
  type InfiniteFlowRuntimeChrome,
  type InfiniteFlowSafeInsets,
} from './ui/InfiniteFlowView';
import { getInfiniteFlowSceneVisualKeys } from './ui/scene-visuals';
import {
  SHEET_PORTRAIT_KEY,
  sheetEquipmentKey,
  sheetItemKey,
  type SheetImage,
  type SheetImageLibrary,
} from './ui/sheet-kit';
import { getSheetFigures, registerSheetFigures, releaseSheetFigures } from './ui/sheet-figures';
import { startInfiniteFlowSheetGallery, sheetGalleryRequested, type InfiniteFlowSheetGalleryHandle } from './ui/InfiniteFlowSheetGallery';
import { startInfiniteFlowSheetLayoutGallery, sheetLayoutGalleryRequested, type InfiniteFlowSheetLayoutGalleryHandle } from './ui/InfiniteFlowSheetLayoutGallery';
import { DEBUG, HTML5 } from 'cc/env';

const { ccclass } = _decorator;

const CONFIG_BUNDLE_NAME = 'config';
const RESOURCES_BUNDLE_NAME = 'resources';
const ASSET_MANIFEST_PATH = 'asset-manifest';
const ASSET_MANIFEST_UUID = '3d0842ec-43f7-4b5f-961f-39edb535ccd7';
const EXPECTED_MANIFEST_REVISION = 'sha256:c4a23d779df900b49cd9eae86d7be7ce5be7be03e6737e42e03cd0a3294b9ced';
const EXPECTED_MANIFEST_ASSET_COUNT = 207;
const GAME_ASSET_KINDS = new Set([
  'character',
  'npc',
  'monster',
  'equipment',
  'pet',
  'item',
  'dungeon',
  'scene',
] as const);
const VISUAL_ASSET_RETRY_DELAYS_MS = Object.freeze([
  250,
  1_000,
  3_000,
  10_000,
  30_000,
]);
const RETRYABLE_VISUAL_NETWORK_ERRORS = new Set<AssetErrorCode>([
  'offline',
  'timeout',
]);

type RuntimeMode = Readonly<{
  kind: InfiniteFlowRuntimeChrome['modeKind'];
  label: string;
  detail: string;
  nonReleaseEphemeral?: true;
}>;

type RuntimeGlobals = Readonly<{
  wx?: unknown;
}>;

type WxViewportApi = InjectableWxPlatformApi & Readonly<{
  getDeviceInfo?: () => unknown;
  getWindowInfo?: () => unknown;
  getSystemInfoSync?: () => unknown;
}>;

const BOOT_MODE: RuntimeMode = Object.freeze({
  kind: 'boot',
  label: '运行时初始化',
  detail: '正在辨识宿主、存档与随机源',
});

const PREVIEW_MODE: RuntimeMode = Object.freeze({
  kind: 'preview',
  label: '开发预览 / 内存存档',
  detail: `InMemory + Sequence seed；safe fallback ${INFINITE_FLOW_PREVIEW_SAFE_INSETS.top}/${INFINITE_FLOW_PREVIEW_SAFE_INSETS.bottom}`,
});

function wxDevtoolsNonReleaseMode(
  safeInsets: InfiniteFlowSafeInsets,
): RuntimeMode {
  return Object.freeze({
    kind: 'wx-devtools',
    label: '微信开发者工具 · NON_RELEASE',
    detail: `内存存档；关闭或刷新即丢失；safe top ${Math.ceil(safeInsets.top)} / bottom ${Math.ceil(safeInsets.bottom)}`,
    nonReleaseEphemeral: true,
  });
}

let injectedDurabilityBoundary: WxDurabilityBoundary | undefined;

export type InfiniteFlowAssetRetryScheduler = Readonly<{
  schedule(delayMs: number, callback: () => void): unknown;
  cancel(handle: unknown): void;
}>;

const DEFAULT_ASSET_RETRY_SCHEDULER: InfiniteFlowAssetRetryScheduler =
  Object.freeze({
    schedule: (delayMs, callback) => setTimeout(callback, delayMs),
    cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });

let assetRetryScheduler = DEFAULT_ASSET_RETRY_SCHEDULER;

/** Test/platform injection point; scheduled callbacks must never run inline. */
export function configureInfiniteFlowAssetRetryScheduler(
  scheduler: InfiniteFlowAssetRetryScheduler,
): void {
  if (
    scheduler === null
    || typeof scheduler !== 'object'
    || typeof scheduler.schedule !== 'function'
    || typeof scheduler.cancel !== 'function'
  ) {
    throw new Error('A callable InfiniteFlowAssetRetryScheduler is required');
  }
  assetRetryScheduler = scheduler;
}

/**
 * WeChat boot code must call this before the scene starts. Merely having wx
 * synchronous storage is not treated as real-device durability evidence.
 */
export function configureInfiniteFlowWxDurabilityBoundary(
  boundary: WxDurabilityBoundary,
): void {
  if (
    boundary === null
    || typeof boundary !== 'object'
    || typeof boundary.attestationId !== 'string'
    || boundary.attestationId.trim().length === 0
    || boundary.attestationId === 'UNATTESTED'
    || typeof boundary.attest !== 'function'
  ) {
    throw new Error('A named, callable WxDurabilityBoundary is required');
  }
  if (
    injectedDurabilityBoundary !== undefined
    && injectedDurabilityBoundary !== boundary
  ) {
    throw new Error('WxDurabilityBoundary was already injected for this runtime');
  }
  injectedDurabilityBoundary = boundary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFunction(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return typeof value[key] === 'function';
}

function resolveWxApi():
  | Readonly<{ status: 'absent' }>
  | Readonly<{ status: 'invalid'; message: string }>
  | Readonly<{ status: 'ready'; api: WxViewportApi }> {
  const candidate = (globalThis as unknown as RuntimeGlobals).wx;
  if (candidate === undefined || candidate === null) return { status: 'absent' };
  if (!isRecord(candidate)) {
    return { status: 'invalid', message: '检测到 wx，但它不是可用的平台对象。' };
  }
  const required = [
    'getStorageSync',
    'setStorageSync',
    'getUserCryptoManager',
  ] as const;
  const missing = [
    ...required.filter((key) => !hasFunction(candidate, key)),
    ...missingRequiredWxLifecycleMethods(candidate),
  ];
  if (missing.length > 0) {
    return {
      status: 'invalid',
      message: `微信平台能力不完整：缺少 ${missing.join('、')}。`,
    };
  }
  if (!hasFunction(candidate, 'getWindowInfo') && !hasFunction(candidate, 'getSystemInfoSync')) {
    return {
      status: 'invalid',
      message: '微信宿主未提供 getWindowInfo/getSystemInfoSync，无法验证 safe-area。',
    };
  }
  return { status: 'ready', api: candidate as unknown as WxViewportApi };
}

function resolveWxReportedPlatform(api: WxViewportApi):
  | Readonly<{ status: 'devtools' }>
  | Readonly<{ status: 'other'; platform: string }>
  | Readonly<{ status: 'unknown' }> {
  let deviceInfo: unknown;
  try {
    if (typeof api.getDeviceInfo === 'function') {
      deviceInfo = api.getDeviceInfo();
    } else if (typeof api.getSystemInfoSync === 'function') {
      deviceInfo = api.getSystemInfoSync();
    } else {
      return { status: 'unknown' };
    }
  } catch {
    return { status: 'unknown' };
  }
  if (!isRecord(deviceInfo) || typeof deviceInfo.platform !== 'string') {
    return { status: 'unknown' };
  }
  return deviceInfo.platform === 'devtools'
    ? { status: 'devtools' }
    : { status: 'other', platform: deviceInfo.platform };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function resolveWxSafeInsets(api: WxViewportApi):
  | Readonly<{ status: 'invalid'; message: string }>
  | Readonly<{ status: 'ready'; insets: InfiniteFlowSafeInsets }> {
  let windowInfo: unknown;
  try {
    windowInfo = api.getWindowInfo?.() ?? api.getSystemInfoSync?.();
  } catch (error) {
    return {
      status: 'invalid',
      message: `读取微信 safe-area 失败：${errorMessage(error)}`,
    };
  }
  if (!isRecord(windowInfo) || !isRecord(windowInfo.safeArea)) {
    return {
      status: 'invalid',
      message: '微信 window info 未返回完整 safeArea；拒绝猜测刘海与底部手势区。',
    };
  }
  const windowWidth = finiteNumber(windowInfo.windowWidth);
  const windowHeight = finiteNumber(windowInfo.windowHeight);
  const safeTop = finiteNumber(windowInfo.safeArea.top);
  const safeRight = finiteNumber(windowInfo.safeArea.right);
  const safeBottom = finiteNumber(windowInfo.safeArea.bottom);
  const safeLeft = finiteNumber(windowInfo.safeArea.left);
  const windowScreenTop = finiteNumber(windowInfo.screenTop) ?? 0;
  if (
    windowWidth === undefined
    || windowWidth <= 0
    || windowHeight === undefined
    || windowHeight <= 0
    || safeTop === undefined
    || safeRight === undefined
    || safeBottom === undefined
    || safeLeft === undefined
  ) {
    return {
      status: 'invalid',
      message: '微信 safeArea/windowWidth/windowHeight 含无效数值。',
    };
  }
  const windowRelativeSafeTop = safeTop - windowScreenTop;
  const windowRelativeSafeBottom = safeBottom - windowScreenTop;
  if (
    safeLeft < 0
    || windowRelativeSafeTop < 0
    || safeRight < safeLeft
    || windowRelativeSafeBottom < windowRelativeSafeTop
    || safeRight > windowWidth
    || windowRelativeSafeBottom > windowHeight
  ) {
    return {
      status: 'invalid',
      message: '微信 safeArea 坐标超出 window 边界或顺序无效。',
    };
  }
  const designPerViewportPixel = 750 / windowWidth;
  const visibleDesignHeight = windowHeight * designPerViewportPixel;
  const insets: InfiniteFlowSafeInsets = Object.freeze({
    // Fixed-width policy: the runtime surface fills the whole visible design
    // height (>= 1334 on tall phones), so physical safe areas map directly with
    // no letterbox margin to remove.
    top: Math.max(0, windowRelativeSafeTop * designPerViewportPixel),
    right: (windowWidth - safeRight) * designPerViewportPixel,
    bottom: Math.max(
      0,
      (windowHeight - windowRelativeSafeBottom) * designPerViewportPixel,
    ),
    left: safeLeft * designPerViewportPixel,
  });
  const safeWidth = 750 - insets.left - insets.right;
  const safeHeight = visibleDesignHeight - insets.top - insets.bottom;
  if (
    safeWidth < INFINITE_FLOW_SAFE_CONTENT_MINIMUM.width
    || safeHeight < INFINITE_FLOW_SAFE_CONTENT_MINIMUM.height
  ) {
    return {
      status: 'invalid',
      message: `safe-area 仅 ${Math.floor(safeWidth)}×${Math.floor(safeHeight)} design-px，低于可达布局门槛 ${INFINITE_FLOW_SAFE_CONTENT_MINIMUM.width}×${INFINITE_FLOW_SAFE_CONTENT_MINIMUM.height}。`,
    };
  }
  return { status: 'ready', insets };
}

function createPreviewSeeds(): readonly number[] {
  const values: number[] = [];
  for (let index = 0; index < 1024; index += 1) {
    const candidate = (
      0x51f1_5e5d + Math.imul(index + 1, 0x9e37_79b1)
    ) >>> 0;
    values.push(candidate === 0 ? index + 1 : candidate);
  }
  return values;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.code === 'string') return error.code;
  return '未知错误';
}

type WxDevtoolsBootStage =
  | 'platform-ports'
  | 'seed-prefill'
  | 'client-create'
  | 'view-model-refresh';

const WX_DEVTOOLS_BOOT_DIAGNOSTIC_PREFIX = 'wx-devtools-nonrelease-boot';

const BOOT_DIAGNOSTIC_URL_PATTERN = /https?:\/\/[^\s"'`]+/g;
const BOOT_DIAGNOSTIC_APPID_PATTERN = /wx[0-9a-f]{16}/gi;
const BOOT_DIAGNOSTIC_TOURIST_PATTERN = /touristappid/gi;

function redactBootDiagnosticText(text: string): string {
  return text
    .replace(BOOT_DIAGNOSTIC_URL_PATTERN, '[redacted-url]')
    .replace(BOOT_DIAGNOSTIC_APPID_PATTERN, '[redacted-appid]')
    .replace(BOOT_DIAGNOSTIC_TOURIST_PATTERN, '[redacted-appid]');
}

/**
 * NON_RELEASE boot diagnostics must never carry credentials, AppIDs, server
 * URLs, save bytes, or seed material into the console. Only a capped, redacted
 * header plus stack frames survive; the raw error is never passed to console.
 */
function sanitizeWxDevtoolsBootError(error: unknown): string {
  if (!(error instanceof Error)) {
    return `non-error: ${redactBootDiagnosticText(errorMessage(error)).slice(0, 300)}`;
  }
  const stack = typeof error.stack === 'string' && error.stack.length > 0
    ? error.stack
    : `${error.name}: ${error.message}`;
  const lines = stack.split('\n');
  const header = redactBootDiagnosticText(lines[0] ?? '').slice(0, 400);
  const frames = lines
    .slice(1)
    .filter((line) => /\bat\b/.test(line))
    .slice(0, 12)
    .map((line) => redactBootDiagnosticText(line.trim()).slice(0, 300));
  return [header, ...frames].join('\n');
}

type VisualAssetStage =
  | 'config-bundle'
  | 'manifest-identity'
  | 'manifest-load'
  | 'manifest-validate'
  | 'resources-bundle'
  | 'image-load'
  | 'frame-create'
  | 'display'
  | 'release';

class VisualAssetBootstrapError extends Error {
  constructor(
    readonly stage: VisualAssetStage,
    readonly code: AssetErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VisualAssetBootstrapError';
  }
}

type VisualAssetRecord = {
  readonly key: string;
  readonly resourcePath: string;
  readonly syntheticGroup: string;
  readonly port: ManifestCocosAssetPort;
  readonly assetGeneration: number;
  requestedGeneration: number;
  acquired: boolean;
  image?: ImageAsset;
  sceneDisplayed?: boolean;
  settled: Promise<void>;
};

type VisualBootstrapFailure = Readonly<{
  loadedRevision: string;
  bundle: string;
  resourcePath: string;
  group: string;
  stage: VisualAssetStage;
  code: AssetErrorCode;
}>;

type VisualAssetRetryTicket = {
  readonly kind: 'bootstrap';
  readonly scheduler: InfiniteFlowAssetRetryScheduler;
  readonly bootstrapGeneration: number;
  readonly assetGeneration: number;
  readonly view: InfiniteFlowView;
  readonly delayMs: number;
  handle?: unknown;
};

type VisualKeyRetryTicket = {
  readonly kind: 'per-key';
  readonly scheduler: InfiniteFlowAssetRetryScheduler;
  readonly bootstrapGeneration: number;
  readonly assetGeneration: number;
  readonly requestedGeneration: number;
  readonly view: InfiniteFlowView;
  readonly key: string;
  readonly port: ManifestCocosAssetPort;
  readonly delayMs: number;
  handle?: unknown;
};

type VisualKeyTerminalFailure = Readonly<{
  key: string;
  port: ManifestCocosAssetPort;
  assetGeneration: number;
  code: AssetErrorCode;
}>;

function loadBundle(
  name: string,
  stage: VisualAssetStage,
): Promise<AssetManager.Bundle> {
  return new Promise((resolve, reject) => {
    assetManager.loadBundle(name, (error, bundle) => {
      if (!isCocosCallbackSuccess(error)) {
        reject(new VisualAssetBootstrapError(
          stage,
          classifyCocosAssetError(error).code,
          `Cocos bundle ${name} failed to load`,
          error,
        ));
        return;
      }
      if (bundle === undefined || bundle === null) {
        reject(new VisualAssetBootstrapError(
          stage,
          'decode',
          `Cocos bundle ${name} returned no bundle`,
        ));
        return;
      }
      resolve(bundle);
    });
  });
}

function loadManifestAsset(bundle: AssetManager.Bundle): Promise<JsonAsset> {
  return new Promise((resolve, reject) => {
    const info = bundle.getInfoWithPath(ASSET_MANIFEST_PATH, JsonAsset);
    if (info?.uuid !== ASSET_MANIFEST_UUID) {
      reject(new VisualAssetBootstrapError(
        'manifest-identity',
        'integrity',
        'Config bundle manifest UUID does not match the pinned identity',
      ));
      return;
    }
    bundle.load(ASSET_MANIFEST_PATH, JsonAsset, (error, manifestAsset) => {
      if (!isCocosCallbackSuccess(error)) {
        reject(new VisualAssetBootstrapError(
          'manifest-load',
          classifyCocosAssetError(error).code,
          'Pinned JsonAsset failed to load from the config bundle',
          error,
        ));
        return;
      }
      if (
        manifestAsset === undefined
        || manifestAsset === null
        || manifestAsset.uuid !== ASSET_MANIFEST_UUID
      ) {
        reject(new VisualAssetBootstrapError(
          'manifest-identity',
          'integrity',
          'Loaded JsonAsset does not carry the pinned UUID',
        ));
        return;
      }
      // The config bundle is shared. This explicit reference is the only
      // manifest ownership claimed by this component instance.
      manifestAsset.addRef();
      resolve(manifestAsset);
    });
  });
}

function parseAssetManifest(value: unknown): CocosAssetManifest {
  if (!isRecord(value)) {
    throw new VisualAssetBootstrapError(
      'manifest-validate',
      'decode',
      'Asset manifest must be an object',
    );
  }
  if (value.schemaVersion !== 2) {
    throw new VisualAssetBootstrapError(
      'manifest-validate',
      'integrity',
      'Asset manifest schemaVersion must be 2',
    );
  }
  if (value.manifestRevision !== EXPECTED_MANIFEST_REVISION) {
    throw new VisualAssetBootstrapError(
      'manifest-validate',
      'revision-mismatch',
      'Asset manifest revision does not match the pinned runtime revision',
    );
  }
  if (
    value.assetCount !== EXPECTED_MANIFEST_ASSET_COUNT
    || !Array.isArray(value.assets)
    || value.assets.length !== EXPECTED_MANIFEST_ASSET_COUNT
  ) {
    throw new VisualAssetBootstrapError(
      'manifest-validate',
      'integrity',
      'Asset manifest must contain exactly 207 assets',
    );
  }
  const keys = new Set<string>();
  const resourcePaths = new Set<string>();
  const assets = value.assets.map((candidate) => {
    if (
      !isRecord(candidate)
      || typeof candidate.key !== 'string'
      || typeof candidate.kind !== 'string'
      || !GAME_ASSET_KINDS.has(candidate.kind as never)
      || typeof candidate.entityId !== 'string'
      || candidate.key !== `${candidate.kind}:${candidate.entityId}`
      || typeof candidate.resourcePath !== 'string'
      || candidate.resourcePath.length === 0
      || candidate.resourcePath.startsWith('/')
      || candidate.resourcePath.includes('..')
      || /\.[^/]+$/.test(candidate.resourcePath)
      || keys.has(candidate.key)
      || resourcePaths.has(candidate.resourcePath)
    ) {
      throw new VisualAssetBootstrapError(
        'manifest-validate',
        'integrity',
        'Asset manifest contains an invalid or duplicate key/resourcePath',
      );
    }
    keys.add(candidate.key);
    resourcePaths.add(candidate.resourcePath);
    return Object.freeze({
      key: candidate.key,
      kind: candidate.kind as CocosAssetManifest['assets'][number]['kind'],
      resourcePath: candidate.resourcePath,
    });
  });
  return Object.freeze({
    manifestRevision: EXPECTED_MANIFEST_REVISION,
    assets: Object.freeze(assets),
  });
}

function createImageAssetResources(
  bundle: AssetManager.Bundle,
): CocosResourcesLike {
  const ownedImages = new Map<ImageAsset, number>();
  return {
    // Never borrow a cached handle without a matching Bundle.load ownership.
    get: () => null,
    load: (resourcePath, _assetType, callback) => {
      bundle.load(resourcePath, ImageAsset, (error, image) => {
        if (isCocosCallbackSuccess(error) && image !== undefined && image !== null) {
          try {
            image.addRef();
            ownedImages.set(image, (ownedImages.get(image) ?? 0) + 1);
          } catch (cause) {
            const ownershipError = new Error(
              `Failed to retain ImageAsset for ${resourcePath}`,
            );
            (ownershipError as Error & { cause?: unknown }).cause = cause;
            callback(ownershipError, undefined);
            return;
          }
        }
        callback(error, image);
      });
    },
    release: (nativeHandle) => {
      if (!(nativeHandle instanceof ImageAsset)) {
        throw new Error('Attempted to release a non-ImageAsset handle');
      }
      const references = ownedImages.get(nativeHandle) ?? 0;
      if (references <= 0) {
        throw new Error('Attempted to release an unowned ImageAsset');
      }
      if (references === 1) ownedImages.delete(nativeHandle);
      else ownedImages.set(nativeHandle, references - 1);
      // The bundle/cache is shared. Release only the exact reference acquired
      // above; Bundle.release(path, ImageAsset) could force-release another
      // consumer's cached instance for the same path.
      nativeHandle.decRef();
    },
  };
}

function releaseManifestReference(manifest: JsonAsset | undefined): void {
  manifest?.decRef();
}

type DisposalResourceKind =
  | 'client'
  | 'lifecycle'
  | 'seeds'
  | 'view'
  | 'visual-frame'
  | 'visual-lease'
  | 'visual-manifest'
  | 'visual-retry'
  | 'visual-key-retry';

type DisposalFailure = Readonly<{
  resource: DisposalResourceKind;
  error: unknown;
}>;

function disposalErrorMessage(error: unknown): string {
  try {
    return errorMessage(error);
  } catch {
    return '无法读取原错误';
  }
}

function reportDisposalFailures(failures: readonly DisposalFailure[]): void {
  if (failures.length === 0) return;
  try {
    const summary = failures
      .map(({ resource, error }) => `${resource}: ${disposalErrorMessage(error)}`)
      .join('; ');
    console.error(
      `[InfiniteFlowApp] resource disposal failure (${failures.length}): ${summary}`,
      ...failures.map(({ error }) => error),
    );
  } catch {
    // Diagnostics must never interrupt the best-effort cleanup they describe.
  }
}

function recordDisposalFailure(
  resource: DisposalResourceKind,
  error: unknown,
  failures: DisposalFailure[] | undefined,
): void {
  const failure = { resource, error } as const;
  if (failures === undefined) {
    reportDisposalFailures([failure]);
    return;
  }
  failures.push(failure);
}

function disposeClientSafely(
  client: InfiniteFlowClient | undefined,
  failures?: DisposalFailure[],
): void {
  try {
    client?.dispose();
  } catch (error) {
    recordDisposalFailure('client', error, failures);
  }
}

function disposeLifecycleSafely(
  lifecycle: ReturnType<typeof createWxPlatformPorts>['lifecycle'] | undefined,
  failures?: DisposalFailure[],
): void {
  try {
    lifecycle?.dispose();
  } catch (error) {
    recordDisposalFailure('lifecycle', error, failures);
  }
}

function disposeSeedsSafely(
  seeds: PrefilledSecureSeedPort | undefined,
  failures?: DisposalFailure[],
): void {
  try {
    seeds?.dispose();
  } catch (error) {
    recordDisposalFailure('seeds', error, failures);
  }
}

function disposeViewSafely(
  view: InfiniteFlowView | undefined,
  failures?: DisposalFailure[],
): void {
  try {
    view?.destroy();
  } catch (error) {
    recordDisposalFailure('view', error, failures);
  }
}

function localStateWith(
  previous: PresentationLocalUiState,
  changes: Readonly<{
    entryDraft?: EntryProtocolDraft | null;
    equipmentCommissionDraft?: PresentationLocalUiState['equipmentCommissionDraft'] | null;
    hubPanel?: PresentationLocalUiState['hubPanel'] | null;
    hubSelections?: PresentationLocalUiState['hubSelections'] | null;
    activeHelpId?: PresentationLocalUiState['activeHelpId'] | null;
    advancedCombatExpanded?: boolean | null;
  }>,
): PresentationLocalUiState {
  const entryDraft = changes.entryDraft === undefined
    ? previous.entryDraft
    : changes.entryDraft ?? undefined;
  const equipmentCommissionDraft = changes.equipmentCommissionDraft === undefined
    ? previous.equipmentCommissionDraft
    : changes.equipmentCommissionDraft ?? undefined;
  const activeHelpId = changes.activeHelpId === undefined
    ? previous.activeHelpId
    : changes.activeHelpId ?? undefined;
  const hubPanel = changes.hubPanel === undefined
    ? previous.hubPanel
    : changes.hubPanel ?? undefined;
  const hubSelections = changes.hubSelections === undefined
    ? previous.hubSelections
    : changes.hubSelections ?? undefined;
  const advancedCombatExpanded = changes.advancedCombatExpanded === undefined
    ? previous.advancedCombatExpanded
    : changes.advancedCombatExpanded ?? undefined;
  return {
    ...(entryDraft === undefined ? {} : { entryDraft }),
    ...(equipmentCommissionDraft === undefined
      ? {}
      : { equipmentCommissionDraft }),
    ...(hubPanel === undefined ? {} : { hubPanel }),
    ...(hubSelections === undefined ? {} : { hubSelections }),
    ...(activeHelpId === undefined ? {} : { activeHelpId }),
    ...(advancedCombatExpanded === undefined
      ? {}
      : { advancedCombatExpanded }),
  };
}

function legalRouteContractId(
  draft: EntryProtocolDraft,
): string | undefined {
  const routeContractId = draft.routeContractId;
  if (routeContractId === undefined) return undefined;
  return getRouteContractById(routeContractId, draft.dungeonId) === undefined
    ? undefined
    : routeContractId;
}

function hasLegalRouteContract(draft: EntryProtocolDraft): boolean {
  return draft.routeContractId === undefined
    || legalRouteContractId(draft) !== undefined;
}

@ccclass('InfiniteFlowApp')
export class InfiniteFlowApp extends Component {
  private started = false;
  private destroyed = false;
  private sheetGallery: InfiniteFlowSheetGalleryHandle | undefined;
  private sheetLayoutGallery: InfiniteFlowSheetLayoutGalleryHandle | undefined;
  private bootstrapGeneration = 0;
  private view: InfiniteFlowView | undefined;
  private client: InfiniteFlowClient | undefined;
  private secureSeeds: PrefilledSecureSeedPort | undefined;
  private pendingSecureSeeds: PrefilledSecureSeedPort | undefined;
  private lifecycle:
    | ReturnType<typeof createWxPlatformPorts>['lifecycle']
    | undefined;
  private pendingLifecycle:
    | ReturnType<typeof createWxPlatformPorts>['lifecycle']
    | undefined;
  private viewModel: GameViewModel | undefined;
  private localUiState: PresentationLocalUiState = {};
  private runtimeMode: RuntimeMode = BOOT_MODE;
  private safeInsets: InfiniteFlowSafeInsets = INFINITE_FLOW_PREVIEW_SAFE_INSETS;
  private activityMessage = '等待运行时初始化';
  private blockingMessage: string | undefined;
  private busyActionId: string | undefined;
  private assetGeneration = 0;
  private visualGeneration = 0;
  private desiredVisualKey: string | undefined;
  private desiredVisualPort: ManifestCocosAssetPort | undefined;
  private assetPort: ManifestCocosAssetPort | undefined;
  private manifestAsset: JsonAsset | undefined;
  private configBundle: AssetManager.Bundle | undefined;
  private resourcesBundle: AssetManager.Bundle | undefined;
  private assetBootstrapPromise: Promise<void> | undefined;
  private visualAssetRetryAttempt = 0;
  private visualAssetRetryTicket: VisualAssetRetryTicket | undefined;
  private readonly visualKeyRetryAttempts = new Map<string, number>();
  private readonly visualKeyRetryTickets = new Map<string, VisualKeyRetryTicket>();
  private readonly visualKeyTerminalFailures = new Map<string, VisualKeyTerminalFailure>();
  private readonly visualIntentGenerations = new Map<string, number>();
  private desiredSceneVisualKeys = new Set<string>();
  private visualDrainPromise: Promise<void> = Promise.resolve();
  private restartAssetsOnNextRefresh = false;
  private readonly visualRecords = new Map<string, VisualAssetRecord>();
  private displayedVisualRecord: VisualAssetRecord | undefined;
  private lastVisualBootstrapFailure: VisualBootstrapFailure | undefined;

  // Best-effort 17-key sheet figure prime (portrait + 7 equipment + 9 items).
  // Reads the same pinned manifest port as scene visuals; missing/failed keys
  // simply stay absent and the sheet draws glyph fallbacks.
  private readonly sheetFigureLeases = new Map<string, { frame: SpriteFrame; image: ImageAsset }>();
  private readonly sheetFigureAttempted = new Set<string>();

  // The legacy primary-image diagnostics remain a projection of the keyed state.
  private get visualKeyRetryTicket(): VisualKeyRetryTicket | undefined {
    return this.desiredVisualKey === undefined ? undefined : this.visualKeyRetryTickets.get(this.desiredVisualKey);
  }

  private get visualKeyTerminalFailure(): VisualKeyTerminalFailure | undefined {
    return this.desiredVisualKey === undefined ? undefined : this.visualKeyTerminalFailures.get(this.desiredVisualKey);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    // Debug web-only style gallery (?gallery=1). HTML5/DEBUG are compile-time
    // constants, so the WeChat template (HTML5=false) and release (DEBUG=false)
    // eliminate this entire branch.
    // Debug web-only layout gallery (?gallery=2), checked before the v1 skin
    // gallery (?gallery=1). Same compile-time elimination discipline.
    if (HTML5 && DEBUG && sheetLayoutGalleryRequested()) {
      this.bootstrapSheetLayoutGallery();
      return;
    }
    if (HTML5 && DEBUG && sheetGalleryRequested()) {
      this.bootstrapSheetGallery();
      return;
    }
    this.bootRuntime();
  }

  private bootRuntime(): void {
    this.view = new InfiniteFlowView(this.node, {
      activate: (physicalId, actionId, event) => {
        this.activate(physicalId, actionId, event);
      },
    });
    this.render();
    const generation = this.beginBootstrap();
    this.startVisualAssetBootstrap(generation);
    void this.bootstrap(generation);
  }

  private bootstrapSheetGallery(): void {
    void startInfiniteFlowSheetGallery(this.node)
      .then((handle) => {
        if (this.destroyed) {
          handle.dispose();
          return;
        }
        this.sheetGallery = handle;
      })
      .catch(() => {
        // Gallery is a debug overlay; never black-screen the web preview.
        if (!this.destroyed) this.bootRuntime();
      });
  }

  private bootstrapSheetLayoutGallery(): void {
    void startInfiniteFlowSheetLayoutGallery(this.node)
      .then((handle) => {
        if (this.destroyed) {
          handle.dispose();
          return;
        }
        this.sheetLayoutGallery = handle;
      })
      .catch(() => {
        if (!this.destroyed) this.bootRuntime();
      });
  }

  update(deltaTime: number): void {
    this.view?.tick(deltaTime);
  }

  onDestroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.bootstrapGeneration += 1;
    this.sheetGallery?.dispose();
    this.sheetGallery = undefined;
    this.sheetLayoutGallery?.dispose();
    this.sheetLayoutGallery = undefined;
    const disposalFailures: DisposalFailure[] = [];
    this.invalidateVisualAssets(false, disposalFailures);
    const client = this.client;
    this.client = undefined;
    const lifecycle = this.lifecycle;
    this.lifecycle = undefined;
    const secureSeeds = this.secureSeeds;
    this.secureSeeds = undefined;
    const pendingSecureSeeds = this.pendingSecureSeeds;
    this.pendingSecureSeeds = undefined;
    const pendingLifecycle = this.pendingLifecycle;
    this.pendingLifecycle = undefined;
    const view = this.view;
    this.view = undefined;
    disposeClientSafely(client, disposalFailures);
    disposeLifecycleSafely(lifecycle, disposalFailures);
    disposeSeedsSafely(secureSeeds, disposalFailures);
    if (pendingLifecycle !== lifecycle) {
      disposeLifecycleSafely(pendingLifecycle, disposalFailures);
    }
    if (pendingSecureSeeds !== secureSeeds) {
      disposeSeedsSafely(pendingSecureSeeds, disposalFailures);
    }
    disposeViewSafely(view, disposalFailures);
    reportDisposalFailures(disposalFailures);
  }

  private beginBootstrap(): number {
    this.bootstrapGeneration += 1;
    return this.bootstrapGeneration;
  }

  private isBootstrapAlive(generation: number): boolean {
    return !this.destroyed && this.bootstrapGeneration === generation;
  }

  private isActionAlive(
    generation: number,
    client: InfiniteFlowClient,
  ): boolean {
    return this.isBootstrapAlive(generation) && this.client === client;
  }

  private isVisualAlive(
    bootstrapGeneration: number,
    assetGeneration: number,
    view: InfiniteFlowView,
  ): boolean {
    return this.isBootstrapAlive(bootstrapGeneration)
      && this.assetGeneration === assetGeneration
      && this.view === view;
  }

  private cancelVisualAssetRetry(
    resetAttempt: boolean,
    failures?: DisposalFailure[],
  ): void {
    const ticket = this.visualAssetRetryTicket;
    this.visualAssetRetryTicket = undefined;
    if (resetAttempt) this.visualAssetRetryAttempt = 0;
    if (ticket === undefined || ticket.handle === undefined) return;
    try {
      ticket.scheduler.cancel(ticket.handle);
    } catch (error) {
      recordDisposalFailure('visual-retry', error, failures);
    }
  }

  private scheduleVisualAssetRetry(
    bootstrapGeneration: number,
    assetGeneration: number,
    view: InfiniteFlowView,
    code: AssetErrorCode,
  ): void {
    // A missing port is owned by the bootstrap retry channel. It must never
    // compete with a per-key retry for the same desired visual.
    this.cancelVisualKeyRetry(true);
    if (!RETRYABLE_VISUAL_NETWORK_ERRORS.has(code)) {
      this.cancelVisualAssetRetry(true);
      return;
    }
    if (
      this.visualAssetRetryTicket !== undefined
    ) {
      return;
    }
    const delayIndex = Math.min(
      this.visualAssetRetryAttempt,
      VISUAL_ASSET_RETRY_DELAYS_MS.length - 1,
    );
    const delayMs = VISUAL_ASSET_RETRY_DELAYS_MS[delayIndex];
    if (delayMs === undefined) return;
    const scheduler = assetRetryScheduler;
    const ticket: VisualAssetRetryTicket = {
      kind: 'bootstrap',
      scheduler,
      bootstrapGeneration,
      assetGeneration,
      view,
      delayMs,
    };
    try {
      ticket.handle = scheduler.schedule(delayMs, () => {
        this.runScheduledVisualAssetRetry(ticket);
      });
      this.visualAssetRetryTicket = ticket;
      this.visualAssetRetryAttempt = Math.min(
        this.visualAssetRetryAttempt + 1,
        VISUAL_ASSET_RETRY_DELAYS_MS.length - 1,
      );
    } catch (error) {
      recordDisposalFailure('visual-retry', error, undefined);
    }
  }

  private runScheduledVisualAssetRetry(ticket: VisualAssetRetryTicket): void {
    if (this.visualAssetRetryTicket !== ticket) return;
    this.visualAssetRetryTicket = undefined;
    if (!this.isVisualAlive(
      ticket.bootstrapGeneration,
      ticket.assetGeneration,
      ticket.view,
    )) {
      return;
    }
    const restart = (): void => {
      if (!this.isVisualAlive(
        ticket.bootstrapGeneration,
        ticket.assetGeneration,
        ticket.view,
      )) {
        return;
      }
      this.startVisualAssetBootstrap(ticket.bootstrapGeneration);
    };
    const pendingBootstrap = this.assetBootstrapPromise;
    if (pendingBootstrap === undefined) {
      restart();
      return;
    }
    void pendingBootstrap.then(restart, restart);
  }

  private cancelVisualKeyRetry(
    resetAttempt: boolean,
    failures?: DisposalFailure[],
    key?: string,
  ): void {
    const keys = key === undefined
      ? new Set(Array.from(this.visualKeyRetryTickets.keys()).concat(Array.from(this.visualKeyRetryAttempts.keys())))
      : new Set([key]);
    for (const target of keys) {
      const ticket = this.visualKeyRetryTickets.get(target);
      this.visualKeyRetryTickets.delete(target);
      if (resetAttempt) this.visualKeyRetryAttempts.delete(target);
      if (ticket === undefined || ticket.handle === undefined) continue;
      try {
        ticket.scheduler.cancel(ticket.handle);
      } catch (error) {
        recordDisposalFailure('visual-key-retry', error, failures);
      }
    }
  }

  private isVisualKeyRetryCurrent(ticket: VisualKeyRetryTicket): boolean {
    return this.isBootstrapAlive(ticket.bootstrapGeneration)
      && this.assetGeneration === ticket.assetGeneration
      && this.visualIntentGenerations.get(ticket.key) === ticket.requestedGeneration
      && this.assetPort === ticket.port
      && this.desiredVisualPort === ticket.port
      && this.view === ticket.view;
  }

  private isVisualKeyTerminalFailureCurrent(
    key: string | undefined,
    port: ManifestCocosAssetPort | undefined,
  ): boolean {
    const failure = key === undefined ? undefined : this.visualKeyTerminalFailures.get(key);
    return failure !== undefined
      && failure.key === key
      && failure.port === port
      && failure.assetGeneration === this.assetGeneration;
  }

  private markVisualKeyTerminalFailure(
    key: string,
    port: ManifestCocosAssetPort,
    assetGeneration: number,
    code: AssetErrorCode,
  ): void {
    if (
      this.destroyed
      || this.assetGeneration !== assetGeneration
      || this.assetPort !== port
      || this.desiredVisualPort !== port
      || !this.visualIntentGenerations.has(key)
    ) {
      return;
    }
    this.visualKeyTerminalFailures.set(key, Object.freeze({
      key,
      port,
      assetGeneration,
      code,
    }));
  }

  private scheduleVisualKeyRetry(
    record: VisualAssetRecord,
    code: AssetErrorCode,
    retryable: boolean,
  ): void {
    if (!retryable || !RETRYABLE_VISUAL_NETWORK_ERRORS.has(code)) {
      this.markVisualKeyTerminalFailure(
        record.key,
        record.port,
        record.assetGeneration,
        code,
      );
      this.cancelVisualKeyRetry(true, undefined, record.key);
      return;
    }
    this.visualKeyTerminalFailures.delete(record.key);
    if (
      !this.isVisualIntentCurrent(record)
      || this.visualAssetRetryTicket !== undefined
    ) {
      return;
    }
    if (this.visualKeyRetryTickets.has(record.key)) return;
    const view = this.view;
    if (view === undefined) return;
    const delayIndex = Math.min(
      this.visualKeyRetryAttempts.get(record.key) ?? 0,
      VISUAL_ASSET_RETRY_DELAYS_MS.length - 1,
    );
    const delayMs = VISUAL_ASSET_RETRY_DELAYS_MS[delayIndex];
    if (delayMs === undefined) return;
    const scheduler = assetRetryScheduler;
    const ticket: VisualKeyRetryTicket = {
      kind: 'per-key',
      scheduler,
      bootstrapGeneration: this.bootstrapGeneration,
      assetGeneration: record.assetGeneration,
      requestedGeneration: record.requestedGeneration,
      view,
      key: record.key,
      port: record.port,
      delayMs,
    };
    try {
      ticket.handle = scheduler.schedule(delayMs, () => {
        this.runScheduledVisualKeyRetry(ticket);
      });
      this.visualKeyRetryTickets.set(record.key, ticket);
      this.visualKeyRetryAttempts.set(record.key, Math.min(
        (this.visualKeyRetryAttempts.get(record.key) ?? 0) + 1,
        VISUAL_ASSET_RETRY_DELAYS_MS.length - 1,
      ));
    } catch (error) {
      recordDisposalFailure('visual-key-retry', error, undefined);
    }
  }

  private runScheduledVisualKeyRetry(ticket: VisualKeyRetryTicket): void {
    if (this.visualKeyRetryTickets.get(ticket.key) !== ticket) return;
    this.visualKeyRetryTickets.delete(ticket.key);
    if (!this.isVisualKeyRetryCurrent(ticket)) return;
    if (this.visualRecords.has(ticket.key)) return;
    const described = ticket.port.describeKey(ticket.key);
    if (described === undefined) {
      this.markVisualKeyTerminalFailure(
        ticket.key,
        ticket.port,
        ticket.assetGeneration,
        'unknown-key',
      );
      this.cancelVisualKeyRetry(true, undefined, ticket.key);
      return;
    }
    this.startVisualRecord({
      key: ticket.key,
      resourcePath: described.resourcePath,
      syntheticGroup: described.syntheticGroup,
      port: ticket.port,
      assetGeneration: ticket.assetGeneration,
      requestedGeneration: ticket.requestedGeneration,
      acquired: false,
      settled: Promise.resolve(),
    }, false);
  }

  private startVisualAssetBootstrap(
    bootstrapGeneration = this.bootstrapGeneration,
  ): void {
    if (
      this.destroyed
      || this.view === undefined
      || this.assetPort !== undefined
      || this.assetBootstrapPromise !== undefined
    ) {
      return;
    }
    this.cancelVisualKeyRetry(true);
    this.visualKeyTerminalFailures.clear();
    const assetGeneration = this.assetGeneration + 1;
    this.assetGeneration = assetGeneration;
    const view = this.view;
    const drain = this.visualDrainPromise;
    let work: Promise<void>;
    work = this.bootstrapVisualAssets(
      bootstrapGeneration,
      assetGeneration,
      view,
      drain,
    ).finally(() => {
      if (this.assetBootstrapPromise === work) {
        this.assetBootstrapPromise = undefined;
      }
    });
    this.assetBootstrapPromise = work;
  }

  private async bootstrapVisualAssets(
    bootstrapGeneration: number,
    assetGeneration: number,
    view: InfiniteFlowView,
    drain: Promise<void>,
  ): Promise<void> {
    let manifestAsset: JsonAsset | undefined;
    let loadedRevision = 'unavailable';
    try {
      await drain;
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) return;
      const configBundle = await loadBundle(
        CONFIG_BUNDLE_NAME,
        'config-bundle',
      );
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) return;
      manifestAsset = await loadManifestAsset(configBundle);
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) {
        releaseManifestReference(manifestAsset);
        manifestAsset = undefined;
        return;
      }
      if (
        isRecord(manifestAsset.json)
        && typeof manifestAsset.json.manifestRevision === 'string'
      ) {
        loadedRevision = manifestAsset.json.manifestRevision;
      }
      const manifest = parseAssetManifest(manifestAsset.json);
      loadedRevision = manifest.manifestRevision;
      const resourcesBundle = await loadBundle(
        RESOURCES_BUNDLE_NAME,
        'resources-bundle',
      );
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) {
        releaseManifestReference(manifestAsset);
        manifestAsset = undefined;
        return;
      }
      const loader = new CocosResourcesLoader(
        createImageAssetResources(resourcesBundle),
        ImageAsset,
      );
      const port = new ManifestCocosAssetPort({
        manifest,
        loader,
        fallbackFactory: (kind) => Object.freeze({ kind, fallback: true }),
        classifyError: classifyCocosAssetError,
        onDiagnostic: (diagnostic) => {
          if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) return;
          if (!this.visualIntentGenerations.has(diagnostic.key)) return;
          const described = port.describeKey(diagnostic.key);
          this.showVisualFallback({
            key: diagnostic.key,
            loadedRevision: diagnostic.revision,
            bundle: RESOURCES_BUNDLE_NAME,
            resourcePath: described?.resourcePath ?? 'unknown',
            group: described?.syntheticGroup ?? `@asset:${diagnostic.key}`,
            requestedGeneration: this.visualIntentGenerations.get(diagnostic.key) ?? this.visualGeneration,
            stage: diagnostic.code === 'unsupported' ? 'release' : 'image-load',
            code: diagnostic.code,
          });
        },
      });
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) {
        releaseManifestReference(manifestAsset);
        manifestAsset = undefined;
        return;
      }
      this.configBundle = configBundle;
      this.resourcesBundle = resourcesBundle;
      this.manifestAsset = manifestAsset;
      manifestAsset = undefined;
      this.assetPort = port;
      this.cancelVisualAssetRetry(true);
      this.lastVisualBootstrapFailure = undefined;
      this.desiredVisualPort = undefined;
      this.requestVisualAsset(this.desiredVisualKey, Array.from(this.desiredSceneVisualKeys));
      this.primeSheetFigures();
    } catch (error) {
      try {
        releaseManifestReference(manifestAsset);
      } catch (releaseError) {
        recordDisposalFailure('visual-manifest', releaseError, undefined);
      }
      if (!this.isVisualAlive(bootstrapGeneration, assetGeneration, view)) return;
      const classified = error instanceof VisualAssetBootstrapError
        ? error
        : new VisualAssetBootstrapError(
            'manifest-validate',
            classifyCocosAssetError(error).code,
            'Visual asset bootstrap failed',
            error,
          );
      const bootstrapFailure: VisualBootstrapFailure = {
        loadedRevision,
        bundle: classified.stage === 'resources-bundle'
          ? RESOURCES_BUNDLE_NAME
          : CONFIG_BUNDLE_NAME,
        resourcePath: classified.stage.startsWith('manifest')
          || classified.stage === 'config-bundle'
          ? ASSET_MANIFEST_PATH
          : 'unknown',
        group: classified.stage === 'resources-bundle'
          ? RESOURCES_BUNDLE_NAME
          : CONFIG_BUNDLE_NAME,
        stage: classified.stage,
        code: classified.code,
      };
      this.lastVisualBootstrapFailure = bootstrapFailure;
      this.scheduleVisualAssetRetry(
        bootstrapGeneration,
        assetGeneration,
        view,
        classified.code,
      );
      this.showVisualFallback({
        key: this.desiredVisualKey ?? '@none',
        ...bootstrapFailure,
        requestedGeneration: this.visualGeneration,
      });
    }
  }

  private requestVisualAsset(
    key: string | undefined,
    sceneKeys: readonly string[] = [],
  ): void {
    if (this.destroyed) return;
    const port = this.assetPort;
    const desired = new Set(key === undefined ? sceneKeys : [key, ...sceneKeys]);
    const previousPrimary = this.desiredVisualKey;
    const portChanged = port !== this.desiredVisualPort;
    const intentChanged = portChanged || key !== previousPrimary
      || desired.size !== this.visualIntentGenerations.size
      || Array.from(desired).some((item) => !this.visualIntentGenerations.has(item));
    if (intentChanged) this.visualGeneration += 1;
    this.desiredVisualKey = key;
    this.desiredVisualPort = port;
    this.desiredSceneVisualKeys = new Set(sceneKeys);
    if (previousPrimary !== key || portChanged) {
      this.displayedVisualRecord = undefined;
      try {
        this.view?.clearVisualAsset();
      } catch (error) {
        recordDisposalFailure('visual-frame', error, undefined);
      }
    }
    for (const current of this.visualIntentGenerations.keys()) {
      if (!portChanged && desired.has(current)) continue;
      this.visualIntentGenerations.delete(current);
      this.cancelVisualKeyRetry(true, undefined, current);
      this.visualKeyTerminalFailures.delete(current);
      try {
        this.view?.clearSceneVisualAsset(current);
      } catch (error) {
        recordDisposalFailure('visual-frame', error, undefined);
      }
    }
    this.releaseReadyVisualRecordsExcept(desired, port);
    for (const current of desired) {
      if (!this.visualIntentGenerations.has(current)) {
        this.visualIntentGenerations.set(current, this.visualGeneration);
      }
      const record = this.visualRecords.get(current);
      if (record !== undefined && record.port === port) {
        record.requestedGeneration = this.visualIntentGenerations.get(current)!;
        if (current === key && previousPrimary !== key && record.acquired) {
          this.displayVisualRecord(record);
        }
        continue;
      }
      const retry = this.visualKeyRetryTickets.get(current);
      if ((retry !== undefined && this.isVisualKeyRetryCurrent(retry))
        || this.isVisualKeyTerminalFailureCurrent(current, port)) continue;
      this.requestVisualKey(current, port);
    }
    if (desired.size === 0) this.render();
  }

  private requestVisualKey(key: string, port: ManifestCocosAssetPort | undefined): void {
    const requestedGeneration = this.visualIntentGenerations.get(key)!;
    if (port === undefined) {
      const bootstrapFailure = this.lastVisualBootstrapFailure;
      this.showVisualFallback({
        key,
        loadedRevision: bootstrapFailure?.loadedRevision ?? 'unavailable',
        bundle: bootstrapFailure?.bundle ?? RESOURCES_BUNDLE_NAME,
        resourcePath: bootstrapFailure?.resourcePath ?? 'unresolved',
        group: bootstrapFailure?.group ?? `@asset:${key}`,
        requestedGeneration,
        stage: bootstrapFailure?.stage ?? 'resources-bundle',
        code: bootstrapFailure?.code ?? 'cancelled',
      }, false);
      return;
    }

    const described = port.describeKey(key);
    if (described === undefined) {
      this.markVisualKeyTerminalFailure(
        key,
        port,
        this.assetGeneration,
        'unknown-key',
      );
      this.showVisualFallback({
        key,
        loadedRevision: port.manifestRevision,
        bundle: RESOURCES_BUNDLE_NAME,
        resourcePath: 'unknown',
        group: `@asset:${key}`,
        requestedGeneration,
        stage: 'image-load',
        code: 'unknown-key',
      });
      return;
    }
    const record: VisualAssetRecord = {
      key,
      resourcePath: described.resourcePath,
      syntheticGroup: described.syntheticGroup,
      port,
      assetGeneration: this.assetGeneration,
      requestedGeneration,
      acquired: false,
      settled: Promise.resolve(),
    };
    this.startVisualRecord(record, true);
  }

  private startVisualRecord(
    record: VisualAssetRecord,
    showLoadingFallback: boolean,
  ): void {
    const { key, port } = record;
    const work = port.preloadKey(key).then((result) => {
      if (!result.ok) {
        const shouldShowFallback = this.isVisualRecordDesired(record);
        if (this.visualRecords.get(key) === record) {
          this.visualRecords.delete(key);
        }
        if (shouldShowFallback && this.isVisualIntentCurrent(record)) {
          this.showVisualFallback({
            key,
            loadedRevision: result.revision,
            bundle: RESOURCES_BUNDLE_NAME,
            resourcePath: record.resourcePath,
            group: record.syntheticGroup,
            requestedGeneration: record.requestedGeneration,
            stage: 'image-load',
            code: result.code,
          });
          this.scheduleVisualKeyRetry(
            record,
            result.code,
            result.retryable,
          );
        }
        return;
      }
      record.acquired = true;
      const image = result.value.nativeHandle;
      if (!(image instanceof ImageAsset)) {
        const shouldShowFallback = this.isVisualRecordDesired(record);
        this.releaseVisualRecord(record);
        if (this.visualRecords.get(key) === record) {
          this.visualRecords.delete(key);
        }
        if (shouldShowFallback && this.isVisualIntentCurrent(record)) {
          this.cancelVisualKeyRetry(true, undefined, key);
          this.markVisualKeyTerminalFailure(
            record.key,
            record.port,
            record.assetGeneration,
            'decode',
          );
          this.showVisualFallback({
            key,
            loadedRevision: result.revision,
            bundle: RESOURCES_BUNDLE_NAME,
            resourcePath: record.resourcePath,
            group: record.syntheticGroup,
            requestedGeneration: record.requestedGeneration,
            stage: 'image-load',
            code: 'decode',
          });
        }
        return;
      }
      record.image = image;
      if (!this.isVisualRecordDesired(record)) {
        this.releaseVisualRecord(record);
        if (this.visualRecords.get(key) === record) {
          this.visualRecords.delete(key);
        }
        return;
      }
      const recoveredFromRetry = (this.visualKeyRetryAttempts.get(key) ?? 0) > 0;
      this.cancelVisualKeyRetry(true, undefined, key);
      this.visualKeyTerminalFailures.delete(key);
      if (recoveredFromRetry) {
        this.activityMessage = `视觉资源恢复 · key=${record.key} revision=${record.port.manifestRevision}`;
      }
      this.displayVisualRecord(record);
    }).catch((error) => {
      const shouldShowFallback = this.isVisualRecordDesired(record);
      if (this.visualRecords.get(key) === record) {
        this.visualRecords.delete(key);
      }
      if (!shouldShowFallback || !this.isVisualIntentCurrent(record)) return;
      const classified = classifyCocosAssetError(error);
      this.showVisualFallback({
        key,
        loadedRevision: port.manifestRevision,
        bundle: RESOURCES_BUNDLE_NAME,
        resourcePath: record.resourcePath,
        group: record.syntheticGroup,
        requestedGeneration: record.requestedGeneration,
        stage: 'image-load',
        code: classified.code,
      });
      this.scheduleVisualKeyRetry(
        record,
        classified.code,
        classified.retryable,
      );
    });
    record.settled = work;
    this.visualRecords.set(key, record);
    if (showLoadingFallback) {
      this.showVisualFallback({
        key,
        loadedRevision: port.manifestRevision,
        bundle: RESOURCES_BUNDLE_NAME,
        resourcePath: record.resourcePath,
        group: record.syntheticGroup,
        requestedGeneration: record.requestedGeneration,
        stage: 'image-load',
        code: 'cancelled',
      }, false);
    }
  }

  private isVisualRecordDesired(record: VisualAssetRecord): boolean {
    return this.isVisualIntentCurrent(record)
      && this.visualRecords.get(record.key) === record;
  }

  private isVisualIntentCurrent(record: VisualAssetRecord): boolean {
    return !this.destroyed
      && this.assetGeneration === record.assetGeneration
      && this.assetPort === record.port
      && this.desiredVisualPort === record.port
      && this.visualIntentGenerations.get(record.key) === record.requestedGeneration
      && this.view !== undefined;
  }

  private displayVisualRecord(record: VisualAssetRecord): void {
    const image = record.image;
    const view = this.view;
    if (image === undefined || view === undefined || !this.isVisualRecordDesired(record)) {
      return;
    }
    try {
      const status = {
        key: record.key,
        revision: record.port.manifestRevision,
      };
      if (this.desiredSceneVisualKeys.has(record.key) && !record.sceneDisplayed) {
        view.setSceneVisualAsset(image, status);
        record.sceneDisplayed = true;
      }
      if (record.key === this.desiredVisualKey) view.setVisualAsset(image, status);
      if (!this.isVisualRecordDesired(record) || this.view !== view) {
        view.clearSceneVisualAsset(record.key);
        if (record.key === this.desiredVisualKey) view.clearVisualAsset();
        this.releaseVisualRecord(record);
        if (this.visualRecords.get(record.key) === record) {
          this.visualRecords.delete(record.key);
        }
        return;
      }
      if (record.key === this.desiredVisualKey) this.displayedVisualRecord = record;
      this.render();
    } catch (error) {
      const shouldShowFallback = this.isVisualRecordDesired(record);
      if (this.displayedVisualRecord === record) {
        this.displayedVisualRecord = undefined;
      }
      try {
        view.clearSceneVisualAsset(record.key);
        if (record.key === this.desiredVisualKey) view.clearVisualAsset();
      } catch (cleanupError) {
        recordDisposalFailure('visual-frame', cleanupError, undefined);
      }
      this.releaseVisualRecord(record);
      if (this.visualRecords.get(record.key) === record) {
        this.visualRecords.delete(record.key);
      }
      if (!shouldShowFallback || !this.isVisualIntentCurrent(record)) return;
      const classified = classifyCocosAssetError(error);
      this.markVisualKeyTerminalFailure(
        record.key,
        record.port,
        record.assetGeneration,
        classified.code,
      );
      this.showVisualFallback({
        key: record.key,
        loadedRevision: record.port.manifestRevision,
        bundle: RESOURCES_BUNDLE_NAME,
        resourcePath: record.resourcePath,
        group: record.syntheticGroup,
        requestedGeneration: record.requestedGeneration,
        stage: 'frame-create',
        code: classified.code,
      });
    }
  }

  private clearDisplayedVisual(failures?: DisposalFailure[]): void {
    const displayed = this.displayedVisualRecord;
    this.displayedVisualRecord = undefined;
    try {
      this.view?.clearVisualAsset();
    } catch (error) {
      recordDisposalFailure('visual-frame', error, failures);
    }
    if (displayed !== undefined) {
      try {
        this.view?.clearSceneVisualAsset(displayed.key);
      } catch (error) {
        recordDisposalFailure('visual-frame', error, failures);
      }
      this.releaseVisualRecord(displayed, failures);
      if (this.visualRecords.get(displayed.key) === displayed) {
        this.visualRecords.delete(displayed.key);
      }
    }
  }

  private releaseReadyVisualRecordsExcept(
    desiredKeys: ReadonlySet<string>,
    desiredPort: ManifestCocosAssetPort | undefined,
    failures?: DisposalFailure[],
  ): void {
    for (const [key, record] of this.visualRecords) {
      if (desiredKeys.has(key) && record.port === desiredPort) continue;
      if (!record.acquired) continue;
      try {
        this.view?.clearSceneVisualAsset(key);
      } catch (error) {
        recordDisposalFailure('visual-frame', error, failures);
      }
      this.releaseVisualRecord(record, failures);
      if (this.visualRecords.get(key) === record) this.visualRecords.delete(key);
    }
  }

  private releaseVisualRecord(
    record: VisualAssetRecord,
    failures?: DisposalFailure[],
  ): void {
    if (!record.acquired) return;
    record.acquired = false;
    record.image = undefined;
    record.sceneDisplayed = false;
    try {
      record.port.releaseKey(record.key);
    } catch (error) {
      recordDisposalFailure('visual-lease', error, failures);
    }
  }

  private invalidateVisualAssets(
    restartOnNextRefresh: boolean,
    failures?: DisposalFailure[],
  ): void {
    this.cancelVisualAssetRetry(true, failures);
    this.cancelVisualKeyRetry(true, failures);
    this.visualKeyTerminalFailures.clear();
    this.visualIntentGenerations.clear();
    this.assetGeneration += 1;
    this.visualGeneration += 1;
    const pending: Promise<unknown>[] = [];
    if (this.assetBootstrapPromise !== undefined) {
      pending.push(this.assetBootstrapPromise);
    }
    for (const record of this.visualRecords.values()) {
      pending.push(record.settled);
    }
    try {
      this.view?.clearSceneVisualAsset();
    } catch (error) {
      recordDisposalFailure('visual-frame', error, failures);
    }
    this.clearDisplayedVisual(failures);
    for (const record of this.visualRecords.values()) {
      this.releaseVisualRecord(record, failures);
    }
    this.visualRecords.clear();
    this.releaseSheetFigureLeases();
    this.assetPort = undefined;
    this.desiredVisualPort = undefined;
    this.configBundle = undefined;
    this.resourcesBundle = undefined;
    this.lastVisualBootstrapFailure = undefined;
    const manifest = this.manifestAsset;
    this.manifestAsset = undefined;
    try {
      releaseManifestReference(manifest);
    } catch (error) {
      recordDisposalFailure('visual-manifest', error, failures);
    }
    this.assetBootstrapPromise = undefined;
    this.restartAssetsOnNextRefresh = restartOnNextRefresh;
    this.visualDrainPromise = Promise.allSettled(pending).then(() => undefined);
  }

  private showVisualFallback(
    input: Readonly<{
      key: string;
      loadedRevision: string;
      bundle: string;
      resourcePath: string;
      group: string;
      requestedGeneration: number;
      stage: VisualAssetStage;
      code: AssetErrorCode;
    }>,
    updateActivity = true,
  ): void {
    if (this.destroyed || this.view === undefined) return;
    const diagnostic = [
      `expectedRevision=${EXPECTED_MANIFEST_REVISION}`,
      `loadedRevision=${input.loadedRevision}`,
      `bundle=${input.bundle}`,
      `key=${input.key}`,
      `path=${input.resourcePath}`,
      `group=${input.group}`,
      `requestedGeneration=${input.requestedGeneration}`,
      `appliedGeneration=${this.visualGeneration}`,
      `assetGeneration=${this.assetGeneration}`,
      `stage=${input.stage}`,
      `code=${input.code}`,
    ].join(' ');
    try {
      const status = {
        key: input.key,
        revision: input.loadedRevision,
        diagnostic,
      };
      if (this.desiredSceneVisualKeys.has(input.key)) this.view.setSceneVisualAssetFallback(status);
      if (input.key === this.desiredVisualKey || input.key === '@none') {
        this.view.setVisualAssetFallback(status);
      }
    } catch (error) {
      recordDisposalFailure('visual-frame', error, undefined);
    }
    if (updateActivity) this.activityMessage = `视觉资源回退 · ${diagnostic}`;
    this.render();
  }

  private async bootstrap(generation: number): Promise<void> {
    if (!this.isBootstrapAlive(generation)) return;
    const resolvedWx = resolveWxApi();
    if (!this.isBootstrapAlive(generation)) return;
    if (resolvedWx.status === 'invalid') {
      this.blockWechat(
        generation,
        '微信运行 / 平台能力阻断',
        resolvedWx.message,
      );
      return;
    }
    if (resolvedWx.status === 'ready') {
      const durabilityBoundary = injectedDurabilityBoundary;
      if (durabilityBoundary === undefined) {
        const reportedPlatform = resolveWxReportedPlatform(resolvedWx.api);
        if (reportedPlatform.status !== 'devtools') {
          const platformDetail = reportedPlatform.status === 'other'
            ? `当前 platform=${reportedPlatform.platform}。`
            : '宿主未精确报告 platform=devtools。';
          this.blockWechat(
            generation,
            '微信运行 / 持久性未签核',
            `${platformDetail} 未显式注入 WxDurabilityBoundary。请在场景加载前调用 configureInfiniteFlowWxDurabilityBoundary；不会以 wx 同步读回冒充真实设备持久性。`,
          );
          return;
        }
        const safeArea = resolveWxSafeInsets(resolvedWx.api);
        if (!this.isBootstrapAlive(generation)) return;
        if (safeArea.status === 'invalid') {
          this.blockWechatDevtools(
            generation,
            '微信开发者工具 · NON_RELEASE / safe-area 阻断',
            safeArea.message,
          );
          return;
        }
        this.safeInsets = safeArea.insets;
        await this.bootstrapWechatDevtools(generation, resolvedWx.api);
        return;
      }
      const safeArea = resolveWxSafeInsets(resolvedWx.api);
      if (!this.isBootstrapAlive(generation)) return;
      if (safeArea.status === 'invalid') {
        this.blockWechat(
          generation,
          '微信运行 / safe-area 阻断',
          safeArea.message,
        );
        return;
      }
      this.safeInsets = safeArea.insets;
      await this.bootstrapWechat(
        generation,
        resolvedWx.api,
        durabilityBoundary,
      );
      return;
    }
    await this.bootstrapPreview(generation);
  }

  private async bootstrapPreview(generation: number): Promise<void> {
    if (!this.isBootstrapAlive(generation)) return;
    this.runtimeMode = PREVIEW_MODE;
    this.safeInsets = INFINITE_FLOW_PREVIEW_SAFE_INSETS;
    this.activityMessage = '建立确定性开发预览';
    this.render();
    let localClient: InfiniteFlowClient | undefined;
    try {
      localClient = await createInfiniteFlowClient({
        storage: new InMemoryStoragePort(),
        seedPort: new SequenceSeedPort(createPreviewSeeds()),
        hashPort: new PortableSha256HashPort(),
      });
      if (!this.isBootstrapAlive(generation)) {
        disposeClientSafely(localClient);
        return;
      }
      this.client = localClient;
      localClient = undefined;
      this.activityMessage = '开发预览就绪 · 数据不会离开内存';
      this.refreshViewModel();
    } catch (error) {
      disposeClientSafely(localClient);
      if (!this.isBootstrapAlive(generation)) return;
      disposeClientSafely(this.client);
      this.client = undefined;
      this.runtimeMode = {
        kind: 'blocked',
        label: '开发预览 / 初始化失败',
        detail: '内存存档未建立',
      };
      this.blockingMessage = errorMessage(error);
      this.activityMessage = '初始化失败';
      this.render();
    }
  }

  private async bootstrapWechatDevtools(
    generation: number,
    wxApi: InjectableWxPlatformApi,
  ): Promise<void> {
    if (!this.isBootstrapAlive(generation)) return;
    this.runtimeMode = wxDevtoolsNonReleaseMode(this.safeInsets);
    this.activityMessage = '建立微信开发者工具 NON_RELEASE 内存运行时';
    this.render();
    let ports: ReturnType<typeof createWxPlatformPorts> | undefined;
    let localClient: InfiniteFlowClient | undefined;
    let stage: WxDevtoolsBootStage = 'platform-ports';
    try {
      ports = createWxPlatformPorts(wxApi, {
        lifecycle: {
          onListenerError: (phase) => {
            if (!this.isBootstrapAlive(generation)) return;
            this.runtimeMode = wxDevtoolsNonReleaseMode(this.safeInsets);
            this.activityMessage = `${phase} 生命周期错误 · NON_RELEASE 内存态`;
            this.render();
          },
        },
      });
      this.pendingSecureSeeds = ports.seeds;
      this.pendingLifecycle = ports.lifecycle;
      if (!this.isBootstrapAlive(generation)) {
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      stage = 'seed-prefill';
      await ports.seeds.prefill();
      if (!this.isBootstrapAlive(generation)) {
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      stage = 'client-create';
      localClient = await createInfiniteFlowClient({
        storage: new InMemoryStoragePort(),
        seedPort: ports.seeds,
        lifecycle: ports.lifecycle,
        hashPort: new PortableSha256HashPort(),
        onLifecycleDiagnostic: (diagnostic) => {
          if (!this.isBootstrapAlive(generation)) return;
          this.runtimeMode = wxDevtoolsNonReleaseMode(this.safeInsets);
          this.blockingMessage = undefined;
          this.activityMessage = diagnostic.error === undefined
            ? `${diagnostic.operation} 完成 · NON_RELEASE 内存态`
            : `${diagnostic.operation} 失败 · NON_RELEASE 内存态`;
          this.refreshViewModel();
        },
        onMemoryWarning: () => {
          if (!this.isBootstrapAlive(generation)) return;
          this.invalidateVisualAssets(true);
          this.runtimeMode = wxDevtoolsNonReleaseMode(this.safeInsets);
          this.activityMessage = '微信开发者工具内存告警：视觉资源已释放；游戏数据仅保留于本次 NON_RELEASE 内存会话';
          this.render();
        },
      });
      if (!this.isBootstrapAlive(generation)) {
        disposeClientSafely(localClient);
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      this.secureSeeds = ports.seeds;
      this.lifecycle = ports.lifecycle;
      this.client = localClient;
      this.pendingSecureSeeds = undefined;
      this.pendingLifecycle = undefined;
      localClient = undefined;
      ports = undefined;
      this.runtimeMode = wxDevtoolsNonReleaseMode(this.safeInsets);
      this.activityMessage = '微信开发者工具 NON_RELEASE 就绪 · 内存存档，关闭或刷新即丢失';
      stage = 'view-model-refresh';
      this.refreshViewModel();
    } catch (error) {
      disposeClientSafely(localClient);
      disposeLifecycleSafely(ports?.lifecycle);
      disposeSeedsSafely(ports?.seeds);
      if (ports?.seeds === this.pendingSecureSeeds) {
        this.pendingSecureSeeds = undefined;
      }
      if (ports?.lifecycle === this.pendingLifecycle) {
        this.pendingLifecycle = undefined;
      }
      if (!this.isBootstrapAlive(generation)) return;
      disposeClientSafely(this.client);
      this.client = undefined;
      disposeLifecycleSafely(this.lifecycle);
      this.lifecycle = undefined;
      disposeSeedsSafely(this.secureSeeds);
      this.secureSeeds = undefined;
      const diagnosticCode = `${WX_DEVTOOLS_BOOT_DIAGNOSTIC_PREFIX}:${stage}`;
      console.error(
        `[InfiniteFlowApp] ${diagnosticCode} NON_RELEASE bootstrap failed`,
        sanitizeWxDevtoolsBootError(error),
      );
      this.blockWechatDevtools(
        generation,
        '微信开发者工具 · NON_RELEASE / 初始化阻断',
        `安全随机池、内存存档或生命周期初始化失败（阶段 ${stage} · ${diagnosticCode}）：${errorMessage(error)}`,
      );
    }
  }

  private async bootstrapWechat(
    generation: number,
    wxApi: InjectableWxPlatformApi,
    durabilityBoundary: WxDurabilityBoundary,
  ): Promise<void> {
    if (!this.isBootstrapAlive(generation)) return;
    this.runtimeMode = {
      kind: 'wx',
      label: '微信运行 / 已注入持久边界',
      detail: `边界 ${durabilityBoundary.attestationId}；safe top ${Math.ceil(this.safeInsets.top)} / bottom ${Math.ceil(this.safeInsets.bottom)}`,
    };
    this.activityMessage = '预填充微信安全随机池';
    this.render();
    let ports: ReturnType<typeof createWxPlatformPorts> | undefined;
    let localClient: InfiniteFlowClient | undefined;
    try {
      ports = createWxPlatformPorts(wxApi, {
        storage: { durabilityBoundary },
        lifecycle: {
          onListenerError: (phase, error) => {
            if (!this.isBootstrapAlive(generation)) return;
            this.activityMessage = `${phase} 生命周期错误：${errorMessage(error)}`;
            this.render();
          },
        },
      });
      this.pendingSecureSeeds = ports.seeds;
      this.pendingLifecycle = ports.lifecycle;
      if (!this.isBootstrapAlive(generation)) {
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      await ports.seeds.prefill();
      if (!this.isBootstrapAlive(generation)) {
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      localClient = await createInfiniteFlowClient({
        storage: ports.storage,
        seedPort: ports.seeds,
        lifecycle: ports.lifecycle,
        hashPort: new PortableSha256HashPort(),
        onLifecycleDiagnostic: (diagnostic) => {
          if (!this.isBootstrapAlive(generation)) return;
          const resultStatus = diagnostic.result?.status;
          const blockedResult = diagnostic.result?.status === 'blocked'
            ? diagnostic.result
            : undefined;
          const failureMessage = diagnostic.error !== undefined
            ? errorMessage(diagnostic.error)
            : blockedResult === undefined
              ? undefined
              : `${blockedResult.error.code}：${blockedResult.error.message}`;
          if (
            diagnostic.operation === 'resume'
            && (failureMessage !== undefined || resultStatus !== 'durable')
          ) {
            this.runtimeMode = {
              kind: 'blocked',
              label: '微信运行 / 恢复阻断',
              detail: failureMessage ?? `resume：${resultStatus ?? '无结果'}`,
            };
            this.blockingMessage = this.runtimeMode.detail;
          } else if (
            diagnostic.operation === 'resume'
            && resultStatus === 'durable'
          ) {
            this.runtimeMode = {
              kind: 'wx',
              label: '微信运行 / 已注入持久边界',
              detail: `边界 ${durabilityBoundary.attestationId}；resume 已跨越持久边界`,
            };
            this.blockingMessage = undefined;
          }
          this.activityMessage = failureMessage === undefined
            ? `${diagnostic.operation}：${resultStatus ?? '完成'}`
            : `${diagnostic.operation}：${failureMessage}`;
          this.refreshViewModel();
        },
        onMemoryWarning: () => {
          if (!this.isBootstrapAlive(generation)) return;
          this.invalidateVisualAssets(true);
          this.activityMessage = '微信内存告警：视觉资源已失效并释放；下次状态刷新受控重载，领域状态仍由 client 管理';
          this.render();
        },
      });
      if (!this.isBootstrapAlive(generation)) {
        disposeClientSafely(localClient);
        disposeLifecycleSafely(ports.lifecycle);
        disposeSeedsSafely(ports.seeds);
        return;
      }
      this.secureSeeds = ports.seeds;
      this.lifecycle = ports.lifecycle;
      this.client = localClient;
      this.pendingSecureSeeds = undefined;
      this.pendingLifecycle = undefined;
      localClient = undefined;
      ports = undefined;
      this.activityMessage = `微信运行时就绪 · 边界 ${durabilityBoundary.attestationId} 已配置`;
      this.refreshViewModel();
    } catch (error) {
      disposeClientSafely(localClient);
      disposeLifecycleSafely(ports?.lifecycle);
      disposeSeedsSafely(ports?.seeds);
      if (ports?.seeds === this.pendingSecureSeeds) {
        this.pendingSecureSeeds = undefined;
      }
      if (ports?.lifecycle === this.pendingLifecycle) {
        this.pendingLifecycle = undefined;
      }
      if (!this.isBootstrapAlive(generation)) return;
      disposeClientSafely(this.client);
      this.client = undefined;
      disposeLifecycleSafely(this.lifecycle);
      this.lifecycle = undefined;
      disposeSeedsSafely(this.secureSeeds);
      this.secureSeeds = undefined;
      this.blockWechat(
        generation,
        '微信运行 / 初始化阻断',
        `安全随机池、存档读取或持久边界验证失败：${errorMessage(error)}`,
      );
    }
  }

  private blockWechat(
    generation: number,
    label: string,
    message: string,
  ): void {
    if (!this.isBootstrapAlive(generation)) return;
    this.runtimeMode = {
      kind: 'blocked',
      label,
      detail: '未建立可写运行时；没有降级或伪签核',
    };
    this.blockingMessage = message;
    this.activityMessage = '运行已阻断';
    this.viewModel = undefined;
    this.requestVisualAsset(undefined);
    this.render();
  }

  private blockWechatDevtools(
    generation: number,
    label: string,
    message: string,
  ): void {
    if (!this.isBootstrapAlive(generation)) return;
    this.runtimeMode = {
      kind: 'blocked',
      label,
      detail: 'NON_RELEASE 内存运行时未建立；关闭或刷新即丢失',
      nonReleaseEphemeral: true,
    };
    this.blockingMessage = message;
    this.activityMessage = '微信开发者工具 NON_RELEASE 运行已阻断';
    this.viewModel = undefined;
    this.requestVisualAsset(undefined);
    this.render();
  }

  private activate(
    physicalId: string,
    actionId: string,
    event: PresentationEvent,
  ): void {
    if (this.client === undefined || this.busyActionId !== undefined) return;
    if (event.kind === 'local') {
      if (event.action.type === 'entry/request-enter') {
        if (!hasLegalRouteContract(event.action.draft)) {
          this.activityMessage = '本地输入拒绝：路线契约不属于入场副本';
          this.refreshViewModel();
          return;
        }
        void this.enterRun(physicalId, actionId, event.action.draft);
      } else if (event.action.type === 'entry/select-relic-seed') {
        void this.dispatchCommand(
          physicalId,
          actionId,
          {
            type: 'hub/configure-relic',
            frame: event.action.frame,
            ...(event.action.seedRelicId === null
              ? {}
              : { seedRelicId: event.action.seedRelicId }),
          },
          false,
        );
      } else {
        this.applyLocalAction(event.action);
      }
      return;
    }
    void this.dispatchCommand(physicalId, actionId, event.command);
  }

  private applyLocalAction(action: PresentationLocalAction): void {
    if (action.type === 'help/open') {
      this.localUiState = localStateWith(this.localUiState, {
        activeHelpId: action.helpId,
      });
    } else if (action.type === 'help/close') {
      this.localUiState = localStateWith(this.localUiState, {
        activeHelpId: null,
      });
    } else if (action.type === 'combat/set-advanced-expanded') {
      this.localUiState = localStateWith(this.localUiState, {
        advancedCombatExpanded: action.expanded,
      });
    } else if (action.type === 'hub/select-panel') {
      this.localUiState = localStateWith(this.localUiState, {
        hubPanel: action.panel,
      });
    } else if (action.type === 'hub/select-catalog-entry') {
      this.localUiState = localStateWith(this.localUiState, {
        hubSelections: {
          ...(this.localUiState.hubSelections ?? {}),
          [action.panel]: action.entityId,
        },
      });
    } else if (action.type === 'hub/set-equipment-commission-draft') {
      this.localUiState = localStateWith(this.localUiState, {
        equipmentCommissionDraft: action.draft,
      });
    } else if (action.type === 'entry/select-dungeon') {
      const draft = this.currentEntryDraft();
      this.localUiState = localStateWith(this.localUiState, {
        entryDraft: {
          dungeonId: action.dungeonId,
          protocolId: draft.protocolId,
          ...(draft.protocolId === 'deep'
            ? { infernoTier: draft.infernoTier ?? 1 }
            : {}),
        },
      });
    } else if (action.type === 'entry/select-protocol') {
      const draft = this.currentEntryDraft();
      const routeContractId = legalRouteContractId(draft);
      this.localUiState = localStateWith(this.localUiState, {
        entryDraft: {
          dungeonId: draft.dungeonId,
          protocolId: action.protocolId,
          ...(action.protocolId === 'deep'
            ? { infernoTier: draft.infernoTier ?? 1 }
            : {}),
          ...(routeContractId === undefined ? {} : { routeContractId }),
        },
      });
    } else if (action.type === 'entry/set-inferno-tier') {
      const draft = this.currentEntryDraft();
      const routeContractId = legalRouteContractId(draft);
      this.localUiState = localStateWith(this.localUiState, {
        entryDraft: {
          dungeonId: draft.dungeonId,
          protocolId: draft.protocolId,
          infernoTier: action.infernoTier,
          ...(routeContractId === undefined ? {} : { routeContractId }),
        },
      });
    } else if (action.type === 'entry/select-route-contract') {
      const draft = this.currentEntryDraft();
      if (
        action.routeContractId !== null
        && getRouteContractById(action.routeContractId, draft.dungeonId) === undefined
      ) {
        this.activityMessage = '本地输入拒绝：路线契约不属于当前副本';
        this.refreshViewModel();
        return;
      }
      this.localUiState = localStateWith(this.localUiState, {
        entryDraft: {
          dungeonId: draft.dungeonId,
          protocolId: draft.protocolId,
          ...(draft.infernoTier === undefined
            ? {}
            : { infernoTier: draft.infernoTier }),
          ...(action.routeContractId === null
            ? {}
            : { routeContractId: action.routeContractId }),
        },
      });
    }
    if (
      action.type === 'entry/select-dungeon'
      || action.type === 'entry/select-protocol'
      || action.type === 'entry/set-inferno-tier'
      || action.type === 'entry/select-route-contract'
      || action.type === 'hub/select-panel'
      || action.type === 'hub/select-catalog-entry'
      || action.type === 'hub/set-equipment-commission-draft'
      || action.type === 'combat/set-advanced-expanded'
    ) {
      this.view?.focusPrimaryActions();
    }
    this.activityMessage = `本地界面：${action.type}`;
    this.refreshViewModel();
  }

  private currentEntryDraft(): EntryProtocolDraft {
    const detail = this.viewModel?.sections[1].detail;
    if (detail?.kind === 'hub') return detail.entryDraft;
    const draft = this.localUiState.entryDraft;
    if (draft !== undefined) return draft;
    throw new Error('Entry draft is unavailable outside the hub view model');
  }

  private async enterRun(
    physicalId: string,
    actionId: string,
    draft: EntryProtocolDraft,
  ): Promise<void> {
    const generation = this.bootstrapGeneration;
    const client = this.client;
    if (client === undefined || this.busyActionId !== undefined) return;
    this.beginAction(actionId);
    try {
      const seeds = this.secureSeeds;
      if (seeds !== undefined) {
        await seeds.prefill(4);
        if (!this.isActionAlive(generation, client)) return;
      }
      if (!this.isActionAlive(generation, client)) return;
      const result = await client.enterRunPhysical(physicalId, actionId, draft);
      if (!this.isActionAlive(generation, client)) return;
      this.finishDispatch(actionId, result);
      await this.refillSecureSeeds(generation);
    } catch (error) {
      if (!this.isActionAlive(generation, client)) return;
      this.failAction(actionId, error);
    }
  }

  private async dispatchCommand(
    physicalId: string,
    actionId: string,
    command: Extract<PresentationEvent, { kind: 'command' }>['command'],
    refillSeeds = true,
  ): Promise<void> {
    const generation = this.bootstrapGeneration;
    const client = this.client;
    if (client === undefined || this.busyActionId !== undefined) return;
    this.beginAction(actionId);
    try {
      const result = await client.dispatchPhysical(physicalId, actionId, command);
      if (!this.isActionAlive(generation, client)) return;
      if (
        (
          command.type === 'hub/start-equipment-commission'
          || command.type === 'hub/recall-equipment-commission'
        )
        && (result.status === 'committed' || result.status === 'duplicate')
      ) {
        this.localUiState = localStateWith(this.localUiState, {
          equipmentCommissionDraft: null,
        });
      }
      this.finishDispatch(actionId, result);
      if (refillSeeds) await this.refillSecureSeeds(generation);
    } catch (error) {
      if (!this.isActionAlive(generation, client)) return;
      this.failAction(actionId, error);
    }
  }

  private beginAction(actionId: string): void {
    this.busyActionId = actionId;
    this.activityMessage = `提交 ${actionId}`;
    this.render();
  }

  private finishDispatch(
    actionId: string,
    result: InfiniteFlowDispatchResult,
  ): void {
    this.busyActionId = undefined;
    this.view?.focusPrimaryActions();
    if (result.status === 'persistence-blocked') {
      this.runtimeMode = {
        kind: 'blocked',
        label: '微信运行 / 持久写入阻断',
        detail: `${result.error.code}：${result.error.message}`,
      };
      this.blockingMessage = `${result.error.code}：${result.error.message}`;
      this.activityMessage = `写入阻断 ${actionId}`;
    } else if (result.status === 'committed') {
      this.activityMessage = `已提交 ${actionId} · revision ${result.stateRevision}`;
    } else if (result.status === 'duplicate') {
      this.activityMessage = `物理输入去重 ${actionId} · revision ${result.stateRevision}`;
    } else if (result.status === 'rejected') {
      this.activityMessage = `规则拒绝 ${actionId} · 状态未改变`;
    } else {
      this.activityMessage = `输入无效 ${actionId}`;
    }
    this.refreshViewModel();
  }

  private failAction(actionId: string, error: unknown): void {
    this.busyActionId = undefined;
    this.activityMessage = `${actionId} 失败：${errorMessage(error)}`;
    this.refreshViewModel();
  }

  private async refillSecureSeeds(generation: number): Promise<void> {
    if (!this.isBootstrapAlive(generation)) return;
    const seeds = this.secureSeeds;
    if (seeds === undefined) return;
    try {
      await seeds.prefill();
      if (!this.isBootstrapAlive(generation) || this.secureSeeds !== seeds) return;
    } catch (error) {
      if (!this.isBootstrapAlive(generation) || this.secureSeeds !== seeds) return;
      this.activityMessage = `安全随机池补充失败：${errorMessage(error)}`;
      this.render();
    }
  }

  private refreshViewModel(): void {
    const client = this.client;
    if (client === undefined || this.destroyed) {
      this.render();
      return;
    }
    // This is the only domain-state read: it is passed straight into presentation.
    this.viewModel = buildGameViewModel(
      client.getState(),
      this.localUiState,
    ) as GameViewModel;
    this.primeSheetFigures();
    const sceneVisualKeys = getInfiniteFlowSceneVisualKeys(this.viewModel);
    this.requestVisualAsset(
      this.viewModel.visualAssetKey,
      Object.values(sceneVisualKeys),
    );
    if (this.restartAssetsOnNextRefresh) {
      this.restartAssetsOnNextRefresh = false;
      this.startVisualAssetBootstrap();
    }
    this.render();
  }

  private render(): void {
    if (this.destroyed) return;
    this.view?.render(this.viewModel, {
      modeKind: this.runtimeMode.kind,
      modeLabel: this.runtimeMode.label,
      modeDetail: this.runtimeMode.detail,
      activityMessage: this.activityMessage,
      supplyActions: () => this.projectSupplyActions(),
      ...(this.blockingMessage === undefined
        ? {}
        : { blockingMessage: this.blockingMessage }),
      ...(this.busyActionId === undefined
        ? {}
        : { busyActionId: this.busyActionId }),
    }, this.safeInsets);
  }

  // Carry-toggle actions are projected into the actions section only while the
  // hub supplies panel is active. The bag tooltip can be opened from any hub
  // panel, so re-project the supplies view on demand and surface the same
  // real command actions (the UI never forges a ViewActionModel).
  private projectSupplyActions(): readonly ViewActionModel[] {
    const client = this.client;
    if (client === undefined || this.viewModel?.phase !== 'hub') return [];
    const supplies = buildGameViewModel(
      client.getState(),
      localStateWith(this.localUiState, { hubPanel: 'supplies' }),
    );
    return supplies.sections[2].actions;
  }

  /**
   * One-shot, generation-guarded best-effort preload of the 17 pinned sheet
   * figure keys (character portrait + the 7 equipped ids + the 9 tactical
   * items). Acquires leases through the same manifest port as scene visuals;
   * failures stay on the glyph fallback and are retried on the next asset
   * generation. Re-renders once when frames settle.
   */
  private primeSheetFigures(): void {
    const loadout = this.viewModel?.sections[1].loadout;
    const port = this.assetPort;
    if (loadout === undefined || port === undefined) return;
    const keys = [
      SHEET_PORTRAIT_KEY,
      ...loadout.equipment.map((entry) => sheetEquipmentKey(entry.equipmentId)),
      ...loadout.items.map((entry) => sheetItemKey(entry.itemId)),
    ];
    const generation = this.assetGeneration;
    const pending = keys
      .filter((key) => !this.sheetFigureLeases.has(key) && !this.sheetFigureAttempted.has(key));
    if (pending.length === 0) return;
    for (const key of pending) this.sheetFigureAttempted.add(key);
    const settle = Promise.allSettled(pending.map(async (key) => {
      const result = await port.preloadKey(key);
      if (!result.ok) return undefined;
      const image = result.value.nativeHandle;
      if (!(image instanceof ImageAsset)) return undefined;
      const frame = SpriteFrame.createWithImage(image);
      if (frame.texture === null) {
        frame.destroy();
        port.releaseKey(key);
        return undefined;
      }
      return [key, image, frame] as const;
    })).then((outcomes) => {
      if (this.destroyed || this.assetGeneration !== generation) {
        for (const outcome of outcomes) {
          if (outcome.status === 'fulfilled' && outcome.value) {
            const [key, , frame] = outcome.value;
            frame.destroy();
            port.releaseKey(key);
          }
        }
        return;
      }
      let acquired = 0;
      for (const outcome of outcomes) {
        if (outcome.status !== 'fulfilled' || !outcome.value) continue;
        const [key, image, frame] = outcome.value;
        this.sheetFigureLeases.set(key, { frame, image });
        acquired += 1;
      }
      if (acquired > 0) this.publishSheetFigures();
    });
  }

  private publishSheetFigures(): void {
    const library = new Map<string, SheetImage>();
    for (const [key, { frame, image }] of this.sheetFigureLeases) {
      library.set(key, { frame, width: image.width, height: image.height });
    }
    const sheetImages: SheetImageLibrary = Object.freeze({
      get(key: string): SheetImage | undefined {
        return library.get(key);
      },
    });
    registerSheetFigures(sheetImages);
    this.render();
  }

  private releaseSheetFigureLeases(): void {
    releaseSheetFigures();
    for (const [key, { frame }] of this.sheetFigureLeases) {
      try {
        frame.destroy();
        this.assetPort?.releaseKey(key);
      } catch (error) {
        recordDisposalFailure('visual-lease', error, undefined);
      }
    }
    this.sheetFigureLeases.clear();
    this.sheetFigureAttempted.clear();
  }
}
