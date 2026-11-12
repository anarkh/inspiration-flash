import type { CombatActionViewModel, GameViewModel } from '@infinite-flow/presentation';

/**
 * Which battle screen a fight with a real-time encounter uses. The side-scrolling action battle is the default; the
 * turn-based duel stays reachable through this one explicit switch (its headless suites, `?battle=turn-based` in debug
 * web builds) until it is removed. The scene keys, the View's controller and the walk scene all read it here, so they
 * always agree on the screen.
 */
export type InfiniteFlowBattleRenderer = 'action' | 'turn-based';

let battleRenderer: InfiniteFlowBattleRenderer = 'action';

export function configureInfiniteFlowBattleRenderer(renderer: InfiniteFlowBattleRenderer): void {
  if (renderer !== 'action' && renderer !== 'turn-based') {
    throw new Error(`Unknown battle renderer: ${String(renderer)}`);
  }
  battleRenderer = renderer;
}

export function getInfiniteFlowBattleRenderer(): InfiniteFlowBattleRenderer {
  return battleRenderer;
}

/** The real-time fight this model's scene plays, or undefined when the turn-based screen (or no fight) is shown. */
export function getInfiniteFlowActionBattle(model: GameViewModel | undefined): CombatActionViewModel | undefined {
  if (battleRenderer !== 'action') return undefined;
  const detail = model?.sections[1]?.detail;
  return detail?.kind === 'combat' ? detail.actionCombat : undefined;
}

/**
 * Encounter identity: the stage id carries the chapter and room, the seed hashes the run facts (HP, turn, cleared
 * rooms), so a failed escape's new encounter gets a new key while a re-render of the same fight keeps it.
 */
export function getInfiniteFlowActionBattleKey(action: CombatActionViewModel): string {
  return `${action.config.stage?.id ?? action.dungeonId}:${action.config.seed ?? 1}`;
}

/** Debug web builds only (the caller gates on HTML5 && DEBUG): `?battle=turn-based` shows the turn-based screen. */
export function turnBasedBattleRequested(): boolean {
  const global = globalThis as { wx?: unknown; location?: { search?: string } };
  if (global.wx !== undefined) return false;
  return new URLSearchParams(global.location?.search ?? '').get('battle') === 'turn-based';
}
