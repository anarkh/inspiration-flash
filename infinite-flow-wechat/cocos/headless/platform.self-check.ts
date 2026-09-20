import type { LifecycleFlushResult } from '@infinite-flow/runtime';
import {
  CocosResourcesLoader,
  ManifestCocosAssetPort,
  PrefilledSecureSeedPort,
  SecureSeedError,
  WxJournalStorageError,
  WxJournalStoragePort,
  WxLifecycleAdapter,
  WxLifecycleError,
  classifyCocosAssetError,
  missingRequiredWxLifecycleMethods,
  type CocosAssetLoader,
  type CocosResourcesLike,
  type WxDurabilityBoundary,
  type WxLifecycleApi,
  type WxRandomValuesSuccess,
  type WxSyncStorageApi,
  type WxUserCryptoApi,
  type WxUserCryptoManager,
} from '../assets/scripts/platform/index';

let assertions = 0;

function assert(condition: unknown, message: string): asserts condition {
  assertions += 1;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function equal<T>(actual: T, expected: T, message: string): void {
  assertions += 1;
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Assertion failed: ${message}; expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

async function rejectsWithCode(
  operation: () => Promise<unknown>,
  errorClass: typeof WxJournalStorageError | typeof SecureSeedError,
  code: string,
  message: string,
): Promise<void> {
  assertions += 1;
  try {
    await operation();
  } catch (error) {
    if (error instanceof errorClass && error.code === code) return;
    throw new Error(`${message}; wrong error: ${String(error)}`);
  }
  throw new Error(`${message}; operation resolved`);
}

function raceAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Race assertion failed: ${message}`);
}

function raceEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `Race assertion failed: ${message}; expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

async function raceRejectsWithCode(
  operation: () => Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof SecureSeedError && error.code === code) return;
    throw new Error(`${message}; wrong error: ${String(error)}`);
  }
  throw new Error(`${message}; operation resolved`);
}

class FakeWxStorage implements WxSyncStorageApi {
  private volatile = new Map<string, unknown>();
  private durable = new Map<string, unknown>();
  private corruptNextSet = false;
  private mismatchReadKey: string | undefined;

  getStorageSync(key: string): unknown {
    if (this.mismatchReadKey === key) {
      this.mismatchReadKey = undefined;
      return '{readback-mismatch';
    }
    return this.volatile.get(key) ?? '';
  }

  setStorageSync(key: string, value: string): void {
    if (this.corruptNextSet) {
      this.corruptNextSet = false;
      this.volatile.set(key, value.slice(0, Math.max(1, value.length >> 1)));
      return;
    }
    this.volatile.set(key, value);
  }

  failNextReadback(): void {
    const originalSet = this.setStorageSync.bind(this);
    this.setStorageSync = (key: string, value: string): void => {
      originalSet(key, value);
      this.mismatchReadKey = key;
      this.setStorageSync = originalSet;
    };
  }

  corruptNextPhysicalWrite(): void {
    this.corruptNextSet = true;
  }

  attest(): void {
    this.durable = new Map(this.volatile);
  }

  crash(): void {
    this.volatile = new Map(this.durable);
  }

  corrupt(key: string, value: unknown): void {
    this.volatile.set(key, value);
    this.durable.set(key, value);
  }

  corruptVolatile(key: string, value: unknown): void {
    this.volatile.set(key, value);
  }

  physicalValue(key: string): unknown {
    return this.volatile.get(key);
  }
}

function testDurabilityBoundary(storage: FakeWxStorage): WxDurabilityBoundary {
  return {
    attestationId: 'TEST-ONLY-volatile-to-durable-v1',
    async attest(): Promise<void> {
      storage.attest();
    },
  };
}

