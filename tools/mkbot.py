import sys, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SP   = HERE + os.sep
src  = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
s = open(os.path.join(REPO, src), encoding='utf-8').read()

OLD = 'requestAnimationFrame(frame);\n\n})();'
assert s.count(OLD) == 1, 'anchor not found in ' + src

# expose the internals the bot drives, plus two things only reachable in here
HOOK = """requestAnimationFrame(frame);
window.__T = {
  G, P, BLOCK, EYE, P_H, DIFFS, MARKED, SOLID, AIR, ROCK, MAX_JUMPS,
  MODE_SWEEP, MODE_DUNGEON, DUNGEON,
  findHint, gatherClues, hover: null,
  chests, rayChest, correctFlags, canJump, startJump,
  rayEnemy, ETYPES, corpses,
  setDungeonLevels,
  startThink, endThink, snd,
  genWorld, revealAt, idx, inside, isSolidCell, raycast, checkWin,
  shoot, mark, rebuildWorld, worldB, glyphB, setScreen, startGame,
  IN, P_R, SPD_RUN, physics, tickGround, updateJump, aimRay,
  enemies: (typeof enemies !== 'undefined' ? enemies : []),
  eshots:  (typeof eshots  !== 'undefined' ? eshots  : []),
  EN_MAX:  (typeof EN_MAX  !== 'undefined' ? EN_MAX  : 0),
  updateEnemies: (typeof updateEnemies !== 'undefined' ? updateEnemies : function(){}),
  cellXYZ: (typeof cellXYZ !== 'undefined' ? cellXYZ
            : function(i){ return [i%G.nx, (i/(G.nx*G.nz))|0, ((i/G.nx)|0)%G.nz]; }),
  nbrsOf:  (typeof nbrsOf !== 'undefined' ? nbrsOf : function(i){
              const x=i%G.nx, y=(i/(G.nx*G.nz))|0, z=((i/G.nx)|0)%G.nz, o=[];
              for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){
                if(!dx&&!dy&&!dz) continue;
                const X=x+dx,Y=y+dy,Z=z+dz;
                if(inside(X,Y,Z)) o.push(idx(X,Y,Z));
              } return o; }),
  aimAt: function(tx,ty,tz){
    const dx=tx-P.x, dy=ty-(P.y+EYE), dz=tz-P.z, h=Math.hypot(dx,dz);
    P.yaw = Math.atan2(-dx,-dz); P.pitch = Math.atan2(dy,h);
  },
  adv: function(dt){ tGlobal += dt; }
};

})();"""
s = s.replace(OLD, HOOK)
# Refuse to build a bot whose names do not line up with the hook. Twice this
# session a symbol was exported here and never bound in bot.js, and both times
# it sailed past `node --check` (syntax only) and past the fast Apprentice test
# (which cannot reach combat code), then threw minutes into a dungeon run where
# a page that never yields could not even report it.
import lint_bot
if lint_bot.main() != 0:
    raise SystemExit('mkbot: refusing to build, the hook and bot.js disagree')

# THE SOUND BANK DOES NOT COME TO THE TEST RIG.
#
# bot.js mutes the game on its first line, so on() is false for the whole run
# and not one sample is ever decoded or played. The 260 KB of base64
# recordings in index.html are therefore pure ballast here — and measured,
# they are not free ballast. Interleaved against the same build without
# them, a bot page carrying the blob finished 0 runs out of 10 where the one
# without it finished 2 of 8, the same rate as the build from before the
# sound work existed. It is not the DECODING: a build with bankLoad() removed
# but the blob still in the page scored 0 of 8 as well, and so did a page
# padded with the same weight of the letter A. Whatever headless Chrome does
# with a very large inline script, it does it whether or not anyone reads it.
#
# (The rig ALSO has a much older intermittent hang that fails ~60% of runs on
# a completely unmodified game. That one is still open. This only stops the
# audio from making it near-total.)
s, stripped = re.subn(r'window\.SND_B64\s*=\s*\{.*?\n\};', 'window.SND_B64={};',
                      s, flags=re.S)
if 'SND_B64' in s and not stripped:
    print('mkbot: WARNING — index.html has a sound bank this could not strip. '
          'If the blob was renamed, fix the pattern above: the bot pages get '
          'much slower and much flakier when it is left in.')

bot = open(os.path.join(HERE, 'bot.js'), encoding='utf-8').read()
s = s + '\n<script>\n' + bot + '\n</script>\n'
open(os.path.join(HERE, 'bot_' + src), 'w', encoding='utf-8').write(s)
print('built bot_' + src)

# ONE BOT, ONE BUILD, PUBLISHED TWICE.
#
# bot-demo.html at the repo root is the copy Marcelo opens in a browser to
# WATCH the thing play. It used to be built by a separate mkdemo.py, which was
# deleted, and after that it was simply a file nobody rebuilt: by the time
# anyone looked it was 159 KB against a 640 KB game and carried none of the
# last several months of either the game or the bot. Watching it was watching
# bugs that had already been fixed.
#
# So it is not a copy any more, it is an OUTPUT. Identical bytes to
# bot_index.html; only the query string differs when you open it, and that
# lives in the URL rather than in the file. It cannot drift again without
# somebody deliberately deleting this.
if src == 'index.html':
    demo = os.path.join(REPO, 'bot-demo.html')
    open(demo, 'w', encoding='utf-8').write(s)
    print('built bot-demo.html (same build, for watching in a browser)')
