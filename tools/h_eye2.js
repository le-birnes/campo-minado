window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const hudText = () => { const el=document.getElementById('sPow'); return el ? el.textContent : '(missing)'; };
  const hudShown = () => { const el=document.getElementById('sPow'); return el && el.parentNode.style.display !== 'none'; };

  /* The reported symptom: the eye sat on the HUD and would not fire. The only
     thing besides firing that clears G.eye is starting a new board — so the
     question is whether the HUD is told. */
  seed=1234; genWorld(1); G.state='play';
  G.eye = true; G.safeShot = true; syncPowHud();
  R.push(`holding both: G.eye=${G.eye} HUD "${hudText()}" shown=${hudShown()}`);

  // now start a fresh board, exactly as R / restart / a new run does
  seed=4321; genWorld(1); G.state='play';
  R.push(`after a new board: G.eye=${G.eye} G.safeShot=${G.safeShot} `+
         `HUD "${hudText()}" shown=${hudShown()} `+
         `— stale HUD would read "THE EYE" while G.eye is false, which is a `+
         `power-up that will not fire and will not go away`);

  // and the eye still works on the fresh board once genuinely held
  const n=G.nx*G.ny*G.nz;
  for(let k=0;k<60;k++){
    let t=-1;
    for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ t=i; break; }
    if(t<0) break; revealAt(t,true);
  }
  let want=-1;
  for(let i=0;i<n;i++){
    if(G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0,h=0;
    for(const j of nbrsOf(i)){ if(G.st[j]===MARKED) f++; else if(G.st[j]===SOLID) h++; }
    if(h>0 && f!==G.cnt[i]){ want=i; break; }
  }
  G.eye=true; syncPowHud();
  const c=cellXYZ(want);
  hitNumber(c[0],c[1],c[2]);
  R.push(`granted again and used: fired=${!G.eye} HUD now "${hudText()}" shown=${hudShown()}`);

  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 12000);