async function checkStorageJournal(): Promise<void> {
  const unattestedWx = new FakeWxStorage();
  const unattested = new WxJournalStoragePort(unattestedWx, {
    namespace: 'test:unattested',
  });
  await unattested.write('key', 'candidate');
  await rejectsWithCode(
    () => unattested.flush(),
    WxJournalStorageError,
    'durability-unattested',
    'default wx storage cannot claim a durable boundary',
  );

  const wx = new FakeWxStorage();
  const storage = new WxJournalStoragePort(wx, {
    namespace: 'test:power',
    durabilityBoundary: testDurabilityBoundary(wx),
  });
  equal(storage.durability, 'requires-flush', 'wx journal declares requires-flush');
  equal(
    storage.durabilityAttestationId,
    'TEST-ONLY-volatile-to-durable-v1',
    'adapter exposes the injected attestation identity',
  );
  await storage.write('from', 'old-value');
  await storage.write('prefix:one', 'one');
  await storage.flush();
  wx.crash();
  equal(await storage.read('from'), 'old-value', 'flushed initial value survives crash');
  equal(
    (await storage.listKeys('prefix:')).join(','),
    'prefix:one',
    'logical listKeys never exposes physical slots',
  );

  await storage.replaceAtomic('from', 'to');
  equal(await storage.read('from'), null, 'candidate snapshot removes source atomically');
  equal(await storage.read('to'), 'old-value', 'candidate snapshot installs target atomically');
  wx.crash();
  equal(await storage.read('from'), 'old-value', 'crash before flush restores old snapshot');
  equal(await storage.read('to'), null, 'crash before flush exposes no half replace');

  await storage.replaceAtomic('from', 'to');
  await storage.flush();
  wx.crash();
  equal(await storage.read('from'), null, 'flushed replace keeps source absent');
  equal(await storage.read('to'), 'old-value', 'flushed replace keeps target value');

  const loneSurrogate = '\ud800';
  await storage.write('raw-code-units', loneSurrogate);
  await storage.flush();
  equal(
    await storage.read('raw-code-units'),
    loneSurrogate,
    'journal preserves arbitrary JavaScript string code units',
  );
  await rejectsWithCode(
    () => storage.replaceAtomic('missing', 'target'),
    WxJournalStorageError,
    'missing-source',
    'replaceAtomic fails closed for a missing source',
  );

  const readbackWx = new FakeWxStorage();
  const readbackStorage = new WxJournalStoragePort(readbackWx, {
    namespace: 'test:readback',
    durabilityBoundary: testDurabilityBoundary(readbackWx),
  });
  await readbackStorage.write('stable', 'v1');
  await readbackStorage.flush();
  readbackWx.failNextReadback();
  await rejectsWithCode(
    () => readbackStorage.write('stable', 'v2'),
    WxJournalStorageError,
    'readback-mismatch',
    'wrong physical readback rejects the candidate',
  );
  readbackWx.crash();
  equal(await readbackStorage.read('stable'), 'v1', 'readback failure preserves durable state');

  const tornWx = new FakeWxStorage();
  const tornStorage = new WxJournalStoragePort(tornWx, {
    namespace: 'test:torn',
    durabilityBoundary: testDurabilityBoundary(tornWx),
  });
  await tornStorage.write('stable', 'v1');
  await tornStorage.flush();
  tornWx.corruptNextPhysicalWrite();
  await rejectsWithCode(
    () => tornStorage.write('stable', 'v2'),
    WxJournalStorageError,
    'readback-mismatch',
    'torn physical slot is rejected',
  );
  equal(await tornStorage.read('stable'), 'v1', 'valid old slot recovers from torn new slot');

  const preflushWx = new FakeWxStorage();
  const preflushStorage = new WxJournalStoragePort(preflushWx, {
    namespace: 'test:preflush-loss',
    durabilityBoundary: testDurabilityBoundary(preflushWx),
  });
  await preflushStorage.write('stable', 'v1');
  await preflushStorage.flush();
  await preflushStorage.write('stable', 'v2');
  preflushWx.corruptVolatile(preflushStorage.physicalKeys.b, '{broken');
  await rejectsWithCode(
    () => preflushStorage.flush(),
    WxJournalStorageError,
    'durability-failed',
    'flush rejects when its latest readback-confirmed candidate disappears',
  );
  preflushWx.crash();
  equal(
    await preflushStorage.read('stable'),
    'v1',
    'failed preflush candidate loss leaves the previous durable snapshot',
  );

  const recoveryWx = new FakeWxStorage();
  const diagnostics: string[] = [];
  const recoveryStorage = new WxJournalStoragePort(recoveryWx, {
    namespace: 'test:slot-recovery',
    durabilityBoundary: testDurabilityBoundary(recoveryWx),
    onDiagnostic: (event) => diagnostics.push(event.type),
  });
  await recoveryStorage.write('key', 'generation-1');
  await recoveryStorage.flush();
  const generationOneSlot = recoveryStorage.physicalKeys.a;
  await recoveryStorage.write('key', 'generation-2');
  await recoveryStorage.flush();
  const generationTwoSlot = recoveryStorage.physicalKeys.b;
  assert(
    typeof recoveryWx.physicalValue(generationOneSlot) === 'string',
    'older slot is present',
  );
  recoveryWx.corrupt(generationTwoSlot, '{broken');
  const afterCorruption = new WxJournalStoragePort(recoveryWx, {
    namespace: 'test:slot-recovery',
    durabilityBoundary: testDurabilityBoundary(recoveryWx),
    onDiagnostic: (event) => diagnostics.push(event.type),
  });
  equal(
    await afterCorruption.read('key'),
    'generation-1',
    'checksum-invalid newest slot falls back to the valid older generation',
  );
  assert(
    diagnostics.includes('corrupt-slot-ignored'),
    'slot recovery emits corruption diagnostics',
  );
  recoveryWx.corrupt(generationOneSlot, 42);
  await rejectsWithCode(
    () => afterCorruption.read('key'),
    WxJournalStorageError,
    'corrupt-journal',
    'loss of both valid slots blocks without overwriting physical evidence',
  );

  const clientWx = new FakeWxStorage();
  const clientStorage = new WxJournalStoragePort(clientWx, {
    namespace: 'infinite-flow:journal:v1',
    durabilityBoundary: testDurabilityBoundary(clientWx),
  });
  const installationEpochKey = 'infinite-flow:installation-epoch:v1';
  const formalKey = 'infinite-flow:save';
  const temporaryKey = 'infinite-flow:save:tmp';
  const backupKey = 'infinite-flow:save:backup';
  await clientStorage.write(installationEpochKey, 'epoch-7');
  equal(
    await clientStorage.read(installationEpochKey),
    'epoch-7',
    'installation epoch participates in the same logical journal',
  );
  await clientStorage.flush();
  await clientStorage.write(formalKey, 'save-v1');
  await clientStorage.flush();
  await clientStorage.write(temporaryKey, 'save-v2');
  await clientStorage.write(backupKey, 'save-v1');
  await clientStorage.flush();
  await clientStorage.replaceAtomic(temporaryKey, formalKey);
  await clientStorage.flush();
  clientWx.crash();
  equal(
    await clientStorage.read(installationEpochKey),
    'epoch-7',
    'session promotion preserves the installation epoch key',
  );
  equal(
    await clientStorage.read(formalKey),
    'save-v2',
    'session temporary key promotes to formal after durable flush',
  );
  equal(
    await clientStorage.read(temporaryKey),
    null,
    'session promotion removes the temporary key',
  );
  equal(
    await clientStorage.read(backupKey),
    'save-v1',
    'session promotion retains the independently journaled backup',
  );
  equal(
    (await clientStorage.listKeys('infinite-flow:')).join(','),
    [backupKey, formalKey, installationEpochKey].sort().join(','),
    'one namespace lists epoch and session keys without physical journal slots',
  );
}

