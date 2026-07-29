# Plan — pick up here on `/resume`

Live: https://le-birnes.github.io/campo-minado/
Bot demo: https://le-birnes.github.io/campo-minado/bot-demo.html
Last commit: `057a9e9` — right click now shows what a number touches.

Everything below is **not started**. Ordered so each step is independently
pushable, because the working agreement is to push after every change.

---

## 1. Difficulty rating by simulated player time — the main task

Marcelo's ask, in his words: *"simulate the bot and the possible shots once and
determine difficulty by time a player would take to do the simulation in player
movement time"*, using *"matrixes and determinants to find position across
interlacing dimensions; each matrix represents a slice of the world, IF
NECESSARY"*.

Read that as: **rate a board by how long a competent player would need to
finish it**, measured in real movement seconds, not in clicks. The matrix idea
is offered as a means, hedged with *if necessary* — so it is a tool to reach
for only where it earns its place, not a requirement to satisfy.

### What to actually build

A one-shot solve — no rendering, no real-time loop — that walks the board the
way a player must and accumulates **seconds**:

- **Travel time.** Distance along a route through opened cells, at `SPD_RUN`
  (5.8 m/s), plus a jump penalty per layer change (a 4 m step needs a jump; use
  the real apex maths already in the constants rather than a guess).
- **Aim time.** Per shot, from angular distance between successive aim
  directions, at a plausible human turn rate. Do not invent one — derive it
  from `G.sens` and a normal mouse sweep, and write down the assumption.
- **Decision time.** A flat cost per deduction, higher for the subset rule than
  for the single-number rules, since a human takes longer to see it.
- **Guess penalty.** When nothing is provable, charge the time a player spends
  scanning before committing.

Sum over the whole solve → seconds → difficulty band. Calibrate the bands from
a spread of boards rather than picking numbers.

### Where a matrix genuinely helps, and where it does not

Worth saying plainly so this does not get over-built:

- The board is already `y*nz*nx + z*nx + x` — a flat array with a linear index.
  Position and neighbourhood need no linear algebra at all.
- **Where it does earn its place:** treating each of the `ny` layers as its own
  `nx × nz` matrix and asking *how much does layer k constrain layer k±1*. A
  26-neighbour count is a convolution of the three adjacent layer matrices with
  a 3×3 kernel. Expressing it that way makes "how interlaced are these planes"
  a real, computable quantity — and interlacing is exactly what makes this game
  harder than 2D minesweeper.
- **Determinants specifically:** a determinant answers whether a linear system
  has a unique solution. The honest application here is the classic minesweeper
  formulation — each clue is a linear equation over unknown cells, `Ax = b`,
  `x` in {0,1}. The **rank** of `A` tells you how much of the board is forced
  and how much needs a guess. That is a genuinely good difficulty signal, and
  it is rank rather than determinant that carries it (`A` is rarely square).
  Build rank via Gaussian elimination over the clue matrix. If Marcelo
  specifically wants determinants, use them on square sub-blocks and say what
  they do and do not tell us.

Do this second, after the time model works, and only report it if it adds
signal the time model does not already carry.

### Deliverable

- Difficulty number shown on the menu next to the board description, e.g.
  *"~4 min 20 s for a competent player · 3 forced guesses"*.
- Custom boards get it live as the sliders move, so Marcelo can dial a board to
  a target length. This is the real payoff of the whole feature.

---

## 2. Finish the headless walking bot

Known and unfixed, stated plainly at the time: it ends **boxed in on 7 of 8
boards**. Its invariant audits pass on every action it takes, but passing
audits is not the same as completing a board.

Cause: `route()` treats every air cell as walkable, including ones with nothing
underneath. The bot walks into a shaft and falls.

Fix: BFS only through cells whose neighbour below is solid, allow a one-cell
rise (a jump) and any drop, and let it fall deliberately when that is the route.
Then re-run and expect boards to finish. Much of this logic is reusable by
task 1 — the travel-time model needs the same route function, so build it once,
properly, and share it.

---

## 3. Open questions for Marcelo — ask before building, not after

- **HUD.** "All except timer, mines left, safe blocks" was followed, but Life
  was kept in Boss Master, since not knowing whether the next hit kills you is
  not a design choice. Confirm or remove.
- **Enemy fire setting off a mine ends the run** with no mistake by the player.
  That follows directly from *"its shot has the same effect as yours"*, and the
  test caught it happening. It is per spec but a harsh loss — deliberate?
- **Right click steal rate.** Aiming at a wall block still loses 22% of right
  clicks to a number on the line (down from 33%). Inherent to numbers sitting
  at cell centres. Live with it, or move numbers off-centre toward the block
  face they describe?

---

## 4. Smaller things already noted

- Repo is still `campo-minado`; the URL is Portuguese for an English game.
  Renaming redirects the old path, so nothing breaks — Marcelo's call.
- First commit message is still Portuguese.
- `README.md` predates the Win95 pass, custom boards, Boss Master, music and
  the spatial hints. It is the launch post, so it should be rewritten before
  the game is shown anywhere.

---

## Working agreement

- **Push after every change.** Do not batch. Marcelo watches the live site.
- When polling GitHub Pages, grep for a marker unique to the *newest* commit —
  polling for an older marker reports success too early. This already caused
  one false "deployed" call.
- Verify by measuring, not by reasoning about the code. Every real bug this
  session — the mine-counter desync, the moiré, the right-click steal rate —
  came from a test that counted something. Three "bugs" the bot reported were
  the bot's own, caught only by probing rather than trusting its output.
