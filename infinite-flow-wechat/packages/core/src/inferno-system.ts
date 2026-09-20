import type {
  DungeonDefinition,
  DungeonId,
  DungeonNode,
  MonsterDefinition
} from './game';
import { getDungeonRouteGates } from './dungeon-routes';

export const INFERNO_RULES_VERSION = 1 as const;
export const INFERNO_MAP_RULES_VERSION = 1 as const;

export type InfernoProgress = Readonly<Partial<Record<DungeonId, number>>>;

export type InfernoTierModifiers = Readonly<{
  tier: number;
  enemyStatMultiplierPercent: number;
  trapDamageMultiplierPercent: number;
  trapDcMultiplierPercent: number;
  rewardPointMultiplierPercent: number;
  materialAmount: number;
  itemQuantityMultiplier: number;
  duplicateSalvageRewardPoints: number;
}>;

export type InfernoMapNodeSnapshot = Readonly<{
  nodeId: string;
  x: number;
  y: number;
  connectionIds: readonly string[];
}>;

export type InfernoMapSnapshot = Readonly<{
  rulesVersion: typeof INFERNO_MAP_RULES_VERSION;
  seed: number;
  width: number;
  height: number;
  nodes: readonly InfernoMapNodeSnapshot[];
}>;

export type InfernoMapInput = Readonly<{
  dungeon: DungeonDefinition;
  seed: number;
  bossNodeId: string;
  entryNodeId?: string;
  priorityNodeIds?: readonly string[];
}>;

export type InfernoMapTopologyValidation = Readonly<{
  valid: boolean;
  errors: readonly string[];
}>;

const UINT32_MAX = 0xffff_ffff;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

function clampSafeInteger(value: number, minimum = 0): number {
  if (!Number.isFinite(value)) return MAX_SAFE_INTEGER;
  return Math.min(MAX_SAFE_INTEGER, Math.max(minimum, Math.floor(value)));
}

export function normalizeInfernoTier(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 1
    ? Number(value)
    : undefined;
}

function normalizeSeed(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= UINT32_MAX
    ? value
    : 1;
}

function createRandom(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function scalePositiveInteger(value: number, multiplierPercent: number): number {
  const base = clampSafeInteger(value, 1);
  const multiplier = clampSafeInteger(multiplierPercent, 1);
  return clampSafeInteger(Math.ceil(base * multiplier / 100), 1);
}

function scaleNonNegativeInteger(value: number, multiplierPercent: number): number {
  const base = clampSafeInteger(value);
  const multiplier = clampSafeInteger(multiplierPercent, 1);
  return clampSafeInteger(Math.ceil(base * multiplier / 100));
}

export function getInfernoUnlockedTier(
  progress: InfernoProgress | null | undefined,
  dungeonId: DungeonId,
  completedDungeonIds: readonly DungeonId[]
): number {
  if (!completedDungeonIds.includes(dungeonId)) return 0;
  return normalizeInfernoTier(progress?.[dungeonId]) ?? 1;
}

export function unlockNextInfernoTier(
  progress: InfernoProgress | null | undefined,
  dungeonId: DungeonId,
  clearedTier: number,
  completedDungeonIds: readonly DungeonId[]
): InfernoProgress {
  const unlockedTier = getInfernoUnlockedTier(progress, dungeonId, completedDungeonIds);
  const normalizedClearedTier = normalizeInfernoTier(clearedTier);
  if (unlockedTier < 1 || normalizedClearedTier === undefined || normalizedClearedTier !== unlockedTier) {
    return { ...(progress ?? {}) };
  }
  return {
    ...(progress ?? {}),
    [dungeonId]: clampSafeInteger(unlockedTier + 1, 1)
  };
}

export function sanitizeInfernoProgress(
  value: unknown,
  completedDungeonIds: readonly DungeonId[]
): InfernoProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const completed = new Set(completedDungeonIds);
  const result: Partial<Record<DungeonId, number>> = {};
  for (const [dungeonId, tier] of Object.entries(value)) {
    const normalized = normalizeInfernoTier(tier);
    if (completed.has(dungeonId as DungeonId) && normalized !== undefined) {
      result[dungeonId as DungeonId] = normalized;
    }
  }
  return result;
}

