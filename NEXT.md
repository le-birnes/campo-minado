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


## THE THREE SCALES, settled 2026-08-07

> "World lattice is 1.5 blocks, minesweeper blocks (mines and safe and
> empty-number-containing) are actually 3x3x3 blocks."

    LAT    1.5 m    the world lattice. Terrain, the island, the house, walls.
    CELL   4.5 m    3x3x3 LAT. BUILT 2026-08-07. The page is the LAT block now,
                    not the cell, which is what let the cell edge stop having to
                    be a power of two beads - and it is where promotion belonged
                    anyway, because what settles into one record is a lump of
                    material and not a square of a puzzle. LADM, LADB and LADS
                    count LAT blocks; a cell is 27 pages. The minesweeper cell: a mine, a safe block, a
                    number. Comfortably taller than the 2 m player, so a carved
                    cell is ALWAYS passable and the generator never has to think
                    about fit again.
    BEAD   LAT/8  = 18.75 cm   loose matter, the standard
           LAT/16 = 9.4 cm     an intact LAT block being fragmented

AND SEPARATING THEM IS THE POINT. They have been one number by accident, never
by design, and every problem of the last two days came out of that:

  * at 2.8 m the CELL was right and the LATTICE was too coarse to be terrain -
    you could not see over anything and an island was a staircase of boulders
  * at 1.0 m the LATTICE was right and the CELL was SMALLER THAN THE PLAYER, so
    a one-cell corridor could not be entered, the collision pushed him out of
    the geometry and the world fell away
  * at 1.5 m with no split, neither is right: the lattice is good and a cell is
    still shorter than he is

With the split each number answers only its own question and there is nothing
left to trade off.

### WHAT IT COSTS TO BUILD, honestly

The page store already assumes PAGE = BLOCK = the thing the ladder promotes, so
splitting them touches:

  a. PGS stays 8 and a PAGE becomes one LAT block, not one cell
  b. the block arrays (G.st, G.mat, G.mine, G.cnt) split in two: the WORLD at
     LAT resolution, and the BOARD at CELL resolution with the mines and counts
  c. reveal, the flood cascade, the numbers, the crack graphic and the HUD are
     board-side and work in CELLs
  d. rendering, collision, the sand grid and the ladder are world-side and work
     in LAT
  e. shooting a cell opens its 27 LAT blocks

(b) is the whole job and it is also EXACTLY WHAT THE WORLD REDESIGN NEEDS: the
board stops being the world, which is the same sentence as "a stored world has
an edge". Do them together or the second will undo the first.

## THE WORLD REDESIGN - his brief, and it is the next build

> "Emergence doesn't work because you need to COMPLETELY REDESIGN the dungeon
> world. When a player enters dungeon mode a WHOLE WORLD should be generated -
> open, with a reachable moon and sun, an island, and a dungeon beneath the
> island. Player starts inside that dungeon. Currently you've been generating a
> dungeon and trying to add stuff. Forget all that, design a world with a
> dungeon in it."

> "Consider what I already told you about planet radius, so if I go on shooting
> down I'll be propelled up in a way I'll be able to see the planet and leave
> atmosphere."

### WHY EVERY ATTEMPT HAS COME OUT A BOX

The world is STORED, and a stored world has an edge by definition. G.st, G.mat
and G.mine are dense arrays of nx*ny*nz, so "the world" is exactly as big as the
array and the array ends in a wall. Everything since has been decoration hung on
that wall: a cylinder cut out of the array, an island written into the array, a
sea flood-filled through the array. His aerial photographs are what that looks
like from outside - a lit box with a tree in it.

The bead grid had the identical disease and one sentence cured it: A VALUE IS A
FUNCTION OF POSITION UNTIL SOMEBODY CHANGES IT, AND ONLY THE CHANGES ARE STORED.
That is what the page table is. Apply it to the BLOCK layer and the world stops
having a size at all - there is nothing left to have an edge.

### THE PLANET IS NOT DECORATION, IT IS THE FIX

