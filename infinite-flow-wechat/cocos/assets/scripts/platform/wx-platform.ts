import type { HashPort } from '@infinite-flow/runtime';
import {
  PrefilledSecureSeedPort,
  type SecureSeedPoolOptions,
  type WxUserCryptoApi,
} from './wx-secure-seed';
import {
  WxJournalStoragePort,
  type WxDurabilityBoundary,
  type WxJournalDiagnostic,
  type WxSyncStorageApi,
} from './wx-journal-storage';
import {
  WxLifecycleAdapter,
  type WxLifecycleAdapterOptions,
  type WxLifecycleApi,
} from './wx-lifecycle';

export interface InjectableWxPlatformApi
  extends WxSyncStorageApi,
    WxUserCryptoApi,
    WxLifecycleApi {}

export type CreateWxPlatformPortsOptions = Readonly<{
  storage?: Readonly<{
    namespace?: string;
    hashPort?: HashPort;
    durabilityBoundary?: WxDurabilityBoundary;
    onDiagnostic?: (diagnostic: WxJournalDiagnostic) => void;
  }>;
  seeds?: SecureSeedPoolOptions;
  lifecycle?: WxLifecycleAdapterOptions;
}>;

/** Composition root; callers inject the real `wx` object after capability checks. */
export function createWxPlatformPorts(
  wx: InjectableWxPlatformApi,
  options: CreateWxPlatformPortsOptions = {},
): Readonly<{
  storage: WxJournalStoragePort;
  seeds: PrefilledSecureSeedPort;
  lifecycle: WxLifecycleAdapter;
}> {
  return {
    storage: new WxJournalStoragePort(wx, options.storage),
    seeds: new PrefilledSecureSeedPort(wx, options.seeds),
    lifecycle: new WxLifecycleAdapter(wx, options.lifecycle),
  };
}
