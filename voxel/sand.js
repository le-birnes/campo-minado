/* ============================================================================
   FALLING EVERYTHING — a material simulation on a fixed 3D grid
   ============================================================================
   Our own engine, built on the ideas Noita's is built on, with one difference
   that changes everything: theirs is two-dimensional and ours cannot be.

   In 2D a thousand-by-thousand world is a million cells and you can afford to
   ask every one of them what it wants to do. The same physical space in 3D at
   the same resolution is a BILLION, so the third dimension takes the central
   trick of the genre — simulate every pixel — and makes it arithmetically
   impossible. Everything below is a consequence of that.

   The three ideas that make it possible anyway:

     1. SPARSE. Voxels exist only where something has happened. An intact block
        of the cave is one cube, drawn the way it is drawn today. It is
        voxelised at the moment it is shot, and not before.

     2. DIRTY RECTS. A chunk that did not change last tick is not looked at
        this tick. Sand at rest costs nothing, which is what makes a cave full
        of settled sand affordable — and settled is what sand is, almost all
        of the time. This is the single biggest win in the whole file and it is
        why the benchmark measures with it and without it.

     3. ACTIVE SET. What is simulated is what is moving, not what exists.

   Materials are a byte per voxel and their behaviour comes from a table, so
   adding water that puts out fire is a row, not a code path.
   ========================================================================== */

/* ---------------- materials ---------------- */
const AIR=0, ROCK=1, SAND=2, WATER=3, OIL=4, FIRE=5, SMOKE=6, LAVA=7,
             STEAM=8, WOOD=9, ACID=10, EMBER=11;

/* How a material moves. This is the whole of its physics. */
const STATIC=0, POWDER=1, LIQUID=2, GAS=3;

/* density decides who sinks through whom: sand sinks in water, oil floats on
   it, and none of that needs a special case — it is one comparison. */
const MAT = [
/* id                 kind    density  spread  life  flammable  colour        */
  {n:'air',   k:STATIC, d:0,   s:0,  life:0,   burn:0,   c:[0,0,0]},
  {n:'rock',  k:STATIC, d:255, s:0,  life:0,   burn:0,   c:[0.30,0.27,0.26]},
  {n:'sand',  k:POWDER, d:60,  s:0,  life:0,   burn:0,   c:[0.76,0.65,0.42]},
  {n:'water', k:LIQUID, d:50,  s:5,  life:0,   burn:0,   c:[0.20,0.42,0.75]},
  {n:'oil',   k:LIQUID, d:40,  s:4,  life:0,   burn:1,   c:[0.22,0.18,0.12]},
  {n:'fire',  k:GAS,    d:5,   s:1,  life:40,  burn:0,   c:[1.00,0.55,0.12]},
  {n:'smoke', k:GAS,    d:3,   s:2,  life:120, burn:0,   c:[0.24,0.24,0.26]},
  {n:'lava',  k:LIQUID, d:70,  s:2,  life:0,   burn:0,   c:[0.95,0.35,0.06]},
  {n:'steam', k:GAS,    d:2,   s:3,  life:200, burn:0,   c:[0.65,0.70,0.78]},
  {n:'wood',  k:STATIC, d:255, s:0,  life:0,   burn:1,   c:[0.36,0.24,0.13]},
  {n:'acid',  k:LIQUID, d:48,  s:4,  life:0,   burn:0,   c:[0.55,0.85,0.15]},
  {n:'ember', k:POWDER, d:58,  s:0,  life:90,  burn:0,   c:[0.85,0.25,0.05]}
];

/* Reactions: what happens when a touches b. Order-independent — looked up both
   ways — so "water puts out fire" is one row, not two. */
const RX = new Map();
const rx = (a,b,ra,rb) => { RX.set(a*256+b, [ra,rb]); RX.set(b*256+a, [rb,ra]); };
rx(FIRE,  WATER, STEAM, STEAM);
rx(LAVA,  WATER, ROCK,  STEAM);
rx(FIRE,  OIL,   FIRE,  FIRE);
rx(FIRE,  WOOD,  FIRE,  EMBER);
rx(LAVA,  OIL,   LAVA,  FIRE);
rx(LAVA,  WOOD,  LAVA,  FIRE);
rx(ACID,  ROCK,  AIR,   AIR);
rx(ACID,  WOOD,  ACID,  AIR);

