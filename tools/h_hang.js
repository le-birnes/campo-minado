/* Which of today's game changes hangs a dungeon? Exercise each in isolation
   with a hard iteration budget, and report how far each got. Seconds, not the
   three-minute runs that have been timing out. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const t0=performance.now();
  const el=(ms)=>performance.now()-t0>ms;

  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play'; G.boss=true;
  const N=G.nx*G.ny*G.nz;
  for(let i=0;i<N;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  R.push('dungeon built '+(performance.now()-t0).toFixed(0)+'ms');

  /* --- kill a lot of things: corpses + the death burst --- */
  let spawned=0, killed=0, bail='';
  const findCell=()=>{
    for(let i=0;i<N;i++){
      if(G.st[i]!==SOLID) continue;
      const c=cellXYZ(i);
      for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        const X=c[0]+g[0],Y=c[1]+g[1],Z=c[2]+g[2];
        if(inside(X,Y,Z) && G.st[idx(X,Y,Z)]===AIR) return i;
      }
    }
    return -1;
  };
  const cell=findCell();
  for(let k=0;k<40;k++){
    if(el(8000)){ bail='TIMED OUT spawning/killing at k='+k; break; }
    const e=spawnEnemy(k%3, k%3, cell);
    if(!e) continue;
    spawned++;
    killEnemy(e, enemies.indexOf(e));
    killed++;
    for(let f=0; f<20; f++) updateEnemies(1/30);      // let the corpse burst
  }
  R.push(`spawn+kill x${killed}/${spawned}: ${(performance.now()-t0).toFixed(0)}ms `+
         `corpses left ${corpses.length} ${bail}`);

  /* --- the finale: startFinale + voxels + killing it --- */
  const t1=performance.now();
  for(let i=0;i<N;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  R.push(`finale summoned in ${(performance.now()-t1).toFixed(0)}ms, foes ${enemies.length}, `+
         `state ${G.state}`);
  const boss=enemies.find(e=>e.hell);
  if(boss){
    const t2=performance.now();
    const V=hellVoxels(boss.hell);
    R.push(`its voxels: ${V.vox.length} in ${(performance.now()-t2).toFixed(0)}ms`);
    const t3=performance.now();
    killEnemy(boss, enemies.indexOf(boss));
    R.push(`killed the finale in ${(performance.now()-t3).toFixed(0)}ms, state ${G.state}, `+
           `win ${G.win}, corpses ${corpses.length}`);
    const t4=performance.now();
    for(let f=0; f<40 && !el(20000); f++) updateEnemies(1/30);
    R.push(`40 frames after: ${(performance.now()-t4).toFixed(0)}ms, corpses ${corpses.length}`);
  }
  R.push('TOTAL '+(performance.now()-t0).toFixed(0)+'ms');
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN (hung before reporting)'; }, 30000);
