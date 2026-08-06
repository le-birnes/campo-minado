/* ============================================================================
   THE ISLAND — the way out, where the boss died
   ============================================================================
   Marcelo: "the outside should contain for now sand and water around the whole
   dungeon which is now a rock surrounded by water. on the way out (where the
   boss died/exploded) is an island with a hole and sand in its surroundings,
   and a big nice tree for me to blow to smithereens. it has leaves which are
   independent voxel structures."

   So: a rock mass sitting in water, sand where the two meet, a hole blown
   through the rock where the fight ended, and a tree on top.

   WHAT IS ACTUALLY NEW HERE is not the geometry, it is the STRUCTURE REGISTRY.
   Up to now round.js could price destroying "a block of rock" because a block
   was a known 4,096 voxels. A tree is not a block. A leaf cluster is not a
   block. So the world has to say what its THINGS are, independently of the
   grid they are drawn on:

     a structure = an id, a material, a voxel count, and a threshold

   and "destroy" means that structure's threshold was met. That is Marcelo's
   own definition — "destroy means disassemble when threshold is met ... each
   structure has it" — and the island is the first world that needs it, because
   the leaves are the first things that are neither blocks nor terrain.

   THE LEAVES ARE THE POINT. Each cluster is its OWN structure with its own
   threshold, so a shot into the crown takes out the clusters it reaches and
   leaves the rest hanging. A tree does not come apart as one object; it comes
   apart as a trunk and forty independent handfuls of leaf.
   ========================================================================== */

/* Leaves and water want materials of their own. LEAF is a powder-light solid:
   it holds its shape, weighs almost nothing, and burns. */
const LEAF = addMaterial({n:'leaf', k:STATIC, d:255, s:0, life:0, burn:1,
                          c:[0.22,0.45,0.16]});
/* AND THE ISLAND IS MADE OF SAND, NOT ROCK. The first version of this built a
   rock dome with a sand skin painted on it, and that was me not reading the
   brief: "an island of sand (dirt) and wet_sand(dirt) surrounded by water
   (salty), with a tree attached to it, and a hole in the ground".

   Three materials the brief needs and the table did not have:

   WET SAND is not a decoration on dry sand, it is its own material. Water
   between the grains adds mass, and capillary bridges between them add
   COHESION — which is why you can build a sandcastle out of it and not out of
   dry sand, and why a wet bank stands at a steeper angle before it slumps.
   Denser, darker, and it holds a face.

   SALT WATER is denser than fresh, 1025 against 1000, which is small and is
   exactly the sort of small that matters: fresh water poured into it FLOATS,
   and that is a real thing you can see rather than a number in a table. */
const WETSAND = addMaterial({n:'wet sand', k:POWDER, d:72, s:0, life:0, burn:0,
                             c:[0.44,0.37,0.26]});
const SALTWATER = addMaterial({n:'salt water', k:LIQUID, d:51, s:5, life:0, burn:0,
                               c:[0.13,0.34,0.62]});
IMAT.wetsand  = {bind:6.0e4, dens:2000};
GAMMA.wetsand = 12;  RAW.wetsand = [0.001, 0.02];
THERM.wetsand = {c:1200, melt:1700, L:1.4e5};
IMAT.leaf  = {bind:4.0e4, dens:120};
GAMMA.leaf = 30;                       // a leaf tears with almost nothing
RAW.leaf   = [0.05, 4];                // shreds to whole leaves, grams
THERM.leaf = {c:1900, melt:250, L:0};  // chars

/* ---------------------------------------------------------------------------
   THE REGISTRY
   ---------------------------------------------------------------------------
   Voxels say what a thing is MADE OF. This says what the things ARE. One
   structure owns a set of voxels, and it is the structure — not the voxel —
   that has a disassembly threshold, because breaking something into pieces is
   a property of the whole. */
