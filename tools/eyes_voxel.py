"""
EYES/VOXEL — photograph the material simulation and have something look at it.

usage:
  python eyes_voxel.py --scene pile --no-review     one scene, no key needed
  python eyes_voxel.py                              all five, reviewed
  python eyes_voxel.py --ticks 600                  settle it longer first

WHY THIS EXISTS SEPARATELY FROM eyes.py
---------------------------------------
eyes.py closes the gap bot.js cannot: the bot reads G.st out of memory, so a run
is "clean" while the weapon points backwards. This closes the same gap one layer
down. voxel/*.html benches report throughput and cell counts and NOTHING LOOKS AT
THE SIMULATION — and a falling-everything engine fails in ways no counter sees:

  - sand standing in a column it could never hold
  - water that never finds its level
  - oil under water instead of on top of it
  - material quietly deleted at a chunk seam
  - the whole thing frozen in its starting rectangles because step() never ran

Every one of those passes a benchmark with full marks.

It is a separate module on purpose. eyes.py's five poses are untouched; this
adds a flag and a file. Run either alone.

THE PAGES ARE NOT index.html
----------------------------
voxel/view.html is standalone, so run_harness.build's IIFE injection does not
apply — there is no game closure to inject into. escalate() takes a file path
directly and everything else still holds: the cold-start ladder, the total cap,
the reap fingerprint, the throwaway profile.

Screenshots need render=True, which is what --shot implies; NO_RENDER kills rAF
and hands back a blank frame. view.html draws once on load rather than animating,
so a single frame is all it needs.

OPTIONAL, LIKE EVERYTHING THAT TOUCHES THE BRIDGE
-------------------------------------------------
No agybridge, no key, over quota, timeout — all of it comes back as a skipped
review and the PNGs still get written. --no-review never touches the bridge at
all. Delete E:\\Claude\\agybridge and this file still takes the pictures.
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run_harness as R

ROOT = os.path.dirname(HERE)
VIEW = os.path.join(ROOT, "voxel", "view.html")
ISLAND = os.path.join(ROOT, "voxel", "island.html")

# Which page a scene lives on. view.html carries the five material scenes; the
# island is its own page because it is a WORLD rather than a behaviour, and it
# is judged against different things - shoreline, sand where rock meets water,
# a hole open to the sky, a tree standing clear of both.
PAGES = {"island": ISLAND}
SHOTS = os.path.join(ROOT, "shots", "voxel")

try:
    sys.path.insert(0, r"E:\Claude\agybridge")
    import agybridge
except Exception:
    agybridge = None

# Each scene isolates ONE behaviour, so the reviewer is never asked to judge
# five things in one picture and hedge on all of them.
SCENES = {
    "pile":  "a powder must SLUMP into a sloped heap; a standing column is the bug",
    "level": "a liquid must flow under a divider and settle at ONE flat level",
    "float": "oil must stay ABOVE water; sand must sink THROUGH both to the floor",
    "seam":  "a pile falling across a chunk boundary must be symmetric, no shelf",
    "burn":  "fire must spread along an oil slick, smoke, and consume it",
    "island":"a rock mass in water with sand where they meet, a hole blown "
             "through the rock, and a tree standing on it",
}

RUBRIC = """You are reviewing one frame from a falling-material simulation - a
Noita-style "falling everything" engine - drawn as a VERTICAL CROSS-SECTION.
Each coloured block is one cell. Up in the image is up in the world; the bottom
row is the floor. A faint vertical white line marks a chunk boundary.

You are the only reviewer that can see. The automated benchmarks measure speed
and cell counts and cannot tell whether the physics LOOKS right. Judge only the
shape and arrangement of the material, and be literal about what is there.

