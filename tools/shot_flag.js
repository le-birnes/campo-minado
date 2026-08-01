setTimeout(()=>{ try{
  G.mode=MODE_SWEEP; G.diff=0; startGame(); G.state='play';
  seed=321; genWorld(0); G.state='play';
  G.cnt.fill(0); G.arrows=false;
  const cx=(G.nx>>1), cy=1, cz=(G.nz>>1);
  for(let y=1;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i=idx(x,y,z); if(G.st[i]!==ROCK){ G.st[i]=AIR; G.mine[i]=0; }
  }
  // one block standing alone, flagged
  const b=idx(cx,cy,cz);
  G.st[b]=MARKED; G.marked++;
  G.dirty=true;
  const a=parseFloat(new URLSearchParams(location.search).get('a')||'0');
  const bx=(cx+0.5)*BLOCK, by=(cy+0.5)*BLOCK, bz=(cz+0.5)*BLOCK;
  const r=9;
  P.x=bx+Math.sin(a)*r; P.z=bz+Math.cos(a)*r; P.y=by-EYE+1.0;
  P.vx=P.vy=P.vz=0;
  const dx=bx-P.x, dy=by-(P.y+EYE), dz=bz-P.z;
  P.yaw=Math.atan2(-dx,-dz); P.pitch=Math.atan2(dy,Math.hypot(dx,dz));
  document.title='ok';
}catch(e){ document.title='THROW '+e.message; } }, 700);
