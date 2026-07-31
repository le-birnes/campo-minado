/* ============================================================
   PLAYTEST BOT
   Walks the cave on the game's own legs: real input flags, real
   physics, real collision, real jumps. It may only change the
   board through shoot() and mark(). If it cannot reach somewhere,
   that is a finding, not something to teleport past.
   ============================================================ */
window.addEventListener('error', e=>{
  try{ document.body.dataset.r = 'UNCAUGHT '+e.message+' @ line '+e.lineno; }catch(_){}
});
window.addEventListener('load', () => setTimeout(() => {
try{
const T = window.__T;
const out = [], errs = [];
const log = m => out.push(m);
if (!T) { document.body.dataset.r = 'NO HARNESS'; document.title = 'FAIL'; return; }

const {G, P, IN, enemies, eshots, EN_MAX, BLOCK, EYE, P_H, P_R, SPD_RUN,
       genWorld, idx, inside, isSolidCell, cellXYZ, nbrsOf, raycast,
       shoot, mark, physics, tickGround, updateJump, rebuildWorld, worldB,
       updateEnemies, MARKED, SOLID, AIR, ROCK, aimAt, adv, DIFFS,
       chests, rayChest, correctFlags, MAX_JUMPS, startThink, endThink, snd,
       canJump} = T;
/* thousands of WebAudio nodes is most of the runtime and none of the value */
try{ G.muted=true; snd.setMute(true); }catch(e){}

let errCount = 0; const seen = new Set();
function err(msg) {
  errCount++;
  if (seen.has(msg) || seen.size > 30) return;
  seen.add(msg); errs.push(msg);
}

const DT = 1/30;
let auditN = 0;
const stats = { walked:0, jumps:0, stuck:0, noRoute:0, dugOut:0, insideRock:0,
                fell:0, shots:0, flags:0, noEffect:0, killed:0, shotAt:0,
                chords:0, chordDud:0, opened:0, chests:0, climbed:0, misflag:0,
                chordOffered:0, chordNoAim:0, gaveUp:0, airJump:0,
                guesses:0, guessMines:0 };

/* ---------------- audit ----------------
   The world is no longer "a box of puzzle blocks". It has structure that is
   not part of the puzzle, and space that was open before anyone dug. So the
   old invariants (air === revealed, safeTotal === N - mines) are simply the
   wrong statements now, and both would fire on every Arcane and every dungeon.
   These are the true ones. */
let baseAir = 0, baseRock = 0;
function snapshotWorld() {
  const N = G.nx*G.ny*G.nz;
  baseAir = 0; baseRock = 0;
  for (let i=0;i<N;i++){ if (G.st[i]===AIR) baseAir++; else if (G.st[i]===ROCK) baseRock++; }
  /* genWorld has already opened the starting chamber by the time we get here,
     so those cells are revealed, not born open. */
  baseAir -= G.revealed;
}
function audit(tag) {
  const N = G.nx*G.ny*G.nz;
  let air=0, marked=0, mines=0, mineAir=0, rock=0, openable=0;
  for (let i=0;i<N;i++) {
    const s=G.st[i];
    if (s===AIR) { air++; if (G.mine[i]) mineAir++; }
    else if (s===MARKED) { marked++; if (!G.mine[i]) openable++; }
    else if (s===ROCK) rock++;
    else if (!G.mine[i]) openable++;
    if (G.mine[i]) mines++;
  }
  if (air-baseAir !== G.revealed)  err(`${tag}: revealed=${G.revealed} but ${air-baseAir} cells were opened`);
  if (marked!==G.marked)           err(`${tag}: G.marked=${G.marked} but ${marked} cells flagged`);
  if (mines!==G.mines)             err(`${tag}: mines=${G.mines} but ${mines} placed`);
  if (rock!==baseRock)             err(`${tag}: structure changed, ${baseRock} -> ${rock}`);
  if (G.revealed+openable !== G.safeTotal)
    err(`${tag}: ${G.revealed} opened + ${openable} still openable != safeTotal ${G.safeTotal}`);
  if (G.state==='play' && mineAir) err(`${tag}: ${mineAir} mine(s) revealed while alive`);
  if (!isFinite(P.x+P.y+P.z))      err(`${tag}: player position NaN`);
  if (G.marked<0)                  err(`${tag}: negative flag count`);
  if (P.jumps<0 || P.jumps>MAX_JUMPS) err(`${tag}: jump count out of range: ${P.jumps}`);
  if (++auditN % 25 === 0) {
    rebuildWorld();
    if (worldB.count>worldB.max)   err(`${tag}: worldB overflow ${worldB.count}/${worldB.max}`);
  }
  if (enemies.length>EN_MAX)       err(`${tag}: ${enemies.length} enemies over cap ${EN_MAX}`);
  for (const e of enemies) {
    if (!isFinite(e.x+e.y+e.z)) { err(`${tag}: enemy position NaN`); break; }
    const fl=Math.hypot(e.fx,e.fy,e.fz), ul=Math.hypot(e.ux,e.uy,e.uz);
    if (!(fl>0.5&&fl<1.6&&ul>0.5&&ul<1.6)) { err(`${tag}: enemy basis degenerate`); break; }
  }
  for (const s of eshots) if (!isFinite(s.x+s.y+s.z)) { err(`${tag}: enemy shot NaN`); break; }
}

const pcell = () => [Math.floor(P.x/BLOCK), Math.floor((P.y+0.2)/BLOCK), Math.floor(P.z/BLOCK)];
function playerInRock() {
  const [x,y,z]=pcell();
  return isSolidCell(x,y,z) || isSolidCell(x, Math.floor((P.y+P_H-0.1)/BLOCK), z);
}

/* -------- one simulated frame of the real thing -------- */
function tick() {
  updateJump(DT); physics(DT); tickGround(DT);
  if (G.boss) { adv(DT); updateEnemies(DT); }
  if (P.y < -30) { stats.fell++; return false; }
  if (playerInRock()) { stats.insideRock++;
    err(`player ended up inside solid rock at ${P.x.toFixed(1)},${P.y.toFixed(1)},${P.z.toFixed(1)}`); return false; }
  return true;
}
function idle(sec) { for (let k=0;k<sec/DT;k++) if(!tick()) return false; return true; }

/* A jump has to re-arm jumpFired, or the game (correctly) refuses to fire a
   second one from a button that was never released. Holding the flag down
   used to be enough back when a jump could be sustained; it is not any more,
   and a bot that never jumps twice cannot climb anything. */
function jumpNow() { IN.jumpHeld = true; IN.jumpFired = false; stats.jumps++; }

/* ================= navigation =================
   The old router walked any air cell, six-connected, including straight up
   and straight down. That is not walking, it is flying, and every path it
   produced went through cells with nothing underneath them. This models what
   legs actually do. */
function passable(x,y,z){ return inside(x,y,z) && G.st[idx(x,y,z)]===AIR; }
function supported(x,y,z){
  if (y<=0) return true;                       // the floor of the world
  return !inside(x,y-1,z) || G.st[idx(x,y-1,z)]!==AIR;
}
function standable(x,y,z){ return passable(x,y,z) && supported(x,y,z); }

/* Walk from height `fromY` into column (x,z): climb, or fall any distance.
   Returns where the bot ends up, or -1 if the column is a wall.

   CLIMB is 2, not 1. One jump clears 6 m from standing — a block and a half —
   but the player now gets twenty of them, and a second jump at the apex of the
   first reaches three blocks. Modelling a one-block limit made falling
   effectively one-way: the bot would dig a pit, drop into it, and the router
   would report no path back out of a hole it could trivially jump. That is
   what "nothing it could reach" was, on a board where 95% of frontier blocks
   have a standing spot with a sightline one cell away. */
const CLIMB = 2;
function stepTarget(x, z, fromY){
  if (!inside(x,0,z)) return -1;
  for (let up=CLIMB; up>=1; up--){
    if (!standable(x, fromY+up, z)) continue;
    // the cells you pass through on the way up have to be open
    let clear=true;
    for (let k=1; k<up; k++) if (!passable(x, fromY+k, z)) { clear=false; break; }
    if (clear) return idx(x, fromY+up, z);
  }
  for (let y=fromY; y>=0; y--){
    if (!passable(x,y,z)) return -1;
    if (supported(x,y,z)) return idx(x,y,z);
  }
  return -1;
}
const NB4 = [[1,0],[-1,0],[0,1],[0,-1]];
let _prev=null, _seen=null, _cap=0;
function route(fromCell, toCell) {
  const N = G.nx*G.ny*G.nz;
  if (_cap < N) { _prev=new Int32Array(N); _seen=new Uint8Array(N); _cap=N; }
  _prev.fill(-1); _seen.fill(0);
  const q=[fromCell]; _seen[fromCell]=1;
  for (let qi=0; qi<q.length; qi++) {
    const i=q[qi];
    if (i===toCell) {
      const path=[]; let c=i;
      while(c!==fromCell){ path.push(c); c=_prev[c]; }
      return path.reverse();
    }
    const [x,y,z]=cellXYZ(i);
    for (const [dx,dz] of NB4) {
      const j=stepTarget(x+dx, z+dz, y);
      if (j<0 || _seen[j]) continue;
      _seen[j]=1; _prev[j]=i; q.push(j);
    }
  }
  return null;
}
/* Where the bot is standing, as a cell the router understands. */
function standCell(){
  const [x,y,z]=pcell();
  if (!inside(x,y,z)) return -1;
  for (let Y=y; Y>=0; Y--){
    if (!passable(x,Y,z)) return Y===y ? -1 : idx(x,Y+1,z);
    if (supported(x,Y,z)) return idx(x,Y,z);
  }
  return -1;
}

/* -------- walk to one adjacent waypoint, on foot -------- */
function walkTo(cell, budget) {
  const [cx,cy,cz]=cellXYZ(cell);
  const tx=(cx+0.5)*BLOCK, tz=(cz+0.5)*BLOCK, ty=cy*BLOCK;
  let best=Infinity, since=0;
  const steps=(budget||2.2)/DT;
  for (let k=0;k<steps;k++) {
    const dx=tx-P.x, dz=tz-P.z, d=Math.hypot(dx,dz);
    if (d<1.2 && Math.abs(P.y-ty)<BLOCK*0.9) { IN.f=0; IN.jumpHeld=false; return true; }
    P.yaw = Math.atan2(-dx,-dz);
    IN.f=1; IN.b=IN.l=IN.r=0;
    /* Climbing: the waypoint is a block above us, so jump as we arrive.
       Falling needs nothing but walking off the edge. */
    if (ty > P.y + 0.6) {
      /* Off the ground for the first block; then again at the apex for the
         second, which is the whole point of having twenty. */
      if (P.ground) { jumpNow(); stats.climbed++; }
      else if (P.vy <= 0 && ty > P.y + BLOCK*0.9 && canJump()) { jumpNow(); stats.airJump++; }
      else IN.jumpHeld=false;
    } else IN.jumpHeld=false;
    if (!tick()) { IN.f=0; IN.jumpHeld=false; return false; }
    stats.walked += SPD_RUN*DT;
    if (d < best-0.05) { best=d; since=0; }
    else if (++since > 0.5/DT) {
      // no progress: one hop to clear a lip, then give up
      if (P.ground && since < 0.9/DT) jumpNow();
      if (since > 1.5/DT) { IN.f=0; IN.jumpHeld=false; return false; }
    }
  }
  IN.f=0; IN.jumpHeld=false;
  return false;
}
function follow(path, budget) {
  for (const w of path) if (!walkTo(w, budget)) return false;
  return true;
}

/* -------- can the bot shoot `cell` from exactly where it stands? -------- */
function lineTo(cell) {
  const [tx,ty,tz]=cellXYZ(cell);
  const cx=(tx+0.5)*BLOCK, cy=(ty+0.5)*BLOCK, cz=(tz+0.5)*BLOCK;
  const pts=[[cx,cy,cz]];
  for (const o of [[0.34,0,0],[-0.34,0,0],[0,0.34,0],[0,-0.34,0],[0,0,0.34],[0,0,-0.34]])
    pts.push([cx+o[0]*BLOCK, cy+o[1]*BLOCK, cz+o[2]*BLOCK]);
  const ex=P.x, ey=P.y+EYE, ez=P.z;
  for (const [ax,ay,az] of pts) {
    let vx=ax-ex, vy=ay-ey, vz=az-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, 13*BLOCK, true);
    if (h.hit && h.kind==='block' && h.x===tx && h.y===ty && h.z===tz) { aimAt(ax,ay,az); return true; }
  }
  return false;
}

/* -------- go stand somewhere that can see `cell`, on foot -------- */
function approach(cell) {
  if (lineTo(cell)) return true;
  const [tx,ty,tz]=cellXYZ(cell);
  const from=standCell();
  if (from<0) return false;
  /* Somewhere you can stand AND from which the block is actually visible.
     Requiring only "standable and nearby" sent the bot to spots with no
     sightline, which is why it walked 2.6 km and still reported no route
     1073 times. Radius 5, because a shot carries 13 blocks — standing back is
     usually easier than squeezing in close. */
  const cands=[];
  for (let r=1;r<=5;r++) for (let dy=-r;dy<=r;dy++) for (let dz=-r;dz<=r;dz++) for (let dx=-r;dx<=r;dx++) {
    if (Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))!==r) continue;   // shell only
    const X=tx+dx, Y=ty+dy, Z=tz+dz;
    if (!standable(X,Y,Z)) continue;
    if (!seesFrom(X,Y,Z, cell)) continue;
    cands.push([idx(X,Y,Z), r]);
    if (cands.length>=8) break;
  }
  let routed=false;
  for (const [goal] of cands.slice(0,3)) {
    const path = route(from, goal);
    if (!path) continue;
    routed=true;
    if (follow(path, 2.2) && lineTo(cell)) return true;
  }
  if (!routed) stats.noRoute++; else stats.stuck++;
  return false;
}
/* Would the block be in view from a standing position in this cell? */
function seesFrom(x,y,z, cell){
  const [tx,ty,tz]=cellXYZ(cell);
  const ex=(x+0.5)*BLOCK, ey=y*BLOCK+EYE, ez=(z+0.5)*BLOCK;
  const ax=(tx+0.5)*BLOCK, ay=(ty+0.5)*BLOCK, az=(tz+0.5)*BLOCK;
  let vx=ax-ex, vy=ay-ey, vz=az-ez;
  const d=Math.hypot(vx,vy,vz)||1;
  if (d>13*BLOCK) return false;
  const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, 13*BLOCK, false);
  return !!(h.hit && h.x===tx && h.y===ty && h.z===tz);
}
function approachNum(cell) {
  if (lineToNum(cell)) return true;
  const [tx,ty,tz]=cellXYZ(cell);
  const from=standCell();
  if (from<0) return false;
  const cands=[];
  for (let r=1;r<=5;r++) for (let dy=-r;dy<=r;dy++) for (let dz=-r;dz<=r;dz++) for (let dx=-r;dx<=r;dx++) {
    if (Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))!==r) continue;
    const X=tx+dx, Y=ty+dy, Z=tz+dz;
    if (!standable(X,Y,Z)) continue;
    cands.push([idx(X,Y,Z), r]);
    if (cands.length>=8) break;
  }
  for (const [goal] of cands.slice(0,3)) {
    const path=route(from, goal);
    if (!path) continue;
    if (follow(path, 2.2) && lineToNum(cell)) return true;
  }
  stats.noRoute++;
  return false;
}

