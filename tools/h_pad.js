window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  /* A fake Xbox pad in the standard mapping, driven straight at pollPad. */
  const pad = {connected:true, mapping:'standard',
               axes:[0,0,0,0], buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  navigator.getGamepads = () => [pad];
  const set=(i,on)=>{ pad.buttons[i].pressed=!!on; pad.buttons[i].value=on?1:0; };
  const clear=()=>{ for(let i=0;i<16;i++) set(i,false); pad.axes=[0,0,0,0]; };
  const DT=1/60;

  G.mode=MODE_SWEEP; seed=5; genWorld(0); G.state='play';
  const cx=(G.nx>>1), cz=(G.nz>>1);
  for(let y=1;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i=idx(x,y,z); if(G.st[i]!==ROCK) G.st[i]=AIR;
  }
  P.x=(cx+0.5)*BLOCK; P.z=(cz+0.5)*BLOCK; P.y=BLOCK; P.vx=P.vy=P.vz=0; P.ground=true;

  clear(); pollPad(DT);
  R.push('pad detected: '+GP.active);

  // left stick moves
  clear(); pad.axes=[1,0,0,0]; pollPad(DT);
  const msRight=IN.ms;
  pad.axes=[0,-1,0,0]; pollPad(DT);
  R.push(`left stick: full right -> IN.ms ${msRight.toFixed(2)}, full up -> IN.mf ${IN.mf.toFixed(2)}`);
  // deadzone
  clear(); pad.axes=[0.12,0.10,0,0]; pollPad(DT);
  R.push(`resting drift 0.12/0.10 -> IN.ms ${IN.ms.toFixed(3)} IN.mf ${IN.mf.toFixed(3)} (want 0)`);

  // right stick looks, and honours invert
  clear(); P.yaw=0; P.pitch=0; G.invY=false;
  pad.axes=[0,0,1,0]; for(let k=0;k<10;k++) pollPad(DT);
  const yawTurn=P.yaw;
  clear(); P.pitch=0; pad.axes=[0,0,0,1]; for(let k=0;k<10;k++) pollPad(DT);
  const pitchNormal=P.pitch;
  clear(); P.pitch=0; G.invY=true; pad.axes=[0,0,0,1]; for(let k=0;k<10;k++) pollPad(DT);
  R.push(`right stick: yaw moved ${yawTurn.toFixed(3)}, pitch ${pitchNormal.toFixed(3)} normal `+
         `vs ${P.pitch.toFixed(3)} inverted (signs must differ)`);
  G.invY=false;

  // A jumps
  clear(); pollPad(DT); P.ground=true; P.jumps=0; P.vy=0;
  set(0,true); pollPad(DT); updateJump(DT);
  R.push(`A: vy ${P.vy.toFixed(2)} jumps ${P.jumps} (want a jump)`);

  // R1 and R2 shoot
  clear(); pollPad(DT);
  /* stand a block up in front and aim at it, or the shot hits nothing and the
     test proves nothing */
  const put1=(dx)=>{
    const bx=cx+dx, by=1, bz=cz;
    const bi=idx(bx,by,bz); G.st[bi]=SOLID; G.mine[bi]=0;
    const ax=(bx+0.5)*BLOCK, ay=(by+0.5)*BLOCK, az=(bz+0.5)*BLOCK;
    const ddx=ax-P.x, ddy=ay-(P.y+EYE), ddz=az-P.z;
    P.yaw=Math.atan2(-ddx,-ddz); P.pitch=Math.atan2(ddy,Math.hypot(ddx,ddz));
    return bi;
  };
  let b1=put1(2); const rev0=G.revealed;
  set(5,true); pollPad(DT); set(5,false); pollPad(DT);
  const r1ok = G.st[b1]===AIR;
  let b2=put1(3);
  pad.buttons[7].value=1; pad.buttons[7].pressed=true; pollPad(DT);
  pad.buttons[7].value=0; pad.buttons[7].pressed=false; pollPad(DT);
  const r2ok = G.st[b2]===AIR;
  R.push(`R1 broke its block ${r1ok}, R2 broke its block ${r2ok}, revealed ${rev0} -> ${G.revealed}`);

  // L1 / L2 / B drive the think button
  clear(); pollPad(DT);
  set(4,true); pollPad(DT);
  const onL1=THINK.on;
  set(4,false); pollPad(DT);
  const offL1=THINK.on;
  set(1,true); pollPad(DT);
  const onB=THINK.on;
  set(1,false); pollPad(DT);
  R.push(`L1 held -> THINK.on ${onL1}, released -> ${offL1}; B held -> ${onB} (want true/false/true)`);

  // X and L3 run
  clear(); pollPad(DT); const s0=IN.sprint;
  set(2,true); pollPad(DT); const sX=IN.sprint; set(2,false);
  set(10,true); pollPad(DT); const sL3=IN.sprint; set(10,false); pollPad(DT);
  R.push(`sprint: idle ${s0}, X ${sX}, L3 ${sL3}`);

  // Select inverts
  clear(); pollPad(DT); const inv0=G.invY;
  set(8,true); pollPad(DT); const inv1=G.invY;
  pollPad(DT); const inv2=G.invY;              // still held: must not toggle again
  set(8,false); pollPad(DT);
  R.push(`Select: ${inv0} -> ${inv1}, still held -> ${inv2} (must not repeat)`);
  G.invY=false;

  // Y / Start open the menu
  clear(); pollPad(DT); G.state='play';
  set(3,true); pollPad(DT);
  R.push(`Y from play -> state ${G.state} (want pause)`);
  set(3,false); pollPad(DT);

  // R3 locks on
  G.state='play'; clear(); pollPad(DT);
  G.boss=true; enemies.length=0;
  let solid=-1;
  for(let i=0;i<G.nx*G.ny*G.nz && solid<0;i++){
    if(G.st[i]!==SOLID) continue;
    const c=cellXYZ(i);
    for(const g of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
      const X=c[0]+g[0],Y=c[1]+g[1],Z=c[2]+g[2];
      if(inside(X,Y,Z) && G.st[idx(X,Y,Z)]===AIR){ solid=i; break; }
    }
  }
  const e=spawnEnemy(1,0,solid);
  if(!e) R.push('could not spawn a target for the lock-on test');
  else{
    // face away, then lock and let it slew back
    /* Roughly facing it but well off-axis — lock-on deliberately only takes
       targets in front of you, so aiming at the opposite wall must find
       nothing, and that is a separate check below. */
    P.yaw = Math.atan2(-(e.x-P.x), -(e.z-P.z)) + 0.9;
    P.pitch = 0;
    const offBy0 = 0.9;
    set(11,true); pollPad(DT); set(11,false); pollPad(DT);
    const locked = !!G.lockOn;
    for(let k=0;k<90;k++) updateLock(DT);
    const want=Math.atan2(-(e.x-P.x),-(e.z-P.z));
    let off=((want-P.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;
    R.push(`R3: locked ${locked}; started ${offBy0.toFixed(2)} rad off target, `+
           `after 1.5 s it is ${Math.abs(off).toFixed(3)} rad off`);
    // facing the other way, there is nothing in front to take
    G.lockOn=null;
    P.yaw = Math.atan2(-(e.x-P.x), -(e.z-P.z)) + Math.PI;
    set(11,true); pollPad(DT); set(11,false); pollPad(DT);
    R.push(`R3 with the target behind you: ${G.lockOn?'locked anyway (wrong)':'found nothing, as intended'}`);
    // re-acquire, then check the stick drops it
    P.yaw = Math.atan2(-(e.x-P.x), -(e.z-P.z));
    set(11,true); pollPad(DT); set(11,false); pollPad(DT);
    pad.axes=[0,0,0.8,0]; pollPad(DT);
    R.push(`nudging the right stick releases it: lockOn now ${G.lockOn?'still held':'released'}`);
    // and a dead target releases it
    G.lockOn=e; enemies.length=0; updateLock(DT);
    R.push(`target removed: lockOn ${G.lockOn?'STILL SET':'cleared'}`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 14000);
