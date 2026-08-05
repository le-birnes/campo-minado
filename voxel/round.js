/* ============================================================================
   THE ROUND — a directed charge, and what KIND of energy it delivers
   ============================================================================
   Marcelo: "Think like a directional blow of tnt, like a rocket muzzle burning
   fuel. Sand that stood there would be heated if said blast is fire but pushed
   if blast is just energy. So energy type matters ... heated pellets, made of
   steel encapsulated tnt tips, which blow towards the inside of the cube it
   hits ... I want destruction to happen voxel by voxel when shots happen."

   Three things this file adds to impact.js, and the first is the big one.

   1. ENERGY HAS A KIND. Up to now a hit was a number of joules and the joules
      did one thing. They do not. The same 110 kJ into the same sand is a
      crater if it arrives as pressure and a lump of glass if it arrives as
      heat, and a round is defined as much by its MIX as by its size:

        FRACTURE  breaks bonds. Makes RAW.
        KINETIC   pushes and throws. Makes debris and shoves bodies.
        THERMAL   heats. Chars, ignites, melts — and melted sand is glass.

      The mix is a property of the round, not of the world, so an incendiary
      and a slug can carry identical energy and do nothing alike.

   2. IT IS A JET, NOT A BALL. A rocket muzzle is the right picture: the charge
      is backed by a steel case that will not give, so the gas goes one way.
      That means a divergence angle rather than a radius, and a divergence
      angle means DEPTH — a narrow jet drills, a wide one scoops. It is also
      what puts a hole through a tree instead of felling it.

   3. DESTRUCTION IS PER VOXEL. The unit of destruction is one voxel coming
      apart into RAW, and that has a price: gamma times the surface made by
      breaking THAT MUCH material into fragments of THAT size. Everything else
      — how deep the hole is, how many shots take a block — is that price
      divided into the budget. No block-level special case anywhere.
   ========================================================================== */

/* Wood, because a tree is the case that makes the jet worth having. Tough
   across the grain, light, and it chars rather than melting. */
IMAT.wood   = {bind:8.0e5, dens:600};
GAMMA.wood  = 4000;                       // wood is hard to tear, easy to crush
RAW.wood    = [1, 200];                   // splinters to billets, grams
THERM.wood  = {c:1700, melt:300, L:0};    // "melt" is char point; no latent heat

/* What one voxel costs to take apart into its coarsest RAW. THIS is the unit
   of destruction, and every other number below is this one divided into a
   budget. Sand is nearly free because sand is already RAW — there is nothing
   to fracture, only something to move. */
function voxelCost(mat, g){
  const v = g||G_CELL;
  const massKg = IMAT[mat].dens * v*v*v;
  return GAMMA[mat] * fractureArea(mat, massKg, RAW[mat][1]);
}

/* ---------------------------------------------------------------------------
   THE ROUNDS
   ---------------------------------------------------------------------------
   THE MIX NUMBERS ARE CHOSEN, and that is said plainly rather than buried:
   real TNT puts roughly a third of its energy into blast and carries a large
   thermal tail, and how much of the blast ends up breaking versus throwing
   depends on what it is against. These are a starting split that behaves
   sensibly, and they are in one table so they can be argued with. */
const ROUNDS = {
  buck: {
    name : 'steel-cased TNT tip, heated',
    pellets: 8, tntG: 3, caseG: 2,
    mix  : {frac:0.35, kin:0.45, therm:0.20},
    jetDeg: 7,                             // the case holds, so it barely spreads
    r0   : 2                               // voxels: the footprint it opens on
  },
  incend: {
    name : 'incendiary — same charge, almost all of it heat',
    pellets: 8, tntG: 3, caseG: 2,
    mix  : {frac:0.10, kin:0.15, therm:0.75},
    jetDeg: 14, r0: 3
  },
  slug: {
    name : 'solid slug — no charge at all, pure momentum',
    pellets: 1, tntG: 0, caseG: 32,
    mix  : {frac:0.30, kin:0.70, therm:0.00},
    jetDeg: 3, r0: 1
  }
};
function roundEnergy(r){
  const kin = 0.5*(r.caseG/1000)*r.pellets*101*101;   // the game's pellet speed
  return r.pellets*(r.tntG/1000)*TNT_J_PER_KG + kin;
}

