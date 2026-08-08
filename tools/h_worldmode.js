/* WORLD MODE, AND THE LONG SHOT.

   "A game mode where we start at the house with materials above the dungeon.
   The dungeon exists and if the player breaches its shell and enters,
   everything will be there and the HUD will display the minecount - so it's
   actually all the same, but a way we can start outside already."

   And: "hold the shoot button for 10 seconds and the next shot will propel me
   backwards with enough energy to lift me at least 20,000 metres, considering
   a shot perfectly aimed towards the gravity centre."

   So: is it the same world, does he start outside it, is the dungeon still
   sealed and still full of mines - and does the shot reach twenty kilometres?
   Prefixed wm. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];

  G.mode=MODE_WORLD; seed=5; genWorld(0); G.state='play';
  const px=Math.floor(P.x/BLOCK), py=Math.floor(P.y/BLOCK), pz=Math.floor(P.z/BLOCK);
  R.push('WORLD MODE: starts at ' + px+','+py+','+pz +
         ', beach y ' + G.rock0 + ', waterline ' + G.seaY +
         ' | island ' + (G.island?'open':'NOT OPEN') +
         ' | gravity ' + (gsign()<0 ? 'the right way up' : 'REVERSED'));
  R.push('  above his head: ' +
         (G.st[idx(px, py-1, pz)]===AIR ? 'open sky ok' : 'A CEILING - FAULT') +
         ' | under his feet: ' +
         (G.st[idx(px, py+1, pz)]!==AIR ? 'solid ground ok' : 'NOTHING - FAULT'));
  R.push('  and the dungeon is still there: ' + G.mines + ' mines, ' +
         (G.hull ? G.hull.reduce((a,b)=>a+b,0) : 0) + ' blocks of unbreakable shell ' +
         (G.mines > 20 ? 'ok, IT IS THE SAME WORLD' : 'FAULT: the dungeon is gone'));

  /* it must be SEALED - starting outside must not mean the sea is already in */
  let dry = 0, wet = 0;
  const L = G.lump;
  if(L) for(let y=L.y0;y<=L.y1;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    if(Math.hypot(x-L.cx,z-L.cz) > L.r) continue;
    const i=idx(x,y,z);
    if(G.st[i]!==AIR) continue;
    if(G.seaB && G.seaB.indexOf(i)>=0) wet++; else dry++;
  }
  R.push('  the dungeon below him: ' + dry + ' dry air blocks, ' + wet + ' flooded ' +
         (dry > 100 && wet === 0 ? 'ok, STILL SEALED - he has to breach it'
                                 : 'FAULT: it is already open'));

  /* ---- THE LONG SHOT --------------------------------------------------- */
  const b = bodyPlanet();
  const need = h => Math.sqrt(2*b.g*b.R*b.R*(1/b.R - 1/(b.R+h)));
  R.push('THE LONG SHOT: ' + LONG_V + ' m/s, and reaching 20 km needs ' +
         need(20000).toFixed(0) + ' m/s ' +
         (LONG_V >= need(20000) ? 'ok, IT CLEARS TWENTY KILOMETRES' : 'FAULT: too weak'));
  /* how high does it actually get? straight up, no drag, real falloff */
  {
    P.x=(G.nx*0.5)*BLOCK; P.z=(G.nz*0.5)*BLOCK; P.y=(G.rock0-1)*BLOCK;
    P.vx=P.vz=0; P.vy = LONG_V*gsign();     // his up
    const y0 = P.y; let best = 0;
    for(let t=0;t<60*90;t++){
      const gv = gravAt(P.x, P.y, P.z);
      P.vy += gv[1]*(1/60); P.y += P.vy*(1/60);
      const up = (P.y-y0)*gsign();
      if(up > best) best = up;
      if(up < best - 100) break;            // coming back down
    }
    R.push('  fired straight at the gravity centre it rises ' + (best/1000).toFixed(1) +
           ' km ' + (best >= 20000 ? 'ok, TWENTY THOUSAND METRES AND MORE' : 'FAULT'));
  }
  /* it must not exist in the dungeon, nor before the world opens */
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  IN.fireHeld = true; IN.hold = 0; P.longReady = false;
  for(let t=0;t<60*12;t++) logSample(1/60);
  R.push('  charging for twelve seconds INSIDE the dungeon: ' +
         (P.longReady ? 'ARMED - FAULT, it is the way out, not a tool'
                      : 'not armed ok, it only exists once the world is open'));
  IN.fireHeld = false;
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
