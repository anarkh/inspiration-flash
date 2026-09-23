# WeChat / Cocos platform adapters

This directory composes the platform-neutral `@infinite-flow/runtime` ports with
injected WeChat and Cocos capabilities. Production modules do not import DOM or
Node APIs, and the policy modules do not import `cc`; the Cocos entrypoint passes
`resources` and its chosen asset type into `CocosResourcesLoader`.

## Storage journal

`WxJournalStoragePort` stores the complete logical keyspace in two alternating
physical slots. Each snapshot contains a safe-integer generation, sorted key/value
entries, and a SHA-256 checksum over exact UTF-16 code units. A mutation writes the
inactive slot (or coalesces into the current unflushed candidate), reads back the
exact bytes, validates the checksum, and leaves the older slot intact. Therefore
`replaceAtomic(from, to)` is one logical snapshot transition: recovery observes the
entire old mapping or the entire new mapping, never a half-applied from/to pair.

The adapter deliberately declares `requires-flush`. `setStorageSync` plus immediate
`getStorageSync` is only a verified candidate; this code does **not** claim that wx
provides a filesystem-level atomic or durable promise. Without an injected
`WxDurabilityBoundary`, `flush()` throws `durability-unattested` and runtime durable
acknowledgement remains blocked. The boundary's `attestationId` must identify a
separately reviewed real-device result. The boundary used by
`cocos/headless/platform.self-check.ts` is a test-only volatile-to-durable simulator
and lives outside Creator's importable `assets/` tree.

The full-keyspace journal favors recoverability and simple atomic semantics over
write amplification. Real-device gates must still measure per-key size/quota,
latency during hide, storage behavior under force-kill, and whether synchronous wx
writes cross a sufficiently strong durability boundary. A single corrupt slot is
ignored in favor of the newest valid generation; two invalid slots or equal-generation
different bytes block and preserve physical evidence.

The default namespace is shared by every logical key. In particular,
`infinite-flow:installation-epoch:v1`, `infinite-flow:save`,
`infinite-flow:save:tmp`, and `infinite-flow:save:backup` are entries in the same
journal rather than separate physical storage protocols.

## Secure seeds

`PrefilledSecureSeedPort.prefill()` obtains bytes asynchronously through
`wx.getUserCryptoManager().getRandomValues`. It converts each four bytes to a
big-endian uint32, discards zero, and publishes the pool only after the callback
completes. `nextNonZeroUint32()` is synchronous as required by `SeedPort`; an empty
pool throws `seed-pool-exhausted`. There is no fallback to `Math.random`, a clock,
device identity, or a weak PRNG. Callers should prefill before opening commands that
create a new random lineage and explicitly replenish after consumption.

`clear()` is a reusable generation boundary: it zeroes the current pool, detaches
any pending refill, and lets a newer refill start immediately. A late callback is
zeroed and rejected as `seed-pool-invalidated`; its `finally` cannot detach or clear
the newer generation. `dispose()` applies the same invalidation and permanently
rejects future prefill/consumption as `seed-port-disposed`.

## Lifecycle

`WxLifecycleAdapter` multiplexes `onHide`, `onShow`, and `onMemoryWarning`, returning
idempotent unsubscribe functions and calling the matching `off*` API when present.
WeChat does not wait for an arbitrary Promise returned by an event callback, so hide
work is observable through `waitForLastSuspend()`/`onSuspendResults`; normal
per-command persistence remains the primary save path. Bind a session with:

```ts
const stopHide = lifecycle.onSuspend((context) => session.suspend(context));
const stopShow = lifecycle.onResume(() => {
  void session.resume();
});
```

## Assets

`ManifestCocosAssetPort` keeps manifest keys and `manifestRevision` stable, supports
`all`, per-kind, and explicit groups, coalesces concurrent loads, reference-counts
groups and direct-key leases, carries revision on every success/failure/fallback,
and preserves the nine runtime error codes. A known asset that has not yet been
preloaded is reported as retryable `cancelled`, because the protocol intentionally
has no `not-loaded` code. Concurrent direct-key requests share one native load but
each successful request owns one releaseable lease.

The runtime loads the pinned manifest `JsonAsset` from the local shared `config`
bundle, verifies its UUID, schema version, revision, exact 223-entry count, and
unique key/resource paths, then separately loads the shared `resources` bundle.
PNG resources are explicitly loaded as `ImageAsset`; no SpriteFrame subasset is
assumed. `InfiniteFlowView` creates its own SpriteFrame/Texture pair and cleanup is
ordered as detach Sprite, destroy SpriteFrame, destroy generated Texture, then
release the exact ImageAsset reference through `image.decRef()`. The matching
`image.addRef()` happens immediately after a successful `Bundle.load`; path-based
`Bundle.release` is forbidden because it could force-release another shared-cache
consumer. Neither shared bundle is removed or globally released by the app.

Ordinary Creator errors are classified without displaying their original message:
timeout and explicit network/offline failures are retryable; missing native paths,
decode/invalid input, and unknown failures are non-retryable. Bootstrap and
per-key image failures use mutually exclusive cancellable retry channels. Each
uses 250/1000/3000/10000/30000 ms deterministic backoff, remains capped at
30 seconds until recovery, and is fenced by the active key, port, view, and asset
generation. Switching keys, memory-pressure invalidation, disposal, success, or a
non-retryable failure cancels the applicable channel; a terminal per-key failure
remains a stable fallback until its key/port/generation changes.

Headless checks cover success, fallback diagnostics, direct-key reference counts,
eventual bootstrap/per-key recovery, key switching, terminal decode failures, and
stale/destroy/memory-warning races. Creator Preview and real-device smoke are still
required to attest the real ImageAsset importer, remote-bundle transport, rendered
contrast, and absence of a black frame on the supported device matrix.

## Self-check

After workspace dependencies are installed:

```sh
npm run platform:verify
npm run cocos:race:test

# Equivalent low-level platform self-check steps:
npm exec -- tsc -p cocos/headless/tsconfig.platform-self-check.json
npm exec -- esbuild cocos/headless/platform.self-check.ts --bundle --format=esm --platform=node --target=node22 --alias:@infinite-flow/runtime=./packages/runtime/src/index.ts --outfile=/tmp/infinite-flow-platform-self-check.mjs
node --input-type=module -e "const m = await import('file:///tmp/infinite-flow-platform-self-check.mjs'); console.log(JSON.stringify(await m.runPlatformSelfCheck()));"
```

`runPlatformSelfCheck()` in `cocos/headless/platform.self-check.ts` is an
environment-free executable function. It covers before/after-flush force-kill
behavior, atomic replace recovery,
torn/readback-failed writes, one-slot and two-slot corruption, unattested flush,
empty/all-zero/failed secure entropy, lifecycle async result tracking and cleanup,
clear/dispose during a deferred secure-entropy callback (including stale-versus-new
refill ownership), manifest revision/error/fallback behavior, group reference
counting, direct-key reference ownership, and the Cocos resources callback bridge.

This is platform foundation evidence only. It is not real-device durability,
weak-network/subpackage, memory-pressure, or rendered-visual acceptance evidence.
