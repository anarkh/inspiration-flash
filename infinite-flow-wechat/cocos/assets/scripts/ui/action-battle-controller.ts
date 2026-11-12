import { DT, NEUTRAL_INPUT, createInputRecorder, createWorld, stepWorld } from '@infinite-flow/core/action-combat';
import type { ActionEnemy, ActionEvent, ActionHero, ActionInput, ActionInputLog, ActionInputRecorder, ActionWorld } from '@infinite-flow/core/action-combat';
import { canCaptureInActionWorld } from '@infinite-flow/core';
import type { ActionEncounter, PetId } from '@infinite-flow/core';
import type { CombatActionRosterEntryViewModel, CombatActionViewModel } from '@infinite-flow/presentation';
import { createHeroMotion, heroPose, updateHeroMotion } from './action-battle-anim';
import type { HeroMotion, HeroPose } from './action-battle-anim';
import {
  ACTION_VIEW_WIDTH, AttackGate, AutoAttacker, DEAD_ZONE, DODGE_HOLD_TICKS, DODGE_SUPPRESS_TICKS, DoubleTap, FlickTracker, SETTLE_MS,
  focusOf, wantsAutoAttack,
} from './action-battle-logic';
import { consumeVfxEvents, createVfxState, updateVfx, vfxLandDust } from './action-battle-vfx';
import type { VfxState } from './action-battle-vfx';
import { getInfiniteFlowActionBattleKey } from './battle-renderer';

/**
 * One real-time fight, owned by the View and kept across re-renders (View.render rebuilds the whole scene on any App
 * render): the sim world, its input recorder, the fixed-step accumulator, the one-hand input trackers, the camera and
 * every view clock and effect. Each render projects this state into fresh nodes; nothing here references a node.
 * The fight is committed once, as its whole input log, through the View's physical-input path.
 */

/** The action id the commit is dispatched under (busy state, activity message, dedupe by physical id). */
export const ACTION_COMMIT_ACTION_ID = 'combat.action:resolve';
/** Sim speed while world.slowMo > 0 (after a perfect dodge). */
export const ACTION_SLOWMO_RATE = 0.3;
/** Sim seconds the ending plays (death, last blow) before the commit, as the prototype's result panel delay. */
export const ACTION_ENDING_SECONDS = 0.9;
const MAX_STEPS_PER_FRAME = 8;
/** A stalled frame (an asset load, a resumed game) counts as at most this long: no burst of catch-up ticks. */
const MAX_FRAME_DT = 0.1;
const GHOST_LIFE = 0.22;
const GHOST_SPACING = 0.045;
const TRAIL_POINTS = 8;
/**
 * The opening shot: from the room's own monster's appearance through its intro banner, the camera frames it with the
 * hero, handing back to the follow over the last part. A drawn body's half-width is taken as a share of its height
 * (the hero's frames carry the cloak and the blade, wider than a monster figure).
 */
const INTRO_FRAME_SECONDS = 1.6;
const INTRO_HANDOFF_SECONDS = 0.4;
const FRAME_HERO_HALF = 0.42;
const FRAME_FOE_HALF = 0.32;
const FRAME_PAD = 10;
const BUSY_STATES: ReadonlySet<ActionHero['state']> = new Set(['attack1', 'attack2', 'attack3', 'hurt', 'down']);

export type ActionEdge = 'attack' | 'dodge' | 'skill' | 'spell' | 'item';
export type ActionMoveKey = 'up' | 'down' | 'left' | 'right';
export type ActionBattleStatus = 'fighting' | 'ending' | 'ready' | 'dispatching' | 'failed' | 'timeout';
export type ActionCommitRequest = Readonly<{ log: ActionInputLog; capture?: PetId }>;

export type ActionStickLayout = Readonly<{
  rest: Readonly<{ x: number; y: number }>;
  radius: number;
  knob: number;
  bounds: Readonly<{ x0: number; x1: number; y0: number; y1: number }>;
}>;