/* Flagging and chording are both the right button now: hold to think, release
   to act. endThink() casts the ray itself with numbers enabled, and decides
   between "flag this block" and "this number lights up / spreads" exactly the
   way it does for a player. Calling mark() and shoot() directly skipped that
   decision entirely — and since the click rework, LEFT click does not look at
   numbers at all, so the bot could never chord. It made 0 chords in 833
   actions and nobody noticed, because nothing failed; the move just silently
   was not available to it. */
function thinkAct(){ startThink(); endThink(); }

/* Targets that did not take. A cell can be visible, routable, aimed at, and
   still refuse the action — the right-button ray resolves to a number floating
   in front of it, and no amount of walking changes that. With no memory of
   this the bot re-chose the same cell every step for the rest of the game:
   one Sorcerer board spent 694 of its 700 moves on a single block, and every
   one of those 694 was logged as a distinct failure when it was really one.
   Give up on a cell after two refusals and go find another. */
let refused = new Map();
const giveUp = c => (refused.get(c)||0) >= 2;
function refuse(c){ refused.set(c, (refused.get(c)||0)+1); }

function aimAtBlock(cell){
  const [x,y,z]=cellXYZ(cell);
  aimAt((x+0.5)*BLOCK,(y+0.5)*BLOCK,(z+0.5)*BLOCK);
}
function lineToNum(cell) {
  const [tx,ty,tz]=cellXYZ(cell);
  const cx=(tx+0.5)*BLOCK, cy=(ty+0.5)*BLOCK, cz=(tz+0.5)*BLOCK;
  const ex=P.x, ey=P.y+EYE, ez=P.z;
  let vx=cx-ex, vy=cy-ey, vz=cz-ez;
  const d=Math.hypot(vx,vy,vz)||1;
  const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, 13*BLOCK, true);
  if (h.hit && h.kind==='num' && h.x===tx && h.y===ty && h.z===tz) { aimAt(cx,cy,cz); return true; }
  return false;
}

