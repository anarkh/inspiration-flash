"""Slice generated hero pose sheets, normalise scale, set foot anchors, pack the atlas.

Usage (Pillow required):
  python slice_pack.py [--preview-dir DIR]

Inputs (relative to art-source/action-combat/hero/):
  sheets.json            sheet -> {"file": original PNG, "poses": [names...]}; "_ref" marks the
                         per-sheet scale-reference pose that is dropped (the idle sheet keeps it
                         as idle_0 by naming it).
  anchor-overrides.json  frame -> {"dx": px, "x": px, "dy": px, "tip": [x, y]} in final
                         frame-local pixels (after scaling, relative to the trimmed frame).
Outputs:
  prototype/action-combat-v1/assets/hero-action/hero-action.png + hero-action.json
  tools/slice-report.json (per-frame measurements)
  preview images (filmstrips, onion skins, contact sheet) into --preview-dir.
"""
import argparse
import json
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
HERO = os.path.dirname(HERE)
GAME = os.path.abspath(os.path.join(HERO, "..", "..", ".."))
OUT_DIR = os.path.join(GAME, "prototype", "action-combat-v1", "assets", "hero-action")

UNIT = 320                # reference standing height in final pixels
ALPHA_ZERO = 8            # alpha <= this is generator noise -> 0
ALPHA_SNAP = 248          # alpha >= this -> 255 (generator writes ~250-254 inside the body)
MASK_T = 24               # alpha threshold for segmentation
DS = 2                    # segmentation downsample factor
PAD = 2                   # atlas padding
MAX_ATLAS = 2048

CLIPS = {
    "idle": 2, "run": 8, "attack1": 3, "attack2": 3, "attack3": 4, "dodge": 2,
    "hurt": 1, "down": 1, "getup": 1, "skill": 4, "spell": 2, "item": 2,
}
STRIKE_TIP = {  # frame -> direction used to auto-locate the sword tip (refined by overrides)
    "attack1_1": (1, 0), "attack2_1": (1, -1), "attack3_2": (1, 1), "skill_2": (1, 0),
}


def clean_alpha(im):
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v <= ALPHA_ZERO else (255 if v >= ALPHA_SNAP else v))
    return Image.merge("RGBA", (r, g, b, a))


def components(mask):
    """8-connected components of a binary L image via run-length union-find."""
    w, h = mask.size
    px = mask.tobytes()
    parent = []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    runs_prev = []
    all_runs = []
    for y in range(h):
        row = px[y * w:(y + 1) * w]
        runs = []
        x = 0
        while x < w:
            if row[x]:
                x0 = x
                while x < w and row[x]:
                    x += 1
                lab = len(parent)
                parent.append(lab)
                for (px0, px1, plab) in runs_prev:
                    if px0 <= x and px1 >= x0 - 1:  # 8-connectivity overlap
                        ra, rb = find(lab), find(plab)
                        if ra != rb:
                            parent[max(ra, rb)] = min(ra, rb)
                runs.append((x0, x - 1, lab))
            else:
                x += 1
        all_runs.append(runs)
        runs_prev = runs
    comps = {}
    for y, runs in enumerate(all_runs):
        for (x0, x1, lab) in runs:
            r = find(lab)
            c = comps.setdefault(r, {"area": 0, "bbox": [x0, y, x1, y], "runs": []})
            c["area"] += x1 - x0 + 1
            bb = c["bbox"]
            bb[0] = min(bb[0], x0); bb[1] = min(bb[1], y); bb[2] = max(bb[2], x1); bb[3] = max(bb[3], y)
            c["runs"].append((y, x0, x1))
    return list(comps.values())


def bbox_gap(a, b):
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3]))
    return (dx * dx + dy * dy) ** 0.5


