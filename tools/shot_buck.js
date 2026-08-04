/* Photograph the shot. Numbers said the barrel points forward and the cone
   caps at four radii; this is the part that can only be judged by looking.

   The pellets are frozen mid-flight on purpose. Under the virtual clock there
   is no way to catch them at a chosen moment, so: fire once, spread the
   flight distances by hand across the interesting range, then stop the
   update so the picture holds. Nothing about their POSITIONS is faked — each
   one is placed by the same expression the draw uses. */
setTimeout(()=>{ try{
  G.muted = true; try{ snd.setMute(true); }catch(e){}
  G.mode = MODE_SWEEP; G.diff = 0;
  startGame();
  seed = 313; genWorld(0); G.state='play'; try{ setScreen('play'); }catch(e){}
  enemies.length = 0;
  try{ hurtPlayer = function(){}; }catch(e){}

  /* Stand in the open face looking along it, so there is depth behind the
     shot instead of a wall 2 m away. */
  const px = Math.floor(P.x/BLOCK), pz = Math.floor(P.z/BLOCK);
  const py = Math.round(P.y/BLOCK);
  for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i = idx(x,py,z);
    if(G.st[i]!==ROCK && G.st[i]!==AIR && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  }
  G.dirty = true;
  P.yaw = Math.atan2(-(G.nx*BLOCK*0.5 - P.x), -(G.nz*BLOCK*0.5 - P.z));
  P.pitch = 0.02;
  recoil = 0.55;                     // caught mid-kick
  shoot();
  /* Spread them down the line so the cone AND the parallel run are both in
     frame at once. */
  for(let i=0;i<pellets.length;i++)
    pellets[i].t = 0.25 + (i/Math.max(1,pellets.length-1))*7.5;
  updatePellets = function(){};      // hold the picture
  /* The pointer-lock notice sits dead centre-bottom, which is exactly where
     the weapon is. It hid the whole gun in the first attempt at this shot. */
  const t = document.getElementById('toast');
  if(t){ t.style.display = 'none'; }
  toast = function(){};
}catch(err){ document.body.dataset.r = 'THROW '+err.message; } }, 300);
setTimeout(()=>{ document.body.dataset.r = 'shot, ' + pellets.length + ' pellets'; }, 900);
