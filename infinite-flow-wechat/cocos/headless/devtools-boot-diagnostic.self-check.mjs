// Headless regression for the NON_RELEASE WeChat DevTools boot diagnostic
// boundary. The app is bundled with virtualized engine/platform packages so a
// single boot can be driven through every stage:
//   platform-ports -> seed-prefill -> client-create -> view-model-refresh
//
// Each stage failure must land in the fail-closed UI with the exact stage and
// stable diagnostic code, and a sanitized stack must reach console.error
// without credentials, AppIDs, server URLs, save bytes, or seed material.
//
// Run: node cocos/headless/devtools-boot-diagnostic.self-check.mjs

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

const TEST_CONTROL_KEY = '__INFINITE_FLOW_DEVTOOLS_BOOT_DIAGNOSTIC_CONTROL__';
const DIAGNOSTIC_PREFIX = 'wx-devtools-nonrelease-boot';

const virtualModules = new Map([
  ['cc', `
    export const _decorator = { ccclass: () => (target) => target };
    export class Component {
      constructor() { this.node = { name: 'headless-root' }; }
    }
    export class ImageAsset {}
    export class JsonAsset {}
    export const assetManager = {
      loadBundle(name) {
        // The visual bootstrap is not under test here. Never settle: the app's
        // generation guards turn a late callback into a no-op, and a pending
        // bundle load holds no active timer.
        globalThis.${TEST_CONTROL_KEY}.loadBundleCalls.push(name);
      },
    };
  `],
  ['@infinite-flow/client', `
    export function createInfiniteFlowClient(options) {
      return globalThis.${TEST_CONTROL_KEY}.createClient(options);
    }
  `],
  ['@infinite-flow/core/route-contracts', `
    export function getRouteContractById() { return undefined; }
  `],
  ['@infinite-flow/presentation', `
    export function buildGameViewModel(state, localUiState) {
      return globalThis.${TEST_CONTROL_KEY}.buildViewModel(state, localUiState);
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
    export function classifyCocosAssetError() {
      return { code: 'decode', retryable: false };
    }
    export class CocosResourcesLoader {
      constructor(resources, assetType) { this.resources = resources; this.assetType = assetType; }
      load() { return Promise.reject(new Error('visual loader not used in the diagnostic boot test')); }
      release() {}
      peek() { return null; }
    }
    export class ManifestCocosAssetPort {
      constructor(options) {
        this.options = options;
        this.manifestRevision = options.manifest.manifestRevision;
      }
      describeKey() { return undefined; }
      preloadKey(key) {
        return Promise.resolve({ ok: false, key, revision: this.manifestRevision, code: 'unknown-key', retryable: false });
      }
      releaseKey() {}
    }
    export function createWxPlatformPorts(api, options) {
      return globalThis.${TEST_CONTROL_KEY}.createPorts(api, options);
    }
    export function missingRequiredWxLifecycleMethods(candidate) {
      return ['onHide', 'offHide', 'onShow', 'offShow', 'onMemoryWarning', 'offMemoryWarning']
        .filter((method) => typeof candidate[method] !== 'function');
    }
  `],
  ['./ui/InfiniteFlowView', `
    export const INFINITE_FLOW_PREVIEW_SAFE_INSETS = Object.freeze({ top: 91, right: 0, bottom: 66, left: 0 });
    export const INFINITE_FLOW_SAFE_CONTENT_MINIMUM = Object.freeze({ width: 702, height: 1146 });
    export class InfiniteFlowView {
      constructor(node, callbacks) {
        this.node = node;
        this.callbacks = callbacks;
        this.renderCalls = 0;
        this.destroyCalls = 0;
      }
      render() { this.renderCalls += 1; }
      setVisualAsset() {}
      setVisualAssetFallback() {}
      clearVisualAsset() {}
      setSceneVisualAsset() {}
      setSceneVisualAssetFallback() {}
      clearSceneVisualAsset() {}
      focusPrimaryActions() {}
      destroy() { this.destroyCalls += 1; }
    }
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
    name: 'devtools-boot-diagnostic-virtual-modules',
    setup(buildApi) {
      buildApi.onResolve({ filter: /.*/ }, (args) => {
        if (virtualModules.has(args.path)) {
          return { path: args.path, namespace: 'devtools-boot-diagnostic' };
        }
        return undefined;
      });
      buildApi.onLoad(
        { filter: /.*/, namespace: 'devtools-boot-diagnostic' },
        (args) => ({ contents: virtualModules.get(args.path), loader: 'js' }),
      );
    },
  }],
});
assert.equal(bundle.outputFiles.length, 1);
const bundleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`;
const { InfiniteFlowApp } = await import(bundleUrl);

function installWx() {
  globalThis.wx = {
    getStorageSync() {},
    setStorageSync() {},
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
  globalThis.wx.getDeviceInfo = () => ({ platform: 'devtools' });
}

function fakePorts(overrides = {}) {
  const prefillImpl = overrides.prefill ?? (() => Promise.resolve());
  const seeds = {
    prefillCalls: 0,
    disposed: false,
    prefill() {
      this.prefillCalls += 1;
      return prefillImpl();
    },
    dispose() { this.disposed = true; },
    clear() {},
  };
  const lifecycle = {
    disposed: false,
    dispose() { this.disposed = true; },
  };
  return { seeds, lifecycle, storage: {} };
}

function fakeClient() {
  return {
    state: { phase: 'hub', visualAssetKey: undefined },
    disposed: false,
    getState() { return this.state; },
    dispose() { this.disposed = true; },
  };
}

function createController() {
  return {
    loadBundleCalls: [],
    portsFactories: [],
    clientFactories: [],
    viewModelBuilders: [],
    createPortsCalls: 0,
    createClientCalls: 0,
    viewModelCalls: [],
    createPorts(api, options) {
      this.createPortsCalls += 1;
      const factory = this.portsFactories.shift();
      assert.ok(factory, 'unexpected createWxPlatformPorts call');
      return factory(api, options);
    },
    createClient(options) {
      this.createClientCalls += 1;
      const factory = this.clientFactories.shift();
      assert.ok(factory, 'unexpected createInfiniteFlowClient call');
      return factory(options);
    },
    buildViewModel(state, localUiState) {
      this.viewModelCalls.push({ state, localUiState });
      const builder = this.viewModelBuilders.shift();
      if (builder) return builder(state, localUiState);
      return { sections: [], visualAssetKey: undefined };
    },
  };
}

function captureConsoleError() {
  const calls = [];
  const original = console.error;
  console.error = (...args) => { calls.push(args); };
  return {
    calls,
    restore() { console.error = original; },
  };
}

async function settleUntil(predicate, message, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) assert.fail(message);
    await Promise.resolve();
  }
}

async function runScenario({ portsFactory, clientFactory, viewModelBuilder } = {}) {
  installWx();
  const controller = createController();
  globalThis[TEST_CONTROL_KEY] = controller;
  let createdPorts;
  controller.portsFactories.push((api, options) => {
    createdPorts = (portsFactory ?? (() => fakePorts()))(api, options);
    return createdPorts;
  });
  controller.clientFactories.push((options) => {
    const factory = clientFactory ?? (() => Promise.resolve(fakeClient()));
    return factory(options);
  });
  if (viewModelBuilder) controller.viewModelBuilders.push(viewModelBuilder);
  const captured = captureConsoleError();
  const app = new InfiniteFlowApp();
  app.start();
  await settleUntil(
    () => app.runtimeMode.kind === 'blocked'
      || app.activityMessage.includes('NON_RELEASE 就绪'),
    'devtools boot neither blocked nor reached NON_RELEASE ready',
  );
  await Promise.resolve();
  return {
    app,
    controller,
    captured,
    ports: createdPorts,
    cleanup() {
      try {
        app.onDestroy();
      } finally {
        captured.restore();
        delete globalThis.wx;
        delete globalThis[TEST_CONTROL_KEY];
      }
    },
  };
}

function diagnosticCall(captured, stage) {
  const code = `${DIAGNOSTIC_PREFIX}:${stage}`;
  const found = captured.calls.find((args) => String(args[0]).includes(code));
  assert.ok(found, `expected console.error diagnostic for ${code}`);
  return found;
}

function assertStageAttributed(result, stage) {
  const { app, controller, captured } = result;
  assert.equal(app.runtimeMode.kind, 'blocked', `${stage} failure must fail closed`);
  assert.match(
    app.blockingMessage,
    new RegExp(`阶段 ${stage} · ${DIAGNOSTIC_PREFIX}:${stage}`),
    `${stage} failure must name the stage and diagnostic code in the UI`,
  );
  const diag = diagnosticCall(captured, stage);
  assert.equal(
    diag[0],
    `[InfiniteFlowApp] ${DIAGNOSTIC_PREFIX}:${stage} NON_RELEASE bootstrap failed`,
    `${stage} diagnostic prefix must be stable`,
  );
  return diag;
}

// === Success: every stage transitions and no diagnostic is logged ===
{
  const result = await runScenario();
  try {
    assert.equal(result.app.runtimeMode.kind, 'wx-devtools');
    assert.match(result.app.activityMessage, /NON_RELEASE 就绪/);
    assert.ok(result.app.client, 'success hands off the client');
    assert.equal(result.controller.createPortsCalls, 1, 'platform-ports stage ran');
    assert.equal(result.ports.seeds.prefillCalls, 1, 'seed-prefill stage ran');
    assert.equal(result.controller.createClientCalls, 1, 'client-create stage ran');
    assert.ok(result.controller.viewModelCalls.length >= 1, 'view-model-refresh stage ran');
    assert.equal(result.app.blockingMessage, undefined);
    assert.ok(
      !result.captured.calls.some((args) => String(args[0]).includes(DIAGNOSTIC_PREFIX)),
      'a successful boot must not log a failure diagnostic',
    );
  } finally {
    result.cleanup();
  }
}

// === platform-ports failure ===
{
  const result = await runScenario({
    portsFactory: () => { throw new Error('ports boom'); },
  });
  try {
    assert.equal(result.controller.createPortsCalls, 1);
    assert.equal(result.ports, undefined, 'no ports are published when their construction throws');
    assert.equal(result.controller.createClientCalls, 0);
    const diag = assertStageAttributed(result, 'platform-ports');
    assert.match(String(diag[1]), /ports boom/);
  } finally {
    result.cleanup();
  }
}

// === seed-prefill failure ===
{
  const result = await runScenario({
    portsFactory: () => fakePorts({
      prefill: () => Promise.reject(new Error('prefill boom')),
    }),
  });
  try {
    assert.equal(result.ports.seeds.prefillCalls, 1);
    assert.equal(result.controller.createClientCalls, 0, 'client creation must not start after a prefill failure');
    const diag = assertStageAttributed(result, 'seed-prefill');
    assert.match(String(diag[1]), /prefill boom/);
  } finally {
    result.cleanup();
  }
}

// === client-create failure ===
{
  const result = await runScenario({
    clientFactory: () => Promise.reject(new Error('client boom')),
  });
  try {
    assert.equal(result.controller.createClientCalls, 1);
    assert.equal(result.controller.viewModelCalls.length, 0, 'view-model refresh must not run after a client failure');
    const diag = assertStageAttributed(result, 'client-create');
    assert.match(String(diag[1]), /client boom/);
  } finally {
    result.cleanup();
  }
}

// === view-model-refresh failure ===
{
  const result = await runScenario({
    viewModelBuilder: () => { throw new Error('viewmodel boom'); },
  });
  try {
    assert.equal(result.controller.createClientCalls, 1);
    assert.ok(result.controller.viewModelCalls.length >= 1, 'the view-model build was attempted');
    assert.equal(result.app.client, undefined, 'a failed refresh must not leave a published client');
    const diag = assertStageAttributed(result, 'view-model-refresh');
    assert.match(String(diag[1]), /viewmodel boom/);
  } finally {
    result.cleanup();
  }
}

// === Sanitization: secrets in the error never reach the console ===
{
  const secretError = new Error(
    'boom http://127.0.0.1:8947/top-secret wx6ac3f5090a6b99c5 touristappid',
  );
  secretError.stack = [
    'Error: boom http://127.0.0.1:8947/top-secret wx6ac3f5090a6b99c5 touristappid',
    '    at leak (http://127.0.0.1:8947/app.js:1:2)',
    '    at boot (app.js:3:4)',
  ].join('\n');
  const result = await runScenario({
    clientFactory: () => Promise.reject(secretError),
  });
  try {
    const diag = assertStageAttributed(result, 'client-create');
    const logged = diag.map(String).join(' ');
    assert.doesNotMatch(logged, /127\.0\.0\.1/, 'server URL must be redacted');
    assert.doesNotMatch(logged, /8947/, 'server port must be redacted');
    assert.doesNotMatch(logged, /wx6ac3f5090a6b99c5/, 'AppID must be redacted');
    assert.doesNotMatch(logged, /touristappid/, 'tourist AppID label must be redacted');
    assert.doesNotMatch(logged, /top-secret/, 'URL path material must be redacted');
    assert.match(logged, /\[redacted-url\]/, 'redaction marker for the URL');
    assert.match(logged, /\[redacted-appid\]/, 'redaction marker for the AppID');
    // The UI message still carries the stage and stable code.
    assert.match(
      result.app.blockingMessage,
      new RegExp(`阶段 client-create · ${DIAGNOSTIC_PREFIX}:client-create`),
    );
  } finally {
    result.cleanup();
  }
}

// === A non-Error throw is still attributed and logged ===
{
  const result = await runScenario({
    clientFactory: () => Promise.reject('string failure'),
  });
  try {
    const diag = assertStageAttributed(result, 'client-create');
    assert.match(String(diag[1]), /string failure/);
  } finally {
    result.cleanup();
  }
}

console.log('devtools-boot-diagnostic.self-check: all stages attributed and sanitized');
