// The prototype's sample stage (妖塔 · 一层, three waves). Plain, deep-frozen data. The prototype also carries view-only
// `art` paths; they are not part of the simulation and are left out here.
//
// A wave starts once the previous one is cleared and the hero reaches triggerX. While it is active, `arena` locks the
// hero and the enemies inside [left, right] (world.arena). A spawn outside the arena walks in from that edge; `delay`
// (s after the wave starts) holds a spawn back; `boss: true` spawns announce themselves (bossIntro).
import { deepFreeze } from './tuning';
import type { ActionStage } from './types';

export const DEMON_TOWER_STAGE: ActionStage = deepFreeze<ActionStage>({
  id: 'demon-tower-1',
  name: '妖塔 · 一层',
  width: 2000,
  depth: 200,
  /** Bodies keep this far from the stage's (or the locked arena's) left and right ends. */
  margin: 24,
  heroSpawn: { x: 150, z: 110 },
  waves: [
    {
      name: '第一波',
      triggerX: 0,
      arena: { left: 40, right: 640 },
      spawns: [
        { archetype: 'fogDemon', x: 560, z: 50 },
        { archetype: 'fogDemon', x: 670, z: 150 },
        { archetype: 'fogDemon', x: 700, z: 96 },
      ],
    },
    {
      name: '第二波',
      triggerX: 860,
      arena: { left: 760, right: 1360 },
      spawns: [
        { archetype: 'fogDemon', x: 1390, z: 60 },
        { archetype: 'fogDemon', x: 1410, z: 150 },
        { archetype: 'sparkImp', x: 1400, z: 104 },
        { archetype: 'sparkImp', x: 1400, z: 40, delay: 3 },
      ],
    },
    {
      name: '第三波 · 剔骨塔卒',
      triggerX: 1480,
      arena: { left: 1380, right: 1980 },
      spawns: [
        { archetype: 'towerButcher', x: 1860, z: 100, boss: true },
        { archetype: 'fogDemon', x: 2010, z: 46, delay: 1.5 },
        { archetype: 'sparkImp', x: 2010, z: 160, delay: 16 },
      ],
    },
  ],
});
