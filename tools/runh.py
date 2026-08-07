"""Run a harness in its OWN Chrome profile, so two runs can overlap.

run_harness.py uses one fixed profile directory and reaps anything carrying it,
so starting a second run kills the first - which looked like a harness that
threw before its first write, twice, and cost two debugging passes. This is the
same build and the same launch with a profile named after the harness.

usage: python runh.py <harness.js> [--shot NAME WxH] [--budget MS] [--q QS]
"""
import os, sys, re, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_harness as R


def main():
    a = sys.argv[1:]
    harness = a[0]
    tag = re.sub(r"\W+", "", os.path.splitext(os.path.basename(harness))[0])
    shot = size = query = None
    budget = 8000
    cap = R.CAP_DEFAULT
    if "--shot" in a:
        i = a.index("--shot")
        shot = os.path.join(R.HERE, a[i + 1])
        w, h = a[i + 2].lower().split("x")
        size = (int(w), int(h))
    if "--budget" in a: budget = int(a[a.index("--budget") + 1])
    if "--cap" in a:    cap = int(a[a.index("--cap") + 1])
    if "--q" in a:      query = a[a.index("--q") + 1]

    prof = os.path.join(R.HERE, "cdata_" + tag)
    out = os.path.join(R.HERE, "cdata_%s.html" % tag)
    R.build(os.path.join(R.HERE, os.path.basename(harness)), out, render=bool(shot))
    res, secs, bad = R.run(out, budget, shot, size, cap, profile=prof, query=query)
    print("[%.1fs] %s" % (secs, res))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
