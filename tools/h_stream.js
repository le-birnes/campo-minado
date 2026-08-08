/* ALL IS FUNCTION UNTIL I GET NEAR, THEN THE FUNCTION BECOMES ARRAY.

   "I want the diggable patch to follow me, so if I manage to get there,
   wherever that is, I'll be able to interact with it."

   Three things have to be true, and the third is the one that makes it a
   platform rather than a trick:

     1. AN UNTOUCHED WORLD COSTS NOTHING. No pages, whatever its size.
     2. WHAT YOU READ IS WHAT THE UNIVERSE SAYS. The array is a CACHE of the
        function, so cGet and universeAt must never disagree - if they can,
        walking somewhere changes it, which is the fault this whole week has
        been about.
     3. AND ONLY THE SURFACE COSTS ANYTHING. Underground and high in the air
        every block is one material, so it stays one byte; pages appear only
        where the ground actually is.

   Prefixed st. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  SIM_SPHERE = false;
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play'; G.gravK=-1;
  worldBodies();
  const R=[];
  const nm = m => (SMAT[m]&&SMAT[m].n) || ('mat'+m);
  const w = SAND;
  const MB = () => (w.bytes()/1048576).toFixed(2);

  w.streamAll();
  R.push('AN UNTOUCHED WINDOW: ' + w.pgn + ' pages, ' + MB() + ' MB, over ' +
         w.nb + ' block slots ' +
         (w.pgn===0 ? 'ok, nothing is stored' : 'FAULT'));

  /* 2. read a thousand points and compare with the function */
  let bad=0, seen={};
  for(let k=0;k<1000;k++){
    const x = rnd()*w.W, y = rnd()*w.H, z = rnd()*w.D;
    const cx=Math.floor(x), cy=Math.floor(y), cz=Math.floor(z);
    const a = cGet(w, cx,cy,cz);
    const b = universeAt((cx+0.5)*CELL_M, (cy+0.5)*CELL_M, (cz+0.5)*CELL_M);
    seen[nm(a)] = (seen[nm(a)]||0)+1;
    if(a !== b) bad++;
  }
  R.push('A THOUSAND READS against the function: ' + bad + ' disagree ' +
         (bad===0 ? 'ok, THE ARRAY IS A CACHE OF THE UNIVERSE' :
                    'FAULT: walking somewhere would change it'));
  R.push('  what came back: ' + Object.keys(seen).map(k=>k+' '+seen[k]).join(', '));
  R.push('  and it cost ' + w.pgn + ' pages, ' + MB() + ' MB');

  /* 3. only the surface should have allocated */
  w.streamAll();
  const col = (cy) => { for(let k=0;k<40;k++) cGet(w, (w.W>>1)+k, cy, w.D>>1); };
  const surfY = Math.round(G.seaY*SAND_DIV);
  col(4);                       const air  = w.pgn; w.streamAll();
  col(surfY);                   const surf = w.pgn; w.streamAll();
  col(w.H-40);                  const deep = w.pgn;
  R.push('READING FORTY CELLS ACROSS, at three heights: ' +
         'high in the air ' + air + ' pages, at the surface ' + surf +
         ', deep underground ' + deep + ' ' +
         (air===0 && deep===0
          ? 'ok, uniform ground costs nothing - and the column at the middle is'
            + ' inside the island, so it is uniform too'
          : 'FAULT: a column of one material allocated pages'));

  /* AND WALKING SOMEWHERE NEW: read a patch far from the middle */
  w.streamAll();
  const before = w.pgn;
  for(let k=0;k<600;k++){
    const x = (w.W-60) + (k%20), y = surfY + ((k/20)|0) - 15, z = w.D-40 + (k%13);
    cGet(w, x, y, z);
  }
  R.push('WALKING TO A CORNER he has never been: ' + before + ' -> ' + w.pgn +
         ' pages, ' + MB() + ' MB ' +
         (w.pgn >= before ? 'ok, the function became array where he looked' : 'FAULT'));
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
