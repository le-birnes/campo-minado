/* ============================================================
   PLAYTEST BOT
   Walks the cave on the game's own legs: real input flags, real
   physics, real collision, real jumps. It may only change the
   board through shoot() and the right button.

   HOW IT DECIDES WHERE TO GO — Marcelo's model, and the reason for
   this rewrite. The previous version chose by scoring every
   reachable cell, so its cost grew with the level: fine on a
   300-cell arena, hopeless on a 7776-cell dungeon, which never
   finished at any timeout up to 300 seconds. Six rounds of
   bounding the scans failed, because the constants were never the
   problem.

   This one does what a person does, and costs the same on any size
   of level:

     SCAN     rays from where you stand, all round and at several
              pitches. That is the entire world model.
     MARK     any mine the board proves is flagged FIRST — the
              dungeon charges for digging beside a mine you have
              not marked yet.
     WORK     stone within reach is something to open, so the next
              scan has more to read: reveal the logic layer by
              layer.
     FOLLOW   nothing to do here? take the longest clear line and
              walk it straight, then look again. A cave of
              corridors is not a labyrinth — the deepest direction
              is the way on.

   No flood fill, no routing, no candidate scoring. Fixed work per
   step whatever the size of the level.
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

const {G, P, IN, enemies, EN_MAX, BLOCK, EYE, P_H, SPD_RUN,
       genWorld, idx, inside, isSolidCell, cellXYZ, nbrsOf, raycast,
       shoot, physics, tickGround, updateJump, rebuildWorld, worldB,
       updateEnemies, MARKED, SOLID, AIR, ROCK, aimAt, adv, DIFFS,
       chests, correctFlags, MAX_JUMPS, startThink, endThink, snd,
       findHint, MODE_SWEEP, MODE_DUNGEON, rayEnemy, setDungeonLevels,
       aimRay, ETYPES, setScreen} = T;
try{ G.muted=true; snd.setMute(true); }catch(e){}

let errCount = 0; const seen = new Set();
function err(msg){
  errCount++;
  if (seen.has(msg) || seen.size > 30) return;
  seen.add(msg); errs.push(msg);
}

const DT = 1/30;
/* A hang has to name itself. `phase` is set on entry to everything that loops,
   and the guard is called from BOTH tick() and the big non-ticking loops, so
   it fires wherever the run is stuck. */
let phase='start';
const T0 = performance.now();
/* COUNT, do not time. Under Chrome's virtual clock performance.now() does not
   advance — every duration measured this session came back 0 ms — so a
   time-based watchdog can never fire, which is exactly why it never did and
   why I wrongly concluded the stuck loop "does not tick". A call budget works
   whatever the clock is doing. Apprentice finishes on about 9,000 of these. */
let wdN = 0;
function WD(){
  if (++wdN > 400000)
    throw new Error('watchdog: '+wdN+' checks without finishing, last phase: '+phase);
}
const PH = p => { phase = p; };
/* Two different distances, and they were being muddled.
   WORK is how close it needs to be to dig or flag: three blocks, no closer.
   GUN is how far the weapon actually carries, and anything it can SEE inside
   that gets shot from where it stands — walking at something you could already
   have shot is how you arrive somewhere with less health and no advantage. */
const REACH = 3*BLOCK;          // close enough to work on
const GUN   = 13*BLOCK;         // the weapon's reach, same as the game's REACH
const FAR   = GUN;              // scans carry as far as the gun does
let auditN = 0;
const stats = { walked:0, jumps:0, shots:0, flags:0, noEffect:0,
                killed:0, shotAt:0, chests:0, dodged:0, scans:0, rays:0,
                ticks:0, follows:0, blocked:0, misflag:0, guesses:0, sidesteps:0, surveys:0, clueWork:0,
                guessMines:0, byRule:{}, insideRock:0, fell:0, numFlags:0, numOpens:0,
                lastAct:'nothing yet', foesAtDeath:0, hpAtDeath:0, deaths:{},
                aimFixes:0, bursts:0, nudges:0, chases:0, climbs:0,
                flagAim:0, flagBlocked:0, aimBlind:0, wallSteps:0, futile:0 };

/* ---------------- audit ---------------- */
let baseAir = 0, baseRock = 0;
function snapshotWorld(){
  const N = G.nx*G.ny*G.nz;
  baseAir = 0; baseRock = 0;
  for (let i=0;i<N;i++){ if (G.st[i]===AIR) baseAir++; else if (G.st[i]===ROCK) baseRock++; }
  baseAir -= G.revealed;        // the starting chamber is opened, not born open
}
function audit(tag){
  const N = G.nx*G.ny*G.nz;
  let air=0, marked=0, mines=0, mineAir=0, rock=0, openable=0;
  for (let i=0;i<N;i++){
    const s=G.st[i];
    if (s===AIR){ air++; if (G.mine[i]) mineAir++; }
    else if (s===MARKED){ marked++; if (!G.mine[i]) openable++; }
    else if (s===ROCK) rock++;
    else if (!G.mine[i]) openable++;
    if (G.mine[i]) mines++;
  }
  if (air-baseAir !== G.revealed) err(`${tag}: revealed=${G.revealed} but ${air-baseAir} opened`);
  if (marked!==G.marked)          err(`${tag}: G.marked=${G.marked} but ${marked} flagged`);
  if (mines!==G.mines)            err(`${tag}: mines=${G.mines} but ${mines} placed`);
  if (rock!==baseRock)            err(`${tag}: structure changed ${baseRock} -> ${rock}`);
  if (G.revealed+openable !== G.safeTotal)
    err(`${tag}: ${G.revealed} opened + ${openable} openable != safeTotal ${G.safeTotal}`);
  if (G.state==='play' && mineAir) err(`${tag}: ${mineAir} mine(s) revealed while alive`);
  if (!isFinite(P.x+P.y+P.z))     err(`${tag}: player position NaN`);
  if (P.jumps<0 || P.jumps>MAX_JUMPS) err(`${tag}: jumps out of range ${P.jumps}`);
  if (++auditN % 25 === 0){
    rebuildWorld();
    if (worldB.count>worldB.max) err(`${tag}: worldB overflow ${worldB.count}/${worldB.max}`);
  }
  if (enemies.length>EN_MAX)      err(`${tag}: ${enemies.length} enemies over cap`);
  for (const e of enemies) if (!isFinite(e.x+e.y+e.z)){ err(`${tag}: enemy position NaN`); break; }
}

/* ---------------- the body ---------------- */
const pcell = () => [Math.floor(P.x/BLOCK), Math.floor((P.y+0.2)/BLOCK), Math.floor(P.z/BLOCK)];
function playerInRock(){
  const [x,y,z]=pcell();
  return isSolidCell(x,y,z) || isSolidCell(x, Math.floor((P.y+P_H-0.1)/BLOCK), z);
}
function tick(){
  WD();
  stats.ticks++;
  updateJump(DT); physics(DT); tickGround(DT);
  if (G.boss){ adv(DT); updateEnemies(DT); }
  if (P.y < -30){ stats.fell++; return false; }
  if (playerInRock()){ stats.insideRock++;
    err(`inside rock at ${P.x.toFixed(1)},${P.y.toFixed(1)},${P.z.toFixed(1)}`); return false; }
  return true;
}
function idle(sec){ for (let k=0;k<sec/DT;k++) if(!tick()) return false; return true; }
/* A jump must re-arm jumpFired, or the game correctly refuses a second one from
   a button that was never released. */