class FakeCryptoApi implements WxUserCryptoApi {
  calls = 0;
  readonly responses: Uint8Array[] = [];
  failure: unknown | undefined;

  getUserCryptoManager(): WxUserCryptoManager {
    return {
      getRandomValues: (options): void => {
        this.calls += 1;
        if (this.failure !== undefined) {
          options.fail?.(this.failure);
          return;
        }
        const bytes = this.responses.shift() ?? new Uint8Array(options.length);
        const exact = Uint8Array.from(bytes);
        const result: WxRandomValuesSuccess = {
          randomValues: exact.buffer as ArrayBuffer,
        };
        options.success?.(result);
      },
    };
  }
}

type PendingRandomRequest = Parameters<
  WxUserCryptoManager['getRandomValues']
>[0];

class DeferredCryptoApi implements WxUserCryptoApi {
  readonly requests: PendingRandomRequest[] = [];

  getUserCryptoManager(): WxUserCryptoManager {
    return {
      getRandomValues: (options): void => {
        this.requests.push(options);
      },
    };
  }

  succeed(index: number, bytes: Uint8Array): void {
    const request = this.requests[index];
    raceAssert(request !== undefined, `deferred crypto request ${index} exists`);
    raceEqual(
      bytes.byteLength,
      request.length,
      `deferred crypto request ${index} receives the requested byte length`,
    );
    request.success?.({ randomValues: bytes.buffer as ArrayBuffer });
  }
}

async function checkSecureSeedPool(): Promise<void> {
  const crypto = new FakeCryptoApi();
  crypto.responses.push(
    Uint8Array.from([
      0x00, 0x00, 0x00, 0x01,
      0xff, 0xff, 0xff, 0xff,
      0x12, 0x34, 0x56, 0x78,
    ]),
  );
  const seeds = new PrefilledSecureSeedPort(crypto, { capacity: 3 });
  let exhausted = false;
  try {
    seeds.nextNonZeroUint32();
  } catch (error) {
    exhausted = error instanceof SecureSeedError && error.code === 'seed-pool-exhausted';
  }
  assert(exhausted, 'empty secure seed pool fails closed synchronously');
  await Promise.all([seeds.prefill(), seeds.prefill()]);
  equal(crypto.calls, 1, 'concurrent prefill calls share one crypto request');
  equal(seeds.available, 3, 'prefill exposes only completed secure values');
  equal(seeds.nextNonZeroUint32(), 1, 'secure bytes use documented big-endian uint32');
  equal(seeds.nextNonZeroUint32(), 0xffff_ffff, 'maximum uint32 remains valid');
  equal(seeds.nextNonZeroUint32(), 0x1234_5678, 'seed byte order is deterministic');

  const zeros = new FakeCryptoApi();
  zeros.responses.push(new Uint8Array(8));
  const zeroSeeds = new PrefilledSecureSeedPort(zeros, {
    capacity: 2,
    maxRefillRounds: 1,
  });
  await rejectsWithCode(
    () => zeroSeeds.prefill(),
    SecureSeedError,
    'insufficient-nonzero-values',
    'all-zero crypto output never degrades to seed zero',
  );
  equal(zeroSeeds.available, 0, 'failed refill clears partial entropy pool');

  const failed = new FakeCryptoApi();
  failed.failure = new Error('permission');
  const failedSeeds = new PrefilledSecureSeedPort(failed, { capacity: 1 });
  await rejectsWithCode(
    () => failedSeeds.prefill(),
    SecureSeedError,
    'crypto-request-failed',
    'wx crypto callback failure is classified',
  );

  const reusableCrypto = new DeferredCryptoApi();
  const reusableSeeds = new PrefilledSecureSeedPort(reusableCrypto, {
    capacity: 1,
  });
  const invalidatedPrefill = reusableSeeds.prefill();
  raceEqual(reusableCrypto.requests.length, 1, 'first deferred refill starts');
  reusableSeeds.clear();
  const newerPrefill = reusableSeeds.prefill();
  raceEqual(
    reusableCrypto.requests.length,
    2,
    'clear detaches the stale refill so a reusable pool can start a newer one',
  );
  const lateBytes = Uint8Array.from([0x12, 0x34, 0x56, 0x78]);
  reusableCrypto.succeed(0, lateBytes);
  await raceRejectsWithCode(
    () => invalidatedPrefill,
    'seed-pool-invalidated',
    'a clear boundary rejects its outstanding refill',
  );
  raceAssert(
    lateBytes.every((value) => value === 0),
    'late callback bytes are zeroed after an invalidated refill',
  );
  raceEqual(
    reusableSeeds.available,
    0,
    'late invalidated entropy never repopulates the reusable pool',
  );
  const coalescedNewerPrefill = reusableSeeds.prefill();
  raceEqual(
    coalescedNewerPrefill,
    newerPrefill,
    'the stale promise finally does not detach a newer refill',
  );
  raceEqual(
    reusableCrypto.requests.length,
    2,
    'coalescing after stale settlement does not start a third crypto request',
  );
  const newerBytes = Uint8Array.from([0x87, 0x65, 0x43, 0x21]);
  reusableCrypto.succeed(1, newerBytes);
  await newerPrefill;
  raceEqual(
    reusableSeeds.nextNonZeroUint32(),
    0x8765_4321,
    'the newer generation remains consumable after stale settlement',
  );

  const disposedCrypto = new DeferredCryptoApi();
  const disposedSeeds = new PrefilledSecureSeedPort(disposedCrypto, {
    capacity: 1,
  });
  const disposedPrefill = disposedSeeds.prefill();
  disposedSeeds.dispose();
  const disposedLateBytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
  disposedCrypto.succeed(0, disposedLateBytes);
  await raceRejectsWithCode(
    () => disposedPrefill,
    'seed-port-disposed',
    'dispose permanently rejects its outstanding refill',
  );
  raceAssert(
    disposedLateBytes.every((value) => value === 0),
    'late callback bytes are zeroed after permanent disposal',
  );
  raceEqual(disposedSeeds.available, 0, 'disposed entropy never reaches the pool');
  await raceRejectsWithCode(
    () => disposedSeeds.prefill(),
    'seed-port-disposed',
    'a disposed seed port cannot be reused',
  );
}

