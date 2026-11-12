"""Measure painted side-view stages and build review previews (Pillow).

  python stage_review.py measure <tag> <image>          -> /tmp/if-action/stages/measure/<tag>.json + seam preview
  python stage_review.py mockup <chapter-id> <tag> <image> <monster-id>   -> 390x844 mock-up
  python stage_review.py contact <tag>=<image>[@lineY] ...                -> contact sheet

Floor/wall line: in each horizontal fifth, the row where the mean luminance of the K rows below
minus the K rows above is largest (search 45-78% of the height, K = 1.5% of the height).
Mock-up projection copies prototype/action-combat-v1/src/view/renderer.js (logical 390x844):
floorTop 406, band 440-640, backdrop floor share mapped onto 406..670, dim 0.9, hero 128 px tall.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageOps, ImageStat

G = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
OUT = "/tmp/if-action/stages"


def row_means(gray, x0, x1):
    strip = gray.crop((x0, 0, x1, gray.height)).resize((1, gray.height), Image.BOX)
    return list(strip.getdata())


def step_profile(r, H, k):
    ys = range(int(0.45 * H), int(0.78 * H))
    return {y: sum(r[y:y + k]) / k - sum(r[y - k:y]) / k for y in ys}


def floor_line(gray, override=None):
    """Global line = strongest dark-to-light step of the full-width row profile (45-78% of H), or
    `override` when the visual check shows the detector caught a floor stripe / wall trim instead.
    Each fifth is then refined to its own strongest step within +-4% H of the global line."""
    W, H = gray.size
    k = max(4, round(0.015 * H))
    d = step_profile(row_means(gray, 0, W), H, k)
    peaks = sorted((y for y in d if d[y] >= d.get(y - 1, -1e9) and d[y] >= d.get(y + 1, -1e9)), key=lambda y: -d[y])
    cands = []
    for y in peaks:
        if all(abs(y - c) > 0.03 * H for c, _ in cands):
            cands.append((y, round(d[y], 1)))
        if len(cands) == 3:
            break
    g = override if override is not None else cands[0][0]
    win = round(0.04 * H)
    fifths = []
    for f in range(5):
        df = step_profile(row_means(gray, W * f // 5, W * (f + 1) // 5), H, k)
        y = max((y for y in df if abs(y - g) <= win), key=lambda y: df[y])
        fifths.append((y, round(df[y], 1)))
    return g, fifths, cands


def measure(tag, path, override=None):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    g = im.convert("L")
    line, lines, cands = floor_line(g, override)
    ys = sorted(y for y, _ in lines)
    wall = ImageStat.Stat(g.crop((0, 0, W, line))).mean[0]
    floor = ImageStat.Stat(g.crop((0, line, W, H))).mean[0]
    thirds = [round(ImageStat.Stat(g.crop((W * i // 3, line, W * (i + 1) // 3, H))).mean[0], 1) for i in range(3)]
    bottom = ImageStat.Stat(g.crop((0, int(H * 0.95), W, H))).mean[0]
    e = int(W * 0.12)
    edge_std = [round(ImageStat.Stat(g.crop(b)).stddev[0], 1) for b in ((0, 0, e, line), (W - e, 0, W, line))]
    mid_std = round(ImageStat.Stat(g.crop((e, 0, W - e, line))).stddev[0], 1)
    m = {"tag": tag, "path": path, "size": [W, H], "lineY": line, "lineFrac": round(line / H, 3),
         "lineSource": "override (visual check)" if override is not None else "auto",
         "lineCandidates": cands,
         "fifths": [y for y, _ in lines], "fifthStrength": [s for _, s in lines],
         "levelSpread": ys[-1] - ys[0],
         "wallMean": round(wall, 1), "floorMean": round(floor, 1), "floorThirds": thirds, "floorBottom5pct": round(bottom, 1),
         "edgeWallStd": edge_std, "centerWallStd": mid_std}
    os.makedirs(f"{OUT}/measure", exist_ok=True)
    with open(f"{OUT}/measure/{tag}.json", "w") as fh:
        json.dump(m, fh, indent=1)
    # mirror seam preview: flip | image | flip at 1/3 scale, seams marked by short ticks at the top
    s = 3
    sm = im.resize((W // s, H // s), Image.LANCZOS)
    fl = ImageOps.mirror(sm)
    strip = Image.new("RGB", (sm.width * 3, sm.height))
    strip.paste(fl, (0, 0)); strip.paste(sm, (sm.width, 0)); strip.paste(fl, (sm.width * 2, 0))
    d = ImageDraw.Draw(strip)
    for x in (sm.width, sm.width * 2):
        d.line([(x, 0), (x, 10)], fill=(255, 60, 60))
    d.line([(0, line // s), (12, line // s)], fill=(255, 60, 60))
    os.makedirs(f"{OUT}/preview/seams", exist_ok=True)
    strip.save(f"{OUT}/preview/seams/{tag}.png")
    th = im.resize((W // 2, H // 2), Image.LANCZOS)
    td = ImageDraw.Draw(th)
    td.line([(0, line // 2), (th.width, line // 2)], fill=(255, 40, 40), width=1)
    for f, (y, _) in enumerate(lines):
        cx = (W * f // 5 + W * (f + 1) // 5) // 4
        td.ellipse([cx - 3, y // 2 - 3, cx + 3, y // 2 + 3], outline=(255, 255, 0))
    for c, _ in cands[1:]:
        td.line([(0, c // 2), (20, c // 2)], fill=(80, 200, 255), width=2)
    os.makedirs(f"{OUT}/preview/lines", exist_ok=True)
    th.save(f"{OUT}/preview/lines/{tag}.png")
    print(json.dumps({k: m[k] for k in ("tag", "size", "lineY", "lineFrac", "lineSource", "lineCandidates", "fifths", "levelSpread", "wallMean", "floorMean", "floorThirds", "floorBottom5pct", "edgeWallStd", "centerWallStd")}))
    return m


def mockup(cid, tag, path, monster):
    back = Image.open(path).convert("RGB")
    W, H = back.size
    line = json.load(open(f"{OUT}/measure/{tag}.json"))["lineY"]
    floor_px = H - line
    LW, LH = 390, 844
    floor_top, band_top, band_bottom = 406, 440, 640
    scale = (band_bottom + 30 - floor_top) / floor_px
    top = floor_top - (H - floor_px) * scale
    sw, sh = round(W * scale), round(H * scale)
    img = back.resize((sw, sh), Image.LANCZOS)
    img = Image.eval(img, lambda v: int(v * 0.9))
    flip = ImageOps.mirror(img)
    canvas = Image.new("RGBA", (LW, LH), (8, 9, 10, 255))
    cam = sw // 2 - LW // 2
    for k in range(-1, 3):
        canvas.paste(flip if k % 2 else img, (int(k * sw - cam), int(round(top))))
    bottom = int(round(top + sh))
    if bottom < LH:  # extend the floor with a mirrored copy of its bottom rows
        need = LH - bottom
        for k in range(-1, 3):
            src = (flip if k % 2 else img).crop((0, sh - need, sw, sh))
            canvas.paste(ImageOps.flip(src), (int(k * sw - cam), bottom))
    def shadow(x, y, w):
        layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([x - w / 2, y - w * 0.12, x + w / 2, y + w * 0.12], fill=(0, 0, 0, 90))
        canvas.alpha_composite(layer)

    # hero idle_0
    A = f"{G}/prototype/action-combat-v1/assets/hero-action/"
    meta = json.load(open(A + "hero-action.json"))
    atlas = Image.open(A + "hero-action.png").convert("RGBA")
    f = meta["frames"]["idle_0"]
    x, y, w, h = f["rect"]
    hero = atlas.crop((x, y, x + w, y + h))
    hs = 128 / meta["unitHeight"] * (1 + 0.08 * (110 / 200 - 0.5))
    hero = hero.resize((round(w * hs), round(h * hs)), Image.LANCZOS)
    hx, hy = 120, band_top + 110
    shadow(hx, hy, 70)
    canvas.alpha_composite(hero, (int(hx - (f["foot"][0] - x) * hs), int(hy - (f["foot"][1] - y) * hs)))
    # monster (first of the chapter), 140 px tall, facing the hero
    mon = Image.open(f"{G}/cocos/assets/resources/monster-world/{monster.replace('_', '-')}-world-v1.png").convert("RGBA")
    mon = mon.crop(mon.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())
    ms = 140 * (1 + 0.08 * (80 / 200 - 0.5)) / mon.height
    mon = ImageOps.mirror(mon.resize((round(mon.width * ms), round(mon.height * ms)), Image.LANCZOS))
    mx, my = 280, band_top + 80
    shadow(mx, my, 80)
    canvas.alpha_composite(mon, (int(mx - mon.width / 2), int(my - mon.height)))
    # HUD and control zones (translucent dark bands, for proportion only)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rectangle([0, 0, LW, 64], fill=(0, 0, 0, 150))
    ld.rectangle([0, LH - 198, LW, LH], fill=(0, 0, 0, 110))
    canvas.alpha_composite(layer)
    ImageDraw.Draw(canvas).text((8, 8), f"{cid}  line {line}/{H}", fill=(230, 230, 230, 255))
    os.makedirs(f"{OUT}/preview/mockups", exist_ok=True)
    out = f"{OUT}/preview/mockups/{tag}.png"
    canvas.convert("RGB").save(out)
    print(out)


def contact(items):
    cells = []
    for it in items:
        tag, rest = it.split("=", 1)
        path, _, line = rest.partition("@")
        im = Image.open(path).convert("RGB")
        im = im.resize((560, round(im.height * 560 / im.width)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        if line:
            ly = round(int(line) * 560 / Image.open(path).width)
            d.line([(0, ly), (14, ly)], fill=(255, 60, 60), width=2)
            d.line([(546, ly), (560, ly)], fill=(255, 60, 60), width=2)
        d.rectangle([0, 0, 250, 16], fill=(0, 0, 0))
        d.text((4, 3), tag, fill=(255, 255, 255))
        cells.append(im)
    cols = 4
    ch = max(c.height for c in cells)
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 564, rows * (ch + 4)), (0, 0, 0))
    for i, c in enumerate(cells):
        sheet.paste(c, ((i % cols) * 564, (i // cols) * (ch + 4)))
    os.makedirs(f"{OUT}/preview", exist_ok=True)
    sheet.save(f"{OUT}/preview/contact-sheet.png")
    print(f"{OUT}/preview/contact-sheet.png", sheet.size)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "measure":
        measure(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else None)
    elif cmd == "mockup":
        mockup(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    elif cmd == "contact":
        contact(sys.argv[2:])