function jumpNow(){ IN.jumpHeld=true; IN.jumpFired=false; stats.jumps++; }
const eye = () => [P.x, P.y+EYE, P.z];

/* ---------------- SCAN: the entire world model ---------------- */
const YAWS = 16, PITCHES = [-0.55, -0.22, 0.0, 0.22, 0.55];
function scan(){
  PH('scan'); WD();
  stats.scans++;
  const [ex,ey,ez]=eye();
  const work=[], open=[], seenFar=[];
  for (let a=0;a<YAWS;a++){
    const th = a/YAWS*Math.PI*2;
    for (const pit of PITCHES){
      const dx=Math.cos(th)*Math.cos(pit), dy=Math.sin(pit), dz=Math.sin(th)*Math.cos(pit);
      const h = raycast(ex,ey,ez, dx,dy,dz, FAR, false);
      stats.rays++;
      open.push({dx,dy,dz, run: h.hit ? h.t : FAR});
      if (h.hit && h.kind==='block'){
        const c = idx(h.x,h.y,h.z);
        /* Every puzzle block the eye lands on, at any distance. The ones in
           reach are work for right now; the rest are where to go next, and
           they beat walking down a corridor for its own sake. */
        if (G.st[c]===SOLID){ (h.t<=REACH ? work : seenFar).push({cell:c, d:h.t}); }
      }
    }
  }
  work.sort((p,q)=>p.d-q.d);
  seenFar.sort((p,q)=>p.d-q.d);
  open.sort((p,q)=>q.run-p.run);
  return {work, open, seenFar};
}
/* Is this exact cell visible from here, close enough to work on? Aims at it. */
function inView(cell){
  PH('inView'); WD();
  const [tx,ty,tz]=cellXYZ(cell);
  const [ex,ey,ez]=eye();
  const ax=(tx+0.5)*BLOCK, ay=(ty+0.5)*BLOCK, az=(tz+0.5)*BLOCK;
  for (const o of [[0,0,0],[0.3,0,0],[-0.3,0,0],[0,0.3,0],[0,-0.3,0],[0,0,0.3],[0,0,-0.3]]){
    const px=ax+o[0]*BLOCK, py=ay+o[1]*BLOCK, pz=az+o[2]*BLOCK;
    let vx=px-ex, vy=py-ey, vz=pz-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    if (d>REACH) continue;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, REACH, false);
    stats.rays++;
    if (h.hit && h.x===tx && h.y===ty && h.z===tz){ aimAt(px,py,pz); return true; }
  }
  return false;
}

/* Nothing may stand between the muzzle and the target. If the line is blocked,
   step aside — a pace left, a pace right, or one small hop to see over — and
   look again. Firing at a target you cannot actually see is how a shot ends up
   in a number, or in the wrong block entirely. */
function clearLine(cell){
  PH('clearLine'); WD();
  if (inView(cell)) return true;
  const yaw = P.yaw;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);     // camera right, on the flat
  const tries = [[rx,rz,0], [-rx,-rz,0], [rx,rz,1], [-rx,-rz,1]];
  for (const [sx,sz,hop] of tries){
    const x0=P.x, y0=P.y, z0=P.z;
    // a short sidestep, driven through the real movement flags
    P.yaw = Math.atan2(-sx,-sz);
    IN.f=1;
    for (let k=0;k<0.28/DT;k++){
      if (hop && k===2 && P.ground) jumpNow();
      if (!tick()){ IN.f=0; IN.jumpHeld=false; return false; }
      stats.walked += SPD_RUN*DT;
    }
    IN.f=0; IN.jumpHeld=false;
    if (hop) for (let k=0;k<0.35/DT;k++) if(!tick()) return false;   // let it land
    stats.sidesteps++;
    P.yaw = yaw;
    if (inView(cell)) return true;
    // no better: put it back and try the other way
    P.x=x0; P.y=y0; P.z=z0; P.vx=P.vy=P.vz=0;
  }
  P.yaw = yaw;
  return inView(cell);
}

/* ---------------- FOLLOW: a straight line, then look again ----------------
   Jump only when something low is in the way. Jumping is not how you get
   around, it is how you get over. */
function followLine(o){
  PH('followLine'); WD();
  stats.follows++;
  const want = Math.min(o.run - BLOCK*0.6, FAR);
  if (want < BLOCK) return false;
  P.yaw = Math.atan2(-o.dx, -o.dz);
  const x0=P.x, z0=P.z;
  let stuck=0, best=0;
  const budget = Math.min(4.0, want/SPD_RUN + 1.2);
  for (let k=0; k<budget/DT; k++){
    IN.f=1; IN.b=IN.l=IN.r=0;
    const gone = Math.hypot(P.x-x0, P.z-z0);
    if (gone >= want) break;
    if (gone > best+0.05){ best=gone; stuck=0; }
    else if (++stuck > 0.35/DT){
      if (P.ground) jumpNow(); else IN.jumpHeld=false;
      if (stuck > 1.1/DT){ stats.blocked++; break; }
    }
    if (!tick()){ IN.f=0; IN.jumpHeld=false; return false; }
    stats.walked += SPD_RUN*DT;
  }
  IN.f=0; IN.jumpHeld=false;
  return best > BLOCK*0.8;
}
/* Walk at one cell until it is close enough to work on. Straight line again —
   if the line is blocked, whatever blocks it is itself worth opening. */
function closeOn(cell){
  PH('closeOn'); WD();
  const [cx,cy,cz]=cellXYZ(cell);
  const tx=(cx+0.5)*BLOCK, tz=(cz+0.5)*BLOCK, ty=(cy+0.5)*BLOCK;
  const climb = ty > P.y + BLOCK*1.5;      // needs height: give it longer
  for (let k=0;k<(climb?4.0:2.0)/DT;k++){
    const dx=tx-P.x, dz=tz-P.z;
    const flat=Math.hypot(dx,dz);
    if (Math.hypot(dx, ty-(P.y+EYE), dz) <= REACH*0.85){ IN.f=0; IN.jumpHeld=false; return true; }
    P.yaw = Math.atan2(-dx,-dz);
    IN.f = flat>1.0 ? 1 : 0;
    /* The player has twenty jumps and does not need the ground for any of
       them. Gating this on P.ground meant the bot could only ever climb one
       block, so anything ABOVE it was unreachable — it fell into a lower
       chamber, and every job on the floor it came from became "can't get
       there". Jump toward height whether or not it is standing on anything. */
    if (ty > P.y + BLOCK*0.6 && (P.ground || (P.vy < 1.0 && P.jumps < MAX_JUMPS)))
      jumpNow();
    else IN.jumpHeld=false;
    if (!tick()){ IN.f=0; IN.jumpHeld=false; return false; }
    stats.walked += SPD_RUN*DT;
  }
  IN.f=0; IN.jumpHeld=false;
  return false;
}

