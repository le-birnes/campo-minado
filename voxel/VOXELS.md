# Turning the cave to voxels, and building our own falling-everything engine

Prep for next week. Everything here is measured on this machine, headless, one
thread, no GPU — `voxel/bench.html` over `voxel/sand.js`, re-runnable.

---

## The voxel is **BLOCK / 16 = 0.175 m**

Not chosen by taste. Chosen by these numbers:

| voxel | per block | whole board | material |
|---|---|---|---|
| BLOCK/4  | 64 | 665,600 | 0.7 MB |
| BLOCK/8  | 512 | 5,324,800 | 5.3 MB |
| **BLOCK/16** | **4,096** | **42,598,400** | **42.6 MB** |
| BLOCK/32 | 32,768 | 340,787,200 | 341 MB |
| BLOCK/42 | 74,088 | 770,515,200 | 771 MB |

A Noita pixel is about 1/30 of a character. The player is 2.0 m, so the same
feel in 3D is a 6.7 cm voxel — BLOCK/42, the bottom row, **770 million cells**.
That is the one thing to understand before starting: 2D gets its resolution for
free and 3D does not. The third dimension multiplies the cell count by about a
thousand, and "simulate every pixel" — the central trick of the whole genre —
stops being arithmetically possible.

BLOCK/16 is the largest voxel that still reads as *material* rather than as
*bricks*: 16 across a block face, 4,096 in a block, and a shotgun crater is
made of a few thousand grains rather than a few dozen cubes.

The 42.6 MB in that row is never allocated, because of the next section.

---

## Three ideas, in the order they matter

### 1. Sparse — a block becomes voxels when it is shot, not before

An intact block of the cave stays exactly what it is today: **one cube
instance**, drawn by the renderer that already exists. It is voxelised at the
moment something damages it. If a tenth of a full board is ever damaged that is
4.3 MB, not 42.6.

This also means the change is incremental. The game keeps working the whole way
through; voxels are an additional representation, not a replacement.

### 2. Dirty rects — settled material costs nothing

A chunk that did not change last tick is not looked at this tick. Measured, on
a settled pile of sand:

```
with dirty rects   :  0.00 ms/tick
every cell, always : 38.02 ms/tick
=> 11,405x
```

Everything falls asleep after **8 ticks**. This is the number the whole
architecture rests on, and it is why a cave slowly filling with sand does not
slowly grind to a halt.

It is also the finding that nearly did not happen. The first run of this
benchmark reported that *nothing ever settles* — sand and water both still
awake after four thousand ticks — and the cause was not the physics. **The
world had no edges.** A grain at x=0 asks what is at x=−1, an absent chunk
answers AIR, and the pile pours off the edge of the world into unbounded space,
minting chunks as it falls. It never lands, so it never sleeps. Outside the
bounds is ROCK now: a cave has walls, and a simulation of one needs them to be
somewhere rather than nowhere.

### 3. Active set — simulate what moves, not what exists

```
65,536 falling voxels : 4.84 ms/tick
       once settled   : 0.00 ms/tick
```

About **13.5 million voxel-updates per second**. At 60 Hz with a 4 ms slice
that is ~54,000 voxels in motion at once; running the sim at 20 Hz (every third
frame, which is what Noita-like material actually needs) it is ~160,000.

A shotgun blast destroying three blocks is 12,288 voxels — roughly 1 ms, and
settled inside a sixth of a second.

---

## What is already built

`voxel/sand.js` — the engine, ~300 lines, no dependencies.

* materials as a **table**, one byte per voxel: air, rock, sand, water, oil,
  fire, smoke, lava, steam, wood, acid, ember
* four behaviours: `STATIC`, `POWDER`, `LIQUID`, `GAS`
* **density decides who sinks through whom** — sand sinks in water, oil floats
  on it, and neither is a special case, it is one comparison
* **reactions as rows**, order-independent: fire+water→steam, lava+water→rock
  +steam, fire+oil→fire, acid+rock→nothing. Verified: a lit oil pool burns down
  to `0 oil left, 1,390 smoke`; lava dropped in water freezes to `1,088 rock`
* 32³ chunks, dirty bounds, neighbour wake-up across chunk seams
* alternating scan direction per tick, randomised diagonal tie-breaks — without
  them powders build perfect pyramids and every flow drifts the same way, and
  both read as fake instantly
* **greedy meshing**: a solid 32³ chunk is **6 quads** where naive cubes would
  be 196,608 faces

---

## What is not built, in the order it should be

