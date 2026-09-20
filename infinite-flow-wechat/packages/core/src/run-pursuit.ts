export const RUN_PURSUIT_RULES_VERSION = 1 as const;
export const RUN_PURSUIT_SPAWN_CLEAR_COUNT = 6;
export const RUN_PURSUIT_BOSS_FUSION_PERCENT = 15;

const RUN_PURSUIT_DUNGEON_IDS = [
  'demon_tower_1',
  'metro_abyss',
  'starfall_mine',
  'rust_hospital',
  'ash_arena',
  'dream_archive',
  'void_citadel',
  'temporal_observatory',
  'causal_clearinghouse',
  'entropy_ark',
  'mirror_cycle_city',
  'redaction_scriptorium',
  'legacy_auction_court',
  'genesis_vault',
  'silent_broadcast_tower',
  'lost_shelter',
  'false_testimony_court',
  'combat_replay_stage',
  'panopticon_city'
] as const;

const RUN_PURSUIT_STATUSES = [
  'disabled',
  'dormant',
  'stalking',
  'contained',
  'fused',
  'repelled'
] as const;

const RUN_PURSUIT_REPELLED_REASONS = [
  'stable_portal',
  'successful_exit',
  'retreat',
  'failure'
] as const;

const RUN_PURSUIT_STATE_KEYS = [
  'rulesVersion',
  'dungeonId',
  'status',
  'nodeId',
  'contacts',
  'graceMoves',
  'rewardGranted',
  'repelledReason'
] as const;

export type RunPursuitDungeonId = (typeof RUN_PURSUIT_DUNGEON_IDS)[number];
export type RunPursuitStatus = (typeof RUN_PURSUIT_STATUSES)[number];
export type RunPursuitSettlementReason = 'successful_exit' | 'retreat' | 'failure';
export type RunPursuitRepelledReason = (typeof RUN_PURSUIT_REPELLED_REASONS)[number];
export type RunPursuitMaterialId =
  | 'demon_bone'
  | 'mirror_shell'
  | 'star_iron'
  | 'medicine_ash'
  | 'cracked_core'
  | 'hidden_stone'
  | 'rift_dust'
  | 'chronal_glass'
  | 'causal_seal'
  | 'entropy_crystal'
  | 'phase_glass'
  | 'redaction_ink'
  | 'legacy_scrip'
  | 'genesis_serum'
  | 'silence_core'
  | 'rescue_badge'
  | 'truth_fragment'
  | 'combat_reel'
  | 'observation_shard';

export type RunPursuitDefinition = {
  readonly dungeonId: RunPursuitDungeonId;
  readonly name: string;
  readonly spawnNodeId: string;
  readonly containmentNodeId: string;
  readonly materialId: RunPursuitMaterialId;
  readonly rewardAmount: 1;
  readonly contactDamagePercent: 15;
  readonly bossFusionPercent: 15;
  readonly spawnClearCount: 6;
  readonly flavorDescription: string;
  readonly fusionDescription: string;
};

