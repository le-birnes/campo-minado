/* IS THERE A DUNGEON IN THERE AT ALL?

   Marcelo: "proceed to build world and functioning dungeon (it is being
   generated with 1 or 4 mines sometimes)."

   One mine is not a minesweeper. The cause is not the generator - it lays out a
   whole board - it is buildOuterWorld cropping that board to a cylinder whose
   INTERIOR is what is left after a three-block shell, and on an 18-wide grid
   that is a tube about seven blocks across. So this counts what actually
   survives, over several seeds, and says whether it is a game.

   Everything is prefixed du: the game already declares mark, set, landY, idx
   and a duplicate const is a SyntaxError that runs nothing at all. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  let duMinT=1e9, duMaxT=0, duMinS=1e9, duBad=0, duCut=0;

  for(const duSeed of [3,7,11,19,23,31]){
    document.body.dataset.r='STAGE seed '+duSeed;
    G.mode=MODE_DUNGEON; seed=duSeed; genWorld(0); G.state='play';

    /* ONLY WHAT IS INSIDE THE SHELL IS THE DUNGEON. G.lump is the playable
       volume the shell encloses; everything outside it is seamount, beach and
       sea, and counting those was the first thing that made this look fine. */
    const L=G.lump, duIn=(x,y,z)=>L && y>=L.y0 && y<=L.y1 &&
      Math.hypot(x-L.cx, z-L.cz) <= L.r;
    let duMines=0, duSafe=0;
    const duOpen = new Set();
    for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      if(!duIn(x,y,z)) continue;
      const i=idx(x,y,z);
      if(G.hull && G.hull[i]) continue;
      if(G.mine[i]) duMines++;
      else if(G.st[i]!==AIR) duSafe++;
      else duOpen.add(i);
    }
    /* CAN YOU GET ANYWHERE FROM WHERE YOU STAND. Flood the open blocks from the
       player's own block and compare with how many open blocks there are: a
       dungeon you cannot walk around is not a dungeon however many mines it
       has. Only the blocks BELOW the beach count - above it is sky and sea. */
    const duPx=Math.floor(P.x/BLOCK), duPy=Math.floor(P.y/BLOCK), duPz=Math.floor(P.z/BLOCK);
    let duReach=0;
    {
      const st=[idx(duPx,duPy,duPz)], seen=new Set(st);
      if(!duOpen.has(st[0])) st.length=0;
      while(st.length){
        const c=cellXYZ(st.pop()); duReach++;
        for(let k=0;k<6;k++){
          const ax=c[0]+NB26X[k], ay=c[1]+NB26Y[k], az=c[2]+NB26Z[k];
          if(!inside(ax,ay,az)) continue;
          const j=idx(ax,ay,az);
          if(!duOpen.has(j) || seen.has(j)) continue;
          seen.add(j); st.push(j);
        }
      }
    }
    const duCon = duOpen.size ? duReach/duOpen.size : 0;
    if(duMines < 20) duBad++;
    if(duCon < 0.999) duCut++;
    if(duMines<duMinT) duMinT=duMines;
    if(duMines>duMaxT) duMaxT=duMines;
    if(duSafe<duMinS) duMinS=duSafe;
    R.push(`seed ${duSeed}: grid ${G.nx}x${G.ny}x${G.nz}, ${duMines} mines, ${duSafe} safe, ` +
           `${duOpen.size} open blocks, you reach ${duReach} (${(duCon*100).toFixed(0)}%), ` +
           `${G.pockets} pockets, spawn ${duPx},${duPy},${duPz}` +
           (duMines<20 ? '  <- NOT A GAME' : ''));
  }
  R.push(`ACROSS 6 SEEDS: ${duMinT} to ${duMaxT} mines, fewest safe blocks ${duMinS}, ` +
         `${duBad} of 6 under twenty mines ` +
         (duBad===0 ? 'ok, every one of them is a minesweeper' : 'FAULT: it is not a game'));
  R.push(`connectivity: ${duCut} of 6 seeds have somewhere you cannot walk to ` +
         (duCut===0 ? 'ok, one connected dungeon every time' : 'FAULT'));
  R.push(`the grid costs ${SAND ? (SAND.bytes()/1048576).toFixed(2) : '?'} MB of beads`);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