The failures this engine can actually have:

  POWDER STANDING UP. Sand and other powders must slump into a heap with sloping
  sides. A vertical-sided column, a floating clump, or a pile with overhangs
  means the falling rule is not working.

  LIQUID NOT LEVELLING. Water in a connected basin must reach ONE flat
  horizontal surface. Two connected sides at different heights, a visibly sloped
  surface, or a liquid heaped up like a powder, are all failures.

  DENSITY ORDER INVERTED. Where two liquids are shown, the lighter one must sit
  ON TOP of the heavier. A denser powder dropped in must sink THROUGH the liquid
  to the floor rather than resting on its surface.

  A CHUNK SEAM. Material must cross the marked vertical line with no step, no
  shelf, no vertical crack and no abrupt change of height. A pile that is
  obviously asymmetric about that line is the classic seam bug.

  MATERIAL VANISHING. Large empty regions where material was clearly placed, or
  a shape cut off flat against an edge, suggests cells are being lost.

  NOTHING HAPPENED. If the material is still sitting in crisp starting
  rectangles, the simulation never ran.

An arrangement that obeys the physics described is pass. A clear violation is
fail. Slightly odd but physically plausible is warn. Do not invent defects: if it
looks sensible, say so and pass it."""

ISLAND_RUBRIC = """You are reviewing a FRONT VIEW of a generated island in a
voxel game, drawn one coloured block per voxel. It is a SLAB PROJECTION: for
each column you are seeing the nearest solid voxel within a slab of the world,
shaded darker the further back it sits. So it reads like a side-on photograph
of the island, not a cut through it. Up in the image is up in the world, and a
faint blue horizontal line marks the water line.

It is supposed to be a ROCK mass sitting in WATER, with SAND where the rock
meets the water, a HOLE blown through the rock, and a TREE standing on the rock
with a crown of green leaves above it.

Colours: water blue, rock dark grey-brown, sand pale tan, wood brown, leaf green.

What can be wrong, and these are the only things to judge:

  THE WATER IS NOT LEVEL. It must be one flat horizontal surface at the marked
  line, the same height on both sides of the island. Sloped or stepped is a fail.

  THE ROCK FLOATS. The rock mass must sit on the bottom and rise out of the
  water, not hang in it.

  NO SAND AT THE SHORE. Pale sand should be visible where the rock surface is
  near the water line.

  THE TREE IS WRONG. It should stand on ROCK, above the water line, with a brown
  trunk and green leaf clusters above and around the top of it. A tree growing
  out of water, a floating trunk, or leaves far from the trunk are failures.
  Leaves in SEVERAL SEPARATE CLUMPS is correct and intended - never report that
  as a defect.

  THE HOLE. Somewhere in the rock there should be a gap bitten out of it. Its
  absence is worth a note but not a fail on its own: this is one slice and the
  hole may be off this plane.

  NOTHING GENERATED. A blank or nearly blank frame means the build failed.

