# Web v1 oracle baseline

`web-v1-baseline.json` freezes the source identity and concise outcomes of the Web
oracle checks executed before target-side migration. It is a provenance record, not
an acceptance evidence bundle: later migration fixtures must retain raw command
traces, states, hashes, device/build identity, and failure artifacts separately.

The source tree is intentionally not copied here. The platform-neutral snapshot in
`packages/core` records its own exact file provenance and documented seed-only
divergence.