/* ---------------- what the board proves ---------------- */
function provenMines(){
  PH('provenMines'); WD();
  const N=G.nx*G.ny*G.nz, out=[], taken=new Set();
  for (let i=0;i<N;i++){
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0; const h=[];
    for (const j of nbrsOf(i)){ const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) h.push(j); }
    if (h.length && G.cnt[i]-f===h.length)
      for (const j of h) if(!taken.has(j)){ taken.add(j); out.push(j); }
  }
  return out;
}
function provenSafe(){
  PH('provenSafe'); WD();
  const N=G.nx*G.ny*G.nz, out=[];
  for (let i=0;i<N;i++){
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0; const h=[];
    for (const j of nbrsOf(i)){ const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) h.push(j); }
    if (h.length && G.cnt[i]-f===0) for (const j of h) out.push(j);
  }
  return out;
}
/* An unsatisfied number is not "nothing to do" — it is a statement that a mine
   is still missing right there, and that its own hidden neighbours are the only
   blocks that can settle it. That was the gap: the bot only looked at clues it
   could FINISH, so a board covered in half-answered numbers read as empty and
   it walked away. Now an unfinished number is a place to work, and its
   neighbours are the work — sorted by how nearly settled the clue is, because
   a 1 with two blocks left tells you far more per shot than a 4 with eight. */
/* Numbers whose remaining hidden blocks must ALL be mines. Right-clicking one
   of these flags them where they stand. */
function forcedClues(){
  PH('forcedClues'); WD();
  const N=G.nx*G.ny*G.nz, out=[];
  const [ex,ey,ez]=eye();
  if (G.revealed < G.safeTotal) return out;      // the game refuses before then
  for (let i=0;i<N;i++){
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0, hid=0;
    for (const j of nbrsOf(i)){ const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) hid++; }
    if (!hid || G.cnt[i]-f !== hid) continue;
    const [x,y,z]=cellXYZ(i);
    out.push({clue:i, d:Math.hypot((x+0.5)*BLOCK-ex,(y+0.5)*BLOCK-ey,(z+0.5)*BLOCK-ez)});
  }
  out.sort((p,q)=>p.d-q.d);
  return out;
}

/* Aiming at the DIGIT rather than the block: the ray has to come back as a
   number on that exact cell. */
function lineToNum(cell){
  const [tx,ty,tz]=cellXYZ(cell);
  const [ex,ey,ez]=eye();
  const cx=(tx+0.5)*BLOCK, cy=(ty+0.5)*BLOCK, cz=(tz+0.5)*BLOCK;
  let vx=cx-ex, vy=cy-ey, vz=cz-ez;
  const d=Math.hypot(vx,vy,vz)||1;
  if (d>REACH) return false;
  const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, REACH, true);
  stats.rays++;
  if (h.hit && h.kind==='num' && h.x===tx && h.y===ty && h.z===tz){ aimAt(cx,cy,cz); return true; }
  return false;
}

/* Numbers with every mine already flagged: right-clicking opens the rest. */
function satisfiedClues(){
  PH('satisfiedClues'); WD();
  const N=G.nx*G.ny*G.nz, out=[];
  const [ex,ey,ez]=eye();
  for (let i=0;i<N;i++){
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0, hid=0;
    for (const j of nbrsOf(i)){ const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) hid++; }
    if (!hid || G.cnt[i]-f !== 0) continue;
    const [x,y,z]=cellXYZ(i);
    out.push({clue:i, hid,
              d:Math.hypot((x+0.5)*BLOCK-ex,(y+0.5)*BLOCK-ey,(z+0.5)*BLOCK-ez)});
  }
  out.sort((p,q)=> (q.hid - p.hid) || (p.d - q.d));   // most opened first
  return out;
}

function unfinished(){
  PH('unfinished'); WD();
  const N=G.nx*G.ny*G.nz, out=[];
  const [ex,ey,ez]=eye();
  for (let i=0;i<N;i++){
    if (G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0; const h=[];
    for (const j of nbrsOf(i)){ const s=G.st[j]; if (s===MARKED) f++; else if (s===SOLID) h.push(j); }
    const need = G.cnt[i]-f;
    if (!h.length || need<=0 || need>=h.length) continue;   // settled or unreadable
    const [x,y,z]=cellXYZ(i);
    const d=Math.hypot((x+0.5)*BLOCK-ex, (y+0.5)*BLOCK-ey, (z+0.5)*BLOCK-ez);
    out.push({clue:i, hidden:h, need, tightness:h.length-need, d});
  }
  /* nearest first, and among those the clue closest to resolving */
  out.sort((p,q)=> (p.d - q.d) || (p.hidden.length - q.hidden.length));
  return out;
}

/* The game's own solver: arrows, counts and the two-clue subset rule. Its
   subset pass compares every clue against every other, so it is the expensive
   one and runs only when the cheap rules come up empty. */
function solverMove(){
  PH('solverMove'); WD();
  try{ T.hover = {hit:false}; }catch(e){}
  const h = findHint();
  return h ? {cell:h.target, mine:!!h.mine, rule:h.rule||'?'} : null;
}
function flagIt(cell){
  startThink(); endThink();
  stats.flags++;
  if (G.st[cell]!==MARKED){ stats.misflag++; return false; }
  return true;
}

/* ---------------- combat ---------------- */
function beingAimedAt(){ for (const e of enemies) if (e.aim && e.lock>0) return e; return null; }
function dodge(){
  PH('dodge'); WD();
  const e = beingAimedAt();
  if (!e) return false;
  stats.dodged++;
  const ax=P.x-e.x, az=P.z-e.z, len=Math.hypot(ax,az)||1;
  const sx=-az/len, sz=ax/len, dir=(stats.dodged&1)?1:-1;
  P.yaw = Math.atan2(-sx*dir, -sz*dir);
  IN.f=1; IN.sprint=true;
  const frames = Math.max(4, Math.ceil(Math.min(0.5, e.lock)/DT));
  for (let k=0;k<frames;k++) if(!tick()){ IN.f=0; IN.sprint=false; return false; }
  IN.f=0; IN.sprint=false;
  return true;
}
/* COMBAT, as a state machine rather than a chase.

     visible, line clear     ->  empty into it, committed to one target
     visible, line blocked   ->  two paces sideways and a hop; half these walls
                                 are low and the shot exists from above
     nothing visible, alive  ->  walk at where you last saw it, still facing
                                 that way so it returns to view mid-stride
     walking into a wall     ->  climb it. Twenty jumps and a router that goes
                                 up two blocks means high ground is nearly
                                 always available, and high ground has the shot

   Nothing here pathfinds. Every branch is a fixed, small amount of work, so it
   costs the same in a corridor as in a cathedral — which is the point: the
   version that DID pathfind to the enemy every step turned a 100-second run
   into one that never finished. */
let lastSeen=null, chasing=0;

function seeEnemy(e){
  const [ex,ey,ez]=eye();
  const vx=e.x-ex, vy=e.y-ey, vz=e.z-ez;
  const d=Math.hypot(vx,vy,vz)||1;
  if (d>GUN) return false;
  const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, d, false);
  const T=ETYPES[e.t] || {r:1};
  const slack = Math.max(0.6, (T.r||1)*(e.mScale||1));
  return !(h.hit && h.t < d-slack);
}
/* Will the shot land on THAT thing? shoot() casts its own ray and takes
   whatever it meets, so aiming near something is not the same as hitting it.
   Ask before pulling the trigger: a shot into a wall is one the thing shooting
   back does not have to survive. */
