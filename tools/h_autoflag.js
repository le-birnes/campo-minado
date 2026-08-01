window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const pick=()=>{ // a number that hides only mines
    for(let i=0;i<G.nx*G.ny*G.nz;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      let f=0,hid=0; for(const j of nbrsOf(i)){ const s=G.st[j]; if(s===MARKED)f++; else if(s===SOLID)hid++; }
      if(hid>0 && G.cnt[i]-f===hid) return [i,hid];
    }
    return [-1,0];
  };
  G.mode=MODE_SWEEP;

  /* mid-game: a number whose neighbours are all mines must NOT flag them */
  seed=11; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  let opened=0;
  for(let i=0;i<n && opened<120;i++) if(!G.mine[i] && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; opened++; }
  let [num,hid]=pick(), mk=G.marked;
  if(num>=0){ const c=cellXYZ(num); hitNumber(c[0],c[1],c[2]); }
  R.push(`mid-game (${G.revealed}/${G.safeTotal} dug), a number hiding ${hid} mines and nothing else: `+
         `flags +${G.marked-mk} (want 0)`);

  /* board fully dug: now it must */
  for(let i=0;i<n;i++) if(!G.mine[i] && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  [num,hid]=pick(); mk=G.marked;
  const c2=cellXYZ(num); hitNumber(c2[0],c2[1],c2[2]);
  let wrong=0; for(let i=0;i<n;i++) if(G.st[i]===MARKED && !G.mine[i]) wrong++;
  R.push(`board fully dug (${G.revealed}/${G.safeTotal}), same move: flags +${G.marked-mk} `+
         `(want ${hid}), wrongly flagged ${wrong} (want 0), state ${G.state}`);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