export const RUN_PURSUIT_CATALOG = {
  demon_tower_1: {
    dungeonId: 'demon_tower_1',
    name: '血阶监猎者',
    spawnNodeId: 'tower_butcher_patrol',
    containmentNodeId: 'sealed_cache',
    materialId: 'demon_bone',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '血阶深处的监猎者循着轮回侵蚀醒来，沿雾塔石阶追索闯入者。',
    fusionDescription: '监猎者融入塔主血甲，使首领的躯壳与攻势一同增幅。'
  },
  metro_abyss: {
    dungeonId: 'metro_abyss',
    name: '镜潮尾影',
    spawnNodeId: 'rail_wraith_relay',
    containmentNodeId: 'signal_cache',
    materialId: 'mirror_shell',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '镜潮尾影借废弃轨道反复折返，只在信号灯熄灭后显出轮廓。',
    fusionDescription: '尾影汇入深渊主宰的倒影，让每一道镜潮都更为沉重。'
  },
  starfall_mine: {
    dungeonId: 'starfall_mine',
    name: '裂门蜕兽',
    spawnNodeId: 'molt_beast_patrol',
    containmentNodeId: 'exit_anchor_reward',
    materialId: 'star_iron',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '裂门蜕兽在失衡矿道间蜕壳，以星铁震颤辨认猎物的方位。',
    fusionDescription: '蜕兽钻入矿主核心，把破碎重力压进首领的每次扑击。'
  },
  rust_hospital: {
    dungeonId: 'rust_hospital',
    name: '锈疫巡诊者',
    spawnNodeId: 'doctor_patrol_route',
    containmentNodeId: 'pharmacy_reward',
    materialId: 'medicine_ash',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '锈疫巡诊者推着空药车逐室查房，把尚有脉搏的人列入病历。',
    fusionDescription: '巡诊者把锈疫病历缝入院长，使首领的污染循环骤然加深。'
  },
  ash_arena: {
    dungeonId: 'ash_arena',
    name: '灰烬追裁者',
    spawnNodeId: 'ringbreaker_duelist',
    containmentNodeId: 'odds_marker',
    materialId: 'cracked_core',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '灰烬追裁者越过熄灭的擂台，以未决胜负为名追索离场者。',
    fusionDescription: '追裁者献上残火判词，令竞技场首领获得更猛烈的裁决之力。'
  },
  dream_archive: {
    dungeonId: 'dream_archive',
    name: '缺页狱卒',
    spawnNodeId: 'hallucination_patrol_two',
    containmentNodeId: 'index_reward',
    materialId: 'hidden_stone',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '缺页狱卒从被删去的索引中巡回，脚步声总比读者迟上一行。',
    fusionDescription: '狱卒补进馆主缺失的篇章，使首领能以更完整的梦境压迫来客。'
  },
  void_citadel: {
    dungeonId: 'void_citadel',
    name: '身份猎影',
    spawnNodeId: 'second_echo_patrol',
    containmentNodeId: 'identity_trap',
    materialId: 'rift_dust',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '身份猎影沿回声逐一核验姓名，任何迟疑都会成为它的新面孔。',
    fusionDescription: '猎影归还窃取的身份，让城主的虚界映身获得额外强度。'
  },
  temporal_observatory: {
    dungeonId: 'temporal_observatory',
    name: '零时哨兵',
    spawnNodeId: 'epoch_sentinel_alpha',
    containmentNodeId: 'past_calibration_anchor',
    materialId: 'chronal_glass',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '零时哨兵从停摆的一刻出发，在每条时间支流上重复同一次追捕。',
    fusionDescription: '哨兵折回零点融入摄政者，使首领同时占据更多时间切面。'
  },
  causal_clearinghouse: {
    dungeonId: 'causal_clearinghouse',
    name: '零和追缴者',
    spawnNodeId: 'paradox_bailiff_alpha',
    containmentNodeId: 'cause_deposition',
    materialId: 'causal_seal',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '零和追缴者沿未结清的因果债逐项核账，每次接触都会把逃逸者重新登记为债务人。',
    fusionDescription: '追缴者把未收回的债权并入主审，使首领从每段未决因果中抽取额外强度。'
  },
  entropy_ark: {
    dungeonId: 'entropy_ark',
    name: '熵潮弃航者',
    spawnNodeId: 'dissipation_navigator_alpha',
    containmentNodeId: 'port_ballast_core',
    materialId: 'entropy_crystal',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '熵潮弃航者沿耗散航迹逆流而来，把仍在前进的乘员逐一登记为弃航目标。',
    fusionDescription: '弃航者把耗散航图并入末舵手，使首领能从每次航向偏移中抽取额外强度。'
  },
  mirror_cycle_city: {
    dungeonId: 'mirror_cycle_city',
    name: '无面追像',
    spawnNodeId: 'parallax_hunter_mirror',
    containmentNodeId: 'reflection_event_stage',
    materialId: 'phase_glass',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '无面追像从镜相猎手脱落的轮廓中现身，沿每次相位切换追索唯一的本体。',
    fusionDescription: '追像把所有失败倒影并入无名镜王，使首领从每层镜壳中抽取额外强度。'
  },
  redaction_scriptorium: {
    dungeonId: 'redaction_scriptorium',
    name: '终稿追删者',
    spawnNodeId: 'palimpsest_censor_alpha',
    containmentNodeId: 'errata_event_stage',
    materialId: 'redaction_ink',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '终稿追删者沿校样边缘逼近，把仍未被删去的句子逐行标成追猎目标。',
    fusionDescription: '追删者将删改痕迹并入终稿主审，使首领从每处勘误中抽取额外强度。'
  },
  legacy_auction_court: {
    dungeonId: 'legacy_auction_court',
    name: '流拍追索者',
    spawnNodeId: 'inheritance_mimic_alpha',
    containmentNodeId: 'dead_team_testimony_stage',
    materialId: 'legacy_scrip',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '流拍追索者循着亡队遗产的未结报价逼近，把每个离席者重新登记为竞买人。',
    fusionDescription: '追索者将流拍名录并入拍卖主审，使首领从每笔未决出价中抽取额外强度。'
  },
  genesis_vault: {
    dungeonId: 'genesis_vault',
    name: '失控原型',
    spawnNodeId: 'gene_stalker_alpha',
    containmentNodeId: 'genome_repair_station',
    materialId: 'genesis_serum',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '失控原型从首代猎犬的学习序列中脱离，沿探索者重复留下的生命选择持续改写自身。',
    fusionDescription: '失控原型并入典藏官的原始蓝本，使首领以本轮已暴露的每种选择重塑战斗形态。'
  },
  silent_broadcast_tower: {
    dungeonId: 'silent_broadcast_tower',
    name: '走音替身',
    spawnNodeId: 'dead_air_mimic',
    containmentNodeId: 'anechoic_chamber',
    materialId: 'silence_core',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '走音替身从死频拟声体脱落的人声中成形，沿每次重复行动修正自己的追猎音准。',
    fusionDescription: '替身把失真的全城声纹并入末频道播音主，使首领从每次走音中抽取额外强度。'
  },
  lost_shelter: {
    dungeonId: 'lost_shelter',
    name: '失联接管体',
    spawnNodeId: 'mimic_survivor',
    containmentNodeId: 'containment_bay',
    materialId: 'rescue_badge',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '失联接管体从拟声幸存者的错误回应中脱离，沿护送队每次点名持续逼近真实生命信号。',
    fusionDescription: '接管体把失联名单并入避难所总控，使首领从每个未封闭的身份编号中抽取额外强度。'
  },
  false_testimony_court: {
    dungeonId: 'false_testimony_court',
    name: '伪证执行官',
    spawnNodeId: 'hostile_witness',
    containmentNodeId: 'judgment_lock',
    materialId: 'truth_fragment',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '伪证执行官从敌意证人的矛盾口供中成形，沿每次重复回答追索可以被改写的新证人。',
    fusionDescription: '执行官把伪造证言并入终审判词，使伪证主审从每处未锁定的矛盾中抽取额外强度。'
  },
  combat_replay_stage: {
    dungeonId: 'combat_replay_stage',
    name: '删镜执行体',
    spawnNodeId: 'cue_stalker',
    containmentNodeId: 'final_cut_lock',
    materialId: 'combat_reel',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '删镜执行体从场记潜猎者记录的重复动作中成形，沿每段未封存镜头追索可以被删除的战痕。',
    fusionDescription: '执行体把废弃镜头并入终剪母带，使终剪导演从每处未锁定的战痕中抽取额外强度。'
  },
  panopticon_city: {
    dungeonId: 'panopticon_city',
    name: '盲区巡猎体',
    spawnNodeId: 'exposure_double_patrol',
    containmentNodeId: 'all_sight_lock',
    materialId: 'observation_shard',
    rewardAmount: 1,
    contactDamagePercent: 15,
    bossFusionPercent: 15,
    spawnClearCount: 6,
    flavorDescription: '盲区巡猎体从曝光替身遗留的完整轮廓中成形，沿每次被天幕记录的动作持续逼近真实本体。',
    fusionDescription: '巡猎体把全部曝光轮廓并入全视监察官，使首领从每处未关闭的观测缝隙中抽取额外强度。'
  }
} as const satisfies Readonly<Record<RunPursuitDungeonId, RunPursuitDefinition>>;

