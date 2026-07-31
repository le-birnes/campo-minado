window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  for(const d of [0,1,2]){
    const B=8, g=[], dp=[], mn=[];
    for(let k=0;k<B;k++){
      G.mode=MODE_SWEEP; seed=9000+k*7919; genWorld(d);
      g.push(G.guesses); dp.push(G.depth||0); mn.push(G.mines);
    }
    const D=DIFFS[d];
    const okG=g.filter(v=>v>=D.guess[0]&&v<=D.guess[1]).length;
    const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
    R.push(`${D.name}: guesses ${g.join(',')} (${okG}/${B} at ${D.guess[0]}-${D.guess[1]}) | `+
           `stacked-logic share ${dp.map(v=>(100*v).toFixed(0)+'%').join(',')} `+
           `(want ${(100*D.depth[0]).toFixed(0)}-${(100*D.depth[1]).toFixed(0)}%) | `+
           `mines ${Math.min(...mn)}-${Math.max(...mn)} (avg ${avg(mn).toFixed(0)}) | `+
           `clusters ${D.clusters[0]}-${D.clusters[1]} of ${D.csize[0]}-${D.csize[1]}`);
  }
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
