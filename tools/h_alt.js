/* THE ALTIMETER, READ OFF THE HUD RATHER THAN OFF THE MATHS

   Marcelo: "Add to the HUD an altimeter (just the number, no need for box, on
   the corner next to life) when player goes 500m above sea level."

   Four things have to be true and only the first is arithmetic:

     1. it says the right height, under BOTH gravity signs, because down is a
        sign in this game and every altitude bug so far has been that
     2. it is not there at 499 m and is there at 501
     3. it never appears in the 3D sweeper, where there is no sky to be high in
     4. and it is readable at the top of the long shot, which is 26 km up

   So it asks the DOM what it says, not the code what it would say. Prefixed
   al. Needs --render or --shot: updateHUD only runs from frame().            */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
(function(){
  const R=[];
  const alEl = () => document.getElementById('sAlt');
  const alTxt = () => (alEl().textContent||'').replace(/\s+/g,'');
  const alOn  = () => alEl().classList.contains('on') &&
                      getComputedStyle(alEl()).display !== 'none';
  /* put him h metres over the sea, whichever way up the world is */
  const alPut = h => { P.y = G.seaY*BLOCK + gsign()*h; P.vx=P.vy=P.vz=0; };

  const jobs=[];
  const stage=(name,set,read)=>jobs.push({name,set,read});

  /* ---- 1. THE THRESHOLD, and it is his number ------------------------- */
  stage('threshold', ()=>{}, ()=>{
    const rows=[];
    for(const h of [0, 120, 499, 501, 900]){
      alPut(h); updateHUD();
      rows.push(h + 'm:' + (alOn() ? alTxt() : 'hidden'));
    }
    R.push('CLIMBING PAST 500: ' + rows.join(' | '));
    alPut(499); updateHUD(); const lo = alOn();
    alPut(501); updateHUD(); const hi = alOn();
    R.push('  ' + (!lo && hi ? 'ok, OFF AT 499 AND ON AT 501'
                             : 'FAULT: 499 shows ' + lo + ', 501 shows ' + hi));
  });

  /* ---- 2. IT AGREES WITH THE SKY ---------------------------------------
     The shader is handed a height by the same expression. If those two ever
     disagree the HUD is lying about the world it is drawn over. */
  stage('agrees', ()=>{}, ()=>{
    const rows=[];
    for(const h of [800, 5000, 26000]){
      alPut(h); updateHUD();
      const sky = Math.max(0.5, (G.seaY*BLOCK - eyeY()) * -gsign());
      const shown = parseFloat(alTxt()) * (/km/.test(alTxt()) ? 1000 : 1);
      rows.push(h + 'm -> HUD ' + alTxt() + ', sky ' + sky.toFixed(0) +
                (Math.abs(shown - h) < Math.max(60, h*0.006) &&
                 Math.abs(sky - h) < 3 ? ' ok' : ' FAULT'));
    }
    R.push('THE HUD AND THE SKY MEASURE THE SAME HEIGHT: ' + rows.join(' | '));
  });

  /* ---- 3. METRES, THEN KILOMETRES -------------------------------------- */
  stage('units', ()=>{}, ()=>{
    const rows=[];
    for(const h of [9500, 10500, 26000, 101209]){
      alPut(h); updateHUD(); rows.push(h + '->' + alTxt());
    }
    R.push('UNITS: ' + rows.join(' | '));
    alPut(9500);  updateHUD(); const a=alTxt();
    alPut(10500); updateHUD(); const b=alTxt();
    R.push('  ' + (/m$/.test(a) && /km$/.test(b)
      ? 'ok, metres below ten kilometres and kilometres above it'
      : 'FAULT: ' + a + ' then ' + b));
    alPut(26000); updateHUD();
    R.push('  at the top of the long shot it reads ' + alTxt() + ' ' +
           (alTxt().replace(/[^\d]/g,'').length <= 3
            ? 'ok, a number you can read at a glance'
            : 'FAULT: too many digits to read'));
  });

  /* ---- 4. UPSIDE DOWN --------------------------------------------------
     After the boss, up is the other way. Every altitude bug in this project
     has been a sign, so this is not a formality. */
  stage('flipped', ()=>{ G.gravK = -G.gravK; rollReset(); ROLL_T=0; }, ()=>{
    const rows=[];
    for(const h of [200, 1500]){ alPut(h); updateHUD();
      rows.push(h + 'm:' + (alOn()?alTxt():'hidden')); }
    /* and BELOW the sea it must say nothing at all, not a big negative */
    alPut(-3000); updateHUD();
    const deep = alOn();
    R.push('WITH GRAVITY THE OTHER WAY UP (down is ' +
           (gsign()>0?'-Y':'+Y') + '): ' + rows.join(' | ') +
           ' | 3 km UNDER the sea: ' + (deep?alTxt():'hidden'));
    alPut(1500); updateHUD();
    R.push('  ' + (alOn() && Math.abs(parseFloat(alTxt())-1500) < 20 && !deep
      ? 'ok, IT COUNTS THE RIGHT WAY UP AND STAYS QUIET UNDERGROUND'
      : 'FAULT: the sign is wrong somewhere'));
  });

  /* ---- 5. AND NOT IN THE SWEEPER --------------------------------------- */
  stage('sweeper', ()=>{
    G.mode=MODE_SWEEP; seed=5; genWorld(0); G.state='pause';
  }, ()=>{
    alPut(4000); updateHUD();
    R.push('3D MINESWEEPER, four kilometres up in a floating puzzle: ' +
           (alOn() ? 'FAULT: it shows ' + alTxt()
                   : 'ok, nothing - there is no sky to be high in'));
  });

  let i=0, wait=0;
  function tick(){
    if(i >= jobs.length){
      /* and leave it somewhere worth photographing: the HUD is hidden until a
         game is STARTED, which a harness never does, so it is turned on here
         by hand. --shot only, and it costs the run nothing. */
      G.mode=MODE_WORLD; seed=5; genWorld(0); G.state='pause';
      alPut(parseFloat((location.search.match(/alt=(\d+)/)||[])[1] || 900));
      P.pitch = -gsign()*0.55; P.yaw = 0;
      updateHUD();
      document.getElementById('hud').classList.add('on');
      document.querySelectorAll('.screen').forEach(e=>e.classList.remove('on'));
      R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
      document.body.dataset.r = R.join(' ~ ');
      return;
    }
    const j = jobs[i];
    if(wait === 0){ document.body.dataset.r='STAGE '+j.name; j.set(); }
    wait++;
    if(wait >= 3){
      try{ j.read(); }catch(err){ R.push('THREW in '+j.name+': '+err.message); }
      i++; wait=0;
    }
    requestAnimationFrame(tick);
  }
  setTimeout(()=>{ try{
    G.muted=true; try{ snd.setMute(true); }catch(e){}
    G.mode=MODE_WORLD; seed=5; genWorld(0);
    G.state='pause'; G.noWin=true;
    requestAnimationFrame(tick);
  }catch(err){ document.body.dataset.r='THREW at setup: '+err.message+
    ' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
})();
