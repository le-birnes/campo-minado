/* Stand the player in front of the finale and photograph it. Twice: once with
   the roster's smallest thing and once with its biggest, because the size of
   the quad is the part most likely to be wrong. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const WHICH = (location.search.match(/who=(\d+)/)||[0,'15'])[1]|0;
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  const e=enemies.find(x=>x.hell);
  if(!e){ document.body.dataset.r='no boss'; return; }
  /* force the creature we asked for, and rebuild its scale to match */
  e.hell = HELL[WHICH]; e.dhp=e.dmax=e.hell.hp; e.mScale=e.hell.s*1.7;
  e.state='alive'; e.emerge=1;
  /* Muzzle it. The first photograph was of the death screen: a Cyberdemon
     needs 1.6 s to line up and the shot had six seconds of game time. */
  /* Muzzling its timers was not enough — it re-acquires and the photograph
     came back as the death screen twice. Take the damage out instead. */
  e.aim=false; e.first=true; e.mFirst=1e9; e.mRate=1e9;
  try{ hurtPlayer = function(){}; }catch(err){}
  /* clear a room around it so the sprite is not buried, then stand back */
  const ex=Math.floor(e.x/BLOCK), ey=Math.floor(e.y/BLOCK), ez=Math.floor(e.z/BLOCK);
  /* Carve the room, but LEAVE A FLOOR. Hollowing out the cells below as well
     meant the player fell into the void for the whole exposure and the
     photograph came back black. */
  for(let y=ey;y<=ey+5;y++) for(let z=ez-8;z<=ez+8;z++) for(let x=ex-6;x<=ex+6;x++)
    if(inside(x,y,z)) G.st[idx(x,y,z)]=AIR;
  for(let z=ez-8;z<=ez+8;z++) for(let x=ex-6;x<=ex+6;x++)
    if(inside(x,ey-1,z)) G.st[idx(x,ey-1,z)]=ROCK;
  G.dirty=true;
  /* Setting G.state does not touch the DOM, so the menu panel stays painted
     over the canvas and the photograph comes back as the title screen. */
  try{ setScreen('play'); }catch(err){}
  P.x=e.x; P.y=ey*BLOCK; P.z=e.z+16; P.vx=P.vy=P.vz=0; P.ground=true;
  P.yaw=Math.PI; P.pitch=0.06;                     // -sin(yaw)=0, -cos(yaw)=+1: down +Z
  P.yaw=0; P.pitch=0.06;
  /* aimRay: dz = -cos(yaw). Standing at +Z of the target we must look at -Z,
     so cos(yaw)=1, yaw=0. */
  /* Report AFTER frames have run. sprB.count read in the same tick as the
     setup is always 0 — nothing has drawn yet — which says nothing about
     whether the sprite reaches the screen. */
  window.__boss = e;
  setTimeout(()=>{
    const cam=[P.x,P.y+EYE,P.z];
    const v=[e.x-cam[0], e.y-cam[1], e.z-cam[2]];
    const d=Math.hypot(v[0],v[1],v[2]);
    const fwd=[-Math.sin(P.yaw)*Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw)*Math.cos(P.pitch)];
    const dot=(v[0]*fwd[0]+v[1]*fwd[1]+v[2]*fwd[2])/(d||1);
    document.body.dataset.r =
      e.hell.name+' state='+e.state+' hp='+e.dhp+' scale='+e.mScale.toFixed(2)+
      ' tile='+e.hell.tile+
      ' | at '+e.x.toFixed(1)+','+e.y.toFixed(1)+','+e.z.toFixed(1)+
      ' cam '+cam.map(q=>q.toFixed(1)).join(',')+
      ' | dist '+d.toFixed(1)+' infront '+dot.toFixed(2)+
      ' | sprB '+sprB.count+'/'+sprB.max+' glyphB '+glyphB.count+
      ' worldB '+worldB.count+' enemies '+enemies.length+
      ' | state '+G.state+' lava '+G.lava+' boom '+G.boom;
  }, 2500);
}catch(err){ document.body.dataset.r='THROW '+err.message; } }, 500);
