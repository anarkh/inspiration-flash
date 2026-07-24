import type { CombatAction, DungeonId, DungeonNode } from './game';
import type { DungeonEventOutcome } from './dungeon-events';

export const DUNGEON_LAW_STATE_VERSION = 1 as const;
export const LEGACY_AUCTION_COURT_DUNGEON_ID = 'legacy_auction_court' as const;
export const GENESIS_VAULT_DUNGEON_ID = 'genesis_vault' as const;
export const SILENT_BROADCAST_TOWER_DUNGEON_ID = 'silent_broadcast_tower' as const;
export const LOST_SHELTER_DUNGEON_ID = 'lost_shelter' as const;
export const FALSE_TESTIMONY_COURT_DUNGEON_ID = 'false_testimony_court' as const;
export const COMBAT_REPLAY_STAGE_DUNGEON_ID = 'combat_replay_stage' as const;
export const PANOPTICON_CITY_DUNGEON_ID = 'panopticon_city' as const;
export type DungeonLawDungeonId = DungeonId |
  typeof LEGACY_AUCTION_COURT_DUNGEON_ID |
  typeof GENESIS_VAULT_DUNGEON_ID |
  typeof SILENT_BROADCAST_TOWER_DUNGEON_ID |
  typeof LOST_SHELTER_DUNGEON_ID |
  typeof FALSE_TESTIMONY_COURT_DUNGEON_ID |
  typeof COMBAT_REPLAY_STAGE_DUNGEON_ID |
  typeof PANOPTICON_CITY_DUNGEON_ID;

export const DUNGEON_LAW_LANDMARKS = {
  demon_tower_1: {
    reliefNodeIds: ['sealed_cache', 'quiet_prayer_reward'],
    reliefEventIds: ['blood_rune_stair', 'mist_sealed_cache']
  },
  metro_abyss: {
    calibrationNodeIds: ['signal_cache']
  },
  starfall_mine: {
    gravitySwitchNodeIds: ['tilted_gravity_switch', 'backup_gravity_well']
  },
  rust_hospital: {
    pharmacyNodeIds: ['pharmacy_reward'],
    triageEventIds: ['triage_ward']
  },
  dream_archive: {
    indexNodeIds: ['index_reward', 'cracked_core_index_reward'],
    indexEventIds: ['failure_index']
  },
  temporal_observatory: {
    pastAnchorNodeIds: ['past_calibration_anchor'],
    futureAnchorNodeIds: ['future_calibration_anchor']
  },
  entropy_ark: {
    headingConsoleNodeIds: [
      'bow_heading_console',
      'midship_heading_console',
      'stern_heading_console'
    ]
  },
  mirror_cycle_city: {
    phaseChoiceNodeIds: [
      'first_phase_mirror',
      'second_phase_mirror',
      'third_phase_mirror'
    ],
    realAnchorNodeIds: ['real_anchor'],
    mirrorAnchorNodeIds: ['mirror_anchor']
  },
  redaction_scriptorium: {
    clauseNodeIds: [
      'body_clause_desk',
      'memory_clause_desk',
      'return_clause_desk'
    ]
  },
  legacy_auction_court: {
    lotNodeIds: [
      'force_lot_dais',
      'guard_lot_dais',
      'art_lot_dais',
      'return_lot_dais'
    ]
  },
  genesis_vault: {
    spliceNodeIds: [
      'first_splice_console',
      'second_splice_console',
      'third_splice_console'
    ]
  },
  silent_broadcast_tower: {
    relayNodeIds: [
      'north_relay_console',
      'central_relay_console',
      'south_relay_console'
    ]
  },
  lost_shelter: {
    checkpointNodeIds: [
      'north_checkpoint',
      'central_checkpoint',
      'south_checkpoint'
    ]
  },
  false_testimony_court: {
    evidenceNodeIds: [
      'voice_evidence',
      'timeline_evidence',
      'residue_evidence'
    ],
    trapNodeIds: [
      'voice_filter_trap',
      'timeline_checksum_trap',
      'residue_sterility_trap'
    ],
    verdictNodeIds: ['verdict_chamber', 'appeal_desk']
  },
  combat_replay_stage: {
    takeNodeIds: ['take_alpha', 'take_beta', 'take_gamma'],
    routeNodeIds: ['sequence_route', 'burst_route', 'afterbeat_route']
  },
  panopticon_city: {
    relayNodeIds: ['north_blind_relay', 'central_blind_relay', 'south_blind_relay'],
    routeNodeIds: ['shadow_route', 'decoy_route', 'refraction_route']
  }
} as const;

export type CombatOpeningStyle = 'force' | 'art' | 'guard';
export type MetroTide = 'ebb' | 'flood' | 'mirror';
export type MineGravity = 'upward' | 'downward';
export type ArchiveSealableFeature = 'consumable' | 'method' | 'pet';
export type ArchiveFeature = ArchiveSealableFeature | 'attack' | 'defense';
export type CausalLedgerChoice = 'balance' | 'overdraw' | 'repay';
export type EntropyHeadingChoice = 'steady' | 'rush';
export type MirrorCityPhase = 'real' | 'mirror';
export type MirrorCityPhaseNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds)[number];
export type RedactionClauseNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds)[number];
export type RedactionChoice = 'certify' | 'redact';
export type AuctionLot = 'force' | 'guard' | 'art' | 'return';
export type AuctionLotNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds)[number];
export type AuctionLotChoice = 'bid' | 'burn' | 'fold';
export type GenesisGene = 'force' | 'art' | 'guard' | 'renewal';
export type GenesisSpliceNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds)[number];
export type BroadcastRelayNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds)[number];
export type BroadcastRelayChoice = 'mute' | 'broadcast';
export type EscortCheckpointNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds)[number];
export type EscortCheckpointChoice = 'treat' | 'push';
export type EscortCompanionId = null | 'qin_che' | 'zhou_yingxue' | 'lu_guanlan';
export type FalseTestimonyEvidenceId =
  (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds)[number];
export type FalseTestimonyTrapNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds)[number];
export type FalseTestimonyPendingVerdictNodeId =
  null | (typeof DUNGEON_LAW_LANDMARKS.false_testimony_court.verdictNodeIds)[number];
export type FalseTestimonySuspect =
  | 'records_keeper'
  | 'field_medic'
  | 'security_chief'
  | 'route_surveyor';

export type CombatReplayAction = 'attack' | 'art' | 'guard';
export type CombatReplayRoute = 'sequence' | 'burst' | 'afterbeat';
export type CombatReplayTakeNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds)[number];
export type CombatReplayTake = {
  action: CombatReplayAction;
  observedValue: number;
  replayValue: number;
};
export type CombatReplayTakes = [
  CombatReplayTake | null,
  CombatReplayTake | null,
  CombatReplayTake | null
];
export type CombatReplayCompleteTakes = [
  CombatReplayTake,
  CombatReplayTake,
  CombatReplayTake
];
export type CombatReplayEntryGear = {
  frameEngraver: boolean;
  cueVisor: boolean;
  bufferPlate: boolean;
  thawMetronome: boolean;
};
export type CombatReplayBossSnapshot = {
  takes: CombatReplayCompleteTakes;
  route: CombatReplayRoute;
};

export type PanopticonRoute = 'shadow' | 'decoy' | 'refraction';
export type PanopticonScanPhase = 0 | 1 | 2;
export type PanopticonRelayNodeId =
  (typeof DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds)[number];
export type PanopticonEntryGear = {
  blindlineCutter: boolean;
  predictiveVisor: boolean;
  matteShell: boolean;
  inversePrism: boolean;
};
export type PanopticonRelayState = Record<PanopticonRelayNodeId, boolean>;
export type PanopticonBossSnapshot = {
  route: PanopticonRoute;
  exposureCount: number;
  refractionCharges: 0 | 1 | 2 | 3;
};

export type FalseTestimonyEntryGear = {
  crossExaminerSabre: boolean;
  forensicVisor: boolean;
  custodyShell: boolean;
  appealSeal: boolean;
};

export type FalseTestimonyBossVerdictSnapshot = {
  suspect: FalseTestimonySuspect;
  correct: boolean;
  trustedCount: number;
  appealed: boolean;
  eliminatedSuspects: FalseTestimonySuspect[];
};

export type EscortEntryGear = {
  rescueCarbine: boolean;
  triageVisor: boolean;
  evacuationPlate: boolean;
  blackboxBeacon: boolean;
};

export type EscortEntryCompanion = {
  id: EscortCompanionId;
  rank: 0 | 1 | 2 | 3;
};

export type GenesisEntryGear = {
  helixCleaver: boolean;
  symbioteCowl: boolean;
  carapaceHarness: boolean;
  rebirthAmulet: boolean;
};

export type GenesisEntryBloodline = {
  aspect: GenesisGene | null;
  rank: 0 | 1 | 2 | 3;
};

export type CausalEntryPassives = {
  causalVisor: boolean;
  echoBreakerGauntlets: boolean;
  returnAnchorBelt: boolean;
};

export type EntropyEntryPassives = {
  entropyCompass: boolean;
  dissipationMantle: boolean;
  arkKeelBoots: boolean;
};

export type MirrorCityEntryPassives = {
  parallaxVisor: boolean;
  phaseweaveMantle: boolean;
  homecomingPrism: boolean;
};

export type RedactionEntryPassives = {
  redlineEdge: boolean;
  palimpsestMantle: boolean;
  finalProofSeal: boolean;
};

export type LegacyAuctionEntryPassives = {
  legacyGavel: boolean;
  anonymousVeil: boolean;
  escrowPlate: boolean;
  finalLotBell: boolean;
};

export type BroadcastEntryPassives = {
  hushblade: boolean;
  deadAirHeadset: boolean;
  anechoicMantle: boolean;
  lastChannelBeacon: boolean;
};

type DungeonLawEntryPassives = CausalEntryPassives &
  EntropyEntryPassives &
  MirrorCityEntryPassives &
  RedactionEntryPassives &
  LegacyAuctionEntryPassives &
  BroadcastEntryPassives;

export type DungeonLawEntryConfig = Partial<DungeonLawEntryPassives> & {
  entryPassives?: Partial<DungeonLawEntryPassives>;
  entryGear?: Partial<
    GenesisEntryGear & EscortEntryGear & FalseTestimonyEntryGear & CombatReplayEntryGear &
    PanopticonEntryGear
  >;
  entryBloodline?: Partial<GenesisEntryBloodline>;
  entryCompanion?: Partial<EscortEntryCompanion>;
};

export type CombatOpeningRecord = {
  isBoss: boolean;
  style: CombatOpeningStyle | null;
};

export type DungeonLawData =
  | { kind: 'demon_tower'; fogPressure: number }
  | { kind: 'metro_abyss'; tide: MetroTide }
  | { kind: 'starfall_mine'; gravity: MineGravity }
  | { kind: 'rust_hospital'; pollution: number }
  | { kind: 'ash_arena' }
  | { kind: 'dream_archive'; sealedFeatures: ArchiveSealableFeature[] }
  | { kind: 'temporal_observatory'; pastCalibrated: boolean; futureCalibrated: boolean }
  | {
      kind: 'void_citadel';
      bossAssessmentLocked: boolean;
      bossCounter: CombatOpeningStyle | null;
    }
  | {
      kind: 'causal_clearinghouse';
      debt: number;
      pendingLedgerNodeId: string | null;
      settledLedgerNodeIds: string[];
      bossDebtLocked: boolean;
      collectionSeals: number;
      entryPassives: CausalEntryPassives;
      visorCreditUsed: boolean;
    }
  | {
      kind: 'entropy_ark';
      entropy: number;
      pendingHeadingNodeId: string | null;
      resolvedHeadingChoices: Record<string, EntropyHeadingChoice>;
      bossEntropyLocked: boolean;
      collapseLayers: number;
      entryPassives: EntropyEntryPassives;
      compassCreditUsed: boolean;
    }
  | {
      kind: 'mirror_cycle_city';
      currentPhase: MirrorCityPhase;
      pendingPhaseNodeId: MirrorCityPhaseNodeId | null;
      resolvedPhaseChoices: Partial<Record<MirrorCityPhaseNodeId, MirrorCityPhase>>;
      anchors: Record<MirrorCityPhase, boolean>;
      bossAnchorSnapshot: Record<MirrorCityPhase, boolean> | null;
      brokenMirrorShells: number;
      entryPassives: MirrorCityEntryPassives;
    }
  | {
      kind: 'redaction_scriptorium';
      pendingClauseNodeId: RedactionClauseNodeId | null;
      resolvedClauseChoices: Partial<Record<RedactionClauseNodeId, RedactionChoice>>;
      bossClauseSnapshot: Partial<Record<RedactionClauseNodeId, RedactionChoice>> | null;
      entryPassives: RedactionEntryPassives;
    }
  | {
      kind: 'legacy_auction_court';
      pendingLotNodeId: AuctionLotNodeId | null;
      resolvedLotChoices: Partial<Record<AuctionLotNodeId, AuctionLotChoice>>;
      bossLotSnapshot: Partial<Record<AuctionLotNodeId, AuctionLotChoice>> | null;
      entryPassives: LegacyAuctionEntryPassives;
    }
  | {
      kind: 'genesis_vault';
      pendingSpliceNodeId: GenesisSpliceNodeId | null;
      spliceSequence: GenesisGene[];
      bossGenomeSnapshot: GenesisGene[] | null;
      entryGear: GenesisEntryGear;
      entryBloodline: GenesisEntryBloodline;
    }
  | {
      kind: 'silent_broadcast_tower';
      noise: number;
      pendingRelayNodeId: BroadcastRelayNodeId | null;
      resolvedRelayChoices: Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>;
      bossNoiseSnapshot: number | null;
      entryPassives: BroadcastEntryPassives;
      firstClashMutedUsed: boolean;
    }
  | {
      kind: 'lost_shelter';
      survivorHp: number;
      pendingCheckpointNodeId: EscortCheckpointNodeId | null;
      resolvedCheckpointChoices: Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>;
      bossSurvivorSnapshot: number | null;
      entryGear: EscortEntryGear;
      entryCompanion: EscortEntryCompanion;
      firstHazardGuardUsed: boolean;
      companionAnalysisUsed: boolean;
      companionTriageUsed: boolean;
    }
  | {
      kind: 'false_testimony_court';
      revealedEvidenceIds: FalseTestimonyEvidenceId[];
      contaminatedEvidenceIds: FalseTestimonyEvidenceId[];
      pendingVerdictNodeId: FalseTestimonyPendingVerdictNodeId;
      accusedSuspect: FalseTestimonySuspect | null;
      accusationCorrect: boolean | null;
      accusationTrustedCount: number;
      appealUsed: boolean;
      bossVerdictSnapshot: FalseTestimonyBossVerdictSnapshot | null;
      entryGear: FalseTestimonyEntryGear;
      custodyProtectionUsed: boolean;
    }
  | {
      kind: 'combat_replay_stage';
      takes: CombatReplayTakes;
      route: CombatReplayRoute | null;
      bossSnapshot: CombatReplayBossSnapshot | null;
      entryGear: CombatReplayEntryGear;
    }
  | {
      kind: 'panopticon_city';
      scanPhase: PanopticonScanPhase;
      moveCount: number;
      exposureCount: number;
      relays: PanopticonRelayState;
      pendingRouteNodeId: PanopticonRelayNodeId | null;
      route: PanopticonRoute | null;
      refractionCharges: 0 | 1 | 2 | 3;
      decoyRewardsGranted: 0 | 1 | 2 | 3;
      bossSnapshot: PanopticonBossSnapshot | null;
      entryGear: PanopticonEntryGear;
      predictiveVisorProtectionUsed: [boolean, boolean, boolean];
    };

export type DungeonLawState = {
  rulesVersion: typeof DUNGEON_LAW_STATE_VERSION;
  dungeonId: DungeonLawDungeonId;
  clearedNodeIds: string[];
  resolvedEventIds: string[];
  combatOpenings: Record<string, CombatOpeningRecord>;
  combatVictoryNodeIds: string[];
  law: DungeonLawData;
};

export type FirstNodeClearSignal = {
  node: Pick<DungeonNode, 'id' | 'type'>;
  damageTaken?: number;
};

export type DungeonEventSignal = {
  eventId: string;
  outcome: Pick<DungeonEventOutcome, 'success' | 'damage'>;
};

export type CombatStartedSignal = {
  nodeId: string;
  isBoss: boolean;
  openingAction: CombatAction;
};

export type CombatVictorySignal = {
  nodeId: string;
  isBoss: boolean;
};

export type CombatOpeningDistribution = Record<CombatOpeningStyle, number>;

export type DungeonLawModifierContext = {
  isReflectionEncounter?: boolean;
  isBossEncounter?: boolean;
  isBossAwakened?: boolean;
};

// Every number is a percentage delta, deliberately bounded to [-20, 20].
export type DungeonLawModifiers = {
  encounter: {
    allStatsPercent: number;
    defensePercent: number;
    artPowerPercent: number;
  };
  trap: {
    damagePercent: number;
    dcPercent: number;
  };
  healingPercent: number;
  outgoingDamage: {
    forcePercent: number;
    artPercent: number;
  };
  guardEffectPercent: number;
};

export type DungeonLawDisplayModel = {
  dungeonId: DungeonLawDungeonId;
  title: string;
  status: string;
  severity: 'stable' | 'warning' | 'danger' | 'resolved';
  meter: { value: number; max: number } | null;
  targetReached: boolean;
  modifiers: DungeonLawModifiers;
  redaction?: {
    totalClauseCount: 3;
    resolvedCount: number;
    certifiedCount: number;
    redactedCount: number;
    pendingClauseNodeId: RedactionClauseNodeId | null;
    projectedClauseChoices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>;
    frozenClauseChoices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>> | null;
  };
  auction?: {
    totalLotCount: 4;
    availableScrip: number;
    resolvedCount: number;
    bidCount: number;
    burnCount: number;
    foldCount: number;
    pendingLotNodeId: AuctionLotNodeId | null;
    currentCosts: Readonly<Record<AuctionLotChoice, number>>;
    projectedLotChoices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>;
    frozenLotChoices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>> | null;
    projectedBossModifiers: AuctionBossModifierProjection;
  };
  genesis?: {
    availableGenesisSerum: number;
    pendingSpliceNodeId: GenesisSpliceNodeId | null;
    spliceSequence: readonly GenesisGene[];
    uniqueCount: number;
    bossGenomeSnapshot: readonly GenesisGene[] | null;
    projectedModifiers: GenesisModifierProjection;
  };
  broadcast?: {
    totalRelayCount: 3;
    noise: number;
    pendingRelayNodeId: BroadcastRelayNodeId | null;
    resolvedRelayChoices: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>>;
    resolvedCount: number;
    muteCount: number;
    broadcastCount: number;
    bossNoiseSnapshot: number | null;
    entryPassives: Readonly<BroadcastEntryPassives>;
    firstClashMutedUsed: boolean;
    entryPassiveReasons: BroadcastEntryPassiveReasons;
    choices: Readonly<Record<BroadcastRelayChoice, BroadcastRelayChoiceStatus>>;
  };
  escort?: {
    totalCheckpointCount: 3;
    survivorHp: number;
    availableHealingPills: number;
    pendingCheckpointNodeId: EscortCheckpointNodeId | null;
    resolvedCheckpointChoices: Readonly<Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>>;
    resolvedCount: number;
    treatCount: number;
    pushCount: number;
    bossSurvivorSnapshot: number | null;
    entryGear: Readonly<EscortEntryGear>;
    entryCompanion: Readonly<EscortEntryCompanion>;
    firstHazardGuardUsed: boolean;
    companionAnalysisUsed: boolean;
    companionTriageUsed: boolean;
    companionRole: string;
    choices: Readonly<Record<EscortCheckpointChoice, EscortCheckpointChoiceStatus>>;
  };
  falseTestimony?: FalseTestimonyStatus;
  combatReplay?: CombatReplayStatus;
  panopticon?: PanopticonStatus;
};

export type DungeonLawDisplayContext = {
  availableScrip?: number;
  availableGenesisSerum?: number;
  availableHealingPills?: number;
};

export type CausalLedgerAvailabilityInput = {
  canAffordRepayDamage?: boolean;
};

export type CausalLedgerChoiceStatus = {
  available: boolean;
  unavailableReason?: string;
};

export type CausalLedgerStatus = {
  available: boolean;
  pending: boolean;
  debt: number;
  pendingLedgerNodeId: string | null;
  settledLedgerNodeIds: readonly string[];
  bossDebtLocked: boolean;
  collectionSeals: number;
  repayDamagePercent: number;
  choices: Record<CausalLedgerChoice, CausalLedgerChoiceStatus>;
};

export type CausalLedgerEffect = {
  healPercent: number;
  rewardPoints: number;
  damagePercent: number;
};

export type CausalLedgerResolution = {
  state: DungeonLawState;
  choice: CausalLedgerChoice;
  resolved: boolean;
  effect: CausalLedgerEffect;
  unavailableReason?: string;
};

export type CausalCollectionSealConsumption = {
  state: DungeonLawState;
  consumed: boolean;
  finalDamageMultiplier: number;
};

export type EntropyHeadingChoiceStatus = {
  available: boolean;
  unavailableReason?: string;
};

export type EntropyHeadingStatus = {
  available: boolean;
  pending: boolean;
  entropy: number;
  pendingHeadingNodeId: string | null;
  resolvedHeadingChoices: Readonly<Record<string, EntropyHeadingChoice>>;
  bossEntropyLocked: boolean;
  collapseLayers: number;
  choices: Record<EntropyHeadingChoice, EntropyHeadingChoiceStatus>;
};

export type EntropyHeadingResolution = {
  state: DungeonLawState;
  choice: EntropyHeadingChoice;
  resolved: boolean;
  unavailableReason?: string;
};

export type MirrorCityPhaseChoiceStatus = {
  available: boolean;
  phaseChanged: boolean;
  damagePercent: number;
  unavailableReason?: string;
};

export type MirrorCityPhaseStatus = {
  available: boolean;
  pending: boolean;
  currentPhase: MirrorCityPhase;
  pendingPhaseNodeId: MirrorCityPhaseNodeId | null;
  resolvedPhaseChoices: Readonly<Partial<Record<MirrorCityPhaseNodeId, MirrorCityPhase>>>;
  resolvedChoiceCount: number;
  allChoicesResolved: boolean;
  anchors: Readonly<Record<MirrorCityPhase, boolean>>;
  bossAnchorSnapshot: Readonly<Record<MirrorCityPhase, boolean>> | null;
  choices: Record<MirrorCityPhase, MirrorCityPhaseChoiceStatus>;
};

export type MirrorCityPhaseResolution = {
  state: DungeonLawState;
  phase: MirrorCityPhase;
  resolved: boolean;
  phaseChanged: boolean;
  damagePercent: number;
  unavailableReason?: string;
};

export type MirrorCityShellStatus = {
  available: boolean;
  bossStarted: boolean;
  anchoredPhaseCount: number;
  prismCredit: number;
  totalShells: number;
  brokenMirrorShells: number;
  remainingShells: number;
};

export type MirrorCityShellConsumption = {
  state: DungeonLawState;
  consumed: boolean;
  finalDamageMultiplier: number;
};

export type RedactionChoiceStatus = {
  available: boolean;
  costPercent: number;
  unavailableReason?: string;
};

export type RedactionBossEffect = {
  defensePercent: number;
  artPowerPercent: number;
  healingPercent: number;
  guardEffectPercent: number;
};

export type RedactionBossEffectProjection = {
  sealed: RedactionBossEffect;
  awakened: RedactionBossEffect;
};

export type RedactionClauseStatus = {
  available: boolean;
  pending: boolean;
  pendingClauseNodeId: RedactionClauseNodeId | null;
  resolvedClauseChoices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>;
  bossClauseSnapshot: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>> | null;
  projectedClauseChoices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>;
  certifiedCount: number;
  redactedCount: number;
  resolvedCount: number;
  costPercent: 8;
  choices: Record<RedactionChoice, RedactionChoiceStatus>;
  projectedBossEffects: RedactionBossEffectProjection;
};

export type RedactionClauseResolution = {
  state: DungeonLawState;
  choice: RedactionChoice;
  resolved: boolean;
  costPercent: number;
  unavailableReason?: string;
};

export type AuctionLotChoiceStatus = {
  available: boolean;
  scripCost: number;
  unavailableReason?: string;
};

export type AuctionBossModifierProjection = {
  sealed: DungeonLawModifiers;
  awakened: DungeonLawModifiers;
};

export type AuctionLotStatus = {
  available: boolean;
  pending: boolean;
  availableScrip: number;
  pendingLotNodeId: AuctionLotNodeId | null;
  resolvedLotChoices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>;
  bossLotSnapshot: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>> | null;
  projectedLotChoices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>;
  resolvedCount: number;
  bidCount: number;
  burnCount: number;
  foldCount: number;
  allLotsResolved: boolean;
  currentCosts: Readonly<Record<AuctionLotChoice, number>>;
  choices: Record<AuctionLotChoice, AuctionLotChoiceStatus>;
  projectedBossModifiers: AuctionBossModifierProjection;
};

export type AuctionLotResolution = {
  state: DungeonLawState;
  choice: AuctionLotChoice;
  resolved: boolean;
  scripCost: number;
  unavailableReason?: string;
};

export type GenesisSpliceChoiceStatus = {
  available: boolean;
  serumCost: number;
  unavailableReason?: string;
};

export type GenesisModifierProjection = {
  sealed: DungeonLawModifiers;
  awakened: DungeonLawModifiers;
};

export type GenesisSpliceStatus = {
  available: boolean;
  pending: boolean;
  availableGenesisSerum: number;
  pendingSpliceNodeId: GenesisSpliceNodeId | null;
  spliceSequence: readonly GenesisGene[];
  uniqueCount: number;
  allResolved: boolean;
  bossGenomeSnapshot: readonly GenesisGene[] | null;
  choices: Record<GenesisGene, GenesisSpliceChoiceStatus>;
  projectedModifiers: GenesisModifierProjection;
};

export type GenesisSpliceResolution = {
  state: DungeonLawState;
  gene: GenesisGene;
  resolved: boolean;
  serumCost: number;
  unavailableReason?: string;
};

export type BroadcastRelayChoiceStatus = {
  available: boolean;
  noiseDelta: number;
  bonusRewardPoints: number;
  unavailableReason?: string;
};

export type BroadcastEntryPassiveReasons = Readonly<
  Record<keyof BroadcastEntryPassives, string>
>;

export type BroadcastRelayStatus = {
  available: boolean;
  pending: boolean;
  noise: number;
  pendingRelayNodeId: BroadcastRelayNodeId | null;
  resolvedRelayChoices: Readonly<Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>>>;
  resolvedCount: number;
  muteCount: number;
  broadcastCount: number;
  allRelaysResolved: boolean;
  bossNoiseSnapshot: number | null;
  entryPassives: Readonly<BroadcastEntryPassives>;
  firstClashMutedUsed: boolean;
  entryPassiveReasons: BroadcastEntryPassiveReasons;
  choices: Record<BroadcastRelayChoice, BroadcastRelayChoiceStatus>;
};

export type BroadcastRelayResolution = {
  state: DungeonLawState;
  choice: BroadcastRelayChoice;
  resolved: boolean;
  bonusRewardPoints: number;
  unavailableReason?: string;
};

export type EscortCheckpointChoiceStatus = {
  available: boolean;
  survivorHpDelta: number;
  healingPillCost: number;
  bonusRewardPoints: number;
  unavailableReason?: string;
};

export type EscortCheckpointStatus = {
  available: boolean;
  pending: boolean;
  survivorHp: number;
  availableHealingPills: number;
  pendingCheckpointNodeId: EscortCheckpointNodeId | null;
  resolvedCheckpointChoices: Readonly<Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>>>;
  resolvedCount: number;
  treatCount: number;
  pushCount: number;
  allCheckpointsResolved: boolean;
  bossSurvivorSnapshot: number | null;
  entryGear: Readonly<EscortEntryGear>;
  entryCompanion: Readonly<EscortEntryCompanion>;
  firstHazardGuardUsed: boolean;
  companionAnalysisUsed: boolean;
  companionTriageUsed: boolean;
  companionRole: string;
  choices: Record<EscortCheckpointChoice, EscortCheckpointChoiceStatus>;
};