1. **The mesher is the bottleneck, not the physics.** Worst case (half-random
   noise) is 33,018 quads in 10.8 ms — one chunk per frame. Real damage is
   nothing like that noisy, and the mesher is unoptimised, but this is the
   number to attack first. Budget two chunks a frame and rebuild on a queue.

2. **A second render pipeline.** The game draws instanced cubes with a rich
   shader (`CUBE_STRIDE = 26`, lighting, emissive, echo, highlight). Meshed
   chunks are a different vertex layout and need their own shader that matches
   the look. This is the largest single piece of integration work and it is
   worth prototyping against `worldB` before committing to it.

3. **Voxelise-on-damage**, the bridge: shotgun hit → block becomes a chunk of
   4,096 voxels of its material → pellets carve the crater → the rest falls.

4. **Collision against voxels.** The player currently tests `isSolidCell` on
   2.8 m blocks. Sand you can wade through, and a pile you can climb, are the
   entire point, and this touches movement, the enemies, and the bot.

5. **Threading.** Chunks are independent within a tick if updated in a checker-
   board order. A worker per core is the standard answer and this engine is
   already shaped for it.

---

## Where this collides with the game

Worth deciding before writing code, not after:

* **Minesweeper is a game of exact cells.** A mine is in a cell; a number
  counts cells. If sand can flow, the board can change shape underneath the
  logic. Either the puzzle grid stays authoritative and voxels are cosmetic
  plus physical, or the puzzle itself becomes a voxel thing — and those are
  very different games.
* **The bot navigates the block grid.** Everything landed this week — the
  passage book, the crawl, the clusters — reasons about 2.8 m cells. Voxel
  terrain does not invalidate it (the block grid can remain the navigation
  layer) but the two have to be kept deliberately in sync.
* **Cinderstone already is this feature in miniature.** Five shots, a coat one
  block thick, bedrock behind. That is the destructible-terrain design already
  agreed, at block resolution, and voxels are its natural continuation.

## Re-running the numbers

```
python -c "import sys;sys.path.insert(0,r'E:\Claude\CampoMinado3D\tools');
import run_harness as R;print(R.run(r'E:\Claude\CampoMinado3D\voxel\bench.html',
budget=900000,cap=240,profile=r'E:\Claude\CampoMinado3D\tools\cdata_bot')[0].replace('~','\n'))"
```

`data-r` is joined with `~` rather than newlines: the harness reads that
attribute with a regex, and a newline inside it reads as no attribute at all.

---

# Pyramid debris — the MVQ run, and why it is not the answer yet

`voxel/poly.js` + `voxel/polybench.html`. Five-vertex square pyramids as rigid
bodies: real pose, real spin, real separating-axis contact against each other
(5+5 face normals, up to 8x8 edge pairs = **74 axes per pair**), per-vertex
ground contact so they topple onto a face instead of hovering on a sphere.

## What the run says

```
   n    falling ms  settled ms  contacts  SAT axes/tick  ticks to sleep
   50      0.51        0.12          2          201        never
  100      0.20        0.28          6          642        never
  200      0.37        0.64          4          485        never
  400      0.78        1.83         10        1,134        never
  800      1.56        5.85         25        2,715        never
```

**The broad phase is worth 155x**: at 400 bodies the spatial hash offered 515
pairs to the narrow phase where everything-against-everything is 79,800.

## What is wrong with it, plainly

The MVQ it printed — 800 for both budgets — is **not a real answer**, and the
table says why:

1. **Nothing ever sleeps.** Same shape of bug as the sand engine's missing
   world edges, not yet diagnosed. Until bodies sleep, "settled" costs more
   than "falling" (5.85 ms against 1.56 at n=800), which is backwards and makes
   every number in the right-hand columns suspect.
2. **They are barely touching.** 25 contacts among 800 bodies. The drop box
   scales as `cbrt(n)`, so the heap gets wider as fast as it gets bigger and
   the bodies never crowd. A cost curve for *non-interacting* pyramids is not
   the curve we need.
3. **The heap is one body deep.** 0.51 m of pile from 200 pyramids, which is
   exactly the "puddle" case — so section 4 cannot yet tell us whether the
   faces hold, which was the entire reason for choosing a shape with faces.

So: the engine runs, the geometry is right, the broad phase earns its place,
and **the quantity question is still open**. Next, in order: fix sleeping;
drop them into a fixed narrow shaft so they actually stack; push n until a tick
crosses 4 ms with real contact counts; only then read the MVQ off the curve.

Worth keeping in view: 800 pyramids is *three orders of magnitude* below the
sand grid's 65,536-voxels-at-4.84 ms. Bodies and material are not competing
designs — the likely answer is material for the bulk and a few hundred bodies
for the chunks that read as debris.

---

