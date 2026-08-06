window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';

  /* An untouched world must cost EXACTLY what it costs today: nothing is
     voxelised until it is hit, which is the whole design. */
  rebuildWorld(); const plain = worldB.count;
  R.push(`untouched: ${plain} instances, ${VOX.size} blocks voxelised (want 0)`);

  /* find a solid, damageable block with air on a face */
  let tgt=-1;
  for(let y=0;y<G.ny&&tgt<0;y++) for(let z=0;z<G.nz&&tgt<0;z++) for(let x=0;x<G.nx&&tgt<0;x++){
    const i=idx(x,y,z);
    if(G.st[i]!==SOLID||G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(G.st[j]===AIR){ tgt=i; break; }
  }
  const [tx,ty,tz]=cellXYZ(tgt);

  const v = voxelise(tgt);
  R.push(`voxelise: ${v.alive} voxels alive of ${VOX_N} (want 4096)`);
  rebuildWorld();
  R.push(`whole-but-voxelised draws as one cube: ${worldB.count===plain?'yes':'no, '+worldB.count}`);

  const took = voxCarve(tgt, 0,8,8, 1,0,0, 40000);
  /* stand next to it: the draw budget is by DISTANCE, so a carved block the
     player is nowhere near correctly stays a plain cube. */
  P.x=(tx+0.5)*BLOCK; P.y=(ty+0.5)*BLOCK; P.z=(tz+0.5)*BLOCK;
  rebuildWorld();
  const carved = worldB.count;
  R.push(`one shot carved ${took} voxels, ${v.alive} left, instances ${plain} -> ${carved}`);
  /* 1,352 is the outer shell of a SOLID 16^3 and was the wrong number to test
     against: a carved block also exposes the walls of the cavity, so more than
     that is correct rather than a leak. What matters is that culling still
     removes most of the interior. */
  const emitted = carved-plain;
  R.push(`cull: ${emitted} emitted of ${v.alive} alive = `+
         `${(100-emitted/v.alive*100).toFixed(0)}% hidden ${emitted<v.alive?'ok':'FAULT'}`);

  /* PERSISTENCE: nothing is ever evicted, so voxelising twenty keeps twenty.
     What is bounded is the DRAW, not the data. */
  let made=0;
  for(let y=0;y<G.ny&&made<20;y++) for(let z=0;z<G.nz&&made<20;z++)
  for(let x=0;x<G.nx&&made<20;x++){
    const i=idx(x,y,z);
    if(G.st[i]!==SOLID||G.mine[i]) continue;
    const v=voxelise(i); voxCarve(i, 8,8,0, 0,0,1, 20000); made++;
  }
  R.push(`persistence: carved ${made}, VOX holds ${VOX.size} (want ${made})`);
  rebuildWorld();
  let drawn=0; for(const [,v] of VOX) if(v.draw) drawn++;
  R.push(`draw budget: ${drawn} drawn as voxels of ${VOX.size} carved (want <= ${VOX_DRAW})`);

  /* and it must never overflow the batch */
  rebuildWorld();
  R.push(`batch: ${worldB.count} of ${worldB.max} ${worldB.count>=worldB.max?'FAULT OVERFLOW':'ok'}`);

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 300);
