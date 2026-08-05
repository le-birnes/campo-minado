/* EYES — pose the game for its portrait, then let it render.

   Every other harness in this folder measures. This one is the first that
   only LOOKS, because the thing it is checking for cannot be counted: the bot
   plays the game with its eyes shut. It reads G.st and P.x directly, so a run
   is "clean" while the weapon points backwards, a sprite fails to bind, the
   HUD sits on top of the numbers, or the whole frame draws black. All four
   have happened in this project and none of them can fail an invariant.

   Marcelo, in the design notes: "the fix was found by watching at a slower
   pace, not by reading counters." This is the harness that watches.

   ?eye=N picks the pose. Each one is a state a real player passes through,
   set up deterministically so the same N is the same picture every time —
   a QA verdict that moves on its own is not a verdict.

     0  apprentice, spawn view      the first thing a player ever sees
     1  apprentice, dug in          numbers and glyphs on revealed faces
     2  weapon, pitched down        the 169-degrees-backwards class of bug
     3  flags planted               marker sprites, the ones that bind late
     4  dungeon, lit, mid-level     depth, lighting, distance

   NOTE ON LIGHTS. runbot.py runs with lights=0 because per-fragment point
   lights on SwiftShader turned a one-second run into a hang. That fix is
   correct there and WRONG here: an unlit cave is not what the player sees,
   and lighting bugs are exactly what this harness is for. So eyes runs lit,
   pays for it in seconds, and keeps the budget small enough to afford it.

   Ends by writing document.body.dataset.r like every other harness, so a
   --dump-dom run can sanity-check the pose before anyone spends a screenshot
   on it. */
setTimeout(() => { try {
  G.muted = true; try { snd.setMute(true); } catch (e) {}
  const WHICH = (location.search.match(/[?&]eye=(\d+)/) || [0, '0'])[1] | 0;
  const SEED = (location.search.match(/[?&]seed=(\d+)/) || [0, '4242'])[1] | 0;

  const dungeon = (WHICH === 4);
  seed = SEED;
  G.mode = dungeon ? MODE_DUNGEON : MODE_SWEEP;
  genWorld(dungeon ? 0 : 0);
  G.state = 'play';
  try { setScreen('play'); } catch (e) {}

  const n = G.nx * G.ny * G.nz;
  const air = (i) => { if (G.st[i] === SOLID && !G.mine[i]) { G.st[i] = AIR; G.revealed++; } };

  /* Open a pocket around the middle so there is something to look AT. Opening
     the whole board would be a different picture than a player ever sees. */
  function digPocket(frac) {
    let opened = 0;
    for (let i = 0; i < n; i++) {
      if (G.st[i] !== SOLID || G.mine[i]) continue;
      if ((i * 2654435761 >>> 0) % 100 < frac) { air(i); opened++; }
    }
    return opened;
  }

  let note = '';
  if (WHICH === 1 || WHICH === 2 || WHICH === 3) note = 'dug ' + digPocket(45);
  if (WHICH === 4) note = 'dug ' + digPocket(30);

  if (WHICH === 3) {
    let f = 0;
    for (let i = 0; i < n; i++) {
      if (G.mine[i] && G.st[i] !== MARKED && f < 40) { G.st[i] = MARKED; G.marked++; f++; }
    }
    note += ' flags ' + f;
  }

  G.dirty = true;
  try { checkWin(); } catch (e) {}
  try { hurtPlayer = function () {}; } catch (e) {}

  /* The lock hint is an artifact of the RIG, not of the game: headless Chrome
     has no pointer to lock, so #needlock is always up. Leaving it in would put
     a caption across every frame and every review would be about the caption. */
  try { const nl = document.getElementById('needlock'); if (nl) nl.style.display = 'none'; } catch (e) {}

  /* AIM AT THE BOARD, never at hand-picked angles.

     The game's view vector is  dx=-sin(yaw)cos(pitch), dy=sin(pitch),
     dz=-cos(yaw)cos(pitch)  (aimRay, index.html). Positive pitch therefore
     looks UP — which the first version of this harness got backwards and spent
     a shot photographing the empty ceiling above an Apprentice board.

     So do not guess angles. Put the camera somewhere, then solve yaw and pitch
     from where the board actually is. That is correct for 10x3x10 and for
     18x24x18 without a second set of constants. */
  const bx = G.nx * BLOCK, by = G.ny * BLOCK, bz = G.nz * BLOCK;
  const cx = bx / 2, cy = by / 2, cz = bz / 2;
  const eyeH = (typeof EYE === 'number') ? EYE : 0;   // the GAME's eye height

  function aimAt(tx, ty, tz) {
    const dx = tx - P.x, dy = ty - (P.y + eyeH), dz = tz - P.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    P.pitch = Math.asin(dy / len);
    P.yaw = Math.atan2(-dx, -dz);
  }

  P.vx = P.vy = P.vz = 0;
  P.ground = false;

  /* Standing off the board by roughly its own width frames the whole thing at
     this FOV; closer and it overflows, further and it is a speck. */
  const back = Math.max(bx, bz) * 0.95;
  if (WHICH === 0) { P.x = cx; P.y = by + back * 0.55; P.z = cz + back; }
  if (WHICH === 1) { P.x = cx; P.y = by * 0.80; P.z = cz + back * 0.75; }
  if (WHICH === 2) { P.x = cx; P.y = by * 0.60; P.z = cz + 5 * BLOCK; }
  if (WHICH === 3) { P.x = cx - back * 0.5; P.y = by * 0.75; P.z = cz + back * 0.6; }
  if (WHICH === 4) { P.x = cx; P.y = cy + by * 0.20; P.z = cz + back * 0.7; }
  aimAt(cx, cy, cz);

  /* The weapon pose is the whole point of eye 2: look down so the held model
     fills the lower frame, where a backwards gun is unmissable. */
  if (WHICH === 2) P.pitch = -0.42;

  document.body.dataset.r =
    'eye=' + WHICH + ' seed=' + SEED + ' mode=' + (dungeon ? 'dungeon' : 'sweep') +
    ' grid=' + G.nx + 'x' + G.ny + 'x' + G.nz +
    ' revealed=' + G.revealed + ' marked=' + G.marked + ' ' + note +
    ' cam=' + P.x.toFixed(1) + ',' + P.y.toFixed(1) + ',' + P.z.toFixed(1);
} catch (err) {
  document.title = 'THROW ' + err.message;
  try { document.body.dataset.r = 'THROW ' + err.message; } catch (e) {}
} }, 400);
