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

const trail = [];
let errCount = 0; const seen = new Set();
function err(msg){
  errCount++;
  if (seen.has(msg) || seen.size > 30) return;
  seen.add(msg); errs.push(msg);
}

const DT = 1/30;
const SKIP_ADV  = /[?&]skip=[^&]*adv/.test(location.search);
const SKIP_FOES = /[?&]skip=[^&]*foes/.test(location.search);
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
/* TWO budgets, because the old single one could not tell the two failures
   apart and reported the wrong one. It fired at 400,000 checks saying "without
   finishing, last phase: inView", which reads as "inView is looping forever"
   — and inView was fine. What had actually happened was that the whole RUN
   spent its budget getting nowhere: 483 steps, 76,395 metres walked, 8,125
   jumps, 70 actions. A hang and a wild goose chase are different bugs and the
   message has to say which one it is.

   The per-step budget is the real hang detector: no single decision needs
   sixty thousand checks. The run budget is generous, because a four-zone
   dungeon legitimately costs hundreds of thousands. */
let wdN = 0, wdStep = 0, wdStepAt = 0;
/* ?wd=perStep,run turns a hang into a REPORT. A blocked main thread means
   Chrome never serialises the DOM, so a hang costs a full wall clock cap and
   tells you nothing at all; throwing early costs a second and prints the
   trail that says where it was. */
const wdQ = /[?&]wd=(\d+)(?:,(\d+))?/.exec(location.search);
const WD_STEP = wdQ ? +wdQ[1] : 60000;
const WD_RUN  = (wdQ && wdQ[2]) ? +wdQ[2] : 4000000;
function WD(){
  wdN++;
  if (wdN - wdStepAt > WD_STEP)
    throw new Error('STUCK inside one decision: '+(wdN-wdStepAt)+
                    ' checks in step '+wdStep+', phase '+phase);
  if (wdN > WD_RUN)
    throw new Error('the run spent its budget: '+wdN+' checks over '+wdStep+
                    ' steps and it never finished, phase '+phase);
}
function wdNewStep(n){ wdStep = n; wdStepAt = wdN; }
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
                flagAim:0, flagBlocked:0, aimBlind:0, wallSteps:0, futile:0,
                routes:0, routeWon:0, routeStuck:0, routeNone:0, routeSaved:0,
                bored:0, reroutes:0, kills1:0,
                goals:0, goalDone:0, goalLost:0, goalDrop:0, hunts:0,
                busted:0, bustOpen:0 };

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
  /* Reconcile the broken walls FIRST. Every block of cinderstone that goes
     becomes AIR that was never "revealed" — revealing is what happens to
     puzzle blocks — so the air baseline has to move by the same amount
     BEFORE the line below counts it. Doing it after, which is where it went
     first, means the check fires on numbers that are about to be corrected. */
  if (rock < baseRock){ baseAir += (baseRock - rock); baseRock = rock; }
  if (air-baseAir !== G.revealed) err(`${tag}: revealed=${G.revealed} but ${air-baseAir} opened`);
  if (marked!==G.marked)          err(`${tag}: G.marked=${G.marked} but ${marked} flagged`);
  if (mines!==G.mines)            err(`${tag}: mines=${G.mines} but ${mines} placed`);
  /* Cinderstone walls break now, so structure may go DOWN — and every block
     of it that goes becomes AIR that was never "revealed", because revealing
     is what happens to puzzle blocks. Move the air baseline by the same
     amount or the very next line reports a discrepancy for the rest of the
     run: 44 faults in one dungeon, all of them this. Rock going UP is still
     a fault; that would be walls appearing out of nothing. */
  if (rock>baseRock)              err(`${tag}: structure grew ${baseRock} -> ${rock}`);
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
  /* ?skip=adv or ?skip=foes cuts one of the game's own per-frame calls out of
     the loop. Bisecting a hang that blocks the main thread cannot be done from
     inside it — nothing can report — so it is done by removing one suspect at
     a time and seeing which removal makes it stop. */
  if (G.boss){
    if (!SKIP_ADV)  adv(DT);
    if (!SKIP_FOES) updateEnemies(DT);
  }
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
/* THE WALL IN THE WAY IS A TARGET NOW.

   The bot's whole model of the world predates cinderstone: structure was
   permanent, so a block behind a wall was simply unreachable and the only
   sane move was to go round. That is why a full dungeon ended at 64 of 66
   flags with every one of 356 blocks dug out — two mines with no line to
   them, and no idea that the thing in the way could be removed.

   Only the COAT can be shot through, which is one block in six of the
   structure and settled at generation, so this cannot turn into chewing
   through the map: five shots buys exactly one layer and then the black
   behind it refuses forever.

   Aims at the target, fires at whatever cinderstone is in the way, and
   reports whether it actually spent a shot on one. */