Be literal about what you can see. If it looks like a sensible island, pass it.
Do not invent defects."""

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail"]},
        "frame_empty": {"type": "boolean"},
        "simulation_ran": {"type": "boolean"},
        "powder_slumped": {"type": "string", "enum": ["yes", "no", "not_applicable"]},
        "liquid_level": {"type": "string", "enum": ["flat", "uneven", "not_applicable"]},
        "density_order": {"type": "string", "enum": ["correct", "inverted", "not_applicable"]},
        "seam_artifact": {"type": "boolean"},
        "material_lost": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "string"}},
        "describe": {"type": "string"},
        "one_line": {"type": "string"},
    },
    "required": ["verdict", "frame_empty", "simulation_ran", "powder_slumped",
                 "liquid_level", "density_order", "seam_artifact",
                 "material_lost", "issues", "describe", "one_line"],
}


def shoot(scene, ticks, size):
    """One frame of a standalone page. No build() — there is no game to inject."""
    os.makedirs(SHOTS, exist_ok=True)
    png = os.path.join(SHOTS, "vox_%s_t%d.png" % (scene, ticks))
    page = PAGES.get(scene, VIEW)
    query = "seed=7" if scene in PAGES else ("scene=%s&ticks=%d" % (scene, ticks))
    res, secs, bad, tries = R.escalate(page, budget=12000,
                                       query=query,
                                       shot=png, size=size,
                                       profile=os.path.join(HERE, "cdata_eyes"))
    ok = os.path.exists(png) and os.path.getsize(png) > 2000
    return png, secs, (bad or not ok)


def review(png, scene):
    if agybridge is None:
        return {"verdict": "skip", "error": "agybridge not importable"}
    if not agybridge.available("vision"):
        st = agybridge.status()
        return {"verdict": "skip",
                "error": "no vision backend (key=%s, calls=%s/%s)"
                         % (st.get("gemini_key"), st.get("calls_today"), st.get("cap"))}
    ask = (ISLAND_RUBRIC if scene in PAGES else RUBRIC) + "\n\nWHAT THIS SCENE IS SUPPOSED TO SHOW:\n" + SCENES.get(scene, "")
    r = agybridge.vision(ask, files=[png], schema=SCHEMA)
    if not r.ok:
        return {"verdict": "skip", "error": r.reason}
    out = dict(r.data or {})
    out["_seconds"] = r.seconds
    return out


def run(scene=None, ticks=240, size=(900, 900), no_review=False):
    scenes = [scene] if scene and scene != "all" else sorted(SCENES)
    for sc in scenes:
        if sc not in SCENES:
            print("no such scene: %s. have %s" % (sc, sorted(SCENES)))
            return 1
    if not os.path.exists(VIEW):
        print("missing %s" % VIEW)
        return 1

    R.reap()
    print("EYES/voxel  ticks=%d  scenes=%s  %dx%d" % (ticks, scenes, size[0], size[1]))
    print("page voxel/view.html (standalone: driven as a file URL, not built)")
    print()

    report, counts = {}, {}
    t0 = time.time()
    for n, sc in enumerate(scenes, 1):
        print("[%d/%d] %s - %s" % (n, len(scenes), sc, SCENES[sc]))
        sys.stdout.write("      shoot ... "); sys.stdout.flush()
        png, secs, bad = shoot(sc, ticks, size)
        if bad:
            print("%5.1fs  FAILED to write a usable png" % secs)
            report[sc] = {"verdict": "skip", "error": "no png"}
            counts["skip"] = counts.get("skip", 0) + 1
            continue
        print("%5.1fs  %s (%d KB)" % (secs, os.path.basename(png),
                                      os.path.getsize(png) // 1024))
        if no_review:
            report[sc] = {"verdict": "shot-only", "png": png}
            continue
        sys.stdout.write("      look  ... "); sys.stdout.flush()
        res = review(png, sc)
        res["png"] = png
        v = res.get("verdict", "skip")
        counts[v] = counts.get(v, 0) + 1
        print("%5.1fs  %s  %s" % (res.get("_seconds", 0), v.upper(),
                                  (res.get("one_line") or res.get("error", ""))[:70]))
        for iss in (res.get("issues") or [])[:4]:
            print("              - %s" % iss[:86])
        report[sc] = res
        print()

    R.reap()
    print("-" * 78)
    print("%.0fs total   %s" % (time.time() - t0,
          "  ".join("%s=%d" % (k, v) for k, v in sorted(counts.items()))))
    os.makedirs(SHOTS, exist_ok=True)
    out = os.path.join(SHOTS, "voxel_report.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
    print("report -> %s" % out)
    return 1 if counts.get("fail") else 0


def main():
    ap = argparse.ArgumentParser(description="Visual QA for the material simulation")
    ap.add_argument("--scene", help="one scene, or 'all' (default all)")
    ap.add_argument("--ticks", type=int, default=240,
                    help="settle the sim this long before the photograph")
    ap.add_argument("--size", default="900x900")
    ap.add_argument("--no-review", action="store_true")
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.lower().split("x"))
    return run(a.scene, a.ticks, (w, h), a.no_review)


if __name__ == "__main__":
    sys.exit(main())