export function getInfernoTierModifiers(value: number): InfernoTierModifiers {
  const tier = normalizeInfernoTier(value) ?? 1;
  const depth = tier - 1;
  const logarithmicGrowth = Math.floor(Math.log2(tier) * 4);
  return {
    tier,
    enemyStatMultiplierPercent: clampSafeInteger(100 + depth * 18 + logarithmicGrowth, 1),
    trapDamageMultiplierPercent: clampSafeInteger(100 + depth * 14 + logarithmicGrowth, 1),
    trapDcMultiplierPercent: clampSafeInteger(100 + depth * 3 + Math.floor(Math.log2(tier)), 1),
    rewardPointMultiplierPercent: clampSafeInteger(100 + depth * 15 + logarithmicGrowth, 1),
    materialAmount: clampSafeInteger(3 + Math.floor(Math.log2(tier)), 1),
    itemQuantityMultiplier: clampSafeInteger(1 + Math.floor(Math.log2(tier) / 3), 1),
    duplicateSalvageRewardPoints: clampSafeInteger(80 + tier * 20, 1)
  };
}

export function scaleMonsterForInfernoTier(
  monster: MonsterDefinition,
  tier: number
): MonsterDefinition {
  const multiplier = getInfernoTierModifiers(tier).enemyStatMultiplierPercent;
  if (multiplier === 100) return monster;
  return {
    ...monster,
    maxHp: scalePositiveInteger(monster.maxHp, multiplier),
    attack: scalePositiveInteger(monster.attack, multiplier),
    artPower: monster.artPower > 0 ? scalePositiveInteger(monster.artPower, multiplier) : 0,
    defense: monster.defense > 0 ? scalePositiveInteger(monster.defense, multiplier) : 0,
    speed: scalePositiveInteger(monster.speed, multiplier)
  };
}

export function scaleTrapForInfernoTier<T extends Readonly<{ damage: number; dc: number }>>(
  trap: T,
  tier: number
): T {
  const modifiers = getInfernoTierModifiers(tier);
  if (
    modifiers.trapDamageMultiplierPercent === 100 &&
    modifiers.trapDcMultiplierPercent === 100
  ) {
    return trap;
  }
  return {
    ...trap,
    damage: scalePositiveInteger(trap.damage, modifiers.trapDamageMultiplierPercent),
    dc: scalePositiveInteger(trap.dc, modifiers.trapDcMultiplierPercent)
  };
}

export function scaleInfernoRewardPoints(value: number, tier: number): number {
  return scaleNonNegativeInteger(
    value,
    getInfernoTierModifiers(tier).rewardPointMultiplierPercent
  );
}

export function scaleInfernoItemDrops<ItemId extends string>(
  items: Readonly<Partial<Record<ItemId, number>>>,
  tier: number
): Partial<Record<ItemId, number>> {
  const multiplier = getInfernoTierModifiers(tier).itemQuantityMultiplier;
  const result: Partial<Record<ItemId, number>> = {};
  for (const [itemId, amount] of Object.entries(items) as Array<[ItemId, number | undefined]>) {
    if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
      result[itemId] = clampSafeInteger(amount * multiplier, 1);
    }
  }
  return result;
}

function getSerpentineCells(count: number, width: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  const height = Math.ceil(count / width);
  for (let y = 0; y < height; y += 1) {
    const xs = Array.from({ length: width }, (_, x) => x);
    if (y % 2 === 1) xs.reverse();
    for (const x of xs) {
      if (cells.length >= count) return cells;
      cells.push({ x, y });
    }
  }
  return cells;
}

function addConnection(
  connections: Map<string, Set<string>>,
  leftNodeId: string,
  rightNodeId: string
): void {
  if (leftNodeId === rightNodeId) return;
  connections.get(leftNodeId)?.add(rightNodeId);
  connections.get(rightNodeId)?.add(leftNodeId);
}

