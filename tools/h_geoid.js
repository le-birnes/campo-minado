/* THE GEOID, AND THE BODIES THAT PULL ON IT

   "The world is solid, composed of dirt and rock and lava in the centre,
   pretty much like earth, so imagine a geoid in which a portion of it contains
   a donut-shaped depression filled with water, and the centre of the donut is
   the dungeon below the island."

   And: "the moon has weaker gravity and is a body in orbit around my planet,
   so when I get there the moon's gravity affects me more than my planet's."

   A cross-section is the honest way to show a world nobody can photograph, so
   this prints one - outward along the ground, and then downward through the
   crust - and then asks whether the moon really takes over. Prefixed ge. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play'; G.gravK=-1;
  worldBodies();
  const R=[];
  const nm = m => (SMAT[m]&&SMAT[m].n) || ('mat'+m);
  const b  = bodyPlanet();
  const cx=(G.nx*BLOCK)/2, cz=(G.nz*BLOCK)/2;

  R.push('OUTWARD ALONG THE GROUND from the island (height above sea level,');
  R.push('  and what is one metre under the surface):');
  for(const d of [0, 50, 90, 200, 400, 1000, 5000, 9000, 10000, 12000, 40000]){
    const h = geoH(d);
    /* A METRE UNDER THE SURFACE, MEASURED RADIALLY. Sampling "d metres
       sideways at the same y" is what a flat world would do, and on a sphere
       of 600 km it puts you d^2/2R ABOVE the ground - 67 m at nine kilometres,
       which read as air and looked like a hole in the planet. The surface is a
       direction from the centre, so the sample has to be too. */
    const ang = Math.atan2(d, b.R);
    const rr  = b.R + h - 1;
    const m = geoMat(cx + Math.sin(ang)*rr, b.y - Math.cos(ang)*rr, cz);
    R.push('  ' + String(d).padStart(6) + ' m out: ground ' +
           (h>=0?'+':'') + h.toFixed(1) + ' m, ' +
           (h < 0 ? 'UNDER WATER' : 'dry') + ', made of ' + nm(m));
  }
  R.push('  so: island to ' + ISLE_R + ' m, beach to ' + BEACH_R +
         ', a donut of sea ' + DONUT_D + ' m deep out to ' + (DONUT_R/1000) +
         ' km, then plain dirt for ever ' +
         (geoH(0)>0 && geoH(5000)<0 && geoH(40000)>0
          ? 'ok, THE DONUT IS THERE' : 'FAULT: that is not a donut'));

  R.push('DOWN THROUGH THE CRUST, under the island:');
  for(const dep of [0, 10, 39, 41, 1000, 100000, 300000, 340000, 500000]){
    const m = geoMat(cx, b.y - (b.R + geoH(0) - dep), cz);
    R.push('  ' + String(dep).padStart(7) + ' m down: ' + nm(m));
  }
  R.push('  dirt to ' + GEO_DIRT + ' m, rock to ' + (GEO_CORE*100) +
         '% of the radius, then lava ' +
         (geoMat(cx,b.y-b.R*0.3,cz)===S_LAVA ? 'ok, THERE IS A CORE' : 'FAULT'));

  R.push('AND ABOVE: ' + [1, 100, 5000].map(h =>
    h + ' m up is ' + nm(geoMat(cx, b.y-(b.R+geoH(0)+h), cz))).join(', '));

  /* THE BODIES */
  R.push('BODIES: ' + BODIES.map(bb =>
    bb.n + ' R=' + (bb.R/1000).toFixed(0) + ' km g=' + bb.g.toFixed(1) +
    ' at ' + (Math.hypot(bb.x-cx, bb.y-b.y, bb.z-cz)/1000).toFixed(0) + ' km').join(' | '));
  const moon = BODIES[1];
  for(const f of [0.0, 0.5, 0.9, 0.98, 1.0]){
    const x = cx + (moon.x-cx)*f, y = b.y + (moon.y-b.y)*f, z = cz + (moon.z-cz)*f;
    const d = dominantBody(x,y,z);
    R.push('  ' + (f*100).toFixed(0) + '% of the way to the moon: ' + d.body.n +
           ' wins at ' + d.g.toFixed(3) + ' m/s2');
  }
  const atMoon = dominantBody(moon.x, moon.y - moon.R, moon.z);
  R.push('  standing ON the moon: ' + atMoon.body.n + ' pulls ' + atMoon.g.toFixed(2) +
         ' m/s2 ' + (atMoon.body.n==='moon'
           ? 'ok, YOU COULD LAND ON IT' : 'FAULT: the planet still owns you there'));
  R.push('  orbit around the moon: ' + (orbitalV(0, moon)/1000).toFixed(2) +
         ' km/s, around the planet: ' + (orbitalV(0)/1000).toFixed(2) + ' km/s');
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
