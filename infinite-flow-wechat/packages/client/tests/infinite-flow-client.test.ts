import { describe, expect, it, vi } from 'vitest';

import {
  FaultInjectingStoragePort,
  InMemoryStoragePort,
  PortableSha256HashPort,
  SequenceSeedPort,
  type LifecycleFlushResult,
  type LifecyclePort,
  type LifecycleSuspendContext,
  type Unsubscribe,
} from '@infinite-flow/runtime';

import {
  INSTALLATION_EPOCH_KEY,
  InfiniteFlowClientLifecycleAggregateError,
  createInfiniteFlowClient,
  type LifecycleDiagnostic,
} from '../src/index.js';

type LifecycleSubscription = 'suspend' | 'resume' | 'memory-warning';

class FakeLifecyclePort implements LifecyclePort {
  suspendListener:
    | ((context: LifecycleSuspendContext) => Promise<LifecycleFlushResult>)
    | undefined;
  resumeListener: (() => void) | undefined;
  memoryWarningListener: (() => void) | undefined;
  readonly unsubscribeCalls: LifecycleSubscription[] = [];

  constructor(
    private readonly failOnRegistration?: 'resume' | 'memory-warning',
    private readonly unsubscribeErrors: Readonly<
      Partial<Record<LifecycleSubscription, unknown>>
    > = {},
  ) {}

  onSuspend(
    listener: (context: LifecycleSuspendContext) => Promise<LifecycleFlushResult>,
  ): Unsubscribe {
    this.suspendListener = listener;
    return () => {
      this.unsubscribeCalls.push('suspend');
      if (this.unsubscribeErrors.suspend !== undefined) {
        throw this.unsubscribeErrors.suspend;
      }
      if (this.suspendListener === listener) this.suspendListener = undefined;
    };
  }

  onResume(listener: () => void): Unsubscribe {
    if (this.failOnRegistration === 'resume') {
      throw new Error('resume registration failed');
    }
    this.resumeListener = listener;
    return () => {
      this.unsubscribeCalls.push('resume');
      if (this.unsubscribeErrors.resume !== undefined) {
        throw this.unsubscribeErrors.resume;
      }
      if (this.resumeListener === listener) this.resumeListener = undefined;
    };
  }

  onMemoryWarning(listener: () => void): Unsubscribe {
    if (this.failOnRegistration === 'memory-warning') {
      throw new Error('memory-warning registration failed');
    }
    this.memoryWarningListener = listener;
    return () => {
      this.unsubscribeCalls.push('memory-warning');
      if (this.unsubscribeErrors['memory-warning'] !== undefined) {
        throw this.unsubscribeErrors['memory-warning'];
      }
      if (this.memoryWarningListener === listener) this.memoryWarningListener = undefined;
    };
  }
}