function getConnectionKey(leftNodeId: string, rightNodeId: string): string {
  return leftNodeId < rightNodeId
    ? `${leftNodeId}\u0000${rightNodeId}`
    : `${rightNodeId}\u0000${leftNodeId}`;
}

function getCanonicalConnections(dungeon: DungeonDefinition): Map<string, Set<string>> {
  const connections = new Map(
    dungeon.nodes.map((node) => [node.id, new Set<string>()])
  );
  const nodeByCell = new Map(
    dungeon.nodes.map((node) => [`${node.position.x},${node.position.y}`, node.id])
  );
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ] as const;

  for (const node of dungeon.nodes) {
    for (const [xOffset, yOffset] of offsets) {
      const adjacentNodeId = nodeByCell.get(
        `${node.position.x + xOffset},${node.position.y + yOffset}`
      );
      if (adjacentNodeId) addConnection(connections, node.id, adjacentNodeId);
    }
  }
  return connections;
}

type InfernoTopologyPlan = Readonly<{
  exitNodeId: string;
  ordinaryNodeIds: readonly string[];
  components: readonly (readonly string[])[];
  componentIndexByNodeId: ReadonlyMap<string, number>;
  protectedOrdinaryConnections: readonly (readonly [string, string])[];
  protectedConnectionKeys: ReadonlySet<string>;
  bossSourceNodeIds: readonly string[];
}>;

function createInfernoTopologyPlan(
  dungeon: DungeonDefinition,
  bossNodeId: string
): InfernoTopologyPlan {
  const exitNode = dungeon.nodes.find((node) => node.type === 'exit');
  if (!exitNode) throw new Error(`Dungeon ${dungeon.id} has no exit node`);

  const nodeIds = new Set(dungeon.nodes.map((node) => node.id));
  if (!nodeIds.has(bossNodeId)) {
    throw new Error(`Dungeon ${dungeon.id} has no boss node ${bossNodeId}`);
  }

  const ordinaryNodeIds = dungeon.nodes
    .map((node) => node.id)
    .filter((nodeId) => nodeId !== bossNodeId && nodeId !== exitNode.id);
  const ordinaryNodeIdSet = new Set(ordinaryNodeIds);
  const protectedOrdinaryConnections: Array<readonly [string, string]> = [];
  const protectedConnectionKeys = new Set<string>();
  const bossSourceNodeIds = new Set<string>();

  for (const gate of getDungeonRouteGates(dungeon.id)) {
    if (!nodeIds.has(gate.fromNodeId) || !nodeIds.has(gate.toNodeId)) continue;
    if (
      gate.toNodeId === bossNodeId &&
      ordinaryNodeIdSet.has(gate.fromNodeId)
    ) {
      bossSourceNodeIds.add(gate.fromNodeId);
      continue;
    }
    if (
      gate.fromNodeId === exitNode.id ||
      gate.toNodeId === exitNode.id ||
      gate.fromNodeId === bossNodeId ||
      gate.toNodeId === bossNodeId
    ) {
      continue;
    }
    const key = getConnectionKey(gate.fromNodeId, gate.toNodeId);
    if (protectedConnectionKeys.has(key)) continue;
    protectedConnectionKeys.add(key);
    protectedOrdinaryConnections.push([gate.fromNodeId, gate.toNodeId]);
  }

  if (bossSourceNodeIds.size === 0) {
    throw new Error(`Dungeon ${dungeon.id} has no protected boss approach`);
  }

  const canonicalConnections = getCanonicalConnections(dungeon);
  const components: string[][] = [];
  const componentIndexByNodeId = new Map<string, number>();
  for (const startNodeId of ordinaryNodeIds) {
    if (componentIndexByNodeId.has(startNodeId)) continue;
    const componentIndex = components.length;
    const component: string[] = [];
    const queue = [startNodeId];
    componentIndexByNodeId.set(startNodeId, componentIndex);
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      component.push(nodeId);
      for (const adjacentNodeId of canonicalConnections.get(nodeId) ?? []) {
        if (
          !ordinaryNodeIdSet.has(adjacentNodeId) ||
          protectedConnectionKeys.has(getConnectionKey(nodeId, adjacentNodeId)) ||
          componentIndexByNodeId.has(adjacentNodeId)
        ) {
          continue;
        }
        componentIndexByNodeId.set(adjacentNodeId, componentIndex);
        queue.push(adjacentNodeId);
      }
    }
    components.push(component.sort());
  }

  return {
    exitNodeId: exitNode.id,
    ordinaryNodeIds,
    components,
    componentIndexByNodeId,
    protectedOrdinaryConnections,
    protectedConnectionKeys,
    bossSourceNodeIds: [...bossSourceNodeIds].sort()
  };
}

