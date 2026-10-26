import {
  BLOODLINE_CATALOG, COMPANION_CATALOG, DUNGEONS, EQUIPMENT, EQUIPMENT_SLOTS, ITEMS,
  METHODS, METHOD_TECHNIQUE_CATALOG, PETS, getGameAsset, getEquipmentTemperStatus,
  type Cost, type GameState, type ItemId, type EquipmentId, type GameAssetKind
} from '@infinite-flow/core';
import { MAIN_GOD_TASKS, evaluateTask } from '@infinite-flow/core/task-system';
import { TACTICAL_ITEM_IDS, TACTICAL_ITEM_CATEGORY_BY_ID, isFieldSupplyItemId } from '@infinite-flow/core/tactical-loadout';
import { getEquipmentAttunementOptions, getEquipmentSystemBonus } from '@infinite-flow/core/equipment-system';
import { getEquipmentRolledBaseStats, type EquipmentRoll } from '@infinite-flow/core/equipment-rolls';
import { reduceGameCommand } from '@infinite-flow/application';
import type {
  HubCatalogPanel, HubShopCatalogViewModel, HubShopListingViewModel, HubShopRowViewModel, ViewActionModel,
  PresentationEvent, EquipmentCommissionDetailViewModel, EquipmentMemoryLibraryViewModel,
  EquipmentMemoryOptionViewModel, HubOwnedLoadoutViewModel, EquipmentItemViewModel,
  OwnedEquipmentEntryViewModel
} from './types.js';

type PanelProjection = Readonly<{
  actions: readonly ViewActionModel[];
  equipmentCommission?: EquipmentCommissionDetailViewModel;
  equipmentMemory?: EquipmentMemoryLibraryViewModel;
  materialReforge?: readonly ViewActionModel[];
}>;

function asset(kind: GameAssetKind, id: string): string | undefined {
  return getGameAsset(kind, id)?.key;
}

// Display-only quality matches the approved grid; no gameplay or save fields change.
const POOR_EQUIPMENT = new Set(['training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves', 'patched_boots', 'patched_belt']);
type CatalogRarity = NonNullable<HubShopRowViewModel['rarity']>;
const CATALOG_RARITY: Readonly<Record<string, Readonly<Record<string, CatalogRarity>>>> = {
  methods: { mist_breathing: 'common', iron_body: 'uncommon', cloud_step: 'uncommon', gate_sense: 'rare', beast_taming: 'rare', star_core_method: 'epic', void_heart: 'legendary' },
  pets: { contract_sprite: 'common', mist_kitten: 'uncommon', ash_hound: 'rare', mirror_moth: 'rare', starling_drone: 'epic', void_whelp: 'legendary' },
  bloodlines: { titan_marrow: 'epic', void_symbiote: 'legendary', bastion_chitin: 'epic', phoenix_ember: 'legendary' },
  companions: { qin_che: 'rare', zhou_yingxue: 'epic', lu_guanlan: 'legendary' },
};
function catalogRarity(panel: HubCatalogPanel, id: string): HubShopRowViewModel['rarity'] {
  if (panel === 'equipment') {
    if (POOR_EQUIPMENT.has(id)) return 'poor';
    const price = EQUIPMENT[id as EquipmentId].cost.rewardPoints ?? 0;
    return price <= 540 ? 'common' : price <= 1020 ? 'uncommon' : price <= 1460 ? 'rare' : price <= 1980 ? 'epic' : 'legendary';
  }
  if (panel === 'supplies') return ['gate_sigil', 'capture_net', 'spirit_bait'].includes(id) ? 'uncommon' : 'common';
  return CATALOG_RARITY[panel]?.[id];
}

