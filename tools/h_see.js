/* LOOK AT THE THING. The island has never once been photographed from outside,
   and every picture that tried put the camera inside the sand.

   Down is +Y after the boss, so the SKY is at small y and the sea floor is at
   large y. The camera goes well above the waterline, well outside the island's
   radius, and looks back down at it. Prefixed se. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.noWin=true; G.gravK=-1; rollReset();
  revealIsland();
  bossHole((G.holeX+0.5)*BLOCK, (G.holeZ+0.5)*BLOCK);

  const seCx=(G.nx*0.5)*BLOCK, seCz=(G.nz*0.5)*BLOCK;
  const seQ = (k,d) => { const m=new RegExp('[?&]'+k+'=([-\\d.]+)').exec(location.search);
                         return m ? parseFloat(m[1]) : d; };
  /* how far out, and how high above the waterline, as fractions of the world */
  const seOut = seQ('out', 1.15), seUp = seQ('up', 0.55);
  const seA   = seQ('ang', 0.7) * Math.PI;
  P.x = seCx + Math.cos(seA)*G.nx*BLOCK*seOut*0.5;
  P.z = seCz + Math.sin(seA)*G.nz*BLOCK*seOut*0.5;
  /* small y is UP: the waterline is G.seaY, so go above it */
  P.y = (G.seaY - G.ny*seUp*0.5) * BLOCK;
  const vx=seCx-P.x, vz=seCz-P.z, vy=(G.seaY+2)*BLOCK - P.y;
  P.yaw = Math.atan2(-vx,-vz);
  P.pitch = seQ("ps",1) * Math.atan2(vy, Math.hypot(vx,vz)); // sign flips with gravity
  P.vx=P.vy=P.vz=0; P.fx.fill(0); P.hp=P.hpMax=HP_START;
  G.dirty=true; rebuildWorld();
  /* FREEZE IT. Left in play the physics runs for the whole virtual budget and
     the player is buried alive before the shutter opens - the first attempt
     photographed a game-over screen reading YOU ARE SAND NOW. */
  G.state='pause'; P.vx=P.vy=P.vz=0;
  /* AND IT HAS TO BE DAYLIGHT. darkNow() only gives the sun's light when
     G.island is set, and the sun's elevation is read through gsign(), so a
     paused world with a cold clock comes out as a cave at midnight - which is
     what the second attempt photographed. */
  G.island = true; try{ skyNow(); }catch(e){}
  G.dirty=true; rebuildWorld();
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  document.body.dataset.r = `camera ${P.x.toFixed(0)},${P.y.toFixed(0)},${P.z.toFixed(0)} ` +
    `yaw ${P.yaw.toFixed(2)} pitch ${P.pitch.toFixed(2)} | waterline y ${G.seaY} beach y ${G.rock0} ` +
    `| world ${G.nx}x${G.ny}x${G.nz} cells of ${BLOCK} m | light ${darkNow().toFixed(2)} `+
    `sunY ${_sun?_sun[1].toFixed(2):'?'} | inside stone: ` +
    (solidAtWorld(P.x,P.y,P.z) ? 'YES - THE CAMERA IS BURIED' : 'no');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
