/* Does the gun point forward, does the shot leave the barrel, and does the
   buckshot open to four radii and then stop?

   buildViewModel writes one 4x4 per part straight into viewB.data, and the
   view model is drawn with an identity view matrix — so those matrices are
   already in CAMERA space, eye at the origin, looking down -Z. Everything
   below is read back out of that buffer rather than recomputed, so it is what
   the GPU draws and not a second opinion about it.

     part 0  barrel      part 4  stock      part 5  muzzle ring
     translation  d[o+12..14]      local +Z  d[o+8..10]

   The three things that were wrong: the barrel sat 169 degrees off forward,
   the muzzle rendered nearer the camera than the stock, and recoil swung the
   whole model 31 degrees. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    G.mode = MODE_SWEEP; startGame(); seed=77; genWorld(0);
    G.state='play'; try{ setScreen('play'); }catch(e){}
    enemies.length = 0;
    const asp = 16/9;

    const read = (i) => {
      const d = viewB.data, o = i*CUBE_STRIDE;
      const ax = [d[o+8], d[o+9], d[o+10]];
      const L = Math.hypot(ax[0],ax[1],ax[2]) || 1;
      return {p:[d[o+12],d[o+13],d[o+14]], z:[ax[0]/L, ax[1]/L, ax[2]/L]};
    };
    const deg = (a,b) => Math.acos(Math.max(-1,Math.min(1,
                  a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
    const FWD = [0,0,-1];

    const at = {};
    for(const rc of [0, 1]){
      recoil = rc; swayX = swayY = 0; P.bob = 0;
      buildViewModel(0, 0, asp);
      at[rc] = {barrel: read(0), muzzle: read(5), stock: read(4)};
    }
    const off0 = deg(at[0].barrel.z, FWD), off1 = deg(at[1].barrel.z, FWD);
    R.push('barrel off forward: ' + off0.toFixed(1) + ' deg at rest, ' +
           off1.toFixed(1) + ' deg at full recoil' +
           (Math.max(off0,off1) < 10 ? ' — points forward' : ' — STILL WRONG'));
    R.push('swing across the whole recoil: ' +
           deg(at[0].barrel.z, at[1].barrel.z).toFixed(1) + ' deg');
    const mz = at[0].muzzle.p[2], sz = at[0].stock.p[2];
    R.push('muzzle z=' + mz.toFixed(2) + ' vs stock z=' + sz.toFixed(2) +
           (mz < sz ? ' — muzzle is the far end, right way round'
                    : ' — HELD BACKWARDS'));
    /* Recoil must move it towards the camera, not away and not down. */
    R.push('recoil moves the muzzle ' +
           (at[1].muzzle.p[2] - at[0].muzzle.p[2] > 0 ? 'BACK' : 'FORWARD (wrong)') +
           ' and ' + (at[1].muzzle.p[1] - at[0].muzzle.p[1] > 0 ? 'up' : 'down'));

    /* --- and now actually fire one --- */
    P.yaw = 0.7; P.pitch = -0.15; recoil = 0;
    buildViewModel(0, 0, asp);
    pellets.length = 0;
    shoot();
    if(!pellets.length){ R.push('NO PELLETS'); }
    else {
      const p0 = pellets[0];
      const eyeD = Math.hypot(p0.ox-P.x, p0.oy-(P.y+EYE), p0.oz-P.z);
      R.push(pellets.length + ' pellets, leaving ' + eyeD.toFixed(2) +
             ' m from the eye' + (eyeD > 0.4 ? ' — out of the barrel' : ' — AT THE EYE'));
      /* Every scatter axis must be square to the shot, or the cone leans. */
      let worstDot = 0;
      for(const p of pellets)
        worstDot = Math.max(worstDot, Math.abs(p.ax*p.dx + p.ay*p.dy + p.az*p.dz));
      R.push('scatter axis squareness: worst |dot| ' + worstDot.toFixed(4));
      /* The cone opens, then runs parallel. Sample the cloud radius against
         distance travelled; past PEL_OPEN it must not grow. */
      const cap = PEL_RADII*PEL_SIZE;
      const prof = [];
      for(const T of [0.2, 0.7, 1.4, 3.0, 8.0]){
        let worst = 0;
        for(const p of pellets) worst = Math.max(worst, p.r*Math.min(1, T/PEL_OPEN));
        prof.push(T.toFixed(1)+'m:'+worst.toFixed(3));
      }
      R.push('cloud radius ' + prof.join(' ') + ' | cap ' + cap.toFixed(3) +
             ' (' + PEL_RADII + ' x voxel ' + PEL_SIZE.toFixed(3) + ')');
      let over = 0;
      for(const p of pellets) if(p.r > cap + 1e-6) over++;
      R.push(over ? over + ' PELLETS PAST THE CAP' : 'none past the cap');
      /* They must reach the impact point and then stop existing. */
      const reach = pellets[0].reach;
      for(let k=0;k<400 && pellets.length;k++) updatePellets(1/60);
      R.push('after ' + reach.toFixed(1) + ' m of flight: ' + pellets.length + ' left');
    }
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message+' @ '+(err.stack||'').split('\n')[1]; }
}, 250);
