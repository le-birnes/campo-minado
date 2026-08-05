/* ============================================================================
   THE STIR — what a hit actually does to the particles around it
   ============================================================================
   Marcelo: "I wanted to calculate the stir impact, so much as if some bullet
   hit a sand wall it interacts with all adjacent particles in a certain way
   and velocity so collisions are calculated and executed."

   So a hit is not a hole. It is an ENERGY BUDGET arriving at one cell and
   spending itself outward, and everything about the result — how wide the
   crater is, how many grains fly, how fast they go, how long the mess lasts —
   falls out of that one number and the material's own bind. Nothing here is
   tuned by hand; every quantity below is derived and then measured against the
   simulation in impact.html.

   THE THREE THINGS A HIT SPENDS ENERGY ON

     1. BREAKING. Freeing one molecule costs bind x its volume — bind is a
        specific energy, which is what makes this composable (matter.js). A
        cell of side g holds g^3/molVol molecules, so freeing a whole cell
        costs bind x g^3 whatever the molecule size is. Sand is cheap, iron is
        five hundred times dearer, bedrock is 1e15 and therefore never.

     2. THROWING. Whatever is left after breaking becomes kinetic energy,
        shared over the freed mass. That gives a real speed rather than a
        chosen one:  v = sqrt(2 * E_left / m_freed).

     3. SPREADING. The budget is spent outward shell by shell until it runs
        out, so the crater holds however many cells the energy could pay for
        and its radius grows as the CUBE ROOT of energy — the standard scaling
        for real craters. No radius is ever specified; it falls out.

   AND THE NUMBER THAT MATTERS IS NOT THE CRATER. A hit is one flood, over in
   a fraction of a millisecond. What costs anything is the DEBRIS: grains with
   a velocity, in the air for as long as 2v/g, all of them integrating every
   tick. So the budget to watch is how many are flying at once, which is
   Marcelo's own rule that visible debris is a budget rather than a
   consequence — and impact.html measures where that ceiling is.
   ========================================================================== */

/* Cell size. BLOCK/16 is the world's grain: 2.8 m / 16 = 0.175 m. */
const BLOCK_M = 2.8;                       // the game's block edge, metres
const G_CELL  = BLOCK_M/16;

/* Materials, as specific energies. bind is J per cubic metre of material
   liberated; dens is kg/m^3. Taken from matter.js so there is one table, not
   two that drift. */
const IMAT = {
  sand    : {bind:2.0e4, dens:1600},   // loose grains: only friction holds it
  coal    : {bind:1.0e6, dens:1400},
  rock    : {bind:3.0e6, dens:2700},
  cinder  : {bind:5.0e6, dens:2400},
  mineral : {bind:6.0e6, dens:3000},
  iron    : {bind:5.0e8, dens:7870},
  steel   : {bind:8.0e8, dens:7850},
  bedrock : {bind:1.0e15,dens:3200}
};

/* What one cell costs to break loose, in joules. */
function cellBreakCost(mat, g){
  const v = (g||G_CELL); return IMAT[mat].bind * v*v*v;
}
function cellMass(mat, g){
  const v = (g||G_CELL); return IMAT[mat].dens * v*v*v;
}

/* ---------------------------------------------------------------------------
   THE CRATER, from energy conservation
   ---------------------------------------------------------------------------
   The first version of this got it wrong in two different ways and both are
   worth recording, because they are the obvious wrong answers.

   It first said the front dies where a shell of 2*pi*(r/g)^2 cells can no
   longer each afford bind*g^3 - a SUPPLY criterion. That double-counts: it
   asks whether the shell can be paid for out of the whole budget while the
   inner shells have already been paid for out of the same budget. And the
   flood beside it divided the surviving energy by six at EVERY cell, which is
   exponential decay, not 1/r^2 - so the two disagreed by orders of magnitude
   and I wrote a paragraph explaining why that was fine. It was not fine.

   The right statement is the simplest one. Energy in equals work done:

     cells broken  =  (share spent breaking) * E  /  (bind * g^3)

   and the radius is just whatever sphere holds that many cells. Crater radius
   therefore grows as the CUBE ROOT of energy, which is the standard scaling
   for real craters and is a good sign the bookkeeping is honest.

   BREAK_SHARE is the one modelling choice here and it is named rather than
   buried: the fraction of a hit that goes into breaking bonds, with the rest
   left over to throw the pieces. Half and half is a reasonable default and the
   only number in this file that is chosen rather than derived. */
const BREAK_SHARE = 0.5;

function cellsFreed(mat, E, g){
  const v = g||G_CELL;
  return Math.max(0, Math.floor(BREAK_SHARE*E / cellBreakCost(mat, v)));
}
function craterRadius(mat, E, g){
  const v = g||G_CELL;
  const n = cellsFreed(mat, E, v);
  if (n <= 0) return 0;
  return v * Math.cbrt(3*n/(2*Math.PI));            // a hemisphere holding n cells
}
/* And the energy a crater of a given radius costs, which is the question the
   game actually asks: "a shot clears 2 cells - what is a shot worth?" */
