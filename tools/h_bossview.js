/* Photograph the finale AND its numbers together. Reading sprB from a
   --dump-dom run measured nothing: rAF does not tick there, so tGlobal sat at
   0.05 and every counter was the value it had before the first frame. Put the
   readout in the DOM and take a picture of both. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const WHICH=(location.search.match(/who=(\d+)/)||[0,'15'])[1]|0;
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play';
  try{ setScreen('play'); }catch(e){}
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  try{ hurtPlayer=function(){}; }catch(e){}
  const e=enemies.find(x=>x.hell);
  if(!e){ document.title='no boss'; return; }
  e.hell=HELL[WHICH]; e.dhp=e.dmax=e.hell.hp; e.mScale=e.hell.s*1.7;
  e.state='alive'; e.emerge=1; e.aim=false; e.mFirst=1e9; e.mRate=1e9;
  const ex=Math.floor(e.x/BLOCK), ey=Math.floor(e.y/BLOCK), ez=Math.floor(e.z/BLOCK);
  for(let y=ey;y<=ey+5;y++) for(let z=ez-8;z<=ez+8;z++) for(let x=ex-6;x<=ex+6;x++)
    if(inside(x,y,z)) G.st[idx(x,y,z)]=AIR;
  for(let z=ez-8;z<=ez+8;z++) for(let x=ex-6;x<=ex+6;x++)
    if(inside(x,ey-1,z)) G.st[idx(x,ey-1,z)]=ROCK;
  G.dirty=true;
  P.x=e.x; P.y=ey*BLOCK; P.z=e.z+14; P.vx=P.vy=P.vz=0; P.ground=true;
  P.yaw=0; P.pitch=0.05;
  const box=document.createElement('pre');
  box.style.cssText='position:fixed;left:6px;bottom:6px;z-index:99999;color:#0f0;'+
    'background:rgba(0,0,0,.75);font:12px monospace;padding:6px;margin:0';
  document.body.appendChild(box);
  setInterval(()=>{
    box.textContent =
      e.hell.name+'  tile '+e.hell.tile+'  scale '+e.mScale.toFixed(2)+'\n'+
      'tGlobal '+tGlobal.toFixed(2)+'  state '+G.state+'  lava '+G.lava+'\n'+
      'sprB '+sprB.count+'/'+sprB.max+'  worldB '+worldB.count+'  glyph '+glyphB.count+'\n'+
      'boss '+e.x.toFixed(1)+','+e.y.toFixed(1)+','+e.z.toFixed(1)+'  cam '+
      P.x.toFixed(1)+','+P.y.toFixed(1)+','+P.z.toFixed(1);
  }, 60);
}catch(err){ document.title='THROW '+err.message; } }, 400);
