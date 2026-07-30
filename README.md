# Minesweeper — Three Planes

First-person Minesweeper. You don't look down at the grid: you're **inside** it, in a
three-layer sand cave, holding a staff.

**▶ Play: https://le-birnes.github.io/campo-minado/**

![Minesweeper — Three Planes](screenshot.png)

## What changes from classic Minesweeper

- **26 neighbors per block, not 8.** A cube touches 3×3×3 − 1 other cubes, so the number you
  uncover counts mines in your own plane, in the ceiling **and** in the floor.
- **Plane arrows.** A gold arrow pointing up means there's a mine in one of the 9 blocks
  overhead; a purple arrow down means the floor. When both planes have one, the arrows orbit
  the number. Press `T` to turn them off if you want it harder.
- **You shoot blocks** instead of clicking them. You can only hit what you can see, so line of
  sight became part of the puzzle.
- **Shoot a number** and every block it counts lights up for a few seconds. If those mines are
  already flagged, the shot **spreads** and clears the rest instead — flag the wrong ones and
  the whole cave goes with you.
- **Verticality.** Every jump clears 3× your height, and you get **twenty of them** before
  your feet have to touch something again. Air is a staircase.
- **Boss rules** are a switch, not a mode. Flag a block on any difficulty with them on and
  something may come out of it. Twelve kinds: four families in three tiers, and the tier is
  written in the colour — a I is washed out and pale, a III is deep and fully saturated.
- **A hint that shows its work.** `H` lights the numbers that prove the next move in cyan and
  the block they prove in green — press it again and it plays that move. It only ever reads
  what you can already see, never the mine layout. When nothing is provable, it says so and
  offers the safest guess in amber instead.

## The three arenas and the descent

**Apprentice** (6% mines), **Sorcerer** (11%) and **Arcane** (20%) are one open cave each.
Arcane is also the one arena with a *shape*: 60 × 16 × 60 m with pillars, walls and blocks of
indestructible structure taking 15–30% of the volume, so sightlines break and the shortest path
between two deductions is not a straight line. Its mine density is measured against the blocks
that are actually there, not against the bounding box.

**Boss Master** is not an arena at all. It generates a fresh dungeon every run: four level bands
in one 72 × 96 × 72 m grid, three dead-end minefields of 10–15 mines hanging off a corridor
network, and an arena of 20 at the bottom that you reach by falling into it. You start with your
back to the wall at one end of a straight corridor with the first minefield filling the far end
of it. Shafts between levels are wide, irregular, and stepped, so they are a climb as well as a
drop — which matters, because **you win by flagging every mine**, and a mine you walked away
from is a mine you have to come back to.

Buried in the safe blocks of each minefield there may be a **chest** — 70% one, 1% two. Open the
block and it floats in the space it came out of; shoot it and it gives up exactly one thing:
*the eye* (98%), which makes one unfinished number simply tell you which of its blocks are
mines; *safe shot* (1%), which turns your next shot into a mine into an uncovering rather than a
detonation; or an *extra life* (1%).

The board wears the Windows 95 palette: 1 is blue, 2 green, 3 red, 4 navy, and so on. The
original only ever needed eight colors — with 26 neighbors we can count higher, so 9 and up
repeat the same eight hues one shade lighter each time.

## Controls

| | |
|---|---|
| `W A S D` | move |
| `Shift` | sprint |
| `Space` | jump — and jump again in mid-air, up to 20 times |
| Mouse | aim (click the screen to lock the pointer) |
| Left click | shoot. Always — a number in the way is not a target, the shot goes through it |
| Hold right | think; let go on a block to flag it, or on a number to light up what it counts |
| Phone | left thumb moves, right thumb looks, buttons under your right hand |
| `H` | hint · press again to play the move it found |
| `T` | plane arrows · `I` invert vertical mouse |
| `M` | sound · `R` restart · `Esc` pause |

## Technical notes

One HTML file, ~160 KB, no dependencies at all:

- **Hand-written WebGL2** — no Three.js, no engine, no build step.
- Instanced cubes with stepped cel shading and the outline baked into each face's UVs.
- Procedural material texture quantized to chunky pixels in the fragment shader (the idea was
  "what if Noita went 3D").
- Glyph atlas generated at runtime on a `<canvas>`; no image is ever loaded.
- All audio synthesized through WebAudio: shot, crumble, fuse, blast, cave wind.
- **Mine density has a deliberate floor.** Since `P(zero block) = (1 − d)^26` and site
  percolation at 26-neighbor coordination turns over near 9.8%, anything below ~10% mines lets
  the first flood fill open the entire cave at once. The board is also rerolled until no block
  of the starting chamber reads zero, so the opening never cascades.
- **The hint solver was checked against the answer key.** Over 40 boards played to completion
  with hints alone it produced 11,881 deductions and was wrong zero times; 2,321 of those came
  from the two-number subset rule. Its guess fallback picks a block that turns out to be a mine
  5.8% of the time against 12.5% for a blind pick from the same positions, and it deliberately
  overstates that risk to the player rather than understating it.

Runs in any browser with WebGL2 (Chrome, Edge, Firefox). Downloading `index.html` and opening it
directly works too — that way pointer lock is guaranteed.

## Building it

There is nothing to build. `index.html` is the whole game; open it or serve it statically.