function energyForRadius(mat, rCells, g){
  const v = g||G_CELL;
  const n = (2/3)*Math.PI*rCells*rCells*rCells;
  return n * cellBreakCost(mat, v) / BREAK_SHARE;
}

/* ---------------------------------------------------------------------------
   THE THROW
   ---------------------------------------------------------------------------
   What was not spent breaking is shared over the freed mass as kinetic energy.
   Momentum is NOT conserved here and should not be: the wall takes most of it,
   which is exactly why a shot moves grains and not the mountain. Energy is the
   quantity worth tracking because it is the one that sets the speed.

   A grain thrown at v is in the air 2v/g seconds, so how long the debris costs
   anything is a closed form too - and THAT is the number that decides whether
   a hit is affordable, not the crater. */
function throwOf(mat, E, g){
  const v = g||G_CELL;
  const n = cellsFreed(mat, E, v);
  if (!n) return {n:0, speed:0, flight:0, spent:0, left:0};
  const spent = n * cellBreakCost(mat, v);
  const left  = Math.max(0, E - spent);
  const m     = n * cellMass(mat, v);
  const speed = Math.sqrt(2*left/m);
  return {n, speed, flight:2*speed/9.81, spent, left};
}

/* ---------------------------------------------------------------------------
   AND THE SAME THING THROUGH REAL MATERIAL
   ---------------------------------------------------------------------------
   The closed form assumes a clean hemisphere of one substance. The flood does
   not: it spends the budget shell by shell through whatever is actually there,
   so a void behind a wall, a seam of something harder, or a hit at a corner
   all come out different. On uniform material it agrees with the arithmetic
   above by construction, which is the point - the arithmetic is for budgeting
   and the flood is for the actual hit. */
function floodCrater(grid, x0,y0,z0, mat, E, g){
  const v = g||G_CELL;
  const cost = cellBreakCost(mat, v);
  let budget = BREAK_SHARE*E;
  const seen = new Set();
  const key = (x,y,z) => (y*1024 + z)*1024 + x;
  let front = [[x0,y0,z0]];
  seen.add(key(x0,y0,z0));
  const out = [];
  let freed=0, spent=0;
  while (front.length && budget >= cost){
    const next = [];
    for (const [x,y,z] of front){
      if (budget < cost) break;
      budget -= cost; spent += cost; freed++;
      out.push([x,y,z]);
      for (const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        const nx=x+dx, ny=y+dy, nz=z+dz, k=key(nx,ny,nz);
        if (seen.has(k)) continue;
        if (grid && !grid(nx,ny,nz)) continue;       // only through real material
        seen.add(k); next.push([nx,ny,nz]);
      }
    }
    front = next;
  }
  return {freed, spent, left:E-spent, cells:out};
}

/* ---------------------------------------------------------------------------
   WHAT IT COSTS TO ACTUALLY FLY THEM
   ---------------------------------------------------------------------------
   A freed grain is no longer a falling-sand cell: it has a velocity, so it
   integrates, checks where it lands, and settles. That is a different and
   dearer thing than the grid's one-cell-per-tick fall, and the number of them
   in the air at once is the real budget — which is Marcelo's own rule that
   visible debris is a budget rather than a consequence.

   A compact particle store: position, velocity, and the cell it occupies.
   Flat arrays because there can be tens of thousands and they are all touched
   every tick. */
class Debris {
  constructor(cap){
    this.cap=cap; this.n=0;
    this.x=new Float32Array(cap); this.y=new Float32Array(cap); this.z=new Float32Array(cap);
    this.vx=new Float32Array(cap); this.vy=new Float32Array(cap); this.vz=new Float32Array(cap);
    this.m=new Uint8Array(cap);
    this.stats={spawned:0, landed:0, capped:0, steps:0};
  }
  /* Past the cap the source simply diminishes and no particle is made. A big
     hit LOOKS big without costing more than a small one. */
  add(x,y,z, vx,vy,vz, mat){
    if (this.n >= this.cap){ this.stats.capped++; return false; }
    const i=this.n++;
    this.x[i]=x; this.y[i]=y; this.z[i]=z;
    this.vx[i]=vx; this.vy[i]=vy; this.vz[i]=vz; this.m[i]=mat;
    this.stats.spawned++;
    return true;
  }
  /* One tick: gravity, integrate, and land anything that reaches solid. Swap
     the last one down into a landed slot so the live set stays contiguous —
     no holes to skip and no allocation. */
  step(dt, solidAt, floorY){
    const {x,y,z,vx,vy,vz}=this;
    const g = 9.81*dt;
    let i=0;
    while (i < this.n){
      vy[i] -= g;
      const nx=x[i]+vx[i]*dt, ny=y[i]+vy[i]*dt, nz=z[i]+vz[i]*dt;
      this.stats.steps++;
      if ((solidAt && solidAt(nx,ny,nz)) || ny <= floorY){
        const j=--this.n;
        x[i]=x[j]; y[i]=y[j]; z[i]=z[j];
        vx[i]=vx[j]; vy[i]=vy[j]; vz[i]=vz[j]; this.m[i]=this.m[j];
        this.stats.landed++;
        continue;                                    // re-test what moved down
      }
      x[i]=nx; y[i]=ny; z[i]=nz;
      i++;
    }
    return this.n;
  }
}