/* -------- combat -------- */
function fightBack() {
  let best=null;
  for (const e of enemies) {
    const ex=P.x, ey=P.y+EYE, ez=P.z;
    let vx=e.x-ex, vy=e.y-ey, vz=e.z-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    if (d>13*BLOCK) continue;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, d, false);
    if (h.hit && h.t < d-1.2) continue;
    if (!best || d<best.d) best={e,d};
  }
  if (!best) return false;
  aimAt(best.e.x, best.e.y, best.e.z);
  const before=enemies.length;
  stats.shotAt++; shoot();
  if (enemies.length<before) stats.killed++;
  return true;
}
function huntEnemies() {
  let acted=false;
  for (let guard=0; guard<10 && enemies.length; guard++) {
    if (fightBack()) { acted=true; audit('hunt'); continue; }
    let near=null;
    for (const e of enemies) {
      const d=Math.hypot(e.x-P.x, e.y-P.y, e.z-P.z);
      if (!near || d<near.d) near={e,d};
    }
    if (!near) break;
    const c=[Math.floor(near.e.x/BLOCK), Math.floor(near.e.y/BLOCK), Math.floor(near.e.z/BLOCK)];
    let goal=-1;
    for (let dy=0; dy>=-3 && goal<0; dy--)
      if (standable(c[0], c[1]+dy, c[2])) goal=idx(c[0], c[1]+dy, c[2]);
    if (goal<0) break;
    const from=standCell();
    if (from<0) break;
    const path=route(from, goal);
    if (!path || !follow(path, 2.0)) break;
  }
  return acted;
}

