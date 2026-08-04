/* The pump, the size, the kick and the smoke.

   buildViewModel writes one 4x4 per part into viewB.data and the view model
   is drawn with an identity view matrix, so those matrices are already in
   camera space. Everything below is read back out of that buffer, which is
   what the GPU gets rather than a second opinion about it.

     part 0 barrel   part 2 pump   part 4 stock   part 5 muzzle ring

   The pump is the interesting one: it is the only part that moves on its
   own, it must move BACK (towards the stock) and return, and it must do it
   when the rack sound plays rather than when the trigger is pulled. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    G.mode = MODE_SWEEP; startGame(); seed=77; genWorld(0);
    G.state='play'; try{ setScreen('play'); }catch(e){}
    enemies.length = 0; try{ hurtPlayer = function(){}; }catch(e){}
    const asp = 16/9;
    const pos = i => { const d=viewB.data, o=i*CUBE_STRIDE;
                       return [d[o+12],d[o+13],d[o+14]]; };
    const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

    /* --- size --- */
    recoil = 0; swayX = swayY = 0; P.bob = 0; PUMPA.at = -1;
    buildViewModel(0, 0, asp);
    const span = dist(pos(5), pos(4));
    /* what the model itself measures, times the placement scale */
    const hh = 0.90*Math.tan(55*Math.PI/360);
    const raw = Math.hypot(0-0, 0.10-(-0.30), 1.05-(-1.30));
    R.push('muzzle-to-stock ' + span.toFixed(3) +
           ', full size would be ' + (raw*hh).toFixed(3) +
           ' -> ' + (100*span/(raw*hh)).toFixed(0) + '% of the old gun');

    /* Shots land on real blocks and some of those are mines, which ends the
       run — and a finished game makes every later shoot() a no-op, so the
       checks after it silently measure nothing. Keep it alive. */
    const fire = () => { G.state='play'; G.fuse=0; G.boomCell=null; shoot();
                         G.state='play'; G.fuse=0; G.boomCell=null; };

    /* --- the rack, and when --- */
    tGlobal = 100;
    P.vx = P.vz = 0;
    const nP = particles.length;
    PUMPA.at = -1;
    fire();
    const at = PUMPA.at;
    const kick = Math.hypot(P.vx, P.vz);
    R.push('rack scheduled ' + (at - 100).toFixed(3) + ' s after the trigger');

    const sample = (tt) => { buildViewModel(tt, 0, asp);
                             return dist(pos(GUN_PUMP), pos(1)); };  // pump vs mag tube
    const rest   = sample(at - 0.05);
    const mid    = sample(at + PUMP_DUR*0.5);
    const back   = sample(at + PUMP_DUR + 0.02);
    R.push('pump offset from the tube: before ' + rest.toFixed(3) +
           ' | mid-rack ' + mid.toFixed(3) + ' | after ' + back.toFixed(3) +
           ((mid - rest) > 0.05 && Math.abs(back - rest) < 0.01
              ? ' — back and forth once' : ' — DOES NOT CYCLE'));
    /* Which way did it go? Towards the stock, or is it being pushed out of
       the barrel. Re-arm first: sampling past the end of the cycle above
       cleared PUMPA.at, which would leave both samples at rest and read as
       "it never moved". */
    PUMPA.at = at;
    buildViewModel(at + PUMP_DUR*0.5, 0, asp);
    const midP = pos(GUN_PUMP);
    PUMPA.at = at;
    buildViewModel(at - 0.05, 0, asp);
    const restP = pos(GUN_PUMP), muz = pos(5), stk = pos(4);
    const toStock = [stk[0]-muz[0], stk[1]-muz[1], stk[2]-muz[2]];
    const tl = Math.hypot(...toStock);
    const moved = ((midP[0]-restP[0])*toStock[0] + (midP[1]-restP[1])*toStock[1] +
                   (midP[2]-restP[2])*toStock[2]) / tl;
    R.push('it travels ' + moved.toFixed(3) + ' ' +
           (moved > 0 ? 'towards the stock, correct' : 'FORWARD, wrong way'));

    /* --- firing again cancels the pending rack --- */
    tGlobal = 200; PUMPA.at = -1;
    fire();
    const first = PUMPA.at;
    tGlobal = 200.1;
    fire();
    const second = PUMPA.at;
    R.push('rack was due at +' + (first-200).toFixed(2) + '; a second shot at +0.10 ' +
           (second > first ? 'pushed it to +' + (second-200).toFixed(2) +
                             ' — the first one never plays'
                           : 'DID NOT REPLACE IT'));

    /* Nothing lands in P.vx any more — that is the bug, not the measurement.
       The real check is the displacement one further down. */
    if(kick > 0.001) R.push('WARNING: ' + kick.toFixed(2) +
                            ' m/s leaked into P.vx, where the controller eats it');

    /* --- does the kick actually MOVE anything? ---
       This is the whole point: an impulse in P.vx was being deleted by the
       movement controller inside two frames and moved the player about a
       centimetre and a half. Fire once, stand still, integrate, and measure
       how far back it actually went. */
    IN.f=IN.b=IN.l=IN.r=0; IN.mf=IN.ms=0; IN.sprint=false;
    P.vx=P.vz=P.kx=P.kz=0; P.vy=0;
    const x0=P.x, z0=P.z;
    fire();
    const kx0 = Math.hypot(P.kx, P.kz);
    for(let k=0;k<40;k++) physics(1/60);
    const slid = Math.hypot(P.x-x0, P.z-z0);
    R.push('one shot: kick velocity ' + kx0.toFixed(2) + ' m/s -> slid ' +
           (slid*100).toFixed(1) + ' cm (v0*tau predicts ' +
           (kx0*KICK_TAU*100).toFixed(1) + ')' +
           (slid > 0.05 ? '' : ' — STILL BEING DELETED'));
    /* And the view punches without moving the aim. */
    recoil = 1;
    R.push('view punch ' + (recoil*VIEW_PUNCH*180/Math.PI).toFixed(1) +
           ' deg at the trigger, aim pitch untouched at ' + P.pitch.toFixed(3));

    /* --- shooting down lifts you a third of a block ---
       Cleared a column overhead first: standing in a one-block opening there
       is only 0.8 m of headroom and the ceiling, not the shot, would decide
       the answer. That clamp is real in play and worth knowing about, but it
       is not what is being measured here. */
    {
      const cx0=Math.floor(P.x/BLOCK), cz0=Math.floor(P.z/BLOCK);
      for(let y=0;y<G.ny;y++) for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++){
        const X=cx0+dx, Z=cz0+dz;
        if(inside(X,y,Z) && G.st[idx(X,y,Z)]!==ROCK && !G.mine[idx(X,y,Z)])
          G.st[idx(X,y,Z)]=AIR;
      }
      G.dirty=true;
      IN.f=IN.b=IN.l=IN.r=0; IN.mf=IN.ms=0;
      P.vx=P.vz=P.kx=P.kz=0; P.vy=0; P.stagger=0;
      for(let k=0;k<30;k++) physics(1/60);      // settle on the floor
      const y0=P.y;
      P.pitch = -Math.PI/2;                     // straight down
      fire();
      const vy = P.vy;
      let top = P.y;
      for(let k=0;k<90;k++){ physics(1/60); if(P.y>top) top=P.y; }
      R.push('shot straight down: ' + vy.toFixed(2) + ' m/s up, rose ' +
             (top-y0).toFixed(2) + ' m = ' + ((top-y0)/BLOCK).toFixed(2) +
             ' of a block (asked for 0.33, free rise v^2/2g = ' +
             (vy*vy/(2*GRAV)/BLOCK).toFixed(2) + ')');
      /* Level shot must lift nothing at all. */
      P.pitch = 0; P.vy = 0;
      for(let k=0;k<20;k++) physics(1/60);
      fire();
      R.push('level shot lifts ' + P.vy.toFixed(2) + ' m/s');
    }

    /* --- walking forward and firing nearly stops you --- */
    {
      P.pitch = 0; P.vx=P.vz=P.kx=P.kz=0; P.stagger=0;
      IN.f = 1;
      for(let k=0;k<60;k++) physics(1/60);     // up to running speed
      const before = Math.hypot(P.vx, P.vz);
      const fwd = () => -(P.vx*Math.sin(P.yaw) + P.vz*Math.cos(P.yaw));
      const run = fwd();
      fire();
      let low = 1e9;
      for(let k=0;k<24;k++){ physics(1/60);
        const v = fwd() + (-(P.kx*Math.sin(P.yaw) + P.kz*Math.cos(P.yaw)));
        if(v < low) low = v; }
      for(let k=0;k<40;k++) physics(1/60);
      R.push('running ' + run.toFixed(2) + ' m/s, fired: dropped to ' +
             low.toFixed(2) + ' (' + (100*low/Math.max(0.01,run)).toFixed(0) +
             '% of it), back to ' + fwd().toFixed(2) + ' after');
      IN.f = 0;
    }

    /* --- smoke --- */
    const smoke = particles.slice(nP).filter(p => p.e === 0 && p.c[0] < 0.2);
    let rising = 0, lum = 0;
    for(const p of smoke){ if(p.g < 0) rising++; lum += (p.c[0]+p.c[1]+p.c[2])/3; }
    R.push(smoke.length + ' dark puffs per shot, ' + rising + ' of them lifting, ' +
           'mean brightness ' + (smoke.length ? (lum/smoke.length).toFixed(3) : '-') +
           ' (unlit, so it darkens what is behind it)');
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message+' @ '+(err.stack||'').split('\n')[1]; }
}, 250);
