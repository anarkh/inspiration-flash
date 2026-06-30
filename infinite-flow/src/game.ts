export type Phase = 'hub' | 'dungeon' | 'result';
export type DungeonId = 'demon_tower_1';
export type ItemId = 'thunder_talisman' | 'healing_pill' | 'demon_bone' | 'hidden_stone';
export type MethodId = 'breathing_method';
export type EquipmentId = 'armor_piercing_sword';
export type OutcomeTone = 'failure' | 'success' | 'discovery';

export type PlayerStats = {
  body: number;
  spirit: number;
  luck: number;
};

export type DungeonChoice = {
  id: 'force_through' | 'use_thunder_talisman' | 'steady_breathing';
  label: string;
  requirement?: string;
  preview: string;
};

export type Outcome = {
  title: string;
  body: string;
  tone: OutcomeTone;
  rewardPointsDelta: number;
};

export type GameState = {
  phase: Phase;
  rewardPoints: number;
  essence: number;
  inventory: ItemId[];
  learnedMethods: MethodId[];
  equipment: EquipmentId[];
  stats: PlayerStats;
  currentDungeon?: DungeonId;
  lastOutcome?: Outcome;
  log: string[];
};

const ITEM_COSTS: Record<Extract<ItemId, 'thunder_talisman' | 'healing_pill'>, number> = {
  thunder_talisman: 400,
  healing_pill: 180
};

const METHOD_COSTS: Record<MethodId, number> = {
  breathing_method: 300
};

function appendLog(state: GameState, line: string): GameState {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 8)
  };
}

function hasItem(state: GameState, item: ItemId): boolean {
  return state.inventory.includes(item);
}

function hasMethod(state: GameState, method: MethodId): boolean {
  return state.learnedMethods.includes(method);
}

export function createInitialState(): GameState {
  return {
    phase: 'hub',
    rewardPoints: 850,
    essence: 0,
    inventory: [],
    learnedMethods: [],
    equipment: [],
    stats: {
      body: 3,
      spirit: 2,
      luck: 1
    },
    log: ['白光散去，你站在主神空间。主神提示：下一场试炼将在三分钟后开启。']
  };
}

export function buyItem(state: GameState, item: Extract<ItemId, 'thunder_talisman' | 'healing_pill'>): GameState {
  const cost = ITEM_COSTS[item];

  if (state.rewardPoints < cost) {
    return appendLog(state, `奖励点不足，无法兑换${item === 'thunder_talisman' ? '雷火符' : '止血丹'}。`);
  }

  const itemLabel = item === 'thunder_talisman' ? '雷火符' : '止血丹';

  return appendLog(
    {
      ...state,
      rewardPoints: state.rewardPoints - cost,
      inventory: [...state.inventory, item]
    },
    `主神扣除 ${cost} 点，${itemLabel}落入你的掌心。`
  );
}

export function learnMethod(state: GameState, method: MethodId): GameState {
  if (hasMethod(state, method)) {
    return appendLog(state, '你已经学会吐纳诀，重复学习没有收益。');
  }

  const cost = METHOD_COSTS[method];

  if (state.rewardPoints < cost) {
    return appendLog(state, '奖励点不足，无法学习吐纳诀。');
  }

  return appendLog(
    {
      ...state,
      rewardPoints: state.rewardPoints - cost,
      learnedMethods: [...state.learnedMethods, method],
      stats: {
        ...state.stats,
        spirit: state.stats.spirit + 1
      }
    },
    '吐纳诀灌入识海。你终于能在妖雾里稳住心神。'
  );
}

export function enterDungeon(state: GameState, dungeon: DungeonId): GameState {
  return appendLog(
    {
      ...state,
      phase: 'dungeon',
      currentDungeon: dungeon,
      lastOutcome: undefined
    },
    '副本开启：妖塔一层。雾中传来刮骨般的低笑。'
  );
}

export function getAvailableDungeonChoices(state: GameState): DungeonChoice[] {
  const choices: DungeonChoice[] = [
    {
      id: 'force_through',
      label: '硬闯妖雾',
      preview: '无需求。高风险，可能只能带伤撤离。'
    }
  ];

  if (hasItem(state, 'thunder_talisman')) {
    choices.push({
      id: 'use_thunder_talisman',
      label: '使用雷火符破雾',
      requirement: '需要雷火符',
      preview: '消耗雷火符，安全破开妖雾并取得妖骨。'
    });
  }

  if (hasMethod(state, 'breathing_method')) {
    choices.push({
      id: 'steady_breathing',
      label: '运转吐纳诀稳住心神',
      requirement: '需要吐纳诀',
      preview: '不消耗道具，发现雾后的隐藏石门。'
    });
  }

  return choices;
}

export function resolveDungeonChoice(state: GameState, choiceId: DungeonChoice['id']): GameState {
  if (state.phase !== 'dungeon') {
    return appendLog(state, '你还没有进入副本。');
  }

  if (choiceId === 'use_thunder_talisman' && !hasItem(state, 'thunder_talisman')) {
    return appendLog(state, '你没有雷火符，无法选择这条路线。');
  }

  if (choiceId === 'steady_breathing' && !hasMethod(state, 'breathing_method')) {
    return appendLog(state, '你还没学会吐纳诀，无法在妖雾里稳住心神。');
  }

  if (choiceId === 'force_through') {
    const outcome: Outcome = {
      title: '重伤撤离',
      body: '你硬闯妖雾，被雾中妖鬼撕开肩背。主神把你拖回白光里，只给了最低生还奖励。',
      tone: 'failure',
      rewardPointsDelta: 80
    };

    return appendLog(
      {
        ...state,
        phase: 'result',
        rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
        lastOutcome: outcome
      },
      '副本失败，但你活着回到了主神空间。'
    );
  }

  if (choiceId === 'use_thunder_talisman') {
    const outcome: Outcome = {
      title: '雷火破雾',
      body: '雷火符炸开雾墙，妖鬼现形。你趁它哀嚎时斩下妖骨，第一次真正赢下副本事件。',
      tone: 'success',
      rewardPointsDelta: 280
    };

    return appendLog(
      {
        ...state,
        phase: 'result',
        rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
        inventory: [...state.inventory.filter((inventoryItem) => inventoryItem !== 'thunder_talisman'), 'demon_bone'],
        lastOutcome: outcome
      },
      '兑换改变了命运：雷火符让同一个事件出现了胜利结算。'
    );
  }

  const outcome: Outcome = {
    title: '雾后石门',
    body: '你按吐纳诀压住心跳，发现妖雾并不是墙，而是遮掩石门的阵法。',
    tone: 'discovery',
    rewardPointsDelta: 160
  };

  return appendLog(
    {
      ...state,
      phase: 'result',
      rewardPoints: state.rewardPoints + outcome.rewardPointsDelta,
      inventory: [...state.inventory, 'hidden_stone'],
      lastOutcome: outcome
    },
    '功法改变了观察方式：你找到一条隐藏路线。'
  );
}

export function returnToHub(state: GameState): GameState {
  return appendLog(
    {
      ...state,
      phase: 'hub',
      currentDungeon: undefined
    },
    '你回到主神空间。兑换列表冷冷亮起。'
  );
}