Gravity is -Y times a sign. Make it a VECTOR TOWARD A POINT and three separate
problems collapse into one:

  a. THE HORIZON IS FREE. Terrain becomes height(x,z) over a sphere of radius R;
     the ground curves away instead of stopping. No wall, because there is no
     edge to put one on.
  b. HIS SHOT WORKS LITERALLY. Momentum is already going to be a law of the
     engine (item 0), so shooting down pushes you up; keep doing it and you pass
     the point where g falls off as 1/r^2 and you are in orbit looking at the
     planet. Nothing is scripted, and escape velocity is a CONSEQUENCE of R and
     g rather than a flag.
  c. THE GRAVITY FLIP STOPS BEING A SPECIAL CASE. Reversed gravity is the sign
     of the same vector, so gsign, upSign, eyeOff and the camera roll all become
     one rotation of one direction.

R is a design number. Pick it from HOW FAR HE SHOULD SEE - with g = 20 m/s^2 a
few kilometres puts the horizon a few hundred metres off - and let escape
velocity fall out of it, never the other way round.

### THE ORDER OF GENERATION INVERTS

Every build so far has gone dungeon -> crop -> island -> sea -> sky, each step
fighting the last. It must run outward:

  1. THE PLANET: R, g, sea level, atmosphere depth. Records, no storage.
  2. THE SEA: one level over the sphere. A record.
  3. THE ISLAND: height(x,z), a smooth bump above sea level. A function.
  4. THE SEAMOUNT: the rock under it, down to the seabed. The same function.
  5. THE DUNGEON VOLUME: a region inside the seamount. THE ONLY AUTHORED PART.
  6. THE BOARD: mines and counts, in the dungeon's own small dense array at CELL
     resolution. The world never learns what a mine is.

Then the shell is not a cylinder cropping anything - it is wherever the dungeon
volume meets rock nobody has dug, which is the shrink-wrap 0e wanted and could
not have while the dungeon WAS the array.

AND THE EMERGENCE STOPS NEEDING MACHINERY. You are in a cave inside a mountain
under an island. The boss opens the last blocks of a shaft that has been there
since generation. You climb it. Nothing is revealed, nothing is built, nothing
moves - which is what he asked for in the first place.

### THE TWO BEAD SCALES - his rule, and it is a PAGE property

> "Inert materials (materials that don't dissolve or merge with water just by
> touching) can have a bead of BLOCK/16, like wood. If said wood is on fire, it
> becomes a BLOCK/8 bead of wood on fire. Acid and lava too. So we use BLOCK/8
> as standard and BLOCK/16 only when we want to destroy things in a fun way - I
> like shooting a block and watching it become fragmented, so BLOCK/16 can exist
> INSIDE a block so there is realistic damage, but when material is OUTSIDE a
> block it becomes BLOCK/8."

This is the ladder pointing DOWNWARD for the first time, and it is nearly free
because a page is already a pointer: LET THE PAGE CARRY ITS OWN RESOLUTION. 8^3
= 512 cells normally; a LAT block being shot swaps to a 16^3 = 4,096 page so the
damage is fine-grained; anything leaving the block coarsens to LAT/8 on the way
out. Fire, acid and lava coarsen it IN PLACE - wood at LAT/16 that catches
becomes LAT/8 "wood on fire" - which is his rule and is also exactly right:
the fine scale is for a SOLID, and nothing burning, running or dissolving is a
solid any more.

One byte a page for its resolution, and one function each way. Every reader
already goes through cGet, so they all get it for nothing.

### THE CONSTRAINT THAT IS NOW PERMANENT

    P_H 2.0    LAT 1.5    so THE PLAYER IS TALLER THAN A LATTICE BLOCK

Nothing may be carved one LAT block high, ever. At LAT 1.0 this was not a
warning, it was the bug: a one-block corridor is smaller than the player, the
collision pushed him out of the geometry, and the world fell away - "structures
rapidly falling out of vision and the game leaves me flying in the nowhere". The
CELL at 4.5 m is what makes this safe for the puzzle; anything carved OUTSIDE
the puzzle still has to obey it by hand, and a harness has to check it with the
player's actual bounding box rather than block by block, because block-level
connectivity cannot see a corridor you do not fit down.

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

