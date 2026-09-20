import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";

export class AcceptanceAssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AcceptanceAssertionError";
  }
}

export class AcceptanceBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "AcceptanceBlockedError";
  }
}

function assert(condition, message) {
  if (!condition) throw new AcceptanceAssertionError(message);
}

function equal(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new AcceptanceAssertionError(
      `${message}; expected ${String(expected)}, received ${String(actual)}`,
    );
  }
}

function deepEqual(actual, expected, message) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new AcceptanceAssertionError(
      `${message}; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function applyFrozenMutations(baseValue, mutations) {
  const value = structuredClone(baseValue);
  for (const mutation of mutations) {
    assert(
      Array.isArray(mutation.path) && mutation.path.length > 0,
      "frozen input mutation path must be non-empty",
    );
    let parent = value;
    for (const segment of mutation.path.slice(0, -1)) {
      assert(
        typeof segment === "string"
          && segment !== "__proto__"
          && segment !== "prototype"
          && segment !== "constructor",
        "frozen input mutation path segment is unsafe",
      );
      assert(
        parent !== null
          && typeof parent === "object"
          && Object.prototype.hasOwnProperty.call(parent, segment),
        `frozen input mutation parent is missing at ${mutation.path.join(".")}`,
      );
      parent = parent[segment];
    }
    const key = mutation.path.at(-1);
    assert(
      typeof key === "string"
        && key !== "__proto__"
        && key !== "prototype"
        && key !== "constructor"
        && parent !== null
        && typeof parent === "object",
      "frozen input mutation target is unsafe",
    );
    const exists = Object.prototype.hasOwnProperty.call(parent, key);
    if (mutation.op === "remove") {
      assert(exists, `frozen input remove target is missing at ${mutation.path.join(".")}`);
      delete parent[key];
      continue;
    }
    if (mutation.op === "replace") {
      assert(exists, `frozen input replace target is missing at ${mutation.path.join(".")}`);
      parent[key] = structuredClone(mutation.value);
      continue;
    }
    if (mutation.op === "add") {
      assert(!exists, `frozen input add target already exists at ${mutation.path.join(".")}`);
      parent[key] = structuredClone(mutation.value);
      continue;
    }
    throw new AcceptanceAssertionError(`unknown frozen input mutation op: ${String(mutation.op)}`);
  }
  return value;
}

function loadFrozenJsonInput(projectRoot, input) {
  const inputPath = resolve(projectRoot, input.path);
  assert(isPathInside(projectRoot, inputPath), "frozen input path must stay inside project root");
  const bytes = readFileSync(inputPath);
  equal(sha256(bytes), input.sha256, `${input.path} frozen SHA-256`);
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch (error) {
    throw new AcceptanceBlockedError(`${input.path} is not frozen JSON: ${String(error)}`);
  }
}

function rejectionValue(factory) {
  switch (factory) {
    case "negative-zero":
      return -0;
    case "fraction":
      return 1.5;
    case "nan":
      return Number.NaN;
    case "positive-infinity":
      return Number.POSITIVE_INFINITY;
    case "unsafe-integer":
      return Number.MAX_SAFE_INTEGER + 1;
    case "array-hole": {
      const value = [];
      value.length = 1;
      return value;
    }
    case "array-property": {
      const value = [1];
      value.named = true;
      return value;
    }
    case "non-plain-object":
      return new Date(0);
    case "object-accessor": {
      const value = {};
      Object.defineProperty(value, "secret", {
        enumerable: true,
        get() {
          throw new Error("canonical encoder invoked a forbidden getter");
        },
      });
      return value;
    }
    case "symbol-key": {
      const value = {};
      Object.defineProperty(value, Symbol("secret"), {
        enumerable: true,
        value: 1,
      });
      return value;
    }
    case "lone-high-surrogate":
      return "\ud800";
    case "lone-low-surrogate":
      return "\udc00";
    case "cycle": {
      const value = {};
      value.self = value;
      return value;
    }
    default:
      throw new AcceptanceAssertionError(`unknown rejection factory: ${String(factory)}`);
  }
}

export async function hashCanonicalJsonV1({ fixture, runtime }) {
  const {
    CanonicalJsonError,
    PortableSha256HashPort,
    canonicalStateHash,
    canonicalStringify,
    encodeUtf8,
    hashCanonicalJson,
  } = runtime;
  const hashPort = new PortableSha256HashPort();
  const results = [];

  for (const scenario of fixture.scenarios) {
    if (scenario.kind === "canonical") {
      const canonical = canonicalStringify(scenario.value);
      equal(canonical, scenario.expectedCanonical, `${scenario.id} canonical JSON`);
      equal(hex(encodeUtf8(canonical)), scenario.expectedUtf8Hex, `${scenario.id} UTF-8`);
      const digest = await hashCanonicalJson(scenario.value, hashPort);
      equal(digest, scenario.expectedSha256, `${scenario.id} SHA-256`);
      results.push({
        id: scenario.id,
        status: "PASS",
        canonical,
        utf8Hex: scenario.expectedUtf8Hex,
        sha256: digest,
      });
      continue;
    }

    if (scenario.kind === "stateHash") {
      const digest = await canonicalStateHash(scenario.input, hashPort);
      equal(digest, scenario.expectedSha256, `${scenario.id} state hash`);
      results.push({ id: scenario.id, status: "PASS", sha256: digest });
      continue;
    }

    if (scenario.kind === "reject") {
      let thrown;
      try {
        canonicalStringify(rejectionValue(scenario.factory));
      } catch (error) {
        thrown = error;
      }
      assert(thrown instanceof CanonicalJsonError, `${scenario.id} must throw CanonicalJsonError`);
      equal(thrown.code, scenario.expectedCode, `${scenario.id} rejection code`);
      results.push({
        id: scenario.id,
        status: "PASS",
        rejectionCode: thrown.code,
      });
      continue;
    }

    throw new AcceptanceAssertionError(
      `${scenario.id} has unknown hash fixture kind ${String(scenario.kind)}`,
    );
  }

  return {
    protocol: "canonical-state-hash:v1",
    scenarios: results,
  };
}

export async function seedRootLabelGoldenV1({ fixture, runtime }) {
  const { asNonZeroUint32, deriveSeedV1, isNonZeroUint32 } = runtime;
  equal(fixture.rulesVersion, 1, "seed fixture rulesVersion");
  const results = [];
  for (const scenario of fixture.scenarios) {
    const rootSeed = asNonZeroUint32(scenario.rootSeed, `${scenario.id}.rootSeed`);
    const actual = deriveSeedV1(rootSeed, scenario.label);
    equal(actual, scenario.expected, `${scenario.id} derived seed`);
    assert(isNonZeroUint32(actual), `${scenario.id} result must be a nonzero uint32`);
    results.push({
      id: scenario.id,
      status: "PASS",
      rootSeed,
      label: scenario.label,
      derivedSeed: actual,
    });
  }
  return {
    algorithm: "seed:v1/FNV-1a-uint32",
    rulesVersion: 1,
    scenarios: results,
  };
}

export async function catalog19Dungeons({ fixture, core }) {
  const actualOrder = [...core.DUNGEON_ORDER];
  const actualKeys = Object.keys(core.DUNGEONS);
  const results = [];

  for (const scenario of fixture.scenarios) {
    if (scenario.kind === "ordered-catalog") {
      equal(actualOrder.length, scenario.expectedCount, `${scenario.id} order count`);
      deepEqual(actualOrder, scenario.expectedOrder, `${scenario.id} exact order`);
      results.push({
        id: scenario.id,
        status: "PASS",
        dungeonCount: actualOrder.length,
        orderSha256: sha256(Buffer.from(JSON.stringify(actualOrder), "utf8")),
      });
      continue;
    }

    if (scenario.kind === "catalog-identity") {
      equal(actualKeys.length, scenario.expectedCount, `${scenario.id} catalog count`);
      deepEqual([...actualKeys].sort(), [...scenario.expectedKeys].sort(), `${scenario.id} key set`);
      const definitionIds = actualOrder.map((dungeonId) => {
        const definition = core.DUNGEONS[dungeonId];
        assert(definition !== undefined, `${scenario.id} definition exists for ${dungeonId}`);
        equal(definition.id, dungeonId, `${scenario.id} definition ID for ${dungeonId}`);
        return definition.id;
      });
      deepEqual(definitionIds, scenario.expectedDefinitionIds, `${scenario.id} definition IDs`);
      results.push({
        id: scenario.id,
        status: "PASS",
        catalogKeyCount: actualKeys.length,
        definitionIds,
      });
      continue;
    }

    throw new AcceptanceAssertionError(
      `${scenario.id} has unknown dungeon catalog fixture kind ${String(scenario.kind)}`,
    );
  }

  return {
    oracle: fixture.provenance.oracle,
    dungeonCount: actualOrder.length,
    scenarios: results,
  };
}

export async function webV1MissingRunSnapshots({ fixture, projectRoot, saveCodec }) {
  const inputPath = resolve(projectRoot, fixture.input.path);
  assert(isPathInside(projectRoot, inputPath), "legacy input path must stay inside project root");
  const inputBytes = readFileSync(inputPath);
  equal(sha256(inputBytes), fixture.input.sha256, "legacy input SHA-256");

  const result = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: inputBytes.toString("utf8"),
  });
  equal(result.status, "decoded", "legacy missing-snapshot input status");
  if (result.status !== "decoded") {
    throw new AcceptanceAssertionError("legacy missing-snapshot input must decode");
  }
  equal(
    result.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "decoder oracle commit",
  );

  const scenario = fixture.scenarios[0];
  const run = result.state.run;
  assert(run !== undefined, `${scenario.id} preserves the active run`);
  for (const field of scenario.expected.absentRunFields) {
    equal(run[field], undefined, `${scenario.id} ${field} stays disabled`);
  }

  deepEqual(
    {
      phase: result.state.phase,
      rewardPoints: result.state.rewardPoints,
      lingyun: result.state.lingyun,
      ownedEquipment: result.state.ownedEquipment,
      equipped: result.state.equipped,
      enteredDungeonIds: result.state.enteredDungeonIds,
    },
    scenario.expected.permanentState,
    `${scenario.id} permanent state`,
  );
  deepEqual(
    {
      entryFlowVersion: run.entryFlowVersion,
      explorationRewardVersion: run.explorationRewardVersion,
      hiddenTaskSeed: run.hiddenTaskSeed,
      dungeonId: run.dungeonId,
      currentNodeId: run.currentNodeId,
      discoveredNodeIds: run.discoveredNodeIds,
      fieldSurveyState: run.fieldSurveyState,
      equipmentMemorySnapshot: run.equipmentMemorySnapshot,
      protocol: run.protocol,
      pressureState: run.pressureState,
      relicState: run.relicState,
      soulSkillState: run.soulSkillState,
      lawState: run.lawState,
      pursuitState: run.pursuitState,
    },
    scenario.expected.otherRunState,
    `${scenario.id} unrelated run state`,
  );
  deepEqual(run.lootBag, scenario.expected.repairedDefaults.lootBag, `${scenario.id} loot bag`);
  equal(
    result.state.inventory.observation_shard,
    scenario.expected.repairedDefaults.observationShard,
    `${scenario.id} observation shard default`,
  );
  deepEqual(
    result.report.warnings.map(({ code }) => code),
    scenario.expected.warningCodes,
    `${scenario.id} warning codes`,
  );
  deepEqual(
    result.report.repairs.map(({ code }) => code),
    scenario.expected.repairCodes,
    `${scenario.id} repair codes`,
  );

  return {
    oracleCommit: result.report.source.oracleCommit,
    sourceFixture: {
      path: fixture.input.path,
      sha256: fixture.input.sha256,
    },
    scenarios: [{
      id: scenario.id,
      status: "PASS",
      disabledRunFields: [...scenario.expected.absentRunFields],
      retainedDungeonId: run.dungeonId,
    }],
  };
}

export async function webV1TwoEncounterAliases({ fixture, projectRoot, saveCodec }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const results = [];

  for (const scenario of fixture.scenarios) {
    const envelope = applyFrozenMutations(base.value, scenario.inputMutations);
    const decoded = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify(envelope),
    });
    equal(decoded.status, "decoded", `${scenario.id} first decode status`);
    if (decoded.status !== "decoded") {
      throw new AcceptanceAssertionError(`${scenario.id} must decode`);
    }
    equal(
      decoded.report.source.oracleCommit,
      fixture.provenance.oracle.commit,
      `${scenario.id} oracle commit`,
    );

    const capture = (state) => ({
      phase: state.phase,
      rewardPoints: state.rewardPoints,
      lingyun: state.lingyun,
      run: {
        dungeonId: state.run?.dungeonId,
        currentNodeId: state.run?.currentNodeId,
        clearedNodeIds: state.run?.clearedNodeIds,
        resolvedEventIds: state.run?.resolvedEventIds,
        eventLog: state.run?.eventLog,
        lootBag: state.run?.lootBag,
        lootOffersMade: state.run?.lootOffersMade,
      },
      combat: {
        nodeId: state.combat?.nodeId,
        monsterId: state.combat?.monsterId,
        monsterHp: state.combat?.monsterHp,
        turn: state.combat?.turn,
        guarding: state.combat?.guarding,
      },
    });
    deepEqual(capture(decoded.state), scenario.expected.state, `${scenario.id} migrated state`);
    deepEqual(
      decoded.report.repairs.map(({ code }) => code),
      scenario.expected.repairCodes,
      `${scenario.id} repair codes`,
    );

    const repeated = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state: decoded.state }),
    });
    equal(repeated.status, "decoded", `${scenario.id} repeated decode status`);
    if (repeated.status !== "decoded") {
      throw new AcceptanceAssertionError(`${scenario.id} repeated decode must succeed`);
    }
    deepEqual(capture(repeated.state), scenario.expected.state, `${scenario.id} idempotent state`);

    results.push({
      id: scenario.id,
      status: "PASS",
      legacyMonsterId: scenario.legacyMonsterId,
      migratedMonsterId: decoded.state.combat?.monsterId,
      rewardAndCleanupIdempotent: true,
    });
  }

  return {
    oracleCommit: fixture.provenance.oracle.commit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    scenarios: results,
  };
}

export async function webV1SingleMethodSnapshot({ fixture, projectRoot, saveCodec, core }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const scenario = fixture.scenarios[0];
  const envelope = applyFrozenMutations(base.value, scenario.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", `${scenario.id} decode status`);
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError(`${scenario.id} must decode`);
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    `${scenario.id} oracle commit`,
  );
  equal(decoded.state.activeMethod, scenario.expected.hub.activeMethod, `${scenario.id} hub method`);
  equal(
    decoded.state.methodRanks[scenario.expected.hub.activeMethod],
    scenario.expected.hub.rank,
    `${scenario.id} hub rank`,
  );
  deepEqual(
    decoded.state.run?.methodSnapshot,
    scenario.expected.runSnapshot,
    `${scenario.id} legacy snapshot`,
  );
  equal(decoded.state.run?.methodSnapshots, undefined, `${scenario.id} plural snapshots absent`);
  assert(
    scenario.expected.hub.rank !== scenario.expected.runSnapshot.rank,
    `${scenario.id} fixture must distinguish hub and frozen ranks`,
  );
  deepEqual(
    core.getCurrentRunMethodSnapshots(decoded.state),
    [scenario.expected.runSnapshot],
    `${scenario.id} compatibility view`,
  );
  const technique = core.getCurrentMethodTechniqueStatus(
    decoded.state,
    scenario.expected.runSnapshot.methodId,
  );
  equal(technique.legacyDisabled, false, `${scenario.id} technique is not legacy-disabled`);
  deepEqual(technique.snapshot, scenario.expected.runSnapshot, `${scenario.id} technique snapshot`);
  deepEqual(
    decoded.report.warnings.map(({ code }) => code),
    scenario.expected.warningCodes,
    `${scenario.id} warning codes`,
  );

  return {
    oracleCommit: fixture.provenance.oracle.commit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    scenarios: [{
      id: scenario.id,
      status: "PASS",
      hubRank: scenario.expected.hub.rank,
      frozenRunRank: technique.snapshot.rank,
      compatibilityView: "legacy-single-snapshot",
    }],
  };
}

export async function webV1EquipmentHunt({ fixture, projectRoot, saveCodec, core }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const scenario = fixture.scenarios[0];
  const envelope = applyFrozenMutations(base.value, scenario.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", `${scenario.id} decode status`);
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError(`${scenario.id} must decode`);
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    `${scenario.id} oracle commit`,
  );
  deepEqual(
    decoded.state.run?.equipmentHunt,
    scenario.expected.restoredSnapshot,
    `${scenario.id} restored hunt snapshot`,
  );
  deepEqual(
    {
      offerId: decoded.state.run?.pendingEquipmentOffer?.offerId,
      equipmentIds: decoded.state.run?.pendingEquipmentOffer?.equipmentIds,
      guaranteedEquipmentId: decoded.state.run?.pendingEquipmentOffer?.guaranteedEquipmentId,
    },
    scenario.expected.pendingOffer,
    `${scenario.id} pending offer`,
  );
  const captureStatus = (state) => {
    const status = core.getCurrentEquipmentHuntStatus(state);
    return {
      enabled: status.enabled,
      dungeonId: status.dungeonId,
      targetEquipmentId: status.targetEquipmentId,
      cleared: status.cleared,
      qualified: status.qualified,
      crossed: status.crossed,
      offer: status.offer,
      selected: status.selected,
      passed: status.passed,
    };
  };
  deepEqual(captureStatus(decoded.state), scenario.expected.restoredStatus, `${scenario.id} restored status`);
  deepEqual(
    decoded.report.warnings.map(({ code }) => code),
    scenario.expected.warningCodes,
    `${scenario.id} warning codes`,
  );

  const settled = core.resolveEquipmentLoot(decoded.state, scenario.expected.selectedEquipmentId);
  deepEqual(settled.run?.lootBag, scenario.expected.settledLootBag, `${scenario.id} settled loot`);
  equal(settled.run?.pendingEquipmentOffer, undefined, `${scenario.id} clears pending offer`);
  deepEqual(
    settled.run?.equipmentHunt,
    scenario.expected.restoredSnapshot,
    `${scenario.id} preserves hunt evidence after settlement`,
  );
  deepEqual(captureStatus(settled), scenario.expected.settledStatus, `${scenario.id} settled status`);
  deepEqual(
    {
      rewardPoints: settled.rewardPoints,
      lingyun: settled.lingyun,
      ownsSelectedEquipment: settled.ownedEquipment.includes(scenario.expected.selectedEquipmentId),
    },
    scenario.expected.permanentStateAfterSettlement,
    `${scenario.id} permanent state before run exit`,
  );

  const repeated = core.resolveEquipmentLoot(settled, scenario.expected.selectedEquipmentId);
  deepEqual(repeated.run?.lootBag, scenario.expected.settledLootBag, `${scenario.id} repeated settlement loot`);
  equal(
    repeated.run?.lootBag.equipmentIds.filter(
      (equipmentId) => equipmentId === scenario.expected.selectedEquipmentId,
    ).length,
    1,
    `${scenario.id} target settles exactly once`,
  );

  return {
    oracleCommit: fixture.provenance.oracle.commit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    scenarios: [{
      id: scenario.id,
      status: "PASS",
      targetEquipmentId: scenario.expected.selectedEquipmentId,
      restored: true,
      settledExactlyOnce: true,
    }],
  };
}

export async function law01DemonTower({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-01 demon tower legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-01 demon tower legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-01 demon tower decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-01 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };
  const lawOf = (state) => core.getCurrentDungeonLaw(state);
  const fogOf = (state) => lawOf(state).state.law.fogPressure;
  const displayOf = (state) => {
    const d = lawOf(state).display;
    return {
      status: d.status,
      severity: d.severity,
      meter: d.meter,
      targetReached: d.targetReached,
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-01 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      fogWhenChecked: fogOf(state),
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };
  const enterTower = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "demon_tower_1",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter demon_tower_1",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const fightMonster = (state, nodeId) => {
    const hpBefore = state.player.hp;
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    let rounds = 0;
    while (state.phase === "combat" && rounds < 80) {
      state = commit(state, { type: "combat/act", action: "attack" }, `attack ${nodeId} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-01 combat vs ${nodeId} did not resolve`);
    }
    return { state, rounds, damageTaken: hpBefore - state.player.hp };
  };
  const resolveLoot = (state) => {
    if (!state.run?.pendingEquipmentOffer) return { state, hadOffer: false };
    state = commit(state, { type: "node/resolve-equipment-loot" }, "abandon elite loot");
    return { state, hadOffer: true };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const law = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: law.state.law,
      displayStatus: law.display.status,
      rewardPoints: rt.state.rewardPoints,
      clearedNodeIds: law.state.clearedNodeIds,
      resolvedEventIds: law.state.resolvedEventIds,
    };
  };

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const expectFlow = (observations, expected, label) => {
    // The fixture is a JSON artifact, so undefined observation fields (e.g. a
    // committed tryCommit has no code/message) are normalized away before the
    // deep-strict comparison against the frozen expected values.
    const normalized = JSON.parse(JSON.stringify(observations));
    deepEqual(
      Object.keys(normalized).sort(),
      Object.keys(expected).sort(),
      `law-01 ${label} observation keys`,
    );
    for (const [key, value] of Object.entries(expected)) {
      deepEqual(normalized[key], value, `law-01 ${label} ${key}`);
    }
  };
  const results = [];

  // Flow A exercises fog pressure generation, accumulation, threshold display,
  // and the [0,3] clamp: clearing the start monster with damage taken raises
  // fog 0→1 (warning), a damaging trap raises 1→2, a failed relief event
  // (send_pet_first with no trap-scout pet) raises 2→3 (danger, +20%
  // allStats), and a further damaging trap is clamped at 3. Re-selecting the
  // already-cleared current node is already-resolved. The round-trip preserves
  // fogPressure 3, the cleared node ids, and the resolved event id.
  const flowA = (() => {
    let state = hubState;
    const observations = {};
    state = enterTower(state);
    const e = lawOf(state);
    observations.entryDisplay = displayOf(state);
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.state.law;
    observations.entryRewardPoints = state.rewardPoints;

    const f0 = fightMonster(state, "fog_lesser_demon");
    state = f0.state;
    observations.monsterRise = {
      nodeId: "fog_lesser_demon",
      damageTaken: f0.damageTaken,
      rounds: f0.rounds,
      fogBefore: 0,
      fogAfter: fogOf(state),
    };
    observations.afterMonsterDisplay = displayOf(state);

    state = goto(state, ["blood_rune_trap"]);
    const trapHpBefore = state.player.hp;
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-a blood_rune trap");
    observations.trapRise = {
      nodeId: "blood_rune_trap",
      damageTaken: trapHpBefore - state.player.hp,
      fogBefore: 1,
      fogAfter: fogOf(state),
    };

    state = commit(
      state,
      { type: "node/resolve-event", eventId: "blood_rune_stair", optionId: "send_pet_first" },
      "flow-a blood_rune_stair send_pet_first",
    );
    observations.eventFailureRise = {
      eventId: "blood_rune_stair",
      optionId: "send_pet_first",
      damageTaken: 20,
      fogBefore: 2,
      fogAfter: fogOf(state),
      log: state.log[0],
    };
    observations.afterThreeDisplay = displayOf(state);
    observations.afterThreeModifiers = lawOf(state).modifiers;

    state = goto(state, ["fog_lesser_demon", "ash_pit_trap"]);
    const clampHpBefore = state.player.hp;
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-a ash_pit trap");
    observations.clampTrap = {
      nodeId: "ash_pit_trap",
      damageTaken: clampHpBefore - state.player.hp,
      fogBefore: 3,
      fogAfter: fogOf(state),
    };

    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "ash_pit_trap" });
    observations.idempotentReselect = {
      status: reselect.status,
      code: reselect.code,
      message: reselect.message,
      fogAfter: fogOf(reselect.state),
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("demon-fog-rise-display-clamp");
    expectFlow(flowA, expected, "flow-a");
    results.push({
      id: "demon-fog-rise-display-clamp",
      status: "PASS",
      fogPressure: flowA.roundtrip.lawData.fogPressure,
    });
  }

  // Flow B exercises the recovery landmarks: a successful relief event drops
  // fog 2→1 and pays rewards (idempotent on repeat), the sealed_cache node
  // collect drops fog 1→0 (idempotent), the mist_sealed_cache event is clamped
  // at 0 (idempotent), and the quiet_prayer_reward node collect is clamped at
  // 0 (idempotent). The round-trip preserves fogPressure 0 and all resolved
  // landmark ids.
  const flowB = (() => {
    let state = hubState;
    const observations = {};
    state = enterTower(state);
    const f0 = fightMonster(state, "fog_lesser_demon");
    state = f0.state;
    state = goto(state, ["blood_rune_trap"]);
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-b blood_rune trap");

    const fogBeforeEvent = fogOf(state);
    const rpBeforeEvent = state.rewardPoints;
    const lyBeforeEvent = state.lingyun;
    state = commit(
      state,
      { type: "node/resolve-event", eventId: "blood_rune_stair", optionId: "breathe_through_runes" },
      "flow-b blood_rune_stair relief",
    );
    observations.eventRelief = {
      eventId: "blood_rune_stair",
      fogBefore: fogBeforeEvent,
      fogAfter: fogOf(state),
      rewardPointsBefore: rpBeforeEvent,
      rewardPointsAfter: state.rewardPoints,
      lingyunBefore: lyBeforeEvent,
      lingyunAfter: state.lingyun,
      hiddenStone: state.inventory.hidden_stone,
      log: state.log[0],
    };
    const repEvent = tryCommit(
      state,
      { type: "node/resolve-event", eventId: "blood_rune_stair", optionId: "breathe_through_runes" },
    );
    observations.eventRepeat = {
      status: repEvent.status,
      code: repEvent.code,
      message: repEvent.message,
      fogAfter: fogOf(repEvent.state),
    };

    state = goto(state, ["cracked_portal", "sealed_cache"]);
    const fogBeforeSealed = fogOf(state);
    const rpBeforeSealed = state.rewardPoints;
    const lyBeforeSealed = state.lingyun;
    state = commit(state, { type: "node/collect-reward" }, "flow-b sealed_cache collect");
    observations.sealedCacheCollect = {
      nodeId: "sealed_cache",
      fogBefore: fogBeforeSealed,
      fogAfter: fogOf(state),
      rewardPointsBefore: rpBeforeSealed,
      rewardPointsAfter: state.rewardPoints,
      lingyunBefore: lyBeforeSealed,
      lingyunAfter: state.lingyun,
      medicineAsh: state.inventory.medicine_ash,
      hiddenStone: state.inventory.hidden_stone,
    };
    const repSealed = tryCommit(state, { type: "node/collect-reward" });
    observations.sealedCacheRepeat = {
      status: repSealed.status,
      code: repSealed.code,
      message: repSealed.message,
      fogAfter: fogOf(repSealed.state),
      rewardPointsAfter: repSealed.state.rewardPoints,
    };

    const fogBeforeMist = fogOf(state);
    state = commit(
      state,
      { type: "node/resolve-event", eventId: "mist_sealed_cache", optionId: "match_cache_breath" },
      "flow-b mist_sealed_cache relief",
    );
    observations.mistEventClamp = {
      eventId: "mist_sealed_cache",
      fogBefore: fogBeforeMist,
      fogAfter: fogOf(state),
      log: state.log[0],
    };
    const repMist = tryCommit(
      state,
      { type: "node/resolve-event", eventId: "mist_sealed_cache", optionId: "match_cache_breath" },
    );
    observations.mistEventRepeat = {
      status: repMist.status,
      code: repMist.code,
      message: repMist.message,
      fogAfter: fogOf(repMist.state),
    };

    state = goto(state, ["tower_exit", "evac_supply_cache", "last_blessing_reward", "quiet_prayer_reward"]);
    const fogBeforeQuiet = fogOf(state);
    const rpBeforeQuiet = state.rewardPoints;
    const lyBeforeQuiet = state.lingyun;
    state = commit(state, { type: "node/collect-reward" }, "flow-b quiet_prayer collect");
    observations.quietPrayerCollect = {
      nodeId: "quiet_prayer_reward",
      fogBefore: fogBeforeQuiet,
      fogAfter: fogOf(state),
      rewardPointsBefore: rpBeforeQuiet,
      rewardPointsAfter: state.rewardPoints,
      lingyunBefore: lyBeforeQuiet,
      lingyunAfter: state.lingyun,
      spiritBait: state.inventory.spirit_bait,
    };
    const repQuiet = tryCommit(state, { type: "node/collect-reward" });
    observations.quietPrayerRepeat = {
      status: repQuiet.status,
      code: repQuiet.code,
      message: repQuiet.message,
      fogAfter: fogOf(repQuiet.state),
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("demon-recovery-landmark-relief");
    expectFlow(flowB, expected, "flow-b");
    results.push({
      id: "demon-recovery-landmark-relief",
      status: "PASS",
      fogPressure: flowB.roundtrip.lawData.fogPressure,
    });
  }

  // Flow C exercises the high-fog side route gates: at fog 1 the
  // demon_clear_blood_stair gate (max 0) is closed, at fog 2 the
  // demon_fog_bone_lane boss gate (max 1) is closed and the move is
  // illegal-move, relieving via sealed_cache opens the gate (legal move), the
  // boss is cleared and the elite loot is abandoned, all four relief landmarks
  // are resolved (fog 0), and raising fog via a trap then shows the exhausted
  // gate reason. The round-trip preserves fogPressure 1.
  const flowC = (() => {
    let state = hubState;
    const observations = { gates: [], moves: [] };
    state = enterTower(state);
    const f0 = fightMonster(state, "fog_lesser_demon");
    state = f0.state;
    state = goto(state, ["blood_rune_trap"]);
    observations.gates.push(gateCheck(state, "left_watch_trap"));
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-c blood_rune trap");
    state = goto(state, ["cracked_portal", "sealed_cache", "mist_herb_cache"]);
    observations.gates.push(gateCheck(state, "bone_lane_monster"));
    const ill = tryCommit(state, { type: "run/move", nodeId: "bone_lane_monster" });
    observations.moves.push({
      kind: "illegal",
      target: "bone_lane_monster",
      status: ill.status,
      code: ill.code,
      message: ill.message,
      fogAfter: fogOf(ill.state),
    });
    state = goto(state, ["sealed_cache"]);
    state = commit(state, { type: "node/collect-reward" }, "flow-c sealed_cache collect");
    state = goto(state, ["mist_herb_cache"]);
    observations.gates.push(gateCheck(state, "bone_lane_monster"));
    const leg = tryCommit(state, { type: "run/move", nodeId: "bone_lane_monster" });
    observations.moves.push({
      kind: "legal",
      target: "bone_lane_monster",
      status: leg.status,
      fogAfter: fogOf(leg.state),
    });
    state = leg.state;

    const fb = fightMonster(state, "bone_lane_monster");
    state = fb.state;
    observations.bossCleared = state.run.clearedNodeIds.includes("bone_lane_monster");
    observations.fogAfterBoss = fogOf(state);
    const loot = resolveLoot(state);
    state = loot.state;
    observations.hadLootOffer = loot.hadOffer;

    state = goto(state, ["tower_exit", "evac_supply_cache", "last_blessing_reward", "quiet_prayer_reward"]);
    state = commit(state, { type: "node/collect-reward" }, "flow-c quiet_prayer collect");
    state = goto(state, ["last_blessing_reward", "evac_supply_cache", "tower_exit", "sealed_cache"]);
    state = commit(
      state,
      { type: "node/resolve-event", eventId: "mist_sealed_cache", optionId: "match_cache_breath" },
      "flow-c mist_sealed_cache relief",
    );
    state = goto(state, ["cracked_portal", "blood_rune_trap"]);
    state = commit(
      state,
      { type: "node/resolve-event", eventId: "blood_rune_stair", optionId: "breathe_through_runes" },
      "flow-c blood_rune_stair relief",
    );
    observations.fogAfterAllRelief = fogOf(state);
    const law = lawOf(state);
    observations.allReliefResolved = {
      sealedCache: law.state.clearedNodeIds.includes("sealed_cache"),
      quietPrayer: law.state.clearedNodeIds.includes("quiet_prayer_reward"),
      bloodRuneEvent: law.state.resolvedEventIds.includes("blood_rune_stair"),
      mistEvent: law.state.resolvedEventIds.includes("mist_sealed_cache"),
    };

    state = goto(state, ["fog_lesser_demon", "ash_pit_trap"]);
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-c ash_pit trap");
    observations.fogAfterRaise = fogOf(state);

    state = goto(state, ["fog_lesser_demon", "blood_rune_trap"]);
    observations.exhaustedGate = gateCheck(state, "left_watch_trap");

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("demon-high-fog-side-route-gates");
    expectFlow(flowC, expected, "flow-c");
    results.push({
      id: "demon-high-fog-side-route-gates",
      status: "PASS",
      fogPressure: flowC.roundtrip.lawData.fogPressure,
      exhaustedReason: flowC.exhaustedGate.blockReason,
    });
  }

  // Flow D exercises the boss gate, entry snapshot, phase/fog modifier, and
  // exit seal: the boss gate is closed at fog 2 (illegal-move), relieved to
  // fog 1 (open), the boss entry is snapshotted (HP 83, sealed phase, attack
  // 15, defense 7, 雾塔剔骨监斩官 / 白骨闭门阵), the fight awakens at round 3
  // (血骨开铡) and clears the node (fog 1→2), the exit seal goes 0/1→1/1, and
  // a repeat boss select is already-resolved. Chapter 1 law state has no
  // bossSnapshot field (unlike panopticon/combat_replay); the entry snapshot,
  // awakening, and seal transition are the equivalent dynamic evidence. The
  // round-trip preserves fogPressure 2 and the cleared boss node id.
  const flowD = (() => {
    let state = hubState;
    const observations = {};
    state = enterTower(state);
    const f0 = fightMonster(state, "fog_lesser_demon");
    state = f0.state;
    state = goto(state, ["blood_rune_trap"]);
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "flow-d blood_rune trap");
    state = goto(state, ["cracked_portal", "sealed_cache", "mist_herb_cache"]);
    observations.bossGateClosed = gateCheck(state, "bone_lane_monster");
    const ill = tryCommit(state, { type: "run/move", nodeId: "bone_lane_monster" });
    observations.illegalBossMove = {
      status: ill.status,
      code: ill.code,
      message: ill.message,
      fogAfter: fogOf(ill.state),
    };
    state = goto(state, ["sealed_cache"]);
    state = commit(state, { type: "node/collect-reward" }, "flow-d sealed_cache collect");
    state = goto(state, ["mist_herb_cache"]);
    observations.bossGateOpen = gateCheck(state, "bone_lane_monster");
    state = commit(state, { type: "run/move", nodeId: "bone_lane_monster" }, "flow-d move boss");

    const hpBeforeBoss = state.player.hp;
    const fogBeforeBoss = fogOf(state);
    state = commit(state, { type: "run/select-node", nodeId: "bone_lane_monster" }, "flow-d select boss");
    const prof = core.getCombatEncounterProfile(state);
    observations.bossEntry = {
      monsterHp: state.combat?.monsterHp,
      bossPhase: state.combat?.bossPhase,
      turn: state.combat?.turn,
      attack: prof?.monster?.attack,
      defense: prof?.monster?.defense,
      bossTitle: prof?.boss?.definition?.bossTitle,
      sealName: prof?.boss?.definition?.sealName,
      openingLine: state.combat?.log?.[0] ?? null,
    };
    let rounds = 0;
    const bossLogs = [];
    let awakened = null;
    while (state.phase === "combat" && rounds < 80) {
      state = commit(state, { type: "combat/act", action: "attack" }, `flow-d boss r${rounds}`);
      if (state.combat?.log) {
        for (const line of state.combat.log) {
          if (line.includes("血骨开铡") && !awakened) {
            awakened = {
              round: rounds,
              monsterHp: state.combat?.monsterHp,
              bossPhase: state.combat?.bossPhase,
            };
          }
          bossLogs.push(line);
        }
      }
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-01 boss combat did not resolve");
    }
    const awakeningLine = [...new Set(bossLogs)].find((l) => l.includes("血骨开铡")) ?? null;
    observations.bossFight = {
      rounds,
      damageTaken: hpBeforeBoss - state.player.hp,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("bone_lane_monster"),
      fogBefore: fogBeforeBoss,
      fogAfter: fogOf(state),
      awakened,
      awakeningLine,
    };
    observations.sealAfter = core.getBossSealStatus(state)?.requirementText ?? null;
    const rep = tryCommit(state, { type: "run/select-node", nodeId: "bone_lane_monster" });
    observations.repeatBossSelect = {
      status: rep.status,
      code: rep.code,
      message: rep.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("demon-boss-gate-seal-exit");
    expectFlow(flowD, expected, "flow-d");
    results.push({
      id: "demon-boss-gate-seal-exit",
      status: "PASS",
      bossCleared: flowD.bossFight.cleared,
      sealAfter: flowD.sealAfter,
    });
  }

  // Flow E exercises node reward idempotency and the save-codec round-trip:
  // collecting broken_sigil_reward pays once (rewardPoints 1010→1085,
  // thunder_talisman 1) and a second collect is domain-rejected, then
  // watch_post_cache pays once (1085→1155, medicine_ash 1). The round-trip
  // preserves fogPressure 1 and the cleared node ids.
  const flowE = (() => {
    let state = hubState;
    const observations = {};
    state = enterTower(state);
    const f0 = fightMonster(state, "fog_lesser_demon");
    state = f0.state;
    observations.fogAfterStart = fogOf(state);

    state = goto(state, ["broken_sigil_reward"]);
    const rpBeforeBroken = state.rewardPoints;
    state = commit(state, { type: "node/collect-reward" }, "flow-e broken_sigil collect");
    observations.brokenSigilCollect = {
      nodeId: "broken_sigil_reward",
      rewardPointsBefore: rpBeforeBroken,
      rewardPointsAfter: state.rewardPoints,
      thunderTalisman: state.inventory.thunder_talisman,
    };
    const repBroken = tryCommit(state, { type: "node/collect-reward" });
    observations.brokenSigilRepeat = {
      status: repBroken.status,
      code: repBroken.code,
      message: repBroken.message,
      rewardPointsAfter: repBroken.state.rewardPoints,
    };

    state = goto(state, ["watch_post_cache"]);
    const rpBeforeWatch = state.rewardPoints;
    state = commit(state, { type: "node/collect-reward" }, "flow-e watch_post collect");
    observations.watchPostCollect = {
      nodeId: "watch_post_cache",
      rewardPointsBefore: rpBeforeWatch,
      rewardPointsAfter: state.rewardPoints,
      medicineAsh: state.inventory.medicine_ash,
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("demon-reward-idempotency-roundtrip");
    expectFlow(flowE, expected, "flow-e");
    results.push({
      id: "demon-reward-idempotency-roundtrip",
      status: "PASS",
      rewardPoints: flowE.roundtrip.rewardPoints,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law02Metro({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-02 metro legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-02 metro legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-02 metro decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const metroEntryCommand = () => ({
    type: "run/enter",
    dungeonId: "metro_abyss",
    protocolId: "standard",
    seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
  });

  function runMetroFlow(label) {
    let state = decoded.state;
    const observations = {
      entryTide: undefined,
      clears: [],
      gates: [],
      modifiers: [],
      reselect: undefined,
      finalClearedNodeIds: undefined,
      finalTide: undefined,
      finalHp: undefined,
    };
    const currentLaw = () => core.getCurrentDungeonLaw(state);
    const tide = () => currentLaw().state.law.tide;
    const commit = (command, step) => {
      const result = application.reduceGameCommand(state, command);
      if (result.status !== "committed") {
        throw new AcceptanceAssertionError(
          `${label} ${step}: ${result.reason.code} ${result.reason.message}`,
        );
      }
      state = result.state;
    };
    const enter = () => {
      commit(metroEntryCommand(), "enter metro_abyss");
      observations.entryTide = tide();
    };
    const move = (nodeId) => commit({ type: "run/move", nodeId }, `move ${nodeId}`);
    const collectReward = (nodeId) => {
      const tideBefore = tide();
      commit({ type: "node/collect-reward" }, `collect ${nodeId}`);
      observations.clears.push({ nodeId, tideBefore, tideAfter: tide() });
    };
    const handleTrapRisk = (nodeId) => {
      const tideBefore = tide();
      const hpBefore = state.player.hp;
      commit({ type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
      observations.clears.push({
        nodeId,
        tideBefore,
        tideAfter: tide(),
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const fightMonster = (nodeId) => {
      const tideBefore = tide();
      const hpBefore = state.player.hp;
      commit({ type: "run/select-node", nodeId }, `select ${nodeId}`);
      let rounds = 0;
      while (state.phase === "combat" && rounds < 40) {
        commit({ type: "combat/act", action: "attack" }, `attack ${nodeId} round ${rounds}`);
        rounds += 1;
      }
      if (state.phase !== "explore") {
        throw new AcceptanceAssertionError(
          `${label} ${nodeId} combat did not resolve within 40 rounds`,
        );
      }
      observations.clears.push({
        nodeId,
        tideBefore,
        tideAfter: tide(),
        combatRounds: rounds,
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const checkGate = (targetNodeId) => {
      const status = core.getCurrentRouteGateStatus(state, targetNodeId);
      if (status === undefined) {
        throw new AcceptanceAssertionError(
          `${label} route gate to ${targetNodeId} is undefined from ${state.run.currentNodeId}`,
        );
      }
      observations.gates.push({
        gateId: status.gate.id,
        checkedFromNodeId: state.run.currentNodeId,
        targetNodeId,
        tideWhenChecked: tide(),
        status: status.status,
        isOpen: status.isOpen,
        blockReason: status.blockReason ?? null,
      });
    };
    const recordModifiers = () => {
      const law = currentLaw();
      observations.modifiers.push({
        tide: law.state.law.tide,
        trap: {
          damagePercent: law.modifiers.trap.damagePercent,
          dcPercent: law.modifiers.trap.dcPercent,
        },
        display: {
          title: law.display.title,
          status: law.display.status,
          severity: law.display.severity,
          meter: { value: law.display.meter.value, max: law.display.meter.max },
          targetReached: law.display.targetReached,
        },
      });
    };
    const reselectCleared = (nodeId) => {
      const tideBefore = tide();
      const result = application.reduceGameCommand(state, { type: "run/select-node", nodeId });
      if (result.status !== "rejected") {
        throw new AcceptanceAssertionError(
          `${label} re-select of cleared ${nodeId} must be rejected`,
        );
      }
      observations.reselect = {
        nodeId,
        rejectionCode: result.reason.code,
        tideBefore,
        tideAfter: tide(),
      };
    };
    const finish = () => {
      const law = currentLaw();
      observations.finalClearedNodeIds = [...law.state.clearedNodeIds];
      observations.finalTide = law.state.law.tide;
      observations.finalHp = state.player.hp;
    };
    return {
      observations,
      enter,
      move,
      collectReward,
      handleTrapRisk,
      fightMonster,
      checkGate,
      recordModifiers,
      reselectCleared,
      finish,
    };
  }

  // Flow A walks the mainline: full ebb→flood→mirror cycle, the ebb/flood
  // direction gates, mirror-tide pressure and the signal_cache reset.
  const flowA = runMetroFlow("flow-a");
  flowA.enter();
  flowA.collectReward("platform_arrival");
  flowA.move("tide_boatman");
  flowA.checkGate("mirror_tide_trap");
  flowA.fightMonster("tide_boatman");
  flowA.recordModifiers();
  flowA.move("platform_arrival");
  flowA.move("drainage_cache");
  flowA.collectReward("drainage_cache");
  flowA.move("platform_arrival");
  flowA.move("tide_boatman");
  flowA.checkGate("mirror_tide_trap");
  flowA.move("mirror_tide_trap");
  flowA.handleTrapRisk("mirror_tide_trap");
  flowA.move("rail_patrol_wraith");
  flowA.fightMonster("rail_patrol_wraith");
  flowA.move("coin_turnstile");
  flowA.collectReward("coin_turnstile");
  flowA.checkGate("north_floodgate_trap");
  flowA.move("rail_patrol_wraith");
  flowA.move("mirror_tide_trap");
  flowA.move("rail_portal");
  flowA.move("spare_train_portal");
  flowA.move("wet_ticket_hall");
  flowA.collectReward("wet_ticket_hall");
  flowA.move("signal_cache");
  flowA.collectReward("signal_cache");
  flowA.recordModifiers();
  flowA.finish();
  const obsA = flowA.observations;

  // Flow B re-enters from the same migrated hub state to cover the
  // mirror-tide web gate and the no-double-clear boundary.
  const flowB = runMetroFlow("flow-b");
  flowB.enter();
  flowB.collectReward("platform_arrival");
  flowB.move("drainage_cache");
  flowB.collectReward("drainage_cache");
  flowB.move("lampbox_supply");
  flowB.collectReward("lampbox_supply");
  flowB.move("rail_wraith");
  flowB.fightMonster("rail_wraith");
  flowB.move("mirror_web_cache");
  flowB.collectReward("mirror_web_cache");
  flowB.checkGate("thread_snare_trap");
  flowB.move("thread_snare_trap");
  flowB.handleTrapRisk("thread_snare_trap");
  flowB.move("mirror_web_cache");
  flowB.checkGate("thread_snare_trap");
  flowB.reselectCleared("mirror_web_cache");
  flowB.finish();
  const obsB = flowB.observations;

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("tide-cycle-on-first-clear");
    equal(obsA.entryTide, expected.initialTide, "law-02 initial tide");
    equal(obsA.clears.length, expected.clears.length, "law-02 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      const actualClear = obsA.clears[index];
      const expectedClear = expected.clears[index];
      equal(actualClear.nodeId, expectedClear.nodeId, `law-02 clear ${index} node`);
      equal(actualClear.tideAfter, expectedClear.tideAfter, `law-02 clear ${index} tide`);
      if (expectedClear.combatRounds !== undefined) {
        equal(
          actualClear.combatRounds,
          expectedClear.combatRounds,
          `law-02 clear ${index} combat rounds`,
        );
      }
      if (expectedClear.hpAfter !== undefined) {
        equal(actualClear.hpAfter, expectedClear.hpAfter, `law-02 clear ${index} hp`);
      }
    }
    deepEqual(obsA.finalClearedNodeIds, expected.finalClearedNodeIds, "law-02 final cleared order");
    equal(obsA.finalTide, expected.finalTide, "law-02 final tide");
    equal(obsA.finalHp, expected.finalHp, "law-02 final hp");
    results.push({
      id: "tide-cycle-on-first-clear",
      status: "PASS",
      clearCount: obsA.clears.length,
      tideSequence: obsA.clears.map((clear) => clear.tideAfter),
      finalTide: obsA.finalTide,
      finalHp: obsA.finalHp,
    });
  }

  {
    const expected = expectedById.get("signal-cache-calibration");
    const calibrationIndex = obsA.clears.findIndex(
      (clear) => clear.nodeId === expected.calibrationNodeId,
    );
    assert(calibrationIndex > 0, "law-02 calibration node was cleared after another node");
    const calibration = obsA.clears[calibrationIndex];
    equal(
      obsA.clears[calibrationIndex - 1].tideAfter,
      expected.tideBefore,
      "law-02 tide before calibration matches the prior clear",
    );
    equal(calibration.tideBefore, expected.tideBefore, "law-02 calibration tide before");
    equal(calibration.tideAfter, expected.tideAfter, "law-02 calibration tide after");
    assert(
      calibration.tideAfter !== expected.cycleWouldHaveAdvancedTo,
      "law-02 calibration reset differs from a cycle advance",
    );
    results.push({
      id: "signal-cache-calibration",
      status: "PASS",
      calibrationNodeId: expected.calibrationNodeId,
      tideBefore: calibration.tideBefore,
      tideAfter: calibration.tideAfter,
    });
  }

  {
    const expected = expectedById.get("route-gates-follow-tide");
    for (const expectedGate of expected.gates) {
      const matches = obsA.gates.filter((gate) => gate.gateId === expectedGate.gateId);
      const closed = matches.find((gate) => gate.tideWhenChecked === expectedGate.closedAtTide);
      assert(closed !== undefined, `law-02 gate ${expectedGate.gateId} observed closed at its blocking tide`);
      equal(closed.status, "closed", `law-02 gate ${expectedGate.gateId} closed status`);
      equal(closed.isOpen, false, `law-02 gate ${expectedGate.gateId} closed isOpen`);
      equal(
        closed.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-02 gate ${expectedGate.gateId} closed from-node`,
      );
      equal(
        closed.targetNodeId,
        expectedGate.targetNodeId,
        `law-02 gate ${expectedGate.gateId} target node`,
      );
      equal(
        closed.blockReason,
        expectedGate.closedReason,
        `law-02 gate ${expectedGate.gateId} block reason`,
      );
      if (expectedGate.openAtTide !== undefined) {
        const open = matches.find((gate) => gate.tideWhenChecked === expectedGate.openAtTide);
        assert(open !== undefined, `law-02 gate ${expectedGate.gateId} observed open at its required tide`);
        equal(open.status, "open", `law-02 gate ${expectedGate.gateId} open status`);
        equal(open.isOpen, true, `law-02 gate ${expectedGate.gateId} open isOpen`);
        equal(open.blockReason, null, `law-02 gate ${expectedGate.gateId} open has no block reason`);
      }
    }
    results.push({
      id: "route-gates-follow-tide",
      status: "PASS",
      verifiedGates: expected.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("mirror-tide-modifiers");
    equal(
      obsA.modifiers.length,
      expected.observations.length,
      "law-02 modifier observation count",
    );
    for (let index = 0; index < expected.observations.length; index += 1) {
      const actualModifiers = obsA.modifiers[index];
      const expectedModifiers = expected.observations[index];
      equal(actualModifiers.tide, expectedModifiers.tide, `law-02 modifier ${index} tide`);
      deepEqual(actualModifiers.trap, expectedModifiers.trap, `law-02 modifier ${index} trap`);
      deepEqual(
        actualModifiers.display,
        expectedModifiers.display,
        `law-02 modifier ${index} display`,
      );
    }
    results.push({
      id: "mirror-tide-modifiers",
      status: "PASS",
      mirrorTrap: obsA.modifiers[0].trap,
      ebbTrap: obsA.modifiers[obsA.modifiers.length - 1].trap,
    });
  }

  {
    const expected = expectedById.get("mirror-gate-follows-tide");
    equal(obsB.clears.length, expected.clears.length, "law-02 flow-b clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      const actualClear = obsB.clears[index];
      const expectedClear = expected.clears[index];
      equal(actualClear.nodeId, expectedClear.nodeId, `law-02 flow-b clear ${index} node`);
      equal(actualClear.tideAfter, expectedClear.tideAfter, `law-02 flow-b clear ${index} tide`);
      if (expectedClear.combatRounds !== undefined) {
        equal(
          actualClear.combatRounds,
          expectedClear.combatRounds,
          `law-02 flow-b clear ${index} combat rounds`,
        );
      }
      if (expectedClear.hpAfter !== undefined) {
        equal(actualClear.hpAfter, expectedClear.hpAfter, `law-02 flow-b clear ${index} hp`);
      }
    }
    deepEqual(obsB.finalClearedNodeIds, expected.finalClearedNodeIds, "law-02 flow-b final cleared order");
    equal(obsB.finalTide, expected.finalTide, "law-02 flow-b final tide");
    equal(obsB.finalHp, expected.finalHp, "law-02 flow-b final hp");
    const matches = obsB.gates.filter((gate) => gate.gateId === expected.gateId);
    const open = matches.find((gate) => gate.tideWhenChecked === expected.openAtTide);
    const closed = matches.find((gate) => gate.tideWhenChecked === expected.closedAtTide);
    assert(open !== undefined, "law-02 mirror gate observed at mirror tide");
    equal(open.status, "open", "law-02 mirror gate open status");
    equal(open.isOpen, true, "law-02 mirror gate open isOpen");
    equal(open.checkedFromNodeId, expected.checkedFromNodeId, "law-02 mirror gate open from-node");
    equal(open.targetNodeId, expected.targetNodeId, "law-02 mirror gate open target");
    assert(closed !== undefined, "law-02 mirror gate observed at ebb tide");
    equal(closed.status, "closed", "law-02 mirror gate closed status");
    equal(closed.isOpen, false, "law-02 mirror gate closed isOpen");
    equal(closed.blockReason, expected.closedReason, "law-02 mirror gate block reason");
    results.push({
      id: "mirror-gate-follows-tide",
      status: "PASS",
      gateId: expected.gateId,
      openAtTide: expected.openAtTide,
      closedAtTide: expected.closedAtTide,
      finalHp: obsB.finalHp,
    });
  }

  {
    const expected = expectedById.get("repeat-clear-no-advance");
    assert(obsB.reselect !== undefined, "law-02 reselect boundary was exercised");
    equal(obsB.reselect.nodeId, expected.reselectedNodeId, "law-02 reselect node");
    equal(obsB.reselect.rejectionCode, expected.rejectionCode, "law-02 reselect rejection code");
    equal(obsB.reselect.tideBefore, expected.tideBefore, "law-02 reselect tide before");
    equal(obsB.reselect.tideAfter, expected.tideAfter, "law-02 reselect tide after");
    equal(
      obsB.reselect.tideBefore,
      obsB.reselect.tideAfter,
      "law-02 reselect does not advance the tide",
    );
    results.push({
      id: "repeat-clear-no-advance",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: expected.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law03Mine({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-03 mine legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-03 mine legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-03 mine decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const mineEntryCommand = () => ({
    type: "run/enter",
    dungeonId: "starfall_mine",
    protocolId: "standard",
    seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
  });

  function runMineFlow(label) {
    let state = decoded.state;
    const observations = {
      entryGravity: undefined,
      clears: [],
      gates: [],
      modifiers: [],
      combats: [],
      reselect: undefined,
      finalClearedNodeIds: undefined,
      finalGravity: undefined,
      finalHp: undefined,
    };
    const currentLaw = () => core.getCurrentDungeonLaw(state);
    const gravity = () => currentLaw().state.law.gravity;
    const commit = (command, step) => {
      const result = application.reduceGameCommand(state, command);
      if (result.status !== "committed") {
        throw new AcceptanceAssertionError(
          `${label} ${step}: ${result.reason.code} ${result.reason.message}`,
        );
      }
      state = result.state;
    };
    const enter = () => {
      commit(mineEntryCommand(), "enter starfall_mine");
      observations.entryGravity = gravity();
    };
    const move = (nodeId) => commit({ type: "run/move", nodeId }, `move ${nodeId}`);
    const collectReward = (nodeId) => {
      const gravityBefore = gravity();
      commit({ type: "node/collect-reward" }, `collect ${nodeId}`);
      observations.clears.push({ nodeId, gravityBefore, gravityAfter: gravity() });
    };
    const handleTrapRisk = (nodeId) => {
      const gravityBefore = gravity();
      const hpBefore = state.player.hp;
      commit({ type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
      observations.clears.push({
        nodeId,
        gravityBefore,
        gravityAfter: gravity(),
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const handleTrapCounter = (nodeId) => {
      const gravityBefore = gravity();
      const hpBefore = state.player.hp;
      commit({ type: "node/handle-trap", choice: "counter" }, `counter ${nodeId}`);
      observations.clears.push({
        nodeId,
        gravityBefore,
        gravityAfter: gravity(),
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const fightMonster = (nodeId) => {
      const gravityBefore = gravity();
      const hpBefore = state.player.hp;
      commit({ type: "run/select-node", nodeId }, `select ${nodeId}`);
      let rounds = 0;
      while (state.phase === "combat" && rounds < 40) {
        commit({ type: "combat/act", action: "attack" }, `attack ${nodeId} round ${rounds}`);
        rounds += 1;
      }
      if (state.phase !== "explore") {
        throw new AcceptanceAssertionError(
          `${label} ${nodeId} combat did not resolve within 40 rounds`,
        );
      }
      observations.clears.push({
        nodeId,
        gravityBefore,
        gravityAfter: gravity(),
        combatRounds: rounds,
        hpBefore,
        hpAfter: state.player.hp,
      });
      observations.combats.push({
        nodeId,
        gravity: gravityBefore,
        rounds,
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const checkGate = (targetNodeId) => {
      const status = core.getCurrentRouteGateStatus(state, targetNodeId);
      if (status === undefined) {
        throw new AcceptanceAssertionError(
          `${label} route gate to ${targetNodeId} is undefined from ${state.run.currentNodeId}`,
        );
      }
      observations.gates.push({
        gateId: status.gate.id,
        checkedFromNodeId: state.run.currentNodeId,
        targetNodeId,
        gravityWhenChecked: gravity(),
        status: status.status,
        isOpen: status.isOpen,
        blockReason: status.blockReason ?? null,
      });
    };
    const recordModifiers = () => {
      const law = currentLaw();
      observations.modifiers.push({
        gravity: law.state.law.gravity,
        trap: {
          damagePercent: law.modifiers.trap.damagePercent,
          dcPercent: law.modifiers.trap.dcPercent,
        },
        encounterDefensePercent: law.modifiers.encounter.defensePercent,
        display: {
          title: law.display.title,
          status: law.display.status,
          severity: law.display.severity,
          meter: law.display.meter,
          targetReached: law.display.targetReached,
        },
      });
    };
    const reselectCleared = (nodeId) => {
      const gravityBefore = gravity();
      const result = application.reduceGameCommand(state, { type: "run/select-node", nodeId });
      if (result.status !== "rejected") {
        throw new AcceptanceAssertionError(
          `${label} re-select of cleared ${nodeId} must be rejected`,
        );
      }
      observations.reselect = {
        nodeId,
        rejectionCode: result.reason.code,
        gravityBefore,
        gravityAfter: gravity(),
      };
    };
    const finish = () => {
      const law = currentLaw();
      observations.finalClearedNodeIds = [...law.state.clearedNodeIds];
      observations.finalGravity = law.state.law.gravity;
      observations.finalHp = state.player.hp;
    };
    return {
      observations,
      enter,
      move,
      collectReward,
      handleTrapRisk,
      handleTrapCounter,
      fightMonster,
      checkGate,
      recordModifiers,
      reselectCleared,
      finish,
    };
  }

  // Flow A walks the mainline: upward traps/combat, the gravity switch flip,
  // a downward-gravity combat, and all four route gates.
  const flowA = runMineFlow("flow-a");
  flowA.enter();
  flowA.recordModifiers();
  flowA.collectReward("mine_arrival");
  flowA.move("inverted_shaft_trap");
  flowA.handleTrapRisk("inverted_shaft_trap");
  flowA.move("star_core_reward");
  flowA.collectReward("star_core_reward");
  flowA.move("spark_imp_switchback");
  flowA.fightMonster("spark_imp_switchback");
  flowA.checkGate("rift_dust_reward");
  flowA.move("magnetic_rail_trap");
  flowA.checkGate("coil_burst_trap");
  flowA.handleTrapRisk("magnetic_rail_trap");
  flowA.move("coil_burst_trap");
  flowA.handleTrapCounter("coil_burst_trap");
  flowA.move("gravity_branch_reward");
  flowA.collectReward("gravity_branch_reward");
  flowA.move("tilted_gravity_switch");
  flowA.checkGate("gravity_branch_reward");
  flowA.handleTrapRisk("tilted_gravity_switch");
  flowA.recordModifiers();
  flowA.reselectCleared("tilted_gravity_switch");
  flowA.checkGate("gravity_branch_reward");
  flowA.move("spark_imp_roost");
  flowA.fightMonster("spark_imp_roost");
  flowA.recordModifiers();
  flowA.move("tilted_gravity_switch");
  flowA.move("gravity_branch_reward");
  flowA.move("coil_burst_trap");
  flowA.move("magnetic_rail_trap");
  flowA.move("spark_imp_switchback");
  flowA.checkGate("rift_dust_reward");
  flowA.move("rift_dust_reward");
  flowA.collectReward("rift_dust_reward");
  flowA.checkGate("molt_beast_den");
  flowA.finish();
  const obsA = flowA.observations;

  // Flow B re-enters from the same migrated hub state to cover the
  // upward-coil gate closed at downward gravity.
  const flowB = runMineFlow("flow-b");
  flowB.enter();
  flowB.collectReward("mine_arrival");
  flowB.move("inverted_shaft_trap");
  flowB.handleTrapRisk("inverted_shaft_trap");
  flowB.move("star_core_reward");
  flowB.collectReward("star_core_reward");
  flowB.move("spark_imp_switchback");
  flowB.fightMonster("spark_imp_switchback");
  flowB.move("magnetic_rail_trap");
  flowB.handleTrapRisk("magnetic_rail_trap");
  flowB.move("coil_burst_trap");
  flowB.handleTrapCounter("coil_burst_trap");
  flowB.move("gravity_branch_reward");
  flowB.collectReward("gravity_branch_reward");
  flowB.move("tilted_gravity_switch");
  flowB.handleTrapRisk("tilted_gravity_switch");
  flowB.recordModifiers();
  flowB.move("gravity_branch_reward");
  flowB.move("coil_burst_trap");
  flowB.move("magnetic_rail_trap");
  flowB.checkGate("coil_burst_trap");
  flowB.recordModifiers();
  flowB.finish();
  const obsB = flowB.observations;

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("gravity-switch-on-clear");
    equal(obsA.entryGravity, expected.initialGravity, "law-03 initial gravity");
    equal(obsA.clears.length, expected.clears.length, "law-03 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      const actualClear = obsA.clears[index];
      const expectedClear = expected.clears[index];
      equal(actualClear.nodeId, expectedClear.nodeId, `law-03 clear ${index} node`);
      equal(actualClear.gravityAfter, expectedClear.gravityAfter, `law-03 clear ${index} gravity`);
      if (expectedClear.combatRounds !== undefined) {
        equal(
          actualClear.combatRounds,
          expectedClear.combatRounds,
          `law-03 clear ${index} combat rounds`,
        );
      }
      if (expectedClear.hpAfter !== undefined) {
        equal(actualClear.hpAfter, expectedClear.hpAfter, `law-03 clear ${index} hp`);
      }
    }
    const switchClear = obsA.clears.find((clear) => clear.nodeId === "tilted_gravity_switch");
    assert(switchClear !== undefined, "law-03 gravity switch node was cleared");
    equal(switchClear.gravityBefore, "upward", "law-03 switch gravity before");
    equal(switchClear.gravityAfter, "downward", "law-03 switch gravity after");
    assert(
      switchClear.gravityBefore !== switchClear.gravityAfter,
      "law-03 switch clear flips gravity",
    );
    const nonSwitchClears = obsA.clears.filter(
      (clear) => clear.nodeId !== "tilted_gravity_switch",
    );
    for (const clear of nonSwitchClears) {
      equal(
        clear.gravityBefore,
        clear.gravityAfter,
        `law-03 non-switch clear ${clear.nodeId} does not flip gravity`,
      );
    }
    deepEqual(obsA.finalClearedNodeIds, expected.finalClearedNodeIds, "law-03 final cleared order");
    equal(obsA.finalGravity, expected.finalGravity, "law-03 final gravity");
    equal(obsA.finalHp, expected.finalHp, "law-03 final hp");
    results.push({
      id: "gravity-switch-on-clear",
      status: "PASS",
      clearCount: obsA.clears.length,
      gravitySequence: obsA.clears.map((clear) => clear.gravityAfter),
      finalGravity: obsA.finalGravity,
      finalHp: obsA.finalHp,
    });
  }

  {
    const expected = expectedById.get("gravity-route-gates");
    for (const expectedGate of expected.gates) {
      const matches = obsA.gates
        .concat(obsB.gates)
        .filter((gate) => gate.gateId === expectedGate.gateId);
      const closed = matches.find((gate) => gate.gravityWhenChecked === expectedGate.closedAtGravity);
      assert(closed !== undefined, `law-03 gate ${expectedGate.gateId} observed closed at its blocking gravity`);
      equal(closed.status, "closed", `law-03 gate ${expectedGate.gateId} closed status`);
      equal(closed.isOpen, false, `law-03 gate ${expectedGate.gateId} closed isOpen`);
      equal(
        closed.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-03 gate ${expectedGate.gateId} closed from-node`,
      );
      equal(
        closed.targetNodeId,
        expectedGate.targetNodeId,
        `law-03 gate ${expectedGate.gateId} target node`,
      );
      equal(
        closed.blockReason,
        expectedGate.closedReason,
        `law-03 gate ${expectedGate.gateId} block reason`,
      );
      if (expectedGate.openAtGravity !== undefined) {
        const open = matches.find((gate) => gate.gravityWhenChecked === expectedGate.openAtGravity);
        assert(open !== undefined, `law-03 gate ${expectedGate.gateId} observed open at its required gravity`);
        equal(open.status, "open", `law-03 gate ${expectedGate.gateId} open status`);
        equal(open.isOpen, true, `law-03 gate ${expectedGate.gateId} open isOpen`);
        equal(open.blockReason, null, `law-03 gate ${expectedGate.gateId} open has no block reason`);
      }
    }
    results.push({
      id: "gravity-route-gates",
      status: "PASS",
      verifiedGates: expected.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("gravity-trap-modifiers");
    const upwardModifiers = obsA.modifiers.find((modifier) => modifier.gravity === "upward");
    const downwardModifiers = obsA.modifiers.find((modifier) => modifier.gravity === "downward");
    assert(upwardModifiers !== undefined, "law-03 upward modifier observation exists");
    assert(downwardModifiers !== undefined, "law-03 downward modifier observation exists");
    const expectedUpward = expected.observations[0];
    const expectedDownward = expected.observations[1];
    equal(upwardModifiers.gravity, expectedUpward.gravity, "law-03 upward modifier gravity");
    deepEqual(upwardModifiers.trap, expectedUpward.trap, "law-03 upward trap modifiers");
    deepEqual(upwardModifiers.display, expectedUpward.display, "law-03 upward display");
    equal(downwardModifiers.gravity, expectedDownward.gravity, "law-03 downward modifier gravity");
    deepEqual(downwardModifiers.trap, expectedDownward.trap, "law-03 downward trap modifiers");
    deepEqual(downwardModifiers.display, expectedDownward.display, "law-03 downward display");
    for (const expectedDamage of expected.upwardTrapDamage) {
      const clear = obsA.clears.find((entry) => entry.nodeId === expectedDamage.nodeId);
      assert(clear !== undefined, `law-03 upward trap ${expectedDamage.nodeId} was resolved`);
      equal(
        clear.hpBefore - clear.hpAfter,
        expectedDamage.hpLost,
        `law-03 upward trap ${expectedDamage.nodeId} damage`,
      );
      equal(clear.gravityBefore, "upward", `law-03 upward trap ${expectedDamage.nodeId} gravity`);
    }
    const switchClear = obsA.clears.find((clear) => clear.nodeId === expected.switchTrapDamage.nodeId);
    assert(switchClear !== undefined, "law-03 switch trap was resolved");
    equal(
      switchClear.hpBefore - switchClear.hpAfter,
      expected.switchTrapDamage.hpLost,
      "law-03 switch trap damage",
    );
    equal(
      switchClear.gravityBefore,
      expected.switchTrapDamage.gravityBefore,
      "law-03 switch trap gravity before",
    );
    equal(
      switchClear.gravityAfter,
      expected.switchTrapDamage.gravityAfter,
      "law-03 switch trap gravity after",
    );
    results.push({
      id: "gravity-trap-modifiers",
      status: "PASS",
      upwardTrap: upwardModifiers.trap,
      downwardTrap: downwardModifiers.trap,
    });
  }

  {
    const expected = expectedById.get("gravity-defense-modifiers");
    const upwardModifiers = obsA.modifiers.find((modifier) => modifier.gravity === "upward");
    const downwardModifiers = obsA.modifiers.find((modifier) => modifier.gravity === "downward");
    equal(
      upwardModifiers.encounterDefensePercent,
      expected.upward.encounterDefensePercent,
      "law-03 upward encounter defense percent",
    );
    equal(
      downwardModifiers.encounterDefensePercent,
      expected.downward.encounterDefensePercent,
      "law-03 downward encounter defense percent",
    );
    const upwardCombat = obsA.combats.find(
      (combat) => combat.nodeId === expected.upward.combat.nodeId,
    );
    assert(upwardCombat !== undefined, "law-03 upward combat was fought");
    equal(upwardCombat.gravity, "upward", "law-03 upward combat gravity");
    equal(upwardCombat.rounds, expected.upward.combat.rounds, "law-03 upward combat rounds");
    equal(
      upwardCombat.hpBefore - upwardCombat.hpAfter,
      expected.upward.combat.hpLost,
      "law-03 upward combat hp lost",
    );
    const downwardCombat = obsA.combats.find(
      (combat) => combat.nodeId === expected.downward.combat.nodeId,
    );
    assert(downwardCombat !== undefined, "law-03 downward combat was fought");
    equal(downwardCombat.gravity, "downward", "law-03 downward combat gravity");
    equal(downwardCombat.rounds, expected.downward.combat.rounds, "law-03 downward combat rounds");
    equal(
      downwardCombat.hpBefore - downwardCombat.hpAfter,
      expected.downward.combat.hpLost,
      "law-03 downward combat hp lost",
    );
    results.push({
      id: "gravity-defense-modifiers",
      status: "PASS",
      upwardDefensePercent: expected.upward.encounterDefensePercent,
      downwardDefensePercent: expected.downward.encounterDefensePercent,
    });
  }

  {
    const expected = expectedById.get("repeat-clear-no-flip");
    assert(obsA.reselect !== undefined, "law-03 reselect boundary was exercised");
    equal(obsA.reselect.nodeId, expected.reselectedNodeId, "law-03 reselect node");
    equal(obsA.reselect.rejectionCode, expected.rejectionCode, "law-03 reselect rejection code");
    equal(obsA.reselect.gravityBefore, expected.gravityBefore, "law-03 reselect gravity before");
    equal(obsA.reselect.gravityAfter, expected.gravityAfter, "law-03 reselect gravity after");
    equal(
      obsA.reselect.gravityBefore,
      obsA.reselect.gravityAfter,
      "law-03 reselect does not flip gravity",
    );
    results.push({
      id: "repeat-clear-no-flip",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: expected.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law04Hospital({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-04 hospital legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-04 hospital legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-04 hospital decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hospitalEntryCommand = () => ({
    type: "run/enter",
    dungeonId: "rust_hospital",
    protocolId: "standard",
    seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
  });

  function runHospitalFlow(label) {
    let state = decoded.state;
    const observations = {
      steps: [],
      pillHeals: [],
      gates: [],
      events: [],
      modifierSnapshots: [],
      reselect: undefined,
      finalPollution: undefined,
      finalHp: undefined,
    };
    const currentLaw = () => core.getCurrentDungeonLaw(state);
    const pollution = () => currentLaw().state.law.pollution;
    const commit = (command, step) => {
      const result = application.reduceGameCommand(state, command);
      if (result.status !== "committed") {
        throw new AcceptanceAssertionError(
          `${label} ${step}: ${result.reason.code} ${result.reason.message}`,
        );
      }
      state = result.state;
    };
    const enter = () => {
      commit(hospitalEntryCommand(), "enter rust_hospital");
      observations.steps.push({
        kind: "enter",
        pollutionAfter: pollution(),
        hpAfter: state.player.hp,
      });
    };
    const move = (nodeId) => commit({ type: "run/move", nodeId }, `move ${nodeId}`);
    const collect = (nodeId) => {
      const pollutionBefore = pollution();
      commit({ type: "node/collect-reward" }, `collect ${nodeId}`);
      observations.steps.push({
        kind: "reward",
        nodeId,
        pollutionBefore,
        pollutionAfter: pollution(),
        hpAfter: state.player.hp,
      });
    };
    const trapRisk = (nodeId) => {
      const pollutionBefore = pollution();
      const hpBefore = state.player.hp;
      commit({ type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
      observations.steps.push({
        kind: "trap-risk",
        nodeId,
        pollutionBefore,
        pollutionAfter: pollution(),
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const trapCounter = (nodeId) => {
      const pollutionBefore = pollution();
      const hpBefore = state.player.hp;
      commit({ type: "node/handle-trap", choice: "counter" }, `counter ${nodeId}`);
      observations.steps.push({
        kind: "trap-counter",
        nodeId,
        pollutionBefore,
        pollutionAfter: pollution(),
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const fight = (nodeId) => {
      const pollutionBefore = pollution();
      const hpBefore = state.player.hp;
      commit({ type: "run/select-node", nodeId }, `select ${nodeId}`);
      let rounds = 0;
      while (state.phase === "combat" && rounds < 40) {
        const usePill = state.player.hp < 75 && state.inventory.healing_pill > 0;
        const action = usePill
          ? "use_healing_pill"
          : (rounds % 2 === 1 ? "guard" : "attack");
        const result = application.reduceGameCommand(state, { type: "combat/act", action });
        if (result.status !== "committed") {
          throw new AcceptanceAssertionError(
            `${label} combat ${nodeId} round ${rounds}: ${result.reason.code} ${result.reason.message}`,
          );
        }
        state = result.state;
        if (usePill) {
          const healLog = state.combat?.log?.find((line) => line.includes("止血丹"));
          const match = healLog && /生命回复 (\d+) 点/.exec(healLog);
          if (match) {
            observations.pillHeals.push({
              nodeId,
              round: rounds,
              pollution: pollutionBefore,
              heal: Number(match[1]),
            });
          }
        }
        rounds += 1;
      }
      if (state.phase !== "explore") {
        throw new AcceptanceAssertionError(
          `${label} ${nodeId} combat did not resolve within 40 rounds`,
        );
      }
      observations.steps.push({
        kind: "combat",
        nodeId,
        pollutionBefore,
        pollutionAfter: pollution(),
        combatRounds: rounds,
        hpBefore,
        hpAfter: state.player.hp,
      });
    };
    const checkGate = (targetNodeId) => {
      const status = core.getCurrentRouteGateStatus(state, targetNodeId);
      if (status === undefined) {
        throw new AcceptanceAssertionError(
          `${label} route gate to ${targetNodeId} is undefined from ${state.run.currentNodeId}`,
        );
      }
      observations.gates.push({
        gateId: status.gate.id,
        checkedFromNodeId: state.run.currentNodeId,
        targetNodeId,
        pollutionWhenChecked: pollution(),
        status: status.status,
        isOpen: status.isOpen,
        blockReason: status.blockReason ?? null,
      });
    };
    const resolveEvent = (eventId, optionId) => {
      const pollutionBefore = pollution();
      commit({ type: "node/resolve-event", eventId, optionId }, `event ${eventId}`);
      observations.events.push({
        eventId,
        optionId,
        pollutionBefore,
        pollutionAfter: pollution(),
        log: state.log[0],
      });
    };
    const resolveEventRejected = (eventId, optionId) => {
      const pollutionBefore = pollution();
      const result = application.reduceGameCommand(state, {
        type: "node/resolve-event",
        eventId,
        optionId,
      });
      if (result.status !== "rejected") {
        throw new AcceptanceAssertionError(
          `${label} repeat event ${eventId} must be rejected`,
        );
      }
      observations.events.push({
        eventId,
        optionId,
        pollutionBefore,
        pollutionAfter: pollution(),
        rejectionCode: result.reason.code,
        log: result.reason.message,
      });
    };
    const reselectCleared = (nodeId) => {
      const pollutionBefore = pollution();
      const result = application.reduceGameCommand(state, { type: "run/select-node", nodeId });
      if (result.status !== "rejected") {
        throw new AcceptanceAssertionError(
          `${label} re-select of cleared ${nodeId} must be rejected`,
        );
      }
      observations.reselect = {
        nodeId,
        rejectionCode: result.reason.code,
        pollutionBefore,
        pollutionAfter: pollution(),
      };
    };
    const snapMods = () => {
      const law = currentLaw();
      observations.modifierSnapshots.push({
        pollution: law.state.law.pollution,
        healingPercent: law.modifiers.healingPercent,
        artPowerPercent: law.modifiers.encounter.artPowerPercent,
        display: {
          title: law.display.title,
          status: law.display.status,
          severity: law.display.severity,
          meter: law.display.meter,
          targetReached: law.display.targetReached,
        },
      });
    };
    const finish = () => {
      observations.finalPollution = pollution();
      observations.finalHp = state.player.hp;
    };
    return {
      observations,
      enter,
      move,
      collect,
      trapRisk,
      trapCounter,
      fight,
      checkGate,
      resolveEvent,
      resolveEventRejected,
      reselectCleared,
      snapMods,
      finish,
    };
  }

  // Flow A walks the mainline: pollution 0->4 through damaging clears, the
  // treatment-weakening tiers, the pharmacy relief, and all four route gates.
  const flowA = runHospitalFlow("flow-a");
  flowA.enter();
  flowA.snapMods();
  flowA.collect("triage_reward");
  flowA.move("medicine_cabinet");
  flowA.collect("medicine_cabinet");
  flowA.move("plague_orderly");
  flowA.fight("plague_orderly");
  flowA.snapMods();
  flowA.move("rust_gurney_trap");
  flowA.trapRisk("rust_gurney_trap");
  flowA.snapMods();
  flowA.checkGate("isolation_chart_reward");
  flowA.move("plague_orderly");
  flowA.move("sterile_corridor");
  flowA.trapRisk("sterile_corridor");
  flowA.snapMods();
  flowA.checkGate("disinfectant_mist_trap");
  flowA.move("plague_orderly_rounds");
  flowA.fight("plague_orderly_rounds");
  flowA.snapMods();
  flowA.move("pharmacy_reward");
  flowA.collect("pharmacy_reward");
  flowA.snapMods();
  flowA.move("sterilizer_trap");
  flowA.checkGate("antidote_cabinet");
  flowA.trapCounter("sterilizer_trap");
  flowA.move("roof_access_trap");
  flowA.checkGate("chief_pulse_doctor");
  flowA.trapRisk("roof_access_trap");
  flowA.snapMods();
  flowA.move("sterilizer_trap");
  flowA.move("pharmacy_reward");
  flowA.reselectCleared("pharmacy_reward");
  flowA.finish();
  const obsA = flowA.observations;

  // Flow B re-enters from the same migrated hub state to cover the triage
  // purification event, its idempotency boundary, and the route it reopens.
  const flowB = runHospitalFlow("flow-b");
  flowB.enter();
  flowB.collect("triage_reward");
  flowB.move("medicine_cabinet");
  flowB.move("plague_orderly");
  flowB.fight("plague_orderly");
  flowB.move("medicine_cabinet");
  flowB.move("triage_reward");
  flowB.resolveEvent("triage_ward", "burn_focus_incense");
  flowB.snapMods();
  flowB.resolveEventRejected("triage_ward", "burn_focus_incense");
  flowB.move("medicine_cabinet");
  flowB.move("plague_orderly");
  flowB.move("rust_gurney_trap");
  flowB.checkGate("isolation_chart_reward");
  flowB.trapRisk("rust_gurney_trap");
  flowB.snapMods();
  flowB.finish();
  const obsB = flowB.observations;

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("pollution-on-damaging-clear");
    equal(obsA.steps[0].pollutionAfter, expected.initialPollution, "law-04 initial pollution");
    const clearSteps = obsA.steps.filter((step) => step.kind !== "enter");
    equal(clearSteps.length, expected.clears.length, "law-04 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      const actualStep = clearSteps[index];
      const expectedClear = expected.clears[index];
      equal(actualStep.nodeId, expectedClear.nodeId, `law-04 clear ${index} node`);
      equal(actualStep.kind, expectedClear.kind, `law-04 clear ${index} kind`);
      equal(
        actualStep.pollutionAfter,
        expectedClear.pollutionAfter,
        `law-04 clear ${index} pollution`,
      );
      equal(actualStep.hpAfter, expectedClear.hpAfter, `law-04 clear ${index} hp`);
      if (expectedClear.combatRounds !== undefined) {
        equal(
          actualStep.combatRounds,
          expectedClear.combatRounds,
          `law-04 clear ${index} combat rounds`,
        );
      }
    }
    equal(obsA.finalPollution, expected.finalPollution, "law-04 final pollution");
    equal(obsA.finalHp, expected.finalHp, "law-04 final hp");
    const nonDamagingClears = clearSteps.filter(
      (step) => step.kind === "reward" || step.kind === "trap-counter",
    );
    for (const step of nonDamagingClears) {
      if (step.nodeId !== "pharmacy_reward") {
        equal(
          step.pollutionBefore,
          step.pollutionAfter,
          `law-04 non-damaging clear ${step.nodeId} does not change pollution`,
        );
      }
    }
    results.push({
      id: "pollution-on-damaging-clear",
      status: "PASS",
      clearCount: clearSteps.length,
      pollutionSequence: clearSteps.map((step) => step.pollutionAfter),
      finalPollution: obsA.finalPollution,
      finalHp: obsA.finalHp,
    });
  }

  {
    const expected = expectedById.get("pollution-treatment-weakening");
    const actualByPollution = new Map();
    for (const snapshot of obsA.modifierSnapshots) {
      if (!actualByPollution.has(snapshot.pollution)) {
        actualByPollution.set(snapshot.pollution, snapshot);
      }
    }
    equal(
      actualByPollution.size,
      expected.observations.length,
      "law-04 modifier observation pollution levels",
    );
    for (const expectedObs of expected.observations) {
      const actual = actualByPollution.get(expectedObs.pollution);
      assert(actual !== undefined, `law-04 modifier observation at pollution ${expectedObs.pollution}`);
      equal(
        actual.healingPercent,
        expectedObs.healingPercent,
        `law-04 pollution ${expectedObs.pollution} healingPercent`,
      );
      equal(
        actual.artPowerPercent,
        expectedObs.artPowerPercent,
        `law-04 pollution ${expectedObs.pollution} artPowerPercent`,
      );
      deepEqual(actual.display, expectedObs.display, `law-04 pollution ${expectedObs.pollution} display`);
    }
    const pillHealsByNode = new Map(
      obsA.pillHeals.map((heal) => [heal.nodeId, heal]),
    );
    for (const expectedHeal of expected.pillHeals) {
      const actualHeals = obsA.pillHeals.filter(
        (heal) => heal.nodeId === expectedHeal.nodeId && heal.pollution === expectedHeal.pollution,
      );
      assert(actualHeals.length > 0, `law-04 pill heal at ${expectedHeal.nodeId} pollution ${expectedHeal.pollution}`);
      for (const heal of actualHeals) {
        equal(heal.heal, expectedHeal.heal, `law-04 pill heal ${heal.nodeId} amount`);
      }
    }
    assert(
      pillHealsByNode.has("plague_orderly") && pillHealsByNode.has("plague_orderly_rounds"),
      "law-04 pill heals observed at pollution 0 and 3",
    );
    results.push({
      id: "pollution-treatment-weakening",
      status: "PASS",
      pollutionLevels: [...actualByPollution.keys()].sort(),
      healingAtPollution3: actualByPollution.get(3).healingPercent,
      healingAtPollution4: actualByPollution.get(4).healingPercent,
      pillHealAtPollution0: pillHealsByNode.get("plague_orderly").heal,
      pillHealAtPollution3: pillHealsByNode.get("plague_orderly_rounds").heal,
    });
  }

  {
    const expected = expectedById.get("pollution-route-gates");
    for (const expectedGate of expected.gates) {
      const matches = obsA.gates.filter((gate) => gate.gateId === expectedGate.gateId);
      assert(matches.length > 0, `law-04 gate ${expectedGate.gateId} was observed`);
      const match = matches.find(
        (gate) => gate.pollutionWhenChecked === expectedGate.pollutionWhenChecked,
      );
      assert(
        match !== undefined,
        `law-04 gate ${expectedGate.gateId} observed at pollution ${expectedGate.pollutionWhenChecked}`,
      );
      equal(match.status, expectedGate.status, `law-04 gate ${expectedGate.gateId} status`);
      equal(match.isOpen, expectedGate.isOpen, `law-04 gate ${expectedGate.gateId} isOpen`);
      equal(
        match.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-04 gate ${expectedGate.gateId} from-node`,
      );
      equal(
        match.targetNodeId,
        expectedGate.targetNodeId,
        `law-04 gate ${expectedGate.gateId} target node`,
      );
      equal(
        match.blockReason,
        expectedGate.blockReason,
        `law-04 gate ${expectedGate.gateId} block reason`,
      );
    }
    results.push({
      id: "pollution-route-gates",
      status: "PASS",
      verifiedGates: expected.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("triage-purification-event");
    const combatStep = obsB.steps.find((step) => step.kind === "combat");
    assert(combatStep !== undefined, "law-04 flow-b combat was fought");
    equal(combatStep.nodeId, expected.combat.nodeId, "law-04 flow-b combat node");
    equal(
      combatStep.pollutionAfter,
      expected.combat.pollutionAfter,
      "law-04 flow-b combat pollution",
    );
    equal(
      combatStep.combatRounds,
      expected.combat.combatRounds,
      "law-04 flow-b combat rounds",
    );
    equal(combatStep.hpAfter, expected.combat.hpAfter, "law-04 flow-b combat hp");
    const successEvent = obsB.events[0];
    equal(successEvent.eventId, expected.eventSuccess.eventId, "law-04 triage event id");
    equal(successEvent.optionId, expected.eventSuccess.optionId, "law-04 triage event option");
    equal(
      successEvent.pollutionBefore,
      expected.eventSuccess.pollutionBefore,
      "law-04 triage event pollution before",
    );
    equal(
      successEvent.pollutionAfter,
      expected.eventSuccess.pollutionAfter,
      "law-04 triage event pollution after",
    );
    assert(
      successEvent.pollutionBefore > successEvent.pollutionAfter,
      "law-04 triage event relieves pollution",
    );
    const repeatEvent = obsB.events[1];
    equal(
      repeatEvent.pollutionBefore,
      expected.eventRepeat.pollutionBefore,
      "law-04 triage repeat pollution before",
    );
    equal(
      repeatEvent.pollutionAfter,
      expected.eventRepeat.pollutionAfter,
      "law-04 triage repeat pollution after",
    );
    equal(
      repeatEvent.pollutionBefore,
      repeatEvent.pollutionAfter,
      "law-04 triage repeat does not change pollution",
    );
    equal(
      repeatEvent.rejectionCode,
      expected.eventRepeat.rejectionCode,
      "law-04 triage repeat rejection code",
    );
    results.push({
      id: "triage-purification-event",
      status: "PASS",
      eventId: expected.eventSuccess.eventId,
      pollutionBefore: successEvent.pollutionBefore,
      pollutionAfter: successEvent.pollutionAfter,
      repeatIdempotent: true,
    });
  }

  {
    const expected = expectedById.get("purification-opens-route");
    const openGate = obsB.gates.find(
      (gate) => gate.gateId === expected.gateAfterPurification.gateId,
    );
    assert(openGate !== undefined, "law-04 flow-b purification gate was observed");
    equal(
      openGate.status,
      expected.gateAfterPurification.status,
      "law-04 flow-b purification gate status",
    );
    equal(
      openGate.isOpen,
      expected.gateAfterPurification.isOpen,
      "law-04 flow-b purification gate isOpen",
    );
    equal(
      openGate.pollutionWhenChecked,
      expected.gateAfterPurification.pollutionWhenChecked,
      "law-04 flow-b purification gate pollution",
    );
    equal(
      openGate.blockReason,
      expected.gateAfterPurification.blockReason,
      "law-04 flow-b purification gate block reason",
    );
    const trapStep = obsB.steps.find(
      (step) => step.nodeId === expected.trapAfterGate.nodeId && step.kind === "trap-risk",
    );
    assert(trapStep !== undefined, "law-04 flow-b trap after gate was resolved");
    equal(
      trapStep.pollutionAfter,
      expected.trapAfterGate.pollutionAfter,
      "law-04 flow-b trap pollution after",
    );
    equal(trapStep.hpAfter, expected.trapAfterGate.hpAfter, "law-04 flow-b trap hp after");
    equal(obsB.finalPollution, expected.finalPollution, "law-04 flow-b final pollution");
    equal(obsB.finalHp, expected.finalHp, "law-04 flow-b final hp");
    results.push({
      id: "purification-opens-route",
      status: "PASS",
      gateId: expected.gateAfterPurification.gateId,
      openedAtPollution: openGate.pollutionWhenChecked,
    });
  }

  {
    const expected = expectedById.get("repeat-clear-no-pollution");
    assert(obsA.reselect !== undefined, "law-04 reselect boundary was exercised");
    equal(obsA.reselect.nodeId, expected.reselectedNodeId, "law-04 reselect node");
    equal(
      obsA.reselect.rejectionCode,
      expected.rejectionCode,
      "law-04 reselect rejection code",
    );
    equal(
      obsA.reselect.pollutionBefore,
      expected.pollutionBefore,
      "law-04 reselect pollution before",
    );
    equal(
      obsA.reselect.pollutionAfter,
      expected.pollutionAfter,
      "law-04 reselect pollution after",
    );
    equal(
      obsA.reselect.pollutionBefore,
      obsA.reselect.pollutionAfter,
      "law-04 reselect does not change pollution",
    );
    results.push({
      id: "repeat-clear-no-pollution",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: expected.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law05Arena({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-05 arena legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-05 arena legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-05 arena decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const arenaEntryCommand = () => ({
    type: "run/enter",
    dungeonId: "ash_arena",
    protocolId: "standard",
    seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
  });

  let state = decoded.state;
  const observations = {
    initialLaw: undefined,
    steps: [],
    lawSnaps: [],
    gates: [],
    reselect: undefined,
    finalHp: undefined,
  };

  const currentLaw = () => core.getCurrentDungeonLaw(state);
  const snapLaw = () => {
    const law = currentLaw();
    if (!law) throw new AcceptanceAssertionError("law-05 arena law is undefined");
    return {
      display: {
        title: law.display.title,
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: {
        forcePercent: law.modifiers.outgoingDamage.forcePercent,
        artPercent: law.modifiers.outgoingDamage.artPercent,
        guardEffectPercent: law.modifiers.guardEffectPercent,
      },
      combatOpenings: law.state.combatOpenings,
      combatVictoryNodeIds: [...law.state.combatVictoryNodeIds],
    };
  };
  const commit = (command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-05 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    state = result.state;
  };
  const move = (nodeId) => commit({ type: "run/move", nodeId }, `move ${nodeId}`);
  const collect = (nodeId) => {
    commit({ type: "node/collect-reward" }, `collect ${nodeId}`);
    observations.steps.push({ kind: "reward", nodeId, hpAfter: state.player.hp });
  };
  const openingStyleOf = (action) => (action === "attack" ? "force" : action);
  const fightMonster = (nodeId, opening) => {
    commit({ type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(
        `law-05 select ${nodeId} did not enter combat (phase=${state.phase})`,
      );
    }
    commit({ type: "combat/act", action: opening }, `opening ${nodeId}`);
    let rounds = 1;
    while (state.phase === "combat" && rounds < 60) {
      const action = state.player.hp < 80 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      commit({ type: "combat/act", action }, `${action} ${nodeId} round ${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(
        `law-05 ${nodeId} combat did not resolve within 60 rounds`,
      );
    }
    observations.steps.push({
      kind: "combat",
      nodeId,
      opening: openingStyleOf(opening),
      combatRounds: rounds,
      hpAfter: state.player.hp,
    });
  };
  const trapCounter = (nodeId) => {
    const hpBefore = state.player.hp;
    commit({ type: "node/handle-trap", choice: "counter" }, `counter ${nodeId}`);
    observations.steps.push({
      kind: "trap-counter",
      nodeId,
      hpBefore,
      hpAfter: state.player.hp,
    });
  };
  const checkGate = (targetNodeId, recordedAt) => {
    const status = core.getCurrentRouteGateStatus(state, targetNodeId);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-05 route gate to ${targetNodeId} is undefined from ${state.run.currentNodeId}`,
      );
    }
    observations.gates.push({
      gateId: status.gate.id,
      checkedFromNodeId: state.run.currentNodeId,
      targetNodeId,
      recordedAt,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    });
  };
  const snapLawAt = (at) => {
    observations.lawSnaps.push({ at, ...snapLaw() });
  };

  // Enter the arena and capture the initial law state (0/3, no records).
  commit(arenaEntryCommand(), "enter ash_arena");
  observations.initialLaw = snapLaw();

  // Mainline: force, force (repeat), guard, art (rewrite) with route gates.
  collect("arena_gate");
  move("odds_marker");
  collect("odds_marker");

  move("ash_duelist");
  fightMonster("ash_duelist", "attack");
  snapLawAt("after-ash_duelist");
  checkGate("judgement_flame", "after-first-force");

  move("ember_pit_duelist");
  fightMonster("ember_pit_duelist", "attack");
  snapLawAt("after-ember_pit_duelist");
  checkGate("side_bench_supplies", "after-repeat-force");

  // Navigate around the repeat brazier to the guard combat.
  move("ash_duelist");
  move("odds_marker");
  move("arena_gate");
  move("spectator_cache");
  collect("spectator_cache");
  move("ash_purse");
  collect("ash_purse");

  move("cinder_lancer");
  fightMonster("cinder_lancer", "guard");
  snapLawAt("after-cinder_lancer");
  checkGate("oath_cinders", "after-guard");

  move("oath_cinders");
  trapCounter("oath_cinders");
  checkGate("furnace_judge", "before-rewrite");

  // Art victory completes the triad and triggers the rewrite.
  move("cinder_lancer");
  move("ringbreaker_duelist");
  fightMonster("ringbreaker_duelist", "art");
  snapLawAt("after-ringbreaker_duelist");

  // Idempotency boundary: re-selecting the cleared monster node is rejected
  // without changing the law state or HP.
  const lawBeforeReselect = snapLaw();
  const hpBeforeReselect = state.player.hp;
  const reselectResult = application.reduceGameCommand(state, {
    type: "run/select-node",
    nodeId: "ringbreaker_duelist",
  });
  if (reselectResult.status !== "rejected") {
    throw new AcceptanceAssertionError(
      "law-05 re-select of cleared ringbreaker_duelist must be rejected",
    );
  }
  observations.reselect = {
    nodeId: "ringbreaker_duelist",
    rejectionCode: reselectResult.reason.code,
    lawStateUnchanged:
      JSON.stringify(lawBeforeReselect) === JSON.stringify(snapLaw()),
    hpUnchanged: hpBeforeReselect === state.player.hp,
  };

  // The three-style gate is now open.
  move("cinder_lancer");
  move("oath_cinders");
  checkGate("furnace_judge", "after-rewrite");

  observations.finalHp = state.player.hp;

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];
  const snapById = new Map(
    observations.lawSnaps.map((snap) => [snap.at, snap]),
  );

  {
    const expected = expectedById.get("arena-style-records");
    deepEqual(
      {
        title: observations.initialLaw.display.title,
        status: observations.initialLaw.display.status,
        severity: observations.initialLaw.display.severity,
        meter: observations.initialLaw.display.meter,
        targetReached: observations.initialLaw.display.targetReached,
      },
      expected.initialDisplay,
      "law-05 initial law display",
    );
    const combatClears = observations.steps.filter((step) => step.kind === "combat");
    equal(combatClears.length, expected.clears.length, "law-05 combat clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      const actualClear = combatClears[index];
      const expectedClear = expected.clears[index];
      equal(actualClear.nodeId, expectedClear.nodeId, `law-05 clear ${index} node`);
      equal(actualClear.opening, expectedClear.opening, `law-05 clear ${index} opening`);
      equal(
        actualClear.combatRounds,
        expectedClear.combatRounds,
        `law-05 clear ${index} combat rounds`,
      );
      equal(actualClear.hpAfter, expectedClear.hpAfter, `law-05 clear ${index} hp`);
    }
    const finalSnap = snapById.get("after-ringbreaker_duelist");
    assert(finalSnap !== undefined, "law-05 final law snapshot exists");
    deepEqual(
      finalSnap.combatOpenings,
      expected.finalCombatOpenings,
      "law-05 final combat openings",
    );
    deepEqual(
      finalSnap.combatVictoryNodeIds,
      expected.finalVictoryOrder,
      "law-05 final victory order",
    );
    equal(observations.finalHp, expected.finalHp, "law-05 final hp");
    results.push({
      id: "arena-style-records",
      status: "PASS",
      combatCount: combatClears.length,
      victoryOrder: expected.finalVictoryOrder,
      finalHp: observations.finalHp,
    });
  }

  {
    const expected = expectedById.get("arena-repeat-penalty");
    const firstForce = snapById.get("after-ash_duelist");
    const repeatForce = snapById.get("after-ember_pit_duelist");
    const guardBreak = snapById.get("after-cinder_lancer");
    assert(firstForce !== undefined, "law-05 first-force snapshot exists");
    assert(repeatForce !== undefined, "law-05 repeat-force snapshot exists");
    assert(guardBreak !== undefined, "law-05 guard-break snapshot exists");
    for (const [snap, expectedSnap, label] of [
      [firstForce, expected.afterFirstForce, "first-force"],
      [repeatForce, expected.afterRepeatForce, "repeat-force"],
      [guardBreak, expected.afterGuardBreak, "guard-break"],
    ]) {
      equal(snap.display.status, expectedSnap.status, `law-05 ${label} status`);
      equal(snap.display.severity, expectedSnap.severity, `law-05 ${label} severity`);
      deepEqual(snap.display.meter, expectedSnap.meter, `law-05 ${label} meter`);
      equal(
        snap.display.targetReached,
        expectedSnap.targetReached,
        `law-05 ${label} targetReached`,
      );
      equal(
        snap.modifiers.forcePercent,
        expectedSnap.forcePercent,
        `law-05 ${label} forcePercent`,
      );
      equal(
        snap.modifiers.artPercent,
        expectedSnap.artPercent,
        `law-05 ${label} artPercent`,
      );
      equal(
        snap.modifiers.guardEffectPercent,
        expectedSnap.guardEffectPercent,
        `law-05 ${label} guardEffectPercent`,
      );
    }
    assert(
      repeatForce.modifiers.forcePercent < 0,
      "law-05 repeat force penalty is negative",
    );
    assert(
      firstForce.modifiers.forcePercent === 0
        && guardBreak.modifiers.forcePercent === 0,
      "law-05 non-repeat states have no force penalty",
    );
    results.push({
      id: "arena-repeat-penalty",
      status: "PASS",
      repeatedStyle: "force",
      penaltyForcePercent: repeatForce.modifiers.forcePercent,
    });
  }

  {
    const expected = expectedById.get("arena-three-style-rewrite");
    const rewriteSnap = snapById.get("after-ringbreaker_duelist");
    assert(rewriteSnap !== undefined, "law-05 rewrite snapshot exists");
    deepEqual(rewriteSnap.display, expected.display, "law-05 rewrite display");
    deepEqual(rewriteSnap.modifiers, expected.modifiers, "law-05 rewrite modifiers");
    const distribution = { force: 0, art: 0, guard: 0 };
    for (const nodeId of rewriteSnap.combatVictoryNodeIds) {
      const opening = rewriteSnap.combatOpenings[nodeId];
      if (opening && !opening.isBoss && opening.style) {
        distribution[opening.style] += 1;
      }
    }
    deepEqual(distribution, expected.distribution, "law-05 rewrite distribution");
    assert(
      rewriteSnap.modifiers.forcePercent > 0
        && rewriteSnap.modifiers.artPercent > 0
        && rewriteSnap.modifiers.guardEffectPercent > 0,
      "law-05 rewrite bonuses are all positive",
    );
    results.push({
      id: "arena-three-style-rewrite",
      status: "PASS",
      distribution,
      forcePercent: rewriteSnap.modifiers.forcePercent,
      artPercent: rewriteSnap.modifiers.artPercent,
      guardEffectPercent: rewriteSnap.modifiers.guardEffectPercent,
    });
  }

  {
    const expected = expectedById.get("arena-route-gates");
    equal(
      observations.gates.length,
      expected.gates.length,
      "law-05 route gate observation count",
    );
    for (let index = 0; index < expected.gates.length; index += 1) {
      const actualGate = observations.gates[index];
      const expectedGate = expected.gates[index];
      equal(actualGate.gateId, expectedGate.gateId, `law-05 gate ${index} id`);
      equal(
        actualGate.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-05 gate ${index} from-node`,
      );
      equal(
        actualGate.targetNodeId,
        expectedGate.targetNodeId,
        `law-05 gate ${index} target`,
      );
      equal(
        actualGate.recordedAt,
        expectedGate.recordedAt,
        `law-05 gate ${index} recordedAt`,
      );
      equal(actualGate.status, expectedGate.status, `law-05 gate ${index} status`);
      equal(actualGate.isOpen, expectedGate.isOpen, `law-05 gate ${index} isOpen`);
      equal(
        actualGate.blockReason,
        expectedGate.blockReason,
        `law-05 gate ${index} blockReason`,
      );
    }
    results.push({
      id: "arena-route-gates",
      status: "PASS",
      verifiedGates: expected.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("arena-repeat-clear-boundary");
    assert(observations.reselect !== undefined, "law-05 reselect boundary was exercised");
    equal(
      observations.reselect.nodeId,
      expected.reselectedNodeId,
      "law-05 reselect node",
    );
    equal(
      observations.reselect.rejectionCode,
      expected.rejectionCode,
      "law-05 reselect rejection code",
    );
    equal(
      observations.reselect.lawStateUnchanged,
      expected.lawStateUnchanged,
      "law-05 reselect law state unchanged",
    );
    equal(
      observations.reselect.hpUnchanged,
      expected.hpUnchanged,
      "law-05 reselect hp unchanged",
    );
    results.push({
      id: "arena-repeat-clear-boundary",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: observations.reselect.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law06Dream({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-06 dream legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-06 dream legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-06 dream decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const dreamEntryCommand = () => ({
    type: "run/enter",
    dungeonId: "dream_archive",
    protocolId: "standard",
    seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
  });

  function runDreamFlow(label) {
    let state = decoded.state;
    const observations = {
      steps: [],
      fights: [],
      gates: [],
      displays: [],
      blocked: [],
      events: [],
      final: undefined,
    };
    const currentLaw = () => core.getCurrentDungeonLaw(state);
    const seals = () => currentLaw().state.law.sealedFeatures;
    const commit = (command, step) => {
      const result = application.reduceGameCommand(state, command);
      if (result.status !== "committed") {
        throw new AcceptanceAssertionError(
          `${label} ${step}: ${result.reason.code} ${result.reason.message}`,
        );
      }
      state = result.state;
    };
    const move = (nodeId) => commit({ type: "run/move", nodeId }, `move ${nodeId}`);
    const collect = (nodeId) => {
      commit({ type: "node/collect-reward" }, `collect ${nodeId}`);
      observations.steps.push({ kind: "reward", nodeId, sealsAfter: seals() });
    };
    const handleTrapRisk = (nodeId) => {
      const hpBefore = state.player.hp;
      const sealsBefore = seals();
      commit({ type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
      observations.steps.push({
        kind: "trap-risk",
        nodeId,
        hpBefore,
        hpAfter: state.player.hp,
        sealsBefore,
        sealsAfter: seals(),
      });
    };
    const fight = (nodeId, options = {}) => {
      const sealsBefore = seals();
      const hpBefore = state.player.hp;
      commit({ type: "run/select-node", nodeId }, `select ${nodeId}`);
      if (state.phase !== "combat") {
        throw new AcceptanceAssertionError(
          `law-06 select ${nodeId} did not enter combat (phase=${state.phase})`,
        );
      }
      let rounds = 0;
      let pillUsed = false;
      let pillHeal = null;
      let pillBlocked = false;
      let artUsed = false;
      let artBlocked = false;
      let petAssist = false;
      while (state.phase === "combat" && rounds < 60) {
        if (state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
          petAssist = true;
        }
        let action = "attack";
        if (
          options.pillOnce === true
          && !pillUsed
          && !pillBlocked
          && state.player.hp < state.player.maxHp - 10
        ) {
          action = "use_healing_pill";
        } else if (options.artOnce === true && !artUsed && !artBlocked) {
          action = "art";
        }
        const result = application.reduceGameCommand(state, { type: "combat/act", action });
        if (result.status !== "committed") {
          if (
            action === "use_healing_pill"
            && typeof result.reason.message === "string"
            && result.reason.message.includes("封存消耗品")
          ) {
            pillBlocked = true;
            continue;
          }
          if (
            action === "art"
            && typeof result.reason.message === "string"
            && result.reason.message.includes("封存功法")
          ) {
            artBlocked = true;
            continue;
          }
          throw new AcceptanceAssertionError(
            `${label} combat ${nodeId} round ${rounds} action ${action}: ${result.reason.code} ${result.reason.message}`,
          );
        }
        state = result.state;
        if (action === "use_healing_pill") {
          pillUsed = true;
          const healLog = state.combat?.log?.find((line) => line.includes("生命回复"));
          const match = healLog && /生命回复 (\d+) 点/.exec(healLog);
          pillHeal = match ? Number(match[1]) : null;
        }
        if (action === "art") artUsed = true;
        rounds += 1;
      }
      if (state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
        petAssist = true;
      }
      if (state.phase !== "explore") {
        throw new AcceptanceAssertionError(
          `law-06 ${nodeId} combat did not resolve within 60 rounds`,
        );
      }
      observations.fights.push({
        nodeId,
        sealsBefore,
        sealsAfter: seals(),
        combatRounds: rounds,
        hpBefore,
        hpAfter: state.player.hp,
        petAssist,
        pillUsed,
        pillHeal,
        pillBlocked,
        artUsed,
        artBlocked,
      });
    };
    const blockedCombatAction = (nodeId, action) => {
      const hpBefore = state.player.hp;
      const turnBefore = state.combat?.turn;
      const monsterHpBefore = state.combat?.monsterHp;
      const sealsBefore = seals();
      const result = application.reduceGameCommand(state, { type: "combat/act", action });
      if (result.status !== "rejected") {
        throw new AcceptanceAssertionError(
          `${label} blocked combat action ${action} at ${nodeId} must be rejected`,
        );
      }
      observations.blocked.push({
        nodeId,
        action,
        status: result.status,
        rejectionCode: result.reason.code,
        message: result.reason.message,
        hpUnchanged: state.player.hp === hpBefore,
        turnUnchanged: state.combat?.turn === turnBefore,
        monsterHpUnchanged: state.combat?.monsterHp === monsterHpBefore,
        sealsUnchanged: JSON.stringify(seals()) === JSON.stringify(sealsBefore),
      });
    };
    const checkGate = (targetNodeId, at) => {
      const status = core.getCurrentRouteGateStatus(state, targetNodeId);
      if (status === undefined) {
        throw new AcceptanceAssertionError(
          `${label} route gate to ${targetNodeId} is undefined from ${state.run.currentNodeId}`,
        );
      }
      observations.gates.push({
        at,
        gateId: status.gate.id,
        checkedFromNodeId: state.run.currentNodeId,
        targetNodeId,
        status: status.status,
        isOpen: status.isOpen,
        blockReason: status.blockReason ?? null,
      });
    };
    const snapDisplay = (at) => {
      const law = currentLaw();
      observations.displays.push({
        at,
        title: law.display.title,
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
        seals: seals(),
      });
    };
    const forfeitEliteLoot = (step) => {
      if (!state.run?.pendingEquipmentOffer) return;
      commit({ type: "node/resolve-equipment-loot" }, step);
    };
    const finish = () => {
      observations.final = {
        seals: seals(),
        clearedNodeIds: [...currentLaw().state.clearedNodeIds],
        hp: state.player.hp,
      };
    };
    return {
      get state() {
        return state;
      },
      set state(value) {
        state = value;
      },
      observations,
      seals,
      commit,
      move,
      collect,
      handleTrapRisk,
      fight,
      blockedCombatAction,
      checkGate,
      snapDisplay,
      forfeitEliteLoot,
      finish,
    };
  }

  // Flow A walks the sealing ladder: consumable -> method -> pet, verifies each
  // feature's visible effect while sealed, resets at the cracked-core index node,
  // then proves recovery and re-sealing in a fresh fight.
  const flowA = runDreamFlow("flow-a");
  flowA.commit(dreamEntryCommand(), "enter dream_archive");
  flowA.snapDisplay("entry");
  flowA.collect("index_reward");
  flowA.move("failed_file_reward");
  flowA.collect("failed_file_reward");
  flowA.checkGate("paper_librarian", "failed_file_reward-open");
  flowA.move("paper_librarian");
  flowA.fight("paper_librarian");
  flowA.snapDisplay("after-paper_librarian");
  flowA.move("failed_file_reward");
  flowA.checkGate("paper_librarian", "failed_file_reward-closed");
  flowA.move("hallucination_patrol");
  flowA.commit({ type: "run/select-node", nodeId: "hallucination_patrol" }, "select hallucination_patrol");
  flowA.blockedCombatAction("hallucination_patrol", "use_healing_pill");
  {
    let rounds = 0;
    let petAssist = false;
    while (flowA.state.phase === "combat" && rounds < 60) {
      if (flowA.state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
        petAssist = true;
      }
      flowA.commit({ type: "combat/act", action: "attack" }, `attack hallucination_patrol round ${rounds}`);
      rounds += 1;
    }
    if (flowA.state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
      petAssist = true;
    }
    if (flowA.state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-06 hallucination_patrol combat did not resolve");
    }
    const blocked = flowA.observations.blocked.find(
      (entry) => entry.nodeId === "hallucination_patrol" && entry.action === "use_healing_pill",
    );
    flowA.observations.fights.push({
      nodeId: "hallucination_patrol",
      sealsBefore: ["consumable"],
      sealsAfter: flowA.seals(),
      combatRounds: rounds,
      hpAfter: flowA.state.player.hp,
      petAssist,
      pillBlocked: true,
      pillBlockedObserved: blocked !== undefined,
    });
  }
  flowA.snapDisplay("after-hallucination_patrol");
  flowA.move("footnote_cache_reward");
  flowA.collect("footnote_cache_reward");
  flowA.move("paper_librarian_echo");
  flowA.checkGate("ink_sleep_trap", "paper_librarian_echo-closed");
  flowA.commit({ type: "run/select-node", nodeId: "paper_librarian_echo" }, "select paper_librarian_echo");
  flowA.blockedCombatAction("paper_librarian_echo", "art");
  {
    let rounds = 0;
    let petAssist = false;
    while (flowA.state.phase === "combat" && rounds < 60) {
      if (flowA.state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
        petAssist = true;
      }
      flowA.commit({ type: "combat/act", action: "attack" }, `attack paper_librarian_echo round ${rounds}`);
      rounds += 1;
    }
    if (flowA.state.combat?.log?.some((line) => line.includes("助战灵宠"))) {
      petAssist = true;
    }
    if (flowA.state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-06 paper_librarian_echo combat did not resolve");
    }
    flowA.observations.fights.push({
      nodeId: "paper_librarian_echo",
      sealsBefore: ["consumable", "method"],
      sealsAfter: flowA.seals(),
      combatRounds: rounds,
      hpAfter: flowA.state.player.hp,
      petAssist,
      artBlocked: true,
    });
  }
  flowA.snapDisplay("after-paper_librarian_echo");
  flowA.checkGate("ink_sleep_trap", "paper_librarian_echo-still-closed");
  // With all three features sealed, handle memory_loop_trap (a dangerous clear that
  // must not add a fourth seal) to reach dream_jailer and the sealed pet gate.
  flowA.move("memory_loop_trap");
  flowA.handleTrapRisk("memory_loop_trap");
  flowA.move("blank_shelf_reward");
  flowA.move("dream_jailer");
  flowA.fight("dream_jailer");
  flowA.forfeitEliteLoot("forfeit dream_jailer elite loot");
  flowA.move("method_fragment_reward");
  flowA.checkGate("archive_portal", "method_fragment_reward-closed");
  flowA.move("dream_jailer");
  flowA.move("blank_shelf_reward");
  flowA.move("memory_loop_trap");
  flowA.move("paper_librarian_echo");
  flowA.move("incense_reward");
  flowA.collect("incense_reward");
  flowA.move("hallucination_patrol_two");
  flowA.fight("hallucination_patrol_two");
  flowA.snapDisplay("after-hallucination_patrol_two");
  flowA.move("cracked_core_index_reward");
  flowA.collect("cracked_core_index_reward");
  flowA.snapDisplay("after-index-reset");
  // Recovery fight after the index reset: pill, art, and pet assist all work again,
  // and the first dangerous clear re-seals consumables.
  flowA.move("afterimage_bookmark_reward");
  flowA.move("void_map_reward");
  flowA.move("dream_jailer_second");
  flowA.fight("dream_jailer_second", { pillOnce: true, artOnce: true });
  flowA.forfeitEliteLoot("forfeit dream_jailer_second elite loot");
  flowA.snapDisplay("after-dream_jailer_second-reseal");
  flowA.finish();
  const obsA = flowA.observations;

  // Flow B re-enters from the same migrated hub state to cover the failure_index
  // event reset and the repeat/reselect idempotency boundaries.
  const flowB = runDreamFlow("flow-b");
  flowB.commit(dreamEntryCommand(), "enter dream_archive");
  flowB.collect("index_reward");
  {
    const availableEvents = core.getAvailableDungeonEvents(flowB.state);
    const failureIndex = availableEvents.find((event) => event.id === "failure_index");
    if (failureIndex === undefined) {
      throw new AcceptanceAssertionError("law-06 failure_index event is unavailable at index_reward");
    }
    flowB.observations.events.push({
      phase: "pre-fight",
      eventId: failureIndex.id,
      nodeId: failureIndex.nodeId,
      options: failureIndex.options.map((option) => ({
        optionId: option.id,
        available: option.available,
        unmet: option.unmetRequirements.map((requirement) => requirement.description),
      })),
    });
  }
  flowB.move("failed_file_reward");
  flowB.collect("failed_file_reward");
  flowB.move("paper_librarian");
  flowB.fight("paper_librarian");
  flowB.move("failed_file_reward");
  flowB.move("index_reward");
  {
    const rpBefore = flowB.state.rewardPoints;
    const methodPageBefore = flowB.state.inventory.method_page;
    const sealsBefore = flowB.seals();
    flowB.commit(
      { type: "node/resolve-event", eventId: "failure_index", optionId: "decode_with_spirit" },
      "resolve failure_index",
    );
    flowB.observations.events.push({
      phase: "resolve",
      eventId: "failure_index",
      optionId: "decode_with_spirit",
      sealsBefore,
      sealsAfter: flowB.seals(),
      rewardPointsDelta: flowB.state.rewardPoints - rpBefore,
      methodPageDelta: flowB.state.inventory.method_page - methodPageBefore,
      log: flowB.state.log[0],
    });
  }
  {
    const sealsBefore = flowB.seals();
    const repeat = application.reduceGameCommand(flowB.state, {
      type: "node/resolve-event",
      eventId: "failure_index",
      optionId: "decode_with_spirit",
    });
    if (repeat.status !== "rejected") {
      throw new AcceptanceAssertionError("law-06 repeat failure_index resolution must be rejected");
    }
    flowB.observations.blocked.push({
      kind: "repeat-event",
      status: repeat.status,
      rejectionCode: repeat.reason.code,
      message: repeat.reason.message,
      sealsUnchanged: JSON.stringify(flowB.seals()) === JSON.stringify(sealsBefore),
    });
  }
  flowB.move("failed_file_reward");
  flowB.move("paper_librarian");
  {
    const sealsBefore = flowB.seals();
    const reselect = application.reduceGameCommand(flowB.state, {
      type: "run/select-node",
      nodeId: "paper_librarian",
    });
    if (reselect.status !== "rejected") {
      throw new AcceptanceAssertionError("law-06 re-select of cleared paper_librarian must be rejected");
    }
    flowB.observations.blocked.push({
      kind: "reselect-cleared",
      nodeId: "paper_librarian",
      status: reselect.status,
      rejectionCode: reselect.reason.code,
      message: reselect.reason.message,
      sealsUnchanged: JSON.stringify(flowB.seals()) === JSON.stringify(sealsBefore),
    });
  }
  flowB.observations.final = {
    seals: flowB.seals(),
    hp: flowB.state.player.hp,
    resolvedEventIds: [...flowB.state.run.resolvedEventIds],
  };
  const obsB = flowB.observations;

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("archive-seal-on-dangerous-clear");
    const initialDisplay = obsA.displays[0];
    deepEqual(
      {
        title: initialDisplay.title,
        status: initialDisplay.status,
        severity: initialDisplay.severity,
        meter: initialDisplay.meter,
        targetReached: initialDisplay.targetReached,
      },
      expected.initialDisplay,
      "law-06 initial law display",
    );
    const clearSteps = obsA.steps;
    const expectedClears = expected.clears.filter((clear) => clear.kind !== "combat");
    const actualNonCombatClears = clearSteps.filter((step) => step.kind !== "combat");
    equal(actualNonCombatClears.length, expectedClears.length, "law-06 non-combat clear count");
    for (let index = 0; index < expectedClears.length; index += 1) {
      const actualClear = actualNonCombatClears[index];
      const expectedClear = expectedClears[index];
      equal(actualClear.nodeId, expectedClear.nodeId, `law-06 non-combat clear ${index} node`);
      equal(actualClear.kind, expectedClear.kind, `law-06 non-combat clear ${index} kind`);
      deepEqual(actualClear.sealsAfter, expectedClear.sealsAfter, `law-06 non-combat clear ${index} seals`);
      if (expectedClear.hpAfter !== undefined) {
        equal(actualClear.hpAfter, expectedClear.hpAfter, `law-06 non-combat clear ${index} hp`);
      }
    }
    const expectedCombatClears = expected.clears.filter((clear) => clear.kind === "combat");
    const actualCombatClears = obsA.fights;
    equal(actualCombatClears.length, expectedCombatClears.length, "law-06 combat clear count");
    for (let index = 0; index < expectedCombatClears.length; index += 1) {
      const actualFight = actualCombatClears[index];
      const expectedClear = expectedCombatClears[index];
      equal(actualFight.nodeId, expectedClear.nodeId, `law-06 combat clear ${index} node`);
      deepEqual(actualFight.sealsAfter, expectedClear.sealsAfter, `law-06 combat clear ${index} seals`);
      equal(
        actualFight.combatRounds,
        expectedClear.combatRounds,
        `law-06 combat clear ${index} rounds`,
      );
      equal(actualFight.hpAfter, expectedClear.hpAfter, `law-06 combat clear ${index} hp`);
    }
    const displaySequence = obsA.displays.filter((display) =>
      expected.displaySequence.some((entry) => entry.at === display.at),
    );
    equal(
      displaySequence.length,
      expected.displaySequence.length,
      "law-06 display sequence count",
    );
    for (let index = 0; index < expected.displaySequence.length; index += 1) {
      const actualDisplay = displaySequence[index];
      const expectedDisplay = expected.displaySequence[index];
      equal(actualDisplay.at, expectedDisplay.at, `law-06 display ${index} at`);
      equal(actualDisplay.status, expectedDisplay.status, `law-06 display ${index} status`);
      equal(actualDisplay.severity, expectedDisplay.severity, `law-06 display ${index} severity`);
      deepEqual(actualDisplay.meter, expectedDisplay.meter, `law-06 display ${index} meter`);
      equal(
        actualDisplay.targetReached,
        expectedDisplay.targetReached,
        `law-06 display ${index} targetReached`,
      );
      deepEqual(actualDisplay.seals, expectedDisplay.seals, `law-06 display ${index} seals`);
    }
    deepEqual(obsA.final.clearedNodeIds, expected.finalClearedNodeIds, "law-06 final cleared order");
    deepEqual(obsA.final.seals, expected.finalSeals, "law-06 final seals");
    equal(obsA.final.hp, expected.finalHp, "law-06 final hp");
    // The first three dangerous clears advance the seal ladder in the fixed order;
    // saturated clears (all three features sealed) and the post-reset recovery fight
    // are asserted separately below.
    const ladderFights = ["paper_librarian", "hallucination_patrol", "paper_librarian_echo"];
    for (let index = 0; index < ladderFights.length; index += 1) {
      const fight = actualCombatClears.find((entry) => entry.nodeId === ladderFights[index]);
      assert(fight !== undefined, `law-06 ladder fight ${ladderFights[index]} exists`);
      equal(
        fight.sealsAfter.length,
        index + 1,
        `law-06 ladder fight ${ladderFights[index]} advances the seal ladder`,
      );
    }
    const saturatedClears = obsA.fights
      .concat(obsA.steps.filter((step) => step.kind === "trap-risk"))
      .filter((clear) =>
        Array.isArray(clear.sealsBefore)
        && clear.sealsBefore.length === 3
        && JSON.stringify(clear.sealsAfter) === JSON.stringify(["consumable", "method", "pet"]),
      );
    assert(saturatedClears.length >= 2, "law-06 saturated clears do not add a fourth seal");
    const recoveryFight = actualCombatClears.find(
      (fight) => fight.nodeId === "dream_jailer_second",
    );
    assert(recoveryFight !== undefined, "law-06 post-reset recovery fight exists");
    deepEqual(recoveryFight.sealsBefore, [], "law-06 recovery fight starts from a reset ladder");
    deepEqual(
      recoveryFight.sealsAfter,
      ["consumable"],
      "law-06 recovery fight re-arms the seal ladder from the top",
    );
    results.push({
      id: "archive-seal-on-dangerous-clear",
      status: "PASS",
      sealSequence: expected.clears
        .filter((clear) => clear.kind === "combat" || clear.kind === "trap-risk")
        .map((clear) => clear.sealsAfter),
      finalSeals: obsA.final.seals,
      finalHp: obsA.final.hp,
    });
  }

  {
    const expected = expectedById.get("archive-consumable-seal-effect");
    const openGate = obsA.gates.find((gate) => gate.at === "failed_file_reward-open");
    const closedGate = obsA.gates.find((gate) => gate.at === "failed_file_reward-closed");
    assert(openGate !== undefined, "law-06 consumable gate observed open");
    assert(closedGate !== undefined, "law-06 consumable gate observed closed");
    for (const [actualGate, expectedGate, label] of [
      [openGate, expected.gateBeforeSeal, "open"],
      [closedGate, expected.gateAfterSeal, "closed"],
    ]) {
      equal(actualGate.gateId, expectedGate.gateId, `law-06 consumable gate ${label} id`);
      equal(
        actualGate.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-06 consumable gate ${label} from-node`,
      );
      equal(
        actualGate.targetNodeId,
        expectedGate.targetNodeId,
        `law-06 consumable gate ${label} target`,
      );
      equal(actualGate.status, expectedGate.status, `law-06 consumable gate ${label} status`);
      equal(actualGate.isOpen, expectedGate.isOpen, `law-06 consumable gate ${label} isOpen`);
      equal(
        actualGate.blockReason,
        expectedGate.blockReason,
        `law-06 consumable gate ${label} blockReason`,
      );
    }
    const blockedPill = obsA.blocked.find(
      (entry) => entry.action === "use_healing_pill" && entry.nodeId === "hallucination_patrol",
    );
    assert(blockedPill !== undefined, "law-06 blocked pill observation exists");
    equal(blockedPill.rejectionCode, expected.blockedCombatAction.rejectionCode, "law-06 pill rejection code");
    equal(blockedPill.message, expected.blockedCombatAction.message, "law-06 pill rejection message");
    equal(blockedPill.hpUnchanged, expected.blockedCombatAction.hpUnchanged, "law-06 pill hp unchanged");
    equal(blockedPill.turnUnchanged, expected.blockedCombatAction.turnUnchanged, "law-06 pill turn unchanged");
    equal(
      blockedPill.monsterHpUnchanged,
      expected.blockedCombatAction.monsterHpUnchanged,
      "law-06 pill monster hp unchanged",
    );
    equal(
      blockedPill.sealsUnchanged,
      expected.blockedCombatAction.sealsUnchanged,
      "law-06 pill seals unchanged",
    );
    const recoveryFight = obsA.fights.find(
      (fight) => fight.nodeId === expected.recovery.nodeId,
    );
    assert(recoveryFight !== undefined, "law-06 consumable recovery fight exists");
    equal(recoveryFight.pillUsed, expected.recovery.pillUsed, "law-06 recovery pill used");
    equal(recoveryFight.pillHeal, expected.recovery.pillHeal, "law-06 recovery pill heal");
    equal(recoveryFight.pillBlocked, expected.recovery.pillBlocked, "law-06 recovery pill not blocked");
    results.push({
      id: "archive-consumable-seal-effect",
      status: "PASS",
      sealedGate: closedGate.status,
      blockedAction: blockedPill.action,
      recoveryPillHeal: recoveryFight.pillHeal,
    });
  }

  {
    const expected = expectedById.get("archive-method-seal-effect");
    const closedGate = obsA.gates.find((gate) => gate.at === "paper_librarian_echo-closed");
    const stillClosedGate = obsA.gates.find(
      (gate) => gate.at === "paper_librarian_echo-still-closed",
    );
    assert(closedGate !== undefined, "law-06 method gate observed closed");
    assert(stillClosedGate !== undefined, "law-06 method gate observed still closed");
    for (const [actualGate, expectedGate, label] of [
      [closedGate, expected.gateAfterSeal, "closed"],
      [stillClosedGate, expected.gateStillClosedAfterThirdSeal, "still-closed"],
    ]) {
      equal(actualGate.gateId, expectedGate.gateId, `law-06 method gate ${label} id`);
      equal(
        actualGate.checkedFromNodeId,
        expectedGate.checkedFromNodeId,
        `law-06 method gate ${label} from-node`,
      );
      equal(
        actualGate.targetNodeId,
        expectedGate.targetNodeId,
        `law-06 method gate ${label} target`,
      );
      equal(actualGate.status, expectedGate.status, `law-06 method gate ${label} status`);
      equal(actualGate.isOpen, expectedGate.isOpen, `law-06 method gate ${label} isOpen`);
      equal(
        actualGate.blockReason,
        expectedGate.blockReason,
        `law-06 method gate ${label} blockReason`,
      );
    }
    const blockedArt = obsA.blocked.find(
      (entry) => entry.action === "art" && entry.nodeId === "paper_librarian_echo",
    );
    assert(blockedArt !== undefined, "law-06 blocked art observation exists");
    equal(blockedArt.rejectionCode, expected.blockedCombatAction.rejectionCode, "law-06 art rejection code");
    equal(blockedArt.message, expected.blockedCombatAction.message, "law-06 art rejection message");
    equal(blockedArt.hpUnchanged, expected.blockedCombatAction.hpUnchanged, "law-06 art hp unchanged");
    equal(blockedArt.turnUnchanged, expected.blockedCombatAction.turnUnchanged, "law-06 art turn unchanged");
    equal(
      blockedArt.monsterHpUnchanged,
      expected.blockedCombatAction.monsterHpUnchanged,
      "law-06 art monster hp unchanged",
    );
    equal(
      blockedArt.sealsUnchanged,
      expected.blockedCombatAction.sealsUnchanged,
      "law-06 art seals unchanged",
    );
    const recoveryFight = obsA.fights.find(
      (fight) => fight.nodeId === expected.recovery.nodeId,
    );
    assert(recoveryFight !== undefined, "law-06 method recovery fight exists");
    equal(recoveryFight.artUsed, expected.recovery.artUsed, "law-06 recovery art used");
    equal(recoveryFight.artBlocked, expected.recovery.artBlocked, "law-06 recovery art not blocked");
    results.push({
      id: "archive-method-seal-effect",
      status: "PASS",
      sealedGate: closedGate.status,
      blockedAction: blockedArt.action,
      recoveryArtUsed: recoveryFight.artUsed,
    });
  }

  {
    const expected = expectedById.get("archive-pet-seal-effect");
    for (const expectedFight of expected.assistBeforeSeal.fights) {
      const fight = obsA.fights.find((entry) => entry.nodeId === expectedFight.nodeId);
      assert(fight !== undefined, `law-06 pre-seal fight ${expectedFight.nodeId} exists`);
      equal(
        fight.petAssist,
        expectedFight.petAssist,
        `law-06 pre-seal fight ${expectedFight.nodeId} pet assist`,
      );
    }
    for (const expectedFight of expected.assistWhileSealed.fights) {
      const fight = obsA.fights.find((entry) => entry.nodeId === expectedFight.nodeId);
      assert(fight !== undefined, `law-06 sealed fight ${expectedFight.nodeId} exists`);
      equal(
        fight.petAssist,
        expectedFight.petAssist,
        `law-06 sealed fight ${expectedFight.nodeId} pet assist`,
      );
    }
    const closedGate = obsA.gates.find((gate) => gate.at === "method_fragment_reward-closed");
    assert(closedGate !== undefined, "law-06 pet gate observed closed");
    equal(closedGate.gateId, expected.gateAfterSeal.gateId, "law-06 pet gate id");
    equal(
      closedGate.checkedFromNodeId,
      expected.gateAfterSeal.checkedFromNodeId,
      "law-06 pet gate from-node",
    );
    equal(closedGate.targetNodeId, expected.gateAfterSeal.targetNodeId, "law-06 pet gate target");
    equal(closedGate.status, expected.gateAfterSeal.status, "law-06 pet gate status");
    equal(closedGate.isOpen, expected.gateAfterSeal.isOpen, "law-06 pet gate isOpen");
    equal(closedGate.blockReason, expected.gateAfterSeal.blockReason, "law-06 pet gate blockReason");
    const recoveryFight = obsA.fights.find(
      (fight) => fight.nodeId === expected.recovery.nodeId,
    );
    assert(recoveryFight !== undefined, "law-06 pet recovery fight exists");
    equal(recoveryFight.petAssist, expected.recovery.petAssist, "law-06 recovery pet assist");
    results.push({
      id: "archive-pet-seal-effect",
      status: "PASS",
      sealedFightsWithoutAssist: expected.assistWhileSealed.fights.map((fight) => fight.nodeId),
      sealedGate: closedGate.status,
      recoveryPetAssist: recoveryFight.petAssist,
    });
  }

  {
    const expected = expectedById.get("archive-index-event-reset");
    const availableEvent = obsB.events.find((event) => event.phase === "pre-fight");
    assert(availableEvent !== undefined, "law-06 event availability observation exists");
    equal(availableEvent.eventId, expected.eventAvailable.eventId, "law-06 event id");
    equal(availableEvent.nodeId, expected.eventAvailable.nodeId, "law-06 event node");
    const spiritOption = availableEvent.options.find(
      (option) => option.optionId === expected.eventAvailable.spiritOption.optionId,
    );
    assert(spiritOption !== undefined, "law-06 spirit event option exists");
    equal(
      spiritOption.available,
      expected.eventAvailable.spiritOption.available,
      "law-06 spirit option availability",
    );
    const voidHeartOption = availableEvent.options.find(
      (option) => option.optionId === expected.eventAvailable.voidHeartOption.optionId,
    );
    assert(voidHeartOption !== undefined, "law-06 void-heart event option exists");
    equal(
      voidHeartOption.available,
      expected.eventAvailable.voidHeartOption.available,
      "law-06 void-heart option availability",
    );
    assert(
      voidHeartOption.unmet.includes(expected.eventAvailable.voidHeartOption.unmet),
      "law-06 void-heart option unmet requirement",
    );
    const fight = obsB.fights.find((entry) => entry.nodeId === expected.fightBeforeEvent.nodeId);
    assert(fight !== undefined, "law-06 flow-b fight exists");
    deepEqual(fight.sealsAfter, expected.fightBeforeEvent.sealsAfter, "law-06 flow-b fight seals");
    equal(fight.combatRounds, expected.fightBeforeEvent.combatRounds, "law-06 flow-b fight rounds");
    equal(fight.hpAfter, expected.fightBeforeEvent.hpAfter, "law-06 flow-b fight hp");
    const eventReset = obsB.events.find((event) => event.phase === "resolve");
    assert(eventReset !== undefined, "law-06 event reset observation exists");
    equal(eventReset.eventId, expected.eventReset.eventId, "law-06 event reset id");
    equal(eventReset.optionId, expected.eventReset.optionId, "law-06 event reset option");
    deepEqual(eventReset.sealsBefore, expected.eventReset.sealsBefore, "law-06 event reset seals before");
    deepEqual(eventReset.sealsAfter, expected.eventReset.sealsAfter, "law-06 event reset seals after");
    equal(
      eventReset.rewardPointsDelta,
      expected.eventReset.rewardPointsDelta,
      "law-06 event reset reward points",
    );
    equal(
      eventReset.methodPageDelta,
      expected.eventReset.methodPageDelta,
      "law-06 event reset method pages",
    );
    equal(eventReset.log, expected.eventReset.log, "law-06 event reset log");
    const repeatEvent = obsB.blocked.find((entry) => entry.kind === "repeat-event");
    assert(repeatEvent !== undefined, "law-06 repeat event observation exists");
    equal(
      repeatEvent.rejectionCode,
      expected.repeatEvent.rejectionCode,
      "law-06 repeat event rejection code",
    );
    equal(repeatEvent.message, expected.repeatEvent.message, "law-06 repeat event message");
    equal(
      repeatEvent.sealsUnchanged,
      expected.repeatEvent.sealsUnchanged,
      "law-06 repeat event seals unchanged",
    );
    deepEqual(obsB.final.seals, expected.finalSeals, "law-06 flow-b final seals");
    deepEqual(obsB.final.resolvedEventIds, expected.resolvedEventIds, "law-06 flow-b resolved events");
    results.push({
      id: "archive-index-event-reset",
      status: "PASS",
      eventId: eventReset.eventId,
      sealsBefore: eventReset.sealsBefore,
      sealsAfter: eventReset.sealsAfter,
      repeatRejectionCode: repeatEvent.rejectionCode,
    });
  }

  {
    const expected = expectedById.get("archive-repeat-clear-boundary");
    const reselect = obsB.blocked.find((entry) => entry.kind === "reselect-cleared");
    assert(reselect !== undefined, "law-06 reselect boundary observation exists");
    equal(reselect.nodeId, expected.reselectedNodeId, "law-06 reselect node");
    equal(reselect.rejectionCode, expected.rejectionCode, "law-06 reselect rejection code");
    equal(reselect.message, expected.message, "law-06 reselect message");
    equal(reselect.sealsUnchanged, expected.sealsUnchanged, "law-06 reselect seals unchanged");
    deepEqual(obsB.final.seals, expected.sealsAfter, "law-06 reselect seals after");
    results.push({
      id: "archive-repeat-clear-boundary",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: reselect.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law07Virtual({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-07 virtual legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-07 virtual legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-07 virtual decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  // All three flows walk the identical node path so that pursuit, protocol and
  // boss scaling are the same; only the combat opening styles differ.
  const CITADEL_PATH = Object.freeze([
    { kind: "collect", node: "gate_oath_cache" },
    { kind: "fight", node: "void_knight" },
    { kind: "gate", target: "identity_trap" },
    { kind: "trap-counter", node: "identity_trap" },
    { kind: "move", node: "echo_portal" },
    { kind: "fight", node: "echo_gate_guard" },
    { kind: "gate", target: "echo_loop_trap" },
    { kind: "move", node: "echo_portal" },
    { kind: "move", node: "identity_trap" },
    { kind: "move", node: "void_knight" },
    { kind: "move", node: "gate_oath_cache" },
    { kind: "move", node: "citadel_gate" },
    { kind: "collect", node: "identity_trial_reward" },
    { kind: "fight", node: "first_echo_patrol" },
    { kind: "gate", target: "growth_mirror_trap" },
    { kind: "trap-risk", node: "broken_name_trap" },
  ]);

  const openingDistributionFromRecords = (lawState) => {
    const distribution = { force: 0, art: 0, guard: 0 };
    for (const nodeId of lawState.combatVictoryNodeIds) {
      const opening = lawState.combatOpenings[nodeId];
      if (opening && !opening.isBoss && opening.style) {
        distribution[opening.style] += 1;
      }
    }
    return distribution;
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-07 virtual law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
      distribution: openingDistributionFromRecords(law.state),
      combatOpenings: law.state.combatOpenings,
      combatVictoryNodeIds: [...law.state.combatVictoryNodeIds],
    };
  };

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-07 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };

  const runCitadelFlow = (label, openings) => {
    let state = hubState;
    state = commit(
      state,
      {
        type: "run/enter",
        dungeonId: "void_citadel",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      `${label} enter void_citadel`,
    );
    const observations = {
      entryDisplay: undefined,
      fights: [],
      gates: [],
      traps: [],
      boss: undefined,
      reselect: undefined,
    };
    observations.entryDisplay = lawCapture(state).display;

    let fightIndex = 0;
    for (const step of CITADEL_PATH) {
      if (step.kind === "move") {
        state = commit(state, { type: "run/move", nodeId: step.node }, `${label} move ${step.node}`);
      } else if (step.kind === "collect") {
        state = commit(state, { type: "run/move", nodeId: step.node }, `${label} move ${step.node}`);
        state = commit(state, { type: "node/collect-reward" }, `${label} collect ${step.node}`);
      } else if (step.kind === "fight") {
        const opening = openings[fightIndex];
        fightIndex += 1;
        state = commit(state, { type: "run/move", nodeId: step.node }, `${label} move ${step.node}`);
        state = commit(state, { type: "run/select-node", nodeId: step.node }, `${label} select ${step.node}`);
        if (state.phase !== "combat") {
          throw new AcceptanceAssertionError(
            `law-07 ${label} select ${step.node} did not enter combat`,
          );
        }
        state = commit(state, { type: "combat/act", action: opening }, `${label} opening ${step.node}`);
        let rounds = 1;
        while (state.phase === "combat" && rounds < 80) {
          const action = state.player.hp < 70 && state.inventory.healing_pill > 0
            ? "use_healing_pill"
            : "attack";
          state = commit(state, { type: "combat/act", action }, `${label} ${action} ${step.node} r${rounds}`);
          rounds += 1;
        }
        if (state.phase !== "explore") {
          throw new AcceptanceAssertionError(
            `law-07 ${label} combat ${step.node} did not resolve within 80 rounds`,
          );
        }
        const after = lawCapture(state);
        observations.fights.push({
          node: step.node,
          opening,
          combatRounds: rounds,
          hpAfter: state.player.hp,
          distribution: after.distribution,
          statusAfter: after.display.status,
        });
      } else if (step.kind === "trap-risk") {
        state = commit(state, { type: "run/move", nodeId: step.node }, `${label} move ${step.node}`);
        const hpBefore = state.player.hp;
        state = commit(state, { type: "node/handle-trap", choice: "risk" }, `${label} trap ${step.node}`);
        observations.traps.push({ node: step.node, choice: "risk", hpBefore, hpAfter: state.player.hp });
      } else if (step.kind === "trap-counter") {
        state = commit(state, { type: "run/move", nodeId: step.node }, `${label} move ${step.node}`);
        state = commit(state, { type: "node/handle-trap", choice: "counter" }, `${label} trap ${step.node}`);
        observations.traps.push({ node: step.node, choice: "counter", hpAfter: state.player.hp });
      } else if (step.kind === "gate") {
        const status = core.getCurrentRouteGateStatus(state, step.target);
        if (status === undefined) {
          throw new AcceptanceAssertionError(
            `law-07 ${label} route gate to ${step.target} is undefined from ${state.run.currentNodeId}`,
          );
        }
        observations.gates.push({
          at: state.run.currentNodeId,
          target: step.target,
          gateId: status.gate.id,
          status: status.status,
          isOpen: status.isOpen,
          blockReason: status.blockReason ?? null,
        });
      }
    }

    // Boss engagement: the assessment locks when the boss combat starts.
    state = commit(state, { type: "run/move", nodeId: "main_god_echo" }, `${label} move main_god_echo`);
    const preLock = lawCapture(state);
    state = commit(state, { type: "run/select-node", nodeId: "main_god_echo" }, `${label} select boss`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-07 ${label} boss select did not enter combat`);
    }
    const locked = lawCapture(state);

    // The first real boss action is a force attack; the law's counter (if any)
    // is visible in the damage log. The boss's own opening record stays the
    // non-offensive placeholder written at select time.
    state = commit(state, { type: "combat/act", action: "attack" }, `${label} boss force attack`);
    const afterForceAttack = lawCapture(state);
    const forceBossPhase = state.combat?.bossPhase;
    const forceLine = state.combat.log.find(
      (line) => line.includes("造成") && line.includes("伤害") && !line.includes("反击"),
    );
    const forceDamage = forceLine ? Number(/造成 (\d+) 点伤害/.exec(forceLine)?.[1]) : undefined;

    // The second boss action is art, proving the counter targets the biased
    // style rather than every action.
    state = commit(state, { type: "combat/act", action: "art" }, `${label} boss art`);
    const afterArt = lawCapture(state);
    const artBossPhase = state.combat?.bossPhase;
    const artLine = state.combat.log.find((line) => line.includes("术法伤害"));
    const artDamage = artLine ? Number(/造成 (\d+) 点/.exec(artLine)?.[1]) : undefined;

    // Hub state cannot change while the boss combat is active.
    const hubAttempt = application.reduceGameCommand(state, {
      type: "hub/equip-equipment",
      equipmentId: "training_blade",
    });

    let rounds = 2;
    while (state.phase === "combat" && rounds < 100) {
      const action = state.player.hp < 60 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `${label} boss ${action} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-07 ${label} boss combat did not resolve within 100 rounds`);
    }
    const afterBoss = lawCapture(state);

    // The locked assessment survives a save-codec round-trip without backfill.
    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    let roundtripCapture;
    if (roundtrip.status === "decoded") {
      const rtLaw = core.getCurrentDungeonLaw(roundtrip.state);
      roundtripCapture = {
        status: roundtrip.status,
        lawData: rtLaw.state.law,
        combatOpenings: rtLaw.state.combatOpenings,
        combatVictoryNodeIds: [...rtLaw.state.combatVictoryNodeIds],
      };
    } else {
      roundtripCapture = { status: roundtrip.status };
    }

    // Idempotency boundary: re-selecting the cleared boss node is rejected
    // without changing the law state or HP.
    const lawBeforeReselect = lawCapture(state);
    const hpBeforeReselect = state.player.hp;
    const reselect = application.reduceGameCommand(state, {
      type: "run/select-node",
      nodeId: "main_god_echo",
    });
    const lawAfterReselect = lawCapture(state);
    observations.reselect = {
      status: reselect.status,
      rejectionCode: reselect.reason?.code,
      message: reselect.reason?.message,
      lawStateUnchanged:
        JSON.stringify(lawBeforeReselect.lawData) === JSON.stringify(lawAfterReselect.lawData)
        && JSON.stringify(lawBeforeReselect.combatOpenings) === JSON.stringify(lawAfterReselect.combatOpenings),
      hpUnchanged: state.player.hp === hpBeforeReselect,
    };

    observations.boss = {
      preLock: {
        locked: preLock.lawData.bossAssessmentLocked,
        counter: preLock.lawData.bossCounter,
        status: preLock.display.status,
        distribution: preLock.distribution,
      },
      locked: {
        locked: locked.lawData.bossAssessmentLocked,
        counter: locked.lawData.bossCounter,
        status: locked.display.status,
        severity: locked.display.severity,
        targetReached: locked.display.targetReached,
        distribution: locked.distribution,
        bossOpeningRecord: locked.combatOpenings.main_god_echo,
        modifiers: {
          forcePercent: locked.modifiers.outgoingDamage.forcePercent,
          artPercent: locked.modifiers.outgoingDamage.artPercent,
          guardEffectPercent: locked.modifiers.guardEffectPercent,
        },
      },
      lockedExtras: {
        combatOpenings: locked.combatOpenings,
        combatVictoryNodeIds: locked.combatVictoryNodeIds,
        identityElsewhere:
          locked.modifiers.encounter.allStatsPercent === 0
          && locked.modifiers.encounter.defensePercent === 0
          && locked.modifiers.encounter.artPowerPercent === 0
          && locked.modifiers.trap.damagePercent === 0
          && locked.modifiers.trap.dcPercent === 0
          && locked.modifiers.healingPercent === 0,
      },
      afterForceAttack: {
        locked: afterForceAttack.lawData.bossAssessmentLocked,
        counter: afterForceAttack.lawData.bossCounter,
        distribution: afterForceAttack.distribution,
        bossOpeningRecord: afterForceAttack.combatOpenings.main_god_echo,
      },
      forceAttackEvidence: {
        combatOpeningsUnchanged:
          JSON.stringify(afterForceAttack.combatOpenings) === JSON.stringify(locked.combatOpenings),
        log: forceLine,
        damage: forceDamage,
        bossPhase: forceBossPhase,
      },
      afterArt: {
        log: artLine,
        damage: artDamage,
        bossPhase: artBossPhase,
      },
      hubRejection: {
        status: hubAttempt.status,
        code: hubAttempt.reason?.code,
        message: hubAttempt.reason?.message,
      },
      resolved: { phase: state.phase, rounds, hp: state.player.hp },
      afterBoss: {
        locked: afterBoss.lawData.bossAssessmentLocked,
        counter: afterBoss.lawData.bossCounter,
        status: afterBoss.display.status,
        distribution: afterBoss.distribution,
      },
      roundtrip: roundtripCapture,
    };
    return observations;
  };

  const flowOrder = Object.freeze(["force-biased", "balanced", "art-biased"]);
  const flowOpenings = Object.freeze({
    "force-biased": ["attack", "attack", "attack"],
    balanced: ["attack", "art", "guard"],
    "art-biased": ["attack", "art", "art"],
  });
  const flows = {};
  for (const flowId of flowOrder) {
    flows[flowId] = runCitadelFlow(flowId, flowOpenings[flowId]);
  }

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("citadel-boss-assessment-freeze");
    deepEqual(
      {
        status: flows["force-biased"].entryDisplay.status,
        severity: flows["force-biased"].entryDisplay.severity,
        targetReached: flows["force-biased"].entryDisplay.targetReached,
        meter: flows["force-biased"].entryDisplay.meter,
      },
      expected.entryDisplay,
      "law-07 entry display",
    );
    for (const flowId of flowOrder) {
      const flow = flows[flowId];
      const expectedFlow = expected.flows[flowId];
      deepEqual(flow.boss.preLock, expectedFlow.preLock, `law-07 ${flowId} pre-lock assessment`);
      deepEqual(flow.boss.locked, expectedFlow.locked, `law-07 ${flowId} locked assessment`);
      assert(
        flow.boss.lockedExtras.identityElsewhere,
        `law-07 ${flowId} counter is the only active modifier`,
      );
      deepEqual(
        flow.boss.lockedExtras.combatVictoryNodeIds,
        expected.victoryOrder,
        `law-07 ${flowId} locked victory order`,
      );
      deepEqual(
        flow.boss.afterForceAttack,
        expectedFlow.afterForceAttack,
        `law-07 ${flowId} assessment frozen after first boss action`,
      );
      deepEqual(flow.boss.afterBoss, expectedFlow.afterBoss, `law-07 ${flowId} assessment after boss victory`);
      equal(
        flow.boss.roundtrip.status,
        expectedFlow.roundtrip.status,
        `law-07 ${flowId} roundtrip status`,
      );
      equal(
        flow.boss.roundtrip.lawData.bossAssessmentLocked,
        expectedFlow.roundtrip.locked,
        `law-07 ${flowId} roundtrip locked`,
      );
      equal(
        flow.boss.roundtrip.lawData.bossCounter,
        expectedFlow.roundtrip.counter,
        `law-07 ${flowId} roundtrip counter`,
      );
      deepEqual(
        flow.boss.roundtrip.combatOpenings,
        flow.boss.lockedExtras.combatOpenings,
        `law-07 ${flowId} roundtrip combat openings`,
      );
      deepEqual(
        flow.boss.roundtrip.combatVictoryNodeIds,
        expected.victoryOrder,
        `law-07 ${flowId} roundtrip victory order`,
      );
      equal(
        flow.boss.hubRejection.code,
        expected.hubRejection.code,
        `law-07 ${flowId} hub rejection code`,
      );
      equal(
        flow.boss.hubRejection.status,
        "rejected",
        `law-07 ${flowId} hub rejection status`,
      );
      // The distribution never changes between the pre-lock preview and the
      // post-boss state: the boss's own opening is excluded and the records
      // are frozen at lock time.
      deepEqual(
        flow.boss.preLock.distribution,
        flow.boss.locked.distribution,
        `law-07 ${flowId} distribution unchanged by the lock`,
      );
      deepEqual(
        flow.boss.locked.distribution,
        flow.boss.afterBoss.distribution,
        `law-07 ${flowId} distribution unchanged after boss victory`,
      );
    }
    results.push({
      id: "citadel-boss-assessment-freeze",
      status: "PASS",
      flows: flowOrder.map((flowId) => ({
        flow: flowId,
        lockedCounter: flows[flowId].boss.locked.counter,
        status: flows[flowId].boss.locked.status,
      })),
      hubRejectionCode: flows["force-biased"].boss.hubRejection.code,
    });
  }

  {
    const expected = expectedById.get("citadel-counter-targets-bias");
    const damage = {};
    for (const flowId of flowOrder) {
      const flow = flows[flowId];
      const expectedFlow = expected[flowId];
      equal(flow.boss.locked.counter, expectedFlow.counter, `law-07 ${flowId} counter`);
      equal(flow.boss.forceAttackEvidence.log, expectedFlow.forceDamageLog, `law-07 ${flowId} force damage log`);
      equal(flow.boss.afterArt.log, expectedFlow.artDamageLog, `law-07 ${flowId} art damage log`);
      equal(flow.boss.forceAttackEvidence.damage, expectedFlow.forceDamage, `law-07 ${flowId} force damage`);
      equal(flow.boss.afterArt.damage, expectedFlow.artDamage, `law-07 ${flowId} art damage`);
      equal(
        flow.boss.forceAttackEvidence.bossPhase,
        expectedFlow.forceBossPhase,
        `law-07 ${flowId} force boss phase`,
      );
      equal(
        flow.boss.afterArt.bossPhase,
        expectedFlow.artBossPhase,
        `law-07 ${flowId} art boss phase`,
      );
      assert(
        flow.boss.forceAttackEvidence.combatOpeningsUnchanged,
        `law-07 ${flowId} boss opening record is not overwritten by the real attack`,
      );
      damage[flowId] = {
        force: flow.boss.forceAttackEvidence.damage,
        art: flow.boss.afterArt.damage,
      };
    }
    // Structural proof that the counter targets the biased style: the
    // force-biased flow alone has reduced force damage, the art-biased flow
    // alone has reduced art damage, and unpenalized damages match exactly.
    const relation = {
      forcePenalizedOnlyInForceBiased:
        damage["force-biased"].force < damage.balanced.force
        && damage["art-biased"].force === damage.balanced.force,
      artPenalizedOnlyInArtBiased:
        damage["art-biased"].art < damage["force-biased"].art
        && damage["force-biased"].art === damage.balanced.art,
      unpenalizedForceDamageEqual: damage["art-biased"].force === damage.balanced.force,
      unpenalizedArtDamageEqual: damage["force-biased"].art === damage.balanced.art,
    };
    deepEqual(relation, expected.relationships, "law-07 counter damage relationships");
    results.push({
      id: "citadel-counter-targets-bias",
      status: "PASS",
      counters: {
        "force-biased": flows["force-biased"].boss.locked.counter,
        balanced: flows.balanced.boss.locked.counter,
        "art-biased": flows["art-biased"].boss.locked.counter,
      },
      forceDamage: damage["force-biased"].force,
      artDamage: damage["art-biased"].art,
    });
  }

  {
    const expected = expectedById.get("citadel-style-route-gates");
    const actualGates = flowOrder.flatMap((flowId) =>
      flows[flowId].gates.map((gate) => ({ flow: flowId, ...gate }))
    );
    equal(actualGates.length, expected.gates.length, "law-07 route gate observation count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      const actualGate = actualGates[index];
      const expectedGate = expected.gates[index];
      deepEqual(actualGate, expectedGate, `law-07 route gate ${index}`);
    }
    results.push({
      id: "citadel-style-route-gates",
      status: "PASS",
      verifiedGates: expected.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("citadel-repeat-clear-boundary");
    for (const flowId of flowOrder) {
      const reselect = flows[flowId].reselect;
      equal(reselect.status, "rejected", `law-07 ${flowId} reselect status`);
      equal(reselect.rejectionCode, expected.rejectionCode, `law-07 ${flowId} reselect code`);
      equal(
        reselect.lawStateUnchanged,
        expected.lawStateUnchanged,
        `law-07 ${flowId} reselect law state unchanged`,
      );
      equal(reselect.hpUnchanged, expected.hpUnchanged, `law-07 ${flowId} reselect hp unchanged`);
    }
    results.push({
      id: "citadel-repeat-clear-boundary",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: flows["force-biased"].reselect.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law08Chronal({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-08 chronal legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-08 chronal legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-08 chronal decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-08 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-08 chronal law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-08 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterObservatory = (state, label) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "temporal_observatory",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      `${label} enter temporal_observatory`,
    );

  const move = (state, nodeId, label) =>
    commit(state, { type: "run/move", nodeId }, `${label} move ${nodeId}`);

  const collect = (state, nodeId, label) => {
    const before = lawCapture(state);
    state = move(state, nodeId, label);
    state = commit(state, { type: "node/collect-reward" }, `${label} collect ${nodeId}`);
    return { state, log: state.log[0], before, after: lawCapture(state) };
  };

  const fight = (state, nodeId, label) => {
    if (state.run.currentNodeId !== nodeId) {
      state = move(state, nodeId, label);
    }
    state = commit(state, { type: "run/select-node", nodeId }, `${label} select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(
        `law-08 ${label} select ${nodeId} did not enter combat`,
      );
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 100) {
      const action = state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `${label} ${action} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(
        `law-08 ${label} combat ${nodeId} did not resolve within 100 rounds`,
      );
    }
    if (state.run.pendingEquipmentOffer) {
      state = commit(
        state,
        { type: "node/resolve-equipment-loot" },
        `${label} abandon elite loot`,
      );
    }
    return { state, nodeId, rounds, hpAfter: state.player.hp };
  };

  const riskTrap = (state, nodeId, label) => {
    const hpBefore = state.player.hp;
    if (state.run.currentNodeId !== nodeId) {
      state = move(state, nodeId, label);
    }
    state = commit(
      state,
      { type: "node/handle-trap", choice: "risk" },
      `${label} trap ${nodeId}`,
    );
    return { state, nodeId, hpBefore, hpAfter: state.player.hp };
  };

  // Flow A walks the dual-anchor mainline: past anchor calibration, the closed
  // dual bridge, future anchor calibration, the opened bridge and the boss.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      alphaFight: undefined,
      past: undefined,
      reselect: undefined,
      pastGate: undefined,
      erasedFight: undefined,
      zeroMeridian: undefined,
      bridgeClosed: undefined,
      closedMove: undefined,
      scoutFight: undefined,
      futureGateClosed: undefined,
      omegaFight: undefined,
      future: undefined,
      futureGateOpen: undefined,
      accelFight: undefined,
      bridgeOpen: undefined,
      bridgeTraversal: undefined,
      boss: undefined,
      roundtrip: undefined,
    };
    state = enterObservatory(state, "flow-a");
    observations.entry = lawCapture(state);

    state = move(state, "entry_chronometer", "flow-a");
    state = commit(state, { type: "node/collect-reward" }, "flow-a collect entry_chronometer");
    state = move(state, "past_clue_cache", "flow-a");
    state = commit(state, { type: "node/collect-reward" }, "flow-a collect past_clue_cache");
    observations.alphaFight = fight(state, "epoch_sentinel_alpha", "flow-a");
    state = observations.alphaFight.state;

    const past = collect(state, "past_calibration_anchor", "flow-a");
    state = past.state;
    observations.past = { log: past.log, before: past.before, after: past.after };

    // Idempotency boundary: re-selecting the just-cleared anchor is rejected
    // without touching the law state or HP.
    const lawBeforeReselect = lawCapture(state);
    const hpBeforeReselect = state.player.hp;
    const reselect = application.reduceGameCommand(state, {
      type: "run/select-node",
      nodeId: "past_calibration_anchor",
    });
    observations.reselect = {
      status: reselect.status,
      rejectionCode: reselect.reason?.code,
      lawStateUnchanged:
        JSON.stringify(lawBeforeReselect.lawData) === JSON.stringify(lawCapture(state).lawData),
      hpUnchanged: state.player.hp === hpBeforeReselect,
    };

    state = move(state, "epoch_sentinel_alpha", "flow-a");
    state = move(state, "past_shortcut_foyer", "flow-a");
    observations.pastGate = gateCheck(state, "erased_patrol");
    state = move(state, "erased_patrol", "flow-a");
    observations.erasedFight = fight(state, "erased_patrol", "flow-a");
    state = observations.erasedFight.state;

    observations.zeroMeridian = riskTrap(state, "zero_meridian", "flow-a");
    state = observations.zeroMeridian.state;

    state = move(state, "calibration_bridge", "flow-a");
    state = commit(state, { type: "node/collect-reward" }, "flow-a collect calibration_bridge");
    observations.bridgeClosed = gateCheck(state, "zero_hour_regent");
    const lawBeforeClosedMove = lawCapture(state);
    const hpBeforeClosedMove = state.player.hp;
    const closedMove = application.reduceGameCommand(state, {
      type: "run/move",
      nodeId: "zero_hour_regent",
    });
    observations.closedMove = {
      status: closedMove.status,
      code: closedMove.reason?.code,
      lawUnchanged:
        JSON.stringify(lawBeforeClosedMove.lawData) === JSON.stringify(lawCapture(state).lawData),
      hpUnchanged: state.player.hp === hpBeforeClosedMove,
    };

    state = move(state, "zero_meridian", "flow-a");
    observations.scoutFight = fight(state, "clockwork_scout", "flow-a");
    state = observations.scoutFight.state;
    state = move(state, "future_shortcut_foyer", "flow-a");
    observations.futureGateClosed = gateCheck(state, "accelerated_patrol");

    state = move(state, "epoch_sentinel_omega", "flow-a");
    observations.omegaFight = fight(state, "epoch_sentinel_omega", "flow-a");
    state = observations.omegaFight.state;
    const future = collect(state, "future_calibration_anchor", "flow-a");
    state = future.state;
    observations.future = { log: future.log, before: future.before, after: future.after };

    state = move(state, "epoch_sentinel_omega", "flow-a");
    state = move(state, "future_shortcut_foyer", "flow-a");
    observations.futureGateOpen = gateCheck(state, "accelerated_patrol");
    state = move(state, "accelerated_patrol", "flow-a");
    observations.accelFight = fight(state, "accelerated_patrol", "flow-a");
    state = observations.accelFight.state;

    state = move(state, "zero_meridian", "flow-a");
    state = move(state, "calibration_bridge", "flow-a");
    observations.bridgeOpen = gateCheck(state, "zero_hour_regent");
    const bossModifiers = lawCapture(state).modifiers;
    state = move(state, "zero_hour_regent", "flow-a");
    observations.bridgeTraversal = { nodeId: state.run.currentNodeId, phase: state.phase };

    state = commit(
      state,
      { type: "run/select-node", nodeId: "zero_hour_regent" },
      "flow-a select boss",
    );
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-08 flow-a boss select did not enter combat");
    }
    let bossRounds = 0;
    while (state.phase === "combat" && bossRounds < 150) {
      const action = state.player.hp < 60 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `flow-a boss ${action} r${bossRounds}`);
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-08 flow-a boss combat did not resolve within 150 rounds");
    }
    observations.boss = {
      nodeId: "zero_hour_regent",
      rounds: bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("zero_hour_regent"),
      modifiers: bossModifiers,
    };

    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (roundtrip.status === "decoded") {
      const rtLaw = core.getCurrentDungeonLaw(roundtrip.state);
      observations.roundtrip = {
        status: roundtrip.status,
        lawData: rtLaw.state.law,
        displayStatus: rtLaw.display.status,
      };
    } else {
      observations.roundtrip = { status: roundtrip.status };
    }
    return observations;
  })();

  // Flow B calibrates only the past anchor and records the single-anchor gate
  // matrix: past shortcut open, future shortcut and dual bridge closed.
  const flowB = (() => {
    let state = hubState;
    const observations = { anchor: undefined, gates: [], openShortcutTraversal: undefined };
    state = enterObservatory(state, "flow-b");
    state = move(state, "entry_chronometer", "flow-b");
    state = commit(state, { type: "node/collect-reward" }, "flow-b collect entry_chronometer");
    state = move(state, "past_clue_cache", "flow-b");
    state = commit(state, { type: "node/collect-reward" }, "flow-b collect past_clue_cache");
    const alpha = fight(state, "epoch_sentinel_alpha", "flow-b");
    state = alpha.state;
    const past = collect(state, "past_calibration_anchor", "flow-b");
    state = past.state;
    observations.anchor = {
      log: past.log,
      lawData: past.after.lawData,
      display: past.after.display,
      modifiers: past.after.modifiers,
    };

    state = move(state, "epoch_sentinel_alpha", "flow-b");
    state = move(state, "past_shortcut_foyer", "flow-b");
    observations.gates.push(gateCheck(state, "erased_patrol"));
    state = move(state, "erased_patrol", "flow-b");
    observations.openShortcutTraversal = state.run.currentNodeId;
    const erased = fight(state, "erased_patrol", "flow-b");
    state = erased.state;
    const zeroMeridian = riskTrap(state, "zero_meridian", "flow-b");
    state = zeroMeridian.state;
    state = move(state, "calibration_bridge", "flow-b");
    state = commit(state, { type: "node/collect-reward" }, "flow-b collect calibration_bridge");
    observations.gates.push(gateCheck(state, "zero_hour_regent"));
    state = move(state, "zero_meridian", "flow-b");
    const scout = fight(state, "clockwork_scout", "flow-b");
    state = scout.state;
    state = move(state, "future_shortcut_foyer", "flow-b");
    observations.gates.push(gateCheck(state, "accelerated_patrol"));
    return observations;
  })();

  // Flow C calibrates only the future anchor: future shortcut open, past
  // shortcut and dual bridge closed with their real reasons.
  const flowC = (() => {
    let state = hubState;
    const observations = { anchor: undefined, gates: [], openShortcutTraversal: undefined };
    state = enterObservatory(state, "flow-c");
    state = move(state, "future_supply", "flow-c");
    state = commit(state, { type: "node/collect-reward" }, "flow-c collect future_supply");
    state = move(state, "future_clue_cache", "flow-c");
    state = commit(state, { type: "node/collect-reward" }, "flow-c collect future_clue_cache");
    state = move(state, "epoch_sentinel_omega", "flow-c");
    const omega = fight(state, "epoch_sentinel_omega", "flow-c");
    state = omega.state;
    const future = collect(state, "future_calibration_anchor", "flow-c");
    state = future.state;
    observations.anchor = {
      log: future.log,
      lawData: future.after.lawData,
      display: future.after.display,
      modifiers: future.after.modifiers,
    };

    state = move(state, "epoch_sentinel_omega", "flow-c");
    state = move(state, "future_shortcut_foyer", "flow-c");
    observations.gates.push(gateCheck(state, "accelerated_patrol"));
    state = move(state, "accelerated_patrol", "flow-c");
    observations.openShortcutTraversal = state.run.currentNodeId;
    const accel = fight(state, "accelerated_patrol", "flow-c");
    state = accel.state;
    state = move(state, "zero_meridian", "flow-c");
    const zeroMeridian = riskTrap(state, "zero_meridian", "flow-c");
    state = zeroMeridian.state;
    state = move(state, "calibration_bridge", "flow-c");
    state = commit(state, { type: "node/collect-reward" }, "flow-c collect calibration_bridge");
    observations.gates.push(gateCheck(state, "zero_hour_regent"));
    state = move(state, "zero_meridian", "flow-c");
    const erased = fight(state, "erased_patrol", "flow-c");
    state = erased.state;
    state = move(state, "past_shortcut_foyer", "flow-c");
    observations.gates.push(gateCheck(state, "erased_patrol"));
    return observations;
  })();

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("chronal-anchor-calibration-display");
    deepEqual(
      {
        status: flowA.entry.display.status,
        severity: flowA.entry.display.severity,
        meter: flowA.entry.display.meter,
        targetReached: flowA.entry.display.targetReached,
      },
      expected.entryDisplay,
      "law-08 entry display",
    );
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-08 entry modifiers");
    deepEqual(
      {
        nodeId: flowA.alphaFight.nodeId,
        rounds: flowA.alphaFight.rounds,
        hpAfter: flowA.alphaFight.hpAfter,
      },
      expected.pathCombat,
      "law-08 path combat",
    );
    deepEqual(
      {
        nodeId: flowA.zeroMeridian.nodeId,
        hpBefore: flowA.zeroMeridian.hpBefore,
        hpAfter: flowA.zeroMeridian.hpAfter,
      },
      expected.pathTrap,
      "law-08 path trap",
    );
    for (const [anchorKey, observation] of [
      ["pastAnchor", flowA.past],
      ["futureAnchor", flowA.future],
    ]) {
      const expectedAnchor = expected[anchorKey];
      equal(observation.log, expectedAnchor.log, `law-08 ${anchorKey} reward log`);
      deepEqual(
        observation.before.lawData,
        expectedAnchor.lawBefore,
        `law-08 ${anchorKey} law before`,
      );
      deepEqual(
        observation.after.lawData,
        expectedAnchor.lawAfter,
        `law-08 ${anchorKey} law after`,
      );
      deepEqual(
        observation.after.display,
        expectedAnchor.display,
        `law-08 ${anchorKey} display after`,
      );
      deepEqual(
        observation.after.modifiers,
        expectedAnchor.modifiers,
        `law-08 ${anchorKey} modifiers after`,
      );
    }
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-08 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-08 roundtrip law data");
    equal(
      flowA.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-08 roundtrip display status",
    );
    results.push({
      id: "chronal-anchor-calibration-display",
      status: "PASS",
      pastCalibrated: flowA.past.after.lawData.pastCalibrated,
      futureCalibrated: flowA.future.after.lawData.futureCalibrated,
      finalStatus: flowA.future.after.display.status,
      roundtripStatus: flowA.roundtrip.status,
    });
  }

  {
    const expected = expectedById.get("chronal-single-anchor-route-gates");
    for (const [flowKey, flow] of [
      ["pastOnly", flowB],
      ["futureOnly", flowC],
    ]) {
      const expectedFlow = expected[flowKey];
      equal(flow.anchor.log, expectedFlow.anchor.log, `law-08 ${flowKey} anchor log`);
      deepEqual(flow.anchor.lawData, expectedFlow.anchor.lawData, `law-08 ${flowKey} anchor law`);
      deepEqual(
        flow.anchor.display,
        expectedFlow.anchor.display,
        `law-08 ${flowKey} anchor display`,
      );
      deepEqual(
        flow.anchor.modifiers,
        expectedFlow.anchor.modifiers,
        `law-08 ${flowKey} anchor modifiers`,
      );
      equal(flow.gates.length, expectedFlow.gates.length, `law-08 ${flowKey} gate count`);
      for (let index = 0; index < expectedFlow.gates.length; index += 1) {
        deepEqual(flow.gates[index], expectedFlow.gates[index], `law-08 ${flowKey} gate ${index}`);
      }
      equal(
        flow.openShortcutTraversal,
        expectedFlow.openShortcutTraversal,
        `law-08 ${flowKey} open shortcut traversal`,
      );
    }
    results.push({
      id: "chronal-single-anchor-route-gates",
      status: "PASS",
      pastOnlyGates: flowB.gates.map((gate) => ({ gateId: gate.gateId, status: gate.status })),
      futureOnlyGates: flowC.gates.map((gate) => ({ gateId: gate.gateId, status: gate.status })),
    });
  }

  {
    const expected = expectedById.get("chronal-dual-anchor-opens-bridge");
    deepEqual(flowA.bridgeClosed, expected.bridgeBeforeDual.gate, "law-08 bridge closed gate");
    deepEqual(
      {
        status: flowA.closedMove.status,
        code: flowA.closedMove.code,
        lawUnchanged: flowA.closedMove.lawUnchanged,
        hpUnchanged: flowA.closedMove.hpUnchanged,
      },
      expected.bridgeBeforeDual.rejectedMove,
      "law-08 closed bridge rejected move",
    );
    deepEqual(flowA.bridgeOpen, expected.bridgeAfterDual.gate, "law-08 bridge open gate");
    deepEqual(
      flowA.bridgeTraversal,
      expected.bridgeAfterDual.traversal,
      "law-08 bridge traversal",
    );
    deepEqual(
      {
        nodeId: flowA.boss.nodeId,
        rounds: flowA.boss.rounds,
        hpAfter: flowA.boss.hpAfter,
        cleared: flowA.boss.cleared,
        modifiers: flowA.boss.modifiers,
      },
      expected.boss,
      "law-08 dual bridge boss",
    );
    results.push({
      id: "chronal-dual-anchor-opens-bridge",
      status: "PASS",
      bridgeGateId: flowA.bridgeOpen.gateId,
      bossRounds: flowA.boss.rounds,
      bossCleared: flowA.boss.cleared,
    });
  }

  {
    const expected = expectedById.get("chronal-repeat-clear-boundary");
    equal(flowA.reselect.status, "rejected", "law-08 reselect status");
    equal(
      flowA.reselect.rejectionCode,
      expected.rejectionCode,
      "law-08 reselect rejection code",
    );
    equal(
      flowA.reselect.lawStateUnchanged,
      expected.lawStateUnchanged,
      "law-08 reselect law state unchanged",
    );
    equal(flowA.reselect.hpUnchanged, expected.hpUnchanged, "law-08 reselect hp unchanged");
    results.push({
      id: "chronal-repeat-clear-boundary",
      status: "PASS",
      reselectedNodeId: expected.reselectedNodeId,
      rejectionCode: flowA.reselect.rejectionCode,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

// Combat logs are newest-first and capped, so the new lines are a prefix whose
// remainder matches a prefix of the previous log.
function causalNewLogLines(beforeLog, afterLog) {
  for (let count = Math.min(afterLog.length, 6); count >= 0; count -= 1) {
    const tail = afterLog.slice(count);
    const expectedTail = beforeLog.slice(0, tail.length);
    if (JSON.stringify(tail) === JSON.stringify(expectedTail)) {
      return afterLog.slice(0, count);
    }
  }
  return [];
}

export async function law09Causal({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-09 causal legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-09 causal legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-09 causal decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-09 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-09 causal law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-09 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterClearinghouse = (state, label) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "causal_clearinghouse",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      `${label} enter causal_clearinghouse`,
    );

  const move = (state, nodeId, label) =>
    commit(state, { type: "run/move", nodeId }, `${label} move ${nodeId}`);

  const tryMove = (state, nodeId, label) => {
    const result = application.reduceGameCommand(state, { type: "run/move", nodeId });
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const fight = (state, nodeId, label) => {
    if (state.run.currentNodeId !== nodeId) {
      state = move(state, nodeId, label);
    }
    state = commit(state, { type: "run/select-node", nodeId }, `${label} select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(
        `law-09 ${label} select ${nodeId} did not enter combat`,
      );
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 100) {
      const action = state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `${label} ${action} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(
        `law-09 ${label} combat ${nodeId} did not resolve within 100 rounds`,
      );
    }
    if (state.run.pendingEquipmentOffer) {
      state = commit(
        state,
        { type: "node/resolve-equipment-loot" },
        `${label} abandon elite loot`,
      );
    }
    return { state, rounds, hpAfter: state.player.hp };
  };

  const riskTrap = (state, nodeId, label) => {
    if (state.run.currentNodeId !== nodeId) {
      state = move(state, nodeId, label);
    }
    const hpBefore = state.player.hp;
    state = commit(
      state,
      { type: "node/handle-trap", choice: "risk" },
      `${label} trap ${nodeId}`,
    );
    return { state, nodeId, hpBefore, hpAfter: state.player.hp };
  };

  const resolveLedger = (state, choice, label) => {
    const before = {
      hp: state.player.hp,
      debt: core.getCurrentCausalLedgerStatus(state)?.debt,
      rewardPoints: state.rewardPoints,
    };
    const result = application.reduceGameCommand(state, {
      type: "law/resolve-causal-ledger",
      choice,
    });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      before,
      after: {
        hp: after.player.hp,
        debt: core.getCurrentCausalLedgerStatus(after)?.debt,
        rewardPoints: after.rewardPoints,
      },
    };
  };

  const collect = (state, nodeId, label) => {
    if (state.run.currentNodeId !== nodeId) {
      state = move(state, nodeId, label);
    }
    return commit(state, { type: "node/collect-reward" }, `${label} collect ${nodeId}`);
  };

  // Flow A walks the full ledger loop: a balance settlement, two overdrafts
  // with heal/RP, the debt-2 boss bridge, two repayments and a codec round-trip.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      usherFight: undefined,
      pendingAfterFight: undefined,
      departureBlock: undefined,
      balance: undefined,
      reselect: undefined,
      contradictionTrap: undefined,
      overdraws: [],
      soulTrap: undefined,
      bridgeAtDebtTwo: undefined,
      effectBailiffFight: undefined,
      repays: [],
      paradoxFight: undefined,
      finalDisplay: undefined,
      roundtrip: undefined,
      noPendingResolve: undefined,
    };
    state = enterClearinghouse(state, "flow-a");
    observations.entry = lawCapture(state);

    const usher = fight(state, "verdict_usher", "flow-a");
    state = usher.state;
    observations.usherFight = { nodeId: "verdict_usher", rounds: usher.rounds, hpAfter: usher.hpAfter };
    observations.pendingAfterFight = {
      display: lawCapture(state).display,
      pendingLedgerNodeId: lawCapture(state).lawData.pendingLedgerNodeId,
    };

    // The pending ledger blocks departure until a choice is made.
    observations.departureBlock = (() => {
      const attempt = tryMove(state, "contradiction_line", "flow-a");
      return {
        status: attempt.status,
        code: attempt.code,
        message: attempt.message,
        target: "contradiction_line",
      };
    })();

    const balance = resolveLedger(state, "balance", "flow-a");
    state = balance.state;
    observations.balance = {
      log: balance.log,
      hpBefore: balance.before.hp,
      hpAfter: balance.after.hp,
      debtBefore: balance.before.debt,
      debtAfter: balance.after.debt,
      settledLedgerNodeIds: [...lawCapture(state).lawData.settledLedgerNodeIds],
    };

    // Idempotency boundary: re-selecting the settled ledger node is rejected
    // without touching the law state or HP.
    const lawBeforeReselect = JSON.stringify(lawCapture(state).lawData);
    const hpBeforeReselect = state.player.hp;
    const reselect = application.reduceGameCommand(state, {
      type: "run/select-node",
      nodeId: "verdict_usher",
    });
    observations.reselect = {
      nodeId: "verdict_usher",
      status: reselect.status,
      code: reselect.reason?.code,
      message: reselect.reason?.message,
      lawStateUnchanged: lawBeforeReselect === JSON.stringify(lawCapture(state).lawData),
      hpUnchanged: hpBeforeReselect === state.player.hp,
    };

    const trap = riskTrap(state, "contradiction_line", "flow-a");
    state = trap.state;
    observations.contradictionTrap = { nodeId: trap.nodeId, hpBefore: trap.hpBefore, hpAfter: trap.hpAfter };
    let overdraw = resolveLedger(state, "overdraw", "flow-a");
    state = overdraw.state;
    observations.overdraws.push({
      log: overdraw.log,
      hpBefore: overdraw.before.hp,
      hpAfter: overdraw.after.hp,
      debtBefore: overdraw.before.debt,
      debtAfter: overdraw.after.debt,
      rewardPointsBefore: overdraw.before.rewardPoints,
      rewardPointsAfter: overdraw.after.rewardPoints,
    });

    state = collect(state, "verdict_bridge", "flow-a");
    const soulTrap = riskTrap(state, "soul_recharge_chamber", "flow-a");
    state = soulTrap.state;
    observations.soulTrap = { nodeId: soulTrap.nodeId, hpBefore: soulTrap.hpBefore, hpAfter: soulTrap.hpAfter };
    overdraw = resolveLedger(state, "overdraw", "flow-a");
    state = overdraw.state;
    observations.overdraws.push({
      log: overdraw.log,
      hpBefore: overdraw.before.hp,
      hpAfter: overdraw.after.hp,
      debtBefore: overdraw.before.debt,
      debtAfter: overdraw.after.debt,
      rewardPointsBefore: overdraw.before.rewardPoints,
      rewardPointsAfter: overdraw.after.rewardPoints,
    });

    state = move(state, "verdict_bridge", "flow-a");
    observations.bridgeAtDebtTwo = gateCheck(state, "zero_sum_auditor");

    state = move(state, "soul_recharge_chamber", "flow-a");
    const effectBailiff = fight(state, "effect_bailiff", "flow-a");
    state = effectBailiff.state;
    observations.effectBailiffFight = {
      nodeId: "effect_bailiff",
      rounds: effectBailiff.rounds,
      hpAfter: effectBailiff.hpAfter,
    };
    let repay = resolveLedger(state, "repay", "flow-a");
    state = repay.state;
    observations.repays.push({
      log: repay.log,
      hpBefore: repay.before.hp,
      hpAfter: repay.after.hp,
      debtBefore: repay.before.debt,
      debtAfter: repay.after.debt,
    });

    state = collect(state, "effect_deposition", "flow-a");
    const paradox = fight(state, "paradox_bailiff_omega", "flow-a");
    state = paradox.state;
    observations.paradoxFight = {
      nodeId: "paradox_bailiff_omega",
      rounds: paradox.rounds,
      hpAfter: paradox.hpAfter,
    };
    repay = resolveLedger(state, "repay", "flow-a");
    state = repay.state;
    observations.repays.push({
      log: repay.log,
      hpBefore: repay.before.hp,
      hpAfter: repay.after.hp,
      debtBefore: repay.before.debt,
      debtAfter: repay.after.debt,
    });

    observations.finalDisplay = lawCapture(state).display;

    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    observations.roundtrip = {
      status: roundtrip.status,
      lawData: roundtrip.status === "decoded"
        ? core.getCurrentDungeonLaw(roundtrip.state).state.law
        : undefined,
    };

    // Error boundary: resolving a ledger choice with no pending ledger is a
    // domain rejection that leaves the state untouched.
    const noPending = resolveLedger(state, "balance", "flow-a");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
    };
    return observations;
  })();

  // Flow B exercises the debt route gates: the verdict bridge opens at debt 2,
  // closes at debt 3 with its real reason, and reopens after a repayment.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      debtAfterTwoOverdraws: undefined,
      bridgeAtDebtTwo: undefined,
      debtAfterThreeOverdraws: undefined,
      bridgeAtDebtThree: undefined,
      closedMove: undefined,
      repay: undefined,
      bridgeAfterRepay: undefined,
    };
    state = enterClearinghouse(state, "flow-b");
    const usher = fight(state, "verdict_usher", "flow-b");
    state = usher.state;
    let overdraw = resolveLedger(state, "overdraw", "flow-b");
    state = overdraw.state;
    const trap = riskTrap(state, "contradiction_line", "flow-b");
    state = trap.state;
    overdraw = resolveLedger(state, "overdraw", "flow-b");
    state = overdraw.state;
    state = move(state, "verdict_bridge", "flow-b");
    observations.debtAfterTwoOverdraws = lawCapture(state).lawData.debt;
    observations.bridgeAtDebtTwo = gateCheck(state, "zero_sum_auditor");

    const soulTrap = riskTrap(state, "soul_recharge_chamber", "flow-b");
    state = soulTrap.state;
    overdraw = resolveLedger(state, "overdraw", "flow-b");
    state = overdraw.state;
    state = move(state, "verdict_bridge", "flow-b");
    observations.debtAfterThreeOverdraws = lawCapture(state).lawData.debt;
    observations.bridgeAtDebtThree = gateCheck(state, "zero_sum_auditor");

    const closedMove = tryMove(state, "zero_sum_auditor", "flow-b");
    observations.closedMove = {
      status: closedMove.status,
      code: closedMove.code,
      message: closedMove.message,
      target: "zero_sum_auditor",
    };

    state = move(state, "soul_recharge_chamber", "flow-b");
    const effectBailiff = fight(state, "effect_bailiff", "flow-b");
    state = effectBailiff.state;
    const repay = resolveLedger(state, "repay", "flow-b");
    state = repay.state;
    observations.repay = {
      log: repay.log,
      debtBefore: repay.before.debt,
      debtAfter: repay.after.debt,
    };

    state = move(state, "soul_recharge_chamber", "flow-b");
    state = move(state, "verdict_bridge", "flow-b");
    observations.bridgeAfterRepay = gateCheck(state, "zero_sum_auditor");
    return observations;
  })();

  // Flow C enters the boss with outstanding debt: the debt locks into
  // collection seals that halve the first attacks, then clear one by one.
  const flowC = (() => {
    let state = hubState;
    const observations = {
      bossLawAtStart: undefined,
      bossDisplayAtStart: undefined,
      bossFight: undefined,
      sealedAttacks: [],
      firstUnsealedAttack: undefined,
      lawAfterBoss: undefined,
      displayAfterBoss: undefined,
      ledgerAfterLock: undefined,
    };
    state = enterClearinghouse(state, "flow-c");
    const usher = fight(state, "verdict_usher", "flow-c");
    state = usher.state;
    let overdraw = resolveLedger(state, "overdraw", "flow-c");
    state = overdraw.state;
    const trap = riskTrap(state, "contradiction_line", "flow-c");
    state = trap.state;
    overdraw = resolveLedger(state, "overdraw", "flow-c");
    state = overdraw.state;
    state = move(state, "verdict_bridge", "flow-c");
    state = move(state, "zero_sum_auditor", "flow-c");
    state = commit(
      state,
      { type: "run/select-node", nodeId: "zero_sum_auditor" },
      "flow-c select boss",
    );
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-09 flow-c boss select did not enter combat");
    }
    observations.bossLawAtStart = lawCapture(state).lawData;
    observations.bossDisplayAtStart = lawCapture(state).display;

    let bossRounds = 0;
    const attackEvents = [];
    while (state.phase === "combat" && bossRounds < 200) {
      const action = state.player.hp < 60 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      const beforeLog = [...(state.combat?.log ?? [])];
      const sealsBefore = lawCapture(state).lawData.collectionSeals;
      const monsterHpBefore = state.combat?.monsterHp;
      state = commit(state, { type: "combat/act", action }, `flow-c boss ${action} r${bossRounds}`);
      if (action === "attack" && state.phase === "combat") {
        const newLines = causalNewLogLines(beforeLog, state.combat?.log ?? []);
        attackEvents.push({
          sealsBefore,
          sealsAfter: lawCapture(state).lawData.collectionSeals,
          sealLine: newLines.find((line) => line.includes("追缴印")) ?? null,
          atkLine: newLines.find((line) => line.startsWith("你发动攻击")) ?? null,
          damage: monsterHpBefore - state.combat.monsterHp,
        });
      }
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-09 flow-c boss combat did not resolve within 200 rounds");
    }
    observations.bossFight = {
      rounds: bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("zero_sum_auditor"),
    };
    observations.sealedAttacks = attackEvents.filter((event) => event.sealLine !== null);
    const firstUnsealed = attackEvents.find((event) => event.sealLine === null && event.damage > 0);
    observations.firstUnsealedAttack = firstUnsealed
      ? { damage: firstUnsealed.damage, sealLine: null, atkLine: firstUnsealed.atkLine }
      : undefined;
    observations.lawAfterBoss = lawCapture(state).lawData;
    observations.displayAfterBoss = lawCapture(state).display;

    // After the boss lock the ledger is frozen: a further choice is a domain
    // rejection and the debt stays put.
    const locked = resolveLedger(state, "overdraw", "flow-c");
    observations.ledgerAfterLock = {
      status: locked.status,
      code: locked.code,
      message: locked.message,
      debtUnchanged: locked.before.debt === locked.after.debt,
      debt: locked.after.debt,
    };
    return observations;
  })();

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("causal-ledger-balance-overdraw-repay");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-09 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-09 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-09 entry law data");
    deepEqual(flowA.usherFight, expected.pathCombat, "law-09 path combat");
    deepEqual(flowA.pendingAfterFight, expected.pendingAfterFight, "law-09 pending after fight");
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-09 departure block");
    deepEqual(flowA.balance, expected.balance, "law-09 balance settlement");
    deepEqual(flowA.contradictionTrap, expected.trap, "law-09 contradiction trap");
    equal(flowA.overdraws.length, expected.overdraws.length, "law-09 overdraw count");
    for (let index = 0; index < expected.overdraws.length; index += 1) {
      deepEqual(flowA.overdraws[index], expected.overdraws[index], `law-09 overdraw ${index}`);
    }
    deepEqual(flowA.soulTrap, expected.soulTrap, "law-09 soul recharge trap");
    deepEqual(flowA.bridgeAtDebtTwo, expected.bridgeAtDebtTwo, "law-09 bridge at debt 2");
    deepEqual(flowA.effectBailiffFight, expected.effectBailiff, "law-09 effect bailiff fight");
    equal(flowA.repays.length, expected.repays.length, "law-09 repay count");
    for (let index = 0; index < expected.repays.length; index += 1) {
      deepEqual(flowA.repays[index], expected.repays[index], `law-09 repay ${index}`);
    }
    deepEqual(flowA.paradoxFight, expected.paradoxOmega, "law-09 paradox omega fight");
    deepEqual(flowA.finalDisplay, expected.finalDisplay, "law-09 final display");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-09 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-09 roundtrip law data");
    results.push({
      id: "causal-ledger-balance-overdraw-repay",
      status: "PASS",
      overdraws: flowA.overdraws.length,
      repays: flowA.repays.length,
      finalDebt: flowA.finalDisplay.meter.value,
      roundtripStatus: flowA.roundtrip.status,
    });
  }

  {
    const expected = expectedById.get("causal-debt-route-gates");
    equal(
      flowB.debtAfterTwoOverdraws,
      expected.debtAfterTwoOverdraws,
      "law-09 debt after two overdraws",
    );
    deepEqual(flowB.bridgeAtDebtTwo, expected.bridgeAtDebtTwo, "law-09 bridge open at debt 2");
    equal(
      flowB.debtAfterThreeOverdraws,
      expected.debtAfterThreeOverdraws,
      "law-09 debt after three overdraws",
    );
    deepEqual(flowB.bridgeAtDebtThree, expected.bridgeAtDebtThree, "law-09 bridge closed at debt 3");
    deepEqual(flowB.closedMove, expected.closedMove, "law-09 closed gate move");
    deepEqual(flowB.repay, expected.repay, "law-09 gate repay");
    deepEqual(flowB.bridgeAfterRepay, expected.bridgeAfterRepay, "law-09 bridge reopen after repay");
    results.push({
      id: "causal-debt-route-gates",
      status: "PASS",
      gateId: flowB.bridgeAtDebtThree.gateId,
      closedAtDebt: flowB.debtAfterThreeOverdraws,
      reopenedAfterRepay: flowB.bridgeAfterRepay.isOpen,
    });
  }

  {
    const expected = expectedById.get("causal-boss-collection-seals");
    deepEqual(flowC.bossLawAtStart, expected.bossLawAtStart, "law-09 boss law at start");
    deepEqual(flowC.bossDisplayAtStart, expected.bossDisplayAtStart, "law-09 boss display at start");
    deepEqual(flowC.bossFight, expected.bossFight, "law-09 boss fight");
    equal(
      flowC.sealedAttacks.length,
      expected.sealedAttacks.length,
      "law-09 sealed attack count",
    );
    for (let index = 0; index < expected.sealedAttacks.length; index += 1) {
      deepEqual(flowC.sealedAttacks[index], expected.sealedAttacks[index], `law-09 sealed attack ${index}`);
    }
    deepEqual(flowC.firstUnsealedAttack, expected.firstUnsealedAttack, "law-09 first unsealed attack");
    for (const sealed of flowC.sealedAttacks) {
      equal(
        sealed.damage,
        Math.max(1, Math.floor(flowC.firstUnsealedAttack.damage / 2)),
        `law-09 sealed damage ${sealed.sealsAfter} is half of unsealed`,
      );
    }
    deepEqual(flowC.lawAfterBoss, expected.lawAfterBoss, "law-09 law after boss");
    deepEqual(flowC.displayAfterBoss, expected.displayAfterBoss, "law-09 display after boss");
    deepEqual(flowC.ledgerAfterLock, expected.ledgerAfterLock, "law-09 ledger after boss lock");
    results.push({
      id: "causal-boss-collection-seals",
      status: "PASS",
      sealsAtBossStart: flowC.bossLawAtStart.collectionSeals,
      sealedAttacks: flowC.sealedAttacks.length,
      sealedDamage: flowC.sealedAttacks[0]?.damage,
      unsealedDamage: flowC.firstUnsealedAttack?.damage,
      bossRounds: flowC.bossFight.rounds,
    });
  }

  {
    const expected = expectedById.get("causal-repeat-boundary");
    equal(flowA.reselect.nodeId, expected.reselectedNodeId, "law-09 reselect node");
    equal(flowA.reselect.status, "rejected", "law-09 reselect status");
    equal(flowA.reselect.code, expected.rejectionCode, "law-09 reselect rejection code");
    equal(flowA.reselect.message, expected.rejectionMessage, "law-09 reselect rejection message");
    equal(
      flowA.reselect.lawStateUnchanged,
      expected.lawStateUnchanged,
      "law-09 reselect law state unchanged",
    );
    equal(flowA.reselect.hpUnchanged, expected.hpUnchanged, "law-09 reselect hp unchanged");
    deepEqual(flowA.noPendingResolve, expected.noPendingResolve, "law-09 no-pending resolve");
    results.push({
      id: "causal-repeat-boundary",
      status: "PASS",
      reselectedNodeId: flowA.reselect.nodeId,
      rejectionCode: flowA.reselect.code,
      noPendingCode: flowA.noPendingResolve.code,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law10Entropy({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-10 entropy legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-10 entropy legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-10 entropy decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-10 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-10 entropy law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-10 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterArk = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "entropy_ark",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter entropy_ark",
    );

  const move = (state, nodeId) =>
    commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };

  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };

  const counterTrap = (state, nodeId, path = []) => {
    state = goto(state, path);
    const hpBefore = state.player.hp;
    state = commit(
      state,
      { type: "node/handle-trap", choice: "counter" },
      `counter ${nodeId}`,
    );
    return { state, nodeId, hpBefore, hpAfter: state.player.hp };
  };

  const fight = (state, nodeId, path = []) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(
        `law-10 select ${nodeId} did not enter combat`,
      );
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      const action = state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `${action} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(
        `law-10 combat ${nodeId} did not resolve within 200 rounds`,
      );
    }
    if (state.run.pendingEquipmentOffer) {
      state = commit(
        state,
        { type: "node/resolve-equipment-loot" },
        "abandon elite loot",
      );
    }
    return { state, rounds, hpAfter: state.player.hp };
  };

  const resolveHeading = (state, choice) => {
    const before = { entropy: lawCapture(state).lawData.entropy };
    const result = application.reduceGameCommand(state, {
      type: "law/resolve-entropy-heading",
      choice,
    });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      entropyBefore: before.entropy,
      entropyAfter: lawCapture(after).lawData.entropy,
    };
  };

  // Flow A walks all three heading consoles: each clear opens a pending heading
  // that blocks departure, steady/rush resolutions move entropy, and a codec
  // round-trip preserves the resolved heading map.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      clears: [],
      departureBlock: undefined,
      headings: [],
      gates: [],
      reselect: undefined,
      noPending: undefined,
      roundtrip: undefined,
      final: undefined,
    };
    state = enterArk(state);
    observations.entry = lawCapture(state);

    const deckhand = fight(state, "entropy_deckhand", ["entropy_deckhand"]);
    state = deckhand.state;
    observations.clears.push({
      kind: "monster",
      nodeId: "entropy_deckhand",
      rounds: deckhand.rounds,
      hpAfter: deckhand.hpAfter,
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    state = collect(state, "wake_inversion", ["wake_inversion"]);
    observations.clears.push({
      kind: "reward",
      nodeId: "wake_inversion",
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    state = collect(state, "bow_heading_console", ["port_ballast_core", "bow_heading_console"]);
    observations.clears.push({
      kind: "console",
      nodeId: "bow_heading_console",
      entropyAfter: lawCapture(state).lawData.entropy,
      pending: lawCapture(state).lawData.pendingHeadingNodeId,
      display: lawCapture(state).display,
    });

    // The pending heading blocks departure until steady or rush is chosen.
    const departure = tryCommit(state, { type: "run/move", nodeId: "port_ballast_core" });
    observations.departureBlock = {
      status: departure.status,
      code: departure.code,
      message: departure.message,
      target: "port_ballast_core",
    };

    const bowHeading = resolveHeading(state, "steady");
    state = bowHeading.state;
    observations.headings.push({
      console: "bow_heading_console",
      choice: "steady",
      log: bowHeading.log,
      entropyBefore: bowHeading.entropyBefore,
      entropyAfter: bowHeading.entropyAfter,
      status: bowHeading.status,
      display: lawCapture(state).display,
    });
    observations.gates.push({
      when: "bow-entropy1",
      dissipation: gateCheck(state, "dissipation_navigator_alpha"),
      relic: gateCheck(state, "port_relic_hold"),
    });

    const alpha = fight(state, "dissipation_navigator_alpha", ["dissipation_navigator_alpha"]);
    state = alpha.state;
    observations.clears.push({
      kind: "monster",
      nodeId: "dissipation_navigator_alpha",
      rounds: alpha.rounds,
      hpAfter: alpha.hpAfter,
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    state = collect(state, "midship_heading_console", [
      "bow_heading_console",
      "port_ballast_core",
      "wake_inversion",
      "starboard_ballast_core",
      "midship_heading_console",
    ]);
    observations.clears.push({
      kind: "console",
      nodeId: "midship_heading_console",
      entropyAfter: lawCapture(state).lawData.entropy,
      pending: lawCapture(state).lawData.pendingHeadingNodeId,
      display: lawCapture(state).display,
    });

    const midshipHeading = resolveHeading(state, "rush");
    state = midshipHeading.state;
    observations.headings.push({
      console: "midship_heading_console",
      choice: "rush",
      log: midshipHeading.log,
      entropyBefore: midshipHeading.entropyBefore,
      entropyAfter: midshipHeading.entropyAfter,
      status: midshipHeading.status,
      display: lawCapture(state).display,
    });
    observations.gates.push({
      when: "midship-entropy3",
      dissipation: gateCheck(state, "dissipation_navigator_omega"),
      relic: gateCheck(state, "starboard_relic_hold"),
    });

    state = collect(state, "starboard_ballast_core", ["starboard_ballast_core"]);
    observations.clears.push({
      kind: "reward",
      nodeId: "starboard_ballast_core",
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    const soulTrap = counterTrap(state, "soul_recharge_chamber", ["soul_recharge_chamber"]);
    state = soulTrap.state;
    observations.clears.push({
      kind: "trap-counter",
      nodeId: "soul_recharge_chamber",
      hpBefore: soulTrap.hpBefore,
      hpAfter: soulTrap.hpAfter,
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    state = collect(state, "stern_heading_console", ["stern_heading_console"]);
    observations.clears.push({
      kind: "console",
      nodeId: "stern_heading_console",
      entropyAfter: lawCapture(state).lawData.entropy,
      pending: lawCapture(state).lawData.pendingHeadingNodeId,
      display: lawCapture(state).display,
    });

    const sternHeading = resolveHeading(state, "steady");
    state = sternHeading.state;
    observations.headings.push({
      console: "stern_heading_console",
      choice: "steady",
      log: sternHeading.log,
      entropyBefore: sternHeading.entropyBefore,
      entropyAfter: sternHeading.entropyAfter,
      status: sternHeading.status,
      display: lawCapture(state).display,
    });

    observations.final = lawCapture(state);

    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    observations.roundtrip = {
      status: roundtrip.status,
      lawData: roundtrip.status === "decoded"
        ? core.getCurrentDungeonLaw(roundtrip.state).state.law
        : undefined,
    };

    // Idempotency boundary: re-selecting the settled console is rejected
    // without touching the law state or HP.
    const lawBeforeReselect = JSON.stringify(lawCapture(state).lawData);
    const hpBeforeReselect = state.player.hp;
    const reselect = application.reduceGameCommand(state, {
      type: "run/select-node",
      nodeId: "stern_heading_console",
    });
    observations.reselect = {
      nodeId: "stern_heading_console",
      status: reselect.status,
      code: reselect.reason?.code,
      message: reselect.reason?.message,
      lawStateUnchanged: lawBeforeReselect === JSON.stringify(lawCapture(state).lawData),
      hpUnchanged: hpBeforeReselect === state.player.hp,
    };

    const noPending = resolveHeading(state, "steady");
    observations.noPending = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
    };
    return observations;
  })();

  // Flow B exercises the entropy thresholds: danger at 0/4, the 0/4 choice
  // boundaries, route gates at 1-or-below / 3-or-above, and an illegal move
  // through a closed gate.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      steps: [],
      gates: [],
      closedMove: undefined,
      modifiers: {},
      pendingChoices: {},
    };
    state = enterArk(state);
    observations.entry = lawCapture(state);

    const deckhand = fight(state, "entropy_deckhand", ["entropy_deckhand"]);
    state = deckhand.state;
    observations.steps.push({
      fight: "entropy_deckhand",
      rounds: deckhand.rounds,
      hpAfter: deckhand.hpAfter,
      entropy: lawCapture(state).lawData.entropy,
    });

    state = collect(state, "wake_inversion", ["wake_inversion"]);
    observations.steps.push({
      collect: "wake_inversion",
      entropy: lawCapture(state).lawData.entropy,
    });

    const portDeckhand = fight(state, "entropy_deckhand_port", [
      "port_ballast_core",
      "entropy_deckhand_port",
    ]);
    state = portDeckhand.state;
    observations.steps.push({
      fight: "entropy_deckhand_port",
      rounds: portDeckhand.rounds,
      hpAfter: portDeckhand.hpAfter,
      entropy: lawCapture(state).lawData.entropy,
    });

    const starboardDeckhand = fight(state, "entropy_deckhand_starboard", [
      "port_supply",
      "ark_gate",
      "starboard_supply",
      "entropy_deckhand_starboard",
    ]);
    state = starboardDeckhand.state;
    observations.steps.push({
      fight: "entropy_deckhand_starboard",
      rounds: starboardDeckhand.rounds,
      hpAfter: starboardDeckhand.hpAfter,
      entropy: lawCapture(state).lawData.entropy,
      display: lawCapture(state).display,
    });
    observations.modifiers.atEntropy4 = lawCapture(state).modifiers;

    state = collect(state, "midship_heading_console", [
      "starboard_ballast_core",
      "midship_heading_console",
    ]);
    observations.steps.push({
      collect: "midship_heading_console",
      entropy: lawCapture(state).lawData.entropy,
      pending: lawCapture(state).lawData.pendingHeadingNodeId,
    });
    const statusAtFour = core.getCurrentEntropyHeadingStatus(state);
    observations.pendingChoices.atEntropy4 = {
      available: statusAtFour.available,
      pending: statusAtFour.pending,
      steady: { available: statusAtFour.choices.steady.available },
      rush: {
        available: statusAtFour.choices.rush.available,
        ...(statusAtFour.choices.rush.available
          ? {}
          : { unavailableReason: statusAtFour.choices.rush.unavailableReason }),
      },
    };

    const steadyAtFour = resolveHeading(state, "steady");
    state = steadyAtFour.state;
    observations.steps.push({
      choice: "steady",
      entropyBefore: steadyAtFour.entropyBefore,
      entropyAfter: steadyAtFour.entropyAfter,
      log: steadyAtFour.log,
    });
    observations.gates.push({
      when: "midship-entropy3",
      dissipation: gateCheck(state, "dissipation_navigator_omega"),
      relic: gateCheck(state, "starboard_relic_hold"),
    });
    const closedMove = tryCommit(state, {
      type: "run/move",
      nodeId: "dissipation_navigator_omega",
    });
    observations.closedMove = {
      target: "dissipation_navigator_omega",
      status: closedMove.status,
      code: closedMove.code,
      message: closedMove.message,
    };

    state = collect(state, "starboard_ballast_core", ["starboard_ballast_core"]);
    observations.steps.push({
      collect: "starboard_ballast_core",
      entropy: lawCapture(state).lawData.entropy,
    });
    state = collect(state, "ark_manifest", ["wake_inversion", "ark_manifest"]);
    observations.steps.push({
      collect: "ark_manifest",
      entropy: lawCapture(state).lawData.entropy,
    });
    state = collect(state, "port_supply", [
      "wake_inversion",
      "entropy_deckhand",
      "ark_gate",
      "port_supply",
    ]);
    observations.steps.push({
      collect: "port_supply",
      entropy: lawCapture(state).lawData.entropy,
      display: lawCapture(state).display,
    });
    observations.modifiers.atEntropy0 = lawCapture(state).modifiers;

    state = collect(state, "bow_heading_console", [
      "ark_gate",
      "entropy_deckhand",
      "wake_inversion",
      "port_ballast_core",
      "bow_heading_console",
    ]);
    observations.steps.push({
      collect: "bow_heading_console",
      entropy: lawCapture(state).lawData.entropy,
      pending: lawCapture(state).lawData.pendingHeadingNodeId,
    });
    const statusAtZero = core.getCurrentEntropyHeadingStatus(state);
    observations.pendingChoices.atEntropy0 = {
      available: statusAtZero.available,
      pending: statusAtZero.pending,
      steady: {
        available: statusAtZero.choices.steady.available,
        ...(statusAtZero.choices.steady.available
          ? {}
          : { unavailableReason: statusAtZero.choices.steady.unavailableReason }),
      },
      rush: { available: statusAtZero.choices.rush.available },
    };

    const rushAtZero = resolveHeading(state, "rush");
    state = rushAtZero.state;
    observations.steps.push({
      choice: "rush",
      entropyBefore: rushAtZero.entropyBefore,
      entropyAfter: rushAtZero.entropyAfter,
      log: rushAtZero.log,
    });
    observations.gates.push({
      when: "bow-entropy1",
      dissipation: gateCheck(state, "dissipation_navigator_alpha"),
      relic: gateCheck(state, "port_relic_hold"),
    });

    const omega = fight(state, "dissipation_navigator_alpha", ["dissipation_navigator_alpha"]);
    state = omega.state;
    observations.steps.push({
      fight: "dissipation_navigator_alpha",
      rounds: omega.rounds,
      hpAfter: omega.hpAfter,
      entropy: lawCapture(state).lawData.entropy,
    });
    return observations;
  })();

  // Flow C enters the boss at entropy 4: the entropy locks into two collapse
  // layers that buff the boss and persist through and after the fight.
  const flowC = (() => {
    let state = hubState;
    const observations = {
      steps: [],
      helmsmanGateAtEntropy4: undefined,
      bossLawAtStart: undefined,
      bossDisplayAtStart: undefined,
      bossModifiersAtStart: undefined,
      bossFight: undefined,
      lockedHeading: undefined,
      lawAfterBoss: undefined,
      displayAfterBoss: undefined,
    };
    state = enterArk(state);
    const deckhand = fight(state, "entropy_deckhand", ["entropy_deckhand"]);
    state = deckhand.state;
    observations.steps.push({
      fight: "entropy_deckhand",
      rounds: deckhand.rounds,
      entropy: lawCapture(state).lawData.entropy,
    });
    const starboardDeckhand = fight(state, "entropy_deckhand_starboard", [
      "wake_inversion",
      "starboard_ballast_core",
      "entropy_deckhand_starboard",
    ]);
    state = starboardDeckhand.state;
    observations.steps.push({
      fight: "entropy_deckhand_starboard",
      rounds: starboardDeckhand.rounds,
      hpAfter: starboardDeckhand.hpAfter,
      entropy: lawCapture(state).lawData.entropy,
      display: lawCapture(state).display,
    });

    state = goto(state, ["starboard_ballast_core", "wake_inversion", "ark_manifest"]);
    observations.helmsmanGateAtEntropy4 = gateCheck(state, "last_helmsman");

    const soulTrap = counterTrap(state, "soul_recharge_chamber", ["soul_recharge_chamber"]);
    state = soulTrap.state;
    observations.steps.push({
      trap: "soul_recharge_chamber",
      entropyAfter: lawCapture(state).lawData.entropy,
    });

    state = goto(state, ["stern_heading_console", "last_helmsman"]);
    state = commit(state, { type: "run/select-node", nodeId: "last_helmsman" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-10 flow-c boss select did not enter combat");
    }
    observations.bossLawAtStart = lawCapture(state).lawData;
    observations.bossDisplayAtStart = lawCapture(state).display;
    observations.bossModifiersAtStart = lawCapture(state).modifiers;

    let bossRounds = 0;
    while (state.phase === "combat" && bossRounds < 200) {
      const action = state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `boss ${action} r${bossRounds}`);
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-10 flow-c boss combat did not resolve within 200 rounds");
    }
    observations.bossFight = {
      rounds: bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("last_helmsman"),
    };
    observations.lawAfterBoss = lawCapture(state).lawData;
    observations.displayAfterBoss = lawCapture(state).display;

    // After the lock the heading can no longer be specified.
    const locked = resolveHeading(state, "steady");
    observations.lockedHeading = {
      status: locked.status,
      code: locked.code,
      message: locked.message,
    };
    return observations;
  })();

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("entropy-heading-three-consoles");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-10 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-10 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-10 entry law data");
    equal(flowA.clears.length, expected.clears.length, "law-10 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      deepEqual(flowA.clears[index], expected.clears[index], `law-10 flow-a clear ${index}`);
    }
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-10 pending heading departure block");
    equal(flowA.headings.length, expected.headings.length, "law-10 heading count");
    for (let index = 0; index < expected.headings.length; index += 1) {
      deepEqual(flowA.headings[index], expected.headings[index], `law-10 heading ${index}`);
    }
    equal(flowA.gates.length, expected.gates.length, "law-10 flow-a gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowA.gates[index], expected.gates[index], `law-10 flow-a gate ${index}`);
    }
    deepEqual(flowA.final.display, expected.finalDisplay, "law-10 final display");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-10 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-10 roundtrip law data");
    results.push({
      id: "entropy-heading-three-consoles",
      status: "PASS",
      consoles: flowA.headings.map((heading) => heading.console),
      choices: flowA.headings.map((heading) => heading.choice),
      entropySequence: flowA.clears.map((clear) => clear.entropyAfter),
      roundtripStatus: flowA.roundtrip.status,
    });
  }

  {
    const expected = expectedById.get("entropy-threshold-route-gates");
    deepEqual(flowB.entry.display, expected.entryDisplay, "law-10 flow-b entry display");
    equal(flowB.steps.length, expected.steps.length, "law-10 flow-b step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowB.steps[index], expected.steps[index], `law-10 flow-b step ${index}`);
    }
    equal(flowB.gates.length, expected.gates.length, "law-10 flow-b gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowB.gates[index], expected.gates[index], `law-10 flow-b gate ${index}`);
    }
    deepEqual(flowB.closedMove, expected.closedMove, "law-10 closed gate move");
    deepEqual(flowB.modifiers, expected.modifiers, "law-10 threshold modifiers");
    deepEqual(flowB.pendingChoices, expected.pendingChoices, "law-10 threshold choice boundaries");
    results.push({
      id: "entropy-threshold-route-gates",
      status: "PASS",
      entropyFour: flowB.steps.find((step) => step.entropy === 4 && step.display)?.display.status,
      entropyZero: flowB.steps.find((step) => step.entropy === 0 && step.display)?.display.status,
      closedGateId: flowB.gates[0].dissipation.gateId,
      reopenedGateId: flowB.gates[1].dissipation.gateId,
    });
  }

  {
    const expected = expectedById.get("entropy-boss-collapse-layers");
    equal(flowC.steps.length, expected.steps.length, "law-10 flow-c step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowC.steps[index], expected.steps[index], `law-10 flow-c step ${index}`);
    }
    deepEqual(
      flowC.helmsmanGateAtEntropy4,
      expected.helmsmanGateAtEntropy4,
      "law-10 helmsman gate at entropy 4",
    );
    deepEqual(flowC.bossLawAtStart, expected.bossLawAtStart, "law-10 boss law at start");
    deepEqual(flowC.bossDisplayAtStart, expected.bossDisplayAtStart, "law-10 boss display at start");
    deepEqual(
      flowC.bossModifiersAtStart,
      expected.bossModifiersAtStart,
      "law-10 boss modifiers at start",
    );
    deepEqual(flowC.bossFight, expected.bossFight, "law-10 boss fight");
    deepEqual(flowC.lockedHeading, expected.lockedHeading, "law-10 heading after boss lock");
    deepEqual(flowC.lawAfterBoss, expected.lawAfterBoss, "law-10 law after boss");
    deepEqual(flowC.displayAfterBoss, expected.displayAfterBoss, "law-10 display after boss");
    results.push({
      id: "entropy-boss-collapse-layers",
      status: "PASS",
      collapseLayers: flowC.bossLawAtStart.collapseLayers,
      bossAllStatsPercent: flowC.bossModifiersAtStart.encounter.allStatsPercent,
      bossRounds: flowC.bossFight.rounds,
      layersKeptAfterBoss: flowC.lawAfterBoss.collapseLayers,
    });
  }

  {
    const expected = expectedById.get("entropy-repeat-boundary");
    equal(flowA.reselect.nodeId, expected.reselectedNodeId, "law-10 reselect node");
    equal(flowA.reselect.status, "rejected", "law-10 reselect status");
    equal(flowA.reselect.code, expected.rejectionCode, "law-10 reselect rejection code");
    equal(
      flowA.reselect.message,
      expected.rejectionMessage,
      "law-10 reselect rejection message",
    );
    equal(
      flowA.reselect.lawStateUnchanged,
      expected.lawStateUnchanged,
      "law-10 reselect law state unchanged",
    );
    equal(flowA.reselect.hpUnchanged, expected.hpUnchanged, "law-10 reselect hp unchanged");
    deepEqual(flowA.noPending, expected.noPendingResolve, "law-10 no-pending heading resolve");
    results.push({
      id: "entropy-repeat-boundary",
      status: "PASS",
      reselectedNodeId: flowA.reselect.nodeId,
      rejectionCode: flowA.reselect.code,
      noPendingCode: flowA.noPending.code,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law11Mirror({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-11 mirror legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-11 mirror legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-11 mirror decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-11 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-11 mirror law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
    };
  };
  const displayStatus = (state) => lawCapture(state).display;

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-11 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterCity = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "mirror_cycle_city",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter mirror_cycle_city",
    );

  const move = (state, nodeId) =>
    commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const fight = (state, nodeId, path = [], { heal = false } = {}) => {
    state = goto(state, path);
    const hpBefore = state.player.hp;
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-11 select ${nodeId} did not enter combat`);
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      const action = heal && state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      state = commit(state, { type: "combat/act", action }, `${action} r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-11 combat ${nodeId} did not resolve within 200 rounds`);
    }
    if (state.run.pendingEquipmentOffer) {
      state = commit(state, { type: "node/resolve-equipment-loot" }, "abandon elite loot");
    }
    return { state, rounds, hpBefore, hpAfter: state.player.hp };
  };
  const trapRisk = (state, nodeId, path = []) => {
    state = goto(state, path);
    const hpBefore = state.player.hp;
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
    return { state, nodeId, hpBefore, hpAfter: state.player.hp, log: state.log?.[0] };
  };
  const resolvePhase = (state, phase) => {
    const before = { hp: state.player.hp };
    const result = application.reduceGameCommand(state, {
      type: "law/resolve-mirror-city-phase",
      phase,
    });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      hpBefore: before.hp,
      hpAfter: after.player.hp,
      outgoingDamage: lawCapture(after).modifiers.outgoingDamage,
    };
  };
  const phaseChoices = (state) => {
    const status = core.getCurrentMirrorCityPhaseStatus(state);
    if (!status) throw new AcceptanceAssertionError("law-11 mirror phase status is undefined");
    const pick = (choice) => ({
      available: choice.available,
      phaseChanged: choice.phaseChanged,
      damagePercent: choice.damagePercent,
      ...(choice.available ? {} : { unavailableReason: choice.unavailableReason }),
    });
    return { real: pick(status.choices.real), mirror: pick(status.choices.mirror) };
  };
  const fightBoss = (state) => {
    state = commit(state, { type: "run/select-node", nodeId: "nameless_reflection" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-11 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state).lawData;
    const displayAtStart = displayStatus(state);
    const seenShellLines = new Set();
    const shellEvents = [];
    const attackDeltas = [];
    let bossRounds = 0;
    while (state.phase === "combat" && bossRounds < 200) {
      const action = state.player.hp < 70 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      const hpBefore = state.combat?.monsterHp;
      state = commit(state, { type: "combat/act", action }, `boss ${action} r${bossRounds}`);
      const hpAfter = state.combat?.monsterHp;
      for (const line of state.combat?.log ?? []) {
        if (line.includes("镜壳") && !seenShellLines.has(line)) {
          seenShellLines.add(line);
          shellEvents.push({
            round: bossRounds,
            log: line,
            monsterHpBefore: hpBefore,
            monsterHpAfter: hpAfter,
          });
        }
      }
      attackDeltas.push({
        round: bossRounds,
        action,
        delta: hpBefore !== undefined && hpAfter !== undefined ? hpBefore - hpAfter : null,
      });
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-11 boss combat did not resolve within 200 rounds");
    }
    return {
      state,
      lawAtStart,
      displayAtStart,
      bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("nameless_reflection"),
      shellEvents,
      attackDeltas,
      lawAfter: lawCapture(state).lawData,
      displayAfter: displayStatus(state),
    };
  };

  // Flow A walks all three phase mirrors: each clear opens a pending phase that
  // blocks departure, switching phases costs 10% max HP and flips the outgoing
  // damage modifiers, the phase gate opens/closes with the current phase, and a
  // codec round-trip preserves the resolved phase map.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      clears: [],
      departureBlock: undefined,
      gates: [],
      closedMove: undefined,
      final: undefined,
      bossGate: undefined,
      roundtrip: undefined,
      reselect: undefined,
      noPending: undefined,
    };
    state = enterCity(state);
    observations.entry = lawCapture(state);

    const spine = fight(state, "parallax_hunter_spine", ["parallax_hunter_spine"]);
    state = spine.state;
    observations.clears.push({
      kind: "monster",
      nodeId: "parallax_hunter_spine",
      rounds: spine.rounds,
      hpAfter: spine.hpAfter,
    });

    state = collect(state, "first_phase_mirror", ["second_phase_mirror", "real_anchor", "first_phase_mirror"]);
    observations.clears.push({
      kind: "mirror",
      nodeId: "first_phase_mirror",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingPhaseNodeId,
      display: displayStatus(state),
    });
    const departure = tryCommit(state, { type: "run/move", nodeId: "real_anchor" });
    observations.departureBlock = {
      status: departure.status,
      code: departure.code,
      message: departure.message,
      target: "real_anchor",
    };
    observations.gates.push({
      when: "first-mirror-real-phase",
      ...gateCheck(state, "real_relic_gallery"),
    });

    const firstResolve = resolvePhase(state, "mirror");
    state = firstResolve.state;
    observations.clears.push({
      kind: "resolve",
      console: "first_phase_mirror",
      phase: "mirror",
      hpBefore: firstResolve.hpBefore,
      hpAfter: firstResolve.hpAfter,
      log: firstResolve.log,
      status: firstResolve.status,
      outgoingDamage: firstResolve.outgoingDamage,
    });
    observations.gates.push({
      when: "first-mirror-mirror-phase",
      ...gateCheck(state, "real_relic_gallery"),
    });
    const closedMove = tryCommit(state, { type: "run/move", nodeId: "real_relic_gallery" });
    observations.closedMove = {
      target: "real_relic_gallery",
      status: closedMove.status,
      code: closedMove.code,
      message: closedMove.message,
    };

    state = collect(state, "second_phase_mirror", ["real_anchor", "second_phase_mirror"]);
    observations.clears.push({
      kind: "mirror",
      nodeId: "second_phase_mirror",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingPhaseNodeId,
      display: displayStatus(state),
    });
    const secondResolve = resolvePhase(state, "real");
    state = secondResolve.state;
    observations.clears.push({
      kind: "resolve",
      console: "second_phase_mirror",
      phase: "real",
      hpBefore: secondResolve.hpBefore,
      hpAfter: secondResolve.hpAfter,
      log: secondResolve.log,
      status: secondResolve.status,
      outgoingDamage: secondResolve.outgoingDamage,
    });

    const recharge = fight(state, "soul_recharge_mirror", ["cycle_manifest", "soul_recharge_mirror"]);
    state = recharge.state;
    observations.clears.push({
      kind: "monster",
      nodeId: "soul_recharge_mirror",
      rounds: recharge.rounds,
      hpAfter: recharge.hpAfter,
    });

    state = collect(state, "third_phase_mirror", ["third_phase_mirror"]);
    observations.clears.push({
      kind: "mirror",
      nodeId: "third_phase_mirror",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingPhaseNodeId,
      display: displayStatus(state),
    });
    const thirdResolve = resolvePhase(state, "real");
    state = thirdResolve.state;
    observations.clears.push({
      kind: "resolve",
      console: "third_phase_mirror",
      phase: "real",
      hpBefore: thirdResolve.hpBefore,
      hpAfter: thirdResolve.hpAfter,
      log: thirdResolve.log,
      status: thirdResolve.status,
      outgoingDamage: thirdResolve.outgoingDamage,
    });

    observations.final = lawCapture(state);
    observations.bossGate = gateCheck(state, "nameless_reflection");

    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    observations.roundtrip = {
      status: roundtrip.status,
      lawData: roundtrip.status === "decoded"
        ? core.getCurrentDungeonLaw(roundtrip.state).state.law
        : undefined,
    };

    const lawBeforeReselect = JSON.stringify(lawCapture(state).lawData);
    const hpBeforeReselect = state.player.hp;
    const reselect = application.reduceGameCommand(state, {
      type: "run/select-node",
      nodeId: "third_phase_mirror",
    });
    observations.reselect = {
      nodeId: "third_phase_mirror",
      status: reselect.status,
      code: reselect.reason?.code,
      message: reselect.reason?.message,
      lawStateUnchanged: lawBeforeReselect === JSON.stringify(lawCapture(state).lawData),
      hpUnchanged: hpBeforeReselect === state.player.hp,
    };
    const noPending = resolvePhase(state, "real");
    observations.noPending = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
    };
    return observations;
  })();

  // Flow B exercises the switching cost and its HP floor: a long grind drives
  // HP below the 10% switching cost while the third phase mirror is pending, so
  // the switching choice is refused while the same-phase choice still lands.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      entryMaxHp: undefined,
      steps: [],
      dualAnchorGate: undefined,
      lowHpPending: undefined,
      lowHpSwitchRejected: undefined,
      lowHpSamePhaseResolved: undefined,
    };
    state = enterCity(state);
    observations.entryMaxHp = state.player.maxHp;

    const spine = fight(state, "parallax_hunter_spine", ["parallax_hunter_spine"]);
    state = spine.state;
    observations.steps.push({ fight: "parallax_hunter_spine", rounds: spine.rounds, hpAfter: spine.hpAfter });

    state = collect(state, "first_phase_mirror", ["second_phase_mirror", "real_anchor", "first_phase_mirror"]);
    const firstResolve = resolvePhase(state, "real");
    state = firstResolve.state;
    observations.steps.push({
      resolve: "real",
      hpBefore: firstResolve.hpBefore,
      hpAfter: firstResolve.hpAfter,
      log: firstResolve.log,
    });

    state = collect(state, "real_anchor", ["real_anchor"]);
    observations.steps.push({ anchor: "real", anchors: lawCapture(state).lawData.anchors });

    const hunterReal = fight(state, "parallax_hunter_real", ["first_phase_mirror", "parallax_hunter_real"]);
    state = hunterReal.state;
    observations.steps.push({ fight: "parallax_hunter_real", rounds: hunterReal.rounds, hpAfter: hunterReal.hpAfter });

    const chorusReal = fight(state, "mirror_chorus_real", ["mirror_chorus_real"]);
    state = chorusReal.state;
    observations.steps.push({ fight: "mirror_chorus_real", rounds: chorusReal.rounds, hpAfter: chorusReal.hpAfter });

    const shardRain = trapRisk(state, "shard_rain_trap", ["real_anchor", "first_phase_mirror", "real_relic_gallery", "shard_rain_trap"]);
    state = shardRain.state;
    observations.steps.push({ trap: "shard_rain_trap", hpBefore: shardRain.hpBefore, hpAfter: shardRain.hpAfter, log: shardRain.log });

    const chorusUpper = fight(state, "mirror_chorus_upper", ["upper_return_portal", "mirror_chorus_upper"]);
    state = chorusUpper.state;
    observations.steps.push({ fight: "mirror_chorus_upper", rounds: chorusUpper.rounds, hpAfter: chorusUpper.hpAfter });

    const bossSide = trapRisk(state, "boss_side_trap", ["boss_side_trap"]);
    state = bossSide.state;
    observations.steps.push({ trap: "boss_side_trap", hpBefore: bossSide.hpBefore, hpAfter: bossSide.hpAfter, log: bossSide.log });

    state = goto(state, ["mirror_chorus_upper", "upper_return_portal", "shard_rain_trap", "real_relic_gallery", "first_phase_mirror", "real_anchor", "second_phase_mirror"]);
    state = collect(state, "second_phase_mirror");
    const switchResolve = resolvePhase(state, "mirror");
    state = switchResolve.state;
    observations.steps.push({
      resolve: "mirror",
      hpBefore: switchResolve.hpBefore,
      hpAfter: switchResolve.hpAfter,
      log: switchResolve.log,
    });

    state = collect(state, "mirror_anchor", ["mirror_anchor"]);
    observations.steps.push({
      anchor: "mirror",
      anchors: lawCapture(state).lawData.anchors,
      display: displayStatus(state).status,
    });

    const chorusMirror = fight(state, "mirror_chorus_mirror", ["mirror_chorus_mirror"]);
    state = chorusMirror.state;
    observations.steps.push({ fight: "mirror_chorus_mirror", rounds: chorusMirror.rounds, hpAfter: chorusMirror.hpAfter });

    const hunterMirror = fight(state, "parallax_hunter_mirror", ["mirror_supply_alcove", "mirror_clue_vault", "parallax_hunter_mirror"]);
    state = hunterMirror.state;
    observations.steps.push({ fight: "parallax_hunter_mirror", rounds: hunterMirror.rounds, hpAfter: hunterMirror.hpAfter });

    state = goto(state, ["mirror_clue_vault", "mirror_supply_alcove", "mirror_chorus_mirror", "mirror_anchor", "second_phase_mirror", "cycle_manifest"]);
    observations.dualAnchorGate = gateCheck(state, "mirror_city_survey");

    const parallaxTrap = trapRisk(state, "parallax_corridor_trap", ["mirror_city_survey", "parallax_corridor_trap"]);
    state = parallaxTrap.state;
    observations.steps.push({ trap: "parallax_corridor_trap", hpBefore: parallaxTrap.hpBefore, hpAfter: parallaxTrap.hpAfter, log: parallaxTrap.log });

    state = goto(state, ["mirror_city_survey", "cycle_manifest", "second_phase_mirror", "mirror_anchor", "reflection_event_stage", "mirror_relic_gallery", "identity_fracture_trap"]);
    const identityTrap = trapRisk(state, "identity_fracture_trap");
    state = identityTrap.state;
    observations.steps.push({ trap: "identity_fracture_trap", hpBefore: identityTrap.hpBefore, hpAfter: identityTrap.hpAfter, log: identityTrap.log });

    state = goto(state, ["third_phase_mirror"]);
    state = collect(state, "third_phase_mirror");
    observations.lowHpPending = {
      nodeId: "third_phase_mirror",
      hp: state.player.hp,
      choices: phaseChoices(state),
    };
    const lowHpSwitch = resolvePhase(state, "real");
    observations.lowHpSwitchRejected = {
      status: lowHpSwitch.status,
      code: lowHpSwitch.code,
      message: lowHpSwitch.message,
    };
    const lowHpSame = resolvePhase(state, "mirror");
    state = lowHpSame.state;
    observations.lowHpSamePhaseResolved = {
      status: lowHpSame.status,
      hpBefore: lowHpSame.hpBefore,
      hpAfter: lowHpSame.hpAfter,
      log: lowHpSame.log,
    };
    return observations;
  })();

  // Flow C covers anchor production and the anchor gates: clearing an anchor in
  // the wrong phase leaves it dark, clearing it in the right phase lights it,
  // and the real/mirror/dual-anchor gates plus the boss gate follow.
  const flowC = (() => {
    let state = hubState;
    const observations = { steps: [], gates: [] };
    state = enterCity(state);

    const spine = fight(state, "parallax_hunter_spine", ["parallax_hunter_spine"]);
    state = spine.state;
    observations.steps.push({ fight: "parallax_hunter_spine", rounds: spine.rounds, hpAfter: spine.hpAfter });

    // Clearing the mirror anchor while in real phase does not light it.
    state = collect(state, "mirror_anchor", ["second_phase_mirror", "mirror_anchor"]);
    observations.steps.push({
      anchor: "mirror_anchor",
      phase: "real",
      anchors: lawCapture(state).lawData.anchors,
      display: displayStatus(state).status,
    });
    observations.gates.push({ when: "mirror-anchor-dark", ...gateCheck(state, "soul_recharge_mirror") });

    state = collect(state, "first_phase_mirror", ["second_phase_mirror", "real_anchor", "first_phase_mirror"]);
    const toMirror = resolvePhase(state, "mirror");
    state = toMirror.state;
    observations.steps.push({ resolve: "mirror", hpBefore: toMirror.hpBefore, hpAfter: toMirror.hpAfter, log: toMirror.log });

    state = collect(state, "second_phase_mirror", ["real_anchor", "second_phase_mirror"]);
    const toReal = resolvePhase(state, "real");
    state = toReal.state;
    observations.steps.push({ resolve: "real", hpBefore: toReal.hpBefore, hpAfter: toReal.hpAfter, log: toReal.log });

    // Clearing the real anchor while in real phase lights it.
    state = collect(state, "real_anchor", ["real_anchor"]);
    observations.steps.push({
      anchor: "real_anchor",
      phase: "real",
      anchors: lawCapture(state).lawData.anchors,
      display: displayStatus(state).status,
    });
    observations.gates.push({ when: "real-anchor-lit", ...gateCheck(state, "mirror_city_survey") });

    state = goto(state, ["second_phase_mirror", "cycle_manifest"]);
    observations.gates.push({ when: "dual-anchor-single-lit", ...gateCheck(state, "mirror_city_survey") });
    observations.gates.push({ when: "boss-two-choices", ...gateCheck(state, "nameless_reflection") });

    const recharge = fight(state, "soul_recharge_mirror", ["soul_recharge_mirror"]);
    state = recharge.state;
    observations.steps.push({ fight: "soul_recharge_mirror", rounds: recharge.rounds, hpAfter: recharge.hpAfter });

    state = goto(state, ["third_phase_mirror"]);
    state = collect(state, "third_phase_mirror");
    const thirdResolve = resolvePhase(state, "real");
    state = thirdResolve.state;
    observations.steps.push({ resolve: "real", hpBefore: thirdResolve.hpBefore, hpAfter: thirdResolve.hpAfter, log: thirdResolve.log });

    state = goto(state, ["soul_recharge_mirror", "cycle_manifest"]);
    observations.gates.push({ when: "boss-three-choices", ...gateCheck(state, "nameless_reflection") });
    return observations;
  })();

  // Flow D enters the boss with no anchors lit: the snapshot mints two mirror
  // shells, the first two damaging hits are halved, and the shells stay broken
  // through and after the fight.
  const flowD = (() => {
    let state = hubState;
    const observations = {
      steps: [],
      bossLawAtStart: undefined,
      bossDisplayAtStart: undefined,
      shellConsumption: undefined,
      halvedDamage: undefined,
      fullDamage: undefined,
      bossFight: undefined,
      lawAfterBoss: undefined,
      displayAfterBoss: undefined,
      resolveAfterBoss: undefined,
      roundtrip: undefined,
    };
    state = enterCity(state);

    const spine = fight(state, "parallax_hunter_spine", ["parallax_hunter_spine"]);
    state = spine.state;
    observations.steps.push({ fight: "parallax_hunter_spine", rounds: spine.rounds, hpAfter: spine.hpAfter });

    state = collect(state, "first_phase_mirror", ["second_phase_mirror", "real_anchor", "first_phase_mirror"]);
    const toMirror = resolvePhase(state, "mirror");
    state = toMirror.state;
    observations.steps.push({ resolve: "mirror", hpBefore: toMirror.hpBefore, hpAfter: toMirror.hpAfter, log: toMirror.log });

    state = collect(state, "second_phase_mirror", ["real_anchor", "second_phase_mirror"]);
    const toReal = resolvePhase(state, "real");
    state = toReal.state;
    observations.steps.push({ resolve: "real", hpBefore: toReal.hpBefore, hpAfter: toReal.hpAfter, log: toReal.log });

    const recharge = fight(state, "soul_recharge_mirror", ["cycle_manifest", "soul_recharge_mirror"]);
    state = recharge.state;
    observations.steps.push({ fight: "soul_recharge_mirror", rounds: recharge.rounds, hpAfter: recharge.hpAfter });

    state = collect(state, "third_phase_mirror", ["third_phase_mirror"]);
    const samePhase = resolvePhase(state, "real");
    state = samePhase.state;
    observations.steps.push({ resolve: "real", hpBefore: samePhase.hpBefore, hpAfter: samePhase.hpAfter, log: samePhase.log });

    state = goto(state, ["soul_recharge_mirror", "cycle_manifest", "nameless_reflection"]);
    const boss = fightBoss(state);
    state = boss.state;
    observations.bossLawAtStart = boss.lawAtStart;
    observations.bossDisplayAtStart = boss.displayAtStart;
    observations.shellConsumption = boss.shellEvents;
    observations.halvedDamage = boss.attackDeltas[0]?.delta;
    observations.fullDamage = boss.attackDeltas[2]?.delta;
    observations.bossFight = { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared };
    observations.lawAfterBoss = {
      kind: boss.lawAfter.kind,
      bossAnchorSnapshot: boss.lawAfter.bossAnchorSnapshot,
      brokenMirrorShells: boss.lawAfter.brokenMirrorShells,
    };
    observations.displayAfterBoss = boss.displayAfter;

    const afterBoss = resolvePhase(state, "mirror");
    observations.resolveAfterBoss = {
      status: afterBoss.status,
      code: afterBoss.code,
      message: afterBoss.message,
    };

    const roundtrip = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    observations.roundtrip = {
      status: roundtrip.status,
      bossAnchorSnapshot: roundtrip.status === "decoded"
        ? core.getCurrentDungeonLaw(roundtrip.state).state.law.bossAnchorSnapshot
        : undefined,
      brokenMirrorShells: roundtrip.status === "decoded"
        ? core.getCurrentDungeonLaw(roundtrip.state).state.law.brokenMirrorShells
        : undefined,
    };
    return observations;
  })();

  // Flow E lights exactly one anchor before the boss: the snapshot mints a
  // single mirror shell, so only the first damaging hit is halved.
  const flowE = (() => {
    let state = hubState;
    const observations = {
      steps: [],
      displayBeforeBoss: undefined,
      bossLawAtStart: undefined,
      bossDisplayAtStart: undefined,
      shellConsumption: undefined,
      halvedDamage: undefined,
      fullDamage: undefined,
      bossFight: undefined,
      lawAfterBoss: undefined,
      displayAfterBoss: undefined,
    };
    state = enterCity(state);

    const spine = fight(state, "parallax_hunter_spine", ["parallax_hunter_spine"]);
    state = spine.state;
    observations.steps.push({ fight: "parallax_hunter_spine", rounds: spine.rounds, hpAfter: spine.hpAfter });

    state = collect(state, "first_phase_mirror", ["second_phase_mirror", "real_anchor", "first_phase_mirror"]);
    const firstResolve = resolvePhase(state, "real");
    state = firstResolve.state;
    observations.steps.push({ resolve: "real", hpBefore: firstResolve.hpBefore, hpAfter: firstResolve.hpAfter, log: firstResolve.log });

    state = collect(state, "real_anchor", ["real_anchor"]);
    observations.steps.push({ anchor: "real_anchor", anchors: lawCapture(state).lawData.anchors });

    state = collect(state, "second_phase_mirror", ["second_phase_mirror"]);
    const secondResolve = resolvePhase(state, "real");
    state = secondResolve.state;
    observations.steps.push({ resolve: "real", hpBefore: secondResolve.hpBefore, hpAfter: secondResolve.hpAfter, log: secondResolve.log });

    const recharge = fight(state, "soul_recharge_mirror", ["cycle_manifest", "soul_recharge_mirror"]);
    state = recharge.state;
    observations.steps.push({ fight: "soul_recharge_mirror", rounds: recharge.rounds, hpAfter: recharge.hpAfter });

    state = goto(state, ["third_phase_mirror"]);
    state = collect(state, "third_phase_mirror");
    const thirdResolve = resolvePhase(state, "real");
    state = thirdResolve.state;
    observations.steps.push({ resolve: "real", hpBefore: thirdResolve.hpBefore, hpAfter: thirdResolve.hpAfter, log: thirdResolve.log });

    observations.displayBeforeBoss = displayStatus(state).status;
    state = goto(state, ["soul_recharge_mirror", "cycle_manifest", "nameless_reflection"]);
    const boss = fightBoss(state);
    state = boss.state;
    observations.bossLawAtStart = {
      bossAnchorSnapshot: boss.lawAtStart.bossAnchorSnapshot,
      brokenMirrorShells: boss.lawAtStart.brokenMirrorShells,
    };
    observations.bossDisplayAtStart = boss.displayAtStart;
    observations.shellConsumption = boss.shellEvents;
    observations.halvedDamage = boss.attackDeltas[0]?.delta;
    observations.fullDamage = boss.attackDeltas[1]?.delta;
    observations.bossFight = { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared };
    observations.lawAfterBoss = {
      bossAnchorSnapshot: boss.lawAfter.bossAnchorSnapshot,
      brokenMirrorShells: boss.lawAfter.brokenMirrorShells,
    };
    observations.displayAfterBoss = boss.displayAfter;
    return observations;
  })();

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const results = [];

  {
    const expected = expectedById.get("mirror-phase-three-mirrors");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-11 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-11 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-11 entry law data");
    equal(flowA.clears.length, expected.clears.length, "law-11 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      deepEqual(flowA.clears[index], expected.clears[index], `law-11 flow-a clear ${index}`);
    }
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-11 pending phase departure block");
    equal(flowA.gates.length, expected.gates.length, "law-11 flow-a gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowA.gates[index], expected.gates[index], `law-11 flow-a gate ${index}`);
    }
    deepEqual(flowA.closedMove, expected.closedMove, "law-11 closed gate move");
    deepEqual(flowA.final.display, expected.finalDisplay, "law-11 final display");
    deepEqual(flowA.bossGate, expected.bossGateOpen, "law-11 boss gate after all choices");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-11 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-11 roundtrip law data");
    equal(flowA.reselect.nodeId, expected.reselect.nodeId, "law-11 reselect node");
    equal(flowA.reselect.status, expected.reselect.status, "law-11 reselect status");
    equal(flowA.reselect.code, expected.reselect.code, "law-11 reselect rejection code");
    equal(flowA.reselect.message, expected.reselect.message, "law-11 reselect rejection message");
    equal(flowA.reselect.lawStateUnchanged, true, "law-11 reselect law state unchanged");
    equal(flowA.reselect.hpUnchanged, true, "law-11 reselect hp unchanged");
    deepEqual(flowA.noPending, expected.noPendingResolve, "law-11 no-pending phase resolve");
    results.push({
      id: "mirror-phase-three-mirrors",
      status: "PASS",
      mirrors: flowA.clears.filter((clear) => clear.kind === "mirror").map((clear) => clear.nodeId),
      choices: flowA.clears.filter((clear) => clear.kind === "resolve").map((clear) => clear.phase),
      switchCost: flowA.clears.find((clear) => clear.kind === "resolve" && clear.hpBefore !== clear.hpAfter)
        ? flowA.clears.find((clear) => clear.kind === "resolve" && clear.hpBefore !== clear.hpAfter).hpBefore
          - flowA.clears.find((clear) => clear.kind === "resolve" && clear.hpBefore !== clear.hpAfter).hpAfter
        : 0,
      roundtripStatus: flowA.roundtrip.status,
    });
  }

  {
    const expected = expectedById.get("mirror-phase-switch-cost");
    equal(flowB.entryMaxHp, expected.entryMaxHp, "law-11 flow-b entry max hp");
    equal(flowB.steps.length, expected.steps.length, "law-11 flow-b step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowB.steps[index], expected.steps[index], `law-11 flow-b step ${index}`);
    }
    const switchStep = flowB.steps.find((step) => step.resolve === "mirror");
    equal(
      switchStep.hpBefore - switchStep.hpAfter,
      expected.switchCost,
      "law-11 flow-b switch cost",
    );
    deepEqual(flowB.dualAnchorGate, expected.dualAnchorGate, "law-11 flow-b dual anchor gate");
    deepEqual(flowB.lowHpPending, expected.lowHpPending, "law-11 low-hp pending choices");
    deepEqual(flowB.lowHpSwitchRejected, expected.lowHpSwitchRejected, "law-11 low-hp switch rejected");
    deepEqual(flowB.lowHpSamePhaseResolved, expected.lowHpSamePhaseResolved, "law-11 low-hp same-phase resolved");
    results.push({
      id: "mirror-phase-switch-cost",
      status: "PASS",
      entryMaxHp: flowB.entryMaxHp,
      switchCost: expected.switchCost,
      lowHp: flowB.lowHpPending.hp,
      switchRejectedCode: flowB.lowHpSwitchRejected.code,
    });
  }

  {
    const expected = expectedById.get("mirror-anchor-gates");
    equal(flowC.steps.length, expected.steps.length, "law-11 flow-c step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowC.steps[index], expected.steps[index], `law-11 flow-c step ${index}`);
    }
    equal(flowC.gates.length, expected.gates.length, "law-11 flow-c gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowC.gates[index], expected.gates[index], `law-11 flow-c gate ${index}`);
    }
    results.push({
      id: "mirror-anchor-gates",
      status: "PASS",
      anchorsLit: flowC.steps.filter((step) => step.anchor).map((step) => step.anchor),
      verifiedGates: flowC.gates.map((gate) => gate.gateId),
    });
  }

  {
    const expected = expectedById.get("mirror-shell-boss");
    equal(flowD.steps.length, expected.steps.length, "law-11 flow-d step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowD.steps[index], expected.steps[index], `law-11 flow-d step ${index}`);
    }
    deepEqual(flowD.bossLawAtStart, expected.bossLawAtStart, "law-11 boss law at start");
    deepEqual(flowD.bossDisplayAtStart, expected.bossDisplayAtStart, "law-11 boss display at start");
    deepEqual(flowD.shellConsumption, expected.shellConsumption, "law-11 shell consumption");
    equal(flowD.halvedDamage, expected.halvedDamage, "law-11 halved shell damage");
    equal(flowD.fullDamage, expected.fullDamage, "law-11 full damage after shells");
    deepEqual(flowD.bossFight, expected.bossFight, "law-11 boss fight");
    deepEqual(flowD.lawAfterBoss, expected.lawAfterBoss, "law-11 law after boss");
    deepEqual(flowD.displayAfterBoss, expected.displayAfterBoss, "law-11 display after boss");
    deepEqual(flowD.resolveAfterBoss, expected.resolveAfterBoss, "law-11 resolve after boss");
    equal(flowD.roundtrip.status, expected.roundtrip.status, "law-11 flow-d roundtrip status");
    deepEqual(
      { bossAnchorSnapshot: flowD.roundtrip.bossAnchorSnapshot, brokenMirrorShells: flowD.roundtrip.brokenMirrorShells },
      {
        bossAnchorSnapshot: expected.roundtrip.bossAnchorSnapshot,
        brokenMirrorShells: expected.roundtrip.brokenMirrorShells,
      },
      "law-11 flow-d roundtrip law fields",
    );
    results.push({
      id: "mirror-shell-boss",
      status: "PASS",
      shellsAtStart: flowD.bossLawAtStart.bossAnchorSnapshot
        ? 2 - Number(flowD.bossLawAtStart.bossAnchorSnapshot.real) - Number(flowD.bossLawAtStart.bossAnchorSnapshot.mirror)
        : 0,
      shellConsumptionRounds: flowD.shellConsumption.map((event) => event.round),
      halvedDamage: flowD.halvedDamage,
      fullDamage: flowD.fullDamage,
      bossRounds: flowD.bossFight.rounds,
    });
  }

  {
    const expected = expectedById.get("mirror-shell-anchor-count");
    equal(flowE.steps.length, expected.steps.length, "law-11 flow-e step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowE.steps[index], expected.steps[index], `law-11 flow-e step ${index}`);
    }
    equal(flowE.displayBeforeBoss, expected.displayBeforeBoss, "law-11 flow-e display before boss");
    deepEqual(flowE.bossLawAtStart, expected.bossLawAtStart, "law-11 flow-e boss law at start");
    deepEqual(flowE.bossDisplayAtStart, expected.bossDisplayAtStart, "law-11 flow-e boss display at start");
    deepEqual(flowE.shellConsumption, expected.shellConsumption, "law-11 flow-e shell consumption");
    equal(flowE.halvedDamage, expected.halvedDamage, "law-11 flow-e halved damage");
    equal(flowE.fullDamage, expected.fullDamage, "law-11 flow-e full damage");
    deepEqual(flowE.bossFight, expected.bossFight, "law-11 flow-e boss fight");
    deepEqual(flowE.lawAfterBoss, expected.lawAfterBoss, "law-11 flow-e law after boss");
    deepEqual(flowE.displayAfterBoss, expected.displayAfterBoss, "law-11 flow-e display after boss");
    results.push({
      id: "mirror-shell-anchor-count",
      status: "PASS",
      anchoredPhases: 1,
      shellsAtStart: 1,
      shellConsumptionRounds: flowE.shellConsumption.map((event) => event.round),
      halvedDamage: flowE.halvedDamage,
      fullDamage: flowE.fullDamage,
      bossRounds: flowE.bossFight.rounds,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law12Redaction({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-12 redaction legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-12 redaction legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-12 redaction decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-12 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-12 redaction law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
      redaction: law.display.redaction,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-12 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterScriptorium = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "redaction_scriptorium",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter redaction_scriptorium",
    );

  const move = (state, nodeId) =>
    commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const fight = (state, nodeId, path = []) => {
    state = goto(state, path);
    const hpBefore = state.player.hp;
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-12 select ${nodeId} did not enter combat`);
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-12 combat ${nodeId} did not resolve within 200 rounds`);
    }
    if (state.run.pendingEquipmentOffer) {
      state = commit(state, { type: "node/resolve-equipment-loot" }, "abandon elite loot");
    }
    return { state, rounds, hpBefore, hpAfter: state.player.hp };
  };
  const resolveClause = (state, choice) => {
    const before = { hp: state.player.hp };
    const result = application.reduceGameCommand(state, {
      type: "law/resolve-redaction-clause",
      choice,
    });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      hpBefore: before.hp,
      hpAfter: after.player.hp,
    };
  };
  const fightBoss = (state) => {
    state = move(state, "last_redactor");
    state = commit(state, { type: "run/select-node", nodeId: "last_redactor" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-12 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    const healEvents = [];
    let bossRounds = 0;
    let awakenedSeen = false;
    let modifiersAfterAwaken = null;
    while (state.phase === "combat" && bossRounds < 200) {
      const action = state.player.hp < 350 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      const hpBefore = state.player.hp;
      const pillsBefore = state.inventory.healing_pill;
      state = commit(state, { type: "combat/act", action }, `boss ${action} r${bossRounds}`);
      if (action === "use_healing_pill") {
        const healLine = (state.combat?.log ?? []).find((line) => line.includes("止血丹"));
        healEvents.push({
          round: bossRounds,
          hpBefore,
          hpAfter: state.player.hp,
          healLine,
          pillsBefore,
          pillsAfter: state.inventory.healing_pill,
        });
      }
      if (state.combat?.bossPhase === "awakened" && !awakenedSeen) {
        awakenedSeen = true;
        modifiersAfterAwaken = lawCapture(state).modifiers;
      }
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-12 boss combat did not resolve within 200 rounds");
    }
    return {
      state,
      lawAtStart,
      bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("last_redactor"),
      healEvents,
      modifiersAfterAwaken,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    return { status: rt.status, lawData: rtLaw.state.law, displayStatus: rtLaw.display.status };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const results = [];

  // Flow A walks all three clause desks: each clear opens a pending clause that
  // blocks departure, certify costs no HP, redact costs 8% max HP, and a codec
  // round-trip preserves the resolved clause map.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      clears: [],
      departureBlock: undefined,
      resolves: [],
      final: undefined,
      noPendingResolve: undefined,
      reselectCleared: undefined,
      roundtrip: undefined,
    };
    state = enterScriptorium(state);
    observations.entry = lawCapture(state);

    const spine = fight(state, "margin_scribe_spine", ["margin_scribe_spine"]);
    state = spine.state;
    observations.clears.push({
      kind: "monster",
      nodeId: "margin_scribe_spine",
      rounds: spine.rounds,
      hpAfter: spine.hpAfter,
    });

    state = collect(state, "memory_clause_desk", ["memory_clause_desk"]);
    observations.clears.push({
      kind: "desk",
      nodeId: "memory_clause_desk",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingClauseNodeId,
      display: lawCapture(state).display,
    });
    const departure = tryCommit(state, { type: "run/move", nodeId: "final_proof_nexus" });
    observations.departureBlock = {
      status: departure.status,
      code: departure.code,
      message: departure.message,
      target: "final_proof_nexus",
    };
    const cert1 = resolveClause(state, "certify");
    state = cert1.state;
    observations.resolves.push({
      desk: "memory_clause_desk",
      choice: "certify",
      status: cert1.status,
      log: cert1.log,
      hpBefore: cert1.hpBefore,
      hpAfter: cert1.hpAfter,
      display: lawCapture(state).display,
      redaction: lawCapture(state).redaction,
    });

    state = collect(state, "body_clause_desk", ["margin_scribe_spine", "body_clause_desk"]);
    observations.clears.push({
      kind: "desk",
      nodeId: "body_clause_desk",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingClauseNodeId,
      display: lawCapture(state).display,
    });
    const red1 = resolveClause(state, "redact");
    state = red1.state;
    observations.resolves.push({
      desk: "body_clause_desk",
      choice: "redact",
      status: red1.status,
      log: red1.log,
      hpBefore: red1.hpBefore,
      hpAfter: red1.hpAfter,
      display: lawCapture(state).display,
      redaction: lawCapture(state).redaction,
    });

    state = collect(state, "return_clause_desk", ["margin_scribe_spine", "return_clause_desk"]);
    observations.clears.push({
      kind: "desk",
      nodeId: "return_clause_desk",
      hpAfter: state.player.hp,
      pending: lawCapture(state).lawData.pendingClauseNodeId,
      display: lawCapture(state).display,
    });
    const cert2 = resolveClause(state, "certify");
    state = cert2.state;
    observations.resolves.push({
      desk: "return_clause_desk",
      choice: "certify",
      status: cert2.status,
      log: cert2.log,
      hpBefore: cert2.hpBefore,
      hpAfter: cert2.hpAfter,
      display: lawCapture(state).display,
      redaction: lawCapture(state).redaction,
    });

    observations.final = lawCapture(state);
    const noPending = resolveClause(state, "certify");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
    };
    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "return_clause_desk" });
    observations.reselectCleared = {
      status: reselect.status,
      code: reselect.code,
      message: reselect.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  // Flow B verifies the sector gates: a certified clause opens its sector while a
  // redacted clause closes it permanently, and the boss gate needs all three resolved.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      spine: undefined,
      gates: [],
      illegalMoves: [],
      traversal: undefined,
      bossGate: undefined,
    };
    state = enterScriptorium(state);
    const spine = fight(state, "margin_scribe_spine", ["margin_scribe_spine"]);
    state = spine.state;
    observations.spine = { rounds: spine.rounds, hpAfter: spine.hpAfter };

    state = goto(state, ["folio_gate", "upper_supply_margin", "body_clause_desk", "north_clue_cache"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north_clue_cache");
    observations.gates.push({
      when: "memory-before-certify",
      ...gateCheck(state, "memory_survey_archive"),
    });
    const illegal1 = tryCommit(state, { type: "run/move", nodeId: "memory_survey_archive" });
    observations.illegalMoves.push({
      target: "memory_survey_archive",
      status: illegal1.status,
      code: illegal1.code,
      message: illegal1.message,
    });

    state = goto(state, ["body_clause_desk", "margin_scribe_spine", "memory_clause_desk"]);
    state = commit(state, { type: "node/collect-reward" }, "collect memory desk");
    state = resolveClause(state, "certify").state;
    state = goto(state, ["margin_scribe_spine", "body_clause_desk", "north_clue_cache"]);
    observations.gates.push({
      when: "memory-after-certify",
      ...gateCheck(state, "memory_survey_archive"),
    });
    state = move(state, "memory_survey_archive");
    state = commit(state, { type: "node/collect-reward" }, "collect memory_survey_archive");
    observations.traversal = {
      target: "memory_survey_archive",
      status: "committed",
      hpAfter: state.player.hp,
    };

    state = goto(state, ["upper_supply_margin", "folio_gate", "lower_supply_margin", "return_clause_desk"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return desk");
    state = resolveClause(state, "redact").state;
    state = goto(state, ["south_clue_cache"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south_clue_cache");
    observations.gates.push({
      when: "return-after-redact",
      ...gateCheck(state, "return_revision_portal"),
    });
    const illegal2 = tryCommit(state, { type: "run/move", nodeId: "return_revision_portal" });
    observations.illegalMoves.push({
      target: "return_revision_portal",
      status: illegal2.status,
      code: illegal2.code,
      message: illegal2.message,
    });

    state = goto(state, [
      "return_clause_desk",
      "lower_supply_margin",
      "folio_gate",
      "margin_scribe_spine",
      "body_clause_desk",
    ]);
    state = commit(state, { type: "node/collect-reward" }, "collect body desk");
    state = resolveClause(state, "certify").state;
    state = goto(state, ["margin_scribe_spine", "memory_clause_desk", "final_proof_nexus"]);
    observations.bossGate = {
      when: "all-resolved",
      ...gateCheck(state, "last_redactor"),
    };
    return observations;
  })();

  // Flow C certifies all three clauses, then starts the boss: the snapshot is
  // minted and locked, the boss gains the certified modifiers, and healing is
  // reduced during the awakened phase.
  const flowC = (() => {
    let state = hubState;
    const observations = {
      spine: undefined,
      boss: undefined,
      resolveAfterBoss: undefined,
      roundtrip: undefined,
    };
    state = enterScriptorium(state);
    const spine = fight(state, "margin_scribe_spine", ["margin_scribe_spine"]);
    state = spine.state;
    observations.spine = { rounds: spine.rounds, hpAfter: spine.hpAfter };

    state = goto(state, ["memory_clause_desk"]);
    state = commit(state, { type: "node/collect-reward" }, "collect memory desk");
    state = resolveClause(state, "certify").state;
    state = goto(state, ["margin_scribe_spine", "body_clause_desk"]);
    state = commit(state, { type: "node/collect-reward" }, "collect body desk");
    state = resolveClause(state, "certify").state;
    state = goto(state, ["margin_scribe_spine", "return_clause_desk"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return desk");
    state = resolveClause(state, "certify").state;
    state = goto(state, ["margin_scribe_spine", "memory_clause_desk", "final_proof_nexus"]);

    const boss = fightBoss(state);
    state = boss.state;
    observations.boss = {
      lawAtStart: boss.lawAtStart.lawData,
      displayAtStart: boss.lawAtStart.display,
      modifiersAtStart: boss.lawAtStart.modifiers,
      modifiersAfterAwaken: boss.modifiersAfterAwaken,
      healEvents: boss.healEvents,
      bossFight: { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared },
    };
    const after = resolveClause(state, "certify");
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  // Flow D redacts all three clauses (paying 8% max HP each), then starts the
  // boss: the snapshot carries the redacted choices, no boss modifiers apply, and
  // healing pills restore the full 36 points.
  const flowD = (() => {
    let state = hubState;
    const observations = { spine: undefined, redacts: [], boss: undefined };
    state = enterScriptorium(state);
    const spine = fight(state, "margin_scribe_spine", ["margin_scribe_spine"]);
    state = spine.state;
    observations.spine = { rounds: spine.rounds, hpAfter: spine.hpAfter };

    for (const [desk, path] of [
      ["memory_clause_desk", ["memory_clause_desk"]],
      ["body_clause_desk", ["margin_scribe_spine", "body_clause_desk"]],
      ["return_clause_desk", ["margin_scribe_spine", "return_clause_desk"]],
    ]) {
      state = goto(state, path);
      state = commit(state, { type: "node/collect-reward" }, `collect ${desk}`);
      const before = state.player.hp;
      state = resolveClause(state, "redact").state;
      observations.redacts.push({
        desk,
        hpBefore: before,
        hpAfter: state.player.hp,
        log: state.log?.[0],
      });
    }
    state = goto(state, ["margin_scribe_spine", "memory_clause_desk", "final_proof_nexus"]);

    const boss = fightBoss(state);
    state = boss.state;
    observations.boss = {
      lawAtStart: boss.lawAtStart.lawData,
      displayAtStart: boss.lawAtStart.display,
      modifiersAtStart: boss.lawAtStart.modifiers,
      modifiersAfterAwaken: boss.modifiersAfterAwaken,
      healEvents: boss.healEvents,
      bossFight: { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared },
    };
    return observations;
  })();

  {
    const expected = expectedById.get("redaction-clause-certify-redact");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-12 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-12 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-12 entry law data");
    deepEqual(flowA.entry.redaction, expected.entryRedaction, "law-12 entry redaction");
    equal(flowA.clears.length, expected.clears.length, "law-12 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      deepEqual(flowA.clears[index], expected.clears[index], `law-12 flow-a clear ${index}`);
    }
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-12 pending departure block");
    equal(flowA.resolves.length, expected.resolves.length, "law-12 flow-a resolve count");
    for (let index = 0; index < expected.resolves.length; index += 1) {
      deepEqual(flowA.resolves[index], expected.resolves[index], `law-12 flow-a resolve ${index}`);
    }
    deepEqual(flowA.final.display, expected.finalDisplay, "law-12 final display");
    deepEqual(flowA.final.lawData, expected.finalLawData, "law-12 final law data");
    deepEqual(flowA.noPendingResolve, expected.noPendingResolve, "law-12 no-pending resolve");
    deepEqual(flowA.reselectCleared, expected.reselectCleared, "law-12 reselect cleared desk");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-12 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-12 roundtrip law data");
    equal(
      flowA.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-12 roundtrip display status",
    );
    results.push({
      id: "redaction-clause-certify-redact",
      status: "PASS",
      certified: 2,
      redacted: 1,
      redactCost: 40,
    });
  }

  {
    const expected = expectedById.get("redaction-sector-gates");
    deepEqual(flowB.spine, expected.spine, "law-12 flow-b spine");
    equal(flowB.gates.length, expected.gates.length, "law-12 flow-b gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowB.gates[index], expected.gates[index], `law-12 flow-b gate ${index}`);
    }
    equal(
      flowB.illegalMoves.length,
      expected.illegalMoves.length,
      "law-12 flow-b illegal move count",
    );
    for (let index = 0; index < expected.illegalMoves.length; index += 1) {
      deepEqual(
        flowB.illegalMoves[index],
        expected.illegalMoves[index],
        `law-12 flow-b illegal move ${index}`,
      );
    }
    deepEqual(flowB.traversal, expected.traversal, "law-12 flow-b legal traversal");
    deepEqual(flowB.bossGate, expected.bossGate, "law-12 flow-b boss gate");
    results.push({
      id: "redaction-sector-gates",
      status: "PASS",
      verifiedGates: flowB.gates.map((gate) => gate.gateId),
      illegalMoves: flowB.illegalMoves.length,
    });
  }

  {
    const expected = expectedById.get("redaction-boss-snapshot-certified");
    deepEqual(flowC.spine, expected.spine, "law-12 flow-c spine");
    deepEqual(flowC.boss.lawAtStart, expected.bossLawAtStart, "law-12 boss law at start");
    deepEqual(
      flowC.boss.displayAtStart,
      expected.bossDisplayAtStart,
      "law-12 boss display at start",
    );
    deepEqual(
      flowC.boss.modifiersAtStart,
      expected.bossModifiersAtStart,
      "law-12 boss modifiers at start",
    );
    deepEqual(
      flowC.boss.modifiersAfterAwaken,
      expected.bossModifiersAfterAwaken,
      "law-12 boss modifiers after awaken",
    );
    deepEqual(flowC.boss.healEvents, expected.healEvents, "law-12 boss heal events");
    deepEqual(flowC.boss.bossFight, expected.bossFight, "law-12 boss fight");
    deepEqual(flowC.resolveAfterBoss, expected.resolveAfterBoss, "law-12 resolve after boss");
    equal(flowC.roundtrip.status, expected.roundtrip.status, "law-12 flow-c roundtrip status");
    deepEqual(flowC.roundtrip.lawData, expected.roundtrip.lawData, "law-12 flow-c roundtrip law data");
    equal(
      flowC.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-12 flow-c roundtrip display status",
    );
    results.push({
      id: "redaction-boss-snapshot-certified",
      status: "PASS",
      certifiedBossModifiers: flowC.boss.modifiersAtStart.encounter.defensePercent,
      awakenedHeal: flowC.boss.healEvents[0]?.healLine ?? null,
      bossRounds: flowC.boss.bossFight.rounds,
    });
  }

  {
    const expected = expectedById.get("redaction-boss-snapshot-redacted");
    deepEqual(flowD.spine, expected.spine, "law-12 flow-d spine");
    equal(flowD.redacts.length, expected.redacts.length, "law-12 flow-d redact count");
    for (let index = 0; index < expected.redacts.length; index += 1) {
      deepEqual(flowD.redacts[index], expected.redacts[index], `law-12 flow-d redact ${index}`);
    }
    deepEqual(flowD.boss.lawAtStart, expected.bossLawAtStart, "law-12 flow-d boss law at start");
    deepEqual(
      flowD.boss.displayAtStart,
      expected.bossDisplayAtStart,
      "law-12 flow-d boss display at start",
    );
    deepEqual(
      flowD.boss.modifiersAtStart,
      expected.bossModifiersAtStart,
      "law-12 flow-d boss modifiers at start",
    );
    deepEqual(
      flowD.boss.modifiersAfterAwaken,
      expected.bossModifiersAfterAwaken,
      "law-12 flow-d boss modifiers after awaken",
    );
    deepEqual(flowD.boss.healEvents, expected.healEvents, "law-12 flow-d boss heal events");
    deepEqual(flowD.boss.bossFight, expected.bossFight, "law-12 flow-d boss fight");
    results.push({
      id: "redaction-boss-snapshot-redacted",
      status: "PASS",
      redactedBossModifiers: flowD.boss.modifiersAtStart.encounter.defensePercent,
      fullHeal: flowD.boss.healEvents[0]?.healLine ?? null,
      bossRounds: flowD.boss.bossFight.rounds,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law13Auction({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-13 auction legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-13 auction legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-13 auction decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-13 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const scripOf = (state) => state.run.lootBag.items.legacy_scrip ?? 0;
  const auctionOf = (state) => core.getCurrentAuctionLotStatus(state);
  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-13 auction law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
      auction: law.display.auction,
    };
  };
  // The law display projection only receives healing pills, so its
  // auction.availableScrip is always 0 (identical in the Web v1 oracle). The
  // scrip-correct projection is core.getCurrentAuctionLotStatus.
  const auctionDisplayView = (displayAuction) => ({
    totalLotCount: displayAuction.totalLotCount,
    availableScrip: displayAuction.availableScrip,
    resolvedCount: displayAuction.resolvedCount,
    bidCount: displayAuction.bidCount,
    burnCount: displayAuction.burnCount,
    foldCount: displayAuction.foldCount,
    pendingLotNodeId: displayAuction.pendingLotNodeId,
    currentCosts: { ...displayAuction.currentCosts },
    projectedLotChoices: { ...displayAuction.projectedLotChoices },
    frozenLotChoices: displayAuction.frozenLotChoices,
  });
  const auctionPendingView = (state) => {
    const a = auctionOf(state);
    return {
      scrip: a.availableScrip,
      pending: a.pendingLotNodeId,
      costs: { ...a.currentCosts },
      choices: {
        bid: { available: a.choices.bid.available, scripCost: a.choices.bid.scripCost },
        burn: { available: a.choices.burn.available, scripCost: a.choices.burn.scripCost },
        fold: { available: a.choices.fold.available, scripCost: a.choices.fold.scripCost },
      },
    };
  };
  const auctionResolvedView = (state) => {
    const a = auctionOf(state);
    return {
      availableScrip: a.availableScrip,
      resolvedCount: a.resolvedCount,
      bidCount: a.bidCount,
      burnCount: a.burnCount,
      foldCount: a.foldCount,
      allLotsResolved: a.allLotsResolved,
      currentCosts: { ...a.currentCosts },
      projectedLotChoices: { ...a.projectedLotChoices },
    };
  };
  const auctionCountsView = (state) => {
    const a = auctionOf(state);
    return {
      resolvedCount: a.resolvedCount,
      bidCount: a.bidCount,
      burnCount: a.burnCount,
      foldCount: a.foldCount,
      allLotsResolved: a.allLotsResolved,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-13 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterAuction = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "legacy_auction_court",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter legacy_auction_court",
    );

  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const resolveLot = (state, choice) => {
    const before = { scrip: scripOf(state) };
    const result = application.reduceGameCommand(state, {
      type: "law/resolve-auction-lot",
      choice,
    });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      scripBefore: before.scrip,
      scripAfter: scripOf(after),
    };
  };
  const fightBoss = (state) => {
    state = move(state, "estate_auctioneer");
    state = commit(state, { type: "run/select-node", nodeId: "estate_auctioneer" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-13 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    const healEvents = [];
    let bossRounds = 0;
    let awakenedSeen = false;
    let modifiersAfterAwaken = null;
    while (state.phase === "combat" && bossRounds < 200) {
      const action = state.player.hp < 350 && state.inventory.healing_pill > 0
        ? "use_healing_pill"
        : "attack";
      const hpBefore = state.player.hp;
      const pillsBefore = state.inventory.healing_pill;
      state = commit(state, { type: "combat/act", action }, `boss ${action} r${bossRounds}`);
      if (action === "use_healing_pill") {
        const healLine = (state.combat?.log ?? []).find((line) => line.includes("止血丹"));
        healEvents.push({
          round: bossRounds,
          hpBefore,
          hpAfter: state.player.hp,
          healLine,
          pillsBefore,
          pillsAfter: state.inventory.healing_pill,
        });
      }
      if (state.combat?.bossPhase === "awakened" && !awakenedSeen) {
        awakenedSeen = true;
        modifiersAfterAwaken = lawCapture(state).modifiers;
      }
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-13 boss combat did not resolve within 200 rounds");
    }
    return {
      state,
      lawAtStart,
      bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("estate_auctioneer"),
      healEvents,
      modifiersAfterAwaken,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: rtLaw.state.law,
      displayStatus: rtLaw.display.status,
      scrip: scripOf(rt.state),
    };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const results = [];

  // Flow A walks all four lot dais: each clear grants 1 scrip and opens a pending
  // lot that blocks departure, bid/burn/fold each deduct the frozen cost, and a
  // codec round-trip preserves the resolved lot map and remaining scrip.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      entryScrip: undefined,
      gateCollect: undefined,
      clears: [],
      departureBlock: undefined,
      resolves: [],
      final: undefined,
      noPendingResolve: undefined,
      reselectCleared: undefined,
      roundtrip: undefined,
    };
    state = enterAuction(state);
    observations.entry = lawCapture(state);
    observations.entryScrip = scripOf(state);

    state = collect(state, "estate_gate", ["estate_gate"]);
    observations.gateCollect = { nodeId: "estate_gate", scrip: scripOf(state) };

    state = goto(state, ["archive_survey_gallery", "force_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect force_lot_dais");
    observations.clears.push({ nodeId: "force_lot_dais", ...auctionPendingView(state) });
    const departure = tryCommit(state, { type: "run/move", nodeId: "archive_survey_gallery" });
    observations.departureBlock = {
      status: departure.status,
      code: departure.code,
      message: departure.message,
      target: "archive_survey_gallery",
    };
    const bid1 = resolveLot(state, "bid");
    state = bid1.state;
    observations.resolves.push({
      lot: "force_lot_dais",
      choice: "bid",
      status: bid1.status,
      log: bid1.log,
      scripBefore: bid1.scripBefore,
      scripAfter: bid1.scripAfter,
      ...auctionCountsView(state),
    });

    state = goto(state, ["archive_survey_gallery", "estate_gate", "lower_bid_supply", "art_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect art_lot_dais");
    observations.clears.push({ nodeId: "art_lot_dais", ...auctionPendingView(state) });
    const fold1 = resolveLot(state, "fold");
    state = fold1.state;
    observations.resolves.push({
      lot: "art_lot_dais",
      choice: "fold",
      status: fold1.status,
      log: fold1.log,
      scripBefore: fold1.scripBefore,
      scripAfter: fold1.scripAfter,
      ...auctionCountsView(state),
    });

    state = goto(state, ["art_relic_gallery", "return_auction_portal", "south_scrip_cache", "dead_team_testimony_stage", "return_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return_lot_dais");
    observations.clears.push({ nodeId: "return_lot_dais", ...auctionPendingView(state) });
    const fold2 = resolveLot(state, "fold");
    state = fold2.state;
    observations.resolves.push({
      lot: "return_lot_dais",
      choice: "fold",
      status: fold2.status,
      log: fold2.log,
      scripBefore: fold2.scripBefore,
      scripAfter: fold2.scripAfter,
      ...auctionCountsView(state),
    });

    state = goto(state, ["lower_auction_portal", "auction_exit", "upper_auction_portal", "guard_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect guard_lot_dais");
    observations.clears.push({ nodeId: "guard_lot_dais", ...auctionPendingView(state) });
    const burn1 = resolveLot(state, "burn");
    state = burn1.state;
    observations.resolves.push({
      lot: "guard_lot_dais",
      choice: "burn",
      status: burn1.status,
      log: burn1.log,
      scripBefore: burn1.scripBefore,
      scripAfter: burn1.scripAfter,
      ...auctionCountsView(state),
    });

    observations.final = lawCapture(state);
    observations.finalAuction = auctionResolvedView(state);
    const noPending = resolveLot(state, "bid");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
    };
    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "guard_lot_dais" });
    observations.reselectCleared = {
      status: reselect.status,
      code: reselect.code,
      message: reselect.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  // Flow B bids three lots in a row so the bid cost climbs 1 -> 2 -> 3 with the
  // prior bid count, then hits the real affordability boundary at cost 4 with
  // only 1 scrip left; burn and fold remain available at that boundary.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      entryCosts: undefined,
      entryScrip: undefined,
      gateScrip: undefined,
      supplyScrip: undefined,
      steps: [],
      rejection: undefined,
      final: undefined,
    };
    state = enterAuction(state);
    observations.entryCosts = { ...auctionOf(state).currentCosts };
    observations.entryScrip = scripOf(state);
    state = collect(state, "estate_gate", ["estate_gate"]);
    observations.gateScrip = scripOf(state);
    state = collect(state, "archive_survey_gallery", ["archive_survey_gallery"]);
    observations.supplyScrip = scripOf(state);

    for (const [lot, path] of [
      ["force_lot_dais", ["force_lot_dais"]],
      ["art_lot_dais", ["archive_survey_gallery", "estate_gate", "lower_bid_supply", "art_lot_dais"]],
      ["guard_lot_dais", ["art_relic_gallery", "return_auction_portal", "south_scrip_cache", "dead_team_testimony_stage", "return_lot_dais", "lower_auction_portal", "auction_exit", "upper_auction_portal", "guard_lot_dais"]],
    ]) {
      state = goto(state, path);
      state = commit(state, { type: "node/collect-reward" }, `collect ${lot}`);
      const pending = auctionOf(state);
      const bid = resolveLot(state, "bid");
      state = bid.state;
      observations.steps.push({
        lot,
        choice: "bid",
        costAtPending: pending.currentCosts.bid,
        scripBefore: bid.scripBefore,
        scripAfter: bid.scripAfter,
        status: bid.status,
        log: bid.log,
      });
    }

    state = goto(state, ["upper_auction_portal", "auction_exit", "lower_auction_portal", "return_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return_lot_dais");
    const pending = auctionOf(state);
    const rejected = resolveLot(state, "bid");
    observations.rejection = {
      costAtPending: { ...pending.currentCosts },
      scrip: pending.availableScrip,
      bidStatus: {
        available: pending.choices.bid.available,
        scripCost: pending.choices.bid.scripCost,
        unavailableReason: pending.choices.bid.unavailableReason ?? null,
      },
      burnStatus: {
        available: pending.choices.burn.available,
        scripCost: pending.choices.burn.scripCost,
      },
      foldStatus: {
        available: pending.choices.fold.available,
        scripCost: pending.choices.fold.scripCost,
      },
      attempt: {
        status: rejected.status,
        code: rejected.code,
        message: rejected.message,
        scripAfter: rejected.scripAfter,
      },
    };
    const fold = resolveLot(state, "fold");
    state = fold.state;
    observations.final = {
      lot: "return_lot_dais",
      choice: "fold",
      status: fold.status,
      log: fold.log,
      scripAfter: fold.scripAfter,
      ...auctionCountsView(state),
    };
    return observations;
  })();

  // Flow C verifies the route gates: a bid lot opens its claim vault while a
  // folded lot closes it permanently (edge removed -> illegal-move), and the
  // boss gate needs all four lots resolved.
  const flowC = (() => {
    let state = hubState;
    const observations = {
      gates: [],
      illegalMoves: [],
      traversal: undefined,
      bossGate: undefined,
    };
    state = enterAuction(state);
    state = collect(state, "estate_gate", ["estate_gate"]);

    state = goto(state, ["archive_survey_gallery", "force_lot_dais", "force_relic_gallery"]);
    observations.gates.push({ when: "force-before-bid", ...gateCheck(state, "force_claim_vault") });
    state = goto(state, ["force_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect force_lot_dais");
    state = resolveLot(state, "bid").state;
    state = goto(state, ["force_relic_gallery"]);
    observations.gates.push({ when: "force-after-bid", ...gateCheck(state, "force_claim_vault") });

    state = goto(state, ["force_lot_dais", "archive_survey_gallery", "estate_gate", "lower_bid_supply", "art_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect art_lot_dais");
    state = resolveLot(state, "fold").state;
    state = goto(state, ["art_relic_gallery"]);
    observations.gates.push({ when: "art-after-fold", ...gateCheck(state, "art_claim_vault") });
    const illegal1 = tryCommit(state, { type: "run/move", nodeId: "art_claim_vault" });
    observations.illegalMoves.push({
      target: "art_claim_vault",
      status: illegal1.status,
      code: illegal1.code,
      message: illegal1.message,
    });

    state = goto(state, ["return_auction_portal", "south_scrip_cache", "dead_team_testimony_stage"]);
    observations.gates.push({ when: "boss-before-all-resolved", ...gateCheck(state, "estate_auctioneer") });
    const illegal2 = tryCommit(state, { type: "run/move", nodeId: "estate_auctioneer" });
    observations.illegalMoves.push({
      target: "estate_auctioneer",
      status: illegal2.status,
      code: illegal2.code,
      message: illegal2.message,
    });

    state = goto(state, ["return_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return_lot_dais");
    state = resolveLot(state, "fold").state;
    state = goto(state, ["lower_auction_portal", "auction_exit", "upper_auction_portal", "guard_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect guard_lot_dais");
    state = resolveLot(state, "fold").state;

    state = goto(state, ["upper_auction_portal", "auction_exit", "lower_auction_portal", "return_lot_dais", "dead_team_testimony_stage"]);
    observations.bossGate = { when: "all-resolved", ...gateCheck(state, "estate_auctioneer") };
    state = move(state, "estate_auctioneer");
    observations.traversal = {
      target: "estate_auctioneer",
      status: "committed",
      hpAfter: state.player.hp,
      at: state.run.currentNodeId,
    };
    return observations;
  })();

  // Flow D bids one lot and folds the other three, then starts the boss: the
  // snapshot is minted and locked, the boss gains the bid force boons and the
  // fold penalties, and post-boss resolves are rejected as frozen.
  const flowD = (() => {
    let state = hubState;
    const observations = {
      spine: undefined,
      boss: undefined,
      resolveAfterBoss: undefined,
      roundtrip: undefined,
    };
    state = enterAuction(state);
    state = collect(state, "estate_gate", ["estate_gate"]);
    const hpEntry = state.player.hp;

    state = goto(state, ["archive_survey_gallery", "force_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect force_lot_dais");
    state = resolveLot(state, "bid").state;
    state = goto(state, ["archive_survey_gallery", "estate_gate", "lower_bid_supply", "art_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect art_lot_dais");
    state = resolveLot(state, "fold").state;
    state = goto(state, ["art_relic_gallery", "return_auction_portal", "south_scrip_cache", "dead_team_testimony_stage", "return_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect return_lot_dais");
    state = resolveLot(state, "fold").state;
    state = goto(state, ["lower_auction_portal", "auction_exit", "upper_auction_portal", "guard_lot_dais"]);
    state = commit(state, { type: "node/collect-reward" }, "collect guard_lot_dais");
    state = resolveLot(state, "fold").state;

    const spineAuction = auctionOf(state);
    observations.spine = {
      hpEntry,
      hpAfterResolves: state.player.hp,
      scrip: scripOf(state),
      resolvedCount: spineAuction.resolvedCount,
      bidCount: spineAuction.bidCount,
      burnCount: spineAuction.burnCount,
      foldCount: spineAuction.foldCount,
      allLotsResolved: spineAuction.allLotsResolved,
      projectedBossModifiers: spineAuction.projectedBossModifiers,
    };

    state = goto(state, ["upper_auction_portal", "auction_exit", "lower_auction_portal", "return_lot_dais", "dead_team_testimony_stage"]);
    const boss = fightBoss(state);
    state = boss.state;
    const healSummary = {
      count: boss.healEvents.length,
      pillsConsumed: boss.healEvents.reduce(
        (sum, event) => sum + (event.pillsBefore - event.pillsAfter),
        0,
      ),
      first: boss.healEvents[0] ?? null,
      last: boss.healEvents[boss.healEvents.length - 1] ?? null,
    };
    observations.boss = {
      lawAtStart: boss.lawAtStart.lawData,
      displayAtStart: boss.lawAtStart.display,
      modifiersAtStart: boss.lawAtStart.modifiers,
      modifiersAfterAwaken: boss.modifiersAfterAwaken,
      healEvents: healSummary,
      bossFight: { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared },
    };
    const after = resolveLot(state, "bid");
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("auction-lot-bid-burn-fold");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-13 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-13 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-13 entry law data");
    deepEqual(auctionDisplayView(flowA.entry.auction), expected.entryAuction, "law-13 entry auction display");
    equal(flowA.entryScrip, expected.entryScrip, "law-13 entry scrip");
    deepEqual(flowA.gateCollect, expected.gateCollect, "law-13 gate collect");
    equal(flowA.clears.length, expected.clears.length, "law-13 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      deepEqual(flowA.clears[index], expected.clears[index], `law-13 flow-a clear ${index}`);
    }
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-13 pending departure block");
    equal(flowA.resolves.length, expected.resolves.length, "law-13 flow-a resolve count");
    for (let index = 0; index < expected.resolves.length; index += 1) {
      deepEqual(flowA.resolves[index], expected.resolves[index], `law-13 flow-a resolve ${index}`);
    }
    deepEqual(flowA.final.display, expected.finalDisplay, "law-13 final display");
    deepEqual(flowA.final.lawData, expected.finalLawData, "law-13 final law data");
    deepEqual(flowA.finalAuction, expected.finalAuction, "law-13 final auction");
    deepEqual(flowA.noPendingResolve, expected.noPendingResolve, "law-13 no-pending resolve");
    deepEqual(flowA.reselectCleared, expected.reselectCleared, "law-13 reselect cleared dais");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-13 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-13 roundtrip law data");
    equal(
      flowA.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-13 roundtrip display status",
    );
    equal(flowA.roundtrip.scrip, expected.roundtrip.scrip, "law-13 roundtrip scrip");
    results.push({
      id: "auction-lot-bid-burn-fold",
      status: "PASS",
      bid: 1,
      burn: 1,
      fold: 2,
      remainingScrip: flowA.roundtrip.scrip,
    });
  }

  {
    const expected = expectedById.get("auction-dynamic-pricing");
    deepEqual(flowB.entryCosts, expected.entryCosts, "law-13 flow-b entry costs");
    equal(flowB.entryScrip, expected.entryScrip, "law-13 flow-b entry scrip");
    equal(flowB.gateScrip, expected.gateScrip, "law-13 flow-b gate scrip");
    equal(flowB.supplyScrip, expected.supplyScrip, "law-13 flow-b supply scrip");
    equal(flowB.steps.length, expected.steps.length, "law-13 flow-b step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowB.steps[index], expected.steps[index], `law-13 flow-b step ${index}`);
    }
    deepEqual(flowB.rejection, expected.rejection, "law-13 flow-b bid rejection boundary");
    deepEqual(flowB.final, expected.final, "law-13 flow-b final fold");
    results.push({
      id: "auction-dynamic-pricing",
      status: "PASS",
      bidCostCurve: flowB.steps.map((step) => step.costAtPending),
      rejectedBidCost: flowB.rejection.costAtPending.bid,
    });
  }

  {
    const expected = expectedById.get("auction-route-gates");
    equal(flowC.gates.length, expected.gates.length, "law-13 flow-c gate count");
    for (let index = 0; index < expected.gates.length; index += 1) {
      deepEqual(flowC.gates[index], expected.gates[index], `law-13 flow-c gate ${index}`);
    }
    equal(
      flowC.illegalMoves.length,
      expected.illegalMoves.length,
      "law-13 flow-c illegal move count",
    );
    for (let index = 0; index < expected.illegalMoves.length; index += 1) {
      deepEqual(
        flowC.illegalMoves[index],
        expected.illegalMoves[index],
        `law-13 flow-c illegal move ${index}`,
      );
    }
    deepEqual(flowC.traversal, expected.traversal, "law-13 flow-c legal traversal");
    deepEqual(flowC.bossGate, expected.bossGate, "law-13 flow-c boss gate");
    results.push({
      id: "auction-route-gates",
      status: "PASS",
      verifiedGates: flowC.gates.map((gate) => gate.gateId),
      illegalMoves: flowC.illegalMoves.length,
    });
  }

  {
    const expected = expectedById.get("auction-boss-snapshot");
    deepEqual(flowD.spine, expected.spine, "law-13 flow-d spine");
    deepEqual(flowD.boss.lawAtStart, expected.bossLawAtStart, "law-13 boss law at start");
    deepEqual(
      flowD.boss.displayAtStart,
      expected.bossDisplayAtStart,
      "law-13 boss display at start",
    );
    deepEqual(
      flowD.boss.modifiersAtStart,
      expected.bossModifiersAtStart,
      "law-13 boss modifiers at start",
    );
    deepEqual(
      flowD.boss.modifiersAfterAwaken,
      expected.bossModifiersAfterAwaken,
      "law-13 boss modifiers after awaken",
    );
    deepEqual(flowD.boss.healEvents, expected.healEvents, "law-13 boss heal events");
    deepEqual(flowD.boss.bossFight, expected.bossFight, "law-13 boss fight");
    deepEqual(flowD.resolveAfterBoss, expected.resolveAfterBoss, "law-13 resolve after boss");
    equal(flowD.roundtrip.status, expected.roundtrip.status, "law-13 flow-d roundtrip status");
    deepEqual(flowD.roundtrip.lawData, expected.roundtrip.lawData, "law-13 flow-d roundtrip law data");
    equal(
      flowD.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-13 flow-d roundtrip display status",
    );
    equal(flowD.roundtrip.scrip, expected.roundtrip.scrip, "law-13 flow-d roundtrip scrip");
    results.push({
      id: "auction-boss-snapshot",
      status: "PASS",
      bossRounds: flowD.boss.bossFight.rounds,
      sealedForcePercent: flowD.boss.modifiersAtStart.outgoingDamage.forcePercent,
      awakenedHeal: flowD.boss.healEvents.first?.healLine ?? null,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law14Genesis({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-14 genesis legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-14 genesis legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-14 genesis decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-14 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const runSerum = (state) => state.run.lootBag.items.genesis_serum ?? 0;
  const durableSerum = (state) => state.inventory.genesis_serum ?? 0;
  const genesisOf = (state) => core.getCurrentGenesisSpliceStatus(state);
  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-14 genesis law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
      genesis: law.display.genesis,
    };
  };
  // The law display projection only receives healing pills, so its
  // genesis.availableGenesisSerum is always 0 (identical in the Web v1 oracle).
  // The serum-correct projection is core.getCurrentGenesisSpliceStatus.
  const genesisDisplayView = (displayGenesis) => ({
    availableGenesisSerum: displayGenesis.availableGenesisSerum,
    pendingSpliceNodeId: displayGenesis.pendingSpliceNodeId,
    spliceSequence: displayGenesis.spliceSequence,
    uniqueCount: displayGenesis.uniqueCount,
    bossGenomeSnapshot: displayGenesis.bossGenomeSnapshot,
    projectedModifiers: displayGenesis.projectedModifiers,
  });
  const genesisPendingView = (state) => {
    const g = genesisOf(state);
    return {
      runSerum: runSerum(state),
      durableSerum: durableSerum(state),
      pending: g.pendingSpliceNodeId,
      choices: {
        force: { available: g.choices.force.available, serumCost: g.choices.force.serumCost },
        art: { available: g.choices.art.available, serumCost: g.choices.art.serumCost },
        guard: { available: g.choices.guard.available, serumCost: g.choices.guard.serumCost },
        renewal: { available: g.choices.renewal.available, serumCost: g.choices.renewal.serumCost },
      },
    };
  };
  const genesisResolvedView = (state) => {
    const g = genesisOf(state);
    return {
      availableGenesisSerum: g.availableGenesisSerum,
      pendingSpliceNodeId: g.pendingSpliceNodeId,
      spliceSequence: g.spliceSequence,
      uniqueCount: g.uniqueCount,
      allResolved: g.allResolved,
      bossGenomeSnapshot: g.bossGenomeSnapshot,
      choices: {
        force: { available: g.choices.force.available, serumCost: g.choices.force.serumCost, unavailableReason: g.choices.force.unavailableReason ?? null },
        art: { available: g.choices.art.available, serumCost: g.choices.art.serumCost, unavailableReason: g.choices.art.unavailableReason ?? null },
        guard: { available: g.choices.guard.available, serumCost: g.choices.guard.serumCost, unavailableReason: g.choices.guard.unavailableReason ?? null },
        renewal: { available: g.choices.renewal.available, serumCost: g.choices.renewal.serumCost, unavailableReason: g.choices.renewal.unavailableReason ?? null },
      },
      projectedModifiers: g.projectedModifiers,
    };
  };

  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-14 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterGenesis = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "genesis_vault",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter genesis_vault",
    );

  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const handleTrap = (state, choice = "auto") =>
    commit(state, { type: "node/handle-trap", choice }, "handle trap");
  const clearTrap = (state, nodeId, path = []) => {
    state = goto(state, path);
    return handleTrap(state);
  };
  const fightMonster = (state, nodeId, path = []) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-14 ${nodeId} select did not enter combat`);
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-14 ${nodeId} combat did not resolve in 200 rounds`);
    }
    return { state, rounds, hpAfter: state.player.hp };
  };
  const resolveSplice = (state, gene) => {
    const before = { run: runSerum(state), durable: durableSerum(state), seq: [...(genesisOf(state)?.spliceSequence ?? [])] };
    const result = application.reduceGameCommand(state, { type: "law/resolve-genesis-splice", gene });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      serumBefore: before.run,
      durableBefore: before.durable,
      serumAfter: runSerum(after),
      durableAfter: durableSerum(after),
      seqBefore: before.seq,
      seqAfter: [...(genesisOf(after)?.spliceSequence ?? [])],
    };
  };
  const fightBoss = (state) => {
    state = goto(state, ["primal_curator"]);
    state = commit(state, { type: "run/select-node", nodeId: "primal_curator" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-14 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    let bossRounds = 0;
    let awakenedSeen = false;
    let modifiersAfterAwaken = null;
    while (state.phase === "combat" && bossRounds < 200) {
      state = commit(state, { type: "combat/act", action: "art" }, `boss art r${bossRounds}`);
      if (state.combat?.bossPhase === "awakened" && !awakenedSeen) {
        awakenedSeen = true;
        modifiersAfterAwaken = lawCapture(state).modifiers;
      }
      bossRounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-14 boss combat did not resolve within 200 rounds");
    }
    return {
      state,
      lawAtStart,
      bossRounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("primal_curator"),
      modifiersAfterAwaken,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: rtLaw.state.law,
      displayStatus: rtLaw.display.status,
      runSerum: runSerum(rt.state),
      durableSerum: durableSerum(rt.state),
    };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const results = [];

  // Flow A walks all three splice consoles in order: each clear grants 1 serum
  // and opens a pending splice that blocks departure, resolving force/art/guard
  // each deducts the frozen cost (0 for a first copy), and a codec round-trip
  // preserves the ordered sequence and dual-track serum.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entry: undefined,
      entryRunSerum: undefined,
      entryDurableSerum: undefined,
      gateCollect: undefined,
      clears: [],
      departureBlock: undefined,
      resolves: [],
      final: undefined,
      finalGenesis: undefined,
      noPendingResolve: undefined,
      reselectCleared: undefined,
      roundtrip: undefined,
      alphaFight: undefined,
    };
    state = enterGenesis(state);
    observations.entry = lawCapture(state);
    observations.entryRunSerum = runSerum(state);
    observations.entryDurableSerum = durableSerum(state);

    state = collect(state, "genesis_gate", ["genesis_gate"]);
    observations.gateCollect = { nodeId: "genesis_gate", runSerum: runSerum(state), durableSerum: durableSerum(state) };

    state = collect(state, "bloodline_survey_archive", ["bloodline_survey_archive"]);
    state = goto(state, ["first_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect first_splice_console");
    observations.clears.push({ nodeId: "first_splice_console", ...genesisPendingView(state) });
    const departure = tryCommit(state, { type: "run/move", nodeId: "helix_collapse_trap" });
    observations.departureBlock = {
      status: departure.status,
      code: departure.code,
      message: departure.message,
      target: "helix_collapse_trap",
    };
    const r1 = resolveSplice(state, "force");
    state = r1.state;
    observations.resolves.push({
      console: "first_splice_console",
      gene: "force",
      status: r1.status,
      log: r1.log,
      serumBefore: r1.serumBefore,
      serumAfter: r1.serumAfter,
      durableAfter: r1.durableAfter,
      sequence: r1.seqAfter,
      uniqueCount: genesisOf(state).uniqueCount,
      allResolved: genesisOf(state).allResolved,
    });

    state = clearTrap(state, "helix_collapse_trap", ["helix_collapse_trap"]);
    const alpha = fightMonster(state, "gene_stalker_alpha", ["gene_stalker_alpha"]);
    state = alpha.state;
    observations.alphaFight = { rounds: alpha.rounds, hpAfter: alpha.hpAfter };

    state = goto(state, ["second_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect second_splice_console");
    observations.clears.push({ nodeId: "second_splice_console", ...genesisPendingView(state) });
    const r2 = resolveSplice(state, "art");
    state = r2.state;
    observations.resolves.push({
      console: "second_splice_console",
      gene: "art",
      status: r2.status,
      log: r2.log,
      serumBefore: r2.serumBefore,
      serumAfter: r2.serumAfter,
      durableAfter: r2.durableAfter,
      sequence: r2.seqAfter,
      uniqueCount: genesisOf(state).uniqueCount,
      allResolved: genesisOf(state).allResolved,
    });

    state = goto(state, ["gene_stalker_alpha", "helix_collapse_trap", "first_splice_console", "sample_corridor_guard"]);
    state = handleTrap(state);
    state = goto(state, ["third_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect third_splice_console");
    observations.clears.push({ nodeId: "third_splice_console", ...genesisPendingView(state) });
    const r3 = resolveSplice(state, "guard");
    state = r3.state;
    observations.resolves.push({
      console: "third_splice_console",
      gene: "guard",
      status: r3.status,
      log: r3.log,
      serumBefore: r3.serumBefore,
      serumAfter: r3.serumAfter,
      durableAfter: r3.durableAfter,
      sequence: r3.seqAfter,
      uniqueCount: genesisOf(state).uniqueCount,
      allResolved: genesisOf(state).allResolved,
    });

    observations.final = lawCapture(state);
    observations.finalGenesis = genesisResolvedView(state);
    const noPending = resolveSplice(state, "force");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
      serumAfter: noPending.serumAfter,
      sequence: noPending.seqAfter,
    };
    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "third_splice_console" });
    observations.reselectCleared = {
      status: reselect.status,
      code: reselect.code,
      message: reselect.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  // Flow B resolves force three times in a row so the serum cost climbs 0 -> 1
  // -> 2 with the duplicate count, then hits the post-completion rejection
  // boundary where all choices are unavailable with "三次原型拼接已经完成。".
  const flowB = (() => {
    let state = hubState;
    const observations = {
      entryChoices: undefined,
      gateSerum: undefined,
      steps: [],
      rejection: undefined,
      final: undefined,
    };
    state = enterGenesis(state);
    const e = genesisOf(state);
    observations.entryChoices = {
      availableGenesisSerum: e.availableGenesisSerum,
      costs: {
        force: e.choices.force.serumCost,
        art: e.choices.art.serumCost,
        guard: e.choices.guard.serumCost,
        renewal: e.choices.renewal.serumCost,
      },
    };
    state = collect(state, "genesis_gate", ["genesis_gate"]);
    observations.gateSerum = { run: runSerum(state), durable: durableSerum(state) };
    state = collect(state, "bloodline_survey_archive", ["bloodline_survey_archive"]);

    state = goto(state, ["first_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect first_splice_console");
    {
      const pending = genesisOf(state);
      const step = resolveSplice(state, "force");
      state = step.state;
      observations.steps.push({
        console: "first_splice_console",
        gene: "force",
        costAtPending: pending.choices.force.serumCost,
        serumBefore: step.serumBefore,
        serumAfter: step.serumAfter,
        durableAfter: step.durableAfter,
        status: step.status,
        log: step.log,
      });
    }

    state = clearTrap(state, "helix_collapse_trap", ["helix_collapse_trap"]);
    state = fightMonster(state, "gene_stalker_alpha", ["gene_stalker_alpha"]).state;
    state = goto(state, ["second_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect second_splice_console");
    {
      const pending = genesisOf(state);
      const step = resolveSplice(state, "force");
      state = step.state;
      observations.steps.push({
        console: "second_splice_console",
        gene: "force",
        costAtPending: pending.choices.force.serumCost,
        serumBefore: step.serumBefore,
        serumAfter: step.serumAfter,
        durableAfter: step.durableAfter,
        status: step.status,
        log: step.log,
      });
    }

    state = goto(state, ["gene_stalker_alpha", "helix_collapse_trap", "first_splice_console", "sample_corridor_guard"]);
    state = handleTrap(state);
    state = goto(state, ["third_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect third_splice_console");
    {
      const pending = genesisOf(state);
      const step = resolveSplice(state, "force");
      state = step.state;
      observations.steps.push({
        console: "third_splice_console",
        gene: "force",
        costAtPending: pending.choices.force.serumCost,
        serumBefore: step.serumBefore,
        serumAfter: step.serumAfter,
        durableAfter: step.durableAfter,
        status: step.status,
        log: step.log,
      });
    }

    const g = genesisOf(state);
    observations.final = {
      sequence: g.spliceSequence,
      uniqueCount: g.uniqueCount,
      allResolved: g.allResolved,
      runSerum: runSerum(state),
      durableSerum: durableSerum(state),
    };
    // post-completion rejection: real command, state must be unchanged
    const beforeSnap = { seq: [...g.spliceSequence], run: runSerum(state), durable: durableSerum(state), pending: g.pendingSpliceNodeId };
    const rej = resolveSplice(state, "art");
    const afterG = genesisOf(state);
    observations.rejection = {
      attempt: {
        status: rej.status,
        code: rej.code,
        message: rej.message,
        serumAfter: rej.serumAfter,
        sequence: rej.seqAfter,
      },
      choiceStatus: {
        available: afterG.choices.art.available,
        serumCost: afterG.choices.art.serumCost,
        unavailableReason: afterG.choices.art.unavailableReason ?? null,
      },
      stateUnchanged: JSON.stringify(beforeSnap) === JSON.stringify({ seq: [...afterG.spliceSequence], run: runSerum(state), durable: durableSerum(state), pending: afterG.pendingSpliceNodeId }),
    };
    return observations;
  })();

  // Flow C verifies the route gates: the specialization gate opens only when
  // force was spliced at least 2 times, the myriad gate opens only when all
  // three splices are unique, and the boss gate needs all three resolved.
  const flowC = (() => {
    const observations = {
      entryGates: undefined,
      specGates: undefined,
      specIllegalMoves: [],
      specBossGate: undefined,
      myriadGates: undefined,
      myriadIllegalMoves: [],
      myriadBossGate: undefined,
    };
    // entry gates (no splices)
    {
      let state = enterGenesis(hubState);
      state = goto(state, ["bloodline_survey_archive", "first_splice_console", "force_sample_gallery"]);
      const g1 = gateCheck(state, "force_gene_vault");
      state = goto(state, ["first_splice_console", "sample_corridor_guard"]);
      const g2 = gateCheck(state, "mosaic_gene_vault");
      state = handleTrap(state);
      state = goto(state, ["first_splice_console", "helix_collapse_trap"]);
      state = handleTrap(state);
      state = goto(state, ["gene_stalker_alpha"]);
      const g3 = gateCheck(state, "primal_curator");
      const alpha = fightMonster(state, "gene_stalker_alpha");
      state = alpha.state;
      observations.entryGates = { forceVault: g1, mosaicVault: g2, boss: g3, alphaRounds: alpha.rounds };
    }
    // spec run: force x3
    {
      let state = hubState;
      state = enterGenesis(state);
      state = collect(state, "genesis_gate", ["genesis_gate"]);
      state = collect(state, "bloodline_survey_archive", ["bloodline_survey_archive"]);
      state = goto(state, ["first_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect first");
      state = resolveSplice(state, "force").state;
      state = clearTrap(state, "helix_collapse_trap", ["helix_collapse_trap"]);
      state = fightMonster(state, "gene_stalker_alpha", ["gene_stalker_alpha"]).state;
      state = goto(state, ["second_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect second");
      state = resolveSplice(state, "force").state;
      state = goto(state, ["gene_stalker_alpha", "helix_collapse_trap", "first_splice_console", "sample_corridor_guard"]);
      state = handleTrap(state);
      state = goto(state, ["third_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect third");
      state = resolveSplice(state, "force").state;
      // spec gates after force x3
      state = goto(state, ["sample_corridor_guard", "first_splice_console", "force_sample_gallery"]);
      const forceVault = gateCheck(state, "force_gene_vault");
      state = goto(state, ["first_splice_console", "sample_corridor_guard"]);
      const mosaicVault = gateCheck(state, "mosaic_gene_vault");
      const illegal = tryCommit(state, { type: "run/move", nodeId: "mosaic_gene_vault" });
      observations.specIllegalMoves.push({
        target: "mosaic_gene_vault",
        status: illegal.status,
        code: illegal.code,
        message: illegal.message,
      });
      state = goto(state, ["first_splice_console", "helix_collapse_trap", "gene_stalker_alpha"]);
      const boss = gateCheck(state, "primal_curator");
      observations.specGates = { forceVault, mosaicVault, sequence: genesisOf(state).spliceSequence, uniqueCount: genesisOf(state).uniqueCount };
      observations.specBossGate = boss;
    }
    // myriad run: force / art / guard
    {
      let state = hubState;
      state = enterGenesis(state);
      state = collect(state, "genesis_gate", ["genesis_gate"]);
      state = collect(state, "bloodline_survey_archive", ["bloodline_survey_archive"]);
      state = goto(state, ["first_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect first");
      state = resolveSplice(state, "force").state;
      state = clearTrap(state, "helix_collapse_trap", ["helix_collapse_trap"]);
      state = fightMonster(state, "gene_stalker_alpha", ["gene_stalker_alpha"]).state;
      state = goto(state, ["second_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect second");
      state = resolveSplice(state, "art").state;
      state = goto(state, ["gene_stalker_alpha", "helix_collapse_trap", "first_splice_console", "sample_corridor_guard"]);
      state = handleTrap(state);
      state = goto(state, ["third_splice_console"]);
      state = commit(state, { type: "node/collect-reward" }, "collect third");
      state = resolveSplice(state, "guard").state;
      state = goto(state, ["sample_corridor_guard", "first_splice_console", "force_sample_gallery"]);
      const forceVault = gateCheck(state, "force_gene_vault");
      const illegal = tryCommit(state, { type: "run/move", nodeId: "force_gene_vault" });
      observations.myriadIllegalMoves.push({
        target: "force_gene_vault",
        status: illegal.status,
        code: illegal.code,
        message: illegal.message,
      });
      state = goto(state, ["first_splice_console", "sample_corridor_guard"]);
      const mosaicVault = gateCheck(state, "mosaic_gene_vault");
      state = goto(state, ["first_splice_console", "helix_collapse_trap", "gene_stalker_alpha"]);
      const boss = gateCheck(state, "primal_curator");
      observations.myriadGates = { forceVault, mosaicVault, sequence: genesisOf(state).spliceSequence, uniqueCount: genesisOf(state).uniqueCount };
      observations.myriadBossGate = boss;
    }
    return observations;
  })();

  // Flow D resolves force three times (specialization), then starts the boss:
  // the snapshot is minted and locked, the boss gains the force adaptation
  // (defense +8% sealed / +14% awakened), and post-boss resolves are rejected
  // as frozen.
  const flowD = (() => {
    let state = hubState;
    const observations = {
      spine: undefined,
      boss: undefined,
      resolveAfterBoss: undefined,
      roundtrip: undefined,
    };
    state = enterGenesis(state);
    state = collect(state, "genesis_gate", ["genesis_gate"]);
    const hpEntry = state.player.hp;
    state = collect(state, "bloodline_survey_archive", ["bloodline_survey_archive"]);
    state = goto(state, ["first_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect first");
    state = resolveSplice(state, "force").state;
    state = clearTrap(state, "helix_collapse_trap", ["helix_collapse_trap"]);
    state = fightMonster(state, "gene_stalker_alpha", ["gene_stalker_alpha"]).state;
    state = goto(state, ["second_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect second");
    state = resolveSplice(state, "force").state;
    state = goto(state, ["gene_stalker_alpha", "helix_collapse_trap", "first_splice_console", "sample_corridor_guard"]);
    state = handleTrap(state);
    state = goto(state, ["third_splice_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect third");
    state = resolveSplice(state, "force").state;

    const g = genesisOf(state);
    observations.spine = {
      hpEntry,
      hpAfterResolves: state.player.hp,
      runSerum: runSerum(state),
      durableSerum: durableSerum(state),
      spliceSequence: g.spliceSequence,
      uniqueCount: g.uniqueCount,
      allResolved: g.allResolved,
      projectedModifiers: g.projectedModifiers,
    };

    state = goto(state, ["sample_corridor_guard", "first_splice_console", "helix_collapse_trap", "gene_stalker_alpha"]);
    const boss = fightBoss(state);
    state = boss.state;
    observations.boss = {
      lawAtStart: boss.lawAtStart.lawData,
      displayAtStart: boss.lawAtStart.display,
      modifiersAtStart: boss.lawAtStart.modifiers,
      modifiersAfterAwaken: boss.modifiersAfterAwaken,
      bossFight: { rounds: boss.bossRounds, hpAfter: boss.hpAfter, cleared: boss.cleared },
    };
    const after = resolveSplice(state, "force");
    const afterG = genesisOf(state);
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
      choiceStatus: {
        available: afterG.choices.force.available,
        serumCost: afterG.choices.force.serumCost,
        unavailableReason: afterG.choices.force.unavailableReason ?? null,
      },
      serumAfter: after.serumAfter,
      sequence: after.seqAfter,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("genesis-ordered-splice-serum");
    deepEqual(flowA.entry.display, expected.entryDisplay, "law-14 entry display");
    deepEqual(flowA.entry.modifiers, expected.entryModifiers, "law-14 entry modifiers");
    deepEqual(flowA.entry.lawData, expected.entryLawData, "law-14 entry law data");
    deepEqual(genesisDisplayView(flowA.entry.genesis), expected.entryGenesis, "law-14 entry genesis display");
    equal(flowA.entryRunSerum, expected.entryRunSerum, "law-14 entry run serum");
    equal(flowA.entryDurableSerum, expected.entryDurableSerum, "law-14 entry durable serum");
    deepEqual(flowA.gateCollect, expected.gateCollect, "law-14 gate collect");
    equal(flowA.clears.length, expected.clears.length, "law-14 flow-a clear count");
    for (let index = 0; index < expected.clears.length; index += 1) {
      deepEqual(flowA.clears[index], expected.clears[index], `law-14 flow-a clear ${index}`);
    }
    deepEqual(flowA.departureBlock, expected.departureBlock, "law-14 pending departure block");
    equal(flowA.resolves.length, expected.resolves.length, "law-14 flow-a resolve count");
    for (let index = 0; index < expected.resolves.length; index += 1) {
      deepEqual(flowA.resolves[index], expected.resolves[index], `law-14 flow-a resolve ${index}`);
    }
    deepEqual(flowA.final.display, expected.finalDisplay, "law-14 final display");
    deepEqual(flowA.final.modifiers, expected.finalModifiers, "law-14 final modifiers");
    deepEqual(flowA.final.lawData, expected.finalLawData, "law-14 final law data");
    deepEqual(flowA.finalGenesis, expected.finalGenesis, "law-14 final genesis");
    deepEqual(flowA.noPendingResolve, expected.noPendingResolve, "law-14 no-pending resolve");
    deepEqual(flowA.reselectCleared, expected.reselectCleared, "law-14 reselect cleared console");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-14 roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-14 roundtrip law data");
    equal(
      flowA.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-14 roundtrip display status",
    );
    equal(flowA.roundtrip.runSerum, expected.roundtrip.runSerum, "law-14 roundtrip run serum");
    equal(flowA.roundtrip.durableSerum, expected.roundtrip.durableSerum, "law-14 roundtrip durable serum");
    deepEqual(flowA.alphaFight, expected.alphaFight, "law-14 alpha fight");
    results.push({
      id: "genesis-ordered-splice-serum",
      status: "PASS",
      force: 1,
      art: 1,
      guard: 1,
      remainingSerum: flowA.roundtrip.runSerum,
    });
  }

  {
    const expected = expectedById.get("genesis-duplicate-cost-rejection");
    deepEqual(flowB.entryChoices, expected.entryChoices, "law-14 flow-b entry choices");
    deepEqual(flowB.gateSerum, expected.gateSerum, "law-14 flow-b gate serum");
    equal(flowB.steps.length, expected.steps.length, "law-14 flow-b step count");
    for (let index = 0; index < expected.steps.length; index += 1) {
      deepEqual(flowB.steps[index], expected.steps[index], `law-14 flow-b step ${index}`);
    }
    deepEqual(flowB.rejection, expected.rejection, "law-14 flow-b post-completion rejection");
    deepEqual(flowB.final, expected.final, "law-14 flow-b final");
    results.push({
      id: "genesis-duplicate-cost-rejection",
      status: "PASS",
      duplicateCostCurve: flowB.steps.map((step) => step.costAtPending),
      rejectedReason: flowB.rejection.choiceStatus.unavailableReason,
    });
  }

  {
    const expected = expectedById.get("genesis-specialization-myriad-gates");
    deepEqual(flowC.entryGates, expected.entryGates, "law-14 flow-c entry gates");
    deepEqual(flowC.specGates, expected.specGates, "law-14 flow-c spec gates");
    equal(
      flowC.specIllegalMoves.length,
      expected.specIllegalMoves.length,
      "law-14 flow-c spec illegal move count",
    );
    for (let index = 0; index < expected.specIllegalMoves.length; index += 1) {
      deepEqual(
        flowC.specIllegalMoves[index],
        expected.specIllegalMoves[index],
        `law-14 flow-c spec illegal move ${index}`,
      );
    }
    deepEqual(flowC.specBossGate, expected.specBossGate, "law-14 flow-c spec boss gate");
    deepEqual(flowC.myriadGates, expected.myriadGates, "law-14 flow-c myriad gates");
    equal(
      flowC.myriadIllegalMoves.length,
      expected.myriadIllegalMoves.length,
      "law-14 flow-c myriad illegal move count",
    );
    for (let index = 0; index < expected.myriadIllegalMoves.length; index += 1) {
      deepEqual(
        flowC.myriadIllegalMoves[index],
        expected.myriadIllegalMoves[index],
        `law-14 flow-c myriad illegal move ${index}`,
      );
    }
    deepEqual(flowC.myriadBossGate, expected.myriadBossGate, "law-14 flow-c myriad boss gate");
    results.push({
      id: "genesis-specialization-myriad-gates",
      status: "PASS",
      verifiedGates: [flowC.specGates.forceVault.gateId, flowC.specGates.mosaicVault.gateId, flowC.specBossGate.gateId],
      illegalMoves: flowC.specIllegalMoves.length + flowC.myriadIllegalMoves.length,
    });
  }

  {
    const expected = expectedById.get("genesis-boss-snapshot");
    deepEqual(flowD.spine, expected.spine, "law-14 flow-d spine");
    deepEqual(flowD.boss.lawAtStart, expected.bossLawAtStart, "law-14 boss law at start");
    deepEqual(
      flowD.boss.displayAtStart,
      expected.bossDisplayAtStart,
      "law-14 boss display at start",
    );
    deepEqual(
      flowD.boss.modifiersAtStart,
      expected.bossModifiersAtStart,
      "law-14 boss modifiers at start",
    );
    deepEqual(
      flowD.boss.modifiersAfterAwaken,
      expected.bossModifiersAfterAwaken,
      "law-14 boss modifiers after awaken",
    );
    deepEqual(flowD.boss.bossFight, expected.bossFight, "law-14 boss fight");
    deepEqual(flowD.resolveAfterBoss, expected.resolveAfterBoss, "law-14 resolve after boss");
    equal(flowD.roundtrip.status, expected.roundtrip.status, "law-14 flow-d roundtrip status");
    deepEqual(flowD.roundtrip.lawData, expected.roundtrip.lawData, "law-14 flow-d roundtrip law data");
    equal(
      flowD.roundtrip.displayStatus,
      expected.roundtrip.displayStatus,
      "law-14 flow-d roundtrip display status",
    );
    equal(flowD.roundtrip.runSerum, expected.roundtrip.runSerum, "law-14 flow-d roundtrip run serum");
    equal(flowD.roundtrip.durableSerum, expected.roundtrip.durableSerum, "law-14 flow-d roundtrip durable serum");
    results.push({
      id: "genesis-boss-snapshot",
      status: "PASS",
      bossRounds: flowD.boss.bossFight.rounds,
      sealedDefensePercent: flowD.boss.modifiersAtStart.encounter.defensePercent,
      frozenReason: flowD.resolveAfterBoss.choiceStatus.unavailableReason,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law15Broadcast({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-15 broadcast legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-15 broadcast legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-15 broadcast decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-15 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const bc = (state) => core.getCurrentBroadcastRelayStatus(state);
  const noise = (state) => bc(state)?.noise;
  const choiceSnap = (c) => ({
    available: c.available,
    noiseDelta: c.noiseDelta,
    bonusRewardPoints: c.bonusRewardPoints,
    unavailableReason: c.unavailableReason ?? null,
  });
  const lawDataSnap = (state) => {
    const l = core.getCurrentDungeonLaw(state).state.law;
    return {
      kind: l.kind,
      noise: l.noise,
      pendingRelayNodeId: l.pendingRelayNodeId,
      resolvedRelayChoices: l.resolvedRelayChoices,
      bossNoiseSnapshot: l.bossNoiseSnapshot,
      entryPassives: l.entryPassives,
      firstClashMutedUsed: l.firstClashMutedUsed,
    };
  };
  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-15 broadcast law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: lawDataSnap(state),
      broadcast: {
        totalRelayCount: law.display.broadcast.totalRelayCount,
        noise: law.display.broadcast.noise,
        pendingRelayNodeId: law.display.broadcast.pendingRelayNodeId,
        resolvedRelayChoices: law.display.broadcast.resolvedRelayChoices,
        resolvedCount: law.display.broadcast.resolvedCount,
        muteCount: law.display.broadcast.muteCount,
        broadcastCount: law.display.broadcast.broadcastCount,
        bossNoiseSnapshot: law.display.broadcast.bossNoiseSnapshot,
        entryPassives: law.display.broadcast.entryPassives,
        firstClashMutedUsed: law.display.broadcast.firstClashMutedUsed,
        choices: {
          mute: choiceSnap(law.display.broadcast.choices.mute),
          broadcast: choiceSnap(law.display.broadcast.choices.broadcast),
        },
      },
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-15 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterTower = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "silent_broadcast_tower",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter silent_broadcast_tower",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const handleTrap = (state, choice = "auto") =>
    commit(state, { type: "node/handle-trap", choice }, "handle trap");
  const clearTrap = (state, nodeId, path = []) => {
    state = goto(state, path);
    return handleTrap(state);
  };
  const resolveLoot = (state) => {
    const result = application.reduceGameCommand(state, { type: "node/resolve-equipment-loot" });
    return result.status === "committed" ? result.state : state;
  };
  const fightMonster = (state, nodeId, path = []) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-15 ${nodeId} select did not enter combat`);
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-15 ${nodeId} combat did not resolve in 200 rounds`);
    }
    state = resolveLoot(state);
    return { state, rounds, hpAfter: state.player.hp };
  };
  const resolveRelay = (state, choice) => {
    const before = { noise: noise(state), rp: state.rewardPoints };
    const result = application.reduceGameCommand(state, { type: "law/resolve-broadcast-relay", choice });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0],
      noiseBefore: before.noise,
      noiseAfter: noise(after),
      rewardPointsBefore: before.rp,
      rewardPointsAfter: after.rewardPoints,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    const rtBc = bc(rt.state);
    return {
      status: rt.status,
      lawData: rtLaw.state.law,
      displayStatus: rtLaw.display.status,
      noise: rtBc?.noise,
      rewardPoints: rt.state.rewardPoints,
    };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const results = [];

  // Flow A walks all three relay consoles in order: each enter sets a pending
  // relay that blocks departure, mute/broadcast clamps noise and broadcast
  // pays 180 reward points, and a codec round-trip preserves the ordered
  // choices and reward points.
  const flowA = (() => {
    let state = hubState;
    const observations = {
      entryDisplay: undefined,
      entryModifiers: undefined,
      entryLawData: undefined,
      entryBroadcast: undefined,
      entryRewardPoints: undefined,
      gateCollect: undefined,
      northPending: undefined,
      pendingDepartureBlock: undefined,
      northResolve: undefined,
      afterAcoustic: undefined,
      centralPending: undefined,
      centralResolve: undefined,
      afterStatic: undefined,
      southPending: undefined,
      southResolve: undefined,
      finalDisplay: undefined,
      finalModifiers: undefined,
      finalLawData: undefined,
      finalRewardPoints: undefined,
      finalRunLootRewardPoints: undefined,
      noPendingResolve: undefined,
      reselectCleared: undefined,
      roundtrip: undefined,
    };
    state = enterTower(state);
    const e = lawCapture(state);
    observations.entryDisplay = e.display;
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.lawData;
    observations.entryBroadcast = e.broadcast;
    observations.entryRewardPoints = state.rewardPoints;

    state = collect(state, "broadcast_gate", ["broadcast_gate"]);
    observations.gateCollect = {
      nodeId: "broadcast_gate",
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      silenceCore: state.inventory.silence_core ?? 0,
      runSilenceCore: state.run.lootBag.items.silence_core ?? 0,
    };

    state = goto(state, ["north_entry", "north_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north relay");
    const northPending = bc(state);
    observations.northPending = {
      pendingRelayNodeId: northPending.pendingRelayNodeId,
      noise: northPending.noise,
      choices: { mute: choiceSnap(northPending.choices.mute), broadcast: choiceSnap(northPending.choices.broadcast) },
    };
    const departure = tryCommit(state, { type: "run/move", nodeId: "north_echo_cache" });
    observations.pendingDepartureBlock = {
      target: "north_echo_cache",
      status: departure.status,
      code: departure.code,
      message: departure.message,
    };
    const r1 = resolveRelay(state, "mute");
    state = r1.state;
    observations.northResolve = {
      choice: "mute",
      status: r1.status,
      log: r1.log,
      noiseBefore: r1.noiseBefore,
      noiseAfter: r1.noiseAfter,
      resolvedRelayChoices: bc(state).resolvedRelayChoices,
      muteCount: bc(state).muteCount,
    };

    state = clearTrap(state, "acoustic_tripwire", ["acoustic_tripwire"]);
    observations.afterAcoustic = {
      noise: noise(state),
      firstClashMutedUsed: bc(state).firstClashMutedUsed,
      hushbladeReason: bc(state).entryPassiveReasons.hushblade,
    };

    state = goto(state, ["dead_air_gallery", "central_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central relay");
    const centralPending = bc(state);
    observations.centralPending = {
      pendingRelayNodeId: centralPending.pendingRelayNodeId,
      noise: centralPending.noise,
      choices: { mute: choiceSnap(centralPending.choices.mute), broadcast: choiceSnap(centralPending.choices.broadcast) },
    };
    const r2 = resolveRelay(state, "broadcast");
    state = r2.state;
    observations.centralResolve = {
      choice: "broadcast",
      status: r2.status,
      log: r2.log,
      noiseBefore: r2.noiseBefore,
      noiseAfter: r2.noiseAfter,
      rewardPointsBefore: r2.rewardPointsBefore,
      rewardPointsAfter: r2.rewardPointsAfter,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      broadcastCount: bc(state).broadcastCount,
    };

    state = goto(state, ["dead_air_gallery", "acoustic_tripwire", "north_relay_console", "static_screen_trap"]);
    state = handleTrap(state);
    observations.afterStatic = { noise: noise(state) };

    state = goto(state, ["south_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south relay");
    const southPending = bc(state);
    observations.southPending = {
      pendingRelayNodeId: southPending.pendingRelayNodeId,
      noise: southPending.noise,
      choices: { mute: choiceSnap(southPending.choices.mute), broadcast: choiceSnap(southPending.choices.broadcast) },
    };
    const r3 = resolveRelay(state, "mute");
    state = r3.state;
    observations.southResolve = {
      choice: "mute",
      status: r3.status,
      log: r3.log,
      noiseBefore: r3.noiseBefore,
      noiseAfter: r3.noiseAfter,
      resolvedRelayChoices: bc(state).resolvedRelayChoices,
      muteCount: bc(state).muteCount,
      broadcastCount: bc(state).broadcastCount,
    };

    const f = lawCapture(state);
    observations.finalDisplay = f.display;
    observations.finalModifiers = f.modifiers;
    observations.finalLawData = f.lawData;
    observations.finalRewardPoints = state.rewardPoints;
    observations.finalRunLootRewardPoints = state.run.lootBag.rewardPoints ?? null;

    const noPending = resolveRelay(state, "mute");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
      noiseAfter: noPending.noiseAfter,
    };
    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "south_relay_console" });
    observations.reselectCleared = {
      status: reselect.status,
      code: reselect.code,
      message: reselect.message,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("broadcast-ordered-relay-noise");
    deepEqual(flowA.entryDisplay, expected.entryDisplay, "law-15 flow-a entry display");
    deepEqual(flowA.entryModifiers, expected.entryModifiers, "law-15 flow-a entry modifiers");
    deepEqual(flowA.entryLawData, expected.entryLawData, "law-15 flow-a entry law data");
    deepEqual(flowA.entryBroadcast, expected.entryBroadcast, "law-15 flow-a entry broadcast");
    equal(flowA.entryRewardPoints, expected.entryRewardPoints, "law-15 flow-a entry reward points");
    deepEqual(flowA.gateCollect, expected.gateCollect, "law-15 flow-a gate collect");
    deepEqual(flowA.northPending, expected.northPending, "law-15 flow-a north pending");
    deepEqual(flowA.pendingDepartureBlock, expected.pendingDepartureBlock, "law-15 flow-a pending departure block");
    deepEqual(flowA.northResolve, expected.northResolve, "law-15 flow-a north resolve");
    deepEqual(flowA.afterAcoustic, expected.afterAcoustic, "law-15 flow-a after acoustic");
    deepEqual(flowA.centralPending, expected.centralPending, "law-15 flow-a central pending");
    deepEqual(flowA.centralResolve, expected.centralResolve, "law-15 flow-a central resolve");
    deepEqual(flowA.afterStatic, expected.afterStatic, "law-15 flow-a after static");
    deepEqual(flowA.southPending, expected.southPending, "law-15 flow-a south pending");
    deepEqual(flowA.southResolve, expected.southResolve, "law-15 flow-a south resolve");
    deepEqual(flowA.finalDisplay, expected.finalDisplay, "law-15 flow-a final display");
    deepEqual(flowA.finalModifiers, expected.finalModifiers, "law-15 flow-a final modifiers");
    deepEqual(flowA.finalLawData, expected.finalLawData, "law-15 flow-a final law data");
    equal(flowA.finalRewardPoints, expected.finalRewardPoints, "law-15 flow-a final reward points");
    equal(flowA.finalRunLootRewardPoints, expected.finalRunLootRewardPoints, "law-15 flow-a final run loot reward points");
    deepEqual(flowA.noPendingResolve, expected.noPendingResolve, "law-15 flow-a no pending resolve");
    deepEqual(flowA.reselectCleared, expected.reselectCleared, "law-15 flow-a reselect cleared");
    equal(flowA.roundtrip.status, expected.roundtrip.status, "law-15 flow-a roundtrip status");
    deepEqual(flowA.roundtrip.lawData, expected.roundtrip.lawData, "law-15 flow-a roundtrip law data");
    equal(flowA.roundtrip.displayStatus, expected.roundtrip.displayStatus, "law-15 flow-a roundtrip display status");
    equal(flowA.roundtrip.noise, expected.roundtrip.noise, "law-15 flow-a roundtrip noise");
    equal(flowA.roundtrip.rewardPoints, expected.roundtrip.rewardPoints, "law-15 flow-a roundtrip reward points");
    results.push({
      id: "broadcast-ordered-relay-noise",
      status: "PASS",
      relaysResolved: flowA.southResolve.muteCount + flowA.southResolve.broadcastCount,
      broadcastRewardPoints: flowA.centralResolve.rewardPointsAfter - flowA.centralResolve.rewardPointsBefore,
    });
  }

  // Flow B exercises noise boundaries and entry passives: mute clamps at 0,
  // hushblade mutes the first dangerous clear, dead_air_headset makes mute
  // lower noise by 2, broadcast reaches the 6 cap, and resolving without a
  // pending relay or after all resolved is rejected.
  const flowB = (() => {
    let state = hubState;
    const observations = {
      entryLawData: undefined,
      entryPassiveReasons: undefined,
      entryChoices: undefined,
      northPendingChoices: undefined,
      northMute: undefined,
      reResolveNoPending: undefined,
      afterAcousticHushblade: undefined,
      centralBroadcast: undefined,
      afterStatic: undefined,
      omegaFight: undefined,
      afterSoulRecharge: undefined,
      afterStudioLock: undefined,
      southPendingChoices: undefined,
      southBroadcast: undefined,
      mimicFight: undefined,
      resolveAfterAll: undefined,
      finalDisplay: undefined,
      finalLawData: undefined,
      final: undefined,
      roundtrip: undefined,
    };
    state = enterTower(state);
    const e = lawCapture(state);
    observations.entryLawData = e.lawData;
    observations.entryPassiveReasons = e.broadcast.entryPassives
      ? bc(state).entryPassiveReasons
      : undefined;
    observations.entryChoices = {
      mute: choiceSnap(e.broadcast.choices.mute),
      broadcast: choiceSnap(e.broadcast.choices.broadcast),
    };
    state = collect(state, "broadcast_gate", ["broadcast_gate"]);

    state = goto(state, ["north_entry", "north_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north relay");
    const northPending = bc(state);
    observations.northPendingChoices = {
      mute: { available: northPending.choices.mute.available, noiseDelta: northPending.choices.mute.noiseDelta },
      broadcast: { available: northPending.choices.broadcast.available, noiseDelta: northPending.choices.broadcast.noiseDelta, bonusRewardPoints: northPending.choices.broadcast.bonusRewardPoints },
    };
    const r1 = resolveRelay(state, "mute");
    state = r1.state;
    observations.northMute = {
      status: r1.status,
      log: r1.log,
      noiseBefore: r1.noiseBefore,
      noiseAfter: r1.noiseAfter,
    };

    const reRes = resolveRelay(state, "mute");
    observations.reResolveNoPending = {
      status: reRes.status,
      code: reRes.code,
      message: reRes.message,
      noiseAfter: reRes.noiseAfter,
    };

    state = clearTrap(state, "acoustic_tripwire", ["acoustic_tripwire"]);
    observations.afterAcousticHushblade = {
      noise: noise(state),
      firstClashMutedUsed: bc(state).firstClashMutedUsed,
      hushbladeReason: bc(state).entryPassiveReasons.hushblade,
    };

    state = goto(state, ["dead_air_gallery", "central_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central relay");
    const r2 = resolveRelay(state, "broadcast");
    state = r2.state;
    observations.centralBroadcast = {
      status: r2.status,
      log: r2.log,
      noiseBefore: r2.noiseBefore,
      noiseAfter: r2.noiseAfter,
      rewardPointsBefore: r2.rewardPointsBefore,
      rewardPointsAfter: r2.rewardPointsAfter,
    };

    state = goto(state, ["dead_air_gallery", "acoustic_tripwire", "north_relay_console", "static_screen_trap"]);
    state = handleTrap(state);
    observations.afterStatic = { noise: noise(state) };

    state = goto(state, ["south_relay_console", "broadcast_warden_omega"]);
    const omega = fightMonster(state, "broadcast_warden_omega", ["broadcast_warden_omega"]);
    state = omega.state;
    observations.omegaFight = { rounds: omega.rounds, hpAfter: omega.hpAfter, noise: noise(state) };

    state = goto(state, ["emergency_shelter", "anechoic_chamber", "soul_recharge_broadcast"]);
    state = handleTrap(state);
    observations.afterSoulRecharge = { noise: noise(state) };

    state = goto(state, ["anechoic_chamber", "studio_side_lock"]);
    state = handleTrap(state);
    observations.afterStudioLock = { noise: noise(state) };

    state = goto(state, ["central_relay_console", "dead_air_gallery", "acoustic_tripwire", "north_relay_console", "static_screen_trap", "south_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south relay");
    const southPending = bc(state);
    observations.southPendingChoices = {
      mute: { available: southPending.choices.mute.available, noiseDelta: southPending.choices.mute.noiseDelta },
      broadcast: { available: southPending.choices.broadcast.available, noiseDelta: southPending.choices.broadcast.noiseDelta, bonusRewardPoints: southPending.choices.broadcast.bonusRewardPoints },
    };
    const r3 = resolveRelay(state, "broadcast");
    state = r3.state;
    observations.southBroadcast = {
      status: r3.status,
      log: r3.log,
      noiseBefore: r3.noiseBefore,
      noiseAfter: r3.noiseAfter,
      rewardPointsBefore: r3.rewardPointsBefore,
      rewardPointsAfter: r3.rewardPointsAfter,
      resolvedRelayChoices: bc(state).resolvedRelayChoices,
    };

    state = goto(state, ["dead_air_mimic"]);
    const mimic = fightMonster(state, "dead_air_mimic", ["dead_air_mimic"]);
    state = mimic.state;
    observations.mimicFight = { rounds: mimic.rounds, hpAfter: mimic.hpAfter, noise: noise(state) };

    const afterAll = resolveRelay(state, "broadcast");
    const afterAllBc = bc(state);
    observations.resolveAfterAll = {
      status: afterAll.status,
      code: afterAll.code,
      message: afterAll.message,
      choiceStatus: choiceSnap(afterAllBc.choices.broadcast),
      noiseAfter: afterAll.noiseAfter,
    };
    const f = lawCapture(state);
    observations.finalDisplay = f.display;
    observations.finalLawData = f.lawData;
    observations.final = {
      noise: noise(state),
      muteCount: bc(state).muteCount,
      broadcastCount: bc(state).broadcastCount,
      allRelaysResolved: bc(state).allRelaysResolved,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("broadcast-noise-passive-clamps");
    deepEqual(flowB.entryLawData, expected.entryLawData, "law-15 flow-b entry law data");
    deepEqual(flowB.entryPassiveReasons, expected.entryPassiveReasons, "law-15 flow-b entry passive reasons");
    deepEqual(flowB.entryChoices, expected.entryChoices, "law-15 flow-b entry choices");
    deepEqual(flowB.northPendingChoices, expected.northPendingChoices, "law-15 flow-b north pending choices");
    deepEqual(flowB.northMute, expected.northMute, "law-15 flow-b north mute");
    deepEqual(flowB.reResolveNoPending, expected.reResolveNoPending, "law-15 flow-b re-resolve no pending");
    deepEqual(flowB.afterAcousticHushblade, expected.afterAcousticHushblade, "law-15 flow-b after acoustic hushblade");
    deepEqual(flowB.centralBroadcast, expected.centralBroadcast, "law-15 flow-b central broadcast");
    deepEqual(flowB.afterStatic, expected.afterStatic, "law-15 flow-b after static");
    deepEqual(flowB.omegaFight, expected.omegaFight, "law-15 flow-b omega fight");
    deepEqual(flowB.afterSoulRecharge, expected.afterSoulRecharge, "law-15 flow-b after soul recharge");
    deepEqual(flowB.afterStudioLock, expected.afterStudioLock, "law-15 flow-b after studio lock");
    deepEqual(flowB.southPendingChoices, expected.southPendingChoices, "law-15 flow-b south pending choices");
    deepEqual(flowB.southBroadcast, expected.southBroadcast, "law-15 flow-b south broadcast");
    deepEqual(flowB.mimicFight, expected.mimicFight, "law-15 flow-b mimic fight");
    deepEqual(flowB.resolveAfterAll, expected.resolveAfterAll, "law-15 flow-b resolve after all");
    deepEqual(flowB.finalDisplay, expected.finalDisplay, "law-15 flow-b final display");
    deepEqual(flowB.finalLawData, expected.finalLawData, "law-15 flow-b final law data");
    deepEqual(flowB.final, expected.final, "law-15 flow-b final");
    equal(flowB.roundtrip.status, expected.roundtrip.status, "law-15 flow-b roundtrip status");
    deepEqual(flowB.roundtrip.lawData, expected.roundtrip.lawData, "law-15 flow-b roundtrip law data");
    equal(flowB.roundtrip.displayStatus, expected.roundtrip.displayStatus, "law-15 flow-b roundtrip display status");
    equal(flowB.roundtrip.noise, expected.roundtrip.noise, "law-15 flow-b roundtrip noise");
    equal(flowB.roundtrip.rewardPoints, expected.roundtrip.rewardPoints, "law-15 flow-b roundtrip reward points");
    results.push({
      id: "broadcast-noise-passive-clamps",
      status: "PASS",
      noiseCap: flowB.final.noise,
      hushbladeFirstClashMuted: flowB.afterAcousticHushblade.firstClashMutedUsed,
    });
  }

  // Flow C traverses the tower to each route gate source: the silent-archive
  // gate opens after 2 mutes with low noise, the resonance-vault gate stays
  // closed (mutex: 3 relays cannot give 2 mutes and 2 broadcasts), the
  // balanced-switchboard gate opens with all relays resolved and noise 2-3,
  // and the boss gate opens once all relays are resolved. Closed gates reject
  // run/move as illegal-move; open gates allow the move.
  const flowC = (() => {
    let state = hubState;
    const observations = {
      silentArchiveClosed: undefined,
      silentArchiveIllegalMove: undefined,
      leechFight: undefined,
      wardenFight: undefined,
      resonanceVaultClosed: undefined,
      resonanceVaultIllegalMove: undefined,
      silentArchiveOpen: undefined,
      silentArchiveLegalMove: undefined,
      afterStatic: undefined,
      afterSouthMute: undefined,
      omegaFight: undefined,
      afterSoulRecharge: undefined,
      balancedSwitchboardOpen: undefined,
      balancedSwitchboardLegalMove: undefined,
      bossGateOpen: undefined,
      final: undefined,
    };
    state = enterTower(state);
    state = collect(state, "broadcast_gate", ["broadcast_gate"]);

    state = goto(state, ["north_entry", "north_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    state = resolveRelay(state, "mute").state;
    state = goto(state, ["north_echo_cache"]);
    observations.silentArchiveClosed = gateCheck(state, "silent_archive");
    const illegal1 = tryCommit(state, { type: "run/move", nodeId: "silent_archive" });
    observations.silentArchiveIllegalMove = {
      target: "silent_archive",
      status: illegal1.status,
      code: illegal1.code,
      message: illegal1.message,
    };

    state = goto(state, ["north_signal_cache"]);
    const leech = fightMonster(state, "frequency_leech_north", ["frequency_leech_north"]);
    state = leech.state;
    observations.leechFight = { rounds: leech.rounds, hpAfter: leech.hpAfter, noise: noise(state) };
    const warden = fightMonster(state, "broadcast_warden_north", ["broadcast_warden_north"]);
    state = warden.state;
    observations.wardenFight = { rounds: warden.rounds, hpAfter: warden.hpAfter, noise: noise(state) };
    observations.resonanceVaultClosed = gateCheck(state, "resonance_vault");
    const illegal2 = tryCommit(state, { type: "run/move", nodeId: "resonance_vault" });
    observations.resonanceVaultIllegalMove = {
      target: "resonance_vault",
      status: illegal2.status,
      code: illegal2.code,
      message: illegal2.message,
    };

    state = goto(state, ["central_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    state = resolveRelay(state, "mute").state;
    state = goto(state, ["broadcast_warden_north", "frequency_leech_north", "north_signal_cache", "north_echo_cache"]);
    observations.silentArchiveOpen = gateCheck(state, "silent_archive");
    const legal1 = tryCommit(state, { type: "run/move", nodeId: "silent_archive" });
    observations.silentArchiveLegalMove = { target: "silent_archive", status: legal1.status };
    if (legal1.status === "committed") state = legal1.state;
    state = goto(state, ["north_echo_cache"]);

    state = goto(state, ["north_relay_console", "static_screen_trap"]);
    state = handleTrap(state);
    observations.afterStatic = { noise: noise(state) };
    state = goto(state, ["south_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    state = resolveRelay(state, "mute").state;
    observations.afterSouthMute = {
      noise: noise(state),
      muteCount: bc(state).muteCount,
      allRelaysResolved: bc(state).allRelaysResolved,
    };

    state = goto(state, ["broadcast_warden_omega"]);
    const omega = fightMonster(state, "broadcast_warden_omega", ["broadcast_warden_omega"]);
    state = omega.state;
    observations.omegaFight = { rounds: omega.rounds, hpAfter: omega.hpAfter, noise: noise(state) };
    state = goto(state, ["emergency_shelter", "anechoic_chamber", "soul_recharge_broadcast"]);
    state = handleTrap(state);
    observations.afterSoulRecharge = { noise: noise(state) };
    observations.balancedSwitchboardOpen = gateCheck(state, "balanced_switchboard");
    const legal2 = tryCommit(state, { type: "run/move", nodeId: "balanced_switchboard" });
    observations.balancedSwitchboardLegalMove = { target: "balanced_switchboard", status: legal2.status };
    if (legal2.status === "committed") state = legal2.state;
    state = goto(state, ["soul_recharge_broadcast"]);

    state = goto(state, ["anechoic_chamber", "emergency_shelter", "broadcast_warden_omega", "broadcast_memory_stage"]);
    observations.bossGateOpen = gateCheck(state, "last_broadcaster");
    observations.final = {
      noise: noise(state),
      muteCount: bc(state).muteCount,
      broadcastCount: bc(state).broadcastCount,
      resolvedRelayChoices: bc(state).resolvedRelayChoices,
      allRelaysResolved: bc(state).allRelaysResolved,
    };
    return observations;
  })();

  {
    const expected = expectedById.get("broadcast-region-gates");
    deepEqual(flowC.silentArchiveClosed, expected.silentArchiveClosed, "law-15 flow-c silent archive closed");
    deepEqual(flowC.silentArchiveIllegalMove, expected.silentArchiveIllegalMove, "law-15 flow-c silent archive illegal move");
    deepEqual(flowC.leechFight, expected.leechFight, "law-15 flow-c leech fight");
    deepEqual(flowC.wardenFight, expected.wardenFight, "law-15 flow-c warden fight");
    deepEqual(flowC.resonanceVaultClosed, expected.resonanceVaultClosed, "law-15 flow-c resonance vault closed");
    deepEqual(flowC.resonanceVaultIllegalMove, expected.resonanceVaultIllegalMove, "law-15 flow-c resonance vault illegal move");
    deepEqual(flowC.silentArchiveOpen, expected.silentArchiveOpen, "law-15 flow-c silent archive open");
    deepEqual(flowC.silentArchiveLegalMove, expected.silentArchiveLegalMove, "law-15 flow-c silent archive legal move");
    deepEqual(flowC.afterStatic, expected.afterStatic, "law-15 flow-c after static");
    deepEqual(flowC.afterSouthMute, expected.afterSouthMute, "law-15 flow-c after south mute");
    deepEqual(flowC.omegaFight, expected.omegaFight, "law-15 flow-c omega fight");
    deepEqual(flowC.afterSoulRecharge, expected.afterSoulRecharge, "law-15 flow-c after soul recharge");
    deepEqual(flowC.balancedSwitchboardOpen, expected.balancedSwitchboardOpen, "law-15 flow-c balanced switchboard open");
    deepEqual(flowC.balancedSwitchboardLegalMove, expected.balancedSwitchboardLegalMove, "law-15 flow-c balanced switchboard legal move");
    deepEqual(flowC.bossGateOpen, expected.bossGateOpen, "law-15 flow-c boss gate open");
    deepEqual(flowC.final, expected.final, "law-15 flow-c final");
    results.push({
      id: "broadcast-region-gates",
      status: "PASS",
      gatesOpened: [flowC.silentArchiveOpen.gateId, flowC.balancedSwitchboardOpen.gateId, flowC.bossGateOpen.gateId],
      mutexGateClosed: flowC.resonanceVaultClosed.gateId,
    });
  }

  // Flow D resolves all relays mute, builds noise 2, then starts the
  // last_broadcaster boss combat: run/select-node freezes bossNoiseSnapshot =
  // clamp(noise - lastChannelBeacon, 0, 6) = 1 and freezes further relay
  // tuning. The boss is a real 7-round combat, and a codec round-trip
  // preserves the frozen snapshot.
  const flowD = (() => {
    let state = hubState;
    const observations = {
      beforeBoss: undefined,
      bossEntryBeforeSelect: undefined,
      bossEntry: undefined,
      bossFight: undefined,
      bossLawAtStart: undefined,
      resolveAfterBoss: undefined,
      roundtrip: undefined,
    };
    state = enterTower(state);
    state = collect(state, "broadcast_gate", ["broadcast_gate"]);

    state = goto(state, ["north_entry", "north_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    state = resolveRelay(state, "mute").state;
    state = clearTrap(state, "acoustic_tripwire", ["acoustic_tripwire"]);
    state = goto(state, ["dead_air_gallery", "central_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    state = resolveRelay(state, "mute").state;
    state = goto(state, ["dead_air_gallery", "acoustic_tripwire", "north_relay_console", "static_screen_trap"]);
    state = handleTrap(state);
    state = goto(state, ["south_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    state = resolveRelay(state, "mute").state;
    state = goto(state, ["broadcast_warden_omega"]);
    const omega = fightMonster(state, "broadcast_warden_omega", ["broadcast_warden_omega"]);
    state = omega.state;
    state = goto(state, ["emergency_shelter", "anechoic_chamber", "soul_recharge_broadcast"]);
    state = handleTrap(state);
    observations.beforeBoss = {
      noise: noise(state),
      bossNoiseSnapshot: bc(state).bossNoiseSnapshot,
      allRelaysResolved: bc(state).allRelaysResolved,
      choicesAvailable: bc(state).choices.mute.available,
    };

    state = goto(state, ["anechoic_chamber", "emergency_shelter", "broadcast_warden_omega", "broadcast_memory_stage"]);
    state = goto(state, ["last_broadcaster"]);
    observations.bossEntryBeforeSelect = { noise: noise(state), bossNoiseSnapshot: bc(state).bossNoiseSnapshot };
    state = commit(state, { type: "run/select-node", nodeId: "last_broadcaster" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-15 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    const combatAtStart = state.combat;
    observations.bossEntry = {
      noise: noise(state),
      bossNoiseSnapshot: bc(state).bossNoiseSnapshot,
      choicesAvailable: bc(state).choices.mute.available,
      frozenReason: bc(state).choices.mute.unavailableReason ?? null,
      monsterHp: combatAtStart?.monsterHp,
      bossPhase: combatAtStart?.bossPhase,
      turn: combatAtStart?.turn,
    };
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `boss attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-15 boss combat did not resolve in 200 rounds");
    }
    observations.bossFight = {
      rounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("last_broadcaster"),
    };
    observations.bossLawAtStart = {
      lawData: lawAtStart.lawData,
      display: lawAtStart.display,
      modifiers: lawAtStart.modifiers,
    };

    const after = resolveRelay(state, "mute");
    const afterBc = bc(state);
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
      choiceStatus: choiceSnap(afterBc.choices.mute),
      noiseAfter: after.noiseAfter,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("broadcast-boss-snapshot");
    deepEqual(flowD.beforeBoss, expected.beforeBoss, "law-15 flow-d before boss");
    deepEqual(flowD.bossEntryBeforeSelect, expected.bossEntryBeforeSelect, "law-15 flow-d boss entry before select");
    deepEqual(flowD.bossEntry, expected.bossEntry, "law-15 flow-d boss entry");
    deepEqual(flowD.bossFight, expected.bossFight, "law-15 flow-d boss fight");
    deepEqual(flowD.bossLawAtStart.lawData, expected.bossLawAtStart.lawData, "law-15 flow-d boss law at start law data");
    deepEqual(flowD.bossLawAtStart.display, expected.bossLawAtStart.display, "law-15 flow-d boss law at start display");
    deepEqual(flowD.bossLawAtStart.modifiers, expected.bossLawAtStart.modifiers, "law-15 flow-d boss law at start modifiers");
    deepEqual(flowD.resolveAfterBoss, expected.resolveAfterBoss, "law-15 flow-d resolve after boss");
    equal(flowD.roundtrip.status, expected.roundtrip.status, "law-15 flow-d roundtrip status");
    deepEqual(flowD.roundtrip.lawData, expected.roundtrip.lawData, "law-15 flow-d roundtrip law data");
    equal(flowD.roundtrip.displayStatus, expected.roundtrip.displayStatus, "law-15 flow-d roundtrip display status");
    equal(flowD.roundtrip.noise, expected.roundtrip.noise, "law-15 flow-d roundtrip noise");
    equal(flowD.roundtrip.rewardPoints, expected.roundtrip.rewardPoints, "law-15 flow-d roundtrip reward points");
    results.push({
      id: "broadcast-boss-snapshot",
      status: "PASS",
      bossNoiseSnapshot: flowD.bossEntry.bossNoiseSnapshot,
      bossRounds: flowD.bossFight.rounds,
      frozenReason: flowD.resolveAfterBoss.choiceStatus.unavailableReason,
    });
  }

  // Flow E broadcasts all three relays: each broadcast produces 180 reward
  // points on both the durable and run-loot tracks, node rewards add to both
  // tracks, and a codec round-trip preserves the reward points and law state.
  const flowE = (() => {
    let state = hubState;
    const observations = {
      entryRewardPoints: undefined,
      afterGate: undefined,
      northBroadcast: undefined,
      centralNodeReward: undefined,
      centralBroadcast: undefined,
      southBroadcast: undefined,
      final: undefined,
      roundtrip: undefined,
    };
    state = enterTower(state);
    observations.entryRewardPoints = state.rewardPoints;
    state = collect(state, "broadcast_gate", ["broadcast_gate"]);
    observations.afterGate = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      silenceCore: state.inventory.silence_core ?? 0,
      runSilenceCore: state.run.lootBag.items.silence_core ?? 0,
    };

    state = goto(state, ["north_entry", "north_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    const rp1 = state.rewardPoints;
    const r1 = resolveRelay(state, "broadcast");
    state = r1.state;
    observations.northBroadcast = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: rp1,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp1,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    state = clearTrap(state, "acoustic_tripwire", ["acoustic_tripwire"]);
    state = goto(state, ["dead_air_gallery", "central_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    observations.centralNodeReward = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      silenceCore: state.inventory.silence_core ?? 0,
      runSilenceCore: state.run.lootBag.items.silence_core ?? 0,
    };
    const rp2 = state.rewardPoints;
    const r2 = resolveRelay(state, "broadcast");
    state = r2.state;
    observations.centralBroadcast = {
      status: r2.status,
      log: r2.log,
      rewardPointsBefore: rp2,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp2,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    state = goto(state, ["dead_air_gallery", "acoustic_tripwire", "north_relay_console", "static_screen_trap"]);
    state = handleTrap(state);
    state = goto(state, ["south_relay_console"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    const rp3 = state.rewardPoints;
    const r3 = resolveRelay(state, "broadcast");
    state = r3.state;
    observations.southBroadcast = {
      status: r3.status,
      log: r3.log,
      rewardPointsBefore: rp3,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp3,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    const b = bc(state);
    observations.final = {
      noise: noise(state),
      muteCount: b.muteCount,
      broadcastCount: b.broadcastCount,
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      resolvedRelayChoices: b.resolvedRelayChoices,
      allRelaysResolved: b.allRelaysResolved,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("broadcast-reward-inheritance");
    equal(flowE.entryRewardPoints, expected.entryRewardPoints, "law-15 flow-e entry reward points");
    deepEqual(flowE.afterGate, expected.afterGate, "law-15 flow-e after gate");
    deepEqual(flowE.northBroadcast, expected.northBroadcast, "law-15 flow-e north broadcast");
    deepEqual(flowE.centralNodeReward, expected.centralNodeReward, "law-15 flow-e central node reward");
    deepEqual(flowE.centralBroadcast, expected.centralBroadcast, "law-15 flow-e central broadcast");
    deepEqual(flowE.southBroadcast, expected.southBroadcast, "law-15 flow-e south broadcast");
    deepEqual(flowE.final, expected.final, "law-15 flow-e final");
    equal(flowE.roundtrip.status, expected.roundtrip.status, "law-15 flow-e roundtrip status");
    deepEqual(flowE.roundtrip.lawData, expected.roundtrip.lawData, "law-15 flow-e roundtrip law data");
    equal(flowE.roundtrip.displayStatus, expected.roundtrip.displayStatus, "law-15 flow-e roundtrip display status");
    equal(flowE.roundtrip.noise, expected.roundtrip.noise, "law-15 flow-e roundtrip noise");
    equal(flowE.roundtrip.rewardPoints, expected.roundtrip.rewardPoints, "law-15 flow-e roundtrip reward points");
    results.push({
      id: "broadcast-reward-inheritance",
      status: "PASS",
      broadcastRewardPoints: flowE.northBroadcast.delta + flowE.centralBroadcast.delta + flowE.southBroadcast.delta,
      finalRewardPoints: flowE.final.rewardPoints,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law16Shelter({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-16 shelter legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-16 shelter legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-16 shelter decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-16 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const ec = (state) => core.getCurrentEscortCheckpointStatus(state);
  const choiceSnap = (c) => ({
    available: c.available,
    survivorHpDelta: c.survivorHpDelta,
    healingPillCost: c.healingPillCost,
    bonusRewardPoints: c.bonusRewardPoints,
    unavailableReason: c.unavailableReason ?? null,
  });
  const lawDataSnap = (state) => {
    const l = core.getCurrentDungeonLaw(state).state.law;
    return {
      kind: l.kind,
      survivorHp: l.survivorHp,
      pendingCheckpointNodeId: l.pendingCheckpointNodeId,
      resolvedCheckpointChoices: l.resolvedCheckpointChoices,
      bossSurvivorSnapshot: l.bossSurvivorSnapshot,
      entryGear: l.entryGear,
      entryCompanion: l.entryCompanion,
      firstHazardGuardUsed: l.firstHazardGuardUsed,
      companionAnalysisUsed: l.companionAnalysisUsed,
      companionTriageUsed: l.companionTriageUsed,
    };
  };
  const escortSnap = (state) => {
    const s = ec(state);
    return {
      available: s.available,
      pending: s.pending,
      survivorHp: s.survivorHp,
      availableHealingPills: s.availableHealingPills,
      pendingCheckpointNodeId: s.pendingCheckpointNodeId,
      resolvedCheckpointChoices: s.resolvedCheckpointChoices,
      resolvedCount: s.resolvedCount,
      treatCount: s.treatCount,
      pushCount: s.pushCount,
      allCheckpointsResolved: s.allCheckpointsResolved,
      bossSurvivorSnapshot: s.bossSurvivorSnapshot,
      entryGear: s.entryGear,
      entryCompanion: s.entryCompanion,
      firstHazardGuardUsed: s.firstHazardGuardUsed,
      companionAnalysisUsed: s.companionAnalysisUsed,
      companionTriageUsed: s.companionTriageUsed,
      companionRole: s.companionRole,
      choices: { treat: choiceSnap(s.choices.treat), push: choiceSnap(s.choices.push) },
    };
  };
  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-16 shelter law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: lawDataSnap(state),
      escort: escortSnap(state),
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-16 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterShelter = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "lost_shelter",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter lost_shelter",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const handleTrap = (state, choice = "auto") =>
    commit(state, { type: "node/handle-trap", choice }, "handle trap");
  const clearTrap = (state, nodeId, path = []) => {
    state = goto(state, path);
    return handleTrap(state);
  };
  const resolveLoot = (state) => {
    const result = application.reduceGameCommand(state, { type: "node/resolve-equipment-loot" });
    return result.status === "committed" ? result.state : state;
  };
  const resolveRelicDraft = (state) => {
    const pending = state.run?.relicState?.pendingDraft;
    if (!pending) return state;
    const relicId = pending.candidateIds[0];
    return commit(
      state,
      { type: "node/resolve-relic-draft", draftId: pending.draftId, relicId },
      "resolve relic draft",
    );
  };
  const fightMonster = (state, nodeId, path = [], useAssist = false) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-16 ${nodeId} select did not enter combat`);
    }
    let assist = null;
    if (useAssist) {
      const before = core.getCurrentCompanionAssistStatus(state);
      const res = tryCommit(state, { type: "combat/use-companion-assist" });
      assist = {
        beforeAvailable: before.available,
        beforeReason: before.reason,
        effect: before.effect,
        status: res.status,
        code: res.code,
        log: res.state.combat?.log?.[0] ?? null,
        guarding: res.state.combat?.guarding ?? null,
        weaponFocus: res.state.combat?.weaponFocus ?? null,
        companionAssistUsed: res.state.combat?.companionAssistUsed ?? null,
      };
      if (res.status === "committed") state = res.state;
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-16 ${nodeId} combat did not resolve in 200 rounds`);
    }
    state = resolveLoot(state);
    return { state, rounds, hpAfter: state.player.hp, survivorHp: ec(state)?.survivorHp, assist };
  };
  const resolveCheckpoint = (state, choice) => {
    const before = { hp: ec(state).survivorHp, rp: state.rewardPoints, pills: ec(state).availableHealingPills };
    const result = application.reduceGameCommand(state, { type: "law/resolve-escort-checkpoint", choice });
    const after = result.status === "committed" ? result.state : state;
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0] ?? null,
      survivorHpBefore: before.hp,
      survivorHpAfter: ec(after)?.survivorHp,
      rewardPointsBefore: before.rp,
      rewardPointsAfter: after.rewardPoints,
      availablePillsAfter: ec(after)?.availableHealingPills,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: rtLaw.state.law,
      displayStatus: rtLaw.display.status,
      survivorHp: ec(rt.state)?.survivorHp,
      rewardPoints: rt.state.rewardPoints,
    };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const expectFlow = (observations, expected, label) => {
    // The fixture is a JSON artifact, so undefined observation fields (e.g. a
    // committed tryCommit has no code/message) are normalized away before the
    // deep-strict comparison against the frozen expected values.
    const normalized = JSON.parse(JSON.stringify(observations));
    deepEqual(
      Object.keys(normalized).sort(),
      Object.keys(expected).sort(),
      `law-16 ${label} observation keys`,
    );
    for (const [key, value] of Object.entries(expected)) {
      deepEqual(normalized[key], value, `law-16 ${label} ${key}`);
    }
  };
  const results = [];

  // Flow A walks all three checkpoints in order north(treat)/central(push)/south(treat):
  // entry freezes survivor HP at 100 with the escort kit and qin_che companion, each
  // checkpoint enter sets a pending choice that blocks departure, treat heals and costs
  // a run healing pill, push pays 200 reward points on both tracks, and the
  // evacuation_cache gate opens at HP 100 while the desperate_armory gate stays closed.
  const flowA = (() => {
    let state = hubState;
    const observations = {};
    state = enterShelter(state);
    const e = lawCapture(state);
    observations.entryDisplay = e.display;
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.lawData;
    observations.entryEscort = e.escort;
    observations.entryRewardPoints = state.rewardPoints;

    state = collect(state, "shelter_gate", ["shelter_gate"]);
    observations.gateCollect = {
      nodeId: "shelter_gate",
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      healingPill: state.inventory.healing_pill,
      runHealingPill: state.run.lootBag.items.healing_pill ?? 0,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };

    state = collect(state, "north_entry", ["north_entry"]);
    observations.northEntryCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    state = clearTrap(state, "collapsed_hall_trap", ["collapsed_hall_trap"]);
    observations.afterCollapsed = {
      survivorHp: ec(state).survivorHp,
      firstHazardGuardUsed: ec(state).firstHazardGuardUsed,
      playerHp: state.player.hp,
    };

    state = collect(state, "north_supply_cache", ["north_supply_cache"]);
    const patrol = fightMonster(state, "north_rescue_patrol", ["north_rescue_patrol"]);
    state = patrol.state;
    observations.patrolFight = { rounds: patrol.rounds, hpAfter: patrol.hpAfter, survivorHp: patrol.survivorHp };

    state = collect(state, "north_checkpoint", ["north_checkpoint"]);
    observations.northPending = {
      pendingCheckpointNodeId: ec(state).pendingCheckpointNodeId,
      survivorHp: ec(state).survivorHp,
      choices: { treat: choiceSnap(ec(state).choices.treat), push: choiceSnap(ec(state).choices.push) },
    };
    const departure = tryCommit(state, { type: "run/move", nodeId: "shelter_enforcer_north" });
    observations.pendingDepartureBlock = {
      target: "shelter_enforcer_north",
      status: departure.status,
      code: departure.code,
      message: departure.message,
    };

    const r1 = resolveCheckpoint(state, "treat");
    state = r1.state;
    observations.northResolve = {
      choice: "treat",
      status: r1.status,
      log: r1.log,
      survivorHpBefore: r1.survivorHpBefore,
      survivorHpAfter: r1.survivorHpAfter,
      availablePillsAfter: r1.availablePillsAfter,
      resolvedCheckpointChoices: ec(state).resolvedCheckpointChoices,
      treatCount: ec(state).treatCount,
    };

    state = collect(state, "central_checkpoint", ["central_checkpoint"]);
    observations.centralPending = {
      pendingCheckpointNodeId: ec(state).pendingCheckpointNodeId,
      survivorHp: ec(state).survivorHp,
      choices: { treat: choiceSnap(ec(state).choices.treat), push: choiceSnap(ec(state).choices.push) },
    };
    const r2 = resolveCheckpoint(state, "push");
    state = r2.state;
    observations.centralResolve = {
      choice: "push",
      status: r2.status,
      log: r2.log,
      survivorHpBefore: r2.survivorHpBefore,
      survivorHpAfter: r2.survivorHpAfter,
      rewardPointsBefore: r2.rewardPointsBefore,
      rewardPointsAfter: r2.rewardPointsAfter,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      pushCount: ec(state).pushCount,
    };

    state = collect(state, "survivor_cell", ["survivor_cell"]);
    state = goto(state, ["collapsed_hall_trap"]);
    state = clearTrap(state, "alarm_grid_trap", ["alarm_grid_trap"]);
    observations.afterAlarm = { survivorHp: ec(state).survivorHp, playerHp: state.player.hp };

    state = collect(state, "south_checkpoint", ["south_checkpoint"]);
    observations.southPending = {
      pendingCheckpointNodeId: ec(state).pendingCheckpointNodeId,
      survivorHp: ec(state).survivorHp,
      choices: { treat: choiceSnap(ec(state).choices.treat), push: choiceSnap(ec(state).choices.push) },
    };
    const r3 = resolveCheckpoint(state, "treat");
    state = r3.state;
    observations.southResolve = {
      choice: "treat",
      status: r3.status,
      log: r3.log,
      survivorHpBefore: r3.survivorHpBefore,
      survivorHpAfter: r3.survivorHpAfter,
      resolvedCheckpointChoices: ec(state).resolvedCheckpointChoices,
      treatCount: ec(state).treatCount,
      pushCount: ec(state).pushCount,
    };

    const f = lawCapture(state);
    observations.finalDisplay = f.display;
    observations.finalModifiers = f.modifiers;
    observations.finalLawData = f.lawData;
    observations.finalRewardPoints = state.rewardPoints;
    observations.finalRunLootRewardPoints = state.run.lootBag.rewardPoints ?? null;

    const noPending = resolveCheckpoint(state, "treat");
    observations.noPendingResolve = {
      status: noPending.status,
      code: noPending.code,
      message: noPending.message,
      survivorHpAfter: noPending.survivorHpAfter,
    };
    const reselect = tryCommit(state, { type: "run/select-node", nodeId: "south_checkpoint" });
    observations.reselectCleared = { status: reselect.status, code: reselect.code, message: reselect.message };

    state = goto(state, ["alarm_grid_trap", "collapsed_hall_trap", "north_entry"]);
    observations.evacuationOpen = gateCheck(state, "evacuation_cache");
    const legalEvac = tryCommit(state, { type: "run/move", nodeId: "evacuation_cache" });
    observations.evacuationLegalMove = {
      target: "evacuation_cache",
      status: legalEvac.status,
      code: legalEvac.code,
      message: legalEvac.message,
    };
    if (legalEvac.status === "committed") state = legalEvac.state;
    state = commit(state, { type: "node/collect-reward" }, "collect evacuation_cache");
    state = resolveRelicDraft(state);
    observations.evacuationCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      rescueBadge: state.inventory.rescue_badge,
      methodPage: state.inventory.method_page,
    };

    state = goto(state, ["north_entry", "collapsed_hall_trap", "north_supply_cache", "north_rescue_patrol", "north_checkpoint", "central_checkpoint", "mimic_survivor_alpha"]);
    observations.desperateClosed = gateCheck(state, "desperate_armory");
    const illegalDesperate = tryCommit(state, { type: "run/move", nodeId: "desperate_armory" });
    observations.desperateIllegalMove = {
      target: "desperate_armory",
      status: illegalDesperate.status,
      code: illegalDesperate.code,
      message: illegalDesperate.message,
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("shelter-ordered-checkpoint-escort");
    expectFlow(flowA, expected, "flow-a");
    results.push({
      id: "shelter-ordered-checkpoint-escort",
      status: "PASS",
      checkpointsResolved: flowA.southResolve.treatCount + flowA.southResolve.pushCount,
      pushRewardPoints: flowA.centralResolve.rewardPointsAfter - flowA.centralResolve.rewardPointsBefore,
    });
  }

  // Flow B exercises hazard guard, gear reduction, HP clamps, severity, and the
  // balanced_medbay band: the first hazard is guarded by qin_che, the carbine and
  // plate reduce trap/monster losses, treat clamps at 100, and after the horror
  // fight drops HP to 62 the balanced_medbay gate (41-74) opens.
  const flowB = (() => {
    let state = hubState;
    const observations = {};
    state = enterShelter(state);
    state = collect(state, "shelter_gate", ["shelter_gate"]);

    state = clearTrap(state, "alarm_grid_trap", ["alarm_grid_trap"]);
    observations.afterAlarmGuarded = {
      survivorHp: ec(state).survivorHp,
      firstHazardGuardUsed: ec(state).firstHazardGuardUsed,
      companionRole: ec(state).companionRole,
    };

    state = clearTrap(state, "collapsed_hall_trap", ["collapsed_hall_trap"]);
    observations.afterCollapsed = { survivorHp: ec(state).survivorHp };

    state = collect(state, "north_supply_cache", ["north_supply_cache"]);
    const patrol = fightMonster(state, "north_rescue_patrol", ["north_rescue_patrol"]);
    state = patrol.state;
    observations.afterPatrol = { survivorHp: patrol.survivorHp, rounds: patrol.rounds, hpAfter: patrol.hpAfter };

    state = collect(state, "north_checkpoint", ["north_checkpoint"]);
    const r1 = resolveCheckpoint(state, "treat");
    state = r1.state;
    observations.northTreat = {
      status: r1.status,
      log: r1.log,
      survivorHpBefore: r1.survivorHpBefore,
      survivorHpAfter: r1.survivorHpAfter,
      availablePillsAfter: r1.availablePillsAfter,
    };

    const enforcer = fightMonster(state, "shelter_enforcer_north", ["shelter_enforcer_north"]);
    state = enforcer.state;
    observations.afterEnforcer = { survivorHp: enforcer.survivorHp, rounds: enforcer.rounds, hpAfter: enforcer.hpAfter };

    const mimic = fightMonster(state, "mimic_survivor_alpha", ["mimic_survivor_alpha"]);
    state = mimic.state;
    observations.afterMimic = { survivorHp: mimic.survivorHp, rounds: mimic.rounds, hpAfter: mimic.hpAfter };

    state = collect(state, "central_checkpoint", ["central_checkpoint"]);
    const r2 = resolveCheckpoint(state, "push");
    state = r2.state;
    observations.centralPush = {
      status: r2.status,
      log: r2.log,
      survivorHpBefore: r2.survivorHpBefore,
      survivorHpAfter: r2.survivorHpAfter,
      rewardPointsBefore: r2.rewardPointsBefore,
      rewardPointsAfter: r2.rewardPointsAfter,
    };

    state = collect(state, "survivor_cell", ["survivor_cell"]);
    state = goto(state, ["collapsed_hall_trap", "alarm_grid_trap", "south_checkpoint"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    const r3 = resolveCheckpoint(state, "push");
    state = r3.state;
    observations.southPush = {
      status: r3.status,
      log: r3.log,
      survivorHpBefore: r3.survivorHpBefore,
      survivorHpAfter: r3.survivorHpAfter,
      rewardPointsBefore: r3.rewardPointsBefore,
      rewardPointsAfter: r3.rewardPointsAfter,
    };

    const f = lawCapture(state);
    observations.finalDisplay = f.display;
    observations.finalLawData = f.lawData;
    observations.final = {
      survivorHp: ec(state).survivorHp,
      treatCount: ec(state).treatCount,
      pushCount: ec(state).pushCount,
      allCheckpointsResolved: ec(state).allCheckpointsResolved,
    };

    const horror = fightMonster(state, "evacuation_horror_omega", ["evacuation_horror_omega"]);
    state = horror.state;
    observations.afterHorror = { survivorHp: horror.survivorHp, rounds: horror.rounds, hpAfter: horror.hpAfter };

    state = collect(state, "emergency_medbay", ["emergency_medbay"]);
    state = collect(state, "containment_bay", ["containment_bay"]);
    state = goto(state, ["lower_return_portal"]);
    observations.balancedOpen = gateCheck(state, "balanced_medbay");
    const legalBalanced = tryCommit(state, { type: "run/move", nodeId: "balanced_medbay" });
    observations.balancedLegalMove = {
      target: "balanced_medbay",
      status: legalBalanced.status,
      code: legalBalanced.code,
      message: legalBalanced.message,
    };
    if (legalBalanced.status === "committed") state = legalBalanced.state;
    state = commit(state, { type: "node/collect-reward" }, "collect balanced_medbay");
    observations.balancedCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      lingyun: state.lingyun,
      healingPill: state.inventory.healing_pill,
      armorPatch: state.inventory.armor_patch,
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("shelter-hazard-guard-and-hp-clamps");
    expectFlow(flowB, expected, "flow-b");
    results.push({
      id: "shelter-hazard-guard-and-hp-clamps",
      status: "PASS",
      firstHazardGuardUsed: flowB.afterAlarmGuarded.firstHazardGuardUsed,
      balancedGateId: flowB.balancedOpen.gateId,
    });
  }

  // Flow C drives the companion assist and the desperate_armory band: qin_che's
  // rank-2 assist guards the first hazard and commits in the patrol fight, all
  // three checkpoints are pushed, and after the horror fight drops HP to 36 the
  // desperate_armory gate (<=40) opens while balanced_medbay (41-74) and
  // evacuation_cache (>=75) stay closed, proving the three-band mutex.
  const flowC = (() => {
    let state = hubState;
    const observations = {};
    state = enterShelter(state);
    observations.entryCompanion = lawDataSnap(state).entryCompanion;
    observations.entryCompanionRole = ec(state).companionRole;
    state = collect(state, "shelter_gate", ["shelter_gate"]);
    state = collect(state, "north_entry", ["north_entry"]);
    state = clearTrap(state, "collapsed_hall_trap", ["collapsed_hall_trap"]);
    observations.afterCollapsedGuarded = {
      survivorHp: ec(state).survivorHp,
      firstHazardGuardUsed: ec(state).firstHazardGuardUsed,
    };

    state = collect(state, "north_supply_cache", ["north_supply_cache"]);
    const patrol = fightMonster(state, "north_rescue_patrol", ["north_rescue_patrol"], true);
    state = patrol.state;
    observations.patrolAssist = {
      rounds: patrol.rounds,
      hpAfter: patrol.hpAfter,
      survivorHp: patrol.survivorHp,
      assist: patrol.assist,
    };

    state = collect(state, "north_checkpoint", ["north_checkpoint"]);
    state = resolveCheckpoint(state, "push").state;
    observations.afterNorthPush = { survivorHp: ec(state).survivorHp, rewardPoints: state.rewardPoints };

    const enforcer = fightMonster(state, "shelter_enforcer_north", ["shelter_enforcer_north"]);
    state = enforcer.state;
    observations.afterEnforcer = { survivorHp: enforcer.survivorHp };

    const mimic = fightMonster(state, "mimic_survivor_alpha", ["mimic_survivor_alpha"]);
    state = mimic.state;
    observations.afterMimic = { survivorHp: mimic.survivorHp };

    state = collect(state, "central_checkpoint", ["central_checkpoint"]);
    state = resolveCheckpoint(state, "push").state;
    observations.afterCentralPush = { survivorHp: ec(state).survivorHp, rewardPoints: state.rewardPoints };

    state = collect(state, "survivor_cell", ["survivor_cell"]);
    state = goto(state, ["collapsed_hall_trap"]);
    state = clearTrap(state, "alarm_grid_trap", ["alarm_grid_trap"]);
    observations.afterAlarm = { survivorHp: ec(state).survivorHp };

    state = collect(state, "south_checkpoint", ["south_checkpoint"]);
    state = resolveCheckpoint(state, "push").state;
    observations.afterSouthPush = {
      survivorHp: ec(state).survivorHp,
      rewardPoints: state.rewardPoints,
      allResolved: ec(state).allCheckpointsResolved,
    };

    const horror = fightMonster(state, "evacuation_horror_omega", ["evacuation_horror_omega"]);
    state = horror.state;
    observations.afterHorror = { survivorHp: horror.survivorHp, rounds: horror.rounds, hpAfter: horror.hpAfter };

    state = collect(state, "emergency_medbay", ["emergency_medbay"]);
    state = collect(state, "containment_bay", ["containment_bay"]);
    state = goto(state, ["lower_return_portal"]);
    observations.balancedClosed = gateCheck(state, "balanced_medbay");
    const illegalBalanced = tryCommit(state, { type: "run/move", nodeId: "balanced_medbay" });
    observations.balancedIllegalMove = {
      target: "balanced_medbay",
      status: illegalBalanced.status,
      code: illegalBalanced.code,
      message: illegalBalanced.message,
    };

    state = goto(state, ["containment_bay", "emergency_medbay", "evacuation_horror_omega", "south_checkpoint", "alarm_grid_trap", "collapsed_hall_trap", "survivor_cell", "central_checkpoint", "mimic_survivor_alpha"]);
    observations.desperateOpen = gateCheck(state, "desperate_armory");
    const legalDesperate = tryCommit(state, { type: "run/move", nodeId: "desperate_armory" });
    observations.desperateLegalMove = {
      target: "desperate_armory",
      status: legalDesperate.status,
      code: legalDesperate.code,
      message: legalDesperate.message,
    };
    if (legalDesperate.status === "committed") state = legalDesperate.state;
    state = commit(state, { type: "node/collect-reward" }, "collect desperate_armory");
    state = resolveRelicDraft(state);
    observations.desperateCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      rescueBadge: state.inventory.rescue_badge,
    };

    state = goto(state, ["mimic_survivor_alpha", "central_checkpoint", "north_checkpoint", "north_rescue_patrol", "north_supply_cache", "collapsed_hall_trap", "north_entry"]);
    observations.evacuationClosed = gateCheck(state, "evacuation_cache");
    const illegalEvac = tryCommit(state, { type: "run/move", nodeId: "evacuation_cache" });
    observations.evacuationIllegalMove = {
      target: "evacuation_cache",
      status: illegalEvac.status,
      code: illegalEvac.code,
      message: illegalEvac.message,
    };

    state = goto(state, ["collapsed_hall_trap", "alarm_grid_trap", "survivor_memory_stage"]);
    state = commit(state, { type: "node/collect-reward" }, "collect survivor_memory_stage");
    observations.bossGateOpen = gateCheck(state, "shelter_overseer");

    observations.final = {
      survivorHp: ec(state).survivorHp,
      resolvedCheckpointChoices: ec(state).resolvedCheckpointChoices,
      treatCount: ec(state).treatCount,
      pushCount: ec(state).pushCount,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("shelter-companion-and-reward-split");
    expectFlow(flowC, expected, "flow-c");
    results.push({
      id: "shelter-companion-and-reward-split",
      status: "PASS",
      companion: flowC.entryCompanion.id,
      desperateGateId: flowC.desperateOpen.gateId,
      mutexGatesClosed: [flowC.balancedClosed.gateId, flowC.evacuationClosed.gateId],
    });
  }

  // Flow D resolves all checkpoints treat/push/treat, then starts the
  // shelter_overseer boss combat: run/select-node freezes bossSurvivorSnapshot =
  // clamp(survivorHp + blackboxBeacon*10, 0, 100) = 100 and freezes further
  // checkpoint choices. The boss is a real 7-round combat, and a codec round-trip
  // preserves the frozen snapshot.
  const flowD = (() => {
    let state = hubState;
    const observations = {};
    state = enterShelter(state);
    state = collect(state, "shelter_gate", ["shelter_gate"]);
    state = collect(state, "north_entry", ["north_entry"]);
    state = clearTrap(state, "collapsed_hall_trap", ["collapsed_hall_trap"]);
    state = collect(state, "north_supply_cache", ["north_supply_cache"]);
    const patrol = fightMonster(state, "north_rescue_patrol", ["north_rescue_patrol"]);
    state = patrol.state;
    state = collect(state, "north_checkpoint", ["north_checkpoint"]);
    state = resolveCheckpoint(state, "treat").state;
    state = collect(state, "central_checkpoint", ["central_checkpoint"]);
    state = resolveCheckpoint(state, "push").state;
    state = collect(state, "survivor_cell", ["survivor_cell"]);
    state = goto(state, ["collapsed_hall_trap"]);
    state = clearTrap(state, "alarm_grid_trap", ["alarm_grid_trap"]);
    state = collect(state, "south_checkpoint", ["south_checkpoint"]);
    state = resolveCheckpoint(state, "treat").state;

    observations.beforeBoss = {
      survivorHp: ec(state).survivorHp,
      bossSurvivorSnapshot: ec(state).bossSurvivorSnapshot,
      allCheckpointsResolved: ec(state).allCheckpointsResolved,
      choicesTreatAvailable: ec(state).choices.treat.available,
    };

    state = goto(state, ["alarm_grid_trap", "survivor_memory_stage"]);
    state = commit(state, { type: "node/collect-reward" }, "collect survivor_memory_stage");
    observations.bossGateOpen = gateCheck(state, "shelter_overseer");
    observations.bossEntryBeforeSelect = { survivorHp: ec(state).survivorHp, bossSurvivorSnapshot: ec(state).bossSurvivorSnapshot };
    state = goto(state, ["shelter_overseer"]);
    state = commit(state, { type: "run/select-node", nodeId: "shelter_overseer" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-16 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    const combatAtStart = state.combat;
    observations.bossEntry = {
      survivorHp: ec(state).survivorHp,
      bossSurvivorSnapshot: ec(state).bossSurvivorSnapshot,
      choicesTreatAvailable: ec(state).choices.treat.available,
      frozenReason: ec(state).choices.treat.unavailableReason ?? null,
      monsterHp: combatAtStart?.monsterHp,
      bossPhase: combatAtStart?.bossPhase,
      turn: combatAtStart?.turn,
    };
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `boss attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-16 boss combat did not resolve in 200 rounds");
    }
    observations.bossFight = {
      rounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("shelter_overseer"),
    };
    observations.bossLawAtStart = {
      lawData: lawAtStart.lawData,
      display: lawAtStart.display,
      modifiers: lawAtStart.modifiers,
    };
    observations.afterBoss = { survivorHp: ec(state).survivorHp, bossSurvivorSnapshot: ec(state).bossSurvivorSnapshot };

    const after = resolveCheckpoint(state, "treat");
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
      choiceStatus: choiceSnap(ec(state).choices.treat),
      survivorHpAfter: after.survivorHpAfter,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("shelter-boss-snapshot");
    expectFlow(flowD, expected, "flow-d");
    results.push({
      id: "shelter-boss-snapshot",
      status: "PASS",
      bossSurvivorSnapshot: flowD.bossEntry.bossSurvivorSnapshot,
      bossRounds: flowD.bossFight.rounds,
      frozenReason: flowD.resolveAfterBoss.choiceStatus.unavailableReason,
    });
  }

  // Flow E pushes all three checkpoints: each push produces 200 reward points on
  // both the durable and run-loot tracks, node rewards add to both tracks, and a
  // codec round-trip preserves the reward points and law state.
  const flowE = (() => {
    let state = hubState;
    const observations = {};
    state = enterShelter(state);
    observations.entryRewardPoints = state.rewardPoints;
    state = collect(state, "shelter_gate", ["shelter_gate"]);
    observations.afterGate = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      healingPill: state.inventory.healing_pill,
      runHealingPill: state.run.lootBag.items.healing_pill ?? 0,
    };

    state = collect(state, "north_entry", ["north_entry"]);
    state = clearTrap(state, "collapsed_hall_trap", ["collapsed_hall_trap"]);
    state = collect(state, "north_supply_cache", ["north_supply_cache"]);
    const patrol = fightMonster(state, "north_rescue_patrol", ["north_rescue_patrol"]);
    state = patrol.state;
    state = collect(state, "north_checkpoint", ["north_checkpoint"]);
    const rp1 = state.rewardPoints;
    const r1 = resolveCheckpoint(state, "push");
    state = r1.state;
    observations.northPush = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: rp1,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp1,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    state = collect(state, "central_checkpoint", ["central_checkpoint"]);
    const rp2 = state.rewardPoints;
    const r2 = resolveCheckpoint(state, "push");
    state = r2.state;
    observations.centralPush = {
      status: r2.status,
      log: r2.log,
      rewardPointsBefore: rp2,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp2,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    state = collect(state, "survivor_cell", ["survivor_cell"]);
    state = goto(state, ["collapsed_hall_trap"]);
    state = clearTrap(state, "alarm_grid_trap", ["alarm_grid_trap"]);
    state = collect(state, "south_checkpoint", ["south_checkpoint"]);
    const rp3 = state.rewardPoints;
    const r3 = resolveCheckpoint(state, "push");
    state = r3.state;
    observations.southPush = {
      status: r3.status,
      log: r3.log,
      rewardPointsBefore: rp3,
      rewardPointsAfter: state.rewardPoints,
      delta: state.rewardPoints - rp3,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
    };

    const b = ec(state);
    observations.final = {
      survivorHp: b.survivorHp,
      treatCount: b.treatCount,
      pushCount: b.pushCount,
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      resolvedCheckpointChoices: b.resolvedCheckpointChoices,
      allCheckpointsResolved: b.allCheckpointsResolved,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("shelter-reward-inheritance");
    expectFlow(flowE, expected, "flow-e");
    results.push({
      id: "shelter-reward-inheritance",
      status: "PASS",
      pushRewardPoints: flowE.northPush.delta + flowE.centralPush.delta + flowE.southPush.delta,
      finalRewardPoints: flowE.final.rewardPoints,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law17Verdict({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-17 verdict legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-17 verdict legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-17 verdict decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-17 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };

  const vs = (state) => core.getCurrentVerdictStatus(state);
  const lawData = (state) => core.getCurrentDungeonLaw(state).state.law;
  const lawCapture = (state) => {
    const law = core.getCurrentDungeonLaw(state);
    if (!law) throw new AcceptanceAssertionError("law-17 verdict law is undefined");
    return {
      display: {
        status: law.display.status,
        severity: law.display.severity,
        meter: law.display.meter,
        targetReached: law.display.targetReached,
      },
      modifiers: law.modifiers,
      lawData: law.state.law,
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-17 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };

  const enterCourt = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "false_testimony_court",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter false_testimony_court",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${nodeId}`);
  };
  const clearTrapRisk = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/handle-trap", choice: "risk" }, `trap ${nodeId}`);
  };
  const clearTrapCounter = (state, nodeId, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/handle-trap", choice: "counter" }, `counter ${nodeId}`);
  };
  const resolveLoot = (state) => {
    const result = application.reduceGameCommand(state, { type: "node/resolve-equipment-loot" });
    return result.status === "committed" ? result.state : state;
  };
  const resolveRelicDraft = (state) => {
    const pending = state.run?.relicState?.pendingDraft;
    if (!pending) return state;
    const relicId = pending.candidateIds[0];
    return commit(
      state,
      { type: "node/resolve-relic-draft", draftId: pending.draftId, relicId },
      "resolve relic draft",
    );
  };
  const fightMonster = (state, nodeId, path = []) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-17 ${nodeId} select did not enter combat`);
    }
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-17 ${nodeId} combat did not resolve in 200 rounds`);
    }
    state = resolveLoot(state);
    return { state, rounds, hpAfter: state.player.hp };
  };
  const resolveVerdict = (state, suspect) => {
    const before = { rp: state.rewardPoints, loot: state.run.lootBag.rewardPoints };
    const result = application.reduceGameCommand(state, { type: "law/resolve-verdict", suspect });
    const after = result.status === "committed" ? result.state : state;
    const s = vs(after);
    return {
      state: after,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
      log: after.log?.[0] ?? null,
      rewardPointsBefore: before.rp,
      rewardPointsAfter: after.rewardPoints,
      runLootBefore: before.loot,
      runLootAfter: after.run.lootBag.rewardPoints ?? null,
      accusedSuspect: s?.accusedSuspect ?? null,
      accusationCorrect: s?.accusationCorrect ?? null,
      accusationTrustedCount: s?.accusationTrustedCount ?? null,
      appealUsed: s?.appealUsed ?? null,
      appealEligible: s?.appealEligible ?? null,
      pendingVerdictNodeId: s?.pendingVerdictNodeId ?? null,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const rtLaw = core.getCurrentDungeonLaw(rt.state);
    const s = core.getCurrentVerdictStatus(rt.state);
    return {
      status: rt.status,
      lawData: rtLaw.state.law,
      displayStatus: rtLaw.display.status,
      accusedSuspect: s?.accusedSuspect ?? null,
      rewardPoints: rt.state.rewardPoints,
    };
  };
  const statusSnap = (state) => {
    const s = vs(state);
    return {
      evidence: s.evidence,
      currentTrustedCount: s.currentTrustedCount,
      eliminatedSuspects: s.eliminatedSuspects,
      pendingVerdictNodeId: s.pendingVerdictNodeId,
      accusedSuspect: s.accusedSuspect,
      accusationCorrect: s.accusationCorrect,
      accusationTrustedCount: s.accusationTrustedCount,
      appealUsed: s.appealUsed,
      appealEligible: s.appealEligible,
      projectedAccusationRewardPoints: s.projectedAccusationRewardPoints,
      bossVerdictSnapshot: s.bossVerdictSnapshot,
      entryGear: s.entryGear,
      custodyProtectionUsed: s.custodyProtectionUsed,
    };
  };

  const expectedById = new Map(fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]));
  const expectFlow = (observations, expected, label) => {
    // The fixture is a JSON artifact, so undefined observation fields (e.g. a
    // committed tryCommit has no code/message) are normalized away before the
    // deep-strict comparison against the frozen expected values.
    const normalized = JSON.parse(JSON.stringify(observations));
    deepEqual(
      Object.keys(normalized).sort(),
      Object.keys(expected).sort(),
      `law-17 ${label} observation keys`,
    );
    for (const [key, value] of Object.entries(expected)) {
      deepEqual(normalized[key], value, `law-17 ${label} ${key}`);
    }
  };
  const results = [];

  // Flow A exercises evidence collection, contamination, and the law display:
  // the residue trap risked without a custody shell contaminates residue_evidence,
  // revealing it shows 污染 with trusted count 0 (records_keeper is not eliminated),
  // and the correct verdict with 0 trusted evidence pays 0 reward. The
  // truth_archive gate (3 trusted band) is unreachable in a normal run because
  // only residue_evidence is reachable before the first verdict, so the closed
  // gate plus its illegal-move rejection are the dynamic equivalent evidence.
  const flowA = (() => {
    let state = hubState;
    const observations = {};
    state = enterCourt(state);
    const e = lawCapture(state);
    observations.entryDisplay = e.display;
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.lawData;
    observations.entryStatus = statusSnap(state);
    observations.entryRewardPoints = state.rewardPoints;

    state = collect(state, "verdict_gate", ["verdict_gate"]);
    observations.gateCollect = {
      nodeId: "verdict_gate",
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      focusIncense: state.inventory.focus_incense,
      dispelTalisman: state.inventory.dispel_talisman,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };

    state = clearTrapRisk(state, "residue_sterility_trap", ["residue_sterility_trap"]);
    observations.afterResidueTrap = {
      custodyProtectionUsed: vs(state).custodyProtectionUsed,
      contaminatedEvidenceIds: lawData(state).contaminatedEvidenceIds,
      revealedEvidenceIds: lawData(state).revealedEvidenceIds,
      playerHp: state.player.hp,
    };

    state = collect(state, "residue_evidence", ["residue_evidence"]);
    observations.afterResidueReveal = {
      revealedEvidenceIds: lawData(state).revealedEvidenceIds,
      contaminatedEvidenceIds: lawData(state).contaminatedEvidenceIds,
      currentTrustedCount: vs(state).currentTrustedCount,
      eliminatedSuspects: vs(state).eliminatedSuspects,
      display: lawCapture(state).display,
    };

    const hound = fightMonster(state, "perjury_hound_omega", ["perjury_hound_omega"]);
    state = hound.state;
    observations.houndFight = { rounds: hound.rounds, hpAfter: hound.hpAfter };

    state = collect(state, "verdict_chamber", ["verdict_chamber"]);
    observations.verdictChamberPending = { pendingVerdictNodeId: vs(state).pendingVerdictNodeId };

    const r1 = resolveVerdict(state, "route_surveyor");
    state = r1.state;
    observations.resolveCorrect = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: r1.rewardPointsBefore,
      rewardPointsAfter: r1.rewardPointsAfter,
      runLootBefore: r1.runLootBefore,
      runLootAfter: r1.runLootAfter,
      accusedSuspect: r1.accusedSuspect,
      accusationCorrect: r1.accusationCorrect,
      accusationTrustedCount: r1.accusationTrustedCount,
      appealUsed: r1.appealUsed,
      pendingVerdictNodeId: r1.pendingVerdictNodeId,
    };
    observations.postVerdictDisplay = lawCapture(state).display;
    observations.postVerdictStatus = {
      projectedAccusationRewardPoints: vs(state).projectedAccusationRewardPoints,
      eliminatedSuspects: vs(state).eliminatedSuspects,
      currentTrustedCount: vs(state).currentTrustedCount,
    };

    state = goto(state, ["residue_sterility_trap", "verdict_gate", "records_stacks"]);
    observations.truthArchiveClosed = gateCheck(state, "truth_archive");
    const illegal = tryCommit(state, { type: "run/move", nodeId: "truth_archive" });
    observations.truthArchiveIllegalMove = {
      target: "truth_archive",
      status: illegal.status,
      code: illegal.code,
      message: illegal.message,
    };

    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("verdict-contamination-and-display");
    expectFlow(flowA, expected, "flow-a");
    results.push({
      id: "verdict-contamination-and-display",
      status: "PASS",
      contaminatedEvidence: flowA.afterResidueTrap.contaminatedEvidenceIds.length,
      trustedCount: flowA.postVerdictStatus.currentTrustedCount,
    });
  }

  // Flow B exercises the accusation reward and route gates: a clean residue
  // reveal (counter) trusts 1 evidence, the correct verdict pays 480 + 120
  // sabre bonus = 600 on both reward tracks, the boss gate is closed before the
  // verdict (departure-blocked) and open after, the boss fight freezes the
  // verdict snapshot, and the swift_judgment_armory gate opens after the boss.
  const flowB = (() => {
    let state = hubState;
    const observations = {};
    state = enterCourt(state);
    state = goto(state, ["records_stacks"]);
    observations.truthArchiveClosed = gateCheck(state, "truth_archive");
    state = goto(state, ["verdict_gate"]);
    state = collect(state, "verdict_gate", ["verdict_gate"]);
    state = clearTrapCounter(state, "residue_sterility_trap", ["residue_sterility_trap"]);
    state = collect(state, "residue_evidence", ["residue_evidence"]);
    const hound = fightMonster(state, "perjury_hound_omega", ["perjury_hound_omega"]);
    state = hound.state;
    observations.houndFight = { rounds: hound.rounds, hpAfter: hound.hpAfter };
    state = collect(state, "verdict_chamber", ["verdict_chamber"]);
    observations.bossGateClosed = gateCheck(state, "false_testimony_judge");
    const illegal = tryCommit(state, { type: "run/move", nodeId: "false_testimony_judge" });
    observations.bossIllegalMove = {
      target: "false_testimony_judge",
      status: illegal.status,
      code: illegal.code,
      message: illegal.message,
    };

    const r1 = resolveVerdict(state, "route_surveyor");
    state = r1.state;
    observations.resolveCorrect = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: r1.rewardPointsBefore,
      rewardPointsAfter: r1.rewardPointsAfter,
      runLootBefore: r1.runLootBefore,
      runLootAfter: r1.runLootAfter,
      accusedSuspect: r1.accusedSuspect,
      accusationCorrect: r1.accusationCorrect,
      accusationTrustedCount: r1.accusationTrustedCount,
    };
    observations.bossGateOpen = gateCheck(state, "false_testimony_judge");
    const legal = tryCommit(state, { type: "run/move", nodeId: "false_testimony_judge" });
    observations.bossLegalMove = {
      target: "false_testimony_judge",
      status: legal.status,
      code: legal.code,
      message: legal.message,
    };
    if (legal.status === "committed") state = legal.state;
    const boss = fightMonster(state, "false_testimony_judge", ["false_testimony_judge"]);
    state = boss.state;
    observations.bossFight = {
      rounds: boss.rounds,
      hpAfter: boss.hpAfter,
      cleared: state.run.clearedNodeIds.includes("false_testimony_judge"),
    };
    observations.bossSnapshot = vs(state).bossVerdictSnapshot;
    state = goto(state, ["judgment_lock", "verdict_exit"]);
    observations.swiftOpen = gateCheck(state, "swift_judgment_armory");
    const legalSwift = tryCommit(state, { type: "run/move", nodeId: "swift_judgment_armory" });
    observations.swiftLegalMove = {
      target: "swift_judgment_armory",
      status: legalSwift.status,
      code: legalSwift.code,
      message: legalSwift.message,
    };
    if (legalSwift.status === "committed") state = legalSwift.state;
    state = commit(state, { type: "node/collect-reward" }, "collect swift_judgment_armory");
    state = resolveRelicDraft(state);
    observations.swiftCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      truthFragment: state.inventory.truth_fragment,
      armorPatch: state.inventory.armor_patch,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("verdict-accusation-and-reward");
    expectFlow(flowB, expected, "flow-b");
    results.push({
      id: "verdict-accusation-and-reward",
      status: "PASS",
      verdictRewardPoints: flowB.resolveCorrect.rewardPointsAfter - flowB.resolveCorrect.rewardPointsBefore,
      bossCleared: flowB.bossFight.cleared,
    });
  }

  // Flow C exercises the appeal path and its mutex with the vault: a wrong
  // verdict (records_keeper) is appeal-eligible, the appeal desk opens, the
  // appeal resolution corrects the verdict, inherits the trusted count, pays no
  // reward, and flips appealUsed; a second resolution is a domain-rejected
  // no-op; after the appeal the appeal-entry gates and the vault gate close.
  const flowC = (() => {
    let state = hubState;
    const observations = {};
    state = enterCourt(state);
    state = collect(state, "verdict_gate", ["verdict_gate"]);
    state = clearTrapCounter(state, "residue_sterility_trap", ["residue_sterility_trap"]);
    state = collect(state, "residue_evidence", ["residue_evidence"]);
    const hound = fightMonster(state, "perjury_hound_omega", ["perjury_hound_omega"]);
    state = hound.state;
    observations.houndFight = { rounds: hound.rounds, hpAfter: hound.hpAfter };
    state = collect(state, "verdict_chamber", ["verdict_chamber"]);
    const r1 = resolveVerdict(state, "records_keeper");
    state = r1.state;
    observations.resolveWrong = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: r1.rewardPointsBefore,
      rewardPointsAfter: r1.rewardPointsAfter,
      runLootBefore: r1.runLootBefore,
      runLootAfter: r1.runLootAfter,
      accusedSuspect: r1.accusedSuspect,
      accusationCorrect: r1.accusationCorrect,
      accusationTrustedCount: r1.accusationTrustedCount,
      appealEligible: r1.appealEligible,
    };
    observations.wrongDisplay = lawCapture(state).display;

    state = goto(state, ["perjury_hound_omega"]);
    observations.appealEntryOpen = gateCheck(state, "appeal_desk");
    const legalAppeal = tryCommit(state, { type: "run/move", nodeId: "appeal_desk" });
    observations.appealLegalMove = {
      target: "appeal_desk",
      status: legalAppeal.status,
      code: legalAppeal.code,
      message: legalAppeal.message,
    };
    if (legalAppeal.status === "committed") state = legalAppeal.state;
    state = commit(state, { type: "node/collect-reward" }, "collect appeal_desk");
    observations.appealPending = { pendingVerdictNodeId: vs(state).pendingVerdictNodeId };

    const r2 = resolveVerdict(state, "route_surveyor");
    state = r2.state;
    observations.resolveAppeal = {
      status: r2.status,
      log: r2.log,
      rewardPointsBefore: r2.rewardPointsBefore,
      rewardPointsAfter: r2.rewardPointsAfter,
      runLootBefore: r2.runLootBefore,
      runLootAfter: r2.runLootAfter,
      accusedSuspect: r2.accusedSuspect,
      accusationCorrect: r2.accusationCorrect,
      accusationTrustedCount: r2.accusationTrustedCount,
      appealUsed: r2.appealUsed,
      appealEligible: r2.appealEligible,
      pendingVerdictNodeId: r2.pendingVerdictNodeId,
    };
    observations.appealDisplay = lawCapture(state).display;

    const r3 = resolveVerdict(state, "route_surveyor");
    observations.resolveAppealAgain = {
      status: r3.status,
      code: r3.code,
      message: r3.message,
      accusedSuspect: r3.accusedSuspect,
      appealUsed: r3.appealUsed,
    };

    state = goto(state, ["evidence_supply_cache"]);
    observations.appealEntryClosedAfterAppeal = gateCheck(state, "appeal_desk");
    const illegalReentry = tryCommit(state, { type: "run/move", nodeId: "appeal_desk" });
    observations.appealReentryIllegal = {
      target: "appeal_desk",
      status: illegalReentry.status,
      code: illegalReentry.code,
      message: illegalReentry.message,
    };

    state = goto(state, ["soul_recharge_verdict"]);
    observations.vaultClosedAfterAppeal = gateCheck(state, "false_verdict_vault");
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("verdict-appeal-and-vault-mutex");
    expectFlow(flowC, expected, "flow-c");
    results.push({
      id: "verdict-appeal-and-vault-mutex",
      status: "PASS",
      appealUsed: flowC.resolveAppeal.appealUsed,
      vaultClosedAfterAppeal: flowC.vaultClosedAfterAppeal.status === "closed",
    });
  }

  // Flow D exercises the vault path: a wrong verdict (security_chief) opens the
  // false_verdict_vault gate, collecting the vault pays its wrong-verdict
  // reward and permanently seals the verdict, so the appeal-entry gate closes
  // (错判、携带翻案印玺且未取伪判封存后开放。) and the display shows 翻案：不可.
  const flowD = (() => {
    let state = hubState;
    const observations = {};
    state = enterCourt(state);
    state = collect(state, "verdict_gate", ["verdict_gate"]);
    state = clearTrapCounter(state, "residue_sterility_trap", ["residue_sterility_trap"]);
    state = collect(state, "residue_evidence", ["residue_evidence"]);
    const hound = fightMonster(state, "perjury_hound_omega", ["perjury_hound_omega"]);
    state = hound.state;
    observations.houndFight = { rounds: hound.rounds, hpAfter: hound.hpAfter };
    state = collect(state, "verdict_chamber", ["verdict_chamber"]);
    const r1 = resolveVerdict(state, "security_chief");
    state = r1.state;
    observations.resolveWrong = {
      status: r1.status,
      log: r1.log,
      accusedSuspect: r1.accusedSuspect,
      accusationCorrect: r1.accusationCorrect,
      accusationTrustedCount: r1.accusationTrustedCount,
      appealEligible: r1.appealEligible,
    };

    state = goto(state, ["perjury_hound_omega", "appeal_desk", "cross_exam_stage", "lower_return_portal"]);
    observations.vaultOpen = gateCheck(state, "false_verdict_vault");
    const legalVault = tryCommit(state, { type: "run/move", nodeId: "false_verdict_vault" });
    observations.vaultLegalMove = {
      target: "false_verdict_vault",
      status: legalVault.status,
      code: legalVault.code,
      message: legalVault.message,
    };
    if (legalVault.status === "committed") state = legalVault.state;
    state = commit(state, { type: "node/collect-reward" }, "collect false_verdict_vault");
    observations.vaultCollected = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      truthFragment: state.inventory.truth_fragment,
      healingPill: state.inventory.healing_pill,
    };

    state = goto(state, ["lower_return_portal", "cross_exam_stage"]);
    observations.appealEntryClosed = gateCheck(state, "appeal_desk");
    const illegalAppeal = tryCommit(state, { type: "run/move", nodeId: "appeal_desk" });
    observations.appealIllegalMove = {
      target: "appeal_desk",
      status: illegalAppeal.status,
      code: illegalAppeal.code,
      message: illegalAppeal.message,
    };

    observations.wrongFinalDisplay = lawCapture(state).display;
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("verdict-vault-locks-appeal");
    expectFlow(flowD, expected, "flow-d");
    results.push({
      id: "verdict-vault-locks-appeal",
      status: "PASS",
      vaultRewardPoints: flowD.vaultCollected.rewardPoints,
      appealSealed: flowD.appealEntryClosed.status === "closed",
    });
  }

  // Flow E exercises the boss snapshot freeze and law immutability: starting
  // the boss combat freezes bossVerdictSnapshot and the boss modifiers
  // (correct verdict, trusted 1 → encounter.allStatsPercent -4, outgoing
  // force/art +8); after the boss the verdict can no longer be resolved
  // (domain-rejected), and the law is immutable — a risked voice_filter_trap
  // in the post-boss pocket deals damage but does not contaminate, and
  // collecting voice_evidence does not reveal it. Voice/timeline contamination
  // before the freeze is unreachable in a normal run (their traps sit in the
  // sealed post-boss pocket), so this post-boss tour is the dynamic equivalent
  // evidence that the frozen law cannot change.
  const flowE = (() => {
    let state = hubState;
    const observations = {};
    state = enterCourt(state);
    state = collect(state, "verdict_gate", ["verdict_gate"]);
    state = clearTrapCounter(state, "residue_sterility_trap", ["residue_sterility_trap"]);
    state = collect(state, "residue_evidence", ["residue_evidence"]);
    const hound = fightMonster(state, "perjury_hound_omega", ["perjury_hound_omega"]);
    state = hound.state;
    observations.houndFight = { rounds: hound.rounds, hpAfter: hound.hpAfter };
    state = collect(state, "verdict_chamber", ["verdict_chamber"]);
    const r1 = resolveVerdict(state, "route_surveyor");
    state = r1.state;
    observations.resolveCorrect = {
      status: r1.status,
      log: r1.log,
      rewardPointsBefore: r1.rewardPointsBefore,
      rewardPointsAfter: r1.rewardPointsAfter,
      accusedSuspect: r1.accusedSuspect,
      accusationCorrect: r1.accusationCorrect,
      accusationTrustedCount: r1.accusationTrustedCount,
    };

    observations.beforeBoss = {
      accusedSuspect: vs(state).accusedSuspect,
      bossVerdictSnapshot: vs(state).bossVerdictSnapshot,
      pendingVerdictNodeId: vs(state).pendingVerdictNodeId,
    };
    state = goto(state, ["false_testimony_judge"]);
    state = commit(state, { type: "run/select-node", nodeId: "false_testimony_judge" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-17 boss select did not enter combat");
    }
    const lawAtStart = lawCapture(state);
    const combatAtStart = state.combat;
    observations.bossEntry = {
      bossVerdictSnapshot: vs(state).bossVerdictSnapshot,
      monsterHp: combatAtStart?.monsterHp,
      bossPhase: combatAtStart?.bossPhase,
      turn: combatAtStart?.turn,
      isBoss: combatAtStart?.isBoss,
    };
    observations.bossLawAtStart = {
      lawData: lawAtStart.lawData,
      display: lawAtStart.display,
      modifiers: lawAtStart.modifiers,
    };
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `boss attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-17 boss combat did not resolve in 200 rounds");
    }
    observations.bossFight = {
      rounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("false_testimony_judge"),
    };
    observations.afterBoss = {
      bossVerdictSnapshot: vs(state).bossVerdictSnapshot,
      accusedSuspect: vs(state).accusedSuspect,
    };
    const after = resolveVerdict(state, "route_surveyor");
    observations.resolveAfterBoss = {
      status: after.status,
      code: after.code,
      message: after.message,
      accusedSuspect: after.accusedSuspect,
    };

    const lawBefore = lawData(state);
    state = goto(state, ["judgment_lock"]);
    state = commit(state, { type: "node/collect-reward" }, "collect judgment_lock");
    const lawAfter = lawData(state);
    observations.frozenAfterJudgmentLock = {
      revealedEvidenceIds: lawAfter.revealedEvidenceIds,
      contaminatedEvidenceIds: lawAfter.contaminatedEvidenceIds,
      bossVerdictSnapshot: lawAfter.bossVerdictSnapshot,
      lawUnchanged: JSON.stringify(lawBefore) === JSON.stringify(lawAfter),
    };

    state = goto(state, ["verdict_exit", "swift_judgment_armory", "upper_return_portal"]);
    const witness = fightMonster(state, "hostile_witness_north", ["hostile_witness_north"]);
    state = witness.state;
    observations.hostileWitnessFight = { rounds: witness.rounds, hpAfter: witness.hpAfter };
    state = goto(state, ["north_entry", "voice_filter_trap"]);
    state = commit(state, { type: "node/handle-trap", choice: "risk" }, "trap voice_filter_trap");
    observations.afterVoiceTrap = {
      custodyProtectionUsed: vs(state).custodyProtectionUsed,
      contaminatedEvidenceIds: lawData(state).contaminatedEvidenceIds,
      playerHp: state.player.hp,
    };
    state = collect(state, "voice_evidence", ["voice_evidence"]);
    observations.afterVoiceReveal = {
      revealedEvidenceIds: lawData(state).revealedEvidenceIds,
      contaminatedEvidenceIds: lawData(state).contaminatedEvidenceIds,
      currentTrustedCount: vs(state).currentTrustedCount,
      eliminatedSuspects: vs(state).eliminatedSuspects,
      display: lawCapture(state).display,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("verdict-boss-snapshot-and-freeze");
    expectFlow(flowE, expected, "flow-e");
    results.push({
      id: "verdict-boss-snapshot-and-freeze",
      status: "PASS",
      snapshotFrozen: flowE.bossEntry.bossVerdictSnapshot !== null,
      lawUnchanged: flowE.frozenAfterJudgmentLock.lawUnchanged,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law18Replay({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-18 replay legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-18 replay legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-18 replay decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-18 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };
  const lawOf = (state) => core.getCurrentDungeonLaw(state);
  const replayStatus = (state) => {
    const status = lawOf(state).display?.combatReplay;
    if (!status) {
      throw new AcceptanceAssertionError("law-18 replay combatReplay status is undefined");
    }
    return status;
  };
  const displayOf = (state) => {
    const d = lawOf(state).display;
    return {
      status: d.status,
      severity: d.severity,
      meter: d.meter,
      targetReached: d.targetReached,
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-18 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };
  const enterStage = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "combat_replay_stage",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter combat_replay_stage",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${state.run.currentNodeId}`);
  };
  const counterTrap = (state, path = []) => {
    state = goto(state, path);
    return commit(
      state,
      { type: "node/handle-trap", choice: "counter" },
      `counter ${state.run.currentNodeId}`,
    );
  };
  const resolveLoot = (state) => {
    const result = application.reduceGameCommand(state, { type: "node/resolve-equipment-loot" });
    return result.status === "committed" ? result.state : state;
  };
  const fightTake = (state, nodeId, path, firstAction) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-18 ${nodeId} select did not enter combat`);
    }
    state = commit(state, { type: "combat/act", action: firstAction }, `${nodeId} ${firstAction}`);
    const recordLine = (state.combat?.log ?? []).find((l) => l.includes("录制完成")) ?? null;
    const idx = { take_alpha: 0, take_beta: 1, take_gamma: 2 }[nodeId];
    const take = replayStatus(state).takes[idx];
    let rounds = 1;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-18 ${nodeId} combat did not resolve`);
    }
    state = resolveLoot(state);
    return { state, take, recordLine, rounds, hpAfter: state.player.hp };
  };
  const fightNormal = (state, nodeId, path) => {
    state = goto(state, path);
    state = commit(state, { type: "run/select-node", nodeId }, `select ${nodeId}`);
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError(`law-18 ${nodeId} select did not enter combat`);
    }
    const openingLog = [...(state.combat?.log ?? [])].reverse();
    const openingReplay = {
      cursor: state.combat?.combatReplayState?.cursor,
      buffer: state.combat?.combatReplayState?.buffer,
      monsterHp: state.combat?.monsterHp,
    };
    const replayLines = [];
    let rounds = 0;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `${nodeId} attack r${rounds}`);
      const line = (state.combat?.log ?? []).find((l) => l.includes("复演"));
      if (line) replayLines.push(line);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError(`law-18 ${nodeId} combat did not resolve`);
    }
    state = resolveLoot(state);
    return {
      state,
      rounds,
      hpAfter: state.player.hp,
      openingLog,
      openingReplay,
      replayLines: [...new Set(replayLines)],
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const law = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: law.state.law,
      displayStatus: law.display.status,
      rewardPoints: rt.state.rewardPoints,
    };
  };

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const expectFlow = (observations, expected, label) => {
    // The fixture is a JSON artifact, so undefined observation fields (e.g. a
    // committed tryCommit has no code/message) are normalized away before the
    // deep-strict comparison against the frozen expected values.
    const normalized = JSON.parse(JSON.stringify(observations));
    deepEqual(
      Object.keys(normalized).sort(),
      Object.keys(expected).sort(),
      `law-18 ${label} observation keys`,
    );
    for (const [key, value] of Object.entries(expected)) {
      deepEqual(normalized[key], value, `law-18 ${label} ${key}`);
    }
  };
  const results = [];

  // Flow A exercises the three take recordings and the law display: each take
  // node records the first real combat action (attack/art/guard) as a take
  // {action, observedValue, replayValue} where replayValue = ceil(observed*1.15)
  // (frame_engraver), the take-exit gate blocks leaving until recorded (and the
  // move itself is departure-blocked by the uncleared monster), and the
  // display/meter evolve 未录制 → 攻击 215->248 → ... → 防御 2->3 with severity
  // danger → warning. The round-trip preserves the recorded takes and rewards.
  const flowA = (() => {
    let state = hubState;
    const observations = {};
    state = enterStage(state);
    const e = lawOf(state);
    observations.entryDisplay = displayOf(state);
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.state.law;
    observations.entryStatus = replayStatus(state);
    observations.entryRewardPoints = state.rewardPoints;

    state = collect(state, ["stage_gate"]);
    observations.gateCollect = {
      nodeId: "stage_gate",
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      focusIncense: state.inventory.focus_incense,
      dispelTalisman: state.inventory.dispel_talisman,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };

    state = goto(state, ["script_stacks"]);
    state = move(state, "take_alpha");
    observations.alphaExitGateClosed = gateCheck(state, "script_stacks");
    const illegal = tryCommit(state, { type: "run/move", nodeId: "script_stacks" });
    observations.alphaExitIllegal = {
      target: "script_stacks",
      status: illegal.status,
      code: illegal.code,
      message: illegal.message,
    };

    const fa = fightTake(state, "take_alpha", ["take_alpha"], "attack");
    state = fa.state;
    observations.alphaFight = {
      take: fa.take,
      recordLine: fa.recordLine,
      rounds: fa.rounds,
      hpAfter: fa.hpAfter,
    };
    observations.afterAlphaDisplay = displayOf(state);
    observations.afterAlphaStatus = {
      completedTakeCount: replayStatus(state).completedTakeCount,
      nextTakeNodeId: replayStatus(state).nextTakeNodeId,
      readyForRoute: replayStatus(state).readyForRoute,
      readyForBoss: replayStatus(state).readyForBoss,
    };

    state = counterTrap(state, ["continuity_break_trap"]);
    const fb = fightTake(state, "take_beta", ["take_beta"], "art");
    state = fb.state;
    observations.betaFight = {
      take: fb.take,
      recordLine: fb.recordLine,
      rounds: fb.rounds,
      hpAfter: fb.hpAfter,
    };

    const fg = fightTake(state, "take_gamma", ["take_gamma"], "guard");
    state = fg.state;
    observations.gammaFight = {
      take: fg.take,
      recordLine: fg.recordLine,
      rounds: fg.rounds,
      hpAfter: fg.hpAfter,
    };
    observations.afterThreeDisplay = displayOf(state);
    observations.afterThreeStatus = {
      completedTakeCount: replayStatus(state).completedTakeCount,
      nextTakeNodeId: replayStatus(state).nextTakeNodeId,
      route: replayStatus(state).route,
      readyForRoute: replayStatus(state).readyForRoute,
      readyForBoss: replayStatus(state).readyForBoss,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("replay-takes-record-and-display");
    expectFlow(flowA, expected, "flow-a");
    results.push({
      id: "replay-takes-record-and-display",
      status: "PASS",
      takesRecorded: flowA.afterThreeStatus.completedTakeCount,
      replayValues: flowA.afterThreeDisplay.status,
    });
  }

  // Flow B exercises route selection and the route gates: take_beta's entry
  // gate is closed until take_alpha is recorded (illegal-move through a closed
  // gate), the sequence_route gate is closed before a route is selected and
  // opens after law/select-combat-replay-route, the burst/afterbeat route gates
  // stay closed (mutex diversion) and moving through them is illegal-move, a
  // second route selection is domain-rejected, and the sequence route replays
  // take_alpha as 310 fixed damage (248 * 125% cue_visor first-boost) in normal
  // combats. The round-trip preserves the selected route and rewards.
  const flowB = (() => {
    let state = hubState;
    const observations = {};
    state = enterStage(state);
    state = counterTrap(state, ["blank_frame_trap"]);
    state = counterTrap(state, ["rehearsal_hall", "continuity_break_trap"]);
    observations.betaEntryGateClosed = gateCheck(state, "take_beta");
    const illegal = tryCommit(state, { type: "run/move", nodeId: "take_beta" });
    observations.betaEntryIllegal = {
      target: "take_beta",
      status: illegal.status,
      code: illegal.code,
      message: illegal.message,
    };

    state = goto(state, ["rehearsal_hall", "blank_frame_trap", "stage_gate", "script_stacks"]);
    const fa = fightTake(state, "take_alpha", ["take_alpha"], "attack");
    state = fa.state;
    state = goto(state, ["continuity_break_trap"]);
    observations.betaEntryGateOpen = gateCheck(state, "take_beta");
    const fb = fightTake(state, "take_beta", ["take_beta"], "art");
    state = fb.state;
    const fg = fightTake(state, "take_gamma", ["take_gamma"], "guard");
    state = fg.state;
    observations.threeTakes = replayStatus(state).takes;

    state = goto(state, ["rehearsal_hall", "blank_frame_trap", "stage_gate", "script_stacks"]);
    observations.sequenceGateClosed = gateCheck(state, "sequence_route");
    const illegalSeq = tryCommit(state, { type: "run/move", nodeId: "sequence_route" });
    observations.sequenceIllegal = {
      target: "sequence_route",
      status: illegalSeq.status,
      code: illegalSeq.code,
      message: illegalSeq.message,
    };

    const beforeRoute = state.rewardPoints;
    const sel = tryCommit(state, { type: "law/select-combat-replay-route", route: "sequence" });
    observations.routeSelect = {
      status: sel.status,
      code: sel.code,
      message: sel.message,
      rewardPointsBefore: beforeRoute,
      rewardPointsAfter: sel.state.rewardPoints,
      route: replayStatus(sel.state).route,
      log: sel.state.log?.[0] ?? null,
    };
    state = sel.state;
    observations.afterRouteDisplay = displayOf(state);
    observations.afterRouteStatus = {
      readyForRoute: replayStatus(state).readyForRoute,
      readyForBoss: replayStatus(state).readyForBoss,
    };

    observations.sequenceGateOpen = gateCheck(state, "sequence_route");
    const legalSeq = tryCommit(state, { type: "run/move", nodeId: "sequence_route" });
    observations.sequenceLegalMove = {
      target: "sequence_route",
      status: legalSeq.status,
      code: legalSeq.code,
      message: legalSeq.message,
    };
    if (legalSeq.status === "committed") state = legalSeq.state;
    state = commit(state, { type: "node/collect-reward" }, "collect sequence_route");
    observations.sequenceCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      combatReel: state.inventory.combat_reel,
    };

    state = goto(state, ["opening_prop_cache", "opening_cue_trap"]);
    state = counterTrap(state, ["opening_cue_trap"]);
    state = goto(state, ["upper_entry"]);
    const fn = fightNormal(state, "cue_stalker_north", ["cue_stalker_north"]);
    state = fn.state;
    observations.cueStalkerNorthFight = {
      rounds: fn.rounds,
      hpAfter: fn.hpAfter,
      replayLines: fn.replayLines,
    };
    state = goto(state, ["upper_return_portal"]);
    observations.burstGateClosed = gateCheck(state, "burst_route");
    const illegalBurst = tryCommit(state, { type: "run/move", nodeId: "burst_route" });
    observations.burstIllegal = {
      target: "burst_route",
      status: illegalBurst.status,
      code: illegalBurst.code,
      message: illegalBurst.message,
    };

    state = goto(state, [
      "cue_stalker_north",
      "upper_entry",
      "opening_cue_trap",
      "opening_prop_cache",
      "sequence_route",
      "script_stacks",
      "stage_gate",
      "blank_frame_trap",
      "rehearsal_hall",
    ]);
    const fo = fightNormal(state, "retake_double_omega", ["retake_double_omega"]);
    state = fo.state;
    observations.omegaFight = {
      rounds: fo.rounds,
      hpAfter: fo.hpAfter,
      replayLines: fo.replayLines,
    };
    state = goto(state, ["script_projection_stage"]);
    const fs = fightNormal(state, "soul_recharge_stage", ["soul_recharge_stage"]);
    state = fs.state;
    observations.soulRechargeFight = {
      rounds: fs.rounds,
      hpAfter: fs.hpAfter,
      replayLines: fs.replayLines,
    };
    state = goto(state, ["film_supply_cache"]);
    observations.afterbeatGateClosed = gateCheck(state, "afterbeat_route");
    const illegalAfter = tryCommit(state, { type: "run/move", nodeId: "afterbeat_route" });
    observations.afterbeatIllegal = {
      target: "afterbeat_route",
      status: illegalAfter.status,
      code: illegalAfter.code,
      message: illegalAfter.message,
    };

    const selAgain = tryCommit(state, { type: "law/select-combat-replay-route", route: "burst" });
    observations.routeSelectAgain = {
      status: selAgain.status,
      code: selAgain.code,
      message: selAgain.message,
      route: replayStatus(selAgain.state).route,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("replay-route-select-and-gates");
    expectFlow(flowB, expected, "flow-b");
    results.push({
      id: "replay-route-select-and-gates",
      status: "PASS",
      route: flowB.routeSelect.route,
      sequenceReplay: flowB.cueStalkerNorthFight.replayLines[0] ?? null,
    });
  }

  // Flow C exercises the boss snapshot and post-freeze immutability: the boss
  // gate is a closed composite before a route is selected (illegal-move) and
  // opens after, entering the boss combat freezes bossSnapshot {takes, route}
  // and the thaw_metronome opening releases take_alpha at 75%+25% = 100% (248
  // fixed damage), the sealed-phase matching art action releases take_beta at
  // 100% (271) and the boss awakens (删镜杀青), the awakened-phase matching
  // guard action does not release (cursor/buffer frozen), and a route
  // re-selection after the freeze is domain-rejected. The round-trip preserves
  // the frozen snapshot.
  const flowC = (() => {
    let state = hubState;
    const observations = {};
    state = enterStage(state);
    state = collect(state, ["stage_gate"]);
    const fa = fightTake(state, "take_alpha", ["script_stacks", "take_alpha"], "attack");
    state = fa.state;
    state = counterTrap(state, ["continuity_break_trap"]);
    const fb = fightTake(state, "take_beta", ["take_beta"], "art");
    state = fb.state;
    const fg = fightTake(state, "take_gamma", ["take_gamma"], "guard");
    state = fg.state;
    observations.threeTakes = replayStatus(state).takes;

    observations.bossGateClosed = gateCheck(state, "final_cut_director");
    const illegalBoss = tryCommit(state, { type: "run/move", nodeId: "final_cut_director" });
    observations.bossIllegalMove = {
      target: "final_cut_director",
      status: illegalBoss.status,
      code: illegalBoss.code,
      message: illegalBoss.message,
    };

    state = commit(state, { type: "law/select-combat-replay-route", route: "sequence" }, "select sequence");
    observations.bossGateOpen = gateCheck(state, "final_cut_director");
    const legalBoss = tryCommit(state, { type: "run/move", nodeId: "final_cut_director" });
    observations.bossLegalMove = {
      target: "final_cut_director",
      status: legalBoss.status,
      code: legalBoss.code,
      message: legalBoss.message,
    };
    if (legalBoss.status === "committed") state = legalBoss.state;

    observations.beforeBoss = {
      bossSnapshot: replayStatus(state).bossSnapshot,
      route: replayStatus(state).route,
    };
    state = commit(state, { type: "run/select-node", nodeId: "final_cut_director" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-18 boss select did not enter combat");
    }
    const combatAtStart = state.combat;
    const openingLog = [...(combatAtStart?.log ?? [])];
    observations.bossEntry = {
      bossSnapshot: replayStatus(state).bossSnapshot,
      monsterHp: combatAtStart?.monsterHp,
      bossPhase: combatAtStart?.bossPhase,
      turn: combatAtStart?.turn,
      thawReleaseLine: openingLog.find((l) => l.includes("take_alpha复演")) ?? null,
      replayCursor: combatAtStart?.combatReplayState?.cursor,
      replayBuffer: combatAtStart?.combatReplayState?.buffer,
    };
    const lawAtStart = lawOf(state);
    observations.bossLawAtStart = {
      lawData: lawAtStart.state.law,
      display: displayOf(state),
      modifiers: lawAtStart.modifiers,
    };

    const bossReplay = [];
    for (const act of ["attack", "art", "guard"]) {
      if (state.phase !== "combat") break;
      const beforeLog = [...(state.combat?.log ?? [])];
      state = commit(state, { type: "combat/act", action: act }, `boss ${act}`);
      const afterLog = state.combat?.log ?? [];
      const beforeSet = new Set(beforeLog);
      const releaseLine =
        afterLog.find(
          (l) => l.includes("复演") && !beforeSet.has(l) && /take_(alpha|beta|gamma)复演/.test(l),
        ) ?? null;
      bossReplay.push({
        act,
        releaseLine,
        awakened: afterLog.some((l) => l.includes("删镜杀青")),
        cursorAfter: state.combat?.combatReplayState?.cursor,
        bufferAfter: state.combat?.combatReplayState?.buffer,
      });
    }
    observations.bossReplay = bossReplay;
    let rounds = 3;
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `boss attack r${rounds}`);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-18 boss combat did not resolve");
    }
    observations.bossFight = {
      rounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("final_cut_director"),
    };
    observations.afterBoss = {
      bossSnapshot: replayStatus(state).bossSnapshot,
      route: replayStatus(state).route,
      display: displayOf(state),
    };
    const selAfter = tryCommit(state, { type: "law/select-combat-replay-route", route: "burst" });
    observations.routeSelectAfterBoss = {
      status: selAfter.status,
      code: selAfter.code,
      message: selAfter.message,
      route: replayStatus(selAfter.state).route,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("replay-boss-snapshot-and-freeze");
    expectFlow(flowC, expected, "flow-c");
    results.push({
      id: "replay-boss-snapshot-and-freeze",
      status: "PASS",
      snapshotFrozen: flowC.bossEntry.bossSnapshot !== null,
      sealedRelease: flowC.bossReplay[1]?.releaseLine ?? null,
    });
  }

  // Flow D exercises the stage_gate reward idempotency boundary and the
  // afterbeat route display: the first collect pays 850→1430 (run loot 580,
  // consumables 3→4, gate_sigil 1), the second collect is domain-rejected
  // ('复演场正门已经领取过奖励。') with rewardPoints unchanged, and the
  // round-trip preserves the afterbeat route and rewards.
  const flowD = (() => {
    let state = hubState;
    const observations = {};
    state = enterStage(state);
    const before = state.rewardPoints;
    state = commit(state, { type: "node/collect-reward" }, "collect stage_gate first");
    observations.stageGateFirst = {
      rewardPointsBefore: before,
      rewardPointsAfter: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      focusIncense: state.inventory.focus_incense,
      dispelTalisman: state.inventory.dispel_talisman,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };
    const second = tryCommit(state, { type: "node/collect-reward" });
    observations.stageGateSecond = {
      status: second.status,
      code: second.code,
      message: second.message,
      rewardPoints: second.state.rewardPoints,
    };

    const fa = fightTake(state, "take_alpha", ["script_stacks", "take_alpha"], "attack");
    state = fa.state;
    state = counterTrap(state, ["continuity_break_trap"]);
    const fb = fightTake(state, "take_beta", ["take_beta"], "art");
    state = fb.state;
    const fg = fightTake(state, "take_gamma", ["take_gamma"], "guard");
    state = fg.state;
    state = commit(
      state,
      { type: "law/select-combat-replay-route", route: "afterbeat" },
      "select afterbeat",
    );
    observations.afterRouteDisplay = displayOf(state);
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("replay-reward-idempotency-and-roundtrip");
    expectFlow(flowD, expected, "flow-d");
    results.push({
      id: "replay-reward-idempotency-and-roundtrip",
      status: "PASS",
      secondCollect: flowD.stageGateSecond.status,
      route: flowD.roundtrip.lawData.route,
    });
  }

  // Flow E exercises the burst route's opening replay consistency in a normal
  // combat: selecting burst releases all three takes at 60% at the combat
  // opening (take_alpha 248→210 with the cue_visor first-boost, take_beta
  // 271→162, take_gamma guard 3→1 buffer), the buffer absorbs a counter-hit
  // (复演缓冲抵消 1 点反击伤害，剩余承伤次数 1。), and the round-trip preserves
  // the burst route.
  const flowE = (() => {
    let state = hubState;
    const observations = {};
    state = enterStage(state);
    const fa = fightTake(state, "take_alpha", ["script_stacks", "take_alpha"], "attack");
    state = fa.state;
    state = counterTrap(state, ["continuity_break_trap"]);
    const fb = fightTake(state, "take_beta", ["take_beta"], "art");
    state = fb.state;
    const fg = fightTake(state, "take_gamma", ["take_gamma"], "guard");
    state = fg.state;
    observations.threeTakes = replayStatus(state).takes;
    state = commit(
      state,
      { type: "law/select-combat-replay-route", route: "burst" },
      "select burst",
    );

    state = goto(state, ["rehearsal_hall"]);
    const fo = fightNormal(state, "retake_double_omega", ["retake_double_omega"]);
    state = fo.state;
    observations.openingLog = fo.openingLog;
    observations.openingReplay = fo.openingReplay;
    observations.fight = {
      rounds: fo.rounds,
      hpAfter: fo.hpAfter,
      cleared: state.run.clearedNodeIds.includes("retake_double_omega"),
      replayLines: fo.replayLines,
    };
    const rt = roundtrip(state);
    observations.roundtrip = {
      status: rt.status,
      lawData: rt.lawData,
      displayStatus: rt.displayStatus,
    };
    return observations;
  })();

  {
    const expected = expectedById.get("replay-burst-route-replay-consistency");
    expectFlow(flowE, expected, "flow-e");
    results.push({
      id: "replay-burst-route-replay-consistency",
      status: "PASS",
      openingCursor: flowE.openingReplay.cursor,
      openingBuffer: flowE.openingReplay.buffer,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

export async function law19Panopticon({ fixture, core, application, saveCodec, projectRoot }) {
  const base = loadFrozenJsonInput(projectRoot, fixture.baseInput);
  const envelope = applyFrozenMutations(base.value, fixture.inputMutations);
  const decoded = saveCodec.decodeWebV1({
    kind: "web-local-storage-text",
    text: JSON.stringify(envelope),
  });
  equal(decoded.status, "decoded", "law-19 panopticon legacy input decodes");
  if (decoded.status !== "decoded") {
    throw new AcceptanceAssertionError("law-19 panopticon legacy input must decode");
  }
  equal(
    decoded.report.source.oracleCommit,
    fixture.provenance.oracle.commit,
    "law-19 panopticon decoder oracle commit",
  );

  const entrySeed = fixture.entrySeed;
  const hubState = decoded.state;

  const commit = (state, command, step) => {
    const result = application.reduceGameCommand(state, command);
    if (result.status !== "committed") {
      throw new AcceptanceAssertionError(
        `law-19 ${step}: ${result.reason.code} ${result.reason.message}`,
      );
    }
    return result.state;
  };
  const tryCommit = (state, command) => {
    const result = application.reduceGameCommand(state, command);
    return {
      state: result.status === "committed" ? result.state : state,
      status: result.status,
      code: result.reason?.code,
      message: result.reason?.message,
    };
  };
  const lawOf = (state) => core.getCurrentDungeonLaw(state);
  const pan = (state) => {
    const status = lawOf(state).display?.panopticon;
    if (!status) {
      throw new AcceptanceAssertionError("law-19 panopticon status is undefined");
    }
    return status;
  };
  const displayOf = (state) => {
    const d = lawOf(state).display;
    return {
      status: d.status,
      severity: d.severity,
      meter: d.meter,
      targetReached: d.targetReached,
    };
  };
  const gateCheck = (state, target) => {
    const status = core.getCurrentRouteGateStatus(state, target);
    if (status === undefined) {
      throw new AcceptanceAssertionError(
        `law-19 route gate to ${target} is undefined from ${state.run.currentNodeId}`,
      );
    }
    return {
      at: state.run.currentNodeId,
      target,
      gateId: status.gate.id,
      status: status.status,
      isOpen: status.isOpen,
      blockReason: status.blockReason ?? null,
    };
  };
  const enterCity = (state) =>
    commit(
      state,
      {
        type: "run/enter",
        dungeonId: "panopticon_city",
        protocolId: "standard",
        seeds: { rulesVersion: 1, hiddenTaskSeed: entrySeed },
      },
      "enter panopticon_city",
    );
  const move = (state, nodeId) => {
    if (state.run.currentNodeId === nodeId) return state;
    return commit(state, { type: "run/move", nodeId }, `move ${nodeId}`);
  };
  const goto = (state, path) => {
    for (const nodeId of path) state = move(state, nodeId);
    return state;
  };
  const collect = (state, path = []) => {
    state = goto(state, path);
    return commit(state, { type: "node/collect-reward" }, `collect ${state.run.currentNodeId}`);
  };
  const scanLine = (state) => {
    const line = (state.log ?? []).find((l) => l.includes("三相扫描"));
    return line ?? null;
  };
  const moveWithScan = (state, nodeId) => {
    const before = { phase: pan(state).scanPhase, hp: state.player.hp };
    state = move(state, nodeId);
    const p = pan(state);
    return {
      state,
      target: nodeId,
      phaseBefore: before.phase,
      phaseAfter: p.scanPhase,
      hpAfter: state.player.hp,
      scanLog: scanLine(state),
    };
  };
  const fightBoss = (state) => {
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-19 boss fight expects combat phase");
    }
    let rounds = 0;
    const awakenedLines = [];
    while (state.phase === "combat" && rounds < 200) {
      state = commit(state, { type: "combat/act", action: "attack" }, `boss attack r${rounds}`);
      const line = (state.combat?.log ?? []).find((l) => l.includes("万目齐睁"));
      if (line && !awakenedLines.includes(line)) awakenedLines.push(line);
      rounds += 1;
    }
    if (state.phase !== "explore") {
      throw new AcceptanceAssertionError("law-19 boss combat did not resolve");
    }
    return {
      state,
      rounds,
      hpAfter: state.player.hp,
      cleared: state.run.clearedNodeIds.includes("all_sight_warden"),
      awakenedLines,
    };
  };
  const roundtrip = (state) => {
    const rt = saveCodec.decodeWebV1({
      kind: "web-local-storage-text",
      text: JSON.stringify({ version: 1, state }),
    });
    if (rt.status !== "decoded") return { status: rt.status };
    const law = core.getCurrentDungeonLaw(rt.state);
    return {
      status: rt.status,
      lawData: law.state.law,
      displayStatus: law.display.status,
      rewardPoints: rt.state.rewardPoints,
    };
  };

  const expectedById = new Map(
    fixture.scenarios.map((scenario) => [scenario.id, scenario.expected]),
  );
  const expectFlow = (observations, expected, label) => {
    // The fixture is a JSON artifact, so undefined observation fields (e.g. a
    // committed tryCommit has no code/message) are normalized away before the
    // deep-strict comparison against the frozen expected values.
    const normalized = JSON.parse(JSON.stringify(observations));
    deepEqual(
      Object.keys(normalized).sort(),
      Object.keys(expected).sort(),
      `law-19 ${label} observation keys`,
    );
    for (const [key, value] of Object.entries(expected)) {
      deepEqual(normalized[key], value, `law-19 ${label} ${key}`);
    }
  };
  const results = [];

  // Flow A exercises the three-phase scan and exposure display: the scan
  // advances 0→1→2→0 on every legal move, scanned nodes (targetPhase ===
  // phaseBefore) expose and deal 4% maxHp damage (matteShell halving) while
  // unscanned nodes do not, the closed shadow_route gate keeps the move
  // illegal-move and does not advance the scan, and the display/meter evolve
  // 相位:0…曝光:0 → 相位:1…曝光:4 with severity danger. The round-trip
  // preserves the scan phase, exposure count, and rewards.
  const flowA = (() => {
    let state = hubState;
    const observations = {};
    state = enterCity(state);
    const e = lawOf(state);
    observations.entryDisplay = displayOf(state);
    observations.entryModifiers = e.modifiers;
    observations.entryLawData = e.state.law;
    observations.entryStatus = pan(state);
    observations.entryRewardPoints = state.rewardPoints;

    const scanMoves = [];
    for (const nodeId of [
      "watchglass_cache",
      "matte_supply",
      "lower_entry",
      "panopticon_gate",
      "all_sight_lock",
      "blindspot_theater",
      "blindline_archive",
    ]) {
      const m = moveWithScan(state, nodeId);
      state = m.state;
      scanMoves.push({
        target: m.target,
        phaseBefore: m.phaseBefore,
        phaseAfter: m.phaseAfter,
        hpAfter: m.hpAfter,
        scanLog: m.scanLog,
      });
    }
    observations.scanMoves = scanMoves;

    const beforeIllegal = { phase: pan(state).scanPhase, moves: pan(state).moveCount };
    const illegal = tryCommit(state, { type: "run/move", nodeId: "shadow_route" });
    observations.shadowGateClosed = gateCheck(state, "shadow_route");
    observations.illegalAdvance = {
      target: "shadow_route",
      status: illegal.status,
      code: illegal.code,
      message: illegal.message,
      scanPhaseAfter: pan(illegal.state).scanPhase,
      moveCountAfter: pan(illegal.state).moveCount,
      unchanged:
        pan(illegal.state).scanPhase === beforeIllegal.phase
        && pan(illegal.state).moveCount === beforeIllegal.moves,
    };

    observations.afterDisplay = displayOf(state);
    observations.afterStatus = {
      scanPhase: pan(state).scanPhase,
      moveCount: pan(state).moveCount,
      exposureCount: pan(state).exposureCount,
      completedRelayCount: pan(state).completedRelayCount,
      route: pan(state).route,
      refractionCharges: pan(state).refractionCharges,
      decoyRewardsGranted: pan(state).decoyRewardsGranted,
      readyForRoute: pan(state).readyForRoute,
      readyForBoss: pan(state).readyForBoss,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("panopticon-scan-phases-exposure-display");
    expectFlow(flowA, expected, "flow-a");
    results.push({
      id: "panopticon-scan-phases-exposure-display",
      status: "PASS",
      scanPhase: flowA.afterStatus.scanPhase,
      exposureCount: flowA.afterStatus.exposureCount,
    });
  }

  // Flow B exercises the relay completion, route selection, and route gates:
  // the three relays complete on first collect (3rd sets pendingRouteNodeId),
  // an early route select is domain-rejected, departure is blocked until a
  // route is selected, law/select-panopticon-route permanently freezes shadow
  // (log 监察城路线已永久冻结：影路潜行。), the boss gate opens while the
  // refraction route gate stays closed (mutex diversion, illegal-move), a
  // second route select is domain-rejected, and the round-trip preserves the
  // selected route and rewards.
  const flowB = (() => {
    let state = hubState;
    const observations = {};
    state = enterCity(state);
    const before = state.rewardPoints;
    state = commit(state, { type: "node/collect-reward" }, "collect panopticon_gate");
    observations.gateCollect = {
      nodeId: "panopticon_gate",
      rewardPointsBefore: before,
      rewardPointsAfter: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      focusIncense: state.inventory.focus_incense,
      dispelTalisman: state.inventory.dispel_talisman,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };

    state = goto(state, ["all_sight_lock", "blindspot_theater", "blindline_archive", "north_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north relay");
    observations.afterNorth = {
      completedRelayCount: pan(state).completedRelayCount,
      northRelay: pan(state).relays.north_blind_relay,
      pendingRouteNodeId: pan(state).pendingRouteNodeId,
      readyForRoute: pan(state).readyForRoute,
      exposureCount: pan(state).exposureCount,
    };

    const earlySelect = tryCommit(state, { type: "law/select-panopticon-route", route: "shadow" });
    observations.routeSelectEarly = {
      status: earlySelect.status,
      code: earlySelect.code,
      message: earlySelect.message,
      route: pan(earlySelect.state).route,
    };

    state = goto(state, ["upper_entry", "central_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central relay");
    observations.afterCentral = {
      completedRelayCount: pan(state).completedRelayCount,
      centralRelay: pan(state).relays.central_blind_relay,
      pendingRouteNodeId: pan(state).pendingRouteNodeId,
      readyForRoute: pan(state).readyForRoute,
    };

    state = goto(state, ["south_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south relay");
    observations.afterSouth = {
      completedRelayCount: pan(state).completedRelayCount,
      southRelay: pan(state).relays.south_blind_relay,
      pendingRouteNodeId: pan(state).pendingRouteNodeId,
      readyForRoute: pan(state).readyForRoute,
      readyForBoss: pan(state).readyForBoss,
    };
    observations.afterThreeRelaysDisplay = displayOf(state);

    observations.bossGateClosed = gateCheck(state, "all_sight_warden");
    const illegalBoss = tryCommit(state, { type: "run/move", nodeId: "all_sight_warden" });
    observations.bossIllegalMove = {
      target: "all_sight_warden",
      status: illegalBoss.status,
      code: illegalBoss.code,
      message: illegalBoss.message,
    };

    const departure = tryCommit(state, { type: "run/move", nodeId: "refraction_lab" });
    observations.departureBlocked = {
      target: "refraction_lab",
      status: departure.status,
      code: departure.code,
      message: departure.message,
    };

    const beforeRoute = state.rewardPoints;
    const sel = tryCommit(state, { type: "law/select-panopticon-route", route: "shadow" });
    observations.routeSelect = {
      status: sel.status,
      code: sel.code,
      message: sel.message,
      rewardPointsBefore: beforeRoute,
      rewardPointsAfter: sel.state.rewardPoints,
      route: pan(sel.state).route,
      pendingRouteNodeId: pan(sel.state).pendingRouteNodeId,
      log: sel.state.log?.[0] ?? null,
    };
    state = sel.state;
    observations.afterRouteDisplay = displayOf(state);
    observations.afterRouteStatus = {
      readyForRoute: pan(state).readyForRoute,
      readyForBoss: pan(state).readyForBoss,
    };

    observations.bossGateOpen = gateCheck(state, "all_sight_warden");

    state = goto(state, ["central_blind_relay", "upper_entry", "north_blind_relay", "blindline_archive"]);
    observations.shadowGateOpen = gateCheck(state, "shadow_route");
    const legalShadow = tryCommit(state, { type: "run/move", nodeId: "shadow_route" });
    observations.shadowLegalMove = {
      target: "shadow_route",
      status: legalShadow.status,
      code: legalShadow.code,
      message: legalShadow.message,
    };
    if (legalShadow.status === "committed") state = legalShadow.state;
    state = commit(state, { type: "node/collect-reward" }, "collect shadow_route");
    observations.shadowCollect = {
      rewardPoints: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      observationShard: state.inventory.observation_shard,
    };

    state = goto(state, [
      "blindline_archive",
      "north_blind_relay",
      "upper_entry",
      "central_blind_relay",
      "south_blind_relay",
      "refraction_lab",
      "spectrum_switchyard",
      "lower_return_portal",
    ]);
    observations.refractionGateClosed = gateCheck(state, "refraction_route");
    const illegalRefraction = tryCommit(state, { type: "run/move", nodeId: "refraction_route" });
    observations.refractionIllegalMove = {
      target: "refraction_route",
      status: illegalRefraction.status,
      code: illegalRefraction.code,
      message: illegalRefraction.message,
    };

    const selAgain = tryCommit(state, { type: "law/select-panopticon-route", route: "decoy" });
    observations.routeSelectAgain = {
      status: selAgain.status,
      code: selAgain.code,
      message: selAgain.message,
      route: pan(selAgain.state).route,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("panopticon-relays-route-select-gates");
    expectFlow(flowB, expected, "flow-b");
    results.push({
      id: "panopticon-relays-route-select-gates",
      status: "PASS",
      route: flowB.routeSelect.route,
      relays: flowB.afterSouth.completedRelayCount,
    });
  }

  // Flow C exercises the boss snapshot and post-freeze immutability: after
  // selecting refraction, scanned moves grant refraction charges (2% damage,
  // clamped at 3 so the 4th exposure grants nothing), the boss gate opens,
  // entering the all_sight_warden combat freezes bossSnapshot
  // {route, exposureCount - inversePrism, refractionCharges} and the
  // blindline_cutter modifier adds outgoingDamage force/art +15%, the boss
  // awakens mid-fight (万目齐睁), and a route re-selection after the freeze
  // is domain-rejected. The round-trip preserves the frozen snapshot.
  const flowC = (() => {
    let state = hubState;
    const observations = {};
    state = enterCity(state);
    state = goto(state, ["all_sight_lock", "blindspot_theater", "blindline_archive", "north_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    state = goto(state, ["upper_entry", "central_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    state = goto(state, ["south_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    state = commit(state, { type: "law/select-panopticon-route", route: "refraction" }, "select refraction");

    const chargeMoves = [];
    for (const nodeId of [
      "refraction_lab",
      "south_blind_relay",
      "refraction_lab",
      "spectrum_switchyard",
      "refraction_lab",
      "south_blind_relay",
      "refraction_lab",
      "south_blind_relay",
    ]) {
      const m = moveWithScan(state, nodeId);
      state = m.state;
      chargeMoves.push({
        target: m.target,
        phaseBefore: m.phaseBefore,
        phaseAfter: m.phaseAfter,
        hpAfter: m.hpAfter,
        scanLog: m.scanLog,
      });
    }
    observations.chargeFarm = {
      moves: chargeMoves,
      exposureCount: pan(state).exposureCount,
      refractionCharges: pan(state).refractionCharges,
    };

    observations.bossGateOpen = gateCheck(state, "all_sight_warden");
    const bossMove = moveWithScan(state, "all_sight_warden");
    state = bossMove.state;
    observations.bossMove = {
      target: bossMove.target,
      phaseBefore: bossMove.phaseBefore,
      phaseAfter: bossMove.phaseAfter,
      scanLog: bossMove.scanLog,
      exposureCount: pan(state).exposureCount,
      refractionCharges: pan(state).refractionCharges,
    };

    observations.beforeBoss = {
      bossSnapshot: pan(state).bossSnapshot,
      route: pan(state).route,
      exposureCount: pan(state).exposureCount,
      refractionCharges: pan(state).refractionCharges,
    };

    state = commit(state, { type: "run/select-node", nodeId: "all_sight_warden" }, "select boss");
    if (state.phase !== "combat") {
      throw new AcceptanceAssertionError("law-19 boss select did not enter combat");
    }
    const combatAtStart = state.combat;
    observations.bossEntry = {
      bossSnapshot: pan(state).bossSnapshot,
      monsterHp: combatAtStart?.monsterHp,
      bossPhase: combatAtStart?.bossPhase,
      turn: combatAtStart?.turn,
      exposureCount: pan(state).exposureCount,
      refractionCharges: pan(state).refractionCharges,
    };
    const lawAtStart = lawOf(state);
    observations.bossLawAtStart = {
      lawData: lawAtStart.state.law,
      display: displayOf(state),
      modifiers: lawAtStart.modifiers,
    };

    const boss = fightBoss(state);
    state = boss.state;
    observations.bossFight = {
      rounds: boss.rounds,
      hpAfter: boss.hpAfter,
      cleared: boss.cleared,
      awakenedLines: boss.awakenedLines,
    };
    observations.afterBoss = {
      bossSnapshot: pan(state).bossSnapshot,
      route: pan(state).route,
      display: displayOf(state),
    };
    const selAfter = tryCommit(state, { type: "law/select-panopticon-route", route: "shadow" });
    observations.routeSelectAfterBoss = {
      status: selAfter.status,
      code: selAfter.code,
      message: selAfter.message,
      route: pan(selAfter.state).route,
    };
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("panopticon-boss-snapshot-and-freeze");
    expectFlow(flowC, expected, "flow-c");
    results.push({
      id: "panopticon-boss-snapshot-and-freeze",
      status: "PASS",
      snapshotFrozen: flowC.bossEntry.bossSnapshot !== null,
      awakened: flowC.bossFight.awakenedLines[0] ?? null,
    });
  }

  // Flow D exercises the decoy route rewards and the gate reward idempotency
  // boundary: the first panopticon_gate collect pays 850→1470 (run loot 620,
  // consumables 3→4, gate_sigil 1), the second collect is domain-rejected
  // ('监察城正门已经领取过奖励。'), and after selecting decoy each exposure
  // grants +120 run RP (decoyRewardsGranted, clamped at 3 so the 4th exposure
  // grants nothing). The round-trip preserves the decoy route and rewards.
  const flowD = (() => {
    let state = hubState;
    const observations = {};
    state = enterCity(state);
    const before = state.rewardPoints;
    state = commit(state, { type: "node/collect-reward" }, "collect gate first");
    observations.gateFirst = {
      rewardPointsBefore: before,
      rewardPointsAfter: state.rewardPoints,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      focusIncense: state.inventory.focus_incense,
      dispelTalisman: state.inventory.dispel_talisman,
      armorPatch: state.inventory.armor_patch,
      gateSigil: state.inventory.gate_sigil,
    };
    const second = tryCommit(state, { type: "node/collect-reward" });
    observations.gateSecond = {
      status: second.status,
      code: second.code,
      message: second.message,
      rewardPoints: second.state.rewardPoints,
    };

    state = goto(state, ["all_sight_lock", "blindspot_theater", "blindline_archive", "north_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    state = goto(state, ["upper_entry", "central_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    state = goto(state, ["south_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    state = commit(state, { type: "law/select-panopticon-route", route: "decoy" }, "select decoy");

    const decoyMoves = [];
    for (const nodeId of [
      "refraction_lab",
      "south_blind_relay",
      "refraction_lab",
      "spectrum_switchyard",
      "refraction_lab",
      "south_blind_relay",
      "refraction_lab",
      "south_blind_relay",
    ]) {
      const m = moveWithScan(state, nodeId);
      state = m.state;
      decoyMoves.push({
        target: m.target,
        phaseBefore: m.phaseBefore,
        phaseAfter: m.phaseAfter,
        hpAfter: m.hpAfter,
        scanLog: m.scanLog,
      });
    }
    observations.decoyFarm = {
      moves: decoyMoves,
      exposureCount: pan(state).exposureCount,
      decoyRewardsGranted: pan(state).decoyRewardsGranted,
      runLootRewardPoints: state.run.lootBag.rewardPoints ?? null,
      rewardPoints: state.rewardPoints,
    };
    observations.afterDecoyDisplay = displayOf(state);
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("panopticon-decoy-rewards-idempotency");
    expectFlow(flowD, expected, "flow-d");
    results.push({
      id: "panopticon-decoy-rewards-idempotency",
      status: "PASS",
      secondCollect: flowD.gateSecond.status,
      decoyRewards: flowD.decoyFarm.decoyRewardsGranted,
    });
  }

  // Flow E exercises the shadow route exposure immunity: after selecting
  // shadow, scanned moves log 影路遮蔽 and never expose (exposureCount stays
  // 0, hp unchanged), and the round-trip preserves the shadow route.
  const flowE = (() => {
    let state = hubState;
    const observations = {};
    state = enterCity(state);
    state = goto(state, ["all_sight_lock", "blindspot_theater", "blindline_archive", "north_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect north");
    state = goto(state, ["upper_entry", "central_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect central");
    state = goto(state, ["south_blind_relay"]);
    state = commit(state, { type: "node/collect-reward" }, "collect south");
    state = commit(state, { type: "law/select-panopticon-route", route: "shadow" }, "select shadow");

    const shadowMoves = [];
    for (const nodeId of ["refraction_lab", "south_blind_relay", "refraction_lab"]) {
      const m = moveWithScan(state, nodeId);
      state = m.state;
      shadowMoves.push({
        target: m.target,
        phaseBefore: m.phaseBefore,
        phaseAfter: m.phaseAfter,
        hpAfter: m.hpAfter,
        scanLog: m.scanLog,
      });
    }
    observations.shadowFarm = {
      moves: shadowMoves,
      exposureCount: pan(state).exposureCount,
      refractionCharges: pan(state).refractionCharges,
      decoyRewardsGranted: pan(state).decoyRewardsGranted,
    };
    observations.afterShadowDisplay = displayOf(state);
    observations.roundtrip = roundtrip(state);
    return observations;
  })();

  {
    const expected = expectedById.get("panopticon-shadow-route-no-exposure");
    expectFlow(flowE, expected, "flow-e");
    results.push({
      id: "panopticon-shadow-route-no-exposure",
      status: "PASS",
      exposureCount: flowE.shadowFarm.exposureCount,
      route: flowE.roundtrip.lawData.route,
    });
  }

  return {
    oracleCommit: decoded.report.source.oracleCommit,
    baseInput: { path: fixture.baseInput.path, sha256: fixture.baseInput.sha256 },
    entrySeed,
    scenarios: results,
  };
}

async function loadActualCocosAssetContract(projectRoot) {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch (error) {
    throw new AcceptanceBlockedError(
      `esbuild is unavailable for the isolated Cocos asset contract: ${String(error)}`,
    );
  }

  const entry = [
    'export { ManifestCocosAssetPort, classifyCocosAssetError } from "./cocos/assets/scripts/platform/cocos-asset-port.ts";',
    'export { CocosResourcesLoader } from "./cocos/assets/scripts/platform/cocos-resources-loader.ts";',
  ].join("\n");
  let buildResult;
  try {
    buildResult = await esbuild.build({
      stdin: {
        contents: entry,
        loader: "ts",
        resolveDir: projectRoot,
        sourcefile: "acceptance-asset-contract.ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "node",
      target: "node22",
      logLevel: "silent",
    });
  } catch (error) {
    throw new AcceptanceBlockedError(
      `actual Cocos asset contract could not be bundled: ${String(error)}`,
    );
  }
  const output = buildResult.outputFiles?.[0]?.text;
  if (typeof output !== "string" || output.length === 0) {
    throw new AcceptanceBlockedError("esbuild produced no Cocos asset contract output");
  }
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  return import(moduleUrl);
}

class AcceptanceAssetLoader {
  source = new Map();
  cache = new Map();
  loadPaths = [];
  released = [];

  peek(resourcePath) {
    return this.cache.get(resourcePath) ?? null;
  }

  async load(resourcePath) {
    this.loadPaths.push(resourcePath);
    const value = this.source.get(resourcePath);
    if (value === undefined) throw { code: "decode", retryable: false };
    this.cache.set(resourcePath, value);
    return value;
  }

  release(nativeHandle) {
    this.released.push(nativeHandle);
  }
}

function isPathInside(root, candidate) {
  const path = relative(root, candidate);
  return path !== ".." && !path.startsWith(`..${sep}`) && !resolve(path).startsWith("..");
}

export async function assetKeyRevisionCache({ fixture, projectRoot, assetManifest }) {
  const { ManifestCocosAssetPort, CocosResourcesLoader } =
    await loadActualCocosAssetContract(projectRoot);
  const expected = fixture.expected;
  equal(assetManifest.schemaVersion, expected.assetManifestSchemaVersion, "asset schemaVersion");
  equal(assetManifest.assetCount, assetManifest.assets.length, "assetCount field");

  const revisionPayload = {
    schemaVersion: assetManifest.schemaVersion,
    sourceManifest: assetManifest.sourceManifest,
    resourceRoot: assetManifest.resourceRoot,
    assets: assetManifest.assets,
  };
  const calculatedRevision = `sha256:${sha256(JSON.stringify(revisionPayload))}`;
  equal(calculatedRevision, assetManifest.manifestRevision, "calculated manifestRevision");

  // The fixture freezes the migrated Web snapshot. Cocos-only art has no
  // webSourcePath and extends the current manifest without changing that snapshot.
  const migratedAssets = assetManifest.assets.filter(
    (asset) => typeof asset.webSourcePath === "string",
  );
  equal(migratedAssets.length, expected.assetCount, "frozen Web asset count");
  const migratedRevision = `sha256:${sha256(JSON.stringify({
    ...revisionPayload,
    assets: migratedAssets,
  }))}`;
  equal(migratedRevision, expected.manifestRevision, "frozen Web manifestRevision");

  const resourcesRoot = resolve(projectRoot, "cocos/assets/resources");
  const keys = new Set();
  const paths = new Set();
  for (const asset of assetManifest.assets) {
    equal(asset.key, `${asset.kind}:${asset.entityId}`, `${asset.key} explicit key identity`);
    assert(!keys.has(asset.key), `${asset.key} must be unique`);
    keys.add(asset.key);
    assert(extname(asset.resourcePath) === "", `${asset.key} resourcePath must be extensionless`);
    equal(asset.resourceFile, `${asset.resourcePath}.png`, `${asset.key} resource file mapping`);
    assert(!paths.has(asset.resourcePath), `${asset.resourcePath} must be unique`);
    paths.add(asset.resourcePath);
    const physicalPath = resolve(resourcesRoot, asset.resourceFile);
    assert(isPathInside(resourcesRoot, physicalPath), `${asset.key} resource path escapes root`);
    assert(existsSync(physicalPath), `${asset.key} physical resource is missing`);
    equal(sha256(readFileSync(physicalPath)), asset.targetSha256, `${asset.key} physical SHA-256`);
  }

  const sample = assetManifest.assets.find((asset) => asset.key === expected.sample.key);
  assert(sample !== undefined, "frozen sample key must exist");
  for (const field of ["key", "kind", "entityId", "resourcePath", "resourceFile"]) {
    equal(sample[field], expected.sample[field], `sample ${field}`);
  }
  assert(sample.key !== sample.resourcePath, "stable key must not be inferred from a resource path");
  assert(
    sample.resourcePath.includes("-") && sample.entityId.includes("_"),
    "sample must retain visibly independent stable ID and filename conventions",
  );

  const loader = new AcceptanceAssetLoader();
  const nativeHandle = Object.freeze({ fixture: "native-handle" });
  loader.source.set(sample.resourcePath, nativeHandle);
  const port = new ManifestCocosAssetPort({
    manifest: {
      manifestRevision: assetManifest.manifestRevision,
      assets: [
        {
          key: sample.key,
          kind: sample.kind,
          resourcePath: sample.resourcePath,
          groups: ["acceptance-sample"],
        },
      ],
    },
    loader,
    fallbackFactory: (kind) => ({ kind, fixture: "fallback" }),
  });
  const report = await port.preload("acceptance-sample");
  equal(loader.loadPaths.length, 1, "loader call count");
  equal(loader.loadPaths[0], sample.resourcePath, "loader receives extensionless resourcePath");
  equal(report.revision, assetManifest.manifestRevision, "preload report revision");
  equal(report.loadedKeys.join(","), sample.key, "preload report key");
  equal(report.failures.length, 0, "preload failure count");

  const resolved = port.resolve(sample.key);
  assert(resolved.ok, "preloaded key must resolve");
  equal(resolved.revision, assetManifest.manifestRevision, "resolve result revision");
  equal(resolved.value.manifestRevision, assetManifest.manifestRevision, "handle revision");
  equal(resolved.value.nativeHandle, nativeHandle, "native handle identity");
  equal(port.resolve(sample.key).value, resolved.value, "cache returns the same immutable handle");
  assert(Object.isFrozen(resolved.value), "cached handle must be immutable");
  equal(port.fallback(sample.kind).manifestRevision, assetManifest.manifestRevision, "fallback revision");

  const mismatchPort = new ManifestCocosAssetPort({
    manifest: {
      manifestRevision: assetManifest.manifestRevision,
      assets: [
        {
          key: sample.key,
          kind: sample.kind,
          resourcePath: sample.resourcePath,
          manifestRevision: "sha256:deliberate-old-revision",
        },
      ],
    },
    loader: new AcceptanceAssetLoader(),
    fallbackFactory: () => ({}),
  });
  const mismatch = mismatchPort.resolve(sample.key);
  assert(!mismatch.ok, "mixed-revision entry must fail");
  equal(mismatch.code, "revision-mismatch", "mixed-revision error code");
  equal(mismatch.revision, assetManifest.manifestRevision, "mixed-revision report revision");

  const callbackCalls = [];
  const callbackNative = { fixture: "callback-native" };
  const resources = {
    get(path) {
      callbackCalls.push(["get", path]);
      return callbackNative;
    },
    load(path, _assetType, callback) {
      callbackCalls.push(["load", path]);
      callback(null, callbackNative);
    },
    release(asset) {
      callbackCalls.push(["release", asset === callbackNative]);
    },
  };
  const bridge = new CocosResourcesLoader(resources, { name: "SpriteFrame" });
  equal(bridge.peek(sample.resourcePath), callbackNative, "Cocos resources peek bridge");
  equal(await bridge.load(sample.resourcePath), callbackNative, "Cocos resources load bridge");
  bridge.release(callbackNative);
  equal(callbackCalls[0][1], sample.resourcePath, "peek path remains extensionless");
  equal(callbackCalls[1][1], sample.resourcePath, "load path remains extensionless");
  equal(callbackCalls[2][1], true, "release forwards the native handle");

  return {
    manifestRevision: assetManifest.manifestRevision,
    calculatedRevision,
    assetCount: assetManifest.assets.length,
    physicalAssetsVerified: assetManifest.assets.length,
    sample: {
      key: sample.key,
      resourcePath: sample.resourcePath,
      resourceFile: sample.resourceFile,
    },
    loaderContract: {
      extensionlessPath: loader.loadPaths[0],
      reportRevision: report.revision,
      handleRevision: resolved.value.manifestRevision,
      cacheIdentityStable: port.resolve(sample.key).value === resolved.value,
      mixedRevisionCode: mismatch.code,
      cocosResourcesBridge: "PASS",
    },
    scenarios: fixture.scenarioIds.map((id) => ({ id, status: "PASS" })),
  };
}

export async function assetErrorTaxonomy({ fixture, projectRoot, assetManifest }) {
  const { ManifestCocosAssetPort, classifyCocosAssetError } =
    await loadActualCocosAssetContract(projectRoot);
  // Error classification uses the fixture's own revision below; the current
  // complete manifest can advance independently while retaining the sample key.
  const manifestAsset = assetManifest.assets.find(
    (asset) => asset.key === fixture.expected.asset.key,
  );
  assert(manifestAsset !== undefined, "asset taxonomy frozen key exists");
  equal(manifestAsset.kind, fixture.expected.asset.kind, "asset taxonomy kind");
  equal(
    manifestAsset.resourcePath,
    fixture.expected.asset.resourcePath,
    "asset taxonomy resource path",
  );

  const results = [];
  for (const scenario of fixture.scenarios) {
    const thrown = { ...scenario.thrown };
    deepEqual(
      classifyCocosAssetError(thrown),
      scenario.expected,
      `${scenario.id} direct classification`,
    );

    const diagnostics = [];
    const loader = {
      peek() {
        return null;
      },
      async load() {
        throw thrown;
      },
      release() {
        throw new AcceptanceAssertionError(`${scenario.id} must not release a failed load`);
      },
    };
    const port = new ManifestCocosAssetPort({
      manifest: {
        manifestRevision: fixture.expected.manifestRevision,
        assets: [{
          key: fixture.expected.asset.key,
          kind: fixture.expected.asset.kind,
          resourcePath: fixture.expected.asset.resourcePath,
          groups: [fixture.expected.group],
        }],
      },
      loader,
      fallbackFactory: () => ({ fixture: "asset-error-fallback" }),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const report = await port.preload(fixture.expected.group);
    equal(report.loadedKeys.length, 0, `${scenario.id} has no loaded key`);
    equal(report.failures.length, 1, `${scenario.id} has one failure`);
    deepEqual(
      report.failures[0],
      {
        ok: false,
        key: fixture.expected.asset.key,
        revision: fixture.expected.manifestRevision,
        code: scenario.expected.code,
        retryable: scenario.expected.retryable,
      },
      `${scenario.id} protocol failure`,
    );
    equal(diagnostics.length, 1, `${scenario.id} diagnostic count`);
    deepEqual(
      {
        key: diagnostics[0].key,
        revision: diagnostics[0].revision,
        code: diagnostics[0].code,
      },
      {
        key: fixture.expected.asset.key,
        revision: fixture.expected.manifestRevision,
        code: scenario.expected.code,
      },
      `${scenario.id} diagnostic binding`,
    );
    equal(diagnostics[0].cause, thrown, `${scenario.id} diagnostic cause identity`);
    results.push({
      id: scenario.id,
      status: "PASS",
      code: scenario.expected.code,
      retryable: scenario.expected.retryable,
      diagnostic: {
        key: diagnostics[0].key,
        revision: diagnostics[0].revision,
        code: diagnostics[0].code,
      },
    });
  }

  return {
    manifestRevision: fixture.expected.manifestRevision,
    taxonomySize: results.length,
    scenarios: results,
  };
}

export const implementedCaseFunctions = Object.freeze({
  assetErrorTaxonomy,
  hashCanonicalJsonV1,
  seedRootLabelGoldenV1,
  assetKeyRevisionCache,
  catalog19Dungeons,
  webV1EquipmentHunt,
  webV1SingleMethodSnapshot,
  webV1MissingRunSnapshots,
  webV1TwoEncounterAliases,
  law01DemonTower,
  law02Metro,
  law03Mine,
  law04Hospital,
  law05Arena,
  law06Dream,
  law07Virtual,
  law08Chronal,
  law09Causal,
  law10Entropy,
  law11Mirror,
  law12Redaction,
  law13Auction,
  law14Genesis,
  law15Broadcast,
  law16Shelter,
  law17Verdict,
  law18Replay,
  law19Panopticon,
});
