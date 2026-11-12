// Pure input logic (src/input/logic.js): hold-to-skill, one-hand auto-attack, flick / double tap, and the control
// layouts at both target screens. Run: node --test prototype/action-combat-v1/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_ATTACK, CAPTION, FLICK, SKILL_HOLD_MS, createAttackGate, createAutoAttacker, createDoubleTap, createFlickTracker,
  dualLayout, focusOf, onehandLayout, wantsAutoAttack,
} from '../src/input/logic.js?v=6';
import { computeLayout } from '../src/view/renderer.js?v=6';
import { STAGE_DEMON_TOWER } from '../src/sim/stage.js?v=6';

test('attack gate: taps attack at once unless the skill is ready', () => {
  const gate = createAttackGate();
  assert.equal(gate.press(0, false), 'attack');
  assert.equal(gate.poll(SKILL_HOLD_MS + 50, false), null, 'no skill from a press made without full focus');
  assert.equal(gate.release(SKILL_HOLD_MS + 60, true), null);
});

test('attack gate: with the skill ready a short tap attacks on release, a hold releases the skill once', () => {
  const gate = createAttackGate();
  assert.equal(gate.press(1000, true), null, 'the press waits');
  assert.equal(gate.poll(1100, true), null);
  assert.equal(gate.release(1120, true), 'attack');

  assert.equal(gate.press(2000, true), null);
  assert.ok(gate.progress(2150) > 0.4 && gate.progress(2150) < 0.6);
  assert.equal(gate.poll(2000 + SKILL_HOLD_MS, true), 'skill');
  assert.equal(gate.poll(2500, true), null, 'only once');
  assert.equal(gate.release(2600, true), null, 'release after the skill does nothing');
  assert.equal(gate.progress(2600), 0);

  // A long hold whose poll was missed (e.g. a paused tab) still counts as a hold at release.
  assert.equal(gate.press(3000, true), null);
  assert.equal(gate.release(3400, true), 'skill');
  // Focus spent meanwhile: the delayed press falls back to an attack.
  assert.equal(gate.press(4000, true), null);
  assert.equal(gate.poll(4400, false), 'attack');
});

test('focusOf reads missing fields as empty', () => {
  assert.deepEqual(focusOf(undefined), { value: 0, max: 3, full: false });
  assert.equal(focusOf({ focus: 3 }).full, true);
  assert.equal(focusOf({ focus: 2, focusMax: 3 }).full, false);
});

function arena(enemies, hero = {}) {
  return {
    phase: 'fight',
    hero: { id: 1, team: 'hero', x: 300, z: 100, hp: 100, facing: 1, ...hero },
    entities: enemies.map((e, i) => ({ id: i + 2, team: 'enemy', hp: 50, hurt: { halfW: 16, halfD: 9 }, intangible: false, ...e })),
  };
}

test('auto-attack: only while a living, hittable enemy is in reach on either side', () => {
  const reachX = 300 + 16 + AUTO_ATTACK.reachX;
  assert.equal(wantsAutoAttack(arena([{ x: reachX, z: 100 }])), true, 'at the edge of reach');
  assert.equal(wantsAutoAttack(arena([{ x: 600 - reachX, z: 100 }])), true, 'behind the hero too');
  assert.equal(wantsAutoAttack(arena([{ x: reachX + 2, z: 100 }])), false, 'just out of reach');
  assert.equal(wantsAutoAttack(arena([{ x: 340, z: 100 + 9 + AUTO_ATTACK.reachZ + 2 }])), false, 'too far in depth');
  assert.equal(wantsAutoAttack(arena([{ x: 340, z: 100, hp: 0 }])), false, 'dead');
  assert.equal(wantsAutoAttack(arena([{ x: 340, z: 100, intangible: true }])), false, 'knocked down');
  assert.equal(wantsAutoAttack(arena([{ x: 340, z: 100, hurt: undefined }])), false, 'no hurtbox (projectile)');
  assert.equal(wantsAutoAttack(arena([{ x: 340, z: 100 }], { hp: 0 })), false, 'hero down');
  assert.equal(wantsAutoAttack({ ...arena([{ x: 340, z: 100 }]), phase: 'won' }), false, 'fight over');
  assert.equal(wantsAutoAttack(arena([])), false, 'nobody near');
});

test('auto-attacker: first wanted tick presses, then every interval; moving or suppress stops it', () => {
  const auto = createAutoAttacker(6);
  const run = (n, neutral, wanted) => Array.from({ length: n }, () => auto.tick(neutral, wanted));
  assert.deepEqual(run(13, true, true).map(Number).join(''), '1000001000001');
  assert.deepEqual(run(3, false, true), [false, false, false], 'moving');
  assert.equal(auto.tick(true, true), true, 'standing still again swings at once');
  auto.suppress(4);
  assert.deepEqual(run(5, true, true), [false, false, false, false, true]);
  assert.deepEqual(run(2, true, false), [false, false], 'nobody in reach');
});