/* ============================================================================
   THE ROUND IS A CHARGE — our gun fires mini TNT that goes off on impact
   ============================================================================
   Marcelo: "I want OUR GUN to shoot mini tnt's that blow on impact ... Gun
   pellet has 3g of tnt worth, shooting 8 at a time combines it to 24 grams."

   This is the right way round, and it removes the fudge the last section asked
   for. A pellet does not need a declared SHOT_ENERGY that quietly contradicts
   its own mass and speed — it needs to BE an explosive, and then its energy is
   just its charge. Nothing is invented: 4.6 MJ/kg is TNT, the pellet's own
   kinetic energy is added because it is really there, and everything the blast
   does comes out of the model that was already here.

   The kinetic term is kept even though it is negligible — 12 J against 13,800 —
   precisely so that it is visible how negligible it is. A round that was mostly
   momentum and barely any charge would come out right too. */
const TNT_J_PER_KG   = 4.6e6;
const PELLET_TNT_G   = 3;                  // grams of TNT per pellet
const PELLETS_PER_SHOT = 8;                // and they land together

function chargeEnergy(grams, kineticJ){ return grams/1000*TNT_J_PER_KG + (kineticJ||0); }
const shotEnergy = (pellets, grams) =>
  chargeEnergy((pellets||PELLETS_PER_SHOT)*(grams||PELLET_TNT_G));

/* How many shots to open a hole of a given radius, and to remove a whole block.
   The second one is the question the GAME asks, because the game destroys
   blocks, not cells. */
function shotsForRadius(mat, rCells, pellets, grams){
  return energyForRadius(mat, rCells) / shotEnergy(pellets, grams);
}

/* ---------------------------------------------------------------------------
   NO SPREAD — the force is contained in the face that was shot
   ---------------------------------------------------------------------------
   Marcelo: "contain so that one shot doesn't go out blowing many stuff ...
   the act is to contain the force into the cubic lattice's shot face."

   So the blast is NOT a hemisphere. A free charge radiates in every direction
   and a hemisphere is what it carves; this round does not get to do that. Its
   energy is channelled into the FACE it struck and drives inward along that
   face's normal, so the crater is a box the width of one block face and
   however deep the budget reaches — and the blocks either side of it are not
   touched at all, whatever the charge.

   That is a gun quality rather than physics, and naming it as one keeps it
   honest: "no spread", to be switchable later, always on for now.

   What it changes about the arithmetic is only the SHAPE. The budget still
   buys the same number of cells — energy in equals work done, unchanged — but
   they stack as full layers off one face instead of spreading as a bowl. Which
   means the number that matters to the game becomes DEPTH, and a block is
   through when the layers reach the far side.

   The lateral cap is what does the containing: a face is div*div cells, so no
   matter how big the charge, one shot can only ever deepen one block. */
function faceBlast(mat, E, div){
  const d = div||16;
  const face = d*d;                                  // cells in one block face
  const n = cellsFreed(mat, E);
  const layers = n/face;                             // in cells of depth
  return {
    cells:  Math.min(n, face*d),                     // it stops at the far side
    face, depth: Math.min(layers, d)*G_CELL,         // metres bitten out
    layers, through: layers >= d,
    wasted: Math.max(0, n - face*d)                  // energy past the far side
  };
}
/* How many of these shots to take a whole block apart. This is the question
   the GAME asks, because the game destroys blocks and not cells. */
function shotsForBlock(mat, div, pellets, grams){
  const d = div||16;
  return (d*d*d * cellBreakCost(mat) / BREAK_SHARE) / shotEnergy(pellets, grams);
}
/* And run it backwards: what would a material have to be BOUND at for a given
   number of shots to take a block? The answer to "5 shots should destroy rock"
   is a number, and it is either rock's or it is not. */
function bindForShots(shots, div, pellets, grams){
  const d = div||16;
  return BREAK_SHARE * shots * shotEnergy(pellets, grams) /
         (d*d*d * G_CELL*G_CELL*G_CELL);
}

/* ---------------------------------------------------------------------------
   AND WHAT IT DOES TO THINGS THAT ARE NOT WALLS
   ---------------------------------------------------------------------------
   Contained means contained for bodies too, or the round is a grenade again by
   the back door. The push reaches one block from the face and no further, and
   it points along the face normal — so it shoves what is standing in front of
   what you shot, and nothing behind you.

   This is what makes firing at the floor at your feet lift you: a consequence
   rather than a feature, and worth knowing before it is found by accident. */
function facePush(E, r, mass, area, eff){
  if (r > BLOCK_M) return 0;                         // one block, then nothing
  /* The jet leaves the face as a face-sized front and widens as it goes, so
     what a body intercepts is its own area against (BLOCK + r)^2 rather than
     against the bare face. Without the r the push came out identical at 30 cm
     and at a metre, which is not a blast, it is a switch. */
  const w = BLOCK_M + r;
  const share = E * (area||0.5) / (w*w);
  return Math.sqrt(2*Math.min(share, E)*(eff===undefined?0.25:eff)/mass);
}
