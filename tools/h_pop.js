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
  for(let k=0;k<4;k++){
    updateCorpses(POP_T/5);
    const c=corpses[0];
    sizes.push(c ? (1+1.25*Math.pow(c.t/POP_T,2)).toFixed(2) : 'gone');
  }
  R.push(`swelling: x${sizes.join(' -> x')} of its own size`);
  const p1=particles.length;
  updateCorpses(POP_T);
  R.push(`after ${POP_T}s: corpses ${corpses.length} (want 0), `+
         `burst threw ${particles.length-p1} particles, shake ${G.shake.toFixed(2)}`);
  // and a finale creature, which uses the other draw path
  corpses.push({x:1,y:1,z:1,t:0,hell:HELL[15],et:0,fx:0,fy:0,fz:1,ux:0,uy:1,uz:0,
                mScale:2,col:HELL[15].col});
  updateCorpses(POP_T+0.01);
  R.push(`a finale corpse also clears: corpses ${corpses.length} (want 0)`);
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message+' @'+((e.stack||'').split('\n')[1]||''); } }, 600);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 4000);