def order_groups(groups, rows):
    def centre(g, i):
        tot = sum(s["area"] for s in g)
        return sum((s["bbox"][i] + s["bbox"][i + 2]) / 2 * s["area"] for s in g) / tot
    if rows == 1:
        return sorted(groups, key=lambda g: centre(g, 0))
    by_y = sorted(groups, key=lambda g: centre(g, 1))
    ys = [centre(g, 1) for g in by_y]
    cuts = sorted(range(1, len(ys)), key=lambda i: ys[i] - ys[i - 1], reverse=True)[:rows - 1]
    out, start = [], 0
    for c in sorted(cuts) + [len(by_y)]:
        out.extend(sorted(by_y[start:c], key=lambda g: centre(g, 0)))
        start = c
    return out


def split_sheet(im, n, rows=1):
    """Return n RGBA crops with their sheet offsets, row by row, left to right."""
    w, h = im.size
    a = im.getchannel("A")
    small = a.resize((w // DS, h // DS), Image.BOX).point(lambda v: 255 if v > MASK_T else 0)
    comps = components(small)
    comps.sort(key=lambda c: -c["area"])
    if len(comps) < n:
        raise SystemExit(f"only {len(comps)} components, expected {n}")
    seeds = comps[:n]
    if seeds[-1]["area"] < 0.2 * seeds[0]["area"]:
        print(f"  WARNING: smallest seed area {seeds[-1]['area']} vs largest {seeds[0]['area']} - poses may be touching")
    groups = [[s] for s in seeds]
    merged = []
    for c in comps[n:]:
        k = min(range(n), key=lambda i: min(bbox_gap(c["bbox"], s["bbox"]) for s in groups[i]))
        groups[k].append(c)
        merged.append((c["area"], k))
    groups = order_groups(groups, rows)
    crops = []
    for g in groups:
        lab = Image.new("L", small.size, 0)
        d = ImageDraw.Draw(lab)
        for c in g:
            for (y, x0, x1) in c["runs"]:
                d.line([(x0, y), (x1, y)], fill=255)
        lab = lab.filter(ImageFilter.MaxFilter(3))  # dilate 1 px to keep soft edges
        full = lab.resize((w, h), Image.NEAREST)
        bb = full.getbbox()
        piece = im.crop(bb)
        m = full.crop(bb)
        pa = ImageChops.multiply(piece.getchannel("A"), m)
        piece.putalpha(pa)
        tb = pa.getbbox()
        crops.append((piece.crop(tb), (bb[0] + tb[0], bb[1] + tb[1])))
    small_merges = sum(1 for _ in merged)
    return crops, small_merges


def opaque_bbox(im, t=128):
    return im.getchannel("A").point(lambda v: 255 if v > t else 0).getbbox()


def resize_rgba(im, s):
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    return im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")


def support_x(mask_l, ground_y, band, open_px):
    """x of the support point: centre between the outer feet in a band above ground_y.

    Thin features (sword blade, scarf strands) are removed by a morphological opening."""
    w, h = mask_l.size
    y0 = max(0, int(ground_y - band))
    y1 = min(h, int(ground_y + 2))
    if y1 <= y0:
        return None
    region = mask_l.crop((0, y0, w, y1)).point(lambda v: 255 if v > 128 else 0)
    k = max(3, open_px | 1)
    region = region.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    bb = region.getbbox()
    if not bb:
        return None
    return (bb[0] + bb[2]) / 2.0


def pelvis_x(mask_l, k=21, band=(0.45, 0.65)):
    """x under the pelvis: centre of mass of the thick body (eroded by k px so the sword,
    scarf strands, arms and thin hair drop out) in the belt-to-crotch band of the figure."""
    w, h = mask_l.size
    bb = mask_l.point(lambda v: 255 if v > 128 else 0).getbbox()
    top, bottom = bb[1], bb[3]
    m = mask_l.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(k))
    y0 = int(top + band[0] * (bottom - top))
    y1 = int(top + band[1] * (bottom - top))
    region = m.crop((0, y0, w, y1))
    data = region.tobytes()
    rw = region.width
    tot = sx = 0
    for i, v in enumerate(data):
        if v:
            tot += 1
            sx += i % rw
    return sx / tot if tot else (bb[0] + bb[2]) / 2.0


# Anchor x source per clip: "feet" = centre between the outer feet on the ground line
# (both feet planted, e.g. idle), "pelvis" = under the pelvis (moving / single support).
ANCHOR_MODE = {"idle": "feet", "spell": "feet", "item": "feet"}


def tip_point(im, direction):
    a = im.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    w, h = a.size
    data = a.tobytes()
    dx, dy = direction
    best, bp = None, None
    for i, v in enumerate(data):
        if v:
            x, y = i % w, i // w
            s = dx * x + dy * y
            if best is None or s > best:
                best, bp = s, (x, y)
    return bp


def build(preview_dir):
    cfg = json.load(open(os.path.join(HERO, "sheets.json"), encoding="utf-8"))
    sheets = cfg["sheets"]
    ov_path = os.path.join(HERO, "anchor-overrides.json")
    overrides = json.load(open(ov_path, encoding="utf-8")) if os.path.exists(ov_path) else {}
    overrides = {k: v for k, v in overrides.items() if not k.startswith("_")}
    frames = {}
    report = {"sheets": {}, "frames": {}}
    for sname, spec in sheets.items():
        src = os.path.join(HERO, spec["file"])
        im = clean_alpha(Image.open(src).convert("RGBA"))
        poses = spec["poses"]
        rows = spec.get("rows", 1)
        crops, merges = split_sheet(im, len(poses), rows)
        ref, ref_off = crops[0]
        rb = opaque_bbox(ref)
        ref_h = rb[3] - rb[1]
        ground = ref_off[1] + rb[3]                       # sheet y of the common ground line
        s = UNIT / ref_h
        # "row-max": each row's ground line is the lowest opaque pixel of its non-reference
        # poses (run sheets, where contact/down frames touch the ground); default = reference feet.
        row_ground = {}
        if spec.get("ground") == "row-max":
            per_row = len(poses) // rows if rows > 1 else len(poses)
            for i, (name, (crop, off)) in enumerate(zip(poses, crops)):
                if name in ("_ref", "skip"):
                    continue
                r = i // per_row if rows > 1 else 0
                ob = opaque_bbox(crop)
                row_ground[r] = max(row_ground.get(r, 0), off[1] + ob[3])
        report["sheets"][sname] = {"file": spec["file"], "size": list(im.size), "refHeightPx": ref_h,
                                   "scale": round(s, 4), "groundY": ground, "mergedFragments": merges,
                                   "rowGround": row_ground or None}
        print(f"{sname}: size {im.size} ref_h {ref_h} scale {s:.3f} ground {ground} rows {row_ground} merged {merges}")
        per_row = len(poses) // rows if rows > 1 else len(poses)
        for i, (name, (crop, off)) in enumerate(zip(poses, crops)):
            if name in ("_ref", "skip"):
                continue
            if row_ground:
                ground = row_ground[i // per_row if rows > 1 else 0]
            ob = opaque_bbox(crop)
            bottom_gap = ground - (off[1] + ob[3])         # >0: lowest opaque pixel above ground
            sc = resize_rgba(crop, s)
            fy = (ground - off[1]) * s                      # ground line in frame-local px
            mask = sc.getchannel("A")
            feet = support_x(mask, fy, band=0.07 * UNIT, open_px=int(0.035 * UNIT))
            pelvis = pelvis_x(mask)
            clip = name.rsplit("_", 1)[0]
            method = ANCHOR_MODE.get(clip, "pelvis")
            if method == "feet" and (feet is None or bottom_gap * s > 0.05 * UNIT):
                method = "pelvis"
            fx = feet if method == "feet" else pelvis
            o = overrides.get(name, {})
            auto = (round(fx, 1), round(fy, 1))
            if "x" in o:
                fx = o["x"]; method = "override-x"
            if "dx" in o:
                fx += o["dx"]; method += "+dx"
            if "dy" in o:
                fy += o["dy"]
            if "y" in o:
                fy = o["y"]
            tip = None
            if "tip" in o:
                tip = tuple(o["tip"])
            elif name in STRIKE_TIP:
                tip = tip_point(sc, STRIKE_TIP[name])
            frames[name] = {"img": sc, "foot": (fx, fy), "tip": tip, "feet": feet, "pelvis": pelvis}
            report["frames"][name] = {"sheet": sname, "method": method, "autoFoot": auto,
                                      "feetX": round(feet, 1) if feet is not None else None,
                                      "pelvisX": round(pelvis, 1),
                                      "foot": [round(fx, 1), round(fy, 1)], "size": list(sc.size),
                                      "bottomAboveGroundPx": round(bottom_gap * s, 1),
                                      "tip": list(tip) if tip else None}
    # Aliases: frames that reuse another frame's art and anchor (stored once in the atlas).
    aliases = cfg.get("aliases", {})
    for a, target in aliases.items():
        frames[a] = frames[target]
        report["frames"][a] = {"aliasOf": target}
    missing = [f"{c}_{i}" for c, n in CLIPS.items() for i in range(n) if f"{c}_{i}" not in frames]
    if missing:
        raise SystemExit(f"missing frames: {missing}")
    atlas, rects = pack({k: v for k, v in frames.items() if k not in aliases})
    for a, target in aliases.items():
        rects[a] = rects[target]
    os.makedirs(OUT_DIR, exist_ok=True)
    atlas_path = os.path.join(OUT_DIR, "hero-action.png")
    atlas.save(atlas_path, optimize=True)
    out = {"image": "hero-action.png", "size": list(atlas.size), "unitHeight": UNIT}
    if "runCycle" in cfg:
        out["runCycle"] = cfg["runCycle"]
    out["frames"] = {}
    out["clips"] = {}
    for c, n in CLIPS.items():
        for i in range(n):
            name = f"{c}_{i}"
            x, y = rects[name]
            f = frames[name]
            e = {"rect": [x, y, f["img"].width, f["img"].height],
                 "foot": [x + half_up(f["foot"][0]), y + half_up(f["foot"][1])]}
            if f["tip"]:
                e["tip"] = [x + half_up(f["tip"][0]), y + half_up(f["tip"][1])]
            out["frames"][name] = e
        out["clips"][c] = [f"{c}_{i}" for i in range(n)]
    with open(os.path.join(OUT_DIR, "hero-action.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
        fh.write("\n")
    report["atlas"] = {"size": list(atlas.size), "bytes": os.path.getsize(atlas_path)}
    with open(os.path.join(HERE, "slice-report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")
    print("atlas", atlas.size, os.path.getsize(atlas_path), "bytes")
    if preview_dir:
        previews(frames, preview_dir)


def half_up(v):
    """Frame-local rounding independent of where the frame lands in the atlas."""
    return int(math.floor(v + 0.5))


def pack(frames):
    items = sorted(frames.items(), key=lambda kv: (-kv[1]["img"].height, -kv[1]["img"].width))
    total = sum((f["img"].width + PAD) * (f["img"].height + PAD) for _, f in items)
    best = None
    for width in range(1024, MAX_ATLAS + 1, 64):
        x = y = shelf_h = 0
        rects = {}
        used_w = 0
        ok = True
        for name, f in items:
            w, h = f["img"].width + PAD, f["img"].height + PAD
            if w > width:
                ok = False
                break
            if x + w > width:
                y += shelf_h
                x = shelf_h = 0
            rects[name] = (x + PAD, y + PAD)
            x += w
            used_w = max(used_w, x)
            shelf_h = max(shelf_h, h)
        hgt = y + shelf_h + PAD
        if not ok or hgt > MAX_ATLAS:
            continue
        area = (used_w + PAD) * hgt
        if best is None or area < best[0]:
            best = (area, used_w + PAD, hgt, rects)
    if best is None:
        raise SystemExit(f"frames do not fit in {MAX_ATLAS}x{MAX_ATLAS} (total area {total})")
    _, W, H, rects = best
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for name, (x, y) in rects.items():
        atlas.alpha_composite(frames[name]["img"], (x, y))
    return atlas, rects


BG = (24, 27, 30, 255)


def cross(d, x, y, col=(255, 80, 80, 255), r=7):
    d.line([(x - r, y), (x + r, y)], fill=col, width=1)
    d.line([(x, y - r), (x, y + r)], fill=col, width=1)


def previews(frames, pdir):
    os.makedirs(pdir, exist_ok=True)
    # Common layout: every frame placed so its foot sits on ground line GY at its own cell centre.
    up = int(max(f["foot"][1] for f in frames.values()) + 12)
    down = int(max(f["img"].height - f["foot"][1] for f in frames.values()) + 40)
    cells = []
    for c, n in CLIPS.items():
        names = [f"{c}_{i}" for i in range(n)]
        left = max(frames[k]["foot"][0] for k in names) + 10
        right = max(frames[k]["img"].width - frames[k]["foot"][0] for k in names) + 10
        cw = int(left + right)
        strip = Image.new("RGBA", (cw * n, up + down), BG)
        d = ImageDraw.Draw(strip)
        d.line([(0, up), (strip.width, up)], fill=(90, 110, 100, 255))
        for i, k in enumerate(names):
            f = frames[k]
            ox = int(i * cw + left - f["foot"][0])
            oy = int(up - f["foot"][1])
            strip.alpha_composite(f["img"], (ox, oy))
            # x ruler every 20 px relative to the anchor, for reading anchor fixes by eye
            for t in range(-200, 201, 20):
                tx = i * cw + left + t
                d.line([(tx, up + 4), (tx, up + (12 if t % 100 == 0 else 7))], fill=(110, 120, 120, 255))
            if f["feet"] is not None:
                d.line([(ox + f["feet"], up + 14), (ox + f["feet"], up + 24)], fill=(255, 210, 80, 255), width=2)
            d.line([(ox + f["pelvis"], up + 14), (ox + f["pelvis"], up + 24)], fill=(120, 220, 120, 255), width=2)
            cross(d, i * cw + left, up)
            if f["tip"]:
                cross(d, ox + f["tip"][0], oy + f["tip"][1], col=(80, 200, 255, 255), r=6)
            d.text((i * cw + 4, 4), k, fill=(200, 200, 200, 255))
            if i:
                d.line([(i * cw, 0), (i * cw, strip.height)], fill=(50, 55, 60, 255))
        strip.convert("RGB").save(os.path.join(pdir, f"filmstrip-{c}.png"))
        # Onion skin: all frames on the same foot point.
        on = Image.new("RGBA", (cw, up + down), BG)
        tints = [(255, 120, 120), (120, 255, 140), (120, 160, 255), (255, 220, 100), (220, 120, 255), (120, 240, 240)]
        for i, k in enumerate(names):
            f = frames[k]
            img = f["img"]
            a = img.getchannel("A").point(lambda v: v * 110 // 255)
            tint = Image.new("RGBA", img.size, tints[i % len(tints)] + (0,))
            tint.putalpha(a)
            on.alpha_composite(tint, (int(left - f["foot"][0]), int(up - f["foot"][1])))
        d2 = ImageDraw.Draw(on)
        d2.line([(0, up), (on.width, up)], fill=(90, 110, 100, 255))
        cross(d2, int(left), up, col=(255, 255, 255, 255), r=10)
        d2.text((4, 4), f"{c} onion: " + " ".join(f"{i}" for i in range(n)), fill=(220, 220, 220, 255))
        on.convert("RGB").save(os.path.join(pdir, f"onion-{c}.png"))
        cells.append(strip)
    W = max(s.width for s in cells)
    sheet = Image.new("RGBA", (W, sum(s.height for s in cells)), BG)
    y = 0
    for s in cells:
        sheet.alpha_composite(s, (0, y))
        y += s.height
    sheet.convert("RGB").save(os.path.join(pdir, "contact-sheet.png"))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview-dir", default="/tmp/if-action/hero/preview")
    args = ap.parse_args()
    build(args.preview_dir)
