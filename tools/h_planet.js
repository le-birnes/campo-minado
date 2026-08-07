/* IS THERE A PLANET NOW?

   The sea was a colour below a line, so from five hundred metres up the world
   was a square of blocks on a flat wash and nothing ever got smaller. It is a
   sphere of 600 km now and the ray is intersected with it, so this asks the
   two questions that follow: does the shader still COMPILE, and does the
   horizon move when you climb? Prefixed pl. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  R.push('sky program links: ' + (pSky ? 'yes' : 'NO') +
         ' | uR ' + (uS.R ? 'bound' : 'NOT BOUND') +
         ' | uH ' + (uS.H ? 'bound' : 'NOT BOUND'));
  R.push('planet radius ' + (PLANET_R/1000) + ' km');
  /* the horizon distance is sqrt(2*R*h), and it is the number that says
     whether climbing means anything */
  for(const h of [2, 50, 500, 5000, 45000]){
    const d = Math.sqrt(2*PLANET_R*h);
    R.push('  eye ' + h + ' m up: horizon ' + (d/1000).toFixed(1) + ' km, ' +
           'the planet fills ' + (Math.asin(PLANET_R/(PLANET_R+h))*2*180/Math.PI).toFixed(1) + ' degrees');
  }
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.noWin=true; G.gravK=-1; rollReset(); revealIsland(); G.island=true;
  G.state='pause'; G.dirty=true; rebuildWorld();
  R.push('world built, sea at y ' + G.seaY + ', a run of frames follows');
  R.push(window.__err.length ? ('FAULT ' + window.__err.join(' | ')) : 'no errors, and the shader drew');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 400);
