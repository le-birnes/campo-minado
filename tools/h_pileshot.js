/* Pour sand on the left and water on the right, from identical spouts, and
   photograph both. The numbers say one makes a 1.75 m cone and the other a
   flat sheet 17 m wide; a picture says whether that is what it looks like. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  const cx=(G.nx/2)|0, cz=(G.nz/2)|0;
  for(let y=1;y<Math.min(G.ny,8);y++) for(let z=cz-6;z<=cz+6;z++) for(let x=cx-8;x<=cx+8;x++){
    if(!inside(x,y,z)) continue;
    const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  }
  RAW.n=0; RAW.oldest=0; RAW.occ.clear(); RAW.under.clear();
  RAW.key.fill(0); RAW.rest.fill(0);
  const dropY=(3)*BLOCK;
  const sxw=(cx-3.5)*BLOCK, wxw=(cx+3.5)*BLOCK, zw=(cz+0.5)*BLOCK;
  for(let k=0;k<520;k++){
    if(k<260) rawAdd(sxw+(rnd()-.5)*0.2, dropY, zw+(rnd()-.5)*0.2, 0,0,0, R_SAND);
    if(k<260) rawAdd(wxw+(rnd()-.5)*0.2, dropY, zw+(rnd()-.5)*0.2, 0,0,0, R_WATER);
    for(let q=0;q<2;q++) rawStep(1/60);
  }
  for(let k=0;k<4000;k++){ rawStep(1/60); if(RAW.moving===0) break; }

  /* look across both from the side, level with the floor */
  /* AIM AT THE GRAINS, not past them. The first shot stood 21 m back with a
     shallow pitch and photographed the dark beyond the room: the piles are
     only ~1.7 m tall and they sit ON THE FLOOR, so the eye has to be low and
     close and looking down. Their own centroid is the only thing that knows
     where they ended up. */
  let gx=0,gy=0,gz=0;
  for(let k=0;k<RAW.n;k++){ gx+=RAW.x[k]; gy+=RAW.y[k]; gz+=RAW.z[k]; }
  gx/=RAW.n; gy/=RAW.n; gz/=RAW.n;
  P.x=gx; P.y=gy+2.6; P.z=gz+7.0;
  const vx=gx-P.x, vy=(gy+0.4)-P.y, vz=gz-P.z;
  P.yaw=Math.atan2(-vx,-vz); P.pitch=Math.atan2(vy, Math.hypot(vx,vz));
  G.dirty=true; rebuildWorld();
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  document.body.dataset.r='grains '+RAW.n+' moving '+RAW.moving;
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
