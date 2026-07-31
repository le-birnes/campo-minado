window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const N=()=>G.nx*G.ny*G.nz;

  /* 1. the wall-clock stream must be genuinely spread, and must NOT disturb
     the world stream — a board has to stay reproducible from its seed. */
  {
    let lo=1e9, hi=-1e9, sum=0, n=40000;
    for(let k=0;k<n;k++){ const v=wrange(3,75); lo=Math.min(lo,v); hi=Math.max(hi,v); sum+=v; }
    R.push(`fuse over ${n} draws: ${lo}-${hi}, mean ${(sum/n).toFixed(1)} (want 3-75, mean 39)`);
    // determinism of the world stream, with wrnd() called in between
    seed=4242; genWorld(0); const a=G.mines, am=G.mine.slice();
    for(let k=0;k<1000;k++) wrnd();
    seed=4242; genWorld(0); const b=G.mines;
    let same=true; for(let i=0;i<G.mine.length;i++) if(G.mine[i]!==am[i]){ same=false; break; }
    R.push(`world stream untouched by the clock stream: same mine count ${a===b}, `+
           `identical layout ${same}`);
  }

  /* 2. does breaking rock actually wake things, and on the right interval? */
  {
    G.mode=MODE_DUNGEON;
    let spawns=0, shots=0, gaps=[], last=0;
    for(let b=0;b<6;b++){
      seed=31000+b*7919; genWorld(0); G.state='play';
      const n=N();
      enemies.length=0;
      for(let i=0;i<n && shots<4000;i++){
        if(G.st[i]!==SOLID || G.mine[i]) continue;
        const c=cellXYZ(i);
        const before=enemies.length;
        revealAt(i,true);
        shots++;
        digSpawn(i, c[0],c[1],c[2]);
        if(enemies.length>before){ spawns++; gaps.push(shots-last); last=shots; }
        if(enemies.length>=EN_MAX) enemies.length=0;   // keep room, we only count
      }
    }
    gaps.sort((x,y)=>x-y);
    R.push(`${shots} blocks broken -> ${spawns} came out of the rock | `+
           `gap between them ${gaps.length?gaps[0]:'-'}-${gaps.length?gaps[gaps.length-1]:'-'} shots, `+
           `median ${gaps.length?gaps[gaps.length>>1]:'-'}`);
  }

  /* 3. nothing comes out of the rock in the plain puzzle */
  {
    G.mode=MODE_SWEEP;
    seed=9; genWorld(1); G.state='play';
    enemies.length=0;
    const n=N();
    let broken=0;
    for(let i=0;i<n && broken<600;i++){
      if(G.st[i]!==SOLID || G.mine[i]) continue;
      const c=cellXYZ(i); revealAt(i,true); digSpawn(i,c[0],c[1],c[2]); broken++;
    }
    R.push(`3D Minesweeper: ${broken} blocks broken -> ${enemies.length} enemies (want 0)`);
  }

  /* 4. the extra-life rate follows the difficulty */
  {
    G.mode=MODE_SWEEP;
    const out=[];
    for(const d of [0,1,2,3]){
      G.diff=d;
      const t={life:0,safe:0,eye:0};
      for(let k=0;k<40000;k++) t[rollPower().key]++;
      out.push(`${DIFFS[d].name} life ${(100*t.life/40000).toFixed(1)}% `+
               `safe ${(100*t.safe/40000).toFixed(1)}% eye ${(100*t.eye/40000).toFixed(1)}%`);
    }
    R.push('chests: '+out.join(' | '));
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 20000);