### 0e. THE WORLD IS BIGGER THAN THE DUNGEON - DONE 2026-08-07

> "Proceed to build world and functioning dungeon (it is being generated with
> 1 or 4 mines sometimes)."

Measured over six seeds it was worse: 0, 1, 4, 7, 10, 12 mines. One seed had
NO MINE AT ALL.

The generator was never at fault. It laid out a whole board across the whole
grid, and buildOuterWorld then kept only what fitted inside a cylinder sized as
a FRACTION OF THE BOARD - 0.36 of 18 blocks, minus a three-block shell, is a
tube about seven blocks across. Most of the dungeon was made and then thrown
away, and its mines went with it.

So the inversion: THE INTERIOR IS SIZED BY THE DUNGEON AND THE WORLD IS WHAT IS
LEFT OVER. dungeonGeom() decides the geometry once and both callers read it;
dungeonBox() is the largest box that fits inside the shell; shapeDungeon() digs
in that box's own coordinates through dgi(), so nothing it makes is ever
cropped. DUNGEON is 46x40x46 blocks and DUN_W - the playable width, the old
whole board - is 18.

    before   0 to 12 mines, 6 of 6 not a game, connectivity broken on all six
    after    51 to 68 mines, 6 of 6 a minesweeper, 100% connected on all six

AND IT IS AFFORDABLE ONLY BECAUSE OF 0a: the sea is 39,660 blocks and 162
MILLION cells of brine, held as ONE mass, and the whole bead grid is 1.11 MB.

AND ONE THING THE SIZE BROKE, which is the kind that does not announce itself:
worldB held 20*26*20+64 = 10,464 instances and the new world asks for 15,280.
A cube batch DROPS WHAT DOES NOT FIT IN SILENCE, so a third of the world simply
was not drawn and nothing said so. tools/h_batch.js measures it now, on three
seeds, in the dungeon and again on the island.

STILL OWED HERE: the shell is still a CYLINDER and the repair BFS is still
needed, because a box inscribed in a cylinder wastes the corners. A true
shrink-wrap of the dug volume would need neither. It is no longer urgent - the
dungeon is a dungeon and it is connected - so it is a shape question now rather
than a playability one.

NOT PHOTOGRAPHED. h_islandshot times out at 240 s on the bigger world: the
draw path itself returns in milliseconds (h_batch calls sandDraw and gets 5,000
instances back), so it is the headless virtual-time interaction rather than a
loop, but THE ISLAND HAS STILL NEVER BEEN SEEN FROM OUTSIDE and this made that
harder rather than easier.

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


### HARNESS UNIT DRIFT, owed 2026-08-07

h_ladder and h_sparse's tank sections build their tanks in CELLS and hand
those numbers to cFreeBlock, which speaks in PAGES - so h_ladder promotes 9
of a "25 block" tank and h_sparse's heap is poured into rock and cannot
fall. Neither is an engine fault: h_sand is the independent bench and it
passes on every count (pile round at 0.94, sand heaps 9 across and 30 tall,
water spreads 14.75, a settled world scans zero). Update their units.


### THE ISLAND, PHOTOGRAPHED AT LAST - 2026-08-07

tools/h_see.js, and the picture is A GIANT BLACK CUBE STANDING IN THE SEA:
sharp square corners, a flat top with a few lit tiles on it, dark water
around it, sky above. That is his 'big box around the tree', measured.

THE ISLAND IS NOT AN ISLAND. buildOuterWorld fills the whole array below
the beach line as seamount instead of shaping a bump, so the seamount IS
the board and a board is a cube. The sand slope, the beach, the tree and
the house have all been hung on the outside of it.

Four things the camera had to learn, all facts about this world:
  - down is +Y after the boss, so the SKY is at small y
  - the pitch sign flips with gravity; the obvious sign photographs sky
  - the world has to be PAUSED or the physics buries the photographer
    (the second attempt photographed a game over reading YOU ARE SAND NOW)
  - darkNow() only gives daylight when G.island is set, so a paused world
    with a cold clock renders as a cave at midnight