/* -------- a chest is free value: take it -------- */
function grabChests() {
  for (const c of chests) {
    if (c.open) continue;
    const ex=P.x, ey=P.y+EYE, ez=P.z;
    let vx=c.x-ex, vy=c.y-ey, vz=c.z-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    if (d>13*BLOCK) continue;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, d, false);
    if (h.hit && h.t < d-1.0) continue;        // a wall is in the way
    aimAt(c.x,c.y,c.z);
    shoot(); stats.chests++;
    return true;
  }
  return false;
}

/* ================= deduction =================
   One pass over the board produces all three move kinds. The old bot walked
   every cell three separate times per step, which on a 7776-cell dungeon is
   most of the runtime. */
function analyse() {
  const N=G.nx*G.ny*G.nz;
  const mines=[], chords=[], safes=[], taken=new Set();
  const clues=[];
  for (let i=0;i<N;i++) {
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0; const h=[];
    for (const j of nbrsOf(i)) { const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) h.push(j); }
    if (!h.length) continue;
    const need=G.cnt[i]-f;
    clues.push({i,need,h});
    if (need===h.length) for (const j of h) if(!taken.has(j)){ taken.add(j); mines.push({cell:j}); }
    else if (need===0) { chords.push({cell:i}); for (const j of h) safes.push({cell:j}); }
  }
  return {mines, chords, safes, clues};
}
function nearestFirst(list) {
  return list.sort((a,b)=>{
    const A=cellXYZ(a.cell), B=cellXYZ(b.cell);
    const da=Math.hypot((A[0]+.5)*BLOCK-P.x,(A[1]+.5)*BLOCK-P.y,(A[2]+.5)*BLOCK-P.z);
    const db=Math.hypot((B[0]+.5)*BLOCK-P.x,(B[1]+.5)*BLOCK-P.y,(B[2]+.5)*BLOCK-P.z);
    return da-db;
  });
}
/* Nothing provable: guess on the frontier only — a block buried in untouched
   rock is not a move a player could make.

   SAFE_GUESS is a cheat, and it is on deliberately. A bot that guesses blind
   dies on its second move and never exercises anything: eight games ended
   after 54 actions between them, none of them past the first chamber. The
   point of this bot is to walk the whole board and audit it, so it is allowed
   to see the mine array when it has genuinely run out of deductions — and
   nowhere else.

   The honest number is still recorded: every guess counts whether the block it
   picked WOULD have been a mine, which is the real risk a player faces at that
   moment. Peeking to count is not peeking to choose. */
