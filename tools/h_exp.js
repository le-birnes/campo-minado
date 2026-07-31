window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const D=DIFFS[1], base={guess:D.guess, rough:D.rough};
  D.guess=null; D.rough=null;                       // regular arena, as specified
  const realRoll = rollDensExp;
  for(const [lo,hi] of [[-1,2],[1,2],[1.6,2.2],[2,3]]){
    rollDensExp = function(){ densExp = lo + rnd()*(hi-lo); };
    const got=[];
    for(let k=0;k<14;k++){
      G.mode=MODE_SWEEP; seed=8000+k*7919; genWorld(1);
      got.push(countForcedGuesses());
    }
    got.sort((a,b)=>a-b);
    const hit=got.filter(g=>g>=1&&g<=2).length, zero=got.filter(g=>g===0).length;
    R.push(`exponent ${lo} to ${hi}: ${got.join(',')} — ${zero}/14 need none, ${hit}/14 in 1-2`);
  }
  rollDensExp = realRoll;
  Object.assign(D, base);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
