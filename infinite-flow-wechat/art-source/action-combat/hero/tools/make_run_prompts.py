"""Write the run-cycle v2 prompt files into ../prompts/.

C1  run8-row      : one row, scale reference + 8-frame run cycle (9 figures)
C2  run8-half-a   : scale reference + frames 1-4
    run8-half-b   : scale reference + frames 5-8, with half A passed as a second reference
C3  run8-tworow   : two rows (reference + frames 1-4 / frames 5-8)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "prompts")

IDENTITY = ("Input image: Image 1 = the master character design. Every figure must be exactly this character: same face, "
            "long black hair in a high ponytail with a teal ribbon, dark teal scarf with two long tails, charcoal-slate layered "
            "robe over an ivory under-robe, ornate bronze shoulder guard on his left shoulder, brown leather chest strap, belt "
            "with pouches and bracers, dark trousers, tall brown boots, and the same straight jian sword (bright polished steel "
            "blade, bronze guard, teal tassel) - same costume, colors, proportions and painterly rendering.")

RUN_RULES = """Run cycle rules - a compact, quick, athletic combat run (not a long-jump sprint), drawn like a classic looping side-view run cycle sprite sheet:
- The UPPER BODY IS NEARLY IDENTICAL IN EVERY RUN FRAME: the same forward lean of about 15-20 degrees, the same head angle looking straight ahead, the sword carried low and back in the trailing RIGHT hand at the same angle in every frame (blade pointing back and down behind him), the free LEFT fist pumping only slightly in front of the chest; scarf tails and ponytail stream straight back with only a gentle wave from frame to frame; the same robe and scarf shapes. Only the legs and a small vertical bob change between frames.
- Vertical bob: the body is lowest on the two DOWN frames and highest on the two UP frames - a difference of only a few percent of body height.
- Stride: at contact the two feet are about 0.6 of his standing height apart.
- Legs must be distinguishable: the NEAR leg (closer to the viewer) is drawn in front of the robe panel and slightly lighter; the FAR leg is behind, darker and partly hidden by the robe."""

PHASES = {
    1: "contact A: NEAR leg forward with the heel striking the ground, knee almost straight; FAR leg extended back with its toes pushing off.",
    2: "down A: weight on the NEAR leg, knee bent, body at its lowest; FAR foot lifting up behind.",
    3: "passing A: NEAR leg vertical under the body; FAR leg swinging through under the body, knee forward, its foot passing the support ankle.",
    4: "up A: pushing off from the NEAR foot's toes, body at its highest, FAR knee driving forward and up.",
    5: "contact B: FAR leg forward with the heel striking the ground; NEAR leg extended back with its toes pushing off (legs swapped from contact A).",
    6: "down B: weight on the FAR leg, knee bent, body at its lowest; NEAR foot lifting up behind.",
    7: "passing B: FAR leg vertical under the body; NEAR leg swinging through under the body, knee forward.",
    8: "up B: pushing off from the FAR foot's toes, body at its highest, NEAR knee driving forward and up.",
}

REF = "Scale reference: exactly the master combat-idle stance of Image 1 (low wide stance, sword extended forward and slightly down), at the same scale as the run frames."

FOOTER = """Style/medium: hand-painted dark-fantasy game character art matching Image 1 exactly; adult proportions.
Background: real transparency everywhere outside the figures. No ground, floor, cast shadows, motion lines, speed lines, dust, afterimages, glow, extra characters, text, numbers, labels, frames or borders."""


def head(n_desc, canvas):
    return (f"Use case: stylized-concept\nAsset type: 8-frame run cycle sprite sheet for a side-scrolling beat-'em-up game; "
            f"transparent RGBA PNG; {canvas}.\n{IDENTITY}\n")


def write(name, text):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + ".prompt.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    print(p)


def main():
    # C1: one row of 9
    t = head(9, "very wide landscape canvas (about 3:1)")
    t += ("Layout (strict): ONE horizontal row of exactly 9 full-body figures of this same character in 9 equal-width columns, "
          "all FACING RIGHT, all at exactly the same scale. Figure 1 is the scale reference; figures 2-9 are the 8 frames of ONE "
          "run cycle in temporal order (the cycle loops from figure 9 back to figure 2). Clear transparent gaps between neighbours - "
          "no limb, sword, scarf or hair touches or overlaps a neighbour. The standing height of figure 1 is about 33% of the canvas "
          "height. All feet rest on one common invisible ground line at about 85% of the canvas height (the two UP frames are "
          "slightly above it). Nothing cropped.\n")
    t += f"Figure 1 - {REF}\n" + RUN_RULES + "\nRun frames:\n"
    t += "".join(f"Figure {i + 1} - frame {i}, {PHASES[i]}\n" for i in range(1, 9)) + FOOTER + "\n"
    write("run8-row-v1", t)

    # C2: halves
    for half, rng in (("a", range(1, 5)), ("b", range(5, 9))):
        t = head(5, "very wide landscape canvas (about 3:1)")
        if half == "b":
            t += ("Image 2 = the first half (frames 1-4) of this same run cycle, already approved. Match Image 2 exactly in scale, "
                  "forward lean, head angle, sword angle, free arm, scarf, ponytail and robe shapes - only the legs differ, because "
                  "these are the swapped-leg frames 5-8 that follow its frame 4.\n")
        t += ("Layout (strict): ONE horizontal row of exactly 5 full-body figures of this same character in 5 equal-width columns, "
              "all FACING RIGHT, all at exactly the same scale. Figure 1 is the scale reference; figures 2-5 are "
              f"frames {rng.start}-{rng.stop - 1} of an 8-frame run cycle in temporal order. Wide transparent gaps between neighbours - "
              "nothing touches or overlaps. The standing height of figure 1 is about 45% of the canvas height. All feet rest on one "
              "common invisible ground line at about 85% of the canvas height (UP frames slightly above it). Nothing cropped.\n")
        t += f"Figure 1 - {REF}\n" + RUN_RULES + "\nRun frames:\n"
        t += "".join(f"Figure {j + 2} - frame {i}, {PHASES[i]}\n" for j, i in enumerate(rng)) + FOOTER + "\n"
        write(f"run8-half-{half}-v1", t)

    # C3: two rows
    t = head(9, "landscape canvas (about 3:2)")
    t += ("Layout (strict): TWO rows of full-body figures of this same character, all FACING RIGHT, all at exactly the same scale. "
          "Top row: 5 figures in 5 equal-width columns - figure 1 is the scale reference, then frames 1-4 of an 8-frame run cycle. "
          "Bottom row: 4 figures - frames 5-8, each placed directly below frames 1-4. Clear transparent gaps between all figures - "
          "nothing touches or overlaps, also between the rows. Standing height of figure 1 about 30% of the canvas height. "
          "Top-row feet on an invisible ground line at about 44% of the canvas height, bottom-row feet on one at about 92% "
          "(UP frames slightly above their line). Nothing cropped.\n")
    t += f"Figure 1 (top row, first) - {REF}\n" + RUN_RULES + "\nRun frames (the cycle loops from frame 8 back to frame 1):\n"
    t += "".join(f"Frame {i} ({'top' if i <= 4 else 'bottom'} row) - {PHASES[i]}\n" for i in range(1, 9)) + FOOTER + "\n"
    write("run8-tworow-v1", t)


main()
