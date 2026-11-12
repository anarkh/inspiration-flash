// Touch scheme B (单手): one floating joystick that starts anywhere in the lower ~60% of the screen (outside the
// buttons), playable with one thumb.
//   Stick neutral (or no touch): auto-attack while a living enemy is in reach (logic.js wantsAutoAttack), which the sim
//   chains into the 1-2-3 string; moving stops it (the sim withdraws a queued neutral-stick swing and lets the stick
//   cancel recovery, so walking away is immediate).
//   Quick flick (released within FLICK.maxMs of passing FLICK.minTravel): dodge in the flick direction.
//   Double tap: dodge backwards (away from where the hero faces).
//   Three edge buttons: 战技 (attack art, lit only with 战意 full; tap to release), 法术, 道具.
// Same interface as touch-dual.js.
import { HERO_TUNING } from '../sim/hero.js?v=6';
import { createEdgeLatch, emptyInput } from './input-struct.js?v=6';
import {
  DEAD_ZONE, cooldownRatio, createAutoAttacker, createDoubleTap, createFlickTracker, focusOf, onehandLayout, wantsAutoAttack,
} from './logic.js?v=6';
import { createJoystick, createPad, element } from './touch-common.js?v=6';

/** A touch that has not left the dead zone for this long counts as standing still (so a flick's first ms never swing). */
const SETTLE_MS = 120;
/** After a stick dodge, its direction is held while the hero is busy (attack / hurt) so the queued dodge keeps it. */
const DODGE_HOLD_TICKS = 15;
const DODGE_SUPPRESS_TICKS = 18;
const BUSY_STATES = new Set(['attack1', 'attack2', 'attack3', 'hurt', 'down']);

export function createTouchOnehand(container, { layout, getWorld }) {
  const root = element('div', 'touch touch-onehand', container);
  const latch = createEdgeLatch();
  const flick = createFlickTracker();
  const taps = createDoubleTap();
  const auto = createAutoAttacker();
  /** { x, z, ticks, fresh } while a stick dodge's direction is being held. */
  let dodgeHold = null;

  function dodgeToward(dir) {
    latch.press('dodge');
    dodgeHold = { x: dir.x, z: dir.z, ticks: DODGE_HOLD_TICKS, fresh: true };
    auto.suppress(DODGE_SUPPRESS_TICKS);
  }

  const joystick = createJoystick(root, container, {
    deadZone: DEAD_ZONE,
    onStart() {
      flick.start();
      root.classList.add('touched');
    },
    onSample(now, travel, dx, dy) { flick.move(now, travel, dx, dy); },
    onEnd(now, startedAt, maxTravel) {
      const dir = flick.end(now);
      const doubled = taps.end(now, startedAt, maxTravel);
      if (dir) dodgeToward(dir);
      else if (doubled) dodgeToward({ x: -(getWorld()?.hero?.facing || 1), z: 0 });
    },
  });
  const hint = element('div', 'onehand-hint', root);
  hint.innerHTML = '拖动：移动 · 松手：自动三连斩<br>甩动 / 双击：闪避';

  const pads = {
    spell: createPad(root, { name: 'spell', art: 'spells', label: '法术', caption: '法术', sweep: true, onDown: () => latch.press('spell') }),
    item: createPad(root, { name: 'item', art: 'items', label: '道具', caption: '道具', sweep: true, badge: true, onDown: () => latch.press('item') }),
    skill: createPad(root, { name: 'skill', art: 'attack', label: '战技', caption: '战技', dots: true, onDown: () => latch.press('skill') }),
  };
  const DENIED = { skill: 'skill', spell: 'spell', item: 'item' };

  function setLayout(next) {
    const spec = onehandLayout(next);
    const { joy, zone } = spec;
    const bottom = next.H - (next.safe?.bottom ?? 0);
    joystick.setLayout(next, zone, joy, {
      x0: joy.radius + 4, x1: next.W - joy.radius - 4,
      y0: zone.y + joy.radius, y1: bottom - joy.radius - 4,
    });
    for (const [key, pad] of Object.entries(pads)) pad.place(spec[key]);
    Object.assign(hint.style, { left: `${(next.safe?.left ?? 0) + 10}px`, top: `${joy.y + joy.radius + 6}px`, width: `${spec.spell.x - spec.spell.hit / 2 - 14}px` });
  }
  setLayout(layout);

  return {
    name: 'onehand',
    read() {
      const world = getWorld();
      const input = emptyInput();
      input.moveX = joystick.x;
      input.moveZ = joystick.z;
      const moving = input.moveX !== 0 || input.moveZ !== 0;
      if (dodgeHold) {
        const state = world?.hero?.state;
        if (!dodgeHold.fresh && (state === 'dodge' || !BUSY_STATES.has(state) || --dodgeHold.ticks <= 0)) {
          dodgeHold = null;
        } else {
          dodgeHold.fresh = false;
          if (!moving) {
            input.moveX = dodgeHold.x;
            input.moveZ = dodgeHold.z;
          }
        }
      }
      const neutral = !moving && !dodgeHold && (!joystick.active || joystick.stillFor(performance.now()) >= SETTLE_MS);
      if (auto.tick(neutral, neutral && wantsAutoAttack(world))) latch.press('attack');
      return latch.drainInto(input);
    },
    setLayout,
    render(world) {
      const hero = world.hero;
      const T = HERO_TUNING;
      const focus = focusOf(hero);
      pads.skill.setFocus(Math.floor(focus.value));
      pads.skill.toggle('ready', focus.full);
      pads.skill.toggle('dim', !focus.full);
      pads.spell.setCooldown(cooldownRatio(hero.spellCooldown, T.spell?.cooldown));
      pads.spell.toggle('dim', focus.value < 1);
      pads.item.setCooldown(cooldownRatio(hero.itemCooldown, T.item?.cooldown));
      const pills = hero.items?.pill;
      pads.item.setBadge(pills === undefined ? '' : `×${pills}`);
      pads.item.toggle('dim', pills === 0);
    },
    handleEvents(events) {
      for (const event of events) if (event.type === 'denied') pads[DENIED[event.what]]?.deny();
    },
    reset() {
      latch.clear();
      auto.reset();
      taps.reset();
      dodgeHold = null;
      joystick.reset();
      for (const pad of Object.values(pads)) pad.reset();
    },
    destroy() { root.remove(); },
  };
}