const NPCS = {
  equipment: { npcName: '军需官', title: '装备与强化', greeting: '按部位挑装备，已拥有的可以直接升级。', portraitAssetKey: asset('npc', 'equipment_quartermaster') },
  supplies: { npcName: '补给商', title: '物资兑换', greeting: '补给品直接用；携行道具要装进携行槽。', portraitAssetKey: asset('npc', 'supply_trader') },
  pets: { npcName: '灵宠师', title: '灵宠与培养', greeting: '只有出战的灵宠生效，在「角色」里更换。', portraitAssetKey: asset('npc', 'pet_keeper') },
  methods: { npcName: '修行导师', title: '功法与战技', greeting: '学会就有被动，战技在战斗「法术」里。', portraitAssetKey: asset('npc', 'method_master') },
  bloodlines: { npcName: '血脉祭司', title: '血统与觉醒', greeting: '只能激活一种血统，在「角色」里切换。', portraitAssetKey: asset('npc', 'bloodline_priest') },
  companions: { npcName: '同行引路人', title: '同伴与训练', greeting: '每次带一位同伴，在「角色」里选出战。', portraitAssetKey: asset('npc', 'companion_guide') },
  tasks: { npcName: '任务使者', title: '任务与奖励', greeting: '所有目标都列在这里。完成后手动领取，主线奖励还会开启下一章。', portraitAssetKey: asset('npc', 'main_god_projection') }
} satisfies Record<HubCatalogPanel, Omit<HubShopCatalogViewModel, 'panel' | 'rows' | 'services'>>;

const SLOT_LABELS = { weapon: '武器', head: '头部', armor: '护甲', hands: '护手', feet: '足部', waist: '腰部', charm: '护符' };
const STAT_LABELS: Record<string, string> = {
  body: '体魄', spirit: '心神', agility: '身法', luck: '气运', maxHp: '生命上限',
  attack: '攻击', artPower: '术法', defense: '防御', speed: '速度', trapCheck: '陷阱感知'
};
const CATEGORY_LABELS = { combat: '战斗道具', ward: '防护道具', portal: '传送道具', capture: '捕获道具' };
const TASK_LABELS = { locked: '未解锁', active: '进行中', completed: '可领取', claimed: '已领取' };
// The effects the pet passive tags trigger in core combat-mechanics.
export const PET_PASSIVE_LABELS: Record<string, string> = {
  combat_assist: '战斗协助：攻击伤害 +4、术法伤害 +3',
  trap_scout: '陷阱预警：陷阱检定 +3',
  portal_anchor: '传送锚定：传送修正 +2'
};
const EFFECT_LABELS: Record<string, string> = {
  guarding: '获得防御', clearsRustPoison: '清除锈毒', clearsMirrorSlow: '清除镜面迟缓',
  focusGain: '战意', breathGain: '真气', healPercent: '恢复生命', forceDamage: '物理伤害',
  artDamage: '术法伤害', barrier: '护盾'
};

export function statsReadout(stats: Record<string, number | undefined>): string {
  return Object.entries(stats).filter(([, value]) => value !== undefined && value !== 0)
    .map(([key, value]) => `${STAT_LABELS[key] ?? key} ${value! > 0 ? '+' : ''}${value}`).join(' · ') || '无额外属性';
}

/** Reads fixed affixes through the public core selector; no equipment rules live here. */
export function buildEquipmentItemViewModel(
  equipmentId: EquipmentId,
  level: number,
  roll?: EquipmentRoll
): EquipmentItemViewModel {
  const equipment = EQUIPMENT[equipmentId];
  const affixes = getEquipmentSystemBonus([equipmentId], { [equipmentId]: level });
  return {
    equipmentId,
    name: equipment.name,
    description: equipment.description,
    slot: equipment.slot,
    slotLabel: SLOT_LABELS[equipment.slot],
    level,
    maxLevel: equipment.maxLevel,
    rarity: catalogRarity('equipment', equipmentId),
    visualAssetKey: asset('equipment', equipmentId),
    baseStatsLabel: '基础属性（Lv.1）',
    baseStatsReadout: statsReadout(getEquipmentRolledBaseStats(equipment.base, roll)),
    growthStatsReadout: statsReadout(equipment.perLevel),
    affixReadout: affixes.descriptions.length
      ? `${affixes.descriptions.join(' ')} ${statsReadout(affixes.bonus)}`
      : '无固定词缀',
    ...(roll ? { rollReadout: `炼狱第 ${roll.sourceTier} 层 · 强度 ${roll.itemPower} · ${roll.affixes.map(affix => `${STAT_LABELS[affix.stat] ?? affix.stat} +${affix.value}${affix.greater ? '（强效）' : ''}`).join(' · ')}` } : {})
  };
}

function equipmentItemDetails(item: EquipmentItemViewModel): HubShopRowViewModel['details'] {
  return [
    { label: '装备部位', value: item.slotLabel },
    { label: item.baseStatsLabel, value: item.baseStatsReadout },
    { label: '每级成长', value: item.growthStatsReadout },
    { label: `固定词缀（Lv.${item.level}）`, value: item.affixReadout },
    { label: '等级', value: `${item.level} / ${item.maxLevel}` },
    ...(item.rollReadout ? [{ label: '随机词条', value: item.rollReadout }] : [])
  ];
}

