/** Standalone interaction prototype. Every state lives in this closure, never in game storage. */
import {
  BLOODLINE_CATALOG, COMPANION_CATALOG, DUNGEONS, DUNGEON_ORDER, EQUIPMENT, ITEMS,
  METHODS, METHOD_TECHNIQUE_CATALOG, PETS, createInitialState, getDerivedStats,
  getGameAsset, getPlayerPower, getTacticalLoadoutStatus, getEquipmentTemperStatus,
  type Cost, type GameState, type ItemId, type EquipmentId, type GameAssetKind
} from '@infinite-flow/core';
import { MAIN_GOD_TASKS, evaluateTask } from '@infinite-flow/core/task-system';
import { TACTICAL_ITEM_IDS, TACTICAL_ITEM_CATEGORY_BY_ID, isFieldSupplyItemId } from '@infinite-flow/core/tactical-loadout';
import { getPetStatBonus } from '../../packages/core/src/pet-system';
import { getEquipmentAttunementOptions } from '@infinite-flow/core/equipment-system';
import { reduceGameCommand } from '@infinite-flow/application';
import {
  buildGameViewModel, type HubCatalogPanel, type ViewActionModel, type PresentationEvent,
  type EquipmentCommissionDraft, type HubDetailViewModel
} from '@infinite-flow/presentation';

type Panel = HubCatalogPanel;
type Detail = { label: string; value: string };
type Action = {
  id: string; label: string; enabled: boolean; reason?: string; description: string;
  costLabel?: string; dangerous?: boolean; selected?: boolean; event: PresentationEvent | null;
};
type Row = {
  id: string; name: string; category: string; icon?: string; description: string;
  summary: string; status: string; details: Detail[]; actions: Action[];
  rarity?: 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
};

// Match the existing Cocos backpack UI projection (InfiniteFlowInfoSheet.ts).
// This is display metadata, separate from randomized equipment-roll quality.
const POOR_EQUIPMENT = new Set([
  'training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves', 'patched_boots', 'patched_belt'
]);
const UNCOMMON_ITEMS = new Set(['gate_sigil', 'capture_net', 'spirit_bait']);
function equipmentRarity(id: EquipmentId): Row['rarity'] {
  if (POOR_EQUIPMENT.has(id)) return 'poor';
  const points = EQUIPMENT[id].cost.rewardPoints ?? 0;
  if (points <= 540) return 'common';
  if (points <= 1020) return 'uncommon';
  if (points <= 1460) return 'rare';
  if (points <= 1980) return 'epic';
  return 'legendary';
}

function asset(kind: GameAssetKind, id: string): string | undefined {
  const definition = getGameAsset(kind, id);
  return definition ? `../../cocos/assets/resources/${kind}/${definition.src.split('/').pop()}` : undefined;
}

export const panels = [
  { id: 'equipment', name: '军需官', title: '装备与强化', greeting: '先挑合适的装备，再决定如何强化。点装备看详情，操作就在它后面。', portrait: asset('npc', 'equipment_quartermaster') },
  { id: 'supplies', name: '补给商', title: '物资兑换', greeting: '挑选下次冒险需要的补给与道具，兑换后会放入背包。', portrait: asset('npc', 'supply_trader') },
  { id: 'pets', name: '灵宠师', title: '灵宠与培养', greeting: '在这里结识新的灵宠，也可以培养已有的伙伴，提升它们的能力。', portrait: asset('npc', 'pet_keeper') },
  { id: 'methods', name: '修行导师', title: '功法与战技', greeting: '学习功法获得被动收益，继续精研则能强化战技。', portrait: asset('npc', 'method_master') },
  { id: 'bloodlines', name: '血脉祭司', title: '血统与觉醒', greeting: '觉醒开启新的血统，晋升增强血统的属性与爆发能力。' },
  { id: 'companions', name: '同行引路人', title: '同伴与训练', greeting: '招募旅途中结识的伙伴，或通过训练增强他们的战斗援助。' },
  { id: 'tasks', name: '任务使者', title: '任务与奖励', greeting: '所有目标都列在这里。完成后手动领取，主线奖励还会开启下一章。', portrait: asset('npc', 'main_god_projection') }
] satisfies Array<{ id: Panel; name: string; title: string; greeting: string; portrait?: string }>;

