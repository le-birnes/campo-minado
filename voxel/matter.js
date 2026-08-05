/* ============================================================================
   MATTER — molecules sized by material, and objects that stay whole
   ============================================================================
   Marcelo's model, and it is a better one than the particle field this project
   had been building toward:

     "Stuff should have larger molecules according to material... Mines are made
     of iron, tougher, and usually in chunks that should be calculated as whole.
     Depending on kind of damage, interaction separates a single grain of
     material — adds one to the world, removes one from the model — but the model
     keeps being considered a whole plus a material destruction count. When the
     count reaches threshold, the source loses a chunk the size of a usual
     molecule of base material."

   The consequence is the one that matters. A voxel field pays for every cell of
   everything, always: the four-level dungeon costs 191 MB the instant it is
   built, whether or not a single shot is ever fired. Here an object is ONE
   RECORD — a volume, a composition, and a wear counter — and particles exist
   only where matter has actually been liberated. The world costs what has
   HAPPENED to it, not what it is made of.

   And it gives the right answer to the test Marcelo set for it:

     "If the player reaches the sun somehow, the sun will be a large solid blob,
     and shooting it to smithereens does nothing except drawing out some
     hydrogen sand."

   Nothing special is needed for that. The sun is an object like any other; its
   molecule count is astronomical and its binding is absurd, so a shotgun
   liberates a handful of grains and the blob does not notice. The same three
   numbers that make a rock crumble make a star ignore you.

   MOLECULE SIZE IS PER MATERIAL, and bigger is cheaper. That inverts the cost in
   exactly the useful direction: the bulk of a cavern is rock, rock has coarse
   molecules, and the fine-grained things — water, flesh, hydrogen — are the
   things there is not much of.
   ========================================================================== */

/* state: how a liberated grain behaves once it is in the world */
const S_GRAIN=0, S_LIQUID=1, S_SOFT=2, S_GAS=3;

/* mol   the size of one molecule in metres — the smallest piece that can come
         off this material, and what a shed grain is
   hard  scratch hardness, Mohs-ish. Harder scratches softer; that is the whole
         of the damage interaction
   bind  how much wear one molecule costs to release. Toughness, not hardness —
         a thing can be soft and hard to break apart (flesh) or hard and easy
         to shatter (a mineral) */
/* bind is now a SPECIFIC ENERGY: the work it takes to liberate a unit volume of
   this material. That is what makes the model scale-free - the same number
   governs a sword being scratched and a star being shot at, because the
   threshold to release ONE molecule is bind x that molecule's volume, and
   molecules differ by fourteen orders of magnitude between iron dust and
   hydrogen. Toughness, not hardness: flesh is soft and hard to pull apart. */
const MAT = {
  bedrock  : {mol:0.0100, hard:9.0, bind:1e15, dens:3200, state:S_GRAIN,  wet:0.00, c:[0.02,0.02,0.03]},
  cinder   : {mol:0.0040, hard:4.0, bind:5e6,  dens:2400, state:S_GRAIN,  wet:0.00, c:[0.30,0.27,0.26]},
  rock     : {mol:0.0020, hard:5.0, bind:3e6,  dens:2700, state:S_GRAIN,  wet:0.02, c:[0.38,0.35,0.32]},
  mineral  : {mol:0.0025, hard:6.0, bind:6e6,  dens:3000, state:S_GRAIN,  wet:0.00, c:[0.55,0.52,0.42]},
  coal     : {mol:0.0030, hard:2.0, bind:1e6,  dens:1400, state:S_GRAIN,  wet:0.01, c:[0.10,0.09,0.09]},
  iron     : {mol:0.0005, hard:4.5, bind:5e8,  dens:7870, state:S_GRAIN,  wet:0.00, c:[0.45,0.42,0.40]},
  steel    : {mol:0.0004, hard:6.5, bind:8e8,  dens:7850, state:S_GRAIN,  wet:0.00, c:[0.62,0.63,0.66]},
  bronze   : {mol:0.0006, hard:3.5, bind:4e8,  dens:8800, state:S_GRAIN,  wet:0.00, c:[0.72,0.50,0.22]},
  copper   : {mol:0.0006, hard:3.0, bind:3e8,  dens:8960, state:S_GRAIN,  wet:0.00, c:[0.80,0.45,0.25]},
  flesh    : {mol:0.0010, hard:0.5, bind:2e5,  dens:1050, state:S_SOFT,   wet:0.70, c:[0.65,0.30,0.28]},
  bone     : {mol:0.0015, hard:3.0, bind:1e6,  dens:1900, state:S_GRAIN,  wet:0.15, c:[0.86,0.83,0.74]},
  water    : {mol:0.0005, hard:0.0, bind:8e4,  dens:1000, state:S_LIQUID, wet:1.00, c:[0.20,0.42,0.75]},
  hydrogen : {mol:0.00005,hard:0.0, bind:1e13, dens:70,   state:S_GAS,    wet:0.00, c:[0.95,0.85,0.55]}
};

/* HOW MANY MOLECULES MAKE ONE VISIBLE GRAIN.

   A molecule is dust - iron at half a millimetre, rock sand at two - and nothing
   can or should draw those individually. So liberated matter ACCUMULATES: it
   comes off molecule by molecule, and the world gains a grain you can actually
   see once a thousand of the same material have piled up in the same place.
   A tunable constant, not a derived one: it is a drawing decision. */
const PER_GRAIN = 1000;
const perGrain = () => PER_GRAIN;

const molVol = m => { const s = MAT[m].mol; return s*s*s/6; };   // one Kuhn tet of that size

