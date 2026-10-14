import { Color, Graphics, Label, Node, Size, UITransform, Vec3 } from 'cc';

export type CombatEffectKind = 'attack' | 'weapon' | 'art' | 'pill' | 'guard' | 'mist' | 'iron' | 'talisman' | 'escape' | 'other';
export type CombatEffectResult = Readonly<{
  enemyDamage?: number;
  playerHealing?: number;
  playerDamage?: number;
  counter?: boolean;
  guarded?: boolean;
  playerHpAfterImpact?: number;
  enemyHpAfterImpact?: number;
  playerHpAfterCounter?: number;
  enemyHpAfterCounter?: number;
  onCounterImpact?: () => void;
}>;
type Point = Readonly<{ x: number; y: number }>;
type EffectOptions = Readonly<{
  getAnchors: () => Readonly<{ player: Point; enemy: Point }>;
  movePlayer: (offset: Point) => void;
  moveEnemy: (offset: Point) => void;
}>;
type EffectRun = {
  kind: CombatEffectKind;
  phase: 'prepare' | 'waiting' | 'resolve';
  elapsed: number;
  onImpact: () => void;
  result?: CombatEffectResult;
  onComplete?: () => void;
  counterDelivered: boolean;
};

// Visual seconds only: the domain supplies every outcome and numerical value.
const IMPACT: Readonly<Record<CombatEffectKind, number>> = {
  attack: 0.27, weapon: 0.44, art: 0.52, pill: 0.43, guard: 0.18,
  mist: 0.30, iron: 0.27, talisman: 0.45, escape: 0.18, other: 0.25,
};
const GOLD = new Color(231, 189, 114, 255);
const CYAN = new Color(146, 221, 209, 255);
const GREEN = new Color(178, 223, 158, 255);
const RED = new Color(220, 149, 132, 255);
const WHITE = new Color(255, 242, 212, 255);
const ZERO = { x: 0, y: 0 };
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const alpha = (color: Color, opacity: number): Color => new Color(color.r, color.g, color.b, Math.round(255 * clamp(opacity)));
const mix = (from: Point, to: Point, progress: number): Point => ({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });

