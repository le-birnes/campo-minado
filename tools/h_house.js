/* Photograph the house on the island. Numbers say 145 wooden blocks and 18
   vials; only a picture says whether it reads as a house. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
    /* THE DUNGEON'S WORLD, because that is the one the island is ever built in.
     Apprentice is three blocks tall and set() drops anything outside the grid
     without a word, so a six-block house on it is a floor and some litter. */
  G.mode=MODE_DUNGEON; seed=5; genWorld(0, true); G.state='play';
  G.noWin=true; G.island=false; G.gravK=1;
  buildIsland();
  const V=(location.search.match(/hv=(\w+)/)||[])[1] || 'out';
  const v0=VIALS[0]||{x:G.nx/2,y:2,z:G.nz/2};
  let hx=0,hy=0,hz=0,n=0;
  for(const v of VIALS){ hx+=v.x; hy+=v.y; hz+=v.z; n++; }
  if(n){ hx/=n; hy/=n; hz/=n; }
  const cx=(hx+0.5)*BLOCK, cy=(hy+0.5)*BLOCK, cz=(hz+0.5)*BLOCK;
  if(V==='in'){ P.x=cx; P.y=cy-EYE+0.3; P.z=cz+BLOCK*2.2; }
  else        { P.x=cx-BLOCK*4.0; P.y=cy-EYE+BLOCK*2.2; P.z=cz+BLOCK*11.0; }
  const tx=cx, ty=cy, tz=cz;
  const dx=tx-P.x, dy=ty-(P.y+EYE), dz=tz-P.z;
  P.yaw=Math.atan2(-dx,-dz); P.pitch=Math.atan2(dy, Math.hypot(dx,dz));
  G.dirty=true; rebuildWorld(); sandDraw();
  try{ document.getElementById('menu').classList.remove('on'); }catch(e){}
  try{ const nl=document.getElementById('needlock'); if(nl) nl.style.display='none'; }catch(e){}
  document.body.dataset.r='vials '+VIALS.length+' at '+hx.toFixed(1)+','+hy.toFixed(1)+','+hz.toFixed(1);
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 400);
