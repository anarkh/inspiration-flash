# `@infinite-flow/runtime`

Platform-neutral TypeScript foundations for the v2 mini-game migration. The
package has no runtime dependencies and compiles with an ES2020-only library
surface: it does not import DOM, Node, Cocos, clocks, platform entropy, or Web
Crypto APIs.

## Included

- Exact platform port contracts for storage, seeds, assets, lifecycle, input,
  legacy raw transfer, and injected SHA-256.
- Version 1 labeled seed derivation, persisted seed-lineage helpers, the legacy
  v0 portal formula, and a Mulberry32-compatible uint32 PRNG.
- Strict canonical JSON/UTF-8, canonical state-hash projection, and a portable
  SHA-256 adapter.
- A generic serialized `GameSession`: session-owned `<epoch>:<sequence>` IDs,
  durable receipts, independent state/ledger revisions, latest-256 retention,
  frozen state views, tmp/formal/backup promotion, and retry without rerunning
  the reducer or replaying events.
- Lifecycle-aware `suspend()`/`resume()` operations that close input, drain
  already accepted commands, expose durable/candidate revisions, seal a tmp on
  an exhausted deadline, and reopen input only after pending persistence lands.
- In-memory storage with distinct volatile/durable images plus one-shot storage
  fault injection for kill-boundary tests.

The caller must supply and persist a unique installation/account epoch, a state
decoder, intent validator, and pure reducer. A `committed` canonical no-op still
gets a ledger receipt but does not increment `stateRevision`.

The runtime intentionally owns no timer. `remainingTimeMs: 0` means the caller's
deadline is exhausted and produces a durably sealed `recoverable-timeout` when
there is a candidate; a positive budget attempts completion and reports either
`durable` or `blocked`.

## Validation

From `infinite-flow-wechat/`:

```sh
npm run typecheck -w @infinite-flow/runtime
npm test -w @infinite-flow/runtime
npm run build -w @infinite-flow/runtime
```

The executable self-check covers canonical/hash vectors, seed/PRNG vectors,
concurrent dispatch ordering, rejection and no-op revision semantics, durable
acknowledgements, fault retry, tmp recovery after a simulated crash, receipt
eviction/watermark behavior, and immutable state views.

## Stage-1 boundary

This is a conservative runtime foundation, not completion evidence for the
`AC-SAVE-*` release gates. In particular, the package does not yet implement the
save codec, historical migration, import/rejected indexes, or the rejected
payload/reason/index three-record sealing protocol. If any tracked tmp, formal,
or backup raw is invalid, unsupported, or checksum-invalid, startup blocks and
preserves every raw value instead of overwriting it. A later save-codec layer
must seal rejected evidence durably before recovery can safely continue.
