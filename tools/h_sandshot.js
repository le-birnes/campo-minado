/* Pour sand on the left and water on the right, from identical spouts, and
   photograph both. The numbers say one makes a cone and the other a flat
   sheet; a picture says whether that is what it looks like — and whether the
   cone is ROUND, which is the whole point of the 26-neighbourhood and the one
   thing no counter in h_sand.js can show you. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
    /* ARCANE, not Apprentice, and the reason is the CEILING. Apprentice is three
     blocks tall — 8.4 m — so an eye 6 m above a heap on the floor is inside the
     bedrock shell looking at the inside of a rock, which is exactly what the
     first overhead shot photographed. */
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  const cx=(G.nx/2)|0, cz=(G.nz/2)|0;
  /* Clear a room to pour into. Digging goes through sandDig, so the grid finds
     out about it the same way it would in play. */
  for(let y=1;y<G.ny;y++) for(let z=cz-6;z<=cz+6;z++) for(let x=cx-8;x<=cx+8;x++){
    if(!inside(x,y,z)) continue;
    const i=idx(x,y,z);
    if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; sandDig(x,y,z); }
  }
  const w=SAND;
  /* ?slat=4 pours the same heap on the old face-only set, so the two pictures
     differ in exactly one thing. */
  SAND_LAT = (location.search.match(/slat=(\d+)/)||[])[1]==='4' ? 4 : 8;
  /* Apprentice is THREE blocks tall, so a spout at "3.2 blocks up" is outside
     the world and put() silently drops every bead - which is exactly what the
     first run of this did, and the picture was of the empty corner of the board
     because the centroid of nothing is the origin. */
  const dropY = w.H - 4;
  const sxw = Math.floor((cx-3.5)*SAND_DIV), wxw = Math.floor((cx+3.5)*SAND_DIV);
  const zw  = Math.floor((cz+0.5)*SAND_DIV);
  /* Straight into the grid rather than through the air: a spout, not a shot.
     THE SPOUT IS 2x2 AND THE LOOP IS SHORT, and that is not a detail. A tick is
     what costs, not a bead: pouring 2,600 one at a time is 2,600 blocking ticks
     and with rendering on the main thread never yields, virtual time never
     advances, and the whole run reads as an endless loop. Four beads a tick
     gets the same heap in a quarter of the wall clock. */
  for(let k=0;k<700;k++){
    for(let a=0;a<2;a++) for(let b=0;b<2;b++){
      if(w.at(sxw+a,dropY,zw+b)===S_AIR) w.put(sxw+a,dropY,zw+b, S_SAND);
      if(w.at(wxw+a,dropY,zw+b)===S_AIR) w.put(wxw+a,dropY,zw+b, S_WATER);
    }
    sandTick(w,-1);
  }
  for(let k=0;k<1200 && w.awake.length;k++) sandTick(w,-1);

  /* AIM AT THE MATERIAL, not past it. The first version of this stood 21 m
     back with a shallow pitch and photographed the dark beyond the room: the
     heaps are under two metres tall and they sit ON THE FLOOR, so the eye has
     to be low and close and looking down. Their own centroid is the only thing
     that knows where they ended up. */
  /* ?sview=top looks STRAIGHT DOWN on the sand alone, which is the only view
     that can show whether the heap is round — a heap photographed from the side
     is a triangle whichever lattice made it. ?sview=side puts both in one frame
     so the cone and the sheet can be compared. */
  const VIEW = (location.search.match(/sview=(\w+)/)||[])[1] || 'top';
  const only = VIEW==='top' ? S_SAND : 0;
  let gx=0,gy=0,gz=0,n=0;
  for(let y=0;y<w.H;y++) for(let z=0;z<w.D;z++) for(let x=0;x<w.W;x++){
    const m=w.at(x,y,z);
    if(only ? m!==only : (m!==S_SAND && m!==S_WATER && m!==S_WETSND)) continue;
    gx+=x; gy+=y; gz+=z; n++;
  }
  if(n){ gx=(gx/n+0.5)*CELL_M; gy=(gy/n+0.5)*CELL_M; gz=(gz/n+0.5)*CELL_M; }
  /* and the eye stays under the ceiling whatever the heap is doing */
  const CEIL = G.ny*BLOCK - 0.7;
  if(VIEW==='top'){
    P.x=gx; P.y=Math.min(gy+3.4, CEIL); P.z=gz+0.01;
    P.yaw=0; P.pitch=-Math.PI/2 + 0.03;
  } else {
    P.x=gx; P.y=Math.min(gy+5.0, CEIL); P.z=gz+15.0;
    const vx=gx-P.x, vy=gy-P.y, vz=gz-P.z;
    P.yaw=Math.atan2(-vx,-vz); P.pitch=Math.atan2(vy, Math.hypot(vx,vz));
  }
  G.dirty=true; rebuildWorld();
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  document.body.dataset.r = `cells ${n} drawn ${sandDraw()} awake ${w.awake.length}`;
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
