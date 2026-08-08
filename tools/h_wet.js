/* WET, AND WHY IT IS NOT THE SAME AS STANDING IN WATER

   Marcelo: "Make player wet-able so he won't be on fire (or cancel burning
   status)."

   The old rule was `P.imm > 0.25 && SM_DOUSE[P.subM]` inside the burning
   branch: water put you out WHILE YOU WERE IN IT, so you could walk out of the
   sea still alight. Wet is a state you carry, which is the whole point.

   Five questions:
     1. does the sea make him wet, and does it last after he leaves
     2. does being wet CANCEL burning
     3. does being wet STOP him catching in the first place
     4. does fire spend the water - so it is a resource, not an immunity
     5. and does he burn normally once he is dry

   Prefixed we.                                                              */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_WORLD; seed=5; genWorld(0); G.state='play'; G.noWin=true;
  const F = P.fx;
  const wet = () => F[FX_WET], fire = () => F[FX_FIRE];
  /* dry land in the middle of the island, and the sea a few hundred metres out */
  const weDry = () => { P.x=(G.nx*0.5)*BLOCK; P.z=(G.nz*0.5)*BLOCK;
                        P.imm=0; P.subM=0; P.matFx=0; P.matDmg=0; };
  const weSea = () => { P.imm=1; P.subM=S_WATER; P.matFx=0; P.matDmg=0; };
  const weFire= () => { P.imm=0; P.subM=0; P.matFx=FX_FIRE; };
  const run = (n, set) => { for(let i=0;i<n;i++){ set(); tickBody(1/60); } };

  /* ---- 1. THE SEA MAKES HIM WET, AND IT LASTS --------------------------- */
  F.fill(0); weDry();
  run(30, weSea);
  const w0 = wet();
  run(60*4, weDry);                       // four seconds out of the water
  const w1 = wet();
  run(60*10, weDry);                      // and ten more
  const w2 = wet();
  R.push('OUT OF THE SEA: wet ' + w0.toFixed(1) + ' s, ' + w1.toFixed(1) +
         ' s four seconds later, ' + w2.toFixed(1) + ' s after fourteen ' +
         (w0 > 10 && w1 > 6 && w2 === 0
          ? 'ok, HE CARRIES IT OUT OF THE WATER AND IT DRIES'
          : 'FAULT'));

  /* ---- 2. WET CANCELS BURNING ------------------------------------------- */
  F.fill(0); weDry();
  F[FX_FIRE] = FX_DUR[FX_FIRE];
  const hp0 = P.hp;
  run(30, weDry);
  const burnedDry = hp0 - P.hp;
  R.push('ALIGHT AND DRY for half a second: fire ' + fire().toFixed(1) +
         ' s left, ' + burnedDry.toFixed(1) + ' hp gone ' +
         (fire() > 0 && burnedDry > 2 ? 'ok, it burns' : 'FAULT: it does not'));
  P.hp = P.hpMax;
  F[FX_WET] = FX_DUR[FX_WET];
  tickBody(1/60);
  R.push('  then one frame WET: fire ' + fire().toFixed(1) + ' s ' +
         (fire() === 0 ? 'ok, THE BURNING IS CANCELLED' : 'FAULT: still alight'));

  /* ---- 3. AND HE CANNOT CATCH WHILE HE IS WET --------------------------- */
  F.fill(0); weDry(); F[FX_WET] = FX_DUR[FX_WET];
  P.hp = P.hpMax;
  run(60, weFire);                        // a whole second standing in flames
  R.push('A SECOND IN THE FLAMES WHILE WET: on fire ' + fire().toFixed(2) +
         ', hp ' + P.hp.toFixed(0) + '/' + P.hpMax.toFixed(0) + ' ' +
         (fire() === 0 ? 'ok, HE DOES NOT CATCH' : 'FAULT: he caught'));

  /* ---- 4. BUT THE FIRE SPENDS THE WATER --------------------------------- */
  {
    F.fill(0); weDry(); F[FX_WET] = FX_DUR[FX_WET];
    const before = wet();
    run(60, weFire);
    const after = wet();
    const spent = before - after;
    R.push('AND IT COSTS HIM THE WATER: ' + before.toFixed(1) + ' s -> ' +
           after.toFixed(1) + ' s in one second of fire (' + spent.toFixed(1) +
           ' s spent, WET_BURN is ' + WET_BURN + ' plus the ordinary second) ' +
           (spent > 3 && spent < 6
            ? 'ok, A RESOURCE AND NOT AN IMMUNITY' : 'FAULT: spent ' + spent.toFixed(1)));
    /* how long a full dunk actually buys you in a fire */
    F.fill(0); weDry(); F[FX_WET] = FX_DUR[FX_WET];
    let t=0; while(wet() > 0 && t < 60*30){ weFire(); tickBody(1/60); t++; }
    R.push('  a full dunk buys ' + (t/60).toFixed(1) +
           ' seconds of standing in fire before it runs out');
  }

  /* ---- 5. AND ONCE HE IS DRY HE BURNS ----------------------------------- */
  F.fill(0); weDry(); P.hp = P.hpMax;
  run(60, weFire);
  R.push('DRY, A SECOND IN THE SAME FLAMES: on fire ' + fire().toFixed(1) +
         ' s, hp ' + P.hp.toFixed(0) + '/' + P.hpMax.toFixed(0) + ' ' +
         (fire() > 0 && P.hp < P.hpMax
          ? 'ok, FIRE IS STILL FIRE' : 'FAULT: nothing happened'));

  /* ---- and the status has a name, so the HUD can say it ----------------- */
  R.push('the toast calls it "' + FX_NAME[FX_WET] + '", ' + FX_DUR[FX_WET] +
         ' s a touch, slot ' + FX_WET + ' of ' + FX_N + ' ' +
         (FX_NAME[FX_WET] === 'WET' && FX_NAME.length === FX_N &&
          FX_DUR.length === FX_N ? 'ok, the tables are the same length'
                                 : 'FAULT: FX_NAME/FX_DUR/FX_N disagree'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
