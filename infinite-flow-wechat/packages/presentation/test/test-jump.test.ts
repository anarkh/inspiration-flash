import { createInitialState, DUNGEON_ORDER } from '@infinite-flow/core';
import { buildGameViewModel } from '../src/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyTestJump(): void {
  const state = createInitialState();
  const hidden = buildGameViewModel(state, {}).sections[1].detail;
  assert(hidden.kind === 'hub' && hidden.testJump === undefined, 'players never see the chapter jump');
  const shown = buildGameViewModel(state, { testMode: true, entryDraft: { ...((hidden.kind === 'hub' && hidden.entryDraft) || {}), dungeonId: DUNGEON_ORDER[7]! } as never }).sections[1].detail;
  assert(shown.kind === 'hub' && shown.testJump, 'test mode offers the jump at the gate');
  const jump = shown.testJump;
  assert(jump.enabled && jump.emphasis === 'danger' && jump.riskReason?.includes('覆盖当前存档'), 'the jump warns that it overwrites the save');
  assert(jump.event?.kind === 'command' && jump.event.command.type === 'test/jump-to-chapter' && jump.event.command.chapter === 8,
    'the jump targets the chapter selected at the gate');
}
