/* ============================================================================
   THE TETRAHEDRON IS THE VOXEL
   ============================================================================
   Marcelo: "lets consider voxel from now on the smallest tetrahedron."

   Which tetrahedron, exactly, matters — most tetrahedra do not tile space at
   all, and a unit cell that leaves gaps is not a unit cell. The one that does
   is the KUHN SIMPLEX: take a cube, walk from one corner to the opposite corner
   along the three axes in some order, and the four points you touch are a
   tetrahedron. There are six orderings, so six tetrahedra, and they fill the
   cube exactly with no gaps and no overlap.

   That makes it the smallest tetrahedral cell that IS the lattice rather than
   something drawn on top of one. Everything about it is a sixth of a cube:

     volume        one sixth
     count         six times as many for the same space
     NEIGHBOURS    FOUR, not six — a tetrahedron has four faces

   That last line is the interesting one and it is why this is worth measuring
   rather than assuming. A falling-material step costs one test per neighbour,
   so per element a tetrahedron is 4/6 = two thirds the work of a cube. Six
   times as many elements, each two thirds the price: four times the cost for
   the same volume, buying six times the resolution. Whether that trade is good
   is a question about frames, and frames are measurable.

   Neighbours are not hand-derived here. Two cells share a face when they share
   three of their four corners, so the table is BUILT by testing that against
   every tetrahedron in the twenty-seven surrounding cubes — which also checks
   the decomposition itself, because every cell must come out with exactly four.
   ========================================================================== */

const T_AIR = 0, T_ROCK = 1, T_SAND = 2, T_WATER = 3;

/* The six orderings of the three axes: each gives one Kuhn tetrahedron as the
   four points visited walking corner to opposite corner. */
const KUHN = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];

function tetCorners(t){
  const v = [[0,0,0]];
  const p = [0,0,0];
  for (const a of KUHN[t]){ p[a] = 1; v.push([p[0],p[1],p[2]]); }
  return v;                                     // four corners, in the unit cube
}
function centroid(t){
  const v = tetCorners(t);
  let x=0,y=0,z=0;
  for (const c of v){ x+=c[0]; y+=c[1]; z+=c[2]; }
  return [x/4, y/4, z/4];
}

/* The adjacency table, derived rather than written down. For each of the six
   cells: which cell in which neighbouring cube shares a whole face with it. */
function buildAdj(){
  const key = c => c.join(',');
  const adj = [];
  let bad = 0;
  for (let t=0;t<6;t++){
    const mine = new Set(tetCorners(t).map(key));
    const out = [];
    for (let dy=-1;dy<=1;dy++) for (let dz=-1;dz<=1;dz++) for (let dx=-1;dx<=1;dx++){
      for (let u=0;u<6;u++){
        if (!dx && !dy && !dz && u===t) continue;
        const theirs = tetCorners(u).map(c => key([c[0]+dx, c[1]+dy, c[2]+dz]));
        let shared = 0;
        for (const k of theirs) if (mine.has(k)) shared++;
        if (shared === 3){
          /* How far DOWN this move goes, so gravity is a sort rather than a
             special case: the centroid of the neighbour minus mine. */
          const a = centroid(t), b = centroid(u);
          out.push({dx,dy,dz, t:u, dy2: (b[1]+dy) - a[1]});
        }
      }
    }
    out.sort((a,b)=>a.dy2-b.dy2);               // most downward first
    if (out.length !== 4) bad++;
    adj.push(out);
  }
  return {adj, bad};
}
const ADJ = buildAdj();

/* ---------------- the grid ----------------
   Six cells per cube, laid out so the six of one cube are contiguous: that is
   the access pattern the neighbour table produces most often, and on a scan of
   millions it is the difference between a cache hit and a cache miss. */
class TetGrid {
  constructor(nx,ny,nz){
    this.nx=nx; this.ny=ny; this.nz=nz;
    this.n = nx*ny*nz*6;
    this.m = new Uint8Array(this.n);
    this.stats = {moves:0, scanned:0, tests:0};
  }
  idx(x,y,z,t){ return (((y*this.nz + z)*this.nx + x)*6) + t; }
  inside(x,y,z){ return x>=0 && y>=0 && z>=0 && x<this.nx && y<this.ny && z<this.nz; }
  get(x,y,z,t){ return this.inside(x,y,z) ? this.m[this.idx(x,y,z,t)] : T_ROCK; }
  set(x,y,z,t,v){ if (this.inside(x,y,z)) this.m[this.idx(x,y,z,t)] = v; }