export type EscortCheckpointResolution = {
  state: DungeonLawState;
  checkpointNodeId: string;
  choice: EscortCheckpointChoice;
  resolved: boolean;
  survivorHpDelta: number;
  healingPillCost: number;
  bonusRewardPoints: number;
  unavailableReason?: string;
};

export type FalseTestimonyEvidenceStatus = {
  id: FalseTestimonyEvidenceId;
  revealed: boolean;
  contaminated: boolean;
  trusted: boolean;
  eliminatedSuspect: FalseTestimonySuspect;
};

export type FalseTestimonyStatus = {
  evidence: readonly FalseTestimonyEvidenceStatus[];
  currentTrustedCount: number;
  eliminatedSuspects: readonly FalseTestimonySuspect[];
  pendingVerdictNodeId: FalseTestimonyPendingVerdictNodeId;
  accusedSuspect: FalseTestimonySuspect | null;
  accusationCorrect: boolean | null;
  accusationTrustedCount: number;
  appealUsed: boolean;
  appealEligible: boolean;
  projectedAccusationRewardPoints: number;
  bossVerdictSnapshot: Readonly<FalseTestimonyBossVerdictSnapshot> | null;
  entryGear: Readonly<FalseTestimonyEntryGear>;
  custodyProtectionUsed: boolean;
};

export type FalseTestimonyAccusationResolution = {
  state: DungeonLawState;
  suspect: FalseTestimonySuspect;
  resolved: boolean;
  correct: boolean;
  appealed: boolean;
  rewardPoints: number;
  unavailableReason?: string;
};

export type CombatReplayStatus = {
  takes: CombatReplayTakes;
  completedTakeCount: number;
  nextTakeNodeId: CombatReplayTakeNodeId | null;
  route: CombatReplayRoute | null;
  bossSnapshot: CombatReplayBossSnapshot | null;
  entryGear: Readonly<CombatReplayEntryGear>;
  readyForRoute: boolean;
  readyForBoss: boolean;
};

export type CombatReplayTakeResolution = {
  state: DungeonLawState;
  nodeId: CombatReplayTakeNodeId;
  recorded: boolean;
  unavailableReason?: string;
};

export type CombatReplayRouteResolution = {
  state: DungeonLawState;
  route: CombatReplayRoute;
  selected: boolean;
  unavailableReason?: string;
};

export type CombatReplayBossFreezeResult = {
  state: DungeonLawState;
  frozen: boolean;
  unavailableReason?: string;
};

export type PanopticonStatus = {
  scanPhase: PanopticonScanPhase;
  moveCount: number;
  exposureCount: number;
  relays: Readonly<PanopticonRelayState>;
  completedRelayCount: number;
  pendingRouteNodeId: PanopticonRelayNodeId | null;
  route: PanopticonRoute | null;
  refractionCharges: 0 | 1 | 2 | 3;
  decoyRewardsGranted: 0 | 1 | 2 | 3;
  bossSnapshot: Readonly<PanopticonBossSnapshot> | null;
  entryGear: Readonly<PanopticonEntryGear>;
  predictiveVisorProtectionUsed: readonly [boolean, boolean, boolean];
  readyForRoute: boolean;
  readyForBoss: boolean;
};

export type PanopticonScanAdvanceResult = {
  state: DungeonLawState;
  phaseBefore: PanopticonScanPhase;
  phaseAfter: PanopticonScanPhase;
  targetPhase: PanopticonScanPhase;
  scanned: boolean;
  exposed: boolean;
  evaded: boolean;
  damagePercent: 0 | 2 | 4 | 8;
  rewardPoints: 0 | 120;
  chargeGranted: boolean;
};

export type PanopticonRouteResolution = {
  state: DungeonLawState;
  route: PanopticonRoute;
  selected: boolean;
  unavailableReason?: string;
};

export type PanopticonBossFreezeResult = {
  state: DungeonLawState;
  frozen: boolean;
  unavailableReason?: string;
};

const TIDE_ORDER: readonly MetroTide[] = ['ebb', 'flood', 'mirror'];
const ARCHIVE_SEAL_ORDER: readonly ArchiveSealableFeature[] = ['consumable', 'method', 'pet'];
const OPENING_STYLES: readonly CombatOpeningStyle[] = ['force', 'art', 'guard'];
const ENTROPY_HEADING_CHOICES: readonly EntropyHeadingChoice[] = ['steady', 'rush'];
const MIRROR_CITY_PHASES: readonly MirrorCityPhase[] = ['real', 'mirror'];
const MIRROR_CITY_PHASE_NODE_IDS: readonly MirrorCityPhaseNodeId[] =
  DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds;
const REDACTION_CLAUSE_NODE_IDS: readonly RedactionClauseNodeId[] =
  DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds;
const REDACTION_CHOICES: readonly RedactionChoice[] = ['certify', 'redact'];
const AUCTION_LOT_NODE_IDS: readonly AuctionLotNodeId[] =
  DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds;
const AUCTION_LOT_CHOICES: readonly AuctionLotChoice[] = ['bid', 'burn', 'fold'];
const GENESIS_GENES: readonly GenesisGene[] = ['force', 'art', 'guard', 'renewal'];
const GENESIS_SPLICE_NODE_IDS: readonly GenesisSpliceNodeId[] =
  DUNGEON_LAW_LANDMARKS.genesis_vault.spliceNodeIds;
const BROADCAST_RELAY_NODE_IDS: readonly BroadcastRelayNodeId[] =
  DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds;
const BROADCAST_RELAY_CHOICES: readonly BroadcastRelayChoice[] = ['mute', 'broadcast'];
const ESCORT_CHECKPOINT_NODE_IDS: readonly EscortCheckpointNodeId[] =
  DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds;
const ESCORT_CHECKPOINT_CHOICES: readonly EscortCheckpointChoice[] = ['treat', 'push'];
const FALSE_TESTIMONY_EVIDENCE_IDS: readonly FalseTestimonyEvidenceId[] =
  DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds;
const FALSE_TESTIMONY_SUSPECTS: readonly FalseTestimonySuspect[] = [
  'records_keeper',
  'field_medic',
  'security_chief',
  'route_surveyor'
];
const COMBAT_REPLAY_ACTIONS: readonly CombatReplayAction[] = ['attack', 'art', 'guard'];
const COMBAT_REPLAY_ROUTES: readonly CombatReplayRoute[] = ['sequence', 'burst', 'afterbeat'];
const COMBAT_REPLAY_TAKE_NODE_IDS: readonly CombatReplayTakeNodeId[] =
  DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds;
const PANOPTICON_ROUTES: readonly PanopticonRoute[] = ['shadow', 'decoy', 'refraction'];
const PANOPTICON_RELAY_NODE_IDS: readonly PanopticonRelayNodeId[] =
  DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds;
export const FALSE_TESTIMONY_TRUE_CULPRIT = 'route_surveyor' as const;
export const FALSE_TESTIMONY_ACCUSATION_REWARD_POINTS = {
  1: 480,
  2: 320,
  3: 160
} as const;
export const FALSE_TESTIMONY_SABRE_REWARD_POINTS = 120 as const;
export const BROADCAST_RELAY_BONUS_REWARD_POINTS = 180 as const;
export const ESCORT_PUSH_BONUS_REWARD_POINTS = 200 as const;
const GENESIS_GEAR_BY_GENE: Readonly<Record<GenesisGene, keyof GenesisEntryGear>> = {
  force: 'helixCleaver',
  art: 'symbioteCowl',
  guard: 'carapaceHarness',
  renewal: 'rebirthAmulet'
};
const AUCTION_LOT_BY_NODE_ID: Readonly<Record<AuctionLotNodeId, AuctionLot>> = {
  force_lot_dais: 'force',
  guard_lot_dais: 'guard',
  art_lot_dais: 'art',
  return_lot_dais: 'return'
};
const AUCTION_PASSIVE_BY_LOT: Readonly<Record<AuctionLot, keyof LegacyAuctionEntryPassives>> = {
  force: 'legacyGavel',
  guard: 'escrowPlate',
  art: 'anonymousVeil',
  return: 'finalLotBell'
};
const EMPTY_CAUSAL_EFFECT: CausalLedgerEffect = { healPercent: 0, rewardPoints: 0, damagePercent: 0 };
const FALSE_TESTIMONY_EVIDENCE_BY_TRAP: Readonly<
  Record<FalseTestimonyTrapNodeId, FalseTestimonyEvidenceId>
> = {
  voice_filter_trap: 'voice_evidence',
  timeline_checksum_trap: 'timeline_evidence',
  residue_sterility_trap: 'residue_evidence'
};
const FALSE_TESTIMONY_ELIMINATION_BY_EVIDENCE: Readonly<
  Record<FalseTestimonyEvidenceId, FalseTestimonySuspect>
> = {
  voice_evidence: 'field_medic',
  timeline_evidence: 'security_chief',
  residue_evidence: 'records_keeper'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))];
}

function normalizeOptionalId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeCausalEntryPassives(value: unknown): CausalEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    causalVisor: nested.causalVisor === true,
    echoBreakerGauntlets: nested.echoBreakerGauntlets === true,
    returnAnchorBelt: nested.returnAnchorBelt === true
  };
}

function normalizeEntropyEntryPassives(value: unknown): EntropyEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    entropyCompass: nested.entropyCompass === true,
    dissipationMantle: nested.dissipationMantle === true,
    arkKeelBoots: nested.arkKeelBoots === true
  };
}

function normalizeMirrorCityEntryPassives(value: unknown): MirrorCityEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    parallaxVisor: nested.parallaxVisor === true,
    phaseweaveMantle: nested.phaseweaveMantle === true,
    homecomingPrism: nested.homecomingPrism === true
  };
}

function normalizeRedactionEntryPassives(value: unknown): RedactionEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    redlineEdge: nested.redlineEdge === true,
    palimpsestMantle: nested.palimpsestMantle === true,
    finalProofSeal: nested.finalProofSeal === true
  };
}

function normalizeLegacyAuctionEntryPassives(value: unknown): LegacyAuctionEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    legacyGavel: nested.legacyGavel === true,
    anonymousVeil: nested.anonymousVeil === true,
    escrowPlate: nested.escrowPlate === true,
    finalLotBell: nested.finalLotBell === true
  };
}

function normalizeBroadcastEntryPassives(value: unknown): BroadcastEntryPassives {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryPassives) ? candidate.entryPassives : candidate;
  return {
    hushblade: nested.hushblade === true,
    deadAirHeadset: nested.deadAirHeadset === true,
    anechoicMantle: nested.anechoicMantle === true,
    lastChannelBeacon: nested.lastChannelBeacon === true
  };
}

function isStrictBroadcastEntryPassives(value: unknown): value is BroadcastEntryPassives {
  if (!isRecord(value)) return false;
  return typeof value.hushblade === 'boolean' &&
    typeof value.deadAirHeadset === 'boolean' &&
    typeof value.anechoicMantle === 'boolean' &&
    typeof value.lastChannelBeacon === 'boolean';
}

function isBroadcastRelayNodeId(value: unknown): value is BroadcastRelayNodeId {
  return BROADCAST_RELAY_NODE_IDS.includes(value as BroadcastRelayNodeId);
}

function isBroadcastRelayChoice(value: unknown): value is BroadcastRelayChoice {
  return BROADCAST_RELAY_CHOICES.includes(value as BroadcastRelayChoice);
}

function normalizeStrictBroadcastRelayChoices(
  value: unknown,
  clearedNodeIds: readonly string[]
): Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>> | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.some((nodeId) => !isBroadcastRelayNodeId(nodeId))) return null;

  const normalized: Partial<Record<BroadcastRelayNodeId, BroadcastRelayChoice>> = {};
  for (const nodeId of keys) {
    const choice = value[nodeId];
    if (!isBroadcastRelayChoice(choice) || !clearedNodeIds.includes(nodeId)) return null;
    normalized[nodeId as BroadcastRelayNodeId] = choice;
  }
  return normalized;
}

function isStrictBroadcastLawData(
  value: unknown,
  clearedNodeIds: readonly string[]
): boolean {
  if (!isRecord(value) || value.kind !== 'silent_broadcast_tower') return false;
  const resolvedRelayChoices = normalizeStrictBroadcastRelayChoices(
    value.resolvedRelayChoices,
    clearedNodeIds
  );
  const validNoise = typeof value.noise === 'number' &&
    Number.isInteger(value.noise) &&
    value.noise >= 0 &&
    value.noise <= 6;
  const validSnapshot = value.bossNoiseSnapshot === null || (
    typeof value.bossNoiseSnapshot === 'number' &&
    Number.isInteger(value.bossNoiseSnapshot) &&
    value.bossNoiseSnapshot >= 0 &&
    value.bossNoiseSnapshot <= 6
  );
  const validPending = value.pendingRelayNodeId === null || (
    value.bossNoiseSnapshot === null &&
    isBroadcastRelayNodeId(value.pendingRelayNodeId) &&
    clearedNodeIds.includes(value.pendingRelayNodeId) &&
    resolvedRelayChoices !== null &&
    !Object.prototype.hasOwnProperty.call(resolvedRelayChoices, value.pendingRelayNodeId)
  );
  return validNoise &&
    validSnapshot &&
    validPending &&
    resolvedRelayChoices !== null &&
    isStrictBroadcastEntryPassives(value.entryPassives) &&
    typeof value.firstClashMutedUsed === 'boolean';
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === [...expectedKeys].sort()[index]);
}

function isCombatReplayAction(value: unknown): value is CombatReplayAction {
  return COMBAT_REPLAY_ACTIONS.includes(value as CombatReplayAction);
}

function isCombatReplayRoute(value: unknown): value is CombatReplayRoute {
  return COMBAT_REPLAY_ROUTES.includes(value as CombatReplayRoute);
}

function isCombatReplayTakeNodeId(value: unknown): value is CombatReplayTakeNodeId {
  return COMBAT_REPLAY_TAKE_NODE_IDS.includes(value as CombatReplayTakeNodeId);
}

function isCombatReplayValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9999;
}

function getCombatReplayValue(observedValue: number, frameEngraver: boolean): number {
  return frameEngraver
    ? Math.min(9999, Math.ceil(observedValue * 1.15))
    : observedValue;
}

function normalizeCombatReplayEntryGear(value: unknown): CombatReplayEntryGear {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryGear) ? candidate.entryGear : candidate;
  return {
    frameEngraver: nested.frameEngraver === true,
    cueVisor: nested.cueVisor === true,
    bufferPlate: nested.bufferPlate === true,
    thawMetronome: nested.thawMetronome === true
  };
}

function isStrictCombatReplayEntryGear(value: unknown): value is CombatReplayEntryGear {
  return isRecord(value) &&
    hasExactKeys(value, ['frameEngraver', 'cueVisor', 'bufferPlate', 'thawMetronome']) &&
    typeof value.frameEngraver === 'boolean' &&
    typeof value.cueVisor === 'boolean' &&
    typeof value.bufferPlate === 'boolean' &&
    typeof value.thawMetronome === 'boolean';
}

function isStrictCombatReplayTake(
  value: unknown,
  frameEngraver: boolean
): value is CombatReplayTake {
  return isRecord(value) &&
    hasExactKeys(value, ['action', 'observedValue', 'replayValue']) &&
    isCombatReplayAction(value.action) &&
    isCombatReplayValue(value.observedValue) &&
    isCombatReplayValue(value.replayValue) &&
    value.replayValue === getCombatReplayValue(value.observedValue, frameEngraver);
}

function isStrictCombatReplayTakes(
  value: unknown,
  frameEngraver: boolean
): value is CombatReplayTakes {
  if (!Array.isArray(value) || value.length !== 3 || Object.keys(value).length !== 3) return false;
  if (!value.every((take) => take === null || isStrictCombatReplayTake(take, frameEngraver))) {
    return false;
  }
  const firstMissing = value.findIndex((take) => take === null);
  return firstMissing === -1 || value.slice(firstMissing).every((take) => take === null);
}

function isCompleteCombatReplayTakes(takes: CombatReplayTakes): takes is CombatReplayCompleteTakes {
  return takes.every((take): take is CombatReplayTake => take !== null);
}

function cloneCombatReplayTake(take: CombatReplayTake): CombatReplayTake {
  return { ...take };
}

function cloneCombatReplayTakes(takes: CombatReplayTakes): CombatReplayTakes {
  return takes.map((take) => take ? cloneCombatReplayTake(take) : null) as CombatReplayTakes;
}

function isStrictCombatReplayBossSnapshot(
  value: unknown,
  takes: CombatReplayTakes,
  route: CombatReplayRoute | null,
  frameEngraver: boolean
): value is CombatReplayBossSnapshot | null {
  if (value === null) return true;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['takes', 'route']) ||
    !isCombatReplayRoute(value.route) ||
    !isStrictCombatReplayTakes(value.takes, frameEngraver) ||
    !isCompleteCombatReplayTakes(value.takes) ||
    !isCompleteCombatReplayTakes(takes) ||
    route === null || value.route !== route
  ) return false;
  return value.takes.every((take, index) => {
    const source = takes[index];
    return source !== null &&
      take.action === source.action &&
      take.observedValue === source.observedValue &&
      take.replayValue === source.replayValue;
  });
}

function isStrictCombatReplayLawData(value: unknown): boolean {
  if (!isRecord(value) || value.kind !== 'combat_replay_stage' || !hasExactKeys(value, [
    'kind', 'takes', 'route', 'bossSnapshot', 'entryGear'
  ]) || !isStrictCombatReplayEntryGear(value.entryGear)) return false;
  const entryGear = value.entryGear as CombatReplayEntryGear;
  if (!isStrictCombatReplayTakes(value.takes, entryGear.frameEngraver)) return false;
  const takes = value.takes as CombatReplayTakes;
  const route = value.route;
  if (route !== null && !isCombatReplayRoute(route)) return false;
  if (route !== null && !isCompleteCombatReplayTakes(takes)) return false;
  return isStrictCombatReplayBossSnapshot(
    value.bossSnapshot,
    takes,
    route as CombatReplayRoute | null,
    entryGear.frameEngraver
  );
}

function isPanopticonRoute(value: unknown): value is PanopticonRoute {
  return PANOPTICON_ROUTES.includes(value as PanopticonRoute);
}

function isPanopticonRelayNodeId(value: unknown): value is PanopticonRelayNodeId {
  return PANOPTICON_RELAY_NODE_IDS.includes(value as PanopticonRelayNodeId);
}

function normalizePanopticonEntryGear(value: unknown): PanopticonEntryGear {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryGear) ? candidate.entryGear : candidate;
  return {
    blindlineCutter: nested.blindlineCutter === true,
    predictiveVisor: nested.predictiveVisor === true,
    matteShell: nested.matteShell === true,
    inversePrism: nested.inversePrism === true
  };
}

function isStrictPanopticonEntryGear(value: unknown): value is PanopticonEntryGear {
  return isRecord(value) &&
    hasExactKeys(value, ['blindlineCutter', 'predictiveVisor', 'matteShell', 'inversePrism']) &&
    typeof value.blindlineCutter === 'boolean' &&
    typeof value.predictiveVisor === 'boolean' &&
    typeof value.matteShell === 'boolean' &&
    typeof value.inversePrism === 'boolean';
}

function createEmptyPanopticonRelays(): PanopticonRelayState {
  return {
    north_blind_relay: false,
    central_blind_relay: false,
    south_blind_relay: false
  };
}

function isStrictPanopticonRelays(value: unknown): value is PanopticonRelayState {
  return isRecord(value) &&
    hasExactKeys(value, PANOPTICON_RELAY_NODE_IDS) &&
    PANOPTICON_RELAY_NODE_IDS.every((nodeId) => typeof value[nodeId] === 'boolean');
}

function isStrictPanopticonProtection(value: unknown): value is [boolean, boolean, boolean] {
  return Array.isArray(value) &&
    value.length === 3 &&
    Object.keys(value).length === 3 &&
    value.every((entry) => typeof entry === 'boolean');
}

function isPanopticonCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPanopticonCharge(value: unknown): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function areAllPanopticonRelaysComplete(relays: PanopticonRelayState): boolean {
  return PANOPTICON_RELAY_NODE_IDS.every((nodeId) => relays[nodeId]);
}

function isStrictPanopticonBossSnapshot(
  value: unknown,
  route: PanopticonRoute | null,
  exposureCount: number,
  refractionCharges: 0 | 1 | 2 | 3,
  entryGear: PanopticonEntryGear
): value is PanopticonBossSnapshot | null {
  if (value === null) return true;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['route', 'exposureCount', 'refractionCharges']) ||
    !isPanopticonRoute(value.route) ||
    !isPanopticonCount(value.exposureCount) ||
    !isPanopticonCharge(value.refractionCharges) ||
    route === null ||
    value.route !== route
  ) return false;
  const maximumExposure = Math.max(0, exposureCount - Number(entryGear.inversePrism));
  const maximumCharges = Math.min(
    3,
    refractionCharges + Number(entryGear.inversePrism && route === 'refraction')
  );
  return value.exposureCount <= maximumExposure &&
    value.refractionCharges <= maximumCharges &&
    (value.route === 'refraction' || value.refractionCharges === 0);
}

function isStrictPanopticonLawData(value: unknown): boolean {
  if (!isRecord(value) || value.kind !== 'panopticon_city' || !hasExactKeys(value, [
    'kind',
    'scanPhase',
    'moveCount',
    'exposureCount',
    'relays',
    'pendingRouteNodeId',
    'route',
    'refractionCharges',
    'decoyRewardsGranted',
    'bossSnapshot',
    'entryGear',
    'predictiveVisorProtectionUsed'
  ])) return false;
  if (
    (value.scanPhase !== 0 && value.scanPhase !== 1 && value.scanPhase !== 2) ||
    !isPanopticonCount(value.moveCount) ||
    !isPanopticonCount(value.exposureCount) ||
    !isStrictPanopticonRelays(value.relays) ||
    !isPanopticonCharge(value.refractionCharges) ||
    !isPanopticonCharge(value.decoyRewardsGranted) ||
    !isStrictPanopticonEntryGear(value.entryGear) ||
    !isStrictPanopticonProtection(value.predictiveVisorProtectionUsed)
  ) return false;
  const relays = value.relays as PanopticonRelayState;
  const route = value.route;
  if (route !== null && !isPanopticonRoute(route)) return false;
  if (route !== null && !areAllPanopticonRelaysComplete(relays)) return false;
  if (value.pendingRouteNodeId !== null && (
    !isPanopticonRelayNodeId(value.pendingRouteNodeId) ||
    route !== null ||
    !areAllPanopticonRelaysComplete(relays) ||
    !relays[value.pendingRouteNodeId]
  )) return false;
  if (route === null && value.refractionCharges !== 0) return false;
  if (route !== 'decoy' && value.decoyRewardsGranted !== 0) return false;
  if (!value.entryGear.predictiveVisor && value.predictiveVisorProtectionUsed.some(Boolean)) return false;
  return isStrictPanopticonBossSnapshot(
    value.bossSnapshot,
    route as PanopticonRoute | null,
    value.exposureCount as number,
    value.refractionCharges as 0 | 1 | 2 | 3,
    value.entryGear as PanopticonEntryGear
  );
}

function isEscortCheckpointNodeId(value: unknown): value is EscortCheckpointNodeId {
  return ESCORT_CHECKPOINT_NODE_IDS.includes(value as EscortCheckpointNodeId);
}

function isEscortCheckpointChoice(value: unknown): value is EscortCheckpointChoice {
  return ESCORT_CHECKPOINT_CHOICES.includes(value as EscortCheckpointChoice);
}

function normalizeEscortEntryGear(value: unknown): EscortEntryGear {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryGear) ? candidate.entryGear : candidate;
  return {
    rescueCarbine: nested.rescueCarbine === true,
    triageVisor: nested.triageVisor === true,
    evacuationPlate: nested.evacuationPlate === true,
    blackboxBeacon: nested.blackboxBeacon === true
  };
}

function isStrictEscortEntryGear(value: unknown): value is EscortEntryGear {
  return isRecord(value) &&
    hasExactKeys(value, ['rescueCarbine', 'triageVisor', 'evacuationPlate', 'blackboxBeacon']) &&
    typeof value.rescueCarbine === 'boolean' &&
    typeof value.triageVisor === 'boolean' &&
    typeof value.evacuationPlate === 'boolean' &&
    typeof value.blackboxBeacon === 'boolean';
}

function normalizeEscortEntryCompanion(value: unknown): EscortEntryCompanion {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryCompanion) ? candidate.entryCompanion : candidate;
  if (nested.id === null && nested.rank === 0) return { id: null, rank: 0 };
  if (
    (nested.id === 'qin_che' || nested.id === 'zhou_yingxue' || nested.id === 'lu_guanlan') &&
    (nested.rank === 1 || nested.rank === 2 || nested.rank === 3)
  ) {
    return { id: nested.id, rank: nested.rank };
  }
  return { id: null, rank: 0 };
}

function isStrictEscortEntryCompanion(value: unknown): value is EscortEntryCompanion {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'rank'])) return false;
  return (value.id === null && value.rank === 0) || (
    (value.id === 'qin_che' || value.id === 'zhou_yingxue' || value.id === 'lu_guanlan') &&
    (value.rank === 1 || value.rank === 2 || value.rank === 3)
  );
}

function normalizeStrictEscortCheckpointChoices(
  value: unknown,
  clearedNodeIds: readonly string[]
): Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>> | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.some((nodeId) => !isEscortCheckpointNodeId(nodeId))) return null;
  const normalized: Partial<Record<EscortCheckpointNodeId, EscortCheckpointChoice>> = {};
  for (const nodeId of keys) {
    const choice = value[nodeId];
    if (!isEscortCheckpointChoice(choice) || !clearedNodeIds.includes(nodeId)) return null;
    normalized[nodeId as EscortCheckpointNodeId] = choice;
  }
  return normalized;
}

function isStrictEscortLawData(value: unknown, clearedNodeIds: readonly string[]): boolean {
  if (!isRecord(value) || value.kind !== 'lost_shelter') return false;
  if (!hasExactKeys(value, [
    'kind',
    'survivorHp',
    'pendingCheckpointNodeId',
    'resolvedCheckpointChoices',
    'bossSurvivorSnapshot',
    'entryGear',
    'entryCompanion',
    'firstHazardGuardUsed',
    'companionAnalysisUsed',
    'companionTriageUsed'
  ])) return false;
  const resolvedChoices = normalizeStrictEscortCheckpointChoices(
    value.resolvedCheckpointChoices,
    clearedNodeIds
  );
  const validHp = typeof value.survivorHp === 'number' &&
    Number.isInteger(value.survivorHp) && value.survivorHp >= 0 && value.survivorHp <= 100;
  const validSnapshot = value.bossSurvivorSnapshot === null || (
    typeof value.bossSurvivorSnapshot === 'number' &&
    Number.isInteger(value.bossSurvivorSnapshot) &&
    value.bossSurvivorSnapshot >= 0 && value.bossSurvivorSnapshot <= 100
  );
  const validPending = value.pendingCheckpointNodeId === null || (
    value.bossSurvivorSnapshot === null &&
    isEscortCheckpointNodeId(value.pendingCheckpointNodeId) &&
    clearedNodeIds.includes(value.pendingCheckpointNodeId) &&
    resolvedChoices !== null &&
    !Object.prototype.hasOwnProperty.call(resolvedChoices, value.pendingCheckpointNodeId)
  );
  const companion = value.entryCompanion;
  const validCompanionUsage = isStrictEscortEntryCompanion(companion) &&
    (value.firstHazardGuardUsed !== true || (companion.id === 'qin_che' && companion.rank >= 2)) &&
    (value.companionAnalysisUsed !== true || (companion.id === 'zhou_yingxue' && companion.rank >= 2)) &&
    (value.companionTriageUsed !== true || (companion.id === 'lu_guanlan' && companion.rank >= 2));
  return validHp && validSnapshot && validPending && resolvedChoices !== null &&
    isStrictEscortEntryGear(value.entryGear) &&
    validCompanionUsage &&
    typeof value.firstHazardGuardUsed === 'boolean' &&
    typeof value.companionAnalysisUsed === 'boolean' &&
    typeof value.companionTriageUsed === 'boolean';
}

