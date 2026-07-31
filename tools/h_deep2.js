window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const D=DIFFS[2], base={clusters:D.clusters, csize:D.csize, depth:D.depth, rough:D.rough, guess:D.guess};
  D.depth=[0,1]; D.guess=[0,0];        // take the depth filter off, just measure
  const cfgs=[
    [[20,50],[2,6],[0.15,0.30],'as shipped'],
    [[30,60],[3,8],[0.15,0.30],'more+bigger'],
    [[40,80],[4,10],[0.15,0.30],'much more  '],
    [[30,60],[3,8],[0.25,0.40],'more struct'],
  ];
  for(const [cl,cs,rg,label] of cfgs){
    D.clusters=cl; D.csize=cs; D.rough=rg;
    const dp=[], mn=[], gs=[];
    for(let k=0;k<6;k++){
      G.mode=MODE_SWEEP; seed=9000+k*7919; genWorld(2);
      dp.push(G.depth||0); mn.push(G.mines); gs.push(G.guesses);
    }
    const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
    R.push(`${label} cl${cl} sz${cs} rock${rg[0]}-${rg[1]}: stacked `+
           `${dp.map(v=>(100*v).toFixed(0)).join(',')}% avg ${(100*avg(dp)).toFixed(0)}% | `+
           `mines avg ${avg(mn).toFixed(0)} | guesses ${gs.join(',')}`);
  }
  Object.assign(D, base);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
