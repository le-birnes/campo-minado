/* ============================================================================
   ON THE LATTICE — bodies that never leave the grid
   ============================================================================
   Marcelo's question, and it is the right one: "movement and interaction should
   be discrete like the voxels, but we watch smooth movement. Why? Is this a
   cheat in the way we observe and the way we build the engine?"

   It is a cheat, it is a deliberate one, and Noita commits it too. Noita's
   MATERIAL is strictly discrete — integer pixels, no subpixel anywhere. Its
   RIGID BODIES are not: they are Box2D bodies with float position and float
   rotation, which get rasterised back into the pixel grid every frame. Two
   layers, one continuous, one discrete, and a rasteriser bridging them.

   The reason that matters here is not philosophical, it is the whole cost
   model. A LATTICE HAS NO ROTATIONAL SYMMETRY EXCEPT ITS OWN. Turn a voxel
   shape by 90 degrees and it lands on itself exactly. Turn it by 37 and
   re-rasterise, and it has a different number of voxels than it started with —
   rotation stops being invertible, volume stops being conserved. So a body
   with a continuous pose CANNOT be represented on the grid, which is what
   forces a separate continuous collision system, which is separating-axis, which
   is 74 axes a pair. Everything expensive follows from leaving the lattice.

   So this file asks what happens if nothing leaves it:

     * position is INTEGER voxels
     * orientation is one of the TWENTY-FOUR rotations of the cube, held as an
       index — one byte, no quaternion, no normalisation, no drift
     * velocity is fixed point, and a body moves when the accumulator crosses a
       whole voxel. That is exactly how a pixel platformer does subpixel motion,
       and the accumulator is part of the discrete state rather than an escape
       from it
     * collision is OCCUPANCY. Two bodies collide when they want the same voxel.
       There is no narrow phase at all — no axes, no projections, no contact
       manifold. A hash lookup per voxel of the body.

   THE SHAPE IS A TETRAHEDRON, for two reasons that happen to agree. It is the
   simplex — four vertices, four faces, six edges, the least of anything that
   still encloses volume and still has flat faces to rest on and points to fall
   over. And the RIGHT tetrahedron tiles the cubic lattice: six of them fill one
   voxel exactly, so the shape and the grid are made of each other.

   Smooth motion, then, is a presentation choice: interpolate between the last
   discrete state and the current one when you DRAW. That stays honest as long
   as the rules only ever read the discrete state. It becomes a real bug the
   moment collision reads the interpolated position, because then two parts of
   the program disagree about where something is.
   ========================================================================== */

/* ---------------- the 24 rotations of a cube ----------------
   Every signed permutation matrix with determinant +1. There are 48 signed
   permutations and half of them are reflections, which would turn a body into
   its mirror image — a thing that cannot happen to an object. */
function cubeRots(){
  const out = [], perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for (const p of perms) for (let s=0;s<8;s++){
    const sg = [(s&1)?-1:1, (s&2)?-1:1, (s&4)?-1:1];
    const m = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i=0;i<3;i++) m[i][p[i]] = sg[i];
    const det = m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
              - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
              + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    if (det === 1) out.push(m);
  }
  return out;                                   // exactly 24
}
const ROTS = cubeRots();

/* The right tetrahedron: the corner of a cube cut by a plane. Six of these,
   rotated, fill one cube — so at size s it is the lattice's own fragment.  */
function tetStamp(s){
  const v = [];
  for (let y=0;y<s;y++) for (let z=0;z<s;z++) for (let x=0;x<s;x++)
    if (x+y+z < s) v.push([x,y,z]);
  return v;
}
/* Precompute the body's voxels in all 24 poses, each shifted back to a
   non-negative corner. Rotating a body at run time is then choosing an index —
   no matrices, no vertices, nothing to renormalise. This is the saving that
   staying on the lattice buys, and it is why orientation costs one byte. */
function poses(stamp){
  return ROTS.map(m => {
    const r = stamp.map(([x,y,z]) => [
      m[0][0]*x + m[0][1]*y + m[0][2]*z,
      m[1][0]*x + m[1][1]*y + m[1][2]*z,
      m[2][0]*x + m[2][1]*y + m[2][2]*z]);
    let mx=1e9,my=1e9,mz=1e9;
    for (const [x,y,z] of r){ if(x<mx)mx=x; if(y<my)my=y; if(z<mz)mz=z; }
    return r.map(([x,y,z]) => [x-mx, y-my, z-mz]);
  });
}

/* Which poses are one quarter turn from this one — the moves available when a
   body topples. Built once by composing with the six axis turns. */
