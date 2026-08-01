/* Two claims to settle, neither of which needs a frame loop:
   1. the finale must NOT come for you on flags that are merely the right COUNT
   2. killing it must end the run then and there */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const N=()=>G.nx*G.ny*G.nz;
  const setup=()=>{ G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play'; };

  /* ---- 1. right number of flags, wrong blocks ---- */
  setup();
  {
    const n=N();
    for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
    // flag every mine but ONE, and put that last flag on a safe block instead
    let skipped=-1, decoy=-1;
    for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){
      if(skipped<0){ skipped=i; continue; }
      G.st[i]=MARKED; G.marked++;
    }
    for(let i=0;i<n;i++) if(G.st[i]===AIR && !G.mine[i]){ decoy=i; break; }
    if(decoy>=0){ G.st[decoy]=MARKED; G.marked++; }
    const cnt=G.marked, ok=correctFlags();
    checkWin();
    R.push(`flags out ${cnt} of ${G.mines} mines but only ${ok} on real mines: `+
           `finale=${G.finale} state=${G.state} — must be false/play`);
  }

  /* ---- 2. now flag it properly ---- */
  setup();
  {
    const n=N();
    for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
    for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
    checkWin();
    const boss = enemies.find(e=>e.hell);
    R.push(`every mine correctly flagged (${correctFlags()}/${G.mines}): finale=${G.finale} `+
           `boss=${boss?boss.hell.name:'NONE'} state=${G.state} — must still be play, it is not over yet`);

    /* ---- 3. killing it ends the run, with no other action ---- */
    if(boss){
      const i = enemies.indexOf(boss);
      killEnemy(boss, i);
      R.push(`killed it and did nothing else: state=${G.state} win=${G.win} `+
             `foes left ${enemies.length} — must be over/true`);
    } else R.push('no finale creature to kill');
  }
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 600);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 4000);
