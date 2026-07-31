window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const N=()=>G.nx*G.ny*G.nz;
  G.mode = MODE_DUNGEON;

  const B=60;
  let mn=999, mx=0, sealed=0, spawnBad=0, floorBad=0, inRock=0, inAir=0, cubes=0;
  let strollable=0, visible=0, tested=0;

  for(let k=0;k<B;k++){
    seed=20000+k*7919; genWorld(0);
    const n=N();
    mn=Math.min(mn,G.mines); mx=Math.max(mx,G.mines);
    for(let i=0;i<n;i++){
      if(!G.mine[i]) continue;
      if(G.st[i]===ROCK) inRock++;
      else if(G.st[i]===AIR) inAir++;
    }
    const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
    if(G.st[idx(sx,sy,sz)]!==AIR) spawnBad++;
    if(sy>0 && G.st[idx(sx,sy-1,sz)]===AIR) floorBad++;

    // every mine has to be diggable-to, or the run cannot be finished
    const dig=new Uint8Array(n), st=[idx(sx,sy,sz)]; dig[st[0]]=1;
    while(st.length){
      const i=st.pop();
      const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
      for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){
        const X=x+dx,Y=y+dy,Z=z+dz;
        if(!inside(X,Y,Z)) continue;
        const j=idx(X,Y,Z);
        if(dig[j] || G.st[j]===ROCK) continue;
        dig[j]=1; st.push(j);
      }
    }
    let bad=0;
    for(let i=0;i<n;i++) if(G.mine[i] && !dig[i]) bad++;
    if(bad) sealed++;

    // linearity: can you walk to the first shaft without opening anything,
    // and can you even SEE it from where you start?
    if(G.shafts && G.shafts.length){
      tested++;
      const air=new Uint8Array(n), q=[idx(sx,sy,sz)]; air[q[0]]=1;
      const D6=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
      while(q.length){
        const i=q.pop();
        const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
        for(const [dx,dy,dz] of D6){
          const X=x+dx,Y=y+dy,Z=z+dz;
          if(!inside(X,Y,Z)) continue;
          const j=idx(X,Y,Z);
          if(air[j] || G.st[j]!==AIR) continue;
          air[j]=1; q.push(j);
        }
      }
      const [fx,fz,yTop]=G.shafts[0];
      if(inside(fx,yTop,fz) && air[idx(fx,yTop,fz)]) strollable++;
      const ex=P.x, ey=P.y+EYE, ez=P.z;
      const ax=(fx+0.5)*BLOCK, ay=(yTop+0.5)*BLOCK, az=(fz+0.5)*BLOCK;
      const vx=ax-ex, vy=ay-ey, vz=az-ez, dd=Math.hypot(vx,vy,vz)||1;
      const h=raycast(ex,ey,ez, vx/dd,vy/dd,vz/dd, dd+1, false);
      if(!h.hit || h.t > dd-BLOCK) visible++;
    }
    rebuildWorld(); cubes=Math.max(cubes,worldB.count);
  }
  R.push(`${B} dungeons: mines ${mn}-${mx} | walled-off ${sealed} | spawn in rock ${spawnBad} | `+
         `spawn over a hole ${floorBad} | mine in rock ${inRock} | mine in air ${inAir} | `+
         `worst cubes ${cubes}/${worldB.max}`);
  R.push(`linearity: the first shaft is walkable-to without digging on ${strollable}/${tested}, `+
         `and visible from the spawn on ${visible}/${tested}`);

  // and the plain puzzle is still a plain puzzle
  G.mode = MODE_SWEEP;
  for(const d of [0,1,2]){
    seed=77; genWorld(d);
    R.push(`${DIFFS[d].name}: ${G.nx}x${G.ny}x${G.nz}, ${G.mines} mines, `+
           `safeTotal ${G.safeTotal}, enemies enabled=${G.boss} (want false), dungeon=${G.dungeon}`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 18000);
