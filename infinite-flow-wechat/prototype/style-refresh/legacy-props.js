/* Canvas reference copies of the active geometric dungeon objects.
 * Source: cocos/assets/scripts/ui/InfiniteFlowWalkScene.ts.
 * Uses the demon_tower_1 theme, original geometry, and original color values.
 * These are visual references, not Cocos screenshots or replacement game assets.
 * `exit` is the active dungeon exit; the selected hub/transition art is not shown.
 */
(function () {
  'use strict';

  const rgba = (r, g, b, a = 255) => `rgba(${r},${g},${b},${a / 255})`;
  const GOLD = rgba(236, 195, 117);
  const TEAL = rgba(197, 168, 106);
  const RED = rgba(214, 100, 82);
  const INK = rgba(18, 15, 12);
  const EDGE = rgba(96, 82, 62);
  const theme = { wall: [72, 85, 78], accent: [152, 204, 154] };
  const tint = (rgb, brightness = 0, alpha = 255) => rgba(
    ...rgb.map(value => Math.max(0, Math.min(255, value + brightness))), alpha);

  function paint(g, fill, stroke) {
    if (fill !== undefined) { g.fillStyle = fill; g.fill(); }
    if (stroke !== undefined) { g.strokeStyle = stroke; g.stroke(); }
  }

  function rect(g, x, y, width, height, fill, stroke) {
    g.beginPath();
    g.rect(x, y, width, height);
    paint(g, fill, stroke);
  }

  function rounded(g, x, y, width, height, radius, fill) {
    g.beginPath();
    g.roundRect(x, y, width, height, radius);
    paint(g, fill);
  }

  function polygon(g, points, fill, stroke) {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) g.lineTo(x, y);
    g.closePath();
    paint(g, fill, stroke);
  }

  // The game draws 32-segment ellipses; retain those silhouettes for comparison.
  function ellipse(g, x, y, width, height, fill, stroke) {
    const points = [];
    for (let i = 0; i < 32; i += 1) {
      const angle = i * Math.PI / 16;
      points.push([x + Math.cos(angle) * width, y + Math.sin(angle) * height]);
    }
    polygon(g, points, fill, stroke);
  }

  function shadow(g) {
    ellipse(g, 0, -3, 61, 16, rgba(8, 7, 6, 112));
    ellipse(g, 0, -3, 61 * 0.63, 16 * 0.65, rgba(5, 5, 4, 70));
  }

  function drawExit(g) {
    rect(g, -61, -8, 122, 10, rgba(91, 105, 101), EDGE);
    rect(g, -54, 2, 108, 12, rgba(117, 126, 111), EDGE);
    rect(g, -46, 14, 92, 8, rgba(148, 151, 127));
    rounded(g, -39, 21, 78, 100, 35, rgba(13, 35, 41));
    ellipse(g, 0, 65, 29, 46, rgba(58, 139, 145, 140), TEAL);
    ellipse(g, 0, 65, 22, 36, rgba(83, 183, 176, 80), rgba(164, 243, 211, 185));
    rect(g, -3, 28, 6, 73, rgba(181, 248, 221, 112));
    rect(g, -54, 17, 18, 101, rgba(103, 112, 105), rgba(42, 58, 61));
    rect(g, 36, 17, 18, 101, rgba(82, 97, 94), rgba(42, 58, 61));
    rect(g, -57, 107, 114, 23, rgba(120, 130, 116), rgba(51, 70, 70));
    polygon(g, [[-61, 130], [0, 155], [61, 130]], rgba(137, 140, 122), rgba(52, 71, 73));
    polygon(g, [[0, 120], [7, 131], [0, 142], [-7, 131]], TEAL);
  }

  function drawChest(g) {
    rect(g, -38, 0, 76, 32, rgba(92, 65, 45), INK);
    rounded(g, -38, 23, 76, 24, 9, rgba(132, 91, 53));
    rect(g, -29, 0, 8, 44, rgba(183, 145, 78));
    rect(g, 21, 0, 8, 44, rgba(183, 145, 78));
    rect(g, -38, 26, 76, 5, GOLD);
    rect(g, -7, 18, 14, 16, GOLD, INK);
    rect(g, -2, 22, 4, 8, INK);
  }

  function drawRoomObject(g, kind) {
    const a = tint(theme.accent);
    if (kind === 'trap') {
      ellipse(g, 0, 9, 66, 27, rgba(84, 35, 35, 205), RED);
      for (const [x, y] of [[-38, 5], [-14, 17], [14, 4], [38, 16], [0, -5]]) {
        polygon(g, [[x - 9, y], [x, y + 38], [x + 9, y]], rgba(169, 174, 159), INK);
      }
      polygon(g, [[0, 89], [-21, 51], [21, 51]], rgba(77, 34, 29), RED);
      rect(g, -2, 61, 4, 12, GOLD);
      rect(g, -2, 55, 4, 4, GOLD);
    } else if (kind === 'event') {
      rect(g, -8, 0, 16, 62, tint(theme.wall), INK);
      rect(g, -45, 53, 90, 64, rgba(176, 153, 106), INK);
      rect(g, -48, 49, 96, 8, GOLD);
      rect(g, -48, 113, 96, 8, GOLD);
      for (let y = 66; y < 109; y += 13) rect(g, -29, y, 56, 3, tint(theme.wall, -30));
      ellipse(g, 35, 54, 12, 12, RED, GOLD);
    } else if (kind === 'survey') {
      polygon(g, [[-48, 3], [48, 3], [56, 61], [-56, 61]], tint(theme.wall, 15), EDGE);
      polygon(g, [[-51, 62], [-31, 88], [33, 82], [51, 62]], tint(theme.wall, 45), a);
      ellipse(g, -3, 80, 19, 17, undefined, a);
      rect(g, 10, 46, 8, 24, GOLD);
      rect(g, -31, 28, 39, 3, a);
      rect(g, -31, 17, 24, 3, a);
    } else if (kind === 'relic') {
      ellipse(g, 0, 7, 54, 19, tint(theme.wall), GOLD);
      rect(g, -28, 10, 56, 23, tint(theme.wall, 20), GOLD);
      for (const x of [-35, 0, 35]) {
        polygon(g, [[x, 105], [x + 14, 75], [x, 47], [x - 14, 75]], tint(theme.accent, x === 0 ? 10 : -45), GOLD);
      }
      ellipse(g, 0, 60, 63, 17, undefined, tint(theme.accent, -20, 120));
    } else if (kind === 'shrine') {
      ellipse(g, 0, 5, 54, 20, tint(theme.wall, 25), a);
      polygon(g, [[-29, 10], [-21, 69], [21, 69], [29, 10]], tint(theme.wall), a);
      ellipse(g, 0, 87, 29, 29, tint(theme.accent, -95, 180), a);
      polygon(g, [[0, 115], [10, 88], [0, 59], [-10, 88]], tint(theme.accent, 40));
      ellipse(g, 0, 87, 39, 15, undefined, a);
    } else if (kind === 'law') {
      rect(g, -48, 4, 96, 13, tint(theme.wall, 20), a);
      polygon(g, [[-36, 17], [36, 17], [30, 77], [-30, 77]], tint(theme.wall, -15), EDGE);
      polygon(g, [[-43, 76], [0, 65], [43, 76], [43, 115], [0, 104], [-43, 115]], rgba(194, 180, 138), GOLD);
      rect(g, -2, 69, 4, 39, GOLD);
      for (const y of [81, 94]) {
        rect(g, -34, y, 24, 3, tint(theme.wall));
        rect(g, 10, y, 24, 3, tint(theme.wall));
      }
    } else {
      throw new Error(`Unsupported legacy prop kind: ${kind}`);
    }
  }

  function drawDebris(g) {
    // The four active exploration footprints in walk-world.ts are 70 × 100.
    const w = 70;
    const h = 100;
    g.lineWidth = 1;
    polygon(g, [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]], rgba(8, 7, 6, 72), tint(theme.wall, 20, 180));
    for (let row = 0; row < 3; row += 1) {
      const x = row % 2 === 0 ? -w * 0.22 : w * 0.15;
      const y = 12 + row * (h - 25) / 3;
      const rw = w * (row === 1 ? 0.43 : 0.56);
      polygon(g, [[x - rw / 2, y + 5], [x - rw * 0.25, y + 24], [x + rw * 0.35, y + 26], [x + rw / 2, y + 8], [x + rw * 0.15, y]], tint(theme.wall, row * 7 - 10, 235), tint(theme.wall, 22));
      polygon(g, [[x - rw * 0.25, y + 24], [x + rw * 0.35, y + 26], [x + rw * 0.2, y + 17], [x - rw * 0.4, y + 15]], tint(theme.wall, 22, 220));
    }
  }

  window.drawLegacyProp = function drawLegacyProp(canvas, kind) {
    canvas.width = 440;
    canvas.height = 520;
    const g = canvas.getContext('2d');
    if (g === null) throw new Error('Canvas 2D is required for the legacy prop comparison.');
    // Clear transparent backing, then use the Cocos positive-up coordinate system.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(2, 0, 0, -2, 220, 464);
    g.lineWidth = 2;
    g.lineJoin = 'miter';
    if (kind === 'debris') drawDebris(g);
    else {
      shadow(g);
      if (kind === 'chest') drawChest(g);
      else if (kind === 'exit') drawExit(g);
      else drawRoomObject(g, kind);
    }
    return { width: 220, height: 260 };
  };
}());
