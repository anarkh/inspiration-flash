"""Evaluate a run-cycle candidate at game scale.

Usage:
  python run_eval.py <tag> <outdir> <sheet.png>:<pose,pose,...> [<sheet.png>:<poses> ...]
Pose names: "_ref" = scale reference (first pose of each sheet, dropped), "run_N" = frame N,
"skip" = drop. Uses the same cleanup / scale / pelvis-anchor rules as slice_pack.py.

Writes into <outdir>:
  <tag>-strip128.png   filmstrip at 128 px tall on the stage-floor colour, common ground line
  <tag>-onion.png      onion skin on the shared anchor (320 scale)
  <tag>-12fps.gif / <tag>-6fps.gif / <tag>-12fps.png (APNG)  in-place run over a floor that
                       scrolls at the measured runCycle speed (game scale)
  <tag>-metrics.json   head trace, planted-foot travel, runCycle estimate
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import slice_pack as sp  # noqa: E402

GAME = sp.GAME
FLOOR = (70, 78, 76, 255)
GAME_H = 128


def load_frames(specs):
    frames = {}
    for spec in specs:
        path, names = spec.rsplit(":", 1)
        names = names.split(",")
        im = sp.clean_alpha(Image.open(path).convert("RGBA"))
        crops, _ = sp.split_sheet(im, len(names))
        ref, ref_off = crops[0]
        rb = sp.opaque_bbox(ref)
        s = sp.UNIT / (rb[3] - rb[1])
        run = [(n, c) for n, c in zip(names, crops) if n.startswith("run_")]
        ground = max(off[1] + sp.opaque_bbox(c)[3] for _, (c, off) in run)  # lowest run foot
        for n, (crop, off) in run:
            sc = sp.resize_rgba(crop, s)
            fy = (ground - off[1]) * s
            fx = sp.pelvis_x(sc.getchannel("A"))
            frames[n] = {"img": sc, "foot": [fx, fy], "scale": s}
    return [frames[k] | {"name": k} for k in sorted(frames, key=lambda k: int(k.split("_")[1]))]


def head_centroid(fr):
    """Face centroid: warm skin pixels in the top 22% of the unit height of the figure."""
    im = fr["img"]
    a = im.getchannel("A")
    top = sp.opaque_bbox(im)[1]
    y1 = int(top + 0.22 * sp.UNIT)
    px = im.load()
    sx = sy = n = 0
    for y in range(top, min(y1, im.height)):
        for x in range(im.width):
            r, g, b, al = px[x, y]
            if al > 200 and r > 110 and r > g + 12 and g > b and r - b > 30:
                sx += x; sy += y; n += 1
    if not n:
        return None
    return (sx / n - fr["foot"][0], sy / n - fr["foot"][1], n)


def ground_blobs(fr, band=10, open_px=7):
    """Foot contacts: opaque runs in a thin band just above the anchor's ground line."""
    im = fr["img"]
    fy = fr["foot"][1]
    y0 = max(0, int(fy - band))
    y1 = min(im.height, int(fy + 1))
    if y1 <= y0:
        return []
    m = im.getchannel("A").crop((0, y0, im.width, y1)).point(lambda v: 255 if v > 128 else 0)
    m = m.filter(ImageFilter.MinFilter(open_px)).filter(ImageFilter.MaxFilter(open_px))
    cols = [any(m.getpixel((x, y)) for y in range(m.height)) for x in range(m.width)]
    blobs, x = [], 0
    while x < len(cols):
        if cols[x]:
            x0 = x
            while x < len(cols) and cols[x]:
                x += 1
            blobs.append((x0 - fr["foot"][0], x - 1 - fr["foot"][0]))
        else:
            x += 1
    return blobs


