import {
  DUNGEONS,
  getCombatActionDamagePreview,
  getBossSealStatus,
  getCampaignGates,
  getCurrentLegalAdjacentTargetIds,
  getCurrentDungeonLaw,
  getNodeDepartureBlock,
  getReadyCombatCapturePetId,
  isCurrentDungeonFeatureAvailable,
  isTacticalItemAvailable,
  type DungeonNode,
  type GameState,
  type NodeDepartureBlockKind
} from './game';
import { DUNGEON_LAW_LANDMARKS } from './dungeon-laws';
import { isTacticalItemId } from './tactical-loadout';

export type ExplorationGuideKind = 'combat' | 'blocker' | 'node' | 'move';
export type ExplorationGuideTone = 'urgent' | 'direct' | 'hint';

export type ExplorationGuide = {
  readonly kind: ExplorationGuideKind;
  readonly tone: ExplorationGuideTone;
  readonly eyebrow: string;
  readonly instruction: string;
  readonly detail?: string;
  readonly targetActionId?: string;
};

const blockerInstructions: Partial<Record<NodeDepartureBlockKind, string>> = {
  soul_recharge_pending: '完成或取消器魂共鸣',
  equipment_offer: '选择一件精英装备，或放弃本次掉落',
  relic_draft: '选择当前回响遗物',
  causal_ledger: '完成因果账本结算',
  entropy_heading: '指定方舟航向',
  mirror_phase: '选择镜城相位',
  redaction_clause: '裁定终稿条款',
  auction_lot: '处理当前遗产拍品',
  genesis_splice: '完成原型拼接',
  broadcast_relay: '调谐广播中继',
  escort_checkpoint: '处理护送检查点',
  false_testimony_verdict: '完成当前裁决',
  panopticon_route: '选择监察潜入路线'
};

const nodeInstructions: Record<DungeonNode['type'], string> = {
  monster: '迎战当前怪物',
  trap: '处理当前陷阱',
  portal: '选择传送方式',
  reward: '收取当前节点奖励',
  exit: '完成副本结算'
};

function getLockedPortalRequirement(state: GameState, node: DungeonNode): string | undefined {
  if (node.type !== 'portal' || !node.portal) return undefined;
  const targetGate = getCampaignGates(state).find(
    (gate) => gate.dungeonId === node.portal?.targetDungeonId
  );
  return targetGate?.status === 'locked' ? targetGate.requirementText : undefined;
}

function getNodeActionId(state: GameState, node: DungeonNode): string {
  if (node.type === 'monster') return `fight-current-${node.id}`;
  if (node.type === 'trap') {
    const counterItem = node.trap?.counterItem;
    return counterItem && isTacticalItemId(counterItem) && isTacticalItemAvailable(state, counterItem)
      ? `trap-counter-${node.id}`
      : `trap-risk-${node.id}`;
  }
  if (node.type === 'portal') {
    const stableItem = node.portal?.stableItem;
    return stableItem && isTacticalItemId(stableItem) && isTacticalItemAvailable(state, stableItem)
      ? `portal-stabilize-${node.id}`
      : `portal-force-${node.id}`;
  }
  if (node.type === 'reward') return `reward-current-${node.id}`;
  return `exit-current-${node.id}`;
}

function getMovementGuide(state: GameState): ExplorationGuide {
  if (!state.run) {
    return {
      kind: 'move',
      tone: 'hint',
      eyebrow: '路线指引',
      instruction: '当前没有可通行的相邻区域'
    };
  }

  const legalTargetIds = getCurrentLegalAdjacentTargetIds(state);
  const dungeon = DUNGEONS[state.run.dungeonId];
  const bossSeal = getBossSealStatus(state, state.run.dungeonId);
  const isProgressTarget = (nodeId: string): boolean => {
    if (state.run?.clearedNodeIds.includes(nodeId)) return false;
    const node = dungeon.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || getLockedPortalRequirement(state, node)) return false;
    return node.type !== 'exit' || bossSeal?.cleared !== false;
  };
  const unclearedTargetId = legalTargetIds.find(isProgressTarget);
  const firstStepTowardProgress = (() => {
    if (unclearedTargetId) return unclearedTargetId;
    const visited = new Set([state.run!.currentNodeId]);
    const queue = legalTargetIds.map((nodeId) => ({ nodeId, firstStep: nodeId }));
    while (queue.length) {
      const next = queue.shift()!;
      if (visited.has(next.nodeId)) continue;
      visited.add(next.nodeId);
      if (isProgressTarget(next.nodeId)) return next.firstStep;
      const simulated: GameState = {
        ...state,
        run: { ...state.run!, currentNodeId: next.nodeId }
      };
      for (const targetNodeId of getCurrentLegalAdjacentTargetIds(simulated)) {
        if (!visited.has(targetNodeId)) {
          queue.push({ nodeId: targetNodeId, firstStep: next.firstStep });
        }
      }
    }
    return undefined;
  })();
  const currentLaw = getCurrentDungeonLaw(state)?.state;
  const fogRecoveryExhausted =
    currentLaw?.dungeonId === 'demon_tower_1' &&
    currentLaw.law.kind === 'demon_tower' &&
    currentLaw.law.fogPressure > 1 &&
    DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds.every((nodeId) =>
      currentLaw.clearedNodeIds.includes(nodeId)
    ) &&
    DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefEventIds.every((eventId) =>
      currentLaw.resolvedEventIds.includes(eventId)
    );

  if (!firstStepTowardProgress && fogRecoveryExhausted) {
    return {
      kind: 'blocker',
      tone: 'urgent',
      eyebrow: '雾压封路',
      instruction: '撤回主神空间保留本局收益',
      detail: '减压地标均已结算，本局无法再把雾压降到首领路线要求；整备成长后重新挑战。',
      targetActionId: 'abandon-run'
    };
  }

  const targetId = firstStepTowardProgress ?? legalTargetIds[0];

  if (!targetId) {
    return {
      kind: 'move',
      tone: 'hint',
      eyebrow: '路线指引',
      instruction: '当前没有可通行的相邻区域',
      detail: '检查附近门禁条件，或返回已探索路线寻找其他入口。'
    };
  }

  return {
    kind: 'move',
    tone: 'hint',
    eyebrow: unclearedTargetId ? '探索指引' : '路线指引',
    instruction: unclearedTargetId ? '选择相邻可探索区域' : '沿已探索路线继续推进',
    detail: unclearedTargetId
      ? `地图上有 ${legalTargetIds.filter((nodeId) => !state.run?.clearedNodeIds.includes(nodeId)).length} 个可探索方向。`
      : firstStepTowardProgress
        ? '当前邻接区域均已揭示；定位将沿已探索路线前往尚未处理的节点。'
        : '当前邻接区域均已揭示。',
    targetActionId: `grid-${targetId}`
  };
}

