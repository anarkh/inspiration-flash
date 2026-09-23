/**
 * Independent, explicit registration of every frozen acceptance case.
 *
 * Do not generate this list from the acceptance manifest at runtime. The runner
 * compares both sets so deleting or weakening a manifest entry cannot silently
 * shrink the executable acceptance surface.
 */
const CASE_RUNNER_ROWS = [
  [
    "AC-CONTENT-001",
    "catalog-19-dungeons",
    ["A-AC"],
    { "A-AC": "catalog19Dungeons" },
  ],
  ["AC-CONTENT-002", "catalog-chapter-metadata", ["A-AC"], null],
  ["AC-CONTENT-003", "catalog-boss-exit", ["A-AC"], null],
  ["AC-CONTENT-004", "catalog-counts", ["A-AC"], null],
  ["AC-CONTENT-005", "equipment-memory-matrix", ["A-AC"], null],
  ["AC-CONTENT-006", "route-contract-catalog", ["A-AC"], null],
  ["AC-CONTENT-007", "task-directive-catalog", ["A-AC"], null],
  ["AC-CONTENT-008", "stable-id-localization-rename", ["A-AC"], null],
  [
    "AC-COMPAT-001",
    "web-v1-two-encounter-aliases",
    ["A-AC"],
    { "A-AC": "webV1TwoEncounterAliases" },
  ],
  [
    "AC-COMPAT-002",
    "web-v1-equipment-hunt",
    ["A-AC"],
    { "A-AC": "webV1EquipmentHunt" },
  ],
  [
    "AC-COMPAT-003",
    "web-v1-methodSnapshot",
    ["A-AC"],
    { "A-AC": "webV1SingleMethodSnapshot" },
  ],
  [
    "AC-COMPAT-004",
    "web-v1-missing-run-snapshots",
    ["A-AC"],
    { "A-AC": "webV1MissingRunSnapshots" },
  ],
  ["AC-COMPAT-005", "key-scan-v1-and-future", ["A-AC"], null],
  ["AC-STATE-001", "state-phase-matrix", ["A-AC"], null],
  ["AC-STATE-002", "state-numeric-boundaries", ["A-AC"], null],
  ["AC-STATE-003", "state-equipped-owned", ["A-AC"], null],
  ["AC-STATE-004", "state-idempotent-rewards", ["A-AC"], null],
  ["AC-STATE-005", "state-power-oracle", ["A-AC"], null],
  ["AC-STATE-006", "ui-no-writable-domain-copy", ["A-AC", "A-SMOKE"], null],
  ["AC-SESSION-001", "session-only-dispatch", ["A-AC"], null],
  ["AC-SESSION-002", "session-commandid-race", ["A-AC"], null],
  ["AC-SESSION-003", "session-revision-monotonic", ["A-AC"], null],
  ["AC-SESSION-004", "session-hub-command-phase-matrix", ["A-AC"], null],
  ["AC-FREEZE-001", "freeze-protocol-inferno", ["A-AC"], null],
  ["AC-FREEZE-002", "freeze-tactical-loadout", ["A-AC"], null],
  ["AC-FREEZE-003", "freeze-relic-conduit", ["A-AC"], null],
  ["AC-FREEZE-004", "freeze-growth-snapshots", ["A-AC"], null],
  ["AC-FREEZE-005", "freeze-equipment-sources", ["A-AC"], null],
  ["AC-FREEZE-006", "pet-live-active-and-capture", ["A-AC"], null],
  ["AC-MAP-001", "map-edge-visibility", ["A-AC", "A-SMOKE"], null],
  ["AC-MAP-002", "map-route-gate-reason", ["A-AC", "A-SMOKE"], null],
  ["AC-MAP-003", "map-scout-pending", ["A-AC", "A-SMOKE"], null],
  ["AC-MAP-004", "map-pressure-pursuit", ["A-AC"], null],
  ["AC-MAP-005", "map-route-contract-order", ["A-AC"], null],
  ["AC-LAW-01", "law-01-demon-tower", ["A-AC", "A-SMOKE"], { "A-AC": "law01DemonTower" }],
  [
    "AC-LAW-02",
    "law-02-metro",
    ["A-AC", "A-SMOKE"],
    { "A-AC": "law02Metro" },
  ],
  ["AC-LAW-03", "law-03-mine", ["A-AC", "A-SMOKE"], { "A-AC": "law03Mine" }],
  ["AC-LAW-04", "law-04-hospital", ["A-AC", "A-SMOKE"], { "A-AC": "law04Hospital" }],
  ["AC-LAW-05", "law-05-arena", ["A-AC", "A-SMOKE"], { "A-AC": "law05Arena" }],
  ["AC-LAW-06", "law-06-dream", ["A-AC", "A-SMOKE"], { "A-AC": "law06Dream" }],
  ["AC-LAW-07", "law-07-virtual", ["A-AC", "A-SMOKE"], { "A-AC": "law07Virtual" }],
  ["AC-LAW-08", "law-08-chronal", ["A-AC", "A-SMOKE"], { "A-AC": "law08Chronal" }],
  ["AC-LAW-09", "law-09-causal", ["A-AC", "A-SMOKE"], { "A-AC": "law09Causal" }],
  ["AC-LAW-10", "law-10-entropy", ["A-AC", "A-SMOKE"], { "A-AC": "law10Entropy" }],
  ["AC-LAW-11", "law-11-mirror", ["A-AC", "A-SMOKE"], { "A-AC": "law11Mirror" }],
  ["AC-LAW-12", "law-12-redaction", ["A-AC", "A-SMOKE"], { "A-AC": "law12Redaction" }],
  ["AC-LAW-13", "law-13-auction", ["A-AC", "A-SMOKE"], { "A-AC": "law13Auction" }],
  ["AC-LAW-14", "law-14-genesis", ["A-AC", "A-SMOKE"], { "A-AC": "law14Genesis" }],
  ["AC-LAW-15", "law-15-broadcast", ["A-AC", "A-SMOKE"], { "A-AC": "law15Broadcast" }],
  ["AC-LAW-16", "law-16-shelter", ["A-AC", "A-SMOKE"], { "A-AC": "law16Shelter" }],
  ["AC-LAW-17", "law-17-verdict", ["A-AC", "A-SMOKE"], { "A-AC": "law17Verdict" }],
  ["AC-LAW-18", "law-18-replay", ["A-AC", "A-SMOKE"], { "A-AC": "law18Replay" }],
  ["AC-LAW-19", "law-19-panopticon", ["A-AC", "A-SMOKE"], { "A-AC": "law19Panopticon" }],
  ["AC-COMBAT-001", "combat-one-action-one-turn", ["A-AC", "A-SMOKE"], null],
  ["AC-COMBAT-002", "combat-oracle-vectors", ["A-AC"], null],
  ["AC-COMBAT-003", "combat-resource-counters", ["A-AC"], null],
  ["AC-COMBAT-004", "combat-boss-capture", ["A-AC"], null],
  ["AC-COMBAT-005", "combat-kill-after-each-action", ["A-AC", "M-DEVICE"], null],
  ["AC-SETTLE-001", "settle-first-clear-only", ["A-AC"], null],
  ["AC-SETTLE-002", "settle-exit-matrix", ["A-AC"], null],
  ["AC-SETTLE-003", "settle-subsystem-matrix", ["A-AC"], null],
  ["AC-SETTLE-004", "settle-cross-dungeon-portal", ["A-AC"], null],
  ["AC-SAVE-001", "save-web-v1-import", ["A-AC", "M-DEVICE"], null],
  ["AC-SAVE-002", "save-phase-roundtrip", ["A-AC"], null],
  ["AC-SAVE-003", "save-order-roundtrip", ["A-AC"], null],
  ["AC-SAVE-004", "save-repairable-fields", ["A-AC"], null],
  ["AC-SAVE-005", "save-rejected-backup-faults", ["A-AC"], null],
  ["AC-SAVE-006", "save-invalid-inferno-run", ["A-AC"], null],
  ["AC-SAVE-007", "save-envelope-ledger-revisions", ["A-AC"], null],
  ["AC-SAVE-008", "save-tmp-formal-backup-fault-grid", ["A-AC"], null],
  ["AC-SAVE-009", "save-ack-storage-failure", ["A-AC"], null],
  ["AC-SAVE-010", "save-pause-hide-deadline", ["A-AC", "M-DEVICE"], null],
  ["AC-SAVE-011", "save-recovery-candidate-matrix", ["A-AC", "M-DEVICE"], null],
  ["AC-SAVE-012", "save-transfer-capabilities", ["A-AC", "M-DEVICE"], null],
  ["AC-SEED-001", "seed-enter-bundle-validation", ["A-AC"], null],
  [
    "AC-SEED-002",
    "seed-root-label-golden-v1",
    ["A-AC"],
    { "A-AC": "seedRootLabelGoldenV1" },
  ],
  ["AC-SEED-003", "seed-hidden-contract", ["A-AC"], null],
  ["AC-SEED-004", "seed-inferno-topology", ["A-AC"], null],
  ["AC-SEED-005", "seed-relic-affix-tiebreak", ["A-AC"], null],
  ["AC-SEED-006", "seed-resume-random-spy", ["A-AC"], null],
  ["AC-SEED-007", "seed-portal-mode-and-legacy-v0-matrix", ["A-AC"], null],
  ["AC-SEED-008", "seed-forbidden-api-spy", ["A-AC"], null],
  ["AC-SEED-009", "seed-cross-language-primitives", ["A-AC"], null],
  [
    "AC-HASH-001",
    "hash-canonical-json-v1",
    ["A-AC"],
    { "A-AC": "hashCanonicalJsonV1" },
  ],
  ["AC-HASH-002", "hash-domain-projection-v1", ["A-AC"], null],
  ["AC-HASH-003", "hash-cross-client-golden", ["A-AC"], null],
  ["AC-ASSET-001", "asset-manifest-187", ["A-WEB", "A-AC"], null],
  [
    "AC-ASSET-002",
    "asset-key-revision-cache",
    ["A-AC"],
    { "A-AC": "assetKeyRevisionCache" },
    ["esbuild"],
  ],
  [
    "AC-ASSET-003",
    "asset-error-taxonomy",
    ["A-AC"],
    { "A-AC": "assetErrorTaxonomy" },
    ["esbuild"],
  ],
  ["AC-ASSET-004", "asset-failure-release-retry", ["A-AC", "A-SMOKE"], null],
  ["AC-UI-001", "ui-390x844-320x568", ["A-SMOKE", "M-DEVICE"], null],
  ["AC-UI-002", "ui-touch-back-focus", ["A-SMOKE", "M-DEVICE"], null],
  ["AC-UI-003", "ui-noncolor-status", ["A-SMOKE", "M-DEVICE"], null],
  ["AC-UI-004", "ui-help-and-mechanics", ["A-SMOKE", "M-DEVICE"], null],
  ["AC-RELEASE-001", "acceptance-derived-final", ["A-DERIVE"], null],
  ["AC-RELEASE-002", "release-19-full-settlements", ["A-RELEASE"], null],
  ["AC-RELEASE-003", "release-chapter-1-natural-play", ["A-RELEASE", "M-DEVICE"], null],
  ["AC-RELEASE-004", "release-chapter-17-19-restart", ["A-RELEASE", "A-SMOKE", "M-DEVICE"], null],
  ["AC-RELEASE-005", "release-save-compat-matrix", ["A-RELEASE", "M-DEVICE"], null],
  ["AC-RELEASE-006", "release-platform-fault-matrix", ["A-RELEASE", "M-DEVICE"], null],
  ["AC-RELEASE-007", "release-oracle-hash-assets-ui", ["A-RELEASE", "A-WEB", "A-SMOKE"], null],
  ["AC-RELEASE-008", "release-four-owner-signoff", ["R-REVIEW"], null],
  ["AC-RELEASE-009", "release-version-trace", ["A-RELEASE", "R-REVIEW"], null],
];

