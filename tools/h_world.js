/* Does the world build, and how many times?

   The build-once change hung the dungeon at 151 s with no output at all, and
   the first suspect is that genWorld is re-entered by the rejection sampler -
   which would build a ten-million-cell ocean once per deal.

   The name is hmark and not mark because the GAME declares mark - the exact
   collision NEXT.md warns about, which is a parse error, so nothing runs at
   all and Chrome sits out its budget in silence.

   MARKERS ARE WRITTEN AS IT GOES. A harness that only writes at the end says
   nothing when it hangs; one that writes as it passes each stage says WHERE. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
const hmark=(t)=>{ document.body.dataset.r=(document.body.dataset.r||'')+' ~ '+t; };
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  document.body.dataset.r='start';
  G.mode=MODE_DUNGEON; seed=11;
  genWorld(0);
  hmark(`genWorld done, buildOuterWorld ran ${OUTER_N}x`);
  hmark(`grid ${G.nx}x${G.ny}x${G.nz} seaY=${G.seaY} rock0=${G.rock0} sea=${G.seaB?G.seaB.length:0}`);
  hmark(`mines ${G.mines} safe ${G.safeTotal} bulk ${ladStats.blocks}`);
  const py=Math.floor(P.y/BLOCK);
  hmark(`spawn blk ${Math.floor(P.x/BLOCK)},${py},${Math.floor(P.z/BLOCK)} ` +
       (py>=G.rock0 ? 'ok, inside the rock' : 'FAULT: spawned in the sea'));
  let wood=0; for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]!==AIR && G.mat[i]===M_WOOD) wood++;
  hmark(`wood ${wood} vials ${VIALS.length} ` + (wood>60 ? 'ok, the house is built' : 'FAULT'));
  hmark(`shaft above the rock: ${G.st[idx(G.holeX, G.rock0-1, G.holeZ)]===AIR ? 'open ok' : 'SHUT'}` +
       `, into the dungeon: ${G.st[idx(G.holeX, G.rock0+1, G.holeZ)]!==AIR ? 'sealed ok' : 'ALREADY OPEN'}`);
  hmark(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
}catch(err){ hmark('THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'')); }}, 200);
