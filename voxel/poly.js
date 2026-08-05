/* ============================================================================
   POLYHEDRAL DEBRIS — rigid pyramids, and what a crowd of them costs
   ============================================================================
   The other half of the question. sand.js simulates MATERIAL on a fixed grid:
   cheap, enormous counts, no orientation — a grain has a position and nothing
   else. This simulates BODIES: five-vertex pyramids with a real pose, real
   spin, and real contact with each other.

   They are not interchangeable and the difference is the whole point. A grid
   cell costs one byte and one comparison. A rigid body costs a quaternion, an
   inertia tensor, and — the part that actually decides the budget — a
   collision test against every neighbour, which is where the naive version
   dies at a few hundred.

   So the number we are after is the crossover: how many pyramids can be awake,
   touching, and honest at once. Everything here is built to measure that
   rather than to assert it, which is why the narrow phase is real separating-
   axis and not spheres pretending to be pyramids.

   THE SHAPE. Five vertices, which is the smallest polyhedron with a flat face
   to rest on and a point to topple over: a square base and an apex. Four of
   its faces are triangles, one is a quad, and it has eight edges. Those counts
   set the cost of everything below — SAT tests 5 + 5 face normals and up to
   8 x 8 edge pairs, so a single pair of pyramids is up to 74 axes.
   ========================================================================== */

/* ---------------- vectors and quaternions, inline and unromantic ---------- */
const v3 = (x,y,z) => ({x,y,z});
const add = (a,b) => v3(a.x+b.x, a.y+b.y, a.z+b.z);
const sub = (a,b) => v3(a.x-b.x, a.y-b.y, a.z-b.z);
const mul = (a,s) => v3(a.x*s, a.y*s, a.z*s);
const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
const cross = (a,b) => v3(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);
const len = a => Math.sqrt(dot(a,a));
function norm(a){ const l = len(a); return l > 1e-9 ? mul(a, 1/l) : v3(0,0,0); }

function qmul(a,b){
  return {w:a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
          x:a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
          y:a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
          z:a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w};
}
function qnorm(q){
  const l = Math.hypot(q.w,q.x,q.y,q.z) || 1;
  return {w:q.w/l, x:q.x/l, y:q.y/l, z:q.z/l};
}
/* Rotate v by q. The two-cross-product form: fewer operations than building a
   matrix, and this is called for every vertex of every body every tick. */
function qrot(q,v){
  const u = v3(q.x,q.y,q.z);
  const t = mul(cross(u,v), 2);
  return add(add(v, mul(t, q.w)), cross(u,t));
}

/* ---------------- the pyramid ----------------
   Local vertices about the centroid, which for a square pyramid sits a quarter
   of the way up from the base. Getting that wrong makes everything spin about
   the wrong point and it reads as weightless. */
function pyramid(a, h){
  const b = -h/4, t = h*3/4;
  return {
    v: [v3(-a,b,-a), v3(a,b,-a), v3(a,b,a), v3(-a,b,a), v3(0,t,0)],
    /* Face normals in local space: the base, then the four sides. SAT needs
       these and nothing else from the faces. */
    f: [v3(0,-1,0),
        norm(v3(0, a, -h)), norm(v3(h, a, 0)), norm(v3(0, a, h)), norm(v3(-h, a, 0))],
    /* Eight edges as vertex index pairs: four round the base, four up to the
       apex. Edge-edge axes are where SAT gets expensive and where it also gets
       CORRECT - without them two pyramids interpenetrate corner-first. */
    e: [[0,1],[1,2],[2,3],[3,0],[0,4],[1,4],[2,4],[3,4]],
    r: Math.max(Math.hypot(a,h*0.25,a), h*0.75)     // bounding sphere
  };
}

