# NEXT - after the compact

Paste the fenced block at the bottom. Everything above it is why.

## Where the game actually is, 2026-08-06

**In the game, working, verified:**

| | |
|---|---|
| the ending | boss detonates -> gravity flips to -8.4 -> 2.6 s -> island. agy PASS |
| the island | sand / wet sand / salt water / wood / leaf, as blocks. 2,115 instances |
| the tree | trunk, 7 branches, 8 leaf clusters (223 blocks) |
| voxel layer | a block voxelises 16^3 when damaged, persists, 3 drawn at once |
| RAW grains | burst from destroyed blocks, collide, slump, pile, persist |
| grain materials | water flat to 17.45 m; sand cones at 1.00 m; wet sand steepest |
| Shift+H | insta_dungeon_solve, stops one move short of the finale |
| ?lightx=N | tester ambient multiplier |

**In voxel/, measured, NOT in the game:** sand.js (flat, 8.3 ns/cell),
impact.js (fracture is a surface), round.js (energy has a kind, the jet),
compose.js (blocks as recipes, mines as energy sources, overpressure),
island.js, many.html (27 materials cost what 2 do), ball.js (round vs
flat-faced, measured), BEAD.md.

**Known broken or missing:**

- **Salt water is solid blocks.** You stand on the sea. No transparency, no
  swimming, no beads. Biggest gap between built and asked-for. It is next.
- The sinking rule (denser grain through lighter) is written and **untested** -
  three test scenes leaked.
- No **field** of any kind: no wind, no heat, no pressure. Leaves cannot move
  because there is nothing to move them.
- No **MORTAL** flag: nothing is allowed to stop existing.
- The **dungeon bot ceiling** at 41% is unexplained. findHint solves 395/396 of
  the same board instantly, so the bot is not deduction-limited.

## The order, and why this order

### 1. WATER AS BEADS - everything else waits on it

Asked for most, delivered least. It also forces three mechanisms the rest of
the design needs anyway:

- **a depth query** - how much water is under this block. Waves, rigidity and
  transparency all read it.
- **two binds** - bead-to-bead surface tension, broken by wading, against the
  block overall threshold. That distinction IS how you enter water.
- **accumulated thickness for transparency** - one number along a ray, which is
  Beer-Lambert and also the cheap way.

      water below | loose beads | stand on | inert
      1 block     | 8 layers    | 2 rigid  | rest
      2 blocks    | 16 layers   | 3        | 13 pass through

Shores keep >= 8 interactive layers. Sea level holds at level + 2.

### 2. THE 500 m SPHERE - the cost ceiling

Second, not first, and not because it matters less. It is a refactor with no
visible output, and doing it before water means testing it against a world with
nothing interesting in it. Water gives it something to be a ceiling OVER.

Needs: an active-sphere test, a record for anything outside it (position,
state, forces, probable next position), re-entry that recomputes from elapsed
time, and the boundary violet wash falling to black at 3x shotgun radius.

### 3. WIND - the first field

Then leaves move, water splatters, air becomes visible at 0.05-0.5 opacity by
temperature and speed. A moving mass 2-500 m across, up to 100 km/h, random.
**MORTAL rides along with it**: wind takes the leaves, and they must be allowed
to die two minutes later.

### 4. CELESTIAL - sun, moon, planet

Cheap, and it is rule 1 at the largest scale: the sun at 13.6 Gm is 10^20 bead
widths away and can only ever be a record. Time keeps running outside the
sphere, so tides and seasons come from the same bookkeeping.

### 5. THE SPIT - liquids as a weapon

Beads on a gravity arc from screen centre, strength on hold. The only way to
throw a liquid, so throwing one always doses you mildly. Needs (1).

## What I would push back on, once

**The 16-layer water spec is expensive at the wrong moment.** Sixteen layers of
BLOCK/16 beads per water block, over an ocean, is a lot of beads for something
whose top two layers are all anyone ever sees. I would build it as: the shell is
computed ON DEMAND, its depth read from the block below, and only where
something is touching it. Same rule, same numbers, but the ocean at rest costs
nothing - which is rule 1 again, and it is the rule this engine keeps rewarding.

Flagged rather than quietly done, because the layer counts are a design
statement and I may be reading them too literally.

## THE PROMPT

```
Read NEXT.md, then voxel/BEAD.md, then the vault note "The 500m sphere - scope,
state, and the boundary". Then make WATER REAL.

Salt water in the island is currently solid blocks you stand on. It should be:

  - a block VISUALLY, with a shell of interactive beads on top of it
  - the shell depth read from how much water is below: 1 block gives 8 loose
    layers with 2 rigid under them; 2 blocks gives 16 loose and 3 to stand on;
    the layers between are inert and pass through
  - TWO BINDS: bead-to-bead surface tension, which wading breaks, against the
    block own threshold. Breaking the first is how you enter the water
  - TRANSPARENT near, opaque with distance and with how much water is between.
    One accumulated thickness along the ray, not per-layer sorting
  - WAVES where there are 2+ blocks below, because the top layers then behave
    as a fluid, including resting as one

Build it in index.html, not in voxel/. The measured liquid rules already exist
in sand.js and in RAW: water spreads flat to 17.45 m where sand cones at 1.00 m.

Verify with agy at ?lightx=3: stand at the shore and photograph. It has to show
water transparent close and opaque far, and a surface that moves.

Then, in order: the 500 m sphere, wind + MORTAL, celestial records, the spit.

Push after every change. Small case first. Marcelo plays the build, so say
plainly what is untested rather than implying it works.
```
