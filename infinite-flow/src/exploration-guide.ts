import {
  DUNGEONS,
  getBossSealStatus,
  getCurrentLegalAdjacentTargetIds,
  getNodeDepartureBlock,
  type DungeonNode,
  type GameState,
  type NodeDepartureBlockKind
} from './game';

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

function getNodeActionId(node: DungeonNode): string {
  if (node.type === 'monster') return `fight-current-${node.id}`;
  if (node.type === 'trap') return `trap-risk-${node.id}`;
  if (node.type === 'portal') return `portal-force-${node.id}`;
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
  const unclearedTargetId = legalTargetIds.find(
    (nodeId) => !state.run?.clearedNodeIds.includes(nodeId)
  );
  const targetId = unclearedTargetId ?? legalTargetIds[0];

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
    instruction: unclearedTargetId ? '探索相邻未知区域' : '沿已探索路线继续推进',
    detail: unclearedTargetId
      ? `地图上有 ${legalTargetIds.filter((nodeId) => !state.run?.clearedNodeIds.includes(nodeId)).length} 个可探索方向。`
      : '当前邻接区域均已揭示。',
    targetActionId: `grid-${targetId}`
  };
}

export function getExplorationGuide(state: GameState): ExplorationGuide | undefined {
  if (!state.run || state.phase === 'hub' || state.phase === 'result') return undefined;

  if (state.phase === 'combat') {
    return {
      kind: 'combat',
      tone: 'urgent',
      eyebrow: '战斗指令',
      instruction: '选择本回合行动',
      detail: '观察敌方意图，再决定攻击、功法、防御或使用道具。',
      targetActionId: 'combat-attack'
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
      targetActionId: getNodeActionId(node)
    };
  }

  return getMovementGuide(state);
}