function isFalseTestimonyEvidenceId(value: unknown): value is FalseTestimonyEvidenceId {
  return FALSE_TESTIMONY_EVIDENCE_IDS.includes(value as FalseTestimonyEvidenceId);
}

function isFalseTestimonyTrapNodeId(value: unknown): value is FalseTestimonyTrapNodeId {
  return DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds.includes(
    value as FalseTestimonyTrapNodeId
  );
}

function isFalseTestimonySuspect(value: unknown): value is FalseTestimonySuspect {
  return FALSE_TESTIMONY_SUSPECTS.includes(value as FalseTestimonySuspect);
}

function normalizeFalseTestimonyEntryGear(value: unknown): FalseTestimonyEntryGear {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryGear) ? candidate.entryGear : candidate;
  return {
    crossExaminerSabre: nested.crossExaminerSabre === true,
    forensicVisor: nested.forensicVisor === true,
    custodyShell: nested.custodyShell === true,
    appealSeal: nested.appealSeal === true
  };
}

function isStrictFalseTestimonyEntryGear(value: unknown): value is FalseTestimonyEntryGear {
  return isRecord(value) &&
    hasExactKeys(value, ['crossExaminerSabre', 'forensicVisor', 'custodyShell', 'appealSeal']) &&
    typeof value.crossExaminerSabre === 'boolean' &&
    typeof value.forensicVisor === 'boolean' &&
    typeof value.custodyShell === 'boolean' &&
    typeof value.appealSeal === 'boolean';
}

function strictFalseTestimonyEvidenceIds(value: unknown): FalseTestimonyEvidenceId[] | null {
  if (!Array.isArray(value) || new Set(value).size !== value.length) return null;
  return value.every(isFalseTestimonyEvidenceId) ? [...value] : null;
}

function getFalseTestimonyEliminatedSuspectsFromLaw(
  law: Extract<DungeonLawData, { kind: 'false_testimony_court' }>
): FalseTestimonySuspect[] {
  const eliminated = new Set<FalseTestimonySuspect>();
  if (law.entryGear.forensicVisor) eliminated.add('field_medic');
  for (const evidenceId of law.revealedEvidenceIds) {
    if (!law.contaminatedEvidenceIds.includes(evidenceId)) {
      eliminated.add(FALSE_TESTIMONY_ELIMINATION_BY_EVIDENCE[evidenceId]);
    }
  }
  return FALSE_TESTIMONY_SUSPECTS.filter((suspect) => eliminated.has(suspect));
}

function getFalseTestimonyCurrentTrustedCount(
  law: Extract<DungeonLawData, { kind: 'false_testimony_court' }>
): number {
  return law.revealedEvidenceIds.filter(
    (evidenceId) => !law.contaminatedEvidenceIds.includes(evidenceId)
  ).length;
}

function isStrictFalseTestimonySnapshot(
  value: unknown,
  law: Extract<DungeonLawData, { kind: 'false_testimony_court' }>
): boolean {
  if (value === null) return true;
  if (!isRecord(value) || !hasExactKeys(value, [
    'suspect', 'correct', 'trustedCount', 'appealed', 'eliminatedSuspects'
  ])) return false;
  const eliminatedSuspects = Array.isArray(value.eliminatedSuspects)
    ? value.eliminatedSuspects
    : null;
  if (
    !isFalseTestimonySuspect(value.suspect) ||
    typeof value.correct !== 'boolean' ||
    value.correct !== (value.suspect === FALSE_TESTIMONY_TRUE_CULPRIT) ||
    typeof value.trustedCount !== 'number' ||
    !Number.isInteger(value.trustedCount) ||
    value.trustedCount < 0 || value.trustedCount > 3 ||
    typeof value.appealed !== 'boolean' ||
    !eliminatedSuspects ||
    new Set(eliminatedSuspects).size !== eliminatedSuspects.length ||
    !eliminatedSuspects.every(isFalseTestimonySuspect)
  ) return false;
  const expectedEliminated = getFalseTestimonyEliminatedSuspectsFromLaw(law);
  return value.suspect === law.accusedSuspect &&
    value.correct === law.accusationCorrect &&
    value.trustedCount === law.accusationTrustedCount &&
    value.appealed === law.appealUsed &&
    eliminatedSuspects.length === expectedEliminated.length &&
    eliminatedSuspects.every((suspect, index) => suspect === expectedEliminated[index]);
}

function isStrictFalseTestimonyLawData(value: unknown, clearedNodeIds: readonly string[]): boolean {
  if (!isRecord(value) || value.kind !== 'false_testimony_court' || !hasExactKeys(value, [
    'kind',
    'revealedEvidenceIds',
    'contaminatedEvidenceIds',
    'pendingVerdictNodeId',
    'accusedSuspect',
    'accusationCorrect',
    'accusationTrustedCount',
    'appealUsed',
    'bossVerdictSnapshot',
    'entryGear',
    'custodyProtectionUsed'
  ])) return false;
  const revealedEvidenceIds = strictFalseTestimonyEvidenceIds(value.revealedEvidenceIds);
  const contaminatedEvidenceIds = strictFalseTestimonyEvidenceIds(value.contaminatedEvidenceIds);
  if (!revealedEvidenceIds || !contaminatedEvidenceIds ||
    !isStrictFalseTestimonyEntryGear(value.entryGear)) return false;
  if (!revealedEvidenceIds.every((evidenceId) => clearedNodeIds.includes(evidenceId))) return false;
  for (const evidenceId of contaminatedEvidenceIds) {
    const trapNodeId = DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds.find(
      (candidate) => FALSE_TESTIMONY_EVIDENCE_BY_TRAP[candidate] === evidenceId
    );
    if (!trapNodeId || !clearedNodeIds.includes(trapNodeId)) return false;
  }
  const accusedSuspect = value.accusedSuspect;
  const accusationCorrect = value.accusationCorrect;
  const accusationTrustedCount = value.accusationTrustedCount;
  const appealUsed = value.appealUsed;
  const pendingVerdictNodeId = value.pendingVerdictNodeId;
  const currentTrustedCount = revealedEvidenceIds.filter(
    (evidenceId) => !contaminatedEvidenceIds.includes(evidenceId)
  ).length;
  const validUnaccused = accusedSuspect === null && accusationCorrect === null &&
    accusationTrustedCount === 0 && appealUsed === false;
  const validAccused = isFalseTestimonySuspect(accusedSuspect) &&
    accusationCorrect === (accusedSuspect === FALSE_TESTIMONY_TRUE_CULPRIT) &&
    typeof accusationTrustedCount === 'number' && Number.isInteger(accusationTrustedCount) &&
    accusationTrustedCount >= 0 && accusationTrustedCount <= currentTrustedCount &&
    typeof appealUsed === 'boolean';
  if (!validUnaccused && !validAccused) return false;
  if (appealUsed === true && (
    !(value.entryGear as FalseTestimonyEntryGear).appealSeal ||
    !clearedNodeIds.includes('appeal_desk')
  )) return false;
  const validPending = pendingVerdictNodeId === null || (
    value.bossVerdictSnapshot === null &&
    pendingVerdictNodeId === 'verdict_chamber' &&
    validUnaccused &&
    revealedEvidenceIds.length >= 1 &&
    clearedNodeIds.includes('verdict_chamber')
  ) || (
    value.bossVerdictSnapshot === null &&
    pendingVerdictNodeId === 'appeal_desk' &&
    validAccused && accusationCorrect === false && appealUsed === false &&
    (value.entryGear as FalseTestimonyEntryGear).appealSeal &&
    clearedNodeIds.includes('appeal_desk') &&
    !clearedNodeIds.includes('false_verdict_vault')
  );
  if (!validPending || typeof value.custodyProtectionUsed !== 'boolean') return false;
  if (value.custodyProtectionUsed && (
    !(value.entryGear as FalseTestimonyEntryGear).custodyShell ||
    !DUNGEON_LAW_LANDMARKS.false_testimony_court.trapNodeIds.some((nodeId) =>
      clearedNodeIds.includes(nodeId)
    )
  )) return false;
  const law = value as unknown as Extract<DungeonLawData, { kind: 'false_testimony_court' }>;
  return isStrictFalseTestimonySnapshot(value.bossVerdictSnapshot, law);
}

function isGenesisGene(value: unknown): value is GenesisGene {
  return GENESIS_GENES.includes(value as GenesisGene);
}

function isGenesisSpliceNodeId(value: unknown): value is GenesisSpliceNodeId {
  return GENESIS_SPLICE_NODE_IDS.includes(value as GenesisSpliceNodeId);
}

function normalizeGenesisEntryGear(value: unknown): GenesisEntryGear {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryGear) ? candidate.entryGear : candidate;
  return {
    helixCleaver: nested.helixCleaver === true,
    symbioteCowl: nested.symbioteCowl === true,
    carapaceHarness: nested.carapaceHarness === true,
    rebirthAmulet: nested.rebirthAmulet === true
  };
}

function normalizeGenesisEntryBloodline(value: unknown): GenesisEntryBloodline {
  const candidate = isRecord(value) ? value : {};
  const nested = isRecord(candidate.entryBloodline) ? candidate.entryBloodline : candidate;
  const rank = nested.rank;
  if (nested.aspect === null && rank === 0) return { aspect: null, rank: 0 };
  if (isGenesisGene(nested.aspect) && (rank === 1 || rank === 2 || rank === 3)) {
    return { aspect: nested.aspect, rank };
  }
  return { aspect: null, rank: 0 };
}

function normalizeGenesisSequence(value: unknown): GenesisGene[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isGenesisGene).slice(0, 3);
}

function normalizeGenesisSnapshot(value: unknown): GenesisGene[] | null {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isGenesisGene)) return null;
  return [...value];
}

function isMirrorCityPhase(value: unknown): value is MirrorCityPhase {
  return MIRROR_CITY_PHASES.includes(value as MirrorCityPhase);
}

function isMirrorCityPhaseNodeId(value: unknown): value is MirrorCityPhaseNodeId {
  return MIRROR_CITY_PHASE_NODE_IDS.includes(value as MirrorCityPhaseNodeId);
}

function normalizeResolvedMirrorCityPhaseChoices(
  value: unknown
): Partial<Record<MirrorCityPhaseNodeId, MirrorCityPhase>> {
  if (!isRecord(value)) return {};
  const normalized: Partial<Record<MirrorCityPhaseNodeId, MirrorCityPhase>> = {};
  for (const nodeId of MIRROR_CITY_PHASE_NODE_IDS) {
    const phase = value[nodeId];
    if (isMirrorCityPhase(phase)) normalized[nodeId] = phase;
  }
  return normalized;
}

function isRedactionClauseNodeId(value: unknown): value is RedactionClauseNodeId {
  return REDACTION_CLAUSE_NODE_IDS.includes(value as RedactionClauseNodeId);
}

function isRedactionChoice(value: unknown): value is RedactionChoice {
  return REDACTION_CHOICES.includes(value as RedactionChoice);
}

function normalizeRedactionClauseChoices(
  value: unknown
): Partial<Record<RedactionClauseNodeId, RedactionChoice>> {
  if (!isRecord(value)) return {};
  const normalized: Partial<Record<RedactionClauseNodeId, RedactionChoice>> = {};
  for (const nodeId of REDACTION_CLAUSE_NODE_IDS) {
    const choice = value[nodeId];
    if (isRedactionChoice(choice)) normalized[nodeId] = choice;
  }
  return normalized;
}

function isCompleteRedactionClauseChoices(
  choices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>
): choices is Readonly<Record<RedactionClauseNodeId, RedactionChoice>> {
  return REDACTION_CLAUSE_NODE_IDS.every((nodeId) => isRedactionChoice(choices[nodeId]));
}

function isAuctionLotNodeId(value: unknown): value is AuctionLotNodeId {
  return AUCTION_LOT_NODE_IDS.includes(value as AuctionLotNodeId);
}

function isAuctionLotChoice(value: unknown): value is AuctionLotChoice {
  return AUCTION_LOT_CHOICES.includes(value as AuctionLotChoice);
}

function normalizeAuctionLotChoices(
  value: unknown
): Partial<Record<AuctionLotNodeId, AuctionLotChoice>> {
  if (!isRecord(value)) return {};
  const normalized: Partial<Record<AuctionLotNodeId, AuctionLotChoice>> = {};
  for (const nodeId of AUCTION_LOT_NODE_IDS) {
    const choice = value[nodeId];
    if (isAuctionLotChoice(choice)) normalized[nodeId] = choice;
  }
  return normalized;
}

function isCompleteAuctionLotChoices(
  choices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>
): choices is Readonly<Record<AuctionLotNodeId, AuctionLotChoice>> {
  return AUCTION_LOT_NODE_IDS.every((nodeId) => isAuctionLotChoice(choices[nodeId]));
}

function normalizeMirrorCityAnchors(value: unknown): Record<MirrorCityPhase, boolean> {
  const candidate = isRecord(value) ? value : {};
  return { real: candidate.real === true, mirror: candidate.mirror === true };
}

function getMirrorCityTotalShells(
  bossAnchorSnapshot: Readonly<Record<MirrorCityPhase, boolean>> | null,
  entryPassives: MirrorCityEntryPassives
): number {
  if (!bossAnchorSnapshot) return 0;
  const anchoredPhaseCount = Number(bossAnchorSnapshot.real) + Number(bossAnchorSnapshot.mirror);
  return Math.max(0, 2 - anchoredPhaseCount - Number(entryPassives.homecomingPrism));
}

function isEntropyHeadingChoice(value: unknown): value is EntropyHeadingChoice {
  return ENTROPY_HEADING_CHOICES.includes(value as EntropyHeadingChoice);
}

function normalizeResolvedHeadingChoices(value: unknown): Record<string, EntropyHeadingChoice> {
  if (!isRecord(value)) return {};
  const normalized: Record<string, EntropyHeadingChoice> = {};
  for (const nodeId of Object.keys(value).filter(Boolean).sort()) {
    const choice = value[nodeId];
    if (isEntropyHeadingChoice(choice)) normalized[nodeId] = choice;
  }
  return normalized;
}

function isOpeningStyle(value: unknown): value is CombatOpeningStyle {
  return OPENING_STYLES.includes(value as CombatOpeningStyle);
}

function normalizeCombatOpenings(value: unknown): Record<string, CombatOpeningRecord> {
  if (!isRecord(value)) return {};

  const normalized: Record<string, CombatOpeningRecord> = {};
  for (const nodeId of Object.keys(value).filter(Boolean).sort()) {
    const candidate = value[nodeId];
    if (!isRecord(candidate)) continue;
    normalized[nodeId] = {
      isBoss: candidate.isBoss === true,
      style: isOpeningStyle(candidate.style) ? candidate.style : null
    };
  }
  return normalized;
}

function isStrictCombatOpenings(value: unknown): value is Record<string, CombatOpeningRecord> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([nodeId, opening]) =>
    nodeId.length > 0 &&
    isRecord(opening) &&
    hasExactKeys(opening, ['isBoss', 'style']) &&
    typeof opening.isBoss === 'boolean' &&
    (opening.style === null || isOpeningStyle(opening.style))
  );
}

function createLawData(
  dungeonId: DungeonLawDungeonId,
  entryConfig: DungeonLawEntryConfig = {}
): DungeonLawData {
  if (dungeonId === PANOPTICON_CITY_DUNGEON_ID) {
    return {
      kind: 'panopticon_city',
      scanPhase: 0,
      moveCount: 0,
      exposureCount: 0,
      relays: createEmptyPanopticonRelays(),
      pendingRouteNodeId: null,
      route: null,
      refractionCharges: 0,
      decoyRewardsGranted: 0,
      bossSnapshot: null,
      entryGear: normalizePanopticonEntryGear(entryConfig.entryGear),
      predictiveVisorProtectionUsed: [false, false, false]
    };
  }
  if (dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID) {
    return {
      kind: 'combat_replay_stage',
      takes: [null, null, null],
      route: null,
      bossSnapshot: null,
      entryGear: normalizeCombatReplayEntryGear(entryConfig.entryGear)
    };
  }
  if (dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID) {
    return {
      kind: 'false_testimony_court',
      revealedEvidenceIds: [],
      contaminatedEvidenceIds: [],
      pendingVerdictNodeId: null,
      accusedSuspect: null,
      accusationCorrect: null,
      accusationTrustedCount: 0,
      appealUsed: false,
      bossVerdictSnapshot: null,
      entryGear: normalizeFalseTestimonyEntryGear(entryConfig.entryGear),
      custodyProtectionUsed: false
    };
  }
  if (dungeonId === LEGACY_AUCTION_COURT_DUNGEON_ID) {
    return {
      kind: 'legacy_auction_court',
      pendingLotNodeId: null,
      resolvedLotChoices: {},
      bossLotSnapshot: null,
      entryPassives: normalizeLegacyAuctionEntryPassives(entryConfig)
    };
  }
  if (dungeonId === GENESIS_VAULT_DUNGEON_ID) {
    return {
      kind: 'genesis_vault',
      pendingSpliceNodeId: null,
      spliceSequence: [],
      bossGenomeSnapshot: null,
      entryGear: normalizeGenesisEntryGear(entryConfig.entryGear),
      entryBloodline: normalizeGenesisEntryBloodline(entryConfig.entryBloodline)
    };
  }
  if (dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID) {
    return {
      kind: 'silent_broadcast_tower',
      noise: 0,
      pendingRelayNodeId: null,
      resolvedRelayChoices: {},
      bossNoiseSnapshot: null,
      entryPassives: normalizeBroadcastEntryPassives(entryConfig),
      firstClashMutedUsed: false
    };
  }
  if (dungeonId === LOST_SHELTER_DUNGEON_ID) {
    return {
      kind: 'lost_shelter',
      survivorHp: 100,
      pendingCheckpointNodeId: null,
      resolvedCheckpointChoices: {},
      bossSurvivorSnapshot: null,
      entryGear: normalizeEscortEntryGear(entryConfig.entryGear),
      entryCompanion: normalizeEscortEntryCompanion(entryConfig.entryCompanion),
      firstHazardGuardUsed: false,
      companionAnalysisUsed: false,
      companionTriageUsed: false
    };
  }
  switch (dungeonId) {
    case 'demon_tower_1':
      return { kind: 'demon_tower', fogPressure: 0 };
    case 'metro_abyss':
      return { kind: 'metro_abyss', tide: 'ebb' };
    case 'starfall_mine':
      return { kind: 'starfall_mine', gravity: 'upward' };
    case 'rust_hospital':
      return { kind: 'rust_hospital', pollution: 0 };
    case 'ash_arena':
      return { kind: 'ash_arena' };
    case 'dream_archive':
      return { kind: 'dream_archive', sealedFeatures: [] };
    case 'void_citadel':
      return { kind: 'void_citadel', bossAssessmentLocked: false, bossCounter: null };
    case 'temporal_observatory':
      return { kind: 'temporal_observatory', pastCalibrated: false, futureCalibrated: false };
    case 'causal_clearinghouse':
      return {
        kind: 'causal_clearinghouse',
        debt: 0,
        pendingLedgerNodeId: null,
        settledLedgerNodeIds: [],
        bossDebtLocked: false,
        collectionSeals: 0,
        entryPassives: normalizeCausalEntryPassives(entryConfig),
        visorCreditUsed: false
      };
    case 'entropy_ark':
      return {
        kind: 'entropy_ark',
        entropy: 2,
        pendingHeadingNodeId: null,
        resolvedHeadingChoices: {},
        bossEntropyLocked: false,
        collapseLayers: 0,
        entryPassives: normalizeEntropyEntryPassives(entryConfig),
        compassCreditUsed: false
      };
    case 'mirror_cycle_city':
      return {
        kind: 'mirror_cycle_city',
        currentPhase: 'real',
        pendingPhaseNodeId: null,
        resolvedPhaseChoices: {},
        anchors: { real: false, mirror: false },
        bossAnchorSnapshot: null,
        brokenMirrorShells: 0,
        entryPassives: normalizeMirrorCityEntryPassives(entryConfig)
      };
    case 'redaction_scriptorium':
      return {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId: null,
        resolvedClauseChoices: {},
        bossClauseSnapshot: null,
        entryPassives: normalizeRedactionEntryPassives(entryConfig)
      };
  }
}