/** Native, tick-driven visuals. Awaiting a command never manufactures an outcome. */
export function createInfiniteFlowCombatEffects(parent: Node, options: EffectOptions) {
  const layer = new Node('WalkCombatEffects');
  layer.layer = parent.layer;
  parent.addChild(layer);
  layer.addComponent(UITransform).setContentSize(new Size(750, 1000));
  const graphic = layer.addComponent(Graphics);
  function numberLabel(name: string): Label {
    const node = new Node(name);
    node.layer = layer.layer;
    layer.addChild(node);
    node.addComponent(UITransform).setContentSize(new Size(220, 66));
    const label = node.addComponent(Label);
    label.fontSize = 42;
    label.lineHeight = 48;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.string = '';
    return label;
  }
  const damage = numberLabel('WalkDamage');
  const healing = numberLabel('WalkHealing');
  const counterDamage = numberLabel('WalkCounterDamage');
  let run: EffectRun | undefined;
  let disposed = false;

  function line(points: readonly Point[], color: Color, width: number, opacity = 1): void {
    const first = points[0];
    if (first === undefined) return;
    graphic.strokeColor = alpha(color, opacity);
    graphic.lineWidth = width;
    graphic.moveTo(first.x, first.y);
    for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
    graphic.stroke();
  }
  function ring(point: Point, radius: number, color: Color, opacity: number, flat = false): void {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = index * Math.PI / 16;
      return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius * (flat ? 0.3 : 1) };
    });
    line(points, color, 2.5, opacity);
  }
  function rune(point: Point, progress: number, color: Color): void {
    const radius = 38 + progress * 15;
    ring(point, radius, color, 0.75);
    ring(point, radius * 0.79, color, 0.35);
    for (let triangle = 0; triangle < 2; triangle += 1) {
      line(Array.from({ length: 4 }, (_, index) => {
        const angle = index * Math.PI * 2 / 3 + triangle * Math.PI + progress * 0.5;
        return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
      }), color, 2, 0.65);
    }
  }
  function slash(point: Point, progress: number, strong = false, reverse = false): void {
    const flip = reverse ? -1 : 1;
    const scale = strong ? 1.2 : 1;
    line([
      { x: point.x - 56 * scale * flip, y: point.y - 42 * scale },
      { x: point.x - 19 * scale * flip, y: point.y + 13 * scale },
      { x: point.x + 48 * scale * flip, y: point.y + 53 * scale },
    ], GOLD, strong ? 12 : 8, 1 - progress);
    line([
      { x: point.x - 48 * scale * flip, y: point.y - 38 * scale },
      { x: point.x - 9 * scale * flip, y: point.y + 16 * scale },
      { x: point.x + 48 * scale * flip, y: point.y + 53 * scale },
    ], WHITE, 3, 1 - progress);
  }
  function shield(point: Point, opacity: number): void {
    line([
      { x: point.x, y: point.y + 57 }, { x: point.x + 42, y: point.y + 37 },
      { x: point.x + 37, y: point.y - 13 }, { x: point.x, y: point.y - 48 },
      { x: point.x - 37, y: point.y - 13 }, { x: point.x - 42, y: point.y + 37 },
      { x: point.x, y: point.y + 57 },
    ], GOLD, 5, opacity);
    line([{ x: point.x, y: point.y - 25 }, { x: point.x, y: point.y + 34 }], GOLD, 3, opacity);
    line([{ x: point.x - 19, y: point.y + 13 }, { x: point.x, y: point.y + 31 }, { x: point.x + 19, y: point.y + 13 }], GOLD, 3, opacity);
  }
  function particles(point: Point, progress: number, color: Color, heal = false): void {
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4 + 0.3;
      const x = point.x + (heal ? (index % 3 - 1) * 26 : Math.cos(angle) * (12 + progress * 58));
      const y = point.y + (heal ? -20 + progress * (45 + index * 5) : Math.sin(angle) * (12 + progress * 48));
      line([{ x: x - 3, y }, { x: x + 3, y }], color, 2.5, 1 - progress);
      line([{ x, y: y - 3 }, { x, y: y + 3 }], color, 2.5, 1 - progress);
    }
  }
  function floating(label: Label, value: number | undefined, point: Point, elapsed: number, color: Color, positive = false): void {
    if (value === undefined || value <= 0 || elapsed < 0) { label.string = ''; return; }
    label.string = `${positive ? '+' : '−'}${value}`;
    label.node.setPosition(new Vec3(point.x, point.y + 60 + Math.min(elapsed, 0.65) * 44, 0));
    label.color = alpha(color, 1 - elapsed / 0.75);
  }
  function restore(): void {
    options.movePlayer(ZERO);
    options.moveEnemy(ZERO);
    graphic.clear();
    damage.string = '';
    healing.string = '';
    counterDamage.string = '';
  }
  function draw(active: EffectRun): void {
    graphic.clear();
    options.movePlayer(ZERO);
    options.moveEnemy(ZERO);
    const { player, enemy } = options.getAnchors();
    const ground = { x: player.x, y: player.y - 44 };
    const vector = { x: enemy.x - player.x, y: enemy.y - player.y };
    const length = Math.max(1, Math.hypot(vector.x, vector.y));
    const direction = { x: vector.x / length, y: vector.y / length };
    const preparation = active.phase !== 'resolve';
    const p = preparation ? clamp(active.elapsed / IMPACT[active.kind]) : clamp(active.elapsed / 0.34);
    const opacity = preparation ? 0.35 + 0.6 * p : 1 - p;
    if (active.kind === 'attack' || active.kind === 'weapon') {
      const strong = active.kind === 'weapon';
      const step = strong ? 31 : 23;
      const offset = preparation ? (p < 0.3 ? -5 * p / 0.3 : step * (p - 0.3) / 0.7) : step * (1 - p);
      options.movePlayer({ x: direction.x * offset, y: direction.y * offset });
      if (strong) ring(ground, 31 + p * 24, GOLD, opacity, true);
      if (!preparation) {
        slash(enemy, p, strong);
        if (strong && active.elapsed >= 0.085) slash(enemy, clamp((active.elapsed - 0.085) / 0.3), true, true);
      }
    } else if (active.kind === 'art') {
      rune(player, p, CYAN);
      if (preparation && p > 0.48) {
        const projectile = mix(player, enemy, clamp((p - 0.48) / 0.52));
        line([mix(player, projectile, 0.7), projectile], CYAN, 8, 0.75);
        ring(projectile, 9, WHITE, 0.95);
      }
    } else if (active.kind === 'pill') {
      if (preparation) {
        const bottle = { x: player.x + 27 * (1 - p), y: player.y + 7 + Math.sin(p * Math.PI) * 20 };
        line([{ x: bottle.x - 9, y: bottle.y + 13 }, { x: bottle.x + 9, y: bottle.y + 13 }], GOLD, 5, opacity);
        ring(bottle, 12 * (1 - p * 0.5), GREEN, opacity);
      } else { ring(ground, 32 + p * 28, GREEN, opacity, true); particles(player, p, GREEN, true); }
    } else if (active.kind === 'guard' || active.kind === 'iron') {
      shield(player, opacity);
      if (active.kind === 'iron') ring(ground, 32 + p * 21, GOLD, opacity, true);
    } else if (active.kind === 'mist' || active.kind === 'escape') {
      for (let strand = 0; strand < 3; strand += 1) {
        line(Array.from({ length: 17 }, (_, index) => {
          const angle = index / 16 * Math.PI * 1.35 + strand * Math.PI * 2 / 3 + p;
          return { x: player.x + Math.cos(angle) * (33 + strand * 7), y: player.y + Math.sin(angle) * (30 + strand * 8) };
        }), CYAN, 3, opacity);
      }
    } else if (active.kind === 'talisman') {
      if (preparation) rune(player, p, GOLD);
      else line([
        { x: enemy.x + 25, y: enemy.y + 150 }, { x: enemy.x - 20, y: enemy.y + 70 },
        { x: enemy.x + 17, y: enemy.y + 74 }, { x: enemy.x - 29, y: enemy.y - 21 },
      ], GOLD, 9, opacity);
    }
    if (preparation) return;
    const result = active.result!;
    if ((result.enemyDamage ?? 0) > 0 && p < 1) {
      const color = active.kind === 'art' ? CYAN : GOLD;
      ring(enemy, 16 + p * 52, color, 1 - p);
      particles(enemy, p, color);
      const recoil = Math.sin(p * Math.PI) * 7;
      options.moveEnemy({ x: direction.x * recoil, y: direction.y * recoil });
    }
    floating(damage, result.enemyDamage, enemy, active.elapsed, GOLD);
    floating(healing, result.playerHealing, player, active.elapsed, GREEN, true);
    const counterStart = 0.38;
    const counterImpact = counterStart + 0.21;
    if (result.counter && active.elapsed >= counterStart) {
      const counterProgress = clamp((active.elapsed - counterStart) / 0.48);
      const push = Math.sin(counterProgress * Math.PI) * 19;
      options.moveEnemy({ x: -direction.x * push, y: -direction.y * push });
      if (result.guarded) shield(player, 1 - counterProgress * 0.7);
      if (active.elapsed >= counterImpact - 0.03) {
        const hit = clamp((active.elapsed - counterImpact + 0.03) / 0.28);
        for (let claw = 0; claw < 3; claw += 1) {
          const dx = (claw - 1) * 22;
          line([{ x: player.x + dx - 12, y: player.y + 42 }, { x: player.x + dx - 8, y: player.y }, { x: player.x + dx + 15, y: player.y - 37 }], RED, 6, 1 - hit);
        }
        ring(player, 17 + hit * 37, result.guarded ? GOLD : RED, 1 - hit);
        if (!result.guarded) options.movePlayer({ x: -direction.x * Math.sin(hit * Math.PI) * 7, y: -direction.y * Math.sin(hit * Math.PI) * 7 });
      }
      floating(counterDamage, result.playerDamage, player, active.elapsed - counterImpact, RED);
    } else if (!result.counter) floating(counterDamage, result.playerDamage, player, active.elapsed, RED);
  }

  return {
    isPlaying: (): boolean => run !== undefined,
    start(kind: CombatEffectKind, onImpact: () => void): boolean {
      if (disposed || run !== undefined) return false;
      restore();
      run = { kind, phase: 'prepare', elapsed: 0, onImpact, counterDelivered: false };
      draw(run);
      return true;
    },
    resolve(result: CombatEffectResult, onComplete: () => void): boolean {
      if (disposed || run?.phase !== 'waiting') return false;
      run.phase = 'resolve';
      run.elapsed = 0;
      run.result = result;
      run.onComplete = onComplete;
      draw(run);
      return true;
    },
    tick(dt: number): void {
      const active = run;
      if (disposed || active === undefined) return;
      if (active.phase !== 'waiting') active.elapsed += Math.max(0, Math.min(dt, 0.1));
      if (active.phase === 'prepare' && active.elapsed >= IMPACT[active.kind]) {
        active.elapsed = IMPACT[active.kind];
        active.phase = 'waiting';
        draw(active);
        active.onImpact();
        return;
      }
      draw(active);
      if (active.phase !== 'resolve') return;
      if (active.result?.counter && !active.counterDelivered && active.elapsed >= 0.59) {
        active.counterDelivered = true;
        active.result.onCounterImpact?.();
        if (run !== active || disposed) return;
      }
      if (active.elapsed >= (active.result?.counter ? 0.92 : 0.55)) {
        run = undefined;
        restore();
        active.onComplete?.();
      }
    },
    cancel(): void { run = undefined; restore(); },
    dispose(): void { run = undefined; restore(); disposed = true; layer.destroy(); },
  };
}