function neighbours(){
  const key = m => m.flat().join(',');
  const ix = new Map(ROTS.map((m,i)=>[key(m),i]));
  const turns = [];
  for (let a=0;a<3;a++) for (const s of [1,-1]){
    const m = [[0,0,0],[0,0,0],[0,0,0]];
    const b=(a+1)%3, c=(a+2)%3;
    m[a][a]=1; m[b][c]=-s; m[c][b]=s;
    turns.push(m);
  }
  return ROTS.map(r => turns.map(t => {
    const p = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i=0;i<3;i++) for (let j=0;j<3;j++)
      p[i][j] = t[i][0]*r[0][j] + t[i][1]*r[1][j] + t[i][2]*r[2][j];
    return ix.get(key(p));
  }).filter(v => v !== undefined));
}
const NB = neighbours();

/* ---------------- the world ----------------
   One hash from voxel to body. That IS the collision system. */
const K = (x,y,z) => ((x+1024)*2048 + (y+1024))*2048 + (z+1024);
const SUB = 256;                                 // fixed-point: subvoxels per voxel

class Lattice {
  constructor(opts){
    this.o = Object.assign({g:12, w:32, d:32, sleep:8}, opts||{});
    this.occ = new Map();                        // voxel -> body index
    this.b = [];
    this.P = null;
    this.stats = {moves:0, blocked:0, turns:0, awake:0, tests:0};
  }
  setShape(s){ this.P = poses(tetStamp(s)); this.n = this.P[0].length; }

  fits(bi, x,y,z, o){
    const p = this.P[o];
    for (let i=0;i<p.length;i++){
      const X=x+p[i][0], Y=y+p[i][1], Z=z+p[i][2];
      this.stats.tests++;
      if (Y < 0) return false;                             // the floor
      if (X < 0 || Z < 0 || X >= this.o.w || Z >= this.o.d) return false;
      const h = this.occ.get(K(X,Y,Z));
      if (h !== undefined && h !== bi) return false;
    }
    return true;
  }
  stamp(bi, on){
    const b = this.b[bi], p = this.P[b.o];
    for (let i=0;i<p.length;i++){
      const k = K(b.x+p[i][0], b.y+p[i][1], b.z+p[i][2]);
      if (on) this.occ.set(k, bi); else this.occ.delete(k);
    }
  }
  add(x,y,z,o){
    const bi = this.b.length;
    this.b.push({x,y,z,o, fy:0, sleep:0});
    if (!this.fits(bi,x,y,z,o)) { this.b.pop(); return -1; }
    this.stamp(bi, true);
    return bi;
  }
  /* Move to an integer cell and/or pose, atomically: lift, test, place. */
  go(bi, x,y,z,o){
    this.stamp(bi, false);
    if (!this.fits(bi,x,y,z,o)){ this.stamp(bi, true); return false; }
    const b = this.b[bi];
    b.x=x; b.y=y; b.z=z; b.o=o;
    this.stamp(bi, true);
    this.stats.moves++;
    return true;
  }

  step(rnd){
    const S = this.stats;
    S.moves=0; S.blocked=0; S.turns=0; S.awake=0; S.tests=0;
    const SL = this.o.sleep;
    for (let bi=0; bi<this.b.length; bi++){
      const b = this.b[bi];
      if (b.sleep >= SL) continue;
      S.awake++;
      /* Fixed point: gravity accumulates in subvoxels and the body steps when
         it has earned a whole one. Discrete state, finer grain — the same trick
         a pixel platformer uses, and not an escape from the grid. */
      b.fy += this.o.g;
      if (b.fy < SUB) continue;
      b.fy -= SUB;
      if (this.go(bi, b.x, b.y-1, b.z, b.o)){ b.sleep = 0; continue; }
      /* Blocked underneath. Try to topple: a quarter turn is the only rotation
         the lattice permits, and if the turned body fits it takes it — that is
         what makes a heap of tetrahedra interlock instead of stack like boxes. */
      S.blocked++;
      const nb = NB[b.o];
      const t = nb[(rnd()*nb.length)|0];
      if (this.go(bi, b.x, b.y, b.z, t)){ S.turns++; b.sleep=0; continue; }
      /* Or slide off the shoulder of whatever it landed on. */
      const d = (rnd()*4)|0;
      const DD = [[1,0],[-1,0],[0,1],[0,-1]];
      let slid = false;
      for (let k=0;k<4 && !slid;k++){
        const [dx,dz] = DD[(d+k)&3];
        if (this.go(bi, b.x+dx, b.y-1, b.z+dz, b.o)) slid = true;
      }
      if (slid){ b.sleep = 0; continue; }
      b.fy = 0;
      b.sleep++;                                  // nothing worked: it is at rest
    }
  }
  awake(){ let n=0; const SL=this.o.sleep; for(const b of this.b) if(b.sleep<SL) n++; return n; }
  height(){ let h=0; for (const b of this.b) if (b.y>h) h=b.y; return h; }
}
