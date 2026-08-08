/* WHAT THE UNIVERSE ACTUALLY LOOKS LIKE, MEASURED IN PIXELS

   From a hundred kilometres up, with the log to go with it: "the planet is a
   black mass and there is a different horizon and sky IN THE UNIVERSE ABOVE.
   Universe should look star filled, and from far away the planet should look
   like a planet."

   Three separate faults and every one of them was a number in the shader
   pretending to be a fact about the world:

     col *= mix(1.0, 0.06, uH/45000)      dimmed the PLANET as well as the air
     else if(h <= 0.0) { ...another sky }  drew a second horizon under the first
     stars * uNight * clamp(h*3,0,1)       no stars by day, none below you

   So this harness does not read the source. It renders frames and reads the
   framebuffer back, because the only honest test of a picture is the picture.
   Prefixed sk. It MUST be run with --shot: without it the runner stubs
   requestAnimationFrame out and nothing is ever drawn.

     python tools/runh.py tools/h_space.js --shot sk.png 900x620            */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
(function(){
  const R=[];
  let skBuf=null;
  function skGrab(){
    const w=gl.drawingBufferWidth, h=gl.drawingBufferHeight;
    if(!skBuf || skBuf.length!==w*h*4) skBuf=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,skBuf);
    return {w,h,b:skBuf};
  }
  /* x,y measured from the TOP LEFT, the way a screenshot is, not the way GL is */
  const skAt = (g,x,y) => { const i=((g.h-1-(y|0))*g.w + (x|0))*4;
                            return [g.b[i],g.b[i+1],g.b[i+2]]; };
  const skL  = c => c[0]*0.30 + c[1]*0.59 + c[2]*0.11;
  const skS  = c => '('+c[0]+','+c[1]+','+c[2]+')';
  /* the mean of a rectangle, and how many pixels in it are bright enough to be
     a star - two numbers from one pass */
  function skBox(g,x0,y0,x1,y1,thr){
    let s=0,n=0,br=0,mx=0;
    for(let y=y0|0;y<y1;y++) for(let x=x0|0;x<x1;x++){
      const l=skL(skAt(g,x,y)); s+=l; n++; if(l>thr) br++; if(l>mx) mx=l;
    }
    return {mean:s/Math.max(n,1), bright:br, n, max:mx};
  }
  /* HOW MANY TIMES THE PICTURE GOES FROM DARK TO LIT AND BACK, down a column.
     One world seen from outside it is exactly one crossing. The seam he
     photographed was a second one, and counting per-pixel JUMPS would not have
     caught it: the false horizon was a gradient too. So this bands the column
     with hysteresis and counts the crossings, which a gradient cannot fake.
     It also returns the brightest thing on the way down - the air on the limb
     stands above both the black and the ground, and that peak IS the blue rim. */
  function skBands(g,x,y0,y1){
    let state=null, n=0, edge=-1;
    for(let y=y0;y<y1;y++){
      const l=skL(skAt(g,x,y));
      const s = l < 18 ? 'dark' : l > 55 ? 'lit' : state;
      if(state && s && s !== state){ n++; if(edge<0) edge=y; }
      state = s || state;
    }
    /* THE RIM IS A LOCAL PEAK, not the brightest thing in the frame - the disc
       goes on brightening all the way to the nadir, and comparing against that
       said "no rim" while the profile plainly had one. Compare it against the
       ground DIRECTLY BELOW IT, which is what your eye does. */
    let peak=-1, peakY=0;
    if(edge>0) for(let y=Math.max(y0,edge-14); y<Math.min(y1,edge+50); y++){
      const l=skL(skAt(g,x,y)); if(l>peak){ peak=l; peakY=y; }
    }
    let s=0,c=0;
    for(let y=peakY+30; y<Math.min(y1,peakY+90); y++){ s+=skL(skAt(g,x,y)); c++; }
    return {cross:n, edge, peak, peakY, under:s/Math.max(c,1)};
  }

  /* put him h metres above the sea, looking whichever way is asked. Down is a
     sign in this game and gsign() is the only thing that knows it, so every
     angle in here is written through it rather than as a Y. */
  const skHome = {x:0,y:0,z:0};
  function skPose(h, pitch){
    const up = gsign();
    P.x = skHome.x; P.z = skHome.z;
    P.y = (h === null) ? skHome.y : G.seaY*BLOCK + up*h;
    P.vx=P.vy=P.vz=0; P.yaw=0;
    P.pitch = up*pitch;
    P.sub=0; P.imm=0;
  }
  /* the sun where we want it: phase 0 is due east on the horizon, 0.25 is noon */
  function skSun(ph){ SKY_T0 = tGlobal - SKY_DAY*((ph - 0.16 + 1)%1); }

  const skJobs=[];
  function skStage(name, set, read){ skJobs.push({name,set,read}); }

  /* ---- 1. THE GROUND, and it must not have changed --------------------
     Sixty metres over the island rather than on it: the same air to within one
     part in a hundred, and no tree or roof in the way of the measurement. */
  skStage('ground', ()=>{ skSun(0.25); skPose(null, 0.35); P.y += gsign()*60; }, g=>{
    const sky = skAt(g, g.w*0.30, g.h*0.10);
    const low = skAt(g, g.w*0.30, g.h*0.72);
    R.push('SIXTY METRES UP AT NOON: sky at 49 degrees ' + skS(sky) +
           ', at 3 degrees ' + skS(low) + ' ' +
           (sky[2] > sky[0]+30 && skL(sky) > 30
            ? 'ok, a blue sky, and a bright one'
            : 'FAULT: the sky over his head is not a sky'));
    R.push('  and it goes PALE toward the horizon: ' +
           ((low[0]-sky[0]) > 20 ? 'ok, ' + (low[0]-sky[0]) + ' more red down low'
                                 : 'FAULT: flat - no horizon band'));
  });

  /* ---- 2. A HUNDRED KILOMETRES UP, looking down -----------------------
     The planet is 59 degrees of angular radius from up here and the field of
     view is 35, so looking down there is nothing BUT planet - which is the
     whole point: it used to be nothing but BLACK planet. */
  skStage('space', ()=>{ skSun(0.25); skPose(100000, -1.45); }, g=>{
    const ball = skBox(g, g.w*0.24, g.h*0.30, g.w*0.46, g.h*0.62, 200);
    const c = skAt(g, g.w*0.38, g.h*0.50);
    R.push('A HUNDRED KILOMETRES UP, looking straight down: the planet reads ' +
           skS(c) + ', mean ' + ball.mean.toFixed(0) + '/255 ' +
           (ball.mean > 45 ? 'ok, IT IS NOT A BLACK MASS' : 'FAULT: still a black mass'));
    R.push('  and it is BLUE: ' + (c[2] > c[0] + 12
            ? 'ok, blue beats red by ' + (c[2]-c[0]) + ' - that is the air over it'
            : 'FAULT: it is not blue, blue-red = ' + (c[2]-c[0])));
    /* AND YOU CAN SEE THE SEA HE SWAM IN. The nadir is a few degrees below the
       middle of the screen at this pitch; his ring of ocean is ten kilometres
       across, which from here is six degrees, and the plain is everything past
       it. If those two come back the same colour the disc is blown out. */
    const sea  = skAt(g, g.w*0.50-30, g.h*0.50+61);
    const dry  = skAt(g, g.w*0.50-250, g.h*0.50+61);
    R.push('  THE ISLAND FROM ORBIT: his ring of sea ' + skS(sea) +
           ' against the plain beyond it ' + skS(dry) + ' ' +
           ((sea[2]-sea[0]) > (dry[2]-dry[0]) + 20
            ? 'ok, the water is bluer than the land by ' +
              ((sea[2]-sea[0])-(dry[2]-dry[0])) + ' - YOU CAN SEE WHERE YOU LIVE'
            : 'FAULT: they are the same colour, so the disc is blown out'));
  });

  /* ---- 3. THE SAME PLACE, LOOKING AWAY FROM IT ------------------------ */
  skStage('away', ()=>{ skSun(0.25); skPose(100000, 0.9); }, g=>{
    const b = skBox(g, 0, 0, g.w, g.h*0.55, 40);
    R.push('AND LOOKING AWAY FROM IT: mean ' + b.mean.toFixed(2) + '/255 ' +
           (b.mean < 14 ? 'ok, space is black' :
            'FAULT: something is drawn out there, and that is the second sky'));
    R.push('  STARS: ' + b.bright + ' of ' + b.n + ' pixels, brightest ' +
           b.max.toFixed(0) + ' ' +
           (b.bright > 30 && b.bright < b.n*0.2
            ? 'ok, IT IS FULL OF STARS' : 'FAULT: ' + b.bright + ' lit pixels'));
  });

  /* ---- 4. THE LIMB: where the two of them meet, and it must meet ONCE - */
  skStage('limb', ()=>{ skSun(0.25); skPose(100000, -0.54); }, g=>{
    const sky  = skBox(g, g.w*0.10, 0,        g.w*0.40, g.h*0.16, 40);
    const gnd  = skBox(g, g.w*0.10, g.h*0.80, g.w*0.40, g.h*0.96, 40);
    const bd = skBands(g, (g.w*0.25)|0, 2, (g.h*0.96)|0);
    R.push('THE LIMB, from a hundred kilometres: space above reads ' +
           sky.mean.toFixed(1) + ', planet below ' + gnd.mean.toFixed(0) + ' ' +
           (sky.mean < 14 && gnd.mean > 40 ? 'ok, black over a lit world'
                                           : 'FAULT'));
    R.push('  dark-to-lit crossings down the screen: ' + bd.cross + ' ' +
           (bd.cross === 1 ? 'ok, ONE WORLD AND ONE EDGE'
                           : 'FAULT: ' + bd.cross + ' horizons, and there is one'));
    R.push('  the air stands as a RIM on the edge of it: ' + bd.peak.toFixed(0) +
           ' at row ' + bd.peakY + ' against ' + bd.under.toFixed(0) +
           ' for the ground right under it ' +
           (bd.peak > bd.under + 20 ? 'ok, THERE IS A RIM' : 'FAULT: no rim'));
    /* and if there is not, the profile says why - it always beats guessing */
    const prof=[];
    for(let y=0;y<g.h;y+=Math.max(1,(g.h/26)|0)){
      const c=skAt(g,(g.w*0.25)|0,y); prof.push(y+':'+skL(c).toFixed(0));
    }
    R.push('  down the column: ' + prof.join(' '));
  });

  /* ---- 5. FOUR HUNDRED KILOMETRES, with the sun on the horizon -------- */
  skStage('shadow', ()=>{ skSun(0.0); skPose(400000, -1.45); }, g=>{
    const y=(g.h*0.5)|0; let lo=999, hi=-1, loX=0, hiX=0;
    for(let x=(g.w*0.22)|0; x<g.w*0.78; x++){
      const l=skL(skAt(g,x,y));
      if(l<lo){lo=l;loX=x;} if(l>hi){hi=l;hiX=x;}
    }
    R.push('FOUR HUNDRED KILOMETRES, sun on the horizon: across the disc the ' +
           'brightest point is ' + hi.toFixed(0) + ' at x' + hiX +
           ' and the darkest ' + lo.toFixed(0) + ' at x' + loX + ' ' +
           (hi > 55 && lo < 22 ? 'ok, IT HAS A DAY SIDE AND A NIGHT SIDE'
                               : 'FAULT: no terminator - it is lit all over'));
  });

  /* ---- 6. NIGHT ON THE ISLAND ----------------------------------------- */
  skStage('night', ()=>{ skSun(0.75); skPose(null, 0.55); P.y += gsign()*60; }, g=>{
    const b = skBox(g, 0, 0, g.w, g.h*0.30, 40);
    R.push('NIGHT ON THE ISLAND: sky mean ' + b.mean.toFixed(1) +
           ', lit pixels ' + b.bright + ' ' +
           (b.mean < 40 && b.bright > 10 ? 'ok, dark, and the stars are out'
                                         : 'FAULT: mean ' + b.mean.toFixed(1) +
                                           ' lit ' + b.bright));
  });

  /* ---- and leave him wherever the run was asked to photograph --------- */
  const skWant = (location.search.match(/pose=(\w+)/)||[])[1] || 'space';

  let skI=0, skWait=0;
  function skTick(){
    if(skI >= skJobs.length){
      /* the pose the screenshot gets */
      const j = skJobs.find(j=>j.name===skWant) || skJobs[1];
      j.set();
      /* THE MENU IS A DOM ELEMENT AND IT SITS OVER THE CANVAS. readPixels never
         saw it - the numbers above were always the picture - but --shot
         photographs the page, and the first four came back as the title
         screen with a sky behind it. It is only hidden by starting a game,
         which this harness deliberately does not do. */
      document.querySelectorAll('.screen').forEach(e=>e.classList.remove('on'));
      R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
      R.push('photographed: ' + j.name);
      document.body.dataset.r = R.join(' ~ ');
      return;
    }
    const j = skJobs[skI];
    if(skWait === 0){ document.body.dataset.r='STAGE '+j.name; j.set(); }
    skWait++;
    if(skWait >= 4){                      // let the frame settle before reading
      try{ j.read(skGrab()); }
      catch(err){ R.push('THREW in '+j.name+': '+err.message); }
      skI++; skWait=0;
    }
    requestAnimationFrame(skTick);
  }

  setTimeout(()=>{ try{
    G.muted=true; try{ snd.setMute(true); }catch(e){}
    G.mode=MODE_WORLD; seed=5; genWorld(0);
    G.state='pause';                      // draw, but do not fall while measuring
    G.noWin=true;
    skHome.x=P.x; skHome.y=P.y; skHome.z=P.z;   // where the game put him
    requestAnimationFrame(skTick);
  }catch(err){ document.body.dataset.r='THREW at setup: '+err.message+
    ' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
})();
