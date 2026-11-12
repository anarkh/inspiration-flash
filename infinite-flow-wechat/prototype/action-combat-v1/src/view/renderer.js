// Canvas renderer. One projection, project(x, z, y) -> screen, is used for sprites, shadows, telegraphs, HP bars,
// VFX and the debug overlay. Entities are drawn generically from their fields:
//   sprite (key known to sprites.js; otherwise a glow orb sized by `radius` with a trail, e.g. projectiles),
//   x / z / y, facing, height, telegraph {shape:'ellipse', cx, cz, rx, rz, progress, danger?} or
//   {shape:'rect', x0, x1, z0, z1, progress, danger?}, afterimage (leave ghosts), showHpBar + hp / maxHp,
//   poise / maxPoise, staggered, hurt (footprint), activeHit {shape} (debug).
// New entity kinds therefore need no renderer change.
//
// Frame order: scenery (wall, light shafts, floor, seam fog, back embers) -> ground VFX -> telegraphs -> shadows ->
// bodies -> overlays (stagger marks, HP bars) -> foreground fog -> scene grade -> VFX -> front embers -> HUD fades
// and vignette -> full-screen VFX. Shake and the impact punch-in transform the world layer only.
import { hurtboxOf } from '../sim/combat.js?v=6';
import { createSpriteMotion, drawSprite, hasSprite, poseOf, settleFrame, spriteInfo, setSpritePixelRatio, updateSpriteMotion } from './sprites.js?v=6';

