window.__errs=[];
window.addEventListener('error',e=>{ if(window.__errs.length<5) window.__errs.push(e.message+' @'+e.lineno); });
/* What does the finale actually look like over time? The boss photographs kept
   coming back black; find out whether that is a blackout, a dead world, or a
   sprite that never draws. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play';
  try{ setScreen('play'); }catch(e){}
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  window.__log=[`gen: ${G.nx}x${G.ny}x${G.nz} state=${G.state}`];
  checkWin();
  window.__log.push(`after checkWin: state=${G.state} enemies=${enemies.length} lava=${G.lava}`);
  try{ hurtPlayer=function(){}; }catch(e){}
  const e=enemies.find(x=>x.hell);
  if(e){ e.mFirst=1e9; e.mRate=1e9; }
  for(const t of [300, 900, 1800, 3000, 5000]){
    setTimeout(()=>{
      const b=enemies.find(x=>x.hell);
      window.__log.push(`t+${t}: state=${G.state} lava=${G.lava.toFixed?G.lava.toFixed(2):G.lava} `+
        `world=${G.nx}x${G.ny}x${G.nz} worldB=${worldB.count} sprB=${sprB.count} `+
        `foes=${enemies.length} tGlobal=${tGlobal.toFixed(2)}`+(b?` boss=${b.state} hp=${b.dhp} y=${b.y.toFixed(1)}`:' boss=gone')+
        ` camY=${P.y.toFixed(1)}`);
    }, t);
  }
}catch(err){ window.__log=['THROW '+err.message]; } }, 400);
setTimeout(()=>{ document.body.dataset.r=(window.__log||['none']).join(' | ')+' || ERRORS: '+(window.__errs.length?window.__errs.join(' ;; '):'none'); }, 6000);
