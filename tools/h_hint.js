/* The watchdog lives in tick(), and it never fires — so the hang is in a loop
   that does not tick. findHint() is the biggest of those and the bot calls it
   every step. Time it on both worlds, at a realistic amount of open board. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  for(const [mode,zones,label] of [[MODE_SWEEP,0,'Apprentice'],
                                   [MODE_DUNGEON,1,'Dungeon x1'],
                                   [MODE_DUNGEON,4,'Dungeon x4']]){
    G.mode=mode;
    if(mode===MODE_DUNGEON) setDungeonLevels(zones);
    seed=606; genWorld(0); G.state='play';
    const N=G.nx*G.ny*G.nz;
    // open a slice, the way three or four bot steps would
    let dug=0;
    for(let i=0;i<N && dug<25;i++){
      if(G.st[i]!==SOLID || G.mine[i]) continue;
      let touches=false;
      for(const j of nbrsOf(i)) if(G.st[j]===AIR){ touches=true; break; }
      if(!touches) continue;
      revealAt(i,true); dug++;
    }
    let clues=0;
    for(let i=0;i<N;i++) if(G.st[i]===AIR && G.cnt[i]>0) clues++;
    const t0=Date.now();
    let calls=0;
    while(calls<5 && Date.now()-t0 < 12000){ findHint(); calls++; }
    const ms=Date.now()-t0;
    R.push(`${label}: ${N} cells, ${clues} clues on the board, ${dug} dug — `+
           `${calls} findHint call(s) in ${ms} ms `+
           `(${calls?(ms/calls).toFixed(0):'-'} ms each)`+
           (calls<5?'  <-- DID NOT FINISH 5 CALLS':''));
  }
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN (hung inside findHint)'; }, 45000);
