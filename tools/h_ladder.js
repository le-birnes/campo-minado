/* THE PROMOTION LADDER: bead -> block -> mass.

   What has to be true, and each of these has been wrong at some point in a
   falling-sand engine written by somebody:

     1. a block that is all one settled fluid becomes ONE record
     2. blocks that touch become ONE mass
     3. a settled body then costs NOTHING - no awake chunks, no cells scanned
     4. poking it demotes the block that was poked and NOT the ocean. This is
        the one that matters: waking a demoted block through touch() marks its
        neighbours, which demotes those, and a whole sea liquefies because one
        bead fell in it.
     5. matter is conserved across every promotion and demotion */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  /* THE SEVEN-METRE SPHERE IS OFF HERE. This builds a tank and ticks it with
     nobody standing in it, so the scheduler would defer the whole thing; what
     is under test is the ladder and the matter, not what the player can see.
     h_ocean is where the sphere itself is measured. */
  SIM_SPHERE = false;
  const R=[];
  G.mode=MODE_SWEEP; seed=5; genWorld(0); G.state='play';
  const w=SAND;

  /* a tank: dig a box of blocks out of the board and fill it with water. The
     rock around it is the world's own stone, so the water is sealed and has
     nowhere to go - which is the cheapest thing that can possibly settle. */
  const bx0=1, by0=1, bz0=1, BW=Math.min(5,G.nx-2), BH=Math.min(3,G.ny-2), BD=Math.min(5,G.nz-2);
  for(let y=by0;y<by0+BH;y++) for(let z=bz0;z<bz0+BD;z++) for(let x=bx0;x<bx0+BW;x++){
    const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
    sandDig(x,y,z);
  }
  /* AND IT IS SEALED. A fresh board already has air blocks in it, so a tank
     dug beside one has open sky on a face - and cells with open sky are MORTAL
     now, so they never settle and the chunk never goes quiet. That is correct
     behaviour and it is not what this test is asking about: the question here
     is whether the INSIDE of a body of water costs nothing. Stone all round it. */
  for(let y=by0-1;y<=by0+BH;y++) for(let z=bz0-1;z<=bz0+BD;z++) for(let x=bx0-1;x<=bx0+BW;x++){
    if(y>=by0 && y<by0+BH && z>=bz0 && z<bz0+BD && x>=bx0 && x<bx0+BW) continue;
    sandFill(x,y,z, S_ROCK, false);
  }
  for(let y=by0;y<by0+BH;y++) for(let z=bz0;z<bz0+BD;z++) for(let x=bx0;x<bx0+BW;x++)
    sandFill(x,y,z, S_WATER, true);
  const NB = BW*BH*BD;
  const cells0 = w.count(S_WATER);
  R.push(`tank: ${BW}x${BH}x${BD} = ${NB} blocks, ${cells0} cells of water`);

  /* settle it */
  let t=0; for(; t<600 && w.awake.length; t++){ sandTick(w,-1); ladTick(); }
  R.push(`settled after ${t} ticks, ${w.awake.length} chunks still awake`);

  /* 1 and 2 */
  for(let k=0;k<40;k++) ladTick();            // drain the census queue
  ladRelabel();
  const big = MASSES.filter(m=>m.n>=LAD_MASS_MIN);
  R.push(`promoted ${ladStats.blocks} of ${NB} blocks ` +
         (ladStats.blocks >= NB*0.9 ? 'ok' : 'FAULT: the census is not finding them'));
  R.push(`masses: ${MASSES.length} total, ${big.length} of ${LAD_MASS_MIN}+ blocks` +
         (big.length ? `, biggest ${Math.max(...MASSES.map(m=>m.n))} blocks ok` : ' FAULT: no mass formed'));

  /* 3. and now it must cost nothing */
  w.stats.scanned=0;
  let scan=0, awake=0;
  for(let k=0;k<120;k++){ sandTick(w,-1); ladTick(); scan+=w.stats.scanned; awake+=w.awake.length; }
  R.push(`120 ticks at rest: ${scan} cells scanned, ${awake} chunk-ticks awake ` +
         (scan===0 && awake===0 ? 'ok, free' : 'FAULT: a settled sea is being simulated'));

  /* 4. THE ONE THAT MATTERS. Poke one cell in the middle and count what
        liquefies. One block, or a handful of them where the poke straddles a
        chunk seam - never the whole tank. */
  const before = ladStats.blocks;
  const pcx=(bx0+((BW/2)|0))*SAND_DIV+8, pcy=(by0+((BH/2)|0))*SAND_DIV+8, pcz=(bz0+((BD/2)|0))*SAND_DIV+8;
  w.put(pcx,pcy,pcz, S_AIR);
  for(let k=0;k<90;k++){ sandTick(w,-1); ladTick(); }
  const lost = before - ladStats.blocks;
  R.push(`poked one cell: ${lost} of ${before} blocks demoted ` +
         (lost>=1 && lost<=NB*0.5 ? 'ok, local' : lost<1 ? 'FAULT: nothing noticed' : 'FAULT: the whole sea liquefied'));

  /* and it comes back: the hole fills, it settles, it re-promotes */
  for(let k=0;k<400;k++){ sandTick(w,-1); ladTick(); }
  R.push(`900 ticks later: back to ${ladStats.blocks} blocks ` +
         (ladStats.blocks >= before-2 ? 'ok, it re-promotes' : 'FAULT: it never climbs back'));

  /* 5. matter */
  const cells1 = w.count(S_WATER);
  R.push(`water cells ${cells0} -> ${cells1} ` +
         (Math.abs(cells1-cells0) <= 1 ? 'ok, conserved' : 'FAULT: matter was created or lost'));

  /* the far-field draw has to emit something and not blow the batch */
  P.x=(bx0+BW+14)*BLOCK; P.y=(by0)*BLOCK; P.z=(bz0+BD/2)*BLOCK;
  const drew = sandDraw();
  R.push(`drawn from 14 blocks away: ${ladStats.drawn} mass cubes, ${drew} instances total ` +
         (drew<=SAND_DRAW_MAX ? 'ok' : 'FAULT: over the cap'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