function aimTrue(e){
  /* Offsets scale with the thing being shot at. They were fixed numbers tuned
     when a finale creature had a 2.30 m radius; it is 1.15 now and half the
     roster is barely wider than the player, so a fixed 0.45 m offset aims at
     empty air beside a small target. */
  const T = ETYPES[e.t] || {r:1};
  const rr = (T.r||1) * (e.mScale||1) * 0.45;
  for (const [ox,oy] of [[0,0],[0,rr],[0,-rr*0.8],[rr*0.8,rr*0.4],[-rr*0.8,rr*0.4]]){
    aimAt(e.x+ox, e.y+oy, e.z);
    const r=aimRay();
    const hit=rayEnemy(r.ox,r.oy,r.oz, r.dx,r.dy,r.dz, GUN);
    if (hit && hit.e===e) return true;
    stats.aimFixes++;
  }
  /* Nothing confirmed — but it can SEE the thing, so shoot anyway. A failed
     confirmation must never mean "stand there": the bot reached the finale
     once, never fired a shot at it, and died. */
  aimAt(e.x, e.y, e.z);
  stats.aimBlind++;
  return true;
}
function nudge(e){
  const ax=P.x-e.x, az=P.z-e.z, len=Math.hypot(ax,az)||1;
  const dir=(stats.nudges&1)?1:-1;
  P.yaw=Math.atan2(-(-az/len)*dir, -(ax/len)*dir);
  IN.f=1; if (P.ground) jumpNow();
  for (let k=0;k<Math.ceil(0.24/DT);k++){
    if(!tick()){ IN.f=0; return false; }
    if (seeEnemy(e) && aimTrue(e)){            // it opened up mid-hop
      IN.f=0; stats.shotAt++; shoot(); stats.bursts++; stats.nudges++; return true;
    }
  }
  IN.f=0; stats.nudges++; return true;
}
function advance(m){
  const dx=m.x-P.x, dz=m.z-P.z, flat=Math.hypot(dx,dz);
  if (flat < BLOCK*0.8){ lastSeen=null; return false; }
  P.yaw=Math.atan2(-dx,-dz);
  P.pitch=Math.atan2(m.y-(P.y+EYE), flat);
  const x0=P.x, z0=P.z;
  IN.f=1; IN.sprint=true;
  const frames=Math.ceil(0.30/DT);
  for (let k=0;k<frames;k++){
    if(!tick()){ IN.f=0; IN.sprint=false; return false; }
    // stuck against something: go up it rather than into it
    if (k===(frames>>1) && Math.hypot(P.x-x0,P.z-z0)<BLOCK*0.15 && P.ground){
      jumpNow(); stats.climbs++;
    }
  }
  IN.f=0; IN.sprint=false; stats.chases++;
  // went nowhere at all: the wall beats a jump, so let the memory go
  if (Math.hypot(P.x-x0,P.z-z0) < BLOCK*0.2) chasing += 3;
  return true;
}
/* WALL FOLLOWING. Marcelo's read, and it is the right one: aiming at a far
   target works in open ground and breaks the moment the bot is entangled in
   structure — it walks into the wall between itself and the target, forever.
   A straight line cannot get out of a maze; a hand on the wall can.

   Right-hand rule, using the game's own collision to decide what a wall is:
   if the right is open, turn right and go; else if ahead is open, go ahead;
   else turn left. Repeat and it traces the boundary of whatever pocket it is
   in, which is how it finds the mouth of a corridor or the lip of a shaft. */
function wallFollow(){
  PH('wallFollow'); WD();
  const probe = (yaw, dist) => {
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    const h = raycast(P.x, P.y+EYE*0.5, P.z, dx, 0, dz, dist, false);
    return h.hit && h.t < dist;
  };
  const HALF = Math.PI/2;
  const ahead = probe(P.yaw, BLOCK*1.1);
  const right = probe(P.yaw - HALF, BLOCK*1.1);
  if (!right)     P.yaw -= HALF;          // opening on the right: take it
  else if (ahead) P.yaw += HALF;          // boxed in: turn away
  // else wall on the right and road ahead: carry straight on
  const x0=P.x, y0=P.y, z0=P.z;
  IN.f=1;
  /* Jump as it goes, always. A chamber's way out is often UP — the lip of a
     shaft, a step onto the mass — and a perimeter walk at floor level can
     trace a room forever without ever finding it. */
  for (let k=0;k<Math.ceil(0.5/DT);k++){
    if (!tick()){ IN.f=0; return false; }
    if (P.ground && (k%7)===2) jumpNow();
    stats.walked += SPD_RUN*DT;
  }
  IN.f=0; stats.wallSteps++;
  // moved on the flat, or gained height: either counts as getting somewhere
  return Math.hypot(P.x-x0, P.z-z0) > BLOCK*0.25 || Math.abs(P.y-y0) > BLOCK*0.4;
}


/* Shots that change nothing are not a fight. The blind-fire fallback means
   aimTrue() never refuses, so a burst always "succeeds" — and against something
   the shots cannot actually reach, that makes combat win every step forever:
   fourteen consecutive "shot at something", 47 shots, one enemy still standing,
   and the board untouched. Count the engagements that did no damage and stop
   choosing that target after three. */
const foeFail = new Map();
function fightBack(){
  PH('fightBack'); WD();
  if (!enemies.length){ lastSeen=null; chasing=0; return false; }
  let best=null;
  for (const e of enemies){
    if ((foeFail.get(e)||0) >= 3) continue;      // shooting this is not working
    if (!seeEnemy(e)) continue;
    const d=Math.hypot(e.x-P.x, e.y-P.y, e.z-P.z);
    const threat=(e.aim && e.lock>0)?0:1;      // whatever is about to fire, first
    if (!best || threat<best.threat || (threat===best.threat && d<best.d))
      best={e,d,threat};
  }
  if (best){
    const e=best.e;
    lastSeen={x:e.x,y:e.y,z:e.z}; chasing=0;
    /* Commit. Picking "nearest" afresh between shots is how a thing with three
       hit points survives nine of them. */
    const hp0 = e.hp!==undefined ? e.hp : (e.dhp!==undefined ? e.dhp : 1);
/* An ordinary enemy dies in a handful. A fourteen-shot burst on something
       with three hit points is nine shots during which everything ELSE on the
       board is lining up on you — and standing still is what these kill you
       for. The finale is the exception and gets a longer look. */
    const budget = e.hell ? 12 : Math.min(6, Math.max(2, hp0+1));
    let fired=0;
    while (fired<budget && enemies.indexOf(e)>=0 && G.state==='play'){
      if (!aimTrue(e)) break;
      stats.shotAt++; shoot(); fired++;
      if (!tick()) break;
    }
    if (fired){
      stats.bursts++;
      if (enemies.indexOf(e) < 0){ stats.killed++; foeFail.delete(e); return true; }
      const hp1 = e.hp!==undefined ? e.hp : (e.dhp!==undefined ? e.dhp : 1);
      if (hp1 >= hp0){                            // emptied a burst, did nothing
        foeFail.set(e, (foeFail.get(e)||0)+1);
        stats.futile++;
        if ((foeFail.get(e)||0) >= 3) return false;   // give the board its turn back
      } else foeFail.delete(e);
      return true;
    }
    return nudge(e);
  }
  if (lastSeen && chasing<8){ chasing++; return advance(lastSeen); }
  /* Nothing seen and nothing remembered, but something is alive: hell range is
     64 m and the bot only engages to 52, so a thing can shoot it from outside
     the distance at which it will even look. Walk at the nearest one. */
  if (enemies.length){
    let near=null;
    for (const e of enemies){
      const d=Math.hypot(e.x-P.x, e.y-P.y, e.z-P.z);
      if (!near || d<near.d) near={e,d};
    }
    if (near && near.d > GUN*0.9){
      lastSeen={x:near.e.x, y:near.e.y, z:near.e.z}; chasing=1;
      return advance(lastSeen);
    }
  }
  return false;
}
function grabChest(){
  const [ex,ey,ez]=eye();
  for (const c of chests){
    if (c.open) continue;
    let vx=c.x-ex, vy=c.y-ey, vz=c.z-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    if (d>FAR) continue;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, d, false);
    if (h.hit && h.t < d-1.0) continue;
    aimAt(c.x,c.y,c.z); shoot(); stats.chests++;
    return true;
  }
  return false;
}