  fill(x0,y0,z0,x1,y1,z1,v){
    for (let y=y0;y<y1;y++) for (let z=z0;z<z1;z++) for (let x=x0;x<x1;x++)
      for (let t=0;t<6;t++) this.set(x,y,z,t,v);
  }
  count(v){ let n=0; for (let i=0;i<this.n;i++) if (this.m[i]===v) n++; return n; }

  /* One tick, brute force on purpose: this measures the COST PER ELEMENT of a
     tetrahedral lattice, which is the number the shape choice turns on. The
     dirty-rect machinery from sand.js is orthogonal and already proven — it
     would hide exactly the thing being measured here. */
  step(){
    const S = this.stats;
    S.moves=0; S.scanned=0; S.tests=0;
    for (let y=0; y<this.ny; y++)
      for (let z=0; z<this.nz; z++)
        for (let x=0; x<this.nx; x++)
          for (let t=0; t<6; t++){
            const i = this.idx(x,y,z,t);
            const v = this.m[i];
            if (v === T_AIR || v === T_ROCK) continue;
            S.scanned++;
            const nb = ADJ.adj[t];
            for (let k=0;k<4;k++){
              const a = nb[k];
              if (a.dy2 >= 0) break;            // sorted: nothing below is left
              const X=x+a.dx, Y=y+a.dy, Z=z+a.dz;
              S.tests++;
              if (!this.inside(X,Y,Z)) continue;
              const j = this.idx(X,Y,Z,a.t);
              if (this.m[j] !== T_AIR) continue;
              this.m[j] = v; this.m[i] = T_AIR;
              S.moves++;
              break;
            }
          }
  }
}


/* ============================================================================
   THE SAME RULE ON A CUBE LATTICE, so the comparison is about the SHAPE
   ============================================================================
   The first tetrahedral benchmark printed "15.31x the cube" and it was not
   true: it compared this file — a flat typed-array scan with one rule — against
   sand.js, which carries chunk Map lookups, reactions, randomised tie-breaks
   and liquid spread. That measured two inner loops, not two lattices.

   So here is the cube, written the same way, scanned the same way, with the
   moves ITS lattice offers going downhill: straight down, then the four
   diagonals. The tetrahedron gets the moves its own lattice offers: the face
   neighbours whose centroid is lower. Identical code around both, so whatever
   is left over IS the shape.
   ========================================================================== */
class CubeGrid {
  constructor(nx,ny,nz){
    this.nx=nx; this.ny=ny; this.nz=nz;
    this.n = nx*ny*nz;
    this.m = new Uint8Array(this.n);
    this.stats = {moves:0, scanned:0, tests:0};
  }
  idx(x,y,z){ return (y*this.nz + z)*this.nx + x; }
  inside(x,y,z){ return x>=0 && y>=0 && z>=0 && x<this.nx && y<this.ny && z<this.nz; }
  set(x,y,z,v){ if (this.inside(x,y,z)) this.m[this.idx(x,y,z)] = v; }
  fill(x0,y0,z0,x1,y1,z1,v){
    for (let y=y0;y<y1;y++) for (let z=z0;z<z1;z++) for (let x=x0;x<x1;x++) this.set(x,y,z,v);
  }
  count(v){ let n=0; for (let i=0;i<this.n;i++) if (this.m[i]===v) n++; return n; }
  step(){
    const S = this.stats;
    S.moves=0; S.scanned=0; S.tests=0;
    const D = [[0,-1,0],[1,-1,0],[-1,-1,0],[0,-1,1],[0,-1,-1]];
    for (let y=0;y<this.ny;y++) for (let z=0;z<this.nz;z++) for (let x=0;x<this.nx;x++){
      const i = this.idx(x,y,z);
      const v = this.m[i];
      if (v === T_AIR || v === T_ROCK) continue;
      S.scanned++;
      for (let k=0;k<5;k++){
        const X=x+D[k][0], Y=y+D[k][1], Z=z+D[k][2];
        S.tests++;
        if (!this.inside(X,Y,Z)) continue;
        const j = this.idx(X,Y,Z);
        if (this.m[j] !== T_AIR) continue;
        this.m[j]=v; this.m[i]=T_AIR;
        S.moves++;
        break;
      }
    }
  }
}