class FakeLifecycleApi implements WxLifecycleApi {
  readonly hide = new Set<() => void>();
  readonly show = new Set<() => void>();
  readonly memory = new Set<() => void>();
  readonly calls: string[] = [];
  readonly onHideListeners: Array<() => void> = [];
  readonly offHideListeners: Array<() => void> = [];
  readonly onShowListeners: Array<() => void> = [];
  readonly offShowListeners: Array<() => void> = [];
  readonly onMemoryWarningListeners: Array<() => void> = [];
  readonly offMemoryWarningListeners: Array<() => void> = [];
  readonly failUnregistration = new Set<'hide' | 'show' | 'memory-warning'>();
  failRegistration: 'show' | 'memory-warning' | undefined;

  onHide(listener: () => void): void {
    this.calls.push('onHide');
    this.onHideListeners.push(listener);
    this.hide.add(listener);
  }

  offHide(listener: () => void): void {
    this.calls.push('offHide');
    this.offHideListeners.push(listener);
    this.hide.delete(listener);
    if (this.failUnregistration.has('hide')) {
      throw new Error('hide unregistration rejected');
    }
  }

  onShow(listener: () => void): void {
    this.calls.push('onShow');
    this.onShowListeners.push(listener);
    if (this.failRegistration === 'show') {
      throw new Error('show registration rejected');
    }
    this.show.add(listener);
  }

  offShow(listener: () => void): void {
    this.calls.push('offShow');
    this.offShowListeners.push(listener);
    this.show.delete(listener);
    if (this.failUnregistration.has('show')) {
      throw new Error('show unregistration rejected');
    }
  }

  onMemoryWarning(listener: () => void): void {
    this.calls.push('onMemoryWarning');
    this.onMemoryWarningListeners.push(listener);
    if (this.failRegistration === 'memory-warning') {
      throw new Error('memory warning registration rejected');
    }
    this.memory.add(listener);
  }

  offMemoryWarning(listener: () => void): void {
    this.calls.push('offMemoryWarning');
    this.offMemoryWarningListeners.push(listener);
    this.memory.delete(listener);
    if (this.failUnregistration.has('memory-warning')) {
      throw new Error('memory warning unregistration rejected');
    }
  }

  emitHide(): void {
    for (const listener of [...this.hide]) listener();
  }

  emitShow(): void {
    for (const listener of [...this.show]) listener();
  }

  emitMemory(): void {
    for (const listener of [...this.memory]) listener();
  }
}

function registerLifecycleTransaction(lifecycle: WxLifecycleAdapter): void {
  const registered: Array<() => void> = [];
  try {
    registered.push(lifecycle.onSuspend(async () => ({
      status: 'durable',
      durableRevision: 0,
      ledgerRevision: 0,
    })));
    registered.push(lifecycle.onResume(() => undefined));
    registered.push(lifecycle.onMemoryWarning(() => undefined));
  } catch (registrationError) {
    const rollbackErrors: unknown[] = [];
    for (let index = registered.length - 1; index >= 0; index -= 1) {
      try {
        registered[index]?.();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [registrationError, ...rollbackErrors],
        'Lifecycle registration failed and rollback encountered errors',
      );
    }
    throw registrationError;
  }
}