export type RunPursuitState = {
  readonly rulesVersion: typeof RUN_PURSUIT_RULES_VERSION;
  readonly dungeonId: RunPursuitDungeonId;
  readonly status: RunPursuitStatus;
  readonly nodeId: string | null;
  readonly contacts: number;
  readonly graceMoves: 0 | 1;
  readonly rewardGranted: boolean;
  readonly repelledReason: RunPursuitRepelledReason | null;
};

export type RunPursuitNode = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
};

export type RunPursuitBlockedDirectedEdge = {
  readonly fromNodeId: string;
  readonly toNodeId: string;
};

export type AdvanceRunPursuitInput = {
  readonly nodes: readonly RunPursuitNode[];
  readonly blockedEdges: readonly RunPursuitBlockedDirectedEdge[];
  readonly playerNodeId: string;
  readonly containmentReady: boolean;
};

export type AdvanceRunPursuitResult = {
  readonly state: RunPursuitState;
  readonly contact: boolean;
  readonly moved: boolean;
  readonly from: string | null;
  readonly to: string | null;
  readonly contained: boolean;
  readonly rewardGranted: boolean;
};

export type RunPursuitProgress = {
  readonly status: RunPursuitStatus;
  readonly active: boolean;
  readonly currentNodeId: string | null;
  readonly contacts: number;
  readonly graceMoves: 0 | 1;
  readonly rewardGranted: boolean;
  readonly repelledReason: RunPursuitRepelledReason | null;
  readonly clearedNodeCount: number;
  readonly spawnClearCount: number;
  readonly clearsRemaining: number;
};

