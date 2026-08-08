"""THE MAP OF index.html, and it is generated, never written.

Marcelo: "You should be able to read it by sections (with 'links' in each
section on the comments for you to know what interacts with what) and won't
need to load the whole game into context (more than 14000 lines) when working
on it. The links are extremely important for you not to mess with things and
break others."

WHY NOT LINE NUMBERS. He asked for the map to survive edits and suggested
storing distances rather than positions. Distances have the same disease as
positions - insert forty lines anywhere above and every later number is wrong,
proportional or not. So the map addresses sections by ANCHOR: the exact banner
text, which is unique in the file and moves with the code it names. Line spans
appear in the map too, but only because they are recomputed on every run and
`show` resolves them live. Nothing is hand-maintained and nothing is trusted.

WHAT THE LINKS ARE. Not hand-written prose that goes stale on the first edit.
Every top-level name is attributed to the section that declares it, every
section is scanned for names declared elsewhere, and the section-to-section
graph falls out. That gives each section three lists that matter:

    surface   names this section declares that OTHER sections use
              -> rename one of these and something far away breaks
    private   names only this section uses
              -> free to change
    uses / used by
              -> who to read before touching it

usage:
  python tools/map.py              rebuild MAP.md and the MAP lines in the file
  python tools/map.py --check      exit 1 if either is stale, and say what moved
  python tools/map.py show sky     where that section is RIGHT NOW
  python tools/map.py show sky -b  ...and print it, numbered, ready to edit
  python tools/map.py where gravAt who declares that name and who calls it
  python tools/map.py big          the sections that are too big to have one job
"""
import os, re, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(os.path.dirname(HERE), "index.html")
MAP  = os.path.join(os.path.dirname(HERE), "MAP.md")

BANNER = re.compile(r"^/\* ={20,}\s*$")
CLOSE  = re.compile(r"^\s*={20,} \*/\s*$")
# The MAP line is its OWN one-line comment placed straight after the banner,
# not a line inside it. Half the banners in this file close with a bar of
# equals signs and half close with "...last sentence. */", and there is nowhere
# inside the second kind to put a machine-owned line without rewriting prose.
# After the comment ends is safe for both. The bare "   MAP" form was the first
# attempt and is still matched here so it gets cleaned up wherever it landed.
MAPLN  = re.compile(r"^(?:/\* MAP\b|   MAP\b)")
# COLUMN ZERO ONLY. Two spaces of slack let every `const best = null`
# inside a shallow function count as a top-level name, and the map filled
# up with locals - `surf`, `sgn`, `day`, `col` - which is exactly the kind
# of false link that makes the true ones worthless.
DECL   = re.compile(r"^(?:async\s+)?(?:function|class|const|let|var)\s+"
                    r"([A-Za-z_$][\w$]*)")
IDENT  = re.compile(r"[A-Za-z_$][\w$]*")

# Names that are declared here but are also ordinary English or ordinary
# JavaScript, so finding them in another section's PROSE proves nothing. A link
# has to be worth reading; a hundred false ones make the real ones invisible.
NOISE = {"i", "j", "k", "n", "t", "x", "y", "z", "w", "h", "d", "s", "c", "b",
         "a", "e", "f", "g", "m", "p", "q", "r", "u", "v", "of", "in", "at",
         "on", "up", "to", "is", "it", "a", "one", "two", "out", "col", "pos",
         "len", "top", "end", "max", "min", "sum", "all", "now", "old", "new",
         # GLSL. The shaders are template literals, so `const float ATM = ...`
         # sits at column zero inside a string and reads as a JavaScript
         # declaration named `float`. Tracking backticks across 14,000 lines to
         # avoid eight words is not worth the failure modes.
         "float", "int", "bool", "vec2", "vec3", "vec4", "mat3", "mat4",
         "uint", "ivec2", "ivec3", "ivec4", "sampler2D", "highp", "lowp"}


