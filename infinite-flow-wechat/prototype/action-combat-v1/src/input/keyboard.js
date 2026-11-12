// Keyboard: WASD / arrows move (8 directions), J attack (held SKILL_HOLD_MS with 战意 full = 战技), K dodge, L 战技,
// U 法术, I 道具. Always active alongside the touch scheme.
import { createEdgeLatch, emptyInput } from './input-struct.js?v=6';
import { createAttackGate, focusOf } from './logic.js?v=6';

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};
const PRESS_KEYS = { KeyK: 'dodge', KeyL: 'skill', KeyU: 'spell', KeyI: 'item' };
const ATTACK_KEY = 'KeyJ';

export function createKeyboard(target = window, { getWorld } = {}) {
  const held = new Set();
  const latch = createEdgeLatch();
  const gate = createAttackGate();
  const skillReady = () => focusOf(getWorld?.()?.hero).full;
  const fire = edge => { if (edge) latch.press(edge); };
  // Form controls in the demo bar keep their own keys (arrows change a select).
  const ignore = event => event.target instanceof HTMLElement && event.target.closest('select, input, textarea');

  function onKeyDown(event) {
    if (ignore(event)) return;
    const move = MOVE_KEYS[event.code];
    const press = PRESS_KEYS[event.code];
    const attack = event.code === ATTACK_KEY;
    if (!move && !press && !attack) return;
    event.preventDefault();
    if (!event.repeat) {
      if (press) latch.press(press);
      if (attack) fire(gate.press(performance.now(), skillReady()));
    }
    held.add(event.code);
  }
  function onKeyUp(event) {
    held.delete(event.code);
    if (event.code === ATTACK_KEY) fire(gate.release(performance.now(), skillReady()));
  }
  function onBlur() {
    held.clear();
    gate.reset();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const down = direction => [...held].some(code => MOVE_KEYS[code] === direction);

  return {
    read() {
      fire(gate.poll(performance.now(), skillReady()));
      const input = emptyInput();
      let x = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
      let z = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
      if (x !== 0 && z !== 0) { x *= Math.SQRT1_2; z *= Math.SQRT1_2; }
      input.moveX = x;
      input.moveZ = z;
      input.attackHeld = gate.held;
      return latch.drainInto(input);
    },
    reset() { held.clear(); latch.clear(); gate.reset(); },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