function normalizeLawData(
  value: unknown,
  dungeonId: DungeonLawDungeonId,
  clearedNodeIds: readonly string[] = []
): DungeonLawData {
  const candidate = isRecord(value) ? value : {};

  if (dungeonId === PANOPTICON_CITY_DUNGEON_ID) {
    const fallback = createLawData(dungeonId);
    if (!isStrictPanopticonLawData(candidate)) return fallback;
    const law = candidate as unknown as Extract<DungeonLawData, { kind: 'panopticon_city' }>;
    return {
      kind: 'panopticon_city',
      scanPhase: law.scanPhase,
      moveCount: law.moveCount,
      exposureCount: law.exposureCount,
      relays: { ...law.relays },
      pendingRouteNodeId: law.pendingRouteNodeId,
      route: law.route,
      refractionCharges: law.refractionCharges,
      decoyRewardsGranted: law.decoyRewardsGranted,
      bossSnapshot: law.bossSnapshot ? { ...law.bossSnapshot } : null,
      entryGear: { ...law.entryGear },
      predictiveVisorProtectionUsed: [...law.predictiveVisorProtectionUsed]
    };
  }

  if (dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID) {
    const fallback = createLawData(dungeonId);
    if (!isStrictCombatReplayLawData(candidate)) return fallback;
    const law = candidate as unknown as Extract<DungeonLawData, { kind: 'combat_replay_stage' }>;
    return {
      kind: 'combat_replay_stage',
      takes: cloneCombatReplayTakes(law.takes),
      route: law.route,
      bossSnapshot: law.bossSnapshot
        ? {
            takes: cloneCombatReplayTakes(law.bossSnapshot.takes) as CombatReplayCompleteTakes,
            route: law.bossSnapshot.route
          }
        : null,
      entryGear: { ...law.entryGear }
    };
  }

  if (dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID) {
    const fallback = createLawData(dungeonId);
    if (!isStrictFalseTestimonyLawData(candidate, clearedNodeIds)) return fallback;
    const law = candidate as unknown as Extract<DungeonLawData, { kind: 'false_testimony_court' }>;
    return {
      ...law,
      revealedEvidenceIds: [...law.revealedEvidenceIds],
      contaminatedEvidenceIds: [...law.contaminatedEvidenceIds],
      entryGear: { ...law.entryGear },
      bossVerdictSnapshot: law.bossVerdictSnapshot
        ? {
            ...law.bossVerdictSnapshot,
            eliminatedSuspects: [...law.bossVerdictSnapshot.eliminatedSuspects]
          }
        : null
    };
  }

  if (dungeonId === LEGACY_AUCTION_COURT_DUNGEON_ID) {
    let resolvedLotChoices = normalizeAuctionLotChoices(candidate.resolvedLotChoices);
    const snapshotWasPresent = candidate.bossLotSnapshot !== undefined &&
      candidate.bossLotSnapshot !== null;
    const normalizedSnapshot = normalizeAuctionLotChoices(candidate.bossLotSnapshot);
    const bossLotSnapshot = snapshotWasPresent
      ? isCompleteAuctionLotChoices(normalizedSnapshot)
        ? { ...normalizedSnapshot }
        : isCompleteAuctionLotChoices(resolvedLotChoices)
          ? { ...resolvedLotChoices }
          : null
      : null;
    if (bossLotSnapshot) resolvedLotChoices = { ...bossLotSnapshot };
    const requestedPendingLotNodeId = candidate.pendingLotNodeId;
    const pendingLotNodeId = bossLotSnapshot === null &&
      isAuctionLotNodeId(requestedPendingLotNodeId) &&
      !Object.prototype.hasOwnProperty.call(resolvedLotChoices, requestedPendingLotNodeId)
      ? requestedPendingLotNodeId
      : null;
    return {
      kind: 'legacy_auction_court',
      pendingLotNodeId,
      resolvedLotChoices,
      bossLotSnapshot,
      entryPassives: normalizeLegacyAuctionEntryPassives(candidate.entryPassives)
    };
  }
  if (dungeonId === GENESIS_VAULT_DUNGEON_ID) {
    let spliceSequence = normalizeGenesisSequence(candidate.spliceSequence);
    const snapshotWasPresent = candidate.bossGenomeSnapshot !== undefined &&
      candidate.bossGenomeSnapshot !== null;
    const normalizedSnapshot = normalizeGenesisSnapshot(candidate.bossGenomeSnapshot);
    const bossGenomeSnapshot = snapshotWasPresent
      ? normalizedSnapshot ?? (spliceSequence.length === 3 ? [...spliceSequence] : null)
      : null;
    if (bossGenomeSnapshot) spliceSequence = [...bossGenomeSnapshot];
    const requestedPendingSpliceNodeId = candidate.pendingSpliceNodeId;
    const clearedSpliceNodeIds = clearedNodeIds.filter(isGenesisSpliceNodeId);
    const resolvedSpliceNodeIds = new Set(clearedSpliceNodeIds.slice(0, spliceSequence.length));
    const pendingSpliceNodeId = bossGenomeSnapshot === null &&
      spliceSequence.length < 3 &&
      isGenesisSpliceNodeId(requestedPendingSpliceNodeId) &&
      clearedNodeIds.includes(requestedPendingSpliceNodeId) &&
      !resolvedSpliceNodeIds.has(requestedPendingSpliceNodeId)
      ? requestedPendingSpliceNodeId
      : null;
    return {
      kind: 'genesis_vault',
      pendingSpliceNodeId,
      spliceSequence,
      bossGenomeSnapshot,
      entryGear: normalizeGenesisEntryGear(candidate.entryGear),
      entryBloodline: normalizeGenesisEntryBloodline(candidate.entryBloodline)
    };
  }
  if (dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID) {
    const fallback = createLawData(dungeonId);
    if (!isStrictBroadcastLawData(candidate, clearedNodeIds)) return fallback;
    const resolvedRelayChoices = normalizeStrictBroadcastRelayChoices(
      candidate.resolvedRelayChoices,
      clearedNodeIds
    );
    const noise = candidate.noise;
    const pendingRelayNodeId = candidate.pendingRelayNodeId;
    const bossNoiseSnapshot = candidate.bossNoiseSnapshot;
    const validNoise = typeof noise === 'number' && Number.isInteger(noise) && noise >= 0 && noise <= 6;
    const validSnapshot = bossNoiseSnapshot === null || (
      typeof bossNoiseSnapshot === 'number' &&
      Number.isInteger(bossNoiseSnapshot) &&
      bossNoiseSnapshot >= 0 &&
      bossNoiseSnapshot <= 6
    );
    const validPending = pendingRelayNodeId === null || (
      bossNoiseSnapshot === null &&
      isBroadcastRelayNodeId(pendingRelayNodeId) &&
      clearedNodeIds.includes(pendingRelayNodeId) &&
      resolvedRelayChoices !== null &&
      !Object.prototype.hasOwnProperty.call(resolvedRelayChoices, pendingRelayNodeId)
    );
    if (
      !validNoise || !validSnapshot || !validPending || resolvedRelayChoices === null
    ) {
      return fallback;
    }
    return {
      kind: 'silent_broadcast_tower',
      noise,
      pendingRelayNodeId,
      resolvedRelayChoices,
      bossNoiseSnapshot,
      entryPassives: normalizeBroadcastEntryPassives(candidate.entryPassives),
      firstClashMutedUsed: candidate.firstClashMutedUsed === true
    };
  }
  if (dungeonId === LOST_SHELTER_DUNGEON_ID) {
    const fallback = createLawData(dungeonId);
    if (!isStrictEscortLawData(candidate, clearedNodeIds)) return fallback;
    const resolvedCheckpointChoices = normalizeStrictEscortCheckpointChoices(
      candidate.resolvedCheckpointChoices,
      clearedNodeIds
    );
    if (resolvedCheckpointChoices === null) return fallback;
    return {
      kind: 'lost_shelter',
      survivorHp: candidate.survivorHp as number,
      pendingCheckpointNodeId: candidate.pendingCheckpointNodeId as EscortCheckpointNodeId | null,
      resolvedCheckpointChoices,
      bossSurvivorSnapshot: candidate.bossSurvivorSnapshot as number | null,
      entryGear: { ...(candidate.entryGear as EscortEntryGear) },
      entryCompanion: { ...(candidate.entryCompanion as EscortEntryCompanion) },
      firstHazardGuardUsed: candidate.firstHazardGuardUsed as boolean,
      companionAnalysisUsed: candidate.companionAnalysisUsed as boolean,
      companionTriageUsed: candidate.companionTriageUsed as boolean
    };
  }

  switch (dungeonId) {
    case 'demon_tower_1':
      return { kind: 'demon_tower', fogPressure: boundedInteger(candidate.fogPressure, 0, 3, 0) };
    case 'metro_abyss':
      return {
        kind: 'metro_abyss',
        tide: TIDE_ORDER.includes(candidate.tide as MetroTide) ? (candidate.tide as MetroTide) : 'ebb'
      };
    case 'starfall_mine':
      return {
        kind: 'starfall_mine',
        gravity: candidate.gravity === 'downward' ? 'downward' : 'upward'
      };
    case 'rust_hospital':
      return { kind: 'rust_hospital', pollution: boundedInteger(candidate.pollution, 0, 4, 0) };
    case 'ash_arena':
      return { kind: 'ash_arena' };
    case 'dream_archive': {
      const requested = new Set(Array.isArray(candidate.sealedFeatures) ? candidate.sealedFeatures : []);
      return {
        kind: 'dream_archive',
        sealedFeatures: ARCHIVE_SEAL_ORDER.filter((feature) => requested.has(feature))
      };
    }
    case 'void_citadel': {
      const locked = candidate.bossAssessmentLocked === true;
      return {
        kind: 'void_citadel',
        bossAssessmentLocked: locked,
        bossCounter: locked && isOpeningStyle(candidate.bossCounter) ? candidate.bossCounter : null
      };
    }
    case 'temporal_observatory':
      return {
        kind: 'temporal_observatory',
        pastCalibrated: candidate.pastCalibrated === true,
        futureCalibrated: candidate.futureCalibrated === true
      };
    case 'causal_clearinghouse': {
      const debt = boundedInteger(candidate.debt, 0, 4, 0);
      const settledLedgerNodeIds = uniqueStrings(candidate.settledLedgerNodeIds);
      const requestedPendingLedgerNodeId = normalizeOptionalId(candidate.pendingLedgerNodeId);
      const pendingLedgerNodeId = requestedPendingLedgerNodeId &&
        !settledLedgerNodeIds.includes(requestedPendingLedgerNodeId)
        ? requestedPendingLedgerNodeId
        : null;
      const entryPassives = normalizeCausalEntryPassives(candidate.entryPassives ?? candidate);
      const bossDebtLocked = candidate.bossDebtLocked === true;
      const maximumSeals = bossDebtLocked
        ? Math.max(0, debt - Number(entryPassives.echoBreakerGauntlets))
        : 0;
      return {
        kind: 'causal_clearinghouse',
        debt,
        pendingLedgerNodeId,
        settledLedgerNodeIds,
        bossDebtLocked,
        collectionSeals: boundedInteger(candidate.collectionSeals, 0, maximumSeals, 0),
        entryPassives,
        visorCreditUsed: entryPassives.causalVisor && candidate.visorCreditUsed === true
      };
    }
    case 'entropy_ark': {
      const entropy = boundedInteger(candidate.entropy, 0, 4, 2);
      const resolvedHeadingChoices = normalizeResolvedHeadingChoices(candidate.resolvedHeadingChoices);
      const bossEntropyLocked = candidate.bossEntropyLocked === true;
      const requestedPendingHeadingNodeId = normalizeOptionalId(candidate.pendingHeadingNodeId);
      const pendingHeadingNodeId = !bossEntropyLocked && requestedPendingHeadingNodeId &&
        !Object.prototype.hasOwnProperty.call(resolvedHeadingChoices, requestedPendingHeadingNodeId)
        ? requestedPendingHeadingNodeId
        : null;
      const entryPassives = normalizeEntropyEntryPassives(candidate.entryPassives ?? candidate);
      return {
        kind: 'entropy_ark',
        entropy,
        pendingHeadingNodeId,
        resolvedHeadingChoices,
        bossEntropyLocked,
        collapseLayers: bossEntropyLocked
          ? boundedInteger(candidate.collapseLayers, 0, 2, 0)
          : 0,
        entryPassives,
        compassCreditUsed: entryPassives.entropyCompass && candidate.compassCreditUsed === true
      };
    }
    case 'mirror_cycle_city': {
      const currentPhase = isMirrorCityPhase(candidate.currentPhase) ? candidate.currentPhase : 'real';
      const resolvedPhaseChoices = normalizeResolvedMirrorCityPhaseChoices(candidate.resolvedPhaseChoices);
      const requestedPendingPhaseNodeId = candidate.pendingPhaseNodeId;
      const entryPassives = normalizeMirrorCityEntryPassives(candidate.entryPassives ?? candidate);
      const anchors = normalizeMirrorCityAnchors(candidate.anchors);
      const bossAnchorSnapshot = isRecord(candidate.bossAnchorSnapshot)
        ? normalizeMirrorCityAnchors(candidate.bossAnchorSnapshot)
        : null;
      const pendingPhaseNodeId = !bossAnchorSnapshot &&
        isMirrorCityPhaseNodeId(requestedPendingPhaseNodeId) &&
        !Object.prototype.hasOwnProperty.call(resolvedPhaseChoices, requestedPendingPhaseNodeId)
        ? requestedPendingPhaseNodeId
        : null;
      const totalShells = getMirrorCityTotalShells(bossAnchorSnapshot, entryPassives);
      return {
        kind: 'mirror_cycle_city',
        currentPhase,
        pendingPhaseNodeId,
        resolvedPhaseChoices,
        anchors,
        bossAnchorSnapshot,
        brokenMirrorShells: boundedInteger(candidate.brokenMirrorShells, 0, totalShells, 0),
        entryPassives
      };
    }
    case 'redaction_scriptorium': {
      let resolvedClauseChoices = normalizeRedactionClauseChoices(candidate.resolvedClauseChoices);
      const snapshotWasPresent = candidate.bossClauseSnapshot !== undefined &&
        candidate.bossClauseSnapshot !== null;
      const normalizedSnapshot = normalizeRedactionClauseChoices(candidate.bossClauseSnapshot);
      const bossClauseSnapshot = snapshotWasPresent
        ? isCompleteRedactionClauseChoices(normalizedSnapshot)
          ? { ...normalizedSnapshot }
          : isCompleteRedactionClauseChoices(resolvedClauseChoices)
            ? { ...resolvedClauseChoices }
            : null
        : null;
      if (bossClauseSnapshot) resolvedClauseChoices = { ...bossClauseSnapshot };
      const requestedPendingClauseNodeId = candidate.pendingClauseNodeId;
      const pendingClauseNodeId = bossClauseSnapshot === null &&
        isRedactionClauseNodeId(requestedPendingClauseNodeId) &&
        !Object.prototype.hasOwnProperty.call(resolvedClauseChoices, requestedPendingClauseNodeId)
        ? requestedPendingClauseNodeId
        : null;
      return {
        kind: 'redaction_scriptorium',
        pendingClauseNodeId,
        resolvedClauseChoices,
        bossClauseSnapshot,
        entryPassives: normalizeRedactionEntryPassives(candidate.entryPassives)
      };
    }
  }
}

export function createDungeonLawState(
  dungeonId: DungeonLawDungeonId,
  entryConfig: DungeonLawEntryConfig = {}
): DungeonLawState {
  return {
    rulesVersion: DUNGEON_LAW_STATE_VERSION,
    dungeonId,
    clearedNodeIds: [],
    resolvedEventIds: [],
    combatOpenings: {},
    combatVictoryNodeIds: [],
    law: createLawData(dungeonId, entryConfig)
  };
}

export function normalizeDungeonLawState(
  value: unknown,
  dungeonId: DungeonLawDungeonId
): DungeonLawState {
  if (
    dungeonId === 'redaction_scriptorium' ||
    dungeonId === LEGACY_AUCTION_COURT_DUNGEON_ID ||
    dungeonId === GENESIS_VAULT_DUNGEON_ID ||
    dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID ||
    dungeonId === LOST_SHELTER_DUNGEON_ID ||
    dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID ||
    dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID ||
    dungeonId === PANOPTICON_CITY_DUNGEON_ID
  ) {
    const candidate = isRecord(value) ? value : null;
    const law = candidate && isRecord(candidate.law) ? candidate.law : null;
    const expectedKind = dungeonId === PANOPTICON_CITY_DUNGEON_ID
      ? 'panopticon_city'
      : dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID
        ? 'combat_replay_stage'
      : dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID
      ? 'false_testimony_court'
      : dungeonId === LEGACY_AUCTION_COURT_DUNGEON_ID
      ? 'legacy_auction_court'
      : dungeonId === GENESIS_VAULT_DUNGEON_ID
        ? 'genesis_vault'
        : dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID
          ? 'silent_broadcast_tower'
          : dungeonId === LOST_SHELTER_DUNGEON_ID
            ? 'lost_shelter'
        : 'redaction_scriptorium';
    if (
      !candidate ||
      candidate.rulesVersion !== DUNGEON_LAW_STATE_VERSION ||
      candidate.dungeonId !== dungeonId ||
      !law ||
      law.kind !== expectedKind
    ) {
      return createDungeonLawState(dungeonId);
    }
    if (
      dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID ||
      dungeonId === LOST_SHELTER_DUNGEON_ID ||
      dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID ||
      dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID ||
      dungeonId === PANOPTICON_CITY_DUNGEON_ID
    ) {
      const strictStringArray = (array: unknown): array is string[] => Array.isArray(array) &&
        array.every((entry) => typeof entry === 'string' && entry.length > 0) &&
        new Set(array).size === array.length;
      const validTopLevelKeys = candidate && hasExactKeys(candidate, [
        'rulesVersion',
        'dungeonId',
        'clearedNodeIds',
        'resolvedEventIds',
        'combatOpenings',
        'combatVictoryNodeIds',
        'law'
      ]);
      if (
        !validTopLevelKeys ||
        !strictStringArray(candidate.clearedNodeIds) ||
        !strictStringArray(candidate.resolvedEventIds) ||
        !strictStringArray(candidate.combatVictoryNodeIds) ||
        !isStrictCombatOpenings(candidate.combatOpenings) ||
        (dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID
          ? !isStrictBroadcastLawData(law, candidate.clearedNodeIds)
          : dungeonId === LOST_SHELTER_DUNGEON_ID
            ? !isStrictEscortLawData(law, candidate.clearedNodeIds)
            : dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID
              ? !isStrictFalseTestimonyLawData(law, candidate.clearedNodeIds)
              : dungeonId === COMBAT_REPLAY_STAGE_DUNGEON_ID
                ? !isStrictCombatReplayLawData(law)
                : !isStrictPanopticonLawData(law))
      ) {
        return createDungeonLawState(dungeonId);
      }
    }
  }
  const candidate = isRecord(value) ? value : {};
  const clearedNodeIds = uniqueStrings(candidate.clearedNodeIds);
  const normalized: DungeonLawState = {
    rulesVersion: DUNGEON_LAW_STATE_VERSION,
    dungeonId,
    clearedNodeIds,
    resolvedEventIds: uniqueStrings(candidate.resolvedEventIds),
    combatOpenings: normalizeCombatOpenings(candidate.combatOpenings),
    combatVictoryNodeIds: uniqueStrings(candidate.combatVictoryNodeIds),
    law: normalizeLawData(candidate.law, dungeonId, clearedNodeIds)
  };

  if (normalized.law.kind === 'void_citadel' && normalized.law.bossAssessmentLocked) {
    normalized.law = {
      ...normalized.law,
      bossCounter: selectCitadelBossCounter(getCombatOpeningDistributionFromRecords(normalized))
    };
  }

  if (normalized.law.kind === 'silent_broadcast_tower') {
    const bossOpening = normalized.combatOpenings.last_broadcaster;
    const hasBossOpening = bossOpening?.isBoss === true;
    if (
      (normalized.law.bossNoiseSnapshot === null && hasBossOpening) ||
      (normalized.law.bossNoiseSnapshot !== null && !hasBossOpening)
    ) {
      return createDungeonLawState(dungeonId);
    }
  }

  if (normalized.law.kind === 'lost_shelter') {
    const bossOpening = normalized.combatOpenings.shelter_overseer;
    const hasBossOpening = bossOpening?.isBoss === true;
    if (
      (normalized.law.bossSurvivorSnapshot === null && hasBossOpening) ||
      (normalized.law.bossSurvivorSnapshot !== null && !hasBossOpening)
    ) {
      return createDungeonLawState(dungeonId);
    }
  }

  if (normalized.law.kind === 'false_testimony_court') {
    const bossOpening = normalized.combatOpenings.false_testimony_judge;
    const hasBossOpening = bossOpening?.isBoss === true;
    if (
      (normalized.law.bossVerdictSnapshot === null && hasBossOpening) ||
      (normalized.law.bossVerdictSnapshot !== null && !hasBossOpening)
    ) {
      return createDungeonLawState(dungeonId);
    }
  }

  return normalized;
}

function hasPositiveDamage(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function includesId(ids: readonly string[], id: string): boolean {
  return ids.includes(id);
}

function nextTide(tide: MetroTide): MetroTide {
  return TIDE_ORDER[(TIDE_ORDER.indexOf(tide) + 1) % TIDE_ORDER.length];
}

function openingStyleFor(action: CombatAction): CombatOpeningStyle | null {
  if (action === 'attack') return 'force';
  if (action === 'art') return 'art';
  if (action === 'guard') return 'guard';
  return null;
}

export function signalFirstNodeClear(state: DungeonLawState, signal: FirstNodeClearSignal): DungeonLawState {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const nodeId = signal.node.id;
  if (!nodeId || current.clearedNodeIds.includes(nodeId)) return current;

  const next: DungeonLawState = {
    ...current,
    clearedNodeIds: [...current.clearedNodeIds, nodeId]
  };

  switch (next.law.kind) {
    case 'demon_tower': {
      const dangerous = signal.node.type === 'monster' || signal.node.type === 'trap';
      const raised = dangerous && hasPositiveDamage(signal.damageTaken) ? 1 : 0;
      const relieved = includesId(DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefNodeIds, nodeId) ? 1 : 0;
      next.law = { ...next.law, fogPressure: clamp(next.law.fogPressure + raised - relieved, 0, 3) };
      break;
    }
    case 'metro_abyss':
      next.law = {
        ...next.law,
        tide: includesId(DUNGEON_LAW_LANDMARKS.metro_abyss.calibrationNodeIds, nodeId)
          ? 'ebb'
          : nextTide(next.law.tide)
      };
      break;
    case 'starfall_mine':
      if (includesId(DUNGEON_LAW_LANDMARKS.starfall_mine.gravitySwitchNodeIds, nodeId)) {
        next.law = { ...next.law, gravity: next.law.gravity === 'upward' ? 'downward' : 'upward' };
      }
      break;
    case 'rust_hospital': {
      const raised = hasPositiveDamage(signal.damageTaken) ? 1 : 0;
      const relieved = includesId(DUNGEON_LAW_LANDMARKS.rust_hospital.pharmacyNodeIds, nodeId) ? 1 : 0;
      next.law = { ...next.law, pollution: clamp(next.law.pollution + raised - relieved, 0, 4) };
      break;
    }
    case 'dream_archive': {
      if (includesId(DUNGEON_LAW_LANDMARKS.dream_archive.indexNodeIds, nodeId)) {
        next.law = { ...next.law, sealedFeatures: [] };
        break;
      }
      const dangerous = signal.node.type === 'monster' || signal.node.type === 'trap';
      const nextFeature = ARCHIVE_SEAL_ORDER[next.law.sealedFeatures.length];
      if (dangerous && nextFeature) {
        next.law = { ...next.law, sealedFeatures: [...next.law.sealedFeatures, nextFeature] };
      }
      break;
    }
    case 'temporal_observatory':
      if (includesId(DUNGEON_LAW_LANDMARKS.temporal_observatory.pastAnchorNodeIds, nodeId)) {
        next.law = { ...next.law, pastCalibrated: true };
      } else if (includesId(DUNGEON_LAW_LANDMARKS.temporal_observatory.futureAnchorNodeIds, nodeId)) {
        next.law = { ...next.law, futureCalibrated: true };
      }
      break;
    case 'causal_clearinghouse': {
      const opensLedger = (signal.node.type === 'monster' || signal.node.type === 'trap') &&
        nodeId !== 'zero_sum_auditor' &&
        next.law.pendingLedgerNodeId === null &&
        !next.law.settledLedgerNodeIds.includes(nodeId) &&
        !next.law.bossDebtLocked;
      if (opensLedger) next.law = { ...next.law, pendingLedgerNodeId: nodeId };
      break;
    }
    case 'entropy_ark': {
      if (next.law.bossEntropyLocked) break;
      const isHeadingConsole = includesId(
        DUNGEON_LAW_LANDMARKS.entropy_ark.headingConsoleNodeIds,
        nodeId
      );
      if (isHeadingConsole) {
        if (!Object.prototype.hasOwnProperty.call(next.law.resolvedHeadingChoices, nodeId)) {
          next.law = { ...next.law, pendingHeadingNodeId: nodeId };
        }
        break;
      }

      const dangerous = signal.node.type === 'monster' || signal.node.type === 'trap';
      if (dangerous && nodeId !== 'last_helmsman') {
        const usesCompassCredit = next.law.entryPassives.entropyCompass && !next.law.compassCreditUsed;
        next.law = {
          ...next.law,
          entropy: usesCompassCredit ? next.law.entropy : clamp(next.law.entropy + 1, 0, 4),
          compassCreditUsed: next.law.compassCreditUsed || usesCompassCredit
        };
      } else if (signal.node.type === 'reward') {
        next.law = { ...next.law, entropy: clamp(next.law.entropy - 1, 0, 4) };
      }
      break;
    }
    case 'mirror_cycle_city': {
      if (next.law.bossAnchorSnapshot) break;
      if (
        isMirrorCityPhaseNodeId(nodeId) &&
        !Object.prototype.hasOwnProperty.call(next.law.resolvedPhaseChoices, nodeId)
      ) {
        next.law = { ...next.law, pendingPhaseNodeId: nodeId };
        break;
      }
      if (
        includesId(DUNGEON_LAW_LANDMARKS.mirror_cycle_city.realAnchorNodeIds, nodeId) &&
        next.law.currentPhase === 'real'
      ) {
        next.law = { ...next.law, anchors: { ...next.law.anchors, real: true } };
      } else if (
        includesId(DUNGEON_LAW_LANDMARKS.mirror_cycle_city.mirrorAnchorNodeIds, nodeId) &&
        next.law.currentPhase === 'mirror'
      ) {
        next.law = { ...next.law, anchors: { ...next.law.anchors, mirror: true } };
      }
      break;
    }
    case 'redaction_scriptorium':
      if (
        next.law.bossClauseSnapshot === null &&
        isRedactionClauseNodeId(nodeId) &&
        !Object.prototype.hasOwnProperty.call(next.law.resolvedClauseChoices, nodeId)
      ) {
        next.law = { ...next.law, pendingClauseNodeId: nodeId };
      }
      break;
    case 'legacy_auction_court':
      if (
        next.law.bossLotSnapshot === null &&
        isAuctionLotNodeId(nodeId) &&
        !Object.prototype.hasOwnProperty.call(next.law.resolvedLotChoices, nodeId)
      ) {
        next.law = { ...next.law, pendingLotNodeId: nodeId };
      }
      break;
    case 'genesis_vault': {
      if (
        next.law.bossGenomeSnapshot === null &&
        next.law.pendingSpliceNodeId === null &&
        next.law.spliceSequence.length < 3 &&
        isGenesisSpliceNodeId(nodeId)
      ) {
        next.law = { ...next.law, pendingSpliceNodeId: nodeId };
      }
      break;
    }
    case 'silent_broadcast_tower': {
      if (
        next.law.bossNoiseSnapshot === null &&
        next.law.pendingRelayNodeId === null &&
        isBroadcastRelayNodeId(nodeId) &&
        !Object.prototype.hasOwnProperty.call(next.law.resolvedRelayChoices, nodeId)
      ) {
        next.law = { ...next.law, pendingRelayNodeId: nodeId };
        break;
      }

      const dangerous = signal.node.type === 'monster' || signal.node.type === 'trap';
      if (dangerous) {
        const usesHushblade = next.law.entryPassives.hushblade && !next.law.firstClashMutedUsed;
        next.law = {
          ...next.law,
          noise: usesHushblade ? next.law.noise : clamp(next.law.noise + 1, 0, 6),
          firstClashMutedUsed: next.law.firstClashMutedUsed || usesHushblade
        };
      }
      break;
    }
    case 'lost_shelter': {
      if (
        next.law.bossSurvivorSnapshot === null &&
        next.law.pendingCheckpointNodeId === null &&
        isEscortCheckpointNodeId(nodeId) &&
        !Object.prototype.hasOwnProperty.call(next.law.resolvedCheckpointChoices, nodeId)
      ) {
        next.law = { ...next.law, pendingCheckpointNodeId: nodeId };
        break;
      }

      if (next.law.survivorHp <= 0) break;
      const isMonster = signal.node.type === 'monster';
      const isTrap = signal.node.type === 'trap';
      if (!isMonster && !isTrap) break;
      const usesCompanionGuard = next.law.entryCompanion.id === 'qin_che' &&
        next.law.entryCompanion.rank >= 2 &&
        !next.law.firstHazardGuardUsed;
      const baseLoss = isMonster ? 10 : 15;
      const gearReduction = isMonster
        ? Number(next.law.entryGear.rescueCarbine) * 4
        : Number(next.law.entryGear.evacuationPlate) * 5;
      next.law = {
        ...next.law,
        survivorHp: usesCompanionGuard
          ? next.law.survivorHp
          : clamp(next.law.survivorHp - baseLoss + gearReduction, 0, 100),
        firstHazardGuardUsed: next.law.firstHazardGuardUsed || usesCompanionGuard
      };
      break;
    }
    case 'false_testimony_court': {
      if (next.law.bossVerdictSnapshot) break;
      if (isFalseTestimonyEvidenceId(nodeId)) {
        next.law = {
          ...next.law,
          revealedEvidenceIds: [...next.law.revealedEvidenceIds, nodeId]
        };
        break;
      }
      if (isFalseTestimonyTrapNodeId(nodeId) && hasPositiveDamage(signal.damageTaken)) {
        const evidenceId = FALSE_TESTIMONY_EVIDENCE_BY_TRAP[nodeId];
        if (next.law.revealedEvidenceIds.includes(evidenceId)) break;
        if (next.law.entryGear.custodyShell && !next.law.custodyProtectionUsed) {
          next.law = { ...next.law, custodyProtectionUsed: true };
        } else {
          next.law = {
            ...next.law,
            contaminatedEvidenceIds: [...next.law.contaminatedEvidenceIds, evidenceId]
          };
        }
        break;
      }
      if (
        nodeId === 'verdict_chamber' &&
        next.law.bossVerdictSnapshot === null &&
        next.law.accusedSuspect === null &&
        next.law.revealedEvidenceIds.length >= 1
      ) {
        next.law = { ...next.law, pendingVerdictNodeId: 'verdict_chamber' };
        break;
      }
      if (
        nodeId === 'appeal_desk' &&
        next.law.bossVerdictSnapshot === null &&
        next.law.accusationCorrect === false &&
        next.law.entryGear.appealSeal &&
        !next.law.appealUsed &&
        !next.clearedNodeIds.includes('false_verdict_vault')
      ) {
        next.law = { ...next.law, pendingVerdictNodeId: 'appeal_desk' };
      }
      break;
    }
    case 'combat_replay_stage':
      break;
    case 'panopticon_city': {
      if (
        next.law.bossSnapshot === null &&
        isPanopticonRelayNodeId(nodeId) &&
        !next.law.relays[nodeId]
      ) {
        const relays = { ...next.law.relays, [nodeId]: true };
        next.law = {
          ...next.law,
          relays,
          pendingRouteNodeId: areAllPanopticonRelaysComplete(relays) && next.law.route === null
            ? nodeId
            : next.law.pendingRouteNodeId
        };
      }
      break;
    }
  }

  return next;
}

export function signalDungeonEvent(state: DungeonLawState, signal: DungeonEventSignal): DungeonLawState {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (!signal.eventId || current.resolvedEventIds.includes(signal.eventId)) return current;

  const next: DungeonLawState = {
    ...current,
    resolvedEventIds: [...current.resolvedEventIds, signal.eventId]
  };

  switch (next.law.kind) {
    case 'demon_tower': {
      const raised = hasPositiveDamage(signal.outcome.damage) ? 1 : 0;
      const relieved = signal.outcome.success &&
        includesId(DUNGEON_LAW_LANDMARKS.demon_tower_1.reliefEventIds, signal.eventId)
        ? 1
        : 0;
      next.law = { ...next.law, fogPressure: clamp(next.law.fogPressure + raised - relieved, 0, 3) };
      break;
    }
    case 'rust_hospital': {
      const raised = hasPositiveDamage(signal.outcome.damage) ? 1 : 0;
      const relieved = signal.outcome.success &&
        includesId(DUNGEON_LAW_LANDMARKS.rust_hospital.triageEventIds, signal.eventId)
        ? 1
        : 0;
      next.law = { ...next.law, pollution: clamp(next.law.pollution + raised - relieved, 0, 4) };
      break;
    }
    case 'dream_archive':
      if (
        signal.outcome.success &&
        includesId(DUNGEON_LAW_LANDMARKS.dream_archive.indexEventIds, signal.eventId)
      ) {
        next.law = { ...next.law, sealedFeatures: [] };
      }
      break;
  }

  return next;
}

function unavailableCausalChoice(unavailableReason: string): CausalLedgerChoiceStatus {
  return { available: false, unavailableReason };
}

export function getCausalLedgerStatus(
  state: DungeonLawState,
  input: CausalLedgerAvailabilityInput = {}
): CausalLedgerStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'causal_clearinghouse') {
    const unavailable = unavailableCausalChoice('当前副本没有因果账本。');
    return {
      available: false,
      pending: false,
      debt: 0,
      pendingLedgerNodeId: null,
      settledLedgerNodeIds: [],
      bossDebtLocked: false,
      collectionSeals: 0,
      repayDamagePercent: 15,
      choices: { balance: unavailable, overdraw: unavailable, repay: unavailable }
    };
  }

  const law = current.law;
  const pending = law.pendingLedgerNodeId !== null;
  const commonUnavailableReason = !pending
    ? '当前没有待平账的因果账本。'
    : law.bossDebtLocked
      ? '首领追缴已经冻结因果债，不能再改写账本。'
      : undefined;
  const balance = commonUnavailableReason
    ? unavailableCausalChoice(commonUnavailableReason)
    : { available: true };
  const overdraw = commonUnavailableReason
    ? unavailableCausalChoice(commonUnavailableReason)
    : law.debt >= 4
      ? unavailableCausalChoice('因果债已达 4/4，无法继续透支。')
      : { available: true };
  const repay = commonUnavailableReason
    ? unavailableCausalChoice(commonUnavailableReason)
    : law.debt <= 0
      ? unavailableCausalChoice('当前没有可偿还的因果债。')
      : input.canAffordRepayDamage === false
        ? unavailableCausalChoice('当前生命不足以支付偿还伤害。')
        : { available: true };
  const choices: Record<CausalLedgerChoice, CausalLedgerChoiceStatus> = { balance, overdraw, repay };

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending,
    debt: law.debt,
    pendingLedgerNodeId: law.pendingLedgerNodeId,
    settledLedgerNodeIds: [...law.settledLedgerNodeIds],
    bossDebtLocked: law.bossDebtLocked,
    collectionSeals: law.collectionSeals,
    repayDamagePercent: law.entryPassives.returnAnchorBelt ? 8 : 15,
    choices
  };
}