async function checkLifecycle(): Promise<void> {
  const completeCapability: Record<string, unknown> = {
    onHide: () => undefined,
    offHide: () => undefined,
    onShow: () => undefined,
    offShow: () => undefined,
    onMemoryWarning: () => undefined,
    offMemoryWarning: () => undefined,
  };
  raceEqual(
    missingRequiredWxLifecycleMethods(completeCapability).length,
    0,
    'complete wx lifecycle capability passes the composition gate',
  );
  for (const missingOff of [
    'offHide',
    'offShow',
    'offMemoryWarning',
  ] as const) {
    const incompleteCapability = { ...completeCapability };
    delete incompleteCapability[missingOff];
    raceEqual(
      missingRequiredWxLifecycleMethods(incompleteCapability).join(','),
      missingOff,
      `composition gate blocks a host missing ${missingOff}`,
    );
    let adapterError: unknown;
    try {
      new WxLifecycleAdapter(incompleteCapability as unknown as WxLifecycleApi);
    } catch (error) {
      adapterError = error;
    }
    raceAssert(
      adapterError instanceof WxLifecycleError
        && adapterError.code === 'invalid-config'
        && adapterError.message.includes(missingOff),
      `adapter constructor blocks a host missing ${missingOff}`,
    );
  }

  const wx = new FakeLifecycleApi();
  const observedBudgets: Array<number | undefined> = [];
  const reported: LifecycleFlushResult[][] = [];
  const lifecycle = new WxLifecycleAdapter(wx, {
    hideBudgetMs: 25,
    onSuspendResults: (results) => reported.push([...results]),
  });
  const unsubscribeSuspend = lifecycle.onSuspend(async (context) => {
    observedBudgets.push(context.remainingTimeMs);
    return { status: 'durable', durableRevision: 4, ledgerRevision: 7 };
  });
  let resumes = 0;
  let warnings = 0;
  const unsubscribeResume = lifecycle.onResume(() => {
    resumes += 1;
  });
  const unsubscribeWarning = lifecycle.onMemoryWarning(() => {
    warnings += 1;
  });
  equal(wx.hide.size, 1, 'adapter registers one wx hide multiplexer');
  equal(wx.show.size, 1, 'adapter registers one wx show multiplexer');
  equal(wx.memory.size, 1, 'adapter registers one wx memory multiplexer');
  wx.emitHide();
  const results = await lifecycle.waitForLastSuspend();
  equal(observedBudgets[0], 25, 'hide passes the configured remaining budget');
  equal(results[0]?.status, 'durable', 'hide tracks asynchronous flush result');
  equal(reported[0]?.[0]?.status, 'durable', 'hide exposes result diagnostics');
  wx.emitShow();
  wx.emitMemory();
  equal(resumes, 1, 'show dispatches resume listener');
  equal(warnings, 1, 'memory warning dispatches listener');
  unsubscribeSuspend();
  unsubscribeSuspend();
  unsubscribeResume();
  unsubscribeWarning();
  equal(wx.hide.size, 0, 'last suspend unsubscribe calls wx.offHide');
  equal(wx.show.size, 0, 'last resume unsubscribe calls wx.offShow');
  equal(wx.memory.size, 0, 'last warning unsubscribe calls wx.offMemoryWarning');
  raceEqual(
    wx.offHideListeners[0],
    wx.onHideListeners[0],
    'wx.offHide receives the exact wx.onHide handler',
  );
  raceEqual(
    wx.offShowListeners[0],
    wx.onShowListeners[0],
    'wx.offShow receives the exact wx.onShow handler',
  );
  raceEqual(
    wx.offMemoryWarningListeners[0],
    wx.onMemoryWarningListeners[0],
    'wx.offMemoryWarning receives the exact wx.onMemoryWarning handler',
  );
  lifecycle.dispose();

  const secondRegistrationWx = new FakeLifecycleApi();
  secondRegistrationWx.failRegistration = 'show';
  const secondRegistrationLifecycle = new WxLifecycleAdapter(
    secondRegistrationWx,
  );
  let secondRegistrationError: unknown;
  try {
    registerLifecycleTransaction(secondRegistrationLifecycle);
  } catch (error) {
    secondRegistrationError = error;
  }
  raceAssert(
    secondRegistrationError instanceof WxLifecycleError
      && secondRegistrationError.code === 'registration-failed',
    'second lifecycle registration failure remains classified',
  );
  raceEqual(
    secondRegistrationWx.calls.join(','),
    'onHide,onShow,offHide',
    'second registration failure rolls back the first subscription in reverse',
  );
  raceEqual(
    secondRegistrationWx.offHideListeners[0],
    secondRegistrationWx.onHideListeners[0],
    'second registration rollback uses the exact hide handler',
  );
  raceEqual(
    secondRegistrationWx.hide.size,
    0,
    'second registration failure leaves no prior platform subscription',
  );

  const thirdRegistrationWx = new FakeLifecycleApi();
  thirdRegistrationWx.failRegistration = 'memory-warning';
  thirdRegistrationWx.failUnregistration.add('show');
  const thirdDiagnostics: unknown[] = [];
  const thirdRegistrationLifecycle = new WxLifecycleAdapter(
    thirdRegistrationWx,
    { onListenerError: (_phase, error) => thirdDiagnostics.push(error) },
  );
  let thirdRegistrationError: unknown;
  try {
    registerLifecycleTransaction(thirdRegistrationLifecycle);
  } catch (error) {
    thirdRegistrationError = error;
  }
  raceAssert(
    thirdRegistrationError instanceof AggregateError,
    'third registration failure aggregates rollback diagnostics',
  );
  if (thirdRegistrationError instanceof AggregateError) {
    raceEqual(
      thirdRegistrationError.errors.length,
      2,
      'aggregate contains registration and offShow failures',
    );
    raceAssert(
      thirdRegistrationError.errors.every(
        (error) => error instanceof WxLifecycleError,
      ),
      'aggregate preserves stable lifecycle error objects',
    );
  }
  raceEqual(
    thirdRegistrationWx.calls.join(','),
    'onHide,onShow,onMemoryWarning,offShow,offHide',
    'third registration failure continues reverse rollback after offShow throws',
  );
  raceEqual(
    thirdRegistrationWx.offShowListeners[0],
    thirdRegistrationWx.onShowListeners[0],
    'third registration rollback uses the exact show handler',
  );
  raceEqual(
    thirdRegistrationWx.offHideListeners[0],
    thirdRegistrationWx.onHideListeners[0],
    'third registration rollback uses the exact hide handler',
  );
  raceEqual(
    thirdRegistrationWx.hide.size,
    0,
    'offShow failure does not retain the earlier hide subscription',
  );
  raceAssert(
    thirdDiagnostics[0] instanceof WxLifecycleError
      && thirdDiagnostics[0].code === 'unregistration-failed',
    'offShow rollback failure reaches lifecycle diagnostics',
  );
  thirdRegistrationWx.failUnregistration.clear();
  thirdRegistrationLifecycle.dispose();

  const registrationFailure = new WxLifecycleAdapter({
    onHide: () => {
      throw new Error('registration rejected');
    },
    offHide: () => undefined,
    onShow: () => undefined,
    offShow: () => undefined,
    onMemoryWarning: () => undefined,
    offMemoryWarning: () => undefined,
  });
  let classifiedRegistrationFailure = false;
  try {
    registrationFailure.onSuspend(async () => ({
      status: 'durable',
      durableRevision: 0,
      ledgerRevision: 0,
    }));
  } catch (error) {
    classifiedRegistrationFailure =
      error instanceof WxLifecycleError &&
      error.code === 'registration-failed';
  }
  assert(
    classifiedRegistrationFailure,
    'wx lifecycle registration failures have a stable error code',
  );
}