const SLOT_LABELS = { weapon: '武器', head: '头部', armor: '护甲', hands: '护手', feet: '足部', waist: '腰部', charm: '护符' };
const STAT_LABELS: Record<string, string> = {
  body: '体魄', spirit: '灵力', agility: '身法', luck: '气运', maxHp: '生命上限',
  attack: '攻击', artPower: '术法', defense: '防御', speed: '速度', trapCheck: '陷阱检定'
};
const CATEGORY_LABELS = { combat: '战斗道具', ward: '防护道具', portal: '传送道具', capture: '捕获道具' };
const TASK_LABELS = { locked: '未解锁', active: '进行中', completed: '可领取', claimed: '已领取' };
const EFFECT_LABELS: Record<string, string> = {
  guarding: '获得防御', clearsRustPoison: '清除锈毒', clearsMirrorSlow: '清除镜面迟缓',
  focusGain: '战意', breathGain: '真气', healPercent: '恢复生命', forceDamage: '物理伤害',
  artDamage: '术法伤害', barrier: '护盾'
};

function statsReadout(stats: Record<string, number | undefined>): string {
  return Object.entries(stats).filter(([, value]) => value !== undefined && value !== 0)
    .map(([key, value]) => `${STAT_LABELS[key] ?? key} ${value! > 0 ? '+' : ''}${value}`).join(' · ') || '无额外属性';
}

function effectReadout(effect: Record<string, number | boolean>): string {
  return Object.entries(effect).filter(([, value]) => Boolean(value)).map(([key, value]) =>
    typeof value === 'boolean' ? EFFECT_LABELS[key] ?? key : `${EFFECT_LABELS[key] ?? key} ${value}${key === 'healPercent' ? '%' : ''}`
  ).join(' · ') || '暂无额外效果';
}

function costReadout(cost: Cost): string {
  return [
    cost.rewardPoints ? `${cost.rewardPoints} 奖励点` : '',
    cost.lingyun ? `${cost.lingyun} 灵蕴` : '',
    ...Object.entries(cost.items ?? {}).map(([id, count]) => `${ITEMS[id as ItemId].name} ×${count}`)
  ].filter(Boolean).join(' · ') || '免费';
}

function mapAction(action: ViewActionModel): Action {
  // This prototype keeps NPC services separate from the player's loadout controls.
  const description = (action.readout ?? action.disabledReason ?? '确认后执行此操作。')
    .replace(/还需点击「装备」(?:才生效)?。/g, '购入后可在装备界面穿戴。')
    .replace(/带入副本前还需装入携行。/g, '购入后可在背包中配置携行。')
    .replace(/签约后可手动设为出战灵宠。/g, '')
    .replace(/拥有后可培养，并设为出战灵宠。/g, '拥有后可继续培养。')
    .replace(/解锁血统后可晋升、激活；/g, '解锁血统后可继续晋升；')
    .replace(/觉醒后需手动激活。/g, '')
    .replace(/招募后需手动设为出战。/g, '')
    .replace(/加入后可训练，并设为出战同伴，/g, '加入后可继续训练，出战时');
  const costLabel = description.match(/消耗\s+[^。]+/)?.[0];
  return {
    id: action.actionId, label: action.label, enabled: action.enabled,
    ...(action.disabledReason ? { reason: action.disabledReason } : {}), description,
    ...(costLabel ? { costLabel } : {}),
    ...(action.emphasis === 'danger' || action.recommendation === 'high-risk' ? { dangerous: true } : {}),
    event: action.event ?? null
  };
}

