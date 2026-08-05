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

     1. SPARSE — but one level up, not here. Nothing is stored as material
        until something happens to it: a mountain is one record in matter.js
        until it is hit. THIS file is the grid that record is expanded INTO,
        and it covers a bounded box near the player. Sparseness belongs to the
        world; the active box is dense, flat, and small.

     2. DIRTY RECTS. A chunk that did not change last tick is not looked at
        this tick. Sand at rest costs nothing, which is what makes a cave full
        of settled sand affordable — and settled is what sand is, almost all
        of the time. Measured at 11,405x on a settled pile.

     3. ACTIVE SET. What is simulated is what is moving, not what exists.

   Materials are a byte per voxel and their behaviour comes from a table, so
   adding water that puts out fire is a row, not a code path.

   ---------------------------------------------------------------------------
   WHY THIS FILE IS FLAT, AND WHAT IT COST TO FIND OUT
   ---------------------------------------------------------------------------
   The first version stored chunks in a Map keyed by the STRING "cx,cy,cz", and
   every single cell access — every neighbour probe, every reaction test, every
   move — built that string and hashed it. Measured against tet.js, which does
   the same kind of work through a flat typed array, this file was roughly two
   orders of magnitude more expensive per cell, and that gap was the one thing
   standing between the design and a frame budget: a reaction front only 10 m
   across cost 225 ms a tick.

   So the storage is now ONE flat Uint8Array over a bounded box, and the chunk
   layer is nothing but dirty bounds indexed by arithmetic. Five things went:

     * string keys and Map lookups         -> one multiply-add
     * `for (const [dx,dy,dz] of [[...]])` -> a preallocated offset table
        (that literal allocated six arrays per cell, per tick)
     * the reaction Map                    -> a flat 65,536-entry table, plus a
        per-material flag that skips the probe entirely for anything inert
     * MAT[m].k / .d / .s                  -> parallel typed arrays
     * per-access bounds checks            -> A WALL OF ROCK, see below

   THE WALL. The array is allocated one cell larger than the box on every side
   and that border is filled with ROCK, so the inner loop can index a neighbour
   with no comparison at all: the edge of the world simply answers "solid" like
   any other rock would. This is safe because of a property of the rules rather
   than a promise — EVERY probe is at most one cell outside. Falls and diagonals
   move one cell. The liquid spread walks sideways up to `spread` cells but
   stops at the first cell it cannot pass, and the first cell outside the box is
   ROCK, so it stops there. Nothing can reach two cells out to be wrong about.

   The box is also padded up to a whole number of chunks, and that slack is
   ROCK as well, so a chunk scan never has to clamp against the real bounds.
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

/* The same table again as parallel typed arrays. MAT stays because it is the
   readable one and the renderer wants names and colours; these are what the
   inner loop reads, because `MAT[m].k` is a property load on a boxed object and
   `M_K[m]` is a byte. Sized 256 so a material id is always a valid index — an
   unwritten row reads as an inert solid of zero density, which is the safe way
   to be wrong. */
const M_K = new Uint8Array(256), M_D = new Uint8Array(256),
      M_S = new Uint8Array(256), M_LIFE = new Uint8Array(256);
for (let i=0;i<MAT.length;i++){
  M_K[i]=MAT[i].k; M_D[i]=MAT[i].d; M_S[i]=MAT[i].s; M_LIFE[i]=MAT[i].life;
}

/* Adding a material is a row, not a code path, and it is meant to be done from
   outside this file — the twelve above are the ones the benches need, not the
   world's list. Noita has about four hundred; the ceiling here is 255, because
   a cell is one byte and that is the whole reason the grid is affordable.

   Nothing in the tick loop is sized by how many materials exist: the kind,
   density and spread are array reads, and so is the reaction test. Twenty-seven
   materials in the same room cost exactly what two do. voxel/many.html
   measures that rather than asserting it. */
function addMaterial(spec){
  const id = MAT.length;
  if (id > 255) throw new Error('a material id is one byte: 256 is the ceiling');
  const m = {n:spec.n, k:spec.k, d:spec.d, s:spec.s|0,
             life:spec.life|0, burn:spec.burn|0, c:spec.c||[0.5,0.5,0.5]};
  MAT.push(m);
  M_K[id]=m.k; M_D[id]=m.d; M_S[id]=m.s; M_LIFE[id]=m.life;
  return id;
}