export function resolveCausalLedgerChoice(
  state: DungeonLawState,
  choice: CausalLedgerChoice,
  input: CausalLedgerAvailabilityInput = {}
): CausalLedgerResolution {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const status = getCausalLedgerStatus(current, input);
  const choiceStatus = status.choices[choice];
  if (!choiceStatus?.available || current.law.kind !== 'causal_clearinghouse') {
    return {
      state: current,
      choice,
      resolved: false,
      effect: { ...EMPTY_CAUSAL_EFFECT },
      unavailableReason: choiceStatus?.unavailableReason ?? '这个账本选项不存在。'
    };
  }

  const pendingLedgerNodeId = current.law.pendingLedgerNodeId;
  if (pendingLedgerNodeId === null) {
    return {
      state: current,
      choice,
      resolved: false,
      effect: { ...EMPTY_CAUSAL_EFFECT },
      unavailableReason: '当前没有待平账的因果账本。'
    };
  }

  const settledLedgerNodeIds = current.law.settledLedgerNodeIds.includes(pendingLedgerNodeId)
    ? current.law.settledLedgerNodeIds
    : [...current.law.settledLedgerNodeIds, pendingLedgerNodeId];
  let debt = current.law.debt;
  let visorCreditUsed = current.law.visorCreditUsed;
  let effect = { ...EMPTY_CAUSAL_EFFECT };

  if (choice === 'overdraw') {
    const usesVisorCredit = current.law.entryPassives.causalVisor && !current.law.visorCreditUsed;
    if (!usesVisorCredit) debt = Math.min(4, debt + 1);
    visorCreditUsed = visorCreditUsed || usesVisorCredit;
    effect = { healPercent: 10, rewardPoints: 108, damagePercent: 0 };
  } else if (choice === 'repay') {
    debt = Math.max(0, debt - 1);
    effect = {
      healPercent: 0,
      rewardPoints: 0,
      damagePercent: current.law.entryPassives.returnAnchorBelt ? 8 : 15
    };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        debt,
        pendingLedgerNodeId: null,
        settledLedgerNodeIds,
        visorCreditUsed
      }
    },
    choice,
    resolved: true,
    effect
  };
}

function unavailableEntropyHeadingChoice(unavailableReason: string): EntropyHeadingChoiceStatus {
  return { available: false, unavailableReason };
}

export function getEntropyHeadingStatus(state: DungeonLawState): EntropyHeadingStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'entropy_ark') {
    const unavailable = unavailableEntropyHeadingChoice('当前副本没有方舟航向台。');
    return {
      available: false,
      pending: false,
      entropy: 2,
      pendingHeadingNodeId: null,
      resolvedHeadingChoices: {},
      bossEntropyLocked: false,
      collapseLayers: 0,
      choices: { steady: unavailable, rush: unavailable }
    };
  }

  const law = current.law;
  const pending = law.pendingHeadingNodeId !== null;
  const commonUnavailableReason = !pending
    ? '当前没有待指定的方舟航向。'
    : law.bossEntropyLocked
      ? '首领战已锁定熵值，不能再指定航向。'
      : undefined;
  const steady = commonUnavailableReason
    ? unavailableEntropyHeadingChoice(commonUnavailableReason)
    : law.entropy <= 0
      ? unavailableEntropyHeadingChoice('熵值已达 0/4，无法继续稳航降熵。')
      : { available: true };
  const rush = commonUnavailableReason
    ? unavailableEntropyHeadingChoice(commonUnavailableReason)
    : law.entropy >= 4
      ? unavailableEntropyHeadingChoice('熵值已达 4/4，无法继续抢航升熵。')
      : { available: true };
  const choices: Record<EntropyHeadingChoice, EntropyHeadingChoiceStatus> = { steady, rush };

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending,
    entropy: law.entropy,
    pendingHeadingNodeId: law.pendingHeadingNodeId,
    resolvedHeadingChoices: { ...law.resolvedHeadingChoices },
    bossEntropyLocked: law.bossEntropyLocked,
    collapseLayers: law.collapseLayers,
    choices
  };
}

export function resolveEntropyHeadingChoice(
  state: DungeonLawState,
  choice: EntropyHeadingChoice
): EntropyHeadingResolution {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const status = getEntropyHeadingStatus(current);
  const choiceStatus = status.choices[choice];
  if (!choiceStatus?.available || current.law.kind !== 'entropy_ark') {
    return {
      state: current,
      choice,
      resolved: false,
      unavailableReason: choiceStatus?.unavailableReason ?? '这个航向选项不存在。'
    };
  }

  const pendingHeadingNodeId = current.law.pendingHeadingNodeId;
  if (pendingHeadingNodeId === null) {
    return {
      state: current,
      choice,
      resolved: false,
      unavailableReason: '当前没有待指定的方舟航向。'
    };
  }

  const entropyDelta = choice === 'steady'
    ? current.law.entryPassives.dissipationMantle ? -2 : -1
    : 1;
  return {
    state: {
      ...current,
      law: {
        ...current.law,
        entropy: clamp(current.law.entropy + entropyDelta, 0, 4),
        pendingHeadingNodeId: null,
        resolvedHeadingChoices: {
          ...current.law.resolvedHeadingChoices,
          [pendingHeadingNodeId]: choice
        }
      }
    },
    choice,
    resolved: true
  };
}

function getBroadcastEntryPassiveReasons(
  entryPassives: BroadcastEntryPassives,
  firstClashMutedUsed: boolean
): BroadcastEntryPassiveReasons {
  return {
    hushblade: entryPassives.hushblade
      ? firstClashMutedUsed
        ? '断频长刃已抵消首次战斗或陷阱增噪。'
        : '断频长刃可抵消首次战斗或陷阱增噪。'
      : '未装备断频长刃。',
    deadAirHeadset: entryPassives.deadAirHeadset
      ? '死频耳罩使静默调谐额外降低 1 点噪声。'
      : '未装备死频耳罩。',
    anechoicMantle: entryPassives.anechoicMantle
      ? '消声披甲使敌方与陷阱的正向噪声惩罚减半。'
      : '未装备消声披甲。',
    lastChannelBeacon: entryPassives.lastChannelBeacon
      ? '末路断播器使首领噪声快照降低 1 点。'
      : '未装备末路断播器。'
  };
}

function unavailableBroadcastRelayChoice(unavailableReason: string): BroadcastRelayChoiceStatus {
  return { available: false, noiseDelta: 0, bonusRewardPoints: 0, unavailableReason };
}

export function getBroadcastRelayStatus(state: DungeonLawState): BroadcastRelayStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'silent_broadcast_tower') {
    const unavailable = unavailableBroadcastRelayChoice('当前副本没有广播中继。');
    const entryPassives = normalizeBroadcastEntryPassives({});
    return {
      available: false,
      pending: false,
      noise: 0,
      pendingRelayNodeId: null,
      resolvedRelayChoices: {},
      resolvedCount: 0,
      muteCount: 0,
      broadcastCount: 0,
      allRelaysResolved: false,
      bossNoiseSnapshot: null,
      entryPassives,
      firstClashMutedUsed: false,
      entryPassiveReasons: getBroadcastEntryPassiveReasons(entryPassives, false),
      choices: { mute: unavailable, broadcast: unavailable }
    };
  }

  const law = current.law;
  const resolvedChoices = Object.values(law.resolvedRelayChoices);
  const unavailableReason = law.bossNoiseSnapshot !== null
    ? '首领噪声已冻结，不能再调谐中继。'
    : law.pendingRelayNodeId === null
      ? '当前没有待调谐的广播中继。'
      : undefined;
  const muteDelta = clamp(
    law.noise - (law.entryPassives.deadAirHeadset ? 2 : 1),
    0,
    6
  ) - law.noise;
  const broadcastDelta = clamp(law.noise + 1, 0, 6) - law.noise;
  const choices: Record<BroadcastRelayChoice, BroadcastRelayChoiceStatus> = unavailableReason
    ? {
        mute: unavailableBroadcastRelayChoice(unavailableReason),
        broadcast: unavailableBroadcastRelayChoice(unavailableReason)
      }
    : {
        mute: { available: true, noiseDelta: muteDelta, bonusRewardPoints: 0 },
        broadcast: {
          available: true,
          noiseDelta: broadcastDelta,
          bonusRewardPoints: BROADCAST_RELAY_BONUS_REWARD_POINTS
        }
      };

  return {
    available: unavailableReason === undefined,
    pending: law.pendingRelayNodeId !== null,
    noise: law.noise,
    pendingRelayNodeId: law.pendingRelayNodeId,
    resolvedRelayChoices: { ...law.resolvedRelayChoices },
    resolvedCount: resolvedChoices.length,
    muteCount: resolvedChoices.filter((choice) => choice === 'mute').length,
    broadcastCount: resolvedChoices.filter((choice) => choice === 'broadcast').length,
    allRelaysResolved: resolvedChoices.length === BROADCAST_RELAY_NODE_IDS.length,
    bossNoiseSnapshot: law.bossNoiseSnapshot,
    entryPassives: { ...law.entryPassives },
    firstClashMutedUsed: law.firstClashMutedUsed,
    entryPassiveReasons: getBroadcastEntryPassiveReasons(
      law.entryPassives,
      law.firstClashMutedUsed
    ),
    choices
  };
}

export function resolveBroadcastRelayChoice(
  state: DungeonLawState,
  choice: BroadcastRelayChoice
): BroadcastRelayResolution {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (!isBroadcastRelayChoice(choice)) {
    return {
      state: current,
      choice,
      resolved: false,
      bonusRewardPoints: 0,
      unavailableReason: '未知的广播中继选择。'
    };
  }
  const status = getBroadcastRelayStatus(current);
  const choiceStatus = status.choices[choice];
  if (
    current.law.kind !== 'silent_broadcast_tower' ||
    current.law.pendingRelayNodeId === null ||
    !choiceStatus.available
  ) {
    return {
      state: current,
      choice,
      resolved: false,
      bonusRewardPoints: 0,
      unavailableReason: choiceStatus.unavailableReason
    };
  }

  const pendingRelayNodeId = current.law.pendingRelayNodeId;
  const bonusRewardPoints = choice === 'broadcast'
    ? BROADCAST_RELAY_BONUS_REWARD_POINTS
    : 0;
  return {
    state: {
      ...current,
      law: {
        ...current.law,
        noise: clamp(current.law.noise + choiceStatus.noiseDelta, 0, 6),
        pendingRelayNodeId: null,
        resolvedRelayChoices: {
          ...current.law.resolvedRelayChoices,
          [pendingRelayNodeId]: choice
        }
      }
    },
    choice,
    resolved: true,
    bonusRewardPoints
  };
}

function normalizeAvailableHealingPills(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function getEscortCompanionRole(companion: EscortEntryCompanion): string {
  if (companion.id === 'qin_che') return companion.rank >= 2 ? '秦彻：首次险情护卫' : '秦彻：随队警戒';
  if (companion.id === 'zhou_yingxue') return companion.rank >= 2 ? '周映雪：首次强推研判' : '周映雪：路线研判';
  if (companion.id === 'lu_guanlan') return companion.rank >= 2 ? '陆观澜：首次免药分诊' : '陆观澜：伤情分诊';
  return '无同伴职责';
}

function unavailableEscortChoice(
  unavailableReason: string,
  survivorHpDelta = 0,
  healingPillCost = 0
): EscortCheckpointChoiceStatus {
  return {
    available: false,
    survivorHpDelta,
    healingPillCost,
    bonusRewardPoints: 0,
    unavailableReason
  };
}

export function getEscortCheckpointStatus(
  state: DungeonLawState,
  availablePills: number
): EscortCheckpointStatus {
  const availableHealingPills = normalizeAvailableHealingPills(availablePills);
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'lost_shelter') {
    const unavailable = unavailableEscortChoice('当前副本没有幸存者护送检查点。');
    const entryGear = normalizeEscortEntryGear({});
    const entryCompanion = normalizeEscortEntryCompanion({});
    return {
      available: false,
      pending: false,
      survivorHp: 100,
      availableHealingPills,
      pendingCheckpointNodeId: null,
      resolvedCheckpointChoices: {},
      resolvedCount: 0,
      treatCount: 0,
      pushCount: 0,
      allCheckpointsResolved: false,
      bossSurvivorSnapshot: null,
      entryGear,
      entryCompanion,
      firstHazardGuardUsed: false,
      companionAnalysisUsed: false,
      companionTriageUsed: false,
      companionRole: getEscortCompanionRole(entryCompanion),
      choices: { treat: unavailable, push: unavailable }
    };
  }

  const law = current.law;
  const resolvedChoices = Object.values(law.resolvedCheckpointChoices);
  const pendingReason = law.bossSurvivorSnapshot !== null
    ? '首领战幸存者状态已冻结。'
    : law.pendingCheckpointNodeId === null
      ? '当前没有待处理的护送检查点。'
      : undefined;
  const usesTriage = law.entryCompanion.id === 'lu_guanlan' &&
    law.entryCompanion.rank >= 2 &&
    !law.companionTriageUsed;
  const treatCost = usesTriage ? 0 : 1;
  const treatGain = 25 + Number(usesTriage) * 10 + Number(law.entryGear.triageVisor) * 10;
  const treatDelta = clamp(law.survivorHp + treatGain, 0, 100) - law.survivorHp;
  const usesAnalysis = law.entryCompanion.id === 'zhou_yingxue' &&
    law.entryCompanion.rank >= 2 &&
    !law.companionAnalysisUsed;
  const pushDelta = clamp(law.survivorHp - (usesAnalysis ? 0 : 10), 0, 100) - law.survivorHp;

  let treat: EscortCheckpointChoiceStatus;
  if (pendingReason) {
    treat = unavailableEscortChoice(pendingReason);
  } else if (law.survivorHp <= 0) {
    treat = unavailableEscortChoice('幸存者已经死亡，无法复活。');
  } else if (law.survivorHp >= 100) {
    treat = unavailableEscortChoice('幸存者生命已经全满。');
  } else if (availableHealingPills < treatCost) {
    treat = unavailableEscortChoice('当前 run 没有止血丹。', treatDelta, treatCost);
  } else {
    treat = {
      available: true,
      survivorHpDelta: treatDelta,
      healingPillCost: treatCost,
      bonusRewardPoints: 0
    };
  }
  const push = pendingReason
    ? unavailableEscortChoice(pendingReason)
    : {
        available: true,
        survivorHpDelta: pushDelta,
        healingPillCost: 0,
        bonusRewardPoints: ESCORT_PUSH_BONUS_REWARD_POINTS
      };

  return {
    available: treat.available || push.available,
    pending: law.pendingCheckpointNodeId !== null,
    survivorHp: law.survivorHp,
    availableHealingPills,
    pendingCheckpointNodeId: law.pendingCheckpointNodeId,
    resolvedCheckpointChoices: { ...law.resolvedCheckpointChoices },
    resolvedCount: resolvedChoices.length,
    treatCount: resolvedChoices.filter((choice) => choice === 'treat').length,
    pushCount: resolvedChoices.filter((choice) => choice === 'push').length,
    allCheckpointsResolved: resolvedChoices.length === ESCORT_CHECKPOINT_NODE_IDS.length,
    bossSurvivorSnapshot: law.bossSurvivorSnapshot,
    entryGear: { ...law.entryGear },
    entryCompanion: { ...law.entryCompanion },
    firstHazardGuardUsed: law.firstHazardGuardUsed,
    companionAnalysisUsed: law.companionAnalysisUsed,
    companionTriageUsed: law.companionTriageUsed,
    companionRole: getEscortCompanionRole(law.entryCompanion),
    choices: { treat, push }
  };
}

export function resolveEscortCheckpointChoice(
  state: DungeonLawState,
  checkpointNodeId: string,
  choice: EscortCheckpointChoice,
  availablePills: number
): EscortCheckpointResolution {
  const failed = (unavailableReason: string): EscortCheckpointResolution => ({
    state,
    checkpointNodeId,
    choice,
    resolved: false,
    survivorHpDelta: 0,
    healingPillCost: 0,
    bonusRewardPoints: 0,
    unavailableReason
  });
  if (!isEscortCheckpointChoice(choice)) return failed('未知的护送检查点选择。');
  if (
    state.law.kind !== 'lost_shelter' ||
    state.law.pendingCheckpointNodeId === null
  ) {
    return failed('当前没有待处理的护送检查点。');
  }
  if (state.law.pendingCheckpointNodeId !== checkpointNodeId) {
    return failed('只能处理当前待定的护送检查点。');
  }

  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (
    current.law.kind !== 'lost_shelter' ||
    current.law.pendingCheckpointNodeId !== checkpointNodeId
  ) {
    return failed('护送检查点状态无效。');
  }
  const choiceStatus = getEscortCheckpointStatus(current, availablePills).choices[choice];
  if (!choiceStatus.available) return failed(choiceStatus.unavailableReason ?? '当前选择不可用。');

  const usesAnalysis = choice === 'push' &&
    current.law.entryCompanion.id === 'zhou_yingxue' &&
    current.law.entryCompanion.rank >= 2 &&
    !current.law.companionAnalysisUsed;
  const usesTriage = choice === 'treat' &&
    current.law.entryCompanion.id === 'lu_guanlan' &&
    current.law.entryCompanion.rank >= 2 &&
    !current.law.companionTriageUsed;
  return {
    state: {
      ...current,
      law: {
        ...current.law,
        survivorHp: clamp(current.law.survivorHp + choiceStatus.survivorHpDelta, 0, 100),
        pendingCheckpointNodeId: null,
        resolvedCheckpointChoices: {
          ...current.law.resolvedCheckpointChoices,
          [checkpointNodeId]: choice
        },
        companionAnalysisUsed: current.law.companionAnalysisUsed || usesAnalysis,
        companionTriageUsed: current.law.companionTriageUsed || usesTriage
      }
    },
    checkpointNodeId,
    choice,
    resolved: true,
    survivorHpDelta: choiceStatus.survivorHpDelta,
    healingPillCost: choiceStatus.healingPillCost,
    bonusRewardPoints: choiceStatus.bonusRewardPoints
  };
}

function getFalseTestimonyAccusationReward(
  trustedCount: number,
  hasSabre: boolean
): number {
  const base = FALSE_TESTIMONY_ACCUSATION_REWARD_POINTS[
    trustedCount as keyof typeof FALSE_TESTIMONY_ACCUSATION_REWARD_POINTS
  ] ?? 0;
  return base > 0 ? base + Number(hasSabre) * FALSE_TESTIMONY_SABRE_REWARD_POINTS : 0;
}

export function getFalseTestimonyStatus(state: DungeonLawState): FalseTestimonyStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const fallbackGear = normalizeFalseTestimonyEntryGear({});
  if (current.law.kind !== 'false_testimony_court') {
    return {
      evidence: FALSE_TESTIMONY_EVIDENCE_IDS.map((id) => ({
        id,
        revealed: false,
        contaminated: false,
        trusted: false,
        eliminatedSuspect: FALSE_TESTIMONY_ELIMINATION_BY_EVIDENCE[id]
      })),
      currentTrustedCount: 0,
      eliminatedSuspects: [],
      pendingVerdictNodeId: null,
      accusedSuspect: null,
      accusationCorrect: null,
      accusationTrustedCount: 0,
      appealUsed: false,
      appealEligible: false,
      projectedAccusationRewardPoints: 0,
      bossVerdictSnapshot: null,
      entryGear: fallbackGear,
      custodyProtectionUsed: false
    };
  }
  const law = current.law;
  const currentTrustedCount = getFalseTestimonyCurrentTrustedCount(law);
  const originalCorrect = law.accusationCorrect === true && !law.appealUsed;
  const projectedAccusationRewardPoints = law.accusedSuspect === null
    ? getFalseTestimonyAccusationReward(currentTrustedCount, law.entryGear.crossExaminerSabre)
    : originalCorrect
      ? getFalseTestimonyAccusationReward(
          law.accusationTrustedCount,
          law.entryGear.crossExaminerSabre
        )
      : 0;
  return {
    evidence: FALSE_TESTIMONY_EVIDENCE_IDS.map((id) => {
      const revealed = law.revealedEvidenceIds.includes(id);
      const contaminated = law.contaminatedEvidenceIds.includes(id);
      return {
        id,
        revealed,
        contaminated,
        trusted: revealed && !contaminated,
        eliminatedSuspect: FALSE_TESTIMONY_ELIMINATION_BY_EVIDENCE[id]
      };
    }),
    currentTrustedCount,
    eliminatedSuspects: getFalseTestimonyEliminatedSuspectsFromLaw(law),
    pendingVerdictNodeId: law.pendingVerdictNodeId,
    accusedSuspect: law.accusedSuspect,
    accusationCorrect: law.accusationCorrect,
    accusationTrustedCount: law.accusationTrustedCount,
    appealUsed: law.appealUsed,
    appealEligible: law.accusationCorrect === false &&
      law.entryGear.appealSeal &&
      !law.appealUsed &&
      law.bossVerdictSnapshot === null &&
      !current.clearedNodeIds.includes('false_verdict_vault'),
    projectedAccusationRewardPoints,
    bossVerdictSnapshot: law.bossVerdictSnapshot
      ? {
          ...law.bossVerdictSnapshot,
          eliminatedSuspects: [...law.bossVerdictSnapshot.eliminatedSuspects]
        }
      : null,
    entryGear: { ...law.entryGear },
    custodyProtectionUsed: law.custodyProtectionUsed
  };
}

export function resolveFalseTestimonyAccusation(
  state: DungeonLawState,
  suspect: FalseTestimonySuspect
): FalseTestimonyAccusationResolution {
  const failed = (unavailableReason: string): FalseTestimonyAccusationResolution => ({
    state,
    suspect,
    resolved: false,
    correct: false,
    appealed: false,
    rewardPoints: 0,
    unavailableReason
  });
  if (!isFalseTestimonySuspect(suspect)) return failed('未知的指控对象。');
  if (state.law.kind !== 'false_testimony_court' || state.law.pendingVerdictNodeId === null) {
    return failed('当前没有待处理的裁决。');
  }
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'false_testimony_court' || current.law.pendingVerdictNodeId === null) {
    return failed('伪证裁决状态无效。');
  }
  const appealed = current.law.pendingVerdictNodeId === 'appeal_desk';
  if (appealed && (
    current.law.accusationCorrect !== false ||
    !current.law.entryGear.appealSeal ||
    current.law.appealUsed ||
    current.clearedNodeIds.includes('false_verdict_vault')
  )) return failed('当前不具备翻案资格。');
  if (!appealed && current.law.accusedSuspect !== null) {
    return failed('原始裁决已经完成。');
  }
  const correct = suspect === FALSE_TESTIMONY_TRUE_CULPRIT;
  const trustedCount = appealed
    ? current.law.accusationTrustedCount
    : getFalseTestimonyCurrentTrustedCount(current.law);
  const rewardPoints = !appealed && correct
    ? getFalseTestimonyAccusationReward(
        trustedCount,
        current.law.entryGear.crossExaminerSabre
      )
    : 0;
  return {
    state: {
      ...current,
      law: {
        ...current.law,
        pendingVerdictNodeId: null,
        accusedSuspect: suspect,
        accusationCorrect: correct,
        accusationTrustedCount: trustedCount,
        appealUsed: current.law.appealUsed || appealed
      }
    },
    suspect,
    resolved: true,
    correct,
    appealed,
    rewardPoints
  };
}

export function getCombatReplayStatus(state: DungeonLawState): CombatReplayStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'combat_replay_stage') {
    return {
      takes: [null, null, null],
      completedTakeCount: 0,
      nextTakeNodeId: 'take_alpha',
      route: null,
      bossSnapshot: null,
      entryGear: normalizeCombatReplayEntryGear({}),
      readyForRoute: false,
      readyForBoss: false
    };
  }
  const takes = cloneCombatReplayTakes(current.law.takes);
  const completedTakeCount = takes.filter((take) => take !== null).length;
  const nextTakeNodeId = completedTakeCount < 3
    ? COMBAT_REPLAY_TAKE_NODE_IDS[completedTakeCount]
    : null;
  return {
    takes,
    completedTakeCount,
    nextTakeNodeId,
    route: current.law.route,
    bossSnapshot: current.law.bossSnapshot
      ? {
          takes: cloneCombatReplayTakes(current.law.bossSnapshot.takes) as CombatReplayCompleteTakes,
          route: current.law.bossSnapshot.route
        }
      : null,
    entryGear: { ...current.law.entryGear },
    readyForRoute: completedTakeCount === 3,
    readyForBoss: completedTakeCount === 3 && current.law.route !== null
  };
}

export function recordCombatReplayTake(
  state: DungeonLawState,
  nodeId: CombatReplayTakeNodeId,
  action: CombatReplayAction,
  observedValue: number
): CombatReplayTakeResolution {
  const failed = (unavailableReason: string): CombatReplayTakeResolution => ({
    state,
    nodeId,
    recorded: false,
    unavailableReason
  });
  if (!isCombatReplayTakeNodeId(nodeId)) return failed('未知的战斗母带录制节点。');
  if (!isCombatReplayAction(action)) return failed('仅可录制攻击、战技或防御动作。');
  if (!isCombatReplayValue(observedValue)) return failed('观测值必须是 0 至 9999 的整数。');
  if (state.law.kind !== 'combat_replay_stage') return failed('当前副本没有战斗复演法则。');
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'combat_replay_stage') return failed('战斗复演法则状态无效。');
  if (current.law.bossSnapshot !== null) return failed('Boss 母带已冻结，无法继续录制。');
  if (current.law.route !== null) return failed('复演路线已选定，无法继续录制。');
  const completedTakeCount = current.law.takes.filter((take) => take !== null).length;
  const expectedNodeId = COMBAT_REPLAY_TAKE_NODE_IDS[completedTakeCount];
  if (!expectedNodeId) return failed('三段战斗母带均已录制。');
  if (nodeId !== expectedNodeId) return failed(`必须先完成 ${expectedNodeId}。`);
  const takes = cloneCombatReplayTakes(current.law.takes);
  takes[completedTakeCount] = {
    action,
    observedValue,
    replayValue: getCombatReplayValue(observedValue, current.law.entryGear.frameEngraver)
  };
  return {
    state: { ...current, law: { ...current.law, takes } },
    nodeId,
    recorded: true
  };
}

export function selectCombatReplayRoute(
  state: DungeonLawState,
  route: CombatReplayRoute
): CombatReplayRouteResolution {
  const failed = (unavailableReason: string): CombatReplayRouteResolution => ({
    state,
    route,
    selected: false,
    unavailableReason
  });
  if (!isCombatReplayRoute(route)) return failed('未知的战斗复演路线。');
  if (state.law.kind !== 'combat_replay_stage') return failed('当前副本没有战斗复演法则。');
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'combat_replay_stage') return failed('战斗复演法则状态无效。');
  if (current.law.bossSnapshot !== null) return failed('Boss 母带已冻结，无法重选路线。');
  if (current.law.route !== null) return failed('复演路线已经永久选定。');
  if (!isCompleteCombatReplayTakes(current.law.takes)) {
    return failed('完成三段战斗母带后才能选择路线。');
  }
  return {
    state: { ...current, law: { ...current.law, route } },
    route,
    selected: true
  };
}

export function isCombatReplayBossReady(state: DungeonLawState): boolean {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  return current.law.kind === 'combat_replay_stage' &&
    isCompleteCombatReplayTakes(current.law.takes) &&
    current.law.route !== null;
}