/** Inventory rows reuse catalog item details and receive only the wear action from the host. */
export function buildOwnedEquipmentCatalog(
  state: GameState,
  projectEquipAction: (equipmentId: EquipmentId) => ViewActionModel
): readonly OwnedEquipmentEntryViewModel[] {
  const owned = new Set(state.ownedEquipment);
  return Object.values(EQUIPMENT).filter(equipment => owned.has(equipment.id)).map(equipment => {
    const item = buildEquipmentItemViewModel(equipment.id, state.equipmentLevels[equipment.id] ?? 1, state.equipmentRolls?.[equipment.id]);
    const equipped = state.equipped[equipment.slot] === equipment.id;
    const equipAction = projectEquipAction(equipment.id);
    return {
      ...item,
      id: `equipment/${equipment.id}`,
      category: item.slotLabel,
      status: `${equipped ? '已装备' : '背包中'} · ${item.level} 级`,
      equipped,
      details: [
        ...equipmentItemDetails(item),
        { label: '生效方式', value: '永久拥有；主神空间或探索中可手动穿戴，同部位只能穿戴一件。' }
      ],
      actions: [equipAction],
      equipAction
    };
  });
}

export function effectReadout(effect: Record<string, number | boolean>): string {
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

/** NPC commerce actions retain the same reducer preflight as the existing panels. */
function shopAction(action: ViewActionModel, panel: HubCatalogPanel, id?: string): ViewActionModel {
  const readout = action.readout
    ?.replace(/还需点击「装备」(?:才生效)?。/g, '购入后可在装备界面穿戴。')
    .replace(/带入副本前还需装入携行。/g, '购入后可在背包中配置携行。');
  return {
    ...action,
    actionId: `${action.actionId}::${panel}/${id ?? 'service'}`,
    ...(readout ? { readout } : {})
  };
}

function taskPriority(status: string): number {
  return ['可领取', '进行中', '未解锁', '已领取'].indexOf(status);
}

function buildHubRows(
  state: GameState,
  panel: HubCatalogPanel,
  projectRow: (id: string) => PanelProjection,
  selection?: Readonly<{
    ids: ReadonlySet<string>;
    actions: (id: string, view: PanelProjection) => readonly ViewActionModel[];
  }>
): HubShopRowViewModel[] {
  const included = (id: string) => selection === undefined || selection.ids.has(id);
  function rowFromView(
    rowPanel: HubCatalogPanel,
    id: string,
    data: Omit<HubShopRowViewModel, 'id' | 'actions'>,
    owned = false
  ): HubShopRowViewModel {
    const view = projectRow(id);
    const actions = selection?.actions(id, view) ?? view.actions.filter(action => {
      if (!action.actionId.startsWith(`hub.${rowPanel}.`) || action.actionId.includes('.select:')) return false;
      if (rowPanel === 'equipment' && /^hub\.equipment\.commission\.(material|start|recall)$/.test(action.actionId)) return false;
      // Merchants only sell and train; wearing, carrying and choosing who goes along live on the character sheet.
      if (/^hub\.(?:equipment\.(?:equip:|memory\.)|supplies\.toggle:|(?:pets|methods|bloodlines|companions)\.activate:)/.test(action.actionId)) return false;
      // What is already owned offers no second purchase, only training and taking it along.
      if (owned && /^hub\.(?:equipment\.buy|pets\.buy|methods\.learn|bloodlines\.unlock|companions\.recruit):/.test(action.actionId)) return false;
      return true;
    }).map(action => shopAction(action, rowPanel, id));
    const details = [...data.details];
    if (view.equipmentMemory) {
      const memory = view.equipmentMemory;
      details.push({ label: '装备记忆', value: memory.unlockedMemories.length
        ? memory.unlockedMemories.map(entry => `${entry.name}${entry.active ? '（已激活）' : ''}：${entry.effectDescription}`).join('；')
        : memory.acquisitionReadout });
    }
    return { ...data, id, rarity: catalogRarity(rowPanel, id), details, actions };
  }
  let rows: HubShopRowViewModel[];
  switch (panel) {
    case 'equipment':
      rows = Object.values(EQUIPMENT).filter(item => included(item.id)).map(item => {
        const owned = state.ownedEquipment.includes(item.id);
        const level = state.equipmentLevels[item.id] ?? 1;
        const equipped = state.equipped[item.slot] === item.id;
        const temper = getEquipmentTemperStatus(state, item.id);
        const attunement = getEquipmentAttunementOptions(item.id).find(option => option.id === state.equipmentAttunements?.[item.id]);
        const status = equipped ? `已装备 · ${level} 级` : owned ? `已拥有 · ${level} 级` : '未拥有';
        const equipmentItem = buildEquipmentItemViewModel(item.id, level, state.equipmentRolls?.[item.id]);
        return rowFromView(panel, item.id, {
          name: item.name, category: SLOT_LABELS[item.slot], visualAssetKey: asset('equipment', item.id),
          description: item.description, status,
          details: [
            ...equipmentItemDetails(equipmentItem).map(detail => detail.label === '等级' && !owned
              ? { ...detail, value: `${detail.value}（获得后为 1 级）` }
              : detail),
            { label: '铭刻', value: attunement ? `${attunement.name}：${attunement.description}` : '尚未铭刻；支持铭刻的装备满级后可选择分支。' },
            { label: '淬炼', value: temper.eligible ? `${temper.currentRank} / ${temper.maxRank}${temper.materialId ? ` · 材料：${ITEMS[temper.materialId].name}` : ''}` : '此装备不支持淬炼' },
            { label: '生效方式', value: '兑换放入装备架，手动装备后属性生效；同部位只能穿戴一件。' }
          ]
        }, owned);
      });
      break;
    case 'supplies':
      rows = TACTICAL_ITEM_IDS.filter(included).map(id => {
        const item = ITEMS[id];
        const supply = isFieldSupplyItemId(id);
        const carried = (state.preparedItemIds ?? []).includes(id);
        return rowFromView(panel, id, {
          name: item.name, category: supply ? '补给品' : CATEGORY_LABELS[TACTICAL_ITEM_CATEGORY_BY_ID[id]],
          visualAssetKey: asset('item', id), description: item.description,
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
      rows = Object.values(PETS).filter(pet => included(pet.id)).map(pet => {
        const owned = state.ownedPets.includes(pet.id);
        const level = state.petLevels[pet.id] ?? 1;
        return rowFromView(panel, pet.id, {
          name: pet.name, category: pet.source === 'shop' ? '主神签约' : '副本捕获', visualAssetKey: asset('pet', pet.id),
          description: pet.description, status: state.activePet === pet.id ? `出战中 · ${level} 级` : owned ? `已拥有 · ${level} 级` : '未拥有',
          details: [
            { label: '特性', value: pet.passiveTags.map(tag => PET_PASSIVE_LABELS[tag]).join('；') },
            { label: '基础属性', value: statsReadout(pet.bonus) },
            { label: '每级成长', value: statsReadout(pet.perLevel) },
            { label: '培养材料', value: `${ITEMS[pet.trainingMaterial].name} · 持有 ${state.inventory[pet.trainingMaterial]}` },
            { label: '获得途径', value: pet.source === 'shop' ? `主神空间签约：${costReadout(pet.cost ?? {})}` : `副本战斗中捕获${pet.captureItem ? `，需要${ITEMS[pet.captureItem].name}` : ''}` },
            { label: '生效方式', value: '在「角色 → 灵宠」设为出战后，属性在副本中常驻，特性在战斗、陷阱或传送时自动触发；同时只有一只出战。' }
          ]
        }, owned);
      });
      break;
    case 'methods':
      rows = METHOD_TECHNIQUE_CATALOG.filter(technique => included(technique.methodId)).map(technique => {
        const method = METHODS[technique.methodId];
        const rank = state.methodRanks[method.id];
        return rowFromView(panel, method.id, {
          name: method.name, category: '功法', description: method.description, visualAssetKey: asset('item', `method_${method.id}`),
          status: rank ? `${rank} 阶${state.activeMethod === method.id ? ' · 常用' : ''}` : '未学习',
          details: [
            { label: '功法被动', value: method.passive },
            { label: '学习属性', value: statsReadout(method.stats) },
            { label: '主动战技', value: `${technique.name}：${effectReadout(technique.effects[rank ?? 1])}${technique.requiresActivePet ? '；需要出战灵宠' : ''}` },
            { label: '学习消耗', value: costReadout(method.cost) },
            { label: '生效方式', value: `被动学会即生效；战技「${technique.name}」在副本战斗「法术」里使用，每场一次。精研后下次入场生效；常用在「角色 → 功法」设置，只调整列表顺序。` }
          ]
        }, rank !== undefined);
      });
      break;
    case 'bloodlines':
      rows = BLOODLINE_CATALOG.filter(bloodline => included(bloodline.id)).map(bloodline => {
        const rank = state.bloodlineRanks[bloodline.id];
        return rowFromView(panel, bloodline.id, {
          name: bloodline.name, category: bloodline.title, visualAssetKey: asset('item', `bloodline_${bloodline.id}`),
          description: `${bloodline.title}，激活后获得属性与血统爆发。`,
          status: rank ? `${rank} 阶${state.activeBloodline === bloodline.id ? ' · 已激活' : ' · 未激活'}` : '未觉醒',
          details: [
            { label: `${rank ?? 1} 阶属性`, value: statsReadout(bloodline.statBonuses[rank ?? 1]) },
            { label: '血统爆发', value: effectReadout(bloodline.surgeEffects[rank ?? 1]) },
            { label: '三阶属性', value: statsReadout(bloodline.statBonuses[3]) },
            { label: '生效方式', value: '在「角色 → 血统」激活后，属性在副本中常驻，血统爆发在副本战斗「法术」里使用，每场一次；同时只激活一种，下次入场生效。' }
          ]
        }, rank !== undefined);
      });
      break;
    case 'companions':
      rows = COMPANION_CATALOG.filter(companion => included(companion.id)).map(companion => {
        const rank = state.companionRanks[companion.id];
        const unlocked = state.completedDungeonIds.includes(companion.unlockDungeonId);
        return rowFromView(panel, companion.id, {
          name: companion.name, category: companion.title, visualAssetKey: asset('character', `companion_${companion.id}`),
          description: `提供「${companion.assistName}」战斗援助。`,
          status: rank ? `${rank} 阶${state.activeCompanion === companion.id ? ' · 出战中' : ' · 未出战'}` : unlocked ? '可招募' : '未解锁',
          details: [
            { label: '援助技能', value: `${companion.assistName}：${effectReadout(companion.assistEffects[rank ?? 1])}` },
            { label: '招募条件', value: `首次通关${DUNGEONS[companion.unlockDungeonId].name}` },
            { label: '招募消耗', value: costReadout(companion.recruitCost) },
            { label: '训练材料', value: `${ITEMS[companion.trainingMaterial].name} · 持有 ${state.inventory[companion.trainingMaterial]}` },
            { label: '生效方式', value: `在「角色 → 同伴」设为出战后，「${companion.assistName}」在副本战斗「法术」里使用，每场一次；同时只带一位，下次入场生效。` }
          ]
        }, rank !== undefined);
      });
      break;
    case 'tasks':
      rows = MAIN_GOD_TASKS.filter(task => included(task.id)).map((task): HubShopRowViewModel => {
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
          description: task.description, status: TASK_LABELS[evaluation.status],
          details: [
            { label: '任务目标', value: task.description }, { label: '当前进度', value: evaluation.progressText },
            { label: '完成提示', value: task.hint }, { label: '任务奖励', value: costReadout(task.reward) },
            { label: '领取作用', value: task.kind === 'mainline' ? '奖励立即入账，并按章节顺序解锁后续副本。' : '奖励立即入账；每项任务只能领取一次。' }
          ],
          actions: [{
            actionId: `hub.tasks.claim:${task.id}::tasks/${task.id}`,
            label: `领取：${task.title}`,
            enabled: !reason,
            ...(reason ? { disabledReason: reason } : { event }),
            readout: `领取后获得 ${costReadout(task.reward)}。${task.kind === 'mainline' ? '领取主线奖励推进后续章节。' : ''}`,
            placement: 'primary', emphasis: 'primary',
            recommendation: evaluation.status === 'completed' ? 'recommended' : 'neutral'
          }]
        };
      }).sort((left, right) => taskPriority(left.status) - taskPriority(right.status));
      break;
    default:
      throw new Error(`未知服务面板：${String(panel)}`);
  }
  return rows;
}

/** Build only the active NPC catalogue; never re-enter the full game projection. */
/** The full cost an action's readout ends with ("… · 消耗 120 奖励点、…"). */
function shortCost(cost: string): string {
  const [first, ...rest] = cost.split('、');
  return rest.length ? `${first}…` : first!;
}

function actionCost(action: ViewActionModel | undefined): string | undefined {
  return action?.readout?.split(' · 消耗 ')[1];
}

/** The list summary of one merchant entry: a badge, two short lines and the one inline action. */
function shopListing(state: GameState, panel: HubCatalogPanel, row: HubShopRowViewModel): HubShopListingViewModel | undefined {
  const find = (verb: string) => row.actions.find(action => action.actionId.startsWith(`hub.${panel}.${verb}:`));
  const inline = (action: ViewActionModel | undefined) => action === undefined ? {} : {
    primaryActionId: action.actionId,
    // The inline button shows the leading cost; the detail lists every cost.
    ...(actionCost(action) === undefined ? {} : { price: shortCost(actionCost(action)!) })
  };
  switch (panel) {
    case 'supplies': {
      const id = row.id as ItemId;
      const carried = (state.preparedItemIds ?? []).includes(id as never);
      return {
        ...(isFieldSupplyItemId(id) ? {} : { badge: carried ? { label: '已携行', tone: 'on' } : { label: '未携行', tone: 'locked' } }),
        meta: `持有 ${state.inventory[id]}`, lines: [ITEMS[id].description], ...inline(find('buy'))
      };
    }
    case 'equipment': {
      const item = EQUIPMENT[row.id as EquipmentId];
      const owned = state.ownedEquipment.includes(item.id);
      const level = state.equipmentLevels[item.id] ?? 1;
      const upgrade = find('upgrade');
      const buy = find('buy');
      const next = owned
        ? upgrade?.enabled ? `升级：${actionCost(upgrade) ?? ''}` : level >= item.maxLevel ? '已满级' : upgrade?.disabledReason ?? ''
        : buy?.enabled ? `兑换：${actionCost(buy) ?? ''}` : buy?.disabledReason ?? '';
      const action = owned ? (upgrade?.enabled ? upgrade : undefined) : (buy?.enabled ? buy : undefined);
      return {
        badge: state.equipped[item.slot] === item.id ? { label: '已装备', tone: 'on' }
          : owned ? { label: `Lv${level}`, tone: 'info' } : buy?.enabled ? { label: '可兑换', tone: 'info' } : { label: '未解锁', tone: 'locked' },
        lines: [buildEquipmentItemViewModel(item.id, level, state.equipmentRolls?.[item.id]).baseStatsReadout, next].filter(Boolean),
        ...inline(action), ...(owned || buy?.enabled ? {} : { dim: true })
      };
    }
    case 'methods': {
      const rank = state.methodRanks[row.id as keyof typeof state.methodRanks];
      const technique = row.details.find(fact => fact.label === '主动战技')?.value ?? '';
      return {
        ...(rank === undefined ? { badge: { label: '未学习', tone: 'locked' } } : state.activeMethod === row.id ? { badge: { label: '常用', tone: 'info' } } : {}),
        ...(rank === undefined ? {} : { level: { current: rank, max: 3 } }),
        lines: [`被动：${METHODS[row.id as keyof typeof METHODS].passive}`, `战技：${technique}`],
        ...inline(rank === undefined ? find('learn') : find('upgrade'))
      };
    }
    case 'pets': {
      const pet = PETS[row.id as keyof typeof PETS];
      const owned = state.ownedPets.includes(pet.id);
      const level = state.petLevels[pet.id] ?? 1;
      const bonus = { ...pet.bonus } as Record<string, number>;
      for (let step = 1; owned && step < level; step += 1) {
        for (const [stat, value] of Object.entries(pet.perLevel)) bonus[stat] = (bonus[stat] ?? 0) + (value ?? 0);
      }
      const use = state.activePet === pet.id ? '副本中自动生效' : owned ? '在「角色 → 灵宠」设为出战'
        : pet.source === 'shop' ? `签约：${actionCost(find('buy')) ?? ''}` : '在副本战斗中捕获获得';
      return {
        badge: state.activePet === pet.id ? { label: '★出战', tone: 'on' } : owned ? { label: '已拥有', tone: 'info' } : { label: '未拥有', tone: 'locked' },
        meta: pet.source === 'shop' ? '主神签约' : '副本捕获',
        ...(owned ? { level: { current: level, max: pet.maxLevel } } : {}),
        lines: [statsReadout(bonus), use],
        ...inline(owned ? find('upgrade') : pet.source === 'shop' ? find('buy') : undefined), ...(owned ? {} : { dim: true })
      };
    }
    case 'bloodlines': {
      const bloodline = BLOODLINE_CATALOG.find(entry => entry.id === row.id)!;
      const rank = state.bloodlineRanks[bloodline.id];
      const active = state.activeBloodline === bloodline.id;
      return {
        badge: active ? { label: '★已激活', tone: 'on' } : rank ? { label: '已觉醒', tone: 'info' } : { label: '未觉醒', tone: 'locked' },
        meta: bloodline.title, ...(rank ? { level: { current: rank, max: 3 } } : {}),
        lines: [statsReadout(bloodline.statBonuses[rank ?? 1]),
          rank && !active ? '在「角色 → 血统」激活' : `爆发：${effectReadout(bloodline.surgeEffects[rank ?? 1])}`],
        ...inline(rank ? find('upgrade') : find('unlock')), ...(rank ? {} : { dim: true })
      };
    }
    case 'companions': {
      const companion = COMPANION_CATALOG.find(entry => entry.id === row.id)!;
      const rank = state.companionRanks[companion.id];
      const unlocked = state.completedDungeonIds.includes(companion.unlockDungeonId);
      const active = state.activeCompanion === companion.id;
      return {
        badge: active ? { label: '★出战', tone: 'on' } : rank ? { label: '已拥有', tone: 'info' }
          : { label: unlocked ? '未拥有' : '未解锁', tone: 'locked' },
        meta: rank ? `${companion.title} · ${rank} 阶` : companion.title,
        ...(rank ? { level: { current: rank, max: 3 } } : {}),
        lines: [`援护：${companion.assistName}：${effectReadout(companion.assistEffects[rank ?? 1])}`,
          !unlocked ? `条件：首次通关${DUNGEONS[companion.unlockDungeonId].name}` : active ? '战斗「法术 → 同伴」里使用，每场一次'
            : rank ? '在「角色 → 同伴」设为出战' : `招募：${costReadout(companion.recruitCost)}`],
        ...inline(rank ? find('upgrade') : unlocked ? find('recruit') : undefined), ...(rank ? {} : { dim: true })
      };
    }
    default:
      return undefined;
  }
}

const SHOP_LAYOUT: Partial<Record<HubCatalogPanel, NonNullable<HubShopCatalogViewModel['layout']>>> = {
  supplies: 'rows', equipment: 'rows', methods: 'rows', pets: 'cards', bloodlines: 'cards', companions: 'wide-cards'
};

/** Supplies split into what needs no slot and what must be carried; equipment into slot tabs, worn and owned first. */
function shopGroups(panel: HubCatalogPanel, rows: readonly HubShopRowViewModel[]): Pick<HubShopCatalogViewModel, 'groups' | 'groupStyle'> {
  if (panel === 'supplies') {
    return { groupStyle: 'sections', groups: [
      { id: 'supply', title: '补给品', hint: '不占携行，有库存即可用', rowIds: rows.filter(row => isFieldSupplyItemId(row.id as ItemId)).map(row => row.id) },
      { id: 'carry', title: '携行道具', hint: '需在「角色 → 携行」装入', rowIds: rows.filter(row => !isFieldSupplyItemId(row.id as ItemId)).map(row => row.id) }
    ] };
  }
  if (panel === 'equipment') {
    const order = (row: HubShopRowViewModel): number => row.listing?.badge?.tone === 'on' ? 0
      : row.listing?.badge?.label.startsWith('Lv') ? 1 : row.listing?.dim ? 3 : 2;
    return { groupStyle: 'tabs', groups: EQUIPMENT_SLOTS.map(slot => ({
      id: slot, title: SLOT_LABELS[slot],
      rowIds: rows.filter(row => EQUIPMENT[row.id as EquipmentId].slot === slot).slice().sort((a, b) => order(a) - order(b)).map(row => row.id)
    })) };
  }
  return {};
}

export function buildHubShopCatalog(
  state: GameState,
  panel: HubCatalogPanel,
  projectRow: (id?: string) => PanelProjection
): HubShopCatalogViewModel {
  const rows = buildHubRows(state, panel, projectRow).map(row => {
    const listing = shopListing(state, panel, row);
    return listing === undefined ? row : { ...row, listing };
  });
  const services: ViewActionModel[] = [];
  if (panel === 'supplies') {
    services.push(...projectRow().actions.filter(action => /^hub\.(?:recover|exchange-lingyun)$/.test(action.actionId)).map(action => shopAction(action, panel)));
  } else if (panel === 'equipment') {
    const view = projectRow();
    const commission = view.equipmentCommission;
    if (!commission) throw new Error('Equipment shop requires the commission projection.');
    services.push(...commission.materialOptions.map((option): ViewActionModel => {
      const reason = commission.status === 'active' ? '委托进行中，目标材料已锁定。'
        : option.selected ? `已选择${option.materialName}。` : undefined;
      return {
        actionId: `hub.equipment.commission.material:${option.materialId}::equipment/service`,
        label: `选择材料：${option.materialName}${option.selected ? '（已选择）' : ''}`,
        enabled: !reason, placement: 'preparation', emphasis: 'secondary', recommendation: 'neutral',
        ...(reason ? { disabledReason: reason } : {
          event: {
            kind: 'local', action: {
              type: 'hub/set-equipment-commission-draft',
              draft: { equipmentIds: commission.draft.equipmentIds, targetMaterialId: option.materialId }
            }
          } as PresentationEvent
        }),
        readout: `完成委托后获得${option.materialName} ×${commission.materialReward}，用于装备淬炼。选择本身不消耗资源。`
      };
    }));
    services.push(...view.actions.filter(action => /^hub\.equipment\.commission\.(start|recall)$/.test(action.actionId)).map(action => shopAction(action, panel)));
    services.push(...(view.materialReforge ?? []).map(action => shopAction(action, panel)));
  }
  return {
    panel, ...NPCS[panel], rows, services,
    ...(panel === 'equipment' ? { serviceTitle: '委托与熔铸' } : panel === 'supplies' ? { serviceTitle: '休整与兑换' } : {}),
    ...(SHOP_LAYOUT[panel] === undefined ? {} : { layout: SHOP_LAYOUT[panel] }),
    ...shopGroups(panel, rows)
  };
}

type OwnedPanel = Exclude<HubCatalogPanel, 'supplies' | 'tasks'>;

/** Shared item descriptions with configuration actions, built only for owned entries. */
export function buildHubOwnedLoadoutCatalog(
  state: GameState,
  projectRow: (panel: OwnedPanel, id: string) => PanelProjection,
  projectMemoryAction: (equipmentId: EquipmentId, memory: EquipmentMemoryOptionViewModel) => ViewActionModel
): HubOwnedLoadoutViewModel {
  const owned: Record<OwnedPanel, ReadonlySet<string>> = {
    equipment: new Set(state.ownedEquipment),
    pets: new Set(state.ownedPets),
    methods: new Set(state.learnedMethods),
    bloodlines: new Set(BLOODLINE_CATALOG.filter(bloodline => (state.bloodlineRanks[bloodline.id] ?? 0) > 0).map(bloodline => bloodline.id)),
    companions: new Set(state.ownedCompanions)
  };
  const category: Record<Exclude<OwnedPanel, 'equipment'>, string> = {
    pets: '灵宠', methods: '功法', bloodlines: '血统', companions: '同伴'
  };
  const rows = (Object.keys(owned) as OwnedPanel[]).flatMap(panel => buildHubRows(
    state,
    panel,
    id => projectRow(panel, id),
    {
      ids: owned[panel],
      actions: (id, view) => {
        // A piece already worn has nothing to press; its row only shows that it is worn.
        const worn = panel === 'equipment' && Object.values(state.equipped).includes(id as EquipmentId);
        const actions = view.actions
          .filter(action => action.actionId.startsWith(`hub.${panel}.${panel === 'equipment' ? 'equip' : 'activate'}:`))
          .filter(action => !worn || !action.actionId.startsWith('hub.equipment.equip:'))
          .map(action => ({ ...action, actionId: `${action.actionId}::owned/${panel}/${id}` }));
        if (panel === 'equipment') {
          actions.push(...(view.equipmentMemory?.unlockedMemories ?? []).map(memory => projectMemoryAction(id as EquipmentId, memory)));
        }
        return actions;
      }
    }
  ).map(row => ({
    ...row,
    id: `${panel}/${row.id}`,
    category: panel === 'equipment' ? row.category : category[panel]
  })));
  return { rows };
}
