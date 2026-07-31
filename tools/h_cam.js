window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  seed=99; genWorld(0); G.state='play';

  const mm=(dx,dy)=>document.dispatchEvent(new MouseEvent('mousemove',
      {movementX:dx, movementY:dy, bubbles:true}));

  /* The handler only runs when the view is actually being driven. */
  const forceLook = ()=>{ dragLook=true; dragging=true; };

  /* 1. ordinary movement still turns you by exactly what you asked for */
  forceLook(); P.yaw=0; P.pitch=0;
  mm(100,0);
  const normal=-P.yaw;
  R.push(`a 100 px move turns ${normal.toFixed(4)} rad (sens ${G.sens}, expected ${(100*G.sens).toFixed(4)})`);

  /* 2. the spike that was spinning the camera */
  P.yaw=0; mm(6000,0);
  const spike=-P.yaw;
  R.push(`a 6000 px spike turns ${spike.toFixed(3)} rad = ${(spike*180/Math.PI).toFixed(0)} deg `+
         `(unclamped it would be ${(6000*G.sens*180/Math.PI).toFixed(0)} deg — most of a full turn `+
         `from one event)`);

  /* 3. garbage in must not become NaN out */
  P.yaw=0; P.pitch=0; mm(NaN, Infinity);
  R.push(`after a NaN/Infinity event: yaw=${P.yaw} pitch=${P.pitch} finite=${isFinite(P.yaw+P.pitch)}`);

  /* 4. pitch cannot be pushed over the top */
  P.pitch=0; for(let k=0;k<50;k++) mm(0,-400);
  R.push(`50 hard upward flicks: pitch ${P.pitch.toFixed(3)} (clamped at 1.5)`);

  /* 5. the camera turning with no input: a stuck arrow key after focus loss */
  P.yaw=0; KEY['ArrowLeft']=true;
  for(let k=0;k<60;k++) keyLook(1/60);
  const drifted=P.yaw;
  window.dispatchEvent(new Event('blur'));
  P.yaw=0;
  for(let k=0;k<60;k++) keyLook(1/60);
  R.push(`arrow key held: one second of keyLook turns ${drifted.toFixed(2)} rad `+
         `(${(drifted*180/Math.PI).toFixed(0)} deg); after losing focus it turns `+
         `${P.yaw.toFixed(2)} rad (want 0 — the key is released for you)`);

  /* 6. the kill counter behind "N of them went down with you" */
  {
    seed=7; genWorld(0); G.state='play'; G.boss=true;
    enemies.length=0; G.kills=0;
    let solid=-1;
    for(let i=0;i<G.nx*G.ny*G.nz;i++){
      if(G.st[i]!==SOLID) continue;
      const c0=cellXYZ(i);
      // spawnEnemy needs one of the SIX faces open, not any of the 26 neighbours
      for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        const X=c0[0]+g[0], Y=c0[1]+g[1], Z=c0[2]+g[2];
        if(inside(X,Y,Z) && G.st[idx(X,Y,Z)]===AIR){ solid=i; break; }
      }
      if(solid>=0) break;
    }
    const c=cellXYZ(solid);
    let spawned=0;
    for(let k=0;k<6;k++){ const e=spawnEnemy(k%3, 0, solid); if(e) spawned++; }
    const before=G.kills;
    // kill them the way a shot does
    while(enemies.length) killEnemy(enemies[0], 0);
    R.push(`spawned ${spawned} enemies, killed them all: G.kills went ${before} -> ${G.kills} `+
           `(must equal ${spawned}) — the end-of-run line reports this number`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 12000);