/* Reactions: what happens when a touches b. Order-independent — written both
   ways — so "water puts out fire" is one row, not two.

   Flat, not a Map: 65,536 entries of "what this pair becomes", -1 for the vast
   majority that become nothing. 256 KB bought once, and a reaction test is now
   an array read instead of a hash. RXANY is the bigger win of the two: it says
   whether a material reacts with ANYTHING, so sand and smoke skip the whole
   six-neighbour probe rather than performing it and finding nothing. */
const RXP = new Int32Array(65536).fill(-1);
const RXANY = new Uint8Array(256);
const rx = (a,b,ra,rb) => {
  RXP[a*256+b] = (ra<<8)|rb;
  RXP[b*256+a] = (rb<<8)|ra;
  RXANY[a]=1; RXANY[b]=1;
};
rx(FIRE,  WATER, STEAM, STEAM);
rx(LAVA,  WATER, ROCK,  STEAM);
rx(FIRE,  OIL,   FIRE,  FIRE);
rx(FIRE,  WOOD,  FIRE,  EMBER);
rx(LAVA,  OIL,   LAVA,  FIRE);
rx(LAVA,  WOOD,  LAVA,  FIRE);
rx(ACID,  ROCK,  AIR,   AIR);
rx(ACID,  WOOD,  ACID,  AIR);

/* ---------------- the grid ----------------
   CS is a chunk edge. 32 is chosen and not tuned: the dirty bounds fit in
   bytes, and it is small enough that one settled chunk skipping its tick is a
   meaningful saving. */
const CS = 32, CS2 = CS*CS, CS3 = CS*CS*CS;

/* The six face neighbours, as coordinate deltas. The matching flat-index
   offsets depend on the world's strides, so they live on the World. */
const NBX = new Int8Array([ 1,-1, 0, 0, 0, 0]);
const NBY = new Int8Array([ 0, 0, 1,-1, 0, 0]);
const NBZ = new Int8Array([ 0, 0, 0, 0, 1,-1]);

/* The four horizontal directions a falling thing can slide into. Choosing
   between them at random is not decoration: without it powders form perfectly
   straight-sided pyramids and liquids all drift the same way, and both read
   instantly as fake. */
const DIAGX = new Int8Array([ 1,-1, 0, 0]);
const DIAGZ = new Int8Array([ 0, 0, 1,-1]);

/* Scratch counters for the tick, kept out of the object so the inner loop is
   not writing through a property every cell. Written back when it ends. */
let RS = 0, SCAN = 0, MOV = 0;