export type ActionGhost = Readonly<{ born: number; x: number; z: number; y: number; frame: HeroPose['frame']; facing: 1 | -1 }>;
export type ActionTracked = { flash: number; flashAt: number; firstSeen: number; hpShown: number; trail: number[] };
export type ActionBanner = Readonly<{ title: string; sub: string; tone: 'plain' | 'boss' | 'gold' | 'red'; at: number }>;

type StickState = {
  id: number | undefined;
  baseX: number; baseY: number; knobX: number; knobY: number;
  x: number; z: number;
  startedAt: number; movedAt: number; maxTravel: number;
};

/** canCaptureInActionWorld reads only the room's capture offer, the roster and the config, which the view model carries. */
function captureEncounterOf(vm: CombatActionViewModel): ActionEncounter | undefined {
  const offer = vm.capture;
  if (offer === undefined) return undefined;
  const encounter: Pick<ActionEncounter, 'capture' | 'roster' | 'config'> = {
    capture: { petId: offer.petId, itemId: offer.itemId, thresholdHp: offer.thresholdHp, maxHp: offer.maxHp },
    roster: vm.roster,
    config: vm.config,
  };
  return encounter as ActionEncounter;
}

export class ActionBattleController {
  readonly key: string;
  readonly world: ActionWorld;
  private readonly recorder: ActionInputRecorder;
  private readonly roster: ReadonlyMap<string, CombatActionRosterEntryViewModel>;
  private captureEncounter: ActionEncounter | undefined;
  private accumulator = 0;
  /** Accumulated frame time in ms: flick, double-tap and settle timing (never the system clock). */
  private inputClock = 0;
  /** View seconds at sim speed (effects, camera); runs through hit-stop. */
  viewClock = 0;
  /** Pose seconds: stops in hit-stop so bodies freeze. */
  poseClock = 0;
  /** Real frame seconds (HUD banners, toasts, pulses). */
  realClock = 0;
  /** Sim-speed seconds of the last advanced frame, and whether the sim sat in hit-stop. */
  lastViewDt = 0;
  frozen = false;
  status: ActionBattleStatus = 'fighting';
  /** Player-facing reason of a failed commit. */
  failure: string | undefined;
  private pendingLog: ActionInputLog | undefined;
  private pendingCapture: PetId | undefined;
  private seenBusy = false;
  readonly vfx: VfxState = createVfxState();
  readonly camera = { x: 0, snap: true, look: 0, frame: 0, lock: 0 };
  readonly heroMotion: HeroMotion;
  heroPose: HeroPose;
  readonly ghosts: ActionGhost[] = [];
  readonly tracked = new Map<number, ActionTracked>();
  private readonly lastY = new Map<number, number>();
  /** HUD state that must survive re-renders. */
  readonly ui = {
    banner: undefined as ActionBanner | undefined,
    toast: undefined as Readonly<{ text: string; at: number }> | undefined,
    denied: { skill: -10, spell: -10, item: -10 } as Record<'skill' | 'spell' | 'item', number>,
    comboBumpAt: -10,
    lastCombo: 0,
    maxCombo: 0,
    bossGhost: { id: -1, shown: 1, behind: 1, wait: 0 },
    touched: false,
    touchedAt: -10,
  };
  private readonly stick: StickState = { id: undefined, baseX: 0, baseY: 0, knobX: 0, knobY: 0, x: 0, z: 0, startedAt: 0, movedAt: 0, maxTravel: 0 };
  /** Set by every projection before it binds the stick zone. */
  private stickLayout: ActionStickLayout | undefined;
  private readonly flick = new FlickTracker();
  private readonly taps = new DoubleTap();
  private readonly auto = new AutoAttacker();
  private readonly gate = new AttackGate();
  private dodgeHold: { x: number; z: number; ticks: number; fresh: boolean } | undefined;
  private readonly latch = new Set<ActionEdge>();
  private readonly held = new Set<ActionMoveKey>();