SEEN AND NOT CHASED: the end screen reads 'You opened 443 of 247 blocks'.


### THE ISLAND WAS WIDER THAN THE WORLD - found 2026-08-07

RISL, how far the island's sand reaches, came out at 14 on a 26-wide grid
whose half-width is 13. So the island ran to the edge of the array in every
direction and THERE WAS NO OCEAN IN THE WORLD AT ALL. The sky shader has
been drawing an endless sea below the horizon since the day it was written -
uSea, with the horizon as a LINE rather than a fade - and none of it could
ever be seen, because a slab of rock stood in front of it everywhere.

The fill also ran to y < G.ny, so the island was a slab down to the last row
of the array rather than a mountain with its foot on a seabed.

Fixed: world 40x40x38, six cells of open water outside the island, fill
stops at a sea floor. 54-63 mines over six seeds, connected every time, and
a body fits everywhere in both modes.

THE LESSON, AND IT IS THE SAME ONE AS THE PAGED GRID: the endless sea was
never the hard part. It is a RECORD and it always was. What was hard was
that I kept trying to STORE the ground, and a stored thing has an edge, and
the edge was nearer than the island.

NEXT, with his number: R = 600 km. The horizon is sqrt(2*R*h) away - 2.8 km
from an eye 2 m up - and dips 0.0026 rad below level. Both go straight into
FS_SKY, which already has the sea and the horizon line in it.


### THE SQUARE IN THE SKY - measured 2026-08-07, and it is the last box

From high above, the whole world is A SMALL FLAT BLUE SQUARE floating in dark
blue. That is not a bug in anything I have fixed this week - it is the world
being exactly what it is: 180 m x 180 m of stored blocks, seen from outside,
with the sky shader's flat sea colour behind it.

HIS LOG SAYS THE REST IS WORKING:

    peak=5880 scan/s=11760      the physics DOES run - and the earlier
                                scan=0 was my snapshot logger lying
    peak well under 217,961     the seven-metre ceiling is holding
    pages 154, MB 15.7          the paged grid is doing its job
    119 fps throughout          no slowdown anywhere in the run
    bead_inst 294 to 887        beads ARE drawn now, but only a few hundred

SO WHAT IS LEFT IS THE ONE THING NEVER BUILT: THE PLANET.

FS_SKY draws the sea as a COLOUR below the horizon line - uSea, with h =
dot(dir, uWorldUp) as the only geometry. There is no surface, no distance and
no curvature, so from 500 m up the ocean is a flat wash behind a square of
real blocks, and no altitude will ever make a planet shrink.

THE CHANGE, and it is contained to one shader:

  a. two new uniforms: uR (600 km, his number) and uH (the camera's height
     above sea level). Nothing else in the engine needs to know.
  b. put the planet's centre at -uWorldUp * (uR + uH) relative to the camera
     and INTERSECT THE RAY WITH IT. b = dot(dir,C), c = dot(C,C) - uR*uR,
     t = b - sqrt(b*b - c). A hit is ocean at distance t; a miss is sky.
  c. shade the hit as uSea faded toward uHoriz by exp(-t/k), so it goes to
     the horizon colour at the horizon instead of stopping at a line
  d. and the horizon then falls out of the arithmetic rather than being
     drawn: sqrt(2*R*h) is 2.8 km from an eye 2 m up and 78 km from 500 m,
     which is what makes going up feel like going up

It also gives the atmosphere for free - fade the whole sky toward black as
uH passes the scale height - and it is the last thing standing between this
and 'the planet getting smaller and eventually enter space'.

AND ONE MORE, SMALLER: bead_inst peaks at 887. The bead pass is drawing a
few hundred where it has a budget of 22,000, so 'the beads are not showing'
is still half true even though they are no longer struck off the list. The
chunk candidate loop only considers chunks with cl set and within
SAND_DRAW_R, and something in that path is still rejecting most of them.