describe('InfiniteFlowClient', () => {
  it('persists an epoch, de-duplicates physical entry, and enforces the session phase guard', async () => {
    const storage = new InMemoryStoragePort();
    const seeds = new SequenceSeedPort([0x1111, 0x2222, 0x3333]);
    const client = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: seeds,
    });

    expect(await storage.read(INSTALLATION_EPOCH_KEY)).toBe('wx-0000111100002222');
    expect(seeds.callCount).toBe(2);

    const first = client.enterRunPhysical('touch:1', 'hub.enter.demon-tower', {
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
    });
    const duplicate = client.enterRunPhysical('touch:1', 'hub.enter.demon-tower', {
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
    });
    expect(duplicate).toBe(first);

    const entered = await first;
    expect(entered.status).toBe('committed');
    expect(client.getState().phase).toBe('explore');
    expect(client.getState().run?.hiddenTaskSeed).toBe(0x3333);
    expect(seeds.callCount).toBe(3);

    const replayed = await client.dispatchPhysical(
      'touch:1',
      'hub.recover',
      { type: 'hub/recover' },
    );
    expect(replayed).toBe(entered);
    expect(client.getRevisionStatus().ledgerRevision).toBe(1);

    const illegalHubAction = await client.dispatch({ type: 'hub/recover' });
    expect(illegalHubAction.status).toBe('rejected');
    if (illegalHubAction.status === 'rejected') {
      expect(illegalHubAction.reason.code).toBe('invalid-phase');
    }
    expect(client.getRevisionStatus()).toMatchObject({
      durableRevision: 1,
      ledgerRevision: 2,
      acceptingInput: true,
    });
  });

  it('validates deep entry before consuming run seeds', async () => {
    const seeds = new SequenceSeedPort([1, 2, 3, 4]);
    const client = await createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: seeds,
    });

    expect(() => client.enterRun({
      dungeonId: 'demon_tower_1',
      protocolId: 'deep',
    })).toThrow(/inferno tier/i);
    expect(seeds.callCount).toBe(2);
  });

  it('retries persistence without consuming another run seed or rerunning the reducer', async () => {
    const base = new InMemoryStoragePort();
    const storage = new FaultInjectingStoragePort(base);
    const seeds = new SequenceSeedPort([11, 22, 33]);
    const client = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: seeds,
    });

    storage.injectOnce({
      operation: 'write',
      key: 'infinite-flow:save:tmp',
    });
    const blocked = await client.enterRunPhysical('touch:blocked', 'hub.enter', {
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
    });
    expect(blocked.status).toBe('persistence-blocked');
    expect(seeds.callCount).toBe(3);
    expect(client.getState().phase).toBe('hub');

    const retried = await client.retryPendingPersistence();
    expect(retried.status).toBe('committed');
    expect(seeds.callCount).toBe(3);
    expect(client.getState().phase).toBe('explore');
    expect(client.getState().run?.hiddenTaskSeed).toBe(33);
  });

  it('never evicts pending physical inputs and bounds only completed replays', async () => {
    const client = await createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([41, 42]),
      physicalInputRetention: 1,
    });

    const first = client.dispatchPhysical(
      'touch:pending-1',
      'hub.recover',
      { type: 'hub/recover' },
    );
    const second = client.dispatchPhysical(
      'touch:pending-2',
      'hub.recover',
      { type: 'hub/recover' },
    );
    const third = client.dispatchPhysical(
      'touch:pending-3',
      'hub.recover',
      { type: 'hub/recover' },
    );

    expect(client.dispatchPhysical(
      'touch:pending-1',
      'hub.recover-replay',
      { type: 'hub/recover' },
    )).toBe(first);

    await Promise.all([first, second, third]);
    expect(client.getRevisionStatus().ledgerRevision).toBe(3);

    expect(client.dispatchPhysical(
      'touch:pending-3',
      'hub.recover-retained',
      { type: 'hub/recover' },
    )).toBe(third);
    expect(client.getRevisionStatus().ledgerRevision).toBe(3);

    const replayAfterEviction = client.dispatchPhysical(
      'touch:pending-1',
      'hub.recover-after-eviction',
      { type: 'hub/recover' },
    );
    expect(replayAfterEviction).not.toBe(first);
    await replayAfterEviction;
    expect(client.getRevisionStatus().ledgerRevision).toBe(4);
  });

  it('recovers the durable state without asking for entropy again', async () => {
    const storage = new InMemoryStoragePort({ durability: 'requires-flush' });
    const initialSeeds = new SequenceSeedPort([101, 102, 103]);
    const first = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: initialSeeds,
    });
    await first.enterRun({
      dungeonId: 'demon_tower_1',
      protocolId: 'standard',
    });
    first.dispose();
    storage.crash();

    const recoverySeeds = new SequenceSeedPort([]);
    const recovered = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: recoverySeeds,
    });
    expect(recoverySeeds.callCount).toBe(0);
    expect(recovered.getState().phase).toBe('explore');
    expect(recovered.getState().run?.hiddenTaskSeed).toBe(103);
    expect(recovered.getRevisionStatus().durableRevision).toBe(1);
  });

  it('persists a pursuer fight through the session and recovers it', async () => {
    const storage = new InMemoryStoragePort({ durability: 'requires-flush' });
    const client = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([101, 102, 103, 104, 105, 106]),
    });
    const send = async (command: Parameters<typeof client.dispatch>[0]) => {
      const result = await client.dispatch(command);
      expect(result.status, JSON.stringify(command)).toBe('committed');
    };
    const fight = async () => {
      for (let turn = 0; client.getState().phase === 'combat' && turn < 40; turn += 1) {
        await send({ type: 'combat/act', action: 'attack' });
      }
    };
    // Fights with medicine when low, then answers any relic draft or equipment offer the step raised.
    const settle = async () => {
      for (let step = 0; step < 60; step += 1) {
        const state = client.getState();
        if (state.phase === 'combat') {
          const low = state.player.hp < state.player.maxHp * 0.45 && state.inventory.healing_pill > 0;
          await send({ type: 'combat/act', action: low ? 'use_healing_pill' : 'attack' });
        } else if (state.run?.relicState?.pendingDraft) {
          await send({ type: 'node/resolve-relic-draft', relicId: state.run.relicState.pendingDraft.candidateIds[0]! });
        } else if (state.run?.pendingEquipmentOffer) {
          await send({ type: 'node/resolve-equipment-loot', equipmentId: state.run.pendingEquipmentOffer.equipmentIds[0] });
        } else {
          return;
        }
      }
    };
    for (let pill = 0; pill < 4; pill += 1) await send({ type: 'hub/buy-item', itemId: 'healing_pill' });
    // The opening chapter's first clear has no pursuer, so clear it by the short boss route first.
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    for (const command of [
      { type: 'run/select-node', nodeId: 'fog_lesser_demon' },
      { type: 'run/move', nodeId: 'blood_rune_trap' },
      { type: 'node/handle-trap', choice: 'risk' },
      { type: 'run/move', nodeId: 'cracked_portal' },
      { type: 'run/move', nodeId: 'sealed_cache' },
      { type: 'run/move', nodeId: 'tower_exit' },
      { type: 'run/move', nodeId: 'bone_lane_monster' },
      { type: 'run/select-node', nodeId: 'bone_lane_monster' },
      { type: 'run/move', nodeId: 'tower_exit' },
      { type: 'run/resolve-exit' }
    ] as const) {
      await send(command);
      await settle();
    }
    expect(client.getState().run?.pursuitState?.status).toBe('disabled');
    expect(client.getState().completedDungeonIds).toContain('demon_tower_1');
    if (client.getState().run?.lastRelicSettlement?.status === 'pending') await send({ type: 'result/archive-relic' });
    await send({ type: 'result/return-hub' });
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    await send({ type: 'run/select-node', nodeId: 'fog_lesser_demon' });
    await fight();
    await send({ type: 'run/move', nodeId: 'broken_sigil_reward' });
    await send({ type: 'node/collect-reward' });
    await send({ type: 'run/move', nodeId: 'fog_lesser_demon' });
    await send({ type: 'run/move', nodeId: 'blood_rune_trap' });
    await send({ type: 'node/handle-trap', choice: 'risk' });
    expect(client.getState().run?.pursuitState?.status).toBe('stalking');
    await send({ type: 'run/move', nodeId: 'fog_lesser_demon' });
    // The pursuer steps toward the player and catches them on the way back: the fight is persisted like any other.
    await send({ type: 'run/move', nodeId: 'blood_rune_trap' });
    expect(client.getState().phase).toBe('combat');
    expect(client.getState().combat?.pursuer).toBe(true);
    expect(client.getState().combat?.nodeId).toBe('tower_butcher_patrol');
    await client.retryPendingPersistence();
    client.dispose();
    storage.crash();

    const recovered = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([]),
    });
    expect(recovered.getState().combat?.pursuer).toBe(true);
    // A caught, wounded hero needs the pills: each restores half of the maximum HP.
    for (let turn = 0; recovered.getState().phase === 'combat' && turn < 40; turn += 1) {
      const { hp, maxHp } = recovered.getState().player;
      const action = hp < maxHp * 0.45 && (recovered.getState().inventory.healing_pill ?? 0) > 0 ? 'use_healing_pill' : 'attack';
      expect((await recovered.dispatch({ type: 'combat/act', action })).status).toBe('committed');
    }
    expect(recovered.getState().phase).toBe('explore');
    // A beaten pursuer is gone for the rest of the run, and that state persists like any other.
    expect(recovered.getState().run?.pursuitState).toMatchObject({ status: 'repelled', repelledReason: 'defeated', nodeId: null });
    expect(recovered.getState().run?.clearedNodeIds).not.toContain('tower_butcher_patrol');
    recovered.dispose();
  });

  it('wires lifecycle events and removes every listener on dispose', async () => {
    const lifecycle = new FakeLifecyclePort();
    const diagnostics: LifecycleDiagnostic[] = [];
    const memoryWarning = vi.fn();
    const client = await createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([7, 8]),
      lifecycle,
      onLifecycleDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      onMemoryWarning: memoryWarning,
    });

    const suspended = await lifecycle.suspendListener?.({ reason: 'hide' });
    expect(suspended?.status).toBe('durable');
    expect(client.getRevisionStatus().acceptingInput).toBe(false);

    lifecycle.resumeListener?.();
    await vi.waitFor(() => {
      expect(diagnostics.some((item) => item.operation === 'resume')).toBe(true);
    });
    expect(client.getRevisionStatus().acceptingInput).toBe(true);
    lifecycle.memoryWarningListener?.();
    expect(memoryWarning).toHaveBeenCalledOnce();

    const completed = client.dispatchPhysical(
      'touch:dispose-completed',
      'hub.recover-completed',
      { type: 'hub/recover' },
    );
    await completed;
    const pending = client.dispatchPhysical(
      'touch:dispose-pending',
      'hub.recover-pending',
      { type: 'hub/recover' },
    );
    const physicalInputs = client as unknown as {
      pendingPhysicalInputs: Map<string, unknown>;
      completedPhysicalInputs: Map<string, unknown>;
    };
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(1);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(1);

    client.dispose();
    expect(lifecycle.suspendListener).toBeUndefined();
    expect(lifecycle.resumeListener).toBeUndefined();
    expect(lifecycle.memoryWarningListener).toBeUndefined();
    expect(lifecycle.unsubscribeCalls).toEqual([
      'memory-warning',
      'resume',
      'suspend',
    ]);
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(0);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(0);
    await pending;
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(0);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(0);

    expect(() => client.dispatch({ type: 'hub/recover' })).toThrow(/disposed/i);
    expect(() => client.dispatchPhysical(
      'touch:after-dispose',
      'hub.recover-after-dispose',
      { type: 'hub/recover' },
    )).toThrow(/disposed/i);
    client.dispose();
    expect(lifecycle.unsubscribeCalls).toEqual([
      'memory-warning',
      'resume',
      'suspend',
    ]);
  });

  it.each([
    ['first', 'memory-warning'] as const,
    ['middle', 'resume'] as const,
  ])('continues disposal when the %s lifecycle cleanup throws', async (_position, failing) => {
    const cleanupError = new Error(`${failing} cleanup failed`);
    const lifecycle = new FakeLifecyclePort(undefined, {
      [failing]: cleanupError,
    });
    const client = await createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([17, 18]),
      lifecycle,
    });
    await client.dispatchPhysical(
      'touch:failed-dispose-completed',
      'hub.recover-completed',
      { type: 'hub/recover' },
    );
    const pending = client.dispatchPhysical(
      'touch:failed-dispose-pending',
      'hub.recover-pending',
      { type: 'hub/recover' },
    );
    const physicalInputs = client as unknown as {
      pendingPhysicalInputs: Map<string, unknown>;
      completedPhysicalInputs: Map<string, unknown>;
    };
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(1);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(1);

    let disposalError: unknown;
    try {
      client.dispose();
    } catch (error) {
      disposalError = error;
    }

    expect(disposalError).toBeInstanceOf(InfiniteFlowClientLifecycleAggregateError);
    if (disposalError instanceof InfiniteFlowClientLifecycleAggregateError) {
      expect(disposalError.code).toBe('lifecycle-cleanup-failed');
      expect(disposalError.errors).toEqual([cleanupError]);
      expect(Object.isFrozen(disposalError.errors)).toBe(true);
    }
    expect(lifecycle.unsubscribeCalls).toEqual([
      'memory-warning',
      'resume',
      'suspend',
    ]);
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(0);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(0);
    await pending;
    expect(physicalInputs.pendingPhysicalInputs.size).toBe(0);
    expect(physicalInputs.completedPhysicalInputs.size).toBe(0);

    expect(() => client.dispatch({ type: 'hub/recover' })).toThrow(/disposed/i);
    client.dispose();
    expect(lifecycle.unsubscribeCalls).toEqual([
      'memory-warning',
      'resume',
      'suspend',
    ]);
  });

  it('aggregates lifecycle cleanup errors in reverse-registration call order', async () => {
    const memoryWarningError = new Error('memory-warning cleanup failed');
    const resumeError = new Error('resume cleanup failed');
    const lifecycle = new FakeLifecyclePort(undefined, {
      'memory-warning': memoryWarningError,
      resume: resumeError,
    });
    const client = await createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([27, 28]),
      lifecycle,
    });

    let disposalError: unknown;
    try {
      client.dispose();
    } catch (error) {
      disposalError = error;
    }

    expect(disposalError).toBeInstanceOf(InfiniteFlowClientLifecycleAggregateError);
    if (disposalError instanceof InfiniteFlowClientLifecycleAggregateError) {
      expect(disposalError.errors).toEqual([memoryWarningError, resumeError]);
    }
    expect(lifecycle.unsubscribeCalls).toEqual([
      'memory-warning',
      'resume',
      'suspend',
    ]);
  });

  it('rolls back suspend registration when resume registration fails', async () => {
    const lifecycle = new FakeLifecyclePort('resume');

    await expect(createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([71, 72]),
      lifecycle,
    })).rejects.toThrow('resume registration failed');

    expect(lifecycle.suspendListener).toBeUndefined();
    expect(lifecycle.resumeListener).toBeUndefined();
    expect(lifecycle.memoryWarningListener).toBeUndefined();
  });

  it('rolls back suspend and resume registrations when memory-warning registration fails', async () => {
    const lifecycle = new FakeLifecyclePort('memory-warning');

    await expect(createInfiniteFlowClient({
      storage: new InMemoryStoragePort(),
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([81, 82]),
      lifecycle,
    })).rejects.toThrow('memory-warning registration failed');

    expect(lifecycle.suspendListener).toBeUndefined();
    expect(lifecycle.resumeListener).toBeUndefined();
    expect(lifecycle.memoryWarningListener).toBeUndefined();
  });

  it('uses the stable lifecycle aggregate when constructor rollback also fails', async () => {
    const resumeRollbackError = new Error('resume rollback failed');
    const suspendRollbackError = new Error('suspend rollback failed');
    const lifecycle = new FakeLifecyclePort('memory-warning', {
      resume: resumeRollbackError,
      suspend: suspendRollbackError,
    });

    let constructionError: unknown;
    try {
      await createInfiniteFlowClient({
        storage: new InMemoryStoragePort(),
        hashPort: new PortableSha256HashPort(),
        seedPort: new SequenceSeedPort([83, 84]),
        lifecycle,
      });
    } catch (error) {
      constructionError = error;
    }

    expect(constructionError).toBeInstanceOf(InfiniteFlowClientLifecycleAggregateError);
    if (constructionError instanceof InfiniteFlowClientLifecycleAggregateError) {
      expect(constructionError.code).toBe('lifecycle-cleanup-failed');
      expect(constructionError.errors).toHaveLength(3);
      expect(constructionError.errors[0]).toMatchObject({
        message: 'memory-warning registration failed',
      });
      expect(constructionError.errors.slice(1)).toEqual([
        resumeRollbackError,
        suspendRollbackError,
      ]);
      expect(Object.isFrozen(constructionError.errors)).toBe(true);
    }
    expect(lifecycle.unsubscribeCalls).toEqual(['resume', 'suspend']);
  });

  it('previews Web-v1 raw without writing it and preserves future-version rejection', async () => {
    const storage = new InMemoryStoragePort();
    const client = await createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([91, 92]),
    });
    const before = storage.volatileSnapshot();
    const preview = client.previewWebV1({
      kind: 'web-local-storage-text',
      text: '{"version":99,"state":{}}',
    });
    expect(preview.status).toBe('rejected');
    if (preview.status === 'rejected') {
      expect(preview.reason.code).toBe('future-version');
    }
    expect(storage.volatileSnapshot()).toEqual(before);
  });

  it('blocks an invalid durable epoch without overwriting it', async () => {
    const storage = new InMemoryStoragePort({
      initial: { [INSTALLATION_EPOCH_KEY]: 'bad epoch with spaces' },
    });
    await expect(createInfiniteFlowClient({
      storage,
      hashPort: new PortableSha256HashPort(),
      seedPort: new SequenceSeedPort([1, 2]),
    })).rejects.toThrow(/refusing to overwrite/i);
    expect(await storage.read(INSTALLATION_EPOCH_KEY)).toBe('bad epoch with spaces');
  });
});
