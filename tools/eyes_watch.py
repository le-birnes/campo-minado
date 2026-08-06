"""EYES/WATCH — photograph the bot actually playing, and have something look.

usage:
  python eyes_watch.py                    three moments of a dungeon run
  python eyes_watch.py --q "watch&quick"  the small board instead
  python eyes_watch.py --no-review        pictures only, no key needed

WHY THIS EXISTS
---------------
runbot.py reads the bot's own counters, and the bot reads G.st out of memory,
so a run is "clean" while the screen shows something else entirely. eyes.py
closes that gap for the GAME by posing the camera; this closes it for the BOT
by photographing ?watch — the mode where it plays in a real browser at a pace
you can follow, with the game rendering between its moves and its thinking
printed on screen.

What that catches which nothing else does: the bot standing still, the overlay
not updating, the board not drawing, a stack trace sitting in the panel while
the counters say everything is fine.

THREE MOMENTS, not one. A single frame cannot distinguish "playing" from
"frozen on the first step", so it shoots at increasing virtual-time budgets and
the reviewer is asked whether the run has MOVED between them.

Optional like everything that touches the bridge: no key, no agybridge, over
quota — all of it comes back as a skipped review with the PNGs still written.
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
SHOTS = os.path.join(ROOT, "shots", "watch")

try:
    sys.path.insert(0, r"E:\Claude\agybridge")
    import agybridge
except Exception:
    agybridge = None

RUBRIC = """These are screenshots of an automated playtest bot playing a
first-person 3D minesweeper, in its "watch" mode: the game renders normally and
a debug panel prints what the bot is thinking (step number, phase, target,
statistics, and any error with its stack).

They are the SAME RUN photographed at increasing amounts of elapsed time, in
order. You are the only reviewer that can see the screen — the bot's own
counters are read out of memory and will happily report a clean run while the
display shows something broken.

Judge these things and nothing else:

  IS THE GAME DRAWING? There should be a 3D view: blocks, a cave, a weapon or
  staff, numbers floating on cleared blocks. A blank, black or single-colour
  frame is a failure.

  IS THE PANEL ALIVE? The debug text should show a step count and a phase. If
  it shows an ERROR or a stack trace, that is a failure and quote it.

  HAS IT MOVED? Compare the images in order. The step count should INCREASE and
  the view or the board should CHANGE. Identical frames with an identical step
  count means the bot is frozen, which is the single most important thing to
  catch here.

  DOES IT LOOK LIKE A GAME? Grossly wrong rendering — everything one flat
  colour, geometry inside out, the whole screen one texture — is worth failing.

Do not judge whether the bot is playing WELL. Do not invent defects. If the
frames show a game drawing and a step count going up, pass it."""

SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "warn", "fail"]},
        "game_drawing": {"type": "boolean"},
        "panel_alive": {"type": "boolean"},
        "made_progress": {"type": "boolean"},
        "error_text": {"type": "string"},
        "steps_seen": {"type": "array", "items": {"type": "string"}},
        "issues": {"type": "array", "items": {"type": "string"}},
        "describe": {"type": "string"},
        "one_line": {"type": "string"},
    },
    "required": ["verdict", "game_drawing", "panel_alive", "made_progress",
                 "error_text", "steps_seen", "issues", "describe", "one_line"],
}


def run(query, budgets, size, no_review):
    page = os.path.join(HERE, "bot_index.html")
    if not os.path.exists(page):
        print("no bot_index.html — run mkbot.py first")
        return 1
    os.makedirs(SHOTS, exist_ok=True)
    R.reap()
    print("EYES/watch  %s  %dx%d  budgets=%s" % (query, size[0], size[1], budgets))
    print()

    shots, t0 = [], time.time()
    for i, b in enumerate(budgets, 1):
        png = os.path.join(SHOTS, "watch_%d.png" % b)
        sys.stdout.write("[%d/%d] %6d ms ... " % (i, len(budgets), b)); sys.stdout.flush()
        # render=True is implied by --screenshot; the watch mode needs real
        # frames, so NO_RENDER would hand back an empty canvas.
        res, secs, bad, tries = R.escalate(page, budget=b, query=query,
                                           shot=png, size=size,
                                           profile=os.path.join(HERE, "cdata_eyes"))
        ok = os.path.exists(png) and os.path.getsize(png) > 2000
        print("%5.1fs  %s" % (secs, "%d KB" % (os.path.getsize(png)//1024) if ok else "NO PNG"))
        if ok:
            shots.append(png)

    if not shots:
        print("nothing photographed")
        return 1
    if no_review:
        print("\n%d shots in %s" % (len(shots), SHOTS))
        return 0

    print("\nlooking ... ", end=""); sys.stdout.flush()
    if agybridge is None or not agybridge.available("vision"):
        st = agybridge.status() if agybridge else {}
        print("SKIP  no vision backend (key=%s)" % st.get("gemini_key"))
        return 0
    r = agybridge.vision(RUBRIC, files=shots, schema=SCHEMA)
    if not r.ok:
        print("SKIP  %s" % r.reason)
        return 0
    d = r.data or {}
    print("%.1fs  %s  %s" % (r.seconds, d.get("verdict", "?").upper(),
                             d.get("one_line", "")))
    for k in ("game_drawing", "panel_alive", "made_progress"):
        print("   %-14s %s" % (k, d.get(k)))
    if d.get("error_text"):
        print("   error         %s" % d["error_text"][:120])
    for s in (d.get("steps_seen") or []):
        print("   step          %s" % s)
    for i in (d.get("issues") or [])[:5]:
        print("   - %s" % i[:100])
    print("\n%.0fs total" % (time.time() - t0))
    with open(os.path.join(SHOTS, "watch_report.json"), "w", encoding="utf-8") as fh:
        json.dump(d, fh, indent=1, ensure_ascii=False)
    return 1 if d.get("verdict") == "fail" else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--q", default="watch&dungeon&lights=0",
                    help="query for bot_index.html")
    ap.add_argument("--budgets", default="4000,12000,25000")
    ap.add_argument("--size", default="1100x720")
    ap.add_argument("--no-review", action="store_true")
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.lower().split("x"))
    return run(a.q, [int(x) for x in a.budgets.split(",")], (w, h), a.no_review)


if __name__ == "__main__":
    sys.exit(main())
