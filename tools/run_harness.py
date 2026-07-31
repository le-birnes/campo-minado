"""Build an instrumented copy of the game and run it in headless Chrome.

usage: python run_harness.py <harness.js> [--budget MS] [--cap SECONDS]
                             [--shot NAME WxH] [--reap]

The harness is injected just before the game's IIFE closes, so it can see G,
genWorld, shoot, mark and everything else without any of it being exported.
It must end by writing document.body.dataset.r.

SAFETY, and none of it is optional
-----------------------------------
A harness that loops forever blocks Chrome's main thread. Chrome then never
serialises the DOM, --virtual-time-budget never expires, and the process spins
at 100% of a core until something kills it. If the PYTHON wrapper is what times
out, it dies and leaves Chrome running. Two of those reached 10,013 and 1,496
seconds of CPU in one session, starved every later run, and made harnesses that
finish in one second look like they were hanging — which sent me hunting bugs
that did not exist, and slowed the machine while Marcelo was playing on it.

So:
  * every launch goes through Popen and is killed with `taskkill /T /F` on
    timeout, which takes the whole process tree rather than just the parent;
  * every run reaps orphaned headless Chrome before it starts and after it
    finishes, so nothing survives one call into the next;
  * CAP is a wall-clock ceiling and it is deliberately small. If a run needs
    longer, the harness is too big — shrink the board or the sample size, do
    not raise the cap;
  * the throwaway profile directory is deleted afterwards;
  * a timeout is reported as "endless loop", not "slow", because on a blocked
    main thread that is what it always is.

Reaping only ever kills Chrome carrying THIS TOOL'S OWN profile directory in
its command line. Matching on "--headless" alone was a serious mistake:
E:/FerrariVoz/wpp/wpp_queue_sender.mjs drives its own headless Chrome, and a
broad reap killed that WhatsApp session repeatedly. Never kill by "looks like
something I might have started" — only by a fingerprint you know is yours.

Always run the smallest case that can show the bug: Apprentice is 300 cells,
the dungeon is 7776.
"""
import subprocess, sys, os, re, shutil, time, html as H

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(os.path.dirname(HERE), "index.html")
CAP_DEFAULT = 120          # seconds of wall clock. Small on purpose.

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

CLOSE = "\nrequestAnimationFrame(frame);\n\n})();"


# Every profile this tool ever creates lives under here, and the path appears
# in the command line as --user-data-dir. That is the ONLY thing reap matches
# on. Matching on "--headless" alone was a serious mistake: Marcelo runs
# E:/FerrariVoz/wpp/wpp_queue_sender.mjs, a WhatsApp queue sender that drives
# its own headless Chrome, and a broad reap killed that browser over and over.
# Never kill by "looks like a browser I might have started" — kill only what
# carries this tool's own fingerprint.
MARK = os.path.join(HERE, "cdata").replace("\\", "/").lower()


def reap(verbose=False):
    """Kill ONLY the headless Chrome this tool started, identified by its
    throwaway profile directory. Never anything else."""
    killed = []
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | "
             "Where-Object { $_.CommandLine -like '*--headless*' -and "
             "$_.CommandLine -like '*" + MARK.replace("/", "\\") + "*' } | "
             "Select-Object -ExpandProperty ProcessId"],
            capture_output=True, text=True, timeout=30)
        for line in (out.stdout or "").split():
            pid = line.strip()
            if not pid.isdigit():
                continue
            subprocess.run(["taskkill", "/PID", pid, "/T", "/F"],
                           capture_output=True, timeout=20)
            killed.append(pid)
    except Exception:
        pass
    if verbose:
        print("reaped headless chrome:", ", ".join(killed) if killed else "none")
    return killed


def build(harness_path, out_path):
    src = open(GAME, encoding="utf-8").read()
    js = open(harness_path, encoding="utf-8").read()
    assert src.count(CLOSE) == 1, "IIFE close anchor matched %d times" % src.count(CLOSE)
    src = src.replace(CLOSE, "\nrequestAnimationFrame(frame);\n\n" + js + "\n})();")
    open(out_path, "w", encoding="utf-8").write(src)
    return out_path


def run(html_path, budget=8000, shot=None, size=None, cap=CAP_DEFAULT, profile=None):
    """Returns (result, seconds, timed_out)."""
    # ABSOLUTE, always: a relative --user-data-dir makes Chrome pop a GUI error
    # dialog on the user's own screen. It has done that twice.
    prof = os.path.abspath(profile or os.path.join(HERE, "cdata_run"))
    assert "cdata" in os.path.basename(prof), "profile must carry the reap fingerprint"
    os.makedirs(prof, exist_ok=True)
    args = [CHROME, "--headless=new", "--disable-gpu", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--no-first-run", "--no-sandbox",
            "--user-data-dir=" + prof,
            "--virtual-time-budget=%d" % budget]
    if size:
        args.append("--window-size=%d,%d" % size)
    if shot:
        args.append("--screenshot=" + os.path.abspath(shot))
    else:
        args.append("--dump-dom")
    args.append("file:///" + os.path.abspath(html_path).replace("\\", "/"))

    t0 = time.time()
    p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                         text=True, encoding="utf-8", errors="replace")
    timed_out, out = False, ""
    try:
        out, _ = p.communicate(timeout=cap)
    except subprocess.TimeoutExpired:
        timed_out = True
        # /T so the renderer children go too. Killing the parent alone leaves
        # the process that is actually burning the CPU alive.
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"],
                       capture_output=True, timeout=20)
        try:
            p.communicate(timeout=10)
        except Exception:
            pass
    secs = time.time() - t0
    reap()
    shutil.rmtree(prof, ignore_errors=True)

    if timed_out:
        return ("TIMED OUT after %.0fs. Before assuming an endless loop, rule "
                "out the two cheaper explanations, both of which look identical "
                "from here: an identifier in the harness colliding with one the "
                "game already declares, which is a parse error so NOTHING runs; "
                "and the game's own render loop grinding through the "
                "virtual-time budget under software GL." % secs, secs, True)
    if shot:
        return ("screenshot written", secs, False)
    m = re.search(r'data-r="([^"]*)"', out or "")
    if m:
        return (H.unescape(m.group(1)), secs, False)
    return ("NO data-r (dom %d bytes) — the harness threw before reporting, or "
            "blocked before its first write" % len(out or ""), secs, False)


def main():
    a = sys.argv[1:]
    if "--reap" in a:
        reap(verbose=True)
        a = [x for x in a if x != "--reap"]
        if not a:
            return
    harness = a[0]
    budget = int(a[a.index("--budget") + 1]) if "--budget" in a else 8000
    cap = int(a[a.index("--cap") + 1]) if "--cap" in a else CAP_DEFAULT
    shot = size = None
    if "--shot" in a:
        i = a.index("--shot")
        shot = os.path.join(HERE, a[i + 1])
        size = tuple(int(v) for v in a[i + 2].split("x"))

    reap()
    out = os.path.join(HERE, "t_run.html")
    build(harness, out, render=bool(shot))
    res, secs, bad = run(out, budget, shot, size, cap)
    print("[%.1fs]" % secs)
    for part in res.split(" | "):
        print(part)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
