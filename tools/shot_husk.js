setTimeout(()=>{ try{
  G.mode=MODE_DUNGEON; G.diff=0; startGame(); G.state='play';
  seed=20000; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  // an exposed mine: one with an open face, the only kind you could ever flag
  let m=-1, face=null;
  for(let i=0;i<n && m<0;i++){
    if(!G.mine[i] || G.st[i]!==SOLID) continue;
    const c=cellXYZ(i);
    for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const X=c[0]+g[0],Y=c[1]+g[1],Z=c[2]+g[2];
      if(inside(X,Y,Z) && G.st[idx(X,Y,Z)]===AIR){ m=i; face=g; break; }
    }
  }
  if(m<0){ document.title='no exposed mine'; return; }
  const c=cellXYZ(m);
  G.digAdj[m]=3;
  G.st[m]=MARKED; G.marked++;
  const ok = hatchMine(m, c[0],c[1],c[2]);
  G.dirty=true;
  // stand off and look straight at where the block was
  const bx=(c[0]+0.5)*BLOCK, by=(c[1]+0.5)*BLOCK, bz=(c[2]+0.5)*BLOCK;
  P.x=bx+face[0]*BLOCK*2.4; P.y=by+face[1]*BLOCK*2.4-EYE; P.z=bz+face[2]*BLOCK*2.4;
  P.vx=P.vy=P.vz=0;
  const dx=bx-P.x, dy=by-(P.y+EYE), dz=bz-P.z;
  P.yaw=Math.atan2(-dx,-dz); P.pitch=Math.atan2(dy,Math.hypot(dx,dz));
  // push the enemy aside so it does not hide what we are looking for
  if(enemies.length){ enemies[0].x += 30; enemies[0].y += 30; }
  document.title = 'hatched '+ok+' hatch='+G.hatch[m];
}catch(e){ document.title='THROW '+e.message; } }, 700);
