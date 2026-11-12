"""Write side-view stage prompts for the 18 chapters into ../prompts/<id>-a<attempt>.prompt.txt.

Base = the demon-tower attempt-3 composition (floor line at 58% -> measured 0.595, even floor
lighter than the wall, plain outer 12% for mirror tiling), plus an explicitly ASYMMETRIC landmark
arrangement and chapter-specific location / materials / light (vocabulary from
art-source/dungeon-world/<id>-v1.prompt.txt and packages/core/src/level-data/*.ts).

Usage: python3 make_stage_prompts.py <attempt> [id ...]   (default: all chapters)
Per-chapter fixes for later attempts go into FIXES[(id, attempt)] and are appended.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "prompts")

TEMPLATE = """Use case: stylized-concept
Asset type: production 2D hand-painted stage background for a side-scrolling beat-'em-up (belt-scroller) game, wide landscape (about 2:1), opaque, full bleed, no UI. It will be tiled horizontally by mirroring (image, flipped image, image ...).
Input images: Image 1 is a style / material / palette reference ONLY - the same location painted from straight above. Match its painterly finish, materials, light colours and props. Do NOT copy its camera angle or its layout.
Scene: {cn} ({en}) - {scene}
Camera: side-on view with a slightly elevated camera looking a little downward (about 15-20 degrees), exactly like classic arcade beat-'em-up stages. The back wall runs parallel to the picture plane. NOT top-down, NOT isometric, NOT a deep one-point-perspective corridor, no central vanishing point.
Composition (strict):
- Lower 42% of the image (from 58% of the height down to the bottom edge - make the floor band deep, it must occupy at least 40% of the image height): one continuous, flat, EMPTY walkable floor band spanning the full width: {floor}. Nothing stands on the floor: no furniture, pillars, machines, rubble piles, props or railings on it - everything stands flush against the back wall above the floor line. Even, readable mid-tone lighting across the whole floor so dark-clothed characters stay visible on it: the floor is clearly lighter than the wall, and the left, center and right parts of the floor are equally bright - no central spotlight, no darkened edges, no darkening toward the bottom edge.
- The floor's far edge, where the floor meets the base of the back wall, is a straight, level, horizontal line at 58% of the image height across the entire width - not tilted, not curved.
- Upper 58%: {wall} The wall is darker and lower in contrast than the floor so it reads clearly as background.
- Landmarks are deliberately ASYMMETRIC: {asym} The wall is NOT mirror-symmetric about the vertical center line: no matching twin features on the left and right.
- Tiling: keep every landmark inside the central 76% of the width. The outer 12% on each side contains ONLY plain continuous {plain} above and plain floor below - no doors, machines, lights or props there. Floor band height and horizon identical at both edges.
Style/medium: rich hand-painted dark game environment art, painterly and textured, desaturated, finely detailed, same finish as the reference; not vector, not flat, not a photo.
Lighting/mood: {light} Ominous but not black.
Avoid: characters, people, monsters, creatures, figure statues, UI, HUD, text, letters, numbers, readable signs or labels, logos, watermarks, frames, borders, heavy black vignette corners, objects standing on the floor, foreground objects overlapping the floor, tilted horizon, fisheye, deep corridor perspective, top-down view, bright daylight, saturated colors{avoid}.
"""

CH = {
    "metro_abyss": dict(
        cn="镜潮地铁", en="Mirror Tide Metro",
        scene="an abandoned metro station platform after the tide has receded; black water films reflect an uncanny inverted station; drowned drainage, damp blank advertising lightboxes, old ticket barriers. Clearly a subway station, not a temple.",
        floor="the station platform deck - worn wet concrete and cracked square tiles with thin reflective water films, a faded tactile safety strip running parallel to the wall, scattered flat debris",
        wall="the station's back wall parallel to the camera: grimy white-and-teal tiled wall, a dark arched train-tunnel mouth with broken rails glinting inside, a battered stationary subway carriage half-visible in a recess, blank damp advertising lightboxes glowing faintly, old ticket barriers and turnstiles flush against the wall base, dripping pipes and drowned drainage grilles.",
        asym="the large tunnel mouth with the carriage sits left of center (about 25-50% of the width); a smaller cluster of lightboxes and ticket barriers sits right of center (about 62-82%).",
        plain="tiled station wall", light="Restrained blue-green reflected light, cold flickering strip lights, a small warm glow from one lightbox.",
        avoid=", readable station names or advertisements"),
    "starfall_mine": dict(
        cn="星坠矿井", en="Starfall Mine",
        scene="a meteor smashed through an old mine; disordered gravity, torn lift chains, star-iron veins, floating grains, inverted mining lamps. A rough underground mine gallery, NOT a masonry room.",
        floor="firm packed rocky mine floor with ore dust and two flat rusted mine-cart rail strips running parallel to the wall, flush with the ground",
        wall="the raw jagged rock face of the gallery parallel to the camera: timber mine props and cross beams, torn lift chains and snapped cables hanging, violet crystalline star-iron veins in the charcoal rock, a meteor-smashed breach high in the wall showing cold purple starlight, small mineral chips floating in the air, a few inverted mining lamps hanging upside down.",
        asym="the meteor breach and the lift-chain shaft sit right of center (about 55-80% of the width); a smaller timber prop with a lamp cluster sits left of center (about 25-40%).",
        plain="rock face with timber props", light="Warm dirty amber mining lamps against cold violet crystal light and charcoal rock.", avoid=""),
    "rust_hospital": dict(
        cn="锈疫病院", en="Rust Plague Hospital",
        scene="an abandoned hospital where treatment became an ordeal; polluted wards, toxic rust, yellowed medicine cabinets, empty gurneys with rusty straps. Clearly medical architecture, not a fantasy cathedral.",
        floor="cracked sickly pale-mint linoleum and ceramic tile floor with rust-brown wheel marks, thin grime and disinfectant stains",
        wall="the ward and triage back wall parallel to the camera: tiled lower wall and stained plaster above, a nurse's triage counter with yellowed glass medicine cabinets, tattered privacy curtains on ceiling rails, an empty rusted gurney and disconnected monitors flush against the wall, leaking pipes along the ceiling.",
        asym="the triage counter and medicine cabinets sit left of center (about 25-50% of the width); one curtained bay with a gurney sits right of center (about 62-80%).",
        plain="stained tiled hospital wall", light="Greenish failing fluorescent light with one small weak warm examination lamp.",
        avoid=", red crosses, readable charts"),
    "ash_arena": dict(
        cn="灰烬竞技场", en="Ash Arena",
        scene="a vast deserted amphitheater where invisible spectators judge every action; the arena feels abandoned and judicial.",
        floor="the arena ground - scorched ash-gray flagstones dusted with ash and faint scorch marks",
        wall="the low arena barrier wall parallel to the camera with curved tiers of scorched stone spectator seating rising behind it, every seat empty; drifting ash in the air; small controlled braziers on the barrier.",
        asym="cracked white victor's steps leading up to an empty judges' box sit left of center (about 28-50% of the width); one tall brazier and a broken section of seating sit right of center (about 65-80%).",
        plain="stone barrier wall and empty seating tiers", light="Red-orange brazier light on warm ash-gray, charcoal and rusty red stone.", avoid=""),
    "dream_archive": dict(
        cn="梦档案馆", en="Dream Archive",
        scene="an impossible archive of failed journeys folded into dreams; a richly tactile real library.",
        floor="worn wooden floorboards and old stone with scattered flat blank pages, white bookmarks and spilled ink",
        wall="tall deep walnut bookcases and index-card cabinets parallel to the camera, repeating shelving bays that fold upward impossibly into the darkness, a rolling library ladder, a reading alcove with an amber lamp, pale parchment pages drifting in the air.",
        asym="a tall arched reading alcove with the ladder sits right of center (about 55-75% of the width); a lower cluster of card cabinets with a hanging lamp sits left of center (about 25-42%).",
        plain="plain bookcase backs", light="Dreamlike amber reading lights with a muted lavender haze and pale parchment.",
        avoid=", readable book titles"),
    "void_citadel": dict(
        cn="虚界城", en="Void Citadel",
        scene="a ruined black obsidian citadel containing echoes of the main-god space. Not outer space, not a generic dungeon chamber.",
        floor="polished dark-gray obsidian paving that catches a soft sheen of light so it reads mid-tone, fractured cyan seam-light glowing faintly in the cracks, shallow mirror puddles",
        wall="dark angular obsidian ramparts and thick buttresses parallel to the camera, weathered blank identity plaques without writing, sparse white embers drifting, and a great black city gate through which a restrained white heart-like radiance glows from far beyond.",
        asym="the great gate sits left of center (about 25-48% of the width); a broken rampart stair and a cluster of blank plaques sit right of center (about 60-80%).",
        plain="obsidian rampart wall", light="Cold cyan seam light and a soft white glow beyond the gate on black stone.", avoid=""),
    "temporal_observatory": dict(
        cn="时序观测庭", en="Temporal Observatory",
        scene="a zero-meridian astronomical time-calibration observatory spanning past and future; real brass precision instruments and worn architecture.",
        floor="an observatory court floor of worn stone inlaid with flush bronze meridian strips running parallel to the wall",
        wall="the observatory wall parallel to the camera: a massive brass telescope mount angled up toward a slit in the dome, pendulum mechanisms and exposed gear trains, frozen star-map instrument panels without writing; the left part of the wall is heavily aged eroded bronze and stone, the right part intact blue-black metal, divided by one narrow pristine ivory zero-meridian pillar.",
        asym="the telescope mount sits left of center (about 25-50% of the width); the ivory meridian pillar stands right of center (about 58%) and pendulums cluster at about 65-80%.",
        plain="stone-and-metal wall", light="Antique bronze starlight versus cold future blue light.",
        avoid=", clock faces, giant circular symbols"),
    "causal_clearinghouse": dict(
        cn="因果清算所", en="Causal Clearinghouse",
        scene="an eerie bureaucratic clearing house where causes and consequences are filed separately; a tangible old bureaucratic court, not a futuristic laboratory.",
        floor="worn green-black marble floor with a soft sheen, two flush brass document-transfer track strips running parallel to the wall, a few flat untitled papers",
        wall="the hall's back wall parallel to the camera: towering case-file cabinets, testimony counters with stamps and red ink, mechanical judgment locks, pneumatic brass tubes, and a heavy round judgment vault door.",
        asym="the judgment vault door sits right of center (about 55-75% of the width); a lower testimony counter with stamp racks sits left of center (about 25-42%).",
        plain="marble-and-cabinet wall", light="Muted jade marble and cream paper with garnet red accents, warm desk lamps.",
        avoid=", readable documents"),
    "entropy_ark": dict(
        cn="熵海方舟", en="Entropy Ark",
        scene="a massive battered industrial ark drifting on a heat-death sea; clearly a ship deck, never a stone chamber.",
        floor="the open ship deck - weathered teak planks running parallel to the bulwark mixed with corroded gray steel plates, rust and salt stains, flush hatch rims",
        wall="the far side of the deck parallel to the camera: a rusted steel bulwark with an open railing along its top and, beyond it, a dark swirling entropy ocean and cold sea haze under a dim sky; large ballast machinery, mooring winches and broken mooring cables flush against the bulwark, and a tall battered helm tower.",
        asym="the tall helm tower sits right of center (about 55-75% of the width); a lower ballast machine with winches sits left of center (about 25-42%).",
        plain="bulwark and railing with the sea behind", light="Slanting cold sea haze with a few amber ship lights.", avoid=""),
    "mirror_cycle_city": dict(
        cn="镜海轮回城", en="Mirror Cycle City",
        scene="an abandoned city folded into real and reflected layers above a mirror sea; a concrete city street, not an interior mirror room or crystal chamber.",
        floor="wet worn concrete and stone street pavement with faint reflections and puddle films",
        wall="a row of aged city building facades parallel to the camera - shopfronts with dark windows, balconies and drainpipes, no signage text; above them the city folds: an inverted, fractured reflected copy of the buildings hangs down from the stormy sky like a mirror image.",
        asym="a tall corner tower block with its hanging reflection sits left of center (about 25-48% of the width); a lower arcade of shopfronts sits right of center (about 60-80%).",
        plain="facade wall", light="Stormy teal, silver glass, deep indigo and pale pink glints.",
        avoid=", readable shop signs"),
    "redaction_scriptorium": dict(
        cn="删界终稿院", en="Redaction Scriptorium",
        scene="a black manuscript and data archive where reality is edited into body text, overlays and deleted marginal notes; a tangible dark editorial archive.",
        floor="dark slate-gray stone floor with a soft sheen so it reads mid-tone, scattered flat ivory parchment sheets",
        wall="tall black storage cabinets and curled page-like architectural wall layers parallel to the camera, clause proof benches flush against the wall, a heavy final-proof lock door, red optical redaction beams caught in the dust above.",
        asym="the final-proof lock door sits left of center (about 28-48% of the width); a cluster of proof benches under red beams sits right of center (about 60-80%).",
        plain="black cabinet wall", light="Crimson redaction beams and ivory parchment glow on coal black.",
        avoid=", any words or letters"),
    "legacy_auction_court": dict(
        cn="亡队遗产拍卖庭", en="Legacy Auction Court",
        scene="a derelict military hangar converted into an auction hall for the equipment of dead teams.",
        floor="wide scuffed gray concrete hangar floor with faded yellow safety stripes running parallel to the wall and oil stains",
        wall="the hangar's back wall parallel to the camera: corrugated steel panels and steel frame columns, perimeter gantries with suspended sealed weapon display cases, a mechanical auction hammer rail along the gantry, and an armored pickup vault door.",
        asym="the armored vault door sits right of center (about 58-78% of the width); a gantry with hanging display cases sits left of center (about 25-48%).",
        plain="corrugated hangar wall", light="Cold hangar floodlights with dusty warm amber accents.",
        avoid=", readable stencils or numbers"),
    "genesis_vault": dict(
        cn="众生原型库", en="Genesis Vault",
        scene="a biotechnological vault storing undifferentiated living prototypes; a believable cryobiology facility.",
        floor="wet ivory ceramic tiles and gray surgical steel panels with condensation and a few flat glass slides",
        wall="the lab's back wall parallel to the camera: tall curved translucent green bio-tanks holding indistinct luminous organic samples (no recognizable humans), slender folded robot arms, gene-splicing benches flush against the wall, serum cartridges in racks, condensation on glass.",
        asym="a group of two tall bio-tanks sits left of center (about 25-45% of the width); one robot-arm workstation sits right of center (about 62-78%).",
        plain="steel-panel lab wall", light="Pale mint and emerald liquid glow, cold sterile light.",
        avoid=", human bodies in tanks"),
    "silent_broadcast_tower": dict(
        cn="寂声广播塔", en="Silent Broadcast Tower",
        scene="a modern abandoned emergency broadcasting tower still transmitting blank channels; analog emergency-radio atmosphere, not a neon city, not a medieval tower.",
        floor="dark linoleum and steel-plate control floor with a soft sheen so it reads mid-tone, rainwater trails and flush cable seams",
        wall="the control room's back wall parallel to the camera: banks of old analog radio relay racks with dials, reel-to-reel recorders, equalizer patch panels, hanging bundled signal cables, a soundproof foam-lined booth with a dark window, screens showing only static.",
        asym="the soundproof booth sits right of center (about 55-75% of the width); a tall bank of relay racks with reel recorders sits left of center (about 25-45%).",
        plain="foam-panel wall", light="Cold green indicator lamps and restrained red emergency light.",
        avoid=", waveforms or words on screens"),
    "lost_shelter": dict(
        cn="失联避难所", en="Lost Shelter",
        scene="a modern subterranean civil-defense bunker continuing an evacuation under a defunct roster.",
        floor="worn reinforced concrete floor with flush drainage channel strips and faded yellow evacuation lane lines running parallel to the wall, without words",
        wall="the bunker's back wall parallel to the camera: damp gray-green reinforced concrete, a heavy checkpoint blast door, sealed firearms lockers, folded stretchers and first-aid carts flush against the wall, a rollcall desk behind wired glass.",
        asym="the blast door sits left of center (about 28-48% of the width); lockers and the rollcall window sit right of center (about 60-80%).",
        plain="concrete bunker wall", light="Low red emergency strips and weak warm practical lights.",
        avoid=", readable signs"),
    "false_testimony_court": dict(
        cn="伪证裁定庭", en="False Testimony Court",
        scene="a futuristic forensic adjudication laboratory with three evidence disciplines - voiceprint, timeline and chemical residue; a sterile cold interrogation setting, not an old wooden courthouse.",
        floor="clinical blue-gray floor with subtle flush light strips running parallel to the wall and faint fingerprint dust traces",
        wall="glass partitions of evidence labs parallel to the camera, biometric analysis consoles, timeline projector arrays, residue sterilizer cylinders, sealed evidence drawers, and a raised interrogation workbench behind glass casting faint holographic blue light.",
        asym="the raised interrogation bench behind glass sits right of center (about 55-75% of the width); sterilizer cylinders and evidence drawers sit left of center (about 25-42%).",
        plain="white-gray lab wall panels", light="Cool precise white and cyan light.",
        avoid=", holographic text or characters"),
    "combat_replay_stage": dict(
        cn="战痕复演场", en="Combat Replay Stage",
        scene="a futuristic military simulation film stage where the same battle is rehearsed in three holographic takes; a studio and simulation arena, not a warehouse.",
        floor="matte dark-gray stage floor lit to a readable mid-tone, faint tape marks without numbers and flush cable seams",
        wall="the stage's back wall parallel to the camera: camera rigs and three large lenses on gantries, rehearsal curtains, editing desks, empty script rails and film tape canisters, a blue hologram haze.",
        asym="a big camera crane with lenses sits left of center (about 25-48% of the width); a curtain and editing-desk cluster sits right of center (about 62-80%).",
        plain="sound-stage wall", light="Broad even stage lighting across the floor, soft spotlight pools only on the back wall, amber cut-room lights and blue hologram haze.",
        avoid=", numbers"),
    "panopticon_city": dict(
        cn="天幕监察城", en="Panopticon City",
        scene="an oppressive futuristic city street beneath orbital surveillance; urban pavement and surveillance infrastructure, not a laboratory.",
        floor="wet asphalt street with faint translucent scanning-beam reflections and puddles",
        wall="tall dense steel-and-concrete city facades parallel to the camera, street-mounted optical camera emitters, relay utility boxes, a narrow dark maintenance alley, three faint overlapping scanning beams sweeping down from the sky.",
        asym="the maintenance alley and a tall camera mast sit right of center (about 55-75% of the width); a cluster of relay boxes sits left of center (about 25-42%).",
        plain="facade wall", light="Blue-gray rain, cold white searchlight reflections and sparse amber warning lights.",
        avoid=", giant eye symbols, readable signs"),
}

# Targeted additions for re-generations: (id, attempt) -> extra line(s) appended before "Avoid:".
FIXES = {
    ("false_testimony_court", 2): "the previous attempt put the wall base far too high (54% of the height). The floor/wall line must be at 58% of the height: the back wall fills the whole upper 58%.",
    ("panopticon_city", 2): "scanning beams and searchlight cones stay on the facades and in the sky only - they must NOT cross the floor band. The floor is evenly lit wet asphalt, a lighter blue-gray mid-tone than the facades, with only soft reflections; no zebra crossings or road markings.",
    ("redaction_scriptorium", 2): "make the floor a lighter warm slate-gray mid-tone, evenly lit across the full width (no bright center), clearly lighter than the black wall; only a few small scattered parchment sheets, no repeating pattern.",
    ("silent_broadcast_tower", 2): "make the floor a lighter gray-green linoleum mid-tone, evenly lit across the full width (no bright center, no darkening toward the bottom), clearly lighter than the dark wall.",
    ("entropy_ark", 2): "the previous attempt put the bulwark base too low (63% of the height). The deck must start at exactly 58% of the height - the bulwark base line is at 58%. Light the deck evenly, no bright center.",
    ("mirror_cycle_city", 2): "the previous attempt put the street edge too low (64%) and had a bright pink reflection hotspot in the middle of the street. The building base must be at 58% of the height; the street is evenly lit at a moderate mid-tone with soft, dim reflections and no bright central glare.",
    ("metro_abyss", 2): "keep the lightboxes and ticket barriers between 55% and 80% of the width; the right outer 15% and the left outer 12% show only plain tiled wall and a plain pillar.",
    ("starfall_mine", 2): "center the meteor breach at about 50-70% of the width, so that the right outer 15% is only plain rock with one timber prop; the left outer 12% is plain rock too.",
    ("dream_archive", 2): "keep the floating lavender ribbons, the ladder and the card cabinets inside 25-75% of the width; the outer 12% on each side shows only plain bookcase shelves with no ribbons, lamps or cabinets.",
    ("lost_shelter", 2): "the left and right outer 12% show only plain concrete wall: no stretchers, carts, lockers or lamps there. The floor/wall line is the base of the wall at 58% of the height, with no separate raised curb strip.",
    ("genesis_vault", 2): "make the floor aged ivory ceramic at a moderate mid-tone (not glossy white) with soft, dim reflections; keep the whole image dark and desaturated like the rest of the game.",
    ("false_testimony_court", 3): "two previous attempts put the wall base too high (54% and 56%). The back wall must be TALLER: the floor starts only at 61% of the image height, with the lab equipment standing on that line.",
    ("redaction_scriptorium", 3): "keep the lighter, evenly lit warm slate-gray floor with only a few small parchment sheets, but the previous attempt put the wall base too high (56%): the floor starts only at 61% of the image height.",
    ("combat_replay_stage", 2): "place the camera crane at 30-50% of the width - nothing large in the outer 15% on either side, which shows only plain sound-stage wall; the floor starts at 60% of the image height.",
    ("mirror_cycle_city", 3): "two previous attempts put the street edge too low (64% and 65%). The building base line must be HIGHER, at 55% of the image height, so the street band is deep; keep the street evenly lit with soft, dim reflections and no bright central glare.",
    ("panopticon_city", 3): "keep the scanning beams on the facades and in the sky only and the evenly lit lighter wet asphalt, but the previous attempt put the facade base too low (65%): the facade base line is at 57% of the image height.",
    ("lost_shelter", 3): "no stretchers, carts or lockers anywhere in the outer 15% on either side - the first prop starts at 20% of the width from the left edge and the last ends at 80%; the wall base is at 60% of the image height with no separate raised curb strip.",
    ("rust_hospital", 3): "keep the curtained gurney bay between 55% and 75% of the width and the triage counter between 22% and 48%; the outer 15% on each side shows only plain stained tiled wall with no curtains, monitors or IV stands.",
    ("causal_clearinghouse", 2): "make the marble floor a lighter muted jade-gray mid-tone, evenly lit and clearly lighter than the wall so dark characters read on it; the floor/wall line is the base of the cabinets at 58% of the height.",
}


# Line-position compensation for chapters whose generations keep landing high or low: (id, attempt) -> percent.
LINE = {
    ("false_testimony_court", 3): 61, ("redaction_scriptorium", 3): 61, ("combat_replay_stage", 2): 60,
    ("mirror_cycle_city", 3): 55, ("panopticon_city", 3): 57, ("lost_shelter", 3): 60,
}


def build(cid, attempt):
    text = TEMPLATE.format(**CH[cid])
    line = LINE.get((cid, attempt))
    if line:
        text = (text.replace("Lower 42% of the image (from 58% of the height", f"Lower {100 - line}% of the image (from {line}% of the height")
                    .replace("horizontal line at 58% of the image height", f"horizontal line at {line}% of the image height")
                    .replace("- Upper 58%:", f"- Upper {line}%:"))
    fix = FIXES.get((cid, attempt))
    if fix:
        text = text.replace("Avoid:", f"Correction for this attempt: {fix}\nAvoid:", 1)
    return text


def main():
    attempt = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    ids = sys.argv[2:] or list(CH)
    os.makedirs(OUT, exist_ok=True)
    for cid in ids:
        p = os.path.join(OUT, f"{cid}-a{attempt}.prompt.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(build(cid, attempt))
        print(p)


if __name__ == "__main__":
    main()
