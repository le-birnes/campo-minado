window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const N=()=>G.nx*G.ny*G.nz;

  /* ---- 1. the linear dungeon still holds together ---- */
  {
    const B=80;
    let mines=[], sealed=0, spawnBad=0, floorBad=0, inRock=0, inAir=0, cubes=0;
    let shaftBehind=0, shaftTot=0;
    for(let k=0;k<B;k++){
      seed=20000+k*7919; genWorld(BOSS);
      const n=N();
      for(let i=0;i<n;i++){
        if(G.mine[i] && G.st[i]===ROCK) inRock++;
        if(G.mine[i] && G.st[i]===AIR)  inAir++;
      }
      mines.push(G.mines);
      const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
      if(G.st[idx(sx,sy,sz)]!==AIR) spawnBad++;
      if(sy>0 && G.st[idx(sx,sy-1,sz)]===AIR) floorBad++;
      // every mine still diggable-to from the spawn
      const seen=new Uint8Array(n), st=[idx(sx,sy,sz)]; seen[st[0]]=1;
      while(st.length){
        const i=st.pop();
        const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
        for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){
          const X=x+dx,Y=y+dy,Z=z+dz;
          if(!inside(X,Y,Z)) continue;
          const j=idx(X,Y,Z);
          if(seen[j]||G.st[j]===ROCK) continue;
          seen[j]=1; st.push(j);
        }
      }
      let bad=0;
      for(let i=0;i<n;i++) if(G.mine[i] && !seen[i]) bad++;
      if(bad) sealed++;
      rebuildWorld(); cubes=Math.max(cubes,worldB.count);
    }
    mines.sort((a,b)=>a-b);
    R.push(`${B} linear dungeons: mines ${mines[0]}-${mines[B-1]} | walled-off ${sealed} | `+
           `spawn in rock ${spawnBad} | spawn over a hole ${floorBad} | mine in rock ${inRock} | `+
           `mine in air ${inAir} | worst cubes ${cubes}/${worldB.max}`);
  }

  /* ---- 2. is the way down actually behind the field? ----
     Walk from the spawn through open air only, and see whether the top of the
     first shaft is reachable WITHOUT digging. If it is, the level is not
     linear: you could stroll past the minefield to the next floor. */
  {
    const B=40; let strollable=0, tested=0, visible=0;
    for(let k=0;k<B;k++){
      seed=20000+k*7919; genWorld(BOSS);
      if(!G.shafts || !G.shafts.length) continue;
      tested++;
      const n=N();
      const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
      const seen=new Uint8Array(n), st=[idx(sx,sy,sz)]; seen[st[0]]=1;
      const D=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];
      while(st.length){
        const i=st.pop();
        const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
        for(const [dx,dy,dz] of D){
          const X=x+dx,Y=y+dy,Z=z+dz;
          if(!inside(X,Y,Z)) continue;
          const j=idx(X,Y,Z);
          if(seen[j] || G.st[j]!==AIR) continue;   // air only: no digging
          seen[j]=1; st.push(j);
        }
      }
      const [fx,fz,yTop] = G.shafts[0];
      if(inside(fx,yTop,fz) && seen[idx(fx,yTop,fz)]) strollable++;
      /* The literal requirement: standing where you start, can you SEE the way
         down, or is the minefield in front of it? */
      const ex=P.x, ey=P.y+EYE, ez=P.z;
      const ax=(fx+0.5)*BLOCK, ay=(yTop+0.5)*BLOCK, az=(fz+0.5)*BLOCK;
      let vx=ax-ex, vy=ay-ey, vz=az-ez;
      const dd=Math.hypot(vx,vy,vz)||1;
      const h=raycast(ex,ey,ez, vx/dd,vy/dd,vz/dd, dd+1, false);
      if(!h.hit || h.t > dd-BLOCK) visible++;
    }
    R.push(`first shaft: reachable on foot without digging on ${strollable}/${tested} boards, `+
           `and VISIBLE from where you spawn on ${visible}/${tested} (this is the actual ask — `+
           `the way down should be hidden behind the field)`);
  }

  /* ---- 3. the eye ---- */
  {
    seed=40002; genWorld(BOSS); G.state='play'; G.fuse=0; G.boomCell=null;
    const n=N();
    // open something so numbers exist
    for(let k=0;k<25;k++){
      let t=-1;
      for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ t=i; break; }
      if(t<0) break; revealAt(t,true);
    }
    // a number with real hidden SOLID neighbours, unsatisfied
    let num=-1;
    for(let i=0;i<n;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      let hid=0, flags=0;
      for(const j of nbrsOf(i)){ if(G.st[j]===SOLID) hid++; else if(G.st[j]===MARKED) flags++; }
      if(hid>0 && flags!==G.cnt[i]){ num=i; break; }
    }
    const c=cellXYZ(num);
    G.eye=true; G.echoT.fill(0); G.echoUntil=0;
    hitNumber(c[0],c[1],c[2]);
    let red=0, green=0, wrong=0, onRock=0;
    for(let j=0;j<n;j++){
      if(G.echoT[j]<=tGlobal) continue;
      if(G.st[j]===ROCK) onRock++;
      const o=j*3, isRed=G.echoC[o]>0.8 && G.echoC[o+1]<0.4;
      if(isRed){ red++; if(!G.mine[j]) wrong++; } else { green++; if(G.mine[j]) wrong++; }
    }
    R.push(`eye on a real number: ${red} red ${green} green, mislabelled ${wrong}, `+
           `lit on structure ${onRock} (want 0), spent=${!G.eye}`);

    /* the case that was eating it: a number whose only unopened neighbours are
       indestructible wall. It must not fire and must not be spent. */
    let walled=-1;
    for(let i=0;i<n;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      let solid=0, rock=0;
      for(const j of nbrsOf(i)){ if(G.st[j]===SOLID) solid++; else if(G.st[j]===ROCK) rock++; }
      if(solid===0 && rock>0){ walled=i; break; }
    }
    if(walled<0) R.push('no wall-only number on this board to test with');
    else{
      const w=cellXYZ(walled);
      G.eye=true;
      hitNumber(w[0],w[1],w[2]);
      R.push(`eye pointed at a number with only wall around it: still held=${G.eye} (want true)`);
    }
  }

  R.push(`run speed ${SPD_RUN} m/s, sprint ${SPD_SPR} m/s`);
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 30000);