  constructor(public vm: CombatActionViewModel) {
    this.key = getInfiniteFlowActionBattleKey(vm);
    this.world = createWorld(vm.config);
    this.recorder = createInputRecorder();
    this.roster = new Map(vm.roster.map(member => [member.archetype, member]));
    this.captureEncounter = captureEncounterOf(vm);
    this.heroMotion = createHeroMotion(this.world.hero);
    this.heroPose = heroPose(this.world.hero, this.world.tuning.hero, 0, this.heroMotion);
    // The first projection comes before the first tick: start it on the hero, not the stage's left edge.
    this.updateCamera(0);
  }

  /** A fresh view model of the same encounter (spell / pill availability, capture offer, escape action). */
  updateModel(vm: CombatActionViewModel): void {
    if (getInfiniteFlowActionBattleKey(vm) !== this.key) throw new Error('Action battle model belongs to another encounter');
    this.vm = vm;
    this.captureEncounter = captureEncounterOf(vm);
  }

  rosterOf(archetype: string): CombatActionRosterEntryViewModel | undefined {
    return this.roster.get(archetype);
  }

  get ticks(): number {
    return this.recorder.ticks;
  }

  /** Sim seconds of slow motion the loop is honouring right now. */
  get rate(): number {
    return this.world.slowMo > 0 ? ACTION_SLOWMO_RATE : 1;
  }

  canCapture(): boolean {
    return this.status === 'fighting' && this.captureEncounter !== undefined && canCaptureInActionWorld(this.captureEncounter, this.world);
  }

  // ---- Loop ----

