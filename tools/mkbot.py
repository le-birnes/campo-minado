import sys, os
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
bot = open(os.path.join(HERE, 'bot.js'), encoding='utf-8').read()
s = s + '\n<script>\n' + bot + '\n</script>\n'
open(os.path.join(HERE, 'bot_' + src), 'w', encoding='utf-8').write(s)
print('built bot_' + src)