## WHAT AGY SAW, AND WHAT THE NUMBERS SAY - 2026-08-07

He sent a video and a log and asked agy to watch it. agy, blind, without being
told what to look for:

  "The sky and upper environment are clearly rendered on THE INNER SURFACES OF
   A LARGE CUBE surrounding the player, with visible straight lines and sharp
   corner seams overhead. Light blue with white square cloud patterns on the
   sides and orange-tinted square patterns on the flat ceiling plane above."
  "There is NO WATER visible anywhere in the clip."
  "No sun, moon, or stars visible."
  "Remaining blocks hang completely unsupported in mid-air after adjacent
   blocks are shot away."
  "Glowing yellow mine numbers float disconnected in space when their host
   blocks are destroyed."

THAT IS NOT THE SKY SHADER. The shader is a seamless gradient with a sun in it.
A cube with faces and seams, light blue with square patterns, is BLOCKS - and
blue with pink squares is the sea's own colour. The ocean was being drawn as a
shell around and above him, hiding the real sky completely, which is also why
no planet ever appeared however high he flew.

AND THE LOG NAMED THE SHOT IN ONE LINE:

    EVENT  blast: 2 caught, 2 broke, 0 shoved, 2 thrown, 0 left, 0 collapsed

Two cells, where the same blast in a tank caught 8,813 - because the tank had
been voxelised first and a wall has not. FIXED: the blast opens every block it
covers before it gathers. 2,748 caught now, and the block collapses and becomes
passable.

BUT THE VIDEO PREDATES THE LAST THREE COMMITS, and the box has to be re-checked
rather than assumed. tools/h_updown.js measures it now: standing on the island
in the CURRENT build, over his head is "nothing but air", and there are ZERO
lattice blocks of sea within forty-five metres of him in any direction. So the
shell agy described is gone from that spot at least - liquids stopped being
drawn as one mass box, and stop being drawn as blocks past forty-five metres.

NEXT, AND IN THIS ORDER:
  1. a fresh video and log on the current build - if the box is still there it
     is something else and h_updown will find it, because it asks WHERE the
     geometry is rather than whether it exists
  2. FLOATING BLOCKS. agy: blocks hang unsupported when their neighbours go.
     The block world has no gravity - only the bead grid does. A block whose
     support is gone should fall, or should come apart into beads that do.
  3. ORPHANED NUMBERS. The glyphs are drawn from G.cnt at a block's position
     and nothing removes them when the block collapses.
  4. and the two still open from before: swimming down (0b) and shooting
     underwater (sandRayHit returns the cell at your own face).


## THE BOX, MEASURED AT LAST - 2026-08-07

tools/h_highup.js puts the camera at four altitudes and asks each draw pass
what it emitted and WHERE - the bounding box of the instances, in metres.

    60 m up    BLOCK pass 13,292 instances spanning 185 x 176 x 185 m
    200 m up   BLOCK pass 13,292 instances spanning 185 x 176 x 185 m
    1200 m up  BLOCK pass 13,292 instances spanning 185 x 176 x 185 m
               BEAD+MASS  nothing, at any of them

IDENTICAL AT EVERY HEIGHT. So the square he photographs from altitude is the
world's own surface - 13,292 blocks, correctly drawn - and at 1,200 m those
blocks are subpixel and average into ONE FLAT LIGHT-BLUE SQUARE with the
array's square footprint. The stepped edges are the block boundary at the
world's edge.

THAT IS NOT A RENDERING BUG. THE WORLD IS 180 m ACROSS AND 180 m SEEN FROM
1.2 km IS A SMALL SQUARE. No shader fixes it. Three real options:

  a. MAKE THE ISLAND LOOK LIKE A COAST rather than a plate: the seabed should
     rise to it from outside the array, so the block world's edge is UNDER
     water and the shader's ocean covers the seam. Cheapest by far, and it is
     what a real island looks like from the air.
  b. TERRAIN AS A FUNCTION past the array - height(x,z) sampled by the shader,
     so land continues beyond what is stored. This is the world redesign.
  c. DON'T LET HIM GET THAT FAR without something else to look at. Weakest.

