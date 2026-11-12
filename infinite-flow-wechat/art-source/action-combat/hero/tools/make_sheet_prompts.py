"""Write one prompt file per pose sheet into ../prompts/<sheet>-v<rev>.prompt.txt.

Every sheet starts with the master combat-idle reference pose (scale reference).
Usage: python3 make_sheet_prompts.py [rev]
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "prompts")
REV = sys.argv[1] if len(sys.argv) > 1 else "1"

HEADER = """Use case: stylized-concept
Asset type: animation pose sheet (one sprite row) for a side-scrolling beat-'em-up game; transparent RGBA PNG; very wide landscape canvas (about 3:1).
Input image: Image 1 = the master character design. Every pose must be exactly this character: same face, long black hair in a high ponytail with a teal ribbon, dark teal scarf with two long tails, charcoal-slate layered robe over an ivory under-robe, ornate bronze shoulder guard on his left shoulder, brown leather chest strap, belt with pouches and bracers, dark trousers, tall brown boots, and the same straight jian sword (bright polished steel blade, bronze guard, teal tassel) - same costume, colors, proportions and painterly rendering. He holds the sword in his RIGHT hand unless a pose says both hands.
Layout (strict): ONE horizontal row of {n} full-body poses of this same character, read left to right in temporal order, all FACING RIGHT. Each pose is centered in its own equal-width column with wide empty transparent gaps between neighbours - no limb, sword, scarf, hair or robe of one pose may touch, overlap or cross into a neighbouring column. All poses at exactly the same scale (same head size, same sword length); the standing height of pose 1 is about 45% of the canvas height. All feet rest on one common invisible horizontal ground line at about 85% of the canvas height (airborne poses float above that line; lying or kneeling poses rest on it). Nothing cropped by the canvas edges.
Poses (left to right):
1. Scale reference: exactly the master combat-idle stance of Image 1 - low wide stance, knees bent, sword extended forward and slightly down in the right hand, left hand raised in a guard, scarf tails and ponytail trailing back. Same scale as all other poses.
"""

FOOTER = """Motion quality: genuinely dynamic animation key poses - big, clearly readable differences between poses, torso rotation, weight shift, deep knee bends, scarf tails, ponytail and robe hem reacting to the motion. Silhouettes must read clearly at small size. Not stiff, not posed like a statue.
Style/medium: hand-painted dark-fantasy game character art matching Image 1 exactly; adult proportions.
Background: real transparency everywhere outside the figures. No ground, floor, cast shadows, slash trails, motion lines, speed lines, glow, sparks, dust, afterimages, extra characters, text, numbers, labels, frames or borders.
"""

SHEETS = {
    "idle-spell": [
        "idle_1 - breathing out: the same stance as pose 1 with only a subtle change - shoulders and chest slightly lowered, knees a touch deeper (body about 2% lower), sword tip dipped slightly, scarf tails and ponytail settled a little lower. Feet in exactly the same place as pose 1.",
        "spell_0 - gather: compact grounded stance, the sword lowered and held down and back at his right side with the blade pointing down behind him; his free LEFT hand raised in front of his chest forming a two-finger sword-seal (index and middle fingers extended together, other fingers curled); head slightly bowed in concentration.",
        "spell_1 - release: stepping forward into a lunge, the LEFT arm thrust straight forward at shoulder height with the two-finger sword-seal pointing right, arm fully extended; sword held back low behind him in the right hand; torso leaning forward; scarf tails flung back.",
    ],
    "item-dodge": [
        "item_0 - raise: upright relaxed stance, sword lowered at his right side with the blade pointing down and back, LEFT hand raised to his mouth holding a small round dark pill between two fingers.",
        "item_1 - consume: same stance, head tilted far back swallowing, eyes closed, chest out, left hand just leaving the mouth.",
        "dodge_0 - launch: explosive dash start toward the right, very low: rear leg fully extended pushing off, front knee deeply bent, the whole body stretched into one long diagonal line leaning far forward, sword held back low and close to the body, scarf and ponytail streaming back.",
        "dodge_1 - mid-dash: the lowest point of the dash, body almost horizontal, gliding forward close to the ground with legs trailing behind, sword tucked along the body, scarf tails trailing straight back horizontally.",
    ],
    "run-a": [
        "run_0 - contact: running fast to the right, torso leaning forward about 20 degrees, LEFT leg reaching forward with the heel striking the ground, RIGHT leg extended behind; sword carried low and back in the right hand with the blade pointing backward along his side; left arm swung back; scarf tails and ponytail streaming back.",
        "run_1 - down: the lowest point of the stride, LEFT knee bent absorbing the weight under the body, RIGHT foot lifting off behind, torso leaning forward, sword still carried low and back.",
        "run_2 - passing: body at its highest, LEFT leg vertical under the body pushing off, RIGHT knee driving forward and up past it, left arm swinging forward, sword carried low and back, scarf streaming.",
    ],
    "run-b": [
        "run_3 - contact: the opposite half of the same run cycle - RIGHT leg reaching forward with the heel striking the ground, LEFT leg extended behind; torso leaning forward about 20 degrees; sword carried low and back in the right hand with the blade pointing backward; left arm swung forward; scarf tails and ponytail streaming back.",
        "run_4 - down: the lowest point of the stride, RIGHT knee bent absorbing the weight under the body, LEFT foot lifting off behind, torso leaning forward, sword still carried low and back.",
        "run_5 - passing: body at its highest, RIGHT leg vertical under the body pushing off, LEFT knee driving forward and up past it, left arm swinging back, sword carried low and back, scarf streaming.",
    ],
    "attack1": [
        "attack1_0 - anticipation: weight shifted back onto the rear leg, torso coiled and twisted away from the target, sword drawn back at his right hip with the blade horizontal pointing backward, left hand forward for balance.",
        "attack1_1 - strike: explosive lunge forward, front knee deeply bent, rear leg straight, torso rotated toward the right, right arm and sword FULLY EXTENDED straight forward at chest height in a fast horizontal slash - blade horizontal pointing right, the longest forward reach on the sheet.",
        "attack1_2 - follow-through: the blade has swept past across his body and now points back-left at waist height, torso over-rotated, weight on the front leg, scarf whipping around.",
    ],
    "attack2": [
        "attack2_0 - anticipation: crouched with the blade LOW, sword held down near the front knee with the blade pointing down and back, torso turned away, coiled.",
        "attack2_1 - strike: rising diagonal backhand cut - torso strongly twisted, the sword sweeping up from low-back to high-front, blade on a 45-degree diagonal pointing up and to the right, arm extended, body rising onto the front leg.",
        "attack2_2 - follow-through: blade HIGH above his head pointing up and back, sword arm raised high, body upright on the ball of the front foot, scarf flaring upward.",
    ],
    "attack3": [
        "attack3_0 - big wind-up: sword raised overhead with BOTH hands on the hilt, blade pointing back behind his head, weight back on the rear leg, back arched, chest open.",
        "attack3_1 - leap at the apex: airborne, both feet clearly off the ground line, knees tucked, body high, sword still overhead in both hands about to come down, scarf and hair floating up.",
        "attack3_2 - impact: landed in a VERY deep crouch, knees bent deep, the downward chop finished - blade low in front of him pointing down and forward near the ground, both hands on the hilt, scarf whipping down.",
        "attack3_3 - recover: rising out of the crouch, sword pulled back toward the guard position, weight centering, knees still bent.",
    ],
    "skill": [
        "skill_0 - charge: deep crouch, sword held far back behind him with BOTH hands, blade horizontal pointing backward, body coiled like a spring, head forward and eyes on the target.",
        "skill_1 - dash: lunging forward very low and long, rear leg stretched straight, front knee deeply bent, body nearly horizontal, sword still held back.",
        "skill_2 - sweep (the hero pose): a huge wide horizontal sweep at full extension - right arm fully extended out in front to the right, blade horizontal, torso fully rotated, front leg in a deep lunge, rear leg extended straight, scarf and robe flaring dramatically.",
        "skill_3 - finish: held end pose - planted in a low wide stance, the sword arm straight with the blade extended out to the side and behind him, chin up, scarf settling.",
    ],
    "hurt-down": [
        "hurt_0 - hit recoil: recoiling backwards (to the left), torso bent back, head snapped back, arms flung out, sword arm out to the side, stumbling with the front foot lifted.",
        "down_0 - knocked down: lying flat on the ground on his back, body stretched horizontally along the ground line with his head to the left and feet to the right, sword still in his right hand lying on the ground beside him, scarf spread on the ground.",
        "getup_0 - getting up: kneeling on one knee on the ground line, pushing himself up, sword point planted into the ground in front of him with the right hand on the hilt, left hand on the raised knee, head raised looking right.",
    ],
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, poses in SHEETS.items():
        n = 1 + len(poses)
        body = HEADER.format(n=n)
        body += "".join(f"{i}. {p}\n" for i, p in enumerate(poses, start=2))
        body += FOOTER
        path = os.path.join(OUT, f"{name}-v{REV}.prompt.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(body)
        print(path, n, "poses")


main()