const SAFE_GUESS = true;
function frontierGuess(known) {
  const N=G.nx*G.ny*G.nz, cand=[];
  for (let i=0;i<N;i++) {
    if (G.st[i]!==SOLID || known.has(i) || giveUp(i)) continue;  // never guess a proven mine
    for (const j of nbrsOf(i)) if (G.st[j]===AIR) { cand.push({cell:i}); break; }
  }
  const list=nearestFirst(cand);
  if (!list.length) return [];
  stats.guesses++;
  if (G.mine[list[0].cell]) stats.guessMines++;      // counted, not avoided
  return (SAFE_GUESS ? list.filter(m=>!G.mine[m.cell]) : list).slice(0,14);
}

const won = () => G.dungeon
  ? (G.mines>0 && G.marked===G.mines && correctFlags()===G.mines) || G.revealed>=G.safeTotal
  : G.revealed>=G.safeTotal;

/* ---------------- one game, played on foot ---------------- */
function playGame(diff, boss, label) {
  genWorld(diff);
  if (boss) G.boss = true;
  G.state='play';
  IN.f=IN.b=IN.l=IN.r=0; IN.jumpHeld=false; IN.jumpFired=false; IN.sprint=false;
  stats.gaveUp += refused.size;      // carry it across games before resetting
  refused = new Map();
  snapshotWorld();
  audit(label+' fresh');

  let moves=0, peak=0, endWhy='ran out of steps';
  const cap = Math.min(700, G.safeTotal*2 + 200);
  for (let step=0; step<cap; step++) {
    if (won()) { endWhy='finished'; break; }
    if (G.state!=='play') { endWhy='died to a '+G.deathBy; break; }
    if (!idle(0.15)) { endWhy='physics fault'; break; }
    if (G.state!=='play') { endWhy='died to a '+G.deathBy; break; }

    if (G.boss && enemies.length) {
      peak=Math.max(peak,enemies.length);
      if (huntEnemies()) moves++;
    }
    if (G.state!=='play') break;

    if (chests.length && grabChests()) { moves++; audit(label+' chest'); }
    if (G.state!=='play') break;

    let acted=false;
    const A=analyse();

    /* 1. Flag every mine the board proves. That is what wins it. */
    for (const mv of nearestFirst(A.mines).filter(m=>!giveUp(m.cell)).slice(0,6)) {
      if (!approach(mv.cell)) { refuse(mv.cell); continue; }
      /* approach() already aimed at the point on this block it can actually
         see. Re-aiming at the geometric centre undoes that, and mark() casts
         its own ray — so the flag lands on whatever is in front of the centre
         instead. That is how one dungeon collected 585 flags for 62 mines:
         the intended block stayed SOLID and was chosen again every step. */
      const before=G.marked;
      thinkAct(); stats.flags++; moves++; acted=true;
      if (G.st[mv.cell]!==MARKED) { stats.misflag++; refuse(mv.cell); }
      else refused.delete(mv.cell);
      audit(label+' flag '+moves);
      if (G.state==='play' && G.marked===before) stats.noEffect++;
      break;
    }

    /* 2. Then clear blanks wholesale by chording a satisfied number. */
    stats.chordOffered += A.chords.length;
    if (!acted) for (const mv of nearestFirst(A.chords).filter(m=>!giveUp(m.cell)).slice(0,6)) {
      if (!approachNum(mv.cell)) { stats.chordNoAim++; refuse(mv.cell); continue; }
      const before=G.revealed;
      thinkAct(); stats.chords++; moves++; acted=true;
      audit(label+' chord '+moves);
      if (G.state!=='play') break;
      if (G.revealed===before) { stats.chordDud++; refuse(mv.cell); }
      else stats.opened += G.revealed-before;
      break;
    }

    /* 3. A proven-safe block, if chording could not reach one. */
    if (!acted) for (const mv of nearestFirst(A.safes).filter(m=>!giveUp(m.cell)).slice(0,6)) {
      if (!approach(mv.cell)) { refuse(mv.cell); continue; }
      /* The solver said this block is safe. If it is not, that is either a
         wrong deduction or a shot that went somewhere other than where it was
         aimed — both worth knowing about, and neither is visible from the
         death message alone. */
      if (G.mine[mv.cell]) err(`${label}: solver called cell ${mv.cell} safe and it is a mine`);
      const before=G.revealed;
      shoot(); stats.shots++; moves++; acted=true;
      audit(label+' safe '+moves);
      if (G.state!=='play') break;
      if (G.revealed===before) { stats.noEffect++; refuse(mv.cell); }
      break;
    }

    /* 4. Only when nothing is provable: the nearest frontier block. */
    if (!acted) for (const mv of frontierGuess(new Set(A.mines.map(m=>m.cell)))) {
      if (!approach(mv.cell)) { refuse(mv.cell); continue; }
      const before=G.revealed;
      shoot(); stats.shots++; moves++; acted=true;
      audit(label+' guess '+moves);
      if (G.state!=='play') break;
      if (G.revealed===before) { stats.noEffect++; refuse(mv.cell); }
      break;
    }

    if (!acted) { stats.dugOut++; endWhy='nothing it could reach'; break; }
  }
  return {moves, peak, state:G.state, won:won(), why:endWhy};
}

