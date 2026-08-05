"""
EYES — photograph the game and have something look at the pictures.

usage:
  python eyes.py                 all poses, verify then shoot then review
  python eyes.py --eye 0         one pose (do this first: test small)
  python eyes.py --no-review     just take the pictures, skip the model
  python eyes.py --seed 77       a different board

WHAT THIS IS FOR
----------------
tools/bot.js plays the whole cave and proves the game is LEGAL: cells open
when they should, mines are marked before they are dug beside, the win
condition fires. It proves none of it is VISIBLE, because the bot never looks
at the screen. It reads G.st and P.x straight out of memory.

So this project can pass its entire harness while:
  - the weapon points backwards (it did: 169 degrees off, a staff's tilt
    applied to a gun model)
  - a sprite atlas fails to bind and everything draws as a black quad
  - the HUD lands on top of the numbers it is meant to complement
  - the player spawns inside geometry and the frame is featureless
  - z-fighting strobes on every shared face

Not one of those can fail an invariant. All of them end a playtest instantly.
This tool closes that gap: h_eyes.js poses the game, headless Chrome takes the
picture, and a vision model reviews it against the bugs this project has
actually shipped.

IT IS OPTIONAL, ON PURPOSE
--------------------------
The review half needs agybridge and an API key. Without either, eyes.py still
builds, still runs, and still writes the PNGs — it just says the review was
skipped. Nothing else in the project imports this file. Delete it and the
game, the bot and the harness are exactly what they were.

COST
----
Runs LIT, unlike runbot.py. lights=0 is the right call for the bot (per-fragment
point lights on SwiftShader turned a one-second run into a hang) and the wrong
call here, because an unlit cave is not what the player sees and lighting bugs
are the point. Budget is kept small to pay for it, and escalate() does the
cold-start retry so a first run costs 24s to rule out rather than 120.
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run_harness as R

SHOTS = os.path.join(os.path.dirname(HERE), "shots", "eyes")

try:
    sys.path.insert(0, r"E:\Claude\agybridge")
    import agybridge
except Exception:
    agybridge = None

EYES = {
    0: "apprentice, spawn view - the first thing a player ever sees",
    1: "apprentice, dug in - numbers and glyphs on revealed faces",
    2: "weapon, pitched down - the 169-degrees-backwards class of bug",
    3: "flags planted - marker sprites, the ones that bind late",
    4: "dungeon, lit, mid-level - depth, lighting, distance",
}

RUBRIC = """You are reviewing a single frame from a 3D voxel minesweeper game rendered in
WebGL. You are the only reviewer that can see; the automated tests cannot.
Judge ONLY what is visible in this frame. Be literal and specific.

This project has actually shipped these bugs. Look for them first:
  - the held weapon pointing the wrong way (backwards, sideways, or into the
    player) instead of forward into the scene
  - a sprite or texture failing to bind: flat black quads, magenta/checkerboard
    placeholders, or a solid untextured colour where a texture belongs
  - the HUD overlapping or obscuring the board numbers it sits beside
  - the camera inside geometry: a featureless, near-empty or black frame
  - z-fighting: strobing or stitched seams where two surfaces share a plane
  - geometry clipping: objects passing through walls or floors

Also report anything else clearly wrong: unreadable numbers, missing lighting
(a scene that should be lit reading as flat), broken transparency, extreme
stretching, or a frame that is simply empty.

