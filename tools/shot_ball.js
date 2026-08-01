setTimeout(()=>{ try{
  G.mode=MODE_SWEEP; G.diff=0; startGame(); G.state='play';
  seed=321; genWorld(0); G.state='play';
  /* An emptied arena: the point is to look at the model, not to survive the
     dungeon's geometry. Placing the camera by hand in a minefield put it
     inside solid rock twice. */
  const cx=(G.nx>>1), cy=1, cz=(G.nz>>1);
  for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i=idx(x,y,z);
    if(y>=1 && G.st[i]!==ROCK){ G.st[i]=AIR; G.mine[i]=0; }
  }
  G.cnt.fill(0); G.arrows=false;   // no glyphs; this is a model shot
  const q=new URLSearchParams(location.search);
  const want=q.get('v')||'ball';

  if(want==='husk'){
    // a hatched socket: block gone, flag still in it
    const hc=idx(cx,cy,cz);
    G.st[hc]=SOLID; G.mine[hc]=1;
    G.st[hc]=MARKED; G.marked++;
    G.hatch[hc]=1;
    G.dirty=true;
    P.x=(cx+0.5)*BLOCK; P.z=(cz+0.5)*BLOCK+BLOCK*3.0; P.y=(cy+0.5)*BLOCK-EYE;
  } else {
    G.boss=true;
    const solid=idx(cx,0,cz);
    G.st[solid]=SOLID;
    const e=spawnEnemy(FAM_MINE, want==='big'?2:0, solid);
    if(!e){ document.title='no spawn'; return; }
    e.state='alive'; e.emerge=1;
    e.x=(cx+0.5)*BLOCK; e.y=(cy+0.6)*BLOCK; e.z=(cz+0.5)*BLOCK;
    e.fx=0; e.fy=0; e.fz=1; e.ux=0; e.uy=1; e.uz=0;
    if(want==='big'){ e.mScale=1.45; }
    P.x=(cx+0.5)*BLOCK; P.z=(cz+0.5)*BLOCK+BLOCK*1.5; P.y=(cy+0.6)*BLOCK-EYE;
  }
  P.vx=P.vy=P.vz=0; P.yaw=0; P.pitch=0;
  G.dirty=true;
  document.title='ok '+want;
}catch(e){ document.title='THROW '+e.message; } }, 700);
