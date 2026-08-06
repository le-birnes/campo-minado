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
   THE dB IS GONE, and deleting it rather than clamping it is the point.

   The first version reported 208 dB at a metre. The ceiling for a sound wave
   in air at one atmosphere is about 194: sound is pressure oscillating around
   ambient, so a wave whose amplitude reaches ambient has its rarefaction half
   touching absolute vacuum, and there is no less air than none. 208 dB is not
   a loud sound, it is a number produced by applying an acoustic formula to
   something that is not acoustics.

   PAST THAT CEILING IT IS A SHOCK, and a shock is a different animal:
     - the negative half clips at vacuum while the positive half does not, so
       the wave goes asymmetric - a sharp spike with a long suction tail
     - compression heats the air, hot air carries sound faster, the peak
       overtakes its own front and the leading edge steepens into a true
       discontinuity travelling faster than sound
     - it decays far faster than 1/r, because it burns energy irreversibly
       heating everything it passes through
     - the air itself MOVES: bulk flow, not oscillation. That is what throws
       things, and dB has nothing to say about it.

   So blast is overpressure and impulse, and dB only comes back once the shock
   has decayed BELOW the ceiling and become an ordinary sound the AI can hear
   across a level. Two regimes with one crossover, and the crossover is
   physical rather than chosen.

   THE SCALING LAW IS THE PRIZE. Sadovsky: everything depends on
        Z = R / W^(1/3)
   distance over the CUBE ROOT of charge mass - the same cube root that governs
   crater radius in impact.js, and for the same reason: energy spreading
   through a volume. So doubling a mine's lethal radius costs eight times the
   powder, and blast and destruction stay consistent for free. */
const P_ATM = 101.325;                  // kPa
const DB_CEILING = 194;                 // where a sound wave runs out of medium
const TNT_EQUIV_POWDER = 3.0/4.6;       // black powder against TNT, by energy

/* Sadovsky's correlation for a free-air spherical charge. Overpressure in kPa
   above ambient, for Z in m/kg^(1/3). */
function overpressure(R, tntKg){
  const Z = Math.max(R, 0.05) / Math.pow(Math.max(tntKg, 1e-9), 1/3);
  return (0.085/Z + 0.3/(Z*Z) + 0.8/(Z*Z*Z)) * 1000;
}
/* Positive-phase impulse, Pa*s — what actually throws a body, as opposed to
   what bursts it. Sadovsky again. */
function blastImpulse(R, tntKg){
  const W3 = Math.pow(Math.max(tntKg,1e-9), 1/3);
  const Z = Math.max(R, 0.05)/W3;
  return 200 * W3 / Z;                  // Pa*s, near enough for a game
}
/* Once the shock has decayed below the ceiling it IS a sound again, and this
   is where it becomes one. Peak SPL from overpressure, capped at the ceiling
   because above it the number is meaningless rather than merely large. */
function blastDb(R, tntKg){
  const p = overpressure(R, tntKg)*1000;             // Pa
  const dB = 20*Math.log10(Math.max(p, 1e-9)/20e-6);
  return {dB: Math.min(dB, DB_CEILING), shock: dB > DB_CEILING};
}
/* What it does to whoever is standing there. Thresholds are the standard
   blast-injury ones, in kPa of peak overpressure. */
const HARM = [[2,'windows break'], [7,'eardrum, threshold'], [35,'eardrum, 50%'],
              [100,'lung damage'], [200,'50% lethal'], [700,'near-certain kill']];
function harmAt(R, tntKg){
  const p = overpressure(R, tntKg);
  let lab = 'nothing much';
  for (const [k,l] of HARM) if (p >= k) lab = l;
  return {kPa:p, impulse:blastImpulse(R,tntKg), label:lab, ...blastDb(R,tntKg)};
}

/* A MINE IS 0.2 kg OF POWDER, and that is chosen from the table above rather
   than from taste: it kills at a metre, bursts eardrums at two, and is walked
   away from at five. The 138 kg a half-metre cube of solid powder implied was
   not a mine, it was a demolition charge - at 25 m it still ruptured eardrums,
   which would make a dungeon unplayable the moment you shot one. */
const MINE_CORE_KG = 0.2;

function detonate(coreMassKg){
  const m = coreMassKg === undefined ? MINE_CORE_KG : coreMassKg;
  const E = m * POWDER_J_PER_KG;
  const tnt = m * TNT_EQUIV_POWDER;
  return {E, tnt, coreKg:m,
          frac:  E * POWDER_MIX_OUT.frac,
          kin:   E * POWDER_MIX_OUT.kin,
          therm: E * POWDER_MIX_OUT.therm,
          at: R => harmAt(R, tnt)};
}

/* Does the shell open? A mine only lights if the hit got THROUGH the iron, so
   a glancing shot leaves it armed — which is the hook for "one day will be
   able to be blown and contained so not all will blow when they are shot". */
function mineHit(volumeM3, fractureJ){
  const m = mineRecipe();
  const shellVol = volumeM3 * m.shellFrac;
  const shellMass = shellVol * IMAT.iron.dens;
  const need = GAMMA.iron * fractureArea('iron', shellMass, RAW.iron[1]);
  /* The core is MINE_CORE_KG, not "however much powder fits in the volume".
     Packing a half-metre cube solid gave 138 kg and a 90 kg TNT equivalent,
     which is a demolition charge wearing a mine's name. A mine is a shell with
     a charge in it and a lot of air. */
  const coreMass = MINE_CORE_KG;
  return fractureJ >= need
    ? {opened: true,  need, blast: detonate(coreMass)}
    : {opened: false, need, short: need - fractureJ};
}
