// Sprite images, tints, poses and drawing.
//   Hero: real animation frames from an action atlas (src/view/hero-anim.js picks the frame from sim state) plus a
//   light procedural layer on top: impact / landing squash, a lean into acceleration, an overshoot when stopping, a
//   squashed 3-frame turn-around, frame smears and cross-fades, afterimages of the actual frame.
//   Monsters: one still illustration each, animated procedurally (translate, squash / stretch, lean, flip).
// Poses are derived from sim fields (state, stateTime, facing, stride, flash, y, telegraph, ...) plus, for the hero, a
// small view-side motion memory (createSpriteMotion) the renderer keeps per entity. Missing fields fall back to defaults.
import { ENEMY_ARCHETYPES } from '../sim/enemies.js?v=6';
import { HIT_FLASH } from '../sim/combat.js?v=6';
import { HERO_ART_DEFAULT, clipFrame, heroAtlas, heroBeat, loadHeroAtlas, runBobOffset, setHeroAtlas } from './hero-anim.js?v=6';

/** Paths relative to index.html. The hero's image comes from its atlas (hero-anim.js). */
export const SPRITE_IMAGES = {
  fogDemon: '../../cocos/assets/resources/monster-world/fog-lesser-demon-world-v1.png?v=6',
  sparkImp: '../../cocos/assets/resources/monster-world/spark-imp-world-v1.png?v=6',
  towerButcher: '../../cocos/assets/resources/monster-world/tower-butcher-world-v1.png?v=6',
};

/**
 * Sprite definitions. `sourceHeight` is the art's standing height in source px (entity.height maps onto it).
 * Frame sprites (`frames: true`, the hero) take rect / foot per frame from the loaded atlas and face right.
 * Still art: foot = midpoint of the two feet measured from the alpha channel (the near foot sits a little lower).
 * `motion` picks the idle / walk character; `dissolve` the palette of the death dissolve (renderer + vfx).
 * All three monster illustrations face left (head, claws and cleaver point left), so artFacing is -1.
 */
const SPRITES = {
  hero: { image: 'hero', frames: true, sourceHeight: 320, artFacing: 1, ghost: '#ffcf6a', pose: heroPose },
  fogDemon: { image: 'fogDemon', rect: [0, 0, 512, 768], foot: [232, 742], sourceHeight: 728, artFacing: -1, ghost: '#ff5a3a', pose: monsterPose, motion: 'drift', dissolve: 'fog', lunge: 20 },
  sparkImp: { image: 'sparkImp', rect: [0, 0, 512, 768], foot: [262, 724], sourceHeight: 711, artFacing: -1, ghost: '#ff8a2a', pose: monsterPose, motion: 'skitter', dissolve: 'ember', lunge: 16 },
  towerButcher: { image: 'towerButcher', rect: [0, 0, 512, 768], foot: [268, 728], sourceHeight: 704, artFacing: -1, ghost: '#ff3a2a', pose: monsterPose, motion: 'stomp', dissolve: 'ink', lunge: 24 },
};

/** Rim-light colours (the silhouette tint drawn behind the sprite with a glow). */
const RIM = { red: '#ff3a22', gold: '#ffc24a', cyan: '#7fe8ff', green: '#8ff07a' };
/** Tint canvases are built at reduced resolution (they are only drawn as brief flashes, ghosts and glows). */
const TINT_SCALE = 0.5;
const TINT_MAX_SIDE = 1600;

let devicePixels = 2;
/** The renderer reports its backing-store scale so glow radii stay the same size on any screen. */
export function setSpritePixelRatio(pr) {
  devicePixels = pr;
}

export function hasSprite(key) {
  return key in SPRITES;
}

/** Static facts the renderer needs for overlays (fog wisps, ember flicker, dissolve palette, frame sprites). */
export function spriteInfo(key) {
  return SPRITES[key];
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`素材加载失败：${src}`));
    image.src = src;
  });
}

