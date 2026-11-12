// Touch scheme A (双手): a floating joystick on the left half; on the right, the ink controls on an arc the right thumb
// sweeps: 攻击 (large, bottom-right, with the real 战意 dots), 闪避 (shield art), 法术, 道具.
// With 战意 full the attack glows and holding it SKILL_HOLD_MS releases the 战技 (a tap still attacks).
//
// Scheme interface (touch-onehand.js implements the same):
//   create(container, { layout, getWorld }) -> { name, read(), setLayout(layout), render(world), handleEvents(events), reset(), destroy() }
//   read() is called once per sim tick and returns the input struct with that tick's press edges.
import { HERO_TUNING } from '../sim/hero.js?v=6';
import { createEdgeLatch, emptyInput } from './input-struct.js?v=6';
import { DEAD_ZONE, cooldownRatio, createAttackGate, dualLayout, focusOf } from './logic.js?v=6';
import { createJoystick, createPad, element } from './touch-common.js?v=6';

export function createTouchDual(container, { layout, getWorld }) {
  const root = element('div', 'touch touch-dual', container);
  const latch = createEdgeLatch();
  const gate = createAttackGate();
  const now = () => performance.now();
  const skillReady = () => focusOf(getWorld()?.hero).full;
  const fire = edge => { if (edge) latch.press(edge); };

  const joystick = createJoystick(root, container, { deadZone: DEAD_ZONE });
  const pads = {
    dodge: createPad(root, { name: 'dodge', art: 'guard', label: '闪避', caption: '闪避', sweep: true, onDown: () => latch.press('dodge') }),
    spell: createPad(root, { name: 'spell', art: 'spells', label: '法术', caption: '法术', sweep: true, onDown: () => latch.press('spell') }),
    item: createPad(root, { name: 'item', art: 'items', label: '道具', caption: '道具', sweep: true, badge: true, onDown: () => latch.press('item') }),
    attack: createPad(root, {
      name: 'attack', art: 'attack', label: '攻击（战意满时长按：战技）', caption: '攻击', dots: true,
      onDown: () => fire(gate.press(now(), skillReady())),
      onUp: () => fire(gate.release(now(), skillReady())),
    }),
  };
  /** Which pad shakes when the sim emits denied {what}. */
  const DENIED = { attack: 'attack', skill: 'attack', dodge: 'dodge', spell: 'spell', item: 'item' };

  function setLayout(next) {
    const spec = dualLayout(next);
    const { joy, zone } = spec;
    joystick.setLayout(next, zone, joy, {
      x0: joy.radius + 4, x1: zone.x + zone.w - 8,
      y0: zone.y + joy.radius, y1: next.H - (next.safe?.bottom ?? 0) - joy.radius - 4,
    });
    for (const [key, pad] of Object.entries(pads)) pad.place(spec[key]);
  }
  setLayout(layout);

  return {
    name: 'dual',
    read() {
      fire(gate.poll(now(), skillReady()));
      const input = emptyInput();
      input.moveX = joystick.x;
      input.moveZ = joystick.z;
      input.attackHeld = gate.held;
      return latch.drainInto(input);
    },
    setLayout,
    render(world) {
      fire(gate.poll(now(), skillReady()));
      const hero = world.hero;
      const T = HERO_TUNING;
      const focus = focusOf(hero);
      pads.attack.setFocus(Math.floor(focus.value));
      pads.attack.toggle('ready', focus.full);
      pads.attack.setCaption(focus.full ? '长按 · 战技' : '攻击');
      pads.attack.setHold(gate.progress(now()));
      pads.dodge.setCooldown(cooldownRatio(hero.dodgeCooldown, T.dodge?.cooldown));
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
      gate.reset();
      joystick.reset();
      for (const pad of Object.values(pads)) pad.reset();
    },
    destroy() { root.remove(); },
  };
}