/* Let the GAME decide when the game is over. This used to carry its own
   opinion — "the dungeon is done once every safe block is dug" — which stopped
   the run at 100/100 opened with 15 of 20 mines still unflagged and a finale
   that had not even been summoned. The dungeon ends on the last FLAG and then
   on the thing that comes for you; digging it out is not finishing it.
   Mirroring G.win means the bot can never disagree with the board again. */
const won = () => G.win === true;

/* ---------------- one game ---------------- */
/* "died to a mine" does not say whose mine. The bot declines to dig one, so a
   detonation is either an enemy shot going through a mined block — which the
   rules allow on purpose — or the bot's own last action doing something it did
   not expect. Those need opposite fixes, so name it. */
function diedHow(){
  const foes = enemies.length;
  stats.foesAtDeath = foes; stats.hpAtDeath = P.hp;
  const k = G.deathBy==='shot' ? 'shot dead by an enemy'
          : (foes ? `a mine went off with ${foes} enemy(s) alive, last own action: ${stats.lastAct}`
                  : `a mine went off with nothing alive, last own action: ${stats.lastAct}`);
  stats.deaths[k]=(stats.deaths[k]||0)+1;
  return 'died — '+k;
}

const NOFOES = /[?&]nofoes/.test(location.search);

/* ============================================================
   ONE LADDER
   ============================================================
   There used to be two of these: a headless loop and a watch loop, each with
   its own copy of the priorities. They drifted, and every single time the
   watch driver was the one missing a rung — refusal memory, the endgame
   number-flagging, the wander limit, provenMines, then seenFar. Five bugs, one
   cause, and each one cost a run that was sat and watched failing.

   So there is now one ladder. `newRun()` holds everything a run remembers and
   `climb()` takes exactly one action, returning WHAT IT DID rather than
   whether it ran — which is the other lesson: three separate bugs were an
   action reporting success while the board did not move (travel that did not
   travel, a flag that did not land, a burst that did no damage). Every rung
   here compares the board before and after.

   The drivers are now only a clock. Headless calls climb() flat out; the watch
   page calls it on a timer so the browser gets frames back in between. Neither
   makes a decision of its own.
   ============================================================ */

/* R.done is the reason to stop, or null. R.note is for humans. */
function newRun(){
  return {
    refused: new Map(),        // cell -> failures. LOCAL: "not reachable from here"
    counted: new Set(),        // a cell is counted as a guess once, not once per step
    wander: 0,                 // steps spent walking without finding work
    stuck: 0,                  // consecutive failures to travel
    travelTry: 0,
    surveyed: false, moved: true,
    acted: 0, walked: 0, peak: 0, dry: 0, retried: false,
    note: 'starting', done: null, label: ''
  };
}

