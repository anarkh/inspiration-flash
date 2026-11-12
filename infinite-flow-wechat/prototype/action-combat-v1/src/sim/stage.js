// Stage definitions: size, walkable band, hero spawn, waves and art. Plain data only.
//
// Coordinates: x runs along the stage, z is depth inside the walkable band (0 = far / top edge, `depth` = near /
// bottom edge), y is height above the ground. One unit is one logical px on a 390-wide screen.

export const STAGE_DEMON_TOWER = {
  id: 'demon-tower-1',
  name: '妖塔 · 一层',
  width: 2000,
  depth: 200,
  /** Bodies keep this far from the stage's (or the locked arena's) left and right ends. */
  margin: 24,
  heroSpawn: { x: 150, z: 110 },
  // A wave starts once the previous one is cleared and the hero reaches triggerX. While it is active, `arena` locks
  // the hero and the enemies inside [left, right] (world.arena). A spawn outside the arena walks in from that edge;
  // `delay` (s after the wave starts) holds a spawn back; `boss: true` spawns announce themselves (bossIntro).
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
  // Art paths are relative to index.html and must carry ?v= (tools/bump-version.mjs checks this).
  art: {
    // Swap the backdrop by replacing this one line. floorFraction = share of the image height, from the bottom, that
    // is floor (0 = wall only; the floor then comes from `floor`). mirror = tile horizontally, every other copy mirrored.
    // Painted side view (1774×887): the floor starts at y≈529, level across the width, so 358 / 887 ≈ 0.404 is floor.
    backdrop: { src: './assets/stage-demon-tower.jpg?v=6', floorFraction: 0.404, mirror: true },
    // Previous wall-only panorama (the floor then came from `floor`):
    // backdrop: { src: '../../cocos/assets/resources/dungeon/demon-tower-1-v1.png?v=6', floorFraction: 0, mirror: true },
    // Only used while backdrop.floorFraction is 0: a crop of the top-down floor texture, squashed into the band.
    floor: { src: '../../cocos/assets/resources/dungeon-world/demon_tower_1-v1.jpg?v=6', crop: [430, 600, 680, 400] },
  },
};
