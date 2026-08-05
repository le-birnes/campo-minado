# NEXT SESSION — build the world

Paste the block below as the opening prompt. Everything above it is context for
whoever is reading; the prompt itself is self-contained.

---

## Where things stand

| file | what it is |
|---|---|
| `voxel/matter.js` | objects stay **whole** — a volume, a recipe, a wear counter. Particles exist only where matter was liberated. 384× less memory than a particle field |
| `voxel/sand.js` | the falling-everything grid: materials, dirty rects (11,405×), reactions |
| `voxel/tet.js` | the Kuhn tetrahedron lattice, 6 per cube, neighbours derived not hardcoded |
| `voxel/shape.js` | fractal roughness (log-spaced octaves, amplitude ∝ λ^H) + `h_max = σ/ρg` |
| `voxel/lattice.js` | discrete bodies: integer position, 24 orientations, **no narrow phase** |
| `voxel/view.html` | vertical cross-section renderer, 5 scenes |
| `voxel/front.html` | the reaction-front measurement — why a sea meeting a sea is affordable |
| `tools/eyes_voxel.py` | photographs the sim and reviews it. Needs a key; skips cleanly without one |
| `tools/eyes.py` | the same for the game itself, 5 poses |

**Decided:** the element is a Kuhn tetrahedron. Molecules are **dust** (iron 0.5 mm,
rock sand 2 mm); "reckoned as a whole" is the **object record**, not a big
molecule. A visible grain is 1,000 molecules. Objects shed in proportion to
their recipe.

**Verified visually:** powders slump to an angle of repose; oil floats on water;
sand sinks through both; no chunk-seam artifacts.

---

## The three rules the world rests on

These are settled and measured. Anything that contradicts one of them is wrong.

### 1. The world is a LATTICE OF WHOLE RECORDS, not a field of particles

Nothing is stored as particles until something happens to it. A 5 km sea, a
mountain, the sun — one record each: a volume, a recipe, a wear counter.

> **Break a portion and *that portion* becomes molecules in front of you, while
> the source diminishes a tiny bit.** Interaction is on demand, everywhere, and
> costs nothing until demanded.

A four-level dungeon is 486 KB this way against 191 MB as a particle field — 384×,
and it scales with what *happens* rather than with what *exists*.

### 2. A REACTION IS A SURFACE, not a volume

Two seas thrown together react only where they touch. Volume grows as L³ and the
interface as L², so the bigger they are, the smaller the fraction that is busy:

```
sea edge        volume          interface       front cells    fraction busy
   10 m         1,000 m³           100 m²            32,552       0.29%
5,000 m  125,000,000,000 m³  25,000,000 m²  8,138,020,833       0.0058%
```

At 5 km the front is six thousandths of one percent of the material.

**So it runs in two tiers** — chunk-level that *looks* like particle-level:

- **NEAR the player** — real particles, real reactions, the front advancing cell
  by cell. The only part the eye is ever looking at.
- **FAR from it** — one number. The front has an area and a rate, so how much has
  been consumed is an **integral**, not a simulation.

**The join is the whole trick.** Walk toward a distant front and the bookkeeping
says where it has got to, and particles are spawned *at that position*. It looks
like it was simulating all along, because the only claim it ever has to honour is
**where the boundary is**. Nobody can check the middle of a sea.

1,000 sea-pairs as bookkeeping: **47 KB and 1,000 multiplications a tick**. The
same thing as particles at 5 km: 2.7 billion cells.

### 3. VISIBLE DEBRIS IS A BUDGET, not a consequence

Marcelo: *"sometimes visually if possible to arrange, because some hits are
powerful."*

A hit may spawn at most **N visible grains**. Past N the source simply diminishes
by the rest and no particles are made. **A big hit looks big without costing more
than a small one**, and the cost of a fight stops depending on how hard anyone
swings. Tune N to the frame, not to the physics.

---

## The one thing blocking all of it

**`sand.js` is roughly 400× more expensive per cell than `tet.js`'s flat scan** —
chunk `Map` lookups, per-cell reaction tests, RNG in the inner loop. Extrapolated
from a real run, even the *visible* patch of a reaction front costs **246 ms/tick
at a 10 m radius**, where the same cell count through the flat typed-array scan
is **0.63 ms**.

The design above is sound; the material grid's implementation is not. Give it the
flat typed-array treatment `tet.js` already has *before* anything else needs a
frame budget. It is a known quantity, not a research problem.

---

## THE PROMPT