function climb(R){
  const giveUp = c => (R.refused.get(c)||0) >= 2;
  const refuse = c => R.refused.set(c, (R.refused.get(c)||0)+1);
  const A = (note, tag) => {                      // an action that CHANGED the board
    R.acted++; R.note = note; R.wander = 0; R.stuck = 0; R.dry = 0;
    if (R.label) audit(R.label+' '+(tag||'act'));
    return true;
  };
  const W = note => { R.walked++; R.note = note; R.moved = true; R.dry = 0; return true; };

  if (won())             { R.done = 'finished'; return false; }
  if (G.state !== 'play'){ R.done = diedHow();  return false; }
  if (!idle(0.1))        { R.done = 'physics fault'; return false; }
  if (G.state !== 'play'){ R.done = diedHow();  return false; }

  if (NOFOES && enemies.length) enemies.length = 0;

  /* --- 1. STAY ALIVE. Everything else assumes there is a player left. --- */
  if (G.boss && enemies.length){
    R.peak = Math.max(R.peak, enemies.length);
    if (dodge()) R.note = 'dodging';
    if (G.state !== 'play'){ R.done = diedHow(); return false; }
    const foes0 = enemies.length, kills0 = stats.killed;
    if (fightBack()){
      /* "shot at something" is not a fight. It said that while jumping at a
         wall. Only a kill or a real change in the field counts as an action. */
      if (stats.killed > kills0) return A('killed one, '+enemies.length+' left', 'kill');
      R.note = 'fighting ('+foes0+' up)';
      return true;
    }
  }

  if (chests.length && grabChest()) return A('opened a chest', 'chest');

  /* --- 2. LOOK. A survey is two extra sweeps, and only after moving. --- */
  if (R.moved){ R.surveyed = false; R.moved = false; }
  if (!R.surveyed){ scan(); scan(); R.surveyed = true; stats.surveys++; }
  const s = scan();

  /* --- 3. THE ENDGAME. Once every safe block is out, the mines left over are
     often walled in by what was dug around them and no shot can touch them. A
     NUMBER will plant those flags, so aim at the DIGIT. It is the only way the
     last few ever go down, and the dungeon ends on the last flag. --- */
  if (G.revealed >= G.safeTotal && G.marked < G.mines){
    for (const u of forcedClues()){
      if (giveUp(u.clue)) continue;
      if (!lineToNum(u.clue)){
        R.moved = true;
        if (!closeOn(u.clue) || !lineToNum(u.clue)){ refuse(u.clue); continue; }
      }
      stats.lastAct = 'numflag';
      const m0 = G.marked;
      startThink(); endThink();
      if (G.marked > m0){
        stats.numFlags += G.marked - m0;
        return A('flagged '+(G.marked-m0)+' through a number', 'numflag');
      }
      refuse(u.clue);
    }
  }

  /* --- 4. AND OPEN THROUGH A NUMBER — the same move on the safe side. A
     number whose mines are all flagged opens everything else it touches,
     including blocks buried with every face covered: provable, unhittable. --- */
  for (const u of satisfiedClues()){
    if (giveUp(u.clue)) continue;
    if (!lineToNum(u.clue)){
      R.moved = true;
      if (!closeOn(u.clue) || !lineToNum(u.clue)){ refuse(u.clue); continue; }
    }
    const r0 = G.revealed;
    startThink(); endThink();
    if (G.revealed > r0){
      stats.numOpens += G.revealed - r0;
      return A('opened '+(G.revealed-r0)+' through a number', 'spread');
    }
    refuse(u.clue);
  }

  /* --- 5. MARK FIRST. The dungeon charges for digging beside a mine that is
     not marked yet, so a proven mine is always the next move. findHint prefers
     a safe dig and would otherwise never offer a flag: on a four-zone dungeon
     there is always another dig, so it once flagged NOTHING in 206 steps. --- */
  for (const cell of provenMines()){
    if (giveUp(cell) || G.st[cell] !== SOLID) continue;
    if (!clearLine(cell)){
      R.moved = true;
      if (!closeOn(cell) || !clearLine(cell)){ refuse(cell); continue; }
    }
    if (flagIt(cell)){ R.refused.delete(cell); return A('flagged a proven mine', 'flag'); }
    refuse(cell);
    break;
  }

  for (const cell of provenSafe()){
    if (giveUp(cell) || G.st[cell] !== SOLID) continue;
    if (!clearLine(cell)){
      R.moved = true;
      if (!closeOn(cell) || !clearLine(cell)){ refuse(cell); continue; }
    }
    const before = G.revealed;
    stats.lastAct = 'safe';
    shoot(); stats.shots++;
    if (G.mine[cell]) err(R.label+': a cell proved safe was a mine');
    if (G.revealed > before) return A('dug a proven safe block', 'safe');
    refuse(cell);
    break;
  }

  /* --- 6. THE SOLVER. --- */
  {
    const mv = solverMove();
    if (mv && !giveUp(mv.cell)){
      let ok = clearLine(mv.cell);
      if (!ok){ R.moved = true; if (closeOn(mv.cell)) ok = clearLine(mv.cell); }
      if (ok){
        const before = G.revealed + G.marked;
        stats.lastAct = 'solve';
        if (!mv.mine && G.mine[mv.cell]) err(R.label+': the SOLVER called a cell safe and it is a mine');
        if (mv.mine) flagIt(mv.cell); else { shoot(); stats.shots++; }
        stats.byRule[mv.rule] = (stats.byRule[mv.rule]||0) + 1;
        if (G.revealed + G.marked > before){
          R.refused.delete(mv.cell);
          return A('solver: '+(mv.mine?'flag':'dig')+' ('+mv.rule+')', 'solve');
        }
        stats.noEffect++; refuse(mv.cell);
      } else refuse(mv.cell);
    }
  }

  /* --- 7. DIG BESIDE INFORMATION. Nothing is provable yet, but a number that
     still wants a mine says where the answer lives. Digging next to a clue
     beats digging next to nothing: it turns an ambiguous cluster solvable. --- */
  for (const u of unfinished().slice(0, 6)){
    for (const cell of u.hidden){
      if (giveUp(cell) || G.st[cell] !== SOLID) continue;
      if (!clearLine(cell)){
        R.moved = true;
        if (!closeOn(cell) || !clearLine(cell)){ refuse(cell); continue; }
      }
      if (!R.counted.has(cell)){
        R.counted.add(cell); stats.guesses++;
        if (G.mine[cell]) stats.guessMines++;
      }
      /* Peeking to DECLINE is a cheat and it is deliberate: a bot that digs
         blind dies in the first minute and tests nothing. Peeking to COUNT is
         not, and that count is the real risk a player carries here. */
      if (G.mine[cell]){ refuse(cell); continue; }
      const before = G.revealed;
      stats.lastAct = 'clue';
      shoot(); stats.shots++; stats.clueWork++;
      if (G.revealed > before) return A('dug beside a number', 'clue');
      refuse(cell);
    }
  }

  /* --- 8. WORK ALL OF IT BEFORE LOOKING FOR MORE. s.work is what stands
     within three blocks; s.seenFar is everything else the eye landed on. The
     gun reaches thirteen blocks, so anything visible inside that is work to do
     from here and now. Past that, walk at it. The area is finished before it
     goes looking for another — the priority asked for after it was watched
     leaving a wall of unopened blocks behind it. --- */
  for (const w of s.work.concat(s.seenFar)){
    if (G.st[w.cell] !== SOLID || giveUp(w.cell)) continue;
    if (!R.counted.has(w.cell)){
      R.counted.add(w.cell); stats.guesses++;
      if (G.mine[w.cell]) stats.guessMines++;
    }
    if (G.mine[w.cell]) continue;
    if (w.d <= GUN && clearLine(w.cell)){
      const before = G.revealed;
      stats.lastAct = 'dig';
      shoot(); stats.shots++;
      if (G.revealed > before){
        R.refused.delete(w.cell);
        return A('dug visible work '+w.d.toFixed(0)+' m off', 'dig');
      }
      refuse(w.cell); continue;
    }
    const px = P.x, py = P.y, pz = P.z;
    closeOn(w.cell);
    if (Math.hypot(P.x-px, P.y-py, P.z-pz) > BLOCK*0.5)
      return W('going to visible work '+w.d.toFixed(0)+' m off');
    refuse(w.cell);
  }

  /* --- 9. THE LAST FEW. The game only lets a number plant flags once every
     safe block is out, so ONE safe block it cannot reach keeps the endgame
     shut and it wanders for the rest of the run. When almost nothing is left,
     go and find those specifically — in every state, not just SOLID: a safe
     block it FLAGGED by mistake is MARKED, and that is exactly the cell that
     holds the endgame closed. Take the flag off, then dig it.
     No giveUp here. These are the only cells that matter now. --- */
  if (G.safeTotal - G.revealed <= 5){
    const N = G.nx*G.ny*G.nz;
    let best = -1, bd = 1e9, wrong = -1;
    if (R.stuck++ % 8 === 7) R.refused.clear();
    for (let i=0;i<N;i++){
      if (G.mine[i]) continue;
      if (G.st[i] === MARKED){ if (wrong < 0) wrong = i; continue; }
      if (G.st[i] !== SOLID) continue;
      const c = cellXYZ(i);
      const d = Math.hypot((c[0]+.5)*BLOCK-P.x, (c[1]+.5)*BLOCK-P.y, (c[2]+.5)*BLOCK-P.z);
      if (d < bd){ bd = d; best = i; }
    }
    if (wrong >= 0 && (clearLine(wrong) || (closeOn(wrong) && clearLine(wrong)))){
      startThink(); endThink();                       // release on it: unflags
      if (G.st[wrong] !== MARKED) return A('took a wrong flag off a safe block', 'unflag');
      refuse(wrong);
    }
    if (best >= 0){
      if (clearLine(best) || (closeOn(best) && clearLine(best))){
        const before = G.revealed;
        stats.lastAct = 'lastfew';
        shoot(); stats.shots++;
        if (G.revealed > before) return A('dug one of the last safe blocks', 'lastfew');
        refuse(best);
      } else refuse(best);
      R.note = 'hunting the last safe blocks';
      R.moved = true;
      return true;
    }
  }

  /* --- 10. TRAVEL. Nothing visible left: pick the nearest block ANYWHERE that
     still touches open space and go to it. That is what carries it down a
     shaft into the next zone.
     Refusals are a local judgement and it has walked kilometres since making
     most of them, so a board-wide scan must ignore them — applying them here
     is how it announced "nothing left it can reach anywhere" with 17 safe
     blocks and 9 mines still on the board. --- */
  {
    const N = G.nx*G.ny*G.nz;
    let tgt = -1, td = 1e9;
    if (R.travelTry++ % 10 === 9) R.refused.clear();
    for (let i=0;i<N;i++){
      if (G.st[i] !== SOLID || G.mine[i]) continue;
      let touches = false;
      for (const j of nbrsOf(i)) if (G.st[j] === AIR){ touches = true; break; }
      if (!touches) continue;
      const c = cellXYZ(i);
      const d = Math.hypot((c[0]+.5)*BLOCK-P.x, (c[1]+.5)*BLOCK-P.y, (c[2]+.5)*BLOCK-P.z);
      if (d < td){ td = d; tgt = i; }
    }
    if (tgt >= 0){
      const px = P.x, py = P.y, pz = P.z;
      if (clearLine(tgt)){
        const before = G.revealed;
        stats.lastAct = 'travel-dig';
        shoot(); stats.shots++;
        if (G.revealed > before) return A('dug toward the work, '+td.toFixed(0)+' m off', 'travel');
        refuse(tgt);
      }
      closeOn(tgt);
      if (Math.hypot(P.x-px, P.y-py, P.z-pz) > BLOCK*0.5)
        return W('closing on work '+td.toFixed(0)+' m away');
      /* closeOn can report success while going nowhere — it "walked", into a
         wall. Only real displacement counts. Anything else means entangled:
         hug the wall, which traces the pocket until it finds the way out. */
      refuse(tgt);
      if (R.stuck++ < 14 && wallFollow()) return W('following the wall out ('+R.stuck+')');
    }
  }

  /* --- 11. FOLLOW AN OPENING. Last resort, and it is not progress: walking
     down a corridor is how you FIND work, not how you do it. --- */
  for (let k=0;k<3;k++){
    const o = s.open[k];
    if (o && o.run >= BLOCK*1.5 && followLine(o)){
      R.wander++;
      return W('walking a sightline ('+R.wander+')');
    }
  }

  /* --- 12. NOTHING WORKED. Only the board itself may end a run: an exhausted
     blacklist used to look identical to an exhausted level. --- */
  let remain = 0;
  for (let i=0;i<G.nx*G.ny*G.nz;i++) if (G.st[i] === SOLID && !G.mine[i]) remain++;
  if (remain === 0 && G.marked >= G.mines){ R.done = 'board exhausted'; return false; }
  if (++R.dry >= 30){
    if (R.retried){ R.done = 'stuck with '+remain+' safe blocks it never reached'; return false; }
    /* Before giving up, forget what it gave up on: a target refused from one
       side of a wall is often trivial from the other. One fresh look, then it
       is genuinely done. */
    R.retried = true; R.dry = 0; R.wander = 0; R.stuck = 0; R.refused.clear();
  }
  R.note = 'nothing it could reach ('+remain+' still shut)';
  return true;
}

