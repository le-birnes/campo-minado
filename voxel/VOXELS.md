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
