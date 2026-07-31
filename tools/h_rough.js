window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const D=DIFFS[1], base={dens:D.dens, guess:D.guess, rough:D.rough};
  D.guess=null;
  for(const rough of [null,[0.03,0.07],[0.06,0.12],[0.10,0.18]]){
    D.rough = rough;
    const got=[];
    for(let k=0;k<14;k++){
      G.mode=MODE_SWEEP; seed=8000+k*7919; genWorld(1);
      got.push(countForcedGuesses());
    }
    got.sort((a,b)=>a-b);
    const hit=got.filter(g=>g>=1&&g<=2).length, zero=got.filter(g=>g===0).length;
    R.push(`structure ${rough?((rough[0]*100)+'-'+(rough[1]*100)+'%'):'none'}: `+
           `${got.join(',')} — ${zero}/14 need none, ${hit}/14 in 1-2`);
  }
  Object.assign(D, base);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
