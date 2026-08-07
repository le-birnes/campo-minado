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


## THE LIST - done 2026-08-07

Run in the order Marcelo gave: 4, 5, 1, 2, 3, then 6 to 10. Two more (11, 12)
came out of him playing it while the list was running.

| | | proof |
|---|---|---|
| 1 | Spin the PLAYER, not the camera | h_spin.js |
| 2 | Sun, moon, sky, horizon | h_skyshot.js |
| 3 | The island you actually land in | h_ocean.js |
| 4 | The promotion ladder: bead, block, mass | h_ladder.js |
| 5 | The ocean as fluid, the dungeon breachable | h_ocean.js |
| 6 | Water to vapour to air, with humidity | h_mortal.js |
| 7 | The Noita material table (80 materials) | h_sand.js |
| 8 | HP as a number, Noita's damage | in h_spit.js |
| 9 | The spit | h_spit.js |
| 10 | The slow pour, and the house | h_spit.js |
| 11 | Water opacity that grows with thickness | by eye |
| 12 | Swimming and shooting IN the water | by eye |

### The four things that were actually wrong, and what they cost

1. **THE WORLD WAS UPSIDE DOWN.** Gravity is reversed and stays reversed, so
   down is +Y - and buildIsland built everything MIRRORED, which put the chunk
   of rock you had just climbed out of directly overhead like a lid, with the
   tree underneath it. "A box of wall/lava/stone" was a box because it was a
   box. Two sessions of counters said the island was fine.
2. **THE FLIP WAS A CAMERA ROLL.** A real rotation, and still wrong: it turned
   the picture about the view axis while the body never changed, so the mouse
   yawed in the old frame. The fix is one multiply and where it goes is the
   entire fix - on the INPUT.
3. **AN AGE DID NOT TRAVEL WITH THE THING WHOSE AGE IT WAS.** sMove zeroed the
   age of anything with a life every time it moved, and a gas moves every tick,
   so steam and smoke were immortal. Years old. Found by asking where the water
   went.
4. **THE SEA WAS SCENERY.** Blocks you stood on. Nothing to breach, no water to
   come in.

### What the ladder bought, in one line

A settled ocean of 2,168 blocks and 8.9 million cells scans **zero** cells over
ninety ticks, and evaporation cannot touch it - because a promoted block's
chunk is never scanned, so only loose material is ever asked whether it is
drying out.

### Still open

- **Three-way reactions.** SRXP is a*256+b, so Noita's alchemy recipes
  (silver + copper + blood) have nowhere to put the third reagent. A CATALYST
  column - the pair reacts only when a third material is in the
  26-neighbourhood - is cheaper than an intermediate and truer to what Noita
  does.
- **Glass is a powder** and should be a solid that shatters.
- **Fire needs fuel and oxygen**; it is a material with a lifetime.
- **Steam does not condense back** on a cold surface. The loop is one-way.
- **TRIPPING and INVISIBLE are still labels** - no colour shift, and enemies do
  not read invisibility.
- Liquid isotropy is 0.88 against the powders' 0.97. Quantisation at spread 5.
- The **dungeon bot ceiling** at 41% is still unexplained.

## PRIORITY, RESTATED BY HIM 2026-08-07

> "World and physics have top priority, then cosmetics."

### 0b-first. WHAT ACTUALLY STOPS THE EMERGENCE - measured 2026-08-07

h_ocean has said "there is no way out" for as long as it has been asked, and I
had been reading that as the swimming. It is not. The harness now prints the
column and the body, and the answer is:

    the column above you at 9,9 (from y 23 up to 0): ........................
    the hole was blown at 9,9; you are at 9,9; first solid block above you is
      y -1, so THE WAY IS OPEN and the swimmer cannot climb it
    vy 0.00  imm 0.01  immD 2150  sub 0.00  ground true  load 0.00

So: the passage is clear for its whole length, the player is standing on dry
ground at the bottom of it, and there is NOTHING TO SWIM IN. imm is 0.01 and
sub is 0.00 - the well over the dungeon is not flooded where the player is
standing, which is the one thing the design said would carry them up.