class Structures {
  constructor(){ this.list=[]; this.byVox=new Map(); }
  add(name, mat, voxels){
    const id = this.list.length;
    const s = {id, name, mat, n:voxels.length, alive:true, damage:0,
               threshold: voxels.length * voxelCost(mat)};
    this.list.push(s);
    for (const v of voxels) this.byVox.set(v, id);
    return s;
  }
  at(v){ const i=this.byVox.get(v); return i===undefined ? null : this.list[i]; }
  /* Deliver fracture energy to a structure. It comes apart when its own
     threshold is met, and not before, however many small hits it takes. */
  hit(s, fractureJ){
    if (!s || !s.alive) return 'gone';
    s.damage += fractureJ;
    if (s.damage < s.threshold*0.02) return 'nothing';
    if (s.damage < s.threshold) return 'scratch';
    s.alive = false;
    return 'disassemble';
  }
  totals(){
    const t={};
    for (const s of this.list){
      const k=s.mat; t[k] = t[k] || {count:0, voxels:0, J:0};
      t[k].count++; t[k].voxels+=s.n; t[k].J+=s.threshold;
    }
    return t;
  }
}

/* ---------------------------------------------------------------------------
   BUILDING IT
   ---------------------------------------------------------------------------
   Everything is placed by a rule rather than by hand, so the island can be
   reseeded and stay the same KIND of place. Heights come from shape.js's idea
   of fractal roughness when it is loaded; a plain sum of sines when it is not,
   because this page has to run on its own. */
