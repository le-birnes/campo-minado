"""Write the commit you just made into the corner of the menu, and push.

Marcelo: "Can you add to the corner of the starting menu the commit code? As
for me to see which version I'm playing?"

A page cannot carry the hash of the commit it is IN: the hash is computed from
the content, so writing it changes it. So it takes two commits. You commit the
change (that is hash A, the one worth naming), then this writes A into the
menu and commits that as "stamp A". What the menu shows is the commit that
holds the actual work.

usage: python tools/stamp.py           after committing; stamps, commits, pushes
       python tools/stamp.py --no-push
"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / 'index.html'
TAG  = re.compile(r'(<div id="buildTag">)[^<]*(</div>)')

def git(*a):
    return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True,
                          check=True).stdout.strip()

def main():
    if git('status', '--porcelain', '--', 'index.html'):
        sys.exit('[X] index.html has uncommitted changes - commit the work first, '
                 'the stamp must name a commit that contains it')
    h = git('rev-parse', '--short', 'HEAD')
    d = git('show', '-s', '--format=%cd', '--date=format:%Y-%m-%d %H:%M', 'HEAD')
    raw = PAGE.read_bytes().decode('utf-8')
    new, n = TAG.subn(lambda m: m.group(1) + f'build {h} - {d}' + m.group(2), raw)
    if n != 1: sys.exit(f'[X] expected one buildTag in index.html, found {n}')
    if new == raw: print(f'[OK] already stamped {h}'); return
    PAGE.write_bytes(new.encode('utf-8'))
    git('commit', '-q', '-m', f'stamp {h}', '--', 'index.html')
    print(f'[OK] menu now says: build {h} - {d}')
    if '--no-push' not in sys.argv:
        subprocess.run(['git', 'push', '-q'], cwd=ROOT, check=True)
        print('[OK] pushed')

if __name__ == '__main__':
    main()
