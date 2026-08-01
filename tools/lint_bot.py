"""Cross-check the bot against the hook it reaches through.

The bot lives inside the game's closure and can only see what mkbot.py's hook
exports and what the bot then destructures. Those are TWO hand-written lists,
and when they disagree nothing complains: JavaScript only objects at the moment
the name is evaluated, and `node --check` validates syntax, not references. So a
missing name sails through every check and then throws deep inside a dungeon
run, minutes later, in a code path the fast Apprentice test cannot reach.

That has happened twice — aimRay, then ETYPES. This is the check that makes it
stop happening: every bare identifier the bot uses must be declared locally,
destructured from the hook, or a known global. Anything else is reported.

    python tools/lint_bot.py
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BOT = os.path.join(HERE, "bot.js")
MK = os.path.join(HERE, "mkbot.py")

GLOBALS = set("""
window document console Math JSON Object Array String Number Boolean Date Error
Promise Set Map Symbol RegExp isFinite isNaN parseInt parseFloat performance
setTimeout setInterval clearTimeout clearInterval requestAnimationFrame
Float32Array Int32Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array
undefined NaN Infinity location navigator true false null this arguments
""".split())

KEYWORDS = set("""
break case catch class const continue debugger default delete do else export
extends finally for function if import in instanceof let new return super switch
throw try typeof var void while with yield async await of get set static from as
""".split())


def main():
    src = open(BOT, encoding="utf-8").read()
    mk = open(MK, encoding="utf-8").read()

    # what the hook exposes
    hook = re.search(r"window\.__T = \{(.*?)\n\};", mk, re.S)
    exported = set()
    if hook:
        # ONLY top-level keys. The hook holds inline helper functions, and
        # harvesting every `name,` in the block picks up THEIR locals too --
        # which is how `dy` got reported as a missing export and buried the
        # real answer in noise.
        for line in hook.group(1).split("\n"):
            if not re.match(r"^  \S", line):
                continue
            m2 = re.match(r"^  (\w+)\s*:", line)
            if m2:
                exported.add(m2.group(1))
                continue
            if ":" in line or "(" in line:
                continue
            exported |= set(w.strip() for w in line.strip().rstrip(",").split(",") if w.strip())

    # what the bot binds out of it
    dest = re.search(r"const \{(.*?)\} = T;", src, re.S)
    imported = set(x.strip() for x in dest.group(1).replace("\n", " ").split(",") if x.strip())

    # what the bot declares for itself
    local = set(re.findall(r"\bfunction\s+(\w+)", src))
    local |= set(re.findall(r"\b(?:const|let|var)\s+(\w+)", src))
    local |= set(re.findall(r"\bfunction\s*\w*\s*\(([^)]*)\)", src) and
                 [p.strip().split("=")[0].strip()
                  for grp in re.findall(r"\bfunction\s*\w*\s*\(([^)]*)\)", src)
                  for p in grp.split(",") if p.strip()])
    # arrow params and for/catch bindings, loosely
    local |= set(re.findall(r"\(?\s*(\w+)\s*\)?\s*=>", src))
    local |= set(re.findall(r"for\s*\(\s*(?:const|let|var)\s+\[?([\w,\s]+)\]?", src))
    local |= set(re.findall(r"catch\s*\(\s*(\w+)", src))
    local |= set(re.findall(r"const \[([\w,\s]+)\]", src))
    local = set(w.strip() for chunk in local for w in str(chunk).split(",") if w.strip())

    # strip strings, template literals, comments and property accesses before
    # harvesting identifiers, or every `.foo` and every word in a message counts
    body = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    body = re.sub(r"//[^\n]*", " ", body)
    body = re.sub(r"`(?:[^`\\]|\\.)*`", " ", body)
    body = re.sub(r"'(?:[^'\\]|\\.)*'", " ", body)
    body = re.sub(r'"(?:[^"\\]|\\.)*"', " ", body)
    body = re.sub(r"\.\s*\w+", " ", body)          # property accesses
    body = re.sub(r"(\w+)\s*:", " ", body)         # object keys

    used = set(re.findall(r"\b([A-Za-z_$][\w$]*)\b", body))
    known = local | imported | GLOBALS | KEYWORDS
    missing = sorted(n for n in used - known if not n.isupper() or n in exported)
    # a name the hook exports and the bot uses but never bound is the fatal case
    fatal = sorted(n for n in (used - known) if n in exported)
    drift = sorted(exported - imported)

    print("hook exports %d names, bot binds %d" % (len(exported), len(imported)))
    if fatal:
        print("\nFATAL — used by the bot, exported by the hook, NEVER BOUND:")
        for n in fatal:
            line = next((i + 1 for i, l in enumerate(src.split("\n"))
                         if re.search(r"\b%s\b" % re.escape(n), l)), "?")
            print("   %-22s first used at bot.js:%s" % (n, line))
    else:
        print("\nno unbound names: every game symbol the bot uses is bound")

    if missing and not fatal:
        odd = [n for n in missing if n not in exported]
        if odd:
            print("\nunrecognised (probably fine — locals this parser missed):")
            print("   " + ", ".join(odd[:25]))

    if drift:
        print("\nexported but never bound (harmless, but the lists have drifted):")
        print("   " + ", ".join(drift))

    return 1 if fatal else 0


if __name__ == "__main__":
    sys.exit(main())