/* ---------------------------------------------------------------------------
   THE JET — voxel by voxel, layer by layer, into the face it hit
   ---------------------------------------------------------------------------
   Advance one voxel layer at a time along the face normal. Each layer is a
   disc whose radius grows with the divergence angle, so the same budget drills
   far through a narrow jet and scoops a bowl through a wide one. Spend the
   FRACTURE share on taking those voxels apart; stop when a layer cannot be
   paid for, or when the material runs out — which is the hole through the tree.

   Nothing here knows what a block is. It removes voxels until the budget is
   gone, which is what "destruction happens voxel by voxel" has to mean. */
function jet(mat, round, depthVox, g){
  const v = g||G_CELL;
  const div = 16;                                    // voxels across a block
  const RMAX = div/2;                                // NO SPREAD: never past the face
  const deep = depthVox === undefined ? div : depthVox;
  const E = roundEnergy(round);
  const cost = voxelCost(mat, v);
  let budget = E*round.mix.frac;
  const tan = Math.tan(round.jetDeg*Math.PI/180);
  const layers = [];
  let removed = 0, d = 0;
  /* Drill: one layer at a time, the disc widening with the divergence angle
     but CLAMPED at the face. The clamp is the containment — a jet that would
     spread wider than the block it hit simply does not. */
  while (d < deep){
    const r = Math.min(round.r0 + d*tan, RMAX);
    const n = Math.max(1, Math.round(Math.PI*r*r));
    if (budget < n*cost) break;
    budget -= n*cost; removed += n;
    layers.push({d, r, n});
    d++;
  }
  const through = d >= deep;
  /* If it reached the far side with budget to spare, the rest does NOT carry
     on into whatever is behind — that is the whole point of containing it. It
     widens what it already opened, up to the whole of this structure. */
  const capacity = deep*div*div;
  let widened = 0;
  if (through && budget >= cost){
    widened = Math.min(Math.floor(budget/cost), capacity - removed);
    budget -= widened*cost; removed += widened;
  }
  return {
    E, removed, depth:d, through, layers, widened,
    consumed: removed >= capacity,                   // the structure is gone
    holeR: Math.min(round.r0 + Math.max(0,d-1)*tan, RMAX)*v,
    mouthR: round.r0*v,
    left: budget, cost, capacity
  };
}

/* ---------------------------------------------------------------------------
   WHAT THE OTHER TWO SHARES DO
   ---------------------------------------------------------------------------
   Kinetic throws whatever the fracture share freed; thermal heats it. Both act
   on the SAME removed voxels, which is why the mix matters: the identical
   round with the shares swapped fuses what it would otherwise have scattered. */
function kineticOf(mat, round, removedVox, g){
  const v = g||G_CELL;
  const m = removedVox * IMAT[mat].dens * v*v*v;
  if (m <= 0) return {speed:0, flight:0, massKg:0};
  const Ek = roundEnergy(round)*round.mix.kin;
  const speed = Math.sqrt(2*Ek/m);
  return {speed, flight:2*speed/9.81, massKg:m};
}
function thermalOf(mat, round, removedVox, g){
  const v = g||G_CELL;
  const t = THERM[mat];
  const m = removedVox * IMAT[mat].dens * v*v*v;
  const Et = roundEnergy(round)*round.mix.therm;
  if (!t || m <= 0) return {rise:0, fusedKg:0, massKg:m, reached:20};
  const rise = Et/(m*t.c);                            // if it all went in evenly
  const perKg = t.c*(t.melt-20) + t.L;
  /* Evenly spread it may not reach the change point at all; concentrated at the
     mouth it certainly does. Both are reported because the difference IS the
     answer to "almost turns sand to glass". */
  return {rise, reached:20+rise, fusedKg:Et/perKg, massKg:m,
          allMelts: (20+rise) >= t.melt};
}