function bustWall(cell){
  PH('bustWall'); WD();
  if (!G.coat) return false;                     // an older board, no coat
  const [cx,cy,cz] = cellXYZ(cell);
  aimAt((cx+0.5)*BLOCK, (cy+0.5)*BLOCK, (cz+0.5)*BLOCK);
  const r = aimRay();
  const h = raycast(r.ox,r.oy,r.oz, r.dx,r.dy,r.dz, REACH, false);
  if (!h.hit || !inside(h.x,h.y,h.z)) return false;
  const w = idx(h.x,h.y,h.z);
  if (G.st[w] !== ROCK || !G.coat[w]) return false;   // rock that never gives
  stats.lastAct = 'bust';
  shoot(); stats.shots++; stats.busted++;
  if (G.st[w] === AIR) stats.bustOpen++;             // that was the fifth
  return true;
}

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
/* FINISH IT. This used to fire a short fixed burst and hand the step back,
       so meeting something was one shot, then a dodge, then a scan, then one
       more shot — and it was getting killed doing it. The old reasoning was
       that a long burst is time spent standing still; the answer is to keep
       dodging DURING the burst rather than to leave the thing alive.

       Nothing here is a fixed budget any more. It fires until the target is
       dead or until four shots in a row change nothing, which is the only
       honest definition of "this is not working". Marcelo's ruling on the
       fairness of it: the enemies are designed for a human, not for this. */
    const budget = e.hell ? EX.killHell : EX.kill;
    let fired=0, hpNow=hp0, stall=0;
    while (fired<budget && enemies.indexOf(e)>=0 && G.state==='play'){
      /* Break off every few shots to get out of the way of whatever else has
         lined up meanwhile, then go straight back to the same target. */
      if (fired && fired % 5 === 0 && beingAimedAt()) dodge();
      if (!aimTrue(e)) break;
      stats.shotAt++; shoot(); fired++;
      if (!tick()) break;
      const hp = e.hp!==undefined ? e.hp : (e.dhp!==undefined ? e.dhp : 1);
      if (hp < hpNow){ hpNow = hp; stall = 0; }
      else if (++stall >= 4) break;
    }
    if (enemies.indexOf(e) < 0) stats.kills1++;
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
const TRACE  = /[?&]trace/.test(location.search);

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
    /* Where it has stood, and how often. Walking the same cell EX.loop times
       is the machine version of pacing a room: the area is worked out and the
       next objective has to be somewhere else. `bored` is the set of approach
       cells that judgement has retired. */
    been: new Map(), bored: new Set(),
    /* The objective it is currently walking at, how close it has managed to
       get, how many steps it has failed to get closer, and the ones it has
       given up on. See pickGoal. */
    goal: null, goalD: 1e9, goalAge: 0, dropped: new Set(),
    /* Steps spent walking at a creature it cannot see. Bounded, so one that
       cannot be reached at all does not stop the run for good. */
    hunt: 0,
    counted: new Set(),        // a cell is counted as a guess once, not once per step
    wander: 0,                 // steps spent walking without finding work
    stuck: 0,                  // consecutive failures to travel
    travelTry: 0,
    surveyed: false, moved: true,
    acted: 0, walked: 0, peak: 0, dry: 0, retried: false,
    note: 'starting', done: null, label: ''
  };
}

/* ==========================================================================
   THE EXPLORER
   ==========================================================================
   Everything above this point moves in straight lines. closeOn() points at a
   cell and holds forward; followLine() walks the LONGEST clear sightline it
   can see. Neither can go round a corner, and that is the whole of the bot's
   navigation.

   The evidence, from a watched four-zone run: it threw at step 483 having
   walked 76,395 metres and jumped 8,125 times to perform 70 actions — 366
   walks against 70 things done. Marcelo took the controls and freed it by
   TURNING SIDEWAYS. The way down was one corner away and invisible to a
   machine that only ever asks "what is the longest thing I can see from
   exactly here".

   So: a map, and a route over it.

     mapNow()   floods outward from the player's feet over cells it could
                really STAND in, using the moves the body really has — walk
                level, step up, fall, or spend one of its twenty jumps. It
                comes back with a true walking distance to every reachable
                cell and the parent chain to get there.
     routeTo()  walks that chain one cell at a time. Consecutive cells are
                adjacent, so every single leg IS a clear straight line, which
                is why this reaches what closeOn cannot.
     workNow()  every block still worth opening, sorted by WALKING distance
                rather than by how far away it looks.

   And it moves like something alive while it does it: a leg is walked with a
   lateral weave and a swept head, so crossing a room sweeps the room instead
   of drawing a line through it. Marcelo asked for that in as many words —
   "not by point always toward the target, but to everything around it all
   times" — and it is not decoration: walking three metres off the centre line
   changes what has line of sight to you, which is the entire input to this
   bot.
   ========================================================================== */

