/* CAN HE SWIM DOWN?

   Asked three times: "I can't swim down! When I enter water I should be able to
   swim DOWN (or up)." The reason it felt like fighting something is that it
   was: buoyancy was an ACCELERATION and the kick was a LERP TOWARD A TARGET
   VELOCITY, so the kick could never win. A lerp steers toward a speed while a
   force keeps adding to one.

   Four forces now, summed - gravity, buoyancy, thrust along the aim, drag -
   and this asks the four questions that follow. Under BOTH gravity signs,
   because down is a sign in this game and the whole thing has been wrong about
   that before. Prefixed sw. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];

  /* a deep tank of brine, and him in the middle of it */
  const swBuild = () => {
    const w = new SandWorld(96,192,96);
    const NB=96/PGS, NBY=192/PGS;
    for(let by=0;by<NBY;by++) for(let bz=0;bz<NB;bz++) for(let bx=0;bx<NB;bx++)
      cFreeBlock(w, bx,by,bz, by>0 && by<NBY-1 ? S_SALT : S_ROCK);
    return w;
  };
  /* run him for N seconds with a given aim and key, and say how far he moved
     along HIS OWN up */
  const swRun = (secs, pitch, fwd, jump) => {
    P.vx=P.vy=P.vz=0; P.yaw=0; P.pitch=pitch;
    IN.f=fwd>0?1:0; IN.b=fwd<0?1:0; IN.l=IN.r=0; IN.mf=0; IN.ms=0;
    IN.jumpHeld=!!jump;
    const y0=P.y;
    for(let t=0;t<secs*60;t++) physics(1/60);
    IN.f=IN.b=0; IN.jumpHeld=false;
    /* his own up is -gravity, so a positive number here always means UPWARD
       to him, whichever way the world is pointing */
    return (P.y-y0) * gsign();   /* his own up: +Y when down is -Y */
  };

  for(const gk of [1,-1]){
    document.body.dataset.r='STAGE grav '+gk;
    G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
    G.gravK=gk; rollReset(); ROLL_T=0;
    const w = swBuild();
    const save = SAND; SAND = w;
    G.seaY = 0;
    P.x=48*CELL_M; P.z=48*CELL_M; P.y=96*CELL_M;
    P.fx.fill(0); P.hp=P.hpMax=HP_START; P.air=AIR_MAX; P.load=0;
    sandLoad(1/60);
    R.push('GRAVITY ' + (gk>0?'+':'') + gk + ': down is ' + (gsign()>0?'-Y':'+Y') +
           ', immersed ' + (P.imm*100).toFixed(0) + '% in ' + P.immD.toFixed(0) + ' kg/m3');

    /* looking DOWN and pressing forward: he must descend */
    P.y=96*CELL_M;
    const dn = swRun(2.0, -1.35*gsign(), +1, false);
    /* looking UP and pressing forward: he must rise */
    P.y=96*CELL_M;
    const up = swRun(2.0, +1.35*gsign(), +1, false);
    /* nothing at all: brine is denser than a person, so he drifts UP slowly */
    P.y=96*CELL_M;
    const idle = swRun(2.0, 0, 0, false);
    /* treading water */
    P.y=96*CELL_M;
    const tread = swRun(2.0, 0, 0, true);

    R.push('  aim DOWN + forward: ' + dn.toFixed(2) + ' m in 2 s ' +
           (dn < -1.5 ? 'ok, HE SWIMS DOWN' : 'FAULT: he will not go down'));
    R.push('  aim UP + forward:   ' + up.toFixed(2) + ' m ' +
           (up > 1.5 ? 'ok, he swims up' : 'FAULT'));
    R.push('  hands off:          ' + idle.toFixed(2) + ' m ' +
           (Math.abs(idle) < 1.5 ? 'ok, he floats about where he is' : 'note: he is not neutral'));
    R.push('  treading water:     ' + tread.toFixed(2) + ' m ' +
           (tread > 0.8 ? 'ok, jump still climbs' : 'FAULT'));
    SAND = save;
  }

  /* AND DENSITY DECIDES IT, with nobody tuning anything: the same kick in
     three different fluids has to give three different answers. */
  document.body.dataset.r='STAGE density';
  {
    G.gravK=1; rollReset(); ROLL_T=0;
    const rows=[];
    for(const [nm,mat] of [['oil',S_OIL],['water',S_WATER],['brine',S_SALT],['mud',S_MUD]]){
      if(mat===undefined) continue;
      const w = new SandWorld(96,192,96);
      const NB=96/PGS, NBY=192/PGS;
      for(let by=0;by<NBY;by++) for(let bz=0;bz<NB;bz++) for(let bx=0;bx<NB;bx++)
        cFreeBlock(w, bx,by,bz, by>0 && by<NBY-1 ? mat : S_ROCK);
      const save=SAND; SAND=w;
      P.x=48*CELL_M; P.z=48*CELL_M; P.y=96*CELL_M;
      P.fx.fill(0); P.load=0; sandLoad(1/60);
      const rho=P.immD;
      P.y=96*CELL_M;
      const d = swRun(2.0, -1.35, +1, false);
      rows.push(nm+' '+rho.toFixed(0)+' -> '+d.toFixed(2)+' m');
      SAND=save;
    }
    R.push('THE SAME KICK IN FOUR FLUIDS: ' + rows.join(' | ') +
           ' (down is negative; denser should mean less)');
  }
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
