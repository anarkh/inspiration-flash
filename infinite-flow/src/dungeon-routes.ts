import type { DungeonId } from './game';
import {
  DUNGEON_LAW_LANDMARKS,
  COMBAT_REPLAY_STAGE_DUNGEON_ID,
  PANOPTICON_CITY_DUNGEON_ID,
  FALSE_TESTIMONY_COURT_DUNGEON_ID,
  GENESIS_VAULT_DUNGEON_ID,
  LOST_SHELTER_DUNGEON_ID,
  SILENT_BROADCAST_TOWER_DUNGEON_ID
} from './dungeon-laws';
import type {
  ArchiveSealableFeature,
  AuctionLot,
  AuctionLotNodeId,
  CombatOpeningStyle,
  CombatReplayRoute,
  CombatReplayTakeNodeId,
  DungeonLawState,
  FalseTestimonyEvidenceId,
  FalseTestimonyTrapNodeId,
  GenesisGene,
  MirrorCityPhase,
  MetroTide,
  MineGravity,
  PanopticonRoute,
  RedactionClauseNodeId
} from './dungeon-laws';

export type DungeonRouteDungeonId = DungeonId |
  typeof GENESIS_VAULT_DUNGEON_ID |
  typeof SILENT_BROADCAST_TOWER_DUNGEON_ID |
  typeof COMBAT_REPLAY_STAGE_DUNGEON_ID;