export function freezeCombatReplayBossSnapshot(
  state: DungeonLawState
): CombatReplayBossFreezeResult {
  if (state.law.kind !== 'combat_replay_stage') {
    return { state, frozen: false, unavailableReason: '当前副本没有战斗复演法则。' };
  }
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'combat_replay_stage') {
    return { state, frozen: false, unavailableReason: '战斗复演法则状态无效。' };
  }
  if (current.law.bossSnapshot !== null) {
    return { state: current, frozen: false, unavailableReason: 'Boss 母带已经冻结。' };
  }
  if (!isCompleteCombatReplayTakes(current.law.takes) || current.law.route === null) {
    return { state: current, frozen: false, unavailableReason: '三段母带与复演路线尚未完整。' };
  }
  return {
    state: {
      ...current,
      law: {
        ...current.law,
        bossSnapshot: {
          takes: current.law.takes.map(cloneCombatReplayTake) as CombatReplayCompleteTakes,
          route: current.law.route
        }
      }
    },
    frozen: true
  };
}

export function getPanopticonStatus(state: DungeonLawState): PanopticonStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'panopticon_city') {
    const fallback = createDungeonLawState(PANOPTICON_CITY_DUNGEON_ID);
    return getPanopticonStatus(fallback);
  }
  const completedRelayCount = PANOPTICON_RELAY_NODE_IDS.filter(
    (nodeId) => current.law.kind === 'panopticon_city' && current.law.relays[nodeId]
  ).length;
  return {
    scanPhase: current.law.scanPhase,
    moveCount: current.law.moveCount,
    exposureCount: current.law.exposureCount,
    relays: { ...current.law.relays },
    completedRelayCount,
    pendingRouteNodeId: current.law.pendingRouteNodeId,
    route: current.law.route,
    refractionCharges: current.law.refractionCharges,
    decoyRewardsGranted: current.law.decoyRewardsGranted,
    bossSnapshot: current.law.bossSnapshot ? { ...current.law.bossSnapshot } : null,
    entryGear: { ...current.law.entryGear },
    predictiveVisorProtectionUsed: [...current.law.predictiveVisorProtectionUsed],
    readyForRoute: completedRelayCount === 3 && current.law.route === null,
    readyForBoss: completedRelayCount === 3 && current.law.route !== null
  };
}

export function advancePanopticonScan(
  state: DungeonLawState,
  target: Readonly<{ x: number; y: number }>
): PanopticonScanAdvanceResult {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const fallbackPhase: PanopticonScanPhase = 0;
  const invalid: PanopticonScanAdvanceResult = {
    state: current,
    phaseBefore: fallbackPhase,
    phaseAfter: 1,
    targetPhase: fallbackPhase,
    scanned: false,
    exposed: false,
    evaded: false,
    damagePercent: 0,
    rewardPoints: 0,
    chargeGranted: false
  };
  if (current.law.kind !== 'panopticon_city') return invalid;
  const phaseBefore = current.law.scanPhase;
  const phaseAfter = ((phaseBefore + 1) % 3) as PanopticonScanPhase;
  const x = Number.isFinite(target.x) ? Math.trunc(target.x) : 0;
  const y = Number.isFinite(target.y) ? Math.trunc(target.y) : 0;
  const targetPhase = (((x + y) % 3 + 3) % 3) as PanopticonScanPhase;
  const scanned = targetPhase === phaseBefore;
  const exposed = scanned && current.law.route !== 'shadow';
  const protectionUsed = [...current.law.predictiveVisorProtectionUsed] as [boolean, boolean, boolean];
  const evaded = exposed && current.law.entryGear.predictiveVisor && !protectionUsed[phaseBefore];
  if (evaded) protectionUsed[phaseBefore] = true;

  const baseDamagePercent: 0 | 4 | 8 = !exposed || evaded
    ? 0
    : current.law.route === 'refraction'
      ? 4
      : 8;
  const damagePercent = (
    current.law.entryGear.matteShell && baseDamagePercent > 0
      ? baseDamagePercent / 2
      : baseDamagePercent
  ) as 0 | 2 | 4 | 8;
  const grantsDecoyReward = exposed && current.law.route === 'decoy' && current.law.decoyRewardsGranted < 3;
  const grantsRefractionCharge = exposed && current.law.route === 'refraction' && current.law.refractionCharges < 3;
  const nextLaw: Extract<DungeonLawData, { kind: 'panopticon_city' }> = {
    ...current.law,
    scanPhase: phaseAfter,
    moveCount: current.law.moveCount + 1,
    exposureCount: current.law.exposureCount + Number(exposed),
    refractionCharges: Math.min(
      3,
      current.law.refractionCharges + Number(grantsRefractionCharge)
    ) as 0 | 1 | 2 | 3,
    decoyRewardsGranted: Math.min(
      3,
      current.law.decoyRewardsGranted + Number(grantsDecoyReward)
    ) as 0 | 1 | 2 | 3,
    predictiveVisorProtectionUsed: protectionUsed
  };
  return {
    state: { ...current, law: nextLaw },
    phaseBefore,
    phaseAfter,
    targetPhase,
    scanned,
    exposed,
    evaded,
    damagePercent,
    rewardPoints: grantsDecoyReward ? 120 : 0,
    chargeGranted: grantsRefractionCharge
  };
}

export function selectPanopticonRoute(
  state: DungeonLawState,
  route: PanopticonRoute
): PanopticonRouteResolution {
  const failed = (unavailableReason: string): PanopticonRouteResolution => ({
    state,
    route,
    selected: false,
    unavailableReason
  });
  if (!isPanopticonRoute(route)) return failed('未知的监察城潜入路线。');
  if (state.law.kind !== 'panopticon_city') return failed('当前副本没有三相扫描法则。');
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'panopticon_city') return failed('三相扫描法则状态无效。');
  if (current.law.bossSnapshot !== null) return failed('Boss 观测快照已冻结，无法重选路线。');
  if (current.law.route !== null) return failed('监察城路线已经永久选定。');
  if (!areAllPanopticonRelaysComplete(current.law.relays) || current.law.pendingRouteNodeId === null) {
    return failed('完成三座盲区中继后才能选择路线。');
  }
  return {
    state: {
      ...current,
      law: { ...current.law, pendingRouteNodeId: null, route }
    },
    route,
    selected: true
  };
}

export function isPanopticonBossReady(state: DungeonLawState): boolean {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  return current.law.kind === 'panopticon_city' &&
    areAllPanopticonRelaysComplete(current.law.relays) &&
    current.law.route !== null &&
    current.law.pendingRouteNodeId === null;
}

export function freezePanopticonBossSnapshot(
  state: DungeonLawState
): PanopticonBossFreezeResult {
  if (state.law.kind !== 'panopticon_city') {
    return { state, frozen: false, unavailableReason: '当前副本没有三相扫描法则。' };
  }
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'panopticon_city') {
    return { state, frozen: false, unavailableReason: '三相扫描法则状态无效。' };
  }
  if (current.law.bossSnapshot !== null) {
    return { state: current, frozen: false, unavailableReason: 'Boss 观测快照已经冻结。' };
  }
  if (!isPanopticonBossReady(current) || current.law.route === null) {
    return { state: current, frozen: false, unavailableReason: '三座中继与潜入路线尚未完整。' };
  }
  const snapshot: PanopticonBossSnapshot = {
    route: current.law.route,
    exposureCount: Math.max(
      0,
      current.law.exposureCount - Number(current.law.entryGear.inversePrism)
    ),
    refractionCharges: Math.min(
      3,
      current.law.refractionCharges + Number(
        current.law.entryGear.inversePrism && current.law.route === 'refraction'
      )
    ) as 0 | 1 | 2 | 3
  };
  return {
    state: { ...current, law: { ...current.law, bossSnapshot: snapshot } },
    frozen: true
  };
}

function unavailableRedactionChoice(
  costPercent: number,
  unavailableReason: string
): RedactionChoiceStatus {
  return { available: false, costPercent, unavailableReason };
}

function getRedactionBossEffect(
  choices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>,
  entryPassives: RedactionEntryPassives,
  awakened: boolean
): RedactionBossEffect {
  const fullPercent = awakened ? 20 : 10;
  const bodyPercent = entryPassives.redlineEdge ? fullPercent / 2 : fullPercent;
  const memoryPercent = entryPassives.palimpsestMantle ? fullPercent / 2 : fullPercent;
  const returnPercent = entryPassives.finalProofSeal ? fullPercent / 2 : fullPercent;
  return {
    defensePercent: choices.body_clause_desk === 'certify' ? bodyPercent : 0,
    artPowerPercent: choices.memory_clause_desk === 'certify' ? memoryPercent : 0,
    healingPercent: choices.return_clause_desk === 'certify' ? -returnPercent : 0,
    guardEffectPercent: choices.return_clause_desk === 'certify' ? -returnPercent : 0
  };
}

function getRedactionBossEffectProjection(
  choices: Readonly<Partial<Record<RedactionClauseNodeId, RedactionChoice>>>,
  entryPassives: RedactionEntryPassives
): RedactionBossEffectProjection {
  return {
    sealed: getRedactionBossEffect(choices, entryPassives, false),
    awakened: getRedactionBossEffect(choices, entryPassives, true)
  };
}

export function getRedactionClauseStatus(state: DungeonLawState): RedactionClauseStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'redaction_scriptorium') {
    const certify = unavailableRedactionChoice(0, '当前副本没有终稿条款。');
    const redact = unavailableRedactionChoice(8, '当前副本没有终稿条款。');
    return {
      available: false,
      pending: false,
      pendingClauseNodeId: null,
      resolvedClauseChoices: {},
      bossClauseSnapshot: null,
      projectedClauseChoices: {},
      certifiedCount: 0,
      redactedCount: 0,
      resolvedCount: 0,
      costPercent: 8,
      choices: { certify, redact },
      projectedBossEffects: getRedactionBossEffectProjection({}, {
        redlineEdge: false,
        palimpsestMantle: false,
        finalProofSeal: false
      })
    };
  }

  const law = current.law;
  const pending = law.pendingClauseNodeId !== null;
  const unavailableReason = law.bossClauseSnapshot !== null
    ? '首领终稿已经冻结，不能再改写条款。'
    : !pending
      ? '当前没有待裁定的终稿条款。'
      : undefined;
  const choices: Record<RedactionChoice, RedactionChoiceStatus> = unavailableReason
    ? {
        certify: unavailableRedactionChoice(0, unavailableReason),
        redact: unavailableRedactionChoice(8, unavailableReason)
      }
    : {
        certify: { available: true, costPercent: 0 },
        redact: { available: true, costPercent: 8 }
      };
  const resolvedChoices = Object.values(law.resolvedClauseChoices);
  const projectedClauseChoices = law.bossClauseSnapshot ?? law.resolvedClauseChoices;

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending,
    pendingClauseNodeId: law.pendingClauseNodeId,
    resolvedClauseChoices: { ...law.resolvedClauseChoices },
    bossClauseSnapshot: law.bossClauseSnapshot ? { ...law.bossClauseSnapshot } : null,
    projectedClauseChoices: { ...projectedClauseChoices },
    certifiedCount: resolvedChoices.filter((choice) => choice === 'certify').length,
    redactedCount: resolvedChoices.filter((choice) => choice === 'redact').length,
    resolvedCount: resolvedChoices.length,
    costPercent: 8,
    choices,
    projectedBossEffects: getRedactionBossEffectProjection(
      projectedClauseChoices,
      law.entryPassives
    )
  };
}

export function resolveRedactionClauseChoice(
  state: DungeonLawState,
  choice: RedactionChoice
): RedactionClauseResolution {
  if (state.law.kind !== 'redaction_scriptorium' || !isRedactionChoice(choice)) {
    return {
      state,
      choice,
      resolved: false,
      costPercent: 0,
      unavailableReason: '这个终稿裁定不存在。'
    };
  }

  const pendingClauseNodeId = state.law.pendingClauseNodeId;
  const unavailableReason = state.law.bossClauseSnapshot !== null
    ? '首领终稿已经冻结，不能再改写条款。'
    : pendingClauseNodeId === null
      ? '当前没有待裁定的终稿条款。'
      : Object.prototype.hasOwnProperty.call(state.law.resolvedClauseChoices, pendingClauseNodeId)
        ? '这份终稿条款已经裁定。'
        : undefined;
  if (unavailableReason || pendingClauseNodeId === null) {
    return {
      state,
      choice,
      resolved: false,
      costPercent: 0,
      unavailableReason
    };
  }

  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'redaction_scriptorium' || current.law.pendingClauseNodeId === null) {
    return {
      state,
      choice,
      resolved: false,
      costPercent: 0,
      unavailableReason: '当前没有待裁定的终稿条款。'
    };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        pendingClauseNodeId: null,
        resolvedClauseChoices: {
          ...current.law.resolvedClauseChoices,
          [current.law.pendingClauseNodeId]: choice
        }
      }
    },
    choice,
    resolved: true,
    costPercent: choice === 'redact' ? 8 : 0
  };
}

function normalizeAvailableScrip(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function getAuctionBidCost(
  law: Extract<DungeonLawData, { kind: 'legacy_auction_court' }>
): number {
  const priorBidCount = Object.values(law.resolvedLotChoices).filter((choice) => choice === 'bid').length;
  const pendingLot = law.pendingLotNodeId === null ? null : AUCTION_LOT_BY_NODE_ID[law.pendingLotNodeId];
  const discounted = pendingLot !== null && law.entryPassives[AUCTION_PASSIVE_BY_LOT[pendingLot]];
  return Math.max(1, 1 + priorBidCount - Number(discounted));
}

function unavailableAuctionChoice(
  scripCost: number,
  unavailableReason: string
): AuctionLotChoiceStatus {
  return { available: false, scripCost, unavailableReason };
}

function getAuctionBossModifiers(
  choices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>,
  entryPassives: LegacyAuctionEntryPassives,
  awakened: boolean
): DungeonLawModifiers {
  const modifiers = createIdentityModifiers();
  const boonDamage = awakened ? 14 : 8;
  const boonUtility = awakened ? 16 : 10;

  if (choices.force_lot_dais === 'bid') modifiers.outgoingDamage.forcePercent = boonDamage;
  if (choices.art_lot_dais === 'bid') modifiers.outgoingDamage.artPercent = boonDamage;
  if (choices.guard_lot_dais === 'bid') modifiers.guardEffectPercent = boonUtility;
  if (choices.return_lot_dais === 'bid') modifiers.healingPercent = boonUtility;

  if (choices.force_lot_dais === 'fold') {
    const full = awakened ? 10 : 5;
    modifiers.encounter.allStatsPercent = entryPassives.legacyGavel ? Math.ceil(full / 2) : full;
  }
  if (choices.art_lot_dais === 'fold') {
    const full = awakened ? 18 : 10;
    modifiers.encounter.artPowerPercent = entryPassives.anonymousVeil ? Math.ceil(full / 2) : full;
  }
  if (choices.guard_lot_dais === 'fold') {
    const full = awakened ? 18 : 10;
    modifiers.encounter.defensePercent = entryPassives.escrowPlate ? Math.ceil(full / 2) : full;
  }
  if (choices.return_lot_dais === 'fold') {
    const full = awakened ? 18 : 10;
    modifiers.healingPercent = entryPassives.finalLotBell ? -Math.ceil(full / 2) : -full;
  }

  return modifiers;
}

function getAuctionBossModifierProjection(
  choices: Readonly<Partial<Record<AuctionLotNodeId, AuctionLotChoice>>>,
  entryPassives: LegacyAuctionEntryPassives
): AuctionBossModifierProjection {
  return {
    sealed: getAuctionBossModifiers(choices, entryPassives, false),
    awakened: getAuctionBossModifiers(choices, entryPassives, true)
  };
}

export function getAuctionLotStatus(
  state: DungeonLawState,
  availableScrip: number
): AuctionLotStatus {
  const normalizedScrip = normalizeAvailableScrip(availableScrip);
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'legacy_auction_court') {
    const reason = '当前副本没有亡队遗产拍卖。';
    const choices = {
      bid: unavailableAuctionChoice(1, reason),
      burn: unavailableAuctionChoice(1, reason),
      fold: unavailableAuctionChoice(0, reason)
    };
    return {
      available: false,
      pending: false,
      availableScrip: normalizedScrip,
      pendingLotNodeId: null,
      resolvedLotChoices: {},
      bossLotSnapshot: null,
      projectedLotChoices: {},
      resolvedCount: 0,
      bidCount: 0,
      burnCount: 0,
      foldCount: 0,
      allLotsResolved: false,
      currentCosts: { bid: 1, burn: 1, fold: 0 },
      choices,
      projectedBossModifiers: getAuctionBossModifierProjection({}, {
        legacyGavel: false,
        anonymousVeil: false,
        escrowPlate: false,
        finalLotBell: false
      })
    };
  }

  const law = current.law;
  const bidCost = getAuctionBidCost(law);
  const currentCosts = { bid: bidCost, burn: 1, fold: 0 } as const;
  const pending = law.pendingLotNodeId !== null;
  const commonUnavailableReason = law.bossLotSnapshot !== null
    ? '首领拍品已经冻结，不能再改写归属。'
    : !pending
      ? '当前没有待裁定的遗产拍品。'
      : undefined;
  const choices: Record<AuctionLotChoice, AuctionLotChoiceStatus> = {
    bid: commonUnavailableReason
      ? unavailableAuctionChoice(bidCost, commonUnavailableReason)
      : normalizedScrip < bidCost
        ? unavailableAuctionChoice(bidCost, `竞价需要 ${bidCost} 枚遗产筹码，当前仅有 ${normalizedScrip} 枚。`)
        : { available: true, scripCost: bidCost },
    burn: commonUnavailableReason
      ? unavailableAuctionChoice(1, commonUnavailableReason)
      : normalizedScrip < 1
        ? unavailableAuctionChoice(1, `焚毁需要 1 枚遗产筹码，当前仅有 ${normalizedScrip} 枚。`)
        : { available: true, scripCost: 1 },
    fold: commonUnavailableReason
      ? unavailableAuctionChoice(0, commonUnavailableReason)
      : { available: true, scripCost: 0 }
  };
  const resolvedChoices = Object.values(law.resolvedLotChoices);
  const projectedLotChoices = law.bossLotSnapshot ?? law.resolvedLotChoices;

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending,
    availableScrip: normalizedScrip,
    pendingLotNodeId: law.pendingLotNodeId,
    resolvedLotChoices: { ...law.resolvedLotChoices },
    bossLotSnapshot: law.bossLotSnapshot ? { ...law.bossLotSnapshot } : null,
    projectedLotChoices: { ...projectedLotChoices },
    resolvedCount: resolvedChoices.length,
    bidCount: resolvedChoices.filter((choice) => choice === 'bid').length,
    burnCount: resolvedChoices.filter((choice) => choice === 'burn').length,
    foldCount: resolvedChoices.filter((choice) => choice === 'fold').length,
    allLotsResolved: isCompleteAuctionLotChoices(law.resolvedLotChoices),
    currentCosts,
    choices,
    projectedBossModifiers: getAuctionBossModifierProjection(
      projectedLotChoices,
      law.entryPassives
    )
  };
}

export const getLegacyAuctionLotStatus = getAuctionLotStatus;

export function resolveAuctionLotChoice(
  state: DungeonLawState,
  choice: AuctionLotChoice,
  availableScrip: number
): AuctionLotResolution {
  if (state.law.kind !== 'legacy_auction_court' || !isAuctionLotChoice(choice)) {
    return {
      state,
      choice,
      resolved: false,
      scripCost: 0,
      unavailableReason: '这个遗产拍品裁定不存在。'
    };
  }

  const pendingLotNodeId = state.law.pendingLotNodeId;
  const rawUnavailableReason = state.law.bossLotSnapshot !== null
    ? '首领拍品已经冻结，不能再改写归属。'
    : pendingLotNodeId === null
      ? '当前没有待裁定的遗产拍品。'
      : Object.prototype.hasOwnProperty.call(state.law.resolvedLotChoices, pendingLotNodeId)
        ? '这件遗产拍品已经裁定。'
        : undefined;
  if (rawUnavailableReason || pendingLotNodeId === null) {
    return { state, choice, resolved: false, scripCost: 0, unavailableReason: rawUnavailableReason };
  }

  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'legacy_auction_court' || current.law.pendingLotNodeId === null) {
    return {
      state,
      choice,
      resolved: false,
      scripCost: 0,
      unavailableReason: '当前没有待裁定的遗产拍品。'
    };
  }
  const choiceStatus = getAuctionLotStatus(current, availableScrip).choices[choice];
  if (!choiceStatus.available) {
    return {
      state,
      choice,
      resolved: false,
      scripCost: 0,
      unavailableReason: choiceStatus.unavailableReason
    };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        pendingLotNodeId: null,
        resolvedLotChoices: {
          ...current.law.resolvedLotChoices,
          [current.law.pendingLotNodeId]: choice
        }
      }
    },
    choice,
    resolved: true,
    scripCost: choiceStatus.scripCost
  };
}

export const resolveLegacyAuctionLotChoice = resolveAuctionLotChoice;

function normalizeAvailableGenesisSerum(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function countGenesisGene(sequence: readonly GenesisGene[], gene: GenesisGene): number {
  return sequence.filter((candidate) => candidate === gene).length;
}

function getGenesisSpliceCost(
  law: Extract<DungeonLawData, { kind: 'genesis_vault' }>,
  gene: GenesisGene
): number {
  return Math.max(
    0,
    countGenesisGene(law.spliceSequence, gene) - Number(law.entryGear[GENESIS_GEAR_BY_GENE[gene]])
  );
}

function halveSignedPercent(value: number): number {
  return Math.sign(value) * Math.ceil(Math.abs(value) / 2);
}

function clampDungeonLawModifiers(modifiers: DungeonLawModifiers): DungeonLawModifiers {
  modifiers.encounter.allStatsPercent = clamp(modifiers.encounter.allStatsPercent, -20, 20);
  modifiers.encounter.defensePercent = clamp(modifiers.encounter.defensePercent, -20, 20);
  modifiers.encounter.artPowerPercent = clamp(modifiers.encounter.artPowerPercent, -20, 20);
  modifiers.trap.damagePercent = clamp(modifiers.trap.damagePercent, -20, 20);
  modifiers.trap.dcPercent = clamp(modifiers.trap.dcPercent, -20, 20);
  modifiers.healingPercent = clamp(modifiers.healingPercent, -20, 20);
  modifiers.outgoingDamage.forcePercent = clamp(modifiers.outgoingDamage.forcePercent, -20, 20);
  modifiers.outgoingDamage.artPercent = clamp(modifiers.outgoingDamage.artPercent, -20, 20);
  modifiers.guardEffectPercent = clamp(modifiers.guardEffectPercent, -20, 20);
  return modifiers;
}

function getGenesisModifiers(
  law: Extract<DungeonLawData, { kind: 'genesis_vault' }>,
  context: DungeonLawModifierContext
): DungeonLawModifiers {
  const modifiers = createIdentityModifiers();
  const awakenedBoss = context.isBossEncounter === true && context.isBossAwakened === true;
  const playerPercentPerGene = awakenedBoss ? 6 : 4;

  for (const gene of law.spliceSequence) {
    const rankThreeBonus = law.entryBloodline.rank === 3 && law.entryBloodline.aspect === gene ? 2 : 0;
    const total = playerPercentPerGene + rankThreeBonus;
    if (gene === 'force') modifiers.outgoingDamage.forcePercent += total;
    if (gene === 'art') modifiers.outgoingDamage.artPercent += total;
    if (gene === 'guard') modifiers.guardEffectPercent += total;
    if (gene === 'renewal') modifiers.healingPercent += total;
  }

  const genome = law.bossGenomeSnapshot ??
    (law.spliceSequence.length === 3 ? law.spliceSequence : null);
  if (context.isBossEncounter && genome) {
    const dominantGene = GENESIS_GENES.find((gene) => countGenesisGene(genome, gene) >= 2);
    if (dominantGene) {
      const matchingBloodline = law.entryBloodline.aspect === dominantGene;
      const adapt = (sealed: number, awakened: number): number => {
        const full = awakenedBoss ? awakened : sealed;
        return matchingBloodline ? halveSignedPercent(full) : full;
      };
      if (dominantGene === 'force') modifiers.encounter.defensePercent += adapt(8, 14);
      if (dominantGene === 'art') modifiers.encounter.artPowerPercent += adapt(8, 14);
      if (dominantGene === 'guard') modifiers.encounter.allStatsPercent += adapt(5, 10);
      if (dominantGene === 'renewal') modifiers.healingPercent += adapt(-8, -14);
    }
  }

  return clampDungeonLawModifiers(modifiers);
}

function getGenesisModifierProjection(
  law: Extract<DungeonLawData, { kind: 'genesis_vault' }>
): GenesisModifierProjection {
  return {
    sealed: getGenesisModifiers(law, { isBossEncounter: true }),
    awakened: getGenesisModifiers(law, { isBossEncounter: true, isBossAwakened: true })
  };
}

function unavailableGenesisChoice(
  serumCost: number,
  unavailableReason: string
): GenesisSpliceChoiceStatus {
  return { available: false, serumCost, unavailableReason };
}

export function getGenesisSpliceStatus(
  state: DungeonLawState,
  availableSerum: number
): GenesisSpliceStatus {
  const availableGenesisSerum = normalizeAvailableGenesisSerum(availableSerum);
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'genesis_vault') {
    const reason = '当前副本没有众生原型拼接。';
    const choices = Object.fromEntries(
      GENESIS_GENES.map((gene) => [gene, unavailableGenesisChoice(0, reason)])
    ) as Record<GenesisGene, GenesisSpliceChoiceStatus>;
    const emptyLaw = createLawData(GENESIS_VAULT_DUNGEON_ID) as Extract<
      DungeonLawData,
      { kind: 'genesis_vault' }
    >;
    return {
      available: false,
      pending: false,
      availableGenesisSerum,
      pendingSpliceNodeId: null,
      spliceSequence: [],
      uniqueCount: 0,
      allResolved: false,
      bossGenomeSnapshot: null,
      choices,
      projectedModifiers: getGenesisModifierProjection(emptyLaw)
    };
  }

  const law = current.law;
  const commonUnavailableReason = law.bossGenomeSnapshot !== null
    ? '首领基因组已经冻结，不能再进行拼接。'
    : law.spliceSequence.length >= 3
      ? '三次原型拼接已经完成。'
      : law.pendingSpliceNodeId === null
        ? '当前没有待解决的拼接控制台。'
        : undefined;
  const choices = Object.fromEntries(GENESIS_GENES.map((gene) => {
    const serumCost = getGenesisSpliceCost(law, gene);
    if (commonUnavailableReason) {
      return [gene, unavailableGenesisChoice(serumCost, commonUnavailableReason)];
    }
    if (availableGenesisSerum < serumCost) {
      return [
        gene,
        unavailableGenesisChoice(
          serumCost,
          `选择该原型需要 ${serumCost} 支原型血清，当前仅有 ${availableGenesisSerum} 支。`
        )
      ];
    }
    return [gene, { available: true, serumCost }];
  })) as Record<GenesisGene, GenesisSpliceChoiceStatus>;

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending: law.pendingSpliceNodeId !== null,
    availableGenesisSerum,
    pendingSpliceNodeId: law.pendingSpliceNodeId,
    spliceSequence: [...law.spliceSequence],
    uniqueCount: new Set(law.spliceSequence).size,
    allResolved: law.spliceSequence.length === 3,
    bossGenomeSnapshot: law.bossGenomeSnapshot ? [...law.bossGenomeSnapshot] : null,
    choices,
    projectedModifiers: getGenesisModifierProjection(law)
  };
}

