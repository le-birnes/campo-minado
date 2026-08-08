"""Run a harness in its OWN Chrome profile, so two runs can overlap.

run_harness.py uses one fixed profile directory and reaps anything carrying it,
so starting a second run kills the first - which looked like a harness that
threw before its first write, twice, and cost two debugging passes. This is the
same build and the same launch with a profile named after the harness.

usage: python runh.py <harness.js> [--shot NAME WxH] [--render] [--budget MS]
                                   [--q QS]

--shot photographs the run but Chrome will not also dump the DOM, so a harness
that MEASURES what was drawn cannot report through it. --render turns drawing
on without taking the picture, which is the mode a readPixels harness needs.
Without either, requestAnimationFrame is stubbed out and nothing is ever drawn.
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
    render = bool(shot) or "--render" in a
    if "--render" in a and size is None and "--size" in a:
        w, h = a[a.index("--size") + 1].lower().split("x")
        size = (int(w), int(h))

    # A HARNESS THAT DOES NOT PARSE RUNS NOTHING AT ALL, and Chrome then sits
    # out its whole virtual-time budget in silence - which reads as a hang and
    # has cost this project two debugging passes and, once, a revert of correct
    # code. node checks it in twenty milliseconds. Do it before Chrome starts.
    import subprocess
    chk = subprocess.run(["node", "--check", harness], capture_output=True, text=True)
    if chk.returncode != 0:
        print("HARNESS DOES NOT PARSE - nothing would have run:")
        print(chk.stderr.strip()[:800])
        sys.exit(2)

    prof = os.path.join(R.HERE, "cdata_" + tag)
    out = os.path.join(R.HERE, "cdata_%s.html" % tag)
    R.build(os.path.join(R.HERE, os.path.basename(harness)), out, render=render)
    res, secs, bad = R.run(out, budget, shot, size, cap, profile=prof, query=query)
    print("[%.1fs] %s" % (secs, res))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
