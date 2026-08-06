/* ============================================================================
   WHAT THINGS ARE MADE OF — blocks, mines, and what comes out when they go
   ============================================================================
   Marcelo: "Mines are iron with gunpowder (potassium nitrate (saltpeter),
   charcoal, and sulfur ... these elements don't exist in noita so just add
   them ... blocks are all made of sand (dirt), meaning its a block made of
   sand and some rocks, randomly composed, and even some water, that when blown
   to smithereens releases vapor (some of the water + heat) and scatters most
   of its internal materials, and if heat is enough the sand parts become
   irregular glass."

   So a block stops being "a block" and becomes a RECIPE. Two consequences and
   both are the point:

     - no two blocks are the same. One is 70% sand and damp; the one beside it
       has a seam of rock through it and is bone dry. What a shot gets out of
       them differs because what went in differs.
     - what comes OUT is derived, never authored. Water plus heat is vapour.
       Sand plus enough heat is glass. Rock is just rock, and it lands.

   GUNPOWDER IS THE ONE THAT IS NOT LIKE THE OTHERS. Everything else in the
   material table only ever ABSORBS energy - you spend joules to break it. A
   grain of powder RELEASES them, and the three products are the three things
   Marcelo named: energy in joules, heat, and noise. That makes a mine an
   energy SOURCE sitting inside the world, which is what makes shooting one
   different in kind from shooting a wall rather than merely worse.
   ========================================================================== */

/* --- the new elements. Noita has none of these; they are ours. ------------
   "for now just copy properties of powder rock except gunpowder blows" - so
   the three constituents are powder-rock-like and inert, and the mixture is
   not. Densities are real; bind and gamma follow rock's powder form. */
for (const [n, dens] of [['saltpeter', 2110], ['charcoal', 450], ['sulfur', 2070]]){
  IMAT[n]  = {bind: 3.0e6, dens};
  GAMMA[n] = 140;                       // rock's fracture energy, as instructed
  RAW[n]   = [0.001, 2];                // it is a powder: grains to lumps
  THERM[n] = {c: 790, melt: 1215, L: 4.0e5};
}
/* Gunpowder proper: 75 / 15 / 10 by mass, which is the classic ratio and not
   a number I picked. Its bind is what it costs to break the CAKE apart; its
   energy is what comes back out when it goes off, and the two are unrelated. */
const POWDER_MIX = {saltpeter: 0.75, charcoal: 0.15, sulfur: 0.10};
IMAT.gunpowder  = {bind: 8.0e5, dens: 1700};
GAMMA.gunpowder = 40;
RAW.gunpowder   = [0.0005, 1];
THERM.gunpowder = {c: 1000, melt: 200, L: 0};

/* Black powder is about 3 MJ/kg — roughly two thirds of TNT, and it deflagrates
   rather than detonating, so more of it ends up as heat and noise and less as
   shock. That split is what makes a mine feel like a mine and not a shell. */
const POWDER_J_PER_KG = 3.0e6;
const POWDER_MIX_OUT  = {frac: 0.25, kin: 0.35, therm: 0.40};

/* Glass, so the sand has somewhere to go. */
IMAT.glass  = {bind: 6.0e6, dens: 2500};
GAMMA.glass = 8;                        // brittle: it makes new surface cheaply
RAW.glass   = [0.05, 60];               // shards
THERM.glass = {c: 840, melt: 1500, L: 1.4e5};
IMAT.vapor  = {bind: 1, dens: 0.6};
GAMMA.vapor = 1; RAW.vapor = [1e-6, 1e-6];

/* --- a block is a recipe ---------------------------------------------------
   Sand with some rock through it and some water in it, mixed per block from
   the world seed so the composition is a property of the PLACE and survives
   being asked twice. */
function blockRecipe(seed){
  let s = (seed*2654435761 + 12345) >>> 0;
  const r = () => ((s = (s*1664525 + 1013904223) >>> 0) / 4294967296);
  const rock  = 0.05 + r()*0.35;                 // a seam, or barely any
  const water = r()*r()*0.18;                    // squared: mostly dryish
  const sand  = Math.max(0.05, 1 - rock - water);
  const t = sand + rock + water;
  return {sand: sand/t, rock: rock/t, water: water/t};
}
/* A mine: an iron shell around a powder core. The shell is why one day they
   can be CONTAINED — "not all will blow when they are shot" — because whether
   the core lights depends on whether the shell was opened, and the shell has
   its own threshold like anything else. */