export function resolveGenesisSpliceChoice(
  state: DungeonLawState,
  gene: GenesisGene,
  availableSerum: number
): GenesisSpliceResolution {
  if (!isGenesisGene(gene)) {
    return {
      state,
      gene,
      resolved: false,
      serumCost: 0,
      unavailableReason: '这个原型基因不存在。'
    };
  }
  if (
    state.law.kind !== 'genesis_vault' ||
    state.law.pendingSpliceNodeId === null ||
    state.law.bossGenomeSnapshot !== null ||
    state.law.spliceSequence.length >= 3
  ) {
    return {
      state,
      gene,
      resolved: false,
      serumCost: 0,
      unavailableReason: state.law.kind === 'genesis_vault' && state.law.bossGenomeSnapshot
        ? '首领基因组已经冻结，不能再进行拼接。'
        : '当前没有待解决的拼接控制台。'
    };
  }

  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'genesis_vault' || current.law.pendingSpliceNodeId === null) {
    return {
      state,
      gene,
      resolved: false,
      serumCost: 0,
      unavailableReason: '当前没有待解决的拼接控制台。'
    };
  }
  const choiceStatus = getGenesisSpliceStatus(current, availableSerum).choices[gene];
  if (!choiceStatus.available) {
    return {
      state,
      gene,
      resolved: false,
      serumCost: choiceStatus.serumCost,
      unavailableReason: choiceStatus.unavailableReason
    };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        pendingSpliceNodeId: null,
        spliceSequence: [...current.law.spliceSequence, gene]
      }
    },
    gene,
    resolved: true,
    serumCost: choiceStatus.serumCost
  };
}

function unavailableMirrorCityPhaseChoice(
  unavailableReason: string
): MirrorCityPhaseChoiceStatus {
  return { available: false, phaseChanged: false, damagePercent: 0, unavailableReason };
}

export function getMirrorCityPhaseStatus(state: DungeonLawState): MirrorCityPhaseStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'mirror_cycle_city') {
    const unavailable = unavailableMirrorCityPhaseChoice('当前副本没有镜城相位台。');
    return {
      available: false,
      pending: false,
      currentPhase: 'real',
      pendingPhaseNodeId: null,
      resolvedPhaseChoices: {},
      resolvedChoiceCount: 0,
      allChoicesResolved: false,
      anchors: { real: false, mirror: false },
      bossAnchorSnapshot: null,
      choices: { real: unavailable, mirror: unavailable }
    };
  }

  const law = current.law;
  const pending = law.pendingPhaseNodeId !== null;
  const commonUnavailableReason = !pending
    ? '当前没有待指定的镜城相位。'
    : law.bossAnchorSnapshot
      ? '首领战已快照相位锚点，不能再切换相位。'
      : undefined;
  const choices = Object.fromEntries(MIRROR_CITY_PHASES.map((phase) => {
    if (commonUnavailableReason) return [phase, unavailableMirrorCityPhaseChoice(commonUnavailableReason)];
    const phaseChanged = phase !== law.currentPhase;
    return [phase, {
      available: true,
      phaseChanged,
      damagePercent: phaseChanged
        ? law.entryPassives.phaseweaveMantle ? 5 : 10
        : 0
    }];
  })) as Record<MirrorCityPhase, MirrorCityPhaseChoiceStatus>;
  const resolvedChoiceCount = MIRROR_CITY_PHASE_NODE_IDS.filter((nodeId) =>
    Object.prototype.hasOwnProperty.call(law.resolvedPhaseChoices, nodeId)
  ).length;

  return {
    available: Object.values(choices).some((choice) => choice.available),
    pending,
    currentPhase: law.currentPhase,
    pendingPhaseNodeId: law.pendingPhaseNodeId,
    resolvedPhaseChoices: { ...law.resolvedPhaseChoices },
    resolvedChoiceCount,
    allChoicesResolved: resolvedChoiceCount === MIRROR_CITY_PHASE_NODE_IDS.length,
    anchors: { ...law.anchors },
    bossAnchorSnapshot: law.bossAnchorSnapshot ? { ...law.bossAnchorSnapshot } : null,
    choices
  };
}

export function resolveMirrorCityPhaseChoice(
  state: DungeonLawState,
  phase: MirrorCityPhase
): MirrorCityPhaseResolution {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const status = getMirrorCityPhaseStatus(current);
  const choiceStatus = status.choices[phase];
  if (!choiceStatus?.available || current.law.kind !== 'mirror_cycle_city') {
    return {
      state: current,
      phase,
      resolved: false,
      phaseChanged: false,
      damagePercent: 0,
      unavailableReason: choiceStatus?.unavailableReason ?? '这个镜城相位不存在。'
    };
  }

  const pendingPhaseNodeId = current.law.pendingPhaseNodeId;
  if (pendingPhaseNodeId === null) {
    return {
      state: current,
      phase,
      resolved: false,
      phaseChanged: false,
      damagePercent: 0,
      unavailableReason: '当前没有待指定的镜城相位。'
    };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        currentPhase: phase,
        pendingPhaseNodeId: null,
        resolvedPhaseChoices: {
          ...current.law.resolvedPhaseChoices,
          [pendingPhaseNodeId]: phase
        }
      }
    },
    phase,
    resolved: true,
    phaseChanged: choiceStatus.phaseChanged,
    damagePercent: choiceStatus.damagePercent
  };
}

export function getMirrorCityShellStatus(state: DungeonLawState): MirrorCityShellStatus {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'mirror_cycle_city') {
    return {
      available: false,
      bossStarted: false,
      anchoredPhaseCount: 0,
      prismCredit: 0,
      totalShells: 0,
      brokenMirrorShells: 0,
      remainingShells: 0
    };
  }

  const snapshot = current.law.bossAnchorSnapshot;
  const anchoredPhaseCount = snapshot ? Number(snapshot.real) + Number(snapshot.mirror) : 0;
  const prismCredit = Number(current.law.entryPassives.homecomingPrism);
  const totalShells = getMirrorCityTotalShells(snapshot, current.law.entryPassives);
  return {
    available: snapshot !== null && current.law.brokenMirrorShells < totalShells,
    bossStarted: snapshot !== null,
    anchoredPhaseCount,
    prismCredit,
    totalShells,
    brokenMirrorShells: current.law.brokenMirrorShells,
    remainingShells: Math.max(0, totalShells - current.law.brokenMirrorShells)
  };
}

export function consumeMirrorCityShell(
  state: DungeonLawState,
  damage: number
): MirrorCityShellConsumption {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const status = getMirrorCityShellStatus(current);
  if (!hasPositiveDamage(damage) || !status.available || current.law.kind !== 'mirror_cycle_city') {
    return { state: current, consumed: false, finalDamageMultiplier: 1 };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        brokenMirrorShells: current.law.brokenMirrorShells + 1
      }
    },
    consumed: true,
    finalDamageMultiplier: 0.5
  };
}

function getCombatOpeningDistributionFromRecords(state: DungeonLawState): CombatOpeningDistribution {
  const distribution: CombatOpeningDistribution = { force: 0, art: 0, guard: 0 };

  for (const nodeId of state.combatVictoryNodeIds) {
    const opening = state.combatOpenings[nodeId];
    if (opening && !opening.isBoss && opening.style) distribution[opening.style] += 1;
  }
  return distribution;
}

export function getCombatOpeningDistribution(state: DungeonLawState): CombatOpeningDistribution {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  return getCombatOpeningDistributionFromRecords(current);
}

function isBalancedOpeningDistribution(distribution: CombatOpeningDistribution): boolean {
  const counts = OPENING_STYLES.map((style) => distribution[style]);
  return counts.every((count) => count > 0) && Math.max(...counts) - Math.min(...counts) <= 1;
}

function selectCitadelBossCounter(distribution: CombatOpeningDistribution): CombatOpeningStyle | null {
  if (isBalancedOpeningDistribution(distribution)) return null;
  const maximum = Math.max(...OPENING_STYLES.map((style) => distribution[style]));
  if (maximum === 0) return null;
  // Fixed style order makes ties independent of combat history insertion order.
  return OPENING_STYLES.find((style) => distribution[style] === maximum) ?? null;
}

function createFalseTestimonyBossSnapshot(
  law: Extract<DungeonLawData, { kind: 'false_testimony_court' }>
): FalseTestimonyBossVerdictSnapshot | null {
  if (law.accusedSuspect === null || law.accusationCorrect === null) return null;
  return {
    suspect: law.accusedSuspect,
    correct: law.accusationCorrect,
    trustedCount: law.accusationTrustedCount,
    appealed: law.appealUsed,
    eliminatedSuspects: getFalseTestimonyEliminatedSuspectsFromLaw(law)
  };
}

export function signalCombatStarted(state: DungeonLawState, signal: CombatStartedSignal): DungeonLawState {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (!signal.nodeId) return current;
  if (
    current.law.kind === 'combat_replay_stage' &&
    signal.isBoss &&
    signal.nodeId === 'final_cut_director' &&
    (!isCompleteCombatReplayTakes(current.law.takes) || current.law.route === null)
  ) return current;
  if (
    current.law.kind === 'panopticon_city' &&
    signal.isBoss &&
    signal.nodeId === 'all_sight_warden' &&
    !isPanopticonBossReady(current)
  ) return current;

  const shouldLockCausalDebt = current.law.kind === 'causal_clearinghouse' &&
    signal.isBoss &&
    !current.law.bossDebtLocked;
  const shouldLockEntropy = current.law.kind === 'entropy_ark' &&
    signal.isBoss &&
    signal.nodeId === 'last_helmsman' &&
    !current.law.bossEntropyLocked;
  const shouldSnapshotMirrorCityAnchors = current.law.kind === 'mirror_cycle_city' &&
    signal.isBoss &&
    signal.nodeId === 'nameless_reflection' &&
    current.law.bossAnchorSnapshot === null;
  const shouldSnapshotRedactionClauses = current.law.kind === 'redaction_scriptorium' &&
    signal.isBoss &&
    signal.nodeId === 'last_redactor' &&
    current.law.bossClauseSnapshot === null;
  const shouldSnapshotAuctionLots = current.law.kind === 'legacy_auction_court' &&
    signal.isBoss &&
    signal.nodeId === 'estate_auctioneer' &&
    current.law.bossLotSnapshot === null &&
    isCompleteAuctionLotChoices(current.law.resolvedLotChoices);
  const shouldSnapshotGenesisGenome = current.law.kind === 'genesis_vault' &&
    signal.isBoss &&
    signal.nodeId === 'primal_curator' &&
    current.law.bossGenomeSnapshot === null &&
    current.law.spliceSequence.length === 3;
  const shouldSnapshotBroadcastNoise = current.law.kind === 'silent_broadcast_tower' &&
    signal.isBoss &&
    signal.nodeId === 'last_broadcaster' &&
    current.law.bossNoiseSnapshot === null;
  const shouldSnapshotShelterSurvivor = current.law.kind === 'lost_shelter' &&
    signal.isBoss &&
    signal.nodeId === 'shelter_overseer' &&
    current.law.bossSurvivorSnapshot === null;
  const shouldSnapshotFalseTestimonyVerdict = current.law.kind === 'false_testimony_court' &&
    signal.isBoss &&
    signal.nodeId === 'false_testimony_judge' &&
    current.law.bossVerdictSnapshot === null &&
    current.law.accusedSuspect !== null &&
    current.law.pendingVerdictNodeId === null;
  const shouldSnapshotCombatReplay = current.law.kind === 'combat_replay_stage' &&
    signal.isBoss &&
    signal.nodeId === 'final_cut_director' &&
    current.law.bossSnapshot === null &&
    isCompleteCombatReplayTakes(current.law.takes) &&
    current.law.route !== null;
  const shouldSnapshotPanopticon = current.law.kind === 'panopticon_city' &&
    signal.isBoss &&
    signal.nodeId === 'all_sight_warden' &&
    current.law.bossSnapshot === null &&
    isPanopticonBossReady(current);
  if (current.combatOpenings[signal.nodeId]) {
    if (shouldLockCausalDebt && current.law.kind === 'causal_clearinghouse') {
      return {
        ...current,
        law: {
          ...current.law,
          bossDebtLocked: true,
          collectionSeals: Math.max(
            0,
            current.law.debt - Number(current.law.entryPassives.echoBreakerGauntlets)
          )
        }
      };
    }
    if (shouldLockEntropy && current.law.kind === 'entropy_ark') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingHeadingNodeId: null,
          bossEntropyLocked: true,
          collapseLayers: clamp(
            Math.abs(current.law.entropy - 2) - Number(current.law.entryPassives.arkKeelBoots),
            0,
            2
          )
        }
      };
    }
    if (shouldSnapshotMirrorCityAnchors && current.law.kind === 'mirror_cycle_city') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingPhaseNodeId: null,
          bossAnchorSnapshot: { ...current.law.anchors },
          brokenMirrorShells: 0
        }
      };
    }
    if (shouldSnapshotRedactionClauses && current.law.kind === 'redaction_scriptorium') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingClauseNodeId: null,
          bossClauseSnapshot: { ...current.law.resolvedClauseChoices }
        }
      };
    }
    if (shouldSnapshotAuctionLots && current.law.kind === 'legacy_auction_court') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingLotNodeId: null,
          bossLotSnapshot: { ...current.law.resolvedLotChoices }
        }
      };
    }
    if (shouldSnapshotGenesisGenome && current.law.kind === 'genesis_vault') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingSpliceNodeId: null,
          bossGenomeSnapshot: [...current.law.spliceSequence]
        }
      };
    }
    if (shouldSnapshotBroadcastNoise && current.law.kind === 'silent_broadcast_tower') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingRelayNodeId: null,
          bossNoiseSnapshot: clamp(
            current.law.noise - Number(current.law.entryPassives.lastChannelBeacon),
            0,
            6
          )
        }
      };
    }
    if (shouldSnapshotShelterSurvivor && current.law.kind === 'lost_shelter') {
      return {
        ...current,
        law: {
          ...current.law,
          pendingCheckpointNodeId: null,
          bossSurvivorSnapshot: clamp(
            current.law.survivorHp + Number(current.law.entryGear.blackboxBeacon) * 10,
            0,
            100
          )
        }
      };
    }
    if (shouldSnapshotFalseTestimonyVerdict && current.law.kind === 'false_testimony_court') {
      const snapshot = createFalseTestimonyBossSnapshot(current.law);
      return snapshot
        ? { ...current, law: { ...current.law, bossVerdictSnapshot: snapshot } }
        : current;
    }
    if (shouldSnapshotCombatReplay && current.law.kind === 'combat_replay_stage') {
      return freezeCombatReplayBossSnapshot(current).state;
    }
    if (shouldSnapshotPanopticon && current.law.kind === 'panopticon_city') {
      return freezePanopticonBossSnapshot(current).state;
    }
    return current;
  }

  const next: DungeonLawState = {
    ...current,
    combatOpenings: {
      ...current.combatOpenings,
      [signal.nodeId]: {
        isBoss: signal.isBoss,
        style: openingStyleFor(signal.openingAction)
      }
    }
  };

  // The citadel locks its answer before the boss can add another result to the distribution.
  if (next.law.kind === 'void_citadel' && signal.isBoss) {
    next.law = {
      ...next.law,
      bossAssessmentLocked: true,
      bossCounter: selectCitadelBossCounter(getCombatOpeningDistribution(current))
    };
  } else if (next.law.kind === 'causal_clearinghouse' && shouldLockCausalDebt) {
    next.law = {
      ...next.law,
      bossDebtLocked: true,
      collectionSeals: Math.max(
        0,
        next.law.debt - Number(next.law.entryPassives.echoBreakerGauntlets)
      )
    };
  } else if (next.law.kind === 'entropy_ark' && shouldLockEntropy) {
    next.law = {
      ...next.law,
      pendingHeadingNodeId: null,
      bossEntropyLocked: true,
      collapseLayers: clamp(
        Math.abs(next.law.entropy - 2) - Number(next.law.entryPassives.arkKeelBoots),
        0,
        2
      )
    };
  } else if (next.law.kind === 'mirror_cycle_city' && shouldSnapshotMirrorCityAnchors) {
    next.law = {
      ...next.law,
      pendingPhaseNodeId: null,
      bossAnchorSnapshot: { ...next.law.anchors },
      brokenMirrorShells: 0
    };
  } else if (next.law.kind === 'redaction_scriptorium' && shouldSnapshotRedactionClauses) {
    next.law = {
      ...next.law,
      pendingClauseNodeId: null,
      bossClauseSnapshot: { ...next.law.resolvedClauseChoices }
    };
  } else if (next.law.kind === 'legacy_auction_court' && shouldSnapshotAuctionLots) {
    next.law = {
      ...next.law,
      pendingLotNodeId: null,
      bossLotSnapshot: { ...next.law.resolvedLotChoices }
    };
  } else if (next.law.kind === 'genesis_vault' && shouldSnapshotGenesisGenome) {
    next.law = {
      ...next.law,
      pendingSpliceNodeId: null,
      bossGenomeSnapshot: [...next.law.spliceSequence]
    };
  } else if (next.law.kind === 'silent_broadcast_tower' && shouldSnapshotBroadcastNoise) {
    next.law = {
      ...next.law,
      pendingRelayNodeId: null,
      bossNoiseSnapshot: clamp(
        next.law.noise - Number(next.law.entryPassives.lastChannelBeacon),
        0,
        6
      )
    };
  } else if (next.law.kind === 'lost_shelter' && shouldSnapshotShelterSurvivor) {
    next.law = {
      ...next.law,
      pendingCheckpointNodeId: null,
      bossSurvivorSnapshot: clamp(
        next.law.survivorHp + Number(next.law.entryGear.blackboxBeacon) * 10,
        0,
        100
      )
    };
  } else if (
    next.law.kind === 'false_testimony_court' &&
    shouldSnapshotFalseTestimonyVerdict
  ) {
    const snapshot = createFalseTestimonyBossSnapshot(next.law);
    if (snapshot) next.law = { ...next.law, bossVerdictSnapshot: snapshot };
  } else if (next.law.kind === 'combat_replay_stage' && shouldSnapshotCombatReplay) {
    next.law = {
      ...next.law,
      bossSnapshot: {
        takes: next.law.takes.map((take) => cloneCombatReplayTake(take!)) as CombatReplayCompleteTakes,
        route: next.law.route!
      }
    };
  } else if (next.law.kind === 'panopticon_city' && shouldSnapshotPanopticon) {
    next.law = {
      ...next.law,
      pendingRouteNodeId: null,
      bossSnapshot: {
        route: next.law.route!,
        exposureCount: Math.max(
          0,
          next.law.exposureCount - Number(next.law.entryGear.inversePrism)
        ),
        refractionCharges: Math.min(
          3,
          next.law.refractionCharges + Number(
            next.law.entryGear.inversePrism && next.law.route === 'refraction'
          )
        ) as 0 | 1 | 2 | 3
      }
    };
  }

  return next;
}

export function consumeCausalCollectionSeal(
  state: DungeonLawState
): CausalCollectionSealConsumption {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (current.law.kind !== 'causal_clearinghouse' || current.law.collectionSeals <= 0) {
    return { state: current, consumed: false, finalDamageMultiplier: 1 };
  }

  return {
    state: {
      ...current,
      law: {
        ...current.law,
        collectionSeals: current.law.collectionSeals - 1
      }
    },
    consumed: true,
    finalDamageMultiplier: 0.5
  };
}

export function signalCombatVictory(state: DungeonLawState, signal: CombatVictorySignal): DungeonLawState {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (!signal.nodeId || current.combatVictoryNodeIds.includes(signal.nodeId)) return current;

  const existingOpening = current.combatOpenings[signal.nodeId];
  const combatOpenings = existingOpening
    ? signal.isBoss && !existingOpening.isBoss
      ? { ...current.combatOpenings, [signal.nodeId]: { ...existingOpening, isBoss: true } }
      : current.combatOpenings
    : {
        ...current.combatOpenings,
        [signal.nodeId]: { isBoss: signal.isBoss, style: null }
      };

  return {
    ...current,
    combatOpenings,
    combatVictoryNodeIds: [...current.combatVictoryNodeIds, signal.nodeId]
  };
}

function getArenaReading(state: DungeonLawState): {
  distribution: CombatOpeningDistribution;
  repeatedStyle: CombatOpeningStyle | null;
  rewritten: boolean;
} {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const styles = current.combatVictoryNodeIds
    .map((nodeId) => current.combatOpenings[nodeId])
    .filter((opening): opening is CombatOpeningRecord => Boolean(opening && !opening.isBoss && opening.style))
    .map((opening) => opening.style as CombatOpeningStyle);
  const distribution = getCombatOpeningDistribution(current);
  const last = styles.at(-1) ?? null;
  const previous = styles.at(-2) ?? null;

  return {
    distribution,
    repeatedStyle: last && last === previous ? last : null,
    rewritten: OPENING_STYLES.every((style) => distribution[style] > 0)
  };
}

function createIdentityModifiers(): DungeonLawModifiers {
  return {
    encounter: { allStatsPercent: 0, defensePercent: 0, artPowerPercent: 0 },
    trap: { damagePercent: 0, dcPercent: 0 },
    healingPercent: 0,
    outgoingDamage: { forcePercent: 0, artPercent: 0 },
    guardEffectPercent: 0
  };
}

function applyStyleModifier(
  modifiers: DungeonLawModifiers,
  style: CombatOpeningStyle,
  percent: number
): void {
  const bounded = clamp(percent, -20, 20);
  if (style === 'force') modifiers.outgoingDamage.forcePercent = bounded;
  if (style === 'art') modifiers.outgoingDamage.artPercent = bounded;
  if (style === 'guard') modifiers.guardEffectPercent = bounded;
}

function applyAnechoicMantle(
  modifiers: DungeonLawModifiers,
  enabled: boolean
): void {
  if (!enabled) return;
  for (const key of Object.keys(modifiers.encounter) as (keyof DungeonLawModifiers['encounter'])[]) {
    if (modifiers.encounter[key] > 0) {
      modifiers.encounter[key] = Math.floor(modifiers.encounter[key] / 2);
    }
  }
  for (const key of Object.keys(modifiers.trap) as (keyof DungeonLawModifiers['trap'])[]) {
    if (modifiers.trap[key] > 0) modifiers.trap[key] = Math.floor(modifiers.trap[key] / 2);
  }
}

export function getDungeonLawModifiers(
  state: DungeonLawState,
  context: DungeonLawModifierContext = {}
): DungeonLawModifiers {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const modifiers = createIdentityModifiers();

  switch (current.law.kind) {
    case 'demon_tower':
      if (current.law.fogPressure >= 2) {
        modifiers.encounter.allStatsPercent = current.law.fogPressure === 3 ? 20 : 10;
      }
      break;
    case 'metro_abyss':
      if (current.law.tide === 'mirror') {
        modifiers.trap.damagePercent = 20;
        modifiers.trap.dcPercent = 20;
        if (context.isReflectionEncounter) modifiers.encounter.allStatsPercent = 20;
      }
      break;
    case 'starfall_mine':
      if (current.law.gravity === 'upward') {
        modifiers.trap.damagePercent = -20;
        modifiers.trap.dcPercent = -20;
        modifiers.encounter.defensePercent = 20;
      } else {
        modifiers.trap.damagePercent = 20;
        modifiers.trap.dcPercent = 20;
        modifiers.encounter.defensePercent = -20;
      }
      break;
    case 'rust_hospital':
      if (current.law.pollution >= 3) {
        const pressure = current.law.pollution === 4 ? 20 : 10;
        modifiers.healingPercent = -pressure;
        modifiers.encounter.artPowerPercent = pressure;
      }
      break;
    case 'ash_arena': {
      const reading = getArenaReading(current);
      if (reading.rewritten) {
        modifiers.outgoingDamage.forcePercent = 10;
        modifiers.outgoingDamage.artPercent = 10;
        modifiers.guardEffectPercent = 10;
      } else if (reading.repeatedStyle) {
        applyStyleModifier(modifiers, reading.repeatedStyle, -20);
      }
      break;
    }
    case 'void_citadel':
      if (context.isBossEncounter && current.law.bossAssessmentLocked) {
        const counter = selectCitadelBossCounter(getCombatOpeningDistribution(current));
        if (counter) applyStyleModifier(modifiers, counter, -20);
      }
      break;
    case 'temporal_observatory': {
      const missingAnchors = Number(!current.law.pastCalibrated) + Number(!current.law.futureCalibrated);
      if (!current.law.pastCalibrated) modifiers.encounter.defensePercent = 20;
      if (!current.law.futureCalibrated) {
        modifiers.trap.damagePercent = 20;
        modifiers.trap.dcPercent = 20;
      }
      if (context.isBossEncounter) modifiers.encounter.allStatsPercent = Math.min(20, missingAnchors * 10);
      break;
    }
    case 'causal_clearinghouse':
      break;
    case 'entropy_ark': {
      const lowPressure = current.law.entropy <= 1 ? (2 - current.law.entropy) * 10 : 0;
      const highPressure = current.law.entropy >= 3 ? (current.law.entropy - 2) * 10 : 0;
      modifiers.encounter.defensePercent = clamp(lowPressure, -20, 20);
      modifiers.trap.damagePercent = clamp(highPressure - lowPressure, -20, 20);
      modifiers.trap.dcPercent = clamp(highPressure - lowPressure, -20, 20);
      modifiers.encounter.allStatsPercent = context.isBossEncounter
        ? clamp(current.law.collapseLayers * 10, -20, 20)
        : clamp(highPressure, -20, 20);
      modifiers.outgoingDamage.forcePercent = clamp(highPressure, -20, 20);
      modifiers.outgoingDamage.artPercent = clamp(highPressure, -20, 20);
      break;
    }
    case 'mirror_cycle_city':
      if (current.law.currentPhase === 'real') {
        modifiers.outgoingDamage.forcePercent = 12;
        modifiers.outgoingDamage.artPercent = current.law.entryPassives.parallaxVisor ? 0 : -6;
      } else {
        modifiers.outgoingDamage.forcePercent = current.law.entryPassives.parallaxVisor ? 0 : -6;
        modifiers.outgoingDamage.artPercent = 12;
      }
      break;
    case 'redaction_scriptorium':
      if (context.isBossEncounter && current.law.bossClauseSnapshot) {
        const effect = getRedactionBossEffect(
          current.law.bossClauseSnapshot,
          current.law.entryPassives,
          context.isBossAwakened === true
        );
        modifiers.encounter.defensePercent = effect.defensePercent;
        modifiers.encounter.artPowerPercent = effect.artPowerPercent;
        modifiers.healingPercent = effect.healingPercent;
        modifiers.guardEffectPercent = effect.guardEffectPercent;
      }
      break;
    case 'legacy_auction_court':
      if (context.isBossEncounter && current.law.bossLotSnapshot) {
        return getAuctionBossModifiers(
          current.law.bossLotSnapshot,
          current.law.entryPassives,
          context.isBossAwakened === true
        );
      }
      break;
    case 'genesis_vault':
      return getGenesisModifiers(current.law, context);
    case 'silent_broadcast_tower': {
      const noise = context.isBossEncounter && current.law.bossNoiseSnapshot !== null
        ? current.law.bossNoiseSnapshot
        : current.law.noise;
      if (context.isBossEncounter && noise <= 2) {
        modifiers.encounter.defensePercent = [12, 8, 4][noise] ?? 0;
      }
      if (noise >= 4) {
        const dangerPercent = (noise - 3) * 4;
        const outputPercent = (noise - 3) * 2;
        modifiers.encounter.allStatsPercent = dangerPercent;
        modifiers.trap.damagePercent = dangerPercent;
        modifiers.trap.dcPercent = dangerPercent;
        modifiers.outgoingDamage.forcePercent = outputPercent;
        modifiers.outgoingDamage.artPercent = outputPercent;
      }
      applyAnechoicMantle(modifiers, current.law.entryPassives.anechoicMantle);
      break;
    }
    case 'lost_shelter': {
      const survivorHp = context.isBossEncounter && current.law.bossSurvivorSnapshot !== null
        ? current.law.bossSurvivorSnapshot
        : current.law.survivorHp;
      if (survivorHp >= 75) {
        modifiers.encounter.allStatsPercent = -6;
        modifiers.outgoingDamage.forcePercent = 6;
        modifiers.outgoingDamage.artPercent = 6;
      } else if (survivorHp >= 41) {
        break;
      } else if (survivorHp >= 1) {
        modifiers.encounter.allStatsPercent = 6;
        modifiers.outgoingDamage.forcePercent = 4;
        modifiers.outgoingDamage.artPercent = 4;
      } else {
        modifiers.encounter.allStatsPercent = 12;
        modifiers.outgoingDamage.forcePercent = 8;
        modifiers.outgoingDamage.artPercent = 8;
      }
      break;
    }
    case 'false_testimony_court': {
      const snapshot = context.isBossEncounter ? current.law.bossVerdictSnapshot : null;
      if (!snapshot) break;
      let enemyPercent = 0;
      let playerPercent = 0;
      if (!snapshot.correct) {
        enemyPercent = 10;
        playerPercent = 10;
      } else if (snapshot.appealed) {
        enemyPercent = -2;
        playerPercent = 4;
      } else if (snapshot.trustedCount === 3) {
        enemyPercent = -8;
        playerPercent = 6;
      } else if (snapshot.trustedCount >= 1 && snapshot.trustedCount <= 2) {
        enemyPercent = -4;
        playerPercent = 8;
      }
      modifiers.encounter.allStatsPercent = clamp(enemyPercent, -20, 20);
      modifiers.outgoingDamage.forcePercent = clamp(playerPercent, -20, 20);
      modifiers.outgoingDamage.artPercent = clamp(playerPercent, -20, 20);
      break;
    }
    case 'panopticon_city': {
      const snapshot = current.law.bossSnapshot;
      if (context.isBossEncounter && snapshot && current.law.entryGear.blindlineCutter) {
        const damagePercent = Math.min(
          15,
          (snapshot.exposureCount + snapshot.refractionCharges) * 3
        );
        modifiers.outgoingDamage.forcePercent = damagePercent;
        modifiers.outgoingDamage.artPercent = damagePercent;
      }
      break;
    }
  }

  return modifiers;
}