def strip128(frames, path):
    k = GAME_H / sp.UNIT
    left = max(f["foot"][0] for f in frames) * k + 6
    right = max(f["img"].width - f["foot"][0] for f in frames) * k + 6
    up = max(f["foot"][1] for f in frames) * k + 6
    cw, H = int(left + right), int(up + 20)
    out = Image.new("RGBA", (cw * len(frames), H), FLOOR)
    d = ImageDraw.Draw(out)
    for i, f in enumerate(frames):
        im = f["img"].convert("RGBa").resize((round(f["img"].width * k), round(f["img"].height * k)), Image.LANCZOS).convert("RGBA")
        out.alpha_composite(im, (int(i * cw + left - f["foot"][0] * k), int(up - f["foot"][1] * k)))
        d.line([(i * cw + left, up - 3), (i * cw + left, up + 3)], fill=(255, 90, 90, 255))
        d.text((i * cw + 2, H - 12), f["name"], fill=(230, 230, 230, 255))
    d.line([(0, up), (out.width, up)], fill=(120, 140, 130, 255))
    out.convert("RGB").save(path)


def onion(frames, path):
    left = max(f["foot"][0] for f in frames) + 10
    right = max(f["img"].width - f["foot"][0] for f in frames) + 10
    up = max(f["foot"][1] for f in frames) + 10
    out = Image.new("RGBA", (int(left + right), int(up + 30)), (24, 27, 30, 255))
    tints = [(255, 110, 110), (255, 190, 90), (240, 240, 100), (120, 240, 120), (100, 230, 230), (110, 150, 255), (200, 120, 255), (255, 120, 210)]
    for i, f in enumerate(frames):
        a = f["img"].getchannel("A").point(lambda v: v * 80 // 255)
        t = Image.new("RGBA", f["img"].size, tints[i % 8] + (0,))
        t.putalpha(a)
        out.alpha_composite(t, (int(left - f["foot"][0]), int(up - f["foot"][1])))
    d = ImageDraw.Draw(out)
    d.line([(0, up), (out.width, up)], fill=(120, 140, 130, 255))
    d.line([(left, up - 12), (left, up + 12)], fill=(255, 255, 255, 255))
    out.convert("RGB").save(path)


def gifs(frames, run_cycle, outdir, tag):
    k = GAME_H / sp.UNIT
    stage = Image.open(os.path.join(GAME, "prototype/action-combat-v1/assets/stage-demon-tower.jpg")).convert("RGBA")
    ss = 400 / stage.height
    st = stage.resize((round(stage.width * ss), 400), Image.LANCZOS)
    W, H = 300, 190
    ground_y = 160
    floor_top = int(528 * ss)
    band = st.crop((0, floor_top - (ground_y - 40), st.width, floor_top - (ground_y - 40) + H))
    tile = Image.new("RGBA", (band.width * 2, H))
    tile.paste(band, (0, 0))
    tile.paste(band.transpose(Image.FLIP_LEFT_RIGHT), (band.width, 0))
    step = run_cycle / len(frames) * k
    small = [f["img"].convert("RGBa").resize((round(f["img"].width * k), round(f["img"].height * k)), Image.LANCZOS).convert("RGBA") for f in frames]
    out = []
    for cyc in range(3):
        for i, f in enumerate(frames):
            t = cyc * len(frames) + i
            off = int(round(t * step)) % tile.width
            bg = tile.crop((off, 0, off + W, H)) if off + W <= tile.width else None
            if bg is None:
                bg = Image.new("RGBA", (W, H))
                bg.paste(tile.crop((off, 0, tile.width, H)), (0, 0))
                bg.paste(tile.crop((0, 0, W - (tile.width - off), H)), (tile.width - off, 0))
            fr = bg.copy()
            fr.alpha_composite(small[i], (int(110 - f["foot"][0] * k), int(ground_y - f["foot"][1] * k)))
            out.append(fr.convert("RGB"))
    for fps in (12, 6):
        dur = int(round(1000 / fps))
        out[0].save(os.path.join(outdir, f"{tag}-{fps}fps.gif"), save_all=True, append_images=out[1:], duration=dur, loop=0)
    out[0].save(os.path.join(outdir, f"{tag}-12fps.png"), save_all=True, append_images=out[1:], duration=83, loop=0)


def load_atlas_run():
    """Frames of clips.run from the packed atlas (with the final anchors) + its runCycle."""
    base = os.path.join(GAME, "prototype/action-combat-v1/assets/hero-action/")
    meta = json.load(open(base + "hero-action.json"))
    atlas = Image.open(base + "hero-action.png").convert("RGBA")
    out = []
    for n in meta["clips"]["run"]:
        f = meta["frames"][n]
        x, y, w, h = f["rect"]
        out.append({"name": n, "img": atlas.crop((x, y, x + w, y + h)), "foot": [f["foot"][0] - x, f["foot"][1] - y], "scale": 1.0})
    return out, meta.get("runCycle")


def main():
    tag, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    given_cycle = None
    if sys.argv[3] == "--atlas":
        frames, given_cycle = load_atlas_run()
    else:
        frames = load_frames(sys.argv[3:])
    n = len(frames)
    heads = [head_centroid(f) for f in frames]
    blobs = [ground_blobs(f) for f in frames]
    # Planted-foot travel per step (frames 0..3 = step A, 4..7 = step B when n == 8):
    # contact -> down -> passing track the heel (rear edge of the planted contact),
    # passing -> up track the toe (front edge). Contact frame: planted foot = front blob.
    per_interval = []
    detail = []
    steps = [range(0, 4), range(4, 8)] if n == 8 else [range(0, n)]
    for st_ in steps:
        idx = list(st_)
        planted = []
        for j, i in enumerate(idx):
            b = blobs[i]
            if not b:
                planted.append(None)
                continue
            if j == 0:
                planted.append(max(b, key=lambda z: z[1]))         # front foot = new contact
            elif j == len(idx) - 1:
                planted.append(min(b, key=lambda z: z[0]))         # push-off = rear contact
            else:
                planted.append(min(b, key=lambda z: abs((z[0] + z[1]) / 2)))  # under the body
        for j in range(len(idx) - 1):
            a, b = planted[j], planted[j + 1]
            if a is None or b is None:
                continue
            use = 1 if j == len(idx) - 2 else 0                    # toe for passing->up, heel otherwise
            d = a[use] - b[use]
            per_interval.append(d)
            detail.append({"from": frames[idx[j]]["name"], "to": frames[idx[j + 1]]["name"], "edge": "toe" if use else "heel",
                           "x_from": round(a[use], 1), "x_to": round(b[use], 1), "backward": round(d, 1)})
    speed = sum(per_interval) / len(per_interval) if per_interval else 0
    run_cycle = speed * n
    if given_cycle:
        run_cycle = given_cycle
    v = run_cycle / n
    slip = [round(d["backward"] - v, 1) for d in detail]   # planted-foot slide per interval at this speed
    hx = [h[0] for h in heads if h]
    hy = [h[1] for h in heads if h]
    metrics = {
        "frames": [f["name"] for f in frames],
        "scale": [round(f["scale"], 3) for f in frames],
        "anchorX": [round(f["foot"][0], 1) for f in frames],
        "headRel": [[round(h[0], 1), round(h[1], 1), h[2]] if h else None for h in heads],
        "headXRange": round(max(hx) - min(hx), 1) if hx else None,
        "headYRange": round(max(hy) - min(hy), 1) if hy else None,
        "groundBlobs": [[[round(a, 1), round(b, 1)] for a, b in bl] for bl in blobs],
        "plantedTravel": detail,
        "speedPerFrame": round(speed, 2),
        "runCycle": round(run_cycle, 1),
        "footSlipPerInterval": slip,
        "contactSpread": [round(max(b[1] for b in bl) - min(b[0] for b in bl), 1) if len(bl) > 1 else None for bl in blobs],
    }
    with open(os.path.join(outdir, f"{tag}-metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=1)
    strip128(frames, os.path.join(outdir, f"{tag}-strip128.png"))
    onion(frames, os.path.join(outdir, f"{tag}-onion.png"))
    gifs(frames, run_cycle, outdir, tag)
    print(tag, "headX", [h[0] if h else None for h in metrics["headRel"]], "range", metrics["headXRange"])
    print("   headY", [h[1] if h else None for h in metrics["headRel"]], "range", metrics["headYRange"])
    print("   measured speed/frame", metrics["speedPerFrame"], "runCycle used", metrics["runCycle"], "slip", slip)
    for dd in detail:
        print("  ", dd)


if __name__ == "__main__":
    main()