  /** One frame: fixed 60 Hz sim steps from the accumulator (slowed while world.slowMo > 0), then the view clocks. */
  advance(dt: number): void {
    if (!(dt > 0)) return;
    const frame = Math.min(dt, MAX_FRAME_DT);
    this.inputClock += frame * 1000;
    this.realClock += frame;
    let viewDt = frame;
    if (this.status === 'fighting' || this.status === 'ending') {
      this.accumulator += frame;
      let steps = 0;
      while (steps < MAX_STEPS_PER_FRAME && this.accumulator >= DT / this.rate && (this.status === 'fighting' || this.status === 'ending')) {
        this.accumulator -= DT / this.rate;
        this.step();
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
      viewDt = frame * this.rate;
    }
    this.lastViewDt = viewDt;
    this.frozen = this.world.hitStop > 0 && (this.status === 'fighting' || this.status === 'ending');
    this.viewClock += viewDt;
    if (!this.frozen) this.poseClock += viewDt;
    updateVfx(this.vfx, viewDt);
    this.updateView(viewDt);
  }

  private step(): void {
    const fighting = this.status === 'fighting';
    const input = fighting ? this.readInput() : { ...NEUTRAL_INPUT };
    this.recorder.push(input);
    stepWorld(this.world, input);
    const events = this.world.events.splice(0);
    consumeVfxEvents(this.vfx, events, this.world);
    this.handleEvents(events);
    this.trackLandings();
    const world = this.world;
    if (this.status === 'fighting' && world.phase !== 'fight') this.status = 'ending';
    if (this.status === 'ending' && world.endedAt !== null && world.time - world.endedAt >= ACTION_ENDING_SECONDS - 1e-9) this.prepareCommit(undefined);
    if ((this.status === 'fighting' || this.status === 'ending') && this.recorder.ticks >= this.vm.maxTicks) {
      // The log cannot grow past the commit's bound: a decided fight commits as it stands, an open one is surfaced.
      if (world.phase === 'fight') this.status = 'timeout';
      else this.prepareCommit(undefined);
    }
  }

  private prepareCommit(capture: PetId | undefined): void {
    this.pendingLog = this.recorder.finish();
    this.pendingCapture = capture;
    this.status = 'ready';
    this.failure = undefined;
    this.resetTouch();
  }

  private trackLandings(): void {
    for (const e of this.world.entities) {
      if (e.kind === 'projectile') continue;
      const before = this.lastY.get(e.id) ?? e.y;
      if (before > 8 && e.y <= 0) vfxLandDust(this.vfx, e.x, e.z, before > 30);
      this.lastY.set(e.id, e.y);
    }
  }

  private handleEvents(events: readonly ActionEvent[]): void {
    const ui = this.ui;
    const rank = this.vm.rank;
    for (const event of events) {
      switch (event.type) {
        case 'waveStart': {
          if (rank !== 'normal') break;
          const primary = this.vm.roster.find(member => member.primary);
          ui.banner = { title: primary?.name ?? '迎 战', sub: `敌 ×${event.count}`, tone: 'plain', at: this.realClock };
          break;
        }
        case 'bossIntro': {
          const entity = this.world.entities.find(e => e.id === event.id);
          const kit = entity?.kind === 'enemy' ? this.rosterOf(entity.archetype)?.kit : undefined;
          const sub = rank === 'pursuer' ? '追 兵' : kit === 'boss' ? '首 领' : '精 英';
          ui.banner = { title: `◆ ${event.name}`, sub, tone: 'boss', at: this.realClock };
          break;
        }
        case 'enrage':
          ui.banner = { title: '狂 暴', sub: event.name, tone: 'red', at: this.realClock };
          break;
        case 'stageCleared':
          ui.banner = { title: '胜 利', sub: '', tone: 'gold', at: this.realClock };
          break;
        case 'heroDown':
          ui.banner = { title: '倒 下', sub: '', tone: 'red', at: this.realClock };
          break;
        case 'denied':
          ui.denied[event.what] = this.realClock;
          ui.toast = { text: deniedText(event.what, event.reason), at: this.realClock };
          break;
        default:
          break;
      }
    }
    const combo = this.world.combo.count;
    if (combo > ui.lastCombo && combo >= 2) ui.comboBumpAt = this.realClock;
    ui.lastCombo = combo;
    ui.maxCombo = Math.max(ui.maxCombo, combo);
  }

  /** Camera, hero motion and pose, afterimages and per-entity view memory for this frame. */
  private updateView(dt: number): void {
    const world = this.world;
    const hero = world.hero;
    updateHeroMotion(this.heroMotion, hero, this.frozen ? 0 : dt, this.viewClock);
    this.heroPose = heroPose(hero, world.tuning.hero, this.poseClock, this.heroMotion);
    if (hero.afterimage && !this.frozen && dt > 0) {
      const last = this.ghosts[this.ghosts.length - 1];
      if (last === undefined || this.poseClock - last.born >= GHOST_SPACING) {
        this.ghosts.push({ born: this.poseClock, x: hero.x, z: hero.z, y: hero.y, frame: this.heroPose.frame, facing: this.heroPose.facing });
      }
    }
    while (this.ghosts.length > 0 && this.poseClock - this.ghosts[0]!.born >= GHOST_LIFE) this.ghosts.shift();
    const seen = new Set<number>();
    for (const e of world.entities) {
      seen.add(e.id);
      let t = this.tracked.get(e.id);
      if (t === undefined) {
        t = { flash: e.flash, flashAt: -1, firstSeen: this.realClock, hpShown: e.kind === 'projectile' ? 0 : e.hp, trail: [] };
        this.tracked.set(e.id, t);
      }
      if (e.flash > t.flash + 1e-6) t.flashAt = this.viewClock;
      t.flash = e.flash;
      if (e.kind !== 'projectile') {
        t.hpShown = t.hpShown > e.hp ? t.hpShown + (e.hp - t.hpShown) * (1 - Math.exp(-dt * 5)) : e.hp;
      } else if (!this.frozen && dt > 0) {
        t.trail.push(e.x, e.z, e.y + e.height / 2);
        if (t.trail.length > TRAIL_POINTS * 3) t.trail.splice(0, 3);
      }
    }
    for (const id of Array.from(this.tracked.keys())) if (!seen.has(id)) this.tracked.delete(id);
    this.updateCamera(dt);
    // The boss bar's white ghost lingers at the old value after damage (0.45 s), then drains; heals snap it up.
    const boss = world.entities.find(e => e.kind === 'enemy' && e.boss && !e.remove);
    const ghost = this.ui.bossGhost;
    if (boss !== undefined && boss.kind === 'enemy') {
      const ratio = boss.maxHp > 0 ? Math.max(0, boss.hp) / boss.maxHp : 0;
      if (boss.id !== ghost.id) { ghost.id = boss.id; ghost.shown = ratio; ghost.behind = ratio; ghost.wait = 0; }
      if (ratio < ghost.shown - 1e-6) ghost.wait = 0.45;
      ghost.shown = ratio;
      if (ratio > ghost.behind) ghost.behind = ratio;
      else if (ghost.wait > 0) ghost.wait -= dt;
      else ghost.behind = Math.max(ratio, ghost.behind - 0.8 * dt);
    }
  }

  /**
   * Follow the hero with a smoothed look-ahead; lean toward nearby enemies while the hero keeps HERO_MARGIN inside the
   * view; ease into the locked arena. All in world units across ACTION_VIEW_WIDTH.
   */
  private updateCamera(dt: number): void {
    const world = this.world;
    const hero = world.hero;
    const cam = this.camera;
    const W = ACTION_VIEW_WIDTH;
    const margin = 80;
    const lookTarget = (hero.facing >= 0 ? 1 : -1) * 30 + Math.max(-240, Math.min(240, hero.vx)) * 0.1;
    const locked = world.arena !== null && !world.advance;
    if (cam.snap) { cam.look = lookTarget; cam.lock = locked ? 1 : 0; }
    else {
      cam.look += (lookTarget - cam.look) * (1 - Math.exp(-dt * 2.5));
      cam.lock += ((locked ? 1 : 0) - cam.lock) * (1 - Math.exp(-dt * 3.5));
    }
    let sum = 0;
    let count = 0;
    for (const e of world.entities) {
      if (e.kind !== 'enemy' || !(e.hp > 0) || Math.abs(e.x - hero.x) > 340) continue;
      sum += e.x;
      count += 1;
    }
    const frameTarget = count > 0 ? Math.max(-100, Math.min(100, (sum / count - hero.x) * 0.45)) : 0;
    if (cam.snap) cam.frame = frameTarget;
    else cam.frame += (frameTarget - cam.frame) * (1 - Math.exp(-dt * 1.6));
    const lookShare = 1 - Math.min(1, Math.abs(cam.frame) / 70) * 0.6;
    let target = hero.x - W / 2 + cam.look * lookShare + cam.frame;
    target = Math.max(hero.x - (W - margin), Math.min(hero.x - margin, target));
    const intro = this.introFraming();
    if (intro !== undefined) target += (intro.target - target) * intro.weight;
    const arena = world.arena ?? world.stage.waves[0]?.arena ?? null;
    if (arena !== null && cam.lock > 0.001) {
      const lo = arena.left;
      const hi = arena.right - W;
      const inside = hi < lo ? (arena.left + arena.right - W) / 2 : Math.max(lo, Math.min(hi, target));
      target += (inside - target) * cam.lock;
    }
    target = Math.max(0, Math.min(Math.max(0, world.stage.width - W), target));
    // Snap until the first tick has spawned the room, so the opening frame already holds its framing.
    if (cam.snap) { cam.x = target; cam.snap = world.tick === 0; }
    else cam.x += (target - cam.x) * (1 - Math.exp(-dt * 6));
  }

  /**
   * The opening shot's camera x and weight, while the room's own monster is in its intro: both bodies centred when they
   * fit the view, otherwise as far toward the monster as keeps the hero whole. The sim never sees it.
   */
  private introFraming(): Readonly<{ target: number; weight: number }> | undefined {
    const world = this.world;
    const hero = world.hero;
    const primary = world.entities.find((e): e is ActionEnemy => e.kind === 'enemy' && e.hp > 0 && !e.remove
      && this.roster.get(e.archetype)?.primary === true);
    if (primary === undefined) return undefined;
    const age = this.realClock - (this.tracked.get(primary.id)?.firstSeen ?? this.realClock);
    if (age >= INTRO_FRAME_SECONDS) return undefined;
    const W = ACTION_VIEW_WIDTH;
    const heroHalf = hero.height * FRAME_HERO_HALF + FRAME_PAD;
    const foeHalf = primary.height * FRAME_FOE_HALF + FRAME_PAD;
    const left = Math.min(hero.x - heroHalf, primary.x - foeHalf);
    const right = Math.max(hero.x + heroHalf, primary.x + foeHalf);
    const target = Math.max(hero.x + heroHalf - W, Math.min(hero.x - heroHalf, (left + right) / 2 - W / 2));
    return { target, weight: Math.min(1, (INTRO_FRAME_SECONDS - age) / INTRO_HANDOFF_SECONDS) };
  }

  // ---- Input ----

  setStickLayout(layout: ActionStickLayout): void {
    this.stickLayout = layout;
    if (this.stick.id === undefined) this.stickToRest();
  }

  /** Logical screen coords of the stick for drawing (its rest position while untouched). */
  get stickView(): Readonly<{ active: boolean; baseX: number; baseY: number; knobX: number; knobY: number }> {
    const s = this.stick;
    return { active: s.id !== undefined, baseX: s.baseX, baseY: s.baseY, knobX: s.knobX, knobY: s.knobY };
  }

  private stickToRest(): void {
    const s = this.stick;
    const rest = this.stickLayout?.rest ?? { x: s.baseX, y: s.baseY };
    s.baseX = s.knobX = rest.x;
    s.baseY = s.knobY = rest.y;
    s.x = 0;
    s.z = 0;
  }

  /** A press in the stick zone (logical screen coords). Ignored outside the live fight. */
  stickStart(id: number, x: number, y: number): boolean {
    const s = this.stick;
    const layout = this.stickLayout;
    if (this.status !== 'fighting' || s.id !== undefined || layout === undefined) return false;
    const b = layout.bounds;
    s.id = id;
    s.startedAt = this.inputClock;
    s.movedAt = this.inputClock;
    s.maxTravel = 0;
    s.baseX = Math.min(Math.max(x, b.x0), b.x1);
    s.baseY = Math.min(Math.max(y, b.y0), b.y1);
    this.flick.start();
    if (!this.ui.touched) { this.ui.touched = true; this.ui.touchedAt = this.realClock; }
    this.moveKnob(x, y);
    return true;
  }

  stickMove(id: number, x: number, y: number): void {
    if (this.stick.id !== id) return;
    this.moveKnob(x, y);
  }

  stickEnd(id: number): void {
    const s = this.stick;
    if (s.id !== id) return;
    const startedAt = s.startedAt;
    const maxTravel = s.maxTravel;
    s.id = undefined;
    this.stickToRest();
    if (this.status !== 'fighting') return;
    const now = this.inputClock;
    const dir = this.flick.end(now);
    const doubled = this.taps.end(now, startedAt, maxTravel);
    if (dir !== undefined) this.dodgeToward(dir.x, dir.z);
    else if (doubled) this.dodgeToward(-(this.world.hero.facing || 1), 0);
  }

  stickCancel(id: number): void {
    if (this.stick.id !== id) return;
    this.stick.id = undefined;
    this.stickToRest();
  }

  private moveKnob(x: number, y: number): void {
    const s = this.stick;
    if (this.stickLayout === undefined) return;
    const radius = this.stickLayout.radius;
    let dx = x - s.baseX;
    let dy = y - s.baseY;
    const raw = Math.hypot(dx, dy);
    let length = raw;
    if (length > radius) {
      // The base trails the finger, so sliding past the rim never leaves the stick stuck at full tilt elsewhere.
      s.baseX = x - (dx / length) * radius;
      s.baseY = y - (dy / length) * radius;
      dx = x - s.baseX;
      dy = y - s.baseY;
      length = radius;
    }
    s.knobX = s.baseX + dx;
    s.knobY = s.baseY + dy;
    const travel = raw / radius;
    const scaled = travel < DEAD_ZONE ? 0 : (Math.min(1, travel) - DEAD_ZONE) / (1 - DEAD_ZONE);
    s.x = length > 0 ? (dx / length) * scaled : 0;
    s.z = length > 0 ? (dy / length) * scaled : 0;
    if (scaled > 0) s.movedAt = this.inputClock;
    s.maxTravel = Math.max(s.maxTravel, travel);
    this.flick.move(this.inputClock, travel, dx, dy);
  }

  private dodgeToward(x: number, z: number): void {
    this.latch.add('dodge');
    this.dodgeHold = { x, z, ticks: DODGE_HOLD_TICKS, fresh: true };
    this.auto.suppress(DODGE_SUPPRESS_TICKS);
  }

  /** A control that feeds the sim (touch-down) or a key press. */
  press(edge: ActionEdge): void {
    if (this.status !== 'fighting') return;
    this.latch.add(edge);
  }

  keyDown(key: ActionMoveKey | ActionEdge): void {
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') { this.held.add(key); return; }
    if (this.status !== 'fighting') return;
    if (key === 'attack') {
      const edge = this.gate.press(this.inputClock, focusOf(this.world.hero).full);
      if (edge !== undefined) this.latch.add(edge);
      return;
    }
    this.latch.add(key);
  }

  keyUp(key: ActionMoveKey | ActionEdge): void {
    if (key === 'up' || key === 'down' || key === 'left' || key === 'right') { this.held.delete(key); return; }
    if (key === 'attack') {
      const edge = this.gate.release(this.inputClock, focusOf(this.world.hero).full);
      if (edge !== undefined && this.status === 'fighting') this.latch.add(edge);
    }
  }

  /** Touch tracking cannot survive a scene rebuild or a hidden game; drop it (and held keys on hide). */
  resetTouch(): void {
    this.stick.id = undefined;
    this.stickToRest();
  }

  resetInput(): void {
    this.resetTouch();
    this.held.clear();
    this.latch.clear();
    this.gate.reset();
    this.auto.reset();
    this.taps.reset();
    this.dodgeHold = undefined;
    // A resumed game restarts the clock instead of catching up.
    this.accumulator = 0;
  }

  /** The input of one sim tick: keyboard and stick combined (strongest move wins, presses OR-ed), press edges drained. */
  private readInput(): ActionInput {
    const hero = this.world.hero;
    const full = focusOf(hero).full;
    const polled = this.gate.poll(this.inputClock, full);
    if (polled !== undefined) this.latch.add(polled);
    let kx = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let kz = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0);
    if (kx !== 0 && kz !== 0) { kx *= Math.SQRT1_2; kz *= Math.SQRT1_2; }
    const s = this.stick;
    let tx = s.x;
    let tz = s.z;
    const moving = tx !== 0 || tz !== 0;
    if (this.dodgeHold !== undefined) {
      const hold = this.dodgeHold;
      if (!hold.fresh && (hero.state === 'dodge' || !BUSY_STATES.has(hero.state) || (hold.ticks -= 1) <= 0)) {
        this.dodgeHold = undefined;
      } else {
        hold.fresh = false;
        if (!moving) { tx = hold.x; tz = hold.z; }
      }
    }
    const keyboardMoving = kx !== 0 || kz !== 0;
    const neutral = !moving && !keyboardMoving && this.dodgeHold === undefined
      && (s.id === undefined || this.inputClock - s.movedAt >= SETTLE_MS);
    // Auto-attack belongs to the one-hand stick: it only runs while no key steers and no attack key is held.
    if (this.auto.tick(neutral && !this.gate.held, neutral && !this.gate.held && wantsAutoAttack(this.world))) this.latch.add('attack');
    const touchMagnitude = Math.hypot(tx, tz);
    const keyMagnitude = Math.hypot(kx, kz);
    const input: ActionInput = {
      moveX: keyMagnitude > touchMagnitude ? kx : tx,
      moveZ: keyMagnitude > touchMagnitude ? kz : tz,
      attack: this.latch.has('attack'),
      dodge: this.latch.has('dodge'),
      skill: this.latch.has('skill'),
      spell: this.latch.has('spell'),
      item: this.latch.has('item'),
      attackHeld: this.gate.held,
    };
    this.latch.clear();
    return input;
  }