They rise five blocks on the 24 m/s impulse bossBlows gives them and fall
straight back. Three candidates, all measurable, none of them the swim solver:

  a. THE WELL IS NOT FLOODED at the bottom, so there is no water to rise
     through. The sea flood-fill walks down the well from the island surface;
     find out where it stops and why.
  b. RULED OUT. The jump DOES repeat while held - index.html line 10449,
     "if(!IN.jumpFired && canJump() && (IN.jumpHeld || IN.jumpBuf>0)) startJump()"
     - and there are twenty of them before your feet have to touch anything.
     So the harness is holding the key correctly and the player still cannot
     climb. It is (a) or (c).
  c. THE DIRECTION. Down is +Y after the boss and the sky is at small y, so
     leaving means going UP AGAINST GRAVITY for sixteen blocks. If that is
     right, the emergence needs the flooded well (a) or a current, and no
     amount of kick will do it.

Do (b) first: it is one grep and it decides whether the other two matter.

### 0f. THE SEVEN-METRE SPHERE, AND WHAT WATER IS - his words, 2026-08-07, DONE

> "Scaling should prevent a large amount of beads, making MAX COMPUTED BEADS
> only what fits a 7 m radius sphere around the player. Everything else should
> be just blocks or large bodies stored as info. Water should no longer
> evaporate spontaneously, it should merely be mortal when in the form of beads
> AND NOT IN THE AREA OF A BLOCK OF WATER. A block of water is considered so
> once there are AT LEAST BLOCK/8 beads of water in it."

Both built. Three parts:

  a. THE SPHERE IS A CEILING, not a heuristic. 7 m at 17.5 cm a bead is 268,083
     cells and that is the most one tick may look at, whatever is falling.
     A chunk outside it goes back on the awake list exactly as it was - nothing
     lost, nothing decided early - and starts again when you walk over.
     Measured on the tick gravity reverses and six million cells of ocean wake:

         without the sphere   8,978,432 cells in ONE tick  (33x over)
         with it              0, and 274 chunks left for later

  b. A BLOCK OF WATER IS BLOCK/8 OF IT - 512 of 4,096 cells, two beads deep
     across the block or any arrangement holding as much. LADB, a second and
     looser rung beside LADM: LADM says "every one of my cells is this", which
     is what lets the page be freed; LADB says "there is enough of this here to
     be a BODY", which is what decides whether a bead is alone.
  c. SO WATER NO LONGER EVAPORATES SPONTANEOUSLY. A bead is mortal because it
     is ALONE - a splash on a rock, the last of a spill - and a bead on the sea
     is not alone even with open sky over it, because its block is a block of
     water. Heat still overrides all of it.

     And (c) is what stopped the ocean costing 27 MILLION cells a tick: every
     surface cell had open sky, so it stayed awake "or it would never find out",
     and staying awake means touch(), and touch() means mark(), and mark() on a
     chunk holding promoted blocks DEMOTES one. The sea demoted its own top
     layer every tick for ever. h_ocean: 43 s -> 0.7 s.

  STILL FROZEN, NOT SOLVED. A chunk outside the sphere is PAUSED, so a
  waterfall thirty metres away stops in mid-air until you walk to it. The vault
  note "The 500 m sphere" says everything outside the simulated radius should be
  SOLVED rather than frozen - given a block of falling water and no observer,
  compute where it ends up rather than stepping it. That is the next rung and it
  is what (a) makes possible rather than what it delivers.

### 0b. SWIMMING - one solver, three consumers

> "I can't swim down! When I enter water I should be able to swim DOWN (or up),
> and also shooting is no longer propelling me upwards or downwards - I used to
> swim down by shooting up."

Half of it is fixed: the recoil is real momentum on all three axes now, so
shooting up pushes you down, and a downward kick cancels buoyancy instead of
losing to it. What is still owed belongs with 0 rather than with the controls:

BUOYANCY IS A FORCE AND SO IS A KICK, and they should be SUMMED AS FORCES.
Right now one is an acceleration and the other is a lerp toward a target
velocity, which is exactly why swimming down felt like fighting something - it
was. A kick has a direction (the aim) and a magnitude (how hard); drag opposes
it in proportion to speed; gravity pulls; buoyancy is displaced mass. Four real
terms and no target velocity anywhere.

Density then decides everything without anybody tuning it: a person is about
1,000 and brine is 1,025, so you float slightly; fresh water is neutral; mud at
1,400 you cannot get down in; oil at 900 you sink through.

And the same solver is what the rocket in item 0 needs - thrust is a force with
a direction, drag opposes, gravity pulls. ONE SOLVER, THREE CONSUMERS: the
swimmer, the bead, and the rocket.