/* Settings, so a run can be tailored to a dungeon instead of recompiled.
   ?ex=climb:3,loop:4,route:0   — route:0 restores the old straight line, which
   is how the router gets to prove it earns its place. */
const EX = {
  climb:  2,     // cells it believes it can get UP in one move (a jump clears 2.14)
  fall:  10,     // cells it will drop without thinking about it
  loop:   3,     // times over one cell before that region is called worked out
  legs:  14,     // most waypoints walked in one routeTo, so a step stays bounded
  weave: 0.55,   // lateral wander while travelling, in blocks
  sweep: 0.85,   // how far the head swings off the direction of travel, radians
  route:  1,     // 0 = straight lines only, the old behaviour
  farFirst: 0,   // 1 = always head for the FARTHEST work (pure exploration)
  patience: 14,  // steps it will keep walking at one objective without closing
  hunt:  16,     // steps it will spend going to find a creature it cannot see
  kill:  30,     // most shots poured into one enemy before breaking off
  killHell: 90   // and into a finale creature, which has real hit points
};
(function(){
  const m = /[?&]ex=([^&]+)/.exec(location.search);
  if (!m) return;
  for (const part of decodeURIComponent(m[1]).split(',')){
    const [k,v] = part.split(':');
    if (k in EX && v !== undefined && isFinite(+v)) EX[k] = +v;
  }
})();

/* ---------------- the map ---------------- */
const MAPN = () => G.nx*G.ny*G.nz;
let mDist = null, mFrom = null, mStamp = -1, mFrom0 = -1, mReached = 0;

/* Can the body stand here? One air cell is enough headroom — a player is 2 m
   and a block is 2.8 — and something solid has to be underfoot. Outside the
   grid counts as bedrock, so the floor of the world is solid by construction. */
function standAt(x,y,z){
  if (!inside(x,y,z)) return false;
  if (isSolidCell(x,y,z)) return false;
  return isSolidCell(x,y-1,z);
}
/* The cell it is standing in right now — or, mid-fall, the one it is about to
   land in. A map rooted in mid-air reaches nothing. */
function footCell(){
  const [x,y,z] = pcell();
  for (let k=0;k<=EX.fall;k++) if (standAt(x,y-k,z)) return idx(x,y-k,z);
  for (let k=1;k<=2;k++)       if (standAt(x,y+k,z)) return idx(x,y+k,z);
  return inside(x,y,z) ? idx(x,y,z) : -1;
}

/* One flood. Costs about thirty thousand operations on the largest board there
   is, which is bounded work that does not grow with how lost the bot is — the
   old router's real sin was scoring the whole reachable set EVERY STEP and
   then throwing it away. This one is kept and reused for EX.remap steps. */
function mapNow(force){
  const N = MAPN();
  const root = footCell();
  if (!force && mDist && mFrom0 === root && mStamp === G.revealed + G.marked)
    return {dist:mDist, from:mFrom, root, reached:mReached};
  if (!mDist || mDist.length !== N){ mDist = new Int32Array(N); mFrom = new Int32Array(N); }
  mDist.fill(-1); mFrom.fill(-1);
  mFrom0 = root; mStamp = G.revealed + G.marked; mReached = 0;
  if (root < 0) return {dist:mDist, from:mFrom, root, reached:0};

  const q = new Int32Array(N);
  let head = 0, tail = 0;
  q[tail++] = root; mDist[root] = 0; mReached = 1;
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  while (head < tail){
    WD();
    const cur = q[head++];
    const [x,y,z] = cellXYZ(cur);
    const d = mDist[cur];
    for (const [dx,dz] of DIRS){
      const nx = x+dx, nz = z+dz;
      if (!inside(nx,y,nz) && !inside(nx,y,nz)) continue;
      /* Which floor does this column offer? Take the one nearest to the level
         it is walking at: stepping up beats climbing, and a small drop beats
         a long one. Anything within EX.climb above is a jump it really has,
         anything within EX.fall below is a drop it really survives. */
      let best = -1, bd = 99;
      for (let ny = y+EX.climb; ny >= y-EX.fall; ny--){
        if (!standAt(nx,ny,nz)) continue;
        const gap = Math.abs(ny-y);
        if (gap < bd){ bd = gap; best = ny; }
      }
      if (best < 0) continue;
      /* Getting up there means the space above its head has to be free too.
         Without this it "climbs" through a ceiling and the route is a lie. */
      if (best > y){
        let blocked = false;
        for (let ny=y+1; ny<=best; ny++)
          if (isSolidCell(x,ny,z)){ blocked = true; break; }
        if (blocked) continue;
      }
      const nb = idx(nx,best,nz);
      if (mDist[nb] >= 0) continue;
      mDist[nb] = d+1; mFrom[nb] = cur; mReached++;
      q[tail++] = nb;
    }
  }
  return {dist:mDist, from:mFrom, root, reached:mReached};
}

