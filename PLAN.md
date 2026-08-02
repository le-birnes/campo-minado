# Plan — pick up here on `/resume`

Live: https://le-birnes.github.io/campo-minado/
All six open questions were answered on 2026-07-31 and the work is done and live.

The game is done, pushed and live. What is left is the **playtest bot**, and
the one thing left in ITS way is navigation: see "Tomorrow's first job" below.

    python tools/watch.py --zones 4     # build + print a URL you can watch
    python tools/runbot.py --quick      # headless Apprentice, ~35 s, the fast check

---

## 1. Resume here: the playtest bot

```
python tools/mkbot.py index.html     # builds tools/bot_index.html
python tools/runbot.py               # headless Chrome, prints the report
```

`tools/bot.js` is the bot. `tools/mkbot.py` injects a hook exposing the game's
internals and appends the bot. `tools/run_harness.py` does the same for one-off
measurement harnesses: `python tools/run_harness.py my.js`.

### What was broken, and what is fixed

| was | now |
|---|---|
| Routed through **any** air cell, six-connected — flying, not walking | models standing (`standable` / `stepTarget`): step up one block, fall any distance |
| Held `IN.jumpHeld` without re-arming `jumpFired`, so it could jump exactly once, ever | `jumpNow()` re-arms; it climbs now (282 climbing jumps in one suite) |
| Re-aimed at the block centre after `approach()` had found a sightline to an *offset* point, so `mark()` cast into whatever the centre faced | aim from `approach()` is kept |
| **Could not chord at all** — left click stopped looking at numbers in the click rework, so `shoot()` can never chord. 0 chords in 833 actions, and nothing failed; the move was silently unavailable | flags and chords both go through the real right button: `startThink()` / `endThink()` |
| Retried an impossible target forever — one Sorcerer board spent 694 of 700 moves on a single block | `refused` map, gives up after two |
| Audit invariants predated ROCK and pre-carved air (`air === revealed`, `safeTotal === N - mines`) and fired on every Arcane and every dungeon | baseline air/rock snapshot; `revealed + openable === safeTotal` |
| Guessed blind, died on move two, exercised nothing | `SAFE_GUESS = true` **deliberately**: it may see the mine array only when out of deductions, and it still records what the guess would have cost — 33% of the time the nearest frontier block was a mine |

### Where it stands — 2026-08-01, end of day

**Apprentice: solved.** 284/284 opened, zero faults, 44 steps / 44 actions.

**One-zone dungeon: completed.** 100/100 opened, 20/20 flagged, 19 kills, zero
faults, "THE SAND LET YOU GO".

**Four-zone dungeon: not yet.** Best watched run reached 243/260 opened and
48/57 flagged before stalling. Every stall so far has had a different named
cause and each one is now fixed — see the commit log for 2026-08-01, which is
the honest record of the day:

| stall | cause | fixed by |
|---|---|---|
| flagged nothing in 206 steps | findHint prefers a dig, and a four-zone board always has another dig, so it never offered a flag | `provenMines()` runs first, always |
| "shot at something" while jumping at a wall | a burst that did no damage counted as a fight | `foeFail`, then: only a kill counts |
| walked past 108 unopened blocks following sightlines | "walk the longest clear line" was treated as work | go and dig the nearest frontier block instead |
| "nothing left it can reach anywhere" with 17 blocks and 9 mines left | refusals are local ("not from here") but were applied board-wide, so an exhausted blacklist looked like an exhausted level | travel ignores refusals; only a board count may end a run |
| stopped with a wall of visible blocks behind it, and more above | `closeOn` jumped only `if (P.ground)` — one block of climb out of twenty jumps — and the watch driver never read `s.seenFar` at all | jump in mid-air toward height; work everything visible before travelling |

**The unification is done.** There is one ladder (`newRun()` / `climb()`) and
the two drivers are only clocks. Five of the bugs above were a rung the watch
driver had never been given; that cannot recur now.

### Tomorrow's first job — the one Marcelo diagnosed by playing it

> "I'm seeing it is stuck searching for work and when I assume control the work
> is either very near or around the corner or going down on the other side of
> the room."

**`closeOn` only walks in a straight line.** It points at the target and holds
forward for two seconds (four if it must climb). There is no pathfinding of any
kind. So:

- work **around a corner** is unreachable — it presses into the corner wall,
  makes no progress, refuses the target, and moves on
- work **on the other side of the room, lower down** is unreachable the same way
  if anything at all stands between
- and `wallFollow()` is the only escape, a right-hand-rule crawl that was never
  meant to be the primary router

That is why every remaining stall looks like "stuck at a wall with work just
past it". The straight line is not a bug in any single rung; it is the whole
navigation layer, and it is now the only thing left in the way.

**Do not** re-derive this by adding another rung to the ladder. The ladder is
right. What it needs underneath is a `routeTo(cell)` that can actually get
there: a BFS over standable cells (`standable` / `stepTarget` already exist from
the old router, and the old router's real sin was scoring the whole reachable
set every step — a *targeted* BFS to one known cell is bounded work and is a
different thing entirely), walked as a sequence of waypoints, with the straight
line kept as the fast path when the line is already clear.