class World {
  /* BOUNDS, and the measurement that put them here. Without them the first
     benchmark reported that NOTHING EVER SETTLES — sand and water both still
     awake after four thousand ticks — and the reason was not the physics. A
     grain at x=0 asks what is at x=-1, an absent chunk answers AIR, and the
     whole pile pours off the edge of the world into unbounded space, minting
     chunks as it falls. It never lands, so it never sleeps, so the dirty rect
     never pays.

     Outside the bounds is ROCK. A cave has walls; a simulation of one needs
     them to be somewhere rather than nowhere — and now that the wall is a real
     row of bytes rather than a conditional, it is also what makes the inner
     loop free of bounds checks. */
  constructor(bounds){
    const b = bounds || {x0:0,y0:0,z0:0,x1:127,y1:127,z1:127};
    this.b = b;
    this.ox=b.x0; this.oy=b.y0; this.oz=b.z0;
    this.W = b.x1-b.x0+1; this.H = b.y1-b.y0+1; this.D = b.z1-b.z0+1;

    /* Chunk-aligned interior, then one cell of wall all round it. */
    this.CW = Math.ceil(this.W/CS); this.CH = Math.ceil(this.H/CS); this.CD = Math.ceil(this.D/CS);
    this.AW = this.CW*CS;           this.AH = this.CH*CS;           this.AD = this.CD*CS;
    this.PW = this.AW+2;            this.PH = this.AH+2;            this.PD = this.AD+2;
    /* x fastest, then z, then y — the order the scan runs in, so a row of the
       scan is a run of consecutive bytes. */
    this.SX = 1; this.SZ = this.PW; this.SY = this.PW*this.PD;
    this.N  = this.PW*this.PH*this.PD;

    this.m = new Uint8Array(this.N);        // material id
    this.t = new Uint8Array(this.N);        // ticks lived, for anything with a life
    this.N6 = new Int32Array([1,-1,this.SY,-this.SY,this.SZ,-this.SZ]);

    /* Everything is rock, then the real box is carved out of it as air. What is
       left solid is the wall and the alignment slack, and both behave like any
       other rock for the whole of the rest of this file. */
    this.m.fill(ROCK);
    for (let y=0;y<this.H;y++) for (let z=0;z<this.D;z++){
      const r = (y+1)*this.SY + (z+1)*this.SZ + 1;
      this.m.fill(AIR, r, r+this.W);
    }

    /* The chunk layer is now six numbers and three flags per chunk, indexed by
       arithmetic. There is no chunk object and nothing to look up. */
    this.nc = this.CW*this.CH*this.CD;
    this.cb = new Int16Array(this.nc*6);    // dirty bounds, chunk-local
    this.cw = new Uint8Array(this.nc);      // awake: scan me next tick
    this.cu = new Uint8Array(this.nc);      // ever written: this chunk exists
    this.cm = new Uint8Array(this.nc);      // geometry is stale
    this.cf = new Uint8Array(this.nc);      // the rect is ALREADY the whole chunk
    this.awake = [];                        // chunk indices, the active set
    this.nused = 0;
    for (let c=0;c<this.nc;c++) this.reset(c);

    this.tick = 0;
    this.stats = {moves:0, scanned:0, awake:0, chunks:0, rx:0};
  }

  reset(c){
    const b=this.cb, o=c*6;
    b[o]=CS; b[o+1]=CS; b[o+2]=CS; b[o+3]=-1; b[o+4]=-1; b[o+5]=-1;
    this.cw[c]=0; this.cf[c]=0;
  }
  ci(cx,cy,cz){ return (cy*this.CD + cz)*this.CW + cx; }
  idx(x,y,z){ return (y+1)*this.SY + (z+1)*this.SZ + (x+1); }   // box coords
  inBox(x,y,z){ return x>=0 && y>=0 && z>=0 && x<this.W && y<this.H && z<this.D; }

