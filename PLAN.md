# Plan — pick up here on `/resume`

Live: https://le-birnes.github.io/campo-minado/
All six open questions were answered on 2026-07-31 and the work is done and live.

Last session ended **mid-way through fixing the playtest bot**. Everything else
is done, pushed and live.

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

### Where it stands — PAUSED 2026-07-31

**Arenas: working.** Apprentice finishes the board in 15-36 s with FAULTS: none.
The last full suite finished 3 of 7 games with zero invariant violations.

**Dungeon: still 0 actions.** Last measurement, 30 steps on a fresh dungeon:
48 approaches, all of them noRoute, 1296 sightline rays and not one success,
only ~27 standable cells reachable from spawn. So the bot floods the entry
corridor and then cannot find anywhere to stand that can see a proven mine.

Unfinished diagnostic: `tools/h_nav.js` — counts standable cells on the board
versus reachable from spawn, then for the first proven mine reports the nearest
reachable stand, how many reachable spots can see it, and what the ray hits
instead. Run that first; it decides between "the level is not navigable there"
and "the bot's standable model is too strict".

Two suspicions worth testing in that order:
1. On a FRESH dungeon the proven mines are on the face of an intact mass, and
   the chamber floor in front of them may not be `standable` — the mass sits on
   it. A bot that refuses to shoot unless it can stand somewhere with a clean
   sightline may simply have nowhere legal to be.
2. `seesFrom` requires the ray to terminate exactly on the target cell. Against
   a flat face at an oblique angle it will usually hit a neighbour instead.

### Things that looked like bot bugs and were not

- Harnesses "hanging" was an identifier collision: declaring `const mark` in a
  harness clashes with the game's own `mark()`, which is a parse error, so the
  whole script never runs and Chrome sits out its budget in silence.
- The rest of the slowness was the game's render loop grinding through
  `--virtual-time-budget` under software GL. `build(render=False)` now stops it.
- The CPU that appeared to be a runaway loop of mine was Marcelo's own
  WhatsApp queue sender, which my over-broad process reap kept killing.

### Out of scope for now

The watchable demo (`bot-demo.html`, `mkdemo.py`) is untouched and still has
every one of the old bugs — same flying router, same `shoot()`-to-chord that
cannot work. Marcelo asked to suspend it until the playtest bot is right.

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