function islandWorld(W, H, D, seed){
  let s = (seed||7)>>>0;
  const rnd = () => ((s = (s*1664525 + 1013904223)>>>0)/4294967296);
  const w = new World({x0:0,y0:0,z0:0,x1:W-1,y1:H-1,z1:D-1});
  const St = new Structures();
  const idx = (x,y,z) => (y*D + z)*W + x;

  const cx = W/2, cz = D/2;
  const SEA = Math.floor(H*0.34);                 // water line
  const R   = Math.min(W,D)*0.30;                 // the rock mass

  /* Height of the rock at (x,z): a dome, roughened by a few octaves so the
     shore is ragged rather than a circle. */
  const oct = [];
  for (let i=0;i<4;i++) oct.push({f:0.7+i*1.9, a:1/(1+i*2.1), px:rnd()*99, pz:rnd()*99});
  function rockTop(x,z){
    const dx=(x-cx)/R, dz=(z-cz)/R;
    const d = Math.sqrt(dx*dx+dz*dz);
    if (d > 1.35) return -1;
    let rough = 0;
    for (const o of oct)
      rough += o.a*Math.sin((x/W)*o.f*6.283+o.px)*Math.cos((z/D)*o.f*6.283+o.pz);
    const dome = Math.cos(Math.min(d,1)*Math.PI/2);
    return SEA + (dome*H*0.30 + rough*H*0.05) - (d>1 ? (d-1)*H*0.5 : 0);
  }

  /* 1. SALT WATER EVERYWHERE FIRST, to the sea line. The island is then
        carved up out of it, which is the order that leaves a real shoreline
        instead of a rim of gaps. */
  for(let y=0;y<SEA;y++) for(let z=0;z<D;z++) for(let x=0;x<W;x++) w.set(x,y,z,SALTWATER);

  /* 2. THE ISLAND, AND IT IS SAND ALL THE WAY DOWN. Wet where the sea can
        reach it — below the water line, and a little above it, because a beach
        is damp above the tide from capillary rise rather than from splashing.
        Dry sand above that. No rock anywhere: this is a sandbank, and if it
        stands at all it stands because the wet part underneath it holds. */
  const WETBAND = H*0.10;
  for(let z=0;z<D;z++) for(let x=0;x<W;x++){
    const top = rockTop(x,z);
    if (top < 0) continue;
    for (let y=0;y<=top && y<H; y++){
      /* wet if it is under the sea, or within the capillary band above it */
      w.set(x,y,z, (y < SEA + WETBAND*0.35) ? WETSAND : SAND);
    }
  }

  /* 3. THE HOLE IN THE GROUND. A rough sphere bitten out of the rock, off
        centre, open to the sky — the way out. */
  const hx = cx + R*0.35, hz = cz - R*0.2;
  const htop = rockTop(hx,hz), hr = R*0.34;
  let holeVox = 0;
  for (let y=0;y<H;y++) for (let z=0;z<D;z++) for (let x=0;x<W;x++){
    const dx=x-hx, dy=(y-(htop-hr*0.35))*1.15, dz=z-hz;
    const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
    if (d < hr*(0.8+0.35*Math.sin(x*0.7)*Math.cos(z*0.6))){
      if (w.at(x,y,z) !== AIR){ w.set(x,y,z, y < SEA ? SALTWATER : AIR); holeVox++; }
    }
  }

  /* 4. THE TREE. Trunk, then a crown of leaf clusters, and EVERY CLUSTER IS
        ITS OWN STRUCTURE — which is the thing this whole file exists to
        demonstrate. Shoot the crown and you take out what you hit. */
  const tx = Math.round(cx - R*0.45), tz = Math.round(cz + R*0.3);
  const tbase = Math.round(rockTop(tx,tz));
  const th = Math.round(H*0.42), trunkR = 4.0;
  const trunk = [];
  const put = (X,Y,Z) => {
    if (X<0||Y<0||Z<0||X>=W||Y>=H||Z>=D) return;
    if (w.at(X,Y,Z) !== AIR && w.at(X,Y,Z) !== LEAF) return;
    w.set(X,Y,Z,WOOD); trunk.push(idx(X,Y,Z));
  };
  for (let y=tbase; y<tbase+th && y<H; y++){
    const f = (y-tbase)/th;
    const r = trunkR*(1 - 0.5*f);
    const lean = f*th*0.06;
    for (let z=-6;z<=6;z++) for (let x=-6;x<=6;x++){
      if (x*x+z*z > r*r) continue;
      put(Math.round(tx+x+lean), y, Math.round(tz+z));
    }
  }

  /* BRANCHES, and they are not decoration. The first version scattered leaf
     clusters up to four metres from the trunk with nothing joining them, and
     the vision review caught exactly that: "a leaf cluster is floating
     isolated in mid-air far from the tree trunk". It was right. Foliage hangs
     on something, so the something has to exist — and once it does, the crown
     is a set of clusters at the ENDS OF BRANCHES rather than a cloud of blobs
     near a pole. */
  const crownY = tbase + Math.round(th*0.62);
  const arms = [];
  for (let b=0;b<9;b++){
    const a = (b/9)*Math.PI*2 + rnd()*0.5;
    const rise = 0.35 + rnd()*0.5;
    const len  = R*(0.22 + rnd()*0.16);
    const y0   = crownY + Math.round(rnd()*th*0.28);
    let X=tx, Y=y0, Z=tz;
    for (let t=0;t<len;t++){
      X = tx + Math.cos(a)*t;
      Z = tz + Math.sin(a)*t;
      Y = y0 + t*rise;
      const br = Math.max(1, 2.0*(1-t/len));
      for (let dz=-2;dz<=2;dz++) for (let dx=-2;dx<=2;dx++) for (let dy=-2;dy<=2;dy++){
        if (dx*dx+dy*dy+dz*dz > br*br) continue;
        put(Math.round(X+dx), Math.round(Y+dy), Math.round(Z+dz));
      }
    }
    arms.push({x:X, y:Y, z:Z});
  }
  St.add('trunk', 'wood', trunk);

  /* Leaf clusters, hung on the arms: three or four to each, bunched around the
     tip so the crown reads as one canopy made of separable handfuls. Each is
     still its OWN structure — that is the whole point — but now none of them
     is anywhere the tree is not. */
  const clusters = [];
  let cid = 0;
  for (const arm of arms){
    for (let k=0;k<4;k++){
      const br = 3.0 + rnd()*2.6;
      const bx = arm.x + (rnd()-0.5)*br*1.6;
      const by = arm.y + (rnd()-0.2)*br*1.1;
      const bz = arm.z + (rnd()-0.5)*br*1.6;
      const vox = [];
      for (let y=Math.floor(by-br); y<=by+br; y++)
        for (let z=Math.floor(bz-br); z<=bz+br; z++)
          for (let x=Math.floor(bx-br); x<=bx+br; x++){
            if (x<0||y<0||z<0||x>=W||y>=H||z>=D) continue;
            const dx=x-bx, dy=(y-by)*1.25, dz=z-bz;
            if (dx*dx+dy*dy+dz*dz > br*br) continue;
            if (w.at(x,y,z) !== AIR) continue;
            w.set(x,y,z,LEAF); vox.push(idx(x,y,z));
          }
      if (vox.length > 4) clusters.push(St.add('leaf'+(cid++), 'leaf', vox));
    }
  }

  return {w, St, SEA, R, hole:{x:hx,z:hz,r:hr,vox:holeVox},
          tree:{x:tx,z:tz,base:tbase,h:th, clusters:clusters.length}};
}
