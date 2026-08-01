"""Author the hell-sprite artwork and splice it into index.html.

Pixel art, drawn by hand, one character per pixel. Nothing here is lifted from
anyone's sprite sheet — id Software's art is theirs. What is borrowed is the
IDIOM: a small grid of chunky pixels, hard shading, a hard alpha edge, one
front-facing frame that always turns to the player. That is what makes a room
feel like 1993, not any particular row of pixels.

Shape is drawn once here; COLOUR comes from the creature's own ramp at build
time, which is how the Doom sprites worked too — Baron and Hell Knight are the
same drawing in two palettes, and Spectre is the Demon rendered near-invisible.

Every grid is asserted rectangular before it is emitted. A ragged row would
shear the whole sprite and be very hard to see in a 1024px texture.

    . transparent    k outline/darkest   d dark body   m mid body
    l light body     h highlight         w bone/teeth  g dark metal
    G light metal    e eye               r dark red    R bright red
    y fire
"""
import re, sys, os

ART = {}

# --------------------------------------------------------------- foot soldiers
ART['zombie'] = [
    '........kkkkk.........',
    '.......kdwwwdk........',
    '.......kwlllwk........',
    '.......kweewwk........',
    '.......kwlllwk........',
    '........kwwwk.........',
    '......kkkdddkkk.......',
    '.....kdmmmmmmmdk......',
    '....kdmmmmmmmmmdk.....',
    '....kdmmmlllmmmdk.....',
    '....kdmmmlllmmmdk.....',
    '....kdmmmmmmmmmdk.....',
    '...kkdmmmmmmmmmdkk....',
    '...kgGGGGGGGGGgkdk....',
    '...kdmmmmmmmmmmmdk....',
    '....kdmmmmmmmmmdk.....',
    '.....kdmmmmmmmdk......',
    '.....kdmmmmmmmdk......',
    '.....kdmmkkkmmdk......',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kddk.kddk........',
    '.....kkkk.kkkk........',
    '......................',
]

ART['sarge'] = [
    '........kkkkk.........',
    '.......kdwwwdk........',
    '.......kwlllwk........',
    '.......kweewwk........',
    '.......kwlllwk........',
    '.......kkwwwkk........',
    '.....kkkddddkkk.......',
    '....kdmmmmmmmmdk......',
    '....kdmmmmmmmmmdk.....',
    '...kdmmmhhhhhmmmdk....',
    '...kdmmmhhhhhmmmdk....',
    '...kdmmmmmmmmmmmdk....',
    '..kkdmmmmmmmmmmmdkk...',
    '..kgGGGGGGGGGGGGgdk...',
    '..kgGGGGGGGGGGGGgdk...',
    '...kdmmmmmmmmmmmdk....',
    '....kdmmmmmmmmmdk.....',
    '.....kdmmmmmmmdk......',
    '.....kdmmkkkmmdk......',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '.....kddk.kddk........',
    '.....kkkk.kkkk........',
    '......................',
]

# --------------------------------------------------------------------- the imp
ART['imp'] = [
    '.....k..........k.....',
    '.....kk.kkkkk..kk.....',
    '......kkdmmmdkkk......',
    '.......kmlllmk........',
    '.......keklkek........',
    '.......kmwwwmk........',
    '........kwwwk.........',
    '......kkkdddkkk.......',
    '....kkdmmmmmmmdkk.....',
    '...kdmmmmmmmmmmmdk....',
    '..kdmmmlhhhhhlmmmdk...',
    '..kdmmmlhhhhhlmmmdk...',
    '..kkdmmmmmmmmmmmdkk...',
    'kdmkkdmmmmmmmmmdkkdmk.',
    'kdmk.kdmmmmmmmdk.kdmk.',
    'kwwk.kdmmmmmmmdk.kwwk.',
    '.kk..kdmmmmmmmdk..kk..',
    '.....kdmmmmmmmdk......',
    '.....kdmmkkkmmdk......',
    '.....kdmk.kmdk........',
    '.....kdmk.kmdk........',
    '....kdmmk.kmmdk.......',
    '....kdmk...kmdk.......',
    '...kkwwk...kwwkk......',
    '...kwwwk...kwwwk......',
    '......................',
]