function orderComponentNodeIds(
  component: readonly string[],
  entryNodeId: string | undefined,
  priorityNodeIds: ReadonlySet<string>,
  protectedConnectionKeys: ReadonlySet<string>,
  random: () => number
): string[] {
  const createPreferredOrder = (): string[] => {
    const shuffled = shuffle(component, random);
    const entry = entryNodeId && shuffled.includes(entryNodeId)
      ? entryNodeId
      : undefined;
    const priorities = shuffle(
      shuffled.filter((nodeId) => nodeId !== entry && priorityNodeIds.has(nodeId)),
      random
    );
    const remaining = shuffled.filter(
      (nodeId) => nodeId !== entry && !priorityNodeIds.has(nodeId)
    );
    return [...(entry ? [entry] : []), ...priorities, ...remaining];
  };
  const hasProtectedCycleEdge = (nodeIds: readonly string[]): boolean =>
    nodeIds.length >= 3 && nodeIds.some((nodeId, index) =>
      protectedConnectionKeys.has(
        getConnectionKey(nodeId, nodeIds[(index + 1) % nodeIds.length])
      )
    );

  let preferredOrder = createPreferredOrder();
  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (!hasProtectedCycleEdge(preferredOrder)) return preferredOrder;
    preferredOrder = createPreferredOrder();
  }

  const firstNodeId = preferredOrder[0];
  let fallbackSearchBudget = 10_000;
  const findFallbackCycle = (
    path: readonly string[],
    remainingNodeIds: readonly string[]
  ): string[] | undefined => {
    fallbackSearchBudget -= 1;
    if (fallbackSearchBudget < 0) return undefined;
    if (remainingNodeIds.length === 0) {
      return protectedConnectionKeys.has(
        getConnectionKey(path[path.length - 1], firstNodeId)
      )
        ? undefined
        : [...path];
    }
    const previousNodeId = path[path.length - 1];
    for (let index = 0; index < remainingNodeIds.length; index += 1) {
      const candidateNodeId = remainingNodeIds[index];
      if (protectedConnectionKeys.has(getConnectionKey(previousNodeId, candidateNodeId))) {
        continue;
      }
      const result = findFallbackCycle(
        [...path, candidateNodeId],
        remainingNodeIds.filter((_, candidateIndex) => candidateIndex !== index)
      );
      if (result) return result;
    }
    return undefined;
  };
  const fallback = findFallbackCycle([firstNodeId], preferredOrder.slice(1));
  if (!fallback) {
    throw new Error('Unable to construct a protected-edge-free inferno component cycle');
  }
  return fallback;
}