/* ---------------- one game, headless: climb() on a tight loop ---------------- */
function playGame(diff, mode, label){
  G.mode = mode;
  /* ?zones=N builds a smaller dungeon: one mine area, then two, then the
     lot. If a fault only appears at four, it scales with the level; if it
     is there at one, it is in the level. */
  const zq = /[?&]zones=(\d+)/.exec(location.search);
  if (zq && mode===MODE_DUNGEON) setDungeonLevels(+zq[1]);
  genWorld(diff);
  if (NOFOES){ G.boss=false; enemies.length=0; }
  G.state='play';
  IN.f=IN.b=IN.l=IN.r=0; IN.jumpHeld=false; IN.jumpFired=false; IN.sprint=false;
  snapshotWorld();
  audit(label+' fresh');

  const R = newRun(); R.label = label;
  let step = 0;
  const qs = /[?&]steps=(\d+)/.exec(location.search);
  const cap = qs ? +qs[1] : Math.min(1200, G.safeTotal*3 + 300);

  for (; step<cap; step++){
    try{ document.body.dataset.r = label+' step '+step; }catch(e){}
    if (!climb(R)) break;
  }
  if (!R.done) R.done = 'ran out of steps';

  let left=0;
  for (let i=0;i<G.nx*G.ny*G.nz;i++) if (G.st[i]===SOLID && !G.mine[i]) left++;
  return {moves:R.acted, peak:R.peak, state:G.state, won:won(), why:R.done, steps:step,
          opened:G.revealed, of:G.safeTotal, flags:G.marked, mines:G.mines, left,
          autopsy: won() ? '' : autopsy()};
}

/* Why did it stop? Two answers are possible and they need opposite fixes.
   Either the board still contains a deduction it did not make — a reasoning
   hole — or it made them all and simply could not get to the blocks, which is
   a reach problem. Guessing between those wasted whole rounds of this project,
   so it is counted instead. */
function autopsy(){
  const N=G.nx*G.ny*G.nz;
  let shut=0, orphan=0, deducible=0, unclear=0, forced=0, half=0;
  for (let i=0;i<N;i++){
    if (G.st[i]!==SOLID) continue;
    shut++;
    let touched=false, proven=false;
    for (const c of nbrsOf(i)){
      if (G.st[c]!==AIR || G.cnt[c]===0) continue;
      touched=true;
      let f=0, hid=0;
      for (const j of nbrsOf(c)){ const st=G.st[j]; if (st===MARKED) f++; else if (st===SOLID) hid++; }
      const need=G.cnt[c]-f;
      if (need===0 || need===hid) proven=true;      // all safe, or all mine
    }
    if (!touched) orphan++;
    else if (proven) deducible++;
    else unclear++;
  }
  for (const u of forcedClues()) forced++;
  for (const u of unfinished()) half++;
  return `left shut: ${shut} — ${orphan} touch no number at all, ${deducible} are already `+
         `provable and it just could not get to them, ${unclear} need more digging first. `+
         `Clues on the board: ${forced} forced (flag now), ${half} half-read.`;
}

/* ---------------- suite ---------------- */
/* ============================================================
   WATCHABLE BOT  —  ?watch
   ============================================================
   The headless bot answers one question at the end and is silent until then,
   which is how a ReferenceError on the first shot went unseen for hours. This
   mode answers continuously: it plays in a real browser at a pace you can
   follow, the game renders between its moves, and everything it is thinking
   goes on screen — step, phase, target, stats, and any error with its stack,
   printed rather than swallowed.

   It is the SAME bot: the same scan, the same solver, the same combat, the
   same helpers. What differs is only WHEN steps happen — spaced out by a timer
   instead of run flat out — so the browser gets the frames back in between.
   Movement therefore arrives in short hops rather than smoothly; that is the
   honest cost of not rewriting the bot into a real-time controller, and it
   does not change any decision it makes.
   ============================================================ */
