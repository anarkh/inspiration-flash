import {
  buyEquipment,
  buyPet,
  DUNGEONS,
  DUNGEON_ORDER,
  equipEquipment,
  EQUIPMENT,
  getDungeonReadiness,
  getPlayerPower,
  ITEMS,
  learnMethod,
  METHODS,
  PETS,
  type Cost,
  type DungeonId,
  type DungeonReadiness,
  type EquipmentId,
  type GameState,
  type ItemId,
  type MethodId,
  type PetId
} from './game';

export type ReadinessChange = {
  dungeonId: DungeonId;
  before: DungeonReadiness;
  after: DungeonReadiness;
};

export type ShopAdvice = {
  powerDelta: number;
  readinessChanges: ReadinessChange[];
  recommendedForDungeonIds: DungeonId[];
  reasonText: string;
  affordabilityText: string;
};

export type ShopAdviceKind = 'equipment' | 'method' | 'pet' | 'item';

const DUNGEON_REASON_MAP: Partial<Record<EquipmentId | MethodId | PetId | ItemId, DungeonId[]>> = {
  armor_piercing_sword: ['demon_tower_1', 'starfall_mine'],
  bone_spear: ['demon_tower_1', 'metro_abyss'],
  ember_staff: ['metro_abyss', 'rust_hospital'],
  mist_hood: ['demon_tower_1', 'dream_archive'],
  spirit_robe: ['demon_tower_1', 'rust_hospital'],
  guardian_plate: ['rust_hospital', 'ash_arena'],
  guardian_gauntlets: ['rust_hospital', 'ash_arena'],
  cloudstep_boots: ['metro_abyss', 'ash_arena'],
  rift_belt: ['metro_abyss', 'void_citadel'],
  cloudstep_charm: ['metro_abyss', 'ash_arena'],
  rift_charm: ['metro_abyss', 'starfall_mine'],
  starforged_edge: ['starfall_mine', 'ash_arena', 'void_citadel'],
  void_lantern: ['dream_archive', 'void_citadel'],
  chronal_edge: ['temporal_observatory'],
  chronal_aegis: ['temporal_observatory'],
  chronal_lens: ['temporal_observatory'],
  causal_visor: ['causal_clearinghouse'],
  echo_breaker_gauntlets: ['causal_clearinghouse'],
  return_anchor_belt: ['causal_clearinghouse'],
  entropy_compass: ['entropy_ark'],
  dissipation_mantle: ['entropy_ark'],
  ark_keel_boots: ['entropy_ark'],
  parallax_visor: ['mirror_cycle_city'],
  phaseweave_mantle: ['mirror_cycle_city'],
  homecoming_prism: ['mirror_cycle_city'],
  redline_edge: ['redaction_scriptorium'],
  palimpsest_mantle: ['redaction_scriptorium'],
  final_proof_seal: ['redaction_scriptorium'],
  legacy_gavel: ['legacy_auction_court'],
  anonymous_veil: ['legacy_auction_court'],
  escrow_plate: ['legacy_auction_court'],
  final_lot_bell: ['legacy_auction_court'],
  helix_cleaver: ['genesis_vault'],
  symbiote_cowl: ['genesis_vault'],
  carapace_harness: ['genesis_vault'],
  rebirth_amulet: ['genesis_vault'],
  hushblade: ['silent_broadcast_tower'],
  dead_air_headset: ['silent_broadcast_tower'],
  anechoic_mantle: ['silent_broadcast_tower'],
  last_channel_beacon: ['silent_broadcast_tower'],
  rescue_carbine: ['lost_shelter'],
  triage_visor: ['lost_shelter'],
  evacuation_plate: ['lost_shelter'],
  blackbox_beacon: ['lost_shelter'],
  cross_examiner_sabre: ['false_testimony_court'],
  forensic_visor: ['false_testimony_court'],
  custody_shell: ['false_testimony_court'],
  appeal_seal: ['false_testimony_court'],
  frame_engraver: ['combat_replay_stage'],
  cue_visor: ['combat_replay_stage'],
  buffer_plate: ['combat_replay_stage'],
  thaw_metronome: ['combat_replay_stage'],
  blindline_cutter: ['panopticon_city'],
  predictive_visor: ['panopticon_city'],
  matte_shell: ['panopticon_city'],
  inverse_prism: ['panopticon_city'],
  mist_breathing: ['demon_tower_1', 'metro_abyss', 'dream_archive'],
  iron_body: ['demon_tower_1', 'rust_hospital', 'ash_arena'],
  cloud_step: ['metro_abyss', 'ash_arena'],
  gate_sense: ['metro_abyss', 'starfall_mine', 'void_citadel'],
  star_core_method: ['starfall_mine', 'dream_archive', 'void_citadel'],
  beast_taming: ['demon_tower_1', 'starfall_mine'],
  void_heart: ['dream_archive', 'void_citadel'],
  contract_sprite: ['demon_tower_1', 'metro_abyss'],
  mist_kitten: ['demon_tower_1', 'rust_hospital'],
  ash_hound: ['starfall_mine', 'ash_arena'],
  mirror_moth: ['metro_abyss', 'dream_archive'],
  starling_drone: ['starfall_mine', 'dream_archive'],
  void_whelp: ['starfall_mine', 'void_citadel'],
  healing_pill: ['panopticon_city', 'demon_tower_1', 'rust_hospital', 'ash_arena', 'lost_shelter', 'false_testimony_court'],
  thunder_talisman: ['demon_tower_1', 'starfall_mine'],
  dispel_talisman: ['panopticon_city', 'demon_tower_1', 'rust_hospital', 'dream_archive', 'lost_shelter', 'false_testimony_court'],
  gate_sigil: ['metro_abyss', 'starfall_mine', 'void_citadel'],
  echo_coin: ['metro_abyss', 'starfall_mine'],
  capture_net: ['demon_tower_1', 'metro_abyss'],
  spirit_bait: ['starfall_mine', 'void_citadel'],
  armor_patch: ['panopticon_city', 'demon_tower_1', 'ash_arena', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court'],
  focus_incense: ['panopticon_city', 'rust_hospital', 'dream_archive', 'genesis_vault', 'silent_broadcast_tower', 'lost_shelter', 'false_testimony_court'],
  chronal_glass: ['temporal_observatory'],
  causal_seal: ['causal_clearinghouse'],
  entropy_crystal: ['entropy_ark'],
  phase_glass: ['mirror_cycle_city'],
  redaction_ink: ['redaction_scriptorium'],
  legacy_scrip: ['legacy_auction_court'],
  genesis_serum: ['genesis_vault'],
  silence_core: ['silent_broadcast_tower'],
  rescue_badge: ['lost_shelter'],
  truth_fragment: ['false_testimony_court'],
  combat_reel: ['combat_replay_stage'],
  observation_shard: ['panopticon_city']
};

const ITEM_USE_TEXT: Partial<Record<ItemId, string>> = {
  healing_pill: '战斗续航道具，能把一次失误从退场拉回可继续探索。',
  thunder_talisman: '稳定补伤害，适合快速压低高防或偏移怪的血线。',
  dispel_talisman: '破禁符专门抵消陷阱，适合机关、符文、幻觉密集路线。',
  gate_sigil: '小界门符稳定传送门，减少裂隙反噬，方便推进分支副本。',
  echo_coin: '传送收益道具，适合刷传送路线时补奖励点。',
  capture_net: '缚灵网开启捕获宠物路线，先从妖塔和镜潮类目标练手。',
  spirit_bait: '灵饵服务高阶捕获路线，尤其适合矿井和裂隙宠物。',
  armor_patch: '护甲补片是临时承伤保险，挑战高攻怪前收益明显。',
  focus_incense: '定神香提高陷阱感知，能让幻觉和机关路线更稳定。',
  chronal_glass: '时序玻璃是时序装备的淬炼与兑换材料，主要从时序观测庭获取。',
  causal_seal: '因果印章是 Tier 9 装备的淬炼与兑换材料，主要从因果清算所获取。',
  entropy_crystal: '熵晶是 Tier 10 装备的淬炼与兑换材料，用于熵航罗盘、耗散披甲与方舟龙骨靴，主要从熵舱方舟获取。',
  phase_glass: '相位镜晶是 Tier 11 装备的淬炼与兑换材料，用于视差面甲、相织披风与归真棱镜，主要从镜海轮回城获取。',
  redaction_ink: `删界墨是 Tier 12 装备的淬炼与兑换材料，用于${EQUIPMENT.redline_edge.name}、${EQUIPMENT.palimpsest_mantle.name}与${EQUIPMENT.final_proof_seal.name}，主要从删界终稿院获取。`,
  legacy_scrip: `遗产筹码是 Tier 13 装备的淬炼与兑换材料，用于${EQUIPMENT.legacy_gavel.name}、${EQUIPMENT.anonymous_veil.name}、${EQUIPMENT.escrow_plate.name}与${EQUIPMENT.final_lot_bell.name}，主要从亡队遗产拍卖庭获取。`,
  genesis_serum: `原型血清是 Tier 14 血统养成与成熟装备兑换材料，用于${EQUIPMENT.helix_cleaver.name}、${EQUIPMENT.symbiote_cowl.name}、${EQUIPMENT.carapace_harness.name}与${EQUIPMENT.rebirth_amulet.name}，主要从众生原型库探索与失控原型收容中获取。`,
  silence_core: `静默晶核是 Tier 15 装备的淬炼与兑换材料，用于${EQUIPMENT.hushblade.name}、${EQUIPMENT.dead_air_headset.name}、${EQUIPMENT.anechoic_mantle.name}与${EQUIPMENT.last_channel_beacon.name}，只能从寂声广播塔探索与广播守卫收容中获取。`,
  rescue_badge: `救援铭牌是 Tier 16 装备的淬炼与兑换材料，用于${EQUIPMENT.rescue_carbine.name}、${EQUIPMENT.triage_visor.name}、${EQUIPMENT.evacuation_plate.name}与${EQUIPMENT.blackbox_beacon.name}，只能从失联避难所探索与避难所执行体收容中获取。`,
  truth_fragment: `真证碎片是 Tier 17 装备的淬炼与兑换材料，用于${EQUIPMENT.cross_examiner_sabre.name}、${EQUIPMENT.forensic_visor.name}、${EQUIPMENT.custody_shell.name}与${EQUIPMENT.appeal_seal.name}，只能从伪证裁定庭的证据路线与档案删录官收容中获取。`,
  combat_reel: `战斗母带是 Tier 18 装备的淬炼与兑换材料，用于${EQUIPMENT.frame_engraver.name}、${EQUIPMENT.cue_visor.name}、${EQUIPMENT.buffer_plate.name}与${EQUIPMENT.thaw_metronome.name}，只能从战痕复演场的脚本与影片补给路线、连戏编辑收容中获取。`,
  observation_shard: `观测棱片是 Tier 19 装备的淬炼与兑换材料，用于${EQUIPMENT.blindline_cutter.name}、${EQUIPMENT.predictive_visor.name}、${EQUIPMENT.matte_shell.name}与${EQUIPMENT.inverse_prism.name}，只能从天幕监察城的盲区事件、折光调查与监察精英收容中获取。`
};

function canPay(state: GameState, cost: Cost = {}): boolean {
  return (
    state.rewardPoints >= (cost.rewardPoints ?? 0) &&
    state.lingyun >= (cost.lingyun ?? 0) &&
    Object.entries(cost.items ?? {}).every(([itemId, amount]) => state.inventory[itemId as ItemId] >= amount)
  );
}

function getReadinessChanges(before: GameState, after: GameState): ReadinessChange[] {
  return DUNGEON_ORDER.map((dungeonId) => ({
    dungeonId,
    before: getDungeonReadiness(before, dungeonId),
    after: getDungeonReadiness(after, dungeonId)
  })).filter((change) => change.before !== change.after);
}

function uniqueDungeonIds(dungeonIds: DungeonId[]): DungeonId[] {
  return DUNGEON_ORDER.filter((dungeonId) => dungeonIds.includes(dungeonId));
}

function recommendations(itemId: EquipmentId | MethodId | PetId | ItemId, changes: ReadinessChange[]): DungeonId[] {
  const mapped = uniqueDungeonIds(DUNGEON_REASON_MAP[itemId] ?? []);
  const improved = uniqueDungeonIds(changes.map((change) => change.dungeonId)).filter(
    (dungeonId) => !mapped.includes(dungeonId)
  );

  // Explicit encounter counters stay visible even when a purchase crosses several readiness thresholds.
  return [...mapped, ...improved].slice(0, 7);
}

function formatDungeonList(dungeonIds: DungeonId[]): string {
  return dungeonIds.map((dungeonId) => DUNGEONS[dungeonId].name).join('、');
}

function buildAdvice({
  before,
  after,
  id,
  reasonText,
  affordabilityText
}: {
  before: GameState;
  after: GameState;
  id: EquipmentId | MethodId | PetId | ItemId;
  reasonText: string;
  affordabilityText: string;
}): ShopAdvice {
  const readinessChanges = getReadinessChanges(before, after);
  const recommendedForDungeonIds = recommendations(id, readinessChanges);

  return {
    powerDelta: Math.max(0, getPlayerPower(after) - getPlayerPower(before)),
    readinessChanges,
    recommendedForDungeonIds,
    reasonText: recommendedForDungeonIds.length > 0 ? `${reasonText} 推荐用于：${formatDungeonList(recommendedForDungeonIds)}。` : reasonText,
    affordabilityText
  };
}

export function getEquipmentPurchaseAdvice(state: GameState, equipmentId: EquipmentId): ShopAdvice {
  const equipment = EQUIPMENT[equipmentId];
  const owned = state.ownedEquipment.includes(equipmentId);
  const affordable = canPay(state, equipment.cost);
  const after = owned ? state : equipEquipment(buyEquipment(state, equipmentId), equipmentId);
  const affordabilityText = owned ? `已拥有${equipment.name}。` : affordable ? `资源足够，可兑换${equipment.name}。` : `资源不足，暂时买不起${equipment.name}。`;
  const powerHint = owned
    ? '已经在装备架中，可直接按当前配装决定是否装备。'
    : affordable
      ? '购买后会按槽位模拟立即装备来估算战力。'
      : '暂时买不起，先保留为成长目标。';

  return buildAdvice({
    before: state,
    after: affordable || owned ? after : state,
    id: equipmentId,
    reasonText: `${equipment.name}：${equipment.description}${powerHint}`,
    affordabilityText
  });
}

export function getMethodAdvice(state: GameState, methodId: MethodId): ShopAdvice {
  const method = METHODS[methodId];
  const learned = state.learnedMethods.includes(methodId);
  const affordable = canPay(state, method.cost);
  const after = learned || !affordable ? state : learnMethod(state, methodId);
  const affordabilityText = learned ? `已学习${method.name}。` : affordable ? `资源足够，可学习${method.name}。` : `资源不足，暂时学不了${method.name}。`;

  return buildAdvice({
    before: state,
    after,
    id: methodId,
    reasonText: `${method.name}：${method.description}${method.passive}`,
    affordabilityText
  });
}

export function getPetAdvice(state: GameState, petId: PetId): ShopAdvice {
  const pet = PETS[petId];
  const owned = state.ownedPets.includes(petId);
  const affordable = pet.cost ? canPay(state, pet.cost) : false;
  const canBuy = pet.source === 'shop' && Boolean(pet.cost) && affordable;
  const after = owned || !canBuy ? state : buyPet(state, petId);
  const routeText =
    pet.source === 'capture'
      ? `${pet.name}需要在副本中捕获，准备${ITEMS[pet.captureItem ?? 'capture_net'].name}后寻找对应目标。`
      : `${pet.name}签约后提供常驻属性和宠物位成长。`;
  const affordabilityText = owned ? `已拥有${pet.name}。` : canBuy ? `资源足够，可签约${pet.name}。` : pet.source === 'capture' ? `${pet.name}不能直接购买，需要捕获。` : `资源不足，暂时签不了${pet.name}。`;

  return buildAdvice({
    before: state,
    after,
    id: petId,
    reasonText: `${routeText}${pet.description}`,
    affordabilityText
  });
}

export function getItemAdvice(state: GameState, itemId: ItemId): ShopAdvice {
  const item = ITEMS[itemId];
  const affordable = item.cost ? canPay(state, item.cost) : false;
  const count = state.inventory[itemId];
  const affordabilityText = !item.cost
    ? `${item.name}主要来自副本掉落，商店不直接售卖。`
    : affordable
      ? count > 0
        ? `背包已有 ${count} 个，资源足够，可继续补货。`
        : `资源足够，可兑换${item.name}。`
      : `资源不足，暂时买不起${item.name}。`;

  return buildAdvice({
    before: state,
    after: state,
    id: itemId,
    reasonText: `${item.name}：${ITEM_USE_TEXT[itemId] ?? item.description}`,
    affordabilityText
  });
}

export function getShopAdvice(state: GameState, kind: ShopAdviceKind, id: EquipmentId | MethodId | PetId | ItemId): ShopAdvice {
  if (kind === 'equipment') return getEquipmentPurchaseAdvice(state, id as EquipmentId);
  if (kind === 'method') return getMethodAdvice(state, id as MethodId);
  if (kind === 'pet') return getPetAdvice(state, id as PetId);
  return getItemAdvice(state, id as ItemId);
}
