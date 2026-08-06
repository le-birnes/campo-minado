# NEXT - after the sand.js port

## Where the game actually is, 2026-08-06

**sand.js IS the game now.** RAW and VOX are gone; there is one flat grid over
the whole world at BLOCK/16 - the bead, 17.5 cm - with a ROCK border, dirty
rects, materials from a table and reactions as rows. A dungeon is 288x384x288
cells, 31 MB, 972 chunks, and 60 ticks of a quiet one scan ZERO cells.

**And it runs on 26 neighbours, for powders and fluids alike**, which is what
Noita's 8 translates to in three dimensions. Nine downward directions instead of
five, eight lateral instead of four. Measured on a poured heap, diagonal radius
over axis radius, where round is 1.00:

    four lateral   0.74 sand   0.81 wet sand   0.83 rubble
    eight lateral  1.03        1.00            1.00

Photographed from directly above (tools/h_sandshot.js, ?sview=top): the old set
makes a DIAMOND with four sharp points, the new one makes a CIRCLE. agy was
shown both without being told which was which and said "a circle" / "a diamond
with four points", and picked the circle as the real one.

| | |
|---|---|
| the grid | one array, whole world, persistent, settled costs nothing |
| materials | 19, from air to gunpowder, each a row |
| reactions | water+fire, lava+sand -> glass, water+sand -> wet sand, acid+rock |
| grit | ballistic while flying, written into the grid when it lands |
| drawing | its own batch, 22,000 instances, 26 chunks, nearest first |
| the ending | boss -> gravity flips -> island. Gravity reversing wakes every chunk holding anything loose |
| scenery | the island tree comes apart into wood and leaves, not generic rubble |

**Three things found by measuring, all worth keeping:**

1. The corner gate must be INDEPENDENT of slip, then scaled by 1/slip. What has
   to match between a free-running powder and a cohesive one is corner steps PER
   GRAIN, not per attempt.
2. A liquid needs something ON TOP of it to slide sideways. Without that test a
   sheet one cell thick shuffles at its edges for ever - 25 chunks still awake
   after 3,000 ticks - and the dirty rect never pays.
3. Arcane plus rendering blocks Chrome's main thread long enough that virtual
   time never advances and a screenshot harness reads as an endless loop. Shoot
   on Apprentice.

**Known broken or missing:**

- **The island sea is still solid blocks.** You stand on it. This is the
  biggest remaining gap and it is item 1 below.
- Liquid isotropy is 0.84 against the powders' 0.97. It is quantisation at a
  spread of five cells - floor(5/sqrt2)*sqrt2/5 is 0.85 - and it closes as the
  spread grows. A bigger number, not a cleverer rule.
- No **field**: no wind, no heat, no pressure. Leaves cannot move.
- No **MORTAL** flag: nothing is allowed to stop existing.
- The **dungeon bot ceiling** at 41% is still unexplained.

## The order, and why this order

### 1. WATER AS BEADS, at ocean scale

The engine is in and its LIQUID kind works. What is missing is the ocean, and
the reason it is missing is cost: the island sea as beads is millions of cells
that would all be awake at once. It needs the on-demand shell - depth read from
the block below, computed only where something touches it - plus the two binds
and accumulated thickness for transparency.

### 2. THE 500 m SPHERE - the cost ceiling
### 3. WIND - the first field, and MORTAL rides with it
### 4. CELESTIAL - sun, moon, planet
### 5. THE SPIT - liquids as a weapon

## THE PROMPT

```
Bring sand.js into the game, entirely.

It is the falling-everything engine: flat, measured at 8.3 ns/cell, with dirty
rects worth 11,405x on settled material, materials whose behaviour comes from a
table, and reactions that are a row rather than a code path. It has been
benched in voxel/ for the whole project and never once run inside index.html,
and everything else on the list is queued behind it.

READ FIRST: voxel/sand.js, voxel/BEAD.md, and the vault note "The 500m sphere -
scope, state, and the boundary" - especially sections 7 and 8: everything
outside the simulated radius is SOLVED rather than frozen, and immortality is
what obliges a thing to be scheduled.

WHAT GOING IN MEANS

  1. The RAW grains in index.html become sand.js cells. They already collide,
     slump and pile with per-material slip, density and spread - that logic is
     a reimplementation of sand.js's and should become the real thing.
  2. Water stops being solid blocks. sand.js's LIQUID kind already finds its
     level; the island sea should be it. Water spread flat to 17.45 m in the
     RAW test where sand coned at 1.00 m, so the behaviour is proven and only
     misplaced.
  3. Reactions arrive with it - fire and oil, lava and water, acid and rock.
     They are rows in RX, and the game has never had any of them.
  4. The dirty rect is the whole reason it is affordable. Settled material must
     cost nothing, and the bench proving it must still pass afterwards.

WATCH FOR, all paid for already:
  - sand.js is a bounded flat box with a ROCK border; index.html's world is a
    block grid. The mapping between them is the actual work.
  - the instance batch holds 10,464 and drops geometry SILENTLY when full. Cap
    what is DRAWN, never what is simulated.
  - never put a tilde in a bench's log text: the pages join their lines with it.
  - a quoted bash heredoc still collapses backslash pairs, so a python splice
    searching for a JS newline literal matches nothing. Anchor on
    backslash-free text.
  - do not run 1,200 frame() calls with rendering on in a screenshot harness;
    it blocks the main thread and reads as an endless loop.

Verify with agy at ?lightx=3. Push after every change. Small case first -
Apprentice is 300 cells, the dungeon is 7,776. Marcelo plays the build, so say
plainly what is untested rather than implying it works.

EXPECT THE WATER TO LOOK SUBTLY WRONG, and do not treat it as a bad port.
sand.js uses SIX neighbours - faces only - which is right and cheap for powders
and solids, because they do not rotate. It is also the configuration that makes
FLUIDS anisotropic: flow prefers the axis directions and a vortex comes out
square. That is the known lattice-gas failure and the reason lattice-Boltzmann
exists. The fix is 26 neighbours (D3Q27) for the LIQUID kind only, 6 for
everything else - but it is a SECOND job. Doing both at once makes it
impossible to tell which change caused what.

Then, in order: 26-neighbour liquids, the 500 m sphere and its three tiers,
wind + MORTAL, celestial records, the spit.
```
