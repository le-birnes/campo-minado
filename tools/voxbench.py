"""Run one of the standalone voxel/*.html benches and print what it measured.

usage:
  python voxbench.py bench          voxel/bench.html
  python voxbench.py front tet      several, in order
  python voxbench.py bench --budget 30000

The voxel pages are not index.html, so run_harness.build's IIFE injection does
not apply: escalate() drives the file URL straight off disk. Everything else
still holds — the cold-start ladder, the total cap, the reap fingerprint, the
throwaway profile.

Each page ends by writing document.body.dataset.r as its log joined with '~',
because the harness reads that attribute with a regex and a newline inside it
reads as no attribute at all. This unjoins it.
"""
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import run_harness as R

VOX = os.path.join(os.path.dirname(HERE), "voxel")


def one(name, budget):
    page = os.path.join(VOX, name if name.endswith(".html") else name + ".html")
    if not os.path.exists(page):
        print("no such page: %s" % page)
        return 1
    print("=" * 78)
    print("%s   budget=%d ms" % (os.path.basename(page), budget))
    res, secs, bad, tries = R.escalate(page, budget=budget,
                                       profile=os.path.join(HERE, "cdata_vox"))
    print("%.1fs, %d attempt(s)%s" % (secs, tries, "  TIMED OUT" if bad else ""))
    print("-" * 78)
    print(res.replace("~", "\n"))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pages", nargs="+")
    ap.add_argument("--budget", type=int, default=20000,
                    help="virtual time budget in ms; benches need more than a page does")
    a = ap.parse_args()
    R.reap()
    rc = 0
    for p in a.pages:
        rc |= one(p, a.budget)
    R.reap()
    return rc


if __name__ == "__main__":
    sys.exit(main())