  /* Touch a voxel: it and its neighbourhood are live next tick. A cell that
     moves must wake where it LEFT as well as where it arrived, or a column of
     sand falls one voxel and goes back to sleep with a hole under it. */
  /* THE SATURATION FLAG, and the measurement that earned it. In a body of
     liquid that is genuinely churning — acid eating its way through rock —
     essentially every cell moves every tick, and a move wakes two
     neighbourhoods. Measured: 65,536 cells scanned, 64,493 moves, 132,928
     touches and 156,894 marks in a single tick, and almost every one of those
     marks was widening a rect that already covered the entire chunk.

     So once a rect reaches the chunk's full extent, say so in one byte. After
     that a mark is a single array read and a return: nothing left to widen.
     Costs nothing when the world is quiet, because a quiet chunk never
     saturates in the first place. */
  mark(c, lx,ly,lz){
    if (this.cf[c]){ this.cm[c]=1; return; }
    const b=this.cb, o=c*6;
    const x0 = lx>0?lx-1:0, x1 = lx<CS-1?lx+1:CS-1;
    const y0 = ly>0?ly-1:0, y1 = ly<CS-1?ly+1:CS-1;
    const z0 = lz>0?lz-1:0, z1 = lz<CS-1?lz+1:CS-1;
    let grew = 0;
    if (x0<b[o])   { b[o]=x0;   grew=1; }  if (x1>b[o+3]) { b[o+3]=x1; grew=1; }
    if (y0<b[o+1]) { b[o+1]=y0; grew=1; }  if (y1>b[o+4]) { b[o+4]=y1; grew=1; }
    if (z0<b[o+2]) { b[o+2]=z0; grew=1; }  if (z1>b[o+5]) { b[o+5]=z1; grew=1; }
    if (!this.cw[c]){ this.cw[c]=1; this.awake.push(c); }
    if (!this.cu[c]){ this.cu[c]=1; this.nused++; }
    this.cm[c]=1;
    if (grew && b[o]===0 && b[o+1]===0 && b[o+2]===0 &&
        b[o+3]===CS-1 && b[o+4]===CS-1 && b[o+5]===CS-1) this.cf[c]=1;
  }
  /* A change on a chunk face wakes the chunk next door, or material stops dead
     at chunk seams — the classic falling-sand bug, and it looks like a shelf. */
  touch(x,y,z){                                  // box coords
    const cx=x>>5, cy=y>>5, cz=z>>5, lx=x&31, ly=y&31, lz=z&31;
    const CWd=this.CW, CDd=this.CD;
    const row = (cy*CDd + cz)*CWd;
    this.mark(row+cx, lx,ly,lz);
    if      (lx===0)    { if (cx>0)          this.mark(row+cx-1, CS-1, ly, lz); }
    else if (lx===CS-1) { if (cx<CWd-1)      this.mark(row+cx+1, 0,    ly, lz); }
    if      (lz===0)    { if (cz>0)          this.mark(row-CWd+cx, lx, ly, CS-1); }
    else if (lz===CS-1) { if (cz<CDd-1)      this.mark(row+CWd+cx, lx, ly, 0); }
    if      (ly===0)    { if (cy>0)          this.mark(row-CDd*CWd+cx, lx, CS-1, lz); }
    else if (ly===CS-1) { if (cy<this.CH-1)  this.mark(row+CDd*CWd+cx, lx, 0,    lz); }
  }

  /* Box-coordinate write. Everything inside the tick speaks these. */
  put(x,y,z,mat){
    if (!this.inBox(x,y,z)) return;              // nothing is written outside the world
    const i = this.idx(x,y,z);
    if (this.m[i] === mat) return;
    this.m[i] = mat; this.t[i] = 0;
    this.touch(x,y,z);
  }

  /* World-space access, which is what every consumer outside this file uses.
     One subtraction more than the box form; never called from the inner loop. */
  outside(x,y,z){ return !this.inBox(x-this.ox, y-this.oy, z-this.oz); }
  at(x,y,z){
    const X=x-this.ox, Y=y-this.oy, Z=z-this.oz;
    if (!this.inBox(X,Y,Z)) return ROCK;         // the edge of the world holds
    return this.m[this.idx(X,Y,Z)];
  }
  set(x,y,z,mat){ this.put(x-this.ox, y-this.oy, z-this.oz, mat); }
  swap(x0,y0,z0, x1,y1,z1){
    const a = this.at(x0,y0,z0), b = this.at(x1,y1,z1);
    this.set(x0,y0,z0,b); this.set(x1,y1,z1,a);
    this.stats.moves++;
  }
  /* How much of a material is in the world. Replaces walking the chunk map,
     which callers used to do by hand. */
  count(mat){
    let n=0;
    for (let y=0;y<this.H;y++) for (let z=0;z<this.D;z++){
      const r=(y+1)*this.SY+(z+1)*this.SZ+1;
      for (let x=0;x<this.W;x++) if (this.m[r+x]===mat) n++;
    }
    return n;
  }
  /* How many chunks have ever been written — kept as a running count rather
     than a scan, because it is read every tick and a large quiet world should
     never pay to be asked its size. */
  used(){ return this.nused; }
}

/* ---------------- the rules ----------------
   Each is "where would I rather be", asked in order, first answer wins. */

/* Can I displace what is there? Air always; a lighter fluid yes, which is how
   sand sinks through water and oil climbs through it with no special case. */
function passable(mat, tgt){
  if (tgt === AIR) return true;
  const k = M_K[tgt];
  if (k === STATIC || k === POWDER) return false;
  return M_D[mat] > M_D[tgt];
}