# ------------------------------------------------------------- the flying head
ART['soul'] = [
    '..yy...yy..yy...',
    '.yRy..yRRy.yRy..',
    '.yRRyyRRRyyRRy..',
    '..yRRRwwwRRRy...',
    '...yRwwwwwRy....',
    '..yRwwwwwwwRy...',
    '..ywwwwwwwwwy...',
    '..ywwkkwkkwwy...',
    '..ywwkekwekwwy..',
    '..ywwkkwkkwwy...',
    '...ywwwkwwwy....',
    '...ywwwwwwwy....',
    '...ywkwkwkwy....',
    '..yRwkwkwkwRy...',
    '.yRRykwkwkyRRy..',
    '.yRy..yyy..yRy..',
    '..y...........y.',
    '................',
]

# ---------------------------------------------------------------- the pink one
ART['demon'] = [
    '..kkk..............kkk....',
    '.khhhk............khhhk...',
    '.khhhkk..........kkhhhk...',
    '..kmmmkkkkkkkkkkkkmmmk....',
    '...kkdmmmmmmmmmmmmdkk.....',
    '....kdmmmlmmmmlmmmdk......',
    '....kdmmkekmmkekmmdk......',
    '....kdmmmlmmmmlmmmdk......',
    '...kkdmmmmmmmmmmmmdkk.....',
    '..kdwkwkwkwkwkwkwkwkdk....',
    '..kdrrrrrrrrrrrrrrrrdk....',
    '..kdwkwkwkwkwkwkwkwkdk....',
    '...kdmmmmmmmmmmmmmmdk.....',
    '..kkdmmmmmmmmmmmmmmdkk....',
    '.kdmmdkkmmmmmmmmkkdmmdk...',
    '.kdmmk..kdmmmmdk..kdmmk...',
    '.kdmmk..kdmmmmdk..kdmmk...',
    '.kdmmk..kdmmmmdk..kdmmk...',
    '.kkwwk..kkwwwwkk..kkwwk...',
    '..kwwk...kwwwwk....kwwk...',
]

# ------------------------------------------------------------- the walking dead
ART['revenant'] = [
    '.....kkkwwwkkk........',
    '....kwwwwwwwwwk.......',
    '....kwwkkkkkwwk.......',
    '....kwkekkekwwk.......',
    '....kwwkkkkkwwk.......',
    '....kwwkwkwkwwk.......',
    '.....kwwwwwwwk........',
    '......kkwwwkk.........',
    '..kgggkkwwwkkgggk.....',
    '.kgGGGgkwwwkgGGGgk....',
    '.kgGGGgkwwwkgGGGgk....',
    '.kgggggkwwwkgggggk....',
    '..kkkkkkwwwkkkkkk.....',
    '.....kwkwwwkwk........',
    '.....kwkwwwkwk........',
    '.....kwwkwkwwk........',
    '......kwwwwwk.........',
    '......kwwwwwk.........',
    '.....kkwwkwwkk........',
    '.....kwwk.kwwk........',
    '.....kwwk.kwwk........',
    '.....kwwk.kwwk........',
    '....kkwwk.kwwkk.......',
    '....kwwwk.kwwwk.......',
    '....kkkkk.kkkkk.......',
    '......................',
    '......................',
    '......................',
]

# ------------------------------------------------------------- the floating one
ART['caco'] = [
    '.....kk........kk.......',
    '....khhk......khhk......',
    '...khhhkkkkkkkkhhhk.....',
    '...kkkdmmmmmmmmdkkk.....',
    '..kdmmmmmmmmmmmmmmdk....',
    '.kdmmmmmmmmmmmmmmmmdk...',
    '.kdmmmmmmmmmmmmmmmmdk...',
    'kdmmmmmmwwwwwmmmmmmmdk..',
    'kdmmmmmwwkkkwwmmmmmmdk..',
    'kdmmmmmwkeeekwmmmmmmdk..',
    'kdmmmmmwwkkkwwmmmmmmdk..',
    'kdmmmmmmwwwwwmmmmmmmdk..',
    '.kdmmmmmmmmmmmmmmmmdk...',
    '.kdmmmwkwkwkwkwkwmmdk...',
    '..kdmmrrrrrrrrrrrmmdk...',
    '..kdmmmwkwkwkwkwmmmdk...',
    '...kdmmmmmmmmmmmmmdk....',
    '....kdmmmmmmmmmmmdk.....',
    '.....kkdmmmmmmmdkk......',
    '.......kkkkkkkkk........',
    '........................',
    '........................',
    '........................',
    '........................',
]