/* ---------------- the grid ----------------
   CS is a chunk edge. 32 is chosen and not tuned: 32768 bytes of material is
   one page-friendly allocation, the dirty bounds fit in bytes, and it is small
   enough that one settled chunk skipping its tick is a meaningful saving. */
const CS = 32, CS2 = CS*CS, CS3 = CS*CS*CS;

class Chunk {
  constructor(cx,cy,cz){
    this.cx=cx; this.cy=cy; this.cz=cz;
    this.m = new Uint8Array(CS3);          // material id
    this.t = new Uint8Array(CS3);          // ticks lived, for anything with a life
    /* The rect that MIGHT do something next tick, and the one being worked now.
       Kept as bounds rather than a set because the scan is a loop and bounds
       are what a loop wants. Empty means the chunk sleeps. */
    this.x0=CS; this.y0=CS; this.z0=CS; this.x1=-1; this.y1=-1; this.z1=-1;
    this.wake = false;
    this.dirtyMesh = true;                 // geometry needs rebuilding
  }
  get(i){ return this.m[i]; }
  /* Touch a voxel: it and its neighbourhood are live next tick. A cell that
     moves must wake where it LEFT as well as where it arrived, or a column of
     sand falls one voxel and goes back to sleep with a hole under it. */
  touch(x,y,z){
    if (x-1 < this.x0) this.x0 = Math.max(0, x-1);
    if (y-1 < this.y0) this.y0 = Math.max(0, y-1);
    if (z-1 < this.z0) this.z0 = Math.max(0, z-1);
    if (x+1 > this.x1) this.x1 = Math.min(CS-1, x+1);
    if (y+1 > this.y1) this.y1 = Math.min(CS-1, y+1);
    if (z+1 > this.z1) this.z1 = Math.min(CS-1, z+1);
    this.wake = true;
    this.dirtyMesh = true;
  }
  clearDirty(){ this.x0=CS; this.y0=CS; this.z0=CS; this.x1=-1; this.y1=-1; this.z1=-1; this.wake=false; }
}

class World {
  /* BOUNDS, and the measurement that put them here. Without them the first
     benchmark reported that NOTHING EVER SETTLES - sand and water both still
     awake after four thousand ticks - and the reason was not the physics. A
     grain at x=0 asks what is at x=-1, an absent chunk answers AIR, and the
     whole pile pours off the edge of the world into unbounded space, minting
     chunks as it falls. It never lands, so it never sleeps, so the dirty rect
     never pays.

     Outside the bounds is ROCK. A cave has walls; a simulation of one needs
     them to be somewhere rather than nowhere. */
  constructor(bounds){
    this.b = bounds || null;
    this.ch = new Map();                   // "x,y,z" -> Chunk
    this.tick = 0;
    this.stats = {moves:0, scanned:0, awake:0, chunks:0, rx:0};
  }
  key(cx,cy,cz){ return cx+','+cy+','+cz; }
  chunk(cx,cy,cz,make){
    const k = this.key(cx,cy,cz);
    let c = this.ch.get(k);
    if (!c && make){ c = new Chunk(cx,cy,cz); this.ch.set(k,c); }
    return c;
  }
  /* World-space voxel access. Everything above the chunk layer speaks these
     coordinates and never has to know where a chunk boundary is. */
  outside(x,y,z){
    const b = this.b;
    return !!b && (x<b.x0 || y<b.y0 || z<b.z0 || x>b.x1 || y>b.y1 || z>b.z1);
  }
  at(x,y,z){
    if (this.outside(x,y,z)) return ROCK;      // the edge of the world holds
    const c = this.ch.get(this.key(x>>5, y>>5, z>>5));
    return c ? c.m[((y&31)*CS + (z&31))*CS + (x&31)] : AIR;
  }
  set(x,y,z,m){
    if (this.outside(x,y,z)) return;           // nothing is written outside the world
    const c = this.chunk(x>>5, y>>5, z>>5, true);
    const i = ((y&31)*CS + (z&31))*CS + (x&31);
    if (c.m[i] === m) return;
    c.m[i] = m; c.t[i] = 0;
    c.touch(x&31, y&31, z&31);
    /* A change on a face wakes the chunk next door, or material stops dead at
       chunk seams — the classic falling-sand bug, and it looks like a shelf. */
    const lx=x&31, ly=y&31, lz=z&31;
    if (lx===0)    this.edge(x-1,y,z); if (lx===CS-1) this.edge(x+1,y,z);
    if (ly===0)    this.edge(x,y-1,z); if (ly===CS-1) this.edge(x,y+1,z);
    if (lz===0)    this.edge(x,y,z-1); if (lz===CS-1) this.edge(x,y,z+1);
  }
  edge(x,y,z){
    const c = this.ch.get(this.key(x>>5, y>>5, z>>5));
    if (c) c.touch(x&31, y&31, z&31);
  }
  swap(x0,y0,z0, x1,y1,z1){
    const a = this.at(x0,y0,z0), b = this.at(x1,y1,z1);
    this.set(x0,y0,z0,b); this.set(x1,y1,z1,a);
    this.stats.moves++;
  }
}

