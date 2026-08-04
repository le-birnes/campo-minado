/* Three things the creatures were asked for:
     - they carry their own light, one block out
     - what they fire is matter, not a flying ball of light
     - and the player's buckshot travels faster

   Lights are checked by reading lightBuf/lightCBuf, which is the very array
   uploaded to the shader: xyz + outer radius, and rgb*peak + inner radius in
   the colour buffer. If a creature is in there with the right radii then the
   fragment shader is lighting the room with it, no screenshot required. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    G.mode = MODE_DUNGEON; G.diff = 0;
    startGame(); seed = 4242; genWorld(0);
    G.state='play'; try{ setScreen('play'); }catch(e){}
    try{ hurtPlayer = function(){}; }catch(e){}
    enemies.length = 0; eshots.length = 0;

    /* --- the buckshot got quicker --- */
    R.push('pellet speed ' + PEL_SPD + ' m/s — 10 m in ' +
           (1000*10/PEL_SPD).toFixed(0) + ' ms (was ' + (1000*10/44).toFixed(0) + ')');

    /* --- a creature lights the room around it --- */
    const ex = P.x + 3, ey = P.y + EYE, ez = P.z;
    enemies.push({x:ex, y:ey, z:ez, t:0, state:'live', hp:3});
    const n = collectLights(P.x, P.y+EYE, P.z);
    let found = -1;
    for(let i=0;i<n;i++){
      const o=i*4;
      if(Math.hypot(lightBuf[o]-ex, lightBuf[o+1]-ey, lightBuf[o+2]-ez) < 0.01){ found=i; break; }
    }
    if(found < 0) R.push('THE CREATURE CASTS NO LIGHT (' + n + ' lights this frame)');
    else {
      const o = found*4;
      R.push('creature light: full to ' + (lightCBuf[o+3]/BLOCK).toFixed(2) +
             ' blocks, tail to ' + (lightBuf[o+3]/BLOCK).toFixed(2) +
             ', peak ' + Math.max(lightCBuf[o],lightCBuf[o+1],lightCBuf[o+2]).toFixed(2) +
             ' — ' + n + ' lights this frame');
      /* And it must actually reach: sample the shared falloff a block away. */
      const out=[0,0,0];
      const near = lightAt(ex+BLOCK*0.9, ey, ez, out);
      const far  = lightAt(ex+BLOCK*2.2, ey, ez, out);
      R.push('lit 0.9 blocks off: ' + near.toFixed(3) +
             ' | 2.2 blocks off: ' + far.toFixed(3) +
             (near > 0.05 && far < 0.02 ? ' — reaches one block and stops'
                                        : ' — WRONG SHAPE'));
    }

    /* --- what it throws --- */
    const e = enemies[0];
    e.aim = [P.x, P.y+EYE, P.z]; e.cool = 0; e.lock = 0;
    const before = particles.length;
    enemyFire(e);
    if(!eshots.length) R.push('NOTHING WAS FIRED');
    else {
      const sh = eshots[0];
      R.push('projectile carries ' + (sh.bits ? sh.bits.length : 0) +
             ' voxels' + (sh.bits && sh.bits.length >= 1
               ? ' — matter, not a bead of light' : ' — STILL A BALL'));
      /* The trail sheds cubes as it TRAVELS, so it has to be given something
         to travel through. Aimed at a player three metres away it connects on
         the first step and is gone before it can shed anything — which reads
         as "no trail" and is really "no flight". */
      hitsPlayer = function(){ return false; };
      isSolidCell = function(){ return false; };
      for(let k=0;k<25 && eshots.length;k++) updateEShots(1/60);
      const shed = particles.length - before;
      R.push('trail shed ' + shed + ' particles over a quarter second' +
             (shed > 0 ? '' : ' — NO TRAIL'));
    }
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message+' @ '+(err.stack||'').split('\n')[1]; }
}, 250);
