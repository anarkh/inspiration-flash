# `@infinite-flow/client`

Platform-neutral composition of the Infinite Flow application reducer and the
durable `GameSession`. It owns a persisted installation epoch, explicit run-entry
seed allocation, physical-input de-duplication, and lifecycle wiring. It imports
no DOM, Cocos, WeChat, clock, or random APIs.

Physical-input retention applies only to settled results: pending `physicalId` entries are never
capacity-evicted, so concurrent host replays receive the same Promise. Lifecycle listeners are
registered transactionally; failure at a later registration rolls back every earlier listener.

The package exposes Web-v1 decode as a read-only preview only. It does not yet
commit imports or implement the rejected payload/reason/index sealing protocol.
For schema-v2 recovery it deliberately reuses the frozen Web-v1 sanitizer and
validator; this is a compatibility gate, not the final v2 invariant matrix.

From `infinite-flow-wechat/`, run `npm run build` once so all dependency declarations
exist, then use `npm run typecheck -w @infinite-flow/client` and
`npm test -w @infinite-flow/client`. Root `npm run verify` is the clean-clone gate.
