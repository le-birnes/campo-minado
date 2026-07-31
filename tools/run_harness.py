"""Build an instrumented copy of the game and run it in headless Chrome.

usage: python run.py <harness.js> [out.html] [--budget MS] [--shot PNG WxH]

The harness is injected just before the game's IIFE closes, so it can see G,
genWorld, shoot, mark and everything else without any of it being exported.
It must end by writing document.body.dataset.r.
"""
import subprocess, sys, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(os.path.dirname(HERE), "index.html")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

CLOSE = "\nrequestAnimationFrame(frame);\n\n})();"


def build(harness_path, out_path):
    src = open(GAME, encoding="utf-8").read()
    js = open(harness_path, encoding="utf-8").read()
    assert src.count(CLOSE) == 1, "IIFE close anchor matched %d times" % src.count(CLOSE)
    src = src.replace(CLOSE, "\nrequestAnimationFrame(frame);\n\n" + js + "\n})();")
    open(out_path, "w", encoding="utf-8").write(src)
    return out_path


def run(html, budget=6000, shot=None, size=None):
    args = [CHROME, "--headless=new", "--disable-gpu", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--no-first-run", "--no-sandbox",
            # ABSOLUTE, always. A relative --user-data-dir makes Chrome pop a
            # GUI error dialog on the user's actual screen ("nao pode ler e
            # gravar neste diretorio de dados"). It has done it twice. abspath
            # here means no caller can reintroduce it by setting HERE to a
            # relative path.
            "--user-data-dir=" + os.path.abspath(os.path.join(HERE, "cdata_run")),
            "--virtual-time-budget=%d" % budget]
    if size:
        args.append("--window-size=%d,%d" % size)
    if shot:
        args.append("--screenshot=" + shot)
    else:
        args.append("--dump-dom")
    args.append("file:///" + os.path.abspath(html).replace("\\", "/"))
    p = subprocess.run(args, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=900)
    if shot:
        return ""
    m = re.search(r'data-r="([^"]*)"', p.stdout or "")
    if m:
        import html as H
        return H.unescape(m.group(1))
    return "NO data-r  (dom %d bytes)" % len(p.stdout or "")


if __name__ == "__main__":
    a = sys.argv[1:]
    harness = a[0]
    out = os.path.join(HERE, "t_run.html")
    budget = 6000
    shot = None
    size = None
    if "--budget" in a:
        budget = int(a[a.index("--budget") + 1])
    if "--shot" in a:
        i = a.index("--shot")
        shot = os.path.join(HERE, a[i + 1])
        size = tuple(int(v) for v in a[i + 2].split("x"))
    build(harness, out)
    r = run(out, budget, shot, size)
    if shot:
        print("screenshot ->", shot)
    else:
        for part in r.split(" | "):
            print(part)