# ---------------------------------------------------------- the one that spawns
ART['pain'] = [
    '...kk............kk.....',
    '..khhk..........khhk....',
    '..khhhkk......kkhhhk....',
    '...kkkdmmmmmmmmdkkk.....',
    '..kdmmmmmmmmmmmmmmdk....',
    '.kdmmmmmmmmmmmmmmmmdk...',
    'kdmmmmmmmmmmmmmmmmmmdk..',
    'kdmmmmwwwwmwwwwmmmmmdk..',
    'kdmmmwwkekwkekwwmmmmdk..',
    'kdmmmmwwwwmwwwwmmmmmdk..',
    'kdmmmmmmmmmmmmmmmmmmdk..',
    'kdmmmkwkwkwkwkwkwmmmdk..',
    'kdmmkrrrrrrrrrrrrrkmdk..',
    'kdmmmkwkwkwkwkwkwmmmdk..',
    '.kdmmmmmmmmmmmmmmmmdk...',
    '.kdmmmmmmmmmmmmmmmmdk...',
    'kkdmmmmmmmmmmmmmmmmdkk..',
    'kdmkkkdmmmmmmmmmmdkkkmdk',
    'kdk...kkdmmmmmmdkk...kdk',
    '.k......kkkkkkkk......k.',
    '........................',
    '........................',
    '........................',
    '........................',
]

# ------------------------------------------------------------ the big humanoids
ART['knight'] = [
    '...kkk..........kkk.....',
    '..khhhkk......kkhhhk....',
    '...kkhhkkkkkkkkhhkk.....',
    '.....kdmmmmmmmmdk.......',
    '.....kdmlmmmmlmdk.......',
    '.....kdmkekmkekdk.......',
    '.....kdmmmmmmmmdk.......',
    '.....kdmwkwkwkwdk.......',
    '......kdmmmmmmdk........',
    '....kkkkdmmmmdkkkk......',
    '...kdmmmmmmmmmmmmdk.....',
    '..kdmmmmmmmmmmmmmmdk....',
    '..kdmmmmlhhhhlmmmmdk....',
    '.kkdmmmmlhhhhlmmmmdkk...',
    'kdmmdmmmmmmmmmmmmdmmdk..',
    'kdmmdmmmmmmmmmmmmdmmdk..',
    'kdmmkkdmmmmmmmmdkkmmdk..',
    'kdmmk..kdmmmmdk..kdmmk..',
    'kkwwk...kdmmdk...kwwkk..',
    '.kwwk....kddk....kwwk...',
    '..kk...kkdmmdkk...kk....',
    '.......kdmmmmdk.........',
    '.......kdmk.kmdk........',
    '.......kdmk.kmdk........',
    '......kdmmk.kmmdk.......',
    '......kwwwk.kwwwk.......',
    '.....kkwwwk.kwwwkk......',
    '.....kkkkkk.kkkkkk......',
]

# -------------------------------------------------------- brain on mechanical legs
ART['arach'] = [
    '.......kkkkkkkk...........',
    '.....kkllllllllkk.........',
    '....klllhhhhhhlllk........',
    '...kllhhllhhllhhllk.......',
    '...kllhllhhhhllhllk.......',
    '...kllhhllhhllhhllk.......',
    '....klllhhhhhhlllk........',
    '...kkkkllllllllkkkk.......',
    '..kgGGgkkkkkkkkgGGgk......',
    '.kgGGGgkwekkekwkgGGGgk....',
    '.kgGGGgkkkkkkkkkgGGGgk....',
    '.kggggkkgGGGGGgkkggggk....',
    'kgk..kgkgGGGGGgkgk..kgk...',
    'kgk..kgkkgggggkkgk..kgk...',
    'kgk..kgk.......kgk..kgk...',
    'kgk..kgk.......kgk..kgk...',
    'kgk..kgk.......kgk..kgk...',
    'kGk..kGk.......kGk..kGk...',
    'kkk..kkk.......kkk..kkk...',
    '..........................',
]