export function isArchiveFeatureAvailable(state: DungeonLawState, feature: ArchiveFeature): boolean {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  if (feature === 'attack' || feature === 'defense') return true;
  return current.law.kind !== 'dream_archive' || !current.law.sealedFeatures.includes(feature);
}

function styleLabel(style: CombatOpeningStyle): string {
  if (style === 'force') return '力';
  if (style === 'art') return '术';
  return '守';
}

export function getDungeonLawDisplay(
  state: DungeonLawState,
  context: number | DungeonLawDisplayContext = 0
): DungeonLawDisplayModel {
  const current = normalizeDungeonLawState(state, state.dungeonId);
  const modifiers = getDungeonLawModifiers(current);
  const availableScrip = typeof context === 'number'
    ? normalizeAvailableScrip(context)
    : normalizeAvailableScrip(context.availableScrip ?? 0);
  const availableGenesisSerum = typeof context === 'number'
    ? 0
    : normalizeAvailableGenesisSerum(context.availableGenesisSerum ?? 0);
  const availableHealingPills = typeof context === 'number'
    ? 0
    : normalizeAvailableHealingPills(context.availableHealingPills ?? 0);

  switch (current.law.kind) {
    case 'demon_tower':
      return {
        dungeonId: current.dungeonId,
        title: '妖雾压境',
        status: `雾压 ${current.law.fogPressure}/3`,
        severity: current.law.fogPressure >= 2 ? 'danger' : current.law.fogPressure > 0 ? 'warning' : 'stable',
        meter: { value: current.law.fogPressure, max: 3 },
        targetReached: current.law.fogPressure === 0,
        modifiers
      };
    case 'metro_abyss': {
      const tideLabels: Record<MetroTide, string> = { ebb: '退潮', flood: '涨潮', mirror: '镜潮' };
      return {
        dungeonId: current.dungeonId,
        title: '末班潮序',
        status: tideLabels[current.law.tide],
        severity: current.law.tide === 'mirror' ? 'danger' : current.law.tide === 'flood' ? 'warning' : 'stable',
        meter: { value: TIDE_ORDER.indexOf(current.law.tide), max: 2 },
        targetReached: current.law.tide === 'ebb',
        modifiers
      };
    }
    case 'starfall_mine':
      return {
        dungeonId: current.dungeonId,
        title: '重力极向',
        status: current.law.gravity === 'upward' ? '上浮' : '下沉',
        severity: 'warning',
        meter: null,
        targetReached: false,
        modifiers
      };
    case 'rust_hospital':
      return {
        dungeonId: current.dungeonId,
        title: '锈疫污染',
        status: `污染 ${current.law.pollution}/4`,
        severity: current.law.pollution >= 3 ? 'danger' : current.law.pollution > 0 ? 'warning' : 'stable',
        meter: { value: current.law.pollution, max: 4 },
        targetReached: current.law.pollution === 0,
        modifiers
      };
    case 'ash_arena': {
      const reading = getArenaReading(current);
      const seen = OPENING_STYLES.filter((style) => reading.distribution[style] > 0).length;
      return {
        dungeonId: current.dungeonId,
        title: '熔炉判词',
        status: reading.rewritten
          ? '三式齐全，裁决改判'
          : reading.repeatedStyle
            ? `连续复招：${styleLabel(reading.repeatedStyle)}`
            : `已记录 ${seen}/3`,
        severity: reading.rewritten ? 'resolved' : reading.repeatedStyle ? 'danger' : 'stable',
        meter: { value: seen, max: 3 },
        targetReached: reading.rewritten,
        modifiers
      };
    }
    case 'dream_archive':
      return {
        dungeonId: current.dungeonId,
        title: '失败封存',
        status: `已封存 ${current.law.sealedFeatures.length}/3`,
        severity: current.law.sealedFeatures.length >= 2 ? 'danger' : current.law.sealedFeatures.length > 0 ? 'warning' : 'stable',
        meter: { value: current.law.sealedFeatures.length, max: 3 },
        targetReached: current.law.sealedFeatures.length === 0,
        modifiers
      };
    case 'void_citadel': {
      const distribution = getCombatOpeningDistribution(current);
      const totalOpenings = OPENING_STYLES.reduce((total, style) => total + distribution[style], 0);
      const preview = selectCitadelBossCounter(distribution);
      const balanced = current.law.bossAssessmentLocked && isBalancedOpeningDistribution(distribution);
      const lockedCounter = current.law.bossAssessmentLocked ? preview : null;
      return {
        dungeonId: current.dungeonId,
        title: '终局回声',
        status: current.law.bossAssessmentLocked
          ? lockedCounter
            ? `克制偏科：${styleLabel(lockedCounter)}`
            : balanced
              ? '分布均衡，克制关闭'
              : '无有效开局，克制未生成'
          : preview
            ? `偏科预警：${styleLabel(preview)}`
            : totalOpenings === 0
              ? '尚无开局记录'
              : '开局分布均衡',
        severity: lockedCounter ? 'danger' : balanced ? 'resolved' : 'stable',
        meter: null,
        targetReached: balanced,
        modifiers
      };
    }
    case 'temporal_observatory': {
      const calibratedAnchors = Number(current.law.pastCalibrated) + Number(current.law.futureCalibrated);
      return {
        dungeonId: current.dungeonId,
        title: '时间校准',
        status: calibratedAnchors === 0
          ? '0/2 时序漂移'
          : calibratedAnchors === 1
            ? '1/2 单锚锁定'
            : '2/2 双锚同步',
        severity: calibratedAnchors === 0 ? 'danger' : calibratedAnchors === 1 ? 'warning' : 'resolved',
        meter: { value: calibratedAnchors, max: 2 },
        targetReached: calibratedAnchors === 2,
        modifiers
      };
    }
    case 'causal_clearinghouse': {
      const pending = current.law.pendingLedgerNodeId !== null;
      const collecting = current.law.bossDebtLocked && current.law.collectionSeals > 0;
      return {
        dungeonId: current.dungeonId,
        title: '因果账本',
        status: collecting
          ? `因果债 ${current.law.debt}/4，追缴印 ${current.law.collectionSeals}`
          : pending
            ? `因果债 ${current.law.debt}/4，待平账`
            : `因果债 ${current.law.debt}/4，账目已结`,
        severity: collecting || current.law.debt >= 4
          ? 'danger'
          : pending || current.law.debt > 0
            ? 'warning'
            : 'resolved',
        meter: { value: current.law.debt, max: 4 },
        targetReached: !pending && current.law.debt === 0 && current.law.collectionSeals === 0,
        modifiers
      };
    }
    case 'entropy_ark': {
      const pending = current.law.pendingHeadingNodeId !== null;
      const status = current.law.bossEntropyLocked
        ? `熵值 ${current.law.entropy}/4，已锁定，崩解层 ${current.law.collapseLayers}`
        : pending
          ? `熵值 ${current.law.entropy}/4，待选航`
          : `熵值 ${current.law.entropy}/4`;
      const targetReached = !pending && current.law.entropy === 2 && current.law.collapseLayers === 0;
      return {
        dungeonId: current.dungeonId,
        title: '方舟航态',
        status,
        severity: targetReached
          ? 'resolved'
          : current.law.collapseLayers >= 2 || current.law.entropy === 0 || current.law.entropy === 4
            ? 'danger'
            : 'warning',
        meter: { value: current.law.entropy, max: 4 },
        targetReached,
        modifiers
      };
    }
    case 'mirror_cycle_city': {
      const phaseStatus = getMirrorCityPhaseStatus(current);
      const shellStatus = getMirrorCityShellStatus(current);
      const anchorCount = Number(current.law.anchors.real) + Number(current.law.anchors.mirror);
      const phaseLabel = current.law.currentPhase === 'real' ? '现实' : '镜像';
      const status = shellStatus.bossStarted
        ? `${phaseLabel}相位，镜壳 ${shellStatus.remainingShells}/${shellStatus.totalShells}`
        : phaseStatus.pending
          ? `${phaseLabel}相位，待定相位，锚点 ${anchorCount}/2`
          : `${phaseLabel}相位，抉择 ${phaseStatus.resolvedChoiceCount}/3，锚点 ${anchorCount}/2`;
      return {
        dungeonId: current.dungeonId,
        title: '镜海相位',
        status,
        severity: phaseStatus.pending || shellStatus.remainingShells >= 2
          ? 'danger'
          : shellStatus.remainingShells === 1 || !phaseStatus.allChoicesResolved
            ? 'warning'
            : anchorCount === 2 || shellStatus.bossStarted
              ? 'resolved'
              : 'stable',
        meter: { value: phaseStatus.resolvedChoiceCount, max: 3 },
        targetReached: phaseStatus.allChoicesResolved && !phaseStatus.pending,
        modifiers
      };
    }
    case 'redaction_scriptorium': {
      const clauseStatus = getRedactionClauseStatus(current);
      const pendingLabel: Partial<Record<RedactionClauseNodeId, string>> = {
        body_clause_desk: '肉身',
        memory_clause_desk: '记忆',
        return_clause_desk: '归返'
      };
      const clauseSource = current.law.bossClauseSnapshot ? '冻结' : '预估';
      const pendingText = current.law.pendingClauseNodeId
        ? `，待裁定 ${pendingLabel[current.law.pendingClauseNodeId]}`
        : '';
      return {
        dungeonId: current.dungeonId,
        title: '删界终稿',
        status: `抉择 ${clauseStatus.resolvedCount}/3，认证 ${clauseStatus.certifiedCount}，删改 ${clauseStatus.redactedCount}${pendingText}，${clauseSource}条款 ${Object.keys(clauseStatus.projectedClauseChoices).length}/3`,
        severity: current.law.bossClauseSnapshot || clauseStatus.resolvedCount === 3
          ? 'resolved'
          : current.law.pendingClauseNodeId
            ? 'danger'
            : 'warning',
        meter: { value: clauseStatus.resolvedCount, max: 3 },
        targetReached: clauseStatus.resolvedCount === 3 && !clauseStatus.pending,
        modifiers,
        redaction: {
          totalClauseCount: 3,
          resolvedCount: clauseStatus.resolvedCount,
          certifiedCount: clauseStatus.certifiedCount,
          redactedCount: clauseStatus.redactedCount,
          pendingClauseNodeId: clauseStatus.pendingClauseNodeId,
          projectedClauseChoices: { ...clauseStatus.projectedClauseChoices },
          frozenClauseChoices: current.law.bossClauseSnapshot
            ? { ...current.law.bossClauseSnapshot }
            : null
        }
      };
    }
    case 'legacy_auction_court': {
      const auctionStatus = getAuctionLotStatus(current, availableScrip);
      const lotLabel: Readonly<Record<AuctionLotNodeId, string>> = {
        force_lot_dais: '力之遗产',
        guard_lot_dais: '守之遗产',
        art_lot_dais: '术之遗产',
        return_lot_dais: '归返遗产'
      };
      const pendingText = auctionStatus.pendingLotNodeId
        ? `，待裁定 ${lotLabel[auctionStatus.pendingLotNodeId]}`
        : '';
      const frozenText = auctionStatus.bossLotSnapshot ? '，首领拍品已冻结' : '';
      return {
        dungeonId: current.dungeonId,
        title: '亡队遗产拍卖',
        status: `遗产筹码 ${availableScrip}，抉择 ${auctionStatus.resolvedCount}/4，竞得 ${auctionStatus.bidCount}，焚毁 ${auctionStatus.burnCount}，放弃 ${auctionStatus.foldCount}${pendingText}${frozenText}`,
        severity: auctionStatus.bossLotSnapshot || auctionStatus.allLotsResolved
          ? 'resolved'
          : auctionStatus.pending
            ? 'danger'
            : 'warning',
        meter: { value: auctionStatus.resolvedCount, max: 4 },
        targetReached: auctionStatus.allLotsResolved && !auctionStatus.pending,
        modifiers,
        auction: {
          totalLotCount: 4,
          availableScrip,
          resolvedCount: auctionStatus.resolvedCount,
          bidCount: auctionStatus.bidCount,
          burnCount: auctionStatus.burnCount,
          foldCount: auctionStatus.foldCount,
          pendingLotNodeId: auctionStatus.pendingLotNodeId,
          currentCosts: { ...auctionStatus.currentCosts },
          projectedLotChoices: { ...auctionStatus.projectedLotChoices },
          frozenLotChoices: auctionStatus.bossLotSnapshot
            ? { ...auctionStatus.bossLotSnapshot }
            : null,
          projectedBossModifiers: auctionStatus.projectedBossModifiers
        }
      };
    }
    case 'genesis_vault': {
      const genesisStatus = getGenesisSpliceStatus(current, availableGenesisSerum);
      const pendingText = genesisStatus.pendingSpliceNodeId
        ? `，待拼接 ${genesisStatus.pendingSpliceNodeId}`
        : '';
      const snapshotText = genesisStatus.bossGenomeSnapshot
        ? `，Boss快照 ${genesisStatus.bossGenomeSnapshot.join('/')}`
        : '，Boss快照 未冻结';
      return {
        dungeonId: current.dungeonId,
        title: '众生原型拼接',
        status: `原型血清 ${availableGenesisSerum}，拼接 ${genesisStatus.spliceSequence.length}/3，多样性 ${genesisStatus.uniqueCount}${pendingText}${snapshotText}`,
        severity: genesisStatus.bossGenomeSnapshot || genesisStatus.allResolved
          ? 'resolved'
          : genesisStatus.pending
            ? 'danger'
            : 'warning',
        meter: { value: genesisStatus.spliceSequence.length, max: 3 },
        targetReached: genesisStatus.allResolved && !genesisStatus.pending,
        modifiers,
        genesis: {
          availableGenesisSerum,
          pendingSpliceNodeId: genesisStatus.pendingSpliceNodeId,
          spliceSequence: [...genesisStatus.spliceSequence],
          uniqueCount: genesisStatus.uniqueCount,
          bossGenomeSnapshot: genesisStatus.bossGenomeSnapshot
            ? [...genesisStatus.bossGenomeSnapshot]
            : null,
          projectedModifiers: genesisStatus.projectedModifiers
        }
      };
    }
    case 'silent_broadcast_tower': {
      const broadcastStatus = getBroadcastRelayStatus(current);
      const relayLabels: Readonly<Record<BroadcastRelayNodeId, string>> = {
        north_relay_console: '北中继',
        central_relay_console: '中央中继',
        south_relay_console: '南中继'
      };
      const choiceLabels: Readonly<Record<BroadcastRelayChoice, string>> = {
        mute: '静默',
        broadcast: '播送'
      };
      const relaySummary = BROADCAST_RELAY_NODE_IDS.map((nodeId) => {
        const choice = broadcastStatus.resolvedRelayChoices[nodeId];
        return `${relayLabels[nodeId]}:${choice ? choiceLabels[choice] : '未定'}`;
      }).join('，');
      const pendingText = broadcastStatus.pendingRelayNodeId
        ? `，待调谐 ${relayLabels[broadcastStatus.pendingRelayNodeId]}`
        : '';
      const snapshotText = broadcastStatus.bossNoiseSnapshot === null
        ? '未冻结'
        : String(broadcastStatus.bossNoiseSnapshot);
      return {
        dungeonId: current.dungeonId,
        title: '寂声广播律',
        status: `噪声 ${broadcastStatus.noise}/6，${relaySummary}，静默 ${broadcastStatus.muteCount}，播送 ${broadcastStatus.broadcastCount}${pendingText}，Boss快照 ${snapshotText}`,
        severity: broadcastStatus.bossNoiseSnapshot !== null || broadcastStatus.allRelaysResolved
          ? 'resolved'
          : broadcastStatus.pending || broadcastStatus.noise >= 5
            ? 'danger'
            : broadcastStatus.noise >= 3
              ? 'warning'
              : 'stable',
        meter: { value: broadcastStatus.noise, max: 6 },
        targetReached: broadcastStatus.allRelaysResolved && !broadcastStatus.pending,
        modifiers,
        broadcast: {
          totalRelayCount: 3,
          noise: broadcastStatus.noise,
          pendingRelayNodeId: broadcastStatus.pendingRelayNodeId,
          resolvedRelayChoices: { ...broadcastStatus.resolvedRelayChoices },
          resolvedCount: broadcastStatus.resolvedCount,
          muteCount: broadcastStatus.muteCount,
          broadcastCount: broadcastStatus.broadcastCount,
          bossNoiseSnapshot: broadcastStatus.bossNoiseSnapshot,
          entryPassives: { ...broadcastStatus.entryPassives },
          firstClashMutedUsed: broadcastStatus.firstClashMutedUsed,
          entryPassiveReasons: { ...broadcastStatus.entryPassiveReasons },
          choices: {
            mute: { ...broadcastStatus.choices.mute },
            broadcast: { ...broadcastStatus.choices.broadcast }
          }
        }
      };
    }
    case 'lost_shelter': {
      const escortStatus = getEscortCheckpointStatus(current, availableHealingPills);
      const checkpointLabels: Readonly<Record<EscortCheckpointNodeId, string>> = {
        north_checkpoint: '北',
        central_checkpoint: '中',
        south_checkpoint: '南'
      };
      const choiceLabels: Readonly<Record<EscortCheckpointChoice, string>> = {
        treat: '救治',
        push: '强推'
      };
      const choiceSummary = ESCORT_CHECKPOINT_NODE_IDS.map((nodeId) => {
        const choice = escortStatus.resolvedCheckpointChoices[nodeId];
        return `${checkpointLabels[nodeId]}:${choice ? choiceLabels[choice] : '未定'}`;
      }).join('，');
      const pendingText = escortStatus.pendingCheckpointNodeId
        ? `，待处理 ${checkpointLabels[escortStatus.pendingCheckpointNodeId]}检查点`
        : '';
      const snapshotText = escortStatus.bossSurvivorSnapshot === null
        ? '未冻结'
        : String(escortStatus.bossSurvivorSnapshot);
      const gearText = [
        `卡宾枪:${escortStatus.entryGear.rescueCarbine ? '有' : '无'}`,
        `目镜:${escortStatus.entryGear.triageVisor ? '有' : '无'}`,
        `护甲:${escortStatus.entryGear.evacuationPlate ? '有' : '无'}`,
        `信标:${escortStatus.entryGear.blackboxBeacon ? '有' : '无'}`
      ].join('，');
      const treat = escortStatus.choices.treat;
      const push = escortStatus.choices.push;
      const companionUsedText = `护卫:${escortStatus.firstHazardGuardUsed ? '已用' : '未用'}，研判:${escortStatus.companionAnalysisUsed ? '已用' : '未用'}，分诊:${escortStatus.companionTriageUsed ? '已用' : '未用'}`;
      return {
        dungeonId: current.dungeonId,
        title: '失联护送律',
        status: `幸存者HP ${escortStatus.survivorHp}/100，${choiceSummary}，救治 ${escortStatus.treatCount}，强推 ${escortStatus.pushCount}${pendingText}，run止血丹 ${availableHealingPills}，救治 HP${treat.survivorHpDelta >= 0 ? '+' : ''}${treat.survivorHpDelta}/耗药${treat.healingPillCost}，强推 HP${push.survivorHpDelta >= 0 ? '+' : ''}${push.survivorHpDelta}/奖励${push.bonusRewardPoints}，${gearText}，${escortStatus.companionRole}，${companionUsedText}，Boss快照 ${snapshotText}`,
        severity: escortStatus.survivorHp === 0
          ? 'danger'
          : escortStatus.bossSurvivorSnapshot !== null || escortStatus.allCheckpointsResolved
            ? 'resolved'
            : escortStatus.pending || escortStatus.survivorHp <= 40
              ? 'danger'
              : escortStatus.survivorHp <= 74
                ? 'warning'
                : 'stable',
        meter: { value: escortStatus.survivorHp, max: 100 },
        targetReached: escortStatus.allCheckpointsResolved && !escortStatus.pending,
        modifiers,
        escort: {
          totalCheckpointCount: 3,
          survivorHp: escortStatus.survivorHp,
          availableHealingPills,
          pendingCheckpointNodeId: escortStatus.pendingCheckpointNodeId,
          resolvedCheckpointChoices: { ...escortStatus.resolvedCheckpointChoices },
          resolvedCount: escortStatus.resolvedCount,
          treatCount: escortStatus.treatCount,
          pushCount: escortStatus.pushCount,
          bossSurvivorSnapshot: escortStatus.bossSurvivorSnapshot,
          entryGear: { ...escortStatus.entryGear },
          entryCompanion: { ...escortStatus.entryCompanion },
          firstHazardGuardUsed: escortStatus.firstHazardGuardUsed,
          companionAnalysisUsed: escortStatus.companionAnalysisUsed,
          companionTriageUsed: escortStatus.companionTriageUsed,
          companionRole: escortStatus.companionRole,
          choices: {
            treat: { ...escortStatus.choices.treat },
            push: { ...escortStatus.choices.push }
          }
        }
      };
    }
    case 'false_testimony_court': {
      const testimony = getFalseTestimonyStatus(current);
      const evidenceLabels: Readonly<Record<FalseTestimonyEvidenceId, string>> = {
        voice_evidence: '声纹',
        timeline_evidence: '时序',
        residue_evidence: '残留'
      };
      const suspectLabels: Readonly<Record<FalseTestimonySuspect, string>> = {
        records_keeper: '档案保管员',
        field_medic: '现场医师',
        security_chief: '安保主管',
        route_surveyor: '路线勘测员'
      };
      const evidenceText = testimony.evidence.map((evidence) =>
        `${evidenceLabels[evidence.id]}:${evidence.contaminated ? '污染' : evidence.revealed ? '净' : '未揭示'}`
      ).join('，');
      const eliminatedText = testimony.eliminatedSuspects.length > 0
        ? testimony.eliminatedSuspects.map((suspect) => suspectLabels[suspect]).join('/')
        : '无';
      const gearText = [
        `裁刃:${testimony.entryGear.crossExaminerSabre ? '有' : '无'}`,
        `目镜:${testimony.entryGear.forensicVisor ? '有' : '无'}`,
        `护甲:${testimony.entryGear.custodyShell ? testimony.custodyProtectionUsed ? '已用' : '有' : '无'}`,
        `印玺:${testimony.entryGear.appealSeal ? '有' : '无'}`
      ].join('，');
      const verdictText = testimony.accusedSuspect
        ? `${suspectLabels[testimony.accusedSuspect]}/${testimony.accusationCorrect ? '正确' : '错误'}/冻结可信${testimony.accusationTrustedCount}`
        : '未裁决';
      const pendingText = testimony.pendingVerdictNodeId ?? '无';
      const snapshot = testimony.bossVerdictSnapshot;
      const snapshotText = snapshot
        ? `${suspectLabels[snapshot.suspect]}/${snapshot.correct ? '正确' : '错误'}/可信${snapshot.trustedCount}/${snapshot.appealed ? '翻案' : '原判'}/排除${snapshot.eliminatedSuspects.length}`
        : '未冻结';
      return {
        dungeonId: current.dungeonId,
        title: '伪证裁定律',
        status: `${evidenceText}，排除:${eliminatedText}，${gearText}，裁决:${verdictText}，待处理:${pendingText}，预计奖励:${testimony.projectedAccusationRewardPoints}，翻案:${testimony.appealEligible ? '可' : '不可'}，Boss快照:${snapshotText}`,
        severity: snapshot || (testimony.accusationCorrect !== null && !testimony.pendingVerdictNodeId)
          ? 'resolved'
          : testimony.pendingVerdictNodeId || testimony.accusationCorrect === false
            ? 'danger'
            : testimony.evidence.some((evidence) => evidence.contaminated)
              ? 'warning'
              : 'stable',
        meter: {
          value: testimony.evidence.filter((evidence) => evidence.revealed).length,
          max: 3
        },
        targetReached: testimony.accusedSuspect !== null && testimony.pendingVerdictNodeId === null,
        modifiers,
        falseTestimony: testimony
      };
    }
    case 'combat_replay_stage': {
      const replay = getCombatReplayStatus(current);
      const actionLabels: Readonly<Record<CombatReplayAction, string>> = {
        attack: '攻击',
        art: '战技',
        guard: '防御'
      };
      const routeLabels: Readonly<Record<CombatReplayRoute, string>> = {
        sequence: '顺序剪辑',
        burst: '爆发剪辑',
        afterbeat: '余拍剪辑'
      };
      const takeText = replay.takes.map((take, index) => take
        ? `${index + 1}:${actionLabels[take.action]} ${take.observedValue}->${take.replayValue}`
        : `${index + 1}:未录制`
      ).join('，');
      const routeText = replay.route ? routeLabels[replay.route] : '未选择';
      return {
        dungeonId: current.dungeonId,
        title: '战痕复演律',
        status: `${takeText}，路线:${routeText}，Boss快照:${replay.bossSnapshot ? '已冻结' : '未冻结'}`,
        severity: replay.bossSnapshot
          ? 'resolved'
          : replay.readyForBoss
            ? 'stable'
            : replay.readyForRoute
              ? 'warning'
              : 'danger',
        meter: { value: replay.completedTakeCount, max: 3 },
        targetReached: replay.readyForBoss,
        modifiers,
        combatReplay: replay
      };
    }
    case 'panopticon_city': {
      const panopticon = getPanopticonStatus(current);
      const routeLabels: Readonly<Record<PanopticonRoute, string>> = {
        shadow: '影路',
        decoy: '诱饵',
        refraction: '折光'
      };
      const snapshot = panopticon.bossSnapshot;
      return {
        dungeonId: current.dungeonId,
        title: '三相监察律',
        status: `相位:${panopticon.scanPhase}，移动:${panopticon.moveCount}，曝光:${panopticon.exposureCount}，中继:${panopticon.completedRelayCount}/3，路线:${panopticon.route ? routeLabels[panopticon.route] : '未选择'}，折光:${panopticon.refractionCharges}/3，诱饵奖励:${panopticon.decoyRewardsGranted}/3，Boss快照:${snapshot ? `${routeLabels[snapshot.route]}/${snapshot.exposureCount}/${snapshot.refractionCharges}` : '未冻结'}`,
        severity: snapshot
          ? 'resolved'
          : panopticon.readyForBoss
            ? 'stable'
            : panopticon.readyForRoute
              ? 'warning'
              : 'danger',
        meter: { value: panopticon.completedRelayCount, max: 3 },
        targetReached: panopticon.readyForBoss,
        modifiers,
        panopticon
      };
    }
  }
}