/* ---- what things are made of ----
   Proportions by volume. A shed grain is drawn in proportion, so an iron sword
   with a little copper in it sheds mostly iron dust and occasionally copper —
   which is exactly what Marcelo described. */
const RECIPE = {
  cavernWall : {rock:0.72, mineral:0.20, coal:0.08},
  cinderWall : {cinder:0.85, mineral:0.15},
  mine       : {iron:0.88, coal:0.12},                 // tough, and reckoned whole
  player     : {water:0.70, flesh:0.24, bone:0.06},    // 70% water, as specified
  organicFoe : {water:0.62, flesh:0.32, bone:0.06},    // "wet"
  constructFoe:{iron:0.55, rock:0.30, bronze:0.15},    // "dry"
  ironSword  : {iron:0.92, copper:0.05, bronze:0.03},
  steelBlade : {steel:0.95, iron:0.05},
  sun        : {hydrogen:1.00}
};

/* ---- damage kinds ----
   Each says how much of the exchange is scratching (hardness-driven, sheds fine
   dust) versus shock (bind-driven, breaks pieces off regardless of hardness). */
const DMG = {
  slash : {scratch:0.85, shock:0.15},
  pierce: {scratch:0.55, shock:0.45},
  blunt : {scratch:0.10, shock:0.90},
  shot  : {scratch:0.35, shock:0.65},
  burn  : {scratch:0.00, shock:0.30}
};

/* ---- an object ----
   A whole. Not a cloud of cells: a volume, a recipe, and one wear number per
   constituent. It only becomes particles where it has actually lost some. */
class Body {
  constructor(name, recipe, volume){
    this.name=name; this.r=RECIPE[recipe]||recipe; this.v0=volume; this.v=volume;
    this.wear={}; this.lost={};
    for(const k in this.r){ this.wear[k]=0; this.lost[k]=0; }
    /* Averages, weighted by how much of the thing each material is. */
    this.hard=0; this.bind=0; this.wet=0;
    for(const k in this.r){
      this.hard += MAT[k].hard*this.r[k];
      this.bind += MAT[k].bind*this.r[k];
      this.wet  += MAT[k].wet *this.r[k];
    }
  }
  /* How many molecules this thing IS. The number that makes a star a star. */
  molecules(){
    let n=0;
    for(const k in this.r) n += this.v*this.r[k]/molVol(k);
    return n;
  }
  intact(){ return this.v/this.v0; }
}

/* ---- the interaction ----
   attacker strikes defender. Returns the grains that came off, in proportion,
   and mutates both — because a strike wears the striker too, which is why a
   soft blade dulls on stone.

   Harder scratches softer: the ratio of hardnesses decides how much of the
   scratch component lands. Shock ignores hardness and argues with bind. */
function strike(attacker, defender, kind, energy){
  const D = DMG[kind] || DMG.blunt;
  const out = [];
  const pass = (att, def, share) => {
    if (share <= 0) return;
    /* Scratch: only a harder thing scratches a softer one, and the margin
       decides how much. Equal hardness barely marks. */
    const edge = Math.max(0, att.hard - def.hard) / Math.max(1, att.hard);
    const work = energy*share*(D.scratch*edge + D.shock*0.35);
    if (work <= 0) return;
    for (const k in def.r){
      /* Each constituent takes wear in proportion to how much of the body it is,
         and sheds when that wear passes the threshold for ONE of its molecules -
         which is its specific energy times the volume of one molecule.

         Counted, not looped. A shotgun into stone liberates thousands of grains
         of dust at once, and a while-loop shedding them one at a time is how the
         first version of this quietly cost a millisecond a pellet. */
      def.wear[k] += work*def.r[k];
      const need = MAT[k].bind * molVol(k);
      const n = Math.floor(def.wear[k] / need);
      if (n <= 0) continue;
      def.wear[k] -= n*need;
      const vol = Math.min(n*molVol(k), def.v*0.999);
      def.v -= vol;
      const got = Math.round(vol/molVol(k));
      def.lost[k] += got;
      if (got > 0) out.push([k, got]);
    }
  };
  pass(attacker, defender, 1.0);
  /* The parry costs the striker too, in proportion to how much harder the
     thing it hit was. */
  pass(defender, attacker, 0.35);
  return out;
}

/* ---- a liberated grain ----
   Five seconds on the floor, then gone — or gone sooner if the player walks
   over it, which is the pickup Marcelo described. Interactive materials would
   fall and flow; these sit. */
const GRAIN_LIFE = 5.0;
class Grains {
  constructor(){ this.g=[]; this.picked={}; this.expired=0; this.pile={}; this.molecules=0; }
  /* One molecule of dust. It only becomes something in the world when enough of
     the same material has come off to be worth drawing. */
  add(mat,n,x,y,z){
    this.molecules+=n;
    this.pile[mat]=(this.pile[mat]||0)+n;
    const need=perGrain(mat);
    const made=Math.floor(this.pile[mat]/need);
    this.pile[mat]-=made*need;
    for(let i=0;i<made;i++) this.g.push({m:mat,x,y,z,t:GRAIN_LIFE});
  }
  step(dt, px,py,pz, reach){
    let w=0;
    for(let i=0;i<this.g.length;i++){
      const q=this.g[i];
      if(reach>0){
        const dx=q.x-px, dy=q.y-py, dz=q.z-pz;
        if(dx*dx+dy*dy+dz*dz < reach*reach){
          this.picked[q.m]=(this.picked[q.m]||0)+1;      // walked over: stored
          continue;
        }
      }
      q.t-=dt;
      if(q.t<=0){ this.expired++; continue; }
      this.g[w++]=q;
    }
    this.g.length=w;
  }
}
