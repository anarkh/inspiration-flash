import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';
import { createInitialState, DUNGEON_ORDER, DUNGEONS, getDerivedStats, MONSTERS } from '@infinite-flow/core';
import { RUN_RELIC_DEFINITIONS, RUN_RELIC_IDS_BY_FRAME } from '@infinite-flow/core/run-relics';
import { reduceGameCommand } from '@infinite-flow/application';
import { buildGameViewModel as buildActualGameViewModel } from '@infinite-flow/presentation';

const HERO_WALK_LAYOUT = JSON.parse(await readFile(new URL('../../art-source/hero-redesign/proof/production-frame-layout.json', import.meta.url), 'utf8'));

const TEST_CONTROL_KEY = '__INFINITE_FLOW_BOOTSTRAP_RACE_CONTROL__';
const MANIFEST_UUID = '3d0842ec-43f7-4b5f-961f-39edb535ccd7';
const MANIFEST_REVISION = 'sha256:3d2a276a8cf63784d4d67f490a5e33f66304af2267cd13eae938abe026f370df';
const RUN_RELIC_FIXTURES = Object.keys(RUN_RELIC_DEFINITIONS).map(id => ({
  key: `item:run_relic_${id}`, kind: 'item', entityId: `run_relic_${id}`, resourcePath: `run-relic/${id}-v1`,
}));
const DUNGEON_PROP_FIXTURES = ['chest', 'exit', 'event', 'trap', 'survey', 'relic', 'shrine', 'law', 'debris'].map(id => ({
  key: `scene:dungeon_prop_${id}`, kind: 'scene', entityId: `dungeon_prop_${id}`, resourcePath: `dungeon-world/${id}-v1`,
}));
const HUB_PORTAL_FIXTURE = { key: 'scene:hub_dungeon_portal', kind: 'scene', entityId: 'hub_dungeon_portal', resourcePath: 'hub-courtyard/wanxiang-scroll-portal-v1' };
const COURTYARD_WORLD_FIXTURES = [
  { key: 'scene:hub_courtyard_walk', kind: 'scene', entityId: 'hub_courtyard_walk', resourcePath: 'hub-courtyard/walk-sanctuary-v1' },
  HUB_PORTAL_FIXTURE,
  ...['pillar', 'crate', 'altar', 'lamp'].map((id) => ({
    key: `scene:courtyard_${id}`, kind: 'scene', entityId: `courtyard_${id}`, resourcePath: `hub-courtyard/${id}-v1`,
  })),
];
const NPC_WORLD_FIXTURES = [
  ['equipment', 'equipment_quartermaster'], ['supplies', 'supply_trader'],
  ['pets', 'pet_keeper'], ['methods', 'method_master'],
  ['bloodlines', 'bloodline_priest'], ['companions', 'companion_guide'],
  ['tasks', 'main_god_projection'],
].map(([panel, id]) => ({ panel, key: `npc:${id}_world`, kind: 'npc', entityId: `${id}_world`, resourcePath: `npc/${id}-world-v1` }));
const COURTYARD_NPC_SIZES = {
  equipment: [190, 7], supplies: [180, 5], pets: [184, 5], methods: [190, 3],
  bloodlines: [187, 6], companions: [188, 7], tasks: [194, 6],
};
const MONSTER_WORLD_FIXTURES = Object.keys(MONSTERS).map((id) => ({
  id, key: `monster:${id}_world`, kind: 'monster', entityId: `${id}_world`,
  resourcePath: `monster-world/${id.replaceAll('_', '-')}-world-v1`,
}));

function validManifest() {
  const assets = [
    { key: 'scene:main_god_space', kind: 'scene', entityId: 'main_god_space', resourcePath: 'scene/main-god-space' },
    { key: 'dungeon:demon_tower_1', kind: 'dungeon', entityId: 'demon_tower_1', resourcePath: 'dungeon/demon-tower-1-v1' },
    { key: 'monster:fog_lesser_demon', kind: 'monster', entityId: 'fog_lesser_demon', resourcePath: 'monster/fog-lesser-demon-v1' },
    { key: 'character:reincarnator', kind: 'character', entityId: 'reincarnator', resourcePath: 'character/reincarnator-v2' },
    { key: 'character:reincarnator_walk', kind: 'character', entityId: 'reincarnator_walk', resourcePath: 'character/reincarnator-walk-v2' },
    { key: 'npc:equipment_quartermaster', kind: 'npc', entityId: 'equipment_quartermaster', resourcePath: 'npc/equipment-quartermaster-v1' },
    ...COURTYARD_WORLD_FIXTURES,
    ...DUNGEON_PROP_FIXTURES,
    { key: 'scene:dungeon_transition_gate', kind: 'scene', entityId: 'dungeon_transition_gate', resourcePath: 'dungeon-world/ruined-stone-gate-v1' },
    ...NPC_WORLD_FIXTURES,
    ...MONSTER_WORLD_FIXTURES,
    ...RUN_RELIC_FIXTURES,
    ...DUNGEON_ORDER.map((dungeonId) => ({
      key: `scene:dungeon_world_${dungeonId}`,
      kind: 'scene',
      entityId: `dungeon_world_${dungeonId}`,
      resourcePath: `dungeon-world/${dungeonId}-v1`,
    })),
  ];
  for (let index = assets.length; index < 314; index += 1) {
    assets.push({
      key: `item:fixture_${index}`,
      kind: 'item',
      entityId: `fixture_${index}`,
      resourcePath: `item/fixture-${index}`,
    });
  }
  return {
    schemaVersion: 2,
    manifestRevision: MANIFEST_REVISION,
    assetCount: 314,
    assets,
  };
}

function assetSession(options = {}) {
  return {
    autoConfig: options.autoConfig ?? true,
    autoManifest: options.autoManifest ?? true,
    autoResources: options.autoResources ?? true,
    autoImages: options.autoImages ?? true,
    autoSceneImages: options.autoSceneImages ?? true,
    manifest: options.manifest ?? validManifest(),
    manifestUuid: options.manifestUuid ?? MANIFEST_UUID,
    imageFailure: options.imageFailure,
    imageFailuresByPath: options.imageFailuresByPath,
    imageFailures: options.imageFailures === undefined
      ? undefined
      : [...options.imageFailures],
    bundleFailure: options.bundleFailure,
    sharedImageConsumer: options.sharedImageConsumer ?? false,
    configRequests: [],
    manifestRequests: [],
    resourcesRequests: [],
    imageRequests: [],
    sceneImageRequests: [],
    activeImageRequests: 0,
    maxActiveImageRequests: 0,
    imageReferenceCalls: [],
    sceneImageReferenceCalls: [],
    releaseCalls: [],
    events: [],
  };
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolveValue, rejectValue) => {
    resolvePromise = resolveValue;
    rejectPromise = rejectValue;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function fakeClient(label) {
  return {
    label,
    state: { phase: 'hub', visualAssetKey: 'scene:main_god_space' },
    disposeCalls: 0,
    getStateCalls: 0,
    enterRunPhysicalCalls: [],
    dispatchPhysicalCalls: [],
    enterRunResults: [],
    dispatchResults: [],
    dispose() {
      this.disposeCalls += 1;
    },
    getState() {
      this.getStateCalls += 1;
      return this.state;
    },
    enterRunPhysical(physicalId, actionId, draft) {
      this.enterRunPhysicalCalls.push({ physicalId, actionId, draft });
      const result = this.enterRunResults.shift();
      assert.ok(result, 'unexpected enterRunPhysical call');
      return result;
    },
    dispatchPhysical(physicalId, actionId, command) {
      this.dispatchPhysicalCalls.push({ physicalId, actionId, command });
      const result = this.dispatchResults.shift();
      assert.ok(result, 'unexpected dispatchPhysical call');
      return result;
    },
    retryPersistenceCalls: 0,
    retryPersistenceResults: [],
    retryPendingPersistence() {
      this.retryPersistenceCalls += 1;
      const result = this.retryPersistenceResults.shift();
      assert.ok(result, 'unexpected retryPendingPersistence call');
      return result;
    },
  };
}

function fakePorts(prefillPromise = Promise.resolve()) {
  return {
    storage: {},
    seeds: {
      clearCalls: 0,
      disposeCalls: 0,
      disposed: false,
      prefillCalls: 0,
      prefillResults: [prefillPromise],
      prefill() {
        this.prefillCalls += 1;
        return this.prefillResults.shift() ?? Promise.resolve();
      },
      clear() {
        this.clearCalls += 1;
      },
      dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.disposeCalls += 1;
        this.clear();
      },
    },
    lifecycle: {
      disposeCalls: 0,
      disposed: false,
      dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.disposeCalls += 1;
      },
    },
  };
}

function createController() {
  return {
    clientFactories: [],
    portsFactories: [],
    views: [],
    createClientCalls: 0,
    createPortsCalls: 0,
    assetSessions: [],
    currentAssetSession: undefined,
    assetEvents: [],
    sceneAssetEvents: [],
    assetBundleLoadNames: [],
    createClient(options) {
      this.createClientCalls += 1;
      const factory = this.clientFactories.shift();
      assert.ok(factory, 'unexpected createInfiniteFlowClient call');
      return factory(options);
    },
    createPorts(api, options) {
      this.createPortsCalls += 1;
      const factory = this.portsFactories.shift();
      assert.ok(factory, 'unexpected createWxPlatformPorts call');
      return factory(api, options);
    },
    loadAssetBundle(name, callback, engine) {
      const controller = this;
      this.assetBundleLoadNames.push(name);
      if (name === 'config') {
        const session = this.assetSessions.shift() ?? assetSession();
        this.currentAssetSession = session;
        const bundle = {
          name: 'config',
          getInfoWithPath(path, type) {
            if (path !== 'asset-manifest' || type !== engine.JsonAsset) return null;
            return { uuid: session.manifestUuid, path };
          },
          load(path, type, complete) {
            assert.equal(path, 'asset-manifest');
            assert.equal(type, engine.JsonAsset);
            const asset = new engine.JsonAsset(
              session.manifestUuid,
              session.manifest,
            );
            const request = { complete, asset };
            session.manifestRequests.push(request);
            session.events.push('manifest.load');
            if (session.autoManifest) queueMicrotask(() => complete(undefined, asset));
          },
          get() { return null; },
          release(path, type) {
            session.releaseCalls.push({ path, type });
            session.events.push(`config.release:${path}`);
          },
        };
        const request = { callback, bundle };
        session.configRequests.push(request);
        session.events.push('config.loadBundle');
        if (session.autoConfig) queueMicrotask(() => callback(undefined, bundle));
        return;
      }
      assert.equal(name, 'resources');
      const session = this.currentAssetSession;
      assert.ok(session, 'resources bundle requires a config session');
      const bundle = {
        name: 'resources',
        get() { return null; },
        getInfoWithPath() { return null; },
        load(path, type, complete) {
          assert.equal(type, engine.ImageAsset);
          const supplemental = path.startsWith('character/') || path.startsWith('npc/') || path.startsWith('monster-world/') || path.startsWith('hub-courtyard/') || path.startsWith('run-relic/') || path === 'dungeon-world/ruined-stone-gate-v1' || DUNGEON_PROP_FIXTURES.some(asset => asset.resourcePath === path);
          const image = new engine.ImageAsset(path);
          image.onReference = (operation, handle, refCount, destroyed) => {
            (supplemental ? session.sceneImageReferenceCalls : session.imageReferenceCalls).push({
              operation,
              handle,
              path,
              refCount,
              destroyed,
            });
            if (!supplemental) controller.assetEvents.push(`image.${operation}:${path}`);
            controller.sceneAssetEvents.push(`image.${operation}:${path}`);
          };
          if (session.sharedImageConsumer) image.addRef();
          if (!supplemental) session.activeImageRequests += 1;
          if (!supplemental) session.maxActiveImageRequests = Math.max(
            session.maxActiveImageRequests,
            session.activeImageRequests,
          );
          let completed = false;
          const request = {
            path,
            type,
            image,
            complete(error, loadedImage) {
              assert.equal(completed, false, `image request completed twice: ${path}`);
              completed = true;
              if (!supplemental) session.activeImageRequests -= 1;
              complete(error, loadedImage);
            },
          };
          (supplemental ? session.sceneImageRequests : session.imageRequests).push(request);
          session.events.push(`image.load:${path}`);
          if (supplemental ? session.autoSceneImages : session.autoImages) {
            const hasSequencedFailure = !supplemental && session.imageFailures !== undefined
              && session.imageFailures.length > 0;
            const byPath = session.imageFailuresByPath?.[path];
            const imageFailure = byPath !== undefined
              ? byPath.shift()
              : hasSequencedFailure
              ? session.imageFailures.shift()
              : supplemental ? undefined : session.imageFailure;
            queueMicrotask(() => imageFailure !== undefined && imageFailure !== null
              ? request.complete(imageFailure, undefined)
              : request.complete(undefined, image));
          }
        },
        release(path, type) {
          assert.equal(type, engine.ImageAsset);
          session.releaseCalls.push({ path, type });
          session.events.push(`image.release:${path}`);
          controller.assetEvents.push(`image.release:${path}`);
        },
      };
      const request = { callback, bundle };
      session.resourcesRequests.push(request);
      session.events.push('resources.loadBundle');
      if (session.autoResources) {
        queueMicrotask(() => session.bundleFailure
          ? callback(session.bundleFailure, undefined)
          : callback(undefined, bundle));
      }
    },
  };
}

const virtualModules = new Map([
  ['cc', `
    export const _decorator = { ccclass: () => (target) => target };
    export class BlockInputEvents {}
    export class Mask {
      static Type = { GRAPHICS_RECT: 0 };
    }
    export class ScrollView {
      static EventType = { SCROLLING: 'scrolling' };
      getScrollOffset() { return this.offset ?? new Vec2(0, 0); }
      scrollToOffset(offset) { this.offset = new Vec2(offset.x, offset.y); this.node?.emit?.(ScrollView.EventType.SCROLLING); }
    }
    export class Vec2 {
      constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    }
    export class Rect {
      constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; }
    }
    export const Input = { EventType: { KEY_DOWN: 'key-down', KEY_UP: 'key-up' } };
    export class Game { static EVENT_HIDE = 'game-on-hide'; }
    export const input = { on() {}, off() {} };
    export const game = { on() {}, off() {} };
    export const view = { getFrameSize() { return { width: 0, height: 0 }; } };
    export const KeyCode = { KEY_W: 87, KEY_A: 65, KEY_S: 83, KEY_D: 68, KEY_E: 69, SPACE: 32, ESCAPE: 27, ARROW_UP: 38, ARROW_DOWN: 40, ARROW_LEFT: 37, ARROW_RIGHT: 39 };
    export class Color {
      constructor(...channels) { this.channels = channels; }
    }
    export class EventTouch {}
    export class Graphics {}
    export class Label {
      static HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
      static VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2 };
      static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
    }
    export class Node {}
    export class Size {}
    export class Sprite {
      static SizeMode = { CUSTOM: 0, RAW: 1, TRIMMED: 2 };
    }
    export class SpriteFrame {
      static createWithImage(image) {
        const frame = new SpriteFrame();
        frame.texture = { image };
        frame.destroyCalls = 0;
        return frame;
      }
      destroy() { this.destroyCalls += 1; return true; }
    }
    export class UITransform {}
    export class Vec3 {}
    export class Asset {
      constructor(uuid = '') {
        this._uuid = uuid;
        this.uuid = uuid;
        this.refCount = 0;
        this.destroyed = false;
      }
      addRef() {
        if (this.destroyed) throw new Error('cannot retain destroyed asset');
        this.refCount += 1;
        this.onReference?.('addRef', this, this.refCount, this.destroyed);
        return this;
      }
      decRef() {
        if (this.refCount <= 0) throw new Error('asset reference underflow');
        this.refCount -= 1;
        if (this.refCount === 0) this.destroyed = true;
        this.onReference?.('decRef', this, this.refCount, this.destroyed);
        return this;
      }
      destroy() { this.destroyed = true; return true; }
    }
    export class JsonAsset extends Asset {
      constructor(uuid, json) { super(uuid); this.json = json; }
    }
    export class ImageAsset extends Asset {
      constructor(label) { super('image-fixture'); this.label = label; }
    }
    export const assetManager = {
      loadBundle(name, callback) {
        globalThis.${TEST_CONTROL_KEY}.loadAssetBundle(
          name,
          callback,
          { JsonAsset, ImageAsset },
        );
      },
    };
    export const profiler = { hideStats() {}, showStats() {}, isShowingStats() { return false; } };
    export class Component {
      constructor() { this.node = { name: 'headless-root' }; }
    }
  `],
  ['@infinite-flow/client', `
    export function createInfiniteFlowClient(options) {
      return globalThis.${TEST_CONTROL_KEY}.createClient(options);
    }
  `],
  ['@infinite-flow/core/route-contracts', `
    const contracts = new Map([
      ['tower_mist_watch', 'demon_tower_1'],
      ['metro_wraith_return', 'metro_abyss'],
    ]);
    export function getRouteContractById(contractId, dungeonId) {
      return contracts.get(contractId) === dungeonId
        ? { id: contractId, dungeonId }
        : undefined;
    }
  `],
  ['@infinite-flow/presentation', `
    export function buildHubOwnedLoadoutViewModel(state) {
      return (state.phase ?? 'hub') === 'hub' ? state.ownedLoadout ?? { rows: [] } : undefined;
    }
    export function buildGameViewModel(state, localUiState) {
      const actualProjection = globalThis.${TEST_CONTROL_KEY}.actualProjection;
      if (actualProjection) return actualProjection(state, localUiState);
      const entryDraft = localUiState.entryDraft ?? {
        dungeonId: 'demon_tower_1',
        protocolId: 'standard',
      };
      return {
        state,
        localUiState,
        phase: state.phase ?? 'hub',
        visualAssetKey: state.visualAssetKey,
        tasks: [],
        sections: [{}, { detail: state.detail ?? { kind: 'hub', entryDraft },
          ...(state.loadout === undefined ? {} : { loadout: state.loadout }) }],
      };
    }
  `],
  ['@infinite-flow/runtime', `
    export class InMemoryStoragePort {}
    export class PortableSha256HashPort {}
    export class SequenceSeedPort { constructor(values) { this.values = values; } }
  `],
  ['./platform/index', `
    export function isCocosCallbackSuccess(error) {
      return error === null || error === undefined;
    }
    export function classifyCocosAssetError(error) {
      const retryable = new Set(['offline', 'timeout', 'quota', 'cancelled']);
      if (error && typeof error === 'object' && typeof error.code === 'string') {
        const known = new Set(['unknown-key', 'revision-mismatch', 'offline', 'timeout', 'integrity', 'decode', 'quota', 'unsupported', 'cancelled']);
        if (known.has(error.code)) return { code: error.code, retryable: retryable.has(error.code) };
      }
      const text = [error?.code, error?.name, error?.message]
        .filter((part) => typeof part === 'string')
        .join(' ')
        .toLowerCase()
        .replace(/[_-]+/g, ' ');
      if (/timeout|timed[\\s_-]*out|\\betimedout\\b/.test(text)) return { code: 'timeout', retryable: true };
      if (/offline|network|internet|disconnected|connection\\s*(?:failed|refused|reset)|\\beconn\\w*\\b|\\bdns\\b|\\benotfound\\b/.test(text)) return { code: 'offline', retryable: true };
      if (/missing|not\\s*found|\\benoent\\b|no\\s*such\\s*file|does\\s*not\\s*exist|path\\s*(?:missing|unavailable|absent)/.test(text)) return { code: 'unknown-key', retryable: false };
      if (/parse|decode|invalid|malformed|syntax|json/.test(text)) return { code: 'decode', retryable: false };
      if (/\\bpath\\s*error\\b/.test(text)) return { code: 'unknown-key', retryable: false };
      return { code: 'decode', retryable: false };
    }
    export class CocosResourcesLoader {
      constructor(resources, assetType) { this.resources = resources; this.assetType = assetType; }
      load(path) {
        return new Promise((resolve, reject) => {
          this.resources.load(path, this.assetType, (error, asset) => {
            if (!isCocosCallbackSuccess(error)) reject(error);
            else if (asset == null) reject(new Error('missing asset'));
            else resolve(asset);
          });
        });
      }
      release(asset) { this.resources.release(asset); }
      peek() { return null; }
    }
    export class ManifestCocosAssetPort {
      constructor(options) {
        this.options = options;
        this.manifestRevision = options.manifest.manifestRevision;
        this.assets = new Map(options.manifest.assets.map((asset) => [asset.key, asset]));
        this.inFlight = new Map();
        this.cache = new Map();
        this.refs = new Map();
      }
      describeKey(key) {
        const asset = this.assets.get(key);
        return asset && { resourcePath: asset.resourcePath, syntheticGroup: '@asset:' + key };
      }
      async preloadKey(key) {
        const asset = this.assets.get(key);
        if (!asset) return { ok: false, key, revision: this.manifestRevision, code: 'unknown-key', retryable: false };
        let work = this.inFlight.get(key);
        if (!work) {
          work = this.options.loader.load(asset.resourcePath).then((nativeHandle) => {
            this.cache.set(key, nativeHandle);
            return nativeHandle;
          }).finally(() => this.inFlight.delete(key));
          this.inFlight.set(key, work);
        }
        try {
          const nativeHandle = await work;
          this.refs.set(key, (this.refs.get(key) ?? 0) + 1);
          return { ok: true, key, revision: this.manifestRevision, value: { manifestRevision: this.manifestRevision, nativeHandle } };
        } catch (error) {
          const classified = this.options.classifyError(error, asset);
          this.options.onDiagnostic?.({ key, revision: this.manifestRevision, code: classified.code, cause: error });
          return { ok: false, key, revision: this.manifestRevision, ...classified };
        }
      }
      releaseKey(key) {
        const refs = this.refs.get(key) ?? 0;
        if (refs <= 0) return;
        if (refs > 1) { this.refs.set(key, refs - 1); return; }
        this.refs.delete(key);
        const asset = this.cache.get(key);
        this.cache.delete(key);
        if (asset) this.options.loader.release(asset);
      }
    }
    export function createWxPlatformPorts(api, options) {
      return globalThis.${TEST_CONTROL_KEY}.createPorts(api, options);
    }
    export function missingRequiredWxLifecycleMethods(candidate) {
      return [
        'onHide',
        'offHide',
        'onShow',
        'offShow',
        'onMemoryWarning',
        'offMemoryWarning',
      ].filter((method) => typeof candidate[method] !== 'function');
    }
  `],
  ['./ui/InfiniteFlowView', `
    export const INFINITE_FLOW_PREVIEW_SAFE_INSETS = Object.freeze({ top: 91, right: 0, bottom: 66, left: 0 });
    export const INFINITE_FLOW_SAFE_CONTENT_MINIMUM = Object.freeze({ width: 702, height: 1146 });
    export class InfiniteFlowView {
      constructor(node, callbacks) {
        this.node = node;
        this.callbacks = callbacks;
        this.destroyCalls = 0;
        this.renderCalls = 0;
        this.visualImage = undefined;
        this.visualStatus = undefined;
        this.visualEvents = [];
        this.sceneVisuals = new Map();
        globalThis.${TEST_CONTROL_KEY}.views.push(this);
      }
      render(model, chrome, safeInsets) {
        this.renderCalls += 1;
        this.lastRender = { model, chrome, safeInsets };
      }
      setSceneVisualAsset(image, status) {
        this.clearSceneVisualAsset(status.key);
        this.sceneVisuals.set(status.key, { image, status });
        globalThis.${TEST_CONTROL_KEY}.sceneAssetEvents.push('display:' + status.key);
      }
      setSceneVisualAssetFallback(status) {
        this.clearSceneVisualAsset(status.key);
        this.sceneVisuals.set(status.key, { status });
      }
      clearSceneVisualAsset(key) {
        const keys = key === undefined ? [...this.sceneVisuals.keys()] : [key];
        for (const target of keys) {
          if (this.sceneVisuals.get(target)?.image) {
            globalThis.${TEST_CONTROL_KEY}.sceneAssetEvents.push('frame.destroy:' + target);
          }
          this.sceneVisuals.delete(target);
        }
      }
      setVisualAsset(image, status) {
        this.clearVisualAsset();
        this.visualImage = image;
        this.visualStatus = status;
        this.visualEvents.push('display:' + status.key);
        globalThis.${TEST_CONTROL_KEY}.assetEvents.push('display:' + status.key);
      }
      setVisualAssetFallback(status) {
        this.clearVisualAsset();
        this.visualStatus = status;
        this.visualEvents.push('fallback:' + status.key);
      }
      clearVisualAsset() {
        if (this.visualImage !== undefined) {
          globalThis.${TEST_CONTROL_KEY}.sceneAssetEvents.push('primary.frame.destroy:' + this.visualStatus?.key);
          this.visualEvents.push('detach');
          this.visualEvents.push('frame.destroy');
          this.visualEvents.push('texture.destroy');
          globalThis.${TEST_CONTROL_KEY}.assetEvents.push('detach');
          globalThis.${TEST_CONTROL_KEY}.assetEvents.push('frame.destroy');
          globalThis.${TEST_CONTROL_KEY}.assetEvents.push('texture.destroy');
        }
        this.visualImage = undefined;
        this.visualStatus = undefined;
      }
      destroy() { this.clearVisualAsset(); this.clearSceneVisualAsset(); this.destroyCalls += 1; }
      focusPrimaryActions() {}
      resolveCombatPresentation() {}
    }
  `],
  ['cc/env', `
    export const DEBUG = false;
    export const HTML5 = false;
  `],
]);

const selfPath = fileURLToPath(import.meta.url);
const entryPath = resolve(
  dirname(selfPath),
  '../assets/scripts/InfiniteFlowApp.ts',
);
const bundle = await build({
  entryPoints: [entryPath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2020',
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
  },
  write: false,
  plugins: [{
    name: 'bootstrap-race-virtual-modules',
    setup(buildApi) {
      buildApi.onResolve({ filter: /.*/ }, (args) => {
        if (virtualModules.has(args.path)) {
          return { path: args.path, namespace: 'bootstrap-race' };
        }
        return undefined;
      });
      buildApi.onLoad(
        { filter: /.*/, namespace: 'bootstrap-race' },
        (args) => ({ contents: virtualModules.get(args.path), loader: 'js' }),
      );
    },
  }],
});
assert.equal(bundle.outputFiles.length, 1);
const bundleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`;
const {
  InfiniteFlowApp,
  configureInfiniteFlowAssetRetryScheduler,
  configureInfiniteFlowWxDurabilityBoundary,
} = await import(bundleUrl);

// Exercise the real pure View formatter as part of the headless contract so
// ordered route targets and reward points cannot disappear behind next-cycle actions.
const viewEntryPath = resolve(
  dirname(selfPath),
  '../assets/scripts/ui/InfiniteFlowView.ts',
);
const viewVirtualCc = `
  export class BlockInputEvents {}
  class TestEvents {
    constructor() { this.listeners = new Map(); }
    on(type, handler) { const handlers = this.listeners.get(type) ?? []; handlers.push(handler); this.listeners.set(type, handlers); }
    off(type, handler) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== handler)); }
    emit(type, event) { for (const handler of [...this.listeners.get(type) ?? []]) handler(event); }
  }
  export const input = globalThis.__walkingTestInput = new TestEvents();
  export const game = globalThis.__walkingTestGame = new TestEvents();
  export const view = { getFrameSize() { return globalThis.__walkingTestFrameSize ?? { width: 0, height: 0 }; } };
  export const Input = { EventType: { KEY_DOWN: 'key-down', KEY_UP: 'key-up' } };
  export const Game = { EVENT_HIDE: 'game-hide' };
  export const KeyCode = { KEY_W: 87, KEY_A: 65, KEY_S: 83, KEY_D: 68, KEY_E: 69, SPACE: 32, ESCAPE: 27, ARROW_UP: 38, ARROW_DOWN: 40, ARROW_LEFT: 37, ARROW_RIGHT: 39 };
  export class EventKeyboard {}
  export class Rect { constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); } }
  export class Vec2 { constructor(x, y) { this.x = x; this.y = y; } }
  export class Mask { static Type = { GRAPHICS_RECT: 0 }; }
  export class ScrollView {
    static EventType = { SCROLLING: 'scrolling' };
    set content(node) { this._content = node; }
    get content() { return this._content; }
    getScrollOffset() { return this.offset ?? new Vec2(0, 0); }
    scrollToOffset(offset) { this.offset = new Vec2(offset.x, offset.y); this.node.emit(ScrollView.EventType.SCROLLING); }
  }
  export class Color {
    constructor(r, g, b, a = 255) { this.channels = [r, g, b, a]; Object.assign(this, { r, g, b, a }); }
  }
  export class EventTouch {}
  export class Graphics {
    static LineCap = { ROUND: 1 };
    static LineJoin = { ROUND: 1 };
    constructor() { this.clear(); }
    roundRect(x, y, width, height, radius) { this.roundRectCalls += 1; this.shape = { kind: 'roundRect', x, y, width, height, radius }; return this; }
    rect(x, y, width, height) { this.shape = { kind: 'rect', x, y, width, height }; return this; }
    circle(x, y, radius) { this.circleCalls += 1; this.shape = { kind: 'circle', x, y, radius }; return this; }
    close() { if (this.shape?.kind === 'path') this.shape.closed = true; return this; }
    clear() { this.segments = []; this.fills = []; this.strokes = []; this.cursor = undefined; this.shape = undefined; this.roundRectCalls = 0; this.circleCalls = 0; }
    fill() { this.fills.push({ color: this.fillColor, shape: this.shape }); }
    stroke() { this.strokes.push({ color: this.strokeColor, shape: this.shape }); }
    moveTo(x, y) { this.cursor = { x, y }; this.shape = { kind: 'path', points: [{ x, y }], closed: false }; }
    lineTo(x, y) {
      if (this.cursor !== undefined) {
        this.segments.push({ from: this.cursor, to: { x, y } });
      }
      if (this.shape?.kind === 'path') this.shape.points.push({ x, y });
      this.cursor = { x, y };
    }
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      if (this.cursor !== undefined) {
        this.segments.push({ from: this.cursor, controls: [{ x: c1x, y: c1y }, { x: c2x, y: c2y }], to: { x, y } });
      }
      if (this.shape?.kind === 'path') this.shape.points.push({ x, y });
      this.cursor = { x, y };
    }
  }
  export class Label {
    static HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
    static VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2 };
    static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
  }
  export class Node {
    static EventType = {
      TOUCH_START: 'touch-start',
      TOUCH_CANCEL: 'touch-cancel',
      TOUCH_END: 'touch-end',
      TOUCH_MOVE: 'touch-move',
    };
    constructor(name = '') {
      this.name = name;
      this.children = [];
      this.components = new Map();
      this.listeners = new Map();
    }
    addChild(child) { this.children.push(child); child.parent = this; }
    setPosition(position) { this.position = position; }
    setScale(scale) { this.scale = scale; }
    setSiblingIndex(index) {
      const children = this.parent?.children;
      if (!children) return;
      children.splice(children.indexOf(this), 1);
      children.splice(index, 0, this);
    }
    addComponent(Type) {
      const component = new Type();
      component.node = this;
      this.components.set(Type, component);
      return component;
    }
    getComponent(Type) { return this.components.get(Type) ?? null; }
    getChildByName(name) { return this.children.find((child) => child.name === name) ?? null; }
    on(type, callback) {
      const callbacks = this.listeners.get(type) ?? [];
      callbacks.push(callback);
      this.listeners.set(type, callbacks);
    }
    emit(type, event) {
      for (const callback of this.listeners.get(type) ?? []) callback(event);
    }
    off(type, callback) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== callback)); }
    destroy() { this.destroyed = true; }
  }
  export class Size {
    constructor(width, height) { this.width = width; this.height = height; }
  }
  export class Sprite {
    static SizeMode = { CUSTOM: 0, RAW: 1, TRIMMED: 2 };
    constructor() { this.spriteFrame = null; this.trim = true; }
  }
  export class SpriteFrame {
    static instances = [];
    static failRectAfter;
    set rect(value) {
      if (SpriteFrame.failRectAfter !== undefined && --SpriteFrame.failRectAfter === 0) throw new Error('injected hero crop assignment failure');
      this._rect = value;
    }
    get rect() { return this._rect; }
    static createWithImage(image) { return new SpriteFrame(image); }
    constructor(image) {
      SpriteFrame.instances.push(this);
      this.image = image;
      this.destroyCalls = 0;
      this.texture = {
        destroyCalls: 0,
        destroy() { this.destroyCalls += 1; },
      };
    }
    destroy() { this.destroyCalls += 1; }
  }
  export class UITransform {
    get contentSize() { return this.node.size; }
    setContentSize(size) { this.node.size = size; }
    convertToNodeSpaceAR(point) {
      let x = point.x, y = point.y;
      for (let node = this.node; node; node = node.parent) {
        x -= node.position?.x ?? 0;
        y -= node.position?.y ?? 0;
      }
      return new Vec3(x, y, 0);
    }
  }
  export class Vec3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
`;
const viewBundle = await build({
  stdin: {
    contents: `
      export * from './InfiniteFlowView';
      export { getInfiniteFlowSceneVisualKeys } from './scene-visuals';
      export { buildWalkWorld } from './walk-world';
      export { getDungeonHtmlRoomLayout, fitDungeonHtmlTargets, getCombatDuelLayout } from './InfiniteFlowWalkScene';
      export { DARK_UI, paintDarkFrame } from './dark-ui';
      export { Graphics as TestGraphics, SpriteFrame as TestSpriteFrame } from 'cc';
    `,
    resolveDir: dirname(viewEntryPath),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2020',
  write: false,
  plugins: [{
    name: 'entry-build-view-virtual-cc',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^cc$/ }, () => ({
        path: 'cc',
        namespace: 'bootstrap-race',
      }));
      buildApi.onLoad(
        { filter: /^cc$/, namespace: 'bootstrap-race' },
        () => ({ contents: viewVirtualCc, loader: 'js' }),
      );
    },
  }],
});
const viewBundleUrl = `data:text/javascript;base64,${Buffer.from(viewBundle.outputFiles[0].contents).toString('base64')}`;
const {
  InfiniteFlowView: SceneInfiniteFlowView,
  getInfiniteFlowSceneVisualKeys,
  buildWalkWorld,
  getDungeonHtmlRoomLayout,
  fitDungeonHtmlTargets,
  getCombatDuelLayout,
  DARK_UI,
  paintDarkFrame,
  TestGraphics,
  TestSpriteFrame,
  classifyInfiniteFlowHubActionGlyph,
  classifyInfiniteFlowExploreResultActionGlyph,
  formatInfiniteFlowHubActionLabel,
  formatInfiniteFlowHubActionLockedReason,
  formatInfiniteFlowHubActionShortCopy,
  formatInfiniteFlowHubPlayerCopy,
  formatInfiniteFlowExploreResultActionLabel,
  formatInfiniteFlowExploreResultActionSummary,
  formatInfiniteFlowEntryBuildDetail,
  formatInfiniteFlowEquipmentCommissionDetail,
  formatInfiniteFlowEquipmentHubDetail,
  formatInfiniteFlowEquipmentMemoryCombat,
  formatInfiniteFlowEquipmentMemoryHunt,
  formatInfiniteFlowEquipmentMemoryLibrary,
  formatInfiniteFlowEquipmentMemoryResult,
  formatInfiniteFlowExploreEquipmentMemory,
  formatInfiniteFlowExploreCompass,
  formatInfiniteFlowResultEquipmentDetail,
  formatInfiniteFlowChapterDecision,
  formatInfiniteFlowCombatChapterContext,
  formatInfiniteFlowOutcomeSummary,
  formatInfiniteFlowOutcomeMetric,
  formatInfiniteFlowPlayerChrome,
  isInfiniteFlowPlayerActivityFailure,
  formatInfiniteFlowVisualFallbackDiagnostic,
  formatInfiniteFlowResultAltar,
  formatInfiniteFlowResultOverview,
  formatInfiniteFlowResultEchoArchive,
  buildInfiniteFlowChapterCodexPages,
  buildInfiniteFlowResultPages,
  wrapInfiniteFlowLine,
  paginateInfiniteFlowText,
  orderActionsForCompactReachability,
  layoutInfiniteFlowCombatActionDeck,
  layoutInfiniteFlowExploreResultActionDeck,
  layoutInfiniteFlowHubControlDeck,
  layoutInfiniteFlowHubEntryActionDeck,
  layoutInfiniteFlowVisualBackdrop,
  layoutInfiniteFlowVisualStage,
  layoutInfiniteFlowMapWindow,
  matchInfiniteFlowMapMoveAction,
  INFINITE_FLOW_SAFE_CONTENT_MINIMUM,
} = await import(viewBundleUrl);

function darkRgb(color) {
  return [color.r, color.g, color.b];
}

function darkContrast(foreground, background) {
  const luminance = (color) => darkRgb(color).reduce((sum, channel, index) => {
    const srgb = channel / 255;
    const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function assertDarkFrameGeometry(graphics, width, height, label, requireCut = true) {
  assert.ok(graphics, `${label}: native Graphics frame exists`);
  assert.equal(graphics.roundRectCalls, 0, `${label}: no rounded button frame`);
  assert.equal(graphics.circleCalls, 0, `${label}: no circular button frame`);
  // The first fill is the actual surface; ornate frames finish with a small
  // accent diamond whose fillColor must never be mistaken for the background.
  const frame = graphics.fills[0];
  assert.ok(frame?.shape?.kind === 'path' && frame.shape.points.length >= 8,
    `${label}: first fill is a polygon with cut corners`);
  const xs = frame.shape.points.map(({ x }) => x), ys = frame.shape.points.map(({ y }) => y);
  assert.equal(Math.max(...xs) - Math.min(...xs), width, `${label}: frame preserves full width`);
  assert.equal(Math.max(...ys) - Math.min(...ys), height, `${label}: frame preserves full height`);
  const points = frame.shape.points;
  assert.ok(frame.shape.closed || (points[0].x === points.at(-1).x && points[0].y === points.at(-1).y),
    `${label}: the cut-corner frame path is closed`);
  if (requireCut) {
    assert.ok(points.some((point, index) => {
      const next = points[(index + 1) % points.length];
      return point.x !== next.x && point.y !== next.y;
    }), `${label}: diagonal corner cuts remain visible`);
  }
  return frame;
}

function assertDarkControl(node, size, label, warmWalking = false) {
  assert.ok(node, `${label}: original control node exists`);
  assert.deepEqual({ ...node.size }, { width: size, height: size }, `${label}: original touch geometry remains`);
  const frame = assertDarkFrameGeometry(node.getComponent(TestGraphics), size, size, label);
  if (warmWalking) {
    const [red, green, blue] = darkRgb(frame.color);
    assert.ok(Math.max(red, green, blue) < 85 && Math.min(red, green) > blue, `${label}: warm dark controls preserve a readable subdued surface`);
  } else assert.ok([DARK_UI.raised, DARK_UI.quiet, DARK_UI.goldDark, DARK_UI.redDark]
    .some((fill) => darkRgb(fill).every((channel, index) => channel === darkRgb(frame.color)[index])),
  `${label}: native dark control surface`);
  return frame;
}

// Shared body colors are audited against the actual dark reading surfaces,
// including danger and positive text. Decorative borders are intentionally excluded.
let darkUiMinimumBodyContrast = Infinity;
for (const foreground of ['bone', 'muted', 'gold', 'red', 'green']) {
  for (const background of ['panel', 'raised', 'quiet']) {
    const ratio = darkContrast(DARK_UI[foreground], DARK_UI[background]);
    darkUiMinimumBodyContrast = Math.min(darkUiMinimumBodyContrast, ratio);
    assert.ok(ratio >= 4.5, `dark palette ${foreground} on ${background}: body contrast ${ratio.toFixed(2)} must be >= 4.5`);
  }
}
for (const size of [104, 112, 120]) {
  const graphics = new TestGraphics();
  paintDarkFrame(graphics, size, size, { fill: DARK_UI.raised, edge: DARK_UI.edgeLight, accent: DARK_UI.gold, cut: 11 });
  assertDarkFrameGeometry(graphics, size, size, `shared ${size}px control`);
}

function assertBorderlessHudSurface(node, label) {
  const graphics = node?.getComponent(TestGraphics);
  assert.ok(!graphics || graphics.fills.length + graphics.strokes.length === 0,
    `${label}: HUD surface has no background, outline or corner ornaments`);
}

function assertWorldViewport(root, model) {
  const scene = findNode(root, 'WalkScene');
  const viewport = findNode(root, 'WalkViewport');
  if (model.phase === 'hub') {
    assert.deepEqual({ ...viewport.size }, { width: 750, height: scene.size.height }, 'courtyard world viewport covers the complete game surface');
    assert.ok(Math.abs(viewport.position.x + scene.position.x) < 1e-6 && viewport.position.y === 0 && viewport.position.z === 0,
      'safe insets preserve the approved courtyard viewport');
  } else {
    assert.ok(viewport.size.width > 0 && viewport.size.width <= 750
      && viewport.size.height > 0 && viewport.size.height < scene.size.height,
    'the fixed dungeon viewport leaves room for the header and controls');
  }
  assert.ok(hasComponentNamed(viewport, 'Mask'), 'walking world retains its clipping boundary');
}

// Native actor roots counter-scale the fixed affine camera. Include every parent
// transform when checking visible bounds, text and effect anchors.
function projectedNodePoint(node, point = { x: 0, y: 0 }) {
  let { x, y } = point;
  for (let current = node; current !== undefined; current = current.parent) {
    x = x * (current.scale?.x ?? 1) + (current.position?.x ?? 0);
    y = y * (current.scale?.y ?? 1) + (current.position?.y ?? 0);
  }
  return { x, y };
}
function projectedNodeBounds(node) {
  assert.ok(node, 'the actual projected node must exist');
  const lower = projectedNodePoint(node, { x: -node.size.width / 2, y: -node.size.height / 2 });
  const upper = projectedNodePoint(node, { x: node.size.width / 2, y: node.size.height / 2 });
  return { left: Math.min(lower.x, upper.x), right: Math.max(lower.x, upper.x),
    bottom: Math.min(lower.y, upper.y), top: Math.max(lower.y, upper.y) };
}
function sceneDungeonLayout(root, model, insets) {
  const spec = buildWalkWorld(model);
  const scene = findNode(root, 'WalkScene');
  const frame = globalThis.__walkingTestFrameSize ?? { width: 0, height: 0 };
  const viewportWidth = frame.width > 0 && frame.height > 0
    ? Math.min(frame.width, frame.height * 750 / scene.size.height) : 320;
  const layout = getDungeonHtmlRoomLayout({ worldWidth: spec.width, worldHeight: spec.height,
    surfaceHeight: scene.size.height, viewportWidth, safeInsets: insets });
  return { spec, layout, transientSpec: fitDungeonHtmlTargets(spec, layout) };
}
/** Combat v2 stands both fighters on fixed duel marks inside the same room projection. */
function sceneDuelLayout(root, model, insets) {
  const { spec, layout } = sceneDungeonLayout(root, model, insets);
  const scene = findNode(root, 'WalkScene');
  const frame = globalThis.__walkingTestFrameSize ?? { width: 0, height: 0 };
  const viewportWidth = frame.width > 0 && frame.height > 0
    ? Math.min(frame.width, frame.height * 750 / scene.size.height) : 320;
  const duel = getCombatDuelLayout({ worldWidth: spec.width, worldHeight: spec.height,
    surfaceHeight: scene.size.height, viewportWidth, safeInsets: insets });
  return { spec, layout, duel, enemyFoot: layout.unproject(duel.enemy), heroFoot: layout.unproject(duel.hero) };
}
function walkTowardRenderedTarget(view, root, id, radius) {
  const actor = findNode(root, `WalkTarget:${id}`);
  assert.ok(actor, `${id}: the actual interaction actor must exist`);
  const target = { x: actor.position.x, y: -actor.position.y };
  let held = new Set();
  for (let frame = 0; frame < 600; frame += 1) {
    const position = view.walkScene.getPosition();
    const dx = target.x - position.x;
    const dy = target.y - position.y;
    const next = new Set(Math.hypot(dx, dy) <= radius * 0.5 ? [] : [
      ...(Math.abs(dx) > 3 ? [dx < 0 ? 65 : 68] : []),
      ...(Math.abs(dy) > 3 ? [dy < 0 ? 87 : 83] : []),
    ]);
    for (const code of held) if (!next.has(code)) globalThis.__walkingTestInput.emit('key-up', { keyCode: code });
    for (const code of next) if (!held.has(code)) globalThis.__walkingTestInput.emit('key-down', { keyCode: code });
    held = next;
    view.tick(1 / 60);
    if (held.size === 0) return target;
  }
  for (const code of held) globalThis.__walkingTestInput.emit('key-up', { keyCode: code });
  assert.fail(`${id}: ordinary held-key walking did not reach the rendered interaction radius`);
}
function assertWorldImageCoverage(root, key) {
  const scene = findNode(root, 'WalkScene');
  const window = findNode(root, `WalkDungeonBackdropWindow:${key}`);
  const image = findNode(root, `WalkDungeonBackdrop:${key}`);
  assert.ok(window && image, `${key}: one dedicated environment window and image exist`);
  assert.equal(collectNodes(root, ({ name }) => name === `WalkDungeonBackdrop:${key}`).length, 1,
    `${key}: full coverage uses one environment image`);
  if (key === 'scene:hub_courtyard_walk') {
    const viewport = findNode(root, 'WalkViewport');
    const camera = findNode(root, 'WalkCamera');
    const zoom = camera.scale.x;
    assert.equal(camera.scale.y, zoom, 'courtyard background and actors retain their uniform world scale');
    assert.equal(window.parent, camera, 'courtyard artwork retains its independent scrolling-camera contract');
    assert.ok(window.size.width * zoom >= viewport.size.width - 1e-6
      && window.size.height * zoom >= viewport.size.height - 1e-6, `${key}: original cover window fills the courtyard`);
    assert.ok(image.size.width >= window.size.width - 1e-6 && image.size.height >= window.size.height - 1e-6);
    const x = camera.position.x + window.position.x * zoom;
    const y = camera.position.y + window.position.y * zoom;
    assert.ok(x - window.size.width * zoom / 2 <= -viewport.size.width / 2 + 1e-6
      && x + window.size.width * zoom / 2 >= viewport.size.width / 2 - 1e-6
      && y - window.size.height * zoom / 2 <= -viewport.size.height / 2 + 1e-6
      && y + window.size.height * zoom / 2 >= viewport.size.height / 2 - 1e-6,
    `${key}: scrolling cannot reveal a band outside the courtyard image`);
    return;
  }
  assert.equal(window.parent, scene, `${key}: dungeon artwork is independent of the room camera`);
  assert.deepEqual({ ...window.size }, { width: 750, height: scene.size.height },
    `${key}: the original background extends across the complete game surface`);
  const bounds = projectedNodeBounds(window);
  const rootCenter = projectedNodePoint(root);
  assert.ok(Math.abs(bounds.left - (rootCenter.x - 375)) < 0.001
    && Math.abs(bounds.right - (rootCenter.x + 375)) < 0.001
    && Math.abs(bounds.bottom - (rootCenter.y - scene.size.height / 2)) < 0.001
    && Math.abs(bounds.top - (rootCenter.y + scene.size.height / 2)) < 0.001,
  `${key}: safe insets and room fitting cannot crop the background to a square`);
  assert.ok(image.size.width >= window.size.width - 1e-6 && image.size.height >= window.size.height - 1e-6,
    `${key}: one cover image fills the complete background window`);
}

function hudFixtureLayout(viewportWidth) {
  const narrow = viewportWidth <= 350;
  return { px: 750 / viewportWidth, narrow, infoLeft: narrow ? 61 : 65,
    infoRight: narrow ? 225 : 292, healthWidth: narrow ? 75.6 : 115.2,
    avatarLeft: narrow ? 9 : 10, cropWidth: narrow ? 40 : 42,
    navRight: narrow ? 1 : 3, navGap: narrow ? 0 : 2 };
}

function assertSharedHeader(root, model, insets, viewportWidth = 320) {
  assertWorldViewport(root, model);
  const layout = hudFixtureLayout(viewportWidth);
  const { px, narrow } = layout;
  const top = 667 - insets.top;
  const hud = findNode(root, 'WalkHud');
  const boundsOf = node => {
    const b = absoluteNodeBounds(node);
    return { left: (b.left + 375) / px, right: (b.right + 375) / px,
      top: (top - b.top) / px, bottom: (top - b.bottom) / px };
  };
  const closeTo = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, message);
  assertBorderlessHudSurface(hud, 'shared role HUD');
  assert.equal(findNode(hud, 'WalkRoleFrame'), undefined, 'shared role HUD has no decorative outline');
  const name = findNode(hud, 'WalkRoleName');
  assert.equal(labelComponent(name).string, '轮回者', 'all phases retain the same character name');
  closeTo(boundsOf(name).left, layout.infoLeft, 'character name starts at the approved information column');
  closeTo(boundsOf(name).top, 13, 'name and resources share the first row');
  assert.equal(labelComponent(name).fontSize, (narrow ? 12 : 13) * px);
  const currency = findNode(hud, 'WalkCurrencyReadout');
  assert.equal(labelComponent(currency), undefined, 'currency row is a container rather than an old combined label');
  const metrics = model.sections[1].metrics;
  const resources = [['WalkRewardPoints', 'reward-points'], ['WalkLingyun', 'lingyun']].map(([nodeName, id]) => {
    const node = findNode(currency, nodeName);
    const value = findNode(node, `${nodeName}Value`);
    assert.equal(labelComponent(value).string, metrics.find(metric => metric.id === id)?.value ?? '—', `${id}: HUD uses only the authoritative balance`);
    assert.equal(labelComponent(value).enableWrapText, false, `${id}: balance remains on one line`);
    assert.equal(labelComponent(value).fontSize, (narrow ? 10 : 11) * px);
    assert.equal(node.listeners.size > 0, metrics.some(metric => metric.id === id), `${id}: only an available authoritative balance opens a resource popup`);
    closeTo((boundsOf(node).top + boundsOf(node).bottom) / 2, 23, `${id}: resource touch region shares the name-row center`);
    assert.equal(node.size.height, 44 * px);
    assert.equal(nodesOverlap(name, value), false, 'resource digits cannot overlap the character name');
    return node;
  });
  assert.equal(nodesOverlap(resources[0], resources[1]), false, 'resource touch regions remain separate');
  assert.ok(boundsOf(resources[1]).right <= layout.infoRight + 1e-6, 'resources leave the right navigation column clear');
  const avatar = findNode(hud, 'SceneCharacter');
  assert.deepEqual({ ...avatar.size }, { width: 44 * px, height: 61 * px });
  const avatarFrame = avatar.getComponent(TestGraphics);
  assert.equal(avatarFrame.fills.length, 1, 'portrait keeps only the approved rectangular image backing');
  assert.equal(avatarFrame.fills[0].shape.kind, 'rect');
  closeTo(boundsOf(avatar).left + (narrow ? 1 : 0), layout.avatarLeft, 'visible portrait preserves the prototype left inset');
  closeTo(boundsOf(avatar).top, 13, 'portrait aligns with the name row');
  assert.ok(avatarFrame.strokes.every(({ shape }) => shape?.kind === 'rect'), 'portrait has no old ornamental frame or dark lower bevel');
  assert.equal(labelComponent(findNode(avatar, 'SceneCharacterLabel')).string, '角色');
  const art = findNode(avatar, 'WalkAvatarArt');
  assert.ok(art, 'ready shared header displays its real portrait');
  assert.equal(findNode(avatar, 'WalkAvatarPlaceholder'), undefined, 'ready shared header never recreates superseded avatar drawings');
  const crop = findNode(avatar, 'WalkAvatarCrop');
  assert.ok(hasComponentNamed(crop, 'Mask'), 'shared portrait retains the masked crop');
  assert.deepEqual({ ...crop.size }, { width: layout.cropWidth * px, height: 59 * px });
  assert.ok(hasComponentNamed(art, 'Sprite'));
  const buttonSpecs = [['SceneDetails', '背包', 0, 0], ['SceneHelp', '菜单', 1, 0],
    ...(model.phase === 'explore' ? [['SceneMap', '地图', 0, 1]] : []),
    ...(model.phase === 'explore' || model.phase === 'combat' ? [['SceneCodex', '目标', 1, 1]] : [])];
  const controls = [avatar, ...resources];
  for (const [nodeName, caption, column, row] of buttonSpecs) {
    const node = findNode(root, nodeName);
    controls.push(node);
    assert.deepEqual({ ...node.size }, { width: 44 * px, height: 44 * px }, `${nodeName}: phone touch size remains 44px`);
    closeTo(boundsOf(node).right, viewportWidth - layout.navRight - (1 - column) * (44 + layout.navGap), `${nodeName}: prototype navigation column`);
    closeTo(boundsOf(node).top, 5 + 44 * row, `${nodeName}: prototype navigation row`);
    assertBorderlessHudSurface(node, `shared ${nodeName}`);
    assert.equal(findNode(node, `${nodeName}Frame`), undefined);
    assert.equal(labelComponent(findNode(node, `${nodeName}Label`)).string, caption);
    const icon = findNode(node, `${nodeName}Icon`);
    const graphics = icon.getComponent(TestGraphics);
    assert.ok(graphics.strokes.length + graphics.fills.length > 0, `${nodeName}: native icon remains visible`);
    assert.ok(graphics.lineWidth / px >= 1.5 - 1e-6, `${nodeName}: native strokes retain screen coverage`);
    assert.equal(collectStrings(icon).length, 0, `${nodeName}: icon is not an emoji label`);
  }
  const relics = model.phase === 'explore' || model.phase === 'combat' ? model.sections[1].loadout?.runRelics ?? [] : [];
  const strip = findNode(hud, 'WalkRunRelics');
  assert.equal(Boolean(strip), relics.length > 0, 'empty acquired collection hides the entire HUD relic row');
  if (strip) {
    controls.push(strip);
    assert.deepEqual({ ...strip.size }, { width: Math.max(44, relics.length * 24) * px, height: 44 * px });
    closeTo(boundsOf(strip).left, layout.infoLeft - 3, 'single relic touch region includes the first icon padding');
    closeTo(boundsOf(strip).top, 49, 'relic touch region remains below the name/resources row');
    assert.ok(strip.listeners.size > 0, 'acquired relic row has one physical binding');
    const icons = collectNodes(strip, node => node.name.startsWith('WalkRunRelicIcon:'));
    assert.deepEqual(icons.map(node => node.name), relics.map(relic => `WalkRunRelicIcon:${relic.relicId}`), 'only acquired relics appear in their existing order');
    for (const [index, icon] of icons.entries()) {
      assert.deepEqual({ ...icon.size }, { width: 18 * px, height: 18 * px });
      closeTo(boundsOf(icon).left, layout.infoLeft + index * 24, 'first relic icon aligns with health; subsequent icons keep the 6px visible gap');
      closeTo(boundsOf(icon).top, 62, 'relic art aligns near the portrait bottom');
    }
    assert.ok(collectNodes(strip, node => node !== strip).every(node => node.listeners.size === 0), 'relic icons and gaps share one row binding without nested buttons');
  }
  for (const control of controls) {
    assert.ok(control.size.width / px >= 44 && control.size.height / px >= 44, `${control.name}: touch area is at least 44 screen pixels`);
    const b = absoluteNodeBounds(control);
    assert.ok(b.left >= -375 + insets.left && b.right <= 375 - insets.right
      && b.top <= top && b.bottom >= -667 + insets.bottom, `${control.name}: touch area stays inside the safe viewport`);
  }
  for (let i = 0; i < controls.length; i += 1) for (let j = i + 1; j < controls.length; j += 1) {
    assert.equal(nodesOverlap(controls[i], controls[j]), false, `${controls[i].name}/${controls[j].name}: touch regions do not overlap`);
  }
  assert.equal(findNode(root, 'SceneMap') === undefined, model.phase !== 'explore');
  const detail = model.sections[1].detail;
  const hp = detail.kind === 'combat' ? `${detail.player.hp}/${detail.player.maxHp}` : metrics.find(({ id }) => id === 'hp')?.value;
  assert.equal(labelComponent(findNode(hud, 'WalkPlayerStatus')).string, hp ?? '—', 'shared health label contains only the authoritative hp/maxHp digits');
  const caption = findNode(hud, 'WalkHealthCaption');
  assert.equal(Boolean(caption), !narrow, 'narrow HUD omits only the life caption');
  if (caption) assert.equal(labelComponent(caption).string, '生命');
  if (/^\d+\s*\/\s*\d+$/.test(hp ?? '')) {
    const [current, maximum] = hp.split('/').map(Number);
    assertSharedHeaderHealth(root, current, maximum, viewportWidth);
  }
}

function assertCourtyardHud(root, model, insets, viewportWidth = 320) {
  assertSharedHeader(root, model, insets, viewportWidth);
  const px = 750 / viewportWidth;
  const bag = findNode(root, 'SceneDetails'), menu = findNode(root, 'SceneHelp');
  assert.ok(Math.abs((absoluteNodeBounds(menu).left - absoluteNodeBounds(bag).right) / px - hudFixtureLayout(viewportWidth).navGap) < 1e-6,
    'bag and menu keep the approved prototype column gap');
  const minimap = findNode(root, 'WalkMinimap');
  assert.deepEqual({ ...minimap.size }, { width: (viewportWidth <= 380 ? 94 : 108) * px, height: 44 * px });
  const minimapGraphics = minimap.getComponent(TestGraphics);
  assert.equal(minimapGraphics.fills[0].shape.kind, 'rect', 'courtyard minimap keeps a plain translucent backing');
  assert.deepEqual(minimapGraphics.fills[0].color.channels, [25, 31, 25, 152]);
  assert.ok(minimapGraphics.strokes.every(({ shape }) => shape?.kind !== 'path'), 'courtyard minimap has no ornamental outer outline');
  assert.ok(absoluteNodeBounds(minimap).top <= absoluteNodeBounds(menu).bottom,
    'minimap remains below the top-row controls');
  assert.ok(absoluteNodeBounds(minimap).right <= 375 - insets.right, 'minimap stays inside the safe viewport');
  const interact = findNode(root, 'WalkInteract');
  assert.deepEqual({ ...interact.size }, { width: 64 * px, height: 44 * px }, 'courtyard interaction is the approved 64 by 44 viewport pixels');
  assert.ok(interact.size.width / px >= 44 && interact.size.height / px >= 44, 'small interaction control retains the 44px minimum touch area');
  assert.equal(labelComponent(findNode(interact, 'WalkInteractLabel')).enableWrapText, false);
  for (const name of ['WalkLocationName', 'WalkInteractionHint', 'WalkInteractionHintBacking', 'WalkJoystickStatus', 'WalkStatusLamp']) {
    assert.equal(findNode(root, name), undefined, `${name}: approved courtyard has no scene or joystick readout`);
  }
}

function assertSharedHeaderHealth(root, hp, maxHp, viewportWidth = 320) {
  const hud = findNode(root, 'WalkHud');
  const px = 750 / viewportWidth;
  const layout = hudFixtureLayout(viewportWidth);
  const width = layout.healthWidth * px;
  const height = 3 * px;
  const current = labelComponent(findNode(hud, 'WalkPlayerStatus'));
  assert.equal(current?.string, `${hp}/${maxHp}`, 'shared header displays only the authoritative health digits');
  assert.equal(findNode(hud, 'WalkPlayerHealthCaption'), undefined, 'shared header has no separate old life caption');
  assert.equal(findNode(hud, 'WalkPlayerMaxHealth'), undefined, 'shared header has no separate old maximum HP label');
  assert.equal(current.fontSize, (layout.narrow ? 11 : 12) * px, 'all phases use the prototype responsive health text size');
  assert.deepEqual(darkRgb(current.color), [238, 229, 201], 'shared health readout retains the courtyard text color');
  assert.equal(current.enableShadow, true, 'shared health text keeps its small native shadow on bright chapter art');
  assert.deepEqual(darkRgb(current.shadowColor), [11, 18, 13], 'shared header uses the approved dark text shadow');
  assert.ok(current.shadowBlur <= 3 && Math.abs(current.shadowOffset.x) <= 3 && Math.abs(current.shadowOffset.y) <= 3,
    'shared health text shadow stays within the approved 1–3px readability range');
  const health = findNode(hud, 'WalkPlayerHealth');
  assert.ok(Math.abs(health.size.width - width) < 1e-6 && Math.abs(health.size.height - height) < 1e-6,
    'all phases use the approved responsive short three-pixel track');
  const graphics = health.getComponent(TestGraphics);
  const track = graphics.fills[0];
  assert.deepEqual(track.color.channels, [60, 65, 48, 255], 'shared health track matches the courtyard gray-green track');
  assert.equal(track.shape.kind, 'rect', 'shared health track has no panel ornament');
  assert.ok(Math.abs(track.shape.width - width) < 1e-6 && Math.abs(track.shape.height - height) < 1e-6,
    'health updates preserve the actual track dimensions');
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  const fill = graphics.fills.find(({ color }) => darkRgb(color).every((value, index) => value === [157, 170, 132][index]));
  if (ratio > 0) assert.ok(fill, 'shared health fill matches the courtyard gray-green when HP is positive');
  if (fill) {
    assert.equal(fill.shape.kind, 'rect');
    assert.ok(Math.abs(fill.shape.width - width * ratio) < 1e-6, 'shared health geometry follows the authoritative value at its actual width');
    assert.ok(Math.abs(fill.shape.height - height) < 1e-6, 'shared HP updates preserve the thin line');
    assert.equal(fill.color.channels[3], 255);
  }
  assert.ok(graphics.fills.every(({ color }) => darkRgb(color).every((value, index) => value === [60, 65, 48][index])
    || darkRgb(color).every((value, index) => value === [157, 170, 132][index])), 'HP updates preserve the shared courtyard colors');
  assert.ok(graphics.strokes.every(({ shape }) => shape?.kind === 'rect' && Math.abs(shape.width - width) < 1e-6 && Math.abs(shape.height - height) < 1e-6),
    'shared HP updates retain only the original thin rectangular track stroke');
}

function assertDarkWalkingUi(root, model, insets, viewportWidth = 320) {
  if (model.phase === 'hub') { assertCourtyardHud(root, model, insets, viewportWidth); return; }
  assertSharedHeader(root, model, insets, viewportWidth);
  const top = 667 - insets.top, bottom = -667 + insets.bottom;
  const px = 750 / viewportWidth;
  const interact = findNode(root, 'WalkInteract');
  if (model.phase === 'combat') {
    // Combat v2 suspends walking: the duel stage hides the joystick and proximity control.
    assert.equal(interact.active, false, 'combat: proximity interaction is hidden');
    assert.equal(findNode(root, 'WalkJoystick').active, false, 'combat: joystick is hidden');
  } else {
    const interactWidth = (viewportWidth <= 350 ? 64 : 68) * px;
    const interactHeight = (viewportWidth <= 350 ? 65 : 69) * px;
    assert.deepEqual({ ...interact.size }, { width: interactWidth, height: interactHeight }, `${model.phase}: interaction retains the HTML physical touch size`);
    assertDarkFrameGeometry(interact.getComponent(TestGraphics), interactWidth, interactHeight, `${model.phase}/WalkInteract`, true);
    const interactBounds = absoluteNodeBounds(interact);
    assert.ok(interactBounds.bottom >= bottom && interactBounds.top <= bottom + 120 * px,
      `${model.phase}: interaction fits below the fixed room`);
  }
  const hud = findNode(root, 'WalkHud');
  const graphics = hud.getComponent(TestGraphics);
  assert.ok(!graphics || graphics.fills.length + graphics.strokes.length === 0, `${model.phase}: HUD04 has no painted header panel`);
  assert.equal(findNode(hud, 'WalkRoleFrame'), undefined, `${model.phase}: role outline is removed`);
  for (const name of ['WalkLocationName', 'WalkMode']) {
    assert.equal(findNode(root, name), undefined, `${model.phase}: HUD04 removes ${name}`);
  }
  assert.doesNotMatch(collectStrings(hud).join('\n'), /临时试玩|刷新丢失进度/u, 'HUD04 removes preview copy from the transparent top');
  const risk = findNode(root, 'WalkRiskSummary');
  if (risk !== undefined) {
    const roleWidth = Math.min(viewportWidth - 124, 244) * px;
    assert.deepEqual({ ...risk.size }, { width: roleWidth, height: 24 * px }, 'dungeon risk readout fits the shared role column');
    assert.deepEqual({ ...risk.position }, { x: -375 + 10 * px + roleWidth / 2, y: top - 94 * px, z: 0 }, 'dungeon risk readout keeps its established safe-column position');
    const readout = findNode(risk, 'WalkRiskReadout');
    for (const icon of collectNodes(hud, node => node.name.startsWith('WalkRunRelicIcon:'))) {
      assert.ok(absoluteNodeBounds(icon).bottom >= absoluteNodeBounds(readout).top, 'visible relic icons clear the risk text');
    }
  }
  if (model.phase === 'combat') {
    const actionNames = new Set(model.sections[2].actions.map(({ actionId }) => `WalkCombatAction:${actionId}`));
    const actions = collectNodes(root, ({ name }) => actionNames.has(name));
    assert.ok(actions.length > 0);
    actions.forEach((node) => {
      // Round duel controls: an opaque circular face sized to the square touch box.
      const graphics = node.getComponent(TestGraphics);
      const face = graphics?.fills.find(({ color, shape }) => shape?.kind === 'circle' && color.a >= 220);
      assert.ok(face, `${node.name}: opaque round face`);
      assert.ok(Math.abs(face.shape.radius * 2 - node.size.width) < 1e-6 && node.size.width === node.size.height,
        `${node.name}: the face fills its square touch box`);
      assert.ok(node.size.width / px >= 44, `${node.name}: the action retains its physical touch minimum`);
      const action = model.sections[2].actions.find(action => node.name === `WalkCombatAction:${action.actionId}`);
      assert.ok(action, `${node.name}: the visible control belongs to an original combat action`);
      const bounds = absoluteNodeBounds(node);
      assert.ok(bounds.bottom >= bottom - 1e-6 && bounds.top <= bottom + 240 * px,
        `${node.name}: duel controls stay in the bottom control band`);
      assert.ok(darkContrast(labelComponent(findNode(node, `${node.name}Label`)).color, face.color) >= 4.5,
        `${node.name}: label stays readable on its face`);
    });
    // Engine hit-testing uses each node's square box: no two controls may share a touch point.
    const touchBoxes = collectNodes(root, ({ name }) => /^WalkCombat(?:Action|Choice):[^:]/.test(name) && !name.endsWith('Label') && !name.endsWith('Icon'))
      .map(node => ({ name: node.name, bounds: absoluteNodeBounds(node) }));
    assert.ok(touchBoxes.length >= 3, 'combat: the attack and both picker controls are present');
    touchBoxes.forEach((a, index) => touchBoxes.slice(index + 1).forEach((b) => {
      const separated = a.bounds.right <= b.bounds.left + 1e-6 || b.bounds.right <= a.bounds.left + 1e-6
        || a.bounds.top <= b.bounds.bottom + 1e-6 || b.bounds.top <= a.bounds.bottom + 1e-6;
      assert.ok(separated, `combat: ${a.name} and ${b.name} touch boxes do not overlap`);
    }));
    const focus = absoluteNodeBounds(findNode(root, 'WalkCombatFocus'));
    assert.ok(focus.bottom >= bottom - 1e-6, `combat: the focus readout stays inside the safe bottom (${focus.bottom} >= ${bottom})`);
  }
}

function assertDarkResultUi(root, insets) {
  const sealFill = findNode(root, 'WorldResultSeal')?.getComponent(TestGraphics)?.fills[0];
  assert.ok(sealFill, 'result: settlement seal keeps its native fill');
  assert.deepEqual(sealFill.color.channels, DARK_UI.panel.channels,
    'result: settlement seal uses the shared opaque dark panel surface');
  const floorFill = findNode(root, 'WorldFloor')?.getComponent(TestGraphics)?.fills[0];
  assert.ok(floorFill, 'result: settlement floor keeps its native fill');
  assert.deepEqual(darkRgb(floorFill.color), darkRgb(DARK_UI.panel),
    'result: settlement floor uses the shared dark panel RGB');
  assert.equal(floorFill.color.channels[3], 110, 'result: floor retains its original translucent alpha');
  const xOffset = (insets.left - insets.right) / 2;
  const controls = [
    ['ScenePagePrevious', 84, 116], ['SceneDetails', 230, 140],
    ['SceneHelp', 375, 126], ['ScenePageNext', 666, 116],
  ];
  for (const [name, centerX, width] of controls) {
    const node = findNode(root, name);
    assert.ok(node, `result/${name}: original control remains`);
    assert.deepEqual({ ...node.size }, { width, height: 104 }, `${name}: original result touch dimensions remain`);
    assert.deepEqual({ ...node.position }, { x: centerX - 375 + xOffset, y: 667 - insets.top - 1042 - 52, z: 0 });
    const frame = assertDarkFrameGeometry(node.getComponent(TestGraphics), width, 104, `result/${name}`);
    assert.ok(darkContrast(labelComponent(findNode(node, `${name}Label`)).color, frame.color) >= 4.5,
      `result/${name}: native dark menu text remains readable`);
  }
  const actions = collectNodes(root, ({ name }) => name.startsWith('WorldAction:'));
  assert.ok(actions.length > 0, 'result: original settlement actions remain visible');
  actions.forEach((node, index) => {
    assert.deepEqual({ ...node.size }, { width: 340, height: 108 }, `${node.name}: original settlement action geometry remains`);
    assert.deepEqual({ ...node.position }, {
      x: (index % 2 === 0 ? 196 : 554) - 375 + xOffset,
      y: 667 - insets.top - 810 - Math.floor(index / 2) * 118 - 54,
      z: 0,
    });
    const frame = assertDarkFrameGeometry(node.getComponent(TestGraphics), 340, 108, node.name);
    for (const name of ['ActionTitle', 'ActionReadout']) {
      const ratio = darkContrast(labelComponent(findNode(node, name)).color, frame.color);
      assert.ok(ratio >= 4.5, `result/${node.name}/${name}: body contrast ${ratio.toFixed(2)} must be >= 4.5`);
    }
  });
}

// Gameplay and information fixtures use complete approved art. Asset-loading
// cases below instantiate the unmodified real View and resolve slots explicitly.
function supplySceneVisualFixtures(view, model, excludedKeys = []) {
  if (!model) return;
  const courtyardSources = {
    'scene:courtyard_pillar': { width: 870, height: 1808 },
    'scene:courtyard_crate': { width: 1457, height: 1080 },
    'scene:courtyard_lamp': { width: 930, height: 1691 },
    'scene:courtyard_altar': { width: 1500, height: 1049 },
  };
  for (const key of new Set(Object.values(getInfiniteFlowSceneVisualKeys(model)))) {
    if (excludedKeys.includes(key) || view.sceneVisuals.get(key)?.frame) continue;
    const source = key === 'character:reincarnator_walk' ? { width: 1254, height: 1254 }
      : key === 'scene:hub_courtyard_walk' ? { width: 2172, height: 724 }
      : key === HUB_PORTAL_FIXTURE.key ? { width: 1018, height: 1545 }
      : courtyardSources[key] ?? (key.startsWith('scene:dungeon_world_') || key.startsWith('item:run_relic_') ? { width: 1254, height: 1254 }
        : { width: 1024, height: 1536 });
    view.setSceneVisualAsset(source, { key, revision: 'complete-scene-fixture' });
  }
}

// Historical information cards accept old node-type aliases; walking fixtures
// project the current public monster identity so world art can be required.
function walkingExploreModel(decision, options = {}) {
  const model = exploreModel(decision, options);
  model.sections[1].metrics.push(
    { id: 'reward-points', label: '奖励点', value: '85', severity: 'neutral' },
    { id: 'lingyun', label: '灵蕴', value: '3', severity: 'neutral' },
  );
  if (options.currentNode === undefined) {
    const detail = model.sections[1].detail;
    detail.currentNode = { ...detail.currentNode, nodeType: 'monster', monsterId: 'rail_patrol_wraith' };
    detail.map = { ...detail.map, nodes: detail.map.nodes.map(node => node.nodeId === detail.currentNode.nodeId
      ? { ...node, nodeType: 'monster' } : node) };
  }
  return model;
}

class SceneFixtureView extends SceneInfiniteFlowView {
  render(model, chrome, insets) {
    if (chrome.sceneAssets === undefined || chrome.sceneAssets === 'ready') supplySceneVisualFixtures(this, model);
    super.render(model, chrome, insets);
  }
}

// Preserve the detailed-information surface's existing regression suite; scene
// defaults and its physical interactions have their own cases below.
class InfiniteFlowView extends SceneFixtureView {
  constructor(...args) {
    super(...args);
    this.openDetails();
  }
}

function assertSceneAssetGate(view, root, status) {
  const panel = findNode(root, status === 'error' ? 'SceneAssetError' : 'SceneAssetLoading');
  assert.ok(panel, `${status}: resource gate is visible`);
  assert.ok(hasComponentNamed(panel, 'BlockInputEvents'), `${status}: loading surface consumes scene touches`);
  assert.equal(findNode(root, 'WalkScene'), undefined, `${status}: incomplete scene cannot publish actors or controls`);
  assert.equal(view.walkScene, undefined, `${status}: no active walking simulation`);
  assert.equal(view.walkInput, undefined, `${status}: no walking input while assets are incomplete`);
  assert.equal((globalThis.__walkingTestInput.listeners.get('key-down') ?? []).length, 0,
    `${status}: keyboard listeners detach with the old scene`);
  const retry = findNode(root, 'SceneAssetRetry');
  assert.equal(Boolean(retry), status === 'error', 'manual retry is available only after failure');
  if (retry) {
    const viewportWidth = globalThis.__walkingTestFrameSize?.width ?? 320;
    assert.ok(retry.size.width * viewportWidth / 750 >= 44 && retry.size.height * viewportWidth / 750 >= 44,
      `${viewportWidth}px: scene retry remains at least 44 screen pixels in both dimensions`);
  }
}

// Runtime diagnostics remain intact in App state, while the player chrome is a
// pure projection that exposes only mode/save boundaries and actionable state.
{
  const bootChrome = Object.freeze({
    modeKind: 'boot',
    modeLabel: 'BOOT command=bootstrap',
    modeDetail: 'seed=fixture safe top 99 / bottom 88',
    activityMessage: 'attestation=boot-fixture revision=7',
  });
  const blockedChrome = Object.freeze({
    modeKind: 'blocked',
    modeLabel: 'BLOCKED command=persist',
    modeDetail: 'attestation=blocked-fixture',
    activityMessage: 'revision=8 seed=blocked',
  });
  assert.deepEqual(
    formatInfiniteFlowPlayerChrome(bootChrome),
    {
      modeLabel: bootChrome.modeLabel,
      modeDetail: bootChrome.modeDetail,
      activityMessage: bootChrome.activityMessage,
    },
    'boot chrome preserves full diagnostics',
  );
  assert.deepEqual(
    formatInfiniteFlowPlayerChrome(blockedChrome, 'combat'),
    {
      modeLabel: blockedChrome.modeLabel,
      modeDetail: blockedChrome.modeDetail,
      activityMessage: blockedChrome.activityMessage,
    },
    'blocked chrome preserves full diagnostics',
  );

  const modeCases = [
    [
      'preview',
      { modeKind: 'preview', modeLabel: 'raw preview', modeDetail: 'safe top 99 seed=1' },
      '∞ 无限流 · 试玩模式',
      '临时存档 · 关闭或刷新后进度会丢失',
    ],
    [
      'wx-devtools',
      { modeKind: 'wx-devtools', modeLabel: 'raw devtools', modeDetail: 'attestation=devtools' },
      '∞ 无限流 · 微信开发者工具 · NON_RELEASE',
      '临时存档 · 不可发布 · 关闭或刷新后进度会丢失',
    ],
    [
      'wx',
      { modeKind: 'wx', modeLabel: 'raw wx', modeDetail: 'attestation=wx safe bottom 77' },
      '∞ 无限流 · 微信运行',
      '持久存档边界已连接',
    ],
  ];
  for (const [label, chrome, expectedLabel, expectedDetail] of modeCases) {
    const before = JSON.stringify(chrome);
    const projected = formatInfiniteFlowPlayerChrome(chrome, 'explore');
    assert.equal(projected.modeLabel, expectedLabel, `${label} player mode label`);
    assert.equal(projected.modeDetail, expectedDetail, `${label} player save boundary`);
    assert.equal(JSON.stringify(chrome), before, `${label} raw chrome stays unchanged`);
  }

  const activityCases = [
    [
      'busy',
      { activityMessage: '提交 combat.attack:fixture', busyActionId: 'combat.attack:fixture' },
      '行动处理中',
    ],
    [
      'committed',
      { activityMessage: '已提交 combat.attack:fixture · revision 42' },
      '行动完成 · 进度已更新',
    ],
    [
      'duplicate',
      { activityMessage: '物理输入去重 combat.attack:fixture · revision 42' },
      '重复触控已忽略 · 进度未改变',
    ],
    [
      'rule-rejected',
      { activityMessage: '规则拒绝 combat.attack:fixture · 状态未改变' },
      '当前行动不可执行 · 进度未改变',
    ],
    [
      'local-rejected',
      { activityMessage: '本地输入拒绝：路线契约不属于当前副本' },
      '当前行动不可执行 · 进度未改变',
    ],
    [
      'invalid',
      { activityMessage: '输入无效 combat.attack:fixture' },
      '当前输入无效 · 请重新选择',
    ],
    [
      'action-failure',
      { activityMessage: 'combat.attack:fixture 失败：revision=42 path=monster/fixture seed=unsafe' },
      '行动失败 · 请稍后重试',
    ],
    [
      'visual-recovered',
      { activityMessage: '视觉资源恢复 · key=monster:fixture revision=42' },
      '画面资源已恢复 · 可继续游戏',
    ],
    [
      'visual-fallback',
      { activityMessage: '视觉资源回退 · key=monster:fixture code=decode' },
      '部分画面暂不可用 · 已切换文字模式，可继续游戏',
    ],
    [
      'memory-warning',
      { activityMessage: '微信内存告警：视觉资源已失效并释放；revision=42' },
      '设备内存紧张 · 已释放画面资源，请稍后继续',
    ],
    [
      'lifecycle-failure',
      { activityMessage: 'resume 生命周期错误：attestation=fixture' },
      '运行状态同步失败 · 请重新进入小游戏',
    ],
    [
      'lifecycle-complete',
      { activityMessage: 'resume：durable' },
      '运行状态已同步',
    ],
    [
      'lifecycle-timeout',
      { activityMessage: 'suspend：recoverable-timeout' },
      '运行状态同步失败 · 请重新进入小游戏',
    ],
    [
      'random-source-failure',
      { activityMessage: '安全随机池补充失败：seed=fixture' },
      '安全随机源暂不可用 · 请稍后重试',
    ],
    [
      'local-ui',
      { activityMessage: '本地界面：hub/select-panel' },
      '界面已切换',
    ],
    [
      'persistence-retried',
      { activityMessage: '已补写 wx-fixture:42 · revision 42' },
      '存档已补写 · 可继续游戏',
    ],
    [
      'persistence-retried-rejected',
      { activityMessage: '已补写 wx-fixture:42 · 规则拒绝，状态未改变' },
      '当前行动不可执行 · 进度未改变',
    ],
    [
      'unknown-normal',
      { activityMessage: 'opaque command token revision=42' },
      '战斗进行中',
    ],
  ];
  for (const [label, overrides, expected] of activityCases) {
    const chrome = {
      modeKind: 'preview',
      modeLabel: 'raw preview',
      modeDetail: 'safe top 99 attestation=fixture',
      ...overrides,
    };
    const before = JSON.stringify(chrome);
    const projected = formatInfiniteFlowPlayerChrome(chrome, 'combat');
    assert.equal(projected.activityMessage, expected, `${label} player activity`);
    assert.doesNotMatch(
      `${projected.modeLabel}\n${projected.modeDetail}\n${projected.activityMessage}`,
      /combat\.attack:fixture|\bcommand\b|\brevision\b|\bseed\b|\bpath\b|safe\s+(?:top|bottom)|attestation/iu,
      `${label} player chrome hides internal tokens`,
    );
    assert.equal(JSON.stringify(chrome), before, `${label} raw activity stays unchanged`);
  }
  const failureActivityLabels = new Set([
    'rule-rejected', 'local-rejected', 'invalid', 'action-failure', 'visual-fallback', 'memory-warning',
    'lifecycle-failure', 'lifecycle-timeout', 'random-source-failure', 'persistence-retried-rejected',
  ]);
  for (const [label, , expected] of activityCases) {
    assert.equal(isInfiniteFlowPlayerActivityFailure(expected), failureActivityLabels.has(label),
      `${label} player activity failure tone`);
  }
  assert.equal(isInfiniteFlowPlayerActivityFailure(undefined), false);
  for (const [label, overrides, legacyActivity] of activityCases.filter(([label]) =>
    ['visual-recovered', 'visual-fallback', 'memory-warning'].includes(label))) {
    const chrome = Object.freeze({
      modeKind: 'preview', modeLabel: 'raw preview', modeDetail: 'revision=42', sceneAssets: 'ready', ...overrides,
    });
    const before = JSON.stringify(chrome);
    for (const [phase, expected] of [['hub', '主神空间已就绪'], ['explore', '探索进行中'], ['combat', '战斗进行中']]) {
      const projected = formatInfiniteFlowPlayerChrome(chrome, phase);
      assert.equal(projected.activityMessage, expected, `${phase}/${label}: ready art replaces stale resource activity with normal phase activity`);
      assert.doesNotMatch(projected.activityMessage, /暂不可用|文字模式|已释放|资源.*恢复/u,
        `${phase}/${label}: recovery cannot retain an art-failure or recovery toast`);
      assert.equal(formatInfiniteFlowPlayerChrome({ ...chrome, modeKind: 'blocked' }, phase).activityMessage,
        overrides.activityMessage, `${phase}/${label}: blocked diagnostics preserve the exact raw activity`);
    }
    assert.equal(formatInfiniteFlowPlayerChrome(chrome, 'result').activityMessage, legacyActivity,
      `${label}: settlement keeps its existing visual diagnostics`);
    assert.equal(formatInfiniteFlowPlayerChrome({ ...chrome, sceneAssets: undefined }, 'combat').activityMessage, legacyActivity,
      `${label}: legacy callers without the scene gate keep their existing activity`);
    assert.equal(JSON.stringify(chrome), before, `${label}: recovery presentation preserves raw diagnostics`);
  }
}

const rawVisualFallbackDiagnostic = 'expectedRevision=sha key=monster:fixture path=monster/fixture generation=7 code=decode';
for (const modeKind of ['preview', 'wx-devtools', 'wx']) {
  assert.equal(
    formatInfiniteFlowVisualFallbackDiagnostic(
      { modeKind, modeLabel: 'fixture', modeDetail: 'fixture' },
      rawVisualFallbackDiagnostic,
    ),
    '部分画面暂不可用 · 已切换文字模式，可继续游戏',
    `${modeKind} visual fallback is player-facing`,
  );
}
for (const modeKind of ['boot', 'blocked']) {
  assert.equal(
    formatInfiniteFlowVisualFallbackDiagnostic(
      { modeKind, modeLabel: 'fixture', modeDetail: 'fixture' },
      rawVisualFallbackDiagnostic,
    ),
    rawVisualFallbackDiagnostic,
    `${modeKind} visual fallback retains diagnostics`,
  );
}

// Combat action paging is a fixed 2x2 tactical grid. Counts around every page
// boundary keep a stable non-empty pager domain, and requested pages clamp.
for (const [count, expectedPages] of [[0, 1], [1, 1], [4, 1], [5, 2], [8, 2], [9, 3]]) {
  const layout = layoutInfiniteFlowCombatActionDeck(count, 0);
  assert.equal(layout.pageSize, 4);
  assert.equal(layout.pageCount, expectedPages, `${count} combat actions page count`);
}
assert.equal(layoutInfiniteFlowCombatActionDeck(9, -10).page, 0, 'combat page clamps low');
assert.equal(layoutInfiniteFlowCombatActionDeck(9, 99).page, 2, 'combat page clamps high');
assert.equal(layoutInfiniteFlowCombatActionDeck(9, Number.NaN).page, 0, 'invalid combat page fails safe');
const combatGridLayout = layoutInfiniteFlowCombatActionDeck(4, 0);
assert.equal(combatGridLayout.slots.length, 4);
for (const slot of combatGridLayout.slots) {
  assert.equal(slot.width, 318);
  assert.equal(slot.height, 160);
  assert.ok(Math.abs(slot.x) + slot.width / 2 <= 702 / 2, 'combat slot stays inside deck width');
  assert.ok(Math.abs(slot.y) + slot.height / 2 <= 544 / 2, 'combat slot stays inside deck height');
  assert.ok(slot.width * 320 / 750 >= 44, 'combat slot width is 44+ viewport px at 320');
  assert.ok(slot.height * 320 / 750 >= 44, 'combat slot height is 44+ viewport px at 320');
}
for (let leftIndex = 0; leftIndex < combatGridLayout.slots.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < combatGridLayout.slots.length; rightIndex += 1) {
    const left = combatGridLayout.slots[leftIndex];
    const right = combatGridLayout.slots[rightIndex];
    const overlaps = Math.abs(left.x - right.x) < (left.width + right.width) / 2
      && Math.abs(left.y - right.y) < (left.height + right.height) / 2;
    assert.equal(overlaps, false, `combat slots ${leftIndex}/${rightIndex} do not overlap`);
  }
}

// Every legal Hub panel shares only the pure geometry. Counts exercise every
// live panel's boundary while the legacy entry alias remains identical.
for (const [count, expectedPages] of [[10, 3], [12, 3], [14, 4], [17, 5], [19, 5]]) {
  const layout = layoutInfiniteFlowHubControlDeck(count, 0);
  assert.equal(layout.pageSize, 4, `${count} hub actions use four slots`);
  assert.equal(layout.pageCount, expectedPages, `${count} hub actions use ${expectedPages} pages`);
}
assert.equal(layoutInfiniteFlowHubControlDeck(19, -10).page, 0, 'hub page clamps low');
assert.equal(layoutInfiniteFlowHubControlDeck(19, 99).page, 4, 'hub page clamps high');
assert.deepEqual(
  layoutInfiniteFlowHubEntryActionDeck(4, 0).slots,
  layoutInfiniteFlowHubControlDeck(4, 0).slots,
  'entry alias retains the unified Hub geometry',
);
assert.deepEqual(
  layoutInfiniteFlowHubControlDeck(4, 0).slots,
  combatGridLayout.slots,
  'unified Hub layout reuses combat geometry without changing it',
);

for (const [count, expectedPages] of [[0, 1], [1, 1], [4, 1], [5, 2], [31, 8]]) {
  const layout = layoutInfiniteFlowExploreResultActionDeck(count, 0);
  assert.equal(layout.pageSize, 4, `${count} Explore/Result actions use four slots`);
  assert.equal(layout.pageCount, expectedPages, `${count} Explore/Result actions use ${expectedPages} pages`);
}
assert.equal(layoutInfiniteFlowExploreResultActionDeck(31, 99).page, 7, '31-action page clamps to page eight');
assert.equal(layoutInfiniteFlowExploreResultActionDeck(5, 7).page, 1, 'shrunk action set clamps to its last page');
assert.equal(layoutInfiniteFlowExploreResultActionDeck(1, 7).page, 0, 'one action clamps to page one');
assert.deepEqual(
  layoutInfiniteFlowExploreResultActionDeck(4, 0).slots,
  combatGridLayout.slots,
  'Explore/Result layout reuses the proven combat geometry',
);

const compactPhaseActionFixture = (actionId, command, overrides = {}) => {
  const event = command === undefined
    ? undefined
    : Object.freeze({ kind: 'command', command: Object.freeze(command) });
  return Object.freeze({
    actionId,
    label: '玩家选项',
    placement: 'node',
    enabled: true,
    emphasis: 'secondary',
    recommendation: 'neutral',
    readout: '玩家可读摘要。',
    ...(event === undefined ? {} : { event }),
    ...overrides,
  });
};
for (const [command, glyph] of [
  [{ type: 'run/move', nodeId: 'target_node' }, '路'],
  [{ type: 'node/resolve-equipment-loot', equipmentId: 'target_equipment' }, '装'],
  [{ type: 'node/resolve-relic-draft', relicId: 'target_relic', draftId: 'draft' }, '响'],
  [{ type: 'node/resolve-soul-recharge', skillId: 'target_skill' }, '魂'],
  [{ type: 'node/resolve-event', eventId: 'event', optionId: 'option' }, '遇'],
  [{ type: 'node/resolve-field-survey', optionId: 'option' }, '勘'],
  [{ type: 'law/resolve-causal-ledger', choice: 'balance' }, '律'],
  [{ type: 'run/select-node', nodeId: 'target_node' }, '战'],
  [{ type: 'node/handle-trap', choice: 'counter' }, '解'],
  [{ type: 'node/use-portal', choice: 'stabilize' }, '门'],
  [{ type: 'node/collect-reward' }, '获'],
  [{ type: 'run/resolve-exit' }, '出'],
  [{ type: 'combat/use-method-technique', methodId: 'target_method' }, '诀'],
  [{ type: 'run/retreat' }, '退'],
]) {
  const action = compactPhaseActionFixture(`fixture:${command.type}`, command);
  assert.equal(
    classifyInfiniteFlowExploreResultActionGlyph('explore', action),
    glyph,
    `${command.type} Explore glyph`,
  );
}
for (const [actionId, command, glyph] of [
  ['result.archive-relic:mist-edge', { type: 'result/archive-relic', relicId: 'mist_edge' }, '档'],
  ['result.archive-relic:skip', { type: 'result/archive-relic' }, '略'],
  ['result.return-hub', { type: 'result/return-hub' }, '归'],
  ['result.unknown', { type: 'fixture/result-action' }, '结'],
]) {
  assert.equal(
    classifyInfiniteFlowExploreResultActionGlyph(
      'result',
      compactPhaseActionFixture(actionId, command, { placement: 'result' }),
    ),
    glyph,
    `${actionId} Result glyph`,
  );
}
for (const [phase, actionId, glyph] of [
  ['explore', 'map.move:disabled', '路'],
  ['explore', 'node.exit:disabled', '出'],
  ['result', 'result.archive-relic:skip', '略'],
  ['result', 'result.return-hub', '归'],
]) {
  assert.equal(
    classifyInfiniteFlowExploreResultActionGlyph(
      phase,
      compactPhaseActionFixture(actionId, undefined, { enabled: false }),
    ),
    glyph,
    `${actionId} disabled glyph uses only its stable action family`,
  );
}
const maliciousCompactEvent = Object.freeze({
  kind: 'command',
  command: Object.freeze({
    type: 'node/use-soul-skill',
    skillId: 'internal_skill',
    targetNodeId: 'secret_target_node',
  }),
});
const maliciousCompactAction = Object.freeze({
  actionId: 'soul-skill:internal_skill:node:secret_target_node',
  label: '裂空刃 → secret_target_node',
  placement: 'advanced',
  enabled: true,
  emphasis: 'secondary',
  recommendation: 'neutral',
  readout: 'node/use-soul-skill targetNodeId=secret_target_node legacy neutral recommended secondary high-risk',
  event: maliciousCompactEvent,
});
const maliciousCompactBefore = JSON.stringify(maliciousCompactAction);
assert.equal(formatInfiniteFlowExploreResultActionLabel('explore', maliciousCompactAction), '施展器魂能力');
assert.equal(formatInfiniteFlowExploreResultActionSummary('explore', maliciousCompactAction), '调整当前器魂能力。');
assert.doesNotMatch(
  `${formatInfiniteFlowExploreResultActionLabel('explore', maliciousCompactAction)}\n${formatInfiniteFlowExploreResultActionSummary('explore', maliciousCompactAction)}`,
  /soul-skill|node\/use|internal_skill|secret_target_node|targetNodeId|undefined|legacy|neutral|recommended|secondary|high-risk/iu,
  'malicious compact action copy exposes no action, node, target, event type, or raw enum',
);
assert.equal(maliciousCompactAction.event, maliciousCompactEvent, 'compact copy keeps exact event identity');
assert.equal(JSON.stringify(maliciousCompactAction), maliciousCompactBefore, 'compact copy leaves the action unchanged');

const hubGlyphFixture = (actionId, event) => ({
  actionId,
  label: 'fixture',
  placement: 'preparation',
  enabled: true,
  emphasis: 'secondary',
  recommendation: 'neutral',
  ...(event === undefined ? {} : { event }),
});
for (const [actionId, glyph] of [
  ['hub.entry.confirm', '门'],
  ['hub.entry.dungeon:previous', '‹'],
  ['hub.entry.dungeon:next', '›'],
  ['hub.entry.protocol:deep', '协'],
  ['hub.entry.inferno-tier:up', '炼'],
  ['hub.entry.route-contract:fixture', '契'],
  ['hub.entry.relic-seed:fixture', '种'],
  ['hub.relic-frame:assault', '响'],
  ['hub.supplies.buy:fixture', '购'],
  ['hub.supplies.toggle:fixture', '携'],
  ['hub.loadout.current', '组'],
  ['hub.recover', '愈'],
  ['hub.equipment.buy:fixture', '购'],
  ['hub.equipment.equip:fixture', '装'],
  ['hub.equipment.upgrade:fixture', '升'],
  ['hub.equipment.attune:fixture:none', '铭'],
  ['hub.equipment.temper:fixture', '炼'],
  ['hub.equipment.commission.start', '封'],
  ['hub.equipment.memory.cycle', '忆'],
  ['hub.pets.buy:fixture', '契'],
  ['hub.pets.upgrade:fixture', '育'],
  ['hub.pets.activate:fixture', '战'],
  ['hub.methods.learn:fixture', '学'],
  ['hub.methods.upgrade:fixture', '研'],
  ['hub.methods.activate:fixture', '修'],
  ['hub.bloodlines.unlock:fixture', '醒'],
  ['hub.bloodlines.upgrade:fixture', '升'],
  ['hub.bloodlines.activate:fixture', '血'],
  ['hub.companions.recruit:fixture', '募'],
  ['hub.companions.upgrade:fixture', '训'],
  ['hub.companions.activate:fixture', '伴'],
  ['hub.tasks.claim:fixture', '领'],
  ['hub.tasks.empty', '空'],
  ['hub.unknown:fixture', '•'],
]) {
  assert.equal(
    classifyInfiniteFlowHubActionGlyph(hubGlyphFixture(actionId)),
    glyph,
    `${actionId} hub glyph`,
  );
}
for (const [panel, glyph] of [
  ['entry', '门'],
  ['supplies', '物'],
  ['equipment', '锻'],
  ['pets', '灵'],
  ['methods', '诀'],
  ['bloodlines', '血'],
  ['companions', '伴'],
  ['tasks', '令'],
]) {
  const event = { kind: 'local', action: { type: 'hub/select-panel', panel } };
  assert.equal(
    classifyInfiniteFlowHubActionGlyph(hubGlyphFixture('hub.panel:mismatched-id', event)),
    glyph,
    `${panel} panel glyph follows the original presentation event`,
  );
}
assert.equal(
  classifyInfiniteFlowHubActionGlyph(hubGlyphFixture(
    'hub.panel:invalid',
    { kind: 'local', action: { type: 'hub/select-panel', panel: 'invalid' } },
  )),
  '•',
  'unknown panel glyph fails closed',
);

// The full-screen atmosphere reuses the active art at cover scale. Scene art
// stays centered; combat art may shift right only within the cropped surplus.
for (const kind of ['hub', 'explore', 'result']) {
  assert.equal(
    layoutInfiniteFlowVisualBackdrop(kind, 1600, 900).role,
    'scene',
    `${kind} does not select scene-backdrop composition`,
  );
}
const wideBackdrop = layoutInfiniteFlowVisualBackdrop('hub', 1600, 900);
assert.equal(wideBackdrop.renderable, true);
assert.equal(wideBackdrop.mode, 'cover');
assert.equal(wideBackdrop.height, 1334);
assert.ok(wideBackdrop.width >= 750);
assert.equal(wideBackdrop.x, 0, 'scene backdrop stays centered');
assert.ok(Math.abs(wideBackdrop.width / wideBackdrop.height - 1600 / 900) < 1e-12);

const panoramicBackdrop = layoutInfiniteFlowVisualBackdrop('explore', 1600, 400);
assert.equal(panoramicBackdrop.height, 1334);
assert.ok(panoramicBackdrop.width >= 750);
assert.equal(panoramicBackdrop.x, 0, 'panoramic scene stays centered');
assert.equal(panoramicBackdrop.width / panoramicBackdrop.height, 4);

const portraitBackdrop = layoutInfiniteFlowVisualBackdrop('combat', 300, 400);
assert.equal(portraitBackdrop.role, 'monster');
assert.equal(portraitBackdrop.height, 1334);
assert.ok(portraitBackdrop.width >= 750);
assert.ok(portraitBackdrop.x > 0, 'combat backdrop has a slight right composition');
assert.ok(
  portraitBackdrop.x <= (portraitBackdrop.width - 750) / 2,
  'combat shift stays inside cover crop surplus',
);
assert.equal(portraitBackdrop.width / portraitBackdrop.height, 3 / 4);

for (const [sourceWidth, sourceHeight] of [[0, 900], [1600, 0], [Number.NaN, 900]]) {
  const invalidBackdrop = layoutInfiniteFlowVisualBackdrop(
    'combat',
    sourceWidth,
    sourceHeight,
  );
  assert.equal(invalidBackdrop.renderable, false);
  assert.ok(
    [invalidBackdrop.x, invalidBackdrop.y, invalidBackdrop.width, invalidBackdrop.height]
      .every(Number.isFinite),
    'invalid backdrop dimensions fail closed with finite geometry',
  );
}

// The first 2D stage increment must never distort scene art or monster
// portraits. Invalid dimensions fail closed instead of silently stretching.
for (const kind of ['hub', 'explore', 'result']) {
  assert.equal(
    layoutInfiniteFlowVisualStage(kind, 720, 180).role,
    'scene',
    `${kind} does not select scene-stage composition`,
  );
}
const hubStageLayout = layoutInfiniteFlowVisualStage('hub', 1600, 900);
assert.equal(hubStageLayout.renderable, true);
assert.equal(hubStageLayout.width, 384);
assert.equal(hubStageLayout.height, 216);
assert.equal(hubStageLayout.width / hubStageLayout.height, 1600 / 900);

const exploreStageLayout = layoutInfiniteFlowVisualStage('explore', 720, 180);
assert.equal(exploreStageLayout.width, 694);
assert.equal(exploreStageLayout.height, 173.5);
assert.equal(exploreStageLayout.width / exploreStageLayout.height, 4);

const combatStageLayout = layoutInfiniteFlowVisualStage('combat', 288, 384);
assert.equal(combatStageLayout.role, 'monster');
assert.equal(combatStageLayout.renderable, true);
assert.equal(combatStageLayout.width, 162);
assert.equal(combatStageLayout.height, 216);
assert.equal(combatStageLayout.x, 260);
assert.equal(combatStageLayout.width / combatStageLayout.height, 288 / 384);

const unknownStageLayout = layoutInfiniteFlowVisualStage(
  'combat',
  Number.NaN,
  0,
);
assert.equal(unknownStageLayout.role, 'monster');
assert.equal(unknownStageLayout.renderable, false);
assert.ok(Number.isFinite(unknownStageLayout.x));
assert.ok(unknownStageLayout.width > 0 && unknownStageLayout.height > 0);

const topLeftMapWindow = layoutInfiniteFlowMapWindow(6, 5, 0, 0);
assert.deepEqual(
  [topLeftMapWindow.originX, topLeftMapWindow.originY],
  [0, 0],
  '6x5 current is visible at the top-left bound',
);
const bottomRightMapWindow = layoutInfiniteFlowMapWindow(7, 5, 6, 4);
assert.deepEqual(
  [bottomRightMapWindow.originX, bottomRightMapWindow.originY],
  [4, 2],
  '7x5 current is visible at the bottom-right bound',
);
assert.equal(bottomRightMapWindow.cellSize, 104);
assert.equal(bottomRightMapWindow.columns, 3);
assert.equal(bottomRightMapWindow.rows, 3);
const clampedMapWindow = layoutInfiniteFlowMapWindow(
  7,
  5,
  3,
  2,
  { x: 99, y: -99 },
);
assert.deepEqual(
  [clampedMapWindow.originX, clampedMapWindow.originY],
  [4, 0],
  'manual map panning clamps to the full topology bounds',
);
const malformedMapWindow = layoutInfiniteFlowMapWindow(
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NaN,
  Number.NEGATIVE_INFINITY,
  { x: Number.NaN, y: Number.POSITIVE_INFINITY },
);
assert.ok([
  malformedMapWindow.originX,
  malformedMapWindow.originY,
  malformedMapWindow.maximumOriginX,
  malformedMapWindow.maximumOriginY,
].every(Number.isFinite), 'malformed map layout stays finite');

const exactMapEvent = Object.freeze({
  kind: 'command',
  command: Object.freeze({ type: 'run/move', nodeId: 'east_hall' }),
});
const exactMapNode = Object.freeze({
  cellId: 'map.cell:1:0',
  nodeId: 'east_hall',
  title: '东侧大厅',
  nodeType: 'event',
  state: 'adjacent',
  stateLabel: '相邻可达',
  stateSymbol: '→',
  x: 1,
  y: 0,
  isAdjacent: true,
  canMove: true,
  moveActionId: 'map.move:map.cell:1:0',
});
const exactMapAction = Object.freeze({
  actionId: exactMapNode.moveActionId,
  label: '移动至东侧大厅',
  placement: 'map',
  enabled: true,
  emphasis: 'secondary',
  recommendation: 'recommended',
  event: exactMapEvent,
});
const mapInteractionReady = Object.freeze({
  busy: false,
  blocked: false,
  projectionValid: true,
});
const exactMapMatch = matchInfiniteFlowMapMoveAction(
  exactMapNode,
  [exactMapAction],
  mapInteractionReady,
);
assert.equal(exactMapMatch.status, 'ready');
assert.equal(exactMapMatch.action, exactMapAction, 'exact match preserves action identity');

const mapMatchCases = [
  ['node-disabled', { ...exactMapNode, canMove: false }, [exactMapAction], mapInteractionReady],
  ['missing-action-id', { ...exactMapNode, moveActionId: undefined }, [exactMapAction], mapInteractionReady],
  ['missing-action', exactMapNode, [{ ...exactMapAction, actionId: `${exactMapAction.actionId}:prefix-only` }], mapInteractionReady],
  ['duplicate-action', exactMapNode, [exactMapAction, { ...exactMapAction }], mapInteractionReady],
  ['placement-mismatch', exactMapNode, [{ ...exactMapAction, placement: 'node' }], mapInteractionReady],
  ['adjacency-mismatch', { ...exactMapNode, isAdjacent: false }, [exactMapAction], mapInteractionReady],
  ['projection-mismatch', { ...exactMapNode, disabledReason: '投影冲突' }, [exactMapAction], mapInteractionReady],
  ['projection-mismatch', exactMapNode, [{ ...exactMapAction, disabledReason: '投影冲突' }], mapInteractionReady],
  ['action-disabled', exactMapNode, [{ ...exactMapAction, enabled: false }], mapInteractionReady],
  ['event-missing', exactMapNode, [{ ...exactMapAction, event: undefined }], mapInteractionReady],
  ['busy', exactMapNode, [exactMapAction], { ...mapInteractionReady, busy: true }],
  ['blocked', exactMapNode, [exactMapAction], { ...mapInteractionReady, blocked: true }],
  ['projection-mismatch', exactMapNode, [exactMapAction], { ...mapInteractionReady, projectionValid: false }],
];
for (const [expectedStatus, node, actions, interaction] of mapMatchCases) {
  assert.equal(
    matchInfiniteFlowMapMoveAction(node, actions, interaction).status,
    expectedStatus,
    `map match fail-closed status: ${expectedStatus}`,
  );
}

const entryBuildReadout = formatInfiniteFlowEntryBuildDetail({
  kind: 'hub',
  activePanel: 'entry',
  entryBuild: {
    routeContract: {
      selectedRouteContractId: 'tower_mist_watch',
      selectionValid: true,
      options: [{
        routeContractId: 'tower_mist_watch',
        name: '巡雾问井',
        description: 'fixture',
        orderedTargets: [
          { order: 1, nodeId: 'upper_fog_patrol', nodeTitle: '上层雾巡' },
          { order: 2, nodeId: 'risky_font_trap', nodeTitle: '咒水井' },
        ],
        rewardPoints: 135,
        selected: true,
        selectable: false,
      }],
    },
    relic: {
      frame: 'assault',
      frameName: '强攻',
      candidateCount: 3,
      candidateReadout: '2 → 3',
      matchingConduitEquipmentIds: ['armor_piercing_sword'],
      selectedSeedRelicId: 'mist_edge',
      seedOptions: [{
        seedRelicId: 'mist_edge',
        name: '雾锋',
        description: 'fixture',
        selected: true,
        selectable: false,
      }],
    },
  },
});
assert.match(entryBuildReadout, /1 上层雾巡 → 2 咒水井/);
assert.match(entryBuildReadout, /\+135 点/);
assert.match(entryBuildReadout, /强攻回响 2 → 3 候选 · 归档种子 雾锋/);
const namelessRelicSeedReadout = formatInfiniteFlowEntryBuildDetail({
  kind: 'hub',
  activePanel: 'entry',
  entryBuild: {
    routeContract: {
      selectedRouteContractId: null,
      selectionValid: true,
      options: [],
    },
    relic: {
      frame: 'assault',
      frameName: '强攻',
      candidateCount: 2,
      candidateReadout: '2',
      matchingConduitEquipmentIds: [],
      selectedSeedRelicId: 'internal_relic',
      seedOptions: [{
        seedRelicId: 'internal_relic',
        name: 'internal_relic',
        description: 'fixture',
        selected: true,
        selectable: false,
      }],
    },
  },
});
assert.match(namelessRelicSeedReadout, /归档种子 未知遗物/);
assert.doesNotMatch(namelessRelicSeedReadout, /internal_relic/);

const HUB_FORBIDDEN_PLAYER_COPY = /\bseed\b|显式\s*seed|\brun\/enter\b|宿主|入场草案|领域(?:命令|返回|校验|激活校验)|本地委托草稿|现代流程/iu;
const rawHubCopy = '宿主会先生成并持久化显式 seed，再提交唯一一次 run/enter；仅更新入场草案、本地委托草稿，不提交领域命令；等待领域返回与领域校验；现代流程。';
const projectedHubCopy = formatInfiniteFlowHubPlayerCopy(rawHubCopy);
assert.doesNotMatch(projectedHubCopy, HUB_FORBIDDEN_PLAYER_COPY, 'Hub player-copy projection removes every audited engineering term');
assert.match(projectedHubCopy, /本局命数/);
assert.match(projectedHubCopy, /入场选择/);
assert.match(projectedHubCopy, /封存委托选择/);
assert.equal(rawHubCopy.includes('run/enter'), true, 'Hub copy projection leaves its raw source unchanged');

const hubLocalShortCopyCases = [
  [{ type: 'hub/select-panel', panel: 'supplies' }, /前往物资与携行/],
  [{ type: 'hub/select-catalog-entry', panel: 'equipment', entityId: 'internal_equipment' }, /浏览装备工坊目录/],
  [{ type: 'entry/select-dungeon', dungeonId: 'internal_dungeon' }, /挑战章节/],
  [{ type: 'entry/select-protocol', protocolId: 'internal_protocol' }, /探索协议/],
  [{ type: 'entry/set-inferno-tier', infernoTier: 4 }, /炼狱层级/],
  [{ type: 'entry/select-route-contract', routeContractId: 'internal_contract' }, /路线契约/],
  [{ type: 'entry/select-relic-seed', frame: 'assault', seedRelicId: 'internal_relic' }, /归档种子/],
  [{
    type: 'hub/set-equipment-commission-draft',
    draft: { equipmentIds: ['internal_equipment'], targetMaterialId: 'internal_material' },
  }, /封存委托选择/],
  [{ type: 'entry/request-enter', draft: { dungeonId: 'internal_dungeon', protocolId: 'standard' } }, /本局命数/],
];
for (const [localAction, expectedCopy] of hubLocalShortCopyCases) {
  const exactEvent = Object.freeze({ kind: 'local', action: Object.freeze(localAction) });
  const sourceAction = Object.freeze({
    actionId: `internal.action:${localAction.type}`,
    label: localAction.type,
    placement: 'preparation',
    enabled: true,
    emphasis: 'secondary',
    recommendation: 'neutral',
    readout: rawHubCopy,
    event: exactEvent,
  });
  const before = JSON.stringify(sourceAction);
  const shortCopy = formatInfiniteFlowHubActionShortCopy(sourceAction);
  const actionLabel = formatInfiniteFlowHubActionLabel(sourceAction);
  assert.match(shortCopy, expectedCopy, `${localAction.type} gets player copy from its local event type`);
  assert.doesNotMatch(shortCopy, HUB_FORBIDDEN_PLAYER_COPY, `${localAction.type} exposes no engineering term`);
  assert.doesNotMatch(shortCopy, /internal_|internal\.action|hub\/select|entry\/select|entry\/request/iu, `${localAction.type} exposes no action or entity identifier`);
  assert.doesNotMatch(actionLabel, /internal_|internal\.action|hub\/select|entry\/select|entry\/request/iu, `${localAction.type} label exposes no action or entity identifier`);
  assert.equal(sourceAction.event, exactEvent, `${localAction.type} keeps the original event object`);
  assert.equal(JSON.stringify(sourceAction), before, `${localAction.type} projection does not mutate the action`);
}

const malformedCommandEvent = Object.freeze({
  kind: 'command',
  command: Object.freeze({
    type: 'hub/buy-equipment',
    equipmentId: 'internal_equipment',
  }),
});
const malformedCommandAction = Object.freeze({
  actionId: 'hub.equipment.buy:internal_equipment',
  label: 'hub.equipment.buy:internal_equipment',
  placement: 'primary',
  enabled: true,
  emphasis: 'primary',
  recommendation: 'neutral',
  readout: '执行 hub/buy-equipment：internal_equipment',
  event: malformedCommandEvent,
});
assert.equal(formatInfiniteFlowHubActionLabel(malformedCommandAction), '未知选项');
assert.equal(formatInfiniteFlowHubActionShortCopy(malformedCommandAction), '查看此选项的当前效果。');
assert.equal(malformedCommandAction.event, malformedCommandEvent, 'malformed command projection retains exact event identity');

const disabledHubEvent = Object.freeze({
  kind: 'local',
  action: Object.freeze({
    type: 'hub/set-equipment-commission-draft',
    draft: Object.freeze({
      equipmentIds: Object.freeze(['internal_equipment']),
      targetMaterialId: 'internal_material',
    }),
  }),
});
const disabledHubAction = Object.freeze({
  actionId: 'hub.equipment.commission.toggle:internal_equipment',
  label: '封存委托',
  placement: 'preparation',
  enabled: false,
  emphasis: 'secondary',
  recommendation: 'neutral',
  disabledReason: '请检查 hub/set-equipment-commission-draft 中的 internal_equipment 与 internal_material。',
  event: disabledHubEvent,
});
assert.equal(formatInfiniteFlowHubActionLockedReason(disabledHubAction), '当前选项不可用。');
assert.equal(disabledHubAction.event, disabledHubEvent, 'disabled Hub copy keeps exact event identity');

const commissionFixture = {
  helpId: 'equipmentCommission',
  requiredEquipmentCount: 2,
  requiredDungeonCount: 3,
  materialReward: 2,
  cost: [
    { resource: 'rewardPoints', label: '奖励点', required: 300, held: 420, gap: 0 },
    { resource: 'lingyun', label: '灵蕴', required: 1, held: 1, gap: 0 },
  ],
  canAfford: true,
  candidates: [
    {
      equipmentId: 'armor_piercing_sword',
      name: '破甲剑',
      slotLabel: '武器',
      materialId: 'refined_iron',
      materialName: '精铁',
      selected: false,
    },
    {
      equipmentId: 'chronal_edge',
      name: '时序锋',
      slotLabel: '武器',
      materialId: 'time_sand',
      materialName: '时砂',
      selected: false,
    },
  ],
  focusedEquipment: {
    equipmentId: 'armor_piercing_sword',
    name: '破甲剑',
    eligible: true,
    selected: false,
  },
  materialOptions: [
    { materialId: 'refined_iron', materialName: '精铁', selected: false },
    { materialId: 'time_sand', materialName: '时砂', selected: false },
  ],
};
const idleCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail({
  ...commissionFixture,
  status: 'idle',
  draft: { equipmentIds: [], targetMaterialId: null },
  start: { enabled: false, disabledReason: '请选择两件装备和目标材料。' },
});
assert.match(idleCommissionReadout.title, /待选择/);
assert.match(idleCommissionReadout.summary, /装备 0\/2.*材料 未选择/);
assert.match(idleCommissionReadout.detail, /不同副本 0\/3.*材料 x2/);

const draftCommissionDetail = {
  ...commissionFixture,
  status: 'draft',
  draft: {
    equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
    targetMaterialId: 'time_sand',
  },
  start: { enabled: true },
};
const draftCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail(
  draftCommissionDetail,
);
assert.match(draftCommissionReadout.title, /草稿/);
assert.match(draftCommissionReadout.summary, /破甲剑 \+ 时序锋.*时砂/);
assert.match(draftCommissionReadout.detail, /奖励点 420\/300.*灵蕴 1\/1.*可启动/);

const namelessCommissionFixture = {
  ...commissionFixture,
  status: 'draft',
  candidates: [{
    ...commissionFixture.candidates[0],
    name: 'armor_piercing_sword',
  }],
  materialOptions: [{
    materialId: 'refined_iron',
    materialName: 'refined_iron',
    selected: true,
  }],
  draft: {
    equipmentIds: ['armor_piercing_sword', 'missing_equipment'],
    targetMaterialId: 'refined_iron',
  },
  start: {
    enabled: false,
    disabledReason: '当前委托草稿未通过领域校验。',
  },
};
const namelessCommissionBefore = JSON.stringify(namelessCommissionFixture);
const namelessCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail(
  namelessCommissionFixture,
);
assert.match(namelessCommissionReadout.summary, /未知装备 \+ 未知装备.*未知材料/);
assert.doesNotMatch(
  `${namelessCommissionReadout.summary}\n${namelessCommissionReadout.detail}`,
  /armor_piercing_sword|missing_equipment|refined_iron|领域校验/iu,
  'missing commission names never fall back to equipmentId/materialId or raw validation copy',
);
assert.equal(JSON.stringify(namelessCommissionFixture), namelessCommissionBefore, 'commission fallback projection does not mutate its source');

const activeCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail({
  ...commissionFixture,
  status: 'active',
  draft: { equipmentIds: [], targetMaterialId: null },
  active: {
    equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
    equipmentNames: ['破甲剑', '时序锋'],
    targetMaterialId: 'time_sand',
    targetMaterialName: '时砂',
    completedDungeonIds: ['demon_tower_1', 'metro_abyss'],
    completedDungeonNames: ['镇魔塔一层', '地铁深渊'],
    completedCount: 2,
    remainingCount: 1,
    recallLossReadout: '召回不退款，并丢失 2/3 个不同副本进度。',
  },
});
assert.match(activeCommissionReadout.title, /进行中/);
assert.match(activeCommissionReadout.summary, /时砂 x2/);
assert.match(activeCommissionReadout.detail, /不同副本 2\/3：镇魔塔一层、地铁深渊/);
assert.match(activeCommissionReadout.detail, /召回不退款.*丢失 2\/3/);

const advancedCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail({
  helpId: 'equipmentCommission',
  status: 'advanced',
  dungeonId: 'demon_tower_1',
  dungeonName: '镇魔塔一层',
  equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
  equipmentNames: ['破甲剑', '时序锋'],
  targetMaterialId: 'time_sand',
  targetMaterialName: '时砂',
  completedDungeonIds: ['demon_tower_1'],
  completedDungeonNames: ['镇魔塔一层'],
  completedCount: 1,
  requiredDungeonCount: 3,
  remainingCount: 2,
  rewardAmount: 0,
  rewardReadout: '本次成功出口已推进委托；还需 2 个不同副本。',
});
assert.match(advancedCommissionReadout.title, /已推进/);
assert.match(advancedCommissionReadout.summary, /镇魔塔一层.*目标 时砂/);
assert.match(advancedCommissionReadout.detail, /不同副本 1\/3.*还需 2 个/);

const completedCommissionDetail = {
  helpId: 'equipmentCommission',
  status: 'completed',
  dungeonId: 'rust_hospital',
  dungeonName: '锈蚀医院',
  equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
  equipmentNames: ['破甲剑', '时序锋'],
  targetMaterialId: 'time_sand',
  targetMaterialName: '时砂',
  completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'rust_hospital'],
  completedDungeonNames: ['镇魔塔一层', '地铁深渊', '锈蚀医院'],
  completedCount: 3,
  requiredDungeonCount: 3,
  remainingCount: 0,
  rewardAmount: 2,
  rewardReadout: '时砂 x2 已存入永久背包。',
};
const completedCommissionReadout = formatInfiniteFlowEquipmentCommissionDetail(
  completedCommissionDetail,
);
assert.match(completedCommissionReadout.title, /已完成/);
assert.match(completedCommissionReadout.summary, /时砂 x2/);
assert.match(completedCommissionReadout.detail, /永久背包/);

const equipmentMemoryLibraryFixture = {
  helpId: 'equipmentMemory',
  equipmentId: 'armor_piercing_sword',
  equipmentName: '破甲剑',
  supported: true,
  owned: true,
  equipped: true,
  unlocked: true,
  active: true,
  unlockedCount: 2,
  unlockedMemories: [
    {
      memoryId: 'tower_memory',
      name: '镇魔余响',
      dungeonId: 'demon_tower_1',
      dungeonName: '镇魔塔一层',
      description: 'fixture',
      effectDescription: '储存溢出伤害',
      active: true,
    },
    {
      memoryId: 'metro_memory',
      name: '地铁回声',
      dungeonId: 'metro_abyss',
      dungeonName: '地铁深渊',
      description: 'fixture',
      effectDescription: '恢复已储存伤害',
      active: false,
    },
  ],
  activeMemory: {
    memoryId: 'tower_memory',
    name: '镇魔余响',
    dungeonId: 'demon_tower_1',
    dungeonName: '镇魔塔一层',
    description: 'fixture',
    effectDescription: '储存溢出伤害',
    active: true,
  },
  cycle: {
    enabled: true,
    nextMemoryId: 'metro_memory',
    nextMemoryName: '地铁回声',
  },
  acquisitionReadout: '现代流程中，成熟装备在成功出口后自动收录并激活当前章节记忆。',
};
const equipmentMemoryLibraryReadout = formatInfiniteFlowEquipmentMemoryLibrary(
  equipmentMemoryLibraryFixture,
);
assert.match(equipmentMemoryLibraryReadout.title, /支持.*已拥有.*已装备/);
assert.match(equipmentMemoryLibraryReadout.summary, /已解锁 2.*已激活 镇魔余响/);
assert.match(equipmentMemoryLibraryReadout.detail, /成功出口后自动收录.*下一项 地铁回声/);
assert.doesNotMatch(equipmentMemoryLibraryReadout.detail, /现代流程/);

const namelessMemoryFixture = {
  ...equipmentMemoryLibraryFixture,
  equipmentName: 'armor_piercing_sword',
  activeMemory: {
    ...equipmentMemoryLibraryFixture.activeMemory,
    name: 'tower_memory',
  },
  cycle: {
    enabled: true,
    nextMemoryId: 'metro_memory',
  },
  acquisitionReadout: '现代流程等待领域返回的记忆。',
};
const namelessMemoryBefore = JSON.stringify(namelessMemoryFixture);
const namelessMemoryReadout = formatInfiniteFlowEquipmentMemoryLibrary(
  namelessMemoryFixture,
);
assert.match(namelessMemoryReadout.summary, /未知装备.*已激活 未知记忆/);
assert.match(namelessMemoryReadout.detail, /下一项 未知记忆/);
assert.doesNotMatch(
  `${namelessMemoryReadout.summary}\n${namelessMemoryReadout.detail}`,
  /armor_piercing_sword|tower_memory|metro_memory|现代流程|领域返回/iu,
  'missing memory names never fall back to equipmentId/nextMemoryId or raw flow copy',
);
assert.equal(JSON.stringify(namelessMemoryFixture), namelessMemoryBefore, 'memory fallback projection does not mutate its source');

const unavailableMemoryLibraryReadout = formatInfiniteFlowEquipmentMemoryLibrary({
  ...equipmentMemoryLibraryFixture,
  supported: false,
  owned: false,
  equipped: false,
  unlocked: false,
  active: false,
  unlockedCount: 0,
  unlockedMemories: [],
  activeMemory: undefined,
  cycle: { enabled: false, disabledReason: '当前装备不承载装备记忆。' },
  acquisitionReadout: '当前装备不承载装备记忆。',
});
assert.match(unavailableMemoryLibraryReadout.title, /不支持.*未拥有.*未装备/);
assert.match(unavailableMemoryLibraryReadout.summary, /未解锁 0.*未激活/);
assert.match(unavailableMemoryLibraryReadout.detail, /当前装备不承载装备记忆/);

const coexistHubReadout = formatInfiniteFlowEquipmentHubDetail({
  equipmentCommission: draftCommissionDetail,
  equipmentMemory: equipmentMemoryLibraryFixture,
});
assert.match(coexistHubReadout.commission.title, /封存委托.*草稿/);
assert.match(coexistHubReadout.memory.title, /装备记忆.*支持/);

const legacyHuntInput = {
  helpId: 'equipmentMemory',
  compatibility: 'current-legacy-hunt',
  enabled: true,
  legacyDisabled: false,
  malformedDisabled: false,
  display: {
    key: 'active',
    label: '狩猎进行中',
    detail: '两个信号必须在同一局完成。',
  },
  memory: {
    memoryId: 'tower_memory',
    name: '镇魔余响',
    description: 'fixture',
  },
  equipment: { equipmentId: 'armor_piercing_sword', name: '破甲剑' },
  frozenAttunement: { attunementId: 'armor_piercing_sword:edge', name: '裂锋铭刻' },
  signals: [
    {
      type: 'node',
      label: '目标节点',
      targetId: 'upper_fog_patrol',
      targetName: '上层雾巡',
      completed: true,
    },
    {
      type: 'event',
      label: '目标事件',
      targetId: 'mist_watch_event',
      targetName: '事件 ID · mist_watch_event',
      completed: false,
    },
  ],
  completedConditionCount: 1,
  totalConditionCount: 2,
  nextTarget: { kind: 'event', label: '事件 ID · mist_watch_event' },
};
const legacyHuntSnapshot = JSON.stringify(legacyHuntInput);
const legacyHuntReadout = formatInfiniteFlowEquipmentMemoryHunt(legacyHuntInput);
assert.match(legacyHuntReadout.title, /狩猎进行中.*本局旧版任务/);
assert.match(legacyHuntReadout.summary, /双信号 1\/2.*上层雾巡.*目标已标记/);
assert.match(legacyHuntReadout.detail, /下一目标 目标已标记.*冻结铭刻 裂锋铭刻/);
assert.doesNotMatch(
  Object.values(legacyHuntReadout).join('\n'),
  /upper_fog_patrol|mist_watch_event|事件 ID|\blegacy\b|\bunknown\b/iu,
  'equipment-memory formatter hides IDs and raw compatibility tokens',
);
assert.equal(JSON.stringify(legacyHuntInput), legacyHuntSnapshot, 'memory formatter leaves its VM input untouched');

const malformedHuntInput = {
  helpId: 'equipmentMemory',
  compatibility: 'malformed',
  enabled: false,
  legacyDisabled: false,
  malformedDisabled: true,
  display: {
    key: 'failed',
    label: '狩猎故障',
    detail: '旧版 legacy 记忆狩猎快照格式异常，unknown 目标未投影。',
  },
  signals: [],
  completedConditionCount: 0,
  totalConditionCount: 2,
  nextTarget: { kind: 'blocked', label: '快照异常，无法确定下一目标。' },
  failureReason: 'malformed-snapshot',
};
const malformedHuntSnapshot = JSON.stringify(malformedHuntInput);
const malformedHuntReadout = formatInfiniteFlowEquipmentMemoryHunt(malformedHuntInput);
assert.match(malformedHuntReadout.title, /狩猎故障.*任务数据异常/);
assert.match(malformedHuntReadout.summary, /双信号 0\/2.*不可用/);
assert.match(malformedHuntReadout.detail, /下一目标.*冻结铭刻 不可用.*任务数据异常/);
assert.doesNotMatch(
  Object.values(malformedHuntReadout).join('\n'),
  /malformed-snapshot|\blegacy\b|\bunknown\b/iu,
  'malformed memory state is honest without exposing internal enum values',
);
assert.equal(JSON.stringify(malformedHuntInput), malformedHuntSnapshot, 'malformed formatter leaves its VM input untouched');
assert.equal(
  formatInfiniteFlowExploreEquipmentMemory({ equipmentMemoryHunt: undefined }),
  undefined,
  'modern explore without a projected hunt must not synthesize legacy UI',
);

const storedCombatReadout = formatInfiniteFlowEquipmentMemoryCombat({
  helpId: 'equipmentMemory',
  status: 'active',
  enabled: true,
  activeName: '镇魔余响',
  memoryId: 'tower_memory',
  matchingEquipmentIds: ['armor_piercing_sword'],
  matchingEquipmentNames: ['破甲剑'],
  overflowState: 'stored',
  overflowStored: true,
  restored: false,
});
assert.match(storedCombatReadout.title, /激活 镇魔余响/);
assert.match(storedCombatReadout.summary, /匹配装备 破甲剑/);
assert.match(storedCombatReadout.detail, /overflow 已储存/);

const restoredCombatReadout = formatInfiniteFlowEquipmentMemoryCombat({
  helpId: 'equipmentMemory',
  status: 'active',
  enabled: true,
  activeName: '镇魔余响',
  memoryId: 'tower_memory',
  matchingEquipmentIds: ['armor_piercing_sword'],
  matchingEquipmentNames: ['破甲剑'],
  overflowState: 'restored',
  overflowStored: false,
  restored: true,
});
assert.match(restoredCombatReadout.detail, /overflow 已恢复/);

const legacyDisabledCombatReadout = formatInfiniteFlowEquipmentMemoryCombat({
  helpId: 'equipmentMemory',
  status: 'legacy-disabled',
  enabled: false,
  matchingEquipmentIds: [],
  matchingEquipmentNames: [],
  overflowState: 'empty',
  overflowStored: false,
  restored: false,
  disabledReason: '导入局缺少装备记忆入场快照，效果已禁用。',
});
assert.match(legacyDisabledCombatReadout.title, /legacy fail-closed/);
assert.match(legacyDisabledCombatReadout.summary, /无匹配装备/);
assert.match(legacyDisabledCombatReadout.detail, /overflow 空.*效果已禁用/);

const malformedCombatReadout = formatInfiniteFlowEquipmentMemoryCombat({
  helpId: 'equipmentMemory',
  status: 'malformed-disabled',
  enabled: false,
  matchingEquipmentIds: [],
  matchingEquipmentNames: [],
  overflowState: 'empty',
  overflowStored: false,
  restored: false,
  disabledReason: '装备记忆战斗状态格式异常，效果已禁用。',
});
assert.match(malformedCombatReadout.title, /格式故障 fail-closed/);
assert.match(malformedCombatReadout.detail, /格式异常.*效果已禁用/);

const legacyMemoryResult = {
  helpId: 'equipmentMemory',
  legacyHunt: {
    granted: false,
    status: 'lost',
    reason: 'active-at-exit',
    dungeonId: 'demon_tower_1',
    dungeonName: '镇魔塔一层',
    equipmentId: 'armor_piercing_sword',
    equipmentName: '破甲剑',
    memoryId: 'tower_memory',
    memoryName: '镇魔余响',
    displayLabel: '狩猎已失效',
    displayDetail: '双信号未完成即抵达出口。',
    rewardReadout: '镇魔余响未收录，本局记忆不入库。',
  },
};
const legacyMemoryResultReadout = formatInfiniteFlowEquipmentMemoryResult(
  legacyMemoryResult,
);
assert.match(legacyMemoryResultReadout.title, /legacy 结算/);
assert.match(legacyMemoryResultReadout.summary, /狩猎已失效.*破甲剑.*镇魔余响.*未收录/);
assert.match(legacyMemoryResultReadout.detail, /双信号未完成.*本局记忆不入库/);

const modernResultFixtures = [
  { status: 'active', expected: /本章已收录并激活/ },
  { status: 'recorded', expected: /本章已收录/ },
  { status: 'not-recorded', expected: /本章尚未收录/ },
];
for (const { status, expected } of modernResultFixtures) {
  const readout = formatInfiniteFlowEquipmentMemoryResult({
    helpId: 'equipmentMemory',
    modernLibrary: {
      dungeonId: 'demon_tower_1',
      dungeonName: '镇魔塔一层',
      memoryId: 'tower_memory',
      memoryName: '镇魔余响',
      status,
      recordedEquipmentIds: status === 'not-recorded' ? [] : ['armor_piercing_sword'],
      recordedEquipmentNames: status === 'not-recorded' ? [] : ['破甲剑'],
      activeEquipmentIds: status === 'active' ? ['armor_piercing_sword'] : [],
      activeEquipmentNames: status === 'active' ? ['破甲剑'] : [],
      readout: 'presentation-owned fixture',
    },
  });
  assert.match(readout.summary, expected);
  assert.doesNotMatch(`${readout.title} ${readout.summary} ${readout.detail}`, /本次.*(?:获得|收录)|新获得/);
}

const coexistResultReadout = formatInfiniteFlowResultEquipmentDetail({
  equipmentCommissionSettlement: completedCommissionDetail,
  equipmentMemory: {
    helpId: 'equipmentMemory',
    modernLibrary: {
      dungeonId: 'rust_hospital',
      dungeonName: '锈蚀医院',
      memoryId: 'hospital_memory',
      memoryName: '锈蚀残响',
      status: 'active',
      recordedEquipmentIds: ['armor_piercing_sword'],
      recordedEquipmentNames: ['破甲剑'],
      activeEquipmentIds: ['armor_piercing_sword'],
      activeEquipmentNames: ['破甲剑'],
      readout: '本章记忆已收录并激活。',
    },
  },
});
assert.match(coexistResultReadout.commission.title, /封存委托.*已完成/);
assert.match(coexistResultReadout.memory.summary, /本章已收录并激活/);

const helpClickCalls = [];
const helpClickView = new InfiniteFlowView({}, {
  activate(physicalId, actionId, event) {
    helpClickCalls.push({ physicalId, actionId, event });
  },
});
const equipmentHelpSection = {
  kind: 'help',
  entries: [
    {
      id: 'equipmentCommission',
      openAction: {
        actionId: 'help.open:equipmentCommission',
        event: {
          kind: 'local',
          action: { type: 'help/open', helpId: 'equipmentCommission' },
        },
      },
    },
    {
      id: 'equipmentMemory',
      openAction: {
        actionId: 'help.open:equipmentMemory',
        event: {
          kind: 'local',
          action: { type: 'help/open', helpId: 'equipmentMemory' },
        },
      },
    },
  ],
};
const helpParent = {
  children: [],
  addChild(child) { this.children.push(child); },
};
helpClickView.renderEquipmentHubStatus(
  helpParent,
  {
    equipmentCommission: draftCommissionDetail,
    equipmentMemory: equipmentMemoryLibraryFixture,
  },
  equipmentHelpSection,
  { modeKind: 'preview', modeLabel: 'fixture', modeDetail: 'fixture' },
);
for (const [index, helpId] of ['equipmentCommission', 'equipmentMemory'].entries()) {
  const name = helpId === 'equipmentCommission'
    ? 'EquipmentCommissionHelp'
    : 'EquipmentMemoryHelp';
  const x = helpId === 'equipmentCommission' ? -62 : 291;
  const button = helpParent.children.find((child) => child.name === name);
  assert.ok(button, `${helpId} adjacent help button was not rendered`);
  assert.equal(button.position.x, x);
  assert.equal(button.size.width, 104);
  assert.equal(button.size.height, 104);
  const touchId = index + 1;
  button.emit('touch-start', { getID: () => touchId, propagationStopped: false });
  button.emit('touch-end', { getID: () => touchId, propagationStopped: false });
  button.emit('touch-end', { getID: () => touchId, propagationStopped: false });
  assert.equal(helpClickCalls.length, index + 1, `${helpId} emitted more than once`);
}
assert.deepEqual(helpClickCalls, [
  {
    physicalId: 'cocos-touch:1',
    actionId: 'help.open:equipmentCommission',
    event: {
      kind: 'local',
      action: { type: 'help/open', helpId: 'equipmentCommission' },
    },
  },
  {
    physicalId: 'cocos-touch:2',
    actionId: 'help.open:equipmentMemory',
    event: {
      kind: 'local',
      action: { type: 'help/open', helpId: 'equipmentMemory' },
    },
  },
]);

// === Explore chapter decision surfaces ===
// The real View bundle turns the read-only chapterDecision VM into five ordered
// pages (law, directive, route contract, pressure, pursuit) without recomputing
// domain rules. Fixtures mirror the frozen presentation contract for the
// metro_abyss / starfall_mine / rust_hospital replays.
const chapterModifiersFixture = (overrides = {}) => ({
  encounter: { allStatsPercent: -10, defensePercent: -10, artPowerPercent: -10 },
  trap: { damagePercent: 20, dcPercent: 15 },
  healingPercent: -20,
  outgoingDamage: { forcePercent: 10, artPercent: 10 },
  guardEffectPercent: -10,
  ...overrides,
});

const chapterLawFixtures = {
  metro_abyss: {
    present: true,
    title: '末班潮序',
    status: '涨潮',
    severity: 'warning',
    meter: { value: 1, max: 2 },
    targetReached: false,
    modifiers: chapterModifiersFixture(),
  },
  starfall_mine: {
    present: true,
    title: '重力极向',
    status: '下沉',
    severity: 'warning',
    targetReached: false,
    modifiers: chapterModifiersFixture(),
  },
  rust_hospital: {
    present: true,
    title: '锈疫污染',
    status: '污染 2/4',
    severity: 'warning',
    meter: { value: 2, max: 4 },
    targetReached: false,
    modifiers: chapterModifiersFixture(),
  },
};

const chapterDirectiveFixtures = {
  metro_abyss: {
    status: 'active',
    progressText: '2/3 已满足',
    rewardPreview: '灵蕴 x2',
    objectives: [
      { id: 'metro_low_damage', kind: 'low_damage', label: '承伤不超过 50', description: '本章承伤不超过 50。', completed: true, progressText: '当前满足' },
      { id: 'metro_no_item', kind: 'no_item', label: '不使用道具', description: '本章不使用道具。', completed: true, progressText: '当前满足' },
      { id: 'metro_equip', kind: 'equip', label: '携带指定装备', description: '携带指定装备进入。', completed: false, progressText: '0/1' },
    ],
  },
  starfall_mine: {
    status: 'active',
    progressText: '0/3 已满足',
    rewardPreview: '灵蕴 x2',
    objectives: [
      { id: 'mine_equip', kind: 'equip', label: '携带指定装备', description: '携带指定装备进入。', completed: false, progressText: '0/1' },
      { id: 'mine_method', kind: 'method', label: '使用指定功法', description: '使用指定功法通关。', completed: false, progressText: '0/1' },
      { id: 'mine_hidden', kind: 'hidden_clear', label: '完成隐藏目标', description: '完成本章隐藏目标。', completed: false, progressText: '未发现' },
    ],
  },
  rust_hospital: {
    status: 'active',
    progressText: '2/3 已满足',
    rewardPreview: '灵蕴 x3',
    objectives: [
      { id: 'rust_low_damage', kind: 'low_damage', label: '承伤不超过 60', description: '本章承伤不超过 60。', completed: true, progressText: '当前满足' },
      { id: 'rust_method', kind: 'method', label: '使用指定功法', description: '使用指定功法通关。', completed: false, progressText: '0/1' },
      { id: 'rust_no_item', kind: 'no_item', label: '不使用道具', description: '本章不使用道具。', completed: true, progressText: '当前满足' },
    ],
  },
};

function chapterRouteFixture(overrides = {}) {
  return {
    enabled: true,
    legacyDisabled: false,
    status: 'active',
    display: {
      key: 'pending_first',
      label: '契约进行中',
      detail: '先清理北线轨道游魂，再追至南站击碎船夫倒影，校正末班方向。',
    },
    name: '亡轨返潮',
    description: '先清理北线轨道游魂，再追至南站击碎船夫倒影，校正末班方向。',
    completedTargetCount: 0,
    totalTargetCount: 2,
    completedReadout: '0 / 2',
    orderedTargets: [
      { order: 1, nodeId: 'rail_patrol_wraith', nodeTitle: '轨道巡逻' },
      { order: 2, nodeId: 'tide_boatman_reflection', nodeTitle: '船夫倒影' },
    ],
    nextTarget: { order: 1, nodeId: 'rail_patrol_wraith', nodeTitle: '轨道巡逻' },
    potentialRewardPoints: 170,
    bankedRewardPoints: 0,
    ...overrides,
  };
}

const chapterRouteVariants = {
  metroFresh: chapterRouteFixture(),
  metroOneTarget: chapterRouteFixture({
    completedTargetCount: 1,
    completedReadout: '1 / 2',
    display: { key: 'pending_second', label: '契约进行中', detail: '继续前往南站击碎船夫倒影。' },
    nextTarget: { order: 2, nodeId: 'tide_boatman_reflection', nodeTitle: '船夫倒影' },
  }),
  metroTwoTarget: chapterRouteFixture({
    completedTargetCount: 2,
    completedReadout: '2 / 2',
    status: 'secured',
    display: { key: 'secured', label: '契约已保全', detail: '从本副本出口结算可获得 170 奖励点。' },
    nextTarget: undefined,
  }),
  metroFailed: chapterRouteFixture({
    completedTargetCount: 0,
    status: 'failed',
    display: { key: 'failed', label: '契约已失败', detail: '未按契约顺序完成目标。' },
    reason: 'out_of_order',
    nextTarget: undefined,
  }),
  metroDisabled: chapterRouteFixture({
    enabled: false,
    status: 'disabled',
    display: { key: 'disabled', label: '未接契约', detail: '未接取路线契约；按主线通关即可。' },
    name: undefined,
    description: undefined,
    orderedTargets: [],
    nextTarget: undefined,
    potentialRewardPoints: 0,
  }),
  starfallFresh: chapterRouteFixture({
    display: { key: 'pending_first', label: '契约进行中', detail: '先清除北壁火花巢，再下到西侧倒悬井解除坠落机关，重定矿井引力。' },
    name: '星巢倒井',
    description: '先清除北壁火花巢，再下到西侧倒悬井解除坠落机关，重定矿井引力。',
    orderedTargets: [
      { order: 1, nodeId: 'spark_imp_roost', nodeTitle: '跳火小鬼巢' },
      { order: 2, nodeId: 'inverted_shaft_trap', nodeTitle: '倒井坠落' },
    ],
    nextTarget: { order: 1, nodeId: 'spark_imp_roost', nodeTitle: '跳火小鬼巢' },
    potentialRewardPoints: 205,
  }),
  rustFresh: chapterRouteFixture({
    display: { key: 'pending_first', label: '契约进行中', detail: '先终止门诊勤务员巡查，再启动深层灭菌器，销毁污染病历。' },
    name: '病历焚净',
    description: '先终止门诊勤务员巡查，再启动深层灭菌器，销毁污染病历。',
    orderedTargets: [
      { order: 1, nodeId: 'plague_orderly', nodeTitle: '锈疫护工' },
      { order: 2, nodeId: 'sterilizer_trap', nodeTitle: '高温灭菌柜' },
    ],
    nextTarget: { order: 1, nodeId: 'plague_orderly', nodeTitle: '锈疫护工' },
    potentialRewardPoints: 240,
  }),
};

const chapterPressureFixtures = {
  stable: { legacyDisabled: false, present: true, tier: 'stable', label: '稳定', pressurePercent: 0, rewardBonusPercent: 15, nextTierAt: 6 },
  hunted: { legacyDisabled: false, present: true, tier: 'hunted', label: '追猎', pressurePercent: 10, rewardBonusPercent: 5, nextTierAt: 12 },
  breach: { legacyDisabled: false, present: true, tier: 'breach', label: '破界', pressurePercent: 20, rewardBonusPercent: 0, nextTierAt: null },
  legacy: { legacyDisabled: true, present: false },
};

function chapterPursuitFixture(overrides = {}) {
  return {
    legacyDisabled: false,
    present: true,
    name: '裂门蜕兽',
    status: 'dormant',
    statusLabel: '潜伏',
    statusDescription: '清理 6 个节点后，追兵将在矿脉苏醒。',
    flavorDescription: '它在矿脉深处蜕壳。',
    fusionDescription: '与首领融合后大幅强化首领。',
    contactDamagePercent: 15,
    bossFusionPercent: 50,
    rewardAmount: 1,
    progress: {
      active: false,
      currentNodeId: null,
      contacts: 0,
      graceMoves: 0,
      rewardGranted: false,
      repelledReason: null,
      clearedNodeCount: 0,
      spawnClearCount: 6,
      clearsRemaining: 6,
    },
    ...overrides,
  };
}

const chapterPursuitVariants = {
  metroDormant: chapterPursuitFixture({
    name: '镜潮尾影',
    statusDescription: '清理 6 个节点后，追兵将在废线轨道苏醒。',
  }),
  mineDormant: chapterPursuitFixture(),
  mineStalking: chapterPursuitFixture({
    status: 'stalking',
    statusLabel: '追猎中',
    statusDescription: '追兵正在沿地图追赶。',
    progress: {
      active: true,
      currentNodeId: 'molt_beast_patrol',
      contacts: 1,
      graceMoves: 1,
      rewardGranted: false,
      repelledReason: null,
      clearedNodeCount: 6,
      spawnClearCount: 6,
      clearsRemaining: 0,
    },
  }),
  rustDormant: chapterPursuitFixture({
    name: '锈疫巡诊者',
    statusDescription: '清理 6 个节点后，追兵将在病房走廊苏醒。',
  }),
};

function chapterDecisionFixture(dungeonId, overrides = {}) {
  const names = { metro_abyss: '地铁深渊', starfall_mine: '陨星矿坑', rust_hospital: '锈蚀医院' };
  const routes = {
    metro_abyss: chapterRouteVariants.metroFresh,
    starfall_mine: chapterRouteVariants.starfallFresh,
    rust_hospital: chapterRouteVariants.rustFresh,
  };
  const pursuits = {
    metro_abyss: chapterPursuitVariants.metroDormant,
    starfall_mine: chapterPursuitVariants.mineDormant,
    rust_hospital: chapterPursuitVariants.rustDormant,
  };
  return {
    dungeonId,
    dungeonName: names[dungeonId],
    law: chapterLawFixtures[dungeonId],
    directive: chapterDirectiveFixtures[dungeonId],
    routeContract: routes[dungeonId],
    pressure: chapterPressureFixtures.stable,
    pursuit: pursuits[dungeonId],
    ...overrides,
  };
}

const CHAPTER_SECTION_KINDS = ['law', 'directive', 'route', 'pressure', 'pursuit'];
for (const dungeonId of ['metro_abyss', 'starfall_mine', 'rust_hospital']) {
  const decisionInput = chapterDecisionFixture(dungeonId);
  const decisionSnapshot = JSON.stringify(decisionInput);
  const readout = formatInfiniteFlowChapterDecision(decisionInput);
  assert.equal(readout.dungeonId, dungeonId);
  assert.ok(readout.dungeonName.length > 0);
  assert.deepEqual(
    readout.sections.map((section) => section.kind),
    CHAPTER_SECTION_KINDS,
    `${dungeonId} sections stay ordered`,
  );
  for (const section of readout.sections) {
    assert.ok(section.title.length > 0, `${dungeonId} ${section.kind} title`);
    for (const line of section.lines) {
      assert.ok(line.length > 0, `${dungeonId} ${section.kind} empty line`);
      assert.ok(!line.includes('undefined'), `${dungeonId} ${section.kind} undefined in: ${line}`);
    }
    if (section.note !== undefined) {
      assert.ok(!section.note.includes('undefined'), `${dungeonId} ${section.kind} note`);
    }
  }
  assert.equal(readout.sections[0].helpId, 'law');
  assert.equal(readout.sections[1].helpId, 'directive');
  assert.equal(readout.sections[2].helpId, undefined, 'route contract has no help ID');
  assert.ok(readout.sections[2].note.length > 0, 'route contract exposes VM explanation');
  assert.equal(readout.sections[3].helpId, 'pressure');
  assert.equal(readout.sections[4].helpId, 'pursuit');
  const visibleChapterText = readout.sections.flatMap((section) => [
    section.title,
    ...section.lines,
    ...(section.note === undefined ? [] : [section.note]),
  ]).join('\n');
  assert.doesNotMatch(
    visibleChapterText,
    /\b(?:stable|warning|danger|resolved|locked|active|completed|failed|hunted|breach|disabled|dormant|stalking|contained|fused|repelled|pending_first|pending_second|unknown)\b|key=/iu,
    `${dungeonId} chapter formatter exposes no raw enum`,
  );
  const chapterInternalIds = [
    decisionInput.dungeonId,
    ...decisionInput.routeContract.orderedTargets.map(({ nodeId }) => nodeId),
    decisionInput.routeContract.nextTarget?.nodeId,
    decisionInput.pursuit.progress?.currentNodeId,
  ].filter((value) => typeof value === 'string' && value.length > 0);
  for (const internalId of chapterInternalIds) {
    assert.equal(visibleChapterText.includes(internalId), false, `${dungeonId} hides internal ID ${internalId}`);
  }
  assert.equal(JSON.stringify(decisionInput), decisionSnapshot, `${dungeonId} chapter formatter leaves VM input untouched`);
}

const metroReadout = formatInfiniteFlowChapterDecision(chapterDecisionFixture('metro_abyss'));
const metroLawText = metroReadout.sections[0].lines.join('\n');
assert.match(metroLawText, /末班潮序/);
assert.match(metroLawText, /涨潮/);
assert.match(metroLawText, /严重度 警戒/);
assert.doesNotMatch(metroLawText, /warning/);
assert.match(metroLawText, /计量 1\/2/);
assert.match(metroLawText, /目标 未达成/);
assert.match(metroLawText, /全属性-10%/);
assert.match(metroLawText, /治疗-20%/);
assert.match(metroLawText, /守御-10%/);

const mineLawText = formatInfiniteFlowChapterDecision(chapterDecisionFixture('starfall_mine')).sections[0].lines.join('\n');
assert.match(mineLawText, /重力极向/);
assert.doesNotMatch(mineLawText, /计量/, 'starfall law has no meter in the VM');

const rustLawText = formatInfiniteFlowChapterDecision(chapterDecisionFixture('rust_hospital')).sections[0].lines.join('\n');
assert.match(rustLawText, /锈疫污染/);
assert.match(rustLawText, /计量 2\/4/);
for (const [severity, label] of [['stable', '稳定'], ['warning', '警戒'], ['danger', '危险'], ['resolved', '已解除']]) {
  const text = formatInfiniteFlowChapterDecision(chapterDecisionFixture('metro_abyss', {
    law: { ...chapterLawFixtures.metro_abyss, severity },
  })).sections[0].lines.join('\n');
  assert.match(text, new RegExp(`严重度 ${label}`));
  assert.doesNotMatch(text, new RegExp(`\\b${severity}\\b`, 'iu'));
}

const metroDirectiveText = metroReadout.sections[1].lines.join('\n');
assert.match(metroDirectiveText, /状态 进行中 · 2\/3 已满足/);
assert.match(metroDirectiveText, /✓ 承伤不超过 50 · 当前满足/);
assert.match(metroDirectiveText, /· 携带指定装备 · 0\/1/);
assert.match(metroDirectiveText, /奖励 灵蕴 x2/);
for (const [status, label] of [['locked', '未解锁'], ['active', '进行中'], ['completed', '已完成'], ['failed', '已失败']]) {
  const text = formatInfiniteFlowChapterDecision(chapterDecisionFixture('metro_abyss', {
    directive: { ...chapterDirectiveFixtures.metro_abyss, status },
  })).sections[1].lines.join('\n');
  assert.match(text, new RegExp(`状态 ${label}`));
  assert.doesNotMatch(text, new RegExp(`\\b${status}\\b`, 'iu'));
}

function routeText(route) {
  return formatInfiniteFlowChapterDecision({
    ...chapterDecisionFixture('metro_abyss'),
    routeContract: route,
  }).sections[2].lines.join('\n');
}
assert.match(routeText(chapterRouteVariants.metroFresh), /0 \/ 2/);
assert.match(routeText(chapterRouteVariants.metroFresh), /状态 契约进行中/);
assert.doesNotMatch(routeText(chapterRouteVariants.metroFresh), /pending_first/);
assert.match(routeText(chapterRouteVariants.metroFresh), /1 轨道巡逻 → 2 船夫倒影/);
assert.match(routeText(chapterRouteVariants.metroFresh), /下一目标 1 轨道巡逻/);
assert.match(routeText(chapterRouteVariants.metroFresh), /\+170/);
assert.match(routeText(chapterRouteVariants.metroFresh), /已存 \+0/);
assert.match(routeText(chapterRouteVariants.metroOneTarget), /1 \/ 2/);
assert.doesNotMatch(routeText(chapterRouteVariants.metroOneTarget), /pending_second/);
assert.match(routeText(chapterRouteVariants.metroOneTarget), /下一目标 2 船夫倒影/);
assert.match(routeText(chapterRouteVariants.metroTwoTarget), /2 \/ 2/);
assert.match(routeText(chapterRouteVariants.metroTwoTarget), /契约已保全/);
assert.doesNotMatch(routeText(chapterRouteVariants.metroTwoTarget), /secured/);
assert.match(routeText(chapterRouteVariants.metroTwoTarget), /下一目标 无/);
assert.match(routeText(chapterRouteVariants.metroFailed), /契约已失败/);
assert.match(routeText(chapterRouteVariants.metroFailed), /原因 未按契约顺序完成/);
assert.doesNotMatch(routeText(chapterRouteVariants.metroFailed), /failed|out_of_order/);
assert.doesNotMatch(routeText(chapterRouteVariants.metroDisabled), /disabled/);
assert.match(routeText(chapterRouteVariants.metroDisabled), /目标 未接契约/);
assert.match(routeText(chapterRouteVariants.starfallFresh), /1 跳火小鬼巢 → 2 倒井坠落/);
assert.match(routeText(chapterRouteVariants.starfallFresh), /\+205/);
assert.match(routeText(chapterRouteVariants.rustFresh), /1 锈疫护工 → 2 高温灭菌柜/);
assert.match(routeText(chapterRouteVariants.rustFresh), /\+240/);

function pressureText(pressure) {
  return formatInfiniteFlowChapterDecision({
    ...chapterDecisionFixture('metro_abyss'),
    pressure,
  }).sections[3].lines.join('\n');
}
assert.match(pressureText(chapterPressureFixtures.stable), /段位 稳定/);
assert.match(pressureText(chapterPressureFixtures.stable), /侵蚀 0%/);
assert.match(pressureText(chapterPressureFixtures.stable), /\+15%/);
assert.match(pressureText(chapterPressureFixtures.stable), /6 节点/);
assert.match(pressureText(chapterPressureFixtures.hunted), /段位 追猎/);
assert.match(pressureText(chapterPressureFixtures.hunted), /侵蚀 10%/);
assert.match(pressureText(chapterPressureFixtures.hunted), /\+5%/);
assert.match(pressureText(chapterPressureFixtures.hunted), /12 节点/);
assert.match(pressureText(chapterPressureFixtures.breach), /段位 破界/);
assert.match(pressureText(chapterPressureFixtures.breach), /侵蚀 20%/);
assert.match(pressureText(chapterPressureFixtures.breach), /\+0%/);
assert.match(pressureText(chapterPressureFixtures.breach), /下一段位 无/);
assert.match(pressureText(chapterPressureFixtures.legacy), /旧档禁用/);
for (const [tier, label] of [['stable', '稳定'], ['hunted', '追猎'], ['breach', '破界']]) {
  const text = pressureText({ ...chapterPressureFixtures[tier], label: tier });
  assert.match(text, new RegExp(`段位 ${label}`));
  assert.doesNotMatch(text, new RegExp(`\\b${tier}\\b`, 'iu'));
}
assert.match(
  pressureText({ legacyDisabled: false, present: true, tier: 'stable' }),
  /侵蚀 未知 · 出口加成 未知.*下一段位 未知/s,
  'missing pressure values stay unknown rather than becoming zero or no-next-tier',
);

function pursuitText(pursuit) {
  return formatInfiniteFlowChapterDecision({
    ...chapterDecisionFixture('starfall_mine'),
    pursuit,
  }).sections[4].lines.join('\n');
}
assert.match(pursuitText(chapterPursuitVariants.mineDormant), /裂门蜕兽/);
assert.match(pursuitText(chapterPursuitVariants.mineDormant), /状态 潜伏/);
assert.doesNotMatch(pursuitText(chapterPursuitVariants.mineDormant), /dormant/);
assert.match(pursuitText(chapterPursuitVariants.mineDormant), /距苏醒 6 节点/);
assert.match(pursuitText(chapterPursuitVariants.mineStalking), /追猎中/);
assert.doesNotMatch(pursuitText(chapterPursuitVariants.mineStalking), /stalking|molt_beast_patrol/);
assert.match(pursuitText(chapterPursuitVariants.mineStalking), /追兵位置已锁定/);
assert.match(pursuitText(chapterPursuitVariants.mineStalking), /接触 1/);
assert.match(pursuitText(chapterPursuitVariants.mineStalking), /活跃 是/);
assert.match(pursuitText(chapterPursuitVariants.metroDormant), /镜潮尾影/);
assert.match(pursuitText(chapterPursuitVariants.rustDormant), /锈疫巡诊者/);
for (const [status, label] of [
  ['disabled', '未启用'],
  ['dormant', '潜伏'],
  ['stalking', '追猎中'],
  ['contained', '已封锁'],
  ['fused', '已融合'],
  ['repelled', '已击退'],
]) {
  const text = pursuitText(chapterPursuitFixture({ status, statusLabel: undefined }));
  assert.match(text, new RegExp(`状态 ${label}`));
  assert.doesNotMatch(text, new RegExp(`\\b${status}\\b`, 'iu'));
}

const lawAbsentText = formatInfiniteFlowChapterDecision(chapterDecisionFixture('metro_abyss', {
  law: {
    ...chapterLawFixtures.metro_abyss,
    present: false,
    title: '场域律动缺失',
    status: '本轮未记录场域律',
    modifiers: chapterModifiersFixture({
      encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
      trap: { damagePercent: 0, dcPercent: 0 },
      healingPercent: 0,
      outgoingDamage: { forcePercent: 0, artPercent: 0 },
      guardEffectPercent: 0,
    }),
  },
})).sections[0].lines.join('\n');
assert.match(lawAbsentText, /本轮未记录场域律/);
assert.doesNotMatch(lawAbsentText, /遭遇|陷阱|出伤|[+-]0%/, 'missing law never presents zero modifiers as confirmed');

const fallbackRoute = chapterRouteFixture({
  orderedTargets: [{ order: 1, nodeId: 'raw_node_id', nodeTitle: 'raw_node_id' }],
  nextTarget: { order: 1, nodeId: 'raw_node_id', nodeTitle: 'raw_node_id' },
  reason: 'unexpected_reason',
});
assert.doesNotMatch(routeText(fallbackRoute), /raw_node_id|unexpected_reason|pending_first/);
assert.match(routeText(fallbackRoute), /目标已标记.*原因未知/s);

const fallbackPursuit = chapterPursuitFixture({
  status: 'repelled',
  statusLabel: 'repelled',
  statusDescription: 'unknown',
  contactDamagePercent: undefined,
  bossFusionPercent: undefined,
  rewardAmount: undefined,
  progress: {
    ...chapterPursuitFixture().progress,
    active: false,
    currentNodeId: 'internal_node_id',
    repelledReason: 'unexpected_reason',
  },
});
const fallbackPursuitText = pursuitText(fallbackPursuit);
assert.match(fallbackPursuitText, /状态 已击退.*被追上即迎战.*原因 未知/s);
assert.doesNotMatch(fallbackPursuitText, /repelled|unknown|internal_node_id|unexpected_reason|\b0%\b/iu);

// Combat chapter context: compact law + pursuit readout for the combat status panel.
function combatChapterContextFixture(overrides = {}) {
  return {
    dungeonId: 'metro_abyss',
    dungeonName: '镜潮地铁',
    law: {
      present: true,
      title: '末班潮序',
      status: '涨潮',
      severity: 'warning',
      meter: { value: 1, max: 2 },
      modifiers: {
        enemyAllStatsPercent: -10,
        enemyDefensePercent: 0,
        enemyArtPowerPercent: 0,
        outgoingForcePercent: 0,
        outgoingArtPercent: 0,
        healingPercent: -20,
        guardEffectPercent: -10,
      },
    },
    pursuit: {
      legacyDisabled: false,
      present: true,
      name: '镜潮尾影',
      status: 'dormant',
      statusLabel: '潜伏',
      contactDamagePercent: 15,
      bossFusionPercent: 15,
    },
    ...overrides,
  };
}

const combatContextReadout = formatInfiniteFlowCombatChapterContext(combatChapterContextFixture());
assert.ok(combatContextReadout.lawLine.length > 0, 'combat context law line');
assert.match(combatContextReadout.lawLine, /场域 末班潮序 涨潮/);
assert.match(combatContextReadout.lawLine, /1\/2/, 'combat context law meter');
assert.match(combatContextReadout.lawLine, /敌-10%/, 'combat context enemy modifier');
assert.equal(
  combatContextReadout.pursuitLine,
  undefined,
  'dormant pursuit produces no pursuit line',
);

const stalkingContext = formatInfiniteFlowCombatChapterContext(combatChapterContextFixture({
  pursuit: {
    legacyDisabled: false,
    present: true,
    name: '镜潮尾影',
    status: 'stalking',
    statusLabel: '追猎中',
    contactDamagePercent: 15,
    bossFusionPercent: 15,
  },
}));
assert.ok(stalkingContext.pursuitLine, 'stalking pursuit produces a pursuit line');
assert.match(stalkingContext.pursuitLine, /追兵 镜潮尾影 追猎中/);
assert.match(stalkingContext.pursuitLine, /追上即战/);
assert.doesNotMatch(stalkingContext.pursuitLine, /融合/, 'stalking (not fused) shows no fusion');

const fusedContext = formatInfiniteFlowCombatChapterContext(combatChapterContextFixture({
  pursuit: {
    legacyDisabled: false,
    present: true,
    name: '镜潮尾影',
    status: 'fused',
    statusLabel: '已融合',
    contactDamagePercent: 15,
    bossFusionPercent: 15,
  },
}));
assert.match(fusedContext.pursuitLine, /融合15%/, 'fused pursuit shows fusion percent');

const lawlessContext = formatInfiniteFlowCombatChapterContext(combatChapterContextFixture({
  law: {
    present: false,
    title: '场域律动缺失',
    status: '本轮未记录场域律',
    severity: 'stable',
    modifiers: {
      enemyAllStatsPercent: 0,
      enemyDefensePercent: 0,
      enemyArtPowerPercent: 0,
      outgoingForcePercent: 0,
      outgoingArtPercent: 0,
      healingPercent: 0,
      guardEffectPercent: 0,
    },
  },
}));
assert.match(lawlessContext.lawLine, /场域 场域律动缺失 本轮未记录场域律/);
assert.doesNotMatch(lawlessContext.lawLine, /敌/, 'lawless context shows no enemy modifier');

const noPursuitContext = formatInfiniteFlowCombatChapterContext(combatChapterContextFixture({
  pursuit: { legacyDisabled: false, present: false },
}));
assert.equal(noPursuitContext.pursuitLine, undefined, 'absent pursuit produces no pursuit line');

// Rendering: the real View pages all five surfaces beside the preserved map,
// current node, equipment-memory card, and action deck.
const chapterHelpEntries = ['law', 'directive', 'pressure', 'pursuit'].map((id) => ({
  id,
  title: id,
  summary: `${id} summary`,
  mechanic: `${id} mechanic`,
  guidance: `${id} guidance`,
  readout: `${id} readout`,
  keywords: [],
  openAction: {
    actionId: `help.open:${id}`,
    event: { kind: 'local', action: { type: 'help/open', helpId: id } },
  },
}));

const exploreActionFixtures = [
  {
    actionId: 'map.move:east-hall', label: '前往东侧大厅', placement: 'map',
    enabled: true, emphasis: 'secondary', recommendation: 'neutral',
    event: { kind: 'command', command: { type: 'run/move', nodeId: 'east_hall' } },
  },
  {
    actionId: 'soul-recharge.activate:fixture', label: '开启器魂共鸣台', placement: 'node',
    enabled: true, emphasis: 'secondary', recommendation: 'recommended',
    event: { kind: 'command', command: { type: 'node/activate-soul-recharge' } },
  },
  {
    actionId: 'node.exit:sealed-exit', label: '出口结算', placement: 'node',
    enabled: false, emphasis: 'secondary', recommendation: 'neutral',
    disabledReason: '需要先完成当前节点事件。',
  },
  {
    actionId: 'run.retreat', label: '撤回主神空间', placement: 'advanced',
    enabled: true, emphasis: 'danger', recommendation: 'high-risk',
    riskReason: '撤退会按当前固化进度损失部分或全部未结算战利品。',
    event: { kind: 'command', command: { type: 'run/retreat' } },
  },
];

function exploreDeckActionFixture(index) {
  const sequence = index + 1;
  const variant = index % 13;
  let actionId;
  let label;
  let placement = 'node';
  let command;
  let readout = '确认当前探索选择。';
  let emphasis = 'secondary';
  let recommendation = 'neutral';
  if (variant === 0) {
    actionId = `map.move:route-${sequence}`;
    label = `前往相邻区域 ${sequence}`;
    placement = 'map';
    command = { type: 'run/move', nodeId: `route_node_${sequence}` };
    readout = '前往可达的相邻区域。';
  } else if (variant === 1) {
    actionId = `pending.equipment:offer-${sequence}:take`;
    label = `取走装备 ${sequence}`;
    command = { type: 'node/resolve-equipment-loot', equipmentId: `equipment_${sequence}` };
    readout = '处理本次装备掉落。';
  } else if (variant === 2) {
    actionId = `pending.relic:draft-${sequence}:relic-${sequence}`;
    label = `选择回响 ${sequence}`;
    command = { type: 'node/resolve-relic-draft', relicId: `relic_${sequence}`, draftId: `draft_${sequence}` };
    readout = '选择一件本局回响后继续。';
  } else if (variant === 3) {
    actionId = `pending.soul-recharge:skill-${sequence}`;
    label = `恢复器魂 ${sequence}`;
    command = { type: 'node/resolve-soul-recharge', skillId: `skill_${sequence}` };
    readout = '恢复一项已消耗的器魂能力。';
  } else if (variant === 4) {
    actionId = `pending.event:event-${sequence}:choice-${sequence}`;
    label = `处理遭遇 ${sequence}`;
    command = { type: 'node/resolve-event', eventId: `event_${sequence}`, optionId: `option_${sequence}` };
    readout = '选择当前遭遇的处理方式。';
  } else if (variant === 5) {
    actionId = `pending.field-survey:choice-${sequence}`;
    label = `选择铭刻分支 ${sequence}`;
    command = { type: 'node/resolve-field-survey', optionId: `survey_${sequence}` };
    readout = '选择铭刻分支或普通领取。';
  } else if (variant === 6) {
    actionId = `law.causal_ledger:balance-${sequence}`;
    label = `平衡因果 ${sequence}`;
    command = { type: 'law/resolve-causal-ledger', choice: 'balance' };
    readout = '选择当前章规的处理方式。';
  } else if (variant === 7) {
    actionId = `node.select:enemy-${sequence}`;
    label = `迎战敌人 ${sequence}`;
    command = { type: 'run/select-node', nodeId: `enemy_node_${sequence}` };
    readout = '进入当前战斗。';
    emphasis = 'primary';
    recommendation = 'recommended';
  } else if (variant === 8) {
    actionId = `node.trap:trap-${sequence}:risk`;
    label = `强行通过陷阱 ${sequence}`;
    command = { type: 'node/handle-trap', choice: 'risk' };
    readout = '失败可能承受伤害。';
    emphasis = 'danger';
    recommendation = 'high-risk';
  } else if (variant === 9) {
    actionId = `node.portal:portal-${sequence}:force`;
    label = `强闯传送门 ${sequence}`;
    command = { type: 'node/use-portal', choice: 'force' };
    readout = '强闯会承受传送反噬。';
    emphasis = 'danger';
    recommendation = 'high-risk';
  } else if (variant === 10) {
    actionId = `node.reward:reward-${sequence}`;
    label = `领取节点奖励 ${sequence}`;
    command = { type: 'node/collect-reward' };
    readout = '收取当前节点奖励。';
    emphasis = 'primary';
    recommendation = 'recommended';
  } else if (variant === 11) {
    actionId = `node.exit:exit-${sequence}`;
    label = `出口结算 ${sequence}`;
    command = { type: 'run/resolve-exit' };
    readout = '结束探索并进入结算。';
    emphasis = 'primary';
    recommendation = 'recommended';
  } else {
    actionId = `run.retreat:${sequence}`;
    label = `撤回主神空间 ${sequence}`;
    placement = 'advanced';
    command = { type: 'run/retreat' };
    readout = '结束本轮探索并按撤退规则结算。';
    emphasis = 'danger';
    recommendation = 'high-risk';
  }
  const event = Object.freeze({ kind: 'command', command: Object.freeze(command) });
  return Object.freeze({
    actionId,
    label,
    placement,
    enabled: true,
    emphasis,
    recommendation,
    readout,
    event,
  });
}

const exploreDeckActions31 = Object.freeze(
  Array.from({ length: 31 }, (_, index) => exploreDeckActionFixture(index)),
);

const memoryHuntFixture = {
  helpId: 'equipmentMemory',
  compatibility: 'current-legacy-hunt',
  enabled: true,
  legacyDisabled: false,
  malformedDisabled: false,
  display: { key: 'active', label: '狩猎进行中', detail: '两个信号必须在同一局完成。' },
  memory: { memoryId: 'metro_memory', name: '地铁回声', description: 'fixture' },
  equipment: { equipmentId: 'armor_piercing_sword', name: '破甲剑' },
  frozenAttunement: { attunementId: 'armor_piercing_sword:edge', name: '裂锋铭刻' },
  signals: [
    { type: 'node', label: '目标节点', targetId: 'rail_patrol_wraith', targetName: '轨道巡逻', completed: true },
    { type: 'event', label: '目标事件', targetId: 'last_train_event', targetName: '事件 ID · last_train_event', completed: false },
  ],
  completedConditionCount: 1,
  totalConditionCount: 2,
  nextTarget: { kind: 'event', label: '事件 ID · last_train_event' },
};

function exploreModel(decision, options = {}) {
  const actions = options.actions === undefined
    ? [...exploreActionFixtures]
    : [...options.actions];
  let pending;
  if (options.pending) {
    const entered = reduceGameCommand(createInitialState(), {
      type: 'run/enter', dungeonId: DUNGEON_ORDER[0], protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 },
    });
    assert.equal(entered.status, 'committed', 'equipment UI fixture enters an actual run');
    const projected = buildActualGameViewModel({ ...entered.state, run: { ...entered.state.run,
      pendingEquipmentOffer: { offerId: 'ui-fixture', equipmentIds: ['armor_piercing_sword'] },
    } }, {}).sections[1].detail.pending;
    pending = {
      kind: 'equipment-offer',
      title: '装备供奉',
      message: '节点遗留的装备，二选一。',
      actionIds: ['pending.equipment:offer-1:take'],
      equipmentOptions: [{ ...projected.equipmentOptions[0], actionId: 'pending.equipment:offer-1:take' }],
    };
    actions.push({
      actionId: 'pending.equipment:offer-1:take',
      label: '获取装备',
      placement: 'node',
      enabled: true,
      emphasis: 'primary',
      recommendation: 'recommended',
      event: { kind: 'command', command: { type: 'node/resolve-equipment-loot', equipmentId: 'armor_piercing_sword' } },
    });
  }
  return {
    schemaVersion: 1,
    phase: 'explore',
    screenTitle: options.screenTitle ?? `探索 · ${decision?.dungeonName ?? '未记录章规'}`,
    dispatchPolicy: 'one-event-per-action',
    tasks: [],
    sections: [
      { kind: 'objective', title: '探索', summary: '清理节点并抵达出口。' },
      {
        kind: 'status',
        metrics: [
          { id: 'hp', label: '生命', value: '42/60', symbol: '♥', severity: 'warning' },
          { id: 'loot', label: '袋中奖励点', value: '85', symbol: '袋', severity: 'positive' },
          { id: 'cleared', label: '已清理', value: '2/9', symbol: '✓', severity: 'neutral' },
          { id: 'pressure', label: '侵蚀', value: '稳定', symbol: '侵', severity: 'neutral' },
          { id: 'boss-seal', label: '出口封印', value: '0/1 未解除', symbol: '锁', severity: 'warning' },
          { id: 'law', label: '妖雾压境', value: '雾压0/3', symbol: '律', severity: 'warning' },
        ],
        detail: {
          kind: 'explore',
          map: options.map ?? {
            dungeonId: decision?.dungeonId ?? 'metro_abyss',
            dungeonName: decision?.dungeonName ?? '地铁深渊',
            width: 3,
            height: 3,
            currentNodeId: 'rail_patrol_wraith',
            knownEdges: [['0,0', '1,0']],
            nodes: [
              { cellId: '0,0', nodeId: 'rail_patrol_wraith', title: '轨道巡逻', nodeType: 'combat', state: 'current', stateLabel: '当前位置', stateSymbol: '◎', x: 0, y: 0, isAdjacent: false, canMove: false },
              { cellId: '1,0', nodeId: 'east_hall', title: '东侧大厅', nodeType: 'event', state: 'adjacent', stateLabel: '相邻可达', stateSymbol: '→', x: 1, y: 0, isAdjacent: true, canMove: true, moveActionId: 'map.move:east-hall' },
              { cellId: '0,1', nodeId: 'south_tunnel', title: '南侧隧道', nodeType: 'treasure', state: 'fogged', stateLabel: '迷雾未知', stateSymbol: '?', x: 0, y: 1, isAdjacent: false, canMove: false },
            ],
          },
          currentNode: options.currentNode ?? {
            nodeId: 'rail_patrol_wraith',
            title: '轨道巡逻',
            nodeType: 'combat',
            description: '游魂在轨道上徘徊。',
            cleared: false,
          },
          ...(decision === undefined ? {} : { chapterDecision: decision }),
          ...(options.memoryHunt === undefined ? {} : { equipmentMemoryHunt: options.memoryHunt }),
          ...(pending === undefined ? {} : { pending }),
        },
      },
      { kind: 'actions', actions },
      { kind: 'risks', items: [] },
      { kind: 'help', entries: options.helpEntries ?? chapterHelpEntries },
      { kind: 'logs', lines: ['你进入了地铁深渊。'] },
    ],
  };
}

// Explore compass is a pure four-neighbour projection. Fog never contributes
// identity, title, type, or even a malformed revealing stateSymbol.
const compassMapFixture = {
  dungeonId: 'metro_abyss',
  dungeonName: '地铁深渊',
  width: 5,
  height: 5,
  currentNodeId: 'center_internal_id',
  nodes: [
    { nodeId: 'center_internal_id', title: '中央站', nodeType: 'event', state: 'current', stateSymbol: 'CENTER_SECRET', x: 2, y: 2 },
    { nodeId: 'north_internal_id', title: '北站', nodeType: 'event', state: 'cleared', stateSymbol: '✓', x: 2, y: 1 },
    { nodeId: 'fog_secret_node', title: '绝密首领', nodeType: 'exit', state: 'fogged', stateSymbol: 'SECRET', x: 3, y: 2 },
    { nodeId: 'south_internal_id', title: '南站', nodeType: 'trap', state: 'available', stateSymbol: '·', x: 2, y: 3 },
    { nodeId: 'west_internal_id', title: '西站', nodeType: 'monster', state: 'adjacent', stateSymbol: '→', x: 1, y: 2 },
    { nodeId: 'remote_secret_node', title: '远程隐藏', nodeType: 'reward', state: 'available', stateSymbol: '★', x: 4, y: 4 },
  ],
};
const compassSnapshot = JSON.stringify(compassMapFixture);
const compassReadout = formatInfiniteFlowExploreCompass(compassMapFixture);
assert.equal(compassReadout.projectionValid, true);
assert.equal(compassReadout.centerSymbol, '◎');
assert.deepEqual(
  compassReadout.directions.map(({ direction, symbol }) => [direction, symbol]),
  [['north', '✓'], ['east', '?'], ['south', '·'], ['west', '→']],
);
assert.doesNotMatch(
  JSON.stringify(compassReadout),
  /SECRET|internal_id|绝密首领|exit|remote/,
  'compass exposes only immediate state symbols and fog-safe ?',
);
assert.equal(JSON.stringify(compassMapFixture), compassSnapshot, 'compass formatter leaves map VM untouched');

const noMemoryCodexDetail = exploreModel(chapterDecisionFixture('metro_abyss')).sections[1].detail;
const noMemoryCodexPages = buildInfiniteFlowChapterCodexPages(noMemoryCodexDetail);
assert.equal(noMemoryCodexPages.length, 5, 'normal chapter decision has exactly five logical pages');
assert.deepEqual(noMemoryCodexPages.map(({ source }) => source), CHAPTER_SECTION_KINDS);

const memoryCodexDetail = exploreModel(chapterDecisionFixture('metro_abyss'), {
  memoryHunt: memoryHuntFixture,
}).sections[1].detail;
const memoryCodexSnapshot = JSON.stringify(memoryCodexDetail);
const memoryCodexPages = buildInfiniteFlowChapterCodexPages(memoryCodexDetail);
assert.equal(memoryCodexPages.length, 6, 'equipment memory precedes the five chapter pages');
assert.deepEqual(memoryCodexPages.map(({ source }) => source), ['equipment-memory', ...CHAPTER_SECTION_KINDS]);
assert.equal(memoryCodexPages[0].helpId, 'equipmentMemory', 'memory help comes from the projected hunt');
assert.equal(JSON.stringify(memoryCodexDetail), memoryCodexSnapshot, 'codex builder leaves the detail VM untouched');

const memoryWithoutAuthoritativeHelp = {
  ...memoryCodexDetail,
  equipmentMemoryHunt: { ...memoryCodexDetail.equipmentMemoryHunt },
};
delete memoryWithoutAuthoritativeHelp.equipmentMemoryHunt.helpId;
assert.equal(
  buildInfiniteFlowChapterCodexPages(memoryWithoutAuthoritativeHelp)[0].helpId,
  undefined,
  'memory page never invents an equipmentMemory help ID',
);

const decisionReadoutForReachability = formatInfiniteFlowChapterDecision(memoryCodexDetail.chapterDecision);
for (const section of decisionReadoutForReachability.sections) {
  const visible = memoryCodexPages
    .filter(({ source }) => source === section.kind)
    .flatMap(({ lines }) => lines)
    .join('');
  for (const line of section.lines) {
    assert.ok(visible.includes(line), `${section.kind} logical line remains reachable after wrapping`);
  }
  if (section.note !== undefined) {
    assert.ok(visible.includes(`章规说明：${section.note}`), `${section.kind} note remains reachable after wrapping`);
  }
}

const longRouteNote = '先听见轨道尽头的三次钟声，再沿着消失的灯带穿过长廊，最后在潮水退去前完成契约。'.repeat(6);
const longRouteDecision = chapterDecisionFixture('metro_abyss', {
  routeContract: chapterRouteFixture({
    display: { key: 'pending_first', label: '契约进行中', detail: longRouteNote },
  }),
});
const longRoutePages = buildInfiniteFlowChapterCodexPages(
  exploreModel(longRouteDecision).sections[1].detail,
).filter(({ source }) => source === 'route');
assert.ok(longRoutePages.length > 1, 'long route content uses reachable continuation pages');
assert.equal(
  longRoutePages.flatMap(({ lines }) => lines).join('').includes(`章规说明：${longRouteNote}`),
  true,
  'long route note loses no glyphs across continuation pages',
);
assert.deepEqual(
  longRoutePages.map(({ continuation }) => continuation),
  Array.from({ length: longRoutePages.length }, (_, index) => index + 1),
  'continuation order is stable',
);

function hubFixtureAction(actionId, label, event, overrides = {}) {
  return {
    actionId,
    label,
    placement: 'preparation',
    enabled: true,
    emphasis: 'secondary',
    recommendation: 'neutral',
    readout: '仅更新祭坛选择；确认前不会进入副本。',
    ...(event === undefined ? {} : { event }),
    ...overrides,
  };
}

const HUB_FIXTURE_PANEL_LABELS = Object.freeze({
  entry: '入场',
  supplies: '物资与携行',
  equipment: '装备工坊',
  pets: '灵宠',
  methods: '功法',
  bloodlines: '血统',
  companions: '同伴',
  tasks: '任务',
});

const HUB_CATALOG_FIXTURE_ACTION_IDS = Object.freeze({
  supplies: Object.freeze([
    'hub.supplies.select:previous',
    'hub.supplies.select:next',
    'hub.supplies.buy:fixture',
    'hub.supplies.toggle:fixture',
    'hub.loadout.current',
    'hub.loadout.chapter-one',
    'hub.recover',
  ]),
  equipment: Object.freeze([
    'hub.equipment.select:previous',
    'hub.equipment.select:next',
    'hub.equipment.buy:fixture',
    'hub.equipment.equip:fixture',
    'hub.equipment.upgrade:fixture',
    'hub.equipment.attune:fixture:none',
    'hub.equipment.temper:fixture',
    'hub.equipment.commission.start',
    'hub.equipment.memory.cycle',
    'hub.equipment.commission.toggle:fixture',
    'hub.equipment.commission.material',
    'hub.equipment.commission.recall',
  ]),
  pets: Object.freeze([
    'hub.pets.select:previous',
    'hub.pets.select:next',
    'hub.pets.buy:fixture',
    'hub.pets.upgrade:fixture',
    'hub.pets.activate:fixture',
  ]),
  methods: Object.freeze([
    'hub.methods.select:previous',
    'hub.methods.select:next',
    'hub.methods.learn:fixture',
    'hub.methods.upgrade:fixture',
    'hub.methods.activate:fixture',
  ]),
  bloodlines: Object.freeze([
    'hub.bloodlines.select:previous',
    'hub.bloodlines.select:next',
    'hub.bloodlines.unlock:fixture',
    'hub.bloodlines.upgrade:fixture',
    'hub.bloodlines.activate:fixture',
  ]),
  companions: Object.freeze([
    'hub.companions.select:previous',
    'hub.companions.select:next',
    'hub.companions.recruit:fixture',
    'hub.companions.upgrade:fixture',
    'hub.companions.activate:fixture',
  ]),
  tasks: Object.freeze([
    'hub.tasks.select:previous',
    'hub.tasks.select:next',
    'hub.tasks.claim:fixture',
  ]),
});

const HUB_CATALOG_FIXTURE_COUNTS = Object.freeze({
  supplies: 14,
  equipment: 19,
  pets: 12,
  methods: 12,
  bloodlines: 12,
  companions: 12,
  tasks: 10,
});

function hubCatalogActionFixtures(panel) {
  const panelActions = HUB_CATALOG_FIXTURE_ACTION_IDS[panel];
  assert.ok(panelActions, `${panel} fixture blueprint exists`);
  const panelLabel = HUB_FIXTURE_PANEL_LABELS[panel];
  const actions = panelActions.map((actionId, index) => hubFixtureAction(
    actionId,
    `${panelLabel}选项 ${index + 1}`,
    {
      kind: 'command',
      command: { type: 'fixture/hub-action', panel, entityId: `internal_${panel}_${index}` },
    },
    {
      placement: index >= 2 ? 'primary' : 'preparation',
      ...(index === 2 ? { recommendation: 'recommended' } : {}),
      readout: `${panelLabel}控制盘操作。`,
    },
  ));
  for (const [targetPanel, targetLabel] of Object.entries(HUB_FIXTURE_PANEL_LABELS)) {
    if (targetPanel === panel) continue;
    actions.push(hubFixtureAction(
      `hub.panel:${targetPanel}`,
      `前往${targetLabel}`,
      { kind: 'local', action: { type: 'hub/select-panel', panel: targetPanel } },
      { readout: '切换主神空间面板。' },
    ));
  }
  assert.equal(actions.length, HUB_CATALOG_FIXTURE_COUNTS[panel], `${panel} fixture action count`);
  return actions;
}

function hubEntryActionFixtures(deep = false) {
  const actions = [
    hubFixtureAction(
      'hub.entry.confirm',
      '确认入场',
      {
        kind: 'local',
        action: {
          type: 'entry/request-enter',
          draft: { dungeonId: 'demon_tower_1', protocolId: deep ? 'deep' : 'standard' },
        },
      },
      {
        placement: 'primary',
        emphasis: 'primary',
        recommendation: 'recommended',
        readout: '宿主会先生成并持久化显式 seed，再提交唯一一次 run/enter。',
      },
    ),
    hubFixtureAction(
      'hub.entry.dungeon:previous',
      '上一章：地铁深渊',
      { kind: 'local', action: { type: 'entry/select-dungeon', dungeonId: 'metro_abyss' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
    hubFixtureAction(
      'hub.entry.dungeon:next',
      '下一章：锈蚀病院',
      { kind: 'local', action: { type: 'entry/select-dungeon', dungeonId: 'rust_hospital' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
    hubFixtureAction(
      'hub.entry.protocol:standard',
      '标准探索',
      { kind: 'local', action: { type: 'entry/select-protocol', protocolId: 'standard' } },
      {
        enabled: false,
        recommendation: 'recommended',
        disabledReason: '当前已选择该入场协议。',
      },
    ),
    hubFixtureAction(
      'hub.entry.protocol:imprint',
      '烙印协议',
      { kind: 'local', action: { type: 'entry/select-protocol', protocolId: 'imprint' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
    hubFixtureAction(
      'hub.entry.protocol:deep',
      '炼狱探索',
      { kind: 'local', action: { type: 'entry/select-protocol', protocolId: 'deep' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
  ];
  if (deep) {
    actions.push(
      hubFixtureAction(
        'hub.entry.inferno-tier:down',
        '炼狱层级 -1',
        { kind: 'local', action: { type: 'entry/set-inferno-tier', infernoTier: 1 } },
        { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
      ),
      hubFixtureAction(
        'hub.entry.inferno-tier:up',
        '炼狱层级 +1',
        { kind: 'local', action: { type: 'entry/set-inferno-tier', infernoTier: 3 } },
        { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
      ),
    );
  }
  actions.push(
    hubFixtureAction(
      'hub.entry.route-contract:next',
      '契约：巡雾问井',
      { kind: 'local', action: { type: 'entry/select-route-contract', routeContractId: 'tower_mist_watch' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
    hubFixtureAction(
      'hub.entry.relic-seed:next',
      '种子：雾锋',
      { kind: 'local', action: { type: 'entry/select-relic-seed', seedRelicId: 'mist_edge', frame: 'assault' } },
      { readout: '仅更新入场草案；确认入场前不会生成 seed。' },
    ),
    hubFixtureAction(
      'hub.relic-frame:assault',
      '强攻回响',
      { kind: 'command', command: { type: 'hub/configure-relic', frame: 'assault' } },
    ),
    hubFixtureAction(
      'hub.relic-frame:guard',
      '守御回响',
      { kind: 'command', command: { type: 'hub/configure-relic', frame: 'guard' } },
    ),
  );
  for (const [panel, label] of Object.entries(HUB_FIXTURE_PANEL_LABELS)) {
    if (panel === 'entry') continue;
    actions.push(hubFixtureAction(
      `hub.panel:${panel}`,
      `前往${label}`,
      { kind: 'local', action: { type: 'hub/select-panel', panel } },
      { readout: '切换大厅面板，不提交领域命令。' },
    ));
  }
  assert.equal(actions.length, deep ? 19 : 17, 'hub fixture action count');
  return actions;
}

function hubModel(actions, options = {}) {
  const activePanel = options.activePanel ?? 'entry';
  const activePanelLabel = HUB_FIXTURE_PANEL_LABELS[activePanel] ?? '未知面板';
  return {
    schemaVersion: 1,
    phase: 'hub',
    screenTitle: options.screenTitle ?? '主神空间 · 祭坛',
    dispatchPolicy: 'one-event-per-action',
    visualAssetKey: 'scene:main_god_space',
    tasks: [],
    sections: [
      {
        kind: 'objective',
        title: '整备并确认入场协议',
        summary: options.objectiveSummary
          ?? '当前目标：进入镇魔塔一层。确认只产生一次宿主入场请求。',
      },
      {
        kind: 'status',
        metrics: [
          { id: 'hp', label: '生命', value: '60/60', symbol: '♥', severity: 'neutral' },
          { id: 'power', label: '战力', value: '320', symbol: '力', severity: 'neutral' },
          { id: 'reward-points', label: '奖励点', value: '85', symbol: '点', severity: 'neutral' },
          { id: 'lingyun', label: '灵蕴', value: '3', symbol: '蕴', severity: 'neutral' },
          { id: 'hub-panel', label: '大厅面板', value: activePanelLabel, symbol: '厅', severity: 'positive' },
        ],
        detail: {
          kind: 'hub',
          activePanel,
          activePanelLabel,
          panelSummary: options.panelSummary ?? '镇魔塔一层 · 标准探索 · 巡雾问井 · 强攻回响 / 候选 2 → 3',
          entryDraft: {
            dungeonId: 'demon_tower_1',
            protocolId: options.deep ? 'deep' : 'standard',
            ...(options.deep ? { infernoTier: 2 } : {}),
            routeContractId: 'tower_mist_watch',
          },
          selectedDungeonName: '镇魔塔一层',
          seedStatus: 'host-on-confirm',
          dungeonCount: 3,
          entryBuild: {
            routeContract: {
              selectedRouteContractId: 'tower_mist_watch',
              selectionValid: true,
              options: [{
                routeContractId: 'tower_mist_watch',
                name: '巡雾问井',
                description: '依序完成契约目标。',
                orderedTargets: [{ order: 1, nodeId: 'upper_fog_patrol', nodeTitle: '上层雾巡' }],
                rewardPoints: 135,
                selected: true,
                selectable: false,
              }],
            },
            relic: {
              frame: 'assault',
              frameName: '强攻',
              candidateCount: 3,
              candidateReadout: '2 → 3',
              matchingConduitEquipmentIds: ['armor_piercing_sword'],
              selectedSeedRelicId: 'mist_edge',
              seedOptions: [{
                seedRelicId: 'mist_edge',
                name: '雾锋',
                description: '已归档回响。',
                selected: true,
                selectable: false,
              }],
            },
          },
        },
      },
      { kind: 'actions', actions },
      {
        kind: 'risks',
        items: options.risks ?? [{
          id: 'altar-risk',
          label: '入场确认',
          reason: '确认后进入副本。',
          severity: 'warning',
        }],
      },
      {
        kind: 'help',
        entries: options.helpEntries ?? chapterHelpEntries,
        ...(options.helpActive === undefined ? {} : { active: options.helpActive }),
      },
      { kind: 'logs', lines: options.logs ?? ['你回到了主神空间。'] },
    ],
  };
}

function collectNodes(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  for (const child of node.children ?? []) collectNodes(child, predicate, found);
  return found;
}
function findNode(root, name) {
  return collectNodes(root, (node) => node.name === name)[0];
}
function collectStrings(node, strings = []) {
  for (const component of node.components?.values?.() ?? []) {
    if (component && typeof component.string === 'string') strings.push(component.string);
  }
  for (const child of node.children ?? []) collectStrings(child, strings);
  return strings;
}
function labelComponent(node) {
  return [...(node?.components?.values?.() ?? [])].find((component) => (
    component && typeof component.string === 'string'
  ));
}
function hasComponentNamed(node, name) {
  return [...(node?.components?.keys?.() ?? [])].some((Type) => Type.name === name);
}
function absoluteNodeBounds(node) {
  let x = node.position?.x ?? 0;
  let y = node.position?.y ?? 0;
  let parent = node.parent;
  while (parent !== undefined) {
    x += parent.position?.x ?? 0;
    y += parent.position?.y ?? 0;
    parent = parent.parent;
  }
  return {
    left: x - node.size.width / 2,
    right: x + node.size.width / 2,
    bottom: y - node.size.height / 2,
    top: y + node.size.height / 2,
  };
}
function nodesOverlap(leftNode, rightNode) {
  const left = absoluteNodeBounds(leftNode);
  const right = absoluteNodeBounds(rightNode);
  return left.left < right.right && left.right > right.left
    && left.bottom < right.top && left.top > right.bottom;
}
function emitTouch(node, touchId) {
  node.emit('touch-start', { getID: () => touchId, propagationStopped: false });
  node.emit('touch-end', { getID: () => touchId, propagationStopped: false });
}
/** Entering from the courtyard opens the first room's own sheet; 收起 returns to walking. */
function closeArrivalSheet(root, touchId) {
  const close = findNode(root, 'MobileSheetClose') ?? findNode(root, 'WalkRoomEventButton:close');
  assert.ok(close, 'entering from the courtyard opens the first room\'s sheet');
  emitTouch(close, touchId);
}
function exploreInsets(windowWidth, windowHeight) {
  const designPerViewport = 750 / windowWidth;
  const visibleDesignHeight = windowHeight * designPerViewport;
  const centeredRootMargin = (visibleDesignHeight - 1334) / 2;
  const safeTop = 44;
  const safeBottom = windowHeight - 34;
  return Object.freeze({
    top: Math.max(0, safeTop * designPerViewport - centeredRootMargin),
    right: 0,
    bottom: Math.max(0, (windowHeight - safeBottom) * designPerViewport - centeredRootMargin),
    left: 0,
  });
}
const EXPLORE_INSETS_320 = exploreInsets(320, 568);
const EXPLORE_INSETS_390 = exploreInsets(390, 844);

// === Player-facing runtime chrome ===
// Exercise the real View nodes for all five runtime modes and every activity
// family. Only boot/blocked are allowed to retain raw diagnostics.
{
  const delegateCalls = [];
  const canvas = {
    name: 'player-chrome-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const model = exploreModel(chapterDecisionFixture('metro_abyss'));
  const nodeString = (root, name) => {
    const node = findNode(root, name);
    assert.ok(node, `${name} exists`);
    const strings = collectStrings(node);
    assert.equal(strings.length, 1, `${name} contains one label`);
    return strings[0];
  };
  const diagnosticBoot = {
    modeKind: 'boot',
    modeLabel: 'BOOT command=bootstrap',
    modeDetail: 'seed=boot safe top 99 / bottom 88',
    activityMessage: 'attestation=boot revision=7',
  };
  const diagnosticBlocked = {
    modeKind: 'blocked',
    modeLabel: 'BLOCKED command=persist',
    modeDetail: 'attestation=blocked safe bottom 88',
    activityMessage: 'revision=8 seed=blocked',
    blockingMessage: 'raw blocked diagnostic command=write',
  };
  const viewModeCases = [
    ['boot', undefined, diagnosticBoot, diagnosticBoot.modeLabel, diagnosticBoot.modeDetail, diagnosticBoot.activityMessage],
    [
      'preview',
      model,
      { modeKind: 'preview', modeLabel: 'raw preview', modeDetail: 'safe top 99', activityMessage: 'ready revision=1' },
      '∞ 无限流 · 试玩模式',
      '临时存档 · 关闭或刷新后进度会丢失',
      '探索进行中',
    ],
    [
      'wx-devtools',
      model,
      { modeKind: 'wx-devtools', modeLabel: 'raw devtools', modeDetail: 'safe bottom 88', activityMessage: 'ready seed=1' },
      '∞ 无限流 · 微信开发者工具 · NON_RELEASE',
      '临时存档 · 不可发布 · 关闭或刷新后进度会丢失',
      '探索进行中',
    ],
    [
      'wx',
      model,
      { modeKind: 'wx', modeLabel: 'raw wx', modeDetail: 'attestation=wx', activityMessage: 'ready revision=1' },
      '∞ 无限流 · 微信运行',
      '持久存档边界已连接',
      '探索进行中',
    ],
    ['blocked', undefined, diagnosticBlocked, diagnosticBlocked.modeLabel, diagnosticBlocked.modeDetail, diagnosticBlocked.activityMessage],
  ];
  for (const [label, viewModel, chrome, expectedMode, expectedDetail, expectedActivity] of viewModeCases) {
    view.render(viewModel, chrome, EXPLORE_INSETS_320);
    const root = canvas.children[canvas.children.length - 1];
    assert.equal(nodeString(root, 'RuntimeMode'), expectedMode, `${label} real View mode`);
    assert.equal(nodeString(root, 'RuntimeDetail'), expectedDetail, `${label} real View detail`);
    assert.equal(nodeString(root, 'Activity'), expectedActivity, `${label} real View activity`);
    if (label !== 'boot' && label !== 'blocked') {
      assert.doesNotMatch(
        collectStrings(findNode(root, 'RuntimeModeBand')).concat(
          collectStrings(findNode(root, 'TitlePanel')),
        ).join('\n'),
        /\bcommand\b|\brevision\b|\bseed\b|safe\s+(?:top|bottom)|attestation/iu,
        `${label} real View chrome hides internal tokens`,
      );
    }
  }
  let root = canvas.children[canvas.children.length - 1];
  assert.equal(
    nodeString(root, 'DiagnosticBody'),
    diagnosticBlocked.blockingMessage,
    'blocked overlay keeps its complete raw diagnostic',
  );

  const viewActivityCases = [
    ['busy', '提交 combat.attack:fixture', 'combat.attack:fixture', '行动处理中'],
    ['committed', '已提交 combat.attack:fixture · revision 42', undefined, '行动完成 · 进度已更新'],
    ['duplicate', '物理输入去重 combat.attack:fixture · revision 42', undefined, '重复触控已忽略 · 进度未改变'],
    ['rejected', '规则拒绝 combat.attack:fixture · 状态未改变', undefined, '当前行动不可执行 · 进度未改变'],
    ['invalid', '输入无效 combat.attack:fixture', undefined, '当前输入无效 · 请重新选择'],
    ['failure', 'combat.attack:fixture 失败：revision=42 path=monster/fixture seed=unsafe', undefined, '行动失败 · 请稍后重试'],
    ['visual', '视觉资源回退 · key=monster:fixture revision=42', undefined, '部分画面暂不可用 · 已切换文字模式，可继续游戏'],
    ['memory', '微信内存告警：视觉资源已释放；seed=fixture', undefined, '设备内存紧张 · 已释放画面资源，请稍后继续'],
    ['lifecycle', 'resume 生命周期错误：attestation=fixture', undefined, '运行状态同步失败 · 请重新进入小游戏'],
    ['random', '安全随机池补充失败：seed=fixture', undefined, '安全随机源暂不可用 · 请稍后重试'],
    ['unknown', 'opaque command token revision=42', undefined, '探索进行中'],
  ];
  for (const [label, activityMessage, busyActionId, expectedActivity] of viewActivityCases) {
    const chrome = {
      modeKind: 'preview',
      modeLabel: 'raw preview command=internal',
      modeDetail: 'safe top 99 attestation=fixture',
      activityMessage,
      ...(busyActionId === undefined ? {} : { busyActionId }),
    };
    const before = JSON.stringify(chrome);
    view.render(model, chrome, EXPLORE_INSETS_390);
    root = canvas.children[canvas.children.length - 1];
    assert.equal(nodeString(root, 'Activity'), expectedActivity, `${label} real View activity projection`);
    assert.doesNotMatch(
      collectStrings(findNode(root, 'RuntimeModeBand')).concat(
        collectStrings(findNode(root, 'TitlePanel')),
      ).join('\n'),
      /combat\.attack:fixture|\bcommand\b|\brevision\b|\bseed\b|\bpath\b|safe\s+(?:top|bottom)|attestation/iu,
      `${label} real View chrome hides internal tokens`,
    );
    assert.equal(JSON.stringify(chrome), before, `${label} real View leaves raw chrome untouched`);
  }
  assert.equal(delegateCalls.length, 0, 'chrome projection emits no domain event');
  view.destroy();
}

// === Unified Hub control deck ===
// Every legal Hub panel uses the same 2x2 control board. It keeps every source
// action, original event identity, local-only paging, and fail-closed locks.
{
  const standardActions = hubEntryActionFixtures(false);
  const deepActions = hubEntryActionFixtures(true);
  const originalStandardIds = standardActions.map(({ actionId }) => actionId);
  const originalStandardEvents = standardActions.map(({ event }) => event);
  const originalStandardSnapshot = JSON.stringify(standardActions);
  const orderedStandardIds = orderActionsForCompactReachability(standardActions)
    .map(({ actionId }) => actionId);
  const delegateCalls = [];
  const canvas = {
    name: 'hub-entry-altar-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: 'fixture', modeDetail: 'fixture' };
  const hubHelpFixture = {
    ...chapterHelpEntries[0],
    summary: `帮助摘要：${rawHubCopy}`,
    mechanic: `帮助机制：${rawHubCopy}`,
    guidance: `帮助建议：${rawHubCopy}`,
    readout: `帮助读数：${rawHubCopy}`,
    keywords: ['现代流程', 'run/enter'],
  };
  const standardModel = hubModel(standardActions, {
    risks: [{ id: 'altar-risk', label: '入场确认', reason: rawHubCopy, severity: 'warning' }],
    helpEntries: [hubHelpFixture],
    logs: [rawHubCopy],
  });
  const rootNow = () => canvas.children[canvas.children.length - 1];
  const deckActions = (root) => collectNodes(findNode(root, 'Deck'), (node) => (
    typeof node.name === 'string' && node.name.startsWith('Action:')
  ));

  for (const [label, insets, viewportWidth] of [
    ['320x568', EXPLORE_INSETS_320, 320],
    ['390x844', EXPLORE_INSETS_390, 390],
  ]) {
    view.render(standardModel, chrome, insets);
    const root = rootNow();
    const deck = findNode(root, 'Deck');
    const cards = deckActions(root);
    const title = findNode(deck, 'DeckTitle');
    const previous = findNode(deck, 'PagePrevious');
    const next = findNode(deck, 'PageNext');
    assert.equal(collectStrings(title).join(''), '3 / 6 祭坛 · 17 项', `${label} altar title`);
    assert.equal(
      collectStrings(findNode(deck, 'DeckHint')).join(''),
      '2×2 祭坛控制盘 · 镇魔塔一层',
      `${label} altar hint stays smoke-compatible`,
    );
    assert.equal(cards.length, 4, `${label} altar renders four cards`);
    for (const node of [...cards, previous, next]) {
      assert.ok(node.size.width >= 104 && node.size.height >= 104, `${label} altar touch target is 104+ design px`);
      assert.ok(node.size.width * viewportWidth / 750 >= 44, `${label} altar touch width is 44+ viewport px`);
      assert.ok(node.size.height * viewportWidth / 750 >= 44, `${label} altar touch height is 44+ viewport px`);
    }
    for (let leftIndex = 0; leftIndex < cards.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < cards.length; rightIndex += 1) {
        const left = cards[leftIndex];
        const right = cards[rightIndex];
        const overlaps = Math.abs(left.position.x - right.position.x) < (left.size.width + right.size.width) / 2
          && Math.abs(left.position.y - right.position.y) < (left.size.height + right.size.height) / 2;
        assert.equal(overlaps, false, `${label} altar cards ${leftIndex}/${rightIndex} do not overlap`);
      }
    }
    const highestCardTop = Math.max(...cards.map((card) => card.position.y + card.size.height / 2));
    const lowestCardBottom = Math.min(...cards.map((card) => card.position.y - card.size.height / 2));
    assert.ok(highestCardTop < title.position.y - title.size.height / 2, `${label} cards clear title`);
    assert.ok(lowestCardBottom > next.position.y + next.size.height / 2, `${label} cards clear pager`);
    assert.ok(deck.position.y + deck.size.height / 2 <= 1334 / 2 - insets.top, `${label} deck honors top inset`);
    assert.ok(deck.position.y - deck.size.height / 2 >= -1334 / 2 + insets.bottom, `${label} deck honors bottom inset`);
  }

  view.render(standardModel, chrome, EXPLORE_INSETS_320);
  let root = rootNow();
  const staleAction = findNode(root, 'Action:hub.entry.confirm');
  const staleNext = findNode(root, 'PageNext');
  const seedBoundaryText = collectStrings(findNode(root, 'SeedBoundary')).join('\n');
  assert.match(seedBoundaryText, /归档种子 雾锋/);
  assert.match(seedBoundaryText, /本局命数 · 确认入场时生成并保存/);
  assert.doesNotMatch(seedBoundaryText, HUB_FORBIDDEN_PLAYER_COPY, 'host-on-confirm status is player-facing');
  assert.doesNotMatch(
    collectStrings(findNode(root, 'Objective')).join('\n'),
    HUB_FORBIDDEN_PLAYER_COPY,
    'Hub objective projects host terminology at the View boundary',
  );
  assert.match(collectStrings(staleAction).join('\n'), /★ 推荐/, 'enabled confirm is visibly recommended');
  assert.match(
    collectStrings(staleAction).join('\n'),
    /确认后生成并保存本局命数，随后进入所选副本/,
    'confirm short copy comes from entry/request-enter without exposing that enum',
  );
  const rootsBeforeBoundaryTouch = canvas.children.length;
  emitTouch(findNode(root, 'PagePrevious'), 9099);
  assert.equal(canvas.children.length, rootsBeforeBoundaryTouch, 'first Hub page previous control is inert');
  const targetIds = new Set([
    'hub.entry.confirm',
    'hub.entry.dungeon:next',
    'hub.relic-frame:assault',
    'hub.panel:supplies',
  ]);
  const activatedIds = new Set();
  const seenIds = [];
  let touchId = 9100;
  for (let page = 0; page < 5; page += 1) {
    const cards = deckActions(root);
    assert.ok(cards.length > 0 && cards.length <= 4, `hub page ${page + 1} has one to four cards`);
    assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), new RegExp(`${page + 1} / 5`));
    assert.doesNotMatch(
      collectStrings(root).join('\n'),
      /hub\.entry|demon_tower_1|metro_abyss|rust_hospital|entry\/request-enter|key=|undefined/iu,
      `hub page ${page + 1} exposes no internal identifier`,
    );
    assert.doesNotMatch(
      collectStrings(root).join('\n'),
      HUB_FORBIDDEN_PLAYER_COPY,
      `hub page ${page + 1} exposes no audited engineering copy`,
    );
    for (const card of cards) {
      const actionId = card.name.slice('Action:'.length);
      const sourceAction = standardActions.find((action) => action.actionId === actionId);
      assert.ok(sourceAction, `${actionId} comes from the original ViewModel`);
      seenIds.push(actionId);
      assert.ok(card.children.every((child) => child.listeners.size === 0), `${actionId} child labels do not listen`);
      assert.equal(
        collectStrings(findNode(card, 'HubActionGlyph')).join(''),
        classifyInfiniteFlowHubActionGlyph(sourceAction),
        `${actionId} uses only its visual glyph projection`,
      );
      if (actionId === 'hub.entry.protocol:standard') {
        const text = collectStrings(card).join('\n');
        assert.match(text, /× 锁定/);
        assert.doesNotMatch(text, /★ 推荐/, 'disabled recommendation stays locked');
        assert.match(text, /当前已选择该入场协议/);
        assert.equal(card.listeners.size, 0, 'disabled action has no listener even when an event exists');
      }
      if (actionId === 'hub.entry.relic-seed:next') {
        assert.match(
          collectStrings(findNode(card, 'ActionLabel')).join(''),
          /归档种子：雾锋/,
          'relic selector labels the archived seed in player language',
        );
      }
      if (!targetIds.has(actionId)) continue;
      assert.ok(sourceAction?.event, `${actionId} source event exists`);
      const callsBefore = delegateCalls.length;
      const eventTouch = { getID: () => ++touchId, propagationStopped: false };
      const stableTouchId = eventTouch.getID();
      const touch = { getID: () => stableTouchId, propagationStopped: false };
      card.emit('touch-start', touch);
      card.emit('touch-end', touch);
      card.emit('touch-end', touch);
      assert.equal(delegateCalls.length, callsBefore + 1, `${actionId} dispatches exactly once`);
      const dispatched = delegateCalls[delegateCalls.length - 1];
      assert.equal(dispatched.actionId, actionId);
      assert.equal(dispatched.event, sourceAction.event, `${actionId} preserves event identity`);
      activatedIds.add(actionId);
    }
    if (page < 4) {
      const callsBeforePage = delegateCalls.length;
      emitTouch(findNode(root, 'PageNext'), ++touchId);
      assert.equal(delegateCalls.length, callsBeforePage, `hub page ${page + 1} navigation is local-only`);
      root = rootNow();
      if (page === 0) {
        const rootsBeforeStaleInput = canvas.children.length;
        const callsBeforeStaleInput = delegateCalls.length;
        emitTouch(staleAction, ++touchId);
        emitTouch(staleNext, ++touchId);
        assert.equal(delegateCalls.length, callsBeforeStaleInput, 'stale altar card is inert');
        assert.equal(canvas.children.length, rootsBeforeStaleInput, 'stale altar pager is inert');
      }
    }
  }
  assert.deepEqual(seenIds, orderedStandardIds, 'all 17 Hub actions render exactly once in reachability order');
  assert.equal(new Set(seenIds).size, standardActions.length, 'Hub altar renders no duplicate action');
  assert.deepEqual(standardActions.map(({ actionId }) => actionId), originalStandardIds, 'Hub altar does not sort its input in place');
  assert.ok(
    standardActions.every((action, index) => action.event === originalStandardEvents[index]),
    'Hub projection retains every source event reference in its original slot',
  );
  assert.equal(JSON.stringify(standardActions), originalStandardSnapshot, 'Hub projection does not mutate action objects');
  assert.deepEqual([...activatedIds].sort(), [...targetIds].sort(), 'confirm/dungeon/relic-frame/panel actions are reachable');
  assert.equal(findNode(root, 'PageNext').listeners.size, 0, 'last Hub page next control is inert');
  assert.match(collectStrings(findNode(root, 'PageNext')).join('\n'), /× 下一页/);

  // 17 <-> 19 action-set changes reset to page one even when screenTitle stays stable.
  view.render(hubModel(deepActions, { deep: true }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 5/, '17 -> 19 resets Hub page');
  const seenDeepIds = [];
  for (let page = 0; page < 5; page += 1) {
    seenDeepIds.push(...deckActions(root).map(({ name }) => name.slice('Action:'.length)));
    if (page < 4) {
      emitTouch(findNode(root, 'PageNext'), ++touchId);
      root = rootNow();
    }
  }
  assert.deepEqual(
    seenDeepIds,
    orderActionsForCompactReachability(deepActions).map(({ actionId }) => actionId),
    'all 19 deep Hub actions render exactly once in reachability order',
  );
  assert.equal(new Set(seenDeepIds).size, deepActions.length, 'deep Hub altar renders no duplicate action');
  view.render(standardModel, chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 5/, '19 -> 17 resets Hub page');

  const catalogPanels = Object.keys(HUB_CATALOG_FIXTURE_COUNTS);
  for (const catalogPanel of catalogPanels) {
    const actions = hubCatalogActionFixtures(catalogPanel);
    const originalIds = actions.map(({ actionId }) => actionId);
    const ordered = orderActionsForCompactReachability(actions);
    const expectedPages = HUB_CATALOG_FIXTURE_COUNTS[catalogPanel] === 14
      ? 4
      : HUB_CATALOG_FIXTURE_COUNTS[catalogPanel] === 19
        ? 5
        : 3;

    // The shared geometry remains within both supported narrow safe areas.
    for (const [label, insets, viewportWidth] of [
      ['320x568', EXPLORE_INSETS_320, 320],
      ['390x844', EXPLORE_INSETS_390, 390],
    ]) {
      view.render(hubModel(actions, {
        activePanel: catalogPanel,
        panelSummary: `${HUB_FIXTURE_PANEL_LABELS[catalogPanel]}状态已就绪`,
      }), chrome, insets);
      const boardRoot = rootNow();
      const deck = findNode(boardRoot, 'Deck');
      const cards = deckActions(boardRoot);
      const title = findNode(deck, 'DeckTitle');
      const previous = findNode(deck, 'PagePrevious');
      const next = findNode(deck, 'PageNext');
      assert.equal(
        collectStrings(title).join(''),
        `3 / 6 ${HUB_FIXTURE_PANEL_LABELS[catalogPanel]} · ${actions.length} 项`,
        `${catalogPanel} ${label} title uses only player-facing panel data`,
      );
      assert.equal(
        collectStrings(findNode(deck, 'DeckHint')).join(''),
        `2×2 主神空间控制盘 · ${HUB_FIXTURE_PANEL_LABELS[catalogPanel]}`,
        `${catalogPanel} ${label} hint is player-facing`,
      );
      assert.equal(cards.length, 4, `${catalogPanel} ${label} renders four cards on page one`);
      for (const card of cards) {
        assert.deepEqual([card.size.width, card.size.height], [318, 160], `${catalogPanel} ${label} uses 318x160 cards`);
      }
      for (const pager of [previous, next]) {
        assert.deepEqual([pager.size.width, pager.size.height], [190, 104], `${catalogPanel} ${label} uses 190x104 pager controls`);
      }
      for (const node of [...cards, previous, next]) {
        assert.ok(node.size.width >= 104 && node.size.height >= 104, `${catalogPanel} ${label} target is 104+ design px`);
        assert.ok(node.size.width * viewportWidth / 750 >= 44, `${catalogPanel} ${label} target width is 44+ viewport px`);
        assert.ok(node.size.height * viewportWidth / 750 >= 44, `${catalogPanel} ${label} target height is 44+ viewport px`);
      }
      for (let leftIndex = 0; leftIndex < cards.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < cards.length; rightIndex += 1) {
          const left = cards[leftIndex];
          const right = cards[rightIndex];
          const overlaps = Math.abs(left.position.x - right.position.x) < (left.size.width + right.size.width) / 2
            && Math.abs(left.position.y - right.position.y) < (left.size.height + right.size.height) / 2;
          assert.equal(overlaps, false, `${catalogPanel} ${label} cards ${leftIndex}/${rightIndex} do not overlap`);
        }
      }
      const highestCardTop = Math.max(...cards.map((card) => card.position.y + card.size.height / 2));
      const lowestCardBottom = Math.min(...cards.map((card) => card.position.y - card.size.height / 2));
      assert.ok(highestCardTop < title.position.y - title.size.height / 2, `${catalogPanel} ${label} cards clear title`);
      assert.ok(lowestCardBottom > next.position.y + next.size.height / 2, `${catalogPanel} ${label} cards clear pager`);
      assert.ok(deck.position.y + deck.size.height / 2 <= 1334 / 2 - insets.top, `${catalogPanel} ${label} honors top inset`);
      assert.ok(deck.position.y - deck.size.height / 2 >= -1334 / 2 + insets.bottom, `${catalogPanel} ${label} honors bottom inset`);
    }

    view.render(hubModel(actions, { activePanel: catalogPanel }), chrome, EXPLORE_INSETS_320);
    root = rootNow();
    const seen = [];
    const representative = ordered.find(({ enabled, event }) => enabled && event !== undefined);
    assert.ok(representative, `${catalogPanel} has an interactive representative`);
    const callsBeforeRepresentative = delegateCalls.length;
    for (let page = 0; page < expectedPages; page += 1) {
      const cards = deckActions(root);
      const visibleIds = cards.map(({ name }) => name.slice('Action:'.length));
      assert.deepEqual(
        visibleIds,
        ordered.slice(page * 4, page * 4 + 4).map(({ actionId }) => actionId),
        `${catalogPanel} page ${page + 1} is the exact ViewModel slice`,
      );
      seen.push(...visibleIds);
      assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), new RegExp(`${page + 1} / ${expectedPages}`));
      assert.doesNotMatch(
        collectStrings(root).join('\n'),
        /hub\.|internal_|fixture\/hub-action|entityId|eventId|key=|undefined/iu,
        `${catalogPanel} page ${page + 1} exposes no action, entity, event, or asset identifier`,
      );
      assert.doesNotMatch(
        collectStrings(root).join('\n'),
        HUB_FORBIDDEN_PLAYER_COPY,
        `${catalogPanel} page ${page + 1} exposes no audited engineering copy`,
      );
      for (const card of cards) {
        const actionId = card.name.slice('Action:'.length);
        const sourceAction = actions.find((action) => action.actionId === actionId);
        assert.ok(sourceAction, `${catalogPanel} ${actionId} comes from the original ViewModel`);
        assert.equal(
          collectStrings(findNode(card, 'HubActionGlyph')).join(''),
          classifyInfiniteFlowHubActionGlyph(sourceAction),
          `${catalogPanel} ${actionId} uses the visual glyph projection`,
        );
        assert.ok(card.children.every((child) => child.listeners.size === 0), `${catalogPanel} card labels do not listen`);
        if (actionId === representative.actionId) {
          const stableTouchId = ++touchId;
          const touch = { getID: () => stableTouchId, propagationStopped: false };
          card.emit('touch-start', touch);
          card.emit('touch-end', touch);
          card.emit('touch-end', touch);
        }
      }
      if (page + 1 < expectedPages) {
        const callsBeforePage = delegateCalls.length;
        emitTouch(findNode(root, 'PageNext'), ++touchId);
        assert.equal(delegateCalls.length, callsBeforePage, `${catalogPanel} pager is local-only`);
        root = rootNow();
      }
    }
    assert.deepEqual(seen, ordered.map(({ actionId }) => actionId), `${catalogPanel} renders every action exactly once`);
    assert.equal(new Set(seen).size, actions.length, `${catalogPanel} renders no duplicate action`);
    assert.deepEqual(actions.map(({ actionId }) => actionId), originalIds, `${catalogPanel} does not sort the ViewModel in place`);
    assert.equal(delegateCalls.length, callsBeforeRepresentative + 1, `${catalogPanel} representative dispatches exactly once`);
    const dispatched = delegateCalls[delegateCalls.length - 1];
    assert.equal(dispatched.actionId, representative.actionId, `${catalogPanel} forwards the exact actionId`);
    assert.equal(dispatched.event, representative.event, `${catalogPanel} preserves event object identity`);
    assert.equal(findNode(root, 'PageNext').listeners.size, 0, `${catalogPanel} last page next is inert`);
  }

  // Panel changes and same-panel action-set changes both reset page one. The
  // layout helper separately proves that an out-of-range requested page clamps.
  const suppliesActions = hubCatalogActionFixtures('supplies');
  view.render(hubModel(suppliesActions, { activePanel: 'supplies' }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  const staleCatalogAction = deckActions(root)[0];
  const staleCatalogNext = findNode(root, 'PageNext');
  emitTouch(staleCatalogNext, ++touchId);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /2 \/ 4/, 'catalog pager reaches page two');
  const rootsBeforeStaleCatalogInput = canvas.children.length;
  const callsBeforeStaleCatalogInput = delegateCalls.length;
  emitTouch(staleCatalogAction, ++touchId);
  emitTouch(staleCatalogNext, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeStaleCatalogInput, 'stale catalog card is inert');
  assert.equal(canvas.children.length, rootsBeforeStaleCatalogInput, 'stale catalog pager is inert');

  view.render(hubModel(suppliesActions.slice(0, -1), { activePanel: 'supplies' }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 4/, 'same-panel action-set change resets page');
  emitTouch(findNode(root, 'PageNext'), ++touchId);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /2 \/ 4/);
  view.render(hubModel(hubCatalogActionFixtures('equipment'), { activePanel: 'equipment' }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 5/, 'panel change resets page');
  view.render(hubModel(suppliesActions, { activePanel: 'supplies' }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 4/, 'returning panel starts on page one');

  // A forged unknown panel cannot opt into Hub rendering and fails back to the
  // existing generic deck instead of trusting its action IDs.
  const malformedAction = hubFixtureAction(
    'hub.malformed.select:next',
    '返回安全选项',
    { kind: 'local', action: { type: 'hub/select-panel', panel: 'entry' } },
  );
  view.render(hubModel([malformedAction], { activePanel: 'not-a-panel' }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.equal(findNode(root, `Action:${malformedAction.actionId}`).size.width, 650, 'malformed panel fails back to generic deck');
  assert.equal(findNode(root, 'HubActionGlyph'), undefined, 'malformed panel never opts into altar rendering');

  view.render(standardModel, chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 5/, 'returning to entry resets its page');
  const callsBeforeDeckSwitch = delegateCalls.length;
  emitTouch(findNode(root, 'NextSection'), ++touchId);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'DeckTitle')).join('\n'), /风险/);
  assert.doesNotMatch(collectStrings(root).join('\n'), HUB_FORBIDDEN_PLAYER_COPY, 'Hub risks project engineering copy');
  assert.equal(findNode(root, 'HubActionGlyph'), undefined, 'non-action deck never renders the altar');
  emitTouch(findNode(root, 'NextSection'), ++touchId);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'DeckTitle')).join('\n'), /帮助/);
  assert.doesNotMatch(collectStrings(root).join('\n'), HUB_FORBIDDEN_PLAYER_COPY, 'Hub help directory projects engineering copy');
  emitTouch(findNode(root, 'NextSection'), ++touchId);
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'DeckTitle')).join('\n'), /日志/);
  assert.doesNotMatch(collectStrings(root).join('\n'), HUB_FORBIDDEN_PLAYER_COPY, 'Hub logs project engineering copy');
  for (let index = 0; index < 3; index += 1) {
    emitTouch(findNode(root, 'PreviousSection'), ++touchId);
    root = rootNow();
  }
  root = rootNow();
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /1 \/ 5/, 'other deck preserves entry page state');
  assert.equal(delegateCalls.length, callsBeforeDeckSwitch, 'deck switching is local-only');

  const activeHelp = {
    ...hubHelpFixture,
    closeAction: {
      actionId: 'help.close',
      event: { kind: 'local', action: { type: 'help/close' } },
    },
  };
  view.render(hubModel(standardActions, {
    helpEntries: [hubHelpFixture],
    helpActive: activeHelp,
  }), chrome, EXPLORE_INSETS_320);
  root = rootNow();
  assert.ok(findNode(root, 'HelpOverlayBlocker'), 'Hub active help still renders the existing overlay');
  assert.doesNotMatch(collectStrings(findNode(root, 'HelpDialog')).join('\n'), HUB_FORBIDDEN_PLAYER_COPY, 'Hub help overlay projects engineering copy');
  view.destroy();
}

for (const [label, actionOverrides, chromeOverrides, expectedReason] of [
  [
    'disabled-recommended',
    { enabled: false, recommendation: 'recommended', disabledReason: '控制盘封印中。' },
    {},
    '控制盘封印中。',
  ],
  [
    'disabled-engineering-copy',
    { enabled: false, disabledReason: '当前装备不在领域返回的可封存候选中。' },
    {},
    '当前装备不在可封存候选中。',
  ],
  ['missing-event', { event: undefined }, {}, '选项事件缺失。'],
  ['busy', {}, { busyActionId: 'hub.supplies.buy:fixture' }, '行动处理中。'],
  ['blocked', {}, { modeKind: 'blocked', blockingMessage: 'fixture blocked' }, '运行已阻断。'],
]) {
  const fixture = hubCatalogActionFixtures('supplies').find(({ actionId }) => (
    actionId === 'hub.supplies.buy:fixture'
  ));
  assert.ok(fixture, `${label} supplies fixture exists`);
  const action = { ...fixture, ...actionOverrides };
  const delegateCalls = [];
  const canvas = {
    name: `hub-control-${label}-canvas`,
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  view.render(
    hubModel([action], { activePanel: 'supplies' }),
    { modeKind: 'preview', modeLabel: 'fixture', modeDetail: 'fixture', ...chromeOverrides },
    EXPLORE_INSETS_320,
  );
  const root = canvas.children[canvas.children.length - 1];
  const card = findNode(root, 'Action:hub.supplies.buy:fixture');
  const text = collectStrings(card).join('\n');
  assert.equal(card.listeners.size, 0, `${label} Hub card has no listener`);
  assert.ok(card.children.every((child) => child.listeners.size === 0), `${label} child labels have no listener`);
  assert.match(text, /× 锁定/, `${label} has a non-color lock label`);
  assert.match(text, new RegExp(expectedReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(text, HUB_FORBIDDEN_PLAYER_COPY, `${label} exposes no engineering copy`);
  assert.doesNotMatch(text, /★ 推荐/, `${label} lock overrides recommendation`);
  emitTouch(card, 9400);
  assert.equal(delegateCalls.length, 0, `${label} Hub card dispatches nothing`);
  view.destroy();
}

// The View sanitizes fallback diagnostics only at presentation time. All normal
// modes hide loader internals, while blocked mode retains the exact raw string.
{
  const canvas = {
    name: 'visual-fallback-player-copy-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, { activate() {} });
  const status = Object.freeze({
    key: 'scene:main_god_space',
    revision: 'sha256:fixture',
    diagnostic: rawVisualFallbackDiagnostic,
  });
  const before = JSON.stringify(status);
  view.setVisualAssetFallback(status);
  const model = hubModel(hubEntryActionFixtures(false));
  for (const modeKind of ['preview', 'wx-devtools', 'wx']) {
    view.render(model, { modeKind, modeLabel: 'raw fixture', modeDetail: 'raw fixture' }, EXPLORE_INSETS_320);
    const root = canvas.children[canvas.children.length - 1];
    const text = collectStrings(findNode(root, 'VisualAssetFallbackText')).join('\n');
    assert.equal(text, '部分画面暂不可用 · 已切换文字模式，可继续游戏');
    assert.doesNotMatch(text, /key=|revision|path=|generation|code=/iu, `${modeKind} fallback hides loader diagnostics`);
  }
  view.render(
    model,
    {
      modeKind: 'blocked',
      modeLabel: 'fixture blocked',
      modeDetail: 'fixture blocked',
      blockingMessage: 'fixture blocked',
    },
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  assert.equal(
    collectStrings(findNode(root, 'VisualAssetFallbackText')).join('\n'),
    rawVisualFallbackDiagnostic,
    'blocked fallback retains the exact diagnostic',
  );
  assert.equal(JSON.stringify(status), before, 'fallback projection leaves raw View status unchanged');
  view.destroy();
}

// === Shared visual asset: backdrop + contained foreground ===
// The real View attaches one SpriteFrame to both live Sprites, detaches every
// consumer before root/resource cleanup, and keeps visual layers interaction-free.
{
  const delegateCalls = [];
  const canvas = {
    name: 'visual-backdrop-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  const visualAssetKey = 'dungeon:visual-backdrop-fixture';
  const model = {
    ...exploreModel(chapterDecisionFixture('metro_abyss')),
    visualAssetKey,
  };
  const spriteFromNode = (node) => {
    const sprite = [...node.components.values()].find((component) => (
      Object.hasOwn(component, 'spriteFrame')
    ));
    assert.ok(sprite, `sprite component exists on ${node.name}`);
    return sprite;
  };
  const visualSprites = (root) => collectNodes(root, (node) => (
    node.name.startsWith('VisualBackdrop:') || node.name.startsWith('VisualAsset:')
  )).map(spriteFromNode);
  const fillChannels = (root, name) => {
    const node = findNode(root, name);
    assert.ok(node, `${name} exists for fill audit`);
    const graphics = [...node.components.values()].find((component) => (
      Array.isArray(component.fillColor?.channels)
    ));
    assert.ok(graphics, `${name} has a graphics fill`);
    assert.ok(graphics.fills[0], `${name} has an actual surface fill`);
    return graphics.fills[0].color.channels;
  };

  view.setVisualAsset(
    { width: 1600, height: 900 },
    { key: visualAssetKey, revision: 'visual-a' },
  );
  view.render(model, chrome, EXPLORE_INSETS_320);
  let root = canvas.children[canvas.children.length - 1];
  const backdropNode = findNode(root, `VisualBackdrop:scene:${visualAssetKey}`);
  const foregroundNode = findNode(root, `VisualAsset:scene:${visualAssetKey}`);
  const shadeNode = findNode(root, 'VisualBackdropShade');
  assert.deepEqual(
    root.children.slice(0, 3).map(({ name }) => name),
    ['Backdrop', `VisualBackdrop:scene:${visualAssetKey}`, 'VisualBackdropShade'],
    'visual backdrop and shade render after the opaque base and before chrome/content',
  );
  assert.equal(backdropNode.listeners.size, 0, 'backdrop Sprite registers no listener');
  assert.equal(shadeNode.listeners.size, 0, 'backdrop shade registers no listener');
  assert.ok(
    [...backdropNode.components.values(), ...shadeNode.components.values()]
      .every(({ constructor }) => constructor.name !== 'BlockInputEvents'),
    'visual backdrop layers do not block input',
  );
  const firstSprites = [spriteFromNode(backdropNode), spriteFromNode(foregroundNode)];
  const firstFrame = firstSprites[0].spriteFrame;
  const firstTexture = firstFrame.texture;
  assert.equal(firstSprites[1].spriteFrame, firstFrame, 'one frame backs both live Sprites');
  assert.equal(firstSprites[0].color.channels[3], 184, 'backdrop art is visibly present');
  assert.equal(firstSprites[1].color.channels[3], 255, 'status foreground stays clear');
  assert.equal(fillChannels(root, 'VisualBackdropShade')[3], 168, 'full-screen shade protects readability');
  assert.equal(findNode(root, 'VisualHudScrim').size.height, 144, 'non-combat HUD scrim stays unchanged');

  for (const name of ['TitlePanel', 'Objective', 'Status', 'Deck']) {
    const channels = fillChannels(root, name);
    assert.ok(channels.slice(0, 3).every((channel) => channel <= 39), `${name} glass stays dark`);
    assert.equal(channels[3], 220, `${name} uses the bounded visual surface alpha`);
  }
  for (const name of ['RuntimeModeBand', 'InformationOrder', 'SectionNavigation']) {
    const channels = fillChannels(root, name);
    assert.ok(channels.slice(0, 3).every((channel) => channel <= 33), `${name} quiet glass stays dark`);
    assert.equal(channels[3], 216, `${name} uses the bounded quiet surface alpha`);
  }
  assert.equal(fillChannels(root, 'MapWindowCell:0:1')[3], 255, 'fog cell stays opaque');
  assert.equal(fillChannels(root, 'ExploreMapPanRight')[3], 255, 'map control stays opaque');
  assert.equal(delegateCalls.length, 0, 'rendering visual layers emits no event');

  view.render(model, chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  assert.ok(firstSprites.every(({ spriteFrame }) => spriteFrame === null), 'repeat render detaches both stale Sprites');
  assert.equal(firstFrame.destroyCalls, 0, 'repeat render retains the active frame');
  assert.equal(firstTexture.destroyCalls, 0, 'repeat render retains the active texture');
  const repeatedSprites = visualSprites(root);
  assert.equal(repeatedSprites.length, 2, 'repeat render recreates both visual consumers');
  assert.ok(repeatedSprites.every(({ spriteFrame }) => spriteFrame === firstFrame));

  view.setVisualAssetFallback({
    key: visualAssetKey,
    revision: 'visual-fallback',
    diagnostic: 'fixture unavailable',
  });
  assert.ok(repeatedSprites.every(({ spriteFrame }) => spriteFrame === null), 'fallback detaches every live Sprite');
  assert.equal(firstFrame.destroyCalls, 1, 'fallback destroys the frame once');
  assert.equal(firstTexture.destroyCalls, 1, 'fallback destroys the texture once');
  view.render(model, chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  assert.equal(visualSprites(root).length, 0, 'fallback renders no distorted visual Sprite');
  assert.ok(findNode(root, 'VisualStageFallback'), 'status fallback remains clear');
  assert.ok(fillChannels(root, 'VisualAssetFallbackDiagnostic')[3] >= 250, 'diagnostic stays opaque');

  view.setVisualAsset(
    { width: 800, height: 600 },
    { key: visualAssetKey, revision: 'visual-b' },
  );
  view.render(model, chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  const replacementSprites = visualSprites(root);
  const replacementFrame = replacementSprites[0].spriteFrame;
  const replacementTexture = replacementFrame.texture;
  view.setVisualAsset(
    { width: 300, height: 400 },
    { key: visualAssetKey, revision: 'visual-c' },
  );
  assert.ok(replacementSprites.every(({ spriteFrame }) => spriteFrame === null), 'replace detaches both prior Sprites');
  assert.equal(replacementFrame.destroyCalls, 1, 'replace destroys the prior frame once');
  assert.equal(replacementTexture.destroyCalls, 1, 'replace destroys the prior texture once');

  view.render(model, chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  const finalSprites = visualSprites(root);
  const finalFrame = finalSprites[0].spriteFrame;
  const finalTexture = finalFrame.texture;
  assert.equal(finalSprites.length, 2, 'replacement frame is shared by backdrop and foreground');
  assert.equal(delegateCalls.length, 0, 'replace and repeated rendering emit no event');
  view.destroy();
  assert.ok(finalSprites.every(({ spriteFrame }) => spriteFrame === null), 'destroy detaches both live Sprites');
  assert.equal(finalFrame.destroyCalls, 1, 'destroy releases the final frame once');
  assert.equal(finalTexture.destroyCalls, 1, 'destroy releases the final texture once');
  view.destroy();
  assert.equal(finalFrame.destroyCalls, 1, 'repeated destroy does not double-destroy frame');
  assert.equal(finalTexture.destroyCalls, 1, 'repeated destroy does not double-destroy texture');
}

// === Explore 2D map deck ===
// The real View defaults to a pan-able map, but forwards movement only through
// one exact presentation action. Map navigation and mode switches stay local.
{
  const delegateCalls = [];
  const canvas = {
    name: 'map-action-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  const model = exploreModel(chapterDecisionFixture('metro_abyss'));
  view.render(model, chrome, EXPLORE_INSETS_320);
  let root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'ExploreMapWindow'), 'explore opens on the 2D map deck');
  const currentCell = findNode(root, 'MapWindowCell:0:0');
  assert.ok(collectStrings(currentCell).some((value) => value.includes('当前')));
  const foggedCell = findNode(root, 'MapWindowCell:0:1');
  const foggedStrings = collectStrings(foggedCell).join('\n');
  assert.match(foggedStrings, /未知区域/);
  assert.doesNotMatch(foggedStrings, /南侧隧道|south_tunnel/, 'fogged cell leaks no identity');
  const topology = findNode(root, 'ExploreMapTopology');
  const topologyGraphics = [...topology.components.values()].find(
    (component) => Array.isArray(component.segments),
  );
  assert.equal(
    topologyGraphics.segments.length,
    1,
    'topology draws only current to the one visible isAdjacent node',
  );

  const targetCell = findNode(root, 'MapWindowCell:1:0');
  const expectedAction = model.sections[2].actions.find(
    ({ actionId }) => actionId === 'map.move:east-hall',
  );
  const moveTouchId = 7001;
  targetCell.emit('touch-start', { getID: () => moveTouchId, propagationStopped: false });
  targetCell.emit('touch-end', { getID: () => moveTouchId, propagationStopped: false });
  targetCell.emit('touch-end', { getID: () => moveTouchId, propagationStopped: false });
  assert.equal(delegateCalls.length, 1, 'duplicate TOUCH_END forwards one move event');
  assert.equal(delegateCalls[0].actionId, expectedAction.actionId);
  assert.equal(delegateCalls[0].event, expectedAction.event, 'move event identity is forwarded unchanged');
  view.destroy();
}

{
  const decision = chapterDecisionFixture('metro_abyss');
  const base = exploreModel(decision);
  const baseMap = base.sections[1].detail.map;
  const baseAction = base.sections[2].actions.find(
    ({ actionId }) => actionId === 'map.move:east-hall',
  );
  const inertCases = [
    {
      label: 'busy',
      actions: base.sections[2].actions,
      chrome: { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture', busyActionId: 'soul-recharge.activate:fixture' },
    },
    {
      label: 'blocked',
      actions: base.sections[2].actions,
      chrome: { modeKind: 'blocked', modeLabel: '运行阻断', modeDetail: 'fixture', blockingMessage: 'fixture' },
    },
    {
      label: 'disabled',
      actions: base.sections[2].actions.map((action) => (
        action === baseAction ? { ...action, enabled: false } : action
      )),
    },
    {
      label: 'event-missing',
      actions: base.sections[2].actions.map((action) => (
        action === baseAction ? { ...action, event: undefined } : action
      )),
    },
    {
      label: 'missing',
      actions: base.sections[2].actions.filter((action) => action !== baseAction),
    },
    {
      label: 'duplicate',
      actions: [...base.sections[2].actions, { ...baseAction }],
    },
    {
      label: 'placement-mismatch',
      actions: base.sections[2].actions.map((action) => (
        action === baseAction ? { ...action, placement: 'node' } : action
      )),
    },
    {
      label: 'adjacency-mismatch',
      actions: base.sections[2].actions,
      map: {
        ...baseMap,
        nodes: baseMap.nodes.map((node) => (
          node.x === 1 && node.y === 0 ? { ...node, isAdjacent: false } : node
        )),
      },
    },
    {
      label: 'projection-mismatch',
      actions: base.sections[2].actions,
      map: { ...baseMap, currentNodeId: 'projection-mismatch' },
    },
  ];
  for (const testCase of inertCases) {
    const delegateCalls = [];
    const canvas = {
      name: `map-inert-${testCase.label}`,
      children: [],
      addChild(child) { this.children.push(child); child.parent = this; },
    };
    const view = new InfiniteFlowView(canvas, {
      activate(physicalId, actionId, event) {
        delegateCalls.push({ physicalId, actionId, event });
      },
    });
    view.render(
      exploreModel(decision, {
        actions: testCase.actions,
        map: testCase.map ?? baseMap,
      }),
      testCase.chrome ?? { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' },
      EXPLORE_INSETS_320,
    );
    const root = canvas.children[canvas.children.length - 1];
    const target = findNode(root, 'MapWindowCell:1:0');
    assert.ok(target, `${testCase.label} target stays visibly fail-closed`);
    assert.ok(
      collectStrings(target).some((value) => value.includes('×')),
      `${testCase.label} target has a non-color disabled marker`,
    );
    emitTouch(target, 7100);
    assert.equal(delegateCalls.length, 0, `${testCase.label} dispatches no domain event`);
    view.destroy();
  }
}

{
  const decision = chapterDecisionFixture('metro_abyss');
  const crossGapEvent = Object.freeze({
    kind: 'command',
    command: Object.freeze({ type: 'run/move', nodeId: 'cross_gap' }),
  });
  const crossGapAction = Object.freeze({
    actionId: 'map.move:cross-gap',
    label: '移动至跨距节点',
    placement: 'map',
    enabled: true,
    emphasis: 'secondary',
    recommendation: 'recommended',
    event: crossGapEvent,
  });
  const wideMap = {
    dungeonId: 'metro_abyss',
    dungeonName: '镜潮地铁',
    width: 7,
    height: 5,
    currentNodeId: 'rail_patrol_wraith',
    knownEdges: [['0,0', '6,0']],
    nodes: [
      { cellId: '0,0', nodeId: 'rail_patrol_wraith', title: '轨道巡逻', nodeType: 'combat', state: 'current', stateLabel: '当前位置', stateSymbol: '◎', x: 0, y: 0, isAdjacent: false, canMove: false },
      { cellId: '6,0', nodeId: 'cross_gap', title: '跨距节点', nodeType: 'event', state: 'adjacent', stateLabel: '相邻可达', stateSymbol: '→', x: 6, y: 0, isAdjacent: true, canMove: true, moveActionId: crossGapAction.actionId },
      { cellId: '6,4', nodeId: 'far_watch', title: '远端观测站', nodeType: 'treasure', state: 'scouted', stateLabel: '已侦察', stateSymbol: '◇', x: 6, y: 4, isAdjacent: false, canMove: false },
      { cellId: '5,4', nodeId: 'secret-node-id', title: '绝密节点标题', nodeType: 'unknown', state: 'fogged', stateLabel: '绝密节点标题', stateSymbol: 'secret-node-id', x: 5, y: 4, isAdjacent: false, canMove: false },
    ],
  };
  const wideActions = [...exploreActionFixtures, crossGapAction];
  const delegateCalls = [];
  const canvas = {
    name: 'wide-map-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  view.render(
    exploreModel(decision, { actions: wideActions, map: wideMap, pending: true }),
    chrome,
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  let localTouchId = 7200;
  for (let step = 0; step < 4; step += 1) {
    emitTouch(findNode(root, 'ExploreMapPanRight'), ++localTouchId);
    root = canvas.children[canvas.children.length - 1];
  }
  for (let step = 0; step < 2; step += 1) {
    emitTouch(findNode(root, 'ExploreMapPanDown'), ++localTouchId);
    root = canvas.children[canvas.children.length - 1];
  }
  assert.equal(delegateCalls.length, 0, '7x5 panning sends no domain event');
  assert.ok(findNode(root, 'MapWindowCell:6:4'), '7x5 bottom-right node is browsable');
  const distantFog = collectStrings(findNode(root, 'MapWindowCell:5:4')).join('\n');
  assert.match(distantFog, /未知区域/);
  assert.doesNotMatch(distantFog, /绝密节点标题|secret-node-id/);

  emitTouch(findNode(root, 'ExploreCommandsToggle'), ++localTouchId);
  root = canvas.children[canvas.children.length - 1];
  assert.equal(delegateCalls.length, 0, 'map-to-command switch sends no domain event');
  const expectedActionIds = new Set([
    ...wideActions.map(({ actionId }) => actionId),
    'pending.equipment:offer-1:take',
  ]);
  const visibleActionIds = new Set();
  const commandPageCount = Math.ceil(expectedActionIds.size / 4);
  for (let page = 0; page < commandPageCount; page += 1) {
    for (const node of collectNodes(
      root,
      (candidate) => typeof candidate.name === 'string' && candidate.name.startsWith('Action:'),
    )) {
      visibleActionIds.add(node.name.slice('Action:'.length));
    }
    if (page + 1 < commandPageCount) {
      emitTouch(findNode(root, 'PageNext'), ++localTouchId);
      root = canvas.children[canvas.children.length - 1];
    }
  }
  assert.deepEqual(visibleActionIds, expectedActionIds, 'command fallback pages every original action');
  assert.ok(visibleActionIds.has('map.move:cross-gap'), 'cross-gap map action remains text-reachable');
  assert.ok(visibleActionIds.has('pending.equipment:offer-1:take'), 'pending action remains reachable');
  assert.ok(visibleActionIds.has('run.retreat'), 'retreat remains reachable');

  emitTouch(findNode(root, 'NextSection'), ++localTouchId);
  root = canvas.children[canvas.children.length - 1];
  emitTouch(findNode(root, 'NextSection'), ++localTouchId);
  root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'HelpTopic:law'), 'help directory remains reachable from map mode');
  emitTouch(findNode(root, 'NextSection'), ++localTouchId);
  root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'Log:0'), 'logs remain reachable from map mode');
  assert.equal(delegateCalls.length, 0, 'map browsing and section navigation stay local-only');
  view.destroy();
}

// === Explore/Result compact 2x2 action deck ===
// Thirty-one real Explore command shapes exercise every page. Paging and the
// map switch are local-only, while every card forwards its exact event object.
{
  const decision = chapterDecisionFixture('metro_abyss');
  const screenTitle = '探索 · 三十一项指令盘';
  const inputOrder = exploreDeckActions31.map(({ actionId }) => actionId);
  const inputSnapshot = JSON.stringify(exploreDeckActions31);
  const ordered = orderActionsForCompactReachability(exploreDeckActions31);
  const delegateCalls = [];
  const canvas = {
    name: 'explore-compact-31-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  view.render(
    exploreModel(decision, { actions: exploreDeckActions31, screenTitle }),
    chrome,
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  const rendersBeforeOpen = canvas.children.length;
  emitTouch(findNode(root, 'ExploreCommandsToggle'), 7300);
  root = canvas.children[canvas.children.length - 1];
  assert.equal(canvas.children.length, rendersBeforeOpen + 1, '31-action command toggle rerenders locally');
  assert.equal(delegateCalls.length, 0, '31-action command toggle dispatches no domain event');

  const reachedIds = [];
  let touchId = 7300;
  let staleFirstCard;
  let staleFirstNext;
  for (let page = 0; page < 8; page += 1) {
    const deck = findNode(root, 'Deck');
    const cards = collectNodes(
      deck,
      (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
    );
    const expected = ordered.slice(page * 4, page * 4 + 4);
    assert.deepEqual(
      cards.map(({ name }) => name.slice('Action:'.length)),
      expected.map(({ actionId }) => actionId),
      `31-action Explore page ${page + 1} keeps exact compact order`,
    );
    assert.equal(cards.length, page === 7 ? 3 : 4, `31-action Explore page ${page + 1} renders only real cards`);
    assert.match(
      collectStrings(findNode(deck, 'ExploreMapToggle')).join(''),
      new RegExp(`地图 · ${page + 1}/8`),
      `31-action Explore page ${page + 1} exposes its local page`,
    );
    const previous = findNode(deck, 'PagePrevious');
    const next = findNode(deck, 'PageNext');
    const mapToggle = findNode(deck, 'ExploreMapToggle');
    const deckTitle = findNode(deck, 'DeckTitle');
    for (const control of [previous, mapToggle, next]) {
      assert.ok(control.size.width >= 104 && control.size.height >= 104, `31-action page ${page + 1} control is 104+ design px`);
      assert.ok(control.size.width * 320 / 750 >= 44, `31-action page ${page + 1} control is 44+ viewport px`);
    }
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const action = expected[index];
      const slot = layoutInfiniteFlowExploreResultActionDeck(31, page).slots[index];
      reachedIds.push(action.actionId);
      assert.deepEqual([card.size.width, card.size.height], [318, 160], `31-action page ${page + 1} card geometry`);
      assert.deepEqual([card.position.x, card.position.y], [slot.x, slot.y], `31-action page ${page + 1} card ${index + 1} keeps its slot`);
      assert.equal(
        collectStrings(findNode(card, 'ExploreResultActionGlyph')).join(''),
        classifyInfiniteFlowExploreResultActionGlyph('explore', action),
        `31-action page ${page + 1} card ${index + 1} keeps its visual glyph`,
      );
      assert.equal(
        collectStrings(findNode(card, 'ActionLabel')).join(''),
        formatInfiniteFlowExploreResultActionLabel('explore', action),
        `31-action page ${page + 1} card ${index + 1} keeps player label`,
      );
      assert.equal(
        collectStrings(findNode(card, 'ActionReadout')).join(''),
        formatInfiniteFlowExploreResultActionSummary('explore', action),
        `31-action page ${page + 1} card ${index + 1} keeps player summary`,
      );
      const playerCopy = collectStrings(card).join('\n');
      assert.doesNotMatch(
        playerCopy,
        /actionId|nodeId|targetNodeId|event\.type|undefined|\b(?:legacy|neutral|recommended|secondary|high-risk|primary|danger|charge|v\d+)\b/iu,
        `31-action page ${page + 1} card ${index + 1} exposes no machine copy`,
      );
      for (const internalValue of [
        action.actionId,
        action.event.command.type,
        ...Object.entries(action.event.command)
          .filter(([key, value]) => /Ids?$/u.test(key) && typeof value === 'string')
          .map(([, value]) => value),
      ]) {
        assert.equal(playerCopy.includes(internalValue), false, `31-action page ${page + 1} hides ${internalValue}`);
      }
      assert.equal(nodesOverlap(card, deckTitle), false, `31-action page ${page + 1} card clears title`);
      assert.equal(nodesOverlap(card, previous), false, `31-action page ${page + 1} card clears previous`);
      assert.equal(nodesOverlap(card, mapToggle), false, `31-action page ${page + 1} card clears map toggle`);
      assert.equal(nodesOverlap(card, next), false, `31-action page ${page + 1} card clears next`);
      const bounds = absoluteNodeBounds(card);
      assert.ok(bounds.left >= -375 + EXPLORE_INSETS_320.left && bounds.right <= 375 - EXPLORE_INSETS_320.right, `31-action page ${page + 1} card stays horizontally safe`);
      assert.ok(bounds.top <= 667 - EXPLORE_INSETS_320.top && bounds.bottom >= -667 + EXPLORE_INSETS_320.bottom, `31-action page ${page + 1} card stays vertically safe`);
      for (let otherIndex = index + 1; otherIndex < cards.length; otherIndex += 1) {
        assert.equal(nodesOverlap(card, cards[otherIndex]), false, `31-action page ${page + 1} cards ${index + 1}/${otherIndex + 1} do not overlap`);
      }
      const callsBeforeCard = delegateCalls.length;
      const physicalTouchId = ++touchId;
      card.emit('touch-start', { getID: () => physicalTouchId, propagationStopped: false });
      card.emit('touch-end', { getID: () => physicalTouchId, propagationStopped: false });
      if (page === 0 && index === 0) {
        card.emit('touch-end', { getID: () => physicalTouchId, propagationStopped: false });
      }
      assert.equal(delegateCalls.length, callsBeforeCard + 1, `31-action page ${page + 1} card ${index + 1} dispatches once`);
      const call = delegateCalls[delegateCalls.length - 1];
      assert.equal(call.actionId, action.actionId, `31-action page ${page + 1} card ${index + 1} forwards actionId`);
      assert.equal(call.event, action.event, `31-action page ${page + 1} card ${index + 1} forwards exact event object`);
    }

    if (page === 0) {
      assert.equal(previous.listeners.size, 0, '31-action first previous control is inert');
      const rendersBeforeDisabledPrevious = canvas.children.length;
      emitTouch(previous, ++touchId);
      assert.equal(canvas.children.length, rendersBeforeDisabledPrevious, '31-action disabled previous does not rerender');
      staleFirstCard = cards[0];
      staleFirstNext = next;
    }
    if (page === 7) {
      assert.equal(next.listeners.size, 0, '31-action last next control is inert');
      const rendersBeforeDisabledNext = canvas.children.length;
      emitTouch(next, ++touchId);
      assert.equal(canvas.children.length, rendersBeforeDisabledNext, '31-action disabled next does not rerender');
    } else {
      const callsBeforeNext = delegateCalls.length;
      emitTouch(next, ++touchId);
      root = canvas.children[canvas.children.length - 1];
      assert.equal(delegateCalls.length, callsBeforeNext, `31-action page ${page + 1} next is local-only`);
      if (page === 0) {
        const callsBeforeStaleRoot = delegateCalls.length;
        const rendersBeforeStaleRoot = canvas.children.length;
        emitTouch(staleFirstCard, ++touchId);
        emitTouch(staleFirstNext, ++touchId);
        assert.equal(delegateCalls.length, callsBeforeStaleRoot, 'stale Explore card dispatches nothing');
        assert.equal(canvas.children.length, rendersBeforeStaleRoot, 'stale Explore pager does not rerender');
      }
    }
  }
  assert.deepEqual(reachedIds, ordered.map(({ actionId }) => actionId), '31 Explore actions are reachable once without omissions or duplicates');
  assert.deepEqual(delegateCalls.map(({ actionId }) => actionId), reachedIds, '31 Explore actions dispatch in visible order');

  const actionsFive = exploreDeckActions31.slice(0, 5);
  const orderedFive = orderActionsForCompactReachability(actionsFive);
  view.render(exploreModel(decision, { actions: actionsFive, screenTitle }), chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ExploreMapToggle')).join(''), /地图 · 2\/2/, '31 -> 5 clamps Explore action page to page two');
  assert.deepEqual(
    collectNodes(root, (node) => typeof node.name === 'string' && node.name.startsWith('Action:')).map(({ name }) => name.slice('Action:'.length)),
    orderedFive.slice(4).map(({ actionId }) => actionId),
    'five-action last page renders its one real card in the first fixed slot',
  );
  const previousFromFive = findNode(root, 'PagePrevious');
  assert.ok(previousFromFive.listeners.size > 0, 'five-action page two previous is enabled');

  const oneAction = [exploreDeckActions31[0]];
  view.render(exploreModel(decision, { actions: oneAction, screenTitle }), chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ExploreMapToggle')).join(''), /地图 · 1\/1/, '5 -> 1 clamps Explore action page to page one');
  const finalCards = collectNodes(root, (node) => typeof node.name === 'string' && node.name.startsWith('Action:'));
  assert.deepEqual(finalCards.map(({ name }) => name), [`Action:${oneAction[0].actionId}`], 'one-action page renders no empty card placeholders');
  assert.equal(findNode(root, 'PagePrevious').listeners.size, 0, 'one-action previous is inert');
  assert.equal(findNode(root, 'PageNext').listeners.size, 0, 'one-action next is inert');

  const callsBeforeDestroy = delegateCalls.length;
  const rendersBeforeDestroy = canvas.children.length;
  const cardBeforeDestroy = finalCards[0];
  view.destroy();
  emitTouch(cardBeforeDestroy, ++touchId);
  emitTouch(previousFromFive, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeDestroy, 'destroyed Explore card dispatches nothing');
  assert.equal(canvas.children.length, rendersBeforeDestroy, 'destroyed Explore pager does not rerender');
  assert.deepEqual(exploreDeckActions31.map(({ actionId }) => actionId), inputOrder, 'Explore renderer never reorders the input array');
  assert.equal(JSON.stringify(exploreDeckActions31), inputSnapshot, 'Explore renderer never mutates an action or event');
}

for (const [label, actionOverrides, chromeOverrides, expectedReason] of [
  [
    'disabled',
    {
      enabled: false,
      event: undefined,
      disabledReason: 'run/select-node nodeId=enemy_node_8 legacy recommended secondary high-risk',
    },
    {},
    '当前选项不可用。',
  ],
  ['missing-event', { event: undefined }, {}, '选项事件缺失。'],
  ['busy', {}, { busyActionId: 'node.select:enemy-8' }, '行动处理中。'],
  ['blocked', {}, { modeKind: 'blocked', blockingMessage: 'fixture blocked' }, '运行已阻断。'],
]) {
  const sourceAction = exploreDeckActionFixture(7);
  const action = Object.freeze({ ...sourceAction, ...actionOverrides });
  const originalEvent = action.event;
  const delegateCalls = [];
  const canvas = {
    name: `explore-compact-${label}-canvas`,
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const model = exploreModel(chapterDecisionFixture('metro_abyss'), {
    actions: [action],
    screenTitle: `探索 · 锁定态 ${label}`,
  });
  const previewChrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  view.render(model, previewChrome, EXPLORE_INSETS_320);
  let root = canvas.children[canvas.children.length - 1];
  emitTouch(findNode(root, 'ExploreCommandsToggle'), 7500);
  if (Object.keys(chromeOverrides).length > 0) {
    view.render(model, { ...previewChrome, ...chromeOverrides }, EXPLORE_INSETS_320);
  }
  root = canvas.children[canvas.children.length - 1];
  const card = findNode(root, `Action:${action.actionId}`);
  const playerCopy = collectStrings(card).join('\n');
  assert.equal(card.listeners.size, 0, `${label} Explore card has no listener`);
  assert.ok(card.children.every((child) => child.listeners.size === 0), `${label} Explore child labels have no listener`);
  assert.match(playerCopy, /× 锁定/, `${label} Explore card has non-color lock state`);
  assert.match(playerCopy, new RegExp(expectedReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} Explore card explains why it is locked`);
  assert.doesNotMatch(playerCopy, /★ 推荐/, `${label} Explore lock overrides recommendation`);
  assert.doesNotMatch(playerCopy, /run\/select-node|nodeId|enemy_node_8|legacy|recommended|secondary|high-risk/iu, `${label} Explore lock exposes no machine copy`);
  emitTouch(card, 7501);
  assert.equal(delegateCalls.length, 0, `${label} Explore card dispatches nothing`);
  assert.equal(action.event, originalEvent, `${label} Explore state keeps exact event identity`);
  view.destroy();
}

{
  const delegateCalls = [];
  const canvas = {
    name: 'explore-compact-malicious-copy-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  view.render(
    exploreModel(chapterDecisionFixture('metro_abyss'), {
      actions: [maliciousCompactAction],
      screenTitle: '探索 · 安全文案',
    }),
    { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' },
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  emitTouch(findNode(root, 'ExploreCommandsToggle'), 7600);
  root = canvas.children[canvas.children.length - 1];
  const card = findNode(root, `Action:${maliciousCompactAction.actionId}`);
  const playerCopy = collectStrings(card).join('\n');
  assert.match(playerCopy, /施展器魂能力/);
  assert.match(playerCopy, /调整当前器魂能力/);
  assert.doesNotMatch(playerCopy, /soul-skill|node\/use|internal_skill|secret_target_node|targetNodeId|legacy|neutral|recommended|secondary|high-risk/iu);
  const touchId = 7601;
  card.emit('touch-start', { getID: () => touchId, propagationStopped: false });
  card.emit('touch-end', { getID: () => touchId, propagationStopped: false });
  card.emit('touch-end', { getID: () => touchId, propagationStopped: false });
  assert.equal(delegateCalls.length, 1, 'malicious-copy card dispatches once');
  assert.equal(delegateCalls[0].actionId, maliciousCompactAction.actionId, 'malicious-copy card keeps actionId');
  assert.equal(delegateCalls[0].event, maliciousCompactEvent, 'malicious-copy card keeps exact event identity');
  view.destroy();
}

{
  const decision = chapterDecisionFixture('metro_abyss');
  const initialMap = exploreModel(decision).sections[1].detail.map;
  const farMap = {
    ...initialMap,
    width: 7,
    height: 5,
    currentNodeId: 'far_watch',
    knownEdges: [],
    nodes: [
      { cellId: '0,0', nodeId: 'old_current', title: '旧位置', nodeType: 'event', state: 'cleared', stateLabel: '已清理', stateSymbol: '✓', x: 0, y: 0, isAdjacent: false, canMove: false },
      { cellId: '6,4', nodeId: 'far_watch', title: '远端观测站', nodeType: 'event', state: 'current', stateLabel: '当前位置', stateSymbol: '◎', x: 6, y: 4, isAdjacent: false, canMove: false },
    ],
  };
  const farCurrent = {
    nodeId: 'far_watch',
    title: '远端观测站',
    nodeType: 'event',
    description: 'fixture',
    cleared: false,
  };
  const canvas = {
    name: 'map-current-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, { activate() {} });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  view.render(exploreModel(decision), chrome, EXPLORE_INSETS_320);
  view.render(
    exploreModel(decision, { map: farMap, currentNode: farCurrent }),
    chrome,
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'MapWindowCell:6:4'), 'same-screen current change re-centers the map');
  emitTouch(findNode(root, 'ExploreCommandsToggle'), 7301);
  root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'ExploreMapToggle'));
  view.render(
    exploreModel(decision, { screenTitle: '探索 · 新屏幕' }),
    chrome,
    EXPLORE_INSETS_320,
  );
  root = canvas.children[canvas.children.length - 1];
  assert.ok(findNode(root, 'ExploreMapWindow'), 'screen-key change resets command mode to map');
  assert.ok(findNode(root, 'MapWindowCell:0:0'), 'screen-key change keeps current in the window');
  view.destroy();
}

{
  const delegateCalls = [];
  const canvas = {
    name: 'canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  let touchId = 0;

  for (const [label, insets] of [['320x568', EXPLORE_INSETS_320], ['390x844', EXPLORE_INSETS_390]]) {
    assert.ok(
      1334 - insets.top - insets.bottom >= INFINITE_FLOW_SAFE_CONTENT_MINIMUM.height,
      `${label} safe height gate`,
    );
    assert.ok(
      750 - insets.left - insets.right >= INFINITE_FLOW_SAFE_CONTENT_MINIMUM.width,
      `${label} safe width gate`,
    );
    view.render(exploreModel(chapterDecisionFixture('metro_abyss')), chrome, insets);
    let root = canvas.children[canvas.children.length - 1];
    assert.equal(root.name, 'InfiniteFlowRuntimeView');
    assert.ok(
      !collectStrings(root).some((value) => value.includes('undefined')),
      `${label} rendered strings are undefined-free`,
    );
    const status = findNode(root, 'Status');
    assert.ok(findNode(status, 'ExploreEncounterCard'), `${label} current encounter remains in status`);
    assert.match(collectStrings(findNode(status, 'ExploreEncounterCard')).join('\n'), /轨道巡逻.*待处理/s);
    assert.equal(
      collectNodes(status, (node) => typeof node.name === 'string' && node.name.startsWith('Map:')).length,
      0,
      `${label} status does not duplicate the full map`,
    );
    assert.ok(findNode(status, 'ExploreCompass'), `${label} status has a four-way compass`);
    assert.equal(collectStrings(findNode(status, 'Compass:east')).join(''), '→');
    assert.equal(collectStrings(findNode(status, 'Compass:south')).join(''), '?');
    assert.equal(collectStrings(findNode(status, 'CompassCenter')).join(''), '◎');
    const statusText = collectStrings(status).join('\n');
    assert.doesNotMatch(
      statusText,
      /rail_patrol_wraith|east_hall|south_tunnel|map\.move|actionId|undefined|key=/,
      `${label} compact status exposes no internal identity`,
    );
    assert.ok(findNode(status, 'ChapterCodexSummary'), `${label} status keeps only a chapter summary`);
    assert.doesNotMatch(statusText, /末班潮序|承伤不超过 50|pending_first/);
    const removedLegacyPagerName = ['Chapter', 'Decision', 'Advance'].join('');
    assert.equal(findNode(root, removedLegacyPagerName), undefined, `${label} has no invisible legacy pager`);
    const metricNodes = collectNodes(status, (node) => typeof node.name === 'string' && node.name.startsWith('ExploreMetric:'));
    assert.deepEqual(
      metricNodes.map(({ name }) => name),
      ['ExploreMetric:hp', 'ExploreMetric:loot', 'ExploreMetric:cleared', 'ExploreMetric:pressure', 'ExploreMetric:boss-seal', 'ExploreMetric:law'],
      `${label} all six status metrics retain VM order`,
    );
    assert.deepEqual(
      metricNodes.map((node) => collectStrings(findNode(node, 'MetricValue')).join('').replaceAll('\n', '')),
      ['42/60', '85', '2/9', '稳定', '0/1 未解除', '雾压0/3'],
      `${label} display-only wrapping preserves every metric value glyph`,
    );
    assert.deepEqual(
      metricNodes.map((node) => collectStrings(findNode(node, 'MetricLabel')).join('').replaceAll('\n', '')),
      ['生命', '袋中奖励点', '已清理', '侵蚀', '出口封印', '妖雾压境'],
      `${label} all six metric labels remain visible`,
    );
    assert.deepEqual(
      metricNodes.map((node) => collectStrings(findNode(node, 'MetricSymbol')).join('')),
      ['♥', '袋', '✓', '侵', '锁', '律'],
      `${label} all six metric sigils remain visible`,
    );
    for (const metricNode of metricNodes) {
      assert.ok(labelComponent(findNode(metricNode, 'MetricSymbol')).fontSize >= 30, `${label} metric sigil is prominent`);
      assert.ok(labelComponent(findNode(metricNode, 'MetricValue')).fontSize >= 27, `${label} metric value is prominent`);
      assert.notEqual(labelComponent(findNode(metricNode, 'MetricValue')).overflow, 2, `${label} metric value never uses SHRINK`);
      for (const lowerNodeName of ['ExploreEncounterCard', 'ExploreCompass', 'ChapterCodexSummary', 'ChapterCodexOpen']) {
        assert.equal(nodesOverlap(metricNode, findNode(status, lowerNodeName)), false, `${label} ${metricNode.name} clears ${lowerNodeName}`);
      }
    }
    for (let leftIndex = 0; leftIndex < metricNodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < metricNodes.length; rightIndex += 1) {
        assert.equal(nodesOverlap(metricNodes[leftIndex], metricNodes[rightIndex]), false, `${label} metric HUD chips do not overlap`);
      }
    }
    if (findNode(root, 'ExploreMapWindow') === undefined) {
      const callsBeforeReturn = delegateCalls.length;
      emitTouch(findNode(root, 'ExploreMapToggle'), ++touchId);
      root = canvas.children[canvas.children.length - 1];
      assert.equal(delegateCalls.length, callsBeforeReturn, `${label} map toggle is local-only`);
    }
    const mapWindow = findNode(root, 'ExploreMapWindow');
    assert.ok(mapWindow, `${label} explore action deck defaults to the map window`);
    assert.equal(findNode(root, 'PagePrevious'), undefined, `${label} map avoids pager overlap`);
    assert.equal(findNode(root, 'PageNext'), undefined, `${label} map avoids pager overlap`);
    const mapCells = collectNodes(
      mapWindow,
      (node) => typeof node.name === 'string' && node.name.startsWith('MapWindowCell:'),
    );
    assert.ok(mapCells.length > 0 && mapCells.length <= 9, `${label} map has at most nine nodes`);
    const viewportWidth = Number.parseInt(label, 10);
    for (const node of [
      ...mapCells,
      findNode(root, 'ExploreMapPanUp'),
      findNode(root, 'ExploreMapPanLeft'),
      findNode(root, 'ExploreMapPanRight'),
      findNode(root, 'ExploreMapPanDown'),
      findNode(root, 'ExploreCommandsToggle'),
    ]) {
      assert.ok(node?.size.width >= 104 && node?.size.height >= 104, `${label} map touch target is 104 design px`);
      assert.ok(node.size.width * viewportWidth / 750 >= 44, `${label} map touch width is at least 44 viewport px`);
      assert.ok(node.size.height * viewportWidth / 750 >= 44, `${label} map touch height is at least 44 viewport px`);
    }
    const highestCellTop = mapWindow.position.y + Math.max(
      ...mapWindow.children
        .filter((node) => node.name.startsWith('MapWindowCell:') || node.name.startsWith('MapWindowEmpty:'))
        .map((node) => node.position.y + node.size.height / 2),
    );
    const deckTitle = findNode(root, 'DeckTitle');
    assert.ok(highestCellTop < deckTitle.position.y - deckTitle.size.height / 2, `${label} map clears the deck title`);

    const callsBeforeCommands = delegateCalls.length;
    emitTouch(findNode(root, 'ExploreCommandsToggle'), ++touchId);
    root = canvas.children[canvas.children.length - 1];
    assert.equal(delegateCalls.length, callsBeforeCommands, `${label} command toggle is local-only`);
    const mapToggle = findNode(root, 'ExploreMapToggle');
    assert.ok(mapToggle, `${label} command deck can return to map`);
    assert.ok(mapToggle.size.width >= 104 && mapToggle.size.height >= 104, `${label} return toggle is 104 design px`);
    assert.ok(mapToggle.size.width * viewportWidth / 750 >= 44, `${label} return toggle is at least 44 viewport px`);
    const previousPage = findNode(root, 'PagePrevious');
    const nextPage = findNode(root, 'PageNext');
    assert.ok(
      previousPage.position.x + previousPage.size.width / 2
        < mapToggle.position.x - mapToggle.size.width / 2,
      `${label} map toggle clears previous-page control`,
    );
    assert.ok(
      mapToggle.position.x + mapToggle.size.width / 2
        < nextPage.position.x - nextPage.size.width / 2,
      `${label} map toggle clears next-page control`,
    );
    assert.ok(
      collectStrings(findNode(root, 'DeckTitle')).some((value) => value.includes('指令')),
      `${label} command mode is explicit`,
    );
    assert.equal(
      collectStrings(findNode(root, 'DeckHint')).join(''),
      '2×2 探索指令盘 · 单触控单指令',
      `${label} command deck explains the 2x2 one-touch contract`,
    );
    const compactExploreCards = collectNodes(
      root,
      (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
    );
    const actionDeck = findNode(root, 'Deck');
    const actionDeckTitle = findNode(actionDeck, 'DeckTitle');
    const firstPageLayout = layoutInfiniteFlowExploreResultActionDeck(
      exploreActionFixtures.length,
      0,
    );
    assert.equal(compactExploreCards.length, 4, `${label} renders all four real actions in the first page`);
    for (let cardIndex = 0; cardIndex < compactExploreCards.length; cardIndex += 1) {
      const compactExploreCard = compactExploreCards[cardIndex];
      const slot = firstPageLayout.slots[cardIndex];
      assert.deepEqual(
        [compactExploreCard.size.width, compactExploreCard.size.height],
        [318, 160],
        `${label} Explore command deck uses the shared 2x2 card geometry`,
      );
      assert.deepEqual(
        [compactExploreCard.position.x, compactExploreCard.position.y],
        [slot.x, slot.y],
        `${label} Explore card ${cardIndex + 1} keeps its fixed slot`,
      );
      assert.ok(findNode(compactExploreCard, 'ExploreResultActionGlyph'), `${label} Explore card has a visual glyph`);
      assert.ok(compactExploreCard.size.width * viewportWidth / 750 >= 44, `${label} Explore card width is 44+ viewport px`);
      assert.ok(compactExploreCard.size.height * viewportWidth / 750 >= 44, `${label} Explore card height is 44+ viewport px`);
      assert.equal(nodesOverlap(compactExploreCard, actionDeckTitle), false, `${label} Explore card clears the deck title`);
      assert.equal(nodesOverlap(compactExploreCard, previousPage), false, `${label} Explore card clears previous page`);
      assert.equal(nodesOverlap(compactExploreCard, nextPage), false, `${label} Explore card clears next page`);
      assert.equal(nodesOverlap(compactExploreCard, mapToggle), false, `${label} Explore card clears map toggle`);
      const cardBounds = absoluteNodeBounds(compactExploreCard);
      assert.ok(cardBounds.left >= -375 + insets.left && cardBounds.right <= 375 - insets.right, `${label} Explore card stays in horizontal safe inset`);
      assert.ok(cardBounds.top <= 667 - insets.top && cardBounds.bottom >= -667 + insets.bottom, `${label} Explore card stays in vertical safe inset`);
    }
    for (let leftIndex = 0; leftIndex < compactExploreCards.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < compactExploreCards.length; rightIndex += 1) {
        assert.equal(nodesOverlap(compactExploreCards[leftIndex], compactExploreCards[rightIndex]), false, `${label} Explore cards do not overlap`);
      }
    }
    for (const pageControl of [previousPage, mapToggle, nextPage]) {
      assert.ok(pageControl.size.width >= 104 && pageControl.size.height >= 104, `${label} action page control is 104+ design px`);
      assert.ok(pageControl.size.width * viewportWidth / 750 >= 44, `${label} action page control width is 44+ viewport px`);
      assert.ok(pageControl.size.height * viewportWidth / 750 >= 44, `${label} action page control height is 44+ viewport px`);
    }
    assert.equal(findNode(root, 'HubActionGlyph'), undefined, `${label} non-Hub deck never adopts Hub glyphs`);
    // The action deck keeps presentation order; rendering never re-sorts.
    const actionNames = collectNodes(
      root,
      (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
    ).map((node) => node.name);
    const expectedActionNames = orderActionsForCompactReachability(exploreActionFixtures)
      .slice(0, 4)
      .map((action) => `Action:${action.actionId}`);
    assert.deepEqual(actionNames, expectedActionNames, `${label} action order is unchanged`);

    // Open/close and paging are View-local. The full-screen scroll keeps every
    // logical chapter section reachable in strict order without shrinking text.
    const callsBeforeOpen = delegateCalls.length;
    const open = findNode(root, 'ChapterCodexOpen');
    assert.ok(open, `${label} chapter scroll has an explicit opener`);
    assert.ok(open.size.width >= 104 && open.size.height >= 104, `${label} opener is 104 design px`);
    assert.ok(open.size.width * viewportWidth / 750 >= 44, `${label} opener is at least 44 viewport px`);
    emitTouch(open, ++touchId);
    root = canvas.children[canvas.children.length - 1];
    assert.equal(delegateCalls.length, callsBeforeOpen, `${label} opening codex is local-only`);

    const markers = [
      { source: 'law', title: '场域法则', pattern: /末班潮序/ },
      { source: 'directive', title: '主神指令', pattern: /承伤不超过 50/ },
      { source: 'route', title: '路线契约', pattern: /章规说明：先清理北线轨道游魂/ },
      { source: 'pressure', title: '侵蚀段位', pattern: /段位 稳定/ },
      { source: 'pursuit', title: '破界追兵', pattern: /镜潮尾影/ },
    ];
    for (let pageIndex = 0; pageIndex < markers.length; pageIndex += 1) {
      const marker = markers[pageIndex];
      const overlay = findNode(root, 'ChapterCodexOverlay');
      const dialog = findNode(overlay, 'ChapterCodexDialog');
      const parchment = findNode(dialog, 'ChapterCodexParchment');
      assert.ok(overlay && dialog && parchment, `${label} ${marker.source} scroll geometry exists`);
      assert.ok(hasComponentNamed(overlay, 'BlockInputEvents'), `${label} scroll blocks input behind it`);
      assert.match(collectStrings(findNode(dialog, 'ChapterCodexKicker')).join(''), new RegExp(`${pageIndex + 1} / 5`));
      assert.match(collectStrings(findNode(dialog, 'ChapterCodexTitle')).join(''), new RegExp(marker.title));
      assert.ok(marker.pattern.test(collectStrings(parchment).join('')), `${label} ${marker.source} page is reachable`);
      assert.ok(labelComponent(findNode(dialog, 'ChapterCodexTitle')).fontSize >= 32, `${label} scroll title is readable`);
      const bodyLabels = collectNodes(parchment, (node) => node.name.startsWith('ChapterCodexLine:'));
      assert.ok(bodyLabels.length > 0, `${label} ${marker.source} body exists`);
      for (const lineNode of bodyLabels) {
        const component = labelComponent(lineNode);
        assert.ok(component.fontSize >= 34, `${label} ${marker.source} body uses 34 design px`);
        assert.notEqual(component.overflow, 2, `${label} ${marker.source} body never shrinks`);
      }
      const dialogBounds = absoluteNodeBounds(dialog);
      assert.ok(dialogBounds.left >= -375 + insets.left && dialogBounds.right <= 375 - insets.right, `${label} scroll stays inside horizontal safe inset`);
      assert.ok(dialogBounds.top <= 667 - insets.top && dialogBounds.bottom >= -667 + insets.bottom, `${label} scroll stays inside vertical safe inset`);
      const previous = findNode(dialog, 'ChapterCodexPrevious');
      const close = findNode(dialog, 'ChapterCodexClose');
      const next = findNode(dialog, 'ChapterCodexNext');
      for (const control of [previous, close, next]) {
        assert.ok(control.size.width >= 104 && control.size.height >= 104, `${label} codex control is 104 design px`);
        assert.ok(control.size.width * viewportWidth / 750 >= 44, `${label} codex control width is at least 44 viewport px`);
        assert.ok(control.size.height * viewportWidth / 750 >= 44, `${label} codex control height is at least 44 viewport px`);
        assert.equal(nodesOverlap(control, parchment), false, `${label} codex control clears parchment`);
      }
      assert.equal(nodesOverlap(previous, close), false, `${label} previous clears close`);
      assert.equal(nodesOverlap(close, next), false, `${label} close clears next`);
      if (pageIndex === 0) {
        assert.equal(previous.listeners.size, 0, `${label} first-page previous is inert`);
        assert.match(collectStrings(previous).join(''), /× ‹ 上一页/);

        // Exact action/event identity and one physical touch -> one activation.
        const lawHelp = findNode(dialog, 'ChapterCodexHelp');
        assert.ok(lawHelp, `${label} law help button exists`);
        assert.ok(lawHelp.size.width >= 104 && lawHelp.size.height >= 104, `${label} law help target is 104 design px`);
        const callsBeforeHelp = delegateCalls.length;
        const helpTouchId = ++touchId;
        lawHelp.emit('touch-start', { getID: () => helpTouchId, propagationStopped: false });
        lawHelp.emit('touch-end', { getID: () => helpTouchId, propagationStopped: false });
        lawHelp.emit('touch-end', { getID: () => helpTouchId, propagationStopped: false });
        assert.equal(delegateCalls.length - callsBeforeHelp, 1, `${label} help duplicate touch-end activates once`);
        const helpCall = delegateCalls[delegateCalls.length - 1];
        assert.equal(helpCall.physicalId, `cocos-touch:${helpTouchId}`);
        assert.equal(helpCall.actionId, chapterHelpEntries[0].openAction.actionId);
        assert.equal(helpCall.event, chapterHelpEntries[0].openAction.event, `${label} help forwards the same event object`);
      }
      if (marker.source === 'route') {
        assert.equal(findNode(dialog, 'ChapterCodexHelp'), undefined, `${label} route does not invent a help action`);
      }
      const visibleScrollText = collectStrings(overlay).join('\n');
      assert.doesNotMatch(
        visibleScrollText,
        /rail_patrol_wraith|tide_boatman_reflection|pending_first|\b(?:warning|active|stable|dormant|unknown)\b|actionId|undefined|key=/iu,
        `${label} ${marker.source} page exposes no internal values`,
      );
      if (pageIndex + 1 < markers.length) {
        const callsBeforeNext = delegateCalls.length;
        emitTouch(next, ++touchId);
        root = canvas.children[canvas.children.length - 1];
        assert.equal(delegateCalls.length, callsBeforeNext, `${label} next page is local-only`);
      } else {
        assert.equal(next.listeners.size, 0, `${label} last-page next is inert`);
        assert.match(collectStrings(next).join(''), /× 下一页 ›/);
        const callsBeforeClose = delegateCalls.length;
        emitTouch(close, ++touchId);
        root = canvas.children[canvas.children.length - 1];
        assert.equal(delegateCalls.length, callsBeforeClose, `${label} close is local-only`);
        assert.equal(findNode(root, 'ChapterCodexOverlay'), undefined, `${label} close removes the scroll`);
      }
    }

    assert.ok(
      !delegateCalls.some((call) => call.event.kind === 'command'),
      `${label} chapter UI dispatches no command`,
    );
  }

  // Pending coexistence: the pending equipment offer keeps its action while the
  // compact chapter summary remains available beside it.
  const coexistCanvas = {
    name: 'coexist-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const coexistView = new InfiniteFlowView(coexistCanvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  coexistView.render(
    exploreModel(chapterDecisionFixture('metro_abyss'), { pending: true }),
    chrome,
    EXPLORE_INSETS_390,
  );
  let root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.ok(findNode(root, 'ChapterCodexSummary'), 'chapter summary survives pending coexistence');
  assert.doesNotMatch(collectStrings(findNode(root, 'Status')).join('\n'), /末班潮序/);
  const callsBeforePendingCommands = delegateCalls.length;
  emitTouch(findNode(root, 'ExploreCommandsToggle'), ++touchId);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.equal(
    delegateCalls.length,
    callsBeforePendingCommands,
    'pending command toggle is local-only',
  );
  assert.ok(
    findNode(root, 'Action:pending.equipment:offer-1:take'),
    'pending offer action stays reachable',
  );

  // Equipment-memory page precedes the five decision pages. Its VM help ID is
  // not enough by itself: without a matching HelpSection entry it stays inert.
  coexistView.render(
    exploreModel(chapterDecisionFixture('metro_abyss'), { memoryHunt: memoryHuntFixture }),
    chrome,
    EXPLORE_INSETS_390,
  );
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.ok(findNode(root, 'ChapterCodexSummary'));
  assert.equal(findNode(root, 'EquipmentMemoryHuntTitle'), undefined, 'decision status remains a summary only');
  const callsBeforeMemoryOpen = delegateCalls.length;
  emitTouch(findNode(root, 'ChapterCodexOpen'), ++touchId);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.equal(delegateCalls.length, callsBeforeMemoryOpen, 'memory codex open is local-only');
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /1 \/ 6/);
  assert.match(collectStrings(findNode(root, 'ChapterCodexTitle')).join(''), /装备记忆狩猎/);
  assert.match(collectStrings(findNode(root, 'ChapterCodexParchment')).join(''), /双信号 1\/2/);
  const unavailableMemoryHelp = findNode(root, 'ChapterCodexHelp');
  assert.ok(unavailableMemoryHelp, 'authoritative memory help slot is visibly disabled when HelpSection has no match');
  assert.equal(unavailableMemoryHelp.listeners.size, 0);
  assert.match(collectStrings(unavailableMemoryHelp).join(''), /× 帮助/);
  emitTouch(findNode(root, 'ChapterCodexNext'), ++touchId);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /2 \/ 6/);
  assert.ok(
    collectStrings(findNode(root, 'ChapterCodexParchment')).some((value) => /末班潮序/.test(value)),
    'law page follows the memory page',
  );

  // A rerender invalidates controls from the old rendered root.
  const staleNext = findNode(root, 'ChapterCodexNext');
  const staleClose = findNode(root, 'ChapterCodexClose');
  const staleHelp = findNode(root, 'ChapterCodexHelp');
  emitTouch(staleNext, ++touchId);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /3 \/ 6/);
  const callsBeforeStaleRoot = delegateCalls.length;
  const childrenBeforeStaleRoot = coexistCanvas.children.length;
  emitTouch(staleNext, ++touchId);
  emitTouch(staleClose, ++touchId);
  emitTouch(staleHelp, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeStaleRoot, 'stale overlay help is inert');
  assert.equal(coexistCanvas.children.length, childrenBeforeStaleRoot, 'stale overlay controls do not rerender');

  // Removing memory changes the content signature and resets to the new law
  // page, so no stale page from the old six-page set can remain visible.
  const changedDecision = chapterDecisionFixture('metro_abyss', {
    directive: {
      ...chapterDirectiveFixtures.metro_abyss,
      progressText: '1/3 已满足',
    },
  });
  coexistView.render(exploreModel(changedDecision), chrome, EXPLORE_INSETS_390);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /1 \/ 5/);
  assert.match(collectStrings(findNode(root, 'ChapterCodexParchment')).join(''), /末班潮序/);
  assert.doesNotMatch(collectStrings(findNode(root, 'ChapterCodexOverlay')).join('\n'), /狩猎进行中/);

  // Changing the decision payload on the same screen also resets a later page.
  emitTouch(findNode(root, 'ChapterCodexNext'), ++touchId);
  emitTouch(findNode(coexistCanvas.children[coexistCanvas.children.length - 1], 'ChapterCodexNext'), ++touchId);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /3 \/ 5/);
  const changedAgainDecision = chapterDecisionFixture('metro_abyss', {
    directive: {
      ...chapterDirectiveFixtures.metro_abyss,
      rewardPreview: '灵蕴 x9',
    },
  });
  coexistView.render(exploreModel(changedAgainDecision), chrome, EXPLORE_INSETS_390);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'ChapterCodexKicker')).join(''), /1 \/ 5/, 'decision signature change resets to page one');

  // Busy leaves the scroll visible but removes both opener/help listeners with
  // a non-colour × boundary; blocked adds the global blocker and exposes no help.
  coexistView.render(
    exploreModel(changedAgainDecision),
    { ...chrome, busyActionId: 'soul-recharge.activate:fixture' },
    EXPLORE_INSETS_390,
  );
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.equal(findNode(root, 'ChapterCodexOpen').listeners.size, 0, 'busy codex opener is inert');
  assert.match(collectStrings(findNode(root, 'ChapterCodexOpen')).join(''), /×/);
  assert.equal(findNode(root, 'ChapterCodexHelp').listeners.size, 0, 'busy codex help is inert');
  assert.match(collectStrings(findNode(root, 'ChapterCodexHelp')).join(''), /× 帮助/);
  coexistView.render(
    exploreModel(changedAgainDecision),
    { ...chrome, modeKind: 'blocked', blockingMessage: '宿主边界已阻断' },
    EXPLORE_INSETS_390,
  );
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  assert.ok(findNode(root, 'RuntimeBlockedOverlay'), 'blocked render keeps the global blocker');
  assert.equal(findNode(root, 'ChapterCodexOpen').listeners.size, 0, 'blocked codex opener is inert');
  assert.equal(findNode(root, 'ChapterCodexHelp'), undefined, 'blocked render exposes no codex help target');

  coexistView.render(exploreModel(changedAgainDecision), chrome, EXPLORE_INSETS_390);
  root = coexistCanvas.children[coexistCanvas.children.length - 1];
  const destroyStaleControls = [
    findNode(root, 'ChapterCodexPrevious'),
    findNode(root, 'ChapterCodexClose'),
    findNode(root, 'ChapterCodexNext'),
    findNode(root, 'ChapterCodexHelp'),
  ];

  // After destroy, captured controls stay inert: no delegate traffic and no
  // re-render escapes the destroyed view.
  const callsBeforeDestroy = delegateCalls.length;
  const childrenBeforeDestroy = coexistCanvas.children.length;
  assert.doesNotThrow(() => coexistView.destroy());
  for (const control of destroyStaleControls) emitTouch(control, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeDestroy, 'post-destroy touches are inert');
  assert.equal(coexistCanvas.children.length, childrenBeforeDestroy, 'post-destroy touch re-renders nothing');

  // No decision: memory-only status stays honest, and a fully empty chapter
  // gets an explicit legend without any hidden pager or invented help target.
  const absenceCanvas = {
    name: 'absence-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const absenceCalls = [];
  const absenceView = new InfiniteFlowView(absenceCanvas, {
    activate(physicalId, actionId, event) { absenceCalls.push({ physicalId, actionId, event }); },
  });
  absenceView.render(exploreModel(undefined, { memoryHunt: memoryHuntFixture }), chrome, EXPLORE_INSETS_320);
  let absenceRoot = absenceCanvas.children[absenceCanvas.children.length - 1];
  assert.ok(findNode(absenceRoot, 'EquipmentMemoryHuntTitle'), 'memory-only Explore status remains visible');
  assert.equal(findNode(absenceRoot, 'ChapterCodexOpen'), undefined);
  assert.equal(findNode(absenceRoot, 'ChapterCodexOverlay'), undefined);
  absenceView.render(exploreModel(undefined), chrome, EXPLORE_INSETS_320);
  absenceRoot = absenceCanvas.children[absenceCanvas.children.length - 1];
  assert.ok(findNode(absenceRoot, 'ExploreStatusEmptyTitle'), 'no-decision/no-memory state is explicit');
  assert.ok(findNode(absenceRoot, 'ExploreStatusEmptyLegend'), 'empty Explore status keeps a concise compass legend');
  assert.equal(findNode(absenceRoot, 'ChapterCodexOpen'), undefined);
  assert.equal(absenceCalls.length, 0, 'absence states do not dispatch');
  absenceView.destroy();
}

// === Combat chapter context ===
// The combat status panel renders a compact law + pursuit readout beside the
// HP bars, intent, and boss readout. The context is read-only and adds no
// commands; the full law/pursuit semantics stay in the existing help deck.
function combatModel(context, options = {}) {
  const actions = options.actions ?? [
    {
      actionId: 'combat.action:attack', label: '普通攻击', placement: 'combat',
      enabled: true, emphasis: 'secondary', recommendation: 'recommended',
      combatAction: 'attack',
      event: { kind: 'command', command: { type: 'combat/act', action: 'attack' } },
    },
    {
      actionId: 'combat.action:guard', label: '防御', placement: 'combat',
      enabled: true, emphasis: 'secondary', recommendation: 'neutral',
      combatAction: 'guard',
      event: { kind: 'command', command: { type: 'combat/act', action: 'guard' } },
    },
  ];
  const risks = [];
  if (options.lawDanger) {
    risks.push({ id: 'combat-law-danger', severity: 'danger', label: `场域危险：${context.law.title}`, reason: 'danger' });
  }
  if (options.pursuitActive) {
    risks.push({ id: 'combat-pursuit-active', severity: 'warning', label: `追兵：${context.pursuit.name}`, reason: 'stalking' });
  }
  return {
    schemaVersion: 1,
    phase: 'combat',
    screenTitle: `战斗 · ${context.dungeonName}`,
    dispatchPolicy: 'one-event-per-action',
    tasks: [],
    sections: [
      { kind: 'objective', title: '战斗', summary: '击败敌人。' },
      {
        kind: 'status',
        metrics: [
          { id: 'player-hp', label: '我方生命', value: '42/60', symbol: '我', severity: 'warning' },
          { id: 'enemy-hp', label: '敌方生命', value: '30/80', symbol: '敌', severity: 'neutral' },
          { id: 'turn', label: '回合', value: '3', symbol: '回', severity: 'neutral' },
          { id: 'attack', label: '攻击/术强', value: '26/18', symbol: '攻', severity: 'neutral' },
          { id: 'intent', label: '敌方意图', value: '常规追击', symbol: '眼', severity: 'neutral' },
          { id: 'reward-points', label: '奖励点', value: '85', symbol: '点', severity: 'neutral' },
          { id: 'lingyun', label: '灵蕴', value: '3', symbol: '蕴', severity: 'neutral' },
        ],
        detail: {
          kind: 'combat',
          player: { hp: 42, maxHp: 60, hpPercent: 70 },
          enemy: { id: 'tide_boatman', name: '潮影船夫', hp: 30, maxHp: 80, hpPercent: 37, ability: '影子先于身体压来。', ...options.enemy },
          intent: options.intent ?? {
            id: 'regular-pursuit',
            name: '常规追击',
            severity: 'normal',
            consequence: '敌人将进行常规反击。',
            recommendedActions: ['guard'],
            dangerousActions: [],
          },
          ...(options.boss === undefined ? {} : { boss: options.boss }),
          turn: options.turn ?? 3,
          advancedExpanded: false,
          focus: options.focus ?? { current: 0, required: 3 },
          guarding: options.guarding ?? false,
          chapterContext: context,
          ...(options.equipmentMemory === undefined
            ? {}
            : { equipmentMemory: options.equipmentMemory }),
        },
      },
      { kind: 'actions', actions },
      { kind: 'risks', items: risks },
      { kind: 'help', entries: chapterHelpEntries },
      { kind: 'logs', lines: ['你进入了战斗。'] },
    ],
  };
}

function combatActionFixture(index, overrides = {}) {
  const combatActions = [
    'attack',
    'art',
    'guard',
    'weapon_skill',
    'use_healing_pill',
    'use_thunder_talisman',
    'escape',
  ];
  const combatAction = combatActions[index % combatActions.length];
  return {
    actionId: `combat.fixture:${index}`,
    label: `战术 ${index + 1}`,
    placement: 'combat',
    enabled: true,
    emphasis: 'secondary',
    recommendation: 'neutral',
    combatAction,
    event: { kind: 'command', command: { type: 'combat/act', action: combatAction } },
    ...overrides,
  };
}

// === Combat visual loop v1 ===
// Status readouts sit on the compact combat scrim, while the primary action
// deck becomes a 2x2 tactical board with unchanged presentation events.
{
  const delegateCalls = [];
  const canvas = {
    name: 'combat-tactical-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  const recommendedEvent = Object.freeze({
    kind: 'command',
    command: Object.freeze({ type: 'combat/act', action: 'attack' }),
  });
  const actions = [
    combatActionFixture(0, {
      actionId: 'combat.fixture:recommended',
      label: '裂锋斩击',
      recommendation: 'recommended',
      readout: '造成稳定物理伤害。',
      event: recommendedEvent,
    }),
    combatActionFixture(6, {
      actionId: 'combat.fixture:danger',
      label: '冒险撤离',
      emphasis: 'danger',
      recommendation: 'high-risk',
      riskReason: '撤离失败会遭到追击。',
    }),
    combatActionFixture(1, {
      actionId: 'combat.fixture:neutral',
      label: '灵术试探',
      readout: undefined,
    }),
    combatActionFixture(2, {
      actionId: 'combat.fixture:disabled',
      label: '架势防御',
      enabled: false,
      disabledReason: '本回合无法防御。',
    }),
  ];
  const chapterContext = combatChapterContextFixture({
    pursuit: {
      legacyDisabled: false,
      present: true,
      name: '镜潮尾影',
      status: 'stalking',
      statusLabel: '追猎中',
      contactDamagePercent: 15,
      bossFusionPercent: 15,
    },
  });
  const equipmentMemory = {
    helpId: 'equipmentMemory',
    status: 'active',
    enabled: true,
    activeName: '镇魔余响',
    memoryId: 'tower_memory',
    matchingEquipmentIds: ['armor_piercing_sword'],
    matchingEquipmentNames: ['破甲剑'],
    overflowState: 'stored',
    overflowStored: true,
    restored: false,
  };
  const boss = {
    phase: 'sealed',
    phaseLabel: '封印阶段',
    title: '镜潮之主',
    sealName: '末班潮印',
  };
  const model = {
    ...combatModel(chapterContext, { actions, equipmentMemory, boss }),
    visualAssetKey: 'monster:combat-tactical-fixture',
  };
  view.setVisualAsset(
    { width: 300, height: 400 },
    { key: model.visualAssetKey, revision: 'combat-visual-v1' },
  );
  view.render(model, chrome, EXPLORE_INSETS_320);
  let root = canvas.children[canvas.children.length - 1];

  assert.equal(
    collectNodes(root, (node) => node.name.startsWith('Metric:')).length,
    0,
    'combat omits duplicate generic metric chips',
  );
  assert.ok(findNode(root, 'PlayerHp'), 'combat keeps player HP');
  assert.ok(findNode(root, 'EnemyHp'), 'combat keeps enemy HP');
  const projectedMetricText = collectStrings(findNode(root, 'CombatProjectedMetrics')).join('\n');
  assert.match(projectedMetricText, /攻 攻击\/术强 26\/18/, 'combat keeps projected attack readout');
  assert.doesNotMatch(projectedMetricText, /敌方意图/, 'explicit intent is not duplicated in compact metrics');
  const intentText = collectStrings(findNode(root, 'CombatIntent')).join('\n');
  assert.match(intentText, /第 3 回合/);
  assert.match(intentText, /常规追击/);
  assert.match(intentText, /敌人将进行常规反击。/, 'combat keeps the complete consequence');
  const bossText = collectStrings(findNode(root, 'BossReadout')).join('\n');
  assert.match(bossText, /镜潮之主.*封印阶段.*末班潮印/);
  assert.match(bossText, /激活 镇魔余响.*匹配装备 破甲剑/);
  assert.ok(findNode(root, 'CombatChapterContextLaw'), 'combat keeps chapter law');
  assert.ok(findNode(root, 'CombatChapterContextPursuit'), 'combat keeps active pursuit');
  assert.equal(findNode(root, 'ChapterCodexOpen'), undefined, 'non-Explore status never gains a codex opener');
  assert.equal(findNode(root, 'ChapterCodexOverlay'), undefined, 'non-Explore status never gains a codex overlay');
  assert.equal(findNode(root, 'VisualHudScrim').size.height, 88, 'combat HUD scrim is compact');
  const currentVisualNodes = collectNodes(root, (node) => (
    node.name.startsWith('VisualBackdrop:') || node.name.startsWith('VisualAsset:')
  ));
  assert.equal(currentVisualNodes.length, 2, 'combat still uses exactly two live visual Sprites');
  const currentSprites = currentVisualNodes.map((node) => (
    [...node.components.values()].find((component) => Object.hasOwn(component, 'spriteFrame'))
  ));
  assert.ok(currentSprites.every(Boolean));
  assert.equal(currentSprites[0].spriteFrame, currentSprites[1].spriteFrame, 'combat Sprites share one frame');
  const projectedMetricsNode = findNode(root, 'CombatProjectedMetrics');
  const monsterForegroundNode = findNode(root, `VisualAsset:monster:${model.visualAssetKey}`);
  assert.ok(
    projectedMetricsNode.position.x + projectedMetricsNode.size.width / 2
      < monsterForegroundNode.position.x - monsterForegroundNode.size.width / 2,
    'compact projected metrics stay left of the monster body',
  );
  assert.equal(findNode(root, 'PlayerHp').size.height, 40, 'player HP remains a compact bar');
  assert.equal(findNode(root, 'EnemyHp').size.height, 40, 'enemy HP remains a compact bar');

  const cards = collectNodes(root, (node) => node.name.startsWith('Action:'));
  assert.equal(cards.length, 4, 'combat tactical page exposes four slots');
  for (const card of cards) {
    assert.deepEqual([card.size.width, card.size.height], [318, 160]);
    assert.ok(card.size.width * 320 / 750 >= 44, 'combat card is 44+ viewport px wide');
    assert.ok(card.size.height * 320 / 750 >= 44, 'combat card is 44+ viewport px high');
    assert.ok(
      collectNodes(card, (node) => node !== card).every((node) => node.listeners.size === 0),
      `${card.name} children register no touch listeners`,
    );
  }
  for (let leftIndex = 0; leftIndex < cards.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cards.length; rightIndex += 1) {
      const left = cards[leftIndex];
      const right = cards[rightIndex];
      const overlaps = Math.abs(left.position.x - right.position.x) < (left.size.width + right.size.width) / 2
        && Math.abs(left.position.y - right.position.y) < (left.size.height + right.size.height) / 2;
      assert.equal(overlaps, false, `${left.name}/${right.name} do not overlap`);
    }
  }
  const deckTitle = findNode(root, 'DeckTitle');
  const pagePrevious = findNode(root, 'PagePrevious');
  assert.ok(
    Math.max(...cards.map((card) => card.position.y + card.size.height / 2))
      < deckTitle.position.y - deckTitle.size.height / 2,
    'combat cards clear the deck title',
  );
  assert.ok(
    Math.min(...cards.map((card) => card.position.y - card.size.height / 2))
      > pagePrevious.position.y + pagePrevious.size.height / 2,
    'combat cards clear the 104px pager',
  );

  const recommendedCard = findNode(root, 'Action:combat.fixture:recommended');
  const dangerCard = findNode(root, 'Action:combat.fixture:danger');
  const neutralCard = findNode(root, 'Action:combat.fixture:neutral');
  const disabledCard = findNode(root, 'Action:combat.fixture:disabled');
  assert.match(collectStrings(recommendedCard).join('\n'), /斩.*裂锋斩击.*★ 推荐.*\[回合\].*造成稳定物理伤害。/s);
  assert.match(collectStrings(dangerCard).join('\n'), /退.*冒险撤离.*!! 危险.*撤离失败会遭到追击。/s);
  assert.match(collectStrings(disabledCard).join('\n'), /守.*架势防御.*× 锁定.*本回合无法防御。/s);
  const neutralText = collectStrings(neutralCard).join('\n');
  assert.match(neutralText, /术.*灵术试探.*• 可用.*点击施放/s);
  assert.doesNotMatch(neutralText, /combat\.fixture:neutral/, 'empty readout never exposes actionId');
  for (const type of ['touch-start', 'touch-cancel', 'touch-end']) {
    assert.equal(recommendedCard.listeners.get(type)?.length, 1, `whole card binds ${type} once`);
  }
  emitTouch(recommendedCard, 8101);
  recommendedCard.emit('touch-end', { getID: () => 8101, propagationStopped: false });
  assert.equal(delegateCalls.length, 1, 'duplicate combat TOUCH_END dispatches once');
  assert.equal(delegateCalls[0].actionId, actions[0].actionId);
  assert.equal(delegateCalls[0].event, recommendedEvent, 'combat forwards the exact presentation event');

  const frame = currentSprites[0].spriteFrame;
  const texture = frame.texture;
  view.destroy();
  assert.ok(currentSprites.every(({ spriteFrame }) => spriteFrame === null), 'combat destroy detaches both Sprites');
  assert.equal(frame.destroyCalls, 1, 'combat frame is destroyed once');
  assert.equal(texture.destroyCalls, 1, 'combat texture is destroyed once');
  const callsBeforeDestroyedCard = delegateCalls.length;
  emitTouch(neutralCard, 8102);
  assert.equal(delegateCalls.length, callsBeforeDestroyedCard, 'destroyed combat card stays inert');
}

// Every ordered combat action appears exactly once across pages. Pager touches
// are local-only, stale cards cannot dispatch after redraw, and the input array
// is never sorted in place.
{
  const delegateCalls = [];
  const canvas = {
    name: 'combat-pages-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  const actions = Array.from({ length: 9 }, (_, index) => combatActionFixture(index));
  actions[6] = combatActionFixture(6, {
    actionId: 'combat.capture:mirror-bind',
    label: '镜潮拘束',
    combatAction: undefined,
  });
  actions[7] = combatActionFixture(7, {
    actionId: 'combat.retreat-run',
    label: '战术撤退',
    placement: 'advanced',
    combatAction: undefined,
  });
  actions[8] = combatActionFixture(8, {
    actionId: 'combat.advanced:secret-art',
    label: '展开秘诀',
    placement: 'advanced',
    combatAction: undefined,
  });
  const originalIds = actions.map(({ actionId }) => actionId);
  const expectedIds = orderActionsForCompactReachability(actions).map(({ actionId }) => actionId);
  const model = {
    ...combatModel(combatChapterContextFixture(), { actions }),
    visualAssetKey: 'monster:combat-pages-fixture',
  };
  view.setVisualAsset(
    { width: 300, height: 400 },
    { key: model.visualAssetKey, revision: 'combat-pages-v1' },
  );
  view.render(model, chrome, EXPLORE_INSETS_320);
  let root = canvas.children[canvas.children.length - 1];
  const firstCard = collectNodes(root, (node) => node.name.startsWith('Action:'))[0];
  const seenIds = [];
  const displayById = new Map();
  let touchId = 8200;
  for (let page = 0; page < 3; page += 1) {
    const pageCards = collectNodes(root, (node) => node.name.startsWith('Action:'));
    seenIds.push(...pageCards.map(({ name }) => name.slice('Action:'.length)));
    for (const card of pageCards) {
      displayById.set(card.name.slice('Action:'.length), collectStrings(card).join('\n'));
    }
    assert.ok(pageCards.length <= 4, `combat page ${page + 1} has at most four cards`);
    if (page < 2) {
      const callsBeforePage = delegateCalls.length;
      emitTouch(findNode(root, 'PageNext'), ++touchId);
      root = canvas.children[canvas.children.length - 1];
      assert.equal(delegateCalls.length, callsBeforePage, 'combat paging sends no delegate event');
    }
  }
  assert.deepEqual(seenIds, expectedIds, 'every ordered combat action renders exactly once');
  assert.equal(new Set(seenIds).size, actions.length, 'combat pages contain no duplicate action');
  assert.deepEqual(actions.map(({ actionId }) => actionId), originalIds, 'combat rendering does not sort input in place');
  assert.match(displayById.get('combat.capture:mirror-bind'), /缚/, 'capture fallback glyph is explicit');
  assert.match(displayById.get('combat.retreat-run'), /退/, 'retreat fallback glyph is explicit');
  assert.match(displayById.get('combat.advanced:secret-art'), /诀/, 'advanced fallback glyph is explicit');
  const callsBeforeStaleCard = delegateCalls.length;
  emitTouch(firstCard, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeStaleCard, 'card captured before redraw stays inert');
  assert.match(collectStrings(findNode(root, 'PageCount')).join('\n'), /3 \/ 3/);
  assert.equal(
    collectNodes(root, (node) => node.name.startsWith('VisualBackdrop:') || node.name.startsWith('VisualAsset:')).length,
    2,
    'paging keeps exactly two current visual Sprite nodes',
  );
  const currentVisualSprite = [...findNode(root, `VisualBackdrop:monster:${model.visualAssetKey}`).components.values()]
    .find((component) => Object.hasOwn(component, 'spriteFrame'));
  const frame = currentVisualSprite.spriteFrame;
  const texture = frame.texture;
  assert.equal(frame.destroyCalls, 0, 'local paging retains the active frame');
  assert.equal(texture.destroyCalls, 0, 'local paging retains the active texture');
  view.destroy();
  assert.equal(frame.destroyCalls, 1);
  assert.equal(texture.destroyCalls, 1);
}

// Disabled, missing-event, busy, and blocked cards are visibly locked and
// never receive any physical listener.
for (const [label, actionOverrides, chromeOverrides] of [
  ['disabled', { enabled: false, disabledReason: '不可用 fixture' }, {}],
  ['missing-event', { event: undefined }, {}],
  ['busy', {}, { busyActionId: 'combat.fixture:0' }],
  ['blocked', {}, { modeKind: 'blocked', blockingMessage: 'blocked fixture' }],
]) {
  const delegateCalls = [];
  const canvas = {
    name: `combat-${label}-canvas`,
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = {
    modeKind: 'preview',
    modeLabel: '开发预览',
    modeDetail: 'fixture',
    ...chromeOverrides,
  };
  view.render(
    combatModel(combatChapterContextFixture(), {
      actions: [combatActionFixture(0, actionOverrides)],
    }),
    chrome,
    EXPLORE_INSETS_320,
  );
  const root = canvas.children[canvas.children.length - 1];
  const card = findNode(root, 'Action:combat.fixture:0');
  assert.equal(card.listeners.size, 0, `${label} combat card has no listener`);
  assert.match(collectStrings(card).join('\n'), /× 锁定/, `${label} combat card is visibly locked`);
  emitTouch(card, 8300);
  assert.equal(delegateCalls.length, 0, `${label} combat card dispatches nothing`);
  view.destroy();
}

{
  const delegateCalls = [];
  const canvas = {
    name: 'combat-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };

  for (const [label, insets] of [['320x568', EXPLORE_INSETS_320], ['390x844', EXPLORE_INSETS_390]]) {
    view.render(combatModel(combatChapterContextFixture()), chrome, insets);
    const root = canvas.children[canvas.children.length - 1];
    assert.equal(root.name, 'InfiniteFlowRuntimeView');
    assert.ok(
      !collectStrings(root).some((value) => value.includes('undefined')),
      `${label} combat strings are undefined-free`,
    );
    assert.ok(
      collectStrings(root).some((value) => /场域 末班潮序 涨潮/.test(value)),
      `${label} combat law context line renders`,
    );
    assert.ok(
      findNode(root, 'CombatChapterContextLaw'),
      `${label} combat law context node exists`,
    );
    assert.equal(
      findNode(root, 'CombatChapterContextPursuit'),
      undefined,
      `${label} dormant pursuit renders no pursuit line`,
    );
    assert.ok(
      findNode(root, 'CombatIntent'),
      `${label} combat intent still renders`,
    );
    assert.ok(
      findNode(root, 'PlayerHp'),
      `${label} player HP bar still renders`,
    );
  }

  // Stalking pursuit renders the pursuit line and the risk deck carries the warning.
  const stalkingFixture = combatChapterContextFixture({
    pursuit: {
      legacyDisabled: false,
      present: true,
      name: '镜潮尾影',
      status: 'stalking',
      statusLabel: '追猎中',
      contactDamagePercent: 15,
      bossFusionPercent: 15,
    },
  });
  view.render(combatModel(stalkingFixture, { pursuitActive: true }), chrome, EXPLORE_INSETS_390);
  let root = canvas.children[canvas.children.length - 1];
  assert.ok(
    collectStrings(root).some((value) => /追兵 镜潮尾影 追猎中/.test(value)),
    'stalking pursuit line renders',
  );
  assert.ok(findNode(root, 'CombatChapterContextPursuit'), 'stalking pursuit node exists');

  // Danger law renders in the warning/danger color and the risk deck carries it.
  const dangerFixture = combatChapterContextFixture({
    law: {
      present: true,
      title: '锈疫污染',
      status: '污染 4/4',
      severity: 'danger',
      meter: { value: 4, max: 4 },
      modifiers: {
        enemyAllStatsPercent: 15,
        enemyDefensePercent: 10,
        enemyArtPowerPercent: 0,
        outgoingForcePercent: -5,
        outgoingArtPercent: -5,
        healingPercent: -10,
        guardEffectPercent: -5,
      },
    },
  });
  view.render(combatModel(dangerFixture, { lawDanger: true }), chrome, EXPLORE_INSETS_390);
  root = canvas.children[canvas.children.length - 1];
  assert.ok(
    collectStrings(root).some((value) => /场域 锈疫污染 污染 4\/4/.test(value)),
    'danger law context line renders',
  );
  assert.ok(
    collectStrings(root).some((value) => /敌\+15%/.test(value)),
    'danger law enemy modifier renders',
  );

  // The combat context adds no commands: only combat actions dispatch.
  assert.ok(
    !delegateCalls.some((call) => call.event.kind === 'command' && !call.actionId.startsWith('combat.')),
    'combat context dispatches no non-combat command',
  );
  view.destroy();
}

// === Unified Result pager ===
// Every result detail — even an outcome-only one — renders through the same
// pager. The overview page sanitizes the core lastOutcome machine string into
// Chinese; the echo page explains pending/archived/skipped contexts while the
// archive/return actions stay in the existing deck. Long Chinese/ASCII copy is
// wrapped by the shared pure functions into stable subpages, and the
// prev/next controls keep 104+ design-px touch targets with disabled bounds.

// Pure wrapping contract: CJK counts as 1 unit, ASCII as 0.55; lines break
// deterministically and subpages stay stable.
assert.deepEqual([...wrapInfiniteFlowLine('一二三四五', 3)], ['一二三', '四五']);
assert.deepEqual([...wrapInfiniteFlowLine('abcdef', 2)], ['abc', 'def']);
assert.deepEqual([...wrapInfiniteFlowLine('一二三', 5)], ['一二三']);
assert.deepEqual(
  paginateInfiniteFlowText(['a\nb', 'c'], { maxUnitsPerLine: 5, maxLinesPerPage: 1 }).map((page) => [...page]),
  [['a'], ['b'], ['c']],
);
assert.deepEqual(
  paginateInfiniteFlowText(['一二三四五六'], { maxUnitsPerLine: 2, maxLinesPerPage: 2 }).map((page) => [...page]),
  [['一二', '三四'], ['五六']],
);
assert.deepEqual([...paginateInfiniteFlowText([], { maxUnitsPerLine: 5, maxLinesPerPage: 2 })], []);

// Outcome sanitization: known machine values become Chinese labels; unknown
// values and already-safe copy degrade gracefully without leaking tokens.
assert.equal(formatInfiniteFlowOutcomeSummary('镇魔塔一层首次通关结算。outcome=clean_clear; score=1'), '完美通关');
assert.equal(formatInfiniteFlowOutcomeSummary('outcome=retreat'), '主动撤退');
assert.equal(formatInfiniteFlowOutcomeSummary('outcome=failed_recovered'), '失败后回收');
assert.equal(formatInfiniteFlowOutcomeSummary('outcome=unknown_future'), '本轮已结算');
assert.equal(formatInfiniteFlowOutcomeSummary('本轮已结算。'), '本轮已结算');
assert.equal(formatInfiniteFlowOutcomeMetric('已完成'), '已完成');
assert.equal(formatInfiniteFlowOutcomeMetric('outcome=normal_clear; score=9; multiplier=1x; reward=5'), '通关');
assert.doesNotMatch(
  formatInfiniteFlowOutcomeMetric('outcome=normal_clear; score=9; reward=5'),
  /outcome=|score=|reward=/,
);

const machineOutcome = '镇魔塔一层首次通关结算。outcome=normal_clear; score=128; multiplier=1.5x; reward=120; protocol=imprint:succeeded; anchors=2/2';
const overviewReadout = formatInfiniteFlowResultOverview({
  dungeonName: '镇魔塔一层',
  outcome: machineOutcome,
  relicArchiveStatus: 'pending',
});
assert.equal(overviewReadout.title, '结果总览');
assert.ok(overviewReadout.lines.includes('镇魔塔一层 · 结算'));
assert.ok(overviewReadout.lines.includes('镇魔塔一层首次通关结算。'));
assert.ok(overviewReadout.lines.some((line) => line.includes('结果：通关')));
assert.ok(overviewReadout.lines.some((line) => line.includes('评分 128') && line.includes('倍率 1.5x') && line.includes('出口奖励点 120')));
assert.ok(overviewReadout.lines.some((line) => line.includes('回响归档 · 待归档')));
assert.doesNotMatch(
  overviewReadout.lines.join('\n'),
  /outcome=|score=|multiplier=|reward=|protocol=|anchors=/,
);
const outcomeOnlyOverview = formatInfiniteFlowResultOverview({
  outcome: 'outcome=failed_recovered',
  relicArchiveStatus: 'none',
});
assert.ok(outcomeOnlyOverview.lines.some((line) => line.includes('失败后回收')));
assert.doesNotMatch(outcomeOnlyOverview.lines.join('\n'), /[a-zA-Z][a-zA-Z0-9_]*=/);

// The echo page explains the action context per archive status; the raw enum
// never reaches the UI.
for (const [status, expected] of [
  ['pending', '归档一件回响'],
  ['archived', '返回主神空间'],
  ['skipped', '返回主神空间'],
  ['lost', '返回主神空间'],
  ['none', '返回主神空间'],
]) {
  const echoReadout = formatInfiniteFlowResultEchoArchive({ relicArchiveStatus: status });
  assert.ok(
    echoReadout.lines.some((line) => line.includes(expected)),
    `${status} echo page explains the available actions`,
  );
  assert.doesNotMatch(
    echoReadout.lines.join('\n'),
    new RegExp(`\\b${status}\\b`),
    `${status} enum never reaches the UI raw`,
  );
}

const fullResultDetail = {
  kind: 'result',
  dungeonId: 'demon_tower_1',
  dungeonName: '镇魔塔一层',
  outcome: machineOutcome,
  relicArchiveStatus: 'pending',
  lootSettlement: {
    state: 'valid',
    retainedRewardPoints: 120,
    retainedLingyun: 40,
    retainedItemCount: 3,
    retainedEquipmentCount: 1,
    retainedEquipmentNames: ['破甲剑'],
    lostRewardPoints: 0,
    lostLingyun: 0,
    lostItemCount: 0,
    lostEquipmentCount: 0,
    lostEquipmentNames: [],
  },
  equipmentCommissionSettlement: {
    helpId: 'equipmentCommission',
    status: 'completed',
    dungeonId: 'demon_tower_1',
    dungeonName: '镇魔塔一层',
    equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
    equipmentNames: ['破甲剑', '时序锋'],
    targetMaterialId: 'time_sand',
    targetMaterialName: '时砂',
    completedDungeonIds: ['demon_tower_1', 'metro_abyss', 'rust_hospital'],
    completedDungeonNames: ['镇魔塔一层', '地铁深渊', '锈蚀医院'],
    completedCount: 3,
    requiredDungeonCount: 3,
    remainingCount: 0,
    rewardAmount: 2,
    rewardReadout: '时砂 x2 已存入永久背包。',
  },
  equipmentMemory: {
    helpId: 'equipmentMemory',
    modernLibrary: {
      dungeonId: 'demon_tower_1',
      dungeonName: '镇魔塔一层',
      memoryId: 'tower_memory',
      memoryName: '镇魔余响',
      status: 'active',
      recordedEquipmentIds: ['armor_piercing_sword'],
      recordedEquipmentNames: ['破甲剑'],
      activeEquipmentIds: ['armor_piercing_sword'],
      activeEquipmentNames: ['破甲剑'],
      readout: '本章记忆已收录并激活。',
    },
  },
  equipmentRollSettlement: {
    state: 'valid',
    equipmentName: '破甲剑',
    outcome: 'upgraded',
    outcomeLabel: '已升级',
    previousItemPower: 100,
    salvageRewardPoints: 0,
  },
  protocolSettlement: {
    state: 'valid',
    protocolName: '标准协议',
    status: 'succeeded',
    statusLabel: '已完成',
    bossDefeated: true,
    baseRewardPoints: 100,
    protocolRewardPoints: 0,
    rewardPointBonus: 0,
    cycleImprintGranted: false,
  },
  directiveSettlement: {
    state: 'valid',
    statusLabel: '进行中',
    progressText: '3/3 已满足',
    rewardPreview: '灵蕴 x3',
    objectives: [
      { id: 'd1', kind: 'low_damage', label: '承伤不超过 50', description: '本章承伤不超过 50。', completed: true, progressText: '当前满足' },
      { id: 'd2', kind: 'no_item', label: '不使用道具', description: '本章不使用道具。', completed: true, progressText: '当前满足' },
      { id: 'd3', kind: 'equip', label: '携带指定装备', description: '携带指定装备进入。', completed: true, progressText: '当前满足' },
    ],
  },
  routeContractSettlement: {
    state: 'valid',
    contractName: '巡雾问井',
    status: 'secured',
    statusLabel: '已保全',
    completedTargetCount: 2,
    totalTargetCount: 2,
    rewardPoints: 170,
    rewarded: true,
  },
  pressureSettlement: {
    state: 'valid',
    tier: 'stable',
    tierLabel: '稳定',
    rewardPointBonus: 15,
  },
  pursuitSettlement: {
    state: 'valid',
    name: '裂门蜕兽',
    reason: 'successful_exit',
    reasonLabel: '成功出口',
    rewarded: true,
    materialName: '时砂',
  },
};
const altarMetrics = [
  { id: 'outcome', label: '结算', value: machineOutcome, symbol: '结', severity: 'positive' },
  { id: 'reward-points', label: '奖励点', value: '85', symbol: '点', severity: 'positive' },
  { id: 'lingyun', label: '灵蕴', value: '40', symbol: '蕴', severity: 'positive' },
  { id: 'relic-archive', label: '回响归档', value: 'pending', symbol: '档', severity: 'neutral' },
  { id: 'equipment-commission', label: '装备封存委托', value: '已完成', symbol: '封', severity: 'positive' },
  { id: 'equipment-memory-result', label: '装备记忆', value: '本章已激活', symbol: '忆', severity: 'positive' },
];
const validAltarReadout = formatInfiniteFlowResultAltar(fullResultDetail, altarMetrics);
assert.equal(validAltarReadout.outcome, '通关');
assert.equal(validAltarReadout.metrics.length, 5, 'altar retains all non-outcome status metrics');
assert.deepEqual(
  validAltarReadout.metrics.find(({ id }) => id === 'relic-archive'),
  { id: 'relic-archive', symbol: '!', label: '回响归档', value: '待归档', severity: 'warning' },
  'altar derives its Chinese archive badge from the typed result status, not metric prose',
);
assert.deepEqual(
  validAltarReadout.loot,
  { state: 'valid', retained: '带回 点 120 · 蕴 40 · 物 3 · 装 1' },
  'valid altar directly projects the four retained loot counts and omits zero loss',
);
const lossyAltarReadout = formatInfiniteFlowResultAltar({
  ...fullResultDetail,
  lootSettlement: {
    ...fullResultDetail.lootSettlement,
    lostRewardPoints: 9,
    lostLingyun: 2,
    lostItemCount: 1,
    lostEquipmentCount: 1,
  },
}, altarMetrics);
assert.equal(
  lossyAltarReadout.loot.loss,
  '失去 点 9 · 蕴 2 · 物 1 · 装 1',
  'non-zero loss directly projects all four loss counts',
);
assert.deepEqual(
  formatInfiniteFlowResultAltar({
    kind: 'result',
    outcome: 'outcome=normal_clear',
    relicArchiveStatus: 'archived',
    lootSettlement: { state: 'invalid', diagnostic: '战利品结算记录不可用' },
  }, altarMetrics).loot,
  { state: 'invalid', diagnostic: '战利品结算记录不可用' },
  'invalid loot preserves the presentation diagnostic',
);
assert.deepEqual(
  formatInfiniteFlowResultAltar({
    kind: 'result',
    outcome: 'outcome=normal_clear',
    relicArchiveStatus: 'archived',
  }, altarMetrics).loot,
  { state: 'missing' },
  'missing loot remains missing instead of becoming zero counts',
);
assert.deepEqual(
  buildInfiniteFlowResultPages(fullResultDetail).map((page) => page.id),
  ['overview', 'echo', 'loot', 'commission', 'memory', 'equipmentRoll', 'protocol', 'directive', 'routeContract', 'pressure', 'pursuit'],
);
const directiveSettlementPage = buildInfiniteFlowResultPages(fullResultDetail)
  .find((page) => page.id === 'directive');
assert.ok(directiveSettlementPage, 'directive settlement page is present');
assert.ok(
  directiveSettlementPage.lines.includes('状态 进行中 · 3/3 已满足'),
  'directive settlement renders the Chinese statusLabel, never the raw status enum',
);
assert.ok(
  !directiveSettlementPage.lines.some((line) => line.includes('active')),
  'directive settlement lines never contain the raw active enum',
);
assert.deepEqual(
  buildInfiniteFlowResultPages({
    kind: 'result',
    outcome: 'outcome=retreat',
    relicArchiveStatus: 'archived',
  }).map((page) => page.id),
  ['overview', 'echo'],
  'outcome-only results still get the overview and echo pages',
);
const invalidResultDetail = {
  kind: 'result',
  dungeonName: '镇魔塔一层',
  outcome: 'outcome=normal_clear',
  relicArchiveStatus: 'none',
  lootSettlement: { state: 'invalid', diagnostic: '战利品结算记录不可用' },
  equipmentRollSettlement: { state: 'invalid', diagnostic: '装备铭刻记录不可用' },
  protocolSettlement: { state: 'invalid', diagnostic: '协议结算记录不可用' },
  directiveSettlement: { state: 'invalid', diagnostic: '指令结算记录不可用' },
  routeContractSettlement: { state: 'invalid', diagnostic: '路线契约结算记录不可用' },
  pressureSettlement: { state: 'invalid', diagnostic: '侵蚀结算记录不可用' },
  pursuitSettlement: { state: 'invalid', diagnostic: '追兵结算记录不可用' },
};
const invalidResultPages = buildInfiniteFlowResultPages(invalidResultDetail);
assert.deepEqual(
  invalidResultPages.map((page) => page.id),
  ['overview', 'echo', 'loot', 'equipmentRoll', 'protocol', 'directive', 'routeContract', 'pressure', 'pursuit'],
);
for (const diagnostic of ['战利品结算记录不可用', '装备铭刻记录不可用', '协议结算记录不可用', '指令结算记录不可用', '路线契约结算记录不可用', '侵蚀结算记录不可用', '追兵结算记录不可用']) {
  assert.ok(
    invalidResultPages.some((page) => page.lines.includes(diagnostic)),
    `invalid card surfaces its diagnostic: ${diagnostic}`,
  );
}

function resultModel(options = {}) {
  const detail = {
    kind: 'result',
    dungeonId: 'demon_tower_1',
    dungeonName: '镇魔塔一层',
    outcome: options.outcome ?? machineOutcome,
    relicArchiveStatus: options.relicArchiveStatus ?? 'pending',
  };
  for (const key of [
    'lootSettlement',
    'equipmentCommissionSettlement',
    'equipmentMemory',
    'equipmentRollSettlement',
    'protocolSettlement',
    'directiveSettlement',
    'routeContractSettlement',
    'pressureSettlement',
    'pursuitSettlement',
  ]) {
    if (options[key] !== undefined) detail[key] = options[key];
  }
  const pending = detail.relicArchiveStatus === 'pending';
  const defaultActions = pending
    ? [
        {
          actionId: 'result.archive-relic:mist_edge', label: '归档雾锋', placement: 'result',
          enabled: true, emphasis: 'primary', recommendation: 'recommended',
          readout: '雾锋将作为下轮种子。',
          event: { kind: 'command', command: { type: 'result/archive-relic', relicId: 'mist_edge' } },
        },
        {
          actionId: 'result.archive-relic:skip', label: '跳过回响归档', placement: 'result',
          enabled: true, emphasis: 'quiet', recommendation: 'neutral',
          event: { kind: 'command', command: { type: 'result/archive-relic' } },
        },
        {
          actionId: 'result.return-hub', label: '返回主神空间', placement: 'result',
          enabled: false, emphasis: 'primary', recommendation: 'neutral',
          disabledReason: '请先归档一件回响，或明确跳过。',
        },
      ]
    : [
        {
          actionId: 'result.return-hub', label: '返回主神空间', placement: 'result',
          enabled: true, emphasis: 'primary', recommendation: 'recommended',
          event: { kind: 'command', command: { type: 'result/return-hub' } },
        },
      ];
  const actions = options.actions === undefined ? defaultActions : [...options.actions];
  return {
    schemaVersion: 1,
    phase: 'result',
    screenTitle: '镇魔塔一层 · 结算',
    visualAssetKey: 'dungeon:demon_tower_1',
    dispatchPolicy: 'one-event-per-action',
    tasks: [],
    sections: [
      {
        kind: 'objective',
        title: pending ? '归档本回合响' : '返回主神空间',
        summary: pending ? '选择一件回响作为下轮种子，或明确跳过。' : '本回合结算已完成。',
      },
      {
        kind: 'status',
        metrics: [
          { id: 'outcome', label: '结算', value: detail.outcome, symbol: '结', severity: 'positive' },
          { id: 'reward-points', label: '奖励点', value: '85', symbol: '点', severity: 'positive' },
          { id: 'lingyun', label: '灵蕴', value: '40', symbol: '蕴', severity: 'positive' },
          { id: 'relic-archive', label: '回响归档', value: pending ? '待归档' : '已归档', symbol: '档', severity: 'neutral' },
          ...(detail.equipmentCommissionSettlement === undefined
            ? []
            : [{ id: 'equipment-commission', label: '装备封存委托', value: '已完成', symbol: '封', severity: 'positive' }]),
          ...(detail.equipmentMemory === undefined
            ? []
            : [{ id: 'equipment-memory-result', label: '装备记忆', value: '本章已激活', symbol: '忆', severity: 'positive' }]),
        ],
        detail,
      },
      { kind: 'actions', actions },
      { kind: 'risks', items: [] },
      { kind: 'help', entries: chapterHelpEntries },
      { kind: 'logs', lines: ['你带着战利品回到了主神空间。'] },
    ],
  };
}

const resultPendingActionsFive = Object.freeze([
  ['mist_edge', '归档雾锋'],
  ['ember_veil', '归档烬幕'],
  ['void_key', '归档虚钥'],
].map(([relicId, label]) => {
  const event = Object.freeze({
    kind: 'command',
    command: Object.freeze({ type: 'result/archive-relic', relicId }),
  });
  return Object.freeze({
    actionId: `result.archive-relic:${relicId}`,
    label,
    placement: 'result',
    enabled: true,
    emphasis: 'primary',
    recommendation: 'recommended',
    readout: '将所选回响收入归档。',
    event,
  });
}).concat([
  Object.freeze({
    actionId: 'result.archive-relic:skip',
    label: '跳过回响归档',
    placement: 'result',
    enabled: true,
    emphasis: 'quiet',
    recommendation: 'neutral',
    event: Object.freeze({
      kind: 'command',
      command: Object.freeze({ type: 'result/archive-relic' }),
    }),
  }),
  Object.freeze({
    actionId: 'result.return-hub',
    label: '返回主神空间',
    placement: 'result',
    enabled: false,
    emphasis: 'primary',
    recommendation: 'neutral',
    disabledReason: '请先归档一件回响，或明确跳过。',
  }),
]));

{
  const inputOrder = resultPendingActionsFive.map(({ actionId }) => actionId);
  const inputSnapshot = JSON.stringify(resultPendingActionsFive);
  const ordered = orderActionsForCompactReachability(resultPendingActionsFive);
  const delegateCalls = [];
  const canvas = {
    name: 'result-compact-five-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const view = new InfiniteFlowView(canvas, {
    activate(physicalId, actionId, event) {
      delegateCalls.push({ physicalId, actionId, event });
    },
  });
  const chrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  view.render(
    resultModel({ relicArchiveStatus: 'pending', actions: resultPendingActionsFive }),
    chrome,
    EXPLORE_INSETS_320,
  );
  let root = canvas.children[canvas.children.length - 1];
  let touchId = 7700;
  const reachedIds = [];
  let staleFirstCard;
  let staleFirstNext;
  for (let page = 0; page < 2; page += 1) {
    const deck = findNode(root, 'Deck');
    const cards = collectNodes(
      deck,
      (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
    );
    const expected = ordered.slice(page * 4, page * 4 + 4);
    assert.deepEqual(
      cards.map(({ name }) => name.slice('Action:'.length)),
      expected.map(({ actionId }) => actionId),
      `five-action Result page ${page + 1} keeps exact compact order`,
    );
    assert.equal(cards.length, page === 0 ? 4 : 1, `five-action Result page ${page + 1} renders only real cards`);
    assert.match(collectStrings(findNode(deck, 'PageCount')).join(''), new RegExp(`${page + 1} / 2`));
    assert.equal(collectStrings(findNode(deck, 'DeckHint')).join(''), '2×2 结算抉择盘 · 单触控单指令');
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const action = expected[index];
      const slot = layoutInfiniteFlowExploreResultActionDeck(5, page).slots[index];
      reachedIds.push(action.actionId);
      assert.deepEqual([card.size.width, card.size.height], [318, 160], `five-action Result page ${page + 1} card geometry`);
      assert.deepEqual([card.position.x, card.position.y], [slot.x, slot.y], `five-action Result page ${page + 1} card stays in its slot`);
      assert.equal(
        collectStrings(findNode(card, 'ExploreResultActionGlyph')).join(''),
        classifyInfiniteFlowExploreResultActionGlyph('result', action),
        `five-action Result page ${page + 1} glyph`,
      );
      const playerCopy = collectStrings(card).join('\n');
      assert.doesNotMatch(playerCopy, /result[./:]|mist_edge|ember_veil|void_key|relicId|event\.type|undefined|\b(?:neutral|recommended|primary|quiet)\b/iu);
      if (action.event === undefined) {
        assert.equal(card.listeners.size, 0, 'pending return action is visibly locked and inert');
        assert.match(playerCopy, /× 锁定/);
        continue;
      }
      const callsBeforeCard = delegateCalls.length;
      emitTouch(card, ++touchId);
      assert.equal(delegateCalls.length, callsBeforeCard + 1, `five-action Result page ${page + 1} card dispatches once`);
      const call = delegateCalls[delegateCalls.length - 1];
      assert.equal(call.actionId, action.actionId);
      assert.equal(call.event, action.event, `five-action Result page ${page + 1} keeps exact event identity`);
    }
    const previous = findNode(deck, 'PagePrevious');
    const next = findNode(deck, 'PageNext');
    if (page === 0) {
      assert.equal(previous.listeners.size, 0, 'five-action Result first previous is inert');
      staleFirstCard = cards[0];
      staleFirstNext = next;
      const callsBeforeNext = delegateCalls.length;
      emitTouch(next, ++touchId);
      root = canvas.children[canvas.children.length - 1];
      assert.equal(delegateCalls.length, callsBeforeNext, 'Result action paging is local-only');
      const callsBeforeStale = delegateCalls.length;
      const rendersBeforeStale = canvas.children.length;
      emitTouch(staleFirstCard, ++touchId);
      emitTouch(staleFirstNext, ++touchId);
      assert.equal(delegateCalls.length, callsBeforeStale, 'stale Result card is inert');
      assert.equal(canvas.children.length, rendersBeforeStale, 'stale Result pager is inert');
    } else {
      assert.equal(next.listeners.size, 0, 'five-action Result last next is inert');
    }
  }
  assert.deepEqual(reachedIds, ordered.map(({ actionId }) => actionId), 'all five pending Result actions are reachable without duplicates');

  const resolvedModel = resultModel({ relicArchiveStatus: 'archived' });
  view.render(resolvedModel, chrome, EXPLORE_INSETS_320);
  root = canvas.children[canvas.children.length - 1];
  assert.match(collectStrings(findNode(root, 'PageCount')).join(''), /1 \/ 1/, 'five pending choices -> one resolved choice clamps to 1 / 1');
  const resolvedCards = collectNodes(
    findNode(root, 'Deck'),
    (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
  );
  assert.deepEqual(resolvedCards.map(({ name }) => name), ['Action:result.return-hub'], 'resolved Result renders its one real card only');
  const resolvedEvent = resolvedModel.sections[2].actions[0].event;
  const resolvedCard = resolvedCards[0];
  const resolvedTouchId = ++touchId;
  resolvedCard.emit('touch-start', { getID: () => resolvedTouchId, propagationStopped: false });
  resolvedCard.emit('touch-end', { getID: () => resolvedTouchId, propagationStopped: false });
  resolvedCard.emit('touch-end', { getID: () => resolvedTouchId, propagationStopped: false });
  assert.equal(delegateCalls.length, 5, 'resolved Result duplicate touch-end dispatches once');
  assert.equal(delegateCalls[4].actionId, 'result.return-hub');
  assert.equal(delegateCalls[4].event, resolvedEvent, 'resolved Result forwards the exact original event object');

  const callsBeforeDestroy = delegateCalls.length;
  const rendersBeforeDestroy = canvas.children.length;
  const previousBeforeDestroy = findNode(root, 'PagePrevious');
  view.destroy();
  emitTouch(resolvedCard, ++touchId);
  emitTouch(previousBeforeDestroy, ++touchId);
  assert.equal(delegateCalls.length, callsBeforeDestroy, 'destroyed Result card is inert');
  assert.equal(canvas.children.length, rendersBeforeDestroy, 'destroyed Result pager is inert');
  assert.deepEqual(resultPendingActionsFive.map(({ actionId }) => actionId), inputOrder, 'Result renderer never reorders the input array');
  assert.equal(JSON.stringify(resultPendingActionsFive), inputSnapshot, 'Result renderer never mutates an action or event');
}

{
  const resultDelegateCalls = [];
  const resultCanvas = {
    name: 'result-canvas',
    children: [],
    addChild(child) { this.children.push(child); child.parent = this; },
  };
  const resultView = new InfiniteFlowView(resultCanvas, {
    activate(physicalId, actionId, event) {
      resultDelegateCalls.push({ physicalId, actionId, event });
    },
  });
  const resultVisualKey = 'dungeon:demon_tower_1';
  resultView.setVisualAsset(
    { width: 720, height: 180 },
    { key: resultVisualKey, revision: 'result-altar-fixture' },
  );
  const resultChrome = { modeKind: 'preview', modeLabel: '开发预览', modeDetail: 'fixture' };
  let resultTouchId = 100;
  let resultVisualFrame;
  let resultVisualTexture;

  const pagerLineStrings = (root) => {
    const lines = [];
    const walk = (node) => {
      if (typeof node.name === 'string' && node.name.startsWith('ResultPagerLine:')) {
        for (const component of node.components?.values?.() ?? []) {
          if (component && typeof component.string === 'string') lines.push(component.string);
        }
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
    return lines;
  };
  // Every settlement card exposes Chinese labels only; the raw status enums
  // (relic archive, equipment roll outcome, protocol/directive/route-contract
  // status, pressure tier, pursuit reason) must never reach the rendered UI.
  const RAW_SETTLEMENT_ENUMS = [
    // relic archive
    'none', 'pending', 'archived', 'skipped', 'lost',
    // equipment roll outcome
    'acquired', 'upgraded', 'salvaged',
    // protocol / directive status
    'succeeded', 'failed', 'locked', 'active', 'completed',
    // route contract status
    'secured', 'banked',
    // pressure tier
    'stable', 'hunted', 'breach',
    // pursuit reason
    'successful_exit', 'retreat', 'failure', 'stable_portal', 'forced_portal',
  ];
  const rawSettlementEnumPattern = new RegExp(`\\b(?:${RAW_SETTLEMENT_ENUMS.join('|')})\\b`);
  const assertNoRawTokens = (root, label) => {
    const strings = collectStrings(root);
    assert.ok(!strings.some((value) => value.includes('undefined')), `${label} rendered strings are undefined-free`);
    assert.ok(!strings.some((value) => /[a-zA-Z][a-zA-Z0-9_]*=/.test(value)), `${label} leaks no key=value machine tokens`);
    assert.ok(!strings.some((value) => /demon_tower_1|metro_abyss|rust_hospital|starfall_mine/.test(value)), `${label} leaks no raw ids`);
    assert.ok(!strings.some((value) => rawSettlementEnumPattern.test(value)), `${label} leaks no raw settlement status enums`);
  };
  const nodeBounds = (node) => ({
    left: node.position.x - node.size.width / 2,
    right: node.position.x + node.size.width / 2,
    bottom: node.position.y - node.size.height / 2,
    top: node.position.y + node.size.height / 2,
  });
  const nodesOverlap = (leftNode, rightNode) => {
    const left = nodeBounds(leftNode);
    const right = nodeBounds(rightNode);
    return left.left < right.right
      && right.left < left.right
      && left.bottom < right.top
      && right.bottom < left.top;
  };
  const spriteFromResultNode = (node) => [...node.components.values()].find((component) => (
    Object.hasOwn(component, 'spriteFrame')
  ));

  for (const [label, insets] of [['320x568', EXPLORE_INSETS_320], ['390x844', EXPLORE_INSETS_390]]) {
    resultView.render(resultModel({ ...fullResultDetail }), resultChrome, insets);
    const root = resultCanvas.children[resultCanvas.children.length - 1];
    assertNoRawTokens(root, label);
    assert.equal(
      collectStrings(findNode(root, 'DeckHint')).join(''),
      '2×2 结算抉择盘 · 单触控单指令',
      `${label} result deck explains the 2x2 one-touch contract`,
    );
    const resultActionCards = collectNodes(
      root,
      (node) => typeof node.name === 'string' && node.name.startsWith('Action:'),
    );
    assert.equal(resultActionCards.length, 3, `${label} pending result renders its three real choices only`);
    const actionDeck = findNode(root, 'Deck');
    const actionPrevious = findNode(actionDeck, 'PagePrevious');
    const actionNext = findNode(actionDeck, 'PageNext');
    const viewportWidth = Number.parseInt(label, 10);
    for (const card of resultActionCards) {
      assert.deepEqual([card.size.width, card.size.height], [318, 160], `${label} result card uses shared geometry`);
      assert.ok(card.size.width * viewportWidth / 750 >= 44, `${label} result card width is 44+ viewport px`);
      assert.ok(card.size.height * viewportWidth / 750 >= 44, `${label} result card height is 44+ viewport px`);
      assert.ok(findNode(card, 'ExploreResultActionGlyph'), `${label} result card has a visual glyph`);
      assert.equal(nodesOverlap(card, actionPrevious), false, `${label} result card clears previous action page control`);
      assert.equal(nodesOverlap(card, actionNext), false, `${label} result card clears next action page control`);
      assert.ok(Math.abs(card.position.x) + card.size.width / 2 <= actionDeck.size.width / 2, `${label} result card stays inside deck width`);
      assert.ok(Math.abs(card.position.y) + card.size.height / 2 <= actionDeck.size.height / 2, `${label} result card stays inside deck height`);
    }
    for (let leftIndex = 0; leftIndex < resultActionCards.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < resultActionCards.length; rightIndex += 1) {
        assert.equal(nodesOverlap(resultActionCards[leftIndex], resultActionCards[rightIndex]), false, `${label} result cards do not overlap`);
      }
    }
    for (const pagerControl of [actionPrevious, actionNext]) {
      assert.ok(pagerControl.size.width >= 104 && pagerControl.size.height >= 104, `${label} result action pager is 104+ design px`);
      assert.ok(pagerControl.size.width * viewportWidth / 750 >= 44, `${label} result action pager is 44+ viewport px`);
    }
    const altar = findNode(root, 'ResultAltar');
    assert.ok(altar, `${label} overview renders the result altar`);
    const altarGraphics = [...altar.components.values()].find((component) => Array.isArray(component.segments));
    assert.ok(altarGraphics && altarGraphics.segments.length >= 8, `${label} altar has static 2D Graphics ornament`);
    assert.ok(
      collectNodes(altar, () => true).every((node) => node.listeners.size === 0),
      `${label} altar artwork and labels register no listeners`,
    );
    assert.ok(
      collectStrings(altar).some((value) => value.includes('结果：通关')),
      `${label} altar outcome is sanitized to Chinese`,
    );
    assert.ok(
      collectStrings(root).some((value) => value.includes('结算 1/11 · 结果总览')),
      `${label} altar preserves the overview page count`,
    );
    assert.ok(collectStrings(altar).some((value) => value.includes('点 奖励点 85')), `${label} altar keeps reward points`);
    assert.ok(collectStrings(altar).some((value) => value.includes('蕴 灵蕴 40')), `${label} altar keeps lingyun`);
    assert.ok(collectStrings(altar).some((value) => value.includes('! 回响归档 待归档')), `${label} altar shows pending archive text and symbol`);
    assert.ok(collectStrings(altar).some((value) => value.includes('封 装备封存委托 已完成')), `${label} altar keeps commission metric`);
    assert.ok(collectStrings(altar).some((value) => value.includes('忆 装备记忆 本章已激活')), `${label} altar keeps memory metric`);
    assert.ok(collectStrings(altar).some((value) => value.includes('带回 点 120 · 蕴 40 · 物 3 · 装 1')), `${label} altar keeps the four retained loot counts`);
    assert.equal(findNode(altar, 'ResultAltarLossBand'), undefined, `${label} zero loss renders no red loss band`);
    const altarContent = altar.children.filter((node) => (
      node.name === 'ResultAltarHeader'
      || node.name === 'ResultAltarOutcome'
      || node.name.startsWith('ResultAltarMetric:')
      || node.name.endsWith('Band')
    ));
    for (let leftIndex = 0; leftIndex < altarContent.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < altarContent.length; rightIndex += 1) {
        assert.ok(
          !nodesOverlap(altarContent[leftIndex], altarContent[rightIndex]),
          `${label} altar content does not overlap: ${altarContent[leftIndex].name}/${altarContent[rightIndex].name}`,
        );
      }
    }
    const prev = findNode(root, 'ResultPagerPrev');
    const next = findNode(root, 'ResultPagerNext');
    assert.ok(prev && next, `${label} renders both pager controls`);
    assert.ok(prev.size.width >= 104 && prev.size.height >= 104, `${label} prev touch target is at least 104 design px`);
    assert.ok(next.size.width >= 104 && next.size.height >= 104, `${label} next touch target is at least 104 design px`);
    assert.ok(prev.size.width * 320 / 750 >= 44 && prev.size.height * 320 / 750 >= 44, `${label} prev remains 44+ viewport px at 320 width`);
    assert.ok(next.size.width * 320 / 750 >= 44 && next.size.height * 320 / 750 >= 44, `${label} next remains 44+ viewport px at 320 width`);
    assert.ok(!nodesOverlap(altar, prev), `${label} altar does not overlap prev navigation`);
    assert.ok(!nodesOverlap(altar, next), `${label} altar does not overlap next navigation`);
    assert.equal(findNode(root, 'ResultPagerAdvance'), undefined, `${label} has no invisible forward-only hot zone`);
    assert.ok(findNode(root, 'Action:result.archive-relic:mist_edge'), `${label} keeps the archive action in the deck`);
    assert.ok(findNode(root, 'Action:result.return-hub'), `${label} keeps the return action in the deck`);
    assert.ok(collectStrings(prev).some((value) => value.includes('×')), `${label} prev is visibly disabled on the first page`);
    assert.ok(!collectStrings(next).some((value) => value.includes('×')), `${label} next is enabled on the first page`);
    const visualNodes = collectNodes(root, (node) => (
      node.name === `VisualBackdrop:scene:${resultVisualKey}`
      || node.name === `VisualAsset:scene:${resultVisualKey}`
    ));
    assert.equal(visualNodes.length, 2, `${label} result reuses one key for backdrop and foreground`);
    const visualSprites = visualNodes.map(spriteFromResultNode);
    assert.ok(visualSprites.every(Boolean), `${label} both result visual nodes have Sprites`);
    assert.equal(visualSprites[0].spriteFrame, visualSprites[1].spriteFrame, `${label} result Sprites share one frame`);
    resultVisualFrame ??= visualSprites[0].spriteFrame;
    resultVisualTexture ??= resultVisualFrame.texture;
    assert.ok(visualSprites.every(({ spriteFrame }) => spriteFrame === resultVisualFrame), `${label} repeated result renders allocate no new frame`);
    assert.equal(resultVisualFrame.destroyCalls, 0, `${label} active result frame stays alive`);

    // Every page is reachable through the visible next control; each marker
    // only matches its own page's content.
    const markers = [
      { page: 'overview', pattern: /结果：通关/ },
      { page: 'echo', pattern: /归档一件回响（推荐）/ },
      { page: 'loot', pattern: /奖励点\+120/ },
      { page: 'commission', pattern: /封存委托 · 已完成/ },
      { page: 'memory', pattern: /本章已收录并激活「/ },
      { page: 'equipmentRoll', pattern: /前物品强度 100/ },
      { page: 'protocol', pattern: /Boss 已击败/ },
      { page: 'directive', pattern: /状态 进行中 · 3\/3 已满足/ },
      { page: 'routeContract', pattern: /已发放/ },
      { page: 'pressure', pattern: /奖励加成 \+15%/ },
      { page: 'pursuit', pattern: /奖励 时砂/ },
    ];
    for (const marker of markers) {
      const current = resultCanvas.children[resultCanvas.children.length - 1];
      if (!collectStrings(current).some((value) => marker.pattern.test(value))) {
        const nextButton = findNode(current, 'ResultPagerNext');
        assert.ok(nextButton, `${label} ${marker.page} next button missing`);
        emitTouch(nextButton, ++resultTouchId);
      }
      const after = resultCanvas.children[resultCanvas.children.length - 1];
      const pageStrings = collectStrings(after);
      assert.ok(
        pageStrings.some((value) => marker.pattern.test(value)),
        `${label} ${marker.page} page is reachable`,
      );
      // Raw-token checks run on every paged page, not just the first one.
      assertNoRawTokens(after, `${label}:${marker.page}`);
      if (marker.page === 'directive') {
        // The directive settlement page must show the VM's Chinese statusLabel
        // line and never the raw `active` enum. A fixture still supplying
        // `status:'active'` together with a view reading `directive.status`
        // would render "状态 active" and pass a looser marker, so the precise
        // line plus the active rejection kill that same-error false positive.
        assert.ok(
          pageStrings.some((value) => value.includes('奖励 灵蕴 x3')),
          `${label} directive page keeps its reward line`,
        );
        assert.ok(
          !pageStrings.some((value) => value.includes('active')),
          `${label} directive page never shows the raw active status enum`,
        );
      }
      if (marker.page === 'echo') {
        assert.equal(findNode(after, 'ResultAltar'), undefined, `${label} only the overview first screen uses the altar`);
        assert.ok(findNode(after, 'Metric:outcome'), `${label} later pager pages retain the existing metric strip`);
      }
    }
    let current = resultCanvas.children[resultCanvas.children.length - 1];
    assert.ok(collectStrings(current).some((value) => value.includes('结算 11/11')), `${label} reached the last page`);
    const disabledNext = findNode(current, 'ResultPagerNext');
    assert.ok(collectStrings(disabledNext).some((value) => value.includes('×')), `${label} next is visibly disabled on the last page`);
    const rendersBeforeDisabledTouch = resultCanvas.children.length;
    emitTouch(disabledNext, ++resultTouchId);
    assert.equal(resultCanvas.children.length, rendersBeforeDisabledTouch, `${label} disabled next does not re-render`);

    // Every rendered pager line fits the deterministic width budget.
    for (const line of pagerLineStrings(current)) {
      assert.equal(
        wrapInfiniteFlowLine(line, 36).length,
        1,
        `${label} pager line fits the width budget: ${line}`,
      );
    }

    // Prev walks back to page 1; prev is disabled there.
    for (let step = 0; step < 10; step += 1) {
      const cur = resultCanvas.children[resultCanvas.children.length - 1];
      const prevButton = findNode(cur, 'ResultPagerPrev');
      assert.ok(prevButton, `${label} prev button missing on the way back`);
      if (collectStrings(prevButton).some((value) => value.includes('×'))) break;
      emitTouch(prevButton, ++resultTouchId);
    }
    current = resultCanvas.children[resultCanvas.children.length - 1];
    assert.ok(collectStrings(current).some((value) => value.includes('结算 1/11')), `${label} prev returns to page 1`);
    const disabledPrev = findNode(current, 'ResultPagerPrev');
    assert.ok(collectStrings(disabledPrev).some((value) => value.includes('×')), `${label} prev is disabled on page 1`);
  }

  // A pager control captured from a prior root cannot mutate the new screen.
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  let root = resultCanvas.children[resultCanvas.children.length - 1];
  const staleOverviewNext = findNode(root, 'ResultPagerNext');
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  const rendersBeforeStaleOverviewTouch = resultCanvas.children.length;
  emitTouch(staleOverviewNext, ++resultTouchId);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.equal(resultCanvas.children.length, rendersBeforeStaleOverviewTouch, 'stale overview navigation does not re-render');
  assert.ok(collectStrings(root).some((value) => value.includes('结算 1/11')), 'stale overview navigation does not advance the page');
  assert.equal(resultDelegateCalls.length, 0, 'result pager navigation remains local-only');

  // A non-zero loss gets one explicit red band without colliding with retained loot.
  resultView.render(resultModel({
    ...fullResultDetail,
    lootSettlement: {
      ...fullResultDetail.lootSettlement,
      lostRewardPoints: 9,
      lostLingyun: 2,
      lostItemCount: 1,
      lostEquipmentCount: 1,
    },
  }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  const retainedBand = findNode(root, 'ResultAltarRetainedBand');
  const lossBand = findNode(root, 'ResultAltarLossBand');
  assert.ok(retainedBand && lossBand, 'lossy overview renders retained and loss bands');
  assert.ok(!nodesOverlap(retainedBand, lossBand), 'retained and loss bands do not overlap');
  assert.ok(
    collectStrings(lossBand).some((value) => value.includes('失去 点 9 · 蕴 2 · 物 1 · 装 1')),
    'loss band directly shows all four loss counts',
  );
  const lossGraphics = [...lossBand.components.values()].find((component) => Array.isArray(component.fillColor?.channels));
  // The former [74, 37, 34] loss surface now shares the native dark-ui redDark
  // token; its danger semantics and full opacity remain mandatory.
  assert.deepEqual(lossGraphics.fills[0].color.channels, DARK_UI.redDark.channels,
    'loss band uses the shared opaque dark-red semantic surface');
  assert.equal(lossGraphics.fills[0].color.channels[3], 255, 'loss band stays opaque');

  // A changed page set resets to page 1.
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  for (let step = 0; step < 3; step += 1) {
    emitTouch(findNode(resultCanvas.children[resultCanvas.children.length - 1], 'ResultPagerNext'), ++resultTouchId);
  }
  assert.ok(
    collectStrings(resultCanvas.children[resultCanvas.children.length - 1]).some((value) => value.includes('结算 4/11')),
    'result pager advanced to page 4',
  );
  resultView.render(resultModel({ relicArchiveStatus: 'archived' }), resultChrome, EXPLORE_INSETS_390);
  const archivedMissingRoot = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(
    collectStrings(archivedMissingRoot).some((value) => value.includes('结算 1/2')),
    'page-set change resets the pager to page 1',
  );
  assert.ok(findNode(archivedMissingRoot, 'ResultAltarMissingBand'), 'missing loot is explicit on the altar');
  assert.equal(findNode(archivedMissingRoot, 'ResultAltarRetainedBand'), undefined, 'missing loot does not render retained zeroes');
  assert.equal(findNode(archivedMissingRoot, 'ResultAltarLossBand'), undefined, 'missing loot does not render loss zeroes');
  assert.ok(
    collectStrings(archivedMissingRoot).some((value) => value.includes('✓ 回响归档 已归档')),
    'archived result uses Chinese text plus a non-color status symbol',
  );

  // A stable page set keeps the current page across re-renders.
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  for (let step = 0; step < 4; step += 1) {
    emitTouch(findNode(resultCanvas.children[resultCanvas.children.length - 1], 'ResultPagerNext'), ++resultTouchId);
  }
  assert.ok(
    collectStrings(resultCanvas.children[resultCanvas.children.length - 1]).some((value) => value.includes('结算 5/11')),
    'result pager advanced to page 5',
  );
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  assert.ok(
    collectStrings(resultCanvas.children[resultCanvas.children.length - 1]).some((value) => value.includes('结算 5/11')),
    'stable page set keeps the current page',
  );

  // A shrunk page set resets within bounds.
  const smallResultDetail = {
    kind: 'result',
    dungeonName: '镇魔塔一层',
    outcome: machineOutcome,
    relicArchiveStatus: 'archived',
    lootSettlement: fullResultDetail.lootSettlement,
    equipmentMemory: fullResultDetail.equipmentMemory,
  };
  resultView.render(resultModel(smallResultDetail), resultChrome, EXPLORE_INSETS_390);
  assert.ok(
    collectStrings(resultCanvas.children[resultCanvas.children.length - 1]).some((value) => value.includes('结算 1/4')),
    'shrunk page set resets within bounds',
  );

  // The echo page explains the action context; the actions themselves stay in
  // the deck for both pending and archived results.
  resultView.render(resultModel({ relicArchiveStatus: 'pending' }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(collectStrings(root).some((value) => value.includes('结果：')), 'pending result starts on the overview page');
  emitTouch(findNode(root, 'ResultPagerNext'), ++resultTouchId);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(collectStrings(root).some((value) => value.includes('归档一件回响（推荐）')), 'pending echo explains the archive actions');
  assert.ok(findNode(root, 'Action:result.archive-relic:mist_edge'), 'pending keeps the archive action');
  assert.ok(findNode(root, 'Action:result.return-hub'), 'pending keeps the return action');
  resultView.render(resultModel({ relicArchiveStatus: 'archived' }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(collectStrings(root).some((value) => value.includes('返回主神空间')), 'archived echo explains the return action');
  assert.ok(findNode(root, 'Action:result.return-hub'), 'archived keeps the return action');
  assert.equal(findNode(root, 'Action:result.archive-relic:mist_edge'), undefined, 'archived has no archive action');

  // Long Chinese/ASCII copy wraps into stable subpages instead of shrinking.
  const longChinesePrefix = '这是一段非常长的中文结算说明需要被确定性折行成多个稳定子页'.repeat(4);
  const longAsciiDiagnostic = 'equipment roll settlement record unavailable for this legacy save state '.repeat(4);
  const longResultDetail = {
    kind: 'result',
    dungeonName: '镇魔塔一层',
    outcome: `${longChinesePrefix}outcome=normal_clear; score=1; multiplier=1x; reward=1`,
    relicArchiveStatus: 'none',
    lootSettlement: { state: 'invalid', diagnostic: longAsciiDiagnostic },
  };
  resultView.render(resultModel(longResultDetail), resultChrome, EXPLORE_INSETS_390);
  let longRoot = resultCanvas.children[resultCanvas.children.length - 1];
  assertNoRawTokens(longRoot, 'long-text');
  assert.ok(
    collectStrings(longRoot).some((value) => value.includes('结算 1/4')),
    'long-text result keeps four display pages',
  );
  for (const line of pagerLineStrings(longRoot)) {
    assert.equal(wrapInfiniteFlowLine(line, 36).length, 1, `long-text page 1 line fits the width budget: ${line}`);
  }
  emitTouch(findNode(longRoot, 'ResultPagerNext'), ++resultTouchId);
  longRoot = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(
    collectStrings(longRoot).some((value) => value.includes('续 2/2')),
    'long logical page splits into stable continuation subpages',
  );
  let continuationGuard = 0;
  for (;;) {
    const current = resultCanvas.children[resultCanvas.children.length - 1];
    for (const line of pagerLineStrings(current)) {
      assert.equal(wrapInfiniteFlowLine(line, 36).length, 1, `long-text pager line fits the width budget: ${line}`);
    }
    assertNoRawTokens(current, 'long-text:paged');
    const nextButton = findNode(current, 'ResultPagerNext');
    if (!nextButton || collectStrings(nextButton).some((value) => value.includes('×'))) break;
    emitTouch(nextButton, ++resultTouchId);
    continuationGuard += 1;
    assert.ok(continuationGuard <= 10, 'long-text pager terminates');
  }
  assert.ok(continuationGuard >= 1, 'long-text pager has continuation subpages');

  // Malformed settlement cards degrade to their diagnostics without crashing.
  resultView.render(resultModel(invalidResultDetail), resultChrome, EXPLORE_INSETS_390);
  const invalidRoot = resultCanvas.children[resultCanvas.children.length - 1];
  assertNoRawTokens(invalidRoot, 'invalid-cards');
  const invalidAltarBand = findNode(invalidRoot, 'ResultAltarInvalidBand');
  assert.ok(invalidAltarBand, 'invalid loot renders an explicit altar diagnostic band');
  assert.ok(
    collectStrings(invalidAltarBand).some((value) => value.includes('× 战利品结算记录不可用')),
    'invalid loot preserves its presentation diagnostic on the overview altar',
  );
  assert.equal(findNode(invalidRoot, 'ResultAltarRetainedBand'), undefined, 'invalid loot never masquerades as retained zeroes');
  assert.ok(
    collectStrings(invalidRoot).some((value) => value.includes('结算 1/9')),
    'invalid cards keep the full page set',
  );
  for (const diagnostic of ['战利品结算记录不可用', '装备铭刻记录不可用', '协议结算记录不可用', '指令结算记录不可用', '路线契约结算记录不可用', '侵蚀结算记录不可用', '追兵结算记录不可用']) {
    let current = invalidRoot;
    for (let step = 0; step < 8; step += 1) {
      if (collectStrings(current).some((value) => value.includes(diagnostic))) break;
      const nextButton = findNode(current, 'ResultPagerNext');
      assert.ok(nextButton, `invalid card next button missing for ${diagnostic}`);
      emitTouch(nextButton, ++resultTouchId);
      current = resultCanvas.children[resultCanvas.children.length - 1];
    }
    assert.ok(
      collectStrings(current).some((value) => value.includes(diagnostic)),
      `invalid card diagnostic is reachable: ${diagnostic}`,
    );
    assertNoRawTokens(
      resultCanvas.children[resultCanvas.children.length - 1],
      `invalid-cards:${diagnostic}`,
    );
  }

  // The altar is presentation-only: existing archive/return cards still emit
  // their exact presentation events once per physical touch.
  resultDelegateCalls.length = 0;
  resultView.render(resultModel({ relicArchiveStatus: 'pending' }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(
    collectStrings(root).some((value) => value === '放弃本次回响归档。'),
    'result action without a readout renders a safe player-facing fallback',
  );
  assert.ok(
    !collectStrings(root).some((value) => value.includes('result.archive-relic:skip')),
    'result archive skip action never leaks its internal action id as copy',
  );
  const archiveAction = findNode(root, 'Action:result.archive-relic:mist_edge');
  const archiveTouchId = ++resultTouchId;
  archiveAction.emit('touch-start', { getID: () => archiveTouchId, propagationStopped: false });
  archiveAction.emit('touch-end', { getID: () => archiveTouchId, propagationStopped: false });
  archiveAction.emit('touch-end', { getID: () => archiveTouchId, propagationStopped: false });
  assert.equal(resultDelegateCalls.length, 1, 'archive physical touch emits exactly once');
  assert.match(resultDelegateCalls[0].physicalId, /^cocos-touch:\d+$/);
  assert.deepEqual({
    actionId: resultDelegateCalls[0].actionId,
    event: resultDelegateCalls[0].event,
  }, {
    actionId: 'result.archive-relic:mist_edge',
    event: { kind: 'command', command: { type: 'result/archive-relic', relicId: 'mist_edge' } },
  }, 'archive action keeps its exact event and duplicate TOUCH_END is inert');
  resultView.render(resultModel({ relicArchiveStatus: 'archived' }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  assert.ok(
    !collectStrings(root).some((value) => value.includes('result.return-hub')),
    'result return action never leaks its internal action id as copy',
  );
  emitTouch(findNode(root, 'Action:result.return-hub'), ++resultTouchId);
  assert.equal(resultDelegateCalls.length, 2, 'return physical touch emits exactly once');
  assert.deepEqual({
    actionId: resultDelegateCalls[1].actionId,
    event: resultDelegateCalls[1].event,
  }, {
    actionId: 'result.return-hub',
    event: { kind: 'command', command: { type: 'result/return-hub' } },
  }, 'return action keeps its exact presentation event');

  // After destroy, captured pager zones stay inert.
  resultView.render(resultModel({ ...fullResultDetail }), resultChrome, EXPLORE_INSETS_390);
  root = resultCanvas.children[resultCanvas.children.length - 1];
  const staleNext = findNode(root, 'ResultPagerNext');
  const finalResultVisualSprites = collectNodes(root, (node) => (
    node.name === `VisualBackdrop:scene:${resultVisualKey}`
    || node.name === `VisualAsset:scene:${resultVisualKey}`
  )).map(spriteFromResultNode);
  assert.equal(finalResultVisualSprites.length, 2, 'final result render still has exactly two visual consumers');
  const callsBeforeResultDestroy = resultDelegateCalls.length;
  const rendersBeforeResultDestroy = resultCanvas.children.length;
  assert.doesNotThrow(() => resultView.destroy());
  assert.ok(finalResultVisualSprites.every(({ spriteFrame }) => spriteFrame === null), 'result destroy detaches both shared-frame Sprites');
  assert.equal(resultVisualFrame.destroyCalls, 1, 'result destroys its single frame once');
  assert.equal(resultVisualTexture.destroyCalls, 1, 'result destroys its single texture once');
  emitTouch(staleNext, ++resultTouchId);
  assert.equal(resultCanvas.children.length, rendersBeforeResultDestroy, 'post-destroy pager touch re-renders nothing');
  assert.equal(resultDelegateCalls.length, callsBeforeResultDestroy, 'post-destroy pager touch is inert');
}

const controller = createController();
globalThis[TEST_CONTROL_KEY] = controller;

// App supply seam must project the inspected bag item, independent of the
// active NPC and the last selected shop item. Use the real pure projection.
{
  const app = new InfiniteFlowApp();
  const state = createInitialState();
  state.inventory.gate_sigil = 1;
  app.client = { getState: () => state };
  const projections = [];
  controller.actualProjection = (snapshot, local) => {
    projections.push({ snapshot, local });
    return buildActualGameViewModel(snapshot, local);
  };
  try {
    for (const hubPanel of ['equipment', 'supplies']) {
      app.localUiState = { hubPanel, hubSelections: { supplies: 'healing_pill', equipment: 'training_blade' } };
      const before = structuredClone(app.localUiState);
      app.viewModel = buildActualGameViewModel(state, app.localUiState);
      const actions = app.projectSupplyActions('gate_sigil');
      assert.equal(projections.at(-1).local.hubPanel, 'supplies', 'App uses the supplies command projection');
      assert.equal(projections.at(-1).local.hubSelections.supplies, 'gate_sigil', 'App targets the inspected bag item');
      assert.equal(projections.at(-1).snapshot, state, 'App projects current domain state');
      assert.deepEqual(app.localUiState, before, 'on-demand supply projection preserves NPC selections');
      const toggle = actions.find(action => action.actionId === 'hub.supplies.toggle:gate_sigil');
      assert.ok(toggle?.enabled && toggle.event?.kind === 'command', 'App makes the gate toggle reachable');
      const result = reduceGameCommand(state, toggle.event.command);
      assert.equal(result.status, 'committed');
      assert.ok(result.state.preparedItemIds.includes('gate_sigil'), 'App seam command configures the inspected gate');
    }
    const count = projections.length;
    app.viewModel = { phase: 'combat' };
    assert.deepEqual(app.projectSupplyActions('gate_sigil'), [], 'App never provides hub carry actions during combat');
    assert.equal(projections.length, count, 'combat does not request an auxiliary projection');
  } finally {
    delete controller.actualProjection;
    app.client = undefined;
  }
}

function createRetryScheduler() {
  const tasks = [];
  return {
    tasks,
    delays: [],
    schedule(delayMs, callback) {
      const task = { delayMs, callback, cancelled: false };
      this.delays.push(delayMs);
      tasks.push(task);
      return task;
    },
    cancel(handle) {
      handle.cancelled = true;
      const index = tasks.indexOf(handle);
      if (index >= 0) tasks.splice(index, 1);
    },
    runNext() {
      const task = tasks.shift();
      assert.ok(task, 'no visual retry task pending');
      task.callback();
      return task;
    },
  };
}

const retryScheduler = createRetryScheduler();
configureInfiniteFlowAssetRetryScheduler(retryScheduler);

async function settleUntil(predicate, message) {
  for (let turn = 0; turn < 20; turn += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

async function drainMicrotasks(turns = 8) {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}

function installWx() {
  // Every wx storage touch is recorded so NON_RELEASE devtools scenarios can
  // prove they never read or write the wx journal (no epoch/save persistence).
  const storageCalls = [];
  globalThis.wx = {
    storageCalls,
    getStorageSync(key) { storageCalls.push({ op: 'get', key }); },
    setStorageSync(key) { storageCalls.push({ op: 'set', key }); },
    getUserCryptoManager() {},
    onHide() {},
    offHide() {},
    onShow() {},
    offShow() {},
    onMemoryWarning() {},
    offMemoryWarning() {},
    getWindowInfo() {
      return {
        windowWidth: 375,
        windowHeight: 667,
        screenTop: 0,
        safeArea: { top: 44, right: 375, bottom: 633, left: 0 },
      };
    },
  };
}

// === WeChat DevTools NON_RELEASE runtime ===
// These scenarios must run before the durability boundary is injected below. The
// explicit boundary is a module singleton that can never be withdrawn, so the
// "no boundary injected" contract can only be observed here, ahead of injection.

// Case (a): devtools + no boundary reaches a memory-backed client and completes
// at least one domain dispatch, permanently labeled NON_RELEASE. The domain
// client is handed an InMemoryStoragePort, never the wx journal storage.
installWx();
globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
{
  const client = fakeClient('wx-devtools-live');
  const ports = fakePorts();
  let clientOptions;
  let portsOptions;
  client.dispatchResults.push(Promise.resolve({ status: 'committed', events: [], stateRevision: 71 }));
  controller.portsFactories.push((api, options) => {
    portsOptions = options;
    return ports;
  });
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'devtools NON_RELEASE client was not handed off');
  assert.equal(app.runtimeMode.kind, 'wx-devtools');
  assert.match(app.runtimeMode.label, /微信开发者工具 · NON_RELEASE/);
  assert.match(app.runtimeMode.detail, /内存存档/);
  assert.match(app.runtimeMode.detail, /关闭或刷新即丢失/);
  assert.equal(app.runtimeMode.nonReleaseEphemeral, true);
  // Fake-controller evidence: the supplied storage is an InMemoryStoragePort and
  // is not the wx journal storage the platform ports expose; the ports themselves
  // are built without any durable/journal storage option.
  assert.equal(clientOptions.storage.constructor.name, 'InMemoryStoragePort');
  assert.notEqual(clientOptions.storage, ports.storage);
  assert.equal(portsOptions.storage, undefined, 'devtools ports build no durable/journal storage');
  assert.equal(clientOptions.seedPort, ports.seeds);
  assert.equal(clientOptions.lifecycle, ports.lifecycle);
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    'devtools NON_RELEASE bootstrap never reads or writes wx storage',
  );
  assert.doesNotMatch(
    `${app.runtimeMode.label} ${app.runtimeMode.detail} ${app.activityMessage}`,
    /持久已签核|durable|已注入持久边界/i,
    'devtools mode never claims attested/durable persistence',
  );
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:devtools-dispatch', 'command.devtools', {
    kind: 'command',
    command: { type: 'test/devtools-command' },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    'devtools domain dispatch did not start',
  );
  await drainMicrotasks();
  assert.match(app.activityMessage, /已提交 command\.devtools/);
  assert.equal(app.runtimeMode.kind, 'wx-devtools', 'a completed dispatch keeps NON_RELEASE mode');
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    'devtools NON_RELEASE dispatch never reads or writes wx storage',
  );
  app.onDestroy();
  assert.equal(client.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// getSystemInfoSync is the sole platform fallback, and only when getDeviceInfo is
// unavailable. An absent getDeviceInfo reporting devtools still reaches NON_RELEASE.
installWx();
delete globalThis.wx.getDeviceInfo;
globalThis.wx.getSystemInfoSync = () => ({
  platform: 'devtools',
  windowWidth: 375,
  windowHeight: 667,
  screenTop: 0,
  safeArea: { top: 44, right: 375, bottom: 633, left: 0 },
});
{
  const client = fakeClient('wx-devtools-sysinfo-fallback');
  const ports = fakePorts();
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    'getSystemInfoSync devtools fallback did not reach a client',
  );
  assert.equal(app.runtimeMode.kind, 'wx-devtools');
  assert.match(app.runtimeMode.label, /NON_RELEASE/);
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    'getSystemInfoSync devtools fallback never touches wx storage',
  );
  app.onDestroy();
}

// Case (b): a precisely reported non-devtools platform, with no boundary, blocks
// before any platform ports or writable client exist and is never preview.
for (const platform of ['ios', 'android', 'ohos', 'mac', 'windows', 'unknown']) {
  installWx();
  globalThis.wx.getDeviceInfo = () => ({ platform });
  const portsBefore = controller.createPortsCalls;
  const clientsBefore = controller.createClientCalls;
  const app = new InfiniteFlowApp();
  app.start();
  await drainMicrotasks();
  assert.equal(app.runtimeMode.kind, 'blocked', `${platform} must block`);
  assert.equal(app.client, undefined);
  assert.equal(controller.createPortsCalls, portsBefore, `${platform} builds no ports`);
  assert.equal(controller.createClientCalls, clientsBefore, `${platform} builds no client`);
  assert.doesNotMatch(
    `${app.runtimeMode.label} ${app.runtimeMode.detail}`,
    /NON_RELEASE|预览|preview/i,
    `${platform} is neither NON_RELEASE nor preview`,
  );
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    `${platform} blocks before any wx storage read or write`,
  );
  app.onDestroy();
}

// Case (b cont.): a malformed or throwing getDeviceInfo stays unknown and blocked
// even when getSystemInfoSync would report devtools. getSystemInfoSync is only a
// fallback for a missing getDeviceInfo, never a silent override for a failing one.
for (const variant of ['malformed', 'throwing']) {
  installWx();
  if (variant === 'malformed') {
    globalThis.wx.getDeviceInfo = () => ({ noPlatform: true });
  } else {
    globalThis.wx.getDeviceInfo = () => {
      throw new Error('synthetic getDeviceInfo failure');
    };
  }
  globalThis.wx.getSystemInfoSync = () => ({ platform: 'devtools' });
  const portsBefore = controller.createPortsCalls;
  const clientsBefore = controller.createClientCalls;
  const app = new InfiniteFlowApp();
  app.start();
  await drainMicrotasks();
  assert.equal(app.runtimeMode.kind, 'blocked', `${variant} getDeviceInfo must block`);
  assert.equal(app.client, undefined);
  assert.equal(controller.createPortsCalls, portsBefore, `${variant} builds no ports`);
  assert.equal(controller.createClientCalls, clientsBefore, `${variant} builds no client`);
  assert.doesNotMatch(`${app.runtimeMode.label} ${app.runtimeMode.detail}`, /NON_RELEASE/);
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    `${variant} getDeviceInfo blocks before any wx storage read or write`,
  );
  app.onDestroy();
}

// Case (d): devtools lifecycle diagnostics keep the NON_RELEASE mode and never
// upgrade to the attested/durable wx labeling, even for a durable resume result.
installWx();
globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
{
  const client = fakeClient('wx-devtools-lifecycle');
  const ports = fakePorts();
  let clientOptions;
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'devtools lifecycle client was not handed off');
  assert.equal(typeof clientOptions.onLifecycleDiagnostic, 'function');
  clientOptions.onLifecycleDiagnostic({ operation: 'resume', result: { status: 'durable' } });
  assert.equal(app.runtimeMode.kind, 'wx-devtools', 'a durable resume cannot upgrade devtools mode');
  assert.match(app.runtimeMode.label, /NON_RELEASE/);
  assert.doesNotMatch(
    `${app.runtimeMode.label} ${app.runtimeMode.detail} ${app.activityMessage}`,
    /持久已签核|durable|已注入持久边界/i,
  );
  clientOptions.onLifecycleDiagnostic({
    operation: 'persist',
    error: new Error('synthetic persist failure'),
  });
  assert.equal(app.runtimeMode.kind, 'wx-devtools');
  assert.doesNotMatch(
    `${app.runtimeMode.label} ${app.runtimeMode.detail} ${app.activityMessage}`,
    /持久已签核|durable/i,
  );
  app.onDestroy();
}

// Case (e): destruction during devtools secure-seed prefill disposes the pending
// pool/lifecycle at once and never begins client creation when the await settles.
installWx();
globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
{
  const pendingPrefill = deferred();
  const ports = fakePorts(pendingPrefill.promise);
  const clientsBefore = controller.createClientCalls;
  controller.portsFactories.push(() => ports);
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => ports.seeds.prefillCalls === 1, 'devtools secure prefill did not start');
  app.onDestroy();
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  pendingPrefill.resolve();
  await drainMicrotasks();
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(controller.createClientCalls, clientsBefore, 'destroyed devtools prefill builds no client');
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Case (e cont.): destruction during devtools client creation disposes the late
// client and every local resource, and never publishes stale client/render state.
installWx();
globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
{
  const pendingClient = deferred();
  const client = fakeClient('wx-devtools-client-cancelled');
  const ports = fakePorts();
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => pendingClient.promise);
  const expectedCall = controller.createClientCalls + 1;
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => controller.createClientCalls === expectedCall,
    'devtools client creation did not start',
  );
  const view = controller.views.at(-1);
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  pendingClient.resolve(client);
  await settleUntil(() => client.disposeCalls === 1, 'cancelled devtools client leaked');
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
  assert.equal(app.view, undefined);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
}

// Case (f): a pending devtools command dispatch stays behind the generation/client
// fence. Fulfillment and rejection after destruction are both inert: no UI
// writeback, no state read, no post-command seed refill, no wx storage touch,
// and the mode is never rewritten by a stale settle.
for (const settlement of ['fulfilled', 'rejected']) {
  installWx();
  globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
  const pendingDispatch = deferred();
  const client = fakeClient(`wx-devtools-stale-${settlement}`);
  const ports = fakePorts();
  client.dispatchResults.push(pendingDispatch.promise);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${settlement} stale devtools client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    `touch:devtools-stale:${settlement}`,
    `command.devtools-stale.${settlement}`,
    {
      kind: 'command',
      command: { type: 'test/devtools-stale-command' },
    },
  );
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${settlement} stale devtools dispatch did not start`,
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  if (settlement === 'fulfilled') {
    pendingDispatch.resolve({ status: 'committed', events: [], stateRevision: 81 });
  } else {
    pendingDispatch.reject(new Error('synthetic devtools dispatch failure'));
  }
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(
    ports.seeds.prefillCalls,
    1,
    'stale devtools settle triggers no post-command seed refill',
  );
  assert.equal(client.disposeCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
  assert.equal(
    app.runtimeMode.kind,
    'wx-devtools',
    'a stale settle never rewrites the destroyed NON_RELEASE mode',
  );
  assert.deepEqual(
    globalThis.wx.storageCalls,
    [],
    'stale devtools settle never reads or writes wx storage',
  );
}

// Case (c): an explicitly injected durability boundary wins even when the host
// reports platform=devtools. This scenario runs after the boundary injection
// below, so it lives further down among the attested/durable wx scenarios.

// Restore a clean wx-free baseline for the boundary-injected scenarios below.
delete globalThis.wx;

// From here on, the durability boundary singleton is injected and can never be
// withdrawn. Every scenario below exercises the attested/durable wx path.
configureInfiniteFlowWxDurabilityBoundary({
  attestationId: 'headless-race-test',
  attest() {},
});

// Case (c): an explicitly injected durability boundary wins even when the host
// reports platform=devtools. The attested wx path is used with durable storage,
// and the NON_RELEASE / memory-storage labeling never appears.
installWx();
globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
{
  const client = fakeClient('wx-devtools-boundary-wins');
  const ports = fakePorts();
  let portsOptions;
  controller.portsFactories.push((api, options) => {
    portsOptions = options;
    return ports;
  });
  controller.clientFactories.push((options) => {
    assert.equal(options.storage, ports.storage, 'attested path uses the durable platform storage');
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'boundary-wins devtools client was not handed off');
  assert.equal(app.runtimeMode.kind, 'wx');
  assert.match(app.runtimeMode.label, /已注入持久边界/);
  assert.doesNotMatch(
    `${app.runtimeMode.label} ${app.runtimeMode.detail} ${app.activityMessage}`,
    /NON_RELEASE|内存存档/,
    'the attested boundary path never shows NON_RELEASE',
  );
  assert.ok(
    portsOptions.storage && portsOptions.storage.durabilityBoundary,
    'attested ports receive the durability boundary',
  );
  app.onDestroy();
}
delete globalThis.wx;


// A detected wx host must provide exact lifecycle removal APIs. Missing any
// one of them blocks before platform ports (and therefore writable state) exist.
for (const missingOff of ['offHide', 'offShow', 'offMemoryWarning']) {
  installWx();
  delete globalThis.wx[missingOff];
  const callsBefore = controller.createPortsCalls;
  const app = new InfiniteFlowApp();
  app.start();
  assert.equal(controller.createPortsCalls, callsBefore);
  assert.equal(app.runtimeMode.kind, 'blocked');
  assert.match(app.blockingMessage, new RegExp(missingOff));
  app.onDestroy();
}

// Preview: destroying while client creation is pending must dispose only the
// resolved local and must never publish it back onto the component.
delete globalThis.wx;
{
  const pendingClient = deferred();
  const client = fakeClient('preview-cancelled');
  controller.clientFactories.push(() => pendingClient.promise);
  const expectedCall = controller.createClientCalls + 1;
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => controller.createClientCalls === expectedCall,
    'preview client creation did not start',
  );
  app.onDestroy();
  const stateAfterDestroy = { ...app };
  pendingClient.resolve(client);
  await settleUntil(() => client.disposeCalls === 1, 'cancelled preview client leaked');
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
  assert.equal(app.view, undefined);
  assert.equal(app.activityMessage, stateAfterDestroy.activityMessage);
}

// WeChat: destroying during secure seed prefill immediately disposes the pending
// pool/lifecycle and never begins client creation when the old await settles.
installWx();
{
  const pendingPrefill = deferred();
  const ports = fakePorts(pendingPrefill.promise);
  const callsBefore = controller.createClientCalls;
  controller.portsFactories.push(() => ports);
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => ports.seeds.prefillCalls === 1, 'secure prefill did not start');
  app.onDestroy();
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  pendingPrefill.resolve();
  await drainMicrotasks();
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(controller.createClientCalls, callsBefore);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// WeChat: destroying during client creation must dispose the late client and
// every local platform resource after the await settles.
installWx();
{
  const pendingClient = deferred();
  const client = fakeClient('wx-cancelled');
  const ports = fakePorts();
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => pendingClient.promise);
  const expectedCall = controller.createClientCalls + 1;
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => controller.createClientCalls === expectedCall,
    'wx client creation did not start',
  );
  app.onDestroy();
  pendingClient.resolve(client);
  await settleUntil(() => client.disposeCalls === 1, 'cancelled wx client leaked');
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// The token must not perturb the success path: a live preview client is handed
// off once and remains owned until Cocos destroys the component.
delete globalThis.wx;
{
  const client = fakeClient('preview-live');
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'live preview client was not handed off');
  assert.equal(client.disposeCalls, 0);
  assert.equal(app.destroyed, false);
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:hub-panel', 'hub.panel:equipment', {
    kind: 'local',
    action: { type: 'hub/select-panel', panel: 'equipment' },
  });
  assert.equal(app.localUiState.hubPanel, 'equipment');
  view.callbacks.activate('touch:hub-entry', 'hub.equipment.select:next', {
    kind: 'local',
    action: {
      type: 'hub/select-catalog-entry',
      panel: 'equipment',
      entityId: 'armor_piercing_sword',
    },
  });
  assert.equal(
    app.localUiState.hubSelections.equipment,
    'armor_piercing_sword',
  );
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  assert.equal(client.dispatchPhysicalCalls.length, 0);
  app.onDestroy();
  assert.equal(client.disposeCalls, 1);
  assert.equal(app.client, undefined);
}

const initialCommissionDraft = {
  equipmentIds: ['armor_piercing_sword'],
  targetMaterialId: 'refined_iron',
};
const readyCommissionDraft = {
  equipmentIds: ['armor_piercing_sword', 'chronal_edge'],
  targetMaterialId: 'time_sand',
};

// Commission draft changes are normalized by presentation and reach the host as
// whole replacements. The host retains the exact second snapshot without merge,
// validation, or command traffic.
delete globalThis.wx;
{
  const client = fakeClient('preview-commission-draft-replacement');
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    'commission draft replacement preview client was not handed off',
  );
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:commission:draft:first', 'hub.equipment.commission.toggle:first', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: initialCommissionDraft,
    },
  });
  assert.equal(app.localUiState.equipmentCommissionDraft, initialCommissionDraft);
  view.callbacks.activate('touch:commission:draft:replacement', 'hub.equipment.commission.material', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: readyCommissionDraft,
    },
  });
  assert.equal(app.localUiState.equipmentCommissionDraft, readyCommissionDraft);
  assert.deepEqual(app.localUiState.equipmentCommissionDraft, readyCommissionDraft);
  assert.equal(client.dispatchPhysicalCalls.length, 0);
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  app.onDestroy();
}

// A live committed or duplicate start is one unified command and clears the
// transient draft only after the client result has crossed the action fence.
for (const resultStatus of ['committed', 'duplicate']) {
  delete globalThis.wx;
  const client = fakeClient(`preview-commission-start-${resultStatus}`);
  client.dispatchResults.push(Promise.resolve({
    status: resultStatus,
    stateRevision: resultStatus === 'committed' ? 31 : 32,
  }));
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${resultStatus} commission start preview client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(`touch:commission:start:draft:${resultStatus}`, 'hub.equipment.commission.material', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: readyCommissionDraft,
    },
  });
  view.callbacks.activate(`touch:commission:start:${resultStatus}`, 'hub.equipment.commission.start', {
    kind: 'command',
    command: {
      type: 'hub/start-equipment-commission',
      equipmentIds: readyCommissionDraft.equipmentIds,
      targetMaterialId: readyCommissionDraft.targetMaterialId,
    },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${resultStatus} commission start dispatch did not start`,
  );
  await drainMicrotasks();
  assert.deepEqual(client.dispatchPhysicalCalls[0], {
    physicalId: `touch:commission:start:${resultStatus}`,
    actionId: 'hub.equipment.commission.start',
    command: {
      type: 'hub/start-equipment-commission',
      equipmentIds: readyCommissionDraft.equipmentIds,
      targetMaterialId: readyCommissionDraft.targetMaterialId,
    },
  });
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(app.localUiState.equipmentCommissionDraft, undefined);
  app.onDestroy();
}

// Rejected, invalid, and persistence-blocked starts preserve the full draft so
// the user can correct or retry it after the failed write boundary.
for (const result of [
  { status: 'rejected' },
  { status: 'invalid-input' },
  {
    status: 'persistence-blocked',
    error: { code: 'fixture-write-blocked', message: 'synthetic write block' },
  },
]) {
  delete globalThis.wx;
  const client = fakeClient(`preview-commission-start-${result.status}`);
  client.dispatchResults.push(Promise.resolve(result));
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${result.status} commission start preview client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(`touch:commission:preserve:draft:${result.status}`, 'hub.equipment.commission.material', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: readyCommissionDraft,
    },
  });
  view.callbacks.activate(`touch:commission:preserve:${result.status}`, 'hub.equipment.commission.start', {
    kind: 'command',
    command: {
      type: 'hub/start-equipment-commission',
      equipmentIds: readyCommissionDraft.equipmentIds,
      targetMaterialId: readyCommissionDraft.targetMaterialId,
    },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${result.status} commission start dispatch did not start`,
  );
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(app.localUiState.equipmentCommissionDraft, readyCommissionDraft);
  app.onDestroy();
}

// A recoverable write block offers a retry that only re-persists the pending
// candidate: no second domain command, no early state change, and the original
// runtime chrome returns once the write is durable.
{
  delete globalThis.wx;
  const client = fakeClient('preview-persistence-retry');
  client.dispatchResults.push(Promise.resolve({
    status: 'persistence-blocked',
    error: { code: 'storage-write', message: 'synthetic quota' },
  }));
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'persistence retry preview client was not handed off');
  const view = controller.views.at(-1);
  const modeBefore = view.lastRender.chrome.modeKind;
  assert.notEqual(modeBefore, 'blocked');
  assert.equal(view.lastRender.chrome.persistenceRetry, undefined);
  view.callbacks.retryPersistence();
  await drainMicrotasks();
  assert.equal(client.retryPersistenceCalls, 0, 'retry is inert without a persistence block');

  view.callbacks.activate('touch:persistence:block', 'hub.recover', {
    kind: 'command',
    command: { type: 'hub/recover' },
  });
  await settleUntil(
    () => view.lastRender.chrome.modeKind === 'blocked',
    'persistence-blocked dispatch did not block the runtime',
  );
  assert.equal(view.lastRender.chrome.persistenceRetry, true);
  assert.match(view.lastRender.chrome.blockingMessage, /storage-write/);

  const stillBlocked = deferred();
  client.retryPersistenceResults.push(stillBlocked.promise);
  view.callbacks.retryPersistence();
  view.callbacks.retryPersistence();
  await drainMicrotasks();
  assert.equal(client.retryPersistenceCalls, 1, 'a retry in flight ignores repeated taps');
  assert.equal(view.lastRender.chrome.busyActionId, 'runtime.persistence.retry');
  stillBlocked.resolve({
    status: 'persistence-blocked',
    error: { code: 'storage-flush', message: 'synthetic flush failure' },
  });
  await settleUntil(
    () => view.lastRender.chrome.busyActionId === undefined,
    'blocked retry did not settle',
  );
  assert.equal(view.lastRender.chrome.modeKind, 'blocked');
  assert.equal(view.lastRender.chrome.persistenceRetry, true);
  assert.match(view.lastRender.chrome.blockingMessage, /storage-flush/);

  client.retryPersistenceResults.push(Promise.resolve({
    status: 'committed',
    commandId: 'preview:1',
    stateRevision: 1,
    ledgerRevision: 1,
    events: [],
  }));
  view.callbacks.retryPersistence();
  await settleUntil(
    () => view.lastRender.chrome.modeKind === modeBefore,
    'durable retry did not restore the runtime mode',
  );
  assert.equal(view.lastRender.chrome.blockingMessage, undefined);
  assert.equal(view.lastRender.chrome.persistenceRetry, undefined);
  assert.match(view.lastRender.chrome.activityMessage, /已补写 preview:1/);
  assert.equal(client.retryPersistenceCalls, 2);
  assert.equal(client.dispatchPhysicalCalls.length, 1, 'retry never re-dispatches the domain command');
  view.callbacks.retryPersistence();
  await drainMicrotasks();
  assert.equal(client.retryPersistenceCalls, 2, 'retry is inert after the block clears');
  app.onDestroy();
}

// Recall uses the same command path. Both successful result variants clear any
// transient draft retained by the host and emit exactly one physical command.
for (const resultStatus of ['committed', 'duplicate']) {
  delete globalThis.wx;
  const client = fakeClient(`preview-commission-recall-${resultStatus}`);
  client.dispatchResults.push(Promise.resolve({
    status: resultStatus,
    stateRevision: resultStatus === 'committed' ? 41 : 42,
  }));
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${resultStatus} commission recall preview client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(`touch:commission:recall:draft:${resultStatus}`, 'hub.equipment.commission.material', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: readyCommissionDraft,
    },
  });
  view.callbacks.activate(`touch:commission:recall:${resultStatus}`, 'hub.equipment.commission.recall', {
    kind: 'command',
    command: { type: 'hub/recall-equipment-commission' },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${resultStatus} commission recall dispatch did not start`,
  );
  await drainMicrotasks();
  assert.deepEqual(client.dispatchPhysicalCalls[0], {
    physicalId: `touch:commission:recall:${resultStatus}`,
    actionId: 'hub.equipment.commission.recall',
    command: { type: 'hub/recall-equipment-commission' },
  });
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(app.localUiState.equipmentCommissionDraft, undefined);
  app.onDestroy();
}

// Late commission fulfillment and rejection after destruction cannot clear the
// draft, refresh the UI, read disposed state, or issue a second command.
for (const settlement of ['fulfilled', 'rejected']) {
  delete globalThis.wx;
  const pendingDispatch = deferred();
  const client = fakeClient(`preview-commission-stale-${settlement}`);
  client.dispatchResults.push(pendingDispatch.promise);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${settlement} stale commission preview client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(`touch:commission:stale:draft:${settlement}`, 'hub.equipment.commission.material', {
    kind: 'local',
    action: {
      type: 'hub/set-equipment-commission-draft',
      draft: readyCommissionDraft,
    },
  });
  view.callbacks.activate(`touch:commission:stale:${settlement}`, 'hub.equipment.commission.start', {
    kind: 'command',
    command: {
      type: 'hub/start-equipment-commission',
      equipmentIds: readyCommissionDraft.equipmentIds,
      targetMaterialId: readyCommissionDraft.targetMaterialId,
    },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${settlement} stale commission dispatch did not start`,
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  if (settlement === 'fulfilled') {
    pendingDispatch.resolve({ status: 'committed', events: [], stateRevision: 51 });
  } else {
    pendingDispatch.reject(new Error('synthetic commission dispatch failure'));
  }
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(app.localUiState.equipmentCommissionDraft, readyCommissionDraft);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(client.disposeCalls, 1);
  assert.equal(app.client, undefined);
}

// Equipment-memory activation stays on the ordinary command path: one physical
// input forwards the exact payload and retains the normal post-command seed refill.
installWx();
{
  const client = fakeClient('wx-equipment-memory-activate');
  const ports = fakePorts();
  client.dispatchResults.push(Promise.resolve({
    status: 'committed', events: [],
    stateRevision: 61,
  }));
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    'equipment-memory activation wx client was not handed off',
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    'touch:equipment-memory:activate',
    'hub.equipment.memory.cycle',
    {
      kind: 'command',
      command: {
        type: 'hub/activate-equipment-memory',
        equipmentId: 'armor_piercing_sword',
        memoryId: 'metro_memory',
      },
    },
  );
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    'equipment-memory activation dispatch did not start',
  );
  await settleUntil(
    () => ports.seeds.prefillCalls === 2,
    'equipment-memory activation skipped the standard post-command seed refill',
  );
  assert.deepEqual(client.dispatchPhysicalCalls[0], {
    physicalId: 'touch:equipment-memory:activate',
    actionId: 'hub.equipment.memory.cycle',
    command: {
      type: 'hub/activate-equipment-memory',
      equipmentId: 'armor_piercing_sword',
      memoryId: 'metro_memory',
    },
  });
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  app.onDestroy();
}

// The two adjacent equipment feature help buttons reuse the existing generic
// help/open local action; neither click creates a client command.
delete globalThis.wx;
{
  const client = fakeClient('preview-equipment-feature-help');
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    'equipment feature help preview client was not handed off',
  );
  const view = controller.views.at(-1);
  for (const helpId of ['equipmentCommission', 'equipmentMemory']) {
    view.callbacks.activate(
      `touch:help:${helpId}`,
      `help.open:${helpId}`,
      {
        kind: 'local',
        action: { type: 'help/open', helpId },
      },
    );
    assert.equal(app.localUiState.activeHelpId, helpId);
  }
  assert.equal(client.dispatchPhysicalCalls.length, 0);
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  app.onDestroy();
}

// Fulfillment and rejection of a pending memory activation after destruction
// are inert: no late finish, state read, UI render, or seed refill can escape.
for (const settlement of ['fulfilled', 'rejected']) {
  installWx();
  const pendingDispatch = deferred();
  const client = fakeClient(`wx-equipment-memory-stale-${settlement}`);
  const ports = fakePorts();
  client.dispatchResults.push(pendingDispatch.promise);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${settlement} stale equipment-memory wx client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    `touch:equipment-memory:stale:${settlement}`,
    'hub.equipment.memory.cycle',
    {
      kind: 'command',
      command: {
        type: 'hub/activate-equipment-memory',
        equipmentId: 'armor_piercing_sword',
        memoryId: 'metro_memory',
      },
    },
  );
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${settlement} stale equipment-memory dispatch did not start`,
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  if (settlement === 'fulfilled') {
    pendingDispatch.resolve({ status: 'committed', events: [], stateRevision: 62 });
  } else {
    pendingDispatch.reject(new Error('synthetic equipment-memory dispatch failure'));
  }
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(ports.seeds.prefillCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(client.disposeCalls, 1);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Entry route selection is host-local: valid contracts are retained across
// protocol/tier edits, explicit clearing works, cross-dungeon input is rejected,
// and changing dungeon clears the selection without touching client or seed APIs.
delete globalThis.wx;
{
  const client = fakeClient('preview-entry-route-contract');
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'entry-route preview client was not handed off');
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:entry-route:set', 'hub.entry.route:set', {
    kind: 'local',
    action: {
      type: 'entry/select-route-contract',
      routeContractId: 'tower_mist_watch',
    },
  });
  assert.equal(app.localUiState.entryDraft.routeContractId, 'tower_mist_watch');
  view.callbacks.activate('touch:entry-route:clear', 'hub.entry.route:clear', {
    kind: 'local',
    action: { type: 'entry/select-route-contract', routeContractId: null },
  });
  assert.equal(app.localUiState.entryDraft.routeContractId, undefined);
  view.callbacks.activate('touch:entry-route:restore', 'hub.entry.route:restore', {
    kind: 'local',
    action: {
      type: 'entry/select-route-contract',
      routeContractId: 'tower_mist_watch',
    },
  });
  view.callbacks.activate('touch:entry-protocol:deep', 'hub.entry.protocol:deep', {
    kind: 'local',
    action: { type: 'entry/select-protocol', protocolId: 'deep' },
  });
  assert.deepEqual(app.localUiState.entryDraft, {
    dungeonId: 'demon_tower_1',
    protocolId: 'deep',
    infernoTier: 1,
    routeContractId: 'tower_mist_watch',
  });
  view.callbacks.activate('touch:entry-tier:2', 'hub.entry.tier:2', {
    kind: 'local',
    action: { type: 'entry/set-inferno-tier', infernoTier: 2 },
  });
  assert.equal(app.localUiState.entryDraft.routeContractId, 'tower_mist_watch');
  const draftBeforeInvalidRoute = app.localUiState.entryDraft;
  view.callbacks.activate('touch:entry-route:invalid', 'hub.entry.route:invalid', {
    kind: 'local',
    action: {
      type: 'entry/select-route-contract',
      routeContractId: 'metro_wraith_return',
    },
  });
  assert.equal(app.localUiState.entryDraft, draftBeforeInvalidRoute);
  assert.match(app.activityMessage, /本地输入拒绝.*路线契约/);
  view.callbacks.activate('touch:entry-enter:invalid', 'hub.entry.enter:invalid', {
    kind: 'local',
    action: {
      type: 'entry/request-enter',
      draft: {
        dungeonId: 'demon_tower_1',
        protocolId: 'deep',
        infernoTier: 2,
        routeContractId: 'metro_wraith_return',
      },
    },
  });
  await drainMicrotasks();
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  view.callbacks.activate('touch:entry-dungeon:metro', 'hub.entry.dungeon:metro', {
    kind: 'local',
    action: { type: 'entry/select-dungeon', dungeonId: 'metro_abyss' },
  });
  assert.deepEqual(app.localUiState.entryDraft, {
    dungeonId: 'metro_abyss',
    protocolId: 'deep',
    infernoTier: 2,
  });
  assert.equal(client.dispatchPhysicalCalls.length, 0);
  app.onDestroy();
}

// The WeChat success path likewise hands both the client and secure seed pool
// to the component only after all asynchronous construction has completed.
installWx();
{
  const client = fakeClient('wx-live');
  const ports = fakePorts();
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push((options) => {
    assert.equal(options.seedPort, ports.seeds);
    assert.equal(options.lifecycle, ports.lifecycle);
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'live wx client was not handed off');
  assert.equal(app.secureSeeds, ports.seeds);
  assert.equal(app.lifecycle, ports.lifecycle);
  assert.equal(client.disposeCalls, 0);
  assert.equal(ports.seeds.disposeCalls, 0);
  assert.equal(ports.seeds.clearCalls, 0);
  app.onDestroy();
  assert.equal(client.disposeCalls, 1);
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Relic seed selection is the one local-to-command bridge. Both payload shapes
// dispatch exactly once and never prefill or consume an entry seed.
for (const seedRelicId of ['mist_edge', null]) {
  installWx();
  const client = fakeClient(`wx-relic-seed-${seedRelicId ?? 'none'}`);
  const ports = fakePorts();
  client.dispatchResults.push(Promise.resolve({
    status: 'committed', events: [],
    stateRevision: seedRelicId === null ? 22 : 21,
  }));
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${seedRelicId ?? 'null'} relic-seed wx client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    `touch:entry-relic:${seedRelicId ?? 'none'}`,
    `hub.entry.relic:${seedRelicId ?? 'none'}`,
    {
      kind: 'local',
      action: {
        type: 'entry/select-relic-seed',
        frame: 'assault',
        seedRelicId,
      },
    },
  );
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${seedRelicId ?? 'null'} relic-seed dispatch did not start`,
  );
  await drainMicrotasks();
  assert.deepEqual(client.dispatchPhysicalCalls[0], {
    physicalId: `touch:entry-relic:${seedRelicId ?? 'none'}`,
    actionId: `hub.entry.relic:${seedRelicId ?? 'none'}`,
    command: {
      type: 'hub/configure-relic',
      frame: 'assault',
      ...(seedRelicId === null ? {} : { seedRelicId }),
    },
  });
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  assert.equal(ports.seeds.prefillCalls, 1);
  app.onDestroy();
}

// A pending relic-seed command keeps the standard generation/client identity
// fence: fulfillment and rejection after destruction are both inert.
for (const settlement of ['fulfilled', 'rejected']) {
  installWx();
  const pendingDispatch = deferred();
  const client = fakeClient(`wx-relic-seed-stale-${settlement}`);
  const ports = fakePorts();
  client.dispatchResults.push(pendingDispatch.promise);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${settlement} stale relic-seed wx client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    `touch:entry-relic-stale:${settlement}`,
    `hub.entry.relic-stale:${settlement}`,
    {
      kind: 'local',
      action: {
        type: 'entry/select-relic-seed',
        frame: 'assault',
        seedRelicId: 'mist_edge',
      },
    },
  );
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    `${settlement} stale relic-seed dispatch did not start`,
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  if (settlement === 'fulfilled') {
    pendingDispatch.resolve({ status: 'committed', events: [], stateRevision: 23 });
  } else {
    pendingDispatch.reject(new Error('synthetic relic-seed dispatch failure'));
  }
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(ports.seeds.prefillCalls, 1);
  assert.equal(client.disposeCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Enter-run: destruction while the mandatory pre-dispatch seed refill is
// pending must prevent the late continuation from calling a disposed client.
installWx();
{
  const pendingActionPrefill = deferred();
  const client = fakeClient('wx-enter-prefill-cancelled');
  const ports = fakePorts();
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'enter-race wx client was not handed off');
  ports.seeds.prefillResults.push(pendingActionPrefill.promise);
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:enter-race', 'hub.enter.race', {
    kind: 'local',
    action: {
      type: 'entry/request-enter',
      draft: { dungeonId: 'demon-tower-1', protocolId: 'normal' },
    },
  });
  await settleUntil(
    () => ports.seeds.prefillCalls === 2,
    'pre-dispatch secure refill did not start',
  );
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  pendingActionPrefill.resolve();
  await drainMicrotasks();
  assert.equal(client.enterRunPhysicalCalls.length, 0);
  assert.equal(client.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
}

// Enter-run dispatch: once the command itself is pending, destruction must make
// either fulfillment or rejection a no-op for UI and component-owned resources.
for (const settlement of ['fulfilled', 'rejected']) {
  installWx();
  const pendingEnterRun = deferred();
  const client = fakeClient(`wx-enter-dispatch-${settlement}`);
  const ports = fakePorts();
  client.enterRunResults.push(pendingEnterRun.promise);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.client === client,
    `${settlement} enter-dispatch wx client was not handed off`,
  );
  const view = controller.views.at(-1);
  view.callbacks.activate(
    `touch:enter-dispatch-${settlement}`,
    `hub.enter.dispatch.${settlement}`,
    {
      kind: 'local',
      action: {
        type: 'entry/request-enter',
        draft: { dungeonId: 'demon-tower-1', protocolId: 'standard' },
      },
    },
  );
  await settleUntil(
    () => client.enterRunPhysicalCalls.length === 1,
    `${settlement} enterRunPhysical did not start`,
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  if (settlement === 'fulfilled') {
    pendingEnterRun.resolve({ status: 'committed', events: [], stateRevision: 13 });
  } else {
    pendingEnterRun.reject(new Error('synthetic enter-run failure'));
  }
  await drainMicrotasks();
  assert.equal(client.enterRunPhysicalCalls.length, 1);
  assert.equal(client.disposeCalls, 1);
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.seeds.prefillCalls, 2);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Command dispatch: destruction while the client promise is pending must skip
// finishDispatch, UI refresh, and the post-dispatch seed refill.
installWx();
{
  const pendingDispatch = deferred();
  const client = fakeClient('wx-dispatch-cancelled');
  const ports = fakePorts();
  client.dispatchResults.push(pendingDispatch.promise);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'dispatch-race wx client was not handed off');
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:dispatch-race', 'command.race', {
    kind: 'command',
    command: { type: 'test/race-command' },
  });
  await settleUntil(
    () => client.dispatchPhysicalCalls.length === 1,
    'pending command dispatch did not start',
  );
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  pendingDispatch.resolve({ status: 'committed', events: [], stateRevision: 7 });
  await drainMicrotasks();
  assert.equal(ports.seeds.prefillCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
}

// Post-dispatch refill: after a live dispatch has rendered its result, teardown
// must make the pending refill's success continuation a complete no-op.
installWx();
{
  const pendingPostDispatchRefill = deferred();
  const client = fakeClient('wx-post-dispatch-refill-cancelled');
  const ports = fakePorts();
  client.dispatchResults.push(Promise.resolve({
    status: 'committed', events: [],
    stateRevision: 11,
  }));
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'refill-race wx client was not handed off');
  ports.seeds.prefillResults.push(pendingPostDispatchRefill.promise);
  const view = controller.views.at(-1);
  view.callbacks.activate('touch:refill-race', 'command.refill-race', {
    kind: 'command',
    command: { type: 'test/refill-race-command' },
  });
  await settleUntil(
    () => ports.seeds.prefillCalls === 2,
    'post-dispatch secure refill did not start',
  );
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  app.onDestroy();
  const activityAfterDestroy = app.activityMessage;
  const rendersAfterDestroy = view.renderCalls;
  const stateReadsAfterDestroy = client.getStateCalls;
  pendingPostDispatchRefill.resolve();
  await drainMicrotasks();
  assert.equal(client.dispatchPhysicalCalls.length, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(app.activityMessage, activityAfterDestroy);
  assert.equal(view.renderCalls, rendersAfterDestroy);
  assert.equal(client.getStateCalls, stateReadsAfterDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
}

// Teardown remains exhaustive and emits one stable diagnostic even when every
// owned resource has a faulty disposer.
installWx();
{
  const client = fakeClient('wx-faulty-dispose');
  const clientFailure = new Error('synthetic client dispose failure');
  client.dispose = function disposeWithFailure() {
    this.disposeCalls += 1;
    throw clientFailure;
  };
  const ports = fakePorts();
  const lifecycleFailure = new Error('synthetic lifecycle dispose failure');
  ports.lifecycle.dispose = function disposeWithFailure() {
    this.disposed = true;
    this.disposeCalls += 1;
    throw lifecycleFailure;
  };
  const seedsFailure = new Error('synthetic seeds dispose failure');
  ports.seeds.dispose = function disposeWithFailure() {
    this.disposed = true;
    this.disposeCalls += 1;
    this.clear();
    throw seedsFailure;
  };
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'fault-injection wx client was not handed off');
  const view = controller.views.at(-1);
  const activityBeforeDestroy = app.activityMessage;
  const rendersBeforeDestroy = view.renderCalls;
  const viewFailure = new Error('synthetic view dispose failure');
  view.destroy = function destroyWithFailure() {
    this.destroyCalls += 1;
    throw viewFailure;
  };
  const originalConsoleError = console.error;
  const diagnostics = [];
  console.error = (...args) => {
    diagnostics.push(args);
    throw new Error('synthetic console diagnostic failure');
  };
  try {
    assert.doesNotThrow(() => app.onDestroy());
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(console.error, originalConsoleError);
  assert.equal(client.disposeCalls, 1);
  assert.equal(ports.lifecycle.disposeCalls, 1);
  assert.equal(ports.seeds.disposeCalls, 1);
  assert.equal(ports.seeds.clearCalls, 1);
  assert.equal(view.destroyCalls, 1);
  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0][0],
    '[InfiniteFlowApp] resource disposal failure (4): client: synthetic client dispose failure; lifecycle: synthetic lifecycle dispose failure; seeds: synthetic seeds dispose failure; view: synthetic view dispose failure',
  );
  assert.deepEqual(
    diagnostics[0].slice(1),
    [clientFailure, lifecycleFailure, seedsFailure, viewFailure],
  );
  assert.equal(app.activityMessage, activityBeforeDestroy);
  assert.equal(view.renderCalls, rendersBeforeDestroy);
  assert.equal(app.client, undefined);
  assert.equal(app.secureSeeds, undefined);
  assert.equal(app.lifecycle, undefined);
}

// Visual success and key switching: config/manifest/resources all participate,
// ImageAsset handles are exact, and cleanup precedes the owned image.decRef().
for (const waitStage of ['config', 'manifest', 'resources']) {
  delete globalThis.wx;
  const session = assetSession({
    autoConfig: waitStage !== 'config',
    autoManifest: waitStage !== 'manifest',
    autoResources: waitStage !== 'resources',
  });
  const client = fakeClient(`visual-destroy-${waitStage}`);
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const requestList = waitStage === 'config'
    ? session.configRequests
    : waitStage === 'manifest'
      ? session.manifestRequests
      : session.resourcesRequests;
  await settleUntil(() => requestList.length === 1, `${waitStage} wait did not start`);
  const view = controller.views.at(-1);
  app.onDestroy();
  const eventsAfterDestroy = view.visualEvents.length;
  const request = requestList[0];
  if (waitStage === 'config') request.callback(null, request.bundle);
  else if (waitStage === 'manifest') request.complete(null, request.asset);
  else request.callback(null, request.bundle);
  await drainMicrotasks();
  assert.equal(view.visualEvents.length, eventsAfterDestroy);
  if (waitStage === 'config') assert.equal(session.manifestRequests.length, 0);
  if (waitStage === 'manifest') {
    assert.equal(session.resourcesRequests.length, 0);
    assert.equal(request.asset.refCount, 0);
  }
  if (waitStage === 'resources') assert.equal(session.imageRequests.length, 0);
}

// Creator 3.8.8 can omit the error argument for every successful callback.
// Exercise the complete config -> manifest -> resources -> ImageAsset path
// with `undefined`, including the owned ImageAsset release on destroy.
delete globalThis.wx;
{
  const session = assetSession();
  const client = fakeClient('visual-undefined-callback-success');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'undefined-success callbacks did not display the ImageAsset',
  );
  assert.equal(session.configRequests.length, 1);
  assert.equal(session.manifestRequests.length, 1);
  assert.equal(session.resourcesRequests.length, 1);
  assert.equal(session.imageRequests.length, 1);
  assert.equal(view.visualStatus.diagnostic, undefined);
  const image = session.imageRequests[0].image;
  assert.equal(image.refCount, 1);
  assert.equal(image.destroyed, false);
  assert.equal(
    session.imageReferenceCalls.find((call) => call.operation === 'addRef')?.handle,
    image,
    'the app retains the exact ImageAsset handle returned by Bundle.load',
  );
  app.onDestroy();
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef' && call.path === 'scene/main-god-space',
    ).length,
    1,
    'undefined-success ImageAsset releases one exact owned handle',
  );
  assert.equal(image.refCount, 0);
  assert.equal(image.destroyed, true, 'unshared fake ImageAsset is truly destroyed at zero refs');
  assert.equal(
    session.releaseCalls.filter((call) => call.path === 'scene/main-god-space').length,
    0,
    'shared Bundle.release(path, ImageAsset) is never used',
  );
}

// A shared consumer's reference survives this component's exact-handle
// release. A path-based force release would incorrectly destroy this image.
delete globalThis.wx;
{
  const session = assetSession({ sharedImageConsumer: true });
  const client = fakeClient('visual-shared-image-consumer');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'shared ImageAsset did not display',
  );
  const image = session.imageRequests[0].image;
  assert.equal(image.refCount, 2, 'shared consumer and app own separate references');
  app.onDestroy();
  assert.equal(image.refCount, 1);
  assert.equal(image.destroyed, false, 'app disposal preserves the shared consumer');
  assert.equal(session.releaseCalls.length, 0, 'shared bundle cache is not force-released');
  const appRelease = session.imageReferenceCalls.filter(
    (call) => call.operation === 'decRef',
  );
  assert.equal(appRelease.length, 1);
  assert.equal(appRelease[0].handle, image, 'decRef targets the loaded handle identity');
  image.decRef();
  assert.equal(image.refCount, 0);
  assert.equal(image.destroyed, true, 'the fake destroys only after the shared owner releases');
}

delete globalThis.wx;
{
  controller.assetEvents.length = 0;
  const session = assetSession({ autoImages: false });
  const client = fakeClient('visual-switch');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => session.imageRequests.length === 1,
    'hub ImageAsset request did not start',
  );
  assert.equal(session.configRequests.length, 1);
  assert.equal(session.manifestRequests.length, 1);
  assert.equal(session.resourcesRequests.length, 1);
  assert.equal(session.imageRequests[0].path, 'scene/main-god-space');
  session.imageRequests[0].complete(null, session.imageRequests[0].image);
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'hub visual did not display',
  );
  assert.equal(view.visualStatus.revision, MANIFEST_REVISION);

  client.state = {
    phase: 'explore',
    visualAssetKey: 'dungeon:demon_tower_1',
  };
  app.refreshViewModel();
  await settleUntil(
    () => session.imageRequests.length === 2,
    'dungeon ImageAsset request did not start',
  );
  assert.equal(session.imageRequests[1].path, 'dungeon/demon-tower-1-v1');
  const releaseIndex = controller.assetEvents.indexOf(
    'image.decRef:scene/main-god-space',
  );
  assert.deepEqual(
    controller.assetEvents.slice(releaseIndex - 3, releaseIndex + 1),
    [
      'detach',
      'frame.destroy',
      'texture.destroy',
      'image.decRef:scene/main-god-space',
    ],
  );
  session.imageRequests[1].complete(null, session.imageRequests[1].image);
  await settleUntil(
    () => view.visualStatus?.key === 'dungeon:demon_tower_1' && view.visualImage,
    'dungeon visual did not display',
  );
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(
    session.imageRequests.filter((request) => request.path === 'dungeon/demon-tower-1-v1').length,
    1,
    'same-key refresh keeps one lease and one native load',
  );
  app.onDestroy();
  assert.equal(session.manifestRequests[0].asset.refCount, 0);
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef'
        && call.path === 'dungeon/demon-tower-1-v1',
    ).length,
    1,
  );
  assert.equal(session.releaseCalls.length, 0);
}

// A core-projected key missing from the pinned manifest never reaches Bundle.load.
// It stays a non-blocking, explicit unknown-key fallback.
delete globalThis.wx;
{
  const session = assetSession();
  const client = fakeClient('visual-unknown-key');
  client.state = { phase: 'hub', visualAssetKey: 'scene:missing' };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'unknown-key client did not start');
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.diagnostic?.includes('code=unknown-key'),
    'unknown-key fallback was not visible',
  );
  assert.equal(session.imageRequests.length, 0);
  assert.match(view.visualStatus.diagnostic, /key=scene:missing/);
  assert.match(view.visualStatus.diagnostic, /path=unknown/);
  const terminalDiagnostic = view.visualStatus.diagnostic;
  const terminalGeneration = app.visualGeneration;
  app.refreshViewModel();
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(session.imageRequests.length, 0);
  assert.equal(view.visualStatus.diagnostic, terminalDiagnostic);
  assert.equal(app.visualGeneration, terminalGeneration);
  assert.equal(app.visualKeyTerminalFailure?.code, 'unknown-key');
  app.onDestroy();
}

// A -> B -> A while both are in flight reuses the first A request. B may
// resolve first but cannot revive the stale view and is released once.
delete globalThis.wx;
{
  const session = assetSession({ autoImages: false });
  const client = fakeClient('visual-a-b-a');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => session.imageRequests.length === 1, 'A did not start');
  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1' };
  app.refreshViewModel();
  await settleUntil(() => session.imageRequests.length === 2, 'B did not start');
  client.state = { phase: 'hub', visualAssetKey: 'scene:main_god_space' };
  app.refreshViewModel();
  assert.equal(
    session.imageRequests.filter((request) => request.path === 'scene/main-god-space').length,
    1,
    'A -> B -> A reuses the original A in-flight lease',
  );
  session.imageRequests[1].complete(null, session.imageRequests[1].image);
  await drainMicrotasks();
  const view = controller.views.at(-1);
  assert.notEqual(view.visualStatus?.key, 'dungeon:demon_tower_1');
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef'
        && call.path === 'dungeon/demon-tower-1-v1',
    ).length,
    1,
    'stale B is released exactly once',
  );
  session.imageRequests[0].complete(null, session.imageRequests[0].image);
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'reselected A did not display',
  );
  assert.equal(
    view.visualEvents.filter((event) => event === 'display:dungeon:demon_tower_1').length,
    0,
  );
  app.onDestroy();
}

// Destroy during ImageAsset load invalidates identity/generation. The late
// lease is released, never displayed, and shared bundles are not removed.
delete globalThis.wx;
{
  const session = assetSession({ autoImages: false });
  const client = fakeClient('visual-destroy-pending');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => session.imageRequests.length === 1, 'destroy visual did not start');
  const view = controller.views.at(-1);
  app.onDestroy();
  const visualEventsAfterDestroy = view.visualEvents.length;
  session.imageRequests[0].complete(null, session.imageRequests[0].image);
  await drainMicrotasks();
  assert.equal(view.visualEvents.length, visualEventsAfterDestroy);
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef' && call.path === 'scene/main-god-space',
    ).length,
    1,
    'late destroyed ImageAsset is released once',
  );
}

// A real WeChat memory-warning callback invalidates a pending image. It does
// not immediately reload or revive the view when the old callback arrives.
installWx();
{
  const session = assetSession({ autoImages: false });
  const client = fakeClient('visual-memory-warning');
  const ports = fakePorts();
  let clientOptions;
  controller.assetSessions.push(session);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => session.imageRequests.length === 1, 'memory visual did not start');
  assert.equal(typeof clientOptions.onMemoryWarning, 'function');
  clientOptions.onMemoryWarning();
  const view = controller.views.at(-1);
  const visualEventsAfterWarning = view.visualEvents.length;
  session.imageRequests[0].complete(null, session.imageRequests[0].image);
  await drainMicrotasks();
  assert.equal(view.visualEvents.length, visualEventsAfterWarning);
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef' && call.path === 'scene/main-god-space',
    ).length,
    1,
    'memory-warning stale ImageAsset is released once',
  );
  app.onDestroy();
}

// Strict manifest validation fails closed for assets but never blocks the
// domain client; the visible fallback retains the full stable diagnostic.
delete globalThis.wx;
{
  const invalid = validManifest();
  invalid.manifestRevision = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  const session = assetSession({ manifest: invalid });
  const client = fakeClient('visual-manifest-failure');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, 'manifest failure blocked the game client');
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.diagnostic?.includes('code=revision-mismatch'),
    'manifest failure diagnostic was not visible',
  );
  assert.match(view.visualStatus.diagnostic, /expectedRevision=sha256:/);
  assert.match(
    view.visualStatus.diagnostic,
    /loadedRevision=sha256:0000000000000000000000000000000000000000000000000000000000000000/,
  );
  assert.match(view.visualStatus.diagnostic, /bundle=config/);
  assert.match(view.visualStatus.diagnostic, /key=scene:main_god_space/);
  assert.match(view.visualStatus.diagnostic, /path=asset-manifest/);
  assert.match(view.visualStatus.diagnostic, /group=config/);
  assert.match(view.visualStatus.diagnostic, /requestedGeneration=/);
  assert.match(view.visualStatus.diagnostic, /appliedGeneration=/);
  assert.match(view.visualStatus.diagnostic, /assetGeneration=/);
  assert.match(view.visualStatus.diagnostic, /stage=manifest-validate/);
  assert.equal(session.manifestRequests[0].asset.refCount, 0);
  assert.equal(
    retryScheduler.tasks.length,
    0,
    'non-retryable manifest integrity failure schedules no retry',
  );
  app.onDestroy();
}

// Bootstrap retries use deterministic capped backoff. Repeated ordinary
// network Errors continue at the 30s ceiling and recover without a state or
// memory-warning event once the scheduler observes connectivity again.
delete globalThis.wx;
{
  const delayStart = retryScheduler.delays.length;
  const failedSessions = Array.from({ length: 6 }, () => assetSession({
    bundleFailure: new Error('Network request failed while device is offline'),
  }));
  const recoveredSession = assetSession();
  const client = fakeClient('visual-bootstrap-eventual-recovery');
  controller.assetSessions.push(...failedSessions, recoveredSession);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const expectedDelays = [250, 1_000, 3_000, 10_000, 30_000, 30_000];
  for (const expectedDelay of expectedDelays) {
    await settleUntil(
      () => retryScheduler.tasks.length === 1,
      `retry ${expectedDelay}ms was not scheduled`,
    );
    assert.equal(retryScheduler.tasks.length, 1, 'at most one retry timer is live');
    assert.equal(retryScheduler.tasks[0].delayMs, expectedDelay);
    assert.equal(app.visualAssetRetryTicket?.kind, 'bootstrap');
    assert.equal(
      app.visualKeyRetryTicket,
      undefined,
      'bootstrap failure does not also create a per-key retry',
    );
    retryScheduler.runNext();
  }
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'late connectivity recovery did not restore the visual automatically',
  );
  assert.deepEqual(
    retryScheduler.delays.slice(delayStart),
    expectedDelays,
    'retry delay grows deterministically and remains capped at 30s',
  );
  assert.equal(retryScheduler.tasks.length, 0);
  assert.equal(recoveredSession.imageRequests.length, 1);
  for (const failed of failedSessions) {
    assert.equal(failed.manifestRequests[0].asset.refCount, 0);
  }
  app.onDestroy();
  assert.equal(recoveredSession.manifestRequests[0].asset.refCount, 0);
}

// Once config/resources are valid, per-key offline/timeout failures stay on a
// separate retry channel. Six consecutive failures reach the 30s ceiling; the
// seventh request recovers without state churn and replaces (rather than
// transiently erasing) the exact fallback diagnostic.
delete globalThis.wx;
{
  assert.equal(retryScheduler.tasks.length, 0);
  const delayStart = retryScheduler.delays.length;
  const imageFailures = Array.from({ length: 6 }, (_, index) => {
    if (index % 2 === 0) {
      return new Error('Network request failed while device is offline');
    }
    const timeout = new Error('Creator image request timed out');
    timeout.name = 'TimeoutError';
    return timeout;
  });
  const session = assetSession({ imageFailures });
  const client = fakeClient('visual-key-eventual-recovery');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  const expectedDelays = [250, 1_000, 3_000, 10_000, 30_000, 30_000];
  for (const expectedDelay of expectedDelays) {
    await settleUntil(
      () => retryScheduler.tasks.length === 1,
      `per-key retry ${expectedDelay}ms was not scheduled`,
    );
    assert.equal(retryScheduler.tasks.length, 1, 'per-key keeps one retry timer');
    assert.equal(retryScheduler.tasks[0].delayMs, expectedDelay);
    assert.equal(app.visualKeyRetryTicket?.kind, 'per-key');
    assert.equal(
      app.visualAssetRetryTicket,
      undefined,
      'valid bootstrap never overlaps the per-key retry channel',
    );
    assert.match(view.visualStatus.diagnostic, /stage=image-load/);
    assert.match(view.visualStatus.diagnostic, /code=(offline|timeout)/);
    const requestsBeforeTimer = session.imageRequests.length;
    app.refreshViewModel();
    app.refreshViewModel();
    await drainMicrotasks();
    assert.equal(
      session.imageRequests.length,
      requestsBeforeTimer,
      'same-key refresh cannot bypass the pending retry timer',
    );
    assert.equal(retryScheduler.tasks.length, 1);
    const diagnosticBeforeRetry = view.visualStatus.diagnostic;
    retryScheduler.runNext();
    assert.equal(
      view.visualStatus.diagnostic,
      diagnosticBeforeRetry,
      'retry start preserves the preceding precise failure diagnostic',
    );
    await settleUntil(
      () => session.imageRequests.length === requestsBeforeTimer + 1,
      'scheduled per-key retry did not start exactly one request',
    );
  }
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'seventh per-key request did not recover automatically',
  );
  assert.equal(session.imageRequests.length, 7);
  assert.equal(session.maxActiveImageRequests, 1, 'per-key requests never overlap');
  assert.equal(session.activeImageRequests, 0);
  assert.equal(session.configRequests.length, 1);
  assert.equal(session.resourcesRequests.length, 1);
  assert.equal(retryScheduler.tasks.length, 0, 'success consumes the retry timer');
  assert.equal(app.visualKeyRetryTicket, undefined);
  assert.equal(view.visualStatus.diagnostic, undefined, 'success clears the key fallback');
  assert.deepEqual(retryScheduler.delays.slice(delayStart), expectedDelays);
  const recoveredImage = session.imageRequests.at(-1).image;
  assert.equal(recoveredImage.refCount, 1);
  assert.equal(
    session.imageReferenceCalls.filter((call) => call.operation === 'addRef').length,
    1,
    'only the recovered ImageAsset is retained',
  );
  app.onDestroy();
  assert.equal(recoveredImage.refCount, 0);
  assert.equal(recoveredImage.destroyed, true);
  assert.equal(
    session.imageReferenceCalls.filter((call) => call.operation === 'decRef').length,
    1,
    'the recovered key lease is released exactly once',
  );
  assert.equal(session.manifestRequests[0].asset.refCount, 0);
}

// Switching desired keys cancels a pending A retry. Even if the cancelled
// callback is invoked manually, it cannot issue another A request or replace B.
delete globalThis.wx;
{
  const session = assetSession({
    imageFailures: [new Error('Network offline while loading visual')],
  });
  const client = fakeClient('visual-key-switch-cancels-retry');
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => retryScheduler.tasks.length === 1, 'A retry was not scheduled');
  const staleRetry = retryScheduler.tasks[0];
  assert.equal(app.visualKeyRetryTicket?.kind, 'per-key');
  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1' };
  app.refreshViewModel();
  assert.equal(staleRetry.cancelled, true);
  assert.equal(retryScheduler.tasks.length, 0);
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.key === 'dungeon:demon_tower_1' && view.visualImage,
    'B did not display after cancelling A retry',
  );
  const requestCount = session.imageRequests.length;
  staleRetry.callback();
  await drainMicrotasks();
  assert.equal(session.imageRequests.length, requestCount);
  assert.equal(
    session.imageRequests.filter((request) => request.path === 'scene/main-god-space').length,
    1,
  );
  assert.equal(view.visualStatus.key, 'dungeon:demon_tower_1');
  assert.equal(session.maxActiveImageRequests, 1);
  const displayedImage = session.imageRequests.at(-1).image;
  app.onDestroy();
  assert.equal(displayedImage.refCount, 0);
  assert.equal(
    session.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef'
        && call.path === 'dungeon/demon-tower-1-v1',
    ).length,
    1,
  );
}

// Memory pressure advances the asset generation and cancels the per-key timer.
// A scheduler that races cancellation still cannot revive the invalidated port.
installWx();
{
  const session = assetSession({
    imageFailure: new Error('Network offline while loading visual'),
  });
  const client = fakeClient('visual-key-memory-warning');
  const ports = fakePorts();
  let clientOptions;
  controller.assetSessions.push(session);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => retryScheduler.tasks.length === 1, 'memory retry was not scheduled');
  const staleRetry = retryScheduler.tasks[0];
  const imageRequestsBeforeWarning = session.imageRequests.length;
  clientOptions.onMemoryWarning();
  assert.equal(staleRetry.cancelled, true);
  assert.equal(retryScheduler.tasks.length, 0);
  assert.equal(app.visualKeyRetryTicket, undefined);
  staleRetry.callback();
  await drainMicrotasks();
  assert.equal(session.imageRequests.length, imageRequestsBeforeWarning);
  assert.equal(session.manifestRequests[0].asset.refCount, 0);
  app.onDestroy();
}

// A classified local/decode failure is terminal for the same key/port/asset
// generation: repeated refreshes preserve its diagnostic without new loads.
// Switching away and back, then advancing the asset generation via a real
// memory-warning callback, each permits a fresh request.
installWx();
{
  const decodeFailure = new Error('Malformed image decode payload');
  const session = assetSession({
    imageFailures: [decodeFailure, null, null, decodeFailure],
  });
  const recoveredSession = assetSession();
  const client = fakeClient('visual-key-non-retry');
  const ports = fakePorts();
  let clientOptions;
  controller.assetSessions.push(session, recoveredSession);
  controller.portsFactories.push(() => ports);
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(
    () => view.visualStatus?.diagnostic?.includes('code=decode'),
    'decode fallback was not visible',
  );
  assert.equal(retryScheduler.tasks.length, 0);
  assert.equal(app.visualAssetRetryTicket, undefined);
  assert.equal(app.visualKeyRetryTicket, undefined);
  assert.equal(session.imageRequests.length, 1);
  assert.equal(session.imageReferenceCalls.length, 0);
  assert.equal(app.visualKeyTerminalFailure?.code, 'decode');
  const terminalDiagnostic = view.visualStatus.diagnostic;
  const terminalGeneration = app.visualGeneration;
  app.refreshViewModel();
  app.refreshViewModel();
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(session.imageRequests.length, 1, 'same-key refresh is terminally fenced');
  assert.equal(view.visualStatus.diagnostic, terminalDiagnostic);
  assert.equal(app.visualGeneration, terminalGeneration);

  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1' };
  app.refreshViewModel();
  await settleUntil(
    () => view.visualStatus?.key === 'dungeon:demon_tower_1' && view.visualImage,
    'key switch did not clear the terminal failure fence',
  );
  assert.equal(session.imageRequests.length, 2);
  assert.equal(app.visualKeyTerminalFailure, undefined);

  client.state = { phase: 'hub', visualAssetKey: 'scene:main_god_space' };
  app.refreshViewModel();
  await settleUntil(
    () => view.visualStatus?.key === 'scene:main_god_space' && view.visualImage,
    'switching back did not retry the previously terminal key',
  );
  assert.equal(session.imageRequests.length, 3);
  assert.equal(app.visualKeyTerminalFailure, undefined);

  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1' };
  app.refreshViewModel();
  await settleUntil(
    () => view.visualStatus?.diagnostic?.includes('code=decode'),
    'second decode fallback was not visible',
  );
  assert.equal(session.imageRequests.length, 4);
  assert.equal(app.visualKeyTerminalFailure?.key, 'dungeon:demon_tower_1');
  app.refreshViewModel();
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(session.imageRequests.length, 4);

  const failedAssetGeneration = app.assetGeneration;
  clientOptions.onMemoryWarning();
  assert.equal(app.visualKeyTerminalFailure, undefined);
  assert.ok(app.assetGeneration > failedAssetGeneration);
  assert.equal(session.manifestRequests[0].asset.refCount, 0);
  app.refreshViewModel();
  await settleUntil(
    () => view.visualStatus?.key === 'dungeon:demon_tower_1' && view.visualImage,
    'new asset generation did not retry the terminal key',
  );
  assert.equal(recoveredSession.imageRequests.length, 1);
  assert.equal(app.visualKeyTerminalFailure, undefined);
  assert.equal(session.maxActiveImageRequests, 1);
  assert.equal(
    session.imageReferenceCalls.filter((call) => call.operation === 'addRef').length,
    2,
  );
  assert.equal(
    session.imageReferenceCalls.filter((call) => call.operation === 'decRef').length,
    2,
  );
  const recoveredImage = recoveredSession.imageRequests[0].image;
  assert.equal(recoveredImage.refCount, 1);
  app.onDestroy();
  assert.equal(recoveredImage.refCount, 0);
  assert.equal(
    recoveredSession.imageReferenceCalls.filter(
      (call) => call.operation === 'decRef',
    ).length,
    1,
  );
  assert.equal(recoveredSession.manifestRequests[0].asset.refCount, 0);
}

// Remote resources bundle failure and per-key image failure both preserve a
// playable client and use the solid fallback with classified codes. Their
// timers are distinct, and destroy invalidates either ticket.
for (const failureKind of ['bundle', 'image']) {
  delete globalThis.wx;
  const timeoutError = new Error('Creator image request did not complete');
  timeoutError.name = 'TimeoutError';
  const session = assetSession(failureKind === 'bundle'
    ? { bundleFailure: new Error('Network request failed: device offline https://private.invalid/token') }
    : { imageFailure: timeoutError });
  const client = fakeClient(`visual-${failureKind}-failure`);
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(() => app.client === client, `${failureKind} failure blocked client`);
  const view = controller.views.at(-1);
  const expectedCode = failureKind === 'bundle' ? 'offline' : 'timeout';
  await settleUntil(
    () => view.visualStatus?.diagnostic?.includes(`code=${expectedCode}`),
    `${failureKind} failure fallback was not visible`,
  );
  assert.match(view.visualStatus.diagnostic, /bundle=resources/);
  assert.match(view.visualStatus.diagnostic, /key=scene:main_god_space/);
  assert.match(view.visualStatus.diagnostic, /stage=(resources-bundle|image-load)/);
  assert.doesNotMatch(
    view.visualStatus.diagnostic,
    /https?:|private\.invalid|token/,
    'fallback diagnostics do not expose the original Creator URL/message',
  );
  const staleRetry = retryScheduler.tasks[0];
  if (failureKind === 'bundle') {
    assert.ok(staleRetry, 'retryable ordinary network Error schedules retry');
    assert.equal(staleRetry.delayMs, 250, 'successful bootstrap resets backoff');
    assert.equal(app.visualAssetRetryTicket?.kind, 'bootstrap');
    assert.equal(app.visualKeyRetryTicket, undefined);
  } else {
    assert.ok(staleRetry, 'per-key timeout schedules its own retry');
    assert.equal(staleRetry.delayMs, 250);
    assert.equal(app.visualAssetRetryTicket, undefined);
    assert.equal(app.visualKeyRetryTicket?.kind, 'per-key');
  }
  const bundleLoadsBeforeDestroy = controller.assetBundleLoadNames.length;
  const imageLoadsBeforeDestroy = session.imageRequests.length;
  app.onDestroy();
  assert.equal(retryScheduler.tasks.length, 0, 'destroy cancels the retry timer');
  staleRetry.callback();
  await drainMicrotasks();
  assert.equal(
    controller.assetBundleLoadNames.length,
    bundleLoadsBeforeDestroy,
    'a cancelled stale timer cannot restart asset bootstrap after destroy',
  );
  assert.equal(
    session.imageRequests.length,
    imageLoadsBeforeDestroy,
    'a cancelled per-key timer cannot restart image loading after destroy',
  );
}

delete globalThis.wx;
// Enemy portrait, HUD portrait, world monster, player and background keep independent native leases.
{
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient('scene-four-images');
  const sceneEventOffset = controller.sceneAssetEvents.length;
  client.state = {
    phase: 'combat',
    visualAssetKey: 'monster:fog_lesser_demon',
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(
    () => session.imageRequests.length === 2 && session.sceneImageRequests.length === 5,
    'scene did not request independent enemy/HUD portraits, world monster, background, player and four-gate art',
  );
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', 'scene remains gated until all its independent leases settle');
  const allRequests = () => [...session.imageRequests, ...session.sceneImageRequests];
  const finish = (path) => {
    const request = allRequests().find((entry) => entry.path === path);
    assert.ok(request, `missing scene image request ${path}`);
    request.complete(undefined, request.image);
    return request;
  };
  const debris = finish('dungeon-world/debris-v1');
  const transitionGate = finish('dungeon-world/ruined-stone-gate-v1');
  const background = finish('dungeon-world/demon_tower_1-v1');
  await drainMicrotasks();
  assert.ok(view.sceneVisuals.get('scene:dungeon_world_demon_tower_1').image);
  assert.equal(view.sceneVisuals.get('monster:fog_lesser_demon_world').image, undefined);
  const player = finish('character/reincarnator-walk-v2');
  const playerPortrait = finish('character/reincarnator-v2');
  await drainMicrotasks();
  const portrait = finish('monster/fog-lesser-demon-v1');
  await drainMicrotasks();
  assert.equal(view.visualImage, portrait.image, 'the original portrait stays the legacy primary image');
  assert.equal(view.sceneVisuals.get('monster:fog_lesser_demon_world').image, undefined,
    'a loaded portrait cannot satisfy the separate world sprite request');
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', 'ready background, player and portraits cannot bypass a pending world monster');
  const monster = finish('monster-world/fog-lesser-demon-world-v1');
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.size, 6);
  assert.ok([...view.sceneVisuals.values()].every(({ image }) => image));
  assert.equal(view.lastRender.chrome.sceneAssets, 'ready', 'last scene image opens the readiness gate');
  assert.equal(monster.image.refCount, 1, 'world sprite owns one native lease');
  assert.equal(portrait.image.refCount, 1, 'legacy portrait owns a separate native lease');
  assert.equal(playerPortrait.image.refCount, 1, 'the HUD portrait owns an independent native image lease');
  assert.notEqual(monster.image, portrait.image, 'portrait and world art never alias their native image');
  const originalBackground = view.sceneVisuals.get('scene:dungeon_world_demon_tower_1');
  const originalPlayer = view.sceneVisuals.get('character:reincarnator_walk');
  const originalPlayerPortrait = view.sceneVisuals.get('character:reincarnator');
  assert.equal(originalPlayerPortrait.image, playerPortrait.image, 'combat exposes the loaded HUD portrait to its scene');
  const originalMonster = view.sceneVisuals.get('monster:fog_lesser_demon_world');

  client.state = {
    phase: 'explore',
    visualAssetKey: 'dungeon:demon_tower_1',
    detail: { kind: 'explore', map: { dungeonId: 'demon_tower_1' }, currentNode: { nodeId: 'upper_fog_patrol', nodeType: 'monster', monsterId: 'fog_lesser_demon' } },
  };
  app.refreshViewModel();
  await settleUntil(() => allRequests().length === 16, 'exploration requests its distinct primary illustration and stone gate');
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', 'entering another phase waits for its additional scene props');
  assert.equal(view.sceneVisuals.size, 14, 'exploration preserves projected monster identity and adds the shared transition gate');
  for (const prop of DUNGEON_PROP_FIXTURES.filter(({ key }) => key !== 'scene:dungeon_prop_debris')) finish(prop.resourcePath);
  await drainMicrotasks();
  assert.equal(view.lastRender.chrome.sceneAssets, 'ready', 'optional legacy illustration cannot block a complete walking scene');
  assert.equal(view.sceneVisuals.get('scene:dungeon_transition_gate').image, transitionGate.image,
    'exploration displays the gate through the existing independent image lease');
  assert.equal(transitionGate.image.refCount, 1, 'all visible entrances share one acquired gate image');
  assert.equal(view.sceneVisuals.get('monster:fog_lesser_demon_world'), originalMonster,
    'combat and exploration keep the same world monster lease when identity is stable');
  assert.equal(view.sceneVisuals.get('scene:dungeon_world_demon_tower_1'), originalBackground);
  assert.equal(originalBackground.image, background.image, 'exploration keeps the same native background image');
  assert.equal(controller.sceneAssetEvents.slice(sceneEventOffset).filter((event) => event === 'display:scene:dungeon_world_demon_tower_1').length, 1,
    'stable backdrop has one display; phase change does not rebuild its image/frame slot');
  assert.equal(view.sceneVisuals.get('character:reincarnator_walk'), originalPlayer);
  assert.equal(view.sceneVisuals.get('character:reincarnator'), originalPlayerPortrait, 'combat and exploration share the HUD portrait lease');
  assert.equal(allRequests().filter(({ path }) => path === 'dungeon-world/demon_tower_1-v1').length, 1, 'stable world background keeps its original lease');
  assert.equal(allRequests().filter(({ path }) => path === 'character/reincarnator-walk-v2').length, 1, 'stable player keeps its original lease');
  const legacyIllustration = finish('dungeon/demon-tower-1-v1');
  await drainMicrotasks();
  assert.equal(view.visualImage, legacyIllustration.image, 'legacy primary and world backdrop remain distinct image consumers');
  assert.equal(view.sceneVisuals.has('dungeon:demon_tower_1'), false, 'the old chapter illustration is not a scene background');
  assert.equal(portrait.image.refCount, 0, 'leaving combat releases only its legacy portrait');
  assert.equal(monster.image.refCount, 1, 'the explicit exploration monster remains live');
  client.state.detail.currentNode = { nodeId: 'fog_lesser_demon', nodeType: 'monster' };
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(getInfiniteFlowSceneVisualKeys(app.viewModel).opponent, undefined,
    'exploration never invents an opponent from a map node id');
  assert.equal(view.sceneVisuals.size, 13);
  assert.equal(transitionGate.image.refCount, 1, 'clearing a monster keeps adjacent entrance art live');
  assert.equal(monster.image.refCount, 0);
  assert.equal(background.image.refCount, 1);
  assert.equal(player.image.refCount, 1);

  client.state = {
    phase: 'hub',
    visualAssetKey: 'scene:main_god_space',
    detail: { kind: 'hub', activePanel: 'equipment' },
  };
  app.refreshViewModel();
  await settleUntil(() => allRequests().length === 31, 'hub portrait, background, portal, four props and seven NPC composition did not load');
  const hubIllustration = finish('scene/main-god-space');
  finish('npc/equipment-quartermaster-v1');
  for (const npc of NPC_WORLD_FIXTURES) finish(npc.resourcePath);
  for (const asset of COURTYARD_WORLD_FIXTURES) finish(asset.resourcePath);
  await drainMicrotasks();
  assert.deepEqual([...view.sceneVisuals.keys()].sort(), [
    'character:reincarnator', 'character:reincarnator_walk', 'npc:equipment_quartermaster', ...COURTYARD_WORLD_FIXTURES.map(({ key }) => key),
    ...NPC_WORLD_FIXTURES.map(({ key }) => key),
  ].sort());
  assert.equal(view.sceneVisuals.get('character:reincarnator_walk'), originalPlayer);
  assert.equal(view.sceneVisuals.get('character:reincarnator'), originalPlayerPortrait, 'hub retains the same HUD portrait lease on return');
  assert.equal(allRequests().filter(({ path }) => path === 'character/reincarnator-v2').length, 1, 'phase changes never reload the shared HUD portrait');
  assert.equal(background.image.refCount, 0);
  assert.equal(debris.image.refCount, 0, 'returning to the courtyard releases the shared dungeon debris lease');
  for (const prop of DUNGEON_PROP_FIXTURES) {
    assert.equal(view.sceneVisuals.has(prop.key), false, 'hub cannot retain dungeon prop slots');
    assert.equal(allRequests().find(({ path }) => path === prop.resourcePath).image.refCount, 0, `${prop.key}: dungeon prop image released on hub return`);
  }
  assert.equal(legacyIllustration.image.refCount, 0);
  assert.equal(transitionGate.image.refCount, 0, 'returning to the courtyard releases the dungeon-only gate image');
  app.onDestroy();
  assert.equal(view.sceneVisuals.size, 0);
  for (const request of allRequests()) {
    assert.equal(request.image.refCount, 0, `scene releases ${request.path}`);
    assert.equal([...session.imageReferenceCalls, ...session.sceneImageReferenceCalls].filter((call) => call.operation === 'decRef' && call.handle === request.image).length, 1,
      `${request.path} native image lease is released exactly once`);
    const key = session.manifest.assets.find((entry) => entry.resourcePath === request.path).key;
    const detachIndex = controller.sceneAssetEvents.lastIndexOf(`${request === legacyIllustration || request === portrait || request === hubIllustration ? 'primary.frame.destroy' : 'frame.destroy'}:${key}`);
    const releaseIndex = controller.sceneAssetEvents.lastIndexOf(`image.decRef:${request.path}`);
    assert.ok(detachIndex >= 0 && detachIndex < releaseIndex, `${key} frame is gone before its image lease`);
  }
}

// Natural settlement promotes an already acquired primary into its scene
// background even when the primary key is unchanged from exploration.
{
  const entered = reduceGameCommand(createInitialState(), {
    type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 },
  });
  assert.equal(entered.status, 'committed');
  const session = assetSession();
  const client = fakeClient('explore-result-cached-primary');
  client.state = entered.state;
  controller.actualProjection = buildActualGameViewModel;
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  try {
    app.start();
    const view = controller.views.at(-1);
    await settleUntil(() => view.visualImage && view.lastRender.chrome.sceneAssets === 'ready',
      'natural exploration images did not become ready');
    const key = app.viewModel.visualAssetKey;
    assert.equal(key, 'dungeon:demon_tower_1');
    const primary = app.visualRecords.get(key);
    const primaryImage = primary.image;
    assert.equal(primary.acquired, true);
    assert.notEqual(primary.sceneDisplayed, true, 'exploration uses the cached chapter image only as its primary');
    const oldSlots = new Map(view.sceneVisuals);
    const requests = () => [...session.imageRequests, ...session.sceneImageRequests];
    const requestCount = requests().length;
    const references = () => [...session.imageReferenceCalls, ...session.sceneImageReferenceCalls];
    const result = reduceGameCommand(entered.state, { type: 'run/retreat' });
    assert.equal(result.status, 'committed');
    client.state = result.state;
    app.refreshViewModel();
    await drainMicrotasks();
    assert.equal(app.viewModel.phase, 'result', 'real retreat projection reaches settlement');
    assert.equal(app.viewModel.visualAssetKey, key, 'natural settlement retains the same primary key');
    assert.equal(app.visualRecords.get(key), primary, 'settlement keeps the acquired primary record');
    assert.equal(view.visualImage, primaryImage, 'primary native image remains live through settlement');
    assert.equal(view.sceneVisuals.get(key)?.image, primaryImage, 'cached primary also attaches as the result background');
    assert.equal(view.lastRender.chrome.sceneAssets, 'ready', 'cached background promotion opens the result scene gate');
    assert.equal(requests().length, requestCount, 'promoting a cached primary never reloads any image');
    assert.equal(primaryImage.refCount, 1, 'primary and result scene share one native image lease');
    assert.equal(references().filter(call => call.operation === 'addRef' && call.handle === primaryImage).length, 1);
    assert.equal(references().filter(call => call.operation === 'decRef' && call.handle === primaryImage).length, 0);
    const desiredScene = new Set(Object.values(getInfiniteFlowSceneVisualKeys(app.viewModel)));
    assert.deepEqual([...view.sceneVisuals.keys()].sort(), [...desiredScene].sort(), 'result retires every unused world slot');
    for (const [oldKey, slot] of oldSlots) {
      if (desiredScene.has(oldKey)) {
        assert.equal(view.sceneVisuals.get(oldKey), slot, 'shared walking player keeps its existing slot');
        continue;
      }
      const detach = controller.sceneAssetEvents.lastIndexOf(`frame.destroy:${oldKey}`);
      assert.ok(detach >= 0 && !app.visualRecords.has(oldKey), `${oldKey}: settlement retires its scene frame and record`);
      const figure = app.sheetFigureLeases.get(oldKey);
      if (figure) {
        assert.equal(figure.image, slot.image, 'the shared character figure keeps its existing cached image');
        assert.equal(slot.image.refCount, 1, 'retiring a scene cannot release a live sheet figure image');
        continue;
      }
      assert.equal(slot.image.refCount, 0, `${oldKey}: settlement releases the old world image`);
      assert.equal(references().filter(call => call.operation === 'decRef' && call.handle === slot.image).length, 1);
      const path = session.manifest.assets.find(asset => asset.key === oldKey).resourcePath;
      const release = controller.sceneAssetEvents.lastIndexOf(`image.decRef:${path}`);
      assert.ok(detach < release, `${oldKey}: frame detaches before the image lease`);
    }
    assert.equal(client.enterRunPhysicalCalls.length + client.dispatchPhysicalCalls.length, 0,
      'resource promotion and cleanup never dispatch a gameplay action');
    app.onDestroy();
    assert.equal(primaryImage.refCount, 0, 'destroy releases the promoted primary lease');
    assert.ok(requests().every(request => request.image.refCount === 0), 'destroy releases the remaining shared scene leases');
    assert.equal(references().filter(call => call.operation === 'decRef' && call.handle === primaryImage).length, 1,
      'primary and scene consumers release their shared image exactly once');
  } finally {
    delete controller.actualProjection;
  }
}

// The selected courtyard portal has one hub-only lease, distinct from dungeon gates.
{
  const session = assetSession();
  const client = fakeClient('hub-portal-lease');
  client.state = {
    phase: 'hub', visualAssetKey: 'scene:main_god_space',
    detail: { kind: 'hub', activePanel: 'entry' },
  };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key)?.image, 'hub portal image did not load');
  const portal = view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key);
  const player = view.sceneVisuals.get('character:reincarnator_walk');
  assert.equal(portal.image.refCount, 1, 'hub owns one portal image reference');
  assert.equal(session.sceneImageRequests.filter(({ path }) => path === HUB_PORTAL_FIXTURE.resourcePath).length, 1);
  assert.equal(view.sceneVisuals.has('scene:dungeon_transition_gate'), false, 'the courtyard never requests dungeon stone gates');
  app.refreshViewModel();
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key), portal, 'same-hub refresh reuses the portal frame and image lease');
  client.state = {
    phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1',
    detail: { kind: 'explore', map: { dungeonId: 'demon_tower_1' }, currentNode: { nodeId: 'entrance', nodeType: 'entrance' } },
  };
  app.refreshViewModel();
  await settleUntil(() => view.sceneVisuals.get('scene:dungeon_transition_gate')?.image, 'dungeon gate image did not load after leaving hub');
  assert.equal(view.sceneVisuals.has(HUB_PORTAL_FIXTURE.key), false, 'entering a dungeon removes the hub-only portal slot');
  assert.equal(portal.image.refCount, 0, 'entering a dungeon releases its courtyard portal image');
  assert.equal(session.sceneImageReferenceCalls.filter(call => call.operation === 'decRef' && call.handle === portal.image).length, 1);
  const detach = controller.sceneAssetEvents.lastIndexOf(`frame.destroy:${HUB_PORTAL_FIXTURE.key}`);
  const release = controller.sceneAssetEvents.lastIndexOf(`image.decRef:${HUB_PORTAL_FIXTURE.resourcePath}`);
  assert.ok(detach >= 0 && detach < release, 'hub portal frame detaches before its ImageAsset lease is released');
  assert.equal(view.sceneVisuals.get('character:reincarnator_walk'), player, 'portal phase change preserves the shared walking player lease');
  assert.equal(getInfiniteFlowSceneVisualKeys(app.viewModel).hubPortal, undefined);
  app.onDestroy();
  assert.equal(session.sceneImageReferenceCalls.filter(call => call.operation === 'decRef' && call.handle === portal.image).length, 1,
    'later destruction cannot release the old courtyard portal twice');
}

// Acquired HUD icons participate in the scene's all-assets gate and native leases.
{
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient('hud-relic-last-asset');
  const relicIds = [...RUN_RELIC_IDS_BY_FRAME.assault];
  const run = { runId: 'hud-relic-existing-run' };
  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1', run,
    detail: { kind: 'explore', map: { dungeonId: 'demon_tower_1' }, currentNode: { nodeId: 'entrance', nodeType: 'entrance' } },
    loadout: { equipment: [], ownedEquipment: [], items: [], runRelics: relicIds.map(relicId => ({ relicId, name: RUN_RELIC_DEFINITIONS[relicId].name })) } };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  const requests = () => [...session.imageRequests, ...session.sceneImageRequests];
  const expectedPaths = () => Object.values(getInfiniteFlowSceneVisualKeys(app.viewModel)).map(key => validManifest().assets.find(asset => asset.key === key).resourcePath);
  await settleUntil(() => app.viewModel && expectedPaths().every(path => requests().some(request => request.path === path)), 'acquired relic scene requests did not start');
  const icons = session.sceneImageRequests.filter(({ path }) => path.startsWith('run-relic/'));
  assert.deepEqual(icons.map(({ path }) => path).sort(), relicIds.map(id => `run-relic/${id}-v1`).sort(), 'the App requests only acquired HUD icon art');
  const completed = new Set();
  const finish = request => { request.complete(undefined, request.image); completed.add(request); };
  for (const request of requests().filter(request => request !== icons.at(-1))) finish(request);
  await drainMicrotasks();
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', `one pending acquired icon keeps the entire walking scene gated: ${view.lastRender.chrome.activityMessage}`);
  finish(icons.at(-1));
  await drainMicrotasks();
  assert.equal(view.lastRender.chrome.sceneAssets, 'ready', 'the final acquired icon opens the complete scene');
  const slots = relicIds.map(id => view.sceneVisuals.get(`item:run_relic_${id}`));
  assert.ok(slots.every(slot => slot.image.refCount === 1), 'each HUD icon owns one native image lease');
  app.refreshViewModel();
  await drainMicrotasks();
  assert.deepEqual(relicIds.map(id => view.sceneVisuals.get(`item:run_relic_${id}`)), slots, 'unchanged acquired icons retain their existing scene slots');
  assert.equal(session.sceneImageRequests.filter(({ path }) => path.startsWith('run-relic/')).length, relicIds.length, 'refresh cannot reload stable acquired icons');
  client.state = { phase: 'hub', visualAssetKey: 'scene:main_god_space', run,
    detail: { kind: 'hub', activePanel: 'entry' }, loadout: client.state.loadout };
  app.refreshViewModel();
  await settleUntil(() => expectedPaths().every(path => requests().some(request => request.path === path)), 'hub scene requests did not start');
  for (const id of relicIds) {
    const key = `item:run_relic_${id}`;
    const request = icons.find(({ path }) => path === `run-relic/${id}-v1`);
    assert.equal(view.sceneVisuals.has(key), false, 'returning to the hub retires the run-only icon slot');
    assert.equal(request.image.refCount, 0);
    assert.equal(session.sceneImageReferenceCalls.filter(call => call.operation === 'decRef' && call.handle === request.image).length, 1);
    const detach = controller.sceneAssetEvents.lastIndexOf(`frame.destroy:${key}`);
    const release = controller.sceneAssetEvents.lastIndexOf(`image.decRef:${request.path}`);
    assert.ok(detach >= 0 && detach < release, 'HUD icon frame detaches before its native image lease is released');
  }
  assert.equal(client.state.run, run, 'art readiness and phase cleanup preserve the existing run identity');
  assert.equal(client.enterRunPhysicalCalls.length + client.dispatchPhysicalCalls.length, 0);
  app.onDestroy();
  for (const request of requests().filter(request => !completed.has(request))) finish(request);
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.size, 0, 'late hub art cannot revive a destroyed view');
  assert.ok(requests().every(request => request.image.refCount === 0));
  assert.ok(icons.every(request => session.sceneImageReferenceCalls.filter(call => call.operation === 'decRef' && call.handle === request.image).length === 1), 'destroy cannot release retired HUD icon leases twice');
}

// Late approved prop images cannot revive a retired dungeon or destroyed view.
for (const boundary of ['hub', 'destroy']) {
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient(`dungeon-props-late-${boundary}`);
  client.state = { phase: 'explore', visualAssetKey: 'dungeon:demon_tower_1',
    detail: { kind: 'explore', map: { dungeonId: 'demon_tower_1' }, currentNode: { nodeId: 'entrance', nodeType: 'entrance' } } };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  const props = () => session.sceneImageRequests.filter(({ path }) => DUNGEON_PROP_FIXTURES.some(asset => asset.resourcePath === path));
  await settleUntil(() => props().length === 9, 'every approved dungeon prop request started');
  if (boundary === 'hub') {
    client.state = { phase: 'hub', visualAssetKey: 'scene:main_god_space', detail: { kind: 'hub', activePanel: 'entry' } };
    app.refreshViewModel();
    await drainMicrotasks();
  } else app.onDestroy();
  for (const request of props()) request.complete(undefined, request.image);
  await drainMicrotasks();
  for (const prop of DUNGEON_PROP_FIXTURES) {
    assert.equal(view.sceneVisuals.has(prop.key), false, `${boundary}: late ${prop.key} cannot recreate a slot`);
    const request = props().find(request => request.path === prop.resourcePath);
    assert.equal(request.image.refCount, 0, `${boundary}: stale image reference is released`);
    assert.equal(session.sceneImageReferenceCalls.filter(call => call.operation === 'decRef' && call.handle === request.image).length, 1,
      `${boundary}: late prop lease is released exactly once`);
  }
  app.onDestroy();
  for (const request of [...session.imageRequests, ...session.sceneImageRequests].filter(request => !props().includes(request))) request.complete(undefined, request.image);
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.size, 0);
  assert.ok([...session.imageRequests, ...session.sceneImageRequests].every(request => request.image.refCount === 0));
}

// Actual ready prop Sprites detach before their shared frame/texture destruction.
{
  const entered = reduceGameCommand(createInitialState(), { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 } });
  assert.equal(entered.status, 'committed');
  const reward = DUNGEONS.demon_tower_1.nodes.find(node => node.type === 'reward');
  const model = buildActualGameViewModel({ ...entered.state, run: { ...entered.state.run, currentNodeId: reward.id } }, {});
  const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const view = new SceneInfiniteFlowView(canvas, { activate() { assert.fail('prop asset arrival must never dispatch a command'); } });
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const root = () => canvas.children.at(-1);
  const keys = ['scene:dungeon_prop_chest', 'scene:dungeon_transition_gate'];
  for (const key of keys) view.setSceneVisualAsset({ width: key.endsWith('gate') ? 1024 : 1254, height: key.endsWith('gate') ? 1536 : 1254 }, { key, revision: 'approved-prop-fixture' });
  supplySceneVisualFixtures(view, model);
  view.render(model, chrome, EXPLORE_INSETS_320);
  const originalPosition = view.walkScene.getPosition();
  const gateSlot = view.sceneVisuals.get(keys[1]);
  const chestSlot = view.sceneVisuals.get(keys[0]);
  const spriteOf = node => [...node.components.values()].find(component => 'spriteFrame' in component);
  const chestSprite = spriteOf(findNode(root(), 'WalkDungeonPropSprite:chest'));
  const gateSprites = collectNodes(root(), ({ name }) => name === 'WalkTransitionGateSprite').map(spriteOf);
  assert.equal(collectNodes(root(), ({ name }) => name === 'WalkDungeonPropSprite:debris').length, 0,
    'the fixed room does not reintroduce removed interior debris');
  assert.equal(gateSprites.length, 4, 'all four room directions share the approved gate frame');
  assert.ok(gateSprites.every(sprite => sprite.spriteFrame === gateSlot.frame && view.visualSprites.has(sprite)));
  assert.equal(chestSprite.spriteFrame, chestSlot.frame);
  view.setSceneVisualAssetFallback({ key: keys[0], revision: 'approved-prop-fixture', diagnostic: 'network offline' });
  assert.equal(chestSprite.spriteFrame, null, 'prop fallback detaches its live Sprite first');
  assert.equal(chestSlot.frame.destroyCalls, 1);
  assert.equal(chestSlot.texture.destroyCalls, 1);
  assert.equal(gateSlot.frame.destroyCalls, 0, 'shared gate art remains live when one object fails');
  view.render(model, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assert.equal(findNode(root(), 'WalkDungeonPropSprite:chest'), undefined);
  assertSceneAssetGate(view, root(), 'error');
  assert.deepEqual(view.walkPosition, originalPosition, 'prop failure preserves feet for recovery');
  assert.ok(gateSprites.every(sprite => sprite.spriteFrame === null), 'error gate detaches all live sprites without releasing other owned frames');
  view.destroy();
  assert.equal(gateSlot.frame.destroyCalls, 1, 'shared gate frame destroys exactly once');
  assert.equal(gateSlot.texture.destroyCalls, 1, 'shared gate texture destroys exactly once');
  assert.equal(chestSlot.frame.destroyCalls, 1, 'later teardown cannot destroy a failed prop twice');
}

// One asset recovering must preserve another asset's timer and the ready background.
{
  const session = assetSession({
    imageFailuresByPath: {
      'monster/fog-lesser-demon-v1': [new Error('network offline'), undefined],
      'monster-world/fog-lesser-demon-world-v1': [new Error('network offline'), undefined],
      'character/reincarnator-walk-v2': [new Error('network offline'), undefined],
    },
  });
  const client = fakeClient('scene-independent-retries');
  client.state = {
    phase: 'combat',
    visualAssetKey: 'monster:fog_lesser_demon',
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => retryScheduler.tasks.length === 3, 'portrait, world monster and player need independent retry timers');
  const background = view.sceneVisuals.get('scene:dungeon_world_demon_tower_1');
  assert.ok(background.image);
  assert.equal(view.lastRender.chrome.sceneAssets, 'error', 'one failed required scene key exposes the recoverable error gate');
  const retryKeys = [...app.visualKeyRetryTickets.keys()];
  assert.deepEqual(retryKeys.sort(), ['monster:fog_lesser_demon', 'monster:fog_lesser_demon_world', 'character:reincarnator_walk'].sort());
  const ready = (key) => key === 'monster:fog_lesser_demon' ? view.visualImage : view.sceneVisuals.get(key)?.image;
  assert.ok(retryKeys.every((key) => !ready(key)), 'each failure keeps only its own visual fallback');
  for (let recovered = 1; recovered <= 3; recovered += 1) {
    retryScheduler.runNext();
    await drainMicrotasks();
    assert.equal(retryScheduler.tasks.length, 3 - recovered, 'one recovery does not cancel another key timer');
    assert.equal(app.visualKeyRetryTickets.size, 3 - recovered);
    assert.equal(view.sceneVisuals.get('scene:dungeon_world_demon_tower_1'), background);
    assert.equal(retryKeys.filter(ready).length, recovered, 'one retry recovers only its own image');
    app.refreshViewModel();
    await drainMicrotasks();
    assert.equal(retryScheduler.tasks.length, 3 - recovered, 'same-key refresh cannot bypass remaining retries');
  }
  assert.equal(app.visualKeyRetryTickets.size, 0);
  assert.equal(retryScheduler.tasks.length, 0);
  assert.ok(retryKeys.every(ready));
  assert.equal(view.lastRender.chrome.sceneAssets, 'ready', 'existing automatic retries reopen the gate after all scene failures recover');
  assert.equal(session.imageRequests.filter(({ path }) => path === 'dungeon-world/demon_tower_1-v1').length, 1);
  assert.equal(session.imageRequests.filter(({ path }) => path.startsWith('dungeon/')).length, 0, 'combat never loads a legacy chapter portrait as its backdrop');
  assert.equal(session.sceneImageRequests.length, 7, 'player and monster world retry independently while HUD portrait and gate art stay loaded');
  assert.equal(session.imageRequests.filter(({ path }) => path === 'monster/fog-lesser-demon-v1').length, 2);
  app.onDestroy();
}

// A failed world background retries without disturbing the three ready character images.
{
  const session = assetSession({ imageFailuresByPath: {
    'dungeon-world/demon_tower_1-v1': [new Error('network offline'), undefined],
  } });
  const client = fakeClient('scene-background-retry');
  client.state = {
    phase: 'combat', visualAssetKey: 'monster:fog_lesser_demon',
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => retryScheduler.tasks.length === 1, 'background failure needs its own retry timer');
  const portrait = view.visualImage;
  const monster = view.sceneVisuals.get('monster:fog_lesser_demon_world');
  const player = view.sceneVisuals.get('character:reincarnator_walk');
  assert.ok(portrait && monster.image && player.image, 'a failed background preserves all three character images');
  assert.equal(view.sceneVisuals.get('scene:dungeon_world_demon_tower_1').image, undefined);
  assert.deepEqual([...app.visualKeyRetryTickets.keys()], ['scene:dungeon_world_demon_tower_1']);
  retryScheduler.runNext();
  await drainMicrotasks();
  assert.ok(view.sceneVisuals.get('scene:dungeon_world_demon_tower_1').image, 'the background recovers independently');
  assert.equal(view.visualImage, portrait);
  assert.equal(view.sceneVisuals.get('monster:fog_lesser_demon_world'), monster);
  assert.equal(view.sceneVisuals.get('character:reincarnator_walk'), player);
  assert.equal(session.sceneImageRequests.length, 5, 'background recovery does not reload HUD portrait, player, monster world or gate art');
  assert.equal(session.imageRequests.filter(({ path }) => path === 'monster/fog-lesser-demon-v1').length, 1);
  assert.equal(session.imageRequests.filter(({ path }) => path === 'dungeon-world/demon_tower_1-v1').length, 2);
  assert.equal(retryScheduler.tasks.length, 0);
  app.onDestroy();
  assert.equal(portrait.refCount, 0);
  assert.equal(monster.image.refCount, 0);
  assert.equal(player.image.refCount, 0);
}

// Old scene callbacks cannot return after the desired scene changes; a common player can.
{
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient('scene-stale-callbacks');
  client.state = {
    phase: 'combat',
    visualAssetKey: 'monster:fog_lesser_demon',
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => session.imageRequests.length === 2 && session.sceneImageRequests.length === 5, 'stale scene fixture did not load');
  client.state = {
    phase: 'hub', visualAssetKey: 'scene:main_god_space',
    detail: { kind: 'hub', activePanel: 'entry' },
  };
  app.refreshViewModel();
  await settleUntil(() => session.imageRequests.length === 3, 'new hub image did not start');
  const oldRequests = [...session.imageRequests.slice(0, 2), ...session.sceneImageRequests.filter(({ path }) => path.startsWith('monster-world/') || path === 'dungeon-world/debris-v1' || path === 'dungeon-world/ruined-stone-gate-v1')];
  for (const request of oldRequests) request.complete(undefined, request.image);
  const player = session.sceneImageRequests.find(({ path }) => path.startsWith('character/'));
  player.complete(undefined, player.image);
  const hub = session.imageRequests[2];
  hub.complete(undefined, hub.image);
  await drainMicrotasks();
  assert.ok(oldRequests.every(({ image }) => image.refCount === 0));
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', 'old-phase successes cannot mark the incomplete courtyard ready');
  assert.deepEqual([...view.sceneVisuals.keys()].sort(), ['character:reincarnator', 'character:reincarnator_walk', ...COURTYARD_WORLD_FIXTURES.map(({ key }) => key), ...NPC_WORLD_FIXTURES.map(({ key }) => key)].sort());
  assert.equal(session.sceneImageRequests.filter(({ path }) => path === 'character/reincarnator-walk-v2').length, 1, 'pending player request survives a phase change');
  assert.equal(session.sceneImageRequests.filter(({ path }) => path.startsWith('npc/')).length, 7, 'entry loads every world NPC before opening a shop');
  assert.equal(player.image.refCount, 1);
  app.onDestroy();
  for (const request of session.sceneImageRequests.filter(({ path }) => path.startsWith('npc/') || path.startsWith('hub-courtyard/') || path === 'character/reincarnator-v2')) {
    request.complete(undefined, request.image);
  }
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.size, 0, 'late NPC, prop and background images cannot resurrect a destroyed view');
  assert.ok(session.sceneImageRequests.every(({ image }) => image.refCount === 0), 'pending world NPC, prop and background leases release after destroy');
  for (const request of session.sceneImageRequests) {
    assert.equal(session.sceneImageReferenceCalls.filter((call) => call.operation === 'decRef' && call.handle === request.image).length, 1,
      `destroy releases each late courtyard/native image exactly once: ${request.path}`);
  }
}

// Manual recovery replaces the visual generation, cancels automatic backoff and
// rejects the previous attempt's late images while preserving the live run.
delete globalThis.wx;
{
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient('scene-manual-retry');
  client.state = {
    phase: 'combat', visualAssetKey: 'monster:fog_lesser_demon',
    run: { dungeonId: 'demon_tower_1', currentNodeId: 'upper_fog_patrol', hp: 41, seed: 0x12345678 },
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  const runState = client.state;
  const stateSnapshot = JSON.stringify(runState);
  controller.assetSessions.push(session);
  controller.clientFactories.push(() => Promise.resolve(client));
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => session.imageRequests.length === 2 && session.sceneImageRequests.length === 5, 'manual retry scene requests did not start');
  const oldRequests = [...session.imageRequests, ...session.sceneImageRequests];
  const failed = oldRequests.find(({ path }) => path === 'monster-world/fog-lesser-demon-world-v1');
  failed.complete(new Error('network offline'), undefined);
  await settleUntil(() => view.lastRender.chrome.sceneAssets === 'error', 'failed required art did not close the scene gate');
  assert.equal(retryScheduler.tasks.length, 1, 'existing automatic recovery remains scheduled');
  const cancelledRetry = retryScheduler.tasks[0];
  const recoveredSession = assetSession({ autoImages: false, autoSceneImages: false });
  controller.assetSessions.push(recoveredSession);
  view.callbacks.retrySceneAssets();
  assert.equal(retryScheduler.tasks.length, 0, 'manual retry cancels the old automatic timer');
  assert.equal(client.state, runState, 'manual retry reuses the same authoritative run');
  assert.equal(JSON.stringify(client.state), stateSnapshot, 'manual retry changes no run state');
  const oldEvents = controller.sceneAssetEvents.length;
  for (const request of oldRequests.filter(request => request !== failed)) request.complete(undefined, request.image);
  await drainMicrotasks();
  assert.equal(controller.sceneAssetEvents.slice(oldEvents).filter(event => event.startsWith('display:')).length, 0,
    'late images from the failed generation cannot reopen the scene');
  cancelledRetry.callback();
  await settleUntil(() => recoveredSession.imageRequests.length === 2 && recoveredSession.sceneImageRequests.length === 5, 'manual retry did not start a fresh full visual generation');
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading');
  const recoveredRequests = [...recoveredSession.imageRequests, ...recoveredSession.sceneImageRequests];
  const last = recoveredRequests.find(({ path }) => path === 'character/reincarnator-v2');
  for (const request of recoveredRequests.filter(request => request !== last)) request.complete(undefined, request.image);
  await drainMicrotasks();
  assert.equal(view.lastRender.chrome.sceneAssets, 'loading', 'manual retry still waits for the final HUD portrait');
  last.complete(undefined, last.image);
  await settleUntil(() => view.lastRender.chrome.sceneAssets === 'ready', 'manual recovery never reopened the complete scene');
  assert.equal(JSON.stringify(client.state), stateSnapshot);
  assert.equal(client.enterRunPhysicalCalls.length + client.dispatchPhysicalCalls.length, 0, 'resource retry cannot dispatch a gameplay command');
  app.onDestroy();
  for (const request of [...oldRequests.filter(request => request !== failed), ...recoveredRequests]) {
    assert.equal(request.image.refCount, 0, `${request.path}: replaced/destroyed generation owns no image lease`);
    const references = [...session.imageReferenceCalls, ...session.sceneImageReferenceCalls,
      ...recoveredSession.imageReferenceCalls, ...recoveredSession.sceneImageReferenceCalls];
    assert.equal(references.filter(call => call.operation === 'decRef' && call.handle === request.image).length, 1,
      `${request.path}: manual retry releases each native image exactly once`);
  }
}

for (const boundary of ['destroy', 'memory-warning']) {
  if (boundary === 'memory-warning') installWx();
  else delete globalThis.wx;
  const session = assetSession({ autoImages: false, autoSceneImages: false });
  const client = fakeClient(`scene-pending-${boundary}`);
  client.state = {
    phase: 'combat', visualAssetKey: 'monster:fog_lesser_demon',
    run: { dungeonId: 'demon_tower_1', currentNodeId: 'upper_fog_patrol', hp: 41, seed: 0x12345678 },
    detail: { kind: 'combat', enemy: { id: 'fog_lesser_demon' }, chapterContext: { dungeonId: 'demon_tower_1' } },
  };
  let clientOptions;
  controller.assetSessions.push(session);
  if (boundary === 'memory-warning') controller.portsFactories.push(() => fakePorts());
  controller.clientFactories.push((options) => {
    clientOptions = options;
    return Promise.resolve(client);
  });
  const app = new InfiniteFlowApp();
  app.start();
  const view = controller.views.at(-1);
  await settleUntil(() => session.imageRequests.length === 2 && session.sceneImageRequests.length === 5, 'pending scene fixture did not load');
  const runState = client.state;
  const stateSnapshot = JSON.stringify(runState);
  if (boundary === 'destroy') app.onDestroy();
  else clientOptions.onMemoryWarning();
  if (boundary === 'memory-warning') assert.equal(view.lastRender.chrome.sceneAssets, 'error', 'memory invalidation exposes the same manual recovery surface');
  const sceneEventsAtBoundary = controller.sceneAssetEvents.length;
  for (const request of [...session.imageRequests, ...session.sceneImageRequests]) {
    request.complete(undefined, request.image);
  }
  await drainMicrotasks();
  assert.equal(view.sceneVisuals.size, 0, `${boundary} leaves no scene state`);
  assert.equal(controller.sceneAssetEvents.slice(sceneEventsAtBoundary).filter((entry) => entry.startsWith('display:')).length, 0);
  for (const request of [...session.imageRequests, ...session.sceneImageRequests]) {
    assert.equal(request.image.refCount, 0, `${boundary} releases late ${request.path}`);
    assert.equal([...session.imageReferenceCalls, ...session.sceneImageReferenceCalls].filter((call) => call.operation === 'decRef' && call.handle === request.image).length, 1);
  }
  if (boundary === 'memory-warning') {
    const recovery = assetSession();
    controller.assetSessions.push(recovery);
    view.callbacks.retrySceneAssets();
    await settleUntil(() => view.lastRender.chrome.sceneAssets === 'ready', 'memory retry did not restore the complete scene');
    assert.equal(client.state, runState, 'memory recovery reuses the authoritative run');
    assert.equal(JSON.stringify(client.state), stateSnapshot, 'memory recovery preserves chapter, seed and player state');
    assert.equal(client.enterRunPhysicalCalls.length + client.dispatchPhysicalCalls.length, 0);
    app.onDestroy();
    assert.ok([...recovery.imageRequests, ...recovery.sceneImageRequests].every(({ image }) => image.refCount === 0),
      'destroy releases every recovered scene lease');
  }
  app.onDestroy();
}

delete globalThis.wx;
// The real View exposes one loading/error surface with no provisional actors,
// binds manual retry locally, and restores the prior feet only after ready art.
{
  const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  let retries = 0;
  const view = new SceneInfiniteFlowView(canvas, {
    activate() { assert.fail('resource gates cannot dispatch gameplay actions'); },
    retrySceneAssets() { retries += 1; },
  });
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const models = [hubModel(hubEntryActionFixtures(false)), walkingExploreModel(chapterDecisionFixture('metro_abyss')),
    combatModel(combatChapterContextFixture())];
  const root = () => canvas.children.at(-1);
  for (const model of models) {
    view.render(model, { ...chrome, sceneAssets: 'loading' }, EXPLORE_INSETS_320);
    assertSceneAssetGate(view, root(), 'loading');
    assert.equal(findNode(root(), 'WalkAvatarPlaceholder'), undefined);
    assert.equal(labelComponent(findNode(root(), 'SceneAssetTitle')).string,
      model.phase === 'hub' ? '正在进入主神空间…' : '正在进入副本…');
    globalThis.__walkingTestInput.emit('key-down', { keyCode: 65 });
    view.tick(1 / 60);
    assert.equal(view.walkScene, undefined, 'loading cannot start hidden keyboard movement');
  }
  const model = models[1];
  assert.throws(() => view.render(model, { ...chrome, sceneAssets: 'ready' }, EXPLORE_INSETS_320), /16-frame/u,
    'a falsely ready fixture must fail instead of restoring vector player art');
  assert.equal(findNode(root(), 'WalkScene'), undefined, 'missing-art invariant is checked before creating a scene graph');
  const backgroundKey = getInfiniteFlowSceneVisualKeys(model).background;
  supplySceneVisualFixtures(view, model, [backgroundKey]);
  assert.throws(() => view.render(model, { ...chrome, sceneAssets: 'ready' }, EXPLORE_INSETS_320),
    new RegExp(backgroundKey), 'a missing declared background cannot restore a vector floor');
  assert.equal(findNode(root(), 'WalkScene'), undefined, 'scene-key invariant rejects incomplete composition before publishing nodes');
  supplySceneVisualFixtures(view, model);
  view.render(model, { ...chrome, sceneAssets: 'ready' }, EXPLORE_INSETS_320);
  assert.ok(view.walkScene && view.walkInput, 'complete ready art creates the normal simulation and input');
  globalThis.__walkingTestInput.emit('key-down', { keyCode: 65 });
  for (let frame = 0; frame < 10; frame += 1) view.tick(1 / 60);
  globalThis.__walkingTestInput.emit('key-up', { keyCode: 65 });
  const feet = view.walkScene.getPosition();
  assert.notDeepEqual(feet, buildWalkWorld(model).spawn, 'ready scene retains real movement');
  view.clearSceneVisualAsset('character:reincarnator');
  view.render(model, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'error');
  assert.deepEqual(view.walkPosition, feet, 'asset failure preserves feet for a successful retry');
  const retry = findNode(root(), 'SceneAssetRetry');
  emitTouch(retry, 9890);
  assert.equal(retries, 1, 'error retry forwards exactly one local recovery callback');
  view.render(model, { ...chrome, sceneAssets: 'loading' }, EXPLORE_INSETS_320);
  emitTouch(retry, 9891);
  assert.equal(retries, 1, 'retired error-page callbacks cannot start another retry');
  supplySceneVisualFixtures(view, model);
  view.render(model, { ...chrome, sceneAssets: 'ready' }, EXPLORE_INSETS_320);
  assert.deepEqual(view.walkScene.getPosition(), feet, 'ready recovery resumes the same room and feet');
  view.render(model, { ...chrome, sceneAssets: 'loading', modeKind: 'blocked' }, EXPLORE_INSETS_320);
  assert.ok(findNode(root(), 'RuntimeBlockedOverlay'), 'runtime blockers retain priority over resource loading');
  assert.equal(findNode(root(), 'SceneAssetLoading'), undefined);
  const slots = [...view.sceneVisuals.values()];
  view.destroy();
  assert.ok(slots.every(({ frame, texture }) => frame.destroyCalls === 1 && texture.destroyCalls === 1));
  emitTouch(retry, 9892);
  assert.equal(retries, 1, 'destroyed resource controls remain inert');
}

// Hub world art is independent of shop selection and keeps the original feet/interaction contract.
{
  const canvas = { name: 'npc-world-canvas', children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const view = new SceneInfiniteFlowView(canvas, { activate() { throw new Error('NPC artwork must not dispatch actions'); } });
  const model = buildActualGameViewModel(createInitialState(), { hubPanel: 'entry' });
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const spec = buildWalkWorld(model);
  const originalSpec = JSON.stringify(spec);
  const root = () => canvas.children.at(-1);
  const keys = getInfiniteFlowSceneVisualKeys(model);
  assert.equal(keys.portrait, 'character:reincarnator', 'courtyard requests the same real HUD portrait as dungeon scenes');
  assert.deepEqual(NPC_WORLD_FIXTURES.map(({ panel }) => keys[panel]), NPC_WORLD_FIXTURES.map(({ key }) => key),
    'initial hub entry includes all seven loadable full-body image keys');
  for (const [panel, portrait] of [['bloodlines', 'npc:bloodline_priest'], ['companions', 'npc:companion_guide']]) {
    assert.equal(getInfiniteFlowSceneVisualKeys(buildActualGameViewModel(createInitialState(), { hubPanel: panel })).opponent, portrait,
      'legacy scene selects the actual shop owner portrait');
  }

  view.render(model, { ...chrome, sceneAssets: 'loading' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'loading');
  for (const { key } of NPC_WORLD_FIXTURES) {
    view.setSceneVisualAsset({ width: 1024, height: 1536 }, { key, revision: 'npc-world-fixture' });
  }
  supplySceneVisualFixtures(view, model);
  view.render(model, chrome, EXPLORE_INSETS_320);
  for (const { panel, key } of NPC_WORLD_FIXTURES) {
    const actor = findNode(root(), `WalkTarget:npc:${panel}`);
    const body = findNode(actor, 'WorldObjectBody');
    const sprite = Array.from(body.components.values()).find((component) => 'spriteFrame' in component);
    const target = spec.targets.find(({ id }) => id === `npc:${panel}`);
    assert.deepEqual({ ...actor.position }, { x: target.x, y: -target.y, z: 0 }, 'sprite uses the unchanged world target feet');
    const [height, transparentFootMargin] = COURTYARD_NPC_SIZES[panel];
    assert.equal(body.position.y - body.size.height / 2 + transparentFootMargin, 0,
      'transparent artwork margin is excluded so the visible NPC feet meet the target');
    assert.ok(Math.abs(body.size.width / body.size.height - 1024 / 1536) < 1e-9, 'contain preserves the full-body proportions');
    assert.equal(body.size.height, height, 'NPC has the exact approved courtyard sprite height');
    assert.equal(body.getComponent(TestGraphics), null, 'loaded image replaces the fallback drawing');
    assert.equal(sprite.spriteFrame, view.sceneVisuals.get(key).frame, 'each NPC uses its own world art');
    assert.ok(view.visualSprites.has(sprite), 'NPC sprite participates in shared frame cleanup');
    const name = findNode(actor, 'WalkTargetName');
    assert.ok(name.position.y - name.size.height / 2 > body.position.y + body.size.height / 2,
      'NPC name remains above the complete artwork');
    assert.ok(findNode(actor, 'WalkTargetPurpose'), 'every service retains its concise purpose label');
  }
  assert.equal(JSON.stringify(buildWalkWorld(model)), originalSpec, 'artwork never changes NPC positions, radii or actions');
  const first = NPC_WORLD_FIXTURES[0];
  const firstBody = findNode(findNode(root(), `WalkTarget:npc:${first.panel}`), 'WorldObjectBody');
  const firstSprite = Array.from(firstBody.components.values()).find((component) => 'spriteFrame' in component);
  const firstVisual = view.sceneVisuals.get(first.key);
  view.clearSceneVisualAsset(first.key);
  assert.equal(firstSprite.spriteFrame, null, 'clearing a world image detaches its live Sprite before destroying the frame');
  assert.equal(firstVisual.frame.destroyCalls, 1);
  const supplySlot = view.sceneVisuals.get('npc:supply_trader_world');
  view.render(model, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'error');
  assert.equal(supplySlot.frame.destroyCalls, 0, 'one missing world image leaves another NPC frame owned for recovery');
  view.destroy();
}

// The approved courtyard applies the actual transparent art, physical phone HUD
// and click routes through the real View, without bypassing its interaction gate.
for (const viewportWidth of [320, 390]) {
  globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportWidth * 2 };
  const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const calls = [];
  const view = new SceneInfiniteFlowView(canvas, { activate(physicalId, actionId, event) { calls.push({ physicalId, actionId, event }); } });
  const model = buildActualGameViewModel(createInitialState(), { hubPanel: 'entry' });
  const beforeModel = JSON.stringify(model);
  const spec = buildWalkWorld(model);
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const insets = viewportWidth === 320 ? EXPLORE_INSETS_320 : EXPLORE_INSETS_390;
  const root = () => canvas.children.at(-1);
  const position = () => view.walkScene.getPosition();
  const spriteOf = (node) => [...node.components.values()].find((component) => 'spriteFrame' in component);
  const key = (keyCode, down) => globalThis.__walkingTestInput.emit(down ? 'key-down' : 'key-up', { keyCode });
  const advance = (frames) => { for (let frame = 0; frame < frames; frame += 1) view.tick(1 / 60); };
  const requireFeet = () => {
    const point = position();
    assert.ok(point.x >= 78 - 1e-6 && point.x <= 1122 + 1e-6 && point.y >= 434 - 1e-6 && point.y <= 652 + 1e-6);
    for (const wall of spec.obstacles) {
      const x = Math.max(wall.x, Math.min(point.x, wall.x + wall.width));
      const y = Math.max(wall.y, Math.min(point.y, wall.y + wall.height));
      assert.ok(Math.hypot(point.x - x, point.y - y) >= 14 - 1e-5, 'automatic routes retain the complete circular foot clearance');
    }
  };
  const tickRoute = () => {
    const previous = position();
    view.tick(1 / 60);
    const point = position();
    assert.ok(Math.hypot((point.x - previous.x) / 260, (point.y - previous.y) / 145) <= 1 / 60 + 1e-6,
      'automatic walking cannot snap or move faster than the approved continuous speed');
    requireFeet();
  };
  const tapGround = (destination, touchId) => {
    const viewport = findNode(root(), 'WalkViewport');
    const camera = findNode(root(), 'WalkCamera');
    const bounds = absoluteNodeBounds(viewport);
    const point = {
      x: (bounds.left + bounds.right) / 2 + camera.position.x + destination.x * camera.scale.x,
      y: (bounds.bottom + bounds.top) / 2 + camera.position.y - destination.y * camera.scale.y,
    };
    const event = { getID: () => touchId, getUILocation: () => point, propagationStopped: false };
    viewport.emit('touch-start', event);
    viewport.emit('touch-end', event);
  };

  view.render(model, { ...chrome, sceneAssets: 'loading' }, insets);
  assertSceneAssetGate(view, root(), 'loading');
  const spawn = { ...spec.spawn };
  const portalTarget = spec.targets.find(({ id }) => id === 'portal:entry');
  assert.ok(portalTarget);
  assert.deepEqual({ x: portalTarget.x, y: portalTarget.y, radius: portalTarget.radius }, { x: 1080, y: 466, radius: 120 },
    'selected entrance artwork preserves the approved foot anchor and interaction radius');
  assert.equal(findNode(root(), 'WalkHubDungeonPortalSprite'), undefined);
  assert.equal(findNode(root(), 'WalkEnvironmentLoading'), undefined, 'one loading surface replaces old per-object fallbacks');
  const propSources = {
    pillar: { width: 870, height: 1808, bounds: [22, 93, 866, 1795] },
    crate: { width: 1457, height: 1080, bounds: [143, 272, 1352, 931] },
    lamp: { width: 930, height: 1691, bounds: [163, 69, 770, 1633] },
    altar: { width: 1500, height: 1049, bounds: [42, 61, 1459, 980] },
  };
  view.setSceneVisualAsset({ width: 1254, height: 1254 }, { key: 'character:reincarnator_walk', revision: 'courtyard-fixture' });
  view.setSceneVisualAsset({ width: 1024, height: 1536 }, { key: 'character:reincarnator', revision: 'courtyard-fixture' });
  view.setSceneVisualAsset({ width: 2172, height: 724 }, { key: 'scene:hub_courtyard_walk', revision: 'courtyard-fixture' });
  view.setSceneVisualAsset({ width: 1018, height: 1545 }, { key: HUB_PORTAL_FIXTURE.key, revision: 'courtyard-fixture' });
  for (const npc of NPC_WORLD_FIXTURES) view.setSceneVisualAsset({ width: 1024, height: 1536 }, { key: npc.key, revision: 'courtyard-fixture' });
  for (const prop of spec.props) view.setSceneVisualAsset(propSources[prop.kind], { key: prop.visualAssetKey, revision: 'courtyard-fixture' });
  supplySceneVisualFixtures(view, model);
  view.render(model, chrome, insets);
  assert.deepEqual(position(), spawn, 'art arrival preserves the player feet');
  assertCourtyardHud(root(), model, insets, viewportWidth);
  assert.equal(findNode(root(), 'WalkEnvironmentLoading'), undefined);
  const background = findNode(root(), 'WalkDungeonBackdrop:scene:hub_courtyard_walk');
  assert.ok(hasComponentNamed(background.parent, 'Mask'), 'courtyard background cover is clipped to its world');
  assert.equal(spriteOf(background).spriteFrame, view.sceneVisuals.get('scene:hub_courtyard_walk').frame);
  assertWorldImageCoverage(root(), 'scene:hub_courtyard_walk');
  assert.equal(findNode(root(), 'WalkCamera').scale.x, (findNode(root(), 'WalkScene').size.height - insets.top - insets.bottom) / spec.height,
    'courtyard world zoom preserves the original HUD-safe height');
  assert.equal(spriteOf(findNode(root(), 'WalkAvatarArt')).spriteFrame, view.sceneVisuals.get('character:reincarnator').frame,
    'compact role header uses the existing real portrait resource');
  const portalNode = findNode(root(), 'WalkTarget:portal:entry');
  const portalBody = findNode(portalNode, 'WorldObjectBody');
  const portalArt = findNode(portalBody, 'WalkHubDungeonPortalSprite');
  const portalSprite = spriteOf(portalArt);
  const portalSlot = view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key);
  assert.deepEqual({ ...portalNode.position }, { x: 1080, y: -466, z: 0 });
  assert.deepEqual({ ...portalBody.scale }, { x: 1.25, y: 1.42, z: 1 }, 'existing portal body scale is unchanged');
  assert.deepEqual({ ...portalNode.size }, { width: 160, height: 220 }, 'portal keeps its original target surface');
  const portalTouch = findNode(portalNode, 'WalkTargetTouch');
  assert.deepEqual({ ...portalTouch.size }, { width: 160, height: 220 });
  assert.deepEqual({ ...portalTouch.position }, { x: 0, y: 110, z: 0 }, 'portal keeps its original touch footprint');
  const worldWidth = portalArt.size.width * portalBody.scale.x;
  const worldHeight = portalArt.size.height * portalBody.scale.y;
  assert.ok(Math.abs(worldWidth / worldHeight - 1018 / 1545) < 1e-9,
    'new portrait artwork is not stretched by the existing non-uniform body scale');
  assert.ok(worldWidth <= 152.5 + 1e-9 && worldHeight <= 231.46 + 1e-9,
    'complete portal artwork fits inside the original world bounds');
  assert.ok(Math.abs((portalArt.position.y - portalArt.size.height / 2) * portalBody.scale.y + 11.36) < 1e-9,
    'portal image bottom uses the original base at -11.36 world units');
  assert.equal(portalSprite.spriteFrame, portalSlot.frame, 'portal uses the selected independent hub image');
  assert.ok(view.visualSprites.has(portalSprite), 'portal frame joins the existing visual teardown lifecycle');
  assert.equal(portalBody.getComponent(TestGraphics), null, 'loaded portal artwork replaces the old vector body');
  const portalPurpose = findNode(portalNode, 'WalkTargetPurpose');
  assert.ok(portalPurpose.position.y - portalPurpose.size.height / 2
    > (portalArt.position.y + portalArt.size.height / 2) * portalBody.scale.y, 'entrance purpose stays above the entire image');
  assert.equal(JSON.stringify(buildWalkWorld(model)), JSON.stringify(spec), 'hub art cannot change targets, commands or physical walking geometry');
  for (const prop of spec.props) {
    const base = findNode(root(), `WalkCourtyardProp:${prop.kind}`);
    const art = findNode(base, `WalkCourtyardPropSprite:${prop.kind}`);
    const source = propSources[prop.kind];
    const [left, top, right, bottom] = source.bounds;
    assert.deepEqual({ ...base.position }, { x: prop.x, y: -prop.y, z: 0 }, 'prop drawing and foot collision share the same world anchor');
    const scale = art.size.width / source.width;
    assert.ok(Math.abs(art.size.height / source.height - scale) < 1e-9, 'transparent prop source aspect ratio is preserved');
    assert.ok(Math.abs(art.position.y + art.size.height / 2 - bottom * scale) < 1e-9,
      'actual painted alpha bottom is anchored exactly at the prop feet');
    assert.ok(Math.abs(art.position.x - art.size.width / 2 + (left + right) / 2 * scale) < 1e-9,
      'actual painted alpha silhouette is centered around the prop feet');
    assert.ok((right - left) * scale <= prop.width + 1e-6 && (bottom - top) * scale <= prop.height + 1e-6,
      'complete prop silhouette fits its approved size without clipping');
    const sprite = spriteOf(art);
    const muted = spriteOf(findNode(art, 'WalkCourtyardDesaturation'));
    assert.equal(sprite.spriteFrame, view.sceneVisuals.get(prop.visualAssetKey).frame);
    assert.equal(muted.spriteFrame, sprite.spriteFrame, 'desaturation layer shares its prop frame');
    assert.equal(muted.grayscale, true);
    assert.equal(muted.color.channels[3], 117, 'courtyard preserves the approved muted palette');
    assert.ok(view.visualSprites.has(sprite) && view.visualSprites.has(muted), 'both prop layers participate in frame teardown');
    assert.equal(findNode(base, `WalkCourtyardPropPending:${prop.kind}`), undefined);
  }
  const body = findNode(root(), 'WalkPlayerBody');
  const playerSprite = spriteOf(body);
  assert.equal(playerSprite.trim, false, 'hero uses originalSize and calibrated offset instead of stretching the crop');
  assert.deepEqual({ ...body.size }, { width: 172, height: 172 }, 'new hero preserves the approved courtyard body size');
  assert.deepEqual({ ...body.position }, { x: 0, y: 78, z: 0 }, 'new hero preserves the approved courtyard body anchor');
  assert.ok(Math.abs(body.position.y + (168 - 320.16) * body.size.height / 336) < 0.12,
    'calibrated logical feet remain on the physical ground within a fraction of a pixel');
  assert.equal(view.walkScene.getFacing(), 'right');
  const heroFrames = view.sceneVisuals.get('character:reincarnator_walk').frames;
  assert.equal(playerSprite.spriteFrame, heroFrames[8], 'courtyard starts on the right-facing idle frame');
  const camera = findNode(root(), 'WalkCamera');
  const initialCamera = { ...camera.position };
  key(68, true); advance(6);
  assert.equal(playerSprite.spriteFrame, heroFrames[8], 'nine-fps gait has not advanced after exactly 100ms');
  advance(1); key(68, false);
  assert.equal(playerSprite.spriteFrame, heroFrames[9], 'nine-fps gait advances at the next 60Hz frame');
  assert.ok(camera.position.x < initialCamera.x, 'horizontal camera follows rightward walking');
  assert.equal(camera.position.y, initialCamera.y, 'courtyard camera has no vertical following');
  const map = findNode(root(), 'WalkMinimap');
  const dot = findNode(map, 'WalkMinimapPlayer');
  assert.ok(Math.abs(dot.position.x - (-map.size.width / 2 + position().x / spec.width * map.size.width)) < 1e-6,
    'minimap player follows actual continuous movement');
  key(65, true); advance(7); key(65, false);
  assert.equal(view.walkScene.getFacing(), 'left');
  key(87, true); advance(6); key(87, false);
  assert.equal(view.walkScene.getFacing(), 'left', 'vertical movement keeps the last left-facing side');
  assert.ok(view.sceneVisuals.get('character:reincarnator_walk').frames.slice(4, 8).includes(playerSprite.spriteFrame),
    'depth movement keeps a frame from the last left-facing direction');
  key(83, true); advance(6); key(83, false);
  assert.equal(view.walkScene.getFacing(), 'left');
  assert.equal(camera.position.y, initialCamera.y);
  assert.equal(calls.length, 0, 'ordinary walking past nearby NPCs cannot open or dispatch interactions');
  assert.equal(findNode(root(), 'MobileInfoSheet:npc'), undefined);

  const equipment = spec.targets.find(({ id }) => id === 'npc:equipment');
  tapGround(equipment, 7300 + viewportWidth);
  for (let frame = 0; frame < 180; frame += 1) tickRoute();
  assert.ok(Math.hypot(position().x - equipment.x, position().y - equipment.y) < 6,
    'ground tap reaches its actual foot destination with collision-safe walking');
  assert.equal(calls.length, 0, 'ground movement through NPC range does not become an automatic conversation');
  assert.equal(findNode(root(), 'MobileInfoSheet:npc'), undefined);
  const tasks = spec.targets.find(({ id }) => id === 'npc:tasks');
  const targetNode = findNode(root(), 'WalkTarget:npc:tasks');
  const beforeRoute = position();
  emitTouch(targetNode, 7400 + viewportWidth);
  targetNode.emit('touch-end', { getID: () => 7400 + viewportWidth, propagationStopped: false });
  assert.deepEqual(position(), beforeRoute, 'tapping a far NPC cannot teleport the player');
  assert.equal(calls.length, 0, 'tapping a far NPC does not dispatch before walking reaches it');
  let frames = 0;
  while (calls.length === 0 && frames < 360) { tickRoute(); frames += 1; }
  assert.equal(calls.length, 1, `arrival dispatches exactly one original NPC preparation event: position=${JSON.stringify(position())} route=${labelComponent(findNode(root(), 'WalkRouteNotice')).string}`);
  assert.equal(calls[0].event, tasks.action.event, 'arrival preserves exact projection-owned event identity');
  assert.equal(calls[0].actionId, tasks.action.actionId);
  assert.ok(Math.hypot(position().x - tasks.x, position().y - tasks.y) <= tasks.radius,
    'conversation starts only after the player reaches its foot radius');
  assert.ok(findNode(root(), 'MobileInfoSheet:npc'), 'arrival opens the original NPC information sheet');
  const atConversation = position();
  advance(30);
  assert.deepEqual(position(), atConversation, 'movement listeners are paused by the original conversation sheet');
  assert.equal(calls.length, 1, 'arrival cannot dispatch again while the sheet is open');
  emitTouch(findNode(root(), 'MobileSheetClose'), 7500 + viewportWidth);
  emitTouch(targetNode, 7600 + viewportWidth);
  advance(20);
  assert.deepEqual(position(), atConversation, 'stale NPC graph cannot start a fresh route after a modal rerender');
  assert.equal(calls.length, 1);
  emitTouch(findNode(root(), 'WalkTarget:npc:equipment'), 7700 + viewportWidth);
  advance(8);
  globalThis.__walkingTestGame.emit('game-hide');
  const hidden = position();
  advance(90);
  assert.deepEqual(position(), hidden, 'hide cancels automatic routes and leaves no ghost movement');
  assert.equal(calls.length, 1);

  const altarNode = findNode(root(), 'WalkCourtyardProp:altar');
  const altarSprites = [spriteOf(findNode(altarNode, 'WalkCourtyardPropSprite:altar')), spriteOf(findNode(altarNode, 'WalkCourtyardDesaturation'))];
  const altarSlot = view.sceneVisuals.get('scene:courtyard_altar');
  view.clearSceneVisualAsset('scene:courtyard_altar');
  assert.ok(altarSprites.every((sprite) => sprite.spriteFrame === null), 'both live prop layers detach before frame destruction');
  assert.equal(altarSlot.frame.destroyCalls, 1);
  assert.equal(altarSlot.texture.destroyCalls, 1);
  const livePortalSprite = spriteOf(findNode(root(), 'WalkHubDungeonPortalSprite'));
  view.render(model, { ...chrome, sceneAssets: 'error' }, insets);
  assertSceneAssetGate(view, root(), 'error');
  assert.equal(findNode(root(), 'WalkCourtyardPropPending:altar'), undefined, 'failed art never recreates superseded prop drawings');
  assert.equal(view.sceneVisuals.get('scene:courtyard_crate').frame.destroyCalls, 0, 'one failed prop preserves the other owned art');
  assert.deepEqual(view.walkPosition, hidden, 'prop error preserves walking position for recovery');
  view.clearSceneVisualAsset(HUB_PORTAL_FIXTURE.key);
  assert.equal(livePortalSprite.spriteFrame, null, 'hub portal detaches its live Sprite before frame destruction');
  assert.equal(portalSlot.frame.destroyCalls, 1);
  assert.equal(portalSlot.texture.destroyCalls, 1);
  view.render(model, { ...chrome, sceneAssets: 'error' }, insets);
  assert.equal(findNode(root(), 'WalkHubDungeonPortalSprite'), undefined);
  assertSceneAssetGate(view, root(), 'error');
  assert.deepEqual(view.walkPosition, hidden, 'portal error preserves player position');
  assert.equal(JSON.stringify(model), beforeModel, 'art, HUD, routes and conversations never mutate the public model');
  const remaining = [...view.sceneVisuals.values()];
  view.destroy();
  for (const slot of [altarSlot, portalSlot, ...remaining]) {
    assert.equal(slot.frame.destroyCalls, 1, 'each courtyard frame is destroyed exactly once');
    assert.equal(slot.texture.destroyCalls, 1, 'each courtyard texture is destroyed exactly once');
  }
  assert.equal((globalThis.__walkingTestInput.listeners.get('key-down') ?? []).length, 0);
  delete globalThis.__walkingTestFrameSize;
}

// Every monster keeps its own world sprite, action, rank and combat timing.
// Dungeon feet are the view-local HTML slots; the authoritative world is unchanged.
{
  const canvas = { name: 'monster-world-canvas', children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const view = new SceneInfiniteFlowView(canvas, { activate() { assert.fail('monster artwork must not dispatch a domain action'); } });
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const context = combatChapterContextFixture({ dungeonId: 'demon_tower_1', dungeonName: '妖雾古塔' });
  const root = () => canvas.children.at(-1);
  const spriteOf = (node) => [...node.components.values()].find((component) => 'spriteFrame' in component);
  const modelFor = (id, options = {}) => combatModel(context, { ...options, enemy: { id, name: MONSTERS[id].name } });
  const visualSlots = [];
  const load = (key, source = { width: 1024, height: 1536 }) => {
    view.setSceneVisualAsset(source, { key, revision: 'monster-world-fixture' });
    const slot = view.sceneVisuals.get(key);
    visualSlots.push(slot);
    return slot;
  };
  const normal = modelFor('fog_lesser_demon');
  view.setVisualAsset({ width: 288, height: 384 }, { key: 'monster:fog_lesser_demon', revision: 'portrait-fixture' });
  const portraitFrame = view.visualFrame;
  view.render(normal, { ...chrome, sceneAssets: 'loading' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'loading');
  assert.equal(findNode(root(), 'WalkMonsterSprite:monster:fog_lesser_demon_world'), undefined,
    'the ready portrait cannot replace a missing world image');

  assert.equal(MONSTER_WORLD_FIXTURES.length, 59, 'all domain monster identities have a world fixture');
  for (const { key } of MONSTER_WORLD_FIXTURES) load(key);
  supplySceneVisualFixtures(view, normal);
  const distinctFrames = new Set();
  for (const { id, key } of MONSTER_WORLD_FIXTURES) {
    const model = modelFor(id);
    // Deliberately stale portrait metadata must not choose the world opponent.
    model.visualAssetKey = 'monster:fog_lesser_demon';
    const spec = buildWalkWorld(model);
    const originalSpec = JSON.stringify(spec);
    const target = spec.targets.find(({ kind }) => kind === 'monster');
    assert.equal(getInfiniteFlowSceneVisualKeys(model).opponent, key, `${id} selects its own world identity`);
    view.render(model, chrome, EXPLORE_INSETS_320);
    const actor = findNode(root(), `WalkTarget:monster:${id}`);
    const body = findNode(actor, 'WorldObjectBody');
    const art = findNode(body, `WalkMonsterSprite:${key}`);
    const sprite = spriteOf(art);
    const { duel, enemyFoot } = sceneDuelLayout(root(), model, EXPLORE_INSETS_320);
    assert.ok(Math.abs(actor.position.x - enemyFoot.x) < 1e-6 && Math.abs(actor.position.y + enemyFoot.y) < 1e-6,
      `${id} stands on the duel mark for the same world identity`);
    const duelHeight = duel.enemyHeight * 320 / 750;
    assert.deepEqual({ ...body.position }, { x: 0, y: 0, z: 0 }, `${id} keeps the recoil container at its foot origin`);
    assert.equal(art.size.width / art.size.height, 1024 / 1536, `${id} contains the full source without aspect distortion`);
    const visibleBounds = projectedNodeBounds(art);
    assert.ok(Math.abs((visibleBounds.top - visibleBounds.bottom) * 320 / 750 - duelHeight) < 0.001,
      `${id} retains the duel monster image height after affine projection`);
    assert.equal(art.position.y, art.size.height / 2, `${id} anchors the original file bottom at its rendered target foot`);
    assert.equal(body.getComponent(TestGraphics), null, `${id} replaces the fallback drawing`);
    assert.equal(sprite.sizeMode, 0, `${id} uses the explicit custom sprite dimensions`);
    assert.equal(sprite.spriteFrame, view.sceneVisuals.get(key).frame, `${id} uses its own frame`);
    assert.notEqual(sprite.spriteFrame, portraitFrame, `${id} never reuses the portrait frame`);
    assert.ok(view.visualSprites.has(sprite), `${id} participates in frame cleanup`);
    distinctFrames.add(sprite.spriteFrame);
    assert.equal(JSON.stringify(buildWalkWorld(model)), originalSpec, `${id} art cannot change world interaction data`);
  }
  assert.equal(distinctFrames.size, 59, '59 monster identities use 59 independent frames');

  const rankCases = [
    { id: 'fog_lesser_demon', rank: 'normal' },
    { id: 'tower_butcher', rank: 'elite' },
    { id: 'tower_butcher', rank: 'boss',
      boss: { title: '古塔屠夫', phase: 'awakened', phaseLabel: '觉醒', sealName: '古塔封印' } },
  ];
  for (const fixture of rankCases) {
    const model = modelFor(fixture.id, fixture.boss === undefined ? {} : { boss: fixture.boss });
    view.render(model, chrome, EXPLORE_INSETS_320);
    const actor = findNode(root(), `WalkTarget:monster:${fixture.id}`);
    const body = findNode(actor, 'WorldObjectBody');
    const art = findNode(body, `WalkMonsterSprite:monster:${fixture.id}_world`);
    const card = findNode(root(), 'WalkEnemyCard');
    const health = findNode(card, 'WalkEnemyHealth');
    const healthLabel = findNode(card, 'WalkEnemyHealthLabel');
    const rank = findNode(actor, 'WalkEnemyRank');
    const { duel } = sceneDuelLayout(root(), model, EXPLORE_INSETS_320);
    assert.equal(buildWalkWorld(model).targets[0].rank, fixture.rank);
    assert.equal(body.scale?.x ?? 1, 1, `${fixture.rank} keeps recoil in the original foot coordinate system`);
    assert.equal(body.scale?.y ?? 1, 1);
    const bounds = projectedNodeBounds(art);
    assert.ok(Math.abs((bounds.top - bounds.bottom) * 320 / 750 - duel.enemyHeight * 320 / 750) < 0.001,
      `${fixture.rank} keeps the duel image size while retaining its rank mark`);
    assert.equal(findNode(actor, 'WalkEnemyHealth'), undefined, `${fixture.rank} HP moved from the body to the enemy card`);
    const expectedName = `${fixture.rank === 'boss' ? '首领 · ' : fixture.rank === 'elite' ? '精英 · ' : ''}${MONSTERS[fixture.id].name}`;
    assert.equal(labelComponent(findNode(card, 'WalkEnemyName')).string, expectedName, `${fixture.rank} card names the rank and enemy`);
    const healthLabelPosition = { ...healthLabel.position };
    const healthLabelSize = { ...healthLabel.size };
    assert.ok(healthLabel.position.y - healthLabel.size.height / 2 >= health.position.y + health.size.height / 2,
      `${fixture.rank} HP digits remain fully above the health bar`);
    assert.equal(Boolean(rank), fixture.rank !== 'normal', 'elite and boss rank marks remain distinct from ordinary enemies');
    assert.equal(health.parent, card, 'health lives on the enemy card, outside the recoiling body');
    assert.equal(healthLabel.parent, card, 'HP digits live on the enemy card');
    assert.equal(findNode(actor, 'WalkTargetName'), undefined, 'the duel stage leaves the feet clear of a name plate');
    const fullHealthTrackWidth = health.getComponent(TestGraphics).fills.at(-1).shape.width
      / (model.sections[1].detail.enemy.hpPercent / 100);
    view.walkScene.updateCombatReadout({ enemyHp: 17 });
    assert.equal(labelComponent(healthLabel).string, '17 / 80');
    assert.ok(Math.abs(health.getComponent(TestGraphics).fills.at(-1).shape.width - fullHealthTrackWidth * 17 / 80) < 0.001);
    for (const [enemyHp, width] of [[-1, 0], [81, fullHealthTrackWidth]]) {
      view.walkScene.updateCombatReadout({ enemyHp });
      assert.ok(Math.abs(health.getComponent(TestGraphics).fills.at(-1).shape.width - width) < 0.001, 'live health geometry clamps to its track');
      assert.deepEqual({ ...healthLabel.position }, healthLabelPosition, 'HP updates preserve the rank-specific digit placement');
      assert.deepEqual({ ...healthLabel.size }, healthLabelSize, 'HP updates preserve the digit bounds');
    }
    assert.deepEqual({ ...body.position }, { x: 0, y: 0, z: 0 }, 'HP updates cannot move the sprite container');
  }

  // Clearing/failing one slot cannot release another monster or the portrait.
  view.render(normal, chrome, EXPLORE_INSETS_320);
  const firstKey = 'monster:fog_lesser_demon_world';
  const firstSprite = spriteOf(findNode(root(), `WalkMonsterSprite:${firstKey}`));
  const firstSlot = view.sceneVisuals.get(firstKey);
  const otherSlot = view.sceneVisuals.get('monster:tower_butcher_world');
  view.setSceneVisualAssetFallback({ key: firstKey, revision: 'monster-world-fixture', diagnostic: 'network offline' });
  assert.equal(firstSprite.spriteFrame, null, 'fallback detaches the live world Sprite');
  assert.equal(view.visualSprites.has(firstSprite), false, 'fallback removes the detached Sprite from tracking');
  assert.equal(firstSlot.frame.destroyCalls, 1);
  assert.equal(firstSlot.texture.destroyCalls, 1);
  assert.equal(otherSlot.frame.destroyCalls, 0, 'another monster frame remains owned');
  assert.equal(portraitFrame.destroyCalls, 0, 'world fallback leaves the portrait intact');
  view.render(normal, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'error');
  assert.equal(findNode(root(), `WalkMonsterSprite:${firstKey}`), undefined);
  const boss = rankCases.at(-1);
  view.setSceneVisualAssetFallback({ key: 'monster:tower_butcher_world', revision: 'monster-world-fixture', diagnostic: 'network offline' });
  view.render(modelFor(boss.id, { boss: boss.boss }), { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'error');
  load('monster:tower_butcher_world');
  load(firstKey, { width: 0, height: 1536 });
  view.render(normal, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_320);
  assertSceneAssetGate(view, root(), 'error');
  load(firstKey, { width: 1536, height: 1024 });
  view.render(normal, chrome, EXPLORE_INSETS_320);
  const wideArt = findNode(root(), `WalkMonsterSprite:${firstKey}`);
  const wideBounds = projectedNodeBounds(wideArt);
  const wideDuel = sceneDuelLayout(root(), normal, EXPLORE_INSETS_320).duel;
  assert.ok(Math.abs((wideBounds.top - wideBounds.bottom) - wideDuel.enemyHeight) < 0.001,
    'a wide source retains the duel image height with its complete original aspect ratio');
  assert.equal(wideArt.size.width / wideArt.size.height, 1536 / 1024, 'a wide source keeps its aspect ratio');
  assert.equal(wideArt.position.y, wideArt.size.height / 2);

  view.render(modelFor(boss.id, { boss: boss.boss }), chrome, EXPLORE_INSETS_320);
  const actor = findNode(root(), `WalkTarget:monster:${boss.id}`);
  const body = findNode(actor, 'WorldObjectBody');
  const art = findNode(body, `WalkMonsterSprite:monster:${boss.id}_world`);
  const artPosition = { ...art.position };
  const artSize = { ...art.size };
  const bossCard = findNode(root(), 'WalkEnemyCard');
  const bossHealthLabel = findNode(bossCard, 'WalkEnemyHealthLabel');
  const bossHealthLabelPosition = { ...bossHealthLabel.position };
  const bossHealthY = findNode(bossCard, 'WalkEnemyHealth').position.y;
  const tick = () => view.walkScene.tick(0.1, { x: 0, y: 0 });
  for (const boundary of ['complete', 'cancel', 'destroy']) {
    let impacts = 0;
    let completions = 0;
    assert.equal(view.walkScene.startCombatAction('attack', () => { impacts += 1; }), true);
    for (let i = 0; i < 3; i += 1) tick();
    assert.equal(impacts, 1, 'monster art preserves the single authoritative impact');
    assert.equal(view.walkScene.resolveCombatAction({ enemyDamage: 13, enemyHpAfterImpact: 17 }, () => { completions += 1; }), true);
    tick();
    assert.ok(Math.hypot(body.position.x, body.position.y) > 0, 'the world sprite container visibly recoils');
    assert.deepEqual({ ...art.position }, artPosition, 'recoil preserves the child foot-margin offset');
    assert.deepEqual({ ...art.size }, artSize, 'recoil preserves contain dimensions');
    assert.equal(body.scale?.x ?? 1, 1, 'recoil preserves the fitted boss coordinate system');
    assert.equal(findNode(bossCard, 'WalkEnemyHealth').position.y, bossHealthY, 'recoil cannot move the health bar');
    assert.equal(labelComponent(bossHealthLabel).string, '17 / 80', 'impact still updates the relocated boss HP digits');
    assert.deepEqual({ ...bossHealthLabel.position }, bossHealthLabelPosition, 'recoil and impact HP updates preserve boss digit placement');
    if (boundary === 'complete') for (let i = 0; i < 6; i += 1) tick();
    else if (boundary === 'cancel') view.walkScene.cancelCombatAction();
    else view.destroy();
    assert.deepEqual({ ...body.position }, { x: 0, y: 0, z: 0 }, `${boundary} restores the monster foot origin`);
    assert.deepEqual({ ...bossHealthLabel.position }, bossHealthLabelPosition, `${boundary} preserves boss digit placement`);
    assert.equal(completions, boundary === 'complete' ? 1 : 0, `${boundary} preserves completion semantics`);
    if (boundary !== 'destroy') assert.equal(view.walkScene.isCombatAnimating(), false);
  }
  assert.equal(spriteOf(art).spriteFrame, null, 'destroy detaches the final world Sprite');
  assert.ok(visualSlots.every(({ frame, texture }) => frame.destroyCalls === 1 && texture.destroyCalls === 1),
    'all monster frames and textures, including replaced and invalid slots, release exactly once');
  assert.equal(portraitFrame.destroyCalls, 1, 'destroy releases the independent portrait once');
}

// Failed engine property assignment releases the partial atlas instead of leaking
// its already-created poses or leaving an unusable scene slot behind.
{
  const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const view = new SceneInfiniteFlowView(canvas, { activate() {} });
  const firstInstance = TestSpriteFrame.instances.length;
  TestSpriteFrame.failRectAfter = 3;
  try {
    assert.throws(() => view.setSceneVisualAsset({ width: 1254, height: 1254 },
      { key: 'character:reincarnator_walk', revision: 'partial-frame-failure' }), /injected hero crop assignment failure/u);
  } finally { TestSpriteFrame.failRectAfter = undefined; }
  const created = TestSpriteFrame.instances.slice(firstInstance);
  assert.equal(created.length, 4, 'fixture fails after allocating the source frame and three child frames');
  assert.ok(created.every((frame) => frame.destroyCalls === 1), 'failed source and child frames are released exactly once');
  assert.equal(created[0].texture.destroyCalls, 1, 'failed atlas texture is released exactly once');
  assert.equal(view.sceneVisuals.has('character:reincarnator_walk'), false, 'partial creation cannot publish an unusable atlas');
  view.destroy();
  assert.ok(created.every((frame) => frame.destroyCalls === 1), 'teardown cannot release failed frames a second time');
}

// Courtyard, exploration and combat share the same header at actual phone widths;
// transparent controls still open their existing sheets without domain actions.
for (const viewportWidth of [320, 390]) {
  globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportWidth * 2 };
  const canvas = { name: `hud04-${viewportWidth}-canvas`, children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const view = new SceneInfiniteFlowView(canvas, { activate() { assert.fail('HUD04 information controls must not dispatch a domain action'); } });
  const root = () => canvas.children.at(-1);
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const insets = viewportWidth === 320 ? EXPLORE_INSETS_320 : EXPLORE_INSETS_390;
  const explore = walkingExploreModel(chapterDecisionFixture('metro_abyss'));
  const battle = combatModel(combatChapterContextFixture());
  const hub = hubModel(hubEntryActionFixtures(false));
  view.render(explore, { ...chrome, sceneAssets: 'loading' }, insets);
  assertSceneAssetGate(view, root(), 'loading');
  assert.equal(findNode(root(), 'WalkAvatarPlaceholder'), undefined, 'unloaded portrait stays behind the scene loading gate');
  const portraitKey = 'character:reincarnator';
  view.setSceneVisualAsset({ width: 1024, height: 1536 }, { key: portraitKey, revision: 'borderless-avatar-fixture' });
  const portrait = view.sceneVisuals.get(portraitKey);
  let courtyardGeometry;
  for (const model of [hub, explore, battle]) {
    assert.equal(getInfiniteFlowSceneVisualKeys(model).portrait, portraitKey, `${model.phase}: scene composition requests the HUD portrait lease`);
    supplySceneVisualFixtures(view, model);
    view.render(model, chrome, insets);
    if (model.phase === 'explore') closeArrivalSheet(root(), 9399);
    assertDarkWalkingUi(root(), model, insets, viewportWidth);
    const avatar = findNode(root(), 'WalkAvatarArt');
    const avatarSprite = [...avatar.components.values()].find((component) => 'spriteFrame' in component);
    assert.equal(avatarSprite.spriteFrame, portrait.frame, `${model.phase}: the HUD displays its real character portrait fixture`);
    assert.ok(view.visualSprites.has(avatarSprite), 'HUD portrait participates in frame teardown');
    assert.equal(findNode(root(), 'WalkAvatarPlaceholder'), undefined, 'loaded portrait replaces its loading placeholder');
    const geometry = Object.fromEntries(['WalkHud', 'SceneCharacter', 'WalkAvatarCrop', 'SceneCharacterLabel', 'WalkRoleName',
      'WalkPlayerStatus', 'WalkPlayerHealth', 'WalkCurrencyReadout', 'WalkRewardPoints', 'WalkLingyun', 'SceneDetails', 'SceneDetailsLabel', 'SceneHelp', 'SceneHelpLabel'].map((name) => {
      const node = findNode(root(), name);
      return [name, { position: { ...node.position }, size: { ...node.size }, fontSize: labelComponent(node)?.fontSize }];
    }));
    if (model.phase === 'hub') courtyardGeometry = geometry;
    else assert.deepEqual(geometry, courtyardGeometry, `${viewportWidth}px/${model.phase}: header geometry matches the courtyard exactly`);
    const controls = [['SceneCharacter', 'character'], ['SceneHelp', 'menu'], ['SceneDetails', 'inventory'],
      ...(model.phase === 'explore' ? [['SceneMap', 'map']] : []), ...(model.phase === 'hub' ? [] : [['SceneCodex', 'objectives']])];
    for (const [name, panel] of controls) {
      const before = view.walkScene.getPosition();
      emitTouch(findNode(root(), name), 9400);
      assert.ok(findNode(root(), `MobileInfoSheet:${panel}`), `${viewportWidth}px/${model.phase}/${name}: original sheet remains reachable`);
      emitTouch(findNode(root(), 'MobileSheetClose'), 9401);
      assert.deepEqual(view.walkScene.getPosition(), before, `${name}: inspecting a sheet preserves the player position`);
    }
    if (model.phase === 'combat') {
      for (const playerHp of [35, 0, 60]) {
        view.walkScene.updateCombatReadout({ playerHp });
        assertSharedHeaderHealth(root(), playerHp, 60, viewportWidth);
      }
    }
  }
  view.destroy();
  assert.equal(portrait.frame.destroyCalls, 1, 'shared HUD portrait frame is disposed exactly once');
  delete globalThis.__walkingTestFrameSize;
}

// Acquired relic HUD art is a single local control: exact owned content, no
// candidate/seed leakage, responsive icons and harmless modal lifecycle.
for (const viewportWidth of [320, 390]) {
  globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportWidth * 2 };
  const insets = viewportWidth === 320 ? EXPLORE_INSETS_320 : EXPLORE_INSETS_390;
  const px = 750 / viewportWidth;
  const entered = reduceGameCommand(createInitialState(), { type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 } });
  assert.equal(entered.status, 'committed');
  const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  let commands = 0;
  const view = new SceneInfiniteFlowView(canvas, { activate() { commands += 1; } });
  const chrome = { modeKind: 'preview', modeLabel: 'fixture', modeDetail: '', sceneAssets: 'ready' };
  const root = () => canvas.children.at(-1);
  const escapeBound = () => (globalThis.__walkingTestInput.listeners.get('key-down') ?? []).includes(view.closeHudOnEscape);
  const spriteOf = node => [...node.components.values()].find(component => 'spriteFrame' in component);
  const project = (frame, acquiredIds, pendingIds = []) => {
    const state = { ...entered.state, run: { ...entered.state.run, relicState: {
      ...entered.state.run.relicState, frame, acquiredIds, seedRelicId: RUN_RELIC_IDS_BY_FRAME[frame].at(-1),
      ...(pendingIds.length ? { pendingDraft: { draftId: 'hud-unselected', nodeId: entered.state.run.currentNodeId, candidateIds: pendingIds } }
        : { pendingDraft: undefined }),
    } } };
    return { state, model: buildActualGameViewModel(state, {}) };
  };
  for (const [frame, ids] of Object.entries(RUN_RELIC_IDS_BY_FRAME)) {
    const { state, model } = project(frame, [...ids]);
    const snapshot = JSON.stringify(state);
    assert.deepEqual(model.sections[1].loadout.runRelics.map(relic => relic.relicId), ids, 'HUD fixture uses the real acquired-only projection');
    supplySceneVisualFixtures(view, model);
    view.render(model, chrome, insets);
    assertSharedHeader(root(), model, insets, viewportWidth);
    assert.equal(escapeBound(), false, 'HUD Escape listener is absent while no popup is open');
    const original = view.walkScene.getPosition();
    const strip = findNode(root(), 'WalkRunRelics');
    for (const relic of model.sections[1].loadout.runRelics) {
      const slot = view.sceneVisuals.get(`item:run_relic_${relic.relicId}`);
      const spriteNode = findNode(strip, `WalkRunRelicSprite:${relic.relicId}`);
      const sprite = spriteOf(spriteNode);
      assert.deepEqual({ ...spriteNode.size }, { width: 16 * px, height: 16 * px });
      assert.equal(sprite.spriteFrame, slot.frame, 'HUD uses the dedicated acquired-relic image');
      assert.ok(view.visualSprites.has(sprite));
    }
    emitTouch(strip, 9800);
    const popup = findNode(root(), 'HudRelicPopover');
    assert.ok(popup, 'the overall HUD strip opens the owned-list popup');
    assert.equal(escapeBound(), true, 'only an open HUD popup registers its Escape listener');
    assert.equal(findNode(root(), 'MobileInfoSheet:inventory'), undefined, 'HUD list uses the compact popover rather than an inventory sheet');
    assert.equal(view.walkInput, undefined, 'owned-list popup pauses movement input');
    globalThis.__walkingTestInput.emit('key-down', { keyCode: 65 });
    view.tick(1 / 60);
    assert.deepEqual(view.walkScene.getPosition(), original, 'owned-list popup pauses the current world');
    const bounds = absoluteNodeBounds(popup);
    assert.ok(Math.abs(popup.size.width / px - 264) < 1e-6);
    assert.ok((bounds.left + 375) / px >= 12 - 1e-6 && (375 - bounds.right) / px >= 12 - 1e-6, 'popup retains both phone edge insets');
    const rows = collectNodes(popup, node => node.name.startsWith('HudRelicRow:'));
    assert.deepEqual(rows.map(node => node.name), ids.map(id => `HudRelicRow:${id}`), 'popup displays the complete acquired list in its original order');
    for (const relic of model.sections[1].loadout.runRelics) {
      const row = findNode(popup, `HudRelicRow:${relic.relicId}`);
      assert.equal(labelComponent(findNode(row, 'HudRelicName')).string.replaceAll('\n', ''), relic.name);
      assert.equal(labelComponent(findNode(row, 'HudRelicEffect')).string.replaceAll('\n', ''), relic.description, 'popup preserves the exact domain description');
      const image = findNode(row, `HudRelicIcon:${relic.relicId}`);
      const visual = view.sceneVisuals.get(`item:run_relic_${relic.relicId}`);
      assert.ok(image.size.width <= 30 * px + 1e-6 && image.size.height <= 30 * px + 1e-6, 'popup art stays within its compact slot');
      assert.ok(Math.abs(image.size.width / image.size.height - visual.width / visual.height) < 1e-6, 'popup art retains its source aspect ratio');
      assert.equal(spriteOf(image).spriteFrame, view.sceneVisuals.get(`item:run_relic_${relic.relicId}`).frame, 'HUD and popup share their scene-owned frame');
      assert.ok(collectNodes(row, node => node !== row).every(node => node.listeners.size === 0), 'popup entries are read-only');
    }
    const text = collectStrings(popup).join('\n');
    assert.doesNotMatch(text, /本局回响|已获得\s*·|自动生效|仅本局|装备|倒计时/, 'owned popup contains only icons, names, effects and close');
    const close = findNode(popup, 'HudPopoverClose');
    assert.ok(close.size.width / px >= 44 && close.size.height / px >= 44);
    emitTouch(close, 9801);
    assert.equal(findNode(root(), 'HudRelicPopover'), undefined);
    assert.equal(escapeBound(), false, 'close removes the popup Escape listener');
    assert.ok(view.walkInput, 'closing the popup restores movement input');
    emitTouch(strip, 9802);
    assert.equal(findNode(root(), 'HudRelicPopover'), undefined, 'retired strip callbacks cannot reopen a fresh scene');
    emitTouch(findNode(root(), 'WalkRunRelics'), 9803);
    globalThis.__walkingTestInput.emit('key-down', { keyCode: 27 });
    assert.equal(findNode(root(), 'HudRelicPopover'), undefined, 'Escape closes only the local HUD popup');
    assert.equal(escapeBound(), false, 'Escape removes its own popup listener');
    emitTouch(findNode(root(), 'WalkRunRelics'), 9804);
    emitTouch(findNode(root(), 'HudPopoverBackdrop'), 9805);
    assert.equal(findNode(root(), 'HudRelicPopover'), undefined, 'outside touch closes the local HUD popup');
    assert.equal(escapeBound(), false, 'outside close removes the popup Escape listener');
    assert.deepEqual(view.walkScene.getPosition(), original);
    assert.equal(JSON.stringify(state), snapshot, 'inspecting and closing relics cannot mutate the authoritative run');
    assert.equal(JSON.stringify(model), JSON.stringify(buildActualGameViewModel(state, {})), 'UI does not mutate the public projection');
    assert.equal(commands, 0, 'owned-list inspection never dispatches a domain command');
  }
  const { model: candidateModel } = project('assault', ['mist_edge'], ['focus_prism', 'hunter_clock']);
  supplySceneVisualFixtures(view, candidateModel);
  view.render(candidateModel, chrome, insets);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'a new pending draft opens its selection once');
  emitTouch(findNode(root(), 'MobileSheetClose'), 9809);
  assertSharedHeader(root(), candidateModel, insets, viewportWidth);
  assert.equal(getInfiniteFlowSceneVisualKeys(candidateModel).runRelic_focus_prism, undefined, 'unselected candidates are outside the scene lease set');
  emitTouch(findNode(root(), 'WalkRunRelics'), 9810);
  const candidateRows = collectNodes(findNode(root(), 'HudRelicPopover'), node => node.name.startsWith('HudRelicRow:'));
  assert.deepEqual(candidateRows.map(node => node.name), ['HudRelicRow:mist_edge'], 'pending candidates and the archive seed do not enter the owned popup');
  emitTouch(findNode(root(), 'HudPopoverClose'), 9811);
  const combat = combatModel(combatChapterContextFixture());
  combat.sections[1].loadout = candidateModel.sections[1].loadout;
  supplySceneVisualFixtures(view, combat);
  view.render(combat, chrome, insets);
  assertSharedHeader(root(), combat, insets, viewportWidth);
  emitTouch(findNode(root(), 'WalkRunRelics'), 9812);
  assert.deepEqual(collectNodes(findNode(root(), 'HudRelicPopover'), node => node.name.startsWith('HudRelicRow:')).map(node => node.name), ['HudRelicRow:mist_edge']);
  emitTouch(findNode(root(), 'HudPopoverClose'), 9813);
  const { model: empty } = project('assault', [], ['mist_edge', 'focus_prism']);
  supplySceneVisualFixtures(view, empty);
  view.render(empty, chrome, insets);
  assert.equal(findNode(root(), 'WalkRunRelics'), undefined, 'zero acquired relics hide the row and all empty slots');
  const invalidCombat = buildActualGameViewModel({ ...createInitialState(), phase: 'combat' }, {});
  assert.deepEqual(invalidCombat.sections[1].metrics, [], 'missing combat snapshot deliberately omits resource metrics');
  supplySceneVisualFixtures(view, invalidCombat);
  view.render(invalidCombat, chrome, insets);
  assertSharedHeader(root(), invalidCombat, insets, viewportWidth);
  for (const name of ['WalkRewardPoints', 'WalkLingyun']) {
    const button = findNode(root(), name);
    assert.equal(labelComponent(findNode(button, `${name}Value`)).string, '—', 'invalid projection retains the unavailable resource marker');
    emitTouch(button, 9816);
    assert.equal(findNode(root(), 'HudResourcePopover'), undefined, 'an unavailable balance has no resource popup binding');
  }
  const hub = buildActualGameViewModel(createInitialState(), {});
  supplySceneVisualFixtures(view, hub);
  view.render(hub, chrome, insets);
  assert.equal(findNode(root(), 'WalkRunRelics'), undefined, 'hub archive seeds cannot appear as active run relics');
  for (const [button, name, expected] of [['WalkRewardPoints', '奖励点', createInitialState().rewardPoints], ['WalkLingyun', '灵蕴', createInitialState().lingyun]]) {
    const before = view.walkScene.getPosition();
    emitTouch(findNode(root(), button), 9814);
    assert.ok(findNode(root(), 'HudResourcePopover'));
    assert.equal(labelComponent(findNode(root(), 'HudResourceValue')).string.replaceAll('\n', ''), `${name}：${expected}`);
    emitTouch(findNode(root(), 'HudPopoverClose'), 9815);
    assert.deepEqual(view.walkScene.getPosition(), before);
  }
  const ownedSlots = RUN_RELIC_FIXTURES.map(({ key }) => view.sceneVisuals.get(key));
  view.destroy();
  assert.ok(ownedSlots.every(slot => slot.frame.destroyCalls === 1 && slot.texture.destroyCalls === 1), 'shared HUD/popover relic resources release once at destruction');
  assert.equal((globalThis.__walkingTestInput.listeners.get('key-down') ?? []).length, 0, 'destroy removes walking and Escape input listeners');
  assert.equal(commands, 0);
  delete globalThis.__walkingTestFrameSize;
}

// Walking presentation: continuous, local-only locomotion through the real View.
// Combat and interactions still pass existing actions across the application boundary.
{
  const canvasSize = { width: 750, height: 1334 };
  const canvas = { name: 'walking-canvas', children: [], getComponent() { return { contentSize: canvasSize }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const calls = [];
  const view = new SceneFixtureView(canvas, { activate(physicalId, actionId, event) { calls.push({ physicalId, actionId, event }); } });
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const atlasKey = 'character:reincarnator_walk';
  view.setSceneVisualAsset({ width: 1254, height: 1254 }, { key: atlasKey, revision: 'fixture' });
  view.setSceneVisualAsset({ width: 1018, height: 1545 }, { key: HUB_PORTAL_FIXTURE.key, revision: 'fixture' });
  const atlas = view.sceneVisuals.get(atlasKey);
  assert.equal(atlas.frames.length, 16);
  assert.ok(atlas.frames.every((frame) => frame.texture === atlas.texture), 'all sixteen directions/steps share one GPU texture');
  assert.equal(new Set(atlas.frames.map((frame) => JSON.stringify(frame.rect))).size, 16,
    'each direction and step samples its own crop');
  for (let index = 0; index < atlas.frames.length; index += 1) {
    const frame = atlas.frames[index];
    const rect = frame.rect;
    assert.ok([rect.x, rect.y, rect.width, rect.height].every(Number.isInteger)
      && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0
      && rect.x + rect.width <= 1254 && rect.y + rect.height <= 1254,
    `hero frame ${index}: source crop stays inside the approved image`);
    assert.deepEqual({ ...frame.originalSize }, { width: 336, height: 336 },
      'every pose uses one logical canvas instead of scaling to its own alpha bounds');
    assert.ok(Number.isFinite(frame.offset.x) && Number.isFinite(frame.offset.y),
      'each pose has a finite foot-alignment offset');
    assert.equal(frame.packable, false, 'runtime packing cannot relocate an explicit crop');
    const measured = HERO_WALK_LAYOUT.frames[index];
    assert.deepEqual([rect.x, rect.y, rect.width, rect.height], measured.rect,
      `hero frame ${index}: engine samples the independently measured production crop`);
    const [left, top, right, bottom] = HERO_WALK_LAYOUT.bboxAlpha128Exclusive[index];
    assert.ok(left >= rect.x && top >= rect.y && right <= rect.x + rect.width && bottom <= rect.y + rect.height,
      `hero frame ${index}: crop preserves the complete measured opaque silhouette`);
    const logicalFootX = frame.originalSize.width / 2 + frame.offset.x + measured.foot[0] - rect.x - rect.width / 2;
    const logicalFootY = frame.originalSize.height / 2 - frame.offset.y + measured.foot[1] - rect.y - rect.height / 2;
    assert.ok(Math.abs(logicalFootX - 168) < 1e-6 && Math.abs(logicalFootY - 320.16) < 1e-6,
      `hero frame ${index}: visible source feet share one logical ground point`);
    for (const previous of atlas.frames.slice(0, index)) {
      const other = previous.rect;
      assert.ok(rect.x + rect.width <= other.x || other.x + other.width <= rect.x
        || rect.y + rect.height <= other.y || other.y + other.height <= rect.y,
      `hero frame ${index}: source crops cannot sample neighboring poses`);
    }
  }
  const instancesBeforeMismatch = TestSpriteFrame.instances.length;
  const portalBeforeMismatch = view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key);
  for (const image of [{ width: 1253, height: 1254 }, { width: 1254, height: 1253 }, { width: 2508, height: 2508 }]) {
    assert.throws(() => view.setSceneVisualAsset(image, { key: atlasKey, revision: 'invalid-size' }), /1254/u,
      'a mismatched image must explicitly fail instead of slicing the wrong layout');
    assert.equal(view.sceneVisuals.get(atlasKey), atlas, 'invalid replacements preserve the current usable hero atlas');
    assert.equal(TestSpriteFrame.instances.length, instancesBeforeMismatch, 'invalid sizes allocate no new frames or textures');
    assert.equal(atlas.frame.destroyCalls, 0, 'rejected replacement leaves the atlas owner live');
    assert.ok(atlas.frames.every((frame) => frame.destroyCalls === 0), 'rejected replacement leaves all poses live');
    assert.equal(atlas.texture.destroyCalls, 0, 'rejected replacement preserves the shared texture');
    assert.equal(view.sceneVisuals.get(HUB_PORTAL_FIXTURE.key), portalBeforeMismatch, 'invalid hero art cannot clear another scene slot');
  }
  const root = () => canvas.children.at(-1);
  const pos = () => view.walkScene.getPosition();
  const key = (code, down) => globalThis.__walkingTestInput.emit(down ? 'key-down' : 'key-up', { keyCode: code });
  const advance = (frames = 30) => { for (let i = 0; i < frames; i += 1) view.tick(1 / 60); };
  const model = hubModel(hubEntryActionFixtures(false));
  // Keep the walking boundary fixture explicit: service options own the same
  // immutable actions as the projection, while entering remains a footer action.
  const actualEntryServices = buildActualGameViewModel(createInitialState(), { hubPanel: 'entry' }).sections[1].detail.entryServices;
  const dungeonService = actualEntryServices.find(service => service.id === 'dungeon');
  model.sections[1].detail.entryServices = [dungeonService, {
    id: 'protocol', name: '探索协议', summary: '标准探索',
    options: model.sections[2].actions.filter(action => action.actionId.startsWith('hub.entry.protocol:')).map(action => ({
      id: action.actionId, name: action.label,
      description: action.disabledReason ?? '确认入场前可调整本次探索协议。',
      selected: action.actionId === 'hub.entry.protocol:standard', action,
    })),
  }, actualEntryServices.find(service => service.id === 'relic-frame')];
  const domainSnapshot = JSON.stringify(model);
  view.render(model, chrome, EXPLORE_INSETS_320);
  assert.ok(findNode(root(), 'WalkHubDungeonPortalSprite'), 'physical portal action coverage runs with the selected artwork loaded');
  assertDarkWalkingUi(root(), model, EXPLORE_INSETS_320);
  assert.ok(findNode(root(), 'WalkViewport'));
  canvasSize.height = 421.875;
  view.tick(0);
  assert.equal(root().scale.x, 421.875 / 1334, 'wide desktop windows show the entire portrait game');
  assert.equal(root().scale.y, root().scale.x, 'portrait fitting preserves aspect ratio');
  canvasSize.height = 1334;
  view.tick(0);
  assert.equal(root().scale.x, 1, 'returning to portrait restores the design scale');
  assert.ok(findNode(root(), 'WalkPlayerBody'));
  assert.equal(collectNodes(root(), ({ name }) => name === 'WalkTargetName').length, 8,
    'all seven hub NPCs and the portal retain their readable labels');
  assert.equal(collectNodes(root(), ({ name }) => name === 'WalkTargetPurpose').length, 8,
    'all seven NPCs and the portal retain their purpose labels');
  for (const name of ['WalkInteractionHint', 'WalkInteractionHintBacking', 'WalkLocationName', 'WalkStatusLamp', 'WalkJoystickStatus']) {
    assert.equal(findNode(root(), name), undefined, `approved courtyard removes ${name}`);
  }
  assert.doesNotMatch(collectStrings(root()).join('\n'), /主神空间|轮回庭院|(?:\bE\b|Space).*交谈|摇杆/iu,
    'the default courtyard has no scene title or joystick instruction readout');
  assert.equal(findNode(root(), 'Deck'), undefined, 'default is the walkable world, not an information deck');
  const initialRoot = root();
  const initial = pos();
  key(87, true);
  advance();
  key(87, false);
  assert.ok(pos().y < initial.y - 70, 'held W moves continuously upward through the shallow lane');
  assert.equal(view.walkScene.getFacing(), 'right', 'upward depth movement preserves the initial right-facing side view');
  assert.equal(root(), initialRoot, 'movement does not recreate the scene graph');
  const playerSprite = Array.from(findNode(root(), 'WalkPlayerBody').components.values()).find((component) => 'spriteFrame' in component);
  assert.ok(atlas.frames.slice(8, 12).includes(playerSprite.spriteFrame), 'north motion keeps a right-facing frame');
  const stopped = pos();
  advance(12);
  assert.deepEqual(pos(), stopped, 'key release stops movement');
  key(83, true); advance(); key(83, false);
  assert.ok(Math.abs(pos().y - initial.y) < 0.01, 'held S moves back down');
  key(65, true); advance(15); key(65, false);
  assert.ok(pos().x < initial.x - 50, 'A moves left');
  assert.equal(view.walkScene.getFacing(), 'left');
  key(87, true); advance(6); key(87, false);
  assert.equal(view.walkScene.getFacing(), 'left', 'depth movement preserves the last left-facing side');
  assert.ok(view.sceneVisuals.get('character:reincarnator_walk').frames.slice(4, 8).includes(playerSprite.spriteFrame),
    'depth movement keeps a frame from the last left-facing direction');
  key(83, true); advance(6); key(83, false);
  assert.equal(view.walkScene.getFacing(), 'left', 'downward depth movement also preserves the last side');
  key(68, true); advance(15); key(68, false);
  assert.ok(Math.abs(pos().x - initial.x) < 0.01, 'D moves right');
  assert.equal(calls.length, 0, 'walking itself is never a domain command');
  assert.equal(JSON.stringify(model), domainSnapshot, 'locomotion does not mutate the public model');

  const joystick = findNode(root(), 'WalkJoystick');
  const bounds = absoluteNodeBounds(joystick);
  const point = { x: (bounds.left + bounds.right) / 2, y: (bounds.bottom + bounds.top) / 2 + 66 };
  const touch = { getID: () => 812, getUILocation: () => point, propagationStopped: false };
  const beforeJoystick = pos();
  joystick.emit('touch-start', touch);
  advance(20);
  assert.ok(pos().y < beforeJoystick.y - 45, 'held physical joystick moves the avatar at the approved depth speed');
  joystick.emit('touch-cancel', touch);
  const cancelled = pos();
  advance(10);
  assert.deepEqual(pos(), cancelled, 'cancelled touch resets the stick');
  assert.equal(findNode(root(), 'WalkJoystickThumb').position.y, 0);
  key(87, true);
  globalThis.__walkingTestGame.emit('game-hide');
  advance();
  assert.deepEqual(pos(), cancelled, 'hide clears held keys and prevents ghost movement');

  // Walk into the portal's interaction radius; no teleport or direct target activation.
  key(83, true); advance(20); key(83, false);
  key(68, true); advance(120); key(68, false);
  key(87, true); advance(30); key(87, false);
  assert.ok(pos().x >= 1000 && pos().x <= 1122 && pos().y >= 434 && pos().y <= 500,
    'walking reaches the right-side portal while keeping whole feet within the floor');
  const beforeInteraction = calls.length;
  key(69, true); advance(3); key(69, false);
  key(32, true); advance(3); key(32, false);
  assert.equal(calls.length, beforeInteraction, 'E and Space never dispatch interaction actions');
  assert.equal(findNode(root(), 'MobileInfoSheet:entry'), undefined, 'E and Space do not open the nearby portal');
  emitTouch(findNode(root(), 'WalkInteract'), 901);
  const enter = model.sections[2].actions.find((action) => action.actionId === 'hub.entry.confirm');
  assert.equal(calls.length, beforeInteraction, 'approaching the portal opens its chapter directory, never auto-enters');
  assert.ok(findNode(root(), 'MobileInfoSheet:entry'));
  assert.ok(findNode(root(), 'MobileSheetEntryConfirm'), 'chapter directory immediately exposes its fixed entry button');
  assert.equal(findNode(root(), 'MobileSheetEntrySettings'), undefined, 'settings starts collapsed over the chapter page');
  assert.equal(dungeonService.options.length, 19);
  for (const option of dungeonService.options) assert.ok(findNode(root(), `MobileSheetEntryDungeon:${option.id}`), 'all 19 chapters are immediately reachable');
  const dungeonScroll = () => Array.from(findNode(root(), 'MobileSheetEntryDungeonScroll').components.values()).find(component => typeof component.getScrollOffset === 'function');
  dungeonScroll().scrollToOffset({ x: 0, y: 180 });
  const currentChapter = dungeonService.options.find(option => option.selected);
  emitTouch(findNode(root(), `MobileSheetEntryDungeon:${currentChapter.id}`), 902);
  assert.equal(calls.length, beforeInteraction, 'touching the current chapter dispatches neither selection nor entry');
  assert.equal(findNode(root(), 'MobileSheetEntrySettings'), undefined, 'touching the current chapter stays on the same page');
  assert.equal(dungeonScroll().getScrollOffset().y, 180, 'current chapter touch preserves chapter scroll');
  const otherChapter = dungeonService.options.find(option => !option.selected);
  const staleChapterRow = findNode(root(), `MobileSheetEntryDungeon:${otherChapter.id}`);
  emitTouch(staleChapterRow, 904);
  staleChapterRow.emit('touch-end', { getID: () => 904, propagationStopped: false });
  assert.equal(calls.length, beforeInteraction + 1, 'duplicate chapter touch forwards exactly one preparation selection');
  assert.equal(calls.at(-1).event, otherChapter.action.event, 'chapter selection preserves its exact projection-owned event');
  assert.ok(!view.mobileSheet.entrySettingsOpen, 'chapter selection stays on the directory with settings collapsed');
  // A host refresh after selection must preserve the independent chapter offset.
  view.render(model, chrome, EXPLORE_INSETS_320);
  assert.equal(dungeonScroll().getScrollOffset().y, 180, 'chapter selection preserves directory position across host refresh');
  assert.ok(findNode(root(), 'MobileSheetEntryConfirm'), 'host refresh keeps the entry footer immediately available');
  emitTouch(staleChapterRow, 905);
  assert.equal(calls.length, beforeInteraction + 1, 'a chapter callback from the old render cannot dispatch again');
  const beforeEntryConfirmation = calls.length;
  const staleEntryConfirm = findNode(root(), 'MobileSheetEntryConfirm');
  emitTouch(findNode(root(), 'MobileSheetEntrySettingsToggle'), 906);
  assert.equal(view.mobileSheet.entrySettingsOpen, true, 'settings toggle expands upward on the same sheet');
  assert.ok(findNode(root(), 'MobileSheetEntrySettings'));
  assert.ok(findNode(root(), `MobileSheetEntryDungeon:${currentChapter.id}`), 'settings overlay retains chapter cards');
  assert.equal(dungeonScroll().getScrollOffset().y, 180, 'settings leaves the directory scroll untouched');
  assert.ok(findNode(root(), 'MobileSheetEntryOption:hub.entry.protocol:standard'), 'settings immediately exposes protocol choices');
  emitTouch(findNode(root(), 'MobileSheetEntryOption:hub.entry.protocol:standard'), 907);
  assert.equal(calls.length, beforeEntryConfirmation, 'reading or touching the selected entry protocol is not confirmation');
  emitTouch(staleEntryConfirm, 908);
  assert.equal(calls.length, beforeEntryConfirmation, 'settings refresh invalidates the stale entry confirmation callback');
  const echoDescription = findNode(root(), 'MobileSheetEntryFrameDescription');
  assert.equal(collectStrings(echoDescription).length, 1, 'settings has one compact echo direction description');
  assert.equal(collectStrings(echoDescription)[0].includes('\n'), false, 'echo direction remains one line');
  emitTouch(findNode(root(), 'MobileSheetEntrySettingsToggle'), 909);
  assert.equal(view.mobileSheet.entrySettingsOpen, false, 'settings toggle collapses in place');
  assert.equal(findNode(root(), 'MobileSheetEntrySettings'), undefined);
  assert.equal(dungeonScroll().getScrollOffset().y, 180, 'closing settings preserves chapter scroll');
  const entryConfirm = findNode(root(), 'MobileSheetEntryConfirm');
  assert.ok(collectStrings(entryConfirm).includes('进入副本'));
  assert.ok(findNode(findNode(root(), 'MobileSheetEntryFooter'), 'MobileSheetEntryConfirm'), 'entry confirmation remains in its fixed footer');
  emitTouch(entryConfirm, 910);
  entryConfirm.emit('touch-end', { getID: () => 910, propagationStopped: false });
  assert.equal(calls.length, beforeEntryConfirmation + 1, 'duplicate entry touch-end dispatches exactly one request');
  assert.equal(calls.at(-1).event, enter.event, 'explicit portal confirmation dispatches the exact entry action');
  emitTouch(findNode(root(), 'MobileSheetClose'), 905);
  const beforeDetails = pos();
  emitTouch(findNode(root(), 'SceneDetails'), 902);
  assert.ok(findNode(root(), 'MobileInfoSheet:inventory'), 'inventory is a click-open mobile sheet');
  assert.equal(findNode(root(), 'Deck'), undefined, 'mobile sheets never return to the legacy text deck');
  assert.ok(findNode(root(), 'WalkViewport'), 'the world remains visible beneath the modal');
  assert.equal(view.walkInput, undefined, 'sheet disposes movement listeners');
  const beforeBlocked = calls.length;
  emitTouch(findNode(root(), 'WalkInteract'), 906);
  emitTouch(findNode(root(), 'SceneHelp'), 907);
  assert.equal(calls.length, beforeBlocked, 'world controls cannot click through the sheet');
  assert.ok(findNode(root(), 'MobileInfoSheet:inventory'));
  key(83, true); advance(); key(83, false);
  assert.deepEqual(pos(), beforeDetails, 'held keyboard cannot move behind a sheet');
  const staleSheetClose = findNode(root(), 'MobileSheetClose');
  emitTouch(staleSheetClose, 903);
  assert.deepEqual(pos(), beforeDetails, 'closing the sheet preserves spatial position');
  for (const [control, kind] of [['SceneCharacter', 'character'], ['SceneHelp', 'menu']]) {
    emitTouch(findNode(root(), control), 908);
    assert.ok(findNode(root(), `MobileInfoSheet:${kind}`), `${control} opens ${kind}`);
    const closeBounds = absoluteNodeBounds(findNode(root(), 'MobileSheetClose'));
    assert.ok((closeBounds.right - closeBounds.left) * 320 / 750 >= 44, 'phone close control is at least 44px wide');
    assert.ok((closeBounds.top - closeBounds.bottom) * 320 / 750 >= 44, 'phone close control is at least 44px high');
    emitTouch(staleSheetClose, 909);
    assert.ok(findNode(root(), `MobileInfoSheet:${kind}`), 'stale modal callbacks cannot close a fresh sheet');
    emitTouch(findNode(root(), 'MobileSheetClose'), 910);
    assert.deepEqual(pos(), beforeDetails);
  }
  const staleInteraction = findNode(root(), 'WalkInteract');

  const explore = walkingExploreModel(chapterDecisionFixture('metro_abyss'));
  view.render(explore, chrome, EXPLORE_INSETS_320);
  closeArrivalSheet(root(), 911);
  assertDarkWalkingUi(root(), explore, EXPLORE_INSETS_320);
  const dungeonBody = findNode(root(), 'WalkPlayerBody');
  const dungeonSprite = Array.from(dungeonBody.components.values()).find((component) => 'spriteFrame' in component);
  assert.equal(dungeonSprite.trim, false, 'dungeon actor uses the same logical frame canvas');
  assert.equal(dungeonSprite.spriteFrame, atlas.frames[0], 'dungeon spawn starts on the down-facing idle frame');
  assert.equal(dungeonBody.size.width, dungeonBody.size.height, 'dungeon hero preserves the square atlas aspect ratio');
  assert.equal(dungeonBody.position.x, 0, 'dungeon hero remains centered over its original feet');
  assert.ok(Math.abs(dungeonBody.position.y + (168 - 320.16) * dungeonBody.size.height / 336) < 0.3,
    'dungeon visible feet stay on the collision anchor');
  assert.deepEqual(pos(), { x: 500, y: 700 }, 'entering a different room creates a visible spawn clear of the southern door');
  assert.equal(findNode(root(), 'Deck'), undefined, 'phase changes return to gameplay');
  const callsBeforeStale = calls.length;
  emitTouch(staleInteraction, 904);
  assert.equal(calls.length, callsBeforeStale, 'stale hub objects cannot act inside the dungeon');
  const allText = collectStrings(root()).join('\n');
  assert.ok(!allText.includes('南侧隧道'), 'hidden fog identity stays hidden');
  for (const [control, kind] of [['SceneMap', 'map'], ['SceneCodex', 'objectives']]) {
    const panelBaseline = calls.length;
    emitTouch(findNode(root(), control), 911);
    assert.ok(findNode(root(), `MobileInfoSheet:${kind}`));
    assert.ok(!collectStrings(root()).join('\n').includes('南侧隧道'));
    emitTouch(findNode(root(), 'MobileSheetClose'), 912);
    assert.equal(calls.length, panelBaseline, `${kind} is inspection only`);
  }
  const beforeAssetRefresh = pos();
  view.setSceneVisualAsset({ width: 720, height: 180 }, { key: 'scene:dungeon_world_metro_abyss', revision: 'fixture' });
  view.render(explore, chrome, EXPLORE_INSETS_320);
  assert.deepEqual(pos(), beforeAssetRefresh, 'asset refresh preserves position');
  const busyPos = pos();
  view.render(explore, { ...chrome, busyActionId: 'node.fight' }, EXPLORE_INSETS_320);
  key(87, true); advance(); key(87, false);
  assert.deepEqual(pos(), busyPos, 'busy/blocked surface cannot keep walking');

  const pendingModel = walkingExploreModel(chapterDecisionFixture('metro_abyss'), { pending: true });
  view.render(pendingModel, chrome, EXPLORE_INSETS_320);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'a new equipment offer opens its sheet before nearby interaction');
  emitTouch(findNode(root(), 'MobileSheetClose'), 91250);
  const pendingSpec = buildWalkWorld(pendingModel);
  const pendingTarget = pendingSpec.targets.find(entry => entry.id === `node:${pendingModel.sections[1].detail.currentNode.nodeId}`);
  walkTowardRenderedTarget(view, root(), pendingTarget.id, pendingTarget.radius);
  const beforeChoice = calls.length;
  emitTouch(findNode(root(), 'WalkInteract'), 913);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'));
  assert.equal(calls.length, beforeChoice, 'even a single pending choice requires player input');
  const pendingAction = pendingModel.sections[2].actions.find((action) => action.actionId === 'pending.equipment:offer-1:take');
  emitTouch(findNode(root(), 'MobileSheetEquipmentOffer:armor_piercing_sword'), 914);
  assert.equal(calls.length, beforeChoice, 'selecting the equipment card remains local');
  assert.equal(view.mobileSheet.selectedActionId, pendingAction.actionId, 'card selection keeps the pending action ID');
  const staleChoice = findNode(root(), 'MobileSheetEquipmentClaim');
  emitTouch(staleChoice, 915);
  staleChoice.emit('touch-end', { getID: () => 915, propagationStopped: false });
  assert.equal(calls.length, beforeChoice + 1, 'duplicate equipment claim touch-end dispatches only once');
  assert.equal(calls.at(-1).event, pendingAction.event);
  const resolvedModel = walkingExploreModel(chapterDecisionFixture('metro_abyss'), {
    currentNode: { ...pendingModel.sections[1].detail.currentNode, cleared: true },
  });
  const atChoice = pos();
  view.render(resolvedModel, chrome, EXPLORE_INSETS_320);
  assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'resolving pending dismisses the old choice sheet');
  assert.deepEqual(pos(), atChoice, 'resolving an object preserves the avatar position');
  const afterChoice = calls.length;
  emitTouch(staleChoice, 916);
  assert.equal(calls.length, afterChoice, 'a resolved choice cannot fire again');
  const optionalEventModel = structuredClone(pendingModel);
  optionalEventModel.sections[1].detail.pending.kind = 'dungeon-event';
  view.render(optionalEventModel, chrome, EXPLORE_INSETS_320);
  emitTouch(findNode(root(), 'WalkInteract'), 920);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'));
  const clearedOptionalEvent = structuredClone(optionalEventModel);
  clearedOptionalEvent.sections[1].detail.currentNode.cleared = true;
  view.render(clearedOptionalEvent, chrome, EXPLORE_INSETS_320);
  assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined,
    'resolving the underlying node returns to walking even when its optional event remains');
  emitTouch(findNode(root(), 'WalkInteract'), 921);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'remaining optional events can still be inspected deliberately');
  emitTouch(findNode(root(), 'MobileSheetClose'), 922);

  const battle = combatModel(combatChapterContextFixture());
  view.render(battle, chrome, EXPLORE_INSETS_390);
  assertDarkWalkingUi(root(), battle, EXPLORE_INSETS_390);
  assert.ok(findNode(root(), 'WalkCombatAction:combat.action:attack'));
  const beforeCombatDispatch = calls.length;
  emitTouch(findNode(root(), 'WalkCombatAction:combat.action:attack'), 905);
  assert.equal(calls.length, beforeCombatDispatch, 'combat selection does not dispatch before its windup');
  assert.equal(view.walkScene.isCombatAnimating(), true, 'combat starts its visual windup before dispatch');
  const windupPosition = pos();
  key(68, true);
  advance(12);
  key(68, false);
  assert.deepEqual(pos(), windupPosition, 'movement stays locked during combat windup');
  assert.equal(calls.length, beforeCombatDispatch, 'windup does not dispatch before the impact frame');
  advance(6);
  assert.equal(calls.length, beforeCombatDispatch + 1, 'impact dispatches exactly one combat command');
  assert.equal(calls.at(-1).event, battle.sections[2].actions[0].event, 'spatial combat keeps original action semantics');
  view.resolveCombatPresentation('combat.action:attack', [{ stage: 'impact', playerHp: 42, enemyHp: 17 }, { stage: 'counter', playerHp: 35, enemyHp: 17, guarded: false }]);
  assertSharedHeaderHealth(root(), 42, 60); // Impact preserves the pre-counter player HP and the approved thin line.
  assert.equal(labelComponent(findNode(root(), 'WalkEnemyHealthLabel')).string, '17 / 80', 'impact displays the authoritative enemy HP');
  const resolvedBattle = structuredClone(battle);
  resolvedBattle.sections[1].detail.player = { hp: 35, maxHp: 60, hpPercent: 58 };
  resolvedBattle.sections[1].detail.enemy.hp = 17;
  resolvedBattle.sections[1].detail.enemy.hpPercent = 21;
  resolvedBattle.sections[1].detail.turn = 4;
  view.render(resolvedBattle, chrome, EXPLORE_INSETS_390);
  advance(27);
  assertSharedHeaderHealth(root(), 42, 60); // Queued result cannot reveal counter damage early.
  advance(10);
  assertSharedHeaderHealth(root(), 35, 60); // Counter impact displays its authoritative player HP without restoring the old HUD.
  advance(33);
  assert.equal(view.walkScene.isCombatAnimating(), false, 'actual result playback completes before walking resumes');
  const battlePos = pos();
  key(68, true); advance(12); key(68, false);
  assert.deepEqual(pos(), battlePos, 'combat v2 holds the avatar on its duel mark; walking resumes after the encounter');
  // Space must reach the parry window even though the busy render disposes walking input.
  const keyListeners = () => (globalThis.__walkingTestInput.listeners.get('key-down') ?? []).length;
  const parryGuard = { ...battle.sections[2].actions[1],
    parryEvent: { kind: 'command', command: { type: 'combat/act', action: 'guard', timing: 'perfect' } } };
  const heavyBattle = combatModel(combatChapterContextFixture(), {
    actions: [battle.sections[2].actions[0], parryGuard], turn: 2,
    intent: { id: 'heavy-blow', name: '蓄力重击', severity: 'danger', consequence: '蓄力重击。',
      recommendedActions: ['guard'], dangerousActions: ['attack'], parryable: true },
  });
  // 1/60s frames: 11 finish the guard windup, then ~31-40 more reach the target band.
  for (const [index, [label, pressAfter, perfect]] of [['Space on the ring', 36, true], ['Space too early', 6, false]].entries()) {
    view.render(heavyBattle, chrome, EXPLORE_INSETS_390);
    const idleListeners = keyListeners();
    const beforeParry = calls.length;
    key(32, true); key(32, false);
    assert.equal(calls.length, beforeParry, `${label}: Space outside the window dispatches nothing`);
    emitTouch(findNode(root(), 'WalkCombatAction:combat.action:guard'), 940 + index);
    advance(11);
    assert.equal(findNode(root(), 'WalkCombatTimingCatcher').active, true, `${label}: the window is open on the busy scene`);
    assert.equal(keyListeners(), idleListeners, `${label}: walking input is gone and the window holds the only Space listener`);
    advance(pressAfter);
    key(32, true); key(32, false);
    assert.equal(calls.length, beforeParry + 1, `${label}: Space closes the window with exactly one dispatch`);
    assert.equal(calls.at(-1).event, perfect ? parryGuard.parryEvent : parryGuard.event, `${label}: Space selects the matching event`);
    assert.equal(keyListeners(), idleListeners - 1, `${label}: the window releases its Space listener`);
    view.resolveCombatPresentation('combat.action:guard', [{ stage: 'impact', playerHp: 42, enemyHp: 30, guarded: true },
      { stage: 'counter', playerHp: 40, enemyHp: 30, guarded: true, ...(perfect ? { perfectParry: true } : {}) }]);
    advance(70);
    assert.equal(view.walkScene.isCombatAnimating(), false, `${label}: playback completes`);
  }
  view.render(battle, chrome, EXPLORE_INSETS_390);
  const unavailable = { ...battle.sections[2].actions[0], actionId: 'combat.action:art', combatAction: 'art', label: '术法攻击',
    enabled: false, event: undefined, disabledReason: '术法尚未就绪。' };
  const unavailableBattle = combatModel(combatChapterContextFixture(), { actions: [unavailable] });
  view.render(unavailableBattle, chrome, EXPLORE_INSETS_390);
  const beforeUnavailable = calls.length;
  emitTouch(findNode(root(), 'WalkCombatChoice:spells'), 917);
  assert.ok(findNode(root(), 'MobileInfoSheet:menu'));
  assert.match(collectStrings(root()).join('\n'), /术法尚未就绪/);
  emitTouch(findNode(root(), 'MobileSheetAction:combat.action:art'), 918);
  assert.equal(calls.length, beforeUnavailable, 'disabled combat skills are inspectable but never executable');
  emitTouch(findNode(root(), 'MobileSheetClose'), 919);
  view.render(battle, { ...chrome, activityMessage: '规则拒绝：combat.action:attack' }, EXPLORE_INSETS_390);
  assert.equal(labelComponent(findNode(root(), 'WalkFeedback')).string,
    '当前行动不可执行 · 进度未改变', 'walking keeps the public rule-rejection message');
  advance(300);
  assert.equal(labelComponent(findNode(root(), 'WalkFeedback')).color.channels[3], 255,
    'action failures remain readable rather than fading like combat damage');
  view.render(battle, { ...chrome, activityMessage: 'combat.action:attack 失败：private-storage-details' }, EXPLORE_INSETS_390);
  assert.equal(labelComponent(findNode(root(), 'WalkFeedback')).string,
    '行动失败 · 请稍后重试', 'walking sanitizes raw action failures');
  assert.ok(!collectStrings(root()).join('\n').includes('private-storage-details'));
  assert.equal(labelComponent(findNode(root(), 'WalkDamage')).string, '', 'failure does not replay old damage numbers');
  view.render(resultModel(), chrome, EXPLORE_INSETS_320);
  assertDarkResultUi(root(), EXPLORE_INSETS_320);
  const beforePending = calls.length;
  emitTouch(findNode(root(), 'WorldAction:result.return-hub'), 906);
  assert.equal(calls.length, beforePending, 'pending archive still gates returning home');
  assert.equal(view.walkScene, undefined);
  view.render(model, chrome, EXPLORE_INSETS_320);
  const moving = view.walkScene;
  key(87, true);
  view.destroy();
  const destroyedPosition = moving.getPosition();
  moving.tick(1, { x: 0, y: -1 });
  assert.deepEqual(moving.getPosition(), destroyedPosition);
  assert.ok(atlas.frames.every((frame) => frame.destroyCalls === 1), 'all animation frames released exactly once');
  assert.equal(atlas.frame.destroyCalls, 1, 'source atlas frame released exactly once');
  assert.equal(atlas.texture.destroyCalls, 1, 'atlas texture released only once');
  assert.equal((globalThis.__walkingTestInput.listeners.get('key-down') ?? []).length, 0, 'no global input listener survives destroy');
}

// Equipment is permanent at claim time. Real View callbacks must use the chosen
// original action exactly once, then allow manual wearing from the same run bag.
const beforeEquipmentFrameSize = globalThis.__walkingTestFrameSize;
for (const viewportWidth of [320, 390]) {
  globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportWidth === 320 ? 568 : 844 };
  const entered = reduceGameCommand(createInitialState(), {
    type: 'run/enter', dungeonId: DUNGEON_ORDER[0], protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
  });
  assert.equal(entered.status, 'committed', 'permanent equipment UI lifecycle enters a real run');
  let state = { ...entered.state, run: { ...entered.state.run, pendingEquipmentOffer: {
    offerId: `permanent-equipment-view-${viewportWidth}`, equipmentIds: ['mist_hood', 'spirit_robe', 'bone_spear'],
  } } };
  let model = buildActualGameViewModel(state, {});
  const originalEquipped = { ...state.equipped };
  const calls = [];
  const canvas = { name: `permanent-equipment-${viewportWidth}`, children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
  const insets = viewportWidth === 320 ? EXPLORE_INSETS_320 : EXPLORE_INSETS_390;
  const chrome = { modeKind: 'preview', modeLabel: '', modeDetail: '' };
  const root = () => canvas.children.at(-1);
  let completeClaim;
  const view = new SceneFixtureView(canvas, {
    activate(physicalId, actionId, event) {
      calls.push({ physicalId, actionId, event });
      assert.equal(event.kind, 'command', 'equipment UI dispatches a real domain command');
      const commit = () => {
        const result = reduceGameCommand(state, event.command);
        assert.equal(result.status, 'committed', `equipment UI ${event.command.type} commits`);
        state = result.state;
        model = buildActualGameViewModel(state, {});
        view.render(model, chrome, insets);
      };
      if (event.command.type === 'node/resolve-equipment-loot') {
        assert.equal(completeClaim, undefined, 'only one equipment claim can be in flight');
        completeClaim = () => {
          completeClaim = undefined;
          delete chrome.busyActionId;
          commit();
        };
        chrome.busyActionId = actionId;
        view.render(model, chrome, insets);
      } else commit();
    },
  });
  view.render(model, chrome, insets);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'a new equipment offer automatically opens its choice sheet');
  const options = model.sections[1].detail.pending.equipmentOptions;
  assert.equal(collectNodes(root(), node => node.name.startsWith('MobileSheetEquipmentOffer:')).length, 3,
    `${viewportWidth}px: real View shows all three claim candidates together`);
  assert.equal(labelComponent(findNode(root(), 'MobileSheetTitle')).string, '选择一件装备');
  assert.equal(labelComponent(findNode(root(), 'EquipmentOfferKicker')).string, '精英战利品 · 3 选 1');
  assert.equal(collectNodes(root(), node => node.name === 'MobileSheetEquipmentClaim').length, 1,
    'equipment choice has exactly one claim control');
  assert.ok(collectStrings(findNode(root(), 'MobileSheetEquipmentClaim')).includes('收入背包'));
  const retiredFirstCard = findNode(root(), `MobileSheetEquipmentOffer:${options[0].equipmentId}`);
  const retiredInitialClaim = findNode(root(), 'MobileSheetEquipmentClaim');
  const beforeSelection = JSON.stringify(state);
  for (const [index, optionIndex] of [0, 1, 2, 0, 2, 1].entries()) {
    const option = options[optionIndex];
    emitTouch(findNode(root(), `MobileSheetEquipmentOffer:${option.equipmentId}`), 12000 + viewportWidth + index);
    assert.equal(view.mobileSheet.selectedActionId, option.actionId, 'every candidate switches only the local selection');
    assert.equal(labelComponent(findNode(root(), 'EquipmentOfferDetailName')).string, option.name);
    assert.equal(collectNodes(root(), node => node.name === 'EquipmentOfferSelected').length, 1);
    assert.equal(calls.length, 0, 'switching across all three cards never dispatches a command');
    assert.equal(JSON.stringify(state), beforeSelection, 'candidate inspection preserves the domain state');
  }
  const selectedActionId = view.mobileSheet.selectedActionId;
  emitTouch(retiredFirstCard, 12100 + viewportWidth);
  emitTouch(retiredInitialClaim, 12200 + viewportWidth);
  assert.equal(calls.length, 0, 'selection refresh retires prior card and claim callbacks');
  assert.equal(view.mobileSheet.selectedActionId, selectedActionId, 'retired candidate cannot replace the current selection');
  emitTouch(findNode(root(), 'MobileSheetClose'), 12210 + viewportWidth);
  assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'X dismisses the current equipment offer');
  view.render(model, chrome, insets);
  assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'the same offer does not immediately reopen after X');
  const originalTarget = buildWalkWorld(model).targets.find(entry => entry.id === `node:${state.run.currentNodeId}`);
  const target = walkTowardRenderedTarget(view, root(), originalTarget.id, originalTarget.radius);
  const nearbyPosition = view.walkScene.getPosition();
  assert.ok(Math.hypot(nearbyPosition.x - target.x, nearbyPosition.y - target.y) <= originalTarget.radius,
    'real walking reaches the current equipment interaction radius');
  emitTouch(findNode(root(), 'WalkInteract'), 12220 + viewportWidth);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'WalkInteract deliberately reopens the closed offer');
  assert.equal(view.mobileSheet.selectedActionId, selectedActionId, 'reopening the same offer preserves its chosen candidate');
  const beforeOfferReplacement = findNode(root(), 'MobileSheetEquipmentClaim');
  state = { ...state, run: { ...state.run, pendingEquipmentOffer: {
    ...state.run.pendingEquipmentOffer, offerId: `replacement-equipment-view-${viewportWidth}`,
  } } };
  model = buildActualGameViewModel(state, {});
  view.render(model, chrome, insets);
  assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'a replacement offer automatically opens its fresh choice');
  assert.notEqual(view.mobileSheet.selectedActionId, selectedActionId, 'a new offer cannot reuse the previous offer selection');
  assert.equal(view.mobileSheet.selectedActionId, undefined, 'a replacement offer waits for its own explicit candidate selection');
  assert.equal(findNode(root(), 'EquipmentOfferDetailName'), undefined, 'an unselected replacement never previews an implicit choice');
  assert.equal(findNode(root(), 'MobileSheetEquipmentClaim').listeners.size, 0, 'an unselected replacement has no claim binding');
  emitTouch(beforeOfferReplacement, 12230 + viewportWidth);
  assert.equal(calls.length, 0, 'a replaced offer cannot dispatch its retired claim');
  emitTouch(findNode(root(), 'MobileSheetEquipmentOffer:spirit_robe'), 12240 + viewportWidth);
  const claim = model.sections[2].actions.find(action => action.actionId === view.mobileSheet.selectedActionId);
  assert.equal(claim.event.command.equipmentId, 'spirit_robe', 'selected card determines its original claim command');
  const priorBlockedClaim = findNode(root(), 'MobileSheetEquipmentClaim');
  view.render(model, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }, insets);
  assert.ok(findNode(root(), 'RuntimeBlockedOverlay'), 'blocked mode replaces the sheet with its existing blocking overlay');
  emitTouch(priorBlockedClaim, 12350 + viewportWidth);
  assert.equal(calls.length, 0, 'blocked real View cannot claim equipment');
  view.render(model, chrome, insets);
  const claimNode = findNode(root(), 'MobileSheetEquipmentClaim');
  const avatar = view.walkScene.getPosition();
  const claimTouchId = 12400 + viewportWidth;
  emitTouch(claimNode, claimTouchId);
  claimNode.emit('touch-end', { getID: () => claimTouchId, propagationStopped: false });
  assert.equal(calls.length, 1, 'duplicate touch-end makes one real equipment claim');
  assert.equal(calls[0].event, claim.event, 'real View dispatches the selected original claim event');
  assert.equal(typeof completeClaim, 'function', 'claim stays pending until its asynchronous completion');
  assert.ok(!state.ownedEquipment.includes('spirit_robe'), 'in-flight dispatch does not optimistically grant equipment');
  assert.ok(state.run.pendingEquipmentOffer, 'in-flight dispatch preserves the unresolved offer');
  assert.ok(collectStrings(findNode(root(), 'MobileSheetEquipmentClaim')).includes('正在收入背包'));
  const inFlightSelection = view.mobileSheet.selectedActionId;
  for (const [index, node] of [
    ...model.sections[1].detail.pending.equipmentOptions.map(option => findNode(root(), `MobileSheetEquipmentOffer:${option.equipmentId}`)),
    findNode(root(), 'MobileSheetClose'), findNode(root(), 'MobileSheetEquipmentClaim'),
    findNode(root(), 'MobileSheetBackdrop'), findNode(root(), 'SceneDetails'), findNode(root(), 'WalkInteract'),
  ].entries()) {
    emitTouch(node, 12420 + viewportWidth + index);
    assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'busy card/X/CTA/outside touches cannot dismiss the offer');
    assert.equal(view.mobileSheet.selectedActionId, inFlightSelection, 'busy touches cannot change the selected candidate');
    assert.equal(calls.length, 1, 'busy touches cannot dispatch a second command');
  }
  completeClaim();
  assert.ok(state.ownedEquipment.includes('spirit_robe'), 'claim immediately creates permanent ownership');
  assert.deepEqual(state.equipped, originalEquipped, 'claim leaves wearing under player control');
  assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'resolved equipment offer closes its interaction sheet');
  assert.equal(collectNodes(root(), node => node.name.startsWith('MobileInfoSheet:')).length, 0,
    'successful claim returns directly to exploration without an inventory or result modal');
  assert.equal(view.mobileSheet, undefined, 'a resolved offer leaves no cached interaction state');
  assert.equal(view.equipmentOfferSelection, undefined, 'pending disappearance clears the candidate selection cache');
  assert.deepEqual(view.walkScene.getPosition(), avatar, 'claim preserves exploration position');
  assert.equal(labelComponent(findNode(root(), 'WalkFeedback')).string, '已收入背包 · 灵纹软甲');
  const permanentlyOwned = [...state.ownedEquipment];
  const permanentLevels = { ...state.equipmentLevels };
  emitTouch(claimNode, 12500 + viewportWidth);
  assert.equal(calls.length, 1, 'resolved claim callback is retired');

  emitTouch(findNode(root(), 'SceneDetails'), 12600 + viewportWidth);
  assert.ok(findNode(root(), 'MobileSheetInventoryRack'), 'opening the existing bag still defaults to its supply grid');
  assert.equal(collectNodes(root(), node => node.name.startsWith('MobileSheetInventoryEquipment:')).length, 0,
    'owned equipment appears only after choosing the existing equipment tab');
  emitTouch(findNode(root(), 'MobileSheetTab:equipment'), 12700 + viewportWidth);
  emitTouch(findNode(root(), 'MobileSheetInventoryEquipment:spirit_robe'), 12800 + viewportWidth);
  const owned = model.sections[1].loadout.ownedEquipment.find(entry => entry.equipmentId === 'spirit_robe');
  const equipNode = findNode(root(), 'MobileSheetTipEquip:spirit_robe');
  assert.ok(equipNode, 'the just-acquired item has an immediate wearing control in exploration');
  const beforeHp = state.player.hp;
  const equipTouchId = 12900 + viewportWidth;
  emitTouch(equipNode, equipTouchId);
  equipNode.emit('touch-end', { getID: () => equipTouchId, propagationStopped: false });
  assert.equal(calls.length, 2, 'duplicate touch-end makes one manual equipment command');
  assert.equal(calls[1].event, owned.equipAction.event, 'real inventory tooltip dispatches its exact projected wearing event');
  assert.equal(state.equipped.armor, 'spirit_robe', 'the exploration command wears the just-claimed equipment');
  assert.equal(state.player.hp, beforeHp, 'manual wearing never heals the player');
  assert.deepEqual(state.ownedEquipment, permanentlyOwned, 'manual wearing preserves every permanently owned item');
  assert.deepEqual(state.equipmentLevels, permanentLevels, 'manual wearing preserves every equipment level');
  emitTouch(equipNode, 13000 + viewportWidth);
  assert.equal(calls.length, 2, 'rendering the newly worn item retires its old wearing callback');
  const equippedButton = findNode(root(), 'MobileSheetTipEquip:spirit_robe');
  assert.ok(collectStrings(equippedButton).includes('已装备'), 'a worn owned item explains its disabled wearing command');
  emitTouch(equippedButton, 13050 + viewportWidth);
  assert.equal(calls.length, 2, 'the worn item cannot dispatch another wearing command');
  emitTouch(findNode(root(), 'MobileSheetTipClose'), 13100 + viewportWidth);
  emitTouch(findNode(root(), `MobileSheetInventoryEquipment:${originalEquipped.armor}`), 13200 + viewportWidth);
  for (const runtime of [{ ...chrome, busyActionId: 'inventory-equipment' }, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }]) {
    const priorEquip = findNode(root(), `MobileSheetTipEquip:${originalEquipped.armor}`);
    view.render(model, runtime, insets);
    const locked = findNode(root(), `MobileSheetTipEquip:${originalEquipped.armor}`);
    if (locked) emitTouch(locked, 13300 + viewportWidth);
    else assert.ok(findNode(root(), 'RuntimeBlockedOverlay'), 'blocked mode retains its blocking overlay');
    emitTouch(priorEquip, 13350 + viewportWidth);
    assert.equal(calls.length, 2, 'busy/blocked real View cannot switch the owned equipment');
  }
  view.render(model, chrome, insets);
  const originalArmor = model.sections[1].loadout.ownedEquipment.find(entry => entry.equipmentId === originalEquipped.armor);
  const switchBack = findNode(root(), `MobileSheetTipEquip:${originalEquipped.armor}`);
  const switchBackTouchId = 13400 + viewportWidth;
  emitTouch(switchBack, switchBackTouchId);
  switchBack.emit('touch-end', { getID: () => switchBackTouchId, propagationStopped: false });
  assert.equal(calls.length, 3, 'switching back from the same inventory makes one manual wearing command');
  assert.equal(calls[2].event, originalArmor.equipAction.event, 'switching back dispatches the original armor wearing event');
  assert.deepEqual(state.equipped, originalEquipped, 'the player can switch back to the original armor');
  assert.deepEqual(state.ownedEquipment, permanentlyOwned, 'switching back retains the complete owned equipment collection');
  assert.deepEqual(state.equipmentLevels, permanentLevels, 'switching back retains every equipment level');
  assert.ok(findNode(root(), 'MobileInfoSheet:inventory'), 'wearing changes stay in the same inventory sheet');
  emitTouch(findNode(root(), 'MobileSheetTipClose'), 13500 + viewportWidth);
  emitTouch(findNode(root(), 'MobileSheetInventoryEquipment:spirit_robe'), 13600 + viewportWidth);
  assert.ok(findNode(root(), 'MobileSheetTipEquip:spirit_robe'), 'the replaced acquired armor remains readable and wearable');
  const replacedArmorTip = collectStrings(findNode(root(), 'MobileSheetTip')).join('').replace(/\s+/gu, '');
  assert.ok(replacedArmorTip.includes(owned.baseStatsReadout.replace(/\s+/gu, '')),
    'the replaced armor still shows its actual owned stats across wrapped tooltip lines');
  assert.equal(calls.length, 3, 'reading the replaced armor issues no additional command');
  view.destroy();
}
globalThis.__walkingTestFrameSize = beforeEquipmentFrameSize;

// Reward collection and its optional relic draft share one interaction surface.
// Real commands generate 1/2/3 candidates; local card selection never grants them.
const beforeRewardFrameSize = globalThis.__walkingTestFrameSize;
for (const viewportWidth of [320, 390]) {
  globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportWidth === 320 ? 568 : 844 };
  for (const candidateCount of [1, 2, 3, 0]) {
    const initial = createInitialState();
    const hub = { ...initial, preparedRelicFrame: 'assault', ...(candidateCount === 3 ? {
      ownedEquipment: [...initial.ownedEquipment, 'armor_piercing_sword'],
      equipmentLevels: { ...initial.equipmentLevels, armor_piercing_sword: 2 },
      equipped: { ...initial.equipped, weapon: 'armor_piercing_sword' },
    } : {}) };
    const entered = reduceGameCommand(hub, {
      type: 'run/enter', dungeonId: 'demon_tower_1', protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_abcd },
    });
    assert.equal(entered.status, 'committed', 'reward lifecycle enters a real run');
    if (candidateCount === 3) assert.ok(entered.state.run.relicConduitSourceEquipmentIds.includes('armor_piercing_sword'),
      'real entry freezes the matching Lv2 weapon conduit for three candidates');
    const nodeId = candidateCount === 0 ? 'north_supply_niche' : 'watch_post_cache';
    let state = { ...entered.state, run: { ...entered.state.run, currentNodeId: nodeId, relicState: {
      ...entered.state.run.relicState,
      acquiredIds: candidateCount === 1 ? ['focus_prism', 'hunter_clock'] : candidateCount === 2 ? ['hunter_clock'] : [],
    } } };
    let model = buildActualGameViewModel(state, {});
    const chrome = { modeKind: 'preview', modeLabel: '', modeDetail: '' };
    const insets = viewportWidth === 320 ? EXPLORE_INSETS_320 : EXPLORE_INSETS_390;
    const canvas = { name: `reward-relic-${viewportWidth}-${candidateCount}`, children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
    const root = () => canvas.children.at(-1);
    const calls = [];
    let completeCommand;
    const view = new SceneFixtureView(canvas, {
      activate(physicalId, actionId, event) {
        assert.equal(event.kind, 'command', 'reward lifecycle dispatches its original domain command');
        assert.ok(['node/collect-reward', 'node/resolve-relic-draft'].includes(event.command.type));
        assert.equal(completeCommand, undefined, 'only one reward lifecycle command can be in flight');
        calls.push({ physicalId, actionId, event });
        completeCommand = () => {
          completeCommand = undefined;
          delete chrome.busyActionId;
          const snapshot = JSON.stringify(state);
          const result = reduceGameCommand(state, event.command);
          assert.equal(result.status, 'committed', `${event.command.type} commits through the real reducer`);
          assert.equal(JSON.stringify(state), snapshot, 'the command preserves its input fixture');
          state = result.state;
          model = buildActualGameViewModel(state, {});
          supplySceneVisualFixtures(view, model);
          view.render(model, chrome, insets);
        };
        chrome.busyActionId = actionId;
        view.render(model, chrome, insets);
      },
    });
    const touchBase = 14000 + viewportWidth + candidateCount * 100;
    const assertBusyLocks = (nodeNames, expectedCalls) => {
      const selectedActionId = view.mobileSheet.selectedActionId;
      const snapshot = JSON.stringify(state);
      for (const [index, name] of [...nodeNames, 'MobileSheetClose', 'MobileSheetBackdrop', 'SceneDetails', 'WalkInteract'].entries()) {
        const target = findNode(root(), name);
        assert.ok(target, `${name}: busy fixture retains the actual control`);
        emitTouch(target, touchBase + 40 + index);
        assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'busy reward/relic controls cannot close the interaction');
        assert.equal(view.mobileSheet.selectedActionId, selectedActionId, 'busy controls cannot change the local choice');
        assert.equal(calls.length, expectedCalls, 'busy controls cannot submit a duplicate reward or relic command');
        assert.equal(JSON.stringify(state), snapshot, 'busy controls leave all authoritative rewards and candidates unchanged');
      }
    };
    supplySceneVisualFixtures(view, model);
    view.render(model, chrome, insets);
    const originalTarget = buildWalkWorld(model).targets.find(entry => entry.id === `node:${nodeId}`);
    const target = walkTowardRenderedTarget(view, root(), originalTarget.id, originalTarget.radius);
    const avatar = view.walkScene.getPosition();
    assert.ok(Math.hypot(avatar.x - target.x, avatar.y - target.y) <= originalTarget.radius,
      'real walking approaches the reward before opening its interaction');
    emitTouch(findNode(root(), 'WalkInteract'), touchBase);
    assert.ok(findNode(root(), 'MobileInfoSheet:interaction'));
    assert.ok(findNode(root(), 'MobileSheetRoomArtFigure') && labelComponent(findNode(root(), 'MobileSheetKicker')).string
      === (nodeId === 'north_supply_niche' ? '补给' : '宝箱'), 'the reward opens directly as the room sheet with its chest and actual contents');
    assert.equal(collectNodes(root(), node => node.name.startsWith('MobileSheetExecute:')).length, 0,
      'reward collection omits the old generic action confirmation step');
    const preview = model.sections[1].detail.rewardPreview;
    assert.equal(preview.nodeId, nodeId);
    const rewardAction = model.sections[2].actions.find(action => action.actionId === preview.actionId);
    const blockedRewardClaim = findNode(root(), 'MobileSheetRewardClaim');
    const blockedRewardSnapshot = JSON.stringify(state);
    view.render(model, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }, insets);
    assert.ok(findNode(root(), 'RuntimeBlockedOverlay'));
    emitTouch(blockedRewardClaim, touchBase + 4);
    assert.equal(calls.length, 0, 'blocked mode retires the previous reward claim callback');
    assert.equal(JSON.stringify(state), blockedRewardSnapshot, 'a blocked reward claim preserves the uncollected node');
    view.render(model, chrome, insets);
    const rewardClaim = findNode(root(), 'MobileSheetRewardClaim');
    assert.equal(collectNodes(root(), node => node.name === 'MobileSheetRewardClaim').length, 1);
    assert.ok(collectStrings(rewardClaim).includes('领取奖励'));
    for (const entry of preview.items) {
      const card = findNode(root(), `MobileSheetRewardItem:${entry.itemId}`);
      assert.ok(card, 'reward contents come from the actual immutable-transition preview');
      assert.ok(findNode(card, `RewardItemIcon:${entry.itemId}`));
      assert.equal(labelComponent(findNode(card, 'RewardItemValue')).string, `×${entry.count}`);
    }
    const beforeReward = { rewardPoints: state.rewardPoints, lingyun: state.lingyun, inventory: { ...state.inventory }, hp: state.player.hp };
    emitTouch(rewardClaim, touchBase + 1);
    rewardClaim.emit('touch-end', { getID: () => touchBase + 1, propagationStopped: false });
    assert.equal(calls.length, 1, 'duplicate reward touch-end dispatches one collection');
    assert.equal(calls[0].event, rewardAction.event, 'reward CTA uses its exact projected collection event');
    assert.equal(state.rewardPoints, beforeReward.rewardPoints, 'in-flight collection does not optimistically grant currency');
    assert.ok(!state.run.clearedNodeIds.includes(nodeId), 'in-flight collection leaves the node unclaimed');
    assert.ok(collectStrings(findNode(root(), 'MobileSheetRewardClaim')).includes('正在领取'));
    assertBusyLocks(['MobileSheetRewardClaim', ...preview.items.map(entry => `MobileSheetRewardItem:${entry.itemId}`)], 1);
    completeCommand();
    assert.ok(state.run.clearedNodeIds.includes(nodeId), 'the real collection clears the reward node');
    assert.equal(state.rewardPoints, beforeReward.rewardPoints + preview.rewardPoints);
    assert.equal(state.lingyun, beforeReward.lingyun + preview.lingyun);
    assert.equal(state.player.hp, beforeReward.hp + preview.healing);
    for (const entry of preview.items) assert.equal(state.inventory[entry.itemId], (beforeReward.inventory[entry.itemId] ?? 0) + entry.count);
    emitTouch(rewardClaim, touchBase + 2);
    assert.equal(calls.length, 1, 'the resolved reward callback cannot collect the node twice');
    if (candidateCount === 0) {
      assert.equal(state.run.relicState.pendingDraft, undefined, 'an ordinary reward generates no relic draft');
      assert.equal(collectNodes(root(), node => node.name.startsWith('MobileInfoSheet:')).length, 0,
        'an ordinary reward closes directly to exploration without a second modal');
      assert.deepEqual(view.walkScene.getPosition(), avatar);
      view.destroy();
      continue;
    }
    const draft = state.run.relicState.pendingDraft;
    const choices = model.sections[1].detail.pending.relicOptions;
    assert.equal(choices.length, candidateCount, `${viewportWidth}px: core generates ${candidateCount} actual candidates`);
    assert.deepEqual(choices.map(choice => choice.relicId), draft.candidateIds, 'the UI preserves the actual draft candidate order');
    assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'collection continues in the same interaction kind for its relic choice');
    assert.equal(findNode(root(), 'MobileSheetRewardClaim'), undefined, 'the collected reward cannot be submitted from the relic step');
    assert.equal(labelComponent(findNode(root(), 'MobileSheetTitle')).string, '选择一份回响');
    assert.equal(labelComponent(findNode(root(), 'RelicDraftReceiptState')).string, '✓ 物资已领取');
    const receipt = labelComponent(findNode(root(), 'RelicDraftReceiptValues')).string.replace(/\s+/gu, '');
    assert.ok(receipt.includes(`奖励点+${preview.rewardPoints}`));
    for (const entry of preview.items) assert.ok(receipt.includes(`${entry.name}×${entry.count}`.replace(/\s+/gu, '')));
    const initialRelicClaim = findNode(root(), 'MobileSheetRelicClaim');
    assert.ok(collectStrings(initialRelicClaim).includes('请选择一份回响'));
    emitTouch(initialRelicClaim, touchBase + 3);
    assert.equal(calls.length, 1, 'a fresh relic draft requires an explicit local choice before submitting');
    const beforeRelic = JSON.stringify(state);
    for (const [index, choice] of choices.entries()) {
      const card = findNode(root(), `MobileSheetRelicOffer:${choice.relicId}`);
      assert.ok(findNode(card, `RelicOfferIcon:${choice.relicId}`));
      assert.equal(labelComponent(findNode(card, 'RelicOfferName')).string.replace(/\s+/gu, ''), choice.name.replace(/\s+/gu, ''));
      assert.equal(labelComponent(findNode(card, 'RelicOfferEffect')).string.replace(/\s+/gu, ''), choice.description.replace(/\s+/gu, ''));
      emitTouch(card, touchBase + 10 + index);
      assert.equal(view.mobileSheet.selectedActionId, choice.actionId, 'relic cards switch only the local selection');
      assert.equal(calls.length, 1);
      assert.equal(JSON.stringify(state), beforeRelic, 'reading candidates does not acquire or activate a relic');
    }
    const selected = choices.find(choice => choice.relicId === 'mist_edge');
    assert.ok(selected, 'the real candidate-pool fixture leaves mist edge available');
    emitTouch(findNode(root(), 'MobileSheetRelicOffer:mist_edge'), touchBase + 20);
    assert.equal(collectNodes(root(), node => node.name === 'RelicOfferSelected').length, 1);
    assert.ok(collectStrings(findNode(root(), 'MobileSheetRelicClaim')).includes(`获得${selected.name}`));
    emitTouch(findNode(root(), 'MobileSheetClose'), touchBase + 21);
    assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'closing an unresolved relic draft returns to exploration');
    assert.equal(JSON.stringify(state), beforeRelic, 'closing cannot skip, collect again or choose a relic');
    view.render(model, chrome, insets);
    assert.equal(findNode(root(), 'MobileInfoSheet:interaction'), undefined, 'the same closed draft does not immediately reopen');
    emitTouch(findNode(root(), 'WalkInteract'), touchBase + 22);
    assert.ok(findNode(root(), 'MobileInfoSheet:interaction'), 'nearby interaction reopens the actual unresolved draft');
    assert.equal(view.mobileSheet.selectedActionId, selected.actionId, 'reopening preserves the selected actual candidate');
    assert.equal(calls.length, 1, 'closing and reopening the relic choice never submits a domain command');
    const relicAction = model.sections[2].actions.find(action => action.actionId === selected.actionId);
    const blockedRelicClaim = findNode(root(), 'MobileSheetRelicClaim');
    const blockedRelicCard = findNode(root(), `MobileSheetRelicOffer:${choices.at(-1).relicId}`);
    view.render(model, { ...chrome, modeKind: 'blocked', blockingMessage: 'storage unavailable' }, insets);
    assert.ok(findNode(root(), 'RuntimeBlockedOverlay'));
    emitTouch(blockedRelicClaim, touchBase + 25);
    emitTouch(blockedRelicCard, touchBase + 26);
    assert.equal(calls.length, 1, 'blocked mode retires previous relic claim and card callbacks');
    assert.equal(view.mobileSheet.selectedActionId, selected.actionId, 'blocked card callbacks cannot change the cached choice');
    assert.equal(JSON.stringify(state), beforeRelic, 'blocked callbacks preserve the unresolved draft and collected rewards');
    view.render(model, chrome, insets);
    const relicClaim = findNode(root(), 'MobileSheetRelicClaim');
    const statsBefore = getDerivedStats(state);
    const inventoryBefore = { ...state.inventory };
    const currencyBefore = state.rewardPoints;
    const acquiredBefore = [...state.run.relicState.acquiredIds];
    emitTouch(relicClaim, touchBase + 23);
    relicClaim.emit('touch-end', { getID: () => touchBase + 23, propagationStopped: false });
    assert.equal(calls.length, 2, 'duplicate relic touch-end submits one selection');
    assert.equal(calls[1].event, relicAction.event, 'relic CTA uses its original draftId/relicId event');
    assert.ok(!state.run.relicState.acquiredIds.includes('mist_edge'), 'in-flight selection does not optimistically activate the relic');
    assert.ok(collectStrings(findNode(root(), 'MobileSheetRelicClaim')).includes('正在获得'));
    assertBusyLocks(['MobileSheetRelicClaim', ...choices.map(choice => `MobileSheetRelicOffer:${choice.relicId}`)], 2);
    completeCommand();
    assert.equal(state.run.relicState.pendingDraft, undefined, 'the real selection resolves the blocking draft');
    assert.deepEqual(state.run.relicState.acquiredIds, [...acquiredBefore, 'mist_edge']);
    assert.equal(getDerivedStats(state).attack, statsBefore.attack + 6, 'the acquired mist edge activates its actual attack effect');
    assert.equal(getDerivedStats(state).artPower, statsBefore.artPower + 4, 'the acquired mist edge activates its actual art effect');
    assert.deepEqual(model.sections[1].loadout.runRelics.map(relic => relic.relicId), state.run.relicState.acquiredIds,
      'the run inventory exposes the complete acquired-only relic list');
    assert.ok(findNode(root(), 'WalkRunRelics'), 'a resolved relic appears on the active run HUD');
    assert.equal(collectNodes(root(), node => node.name.startsWith('MobileInfoSheet:')).length, 0,
      'relic acquisition closes directly to exploration without a second result modal');
    assert.equal(labelComponent(findNode(root(), 'WalkFeedback')).string, `${selected.name} · 本局生效`,
      'resolved relic feedback names the acquired choice and its active run scope');
    assert.equal(state.rewardPoints, currencyBefore, 'relic selection cannot collect the reward a second time');
    assert.deepEqual(state.inventory, inventoryBefore, 'relic selection does not duplicate the collected materials');
    assert.deepEqual(view.walkScene.getPosition(), avatar);
    emitTouch(relicClaim, touchBase + 24);
    assert.equal(calls.length, 2, 'a resolved draft retires its selection callback');
    view.destroy();
  }
}
globalThis.__walkingTestFrameSize = beforeRewardFrameSize;

// The real View renders every chapter as a dedicated environment, not a differently
// labelled copy of the hub. These are projection fixtures, not chapter completion evidence.
{
  const initialState = createInitialState();
  const preparedHub = {
    ...initialState,
    rewardPoints: 50_000,
    lingyun: 500,
    inventory: Object.fromEntries(Object.keys(initialState.inventory).map((itemId) => [itemId, 50])),
    completedDungeonIds: [...DUNGEON_ORDER],
  };
  const expectedExploreObstacles = [
    { x: 0, y: 0, width: 1000, height: 40 },
    { x: 0, y: 960, width: 1000, height: 40 },
    { x: 0, y: 40, width: 40, height: 920 },
    { x: 960, y: 40, width: 40, height: 920 },
  ];
  const expectedCombatObstacles = [
    { x: 0, y: 0, width: 1280, height: 40 },
    { x: 0, y: 960, width: 1280, height: 40 },
    { x: 0, y: 40, width: 40, height: 920 },
    { x: 1240, y: 40, width: 40, height: 920 },
  ];
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const spriteComponent = (node) => [...node.components.values()].find((component) => 'spriteFrame' in component);
  const assertNoHubDecor = (root) => {
    assert.equal(collectNodes(root, ({ name }) => /^(WalkStoneFloor|WalkFloorMotif:|WalkChapterProp:|WalkWall:|WalkBrazier:)/.test(name)).length, 0,
      'a dungeon must not paint the old hall, central emblem, icon pillars or braziers over its environment');
  };
  const assertNoBoundaryFills = (root, spec) => {
    for (const [index, obstacle] of spec.obstacles.entries()) {
      if (obstacle.width <= 140 && obstacle.height <= 140) continue;
      const footprint = findNode(root, `WalkObstacleFootprint:${index}`);
      assert.ok(footprint, 'world boundary keeps its original collision/depth node');
      const graphics = footprint.getComponent(TestGraphics);
      assert.ok(!graphics || graphics.fills.length === 0, 'world boundary collisions must not paint dark bands over the full-screen environment');
    }
  };
  const assertDungeonTextBackings = (root) => {
    const assertBacking = (backing, label) => {
      assert.ok(backing, `${label.name}: bright chapter environments need a readable backing`);
      assert.ok(hasComponentNamed(backing, 'Graphics'));
      assert.deepEqual({ ...backing.position }, { ...label.position }, `${label.name}: the backing follows the original label anchor`);
      assert.deepEqual({ ...backing.size }, { ...label.size });
      assert.equal(backing.parent, label.parent);
      assert.ok(backing.parent.children.indexOf(backing) < backing.parent.children.indexOf(label), 'backing is below its label, not over the text');
      const graphics = [...backing.components.values()].find((component) => component.fillColor?.channels !== undefined);
      assert.deepEqual(graphics.fillColor.channels.slice(0, 3), [16, 13, 10]);
      assert.ok(graphics.fillColor.channels[3] >= 200, 'backing opacity remains sufficient on light floors');
    };
    const labels = collectNodes(root, ({ name }) => name === 'WalkTargetName');
    if (findNode(root, 'WalkEnemyCard') !== undefined) {
      // Combat v2: closed doors leave the duel stage and the enemy card carries the name.
      assert.equal(labels.length, 0, 'the duel stage paints no world name plates');
      assert.ok(labelComponent(findNode(root, 'WalkEnemyName')).string.length > 0, 'the enemy card names the opponent');
      return;
    }
    assert.ok(labels.length > 0, 'chapter fixture contains at least one named world target');
    assert.equal(collectNodes(root, ({ name }) => name === 'WalkTargetNameBacking').length, labels.length);
    for (const label of labels) {
      assert.ok(label.position.x === 0 && label.position.y < 0,
        'HTML object names remain centered below their rendered target feet');
      assertBacking(findNode(label.parent, 'WalkTargetNameBacking'), label);
    }
    assert.equal(findNode(root, 'WalkInteractionHint'), undefined, 'dungeon controls omit the movement and nearby-interaction tip');
    assert.equal(findNode(root, 'WalkInteractionHintBacking'), undefined, 'the removed dungeon tip leaves no empty backing');
  };
  const assertBackground = (root, key, source, frame, width, height) => {
    const window = findNode(root, `WalkDungeonBackdropWindow:${key}`);
    const backdrop = findNode(root, `WalkDungeonBackdrop:${key}`);
    assert.ok(window, `${key}: world clipping window exists`);
    assert.ok(backdrop, `${key}: dedicated environment sprite exists`);
    assert.ok(hasComponentNamed(window, 'Mask'), `${key}: excess cover artwork must be clipped`);
    assert.equal(window.parent, findNode(root, 'WalkScene'), `${key}: artwork covers the screen independently of the fixed world camera`);
    assert.notEqual(findNode(root, 'WalkPlayer').parent.parent, window.parent,
      `${key}: the actor projection cannot resize or move the environment`);
    const scene = findNode(root, 'WalkScene');
    const { width: backgroundWidth, height: backgroundHeight } = window.size;
    assert.deepEqual({ ...window.size }, { width: 750, height: scene.size.height },
      `${key}: the cover window spans HUD, room and bottom controls`);
    assert.ok(Math.abs(window.position.x + scene.position.x) < 0.001, `${key}: full background cancels only the scene's safe-area offset`);
    assert.equal(window.position.y, 0);
    assert.equal(window.position.z, 0);
    assert.equal(backdrop.parent, window);
    const scale = Math.max(backgroundWidth / source.width, backgroundHeight / source.height);
    assert.equal(backdrop.size.width, source.width * scale);
    assert.equal(backdrop.size.height, source.height * scale);
    assert.equal(backdrop.size.width / backdrop.size.height, source.width / source.height,
      `${key}: cover does not distort the original image aspect ratio`);
    assert.equal(spriteComponent(backdrop).spriteFrame, frame, `${key}: renderer uses the loaded frame exactly`);
    assert.equal(findNode(root, 'WalkEnvironmentLoading'), undefined, `${key}: a loaded background removes loading status`);
    assert.equal(findNode(root, 'WalkDungeonBackdropPending'), undefined);
    assertWorldImageCoverage(root, key);
    assertNoHubDecor(root);
    return spriteComponent(backdrop);
  };
  const backgroundKeys = new Set();
  assert.equal(DUNGEON_ORDER.length, 19);
  for (const [index, dungeonId] of DUNGEON_ORDER.entries()) {
    const entered = reduceGameCommand(preparedHub, {
      type: 'run/enter', dungeonId, protocolId: 'standard',
      seeds: { rulesVersion: 1, hiddenTaskSeed: 0x12345678 },
    });
    assert.equal(entered.status, 'committed', `${dungeonId}: entry fixture must use the real reducer`);
    const model = buildActualGameViewModel(entered.state, {});
    const snapshot = JSON.stringify(model);
    const key = `scene:dungeon_world_${dungeonId}`;
    backgroundKeys.add(getInfiniteFlowSceneVisualKeys(model).background);
    assert.equal(getInfiniteFlowSceneVisualKeys(model).background, key);
    assert.equal(getInfiniteFlowSceneVisualKeys(model).player, 'character:reincarnator_walk');
    const entryDetail = model.sections[1].detail;
    const entryMonster = entryDetail.currentNode.nodeType === 'monster' && !entryDetail.currentNode.cleared
      && entryDetail.pending === undefined ? entryDetail.currentNode.monsterId : undefined;
    assert.equal(getInfiniteFlowSceneVisualKeys(model).opponent,
      entryMonster === undefined ? undefined : `monster:${entryMonster}_world`,
      `${dungeonId}: the entry room requests only its explicitly visible monster`);
    const spec = buildWalkWorld(model);
    assert.deepEqual(spec.obstacles, expectedExploreObstacles, `${dungeonId}: background replacement cannot move collisions`);
    const canvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; }, addChild(child) { this.children.push(child); child.parent = this; } };
    const view = new SceneInfiniteFlowView(canvas, { activate() { assert.fail('background rendering or walking dispatched a domain command'); } });
    const root = () => canvas.children.at(-1);
    view.setSceneVisualAsset({ width: 720, height: 180 }, { key: `dungeon:${dungeonId}`, revision: 'legacy-fixture' });
    view.render(model, { ...chrome, sceneAssets: 'loading' }, EXPLORE_INSETS_320);
    assertSceneAssetGate(view, root(), 'loading');
    assert.equal(findNode(root(), 'WalkDungeonBackdropPending'), undefined, 'incomplete background uses the single loading surface');
    assert.equal(findNode(root(), `WalkDungeonBackdrop:${key}`), undefined);
    assertNoHubDecor(root());
    const source = [{ width: 1254, height: 1254 }, { width: 720, height: 180 }, { width: 180, height: 720 }][index % 3];
    view.setSceneVisualAsset(source, { key, revision: 'environment-fixture' });
    supplySceneVisualFixtures(view, model);
    const visual = view.sceneVisuals.get(key);
    view.render(model, chrome, EXPLORE_INSETS_320);
    for (const [obstacleIndex, obstacle] of spec.obstacles.entries()) {
      const footprint = findNode(root(), `WalkObstacleFootprint:${obstacleIndex}`);
      assert.ok(footprint, `${dungeonId}: every collision keeps its original world/depth node`);
      assert.deepEqual({ ...footprint.position }, { x: obstacle.x + obstacle.width / 2, y: -(obstacle.y + obstacle.height), z: 0 });
      assert.deepEqual({ ...footprint.size }, { width: obstacle.width, height: obstacle.height + 8 });
    }
    assertNoBoundaryFills(root(), spec);
    globalThis.__walkingTestInput.emit('key-down', { keyCode: 65 });
    for (let frame = 0; frame < 45; frame += 1) view.tick(1 / 60);
    globalThis.__walkingTestInput.emit('key-up', { keyCode: 65 });
    const collisionPosition = view.walkScene.getPosition();
    assert.ok(Math.abs(collisionPosition.x - 170) < 0.01, `${dungeonId}: 45 leftward frames still move 330 original world units`);
    assert.equal(collisionPosition.y, 700);

    view.render(model, chrome, EXPLORE_INSETS_320);
    assert.deepEqual(view.walkScene.getPosition(), collisionPosition, `${dungeonId}: ready-scene refresh cannot teleport the avatar`);
    const firstSprite = assertBackground(root(), key, source, visual.frame, 1000, 1000);
    assertDarkWalkingUi(root(), model, EXPLORE_INSETS_320);
    assertDungeonTextBackings(root());
    assert.ok(view.visualSprites.has(firstSprite), `${dungeonId}: the frame is tracked for safe teardown`);
    assert.equal(JSON.stringify(model), snapshot, `${dungeonId}: image/render operations leave the public VM unchanged`);

    const combat = combatModel(combatChapterContextFixture({ dungeonId, dungeonName: DUNGEONS[dungeonId].name }));
    combat.visualAssetKey = 'monster:fog_lesser_demon';
    assert.equal(getInfiniteFlowSceneVisualKeys(combat).background, key);
    assert.equal(getInfiniteFlowSceneVisualKeys(combat).opponent, `monster:${combat.sections[1].detail.enemy.id}_world`,
      `${dungeonId}: backdrop routing preserves the enemy world identity independently of its portrait`);
    assert.deepEqual(buildWalkWorld(combat).obstacles, expectedCombatObstacles);
    supplySceneVisualFixtures(view, combat);
    view.render(combat, chrome, EXPLORE_INSETS_390);
    assertNoBoundaryFills(root(), buildWalkWorld(combat));
    assert.deepEqual(view.walkScene.getPosition(), { x: 440, y: 700 });
    const combatSprite = assertBackground(root(), key, source, visual.frame, 1280, 1000);
    assertDarkWalkingUi(root(), combat, EXPLORE_INSETS_390);
    assertDungeonTextBackings(root());
    assert.equal(visual.frame.destroyCalls, 0, 'explore/combat reuse the same live background frame');
    view.clearSceneVisualAsset(key);
    assert.equal(combatSprite.spriteFrame, null, 'the live sprite detaches before its frame is disposed');
    assert.equal(view.visualSprites.has(combatSprite), false, 'cleared background sprites leave the tracked set');
    assert.equal(visual.frame.destroyCalls, 1, 'clearing an environment destroys its frame exactly once');
    assert.equal(visual.texture.destroyCalls, 1, 'clearing an environment destroys its texture exactly once');
    view.render(combat, { ...chrome, sceneAssets: 'error' }, EXPLORE_INSETS_390);
    assertSceneAssetGate(view, root(), 'error');
    assert.equal(findNode(root(), 'WalkEnvironmentLoading'), undefined, 'a cleared background cannot restore old per-object drawings');
    assertNoHubDecor(root());
    view.destroy();
    assert.equal(visual.frame.destroyCalls, 1);
  }
  assert.equal(backgroundKeys.size, 19, 'all chapters route to distinct real environment resources');
  const contextlessCombat = combatModel(combatChapterContextFixture());
  contextlessCombat.visualAssetKey = 'monster:fog_lesser_demon';
  delete contextlessCombat.sections[1].detail.chapterContext;
  assert.equal(getInfiniteFlowSceneVisualKeys(contextlessCombat).background, undefined,
    'missing chapter context cannot guess a dungeon from the enemy identity');
  assert.equal(getInfiniteFlowSceneVisualKeys(contextlessCombat).opponent,
    `monster:${contextlessCombat.sections[1].detail.enemy.id}_world`,
    'contextless combat still uses its authoritative monster identity');
  const legacyCanvas = { children: [], getComponent() { return { contentSize: { width: 750, height: 1334 } }; },
    addChild(child) { this.children.push(child); child.parent = this; } };
  const legacyView = new SceneFixtureView(legacyCanvas, { activate() { assert.fail('legacy plain-floor rendering cannot dispatch a command'); } });
  try {
    legacyView.render(contextlessCombat, chrome, EXPLORE_INSETS_320);
    const legacyRoot = legacyCanvas.children.at(-1);
    const floor = findNode(legacyRoot, 'WalkDungeonFloor');
    assert.ok(floor?.getComponent(TestGraphics)?.fills.length > 0, 'legacy combat without a declared environment retains its plain floor');
    assert.equal(collectNodes(legacyRoot, node => node.name.startsWith('WalkDungeonBackdrop:')).length, 0,
      'legacy plain-floor mode does not guess or attach an unrelated chapter image');
    assert.ok(findNode(legacyRoot, 'WalkPlayerBody'), 'legacy contextless combat still publishes the actual player');
  } finally { legacyView.destroy(); }
  const hub = hubModel(hubEntryActionFixtures(false));
  hub.visualAssetKey = 'scene:main_god_space';
  assert.equal(getInfiniteFlowSceneVisualKeys(hub).background, 'scene:hub_courtyard_walk');
  assert.equal(getInfiniteFlowSceneVisualKeys(hub).hubPortal, HUB_PORTAL_FIXTURE.key);
  assert.equal(getInfiniteFlowSceneVisualKeys(contextlessCombat).hubPortal, undefined, 'combat never requests courtyard portal artwork');
  const result = resultModel();
  result.visualAssetKey = 'dungeon:metro_abyss';
  assert.equal(getInfiniteFlowSceneVisualKeys(result).background, result.visualAssetKey,
    'settlement artwork is not silently changed by the walk-world rollout');
  assert.equal(getInfiniteFlowSceneVisualKeys(result).hubPortal, undefined, 'settlement never requests courtyard portal artwork');
}

// Exercise the actual scene tree, background, local target clone and interaction
// binding. Fixtures enter combat through the real reducer without touching a save.
let dungeonRoomFitCases = 0;
let dungeonRoomEffectAnchorCases = 0;
let dungeonCombatHudClearanceCases = 0;
let dungeonHtmlGoldenCases = 0;
let dungeonHtmlInteractionCases = 0;
let dungeonMultiNeighborCases = 0;
{
  const priorFrameSize = globalThis.__walkingTestFrameSize;
  const entered = reduceGameCommand(createInitialState(), {
    type: 'run/enter', dungeonId: DUNGEON_ORDER[0], protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 },
  });
  assert.equal(entered.status, 'committed');
  const fighting = reduceGameCommand(entered.state, { type: 'run/select-node', nodeId: entered.state.run.currentNodeId });
  assert.equal(fighting.status, 'committed');
  const models = [buildActualGameViewModel(entered.state, {}), buildActualGameViewModel(fighting.state, {})];
  const chrome = { modeKind: 'preview', modeLabel: 'preview', modeDetail: '', activityMessage: '' };
  const inside = (inner, outer, label) => assert.ok(inner.left >= outer.left - 0.01
    && inner.right <= outer.right + 0.01 && inner.bottom >= outer.bottom - 0.01
    && inner.top <= outer.top + 0.01, `${label}: full visible bounds ${JSON.stringify(inner)} fit the reserved room ${JSON.stringify(outer)}`);
  const close = (actual, expected, label, tolerance = 0.001) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
  const assertCloneContract = (original, fitted, label) => {
    assert.notEqual(fitted, original, `${label}: layout uses a transient world view`);
    assert.notEqual(fitted.targets, original.targets, `${label}: target feet use an independent array`);
    for (const key of Object.keys(original).filter(key => key !== 'targets')) {
      assert.equal(fitted[key], original[key], `${label}: ${key} stays identical to the authoritative world`);
    }
    assert.equal(fitted.targets.length, original.targets.length, `${label}: no side neighbor is omitted`);
    for (const [index, target] of original.targets.entries()) {
      const projected = fitted.targets[index];
      assert.notEqual(projected, target);
      for (const key of Object.keys(target).filter(key => key !== 'x' && key !== 'y')) {
        assert.equal(projected[key], target[key], `${label}/${target.id}: ${key} retains its original identity/value`);
      }
    }
  };
  // Independent values measured from prototype CSS (image bottom edges).
  const htmlFeet = {
    320: { north: [160, 202], south: [160, 422], west: [40, 305], east: [280, 312], main: [160, 335] },
    390: { north: [195, 232], south: [195, 678], west: [42, 447], east: [348, 455], main: [195, 421.32] },
  };
  for (const [width, height] of [[320, 568], [390, 844]]) {
    const px = 750 / width;
    const layout = getDungeonHtmlRoomLayout({ worldWidth: 1000, worldHeight: 1000,
      surfaceHeight: height * px, viewportWidth: width, safeInsets: { top: 0, right: 0, bottom: 0, left: 0 } });
    for (const [slot, [expectedX, expectedY]] of Object.entries(htmlFeet[width])) {
      close(width / 2 + layout.targetFeet[slot].x / px, expectedX, `${width}px HTML ${slot} x`);
      close(height / 2 - layout.targetFeet[slot].y / px, expectedY, `${width}px HTML ${slot} image bottom`);
      const world = layout.unproject(layout.targetFeet[slot]);
      const screen = layout.project(world);
      close(screen.x, layout.targetFeet[slot].x, `${width}px ${slot} inverse x`);
      close(screen.y, layout.targetFeet[slot].y, `${width}px ${slot} inverse y`);
      dungeonHtmlGoldenCases += 1;
    }
    // Multiple real direction targets retain distinct destinations and command
    // objects. The local clone may spread their feet without inventing actions.
    const base = buildWalkWorld(models[0]);
    const gate = base.targets.find(target => target.kind === 'transition');
    const multi = { ...base, targets: [...base.targets.filter(target => target.doorSide !== 'north'),
      ...Array.from({ length: 3 }, (_, index) => ({ ...gate, id: `multi:${index}`, doorSide: 'north',
        destinationNodeId: `neighbor:${index}`, radius: 110 + index,
        action: { ...models[0].sections[2].actions[0], actionId: `move:${index}`,
          event: { kind: 'command', command: { type: 'run/move', nodeId: `neighbor:${index}` } } },
        ...(index === 2 ? { disabledReason: '尚未开放' } : {}) }))] };
    const snapshot = JSON.stringify(multi);
    const fitted = fitDungeonHtmlTargets(multi, layout);
    assertCloneContract(multi, fitted, `${width}px multi north neighbor`);
    const northern = fitted.targets.filter(target => target.doorSide === 'north');
    assert.equal(northern.length, 3);
    assert.equal(new Set(northern.map(target => target.x)).size, 3, 'same-side neighbors have separate rendered feet');
    assert.deepEqual(northern.map(target => target.action.event.command.nodeId), ['neighbor:0', 'neighbor:1', 'neighbor:2']);
    assert.equal(JSON.stringify(multi), snapshot, 'spreading neighbors leaves the original world untouched');
    dungeonMultiNeighborCases += 1;
  }
  try {
    for (const [viewportWidth, viewportHeight] of [[320, 568], [390, 844]]) {
      globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportHeight };
      const surfaceHeight = Math.max(1334, viewportHeight * 750 / viewportWidth);
      const pixel = Math.max(750 / viewportWidth, surfaceHeight / viewportHeight);
      for (const [insetKind, insets] of [
        ['none', { top: 0, right: 0, bottom: 0, left: 0 }],
        ['safe', { top: 44 * pixel, right: 3 * pixel, bottom: 34 * pixel, left: 7 * pixel }],
      ]) for (const model of models) {
        const label = `${viewportWidth}x${viewportHeight}/${insetKind}/${model.phase}`;
        const snapshot = JSON.stringify(model);
        const sourceSpec = buildWalkWorld(model);
        const specSnapshot = JSON.stringify(sourceSpec);
        const canvas = { name: `html-room-${label}`, children: [],
          getComponent() { return { contentSize: { width: 750, height: surfaceHeight } }; },
          addChild(child) { this.children.push(child); child.parent = this; } };
        const calls = [];
        const view = new SceneFixtureView(canvas, { activate(physicalId, actionId, event) { calls.push({ physicalId, actionId, event }); } });
        try {
          view.render(model, chrome, insets);
          const root = () => canvas.children.at(-1);
          const scene = findNode(root(), 'WalkScene');
          const camera = findNode(root(), 'WalkCamera');
          const { spec, layout, transientSpec } = sceneDungeonLayout(root(), model, insets);
          assertCloneContract(spec, transientSpec, label);
          if (model.phase === 'combat') {
            // Combat v2 duel: both fighters stand on fixed marks inside the room projection,
            // doors leave the stage, walking is suspended and the HUD replaces world plates.
            const { duel, enemyFoot, heroFoot } = sceneDuelLayout(root(), model, insets);
            assert.equal(camera.scale.x, layout.scale.x, `${label}: the duel keeps the room projection`);
            assert.equal(camera.scale.y, layout.scale.y);
            const sceneBottom = -surfaceHeight / 2 + insets.bottom;
            const lower = projectedNodePoint(scene, { x: layout.roomRect.x, y: sceneBottom });
            const upper = projectedNodePoint(scene, { x: layout.roomRect.x + layout.roomRect.width, y: layout.roomRect.y + layout.roomRect.height });
            const stage = { left: lower.x, bottom: lower.y, right: upper.x, top: upper.y };
            const monster = transientSpec.targets.find(target => target.kind === 'monster');
            const monsterActor = findNode(root(), `WalkTarget:${monster.id}`);
            close(monsterActor.position.x, enemyFoot.x, `${label}: enemy stands on its duel mark`);
            close(monsterActor.position.y, -enemyFoot.y, `${label}: enemy stands on its duel mark`);
            const enemyScreen = projectedNodePoint(monsterActor);
            const enemyMark = projectedNodePoint(scene, duel.enemy);
            close(enemyScreen.x, enemyMark.x, `${label}: enemy foot x`);
            close(enemyScreen.y, enemyMark.y, `${label}: enemy foot y`);
            const playerNode = findNode(root(), 'WalkPlayer');
            const heroScreen = projectedNodePoint(playerNode);
            const heroMark = projectedNodePoint(scene, duel.hero);
            close(heroScreen.x, heroMark.x, `${label}: hero foot x`);
            close(heroScreen.y, heroMark.y, `${label}: hero foot y`);
            close(playerNode.position.x, heroFoot.x, `${label}: hero uses the same projection`);
            assert.equal(collectNodes(root(), node => node.name === 'WalkTransitionGateSprite').length, 0, `${label}: closed doors leave the duel stage`);
            const enemyArt = collectNodes(root(), node => node.name.startsWith('WalkMonsterSprite:'))[0];
            const enemyBounds = projectedNodeBounds(enemyArt);
            close(enemyBounds.top - enemyBounds.bottom, duel.enemyHeight, `${label}: duel enemy height`);
            inside(enemyBounds, stage, `${label}/${enemyArt.name}`);
            const playerBody = findNode(root(), 'WalkPlayerBody');
            const heroBounds = projectedNodeBounds(playerBody);
            close((heroBounds.top - heroBounds.bottom) * 308 / 336, duel.heroHeight, `${label}: duel hero visible height`);
            // The square atlas canvas is wider than the hero; its foot column and height stay on stage.
            inside({ left: heroScreen.x, right: heroScreen.x, bottom: heroBounds.bottom, top: heroBounds.top }, stage, `${label}/WalkPlayerBody`);
            const ticker = findNode(root(), 'WalkCombatTicker') ?? findNode(root(), 'WalkEnemyCard');
            assert.ok(enemyBounds.top <= absoluteNodeBounds(ticker).bottom + 0.001, `${label}: the enemy stays below the HUD`);
            for (const name of ['WalkEnemyCard', 'WalkEnemyIntent']) {
              const bounds = absoluteNodeBounds(findNode(root(), name));
              inside(bounds, { left: -375 + insets.left, right: 375 - insets.right, bottom: sceneBottom, top: surfaceHeight / 2 - insets.top }, `${label}/${name}`);
              dungeonCombatHudClearanceCases += 1;
            }
            view.walkScene.updateCombatReadout({ enemyHp: 17 });
            assert.equal(labelComponent(findNode(root(), 'WalkEnemyHealthLabel')).string,
              `17 / ${model.sections[1].detail.enemy.maxHp}`, `${label}: the live enemy HP readout remains authoritative`);
            const mask = findNode(root(), 'WalkCombatEffectsViewport');
            assert.ok(hasComponentNamed(mask, 'Mask'), `${label}: effects retain native clipping`);
            const maskBounds = projectedNodeBounds(mask);
            for (const edge of ['left', 'right', 'bottom', 'top']) close(maskBounds[edge], stage[edge], `${label}: effect clip shares the duel stage ${edge}`);
            const positionBefore = view.walkScene.getPosition();
            view.walkScene.tick(0.5, { x: 1, y: -1 });
            assert.deepEqual(view.walkScene.getPosition(), positionBefore, `${label}: walking is suspended during the duel`);
            assert.deepEqual(projectedNodePoint(playerNode), heroScreen, `${label}: the hero holds its duel mark`);
            const playerCenter = projectedNodePoint(playerBody);
            const playerBodyPosition = { ...playerBody.position };
            assert.equal(view.walkScene.startCombatAction('guard', () => {}), true);
            const effect = findNode(root(), 'WalkCombatEffects');
            const shield = effect.getComponent(TestGraphics).segments[0];
            assert.ok(shield, `${label}: native guard effect is drawn`);
            const unit = duel.heroHeight / 200;
            const guardAnchor = projectedNodePoint(effect, { x: shield.from.x, y: shield.from.y - 57 * unit });
            close(guardAnchor.x, playerCenter.x, `${label}: guard begins at the projected player body`);
            close(guardAnchor.y, playerCenter.y, `${label}: guard follows the projected body offset`, 3 * pixel);
            view.walkScene.cancelCombatAction();
            let impacts = 0;
            assert.equal(view.walkScene.startCombatAction('attack', () => { impacts += 1; }), true);
            for (let frame = 0; frame < 3; frame += 1) view.walkScene.tick(0.1, { x: 0, y: 0 });
            assert.equal(impacts, 1, `${label}: original effect impact is delivered once`);
            assert.equal(view.walkScene.resolveCombatAction({ enemyDamage: 13 }, () => {}), true);
            const damage = findNode(root(), 'WalkDamage');
            assert.equal(labelComponent(damage).string, '−13');
            const enemyAnchor = projectedNodePoint(damage, { x: 0, y: -70 * unit });
            const enemyCenter = projectedNodePoint(enemyArt);
            close(enemyAnchor.x, enemyCenter.x, `${label}: damage begins at the projected enemy body`);
            close(enemyAnchor.y, enemyCenter.y, `${label}: damage follows the projected image body offset`, 3 * pixel);
            view.walkScene.cancelCombatAction();
            assert.deepEqual({ ...playerBody.position }, playerBodyPosition, `${label}: cancelled dash restores the player's body offset`);
            assert.deepEqual({ ...enemyArt.parent.position }, { x: 0, y: 0, z: 0 }, `${label}: cancelled recoil restores the enemy's foot origin`);
            assert.deepEqual(view.walkScene.getPosition(), positionBefore, `${label}: effects never change saved walking coordinates`);
            dungeonRoomEffectAnchorCases += 1;
            assert.equal(calls.length, 0, `${label}: rendering and isolated effects cannot manufacture a domain command`);
            const attackAction = model.sections[2].actions.find(action => action.combatAction === 'attack');
            emitTouch(findNode(root(), `WalkCombatAction:${attackAction.actionId}`), 16000 + dungeonHtmlInteractionCases);
            for (let frame = 0; frame < 3; frame += 1) view.tick(0.1);
            assert.equal(calls.length, 1, `${label}: the attack control dispatches exactly one original action`);
            assert.equal(calls[0].event, attackAction.event, `${label}: the control retains the authoritative event object`);
            view.walkScene.cancelCombatAction();
            dungeonHtmlInteractionCases += 1;
            assert.equal(JSON.stringify(model), snapshot, `${label}: presentation keeps the authoritative model unchanged`);
            assert.equal(JSON.stringify(buildWalkWorld(model)), specSnapshot, `${label}: rendering cannot alter the authoritative world spec`);
            dungeonRoomFitCases += 1;
            continue;
          }
          const lower = projectedNodePoint(scene, { x: layout.roomRect.x, y: layout.roomRect.y });
          const upper = projectedNodePoint(scene, { x: layout.roomRect.x + layout.roomRect.width, y: layout.roomRect.y + layout.roomRect.height });
          const room = { left: lower.x, bottom: lower.y, right: upper.x, top: upper.y };
          inside(room, { left: -375 + insets.left, right: 375 - insets.right,
            bottom: -surfaceHeight / 2 + insets.bottom + 120 * pixel,
            top: surfaceHeight / 2 - insets.top - 136 * pixel }, label);
          assert.equal(camera.scale.x, layout.scale.x, `${label}: horizontal movement uses the fixed affine axis`);
          assert.equal(camera.scale.y, layout.scale.y, `${label}: depth movement uses the fixed affine axis`);
          assert.deepEqual(layout.cameraPoint, { x: spec.width / 2, y: spec.height / 2 });
          assertWorldImageCoverage(root(), getInfiniteFlowSceneVisualKeys(model).background);
          const bg = findNode(root(), `WalkDungeonBackdrop:${getInfiniteFlowSceneVisualKeys(model).background}`);
          const backgroundBoundsBefore = projectedNodeBounds(bg);
          for (const target of transientSpec.targets) {
            const actor = findNode(root(), `WalkTarget:${target.id}`);
            assert.deepEqual({ ...actor.position }, { x: target.x, y: -target.y, z: 0 },
              `${label}/${target.id}: visual and nearest-target feet share the transient world coordinate`);
            close(actor.scale.x * camera.scale.x, 1, `${label}/${target.id}: sprite/text horizontal counter-scale`);
            close(actor.scale.y * camera.scale.y, 1, `${label}/${target.id}: sprite/text vertical counter-scale`);
            const actualFoot = projectedNodePoint(actor);
            const expectedFoot = projectedNodePoint(scene, layout.project(target));
            close(actualFoot.x, expectedFoot.x, `${label}/${target.id}: projected foot x`);
            close(actualFoot.y, expectedFoot.y, `${label}/${target.id}: projected foot y`);
            if (target.doorSide === undefined) {
              const main = projectedNodePoint(scene, layout.targetFeet.main);
              close(actualFoot.x, main.x, `${label}: central target occupies the HTML main slot`);
              close(actualFoot.y, main.y, `${label}: central target occupies the HTML main slot`);
            }
          }
          const sprites = collectNodes(root(), node => node.name === 'WalkTransitionGateSprite'
            || node.name.startsWith('WalkMonsterSprite:') || node.name === 'WalkPlayerBody');
          assert.equal(sprites.filter(node => node.name === 'WalkTransitionGateSprite').length, 4, `${label}: all four gate directions remain visible`);
          assert.ok(sprites.some(node => node.name.startsWith('WalkMonsterSprite:')));
          for (const node of sprites) {
            const bounds = projectedNodeBounds(node);
            inside(bounds, room, `${label}/${node.name}`);
            const sprite = [...node.components.values()].find(component => 'spriteFrame' in component);
            assert.ok(sprite?.spriteFrame, `${label}/${node.name}: approved art remains attached`);
            const source = sprite.spriteFrame.originalSize ?? sprite.spriteFrame.rect ?? sprite.spriteFrame.image;
            close((bounds.right - bounds.left) / (bounds.top - bounds.bottom), source.width / source.height,
              `${label}/${node.name}: the complete source keeps its original aspect ratio`);
            const height = (bounds.top - bounds.bottom) / pixel;
            if (node.name === 'WalkTransitionGateSprite') close(height, viewportWidth === 320 ? 60 : 90, `${label}: HTML gate height`);
            else if (node.name.startsWith('WalkMonsterSprite:')) close(height, viewportWidth === 320 ? 108 : 158, `${label}: HTML monster height`);
            else close(height * 308 / 336, viewportWidth === 320 ? 68 : 88, `${label}: visible hero stands about a doorway tall`);
            if (node.name !== 'WalkPlayerBody') {
              const foot = projectedNodePoint(node.parent.parent);
              close(bounds.bottom, foot.y, `${label}/${node.name}: original image bottom is on its target foot`);
            }
          }
          for (const node of collectNodes(root(), node => node.name === 'WalkTargetName' || node.name === 'WalkTransitionState')) {
            inside(projectedNodeBounds(node), room, `${label}/${node.parent.name}/${node.name}`);
            const fontScale = projectedNodePoint(node, { x: 0, y: labelComponent(node).fontSize }).y - projectedNodePoint(node).y;
            assert.ok(fontScale / pixel >= 9 - 0.001, `${label}/${node.name}: world text remains readable without affine distortion`);
          }
          const cameraBefore = { ...camera.position };
          const positionBefore = view.walkScene.getPosition();
          const playerScreenBefore = projectedNodePoint(findNode(root(), 'WalkPlayer'));
          view.walkScene.tick(0.1, { x: 1, y: 0 });
          const horizontalPosition = view.walkScene.getPosition();
          const playerScreenAfter = projectedNodePoint(findNode(root(), 'WalkPlayer'));
          close(horizontalPosition.x - positionBefore.x, 44, `${label}: movement uses the room walking speed`);
          assert.equal(horizontalPosition.y, positionBefore.y);
          close(playerScreenAfter.x - playerScreenBefore.x, 44 * layout.scale.x, `${label}: horizontal movement is a straight affine axis`);
          close(playerScreenAfter.y, playerScreenBefore.y, `${label}: rightward walking cannot drift in depth`);
          view.walkScene.tick(0.1, { x: 0, y: -1 });
          const positionAfter = view.walkScene.getPosition();
          const verticalScreenAfter = projectedNodePoint(findNode(root(), 'WalkPlayer'));
          close(horizontalPosition.y - positionAfter.y, 44, `${label}: vertical movement keeps the room walking speed`);
          assert.equal(positionAfter.x, horizontalPosition.x);
          close(verticalScreenAfter.x, playerScreenAfter.x, `${label}: depth walking cannot drift horizontally`);
          close(verticalScreenAfter.y - playerScreenAfter.y, 44 * layout.scale.y, `${label}: depth movement is a straight affine axis`);
          assert.deepEqual({ ...camera.position }, cameraBefore, `${label}: the fixed camera never follows the avatar`);
          assert.deepEqual(projectedNodeBounds(bg), backgroundBoundsBefore, `${label}: walking cannot resize or move the original background`);
          assert.deepEqual({ ...findNode(root(), 'WalkPlayer').position }, { x: positionAfter.x, y: -positionAfter.y, z: 0 });
          view.render(model, chrome, insets);
          assert.deepEqual(view.walkScene.getPosition(), positionAfter, `${label}: same-world refresh retains the exact live world position`);
          assert.deepEqual({ ...findNode(root(), 'WalkCamera').position }, cameraBefore, `${label}: refresh retains the fixed projection`);
          assert.equal(calls.length, 0, `${label}: rendering, walking and isolated effects cannot manufacture a domain command`);
          const currentTarget = transientSpec.targets.find(target => target.kind === 'monster');
          walkTowardRenderedTarget(view, root(), currentTarget.id, currentTarget.radius);
          const marker = findNode(root(), 'WalkTargetMarker');
          const actor = findNode(root(), `WalkTarget:${currentTarget.id}`);
          assert.deepEqual({ ...marker.position }, { ...actor.position }, `${label}: proximity marker names the same rendered target foot`);
          assert.deepEqual(projectedNodePoint(marker), projectedNodePoint(actor), `${label}: proximity marker has no screen drift`);
          emitTouch(findNode(root(), 'WalkInteract'), 16000 + dungeonHtmlInteractionCases);
          // Route prototype: interacting with the room's encounter opens its sheet; only 战斗 submits.
          assert.equal(calls.length, 0, `${label}: deliberate proximity interaction opens the encounter sheet without a command`);
          const fight = findNode(root(), `WalkRoomEventButton:${currentTarget.action.actionId}`);
          assert.ok(fight, `${label}: the encounter sheet offers the target's own action`);
          emitTouch(fight, 16500 + dungeonHtmlInteractionCases);
          assert.equal(calls.length, 1, `${label}: one tap on 战斗 dispatches exactly one original action`);
          assert.equal(calls[0].actionId, currentTarget.action.actionId, `${label}: the target retains the authoritative action ID`);
          assert.equal(calls[0].event, currentTarget.action.event, `${label}: the target retains the authoritative event object`);
          view.walkScene.cancelCombatAction();
          dungeonHtmlInteractionCases += 1;
          assert.equal(JSON.stringify(model), snapshot, `${label}: presentation keeps the authoritative model unchanged`);
          assert.equal(JSON.stringify(buildWalkWorld(model)), specSnapshot, `${label}: rendering cannot alter the authoritative world spec`);
          dungeonRoomFitCases += 1;
        } finally { view.destroy(); }
      }
    }
  } finally { globalThis.__walkingTestFrameSize = priorFrameSize; }
  assert.equal(dungeonRoomFitCases, 8);
  assert.equal(dungeonRoomEffectAnchorCases, 4);
  assert.equal(dungeonCombatHudClearanceCases, 8);
  assert.equal(dungeonHtmlGoldenCases, 10);
  assert.equal(dungeonHtmlInteractionCases, 8);
  assert.equal(dungeonMultiNeighborCases, 2);
}

// The compact frame is shared by every sheet family. Exercise the real host
// binding layer as well as geometry: retired close nodes must never close a
// replacement sheet, and local dismissal must never dispatch a game command.
let compactModalCloseCases = 0;
{
  const initialState = createInitialState();
  const entered = reduceGameCommand(initialState, {
    type: 'run/enter', dungeonId: DUNGEON_ORDER[0], protocolId: 'standard',
    seeds: { rulesVersion: 1, hiddenTaskSeed: 0x1234_5678 },
  });
  assert.equal(entered.status, 'committed');
  const battle = reduceGameCommand(entered.state, { type: 'run/select-node', nodeId: entered.state.run.currentNodeId });
  assert.equal(battle.status, 'committed');
  const result = reduceGameCommand(entered.state, { type: 'run/retreat' });
  assert.equal(result.status, 'committed');
  const hub = buildActualGameViewModel(initialState, { hubPanel: 'entry' });
  const explore = buildActualGameViewModel(entered.state, {});
  const modalModels = [
    ['character', hub], ['inventory', hub], ['map', explore], ['objectives', explore], ['log', explore],
    ['menu', buildActualGameViewModel(battle.state, {})], ['interaction', explore], ['entry', hub],
    ['npc', buildActualGameViewModel(initialState, { hubPanel: 'supplies' })], ['help', explore],
    ['result', buildActualGameViewModel(result.state, {})],
  ];
  const priorFrame = globalThis.__walkingTestFrameSize;
  try {
    for (const viewportWidth of [320, 390]) {
      const viewportHeight = viewportWidth === 320 ? 568 : 844;
      globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportHeight };
      const surfaceHeight = Math.max(1334, viewportHeight * 750 / viewportWidth);
      const unit = Math.max(750 / viewportWidth, surfaceHeight / viewportHeight);
      const insets = { top: 44 * unit, right: 0, bottom: 34 * unit, left: 0 };
      for (const [kind, model] of modalModels) {
        const snapshot = JSON.stringify(model);
        const canvas = { name: `compact-modal-${viewportWidth}-${kind}`, children: [],
          getComponent() { return { contentSize: { width: 750, height: surfaceHeight } }; },
          addChild(child) { this.children.push(child); child.parent = this; } };
        let delegateCalls = 0;
        const view = new SceneFixtureView(canvas, { activate() { delegateCalls += 1; } });
        const chrome = { modeKind: 'preview', modeLabel: '', modeDetail: '' };
        const root = () => canvas.children.at(-1);
        view.render(model, chrome, insets);
        view.openMobilePanel(kind);
        const panel = findNode(root(), `MobileInfoSheet:${kind}`);
        assert.ok(panel, `${viewportWidth}px/${kind}: real host renders the requested sheet`);
        if (kind === 'interaction') {
          // A room's own interactions dock at the bottom like the route prototype's room sheet.
          assert.ok(Math.abs(panel.size.width - (750 - 20 * unit)) < 0.6, `${viewportWidth}px/interaction: room sheet keeps 10px side margins`);
          assert.ok(Math.abs(panel.position.y - panel.size.height / 2 - (-surfaceHeight / 2 + insets.bottom + 10 * unit)) < 0.6,
            `${viewportWidth}px/interaction: room sheet docks 10px above the safe bottom`);
          assert.ok(panel.size.height <= surfaceHeight - insets.top - insets.bottom - 54 * unit + 0.6,
            `${viewportWidth}px/interaction: room sheet stays 44px under the safe top`);
          assert.equal(findNode(panel, 'MobileSheetTitleBand'), undefined, 'interaction: the room sheet has no window band');
        } else {
          assert.ok(panel.size.width / unit <= 304 + 0.6 && panel.size.width / unit <= viewportWidth - 40 + 0.6,
            `${viewportWidth}px/${kind}: compact width leaves physical side margins`);
          assert.ok(panel.size.height / unit <= 464 + 0.6
            && panel.size.height <= surfaceHeight - insets.top - insets.bottom - 88 * unit + 0.6,
            `${viewportWidth}px/${kind}: frame remains inside the safe vertical surface`);
          const header = findNode(panel, 'MobileSheetTitleBand');
          assert.ok(Math.abs(header.size.height / unit - 48) < 0.6, `${kind}: header is compact at both widths`);
        }
        assert.ok(hasComponentNamed(panel, 'BlockInputEvents'), `${kind}: sheet blocks world input`);
        const close = findNode(panel, 'MobileSheetClose');
        if (kind === 'interaction') {
          assert.ok(Math.abs(close.size.height / unit - (viewportWidth <= 350 ? 46 : 52)) < 0.6 && close.size.width / unit >= 44,
            'interaction: 收起 keeps the room sheet button size');
        } else {
          assert.ok(Math.abs(close.size.width / unit - 44) < 0.6 && Math.abs(close.size.height / unit - 44) < 0.6,
            `${kind}: close retains its complete physical touch region`);
        }
        const firstTouch = 14000 + compactModalCloseCases * 10;
        emitTouch(close, firstTouch);
        close.emit('touch-end', { getID: () => firstTouch, propagationStopped: false });
        assert.equal(findNode(root(), `MobileInfoSheet:${kind}`), undefined, `${kind}: X dismisses exactly the local sheet`);
        assert.equal(delegateCalls, 0, `${kind}: closing never dispatches a domain action`);
        view.openMobilePanel(kind);
        const replacementRoot = root();
        emitTouch(close, firstTouch + 1);
        assert.equal(root(), replacementRoot, `${kind}: a retired close callback cannot rebuild the current host`);
        assert.ok(findNode(root(), `MobileInfoSheet:${kind}`), `${kind}: retired close cannot dismiss a replacement sheet`);
        const currentClose = findNode(root(), 'MobileSheetClose');
        view.destroy();
        const retiredChildCount = canvas.children.length;
        emitTouch(currentClose, firstTouch + 2);
        assert.equal(canvas.children.length, retiredChildCount, `${kind}: destroyed host stays inert`);
        assert.equal(delegateCalls, 0, `${kind}: stale callbacks never dispatch a domain action`);
        assert.equal(JSON.stringify(model), snapshot, `${kind}: local sheet lifecycle preserves the projected model`);
        compactModalCloseCases += 1;
      }
    }
  } finally {
    globalThis.__walkingTestFrameSize = priorFrame;
  }
}
// Independent host overlays share the compact frame and preserve full help and
// diagnostic documents. Their clip regions, footer controls and scroll content
// must remain reachable at both phone widths.
let compactOverlayCases = 0;
{
  const initialState = createInitialState();
  const hub = buildActualGameViewModel(initialState, {});
  const helpEntry = hub.sections[4].entries[1];
  assert.ok(helpEntry, 'real help catalogue supplies an interior topic');
  const help = buildActualGameViewModel(initialState, { activeHelpId: helpEntry.id });
  const diagnostic = Array.from({ length: 24 }, (_, index) => `诊断边界 ${index + 1}：storage=unavailable command=persist`).join('\n');
  const priorFrame = globalThis.__walkingTestFrameSize;
  try {
    for (const viewportWidth of [320, 390]) {
      const viewportHeight = viewportWidth === 320 ? 568 : 844;
      globalThis.__walkingTestFrameSize = { width: viewportWidth, height: viewportHeight };
      const surfaceHeight = Math.max(1334, viewportHeight * 750 / viewportWidth);
      const unit = Math.max(750 / viewportWidth, surfaceHeight / viewportHeight);
      const insets = { top: 44 * unit, right: 0, bottom: 34 * unit, left: 0 };
      for (const [kind, model, chrome, panelName, blockerName, scrollName] of [
        ['boot', undefined, { modeKind: 'boot', modeLabel: 'bootstrap', modeDetail: diagnostic }, 'RuntimeDiagnostic', 'RuntimeDiagnosticBlocker', 'DiagnosticScroll'],
        ['blocked', hub, { modeKind: 'blocked', modeLabel: 'storage', modeDetail: '', blockingMessage: diagnostic }, 'RuntimeDiagnostic', 'RuntimeDiagnosticBlocker', 'DiagnosticScroll'],
        ['persistence', hub, { modeKind: 'blocked', modeLabel: 'storage', modeDetail: '', blockingMessage: diagnostic, persistenceRetry: true }, 'RuntimeDiagnostic', 'RuntimeDiagnosticBlocker', 'DiagnosticScroll'],
        ['loading', hub, { modeKind: 'preview', modeLabel: '', modeDetail: '', sceneAssets: 'loading' }, 'SceneAssetLoading', 'SceneAssetOverlayBlocker', undefined],
        ['error', hub, { modeKind: 'preview', modeLabel: '', modeDetail: '', sceneAssets: 'error' }, 'SceneAssetError', 'SceneAssetOverlayBlocker', undefined],
        ['help', help, { modeKind: 'preview', modeLabel: '', modeDetail: '' }, 'HelpDialog', 'HelpOverlayBlocker', 'HelpScroll'],
      ]) {
        const canvas = { name: `compact-overlay-${viewportWidth}-${kind}`, children: [],
          getComponent() { return { contentSize: { width: 750, height: surfaceHeight } }; },
          addChild(child) { this.children.push(child); child.parent = this; } };
        let persistenceRetries = 0;
        const view = new SceneFixtureView(canvas, {
          activate() { assert.fail('rendering compact overlays cannot dispatch actions'); },
          retrySceneAssets() { assert.fail('rendering recovery controls cannot start a retry'); },
          retryPersistence() { persistenceRetries += 1; },
        });
        view.render(model, chrome, insets);
        assert.equal(persistenceRetries, 0, `${kind}: rendering cannot start a persistence retry`);
        const root = canvas.children.at(-1);
        const panel = findNode(root, panelName);
        assert.ok(panel, `${viewportWidth}px/${kind}: real host overlay exists`);
        assert.ok(hasComponentNamed(findNode(root, blockerName), 'BlockInputEvents'), `${kind}: overlay consumes world input`);
        const bounds = absoluteNodeBounds(panel);
        assert.ok(panel.size.width / unit <= 304 + 0.6 && panel.size.width / unit <= viewportWidth - 40 + 0.6,
          `${kind}: compact overlay retains physical side margins`);
        assert.ok(panel.size.height / unit <= 464 + 0.6
          && panel.size.height <= surfaceHeight - insets.top - insets.bottom - 88 * unit + 0.6,
          `${kind}: compact overlay fits the safe vertical surface`);
        assert.ok(bounds.top <= surfaceHeight / 2 - insets.top + 0.6
          && bounds.bottom >= -surfaceHeight / 2 + insets.bottom - 0.6,
          `${kind}: overlay remains inside actual safe bounds`);
        if (scrollName) {
          const scroll = findNode(panel, scrollName);
          const scrollView = [...scroll.components.values()].find(component => typeof component.getScrollOffset === 'function');
          assert.ok(scrollView && hasComponentNamed(scroll, 'Mask'), `${kind}: long document has a real clipped ScrollView`);
          assert.equal(scrollView.content, findNode(scroll, `${scrollName}Content`), `${kind}: scroll owns the complete document`);
          assert.ok(scroll.size.height / unit <= 300 + 0.6 && scrollView.content.size.height >= scroll.size.height,
            `${kind}: compact clip retains overflow content`);
          const clipBounds = absoluteNodeBounds(scroll);
          assert.ok(clipBounds.left >= bounds.left && clipBounds.right <= bounds.right
            && clipBounds.top <= bounds.top && clipBounds.bottom >= bounds.bottom, `${kind}: document clip remains in its frame`);
          if (scrollView.content.size.height > scroll.size.height) {
            const thumb = findNode(scroll, `${scrollName}Thumb`);
            const initialY = thumb.position.y;
            scrollView.scrollToOffset({ x: 0, y: scrollView.content.size.height - scroll.size.height });
            assert.ok(thumb.position.y < initialY, `${kind}: overflow scrolling updates its thumb`);
          }
        }
        if (kind === 'boot' || kind === 'blocked' || kind === 'persistence') {
          assert.equal(labelComponent(findNode(panel, 'DiagnosticBody')).string, diagnostic,
            `${kind}: compact diagnostic preserves every original line`);
          assert.equal(findNode(panel, 'PersistenceRetry') !== undefined, kind === 'persistence',
            `${kind}: only a recoverable write block offers a persistence retry`);
        }
        if (kind === 'help') {
          assert.equal(collectNodes(panel, node => node.name.startsWith('HelpScrollSection:')).length, 4,
            'help keeps overview, mechanics, advice and readouts in one scrolling document');
          const close = findNode(panel, 'CloseHelp');
          assert.ok(Math.abs(close.size.width / unit - 44) < 0.6 && Math.abs(close.size.height / unit - 44) < 0.6,
            'help title close retains a 44px physical target');
        }
        for (const name of kind === 'help' ? ['PreviousTopic', 'NextTopic'] : kind === 'error' ? ['SceneAssetRetry']
          : kind === 'persistence' ? ['PersistenceRetry'] : []) {
          const target = findNode(panel, name);
          const plate = findNode(target, `${name}Plate`);
          assert.ok(target.size.width / unit >= 44 && Math.abs(target.size.height / unit - 44) < 0.6,
            `${name}: compact footer remains physically tappable`);
          assert.ok(plate.size.width / unit <= 148 + 0.6 && Math.abs(plate.size.height / unit - 32) < 0.6,
            `${name}: button separates compact appearance from its touch region`);
          assert.equal(nodesOverlap(target, findNode(panel, scrollName ?? 'SceneAssetDetail')), false,
            `${name}: button never covers the document clip or loading detail`);
        }
        if (kind === 'persistence') {
          const retryBounds = absoluteNodeBounds(findNode(panel, 'PersistenceRetry'));
          assert.ok(retryBounds.left >= bounds.left - 0.6 && retryBounds.right <= bounds.right + 0.6
            && retryBounds.top <= bounds.top + 0.6 && retryBounds.bottom >= bounds.bottom - 0.6,
            'persistence retry stays inside the compact frame');
          emitTouch(findNode(panel, 'PersistenceRetry'), 9950 + viewportWidth);
          assert.equal(persistenceRetries, 1, 'persistence retry forwards exactly one callback');
          view.render(model, { ...chrome, busyActionId: 'runtime.persistence.retry' }, insets);
          const busyRetry = findNode(canvas.children.at(-1), 'PersistenceRetry');
          assert.equal(labelComponent(findNode(busyRetry, 'PersistenceRetryLabel')).string, '正在重试…');
          emitTouch(busyRetry, 9960 + viewportWidth);
          assert.equal(persistenceRetries, 1, 'a retry in flight disables the retry control');
          emitTouch(findNode(panel, 'PersistenceRetry'), 9970 + viewportWidth);
          assert.equal(persistenceRetries, 1, 'a retired retry control from an older render is inert');
        }
        view.destroy();
        compactOverlayCases += 1;
      }
    }
  } finally {
    globalThis.__walkingTestFrameSize = priorFrame;
  }
}
delete globalThis.__walkingTestInput;
delete globalThis.__walkingTestGame;

delete globalThis[TEST_CONTROL_KEY];
console.log(JSON.stringify({
  status: 'COCOS_BOOTSTRAP_RACE_VALID',
  compactModalViewports: [320, 390],
  compactModalFamilies: 11,
  compactModalCloseCases,
  compactOverlayCases,
  permanentEquipmentViewports: [320, 390],
  dungeonRoomFitViewports: ['320x568', '390x844'],
  dungeonRoomFitCases,
  dungeonRoomEffectAnchorCases,
  dungeonCombatHudClearanceCases,
  dungeonHtmlGoldenCases,
  dungeonHtmlInteractionCases,
  dungeonMultiNeighborCases,
  // 71 pre-existing scenarios plus 9 newly added WeChat DevTools NON_RELEASE
  // blocks (case a, getSystemInfoSync fallback, case b platforms loop, case b
  // malformed/throwing, case c boundary-wins, case d diagnostics, case e prefill
  // destroy, case e client-creation destroy, case f stale dispatch destroy),
  // plus 1 Explore chapter-decision block (three dungeons, law/directive/route/
  // pressure/pursuit pages, pending and memory-hunt coexistence, 320x568/390x844
  // reachability, local-only help, action-order invariance, post-destroy
  // inertness), plus 1 unified Result pager block (every page kind, outcome-only,
  // echo pending/archived action context, prev/next bounds, page-set reset/clamp,
  // malformed invalid cards, 320x568/390x844, long Chinese/ASCII subpages, 104+
  // touch targets, no raw tokens, post-destroy inertness), plus 1 Combat
  // chapter-context block (formatter law/pursuit lines, dormant/stalking/fused
  // variants, lawless fail-closed, 320x568/390x844 reachability, danger law
  // rendering, no non-combat commands, post-destroy inertness). Every NON_RELEASE
  // scenario also proves zero wx.getStorageSync/setStorageSync calls.
  // World art blocks cover independent identity, feet anchors, rank, recoil and frame cleanup.
  // Two courtyard blocks exercise the complete physical HUD, art and routes at 320/390px.
  // The hub portal lease block adds hub-only lifetime and frame-before-image disposal coverage.
  // Hero atlas failure block covers partial-frame allocation cleanup.
  // Two HUD04 blocks exercise transparent dungeon controls and dynamic player HP at 320/390px.
  // Manual resource recovery and real View gating add two blocks; existing scene
  // lease/memory cases additionally exercise aggregate loading/ready/error state.
  // Two acquired-relic blocks cover HUD/popover content and lifecycle at 320/390px;
  // one additional App block covers final-icon gating and phase/destroy image leases.
  // Two permanent-equipment blocks cover claim, immediate ownership and manual
  // inventory wearing, including duplicate touches, stale callbacks and runtime locks.
  // Two reward/relic blocks cover real one/two/three-candidate drafts and ordinary
  // claims, asynchronous locks, close/reopen selection and immediate active effects.
  // Twenty-two compact-sheet blocks cover every family at both phone widths,
  // local-only close, repeated touch-end, retired callbacks and post-destroy inertness.
  // Ten compact host-overlay blocks cover help, boot/blocked diagnostics and
  // scene loading/failure at both widths, including complete scroll documents.
  // One natural explore-to-result block promotes an unchanged cached primary
  // into a scene background without reloading or leaking retired world leases.
  // Eight HTML-room blocks cover both phases and inset states, original world
  // movement, full-screen backgrounds, four visible gates, uniform art/text,
  // proximity/action identity and aligned effects. Eight combat HP layout checks
  // keep the enemy track/digits below the north caption before and after live HP
  // updates. Ten independent HTML golden
  // feet and two multi-neighbor fixtures cover slot accuracy and retained actions.
  scenarios: 153,
  dungeonPropSprites: DUNGEON_PROP_FIXTURES.length,
  hubDungeonPortalSprites: 1,
  hubNpcWorldSprites: NPC_WORLD_FIXTURES.length,
  courtyardPropSprites: 4,
  courtyardViewports: [320, 390],
  hud04Viewports: [320, 390],
  rewardRelicViewports: [320, 390],
  monsterWorldSprites: MONSTER_WORLD_FIXTURES.length,
  dedicatedDungeonBackgrounds: 19,
  darkUiBodyContrastPairs: 15,
  darkUiMinimumBodyContrast: Number(darkUiMinimumBodyContrast.toFixed(3)),
  darkUiControlSizes: [104, 112, 120],
}));
