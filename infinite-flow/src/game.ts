import { getPlayerPowerFromLoadout, getReadinessFromPower } from './progression';
import type { ProgressionReadiness } from './progression';

import { applyMonsterCombatEffects } from './combat-effects';
import type { CombatDamageKind, CombatEffectAction, CombatEffectState } from './combat-effects';
import { COMBAT_FOCUS_MAX, normalizeCombatFocus, resolveCombatFocus } from './combat-focus';
import type { CombatFocus } from './combat-focus';
import { getCombatIntent } from './combat-intents';
import type { CombatIntent } from './combat-intents';
import {
  getEquipmentAttunementDefinition,
  getEquipmentAttunementOptions,
  getEquipmentAttunementResonanceProgress,
  getEquipmentTemperDefinition,
  getEquipmentTemperProgress,
  getEquipmentSystemBonus
} from './equipment-system';
import type {
  EquipmentAttunementDefinition,
  EquipmentAttunementId,
  EquipmentAttunementMap,
  EquipmentAttunementResonanceProgress,
  EquipmentSystemResult,
  EquipmentTemperMap,
  EquipmentTemperProgress
} from './equipment-system';
import {
  EQUIPMENT_MEMORY_EQUIPMENT_CATALOG,
  activateEquipmentMemory,
  applyEquipmentMemoryCombatFocusResolution,
  createEquipmentMemoryCombatState,
  createEquipmentMemoryHuntRunState,
  createEquipmentMemoryRunSnapshot,
  createPreparedEquipmentMemoryHunt,
  getEquipmentMemoryById,
  getEquipmentMemoryForDungeon,
  getEquipmentMemoryHuntDisplayStatus,
  getEquipmentMemoryHuntProgress,
  getEquipmentMemoryRunSnapshotMatch,
  normalizeEquipmentMemoryCombatState,
  normalizeEquipmentMemoryHuntRunState,
  normalizeEquipmentMemoryRunSnapshot,
  normalizePreparedEquipmentMemoryHunt,
  sanitizeEquipmentMemoryMap,
  settleEquipmentMemoryHuntRun,
  transitionEquipmentMemoryHuntEventOutcome,
  transitionEquipmentMemoryHuntNodeClear,
  unlockEquipmentMemory
} from './equipment-memory-hunts';
import type {
  EquipmentMemoryCombatState,
  EquipmentMemoryDefinition,
  EquipmentMemoryEquipmentId,
  EquipmentMemoryHuntDisplayStatus,
  EquipmentMemoryHuntProgress,
  EquipmentMemoryHuntRunOutcome,
  EquipmentMemoryHuntRunState,
  EquipmentMemoryHuntSettlement,
  EquipmentMemoryId,
  EquipmentMemoryMap,
  EquipmentMemoryRunSnapshot,
  EquipmentMemoryRunSnapshotMatch,
  PreparedEquipmentMemoryHunt
} from './equipment-memory-hunts';
import {
  EQUIPMENT_COMMISSION_COST,
  EQUIPMENT_COMMISSION_MATERIAL_REWARD,
  EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS,
  advanceEquipmentCommission,
  createEquipmentCommission,
  isEquipmentCommissionSealed as isCommissionEquipmentSealed
} from './equipment-commissions';
import type { EquipmentCommissionState } from './equipment-commissions';
import {
  EQUIPMENT_SOUL_SKILL_CATALOG,
  activateEquipmentSoulSkillRecharge,
  cancelEquipmentSoulSkillRecharge,
  consumeEquipmentSoulSkill,
  createEquipmentSoulSkillRunState,
  getEquipmentSoulSkillStatus,
  getSpentEquipmentSoulSkills,
  isEquipmentSoulSkillRunState,
  resolveEquipmentSoulSkillRecharge
} from './equipment-soul-skills';
import type {
  EquipmentSoulSkillDefinition,
  EquipmentSoulSkillId,
  EquipmentSoulSkillRunState,
  EquipmentSoulSkillStatus
} from './equipment-soul-skills';
import { getActiveEquipmentFieldRigs } from './equipment-field-rigs';
import type { EquipmentFieldRigDefinition } from './equipment-field-rigs';
import {
  getActiveEquipmentRelicConduits,
  getEquipmentRelicConduitFrameMatch
} from './equipment-relic-conduits';
import type {
  EquipmentRelicConduitDefinition,
  RelicConduitEquipmentId
} from './equipment-relic-conduits';
import {
  createTacticalLoadoutSnapshot,
  isTacticalItemCarried,
  isTacticalItemId,
  validateTacticalLoadout
} from './tactical-loadout';
import type {
  TacticalItemId,
  TacticalLoadoutSnapshot,
  TacticalLoadoutValidation
} from './tactical-loadout';
import { evaluateDirective, getDirectiveForDungeon } from './directive-system';
import type { DirectiveEvaluation } from './directive-system';
import { getCampaignProgress } from './campaign-progress';
import type { CampaignDungeonGate } from './campaign-progress';
import { evaluateTask, getMainlineRequirementText, getTaskById, getUnlockedDungeonIdsFromMainline } from './task-system';
import { evaluateEventOptions, getDungeonEvents, resolveDungeonEventChoice } from './dungeon-events';
import type { DungeonEvent, DungeonEventContext, DungeonEventRequirement, EvaluatedDungeonEventOption } from './dungeon-events';
import {
  addRunLoot,
  calculateRunEconomy,
  consumeRunLootItem,
  createEmptyRunLootBag,
  settleRunLoot
} from './run-economy';
import type { RunExitStatus, RunLootBag, RunLootSettlement } from './run-economy';
import {
  DUNGEON_MATERIAL_REWARDS,
  getDungeonLootOffer,
  getEquipmentRecipe
} from './dungeon-loot';
import {
  getBossCombatStats,
  getBossDefinition,
  getBossDefinitionForNode,
  getBossPhaseTransition,
  getBossSealProgress
} from './boss-system';
import type { BossDefinition, BossPhase, BossSealProgress } from './boss-system';
import {
  getCaptureCombatEffect,
  getConsumableCombatEffect,
  getEscapeOutcome,
  resolveCombatUtilityAction
} from './combat-mechanics';
import { getPetPassiveTags, getPetStatBonus, getPetUpgradeCost, PETS } from './pet-system';
import { getWeaponSkillDefinition, resolveWeaponSkill } from './weapon-skills';
import type { WeaponSkillDefinition, WeaponSkillResolution } from './weapon-skills';
import {
  consumeMirrorCityShell,
  consumeCausalCollectionSeal,
  createDungeonLawState,
  getBroadcastRelayStatus,
  getCausalLedgerStatus,
  getAuctionLotStatus,
  getDungeonLawDisplay,
  getDungeonLawModifiers,
  getEntropyHeadingStatus,
  getEscortCheckpointStatus,
  getFalseTestimonyStatus,
  getCombatReplayStatus,
  getPanopticonStatus,
  getGenesisSpliceStatus,
  getMirrorCityPhaseStatus,
  getMirrorCityShellStatus,
  getRedactionClauseStatus,
  isArchiveFeatureAvailable,
  normalizeDungeonLawState,
  advancePanopticonScan,
  resolveCausalLedgerChoice,
  resolveAuctionLotChoice,
  resolveBroadcastRelayChoice,
  resolveEntropyHeadingChoice,
  resolveEscortCheckpointChoice,
  resolveFalseTestimonyAccusation,
  recordCombatReplayTake as recordCombatReplayTakeLaw,
  selectCombatReplayRoute as selectCombatReplayRouteLaw,
  selectPanopticonRoute as selectPanopticonRouteLaw,
  resolveGenesisSpliceChoice,
  resolveMirrorCityPhaseChoice,
  resolveRedactionClauseChoice,
  signalCombatStarted,
  signalCombatVictory,
  signalDungeonEvent,
  signalFirstNodeClear
} from './dungeon-laws';
import type {
  ArchiveFeature,
  AuctionLotChoice,
  AuctionLotStatus,
  BroadcastEntryPassives,
  BroadcastRelayChoice,
  BroadcastRelayStatus,
  CausalLedgerChoice,
  CausalLedgerStatus,
  DungeonLawDisplayModel,
  DungeonLawModifierContext,
  DungeonLawModifiers,
  DungeonLawState,
  EntropyHeadingChoice,
  EntropyHeadingStatus,
  EscortCheckpointChoice,
  EscortCheckpointStatus,
  EscortEntryCompanion,
  EscortEntryGear,
  FalseTestimonyEntryGear,
  FalseTestimonyStatus,
  FalseTestimonySuspect,
  CombatReplayAction as LawCombatReplayAction,
  CombatReplayRoute as LawCombatReplayRoute,
  PanopticonEntryGear,
  PanopticonRoute as LawPanopticonRoute,
  GenesisGene,
  GenesisSpliceStatus,
  MirrorCityPhase,
  MirrorCityPhaseStatus,
  RedactionChoice,
  RedactionClauseStatus
} from './dungeon-laws';
import { getLegalAdjacentTargetIds, getRouteBlockReason, getRouteGateStatus } from './dungeon-routes';
import type { DungeonRouteGateStatus } from './dungeon-routes';
import {
  evaluateRunProtocolReward,
  getRunProtocolDefinition,
  getRunProtocolRequiredNodeIds,
  isRunProtocolAvailable,
  scaleRunProtocolRewardPoints,
  scaleMonsterForRunProtocol,
  scaleTrapForRunProtocol
} from './run-protocols';
import type { RunProtocolDefinition, RunProtocolId } from './run-protocols';
import {
  advanceRunPressureOnNodeClear,
  calculateRunPressureBonus,
  createRunPressureState,
  getRunPressureStatus,
  isRunPressureState,
  scaleMonsterForRunPressure,
  scaleTrapForRunPressure
} from './run-pressure';
import type { RunPressureState, RunPressureTier } from './run-pressure';
import {
  DEFAULT_RUN_RELIC_EFFECTS,
  RUN_RELIC_DEFINITIONS,
  RUN_RELIC_FRAME_DEFINITIONS,
  aggregateRunRelicEffects,
  createRunRelicState,
  generateRunRelicDraft,
  isRunRelicFrame,
  isRunRelicId,
  isRunRelicState,
  selectRunRelic
} from './run-relics';
import type {
  RunRelicEffects,
  RunRelicFrame,
  RunRelicId,
  RunRelicState
} from './run-relics';
import {
  FIELD_SURVEY_CATALOG,
  createFieldSurveyRunState,
  getFieldSurveyById,
  getFieldSurveyOptionStatus,
  getFieldSurveyHpDelta,
  isFieldSurveyRunState,
  markFieldSurveyResolved,
  resolveFieldSurveyReward
} from './field-surveys';
import type {
  FieldSurveyDefinition,
  FieldSurveyOption,
  FieldSurveyRunState
} from './field-surveys';
import {
  createEquipmentHuntRunState,
  getEquipmentHuntDefinition,
  getEquipmentHuntProgress,
  getEquipmentHuntTargetIds,
  isEquipmentHuntRunState,
  markEquipmentHuntPortalCrossed,
  normalizePreparedEquipmentHunt
} from './equipment-hunts';
import type {
  EquipmentHuntDefinition,
  EquipmentHuntRunState,
  PreparedEquipmentHunt
} from './equipment-hunts';
import {
  ROUTE_CONTRACT_CATALOG,
  createRouteContractRunState,
  discoverHiddenRouteContract,
  getRouteContractById,
  getRouteContractDisplayStatus,
  getRouteContractProgress,
  listRouteContracts,
  settleRouteContractRun,
  transitionRouteContractFirstClear
} from './route-contracts';
import type {
  RouteContractDefinition,
  RouteContractDisplayStatus,
  RouteContractProgress,
  RouteContractRunOutcome,
  RouteContractRunState,
  RouteContractSettlement
} from './route-contracts';
import {
  activateRunPursuit,
  advanceRunPursuit,
  carryRunPursuitThroughForcedPortal,
  createRunPursuitState,
  fuseRunPursuitAtBoss,
  getRunPursuitBossFusionPercent,
  getRunPursuitContactDamage,
  getRunPursuitDefinition,
  getRunPursuitDisplay,
  getRunPursuitProgress,
  normalizeRunPursuitState,
  repelRunPursuitAtStablePortal,
  settleRunPursuit
} from './run-pursuit';
import type {
  RunPursuitDefinition,
  RunPursuitDisplay,
  RunPursuitMaterialId,
  RunPursuitProgress,
  RunPursuitState
} from './run-pursuit';
import {
  COMPANION_RULES_VERSION,
  createCompanionRunSnapshot,
  getCompanionAssistEffect,
  getCompanionDefinition,
  getCompanionRecruitmentStatus,
  getCompanionUpgradeStatus,
  normalizeCompanionRunSnapshot
} from './companion-system';
import type {
  CompanionAssistEffect,
  CompanionDefinition,
  CompanionId,
  CompanionProgress,
  CompanionRank,
  CompanionRunSnapshot
} from './companion-system';
import {
  METHOD_CULTIVATION_RULES_VERSION,
  createMethodRunSnapshot,
  createMethodRunSnapshots,
  getMethodTechniqueDefinition,
  getMethodTechniqueEffect,
  getMethodUpgradeStatus,
  normalizeMethodCultivationProgress,
  normalizeMethodRunSnapshot,
  normalizeMethodRunSnapshots
} from './method-cultivation';
import type {
  MethodCultivationProgress,
  MethodRank,
  MethodRunSnapshot,
  MethodTechniqueDefinition,
  MethodTechniqueEffect
} from './method-cultivation';
import {
  BLOODLINE_RULES_VERSION,
  createBloodlineRunSnapshot,
  getBloodlineDefinition,
  getBloodlineStatBonus,
  getBloodlineSurgeEffect,
  getBloodlineUpgradeStatus,
  isBloodlineId,
  normalizeBloodlineProgress,
  normalizeBloodlineRunSnapshot
} from './bloodline-system';
import type {
  BloodlineId,
  BloodlineProgress,
  BloodlineRank,
  BloodlineRunSnapshot,
  BloodlineSurgeEffect
} from './bloodline-system';

export { PETS } from './pet-system';
export { ROUTE_CONTRACT_CATALOG, getRouteContractById, listRouteContracts };
export * from './equipment-memory-hunts';
export * from './run-pursuit';
export * from './companion-system';
export * from './method-cultivation';
export * from './bloodline-system';
export type {
  CausalLedgerChoice,
  CausalLedgerStatus,
  EntropyHeadingChoice,
  EntropyHeadingStatus,
  EscortCheckpointChoice,
  EscortCheckpointStatus,
  EscortEntryCompanion,
  EscortEntryGear,
  FalseTestimonyEntryGear,
  FalseTestimonyStatus,
  FalseTestimonySuspect,
  GenesisGene,
  GenesisSpliceStatus,
  MirrorCityPhase,
  MirrorCityPhaseStatus,
  RedactionChoice,
  RedactionClauseStatus,
  RouteContractDefinition,
  RouteContractDisplayStatus,
  RouteContractProgress,
  RouteContractRunState,
  RouteContractSettlement
};

import { DUNGEONS, DUNGEON_ORDER, MONSTERS } from './level-content';

export { DUNGEONS, DUNGEON_ORDER, MONSTERS };

export type Phase = 'hub' | 'explore' | 'combat' | 'result';
export type DungeonId =
  | 'demon_tower_1'
  | 'metro_abyss'
  | 'starfall_mine'
  | 'rust_hospital'
  | 'ash_arena'
  | 'dream_archive'
  | 'void_citadel'
  | 'temporal_observatory'
  | 'causal_clearinghouse'
  | 'entropy_ark'
  | 'mirror_cycle_city'
  | 'redaction_scriptorium'
  | 'legacy_auction_court'
  | 'genesis_vault'
  | 'silent_broadcast_tower'
  | 'lost_shelter'
  | 'false_testimony_court'
  | 'combat_replay_stage'
  | 'panopticon_city';
export type NodeType = 'monster' | 'trap' | 'portal' | 'reward' | 'exit';
export type ItemKind = 'combat' | 'trap' | 'portal' | 'material';
export const EQUIPMENT_SLOTS = ['weapon', 'head', 'armor', 'hands', 'feet', 'waist', 'charm'] as const;
export const DEFENSE_EQUIPMENT_SLOTS = ['head', 'armor', 'hands', 'feet', 'waist'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type CombatAction = 'attack' | 'art' | 'guard' | 'weapon_skill' | 'use_healing_pill' | 'use_thunder_talisman' | 'escape';
export type TrapChoice = 'counter' | 'risk' | 'auto';
export type PortalChoice = 'stabilize' | 'force' | 'auto';
export type DungeonReadiness = ProgressionReadiness;
export type FieldSurveyId = (typeof FIELD_SURVEY_CATALOG)[number]['id'];

export type EquipmentSoulSkillUseOptions = {
  targetNodeId?: string;
  portalChoice?: PortalChoice;
  itemId?: ItemId;
};

export type EquipmentSoulSkillActionStatus = EquipmentSoulSkillStatus & {
  definition: EquipmentSoulSkillDefinition;
  available: boolean;
  unavailableReason?: string;
  targetNodeIds: readonly string[];
  itemIds: readonly ItemId[];
  portalChoices: readonly Exclude<PortalChoice, 'auto'>[];
};

export type EquipmentSoulSkillRechargeStatus = {
  legacyDisabled: boolean;
  available: boolean;
  pending: boolean;
  used: boolean;
  rechargeId?: string;
  nodeId?: string;
  spentSkillIds: readonly EquipmentSoulSkillId[];
  unavailableReason?: string;
};

export type NodeDepartureBlockKind =
  | 'soul_recharge_pending'
  | 'equipment_offer'
  | 'relic_draft'
  | 'causal_ledger'
  | 'entropy_heading'
  | 'mirror_phase'
  | 'redaction_clause'
  | 'auction_lot'
  | 'genesis_splice'
  | 'broadcast_relay'
  | 'escort_checkpoint'
  | 'false_testimony_verdict'
  | 'panopticon_route'
  | 'uncleared_monster'
  | 'uncleared_trap';

export type NodeDepartureBlock = {
  kind: NodeDepartureBlockKind;
  message: string;
};

export const SOUL_RECHARGE_PENDING_BLOCK_MESSAGE = '器魂共鸣尚未完成，请先选择恢复技能或取消共鸣。';

export type ItemId =
  | 'healing_pill'
  | 'thunder_talisman'
  | 'dispel_talisman'
  | 'gate_sigil'
  | 'echo_coin'
  | 'capture_net'
  | 'spirit_bait'
  | 'armor_patch'
  | 'focus_incense'
  | 'demon_bone'
  | 'hidden_stone'
  | 'medicine_ash'
  | 'mirror_shell'
  | 'star_iron'
  | 'method_page'
  | 'cracked_core'
  | 'rift_dust'
  | 'chronal_glass'
  | 'cycle_imprint'
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

export type EquipmentId =
  | 'training_blade'
  | 'patched_headwrap'
  | 'patched_coat'
  | 'patched_gloves'
  | 'patched_boots'
  | 'patched_belt'
  | 'plain_charm'
  | 'armor_piercing_sword'
  | 'bone_spear'
  | 'ember_staff'
  | 'mist_hood'
  | 'spirit_robe'
  | 'guardian_plate'
  | 'guardian_gauntlets'
  | 'cloudstep_boots'
  | 'rift_belt'
  | 'cloudstep_charm'
  | 'rift_charm'
  | 'starforged_edge'
  | 'void_lantern'
  | 'chronal_edge'
  | 'chronal_aegis'
  | 'chronal_lens'
  | 'causal_visor'
  | 'echo_breaker_gauntlets'
  | 'return_anchor_belt'
  | 'entropy_compass'
  | 'dissipation_mantle'
  | 'ark_keel_boots'
  | 'parallax_visor'
  | 'phaseweave_mantle'
  | 'homecoming_prism'
  | 'redline_edge'
  | 'palimpsest_mantle'
  | 'final_proof_seal'
  | 'legacy_gavel'
  | 'anonymous_veil'
  | 'escrow_plate'
  | 'final_lot_bell'
  | 'helix_cleaver'
  | 'symbiote_cowl'
  | 'carapace_harness'
  | 'rebirth_amulet'
  | 'hushblade'
  | 'dead_air_headset'
  | 'anechoic_mantle'
  | 'last_channel_beacon'
  | 'rescue_carbine'
  | 'triage_visor'
  | 'evacuation_plate'
  | 'blackbox_beacon'
  | 'cross_examiner_sabre'
  | 'forensic_visor'
  | 'custody_shell'
  | 'appeal_seal'
  | 'frame_engraver'
  | 'cue_visor'
  | 'buffer_plate'
  | 'thaw_metronome'
  | 'blindline_cutter'
  | 'predictive_visor'
  | 'matte_shell'
  | 'inverse_prism';

export type ActiveEquipmentCommission = EquipmentCommissionState<EquipmentId, ItemId, DungeonId>;

export type MethodId = 'mist_breathing' | 'iron_body' | 'cloud_step' | 'gate_sense' | 'star_core_method' | 'beast_taming' | 'void_heart';
export type MonsterId =
  | 'fog_lesser_demon'
  | 'tower_butcher'
  | 'tide_boatman'
  | 'mirror_thread_spider'
  | 'rail_wraith'
  | 'mine_shell_guard'
  | 'spark_imp'
  | 'portal_molt_beast'
  | 'plague_orderly'
  | 'pulse_doctor'
  | 'ash_duelist'
  | 'furnace_judge'
  | 'paper_librarian'
  | 'dream_jailer'
  | 'void_knight'
  | 'main_god_echo'
  | 'clockwork_scout'
  | 'epoch_sentinel'
  | 'zero_hour_regent'
  | 'verdict_usher'
  | 'paradox_bailiff'
  | 'zero_sum_auditor'
  | 'entropy_deckhand'
  | 'dissipation_navigator'
  | 'last_helmsman'
  | 'parallax_hunter'
  | 'mirror_chorus'
  | 'nameless_reflection'
  | 'erasure_copyist'
  | 'palimpsest_censor'
  | 'last_redactor'
  | 'reserve_bailiff'
  | 'inheritance_mimic'
  | 'estate_auctioneer'
  | 'gene_stalker'
  | 'mutation_guardian'
  | 'primal_curator'
  | 'frequency_leech'
  | 'broadcast_warden'
  | 'dead_air_mimic'
  | 'last_broadcaster'
  | 'mimic_survivor'
  | 'shelter_enforcer'
  | 'evacuation_horror'
  | 'shelter_overseer'
  | 'hostile_witness'
  | 'archive_censor'
  | 'perjury_hound'
  | 'false_testimony_judge'
  | 'cue_stalker'
  | 'continuity_editor'
  | 'retake_double'
  | 'final_cut_director'
  | 'sweep_sentinel'
  | 'blindspot_auditor'
  | 'exposure_double'
  | 'all_sight_warden';

export type PetId = 'contract_sprite' | 'mist_kitten' | 'ash_hound' | 'mirror_moth' | 'starling_drone' | 'void_whelp';

export type CoreStats = {
  body: number;
  spirit: number;
  agility: number;
  luck: number;
};

export type DerivedStats = CoreStats & {
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
  trapCheck: number;
};

export type ItemDefinition = {
  id: ItemId;
  name: string;
  kind: ItemKind;
  description: string;
  cost?: Cost;
};

export type EquipmentDefinition = {
  id: EquipmentId;
  name: string;
  slot: EquipmentSlot;
  description: string;
  cost: Cost;
  base: Partial<DerivedStats>;
  perLevel: Partial<DerivedStats>;
  maxLevel: number;
};

export type MethodDefinition = {
  id: MethodId;
  name: string;
  description: string;
  cost: Cost;
  stats: Partial<CoreStats>;
  passive: string;
};

export type PetDefinition = {
  id: PetId;
  name: string;
  description: string;
  source: 'shop' | 'capture';
  cost?: Cost;
  captureFrom?: MonsterId;
  captureItem?: ItemId;
  bonus: Partial<DerivedStats>;
  perLevel: Partial<DerivedStats>;
  maxLevel: number;
};

export type MonsterDefinition = {
  id: MonsterId;
  name: string;
  dungeonId: DungeonId;
  maxHp: number;
  attack: number;
  artPower: number;
  defense: number;
  speed: number;
  rewardPoints: number;
  drop: Partial<Record<ItemId, number>>;
  ability: string;
  counter: string;
};

export type DungeonNode = {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  position: {
    x: number;
    y: number;
  };
  monsterId?: MonsterId;
  trap?: {
    damage: number;
    dc: number;
    counterItem?: ItemId;
  };
  portal?: {
    targetDungeonId: DungeonId;
    targetNodeId: string;
    stableItem?: ItemId;
  };
  equipmentHuntClueId?: EquipmentHuntDefinition['id'];
  fieldSurveyId?: FieldSurveyId;
  relicDraftId?: string;
  soulRechargeId?: string;
  reward?: RewardBundle & {
    methodBonus?: {
      methodId: MethodId;
      reward: RewardBundle;
      text: string;
    };
  };
};

export type DungeonDefinition = {
  id: DungeonId;
  name: string;
  tier: number;
  recommendedPower: number;
  theme: string;
  recommended: string;
  rewardPreview: string;
  grid: {
    width: number;
    height: number;
    startNodeId: string;
  };
  nodes: DungeonNode[];
};

export type RewardBundle = {
  rewardPoints?: number;
  lingyun?: number;
  items?: Partial<Record<ItemId, number>>;
};

export type Cost = RewardBundle;

export type EquipmentRecipePurchaseStatus = {
  dungeonId: DungeonId;
  equipmentId: EquipmentId;
  materialId: ItemId;
  materialAmount: number;
  cost: Cost;
  unlocked: boolean;
  affordable: boolean;
};

export type EquipmentCommissionCandidate = {
  readonly equipmentId: EquipmentId;
  readonly materialId: ItemId;
};

export type EquipmentCommissionStatus = {
  readonly active?: ActiveEquipmentCommission;
  readonly candidates: readonly EquipmentCommissionCandidate[];
  readonly cost: Cost;
  readonly requiredDungeonCount: number;
  readonly materialReward: number;
};

export type PlayerState = {
  hp: number;
  maxHp: number;
  base: CoreStats;
};

export type CycleImprintId =
  | 'mist_reverse_mark'
  | 'last_train_tide_mark'
  | 'star_vein_plumb_mark'
  | 'redline_triage_mark'
  | 'ember_verdict_mark'
  | 'lost_page_index_mark'
  | 'echo_balance_mark'
  | 'chronometer_entry_mark'
  | 'causal_docket_mark'
  | 'entropy_manifest_mark'
  | 'mirror_cycle_mark'
  | 'final_proof_mark'
  | 'hammer_chain_mark'
  | 'genesis_mosaic_mark'
  | 'last_broadcast_mark'
  | 'survivor_roll_call_mark'
  | 'cross_exam_verdict_mark'
  | 'script_projection_mark'
  | 'inverse_observation_mark';

export type RunProtocolSnapshot = {
  id: RunProtocolId;
  rulesVersion: 1;
};

export type DungeonEntryOptions = {
  flowVersion?: 2;
  hiddenTaskSeed?: number;
};

export type RunProtocolSettlement = {
  protocol: RunProtocolSnapshot;
  status: 'succeeded' | 'failed';
  bossDefeated: boolean;
  anchorCompletedBeforeBoss: boolean;
  baseRewardPoints: number;
  protocolRewardPoints: number;
  rewardPointBonus: number;
  cycleImprintGranted: boolean;
  materialReward?: {
    itemId: ItemId;
    amount: number;
  };
};

export type RunPressureSettlement = {
  readonly state: RunPressureState;
  readonly tier: RunPressureTier;
  readonly rewardPointBonus: number;
};

export type RunRelicSettlement = {
  readonly status: 'pending' | 'archived' | 'skipped' | 'lost';
  readonly frame?: RunRelicFrame;
  readonly acquiredIds: readonly RunRelicId[];
  readonly archivedRelicId?: RunRelicId;
};

export type EquipmentCommissionSettlement = {
  readonly status: 'advanced' | 'completed';
  readonly dungeonId: DungeonId;
  readonly equipmentIds: readonly [EquipmentId, EquipmentId];
  readonly targetMaterialId: ItemId;
  readonly completedDungeonIds: readonly DungeonId[];
  readonly rewardAmount: number;
};

export type RunPursuitSettlement = {
  readonly state: RunPursuitState;
  readonly reason: 'successful_exit' | 'retreat' | 'failure' | 'stable_portal' | 'forced_portal';
  readonly materialId: RunPursuitMaterialId;
  readonly rewarded: boolean;
};

export const COMBAT_REPLAY_TAKE_IDS = ['take_alpha', 'take_beta', 'take_gamma'] as const;
export type CombatReplayTakeId = (typeof COMBAT_REPLAY_TAKE_IDS)[number];
export type CombatReplayDirectAction = LawCombatReplayAction;
export type CombatReplayRoute = LawCombatReplayRoute;
export type PanopticonRoute = LawPanopticonRoute;

export type CombatReplayRecording = {
  readonly action: CombatReplayDirectAction;
  readonly observedValue: number;
  readonly replayValue: number;
};

export type CombatReplayEntryGear = {
  readonly frameEngraver: boolean;
  readonly cueVisor: boolean;
  readonly bufferPlate: boolean;
  readonly thawMetronome: boolean;
};

export type CombatReplayRunState = {
  readonly rulesVersion: 1;
  readonly recordings: Partial<Record<CombatReplayTakeId, CombatReplayRecording>>;
  readonly route?: CombatReplayRoute;
  readonly entryGear: CombatReplayEntryGear;
};

export type CombatReplayPending = {
  readonly takeId: CombatReplayTakeId;
  readonly multiplierPercent: number;
};

export type CombatReplayCombatState = {
  readonly rulesVersion: 1;
  readonly enabled: boolean;
  readonly cursor: 0 | 1 | 2 | 3;
  readonly buffer: number;
  readonly remainingBufferHits: 0 | 1 | 2;
  readonly firstBoostUsed: boolean;
  readonly route: CombatReplayRoute;
  readonly recordings: Partial<Record<CombatReplayTakeId, CombatReplayRecording>>;
  readonly entryGear: CombatReplayEntryGear;
  readonly boss: boolean;
  readonly pending?: CombatReplayPending;
};

export type DungeonRun = {
  entryFlowVersion?: 2;
  hiddenTaskSeed?: number;
  dungeonId: DungeonId;
  currentNodeId: string;
  clearedNodeIds: string[];
  captures: number;
  capturedPetIds: PetId[];
  usedItems: ItemId[];
  damageTaken: number;
  resolvedEventIds: string[];
  eventLog: string[];
  lootBag: RunLootBag<ItemId, EquipmentId>;
  lootOffersMade: number;
  tacticalLoadout?: TacticalLoadoutSnapshot;
  fieldSurveyState?: FieldSurveyRunState;
  equipmentHunt?: EquipmentHuntRunState;
  equipmentMemorySnapshot?: EquipmentMemoryRunSnapshot;
  equipmentMemoryHunt?: EquipmentMemoryHuntRunState;
  protocol?: RunProtocolSnapshot;
  pressureState?: RunPressureState;
  relicState?: RunRelicState;
  soulSkillState?: EquipmentSoulSkillRunState;
  relicConduitSourceEquipmentIds?: RelicConduitEquipmentId[];
  lawState?: DungeonLawState;
  broadcastEntryPassives?: BroadcastEntryPassives;
  escortEntryGear?: EscortEntryGear;
  falseTestimonyEntryGear?: FalseTestimonyEntryGear;
  routeContractState?: RouteContractRunState;
  pursuitState?: RunPursuitState;
  combatReplayState?: CombatReplayRunState;
  companionSnapshot?: CompanionRunSnapshot;
  methodSnapshots?: readonly MethodRunSnapshot[];
  methodSnapshot?: MethodRunSnapshot;
  bloodlineSnapshot?: BloodlineRunSnapshot;
  pendingEquipmentOffer?: PendingEquipmentOffer;
  lastLootSettlement?: RunLootSettlement<ItemId, EquipmentId>;
  lastProtocolSettlement?: RunProtocolSettlement;
  lastPressureSettlement?: RunPressureSettlement;
  lastRelicSettlement?: RunRelicSettlement;
  lastEquipmentCommissionSettlement?: EquipmentCommissionSettlement;
  lastRouteContractSettlement?: RouteContractSettlement;
  lastEquipmentMemoryHuntSettlement?: EquipmentMemoryHuntSettlement;
  lastPursuitSettlement?: RunPursuitSettlement;
};

export type PendingEquipmentOffer = {
  offerId: string;
  equipmentIds: EquipmentId[];
  guaranteedEquipmentId?: EquipmentId;
};

export type AvailableDungeonEvent = Omit<DungeonEvent, 'options'> & {
  options: EvaluatedDungeonEventOption[];
};

export type CombatState = {
  nodeId: string;
  monsterId: MonsterId;
  monsterHp: number;
  turn: number;
  guarding: boolean;
  companionAssistUsed?: boolean;
  methodTechniqueUsedIds?: MethodId[];
  methodTechniqueUsed?: boolean;
  bloodlineSurgeUsed?: boolean;
  bloodlineBarrier?: number;
  damageTakenAtStart?: number;
  weaponFocus?: CombatFocus;
  weaponSkillUsed?: boolean;
  bossPhase?: BossPhase;
  protocolAnchorCompletedBeforeBoss?: boolean;
  effects?: CombatEffectState;
  equipmentMemoryState?: EquipmentMemoryCombatState;
  combatReplayState?: CombatReplayCombatState;
  log: string[];
};

export type WeaponSkillStatus = {
  weaponId: EquipmentId;
  weaponName: string;
  definition?: WeaponSkillDefinition;
  resonance?: EquipmentAttunementResonanceProgress;
  currentFocus: CombatFocus;
  requiredFocus: CombatFocus;
  available: boolean;
  unavailableReason?: string;
};

export type GameState = {
  phase: Phase;
  rewardPoints: number;
  lingyun: number;
  player: PlayerState;
  inventory: Record<ItemId, number>;
  ownedEquipment: EquipmentId[];
  equipmentLevels: Partial<Record<EquipmentId, number>>;
  equipmentAttunements?: EquipmentAttunementMap;
  equipmentTemperRanks?: EquipmentTemperMap;
  equipmentMemories?: EquipmentMemoryMap;
  equipmentCommission?: ActiveEquipmentCommission;
  equipped: Record<EquipmentSlot, EquipmentId>;
  preparedItemIds?: TacticalItemId[];
  preparedRelicFrame?: RunRelicFrame;
  archivedRelicIds?: RunRelicId[];
  preparedRelicSeedId?: RunRelicId;
  preparedEquipmentHunt?: PreparedEquipmentHunt;
  preparedEquipmentMemoryHunt?: PreparedEquipmentMemoryHunt;
  learnedMethods: MethodId[];
  methodRanks: Partial<Record<MethodId, MethodRank>>;
  activeMethod?: MethodId;
  bloodlineRanks: Partial<Record<BloodlineId, BloodlineRank>>;
  activeBloodline?: BloodlineId;
  completedDungeonIds: DungeonId[];
  claimedDirectiveIds: string[];
  claimedTaskIds: string[];
  ownedPets: PetId[];
  petLevels: Partial<Record<PetId, number>>;
  activePet?: PetId;
  ownedCompanions: CompanionId[];
  companionRanks: Partial<Record<CompanionId, CompanionRank>>;
  activeCompanion?: CompanionId;
  run?: DungeonRun;
  combat?: CombatState;
  lastOutcome?: string;
  log: string[];
};

export const DEFAULT_PREPARED_TACTICAL_ITEM_IDS = [
  'healing_pill',
  'dispel_talisman',
  'gate_sigil'
] as const satisfies readonly TacticalItemId[];

export type TacticalLoadoutStatus = TacticalLoadoutValidation & {
  readonly preparedItemIds: readonly TacticalItemId[];
  readonly activeFieldRigs: readonly EquipmentFieldRigDefinition[];
  readonly usesDefaultPreparation: boolean;
  readonly runSnapshot?: TacticalLoadoutSnapshot;
  readonly legacyRunUnrestricted: boolean;
};

export type RunRelicPreparationStatus = {
  readonly preparedRelicFrame: RunRelicFrame;
  readonly archivedRelicIds: readonly RunRelicId[];
  readonly preparedRelicSeedId?: RunRelicId;
  readonly activeConduits: readonly EquipmentRelicConduitDefinition[];
  readonly matchingConduitSourceEquipmentIds: readonly RelicConduitEquipmentId[];
  readonly usesDefaultPreparation: boolean;
  readonly runState?: RunRelicState;
  readonly frozenConduitSourceEquipmentIds: readonly RelicConduitEquipmentId[];
  readonly legacyRunWithoutRelics: boolean;
};

export type FieldSurveyCostItemAvailability = {
  readonly itemId: ItemId;
  readonly required: number;
  readonly availableCount: number;
  readonly available: boolean;
  readonly reason?: 'sealed' | 'not_carried' | 'missing';
  readonly unavailableReason?: string;
};

export type FieldSurveyCostAvailability = {
  readonly available: boolean;
  readonly items: readonly FieldSurveyCostItemAvailability[];
  readonly unavailableReason?: string;
};

export type CurrentFieldSurveyOptionStatus = {
  readonly definition: FieldSurveyOption;
  readonly frozenSourceEquipmentIds: readonly EquipmentId[];
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly costAvailability: FieldSurveyCostAvailability;
};

export type CurrentFieldSurveyStatus = {
  readonly survey?: FieldSurveyDefinition;
  readonly legacyDisabled: boolean;
  readonly resolved: boolean;
  readonly options: readonly CurrentFieldSurveyOptionStatus[];
  readonly unavailableReason?: string;
};

export type EquipmentHuntClueStatus = {
  readonly nodeId: string;
  readonly title: string;
  readonly cleared: boolean;
};

export type EquipmentHuntPreparationStatus = {
  readonly dungeonId: DungeonId;
  readonly targetEquipmentIds: readonly EquipmentId[];
  readonly targetEquipmentId?: EquipmentId;
  readonly clueNodes: readonly EquipmentHuntClueStatus[];
};

export type CurrentEquipmentHuntStatus = {
  readonly enabled: boolean;
  readonly dungeonId?: DungeonId;
  readonly targetEquipmentId?: EquipmentId;
  readonly clueNodes: readonly EquipmentHuntClueStatus[];
  readonly cleared: boolean;
  readonly qualified: boolean;
  readonly crossed: boolean;
  readonly offer: boolean;
  readonly selected: boolean;
  readonly passed: boolean;
};

export type EquipmentMemoryHuntPreparationIssueCode =
  | 'chapter_memory_unavailable'
  | 'chapter_not_completed'
  | 'equipment_hunt_conflict'
  | 'unsupported_equipment'
  | 'not_owned'
  | 'not_equipped'
  | 'not_max_level'
  | 'invalid_attunement'
  | 'temper_rank_too_low'
  | 'sealed'
  | 'already_unlocked'
  | 'no_eligible_equipment';

export type EquipmentMemoryHuntPreparationIssue = {
  readonly code: EquipmentMemoryHuntPreparationIssueCode;
  readonly message: string;
};

export type EquipmentMemoryHuntCandidateStatus = {
  readonly equipmentId: EquipmentMemoryEquipmentId;
  readonly equipment: EquipmentDefinition;
  readonly owned: boolean;
  readonly equipped: boolean;
  readonly currentLevel: number;
  readonly maxLevel: number;
  readonly attunementId?: EquipmentAttunementId;
  readonly attunement?: EquipmentAttunementDefinition;
  readonly temperRank: number;
  readonly sealed: boolean;
  readonly memoryUnlocked: boolean;
  readonly available: boolean;
  readonly unavailableReasons: readonly EquipmentMemoryHuntPreparationIssue[];
  readonly unavailableReason?: string;
};

export type EquipmentMemoryHuntPreparationStatus = {
  readonly dungeonId: DungeonId;
  readonly definition?: EquipmentMemoryDefinition;
  readonly memory?: EquipmentMemoryDefinition;
  readonly candidates: readonly EquipmentMemoryHuntCandidateStatus[];
  readonly targetEquipmentIds: readonly EquipmentMemoryEquipmentId[];
  readonly prepared?: PreparedEquipmentMemoryHunt;
  readonly currentPrepared?: PreparedEquipmentMemoryHunt;
  readonly preparedCandidate?: EquipmentMemoryHuntCandidateStatus;
  readonly equipmentHuntConflict: boolean;
  readonly conflictingEquipmentHunt?: PreparedEquipmentHunt;
  readonly available: boolean;
  readonly unavailableReasons: readonly EquipmentMemoryHuntPreparationIssue[];
  readonly unavailableReason?: string;
};

export type EquipmentMemoryStatus = {
  readonly equipmentId: EquipmentId;
  readonly equipment: EquipmentDefinition;
  readonly supported: boolean;
  readonly owned: boolean;
  readonly equipped: boolean;
  readonly unlockedMemories: readonly EquipmentMemoryDefinition[];
  readonly activeMemory?: EquipmentMemoryDefinition;
};

export type CurrentEquipmentMemoryHuntStatus = {
  readonly enabled: boolean;
  readonly legacyDisabled: boolean;
  readonly malformedDisabled: boolean;
  readonly state?: EquipmentMemoryHuntRunState;
  readonly definition?: EquipmentMemoryDefinition;
  readonly equipment?: EquipmentDefinition;
  readonly attunement?: EquipmentAttunementDefinition;
  readonly progress: EquipmentMemoryHuntProgress;
  readonly display: EquipmentMemoryHuntDisplayStatus;
  readonly settlement?: EquipmentMemoryHuntSettlement;
};

export type CurrentEquipmentMemoryCombatStatus = {
  readonly enabled: boolean;
  readonly legacyDisabled: boolean;
  readonly malformedDisabled: boolean;
  readonly state?: EquipmentMemoryCombatState;
  readonly definition?: EquipmentMemoryDefinition;
  readonly activeName?: string;
  readonly snapshotMatch?: EquipmentMemoryRunSnapshotMatch;
  readonly matchingEquipmentIds: readonly EquipmentMemoryEquipmentId[];
  readonly overflowStored: boolean;
  readonly restored: boolean;
};

export const ITEM_IDS: ItemId[] = [
  'healing_pill',
  'thunder_talisman',
  'dispel_talisman',
  'gate_sigil',
  'echo_coin',
  'capture_net',
  'spirit_bait',
  'armor_patch',
  'focus_incense',
  'demon_bone',
  'hidden_stone',
  'medicine_ash',
  'mirror_shell',
  'star_iron',
  'method_page',
  'cracked_core',
  'rift_dust',
  'chronal_glass',
  'cycle_imprint',
  'causal_seal',
  'entropy_crystal',
  'phase_glass',
  'redaction_ink',
  'legacy_scrip',
  'genesis_serum',
  'silence_core',
  'rescue_badge',
  'truth_fragment',
  'combat_reel',
  'observation_shard'
];

export const ITEMS: Record<ItemId, ItemDefinition> = {
  healing_pill: {
    id: 'healing_pill',
    name: '止血丹',
    kind: 'combat',
    description: '战斗中回复 36 点生命。',
    cost: { rewardPoints: 180 }
  },
  thunder_talisman: {
    id: 'thunder_talisman',
    name: '雷火符',
    kind: 'combat',
    description: '战斗中造成一段稳定术法伤害。',
    cost: { rewardPoints: 320 }
  },
  dispel_talisman: {
    id: 'dispel_talisman',
    name: '破禁符',
    kind: 'trap',
    description: '抵消一次符文或机关陷阱。',
    cost: { rewardPoints: 240 }
  },
  gate_sigil: {
    id: 'gate_sigil',
    name: '小界门符',
    kind: 'portal',
    description: '稳定一次传送门，避免裂隙反噬。',
    cost: { rewardPoints: 220 }
  },
  echo_coin: {
    id: 'echo_coin',
    name: '回响铜币',
    kind: 'portal',
    description: '传送后让主神额外结算少量奖励点。',
    cost: { rewardPoints: 160 }
  },
  capture_net: {
    id: 'capture_net',
    name: '缚灵网',
    kind: 'combat',
    description: '战斗中捕获低血量可驯化目标。',
    cost: { rewardPoints: 210 }
  },
  spirit_bait: {
    id: 'spirit_bait',
    name: '灵饵',
    kind: 'combat',
    description: '提高宠物捕获成功率，首版用于高阶捕获门槛。',
    cost: { rewardPoints: 180 }
  },
  armor_patch: {
    id: 'armor_patch',
    name: '护甲补片',
    kind: 'combat',
    description: '战斗前临时加固护甲，适合挑战高攻怪。',
    cost: { rewardPoints: 140 }
  },
  focus_incense: {
    id: 'focus_incense',
    name: '定神香',
    kind: 'trap',
    description: '提高一次陷阱感知，幻觉类副本更稳定。',
    cost: { rewardPoints: 150 }
  },
  demon_bone: {
    id: 'demon_bone',
    name: '妖骨',
    kind: 'material',
    description: '锻造穿甲类武器的材料。'
  },
  hidden_stone: {
    id: 'hidden_stone',
    name: '雾后石',
    kind: 'material',
    description: '隐藏路线中找到的阵石。'
  },
  medicine_ash: {
    id: 'medicine_ash',
    name: '药炉灰',
    kind: 'material',
    description: '药庐残炉里刮下的灰烬。'
  },
  mirror_shell: {
    id: 'mirror_shell',
    name: '镜潮贝',
    kind: 'material',
    description: '能映出第二条路线的贝壳。'
  },
  star_iron: {
    id: 'star_iron',
    name: '星铁',
    kind: 'material',
    description: '陨星矿脉产出的高阶锻材。'
  },
  method_page: {
    id: 'method_page',
    name: '功法残页',
    kind: 'material',
    description: '记着残缺行气路线的纸页。'
  },
  cracked_core: {
    id: 'cracked_core',
    name: '裂核',
    kind: 'material',
    description: '传送兽体内取出的不稳定核心。'
  },
  rift_dust: {
    id: 'rift_dust',
    name: '裂隙尘',
    kind: 'material',
    description: '传送门边缘剥落的银色粉尘。'
  },
  chronal_glass: {
    id: 'chronal_glass',
    name: '时序玻璃',
    kind: 'material',
    description: '时序观测庭中析出的透明锻材，会映出物体片刻前后的轮廓。'
  },
  cycle_imprint: {
    id: 'cycle_imprint',
    name: '轮回刻印',
    kind: 'material',
    description: '完成轮回协议后凝成的铭刻材料，只在协议成功结算时产出。'
  },
  causal_seal: {
    id: 'causal_seal',
    name: '因果印章',
    kind: 'material',
    description: '因果清算所签发的裁定印章，可用于锻造承受因果反噬的装备。'
  },
  entropy_crystal: {
    id: 'entropy_crystal',
    name: '熵晶',
    kind: 'material',
    description: '方舟失序航迹析出的稳定结晶。'
  },
  phase_glass: {
    id: 'phase_glass',
    name: '相位镜晶',
    kind: 'material',
    description: '镜海轮回城中析出的双相锻材，只能在副本中获得。'
  },
  redaction_ink: {
    id: 'redaction_ink',
    name: '删界墨',
    kind: 'material',
    description: '删界终稿院用于核准正文与删除废稿的终局锻材，只能在副本中获得。'
  },
  legacy_scrip: {
    id: 'legacy_scrip',
    name: '遗产筹码',
    kind: 'material',
    description: '亡队遗产拍卖庭只认本轮取得的无记名筹码，无法从主神空间购买。'
  },
  genesis_serum: {
    id: 'genesis_serum',
    name: '原型血清',
    kind: 'material',
    description: '众生原型库析出的活性拼接介质，只能在副本中取得，主神空间不直接出售。'
  },
  silence_core: {
    id: 'silence_core',
    name: '静默晶核',
    kind: 'material',
    description: '寂声广播塔凝结的断频核心，只能在副本中取得，主神空间不直接出售。'
  },
  rescue_badge: {
    id: 'rescue_badge',
    name: '救援铭牌',
    kind: 'material',
    description: '失联避难所幸存者留下的救援凭证，只能在副本中取得，主神空间不直接出售。'
  },
  truth_fragment: {
    id: 'truth_fragment',
    name: '真证碎片',
    kind: 'material',
    description: '伪证裁定庭中从原始证据链剥离的真证残片，只能在副本中取得，主神空间不直接出售。'
  },
  combat_reel: {
    id: 'combat_reel',
    name: '战斗母带',
    kind: 'material',
    description: '战痕复演场定格成功战斗动作后析出的复演介质，只能在副本中取得。'
  },
  observation_shard: {
    id: 'observation_shard',
    name: '观测棱片',
    kind: 'material',
    description: '天幕监察城从三相扫描盲区中析出的观测介质，只能在副本中取得。'
  }
};

export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  training_blade: {
    id: 'training_blade',
    name: '训练短刃',
    slot: 'weapon',
    description: '主神免费发放的基础武器。',
    cost: {},
    base: { attack: 4 },
    perLevel: {},
    maxLevel: 1
  },
  patched_headwrap: {
    id: 'patched_headwrap',
    name: '拼缝头巾',
    slot: 'head',
    description: '最基础的头部防护，能挡住飞溅碎片。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_coat: {
    id: 'patched_coat',
    name: '拼缝护衣',
    slot: 'armor',
    description: '勉强能挡住第一波撕咬。',
    cost: {},
    base: { maxHp: 10, defense: 2 },
    perLevel: {},
    maxLevel: 1
  },
  patched_gloves: {
    id: 'patched_gloves',
    name: '拼缝护手',
    slot: 'hands',
    description: '粗布和旧皮缝成的护手，至少能握稳武器。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_boots: {
    id: 'patched_boots',
    name: '拼缝短靴',
    slot: 'feet',
    description: '鞋底贴了薄铁片，跑过碎石地时不至于立刻见血。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  patched_belt: {
    id: 'patched_belt',
    name: '拼缝束带',
    slot: 'waist',
    description: '把补给和护片束在腰间，提供一点稳定承伤。',
    cost: {},
    base: {},
    perLevel: {},
    maxLevel: 1
  },
  plain_charm: {
    id: 'plain_charm',
    name: '空白护符',
    slot: 'charm',
    description: '没有刻纹，但能稳定心神。',
    cost: {},
    base: { artPower: 1 },
    perLevel: {},
    maxLevel: 1
  },
  armor_piercing_sword: {
    id: 'armor_piercing_sword',
    name: '破甲剑',
    slot: 'weapon',
    description: '对厚甲怪和矿壳守卫有额外威慑。',
    cost: { rewardPoints: 260 },
    base: { attack: 9, speed: 1 },
    perLevel: { attack: 4 },
    maxLevel: 3
  },
  bone_spear: {
    id: 'bone_spear',
    name: '白骨长矛',
    slot: 'weapon',
    description: '用妖骨磨成的长兵器，牺牲稳定性换取速度。',
    cost: { rewardPoints: 340, items: { demon_bone: 1 } },
    base: { attack: 8, speed: 4 },
    perLevel: { attack: 3, speed: 1 },
    maxLevel: 3
  },
  ember_staff: {
    id: 'ember_staff',
    name: '灰烬短杖',
    slot: 'weapon',
    description: '药炉灰压进杖芯，强化术法输出。',
    cost: { rewardPoints: 360, items: { medicine_ash: 1 } },
    base: { attack: 4, artPower: 9 },
    perLevel: { artPower: 4 },
    maxLevel: 3
  },
  mist_hood: {
    id: 'mist_hood',
    name: '雾行兜帽',
    slot: 'head',
    description: '兜帽内侧缝着雾后石粉，能提前感到陷阱风向。',
    cost: { rewardPoints: 280 },
    base: { spirit: 1, speed: 1, trapCheck: 3 },
    perLevel: { speed: 1, trapCheck: 2 },
    maxLevel: 3
  },
  spirit_robe: {
    id: 'spirit_robe',
    name: '灵纹软甲',
    slot: 'armor',
    description: '把术法余波导入地面，适合探索陷阱密集的副本。',
    cost: { rewardPoints: 300 },
    base: { maxHp: 18, defense: 3, artPower: 2 },
    perLevel: { maxHp: 8, defense: 2 },
    maxLevel: 3
  },
  guardian_plate: {
    id: 'guardian_plate',
    name: '界卫胸甲',
    slot: 'armor',
    description: '沉重但可靠的胸甲，专门应对中后期高攻击怪物。',
    cost: { rewardPoints: 520, items: { star_iron: 1 } },
    base: { maxHp: 28, defense: 7, speed: -1 },
    perLevel: { maxHp: 10, defense: 3 },
    maxLevel: 3
  },
  guardian_gauntlets: {
    id: 'guardian_gauntlets',
    name: '界卫臂铠',
    slot: 'hands',
    description: '界卫胸甲同源的臂铠，格挡时会把冲击导向地面。',
    cost: { rewardPoints: 420 },
    base: { maxHp: 10, attack: 3, defense: 4 },
    perLevel: { attack: 2, defense: 2 },
    maxLevel: 3
  },
  cloudstep_boots: {
    id: 'cloudstep_boots',
    name: '云隙步靴',
    slot: 'feet',
    description: '鞋跟挂着轻响足铃，帮助你在裂隙边缘抢到先手。',
    cost: { rewardPoints: 380, lingyun: 1 },
    base: { agility: 1, speed: 5, trapCheck: 1 },
    perLevel: { speed: 3, trapCheck: 1 },
    maxLevel: 3
  },
  rift_belt: {
    id: 'rift_belt',
    name: '裂隙束带',
    slot: 'waist',
    description: '束带上的银色粉尘会在传送门附近发热。',
    cost: { rewardPoints: 460, items: { hidden_stone: 1 } },
    base: { spirit: 1, artPower: 3, defense: 2 },
    perLevel: { artPower: 2, defense: 1 },
    maxLevel: 3
  },
  cloudstep_charm: {
    id: 'cloudstep_charm',
    name: '云隙足铃',
    slot: 'charm',
    description: '让撤离和先手更可靠，适合高风险探索。',
    cost: { rewardPoints: 420, lingyun: 1 },
    base: { agility: 1, speed: 5 },
    perLevel: { speed: 3 },
    maxLevel: 3
  },
  rift_charm: {
    id: 'rift_charm',
    name: '裂隙护符',
    slot: 'charm',
    description: '让传送门奖励更稳定。',
    cost: { rewardPoints: 360, items: { hidden_stone: 1 } },
    base: { spirit: 1, artPower: 4 },
    perLevel: { artPower: 3 },
    maxLevel: 3
  },
  starforged_edge: {
    id: 'starforged_edge',
    name: '淬星剑胚',
    slot: 'weapon',
    description: '星坠矿井的目标装备，首版先作为高阶预览。',
    cost: { rewardPoints: 540, items: { star_iron: 1, method_page: 1 } },
    base: { attack: 15, artPower: 4 },
    perLevel: { attack: 5, artPower: 2 },
    maxLevel: 3
  },
  void_lantern: {
    id: 'void_lantern',
    name: '虚界灯',
    slot: 'charm',
    description: '高阶护符，稳定虚空副本中的观察和术法爆发。',
    cost: { rewardPoints: 680, lingyun: 2, items: { cracked_core: 1, rift_dust: 1 } },
    base: { spirit: 2, artPower: 10, defense: 2 },
    perLevel: { artPower: 5, defense: 1 },
    maxLevel: 3
  },
  chronal_edge: {
    id: 'chronal_edge',
    name: '时序刃',
    slot: 'weapon',
    description: '以时序玻璃校准锋线，让斩击同时落在目标的前一瞬与后一瞬。',
    cost: { rewardPoints: 720, lingyun: 2, items: { chronal_glass: 1, star_iron: 1 } },
    base: { attack: 17, artPower: 5 },
    perLevel: { attack: 5, artPower: 2 },
    maxLevel: 3
  },
  chronal_aegis: {
    id: 'chronal_aegis',
    name: '时序盾',
    slot: 'armor',
    description: '把承受的冲击延后分散，在观测庭的高压战斗中维持稳定。',
    cost: { rewardPoints: 700, lingyun: 2, items: { chronal_glass: 1, cracked_core: 1 } },
    base: { maxHp: 32, defense: 8 },
    perLevel: { maxHp: 12, defense: 3 },
    maxLevel: 3
  },
  chronal_lens: {
    id: 'chronal_lens',
    name: '时序透镜',
    slot: 'charm',
    description: '折叠近未来的观测结果，为术法落点提供一瞬先机。',
    cost: { rewardPoints: 760, lingyun: 2, items: { chronal_glass: 1, rift_dust: 1 } },
    base: { spirit: 2, artPower: 12, defense: 3 },
    perLevel: { artPower: 5, defense: 1 },
    maxLevel: 3
  },
  causal_visor: {
    id: 'causal_visor',
    name: '因果视镜',
    slot: 'head',
    description: '入场时冻结被动：本轮首次透支获得收益与治疗，但不会增加因果债务。',
    cost: { rewardPoints: 820, lingyun: 2, items: { causal_seal: 1, chronal_glass: 1 } },
    base: { spirit: 1, defense: 2, trapCheck: 4 },
    perLevel: { artPower: 2, trapCheck: 1 },
    maxLevel: 3
  },
  echo_breaker_gauntlets: {
    id: 'echo_breaker_gauntlets',
    name: '断响拳套',
    slot: 'hands',
    description: '入场时冻结被动：零和审计官锁定债务时少生成一枚追缴印。',
    cost: { rewardPoints: 840, lingyun: 2, items: { causal_seal: 1, rift_dust: 1 } },
    base: { attack: 4, artPower: 4, defense: 3 },
    perLevel: { attack: 2, artPower: 1 },
    maxLevel: 3
  },
  return_anchor_belt: {
    id: 'return_anchor_belt',
    name: '归航锚带',
    slot: 'waist',
    description: '入场时冻结被动：偿还因果债务的生命代价由最大生命 15% 降至 8%。',
    cost: { rewardPoints: 800, lingyun: 2, items: { causal_seal: 1, star_iron: 1 } },
    base: { maxHp: 16, defense: 4, speed: 1 },
    perLevel: { maxHp: 8, defense: 1 },
    maxLevel: 3
  },
  entropy_compass: {
    id: 'entropy_compass',
    name: '熵航罗盘',
    slot: 'charm',
    description: '入场时冻结被动：本局第一次由普通怪物或陷阱首次清理触发的自动升熵免除；玩家主动选择 rush/抢航产生的 +1 熵不免除。',
    cost: { rewardPoints: 920, lingyun: 3, items: { entropy_crystal: 1, chronal_glass: 1 } },
    base: { spirit: 2, artPower: 13, defense: 3 },
    perLevel: { artPower: 5, speed: 1 },
    maxLevel: 3
  },
  dissipation_mantle: {
    id: 'dissipation_mantle',
    name: '耗散披甲',
    slot: 'armor',
    description: '入场时冻结被动：稳航结算时降熵效果更强。',
    cost: { rewardPoints: 900, lingyun: 3, items: { entropy_crystal: 1, rift_dust: 1 } },
    base: { maxHp: 36, artPower: 4, defense: 8 },
    perLevel: { maxHp: 12, artPower: 2, defense: 2 },
    maxLevel: 3
  },
  ark_keel_boots: {
    id: 'ark_keel_boots',
    name: '方舟龙骨靴',
    slot: 'feet',
    description: '入场时冻结被动：Boss 战开始时崩解层数 -1。',
    cost: { rewardPoints: 880, lingyun: 3, items: { entropy_crystal: 1, star_iron: 1 } },
    base: { agility: 1, maxHp: 12, defense: 4, speed: 3 },
    perLevel: { maxHp: 8, defense: 2, speed: 1 },
    maxLevel: 3
  },
  parallax_visor: {
    id: 'parallax_visor',
    name: '视差面甲',
    slot: 'head',
    description: '入场时冻结被动：当前相位的错误伤害类型不再承受 -6% 输出惩罚。',
    cost: { rewardPoints: 980, lingyun: 3, items: { phase_glass: 1, chronal_glass: 1 } },
    base: { spirit: 2, defense: 4, trapCheck: 6 },
    perLevel: { artPower: 3, defense: 1, trapCheck: 2 },
    maxLevel: 3
  },
  phaseweave_mantle: {
    id: 'phaseweave_mantle',
    name: '相织披风',
    slot: 'armor',
    description: '入场时冻结被动：现实与镜像相位切换的生命代价由最大生命 10% 降至 5%。',
    cost: { rewardPoints: 1000, lingyun: 3, items: { phase_glass: 1, rift_dust: 1 } },
    base: { maxHp: 40, artPower: 6, defense: 9 },
    perLevel: { maxHp: 14, artPower: 2, defense: 3 },
    maxLevel: 3
  },
  homecoming_prism: {
    id: 'homecoming_prism',
    name: '归真棱镜',
    slot: 'charm',
    description: '入场时冻结被动：无名镜王生成的镜壳数量减少 1。',
    cost: { rewardPoints: 1020, lingyun: 3, items: { phase_glass: 1, star_iron: 1 } },
    base: { spirit: 2, artPower: 14, defense: 4 },
    perLevel: { artPower: 6, defense: 1 },
    maxLevel: 3
  },
  redline_edge: {
    id: 'redline_edge',
    name: '朱批断章刃',
    slot: 'weapon',
    description: '以朱批切开废稿边界，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1100, lingyun: 4, items: { redaction_ink: 1, phase_glass: 1 } },
    base: { attack: 20, artPower: 6 },
    perLevel: { attack: 6, artPower: 2 },
    maxLevel: 3
  },
  palimpsest_mantle: {
    id: 'palimpsest_mantle',
    name: '覆页披甲',
    slot: 'armor',
    description: '多层覆页把承伤记录分散到旧稿，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1080, lingyun: 4, items: { redaction_ink: 1, rift_dust: 1 } },
    base: { maxHp: 44, artPower: 7, defense: 10 },
    perLevel: { maxHp: 15, artPower: 2, defense: 3 },
    maxLevel: 3
  },
  final_proof_seal: {
    id: 'final_proof_seal',
    name: '终校印玺',
    slot: 'charm',
    description: '终校印面认证唯一有效版本，入场时冻结其与删界条款联动的终稿被动。',
    cost: { rewardPoints: 1120, lingyun: 4, items: { redaction_ink: 1, star_iron: 1 } },
    base: { spirit: 2, artPower: 16, defense: 5 },
    perLevel: { artPower: 6, defense: 2 },
    maxLevel: 3
  },
  legacy_gavel: {
    id: 'legacy_gavel',
    name: '亡队落槌',
    slot: 'weapon',
    description: '旧队长的落槌仍会替最后一次有效报价定音，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1240, lingyun: 4, items: { legacy_scrip: 1, star_iron: 1 } },
    base: { attack: 22, defense: 4 },
    perLevel: { attack: 6, defense: 2 },
    maxLevel: 3
  },
  anonymous_veil: {
    id: 'anonymous_veil',
    name: '无名竞标面',
    slot: 'head',
    description: '面纱抹去竞标者的旧队身份，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1200, lingyun: 4, items: { legacy_scrip: 1, phase_glass: 1 } },
    base: { spirit: 2, artPower: 12, speed: 2, trapCheck: 5 },
    perLevel: { artPower: 4, speed: 2, trapCheck: 1 },
    maxLevel: 3
  },
  escrow_plate: {
    id: 'escrow_plate',
    name: '托管契甲',
    slot: 'armor',
    description: '契甲把承伤权暂存于无人认领的遗产名下，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1260, lingyun: 4, items: { legacy_scrip: 1, rift_dust: 1 } },
    base: { maxHp: 48, defense: 12, speed: -1 },
    perLevel: { maxHp: 16, defense: 4 },
    maxLevel: 3
  },
  final_lot_bell: {
    id: 'final_lot_bell',
    name: '终场号钟',
    slot: 'charm',
    description: '号钟只为最后一件无人继承的拍品鸣响，入场时冻结其拍卖庭被动。',
    cost: { rewardPoints: 1220, lingyun: 4, items: { legacy_scrip: 1, chronal_glass: 1 } },
    base: { spirit: 2, artPower: 18, speed: 3 },
    perLevel: { artPower: 6, speed: 1 },
    maxLevel: 3
  },
  helix_cleaver: {
    id: 'helix_cleaver',
    name: '螺旋断链斧',
    slot: 'weapon',
    description: '斧刃沿双螺旋弱点展开，以原型血清维持断链锋面。',
    cost: { rewardPoints: 1420, lingyun: 5, items: { genesis_serum: 1, star_iron: 1 } },
    base: { attack: 25, artPower: 5 },
    perLevel: { attack: 7, artPower: 2 },
    maxLevel: 3
  },
  symbiote_cowl: {
    id: 'symbiote_cowl',
    name: '共生冠膜',
    slot: 'head',
    description: '冠膜读取宿主神经脉冲，在危机发生前调整感知与施法节律。',
    cost: { rewardPoints: 1380, lingyun: 5, items: { genesis_serum: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 15, speed: 3, trapCheck: 6 },
    perLevel: { artPower: 5, speed: 2, trapCheck: 1 },
    maxLevel: 3
  },
  carapace_harness: {
    id: 'carapace_harness',
    name: '原型甲壳',
    slot: 'armor',
    description: '活性甲片会沿受击方向增生，把裂隙冲击分散到整副外壳。',
    cost: { rewardPoints: 1460, lingyun: 5, items: { genesis_serum: 1, rift_dust: 1 } },
    base: { maxHp: 56, defense: 14 },
    perLevel: { maxHp: 18, defense: 4 },
    maxLevel: 3
  },
  rebirth_amulet: {
    id: 'rebirth_amulet',
    name: '复燃胚核',
    slot: 'charm',
    description: '胚核保存一次尚未定型的生命节律，为术法与防护持续提供复燃余量。',
    cost: { rewardPoints: 1400, lingyun: 5, items: { genesis_serum: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 20, defense: 4 },
    perLevel: { artPower: 7, defense: 2 },
    maxLevel: 3
  },
  hushblade: {
    id: 'hushblade',
    name: '断频长刃',
    slot: 'weapon',
    description: '入场时冻结寂声法则被动：抵消本局首次战斗或陷阱清理的增噪，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1600, lingyun: 6, items: { silence_core: 1, star_iron: 1 } },
    base: { attack: 28, artPower: 6 },
    perLevel: { attack: 8, artPower: 2 },
    maxLevel: 3
  },
  dead_air_headset: {
    id: 'dead_air_headset',
    name: '死频耳罩',
    slot: 'head',
    description: '入场时冻结寂声法则被动：静默中继额外降低 1 点噪声，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1540, lingyun: 6, items: { silence_core: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 18, speed: 4, trapCheck: 7 },
    perLevel: { artPower: 5, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  anechoic_mantle: {
    id: 'anechoic_mantle',
    name: '消声披甲',
    slot: 'armor',
    description: '入场时冻结寂声法则被动：敌方与陷阱的正向噪声惩罚减半，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1620, lingyun: 6, items: { silence_core: 1, rift_dust: 1 } },
    base: { maxHp: 62, defense: 16 },
    perLevel: { maxHp: 20, defense: 5 },
    maxLevel: 3
  },
  last_channel_beacon: {
    id: 'last_channel_beacon',
    name: '末路断播器',
    slot: 'charm',
    description: '入场时冻结寂声法则被动：首领战锁定的噪声快照降低 1 点，跨门后仍沿用本局快照。',
    cost: { rewardPoints: 1580, lingyun: 6, items: { silence_core: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 23, defense: 5 },
    perLevel: { artPower: 8, defense: 2 },
    maxLevel: 3
  },
  rescue_carbine: {
    id: 'rescue_carbine',
    name: '救援卡宾枪',
    slot: 'weapon',
    description: '入场时冻结失联避难所护送被动：救援火力只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1780, lingyun: 7, items: { rescue_badge: 1, star_iron: 1 } },
    base: { attack: 31, artPower: 7 },
    perLevel: { attack: 9, artPower: 2 },
    maxLevel: 3
  },
  triage_visor: {
    id: 'triage_visor',
    name: '分诊目镜',
    slot: 'head',
    description: '入场时冻结失联避难所护送被动：分诊判断只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1720, lingyun: 7, items: { rescue_badge: 1, phase_glass: 1 } },
    base: { spirit: 3, artPower: 21, speed: 4, trapCheck: 8 },
    perLevel: { artPower: 6, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  evacuation_plate: {
    id: 'evacuation_plate',
    name: '撤离护甲',
    slot: 'armor',
    description: '入场时冻结失联避难所护送被动：撤离防护只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1800, lingyun: 7, items: { rescue_badge: 1, rift_dust: 1 } },
    base: { maxHp: 70, defense: 18 },
    perLevel: { maxHp: 22, defense: 5 },
    maxLevel: 3
  },
  blackbox_beacon: {
    id: 'blackbox_beacon',
    name: '黑匣信标',
    slot: 'charm',
    description: '入场时冻结失联避难所护送被动：黑匣定位只读取本轮入场装备快照，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1760, lingyun: 7, items: { rescue_badge: 1, chronal_glass: 1 } },
    base: { spirit: 3, artPower: 26, defense: 6 },
    perLevel: { artPower: 9, defense: 2 },
    maxLevel: 3
  },
  cross_examiner_sabre: {
    id: 'cross_examiner_sabre',
    name: '诘问裁刃',
    slot: 'weapon',
    description: 'forge 专精；入场时冻结裁定法则被动，交叉诘问可当场拆穿敌意证人的矛盾，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1960, lingyun: 8, items: { truth_fragment: 1, star_iron: 1 } },
    base: { attack: 34, artPower: 8 },
    perLevel: { attack: 10, artPower: 2 },
    maxLevel: 3
  },
  forensic_visor: {
    id: 'forensic_visor',
    name: '溯证目镜',
    slot: 'head',
    description: 'mist 专精；入场时冻结裁定法则被动，可识别证据污染与删录封签，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1900, lingyun: 8, items: { truth_fragment: 1, phase_glass: 1 } },
    base: { spirit: 4, artPower: 24, speed: 5, trapCheck: 9 },
    perLevel: { artPower: 7, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  custody_shell: {
    id: 'custody_shell',
    name: '封证护甲',
    slot: 'armor',
    description: 'rift 专精；入场时冻结裁定法则被动，封存污染证据并压低伪证压力，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1980, lingyun: 8, items: { truth_fragment: 1, rift_dust: 1 } },
    base: { maxHp: 78, defense: 20 },
    perLevel: { maxHp: 24, defense: 6 },
    maxLevel: 3
  },
  appeal_seal: {
    id: 'appeal_seal',
    name: '翻案印玺',
    slot: 'charm',
    description: 'chronal 专精；入场时冻结裁定法则被动，可对一次原始错判发起翻案但不补发原始裁决奖励，跨门后仍沿用该快照。',
    cost: { rewardPoints: 1940, lingyun: 8, items: { truth_fragment: 1, chronal_glass: 1 } },
    base: { spirit: 4, artPower: 29, defense: 7 },
    perLevel: { artPower: 10, defense: 2 },
    maxLevel: 3
  },
  frame_engraver: {
    id: 'frame_engraver',
    name: '定帧刻刀',
    slot: 'weapon',
    description: '将直接动作刻入战斗母带的高阶武器；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2140, lingyun: 9, items: { combat_reel: 1, star_iron: 1 } },
    base: { attack: 37, artPower: 9 },
    perLevel: { attack: 11, artPower: 2 },
    maxLevel: 3
  },
  cue_visor: {
    id: 'cue_visor',
    name: '起拍目镜',
    slot: 'head',
    description: '校准每场第一次实际复演的起拍增幅；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2080, lingyun: 9, items: { combat_reel: 1, phase_glass: 1 } },
    base: { spirit: 4, artPower: 27, speed: 5, trapCheck: 10 },
    perLevel: { artPower: 8, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  buffer_plate: {
    id: 'buffer_plate',
    name: '缓冲叠甲',
    slot: 'armor',
    description: '令守势复演生成的缓冲跨越两次反击；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2160, lingyun: 9, items: { combat_reel: 1, rift_dust: 1 } },
    base: { maxHp: 86, defense: 22 },
    perLevel: { maxHp: 26, defense: 6 },
    maxLevel: 3
  },
  thaw_metronome: {
    id: 'thaw_metronome',
    name: '解冻节拍器',
    slot: 'charm',
    description: '首领开战时提前解冻第一段母带；复演被动按入场装备冻结。',
    cost: { rewardPoints: 2120, lingyun: 9, items: { combat_reel: 1, chronal_glass: 1 } },
    base: { spirit: 4, artPower: 32, defense: 8 },
    perLevel: { artPower: 11, defense: 2 },
    maxLevel: 3
  },
  blindline_cutter: {
    id: 'blindline_cutter',
    name: '断视切线刃',
    slot: 'weapon',
    description: '入场时冻结监察城被动；Boss 战按冻结曝光与折光充能提高武力和术法伤害，最高 15%。',
    cost: { rewardPoints: 2260, lingyun: 10, items: { observation_shard: 1, star_iron: 1 } },
    base: { attack: 40, artPower: 10 },
    perLevel: { attack: 12, artPower: 3 },
    maxLevel: 3
  },
  predictive_visor: {
    id: 'predictive_visor',
    name: '先见目镜',
    slot: 'head',
    description: '入场时冻结监察城被动；每个扫描相位第一次曝光各闪避一次，并记录已经使用的保护相位。',
    cost: { rewardPoints: 2200, lingyun: 10, items: { observation_shard: 1, phase_glass: 1 } },
    base: { spirit: 5, artPower: 30, speed: 6, trapCheck: 11 },
    perLevel: { artPower: 9, speed: 2, trapCheck: 2 },
    maxLevel: 3
  },
  matte_shell: {
    id: 'matte_shell',
    name: '消光披甲',
    slot: 'armor',
    description: '入场时冻结监察城被动；所有最终三相扫描伤害再次减半。',
    cost: { rewardPoints: 2280, lingyun: 10, items: { observation_shard: 1, rift_dust: 1 } },
    base: { maxHp: 94, defense: 24 },
    perLevel: { maxHp: 28, defense: 7 },
    maxLevel: 3
  },
  inverse_prism: {
    id: 'inverse_prism',
    name: '逆观棱镜',
    slot: 'charm',
    description: '入场时冻结监察城被动；Boss 快照曝光数减少 1，折光路线额外获得 1 点充能。',
    cost: { rewardPoints: 2240, lingyun: 10, items: { observation_shard: 1, chronal_glass: 1 } },
    base: { spirit: 5, artPower: 35, defense: 9 },
    perLevel: { artPower: 12, defense: 3 },
    maxLevel: 3
  }
};

export const METHODS: Record<MethodId, MethodDefinition> = {
  mist_breathing: {
    id: 'mist_breathing',
    name: '吐纳诀',
    description: '在雾、潮声和幻觉里稳住心神，能发现隐藏奖励。',
    cost: { rewardPoints: 300 },
    stats: { spirit: 1 },
    passive: '奖励节点出现隐藏路线，陷阱检定更容易通过。'
  },
  iron_body: {
    id: 'iron_body',
    name: '铁衣诀',
    description: '提高承伤能力，防御时可守反。',
    cost: { rewardPoints: 360, lingyun: 1 },
    stats: { body: 1 },
    passive: '陷阱伤害降低 20%，防御触发守反减伤。'
  },
  cloud_step: {
    id: 'cloud_step',
    name: '云隙步',
    description: '提高身法，速度相同时先手。',
    cost: { rewardPoints: 340, lingyun: 1 },
    stats: { agility: 1 },
    passive: '探索中更容易逃离战斗。'
  },
  gate_sense: {
    id: 'gate_sense',
    name: '观门法',
    description: '读懂传送门边缘的裂纹。',
    cost: { rewardPoints: 420, lingyun: 1, items: { rift_dust: 1 } },
    stats: { spirit: 2 },
    passive: '传送门节点显示稳定路线。'
  },
  star_core_method: {
    id: 'star_core_method',
    name: '星核炼息',
    description: '把星铁矿脉的脉动纳入呼吸，兼顾生命和术法。',
    cost: { rewardPoints: 720, lingyun: 2, items: { star_iron: 1, method_page: 1 } },
    stats: { body: 1, spirit: 2 },
    passive: '高阶奖励节点出现额外功法残文。'
  },
  beast_taming: {
    id: 'beast_taming',
    name: '御灵印',
    description: '降低捕获宠物时的心神反噬。',
    cost: { rewardPoints: 520, lingyun: 1, items: { demon_bone: 1 } },
    stats: { luck: 1 },
    passive: '捕获类行动的失败惩罚降低。'
  },
  void_heart: {
    id: 'void_heart',
    name: '虚心诀',
    description: '在主神回声中保持自我，适合终盘副本。',
    cost: { rewardPoints: 900, lingyun: 3, items: { cracked_core: 1, method_page: 1 } },
    stats: { body: 1, spirit: 1, agility: 1 },
    passive: '虚空节点的陷阱检定和撤离检定更稳定。'
  }
};

const UPGRADE_COSTS: Record<number, Cost> = {
  2: { rewardPoints: 220 },
  3: { rewardPoints: 360, lingyun: 1, items: { cracked_core: 1 } }
};

export const EQUIPMENT_ATTUNEMENT_COST = {
  rewardPoints: 480,
  lingyun: 1,
  items: { cycle_imprint: 1 }
} as const;

function createInventory(): Record<ItemId, number> {
  return Object.fromEntries(ITEM_IDS.map((itemId) => [itemId, 0])) as Record<ItemId, number>;
}

function isReplayRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactReplayKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    keys.every((key) => allowed.has(key));
}

function normalizeCombatReplayRecording(value: unknown): CombatReplayRecording | undefined {
  if (!isReplayRecord(value) || !hasExactReplayKeys(value, ['action', 'observedValue', 'replayValue'])) return undefined;
  if (value.action !== 'attack' && value.action !== 'art' && value.action !== 'guard') return undefined;
  if (!Number.isInteger(value.observedValue) || (value.observedValue as number) < 0 || (value.observedValue as number) > 9999) return undefined;
  if (!Number.isInteger(value.replayValue) || (value.replayValue as number) < 0 || (value.replayValue as number) > 9999) return undefined;
  return {
    action: value.action,
    observedValue: value.observedValue as number,
    replayValue: value.replayValue as number
  };
}

function normalizeCombatReplayRecordings(
  value: unknown
): Partial<Record<CombatReplayTakeId, CombatReplayRecording>> | undefined {
  if (!isReplayRecord(value) || Object.keys(value).some((key) => !COMBAT_REPLAY_TAKE_IDS.includes(key as CombatReplayTakeId))) {
    return undefined;
  }
  const recordings: Partial<Record<CombatReplayTakeId, CombatReplayRecording>> = {};
  for (const takeId of COMBAT_REPLAY_TAKE_IDS) {
    if (!Object.prototype.hasOwnProperty.call(value, takeId)) continue;
    const recording = normalizeCombatReplayRecording(value[takeId]);
    if (!recording) return undefined;
    recordings[takeId] = recording;
  }
  return recordings;
}

function hasSequentialCombatReplayRecordings(
  recordings: Partial<Record<CombatReplayTakeId, CombatReplayRecording>>
): boolean {
  let foundGap = false;
  for (const takeId of COMBAT_REPLAY_TAKE_IDS) {
    if (!recordings[takeId]) foundGap = true;
    else if (foundGap) return false;
  }
  return true;
}

function normalizeCombatReplayEntryGear(value: unknown): CombatReplayEntryGear | undefined {
  const keys = ['frameEngraver', 'cueVisor', 'bufferPlate', 'thawMetronome'] as const;
  if (!isReplayRecord(value) || !hasExactReplayKeys(value, keys)) return undefined;
  if (keys.some((key) => typeof value[key] !== 'boolean')) return undefined;
  return {
    frameEngraver: value.frameEngraver as boolean,
    cueVisor: value.cueVisor as boolean,
    bufferPlate: value.bufferPlate as boolean,
    thawMetronome: value.thawMetronome as boolean
  };
}

export function normalizeCombatReplayRunState(value: unknown): CombatReplayRunState | undefined {
  if (!isReplayRecord(value) || !hasExactReplayKeys(value, ['rulesVersion', 'recordings', 'entryGear'], ['route'])) {
    return undefined;
  }
  if (value.rulesVersion !== 1) return undefined;
  const recordings = normalizeCombatReplayRecordings(value.recordings);
  const entryGear = normalizeCombatReplayEntryGear(value.entryGear);
  if (!recordings || !entryGear || !hasSequentialCombatReplayRecordings(recordings)) return undefined;
  if (Object.values(recordings).some((recording) => recording && recording.replayValue !== (
    entryGear.frameEngraver
      ? Math.min(9999, Math.ceil(recording.observedValue * 1.15))
      : recording.observedValue
  ))) return undefined;
  if (value.route !== undefined && value.route !== 'sequence' && value.route !== 'burst' && value.route !== 'afterbeat') {
    return undefined;
  }
  if (value.route !== undefined && COMBAT_REPLAY_TAKE_IDS.some((takeId) => !recordings[takeId])) return undefined;
  return {
    rulesVersion: 1,
    recordings,
    entryGear,
    ...(value.route === undefined ? {} : { route: value.route })
  };
}

export function normalizeCombatReplayCombatState(value: unknown): CombatReplayCombatState | undefined {
  const required = [
    'rulesVersion',
    'enabled',
    'cursor',
    'buffer',
    'remainingBufferHits',
    'firstBoostUsed',
    'route',
    'recordings',
    'entryGear',
    'boss'
  ];
  if (!isReplayRecord(value) || !hasExactReplayKeys(value, required, ['pending'])) return undefined;
  if (
    value.rulesVersion !== 1 ||
    typeof value.enabled !== 'boolean' ||
    !Number.isInteger(value.cursor) ||
    (value.cursor as number) < 0 ||
    (value.cursor as number) > 3 ||
    !Number.isInteger(value.buffer) ||
    (value.buffer as number) < 0 ||
    !Number.isInteger(value.remainingBufferHits) ||
    (value.remainingBufferHits as number) < 0 ||
    (value.remainingBufferHits as number) > 2 ||
    typeof value.firstBoostUsed !== 'boolean' ||
    (value.route !== 'sequence' && value.route !== 'burst' && value.route !== 'afterbeat') ||
    typeof value.boss !== 'boolean'
  ) {
    return undefined;
  }
  const buffer = value.buffer as number;
  const remainingBufferHits = value.remainingBufferHits as 0 | 1 | 2;
  if ((buffer === 0) !== (remainingBufferHits === 0)) return undefined;
  const recordings = normalizeCombatReplayRecordings(value.recordings);
  const entryGear = normalizeCombatReplayEntryGear(value.entryGear);
  if (!recordings || !entryGear || COMBAT_REPLAY_TAKE_IDS.some((takeId) => !recordings[takeId])) return undefined;
  if (remainingBufferHits === 2 && !entryGear.bufferPlate) return undefined;
  if (value.firstBoostUsed && !entryGear.cueVisor) return undefined;
  if (entryGear.cueVisor && (value.cursor as number) > 0 && !value.firstBoostUsed) return undefined;
  if (Object.values(recordings).some((recording) => recording && recording.replayValue !== (
    entryGear.frameEngraver
      ? Math.min(9999, Math.ceil(recording.observedValue * 1.15))
      : recording.observedValue
  ))) return undefined;
  let pending: CombatReplayPending | undefined;
  if (value.pending !== undefined) {
    if (!isReplayRecord(value.pending) || !hasExactReplayKeys(value.pending, ['takeId', 'multiplierPercent'])) return undefined;
    if (!COMBAT_REPLAY_TAKE_IDS.includes(value.pending.takeId as CombatReplayTakeId)) return undefined;
    if (!Number.isInteger(value.pending.multiplierPercent) || (value.pending.multiplierPercent as number) < 0) return undefined;
    pending = {
      takeId: value.pending.takeId as CombatReplayTakeId,
      multiplierPercent: value.pending.multiplierPercent as number
    };
    if (value.route !== 'afterbeat' || pending.takeId !== getCombatReplayTakeIdAtCursor(value.cursor as 0 | 1 | 2 | 3)) {
      return undefined;
    }
  }
  return {
    rulesVersion: 1,
    enabled: value.enabled,
    cursor: value.cursor as 0 | 1 | 2 | 3,
    buffer,
    remainingBufferHits,
    firstBoostUsed: value.firstBoostUsed,
    route: value.route,
    recordings,
    entryGear,
    boss: value.boss,
    ...(pending ? { pending } : {})
  };
}

function createCombatReplayEntryGear(state: GameState): CombatReplayEntryGear {
  return {
    frameEngraver: state.equipped.weapon === 'frame_engraver',
    cueVisor: state.equipped.head === 'cue_visor',
    bufferPlate: state.equipped.armor === 'buffer_plate',
    thawMetronome: state.equipped.charm === 'thaw_metronome'
  };
}

function createPanopticonEntryGear(state: GameState): PanopticonEntryGear {
  return {
    blindlineCutter: state.equipped.weapon === 'blindline_cutter',
    predictiveVisor: state.equipped.head === 'predictive_visor',
    matteShell: state.equipped.armor === 'matte_shell',
    inversePrism: state.equipped.charm === 'inverse_prism'
  };
}

function createCombatReplayRunState(state: GameState): CombatReplayRunState {
  return {
    rulesVersion: 1,
    recordings: {},
    entryGear: createCombatReplayEntryGear(state)
  };
}

function appendLog(state: GameState, line: string): GameState {
  return {
    ...state,
    log: [line, ...state.log].slice(0, 12)
  };
}

function appendSecondaryLog(state: GameState, line: string): GameState {
  if (state.log.length === 0) return appendLog(state, line);
  return {
    ...state,
    log: [state.log[0], line, ...state.log.slice(1)].slice(0, 12)
  };
}

function addItems(inventory: Record<ItemId, number>, items: Partial<Record<ItemId, number>> = {}): Record<ItemId, number> {
  const next = { ...inventory };
  for (const [itemId, amount] of Object.entries(items) as Array<[ItemId, number]>) {
    next[itemId] = (next[itemId] ?? 0) + amount;
  }
  return next;
}

function hasItems(state: GameState, items: Partial<Record<ItemId, number>> = {}): boolean {
  return (Object.entries(items) as Array<[ItemId, number]>).every(
    ([itemId, amount]) => (state.inventory[itemId] ?? 0) >= amount
  );
}

function canPay(state: GameState, cost: Cost = {}): boolean {
  return (
    state.rewardPoints >= (cost.rewardPoints ?? 0) &&
    state.lingyun >= (cost.lingyun ?? 0) &&
    hasItems(state, cost.items)
  );
}

function payCost(state: GameState, cost: Cost = {}): GameState {
  const inventory = { ...state.inventory };
  for (const [itemId, amount] of Object.entries(cost.items ?? {}) as Array<[ItemId, number]>) {
    inventory[itemId] -= amount;
  }

  return {
    ...state,
    rewardPoints: state.rewardPoints - (cost.rewardPoints ?? 0),
    lingyun: state.lingyun - (cost.lingyun ?? 0),
    inventory
  };
}

function applyReward(state: GameState, reward: RewardBundle = {}): GameState {
  return {
    ...state,
    rewardPoints: state.rewardPoints + (reward.rewardPoints ?? 0),
    lingyun: state.lingyun + (reward.lingyun ?? 0),
    inventory: addItems(state.inventory, reward.items)
  };
}

function applyRunReward(state: GameState, reward: RewardBundle = {}): GameState {
  const durableItems = { ...(reward.items ?? {}) };
  delete durableItems.legacy_scrip;
  const rewarded = applyReward(state, {
    ...reward,
    ...(reward.items === undefined ? {} : { items: durableItems })
  });
  if (!rewarded.run) return rewarded;

  return {
    ...rewarded,
    run: {
      ...rewarded.run,
      lootBag: addRunLoot(rewarded.run.lootBag, reward)
    }
  };
}

function consumeItem(state: GameState, itemId: ItemId, amount = 1): GameState {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount === 0) return state;

  const nextState: GameState = {
    ...state,
    inventory: {
      ...state.inventory,
      [itemId]: Math.max(0, state.inventory[itemId] - safeAmount)
    }
  };
  if (!state.run) return nextState;

  // Pickups are spent before banked inventory so later retreat losses never consume pre-run stock.
  const consumedLoot = consumeRunLootItem(state.run.lootBag, itemId, safeAmount);
  return {
    ...nextState,
    run: {
      ...state.run,
      lootBag: consumedLoot.bag
    }
  };
}

function clampHp(hp: number, maxHp: number): number {
  return Math.max(0, Math.min(hp, maxHp));
}

function recordUsedItem(state: GameState, itemId: ItemId): GameState {
  if (!state.run) return state;

  return {
    ...state,
    run: {
      ...state.run,
      usedItems: [...state.run.usedItems, itemId]
    }
  };
}

function payEventItemRequirements(state: GameState, requirements: readonly DungeonEventRequirement[]): GameState {
  const itemRequirements = requirements.filter((requirement) => requirement.type === 'item');
  if (itemRequirements.length === 0) return state;

  let nextState = state;

  for (const requirement of itemRequirements) {
    nextState = consumeItem(nextState, requirement.itemId, requirement.count);
    nextState = recordUsedItem(nextState, requirement.itemId);
  }

  return nextState;
}

function applyPlayerDamage(state: GameState, damage: number): GameState {
  const actualDamage = Math.max(0, Math.min(state.player.hp, damage));

  return {
    ...state,
    player: {
      ...state.player,
      hp: clampHp(state.player.hp - damage, state.player.maxHp)
    },
    run: state.run
      ? {
          ...state.run,
          damageTaken: state.run.damageTaken + actualDamage
        }
      : state.run
  };
}

function getDungeonEventContext(state: GameState): DungeonEventContext {
  const equipped = Object.values(state.equipped);
  const activePet = getAvailableActivePet(state);

  return {
    learnedMethods: getAvailableLearnedMethods(state),
    ownedEquipment: state.ownedEquipment,
    equipped,
    activeEquipmentSetTags: getEquipmentSystemStatus(state).activeSets,
    ownedPets: state.ownedPets,
    activePetPassiveTags: activePet ? getPetPassiveTags(PETS[activePet]) : [],
    inventory: getAvailableEventInventory(state),
    stats: getDerivedStats(state)
  };
}

function getCombatMechanicsContext(state: GameState) {
  const activePet = getAvailableActivePet(state);
  return {
    stats: getDerivedStats(state),
    learnedMethods: getAvailableLearnedMethods(state),
    activePetPassiveTags: activePet ? getPetPassiveTags(PETS[activePet]) : [],
    activePetId: activePet
  };
}

function getAdjustedDungeonHealing(state: GameState, healing: number): number {
  const healingPercent = getCurrentDungeonLaw(state)?.modifiers.healingPercent ?? 0;
  return scaleByPercent(healing, healingPercent, 0);
}

function normalizeHealth(state: GameState, healDelta = 0): GameState {
  const nextMaxHp = getDerivedStats(state).maxHp;
  const maxHpDelta = nextMaxHp - state.player.maxHp;
  const adjustedHealing = getAdjustedDungeonHealing(state, healDelta);
  const nextHp = clampHp(state.player.hp + Math.max(0, maxHpDelta) + adjustedHealing, nextMaxHp);

  return {
    ...state,
    player: {
      ...state.player,
      hp: nextHp,
      maxHp: nextMaxHp
    }
  };
}

function advanceRouteContractOnFirstClear(run: DungeonRun, nodeId: string): DungeonRun {
  if (!hasRouteContractStateField(run)) return run;

  const routeContractState = transitionRouteContractFirstClear(
    run.routeContractState,
    run.dungeonId,
    nodeId
  );
  if (!routeContractState || routeContractState === run.routeContractState) return run;

  return {
    ...run,
    routeContractState
  };
}

function advanceEquipmentMemoryHuntOnFirstClear(
  run: DungeonRun,
  nodeId: string
): DungeonRun {
  const current = normalizeEquipmentMemoryHuntRunState(run.equipmentMemoryHunt);
  if (!current) return run;
  const equipmentMemoryHunt = transitionEquipmentMemoryHuntNodeClear(current, nodeId);
  if (!equipmentMemoryHunt || equipmentMemoryHunt === current) return run;
  return {
    ...run,
    equipmentMemoryHunt
  };
}

function advanceEquipmentMemoryHuntOnResolvedEvent(
  run: DungeonRun,
  eventId: string,
  success: boolean
): DungeonRun {
  const current = normalizeEquipmentMemoryHuntRunState(run.equipmentMemoryHunt);
  if (!current) return run;
  const equipmentMemoryHunt = transitionEquipmentMemoryHuntEventOutcome(
    current,
    eventId,
    { success }
  );
  if (!equipmentMemoryHunt || equipmentMemoryHunt === current) return run;
  return {
    ...run,
    equipmentMemoryHunt
  };
}

function settleDungeonRunRouteContract(
  run: DungeonRun,
  outcome: RouteContractRunOutcome
): { run: DungeonRun; settlement?: RouteContractSettlement } {
  if (!hasRouteContractStateField(run)) return { run };

  const settlement = settleRouteContractRun(run.routeContractState, run.dungeonId, outcome);
  if (!settlement.state) return { run };
  return {
    run: {
      ...run,
      routeContractState: settlement.state,
      lastRouteContractSettlement: settlement
    },
    settlement
  };
}

function settleDungeonRunEquipmentMemoryHunt(
  run: DungeonRun,
  outcome: EquipmentMemoryHuntRunOutcome,
  retainHuntState = true
): { run: DungeonRun; settlement?: EquipmentMemoryHuntSettlement } {
  const current = normalizeEquipmentMemoryHuntRunState(run.equipmentMemoryHunt);
  if (!current) return { run };

  const settlement = settleEquipmentMemoryHuntRun(current, outcome);
  if (!settlement.state) return { run };
  if (retainHuntState) {
    return {
      run: {
        ...run,
        equipmentMemoryHunt: settlement.state,
        lastEquipmentMemoryHuntSettlement: settlement
      },
      settlement
    };
  }

  const runWithoutHunt: DungeonRun = { ...run };
  delete runWithoutHunt.equipmentMemoryHunt;
  return {
    run: {
      ...runWithoutHunt,
      lastEquipmentMemoryHuntSettlement: settlement
    },
    settlement
  };
}

function getEquipmentMemoryHuntOutcomeFields(
  settlement: EquipmentMemoryHuntSettlement | undefined
): string {
  const huntState = settlement?.state;
  if (!huntState) return '';
  return `; equipmentMemoryHunt=${huntState.memoryId}:${huntState.status}; equipmentMemoryReason=${huntState.reason ?? 'none'}; equipmentMemoryGranted=${settlement.granted ? 1 : 0}`;
}

function getEquipmentMemoryHuntSettlementLog(
  settlement: EquipmentMemoryHuntSettlement | undefined
): string | undefined {
  const huntState = settlement?.state;
  if (!huntState) return undefined;
  const equipmentName = EQUIPMENT[huntState.equipmentId].name;
  const memoryName = getEquipmentMemoryById(huntState.memoryId)?.name ?? huntState.memoryId;
  if (settlement.granted) {
    return `铭刻记忆狩猎结算：${memoryName}已写入${equipmentName}并自动激活；不发放额外奖励点、灵蕴或物品。`;
  }
  if (huntState.status === 'failed') {
    return huntState.reason === 'event_failure'
      ? `铭刻记忆狩猎结算：目标事件失败，${equipmentName}未收录${memoryName}。`
      : `铭刻记忆狩猎结算：离场时目标未全部完成，${equipmentName}未收录${memoryName}。`;
  }
  if (huntState.status === 'lost') {
    const reasonText = huntState.reason === 'retreat'
      ? '主动撤退'
      : huntState.reason === 'failure'
        ? '挑战失败'
        : '跨越副本';
    return `铭刻记忆狩猎结算：${reasonText}使${memoryName}遗失，永久收录未改变。`;
  }
  return `铭刻记忆狩猎结算：${memoryName}状态为 ${huntState.status}，本次未授予记忆。`;
}

function settleGameStateEquipmentMemoryHunt(
  state: GameState,
  outcome: EquipmentMemoryHuntRunOutcome
): {
  state: GameState;
  settlement?: EquipmentMemoryHuntSettlement;
  settlementLog?: string;
} {
  if (!state.run) return { state };
  const result = settleDungeonRunEquipmentMemoryHunt(state.run, outcome);
  if (!result.settlement?.state) return { state };

  const outcomeFields = getEquipmentMemoryHuntOutcomeFields(result.settlement);
  let settledState: GameState = {
    ...state,
    run: result.run,
    lastOutcome: state.lastOutcome
      ? `${state.lastOutcome}${outcomeFields}`
      : outcomeFields.replace(/^; /, '')
  };
  if (result.settlement.granted) {
    settledState = {
      ...settledState,
      equipmentMemories: unlockEquipmentMemory(
        settledState.equipmentMemories,
        result.settlement.state.equipmentId,
        result.settlement.state.memoryId
      ),
      preparedEquipmentMemoryHunt: undefined
    };
  }

  return {
    state: settledState,
    settlement: result.settlement,
    settlementLog: getEquipmentMemoryHuntSettlementLog(result.settlement)
  };
}

function unlockEquipmentMemoriesFromClear(
  state: GameState,
  dungeonId: DungeonId
): { state: GameState; unlockedEquipmentIds: EquipmentMemoryEquipmentId[] } {
  const preparation = getEquipmentMemoryHuntPreparationStatus(
    {
      ...state,
      preparedEquipmentHunt: undefined,
      preparedEquipmentMemoryHunt: undefined
    },
    dungeonId
  );
  if (!preparation.definition || preparation.targetEquipmentIds.length === 0) {
    return { state, unlockedEquipmentIds: [] };
  }

  let equipmentMemories = sanitizeEquipmentMemoryMap(state.equipmentMemories);
  for (const equipmentId of preparation.targetEquipmentIds) {
    equipmentMemories = unlockEquipmentMemory(
      equipmentMemories,
      equipmentId,
      preparation.definition.id
    );
  }

  return {
    state: { ...state, equipmentMemories },
    unlockedEquipmentIds: [...preparation.targetEquipmentIds]
  };
}

function hasRunPursuitStateField(run: DungeonRun): boolean {
  return Object.prototype.hasOwnProperty.call(run, 'pursuitState');
}

function getStrictRunPursuitState(run: DungeonRun): RunPursuitState | undefined {
  if (!hasRunPursuitStateField(run)) return undefined;
  const knownNodeIds = DUNGEONS[run.dungeonId].nodes.map((node) => node.id);
  const pursuitState = normalizeRunPursuitState(run.pursuitState, knownNodeIds);
  return pursuitState?.dungeonId === run.dungeonId ? pursuitState : undefined;
}

function getNormalizedRunPursuitSettlement(value: unknown): RunPursuitSettlement | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join('|') !== 'materialId|reason|rewarded|state') return undefined;
  if (
    record.reason !== 'successful_exit' &&
    record.reason !== 'retreat' &&
    record.reason !== 'failure' &&
    record.reason !== 'stable_portal' &&
    record.reason !== 'forced_portal'
  ) {
    return undefined;
  }
  if (typeof record.rewarded !== 'boolean') return undefined;

  const rawState = record.state;
  if (typeof rawState !== 'object' || rawState === null || Array.isArray(rawState)) return undefined;
  const rawDungeonId = (rawState as Record<string, unknown>).dungeonId;
  if (typeof rawDungeonId !== 'string' || !Object.prototype.hasOwnProperty.call(DUNGEONS, rawDungeonId)) {
    return undefined;
  }
  const dungeonId = rawDungeonId as DungeonId;
  const pursuitState = normalizeRunPursuitState(
    rawState,
    DUNGEONS[dungeonId].nodes.map((node) => node.id)
  );
  const definition = getRunPursuitDefinition(dungeonId);
  if (!pursuitState || !definition || record.materialId !== definition.materialId) return undefined;

  return {
    state: pursuitState,
    reason: record.reason,
    materialId: definition.materialId,
    rewarded: record.rewarded
  };
}

function markNodeCleared(state: GameState, nodeId: string, damageTaken = 0): GameState {
  if (!state.run || state.run.clearedNodeIds.includes(nodeId)) return state;

  const node = getNodeById(DUNGEONS[state.run.dungeonId], nodeId);
  const clearedNodeIds = [...state.run.clearedNodeIds, nodeId];
  const pressureState =
    node && node.type !== 'exit'
      ? advanceRunPressureOnNodeClear(state.run.pressureState)
      : state.run.pressureState;
  const currentLawState = getNormalizedDungeonLawState(state);
  const lawState =
    node && currentLawState
      ? signalFirstNodeClear(currentLawState, {
          node,
          damageTaken: Math.max(0, damageTaken)
        })
      : currentLawState;
  const pursuitState = getStrictRunPursuitState(state.run);
  const pursuitClearedNodeCount = isRunPressureState(pressureState)
    ? pressureState.clearedNodeCount
    : clearedNodeIds.length;
  const activatedPursuitState = node && node.type !== 'exit' && pursuitState
    ? activateRunPursuit(pursuitState, pursuitClearedNodeCount)
    : pursuitState;
  const advancedRun = advanceRouteContractOnFirstClear(
    advanceEquipmentMemoryHuntOnFirstClear(
      {
        ...state.run,
        clearedNodeIds,
        lawState,
        ...(pressureState === undefined ? {} : { pressureState }),
        ...(activatedPursuitState === undefined ? {} : { pursuitState: activatedPursuitState })
      },
      nodeId
    ),
    nodeId
  );
  const discoveredHiddenTask =
    node?.type !== 'exit' &&
    advancedRun.entryFlowVersion === 2 &&
    advancedRun.routeContractState === undefined &&
    advancedRun.hiddenTaskSeed !== undefined
      ? discoverHiddenRouteContract({
          dungeonId: advancedRun.dungeonId,
          seed: advancedRun.hiddenTaskSeed,
          clearedNodeIds
        })
      : undefined;
  const run = discoveredHiddenTask
    ? { ...advancedRun, routeContractState: discoveredHiddenTask }
    : advancedRun;
  const clearedState: GameState = {
    ...state,
    run
  };
  const hiddenTaskDefinition = discoveredHiddenTask
    ? getRouteContractById(discoveredHiddenTask.contractId, discoveredHiddenTask.dungeonId)
    : undefined;
  const hiddenTaskState = hiddenTaskDefinition
    ? appendLog(clearedState, `发现隐藏任务「${hiddenTaskDefinition.name}」。继续探索，任务线索会在地图中显现。`)
    : clearedState;
  if (!pursuitState || !activatedPursuitState || activatedPursuitState === pursuitState) {
    return hiddenTaskState;
  }

  const definition = getRunPursuitDefinition(activatedPursuitState.dungeonId);
  return appendLog(
    hiddenTaskState,
    `破界追兵「${definition?.name ?? activatedPursuitState.dungeonId}」已在${activatedPursuitState.nodeId ?? '未知节点'}现身。`
  );
}

function getCurrentNode(state: GameState): DungeonNode | undefined {
  if (!state.run) return undefined;
  return DUNGEONS[state.run.dungeonId].nodes.find((node) => node.id === state.run?.currentNodeId);
}

function getNormalizedDungeonLawState(state: GameState): DungeonLawState | undefined {
  if (!state.run) return undefined;
  return normalizeDungeonLawState(state.run.lawState, state.run.dungeonId);
}

function withDungeonLawState(state: GameState, lawState: DungeonLawState): GameState {
  if (!state.run) return state;
  return {
    ...state,
    run: {
      ...state.run,
      lawState
    }
  };
}

const EMPTY_BROADCAST_ENTRY_PASSIVES: BroadcastEntryPassives = {
  hushblade: false,
  deadAirHeadset: false,
  anechoicMantle: false,
  lastChannelBeacon: false
};

const EMPTY_ESCORT_ENTRY_GEAR: EscortEntryGear = {
  rescueCarbine: false,
  triageVisor: false,
  evacuationPlate: false,
  blackboxBeacon: false
};

const EMPTY_FALSE_TESTIMONY_ENTRY_GEAR: FalseTestimonyEntryGear = {
  crossExaminerSabre: false,
  forensicVisor: false,
  custodyShell: false,
  appealSeal: false
};

function createFalseTestimonyEntryGearFromEquipped(state: GameState): FalseTestimonyEntryGear {
  return {
    crossExaminerSabre: state.equipped.weapon === 'cross_examiner_sabre',
    forensicVisor: state.equipped.head === 'forensic_visor',
    custodyShell: state.equipped.armor === 'custody_shell',
    appealSeal: state.equipped.charm === 'appeal_seal'
  };
}

function normalizeFalseTestimonyEntryGearSnapshot(
  value: unknown
): FalseTestimonyEntryGear | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Record<keyof FalseTestimonyEntryGear, unknown>>;
  if (
    typeof candidate.crossExaminerSabre !== 'boolean' ||
    typeof candidate.forensicVisor !== 'boolean' ||
    typeof candidate.custodyShell !== 'boolean' ||
    typeof candidate.appealSeal !== 'boolean'
  ) {
    return undefined;
  }
  return {
    crossExaminerSabre: candidate.crossExaminerSabre,
    forensicVisor: candidate.forensicVisor,
    custodyShell: candidate.custodyShell,
    appealSeal: candidate.appealSeal
  };
}

function getRunFalseTestimonyEntryGear(run: DungeonRun): FalseTestimonyEntryGear {
  const savedSnapshot = normalizeFalseTestimonyEntryGearSnapshot(run.falseTestimonyEntryGear);
  if (savedSnapshot) return savedSnapshot;

  const lawState = normalizeDungeonLawState(run.lawState, run.dungeonId);
  return lawState.law.kind === 'false_testimony_court'
    ? { ...lawState.law.entryGear }
    : { ...EMPTY_FALSE_TESTIMONY_ENTRY_GEAR };
}

function createEscortEntryGearFromEquipped(state: GameState): EscortEntryGear {
  return {
    rescueCarbine: state.equipped.weapon === 'rescue_carbine',
    triageVisor: state.equipped.head === 'triage_visor',
    evacuationPlate: state.equipped.armor === 'evacuation_plate',
    blackboxBeacon: state.equipped.charm === 'blackbox_beacon'
  };
}

function normalizeEscortEntryGearSnapshot(value: unknown): EscortEntryGear | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Record<keyof EscortEntryGear, unknown>>;
  if (
    typeof candidate.rescueCarbine !== 'boolean' ||
    typeof candidate.triageVisor !== 'boolean' ||
    typeof candidate.evacuationPlate !== 'boolean' ||
    typeof candidate.blackboxBeacon !== 'boolean'
  ) {
    return undefined;
  }
  return {
    rescueCarbine: candidate.rescueCarbine,
    triageVisor: candidate.triageVisor,
    evacuationPlate: candidate.evacuationPlate,
    blackboxBeacon: candidate.blackboxBeacon
  };
}

function getRunEscortEntryGear(run: DungeonRun): EscortEntryGear {
  const savedSnapshot = normalizeEscortEntryGearSnapshot(run.escortEntryGear);
  if (savedSnapshot) return savedSnapshot;

  const lawState = normalizeDungeonLawState(run.lawState, run.dungeonId);
  return lawState.law.kind === 'lost_shelter'
    ? { ...lawState.law.entryGear }
    : { ...EMPTY_ESCORT_ENTRY_GEAR };
}

function getEscortEntryCompanion(snapshot: unknown): EscortEntryCompanion {
  const normalized = normalizeCompanionRunSnapshot(snapshot);
  return normalized
    ? { id: normalized.companionId, rank: normalized.rank }
    : { id: null, rank: 0 };
}

function createBroadcastEntryPassivesFromEquipped(state: GameState): BroadcastEntryPassives {
  return {
    hushblade: state.equipped.weapon === 'hushblade',
    deadAirHeadset: state.equipped.head === 'dead_air_headset',
    anechoicMantle: state.equipped.armor === 'anechoic_mantle',
    lastChannelBeacon: state.equipped.charm === 'last_channel_beacon'
  };
}

function normalizeBroadcastEntryPassivesSnapshot(value: unknown): BroadcastEntryPassives | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Record<keyof BroadcastEntryPassives, unknown>>;
  if (
    typeof candidate.hushblade !== 'boolean' ||
    typeof candidate.deadAirHeadset !== 'boolean' ||
    typeof candidate.anechoicMantle !== 'boolean' ||
    typeof candidate.lastChannelBeacon !== 'boolean'
  ) {
    return undefined;
  }
  return {
    hushblade: candidate.hushblade,
    deadAirHeadset: candidate.deadAirHeadset,
    anechoicMantle: candidate.anechoicMantle,
    lastChannelBeacon: candidate.lastChannelBeacon
  };
}

function getRunBroadcastEntryPassives(run: DungeonRun): BroadcastEntryPassives {
  const savedSnapshot = normalizeBroadcastEntryPassivesSnapshot(run.broadcastEntryPassives);
  if (savedSnapshot) return savedSnapshot;

  const lawState = normalizeDungeonLawState(run.lawState, run.dungeonId);
  return lawState.law.kind === 'silent_broadcast_tower'
    ? { ...lawState.law.entryPassives }
    : { ...EMPTY_BROADCAST_ENTRY_PASSIVES };
}

function createEntryDungeonLawState(
  state: GameState,
  dungeonId: DungeonId,
  bloodlineSnapshot: unknown,
  broadcastEntryPassives = createBroadcastEntryPassivesFromEquipped(state),
  escortEntryGear = createEscortEntryGearFromEquipped(state),
  falseTestimonyEntryGear = createFalseTestimonyEntryGearFromEquipped(state),
  companionSnapshot?: unknown
): DungeonLawState {
  const equippedIds = new Set(Object.values(state.equipped));
  const normalizedBloodline = normalizeBloodlineRunSnapshot(bloodlineSnapshot);
  return createDungeonLawState(dungeonId, {
    entryPassives: {
      causalVisor: equippedIds.has('causal_visor'),
      echoBreakerGauntlets: equippedIds.has('echo_breaker_gauntlets'),
      returnAnchorBelt: equippedIds.has('return_anchor_belt'),
      entropyCompass: equippedIds.has('entropy_compass'),
      dissipationMantle: equippedIds.has('dissipation_mantle'),
      arkKeelBoots: equippedIds.has('ark_keel_boots'),
      parallaxVisor: equippedIds.has('parallax_visor'),
      phaseweaveMantle: equippedIds.has('phaseweave_mantle'),
      homecomingPrism: equippedIds.has('homecoming_prism'),
      redlineEdge: equippedIds.has('redline_edge'),
      palimpsestMantle: equippedIds.has('palimpsest_mantle'),
      finalProofSeal: equippedIds.has('final_proof_seal'),
      legacyGavel: equippedIds.has('legacy_gavel'),
      anonymousVeil: equippedIds.has('anonymous_veil'),
      escrowPlate: equippedIds.has('escrow_plate'),
      finalLotBell: equippedIds.has('final_lot_bell'),
      ...broadcastEntryPassives
    },
    entryGear: {
      helixCleaver: equippedIds.has('helix_cleaver'),
      symbioteCowl: equippedIds.has('symbiote_cowl'),
      carapaceHarness: equippedIds.has('carapace_harness'),
      rebirthAmulet: equippedIds.has('rebirth_amulet'),
      ...escortEntryGear,
      ...falseTestimonyEntryGear,
      ...createCombatReplayEntryGear(state),
      ...createPanopticonEntryGear(state)
    },
    entryBloodline: normalizedBloodline
      ? { aspect: normalizedBloodline.aspect, rank: normalizedBloodline.rank }
      : { aspect: null, rank: 0 },
    entryCompanion: getEscortEntryCompanion(companionSnapshot)
  });
}

function getCausalLedgerPercentAmount(maxHp: number, percent: number): number {
  if (percent <= 0) return 0;
  return Math.max(1, Math.floor(Math.max(0, maxHp) * percent / 100));
}

export function getCurrentCausalLedgerStatus(state: GameState): CausalLedgerStatus | undefined {
  if (state.run?.dungeonId !== 'causal_clearinghouse') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  const preliminary = getCausalLedgerStatus(lawState);
  const repayDamage = getCausalLedgerPercentAmount(state.player.maxHp, preliminary.repayDamagePercent);
  return getCausalLedgerStatus(lawState, {
    canAffordRepayDamage: repayDamage > 0 && state.player.hp > repayDamage
  });
}

export function resolveCausalLedger(state: GameState, choice: CausalLedgerChoice): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'causal_clearinghouse') {
    return appendLog(state, '当前没有可结算的因果账本。');
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return appendLog(state, '因果账本状态缺失，本次选择未生效。');
  const preliminary = getCausalLedgerStatus(lawState);

  const repayDamage = getCausalLedgerPercentAmount(state.player.maxHp, preliminary.repayDamagePercent);
  const resolution = resolveCausalLedgerChoice(lawState, choice, {
    canAffordRepayDamage: repayDamage > 0 && state.player.hp > repayDamage
  });
  if (!resolution.resolved) {
    return appendLog(state, resolution.unavailableReason ?? '这个账本选项当前不可用。');
  }

  let nextState = withDungeonLawState(state, resolution.state);
  let effectText = '账目原样归档';
  if (resolution.effect.rewardPoints > 0 || resolution.effect.healPercent > 0) {
    const healAmount = getCausalLedgerPercentAmount(state.player.maxHp, resolution.effect.healPercent);
    const hpBefore = nextState.player.hp;
    nextState = applyRunReward(nextState, { rewardPoints: resolution.effect.rewardPoints });
    nextState = normalizeHealth(nextState, healAmount);
    effectText = `本局奖励点 +${resolution.effect.rewardPoints}，生命回复 ${nextState.player.hp - hpBefore}`;
  } else if (resolution.effect.damagePercent > 0) {
    const damageAmount = getCausalLedgerPercentAmount(state.player.maxHp, resolution.effect.damagePercent);
    const hpBefore = nextState.player.hp;
    nextState = applyPlayerDamage(nextState, damageAmount);
    effectText = `支付最大生命 ${resolution.effect.damagePercent}%（${hpBefore - nextState.player.hp} 点）`;
  }

  const choiceLabels: Record<CausalLedgerChoice, string> = {
    balance: '平衡',
    overdraw: '透支',
    repay: '偿还'
  };
  const nextStatus = getCausalLedgerStatus(resolution.state);
  return appendLog(
    nextState,
    `因果账本·${choiceLabels[choice]}：${effectText}，当前因果债 ${nextStatus.debt}/4。`
  );
}

export function getCurrentEntropyHeadingStatus(state: GameState): EntropyHeadingStatus | undefined {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'entropy_ark') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState ? getEntropyHeadingStatus(lawState) : undefined;
}

export function resolveEntropyHeading(state: GameState, choice: EntropyHeadingChoice): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'entropy_ark') {
    return appendLog(state, '当前没有可指定的方舟航向。');
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return appendLog(state, '方舟航向状态缺失，本次选择未生效。');
  const status = getEntropyHeadingStatus(lawState);
  const resolution = resolveEntropyHeadingChoice(lawState, choice);
  if (!resolution.resolved) {
    return appendLog(state, resolution.unavailableReason ?? '这个航向选项当前不可用。');
  }

  const nextStatus = getEntropyHeadingStatus(resolution.state);
  const entropyDelta = nextStatus.entropy - status.entropy;
  const deltaText = entropyDelta >= 0 ? `+${entropyDelta}` : `${entropyDelta}`;
  const choiceLabels: Record<EntropyHeadingChoice, string> = {
    steady: '稳航',
    rush: '抢航'
  };
  return appendLog(
    withDungeonLawState(state, resolution.state),
    `方舟航向·${choiceLabels[choice]}：熵值 ${deltaText}，当前熵值 ${nextStatus.entropy}/4。`
  );
}

export function getCurrentMirrorCityPhaseStatus(state: GameState): MirrorCityPhaseStatus | undefined {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'mirror_cycle_city') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  const status = getMirrorCityPhaseStatus(lawState);
  const choices = Object.fromEntries((['real', 'mirror'] as const).map((phase) => {
    const choice = status.choices[phase];
    const damage = getCausalLedgerPercentAmount(state.player.maxHp, choice.damagePercent);
    if (!choice.available || !choice.phaseChanged || state.player.hp > damage) return [phase, choice];
    return [phase, {
      ...choice,
      available: false,
      unavailableReason: '当前生命不足以支付相位切换代价。'
    }];
  })) as MirrorCityPhaseStatus['choices'];

  return {
    ...status,
    available: Object.values(choices).some((choice) => choice.available),
    choices
  };
}

export function resolveMirrorCityPhase(state: GameState, phase: MirrorCityPhase): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'mirror_cycle_city') {
    return appendLog(state, '当前没有可指定的镜城相位。');
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return appendLog(state, '镜城相位状态缺失，本次选择未生效。');
  const choiceStatus = getCurrentMirrorCityPhaseStatus(state)?.choices[phase];
  if (!choiceStatus?.available) {
    return appendLog(state, choiceStatus?.unavailableReason ?? '这个镜城相位不存在。');
  }

  const resolution = resolveMirrorCityPhaseChoice(lawState, phase);
  if (!resolution.resolved) {
    return appendLog(state, resolution.unavailableReason ?? '这个镜城相位当前不可用。');
  }

  let nextState = withDungeonLawState(state, resolution.state);
  let transitionText = '相位保持不变';
  if (resolution.phaseChanged && resolution.damagePercent > 0) {
    const damage = getCausalLedgerPercentAmount(state.player.maxHp, resolution.damagePercent);
    const hpBefore = nextState.player.hp;
    nextState = applyPlayerDamage(nextState, damage);
    transitionText = `支付最大生命 ${resolution.damagePercent}%（${hpBefore - nextState.player.hp} 点）`;
  }
  const phaseLabel = phase === 'real' ? '现实' : '镜像';
  return appendLog(nextState, `镜城相位·${phaseLabel}：${transitionText}，相位选择已落定。`);
}

export function getCurrentRedactionClauseStatus(state: GameState): RedactionClauseStatus | undefined {
  if (state.run?.dungeonId !== 'redaction_scriptorium') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  const status = getRedactionClauseStatus(lawState);
  const redactDamage = getCausalLedgerPercentAmount(state.player.maxHp, status.costPercent);
  if (!status.choices.redact.available || state.player.hp > redactDamage) return status;

  return {
    ...status,
    choices: {
      ...status.choices,
      redact: {
        ...status.choices.redact,
        available: false,
        unavailableReason: '当前生命不足以支付删改代价。'
      }
    }
  };
}

export function resolveRedactionClause(state: GameState, choice: RedactionChoice): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'redaction_scriptorium') {
    return appendLog(state, '当前没有可裁定的终稿条款。');
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return appendLog(state, '终稿条款状态缺失，本次裁定未生效。');
  const choiceStatus = getCurrentRedactionClauseStatus(state)?.choices[choice];
  if (!choiceStatus?.available) {
    return appendLog(state, choiceStatus?.unavailableReason ?? '这个终稿裁定不存在。');
  }

  const resolution = resolveRedactionClauseChoice(lawState, choice);
  if (!resolution.resolved) {
    return appendLog(state, resolution.unavailableReason ?? '这个终稿裁定当前不可用。');
  }

  let nextState = withDungeonLawState(state, resolution.state);
  let effectText = '认证当前正文，不支付生命';
  if (choice === 'redact') {
    const damage = getCausalLedgerPercentAmount(state.player.maxHp, resolution.costPercent);
    const hpBefore = nextState.player.hp;
    nextState = applyPlayerDamage(nextState, damage);
    effectText = `支付最大生命 ${resolution.costPercent}%（${hpBefore - nextState.player.hp} 点）并删除当前条款`;
  }

  return appendLog(
    nextState,
    `终稿条款·${choice === 'certify' ? '认证' : '删改'}：${effectText}。`
  );
}

function getCurrentRunLegacyScrip(state: GameState): number {
  return state.run?.lootBag.items.legacy_scrip ?? 0;
}

export function getCurrentAuctionLotStatus(state: GameState): AuctionLotStatus | undefined {
  if (state.run?.dungeonId !== 'legacy_auction_court') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState ? getAuctionLotStatus(lawState, getCurrentRunLegacyScrip(state)) : undefined;
}

export function resolveAuctionLot(state: GameState, choice: AuctionLotChoice): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'legacy_auction_court') {
    return appendLog(state, '当前没有可裁定的遗产拍品。');
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return appendLog(state, '遗产拍卖状态缺失，本次裁定未生效。');
  const availableScrip = getCurrentRunLegacyScrip(state);
  const resolution = resolveAuctionLotChoice(lawState, choice, availableScrip);
  if (!resolution.resolved) {
    return appendLog(state, resolution.unavailableReason ?? '这个遗产拍品裁定当前不可用。');
  }

  const consumption = consumeRunLootItem(state.run.lootBag, 'legacy_scrip', resolution.scripCost);
  if (consumption.consumed !== resolution.scripCost) {
    return appendLog(state, '本轮遗产筹码不足，本次裁定未生效。');
  }

  const choiceLabels: Record<AuctionLotChoice, string> = { bid: '竞得', burn: '焚毁', fold: '放弃' };
  const remainingScrip = consumption.bag.items.legacy_scrip ?? 0;
  return appendLog(
    {
      ...state,
      run: {
        ...state.run,
        lawState: resolution.state,
        lootBag: consumption.bag
      }
    },
    `遗产拍品·${choiceLabels[choice]}：消耗遗产筹码 ${resolution.scripCost}，本轮剩余 ${remainingScrip}。`
  );
}

function getCurrentGenesisSerumAvailability(state: GameState): number {
  if (!state.run) return 0;
  const runSerum = Math.max(0, Math.floor(state.run.lootBag.items.genesis_serum ?? 0));
  const durableSerum = Math.max(0, Math.floor(state.inventory.genesis_serum ?? 0));
  return Math.min(runSerum, durableSerum);
}

export function getCurrentGenesisSpliceStatus(state: GameState): GenesisSpliceStatus | undefined {
  if (state.run?.dungeonId !== 'genesis_vault') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState ? getGenesisSpliceStatus(lawState, getCurrentGenesisSerumAvailability(state)) : undefined;
}

export function resolveGenesisSplice(state: GameState, gene: GenesisGene): GameState {
  if (state.phase !== 'explore' || state.run?.dungeonId !== 'genesis_vault') return state;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;

  const availableSerum = getCurrentGenesisSerumAvailability(state);
  const choiceStatus = getGenesisSpliceStatus(lawState, availableSerum).choices[gene];
  if (!choiceStatus?.available) return state;
  const resolution = resolveGenesisSpliceChoice(lawState, gene, availableSerum);
  if (!resolution.resolved) return state;

  const consumption = consumeRunLootItem(state.run.lootBag, 'genesis_serum', resolution.serumCost);
  if (
    consumption.consumed !== resolution.serumCost ||
    state.inventory.genesis_serum < resolution.serumCost
  ) {
    return state;
  }

  const geneLabels: Record<GenesisGene, string> = {
    force: '武力',
    art: '术法',
    guard: '守御',
    renewal: '复生'
  };
  const remainingSerum = Math.min(
    consumption.bag.items.genesis_serum ?? 0,
    state.inventory.genesis_serum - resolution.serumCost
  );
  return appendLog(
    {
      ...state,
      inventory: {
        ...state.inventory,
        genesis_serum: state.inventory.genesis_serum - resolution.serumCost
      },
      run: {
        ...state.run,
        lootBag: consumption.bag,
        lawState: resolution.state
      }
    },
    `原型拼接·${geneLabels[gene]}：消耗原型血清 ${resolution.serumCost} 支，本轮剩余 ${remainingSerum} 支。`
  );
}

export function getCurrentBroadcastRelayStatus(state: GameState): BroadcastRelayStatus | undefined {
  if (state.run?.dungeonId !== 'silent_broadcast_tower') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState ? getBroadcastRelayStatus(lawState) : undefined;
}

export function resolveCurrentBroadcastRelay(
  state: GameState,
  choice: BroadcastRelayChoice
): GameState {
  if (
    state.phase !== 'explore' ||
    state.run?.dungeonId !== 'silent_broadcast_tower' ||
    (choice !== 'mute' && choice !== 'broadcast')
  ) {
    return state;
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const status = getBroadcastRelayStatus(lawState);
  if (
    !status.pending ||
    status.bossNoiseSnapshot !== null ||
    status.pendingRelayNodeId !== state.run.currentNodeId ||
    !status.choices[choice].available
  ) {
    return state;
  }

  const resolution = resolveBroadcastRelayChoice(lawState, choice);
  if (!resolution.resolved) return state;

  const resolvedState = withDungeonLawState(state, resolution.state);
  const rewardedState = resolution.bonusRewardPoints > 0
    ? applyRunReward(resolvedState, { rewardPoints: resolution.bonusRewardPoints })
    : resolvedState;
  const nextStatus = getBroadcastRelayStatus(resolution.state);
  return appendLog(
    rewardedState,
    choice === 'broadcast'
      ? `广播中继已播送：本局奖励点 +${resolution.bonusRewardPoints}，当前噪声 ${nextStatus.noise}/6。`
      : `广播中继已静默：当前噪声 ${nextStatus.noise}/6。`
  );
}

function getCurrentRunHealingPillAvailability(state: GameState): number {
  if (!state.run) return 0;
  const runPills = Math.max(0, Math.floor(state.run.lootBag.items.healing_pill ?? 0));
  const inventoryPills = Math.max(0, Math.floor(state.inventory.healing_pill ?? 0));
  return Math.min(runPills, inventoryPills);
}

export function getCurrentEscortCheckpointStatus(
  state: GameState
): EscortCheckpointStatus | undefined {
  if (state.run?.dungeonId !== 'lost_shelter') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState
    ? getEscortCheckpointStatus(lawState, getCurrentRunHealingPillAvailability(state))
    : undefined;
}

export function resolveCurrentEscortCheckpoint(
  state: GameState,
  choice: EscortCheckpointChoice
): GameState {
  if (
    state.phase !== 'explore' ||
    state.run?.dungeonId !== 'lost_shelter' ||
    (choice !== 'treat' && choice !== 'push')
  ) {
    return state;
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const availablePills = getCurrentRunHealingPillAvailability(state);
  const status = getEscortCheckpointStatus(lawState, availablePills);
  if (
    !status.pending ||
    status.bossSurvivorSnapshot !== null ||
    status.pendingCheckpointNodeId !== state.run.currentNodeId ||
    !status.choices[choice].available
  ) {
    return state;
  }

  const resolution = resolveEscortCheckpointChoice(
    lawState,
    state.run.currentNodeId,
    choice,
    availablePills
  );
  if (!resolution.resolved) return state;

  const consumption = consumeRunLootItem(
    state.run.lootBag,
    'healing_pill',
    resolution.healingPillCost
  );
  if (
    consumption.consumed !== resolution.healingPillCost ||
    state.inventory.healing_pill < resolution.healingPillCost
  ) {
    return state;
  }

  const resolvedState: GameState = {
    ...state,
    inventory: resolution.healingPillCost > 0
      ? {
          ...state.inventory,
          healing_pill: state.inventory.healing_pill - resolution.healingPillCost
        }
      : state.inventory,
    run: {
      ...state.run,
      lootBag: consumption.bag,
      lawState: resolution.state
    }
  };
  const rewardedState = resolution.bonusRewardPoints > 0
    ? applyRunReward(resolvedState, { rewardPoints: resolution.bonusRewardPoints })
    : resolvedState;
  const nextStatus = getEscortCheckpointStatus(
    resolution.state,
    getCurrentRunHealingPillAvailability(rewardedState)
  );
  return appendLog(
    rewardedState,
    choice === 'treat'
      ? `护送检查点已救治：消耗本轮止血丹 ${resolution.healingPillCost}，幸存者生命 ${nextStatus.survivorHp}/100。`
      : `护送检查点已强推：本局奖励点 +${resolution.bonusRewardPoints}，幸存者生命 ${nextStatus.survivorHp}/100。`
  );
}

export function getCurrentVerdictStatus(state: GameState): FalseTestimonyStatus | undefined {
  if (state.run?.dungeonId !== 'false_testimony_court') return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  return lawState ? getFalseTestimonyStatus(lawState) : undefined;
}

export function resolveCurrentVerdictChoice(
  state: GameState,
  suspect: FalseTestimonySuspect
): GameState {
  if (
    state.phase !== 'explore' ||
    state.run?.dungeonId !== 'false_testimony_court'
  ) {
    return state;
  }

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const status = getFalseTestimonyStatus(lawState);
  if (
    status.pendingVerdictNodeId === null ||
    status.pendingVerdictNodeId !== state.run.currentNodeId ||
    status.bossVerdictSnapshot !== null
  ) {
    return state;
  }

  const resolution = resolveFalseTestimonyAccusation(lawState, suspect);
  if (!resolution.resolved) return state;

  const resolvedState = withDungeonLawState(state, resolution.state);
  const rewardedState = resolution.rewardPoints > 0
    ? applyRunReward(resolvedState, { rewardPoints: resolution.rewardPoints })
    : resolvedState;
  const suspectLabels: Record<FalseTestimonySuspect, string> = {
    records_keeper: '卷宗保管员',
    field_medic: '战地医师',
    security_chief: '安保主管',
    route_surveyor: '路线测绘员'
  };
  const verdictText = resolution.correct ? '指控正确' : '指控错误';
  const rewardText = resolution.rewardPoints > 0
    ? `，本局奖励点 +${resolution.rewardPoints}`
    : '，裁决奖励为 0';
  return appendLog(
    rewardedState,
    `${resolution.appealed ? '翻案裁决' : '原始裁决'}：指控${suspectLabels[suspect]}，${verdictText}${rewardText}。`
  );
}

export function isCurrentDungeonFeatureAvailable(state: GameState, feature: ArchiveFeature): boolean {
  const lawState = getNormalizedDungeonLawState(state);
  return !lawState || isArchiveFeatureAvailable(lawState, feature);
}

function getAvailableLearnedMethods(state: GameState): MethodId[] {
  return isCurrentDungeonFeatureAvailable(state, 'method') ? state.learnedMethods : [];
}

function getAvailableActivePet(state: GameState): PetId | undefined {
  return isCurrentDungeonFeatureAvailable(state, 'pet') ? state.activePet : undefined;
}

type TacticalItemAvailability =
  | { available: true }
  | { available: false; reason: 'sealed' | 'not_carried' | 'missing' };

function getTacticalItemAvailability(state: GameState, itemId: TacticalItemId): TacticalItemAvailability {
  if (!isCurrentDungeonFeatureAvailable(state, 'consumable')) {
    return { available: false, reason: 'sealed' };
  }
  if (!isTacticalItemCarried(state.run?.tacticalLoadout, itemId)) {
    return { available: false, reason: 'not_carried' };
  }
  if (state.inventory[itemId] <= 0) {
    return { available: false, reason: 'missing' };
  }
  return { available: true };
}

function getTacticalItemUnavailableLog(state: GameState, itemId: TacticalItemId): string | undefined {
  const availability = getTacticalItemAvailability(state, itemId);
  if (availability.available) return undefined;

  if (availability.reason === 'sealed') {
    return `梦档案馆已封存消耗品，${ITEMS[itemId].name}暂时无法使用。`;
  }
  if (availability.reason === 'not_carried') {
    return `${ITEMS[itemId].name}未装入战术携行，当前无法使用。`;
  }
  return `背包里没有${ITEMS[itemId].name}。`;
}

export function isTacticalItemAvailable(state: GameState, itemId: TacticalItemId): boolean {
  return getTacticalItemAvailability(state, itemId).available;
}

function isDungeonConsumableAvailable(state: GameState, itemId: ItemId): boolean {
  if (ITEMS[itemId].kind === 'material') return true;
  if (!isCurrentDungeonFeatureAvailable(state, 'consumable')) return false;
  return !isTacticalItemId(itemId) || isTacticalItemCarried(state.run?.tacticalLoadout, itemId);
}

function getAvailableEventInventory(state: GameState): Record<ItemId, number> {
  return Object.fromEntries(
    ITEM_IDS.map((itemId) => {
      if (ITEMS[itemId].kind === 'material') return [itemId, state.inventory[itemId]];
      if (isTacticalItemId(itemId)) {
        return [itemId, isTacticalItemAvailable(state, itemId) ? state.inventory[itemId] : 0];
      }
      return [itemId, isCurrentDungeonFeatureAvailable(state, 'consumable') ? state.inventory[itemId] : 0];
    })
  ) as Record<ItemId, number>;
}

function getPreparedTacticalItemIds(state: GameState): readonly TacticalItemId[] {
  return state.preparedItemIds ?? DEFAULT_PREPARED_TACTICAL_ITEM_IDS;
}

export function getTacticalLoadoutStatus(state: GameState): TacticalLoadoutStatus {
  const preparedItemIds = getPreparedTacticalItemIds(state);
  const activeFieldRigs = getActiveEquipmentFieldRigs(state.equipped);
  const validation = validateTacticalLoadout(preparedItemIds, activeFieldRigs);

  return {
    ...validation,
    preparedItemIds: [...preparedItemIds],
    activeFieldRigs,
    usesDefaultPreparation: state.preparedItemIds === undefined,
    runSnapshot: state.run?.tacticalLoadout,
    legacyRunUnrestricted: state.run !== undefined && state.run.tacticalLoadout === undefined
  };
}

export function configureTacticalLoadout(state: GameState, itemIds: readonly string[]): GameState {
  if (state.phase !== 'hub') {
    return appendLog(state, '只能在主神空间配置战术携行。');
  }

  const validation = validateTacticalLoadout(itemIds, getActiveEquipmentFieldRigs(state.equipped));
  if (!validation.isValid) {
    return appendLog(state, `战术携行配置失败：${validation.reasons.join(' ')}当前准备保持不变。`);
  }

  const preparedItemIds = [...validation.normalizedItemIds];
  const itemNames = preparedItemIds.map((itemId) => ITEMS[itemId].name).join('、') || '无';
  return appendLog(
    {
      ...state,
      preparedItemIds
    },
    `战术携行已配置：${itemNames}。`
  );
}

function hasOwnField(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function getNormalizedPreparedEquipmentMemoryHunt(
  value: unknown
): PreparedEquipmentMemoryHunt | undefined {
  try {
    return normalizePreparedEquipmentMemoryHunt(value);
  } catch {
    return undefined;
  }
}

function equipmentMemoryPreparationIssue(
  code: EquipmentMemoryHuntPreparationIssueCode,
  message: string
): EquipmentMemoryHuntPreparationIssue {
  return { code, message };
}

function getConflictingPreparedEquipmentHunt(
  state: GameState,
  dungeonId: DungeonId
): PreparedEquipmentHunt | undefined {
  const prepared = getNormalizedPreparedEquipmentHunt(state.preparedEquipmentHunt);
  return prepared?.dungeonId === dungeonId ? prepared : undefined;
}

function getEquipmentMemoryHuntCandidateStatus(
  state: GameState,
  dungeonId: DungeonId,
  equipmentId: EquipmentMemoryEquipmentId
): EquipmentMemoryHuntCandidateStatus {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  const equipment = EQUIPMENT[equipmentId];
  const owned = state.ownedEquipment.includes(equipmentId);
  const equipped = Object.values(state.equipped).includes(equipmentId);
  const currentLevel = state.equipmentLevels[equipmentId] ?? 1;
  const rawAttunementId = state.equipmentAttunements?.[equipmentId];
  const attunement = rawAttunementId === undefined
    ? undefined
    : getEquipmentAttunementOptions(equipmentId).find((option) => option.id === rawAttunementId);
  const temperRank = getEquipmentTemperStatus(state, equipmentId).currentRank;
  const sealed = isEquipmentCommissionSealed(state, equipmentId);
  const memoryMap = sanitizeEquipmentMemoryMap(state.equipmentMemories);
  const memoryUnlocked = Boolean(
    definition && memoryMap[equipmentId]?.unlockedIds.includes(definition.id)
  );
  const conflictingEquipmentHunt = getConflictingPreparedEquipmentHunt(state, dungeonId);
  const unavailableReasons: EquipmentMemoryHuntPreparationIssue[] = [];

  if (!definition) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'chapter_memory_unavailable',
      '当前章节没有可铭刻的装备记忆。'
    ));
  }
  if (!state.completedDungeonIds.includes(dungeonId)) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'chapter_not_completed',
      `需要先通关${DUNGEONS[dungeonId].name}。`
    ));
  }
  if (conflictingEquipmentHunt) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'equipment_hunt_conflict',
      '同一副本已准备普通装备追猎，两类追猎不能并行。'
    ));
  }
  if (!owned) {
    unavailableReasons.push(equipmentMemoryPreparationIssue('not_owned', '目标装备尚未拥有。'));
  }
  if (!equipped) {
    unavailableReasons.push(equipmentMemoryPreparationIssue('not_equipped', '目标装备当前未装备。'));
  }
  if (currentLevel !== equipment.maxLevel) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'not_max_level',
      `目标装备需要达到最高等级 ${equipment.maxLevel}。`
    ));
  }
  if (!attunement) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'invalid_attunement',
      '目标装备需要生效该装备自己的合法铭刻。'
    ));
  }
  if (temperRank !== 2) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'temper_rank_too_low',
      '目标装备需要淬炼至 II 阶。'
    ));
  }
  if (sealed) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'sealed',
      '目标装备正在装备封存委托中。'
    ));
  }
  if (memoryUnlocked) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'already_unlocked',
      '该装备已经收录本章节记忆。'
    ));
  }

  return {
    equipmentId,
    equipment,
    owned,
    equipped,
    currentLevel,
    maxLevel: equipment.maxLevel,
    ...(attunement === undefined
      ? {}
      : { attunementId: attunement.id, attunement: getEquipmentAttunementDefinition(attunement.id) }),
    temperRank,
    sealed,
    memoryUnlocked,
    available: unavailableReasons.length === 0,
    unavailableReasons,
    ...(unavailableReasons.length === 0
      ? {}
      : { unavailableReason: unavailableReasons.map((reason) => reason.message).join(' ') })
  };
}

export function getEquipmentMemoryHuntPreparationStatus(
  state: GameState,
  dungeonId: DungeonId
): EquipmentMemoryHuntPreparationStatus {
  const definition = getEquipmentMemoryForDungeon(dungeonId);
  const candidates = EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.map((equipmentId) => {
    return getEquipmentMemoryHuntCandidateStatus(state, dungeonId, equipmentId);
  });
  const targetEquipmentIds = candidates
    .filter((candidate) => candidate.available)
    .map((candidate) => candidate.equipmentId);
  const prepared = getNormalizedPreparedEquipmentMemoryHunt(state.preparedEquipmentMemoryHunt);
  const preparedCandidate = prepared?.dungeonId === dungeonId
    ? candidates.find((candidate) => candidate.equipmentId === prepared.equipmentId)
    : undefined;
  const conflictingEquipmentHunt = getConflictingPreparedEquipmentHunt(state, dungeonId);
  const unavailableReasons: EquipmentMemoryHuntPreparationIssue[] = [];

  if (!definition) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'chapter_memory_unavailable',
      '当前章节没有可铭刻的装备记忆。'
    ));
  }
  if (!state.completedDungeonIds.includes(dungeonId)) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'chapter_not_completed',
      `需要先通关${DUNGEONS[dungeonId].name}。`
    ));
  }
  if (conflictingEquipmentHunt) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'equipment_hunt_conflict',
      '同一副本已准备普通装备追猎，两类追猎不能并行。'
    ));
  }
  if (targetEquipmentIds.length === 0 && unavailableReasons.length === 0) {
    unavailableReasons.push(equipmentMemoryPreparationIssue(
      'no_eligible_equipment',
      '当前没有同时满足装备、铭刻与淬炼条件的目标装备。'
    ));
  }

  return {
    dungeonId,
    ...(definition === undefined ? {} : { definition, memory: definition }),
    candidates,
    targetEquipmentIds,
    ...(prepared === undefined ? {} : { prepared, currentPrepared: prepared }),
    ...(preparedCandidate === undefined ? {} : { preparedCandidate }),
    equipmentHuntConflict: conflictingEquipmentHunt !== undefined,
    ...(conflictingEquipmentHunt === undefined ? {} : { conflictingEquipmentHunt }),
    available: targetEquipmentIds.length > 0,
    unavailableReasons,
    ...(unavailableReasons.length === 0
      ? {}
      : { unavailableReason: unavailableReasons.map((reason) => reason.message).join(' ') })
  };
}

export function prepareEquipmentMemoryHunt(
  state: GameState,
  dungeonId: DungeonId,
  equipmentId?: EquipmentId
): GameState {
  if (state.phase !== 'hub') {
    return appendLog(state, '只能在主神空间准备铭刻记忆狩猎。');
  }

  if (equipmentId === undefined) {
    if (state.preparedEquipmentMemoryHunt === undefined) return state;
    return appendLog(
      { ...state, preparedEquipmentMemoryHunt: undefined },
      '铭刻记忆狩猎准备已清除。'
    );
  }

  if (!EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.includes(equipmentId as EquipmentMemoryEquipmentId)) {
    return appendLog(state, '铭刻记忆狩猎准备失败：目标装备不在 16 件记忆装备目录内。');
  }

  const status = getEquipmentMemoryHuntPreparationStatus(state, dungeonId);
  const candidate = status.candidates.find((entry) => entry.equipmentId === equipmentId);
  if (!status.definition || !candidate?.available) {
    return appendLog(
      state,
      `铭刻记忆狩猎准备失败：${candidate?.unavailableReason ?? status.unavailableReason ?? '当前目标不可用。'}`
    );
  }

  const current = getNormalizedPreparedEquipmentMemoryHunt(state.preparedEquipmentMemoryHunt);
  if (current?.dungeonId === dungeonId && current.equipmentId === equipmentId) return state;

  const preparedEquipmentMemoryHunt = createPreparedEquipmentMemoryHunt(
    dungeonId,
    equipmentId,
    status.definition.id
  );
  if (!preparedEquipmentMemoryHunt) {
    return appendLog(state, '铭刻记忆狩猎准备失败：规则目录未接受当前组合。');
  }

  return appendLog(
    { ...state, preparedEquipmentMemoryHunt },
    `铭刻记忆狩猎已锁定${DUNGEONS[dungeonId].name}的${EQUIPMENT[equipmentId].name}，目标记忆「${status.definition.name}」。`
  );
}

export function getEquipmentMemoryStatus(
  state: GameState,
  equipmentId: EquipmentId
): EquipmentMemoryStatus {
  const memoryMap = sanitizeEquipmentMemoryMap(state.equipmentMemories);
  const entry = memoryMap[equipmentId];
  const unlockedMemories = (entry?.unlockedIds ?? []).flatMap((memoryId) => {
    const definition = getEquipmentMemoryById(memoryId);
    return definition ? [definition] : [];
  });
  const activeMemory = getEquipmentMemoryById(entry?.activeId);

  return {
    equipmentId,
    equipment: EQUIPMENT[equipmentId],
    supported: EQUIPMENT_MEMORY_EQUIPMENT_CATALOG.includes(equipmentId as EquipmentMemoryEquipmentId),
    owned: state.ownedEquipment.includes(equipmentId),
    equipped: Object.values(state.equipped).includes(equipmentId),
    unlockedMemories,
    ...(activeMemory === undefined ? {} : { activeMemory })
  };
}

export function activateOwnedEquipmentMemory(
  state: GameState,
  equipmentId: EquipmentId,
  memoryId: EquipmentMemoryId
): GameState {
  if (state.phase !== 'hub') return appendLog(state, '只能在主神空间切换装备记忆。');
  if (!state.ownedEquipment.includes(equipmentId)) {
    return appendLog(state, '装备记忆切换失败：你还没有这件装备。');
  }

  const memoryMap = sanitizeEquipmentMemoryMap(state.equipmentMemories);
  const entry = memoryMap[equipmentId];
  if (!entry?.unlockedIds.includes(memoryId)) {
    return appendLog(state, '装备记忆切换失败：该装备尚未解锁这段记忆。');
  }
  if (entry.activeId === memoryId) return state;

  const equipmentMemories = activateEquipmentMemory(memoryMap, equipmentId, memoryId);
  const definition = getEquipmentMemoryById(memoryId);
  return appendLog(
    { ...state, equipmentMemories },
    `${EQUIPMENT[equipmentId].name}已激活装备记忆「${definition?.name ?? memoryId}」。`
  );
}

function getNormalizedEquipmentMemoryHuntSettlement(
  value: unknown
): EquipmentMemoryHuntSettlement | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const settlement = value as { state?: unknown; granted?: unknown };
  if (!hasOwnField(settlement, 'state') || typeof settlement.granted !== 'boolean') return undefined;
  const huntState = normalizeEquipmentMemoryHuntRunState(settlement.state);
  if (settlement.state !== undefined && !huntState) return undefined;
  if (settlement.granted && huntState?.status !== 'banked') return undefined;
  return { state: huntState, granted: settlement.granted };
}

export function getCurrentEquipmentMemoryHuntStatus(
  state: GameState
): CurrentEquipmentMemoryHuntStatus {
  const run = state.run;
  const huntState = normalizeEquipmentMemoryHuntRunState(run?.equipmentMemoryHunt);
  const settlement = getNormalizedEquipmentMemoryHuntSettlement(
    run?.lastEquipmentMemoryHuntSettlement
  );
  const evidenceState = huntState ?? settlement?.state;
  const definition = evidenceState ? getEquipmentMemoryById(evidenceState.memoryId) : undefined;
  const progress = getEquipmentMemoryHuntProgress(evidenceState);
  const display = getEquipmentMemoryHuntDisplayStatus(evidenceState);
  const hasSnapshotField = run ? hasOwnField(run, 'equipmentMemorySnapshot') : false;
  const malformedHunt = Boolean(
    run && hasOwnField(run, 'equipmentMemoryHunt') &&
    run.equipmentMemoryHunt !== undefined && !huntState
  );
  const malformedSettlement = Boolean(
    run && hasOwnField(run, 'lastEquipmentMemoryHuntSettlement') &&
    run.lastEquipmentMemoryHuntSettlement !== undefined && !settlement
  );

  return {
    enabled: evidenceState !== undefined,
    legacyDisabled: Boolean(run && !hasSnapshotField),
    malformedDisabled: malformedHunt || malformedSettlement,
    ...(evidenceState === undefined ? {} : { state: evidenceState }),
    ...(definition === undefined ? {} : { definition }),
    ...(evidenceState === undefined ? {} : { equipment: EQUIPMENT[evidenceState.equipmentId] }),
    ...(evidenceState === undefined
      ? {}
      : { attunement: getEquipmentAttunementDefinition(evidenceState.attunementId) }),
    progress,
    display,
    ...(settlement === undefined ? {} : { settlement })
  };
}

export function getCurrentEquipmentMemoryCombatStatus(
  state: GameState
): CurrentEquipmentMemoryCombatStatus {
  const run = state.run;
  const combatState = normalizeEquipmentMemoryCombatState(state.combat?.equipmentMemoryState);
  const snapshot = normalizeEquipmentMemoryRunSnapshot(run?.equipmentMemorySnapshot);
  const snapshotMatch = run && snapshot
    ? getEquipmentMemoryRunSnapshotMatch(snapshot, run.dungeonId)
    : undefined;
  const definition = combatState ? getEquipmentMemoryById(combatState.memoryId) : undefined;
  const hasSnapshotField = run ? hasOwnField(run, 'equipmentMemorySnapshot') : false;
  const malformedSnapshot = Boolean(
    run && hasSnapshotField && run.equipmentMemorySnapshot !== undefined && !snapshot
  );
  const malformedCombat = Boolean(
    state.combat && hasOwnField(state.combat, 'equipmentMemoryState') &&
    state.combat.equipmentMemoryState !== undefined && !combatState
  );

  return {
    enabled: combatState !== undefined,
    legacyDisabled: Boolean(run && !hasSnapshotField),
    malformedDisabled: malformedSnapshot || malformedCombat,
    ...(combatState === undefined ? {} : { state: combatState }),
    ...(definition === undefined ? {} : { definition, activeName: definition.name }),
    ...(snapshotMatch === undefined ? {} : { snapshotMatch }),
    matchingEquipmentIds: snapshotMatch?.entries.map((entry) => entry.equipmentId) ?? [],
    overflowStored: combatState?.overflowFocus === 1,
    restored: combatState?.restored ?? false
  };
}

function getNormalizedPreparedEquipmentHunt(value: unknown): PreparedEquipmentHunt | undefined {
  try {
    return normalizePreparedEquipmentHunt(value);
  } catch {
    return undefined;
  }
}

function getValidPreparedEquipmentHunt(
  state: GameState,
  dungeonId: DungeonId
): PreparedEquipmentHunt | undefined {
  const prepared = getNormalizedPreparedEquipmentHunt(state.preparedEquipmentHunt);
  if (prepared?.dungeonId !== dungeonId) return undefined;

  return getEquipmentHuntTargetIds(dungeonId, state.ownedEquipment).includes(prepared.targetEquipmentId)
    ? prepared
    : undefined;
}

function getEquipmentHuntClueStatuses(
  dungeonId: DungeonId,
  clueNodeIds: readonly string[],
  clearedNodeIds: readonly string[]
): EquipmentHuntClueStatus[] {
  const cleared = new Set(clearedNodeIds);
  const dungeon = DUNGEONS[dungeonId];

  return clueNodeIds.map((nodeId) => ({
    nodeId,
    title: getNodeById(dungeon, nodeId)?.title ?? nodeId,
    cleared: cleared.has(nodeId)
  }));
}

export function getEquipmentHuntPreparationStatus(
  state: GameState,
  dungeonId: DungeonId
): EquipmentHuntPreparationStatus {
  const definition = getEquipmentHuntDefinition(dungeonId);
  const targetEquipmentIds = getEquipmentHuntTargetIds(dungeonId, state.ownedEquipment);
  const prepared = getValidPreparedEquipmentHunt(state, dungeonId);

  return {
    dungeonId,
    targetEquipmentIds: [...targetEquipmentIds],
    ...(prepared === undefined ? {} : { targetEquipmentId: prepared.targetEquipmentId }),
    clueNodes: getEquipmentHuntClueStatuses(dungeonId, definition.clueNodeIds, [])
  };
}

export function getCurrentEquipmentHuntStatus(state: GameState): CurrentEquipmentHuntStatus {
  const run = state.run;
  if (!run || !isEquipmentHuntRunState(run.equipmentHunt)) {
    return {
      enabled: false,
      clueNodes: [],
      cleared: false,
      qualified: false,
      crossed: false,
      offer: false,
      selected: false,
      passed: false
    };
  }

  const snapshot = run.equipmentHunt;
  const progress = getEquipmentHuntProgress(
    snapshot,
    run.dungeonId,
    run.clearedNodeIds,
    run.lootOffersMade
  );
  const offer = run.pendingEquipmentOffer?.guaranteedEquipmentId === snapshot.targetEquipmentId;
  const selected =
    run.lootBag.equipmentIds.includes(snapshot.targetEquipmentId) ||
    run.lastLootSettlement?.retained.equipmentIds.includes(snapshot.targetEquipmentId) === true ||
    run.lastLootSettlement?.lost.equipmentIds.includes(snapshot.targetEquipmentId) === true;
  // A portal crossing or consumed first offer permanently closes this run's one-shot hunt window.
  const passed =
    !selected &&
    (progress.crossedDungeonPortal ||
      run.dungeonId !== snapshot.dungeonId ||
      (run.lootOffersMade > 0 && !offer));

  return {
    enabled: true,
    dungeonId: snapshot.dungeonId,
    targetEquipmentId: snapshot.targetEquipmentId,
    clueNodes: getEquipmentHuntClueStatuses(
      snapshot.dungeonId,
      snapshot.clueNodeIds,
      progress.clearedClueNodeIds
    ),
    cleared: progress.clearedClueNodeIds.length > 0,
    qualified: progress.qualified,
    crossed: progress.crossedDungeonPortal,
    offer,
    selected,
    passed
  };
}

export function prepareEquipmentHunt(
  state: GameState,
  dungeonId: DungeonId,
  targetEquipmentId?: EquipmentId
): GameState {
  if (state.phase !== 'hub') {
    return appendLog(state, '只能在主神空间准备装备追猎。');
  }

  if (targetEquipmentId === undefined) {
    if (state.preparedEquipmentHunt === undefined) return state;
    return appendLog({ ...state, preparedEquipmentHunt: undefined }, '装备追猎准备已清除。');
  }

  const preparedMemoryHunt = getNormalizedPreparedEquipmentMemoryHunt(
    state.preparedEquipmentMemoryHunt
  );
  if (preparedMemoryHunt?.dungeonId === dungeonId) {
    return appendLog(
      state,
      '装备追猎准备失败：同一副本已准备铭刻记忆狩猎，两类追猎不能并行。'
    );
  }

  const targetEquipmentIds = getEquipmentHuntTargetIds(dungeonId, state.ownedEquipment);
  if (!targetEquipmentIds.includes(targetEquipmentId)) {
    const reason = state.ownedEquipment.includes(targetEquipmentId)
      ? `${EQUIPMENT[targetEquipmentId]?.name ?? targetEquipmentId}已经入架`
      : '目标不在该副本装备池中';
    return appendLog(state, `装备追猎准备失败：${reason}。`);
  }

  const current = getNormalizedPreparedEquipmentHunt(state.preparedEquipmentHunt);
  if (current?.dungeonId === dungeonId && current.targetEquipmentId === targetEquipmentId) return state;

  const preparedEquipmentHunt = normalizePreparedEquipmentHunt({ dungeonId, targetEquipmentId });
  return appendLog(
    { ...state, preparedEquipmentHunt },
    `装备追猎已锁定${DUNGEONS[dungeonId].name}的${EQUIPMENT[targetEquipmentId].name}。`
  );
}

function getArchivedRunRelicIds(state: GameState): RunRelicId[] {
  const archivedRelicIds = Array.isArray(state.archivedRelicIds) ? state.archivedRelicIds : [];
  return [...new Set(archivedRelicIds.filter(isRunRelicId))];
}

export function getRunRelicPreparationStatus(state: GameState): RunRelicPreparationStatus {
  const preparedRelicFrame = isRunRelicFrame(state.preparedRelicFrame)
    ? state.preparedRelicFrame
    : 'assault';
  const archivedRelicIds = getArchivedRunRelicIds(state);
  const preparedRelicSeedId =
    isRunRelicId(state.preparedRelicSeedId) &&
    archivedRelicIds.includes(state.preparedRelicSeedId) &&
    RUN_RELIC_DEFINITIONS[state.preparedRelicSeedId].frame === preparedRelicFrame
      ? state.preparedRelicSeedId
      : undefined;
  const activeConduits = getActiveEquipmentRelicConduits(state.equipped, state.equipmentLevels);
  const frameMatch = getEquipmentRelicConduitFrameMatch(preparedRelicFrame, activeConduits);
  const runState = isRunRelicState(state.run?.relicState) ? state.run.relicState : undefined;

  return {
    preparedRelicFrame,
    archivedRelicIds,
    ...(preparedRelicSeedId === undefined ? {} : { preparedRelicSeedId }),
    activeConduits,
    matchingConduitSourceEquipmentIds: [...frameMatch.sourceEquipmentIds],
    usesDefaultPreparation: state.preparedRelicFrame === undefined,
    ...(runState === undefined ? {} : { runState }),
    frozenConduitSourceEquipmentIds: [...(state.run?.relicConduitSourceEquipmentIds ?? [])],
    legacyRunWithoutRelics: state.run !== undefined && runState === undefined
  };
}

export function configureRunRelicPreparation(
  state: GameState,
  frame: RunRelicFrame,
  seedRelicId?: RunRelicId
): GameState {
  if (state.phase !== 'hub') {
    return appendLog(state, '只能在主神空间配置回响遗物框架。');
  }
  if (!isRunRelicFrame(frame)) {
    return appendLog(state, '未知回响遗物框架，当前准备保持不变。');
  }

  const archivedRelicIds = getArchivedRunRelicIds(state);
  if (seedRelicId !== undefined) {
    if (!isRunRelicId(seedRelicId)) {
      return appendLog(state, '未知回响遗物不能设为归档种子，当前准备保持不变。');
    }

    const relic = RUN_RELIC_DEFINITIONS[seedRelicId];
    if (!archivedRelicIds.includes(seedRelicId)) {
      return appendLog(state, `回响遗物「${relic.name}」尚未归档，不能设为归档种子。`);
    }
    if (relic.frame !== frame) {
      return appendLog(
        state,
        `回响遗物「${relic.name}」不属于「${RUN_RELIC_FRAME_DEFINITIONS[frame].name}」框架，当前准备保持不变。`
      );
    }
  }

  const frameName = RUN_RELIC_FRAME_DEFINITIONS[frame].name;
  const seedName = seedRelicId === undefined ? '无' : RUN_RELIC_DEFINITIONS[seedRelicId].name;
  return appendLog(
    {
      ...state,
      preparedRelicFrame: frame,
      archivedRelicIds: [...archivedRelicIds],
      preparedRelicSeedId: seedRelicId
    },
    `回响遗物整备已设为「${frameName}」框架，归档种子：${seedName}。`
  );
}

export function getCurrentRunRelicEffects(state: GameState): RunRelicEffects {
  return isRunRelicState(state.run?.relicState)
    ? aggregateRunRelicEffects(state.run.relicState.acquiredIds)
    : DEFAULT_RUN_RELIC_EFFECTS;
}

function scaleByPercent(value: number, percentDelta: number, minimum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.ceil((Math.max(0, value) * (100 + percentDelta)) / 100));
}

function getDungeonLawModifierContext(state: GameState): DungeonLawModifierContext {
  if (!state.run || !state.combat) return {};
  return {
    isReflectionEncounter: state.combat.monsterId === 'mirror_thread_spider',
    isBossEncounter: Boolean(getBossDefinitionForNode(state.run.dungeonId, state.combat.nodeId)),
    isBossAwakened: state.combat.bossPhase === 'awakened'
  };
}

export type CurrentDungeonLaw = {
  state: DungeonLawState;
  display: DungeonLawDisplayModel;
  modifiers: DungeonLawModifiers;
};

export function getCurrentDungeonLaw(state: GameState): CurrentDungeonLaw | undefined {
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  return {
    state: lawState,
    display: getDungeonLawDisplay(lawState, {
      availableHealingPills: getCurrentRunHealingPillAvailability(state)
    }),
    modifiers: getDungeonLawModifiers(lawState, getDungeonLawModifierContext(state))
  };
}

export type CurrentRunPressureStatus = NonNullable<ReturnType<typeof getRunPressureStatus>>;

export type CurrentRunPressure = {
  readonly legacyDisabled: boolean;
  readonly status?: CurrentRunPressureStatus;
};

export function getCurrentRunPressure(state: GameState): CurrentRunPressure {
  if (!state.run) return { legacyDisabled: false };
  if (!isRunPressureState(state.run.pressureState)) return { legacyDisabled: true };

  const status = getRunPressureStatus(state.run.pressureState);
  if (!status) return { legacyDisabled: true };

  return {
    legacyDisabled: false,
    status
  };
}

export type CurrentRunPursuit = {
  readonly legacyDisabled: boolean;
  readonly definition?: RunPursuitDefinition;
  readonly progress?: RunPursuitProgress;
  readonly display?: RunPursuitDisplay;
  readonly lastSettlement?: RunPursuitSettlement;
};

export function getCurrentRunPursuit(state: GameState): CurrentRunPursuit {
  if (!state.run) return { legacyDisabled: false };

  const definition = getRunPursuitDefinition(state.run.dungeonId);
  if (!definition) return { legacyDisabled: true };

  const pursuitState = getStrictRunPursuitState(state.run);
  const displayState = pursuitState ?? createRunPursuitState(state.run.dungeonId, false);
  const clearedNodeCount = pursuitState
    ? isRunPressureState(state.run.pressureState)
      ? state.run.pressureState.clearedNodeCount
      : state.run.clearedNodeIds.length
    : 0;
  const lastSettlement = getNormalizedRunPursuitSettlement(state.run.lastPursuitSettlement);

  return {
    legacyDisabled: pursuitState === undefined,
    definition,
    progress: getRunPursuitProgress(displayState, clearedNodeCount),
    display: getRunPursuitDisplay(displayState, clearedNodeCount),
    ...(lastSettlement === undefined ? {} : { lastSettlement })
  };
}

export type CurrentRouteContract = {
  readonly legacyDisabled: boolean;
  readonly definition?: RouteContractDefinition;
  readonly progress: RouteContractProgress;
  readonly display: RouteContractDisplayStatus;
  readonly lastSettlement?: RouteContractSettlement;
};

function hasRouteContractStateField(run: DungeonRun): boolean {
  return Object.prototype.hasOwnProperty.call(run, 'routeContractState');
}

export function getCurrentRouteContract(state: GameState): CurrentRouteContract {
  const run = state.run;
  const dungeonId = run?.dungeonId ?? 'demon_tower_1';
  const progress = getRouteContractProgress(run?.routeContractState, dungeonId);
  const display = getRouteContractDisplayStatus(run?.routeContractState, dungeonId);

  return {
    legacyDisabled: run !== undefined && !hasRouteContractStateField(run),
    ...(progress.definition === undefined ? {} : { definition: progress.definition }),
    progress,
    display,
    ...(run?.lastRouteContractSettlement === undefined
      ? {}
      : { lastSettlement: run.lastRouteContractSettlement })
  };
}

function getRunProtocolId(run: DungeonRun | undefined): RunProtocolId {
  return run?.protocol?.id ?? 'standard';
}

export type CurrentRunProtocol = {
  snapshot: RunProtocolSnapshot;
  definition: RunProtocolDefinition;
  completedAnchorCount: number;
  requiredAnchorCount: number;
  anchorCompleted: boolean;
  bossDefeated: boolean;
  bossBreachActive: boolean;
  settlement?: RunProtocolSettlement;
};

export function getCurrentRunProtocol(state: GameState): CurrentRunProtocol | undefined {
  if (!state.run) return undefined;

  const snapshot = state.run.protocol ?? { id: 'standard', rulesVersion: 1 };
  const definition = getRunProtocolDefinition(state.run.dungeonId, snapshot.id);
  if (!definition) return undefined;

  const bossNodeId = getBossDefinition(state.run.dungeonId).nodeId;
  const bossIndex = state.run.clearedNodeIds.indexOf(bossNodeId);
  const bossDefeated = bossIndex >= 0;
  const simplifiedEntry = state.run.entryFlowVersion === 2;
  const requiredNodeIds = simplifiedEntry ? [] : getRunProtocolRequiredNodeIds(definition);
  const completedAnchorCount = requiredNodeIds.filter((nodeId) => {
    const anchorIndex = state.run?.clearedNodeIds.indexOf(nodeId) ?? -1;
    return anchorIndex >= 0 && (!bossDefeated || anchorIndex < bossIndex);
  }).length;
  const requiredAnchorCount = requiredNodeIds.length;
  const anchorCompleted = completedAnchorCount === requiredAnchorCount;

  return {
    snapshot,
    definition,
    completedAnchorCount,
    requiredAnchorCount,
    anchorCompleted,
    bossDefeated,
    bossBreachActive:
      !simplifiedEntry &&
      definition.id !== 'standard' &&
      state.combat?.nodeId === bossNodeId &&
      state.combat.protocolAnchorCompletedBeforeBoss === false,
    settlement: state.run.lastProtocolSettlement
  };
}

function isProtocolAnchorCompletedBeforeBoss(state: GameState): boolean {
  if (state.run?.entryFlowVersion === 2) return true;
  const protocol = getCurrentRunProtocol(state);
  return protocol?.anchorCompleted ?? true;
}

function getProtocolMonster(
  state: GameState,
  monster: MonsterDefinition,
  bossDefinition?: BossDefinition,
  bossPhase: BossPhase = 'sealed',
  anchorCompletedBeforeBoss = true
): MonsterDefinition {
  const bossStats = bossDefinition
    ? getBossCombatStats(
        bossDefinition,
        { maxHp: monster.maxHp, attack: monster.attack, defense: monster.defense },
        bossPhase
      )
    : undefined;
  const encounterMonster = bossStats ? { ...monster, ...bossStats } : monster;
  const lawState = getNormalizedDungeonLawState(state);
  const lawModifiers = lawState
    ? getDungeonLawModifiers(lawState, {
        isReflectionEncounter: monster.id === 'mirror_thread_spider',
        isBossEncounter: Boolean(bossDefinition),
        isBossAwakened: Boolean(bossDefinition) && bossPhase === 'awakened'
      })
    : undefined;
  const allStatsPercent = lawModifiers?.encounter.allStatsPercent ?? 0;
  const lawMonster: MonsterDefinition = lawModifiers
    ? {
        ...encounterMonster,
        maxHp: scaleByPercent(encounterMonster.maxHp, allStatsPercent, 1),
        attack: scaleByPercent(encounterMonster.attack, allStatsPercent, 1),
        artPower: scaleByPercent(
          scaleByPercent(encounterMonster.artPower, allStatsPercent, 0),
          lawModifiers.encounter.artPowerPercent,
          0
        ),
        defense: scaleByPercent(
          scaleByPercent(encounterMonster.defense, allStatsPercent, 0),
          lawModifiers.encounter.defensePercent,
          0
        ),
        speed: scaleByPercent(encounterMonster.speed, allStatsPercent, 1)
      }
    : encounterMonster;

  // Encounter stats layer deterministically: base/boss, law, protocol, then cross-dungeon pressure.
  const protocolMonster = scaleMonsterForRunProtocol(lawMonster, getRunProtocolId(state.run), {
    isBoss: Boolean(bossDefinition),
    anchorCompletedBeforeBoss
  });
  const pressureMonster = scaleMonsterForRunPressure(protocolMonster, state.run?.pressureState);
  if (!bossDefinition || !state.run) return pressureMonster;

  const pursuitState = getStrictRunPursuitState(state.run);
  const fusionPercent = getRunPursuitBossFusionPercent(pursuitState);
  const definition = pursuitState ? getRunPursuitDefinition(pursuitState.dungeonId) : undefined;
  if (fusionPercent <= 0 || !definition) return pressureMonster;

  // Pursuit fusion is the final encounter layer so every boss phase receives it exactly once.
  return {
    ...pressureMonster,
    maxHp: scaleByPercent(pressureMonster.maxHp, fusionPercent, 1),
    attack: scaleByPercent(pressureMonster.attack, fusionPercent, 1),
    artPower: scaleByPercent(pressureMonster.artPower, fusionPercent, 0),
    defense: scaleByPercent(pressureMonster.defense, fusionPercent, 0),
    speed: scaleByPercent(pressureMonster.speed, fusionPercent, 1),
    ability: pressureMonster.ability.includes(definition.fusionDescription)
      ? pressureMonster.ability
      : `${pressureMonster.ability} ${definition.fusionDescription}`
  };
}

export type CombatEncounterProfile = {
  monster: MonsterDefinition;
  boss?: {
    definition: BossDefinition;
    phase: BossPhase;
  };
};

export function getCombatEncounterProfile(state: GameState): CombatEncounterProfile | undefined {
  if (!state.combat) return undefined;

  const baseMonster = MONSTERS[state.combat.monsterId];
  const bossDefinition = state.run
    ? getBossDefinitionForNode(state.run.dungeonId, state.combat.nodeId)
    : undefined;
  if (!bossDefinition) return { monster: getProtocolMonster(state, baseMonster) };

  const phase = state.combat.bossPhase ?? 'sealed';
  const monster = getProtocolMonster(
    state,
    baseMonster,
    bossDefinition,
    phase,
    state.combat.protocolAnchorCompletedBeforeBoss ?? isProtocolAnchorCompletedBeforeBoss(state)
  );

  return {
    monster,
    boss: {
      definition: bossDefinition,
      phase
    }
  };
}

export function getCurrentCombatIntent(state: GameState): CombatIntent | undefined {
  if (!state.combat) return undefined;
  return getCombatIntent({
    monsterId: state.combat.monsterId,
    turn: state.combat.turn,
    effects: state.combat.effects,
    equipped: state.equipped,
    learnedMethods: getAvailableLearnedMethods(state)
  });
}

export function getCurrentWeaponResonanceProgress(state: GameState): EquipmentAttunementResonanceProgress {
  return getEquipmentAttunementResonanceProgress(
    state.equipped.weapon,
    Object.values(state.equipped),
    state.equipmentLevels,
    state.equipmentAttunements ?? {}
  );
}

export function getWeaponSkillStatus(state: GameState): WeaponSkillStatus {
  const weaponId = state.equipped.weapon;
  const weaponName = EQUIPMENT[weaponId].name;
  const definition = getWeaponSkillDefinition(weaponId);
  const resonance = getCurrentWeaponResonanceProgress(state);
  const currentFocus = normalizeCombatFocus(state.combat?.weaponFocus);
  const focus = {
    currentFocus,
    requiredFocus: COMBAT_FOCUS_MAX
  };

  if (!definition) {
    return {
      weaponId,
      weaponName,
      resonance,
      ...focus,
      available: false,
      unavailableReason: `${weaponName}没有可用战技。`
    };
  }

  if (state.phase !== 'combat' || !state.combat) {
    return {
      weaponId,
      weaponName,
      definition,
      resonance,
      ...focus,
      available: false,
      unavailableReason: '当前不在战斗中，无法发动战技。'
    };
  }

  if (currentFocus < COMBAT_FOCUS_MAX) {
    return {
      weaponId,
      weaponName,
      definition,
      resonance,
      ...focus,
      available: false,
      unavailableReason: `战意未满（${currentFocus}/${COMBAT_FOCUS_MAX}），无法发动${definition.name}。`
    };
  }

  return {
    weaponId,
    weaponName,
    definition,
    resonance,
    ...focus,
    available: true
  };
}

export function getBossSealStatus(state: GameState, dungeonId = state.run?.dungeonId): BossSealProgress | undefined {
  if (!dungeonId) return undefined;

  const clearedNodeIds =
    state.run?.dungeonId === dungeonId
      ? state.run.clearedNodeIds
      : state.completedDungeonIds.includes(dungeonId)
        ? [getBossDefinition(dungeonId).nodeId]
        : [];
  return getBossSealProgress(dungeonId, clearedNodeIds);
}

function advanceBossPhase(state: GameState): GameState {
  const profile = getCombatEncounterProfile(state);
  if (!state.combat || !profile?.boss) return state;

  const transition = getBossPhaseTransition(
    profile.boss.definition,
    profile.boss.phase,
    state.combat.monsterHp,
    profile.monster.maxHp
  );
  if (!transition.transitioned) return state;

  return {
    ...state,
    combat: {
      ...state.combat,
      bossPhase: transition.phase,
      log: [transition.statusLine, ...state.combat.log].slice(0, 8)
    }
  };
}

export function getNodeDepartureBlock(state: GameState): NodeDepartureBlock | undefined {
  const node = getCurrentNode(state);
  if (!node) return undefined;
  if (isEquipmentSoulSkillRunState(state.run?.soulSkillState) && state.run.soulSkillState.pendingRecharge) {
    return { kind: 'soul_recharge_pending', message: SOUL_RECHARGE_PENDING_BLOCK_MESSAGE };
  }
  if (state.run?.pendingEquipmentOffer) {
    return { kind: 'equipment_offer', message: '先处理当前精英战利品，选择或放弃后才能离开。' };
  }
  if (isRunRelicState(state.run?.relicState) && state.run.relicState.pendingDraft) {
    return { kind: 'relic_draft', message: '先选择当前回响遗物，确认后才能离开。' };
  }
  const causalLedger = getCurrentCausalLedgerStatus(state);
  if (causalLedger?.pending) {
    return {
      kind: 'causal_ledger',
      message: '因果账本尚未结算，请先选择平衡、透支或偿还。'
    };
  }
  const entropyHeading = getCurrentEntropyHeadingStatus(state);
  if (entropyHeading?.pending) {
    return {
      kind: 'entropy_heading',
      message: '方舟航向尚未指定，请先选择稳航或抢航。'
    };
  }
  const mirrorCityPhase = getCurrentMirrorCityPhaseStatus(state);
  if (mirrorCityPhase?.pending) {
    return {
      kind: 'mirror_phase',
      message: '镜城相位尚未指定，请先选择现实或镜像。'
    };
  }
  const redactionClause = getCurrentRedactionClauseStatus(state);
  if (redactionClause?.pending) {
    return {
      kind: 'redaction_clause',
      message: '终稿条款尚未裁定，请先选择认证或删改。'
    };
  }
  const auctionLot = getCurrentAuctionLotStatus(state);
  if (auctionLot?.pending) {
    return {
      kind: 'auction_lot',
      message: '遗产拍品尚未裁定，请先选择竞得、焚毁或放弃。'
    };
  }
  const genesisSplice = getCurrentGenesisSpliceStatus(state);
  if (genesisSplice?.pending) {
    return {
      kind: 'genesis_splice',
      message: '原型拼接尚未完成，请先选择武力、术法、守御或复生基因。'
    };
  }
  const broadcastRelay = getCurrentBroadcastRelayStatus(state);
  if (broadcastRelay?.pending) {
    return {
      kind: 'broadcast_relay',
      message: '广播中继尚未调谐，请先选择静默或播送。'
    };
  }
  const escortCheckpoint = getCurrentEscortCheckpointStatus(state);
  if (escortCheckpoint?.pending) {
    return {
      kind: 'escort_checkpoint',
      message: '护送检查点尚未处理，请先选择救治或强推。'
    };
  }
  const verdict = getCurrentVerdictStatus(state);
  if (verdict?.pendingVerdictNodeId) {
    return {
      kind: 'false_testimony_verdict',
      message: verdict.pendingVerdictNodeId === 'appeal_desk'
        ? '翻案裁决尚未完成，请先重新选择指控对象。'
        : '原始裁决尚未完成，请先选择指控对象。'
    };
  }
  if (state.run?.dungeonId === 'panopticon_city') {
    const lawState = getNormalizedDungeonLawState(state);
    const panopticon = lawState ? getPanopticonStatus(lawState) : undefined;
    if (panopticon?.pendingRouteNodeId === state.run.currentNodeId) {
      return {
        kind: 'panopticon_route',
        message: '三座盲区中继已经闭环，请先选择影路、诱饵或折光路线再离开。'
      };
    }
  }
  if (state.run?.clearedNodeIds.includes(node.id)) return undefined;

  if (node.type === 'monster') {
    return { kind: 'uncleared_monster', message: `先处理当前怪物「${node.title}」，清理后才能离开。` };
  }
  if (node.type === 'trap') {
    return { kind: 'uncleared_trap', message: `先处理当前陷阱「${node.title}」，处理后才能离开。` };
  }
  return undefined;
}

export function getNodeDepartureBlockReason(state: GameState): string | undefined {
  return getNodeDepartureBlock(state)?.message;
}

function getNodeById(dungeon: DungeonDefinition, nodeId: string): DungeonNode | undefined {
  return dungeon.nodes.find((node) => node.id === nodeId);
}

function areAdjacentNodes(source: DungeonNode, target: DungeonNode): boolean {
  const dx = Math.abs(source.position.x - target.position.x);
  const dy = Math.abs(source.position.y - target.position.y);

  return dx + dy === 1;
}

export function getCurrentRouteGateStatus(
  state: GameState,
  targetNodeId: string
): DungeonRouteGateStatus | undefined {
  if (!state.run) return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  return getRouteGateStatus(
    state.run.dungeonId,
    state.run.currentNodeId,
    targetNodeId,
    lawState
  );
}

export function getCurrentRouteBlockReason(state: GameState, targetNodeId: string): string | undefined {
  if (!state.run) return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;

  return getRouteBlockReason(
    state.run.dungeonId,
    state.run.currentNodeId,
    targetNodeId,
    lawState
  );
}

export function getCurrentLegalAdjacentTargetIds(state: GameState): string[] {
  if (!state.run) return [];
  const dungeon = DUNGEONS[state.run.dungeonId];
  const currentNode = getNodeById(dungeon, state.run.currentNodeId);
  const lawState = getNormalizedDungeonLawState(state);
  if (!currentNode || !lawState) return [];

  const adjacentTargetIds = dungeon.nodes
    .filter((node) => areAdjacentNodes(currentNode, node))
    .map((node) => node.id);

  return getLegalAdjacentTargetIds(
    state.run.dungeonId,
    currentNode.id,
    adjacentTargetIds,
    lawState
  );
}

function getCurrentEquipmentSoulSkillRunState(state: GameState): EquipmentSoulSkillRunState | undefined {
  return isEquipmentSoulSkillRunState(state.run?.soulSkillState) ? state.run.soulSkillState : undefined;
}

function getUnavailableEquipmentSoulSkillStatus(
  skillId: EquipmentSoulSkillId
): EquipmentSoulSkillStatus {
  return {
    skillId,
    availability: 'not_frozen',
    frozen: false,
    ready: false,
    spent: false,
    canConsume: false,
    chargesRemaining: 0
  };
}

function getPortalOffsetTargetIds(state: GameState): string[] {
  const node = getCurrentNode(state);
  if (!node?.portal || !state.run) return [];

  const targetGate = getCampaignGates(state).find((gate) => gate.dungeonId === node.portal?.targetDungeonId);
  if (targetGate?.status === 'locked') return [];

  const targetDungeon = DUNGEONS[node.portal.targetDungeonId];
  const defaultTarget = getNodeById(targetDungeon, node.portal.targetNodeId);
  if (!defaultTarget) return [];

  const targetLawState = createDungeonLawState(targetDungeon.id);
  return targetDungeon.nodes
    .filter((candidate) => areAdjacentNodes(defaultTarget, candidate))
    .filter((candidate) => candidate.type !== 'portal' && candidate.type !== 'exit')
    .filter((candidate) => !getBossDefinitionForNode(targetDungeon.id, candidate.id))
    .filter(
      (candidate) =>
        getRouteBlockReason(targetDungeon.id, defaultTarget.id, candidate.id, targetLawState) === undefined
    )
    .map((candidate) => candidate.id);
}

function getPortalSoulSkillChoices(
  state: GameState,
  node: DungeonNode
): Exclude<PortalChoice, 'auto'>[] {
  if (!node.portal) return [];
  const choices: Exclude<PortalChoice, 'auto'>[] = ['force'];
  const stableItem = node.portal.stableItem;
  if (
    stableItem &&
    state.inventory[stableItem] > 0 &&
    (isTacticalItemId(stableItem)
      ? isTacticalItemAvailable(state, stableItem)
      : isDungeonConsumableAvailable(state, stableItem))
  ) {
    choices.unshift('stabilize');
  }
  return choices;
}

function getRewardSoulSkillItemIds(state: GameState, node: DungeonNode): ItemId[] {
  const resolved = getResolvedNodeReward(state, node);
  if (!resolved) return [];

  return (Object.entries(resolved.reward.items ?? {}) as Array<[ItemId, number | undefined]>)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([itemId]) => itemId);
}

export function getEquipmentSoulSkillActionStatus(
  state: GameState,
  skillId: EquipmentSoulSkillId
): EquipmentSoulSkillActionStatus {
  const definition = EQUIPMENT_SOUL_SKILL_CATALOG.find((candidate) => candidate.id === skillId);
  if (!definition) throw new TypeError(`Unknown equipment soul skill: ${skillId}`);

  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  const baseStatus = soulSkillState
    ? getEquipmentSoulSkillStatus(soulSkillState, skillId)
    : getUnavailableEquipmentSoulSkillStatus(skillId);
  const targetNodeIds: string[] = [];
  const itemIds: ItemId[] = [];
  const portalChoices: Exclude<PortalChoice, 'auto'>[] = [];
  let unavailableReason: string | undefined;

  if (!soulSkillState) {
    unavailableReason = state.run
      ? '这局副本没有器魂快照，按旧存档规则禁用器魂技。'
      : '进入副本并冻结装备快照后，才能使用器魂技。';
  } else if (!baseStatus.canConsume) {
    unavailableReason = baseStatus.availability === 'spent'
      ? `${definition.name}本局已经使用。`
      : baseStatus.availability === 'no_charges'
        ? '本局器魂共鸣 charge 已耗尽。'
        : `${definition.name}未在入场装备快照中激活。`;
  } else {
    const node = getCurrentNode(state);

    if (definition.effect === 'trap_force_pass') {
      const trapResolution = node ? getTrapRiskResolution(state, node) : undefined;
      if (
        state.phase !== 'explore' ||
        !node?.trap ||
        !state.run ||
        state.run.clearedNodeIds.includes(node.id)
      ) {
        unavailableReason = '雾听定相只能对当前位置尚未处理的陷阱使用。';
      } else if (trapResolution?.naturallyPassed) {
        unavailableReason = '本次陷阱自然判定已经能够通过，无需发动雾听定相。';
      }
    } else if (definition.effect === 'combat_cleanse') {
      const effects = state.combat?.effects;
      const hasCleansableEffect =
        (effects?.rustPoisonStacks ?? 0) > 0 ||
        (effects?.mirrorSlowStacks ?? 0) > 0 ||
        effects?.lastPlayerAction !== undefined;
      if (state.phase !== 'combat' || !state.combat) {
        unavailableReason = '灵纹泄地只能在战斗中使用。';
      } else if (!hasCleansableEffect) {
        unavailableReason = '当前没有可由灵纹泄地清除的负面状态。';
      }
    } else if (definition.effect === 'combat_skip_intent') {
      const intentId = getCurrentCombatIntent(state)?.id;
      if (state.phase !== 'combat' || !state.combat) {
        unavailableReason = '震地断拍只能在战斗中使用。';
      } else if (
        intentId !== 'fog-armor-rend' &&
        intentId !== 'spark-burst' &&
        intentId !== 'rift-shift' &&
        intentId !== 'pulse-wave'
      ) {
        unavailableReason = '当前敌方意图不属于震地断拍可跳过的危险节拍。';
      }
    } else if (definition.effect === 'trap_backstep') {
      if (
        state.phase !== 'explore' ||
        !node?.trap ||
        !state.run ||
        state.run.clearedNodeIds.includes(node.id)
      ) {
        unavailableReason = '云隙回步只能从当前位置尚未处理的陷阱撤回。';
      } else {
        targetNodeIds.push(
          ...getCurrentLegalAdjacentTargetIds(state).filter((nodeId) => state.run?.clearedNodeIds.includes(nodeId))
        );
        if (targetNodeIds.length === 0) unavailableReason = '没有已清理且路线开放的相邻节点可供回步。';
      }
    } else if (definition.effect === 'portal_offset') {
      if (state.phase !== 'explore' || !node?.portal || !state.run) {
        unavailableReason = '错位锚定只能在当前位置的传送门上使用。';
      } else {
        targetNodeIds.push(...getPortalOffsetTargetIds(state));
        portalChoices.push(...getPortalSoulSkillChoices(state, node));
        if (targetNodeIds.length === 0) unavailableReason = '默认落点附近没有合法的错位目标。';
      }
    } else if (definition.effect === 'reward_seal_item') {
      if (
        state.phase !== 'explore' ||
        !node?.reward ||
        !state.run ||
        state.run.clearedNodeIds.includes(node.id)
      ) {
        unavailableReason = '裂隙封存只能在领取当前位置尚未结算的奖励时使用。';
      } else {
        itemIds.push(...getRewardSoulSkillItemIds(state, node));
        if (itemIds.length === 0) unavailableReason = '本次奖励没有可封存的物品。';
      }
    }
  }

  return {
    ...baseStatus,
    definition,
    available: unavailableReason === undefined,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
    targetNodeIds,
    itemIds,
    portalChoices
  };
}

export function getEquipmentSoulSkillActionStatuses(
  state: GameState
): EquipmentSoulSkillActionStatus[] {
  return EQUIPMENT_SOUL_SKILL_CATALOG.map(({ id }) => getEquipmentSoulSkillActionStatus(state, id));
}

export function getEquipmentSoulSkillRechargeStatus(state: GameState): EquipmentSoulSkillRechargeStatus {
  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  if (!soulSkillState) {
    return {
      legacyDisabled: Boolean(state.run),
      available: false,
      pending: false,
      used: false,
      spentSkillIds: [],
      unavailableReason: state.run
        ? '这局副本没有器魂快照，按旧存档规则禁用共鸣台。'
        : '当前没有进行中的副本。'
    };
  }

  const spentSkillIds = getSpentEquipmentSoulSkills(soulSkillState);
  if (soulSkillState.pendingRecharge) {
    return {
      legacyDisabled: false,
      available: false,
      pending: true,
      used: false,
      rechargeId: soulSkillState.pendingRecharge.rechargeId,
      nodeId: soulSkillState.pendingRecharge.nodeId,
      spentSkillIds,
      unavailableReason: SOUL_RECHARGE_PENDING_BLOCK_MESSAGE
    };
  }

  const node = getCurrentNode(state);
  if (!state.run || !node?.soulRechargeId) {
    return {
      legacyDisabled: false,
      available: false,
      pending: false,
      used: false,
      spentSkillIds,
      unavailableReason: '当前位置没有器魂共鸣台。'
    };
  }

  const used = soulSkillState.usedRechargeIds.includes(node.soulRechargeId);
  let unavailableReason: string | undefined;
  if (state.phase !== 'explore') unavailableReason = '结束当前战斗后才能开启器魂共鸣台。';
  else if (!state.run.clearedNodeIds.includes(node.id)) unavailableReason = '清理当前危险节点后才能开启器魂共鸣台。';
  else if (used) unavailableReason = '这座器魂共鸣台本局已经使用。';
  else if (spentSkillIds.length === 0) unavailableReason = '当前没有已消耗的器魂技可恢复。';

  return {
    legacyDisabled: false,
    available: unavailableReason === undefined,
    pending: false,
    used,
    rechargeId: node.soulRechargeId,
    nodeId: node.id,
    spentSkillIds,
    ...(unavailableReason === undefined ? {} : { unavailableReason })
  };
}

export function activateCurrentEquipmentSoulSkillRecharge(state: GameState): GameState {
  const status = getEquipmentSoulSkillRechargeStatus(state);
  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  if (!status.available || !status.rechargeId || !status.nodeId || !state.run || !soulSkillState) {
    return appendLog(state, status.unavailableReason ?? '当前无法开启器魂共鸣台。');
  }

  const nextSoulSkillState = activateEquipmentSoulSkillRecharge(
    soulSkillState,
    status.rechargeId,
    status.nodeId
  );
  if (nextSoulSkillState === soulSkillState) return appendLog(state, '器魂共鸣台没有响应。');

  return appendLog(
    {
      ...state,
      run: { ...state.run, soulSkillState: nextSoulSkillState }
    },
    '器魂共鸣台已经开启，请选择一项已消耗的器魂技恢复，或取消共鸣。'
  );
}

export function resolveCurrentEquipmentSoulSkillRecharge(
  state: GameState,
  skillId: EquipmentSoulSkillId
): GameState {
  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  const pending = soulSkillState?.pendingRecharge;
  const node = getCurrentNode(state);
  if (!state.run || !soulSkillState || !pending) return appendLog(state, '当前没有待完成的器魂共鸣。');
  if (node?.id !== pending.nodeId || node.soulRechargeId !== pending.rechargeId) {
    return appendLog(state, '当前共鸣台与待完成的器魂共鸣不匹配。');
  }

  const nextSoulSkillState = resolveEquipmentSoulSkillRecharge(soulSkillState, skillId);
  if (nextSoulSkillState === soulSkillState) return appendLog(state, '只能恢复当前已经消耗的器魂技。');

  const definition = EQUIPMENT_SOUL_SKILL_CATALOG.find((candidate) => candidate.id === skillId);
  return appendLog(
    {
      ...state,
      run: { ...state.run, soulSkillState: nextSoulSkillState }
    },
    `器魂共鸣完成，${definition?.name ?? skillId}重新就绪，charge ${nextSoulSkillState.chargesRemaining}/2。`
  );
}

export function cancelCurrentEquipmentSoulSkillRecharge(state: GameState): GameState {
  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  if (!state.run || !soulSkillState?.pendingRecharge) return appendLog(state, '当前没有待取消的器魂共鸣。');

  const nextSoulSkillState = cancelEquipmentSoulSkillRecharge(soulSkillState);
  return appendLog(
    {
      ...state,
      run: { ...state.run, soulSkillState: nextSoulSkillState }
    },
    '你取消了本次器魂共鸣，共鸣台仍可再次开启。'
  );
}

function consumeCurrentEquipmentSoulSkill(
  state: GameState,
  skillId: EquipmentSoulSkillId,
  definition: EquipmentSoulSkillDefinition
): GameState {
  const soulSkillState = getCurrentEquipmentSoulSkillRunState(state);
  if (!state.run || !soulSkillState) return state;

  const nextSoulSkillState = consumeEquipmentSoulSkill(soulSkillState, skillId, definition.context);
  if (nextSoulSkillState === soulSkillState) return state;
  return {
    ...state,
    run: {
      ...state.run,
      soulSkillState: nextSoulSkillState
    }
  };
}

function appendEquipmentSoulCombatLog(state: GameState, line: string): GameState {
  if (!state.combat) return state;
  return {
    ...state,
    combat: {
      ...state.combat,
      log: [line, ...state.combat.log].slice(0, 8)
    }
  };
}

export function useEquipmentSoulSkill(
  state: GameState,
  skillId: EquipmentSoulSkillId,
  options: EquipmentSoulSkillUseOptions = {}
): GameState {
  const status = getEquipmentSoulSkillActionStatus(state, skillId);
  if (!status.available) {
    return appendLog(state, status.unavailableReason ?? `${status.definition.name}当前无法发动。`);
  }

  if (status.definition.effect === 'trap_force_pass') {
    return resolveTrapWithForcedSoulPass(state, status.definition);
  }

  if (status.definition.effect === 'combat_cleanse') {
    if (!state.combat) return appendLog(state, '当前没有战斗。');
    const consumed = consumeCurrentEquipmentSoulSkill(state, skillId, status.definition);
    if (consumed === state || !consumed.combat) return appendLog(state, `${status.definition.name}没有响应。`);

    const effects = { ...(consumed.combat.effects ?? {}) };
    delete effects.rustPoisonStacks;
    delete effects.mirrorSlowStacks;
    delete effects.lastPlayerAction;
    const line = `${status.definition.name}将锈疫、镜丝迟缓与敌意动作记录导入地脉。`;
    return appendLog(
      appendEquipmentSoulCombatLog(
        {
          ...consumed,
          combat: { ...consumed.combat, effects }
        },
        line
      ),
      line
    );
  }

  if (status.definition.effect === 'combat_skip_intent') {
    if (!state.combat) return appendLog(state, '当前没有战斗。');
    const skippedIntent = getCurrentCombatIntent(state);
    const consumed = consumeCurrentEquipmentSoulSkill(state, skillId, status.definition);
    if (consumed === state || !consumed.combat) return appendLog(state, `${status.definition.name}没有响应。`);

    const line = `${status.definition.name}震断「${skippedIntent?.name ?? '危险节拍'}」，敌方意图被直接跳过。`;
    return appendLog(
      appendEquipmentSoulCombatLog(
        {
          ...consumed,
          combat: { ...consumed.combat, turn: consumed.combat.turn + 1 }
        },
        line
      ),
      line
    );
  }

  if (status.definition.effect === 'trap_backstep') {
    const targetNodeId = options.targetNodeId;
    if (!targetNodeId || !status.targetNodeIds.includes(targetNodeId)) {
      return appendLog(state, '请选择一个已清理且路线开放的相邻节点回步。');
    }

    const consumed = consumeCurrentEquipmentSoulSkill(state, skillId, status.definition);
    if (consumed === state || !consumed.run) return appendLog(state, `${status.definition.name}没有响应。`);
    const targetNode = getNodeById(DUNGEONS[consumed.run.dungeonId], targetNodeId);
    return appendLog(
      {
        ...consumed,
        phase: 'explore',
        combat: undefined,
        run: { ...consumed.run, currentNodeId: targetNodeId }
      },
      `${status.definition.name}沿已清理路线退回${targetNode?.title ?? targetNodeId}，原陷阱仍未处理。`
    );
  }

  if (status.definition.effect === 'portal_offset') {
    const targetNodeId = options.targetNodeId;
    const portalChoice = options.portalChoice ?? 'auto';
    if (!targetNodeId || !status.targetNodeIds.includes(targetNodeId)) {
      return appendLog(state, '请选择默认传送落点旁的合法错位目标。');
    }
    if (portalChoice !== 'auto' && !status.portalChoices.includes(portalChoice)) {
      return appendLog(state, '当前资源不足以执行所选传送方式。');
    }
    return resolvePortal(state, portalChoice, targetNodeId, status.definition);
  }

  const itemId = options.itemId;
  if (!itemId || !status.itemIds.includes(itemId)) {
    return appendLog(state, '请选择一件本次奖励实际产出的物品进行封存。');
  }
  return collectRewardWithSoulSeal(state, itemId, status.definition);
}

function getEquippedDefinitions(state: GameState): EquipmentDefinition[] {
  return Object.values(state.equipped).map((equipmentId) => EQUIPMENT[equipmentId]);
}

export function getEquipmentSystemStatus(state: GameState): EquipmentSystemResult {
  return getEquipmentSystemBonus(
    Object.values(state.equipped),
    state.equipmentLevels,
    state.equipmentAttunements ?? {},
    state.equipmentTemperRanks ?? {}
  );
}

export function getEquipmentTemperStatus(
  state: GameState,
  equipmentId: EquipmentId
): EquipmentTemperProgress {
  return getEquipmentTemperProgress(equipmentId, state.equipmentTemperRanks ?? {});
}

export function getEquipmentCommissionStatus(state: GameState): EquipmentCommissionStatus {
  const equippedEquipmentIds = new Set(Object.values(state.equipped));
  const seenEquipmentIds = new Set<EquipmentId>();
  const candidates: EquipmentCommissionCandidate[] = [];

  for (const equipmentId of state.ownedEquipment) {
    if (seenEquipmentIds.has(equipmentId) || equippedEquipmentIds.has(equipmentId)) continue;
    seenEquipmentIds.add(equipmentId);

    const equipment = EQUIPMENT[equipmentId];
    const temperDefinition = getEquipmentTemperDefinition(equipmentId);
    if (
      (state.equipmentLevels[equipmentId] ?? 1) !== equipment.maxLevel ||
      !temperDefinition.eligible ||
      !temperDefinition.materialId
    ) {
      continue;
    }

    candidates.push({ equipmentId, materialId: temperDefinition.materialId });
  }

  return {
    ...(state.equipmentCommission === undefined ? {} : { active: state.equipmentCommission }),
    candidates,
    cost: EQUIPMENT_COMMISSION_COST,
    requiredDungeonCount: EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS,
    materialReward: EQUIPMENT_COMMISSION_MATERIAL_REWARD
  };
}

export function isEquipmentCommissionSealed(state: GameState, equipmentId: EquipmentId): boolean {
  return isCommissionEquipmentSealed(state.equipmentCommission, equipmentId);
}

export function startEquipmentCommission(
  state: GameState,
  equipmentIds: readonly [EquipmentId, EquipmentId],
  targetMaterialId: ItemId
): GameState {
  if (state.phase !== 'hub') return appendLog(state, '只有回到主神空间，才能发起装备封存委托。');
  if (state.equipmentCommission) return appendLog(state, '已有装备封存委托进行中，无法重复封存装备。');

  const [firstEquipmentId, secondEquipmentId] = equipmentIds;
  if (firstEquipmentId === secondEquipmentId) return appendLog(state, '装备封存委托必须选择两件不同装备。');

  const candidates = new Map(
    getEquipmentCommissionStatus(state).candidates.map((candidate) => [candidate.equipmentId, candidate])
  );
  const firstCandidate = candidates.get(firstEquipmentId);
  const secondCandidate = candidates.get(secondEquipmentId);
  if (!firstCandidate || !secondCandidate) {
    return appendLog(state, '封存失败：两件装备都必须已拥有、达到最高等级、可淬炼且当前未装备。');
  }
  if (![firstCandidate.materialId, secondCandidate.materialId].includes(targetMaterialId)) {
    return appendLog(state, '封存失败：目标材料必须来自所选装备的淬炼材料。');
  }
  if (!canPay(state, EQUIPMENT_COMMISSION_COST)) {
    return appendLog(state, '资源不足，装备封存委托需要 300 奖励点与 1 灵蕴。');
  }

  const paidState = payCost(state, EQUIPMENT_COMMISSION_COST);
  const equipmentCommission = createEquipmentCommission<EquipmentId, ItemId, DungeonId>(
    equipmentIds,
    targetMaterialId
  );
  return appendLog(
    {
      ...paidState,
      equipmentCommission
    },
    `装备封存委托已启动：${EQUIPMENT[firstEquipmentId].name}与${EQUIPMENT[secondEquipmentId].name}封存，完成 ${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS} 个不同副本后产出${ITEMS[targetMaterialId].name} x${EQUIPMENT_COMMISSION_MATERIAL_REWARD}。`
  );
}

export function recallEquipmentCommission(state: GameState): GameState {
  if (state.phase !== 'hub') return appendLog(state, '只有回到主神空间，才能撤回装备封存委托。');
  if (!state.equipmentCommission) return appendLog(state, '当前没有可撤回的装备封存委托。');

  const lostProgress = state.equipmentCommission.completedDungeonIds.length;
  return appendLog(
    {
      ...state,
      equipmentCommission: undefined
    },
    `装备封存委托已撤回，不返还启动消耗；已完成的 ${lostProgress}/${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS} 个不同副本进度全部丢失。`
  );
}

function addPartialStats<T extends Partial<DerivedStats> | Partial<CoreStats>>(target: Record<string, number>, source: T): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + (value as number);
  }
}

function getEffectiveBloodlineSnapshot(state: GameState): BloodlineRunSnapshot | undefined {
  if (state.run) return normalizeBloodlineRunSnapshot(state.run.bloodlineSnapshot);
  return createBloodlineRunSnapshot(getBloodlineProgress(state));
}

function getPermanentDerivedStats(state: GameState): DerivedStats {
  const statTotals: Record<string, number> = {
    body: state.player.base.body,
    spirit: state.player.base.spirit,
    agility: state.player.base.agility,
    luck: state.player.base.luck,
    maxHp: 50,
    attack: 6,
    artPower: 4,
    defense: 0,
    speed: 8
  };

  for (const methodId of state.learnedMethods) {
    addPartialStats(statTotals, METHODS[methodId].stats);
  }

  for (const equipment of getEquippedDefinitions(state)) {
    const level = state.equipmentLevels[equipment.id] ?? 1;
    addPartialStats(statTotals, equipment.base);
    for (let i = 1; i < level; i += 1) {
      addPartialStats(statTotals, equipment.perLevel);
    }
  }

  addPartialStats(statTotals, getEquipmentSystemStatus(state).bonus);

  if (state.activePet) {
    const pet = PETS[state.activePet];
    const level = state.petLevels[state.activePet] ?? 1;
    addPartialStats(statTotals, getPetStatBonus(pet, level));
  }

  const bloodlineBonus = getBloodlineStatBonus(getEffectiveBloodlineSnapshot(state));
  if (bloodlineBonus) addPartialStats(statTotals, bloodlineBonus);

  const body = statTotals.body;
  const spirit = statTotals.spirit;
  const agility = statTotals.agility;
  const luck = statTotals.luck;

  return {
    body,
    spirit,
    agility,
    luck,
    maxHp: statTotals.maxHp + body * 14 + (statTotals.maxHp === 50 ? 0 : 0),
    attack: statTotals.attack + body * 3,
    artPower: statTotals.artPower + spirit * 4,
    defense: statTotals.defense + body * 2,
    speed: statTotals.speed + agility * 3,
    trapCheck: spirit * 2 + luck + (statTotals.trapCheck ?? 0)
  };
}

export function getDerivedStats(state: GameState): DerivedStats {
  const stats = getPermanentDerivedStats(state);
  const bonuses = getCurrentRunRelicEffects(state).statBonuses;

  return {
    ...stats,
    attack: stats.attack + bonuses.attack,
    artPower: stats.artPower + bonuses.artPower,
    defense: stats.defense + bonuses.defense,
    speed: stats.speed + bonuses.speed,
    trapCheck: stats.trapCheck + bonuses.trapCheck
  };
}

export function getPlayerPower(state: GameState): number {
  const stats = getPermanentDerivedStats(state);
  const bankedLingyun = Math.max(0, state.lingyun - (state.run?.lootBag.lingyun ?? 0));
  const equippedEquipmentIds = new Set(Object.values(state.equipped));
  const equipmentLevelTotal = (Object.entries(state.equipmentLevels) as Array<[EquipmentId, number]>).reduce((total, [equipmentId, level]) => {
    if (!equippedEquipmentIds.has(equipmentId)) return total;

    const equipment = EQUIPMENT[equipmentId];
    const hasPowerStats = Object.keys(equipment.base).length > 0 || Object.keys(equipment.perLevel).length > 0;

    return hasPowerStats ? total + (level ?? 0) : total;
  }, 0);

  return getPlayerPowerFromLoadout({
    stats,
    lingyun: bankedLingyun,
    learnedMethodCount: state.learnedMethods.length,
    equipmentLevelTotal,
    ownedPetCount: state.ownedPets.length
  });
}

export function getDungeonReadiness(state: GameState, dungeonId: DungeonId): DungeonReadiness {
  const power = getPlayerPower(state);
  const recommendedPower = DUNGEONS[dungeonId].recommendedPower;

  return getReadinessFromPower(power, recommendedPower);
}

export function getCampaignGates(state: GameState): CampaignDungeonGate[] {
  return getCampaignProgress({
    completedDungeonIds: state.completedDungeonIds,
    playerPower: getPlayerPower(state),
    unlockedDungeonIds: getUnlockedDungeonIdsFromMainline(state),
    mainlineRequirementText: Object.fromEntries(
      DUNGEON_ORDER.map((dungeonId) => [dungeonId, getMainlineRequirementText(state, dungeonId)])
    )
  });
}

export function getDirectiveEvaluation(state: GameState, dungeonId = state.run?.dungeonId): DirectiveEvaluation {
  const targetDungeonId = dungeonId ?? DUNGEON_ORDER[0];
  const directive = getDirectiveForDungeon(targetDungeonId);
  const activeDungeonId = state.run?.dungeonId ?? targetDungeonId;
  const dungeon = DUNGEONS[activeDungeonId];

  return evaluateDirective(directive, {
    dungeonId: activeDungeonId,
    clearedNodeIds: state.run?.clearedNodeIds ?? [],
    totalNodes: dungeon.nodes.length,
    damageTaken: state.run?.damageTaken ?? 0,
    captures: state.run?.capturedPetIds ?? state.run?.captures ?? 0,
    usedItems: state.run?.usedItems ?? [],
    learnedMethods: state.learnedMethods,
    equippedIds: Object.values(state.equipped),
    activePet: state.activePet,
    lawState: state.run?.lawState
  });
}

export function getAvailableDungeonEvents(state: GameState): AvailableDungeonEvent[] {
  if (!state.run) return [];

  const context = getDungeonEventContext(state);
  return getDungeonEvents(state.run.dungeonId)
    .filter((event) => !state.run?.resolvedEventIds.includes(event.id))
    .filter((event) => event.nodeId === state.run?.currentNodeId)
    .map((event) => ({
      ...event,
      options: evaluateEventOptions(event, context)
    }));
}

export function resolveDungeonEvent(state: GameState, eventId: string, optionId: string): GameState {
  if (!state.run) return appendLog(state, '你还没有进入副本，无法触发关卡事件。');
  if (state.run.resolvedEventIds.includes(eventId)) return appendLog(state, '这个关卡事件已经结算过，主神不会重复发放奖励。');

  const event = getDungeonEvents(state.run.dungeonId).find((candidate) => candidate.id === eventId);
  if (!event) return appendLog(state, '当前副本没有这个关卡事件。');
  if (event.nodeId !== state.run.currentNodeId) {
    const eventNode = getNodeById(DUNGEONS[state.run.dungeonId], event.nodeId);
    return appendLog(state, `关卡事件「${event.title}」位于${eventNode?.title ?? '另一处格子'}，必须先走到对应格子。`);
  }

  const context = getDungeonEventContext(state);
  const evaluatedOption = evaluateEventOptions(event, context).find((candidate) => candidate.id === optionId);
  if (evaluatedOption) {
    for (const requirement of evaluatedOption.requirements) {
      if (requirement.type !== 'item' || !isTacticalItemId(requirement.itemId)) continue;
      const availability = getTacticalItemAvailability(state, requirement.itemId);
      if (!availability.available && availability.reason !== 'missing') {
        return appendLog(
          state,
          `${getTacticalItemUnavailableLog(state, requirement.itemId)} 关卡事件「${event.title}」未结算。`
        );
      }
    }
  }
  const outcome = resolveDungeonEventChoice(event, optionId, context);
  const paidRequirementItems = outcome.success && evaluatedOption ? payEventItemRequirements(state, evaluatedOption.requirements) : state;
  const damaged = outcome.damage ? applyPlayerDamage(paidRequirementItems, outcome.damage) : paidRequirementItems;
  const rewarded = applyRunReward(damaged, outcome);
  const currentLawState = getNormalizedDungeonLawState(rewarded);
  const lawSignaled = currentLawState
    ? withDungeonLawState(rewarded, signalDungeonEvent(currentLawState, { eventId: event.id, outcome }))
    : rewarded;

  return appendLog(
    {
      ...lawSignaled,
      run: lawSignaled.run
        ? advanceEquipmentMemoryHuntOnResolvedEvent(
            {
              ...lawSignaled.run,
              resolvedEventIds: [...lawSignaled.run.resolvedEventIds, event.id],
              eventLog: [outcome.temporaryLog, ...lawSignaled.run.eventLog].slice(0, 12)
            },
            event.id,
            outcome.success
          )
        : lawSignaled.run
    },
    outcome.temporaryLog
  );
}

export function createInitialState(): GameState {
  const inventory = createInventory();
  const draft: GameState = {
    phase: 'hub',
    rewardPoints: 850,
    lingyun: 1,
    player: {
      hp: 1,
      maxHp: 1,
      base: {
        body: 3,
        spirit: 2,
        agility: 2,
        luck: 1
      }
    },
    inventory,
    ownedEquipment: ['training_blade', 'patched_headwrap', 'patched_coat', 'patched_gloves', 'patched_boots', 'patched_belt', 'plain_charm'],
    equipmentLevels: {
      training_blade: 1,
      patched_headwrap: 1,
      patched_coat: 1,
      patched_gloves: 1,
      patched_boots: 1,
      patched_belt: 1,
      plain_charm: 1
    },
    equipmentAttunements: {},
    equipmentTemperRanks: {},
    equipmentMemories: {},
    equipped: {
      weapon: 'training_blade',
      head: 'patched_headwrap',
      armor: 'patched_coat',
      hands: 'patched_gloves',
      feet: 'patched_boots',
      waist: 'patched_belt',
      charm: 'plain_charm'
    },
    preparedItemIds: [...DEFAULT_PREPARED_TACTICAL_ITEM_IDS],
    preparedRelicFrame: 'assault',
    archivedRelicIds: [],
    preparedEquipmentMemoryHunt: undefined,
    learnedMethods: [],
    methodRanks: {},
    bloodlineRanks: {},
    completedDungeonIds: [],
    claimedDirectiveIds: [],
    claimedTaskIds: [],
    ownedPets: [],
    petLevels: {},
    ownedCompanions: [],
    companionRanks: {},
    log: ['白光散去，你站在主神空间。兑换碑、功法碑和三道副本门同时亮起。']
  };
  const maxHp = getDerivedStats(draft).maxHp;

  return {
    ...draft,
    player: {
      ...draft.player,
      hp: maxHp,
      maxHp
    }
  };
}

export function getBloodlineProgress(state: GameState): BloodlineProgress {
  return normalizeBloodlineProgress({
    rulesVersion: BLOODLINE_RULES_VERSION,
    ranks: state.bloodlineRanks ?? {},
    ...(state.activeBloodline === undefined ? {} : { active: state.activeBloodline })
  });
}

export function unlockBloodline(state: GameState, bloodlineId: BloodlineId): GameState {
  if (state.phase !== 'hub' || !isBloodlineId(bloodlineId)) return state;
  const progress = getBloodlineProgress(state);
  const status = getBloodlineUpgradeStatus(bloodlineId, progress);
  if (status?.state !== 'unlockable' || !status.cost || status.targetRank !== 1) return state;
  if (!canPay(state, status.cost)) return state;

  const definition = getBloodlineDefinition(bloodlineId);
  if (!definition) return state;
  const nextActive = progress.active ?? bloodlineId;
  return appendLog(
    normalizeHealth({
      ...payCost(state, status.cost),
      bloodlineRanks: { ...progress.ranks, [bloodlineId]: 1 },
      activeBloodline: nextActive
    }),
    `${definition.name}已解锁至 R1${progress.active === undefined ? '，并设为当前有效血统' : ''}。`
  );
}

export function upgradeBloodline(state: GameState, bloodlineId: BloodlineId): GameState {
  if (state.phase !== 'hub' || !isBloodlineId(bloodlineId)) return state;
  const progress = getBloodlineProgress(state);
  const status = getBloodlineUpgradeStatus(bloodlineId, progress);
  if (status?.state !== 'upgradeable' || !status.cost || !status.targetRank) return state;
  if (!canPay(state, status.cost)) return state;

  const definition = getBloodlineDefinition(bloodlineId);
  if (!definition) return state;
  return appendLog(
    normalizeHealth({
      ...payCost(state, status.cost),
      bloodlineRanks: { ...progress.ranks, [bloodlineId]: status.targetRank },
      activeBloodline: progress.active
    }),
    `${definition.name}晋升至 R${status.targetRank}。`
  );
}

export function activateBloodline(state: GameState, bloodlineId: BloodlineId): GameState {
  if (state.phase !== 'hub' || !isBloodlineId(bloodlineId)) return state;
  const progress = getBloodlineProgress(state);
  if (progress.ranks[bloodlineId] === undefined || progress.active === bloodlineId) return state;
  const definition = getBloodlineDefinition(bloodlineId);
  if (!definition) return state;

  return appendLog(
    normalizeHealth({
      ...state,
      bloodlineRanks: { ...progress.ranks },
      activeBloodline: bloodlineId
    }),
    `${definition.name}已设为当前有效血统。`
  );
}

function getCompanionProgress(state: GameState): CompanionProgress {
  return {
    rulesVersion: COMPANION_RULES_VERSION,
    owned: state.ownedCompanions,
    ranks: state.companionRanks,
    ...(state.activeCompanion === undefined ? {} : { active: state.activeCompanion })
  };
}

export function recruitCompanion(state: GameState, companionId: CompanionId): GameState {
  if (state.phase !== 'hub') return state;

  const definition = getCompanionDefinition(companionId);
  if (!definition) return state;
  if (
    getCompanionRecruitmentStatus(
      companionId,
      getCompanionProgress(state),
      state.completedDungeonIds
    ) !== 'recruitable' ||
    !canPay(state, definition.recruitCost)
  ) {
    return state;
  }

  return appendLog(
    {
      ...payCost(state, definition.recruitCost),
      ownedCompanions: [...state.ownedCompanions, companionId],
      companionRanks: {
        ...state.companionRanks,
        [companionId]: 1
      },
      activeCompanion: state.ownedCompanions.length === 0
        ? companionId
        : state.activeCompanion
    },
    `${definition.name}加入轮回小队，当前位阶 R1。`
  );
}

export function upgradeCompanion(state: GameState, companionId: CompanionId): GameState {
  if (state.phase !== 'hub') return state;

  const definition = getCompanionDefinition(companionId);
  const status = getCompanionUpgradeStatus(companionId, getCompanionProgress(state));
  if (!definition || status?.state !== 'upgradeable' || !status.cost || !status.targetRank) {
    return state;
  }
  if (!canPay(state, status.cost)) return state;

  return appendLog(
    {
      ...payCost(state, status.cost),
      companionRanks: {
        ...state.companionRanks,
        [companionId]: status.targetRank
      }
    },
    `${definition.name}晋升至 R${status.targetRank}。`
  );
}

export function activateCompanion(state: GameState, companionId: CompanionId): GameState {
  if (state.phase !== 'hub' || !state.ownedCompanions.includes(companionId)) return state;

  const definition = getCompanionDefinition(companionId);
  if (!definition || state.activeCompanion === companionId) return state;

  return appendLog(
    {
      ...state,
      activeCompanion: companionId
    },
    `${definition.name}进入本轮出战位。`
  );
}

export function getMethodCultivationProgress(state: GameState): MethodCultivationProgress {
  return normalizeMethodCultivationProgress(state.learnedMethods, {
    rulesVersion: METHOD_CULTIVATION_RULES_VERSION,
    ranks: state.methodRanks,
    activeMethod: state.activeMethod
  });
}

export function buyItem(state: GameState, itemId: ItemId): GameState {
  const item = ITEMS[itemId];
  if (!item.cost) return appendLog(state, `${item.name}只能在副本中获得，主神不直接售卖。`);
  if (!canPay(state, item.cost)) return appendLog(state, `奖励点或材料不足，无法兑换${item.name}。`);

  return appendLog(
    {
      ...payCost(state, item.cost),
      inventory: addItems(payCost(state, item.cost).inventory, { [itemId]: 1 })
    },
    `主神扣除资源，${item.name}落入你的背包。`
  );
}

export function getEquipmentRecipePurchaseStatus(
  state: GameState,
  dungeonId: DungeonId,
  equipmentId: EquipmentId
): EquipmentRecipePurchaseStatus | undefined {
  const recipe = getEquipmentRecipe(dungeonId, equipmentId);
  if (!recipe) return undefined;

  const cost: Cost = {
    items: { [recipe.materialId]: recipe.materialAmount }
  };
  const unlocked = state.completedDungeonIds.includes(dungeonId);
  return {
    dungeonId,
    equipmentId,
    materialId: recipe.materialId,
    materialAmount: recipe.materialAmount,
    cost,
    unlocked,
    affordable: unlocked && canPay(state, cost)
  };
}

export function buyEquipment(
  state: GameState,
  equipmentId: EquipmentId,
  sourceDungeonId?: DungeonId
): GameState {
  if (state.ownedEquipment.includes(equipmentId)) return appendLog(state, `你已经拥有${EQUIPMENT[equipmentId].name}。`);

  const equipment = EQUIPMENT[equipmentId];
  let cost = equipment.cost;
  let purchaseLog = `${equipment.name}已加入装备架。`;

  if (sourceDungeonId) {
    if (state.phase !== 'hub') return appendLog(state, '只能在主神空间的装备商人处兑换装备。');
    const status = getEquipmentRecipePurchaseStatus(state, sourceDungeonId, equipmentId);
    if (!status) return appendLog(state, `${DUNGEONS[sourceDungeonId].name}的装备目录中没有${equipment.name}。`);
    if (!status.unlocked) {
      return appendLog(state, `首次通关${DUNGEONS[sourceDungeonId].name}后，才会解锁${equipment.name}的兑换目录。`);
    }
    cost = status.cost;
    purchaseLog = `消耗${ITEMS[status.materialId].name} x${status.materialAmount}，${equipment.name}已加入装备架。`;
  }

  if (!canPay(state, cost)) return appendLog(state, `资源不足，无法兑换${equipment.name}。`);

  return appendLog(
    {
      ...payCost(state, cost),
      ownedEquipment: [...state.ownedEquipment, equipmentId],
      equipmentLevels: {
        ...state.equipmentLevels,
        [equipmentId]: 1
      }
    },
    purchaseLog
  );
}

export function equipEquipment(state: GameState, equipmentId: EquipmentId): GameState {
  if (isEquipmentCommissionSealed(state, equipmentId)) {
    return appendLog(state, `${EQUIPMENT[equipmentId].name}正在装备封存委托中，无法装备。`);
  }
  if (!state.ownedEquipment.includes(equipmentId)) return appendLog(state, '你还没有这件装备。');

  const equipment = EQUIPMENT[equipmentId];
  return appendLog(
    normalizeHealth({
      ...state,
      equipped: {
        ...state.equipped,
        [equipment.slot]: equipmentId
      }
    }),
    `已装备${equipment.name}。`
  );
}

export function upgradeEquipment(state: GameState, equipmentId: EquipmentId): GameState {
  if (isEquipmentCommissionSealed(state, equipmentId)) {
    return appendLog(state, `${EQUIPMENT[equipmentId].name}正在装备封存委托中，无法升级。`);
  }
  if (!state.ownedEquipment.includes(equipmentId)) return appendLog(state, '你还没有这件装备。');

  const equipment = EQUIPMENT[equipmentId];
  const currentLevel = state.equipmentLevels[equipmentId] ?? 1;
  const nextLevel = currentLevel + 1;
  const cost = UPGRADE_COSTS[nextLevel];

  if (nextLevel > equipment.maxLevel || !cost) return appendLog(state, `${equipment.name}暂时无法继续升级。`);
  if (!canPay(state, cost)) return appendLog(state, `资源不足，无法把${equipment.name}升到 +${nextLevel - 1}。`);

  return appendLog(
    normalizeHealth({
      ...payCost(state, cost),
      equipmentLevels: {
        ...state.equipmentLevels,
        [equipmentId]: nextLevel
      }
    }),
    `${equipment.name}升级完成，当前等级 +${nextLevel - 1}。`
  );
}

export function attuneEquipment(
  state: GameState,
  equipmentId: EquipmentId,
  attunementId: EquipmentAttunementId
): GameState {
  if (isEquipmentCommissionSealed(state, equipmentId)) {
    return appendLog(state, `${EQUIPMENT[equipmentId].name}正在装备封存委托中，无法铭刻。`);
  }
  if (state.phase !== 'hub') return appendLog(state, '只有回到主神空间，才能进行装备铭刻。');
  if (!state.ownedEquipment.includes(equipmentId)) return appendLog(state, '你还没有这件装备。');

  const equipment = EQUIPMENT[equipmentId];
  const level = state.equipmentLevels[equipmentId] ?? 1;
  if (level !== equipment.maxLevel) return appendLog(state, `${equipment.name}达到最高等级后才能铭刻。`);

  const option = getEquipmentAttunementOptions(equipmentId).find((candidate) => candidate.id === attunementId);
  if (!option) return appendLog(state, `${equipment.name}无法选择这条铭刻分支。`);
  if (state.equipmentAttunements?.[equipmentId] === attunementId) {
    return appendLog(state, `${equipment.name}已经生效${option.name}，无需重复支付。`);
  }
  if (!canPay(state, EQUIPMENT_ATTUNEMENT_COST)) {
    return appendLog(state, `资源不足，无法为${equipment.name}铭刻${option.name}。`);
  }

  return appendLog(
    normalizeHealth({
      ...payCost(state, EQUIPMENT_ATTUNEMENT_COST),
      equipmentAttunements: {
        ...(state.equipmentAttunements ?? {}),
        [equipmentId]: attunementId
      }
    }),
    `${equipment.name}完成铭刻：${option.name}。改选铭刻不会返还此前消耗。`
  );
}

export function temperEquipment(state: GameState, equipmentId: EquipmentId): GameState {
  if (isEquipmentCommissionSealed(state, equipmentId)) {
    return appendLog(state, `${EQUIPMENT[equipmentId].name}正在装备封存委托中，无法淬炼。`);
  }
  if (state.phase !== 'hub') return appendLog(state, '只有回到主神空间，才能进行首领锻造。');
  if (!state.ownedEquipment.includes(equipmentId)) return appendLog(state, '你还没有这件装备。');

  const equipment = EQUIPMENT[equipmentId];
  const progress = getEquipmentTemperStatus(state, equipmentId);
  if (!progress.eligible) return appendLog(state, `${equipment.name}不是可淬炼的高阶装备。`);

  const level = state.equipmentLevels[equipmentId] ?? 1;
  if (level !== equipment.maxLevel) return appendLog(state, `${equipment.name}达到最高等级后才能淬炼。`);
  if (!progress.nextRank || !progress.nextCost) return appendLog(state, `${equipment.name}已经达到淬炼上限。`);

  if (progress.nextRank === 2) {
    const attunementId = state.equipmentAttunements?.[equipmentId];
    const hasValidAttunement =
      attunementId !== undefined &&
      getEquipmentAttunementOptions(equipmentId).some((option) => option.id === attunementId);
    if (!hasValidAttunement) {
      return appendLog(state, `${equipment.name}需要先生效该装备自己的铭刻，才能淬炼至 II 阶。`);
    }
  }

  if (!canPay(state, progress.nextCost)) {
    return appendLog(state, `资源不足，无法把${equipment.name}淬炼至 ${progress.nextRank === 1 ? 'I' : 'II'} 阶。`);
  }

  const costParts = [
    progress.nextCost.rewardPoints > 0 ? `${progress.nextCost.rewardPoints} 奖励点` : '',
    (progress.nextCost.lingyun ?? 0) > 0 ? `${progress.nextCost.lingyun} 灵蕴` : '',
    ...Object.entries(progress.nextCost.items).map(
      ([itemId, amount]) => `${ITEMS[itemId as ItemId].name} x${amount}`
    )
  ].filter(Boolean);
  const tempered = normalizeHealth({
    ...payCost(state, progress.nextCost),
    equipmentTemperRanks: {
      ...(state.equipmentTemperRanks ?? {}),
      [equipmentId]: progress.nextRank
    }
  });

  return appendLog(
    tempered,
    `${equipment.name}完成首领锻造，淬炼至 ${progress.nextRank === 1 ? 'I' : 'II'} 阶，消耗${costParts.join('、')}。`
  );
}

export function learnMethod(state: GameState, methodId: MethodId): GameState {
  if (state.learnedMethods.includes(methodId)) return appendLog(state, `你已经学会${METHODS[methodId].name}。`);

  const method = METHODS[methodId];
  if (!canPay(state, method.cost)) return appendLog(state, `资源不足，无法学习${method.name}。`);

  const progress = getMethodCultivationProgress(state);

  return appendLog(
    normalizeHealth({
      ...payCost(state, method.cost),
      learnedMethods: [...state.learnedMethods, methodId],
      methodRanks: {
        ...progress.ranks,
        [methodId]: 1
      },
      activeMethod: progress.activeMethod ?? methodId
    }),
    `${method.name}灌入识海。${method.passive}`
  );
}

export function upgradeMethod(state: GameState, methodId: MethodId): GameState {
  if (state.phase !== 'hub') return state;

  const progress = getMethodCultivationProgress(state);
  const status = getMethodUpgradeStatus(methodId, progress);
  if (status?.state !== 'upgradeable' || !status.cost || !status.targetRank) return state;
  if (!canPay(state, status.cost)) return state;

  return appendLog(
    {
      ...payCost(state, status.cost),
      methodRanks: {
        ...progress.ranks,
        [methodId]: status.targetRank
      },
      activeMethod: progress.activeMethod
    },
    `${METHODS[methodId].name}晋升至 R${status.targetRank}。`
  );
}

export function activateMethod(state: GameState, methodId: MethodId): GameState {
  if (state.phase !== 'hub') return state;

  const progress = getMethodCultivationProgress(state);
  if (progress.ranks[methodId] === undefined || progress.activeMethod === methodId) return state;

  return appendLog(
    {
      ...state,
      methodRanks: { ...progress.ranks },
      activeMethod: methodId
    },
    `${METHODS[methodId].name}设为主修功法。`
  );
}

export function buyPet(state: GameState, petId: PetId): GameState {
  if (state.ownedPets.includes(petId)) return appendLog(state, `你已经拥有${PETS[petId].name}。`);

  const pet = PETS[petId];
  if (pet.source !== 'shop' || !pet.cost) return appendLog(state, `${pet.name}不能购买，只能在副本中捕获。`);
  if (!canPay(state, pet.cost)) return appendLog(state, `资源不足，无法签约${pet.name}。`);

  return appendLog(
    normalizeHealth({
      ...payCost(state, pet.cost),
      ownedPets: [...state.ownedPets, petId],
      petLevels: {
        ...state.petLevels,
        [petId]: 1
      },
      activePet: state.activePet ?? petId
    }),
    `${pet.name}完成契约，已加入宠物栏。`
  );
}

function upgradePetInternal(state: GameState, petId: PetId): GameState {
  if (!state.ownedPets.includes(petId)) return appendLog(state, '你还没有这只宠物。');

  const pet = PETS[petId];
  const currentLevel = state.petLevels[petId] ?? 1;
  const nextLevel = currentLevel + 1;

  if (nextLevel > pet.maxLevel) return appendLog(state, `${pet.name}暂时无法继续培养。`);

  const cost = getPetUpgradeCost(pet, nextLevel);
  if (!canPay(state, cost)) return appendLog(state, `资源不足，无法把${pet.name}培养到 ${nextLevel} 级。`);

  const passiveText = getPetPassiveTags(pet).join(' / ');
  return appendLog(
    normalizeHealth({
      ...payCost(state, cost),
      petLevels: {
        ...state.petLevels,
        [petId]: nextLevel
      }
    }),
    `${pet.name}培养到 ${nextLevel} 级，灵宠特性：${passiveText}。`
  );
}

export const upgradePet: ((state: GameState, petId: PetId) => GameState) | undefined = upgradePetInternal;

export function activatePet(state: GameState, petId: PetId): GameState {
  if (!state.ownedPets.includes(petId)) return appendLog(state, '你还没有这只宠物。');

  return appendLog(
    normalizeHealth({
      ...state,
      activePet: petId
    }),
    `${PETS[petId].name}进入出战位。`
  );
}

function createHiddenTaskSeed(value: number | undefined): number {
  if (Number.isInteger(value) && (value ?? 0) >= 1 && (value ?? 0) <= 0xffff_ffff) {
    return value as number;
  }
  return Math.floor(Math.random() * 0xffff_ffff) + 1;
}

export function enterDungeon(
  state: GameState,
  dungeonId: DungeonId,
  protocolId: RunProtocolId = 'standard',
  routeContractId?: string,
  options: DungeonEntryOptions = {}
): GameState {
  const simplifiedEntry = options.flowVersion === 2;
  const dungeon = DUNGEONS[dungeonId];
  if (!dungeon) return appendLog(state, '未知副本，无法进入。');

  const protocolDefinition = getRunProtocolDefinition(dungeonId, protocolId);
  if (!protocolDefinition) return appendLog(state, '未知轮回协议，无法进入副本。');

  const catalogRouteContract = routeContractId === undefined
    ? undefined
    : ROUTE_CONTRACT_CATALOG.find((definition) => definition.id === routeContractId);
  if (routeContractId !== undefined && !catalogRouteContract) {
    return appendLog(state, '未知路线契约，无法进入副本。');
  }
  if (catalogRouteContract && catalogRouteContract.dungeonId !== dungeonId) {
    return appendLog(state, '路线契约不属于目标副本，无法进入。');
  }
  if (catalogRouteContract && !state.completedDungeonIds.includes(dungeonId)) {
    return appendLog(state, `路线契约仅可用于已通关的${dungeon.name}复刷，本次未入场。`);
  }
  const routeContractDefinition = routeContractId === undefined
    ? undefined
    : getRouteContractById(routeContractId, dungeonId);

  const gate = getCampaignGates(state).find((candidate) => candidate.dungeonId === dungeonId);

  if (gate?.status === 'locked') {
    return appendLog(state, `副本锁定：${gate.requirementText}`);
  }
  if (!isRunProtocolAvailable(dungeonId, protocolId, state.completedDungeonIds)) {
    return appendLog(state, `轮回协议锁定：先完成${dungeon.name}的标准探索。`);
  }

  const preparedEquipmentMemoryHunt = simplifiedEntry
    ? undefined
    : getNormalizedPreparedEquipmentMemoryHunt(state.preparedEquipmentMemoryHunt);
  let equipmentMemoryHunt: EquipmentMemoryHuntRunState | undefined;
  if (preparedEquipmentMemoryHunt?.dungeonId === dungeonId) {
    const memoryPreparation = getEquipmentMemoryHuntPreparationStatus(state, dungeonId);
    const preparedCandidate = memoryPreparation.candidates.find(
      (candidate) => candidate.equipmentId === preparedEquipmentMemoryHunt.equipmentId
    );
    if (!preparedCandidate?.available || !preparedCandidate.attunementId) {
      return appendLog(
        state,
        `无法进入副本：铭刻记忆狩猎准备已失效。${preparedCandidate?.unavailableReason ?? memoryPreparation.unavailableReason ?? ''} 本次未入场且未扣除资源。`
      );
    }
    equipmentMemoryHunt = createEquipmentMemoryHuntRunState(
      preparedEquipmentMemoryHunt,
      preparedCandidate.attunementId
    );
    if (!equipmentMemoryHunt) {
      return appendLog(
        state,
        '无法进入副本：铭刻记忆狩猎准备与规则目录不匹配。本次未入场且未扣除资源。'
      );
    }
  }

  const equipmentMemorySnapshot = createEquipmentMemoryRunSnapshot(
    Object.values(state.equipped),
    sanitizeEquipmentMemoryMap(state.equipmentMemories)
  );
  if (!equipmentMemorySnapshot) {
    return appendLog(
      state,
      '无法进入副本：装备记忆快照创建失败。本次未入场且未扣除资源。'
    );
  }

  const tacticalLoadoutStatus = getTacticalLoadoutStatus(state);
  if (!tacticalLoadoutStatus.isValid) {
    return appendLog(
      state,
      `无法进入副本：战术携行配置无效。${tacticalLoadoutStatus.reasons.join(' ')}`
    );
  }
  if (!simplifiedEntry && protocolDefinition.id === 'deep' && !hasItems(state, { cycle_imprint: 1 })) {
    return appendLog(state, '轮回刻印不足：深层轮回协议入场需要消耗轮回刻印 x1，本次未入场且未扣除资源。');
  }

  const entryState = !simplifiedEntry && protocolDefinition.id === 'deep'
    ? payCost(state, { items: { cycle_imprint: 1 } })
    : simplifiedEntry
      ? {
          ...state,
          preparedEquipmentHunt: undefined,
          preparedEquipmentMemoryHunt: undefined
        }
      : state;
  const tacticalLoadout = createTacticalLoadoutSnapshot(tacticalLoadoutStatus.preparedItemIds);
  const relicPreparation = getRunRelicPreparationStatus(entryState);
  const relicConduitMatch = getEquipmentRelicConduitFrameMatch(
    relicPreparation.preparedRelicFrame,
    relicPreparation.activeConduits
  );
  const relicState = createRunRelicState(
    relicPreparation.preparedRelicFrame,
    undefined,
    relicPreparation.preparedRelicSeedId
  );
  const soulSkillState = createEquipmentSoulSkillRunState(
    entryState.equipped,
    entryState.equipmentLevels,
    entryState.equipmentTemperRanks ?? {}
  );
  const fieldSurveyState = createFieldSurveyRunState(
    entryState.equipped,
    entryState.equipmentLevels,
    entryState.equipmentAttunements ?? {}
  );
  const preparedEquipmentHunt = simplifiedEntry
    ? undefined
    : getValidPreparedEquipmentHunt(entryState, dungeonId);
  const equipmentHunt = preparedEquipmentHunt
    ? createEquipmentHuntRunState(preparedEquipmentHunt, dungeonId, entryState.ownedEquipment)
    : undefined;
  const routeContractState = createRouteContractRunState(routeContractDefinition);
  const bloodlineSnapshot = createBloodlineRunSnapshot(getBloodlineProgress(entryState));
  const companionSnapshot = createCompanionRunSnapshot(getCompanionProgress(entryState));
  const broadcastEntryPassives = createBroadcastEntryPassivesFromEquipped(entryState);
  const escortEntryGear = createEscortEntryGearFromEquipped(entryState);
  const falseTestimonyEntryGear = createFalseTestimonyEntryGearFromEquipped(entryState);
  const entryLawState = createEntryDungeonLawState(
    entryState,
    dungeonId,
    bloodlineSnapshot,
    broadcastEntryPassives,
    escortEntryGear,
    falseTestimonyEntryGear,
    companionSnapshot
  );
  const methodProgress = getMethodCultivationProgress(entryState);
  const methodSnapshots = createMethodRunSnapshots(methodProgress);
  const methodSnapshot = createMethodRunSnapshot(methodProgress);
  const combatReplayState = dungeonId === 'combat_replay_stage'
    ? createCombatReplayRunState(entryState)
    : undefined;

  const nextState: GameState = {
    ...entryState,
    phase: 'explore' as const,
    preparedItemIds: [...tacticalLoadout.itemIds],
    preparedRelicFrame: relicPreparation.preparedRelicFrame,
    archivedRelicIds: [...relicPreparation.archivedRelicIds],
    preparedRelicSeedId: relicPreparation.preparedRelicSeedId,
    run: {
      ...(simplifiedEntry ? { entryFlowVersion: 2 as const } : {}),
      ...(simplifiedEntry ? { hiddenTaskSeed: createHiddenTaskSeed(options.hiddenTaskSeed) } : {}),
      dungeonId,
      currentNodeId: dungeon.grid.startNodeId,
      clearedNodeIds: [],
      captures: 0,
      capturedPetIds: [],
      usedItems: [],
      damageTaken: 0,
      resolvedEventIds: [],
      eventLog: [],
      lootBag: createEmptyRunLootBag<ItemId, EquipmentId>(),
      lootOffersMade: 0,
      tacticalLoadout,
      fieldSurveyState,
      ...(equipmentHunt === undefined ? {} : { equipmentHunt }),
      equipmentMemorySnapshot,
      ...(equipmentMemoryHunt === undefined ? {} : { equipmentMemoryHunt }),
      protocol: {
        id: protocolDefinition.id,
        rulesVersion: 1 as const
      },
      pressureState: createRunPressureState(),
      relicState,
      soulSkillState,
      relicConduitSourceEquipmentIds: [...relicConduitMatch.sourceEquipmentIds],
      lawState: entryLawState,
      broadcastEntryPassives,
      escortEntryGear,
      falseTestimonyEntryGear,
      routeContractState,
      ...(combatReplayState === undefined ? {} : { combatReplayState }),
      ...(companionSnapshot === undefined ? {} : { companionSnapshot }),
      methodSnapshots,
      ...(methodSnapshot === undefined ? {} : { methodSnapshot }),
      ...(bloodlineSnapshot === undefined ? {} : { bloodlineSnapshot }),
      pursuitState: createRunPursuitState(
        dungeonId,
        entryState.completedDungeonIds.includes(dungeonId)
      )
    },
    combat: undefined,
    lastOutcome: undefined
  };
  const sequenceBreakText =
    gate?.availabilityKind === 'sequence_break' ? `越级挑战：${gate.requirementText} ` : '';

  const protocolText = simplifiedEntry
    ? ` 当前难度：${protocolDefinition.id === 'standard' ? '普通' : protocolDefinition.id === 'imprint' ? '困难' : '炼狱'}。`
    : protocolDefinition.id === 'imprint'
      ? ` 轮回协议「${protocolDefinition.name}」已生效。`
      : protocolDefinition.id === 'deep'
        ? ` 深层轮回协议「${protocolDefinition.name}」已生效：轮回刻印 x1 已消耗且不返还；双锚点 0/${getRunProtocolRequiredNodeIds(protocolDefinition).length}，${protocolDefinition.objectiveText}`
        : '';
  const relicFrameText = simplifiedEntry
    ? ` 本轮回响偏向：${RUN_RELIC_FRAME_DEFINITIONS[relicState.frame].name}。`
    : ` 回响遗物「${RUN_RELIC_FRAME_DEFINITIONS[relicState.frame].name}」框架已冻结。`;
  const relicSeedText = relicState.seedRelicId
    ? ` 归档种子「${RUN_RELIC_DEFINITIONS[relicState.seedRelicId].name}」将在首轮候选中优先显现。`
    : '';
  const conduitText = relicConduitMatch.matched
    ? ` 导体来源已冻结：${relicConduitMatch.sourceEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join('、')}。`
    : '';
  const soulSkillText = soulSkillState.frozenSkillIds.length > 0
    ? ` 器魂技已冻结 ${soulSkillState.frozenSkillIds.length} 项，共鸣 charge ${soulSkillState.chargesRemaining}/2。`
    : '';
  const equipmentHuntText = equipmentHunt ? ' 装备追猎目标已冻结。' : '';
  const equipmentMemoryHuntText = equipmentMemoryHunt
    ? ` 铭刻记忆狩猎已冻结：${EQUIPMENT[equipmentMemoryHunt.equipmentId].name} / ${getEquipmentMemoryById(equipmentMemoryHunt.memoryId)?.name ?? equipmentMemoryHunt.memoryId}。`
    : '';
  const routeContractText = routeContractDefinition
    ? ` 路线契约「${routeContractDefinition.name}」已冻结，按指定次序完成两处目标可独立获得 ${routeContractDefinition.rewardPoints} 奖励点。`
    : '';
  const broadcastPassiveCount = Object.values(broadcastEntryPassives).filter(Boolean).length;
  const broadcastPassiveText = broadcastPassiveCount > 0
    ? ` 寂声法则装备被动已冻结 ${broadcastPassiveCount} 项。`
    : '';
  const escortGearCount = Object.values(escortEntryGear).filter(Boolean).length;
  const escortSnapshotText = dungeonId === 'lost_shelter'
    ? ` 护送装备被动已冻结 ${escortGearCount} 项，同伴快照${companionSnapshot ? `为${getCompanionDefinition(companionSnapshot.companionId)?.name ?? companionSnapshot.companionId} R${companionSnapshot.rank}` : '为空'}。`
    : '';
  const verdictGearCount = Object.values(falseTestimonyEntryGear).filter(Boolean).length;
  const verdictSnapshotText = dungeonId === 'false_testimony_court'
    ? ` 裁定法则装备被动已按入场装备冻结 ${verdictGearCount} 项。`
    : '';
  const panopticonGearCount = dungeonId === 'panopticon_city' && entryLawState.law.kind === 'panopticon_city'
    ? Object.values(entryLawState.law.entryGear).filter(Boolean).length
    : 0;
  const panopticonSnapshotText = dungeonId === 'panopticon_city'
    ? ` 三相扫描装备被动已按入场装备冻结 ${panopticonGearCount} 项。`
    : '';
  const entrySystemText = simplifiedEntry
    ? relicFrameText
    : `${relicFrameText}${relicSeedText}${conduitText}${soulSkillText}${equipmentHuntText}${equipmentMemoryHuntText}${routeContractText}${broadcastPassiveText}${escortSnapshotText}${verdictSnapshotText}${panopticonSnapshotText}`;

  return appendLog(
    nextState,
    `${sequenceBreakText}副本开启：${dungeon.name}。${dungeon.theme}${protocolText}${entrySystemText}`
  );
}

export function selectCombatReplayRoute(state: GameState, route: CombatReplayRoute): GameState {
  if (
    state.phase !== 'explore' ||
    state.combat ||
    state.run?.dungeonId !== 'combat_replay_stage' ||
    (route !== 'sequence' && route !== 'burst' && route !== 'afterbeat')
  ) {
    return state;
  }
  const replayState = normalizeCombatReplayRunState(state.run.combatReplayState);
  const lawState = getNormalizedDungeonLawState(state);
  if (!replayState || replayState.route || !lawState) return state;
  const resolution = selectCombatReplayRouteLaw(lawState, route);
  if (!resolution.selected) return state;
  return appendLog(
    {
      ...state,
      run: {
        ...state.run,
        lawState: resolution.state,
        combatReplayState: { ...replayState, route }
      }
    },
    `复演路线已冻结：${route === 'sequence' ? '顺序剪辑' : route === 'burst' ? '爆发蒙太奇' : '余拍回放'}。`
  );
}

export function selectPanopticonRoute(state: GameState, route: PanopticonRoute): GameState {
  if (
    state.phase !== 'explore' ||
    state.combat ||
    state.run?.dungeonId !== 'panopticon_city' ||
    (route !== 'shadow' && route !== 'decoy' && route !== 'refraction')
  ) {
    return state;
  }
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const status = getPanopticonStatus(lawState);
  if (status.pendingRouteNodeId !== state.run.currentNodeId) return state;
  const resolution = selectPanopticonRouteLaw(lawState, route);
  if (!resolution.selected) return state;
  const routeLabel: Record<PanopticonRoute, string> = {
    shadow: '影路潜行',
    decoy: '替身诱导',
    refraction: '折光潜入'
  };
  return appendLog(
    withDungeonLawState(state, resolution.state),
    `监察城路线已永久冻结：${routeLabel[route]}。`
  );
}

function advanceCurrentRunPursuitAfterMove(state: GameState): GameState {
  if (!state.run) return state;
  const pursuitState = getStrictRunPursuitState(state.run);
  if (!pursuitState) return state;

  const dungeon = DUNGEONS[state.run.dungeonId];
  const lawState = getNormalizedDungeonLawState(state);
  const blockedEdges: Array<{ fromNodeId: string; toNodeId: string }> = [];
  if (lawState) {
    for (const source of dungeon.nodes) {
      for (const target of dungeon.nodes) {
        if (
          areAdjacentNodes(source, target) &&
          getRouteBlockReason(dungeon.id, source.id, target.id, lawState)
        ) {
          blockedEdges.push({ fromNodeId: source.id, toNodeId: target.id });
        }
      }
    }
  }

  const definition = getRunPursuitDefinition(pursuitState.dungeonId);
  if (!definition) return state;
  const advanced = advanceRunPursuit(pursuitState, {
    nodes: dungeon.nodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y
    })),
    blockedEdges,
    playerNodeId: state.run.currentNodeId,
    containmentReady: state.run.clearedNodeIds.includes(definition.containmentNodeId)
  });

  let nextState: GameState = advanced.state === pursuitState
    ? state
    : {
        ...state,
        run: {
          ...state.run,
          pursuitState: advanced.state
        }
      };
  if (advanced.moved) {
    nextState = appendSecondaryLog(
      nextState,
      `破界追兵「${definition.name}」移动：${advanced.from ?? '未知'} -> ${advanced.to ?? '未知'}。`
    );
  }
  if (advanced.contained) {
    nextState = appendSecondaryLog(
      nextState,
      `破界追兵「${definition.name}」已收容，待成功撤离带回${ITEMS[definition.materialId].name} x1。`
    );
  }
  if (!advanced.contact) return nextState;

  const contactDamage = getRunPursuitContactDamage(
    nextState.player.maxHp,
    DUNGEONS[nextState.run?.dungeonId ?? pursuitState.dungeonId].tier
  );
  const damagedState = applyPlayerDamage(nextState, contactDamage);
  const actualDamage = nextState.player.hp - damagedState.player.hp;
  const contactedState = appendSecondaryLog(
    damagedState,
    `破界追兵「${definition.name}」与你接触，造成 ${actualDamage} 点伤害。`
  );
  return contactedState.player.hp <= 0
    ? resolveRunFailure(contactedState, `破界追兵「${definition.name}」完成猎杀，主神强制回收。`)
    : contactedState;
}

const COMBAT_REPLAY_ROUTE_PERCENT: Record<CombatReplayRoute, number> = {
  sequence: 100,
  burst: 60,
  afterbeat: 125
};

function getCombatReplayTakeId(nodeId: string): CombatReplayTakeId | undefined {
  return COMBAT_REPLAY_TAKE_IDS.includes(nodeId as CombatReplayTakeId)
    ? nodeId as CombatReplayTakeId
    : undefined;
}

function getCombatReplayTakeIdAtCursor(cursor: 0 | 1 | 2 | 3): CombatReplayTakeId | undefined {
  if (cursor === 0) return 'take_alpha';
  if (cursor === 1) return 'take_beta';
  if (cursor === 2) return 'take_gamma';
  return undefined;
}

function createCombatReplayCombatState(state: GameState, boss: boolean): CombatReplayCombatState | undefined {
  if (!state.run || getCombatReplayTakeId(state.run.currentNodeId)) return undefined;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return undefined;
  const status = getCombatReplayStatus(lawState);
  const source = boss ? status.bossSnapshot : status;
  if (!source?.route) return undefined;
  const recordings: Partial<Record<CombatReplayTakeId, CombatReplayRecording>> = {};
  source.takes.forEach((take, index) => {
    const takeId = COMBAT_REPLAY_TAKE_IDS[index as 0 | 1 | 2];
    if (take && takeId) recordings[takeId] = { ...take };
  });
  if (boss && COMBAT_REPLAY_TAKE_IDS.some((takeId) => !recordings[takeId])) return undefined;
  return {
    rulesVersion: 1,
    enabled: true,
    cursor: 0,
    buffer: 0,
    remainingBufferHits: 0,
    firstBoostUsed: false,
    route: source.route,
    recordings,
    entryGear: status.entryGear,
    boss
  };
}

function setNormalizedCombatReplayState(
  combat: CombatState,
  replay: CombatReplayCombatState
): CombatState {
  return { ...combat, combatReplayState: replay };
}

function releaseCombatReplay(
  state: GameState,
  multiplierPercent: number
): { state: GameState; released: boolean } {
  if (!state.combat) return { state, released: false };
  const replay = normalizeCombatReplayCombatState(state.combat.combatReplayState);
  if (!replay?.enabled || replay.cursor >= COMBAT_REPLAY_TAKE_IDS.length) return { state, released: false };
  const takeId = getCombatReplayTakeIdAtCursor(replay.cursor);
  if (!takeId) return { state, released: false };
  const recording = replay.recordings[takeId];
  const nextCursor = (replay.cursor + 1) as 1 | 2 | 3;
  if (!recording) {
    return {
      state: {
        ...state,
        combat: setNormalizedCombatReplayState(state.combat, { ...replay, cursor: nextCursor, pending: undefined })
      },
      released: false
    };
  }

  const boostPercent = replay.entryGear.cueVisor && !replay.firstBoostUsed ? 25 : 0;
  const effectivePercent = Math.max(0, multiplierPercent + boostPercent);
  const replayValue = Math.floor((recording.replayValue * effectivePercent) / 100);
  let monsterHp = state.combat.monsterHp;
  let buffer = replay.buffer;
  let remainingBufferHits = replay.remainingBufferHits;
  if (recording.action === 'guard') {
    if (replayValue > 0) {
      buffer += replayValue;
      remainingBufferHits = replay.entryGear.bufferPlate ? 2 : 1;
    }
  } else {
    monsterHp = Math.max(0, monsterHp - replayValue);
  }
  const actionLabel = recording.action === 'attack' ? '攻' : recording.action === 'art' ? '术' : '守';
  const line = recording.action === 'guard'
    ? `${takeId}复演「${actionLabel}」，生成 ${replayValue} 点缓冲。`
    : `${takeId}复演「${actionLabel}」，造成 ${replayValue} 点固定伤害。`;
  const nextReplay: CombatReplayCombatState = {
    ...replay,
    cursor: nextCursor,
    buffer,
    remainingBufferHits,
    firstBoostUsed: replay.firstBoostUsed || boostPercent > 0,
    pending: undefined
  };
  return {
    state: {
      ...state,
      combat: {
        ...state.combat,
        monsterHp,
        combatReplayState: nextReplay,
        log: [line, ...state.combat.log].slice(0, 8)
      }
    },
    released: true
  };
}

function queueOrReleaseCombatReplay(
  state: GameState,
  multiplierPercent: number
): GameState {
  if (!state.combat) return state;
  const replay = normalizeCombatReplayCombatState(state.combat.combatReplayState);
  if (!replay || replay.cursor >= 3) return state;
  const takeId = getCombatReplayTakeIdAtCursor(replay.cursor);
  if (!takeId) return state;
  if (replay.route !== 'afterbeat') return releaseCombatReplay(state, multiplierPercent).state;
  const pending: CombatReplayPending = {
    takeId,
    multiplierPercent
  };
  return {
    ...state,
    combat: setNormalizedCombatReplayState(state.combat, { ...replay, pending })
  };
}

function releasePendingAfterbeat(state: GameState): GameState {
  if (!state.combat || state.player.hp <= 0) return state;
  const replay = normalizeCombatReplayCombatState(state.combat.combatReplayState);
  if (!replay?.pending || replay.pending.takeId !== getCombatReplayTakeIdAtCursor(replay.cursor)) return state;
  return releaseCombatReplay(state, replay.pending.multiplierPercent).state;
}

function applyCombatReplayOpening(state: GameState): GameState {
  if (!state.combat) return state;
  let replay = normalizeCombatReplayCombatState(state.combat.combatReplayState);
  if (!replay?.enabled) return state;
  let nextState = state;
  if (replay.boss) {
    if (!replay.entryGear.thawMetronome) return state;
    return releaseCombatReplay(
      state,
      Math.floor((COMBAT_REPLAY_ROUTE_PERCENT[replay.route] * 75) / 100)
    ).state;
  }
  if (replay.route !== 'burst') return state;
  while (nextState.combat?.monsterHp && (replay = normalizeCombatReplayCombatState(nextState.combat.combatReplayState)) && replay.cursor < 3) {
    nextState = releaseCombatReplay(nextState, COMBAT_REPLAY_ROUTE_PERCENT.burst).state;
  }
  return nextState;
}

function getBossReplayDirectMultiplier(
  state: GameState,
  action: CombatReplayDirectAction
): number {
  const replay = normalizeCombatReplayCombatState(state.combat?.combatReplayState);
  if (!replay?.enabled || !replay.boss || state.combat?.bossPhase !== 'awakened' || replay.cursor >= 3) return 1;
  const takeId = getCombatReplayTakeIdAtCursor(replay.cursor);
  return takeId && replay.recordings[takeId]?.action === action ? 0.5 : 1;
}

function resolveBossReplayDirectAction(
  state: GameState,
  action: CombatReplayDirectAction
): GameState {
  const replay = normalizeCombatReplayCombatState(state.combat?.combatReplayState);
  if (!state.combat || !replay?.enabled || !replay.boss || replay.cursor >= 3) return state;
  const takeId = getCombatReplayTakeIdAtCursor(replay.cursor);
  const nextRecording = takeId ? replay.recordings[takeId] : undefined;
  if (!nextRecording) return state;
  const matches = nextRecording.action === action;
  if (state.combat.bossPhase === 'sealed' && !matches) return state;
  if (state.combat.bossPhase === 'awakened' && matches) return state;
  const phasePercent = state.combat.bossPhase === 'awakened' ? 75 : 100;
  return queueOrReleaseCombatReplay(
    state,
    Math.floor((COMBAT_REPLAY_ROUTE_PERCENT[replay.route] * phasePercent) / 100)
  );
}

function resolveCombatReplayAfterDirectAction(
  state: GameState,
  action: CombatReplayDirectAction
): GameState {
  const replay = normalizeCombatReplayCombatState(state.combat?.combatReplayState);
  if (!replay?.enabled) return state;
  if (replay.boss) return resolveBossReplayDirectAction(state, action);
  return replay.route === 'afterbeat'
    ? queueOrReleaseCombatReplay(state, COMBAT_REPLAY_ROUTE_PERCENT.afterbeat)
    : state;
}

function recordCombatReplayDirectAction(
  state: GameState,
  action: CombatReplayDirectAction,
  observedValue: number
): GameState {
  if (!state.run || state.run.dungeonId !== 'combat_replay_stage' || !state.combat) return state;
  const takeId = getCombatReplayTakeId(state.combat.nodeId);
  const replay = normalizeCombatReplayRunState(state.run.combatReplayState);
  const lawState = getNormalizedDungeonLawState(state);
  if (!takeId || !replay || replay.recordings[takeId] || !lawState) return state;
  const resolution = recordCombatReplayTakeLaw(
    lawState,
    takeId,
    action,
    Math.min(9999, Math.max(0, Math.floor(observedValue)))
  );
  if (!resolution.recorded) return state;
  const status = getCombatReplayStatus(resolution.state);
  const recording = status.takes[COMBAT_REPLAY_TAKE_IDS.indexOf(takeId)];
  if (!recording) return state;
  const line = `${takeId}录制完成：${action}/${recording.observedValue}。`;
  return {
    ...state,
    run: {
      ...state.run,
      lawState: resolution.state,
      combatReplayState: {
        ...replay,
        recordings: { ...replay.recordings, [takeId]: recording }
      }
    },
    combat: {
      ...state.combat,
      log: [line, ...state.combat.log].slice(0, 8)
    }
  };
}

function advancePanopticonAfterMove(state: GameState, targetNode: DungeonNode): GameState {
  if (state.run?.dungeonId !== 'panopticon_city') return state;
  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const advanced = advancePanopticonScan(lawState, targetNode.position);
  let nextState = withDungeonLawState(state, advanced.state);
  if (advanced.rewardPoints > 0) {
    nextState = applyRunReward(nextState, { rewardPoints: advanced.rewardPoints });
  }
  const scanDamage = advanced.damagePercent > 0
    ? Math.max(1, Math.floor(state.player.maxHp * advanced.damagePercent / 100))
    : 0;
  const beforeHp = nextState.player.hp;
  if (scanDamage > 0) nextState = applyPlayerDamage(nextState, scanDamage);
  const actualDamage = beforeHp - nextState.player.hp;
  const effectText = !advanced.scanned
    ? '目标坐标未与扫描相位重合'
    : !advanced.exposed
      ? '影路遮蔽，本次不新增曝光且免疫扫描伤害'
      : advanced.evaded
        ? '先见目镜消耗本相位首次保护，闪避扫描伤害'
        : `曝光并承受最大生命 ${advanced.damagePercent}%（${actualDamage} 点）伤害`;
  const rewardText = advanced.rewardPoints > 0 ? `，诱饵奖励 +${advanced.rewardPoints} 本局RP` : '';
  const chargeText = advanced.chargeGranted ? '，折光充能 +1' : '';
  nextState = appendSecondaryLog(
    nextState,
    `三相扫描 ${advanced.phaseBefore}->${advanced.phaseAfter}：${effectText}${rewardText}${chargeText}。`
  );
  return nextState.player.hp <= 0
    ? resolveRunFailure(nextState, '三相扫描完成曝光处决，主神强制回收。')
    : nextState;
}

export function moveToNode(state: GameState, nodeId: string): GameState {
  if (!state.run) return appendLog(state, '你还没有进入副本。');
  if (state.phase === 'combat') return appendLog(state, '战斗中无法走格移动。');

  const dungeon = DUNGEONS[state.run.dungeonId];
  const currentNode = getNodeById(dungeon, state.run.currentNodeId);
  const targetNode = getNodeById(dungeon, nodeId);

  if (!targetNode) return appendLog(state, '当前副本没有这个格子。');
  if (!currentNode) return appendLog(state, '当前位置不在副本网格上。');
  if (targetNode.id === currentNode.id) return appendLog(state, `你已经站在${targetNode.title}。`);
  if (!areAdjacentNodes(currentNode, targetNode)) {
    return appendLog(state, `${targetNode.title}不在相邻格，无法直接移动。`);
  }
  const departureBlockReason = getNodeDepartureBlockReason(state);
  if (departureBlockReason) return appendLog(state, departureBlockReason);
  const routeGate = getCurrentRouteGateStatus(state, targetNode.id);
  if (routeGate?.status === 'closed') {
    return appendLog(state, `路线「${routeGate.gate.label}」封闭：${routeGate.blockReason}`);
  }

  const movedState = appendLog(
    {
      ...state,
      phase: 'explore',
      combat: undefined,
      run: {
        ...state.run,
        currentNodeId: targetNode.id
      }
    },
    `你移动到${targetNode.title}。`
  );
  const scannedState = advancePanopticonAfterMove(movedState, targetNode);
  return scannedState.phase === 'result'
    ? scannedState
    : advanceCurrentRunPursuitAfterMove(scannedState);
}

export function selectNode(state: GameState, nodeId: string): GameState {
  if (!state.run) return appendLog(state, '你还没有进入副本。');

  const node = getNodeById(DUNGEONS[state.run.dungeonId], nodeId);
  if (!node) return appendLog(state, '当前副本没有这个节点。');
  if (nodeId !== state.run.currentNodeId) {
    return appendLog(state, `必须先走格移动到${node.title}，再处理当前节点。`);
  }

  if (state.run.clearedNodeIds.includes(nodeId)) {
    return appendLog(
      {
        ...state,
        phase: 'explore',
        combat: undefined
      },
      `${node.title}已经清理，主神不会重复结算。`
    );
  }

  if (node.type === 'monster' && node.monsterId) {
    const monster = MONSTERS[node.monsterId];
    const bossDefinition = getBossDefinitionForNode(state.run.dungeonId, node.id);
    if (bossDefinition && state.run.dungeonId === 'panopticon_city') {
      const panopticonLaw = getNormalizedDungeonLawState(state);
      if (!panopticonLaw || !getPanopticonStatus(panopticonLaw).readyForBoss) {
        return appendLog(state, '万目监察者尚未开放：先完成三座盲区中继并选择潜入路线。');
      }
    }
    const currentPursuitState = bossDefinition ? getStrictRunPursuitState(state.run) : undefined;
    const fusedPursuitState = currentPursuitState
      ? fuseRunPursuitAtBoss(currentPursuitState)
      : undefined;
    const pursuitEncounterState = fusedPursuitState && fusedPursuitState !== currentPursuitState
      ? {
          ...state,
          run: {
            ...state.run,
            pursuitState: fusedPursuitState
          }
        }
      : state;
    const currentLawState = getNormalizedDungeonLawState(pursuitEncounterState);
    // A non-offensive placeholder locks the citadel assessment before any boss action can affect it.
    const encounterState =
      bossDefinition && currentLawState
        ? withDungeonLawState(
            pursuitEncounterState,
            signalCombatStarted(currentLawState, {
              nodeId: node.id,
              isBoss: true,
              openingAction: 'escape'
            })
          )
        : pursuitEncounterState;
    // Snapshot the anchor state when the boss is engaged so every later phase uses the same breach profile.
    const protocolAnchorCompletedBeforeBoss = bossDefinition
      ? isProtocolAnchorCompletedBeforeBoss(encounterState)
      : undefined;
    const combatStats = getProtocolMonster(
      encounterState,
      monster,
      bossDefinition,
      'sealed',
      protocolAnchorCompletedBeforeBoss
    );
    const openingLine = bossDefinition
      ? `【首领·${bossDefinition.bossTitle}】${bossDefinition.openingLine}`
      : `${monster.name}出现：${monster.ability}`;
    const initialFocus = normalizeCombatFocus(
      getCurrentRunRelicEffects(encounterState).combatStartFocusBonus
    );
    const relicFocusLine = initialFocus > 0
      ? `聚念棱镜令初始战意 +${initialFocus}，当前 ${initialFocus}/${COMBAT_FOCUS_MAX}。`
      : undefined;
    const equipmentMemoryState = encounterState.run
      ? createEquipmentMemoryCombatState(
          encounterState.run.equipmentMemorySnapshot,
          encounterState.run.dungeonId
        )
      : undefined;
    const combatReplayState = encounterState.run?.dungeonId === 'combat_replay_stage'
      ? createCombatReplayCombatState(encounterState, Boolean(bossDefinition))
      : undefined;
    const startedState = appendLog(
      {
        ...encounterState,
        phase: 'combat',
        combat: {
          nodeId,
          monsterId: node.monsterId,
          monsterHp: combatStats.maxHp,
          turn: 1,
          guarding: false,
          companionAssistUsed: false,
          methodTechniqueUsedIds: [],
          methodTechniqueUsed: false,
          bloodlineSurgeUsed: false,
          bloodlineBarrier: 0,
          damageTakenAtStart: encounterState.run?.damageTaken ?? 0,
          weaponFocus: initialFocus,
          bossPhase: bossDefinition ? 'sealed' : undefined,
          protocolAnchorCompletedBeforeBoss,
          effects: {},
          ...(equipmentMemoryState === undefined ? {} : { equipmentMemoryState }),
          ...(combatReplayState === undefined ? {} : { combatReplayState }),
          log: [...(relicFocusLine ? [relicFocusLine] : []), openingLine]
        }
      },
      bossDefinition
        ? `${bossDefinition.sealName}落下，进入首领战。${fusedPursuitState !== currentPursuitState ? ` 破界追兵「${getRunPursuitDefinition(state.run.dungeonId)?.name ?? state.run.dungeonId}」已与首领融合。` : ''}`
        : `遭遇${monster.name}，进入回合战斗。`
    );
    const replayedOpening = applyCombatReplayOpening(startedState);
    return (replayedOpening.combat?.monsterHp ?? 1) <= 0
      ? finishCombatVictory(replayedOpening, combatStats)
      : replayedOpening;
  }

  return appendLog(
    {
      ...state,
      phase: 'explore'
    },
    `你抵达节点：${node.title}。`
  );
}

function getTrapRiskResolution(state: GameState, node: DungeonNode) {
  if (!node.trap || !state.run) return undefined;
  const lawModifiers = getCurrentDungeonLaw(state)?.modifiers;
  const lawTrap = lawModifiers
    ? {
        ...node.trap,
        damage: scaleByPercent(node.trap.damage, lawModifiers.trap.damagePercent, 1),
        dc: scaleByPercent(node.trap.dc, lawModifiers.trap.dcPercent, 1)
      }
    : node.trap;
  // Trap stats layer deterministically: law, protocol, then cross-dungeon pressure.
  const protocolTrap = scaleTrapForRunProtocol(lawTrap, state.run.dungeonId, getRunProtocolId(state.run));
  const trap = scaleTrapForRunPressure(protocolTrap, state.run.pressureState);
  const stats = getDerivedStats(state);
  const utility = resolveCombatUtilityAction({
    action: 'trap_scout',
    context: getCombatMechanicsContext(state),
    baseTrapCheck: stats.trapCheck
  });
  const availableMethods = getAvailableLearnedMethods(state);

  return {
    trap,
    utility,
    availableMethods,
    naturallyPassed: utility.trapCheck >= trap.dc || availableMethods.includes('mist_breathing')
  };
}

function resolveTrapRisk(
  state: GameState,
  node: DungeonNode,
  resolution: NonNullable<ReturnType<typeof getTrapRiskResolution>>,
  passed: boolean,
  prefix = ''
): GameState {
  if (!state.run) return state;
  const ironBodyReduction = resolution.availableMethods.includes('iron_body') ? 0.8 : 1;
  const damageBeforeRelic = Math.max(
    4,
    Math.floor((passed ? resolution.trap.damage * 0.45 : resolution.trap.damage) * ironBodyReduction)
  );
  const relicEffects = getCurrentRunRelicEffects(state);
  const damage = Math.max(0, Math.floor(damageBeforeRelic * relicEffects.trapDamageMultiplier));
  const statusPrefix = resolution.utility.statusLines.length > 0
    ? `${resolution.utility.statusLines.join(' ')} `
    : '';
  const damaged = applyPlayerDamage(state, damage);
  const actualDamage = (damaged.run?.damageTaken ?? state.run.damageTaken) - state.run.damageTaken;
  const relicPrefix = damage < damageBeforeRelic
    ? `铁回响将陷阱伤害从 ${damageBeforeRelic} 点降至 ${damage} 点。`
    : '';

  return appendLog(
    markNodeCleared(damaged, node.id, actualDamage),
    passed
      ? `${prefix}${statusPrefix}${relicPrefix}${node.title}被你提前看破，但仍擦出 ${actualDamage} 点伤害。`
      : `${prefix}${statusPrefix}${relicPrefix}${node.title}爆发，你承受 ${actualDamage} 点伤害。`
  );
}

function resolveTrapWithForcedSoulPass(
  state: GameState,
  definition: EquipmentSoulSkillDefinition
): GameState {
  const node = getCurrentNode(state);
  const resolution = node ? getTrapRiskResolution(state, node) : undefined;
  if (!node?.trap || !resolution || resolution.naturallyPassed) {
    return appendLog(state, `${definition.name}当前没有可改写的失败判定。`);
  }

  const consumed = consumeCurrentEquipmentSoulSkill(state, definition.id, definition);
  if (consumed === state) return appendLog(state, `${definition.name}没有响应。`);
  return resolveTrapRisk(consumed, node, resolution, true, `${definition.name}固定了雾中真相。`);
}

export function handleTrap(state: GameState, choice: TrapChoice = 'auto'): GameState {
  const node = getCurrentNode(state);
  const resolution = node ? getTrapRiskResolution(state, node) : undefined;
  if (!node?.trap || !state.run || !resolution) return appendLog(state, '当前位置没有可处理的陷阱。');

  const { trap } = resolution;
  const counterItem = trap.counterItem;
  const counterAvailable = Boolean(
    counterItem &&
      state.inventory[counterItem] > 0 &&
      (isTacticalItemId(counterItem)
        ? isTacticalItemAvailable(state, counterItem)
        : isDungeonConsumableAvailable(state, counterItem))
  );
  const shouldCounter = choice === 'counter' || (choice === 'auto' && counterAvailable);

  if (shouldCounter && !counterItem) {
    return appendLog(state, `${node.title}没有可用的反制道具，节点尚未处理。`);
  }
  if (shouldCounter && counterItem && !counterAvailable) {
    const unavailableLog = isTacticalItemId(counterItem)
      ? getTacticalItemUnavailableLog(state, counterItem)
      : `背包里没有${ITEMS[counterItem].name}。`;
    return appendLog(state, `${unavailableLog} ${node.title}尚未处理。`);
  }
  if (shouldCounter && counterItem) {
    return appendLog(
      markNodeCleared(
        recordUsedItem(
          consumeItem(state, counterItem),
          counterItem
        ),
        node.id
      ),
      `${ITEMS[counterItem].name}压住陷阱灵光，你无伤通过${node.title}。`
    );
  }

  const unavailablePrefix =
    choice === 'auto' && counterItem && isTacticalItemId(counterItem)
      ? (() => {
          const availability = getTacticalItemAvailability(state, counterItem);
          return !availability.available && availability.reason !== 'missing'
            ? `${getTacticalItemUnavailableLog(state, counterItem)} `
            : '';
        })()
      : '';

  return resolveTrapRisk(state, node, resolution, resolution.naturallyPassed, unavailablePrefix);
}

function getForcedPortalDamage(dungeonTier: number, portalStabilityBonus: number): number {
  const baseDamage = 8 + dungeonTier * 8;
  const anchorReduction = portalStabilityBonus * 4;
  return Math.max(dungeonTier * 4, baseDamage - anchorReduction);
}

function createPursuitSettlement(
  pursuitState: RunPursuitState,
  reason: RunPursuitSettlement['reason'],
  rewarded: boolean
): RunPursuitSettlement {
  const definition = getRunPursuitDefinition(pursuitState.dungeonId);
  if (!definition) throw new RangeError(`Unknown pursuit dungeon: ${pursuitState.dungeonId}`);
  return {
    state: pursuitState,
    reason,
    materialId: definition.materialId,
    rewarded
  };
}

type PortalPursuitTransition = {
  readonly sourceRun: DungeonRun;
  readonly preserveLegacyMissing: boolean;
  readonly targetPursuitState?: RunPursuitState;
  readonly settlementLog?: string;
};

function transitionRunPursuitThroughPortal(
  run: DungeonRun,
  targetDungeonId: DungeonId,
  choice: Exclude<PortalChoice, 'auto'>
): PortalPursuitTransition {
  const crossedDungeon = run.dungeonId !== targetDungeonId;
  if (!hasRunPursuitStateField(run)) {
    return { sourceRun: run, preserveLegacyMissing: true };
  }

  const pursuitState = getStrictRunPursuitState(run);
  if (!pursuitState) {
    const disabledTarget = createRunPursuitState(targetDungeonId, false);
    return {
      sourceRun: {
        ...run,
        ...(crossedDungeon ? {} : { pursuitState: disabledTarget }),
        lastPursuitSettlement: undefined
      },
      preserveLegacyMissing: false,
      targetPursuitState: disabledTarget
    };
  }

  const definition = getRunPursuitDefinition(pursuitState.dungeonId);
  if (!definition) return { sourceRun: run, preserveLegacyMissing: false };

  if (choice === 'stabilize') {
    const originState = repelRunPursuitAtStablePortal(pursuitState);
    const targetPursuitState = crossedDungeon
      ? createRunPursuitState(targetDungeonId, false)
      : originState;
    const settlement = createPursuitSettlement(originState, 'stable_portal', false);
    const settlementLog = pursuitState.status === 'contained'
      ? `破界追兵「${definition.name}」保持收容，待成功撤离带回${ITEMS[definition.materialId].name} x1。`
      : originState.status === 'repelled' && originState !== pursuitState
        ? `稳定传送门驱离了破界追兵「${definition.name}」，材料奖励为 0。`
        : `稳定传送门未改变破界追兵「${definition.name}」的 ${originState.status} 状态，材料奖励为 0。`;
    return {
      sourceRun: {
        ...run,
        pursuitState: crossedDungeon ? originState : targetPursuitState,
        lastPursuitSettlement: settlement
      },
      preserveLegacyMissing: false,
      targetPursuitState,
      settlementLog
    };
  }

  const targetPursuitState = pursuitState.status === 'stalking'
    ? carryRunPursuitThroughForcedPortal(pursuitState, targetDungeonId)
    : crossedDungeon
      ? createRunPursuitState(targetDungeonId, false)
      : pursuitState;
  const settlement = createPursuitSettlement(pursuitState, 'forced_portal', false);
  const settlementLog = pursuitState.status === 'stalking'
    ? `破界追兵「${definition.name}」被强制传送带往${DUNGEONS[targetDungeonId].name}，保留 ${pursuitState.contacts} 次接触并获得 1 次移动宽限。`
    : pursuitState.status === 'contained'
      ? `破界追兵「${definition.name}」保持收容，待成功撤离带回${ITEMS[definition.materialId].name} x1。`
      : `强制传送未合成新的破界追兵，原 ${pursuitState.status} 状态材料奖励为 0。`;
  return {
    sourceRun: {
      ...run,
      pursuitState: crossedDungeon ? pursuitState : targetPursuitState,
      lastPursuitSettlement: settlement
    },
    preserveLegacyMissing: false,
    targetPursuitState,
    settlementLog
  };
}

function resolvePortal(
  state: GameState,
  choice: PortalChoice = 'auto',
  offsetTargetNodeId?: string,
  soulSkillDefinition?: EquipmentSoulSkillDefinition
): GameState {
  if (getCurrentEquipmentSoulSkillRunState(state)?.pendingRecharge) {
    return appendLog(state, SOUL_RECHARGE_PENDING_BLOCK_MESSAGE);
  }
  const node = getCurrentNode(state);
  if (!node?.portal || !state.run) return appendLog(state, '当前位置没有传送门。');

  const targetGate = getCampaignGates(state).find((gate) => gate.dungeonId === node.portal?.targetDungeonId);
  if (targetGate?.status === 'locked') {
    return appendLog(state, `传送门被主线门禁拦截：${targetGate.requirementText}`);
  }
  if (offsetTargetNodeId && !getPortalOffsetTargetIds(state).includes(offsetTargetNodeId)) {
    return appendLog(state, '所选错位落点不是默认目标旁的合法节点。');
  }

  const stableItem = node.portal.stableItem;
  const stableItemAvailable = Boolean(
    stableItem &&
      state.inventory[stableItem] > 0 &&
      (isTacticalItemId(stableItem)
        ? isTacticalItemAvailable(state, stableItem)
        : isDungeonConsumableAvailable(state, stableItem))
  );
  const resolvedChoice: Exclude<PortalChoice, 'auto'> =
    choice === 'auto' ? (stableItemAvailable ? 'stabilize' : 'force') : choice;

  if (resolvedChoice === 'stabilize' && !stableItem) {
    return appendLog(state, '这道传送门没有可用的稳定道具，无法执行稳定传送。');
  }
  if (resolvedChoice === 'stabilize' && stableItem && !stableItemAvailable) {
    const unavailableLog = isTacticalItemId(stableItem)
      ? getTacticalItemUnavailableLog(state, stableItem)
      : `背包里没有${ITEMS[stableItem].name}。`;
    return appendLog(state, `${unavailableLog} 传送门没有启动。`);
  }

  const utility = resolveCombatUtilityAction({
    action: 'portal_anchor',
    context: getCombatMechanicsContext(state),
    basePortalStability: resolvedChoice === 'stabilize' ? 1 : 0
  });
  let nextState = state;
  const statusLines = [...utility.statusLines];

  if (soulSkillDefinition) {
    nextState = consumeCurrentEquipmentSoulSkill(nextState, soulSkillDefinition.id, soulSkillDefinition);
    if (nextState === state) return appendLog(state, `${soulSkillDefinition.name}没有响应。`);
    statusLines.push(`${soulSkillDefinition.name}将落点偏移到默认坐标旁。`);
  }

  if (resolvedChoice === 'stabilize' && stableItem) {
    nextState = recordUsedItem(
      consumeItem(nextState, stableItem),
      stableItem
    );
    statusLines.push(`${ITEMS[stableItem].name}稳住裂隙，你没有受到传送反噬。`);
  } else {
    if (choice === 'auto' && stableItem && isTacticalItemId(stableItem)) {
      const availability = getTacticalItemAvailability(state, stableItem);
      if (!availability.available && availability.reason !== 'missing') {
        statusLines.push(`${getTacticalItemUnavailableLog(state, stableItem)} 自动改为强闯。`);
      }
    }

    const sourceTier = DUNGEONS[state.run.dungeonId].tier;
    const forceDamageBeforeRelic = getForcedPortalDamage(sourceTier, utility.portalStabilityBonus);
    const forceDamage = Math.max(
      0,
      Math.floor(
        forceDamageBeforeRelic * getCurrentRunRelicEffects(nextState).forcedPortalBacklashMultiplier
      )
    );
    const damaged = applyPlayerDamage(nextState, forceDamage);
    const actualDamage = nextState.player.hp - damaged.player.hp;
    if (forceDamage < forceDamageBeforeRelic) {
      statusLines.push(`门锚将最终传送反噬从 ${forceDamageBeforeRelic} 点降至 ${forceDamage} 点。`);
    }
    statusLines.push(`你强闯裂隙，承受 ${actualDamage} 点传送反噬。`);
    if (damaged.player.hp <= 0) {
      return resolveRunFailure(damaged, `${statusLines.join(' ')} 主神在传送完成前强制回收。`);
    }
    nextState = damaged;
  }

  const echoAvailability = getTacticalItemAvailability(nextState, 'echo_coin');
  nextState = markNodeCleared(nextState, node.id);
  if (echoAvailability.available) {
    nextState = recordUsedItem(consumeItem(nextState, 'echo_coin'), 'echo_coin');
    nextState = applyRunReward(nextState, { rewardPoints: 20 });
    statusLines.push('回响钱币应声碎裂，20 点未结算奖励进入战利品袋。');
  } else if (nextState.inventory.echo_coin > 0 && echoAvailability.reason !== 'missing') {
    statusLines.push(getTacticalItemUnavailableLog(nextState, 'echo_coin') ?? '');
  }

  if (utility.portalStabilityBonus > 0) {
    nextState = applyRunReward(nextState, { rewardPoints: utility.portalStabilityBonus * 10 });
  }

  const statusPrefix = statusLines.filter(Boolean).length > 0 ? `${statusLines.filter(Boolean).join(' ')} ` : '';
  const equipmentHunt = isEquipmentHuntRunState(nextState.run?.equipmentHunt)
    ? markEquipmentHuntPortalCrossed(nextState.run.equipmentHunt)
    : undefined;
  const untransitionedSourceRun = nextState.run;
  const crossedDungeon = untransitionedSourceRun?.dungeonId !== node.portal.targetDungeonId;
  const pursuitTransition = untransitionedSourceRun
    ? transitionRunPursuitThroughPortal(
        untransitionedSourceRun,
        node.portal.targetDungeonId,
        resolvedChoice
      )
    : undefined;
  const sourceRun = pursuitTransition?.sourceRun ?? untransitionedSourceRun;
  const equipmentMemoryHuntResult = sourceRun && crossedDungeon
    ? settleDungeonRunEquipmentMemoryHunt(sourceRun, 'cross_dungeon', false)
    : undefined;
  const memorySettledSourceRun = equipmentMemoryHuntResult?.run ?? sourceRun;
  const routeContractResult = memorySettledSourceRun && crossedDungeon
    ? settleDungeonRunRouteContract(memorySettledSourceRun, 'cross_dungeon')
    : undefined;
  const settledSourceRun = routeContractResult?.run ?? memorySettledSourceRun;
  const sourceHasBloodlineSnapshot = Boolean(
    settledSourceRun && Object.prototype.hasOwnProperty.call(settledSourceRun, 'bloodlineSnapshot')
  );
  const sourceBloodlineSnapshot = sourceHasBloodlineSnapshot
    ? (settledSourceRun as DungeonRun & { bloodlineSnapshot?: BloodlineRunSnapshot }).bloodlineSnapshot
    : undefined;
  const sourceHasCompanionSnapshot = Boolean(
    settledSourceRun && hasOwnField(settledSourceRun, 'companionSnapshot')
  );
  const sourceCompanionSnapshot = sourceHasCompanionSnapshot
    ? settledSourceRun?.companionSnapshot
    : undefined;
  const broadcastEntryPassives = settledSourceRun
    ? getRunBroadcastEntryPassives(settledSourceRun)
    : { ...EMPTY_BROADCAST_ENTRY_PASSIVES };
  const escortEntryGear = settledSourceRun
    ? getRunEscortEntryGear(settledSourceRun)
    : { ...EMPTY_ESCORT_ENTRY_GEAR };
  const falseTestimonyEntryGear = settledSourceRun
    ? getRunFalseTestimonyEntryGear(settledSourceRun)
    : { ...EMPTY_FALSE_TESTIMONY_ENTRY_GEAR };
  const routeContractLog = routeContractResult?.settlement?.state
    ? ` 原副本${settledSourceRun?.entryFlowVersion === 2 ? '隐藏任务' : '路线契约'}已按跨副本遗失结算，奖励为 0。`
    : '';
  const equipmentMemoryHuntLog = getEquipmentMemoryHuntSettlementLog(
    equipmentMemoryHuntResult?.settlement
  );

  const transportedState = appendLog(
    {
      ...nextState,
      phase: 'explore',
      run: {
        ...(settledSourceRun?.entryFlowVersion === 2
          ? {
              entryFlowVersion: 2 as const,
              hiddenTaskSeed: createHiddenTaskSeed(settledSourceRun.hiddenTaskSeed)
            }
          : {}),
        dungeonId: node.portal.targetDungeonId,
        currentNodeId: offsetTargetNodeId ?? node.portal.targetNodeId,
        clearedNodeIds: [],
        captures: 0,
        capturedPetIds: settledSourceRun?.capturedPetIds ?? [],
        usedItems: settledSourceRun?.usedItems ?? [],
        damageTaken: settledSourceRun?.damageTaken ?? 0,
        resolvedEventIds: [],
        eventLog: [],
        lootBag: settledSourceRun?.lootBag ?? createEmptyRunLootBag<ItemId, EquipmentId>(),
        lootOffersMade: settledSourceRun?.lootOffersMade ?? 0,
        tacticalLoadout: settledSourceRun?.tacticalLoadout,
        fieldSurveyState: settledSourceRun?.fieldSurveyState,
        ...(equipmentHunt === undefined ? {} : { equipmentHunt }),
        ...(settledSourceRun && hasOwnField(settledSourceRun, 'equipmentMemorySnapshot')
          ? { equipmentMemorySnapshot: settledSourceRun.equipmentMemorySnapshot }
          : {}),
        ...(settledSourceRun && hasOwnField(settledSourceRun, 'equipmentMemoryHunt')
          ? { equipmentMemoryHunt: settledSourceRun.equipmentMemoryHunt }
          : {}),
        ...(settledSourceRun && hasOwnField(settledSourceRun, 'companionSnapshot')
          ? { companionSnapshot: settledSourceRun.companionSnapshot }
          : {}),
        ...(settledSourceRun && hasOwnField(settledSourceRun, 'methodSnapshots')
          ? { methodSnapshots: settledSourceRun.methodSnapshots }
          : {}),
        ...(settledSourceRun && hasOwnField(settledSourceRun, 'methodSnapshot')
          ? { methodSnapshot: settledSourceRun.methodSnapshot }
          : {}),
        ...(sourceHasBloodlineSnapshot ? { bloodlineSnapshot: sourceBloodlineSnapshot } : {}),
        protocol: settledSourceRun?.protocol ?? { id: 'standard', rulesVersion: 1 },
        ...(settledSourceRun?.pressureState === undefined
          ? {}
          : { pressureState: settledSourceRun.pressureState }),
        relicState: settledSourceRun?.relicState,
        soulSkillState: settledSourceRun?.soulSkillState,
        relicConduitSourceEquipmentIds: settledSourceRun?.relicConduitSourceEquipmentIds,
        broadcastEntryPassives,
        escortEntryGear,
        falseTestimonyEntryGear,
        lawState: createEntryDungeonLawState(
          nextState,
          node.portal.targetDungeonId,
          sourceBloodlineSnapshot,
          broadcastEntryPassives,
          escortEntryGear,
          falseTestimonyEntryGear,
          sourceCompanionSnapshot
        ),
        ...(node.portal.targetDungeonId === 'combat_replay_stage'
          ? { combatReplayState: createCombatReplayRunState(nextState) }
          : {}),
        ...(settledSourceRun && hasRouteContractStateField(settledSourceRun)
          ? { routeContractState: crossedDungeon ? undefined : settledSourceRun.routeContractState }
          : {}),
        ...(pursuitTransition?.preserveLegacyMissing
          ? {}
          : pursuitTransition?.targetPursuitState === undefined
            ? {}
            : { pursuitState: pursuitTransition.targetPursuitState }),
        pendingEquipmentOffer: settledSourceRun?.pendingEquipmentOffer,
        ...(settledSourceRun?.lastLootSettlement === undefined
          ? {}
          : { lastLootSettlement: settledSourceRun.lastLootSettlement }),
        ...(settledSourceRun?.lastProtocolSettlement === undefined
          ? {}
          : { lastProtocolSettlement: settledSourceRun.lastProtocolSettlement }),
        ...(settledSourceRun?.lastPressureSettlement === undefined
          ? {}
          : { lastPressureSettlement: settledSourceRun.lastPressureSettlement }),
        lastRelicSettlement: settledSourceRun?.lastRelicSettlement,
        ...(settledSourceRun?.lastEquipmentCommissionSettlement === undefined
          ? {}
          : { lastEquipmentCommissionSettlement: settledSourceRun.lastEquipmentCommissionSettlement }),
        ...(settledSourceRun?.lastRouteContractSettlement === undefined
          ? {}
          : { lastRouteContractSettlement: settledSourceRun.lastRouteContractSettlement }),
        ...(settledSourceRun?.lastEquipmentMemoryHuntSettlement === undefined
          ? {}
          : {
              lastEquipmentMemoryHuntSettlement:
                settledSourceRun.lastEquipmentMemoryHuntSettlement
            }),
        ...(settledSourceRun?.lastPursuitSettlement === undefined
          ? {}
          : { lastPursuitSettlement: settledSourceRun.lastPursuitSettlement })
      }
    },
    `${statusPrefix}传送门开启，你被送往${DUNGEONS[node.portal.targetDungeonId].name}。${routeContractLog}`
  );
  const memoryLoggedState = equipmentMemoryHuntLog
    ? appendLog(transportedState, equipmentMemoryHuntLog)
    : transportedState;
  return pursuitTransition?.settlementLog
    ? appendSecondaryLog(memoryLoggedState, pursuitTransition.settlementLog)
    : memoryLoggedState;
}

export function usePortal(state: GameState, choice: PortalChoice = 'auto'): GameState {
  return resolvePortal(state, choice);
}

function getResolvedNodeReward(
  state: GameState,
  node: DungeonNode
): { reward: RewardBundle; line: string } | undefined {
  if (!node.reward) return undefined;

  let reward: RewardBundle = node.reward;
  let line = `${node.title}结算完成，主神记录新增奖励。`;

  if (node.reward.methodBonus && getAvailableLearnedMethods(state).includes(node.reward.methodBonus.methodId)) {
    reward = {
      rewardPoints: (reward.rewardPoints ?? 0) + (node.reward.methodBonus.reward.rewardPoints ?? 0),
      lingyun: (reward.lingyun ?? 0) + (node.reward.methodBonus.reward.lingyun ?? 0),
      items: addItems(createInventory(), {
        ...(reward.items ?? {}),
        ...(node.reward.methodBonus.reward.items ?? {})
      })
    };
    line = node.reward.methodBonus.text;
  }

  return { reward, line };
}

function getRelicAdjustedRewardNodeReward(
  state: GameState,
  reward: RewardBundle
): {
  reward: RewardBundle;
  baseRewardPoints: number;
  adjustedRewardPoints: number;
  relicEffects: RunRelicEffects;
} {
  const relicEffects = getCurrentRunRelicEffects(state);
  const baseRewardPoints = reward.rewardPoints ?? 0;
  const adjustedRewardPoints = scaleByPercent(
    baseRewardPoints,
    relicEffects.rewardNodeRewardPointsBonusPercent,
    0
  );

  return {
    reward:
      adjustedRewardPoints === baseRewardPoints
        ? reward
        : { ...reward, rewardPoints: adjustedRewardPoints },
    baseRewardPoints,
    adjustedRewardPoints,
    relicEffects
  };
}

function applyRewardNodeRelicHealing(
  state: GameState,
  relicEffects: RunRelicEffects,
  statusLines: string[]
): GameState {
  if (relicEffects.rewardNodeHealing <= 0) return state;

  const hpBeforeHealing = state.player.hp;
  const nextState = normalizeHealth(state, relicEffects.rewardNodeHealing);
  statusLines.push(`缝生线令你回复 ${nextState.player.hp - hpBeforeHealing} 点生命。`);
  return nextState;
}

function applyRewardNodeRelicDraft(
  state: GameState,
  node: DungeonNode,
  statusLines: string[]
): GameState {
  if (!node.relicDraftId || !isRunRelicState(state.run?.relicState) || !state.run) return state;

  const relicState = generateRunRelicDraft(state.run.relicState, {
    draftId: node.relicDraftId,
    nodeId: node.id,
    matchingEquipmentConduit: (state.run.relicConduitSourceEquipmentIds?.length ?? 0) > 0
  });
  const nextState: GameState = {
    ...state,
    run: {
      ...state.run,
      relicState
    }
  };

  if (relicState.pendingDraft?.draftId === node.relicDraftId) {
    const candidateNames = relicState.pendingDraft.candidateIds
      .map((relicId) => RUN_RELIC_DEFINITIONS[relicId].name)
      .join('、');
    statusLines.push(`回响遗物候选显现：${candidateNames}。`);
  }

  return nextState;
}

function getFieldSurveyCostAvailability(
  state: GameState,
  option: FieldSurveyOption
): FieldSurveyCostAvailability {
  const items = (Object.entries(option.cost ?? {}) as Array<[ItemId, number | undefined]>).map(
    ([itemId, requested]) => {
      const required = Math.max(0, Math.floor(requested ?? 0));
      const availableCount = Math.max(0, state.inventory[itemId] ?? 0);
      let reason: FieldSurveyCostItemAvailability['reason'];

      if (ITEMS[itemId].kind !== 'material' && !isCurrentDungeonFeatureAvailable(state, 'consumable')) {
        reason = 'sealed';
      } else if (isTacticalItemId(itemId) && !isTacticalItemCarried(state.run?.tacticalLoadout, itemId)) {
        reason = 'not_carried';
      } else if (availableCount < required) {
        reason = 'missing';
      }

      const unavailableReason =
        reason === 'sealed'
          ? `梦档案馆已封存${ITEMS[itemId].name}`
          : reason === 'not_carried'
            ? `${ITEMS[itemId].name}未装入战术携行`
            : reason === 'missing'
              ? `${ITEMS[itemId].name}不足（需要 ${required}，现有 ${availableCount}）`
              : undefined;

      return {
        itemId,
        required,
        availableCount,
        available: reason === undefined,
        ...(reason === undefined ? {} : { reason, unavailableReason })
      };
    }
  );
  const unavailableReason = items
    .filter((item) => !item.available)
    .map((item) => item.unavailableReason)
    .filter((reason): reason is string => reason !== undefined)
    .join('；');

  return {
    available: unavailableReason.length === 0,
    items,
    ...(unavailableReason.length === 0 ? {} : { unavailableReason })
  };
}

export function getCurrentFieldSurveyStatus(state: GameState): CurrentFieldSurveyStatus {
  const node = getCurrentNode(state);
  const survey = node?.reward && node.fieldSurveyId ? getFieldSurveyById(node.fieldSurveyId) : undefined;
  if (!state.run || !node || !survey || survey.nodeId !== node.id) {
    return {
      legacyDisabled: false,
      resolved: false,
      options: [],
      unavailableReason: '当前位置没有铭刻勘探。'
    };
  }

  const surveyState = state.run.fieldSurveyState;
  const validSurveyState = isFieldSurveyRunState(surveyState) ? surveyState : undefined;
  const legacyDisabled = validSurveyState === undefined;
  const resolved = validSurveyState?.resolvedSurveys.some((entry) => entry.surveyId === survey.id) ?? false;
  const nodeCleared = state.run.clearedNodeIds.includes(node.id);
  const commonUnavailableReason = legacyDisabled
    ? '本局缺少合法的 v1 铭刻勘探快照，勘探已禁用。'
    : resolved
      ? '本次铭刻勘探已经结算。'
      : nodeCleared
        ? '该奖励节点已经通过普通领取结算。'
        : undefined;

  const options = survey.options.map((definition): CurrentFieldSurveyOptionStatus => {
    const frozenSourceEquipmentIds = validSurveyState
      ? validSurveyState.frozenSources
          .filter((source) => source.attunementId === definition.attunementId)
          .map((source) => source.equipmentId)
      : [];
    const ruleStatus = validSurveyState
      ? getFieldSurveyOptionStatus(validSurveyState, survey.id, definition.id)
      : undefined;
    const costAvailability = getFieldSurveyCostAvailability(state, definition);
    const unavailableReason = commonUnavailableReason ??
      (!ruleStatus?.frozen
        ? '入场快照未冻结该选项对应的铭刻分支。'
        : !costAvailability.available
          ? costAvailability.unavailableReason
          : undefined);

    return {
      definition,
      frozenSourceEquipmentIds,
      available: unavailableReason === undefined,
      ...(unavailableReason === undefined ? {} : { unavailableReason }),
      costAvailability
    };
  });

  return {
    survey,
    legacyDisabled,
    resolved,
    options,
    ...(commonUnavailableReason === undefined ? {} : { unavailableReason: commonUnavailableReason })
  };
}

function payFieldSurveyCost(state: GameState, option: FieldSurveyOption): GameState {
  let nextState = state;
  for (const [itemId, requested] of Object.entries(option.cost ?? {}) as Array<[ItemId, number | undefined]>) {
    const amount = Math.max(0, Math.floor(requested ?? 0));
    if (amount === 0) continue;
    nextState = recordUsedItem(consumeItem(nextState, itemId, amount), itemId);
  }
  return nextState;
}

function getFieldSurveyCostLog(option: FieldSurveyOption): string {
  const costs = (Object.entries(option.cost ?? {}) as Array<[ItemId, number | undefined]>)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([itemId, amount]) => `${ITEMS[itemId].name} x${amount}`);
  return costs.length > 0 ? `成本：${costs.join('、')}。` : '成本：无。';
}

function getFieldSurveyRewardChangeLog(base: RewardBundle, reward: RewardBundle): string {
  const itemIds = new Set<ItemId>([
    ...(Object.keys(base.items ?? {}) as ItemId[]),
    ...(Object.keys(reward.items ?? {}) as ItemId[])
  ]);
  const itemChanges = [...itemIds].flatMap((itemId) => {
    const delta = (reward.items?.[itemId] ?? 0) - (base.items?.[itemId] ?? 0);
    return delta === 0 ? [] : [`${ITEMS[itemId].name} ${delta > 0 ? '+' : ''}${delta}`];
  });
  const lingyunDelta = (reward.lingyun ?? 0) - (base.lingyun ?? 0);
  const changeLines = [
    ...(itemChanges.length > 0 ? [`物品：${itemChanges.join('、')}`] : []),
    ...(lingyunDelta === 0 ? [] : [`灵蕴 ${lingyunDelta > 0 ? '+' : ''}${lingyunDelta}`])
  ];
  return changeLines.length > 0 ? `${changeLines.join('；')}。` : '物品与灵蕴不变。';
}

export function resolveFieldSurvey(state: GameState, optionId: string): GameState {
  const node = getCurrentNode(state);
  const status = getCurrentFieldSurveyStatus(state);
  const survey = status.survey;
  if (!node?.reward || !state.run || !survey || node.fieldSurveyId !== survey.id) {
    return appendLog(state, status.unavailableReason ?? '当前位置没有可结算的铭刻勘探。');
  }

  const optionStatus = status.options.find((option) => option.definition.id === optionId);
  if (!optionStatus) return appendLog(state, '未知的铭刻勘探选项。');
  if (!optionStatus.available) {
    return appendLog(state, `${optionStatus.unavailableReason ?? '该铭刻勘探选项当前不可用'}，节点未结算。`);
  }

  const surveyState = state.run.fieldSurveyState;
  if (!isFieldSurveyRunState(surveyState)) {
    return appendLog(state, '本局铭刻勘探快照无效，节点未结算。');
  }
  const resolvedNodeReward = getResolvedNodeReward(state, node);
  if (!resolvedNodeReward) return appendLog(state, '当前位置没有可收取的奖励。');

  const relicAdjusted = getRelicAdjustedRewardNodeReward(state, resolvedNodeReward.reward);
  const surveyReward = resolveFieldSurveyReward(relicAdjusted.reward, survey.id, optionId);
  const markedSurveyState = markFieldSurveyResolved(surveyState, survey.id, optionId);
  if (!surveyReward || markedSurveyState === surveyState) {
    return appendLog(state, '铭刻勘探规则校验失败，节点未结算。');
  }

  const option = optionStatus.definition;
  let nextState = payFieldSurveyCost(state, option);
  nextState = applyRunReward(nextState, surveyReward);

  const statusLines: string[] = [];
  if (relicAdjusted.adjustedRewardPoints !== relicAdjusted.baseRewardPoints) {
    statusLines.push(
      `幸运地图使奖励点从 ${relicAdjusted.baseRewardPoints} 提升至 ${relicAdjusted.adjustedRewardPoints}。`
    );
  }
  nextState = applyRewardNodeRelicHealing(nextState, relicAdjusted.relicEffects, statusLines);

  const surveyHpDelta = getFieldSurveyHpDelta(getDerivedStats(state).maxHp, survey.id, optionId);
  let hpLine = '生命不变。';
  if (surveyHpDelta > 0) {
    const hpBefore = nextState.player.hp;
    nextState = normalizeHealth(nextState, surveyHpDelta);
    hpLine = `实际回复 ${nextState.player.hp - hpBefore} 点生命。`;
  } else if (surveyHpDelta < 0) {
    const hpBefore = nextState.player.hp;
    nextState = applyPlayerDamage(nextState, -surveyHpDelta);
    hpLine = `实际承受 ${hpBefore - nextState.player.hp} 点伤害。`;
  }

  nextState = {
    ...nextState,
    run: nextState.run
      ? {
          ...nextState.run,
          fieldSurveyState: markedSurveyState
        }
      : nextState.run
  };
  nextState = markNodeCleared(nextState, node.id);
  nextState = applyRewardNodeRelicDraft(nextState, node, statusLines);

  const summary = [
    `铭刻勘探「${option.name}」完成。`,
    `奖励点 ${relicAdjusted.adjustedRewardPoints} 按 ${option.rewardPointsPercent}% 转换为 ${surveyReward.rewardPoints ?? 0}。`,
    getFieldSurveyRewardChangeLog(relicAdjusted.reward, surveyReward),
    getFieldSurveyCostLog(option),
    hpLine,
    ...statusLines,
    '战利品尚未结算。'
  ].join(' ');

  if (nextState.player.hp <= 0) {
    return resolveRunFailure(nextState, `${summary} 主神在勘探反噬后强制回收。`);
  }
  return appendLog(nextState, summary);
}

function resolveNodeReward(
  state: GameState,
  sealedItemId?: ItemId,
  soulSkillDefinition?: EquipmentSoulSkillDefinition
): GameState {
  const node = getCurrentNode(state);
  if (!node?.reward || !state.run) return appendLog(state, '当前位置没有可收取的奖励。');
  if (state.run.clearedNodeIds.includes(node.id)) return appendLog(state, `${node.title}已经领取过奖励。`);

  if (node.id === 'truth_archive' || node.id === 'swift_judgment_armory') {
    const verdict = getCurrentVerdictStatus(state);
    const originalCorrect = verdict?.accusationCorrect === true && verdict.appealUsed === false;
    const trustedCount = verdict?.accusationTrustedCount ?? 0;
    const eligible = node.id === 'truth_archive'
      ? originalCorrect && trustedCount === 3
      : originalCorrect && trustedCount >= 1 && trustedCount <= 2;
    if (!eligible) {
      return appendLog(
        state,
        node.id === 'truth_archive'
          ? '真证封存库只认可原始正确且冻结三份可信证据的裁决。'
          : '速裁军械库只认可原始正确、未翻案且冻结一至两份可信证据的裁决。'
      );
    }
  }

  const resolvedReward = getResolvedNodeReward(state, node);
  if (!resolvedReward) return appendLog(state, '当前位置没有可收取的奖励。');
  let { reward } = resolvedReward;
  const { line } = resolvedReward;
  let rewardState = state;

  if (sealedItemId && soulSkillDefinition) {
    if ((reward.items?.[sealedItemId] ?? 0) <= 0) {
      return appendLog(state, '所选物品并非本次奖励的实际产出，无法封存。');
    }
    rewardState = consumeCurrentEquipmentSoulSkill(state, soulSkillDefinition.id, soulSkillDefinition);
    if (rewardState === state) return appendLog(state, `${soulSkillDefinition.name}没有响应。`);
  }

  const relicAdjustedReward = getRelicAdjustedRewardNodeReward(rewardState, reward);
  reward = relicAdjustedReward.reward;
  const { baseRewardPoints, adjustedRewardPoints, relicEffects } = relicAdjustedReward;

  let sealedCount = 0;
  let nextState: GameState;
  if (sealedItemId && soulSkillDefinition && rewardState.run) {
    const unsecuredItems = { ...(reward.items ?? {}) };
    const unsecuredAmount = Math.max(0, (unsecuredItems[sealedItemId] ?? 0) - 1);
    if (unsecuredAmount > 0) unsecuredItems[sealedItemId] = unsecuredAmount;
    else delete unsecuredItems[sealedItemId];

    const rewarded = applyReward(rewardState, { ...reward, items: unsecuredItems });
    const fullLootBag = addRunLoot(rewardState.run.lootBag, reward);
    const sealed = consumeRunLootItem(fullLootBag, sealedItemId, 1);
    sealedCount = sealed.consumed;
    nextState = {
      ...rewarded,
      inventory: addItems(rewarded.inventory, { [sealedItemId]: sealed.consumed }),
      run: {
        ...rewardState.run,
        lootBag: sealed.bag
      }
    };
  } else {
    nextState = applyRunReward(rewardState, reward);
  }
  const relicStatusLines: string[] = [];
  if (adjustedRewardPoints !== baseRewardPoints) {
    relicStatusLines.push(
      `幸运地图使奖励点从 ${baseRewardPoints} 提升至 ${adjustedRewardPoints}。`
    );
  }

  if (sealedItemId && soulSkillDefinition) {
    relicStatusLines.push(
      `${soulSkillDefinition.name}封存${ITEMS[sealedItemId].name} x${sealedCount}，该物品已转入永久库存。`
    );
  }

  nextState = applyRewardNodeRelicHealing(nextState, relicEffects, relicStatusLines);

  nextState = markNodeCleared(nextState, node.id);
  nextState = applyRewardNodeRelicDraft(nextState, node, relicStatusLines);

  const relicText = relicStatusLines.length > 0 ? ` ${relicStatusLines.join(' ')}` : '';
  return appendLog(nextState, `${line}${relicText} 战利品尚未结算。`);
}

function collectRewardWithSoulSeal(
  state: GameState,
  itemId: ItemId,
  definition: EquipmentSoulSkillDefinition
): GameState {
  return resolveNodeReward(state, itemId, definition);
}

export function collectReward(state: GameState): GameState {
  return resolveNodeReward(state);
}

export function resolveRunRelicDraft(state: GameState, relicId: string): GameState;
export function resolveRunRelicDraft(state: GameState, draftId: string, relicId: string): GameState;
export function resolveRunRelicDraft(
  state: GameState,
  draftIdOrRelicId: string,
  selectedRelicId?: string
): GameState {
  const relicState = state.run?.relicState;
  if (!state.run || !isRunRelicState(relicState) || !relicState.pendingDraft) return state;

  const draftId = selectedRelicId === undefined
    ? relicState.pendingDraft.draftId
    : draftIdOrRelicId;
  const relicId = selectedRelicId ?? draftIdOrRelicId;
  const nextRelicState = selectRunRelic(relicState, draftId, relicId);
  if (nextRelicState === relicState || !isRunRelicId(relicId)) return state;

  return appendLog(
    {
      ...state,
      run: {
        ...state.run,
        relicState: nextRelicState
      }
    },
    `你选择了回响遗物「${RUN_RELIC_DEFINITIONS[relicId].name}」，效果立即生效。`
  );
}

export function claimTaskReward(state: GameState, taskId: string): GameState {
  const claimedTaskIds = state.claimedTaskIds ?? [];
  const normalizedState = {
    ...state,
    claimedTaskIds
  };
  const task = getTaskById(taskId);

  if (!task) return appendLog(normalizedState, '未知主神任务，无法领取奖励。');

  const evaluation = evaluateTask(normalizedState, task.id);
  if (evaluation?.claimed) return appendLog(normalizedState, `主神任务「${task.title}」奖励已经领取。`);
  if (!evaluation?.completed) {
    return appendLog(normalizedState, `主神任务「${task.title}」尚未完成：${evaluation?.progressText ?? '无进度'}。`);
  }

  return appendLog(
    applyReward(
      {
        ...normalizedState,
        claimedTaskIds: [...claimedTaskIds, task.id]
      },
      task.reward
    ),
    `主神任务「${task.title}」完成，奖励已发放。`
  );
}

function calculatePhysicalDamage(attack: number, defense: number): number {
  return Math.max(3, attack - Math.floor(defense * 0.6));
}

function getCloudStepSkirmishBonus(stats: DerivedStats, monster: MonsterDefinition, learnedMethods: readonly MethodId[]): number {
  // 云隙步是游斗功法：只有速度真正压过目标时，才把身法差转成物理压迫。
  if (!learnedMethods.includes('cloud_step')) return 0;

  const speedGap = stats.speed - monster.speed;
  return speedGap > 0 ? Math.max(1, Math.floor(speedGap / 2)) : 0;
}

function calculateArtDamage(artPower: number, defense: number): number {
  return Math.max(5, artPower + 8 - Math.floor(defense * 0.3));
}

function applyEncounterEquipmentLoot(
  state: GameState,
  monster: MonsterDefinition,
  nodeId: string
): { state: GameState; statusLine?: string } {
  if (!state.run) return { state };
  if (state.run.entryFlowVersion === 2) return { state };

  const equipmentHunt = isEquipmentHuntRunState(state.run.equipmentHunt)
    ? state.run.equipmentHunt
    : undefined;
  const huntProgress = equipmentHunt
    ? getEquipmentHuntProgress(
        equipmentHunt,
        state.run.dungeonId,
        state.run.clearedNodeIds,
        state.run.lootOffersMade
      )
    : undefined;
  const guaranteedEquipmentId = huntProgress?.qualified
    ? equipmentHunt?.targetEquipmentId
    : undefined;

  const offer = getDungeonLootOffer({
    dungeonId: state.run.dungeonId,
    monsterId: monster.id,
    nodeId,
    ownedEquipmentIds: state.ownedEquipment,
    carriedEquipmentIds: state.run.lootBag.equipmentIds,
    offersMade: state.run.lootOffersMade,
    ...(guaranteedEquipmentId === undefined ? {} : { guaranteedEquipmentId })
  });
  if (!offer) return { state };

  const run = {
    ...state.run,
    lootOffersMade: state.run.lootOffersMade + 1
  };
  if ('salvageRewardPoints' in offer) {
    const salvaged = applyRunReward({ ...state, run }, { rewardPoints: offer.salvageRewardPoints });
    return {
      state: salvaged,
      statusLine: `装备池已收集完毕，精英残骸拆解为 ${offer.salvageRewardPoints} 点未结算奖励。`
    };
  }

  return {
    state: {
      ...state,
      run: {
        ...run,
        pendingEquipmentOffer: offer
      }
    },
    statusLine: '精英战利品已显现，必须选取一件装备或放弃后才能继续。'
  };
}

function applyBossVictoryReward(state: GameState, nodeId: string): { state: GameState; statusLine?: string } {
  if (!state.run) return { state };

  const definition = getBossDefinitionForNode(state.run.dungeonId, nodeId);
  if (!definition) return { state };

  const rewarded = applyRunReward(state, definition.bonusReward);
  const rewardPoints = definition.bonusReward.rewardPoints ?? 0;
  return {
    state: rewarded,
    statusLine: `「${definition.sealName}」解除，首领追加 ${rewardPoints} 点奖励进入战利品袋。`
  };
}

export function resolveEquipmentLoot(state: GameState, equipmentId?: EquipmentId): GameState {
  const offer = state.run?.pendingEquipmentOffer;
  if (!state.run || !offer) return appendLog(state, '当前没有待处理的精英装备。');

  if (equipmentId === undefined) {
    return appendLog(
      {
        ...state,
        run: {
          ...state.run,
          pendingEquipmentOffer: undefined
        }
      },
      offer.guaranteedEquipmentId === undefined
        ? '你放弃了这次精英装备选择，路线重新开放。'
        : `你放弃了追猎目标${EQUIPMENT[offer.guaranteedEquipmentId].name}，路线重新开放。`
    );
  }
  if (!offer.equipmentIds.includes(equipmentId)) return appendLog(state, '这件装备不在当前精英战利品中。');

  const selectionLog =
    offer.guaranteedEquipmentId === undefined
      ? `你选择了${EQUIPMENT[equipmentId].name}，通关后才能带回主神空间。`
      : equipmentId === offer.guaranteedEquipmentId
        ? `追猎目标${EQUIPMENT[equipmentId].name}已装入战利品袋，通关后才能带回主神空间。`
        : `你放弃追猎目标，改选${EQUIPMENT[equipmentId].name}；通关后才能带回主神空间。`;

  return appendLog(
    {
      ...state,
      run: {
        ...state.run,
        lootBag: addRunLoot(state.run.lootBag, { equipmentIds: [equipmentId] }),
        pendingEquipmentOffer: undefined
      }
    },
    selectionLog
  );
}

function signalCurrentCombatOpening(
  state: GameState,
  action: CombatAction,
  damageKind: CombatDamageKind
): GameState {
  if (!state.run || !state.combat) return state;

  const openingAction: CombatAction | undefined =
    action === 'weapon_skill'
      ? damageKind === 'art'
        ? 'art'
        : 'attack'
      : action === 'attack' || action === 'art' || action === 'guard'
        ? action
        : undefined;
  if (!openingAction) return state;

  const lawState = getNormalizedDungeonLawState(state);
  if (!lawState) return state;
  const isBoss = Boolean(getBossDefinitionForNode(state.run.dungeonId, state.combat.nodeId));

  return withDungeonLawState(
    state,
    signalCombatStarted(lawState, {
      nodeId: state.combat.nodeId,
      isBoss,
      openingAction
    })
  );
}

function signalCurrentCombatVictory(state: GameState): GameState {
  if (!state.run || !state.combat) return state;
  if (getBossDefinitionForNode(state.run.dungeonId, state.combat.nodeId)) return state;

  const lawState = getNormalizedDungeonLawState(state);
  return lawState
    ? withDungeonLawState(
        state,
        signalCombatVictory(lawState, {
          nodeId: state.combat.nodeId,
          isBoss: false
        })
      )
    : state;
}

function getCurrentCombatDamageTaken(state: GameState): number {
  const snapshot = state.combat?.damageTakenAtStart;
  if (!state.run || typeof snapshot !== 'number' || !Number.isFinite(snapshot)) return 0;
  return Math.max(0, state.run.damageTaken - snapshot);
}

function getAdjustedCombatRewardPoints(state: GameState, baseRewardPoints: number): number {
  return scaleByPercent(
    baseRewardPoints,
    getCurrentRunRelicEffects(state).combatRewardPointsBonusPercent,
    0
  );
}

function finishCombatVictory(state: GameState, monster: MonsterDefinition): GameState {
  const signaled = signalCurrentCombatVictory(state);
  const combatDamageTaken = getCurrentCombatDamageTaken(signaled);
  const combatRewardPoints = getAdjustedCombatRewardPoints(signaled, monster.rewardPoints);
  const rewarded = applyRunReward(signaled, {
    rewardPoints: combatRewardPoints,
    items: monster.drop
  });
  const nodeId = state.combat?.nodeId ?? '';
  const bossReward = applyBossVictoryReward(rewarded, nodeId);
  const encounterLoot = applyEncounterEquipmentLoot(bossReward.state, monster, nodeId);
  const statusLines = [bossReward.statusLine, encounterLoot.statusLine].filter(Boolean).join(' ');

  return appendLog(
    markNodeCleared(
      {
        ...encounterLoot.state,
        phase: 'explore',
        combat: undefined
      },
      nodeId,
      combatDamageTaken
    ),
    `${monster.name}倒下，${combatRewardPoints} 点奖励进入战利品袋。${statusLines ? ` ${statusLines}` : ''}`
  );
}

function getExitReward(state: GameState): RewardBundle {
  if (!state.run) return {};

  const exitNode = DUNGEONS[state.run.dungeonId].nodes.find((node) => node.type === 'exit');
  return exitNode?.reward ?? {};
}

type DungeonRunPursuitSettlementResult = {
  readonly run: DungeonRun;
  readonly settlement?: RunPursuitSettlement;
  readonly materialReward?: { readonly itemId: RunPursuitMaterialId; readonly amount: 1 };
};

function settleDungeonRunPursuit(
  run: DungeonRun,
  reason: 'successful_exit' | 'retreat' | 'failure'
): DungeonRunPursuitSettlementResult {
  const pursuitState = getStrictRunPursuitState(run);
  if (!pursuitState) return { run };

  const previousSettlement = getNormalizedRunPursuitSettlement(run.lastPursuitSettlement);
  const settledCurrent = settleRunPursuit(pursuitState, reason);
  const pendingContainedSettlement =
    pursuitState.status === 'disabled' &&
    previousSettlement?.state.status === 'contained' &&
    (previousSettlement.reason === 'stable_portal' || previousSettlement.reason === 'forced_portal') &&
    !previousSettlement.rewarded
      ? previousSettlement
      : undefined;
  const shouldReward =
    reason === 'successful_exit' &&
    (pursuitState.status === 'contained' || pendingContainedSettlement !== undefined);
  const preservedOriginSettlement =
    pursuitState.status === 'disabled' && previousSettlement
      ? previousSettlement
      : undefined;
  const settlementState = preservedOriginSettlement?.state ?? settledCurrent;
  const alreadyRewarded =
    reason === 'successful_exit' && preservedOriginSettlement?.rewarded === true;
  const settlement = createPursuitSettlement(
    settlementState,
    reason,
    shouldReward || alreadyRewarded
  );

  return {
    run: {
      ...run,
      pursuitState: settledCurrent,
      lastPursuitSettlement: settlement
    },
    settlement,
    ...(shouldReward
      ? { materialReward: { itemId: settlement.materialId, amount: 1 as const } }
      : {})
  };
}

function getPursuitOutcomeFields(settlement: RunPursuitSettlement | undefined): string {
  if (!settlement) return '';
  return `; pursuit=${settlement.state.status}; pursuitDungeon=${settlement.state.dungeonId}; pursuitReason=${settlement.reason}; pursuitMaterial=${settlement.materialId}; pursuitRewarded=${settlement.rewarded ? 1 : 0}`;
}

function getPursuitSettlementLog(settlement: RunPursuitSettlement | undefined): string | undefined {
  if (!settlement) return undefined;
  const definition = getRunPursuitDefinition(settlement.state.dungeonId);
  const name = definition?.name ?? settlement.state.dungeonId;
  const materialName = ITEMS[settlement.materialId].name;
  if (settlement.rewarded) {
    return `破界追兵结算：成功撤离，${name}对应的${materialName} x1 已带回永久背包。`;
  }
  if (
    settlement.state.status === 'contained' &&
    (settlement.reason === 'retreat' || settlement.reason === 'failure')
  ) {
    return `破界追兵结算：${name}虽已收容，但未能成功撤离，${materialName} x1 未带回，材料奖励为 0。`;
  }
  return `破界追兵结算：${name}以 ${settlement.state.status}/${settlement.reason} 收束，材料奖励为 0。`;
}

function createRunRelicSettlement(
  run: DungeonRun,
  status: RunRelicSettlement['status'],
  archivedRelicId?: RunRelicId
): RunRelicSettlement {
  const relicState = isRunRelicState(run.relicState) ? run.relicState : undefined;
  return {
    status,
    ...(relicState === undefined ? {} : { frame: relicState.frame }),
    acquiredIds: [...(relicState?.acquiredIds ?? [])],
    ...(archivedRelicId === undefined ? {} : { archivedRelicId })
  };
}

function subtractItems(
  inventory: Record<ItemId, number>,
  items: Readonly<Partial<Record<ItemId, number>>>
): Record<ItemId, number> {
  const next = { ...inventory };
  for (const [itemId, amount] of Object.entries(items) as Array<[ItemId, number]>) {
    next[itemId] = Math.max(0, next[itemId] - amount);
  }
  return next;
}

function settleRunLootState(state: GameState, exitStatus: RunExitStatus): GameState {
  if (!state.run) return state;

  const settlement = settleRunLoot(state.run.lootBag, exitStatus);
  const acquiredEquipmentIds = settlement.retained.equipmentIds.filter(
    (equipmentId) => !state.ownedEquipment.includes(equipmentId)
  );
  const equipmentLevels = { ...state.equipmentLevels };
  for (const equipmentId of acquiredEquipmentIds) equipmentLevels[equipmentId] = 1;
  const lostDurableItems = { ...settlement.lost.items };
  delete lostDurableItems.legacy_scrip;
  const retainedLegacyScrip = settlement.retained.items.legacy_scrip ?? 0;
  const settledInventory = addItems(
    subtractItems(state.inventory, lostDurableItems),
    retainedLegacyScrip > 0 ? { legacy_scrip: retainedLegacyScrip } : undefined
  );

  return {
    ...state,
    rewardPoints: Math.max(0, state.rewardPoints - settlement.lost.rewardPoints),
    lingyun: Math.max(0, state.lingyun - settlement.lost.lingyun),
    inventory: settledInventory,
    ownedEquipment: [...state.ownedEquipment, ...acquiredEquipmentIds],
    equipmentLevels,
    run: {
      ...state.run,
      lootBag: createEmptyRunLootBag<ItemId, EquipmentId>(),
      pendingEquipmentOffer: undefined,
      lastLootSettlement: settlement
    }
  };
}

function resolveRunEconomySettlement(state: GameState, exitStatus: RunExitStatus, reason: string): GameState {
  if (state.phase === 'result' && state.lastOutcome) return appendLog(state, '本轮副本已经结算，主神不会重复发放恢复奖励。');
  if (!state.run) return appendLog(state, '当前没有可结算的副本进度。');

  const routeContractResult = settleDungeonRunRouteContract(
    state.run,
    exitStatus === 'retreated' ? 'retreat' : 'failure'
  );
  const routeContractSettlement = routeContractResult.settlement;
  const pursuitResult = settleDungeonRunPursuit(
    routeContractResult.run,
    exitStatus === 'retreated' ? 'retreat' : 'failure'
  );
  const dungeon = DUNGEONS[state.run.dungeonId];
  const exitReward = getExitReward(state);
  const economy = calculateRunEconomy({
    baseRewardPoints: exitReward.rewardPoints ?? 0,
    clearedNodes: state.run.clearedNodeIds.length,
    totalNodes: dungeon.nodes.length,
    damageTaken: state.run.damageTaken,
    captures: state.run.captures,
    readiness: getDungeonReadiness(state, state.run.dungeonId),
    dungeonTier: dungeon.tier,
    exitStatus
  });
  const protocolId = getRunProtocolId(state.run);
  const simplifiedRun = state.run.entryFlowVersion === 2;
  const currentProtocol = getCurrentRunProtocol(state);
  const protocolInterrupted = protocolId !== 'standard';
  const protocolAnchorOutcome = currentProtocol
    ? `; anchors=${currentProtocol.completedAnchorCount}/${currentProtocol.requiredAnchorCount}`
    : '';
  const protocolOutcome = protocolInterrupted
    ? `; protocol=${protocolId}:failed${protocolAnchorOutcome}; protocolBonus=0; cycleImprint=0${protocolId === 'deep' ? '; material=none' : ''}`
    : '';
  const routeContractOutcome = routeContractSettlement?.state
    ? `; routeContract=${routeContractSettlement.state.contractId}:${routeContractSettlement.state.status}; routeContractReason=${routeContractSettlement.state.reason ?? 'none'}; routeContractBonus=0`
    : '';
  const pursuitOutcome = getPursuitOutcomeFields(pursuitResult.settlement);
  const outcomeText = `${reason}outcome=${economy.outcome}; score=${economy.score}; multiplier=${economy.rewardMultiplier}x; reward=${economy.rewardPoints}${protocolOutcome}${routeContractOutcome}${pursuitOutcome}`;
  const relicSettledState: GameState = {
    ...state,
    run: {
      ...pursuitResult.run,
      lastRelicSettlement: createRunRelicSettlement(pursuitResult.run, 'lost')
    }
  };
  const lootSettledState = settleRunLootState(relicSettledState, exitStatus);
  const lootSettlement = lootSettledState.run?.lastLootSettlement;
  const lootStatus = lootSettlement
    ? `战利品袋保留 ${lootSettlement.retained.rewardPoints} 点，遗失 ${lootSettlement.lost.rewardPoints} 点。`
    : '';
  const protocolFailureStatus = simplifiedRun
    ? protocolId === 'standard'
      ? ''
      : ` ${protocolId === 'imprint' ? '困难' : '炼狱'}挑战中止，不发放难度加成或通关材料。`
    : protocolId === 'imprint'
      ? ' 轮回协议中止，不产出轮回刻印。'
      : protocolId === 'deep'
        ? ` 深层轮回协议失败：双锚点 ${currentProtocol?.completedAnchorCount ?? 0}/${currentProtocol?.requiredAnchorCount ?? 2}，不发放协议奖励或材料，已消耗的轮回刻印不返还。`
        : '';
  const routeContractStatus = routeContractSettlement?.state
    ? ` ${simplifiedRun ? '隐藏任务' : '路线契约'}以 ${routeContractSettlement.state.status}/${routeContractSettlement.state.reason ?? 'none'} 独立结算，奖励为 0。`
    : '';

  // Retreat and failure payouts are recovery settlements only: no exit reward items, no directives, no campaign completion.
  const recoveredState = applyReward(
    {
      ...lootSettledState,
      phase: 'result',
      combat: undefined,
      lastOutcome: outcomeText
    },
    { rewardPoints: economy.rewardPoints }
  );
  const equipmentMemoryResult = settleGameStateEquipmentMemoryHunt(
    recoveredState,
    exitStatus === 'retreated' ? 'retreat' : 'failure'
  );
  const loggedState = appendLog(
    equipmentMemoryResult.state,
    `${reason}主神按本轮表现回收结算：${economy.outcome}，倍率 ${economy.rewardMultiplier}x。${protocolFailureStatus}${routeContractStatus}${lootStatus ? ` ${lootStatus}` : ''}`
  );
  const memoryLoggedState = equipmentMemoryResult.settlementLog
    ? appendLog(loggedState, equipmentMemoryResult.settlementLog)
    : loggedState;
  const pursuitLog = getPursuitSettlementLog(pursuitResult.settlement);
  return pursuitLog ? appendSecondaryLog(memoryLoggedState, pursuitLog) : memoryLoggedState;
}

function getCombatEffectAction(action: CombatAction, damageKind: CombatDamageKind): CombatEffectAction | undefined {
  if (action === 'weapon_skill') return damageKind === 'art' ? 'art' : 'attack';
  if (
    action === 'attack' ||
    action === 'art' ||
    action === 'guard' ||
    action === 'use_healing_pill' ||
    action === 'use_thunder_talisman'
  )
    return action;

  return undefined;
}

function resolveMonsterEffects(
  state: GameState,
  monster: MonsterDefinition,
  combat: CombatState,
  incomingDamage: number,
  damageKind: CombatDamageKind,
  action: CombatAction
): {
  damageToMonster: number;
  damageToPlayer: number;
  nextCombat: CombatState;
  statusLines: string[];
} {
  const activePet = getAvailableActivePet(state);
  const combatEquipped: Partial<Record<EquipmentSlot, EquipmentId>> = { ...state.equipped };
  if (state.run) {
    const frozenVerdictGear = getRunFalseTestimonyEntryGear(state.run);
    const verdictSlots = [
      ['weapon', 'cross_examiner_sabre', frozenVerdictGear.crossExaminerSabre],
      ['head', 'forensic_visor', frozenVerdictGear.forensicVisor],
      ['armor', 'custody_shell', frozenVerdictGear.custodyShell],
      ['charm', 'appeal_seal', frozenVerdictGear.appealSeal]
    ] as const;
    for (const [slot, equipmentId, enabled] of verdictSlots) {
      if (enabled) combatEquipped[slot] = equipmentId;
      else if (combatEquipped[slot] === equipmentId) delete combatEquipped[slot];
    }
  }

  const result = applyMonsterCombatEffects({
    monsterId: monster.id,
    turn: combat.turn,
    incomingDamage,
    monsterHp: combat.monsterHp,
    monsterMaxHp: monster.maxHp,
    damageKind,
    player: {
      stats: getDerivedStats(state),
      equipped: combatEquipped,
      learnedMethods: getAvailableLearnedMethods(state),
      activePet,
      action: getCombatEffectAction(action, damageKind)
    },
    state: combat.effects
  });

  return {
    damageToMonster: result.damageToMonster,
    damageToPlayer: result.damageToPlayer,
    nextCombat: {
      ...combat,
      effects: result.nextState
    },
    statusLines: result.statusLines
  };
}

export function capturePet(state: GameState, petId: PetId): GameState {
  if (state.phase !== 'combat' || !state.combat) return appendLog(state, '当前没有可捕获目标。');
  if (state.ownedPets.includes(petId)) return appendLog(state, `你已经拥有${PETS[petId].name}。`);

  const pet = PETS[petId];
  const monster = getCombatEncounterProfile(state)?.monster ?? MONSTERS[state.combat.monsterId];
  const captureItem = pet.captureItem ?? 'capture_net';

  if (pet.source !== 'capture' || pet.captureFrom !== monster.id) {
    return appendLog(state, `${pet.name}无法从当前怪物身上捕获。`);
  }

  if (isTacticalItemId(captureItem)) {
    const availability = getTacticalItemAvailability(state, captureItem);
    if (!availability.available) {
      if (availability.reason === 'sealed') {
        return appendLog(state, '梦档案馆已封存消耗品，当前无法使用捕获道具。');
      }
      if (availability.reason === 'not_carried') {
        return appendLog(state, `${ITEMS[captureItem].name}未装入战术携行，无法捕获${pet.name}。`);
      }
      return appendLog(state, `缺少${ITEMS[captureItem].name}，无法捕获${pet.name}。`);
    }
  } else {
    if (!isDungeonConsumableAvailable(state, captureItem)) {
      return appendLog(state, '梦档案馆已封存消耗品，当前无法使用捕获道具。');
    }
    if (state.inventory[captureItem] <= 0) {
      return appendLog(state, `缺少${ITEMS[captureItem].name}，无法捕获${pet.name}。`);
    }
  }

  const captureEffect = getCaptureCombatEffect({
    context: getCombatMechanicsContext(state),
    monsterMaxHp: monster.maxHp,
    baseFailureDamage: Math.max(4, Math.floor(monster.attack * 0.5)),
    itemId: captureItem
  });

  if (state.combat.monsterHp > captureEffect.weakThreshold) {
    return appendLog(state, `${monster.name}还没有虚弱，捕获失败。`);
  }

  const nodeId = state.combat.nodeId;
  const combatDamageTaken = getCurrentCombatDamageTaken(state);
  const captureRewardPoints = getAdjustedCombatRewardPoints(
    state,
    Math.floor(monster.rewardPoints * 0.35)
  );
  const victorySignaled = signalCurrentCombatVictory(state);
  const consumedCaptureItem = consumeItem(victorySignaled, captureItem);
  const captured = applyRunReward(
    recordUsedItem(
      {
        ...consumedCaptureItem,
        phase: 'explore',
        combat: undefined,
        run: consumedCaptureItem.run
          ? {
              ...consumedCaptureItem.run,
              captures: consumedCaptureItem.run.captures + 1,
              capturedPetIds: [...consumedCaptureItem.run.capturedPetIds, petId]
            }
          : consumedCaptureItem.run,
        ownedPets: [...state.ownedPets, petId],
        petLevels: {
          ...state.petLevels,
          [petId]: 1
        },
        activePet: petId
      },
      captureItem
    ),
    { rewardPoints: captureRewardPoints }
  );
  const bossReward = applyBossVictoryReward(captured, nodeId);
  const encounterLoot = applyEncounterEquipmentLoot(bossReward.state, monster, nodeId);
  const statusLines = [bossReward.statusLine, encounterLoot.statusLine].filter(Boolean).join(' ');

  return appendLog(
    normalizeHealth(markNodeCleared(encounterLoot.state, nodeId, combatDamageTaken)),
    `${captureEffect.statusLines.join('')}${ITEMS[captureItem].name}收束灵光，${pet.name}被捕获并进入出战位，${captureRewardPoints} 点奖励进入战利品袋。${statusLines ? ` ${statusLines}` : ''}`
  );
}

export type MethodTechniqueUnavailableReason =
  | 'not_in_combat'
  | 'legacy_disabled'
  | 'no_learned_method'
  | 'not_in_run'
  | 'sealed'
  | 'already_used'
  | 'requires_pet'
  | 'no_benefit';

export type CurrentMethodTechniqueStatus = {
  readonly legacyDisabled: boolean;
  readonly available: boolean;
  readonly snapshot?: MethodRunSnapshot;
  readonly definition?: MethodTechniqueDefinition;
  readonly effect?: MethodTechniqueEffect;
  readonly reason?: MethodTechniqueUnavailableReason;
  readonly unavailableReason?: string;
};

export function getCurrentRunMethodSnapshots(state: Pick<GameState, 'run'>): readonly MethodRunSnapshot[] {
  if (!state.run) return [];
  const snapshots = normalizeMethodRunSnapshots(state.run.methodSnapshots);
  if (snapshots !== undefined) return snapshots;
  const legacySnapshot = normalizeMethodRunSnapshot(state.run.methodSnapshot);
  return legacySnapshot ? [legacySnapshot] : [];
}

function getMethodTechniqueBreathCap(state: GameState): number {
  const learnedMethods = state.run
    ? getCurrentRunMethodSnapshots(state).map(({ methodId }) => methodId)
    : getAvailableLearnedMethods(state);
  if (learnedMethods.includes('star_core_method')) return 3;
  if (learnedMethods.includes('mist_breathing')) return 2;
  return 0;
}

function getBoundedCombatStack(value: unknown, cap: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(cap, Math.floor(value as number)))
    : 0;
}

export function getCurrentMethodTechniqueStatus(
  state: GameState,
  methodId?: MethodId
): CurrentMethodTechniqueStatus {
  if (!state.run) {
    return {
      legacyDisabled: false,
      available: false,
      reason: 'not_in_combat',
      unavailableReason: '当前不在副本战斗中。'
    };
  }

  const currentSnapshots = normalizeMethodRunSnapshots(state.run.methodSnapshots);
  const legacySnapshot = normalizeMethodRunSnapshot(state.run.methodSnapshot);
  const snapshots = currentSnapshots ?? (legacySnapshot ? [legacySnapshot] : []);
  if (currentSnapshots === undefined && !legacySnapshot) {
    return {
      legacyDisabled: true,
      available: false,
      reason: 'legacy_disabled',
      unavailableReason: '这个旧副本没有有效的功法快照，功法技保持禁用。返回主神空间后重新进入即可刷新。'
    };
  }

  if (snapshots.length === 0) {
    return {
      legacyDisabled: false,
      available: false,
      reason: 'no_learned_method',
      unavailableReason: '入场时尚未学会功法，本局没有可用战技。'
    };
  }

  const legacyDefaultMethodId = legacySnapshot && snapshots.some(
    (candidate) => candidate.methodId === legacySnapshot.methodId
  )
    ? legacySnapshot.methodId
    : undefined;
  const defaultMethodId = legacyDefaultMethodId ?? state.activeMethod ?? snapshots[0].methodId;
  const snapshot = snapshots.find((candidate) => candidate.methodId === (methodId ?? defaultMethodId));
  if (!snapshot) {
    return {
      legacyDisabled: false,
      available: false,
      reason: 'not_in_run',
      unavailableReason: '这门功法不在本局入场功法库中。'
    };
  }

  const definition = getMethodTechniqueDefinition(snapshot.methodId);
  const effect = getMethodTechniqueEffect(snapshot);
  const base = { legacyDisabled: false, snapshot, definition, effect };
  if (!definition || !effect) {
    return {
      ...base,
      available: false,
      reason: 'legacy_disabled',
      unavailableReason: '本轮功法快照无法解析，功法技保持禁用。'
    };
  }
  if (state.phase !== 'combat' || !state.combat) {
    return {
      ...base,
      available: false,
      reason: 'not_in_combat',
      unavailableReason: '功法技只能在战斗中使用。'
    };
  }
  if (!isCurrentDungeonFeatureAvailable(state, 'method')) {
    return {
      ...base,
      available: false,
      reason: 'sealed',
      unavailableReason: '梦档案馆已封存功法，本场暂时无法发动功法技。'
    };
  }
  const usedMethodIds = Array.isArray(state.combat.methodTechniqueUsedIds)
    ? state.combat.methodTechniqueUsedIds
    : undefined;
  if (
    usedMethodIds
      ? usedMethodIds.includes(snapshot.methodId)
      : state.combat.methodTechniqueUsed === true
  ) {
    return {
      ...base,
      available: false,
      reason: 'already_used',
      unavailableReason: '这门功法的战技本场已经使用。'
    };
  }
  if (definition.requiresActivePet && !getAvailableActivePet(state)) {
    return {
      ...base,
      available: false,
      reason: 'requires_pet',
      unavailableReason: '护主需要当前有出战灵宠。'
    };
  }

  const effects = state.combat.effects;
  const focus = normalizeCombatFocus(state.combat.weaponFocus);
  const breathCap = getMethodTechniqueBreathCap(state);
  const breath = getBoundedCombatStack(effects?.breathStacks, breathCap);
  const hasBenefit =
    (effect.guarding && !state.combat.guarding) ||
    (effect.clearsRustPoison && getBoundedCombatStack(effects?.rustPoisonStacks, 3) > 0) ||
    (effect.clearsMirrorSlow && getBoundedCombatStack(effects?.mirrorSlowStacks, 2) > 0) ||
    (effect.focusGain > 0 && focus < COMBAT_FOCUS_MAX) ||
    (effect.breathGain > 0 && breath < breathCap) ||
    (effect.healPercent > 0 && state.player.hp < state.player.maxHp);
  if (!hasBenefit) {
    return {
      ...base,
      available: false,
      reason: 'no_benefit',
      unavailableReason: '当前状态无法从这次功法技中获得收益。'
    };
  }

  return { ...base, available: true };
}

export function useMethodTechnique(state: GameState, methodId?: MethodId): GameState {
  const status = getCurrentMethodTechniqueStatus(state, methodId);
  if (!status.available || !status.snapshot || !status.definition || !status.effect || !state.combat) {
    return state;
  }

  const effect = status.effect;
  const focusBefore = normalizeCombatFocus(state.combat.weaponFocus);
  const focusAfter = effect.focusGain > 0
    ? normalizeCombatFocus(focusBefore + effect.focusGain)
    : state.combat.weaponFocus;
  const breathCap = getMethodTechniqueBreathCap(state);
  const breathBefore = getBoundedCombatStack(state.combat.effects?.breathStacks, breathCap);
  const breathAfter = effect.breathGain > 0
    ? Math.min(breathCap, breathBefore + effect.breathGain)
    : state.combat.effects?.breathStacks;
  const requestedHealing = Math.ceil((state.player.maxHp * effect.healPercent) / 100);
  const hpAfter = effect.healPercent > 0
    ? clampHp(state.player.hp + requestedHealing, state.player.maxHp)
    : state.player.hp;
  const actualHealing = hpAfter - state.player.hp;
  const nextEffects: CombatEffectState = { ...(state.combat.effects ?? {}) };
  if (effect.clearsRustPoison) nextEffects.rustPoisonStacks = 0;
  if (effect.clearsMirrorSlow) nextEffects.mirrorSlowStacks = 0;
  if (effect.breathGain > 0) nextEffects.breathStacks = breathAfter;

  const effectParts = [
    ...(effect.guarding && !state.combat.guarding ? ['进入守势'] : []),
    ...(effect.clearsRustPoison && (state.combat.effects?.rustPoisonStacks ?? 0) > 0 ? ['清除锈疫'] : []),
    ...(effect.clearsMirrorSlow && (state.combat.effects?.mirrorSlowStacks ?? 0) > 0 ? ['清除镜缓'] : []),
    ...(typeof focusAfter === 'number' && focusAfter > focusBefore ? [`战意 +${focusAfter - focusBefore}`] : []),
    ...(typeof breathAfter === 'number' && breathAfter > breathBefore ? [`蓄息 +${breathAfter - breathBefore}`] : []),
    ...(actualHealing > 0 ? [`生命回复 ${actualHealing} 点`] : [])
  ];
  const line = `${METHODS[status.snapshot.methodId].name}发动「${status.definition.name}」：${effectParts.join('，')}。`;
  const usedMethodIds = Array.isArray(state.combat.methodTechniqueUsedIds)
    ? state.combat.methodTechniqueUsedIds
    : [];

  return appendLog(
    {
      ...state,
      player: actualHealing > 0 ? { ...state.player, hp: hpAfter } : state.player,
      combat: {
        ...state.combat,
        guarding: state.combat.guarding || effect.guarding,
        ...(effect.focusGain > 0 ? { weaponFocus: focusAfter } : {}),
        methodTechniqueUsedIds: usedMethodIds.includes(status.snapshot.methodId)
          ? usedMethodIds
          : [...usedMethodIds, status.snapshot.methodId],
        methodTechniqueUsed: true,
        effects: nextEffects,
        log: [line, ...state.combat.log].slice(0, 8)
      }
    },
    line
  );
}

export type CompanionAssistUnavailableReason =
  | 'not_in_combat'
  | 'legacy_disabled'
  | 'already_used'
  | 'no_benefit';

export type CurrentCompanionAssistStatus = {
  readonly legacyDisabled: boolean;
  readonly available: boolean;
  readonly snapshot?: CompanionRunSnapshot;
  readonly definition?: CompanionDefinition;
  readonly effect: CompanionAssistEffect;
  readonly reason?: CompanionAssistUnavailableReason;
  readonly unavailableReason?: string;
};

const NO_COMPANION_ASSIST_EFFECT: CompanionAssistEffect = {
  guarding: false,
  focusGain: 0,
  healPercent: 0
};

export function getCurrentCompanionAssistStatus(state: GameState): CurrentCompanionAssistStatus {
  if (!state.run) {
    return {
      legacyDisabled: false,
      available: false,
      effect: NO_COMPANION_ASSIST_EFFECT,
      reason: 'not_in_combat',
      unavailableReason: '当前不在副本战斗中。'
    };
  }

  const snapshot = normalizeCompanionRunSnapshot(state.run.companionSnapshot);
  if (!snapshot) {
    return {
      legacyDisabled: true,
      available: false,
      effect: NO_COMPANION_ASSIST_EFFECT,
      reason: 'legacy_disabled',
      unavailableReason: '本轮副本没有冻结队友快照，援护保持禁用。'
    };
  }

  const definition = getCompanionDefinition(snapshot.companionId);
  const effect = getCompanionAssistEffect(snapshot);
  const base = {
    legacyDisabled: false,
    snapshot,
    definition,
    effect
  };

  if (state.phase !== 'combat' || !state.combat) {
    return {
      ...base,
      available: false,
      reason: 'not_in_combat' as const,
      unavailableReason: '队友援护只能在战斗中使用。'
    };
  }
  if (state.combat.companionAssistUsed) {
    return {
      ...base,
      available: false,
      reason: 'already_used' as const,
      unavailableReason: '本场战斗的队友援护已经使用。'
    };
  }

  const currentFocus = normalizeCombatFocus(state.combat.weaponFocus);
  const hasBenefit =
    effect.guarding ||
    (effect.focusGain > 0 && currentFocus < COMBAT_FOCUS_MAX) ||
    (effect.healPercent > 0 && state.player.hp < state.player.maxHp);
  if (!hasBenefit) {
    return {
      ...base,
      available: false,
      reason: 'no_benefit' as const,
      unavailableReason: '当前生命与战意状态无法从这次援护中获得收益。'
    };
  }

  return {
    ...base,
    available: true
  };
}

export function useCompanionAssist(state: GameState): GameState {
  const status = getCurrentCompanionAssistStatus(state);
  if (!status.available || !status.snapshot || !status.definition || !state.combat) return state;

  const focusBefore = normalizeCombatFocus(state.combat.weaponFocus);
  const focusAfter = normalizeCombatFocus(focusBefore + status.effect.focusGain);
  const requestedHealing = Math.ceil((state.player.maxHp * status.effect.healPercent) / 100);
  const hpAfter = clampHp(state.player.hp + requestedHealing, state.player.maxHp);
  const actualHealing = hpAfter - state.player.hp;
  const effectParts = [
    ...(status.effect.guarding ? ['进入守势'] : []),
    ...(focusAfter > focusBefore ? [`战意 +${focusAfter - focusBefore}`] : []),
    ...(actualHealing > 0 ? [`生命回复 ${actualHealing} 点`] : [])
  ];
  const line = `${status.definition.name}发动「${status.definition.assistName}」：${effectParts.join('，')}。`;

  return appendLog(
    {
      ...state,
      player: {
        ...state.player,
        hp: hpAfter
      },
      combat: {
        ...state.combat,
        guarding: state.combat.guarding || status.effect.guarding,
        weaponFocus: focusAfter,
        companionAssistUsed: true,
        log: [line, ...state.combat.log].slice(0, 8)
      }
    },
    line
  );
}

export type BloodlineSurgeUnavailableReason =
  | 'legacy_disabled'
  | 'not_in_combat'
  | 'already_used'
  | 'no_benefit';

export type CurrentBloodlineSurgeStatus = {
  readonly legacyDisabled: boolean;
  readonly available: boolean;
  readonly snapshot?: BloodlineRunSnapshot;
  readonly effect?: BloodlineSurgeEffect;
  readonly reason?: BloodlineSurgeUnavailableReason;
  readonly unavailableReason?: string;
};

export function getCurrentBloodlineSurgeStatus(state: GameState): CurrentBloodlineSurgeStatus {
  const snapshot = normalizeBloodlineRunSnapshot(state.run?.bloodlineSnapshot);
  if (!snapshot) {
    return {
      legacyDisabled: true,
      available: false,
      reason: 'legacy_disabled',
      unavailableReason: '本轮副本没有合法的血统快照，血统爆发保持禁用。'
    };
  }

  const effect = getBloodlineSurgeEffect(snapshot);
  const base = { legacyDisabled: false, snapshot, effect };
  if (!effect) {
    return {
      ...base,
      available: false,
      reason: 'legacy_disabled',
      unavailableReason: '本轮血统快照无法解析，血统爆发保持禁用。'
    };
  }
  if (state.phase !== 'combat' || !state.combat) {
    return {
      ...base,
      available: false,
      reason: 'not_in_combat',
      unavailableReason: '血统爆发只能在战斗中使用。'
    };
  }
  if (state.combat.bloodlineSurgeUsed) {
    return {
      ...base,
      available: false,
      reason: 'already_used',
      unavailableReason: '本场战斗的血统爆发已经使用。'
    };
  }
  if (effect.healPercent > 0 && state.player.hp >= state.player.maxHp) {
    return {
      ...base,
      available: false,
      reason: 'no_benefit',
      unavailableReason: '当前生命已满，复生血统爆发不会产生收益。'
    };
  }

  return { ...base, available: true };
}

export function useBloodlineSurge(state: GameState): GameState {
  const status = getCurrentBloodlineSurgeStatus(state);
  if (!status.available || !status.snapshot || !status.effect || !state.combat) return state;
  const definition = getBloodlineDefinition(status.snapshot.bloodlineId);
  if (!definition) return state;

  const effect = status.effect;
  const directDamage = effect.forceDamage || effect.artDamage;
  const hpAfter = effect.healPercent > 0
    ? clampHp(
        state.player.hp + Math.ceil((state.player.maxHp * effect.healPercent) / 100),
        state.player.maxHp
      )
    : state.player.hp;
  const actualHealing = hpAfter - state.player.hp;
  const monsterHp = Math.max(0, state.combat.monsterHp - directDamage);
  const effectText = effect.forceDamage > 0
    ? `造成 ${effect.forceDamage} 点武力直伤`
    : effect.artDamage > 0
      ? `造成 ${effect.artDamage} 点术法直伤`
      : effect.barrier > 0
        ? `生成 ${effect.barrier} 点血统屏障`
        : `回复 ${actualHealing} 点生命`;
  const line = `${definition.name}发动血统爆发：${effectText}。`;
  const nextState = appendLog(
    {
      ...state,
      player: actualHealing > 0 ? { ...state.player, hp: hpAfter } : state.player,
      combat: {
        ...state.combat,
        monsterHp,
        bloodlineSurgeUsed: true,
        ...(effect.barrier > 0 ? { bloodlineBarrier: effect.barrier } : {}),
        log: [line, ...state.combat.log].slice(0, 8)
      }
    },
    line
  );

  if (monsterHp <= 0) {
    const monster = getCombatEncounterProfile(nextState)?.monster ?? MONSTERS[state.combat.monsterId];
    return finishCombatVictory(nextState, monster);
  }
  return nextState;
}

function getPureGuardReduction(
  state: GameState,
  monster: MonsterDefinition,
  combat: CombatState,
  directGuardMultiplier = 1
): number {
  const stats = getDerivedStats(state);
  const baseDamage = calculatePhysicalDamage(monster.attack, stats.defense);
  const baseGuardedDamage = Math.floor(baseDamage * 0.5);
  const guardEffectPercent = getCurrentDungeonLaw(state)?.modifiers.guardEffectPercent ?? 0;
  const fullGuardReduction = combat.guarding
    ? scaleByPercent(baseDamage - baseGuardedDamage, guardEffectPercent, 0)
    : 0;
  return Math.max(0, Math.floor(fullGuardReduction * directGuardMultiplier));
}

function monsterAttack(
  state: GameState,
  monster: MonsterDefinition,
  combat: CombatState,
  effectDamageToPlayer = 0,
  directGuardMultiplier = 1
): GameState {
  const stats = getDerivedStats(state);
  const baseDamage = calculatePhysicalDamage(monster.attack, stats.defense);
  const guardReduction = getPureGuardReduction(state, monster, combat, directGuardMultiplier);
  const guardedDamage = Math.max(0, baseDamage - guardReduction);
  const ironBodyGuard = combat.guarding && getAvailableLearnedMethods(state).includes('iron_body');
  const incomingDamage = ironBodyGuard ? Math.floor(guardedDamage * 0.7) : guardedDamage;
  let damage = Math.max(1, incomingDamage) + effectDamageToPlayer;
  const counterDamage = ironBodyGuard ? Math.max(2, Math.floor(stats.defense * 0.25)) : 0;
  let nextState = state;
  let statusLines: string[] = [];
  const armorPatchAvailability = getTacticalItemAvailability(state, 'armor_patch');

  if (
    combat.guarding &&
    armorPatchAvailability.available
  ) {
    const patch = getConsumableCombatEffect({
      itemId: 'armor_patch',
      context: getCombatMechanicsContext(state),
      incomingMonsterDamage: damage
    });
    damage = patch.adjustedDamageToPlayer;
    statusLines = patch.statusLines;
    nextState = recordUsedItem(consumeItem(state, 'armor_patch'), 'armor_patch');
  } else if (
    combat.guarding &&
    state.inventory.armor_patch > 0 &&
    !armorPatchAvailability.available &&
    armorPatchAvailability.reason !== 'missing'
  ) {
    statusLines = [getTacticalItemUnavailableLog(state, 'armor_patch') ?? ''];
  }

  const replay = normalizeCombatReplayCombatState(combat.combatReplayState);
  let nextCombatReplay = replay;
  if (replay?.enabled && replay.buffer > 0 && replay.remainingBufferHits > 0) {
    const bufferedDamage = Math.min(damage, replay.buffer);
    damage -= bufferedDamage;
    const remainingBufferHits = (replay.remainingBufferHits - 1) as 0 | 1;
    nextCombatReplay = {
      ...replay,
      buffer: remainingBufferHits > 0 ? replay.buffer : 0,
      remainingBufferHits
    };
    statusLines.push(`复演缓冲抵消 ${bufferedDamage} 点反击伤害，剩余承伤次数 ${remainingBufferHits}。`);
  }

  const activeBarrier = Number.isFinite(combat.bloodlineBarrier)
    ? Math.max(0, Math.floor(combat.bloodlineBarrier ?? 0))
    : 0;
  const absorbedDamage = Math.min(activeBarrier, damage);
  damage -= absorbedDamage;
  const remainingBarrier = activeBarrier - absorbedDamage;
  if (absorbedDamage > 0) {
    statusLines.push(`血统屏障吸收 ${absorbedDamage} 点最终入伤，剩余 ${remainingBarrier} 点。`);
  }

  return {
    ...applyPlayerDamage(nextState, damage),
    combat: {
      ...combat,
      monsterHp: Math.max(0, combat.monsterHp - counterDamage),
      guarding: false,
      bloodlineBarrier: remainingBarrier,
      ...(nextCombatReplay ? { combatReplayState: nextCombatReplay } : {}),
      turn: combat.turn + 1,
      log: [
        ...statusLines,
        ...(ironBodyGuard ? [`铁衣诀守反卸力，承伤降至 ${damage} 点并反震 ${counterDamage} 点。`] : []),
        `${monster.name}反击造成 ${damage} 点伤害。`,
        ...combat.log
      ].slice(0, 8)
    }
  };
}

function applyContinuingCombatFocus(
  state: GameState,
  action: CombatAction,
  intent: CombatIntent | undefined
): GameState {
  if (state.phase !== 'combat' || !state.combat || state.player.hp <= 0 || !intent) return state;

  const resolution = resolveCombatFocus({
    currentFocus: state.combat.weaponFocus,
    action,
    intent,
    combatContinues: true
  });
  const equipmentMemoryResult = applyEquipmentMemoryCombatFocusResolution(
    state.combat.equipmentMemoryState,
    resolution,
    true
  );
  const focusLine = resolution.spent
    ? `战技消耗 ${resolution.before - resolution.after} 点战意，当前 ${resolution.after}/${COMBAT_FOCUS_MAX}。`
    : resolution.delta > 0
      ? `战意 +${resolution.delta}，当前 ${resolution.after}/${COMBAT_FOCUS_MAX}。`
      : resolution.delta < 0
        ? `战意回落 ${Math.abs(resolution.delta)} 点，当前 ${resolution.after}/${COMBAT_FOCUS_MAX}。`
        : undefined;
  const memoryDefinition = equipmentMemoryResult.state
    ? getEquipmentMemoryById(equipmentMemoryResult.state.memoryId)
    : undefined;
  const equipmentMemoryLine = equipmentMemoryResult.stored
    ? `装备记忆「${memoryDefinition?.name ?? '未知记忆'}」暂存 1 点溢出战意。`
    : equipmentMemoryResult.restored
      ? `装备记忆「${memoryDefinition?.name ?? '未知记忆'}」在武器技后恢复 1 点战意，当前 ${equipmentMemoryResult.resolution.after}/${COMBAT_FOCUS_MAX}。`
      : undefined;
  const nextCombat: CombatState = {
    ...state.combat,
    weaponFocus: equipmentMemoryResult.resolution.after,
    log: equipmentMemoryLine || focusLine
      ? [
          ...(equipmentMemoryLine ? [equipmentMemoryLine] : []),
          ...(focusLine ? [focusLine] : []),
          ...state.combat.log
        ].slice(0, 8)
      : state.combat.log
  };
  if (equipmentMemoryResult.state) nextCombat.equipmentMemoryState = equipmentMemoryResult.state;
  else delete nextCombat.equipmentMemoryState;

  return {
    ...state,
    combat: nextCombat
  };
}

export function performCombatAction(state: GameState, action: CombatAction): GameState {
  if (state.phase !== 'combat' || !state.combat) return appendLog(state, '当前没有战斗。');
  if (action === 'art' && !isCurrentDungeonFeatureAvailable(state, 'method')) {
    return appendLog(state, '梦档案馆已封存功法，本场暂时无法运转术法。');
  }

  // Focus resolves after retaliation, but intent must describe the turn before the action mutates it.
  const actionIntent = getCurrentCombatIntent(state);
  const encounter = getCombatEncounterProfile(state);
  const monster = encounter?.monster ?? MONSTERS[state.combat.monsterId];
  const directAction = action === 'attack' || action === 'art' || action === 'guard'
    ? action
    : undefined;
  const openingReplay = directAction
    ? normalizeCombatReplayCombatState(state.combat.combatReplayState)
    : undefined;
  if (directAction && openingReplay?.enabled && !openingReplay.boss && openingReplay.route === 'sequence') {
    state = releaseCombatReplay(state, COMBAT_REPLAY_ROUTE_PERCENT.sequence).state;
    if ((state.combat?.monsterHp ?? 1) <= 0) return finishCombatVictory(state, monster);
  }
  const directMultiplier = directAction ? getBossReplayDirectMultiplier(state, directAction) : 1;
  if (!state.combat) return appendLog(state, '当前没有战斗。');
  const stats = getDerivedStats(state);
  let nextState = state;
  let nextCombat: CombatState = { ...state.combat };
  let damage = 0;
  let damageKind: CombatDamageKind = 'physical';
  let cloudStepSkirmishBonus = 0;
  let weaponSkillDefinition: WeaponSkillDefinition | undefined;
  let weaponSkillResolution: WeaponSkillResolution | undefined;
  let weaponSkillHealing = 0;

  if (action === 'guard') {
    nextState = signalCurrentCombatOpening(nextState, action, 'physical');
    nextCombat = {
      ...nextCombat,
      guarding: true,
      log: ['你转入防御，准备吃下下一次伤害。', ...nextCombat.log].slice(0, 8)
    };
    const effects = resolveMonsterEffects(nextState, monster, nextCombat, 0, 'physical', action);
    nextCombat = {
      ...effects.nextCombat,
      log: [...effects.statusLines, ...effects.nextCombat.log].slice(0, 8)
    };
    const observedGuard = getPureGuardReduction(nextState, monster, nextCombat, directMultiplier);
    nextState = recordCombatReplayDirectAction(
      { ...nextState, combat: nextCombat },
      action,
      observedGuard
    );
    nextState = resolveCombatReplayAfterDirectAction(nextState, action);
    nextCombat = nextState.combat ?? nextCombat;
    if ((nextCombat.monsterHp ?? 1) <= 0) return finishCombatVictory(nextState, monster);
    const replayBeforeCounter = normalizeCombatReplayCombatState(nextCombat.combatReplayState);
    if (replayBeforeCounter?.boss && replayBeforeCounter.route !== 'afterbeat') {
      nextState = advanceBossPhase(nextState);
      nextCombat = nextState.combat ?? nextCombat;
    }
    let afterMonster = monsterAttack(
      nextState,
      getCombatEncounterProfile(nextState)?.monster ?? monster,
      nextCombat,
      effects.damageToPlayer,
      directMultiplier
    );
    afterMonster = releasePendingAfterbeat(afterMonster);
    if (afterMonster.player.hp <= 0) {
      return resolveRunFailure(afterMonster, `${monster.name}把你逼到濒死，主神强制回收。`);
    }

    if ((afterMonster.combat?.monsterHp ?? 1) <= 0) {
      return finishCombatVictory(afterMonster, monster);
    }

    if (replayBeforeCounter?.boss && replayBeforeCounter.route === 'afterbeat') {
      afterMonster = advanceBossPhase(afterMonster);
    }

    return appendLog(
      applyContinuingCombatFocus(
        replayBeforeCounter?.boss ? afterMonster : advanceBossPhase(afterMonster),
        action,
        actionIntent
      ),
      '你选择防御，降低本回合承伤。'
    );
  }

  if (action === 'use_healing_pill') {
    const availability = getTacticalItemAvailability(state, 'healing_pill');
    if (!availability.available) {
      return appendLog(state, getTacticalItemUnavailableLog(state, 'healing_pill') ?? '止血丹暂时无法使用。');
    }
    const pillHealing = getAdjustedDungeonHealing(state, 36);
    nextState = consumeItem(state, 'healing_pill');
    nextState = recordUsedItem(nextState, 'healing_pill');
    nextState = normalizeHealth(nextState, 36);
    nextCombat = {
      ...nextCombat,
      log: [`你吞下止血丹，生命回复 ${pillHealing} 点。`, ...nextCombat.log].slice(0, 8)
    };
    const effects = resolveMonsterEffects(nextState, monster, nextCombat, 0, 'physical', action);
    nextCombat = {
      ...effects.nextCombat,
      log: [...effects.statusLines, ...effects.nextCombat.log].slice(0, 8)
    };

    const afterMonster = monsterAttack(
      { ...nextState, combat: nextCombat },
      monster,
      nextCombat,
      effects.damageToPlayer
    );
    if (afterMonster.player.hp <= 0) {
      return resolveRunFailure(afterMonster, `${monster.name}把你逼到濒死，主神强制回收。`);
    }

    return appendLog(
      applyContinuingCombatFocus(afterMonster, action, actionIntent),
      '止血丹争取到一回合喘息。'
    );
  }

  if (action === 'use_thunder_talisman') {
    const availability = getTacticalItemAvailability(state, 'thunder_talisman');
    if (!availability.available) {
      return appendLog(state, getTacticalItemUnavailableLog(state, 'thunder_talisman') ?? '雷火符暂时无法使用。');
    }
    damage = 42 + stats.spirit * 3;
    damageKind = 'talisman';
    nextState = consumeItem(state, 'thunder_talisman');
    nextState = recordUsedItem(nextState, 'thunder_talisman');
  } else if (action === 'art') {
    damage = calculateArtDamage(stats.artPower, monster.defense);
    damageKind = 'art';
  } else if (action === 'weapon_skill') {
    const status = getWeaponSkillStatus(state);
    if (!status.available || !status.definition) {
      return appendLog(state, status.unavailableReason ?? '当前战技不可用。');
    }

    weaponSkillDefinition = status.definition;
    weaponSkillResolution = resolveWeaponSkill({
      weaponId: status.weaponId,
      weaponLevel: state.equipmentLevels[status.weaponId] ?? 1,
      playerStats: stats,
      targetStats: monster,
      bossPhase: state.combat.bossPhase,
      resonance: status.resonance
    });
    damage = weaponSkillResolution.damage;
    damageKind = weaponSkillResolution.damageKind;
    weaponSkillHealing = getAdjustedDungeonHealing(nextState, weaponSkillResolution.healing);
    nextState = normalizeHealth(nextState, weaponSkillResolution.healing);
  } else if (action === 'escape') {
    const escapeOutcome = getEscapeOutcome({
      context: getCombatMechanicsContext(state),
      monster
    });
    const statusPrefix = escapeOutcome.statusLines.length > 0 ? `${escapeOutcome.statusLines.join(' ')} ` : '';

    if (escapeOutcome.success) {
      const escapeDamage = getAvailableLearnedMethods(state).includes('cloud_step') ? 2 : 8;
      const escapeLine =
        escapeDamage < 8
          ? `你借云隙步游斗拉开距离，只付出 ${escapeDamage} 点擦伤代价撤出战斗节点。`
          : '你付出轻伤代价，撤出战斗节点。';
      const damagedState = applyPlayerDamage(state, escapeDamage);

      if (damagedState.player.hp <= 0) {
        return resolveRunFailure(
          {
            ...damagedState,
            combat: undefined
          },
          `${statusPrefix}${escapeLine}伤势过重，主神强制回收。`
        );
      }

      return appendLog(
        {
          ...damagedState,
          phase: 'explore',
          combat: undefined
        },
        `${statusPrefix}${escapeLine}`
      );
    }
    nextCombat = {
      ...nextCombat,
      log: [...escapeOutcome.statusLines, '撤离失败，敌人截住了退路。', ...nextCombat.log].slice(0, 8)
    };
    const effects = resolveMonsterEffects(nextState, monster, nextCombat, 0, 'physical', action);
    nextCombat = {
      ...effects.nextCombat,
      log: [...effects.statusLines, ...effects.nextCombat.log].slice(0, 8)
    };

    const afterMonster = monsterAttack(
      { ...nextState, combat: nextCombat },
      monster,
      nextCombat,
      effects.damageToPlayer
    );
    if (afterMonster.player.hp <= 0) {
      return resolveRunFailure(afterMonster, `${monster.name}截断退路，主神强制回收。`);
    }

    return appendLog(
      applyContinuingCombatFocus(afterMonster, action, actionIntent),
      '撤离失败。'
    );
  } else {
    const pierceBonus =
      state.equipped.weapon === 'armor_piercing_sword' && ['tower_butcher', 'mine_shell_guard'].includes(monster.id) ? 6 : 0;
    cloudStepSkirmishBonus = getCloudStepSkirmishBonus(stats, monster, getAvailableLearnedMethods(state));
    damage = calculatePhysicalDamage(stats.attack + pierceBonus + cloudStepSkirmishBonus, monster.defense);
  }

  nextState = signalCurrentCombatOpening(nextState, action, damageKind);
  const outgoingModifiers = getCurrentDungeonLaw(nextState)?.modifiers.outgoingDamage;
  const outgoingPercent =
    action === 'attack' || (action === 'weapon_skill' && damageKind === 'physical')
      ? (outgoingModifiers?.forcePercent ?? 0)
      : action === 'art' || (action === 'weapon_skill' && damageKind === 'art')
        ? (outgoingModifiers?.artPercent ?? 0)
        : 0;
  damage = scaleByPercent(damage, outgoingPercent, 0);

  const effects = resolveMonsterEffects(nextState, monster, nextCombat, damage, damageKind, action);
  let finalDamageToMonster = effects.damageToMonster;
  let causalSealLine: string | undefined;
  let mirrorShellLine: string | undefined;
  if (monster.id === 'zero_sum_auditor' && finalDamageToMonster > 0) {
    const lawState = getNormalizedDungeonLawState(nextState);
    if (lawState) {
      const sealConsumption = consumeCausalCollectionSeal(lawState);
      if (sealConsumption.consumed) {
        finalDamageToMonster = Math.max(
          1,
          Math.floor(finalDamageToMonster * sealConsumption.finalDamageMultiplier)
        );
        nextState = withDungeonLawState(nextState, sealConsumption.state);
        const sealsRemaining = sealConsumption.state.law.kind === 'causal_clearinghouse'
          ? sealConsumption.state.law.collectionSeals
          : 0;
        causalSealLine = `追缴印抵消本次攻势，最终伤害减半，剩余 ${sealsRemaining} 枚。`;
      }
    }
  }
  if (monster.id === 'nameless_reflection' && finalDamageToMonster > 0) {
    const lawState = getNormalizedDungeonLawState(nextState);
    if (lawState) {
      const shellConsumption = consumeMirrorCityShell(lawState, finalDamageToMonster);
      if (shellConsumption.consumed) {
        finalDamageToMonster = Math.max(
          1,
          Math.floor(finalDamageToMonster * shellConsumption.finalDamageMultiplier)
        );
        nextState = withDungeonLawState(nextState, shellConsumption.state);
        const remainingShells = getMirrorCityShellStatus(shellConsumption.state).remainingShells;
        mirrorShellLine = `镜壳抵消本次攻势，最终伤害减半，剩余 ${remainingShells} 枚。`;
      }
    }
  }
  if (directAction && directMultiplier < 1) {
    finalDamageToMonster = Math.floor(finalDamageToMonster * directMultiplier);
  }
  const observedDirectDamage = Math.min(nextCombat.monsterHp, finalDamageToMonster);
  const monsterHp = Math.max(0, nextCombat.monsterHp - finalDamageToMonster);
  const actionLine =
    action === 'use_thunder_talisman'
      ? `雷火符炸开，造成 ${finalDamageToMonster} 点伤害。`
      : action === 'art'
        ? `你运转灵力，造成 ${finalDamageToMonster} 点术法伤害。`
        : action === 'weapon_skill' && weaponSkillDefinition && weaponSkillResolution
          ? `你发动${weaponSkillDefinition.name}，造成 ${finalDamageToMonster} 点${weaponSkillResolution.damageKind === 'art' ? '术法' : '物理'}伤害${weaponSkillHealing > 0 ? `，并回复 ${weaponSkillHealing} 点生命` : ''}。`
        : cloudStepSkirmishBonus > 0
          ? `云隙步带你游斗切入，造成 ${finalDamageToMonster} 点伤害。`
          : `你发动攻击，造成 ${finalDamageToMonster} 点伤害。`;

  nextCombat = {
    ...effects.nextCombat,
    monsterHp,
    log: [
      actionLine,
      ...(mirrorShellLine ? [mirrorShellLine] : []),
      ...(causalSealLine ? [causalSealLine] : []),
      ...(weaponSkillResolution?.statusLines ?? []),
      ...effects.statusLines,
      ...effects.nextCombat.log
    ].slice(0, 8)
  };

  nextState = {
    ...nextState,
    combat: nextCombat
  };

  if (directAction) {
    nextState = recordCombatReplayDirectAction(nextState, directAction, observedDirectDamage);
    nextState = resolveCombatReplayAfterDirectAction(nextState, directAction);
    nextCombat = nextState.combat ?? nextCombat;
  }

  if ((nextState.combat?.monsterHp ?? monsterHp) <= 0) {
    return finishCombatVictory(nextState, monster);
  }

  const replayBeforeCounter = normalizeCombatReplayCombatState(nextState.combat?.combatReplayState);
  if (!replayBeforeCounter?.boss || replayBeforeCounter.route !== 'afterbeat') {
    nextState = advanceBossPhase(nextState);
  }
  nextCombat = nextState.combat ?? nextCombat;
  const retaliationMonster = getCombatEncounterProfile(nextState)?.monster ?? monster;
  let afterMonster = monsterAttack(nextState, retaliationMonster, nextCombat, effects.damageToPlayer);
  afterMonster = releasePendingAfterbeat(afterMonster);
  if (afterMonster.player.hp <= 0) {
    return resolveRunFailure(afterMonster, `${monster.name}把你逼到濒死，主神强制回收。`);
  }

  if ((afterMonster.combat?.monsterHp ?? 1) <= 0) {
    return finishCombatVictory(afterMonster, monster);
  }

  if (replayBeforeCounter?.boss && replayBeforeCounter.route === 'afterbeat') {
    afterMonster = advanceBossPhase(afterMonster);
  }

  return appendLog(applyContinuingCombatFocus(afterMonster, action, actionIntent), actionLine);
}

export function resolveRetreat(state: GameState): GameState {
  return resolveRunEconomySettlement(state, 'retreated', '你主动撤回主神空间。');
}

export function resolveRunFailure(state: GameState, reason = '副本失败，主神强制回收。'): GameState {
  return resolveRunEconomySettlement(state, 'failed', reason);
}

function advanceEquipmentCommissionOnExit(state: GameState, dungeonId: DungeonId): GameState {
  const commission = state.equipmentCommission;
  if (!commission) return state;

  const result = advanceEquipmentCommission(commission, dungeonId);
  if (!result.advanced) return state;

  const rewardAmount = result.completed ? EQUIPMENT_COMMISSION_MATERIAL_REWARD : 0;
  const settlement: EquipmentCommissionSettlement = {
    status: result.completed ? 'completed' : 'advanced',
    dungeonId,
    equipmentIds: [commission.equipmentIds[0], commission.equipmentIds[1]],
    targetMaterialId: commission.targetMaterialId,
    completedDungeonIds: [...result.completedDungeonIds],
    rewardAmount
  };
  const settledState: GameState = {
    ...state,
    equipmentCommission: result.commission,
    inventory: result.completed
      ? addItems(state.inventory, { [commission.targetMaterialId]: rewardAmount })
      : state.inventory,
    run: state.run
      ? {
          ...state.run,
          lastEquipmentCommissionSettlement: settlement
        }
      : state.run
  };

  return appendLog(
    settledState,
    result.completed
      ? `装备封存委托完成：${EQUIPMENT[commission.equipmentIds[0]].name}与${EQUIPMENT[commission.equipmentIds[1]].name}解除封存，${ITEMS[commission.targetMaterialId].name} x${rewardAmount}已直接存入永久背包。`
      : `装备封存委托推进：已完成 ${result.completedDungeonIds.length}/${EQUIPMENT_COMMISSION_REQUIRED_DUNGEONS} 个不同副本。`
  );
}

export function resolveExit(state: GameState): GameState {
  if (getCurrentEquipmentSoulSkillRunState(state)?.pendingRecharge) {
    return appendLog(state, SOUL_RECHARGE_PENDING_BLOCK_MESSAGE);
  }
  const node = getCurrentNode(state);
  if (node?.type !== 'exit' || !node.reward) return appendLog(state, '当前位置不是出口。');
  if (state.run?.pendingEquipmentOffer) return appendLog(state, '先处理精英装备选择，再进行出口结算。');
  const bossSeal = getBossSealStatus(state);
  if (bossSeal && !bossSeal.cleared) return appendLog(state, `出口仍被封印：${bossSeal.requirementText}`);
  if (state.run?.clearedNodeIds.includes(node.id)) return appendLog(state, `${node.title}已经完成过结算。`);

  const dungeon = state.run ? DUNGEONS[state.run.dungeonId] : undefined;
  const directive = state.run ? getDirectiveForDungeon(state.run.dungeonId) : undefined;
  const isRepeatClear = Boolean(state.run && state.completedDungeonIds.includes(state.run.dungeonId));
  const runWithExit = state.run
    ? {
        ...state.run,
        clearedNodeIds: state.run.clearedNodeIds.includes(node.id)
          ? state.run.clearedNodeIds
          : [...state.run.clearedNodeIds, node.id]
      }
    : undefined;
  const directiveEvaluation =
    directive && runWithExit && dungeon
      ? evaluateDirective(directive, {
          dungeonId: runWithExit.dungeonId,
          clearedNodeIds: runWithExit.clearedNodeIds,
          totalNodes: dungeon.nodes.length,
          damageTaken: runWithExit.damageTaken,
          captures: runWithExit.capturedPetIds,
          usedItems: runWithExit.usedItems,
          learnedMethods: state.learnedMethods,
          equippedIds: Object.values(state.equipped),
          activePet: state.activePet,
          lawState: runWithExit.lawState
        })
      : undefined;
  // Repeat clears can farm run rewards, but first-clear directive rewards stay one-time.
  const shouldClaimDirective =
    !isRepeatClear && directive && directiveEvaluation?.status === 'completed' && !state.claimedDirectiveIds.includes(directive.id);
  const economy = state.run && dungeon
    ? calculateRunEconomy({
        baseRewardPoints: node.reward.rewardPoints ?? 0,
        clearedNodes: state.run.clearedNodeIds.length + 1,
        totalNodes: dungeon.nodes.length,
        damageTaken: state.run.damageTaken,
        captures: state.run.captures,
        readiness: getDungeonReadiness(state, state.run.dungeonId),
        dungeonTier: dungeon.tier,
        exitStatus: 'cleared'
      })
    : undefined;
  const pressureStatus = getCurrentRunPressure(state).status;
  const pressureRewardPointBonus = economy && pressureStatus
    ? calculateRunPressureBonus(economy.rewardPoints, pressureStatus.state)
    : 0;
  const pressureSettlement: RunPressureSettlement | undefined =
    economy && pressureStatus
      ? {
          state: pressureStatus.state,
          tier: pressureStatus.tier,
          rewardPointBonus: pressureRewardPointBonus
        }
      : undefined;
  const protocolId = getRunProtocolId(state.run);
  const baseProtocolEvaluation = economy && runWithExit
    ? evaluateRunProtocolReward({
        dungeonId: runWithExit.dungeonId,
        protocolId,
        clearedNodeIds: runWithExit.clearedNodeIds,
        baseRewardPoints: economy.rewardPoints
      })
    : undefined;
  const simplifiedProtocol = runWithExit?.entryFlowVersion === 2;
  const simplifiedMaterialReward = simplifiedProtocol && runWithExit
    ? {
        itemId: DUNGEON_MATERIAL_REWARDS[runWithExit.dungeonId].itemId,
        amount: protocolId === 'standard' ? 1 : protocolId === 'imprint' ? 2 : 3
      }
    : undefined;
  const protocolEvaluation = simplifiedProtocol && baseProtocolEvaluation && protocolId !== 'standard'
    ? {
        ...baseProtocolEvaluation,
        anchorCompletedBeforeBoss: baseProtocolEvaluation.bossDefeated,
        completedAnchorCount: 0,
        requiredAnchorCount: 0,
        canGrantProtocolReward: baseProtocolEvaluation.bossDefeated,
        rewardPoints: baseProtocolEvaluation.bossDefeated
          ? scaleRunProtocolRewardPoints(economy?.rewardPoints ?? 0, runWithExit.dungeonId, protocolId)
          : economy?.rewardPoints ?? 0,
        imprint: undefined,
        materialReward: undefined
      }
    : baseProtocolEvaluation;
  const protocolRewardPointBonus = economy && protocolEvaluation
    ? Math.max(0, protocolEvaluation.rewardPoints - economy.rewardPoints)
    : 0;
  const protocolSucceeded = protocolId !== 'standard' && protocolEvaluation?.canGrantProtocolReward === true;
  const protocolMaterialReward = protocolSucceeded ? protocolEvaluation?.materialReward : undefined;
  const protocolSettlement: RunProtocolSettlement | undefined =
    protocolId !== 'standard' && protocolEvaluation && state.run
      ? {
          protocol: state.run.protocol ?? { id: protocolId, rulesVersion: 1 },
          status: protocolSucceeded ? 'succeeded' : 'failed',
          bossDefeated: protocolEvaluation.bossDefeated,
          anchorCompletedBeforeBoss: protocolEvaluation.anchorCompletedBeforeBoss,
          baseRewardPoints: economy?.rewardPoints ?? 0,
          protocolRewardPoints: protocolEvaluation.rewardPoints,
          rewardPointBonus: protocolSucceeded ? protocolRewardPointBonus : 0,
          cycleImprintGranted: !simplifiedProtocol && protocolSucceeded && protocolId === 'imprint',
          ...(protocolMaterialReward === undefined ? {} : { materialReward: protocolMaterialReward })
        }
      : undefined;
  const protocolRewardItems: Partial<Record<ItemId, number>> =
    !simplifiedProtocol && protocolSucceeded && protocolId === 'imprint'
      ? { cycle_imprint: 1 }
      : protocolMaterialReward
        ? { [protocolMaterialReward.itemId]: protocolMaterialReward.amount }
        : {};
  const reward = economy
    ? {
        ...node.reward,
        rewardPoints:
          economy.rewardPoints +
          pressureRewardPointBonus +
          (protocolSucceeded ? protocolRewardPointBonus : 0) +
          (shouldClaimDirective ? (directive.reward.rewardPoints ?? 0) : 0),
        lingyun: (node.reward.lingyun ?? 0) + (shouldClaimDirective ? (directive.reward.lingyun ?? 0) : 0),
        items: addItems(
          addItems(
            addItems(
              addItems(createInventory(), node.reward.items),
              shouldClaimDirective && directive ? directive.reward.items : {}
            ),
            protocolRewardItems
          ),
          simplifiedMaterialReward
            ? { [simplifiedMaterialReward.itemId]: simplifiedMaterialReward.amount }
            : {}
        )
      }
    : shouldClaimDirective && directive
      ? {
          rewardPoints: (node.reward.rewardPoints ?? 0) + (directive.reward.rewardPoints ?? 0),
          lingyun: (node.reward.lingyun ?? 0) + (directive.reward.lingyun ?? 0),
          items: addItems(
            addItems(addItems(createInventory(), node.reward.items), directive.reward.items),
            simplifiedMaterialReward
              ? { [simplifiedMaterialReward.itemId]: simplifiedMaterialReward.amount }
              : {}
          )
        }
      : simplifiedMaterialReward
        ? {
            ...node.reward,
            items: addItems(node.reward.items as Record<ItemId, number>, {
              [simplifiedMaterialReward.itemId]: simplifiedMaterialReward.amount
            })
          }
        : node.reward;
  const routeContractResult = state.run
    ? settleDungeonRunRouteContract(state.run, 'successful_exit')
    : undefined;
  const routeContractSettlement = routeContractResult?.settlement;
  const pursuitResult = routeContractResult
    ? settleDungeonRunPursuit(routeContractResult.run, 'successful_exit')
    : undefined;
  const routeContractRewardPoints = routeContractSettlement?.rewardPoints ?? 0;
  const paidRewardPoints = reward.rewardPoints ?? 0;
  const settlementText = isRepeatClear ? `${node.title}复刷结算。` : `${node.title}首次通关结算。`;
  const protocolOutcomeText = protocolSettlement
    ? `; protocol=${protocolSettlement.protocol.id}:${protocolSettlement.status}; anchors=${protocolEvaluation?.completedAnchorCount ?? 0}/${protocolEvaluation?.requiredAnchorCount ?? 0}; protocolBonus=${protocolSettlement.rewardPointBonus}; cycleImprint=${protocolSettlement.cycleImprintGranted ? 1 : 0}${protocolSettlement.materialReward ? `; material=${protocolSettlement.materialReward.itemId}:${protocolSettlement.materialReward.amount}` : protocolSettlement.protocol.id === 'deep' ? '; material=none' : ''}`
    : '';
  const pressureOutcomeText = pressureSettlement
    ? `; pressure=${pressureSettlement.tier}; pressureNodes=${pressureSettlement.state.clearedNodeCount}; pressureBonus=${pressureSettlement.rewardPointBonus}`
    : '';
  const routeContractOutcomeText = routeContractSettlement?.state
    ? `; routeContract=${routeContractSettlement.state.contractId}:${routeContractSettlement.state.status}; routeContractReason=${routeContractSettlement.state.reason ?? 'none'}; routeContractBonus=${routeContractRewardPoints}`
    : '';
  const pursuitOutcomeText = getPursuitOutcomeFields(pursuitResult?.settlement);
  const outcomeText = economy
    ? `${settlementText}outcome=${economy.outcome}; score=${economy.score}; multiplier=${economy.rewardMultiplier}x; reward=${paidRewardPoints}${protocolOutcomeText}${pressureOutcomeText}${routeContractOutcomeText}${pursuitOutcomeText}`
    : `${settlementText}${routeContractOutcomeText}${pursuitOutcomeText}`;
  const lootSettledState = settleRunLootState(state, 'cleared');
  const bankedEquipmentCount = lootSettledState.run?.lastLootSettlement?.retained.equipmentIds.length ?? 0;
  let protocolLog = '';
  if (simplifiedProtocol && protocolSettlement) {
    const difficultyName = protocolSettlement.protocol.id === 'imprint' ? '困难' : '炼狱';
    protocolLog = protocolSettlement.status === 'succeeded'
      ? ` ${difficultyName}难度完成，额外获得 ${protocolSettlement.rewardPointBonus} 奖励点。`
      : ` ${difficultyName}难度未完成，不发放难度加成。`;
  } else if (protocolSettlement?.protocol.id === 'imprint') {
    protocolLog = protocolSettlement.status === 'succeeded'
      ? ` 轮回协议成功，额外获得 ${protocolSettlement.rewardPointBonus} 奖励点与 1 枚轮回刻印。`
      : ' 轮回协议失效：锚点未在首领战前完成，不产出轮回刻印。';
  } else if (protocolSettlement?.protocol.id === 'deep') {
    const anchorProgress = `${protocolEvaluation?.completedAnchorCount ?? 0}/${protocolEvaluation?.requiredAnchorCount ?? 2}`;
    protocolLog = protocolSettlement.status === 'succeeded' && protocolSettlement.materialReward
      ? ` 深层轮回协议成功：双锚点 ${anchorProgress} 已在首领战前完成，额外获得 ${protocolSettlement.rewardPointBonus} 奖励点与${ITEMS[protocolSettlement.materialReward.itemId].name} x${protocolSettlement.materialReward.amount}；入场轮回刻印不返还。`
      : ` 深层轮回协议失败：双锚点 ${anchorProgress} 未在首领战前全部完成，不发放协议奖励或材料；入场轮回刻印不返还。`;
  }
  const pressureLog = pressureSettlement
    ? ` 侵蚀结算「${pressureStatus?.label ?? pressureSettlement.tier}」：累计清理 ${pressureSettlement.state.clearedNodeCount} 个节点，出口加成 +${pressureSettlement.rewardPointBonus} 奖励点。`
    : '';
  const routeContractDefinition = routeContractSettlement?.state
    ? getRouteContractById(routeContractSettlement.state.contractId, routeContractSettlement.state.dungeonId)
    : undefined;
  const routeContractLog = routeContractSettlement?.state
    ? routeContractSettlement.rewarded
      ? ` ${simplifiedProtocol ? '隐藏任务' : '路线契约'}「${routeContractDefinition?.name ?? routeContractSettlement.state.contractId}」已入账，独立获得 ${routeContractRewardPoints} 奖励点。`
      : ` ${simplifiedProtocol ? '隐藏任务' : '路线契约'}「${routeContractDefinition?.name ?? routeContractSettlement.state.contractId}」以 ${routeContractSettlement.state.status}/${routeContractSettlement.state.reason ?? 'none'} 结算，奖励为 0。`
    : '';
  const materialLog = simplifiedMaterialReward
    ? ` ${ITEMS[simplifiedMaterialReward.itemId].name} +${simplifiedMaterialReward.amount}，可在装备商人处兑换本章装备。`
    : '';
  const normallyRewardedState = markNodeCleared(applyReward(lootSettledState, reward), node.id);
  const pursuitRewardedState = pursuitResult?.materialReward
    ? applyReward(normallyRewardedState, {
        items: { [pursuitResult.materialReward.itemId]: pursuitResult.materialReward.amount }
      })
    : normallyRewardedState;
  const rewardedState = routeContractRewardPoints > 0
    ? applyReward(pursuitRewardedState, { rewardPoints: routeContractRewardPoints })
    : pursuitRewardedState;
  const relicSettlement = rewardedState.run
    ? createRunRelicSettlement(
        rewardedState.run,
        isRunRelicState(rewardedState.run.relicState) &&
          rewardedState.run.relicState.acquiredIds.length > 0
          ? 'pending'
          : 'skipped'
      )
    : undefined;
  const exitSettledState: GameState = {
    ...rewardedState,
    run: rewardedState.run
      ? {
          ...rewardedState.run,
          ...(protocolSettlement === undefined ? {} : { lastProtocolSettlement: protocolSettlement }),
          ...(pressureSettlement === undefined ? {} : { lastPressureSettlement: pressureSettlement }),
          ...(relicSettlement === undefined ? {} : { lastRelicSettlement: relicSettlement }),
          ...(routeContractSettlement === undefined
            ? {}
            : {
                routeContractState: routeContractSettlement.state,
                lastRouteContractSettlement: routeContractSettlement
              }),
          ...(pursuitResult?.settlement === undefined
            ? {}
            : {
                pursuitState: pursuitResult.run.pursuitState,
                lastPursuitSettlement: pursuitResult.settlement
              })
        }
      : rewardedState.run,
    completedDungeonIds:
      lootSettledState.run && !lootSettledState.completedDungeonIds.includes(lootSettledState.run.dungeonId)
        ? [...lootSettledState.completedDungeonIds, lootSettledState.run.dungeonId]
        : lootSettledState.completedDungeonIds,
    claimedDirectiveIds:
      shouldClaimDirective && directive
        ? [...lootSettledState.claimedDirectiveIds, directive.id]
        : lootSettledState.claimedDirectiveIds,
    phase: 'result',
    lastOutcome: outcomeText
  };
  const commissionSettledState = state.run
    ? advanceEquipmentCommissionOnExit(exitSettledState, state.run.dungeonId)
    : exitSettledState;
  const automaticMemoryResult = simplifiedProtocol && state.run
    ? unlockEquipmentMemoriesFromClear(commissionSettledState, state.run.dungeonId)
    : { state: commissionSettledState, unlockedEquipmentIds: [] };
  const equipmentMemoryResult = settleGameStateEquipmentMemoryHunt(
    automaticMemoryResult.state,
    'successful_exit'
  );
  const loggedState = appendLog(
    equipmentMemoryResult.state,
    economy
      ? isRepeatClear
        ? `${node.title}亮起，已通关副本复刷结算：${economy.outcome}，倍率 ${economy.rewardMultiplier}x。${protocolLog}${pressureLog}${routeContractLog}${materialLog}${bankedEquipmentCount ? ` 带回 ${bankedEquipmentCount} 件装备。` : ''}`
        : `${node.title}亮起，首次通关结算：${economy.outcome}，倍率 ${economy.rewardMultiplier}x。${protocolLog}${pressureLog}${routeContractLog}${materialLog}${bankedEquipmentCount ? ` 带回 ${bankedEquipmentCount} 件装备。` : ''}`
      : isRepeatClear
        ? `${node.title}亮起，已通关副本重复探索完成。${routeContractLog}`
        : `${node.title}亮起，你首次通关本轮副本探索。${routeContractLog}`
  );
  const memoryLoggedState = equipmentMemoryResult.settlementLog
    ? appendLog(loggedState, equipmentMemoryResult.settlementLog)
    : loggedState;
  const automaticMemoryDefinition = state.run
    ? getEquipmentMemoryForDungeon(state.run.dungeonId)
    : undefined;
  const automaticMemoryLog = automaticMemoryDefinition && automaticMemoryResult.unlockedEquipmentIds.length > 0
    ? `装备记忆「${automaticMemoryDefinition.name}」已由${automaticMemoryResult.unlockedEquipmentIds.map((equipmentId) => EQUIPMENT[equipmentId].name).join('、')}自动收录并激活。`
    : undefined;
  const automaticMemoryLoggedState = automaticMemoryLog
    ? appendSecondaryLog(memoryLoggedState, automaticMemoryLog)
    : memoryLoggedState;
  const pursuitLog = getPursuitSettlementLog(pursuitResult?.settlement);
  return pursuitLog ? appendSecondaryLog(automaticMemoryLoggedState, pursuitLog) : automaticMemoryLoggedState;
}

export function resolveRunRelicArchive(
  state: GameState,
  relicId?: RunRelicId
): GameState {
  const run = state.run;
  if (!run || run.lastRelicSettlement?.status !== 'pending' || !isRunRelicState(run.relicState)) {
    return state;
  }

  if (relicId === undefined) {
    return appendLog(
      {
        ...state,
        run: {
          ...run,
          lastRelicSettlement: createRunRelicSettlement(run, 'skipped')
        }
      },
      '你放弃了本轮回响遗物归档。'
    );
  }

  if (!isRunRelicId(relicId) || !run.relicState.acquiredIds.includes(relicId)) return state;

  const relic = RUN_RELIC_DEFINITIONS[relicId];
  const archivedRelicIds = [...new Set([...getArchivedRunRelicIds(state), relicId])];
  return appendLog(
    {
      ...state,
      preparedRelicFrame: relic.frame,
      archivedRelicIds,
      preparedRelicSeedId: relicId,
      run: {
        ...run,
        lastRelicSettlement: createRunRelicSettlement(run, 'archived', relicId)
      }
    },
    `回响遗物「${relic.name}」已归档，并设为下一轮归档种子。`
  );
}

export function returnToHub(state: GameState): GameState {
  if (state.run?.lastRelicSettlement?.status === 'pending') {
    return appendLog(state, '先归档或放弃本轮回响遗物，再返回主神空间。');
  }

  return appendLog(
    normalizeHealth({
      ...state,
      phase: 'hub',
      run: undefined,
      combat: undefined,
      lastOutcome: undefined
    }),
    '你回到主神空间，兑换碑刷新出新的可选项。'
  );
}
