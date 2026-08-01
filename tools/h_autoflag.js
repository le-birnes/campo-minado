window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_SWEEP; seed=11; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  // open every safe block: now every number's remaining neighbours are mines
  for(let i=0;i<n;i++) if(!G.mine[i] && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  // a number that still touches unflagged mines
  let num=-1;
  for(let i=0;i<n;i++){
    if(G.st[i]!==AIR || G.cnt[i]===0) continue;
    let hid=0; for(const j of nbrsOf(i)) if(G.st[j]===SOLID) hid++;
    if(hid>0){ num=i; break; }
  }
  const c=cellXYZ(num);
  let hidden=0; for(const j of nbrsOf(num)) if(G.st[j]===SOLID) hidden++;
  const m0=G.marked;
  const before=G.state;
  hitNumber(c[0],c[1],c[2]);
  R.push(`a ${G.cnt[num]} with ${hidden} hidden, all of them mines: right click flagged `+
         `${G.marked-m0} (want ${hidden}), state ${before}->${G.state}`);
  let wrong=0;
  for(let i=0;i<n;i++) if(G.st[i]===MARKED && !G.mine[i]) wrong++;
  R.push(`wrongly flagged: ${wrong} (want 0)`);

  // and it must NOT fire when a safe block is still hidden among them
  seed=11; genWorld(0); G.state='play';
  let num2=-1, safeNb=-1;
  for(let i=0;i<n && num2<0;i++){
    if(G.st[i]!==AIR || G.cnt[i]===0) continue;
    let mines=0, safes=0, sn=-1;
    for(const j of nbrsOf(i)){ if(G.st[j]!==SOLID) continue; if(G.mine[j]) mines++; else { safes++; sn=j; } }
    if(mines>0 && safes>0){ num2=i; safeNb=sn; }
  }
  const c2=cellXYZ(num2), mk=G.marked;
  hitNumber(c2[0],c2[1],c2[2]);
  R.push(`a number that still hides a SAFE block: flags +${G.marked-mk} (want 0), `+
         `safe neighbour still shut: ${G.st[safeNb]===SOLID}`);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