function mineRecipe(){
  return {shell: {iron: 1.0}, core: POWDER_MIX, shellFrac: 0.35};
}

/* --- what a hit gets out of it -------------------------------------------
   Given a block's recipe, a volume and the energy delivered by kind, work out
   what actually comes off it. Nothing here is authored: vapour is the water
   that got hot enough, glass is the sand that got hot enough, and the rest
   scatters as RAW. */
function blockYield(recipe, volumeM3, mix, E){
  const out = {vapor: 0, glass: 0, sand: 0, rock: 0, water: 0, glassFrac: 0};
  /* Water has no entry in IMAT and should not have one: IMAT is the table of
     things you BREAK, and you do not fracture water. Its density is named here
     rather than faked into that table, where it would have needed a bind and a
     gamma that mean nothing. */
  const DENS = {sand: IMAT.sand.dens, rock: IMAT.rock.dens, water: 1000};
  const massOf = k => volumeM3 * DENS[k] * recipe[k];
  const mSand = massOf('sand'), mRock = massOf('rock'), mWater = massOf('water');
  const Etherm = E * mix.therm;

  /* WATER FIRST, and it goes first for a physical reason rather than a coded
     one: boiling it is far cheaper per kilogram than melting sand, so the heat
     is spent there before anything vitrifies. A damp block therefore makes
     steam and NO glass, which is the right answer and falls out of the order
     rather than being written down as a rule. */
  const boilPerKg = 4186*(100-20) + 2.26e6;      // heat to 100 C, then latent
  const canBoil = Math.min(mWater, Etherm/boilPerKg);
  out.vapor = canBoil;
  out.water = mWater - canBoil;
  let left = Etherm - canBoil*boilPerKg;

  /* THEN THE SAND. Whatever heat survived the water fuses what it can reach. */
  const fusePerKg = THERM.sand.c*(THERM.sand.melt-20) + THERM.sand.L;
  const fused = Math.min(mSand, Math.max(0, left)/fusePerKg);
  out.glass = fused;
  out.sand  = mSand - fused;
  out.glassFrac = mSand > 0 ? fused/mSand : 0;

  /* Rock does not care. It is not going to melt and it is not going to boil;
     it comes off as rock and lands. */
  out.rock = mRock;
  return out;
}

/* --- and a mine, which gives energy back ---------------------------------
   The three products Marcelo named, from one number. Noise is reported in
   decibels at a metre because that is the unit a game can actually use for
   "how far away did that get heard", and it comes from the acoustic share
   rather than being a separate dial. */
function detonate(coreMassKg){
  const E = coreMassKg * POWDER_J_PER_KG;
  const kin   = E * POWDER_MIX_OUT.kin;
  const therm = E * POWDER_MIX_OUT.therm;
  const frac  = E * POWDER_MIX_OUT.frac;
  /* A few percent of the energy leaves as sound. Referenced to 1 pW, at 1 m,
     over the millisecond or so it takes to get out. */
  const acoustic = E * 0.02;
  const watts = acoustic / 0.001;
  const dB = 10*Math.log10(watts / (4*Math.PI*1e-12));
  return {E, frac, kin, therm, acoustic, dB,
          /* how far off it is still above a threshold, inverse square */
          heardAt: d => dB - 20*Math.log10(Math.max(d,1))};
}
/* Does the shell open? A mine only lights if the hit got THROUGH the iron, so
   a glancing shot leaves it armed — which is the hook for "one day will be
   able to be blown and contained so not all will blow when they are shot". */
function mineHit(volumeM3, fractureJ){
  const m = mineRecipe();
  const shellVol = volumeM3 * m.shellFrac;
  const shellMass = shellVol * IMAT.iron.dens;
  const need = GAMMA.iron * fractureArea('iron', shellMass, RAW.iron[1]);
  const coreMass = volumeM3 * (1-m.shellFrac) * IMAT.gunpowder.dens;
  return fractureJ >= need
    ? {opened: true,  need, blast: detonate(coreMass)}
    : {opened: false, need, short: need - fractureJ};
}
