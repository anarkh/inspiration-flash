import { describe, expect, it } from 'vitest';

import { InMemoryStoragePort, PortableSha256HashPort, SequenceSeedPort } from '@infinite-flow/runtime';
import { buildActionEncounter, canCaptureInActionWorld } from '@infinite-flow/core';

import { createInfiniteFlowClient, type InfiniteFlowClient } from '../src/index.js';
import { competentBot, idleBot, playFight } from '../../application/test/action-combat-driver.js';

type Command = Parameters<InfiniteFlowClient['dispatch']>[0];

async function bootClient(storage: InMemoryStoragePort, seeds: number[]): Promise<InfiniteFlowClient> {
  return createInfiniteFlowClient({ storage, hashPort: new PortableSha256HashPort(), seedPort: new SequenceSeedPort(seeds) });
}

async function send(client: InfiniteFlowClient, command: Command) {
  const result = await client.dispatch(command);
  expect(result.status, JSON.stringify(command).slice(0, 120)).toBe('committed');
  return result;
}

/** Recovers the durable save after a crash; every state the session commits went through the save codec. */
async function recover(client: InfiniteFlowClient, storage: InMemoryStoragePort): Promise<InfiniteFlowClient> {
  await client.retryPendingPersistence();
  client.dispose();
  storage.crash();
  return bootClient(storage, []);
}

describe('real-time fights through the client session', () => {
  it('restarts an unfinished fight from the same encounter after a reload, then persists its victory', async () => {
    const storage = new InMemoryStoragePort({ durability: 'requires-flush' });
    let client = await bootClient(storage, [11, 12, 13]);
    await send(client, { type: 'test/jump-to-chapter', chapter: 1 });
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    await send(client, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
    const encounter = buildActionEncounter(client.getState());
    expect(encounter).toBeDefined();

    client = await recover(client, storage);
    expect(client.getState().phase).toBe('combat');
    expect(buildActionEncounter(client.getState())).toEqual(encounter);

    const played = playFight(encounter!.config, competentBot);
    expect(played.world.phase).toBe('won');
    const result = await send(client, { type: 'combat/resolve-action', log: played.log });
    expect(result.events.map(event => event.type)).toContain('combat.action-resolved');
    client = await recover(client, storage);
    expect(client.getState().phase).toBe('explore');
    expect(client.getState().run?.clearedNodeIds).toContain('fog_lesser_demon');
    client.dispose();
  });

  it('persists a capture', async () => {
    const storage = new InMemoryStoragePort({ durability: 'requires-flush' });
    let client = await bootClient(storage, [21, 22, 23]);
    await send(client, { type: 'test/jump-to-chapter', chapter: 1 });
    await send(client, { type: 'hub/buy-item', itemId: 'capture_net' });
    await send(client, { type: 'hub/configure-tactical-loadout', itemIds: ['capture_net'] });
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    await send(client, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
    const encounter = buildActionEncounter(client.getState())!;
    expect(encounter.capture?.petId).toBe('mist_kitten');
    const played = playFight(encounter.config, competentBot, { stop: world => canCaptureInActionWorld(encounter, world) });
    expect(played.world.phase).toBe('fight');
    await send(client, { type: 'combat/resolve-action', log: played.log, capture: 'mist_kitten' });
    client = await recover(client, storage);
    expect(client.getState().ownedPets).toContain('mist_kitten');
    expect(client.getState().run?.captures).toBe(1);
    client.dispose();
  });

  it('persists a defeat', async () => {
    const storage = new InMemoryStoragePort({ durability: 'requires-flush' });
    let client = await bootClient(storage, [31, 32, 33]);
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    await send(client, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
    const played = playFight(buildActionEncounter(client.getState())!.config, idleBot);
    expect(played.world.phase).toBe('lost');
    await send(client, { type: 'combat/resolve-action', log: played.log });
    client = await recover(client, storage);
    expect(client.getState().phase).toBe('result');
    expect(client.getState().combat).toBeUndefined();
    client.dispose();
  });

  it('rejects a malformed log at the session boundary without consuming a revision', async () => {
    const client = await bootClient(new InMemoryStoragePort(), [41, 42, 43]);
    await client.enterRun({ dungeonId: 'demon_tower_1', protocolId: 'standard' });
    await send(client, { type: 'run/select-node', nodeId: 'fog_lesser_demon' });
    const before = client.getRevisionStatus().durableRevision;
    const rejected = await client.dispatch({ type: 'combat/resolve-action', log: { version: 1, ticks: 5, changes: [3, 0] } } as Command);
    expect(rejected.status).not.toBe('committed');
    expect(client.getRevisionStatus().durableRevision).toBe(before);
    expect(client.getState().phase).toBe('combat');
    client.dispose();
  });
});