export type RunPursuitDisplay = {
  readonly dungeonId: RunPursuitDungeonId;
  readonly name: string;
  readonly status: RunPursuitStatus;
  readonly statusLabel: string;
  readonly statusDescription: string;
  readonly flavorDescription: string;
  readonly fusionDescription: string;
  readonly materialId: RunPursuitMaterialId;
  readonly rewardAmount: number;
  readonly contactDamagePercent: number;
  readonly bossFusionPercent: number;
  readonly progress: RunPursuitProgress;
};

type RunPursuitTopology = {
  readonly nodeById: ReadonlyMap<string, RunPursuitNode>;
  readonly blockedEdgeKeys: ReadonlySet<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isRunPursuitDungeonId(value: unknown): value is RunPursuitDungeonId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RUN_PURSUIT_CATALOG, value);
}

function isRunPursuitStatus(value: unknown): value is RunPursuitStatus {
  return typeof value === 'string' && (RUN_PURSUIT_STATUSES as readonly string[]).includes(value);
}

function isRunPursuitRepelledReason(value: unknown): value is RunPursuitRepelledReason {
  return typeof value === 'string' && (RUN_PURSUIT_REPELLED_REASONS as readonly string[]).includes(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isKnownNodeId(
  nodeId: string,
  definition: RunPursuitDefinition,
  knownNodeIds: readonly string[] | undefined
): boolean {
  const candidates = knownNodeIds ?? [definition.spawnNodeId, definition.containmentNodeId];
  return candidates.every((candidate) => typeof candidate === 'string' && candidate.length > 0) && candidates.includes(nodeId);
}

function edgeKey(fromNodeId: string, toNodeId: string): string {
  return `${fromNodeId}\u0000${toNodeId}`;
}

function isManhattanAdjacent(source: RunPursuitNode, target: RunPursuitNode): boolean {
  return Math.abs(source.x - target.x) + Math.abs(source.y - target.y) === 1;
}

function compareNodeIds(left: RunPursuitNode, right: RunPursuitNode): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function createTopology(input: AdvanceRunPursuitInput): RunPursuitTopology | undefined {
  if (!Array.isArray(input.nodes) || !Array.isArray(input.blockedEdges) || typeof input.containmentReady !== 'boolean') {
    return undefined;
  }

  const nodeById = new Map<string, RunPursuitNode>();
  const occupiedCells = new Set<string>();
  for (const node of input.nodes) {
    if (
      typeof node !== 'object' ||
      node === null ||
      Array.isArray(node) ||
      typeof node.id !== 'string' ||
      node.id.length === 0 ||
      !Number.isSafeInteger(node.x) ||
      !Number.isSafeInteger(node.y) ||
      nodeById.has(node.id)
    ) {
      return undefined;
    }

    const cell = `${node.x},${node.y}`;
    if (occupiedCells.has(cell)) return undefined;
    occupiedCells.add(cell);
    nodeById.set(node.id, node);
  }

  if (typeof input.playerNodeId !== 'string' || !nodeById.has(input.playerNodeId)) return undefined;

  const blockedEdgeKeys = new Set<string>();
  for (const edge of input.blockedEdges) {
    if (
      typeof edge !== 'object' ||
      edge === null ||
      Array.isArray(edge) ||
      typeof edge.fromNodeId !== 'string' ||
      typeof edge.toNodeId !== 'string'
    ) {
      return undefined;
    }
    const source = nodeById.get(edge.fromNodeId);
    const target = nodeById.get(edge.toNodeId);
    if (!source || !target || !isManhattanAdjacent(source, target)) return undefined;
    blockedEdgeKeys.add(edgeKey(source.id, target.id));
  }

  return { nodeById, blockedEdgeKeys };
}

function findShortestPathNextStep(
  topology: RunPursuitTopology,
  startNodeId: string,
  targetNodeId: string
): string | undefined {
  if (startNodeId === targetNodeId) return undefined;

  const start = topology.nodeById.get(startNodeId);
  if (!start || !topology.nodeById.has(targetNodeId)) return undefined;

  const visited = new Set([startNodeId]);
  const firstStepByNodeId = new Map<string, string>();
  const queue = [startNodeId];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const currentNodeId = queue[cursor];
    const current = topology.nodeById.get(currentNodeId);
    if (!current) continue;

    const neighbors = [...topology.nodeById.values()]
      .filter(
        (candidate) =>
          !visited.has(candidate.id) &&
          isManhattanAdjacent(current, candidate) &&
          !topology.blockedEdgeKeys.has(edgeKey(current.id, candidate.id))
      )
      .sort(compareNodeIds);

    for (const neighbor of neighbors) {
      visited.add(neighbor.id);
      const firstStep = current.id === start.id ? neighbor.id : firstStepByNodeId.get(current.id);
      if (!firstStep) continue;

      firstStepByNodeId.set(neighbor.id, firstStep);
      if (neighbor.id === targetNodeId) return firstStep;
      queue.push(neighbor.id);
    }
  }

  return undefined;
}

function createNoAdvanceResult(state: RunPursuitState): AdvanceRunPursuitResult {
  return {
    state,
    contact: false,
    moved: false,
    from: state.nodeId,
    to: state.nodeId,
    contained: false,
    rewardGranted: false
  };
}

function normalizeClearedNodeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

export function getRunPursuitDefinition(dungeonId: string): RunPursuitDefinition | undefined {
  return isRunPursuitDungeonId(dungeonId) ? RUN_PURSUIT_CATALOG[dungeonId] : undefined;
}

export function createRunPursuitState(
  dungeonId: RunPursuitDungeonId,
  replayEnabled: boolean
): RunPursuitState {
  if (!isRunPursuitDungeonId(dungeonId)) throw new RangeError(`Unknown pursuit dungeon: ${String(dungeonId)}`);

  return {
    rulesVersion: RUN_PURSUIT_RULES_VERSION,
    dungeonId,
    status: replayEnabled ? 'dormant' : 'disabled',
    nodeId: null,
    contacts: 0,
    graceMoves: 0,
    rewardGranted: false,
    repelledReason: null
  };
}

export function normalizeRunPursuitState(
  value: unknown,
  knownNodeIds?: readonly string[]
): RunPursuitState | undefined {
  if (!isRecord(value) || !hasExactKeys(value, RUN_PURSUIT_STATE_KEYS)) return undefined;
  if (
    value.rulesVersion !== RUN_PURSUIT_RULES_VERSION ||
    !isRunPursuitDungeonId(value.dungeonId) ||
    !isRunPursuitStatus(value.status) ||
    (value.nodeId !== null && (typeof value.nodeId !== 'string' || value.nodeId.length === 0)) ||
    !isSafeNonNegativeInteger(value.contacts) ||
    (value.graceMoves !== 0 && value.graceMoves !== 1) ||
    typeof value.rewardGranted !== 'boolean' ||
    (value.repelledReason !== null && !isRunPursuitRepelledReason(value.repelledReason))
  ) {
    return undefined;
  }

  const definition = RUN_PURSUIT_CATALOG[value.dungeonId];
  const nodeIsKnown =
    typeof value.nodeId === 'string' && isKnownNodeId(value.nodeId, definition, knownNodeIds);

  switch (value.status) {
    case 'disabled':
    case 'dormant':
      if (
        value.nodeId !== null ||
        value.contacts !== 0 ||
        value.graceMoves !== 0 ||
        value.rewardGranted ||
        value.repelledReason !== null
      ) {
        return undefined;
      }
      break;
    case 'stalking':
      if (!nodeIsKnown || value.rewardGranted || value.repelledReason !== null) return undefined;
      break;
    case 'contained':
      if (
        !nodeIsKnown ||
        value.nodeId !== definition.containmentNodeId ||
        value.graceMoves !== 0 ||
        !value.rewardGranted ||
        value.repelledReason !== null
      ) {
        return undefined;
      }
      break;
    case 'fused':
      if (
        value.nodeId !== null ||
        value.graceMoves !== 0 ||
        value.rewardGranted ||
        value.repelledReason !== null
      ) {
        return undefined;
      }
      break;
    case 'repelled':
      if (
        value.nodeId !== null ||
        value.graceMoves !== 0 ||
        value.rewardGranted ||
        value.repelledReason === null
      ) {
        return undefined;
      }
      break;
  }

  return {
    rulesVersion: RUN_PURSUIT_RULES_VERSION,
    dungeonId: value.dungeonId,
    status: value.status,
    nodeId: value.nodeId,
    contacts: value.contacts,
    graceMoves: value.graceMoves,
    rewardGranted: value.rewardGranted,
    repelledReason: value.repelledReason
  };
}

export function isRunPursuitState(
  value: unknown,
  knownNodeIds?: readonly string[]
): value is RunPursuitState {
  return normalizeRunPursuitState(value, knownNodeIds) !== undefined;
}

export function activateRunPursuit(
  state: RunPursuitState,
  clearedNodeCount: number
): RunPursuitState {
  if (
    state.status !== 'dormant' ||
    !Number.isSafeInteger(clearedNodeCount) ||
    clearedNodeCount < RUN_PURSUIT_SPAWN_CLEAR_COUNT
  ) {
    return state;
  }

  return {
    ...state,
    status: 'stalking',
    nodeId: RUN_PURSUIT_CATALOG[state.dungeonId].spawnNodeId
  };
}

export function advanceRunPursuit(
  state: RunPursuitState,
  input: AdvanceRunPursuitInput
): AdvanceRunPursuitResult {
  if (state.status !== 'stalking' || state.nodeId === null) return createNoAdvanceResult(state);

  const topology = createTopology(input);
  const definition = RUN_PURSUIT_CATALOG[state.dungeonId];
  if (
    !topology ||
    !topology.nodeById.has(state.nodeId) ||
    !topology.nodeById.has(definition.spawnNodeId)
  ) {
    return createNoAdvanceResult(state);
  }

  if (state.graceMoves === 1) {
    return {
      ...createNoAdvanceResult(state),
      state: { ...state, graceMoves: 0 }
    };
  }

  const nextNodeId = findShortestPathNextStep(topology, state.nodeId, input.playerNodeId);
  if (!nextNodeId) return createNoAdvanceResult(state);

  const from = state.nodeId;
  if (input.containmentReady && nextNodeId === definition.containmentNodeId) {
    return {
      state: {
        ...state,
        status: 'contained',
        nodeId: definition.containmentNodeId,
        graceMoves: 0,
        rewardGranted: true
      },
      contact: false,
      moved: true,
      from,
      to: nextNodeId,
      contained: true,
      rewardGranted: true
    };
  }

  if (nextNodeId === input.playerNodeId) {
    return {
      state: {
        ...state,
        nodeId: definition.spawnNodeId,
        contacts: Math.min(Number.MAX_SAFE_INTEGER, state.contacts + 1),
        graceMoves: 1
      },
      contact: true,
      moved: true,
      from,
      to: nextNodeId,
      contained: false,
      rewardGranted: false
    };
  }

  return {
    state: { ...state, nodeId: nextNodeId },
    contact: false,
    moved: true,
    from,
    to: nextNodeId,
    contained: false,
    rewardGranted: false
  };
}

export function fuseRunPursuitAtBoss(state: RunPursuitState): RunPursuitState {
  if (state.status !== 'stalking') return state;

  return {
    ...state,
    status: 'fused',
    nodeId: null,
    graceMoves: 0
  };
}

export function getRunPursuitBossFusionPercent(state: RunPursuitState | undefined): number {
  return state?.status === 'fused' ? RUN_PURSUIT_BOSS_FUSION_PERCENT : 0;
}

export function repelRunPursuitAtStablePortal(state: RunPursuitState): RunPursuitState {
  if (state.status !== 'stalking' && state.status !== 'dormant') return state;

  return {
    ...state,
    status: 'repelled',
    nodeId: null,
    graceMoves: 0,
    repelledReason: 'stable_portal'
  };
}

export function carryRunPursuitThroughForcedPortal(
  state: RunPursuitState,
  targetDungeonId: RunPursuitDungeonId
): RunPursuitState {
  const target = getRunPursuitDefinition(targetDungeonId);
  if (state.status !== 'stalking' || !target) return state;

  return {
    ...state,
    dungeonId: target.dungeonId,
    nodeId: target.spawnNodeId,
    graceMoves: 1,
    repelledReason: null
  };
}

export function settleRunPursuit(
  state: RunPursuitState,
  reason: RunPursuitSettlementReason
): RunPursuitState {
  if (!RUN_PURSUIT_REPELLED_REASONS.includes(reason)) return state;
  if (state.status !== 'stalking' && state.status !== 'dormant') return state;

  return {
    ...state,
    status: 'repelled',
    nodeId: null,
    graceMoves: 0,
    repelledReason: reason
  };
}

export function getRunPursuitContactDamage(maxHp: number, tier: number): number {
  const safeMaxHp = Number.isFinite(maxHp) && maxHp > 0 ? Math.min(Number.MAX_SAFE_INTEGER, maxHp) : 0;
  const safeTier = Number.isFinite(tier)
    ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(tier)))
    : 1;
  const scaledHpDamage = Math.floor((safeMaxHp * 15) / 100);
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, scaledHpDamage + safeTier));
}

