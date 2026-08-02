/* Does a finale shot actually fire? The weapon was swinging and nothing else
   was happening, which is what a throw right after recoil looks like. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  const boss=enemies.find(e=>e.hell);
  R.push('finale='+G.finale+' boss='+(boss?boss.hell.name:'NONE'));
  if(boss){
    try{ hurtPlayer=function(){}; }catch(e){}
    P.x=boss.x; P.y=boss.y-EYE; P.z=boss.z+9; P.vx=P.vy=P.vz=0;
    const dd=[boss.x-P.x, boss.y-(P.y+EYE), boss.z-P.z];
    P.yaw=Math.atan2(-dd[0],-dd[2]); P.pitch=Math.atan2(dd[1],Math.hypot(dd[0],dd[2]));
    const hp0=boss.dhp, vx0=P.vx, sp0=sprites.length;
    let threw='no';
    try{ shoot(); }catch(err){ threw=err.message; }
    R.push('one shot: threw='+threw+' | boss hp '+hp0+' -> '+boss.dhp+
           ' | player vx '+vx0.toFixed(2)+' -> '+P.vx.toFixed(2)+
           ' | beam sprites +'+(sprites.length-sp0));
  }
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message; } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 8000);