# The tetrahedron AS the voxel — how many fit in a live frame

Marcelo, 2026-08-05: "lets consider voxel from now on the smallest tetrahedron;
how many can fit in a live play simulation".

**Which** tetrahedron matters: most do not tile space, and a unit cell that
leaves gaps is not a unit cell. The one that does is the **Kuhn simplex** —
walk a cube corner to opposite corner along the three axes in some order, and
the four points you touch are a tetrahedron. Six orderings, six tetrahedra,
filling the cube exactly. `tet.js` derives the neighbour table by shared-face
test rather than writing it down, which also checks the decomposition: every
cell comes out with exactly **4 face-neighbours** where a cube has 6.

## The answer

```
scanning everything: 207,360,000 tetrahedra/second

   4 ms  — a physics slice of a 60 Hz frame        829,440 tets
  16.6 ms — a whole 60 Hz frame                  3,442,176 tets
  50 ms  — the sim at 20 Hz, what material needs 10,368,000 tets
```

**~10 million in motion at once**, at 20 Hz. Standing material is skipped by
the dirty rect (measured at 11,405x in `sand.js`), so the frame budget buys
what is *falling* and the resident world is bounded by memory instead:

| board at | tets | bytes |
|---|---|---|
| BLOCK/8  | 31,948,800 | 32 MB |
| BLOCK/16 | 255,590,400 | 256 MB |
| BLOCK/32 | 2,044,723,200 | 2,045 MB |

## Sizing it, now that the cell is a sixth of a cube

A tet at cube spacing *d* has volume *d³/6*, so to keep an element the same
size as the old BLOCK/16 cube the spacing grows by ∛6 = 1.82:

> **cube spacing BLOCK/9, six tetrahedra per cube.** Element volume matches the
> BLOCK/16 cube we sized before, the full board is ~45 M tets ≈ 45 MB resident,
> and the *shape* of the element is a tetrahedron rather than a brick.

## One number in the bench output is not real

It printed "per cell the tetrahedron is 15.31x the cube". **It is not.** That
compares `tet.js` — a flat typed-array scan, one rule, no reactions, no RNG, no
chunk indirection — against `sand.js`, which carries chunk Map lookups,
reactions, randomised tie-breaks and liquid spread. It measures the two inner
loops, not the two shapes. The honest structural claim is only this: a
tetrahedron has 4 faces and a cube has 6, so per element the neighbour work is
two thirds, and per unit of space there are six times as many elements.
Everything else in that comparison is confounded and a fair version needs the
same rule set on both lattices.

## The fair fight — same rule, same code, both lattices

The comparison I said was missing, now run. `CubeGrid` in `tet.js` is the cube
written exactly like `TetGrid`: same flat array, same scan order, same one rule,
each lattice using the downhill moves it actually has — cube: down plus four
diagonals; tetrahedron: the face neighbours whose centroid is lower.

**(a) Same spacing** — each tet is a sixth of a cube, so six times as many:

```
cube      64,000 cells   0.54 ms
tet      384,000 cells   1.81 ms    3.3x the cost for 6x the cells
                                    per cell: 0.56x
```

**(b) Same element size** — tet spacing 22 against cube spacing 40, so one
tetrahedron occupies the volume of one cube and the counts match:

```
cube      64,000 cells   0.54 ms
tet       63,888 cells   0.32 ms    => 1.67x FASTER for the same material
                                       at the same grain
```

And the reason is not the neighbour count, which is the part I had wrong.
Tetrahedra do *more* tests per element, not fewer — 1.47 against the cube's
1.00 — and are still faster. It is **memory layout**: the six cells of one cube
are contiguous, and most of a tetrahedron's face neighbours live in that same
cube, so the common move is a cache hit. A cube's downhill moves are all
diagonals that cross rows and planes.

So: **smaller and lighter, both**. Six times finer at 3.3x the cost, or the same
grain for 0.6x the cost. The earlier "15.31x" line stays retracted — this is the
number that replaces it.

---

# THE SCALE, decided against the real dungeon

Measured, not assumed (`tools/h_dims.js`):

```
zones=1   18x6x18  =  1,944 blocks   50x17x50 m    42,675 m3
zones=2   18x12x18 =  3,888 blocks   50x34x50 m    85,349 m3
zones=4   18x24x18 =  7,776 blocks   50x67x50 m   170,699 m3
```

A four-level dungeon is **170,699 m3**, of which only 1,198 blocks (15%) are air
or puzzle - the other 6,578 are solid rock.

Tets = 6 x volume / spacing^3; element = an equal-volume cube of side spacing/cbrt(6).

