/* The death: does the body swell and then burst, and does it clean up? No
   frame loop needed — updateCorpses takes dt directly. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play'; G.boss=true;
  const n=G.nx*G.ny*G.nz;
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
  corpses.length=0; enemies.length=0;
  const e=spawnEnemy(0,0,cell);
  R.push(`spawned ${e?'ok':'FAILED'} | enemies ${enemies.length} corpses ${corpses.length}`);
  const p0=particles.length;
  killEnemy(e, enemies.indexOf(e));
  R.push(`killed: enemies ${enemies.length} (want 0), corpses ${corpses.length} (want 1), `+
         `burst particles so far ${particles.length-p0} (want 0 — it swells first)`);
  const sizes=[];
  for(let k=0;k<3;k++){
    updateCorpses(POP_S/4);
    const c=corpses[0];
    sizes.push(c ? (1+0.22*(c.t/POP_S)).toFixed(2) : 'gone');
  }
  R.push(`ordinary death swells: x${sizes.join(' -> x')} (a nudge, not a balloon)`);
  const p1=particles.length; G.shake=0;
  updateCorpses(POP_S);
  R.push(`ordinary death clears in ${POP_S}s: corpses ${corpses.length} (want 0), `+
         `${particles.length-p1} pieces, shake ${G.shake.toFixed(2)} (want 0 — no shove)`);
  // and the finale, which should still be the big one
  G.shake=0;
  corpses.push({x:1,y:1,z:1,t:0,hell:HELL[15],et:0,fx:0,fy:0,fz:1,ux:0,uy:1,uz:0,
                mScale:2,col:HELL[15].col});
  const p2=particles.length;
  updateCorpses(POP_S+0.001);
  R.push(`finale after an ORDINARY death's worth of time: corpses ${corpses.length} `+
         `(want 1 — it takes longer on purpose)`);
  updateCorpses(POP_T);
  R.push(`finale after its own: corpses ${corpses.length} (want 0), `+
         `${particles.length-p2} pieces, shake ${G.shake.toFixed(2)} (want a shove)`);
  // and a finale creature, which uses the other draw path
  corpses.push({x:1,y:1,z:1,t:0,hell:HELL[15],et:0,fx:0,fy:0,fz:1,ux:0,uy:1,uz:0,
                mScale:2,col:HELL[15].col});
  updateCorpses(POP_T+0.01);
  R.push(`a finale corpse also clears: corpses ${corpses.length} (want 0)`);
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 600);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 4000);