(a) first. It is a change to buildOuterWorld, not to the renderer.

AND THE CEILING HE IS TOUCHING IS THE HOUSE. Layer by layer above the beach
(down is +Y, so small y is UP, and the beach is y 8):

    y 0-3   59, 50, 32, 22 blocks of mat9   the tree's canopy
    y 4     182 blocks of mat8              A FLAT SLAB OF WOOD
    y 5-7   72, 102, 105 of mat8            more of it

461 wooden blocks stacked over the beach in a slab a hundred and eighty metres
wide. The house was authored in BLOCKS when a block was 2.8 m; at 4.5 m it is
1.6 times bigger in every axis, and its roof now spans the whole air gap above
the island. That is the ceiling with the orange panels - they are its lit
faces. buildVials sizes the house in blocks and needs to size it in METRES.


## THE WORLD OCCUPIES EVERYTHING - one height function, two consumers

> "World should occupy everything, until the horizon, forming a giant
> lump-sphere-like planet. This is direct and simple."

It is, and it is the same shape as every fault in this project: ONE FACT, ONE
OWNER. The fact is how high the ground is at a point. Today it has one owner
(landY) and one consumer (the array), and the array ends.

THE WHOLE CHANGE, IN ONE SENTENCE: H(x,z) - the planet's height above sea
level - becomes the single source of terrain, and gets a SECOND CONSUMER: the
sky shader, which marches it for everything the array does not store.

    landY(x,z)  ->  H(p)      one function, deterministic, no storage
      consumer 1: buildOuterWorld samples H into the array, near you
      consumer 2: FS_SKY marches H along rays that miss geometry

Both read the SAME function, so the block world and the drawn world agree
exactly where they meet. THERE IS NO SEAM TO HIDE, AND THEREFORE NO BOX TO
HIDE IT WITH - the bedrock shell existed only because the array had an edge
that nothing accounted for.

WHAT H SHOULD BE, three octaves each doing one job:
    CONTINENT  a few big lumps placed by hash over the sphere - mostly ocean,
               which is what makes an island an island
    ISLAND     the existing landY profile: a bump from the seabed, flat-topped
               where the dungeon is buried, sloping to a beach
    DETAIL     noise, only within a few hundred metres - past that it is under
               a pixel

HOW THE SHADER DRAWS IT. It already ray-intersects the sea sphere; terrain is
the same intersection with a bumpy radius, marched rather than solved:
    1. ray vs the sea sphere gives t_sea - the far bound, and the horizon
    2. march from the eye toward t_sea, step growing with distance
    3. |p| against R + H(p); the first step under the surface is land, and a
       bisection of the last two steps is the hit
    4. shade by height and slope, fade to the horizon colour with distance
    5. no hit before t_sea means water
Sixty-four steps is plenty with a geometric step: the horizon is 2.8 km at eye
level and detail past a few hundred metres is invisible anyway.

WHY IT IS CHEAPER THAN IT SOUNDS:
  * the array stops needing to be big - it only holds what you can DIG
  * it DELETES code: the bedrock shell, the RISL clamp, the sea flood-fill from
    the world's edge, and the outside-the-array case in blocksBody all exist to
    paper over an edge that stops existing
  * the seam problem INVERTS: the array becomes a high-detail PATCH over a
    surface that is already correct - the same relationship the bead grid has
    to the block world, one rung up
  * and travel falls out: moving far means RE-CENTRING the array and
    re-sampling H, not generating a new world. The dug pages are the only thing
    that has to be remembered and they are already sparse and keyed by position

THE ORDER TO BUILD IT:
  1. H(x,z) extracted from landY, pure, with a harness that samples both at a
     thousand points and asserts they agree
  2. FS_SKY marches H. The island continues past the array in the picture, and
     THE BEDROCK SHELL CAN BE DELETED rather than skipped
  3. buildOuterWorld stops clamping at RISL and samples H over its own extent
  4. only then: re-centring, and travel

Step 2 is the one he can see, and it is one shader.