function demoState(preset: 'prepared' | 'new'): GameState {
  const state = createInitialState();
  if (preset === 'new') return state;
  // Synthetic, explicitly labelled demonstration fixture: no player save is read.
  state.rewardPoints = 5000;
  state.lingyun = 20;
  for (const id of Object.keys(state.inventory) as ItemId[]) state.inventory[id] = 8;
  state.completedDungeonIds = DUNGEON_ORDER.slice(0, 4);
  state.enteredDungeonIds = DUNGEON_ORDER.slice(0, 5);
  state.claimedTaskIds = DUNGEON_ORDER.slice(0, 3).map(id => `mainline_clear_${id}`);
  state.ownedEquipment.push('armor_piercing_sword', 'bone_spear', 'mist_hood', 'spirit_robe');
  state.equipmentLevels.armor_piercing_sword = 2;
  state.equipmentLevels.bone_spear = EQUIPMENT.bone_spear.maxLevel;
  state.equipmentLevels.mist_hood = EQUIPMENT.mist_hood.maxLevel;
  state.equipmentLevels.spirit_robe = 1;
  state.equipmentMemories = {
    bone_spear: { unlockedIds: ['equipment_memory_demon_tower_1', 'equipment_memory_metro_abyss'], activeId: 'equipment_memory_demon_tower_1' },
    mist_hood: { unlockedIds: ['equipment_memory_demon_tower_1'] }
  };
  state.equipped.weapon = 'armor_piercing_sword';
  state.ownedPets = ['contract_sprite', 'mist_kitten'];
  state.petLevels = { contract_sprite: 1, mist_kitten: 1 };
  state.activePet = 'contract_sprite';
  state.learnedMethods = ['mist_breathing', 'iron_body'];
  state.methodRanks = { mist_breathing: 1, iron_body: 1 };
  state.activeMethod = 'mist_breathing';
  state.bloodlineRanks = { titan_marrow: 1 };
  state.activeBloodline = 'titan_marrow';
  state.ownedCompanions = ['qin_che'];
  state.companionRanks = { qin_che: 1 };
  state.activeCompanion = 'qin_che';
  state.preparedItemIds = ['thunder_talisman', 'dispel_talisman'];
  state.player.maxHp = getDerivedStats(state).maxHp;
  state.player.hp = Math.max(1, state.player.maxHp - 35);
  state.log = ['交互演示存档：资源、首通与养成进度为合成样本，刷新即可重置。'];
  return state;
}

