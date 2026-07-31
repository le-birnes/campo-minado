window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  // small board, dungeon rules forced on: the eye and the hatch do not care
  // which generator built the cave, only that G.dungeon is set
  G.mode=MODE_SWEEP; seed=11; genWorld(0); G.state='play'; G.dungeon=true;
  const n=G.nx*G.ny*G.nz;
  // open everything safe so a number is unsatisfied with real hidden mines
  for(let i=0;i<n;i++) if(!G.mine[i] && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  let num=-1;
  for(let i=0;i<n;i++){
    if(G.st[i]!==AIR || G.cnt[i]===0) continue;
    let hid=0; for(const j of nbrsOf(i)) if(G.st[j]===SOLID) hid++;
    if(hid>0){ num=i; break; }
  }
  const c=cellXYZ(num);
  const mines=[]; for(const j of nbrsOf(num)) if(G.st[j]===SOLID && G.mine[j]) mines.push(j);
  for(const j of mines) G.digAdj[j]=0;
  G.eye=true;
  hitNumber(c[0],c[1],c[2]);
  const tiers = mines.map(j=>{ const t=mineTier(G.digAdj[j]); return `${G.digAdj[j]}->hp${t.hp}${t.fly?' FLY x'+t.scale:''}`; });
  R.push(`the eye named ${mines.length} mines: ${tiers.join(', ')} (every one must be the flying band)`);
  // and it really hatches that way
  if(mines.length){
    enemies.length=0;
    const j=mines[0], cc=cellXYZ(j);
    G.st[j]=MARKED; G.marked++;
    hatchMine(j, cc[0],cc[1],cc[2]);
    const e=enemies[enemies.length-1];
    R.push(e ? `flagged it: hp ${e.hp}, rate ${e.mRate}, scale ${e.mScale}, fly ${!!e.mFly}, blinks ${e.mBlinks}`
             : 'flagged it: nothing came out (wrong)');
    R.push(`one flag, one arrival: ${enemies.length} enemy total (want exactly 1)`);
    // and a flag that hatches nothing may still wake something the old way
    const j2 = mines[1];
    if(j2!==undefined){
      enemies.length=0; G.digAdj[j2]=0;
      const cc2=cellXYZ(j2);
      G.st[j2]=MARKED; G.marked++;
      const hatched = hatchMine(j2, cc2[0],cc2[1],cc2[2]);
      R.push(`a mine with a zero counter: hatched ${hatched} (want false, so the ordinary spawn still gets its turn)`);
    }
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{ document.body.dataset.r=(window.__st||'DID NOT RUN')+
  ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE'); }, 6000);