/* ---------------- suite ---------------- */
const t0=Date.now();
let games=0, wins=0, totalMoves=0, deaths=0;
const per={};
const plan=[];
for (let d=0; d<3; d++) plan.push([d,false,DIFFS[d].name]);
DIFFS[3].nx=20; DIFFS[3].nz=20; DIFFS[3].ny=5; DIFFS[3].dens=0.14;
plan.push([3,false,'Custom-max']);
DIFFS[3].nx=6;  DIFFS[3].nz=6;  DIFFS[3].ny=2; DIFFS[3].dens=0.30;
plan.push([3,false,'Custom-min']);
for (let k=0;k<2;k++) plan.push([4,true,'Dungeon']);

for (const [d,boss,label] of plan) {
  const r=playGame(d,boss,label);
  games++; totalMoves+=r.moves;
  document.body.dataset.r = `... ${games}/${plan.length} games, ${totalMoves} actions, faults ${errCount}`;
  if (r.won) wins++;
  if (r.state==='over' && G.deathBy==='shot') deaths++;
  per[label]=per[label]||{n:0,m:0,p:0,w:0};
  per[label].n++; per[label].m+=r.moves; per[label].w+=r.won?1:0;
  per[label].p=Math.max(per[label].p,r.peak);
  per[label].why=r.why;
}

