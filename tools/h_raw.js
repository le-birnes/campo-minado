window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';

  /* find a solid sand block with air beside it */
  let tgt=-1, air=-1;
  for(let y=0;y<G.ny&&tgt<0;y++) for(let z=0;z<G.nz&&tgt<0;z++) for(let x=0;x<G.nx&&tgt<0;x++){
    const i=idx(x,y,z);
    if(G.st[i]!==SOLID||G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(G.st[j]===AIR){ tgt=i; air=j; break; }
  }
  const [tx,ty,tz]=cellXYZ(tgt), [ax,ay,az]=cellXYZ(air);
  R.push(`RAW starts empty: ${RAW.n}`);

  /* the block must be GONE before its contents can fall through where it was */
  G.st[tgt]=AIR; G.revealed++;
  rawBurst(tx,ty,tz, Math.sign(tx-ax),Math.sign(ty-ay),Math.sign(tz-az), 150);
  R.push(`one block burst -> ${RAW.n} grains`);
  let sand=0, rock=0, water=0;
  for(let i=0;i<RAW.n;i++){ if(RAW.m[i]===R_SAND)sand++; else if(RAW.m[i]===R_ROCK)rock++; else water++; }
  R.push(`composition: ${sand} sand, ${rock} rock, ${water} water (all three present: ${sand&&rock?'yes':'NO'})`);

  /* they must FALL and SETTLE, and then cost nothing */
  let t=0, ticks=0;
  for(; ticks<600 && RAW.moving!==0 || ticks===0; ticks++){ rawStep(1/60); if(ticks>2&&RAW.moving===0) break; }
  R.push(`settled after ${ticks} ticks (${(ticks/60).toFixed(2)}s), ${RAW.moving} still moving`);

  /* and they must PERSIST - nothing fades */
  for(let k=0;k<600;k++) rawStep(1/60);
  R.push(`persistence: ${RAW.n} grains still there after 10 more seconds`);

  /* they must be spread, not stacked in one spot */
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
  for(let i=0;i<RAW.n;i++){
    x0=Math.min(x0,RAW.x[i]); x1=Math.max(x1,RAW.x[i]);
    y0=Math.min(y0,RAW.y[i]); y1=Math.max(y1,RAW.y[i]);
    z0=Math.min(z0,RAW.z[i]); z1=Math.max(z1,RAW.z[i]);
  }
  R.push(`spread: ${(x1-x0).toFixed(1)} x ${(y1-y0).toFixed(1)} x ${(z1-z0).toFixed(1)} m `+
         `(block is ${BLOCK} m) ${(x1-x0)>BLOCK?'ok':'TOO TIGHT'}`);

  /* the cap must hold */
  for(let k=0;k<20;k++) rawBurst(tx,ty,tz, 1,0,0, 150);
  R.push(`cap: ${RAW.n} of ${RAW_MAX} ${RAW.n<=RAW_MAX?'ok':'FAULT'}`);

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 300);