  // ---- Commit ----

  /** Capture button: freeze the fight and commit with the capture while the replayed world will allow it. */
  beginCapture(): boolean {
    const offer = this.vm.capture;
    if (offer === undefined || !this.canCapture()) return false;
    this.prepareCommit(offer.petId);
    return true;
  }

  /** The commit to dispatch now, once; the controller then waits for the App's busy render. */
  takeCommitRequest(): ActionCommitRequest | undefined {
    if (this.status !== 'ready' || this.pendingLog === undefined) return undefined;
    this.status = 'dispatching';
    this.seenBusy = false;
    return this.pendingCapture === undefined ? { log: this.pendingLog } : { log: this.pendingLog, capture: this.pendingCapture };
  }

  /**
   * Every render's chrome while a commit is out: the App marks the action busy as it dispatches and clears it when the
   * result arrives. A cleared busy state with this encounter still on screen means the commit did not take effect.
   */
  observeChrome(busyActionId: string | undefined, blocked: boolean, reason: string): void {
    if (this.status !== 'dispatching') return;
    if (busyActionId === ACTION_COMMIT_ACTION_ID) { this.seenBusy = true; return; }
    if (this.seenBusy && busyActionId === undefined && !blocked) this.fail(reason);
  }

  /** Right after the dispatch call: true when the App never picked it up (it was busy or had no client). */
  confirmDispatched(): boolean {
    if (this.status !== 'dispatching' || this.seenBusy) return false;
    this.fail('结算未能提交，请重试');
    return true;
  }