export function createInfernoMapSnapshot(input: InfernoMapInput): InfernoMapSnapshot {
  const { dungeon, bossNodeId } = input;
  const seed = normalizeSeed(input.seed);
  const random = createRandom(seed);
  const topology = createInfernoTopologyPlan(dungeon, bossNodeId);
  const ordinaryNodeIdSet = new Set(topology.ordinaryNodeIds);
  const requestedEntryNodeId = input.entryNodeId ?? dungeon.grid.startNodeId;
  const entryNodeId = ordinaryNodeIdSet.has(requestedEntryNodeId)
    ? requestedEntryNodeId
    : dungeon.grid.startNodeId;
  const priorityNodeIds = new Set(
    (input.priorityNodeIds ?? []).filter((nodeId) => ordinaryNodeIdSet.has(nodeId))
  );
  const entryComponentIndex = topology.componentIndexByNodeId.get(entryNodeId);
  const remainingComponentIndexes = shuffle(
    topology.components
      .map((_, index) => index)
      .filter((index) => index !== entryComponentIndex),
    random
  );
  const componentIndexes = [
    ...(entryComponentIndex === undefined ? [] : [entryComponentIndex]),
    ...remainingComponentIndexes
  ];
  const orderedComponents = componentIndexes.map((componentIndex) =>
    orderComponentNodeIds(
      topology.components[componentIndex],
      componentIndex === entryComponentIndex ? entryNodeId : undefined,
      priorityNodeIds,
      topology.protectedConnectionKeys,
      random
    )
  );
  const orderedIds = [
    ...orderedComponents.flat(),
    bossNodeId,
    topology.exitNodeId
  ];

  const width = Math.max(4, Math.ceil(Math.sqrt(orderedIds.length * 1.35)));
  const height = Math.ceil(orderedIds.length / width);
  let cells = getSerpentineCells(orderedIds.length, width);
  if (random() < 0.5) {
    cells = cells.map(({ x, y }) => ({ x: width - x - 1, y }));
  }
  const positioned = orderedIds.map((nodeId, index) => ({
    nodeId,
    ...cells[index]
  }));
  const connections = new Map(positioned.map(({ nodeId }) => [nodeId, new Set<string>()]));

  for (const component of orderedComponents) {
    if (component.length === 2) {
      addConnection(connections, component[0], component[1]);
    } else if (component.length >= 3) {
      for (let index = 0; index < component.length; index += 1) {
        addConnection(
          connections,
          component[index],
          component[(index + 1) % component.length]
        );
      }
    }
  }

  for (let leftIndex = 0; leftIndex < positioned.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < positioned.length; rightIndex += 1) {
      const left = positioned[leftIndex];
      const right = positioned[rightIndex];
      const leftComponent = topology.componentIndexByNodeId.get(left.nodeId);
      if (
        leftComponent === undefined ||
        leftComponent !== topology.componentIndexByNodeId.get(right.nodeId) ||
        topology.protectedConnectionKeys.has(getConnectionKey(left.nodeId, right.nodeId))
      ) {
        continue;
      }
      if (Math.abs(left.x - right.x) + Math.abs(left.y - right.y) !== 1) continue;
      if (connections.get(left.nodeId)?.has(right.nodeId)) continue;
      if (random() < 0.42) addConnection(connections, left.nodeId, right.nodeId);
    }
  }

  for (const [fromNodeId, toNodeId] of topology.protectedOrdinaryConnections) {
    addConnection(connections, fromNodeId, toNodeId);
  }
  for (const sourceNodeId of topology.bossSourceNodeIds) {
    addConnection(connections, sourceNodeId, bossNodeId);
  }
  addConnection(connections, bossNodeId, topology.exitNodeId);

  const snapshot: InfernoMapSnapshot = {
    rulesVersion: INFERNO_MAP_RULES_VERSION,
    seed,
    width,
    height,
    nodes: positioned.map(({ nodeId, x, y }) => ({
      nodeId,
      x,
      y,
      connectionIds: [...(connections.get(nodeId) ?? [])].sort()
    }))
  };
  const validation = validateInfernoMapTopology(snapshot, dungeon, bossNodeId);
  if (!validation.valid) {
    throw new Error(
      `Dungeon ${dungeon.id} produced an unsafe inferno map: ${validation.errors.join('; ')}`
    );
  }
  return snapshot;
}