### 0a. THE SPARSE GRID - DONE 2026-08-07, and it is what unblocked the rest

A cell no longer has an address in one array. It has a PAGE - exactly one
BLOCK, 16^3 cells - and a page is a pointer that is usually NULL, meaning
"every cell in this block is material pgu[b]". One byte instead of four
thousand. Allocated by the first write that differs from what the block
already is; FREED the moment a census finds it uniform again.

Which is his own ladder one rung up: bead, block, mass, and now the block rung
is the STORAGE rung as well as the bookkeeping one, so ladPromote/ladDemote ARE
the free list. The page is a BLOCK and not a chunk because sandFill, voxelise,
voxCarve and ladCensus were every one of them already written in units of a
block - the boundary was drawn, it just had nothing behind it.

Measured, tools/h_sparse.js:

    fresh 288x384x288        0 pages, 0.13 MB   (was 31 MB up front)
    ten times wider          9.62 MB            where flat is 3,058 MB
    HIS CYLINDER 100x1000 m  5.9 MB             where flat is 1.76 GB
      and its shell, 6,048 blocks of solid rock, costs ZERO pages
    the dungeon at rest      0 of 13,552 pages, 0.13 MB

WHAT IT COST. The flat index had to go with it - a cube-shaped page cannot
support i+1 - so every probe is by (x,y,z) through cGet. h_sand 1.0s -> 1.3s
wall, about thirty per cent on cells actually simulated; still zero at rest.
The pathological case (the ocean demoted bead by bead) got about twice as slow
because demotion now allocates and fills a page, and THAT WORKLOAD IS ITSELF
THE BUG - 0e removes it. Roundness 0.97, water isotropy 0.85 and every reaction
come out to the same digits, so the rules are unchanged.

AND ONE BUG WORTH THE NAME: S_AIR is material 0, so "0 means this block has
cells" and "0 means this block is air" were the same byte, and a block of pure
air is the commonest uniform block there is. It crashed the draw pass loudly
and leaked the page of every hollowed-out block silently. Uniformity answers -1
now. The loud one is why the quiet one was found.

Vault: "The wall was one line, and it was the array".

### 0a-was. WHY A 100 m x 1000 m CYLINDER WAS HARD (kept: the arithmetic)

> "Why is it so hard to build a cylinder like 100m wide and 1000m tall with the
> dungeon inside? We won't be able to have an open interactive world if we can't
> have ULTRA LARGE STRUCTURES to enter and explore. I told you it shouldn't even
> be a perfect cylinder but rather A SHELL AROUND THE FUNCTIONING DUNGEON."

THE CYLINDER IS NOT THE PROBLEM. The block world is cheap: 100 m is 36 blocks,
1000 m is 357, so 36x357x36 is 463,000 blocks and about 1.4 MB of Uint8Array.
That is nothing and it could be built today.

THE BEAD GRID IS THE PROBLEM, and it is one line of arithmetic. SandWorld
allocates ONE FLAT Uint8Array over the whole world at BLOCK/16:

    36 x 357 x 36 blocks  ->  576 x 5712 x 576 cells  =  1.9 BILLION  =  1.9 GB

That is the wall, and it is not near - it is a factor of sixty past what a
browser will give you. Today's 18x24x18 is 31 MB and it is already the biggest
single thing in the program.

THE FIX IS THE LADDER AT CHUNK GRANULARITY. The grid should not be dense over
the world; a chunk should be a POINTER that is usually null:

  a. `chunks[c]` is either null - meaning "this chunk is uniformly material M",
     one byte - or an allocated 32^3 block of cells
  b. it is allocated when something disturbs it, and FREED when it goes quiet
     and uniform again
  c. that is exactly what a promoted block already means, one rung up, and the
     awake-chunk list and the dirty rects already track precisely the chunks
     that would need to exist
  d. a few hundred live chunks is a few MB, and the world can then be any size
     at all - which is also the answer to the unbounded ocean in 0c. They are
     the same piece of work.

AND THE SHELL SHOULD WRAP THE DUNGEON, NOT CROP IT. This is the other half of
what he said and it is the more immediately useful half: a geometric primitive
laid over a finished dungeon CUTS it, which is what destroyed connectivity and
made the pocket repair necessary at all. A shell that is a SHRINK-WRAP of the
dug volume - dilate the dungeon's air by three blocks, make that stone -
touches nothing inside, needs no repair, and is a better shape besides. The
repair can then be deleted rather than improved.

