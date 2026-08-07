/* DOES THE WORLD STILL FIT IN THE BATCH IT IS DRAWN FROM?

   The dungeon world went from 18x24x18 blocks to 46x40x46 so that there is a
   dungeon inside the shell instead of a seven-block tube. The BEAD grid is
   paged and does not care. The BLOCK renderer might: worldB was sized
   20*26*20+64 = 10,464 instances, and NEXT.md's own warning is that the batch
   "drops geometry SILENTLY when full" - so a world too big for it does not
   error, it just has holes in it.

   So: build every dungeon seed, rebuild the world, and compare what it wanted
   to emit against what the batch can hold. Prefixed bt throughout. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const btCap = worldB.data.length / CUBE_STRIDE;
  let btWorst = 0;
  for(const btSeed of [3,11,23]){
    document.body.dataset.r='STAGE seed '+btSeed;
    G.mode=MODE_DUNGEON; seed=btSeed; genWorld(0); G.state='play';
    G.dirty=true; rebuildWorld();
    const btIn = worldB.count;
    /* and after the boss, when the whole island is standing in the open */
    G.noWin=true; G.gravK=-1; rollReset();
    revealIsland(); bossHole((G.holeX+0.5)*BLOCK, (G.holeZ+0.5)*BLOCK);
    G.dirty=true; rebuildWorld();
    const btOut = worldB.count;
    if(btIn>btWorst) btWorst=btIn;
    if(btOut>btWorst) btWorst=btOut;
    /* AND THE BEAD PASS, which is the other half of a frame and the half that
       now has an ocean of 162 million cells behind it. No screenshot: the
       question is whether the draw RETURNS, and with how much. */
    const btSand = sandDraw();
    R.push(`  the bead pass drew ${btSand} of ${SAND_DRAW_MAX} instances, ` +
           `over ${SAND ? SAND.pgn : 0} live pages`);
    R.push(`seed ${btSeed}: ${btIn} instances in the dungeon, ${btOut} on the island, ` +
           `cap ${btCap}` + (Math.max(btIn,btOut) >= btCap ? '  <- FULL, geometry is being dropped' : ''));
  }
  R.push(`WORST ${btWorst} of ${btCap} ` +
         (btWorst < btCap*0.9 ? 'ok, the world fits with room to spare'
                              : 'FAULT: the batch is full and it drops what does not fit in silence'));
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