/* ---------------- the rules ----------------
   Each is "where would I rather be", asked in order, first answer wins. The
   randomised tie-break between symmetric choices is not decoration: without it
   powders form perfectly straight-sided pyramids and liquids all drift the
   same way, and both read instantly as fake. */
const DIAG4 = [[1,0],[-1,0],[0,1],[0,-1]];

function denser(a,b){ return MAT[a].d > MAT[b].d; }

/* Can I displace what is there? Air always; a lighter fluid yes, which is how
   sand sinks through water and oil climbs through it with no special case. */
function canGo(w, m, x,y,z){
  const t = w.at(x,y,z);
  if (t === AIR) return true;
  const k = MAT[t].k;
  if (k === STATIC || k === POWDER) return false;
  return denser(m, t);
}

function react(w, x,y,z, m){
  for (const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const o = w.at(x+dx,y+dy,z+dz);
    const r = RX.get(m*256+o);
    if (r){
      w.set(x,y,z,r[0]); w.set(x+dx,y+dy,z+dz,r[1]);
      w.stats.rx++;
      return true;
    }
  }
  return false;
}

function stepCell(w, x,y,z, m, rnd){
  if (react(w,x,y,z,m)) return true;
  const K = MAT[m].k;
  if (K === STATIC) return false;
  const dir = (K === GAS) ? 1 : -1;              // gases rise, the rest fall

  /* 1. straight along gravity */
  if (canGo(w,m,x,y+dir,z)){ w.swap(x,y,z, x,y+dir,z); return true; }

  /* 2. diagonally, choosing between the four at random so piles are not
        pyramids and flows are not all left-handed */
  const o = (rnd()*4)|0;
  for (let k=0;k<4;k++){
    const [dx,dz] = DIAG4[(o+k)&3];
    if (canGo(w,m,x+dx,y+dir,z+dz)){ w.swap(x,y,z, x+dx,y+dir,z+dz); return true; }
  }

  /* 3. and if it is a fluid, sideways — up to its spread, which is the
        difference between water (finds its level fast) and lava (crawls) */
  if (K === LIQUID || K === GAS){
    const s = MAT[m].s;
    const [dx,dz] = DIAG4[(o+1)&3];
    for (let n=1;n<=s;n++){
      if (!canGo(w,m,x+dx*n,y,z+dz*n)) break;
      if (canGo(w,m,x+dx*n,y+dir,z+dz*n)){ w.swap(x,y,z, x+dx*n,y+dir,z+dz*n); return true; }
      if (n === s){ w.swap(x,y,z, x+dx*n,y,z+dz*n); return true; }
    }
  }
  return false;
}

/* ---------------- the tick ----------------
   Only awake chunks, and inside them only the dirty rect. The scan runs bottom
   to top for falling things so a grain does not fall twice in one tick, and
   the x direction alternates, because a fixed order makes every flow drift the
   same way and the eye picks that up immediately. */