/**
 * Load the hero atlas (`heroArt`: 'action' | 'standin'), every sprite and `extra` ({key: src}); builds the flash,
 * rim, shade and ghost tints once. Any missing image or invalid atlas rejects (main.js shows it on screen).
 */
export async function loadSpriteBank(extra = {}, { heroArt = HERO_ART_DEFAULT } = {}) {
  const hero = await loadHeroAtlas(heroArt);
  const sources = { ...SPRITE_IMAGES, hero: hero.src, ...extra };
  const entries = await Promise.all(Object.entries(sources).map(async ([key, src]) => [key, await loadImage(src)]));
  const images = Object.fromEntries(entries);
  const size = hero.atlas.size;
  if (images.hero.naturalWidth !== size[0] || images.hero.naturalHeight !== size[1]) {
    throw new Error(`主角图集尺寸 ${images.hero.naturalWidth}×${images.hero.naturalHeight} 与 JSON 的 size ${size.join('×')} 不一致`);
  }
  setHeroAtlas(hero.atlas);
  SPRITES.hero.sourceHeight = hero.atlas.unitHeight;
  const tints = {};
  const tintScale = {};
  for (const [key, def] of Object.entries(SPRITES)) {
    const image = images[def.image];
    const ts = Math.min(TINT_SCALE, TINT_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    tintScale[key] = ts;
    // White: hit flash and the rim silhouette (the rim colour comes from shadowColor); red: monster windup glow.
    tints[key] = {
      white: tinted(image, '#ffffff', ts),
      red: def.frames ? null : tinted(image, RIM.red, ts),
      dark: tinted(image, '#07060a', ts),
      ghost: tinted(image, def.ghost, ts),
    };
  }
  return { images, tints, tintScale, heroArt };
}

function tinted(image, color, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(image.naturalWidth * scale);
  canvas.height = Math.ceil(image.naturalHeight * scale);
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function basePose() {
  return {
    frame: 0, offsetX: 0, offsetY: 0, lean: 0, scaleX: 1, scaleY: 1, alpha: 1,
    flash: 0, red: 0, rim: 0, rimColor: 'red', dark: 0, dissolve: 0, smear: 0,
    facing: null, nextFrame: null, blend: 0, prevFrame: null, prevAlpha: 0, shadow: 1,
  };
}

/**
 * The entity's pose this frame. offsetX is forward along facing, offsetY is up, lean > 0 tips the head forward.
 * `motion` is the renderer's per-entity view memory (frame sprites only; see createSpriteMotion).
 */
export function poseOf(entity, clock, motion = null) {
  const def = SPRITES[entity.sprite];
  const pose = def.pose(entity, clock, def, motion);
  pose.flash = entity.flash > 0 ? Math.min(1, entity.flash / HIT_FLASH) : 0;
  return pose;
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = k => 1 - (1 - k) * (1 - k);

/** Falling onto the back (pivot at the feet); `riseAt` starts getting up. */
function fallPose(p, t, { fallTime, riseAt, riseTime }) {
  let k = ease(Math.min(1, t / fallTime));
  if (riseAt !== undefined && t > riseAt) {
    const r = Math.min(1, (t - riseAt) / riseTime);
    k = 1 - ease(r);
    // Getting up goes through a crouch.
    p.scaleY = 1 - 0.1 * Math.sin(r * Math.PI);
  }
  p.lean = -1.42 * k;
  p.offsetX = -6 * k;
  p.scaleY *= 1 - 0.05 * k;
  return p;
}

// ---- Hero: frames + a light procedural layer ----

/** Seconds of the squashed turn-around (about 4 frames at 60 Hz) and of the smear left by a frame change. */
const TURN_TIME = 0.07;
const SMEAR_TIME = 0.05;
const FADE_TIME = 0.08;
/** Frame changes that read as a fast blade move get a smear; settling changes (into idle) a softer cross-fade. */
const SMEAR_BEATS = new Set(['strike', 'impact', 'sweep', 'dash', 'launch', 'release', 'apex']);
/** Changes into these poses snap (an anticipation should pop, not dissolve in). */
const SNAP_BEATS = new Set(['antic', 'windup', 'charge', 'gather', 'recoil', 'run']);

/**
 * View-side memory for one frame sprite, updated by the renderer every frame (updateSpriteMotion) and read by its
 * pose: the facing being shown during a turn, smoothed acceleration, stop and landing times, the last frame.
 */
export function createSpriteMotion(e) {
  return {
    now: 0, facing: e.facing >= 0 ? 1 : -1, turnFrom: 0, turnAt: -1,
    vx: e.vx ?? 0, ax: 0, speed: 0, peak: 0, stopAt: -1, airborne: (e.y ?? 0) > 0, landAt: -1,
    frame: null, prevFrame: null, prevAt: -1, prevFade: SMEAR_TIME, beat: null,
  };
}

/** Advance the motion memory. simDt = sim seconds this frame (0 while frozen in hit-stop or paused). */
export function updateSpriteMotion(m, e, simDt, now) {
  m.now = now;
  const facing = e.facing >= 0 ? 1 : -1;
  if (facing !== m.facing && m.turnAt < 0) { m.turnFrom = m.facing; m.turnAt = now; }
  if (m.turnAt >= 0 && now - m.turnAt >= TURN_TIME) m.turnAt = -1;
  m.facing = facing;
  if (simDt > 0) {
    const vx = e.vx ?? 0;
    const ax = (vx - m.vx) / simDt;
    m.ax += (ax - m.ax) * Math.min(1, simDt * 18);
    m.vx = vx;
    const speed = Math.hypot(vx, e.vz ?? 0);
    if (m.speed >= 20 && speed < 20 && m.peak > 120 && (e.state === 'idle' || e.state === 'run')) m.stopAt = now;
    m.peak = speed >= 20 ? Math.max(m.peak, speed) : 0;
    m.speed = speed;
    const airborne = (e.y ?? 0) > 0.5;
    if (m.airborne && !airborne) m.landAt = now;
    m.airborne = airborne;
  }
}

/** Record the frame actually drawn: a change leaves the old frame as a smear / cross-fade for a moment. */
export function settleFrame(m, pose) {
  if (pose.frame !== m.frame) {
    if (m.frame !== null) {
      m.prevFrame = m.frame;
      m.prevAt = m.now;
      m.prevFade = SMEAR_BEATS.has(pose.beat) ? SMEAR_TIME : FADE_TIME;
    }
    m.frame = pose.frame;
  }
  const age = m.now - m.prevAt;
  if (m.prevFrame && age < m.prevFade && !SNAP_BEATS.has(pose.beat)) {
    pose.prevFrame = m.prevFrame;
    pose.prevAlpha = (SMEAR_BEATS.has(pose.beat) ? 0.4 : 0.45) * (1 - age / m.prevFade);
  }
}

function heroPose(e, clock, def, m) {
  const p = basePose();
  const atlas = heroAtlas();
  const unit = (e.height ?? 128) / atlas.unitHeight;
  const b = heroBeat(e, clock, atlas.runCycle * unit);
  p.frame = clipFrame(atlas, b.clip, b.index, b.cycle ?? null);
  p.beat = b.beat;
  if (b.next !== undefined && b.blend > 0) {
    p.nextFrame = clipFrame(atlas, b.clip, b.next);
    p.blend = b.blend;
  }
  const now = m?.now ?? clock;
  switch (b.beat) {
    case 'strike':
    case 'impact':
    case 'sweep': {
      // The blow lands: a short squash that springs back (held through hit-stop, since `since` is sim time).
      const amp = b.clip === 'attack3' ? 0.08 : b.clip === 'skill' ? 0.06 : 0.04;
      const s = Math.max(0, 1 - b.since / 0.1);
      p.scaleY = 1 - amp * s * s;
      p.scaleX = 1 + amp * 0.6 * s * s;
      if (b.clip === 'skill') { p.rim = 1; p.rimColor = 'gold'; }
      break;
    }
    case 'apex':
      // The leap is drawn in the frame (about a third of the stance height up): only the ground shadow reacts.
      p.shadow = 0.55;
      break;
    case 'launch':
      p.scaleX = 1.04;
      p.scaleY = 0.96;
      break;
    case 'dash':
      // The glide frame carries the speed; a faint smear only in its first half.
      if (b.clip === 'dodge') { p.smear = 0.5 * Math.max(0, 1 - 2 * b.k); p.alpha = 0.92; } else { p.rim = 1; p.rimColor = 'gold'; }
      break;
    case 'slide': {
      const s = Math.max(0, 1 - b.since / 0.1);
      p.scaleY = 1 - 0.04 * s;
      p.scaleX = 1 + 0.03 * s;
      break;
    }
    case 'recoil': {
      const r = (1 - b.k) ** 2;
      p.offsetX = -5 * r;
      break;
    }
    case 'getup': {
      const s = Math.max(0, 1 - b.since / 0.12);
      p.scaleY = 1 - 0.05 * s;
      break;
    }
    case 'charge':
      p.offsetX = Math.sin(b.since * 80) * 0.8 * b.k;
      p.rim = 0.3 + 0.7 * b.k;
      p.rimColor = 'gold';
      break;
    case 'hold':
      p.rim = 0.8 * (1 - b.k);
      p.rimColor = 'gold';
      break;
    case 'gather':
      p.rim = b.k;
      p.rimColor = 'cyan';
      break;
    case 'release':
      p.rim = 1 - b.k;
      p.rimColor = 'cyan';
      break;
    case 'raise':
    case 'consume':
      p.rim = b.beat === 'consume' ? Math.sin(Math.PI * b.k) : 0;
      p.rimColor = 'green';
      break;
    case 'run':
      // Damp the drawn bob: the airborne poses are drawn a little lower (planted poses stay on the floor; the shadow never moves).
      p.offsetY = runBobOffset(b.index) * unit;
      // The art already leans into the run: only a touch more while speeding up, a touch back while slowing.
      if (m) p.lean = Math.max(-0.025, Math.min(0.025, (m.ax * m.facing) / 90000));
      break;
    case 'brake':
      if (m) p.lean = Math.max(-0.03, Math.min(0, (m.ax * m.facing) / 90000));
      break;
    case 'idle':
      if (m) {
        // A damped rock back as the stance settles after a run.
        const since = now - m.stopAt;
        if (m.stopAt >= 0 && since < 0.35) p.lean = -0.035 * Math.exp(-since * 9) * Math.cos(since * 24);
      }
      break;
    default:
      break;
  }
  if (m) {
    const landed = now - m.landAt;
    if (m.landAt >= 0 && landed < 0.12) {
      const s = 1 - landed / 0.12;
      p.scaleY *= 1 - 0.07 * s;
      p.scaleX *= 1 + 0.04 * s;
    }
    if (m.turnAt >= 0) {
      // Turn-around: squeeze through edge-on instead of mirroring in one frame.
      const k = clamp01((now - m.turnAt) / TURN_TIME);
      p.scaleX *= Math.max(0.3, Math.abs(Math.cos(Math.PI * k)));
      p.scaleY *= 1 - 0.035 * Math.sin(Math.PI * k);
      p.facing = k < 0.5 ? m.turnFrom : m.facing;
    } else p.facing = m.facing;
  }
  // Post-hit i-frames flicker (dodge and skill have their own look).
  if (e.invuln > 0 && e.state !== 'dodge' && e.state !== 'skill' && e.hp > 0) p.alpha *= Math.floor(clock * 18) % 2 ? 0.55 : 1;
  return p;
}

// ---- Monsters ----

/** Locomotion character per art: fog drifts and wavers, the imp skitters, the butcher stomps. */
function locomotion(p, e, clock, motion, still = false) {
  const id = e.id ?? 0;
  const moving = !still && Math.hypot(e.vx ?? 0, e.vz ?? 0) > 1;
  const stride = e.stride ?? 0;
  if (motion === 'drift') {
    p.offsetY = 3 + 2.5 * Math.sin(clock * 1.7 + id);
    p.lean = (moving ? 0.1 : 0) + 0.035 * Math.sin(clock * 1.1 + id * 0.7);
    p.scaleX = 1 + 0.022 * Math.sin(clock * 2.2 + id);
    p.scaleY = 1 - 0.012 * Math.sin(clock * 2.2 + id) + (moving ? -0.01 : 0);
  } else if (motion === 'skitter') {
    if (moving) {
      const hop = Math.abs(Math.sin(stride / 13));
      p.offsetY = 5 * hop;
      p.lean = 0.15 + 0.04 * Math.sin(stride / 6.5);
      p.scaleY = 1 - 0.05 * (1 - hop);
      p.scaleX = 1 + 0.03 * (1 - hop);
    } else {
      p.offsetY = 2 * Math.abs(Math.sin(clock * 6 + id));
      p.lean = 0.05 + 0.03 * Math.sin(clock * 4 + id);
      p.scaleY = 1 + 0.02 * Math.sin(clock * 12 + id);
    }
  } else if (motion === 'stomp') {
    if (moving) {
      const phase = stride / 24;
      const lift = Math.abs(Math.sin(phase));
      p.offsetY = 2.5 * lift;
      p.scaleY = 1 - 0.035 * (1 - lift) ** 4;
      p.scaleX = 1 + 0.02 * (1 - lift) ** 4;
      p.lean = 0.05 + 0.03 * Math.sin(phase);
    } else {
      const breath = Math.sin(clock * 1.6 + id);
      p.scaleY = 1 + 0.016 * breath;
      p.scaleX = 1 - 0.008 * breath;
      p.lean = 0.012 * Math.sin(clock * 0.9 + id);
    }
  } else if (moving) {
    const phase = stride / 18;
    p.offsetY = Math.abs(Math.sin(phase)) * 3;
    p.lean = 0.06 + 0.04 * Math.sin(phase);
  } else {
    const breath = Math.sin(clock * 3 + id);
    p.scaleY = 1 + 0.02 * breath;
    p.lean = 0.02 * breath;
  }
}

function monsterPose(e, clock, def) {
  const p = basePose();
  const A = ENEMY_ARCHETYPES[e.archetype] ?? {};
  const atk = A.attack ?? {};
  const t = e.stateTime ?? 0;
  const motion = def.motion;
  const heavy = e.telegraph?.danger === 'heavy';
  const hm = heavy ? 1.4 : 1;
  const lunge = (def.lunge ?? 20) * (heavy ? 1.25 : 1);
  switch (e.state) {
    case 'windup':
    case 'aim':
    case 'charge': {
      // Rear back and swell; the red rim rises with the telegraph; a tremble just before the strike.
      locomotion(p, e, clock, motion, true);
      const k = clamp01(e.telegraph?.progress ?? t / (e.move?.windup ?? e.telegraph?.duration ?? atk.windup ?? 0.55));
      const c = ease(k);
      p.lean += -0.17 * c * hm;
      p.scaleY *= 1 + 0.06 * k * hm;
      p.scaleX *= 1 + 0.03 * k * hm;
      p.offsetX = -5 * k * hm;
      if (motion === 'drift') p.offsetY += 6 * c;
      if (k > 0.65) p.offsetX += Math.sin(clock * 72) * 2.2 * ((k - 0.65) / 0.35) * hm;
      p.red = 0.04 + 0.12 * k;
      p.rim = Math.min(1, (0.25 + 0.75 * k) * (heavy ? 1.25 : 1));
      break;
    }
    case 'strike':
    case 'attack':
    case 'fire': {
      const s = ease(Math.min(1, t / 0.06));
      const shape = e.move?.shape ?? 'ellipse';
      if (shape === 'shot') {
        // Spitting a fire spark: a sharp recoil.
        p.lean = -0.12 * s;
        p.offsetX = -6 * s;
        p.scaleX = 1 - 0.05 * s;
        p.scaleY = 1 + 0.04 * s;
        p.rim = 0.6;
      } else if (shape === 'dash') {
        // The body itself travels; hold a low stretched charge.
        p.lean = 0.3 * s;
        p.scaleX = 1 + 0.14 * s;
        p.scaleY = 1 - 0.08 * s;
        p.rim = 0.7;
      } else {
        p.lean = 0.28 * s;
        p.offsetX = lunge * s;
        p.scaleX = 1 + 0.12 * s;
        p.scaleY = 1 - 0.07 * s;
        p.rim = 0.7;
      }
      p.red = 0.2;
      break;
    }
    case 'backstep': {
      const k = clamp01(t / (A.backstep?.time ?? 0.35));
      p.offsetY = 10 * Math.sin(k * Math.PI);
      p.lean = -0.14 * Math.sin(k * Math.PI);
      p.scaleY = 1 - 0.06 * (1 - Math.sin(k * Math.PI));
      break;
    }
    case 'recover': {
      const r = clamp01(t / (e.move?.recovery ?? atk.recovery ?? 0.6));
      const q = 1 - ease(Math.min(1, r * 1.6));
      const shape = e.move?.shape ?? 'ellipse';
      locomotion(p, e, clock, motion, true);
      p.lean += (shape === 'shot' ? -0.08 : 0.28) * q;
      p.offsetX = shape === 'ellipse' ? lunge * q : 0;
      p.scaleX *= 1 + 0.08 * q;
      p.scaleY *= 1 - 0.05 * q;
      p.rim = 0.4 * q;
      break;
    }
    case 'hurt': {
      const flinch = A.flinchTime ?? 0.36;
      const snap = Math.min(1, t / 0.04);
      const rec = ease(clamp01((t - 0.05) / Math.max(0.05, flinch - 0.05)));
      const amount = snap * (1 - rec);
      p.lean = -0.24 * amount;
      p.offsetX = -7 * amount;
      p.scaleX = 1 - 0.07 * amount;
      p.scaleY = 1 + 0.03 * amount;
      break;
    }
    case 'down': {
      // Knocked off the feet: tips back while the sim's y carries the arc, then lies until getting up.
      const airborne = (e.y ?? 0) > 0;
      const k = ease(Math.min(1, t / 0.34));
      p.lean = -(airborne ? 0.4 + 1.0 * k : 1.42 * k);
      p.offsetX = -6 * k;
      p.scaleY = 1 - 0.05 * k;
      break;
    }
    case 'getup':
      fallPose(p, (A.downTime ?? 0.65) + t, { fallTime: 0.01, riseAt: A.downTime ?? 0.65, riseTime: A.getupTime ?? 0.35 });
      break;
    case 'dead': {
      // Recoil, then dissolve from the head down into ink and embers (the renderer emits the particles).
      const corpse = A.corpseTime ?? 1.0;
      const airborne = Math.min(1, (e.y ?? 0) / 50);
      p.lean = -0.32 * ease(Math.min(1, t / 0.12)) - 0.6 * airborne;
      p.offsetX = -5 * ease(Math.min(1, t / 0.12));
      const d = clamp01((t - 0.1) / Math.max(0.2, corpse - 0.22));
      p.dissolve = d;
      p.dark = 0.6 * d;
      p.scaleX = 1 - 0.06 * d;
      p.alpha = 1 - clamp01((d - 0.8) / 0.2);
      break;
    }
    case 'intro':
    case 'spawn': {
      const k = ease(clamp01(t / 0.45));
      locomotion(p, e, clock, motion);
      p.alpha = k;
      p.scaleY *= 0.9 + 0.1 * k;
      break;
    }
    default:
      locomotion(p, e, clock, motion);
      break;
  }
  if (e.staggered && e.hp > 0) {
    // 破绽: slumped forward, swaying, with a pulsing gold rim.
    p.lean = 0.2 + 0.04 * Math.sin(clock * 2.4);
    p.scaleY = 0.9;
    p.scaleX = 1.04;
    p.offsetX = 0;
    p.offsetY = 0;
    p.red = 0;
    p.rim = 0.5 + 0.25 * Math.sin(clock * 7);
    p.rimColor = 'gold';
  } else if ((e.enraged || e.enrage === true) && e.hp > 0 && p.rim < 0.45) {
    p.rim = 0.45 + 0.2 * Math.sin(clock * 5);
    p.rimColor = 'red';
    p.red = Math.max(p.red, 0.08);
  }
  return p;
}

/**
 * Rim light as a pure outer glow: the silhouette is drawn far off-canvas and only its blurred shadow lands on the
 * sprite's spot (shadow offsets are in device pixels, so the local shift is the inverse of the current transform).
 * Unlike an additive silhouette, this does not flood semi-transparent art (the fog demon's trailing mist) with colour.
 */
const SHADOW_SHIFT = 4096;
function drawRim(ctx, silhouette, [sx, sy, sw, sh], [dx, dy, dw, dh], color, alpha, strength) {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-9) return;
  ctx.save();
  ctx.translate((-SHADOW_SHIFT * m.d) / det, (SHADOW_SHIFT * m.b) / det);
  ctx.shadowOffsetX = SHADOW_SHIFT;
  ctx.shadowOffsetY = 0;
  ctx.shadowColor = color;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = (8 + 12 * Math.min(1, strength)) * devicePixels;
  ctx.drawImage(silhouette, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.globalAlpha = alpha * 0.8;
  ctx.shadowBlur = 3 * devicePixels;
  ctx.drawImage(silhouette, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/**
 * Draw an entity (or an afterimage snapshot) with its foot at screen (sx, sy) and size factor `scale`.
 * opts: { pose, tint: 'ghost', alpha, shade (0..1 depth darkening) }. Returns false for unknown sprite keys.
 */
export function drawSprite(ctx, bank, entity, sx, sy, scale, clock, opts = {}) {
  const def = SPRITES[entity.sprite];
  if (!def) return false;
  const pose = opts.pose ?? poseOf(entity, clock);
  const image = bank.images[def.image];
  const tints = bank.tints[entity.sprite];
  const ts = bank.tintScale?.[entity.sprite] ?? TINT_SCALE;
  const k = ((entity.height ?? def.sourceHeight * 0.17) * scale) / def.sourceHeight;
  const frames = def.frames ? heroAtlas().frames : null;
  const facing = (pose.facing ?? entity.facing) >= 0 ? 1 : -1;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(facing, 1);
  ctx.translate(pose.offsetX * scale, -pose.offsetY * scale);
  ctx.rotate(pose.lean);
  ctx.scale(pose.scaleX, pose.scaleY);
  // Local +x is now "forward". Art drawn facing left is mirrored to face forward.
  if (def.artFacing < 0) ctx.scale(-1, 1);
  const alpha = (opts.alpha ?? 1) * pose.alpha;
  if (alpha <= 0.01) { ctx.restore(); return true; }

  /** Geometry of one frame (or the still art): source rect and destination box around the foot. */
  const geom = name => {
    const f = frames ? frames[name] ?? frames[heroAtlas().clips.idle[0]] : null;
    const [rx, ry, rw, rh] = f ? f.rect : def.rect;
    const [fx, fy] = f ? f.foot : def.foot;
    return { f, rx, ry, rw, rh, dx: -(fx - rx) * k, dy: -(fy - ry) * k, dw: rw * k, dh: rh * k };
  };
  /** Draw `source` (the image, or a tint canvas scaled by `sScale`) for frame geometry `g`. */
  const blit = (g, source, sScale, a) => {
    if (a <= 0.005) return;
    ctx.globalAlpha = a;
    if (g.f && (g.f.rot || g.f.scale)) {
      ctx.save();
      if (g.f.rot) ctx.rotate(g.f.rot);
      if (g.f.scale) ctx.scale(g.f.scale[0], g.f.scale[1]);
      ctx.drawImage(source, g.rx * sScale, g.ry * sScale, g.rw * sScale, g.rh * sScale, g.dx, g.dy, g.dw, g.dh);
      ctx.restore();
    } else ctx.drawImage(source, g.rx * sScale, g.ry * sScale, g.rw * sScale, g.rh * sScale, g.dx, g.dy, g.dw, g.dh);
  };
  const g = geom(pose.frame);

  if (opts.tint === 'ghost') {
    blit(g, tints.ghost, ts, alpha);
    ctx.restore();
    return true;
  }

  if (pose.dissolve > 0) {
    // Ragged cut line sweeping from the head down; everything above it is gone.
    const cut = g.dy + g.dh * 0.04 + (g.dh * 1.02) * pose.dissolve;
    const seed = (entity.id ?? 0) * 1.7;
    ctx.beginPath();
    ctx.moveTo(g.dx - 4, g.dy + g.dh + 8);
    for (let i = 0; i <= 10; i++) {
      const x = g.dx - 4 + ((g.dw + 8) * i) / 10;
      const n = Math.sin(i * 2.3 + seed) * 0.6 + Math.sin(i * 5.1 + seed * 2) * 0.4;
      ctx.lineTo(x, cut + n * g.dh * 0.05);
    }
    ctx.lineTo(g.dx + g.dw + 4, g.dy + g.dh + 8);
    ctx.closePath();
    ctx.clip();
  }

  if (pose.rim > 0.01) {
    if (g.f && (g.f.rot || g.f.scale)) {
      ctx.save();
      if (g.f.rot) ctx.rotate(g.f.rot);
      if (g.f.scale) ctx.scale(g.f.scale[0], g.f.scale[1]);
    }
    drawRim(ctx, tints.white, [g.rx * ts, g.ry * ts, g.rw * ts, g.rh * ts], [g.dx, g.dy, g.dw, g.dh], RIM[pose.rimColor] ?? RIM.red, alpha * Math.min(1, pose.rim), pose.rim);
    if (g.f && (g.f.rot || g.f.scale)) ctx.restore();
  }

  // The previous frame lingers behind the new one for a moment: a smear on fast moves, a fade when settling.
  if (pose.prevFrame && pose.prevAlpha > 0.01) blit(geom(pose.prevFrame), image, 1, alpha * pose.prevAlpha);

  if (pose.smear > 0.02) {
    // Dodge blur: fading copies trailing behind along the body's own axis.
    for (const [back, a] of [[18, 0.1], [10, 0.16], [5, 0.24]]) {
      blit({ ...g, dx: g.dx - back * scale }, image, 1, alpha * a * pose.smear);
    }
  }

  blit(g, image, 1, alpha);
  // Idle breathing: cross-fade into the next frame.
  if (pose.nextFrame && pose.blend > 0.01) blit(geom(pose.nextFrame), image, 1, alpha * pose.blend);
  const shade = Math.min(0.85, (opts.shade ?? 0) + pose.dark);
  if (shade > 0.01) blit(g, tints.dark, ts, alpha * shade);
  if (pose.red > 0 && tints.red) {
    ctx.globalCompositeOperation = 'lighter';
    blit(g, tints.red, ts, alpha * pose.red);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (pose.flash > 0) blit(g, tints.white, ts, alpha * Math.min(0.92, pose.flash));
  ctx.restore();
  return true;
}
