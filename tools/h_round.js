/* What corner rate makes a heap ROUND. Round is diag/axis = 1.00; four lateral
   directions can only make a diamond (0.71) and eight taken evenly make a
   square (1.41), so the answer is somewhere between and it is measured here
   rather than argued. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>v.toFixed(2);
  function box(W,H,D){
    const w = new SandWorld(W,H,D);
    for(let y=1;y<H;y++) for(let z=0;z<D;z++) for(let x=0;x<W;x++)
      w.set(x,y,z,S_AIR);
    return w;
  }
  function pour(w, mat, grains, cap){
    const cx=w.W>>1, cz=w.D>>1, top=w.H-3;
    let left=grains, t=0;
    while(t++ < cap){
      for(let k=0;k<40 && left>0;k++) if(w.at(cx,top,cz)===S_AIR){ w.put(cx,top,cz,mat); left--; }
      sandTick(w,-1);
      if(!left && !w.awake.length) break;
    }
    for(let k=0;k<200 && w.awake.length;k++) sandTick(w,-1);
  }
  /* THE BODY OF THE HEAP, NOT ITS STRAGGLERS. Measuring the outermost grain
     along a ray lets one bead that rolled too far set the radius, and at a
     heap radius of eight cells that is most of the measurement. This walks out
     until the column is thinner than MINH, which is where the heap stops being
     a heap. */
  const MINH = 3;
  function reach(w, mat, dx, dz){
    const cx=w.W>>1, cz=w.D>>1, len=Math.hypot(dx,dz);
    for(let s=1;s<(w.W>>1)-1;s++){
      let h=0;
      for(let y=1;y<w.H-1;y++) if(w.at(cx+dx*s,y,cz+dz*s)===mat) h++;
      if(h < MINH) return (s-1)*len;
    }
    return 0;
  }
  function shape(w, mat){
    const ax=(reach(w,mat,1,0)+reach(w,mat,-1,0)+reach(w,mat,0,1)+reach(w,mat,0,-1))/4;
    const dg=(reach(w,mat,1,1)+reach(w,mat,1,-1)+reach(w,mat,-1,1)+reach(w,mat,-1,-1))/4;
    return {ax,dg,r: ax>0?dg/ax:0};
  }
  const keep = CORNER_RATE;
  SAND_LAT = 8;
  for(const rate of [0.04, 0.06, 0.08, 0.10]){
    CORNER_RATE = rate;
    const out=[];
    for(const m of [S_SAND, S_WETSND, S_RUBBLE]){
      const w = box(96,64,96); pour(w, m, 14000, 1400);
      out.push(`${SMAT[m].n} ${f2(shape(w,m).r)}`);
    }
    R.push(`corner ${f2(rate)} : ${out.join(', ')}`);
  }
  CORNER_RATE = keep;
  /* And it must hold for a material with a different angle of repose: the rate
     multiplies slip, so wet sand at 0.18 should keep the same SHAPE while
     standing much steeper. */
  for(const m of [S_SAND, S_WETSND, S_RUBBLE]){
    const w = box(96,64,96); pour(w, m, 14000, 1400);
    const s = shape(w, m);
    let top=0; for(let y=1;y<w.H;y++) if(w.at(w.W>>1,y,w.D>>1)===m) top=y;
    R.push(`${SMAT[m].n} slip ${SM_SLIP[m]} : axis ${f2(s.ax)} diag ${f2(s.dg)} -> ${f2(s.r)}, ${top} cells tall`);
  }
  R.push(`shipping ${f2(keep)}`);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 300);