class FakeAssetLoader implements CocosAssetLoader {
  readonly source = new Map<string, unknown>();
  readonly cache = new Map<string, unknown>();
  readonly failures = new Map<string, unknown>();
  readonly peekFailures = new Map<string, unknown>();
  readonly released: unknown[] = [];
  readonly loadedPaths: string[] = [];

  peek(resourcePath: string): unknown | null {
    const failure = this.peekFailures.get(resourcePath);
    if (failure !== undefined) throw failure;
    return this.cache.get(resourcePath) ?? null;
  }

  async load(resourcePath: string): Promise<unknown> {
    this.loadedPaths.push(resourcePath);
    const failure = this.failures.get(resourcePath);
    if (failure !== undefined) throw failure;
    const value = this.source.get(resourcePath);
    if (value === undefined) throw { code: 'decode', retryable: false };
    this.cache.set(resourcePath, value);
    return value;
  }

  release(nativeHandle: unknown): void {
    this.released.push(nativeHandle);
    for (const [path, value] of this.cache) {
      if (value === nativeHandle) this.cache.delete(path);
    }
  }
}

class DeferredAssetLoader implements CocosAssetLoader {
  readonly cache = new Map<string, unknown>();
  readonly released: unknown[] = [];
  private resolvePending: ((value: unknown) => void) | undefined;

  peek(resourcePath: string): unknown | null {
    return this.cache.get(resourcePath) ?? null;
  }

  load(resourcePath: string): Promise<unknown> {
    return new Promise((resolve) => {
      this.resolvePending = (value) => {
        this.cache.set(resourcePath, value);
        resolve(value);
      };
    });
  }

  complete(value: unknown): void {
    const resolve = this.resolvePending;
    this.resolvePending = undefined;
    if (resolve === undefined) throw new Error('No deferred asset load pending');
    resolve(value);
  }

  release(nativeHandle: unknown): void {
    this.released.push(nativeHandle);
    for (const [path, value] of this.cache) {
      if (value === nativeHandle) this.cache.delete(path);
    }
  }
}