export const LOGICAL_W = 390;
/** Backing-store pixels per logical px are capped here: sharper than this costs fill rate for no visible gain. */
const MAX_PIXEL_RATIO = 2;
const GHOST_LIFE = 0.22;
const TRAIL_POINTS = 10;
const EMBER_COUNT = 26;
/** The hero never gets closer than this to either side of the view. */
const HERO_MARGIN = 80;
const STATE_LABELS = {
  idle: '待机', run: '移动', attack1: '一段', attack2: '二段', attack3: '三段', dodge: '闪避', hurt: '受击', down: '倒地',
  dead: '阵亡', chase: '追击', windup: '蓄力', strike: '出手', recover: '收招', getup: '起身', skill: '战技', spell: '法术',
  item: '道具', aim: '瞄准', fire: '射击',
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const fract = v => v - Math.floor(v);

/** Screen bands for a logical height H (width is always 390): HUD on top, wall, floor band, controls at the bottom. */
export function computeLayout(H, stage) {
  const hudH = 64;
  const controlsH = Math.min(210, Math.max(150, Math.round(H * 0.235)));
  const bandBottom = H - controlsH - 6;
  const bandTop = bandBottom - stage.depth;
  return { W: LOGICAL_W, H, hudH, controlsH, bandTop, bandBottom, floorTop: bandTop - 34 };
}

export function createRenderer(canvas, { bank, stage }) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, snap: true, look: 0, frame: 0, lock: 0, arena: null };
  const trails = new Map();
  /** Per frame-sprite view memory (sprites.createSpriteMotion) and this frame's poses, by entity id. */
  const motions = new Map();
  const poses = new Map();
  const hpShown = new Map();
  /** Per-entity view memory: last height (landing dust), projectile trail ring buffer. */
  const tracked = new Map();
  const sorted = [];
  const view = { camX: 0, bandTop: 0, W: LOGICAL_W, H: 844 };
  const embers = Array.from({ length: EMBER_COUNT }, (_, i) => ({
    x: fract(Math.sin(i * 12.9898) * 43758.5453),
    speed: 10 + 18 * fract(Math.sin(i * 78.233) * 12345.678),
    phase: fract(Math.sin(i * 39.425) * 24634.6345),
    size: 1.2 + 2.2 * fract(Math.sin(i * 93.989) * 5381.13),
    front: i % 5 === 0,
  }));
  let layout = computeLayout(844, stage);
  let pixelRatio = 1;
  let scenery = null;
  /** Pose clock: stops during hit-stop so bodies freeze. */
  let clock = 0;
  /** View clock: always runs (fog, embers, hit-stop jitter). */
  let realClock = 0;

  function resize(cssScale, logicalH, dpr) {
    layout = computeLayout(logicalH, stage);
    pixelRatio = Math.min(MAX_PIXEL_RATIO, cssScale * dpr);
    setSpritePixelRatio(pixelRatio);
    canvas.width = Math.round(LOGICAL_W * pixelRatio);
    canvas.height = Math.round(logicalH * pixelRatio);
    canvas.style.width = `${LOGICAL_W}px`;
    canvas.style.height = `${logicalH}px`;
    scenery = buildScenery(bank, stage.art, layout, pixelRatio);
    view.H = logicalH;
    view.bandTop = layout.bandTop;
    return layout;
  }

  function project(x, z, y = 0) {
    return { x: x - camera.x, y: layout.bandTop + z - y };
  }

  /** Sprites a little smaller at the far edge of the band, a little larger at the near edge. */
  function depthScale(z) {
    return 1 + 0.08 * (z / stage.depth - 0.5);
  }

  /**
   * Follow the hero with a smoothed look-ahead (facing plus running speed). Inside `world.arena` the view eases into
   * the arena bounds; `world.advance` (or the arena going away) eases the clamp back out. Never leaves the stage.
   */
  function updateCamera(world, dt) {
    const hero = world.hero;
    const W = LOGICAL_W;
    const lookTarget = (hero.facing >= 0 ? 1 : -1) * 30 + clamp(hero.vx ?? 0, -240, 240) * 0.1;
    if (world.arena) camera.arena = world.arena;
    const locked = Boolean(world.arena) && !world.advance;
    if (camera.snap) {
      camera.look = lookTarget;
      camera.lock = locked ? 1 : 0;
    } else {
      camera.look += (lookTarget - camera.look) * (1 - Math.exp(-dt * 2.5));
      camera.lock += ((locked ? 1 : 0) - camera.lock) * (1 - Math.exp(-dt * 3.5));
    }
    // Frame the fight: lean toward the living enemies near the hero (ranged ones keep their distance), while the
    // hero always stays at least HERO_MARGIN px inside the view.
    let sum = 0;
    let count = 0;
    for (const e of world.entities) {
      if (e.team !== 'enemy' || e.kind === 'projectile' || !(e.hp > 0) || Math.abs(e.x - hero.x) > 340) continue;
      sum += e.x;
      count += 1;
    }
    const frameTarget = count ? clamp((sum / count - hero.x) * 0.45, -100, 100) : 0;
    if (camera.snap) camera.frame = frameTarget;
    else camera.frame += (frameTarget - camera.frame) * (1 - Math.exp(-dt * 1.6));
    const lookShare = 1 - Math.min(1, Math.abs(camera.frame) / 70) * 0.6;
    let target = hero.x - W / 2 + camera.look * lookShare + camera.frame;
    target = clamp(target, hero.x - (W - HERO_MARGIN), hero.x - HERO_MARGIN);
    const arena = camera.arena;
    if (arena && camera.lock > 0.001) {
      const lo = arena.left;
      const hi = arena.right - W;
      const inside = hi < lo ? (arena.left + arena.right - W) / 2 : clamp(target, lo, hi);
      target += (inside - target) * camera.lock;
    }
    target = clamp(target, 0, Math.max(0, stage.width - W));
    if (camera.snap) { camera.x = target; camera.snap = false; }
    else camera.x += (target - camera.x) * (1 - Math.exp(-dt * 6));
  }

  /**
   * This frame's pose for every sprite entity, computed once (trails, shadows and bodies share it). Frame sprites
   * (the hero) also advance their view-side motion memory: turn-around, acceleration lean, stop / landing beats.
   */
  function updatePoses(world, dt, frozen) {
    poses.clear();
    for (const e of world.entities) {
      if (!hasSprite(e.sprite)) continue;
      let motion = null;
      if (spriteInfo(e.sprite).frames) {
        motion = motions.get(e.id);
        if (!motion) { motion = createSpriteMotion(e); motions.set(e.id, motion); }
        updateSpriteMotion(motion, e, frozen ? 0 : dt, realClock);
      }
      const pose = poseOf(e, clock, motion);
      if (motion) settleFrame(motion, pose);
      poses.set(e.id, pose);
    }
    for (const id of motions.keys()) if (!poses.has(id)) motions.delete(id);
  }

  function updateTrails(world, dt) {
    for (const e of world.entities) {
      if (!hasSprite(e.sprite)) continue;
      let list = trails.get(e.id);
      if (e.afterimage && dt > 0) {
        if (!list) { list = []; trails.set(e.id, list); }
        const last = list.at(-1);
        // Frame sprites leave sparser, fainter ghosts: their poses already read as motion.
        const spacing = spriteInfo(e.sprite).frames ? 0.045 : 0.03;
        if (!last || clock - last.born >= spacing) {
          // Afterimages keep the actual frame (no smear / cross-fade on a ghost).
          const pose = { ...poses.get(e.id), prevFrame: null, nextFrame: null, rim: 0, flash: 0 };
          list.push({ born: clock, x: e.x, z: e.z, y: e.y, entity: { id: e.id, sprite: e.sprite, facing: e.facing, height: e.height }, pose });
        }
      }
      if (list) {
        while (list.length && clock - list[0].born >= GHOST_LIFE) list.shift();
        if (!list.length) trails.delete(e.id);
      }
    }
  }

  /** Landing dust, projectile trails and projectile impact bursts. Bodies only move when the sim is not frozen. */
  function updateTracked(world, vfx, moving, moveDt) {
    const seen = realClock;
    for (const e of world.entities) {
      let t = tracked.get(e.id);
      if (!t) {
        t = { y: e.y ?? 0, seen, trail: null, count: 0, head: 0, x: e.x, z: e.z, color: e.color, radius: e.radius, projectile: !hasSprite(e.sprite), flash: 0, flashAt: -1 };
        tracked.set(e.id, t);
      }
      t.seen = seen;
      // A new hit raised the sim's flash timer: restart the view-time flash envelope.
      const flash = e.flash ?? 0;
      if (flash > t.flash + 1e-6) t.flashAt = realClock;
      t.flash = flash;
      if (moving) {
        const y = e.y ?? 0;
        if (t.y > 8 && y <= 0 && hasSprite(e.sprite)) vfx.landDust?.(e.x, e.z, t.y > 30);
        t.y = y;
        if (t.projectile) {
          vfx.projectileTrail?.(e.x, e.z, y + (e.height ?? (e.radius ?? 8) * 2) / 2, e.color ?? '#ff8a3a', moveDt, e.radius ?? 8);
          if (!t.trail) t.trail = new Float32Array(TRAIL_POINTS * 3);
          const i = t.head * 3;
          t.trail[i] = e.x;
          t.trail[i + 1] = e.z;
          t.trail[i + 2] = y + (e.height ?? (e.radius ?? 8) * 2) / 2;
          t.head = (t.head + 1) % TRAIL_POINTS;
          t.count = Math.min(TRAIL_POINTS, t.count + 1);
        }
      }
      t.x = e.x;
      t.z = e.z;
      t.color = e.color ?? t.color;
      t.radius = e.radius ?? t.radius;
    }
    for (const [id, t] of tracked) {
      if (t.seen === seen) continue;
      if (t.projectile && t.count > 0) {
        const last = ((t.head - 1 + TRAIL_POINTS) % TRAIL_POINTS) * 3;
        vfx.projectileGone?.(t.trail[last], t.trail[last + 1], t.trail[last + 2], t.color, t.radius ?? 8);
      }
      tracked.delete(id);
    }
  }

  // ---- Scenery ----

  function drawScenery() {
    const { wall, floor, fog } = scenery;
    const { W, floorTop } = layout;
    ctx.fillStyle = '#06080a';
    ctx.fillRect(-20, -20, W + 40, layout.H + 40);
    tileAcross(wall, camera.x * wall.parallax, wall.top, -20, W + 20);
    // Two faint light shafts falling from the upper wall, swaying slowly.
    if (scenery.beam) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const span = W + 260;
        const x = ((((i * 0.55 + 0.2) * span - camera.x * 0.35) % span) + span) % span - 130;
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(realClock * 0.5 + i * 2.1);
        ctx.drawImage(scenery.beam, x - 70, layout.hudH - 30, 140, floorTop - layout.hudH + 60);
      }
      ctx.restore();
    }
    if (floor) tileAcross(floor, camera.x, floor.top, -20, W + 20);
    // Seam: haze straddling the wall base, then the wall's contact shadow on the floor.
    ctx.save();
    ctx.globalAlpha = scenery.painted ? 0.35 : 0.75;
    tileAcross(fog, camera.x * 0.85 + realClock * 7, floorTop - fog.height * 0.62, -20, W + 20);
    ctx.globalAlpha = scenery.painted ? 0.2 : 0.4;
    tileAcross(fog, camera.x * 0.95 - realClock * 4 + 190, floorTop - fog.height * 0.4, -20, W + 20);
    ctx.restore();
    if (!scenery.painted) {
      ctx.fillStyle = scenery.contact;
      ctx.fillRect(-20, floorTop - 6, W + 40, 40);
    }
    drawEmbers(false);
  }

  /** Embers drifting up out of the floor; a few larger, faster "front" ones are drawn over the bodies. */
  function drawEmbers(front) {
    const { W, hudH, floorTop, bandBottom } = layout;
    const bottom = front ? bandBottom + 20 : floorTop + 70;
    const top = hudH + 10;
    const range = bottom - top;
    const par = front ? 1.25 : 0.6;
    const span = W + 80;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < embers.length; i++) {
      const m = embers[i];
      if (m.front !== front) continue;
      const speed = m.speed * (front ? 1.8 : 1);
      const phase = fract(realClock * speed / range + m.phase);
      const y = bottom - phase * range;
      const x = ((((m.x * span - camera.x * par + Math.sin(realClock * 0.7 + i) * 16) % span) + span) % span) - 40;
      const size = m.size * (front ? 2.2 : 1) * 3;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * (0.35 + 0.3 * Math.sin(realClock * 5 + i * 1.7)) * (front ? 0.5 : 0.8);
      ctx.drawImage(scenery.ember, x - size, y - size, size * 2, size * 2);
    }
    ctx.restore();
  }

  function drawForegroundFog() {
    const { W, bandBottom } = layout;
    const fog = scenery.fog;
    ctx.save();
    ctx.globalAlpha = scenery.painted ? 0.22 : 0.3;
    tileAcross(fog, camera.x * 1.15 + realClock * 10 + 90, bandBottom - fog.height * 0.25, -20, W + 20);
    ctx.restore();
  }

  function tileAcross(tile, offset, top, from, to) {
    let x = from - (((offset + from) % tile.period) + tile.period) % tile.period;
    for (; x < to; x += tile.period) ctx.drawImage(tile.canvas, x, top, tile.period, tile.height);
  }

  // ---- Telegraphs ----

  /**
   * Normal: a red fill growing with progress inside a pulsing outline, strobing just before the strike.
   * Heavy (the perfect-dodge moment): crimson-magenta with hazard stripes, a double gold-edged outline that pulses
   * harder, and rings rising off the ground like a column, turning white-hot at the end.
   */
  function drawTelegraph(e) {
    const t = e.telegraph;
    const heavy = t.danger === 'heavy';
    const progress = clamp(t.progress ?? 0, 0, 1);
    const striking = e.state === 'strike';
    const late = clamp((progress - 0.78) / 0.22, 0, 1);
    const strobe = late > 0 ? 0.5 + 0.5 * Math.sin(realClock * (40 + 50 * late)) : 0;
    const rect = t.shape === 'rect' || Number.isFinite(t.x0);
    let cx;
    let cy;
    let rx;
    let rz;
    if (rect) {
      const x0 = Math.min(t.x0, t.x1);
      const x1 = Math.max(t.x0, t.x1);
      cx = (x0 + x1) / 2 - camera.x;
      cy = layout.bandTop + ((t.z0 ?? 0) + (t.z1 ?? 0)) / 2;
      rx = (x1 - x0) / 2;
      rz = Math.abs((t.z1 ?? 0) - (t.z0 ?? 0)) / 2;
    } else {
      cx = t.cx - camera.x;
      cy = layout.bandTop + t.cz;
      rx = t.rx;
      rz = t.rz;
    }
    const pulse = 1 + (heavy ? 0.06 : 0.025) * Math.sin(realClock * (heavy ? 14 : 10));
    const dir = e.x <= cx + camera.x ? 1 : -1;
    const path = (scale, grow = null) => {
      ctx.beginPath();
      if (rect) {
        // Lanes: rounded ends; the fill grows from the attacker's side along the lane.
        const w = grow === null ? rx * 2 * scale : rx * 2 * grow;
        const hh = rz * 2 * (grow === null ? scale : 1);
        const x = grow === null ? cx - w / 2 : dir > 0 ? cx - rx : cx + rx - w;
        roundRect(x, cy - hh / 2, w, hh, Math.min(hh / 2, w / 2, 10));
      } else {
        const s = grow === null ? scale : grow;
        ctx.ellipse(cx, cy, Math.max(0.5, rx * s), Math.max(0.5, rz * s), 0, 0, Math.PI * 2);
      }
    };
    ctx.save();
    const base = heavy ? '255, 30, 80' : '255, 50, 30';
    // Base fill and the growing core.
    ctx.fillStyle = striking ? `rgba(255, ${heavy ? 200 : 140}, 120, 0.5)` : `rgba(${base}, ${0.1 + 0.08 * progress})`;
    path(1);
    ctx.fill();
    if (!striking) {
      ctx.fillStyle = `rgba(${base}, ${0.22 + 0.18 * progress + 0.3 * strobe})`;
      path(1, progress);
      ctx.fill();
      if (rect) {
        // Chevrons scrolling in the direction of the dash / shot.
        ctx.save();
        path(1);
        ctx.clip();
        ctx.strokeStyle = `rgba(255, ${170 + 60 * strobe}, 150, ${0.25 + 0.45 * progress})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const gap = 18;
        const arm = Math.min(rz * 0.7, 9);
        const shift = (realClock * 70) % gap;
        ctx.beginPath();
        for (let x = -rx - gap; x <= rx + gap; x += gap) {
          const px = cx + (x + shift) * dir;
          ctx.moveTo(px - arm * 0.6 * dir, cy - arm);
          ctx.lineTo(px + arm * 0.4 * dir, cy);
          ctx.lineTo(px - arm * 0.6 * dir, cy + arm);
        }
        ctx.stroke();
        ctx.restore();
      }
      if (heavy) {
        ctx.save();
        path(1);
        ctx.clip();
        ctx.globalAlpha = 0.35 + 0.35 * progress;
        ctx.fillStyle = scenery.hazard;
        ctx.translate(realClock * 30 % 16, 0);
        ctx.fillRect(cx - rx - 20, cy - rz - 4, rx * 2 + 40, rz * 2 + 8);
        ctx.restore();
      }
    }
    // Outline(s): a wide faint glow stroke under the bright line (no shadowBlur: it is costly on phones).
    ctx.globalCompositeOperation = 'lighter';
    path(pulse);
    ctx.strokeStyle = heavy ? 'rgba(255, 42, 106, 0.28)' : 'rgba(255, 58, 34, 0.25)';
    ctx.lineWidth = heavy ? 9 : 7;
    ctx.stroke();
    ctx.lineWidth = heavy ? 2.6 : 2;
    ctx.strokeStyle = striking ? '#ffe2d0' : heavy
      ? `rgba(255, ${120 + 120 * strobe}, ${140 + 100 * strobe}, ${0.75 + 0.25 * Math.sin(realClock * 18) ** 2})`
      : `rgba(255, ${90 + 120 * strobe}, ${60 + 120 * strobe}, ${0.6 + 0.4 * Math.sin(realClock * 24) ** 2})`;
    ctx.stroke();
    if (heavy && !striking) {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = `rgba(255, 214, 140, ${0.55 + 0.45 * strobe})`;
      path(pulse * 1.12);
      ctx.stroke();
      // Rings rising off the ground: a column of warning.
      for (let i = 0; i < 3; i++) {
        const r = fract(realClock * 1.8 + i / 3);
        ctx.globalAlpha = (1 - r) * (0.35 + 0.5 * progress);
        ctx.lineWidth = 2 * (1 - r) + 0.5;
        ctx.strokeStyle = late > 0 ? '#fff0e0' : '#ff4a7a';
        ctx.save();
        ctx.translate(0, -r * (26 + 30 * progress));
        path(1 - 0.12 * r);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.rect(x, y, w, h);
  }

  // ---- Bodies ----

  function drawShadow(e) {
    const p = project(e.x, e.z, 0);
    const lift = Math.min(0.6, (e.y ?? 0) / 160);
    let rx;
    if (e.hurt) rx = (e.hurt.halfW + 14) * depthScale(e.z) * (1 - lift);
    else if (e.kind === 'projectile' || !hasSprite(e.sprite)) rx = (e.radius ?? 8) * 1.3 * (1 - lift);
    else return;
    if (e.state === 'dead') rx *= 1 - (poses.get(e.id)?.dissolve ?? 0) * 0.8;
    // A pose drawn off the ground (the finisher's leap) shrinks its shadow.
    rx *= poses.get(e.id)?.shadow ?? 1;
    ctx.globalAlpha = 0.85 * (1 - lift);
    ctx.drawImage(scenery.shadow, p.x - rx * 1.25, p.y - rx * 0.42, rx * 2.5, rx * 0.84);
    ctx.globalAlpha = 1;
  }

  function drawEntity(e, vfx, frozen, dt) {
    const s = depthScale(e.z);
    const ghosts = trails.get(e.id);
    if (ghosts) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const ghost of ghosts) {
        const g = project(ghost.x, ghost.z, ghost.y);
        const fade = 1 - (clock - ghost.born) / GHOST_LIFE;
        const strength = spriteInfo(ghost.entity.sprite).frames ? 0.2 : 0.3;
        drawSprite(ctx, bank, ghost.entity, g.x, g.y, depthScale(ghost.z), clock, { pose: ghost.pose, tint: 'ghost', alpha: strength * fade * fade });
      }
      ctx.restore();
    }
    const p = project(e.x, e.z, e.y ?? 0);
    if (!hasSprite(e.sprite)) {
      drawOrb(e);
      return;
    }
    const info = spriteInfo(e.sprite);
    const pose = poses.get(e.id) ?? poseOf(e, clock);
    pose.flash = flashEnvelope(e);
    // Struck bodies tremble while the sim is frozen in hit-stop; the striker holds its pose with a faint shiver.
    let jitter = 0;
    if (frozen && e.flash > 0) jitter = Math.sin(realClock * 110 + e.id) * 2.2;
    else if (frozen && e.kind === 'hero' && e.phase === 'active') jitter = Math.sin(realClock * 130) * 0.7;
    const shade = 0.22 * (1 - clamp(e.z / stage.depth, 0, 1));
    if (info.motion === 'drift') drawFogWisps(e, p, s, pose, false);
    drawSprite(ctx, bank, e, p.x + jitter, p.y, s, clock, { pose, shade });
    if (info.motion === 'drift') drawFogWisps(e, p, s, pose, true);
    if (info.motion === 'skitter' && e.state !== 'dead') drawImpFlames(e, p, s);
    if (pose.dissolve > 0.01 && pose.dissolve < 0.98 && dt > 0 && !frozen) {
      const h = (e.height ?? 120) * s;
      const cutY = (e.y ?? 0) + h * (1 - pose.dissolve) * Math.max(0.3, Math.cos(pose.lean));
      const halfW = (e.hurt?.halfW ?? 16) * 1.5;
      vfx.emitDissolve?.(e.x - (e.facing >= 0 ? 1 : -1) * Math.sin(-pose.lean) * h * (1 - pose.dissolve) * 0.5, e.z, cutY, halfW, dt, info.dissolve);
    }
  }

  /**
   * Hit flash in view time, so it pops and fades even while the sim is frozen in hit-stop: two frames of near-white,
   * then a quick falloff (a long solid-white silhouette hides the slash and the art).
   */
  function flashEnvelope(e) {
    const t = tracked.get(e.id);
    if (!t || t.flashAt < 0) return 0;
    const k = (realClock - t.flashAt) / 0.13;
    if (k >= 1) return 0;
    return k < 0.15 ? 0.78 : 0.7 * (1 - (k - 0.15) / 0.85) ** 2;
  }

  /** The fog demon trails fog: soft puffs drifting around its base (two behind the art, two in front). */
  function drawFogWisps(e, p, s, pose, front) {
    const alpha = pose.alpha * (1 - (pose.dissolve ?? 0));
    if (alpha <= 0.02) return;
    ctx.save();
    for (let j = front ? 2 : 0; j < (front ? 4 : 2); j++) {
      const ph = realClock * 0.55 + j * 1.9 + e.id * 0.8;
      const ox = Math.sin(ph) * 20 + (j - 1.5) * 12;
      const oy = 6 + 7 * (j % 2) + (Math.sin(ph * 1.3) + 1) * 4;
      const r = (24 + 7 * Math.sin(ph * 0.7)) * s;
      ctx.globalAlpha = (front ? 0.16 : 0.26) * alpha;
      ctx.drawImage(scenery.fogPuff, p.x + ox - r, p.y - oy - r * 0.5, r * 2, r);
    }
    ctx.restore();
  }

  /** Embers lifting off the spark imp's burning head. */
  function drawImpFlames(e, p, s) {
    const h = (e.height ?? 100) * s;
    const f = e.facing >= 0 ? 1 : -1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const ph = fract(realClock * 0.9 + i / 5 + e.id * 0.37);
      const x = p.x + f * (h * 0.14) + Math.sin(i * 2.1 + realClock * 3) * 7 * (1 - ph);
      const y = p.y - h * 0.82 - ph * 26;
      const r = (3.5 + 2 * Math.sin(i + realClock * 9)) * (1 - ph);
      if (r <= 0.3) continue;
      ctx.globalAlpha = (1 - ph) * 0.9;
      ctx.drawImage(scenery.ember, x - r * 3, y - r * 3, r * 6, r * 6);
    }
    ctx.restore();
  }

  /** Unknown sprite key (projectiles): a glow orb stretched along its motion, with a tapering trail. */
  function drawOrb(e) {
    const r = e.radius ?? 8;
    const color = e.color ?? (e.team === 'enemy' ? '#ff6a3a' : '#ffd36a');
    const glow = orbGlow(color);
    const t = tracked.get(e.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (t?.trail && t.count > 1) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      let prev = null;
      for (let n = t.count - 1; n >= 0; n--) {
        const i = ((t.head - 1 - n + TRAIL_POINTS * 2) % TRAIL_POINTS) * 3;
        const sx = t.trail[i] - camera.x;
        const sy = layout.bandTop + t.trail[i + 1] - t.trail[i + 2];
        if (prev) {
          const k = 1 - n / t.count;
          ctx.globalAlpha = 0.65 * k;
          ctx.lineWidth = r * 1.4 * k;
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          prev[0] = sx; prev[1] = sy;
        } else prev = [sx, sy];
      }
    }
    const c = project(e.x, e.z, (e.y ?? 0) + (e.height ?? r * 2) / 2);
    const stretch = 1 + Math.min(0.6, Math.abs(e.vx ?? 0) / 600);
    const flicker = 1 + 0.12 * Math.sin(realClock * 40 + e.id);
    ctx.globalAlpha = 1;
    ctx.translate(c.x, c.y);
    ctx.scale(stretch, 1 / Math.sqrt(stretch));
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glow, -r * 4.2 * flicker, -r * 4.2 * flicker, r * 8.4 * flicker, r * 8.4 * flicker);
    ctx.globalAlpha = 1;
    ctx.drawImage(glow, -r * 2.2 * flicker, -r * 2.2 * flicker, r * 4.4 * flicker, r * 4.4 * flicker);
    ctx.drawImage(orbGlow('#ffffff'), -r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    // A licking flame / spark crown, rotating.
    ctx.rotate(realClock * 9 + e.id);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.3);
      ctx.lineTo(r * 1.7 * flicker, 0);
      ctx.lineTo(0, r * 0.3);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Staggered: orbiting gold motes over the head and a pulsing 破绽 mark. */
  function drawStaggerMarks(e) {
    const s = depthScale(e.z);
    const top = project(e.x, e.z, (e.y ?? 0) + (e.height ?? 150) * s * 0.92);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = realClock * 5 + (i * Math.PI * 2) / 3;
      const x = top.x + Math.cos(a) * 20;
      const y = top.y + Math.sin(a) * 6;
      const r = 9 + 3 * Math.sin(a);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(a);
      ctx.drawImage(orbGlow('#ffc24a'), x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.save();
    const pulse = 1 + 0.06 * Math.sin(realClock * 8);
    ctx.translate(top.x, top.y - 18);
    ctx.scale(pulse, pulse);
    ctx.font = '700 14px "STKaiti", "KaiTi", "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(42, 22, 4, 0.9)';
    ctx.strokeText('破绽', 0, 0);
    ctx.shadowColor = '#ffc24a';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('破绽', 0, 0);
    ctx.restore();
  }

  /** A small pulsing chevron at the screen edge for a living enemy outside the view (brighter while it winds up). */
  function drawOffscreenMarker(e) {
    if (e.team !== 'enemy' || e.kind === 'projectile' || !(e.hp > 0)) return;
    const p = project(e.x, e.z, 0);
    const left = p.x < -6;
    if (!left && p.x <= LOGICAL_W + 6) return;
    const x = left ? 8 : LOGICAL_W - 8;
    const y = p.y - Math.min(60, (e.height ?? 120) * 0.45);
    const hot = Boolean(e.telegraph);
    ctx.save();
    ctx.globalAlpha = (hot ? 0.75 : 0.45) + 0.25 * Math.sin(realClock * (hot ? 14 : 5));
    ctx.fillStyle = hot ? '#ff5a3a' : '#e8c890';
    ctx.beginPath();
    const f = left ? -1 : 1;
    ctx.moveTo(x + f * 6, y);
    ctx.lineTo(x - f * 3, y - 8);
    ctx.lineTo(x - f * 3, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHpBar(e, dt) {
    if (!e.showHpBar) return;
    if (e.hp <= 0 || e.state === 'dead') { hpShown.delete(e.id); return; }
    const shown = hpShown.get(e.id) ?? e.hp;
    const next = shown > e.hp ? shown + (e.hp - shown) * (1 - Math.exp(-dt * 5)) : e.hp;
    hpShown.set(e.id, next);
    const s = depthScale(e.z);
    const p = project(e.x, e.z, (e.y ?? 0) + e.height * s + 10);
    const w = e.boss ? 64 : 46;
    const x = Math.round(p.x - w / 2);
    const y = Math.round(p.y);
    ctx.fillStyle = 'rgba(8, 6, 5, 0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = '#f4eee0';
    ctx.fillRect(x, y, (w * next) / e.maxHp, 5);
    ctx.fillStyle = e.enraged ? '#ff5a2a' : '#cd4a38';
    ctx.fillRect(x, y, (w * e.hp) / e.maxHp, 5);
    if (Number.isFinite(e.maxPoise) && e.maxPoise > 0) {
      const k = clamp((e.poise ?? 0) / e.maxPoise, 0, 1);
      ctx.fillStyle = 'rgba(8, 6, 5, 0.85)';
      ctx.fillRect(x - 1, y + 6, w + 2, 4);
      ctx.fillStyle = e.staggered ? `rgba(255, 220, 140, ${0.6 + 0.4 * Math.sin(realClock * 10)})` : '#e8b04a';
      ctx.fillRect(x, y + 7, w * (e.staggered ? 1 : k), 2);
    }
  }

  function drawForeground() {
    ctx.fillStyle = scenery.foreground;
    ctx.fillRect(0, 0, LOGICAL_W, layout.H);
    ctx.fillStyle = scenery.vignette;
    ctx.fillRect(0, 0, LOGICAL_W, layout.H);
  }

  function drawDebug(world, vfx) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.5)';
    for (const z of [0, stage.depth]) {
      const a = project(0, z);
      ctx.beginPath(); ctx.moveTo(0, a.y); ctx.lineTo(LOGICAL_W, a.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    for (const e of world.entities) {
      if (e.hurt) {
        const box = hurtboxOf(e);
        const a = project(box.x0, box.z0);
        ctx.strokeStyle = e.intangible || e.invuln > 0 ? 'rgba(160, 160, 160, 0.8)' : 'rgba(80, 220, 255, 0.9)';
        ctx.strokeRect(a.x, a.y, box.x1 - box.x0, box.z1 - box.z0);
      }
      if (e.activeHit?.shape) drawShape(e.activeHit.shape, e.team === 'hero' ? 'rgba(255, 220, 60, 0.9)' : 'rgba(255, 60, 60, 0.9)');
      const t = e.telegraph;
      if (t) {
        const shape = t.shape === 'rect' || Number.isFinite(t.x0)
          ? { type: 'box', x0: Math.min(t.x0, t.x1), x1: Math.max(t.x0, t.x1), z0: Math.min(t.z0, t.z1), z1: Math.max(t.z0, t.z1) }
          : { type: 'ellipse', cx: t.cx, cz: t.cz, rx: t.rx, rz: t.rz };
        drawShape(shape, 'rgba(255, 140, 120, 0.7)');
      }
      if (e.kind === 'enemy' && e.hp > 0 && e.slot >= 0 && Number.isFinite(e.slotX)) {
        const a = project(e.x, e.z);
        const b = project(e.slotX, e.slotZ);
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.35)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.fillStyle = 'rgba(200, 200, 255, 0.7)';
        ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      }
      if (!e.height) continue;
      const top = project(e.x, e.z, (e.y ?? 0) + e.height * depthScale(e.z) + 22);
      const cooldown = e.kind === 'enemy' && e.hp > 0 && Number.isFinite(e.attackCooldown) ? ` · 冷却${e.attackCooldown.toFixed(1)}` : '';
      const label = `${STATE_LABELS[e.state] ?? e.state}${cooldown}`;
      ctx.fillStyle = '#000';
      ctx.fillText(label, top.x + 1, top.y + 1);
      ctx.fillStyle = '#e8f6ff';
      ctx.fillText(label, top.x, top.y);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8f6ff';
    const stats = vfx.stats?.();
    const fx = stats ? ` · 粒子 ${stats.particles} · 形状 ${stats.shapes}` : '';
    ctx.fillText(`帧 ${world.tick} · 顿帧 ${(world.hitStop * 1000).toFixed(0)}ms · 镜头 ${camera.x.toFixed(0)}${fx}`, 8, layout.hudH + 40);
    ctx.restore();
  }

  function drawShape(shape, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.15)');
    ctx.beginPath();
    if (shape.type === 'box') {
      const a = project(shape.x0, shape.z0);
      ctx.rect(a.x, a.y, shape.x1 - shape.x0, shape.z1 - shape.z0);
    } else {
      const c = project(shape.cx, shape.cz);
      ctx.ellipse(c.x, c.y, shape.rx, shape.rz, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  return {
    resize,
    project,
    depthScale,
    get layout() { return layout; },
    get camera() { return camera; },
    reset() {
      camera.snap = true;
      camera.arena = null;
      trails.clear();
      hpShown.clear();
      tracked.clear();
      motions.clear();
    },
    /** dt: view seconds since the last frame (already slowed for ?slowmo); frozen: the sim is in hit-stop. */
    render(world, vfx, { debug = false, dt = 0, frozen = false } = {}) {
      clock += frozen ? 0 : dt;
      realClock += dt;
      updateCamera(world, dt);
      updatePoses(world, dt, frozen);
      updateTrails(world, frozen ? 0 : dt);
      updateTracked(world, vfx, dt > 0 && !frozen, dt);
      view.camX = camera.x;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, LOGICAL_W, layout.H);
      const shake = vfx.shakeOffset();
      ctx.save();
      ctx.translate(shake.x, shake.y);
      const zoom = vfx.zoom?.();
      if (zoom) {
        const px = zoom.x - camera.x;
        const py = layout.bandTop + zoom.z - zoom.y;
        ctx.translate(px, py);
        ctx.scale(zoom.scale, zoom.scale);
        ctx.translate(-px, -py);
      }
      drawScenery();
      vfx.drawGround?.(ctx, view);
      for (const e of world.entities) if (e.telegraph) drawTelegraph(e);
      sorted.length = 0;
      for (const e of world.entities) sorted.push(e);
      sorted.sort((a, b) => a.z - b.z || a.id - b.id);
      for (const e of sorted) drawShadow(e);
      for (const e of sorted) drawEntity(e, vfx, frozen, dt);
      for (const e of sorted) if (e.staggered && e.hp > 0) drawStaggerMarks(e);
      for (const e of sorted) drawHpBar(e, dt);
      for (const e of sorted) drawOffscreenMarker(e);
      drawForegroundFog();
      vfx.drawGrade?.(ctx, view);
      vfx.draw(ctx, view);
      drawEmbers(true);
      if (debug) drawDebug(world, vfx);
      ctx.restore();
      drawForeground();
      vfx.drawScreen(ctx, layout);
    },
  };

  // ---- Caches, rebuilt on resize ----

  function buildScenery(spriteBank, art, lay, pr) {
    const back = spriteBank.images.backdrop;
    const painted = art.backdrop.floorFraction > 0;
    let wall;
    if (painted) {
      // A painted side view: its floor line sits at floorTop (34 px above the band's far edge, so feet at z = 0 stand
      // on the floor, never on the wall) and its floor share spans down to 30 px below the band. It scrolls with the
      // world. Below the image the floor continues as a mirrored copy of its bottom rows (under the control fade).
      const floorPx = back.naturalHeight * art.backdrop.floorFraction;
      const scale = (lay.bandBottom + 30 - lay.floorTop) / floorPx;
      const top = lay.floorTop - (back.naturalHeight - floorPx) * scale;
      const extend = Math.max(0, lay.H + 24 - (top + back.naturalHeight * scale));
      wall = { ...makeTile(back, scale, art.backdrop.mirror, pr, { shrink: 1, dim: 0.9, extend }), top, parallax: 1 };
    } else {
      // Wall only: fills the screen down past the floor line, dimmed and softened (depth of field), with parallax.
      const scale = (lay.floorTop + 40) / back.naturalHeight;
      wall = { ...makeTile(back, scale, art.backdrop.mirror, pr, { shrink: 1.4, dim: 0.66, grade: lay }), top: 0, parallax: 0.55 };
    }
    const floor = painted ? null : makeFloor(spriteBank.images.floor, art.floor.crop, pr, lay);

    const contact = ctx.createLinearGradient(0, lay.floorTop - 6, 0, lay.floorTop + 34);
    contact.addColorStop(0, 'rgba(0, 0, 0, 0)');
    contact.addColorStop(0.2, 'rgba(2, 4, 5, 0.5)');
    contact.addColorStop(0.45, 'rgba(2, 4, 5, 0.28)');
    contact.addColorStop(1, 'rgba(2, 4, 5, 0)');

    // Top fade behind the HUD; bottom fade into the control area.
    const foreground = ctx.createLinearGradient(0, 0, 0, lay.H);
    const h = y => clamp(y / lay.H, 0, 1);
    foreground.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    foreground.addColorStop(h(lay.hudH + 40), 'rgba(0, 0, 0, 0)');
    foreground.addColorStop(h(lay.bandBottom + 14), 'rgba(0, 0, 0, 0)');
    foreground.addColorStop(h(lay.bandBottom + 70), 'rgba(0, 0, 0, 0.72)');
    foreground.addColorStop(1, 'rgba(0, 0, 0, 0.9)');

    const cy = (lay.floorTop + lay.bandBottom) / 2;
    const vignette = ctx.createRadialGradient(LOGICAL_W / 2, cy, LOGICAL_W * 0.38, LOGICAL_W / 2, cy, Math.max(LOGICAL_W, lay.H) * 0.62);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');

    return {
      painted, wall, floor, contact, foreground, vignette,
      fog: makeFog(pr),
      fogPuff: makeBlob(pr, 64, 32, [150, 170, 172]),
      shadow: makeBlob(pr, 64, 24, [0, 0, 0], 0.75),
      ember: makeGlow('#ff8a3a'),
      beam: makeBeam(pr),
      hazard: makeHazard(),
    };
  }
}

/**
 * One tile period of an image at `scale` (plus a mirrored copy when `mirror`), softened by `shrink` and dimmed.
 * With `grade` (a layout), the wall also gets a darker top and a teal haze toward its base, so the seam blends.
 */
function makeTile(image, scale, mirror, pr, { shrink, dim, grade = null, extend = 0 }) {
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  const period = mirror ? w * 2 : w;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(period * pr);
  canvas.height = Math.ceil((h + extend) * pr);
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  let source = image;
  if (shrink > 1) {
    source = document.createElement('canvas');
    source.width = Math.max(1, Math.round(image.naturalWidth / shrink));
    source.height = Math.max(1, Math.round(image.naturalHeight / shrink));
    const sg = source.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(image, 0, 0, source.width, source.height);
  }
  const copies = mirror ? [[0, 1], [period * pr, -1]] : [[0, 1]];
  for (const [x, mx] of copies) {
    g.save();
    g.translate(x, 0);
    g.scale(mx, 1);
    g.drawImage(source, 0, 0, w * pr, h * pr);
    if (extend > 0) {
      // Continue the bottom edge downward as its own mirror image.
      g.beginPath();
      g.rect(0, h * pr, w * pr, extend * pr + 1);
      g.clip();
      g.translate(0, 2 * h * pr);
      g.scale(1, -1);
      g.drawImage(source, 0, 0, w * pr, h * pr);
    }
    g.restore();
  }
  g.fillStyle = `rgba(4, 6, 8, ${1 - dim})`;
  g.fillRect(0, 0, canvas.width, canvas.height);
  if (grade) {
    const base = (grade.floorTop / h) * canvas.height;
    const shade = g.createLinearGradient(0, 0, 0, canvas.height);
    const at = y => clamp(y / canvas.height, 0, 1);
    shade.addColorStop(0, 'rgba(3, 5, 7, 0.55)');
    shade.addColorStop(at(base * 0.45), 'rgba(3, 5, 7, 0.1)');
    shade.addColorStop(at(base * 0.8), 'rgba(40, 62, 66, 0.12)');
    shade.addColorStop(at(base), 'rgba(18, 28, 30, 0.55)');
    shade.addColorStop(1, 'rgba(8, 12, 14, 0.85)');
    g.fillStyle = shade;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, period, height: h + extend };
}

/**
 * The floor band as one tile column: a crop of the top-down floor texture, squashed for a low viewing angle and
 * mirrored so it tiles, repeated down to the bottom of the screen, shaded far-dark / near-light, and feathered at the
 * top so it melts into the wall haze instead of meeting it on a hard line.
 */
function makeFloor(image, [cx, cy, cw, ch], pr, lay) {
  const fx = 0.8;
  const fy = 0.42;
  const w = cw * fx;
  const h = ch * fy;
  const feather = 26;
  const top = lay.floorTop - feather;
  const height = lay.H + 24 - top;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * 2 * pr);
  canvas.height = Math.ceil(height * pr);
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  for (let y = 0; y < height; y += h * 2) {
    for (const [mx, my] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      g.save();
      g.translate((mx < 0 ? w * 2 : 0) * pr, (y + (my < 0 ? h * 2 : 0)) * pr);
      g.scale(mx, my);
      g.drawImage(image, cx, cy, cw, ch, 0, 0, w * pr, h * pr);
      g.restore();
    }
  }
  const at = yy => clamp((yy - top) / height, 0, 1);
  const shade = g.createLinearGradient(0, 0, 0, canvas.height);
  shade.addColorStop(0, 'rgba(6, 10, 12, 0.8)');
  shade.addColorStop(at(lay.floorTop + 10), 'rgba(6, 10, 12, 0.72)');
  shade.addColorStop(at(lay.bandTop + 20), 'rgba(6, 10, 12, 0.5)');
  shade.addColorStop(at((lay.bandTop + lay.bandBottom) / 2), 'rgba(6, 10, 12, 0.3)');
  shade.addColorStop(at(lay.bandBottom), 'rgba(6, 10, 12, 0.36)');
  shade.addColorStop(1, 'rgba(6, 10, 12, 0.6)');
  g.fillStyle = shade;
  g.fillRect(0, 0, canvas.width, canvas.height);
  // Feather the top edge (one full-size fill: destination-in clears everything outside the filled rect).
  const mask = g.createLinearGradient(0, 0, 0, canvas.height);
  const f = (feather * 2) / height;
  mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
  mask.addColorStop(f * 0.5, 'rgba(0, 0, 0, 0.75)');
  mask.addColorStop(f, 'rgba(0, 0, 0, 1)');
  mask.addColorStop(1, 'rgba(0, 0, 0, 1)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = mask;
  g.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, period: w * 2, height, top };
}

/** A tileable strip of soft fog: overlapping translucent blobs, wrapped at the seam. */
function makeFog(pr) {
  const period = 420;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(period * pr);
  canvas.height = Math.ceil(height * pr);
  const g = canvas.getContext('2d');
  g.scale(pr, pr);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const x = rnd() * period;
    const y = height * (0.35 + rnd() * 0.35);
    const r = 30 + rnd() * 46;
    for (const ox of [x - period, x, x + period]) {
      const gradient = g.createRadialGradient(ox, y, 0, ox, y, r);
      gradient.addColorStop(0, 'rgba(120, 146, 150, 0.16)');
      gradient.addColorStop(1, 'rgba(120, 146, 150, 0)');
      g.fillStyle = gradient;
      g.save();
      g.translate(ox, y);
      g.scale(1, 0.42);
      g.translate(-ox, -y);
      g.fillRect(ox - r, y - r, r * 2, r * 2);
      g.restore();
    }
  }
  return { canvas, period, height };
}

/** Soft elliptical blob (fog puffs, contact shadows). */
function makeBlob(pr, w, h, [r, gg, b], alpha = 0.9) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * pr);
  canvas.height = Math.ceil(h * pr);
  const g = canvas.getContext('2d');
  g.scale((w * pr) / 64, (h * pr) / 64);
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${r}, ${gg}, ${b}, ${alpha})`);
  gradient.addColorStop(0.5, `rgba(${r}, ${gg}, ${b}, ${alpha * 0.55})`);
  gradient.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return canvas;
}

function makeGlow(color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, '#fff2d0');
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 32, 32);
  return canvas;
}