export function getRunPursuitProgress(
  state: RunPursuitState,
  clearedNodeCount = 0
): RunPursuitProgress {
  const safeClearedNodeCount = normalizeClearedNodeCount(clearedNodeCount);
  const spawnClearCount = RUN_PURSUIT_CATALOG[state.dungeonId].spawnClearCount;

  return {
    status: state.status,
    active: state.status === 'stalking',
    currentNodeId: state.nodeId,
    contacts: state.contacts,
    graceMoves: state.graceMoves,
    rewardGranted: state.rewardGranted,
    repelledReason: state.repelledReason,
    clearedNodeCount: safeClearedNodeCount,
    spawnClearCount,
    clearsRemaining: Math.max(0, spawnClearCount - safeClearedNodeCount)
  };
}

export function getRunPursuitDisplay(
  state: RunPursuitState,
  clearedNodeCount = 0
): RunPursuitDisplay {
  const definition = RUN_PURSUIT_CATALOG[state.dungeonId];
  const statusCopy: Record<RunPursuitStatus, { readonly label: string; readonly description: string }> = {
    disabled: { label: '未启用', description: '本次首通不会出现破界追兵。' },
    dormant: { label: '潜伏', description: '追兵尚未被轮回侵蚀唤醒。' },
    stalking: { label: '追猎', description: '追兵正沿当前副本网格逼近。' },
    contained: { label: '已收容', description: '追兵已被本章收容节点封存。' },
    fused: { label: '已融合', description: '追兵已与本章首领融合。' },
    repelled: { label: '已驱离', description: '追兵已离开本次行动。' }
  };

  return {
    dungeonId: state.dungeonId,
    name: definition.name,
    status: state.status,
    statusLabel: statusCopy[state.status].label,
    statusDescription: statusCopy[state.status].description,
    flavorDescription: definition.flavorDescription,
    fusionDescription: definition.fusionDescription,
    materialId: definition.materialId,
    rewardAmount: definition.rewardAmount,
    contactDamagePercent: definition.contactDamagePercent,
    bossFusionPercent: definition.bossFusionPercent,
    progress: getRunPursuitProgress(state, clearedNodeCount)
  };
}
