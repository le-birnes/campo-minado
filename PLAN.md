# Plan — pick up here on `/resume`

Live: https://le-birnes.github.io/campo-minado/
Last commit: `b1663df` — retired `MARK_NUM_R` with the measurement that retires it.

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

### Last measured state — all fixes in, run completed

```
games=7 finished=3 actions=1092
  Apprentice   finished           Sorcerer   finished
  Arcane       nothing reachable  Custom-max finished
  Custom-min   nothing reachable  Dungeon x2 nothing it could reach
3600 m walked, 342 jumps (291 climbing)
noRoute=735  stuck=34  boxedIn=4  fellOutOfWorld=0  insideRock=0
misaimed flags: 4          (was 694)
FAULTS: none               (was 694)
```

The audit is clean and Sorcerer, which used to burn 700 moves on one block, now
finishes. **No need to re-run to confirm — this is that run.**

### Then chase, in order

1. **`chords` is still 0.** `approachNum` needs the ray back as `kind:'num'`,
   which needs the aim within `NUM_R` of the cell centre. Count how often
   `approachNum` fails versus how often a chord is even available.
2. **Dungeons end "nothing it could reach."** The structural audit proves every
   mine is diggable-to from spawn, so this is the bot, not the level. Suspect
   the candidate sightline search giving up too early, or the router failing to
   cross a shaft.
3. **`noRoute=735`** is the same question from the other end, and it went *up*
   as the bot survived longer — so it is a rate, not a count: the longer it
   plays, the more targets it cannot find a standing spot for. Three of seven
   games still end "nothing it could reach", which is now the single thing
   between the bot and playing a board start to finish.
4. **`targets given up on: 0` is a reporting bug**, not a result. `refused` is
   reset per game and read after the last one, so it only ever shows the final
   game's leftovers. Accumulate it across games.

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

## 4. Open questions for Marcelo

1. **Arcane is 60 x 16 x 60 m**, not 60 x 15 x 60 — 15 m is not a whole number
   of 4 m blocks. Fine, or reshape?
2. **The Archon is 18.6% of all spawns** now that it gates on a 3 rather than a
   6. That follows from the odds set, but it is frequent for a boss.
3. **Apprentice at 6% opens 39% of the board on the first dig** (Sorcerer 7.7%,
   Arcane 2.6%). Honest consequence of the rebalance, not a bug.
4. **Life stays in Boss Master** despite the HUD being cut back, since not
   knowing whether the next hit kills you is not a design choice. Confirm.
5. **An enemy shot setting off a mine ends the run** with no mistake by the
   player. Per spec, but harsh — deliberate?
6. Nothing has **played a dungeon start to finish**. That is what the bot is for.

---

## 5. Smaller things

- Repo is still `campo-minado`; the URL is Portuguese for an English game.
  Renaming redirects the old path, so nothing breaks — Marcelo's call.
- First commit message is still Portuguese.

---

## Working agreement

- **Push after every change.** Do not batch. Marcelo watches the live site.
- When polling GitHub Pages, grep for a marker unique to the *newest* commit.
  Polling for an older marker reports success too early — it has already caused
  one false "deployed", and nearly a second one this session.
- The working copy is CRLF and git stores LF, so a byte-compare against the live
  site must be against `git show HEAD:index.html`, not the file on disk.
- **Verify by measuring, not by reasoning about the code.** Every real bug has
  come from counting something. So has every false alarm: this session alone,
  three "failures" were the harness measuring a ceiling instead of a jump, and
  one was a screenshot script clearing the very cell it was about to test.