/* Where to stand to work on a block: the reachable cell nearest to it. */
function approachTo(cell, M){
  const [tx,ty,tz] = cellXYZ(cell);
  let best = -1, bd = 1e9;
  for (let dy=-2; dy<=2; dy++) for (let dz=-3; dz<=3; dz++) for (let dx=-3; dx<=3; dx++){
    const x=tx+dx, y=ty+dy, z=tz+dz;
    if (!inside(x,y,z)) continue;
    const i = idx(x,y,z);
    if (M.dist[i] < 0) continue;
    /* Cheap tie-break: near the block, but reached without a detour. */
    const score = (dx*dx+dy*dy+dz*dz) + M.dist[i]*0.35;
    if (score < bd){ bd = score; best = i; }
  }
  return best;
}

/* The chain of cells from where it stands to where it wants to be. */
function pathTo(goal, M){
  if (goal < 0 || M.dist[goal] < 0) return null;
  const out = [];
  let c = goal;
  while (c >= 0 && c !== M.root){ out.push(c); c = M.from[c]; if (out.length > 4000) return null; }
  out.reverse();
  return out;
}

/* ---------------- walking it ----------------
   One leg is one cell. The straight line between two adjacent standable cells
   is always walkable, which is exactly the property closeOn never had. */
let weavePhase = 0;
function walkLeg(cell, urgency){
  const [cx,cy,cz] = cellXYZ(cell);
  const tx=(cx+0.5)*BLOCK, ty=cy*BLOCK, tz=(cz+0.5)*BLOCK;
  /* A leg is ONE CELL — 2.8 m at 7.5 m/s is under four tenths of a second.
     The budget is what it costs when the walk goes wrong, and every tenth of
     it is thirty ticks of physics, so it is deliberately mean. */
  const up = ty > P.y + BLOCK*0.55;
  const budget = up ? 1.0 : 0.6;
  let stuck = 0, best = 1e9;
  for (let k=0;k<budget/DT;k++){
    let dx = tx-P.x, dz = tz-P.z;
    const flat = Math.hypot(dx,dz);
    if (flat < BLOCK*0.42 && Math.abs(P.y-ty) < BLOCK*1.2){ IN.f=0; IN.jumpHeld=false; return true; }
    if (flat < best-0.04){ best = flat; stuck = 0; }
    else if (++stuck > 0.5/DT){ IN.f=0; IN.jumpHeld=false; return false; }
    /* THE WEAVE. Push the aim point sideways on a slow sine, so a long leg is
       walked as an arc across the corridor rather than down its middle. It
       sees round more and it reads as something alive rather than something on
       rails. Urgency shrinks it: closing on a target goes straight. */
    weavePhase += DT*2.4;
    const amp = EX.weave*BLOCK*(1-urgency);
    if (amp > 0.01 && flat > BLOCK*1.2){
      const s = Math.sin(weavePhase)*amp/flat;
      const px = -dz*s, pz = dx*s;               // perpendicular, on the flat
      dx += px; dz += pz;
    }
    /* THE HEAD. It looks around while it travels instead of staring at where
       it is going. Sightlines are the bot's only sense, so this is not a
       flourish — it is what notices the passage it walks past. */
    const face = Math.atan2(-dx,-dz);
    P.yaw = face + Math.sin(weavePhase*0.63)*EX.sweep*(1-urgency);
    P.pitch = Math.sin(weavePhase*0.41)*0.22*(1-urgency);
    IN.f = 1;
    if (up && (P.ground || (P.vy < 1.0 && P.jumps < MAX_JUMPS))) jumpNow();
    else IN.jumpHeld = false;
    if (!tick()){ IN.f=0; IN.jumpHeld=false; return false; }
    stats.walked += SPD_RUN*DT;
  }
  IN.f=0; IN.jumpHeld=false;
  return Math.hypot(tx-P.x, tz-P.z) < BLOCK*0.9;
}

