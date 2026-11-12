"""Solve run-frame anchor shifts and runCycle for the 4-phase run step.

Reads the "run8" sheet spec from ../sheets.json, rebuilds run_0..run_3 exactly as
slice_pack.py does (before overrides), measures the planted foot (heel for contact->down->passing,
toe for passing->up) and solves the least-squares problem

    v + d_j - d_(j+1) = travel_j        (planted foot must not slide at constant root speed v)
    sqrt(LAMBDA) * (head step_k)  = 0   (head x relative to the anchor steps evenly, cyclic)
    0.1 * d_k = 0                       (keep shifts small)
    sum(d_k) = 0

where d_k is the per-frame anchor x shift. Writes dx overrides for run_0..run_3 into
../anchor-overrides.json and runCycle = 8 * v into ../sheets.json.
Usage: python run_solve.py [lambda]
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_eval as re_  # noqa: E402
import slice_pack as sp  # noqa: E402

LAMBDA = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
HERO = sp.HERO


def solve(A, b):
    n = len(A[0])
    M = [[sum(A[r][i] * A[r][j] for r in range(len(A))) for j in range(n)] + [sum(A[r][i] * b[r] for r in range(len(A)))] for i in range(n)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [x - f * y for x, y in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]


def main():
    cfg_path = os.path.join(HERO, "sheets.json")
    cfg = json.load(open(cfg_path, encoding="utf-8"))
    spec = cfg["sheets"]["run8"]
    im = sp.clean_alpha(Image.open(os.path.join(HERO, spec["file"])).convert("RGBA"))
    poses = spec["poses"]
    crops, _ = sp.split_sheet(im, len(poses))
    rb = sp.opaque_bbox(crops[0][0])
    s = sp.UNIT / (rb[3] - rb[1])
    used = [(n, c) for n, c in zip(poses, crops) if n.startswith("run_")]
    ground = max(off[1] + sp.opaque_bbox(c)[3] for _, (c, off) in used)
    frames = []
    for n, (c, off) in used:
        sc = sp.resize_rgba(c, s)
        frames.append({"name": n, "img": sc, "foot": [sp.pelvis_x(sc.getchannel("A")), (ground - off[1]) * s]})
    blobs = [re_.ground_blobs(f) for f in frames]
    planted = [max(blobs[0], key=lambda z: z[1]),
               min(blobs[1], key=lambda z: abs((z[0] + z[1]) / 2)),
               min(blobs[2], key=lambda z: abs((z[0] + z[1]) / 2)),
               min(blobs[3], key=lambda z: z[0])]
    travel = [planted[0][0] - planted[1][0], planted[1][0] - planted[2][0], planted[2][1] - planted[3][1]]
    print("blobs", [[(round(a, 1), round(b, 1)) for a, b in bl] for bl in blobs])
    print("planted travel per interval (heel, heel, toe):", [round(t, 1) for t in travel])
    # Head smoothness: head x relative to the anchor, h_k - d_k, should step evenly (cyclic),
    # i.e. the upper body moves at the root speed; weight LAMBDA against the foot-slip equations.
    h = [re_.head_centroid(f)[0] for f in frames]
    # unknowns: v, d0..d3
    A, b = [], []
    for j in range(3):
        row = [1.0, 0, 0, 0, 0]
        row[1 + j] += 1.0
        row[2 + j] -= 1.0
        A.append(row); b.append(travel[j])
    w = LAMBDA ** 0.5
    for k in range(4):
        n2 = (k + 1) % 4
        row = [0.0] * 5
        row[1 + n2] -= w
        row[1 + k] += w
        A.append(row); b.append(-w * (h[n2] - h[k]))
    for k in range(4):
        row = [0.0] * 5
        row[1 + k] = 0.1
        A.append(row); b.append(0.0)
    A.append([0.0] + [30.0] * 4); b.append(0.0)
    v, *d = solve(A, b)
    slip = [round(v + d[j] - d[j + 1] - travel[j], 1) for j in range(3)]
    hx = [h[k] - d[k] for k in range(4)]
    print(f"lambda {LAMBDA}: v {v:.2f} px/frame, dx {[round(x, 1) for x in d]}, residual slip {slip}, "
          f"head x rel {[round(x, 1) for x in hx]}")
    ov_path = os.path.join(HERO, "anchor-overrides.json")
    ov = json.load(open(ov_path, encoding="utf-8"))
    for k in range(4):
        ov[f"run_{k}"] = {"dx": round(d[k], 1),
                          "why": f"run_solve.py (lambda {LAMBDA}): evens the planted-foot travel to v={v:.1f} px/frame; "
                                 f"residual slip {slip} px per interval at unit 320"}
    with open(ov_path, "w", encoding="utf-8") as fh:
        json.dump(ov, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    cfg["runCycle"] = round(8 * v)
    cfg["_runCycleNote"] = (f"atlas px (unit 320) the root travels per 8-frame run loop so the planted foot does not slide: "
                            f"8 x {v:.2f} px/frame (planted-foot backward travel contact->push-off per step "
                            f"= {sum(travel):.1f} px over 3 of the 4 frame intervals, solved with run_solve.py)")
    with open(cfg_path, "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print("runCycle", cfg["runCycle"])


main()
