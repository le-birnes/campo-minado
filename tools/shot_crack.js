setTimeout(()=>{ try{
  G.diff=0; startGame(); G.state='play';
  seed=321; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  // clear the top layer so one block stands alone with open faces
  const cx=(G.nx>>1), cz=(G.nz>>1), cy=1;
  for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++)
    for(let y=1;y<G.ny;y++){
      const i=idx(x,y,z);
      if(G.st[i]!==ROCK){ G.st[i]=AIR; }
    }
  // stand one block back up and crack it
  const bi=idx(cx,cy,cz);
  G.st[bi]=SOLID; G.mine[bi]=0; G.crack[bi]=1;
  G.dirty=true;

  const q=new URLSearchParams(location.search);
  const ang=parseFloat(q.get('a')||'0');
  const bx=(cx+0.5)*BLOCK, by=(cy+0.5)*BLOCK, bz=(cz+0.5)*BLOCK;
  const r=9;
  P.x=bx+Math.sin(ang)*r; P.z=bz+Math.cos(ang)*r; P.y=by-EYE+1.2;
  P.vx=P.vy=P.vz=0;
  const dx=bx-P.x, dy=by-(P.y+EYE), dz=bz-P.z;
  P.yaw=Math.atan2(-dx,-dz); P.pitch=Math.atan2(dy,Math.hypot(dx,dz));
  document.title='ok';
}catch(e){ document.title='THROW '+e.message; } }, 700);