export function getExplorationGuide(state: GameState): ExplorationGuide | undefined {
  if (!state.run || state.phase === 'hub' || state.phase === 'result') return undefined;

  if (state.phase === 'combat') {
    const readyCapturePetId = getReadyCombatCapturePetId(state);
    if (readyCapturePetId) {
      return {
        kind: 'combat',
        tone: 'urgent',
        eyebrow: '捕获时机',
        instruction: '捕获当前虚弱目标',
        detail: '继续攻击会击倒目标并关闭本次捕获窗口。',
        targetActionId: `capture-${readyCapturePetId}`
      };
    }
    const attackPreview = getCombatActionDamagePreview(state, 'attack');
    const artPreview = isCurrentDungeonFeatureAvailable(state, 'method')
      ? getCombatActionDamagePreview(state, 'art')
      : undefined;
    const safeTargetActionId =
      attackPreview && !attackPreview.playerWillFall
        ? 'combat-attack'
        : artPreview && !artPreview.playerWillFall
          ? 'combat-art'
          : isTacticalItemAvailable(state, 'healing_pill')
            ? 'combat-use_healing_pill'
            : 'combat-guard';
    const survivalWarning = attackPreview?.playerWillFall || artPreview?.playerWillFall;
    return {
      kind: 'combat',
      tone: 'urgent',
      eyebrow: '战斗指令',
      instruction: survivalWarning ? '优先选择可存活的本回合行动' : '选择本回合行动',
      detail: survivalWarning
        ? '带有“行动后将濒死”的动作会触发强制回收；定位已优先指向当前可存活选项。'
        : '观察敌方意图，再决定攻击、功法、防御或使用道具。',
      targetActionId: safeTargetActionId
    };
  }

  const dungeon = DUNGEONS[state.run.dungeonId];
  const node = dungeon.nodes.find((candidate) => candidate.id === state.run?.currentNodeId);
  if (!node) return undefined;

  const blocker = getNodeDepartureBlock(state);
  if (blocker && blocker.kind !== 'uncleared_monster' && blocker.kind !== 'uncleared_trap') {
    return {
      kind: 'blocker',
      tone: 'urgent',
      eyebrow: '待处理',
      instruction: blockerInstructions[blocker.kind] ?? '处理当前节点的未决事项',
      detail: blocker.message
    };
  }

  const cleared = state.run.clearedNodeIds.includes(node.id);
  if (!cleared) {
    const lockedPortalRequirement = getLockedPortalRequirement(state, node);
    if (lockedPortalRequirement) {
      const movementGuide = getMovementGuide(state);
      return {
        ...movementGuide,
        eyebrow: '传送门封闭',
        instruction: '继续探索当前副本',
        detail: `传送目标尚未开放：${lockedPortalRequirement}`
      };
    }
    if (node.type === 'exit') {
      const bossSeal = getBossSealStatus(state, state.run.dungeonId);
      if (bossSeal && !bossSeal.cleared) {
        const movementGuide = getMovementGuide(state);
        return {
          ...movementGuide,
          eyebrow: '出口封印',
          instruction: `先击败${bossSeal.definition.bossTitle}`,
          detail: bossSeal.requirementText
        };
      }
    }

    return {
      kind: 'node',
      tone: node.type === 'monster' || node.type === 'trap' ? 'urgent' : 'direct',
      eyebrow: '当前节点',
      instruction: nodeInstructions[node.type],
      detail: node.title,
      targetActionId: getNodeActionId(state, node)
    };
  }

  return getMovementGuide(state);
}
