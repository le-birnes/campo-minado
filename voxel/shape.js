/* ============================================================================
   SHAPE — what a whole thing looks like, and how big it is allowed to be
   ============================================================================
   Marcelo: "all whole material must be described and shaped — a whole stone will
   always be a variation of rocks in size and shape. Make a sine wave function
   for variation, with wavelength and height varying logarithmically, curved for
   both, to randomness of bumps and size, and weight always suggesting a
   realistic limit for the material."

   Which is, almost word for word, how real surfaces are actually built.

   ROUGHNESS IS FRACTAL. A rock is not lumpy at one size — it is lumpy at every
   size at once, and the amplitude of the lumps falls as their wavelength falls.
   So the wavelengths are laid out LOGARITHMICALLY, one octave apart, and each
   octave's height follows a power law of its own wavelength:

        amplitude(λ) = A0 · (λ / R)^H

   H is the Hurst exponent and it IS the material's character. Low H (0.6) gives
   a surface where the small bumps are nearly as strong as the big ones —
   fractured stone, cinder, coal. High H (0.95) gives one where detail dies away
   fast — worn metal, ice, bone. One number, and granite stops looking like lead.

   The octaves run from the whole object down to its own molecule, because below
   the molecule there is nothing left to shape. A 2.8 m boulder of rock with a
   2 mm grain is eleven octaves; a sword blade is nine; the sun is fifty-nine and
   nobody will ever see past the first two.

   AND THE SIZE LIMIT IS NOT ARBITRARY. "Weight always suggesting a realistic
   limit for the material" has a real answer: a column of anything crushes itself
   when its own weight exceeds what it can bear.

        h_max = σ / (ρ g)

   Granite bears 200 MPa at 2700 kg/m³, so it stands 7.5 km — which is why
   mountains are the size they are. Ice bears 5 MPa and stands 556 m, which is
   why ice cliffs are not mountains. Flesh bears 0.1 MPa and stands 9.7 m, which
   is why nothing made of meat is ever taller than a house. The same formula
   sets every one of those, and it comes free with the material table.
   ========================================================================== */

/* Compressive strength in pascals, and the Hurst exponent for the surface.
   These extend the matter table rather than replacing it. */
const SHAPE = {
  bedrock : {sig:400e6, H:0.72},
  granite : {sig:200e6, H:0.70},
  rock    : {sig:130e6, H:0.68},
  cinder  : {sig: 25e6, H:0.60},
  obsidian: {sig:180e6, H:0.85},
  ice     : {sig:  5e6, H:0.90},
  wood    : {sig: 40e6, H:0.78},
  glass   : {sig: 60e6, H:0.92},
  concrete: {sig: 30e6, H:0.64},
  iron    : {sig:210e6, H:0.88},
  steel   : {sig:400e6, H:0.93},
  bronze  : {sig:200e6, H:0.90},
  copper  : {sig:120e6, H:0.90},
  gold    : {sig:100e6, H:0.94},
  lead    : {sig: 15e6, H:0.95},
  diamond : {sig:1.1e9, H:0.96},
  bone    : {sig:150e6, H:0.80},
  flesh   : {sig:0.10e6,H:0.86},
  chitin  : {sig: 90e6, H:0.82},
  coal    : {sig: 20e6, H:0.58},
  sand    : {sig:  0,   H:0.55},
  gravel  : {sig:  0,   H:0.50},
  ice_    : {sig:  5e6, H:0.90}
};
const Gs = 9.81;

/* The tallest a thing of this material can stand before its own weight crushes
   the bottom of it. Granular and fluid materials have no answer: they do not
   stand at all, they pile at an angle. */
function maxSpan(sig, dens){ return sig > 0 ? sig/(dens*Gs) : 0; }

/* A cheap deterministic hash — same seed, same rock, for ever. Worlds have to
   be reproducible or you cannot walk back to where you were. */
function hash(n){ n=(n^61)^(n>>>16); n=n+(n<<3); n=n^(n>>>4); n=Math.imul(n,0x27d4eb2d); n=n^(n>>>15); return (n>>>0)/4294967296; }

/* ---------------- the wave function ----------------
   Octaves laid out logarithmically from the object down to its molecule, each
   one's height a power law of its wavelength. `at` takes a direction and gives
   back the radius there, so the same call shapes a pebble and a mountain. */
class Lumpy {
  constructor(seed, R, molecule, H, octaves){
    this.R=R; this.H=H; this.seed=seed;
    /* How many octaves are worth having: from the whole object down to the
       smallest piece it is made of. Capped, because past a dozen the eye has
       stopped being able to tell and every one costs three sines. */
    const span = Math.max(1, Math.log2(R/Math.max(molecule,1e-9)));
    this.n = Math.max(1, Math.min(octaves||12, Math.round(span)));
    this.w=[];
    for(let i=0;i<this.n;i++){
      const lam = R/Math.pow(2,i);                 // logarithmic wavelengths
      const amp = 0.30*Math.pow(lam/R, H);         // ...and heights, by power law
      this.w.push({k:2*Math.PI/lam, a:amp,
                   px:hash(seed+i*7919)*6.283, py:hash(seed+i*104729)*6.283, pz:hash(seed+i*15485863)*6.283});
    }
  }
  /* Radius in a direction. The three sines per octave are what make it lumpy in
     three dimensions rather than ridged in one. */
  at(x,y,z){
    let r=1;
    for(let i=0;i<this.n;i++){
      const w=this.w[i];
      r += w.a*(Math.sin(w.k*x*this.R + w.px)
              + Math.sin(w.k*y*this.R + w.py)
              + Math.sin(w.k*z*this.R + w.pz))/3;
    }
    return this.R*Math.max(0.25, r);
  }
  /* Its actual volume and mass, by sampling — because a lumpy thing is not the
     sphere it was drawn from, and the difference is what you would feel. */
  measure(dens, samples){
    const n=samples||400; let sum=0;
    for(let i=0;i<n;i++){
      const u=hash(this.seed+i*2654435761)*2-1, t=hash(this.seed+i*40503)*6.283;
      const s=Math.sqrt(1-u*u);
      const r=this.at(s*Math.cos(t), u, s*Math.sin(t));
      sum+=r*r*r;
    }
    const vol=(4/3)*Math.PI*(sum/n);
    return {vol, mass:vol*dens};
  }
}

/* ---------------- a world of them ----------------
   The same function at world scale: the ground is one wide object whose surface
   is the same log-octave sum, so a boulder and a continent are made by the same
   code and agree with each other where they meet. */
function terrainHeight(x, z, seed, span, detail, H){
  let h=0, lam=span, amp=span*0.06;
  const n=Math.max(1,Math.round(Math.log2(span/Math.max(detail,0.01))));
  for(let i=0;i<n;i++){
    h += amp*(Math.sin(2*Math.PI*x/lam + hash(seed+i*7919)*6.283)
            + Math.sin(2*Math.PI*z/lam + hash(seed+i*104729)*6.283))*0.5;
    lam*=0.5; amp*=Math.pow(0.5,H);
  }
  return h;
}