def slug(title):
    """A short stable id from a banner title. Stable is the point: it is what
    makes two runs of this tool diffable."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    t = re.sub(r"^\d+[a-z]?\.\s*", "", t)              # drop "12b. "
    t = re.sub(r"[^A-Za-z0-9 ]+", " ", t).lower()
    words = [w for w in t.split() if w not in
             ("the", "and", "a", "an", "of", "is", "it", "in", "to", "what",
              "that", "for", "on", "as", "one", "its", "his", "you", "are")]
    return "-".join(words[:3]) or "section"


def read():
    with open(GAME, encoding="utf-8", newline="") as fh:
        return fh.read().split("\n")


class Sec(object):
    def __init__(self, sid, title, a, b, anchor):
        self.id, self.title, self.a, self.b = sid, title, a, b
        self.anchor = anchor                  # 1-based inclusive line span a..b
        self.about = ""
        self.declares, self.surface, self.private = [], [], []
        self.uses, self.usedby = {}, {}

    @property
    def n(self):
        return self.b - self.a + 1


def sections(lines):
    """Cut the file at its own banners. The banners were already there - this
    reads the structure the file has rather than imposing one on it."""
    starts = [i for i, L in enumerate(lines) if BANNER.match(L)]
    out = []
    if not starts:
        return out
    if starts[0] > 0:
        out.append(Sec("document-head", "(document head)", 1, starts[0],
                       "<!doctype"))
    for si, i in enumerate(starts):
        end = (starts[si + 1] - 1) if si + 1 < len(starts) else len(lines) - 1
        title = ""
        for j in range(i + 1, min(i + 4, len(lines))):
            if lines[j].strip():
                title = lines[j].strip()
                break
        out.append(Sec(slug(title), title, i + 1, end + 1, title))
    # ids must be unique or `show` is a coin toss
    seen = {}
    for s in out:
        if s.id in seen:
            seen[s.id] += 1
            s.id = "%s-%d" % (s.id, seen[s.id])
        else:
            seen[s.id] = 1
    return out


def prose(lines, s):
    """The first sentence of the banner, which is nearly always the one that
    says what the section is for."""
    buf = []
    for L in lines[s.a + 1:min(s.b, s.a + 42)]:   # past the banner's own title
        if CLOSE.match(L):
            break
        t = L.strip()
        if not t or set(t) <= set("-=") or MAPLN.match(L):
            continue
        buf.append(t)
    txt = " ".join(buf)
    txt = re.sub(r"\s+", " ", txt).strip()
    m = re.search(r"^(.{20,200}?[.!?])(\s|$)", txt)
    return (m.group(1) if m else txt[:180]).strip()


def analyse(lines, secs):
    owner = {}
    for s in secs:
        for L in lines[s.a - 1:s.b]:
            m = DECL.match(L)
            if m and m.group(1) not in NOISE and len(m.group(1)) > 2:
                if m.group(1) not in owner:          # first declaration wins
                    owner[m.group(1)] = s.id
                    s.declares.append(m.group(1))
    by = {s.id: s for s in secs}
    for s in secs:
        toks = set()
        for L in lines[s.a - 1:s.b]:
            toks.update(IDENT.findall(L))
        mine = set(s.declares)
        # SORTED, and it matters: a set's iteration order depends on the
        # process hash seed, so an unsorted pass here made the map differ
        # between two runs over identical bytes and --check cried stale.
        for name in sorted(toks & set(owner)):
            o = owner[name]
            if o != s.id:
                s.uses.setdefault(o, []).append(name)
        # what OF MINE the rest of the file leans on
        for name in mine:
            s.private.append(name)
    for s in secs:
        for o, names in s.uses.items():
            by[o].usedby.setdefault(s.id, []).extend(names)
    for s in secs:
        used = set()
        for names in s.usedby.values():
            used.update(names)
        s.surface = sorted(used)
        s.private = sorted(set(s.private) - used)
        s.about = prose(lines, s)
    return owner


def lst(names, cap=10):
    if not names:
        return "-"
    head = ", ".join(names[:cap])
    return head + (" +%d" % (len(names) - cap) if len(names) > cap else "")


def links(d, by, cap=6):
    if not d:
        return "-"
    ranked = sorted(d.items(), key=lambda kv: (-len(set(kv[1])), kv[0]))
    return ", ".join("%s(%d)" % (by[o].title.split("(")[0].strip()[:26] or o,
                                 len(set(v))) for o, v in ranked[:cap]) + \
           (" +%d" % (len(ranked) - cap) if len(ranked) > cap else "")


def render(lines, secs):
    tot = len(lines)
    o = []
    o.append("# MAP — `index.html`, %s lines" % f"{tot:,}")
    o.append("")
    o.append("Generated by `tools/map.py`. **Do not edit.** Rebuild after any"
             " change to the file: `python tools/map.py`, and"
             " `python tools/map.py --check` says whether it is stale.")
    o.append("")
    o.append("**Jump by anchor, not by line number.** A section's *anchor* is"
             " its title, which is unique in the file and travels with the"
             " code it names. `python tools/map.py show <id>` resolves it and"
             " prints the span it occupies **right now**; add `-b` to print"
             " the body numbered and ready to edit. The line numbers below are"
             " recomputed on every run — a convenience, not the address.")
    o.append("")
    o.append("**Before you change a section, read its `used by`.** `surface`"
             " is the set of names other sections call: rename one and"
             " something far away breaks. Anything a section declares that is"
             " *not* in its surface is private to it and free to change."
             " `python tools/map.py where <name>` answers it for one name.")
    o.append("")
    o.append("The same three lists sit in the file itself, on a `/* MAP ... */`"
             " line under each banner, so they are there when you are reading"
             " code rather than reading this.")
    o.append("")
    by = {s.id: s for s in secs}
    o.append("## Contents")
    o.append("")
    o.append("| id | section | lines | %% of %s |" % f"{tot:,}")
    o.append("|---|---|--:|--:|")
    for s in secs:
        o.append("| `%s` | %s | %d | %.1f |" % (
            s.id, s.title.replace("|", "/"), s.n, 100.0 * s.n / tot))
    o.append("")
    o.append("## The sections")
    for s in secs:
        o.append("")
        o.append("#### `%s` · %s · %d–%d (%d lines)"
                 % (s.id, s.title, s.a, s.b, s.n))
        o.append("%s" % (s.about or "—"))
        o.append("**surface** %s" % lst(s.surface, 12))
        o.append("**uses** %s &nbsp;&nbsp;**used by** %s"
                 % (links(s.uses, by, 6), links(s.usedby, by, 6)))
    o.append("")
    return "\n".join(o)


def maplines(lines, secs):
    """Put the links INSIDE the banners, where they are read. Owned by this
    script: the line is replaced wholesale every run, so it cannot drift."""
    by = {s.id: s for s in secs}
    out, ins = list(lines), 0
    for s in secs:
        if s.id == "document-head":
            continue
        txt = ("/* MAP %s · %d lines · surface: %s · uses: %s · used by: %s */"
               % (s.id, s.n, lst(s.surface, 8), links(s.uses, by, 4),
                  links(s.usedby, by, 4)))
        # the comment ends at the FIRST */ after the banner opens, because
        # comments do not nest - so this is the same line the parser stops at
        close = None
        for j in range(s.a - 1 + ins, min(s.b + ins, len(out))):
            if "*/" in out[j]:
                close = j
                break
        if close is None:
            continue
        if close + 1 < len(out) and MAPLN.match(out[close + 1]):
            out[close + 1] = txt
        else:
            out.insert(close + 1, txt)
            ins += 1
    return out


def build():
    lines = read()
    lines = [L for L in lines if not MAPLN.match(L)]     # start from clean
    secs = sections(lines)
    analyse(lines, secs)
    body = render(lines, secs)
    return lines, secs, body


def main():
    a = sys.argv[1:]
    if a and a[0] == "show":
        lines = read()
        secs = sections(lines)
        hit = [s for s in secs if s.id == a[1]] or \
              [s for s in secs if a[1].lower() in s.id or a[1].lower() in s.title.lower()]
        if not hit:
            print("no section like %r. try: python tools/map.py" % a[1])
            return 1
        for s in hit[:4]:
            print("%-22s %s" % (s.id, s.title))
            print("  lines %d-%d  (%d lines)   anchor: %s" % (s.a, s.b, s.n, s.anchor))
            if "-b" in a or "--body" in a:
                for i in range(s.a - 1, s.b):
                    print("%6d\t%s" % (i + 1, lines[i]))
        return 0
    if a and a[0] == "where":
        lines = read()
        secs = sections(lines)
        owner = analyse(lines, secs)
        name = a[1]
        if name not in owner:
            print("%r is not a top-level name in the file" % name)
            return 1
        by = {s.id: s for s in secs}
        home = by[owner[name]]
        print("%s is declared in `%s` (%s), lines %d-%d"
              % (name, home.id, home.title, home.a, home.b))
        callers = [s.id for s in secs if name in
                   sum(s.uses.values(), [])]
        print("called from: %s" % (", ".join(callers) or "nowhere else"))
        return 0
    if a and a[0] == "big":
        lines, secs, _ = build()
        for s in sorted(secs, key=lambda s: -s.n)[:12]:
            print("%6d  %-22s %s" % (s.n, s.id, s.title))
        return 0

    lines, secs, body = build()
    if "--check" in a:
        cur = open(MAP, encoding="utf-8").read() if os.path.exists(MAP) else ""
        if cur.strip() != body.strip():
            print("MAP.md is STALE — run: python tools/map.py")
            return 1
        print("MAP.md is current (%d sections, %d lines of game)"
              % (len(secs), len(lines)))
        return 0
    with open(MAP, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(body)
    out = maplines(lines, secs)
    with open(GAME, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(out))
    print("MAP.md: %d sections over %d lines. index.html: %d -> %d lines."
          % (len(secs), len(lines), len(lines), len(out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