test('flick: a quick release after passing the travel threshold, in the release direction', () => {
  const flick = createFlickTracker();
  flick.start();
  flick.move(0, 0.2, 2, 0);
  flick.move(30, 0.9, 30, -40);
  const dir = flick.end(30 + FLICK.maxMs - 10);
  assert.ok(dir);
  assert.ok(Math.abs(dir.x - 0.6) < 1e-9 && Math.abs(dir.z + 0.8) < 1e-9);

  flick.start();
  flick.move(0, 1, 10, 0);
  assert.equal(flick.end(FLICK.maxMs + 40), null, 'held too long: a normal stop, not a dodge');

  flick.start();
  flick.move(0, 1, 10, 0);
  flick.move(60, 0.3, 3, 0);
  assert.equal(flick.end(80), null, 'came back to the centre before lifting');

  flick.start();
  flick.move(0, 1, 10, 0);
  flick.move(500, 0.2, 2, 0);
  flick.move(560, 0.95, -10, 0);
  assert.deepEqual(flick.end(650), { x: -1, z: 0 }, 'a fresh flick at the end of a long touch counts');
});

test('double tap: two quick still taps; slow, long or moving taps do not count', () => {
  const taps = createDoubleTap();
  assert.equal(taps.end(80, 0, 0.05), false);
  assert.equal(taps.end(300, 220, 0.1), true);
  assert.equal(taps.end(500, 420, 0), false, 'the pair is consumed');
  assert.equal(taps.end(1200, 1100, 0), false);
  assert.equal(taps.end(1700, 1600, 0), false, 'gap too long');
  assert.equal(taps.end(1900, 1800, 0.9), false, 'moved: a flick or a drag');
  assert.equal(taps.end(2100, 2000, 0), false);
  assert.equal(taps.end(2600, 2150, 0), false, 'second touch held too long');
});

// ---- Layouts at the two target screens (logical H 844 and 692 = 390 * 568 / 320), with and without a home bar ----

const SCREENS = [
  { name: '390x844', H: 844 },
  { name: '390x844 + home bar', H: 844, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: '320x568', H: 692 },
  { name: '320x568 + small inset', H: 692, safe: { top: 20, right: 0, bottom: 20, left: 0 } },
];

const screenOf = ({ H, safe }) => ({ ...computeLayout(H, STAGE_DEMON_TOWER), safe: safe ?? { top: 0, right: 0, bottom: 0, left: 0 } });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function checkPads(name, screen, pads) {
  const bottom = screen.H - screen.safe.bottom;
  const list = Object.entries(pads);
  for (const [key, p] of list) {
    assert.ok(p.hit >= p.face + 16, `${name} ${key}: touch target larger than the face`);
    assert.ok(p.hit * (screen.scale ?? 1) >= 44 * 0.8, `${name} ${key}: touch target big enough`);
    assert.ok(p.y - p.face / 2 >= screen.bandBottom + 2, `${name} ${key}: face clear of the play band (${(p.y - p.face / 2).toFixed(1)} < ${screen.bandBottom})`);
    assert.ok(p.y + p.face / 2 + CAPTION <= bottom, `${name} ${key}: face + caption above the bottom inset`);
    assert.ok(p.x + p.hit / 2 <= screen.W - screen.safe.right + 0.5 && p.x - p.hit / 2 >= screen.safe.left, `${name} ${key}: inside the screen`);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [ka, a] = list[i];
      const [kb, b] = list[j];
      assert.ok(dist(a, b) >= (a.hit + b.hit) / 2 - 0.5, `${name}: ${ka} / ${kb} touch targets overlap by ${((a.hit + b.hit) / 2 - dist(a, b)).toFixed(1)}`);
      // A face's caption must not run into another face below it.
      const captionTop = a.y + a.face / 2;
      const below = b.y - b.face / 2;
      if (Math.abs(a.x - b.x) < (a.face + b.face) / 2 && b.y > a.y) assert.ok(below >= captionTop + CAPTION - 1, `${name}: ${ka} caption runs into ${kb}`);
    }
  }
}

test('dual layout: cluster below the band, no overlaps, all on the right half; stick rests on the left', () => {
  for (const s of SCREENS) {
    const screen = screenOf(s);
    const spec = dualLayout(screen);
    const pads = { attack: spec.attack, dodge: spec.dodge, spell: spec.spell, item: spec.item };
    checkPads(s.name, screen, pads);
    for (const [key, p] of Object.entries(pads)) assert.ok(p.x - p.hit / 2 >= screen.W / 2, `${s.name} ${key}: right of the stick zone`);
    assert.ok(spec.attack.face > spec.dodge.face + 20, 'attack is the large one');
    assert.equal(spec.zone.w, screen.W / 2);
    const { joy } = spec;
    assert.ok(joy.x + joy.radius <= screen.W / 2 && joy.y - joy.radius >= screen.bandBottom, `${s.name}: resting stick on the left, below the band`);
    assert.ok(joy.y + joy.radius <= screen.H - screen.safe.bottom, `${s.name}: resting stick above the bottom inset`);
  }
});

test('one-hand layout: three edge buttons below the band without overlaps; zone covers the lower 60%', () => {
  for (const s of SCREENS) {
    const screen = screenOf(s);
    const spec = onehandLayout(screen);
    checkPads(s.name, screen, { skill: spec.skill, spell: spec.spell, item: spec.item });
    assert.ok(spec.zone.y <= Math.round(screen.H * 0.4) && spec.zone.y + spec.zone.h >= screen.H - screen.safe.bottom);
    const { joy } = spec;
    for (const p of [spec.skill, spec.spell, spec.item]) assert.ok(dist(joy, p) >= joy.radius + p.hit / 2, `${s.name}: resting stick clear of the buttons`);
  }
});