export function isInfernoMapSnapshot(
  value: unknown,
  dungeon: DungeonDefinition
): value is InfernoMapSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Partial<InfernoMapSnapshot>;
  if (
    snapshot.rulesVersion !== INFERNO_MAP_RULES_VERSION ||
    !Number.isInteger(snapshot.seed) ||
    (snapshot.seed ?? 0) < 1 ||
    (snapshot.seed ?? 0) > UINT32_MAX ||
    !Number.isSafeInteger(snapshot.width) ||
    (snapshot.width ?? 0) < 1 ||
    !Number.isSafeInteger(snapshot.height) ||
    (snapshot.height ?? 0) < 1 ||
    !Array.isArray(snapshot.nodes) ||
    snapshot.nodes.length !== dungeon.nodes.length
  ) {
    return false;
  }

  const expectedNodeIds = new Set(dungeon.nodes.map((node) => node.id));
  const nodes = snapshot.nodes as InfernoMapNodeSnapshot[];
  const seenNodeIds = new Set<string>();
  const seenCells = new Set<string>();
  for (const node of nodes) {
    if (
      !node ||
      typeof node !== 'object' ||
      typeof node.nodeId !== 'string' ||
      !expectedNodeIds.has(node.nodeId) ||
      seenNodeIds.has(node.nodeId) ||
      !Number.isInteger(node.x) ||
      node.x < 0 ||
      node.x >= (snapshot.width ?? 0) ||
      !Number.isInteger(node.y) ||
      node.y < 0 ||
      node.y >= (snapshot.height ?? 0) ||
      !Array.isArray(node.connectionIds) ||
      node.connectionIds.some((nodeId) => typeof nodeId !== 'string' || !expectedNodeIds.has(nodeId)) ||
      new Set(node.connectionIds).size !== node.connectionIds.length
    ) {
      return false;
    }
    const cell = `${node.x},${node.y}`;
    if (seenCells.has(cell)) return false;
    seenNodeIds.add(node.nodeId);
    seenCells.add(cell);
  }

  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  for (const node of nodes) {
    for (const connectionId of node.connectionIds) {
      if (!byId.get(connectionId)?.connectionIds.includes(node.nodeId)) return false;
    }
  }
  const startNodeId = dungeon.grid.startNodeId;
  const visited = new Set([startNodeId]);
  const queue = [startNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const connectionId of byId.get(nodeId)?.connectionIds ?? []) {
      if (visited.has(connectionId)) continue;
      visited.add(connectionId);
      queue.push(connectionId);
    }
  }
  return visited.size === expectedNodeIds.size;
}

function canReachComponentWithoutNode(
  component: readonly string[],
  connectionIdsByNodeId: ReadonlyMap<string, ReadonlySet<string>>,
  protectedConnectionKeys: ReadonlySet<string>,
  removedNodeId?: string
): boolean {
  const remainingNodeIds = component.filter((nodeId) => nodeId !== removedNodeId);
  if (remainingNodeIds.length <= 1) return true;
  const allowedNodeIds = new Set(remainingNodeIds);
  const visited = new Set([remainingNodeIds[0]]);
  const queue = [remainingNodeIds[0]];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const adjacentNodeId of connectionIdsByNodeId.get(nodeId) ?? []) {
      if (
        !allowedNodeIds.has(adjacentNodeId) ||
        protectedConnectionKeys.has(getConnectionKey(nodeId, adjacentNodeId)) ||
        visited.has(adjacentNodeId)
      ) {
        continue;
      }
      visited.add(adjacentNodeId);
      queue.push(adjacentNodeId);
    }
  }
  return visited.size === remainingNodeIds.length;
}

