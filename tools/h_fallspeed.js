/* How long does a bead take to fall, against what gravity says it should? */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>v.toFixed(2);
  function box(W,H,D){
    const w=new SandWorld(W,H,D);
    for(let y=1;y<H;y++) for(let z=0;z<D;z++) for(let x=0;x<W;x++)
      w.m[(y+1)*w.SY+(z+1)*w.SZ+(x+1)]=S_AIR;
    return w;
  }
  for(const cells of [16, 48, 160]){
    const w=box(8, cells+4, 8);
    w.put(4, cells+1, 4, S_SAND);
    let t=0;
    for(; t<4000; t++){ sandTick(w,-1); if(w.at(4,1,4)===S_SAND) break; }
    const drop=(cells)*CELL_M, secs=t/SAND_HZ;
    const real=Math.sqrt(2*drop/9.8);
    R.push(`${f2(drop)} m: ${t} ticks = ${f2(secs)} s, free fall is ${f2(real)} s ` +
           `(${f2(real/Math.max(secs,0.001))}x real) ` + (secs <= real*1.05 ? 'ok' : 'SLOW'));
  }
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
