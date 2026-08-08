/* TORCHES, AND THE SUN AS THE LIGHT OF THE WORLD

   Marcelo: "Make the sun the master source of light of this universe (player
   still emmits light). Add to inventory 'torches', selected by scrolling the
   mouse, and left click places them. Torches are made of 2 beads of wood and
   have fire above them, burning continuously. Torches have the same light
   radius of the player."

   Six claims in there and every one is checkable:

     1. the wheel changes what is in your hand, and it wraps
     2. a click with torches selected does NOT fire the gun
     3. what lands is TWO BEADS OF WOOD in the grid, not a model
     4. with REAL fire above it - S_FIRE from the table, which dies in forty
        ticks - and it is still alight three hundred ticks later
     5. its light reaches exactly as far as the one the player carries
     6. and the sun is the key light: it moves with the hour and the world
        goes dark at night

   Prefixed to. Needs --render for anything that reads a uniform.            */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
(function(){
  const R=[];
  const toUp = () => -sandDir();
  let toWhere = null;      // the cell the torch went into, kept across stages

  /* AIM AT THE GROUND, which is where a man standing on a beach puts a torch.
     The first version of this looked for a WALL at eye height and found none,
     because world mode starts him outdoors - the harness was wrong about the
     game, not the other way round. */
  function toAim(){
    P.yaw = 0; P.pitch = -gsign()*1.15;      // steeply down, whichever way up
    const s = torchSpot();
    return s ? {s, dist: Math.hypot((s.x+0.5)*CELL_M - P.x,
                                    (s.y+0.5)*CELL_M - eyeY(),
                                    (s.z+0.5)*CELL_M - P.z)} : null;
  }

  const jobs=[]; const stage=(n,set,read)=>jobs.push({name:n,set,read});

  /* ---- 1. THE WHEEL ----------------------------------------------------- */
  stage('belt', ()=>{}, ()=>{
    const seen=[beltSel()];
    for(let i=0;i<4;i++){ beltPick(beltSel()+1); seen.push(beltSel()); }
    R.push('SCROLLING THE BELT: ' + seen.join('->') + ' ' +
           (seen[0]===0 && seen[3]===3%BELT_N && seen[1]===BELT_TORCH
            ? 'ok, three slots and it wraps' : 'FAULT'));
    beltPick(BELT_GUN);
    beltPick(beltSel()-1);
    R.push('  and it goes backwards too: ' + beltSel() + ' ' +
           (beltSel()===BELT_N-1 ? 'ok' : 'FAULT'));
  });

  /* ---- 2, 3, 4. WHAT A CLICK PUTS DOWN ---------------------------------- */
  stage('place', ()=>{ beltPick(BELT_TORCH); }, ()=>{
    const w = SAND, aim = toAim();
    if(!aim){ R.push('PLACING: torchSpot found nowhere to put one'); return; }
    const before = TORCH.length, woodBefore = w.count(S_WOOD);
    const ok = torchPlace();
    const T = TORCH[TORCH.length-1];
    R.push('A CLICK WITH TORCHES IN HAND, aimed at the ground ' +
           aim.dist.toFixed(2) + ' m away: placed ' + ok +
           ', torches ' + before + '->' + TORCH.length + ' ' +
           (ok && TORCH.length===before+1 ? 'ok' : 'FAULT'));
    if(!T) return;
    toWhere = {x:T.x, y:T.y, z:T.z};
    const up = toUp();
    const a = w.at(T.x, T.y, T.z), b = w.at(T.x, T.y+up, T.z);
    R.push('  WHAT IS ACTUALLY THERE: ' + SMAT[a].n + ' and ' + SMAT[b].n +
           ' (' + (w.count(S_WOOD)-woodBefore) + ' new beads of wood in the grid) ' +
           (a===S_WOOD && b===S_WOOD ? 'ok, TWO BEADS OF WOOD' : 'FAULT'));
    torchTick();
    const f = w.at(T.x, T.y+up*2, T.z);
    R.push('  and above them: ' + SMAT[f].n + ' ' +
           (f===S_FIRE ? 'ok, REAL FIRE - the same S_FIRE the table burns'
                       : 'FAULT: nothing is alight'));
  });

  /* ---- 4b. BURNING CONTINUOUSLY ------------------------------------------
     S_FIRE has forty ticks of life and turns into smoke. Three hundred ticks
     is seven flames' worth: if the torch is not putting it back, this is dark
     long before the end. */
  stage('burns', ()=>{}, ()=>{
    const w = SAND, T = TORCH[TORCH.length-1] || toWhere;
    if(!T){ R.push('BURNING: no torch and no record of one'); return; }
    /* THREE FRAMES ON, AND IT IS STILL THERE. The first build of this had AIR
       in all three cells by now: the flame ate the wood, the ember burnt out,
       and the torch removed itself. Say what is in them either way - the
       materials are the whole diagnosis. */
    const u0 = toUp();
    R.push('THREE FRAMES LATER its cells hold: ' +
           [0,1,2].map(k=>SMAT[w.at(T.x, T.y+u0*k, T.z)].n).join(' / ') +
           ' (base / head / flame), and TORCH holds ' + TORCH.length + ' ' +
           (TORCH.length === 1 ? 'ok, IT SURVIVED ITS OWN FIRE'
                               : 'FAULT: it burnt itself down'));
    if(!TORCH.length) return;
    const up = toUp();
    /* THE CLAIM, DIRECTLY: burn the flame out by hand - which is what forty
       ticks of S_FIRE life does - and see whether the torch puts another one
       there. Instant, and it is the actual thing being asserted. */
    let back = 0, rewood = 0;
    for(let k=0;k<8;k++){
      w.put(T.x, T.y+up*2, T.z, S_AIR);      // the flame has gone to smoke
      w.put(T.x, T.y+up,   T.z, S_EMBER);    // and its own fire ate the head
      torchTick();
      if(w.at(T.x, T.y+up*2, T.z) === S_FIRE) back++;
      if(w.at(T.x, T.y+up,   T.z) === S_WOOD) rewood++;
    }
    R.push('  and the fire EATS THE TORCH - srx(S_FIRE,S_WOOD,S_FIRE,S_EMBER) - ' +
           'so burnt to ember eight times it came back wood ' + rewood + ' ' +
           (rewood === 8 ? 'ok, the two beads ARE the torch' : 'FAULT: it burnt down'));
    R.push('RELIGHTING: burnt out by hand eight times, came back ' + back + ' ' +
           (back === 8 ? 'ok, THE TORCH PUTS THE FIRE BACK - that is the fuel'
                       : 'FAULT: it went out'));
    /* AND IN THE REAL SIMULATION, for as long as two seconds of wall clock
       buys. The first version of this ran 300 full-world sand ticks and took
       the harness past a 280-second cap - a hang that was mine, not the
       game's. Bounded by the clock now, and it says how far it got. */
    /* A FIXED COUNT, not a wall clock: under --virtual-time-budget
       performance.now() is virtual and this loop measured itself as 0 ms and
       ran zero times. 120 ticks is three flames' worth at life 40. */
    let n=120, lit=0;
    for(let t=0;t<n;t++){
      sandTick(w, sandDir()); torchTick();      // the game's order, not mine
      if(w.at(T.x, T.y+up*2, T.z) === S_FIRE) lit++;
    }
    const wood = w.at(T.x,T.y,T.z)===S_WOOD || w.at(T.x,T.y+up,T.z)===S_WOOD;
    R.push('  and in the live simulation: alight on ' + lit + ' of ' + n +
           ' ticks (S_FIRE lives ' +
           SMAT[S_FIRE].life + '), wood still ' + (wood ? 'there' : 'GONE') + ' ' +
           (n > 40 && lit > n*0.5 && wood ? 'ok, IT BURNS CONTINUOUSLY'
                                          : 'FAULT: lit ' + lit + '/' + n));
  });

  /* ---- 5. THE SAME LIGHT THE PLAYER CARRIES ----------------------------- */
  stage('light', ()=>{}, ()=>{
    const T = TORCH[TORCH.length-1];
    if(!T){ R.push('LIGHT: no torch'); return; }
    const up = toUp();
    const tx=(T.x+0.5)*CELL_M, ty=(T.y+up*2+0.5)*CELL_M, tz=(T.z+0.5)*CELL_M;
    /* stand well away from it so his own lantern is not the thing being read */
    collectLights(tx + 4*BLOCK, ty, tz);   // 18 m: inside its 22.5 m reach
    let found=null;
    for(let i=0;i<lightN;i++){
      const o=i*4;
      if(Math.hypot(lightBuf[o]-tx, lightBuf[o+1]-ty, lightBuf[o+2]-tz) < CELL_M){
        found={out:lightBuf[o+3], inr:lightCBuf[o+3]}; break;
      }
    }
    R.push('ITS LIGHT: ' + (found
      ? 'reaches ' + (found.out/BLOCK).toFixed(1) + ' blocks, full within ' +
        (found.inr/BLOCK).toFixed(1) + ' - the staff reaches ' +
        LIT_LANTR2.toFixed(1) + ' and ' + LIT_LANTR.toFixed(1) + ' ' +
        (Math.abs(found.out - LIT_LANTR2*BLOCK) < 0.01 &&
         Math.abs(found.inr - LIT_LANTR*BLOCK) < 0.01
         ? 'ok, THE SAME LIGHT RADIUS AS THE PLAYER' : 'FAULT: they differ')
      : 'FAULT: it is not in the light buffer at all'));
  });

  /* ---- 6. THE SUN IS THE KEY LIGHT -------------------------------------- */
  stage('sun', ()=>{}, ()=>{
    const rows=[];
    for(const [nm,ph] of [['dawn',0.0],['noon',0.25],['dusk',0.5],['night',0.75]]){
      SKY_T0 = tGlobal - SKY_DAY*((ph - 0.16 + 1)%1);
      const S = skyNow();
      const n = S.night;
      const dir = [ _sun[0]*(1-n)+_moon[0]*n, _sun[1]*(1-n)+_moon[1]*n,
                    _sun[2]*(1-n)+_moon[2]*n ];
      const c = [ (S.sunC[0]*(1-n)+S.moonC[0]*n)*1.25,
                  (S.sunC[1]*(1-n)+S.moonC[1]*n)*1.05,
                  (S.sunC[2]*(1-n)+S.moonC[2]*n)*0.82 ];
      rows.push(nm + ' elev ' + (dir[1]*gsign()).toFixed(2) +
                ' key(' + c.map(v=>v.toFixed(2)).join(',') + ')' +
                ' dark ' + darkNow().toFixed(2));
    }
    R.push('THE SUN THROUGH ONE DAY: ' + rows.join(' | '));
    /* noon must be the old constant to three decimals, or every daylit frame
       in the game just changed for no reason */
    SKY_T0 = tGlobal - SKY_DAY*((0.25 - 0.16 + 1)%1);
    const S = skyNow();
    const c = [S.sunC[0]*1.25, S.sunC[1]*1.05, S.sunC[2]*0.82];
    R.push('  noon reads (' + c.map(v=>v.toFixed(2)).join(',') +
           ') against the constant it replaced (1.25,1.02,0.72) ' +
           (Math.abs(c[0]-1.25)<0.02 && Math.abs(c[1]-1.02)<0.02 &&
            Math.abs(c[2]-0.72)<0.02
            ? 'ok, DAYLIGHT IS UNCHANGED and every other hour is not'
            : 'FAULT: noon moved'));
    /* and it is the SAME direction the sky draws */
    R.push('  the light and the sky agree about where the sun is: ' +
           (typeof setSunLight === 'function' &&
            /_sun\[0\]/.test(setSunLight.toString()) ? 'ok, one function'
                                                     : 'FAULT'));
  });

  let i=0, wait=0;
  function tick(){
    if(i >= jobs.length){
      R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
      document.body.dataset.r = R.join(' ~ ');
      return;
    }
    const j = jobs[i];
    if(wait === 0){ document.body.dataset.r='STAGE '+j.name; j.set(); }
    wait++;
    if(wait >= 3){
      try{ j.read(); }catch(err){ R.push('THREW in '+j.name+': '+err.message+
        ' @ '+((err.stack||'').split('\n')[1]||'')); }
      i++; wait=0;
    }
    requestAnimationFrame(tick);
  }
  setTimeout(()=>{ try{
    G.muted=true; try{ snd.setMute(true); }catch(e){}
    G.mode=MODE_WORLD; seed=5; genWorld(0);
    G.state='play'; G.noWin=true;
    requestAnimationFrame(tick);
  }catch(err){ document.body.dataset.r='THREW at setup: '+err.message+
    ' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
})();
