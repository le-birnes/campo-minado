/* ============================================================================
   WOULD A ROUND VOXEL BE CHEAPER?
   ============================================================================
   Marcelo: "would it be cheaper to have a ROUND voxel? Like a [union] of
   pointy solids glued together in a little ball or several-centered-ball-
   curved-structure, meaning perhaps lighter calculation functions instead of
   plane shapes touching with pointy surfaces at each other?"

   The instinct is right and the answer is a split rather than a yes or a no,
   so this file measures both halves instead of arguing about them.

   WHY A SPHERE IS THE CHEAPEST SHAPE THERE IS

     - it has NO ORIENTATION. A sphere rotated is the same sphere, so there is
       no quaternion to store, no angular velocity to integrate, no inertia
       tensor, and no orientation to keep normalised. That is seven floats and
       a normalise per body that simply do not exist.
     - contact is one distance test. dx*dx+dy*dy+dz*dz < (r1+r2)^2, and it is
       already the answer — no axis list, no projection, no clipping.
     - the contact NORMAL is free: it is the line between the centres, always,
       for every pair. On a polyhedron finding the normal is most of the work.

   WHY IT IS NOT SIMPLY BETTER

     - SPHERES DO NOT TILE SPACE. The densest possible packing of equal spheres
       is pi/(3*sqrt2) = 74.05% (Kepler, proven 2014), and random packing is
       about 64%. A cube tiles at 100% and so does the Kuhn tetrahedron. So a
       WALL built of spheres is a quarter holes: light leaks through it, small
       things fall through it, and its mass is wrong unless you cheat.
     - GREEDY MESHING BECOMES IMPOSSIBLE. The largest win cubes have is that a
       flat face of ten thousand of them merges into ONE quad. Two spheres
       cannot merge into anything. For the standing world that is not a small
       loss, it is the whole rendering budget.

   SO THE ANSWER IS THE SPLIT THE ENGINE ALREADY HAS:

     STATIC, INTACT WORLD  -> cubes. Tiles perfectly, meshes away to nothing,
                              and never moves so it never pays for contact.
     FREE, MOVING GRAINS   -> spheres. Never merged anyway, always in contact
                              tests, and orientation is invisible on a pebble.

   And "several-centered-ball-curved-structure" is a real technique with a
   name: a MULTI-SPHERE body, a shape approximated as a union of spheres. It
   is what granular simulation actually uses for non-round grains, because
   eight sphere tests still cost less than one separating-axis test.
   ========================================================================== */

/* ---- the four candidates, each as bare as it can honestly be ---- */

/* SPHERE. Position and radius. No orientation, because there is none. */
function benchSphere(n, iters){
  const x=new Float32Array(n), y=new Float32Array(n), z=new Float32Array(n),
        r=new Float32Array(n);
  let s=1; const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<n;i++){ x[i]=rnd()*40; y[i]=rnd()*40; z[i]=rnd()*40; r[i]=0.5+rnd()*0.4; }
  let hits=0;
  const t0=performance.now();
  for(let k=0;k<iters;k++)
    for(let i=0;i<n;i++){
      const j=(i+1+k)%n;
      const dx=x[i]-x[j], dy=y[i]-y[j], dz=z[i]-z[j], rr=r[i]+r[j];
      if(dx*dx+dy*dy+dz*dz < rr*rr) hits++;
    }
  return {ms:performance.now()-t0, hits, bytes:n*4*4};
}

/* AXIS-ALIGNED BOX. The cheapest polyhedron: still no orientation, but three
   interval tests instead of one distance. This is the fair floor for a cube. */
function benchAABB(n, iters){
  const x=new Float32Array(n), y=new Float32Array(n), z=new Float32Array(n),
        h=new Float32Array(n);
  let s=2; const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<n;i++){ x[i]=rnd()*40; y[i]=rnd()*40; z[i]=rnd()*40; h[i]=0.5+rnd()*0.4; }
  let hits=0;
  const t0=performance.now();
  for(let k=0;k<iters;k++)
    for(let i=0;i<n;i++){
      const j=(i+1+k)%n;
      const e=h[i]+h[j];
      if(Math.abs(x[i]-x[j])<e && Math.abs(y[i]-y[j])<e && Math.abs(z[i]-z[j])<e) hits++;
    }
  return {ms:performance.now()-t0, hits, bytes:n*4*4};
}

/* ORIENTED BOX. Now it has a rotation, and the test is the real one: fifteen
   separating axes — three of mine, three of theirs, nine cross products. This
   is what a cube costs the moment it is allowed to tumble. */