```
Build the world for Minesweeper — Three Planes. Read NEXT.md, then voxel/matter.js
and voxel/shape.js before writing anything.

THE SHAPE OF THE WORLD

It is a closed solid, not a plane with edges. A truncated-icosahedron layout —
20 hexagonal faces plus the 12 pentagons that let hexagons close a sphere. Each
face is a region.

  - The CENTRE of the world is the entrance to the dungeon. Everything else is
    arranged around it.
  - Regions meet LATERALLY. Noita stacks biomes vertically and you dig down
    through them; here you do not cross a horizontal border into the desert —
    the desert is standing in front of you, and its border is a wall you can see.
  - Those lateral borders behave like Noita's own map borders.
  - The far side of the solid is made of VARIANTS of this world.
  - So walking to the end is never a dead end: keep going and you arrive in an
    INVERTED world. The antipode of every region is its inversion.

There is a sun. There is a sea. Everything Noita has, in kind if not in count.

Everything in it is a lattice of whole records — see "The three rules" above.
Nothing is particles until something breaks it, a reaction is a surface simulated
only where the player can see it, and visible debris is a budget rather than a
consequence.

WHAT THAT ASKS OF THE ENGINE, in the order it has to be built

0. MAKE sand.js FLAT. It is ~400x more expensive per cell than tet.js's typed
   array scan, and that gap is what stops a reaction front fitting in a frame.
   Nothing else on this list is worth doing until it is fixed, and it is a known
   fix rather than a research problem.

1. GRAVITY AS A VECTOR, not −Y. This is the load-bearing one and it must come
   first, because everything reads it: the player controller, the falling
   material in sand.js, and the whole of tools/bot.js, which reasons about "the
   floor you are on". On a closed solid, down points at the centre; in the
   inverted world it points away. Do this alone, prove it with the bot still
   finishing a dungeon, then continue.

2. THE REGION MAP. 20 hex faces + 12 pentagons, each carrying a biome, a
   material palette and a border rule. Generate it, do not hand-place it.

3. TERRAIN FROM shape.js. terrainHeight() is already the same log-octave sum
   used for a boulder, so a continent and a pebble agree where they meet. Drive
   the regions from it.

4. THE ANTIPODE RULE. Define precisely what "inverted variant" means — gravity,
   palette, light, which materials swap — and make it derivable from the seed
   rather than authored twice.

5. THE SUN AND THE SEA as objects in matter.js: one record each until something
   touches them. A 5 km sea costs nothing until you shoot it.

GROUND THE MATERIALS IN THE WIKI, DO NOT INVENT THEM

The numbers currently in matter.js and solver.html are mine, not Noita's, and
Marcelo has said to use the wiki as the source of truth. Fetch from
noita.wiki.gg — the Materials index gives the taxonomy (6 classes: solids,
liquids, magical liquids, gaseous, powders, organic/other) and the three
properties that matter (durability, hardness as per-pixel HP spent by ray
energy, density). Per-material values live on the individual material pages.

DURABILITY IS THE ONE OUR MODEL LACKS: it is a THRESHOLD, not a rate. Below it a
tool does nothing however long you swing. That is how bedrock becomes absolute
rather than merely expensive, and matter.js can currently only make things slow.
Add it.

Also missing entirely: STAINS. A stain re-labels a thing instead of destroying
it — wet, oiled, bloody, toxic, on fire, frozen — and water washes several off.
One byte of flags per object buys the whole layer. And CLASS-LEVEL TRANSFORMS:
"lava + any solid → its molten form" is one rule generating 24 materials. Write
rules over classes, not pairs.

HOW TO WORK

Measure, do not assert — every claim in voxel/ has a re-runnable bench behind it.
Use R.escalate(), never R.run(): two 12-second attempts before any waiting,
because a cold start costs 120s once and the run after it costs nothing.
Pin ?seed=N; the board is wall-clock seeded and unseeded runs are not comparable.
Use lights=0 for bot runs and LIT for eyes.
Look at the pictures: tools/eyes_voxel.py --scene all, and tools/eyes.py.
Push after every change. Small case first — Apprentice is 300 cells, the dungeon
is 7,776.

agybridge is a contractor, never a dependency: it returns a Reply, never raises,
and anything importing it works unchanged when it says no.
```

---

## Also open, not in the prompt

- **The four-zone dungeon stops at 147/356** in every build. Not a floor
  boundary — work is left on every level with standable cells near all of it.
  The perch (`?ex=perch:1`, off) is the thread: it picks a spot that can *see*
  the target, but the spot moves as the map moves so the bot walks between two
  and never shoots.
- **Cluster release rule #2** — a cluster that goes 50/50 is dug around and
  **resumed from another side**. Release #1 (complete) is written.
- **The mesher**, if anything ever needs drawing at cell resolution: 10.8 ms for
  a worst-case chunk is the number to beat.