class Body {
  constructor(shape, p, m){
    this.s = shape;
    this.p = p;                                  // position of the centroid
    this.q = qnorm({w:1,x:0.1,y:0.2,z:0.05});    // pose
    this.v = v3(0,0,0);                          // linear velocity
    this.w = v3(0,0,0);                          // angular velocity
    this.m = m; this.im = 1/m;
    /* Inertia as a box around the pyramid. Approximate on purpose: an exact
       tensor changes how it tumbles, not what it costs, and cost is what this
       file measures. */
    const e = shape.r*1.1;
    this.ii = 1/(m * e*e * 0.4);
    this.sleep = 0;
    this.wv = new Array(5);                      // world vertices, rebuilt per tick
  }
  world(){
    for (let i=0;i<5;i++) this.wv[i] = add(this.p, qrot(this.q, this.s.v[i]));
    return this.wv;
  }
  axis(n){ return qrot(this.q, n); }
}

/* ---------------- separating axis, on the real hulls ----------------
   Returns null when they are apart, or the minimum translation axis and depth
   when they overlap. This is the honest narrow phase and it is the reason the
   body count is what it is.  */
function project(vs, ax){
  let lo = Infinity, hi = -Infinity;
  for (let i=0;i<vs.length;i++){
    const d = dot(vs[i], ax);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo,hi];
}
function sat(A, B, stats){
  const av = A.world(), bv = B.world();
  let best = Infinity, axis = null;
  const test = ax => {
    const l = len(ax);
    if (l < 1e-7) return true;
    const n = mul(ax, 1/l);
    const [a0,a1] = project(av,n), [b0,b1] = project(bv,n);
    stats.axes++;
    if (a1 < b0 || b1 < a0) return false;         // a gap: they are apart, stop
    const d = Math.min(a1-b0, b1-a0);
    if (d < best){ best = d; axis = n; }
    return true;
  };
  for (let i=0;i<5;i++) if (!test(A.axis(A.s.f[i]))) return null;
  for (let i=0;i<5;i++) if (!test(B.axis(B.s.f[i]))) return null;
  for (const [i0,i1] of A.s.e){
    const ea = sub(av[i1], av[i0]);
    for (const [j0,j1] of B.s.e)
      if (!test(cross(ea, sub(bv[j1], bv[j0])))) return null;
  }
  /* Point the axis from A to B so the push separates rather than merges. */
  if (dot(sub(B.p, A.p), axis) < 0) axis = mul(axis, -1);
  return {axis, depth: best};
}

/* ---------------- the world ---------------- */
const REST = 0.18, FRICT = 0.35, SLEEP_V = 0.35, SLEEP_T = 30;

class Debris {
  constructor(opts){
    this.o = Object.assign({g:20, floor:0, wall:1e9, cell:0}, opts||{});
    this.b = [];
    this.stats = {pairs:0, hits:0, axes:0, awake:0, broad:0};
  }
  add(body){ this.b.push(body); return body; }

  /* Broad phase: a hash on a grid of one body-diameter. Without it this is
     O(n^2) and every measurement below is a measurement of the wrong thing. */
  buckets(){
    const cs = this.o.cell || 1;
    const h = new Map();
    for (let i=0;i<this.b.length;i++){
      const b = this.b[i];
      const k = ((b.p.x/cs)|0)+','+((b.p.y/cs)|0)+','+((b.p.z/cs)|0);
      let a = h.get(k); if (!a){ a=[]; h.set(k,a); }
      a.push(i);
    }
    return h;
  }

