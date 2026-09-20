# Infinite Flow Web v1 save codec

Pure TypeScript decoder for the historical browser envelope stored at
`infinite-flow:save:v1`:

```json
{ "version": 1, "state": {} }
```

The package has no runtime dependency on DOM, storage, Cocos, WeChat APIs, clocks,
or random sources. `decodeWebV1` receives the `RawSavePayload` port contract exported
by `@infinite-flow/runtime` and returns either a normalized `GameState` with an audit
report, or a rejection that still carries a byte/code-unit preserving copy of every
well-shaped input. Malformed runtime values are returned unchanged as
`malformedInput`; they cannot reach raw-byte cloning. The host owns durable
import/rejected backup, key scanning, deletion, and schema-v2 persistence.

## API

```ts
decodeWebV1(
  | { kind: 'web-local-storage-text'; text: string }
  | { kind: 'external-bytes'; bytes: Uint8Array; encodingHint?: 'utf-8' }
): DecodeWebV1Result
```

- Local-storage text is passed unchanged to `JSON.parse`; no newline, Unicode, or
  JavaScript code-unit normalization occurs.
- External bytes use a local strict RFC 3629 decoder. A single leading UTF-8 BOM is
  recorded and stripped before JSON parsing; malformed, overlong, surrogate, or
  out-of-range sequences are rejected with a byte offset.
- Version 1 is accepted. Missing/non-integer versions, older unsupported versions,
  and unknown future versions have distinct rejection codes.
- Known optional fields use the same sanitizer order, validator, and normalizer as
  the Web v1 loader. No source key or raw payload is modified or deleted.
- Active Web v1 runs expose their version-0 seed inputs in
  `report.legacySeedLineage`; missing seeds produce warnings and are never invented.
- The function accepts `unknown` defensively at runtime. An invalid kind, non-string
  text, non-`Uint8Array` bytes, unsupported encoding hint, or throwing property
  getter returns `invalid-payload`/`unsupported-encoding` instead of throwing.

## Validation

From `infinite-flow-wechat/`, using its own pinned workspace toolchain:

```bash
npm run build
npm run typecheck -w @infinite-flow/save-codec
npm test -w @infinite-flow/save-codec
```

The core and runtime workspace dependencies must be built before a consumer loads
`dist/index.js`; `npm ci` only links workspaces and does not create their `dist`. Emitted codec
code deliberately retains `@infinite-flow/core` package/subpath imports; it never
points at sibling `src/*.js` files.

See [SOURCE-PARITY.md](SOURCE-PARITY.md) for the extracted functions and deliberate
boundaries. Golden inputs live in `tests/fixtures/`; `manifest.json` binds every case
to the Web oracle commit, SHA-256, and expected decode outcome, and the test suite
verifies those hashes before exercising the cases.

## Deliberate non-claims

- This is a Web v1 import codec, not the schema-v2 envelope/JCS checksum encoder.
- It does not scan historical keys, write import/rejected records, delete sources,
  or decide when a normalized state is durably committed.
- Web v1's permissive finite-number and phase/run/combat acceptance remains visible
  for compatibility. A v2 invariant gate must harden or reject ambiguous permanent
  values before committing schema v2.
- `seedLineage.rulesVersion = 0` is reported but not injected into `GameState`,
  because the current core snapshot does not yet own that v2 field.
- The golden matrix exercises representative modern and legacy states; it is not a
  claim that all 103 migration ACs have passed.