function move(w, i, x,y,z, j, dx,dy,dz){
  const M=w.m;
  const a=M[i], b=M[j];
  M[i]=b; M[j]=a;
  /* The age array is only written for materials that HAVE an age — it is a
     second buffer the size of the world and sand has no lifetime to reset.
     Measured: no difference at all, so this is tidiness rather than a win, and
     it is recorded that way so nobody re-derives it as one.

     NOTE, a real quirk rather than an oversight: a move resets the age, so
     anything with a life only ages while it is BLOCKED — fire that can keep
     rising never turns to smoke. That was true of the map version too and the
     visual results were tuned around it, so the flattening leaves it alone
     deliberately. Changing it is a physics decision, not a performance one. */
  if (M_LIFE[b]) w.t[i]=0;
  if (M_LIFE[a]) w.t[j]=0;
  w.touch(x,y,z); w.touch(x+dx,y+dy,z+dz);
  MOV++;
}

function react(w, i, x,y,z, a){
  const M=w.m, N6=w.N6, base=a<<8;
  for (let k=0;k<6;k++){
    const p = RXP[base + M[i+N6[k]]];
    if (p >= 0){
      w.put(x,y,z, p>>8);
      w.put(x+NBX[k], y+NBY[k], z+NBZ[k], p&255);
      w.stats.rx++;
      return true;
    }
  }
  return false;
}

