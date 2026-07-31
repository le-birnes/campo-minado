window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  /* Apprentice: 300 cells, not 7776. The counter does not care what mode built
     the board, only that G.dungeon is set, so this tests the same code path in
     a twentieth of the work. */
  G.mode=MODE_SWEEP; seed=11; genWorld(0); G.state='play';
  G.dungeon = true;
  const n=G.nx*G.ny*G.nz;

  // a mine, and one safe neighbour held back so there is something left to shoot
  let m=-1, keep=-1;
  for(let i=0;i<n && m<0;i++){
    if(!G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(!G.mine[j]){ m=i; keep=j; break; }
  }
  for(let i=0;i<n;i++) if(i!==keep && !G.mine[i] && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }

  const ded = mineDeducible(m);
  G.digAdj[m]=0;
  G.st[keep]=AIR; G.revealed++;        // the block opened, but nothing shot it
  const afterOpen = G.digAdj[m];
  noteDigNear(keep);                    // this is the shot
  const afterShot = G.digAdj[m];

  R.push(`provable ${ded} | opening it alone: digAdj ${afterOpen} | the shot: ${afterShot} (want 0 then 1)`);

  // and a shot next to a mine the board CANNOT yet prove must not count
  seed=11; genWorld(0); G.state='play'; G.dungeon=true;
  let m2=-1, nb=-1;
  for(let i=0;i<n && m2<0;i++){
    if(!G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(!G.mine[j] && G.st[j]!==AIR){ m2=i; nb=j; break; }
  }
  const ded2 = mineDeducible(m2);
  G.digAdj[m2]=0;
  G.st[nb]=AIR; G.revealed++;
  noteDigNear(nb);
  R.push(`on a fresh board, provable ${ded2}: a shot beside it leaves digAdj at ${G.digAdj[m2]} (want 0)`);

  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 6000);