ART['spider'] = [
    '..........kkkkkkkkkk..........',
    '.......kkkllldddlllkkkk.......',
    '.....kkllldhhhdhhhdlllkkk.....',
    '....klllhhdllhdhllddhhhlllk...',
    '...kllhhdllhhhdhhhllddhhllk...',
    '...kllhdlhhhhhdhhhhhldhhllk...',
    '....klhhdllhhhdhhhlldhhhllk...',
    '.....kklllddhhhdhhddlllkkk....',
    '.....kkkkkllllldllllkkkkk.....',
    '...kgGgkkkkkkkkkkkkkkkkgGgk...',
    '..kgGGGgkkwekkkkkekwkkgGGGgk..',
    '..kgGGGgkkkkkGGGGkkkkkgGGGgk..',
    '..kggggkkkkkgGGGGgkkkkkggggk..',
    '.kgk.kgk.kgkkgggggkkgk.kgk.kgk',
    '.kgk.kgk.kgk.......kgk.kgk.kgk',
    '.kgk.kgk.kgk.......kgk.kgk.kgk',
    '.kgk.kgk.kgk.......kgk.kgk.kgk',
    '.kGk.kGk.kGk.......kGk.kGk.kGk',
    '.kkk.kkk.kkk.......kkk.kkk.kkk',
    '..............................',
    '..............................',
    '..............................',
]

# --------------------------------------------------------------- the fat gunner
ART['mancubus'] = [
    '.........kkkkkk...........',
    '........kdmmmmdk..........',
    '.......kdmlmmlmdk.........',
    '.......kdmkekekmdk........',
    '.......kdmmmmmmmdk........',
    '.......kdmwkwkwmdk........',
    '........kdmmmmmdk.........',
    '.....kkkkdmmmmdkkkk.......',
    '..kgGGgkkdmmmmdkkgGGgk....',
    '.kgGGGGgkdmmmmdkgGGGGgk...',
    '.kgGGGGgkdmmmmdkgGGGGgk...',
    '.kggggggkdmmmmdkgggggggk..',
    '..kkkkkkdmmmmmmdkkkkkkk...',
    '....kkdmmmmmmmmmmdkk......',
    '...kdmmmmhhhhhhmmmmdk.....',
    '..kdmmmmhhhhhhhhmmmmdk....',
    '..kdmmmmhhhhhhhhmmmmdk....',
    '..kdmmmmmhhhhhhmmmmmdk....',
    '...kdmmmmmmmmmmmmmmdk.....',
    '....kdmmmmmmmmmmmmdk......',
    '.....kdmmkkkkkkmmdk.......',
    '.....kdmk......kmdk.......',
    '.....kdmk......kmdk.......',
    '....kdmmk......kmmdk......',
    '....kwwwk......kwwwk......',
    '....kkkkk......kkkkk......',
]

# ---------------------------------------------------------- the one that raises
ART['vile'] = [
    '.......kkkkkk.........',
    '......kwwwwwwk........',
    '.....kwwkkkkwwk.......',
    '.....kwkeekeekwk......',
    '.....kwwkkkkkwwk......',
    '.....kwwkwkwkwwk......',
    '......kwwwwwwwk.......',
    '.......kkwwwkk........',
    'kk......kdmmdk......kk',
    'kmk....kdmmmmdk....kmk',
    'kmmk..kdmmmmmmdk..kmmk',
    '.kmmkkdmmmmmmmmdkkmmk.',
    '..kmmdmmmhhhhmmmdmmk..',
    '...kmmmmmhhhhmmmmmk...',
    '....kdmmmmmmmmmmdk....',
    '.....kdmmmmmmmmdk.....',
    '.....kdmmmmmmmmdk.....',
    '......kdmmmmmmdk......',
    '......kdmmkkmmdk......',
    '......kdmk..kmdk......',
    '......kdmk..kmdk......',
    '......kdmk..kmdk......',
    '.....kdmmk..kmmdk.....',
    '.....kdmk....kmdk.....',
    '....kkwwk....kwwkk....',
    '....kwwwk....kwwwk....',
    '....kkkkk....kkkkk....',
    '......................',
]

