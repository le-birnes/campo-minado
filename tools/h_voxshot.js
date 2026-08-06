/* Carve a block open and stand the camera in front of it, so something can
   LOOK at the voxel layer. The counters say 1,549 instances; only a picture
   says whether it reads as a hole in a block. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  let tgt=-1, air=-1;
  for(let y=0;y<G.ny&&tgt<0;y++) for(let z=0;z<G.nz&&tgt<0;z++) for(let x=0;x<G.nx&&tgt<0;x++){
    const i=idx(x,y,z);
    if(G.st[i]!==SOLID||G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(G.st[j]===AIR){ tgt=i; air=j; break; }
  }
  const [tx,ty,tz]=cellXYZ(tgt), [ax,ay,az]=cellXYZ(air);
  const dx=Math.sign(tx-ax), dy=Math.sign(ty-ay), dz=Math.sign(tz-az);
  /* the jet goes INTO the face that was hit, which is the no-spread rule */
  voxCarve(tgt, dx>0?0:(dx<0?15:8), dy>0?0:(dy<0?15:8), dz>0?0:(dz<0?15:8),
           dx,dy,dz, 90000);
  rebuildWorld();
  /* stand in the open cell, looking at the block */
  /* Stand back along the open side and aim at the block's CENTRE, pitch and
     all. The first version put the eye in the neighbouring cell and guessed a
     yaw, and the shot came out looking down a corridor with the block off
     frame. Aiming at a point is the version that cannot be off by a sign. */
  /* FAR ENOUGH BACK THAT A PLAIN BLOCK IS IN FRAME FOR SCALE. At 2.2 blocks
     the voxelised block filled the view and the reviewer read its voxels AS
     blocks — "the hole is carved out of multiple full-sized blocks" — which is
     the correct reading of a picture with nothing in it to compare against.
     A test that cannot be judged is a failed test, not a failed feature.

     But 7.0 put the eye INSIDE the surrounding rock, in an unlit cave, and
     returned a black frame. So the framing problem is real and unsolved: the
     shot needs a camera placed in open space with BOTH the voxelised block and
     a plain one lit and in view, and picking that spot is a search rather than
     an arithmetic. 2.6 is the readable compromise and it still gives the
     reviewer no neighbour for scale. Left honest rather than tuned until it
     passes. */
  const cxw=(tx+0.5)*BLOCK, cyw=(ty+0.5)*BLOCK, czw=(tz+0.5)*BLOCK;
  P.x = cxw - (tx-ax)*BLOCK*2.6;
  P.y = cyw - (ty-ay)*BLOCK*2.6 + 0.8;
  P.z = czw - (tz-az)*BLOCK*2.6;
  /* AIM OFF THE BLOCK, NOT AT IT. Centring the carved block filled the frame
     with it, and a reviewer with nothing to compare against read its voxels AS
     blocks — "the hole is carved out of multiple full-sized blocks", which was
     the right reading of that picture. Pulling straight back to 7 blocks put
     the eye inside unlit rock and returned black. So instead: stay at a lit
     distance and aim at the SEAM, one block to the side, so a plain cube and a
     voxelised one are both in shot and the size contrast is visible.

     THAT STILL FAILED, and the third failure is the informative one. The
     reviewer said "a bored hole is visible, but there is no size contrast: the
     entire environment uses a uniform block size" — and it is right, for a
     reason that is about the GAME and not the test. Every block already wears
     a per-block noise texture of small squares, so an intact wall ALREADY
     looks like it is made of little cubes. The voxel layer is therefore
     visually indistinguishable from the surface it is carved out of.

     That is a real finding and it is not a framing bug: no camera position
     fixes it. What fixes it is giving voxels their own read — per-voxel
     shading, an ambient-occlusion darkening inside the cavity, or simply
     letting the exposed interior take the material colours (sand pale, rock
     dark, water blue) which the data already carries and the renderer is
     currently flattening. Left here rather than papered over. */
  const sx = Math.abs(tx-ax)<0.5 ? 1 : 0, sz = sx ? 0 : 1;
  const axw = cxw + sx*BLOCK*1.1, azw = czw + sz*BLOCK*1.1;
  const vx=axw-P.x, vy=cyw-P.y, vz=azw-P.z;
  P.yaw   = Math.atan2(-vx, -vz);
  P.pitch = Math.atan2(vy, Math.hypot(vx,vz));
  G.dirty=true;
  /* The menu is a full-screen div with class "on" and it sits over everything.
     genWorld does not take it down because normally startGame does, so a
     screenshot harness has to. needlock is always up headless, same reason. */
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  for(const id of ['over','pause']){
    try{ const el=document.getElementById(id); if(el) el.classList.remove('on'); }catch(e){}
  }
  document.body.dataset.r='carved, instances '+worldB.count;
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