export type DungeonRouteLawRequirementByDungeon = {
  readonly demon_tower_1: {
    readonly kind: 'fog_pressure_at_most';
    readonly maximum: number;
  };
  readonly metro_abyss: {
    readonly kind: 'metro_tide';
    readonly tide: MetroTide;
  };
  readonly starfall_mine: {
    readonly kind: 'mine_gravity';
    readonly gravity: MineGravity;
  };
  readonly rust_hospital: {
    readonly kind: 'pollution_at_most';
    readonly maximum: number;
  };
  readonly ash_arena: {
    readonly kind: 'all_opening_styles';
  } | {
    readonly kind: 'opening_style_victories_at_least';
    readonly style: CombatOpeningStyle;
    readonly minimum: number;
  };
  readonly dream_archive: {
    readonly kind: 'archive_feature_available';
    readonly feature: ArchiveSealableFeature;
  };
  readonly void_citadel: {
    readonly kind: 'balanced_opening_distribution';
    readonly maximumSpread: number;
  } | {
    readonly kind: 'opening_style_victories_at_least';
    readonly style: CombatOpeningStyle;
    readonly minimum: number;
  };
  readonly temporal_observatory: {
    readonly kind: 'past_calibrated';
  } | {
    readonly kind: 'future_calibrated';
  } | {
    readonly kind: 'dual_calibrated';
  };
  readonly causal_clearinghouse: {
    readonly kind: 'debt_at_most';
    readonly maximum: number;
  };
  readonly entropy_ark: {
    readonly kind: 'entropy_at_most';
    readonly maximum: number;
  } | {
    readonly kind: 'entropy_at_least';
    readonly minimum: number;
  } | {
    readonly kind: 'entropy_between';
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly mirror_cycle_city: {
    readonly kind: 'mirror_city_phase';
    readonly phase: MirrorCityPhase;
  } | {
    readonly kind: 'mirror_city_all_phase_choices';
  } | {
    readonly kind: 'mirror_city_real_anchor';
  } | {
    readonly kind: 'mirror_city_mirror_anchor';
  } | {
    readonly kind: 'mirror_city_dual_anchors';
  };
  readonly redaction_scriptorium: {
    readonly kind: 'redaction_clause_certified';
    readonly clause: RedactionClauseNodeId;
  } | {
    readonly kind: 'redaction_all_clauses_resolved';
  };
  readonly legacy_auction_court: {
    readonly kind: 'auction_lot_bid';
    readonly lot: AuctionLot;
  } | {
    readonly kind: 'auction_all_lots_resolved';
  };
  readonly genesis_vault: {
    readonly kind: 'genesis_gene_count_at_least';
    readonly gene: GenesisGene;
    readonly minimum: number;
  } | {
    readonly kind: 'genesis_three_unique_genes';
  } | {
    readonly kind: 'genesis_splice_complete';
  };
  readonly silent_broadcast_tower: {
    readonly kind: 'broadcast_mute_count_at_least_and_noise_at_most';
    readonly minimumMuteCount: number;
    readonly maximumNoise: number;
  } | {
    readonly kind: 'broadcast_count_at_least_and_noise_at_least';
    readonly minimumBroadcastCount: number;
    readonly minimumNoise: number;
  } | {
    readonly kind: 'broadcast_all_relays_resolved_and_noise_between';
    readonly minimumNoise: number;
    readonly maximumNoise: number;
  } | {
    readonly kind: 'broadcast_all_relays_resolved';
  };
  readonly lost_shelter: {
    readonly kind: 'escort_all_checkpoints_resolved_and_hp_at_least';
    readonly minimumHp: number;
  } | {
    readonly kind: 'escort_all_checkpoints_resolved_and_hp_at_most';
    readonly maximumHp: number;
  } | {
    readonly kind: 'escort_all_checkpoints_resolved_and_hp_between';
    readonly minimumHp: number;
    readonly maximumHp: number;
  } | {
    readonly kind: 'escort_all_checkpoints_resolved';
  };
  readonly false_testimony_court: FalseTestimonyRouteAtomicRequirement | {
    readonly kind: 'false_testimony_all';
    readonly requirements: readonly FalseTestimonyRouteAtomicRequirement[];
  };
  readonly combat_replay_stage: CombatReplayRouteAtomicRequirement | {
    readonly kind: 'combat_replay_all';
    readonly requirements: readonly CombatReplayRouteAtomicRequirement[];
  };
  readonly panopticon_city: PanopticonRouteAtomicRequirement | {
    readonly kind: 'panopticon_all';
    readonly requirements: readonly PanopticonRouteAtomicRequirement[];
  };
};

export type FalseTestimonyRouteAtomicRequirement = {
  readonly kind: 'false_testimony_trap_cleared';
  readonly trapNodeId: FalseTestimonyTrapNodeId;
} | {
  readonly kind: 'false_testimony_evidence_exit';
  readonly evidenceId: FalseTestimonyEvidenceId;
} | {
  readonly kind: 'false_testimony_evidence_revealed';
} | {
  readonly kind: 'false_testimony_truth_archive';
} | {
  readonly kind: 'false_testimony_swift_armory';
} | {
  readonly kind: 'false_testimony_false_vault';
} | {
  readonly kind: 'false_testimony_appeal_entry';
} | {
  readonly kind: 'false_testimony_appeal_exit';
} | {
  readonly kind: 'false_testimony_verdict_complete';
};

export type CombatReplayRouteAtomicRequirement = {
  readonly kind: 'combat_replay_take_entry';
  readonly takeNodeId: CombatReplayTakeNodeId;
} | {
  readonly kind: 'combat_replay_take_exit';
  readonly takeNodeId: CombatReplayTakeNodeId;
} | {
  readonly kind: 'combat_replay_selected_route';
  readonly route: CombatReplayRoute;
} | {
  readonly kind: 'combat_replay_boss_ready';
} | {
  readonly kind: 'combat_replay_boss_defeated';
};

export type PanopticonRouteAtomicRequirement = {
  readonly kind: 'panopticon_selected_route';
  readonly route: PanopticonRoute;
} | {
  readonly kind: 'panopticon_boss_ready';
} | {
  readonly kind: 'panopticon_boss_defeated';
};

export type DungeonRouteLawRequirement =
  DungeonRouteLawRequirementByDungeon[DungeonRouteDungeonId];

export type DungeonRouteSectorMetadata = {
  readonly id: string;
  readonly label: string;
};

export type DungeonRouteGateDefinition<
  Dungeon extends DungeonRouteDungeonId = DungeonRouteDungeonId
> = {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly label: string;
  readonly sector?: DungeonRouteSectorMetadata;
  readonly closedReason?: string;
  readonly requirement: DungeonRouteLawRequirementByDungeon[Dungeon];
};

export type DungeonRouteGateCatalog = {
  readonly [Dungeon in DungeonRouteDungeonId]: readonly DungeonRouteGateDefinition<Dungeon>[];
};

export type DungeonRouteGateStatus =
  | {
      readonly gate: DungeonRouteGateDefinition;
      readonly status: 'open';
      readonly isOpen: true;
      readonly blockReason?: undefined;
    }
  | {
      readonly gate: DungeonRouteGateDefinition;
      readonly status: 'closed';
      readonly isOpen: false;
      readonly blockReason: string;
    };

export type DungeonRouteSectorDisplay = {
  readonly id: string;
  readonly label: string;
  readonly gateCount: number;
  readonly openGateCount: number;
  readonly closedGateCount: number;
  readonly status: 'open' | 'partial' | 'closed';
  readonly blockReasons: readonly string[];
};

const FALSE_TESTIMONY_TRAP_BY_EVIDENCE = {
  voice_evidence: 'voice_filter_trap',
  timeline_evidence: 'timeline_checksum_trap',
  residue_evidence: 'residue_sterility_trap'
} as const;

const FALSE_TESTIMONY_GATED_EDGES = [
  ['truth_archive', 'voice_evidence'],
  ['truth_archive', 'records_stacks'],
  ['voice_evidence', 'voice_filter_trap'],
  ['voice_evidence', 'testimony_hall'],
  ['timeline_evidence', 'testimony_hall'],
  ['timeline_evidence', 'timeline_checksum_trap'],
  ['timeline_evidence', 'voice_filter_trap'],
  ['timeline_evidence', 'verdict_chamber'],
  ['residue_evidence', 'lower_entry'],
  ['residue_evidence', 'perjury_hound_omega'],
  ['residue_evidence', 'residue_sterility_trap'],
  ['residue_evidence', 'hostile_witness'],
  ['swift_judgment_armory', 'archive_censor_alpha'],
  ['swift_judgment_armory', 'upper_return_portal'],
  ['swift_judgment_armory', 'verdict_exit'],
  ['false_verdict_vault', 'soul_recharge_verdict'],
  ['false_verdict_vault', 'lower_return_portal'],
  ['appeal_desk', 'perjury_hound_omega'],
  ['appeal_desk', 'cross_exam_stage'],
  ['appeal_desk', 'false_testimony_judge'],
  ['appeal_desk', 'evidence_supply_cache'],
  ['verdict_chamber', 'residue_sterility_trap'],
  ['verdict_chamber', 'perjury_hound_omega'],
  ['verdict_chamber', 'false_testimony_judge'],
  ['timeline_checksum_trap', 'false_testimony_judge'],
  ['false_testimony_judge', 'judgment_lock']
] as const;

function getFalseTestimonyEdgeRequirements(
  fromNodeId: string,
  toNodeId: string
): FalseTestimonyRouteAtomicRequirement[] {
  const requirements: FalseTestimonyRouteAtomicRequirement[] = [];
  for (const evidenceId of DUNGEON_LAW_LANDMARKS.false_testimony_court.evidenceNodeIds) {
    if (toNodeId === evidenceId) {
      requirements.push({
        kind: 'false_testimony_trap_cleared',
        trapNodeId: FALSE_TESTIMONY_TRAP_BY_EVIDENCE[evidenceId]
      });
    } else if (fromNodeId === evidenceId) {
      requirements.push({ kind: 'false_testimony_evidence_exit', evidenceId });
    }
  }
  if (fromNodeId === 'truth_archive' || toNodeId === 'truth_archive') {
    requirements.push({ kind: 'false_testimony_truth_archive' });
  }
  if (fromNodeId === 'swift_judgment_armory' || toNodeId === 'swift_judgment_armory') {
    requirements.push({ kind: 'false_testimony_swift_armory' });
  }
  if (fromNodeId === 'false_verdict_vault' || toNodeId === 'false_verdict_vault') {
    requirements.push({ kind: 'false_testimony_false_vault' });
  }
  if (toNodeId === 'appeal_desk') {
    requirements.push({ kind: 'false_testimony_appeal_entry' });
  } else if (fromNodeId === 'appeal_desk') {
    requirements.push({ kind: 'false_testimony_appeal_exit' });
  }
  if (fromNodeId === 'false_testimony_judge' || toNodeId === 'false_testimony_judge') {
    requirements.push({ kind: 'false_testimony_verdict_complete' });
  } else if (toNodeId === 'verdict_chamber') {
    requirements.push({ kind: 'false_testimony_evidence_revealed' });
  } else if (fromNodeId === 'verdict_chamber') {
    requirements.push({ kind: 'false_testimony_evidence_revealed' });
  }
  return requirements;
}

const FALSE_TESTIMONY_ROUTE_GATES: readonly DungeonRouteGateDefinition<'false_testimony_court'>[] =
  FALSE_TESTIMONY_GATED_EDGES.flatMap(([leftNodeId, rightNodeId]) =>
    [[leftNodeId, rightNodeId], [rightNodeId, leftNodeId]].map(([fromNodeId, toNodeId]) => {
      const requirements = getFalseTestimonyEdgeRequirements(fromNodeId, toNodeId);
      const requirement: DungeonRouteLawRequirementByDungeon['false_testimony_court'] =
        requirements.length === 1
          ? requirements[0]
          : { kind: 'false_testimony_all', requirements };
      return {
        id: `false_testimony_${fromNodeId}_to_${toNodeId}`,
        fromNodeId,
        toNodeId,
        label: '伪证裁定门',
        sector: { id: `false_testimony_${leftNodeId}_${rightNodeId}`, label: '伪证裁定区' },
        requirement
      };
    })
  );

const COMBAT_REPLAY_GRID = [
  ['sequence_route', 'opening_prop_cache', 'opening_cue_trap', 'upper_entry', 'cue_stalker_north', 'upper_return_portal'],
  ['script_stacks', 'take_alpha', 'continuity_break_trap', 'take_beta', 'continuity_editor_alpha', 'burst_route'],
  ['stage_gate', 'blank_frame_trap', 'rehearsal_hall', 'take_gamma', 'final_cut_director', 'theater_exit'],
  ['lower_entry', 'projection_gallery', 'retake_double_omega', 'script_projection_stage', 'final_cut_lock', 'lower_return_portal'],
  ['field_survey_cutting_room', 'cue_stalker', 'return_rehearsal_portal', 'soul_recharge_stage', 'film_supply_cache', 'afterbeat_route']
] as const;

const COMBAT_REPLAY_ROUTE_BY_NODE_ID = {
  sequence_route: 'sequence',
  burst_route: 'burst',
  afterbeat_route: 'afterbeat'
} as const;

function getCombatReplayEdgeRequirements(
  fromNodeId: string,
  toNodeId: string
): CombatReplayRouteAtomicRequirement[] {
  const requirements: CombatReplayRouteAtomicRequirement[] = [];
  const fromTakeIndex = DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.indexOf(
    fromNodeId as CombatReplayTakeNodeId
  );
  const toTakeIndex = DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.indexOf(
    toNodeId as CombatReplayTakeNodeId
  );
  if (fromTakeIndex >= 0) {
    requirements.push({
      kind: 'combat_replay_take_exit',
      takeNodeId: fromNodeId as CombatReplayTakeNodeId
    });
  }
  if (
    toTakeIndex >= 0 &&
    fromNodeId !== 'final_cut_director' &&
    (fromTakeIndex < 0 || fromTakeIndex < toTakeIndex)
  ) {
    requirements.push({
      kind: 'combat_replay_take_entry',
      takeNodeId: toNodeId as CombatReplayTakeNodeId
    });
  }
  const routeNodeId = Object.prototype.hasOwnProperty.call(COMBAT_REPLAY_ROUTE_BY_NODE_ID, fromNodeId)
    ? fromNodeId as keyof typeof COMBAT_REPLAY_ROUTE_BY_NODE_ID
    : Object.prototype.hasOwnProperty.call(COMBAT_REPLAY_ROUTE_BY_NODE_ID, toNodeId)
      ? toNodeId as keyof typeof COMBAT_REPLAY_ROUTE_BY_NODE_ID
      : null;
  if (routeNodeId) {
    requirements.push({
      kind: 'combat_replay_selected_route',
      route: COMBAT_REPLAY_ROUTE_BY_NODE_ID[routeNodeId]
    });
  }
  if (fromNodeId === 'final_cut_director' || toNodeId === 'final_cut_director') {
    requirements.push({ kind: 'combat_replay_boss_ready' });
  }
  if (fromNodeId === 'theater_exit' || toNodeId === 'theater_exit') {
    requirements.push({ kind: 'combat_replay_boss_defeated' });
  }
  return requirements;
}

const COMBAT_REPLAY_EDGES = COMBAT_REPLAY_GRID.flatMap((row, y) =>
  row.flatMap((nodeId, x) => {
    const right = row[x + 1];
    const down = COMBAT_REPLAY_GRID[y + 1]?.[x];
    const edges: [string, string][] = [];
    if (right) edges.push([nodeId, right]);
    if (down) edges.push([nodeId, down]);
    return edges;
  })
);

const COMBAT_REPLAY_ROUTE_GATES: readonly DungeonRouteGateDefinition<'combat_replay_stage'>[] =
  COMBAT_REPLAY_EDGES.flatMap(([leftNodeId, rightNodeId]) =>
    [[leftNodeId, rightNodeId], [rightNodeId, leftNodeId]].flatMap(([fromNodeId, toNodeId]) => {
      const requirements = getCombatReplayEdgeRequirements(fromNodeId, toNodeId);
      if (requirements.length === 0) return [];
      const requirement: DungeonRouteLawRequirementByDungeon['combat_replay_stage'] =
        requirements.length === 1
          ? requirements[0]
          : { kind: 'combat_replay_all', requirements };
      return [{
        id: `combat_replay_${fromNodeId}_to_${toNodeId}`,
        fromNodeId,
        toNodeId,
        label: '战痕复演门',
        sector: { id: `combat_replay_${leftNodeId}_${rightNodeId}`, label: '战痕复演场' },
        ...(requirements.some((part) => part.kind === 'combat_replay_boss_defeated')
          ? { closedReason: '击败最终剪辑师后方可离场。' }
          : {}),
        requirement
      }];
    })
  );

const PANOPTICON_GRID = [
  ['shadow_route', 'blindline_archive', 'north_blind_relay', 'upper_entry', 'sweep_sentinel_north', 'upper_return_portal'],
  ['all_sight_lock', 'blindspot_theater', 'scan_lattice_trap', 'central_blind_relay', 'blindspot_auditor_north', 'decoy_route'],
  ['panopticon_gate', 'watchglass_cache', 'exposure_double_patrol', 'south_blind_relay', 'all_sight_warden', 'blind_dawn_exit'],
  ['lower_entry', 'matte_supply', 'blind_angle_trap', 'refraction_lab', 'spectrum_switchyard', 'lower_return_portal'],
  ['inverse_observation_stage', 'sweep_sentinel', 'refraction_return_portal', 'soul_recharge_panopticon', 'exposure_double', 'refraction_route']
] as const;

const PANOPTICON_ROUTE_BY_NODE_ID = {
  shadow_route: 'shadow',
  decoy_route: 'decoy',
  refraction_route: 'refraction'
} as const;

function getPanopticonEdgeRequirements(
  fromNodeId: string,
  toNodeId: string
): PanopticonRouteAtomicRequirement[] {
  const requirements: PanopticonRouteAtomicRequirement[] = [];
  const routeNodeId = Object.prototype.hasOwnProperty.call(PANOPTICON_ROUTE_BY_NODE_ID, fromNodeId)
    ? fromNodeId as keyof typeof PANOPTICON_ROUTE_BY_NODE_ID
    : Object.prototype.hasOwnProperty.call(PANOPTICON_ROUTE_BY_NODE_ID, toNodeId)
      ? toNodeId as keyof typeof PANOPTICON_ROUTE_BY_NODE_ID
      : null;
  if (routeNodeId) {
    requirements.push({
      kind: 'panopticon_selected_route',
      route: PANOPTICON_ROUTE_BY_NODE_ID[routeNodeId]
    });
  }
  if (fromNodeId === 'all_sight_warden' || toNodeId === 'all_sight_warden') {
    requirements.push({ kind: 'panopticon_boss_ready' });
  }
  if (fromNodeId === 'blind_dawn_exit' || toNodeId === 'blind_dawn_exit') {
    requirements.push({ kind: 'panopticon_boss_defeated' });
  }
  return requirements;
}

const PANOPTICON_EDGES = PANOPTICON_GRID.flatMap((row, y) =>
  row.flatMap((nodeId, x) => {
    const right = row[x + 1];
    const down = PANOPTICON_GRID[y + 1]?.[x];
    const edges: [string, string][] = [];
    if (right) edges.push([nodeId, right]);
    if (down) edges.push([nodeId, down]);
    return edges;
  })
);

const PANOPTICON_ROUTE_GATES: readonly DungeonRouteGateDefinition<'panopticon_city'>[] =
  PANOPTICON_EDGES.flatMap(([leftNodeId, rightNodeId]) =>
    [[leftNodeId, rightNodeId], [rightNodeId, leftNodeId]].flatMap(([fromNodeId, toNodeId]) => {
      const requirements = getPanopticonEdgeRequirements(fromNodeId, toNodeId);
      if (requirements.length === 0) return [];
      const requirement: DungeonRouteLawRequirementByDungeon['panopticon_city'] =
        requirements.length === 1
          ? requirements[0]
          : { kind: 'panopticon_all', requirements };
      return [{
        id: `panopticon_${fromNodeId}_to_${toNodeId}`,
        fromNodeId,
        toNodeId,
        label: '天幕监察门',
        sector: { id: `panopticon_${leftNodeId}_${rightNodeId}`, label: '天幕监察城' },
        ...(requirements.some((part) => part.kind === 'panopticon_boss_defeated')
          ? { closedReason: '击败万目监察者后方可离城。' }
          : {}),
        requirement
      }];
    })
  );

export const DUNGEON_ROUTE_GATES: DungeonRouteGateCatalog = {
  demon_tower_1: [
    {
      id: 'demon_fog_bone_lane',
      fromNodeId: 'mist_herb_cache',
      toNodeId: 'bone_lane_monster',
      label: '镇雾近阶',
      sector: { id: 'tower_bone_lane', label: '镇雾近阶' },
      requirement: { kind: 'fog_pressure_at_most', maximum: 1 }
    },
    {
      id: 'demon_clear_blood_stair',
      fromNodeId: 'blood_rune_trap',
      toNodeId: 'left_watch_trap',
      label: '清雾血阶',
      sector: { id: 'tower_upper_stairs', label: '清雾上阶' },
      requirement: { kind: 'fog_pressure_at_most', maximum: 0 }
    },
    {
      id: 'demon_clear_portal_stair',
      fromNodeId: 'lower_fog_lesser',
      toNodeId: 'cracked_portal',
      label: '清雾裂阶',
      sector: { id: 'tower_upper_stairs', label: '清雾上阶' },
      requirement: { kind: 'fog_pressure_at_most', maximum: 0 }
    },
    {
      id: 'demon_hushed_herb_stair',
      fromNodeId: 'north_supply_niche',
      toNodeId: 'mist_herb_cache',
      label: '静雾药阶',
      sector: { id: 'tower_lower_stairs', label: '静雾下阶' },
      requirement: { kind: 'fog_pressure_at_most', maximum: 1 }
    }
  ],
  metro_abyss: [
    {
      id: 'metro_ebb_boss_lane',
      fromNodeId: 'boatman_echo',
      toNodeId: 'mirror_thread_spider',
      label: '退潮直轨',
      sector: { id: 'metro_ebb_tracks', label: '退潮轨道' },
      requirement: { kind: 'metro_tide', tide: 'ebb' }
    },
    {
      id: 'metro_ebb_platform_track',
      fromNodeId: 'tide_boatman',
      toNodeId: 'mirror_tide_trap',
      label: '退潮站台轨',
      sector: { id: 'metro_ebb_tracks', label: '退潮轨道' },
      requirement: { kind: 'metro_tide', tide: 'ebb' }
    },
    {
      id: 'metro_flood_north_track',
      fromNodeId: 'coin_turnstile',
      toNodeId: 'north_floodgate_trap',
      label: '涨潮北轨',
      sector: { id: 'metro_flood_tracks', label: '涨潮轨道' },
      requirement: { kind: 'metro_tide', tide: 'flood' }
    },
    {
      id: 'metro_mirror_web_track',
      fromNodeId: 'mirror_web_cache',
      toNodeId: 'thread_snare_trap',
      label: '镜潮蛛网轨',
      sector: { id: 'metro_mirror_tracks', label: '镜潮轨道' },
      requirement: { kind: 'metro_tide', tide: 'mirror' }
    }
  ],
  starfall_mine: [
    {
      id: 'mine_upward_beast_lane',
      fromNodeId: 'rift_dust_reward',
      toNodeId: 'molt_beast_den',
      label: '上浮矿梯',
      sector: { id: 'mine_upward_lifts', label: '上浮矿梯组' },
      requirement: { kind: 'mine_gravity', gravity: 'upward' }
    },
    {
      id: 'mine_upward_coil_lift',
      fromNodeId: 'magnetic_rail_trap',
      toNodeId: 'coil_burst_trap',
      label: '上浮线圈梯',
      sector: { id: 'mine_upward_lifts', label: '上浮矿梯组' },
      requirement: { kind: 'mine_gravity', gravity: 'upward' }
    },
    {
      id: 'mine_downward_branch_lift',
      fromNodeId: 'tilted_gravity_switch',
      toNodeId: 'gravity_branch_reward',
      label: '下沉岔路梯',
      sector: { id: 'mine_downward_lifts', label: '下沉矿梯组' },
      requirement: { kind: 'mine_gravity', gravity: 'downward' }
    },
    {
      id: 'mine_downward_dust_lift',
      fromNodeId: 'spark_imp_switchback',
      toNodeId: 'rift_dust_reward',
      label: '下沉裂尘梯',
      sector: { id: 'mine_downward_lifts', label: '下沉矿梯组' },
      requirement: { kind: 'mine_gravity', gravity: 'downward' }
    }
  ],
  rust_hospital: [
    {
      id: 'hospital_clean_roof_lane',
      fromNodeId: 'roof_access_trap',
      toNodeId: 'chief_pulse_doctor',
      label: '净化天台门',
      sector: { id: 'hospital_treatment_wards', label: '治疗病房横廊' },
      requirement: { kind: 'pollution_at_most', maximum: 2 }
    },
    {
      id: 'hospital_pristine_isolation_corridor',
      fromNodeId: 'rust_gurney_trap',
      toNodeId: 'isolation_chart_reward',
      label: '无染隔离廊',
      sector: { id: 'hospital_clean_wards', label: '净化病房横廊' },
      requirement: { kind: 'pollution_at_most', maximum: 0 }
    },
    {
      id: 'hospital_clean_sterile_corridor',
      fromNodeId: 'sterile_corridor',
      toNodeId: 'disinfectant_mist_trap',
      label: '净化无菌廊',
      sector: { id: 'hospital_clean_wards', label: '净化病房横廊' },
      requirement: { kind: 'pollution_at_most', maximum: 1 }
    },
    {
      id: 'hospital_emergency_antidote_corridor',
      fromNodeId: 'sterilizer_trap',
      toNodeId: 'antidote_cabinet',
      label: '应急解毒廊',
      sector: { id: 'hospital_emergency_wards', label: '应急病房横廊' },
      requirement: { kind: 'pollution_at_most', maximum: 3 }
    }
  ],
  ash_arena: [
    {
      id: 'arena_three_style_judge_lane',
      fromNodeId: 'oath_cinders',
      toNodeId: 'furnace_judge',
      label: '三式裁决门',
      sector: { id: 'arena_triad_finale', label: '三式裁决线' },
      requirement: { kind: 'all_opening_styles' }
    },
    {
      id: 'arena_force_champion_lane',
      fromNodeId: 'ash_duelist',
      toNodeId: 'judgement_flame',
      label: '力式冠军线',
      sector: { id: 'arena_force_lanes', label: '力式胜场路线' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'force', minimum: 1 }
    },
    {
      id: 'arena_art_bench_lane',
      fromNodeId: 'ember_pit_duelist',
      toNodeId: 'side_bench_supplies',
      label: '术式边席线',
      sector: { id: 'arena_art_lanes', label: '术式胜场路线' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'art', minimum: 1 }
    },
    {
      id: 'arena_guard_oath_lane',
      fromNodeId: 'cinder_lancer',
      toNodeId: 'oath_cinders',
      label: '守式誓火线',
      sector: { id: 'arena_guard_lanes', label: '守式胜场路线' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'guard', minimum: 1 }
    }
  ],
  dream_archive: [
    {
      id: 'archive_method_jailer_lane',
      fromNodeId: 'paper_cut_trap',
      toNodeId: 'dream_jailer_second',
      label: '功法书脊',
      sector: { id: 'archive_method_stacks', label: '功法书区' },
      requirement: { kind: 'archive_feature_available', feature: 'method' }
    },
    {
      id: 'archive_method_ink_spine',
      fromNodeId: 'paper_librarian_echo',
      toNodeId: 'ink_sleep_trap',
      label: '功法墨脊',
      sector: { id: 'archive_method_stacks', label: '功法书区' },
      requirement: { kind: 'archive_feature_available', feature: 'method' }
    },
    {
      id: 'archive_consumable_librarian_spine',
      fromNodeId: 'failed_file_reward',
      toNodeId: 'paper_librarian',
      label: '道具馆主书脊',
      sector: { id: 'archive_consumable_stacks', label: '道具书区' },
      requirement: { kind: 'archive_feature_available', feature: 'consumable' }
    },
    {
      id: 'archive_pet_portal_spine',
      fromNodeId: 'method_fragment_reward',
      toNodeId: 'archive_portal',
      label: '灵宠界门书脊',
      sector: { id: 'archive_pet_stacks', label: '灵宠书区' },
      requirement: { kind: 'archive_feature_available', feature: 'pet' }
    }
  ],
  void_citadel: [
    {
      id: 'citadel_balanced_core_lane',
      fromNodeId: 'growth_mirror_trap',
      toNodeId: 'main_god_echo',
      label: '均衡核心门',
      sector: { id: 'citadel_balanced_core', label: '均衡核心区' },
      requirement: { kind: 'balanced_opening_distribution', maximumSpread: 1 }
    },
    {
      id: 'citadel_force_identity_lane',
      fromNodeId: 'void_knight',
      toNodeId: 'identity_trap',
      label: '力式身份线',
      sector: { id: 'citadel_force_core', label: '力式核心区' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'force', minimum: 1 }
    },
    {
      id: 'citadel_art_growth_lane',
      fromNodeId: 'first_echo_patrol',
      toNodeId: 'growth_mirror_trap',
      label: '术式成长线',
      sector: { id: 'citadel_art_core', label: '术式核心区' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'art', minimum: 1 }
    },
    {
      id: 'citadel_guard_echo_lane',
      fromNodeId: 'echo_gate_guard',
      toNodeId: 'echo_loop_trap',
      label: '守式回响线',
      sector: { id: 'citadel_guard_core', label: '守式核心区' },
      requirement: { kind: 'opening_style_victories_at_least', style: 'guard', minimum: 1 }
    }
  ],
  temporal_observatory: [
    {
      id: 'temporal_past_shortcut',
      fromNodeId: 'past_shortcut_foyer',
      toNodeId: 'erased_patrol',
      label: '往昔捷径',
      sector: { id: 'temporal_anchor_shortcuts', label: '时序锚点捷径' },
      requirement: { kind: 'past_calibrated' }
    },
    {
      id: 'temporal_future_shortcut',
      fromNodeId: 'future_shortcut_foyer',
      toNodeId: 'accelerated_patrol',
      label: '未来捷径',
      sector: { id: 'temporal_anchor_shortcuts', label: '时序锚点捷径' },
      requirement: { kind: 'future_calibrated' }
    },
    {
      id: 'temporal_calibration_bridge',
      fromNodeId: 'calibration_bridge',
      toNodeId: 'zero_hour_regent',
      label: '双锚校准桥',
      sector: { id: 'temporal_calibration_bridge', label: '双锚校准桥' },
      requirement: { kind: 'dual_calibrated' }
    },
    {
      id: 'temporal_boss_south_lock',
      fromNodeId: 'boss_south_lock',
      toNodeId: 'zero_hour_regent',
      label: '南侧时锁',
      sector: { id: 'temporal_regent_locks', label: '零点王庭时锁' },
      requirement: { kind: 'dual_calibrated' }
    },
    {
      id: 'temporal_east_time_lock',
      fromNodeId: 'east_time_lock',
      toNodeId: 'zero_hour_regent',
      label: '东侧时锁',
      sector: { id: 'temporal_regent_locks', label: '零点王庭时锁' },
      requirement: { kind: 'dual_calibrated' }
    }
  ],
  causal_clearinghouse: [
    {
      id: 'causal_cause_bailiff_lane',
      fromNodeId: 'cause_foyer',
      toNodeId: 'cause_bailiff',
      label: '因端执达门',
      sector: { id: 'causal_bailiff_lanes', label: '因果执达双廊' },
      requirement: { kind: 'debt_at_most', maximum: 2 }
    },
    {
      id: 'causal_effect_bailiff_lane',
      fromNodeId: 'effect_foyer',
      toNodeId: 'effect_bailiff',
      label: '果端执达门',
      sector: { id: 'causal_bailiff_lanes', label: '因果执达双廊' },
      requirement: { kind: 'debt_at_most', maximum: 2 }
    },
    {
      id: 'causal_verdict_bridge',
      fromNodeId: 'verdict_bridge',
      toNodeId: 'zero_sum_auditor',
      label: '裁定正桥',
      sector: { id: 'causal_auditor_locks', label: '零和审计锁' },
      requirement: { kind: 'debt_at_most', maximum: 2 }
    },
    {
      id: 'causal_north_verdict_lock',
      fromNodeId: 'north_verdict_lock',
      toNodeId: 'zero_sum_auditor',
      label: '北侧裁定锁',
      sector: { id: 'causal_auditor_locks', label: '零和审计锁' },
      requirement: { kind: 'debt_at_most', maximum: 1 }
    },
    {
      id: 'causal_east_verdict_lock',
      fromNodeId: 'east_verdict_lock',
      toNodeId: 'zero_sum_auditor',
      label: '东侧裁定锁',
      sector: { id: 'causal_auditor_locks', label: '零和审计锁' },
      requirement: { kind: 'debt_at_most', maximum: 3 }
    }
  ],
  entropy_ark: [
    {
      id: 'ark_bow_dissipation_lane',
      fromNodeId: 'bow_heading_console',
      toNodeId: 'dissipation_navigator_alpha',
      label: '艏部消散航道',
      sector: { id: 'ark_bow_dissipation_sector', label: '艏部低熵航区' },
      closedReason: '艏部消散航道仅在熵值 1 或以下开放。',
      requirement: { kind: 'entropy_at_most', maximum: 1 }
    },
    {
      id: 'ark_bow_port_relic_lane',
      fromNodeId: 'bow_heading_console',
      toNodeId: 'port_relic_hold',
      label: '艏部左舷遗珍道',
      sector: { id: 'ark_bow_relic_sector', label: '艏部高熵航区' },
      closedReason: '左舷遗珍舱需熵值达到 3 或以上。',
      requirement: { kind: 'entropy_at_least', minimum: 3 }
    },
    {
      id: 'ark_midship_dissipation_lane',
      fromNodeId: 'midship_heading_console',
      toNodeId: 'dissipation_navigator_omega',
      label: '舯部消散航道',
      sector: { id: 'ark_midship_dissipation_sector', label: '舯部低熵航区' },
      closedReason: '舯部消散航道仅在熵值 1 或以下开放。',
      requirement: { kind: 'entropy_at_most', maximum: 1 }
    },
    {
      id: 'ark_midship_starboard_relic_lane',
      fromNodeId: 'midship_heading_console',
      toNodeId: 'starboard_relic_hold',
      label: '舯部右舷遗珍道',
      sector: { id: 'ark_midship_relic_sector', label: '舯部高熵航区' },
      closedReason: '右舷遗珍舱需熵值达到 3 或以上。',
      requirement: { kind: 'entropy_at_least', minimum: 3 }
    },
    {
      id: 'ark_manifest_helmsman_lane',
      fromNodeId: 'ark_manifest',
      toNodeId: 'last_helmsman',
      label: '方舟显化舵门',
      sector: { id: 'ark_helmsman_sector', label: '末代舵手锁区' },
      closedReason: '方舟显化需熵值维持在 1 至 3 之间。',
      requirement: { kind: 'entropy_between', minimum: 1, maximum: 3 }
    }
  ],
  mirror_cycle_city: [
    {
      id: 'mirror_city_real_relic_phase_lane',
      fromNodeId: 'first_phase_mirror',
      toNodeId: 'real_relic_gallery',
      label: '现实遗珍相门',
      sector: { id: 'mirror_city_real_phase_branch', label: '现实相位支路' },
      requirement: { kind: 'mirror_city_phase', phase: 'real' }
    },
    {
      id: 'mirror_city_mirror_relic_phase_lane',
      fromNodeId: 'reflection_event_stage',
      toNodeId: 'mirror_relic_gallery',
      label: '镜像遗珍相门',
      sector: { id: 'mirror_city_mirror_phase_branch', label: '镜像相位支路' },
      requirement: { kind: 'mirror_city_phase', phase: 'mirror' }
    },
    {
      id: 'mirror_city_real_anchor_survey_lane',
      fromNodeId: 'real_anchor',
      toNodeId: 'mirror_city_survey',
      label: '现实锚测绘门',
      sector: { id: 'mirror_city_anchor_branches', label: '镜城锚点支路' },
      requirement: { kind: 'mirror_city_real_anchor' }
    },
    {
      id: 'mirror_city_mirror_anchor_recharge_lane',
      fromNodeId: 'mirror_anchor',
      toNodeId: 'soul_recharge_mirror',
      label: '镜像锚回魂门',
      sector: { id: 'mirror_city_anchor_branches', label: '镜城锚点支路' },
      requirement: { kind: 'mirror_city_mirror_anchor' }
    },
    {
      id: 'mirror_city_dual_anchor_survey_lane',
      fromNodeId: 'cycle_manifest',
      toNodeId: 'mirror_city_survey',
      label: '双锚折返测绘门',
      sector: { id: 'mirror_city_anchor_branches', label: '镜城锚点支路' },
      requirement: { kind: 'mirror_city_dual_anchors' }
    },
    {
      id: 'mirror_city_manifest_boss_approach',
      fromNodeId: 'cycle_manifest',
      toNodeId: 'nameless_reflection',
      label: '轮回显化王门',
      sector: { id: 'mirror_city_boss_approaches', label: '无名镜王四门' },
      requirement: { kind: 'mirror_city_all_phase_choices' }
    },
    {
      id: 'mirror_city_upper_boss_approach',
      fromNodeId: 'parallax_corridor_trap',
      toNodeId: 'nameless_reflection',
      label: '视差上行王门',
      sector: { id: 'mirror_city_boss_approaches', label: '无名镜王四门' },
      requirement: { kind: 'mirror_city_all_phase_choices' }
    },
    {
      id: 'mirror_city_side_boss_approach',
      fromNodeId: 'boss_side_trap',
      toNodeId: 'nameless_reflection',
      label: '裂镜侧行王门',
      sector: { id: 'mirror_city_boss_approaches', label: '无名镜王四门' },
      requirement: { kind: 'mirror_city_all_phase_choices' }
    },
    {
      id: 'mirror_city_lower_boss_approach',
      fromNodeId: 'third_phase_mirror',
      toNodeId: 'nameless_reflection',
      label: '末相下行王门',
      sector: { id: 'mirror_city_boss_approaches', label: '无名镜王四门' },
      requirement: { kind: 'mirror_city_all_phase_choices' }
    }
  ],
  redaction_scriptorium: [
    {
      id: 'redaction_memory_north_entry',
      fromNodeId: 'north_clue_cache',
      toNodeId: 'memory_survey_archive',
      label: '记忆认证北门',
      sector: { id: 'redaction_memory_clause_area', label: '记忆条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'memory_clause_desk' }
    },
    {
      id: 'redaction_memory_upper_entry',
      fromNodeId: 'upper_supply_margin',
      toNodeId: 'memory_survey_archive',
      label: '记忆认证上门',
      sector: { id: 'redaction_memory_clause_area', label: '记忆条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'memory_clause_desk' }
    },
    {
      id: 'redaction_body_censor_entry',
      fromNodeId: 'palimpsest_censor_alpha',
      toNodeId: 'body_proof_vault',
      label: '肉身认证校门',
      sector: { id: 'redaction_body_clause_area', label: '肉身条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'body_clause_desk' }
    },
    {
      id: 'redaction_body_upper_entry',
      fromNodeId: 'upper_revision_portal',
      toNodeId: 'body_proof_vault',
      label: '肉身认证上门',
      sector: { id: 'redaction_body_clause_area', label: '肉身条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'body_clause_desk' }
    },
    {
      id: 'redaction_return_south_entry',
      fromNodeId: 'south_clue_cache',
      toNodeId: 'return_revision_portal',
      label: '归返认证南门',
      sector: { id: 'redaction_return_clause_area', label: '归返条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'return_clause_desk' }
    },
    {
      id: 'redaction_return_lower_entry',
      fromNodeId: 'lower_supply_margin',
      toNodeId: 'return_revision_portal',
      label: '归返认证下门',
      sector: { id: 'redaction_return_clause_area', label: '归返条款选区' },
      requirement: { kind: 'redaction_clause_certified', clause: 'return_clause_desk' }
    },
    {
      id: 'redaction_final_proof_boss_gate',
      fromNodeId: 'final_proof_nexus',
      toNodeId: 'last_redactor',
      label: '终稿核验王门',
      sector: { id: 'redaction_boss_approaches', label: '末代删改者四门' },
      requirement: { kind: 'redaction_all_clauses_resolved' }
    },
    {
      id: 'redaction_north_boss_gate',
      fromNodeId: 'boss_north_lock',
      toNodeId: 'last_redactor',
      label: '终稿北锁王门',
      sector: { id: 'redaction_boss_approaches', label: '末代删改者四门' },
      requirement: { kind: 'redaction_all_clauses_resolved' }
    },
    {
      id: 'redaction_side_boss_gate',
      fromNodeId: 'boss_side_lock',
      toNodeId: 'last_redactor',
      label: '终稿侧锁王门',
      sector: { id: 'redaction_boss_approaches', label: '末代删改者四门' },
      requirement: { kind: 'redaction_all_clauses_resolved' }
    },
    {
      id: 'redaction_south_boss_gate',
      fromNodeId: 'boss_south_lock',
      toNodeId: 'last_redactor',
      label: '终稿南锁王门',
      sector: { id: 'redaction_boss_approaches', label: '末代删改者四门' },
      requirement: { kind: 'redaction_all_clauses_resolved' }
    }
  ],
  legacy_auction_court: [
    {
      id: 'auction_force_gallery_vault',
      fromNodeId: 'force_relic_gallery',
      toNodeId: 'force_claim_vault',
      label: '力之竞得门',
      sector: { id: 'auction_force_claim', label: '力之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'force' }
    },
    {
      id: 'auction_force_archive_vault',
      fromNodeId: 'archive_survey_gallery',
      toNodeId: 'force_claim_vault',
      label: '力之档案门',
      sector: { id: 'auction_force_claim', label: '力之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'force' }
    },
    {
      id: 'auction_guard_mimic_vault',
      fromNodeId: 'inheritance_mimic_north',
      toNodeId: 'guard_claim_vault',
      label: '守之竞得门',
      sector: { id: 'auction_guard_claim', label: '守之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'guard' }
    },
    {
      id: 'auction_guard_portal_vault',
      fromNodeId: 'upper_auction_portal',
      toNodeId: 'guard_claim_vault',
      label: '守之上庭门',
      sector: { id: 'auction_guard_claim', label: '守之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'guard' }
    },
    {
      id: 'auction_art_supply_vault',
      fromNodeId: 'lower_bid_supply',
      toNodeId: 'art_claim_vault',
      label: '术之竞得门',
      sector: { id: 'auction_art_claim', label: '术之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'art' }
    },
    {
      id: 'auction_art_gallery_vault',
      fromNodeId: 'art_relic_gallery',
      toNodeId: 'art_claim_vault',
      label: '术之展庭门',
      sector: { id: 'auction_art_claim', label: '术之遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'art' }
    },
    {
      id: 'auction_return_portal_vault',
      fromNodeId: 'lower_auction_portal',
      toNodeId: 'return_claim_vault',
      label: '归返竞得门',
      sector: { id: 'auction_return_claim', label: '归返遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'return' }
    },
    {
      id: 'auction_return_recharge_vault',
      fromNodeId: 'soul_recharge_auction',
      toNodeId: 'return_claim_vault',
      label: '归返回魂门',
      sector: { id: 'auction_return_claim', label: '归返遗产认领区' },
      requirement: { kind: 'auction_lot_bid', lot: 'return' }
    },
    {
      id: 'auction_provenance_boss_gate',
      fromNodeId: 'provenance_event_stage',
      toNodeId: 'estate_auctioneer',
      label: '来源证言王门',
      sector: { id: 'auction_boss_approaches', label: '遗产拍卖师四门' },
      requirement: { kind: 'auction_all_lots_resolved' }
    },
    {
      id: 'auction_mimic_boss_gate',
      fromNodeId: 'inheritance_mimic_alpha',
      toNodeId: 'estate_auctioneer',
      label: '继承拟态王门',
      sector: { id: 'auction_boss_approaches', label: '遗产拍卖师四门' },
      requirement: { kind: 'auction_all_lots_resolved' }
    },
    {
      id: 'auction_testimony_boss_gate',
      fromNodeId: 'dead_team_testimony_stage',
      toNodeId: 'estate_auctioneer',
      label: '亡队证词王门',
      sector: { id: 'auction_boss_approaches', label: '遗产拍卖师四门' },
      requirement: { kind: 'auction_all_lots_resolved' }
    },
    {
      id: 'auction_rostrum_boss_gate',
      fromNodeId: 'boss_side_rostrum',
      toNodeId: 'estate_auctioneer',
      label: '侧席宣价王门',
      sector: { id: 'auction_boss_approaches', label: '遗产拍卖师四门' },
      requirement: { kind: 'auction_all_lots_resolved' }
    }
  ],
  genesis_vault: [
    {
      id: 'genesis_force_gallery_vault',
      fromNodeId: 'force_sample_gallery',
      toNodeId: 'force_gene_vault',
      label: '力之样本专精门',
      sector: { id: 'genesis_force_vault', label: '力之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'force', minimum: 2 }
    },
    {
      id: 'genesis_force_archive_vault',
      fromNodeId: 'bloodline_survey_archive',
      toNodeId: 'force_gene_vault',
      label: '力之血脉专精门',
      sector: { id: 'genesis_force_vault', label: '力之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'force', minimum: 2 }
    },
    {
      id: 'genesis_art_guardian_vault',
      fromNodeId: 'mutation_guardian_north',
      toNodeId: 'art_gene_vault',
      label: '术之突变专精门',
      sector: { id: 'genesis_art_vault', label: '术之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'art', minimum: 2 }
    },
    {
      id: 'genesis_art_portal_vault',
      fromNodeId: 'upper_genesis_portal',
      toNodeId: 'art_gene_vault',
      label: '术之上层专精门',
      sector: { id: 'genesis_art_vault', label: '术之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'art', minimum: 2 }
    },
    {
      id: 'genesis_guard_gallery_vault',
      fromNodeId: 'guard_relic_gallery',
      toNodeId: 'guard_gene_vault',
      label: '守之遗珍专精门',
      sector: { id: 'genesis_guard_vault', label: '守之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'guard', minimum: 2 }
    },
    {
      id: 'genesis_guard_supply_vault',
      fromNodeId: 'lower_serum_supply',
      toNodeId: 'guard_gene_vault',
      label: '守之血清专精门',
      sector: { id: 'genesis_guard_vault', label: '守之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'guard', minimum: 2 }
    },
    {
      id: 'genesis_renewal_recharge_vault',
      fromNodeId: 'soul_recharge_genesis',
      toNodeId: 'renewal_gene_vault',
      label: '生之回魂专精门',
      sector: { id: 'genesis_renewal_vault', label: '生之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'renewal', minimum: 2 }
    },
    {
      id: 'genesis_renewal_portal_vault',
      fromNodeId: 'lower_genesis_portal',
      toNodeId: 'renewal_gene_vault',
      label: '生之下层专精门',
      sector: { id: 'genesis_renewal_vault', label: '生之基因库' },
      requirement: { kind: 'genesis_gene_count_at_least', gene: 'renewal', minimum: 2 }
    },
    {
      id: 'genesis_mosaic_corridor_vault',
      fromNodeId: 'sample_corridor_guard',
      toNodeId: 'mosaic_gene_vault',
      label: '万象样本门',
      sector: { id: 'genesis_mosaic_vault', label: '万象基因库' },
      requirement: { kind: 'genesis_three_unique_genes' }
    },
    {
      id: 'genesis_mosaic_helix_vault',
      fromNodeId: 'helix_collapse_trap',
      toNodeId: 'mosaic_gene_vault',
      label: '万象螺旋门',
      sector: { id: 'genesis_mosaic_vault', label: '万象基因库' },
      requirement: { kind: 'genesis_three_unique_genes' }
    },
    {
      id: 'genesis_mosaic_guardian_vault',
      fromNodeId: 'mutation_guardian_omega',
      toNodeId: 'mosaic_gene_vault',
      label: '万象突变门',
      sector: { id: 'genesis_mosaic_vault', label: '万象基因库' },
      requirement: { kind: 'genesis_three_unique_genes' }
    },
    {
      id: 'genesis_mosaic_boss_gate',
      fromNodeId: 'mosaic_gene_vault',
      toNodeId: 'primal_curator',
      label: '万象原型王门',
      sector: { id: 'genesis_boss_approaches', label: '原型馆长四门' },
      requirement: { kind: 'genesis_splice_complete' }
    },
    {
      id: 'genesis_stalker_boss_gate',
      fromNodeId: 'gene_stalker_alpha',
      toNodeId: 'primal_curator',
      label: '猎基原型王门',
      sector: { id: 'genesis_boss_approaches', label: '原型馆长四门' },
      requirement: { kind: 'genesis_splice_complete' }
    },
    {
      id: 'genesis_side_boss_gate',
      fromNodeId: 'boss_side_lock',
      toNodeId: 'primal_curator',
      label: '侧锁原型王门',
      sector: { id: 'genesis_boss_approaches', label: '原型馆长四门' },
      requirement: { kind: 'genesis_splice_complete' }
    },
    {
      id: 'genesis_lineage_boss_gate',
      fromNodeId: 'lineage_event_stage',
      toNodeId: 'primal_curator',
      label: '谱系原型王门',
      sector: { id: 'genesis_boss_approaches', label: '原型馆长四门' },
      requirement: { kind: 'genesis_splice_complete' }
    }
  ],
  silent_broadcast_tower: [
    {
      id: 'broadcast_silent_archive_gate',
      fromNodeId: 'north_echo_cache',
      toNodeId: 'silent_archive',
      label: '双静默档案门',
      sector: { id: 'broadcast_silent_archive', label: '寂声档案库' },
      requirement: {
        kind: 'broadcast_mute_count_at_least_and_noise_at_most',
        minimumMuteCount: 2,
        maximumNoise: 1
      }
    },
    {
      id: 'broadcast_resonance_vault_gate',
      fromNodeId: 'broadcast_warden_north',
      toNodeId: 'resonance_vault',
      label: '双播共振门',
      sector: { id: 'broadcast_resonance_vault', label: '共振储备库' },
      requirement: {
        kind: 'broadcast_count_at_least_and_noise_at_least',
        minimumBroadcastCount: 2,
        minimumNoise: 4
      }
    },
    {
      id: 'broadcast_balanced_switchboard_gate',
      fromNodeId: 'soul_recharge_broadcast',
      toNodeId: 'balanced_switchboard',
      label: '中频均衡门',
      sector: { id: 'broadcast_balanced_switchboard', label: '均衡配线盘' },
      requirement: {
        kind: 'broadcast_all_relays_resolved_and_noise_between',
        minimumNoise: 2,
        maximumNoise: 3
      }
    },
    {
      id: 'broadcast_memory_boss_gate',
      fromNodeId: 'broadcast_memory_stage',
      toNodeId: 'last_broadcaster',
      label: '三中继王门',
      sector: { id: 'broadcast_boss_approach', label: '末频道播音间' },
      requirement: { kind: 'broadcast_all_relays_resolved' }
    }
  ],
  lost_shelter: [
    {
      id: 'shelter_evacuation_cache_east_in',
      fromNodeId: 'north_supply_cache',
      toNodeId: 'evacuation_cache',
      label: '完好撤离封存门',
      sector: { id: 'shelter_evacuation_cache', label: '撤离封存箱' },
      requirement: {
        kind: 'escort_all_checkpoints_resolved_and_hp_at_least',
        minimumHp: 75
      }
    },
    {
      id: 'shelter_evacuation_cache_east_out',
      fromNodeId: 'evacuation_cache',
      toNodeId: 'north_supply_cache',
      label: '完好撤离封存门',
      sector: { id: 'shelter_evacuation_cache', label: '撤离封存箱' },
      requirement: {
        kind: 'escort_all_checkpoints_resolved_and_hp_at_least',
        minimumHp: 75
      }
    },
    {
      id: 'shelter_evacuation_cache_south_in',
      fromNodeId: 'north_entry',
      toNodeId: 'evacuation_cache',
      label: '完好撤离封存门',
      sector: { id: 'shelter_evacuation_cache', label: '撤离封存箱' },
      requirement: {
        kind: 'escort_all_checkpoints_resolved_and_hp_at_least',
        minimumHp: 75
      }
    },
    {
      id: 'shelter_evacuation_cache_south_out',
      fromNodeId: 'evacuation_cache',
      toNodeId: 'north_entry',
      label: '完好撤离封存门',
      sector: { id: 'shelter_evacuation_cache', label: '撤离封存箱' },
      requirement: {
        kind: 'escort_all_checkpoints_resolved_and_hp_at_least',
        minimumHp: 75
      }
    },
    ...[
      ['upper_return_portal', 'north'],
      ['mimic_survivor_alpha', 'west'],
      ['shelter_exit', 'south']
    ].flatMap(([adjacentNodeId, direction]) => [
      {
        id: `shelter_desperate_armory_${direction}_in`,
        fromNodeId: adjacentNodeId,
        toNodeId: 'desperate_armory',
        label: '绝境军械门',
        sector: { id: 'shelter_desperate_armory', label: '绝境军械库' },
        requirement: {
          kind: 'escort_all_checkpoints_resolved_and_hp_at_most' as const,
          maximumHp: 40
        }
      },
      {
        id: `shelter_desperate_armory_${direction}_out`,
        fromNodeId: 'desperate_armory',
        toNodeId: adjacentNodeId,
        label: '绝境军械门',
        sector: { id: 'shelter_desperate_armory', label: '绝境军械库' },
        requirement: {
          kind: 'escort_all_checkpoints_resolved_and_hp_at_most' as const,
          maximumHp: 40
        }
      }
    ]),
    ...[
      ['lower_return_portal', 'north'],
      ['soul_recharge_shelter', 'west']
    ].flatMap(([adjacentNodeId, direction]) => [
      {
        id: `shelter_balanced_medbay_${direction}_in`,
        fromNodeId: adjacentNodeId,
        toNodeId: 'balanced_medbay',
        label: '均衡分诊门',
        sector: { id: 'shelter_balanced_medbay', label: '均衡分诊舱' },
        requirement: {
          kind: 'escort_all_checkpoints_resolved_and_hp_between' as const,
          minimumHp: 41,
          maximumHp: 74
        }
      },
      {
        id: `shelter_balanced_medbay_${direction}_out`,
        fromNodeId: 'balanced_medbay',
        toNodeId: adjacentNodeId,
        label: '均衡分诊门',
        sector: { id: 'shelter_balanced_medbay', label: '均衡分诊舱' },
        requirement: {
          kind: 'escort_all_checkpoints_resolved_and_hp_between' as const,
          minimumHp: 41,
          maximumHp: 74
        }
      }
    ]),
    {
      id: 'shelter_memory_boss_gate',
      fromNodeId: 'survivor_memory_stage',
      toNodeId: 'shelter_overseer',
      label: '三检总控门',
      sector: { id: 'shelter_boss_approach', label: '失联总控入口' },
      requirement: { kind: 'escort_all_checkpoints_resolved' }
    }
  ],
  [FALSE_TESTIMONY_COURT_DUNGEON_ID]: FALSE_TESTIMONY_ROUTE_GATES,
  [COMBAT_REPLAY_STAGE_DUNGEON_ID]: COMBAT_REPLAY_ROUTE_GATES,
  [PANOPTICON_CITY_DUNGEON_ID]: PANOPTICON_ROUTE_GATES
};

const OPENING_STYLES: readonly CombatOpeningStyle[] = ['force', 'art', 'guard'];
const AUCTION_LOT_NODE_ID_BY_LOT: Readonly<Record<AuctionLot, AuctionLotNodeId>> = {
  force: 'force_lot_dais',
  guard: 'guard_lot_dais',
  art: 'art_lot_dais',
  return: 'return_lot_dais'
};
const BROADCAST_RELAY_ADJACENT_NODE_IDS = {
  north_relay_console: [
    'north_echo_cache',
    'north_entry',
    'acoustic_tripwire',
    'static_screen_trap'
  ],
  central_relay_console: [
    'broadcast_warden_north',
    'dead_air_gallery',
    'upper_return_portal',
    'studio_side_lock'
  ],
  south_relay_console: [
    'static_screen_trap',
    'lower_entry',
    'broadcast_warden_omega',
    'dead_air_mimic'
  ]
} as const;
const ESCORT_CHECKPOINT_ADJACENT_NODE_IDS = {
  north_checkpoint: [
    'north_rescue_patrol',
    'shelter_enforcer_north',
    'central_checkpoint'
  ],
  central_checkpoint: [
    'north_checkpoint',
    'survivor_cell',
    'mimic_survivor_alpha',
    'shelter_overseer'
  ],
  south_checkpoint: [
    'lower_entry',
    'evacuation_horror_omega',
    'alarm_grid_trap',
    'mimic_survivor'
  ]
} as const;
const FALSE_TESTIMONY_PENDING_ADJACENT_NODE_IDS = {
  verdict_chamber: [
    'timeline_evidence',
    'residue_sterility_trap',
    'false_testimony_judge',
    'perjury_hound_omega'
  ],
  appeal_desk: [
    'perjury_hound_omega',
    'false_testimony_judge',
    'cross_exam_stage',
    'evidence_supply_cache'
  ]
} as const;

function getOpeningDistribution(state: DungeonLawState): Record<CombatOpeningStyle, number> {
  const distribution: Record<CombatOpeningStyle, number> = { force: 0, art: 0, guard: 0 };

  for (const nodeId of state.combatVictoryNodeIds) {
    const opening = state.combatOpenings[nodeId];
    if (opening && !opening.isBoss && opening.style) distribution[opening.style] += 1;
  }

  return distribution;
}

function getBroadcastChoiceCount(
  state: DungeonLawState,
  choice: 'mute' | 'broadcast'
): number {
  if (state.law.kind !== 'silent_broadcast_tower') return 0;
  return Object.values(state.law.resolvedRelayChoices).filter(
    (resolvedChoice) => resolvedChoice === choice
  ).length;
}

function areAllBroadcastRelaysResolved(state: DungeonLawState): boolean {
  const law = state.law;
  return law.kind === 'silent_broadcast_tower' &&
    DUNGEON_LAW_LANDMARKS.silent_broadcast_tower.relayNodeIds.every((nodeId) =>
      Object.prototype.hasOwnProperty.call(law.resolvedRelayChoices, nodeId)
    );
}

function areAllEscortCheckpointsResolved(state: DungeonLawState): boolean {
  const law = state.law;
  return law.kind === 'lost_shelter' &&
    DUNGEON_LAW_LANDMARKS.lost_shelter.checkpointNodeIds.every((nodeId) =>
      Object.prototype.hasOwnProperty.call(law.resolvedCheckpointChoices, nodeId)
    );
}

function isFalseTestimonyAtomicRequirementMet(
  requirement: FalseTestimonyRouteAtomicRequirement,
  state: DungeonLawState
): boolean {
  if (state.law.kind !== 'false_testimony_court') return false;
  const law = state.law;
  switch (requirement.kind) {
    case 'false_testimony_trap_cleared':
      return state.clearedNodeIds.includes(requirement.trapNodeId);
    case 'false_testimony_evidence_exit':
      return law.revealedEvidenceIds.includes(requirement.evidenceId);
    case 'false_testimony_evidence_revealed':
      return law.revealedEvidenceIds.length >= 1;
    case 'false_testimony_truth_archive':
      return law.accusationCorrect === true &&
        law.accusationTrustedCount === 3 &&
        !law.appealUsed;
    case 'false_testimony_swift_armory':
      return law.accusationCorrect === true &&
        law.accusationTrustedCount >= 1 &&
        law.accusationTrustedCount <= 2 &&
        !law.appealUsed;
    case 'false_testimony_false_vault':
      return law.accusationCorrect === false;
    case 'false_testimony_appeal_entry':
      return law.accusationCorrect === false &&
        law.entryGear.appealSeal &&
        !law.appealUsed &&
        !state.clearedNodeIds.includes('false_verdict_vault');
    case 'false_testimony_appeal_exit':
      return law.appealUsed || (
        law.accusationCorrect === false &&
        law.entryGear.appealSeal &&
        !state.clearedNodeIds.includes('false_verdict_vault')
      );
    case 'false_testimony_verdict_complete':
      return law.accusedSuspect !== null && law.pendingVerdictNodeId === null;
  }
}

function isCombatReplayAtomicRequirementMet(
  requirement: CombatReplayRouteAtomicRequirement,
  state: DungeonLawState
): boolean {
  if (state.law.kind !== 'combat_replay_stage') return false;
  const law = state.law;
  switch (requirement.kind) {
    case 'combat_replay_take_entry': {
      const index = DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.indexOf(
        requirement.takeNodeId
      );
      return index >= 0 &&
        law.takes[index] === null &&
        law.takes.slice(0, index).every((take) => take !== null);
    }
    case 'combat_replay_take_exit': {
      const index = DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.indexOf(
        requirement.takeNodeId
      );
      return index >= 0 && law.takes[index] !== null;
    }
    case 'combat_replay_selected_route':
      return law.route === requirement.route;
    case 'combat_replay_boss_ready':
      return law.takes.every((take) => take !== null) && law.route !== null;
    case 'combat_replay_boss_defeated':
      return state.clearedNodeIds.includes('final_cut_director');
  }
}

function isPanopticonAtomicRequirementMet(
  requirement: PanopticonRouteAtomicRequirement,
  state: DungeonLawState
): boolean {
  if (state.law.kind !== 'panopticon_city') return false;
  switch (requirement.kind) {
    case 'panopticon_selected_route':
      return state.law.route === requirement.route;
    case 'panopticon_boss_ready':
      return DUNGEON_LAW_LANDMARKS.panopticon_city.relayNodeIds.every(
        (nodeId) => state.law.kind === 'panopticon_city' && state.law.relays[nodeId]
      ) && state.law.route !== null && state.law.pendingRouteNodeId === null;
    case 'panopticon_boss_defeated':
      return state.clearedNodeIds.includes('all_sight_warden');
  }
}

function isRequirementMet(requirement: DungeonRouteLawRequirement, state: DungeonLawState): boolean {
  switch (requirement.kind) {
    case 'fog_pressure_at_most':
      return state.law.kind === 'demon_tower' && state.law.fogPressure <= requirement.maximum;
    case 'metro_tide':
      return state.law.kind === 'metro_abyss' && state.law.tide === requirement.tide;
    case 'mine_gravity':
      return state.law.kind === 'starfall_mine' && state.law.gravity === requirement.gravity;
    case 'pollution_at_most':
      return state.law.kind === 'rust_hospital' && state.law.pollution <= requirement.maximum;
    case 'opening_style_victories_at_least': {
      if (state.law.kind !== 'ash_arena' && state.law.kind !== 'void_citadel') return false;
      return getOpeningDistribution(state)[requirement.style] >= requirement.minimum;
    }
    case 'all_opening_styles': {
      const distribution = getOpeningDistribution(state);
      return state.law.kind === 'ash_arena' && OPENING_STYLES.every((style) => distribution[style] > 0);
    }
    case 'archive_feature_available':
      return state.law.kind === 'dream_archive' && !state.law.sealedFeatures.includes(requirement.feature);
    case 'balanced_opening_distribution': {
      if (state.law.kind !== 'void_citadel') return false;
      const distribution = getOpeningDistribution(state);
      const counts = OPENING_STYLES.map((style) => distribution[style]);
      return counts.every((count) => count > 0) && Math.max(...counts) - Math.min(...counts) <= requirement.maximumSpread;
    }
    case 'past_calibrated':
      return state.law.kind === 'temporal_observatory' && state.law.pastCalibrated === true;
    case 'future_calibrated':
      return state.law.kind === 'temporal_observatory' && state.law.futureCalibrated === true;
    case 'dual_calibrated':
      return state.law.kind === 'temporal_observatory' &&
        state.law.pastCalibrated === true &&
        state.law.futureCalibrated === true;
    case 'debt_at_most':
      return state.law.kind === 'causal_clearinghouse' && state.law.debt <= requirement.maximum;
    case 'entropy_at_most':
      return state.law.kind === 'entropy_ark' && state.law.entropy <= requirement.maximum;
    case 'entropy_at_least':
      return state.law.kind === 'entropy_ark' && state.law.entropy >= requirement.minimum;
    case 'entropy_between':
      return state.law.kind === 'entropy_ark' &&
        state.law.entropy >= requirement.minimum &&
        state.law.entropy <= requirement.maximum;
    case 'mirror_city_phase':
      return state.law.kind === 'mirror_cycle_city' && state.law.currentPhase === requirement.phase;
    case 'mirror_city_all_phase_choices': {
      if (state.law.kind !== 'mirror_cycle_city') return false;
      const resolvedPhaseChoices = state.law.resolvedPhaseChoices;
      return DUNGEON_LAW_LANDMARKS.mirror_cycle_city.phaseChoiceNodeIds.every((nodeId) =>
        Object.prototype.hasOwnProperty.call(resolvedPhaseChoices, nodeId)
      );
    }
    case 'mirror_city_real_anchor':
      return state.law.kind === 'mirror_cycle_city' && state.law.anchors.real;
    case 'mirror_city_mirror_anchor':
      return state.law.kind === 'mirror_cycle_city' && state.law.anchors.mirror;
    case 'mirror_city_dual_anchors':
      return state.law.kind === 'mirror_cycle_city' && state.law.anchors.real && state.law.anchors.mirror;
    case 'redaction_clause_certified':
      return state.law.kind === 'redaction_scriptorium' &&
        state.law.resolvedClauseChoices[requirement.clause] === 'certify';
    case 'redaction_all_clauses_resolved': {
      if (state.law.kind !== 'redaction_scriptorium') return false;
      const resolvedClauseChoices = state.law.resolvedClauseChoices;
      return DUNGEON_LAW_LANDMARKS.redaction_scriptorium.clauseNodeIds.every((nodeId) =>
        Object.prototype.hasOwnProperty.call(resolvedClauseChoices, nodeId)
      );
    }
    case 'auction_lot_bid':
      return state.law.kind === 'legacy_auction_court' &&
        state.law.resolvedLotChoices[AUCTION_LOT_NODE_ID_BY_LOT[requirement.lot]] === 'bid';
    case 'auction_all_lots_resolved': {
      if (state.law.kind !== 'legacy_auction_court') return false;
      const resolvedLotChoices = state.law.resolvedLotChoices;
      return DUNGEON_LAW_LANDMARKS.legacy_auction_court.lotNodeIds.every((nodeId) => {
        const choice = resolvedLotChoices[nodeId];
        return choice === 'bid' || choice === 'burn' || choice === 'fold';
      });
    }
    case 'genesis_gene_count_at_least':
      return state.law.kind === 'genesis_vault' &&
        state.law.spliceSequence.filter((gene) => gene === requirement.gene).length >= requirement.minimum;
    case 'genesis_three_unique_genes':
      return state.law.kind === 'genesis_vault' &&
        state.law.spliceSequence.length === 3 &&
        new Set(state.law.spliceSequence).size === 3;
    case 'genesis_splice_complete':
      return state.law.kind === 'genesis_vault' && state.law.spliceSequence.length === 3;
    case 'broadcast_mute_count_at_least_and_noise_at_most':
      return state.law.kind === 'silent_broadcast_tower' &&
        getBroadcastChoiceCount(state, 'mute') >= requirement.minimumMuteCount &&
        state.law.noise <= requirement.maximumNoise;
    case 'broadcast_count_at_least_and_noise_at_least':
      return state.law.kind === 'silent_broadcast_tower' &&
        getBroadcastChoiceCount(state, 'broadcast') >= requirement.minimumBroadcastCount &&
        state.law.noise >= requirement.minimumNoise;
    case 'broadcast_all_relays_resolved_and_noise_between':
      return areAllBroadcastRelaysResolved(state) &&
        state.law.kind === 'silent_broadcast_tower' &&
        state.law.noise >= requirement.minimumNoise &&
        state.law.noise <= requirement.maximumNoise;
    case 'broadcast_all_relays_resolved':
      return areAllBroadcastRelaysResolved(state);
    case 'escort_all_checkpoints_resolved_and_hp_at_least':
      return areAllEscortCheckpointsResolved(state) &&
        state.law.kind === 'lost_shelter' &&
        state.law.survivorHp >= requirement.minimumHp;
    case 'escort_all_checkpoints_resolved_and_hp_at_most':
      return areAllEscortCheckpointsResolved(state) &&
        state.law.kind === 'lost_shelter' &&
        state.law.survivorHp <= requirement.maximumHp;
    case 'escort_all_checkpoints_resolved_and_hp_between':
      return areAllEscortCheckpointsResolved(state) &&
        state.law.kind === 'lost_shelter' &&
        state.law.survivorHp >= requirement.minimumHp &&
        state.law.survivorHp <= requirement.maximumHp;
    case 'escort_all_checkpoints_resolved':
      return areAllEscortCheckpointsResolved(state);
    case 'false_testimony_trap_cleared':
    case 'false_testimony_evidence_exit':
    case 'false_testimony_evidence_revealed':
    case 'false_testimony_truth_archive':
    case 'false_testimony_swift_armory':
    case 'false_testimony_false_vault':
    case 'false_testimony_appeal_entry':
    case 'false_testimony_appeal_exit':
    case 'false_testimony_verdict_complete':
      return isFalseTestimonyAtomicRequirementMet(requirement, state);
    case 'false_testimony_all':
      return requirement.requirements.every((part) =>
        isFalseTestimonyAtomicRequirementMet(part, state)
      );
    case 'combat_replay_take_entry':
    case 'combat_replay_take_exit':
    case 'combat_replay_selected_route':
    case 'combat_replay_boss_ready':
    case 'combat_replay_boss_defeated':
      return isCombatReplayAtomicRequirementMet(requirement, state);
    case 'combat_replay_all':
      return requirement.requirements.every((part) =>
        isCombatReplayAtomicRequirementMet(part, state)
      );
    case 'panopticon_selected_route':
    case 'panopticon_boss_ready':
    case 'panopticon_boss_defeated':
      return isPanopticonAtomicRequirementMet(requirement, state);
    case 'panopticon_all':
      return requirement.requirements.every((part) =>
        isPanopticonAtomicRequirementMet(part, state)
      );
  }
}

function getClosedReason(requirement: DungeonRouteLawRequirement): string {
  switch (requirement.kind) {
    case 'fog_pressure_at_most':
      return `雾压需降至 ${requirement.maximum} 或以下；先去雾后暗格或静默香案减压。`;
    case 'metro_tide': {
      const tideLabel: Record<MetroTide, string> = { ebb: '退潮', flood: '涨潮', mirror: '镜潮' };
      return `仅${tideLabel[requirement.tide]}时通行；先到信号箱暗格复位潮序。`;
    }
    case 'mine_gravity':
      return `仅${requirement.gravity === 'upward' ? '上浮' : '下沉'}重力时通行；触发重力岔路闸或备用重力井换向。`;
    case 'pollution_at_most':
      return `污染需降至 ${requirement.maximum} 或以下；先去药房抽屉或完成分诊净化。`;
    case 'opening_style_victories_at_least': {
      const styleLabel: Record<CombatOpeningStyle, string> = { force: '力', art: '术', guard: '守' };
      return `先用${styleLabel[requirement.style]}式开局获胜 ${requirement.minimum} 场。`;
    }
    case 'all_opening_styles':
      return '用力、术、守三种开局各获胜一次后开放。';
    case 'archive_feature_available': {
      const featureLabel: Record<ArchiveSealableFeature, string> = {
        consumable: '道具',
        method: '功法',
        pet: '灵宠'
      };
      return `${featureLabel[requirement.feature]}已封存；先到索引柜或裂核索引解除封存。`;
    }
    case 'balanced_opening_distribution':
      return `力、术、守均有胜场且次数差不超过 ${requirement.maximumSpread} 后开放。`;
    case 'past_calibrated':
      return '先校准过去锚点后开放。';
    case 'future_calibrated':
      return '先校准未来锚点后开放。';
    case 'dual_calibrated':
      return '过去与未来锚点均校准后开放。';
    case 'debt_at_most':
      return `因果债需降至 ${requirement.maximum} 或以下；在待平账中选择偿还以降债。`;
    case 'entropy_at_most':
      return `熵值需降至 ${requirement.maximum} 或以下。`;
    case 'entropy_at_least':
      return `熵值需升至 ${requirement.minimum} 或以上。`;
    case 'entropy_between':
      return `熵值需保持在 ${requirement.minimum} 至 ${requirement.maximum} 之间。`;
    case 'mirror_city_phase':
      return `仅${requirement.phase === 'real' ? '现实' : '镜像'}相位可开启这条支路。`;
    case 'mirror_city_all_phase_choices':
      return '完成三处相位抉择后，镜王门才会显形。';
    case 'mirror_city_real_anchor':
      return '需在现实相位点亮现实锚点。';
    case 'mirror_city_mirror_anchor':
      return '需在镜像相位点亮镜像锚点。';
    case 'mirror_city_dual_anchors':
      return '现实与镜像锚点均点亮后开放。';
    case 'redaction_clause_certified':
      return '对应条款必须选择认证；删改后该选区永久关闭。';
    case 'redaction_all_clauses_resolved':
      return '肉身、记忆与归返三份条款全部裁定后开放。';
    case 'auction_lot_bid':
      return '对应遗产拍品必须竞得；焚毁或放弃后该认领区永久关闭。';
    case 'auction_all_lots_resolved':
      return '力、守、术与归返四件遗产拍品全部裁定后开放。';
    case 'genesis_gene_count_at_least': {
      const geneLabel: Record<GenesisGene, string> = {
        force: '力',
        art: '术',
        guard: '守',
        renewal: '生'
      };
      return `${geneLabel[requirement.gene]}之原型需专精至少2次后开放。`;
    }
    case 'genesis_three_unique_genes':
      return '完成三次拼接且选择三种互异原型后开放。';
    case 'genesis_splice_complete':
      return '完成三次拼接后，原型馆长入口才会开放。';
    case 'broadcast_mute_count_at_least_and_noise_at_most':
      return `至少静默 ${requirement.minimumMuteCount} 座中继，且噪声不高于 ${requirement.maximumNoise}。`;
    case 'broadcast_count_at_least_and_noise_at_least':
      return `至少播送 ${requirement.minimumBroadcastCount} 座中继，且噪声不低于 ${requirement.minimumNoise}。`;
    case 'broadcast_all_relays_resolved_and_noise_between':
      return `三座中继全部调谐，且噪声保持在 ${requirement.minimumNoise}-${requirement.maximumNoise}。`;
    case 'broadcast_all_relays_resolved':
      return '三座中继全部调谐后，末频道王门开放。';
    case 'escort_all_checkpoints_resolved_and_hp_at_least':
      return `完成三处检查点且幸存者HP至少${requirement.minimumHp}。`;
    case 'escort_all_checkpoints_resolved_and_hp_at_most':
      return `完成三处检查点且幸存者HP不高于${requirement.maximumHp}。`;
    case 'escort_all_checkpoints_resolved_and_hp_between':
      return `完成三处检查点且幸存者HP为${requirement.minimumHp}-${requirement.maximumHp}。`;
    case 'escort_all_checkpoints_resolved':
      return '完成三处护送检查点后开放。';
    case 'false_testimony_trap_cleared':
      return '先清除对应净证陷阱。';
    case 'false_testimony_evidence_exit':
      return '先揭示当前证据再离开。';
    case 'false_testimony_evidence_revealed':
      return '至少揭示一份证据后开放。';
    case 'false_testimony_truth_archive':
      return '原始裁决正确且冻结三份净证后开放。';
    case 'false_testimony_swift_armory':
      return '原始正确裁决冻结一至两份净证后开放。';
    case 'false_testimony_false_vault':
      return '当前裁决错误时开放。';
    case 'false_testimony_appeal_entry':
      return '错判、携带翻案印玺且未取伪判封存后开放。';
    case 'false_testimony_appeal_exit':
      return '完成本次翻案裁决后离席。';
    case 'false_testimony_verdict_complete':
      return '完成裁决且无待处理裁定后开放。';
    case 'false_testimony_all':
      return '需同时满足这条伪证裁定门的全部条件。';
    case 'combat_replay_take_entry': {
      const index = DUNGEON_LAW_LANDMARKS.combat_replay_stage.takeNodeIds.indexOf(
        requirement.takeNodeId
      );
      return index === 0
        ? '第一段母带尚未录制。'
        : `先完成第 ${index} 段母带，再进入第 ${index + 1} 段录制。`;
    }
    case 'combat_replay_take_exit':
      return '录制当前战斗母带后才能离开。';
    case 'combat_replay_selected_route': {
      const routeLabel: Record<CombatReplayRoute, string> = {
        sequence: '顺序',
        burst: '爆发',
        afterbeat: '余拍'
      };
      return `三段母带完成后选择${routeLabel[requirement.route]}路线；其余路线将永久关闭。`;
    }
    case 'combat_replay_boss_ready':
      return '完成三段母带并选择复演路线后，最终剪辑师入口开放。';
    case 'combat_replay_boss_defeated':
      return '击败最终剪辑师后方可离场。';
    case 'combat_replay_all':
      return '需同时满足这条战痕复演门的全部条件。';
    case 'panopticon_selected_route': {
      const routeLabel: Record<PanopticonRoute, string> = {
        shadow: '影路',
        decoy: '诱饵',
        refraction: '折光'
      };
      return `完成三座盲区中继后选择${routeLabel[requirement.route]}路线；其余路线将永久关闭。`;
    }
    case 'panopticon_boss_ready':
      return '完成三座盲区中继并选择潜入路线后，万目监察者入口开放。';
    case 'panopticon_boss_defeated':
      return '击败万目监察者后方可离城。';
    case 'panopticon_all':
      return '需同时满足这条天幕监察门的全部条件。';
  }
}

export function getDungeonRouteGates<Dungeon extends DungeonRouteDungeonId>(
  dungeonId: Dungeon
): readonly DungeonRouteGateDefinition<Dungeon>[] {
  return DUNGEON_ROUTE_GATES[dungeonId];
}

export function getRouteGateStatus(
  dungeonId: DungeonRouteDungeonId,
  fromNodeId: string,
  toNodeId: string,
  lawState: DungeonLawState
): DungeonRouteGateStatus | undefined {
  const gate = getDungeonRouteGates(dungeonId).find(
    (candidate) => candidate.fromNodeId === fromNodeId && candidate.toNodeId === toNodeId
  );
  if (!gate) return undefined;

  if (lawState.dungeonId === dungeonId && isRequirementMet(gate.requirement, lawState)) {
    return { gate, status: 'open', isOpen: true };
  }

  return {
    gate,
    status: 'closed',
    isOpen: false,
    blockReason: gate.closedReason ?? getClosedReason(gate.requirement)
  };
}

export function getRouteBlockReason(
  dungeonId: DungeonRouteDungeonId,
  fromNodeId: string,
  toNodeId: string,
  lawState: DungeonLawState
): string | undefined {
  if (
    dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID &&
    lawState.dungeonId === FALSE_TESTIMONY_COURT_DUNGEON_ID &&
    lawState.law.kind === 'false_testimony_court' &&
    lawState.law.pendingVerdictNodeId === fromNodeId
  ) {
    const adjacentNodeIds = FALSE_TESTIMONY_PENDING_ADJACENT_NODE_IDS[
      lawState.law.pendingVerdictNodeId
    ];
    if ((adjacentNodeIds as readonly string[]).includes(toNodeId)) {
      return lawState.law.pendingVerdictNodeId === 'verdict_chamber'
        ? '先完成当前指控。'
        : '先完成当前翻案裁决。';
    }
  }
  if (
    dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID &&
    lawState.dungeonId === SILENT_BROADCAST_TOWER_DUNGEON_ID &&
    lawState.law.kind === 'silent_broadcast_tower' &&
    lawState.law.pendingRelayNodeId === fromNodeId
  ) {
    const adjacentNodeIds = BROADCAST_RELAY_ADJACENT_NODE_IDS[
      lawState.law.pendingRelayNodeId
    ];
    if ((adjacentNodeIds as readonly string[]).includes(toNodeId)) {
      return '先为当前广播中继选择静默或播送。';
    }
  }
  if (
    dungeonId === LOST_SHELTER_DUNGEON_ID &&
    lawState.dungeonId === LOST_SHELTER_DUNGEON_ID &&
    lawState.law.kind === 'lost_shelter' &&
    lawState.law.pendingCheckpointNodeId === fromNodeId
  ) {
    const adjacentNodeIds = ESCORT_CHECKPOINT_ADJACENT_NODE_IDS[
      lawState.law.pendingCheckpointNodeId
    ];
    if ((adjacentNodeIds as readonly string[]).includes(toNodeId)) {
      return '先选择救治或强推。';
    }
  }
  return getRouteGateStatus(dungeonId, fromNodeId, toNodeId, lawState)?.blockReason;
}

export function getRouteSectorDisplay(
  dungeonId: DungeonRouteDungeonId,
  lawState: DungeonLawState
): readonly DungeonRouteSectorDisplay[] {
  const sectors = new Map<
    string,
    { label: string; gateCount: number; openGateCount: number; blockReasons: string[] }
  >();

  for (const gate of getDungeonRouteGates(dungeonId)) {
    const sector = gate.sector ?? { id: gate.id, label: gate.label };
    const current = sectors.get(sector.id) ?? {
      label: sector.label,
      gateCount: 0,
      openGateCount: 0,
      blockReasons: []
    };
    const status = getRouteGateStatus(dungeonId, gate.fromNodeId, gate.toNodeId, lawState);

    current.gateCount += 1;
    if (status?.isOpen) current.openGateCount += 1;
    else if (status?.blockReason && !current.blockReasons.includes(status.blockReason)) {
      current.blockReasons.push(status.blockReason);
    }
    sectors.set(sector.id, current);
  }

  return [...sectors].map(([id, sector]) => {
    const closedGateCount = sector.gateCount - sector.openGateCount;
    return {
      id,
      label: sector.label,
      gateCount: sector.gateCount,
      openGateCount: sector.openGateCount,
      closedGateCount,
      status: closedGateCount === 0 ? 'open' : sector.openGateCount === 0 ? 'closed' : 'partial',
      blockReasons: [...sector.blockReasons]
    };
  });
}

export function getLegalAdjacentTargetIds(
  dungeonId: DungeonRouteDungeonId,
  fromNodeId: string,
  adjacentTargetIds: readonly string[],
  lawState: DungeonLawState
): string[] {
  return adjacentTargetIds.filter(
    (toNodeId) => getRouteBlockReason(dungeonId, fromNodeId, toNodeId, lawState) === undefined
  );
}