function step(w, opts){
  const noDirty = opts && opts.noDirty;
  let seed = (w.tick*2654435761) >>> 0;
  const rnd = () => ((seed = (seed*1664525 + 1013904223) >>> 0) / 4294967296);
  const flip = (w.tick & 1) === 1;
  w.stats.scanned = 0; w.stats.awake = 0; w.stats.chunks = w.ch.size;

  const live = [];
  for (const c of w.ch.values()) if (noDirty || c.wake) live.push(c);
  w.stats.awake = live.length;

  /* Freeze this tick's rect and open a fresh one, so what happens now schedules
     the NEXT tick rather than extending this one for ever. */
  const rect = live.map(c => noDirty
    ? [c,0,0,0,CS-1,CS-1,CS-1]
    : [c,c.x0,c.y0,c.z0,c.x1,c.y1,c.z1]);
  for (const c of live) c.clearDirty();

  for (const [c,x0,y0,z0,x1,y1,z1] of rect){
    const bx = c.cx*CS, by = c.cy*CS, bz = c.cz*CS;
    for (let y=y0; y<=y1; y++){
      for (let z=z0; z<=z1; z++){
        for (let n=0; n<=x1-x0; n++){
          const x = flip ? x1-n : x0+n;
          const i = (y*CS + z)*CS + x;
          const m = c.m[i];
          w.stats.scanned++;
          if (m === AIR) continue;
          const L = MAT[m].life;
          if (L){
            /* Anything with a life ages while it is awake and becomes its
               successor at the end of it: fire to smoke, smoke to nothing. */
            if (++c.t[i] >= L){
              w.set(bx+x, by+y, bz+z,
                    m===FIRE ? SMOKE : m===EMBER ? SMOKE : AIR);
              continue;
            }
            c.touch(x,y,z);                 // burning is never settled
          }
          stepCell(w, bx+x, by+y, bz+z, m, rnd);
        }
      }
    }
  }
  w.tick++;
}

/* ---------------- greedy meshing ----------------
   The reason a voxel game is not just an instanced cube per voxel: at any
   useful resolution there are millions of them and the draw call is the whole
   frame. A face is emitted only where a solid voxel meets a non-solid one, and
   coplanar faces of the same material are merged into the largest rectangle
   that fits — a flat wall of ten thousand voxels becomes one quad.

   Returns the quad count, which is the number that decides whether any of this
   is affordable. */
function greedyMesh(c){
  const m = c.m;
  const solid = i => m[i] !== AIR && MAT[m[i]].k !== GAS;
  const at = (x,y,z) => (y*CS + z)*CS + x;
  let quads = 0;
  const mask = new Int16Array(CS*CS);

  for (let d=0; d<3; d++){
    const u = (d+1)%3, v = (d+2)%3;
    const q = [0,0,0]; q[d] = 1;
    const p = [0,0,0];
    for (p[d] = -1; p[d] < CS; p[d]++){
      mask.fill(0);
      for (p[v]=0; p[v]<CS; p[v]++) for (p[u]=0; p[u]<CS; p[u]++){
        const a = p[d] >= 0     ? at(p[0],p[1],p[2]) : -1;
        const b = p[d] < CS-1   ? at(p[0]+q[0], p[1]+q[1], p[2]+q[2]) : -1;
        const sa = a >= 0 && solid(a), sb = b >= 0 && solid(b);
        /* A face exists only on the boundary between solid and not. Two solids
           touching draw nothing, which is where nearly all the saving is. */
        mask[p[v]*CS + p[u]] = sa === sb ? 0 : (sa ? m[a] : -m[b]);
      }
      for (let j=0;j<CS;j++) for (let i=0;i<CS;){
        const val = mask[j*CS+i];
        if (!val){ i++; continue; }
        let wq = 1;
        while (i+wq < CS && mask[j*CS+i+wq] === val) wq++;
        let hq = 1;
        grow: while (j+hq < CS){
          for (let k=0;k<wq;k++) if (mask[(j+hq)*CS+i+k] !== val) break grow;
          hq++;
        }
        for (let b=0;b<hq;b++) for (let a2=0;a2<wq;a2++) mask[(j+b)*CS+i+a2] = 0;
        quads++;
        i += wq;
      }
    }
  }
  c.dirtyMesh = false;
  return quads;
}

/* Classic script, not a module: ES modules are blocked over file:// and the
   whole point of this rig is running the page straight off disk. The game is
   one self-contained index.html anyway, so this gets inlined in the end. */