# ------------------------------------------------------------------- the big one
ART['cyber'] = [
    '..kkk................kkk..',
    '.khhhkk............kkhhhk.',
    '.khhhhkk..........kkhhhhk.',
    '..kkhhhkkkkkkkkkkkkhhhkk..',
    '....kkdmmmmmmmmmmmmdkk....',
    '.....kdmmlmmmmmmlmmdk.....',
    '.....kdmkekmmmmkekmdk.....',
    '.....kdmmlmmmmmmlmmdk.....',
    '.....kdmwkwkwkwkwkmdk.....',
    '......kdmmmmmmmmmmdk......',
    '...kkkkkdmmmmmmmmdkkkkk...',
    '..kdmmmmmmmmmmmmmmmmmmdk..',
    '.kdmmmmmmmhhhhhhmmmmmmmdk.',
    '.kdmmmmmmhhhhhhhhmmmmmmdk.',
    'kgGGGgkdmmhhhhhhhhmmdkmmdk',
    'kgGGGgkdmmmhhhhhhmmmdkmmdk',
    'kgGGGgkdmmmmmmmmmmmmdkmmdk',
    'kggggkkdmmmmmmmmmmmmdkkmdk',
    '.kkk..kkdmmmmmmmmmmdkk.kk.',
    '.......kdmmmmmmmmmmdk.....',
    '.......kdmmmkkmmmmmdk.....',
    '......kdmmmk..kdmmmmdk....',
    '......kdmmk....kdmmmdk....',
    '.....kdmmk......kdmmdk....',
    '.....kdmk........kdmdk....',
    '....kkwwk........kwwkk....',
    '....kwwwwk......kwwwwk....',
    '....kwwwwk......kwwwwk....',
    '....kkkkkk......kkkkkk....',
    '..........................',
]

# Shared drawings, exactly as the originals shared them: the Spectre IS the
# Demon, drawn near-invisible, and the Baron IS the Hell Knight in another
# palette. Reusing them here is not a shortcut, it is the same trick.
SHARE = {'spectre': 'demon', 'baron': 'knight'}


def validate():
    for k, rows in ART.items():
        w = len(rows[0])
        for i, r in enumerate(rows):
            assert len(r) == w, '%s row %d is %d wide, expected %d' % (k, i, len(r), w)
        assert w <= 32 and len(rows) <= 32, '%s is %dx%d, over the 32 limit' % (k, w, len(rows))
        bad = set(''.join(rows)) - set('.kdmlhwgGerRy')
        assert not bad, '%s uses unknown characters %r' % (k, bad)
    print('art ok:', ', '.join('%s %dx%d' % (k, len(v[0]), len(v)) for k, v in ART.items()))


def emit():
    out = ['/* One drawing per creature, one character per pixel. See tools/gen_sprites.py.',
           '   Shape is fixed here; colour comes from the creature ramp at build time. */',
           'const HELL_ART = {']
    for k, rows in ART.items():
        out.append("  %s: [" % k)
        for r in rows:
            out.append("    '%s'," % r)
        out.append('  ],')
    out.append('};')
    out.append('const HELL_SHARE = {%s};' %
               ', '.join("%s:'%s'" % (a, b) for a, b in SHARE.items()))
    return '\n'.join(out)


if __name__ == '__main__':
    validate()
    js = emit()
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'index.html')
    s = open(p, encoding='utf-8').read()
    start = s.index('const HELL_ART = {')
    end = s.index('const HELL_SHARE = {')
    end = s.index('\n', s.index('};', end)) + 1
    s = s[:s.rindex('/* One drawing per creature', 0, start)] + js + '\n' + s[end:]
    open(p, 'w', encoding='utf-8').write(s)
    print('spliced into index.html')
