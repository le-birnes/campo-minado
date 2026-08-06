/* Destroy a sand block and photograph what it left. The counters say 120 sand
   and 20 rock grains spread over three and a half metres; only a picture says
   whether that reads as a pile of raw material on the floor. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_SWEEP; seed=4; genWorld(0); G.state='play';

  /* Clear a room so there is a floor to land on and space to see it. */
  const cx=(G.nx/2)|0, cy=1, cz=(G.nz/2)|0;
  for(let y=cy;y<Math.min(G.ny,cy+4);y++)
  for(let z=cz-3;z<=cz+3;z++) for(let x=cx-3;x<=cx+3;x++){
    if(!inside(x,y,z)) continue;
    const i=idx(x,y,z);
    if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  }
  /* one block left standing in the middle of it, then blown apart */
  const bx=cx, by=cy+1, bz=cz;
  const i=idx(bx,by,bz);
  G.st[i]=AIR;
  rawBurst(bx,by,bz, 0,0,1, 260);
  for(let k=0;k<400;k++){ rawStep(1/60); if(k>10 && RAW.moving===0) break; }

  /* stand back and look down at the pile */
  const wx=(bx+0.5)*BLOCK, wy=(by)*BLOCK, wz=(bz+0.5)*BLOCK;
  /* AIM AT WHERE THEY ACTUALLY ARE, not where I assumed they would stop. Two
     shots were framed on the block's own position and came back showing bare
     floor, because the grains had fallen past it to whatever the real floor
     turned out to be. Their centroid cannot be wrong about that. */
  let gx=0,gy=0,gz=0;
  for(let k=0;k<RAW.n;k++){ gx+=RAW.x[k]; gy+=RAW.y[k]; gz+=RAW.z[k]; }
  gx/=RAW.n; gy/=RAW.n; gz/=RAW.n;
  P.x=gx; P.y=gy+BLOCK*0.7; P.z=gz+BLOCK*1.5;
  const vx=gx-P.x, vy=gy-P.y, vz=gz-P.z;
  P.yaw=Math.atan2(-vx,-vz); P.pitch=Math.atan2(vy, Math.hypot(vx,vz));
  G.dirty=true; rebuildWorld();

  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  document.body.dataset.r='grains '+RAW.n+' moving '+RAW.moving+' centroid '+gx.toFixed(1)+','+gy.toFixed(1)+','+gz.toFixed(1)+' eye '+P.y.toFixed(1);
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
