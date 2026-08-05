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
| `tools/eyes_voxel.py` | photographs the sim and reviews it. Needs a key; skips cleanly without one |
| `tools/eyes.py` | the same for the game itself, 5 poses |

**Decided:** the element is a Kuhn tetrahedron. Molecules are **dust** (iron 0.5 mm,
rock sand 2 mm); "reckoned as a whole" is the **object record**, not a big
molecule. A visible grain is 1,000 molecules. Objects shed in proportion to
their recipe.

**Verified visually:** powders slump to an angle of repose; oil floats on water;
sand sinks through both; no chunk-seam artifacts.

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

WHAT THAT ASKS OF THE ENGINE, in the order it has to be built

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