Measure it the way everything else this session was measured: count the targets
`closeOn` fails to reach and how many of those a BFS would have found. If that
number is small, the diagnosis is wrong and the straight line is not the
problem. It is not expected to be small.

### The earlier architectural fix, in Marcelo's words — still the governing idea

Follow the largest viewable path in a straight line until clues appear. On
finding them, look at ALL angles before shooting, to collect every visible cue.
Jump only to reach more mines or unviewed cues, never as ordinary movement. Each
completed straight run triggers a fresh scan of the surroundings, and the paths
get mapped. Descend or ascend only once every mine in the current cluster is
marked; if you went down early, come back up.

That is fixed work per step whatever the level size, and it is what the ladder
now does. The one piece never built is the "go there" underneath it.

### Out of scope for now

The old watchable demo (`bot-demo.html`, `mkdemo.py`) is untouched and still has
every one of the old bugs. It is superseded by `python tools/watch.py` and
should probably just be deleted.

**Still outstanding, unrelated to the bot:** none of the creatures is drawn
holding a gun. The 22x26 roster needs redrawing at roughly double resolution.
Deferred repeatedly and still the outstanding art job.

---

## 2. A finding that belongs to the game, not the bot

**`MARK_NUM_R` is retired, not wired up.** It was written to stop numbers
stealing right clicks aimed at the wall behind them, and was never passed to the
raycast. Wiring it up changes nothing: measured A/B over 606 attempts, **32.7%
stolen at the 0.45 glyph radius and 32.7% at 0.20**. Numbers sit at cell centres,
so a ray aimed at a block several cells down a row passes through the centre of
every number between here and there — the perpendicular distance is ~0 by
construction, and no radius can help.

A real fix separates the two actions **by range**, not by radius: chording is
close work, flagging a wall down a row is not. That is a design change, so it
waits for a decision.

---

## 3. Difficulty rating by simulated player time — still not started

Marcelo's ask, in his words: *"simulate the bot and the possible shots once and
determine difficulty by time a player would take to do the simulation in player
movement time"*, using *"matrixes and determinants to find position across
interlacing dimensions; each matrix represents a slice of the world, IF
NECESSARY"*.

Read that as: **rate a board by how long a competent player would need**, and
show it live on the Custom sliders. Travel time at `SPD_RUN`, jump penalties,
aim time from sensitivity, a decision cost per deduction, and a penalty per
forced guess.

Honest note on the maths, carried forward from before: **determinants are not
the tool here.** The useful linear-algebra object is the *rank* of the clue
matrix (which mines are determined, and how many independent guesses remain).
Layer-to-layer influence is a convolution, not a determinant. Say so rather than
building something that looks impressive and measures nothing.

This now depends on the bot, which is the thing that would do the simulating.

---

## 4. Open questions — ANSWERED 2026-07-31

1. **Arcane 60 x 16 x 60** — keep it. Done.
2. **Archon frequency** — keep the 3-gate, halve the per-variant odds, and add
   enemies coming out of destroyed blocks on a 3-75 shot fuse. Done.
3. **Apprentice 6%** — keep it. Done.
4. **Life in the HUD** — keep it, and scale the extra-life chest with the board:
   30 / 13 / 5%. Done.
5. **Enemy fire setting off a mine** — keep it, crack first. Already the
   behaviour; the crack graphic was fixed to sit on the block.
6. **Modes** — three difficulties x two modes. 3D Minesweeper spawns nothing at
   all. Done.

### Still to do, per difficulty
The dungeon is shared by all three difficulties for now. Marcelo will configure
per-difficulty dungeons later; `DUNGEON` in index.html is the single place that
changes.

---

## Harness limitation — do not re-derive this

`run_harness.py` **cannot photograph animated in-game state** in a scenario it
sets up itself. Under `--virtual-time-budget` the rAF chain fires once and then
freezes: `tGlobal` sticks at exactly 0.05 (one clamped frame), `worldB` keeps
whatever count it had before, and every per-frame counter reads its pre-first-
frame value. Measured across five probes at 300 ms to 5 s: identical every time.

Consequences, learned the expensive way:

* Reading `sprB.count` / `worldB.count` from a harness measures nothing.
* A black screenshot of a scene the harness built by hand is the frozen loop,
  not the game being dark.
* Harnesses that DO render (the wall and chest shots) call `startGame()` and let
  the game drive; ones that set `G.state='play'` by hand do not.
* `--dump-dom` never ticks rAF at all.

So: verify **logic** in the harness, and verify **appearance** by hand in a real
browser, or by a harness that goes through `startGame()` and changes nothing the
game would not change itself.

### Still unverified

The hell sprites have never been seen at game scale. The sheet is correct — 16
tiles, nothing clipped, nothing empty, palette swaps reading right — but the
size of the quad in the world is exactly the thing the sheet cannot show. Reach
it by flagging every mine in Dungeon Mode.