if (/[?&]watch/.test(location.search)){
  const qmode = /[?&]sweep/.test(location.search) ? MODE_SWEEP : MODE_DUNGEON;
  const qz = /[?&]zones=(\d+)/.exec(location.search);
  const qd = /[?&]diff=(\d)/.exec(location.search);

  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;right:8px;top:8px;z-index:99999;width:330px;max-height:94vh;'+
    'overflow:auto;background:rgba(8,10,16,.86);color:#cfe;font:12px/1.45 monospace;'+
    'padding:10px;border:1px solid #2b3a4a;white-space:pre-wrap';
  document.body.appendChild(box);

  const ctl = document.createElement('div');
  ctl.style.cssText =
    'position:fixed;right:8px;bottom:8px;z-index:99999;background:rgba(8,10,16,.9);'+
    'color:#cfe;font:12px monospace;padding:8px;border:1px solid #2b3a4a';
  ctl.innerHTML =
    'pace <input id="wSpd" type="range" min="0" max="1200" value="260" style="width:130px">'+
    '<span id="wSpdV">260ms</span><br>'+
    '<button id="wPause">pause</button> <button id="wStep">step</button>';
  document.body.appendChild(ctl);

  let pace = 260, paused = false, timer = 0;
  document.getElementById('wSpd').addEventListener('input', e => {
    pace = +e.target.value;
    document.getElementById('wSpdV').textContent = pace + 'ms';
    if (!paused) { clearInterval(timer); timer = setInterval(pump, Math.max(16, pace)); }
  });
  document.getElementById('wPause').addEventListener('click', e => {
    paused = !paused; e.target.textContent = paused ? 'resume' : 'pause';
    clearInterval(timer);
    if (!paused) timer = setInterval(pump, Math.max(16, pace));
  });
  document.getElementById('wStep').addEventListener('click', () => { paused = true;
    document.getElementById('wPause').textContent = 'resume'; clearInterval(timer); pump(); });

  const log = [];
  const say = m => { log.unshift(m); if (log.length > 14) log.pop(); };

  G.mode = qmode;
  if (qz && qmode === MODE_DUNGEON) setDungeonLevels(+qz[1]);
  genWorld(qd ? +qd[1] : 0);
  G.state = 'play';
  try { setScreen('play'); } catch(e) {}
  snapshotWorld();

  /* Everything a run remembers lives in R, and R is the SAME object the
     headless run uses. There is no second copy of the priorities here any
     more — that duplication cost five bugs, all of them a rung the watch
     driver had never been given. */
  const R = newRun();
  let step = 0, dead = false;

  function draw(){
    const foes = enemies.length;
    box.textContent =
      'WATCHABLE BOT   ' + (paused ? '[paused]' : '') + '\n' +
      (qmode === MODE_DUNGEON ? 'Dungeon' : '3D Minesweeper') +
      (qz ? '  zones ' + qz[1] : '') + '   step ' + step + '\n' +
      '--------------------------------\n' +
      'state    ' + G.state + (dead ? '   <-- STOPPED' : '') + '\n' +
      'note     ' + R.note + '\n' +
      (R.done ? 'ENDED    ' + R.done + '\n' : '') +
      'opened   ' + G.revealed + ' / ' + G.safeTotal + '\n' +
      'flags    ' + G.marked + ' / ' + G.mines + '\n' +
      'life     ' + P.hp + '/4      foes ' + foes + '\n' +
      /* where it is standing, and whether that is anywhere legal — so "it went
         into a wall" is answerable by looking instead of by argument */
      'at       ' + P.x.toFixed(1) + ',' + P.y.toFixed(1) + ',' + P.z.toFixed(1) + '  ' +
      (function(){
        const x = Math.floor(P.x/BLOCK), y = Math.floor(P.y/BLOCK), z = Math.floor(P.z/BLOCK);
        if (!inside(x,y,z)) return 'OUTSIDE THE MAP';
        const h = G.st[idx(x,y,z)];
        return h===AIR ? 'open air' : (h===ROCK ? 'INSIDE STRUCTURE' : 'INSIDE A BLOCK');
      })() + '\n' +
      'actions  ' + R.acted + '   walks ' + R.walked + '\n' +
      'shots    ' + stats.shots + '   flags ' + stats.flags +
      '   kills ' + stats.killed + '\n' +
      'guesses  ' + stats.guesses + ' (' + stats.guessMines + ' were mines)\n' +
      'walked   ' + stats.walked.toFixed(0) + ' m   jumps ' + stats.jumps + '\n' +
      'faults   ' + errCount + '\n' +
      '--------------------------------\n' + log.join('\n');
  }

  /* THE CLOCK, AND NOTHING ELSE. One rung of the same ladder per tick. */
  function pump(){
    if (dead){ draw(); return; }
    try {
      step++;
      const alive = climb(R);
      say(step + ' ' + R.note);
      if (!alive){
        dead = true;
        if (!R.done) R.done = 'stopped';
        say('== ' + R.done);
      }
    } catch (err) {
      dead = true;
      R.note = 'THREW: ' + err.message;
      R.done = 'threw';
      say('!! ' + err.message);
      say('   ' + ((err.stack || '').split('\n')[1] || ''));
    }
    draw();
  }

  draw();
  timer = setInterval(pump, Math.max(16, pace));
  return;
}

const plan=[];
if (/[?&]dungeon/.test(location.search))    plan.push([0,MODE_DUNGEON,'Dungeon']);
else if (/[?&]quick/.test(location.search)) plan.push([0,MODE_SWEEP,'Apprentice']);
else {
  for (let d=0; d<3; d++) plan.push([d,MODE_SWEEP,DIFFS[d].name]);
  plan.push([0,MODE_DUNGEON,'Dungeon']);
}

let games=0, wins=0, totalMoves=0;
for (const [d,mode,label] of plan){
  const r=playGame(d,mode,label);
  games++; totalMoves+=r.moves; if (r.won) wins++;
  log(`${label}: ${r.won?'FINISHED':'stopped'} after ${r.steps} steps / ${r.moves} actions — ${r.why}`);
  log(`   opened ${r.opened}/${r.of} (${(100*r.opened/r.of).toFixed(0)}%), `+
      `flags ${r.flags}/${r.mines}, ${r.left} blocks still shut, peakFoes ${r.peak}`);
  if (r.autopsy) log('   '+r.autopsy);
}

log(`games=${games} finished=${wins} actions=${totalMoves}`);
log(`cost: ${stats.scans} scans, ${stats.rays} rays, ${stats.ticks} physics ticks, `+
    `${stats.follows} straight runs (${stats.blocked} blocked)`);
log(`on foot: ${stats.walked.toFixed(0)} m, ${stats.jumps} jumps, `+
    `${stats.sidesteps} sidesteps to clear a line, ${stats.surveys} full surveys`);
log(`flag aiming: ${stats.flagAim} corrections, ${stats.flagBlocked} abandoned because a `+
    `number sat on every line to the block`);
log(`actions: ${stats.shots} shots, ${stats.flags} flags (${stats.misflag} misaimed), `+
    `${stats.chests} chests, ${stats.noEffect} with no effect`);
log(`digging blind: ${stats.guesses} chances, ${stats.guessMines} were mines `+
    `(${stats.guesses?(100*stats.guessMines/stats.guesses).toFixed(1):0}%) — it declines those, `+
    `which is a cheat; the number is the honest risk`);
log(`worked THROUGH a number, reaching blocks it could not hit: `+
    `${stats.numFlags} flagged, ${stats.numOpens} opened`);
log(`clue-led digs: ${stats.clueWork} (shots aimed at an unfinished number's own blocks)`);
log(`solver rules: ${Object.keys(stats.byRule).map(k=>k+' '+stats.byRule[k]).join(', ')||'none'}`);
log(`combat: killed ${stats.killed} in ${stats.bursts} engagements, ${stats.shotAt} shots `+
    `(${stats.killed?(stats.shotAt/stats.killed).toFixed(1):'-'} per kill), ${stats.dodged} dodges, `+
    `${stats.nudges} nudges, ${stats.chases} chases, ${stats.climbs} climbs, `+
    `${stats.aimFixes} aim corrections`);
log(errCount ? `FAULTS: ${errCount} (${seen.size} distinct)` : 'FAULTS: none');
for (const e of errs) log('  ! '+e);

document.body.dataset.r = out.join('\n');
}catch(e){
  try{ document.body.dataset.r = 'THROW '+e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' | '); }catch(_){}
}
}, 400));