  private fail(reason: string): void {
    this.status = 'failed';
    this.failure = reason;
  }

  /** Re-dispatch the same log (a new physical input). */
  retry(): boolean {
    if (this.status !== 'failed' || this.pendingLog === undefined) return false;
    this.status = 'ready';
    this.failure = undefined;
    return true;
  }

  /** After a refused capture the fight is still on: keep recording from where it stopped. */
  resume(): boolean {
    if (this.status !== 'failed' || this.pendingCapture === undefined || this.world.phase !== 'fight') return false;
    this.status = 'fighting';
    this.failure = undefined;
    this.pendingLog = undefined;
    this.pendingCapture = undefined;
    this.accumulator = 0;
    return true;
  }

  get pendingCaptureId(): PetId | undefined {
    return this.pendingCapture;
  }
}

function deniedText(what: 'skill' | 'spell' | 'item', reason: 'focus' | 'cooldown' | 'empty' | 'full' | 'sealed'): string {
  if (reason === 'focus') return what === 'skill' ? '战意未满' : '战意不足';
  if (reason === 'empty') return '丹药已用完';
  if (reason === 'full') return '生命已满';
  if (reason === 'sealed') return '当前场域封存了术法';
  return what === 'spell' ? '法术调息中' : what === 'item' ? '丹药冷却中' : '冷却中';
}