/* Go to a cell by ROUTE. Returns how far it actually moved, so a caller can
   tell "walked" from "pressed into a wall for two seconds" — the distinction
   three separate bugs in this file turned on. */
function routeTo(cell, stopWhen){
  PH('routeTo'); WD();
  const x0=P.x, y0=P.y, z0=P.z;
  const M = mapNow();
  const goal = approachTo(cell, M);
  const path = pathTo(goal, M);
  if (!path){ stats.routeNone++; return 0; }
  stats.routes++;
  const legs = Math.min(path.length, EX.legs);
  for (let k=0;k<legs;k++){
    /* Urgency ramps as it arrives: it wanders across the room and then walks
       the last few metres straight at the thing. */
    const urgency = Math.min(1, (k+1)/Math.max(1,legs-2));
    if (!walkLeg(path[k], urgency)) { stats.routeStuck++; break; }
    if (G.state !== 'play') break;
    if (stopWhen && stopWhen()) break;
  }
  IN.f=0; IN.jumpHeld=false;
  P.pitch = 0;
  const moved = Math.hypot(P.x-x0, P.y-y0, P.z-z0);
  if (moved > BLOCK*0.5) stats.routeWon++;
  return moved;
}

/* The one call the ladder makes: get near this cell, however you have to.
   Straight line first because it is free when it works, then the route. The
   A/B that decided this lives in the counters — routeSaved is how many targets
   the straight line failed and the map reached. */
function goTo(cell){
  const before = clearLine(cell);
  if (before) return true;
  const px=P.x, py=P.y, pz=P.z;
  if (closeOn(cell) && clearLine(cell)) return true;
  if (!EX.route) return false;
  const moved = routeTo(cell, ()=>inView(cell));
  if (moved > BLOCK*0.5 && clearLine(cell)){ stats.routeSaved++; return true; }
  return Math.hypot(P.x-px,P.y-py,P.z-pz) > BLOCK*0.5 ? false : false;
}

/* ---------------- what is worth doing, in walking order ----------------
   Every block still shut that touches somewhere it can stand. Sorted by how
   far it must WALK, not by how far away it looks — which is the whole
   difference between "that wall is four metres off" and "that wall is four
   metres off and forty metres round". */
function workNow(M, skip){
  const N = MAPN(), out = [];
  for (let i=0;i<N;i++){
    if (G.st[i] !== SOLID || G.mine[i]) continue;
    let touch = -1;
    for (const j of nbrsOf(i)) if (M.dist[j] >= 0 && (touch < 0 || M.dist[j] < M.dist[touch])) touch = j;
    if (touch < 0) continue;
    if (skip && skip.has(touch)) continue;
    out.push({cell:i, d:M.dist[touch], via:touch});
  }
  out.sort((a,b)=> EX.farFirst ? b.d-a.d : a.d-b.d);
  return out;
}

/* ==========================================================================
   THE OBJECTIVE
   ==========================================================================
   Everything above this decides what is worth doing. This decides what it is
   DOING, and the difference is the whole complaint: the bot used to re-pick
   the nearest job every single step, so a job that stopped being nearest
   half way there was abandoned half way there. Two jobs on opposite sides of
   a room take turns being nearest, and a machine that always walks at the
   nearest one walks back and forth between them forever. That is the pacing
   Marcelo watched, and no amount of better routing fixes it, because the
   route was never the thing that was wrong.

   So an objective is CHOSEN ONCE and then kept. It is dropped for exactly
   three reasons, and "something else is closer now" is not one of them:

     * it is finished  — somebody dug or flagged it, so there is nothing there
     * it is cut off   — no cell next to it is on the map any more
     * it is hopeless  — EX.patience steps in a row without getting nearer

   Hopeless ones go on a list so the next choice is somewhere else, and that
   list is cleared when it runs out of anywhere to go — the bot is allowed to
   change its mind, just not every step.
   ========================================================================== */