export function createDemo(preset: 'prepared' | 'new' = 'prepared') {
  let state = demoState(preset);
  let commissionDraft: EquipmentCommissionDraft = { equipmentIds: [], targetMaterialId: null };
  const rowCache = new Map<Panel, Row[]>();
  const globalCache = new Map<Panel, Action[]>();

  function projection(panel: Panel, id?: string) {
    const view = buildGameViewModel(state, {
      hubPanel: panel, hubSelections: id ? { [panel]: id } : {}, equipmentCommissionDraft: commissionDraft
    });
    const status = view.sections.find(section => section.kind === 'status');
    const objective = view.sections.find(section => section.kind === 'objective');
    const actions = view.sections.find(section => section.kind === 'actions');
    if (!status || status.detail.kind !== 'hub' || !objective || !actions) throw new Error('主神空间投影不完整。');
    return { detail: status.detail as HubDetailViewModel, objective, actions: actions.actions };
  }

  function rowFromView(panel: Panel, id: string, data: Omit<Row, 'id' | 'actions' | 'summary'>): Row {
    const view = projection(panel, id);
    const selected = view.actions.filter(action => {
      if (!action.actionId.startsWith(`hub.${panel}.`) || action.actionId.includes('.select:')) return false;
      if (panel === 'equipment' && /^hub\.equipment\.commission\.(material|start|recall)$/.test(action.actionId)) return false;
      if (/^hub\.(?:equipment\.(?:equip:|memory\.)|supplies\.toggle:|(?:pets|methods|bloodlines|companions)\.activate:)/.test(action.actionId)) return false;
      return true;
    });
    const details = [...data.details];
    const actions: Action[] = selected.map(action => ({ ...mapAction(action), id: `${action.actionId}::${panel}/${id}` }));
    if (panel === 'equipment' && view.detail.equipmentMemory) {
      const memory = view.detail.equipmentMemory;
      details.push({ label: '装备记忆', value: memory.unlockedMemories.length
        ? memory.unlockedMemories.map(entry => `${entry.name}${entry.active ? '（已激活）' : ''}：${entry.effectDescription}`).join('；')
        : memory.acquisitionReadout });
    }
    return {
      ...data, id, details, summary: view.detail.panelSummary, actions
    };
  }

  function getRows(panel: Panel): Row[] {
    if (rowCache.has(panel)) return rowCache.get(panel)!;
    let rows: Row[];
    switch (panel) {
      case 'equipment':
        rows = Object.values(EQUIPMENT).map(item => {
          const owned = state.ownedEquipment.includes(item.id);
          const level = state.equipmentLevels[item.id] ?? 1;
          const equipped = state.equipped[item.slot] === item.id;
          const temper = getEquipmentTemperStatus(state, item.id);
          const attunement = getEquipmentAttunementOptions(item.id).find(option => option.id === state.equipmentAttunements?.[item.id]);
          const status = equipped ? `已装备 · ${level} 级` : owned ? `已拥有 · ${level} 级` : '未拥有';
          return rowFromView(panel, item.id, {
            name: item.name, category: SLOT_LABELS[item.slot], icon: asset('equipment', item.id),
            description: item.description, status, rarity: equipmentRarity(item.id),
            details: [
              { label: '装备部位', value: SLOT_LABELS[item.slot] },
              { label: '基础属性', value: statsReadout(item.base) },
              { label: '每级成长', value: statsReadout(item.perLevel) },
              { label: '等级', value: `${level} / ${item.maxLevel}${owned ? '' : '（获得后为 1 级）'}` },
              { label: '铭刻', value: attunement ? `${attunement.name}：${attunement.description}` : '尚未铭刻；支持铭刻的装备满级后可选择分支。' },
              { label: '淬炼', value: temper.eligible ? `${temper.currentRank} / ${temper.maxRank}${temper.materialId ? ` · 材料：${ITEMS[temper.materialId].name}` : ''}` : '此装备不支持淬炼' },
              { label: '生效方式', value: '兑换放入装备架，手动装备后属性生效；同部位只能穿戴一件。' }
            ]
          });
        });
        break;
      case 'supplies':
        rows = TACTICAL_ITEM_IDS.map(id => {
          const item = ITEMS[id];
          const supply = isFieldSupplyItemId(id);
          const carried = (state.preparedItemIds ?? []).includes(id);
          return rowFromView(panel, id, {
            name: item.name, category: supply ? '补给品' : CATEGORY_LABELS[TACTICAL_ITEM_CATEGORY_BY_ID[id]],
            icon: asset('item', id), description: item.description, rarity: UNCOMMON_ITEMS.has(id) ? 'uncommon' : 'common',
            status: `库存 ${state.inventory[id]} · ${supply ? '无需携行' : carried ? '已携行' : '未携行'}`,
            details: [
              { label: '用途', value: item.description },
              { label: '库存', value: `${state.inventory[id]} 个` },
              { label: '兑换单价', value: item.cost ? costReadout(item.cost) : '不可直接兑换' },
              { label: '携行规则', value: supply ? '不占携行槽；副本中有库存即可使用。' : '装入携行后，下次入场带上这类道具；配置不会购买，使用仍需库存。' }
            ]
          });
        });
        break;
      case 'pets':
        rows = Object.values(PETS).map(pet => {
          const owned = state.ownedPets.includes(pet.id);
          const level = state.petLevels[pet.id] ?? 1;
          return rowFromView(panel, pet.id, {
            name: pet.name, category: pet.source === 'shop' ? '可签约' : '副本捕获', icon: asset('pet', pet.id),
            description: pet.description, status: state.activePet === pet.id ? `出战中 · ${level} 级` : owned ? `已拥有 · ${level} 级` : '未拥有',
            details: [
              { label: '特性', value: pet.description },
              { label: '当前等级加成', value: statsReadout(getPetStatBonus(pet, level)) },
              { label: '每级成长', value: statsReadout(pet.perLevel) },
              { label: '培养材料', value: `${ITEMS[pet.trainingMaterial].name} · 持有 ${state.inventory[pet.trainingMaterial]}` },
              { label: '获得途径', value: pet.source === 'shop' ? `主神空间签约：${costReadout(pet.cost ?? {})}` : `副本战斗中捕获${pet.captureItem ? `，需要${ITEMS[pet.captureItem].name}` : ''}` },
              { label: '生效方式', value: '只有出战中的一只灵宠提供属性与特性，培养永久提高等级。' }
            ]
          });
        });
        break;
      case 'methods':
        rows = METHOD_TECHNIQUE_CATALOG.map(technique => {
          const method = METHODS[technique.methodId];
          const rank = state.methodRanks[method.id];
          return rowFromView(panel, method.id, {
            name: method.name, category: '功法', description: method.description,
            status: rank ? `${rank} 阶${state.activeMethod === method.id ? ' · 常用' : ''}` : '未学习',
            details: [
              { label: '功法被动', value: method.passive },
              { label: '学习属性', value: statsReadout(method.stats) },
              { label: '主动战技', value: `${technique.name}：${effectReadout(technique.effects[rank ?? 1])}${technique.requiresActivePet ? '；需要出战灵宠' : ''}` },
              { label: '学习消耗', value: costReadout(method.cost) },
              { label: '生效方式', value: '已学功法的被动都生效；精研后下次入场使用新阶位战技。常用只调整列表顺序。' }
            ]
          });
        });
        break;
      case 'bloodlines':
        rows = BLOODLINE_CATALOG.map(bloodline => {
          const rank = state.bloodlineRanks[bloodline.id];
          return rowFromView(panel, bloodline.id, {
            name: bloodline.name, category: bloodline.title,
            description: `${bloodline.title}，激活后获得属性与血统爆发。`,
            status: rank ? `${rank} 阶${state.activeBloodline === bloodline.id ? ' · 已激活' : ' · 未激活'}` : '未觉醒',
            details: [
              { label: `${rank ?? 1} 阶属性`, value: statsReadout(bloodline.statBonuses[rank ?? 1]) },
              { label: '血统爆发', value: effectReadout(bloodline.surgeEffects[rank ?? 1]) },
              { label: '三阶属性', value: statsReadout(bloodline.statBonuses[3]) },
              { label: '生效方式', value: '每次仅激活一种血统；角色当前激活的血统及其阶位会在下次入场时带入副本。' }
            ]
          });
        });
        break;
      case 'companions':
        rows = COMPANION_CATALOG.map(companion => {
          const rank = state.companionRanks[companion.id];
          const unlocked = state.completedDungeonIds.includes(companion.unlockDungeonId);
          return rowFromView(panel, companion.id, {
            name: companion.name, category: companion.title,
            description: `提供「${companion.assistName}」战斗援助。`,
            status: rank ? `${rank} 阶${state.activeCompanion === companion.id ? ' · 出战中' : ' · 未出战'}` : unlocked ? '可招募' : '未解锁',
            details: [
              { label: '援助技能', value: `${companion.assistName}：${effectReadout(companion.assistEffects[rank ?? 1])}` },
              { label: '招募条件', value: `首次通关${DUNGEONS[companion.unlockDungeonId].name}` },
              { label: '招募消耗', value: costReadout(companion.recruitCost) },
              { label: '训练材料', value: `${ITEMS[companion.trainingMaterial].name} · 持有 ${state.inventory[companion.trainingMaterial]}` },
              { label: '生效方式', value: '每次只能带一位同伴；下次入场按当前出战人选和阶位提供援助。' }
            ]
          });
        });
        break;
      case 'tasks':
        rows = MAIN_GOD_TASKS.map(task => {
          const evaluation = evaluateTask(state, task.id);
          if (!evaluation) throw new Error(`任务定义缺失：${task.id}`);
          const event: PresentationEvent = { kind: 'command', command: { type: 'hub/claim-task', taskId: task.id } };
          const preview = reduceGameCommand(state, event.command);
          const reason = evaluation.status === 'claimed' ? '任务奖励已经领取。'
            : evaluation.status === 'locked' ? `尚未解锁。${task.hint}`
            : evaluation.status === 'active' ? `尚未完成：${evaluation.progressText}。${task.hint}`
            : preview.status === 'rejected' ? preview.reason.message : undefined;
          return {
            id: task.id, name: task.title, category: task.kind === 'mainline' ? '主线任务' : '支线任务',
            description: task.description, summary: `${TASK_LABELS[evaluation.status]} · ${evaluation.progressText}`,
            status: TASK_LABELS[evaluation.status],
            details: [
              { label: '任务目标', value: task.description }, { label: '当前进度', value: evaluation.progressText },
              { label: '完成提示', value: task.hint }, { label: '任务奖励', value: costReadout(task.reward) },
              { label: '领取作用', value: task.kind === 'mainline' ? '奖励立即入账，并按章节顺序解锁后续副本。' : '奖励立即入账；每项任务只能领取一次。' }
            ],
            actions: [{ id: `hub.tasks.claim:${task.id}::tasks/${task.id}`, label: `领取：${task.title}`, enabled: !reason, ...(reason ? { reason } : {}), description: `领取后获得 ${costReadout(task.reward)}。${task.kind === 'mainline' ? '领取主线奖励推进后续章节。' : ''}`, event }]
          };
        });
        break;
      default:
        throw new Error(`未知服务面板：${String(panel)}`);
    }
    rowCache.set(panel, rows);
    return rows;
  }

  function getGlobalActions(panel: Panel): Action[] {
    if (globalCache.has(panel)) return globalCache.get(panel)!;
    let mapped: Action[] = [];
    if (panel === 'supplies') {
      mapped = projection(panel).actions.filter(action => action.actionId === 'hub.recover').map(mapAction);
    } else if (panel === 'equipment') {
      const view = projection(panel);
      const commission = view.detail.equipmentCommission;
      if (!commission) throw new Error('装备封存委托投影不完整。');
      mapped = commission.materialOptions.map(option => {
        const reason = commission.status === 'active' ? '委托进行中，目标材料已锁定。'
          : option.selected ? `已选择${option.materialName}。` : undefined;
        return {
          id: `hub.equipment.commission.material:${option.materialId}`,
          label: `选择材料：${option.materialName}${option.selected ? '（已选择）' : ''}`,
          selected: option.selected, enabled: !reason, ...(reason ? { reason } : {}),
          description: `完成委托后获得${option.materialName} ×${commission.materialReward}，用于装备淬炼。选择本身不消耗资源。`,
          event: {
            kind: 'local', action: {
              type: 'hub/set-equipment-commission-draft',
              draft: { equipmentIds: commission.draft.equipmentIds, targetMaterialId: option.materialId }
            }
          }
        };
      });
      mapped.push(...view.actions.filter(action => /^hub\.equipment\.commission\.(start|recall)$/.test(action.actionId)).map(mapAction));
    }
    globalCache.set(panel, mapped);
    return mapped;
  }

  function execute(requested: Action): { ok: boolean; message: string } {
    // Re-resolve by action identity so an open detail sheet cannot spend against a stale preview.
    let current: Action | undefined;
    for (const panel of panels) {
      current = getGlobalActions(panel.id).find(action => action.id === requested.id)
        ?? getRows(panel.id).flatMap(row => row.actions).find(action => action.id === requested.id);
      if (current) break;
    }
    if (!current) return { ok: false, message: '此操作已经不可用，请重新打开条目。' };
    if (!current.enabled) return { ok: false, message: current.reason ?? '当前条件不满足。' };
    if (!current.event) return { ok: false, message: '此操作缺少可执行事件。' };
    if (current.event.kind === 'local') {
      if (current.event.action.type !== 'hub/set-equipment-commission-draft') return { ok: false, message: '此原型仅支持装备委托的本地配置操作。' };
      commissionDraft = current.event.action.draft;
      rowCache.clear(); globalCache.clear();
      return { ok: true, message: '装备封存委托选择已更新，启动前不会消耗资源。' };
    }
    const result = reduceGameCommand(state, current.event.command);
    if (result.status === 'rejected') return { ok: false, message: result.reason.message };
    const previousLog = state.log[0];
    state = result.state;
    rowCache.clear(); globalCache.clear();
    const message = state.log[0] !== previousLog ? state.log[0]! : `${current.label}已完成。`;
    return { ok: true, message: message.replace(/主修功法/g, '常用功法').replace(/trap_scout/g, '陷阱预警').replace(/combat_assist/g, '战斗协助').replace(/portal_anchor/g, '传送锚定') };
  }

  return {
    getWallet: () => ({
      rewardPoints: state.rewardPoints, lingyun: state.lingyun,
      hp: state.player.hp, maxHp: getDerivedStats(state).maxHp, power: getPlayerPower(state),
      preparedCount: getTacticalLoadoutStatus(state).preparedItemIds.length
    }),
    getRows, getGlobalActions, execute
  };
}

(window as Window & { NpcDemo?: unknown }).NpcDemo = { panels, createDemo };
