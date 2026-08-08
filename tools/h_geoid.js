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
  for(const d of [0, 50, 90, 200, 400, 1000, 5000, 9000, 11000, 14000, 40000]){
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
  const gg = geoOf().isle;
  R.push('  so: island to ' + gg.r.toFixed(0) + ' m, beach to ' + gg.beach.toFixed(0) +
         ', a donut of sea ' + gg.seaD.toFixed(0) + ' m deep out to ' + (gg.seaR/1000).toFixed(1) +
         ' km, then plain dirt for ever ' +
         (geoH(0)>0 && geoH(5000)<0 && geoH(40000)>0
          ? 'ok, THE DONUT IS THERE' : 'FAULT: that is not a donut'));

  R.push('DOWN THROUGH THE CRUST, under the island:');
  for(const dep of [0, 10, 39, 41, 1000, 100000, 300000, 340000, 500000]){
    const m = geoMat(cx, b.y - (b.R + geoH(0) - dep), cz);
    R.push('  ' + String(dep).padStart(7) + ' m down: ' + nm(m));
  }
  R.push('  crust: ' + geoOf().layers.map(l=>SMAT[l.m].n+' '+l.d.toFixed(0)+'m').join(' > ') +
         ' > rock to ' + (geoOf().coreF*100).toFixed(0) + '% of the radius, then lava ' +
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

  /* ---- AND A DIFFERENT PLANET EVERY RUN -------------------------------- */
  R.push('FIVE RUNS, five worlds:');
  const seen = new Set();
  for(const sd of [1,2,3,4,5]){
    seed = sd; genWorld(0); worldBodies();
    const g = geoOf();
    const key = [g.isle.r|0, g.isle.seaR|0, g.isle.seaD|0, g.layers.length].join('/');
    seen.add(key);
    R.push('  seed ' + sd + ': island r=' + g.isle.r.toFixed(0) + ' m h=' + g.isle.h.toFixed(0) +
           ', sea out to ' + (g.isle.seaR/1000).toFixed(1) + ' km, ' + g.isle.seaD.toFixed(0) +
           ' m deep, mainland +' + g.isle.plain.toFixed(0) +
           ', core at ' + (g.coreF*100).toFixed(0) + '%' +
           ' | crust: ' + g.layers.map(l=>(SMAT[l.m].n)+' '+l.d.toFixed(0)+'m').join(' > ') + ' > rock > lava' +
           ' | moon r=' + (GEO_ROLL.moonR*100).toFixed(0) + '% at ' + GEO_ROLL.moonD.toFixed(0) + 'R');
  }
  R.push('  ' + seen.size + ' of 5 are different ' +
         (seen.size === 5 ? 'ok, EVERY RUN IS ITS OWN PLANET' : 'FAULT: they repeat'));
  /* and the SAME run must not move under him */
  seed = 3; genWorld(0);
  const h1 = geoH(500), m1 = geoMat(1000,1000,1000);
  for(let k=0;k<200;k++) geoMat(rnd()*1e6, rnd()*1e6, rnd()*1e6);
  R.push('  and within one run, after 200 samples: geoH(500) ' +
         (geoH(500)===h1 && geoMat(1000,1000,1000)===m1
          ? 'is unchanged ok, THE GROUND HOLDS STILL WHILE HE IS ON IT'
          : 'MOVED - FAULT'));

  /* ---- AND IT IS ONE FUNCTION FOR EVERY BODY --------------------------- */
  seed = 7; genWorld(0); worldBodies();
  const pl = BODIES[0], mo = BODIES[1];
  R.push('ONE FUNCTION, TWO WORLDS:');
  for(const bb of BODIES){
    const rows = [];
    for(const dep of [-100, 1, 20, 200, 100000]){
      const rr = bb.R + bodyH(bb,0) - dep;
      rows.push((dep<0?('+'+(-dep)+' up'):(dep+' down')) + ' ' +
                nm(universeAt(bb.x, bb.y - rr, bb.z)));
    }
    R.push('  ' + bb.n.padEnd(7) + 'R=' + (bb.R/1000).toFixed(0) + ' km, g=' + bb.g.toFixed(1) +
           ', crust ' + bb.geo.layers.map(l=>SMAT[l.m].n).join('>') +
           ' | ' + rows.join(', '));
  }
  R.push('  the moon is solid and made of layers ' +
         (universeAt(mo.x, mo.y-mo.R+5, mo.z)!==S_AIR &&
          universeAt(mo.x, mo.y-mo.R-50, mo.z)===S_AIR
          ? 'ok, YOU COULD LAND ON IT AND DIG IT' : 'FAULT'));
  R.push('  and between them is space: ' +
         nm(universeAt(pl.x, pl.y - pl.R*3, pl.z)) + ' ' +
         (universeAt(pl.x, pl.y-pl.R*3, pl.z)===S_AIR ? 'ok' : 'FAULT'));
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