export const caseRunners = Object.freeze(
  CASE_RUNNER_ROWS.map(([
    id,
    fixtureId,
    requiredMethods,
    methodImplementations,
    capabilities = [],
  ]) => Object.freeze({
    id,
    fixtureId,
    requiredMethods: Object.freeze([...requiredMethods]),
    methodImplementations: Object.freeze({ ...(methodImplementations ?? {}) }),
    capabilities: Object.freeze([...capabilities]),
  })),
);

/** Independently pinned scenario sets for executable fixtures. */
export const implementedFixtureScenarioIds = Object.freeze({
  "asset-error-taxonomy": Object.freeze([
    "error-unknown-key",
    "error-revision-mismatch",
    "error-offline",
    "error-timeout",
    "error-integrity",
    "error-decode",
    "error-quota",
    "error-unsupported",
    "error-cancelled",
  ]),
  "asset-key-revision-cache": Object.freeze([
    "manifest-revision-and-physical-files",
    "stable-key-is-explicit",
    "extensionless-resource-loader",
    "handle-cache-report-revision",
    "reject-entry-revision-mix",
    "cocos-resources-callback-bridge",
  ]),
  "catalog-19-dungeons": Object.freeze([
    "frozen-web-v1-dungeon-order",
    "catalog-keys-and-definition-ids",
  ]),
  "law-01-demon-tower": Object.freeze([
    "demon-fog-rise-display-clamp",
    "demon-recovery-landmark-relief",
    "demon-high-fog-side-route-gates",
    "demon-boss-gate-seal-exit",
    "demon-reward-idempotency-roundtrip",
  ]),
  "law-02-metro": Object.freeze([
    "tide-cycle-on-first-clear",
    "signal-cache-calibration",
    "route-gates-follow-tide",
    "mirror-tide-modifiers",
    "mirror-gate-follows-tide",
    "repeat-clear-no-advance",
  ]),
  "law-03-mine": Object.freeze([
    "gravity-switch-on-clear",
    "gravity-route-gates",
    "gravity-trap-modifiers",
    "gravity-defense-modifiers",
    "repeat-clear-no-flip",
  ]),
  "law-04-hospital": Object.freeze([
    "pollution-on-damaging-clear",
    "pollution-treatment-weakening",
    "pollution-route-gates",
    "triage-purification-event",
    "purification-opens-route",
    "repeat-clear-no-pollution",
  ]),
  "law-05-arena": Object.freeze([
    "arena-style-records",
    "arena-repeat-penalty",
    "arena-three-style-rewrite",
    "arena-route-gates",
    "arena-repeat-clear-boundary",
  ]),
  "law-06-dream": Object.freeze([
    "archive-seal-on-dangerous-clear",
    "archive-consumable-seal-effect",
    "archive-method-seal-effect",
    "archive-pet-seal-effect",
    "archive-index-event-reset",
    "archive-repeat-clear-boundary",
  ]),
  "law-07-virtual": Object.freeze([
    "citadel-boss-assessment-freeze",
    "citadel-counter-targets-bias",
    "citadel-style-route-gates",
    "citadel-repeat-clear-boundary",
  ]),
  "law-08-chronal": Object.freeze([
    "chronal-anchor-calibration-display",
    "chronal-single-anchor-route-gates",
    "chronal-dual-anchor-opens-bridge",
    "chronal-repeat-clear-boundary",
  ]),
  "law-09-causal": Object.freeze([
    "causal-ledger-balance-overdraw-repay",
    "causal-debt-route-gates",
    "causal-boss-collection-seals",
    "causal-repeat-boundary",
  ]),
  "law-10-entropy": Object.freeze([
    "entropy-heading-three-consoles",
    "entropy-threshold-route-gates",
    "entropy-boss-collapse-layers",
    "entropy-repeat-boundary",
  ]),
  "law-11-mirror": Object.freeze([
    "mirror-phase-three-mirrors",
    "mirror-phase-switch-cost",
    "mirror-anchor-gates",
    "mirror-shell-boss",
    "mirror-shell-anchor-count",
  ]),
  "law-12-redaction": Object.freeze([
    "redaction-clause-certify-redact",
    "redaction-sector-gates",
    "redaction-boss-snapshot-certified",
    "redaction-boss-snapshot-redacted",
  ]),
  "law-13-auction": Object.freeze([
    "auction-lot-bid-burn-fold",
    "auction-dynamic-pricing",
    "auction-route-gates",
    "auction-boss-snapshot",
  ]),
  "law-14-genesis": Object.freeze([
    "genesis-ordered-splice-serum",
    "genesis-duplicate-cost-rejection",
    "genesis-specialization-myriad-gates",
    "genesis-boss-snapshot",
  ]),
  "law-15-broadcast": Object.freeze([
    "broadcast-ordered-relay-noise",
    "broadcast-noise-passive-clamps",
    "broadcast-region-gates",
    "broadcast-boss-snapshot",
    "broadcast-reward-inheritance",
  ]),
  "law-16-shelter": Object.freeze([
    "shelter-ordered-checkpoint-escort",
    "shelter-hazard-guard-and-hp-clamps",
    "shelter-companion-and-reward-split",
    "shelter-boss-snapshot",
    "shelter-reward-inheritance",
  ]),
  "law-17-verdict": Object.freeze([
    "verdict-contamination-and-display",
    "verdict-accusation-and-reward",
    "verdict-appeal-and-vault-mutex",
    "verdict-vault-locks-appeal",
    "verdict-boss-snapshot-and-freeze",
  ]),
  "law-18-replay": Object.freeze([
    "replay-takes-record-and-display",
    "replay-route-select-and-gates",
    "replay-boss-snapshot-and-freeze",
    "replay-reward-idempotency-and-roundtrip",
    "replay-burst-route-replay-consistency",
  ]),
  "law-19-panopticon": Object.freeze([
    "panopticon-scan-phases-exposure-display",
    "panopticon-relays-route-select-gates",
    "panopticon-boss-snapshot-and-freeze",
    "panopticon-decoy-rewards-idempotency",
    "panopticon-shadow-route-no-exposure",
  ]),
  "hash-canonical-json-v1": Object.freeze([
    "canonical-utf16-key-and-array-order",
    "canonical-state-envelope-hash",
    "reject-negative-zero",
    "reject-fraction",
    "reject-nan",
    "reject-positive-infinity",
    "reject-unsafe-integer",
    "reject-array-hole",
    "reject-array-property",
    "reject-non-plain-object",
    "reject-object-accessor",
    "reject-symbol-key",
    "reject-lone-high-surrogate",
    "reject-lone-low-surrogate",
    "reject-cycle",
  ]),
  "seed-root-label-golden-v1": Object.freeze([
    "hidden-task-dungeon-01",
    "inferno-map-dungeon-01-tier-3",
    "portal-dungeon-01-to-02-hop-1",
    "unicode-label-uint32-max-root",
  ]),
  "web-v1-missing-run-snapshots": Object.freeze([
    "missing-snapshots-disable-only-dependent-systems",
  ]),
  "web-v1-methodSnapshot": Object.freeze([
    "legacy-single-snapshot-keeps-frozen-rank",
  ]),
  "web-v1-equipment-hunt": Object.freeze([
    "legacy-hunt-offer-restores-and-settles-once",
  ]),
  "web-v1-two-encounter-aliases": Object.freeze([
    "lost-shelter-north-rescue-alias",
    "panopticon-north-sweep-alias",
  ]),
});