async function checkAssets(): Promise<void> {
  const timeoutByName = new Error('Creator request did not complete');
  timeoutByName.name = 'TimeoutError';
  equal(
    classifyCocosAssetError(timeoutByName).code,
    'timeout',
    'ordinary Creator TimeoutError is retryable timeout',
  );
  equal(
    classifyCocosAssetError(timeoutByName).retryable,
    true,
    'timeout classification is retryable',
  );
  equal(
    classifyCocosAssetError(
      new Error('Network request failed because device is offline'),
    ).code,
    'offline',
    'ordinary network/offline message is retryable offline',
  );
  equal(
    classifyCocosAssetError(
      new Error('resource path assets/missing-image was not found'),
    ).code,
    'unknown-key',
    'missing native path uses the non-retryable runtime compatibility code',
  );
  equal(
    classifyCocosAssetError(
      new SyntaxError('Invalid JSON payload at path assets/config'),
    ).code,
    'decode',
    'parse/decode/invalid errors are non-retryable decode failures',
  );
  equal(
    classifyCocosAssetError(new Error('mysterious Creator failure')).code,
    'decode',
    'unknown ordinary Error is conservatively non-network decode',
  );
  equal(
    classifyCocosAssetError(new Error('mysterious Creator failure')).retryable,
    false,
    'unknown ordinary Error is not retried',
  );

  const loader = new FakeAssetLoader();
  const assetDiagnostics: Array<Readonly<{
    key: string;
    revision: string;
    code: string;
    cause?: unknown;
  }>> = [];
  const monsterHandle = { name: 'monster' };
  const dungeonHandle = { name: 'dungeon' };
  const ordinaryTimeout = new Error('image load timed out');
  loader.source.set('monster/m1', monsterHandle);
  loader.source.set('dungeon/d1', dungeonHandle);
  loader.failures.set('item/bad', { code: 'offline', retryable: true });
  loader.failures.set('item/ordinary-timeout', ordinaryTimeout);
  loader.peekFailures.set('item/peek-bad', {
    code: 'unsupported',
    retryable: false,
  });
  const assets = new ManifestCocosAssetPort({
    manifest: {
      manifestRevision: 'sha256:test-revision',
      assets: [
        {
          key: 'monster:m1',
          kind: 'monster',
          resourcePath: 'monster/m1',
          groups: ['chapter-1'],
        },
        {
          key: 'dungeon:d1',
          kind: 'dungeon',
          resourcePath: 'dungeon/d1',
          groups: ['chapter-1'],
        },
        {
          key: 'item:bad',
          kind: 'item',
          resourcePath: 'item/bad',
          groups: ['chapter-1'],
        },
        {
          key: 'pet:old-revision',
          kind: 'pet',
          resourcePath: 'pet/old',
          manifestRevision: 'sha256:other',
        },
        {
          key: 'item:peek-bad',
          kind: 'item',
          resourcePath: 'item/peek-bad',
        },
        {
          key: 'item:ordinary-timeout',
          kind: 'item',
          resourcePath: 'item/ordinary-timeout',
        },
      ],
    },
    loader,
    fallbackFactory: (kind) => ({ fallback: kind }),
    onDiagnostic: (diagnostic) => assetDiagnostics.push(diagnostic),
  });
  const beforeLoad = assets.resolve('monster:m1');
  assert(!beforeLoad.ok && beforeLoad.code === 'cancelled', 'known unloaded asset is retryable');
  const unknown = assets.resolve('monster:missing');
  assert(!unknown.ok && unknown.code === 'unknown-key', 'unknown key is classified');
  const peekFailure = assets.resolve('item:peek-bad');
  assert(
    !peekFailure.ok && peekFailure.code === 'unsupported',
    'synchronous Cocos cache failures stay inside the AssetResult taxonomy',
  );
  const report = await assets.preload('chapter-1');
  equal(report.revision, 'sha256:test-revision', 'preload report carries manifest revision');
  equal(
    report.loadedKeys.join(','),
    'dungeon:d1,monster:m1',
    'group preload returns stable sorted keys',
  );
  equal(report.failures[0]?.code, 'offline', 'loader failure keeps error taxonomy');
  equal(report.failures[0]?.retryable, true, 'offline failure remains retryable');
  assert(
    assetDiagnostics.some(
      (diagnostic) =>
        diagnostic.key === 'item:bad' &&
        diagnostic.revision === 'sha256:test-revision' &&
        diagnostic.code === 'offline',
    ),
    'asset diagnostics contain key, manifest revision, and classified code',
  );
  const resolved = assets.resolve('monster:m1');
  assert(resolved.ok, 'preloaded manifest key resolves');
  if (resolved.ok) {
    equal(
      resolved.value.manifestRevision,
      'sha256:test-revision',
      'asset handle carries immutable revision',
    );
    equal(resolved.value.nativeHandle, monsterHandle, 'resolve returns native loader handle');
  }
  const mismatch = assets.resolve('pet:old-revision');
  assert(
    !mismatch.ok && mismatch.code === 'revision-mismatch',
    'entry revision mismatch never mixes builds',
  );
  const fallback = assets.fallback('monster');
  equal(
    fallback.manifestRevision,
    'sha256:test-revision',
    'fallback handle carries the same manifest revision',
  );
  equal(
    assets.fallback('monster'),
    fallback,
    'fallback handles are stable per kind',
  );
  const unknownGroup = await assets.preload('missing-group');
  equal(unknownGroup.failures[0]?.code, 'unknown-key', 'unknown group is visible in report');
  const ordinaryTimeoutResult = await assets.preloadKey('item:ordinary-timeout');
  assert(
    !ordinaryTimeoutResult.ok
      && ordinaryTimeoutResult.code === 'timeout'
      && ordinaryTimeoutResult.retryable,
    'ordinary Error reaches the same stable timeout taxonomy',
  );
  assert(
    assetDiagnostics.some(
      (diagnostic) => diagnostic.key === 'item:ordinary-timeout'
        && diagnostic.cause === ordinaryTimeout,
    ),
    'asset diagnostic preserves the exact ordinary Error cause',
  );

  await assets.preload('monster');
  assets.release('chapter-1');
  assert(
    !loader.released.includes(monsterHandle),
    'shared key remains loaded while another group references it',
  );
  assert(loader.released.includes(dungeonHandle), 'group-only key is released');
  assets.release('monster');
  assert(loader.released.includes(monsterHandle), 'last group release frees native handle');

  const monsterReleaseCount = loader.released.filter(
    (handle) => handle === monsterHandle,
  ).length;
  const monsterLoadCount = loader.loadedPaths.filter(
    (path) => path === 'monster/m1',
  ).length;
  const [firstDirect, secondDirect] = await Promise.all([
    assets.preloadKey('monster:m1'),
    assets.preloadKey('monster:m1'),
  ]);
  assert(firstDirect.ok && secondDirect.ok, 'single-key concurrent preload succeeds');
  equal(
    loader.loadedPaths.filter((path) => path === 'monster/m1').length,
    monsterLoadCount + 1,
    'concurrent single-key leases share one native load',
  );
  equal(
    assets.describeKey('monster:m1')?.syntheticGroup,
    '@asset:monster:m1',
    'single-key diagnostic group cannot collide with manifest groups',
  );
  equal(
    assets.describeKey('monster:m1')?.resourcePath,
    'monster/m1',
    'single-key diagnostics retain the manifest resource path',
  );
  assets.releaseKey('monster:m1');
  equal(
    loader.released.filter((handle) => handle === monsterHandle).length,
    monsterReleaseCount,
    'first of two direct releases preserves the shared native handle',
  );
  assets.releaseKey('monster:m1');
  equal(
    loader.released.filter((handle) => handle === monsterHandle).length,
    monsterReleaseCount + 1,
    'last direct release frees the native handle exactly once',
  );
  assets.releaseKey('monster:m1');
  equal(
    loader.released.filter((handle) => handle === monsterHandle).length,
    monsterReleaseCount + 1,
    'unowned direct release is an idempotent no-op',
  );

  const deferredLoader = new DeferredAssetLoader();
  const reacquiredHandle = { name: 'reacquired' };
  const reacquiredAssets = new ManifestCocosAssetPort({
    manifest: {
      manifestRevision: 'sha256:reacquire',
      assets: [{
        key: 'item:reacquire',
        kind: 'item',
        resourcePath: 'item/reacquire',
        groups: ['reacquire'],
      }],
    },
    loader: deferredLoader,
    fallbackFactory: (kind) => ({ fallback: kind }),
  });
  const firstGroupLoad = reacquiredAssets.preload('reacquire');
  reacquiredAssets.release('reacquire');
  const secondGroupLoad = reacquiredAssets.preload('reacquire');
  equal(
    secondGroupLoad,
    firstGroupLoad,
    'group reacquire shares the original in-flight Promise',
  );
  deferredLoader.complete(reacquiredHandle);
  await secondGroupLoad;
  const reacquired = reacquiredAssets.resolve('item:reacquire');
  assert(
    reacquired.ok && reacquired.value.nativeHandle === reacquiredHandle,
    'reacquire cancels deferred release and leaves the group loaded',
  );
  equal(
    deferredLoader.released.length,
    0,
    'cancelled deferred release does not free the reacquired group',
  );
  reacquiredAssets.release('reacquire');
  equal(
    deferredLoader.released[0],
    reacquiredHandle,
    'the final group release frees the exact reacquired handle once',
  );

  const resourceAsset = { type: 'SpriteFrame' };
  const resources: CocosResourcesLike = {
    get: () => null,
    // Creator 3.8.8 may omit the error argument on a successful callback.
    load: (_path, _type, callback) => callback(undefined, resourceAsset),
    release: (asset) => loader.released.push(asset),
  };
  const bridge = new CocosResourcesLoader(resources, { name: 'SpriteFrame' });
  equal(
    await bridge.load('path'),
    resourceAsset,
    'cc resources callback bridge accepts undefined as success',
  );
  bridge.release(resourceAsset);
  assert(loader.released.includes(resourceAsset), 'cc resources bridge releases asset');
}

export type PlatformSelfCheckReport = Readonly<{
  assertions: number;
  suites: readonly string[];
}>;

export async function runPlatformSelfCheck(): Promise<PlatformSelfCheckReport> {
  assertions = 0;
  await checkStorageJournal();
  await checkSecureSeedPool();
  await checkLifecycle();
  await checkAssets();
  return {
    assertions,
    suites: ['storage-journal', 'secure-seeds', 'lifecycle', 'assets'],
  };
}
