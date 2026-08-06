window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  /* a wide flat room, so a heap has room to be a heap and a puddle to spread */
  const cx=(G.nx/2)|0, cz=(G.nz/2)|0;
  for(let y=1;y<Math.min(G.ny,7);y++) for(let z=cz-5;z<=cz+5;z++) for(let x=cx-5;x<=cx+5;x++){
    if(!inside(x,y,z)) continue;
    const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  }
  const dropY=(3)*BLOCK, wx=(cx+0.5)*BLOCK, wz=(cz+0.5)*BLOCK;

  /* A TRICKLE, not a column. The first version spawned all 260 at once in a
     stack 27 m tall, which reached up into solid rock — so every grain was
     born inside something and froze there, and all five materials reported the
     identical 27.19 m "heap" that was really just the spawn column. A pour has
     to actually pour. */
  function pour(mat, n){
    RAW.n=0; RAW.oldest=0; RAW.occ.clear(); RAW.under.clear();
    RAW.key.fill(0); RAW.rest.fill(0);
    let made=0;
    for(let k=0;k<9000 && (made<n || RAW.moving>0);k++){
      if(made<n && (k%2)===0){
        rawAdd(wx+(rnd()-.5)*0.2, dropY, wz+(rnd()-.5)*0.2, 0,0,0, mat);
        made++;
      }
      rawStep(1/60);
    }
    for(let k=0;k<3000;k++){ rawStep(1/60); if(RAW.moving===0) break; }
    let lo=1e9,hi=-1e9,rad=0;
    for(let i=0;i<RAW.n;i++){
      lo=Math.min(lo,RAW.y[i]); hi=Math.max(hi,RAW.y[i]);
      rad=Math.max(rad, Math.hypot(RAW.x[i]-wx, RAW.z[i]-wz));
    }
    let cells=new Set();
    for(let i=0;i<RAW.n;i++) cells.add(rawKey(RAW.x[i],RAW.y[i],RAW.z[i]));
    return {h:hi-lo, rad, n:RAW.n, lo, hi, occ:RAW.occ.size, cells:cells.size,
            rest1:(()=>{let c=0;for(let i=0;i<RAW.n;i++) if(RAW.rest[i]===1)c++;return c;})()};
  }
  const NM=['sand','rock','water','glass','wet sand'];
  R.push('poured 260 grains of each from one spout onto a flat floor:');
  const out=[];
  for(const m of [R_SAND,R_ROCK,R_WATER,R_GLASS,R_WETSAND]){
    const r=pour(m,260); out.push({m, ...r});
    R.push(`  ${NM[m].padEnd(9)} y ${r.lo.toFixed(2)}..${r.hi.toFixed(2)} rad ${r.rad.toFixed(2)} `+
           `| ${r.n} grains in ${r.cells} distinct cells, occ ${r.occ}, asleep ${r.rest1}`);
  }
  const water=out[2], wet=out[4], sand=out[0];
  R.push(`water FLATTER than sand: ${water.h < sand.h ? 'yes' : 'NO ('+water.h.toFixed(2)+' vs '+sand.h.toFixed(2)+')'}`);
  R.push(`water SPREADS further than sand: ${water.rad > sand.rad ? 'yes' : 'NO'}`);
  R.push(`wet sand STEEPER than dry: ${(wet.h/wet.rad) > (sand.h/sand.rad) ? 'yes' : 'NO'}`);

  /* DENSITY NEEDS A POOL, NOT A PUDDLE. The first run of this poured water on
     an open floor, where it spread to a sheet ONE CELL deep — and there is
     nothing to sink through in one cell. So: a narrow pit, filled with water,
     and sand dropped into it. */
  /* AND THE PIT NEEDS WALLS. The first attempt dug it inside the room that had
     already been cleared, so it was a pit with nothing round it and the water
     simply ran away across the floor. Walls first, then the hole. */
  const px=(cx-3), pz=(cz-3);
  for(let y=1;y<=5;y++) for(let z=pz-1;z<=pz+2;z++) for(let x=px-1;x<=px+2;x++){
    if(inside(x,y,z)) G.st[idx(x,y,z)] = SOLID;
  }
  for(let y=1;y<=5;y++) for(let z=pz;z<=pz+1;z++) for(let x=px;x<=px+1;x++){
    if(inside(x,y,z)) G.st[idx(x,y,z)] = AIR;
  }
  RAW.n=0; RAW.oldest=0; RAW.occ.clear(); RAW.under.clear();
  RAW.key.fill(0); RAW.rest.fill(0);
  const pw=(px+1)*BLOCK, pwz=(pz+1)*BLOCK;
  for(let k=0;k<200;k++){
    rawAdd(pw+(rnd()-.5)*1.2, 3.0+(k%20)*0.02, pwz+(rnd()-.5)*1.2, 0,0,0, R_WATER);
    for(let q=0;q<3;q++) rawStep(1/60);
  }
  for(let k=0;k<3000;k++){ rawStep(1/60); if(RAW.moving===0) break; }
  const wMean0=(()=>{let s=0,n=0;for(let i=0;i<RAW.n;i++){s+=RAW.y[i];n++;}return s/n;})();
  for(let k=0;k<40;k++){
    rawAdd(pw+(rnd()-.5)*0.5, 5.0, pwz+(rnd()-.5)*0.5, 0,0,0, R_SAND);
    for(let q=0;q<3;q++) rawStep(1/60);
  }
  for(let k=0;k<6000;k++){ rawStep(1/60); if(RAW.moving===0) break; }
  let ws=0,wn=0,ss=0,sn=0;
  for(let i=0;i<RAW.n;i++){ if(RAW.m[i]===R_WATER){ws+=RAW.y[i];wn++;} else {ss+=RAW.y[i];sn++;} }
  R.push(`a pool ${wn} water deep (mean y was ${wMean0.toFixed(2)}), ${sn} sand dropped in:`);
  R.push(`  sand mean y ${(ss/sn).toFixed(2)}, water mean y ${(ws/wn).toFixed(2)} `+
         `-> denser sand sank BELOW the water: ${(ss/sn) < (ws/wn) ? 'yes' : 'NO'}`);
  R.push(window.__err.length?('FAULT '+window.__err.join(' | ')):'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