function goalReach(cell, M){
  let best = -1;
  for (const j of nbrsOf(cell))
    if (M.dist[j] >= 0 && (best < 0 || M.dist[j] < best)) best = M.dist[j];
  return best;                       // -1 when nothing beside it is reachable
}
function pickGoal(R, M){
  const g = R.goal;
  if (g !== null && g >= 0){
    if (G.st[g] !== SOLID || G.mine[g]) { stats.goalDone++; R.goal = null; }
    else {
      const d = goalReach(g, M);
      if (d < 0){ stats.goalLost++; R.goal = null; }
      else if (d < R.goalD){ R.goalD = d; R.goalAge = 0; return g; }  // closing
      else if (++R.goalAge <= EX.patience) return g;                  // stalled, keep at it
      else { stats.goalDrop++; R.dropped.add(g); R.goal = null; }
    }
  }
  let list = workNow(M, R.bored).filter(w => !R.dropped.has(w.cell));
  if (!list.length){
    /* Out of anywhere to go: forget both grudges and look again with clear
       eyes. Refusing to reconsider is how a bot decides a solvable board is
       finished and stands still next to the rest of it. */
    if (R.bored.size || R.dropped.size){
      R.bored.clear(); R.been.clear(); R.dropped.clear(); stats.reroutes++;
      list = workNow(M, null);
    }
  }
  if (!list.length){ R.goal = null; return null; }
  R.goal = list[0].cell; R.goalD = list[0].d; R.goalAge = 0;
  stats.goals++;
  return R.goal;
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

  /* --- 0. AM I GOING IN CIRCLES? Standing on the same cell for the EX.loop-th
     time means this pocket has been walked out. Retire it as an approach so
     the next objective is chosen somewhere else, and say so — "walking a
     sightline (224)" told nobody anything. --- */
  {
    const here = footCell();
    if (here >= 0){
      const n = (R.been.get(here)||0) + 1;
      R.been.set(here, n);
      if (n === EX.loop && !R.bored.has(here)){
        R.bored.add(here); stats.bored++;
        /* Boredom has to expire or it eventually retires the whole level. */
        if (R.bored.size > 90){ R.bored.clear(); R.been.clear(); stats.reroutes++; }
      }
    }
  }

  /* --- 1. STAY ALIVE. Everything else assumes there is a player left. --- */
  if (!enemies.length) R.hunt = 0;
  if (G.boss && enemies.length){
    R.peak = Math.max(R.peak, enemies.length);
    if (dodge()) R.note = 'dodging';
    if (G.state !== 'play'){ R.done = diedHow(); return false; }
    const foes0 = enemies.length, kills0 = stats.killed;
    if (fightBack()){
      /* "shot at something" is not a fight. It said that while jumping at a
         wall. Only a kill or a real change in the field counts as an action. */
      if (stats.killed > kills0){ R.hunt = 0; return A('killed one, '+enemies.length+' left', 'kill'); }
      R.note = 'fighting ('+foes0+' up)';
      return true;
    }
    /* NOTHING ELSE HAPPENS WHILE SOMETHING IS ALIVE.

       fightBack only engages what it can SEE. Everything else it did — the
       chase, the walk at the nearest one — used a straight line, so a creature
       round a corner or one floor down produced a shrug: it returned false,
       the ladder fell through, and the bot went back to doing sums while
       being shot at. That is how it died at 41% of a full dungeon, six runs
       out of six, at exactly the same step.

       So: route to the nearest one, with the same BFS the puzzle work uses,
       and stop as soon as it comes into view — fightBack takes it from there
       next step. Bounded by EX.hunt, because a creature that genuinely cannot
       be reached must not hold the whole run hostage. */
    if (R.hunt < EX.hunt){
      let near = null;
      for (const e of enemies){
        const d = Math.hypot(e.x-P.x, e.y-P.y, e.z-P.z);
        if (!near || d < near.d) near = {e, d};
      }
      const ex = Math.floor(near.e.x/BLOCK),
            ey = Math.floor(near.e.y/BLOCK),
            ez = Math.floor(near.e.z/BLOCK);
      if (inside(ex,ey,ez)){
        R.hunt++;
        const cell = idx(ex,ey,ez);
        stats.hunts++;
        if (EX.route && routeTo(cell, ()=>seeEnemy(near.e)) > BLOCK*0.5)
          return W('hunting one down, '+near.d.toFixed(0)+' m off ('+foes0+' up)');
        if (closeOn(cell))
          return W('closing on one, '+near.d.toFixed(0)+' m off ('+foes0+' up)');
      }
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
  /* TWO PASSES, and they are not interchangeable. The first only SHOOTS —
     trying a target that is already in the open costs a few rays, so try them
     all. The second WALKS, and it walks at exactly ONE thing.

     The old loop did both in one pass, so every target it could not shoot cost
     a journey: up to eighty journeys inside a single step, each one seconds of
     walking into whatever was in the way. That is where "76,395 metres for 70
     actions" came from, and it is the wall-to-wall pacing seen on the watch
     page. Bolting a better route onto a loop that takes eighty of them makes
     it eighty times worse, not better. */
  let reach = null;
  for (const w of s.work.concat(s.seenFar)){
    if (G.st[w.cell] !== SOLID || giveUp(w.cell)) continue;
    if (!R.counted.has(w.cell)){
      R.counted.add(w.cell); stats.guesses++;
      if (G.mine[w.cell]) stats.guessMines++;
    }
    if (G.mine[w.cell]) continue;
    /* inView, not clearLine: clearLine SIDESTEPS to try to clear the shot, and
       eighty sidesteps a step is its own version of the same bug. */
    if (w.d <= GUN && inView(w.cell)){
      const before = G.revealed;
      stats.lastAct = 'dig';
      shoot(); stats.shots++;
      if (G.revealed > before){
        R.refused.delete(w.cell);
        return A('dug visible work '+w.d.toFixed(0)+' m off', 'dig');
      }
      refuse(w.cell); continue;
    }
    if (!reach) reach = w;                     // the nearest one worth walking to
  }
  if (reach){
    /* One look, one straight line, one route. Then the step ends whatever
       happened, and the next scan decides again from wherever it ended up. */
    if (clearLine(reach.cell)){
      const before = G.revealed;
      stats.lastAct = 'dig';
      shoot(); stats.shots++;
      if (G.revealed > before){
        R.refused.delete(reach.cell);
        return A('dug visible work '+reach.d.toFixed(0)+' m off', 'dig');
      }
    }
    const px = P.x, py = P.y, pz = P.z;
    closeOn(reach.cell);
    if (Math.hypot(P.x-px, P.y-py, P.z-pz) > BLOCK*0.5)
      return W('going to visible work '+reach.d.toFixed(0)+' m off');
    if (EX.route && routeTo(reach.cell, ()=>inView(reach.cell)) > BLOCK*0.5)
      return W('routing to visible work '+reach.d.toFixed(0)+' m off');
    refuse(reach.cell);
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
      } else if (bustWall(best))
        return A('shot the cinderstone in the way of the last blocks', 'bust');
      else refuse(best);
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
    if (R.travelTry++ % 10 === 9) R.refused.clear();
    const M = mapNow();
    /* Sorted by how far it must WALK. The old sort was straight-line distance,
       which is why it kept choosing a wall four metres away and forty round,
       and why the route Marcelo could see — shorter on foot, longer as the
       crow flies — was invisible to it. */
    const tgt = pickGoal(R, M);
    if (tgt !== null && tgt >= 0){
      const td = R.goalD;
      const px = P.x, py = P.y, pz = P.z;
      if (clearLine(tgt)){
        const before = G.revealed;
        stats.lastAct = 'travel-dig';
        shoot(); stats.shots++;
        if (G.revealed > before) return A('dug toward the work, '+td+' cells off', 'travel');
        refuse(tgt);
      }
      /* The note says which objective and how long it has been at it, because
         "walking a sightline" told nobody watching anything at all. */
      const why = ' (objective '+tgt+', '+td+' cells, held '+R.goalAge+' steps)';
      if (EX.route && routeTo(tgt, ()=>inView(tgt)) > BLOCK*0.5)
        return W('routing to its objective'+why);
      /* Walked as far as walking goes. If what is between us is a coat wall,
         it is not an obstacle any more, it is five shots. */
      if (bustWall(tgt)) return A('shot the cinderstone in the way'+why, 'bust');
      closeOn(tgt);
      if (Math.hypot(P.x-px, P.y-py, P.z-pz) > BLOCK*0.5)
        return W('closing on its objective'+why);
      /* Neither the route nor the straight line moved it. Only real
         displacement counts — closeOn can report success while pressing into a
         wall. Anything else means entangled: hug the wall, which traces the
         pocket until it finds the way out. */
      refuse(tgt);
      if (R.stuck++ < 14 && wallFollow()) return W('following the wall out ('+R.stuck+')');
    } else if (M.reached <= 1){
      R.note = 'the map reaches nowhere from here';
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
  /* What the HUD says, because that is what a player reads when they are
     lost, and "nothing it could reach" on its own never said whether the
     board was nearly done or barely started. */
  R.note = 'nothing reachable — ' + Math.max(0,G.mines-G.marked) + ' mines to flag, ' +
           Math.max(0,G.safeTotal-G.revealed) + ' blocks to open, ' +
           mapNow().reached + ' cells it can stand in';
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
  trail.length = 0;
  let step = 0;
  const qs = /[?&]steps=(\d+)/.exec(location.search);
  const cap = qs ? +qs[1] : Math.min(1200, G.safeTotal*3 + 300);

  for (; step<cap; step++){
    try{ document.body.dataset.r = label+' step '+step; }catch(e){}
    /* ?trace prints every step to the CONSOLE, which headless Chrome streams
       to stderr as it happens. dataset.r only reaches anybody if the page
       survives to be dumped, so it is worth nothing for the one failure that
       matters: a run that does not come back. This is how you watch one. */
    if (TRACE) console.log('BOT '+label+' step '+step+
                           ' opened='+G.revealed+'/'+G.safeTotal+
                           ' flags='+G.marked+'/'+G.mines+
                           ' phase='+phase+' | '+R.note);
    wdNewStep(step);
    /* An uncaught throw here does not fail the run, it DELETES it: the page
       dies mid-load, nothing writes data-r, and the harness reports a wall
       clock timeout — which reads as "endless loop" and sent me hunting one
       that was not there. The watchdog firing is a RESULT. Print it. */
    try{
      if (!climb(R)) break;
      const [fx,fy,fz] = pcell();
      trail.push(step+' @'+fx+','+fy+','+fz+'  '+R.note);
      if (trail.length > 400) trail.shift();
    }catch(err){
      R.done = 'threw: ' + err.message;
      break;
    }
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
      wdNewStep(step);
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

/* DIFFERENT BOARDS. The world seed starts at 1 and only ever advances through
   rnd(), so headless the bot played the SAME dungeon every single time — six
   identical runs reported as six results, which is one result wearing a
   disguise. ?runs=N replays the plan N times from a different seed each time,
   and ?seed=N picks where that starts. A completion RATE needs this; without
   it every number this bot produces is a sample of one. */
const RUNS  = (function(){ const m=/[?&]runs=(\d+)/.exec(location.search);
                           return m ? Math.max(1, +m[1]) : 1; })();
const SEED0 = (function(){ const m=/[?&]seed=(\d+)/.exec(location.search);
                           return m ? +m[1] : 1; })();
let games=0, wins=0, totalMoves=0;
const tally = {};
for (let rep=0; rep<RUNS; rep++)
for (const [d,mode,label0] of plan){
  /* 7919 is just a prime stride: consecutive seeds give boards that are far
     more alike than the generator's own spread suggests. */
  seed = (SEED0 + rep*7919) >>> 0;
  const label = RUNS>1 ? label0+' seed '+seed : label0;
  const r=playGame(d,mode,label);
  games++; totalMoves+=r.moves; if (r.won) wins++;
  tally[r.why] = (tally[r.why]||0) + 1;
  log(`${label}: ${r.won?'FINISHED':'stopped'} after ${r.steps} steps / ${r.moves} actions — ${r.why}`);
  log(`   opened ${r.opened}/${r.of} (${(100*r.opened/r.of).toFixed(0)}%), `+
      `flags ${r.flags}/${r.mines}, ${r.left} blocks still shut, peakFoes ${r.peak}`);
  if (r.autopsy) log('   '+r.autopsy);
}

log(`games=${games} finished=${wins} actions=${totalMoves}`);
if (RUNS > 1)
  log('outcomes: ' + Object.keys(tally).map(k => tally[k]+' x '+k).join(' | '));
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
log(`hunting: ${stats.hunts} steps spent going to find something it could not see`);
log(`cinderstone: ${stats.busted} shots into walls in the way, ${stats.bustOpen} of them broke through`);
log(`combat: killed ${stats.killed} in ${stats.bursts} engagements, ${stats.shotAt} shots `+
    `(${stats.killed?(stats.shotAt/stats.killed).toFixed(1):'-'} per kill), ${stats.dodged} dodges, `+
    `${stats.nudges} nudges, ${stats.chases} chases, ${stats.climbs} climbs, `+
    `${stats.aimFixes} aim corrections`);
log(`routing: ${stats.routes} routes walked, ${stats.routeWon} got somewhere, `+
    `${stats.routeSaved} reached a target the straight line could not, `+
    `${stats.routeStuck} snagged mid-path, ${stats.routeNone} had no path at all`);
log(`exploring: ${stats.bored} pockets called worked out, ${stats.reroutes} full resets`);
log(`objectives: ${stats.goals} chosen, ${stats.goalDone} seen through to the end, `+
    `${stats.goalLost} cut off, ${stats.goalDrop} given up on after ${EX.patience} steps`);
if (/[?&]trail/.test(location.search)){
  log('--- the last 40 steps: cell it stood in, and what it decided ---');
  for (const t of trail.slice(-40)) log('  '+t);
}
log(errCount ? `FAULTS: ${errCount} (${seen.size} distinct)` : 'FAULTS: none');
for (const e of errs) log('  ! '+e);

document.body.dataset.r = out.join('\n');
}catch(e){
  try{ document.body.dataset.r = 'THROW '+e.message+' | '+(e.stack||'').split('\n').slice(1,3).join(' | '); }catch(_){}
}
}, 400));
