"""Run the playtest bot. `--quick` plays Apprentice only: 300 cells, seconds.

Same safeguards as run_harness: the whole Chrome tree is killed on timeout,
orphans are reaped before and after, and the cap is a wall clock ceiling. If
the bot needs longer than the cap, shrink the suite rather than raising it.
"""
import sys, os, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_harness as R

def main():
    quick = "--quick" in sys.argv
    cap = int(sys.argv[sys.argv.index("--cap")+1]) if "--cap" in sys.argv else (120 if quick else 300)
    R.reap()
    subprocess.run([sys.executable, os.path.join(R.HERE, "mkbot.py"), "index.html"],
                   capture_output=True)
    # LIGHTS OFF, unless you ask for them. This is the fix for what looked for
    # weeks like an intermittent hang in the bot and was really the relit cave
    # meeting a software rasteriser: every point light is evaluated per
    # FRAGMENT, headless Chrome draws through SwiftShader on the CPU, and how
    # many lights come into range depends on where the flags and fireflies
    # land — which is why the same build finished in one second or never, with
    # nothing in between and no crash to show for it.
    #
    #   quick, lights ON   2/5 finished   15 15  1  1 15
    #   quick, lights=0    5/5 finished    1  1  1  1  1
    #
    # The bot does not look at anything, so it loses nothing. Pass --lit when
    # you specifically want to test the lighting.
    lit = "--lit" in sys.argv
    q = "?quick" if quick else "?"
    if not lit:
        q += ("&" if q != "?" else "") + "lights=0"
    page = os.path.join(R.HERE, "bot_index.html") + q
    # escalate, not run: two twelve-second attempts before any real waiting, so
    # a cold start costs 24 s to rule out instead of the full cap.
    res, secs, bad, tries = R.escalate(page, budget=900000,
                                       profile=os.path.join(R.HERE, "cdata_bot"))
    if tries > 1:
        print("(%d attempts - the first was almost certainly the cold start)" % tries)
    print("[%.0fs] %s" % (secs, "QUICK Apprentice" if quick else "full suite"))
    print(res)
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