### 0d. DUNGEON MODE HAS NO WIN CONDITION - it is the way in to a world

> "Dungeon mode actually has NO WINNING CONDITIONS. When the dungeon is
> completed and the boss is killed, the HUD should change (only health should
> remain, and add a thumb with a pixelated shotgun to indicate equipped weapon
> and two empty slots for belt equipment). Idea now is to create an OPEN WORLD
> in the game where we can interact, create and explore (at some point we'll
> build a rocket to go to the moon or sun)."

This settles the question 0c left open, and it settles it the good way: nothing
outside the cylinder has to be countable, because nothing is being counted. The
puzzle volume is the only finite thing in the game.

DONE: the HUD changes. Mines left, safe blocks and a clock are what a PUZZLE
needs to be told; a world needs to know what is in your hands. So the readouts
are not hidden one at a time - the body gets a class and the stylesheet decides
what a world looks like. Health stays, the belt appears, and the first slot has
a twenty-pixel shotgun drawn out of a string, one character a pixel, because
everything else this game owns is data rather than a file.

STILL OPEN, and it is what the world is FOR:
  a. INTERACT - the vial, the spit, picking things up, the two empty slots
  b. CREATE - placing material, building. The Forge already makes voxel things;
     the world needs a way to put one down
  c. EXPLORE - which needs 0c: an ocean with no edge
  d. AND THE ROCKET. He has said it twice now, and it is the reason momentum
     (item 0) must be a law of the engine and not a feature of the gun: a
     rocket is a thing that throws mass one way and goes the other. If
     conservation lives in shoot(), the rocket is a second implementation and
     the two will disagree.

### 0c. TWO MODES, TWO KINDS OF THING

> "Minesweeper 3D shouldn't be touched anymore (except the game mechanics, I
> mean the world). The dungeon mode, on the other hand, is actually an OPEN
> WORLD."

This is the correction that makes the rest tractable, and I had it wrong.

**MODE_SWEEP is a BOARD.** Finite by necessity - winning means revealing every
safe block, so it has to be countable - and it is finished. Its world is not to
be touched. buildOuterWorld already only runs for dungeon mode, so sweep has no
sky, no sea and no island, and that is correct and stays.

**MODE_DUNGEON is an OPEN WORLD.** The cylinder is a PLACE IN a world, not the
world. So the difficulty's dimensions size the PUZZLE INSIDE THE CYLINDER and
have no business sizing the ocean, the island or the sky. I built the world into
the board's array and then explained why the board has to be finite - which is
true, and irrelevant, because the ocean is not the board.

What follows from it:

  a. the CYLINDER INTERIOR is the countable part: mines, safe blocks, the win
     condition. Sized by difficulty. Unchanged.
  b. everything OUTSIDE it is world and belongs to nobody's count
  c. the sky, sun and moon are already records with no extent - done
  d. the OCEAN becomes one MASS RECORD, unbounded, with cells materialised only
     where something is happening and dematerialised when it goes quiet. A
     record has no extent problem, which is the whole reason this works
  e. the seabed is a record too - a plane at a depth - and the island is a
     generated surface rather than a region of the board array
  f. and ask whether dungeon mode's win condition is "reveal every safe block"
     at all. If the goal is the BOSS, the world is freed from countability
     entirely and (a) is the only finite thing left in it

The bead grid is the other half of the ceiling: BLOCK/16 over the whole board is
31 MB at 18x24x18, and ten times wider is a hundred times the memory. Which is
why (d) is the answer rather than a bigger array - cells exist where something
is happening, and nowhere else.

### 0. MOMENTUM - and it is a law, not a shot feature

> "Shooting a bead should make it fly forward very fast, LIKE A ROCK PELLET
> SHOT BY A REAL GUN would, if not destroyed. If gun surpasses bead integrity,
> then cool, but if not, item should be propelled (INELASTIC COLLISION, those
> rules should apply as I intend to, later, build damn rockets burning fuel and
> flying to the moon)."

