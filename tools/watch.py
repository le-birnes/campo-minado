"""Build the watchable bot and print the URL to open.

    python tools/watch.py                 dungeon, one mine area
    python tools/watch.py --zones 4       the full dungeon
    python tools/watch.py --sweep         3D Minesweeper instead
    python tools/watch.py --diff 1        Sorcerer

Open the printed file:// URL in a normal browser. The bot plays at a pace you
can follow, the game renders between its moves, and the panel on the right
shows what it is doing and any error it hits, on screen, as it happens.
"""
import os, sys, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

a = sys.argv[1:]
zones = a[a.index('--zones') + 1] if '--zones' in a else '1'
diff = a[a.index('--diff') + 1] if '--diff' in a else '0'
sweep = '--sweep' in a

subprocess.run([sys.executable, os.path.join(HERE, 'mkbot.py'), 'index.html'],
               cwd=REPO, check=True)

q = '?watch&diff=' + diff + ('&sweep' if sweep else '&zones=' + zones)
url = 'file:///' + os.path.join(HERE, 'bot_index.html').replace(os.sep, '/') + q
print()
print('  open this in a browser:')
print()
print('  ' + url)
print()
print('  right panel: step, state, what it is doing, stats, errors')
print('  bottom right: pace slider, pause, single step')
