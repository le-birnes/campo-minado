/* Do the ground creatures actually stand on something and move their legs, or
   is it still a slab in the air? Drive real frames of enemy update and watch
   one of each kind. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play'; G.boss=true;
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  // limb tagging
  {
    const V=hellVoxels(HELL[15]);
    const t={0:0,1:0,2:0,3:0};
    for(const v of V.vox) t[v.part]++;
    R.push(`Cyberdemon limbs: body ${t[0]}, head ${t[1]}, arms ${t[2]}, legs ${t[3]} `+
           `(all four must be non-zero or it cannot animate)`);
  }
  for(const who of [15, 3, 14]){          // Cyberdemon(walk), Lost Soul(float), Spider(legs)
    const h=HELL[who];
    let cell=-1;
    for(let i=0;i<n;i++){
      if(G.st[i]!==SOLID) continue;
      const c=cellXYZ(i);
      for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        const X=c[0]+g[0],Y=c[1]+g[1],Z=c[2]+g[2];
        if(inside(X,Y,Z) && G.st[idx(X,Y,Z)]===AIR){ cell=i; break; }
      }
      if(cell>=0) break;
    }
    enemies.length=0;
    const e=spawnEnemy(FAM_HELL,2,cell);
    if(!e){ R.push(h.name+': could not spawn'); continue; }
    e.hell=h; e.mScale=h.s*1.7; e.state='alive'; e.emerge=1;
    e.dhp=e.dmax=h.hp; e.hp=9999; e.mFirst=1e9; e.mRate=1e9;
    e.y = e.y + 6;                        // drop it in
    const y0=e.y;
    let grounded=0, gaitMoved=0;
    const g0=e.gait||0;
    for(let f=0;f<240;f++){
      updateEnemies(1/60);
      if(e.onGround) grounded++;
    }
    gaitMoved = (e.gait||0)-g0;
    R.push(`${h.name} (${h.sil===SIL_FLOAT?'flier':h.sil===SIL_LEGS?'spider':'walker'}): `+
           `y ${y0.toFixed(1)} -> ${e.y.toFixed(1)}, on the ground ${grounded}/240 frames, `+
           `gait advanced ${gaitMoved.toFixed(2)}`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 12000);