export function validateCaseRunnerRegistration(registration) {
  const failures = [];
  const implementationEntries = Object.entries(registration.methodImplementations ?? {});
  for (const [method, implementation] of implementationEntries) {
    if (!registration.requiredMethods?.includes(method)) {
      failures.push(`${registration.id} implements an undeclared method: ${method}`);
    }
    if (method !== "A-AC") {
      failures.push(
        `${registration.id} ${method} cannot use an in-process fixture implementation`,
      );
    }
    if (typeof implementation !== "string" || implementation.length === 0) {
      failures.push(`${registration.id} ${method} implementation name is invalid`);
    }
  }
  if (
    !Array.isArray(registration.capabilities)
    || registration.capabilities.some(
      (capability, capabilityIndex) =>
        capability !== "esbuild"
        || registration.capabilities.indexOf(capability) !== capabilityIndex,
    )
  ) {
    failures.push(`${registration.id} capabilities are invalid or duplicated`);
  }
  return failures;
}

export function validateCaseRunnerRegistry(manifest) {
  const failures = [];
  if (!Array.isArray(manifest?.cases)) {
    return ["acceptance manifest cases must be an array"];
  }
  if (caseRunners.length !== manifest.cases.length) {
    failures.push(
      `caseRunners count ${caseRunners.length} does not match manifest count ${manifest.cases.length}`,
    );
  }

  const registryById = new Map();
  for (const [index, registration] of caseRunners.entries()) {
    if (registryById.has(registration.id)) {
      failures.push(`duplicate caseRunners ID: ${registration.id}`);
    }
    registryById.set(registration.id, registration);
    const manifestCase = manifest.cases[index];
    if (manifestCase?.id !== registration.id) {
      failures.push(
        `caseRunners order/ID mismatch at ${index}: ${registration.id} != ${String(manifestCase?.id)}`,
      );
    }
    failures.push(...validateCaseRunnerRegistration(registration));
  }

  for (const manifestCase of manifest.cases) {
    const registration = registryById.get(manifestCase.id);
    if (registration === undefined) {
      failures.push(`manifest case is not registered: ${manifestCase.id}`);
      continue;
    }
    if (registration.fixtureId !== manifestCase.fixtureId) {
      failures.push(
        `${manifestCase.id} fixture mismatch: ${registration.fixtureId} != ${manifestCase.fixtureId}`,
      );
    }
    if (
      JSON.stringify(registration.requiredMethods) !==
      JSON.stringify(manifestCase.methods)
    ) {
      failures.push(`${manifestCase.id} required methods do not match manifest`);
    }
  }
  return failures;
}
