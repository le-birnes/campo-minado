/* Photograph a finale creature from three angles, so "it is always facing me"
   can be answered by looking rather than by argument. Goes through startGame()
   and lets the game drive, because a hand-built scene freezes the frame loop. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const q=location.search;
  const WHO=(q.match(/who=(\d+)/)||[0,'12'])[1]|0;
  const ANG=parseFloat((q.match(/ang=([-\d.]+)/)||[0,'0'])[1]);
  G.mode=MODE_DUNGEON; G.diff=0;
  startGame();
  seed=606; genWorld(0); G.state='play'; try{ setScreen('play'); }catch(e){}
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  try{ hurtPlayer=function(){}; }catch(e){}
  const e=enemies.find(x=>x.hell);
  if(!e){ document.title='no boss'; return; }
  e.hell=HELL[WHO]; e.dhp=e.dmax=e.hell.hp; e.mScale=e.hell.s*1.7;
  e.state='alive'; e.emerge=1; e.aim=false; e.mFirst=1e9; e.mRate=1e9;
  const ex=Math.floor(e.x/BLOCK), ey=Math.floor(e.y/BLOCK), ez=Math.floor(e.z/BLOCK);
  for(let y=ey;y<=ey+5;y++) for(let z=ez-7;z<=ez+7;z++) for(let x=ex-7;x<=ex+7;x++)
    if(inside(x,y,z)) G.st[idx(x,y,z)]=AIR;
  for(let z=ez-7;z<=ez+7;z++) for(let x=ex-7;x<=ex+7;x++)
    if(inside(x,ey-1,z)) G.st[idx(x,ey-1,z)]=ROCK;
  G.dirty=true;
  /* orbit to ANG so the same creature can be photographed from the front and
     from the side; the point of the exercise is whether it has a side */
  const r=11, a=ANG*Math.PI/180;
  P.x=e.x+Math.sin(a)*r; P.z=e.z+Math.cos(a)*r; P.y=ey*BLOCK;
  P.vx=P.vy=P.vz=0; P.ground=true;
  P.yaw=Math.atan2(-(e.x-P.x), -(e.z-P.z)); P.pitch=0.02;
  const box=document.createElement('pre');
  box.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;color:#0f0;'+
    'background:rgba(0,0,0,.7);font:12px monospace;padding:5px;margin:0';
  document.body.appendChild(box);
  setInterval(()=>{ box.textContent =
    e.hell.name+'  angle '+ANG+'°  voxels '+hellB.count+'  t '+tGlobal.toFixed(1); }, 50);
}catch(err){ document.title='THROW '+err.message; } }, 400);