function benchOBB(n, iters){
  const P=new Float32Array(n*3), H=new Float32Array(n*3), R=new Float32Array(n*9);
  let s=3; const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<n;i++){
    P[i*3]=rnd()*40; P[i*3+1]=rnd()*40; P[i*3+2]=rnd()*40;
    H[i*3]=H[i*3+1]=H[i*3+2]=0.5+rnd()*0.4;
    /* a real rotation matrix from an axis and an angle, because a fake one
       makes the projections cheap in a way a real one is not */
    const a=rnd()*6.283, b=rnd()*6.283;
    const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b);
    R[i*9+0]=ca*cb; R[i*9+1]=-sa; R[i*9+2]=ca*sb;
    R[i*9+3]=sa*cb; R[i*9+4]= ca; R[i*9+5]=sa*sb;
    R[i*9+6]=-sb;   R[i*9+7]=  0; R[i*9+8]=cb;
  }
  let hits=0;
  const t0=performance.now();
  const ax=new Float32Array(3);
  for(let k=0;k<iters;k++)
    for(let i=0;i<n;i++){
      const j=(i+1+k)%n, a9=i*9, b9=j*9;
      const dx=P[j*3]-P[i*3], dy=P[j*3+1]-P[i*3+1], dz=P[j*3+2]-P[i*3+2];
      let sep=false;
      for(let t=0;t<15 && !sep;t++){
        if(t<3){ ax[0]=R[a9+t*3]; ax[1]=R[a9+t*3+1]; ax[2]=R[a9+t*3+2]; }
        else if(t<6){ const u=t-3; ax[0]=R[b9+u*3]; ax[1]=R[b9+u*3+1]; ax[2]=R[b9+u*3+2]; }
        else {
          const u=((t-6)/3)|0, v=(t-6)%3;
          const a0=R[a9+u*3],a1=R[a9+u*3+1],a2=R[a9+u*3+2];
          const b0=R[b9+v*3],b1=R[b9+v*3+1],b2=R[b9+v*3+2];
          ax[0]=a1*b2-a2*b1; ax[1]=a2*b0-a0*b2; ax[2]=a0*b1-a1*b0;
          const L=Math.hypot(ax[0],ax[1],ax[2]);
          if(L<1e-6) continue;
          ax[0]/=L; ax[1]/=L; ax[2]/=L;
        }
        const d=Math.abs(dx*ax[0]+dy*ax[1]+dz*ax[2]);
        let ra=0, rb=0;
        for(let u=0;u<3;u++){
          ra += H[i*3+u]*Math.abs(ax[0]*R[a9+u*3]+ax[1]*R[a9+u*3+1]+ax[2]*R[a9+u*3+2]);
          rb += H[j*3+u]*Math.abs(ax[0]*R[b9+u*3]+ax[1]*R[b9+u*3+1]+ax[2]*R[b9+u*3+2]);
        }
        if(d > ra+rb) sep=true;
      }
      if(!sep) hits++;
    }
  return {ms:performance.now()-t0, hits, bytes:n*4*(3+3+9)};
}

/* MULTI-SPHERE. Marcelo's "several-centered-ball-curved-structure": a lumpy
   shape as a union of K spheres. Still no orientation matrix needed for the
   TEST — the offsets rotate with the body, but the contact is K*K distances,
   and that is the whole of it. */
function benchMulti(n, iters, K){
  const P=new Float32Array(n*3), O=new Float32Array(n*K*3), r=new Float32Array(n*K);
  let s=4; const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<n;i++){
    P[i*3]=rnd()*40; P[i*3+1]=rnd()*40; P[i*3+2]=rnd()*40;
    for(let k=0;k<K;k++){
      O[(i*K+k)*3]=(rnd()-.5)*0.8; O[(i*K+k)*3+1]=(rnd()-.5)*0.8; O[(i*K+k)*3+2]=(rnd()-.5)*0.8;
      r[i*K+k]=0.28+rnd()*0.2;
    }
  }
  let hits=0;
  const t0=performance.now();
  for(let it=0;it<iters;it++)
    for(let i=0;i<n;i++){
      const j=(i+1+it)%n;
      const dx=P[j*3]-P[i*3], dy=P[j*3+1]-P[i*3+1], dz=P[j*3+2]-P[i*3+2];
      let touch=false;
      for(let a=0;a<K && !touch;a++) for(let b=0;b<K;b++){
        const ex=dx+O[(j*K+b)*3]-O[(i*K+a)*3];
        const ey=dy+O[(j*K+b)*3+1]-O[(i*K+a)*3+1];
        const ez=dz+O[(j*K+b)*3+2]-O[(i*K+a)*3+2];
        const rr=r[i*K+a]+r[j*K+b];
        if(ex*ex+ey*ey+ez*ez < rr*rr){ touch=true; break; }
      }
      if(touch) hits++;
    }
  return {ms:performance.now()-t0, hits, bytes:n*4*(3+K*4)};
}

/* ---- packing: what fraction of a volume the shape can actually fill ---- */
const PACK = {
  cube:        {dense: 1.0,     random: 1.0,    note:'tiles exactly'},
  tetrahedron: {dense: 1.0,     random: 1.0,    note:'Kuhn simplex tiles exactly'},
  sphere:      {dense: Math.PI/(3*Math.SQRT2),  random: 0.64,
                note:'Kepler: 74.05% is the proven maximum'}
};
/* Measured rather than quoted: drop spheres on a lattice and count. */
function measurePack(n){
  /* face-centred cubic, the densest lattice, in a unit box */
  const a = 1/n;                      // lattice step
  const r = a/(2*Math.SQRT2);         // touching spheres on the fcc diagonal
  let count=0;
  for(let i=0;i<n;i++) for(let j=0;j<n;j++) for(let k=0;k<n;k++){
    if((i+j+k)%2===0) count++;        // fcc: half the sites
  }
  const vol = count*(4/3)*Math.PI*r*r*r;
  return {count, r, frac: vol};
}
