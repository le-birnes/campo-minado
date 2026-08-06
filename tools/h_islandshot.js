setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  /* Straight to the island. Running the real 2.6 s of falling-upward through
     frame() with RENDERING ON is 1,200 drawn frames on a blocked main thread,
     and headless Chrome sat out its whole budget doing it — the harness calls
     that an endless loop and it is right to. The sequence itself is tested in
     h_ending.js where nothing draws; this only needs the destination. */
  buildIsland();
  /* stand back and look across the bank at the water */
  const cx=(G.nx/2)*BLOCK, cz=(G.nz/2)*BLOCK;
  P.x=cx - G.nx*BLOCK*0.42; P.y=G.ny*BLOCK*0.52; P.z=cz - G.nz*BLOCK*0.42;
  const vx=cx-P.x, vy=(G.ny*BLOCK*0.30)-P.y, vz=cz-P.z;
  P.yaw=Math.atan2(-vx,-vz); P.pitch=Math.atan2(vy, Math.hypot(vx,vz));
  G.dirty=true; rebuildWorld();
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  document.body.dataset.r='island '+!!G.island;
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