  step(dt, opts){
    const noSleep = opts && opts.noSleep;
    const S = this.stats;
    S.pairs = 0; S.hits = 0; S.axes = 0; S.awake = 0; S.broad = 0;
    const g = this.o.g, floor = this.o.floor, wall = this.o.wall;

    /* 1. integrate */
    for (const b of this.b){
      if (b.sleep >= SLEEP_T && !noSleep) continue;
      S.awake++;
      b.v.y -= g*dt;
      b.p = add(b.p, mul(b.v, dt));
      const wq = qmul({w:0, x:b.w.x, y:b.w.y, z:b.w.z}, b.q);
      b.q = qnorm({w:b.q.w + wq.w*dt*0.5, x:b.q.x + wq.x*dt*0.5,
                   y:b.q.y + wq.y*dt*0.5, z:b.q.z + wq.z*dt*0.5});
    }

    /* 2. the ground, per VERTEX — which is what makes a pyramid topple onto a
          face instead of hovering on its bounding sphere. Five tests a body. */
    for (const b of this.b){
      if (b.sleep >= SLEEP_T && !noSleep) continue;
      const vs = b.world();
      for (let i=0;i<5;i++){
        const p = vs[i];
        if (p.y >= floor) continue;
        const r = sub(p, b.p);
        const pv = add(b.v, cross(b.w, r));
        if (pv.y < 0){
          const j = -(1+REST)*pv.y / (b.im + b.ii*(r.x*r.x + r.z*r.z));
          b.v = add(b.v, mul(v3(0,1,0), j*b.im));
          b.w = add(b.w, mul(cross(r, v3(0,j,0)), b.ii));
          const t = v3(pv.x, 0, pv.z);
          if (len(t) > 1e-4) b.v = add(b.v, mul(norm(t), -Math.min(len(t), j*FRICT*b.im)));
        }
        b.p.y += (floor - p.y);                       // lift out of the floor
      }
      if (Math.abs(b.p.x) > wall){ b.p.x = Math.sign(b.p.x)*wall; b.v.x *= -0.3; }
      if (Math.abs(b.p.z) > wall){ b.p.z = Math.sign(b.p.z)*wall; b.v.z *= -0.3; }
    }

    /* 3. each other */
    const h = this.buckets();
    const cs = this.o.cell || 1;
    for (const [k, list] of h){
      const [cx,cy,cz] = k.split(',').map(Number);
      for (let dx=0;dx<=1;dx++) for (let dy=-1;dy<=1;dy++) for (let dz=-1;dz<=1;dz++){
        if (dx===0 && (dy<0 || (dy===0 && dz<0))) continue;   // each pair once
        const other = h.get((cx+dx)+','+(cy+dy)+','+(cz+dz));
        if (!other) continue;
        S.broad++;
        for (const i of list) for (const j of other){
          if (j <= i && dx===0 && dy===0 && dz===0) continue;
          if (i === j) continue;
          const A = this.b[i], B = this.b[j];
          if (A.sleep >= SLEEP_T && B.sleep >= SLEEP_T && !noSleep) continue;
          const d = sub(B.p, A.p);
          const rr = A.s.r + B.s.r;
          if (dot(d,d) > rr*rr) continue;                     // bounding spheres first
          S.pairs++;
          const hit = sat(A, B, S);
          if (!hit) continue;
          S.hits++;
          /* Push apart, then kill the closing velocity along the axis. Two
             bodies, so each takes half of everything. */
          const push = mul(hit.axis, hit.depth*0.5);
          A.p = sub(A.p, push); B.p = add(B.p, push);
          const rel = sub(B.v, A.v);
          const vn = dot(rel, hit.axis);
          if (vn < 0){
            const j2 = -(1+REST)*vn / (A.im + B.im);
            A.v = sub(A.v, mul(hit.axis, j2*A.im));
            B.v = add(B.v, mul(hit.axis, j2*B.im));
            /* A little spin from an off-centre knock, or a heap of pyramids
               settles like a heap of marbles and the shape stops mattering. */
            const ra = sub(add(A.p, mul(hit.axis, A.s.r*0.5)), A.p);
            A.w = add(A.w, mul(cross(ra, mul(hit.axis, -j2)), A.ii*0.5));
            B.w = add(B.w, mul(cross(ra, mul(hit.axis,  j2)), B.ii*0.5));
          }
          A.sleep = 0; B.sleep = 0;
        }
      }
    }

    /* 4. sleep. The same lesson the grid taught: what is at rest must cost
          nothing, or a pile is a permanent tax on every frame after it lands. */
    for (const b of this.b){
      if (len(b.v) < SLEEP_V && len(b.w) < SLEEP_V) b.sleep++;
      else b.sleep = 0;
    }
  }
  awake(){ let n=0; for (const b of this.b) if (b.sleep < SLEEP_T) n++; return n; }
}