A frame that looks like a working game gets pass. Something a player would
notice within a second is fail. Cosmetic-but-real is warn.
Do not invent defects. If the frame looks fine, say so and pass it."""

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail"]},
        "frame_empty": {"type": "boolean"},
        "weapon_visible": {"type": "boolean"},
        "weapon_orientation": {"type": "string",
                               "enum": ["forward", "wrong", "not_visible"]},
        "texture_failure": {"type": "boolean"},
        "hud_overlap": {"type": "boolean"},
        "z_fighting": {"type": "boolean"},
        "issues": {"type": "array", "items": {"type": "string"}},
        "describe": {"type": "string"},
        "one_line": {"type": "string"},
    },
    "required": ["verdict", "frame_empty", "weapon_orientation",
                 "texture_failure", "hud_overlap", "z_fighting",
                 "issues", "describe", "one_line"],
}


def build(seed):
    """One instrumented copy, rendering ON, reused by every pose."""
    out = os.path.join(HERE, "eyes_index.html")
    R.build(os.path.join(HERE, "h_eyes.js"), out, render=True)
    return out


def verify(page, eye, seed, cap):
    """Cheap --dump-dom pass: did the pose set up, or did the harness throw?

    Worth its own Chrome run. A harness that throws still produces a perfectly
    valid-looking PNG of the title screen, and reviewing that teaches you
    nothing while costing a model call.
    """
    q = f"eye={eye}&seed={seed}"
    res, secs, bad, tries = R.escalate(page, budget=6000, query=q,
                                       profile=os.path.join(HERE, "cdata_eyes"))
    return res, secs, bad


def shoot(page, eye, seed, size, cap):
    os.makedirs(SHOTS, exist_ok=True)
    png = os.path.join(SHOTS, f"eye{eye}_seed{seed}.png")
    q = f"eye={eye}&seed={seed}"
    res, secs, bad, tries = R.escalate(page, budget=6000, query=q, shot=png,
                                       size=size,
                                       profile=os.path.join(HERE, "cdata_eyes"))
    ok = os.path.exists(png) and os.path.getsize(png) > 2000
    return png, secs, (bad or not ok)


def review(png, eye):
    if agybridge is None:
        return {"verdict": "skip", "error": "agybridge not importable"}
    if not agybridge.available("vision"):
        st = agybridge.status()
        return {"verdict": "skip",
                "error": f"no vision backend (key={st['gemini_key']}, "
                         f"calls={st['calls_today']}/{st['cap']})"}
    ask = RUBRIC + f"\n\nWHAT THIS FRAME IS SUPPOSED TO SHOW:\n{EYES.get(eye,'')}"
    r = agybridge.vision(ask, files=[png], schema=SCHEMA)
    if not r.ok:
        return {"verdict": "skip", "error": r.reason}
    out = dict(r.data or {})
    out["_seconds"] = r.seconds
    return out


def main():
    ap = argparse.ArgumentParser(description="Visual QA for Minesweeper Three Planes")
    ap.add_argument("--eye", type=int, help="one pose only (0-4)")
    ap.add_argument("--seed", type=int, default=4242)
    ap.add_argument("--cap", type=int, default=90)
    ap.add_argument("--size", default="1280x800")
    ap.add_argument("--no-review", action="store_true")
    ap.add_argument("--no-verify", action="store_true")
    args = ap.parse_args()

    w, h = (int(x) for x in args.size.lower().split("x"))
    eyes = [args.eye] if args.eye is not None else sorted(EYES)
    for e in eyes:
        if e not in EYES:
            print(f"no such eye: {e}. have {sorted(EYES)}")
            return 1

    R.reap()
    print(f"EYES  seed={args.seed}  poses={eyes}  {w}x{h}")
    page = build(args.seed)
    print(f"built {os.path.basename(page)} (rendering ON, lit)")
    print()

    report, counts = {}, {}
    t_all = time.time()
    for n, e in enumerate(eyes, 1):
        print(f"[{n}/{len(eyes)}] eye {e} - {EYES[e]}")

        if not args.no_verify:
            sys.stdout.write("      pose  ... "); sys.stdout.flush()
            res, secs, bad = verify(page, e, args.seed, args.cap)
            print(f"{secs:5.1f}s  {res[:88]}")
            if bad or res.startswith("THROW") or res.startswith("NO data-r"):
                print("      SKIPPED - the pose did not set up, so the picture "
                      "would show nothing worth reviewing")
                report[f"eye{e}"] = {"verdict": "skip", "error": res[:200]}
                counts["skip"] = counts.get("skip", 0) + 1
                continue

        sys.stdout.write("      shoot ... "); sys.stdout.flush()
        png, secs, bad = shoot(page, e, args.seed, (w, h), args.cap)
        if bad:
            print(f"{secs:5.1f}s  FAILED to write a usable png")
            report[f"eye{e}"] = {"verdict": "skip", "error": "no png"}
            counts["skip"] = counts.get("skip", 0) + 1
            continue
        kb = os.path.getsize(png) // 1024
        print(f"{secs:5.1f}s  {os.path.basename(png)} ({kb} KB)")

        if args.no_review:
            report[f"eye{e}"] = {"verdict": "shot-only", "png": png}
            continue

        sys.stdout.write("      look  ... "); sys.stdout.flush()
        res = review(png, e)
        res["png"] = png
        v = res.get("verdict", "skip")
        counts[v] = counts.get(v, 0) + 1
        note = res.get("one_line") or res.get("error", "")
        print(f"{res.get('_seconds',0):5.1f}s  {v.upper()}  {note[:70]}")
        for iss in (res.get("issues") or [])[:4]:
            print(f"              - {iss[:86]}")
        report[f"eye{e}"] = res
        print()

    R.reap()
    print("-" * 78)
    print(f"{time.time()-t_all:.0f}s total   " +
          "  ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    out = os.path.join(SHOTS, "eyes_report.json")
    os.makedirs(SHOTS, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    print(f"report -> {out}")
    return 1 if counts.get("fail") else 0


if __name__ == "__main__":
    sys.exit(main())
