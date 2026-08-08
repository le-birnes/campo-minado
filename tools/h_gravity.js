/* IS IT A PLANET?

   "Give gravity to my planet ... create it as a planet", and "a place I can
   later shoot up and go around it."

   Three things have to be true at once, and the first is the one that makes
   the other two safe:

     1. WHERE HE PLAYS, NOTHING CHANGED. If the island does not feel identical
        this is a regression however good the maths is.
     2. IT IS A DIRECTION TO A POINT. Ten kilometres out, down should have
        turned by about a degree, and it should point at the same place.
     3. IT FALLS OFF. Orbit and escape have to be REAL NUMBERS - if g is
        constant, shooting downward for ever just makes a very tall jump.

   Prefixed gv. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.gravK=-1;                                  // the world the right way up
  const R=[];
  const cx=(G.nx*BLOCK)/2, cz=(G.nz*BLOCK)/2, sy=G.seaY*BLOCK;

  R.push('planet radius ' + (PLANET_R/1000) + ' km, centre ' +
         (planetCY()/1000).toFixed(1) + ' km below the sky, sea level y ' + sy.toFixed(0) + ' m');

  /* 1. AT THE BEACH IT MUST BE WHAT IT ALWAYS WAS */
  const g0 = gravAt(cx, sy, cz);
  R.push('at sea level, in the middle: (' + g0.map(v=>v.toFixed(6)).join(', ') + ')' +
         ' | GRAV is ' + GRAV + ' ' +
         (Math.abs(Math.abs(g0[1]) - GRAV) < 1e-4 && Math.abs(g0[0])<1e-6 && Math.abs(g0[2])<1e-6
          ? 'ok, straight down and exactly GRAV - nothing he can feel has changed'
          : 'FAULT: the island does not feel the same'));

  /* 2. IT IS A DIRECTION TO A POINT */
  for(const d of [100, 10000, 100000]){
    const g = gravAt(cx+d, sy, cz);
    const tilt = Math.atan2(Math.abs(g[0]), Math.abs(g[1]))*180/Math.PI;
    R.push('  ' + (d/1000).toFixed(1) + ' km sideways: down has turned ' +
           tilt.toFixed(2) + ' deg (a sphere of ' + (PLANET_R/1000) + ' km says ' +
           (Math.atan2(d, PLANET_R)*180/Math.PI).toFixed(2) + ')');
  }

  /* 3. IT FALLS OFF, and that is what makes orbit a number */
  R.push('strength with height: ' + [0, 1000, 100000, 600000, 2400000].map(h=>{
    const g = gravAt(cx, sy-h, cz);
    return (h/1000)+' km ' + Math.abs(g[1]).toFixed(2);
  }).join(' | ') + ' m/s2 ' +
    (Math.abs(gravAt(cx,sy-PLANET_R,cz)[1]) < GRAV*0.3
     ? 'ok, an inverse square - it lets go' : 'FAULT: it never lets go'));
  R.push('so ORBIT at the surface is ' + (orbitalV(0)/1000).toFixed(2) +
         ' km/s and ESCAPE is ' + (escapeV(0)/1000).toFixed(2) + ' km/s' +
         ' - at 10 km up, orbit ' + (orbitalV(10000)/1000).toFixed(2) + ' km/s');

  /* AND THE FLIP STILL FLIPS */
  G.gravK=1;  const up = gravAt(cx, sy, cz)[1];
  G.gravK=-1; const dn = gravAt(cx, sy, cz)[1];
  R.push('gravK +1 gives y ' + up.toFixed(1) + ', -1 gives ' + dn.toFixed(1) + ' ' +
         (up*dn < 0 ? 'ok, the dungeon can still be upside down' : 'FAULT: the flip is gone'));
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