| spacing | element | per player (2 m) | tets, whole dungeon | resident |
|---|---|---|---|---|
| BLOCK/8 = 0.350 m | 0.193 m | 10.4 | 23.9 M | 24 MB |
| BLOCK/9 = 0.311 m | 0.171 m | 11.7 | 34.0 M | 34 MB |
| **BLOCK/12 = 0.233 m** | **0.128 m** | **15.6** | **80.6 M** | **81 MB** |
| BLOCK/16 = 0.175 m | 0.096 m | 20.8 | 191 M | 191 MB |
| BLOCK/24 = 0.117 m | 0.064 m | 31.2 (Noita) | 645 M | 645 MB |
| BLOCK/32 = 0.088 m | 0.048 m | 41.5 | 1,529 M | 1.5 GB |

## Cube spacing BLOCK/12, element ~0.128 m

It is the finest scale at which **the entire four-level dungeon fits in memory
with every rock cell resident** - 81 MB at a byte each. That matters more than it
sounds: it removes the whole sparse / voxelise-on-damage machinery and an entire
class of bug about when a block becomes voxels and what happens at the seam.

* **10,368 tets per block**, so one wall collapsing is 10 k cells - 40x under the
  ~10 M active budget.
* 15.6 elements per player height. Chunkier than Noita's 30, but a shotgun crater
  in a 2.8 m wall is ~22 elements across, which reads as material, not bricks.
* Sparse storage later drops it to ~26 MB and makes BLOCK/16 (0.096 m, 21 per
  player) affordable. That is the upgrade path if the art wants finer.

**And the constraint that comes with it:** at 80.6 M cells a full scan is
**0.39 s**. The dirty rect stops being an optimisation and becomes mandatory.
Anything that wakes the whole world is not a slowdown, it is a hang.

---

# THE SMALLEST MOLECULE, and the reversal (voxel/molecule.html)

## An Arcane run, in particles

Arcane SWEEPER, 900 blocks:  BLOCK/16 22 M | BLOCK/24 75 M | BLOCK/32 177 M | BLOCK/64 1.42 G
Arcane DUNGEON, 7,776 blocks: BLOCK/16 191 M | BLOCK/24 645 M | BLOCK/32 1.53 G | BLOCK/48 5.16 G

## What a collapsing wall costs

  grain      one block cells   ONE block     FIVE blocks
  BLOCK/16          24,576      0.23 ms         1.13 ms
  BLOCK/24          82,944      0.74 ms         3.69 ms
  BLOCK/32         196,608      1.71 ms         8.56 ms
  BLOCK/48         663,552      5.92 ms        29.59 ms
  BLOCK/64       1,572,864     13.70 ms        68.50 ms   over budget

## THE REVERSAL

The arena-ceiling test made COMPUTE the wall - 805 MB allocated in 1 ms, 5 s to
scan. With the dirty rect in, that flips: at BLOCK/24 a five-block collapse costs
3.69 ms of a 50 ms tick while the board costs 645 MB. **Compute stops binding and
memory starts.**

  MEMORY  binds the board - cubic in grain, paid always
  COMPUTE binds the event - also cubic, but only while something falls

Finest grain inside 1.5 GB: Arcane SWEEPER BLOCK/64 (2.41 cm, player 83 tall);
Arcane DUNGEON BLOCK/24 (6.42 cm, player 31 tall - exactly Noita's granularity).

## The recommendation, superseding BLOCK/12

  safe        BLOCK/16 = 9.6 cm   player 21 tall   dungeon 191 MB   1.13 ms
  ambitious   BLOCK/24 = 6.4 cm   player 31 tall   dungeon 645 MB   3.69 ms

BLOCK/12 was chosen before the EVENT cost was measured, on the assumption compute
would bind sooner than it does. BLOCK/24 reaches Noita's grain on the full
four-level dungeon and is affordable; BLOCK/16 is what to build on first, because
it has 5x the headroom and the difference is 9.6 cm against 6.4 cm.

## A NEW ENGINE WOULD NOT HELP

The wall is memory, and a rewrite does not conjure address space - in a browser
it is the same 1-2 GB whatever you write. What a rewrite buys is COMPUTE, and
compute is exactly the resource not binding: 3.69 ms of a 50 ms budget.

Building an engine to fix the wrong wall is the expensive kind of mistake.

The material layer is already host-agnostic: sand.js, tet.js and lattice.js have
no WebGL in them. Native or WebGPU earns its cost at exactly one threshold -
grain finer than ~6 cm across a full dungeon - and on that day the job is porting
two small files, not a game. The cheap upgrade to do first is WASM + SIMD128 on
the inner loop: same deployment, same URL, single-digit multiples on a byte-array
scan.
