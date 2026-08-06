# The bead — ἀρχή

Marcelo: *"The thing about building something is its core brick, the bead, ἀρχή!"*

He is right, and the reason it matters is that this engine has spent a whole
session oscillating between representations — cubes, Kuhn tetrahedra, spheres,
grains, voxels, molecules, structures — and treating each one as a candidate
for "the unit". Every time, the choice was made locally and for a local reason,
and every time the next requirement broke it.

So: what IS the first thing, the one everything else is made of?

## The answer is not a shape, and that is the whole point

The measurements this session make that unavoidable:

| | tiles space | meshes away | can rotate cheaply | cost/contact |
|---|---|---|---|---|
| cube | 100% | a wall → 6 quads | no, 32 ns SAT | 6.0 ns axis-aligned |
| Kuhn tetrahedron | 100% | yes | no | — |
| sphere | 74.05% (proven max) | never | yes, free | 7.2 ns |

There is no winner. A cube is the only thing that can BE a wall; a sphere is the
only thing that can cheaply TUMBLE. Anything that must do both wants to be both,
and no single shape is the ἀρχή because **shape is not what a thing is, it is
what a thing is doing**.

## The bead is a quantum of material

    bead = (material, mass, position)

Shape is absent from that triple on purpose. Shape is a *presentation*:

- **standing still, part of a solid** → present as a cube. Tiles perfectly,
  greedy-meshes to nothing, never pays a contact test because it never moves.
- **loose and tumbling** → present as a sphere. No orientation to store or
  integrate, contact normal free, 4× cheaper than the same thing as a box.
- **not yet touched** → present as nothing at all. A mountain is one record.

This is Aristotle rather than Democritus, and the distinction is not decoration.
Democritus' *atomos* was indivisible **by definition** — and a bead that cannot
divide cannot be destroyed, which would make the whole engine pointless. What we
have is *hyle* and *morphe*: matter, and the form it takes. The bead is the
matter. The cube and the sphere are forms it wears depending on what it is doing.

## The one consequence that pays for itself: a bead can SPLIT

Because the bead is defined by MASS and not by SIZE, one bead can become many
smaller beads of the same total mass. That is not a special case bolted on — it
is the definition doing its job, and it dissolves the problem that prompted this.

**The glass problem.** A shot delivers 22,096 J of heat, which fuses 16.8 g of
silica. Measured against a *rendered* grain of 17.5 cm — 8.57 kg — that is one
five-hundredth of a grain, so nothing can be shown and the physics looks broken.

But 16.8 g is a perfectly good bead. It is only "a fraction of a grain" if the
grain size is fixed, and fixing it was the mistake. Subdivide where the detail
is needed:

    8.57 kg sand bead   --heat-->   16.8 g glass bead + 8.55 kg sand bead

Nothing is lost, nothing is invented, and the glass exists at the size the
physics says it exists at.

## And it is the same rule the rest of the engine already runs on

This turns out not to be a new idea. It is the idea already measured three
times, finally stated once:

- **NEXT.md rule 1** — a mountain is one record until something breaks it.
  *One bead, until it splits.*
- **NEXT.md rule 2** — a reaction is a surface: particles near the player, one
  integral far away. *Fine beads where you look, coarse beads where you do not.*
- **impact.js** — fracture cost is γ × new area, so breaking into 400 g lumps is
  756× cheaper than breaking into dust. *The energy of a hit buys a bead COUNT,
  and the count sets the size.*

That last one is the strongest form of it. Splitting is not free and its price
is already derived: **a hit's energy divided by γ tells you how many beads you
get, and their size falls out of the mass.** Destruction is subdivision, priced.

## What this asks of the code, in order

1. **`beadSplit(bead, n)`** — one bead of mass m becomes n of m/n. The energy to
   do it is `impact.js`'s `fractureArea × γ`, which already exists.
2. **A LOD rule** — what sets n. Distance from the player, or a reaction front,
   or a threshold being crossed. Coarse everywhere else.
3. **The bead keeps its size and varies its CONTENTS.** I first proposed the
   opposite — let `RAW_S` vary so a bead could shrink to 1.9 cm and show the
   glass. Marcelo corrected it and he is right: *"block/16 is good for
   baseline, meaning we would be able to render a whole scene at once ... of
   course, there is powder, represented by minimal quantities of stuff
   enclosed in a bead."*

   A fixed render size is what makes a whole destructive scene affordable —
   one instance size, one budget, one predictable frame. Varying radii would
   have made the cost of a scene depend on how finely it had been broken,
   which is exactly the thing NEXT.md rule 3 exists to prevent.

   So a bead is a fixed 17.5 cm **container**, and what varies is how much and
   what is inside it. 16.8 g of glass is a bead that is mostly empty and reads
   as glass. Powder is a bead holding a minimal quantity. The bead is the unit
   of RENDERING and of CONTACT; mass is the unit of BOOKKEEPING; and keeping
   those two separate is what lets one stay cheap while the other stays honest.

   *(Not implemented. `RAW_S` is still a constant, which is now the right
   answer rather than an oversight.)*
4. **Merge, which is split run backwards.** Beads that have been asleep and
   adjacent for long enough recombine into one coarser bead. Without it the
   world only ever gets finer, and a floor of 34,000 glass beads is a floor
   nobody can afford.

Nothing above is a rewrite. `RAW` already stores material and position per
grain; what it lacks is a mass that is allowed to differ between them.

## Where the metaphor stops

The pre-Socratics wanted the ἀρχή to be a *substance* — water, air, fire. Ours
deliberately is not: it is a **slot** that a substance fills. Sand, iron,
gunpowder and glass are all beads and differ only in what fills the slot.

That is weaker than Thales wanted and much more useful, because the thing we
actually need is not "what is everything made of" but "**what is the smallest
thing I have to think about**" — and the honest answer is that it depends on
what is happening, which is precisely why the bead must be allowed to split.
