/* A dungeon is 7776 cells; the arena it was written for is 300. What does one
   detonation cost now? This is the difference between "the bot is slow" and
   "dying in a dungeon locks the game up for everyone". */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const count=()=>particles.length+sprites.length+(debris?debris.count:0);

  for(const [mode,label] of [[MODE_SWEEP,'Apprentice arena'],[MODE_DUNGEON,'Dungeon']]){
    G.mode=mode; seed=606; genWorld(0); G.state='play';
    const N=G.nx*G.ny*G.nz;
    particles.length=0; sprites.length=0;
    let mine=-1;
    for(let i=0;i<N;i++) if(G.mine[i]){ mine=i; break; }
    const c=cellXYZ(mine);
    const before=count();
    detonate(c[0],c[1],c[2]);
    // the fuse burns, then blast() runs in the frame loop; drive it by hand
    let frames=0;
    const t0=performance.now();
    while(G.fuse>0 && frames<400){ G.fuse-=1/30; frames++; }
    if(typeof blast==='function') blast();
    const after=count();
    R.push(`${label} (${N} cells, ${G.mines} mines): one detonation -> `+
           `${after-before} live particles/sprites, caps MAXP/MAXS`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN (hung)'; }, 25000);