function stepCell(w, i, x,y,z, mat){
  if (RXANY[mat] && react(w,i,x,y,z,mat)) return true;
  const K = M_K[mat];
  if (K === STATIC) return false;
  const M = w.m, SZ = w.SZ;
  const dir = (K === GAS) ? 1 : -1;              // gases rise, the rest fall
  const dy = dir*w.SY;

  /* 1. straight along gravity.

     WRITTEN OUT LONGHAND, AND ONLY THIS ONE. It is passable() followed by
     move(), and calling them costs more than the work they do: V8 will not
     inline move() — nine arguments and two method calls in its body — and on a
     falling column, where the bottom-up scan means every grain moves every
     tick, that one call was more than half the cost of the whole simulation.
     Measured on 262,144 cells with 147,456 moves a tick: 28.3 ms through the
     calls, 12.4 ms written out, the same moves either way. Doing the same to
     the diagonals below changed nothing (12.9 ms), so they keep the readable
     form — this is the only place where duplication has earned its keep, and
     the rule it duplicates lives in passable(). Change one, change both. */
  {
    const j = i+dy, tgt = M[j];
    /* passable(): air, or a fluid this is denser than. LIQUID and GAS are the
       two kinds that can be displaced, and they are the top two of the four. */
    if (tgt === AIR || (M_K[tgt] >= LIQUID && M_D[mat] > M_D[tgt])){
      M[i] = tgt; M[j] = mat;
      if (M_LIFE[tgt]) w.t[i] = 0;
      if (M_LIFE[mat]) w.t[j] = 0;
      w.touch(x,y,z); w.touch(x,y+dir,z);
      MOV++;
      return true;
    }
  }

  /* 2. diagonally, choosing between the four at random so piles are not
        pyramids and flows are not all left-handed. The top two bits of the LCG
        rather than a float multiply: same job, no division. */
  RS = (RS*1664525 + 1013904223) >>> 0;
  const o = RS >>> 30;
  for (let k=0;k<4;k++){
    const q=(o+k)&3, dx=DIAGX[q], dz=DIAGZ[q];
    const j = i + dy + dx + dz*SZ;
    if (passable(mat, M[j])){ move(w,i,x,y,z, j, dx,dir,dz); return true; }
  }

  /* 3. and if it is a fluid, sideways — up to its spread, which is the
        difference between water (finds its level fast) and lava (crawls).
        This is the only rule that walks more than one cell, and it stops at
        the first cell it cannot pass, which is why one cell of wall is
        enough to keep the whole loop unchecked. */
  if (K === LIQUID || K === GAS){
    const s = M_S[mat];
    const q=(o+1)&3, dx=DIAGX[q], dz=DIAGZ[q];
    const off = dx + dz*SZ;
    for (let n=1;n<=s;n++){
      const side = i + off*n;
      if (!passable(mat, M[side])) break;
      if (passable(mat, M[side+dy])){ move(w,i,x,y,z, side+dy, dx*n,dir,dz*n); return true; }
      if (n === s){ move(w,i,x,y,z, side, dx*n,0,dz*n); return true; }
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
  const M=w.m, T=w.t, SY=w.SY, SZ=w.SZ, CW=w.CW, CD=w.CD;
  const flip = (w.tick & 1) === 1;
  RS = (w.tick*2654435761) >>> 0;
  SCAN = 0; MOV = w.stats.moves;

  /* Freeze this tick's rects and open fresh ones, so what happens now schedules
     the NEXT tick rather than extending this one for ever. The active set is a
     list of chunk indices rather than a walk of every chunk that exists: a
     world can be large and quiet and cost nothing to find that out. */
  const was = w.awake;
  w.awake = [];
  const rect = [];
  if (noDirty){
    for (const c of was) w.reset(c);
    for (let c=0;c<w.nc;c++) if (w.cu[c]) rect.push(c, 0,0,0, CS-1,CS-1,CS-1);
  } else {
    for (const c of was){
      const o=c*6, b=w.cb;
      rect.push(c, b[o],b[o+1],b[o+2], b[o+3],b[o+4],b[o+5]);
      w.reset(c);
    }
  }
  w.stats.awake = rect.length/7;
  w.stats.chunks = w.used();

  for (let r=0; r<rect.length; r+=7){
    const c = rect[r];
    const cx = c % CW, q = (c/CW)|0, cz = q % CD, cy = (q/CD)|0;
    const bx = cx*CS, by = cy*CS, bz = cz*CS;
    const x0=rect[r+1], y0=rect[r+2], z0=rect[r+3];
    const x1=rect[r+4], y1=rect[r+5], z1=rect[r+6];
    const span = x1-x0;
    for (let ly=y0; ly<=y1; ly++){
      const y = by+ly;
      for (let lz=z0; lz<=z1; lz++){
        const z = bz+lz;
        /* The flat index of x=0 in this row. Everything in the innermost loop
           is that plus an integer — no multiply, no lookup, no bounds test. */
        const row = (y+1)*SY + (z+1)*SZ + 1 + bx;
        for (let n=0; n<=span; n++){
          const lx = flip ? x1-n : x0+n;
          const i = row + lx;
          const mat = M[i];
          SCAN++;
          if (mat === AIR) continue;
          const L = M_LIFE[mat];
          if (L){
            /* Anything with a life ages while it is awake and becomes its
               successor at the end of it: fire to smoke, smoke to nothing. */
            if (++T[i] >= L){
              w.put(bx+lx, y, z, (mat===FIRE || mat===EMBER) ? SMOKE : AIR);
              continue;
            }
            w.touch(bx+lx, y, z);               // burning is never settled
          }
          stepCell(w, i, bx+lx, y, z, mat);
        }
      }
    }
  }
  w.stats.scanned = SCAN;
  w.stats.moves = MOV;
  w.tick++;
}

/* ---------------- greedy meshing ----------------
   The reason a voxel game is not just an instanced cube per voxel: at any
   useful resolution there are millions of them and the draw call is the whole
   frame. A face is emitted only where a solid voxel meets a non-solid one, and
   coplanar faces of the same material are merged into the largest rectangle
   that fits — a flat wall of ten thousand voxels becomes one quad.

   One chunk is meshed in isolation, so its outer faces are always emitted:
   what a neighbouring chunk holds is that chunk's business.

   Returns the quad count, which is the number that decides whether any of this
   is affordable. */
function greedyMesh(w, cx, cy, cz){
  const M = w.m;
  const bx=cx*CS, by=cy*CS, bz=cz*CS;
  const at = (x,y,z) => (by+y+1)*w.SY + (bz+z+1)*w.SZ + (bx+x+1);
  const solid = i => M[i] !== AIR && M_K[M[i]] !== GAS;
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
        mask[p[v]*CS + p[u]] = sa === sb ? 0 : (sa ? M[a] : -M[b]);
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
  w.cm[w.ci(cx,cy,cz)] = 0;
  return quads;
}

/* Classic script, not a module: ES modules are blocked over file:// and the
   whole point of this rig is running the page straight off disk. The game is
   one self-contained index.html anyway, so this gets inlined in the end. */
