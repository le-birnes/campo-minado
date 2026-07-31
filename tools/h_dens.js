window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const base=DIFFS[1].dens, guard=DIFFS[1].guess;
  DIFFS[1].guess=null;                       // measure the raw board, no sampling
  for(const dens of [0.11,0.12,0.13,0.14,0.15]){
    DIFFS[1].dens=dens;
    const got=[];
    for(let k=0;k<14;k++){
      G.mode=MODE_SWEEP; seed=8000+k*7919; genWorld(1);
      got.push(countForcedGuesses());
    }
    got.sort((a,b)=>a-b);
    const hit=got.filter(g=>g>=1&&g<=2).length;
    const zero=got.filter(g=>g===0).length;
    R.push(`Sorcerer at ${(dens*100).toFixed(0)}%: guesses ${got.join(',')} — `+
           `${zero}/14 boards need none, ${hit}/14 land in 1-2`);
  }
  DIFFS[1].dens=base; DIFFS[1].guess=guard;
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
