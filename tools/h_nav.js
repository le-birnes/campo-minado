window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=20000; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  const passable=(x,y,z)=> inside(x,y,z) && G.st[idx(x,y,z)]===AIR;
  const supported=(x,y,z)=> y<=0 || !inside(x,y-1,z) || G.st[idx(x,y-1,z)]!==AIR;
  const standable=(x,y,z)=> passable(x,y,z) && supported(x,y,z);

  let allStand=0;
  for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++)
    if(standable(x,y,z)) allStand++;

  // flood exactly as the bot does
  const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
  const seen=new Uint8Array(n), q=[idx(sx,sy,sz)]; seen[q[0]]=1;
  const step=(x,z,fromY)=>{
    if(!inside(x,0,z)) return -1;
    for(let up=2;up>=1;up--){
      if(!standable(x,fromY+up,z)) continue;
      let clear=true;
      for(let k=1;k<up;k++) if(!passable(x,fromY+k,z)){ clear=false; break; }
      if(clear) return idx(x,fromY+up,z);
    }
    for(let y=fromY;y>=0;y--){
      if(!passable(x,y,z)) return -1;
      if(supported(x,y,z)) return idx(x,y,z);
    }
    return -1;
  };
  for(let qi=0;qi<q.length;qi++){
    const i=q[qi], x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const j=step(x+dx,z+dz,y);
      if(j<0||seen[j]) continue;
      seen[j]=1; q.push(j);
    }
  }
  R.push(`standable cells on the board ${allStand}, reachable from spawn ${q.length}`);

  // proven mines, and whether any reachable spot can see one
  const mines=[];
  for(let i=0;i<n;i++){
    if(G.st[i]!==AIR || G.cnt[i]===0) continue;
    let f=0; const h=[];
    for(const j of nbrsOf(i)){ if(G.st[j]===MARKED) f++; else if(G.st[j]===SOLID) h.push(j); }
    if(h.length && G.cnt[i]-f===h.length) for(const j of h) if(mines.indexOf(j)<0) mines.push(j);
  }
  R.push(`proven mines right now: ${mines.length}`);
  if(mines.length){
    const t=mines[0], tc=cellXYZ(t);
    let best=1e9, bestHit='none', nVis=0;
    for(const g of q){
      const [gx,gy,gz]=cellXYZ(g);
      const ex=(gx+0.5)*BLOCK, ey=gy*BLOCK+EYE, ez=(gz+0.5)*BLOCK;
      const ax=(tc[0]+0.5)*BLOCK, ay=(tc[1]+0.5)*BLOCK, az=(tc[2]+0.5)*BLOCK;
      const vx=ax-ex, vy=ay-ey, vz=az-ez, d=Math.hypot(vx,vy,vz)||1;
      best=Math.min(best,d);
      const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, 13*BLOCK, false);
      if(h.hit && h.x===tc[0] && h.y===tc[1] && h.z===tc[2]) nVis++;
      else if(d===best) bestHit = h.hit ? (h.kind+' at '+h.t.toFixed(1)+' of '+d.toFixed(1)) : 'miss';
    }
    R.push(`target ${t} at ${tc.join(',')}: nearest reachable stand ${best.toFixed(1)} m away, `+
           `${nVis} of ${q.length} reachable spots can see it; from the nearest the ray hits ${bestHit}`);
    // where is it relative to the mass?
    let air=0, solid=0, rock=0;
    for(const j of nbrsOf(t)){ const st=G.st[j]; if(st===AIR) air++; else if(st===ROCK) rock++; else solid++; }
    R.push(`that block has ${air} air neighbours, ${solid} solid, ${rock} structure`);
  }
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 600);
