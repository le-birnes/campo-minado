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
    cap = int(sys.argv[sys.argv.index("--cap")+1]) if "--cap" in sys.argv else (120 if quick else 900)
    R.reap()
    subprocess.run([sys.executable, os.path.join(R.HERE, "mkbot.py"), "index.html"],
                   capture_output=True)
    page = os.path.join(R.HERE, "bot_index.html") + ("?quick" if quick else "")
    res, secs, bad = R.run(page, budget=900000, cap=cap,
                           profile=os.path.join(R.HERE, "cdata_bot"))
    print("[%.0fs] %s" % (secs, "QUICK Apprentice" if quick else "full suite"))
    print(res)
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