log(`games=${games} finished=${wins} actions=${totalMoves}`);
for (const k in per) log(`  ${k}: ${per[k].n} games, ${per[k].w} finished, ${per[k].m} actions, peakFoes=${per[k].p} — ended: ${per[k].why}`);
log(`on foot: ${stats.walked.toFixed(0)} m walked, ${stats.jumps} jumps `+
    `(${stats.climbed} off the ground to climb, ${stats.airJump} in mid-air)`);
log(`navigation: stuck=${stats.stuck} noRoute=${stats.noRoute} boxedIn=${stats.dugOut} fellOutOfWorld=${stats.fell} insideRock=${stats.insideRock}`);
log(`misaimed flags: ${stats.misflag} | targets given up on: ${stats.gaveUp+refused.size}`);
log(`chording: ${stats.chordOffered} chances offered across all steps, `+
    `${stats.chords} taken, ${stats.chordNoAim} refused for want of an aim`);
log(`guessing: ${stats.guesses} times nothing was provable; the nearest frontier block `+
    `would have been a mine ${stats.guessMines}x (${stats.guesses?(100*stats.guessMines/stats.guesses).toFixed(1):0}%) `+
    `— SAFE_GUESS=${SAFE_GUESS} means the bot dodged those rather than dying to them`);
log(`actions: ${stats.shots} shots, ${stats.flags} flags, ${stats.chords} chords (${stats.chordDud} dud), ${stats.chests} chests, ${stats.noEffect} with no effect`);
log(`combat: killed ${stats.killed}/${stats.shotAt} shots at foes, bot shot dead ${deaths}x`);
log(`buffers: worldB ${worldB.count}/${worldB.max}`);
log(errCount ? `FAULTS: ${errCount} (${seen.size} distinct)` : 'FAULTS: none');
for (const e of errs) log('  ! '+e);

document.body.dataset.r = out.join('\n');
}catch(e){
  try{ document.body.dataset.r = 'THROW '+e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' | '); }catch(_){}
}
}, 400));