const orbCache = new Map();
function orbGlow(color) {
  let canvas = orbCache.get(color);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.22, color);
  gradient.addColorStop(0.55, `${color.length === 7 ? color : '#ff8a3a'}44`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  orbCache.set(color, canvas);
  return canvas;
}

/** A soft vertical light shaft (drawn additively at low alpha). */
function makeBeam(pr) {
  const w = 70;
  const h = 200;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * pr * 0.5);
  canvas.height = Math.ceil(h * pr * 0.5);
  const g = canvas.getContext('2d');
  g.scale((canvas.width) / w, (canvas.height) / h);
  const across = g.createLinearGradient(0, 0, w, 0);
  across.addColorStop(0, 'rgba(120, 170, 170, 0)');
  across.addColorStop(0.5, 'rgba(120, 170, 170, 0.09)');
  across.addColorStop(1, 'rgba(120, 170, 170, 0)');
  g.fillStyle = across;
  g.beginPath();
  g.moveTo(w * 0.38, 0);
  g.lineTo(w * 0.62, 0);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.closePath();
  g.fill();
  const down = g.createLinearGradient(0, 0, 0, h);
  down.addColorStop(0, 'rgba(0, 0, 0, 1)');
  down.addColorStop(0.7, 'rgba(0, 0, 0, 0.6)');
  down.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = down;
  g.fillRect(0, 0, w, h);
  return canvas;
}

/** Diagonal hazard stripes for heavy telegraphs (a repeating pattern). */
let hazardPattern = null;
function makeHazard() {
  if (hazardPattern) return hazardPattern;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const g = canvas.getContext('2d');
  g.strokeStyle = 'rgba(255, 90, 120, 0.55)';
  g.lineWidth = 4;
  g.beginPath();
  for (let i = -16; i <= 32; i += 8) { g.moveTo(i, 16); g.lineTo(i + 16, 0); }
  g.stroke();
  hazardPattern = canvas.getContext('2d').createPattern(canvas, 'repeat');
  return hazardPattern;
}