It has to be written as a law because he is going to build on it. Momentum is
conserved: the shot carries p = m*v and delivers it. Two outcomes, one test
between them:

  * energy per cell EXCEEDS the material's INTEGRITY - a new column, how much
    it takes to break a bead of that material - and the bead is destroyed and
    becomes debris
  * it does NOT, and the bead survives and takes the momentum, leaving at
    v = p/m. Dense beads move slowly and hit hard; light ones are flung.

And a propelled bead must be able to break or propel what IT hits, because the
chain is the whole point. GRIT already carries per-bead velocity, so the flight
exists; what is missing is the collision that hands momentum on.

The same conservation is what a rocket needs - mass thrown one way, the vehicle
the other - so DO NOT SPECIAL-CASE THE GUN.

## WHAT MARCELO ASKED FOR NEXT, 2026-08-07, in his priority order

Full detail in the vault: "The emergence, the vial, and teaching agy the Forge".

> "Spit mechanics is not even secondary, it's TERTIARY. Most important thing is
> to fix world/dungeon/scenery, then physics."

### 1. THE EMERGENCE - no teleport, you CRAWL OUT

> "After gravity inverts I fall on the ceiling and then I get TELEPORTED
> outside the 'tree/house/sand' monstro, instead of crawling out of the dungeon
> where I can finally see the scenery."

The reveal is a JOURNEY, not a reveal screen. Gravity inverts, you fall onto
what was the ceiling, the hole the boss blew is above you, and you go UP it -
through the seamount, out at the top, and the world is there. Every step of
that already exists as geometry; nothing carried the player along it, so the
code moved them instead. Delete the placement and let the physics do it.

And the island is an AMALGAM of tree, house and sand: only the tree's TRUNK is
checked against the house footprint, so its branches and canopy grow through
the roof.

### 2. THE PHYSICS - the open items above

### 3. THE VIAL AND THE SPIT - a redesign, and it is tertiary

The mouth becomes a COUNT OF BEADS rather than a flag. Two ways to fill it: a
vial you have EQUIPPED (10 beads a drink, and the drink is animated - vial to
mouth, put it down, THEN you may spit) or EATING beads around you. About two
seconds to spit afterwards, and you cannot spit more than you took.

Touching and ingesting stay the same thing for DAMAGE and STATUS. The mouth as
a reservoir you can spit from is what now needs a deliberate drink. Two
mechanisms, both right.

### AND A SEPARATE TRACK: teach agy the Forge, then the DOOM bosses

Teach agy the Creature Forge - the voxel data format is a far better interface
than driving a paint UI. Review every creation with THREE shots at different
angles and different axis selections, against a reference if supplied or blind
against what agy thinks it is. First build a cottage; then redraw the bosses as
classic DOOM: volume (mass, thick limbs, a one-frame silhouette) and colours (a
small saturated high-contrast palette, no gradients).

agybridge stays a contractor: every entry point returns a Reply, never raises,
and the game works unchanged when it says no.

## THE QUEUE, as asked for and not yet built

1. **Water becomes vapour becomes air.** Spread thin enough, or hot enough,
   water beads are MORTAL: baseline t to vapour, t shifting with pressure and
   heat; vapour surrounded by air becomes air and raises its HUMIDITY by some
   percent. Asked for twice and still missing. It wants the same per-material
   lifetime column as (2), so build them together.
2. **The full Noita material table** - https://noita.wiki.gg/wiki/Materials -
   every material and every interaction, not the eighteen there are now.
3. **HP as a number.** 50 to start, a heart is 25, and damage comes from
   Noita's table. Touching and ingesting do what they do there.
4. **The spit.** Beads on a gravity arc from screen centre, strength on hold -
   the only way to throw a liquid, so throwing one always doses you mildly.
5. **The promotion ladder.** Enough beads filling a block become a BLOCK of
   fluid; enough blocks a MASS; each rung adds parameters and discards
   fine-processing events. This is rule 1 run backwards and it is what makes an
   ocean of beads affordable.
6. **Minecraft-style pour**: one block of water spills slowly until only
   scattered beads remain.
7. **The house has to READ as a house.** It is built and photographed and it
   does not - an unlit island, no windows, no light inside. Also: plaques carry
   no text, because the glyph batch draws digits and arrows only.
8. **Sun, sky, endless sea** through the hole. The reveal exists; the outside
   is still cave-black.
9. The 500 m sphere and its three tiers; wind + MORTAL; celestial records.
10. The dungeon bot ceiling at 41%, still unexplained.

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