export function validateInfernoMapTopology(
  snapshot: InfernoMapSnapshot,
  dungeon: DungeonDefinition,
  bossNodeId: string
): InfernoMapTopologyValidation {
  if (!isInfernoMapSnapshot(snapshot, dungeon)) {
    return { valid: false, errors: ['invalid_snapshot'] };
  }

  const topology = createInfernoTopologyPlan(dungeon, bossNodeId);
  const connectionIdsByNodeId = new Map(
    snapshot.nodes.map((node) => [node.nodeId, new Set(node.connectionIds)])
  );
  const errors: string[] = [];

  for (const [fromNodeId, toNodeId] of topology.protectedOrdinaryConnections) {
    if (!connectionIdsByNodeId.get(fromNodeId)?.has(toNodeId)) {
      errors.push(`missing_protected_connection:${fromNodeId}:${toNodeId}`);
    }
  }

  const expectedBossNeighbors = new Set([
    ...topology.bossSourceNodeIds,
    topology.exitNodeId
  ]);
  const actualBossNeighbors = connectionIdsByNodeId.get(bossNodeId) ?? new Set<string>();
  if (
    actualBossNeighbors.size !== expectedBossNeighbors.size ||
    [...actualBossNeighbors].some((nodeId) => !expectedBossNeighbors.has(nodeId))
  ) {
    errors.push('invalid_boss_boundary');
  }
  const exitNeighbors = connectionIdsByNodeId.get(topology.exitNodeId) ?? new Set<string>();
  if (exitNeighbors.size !== 1 || !exitNeighbors.has(bossNodeId)) {
    errors.push('invalid_exit_boundary');
  }

  for (const nodeId of topology.ordinaryNodeIds) {
    const componentIndex = topology.componentIndexByNodeId.get(nodeId);
    for (const adjacentNodeId of connectionIdsByNodeId.get(nodeId) ?? []) {
      if (
        adjacentNodeId === bossNodeId ||
        adjacentNodeId === topology.exitNodeId ||
        topology.componentIndexByNodeId.get(adjacentNodeId) === componentIndex ||
        topology.protectedConnectionKeys.has(getConnectionKey(nodeId, adjacentNodeId))
      ) {
        continue;
      }
      errors.push(`unprotected_cross_component:${nodeId}:${adjacentNodeId}`);
    }
  }

  for (const component of topology.components) {
    if (!canReachComponentWithoutNode(
      component,
      connectionIdsByNodeId,
      topology.protectedConnectionKeys
    )) {
      errors.push(`disconnected_component:${component[0]}`);
      continue;
    }
    if (
      component.length >= 3 &&
      component.some((nodeId) => !canReachComponentWithoutNode(
        component,
        connectionIdsByNodeId,
        topology.protectedConnectionKeys,
        nodeId
      ))
    ) {
      errors.push(`component_has_articulation:${component[0]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function repairInfernoMapSnapshot(
  snapshot: InfernoMapSnapshot,
  input: Omit<InfernoMapInput, 'seed'>
): InfernoMapSnapshot {
  return validateInfernoMapTopology(
    snapshot,
    input.dungeon,
    input.bossNodeId
  ).valid
    ? snapshot
    : createInfernoMapSnapshot({ ...input, seed: snapshot.seed });
}

export function applyInfernoMapSnapshot(
  dungeon: DungeonDefinition,
  snapshot: InfernoMapSnapshot | undefined
): DungeonDefinition {
  if (!snapshot || !isInfernoMapSnapshot(snapshot, dungeon)) return dungeon;
  const layout = new Map(snapshot.nodes.map((node) => [node.nodeId, node]));
  return {
    ...dungeon,
    grid: {
      ...dungeon.grid,
      width: snapshot.width,
      height: snapshot.height
    },
    nodes: dungeon.nodes.map((node): DungeonNode => {
      const position = layout.get(node.id);
      return position
        ? { ...node, position: { x: position.x, y: position.y } }
        : node;
    })
  };
}

export function getInfernoConnectionIds(
  snapshot: InfernoMapSnapshot | undefined
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!snapshot) return undefined;
  return Object.fromEntries(snapshot.nodes.map((node) => [node.nodeId, node.connectionIds]));
}

export function areInfernoNodesConnected(
  snapshot: InfernoMapSnapshot | undefined,
  leftNodeId: string,
  rightNodeId: string
): boolean | undefined {
  if (!snapshot) return undefined;
  return snapshot.nodes
    .find((node) => node.nodeId === leftNodeId)
    ?.connectionIds.includes(rightNodeId) ?? false;
}
