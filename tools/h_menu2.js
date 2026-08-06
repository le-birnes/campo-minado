/* THE WAY IN MUST EXIST ON EVERY PATH THROUGH THE MENU. It did not: the start
   button was inside #customBox, which is display:none unless Custom is the
   chosen difficulty, so four of the five ways to arrive at the menu had no
   button and the game could not be entered at all. A screenshot of one state
   would not have caught it either - Custom looks fine.

   So this walks every mode and every difficulty and asks the LAYOUT, not the
   markup: offsetParent is null for anything display:none anywhere up its
   ancestors, which is exactly the failure. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], go=document.getElementById('btnStart');
  const shown = el => !!(el && el.offsetParent !== null && el.getBoundingClientRect().height > 0);

  R.push(`fresh menu, nothing picked: button ${shown(go)?'shown':'HIDDEN'} disabled ${go.disabled}`);

  let bad = [];
  for(const m of [MODE_SWEEP, MODE_DUNGEON]){
    const mb = document.querySelector(`.diffs [data-m="${m}"]`);
    mb.click();
    for(const d of [0,1,2,3]){
      const db = document.querySelector(`.diffs [data-d="${d}"]`);
      if(!db || db.disabled || db.offsetParent === null) continue;
      db.click();
      const name = (m===MODE_DUNGEON?'dungeon':'sweep') + '/' + (DIFFS[d]?DIFFS[d].name:d);
      if(!shown(go) || go.disabled) bad.push(name + (shown(go)?' disabled':' HIDDEN'));
    }
  }
  R.push(`every mode x difficulty: ${bad.length ? 'FAULT ' + bad.join(', ') : 'the way in is there, all of them'}`);

  /* and it has to actually start */
  document.querySelector('.diffs [data-m="0"]').click();
  document.querySelector('.diffs [data-d="0"]').click();
  go.click();
  R.push(`clicked it: state=${G.state} cells=${G.nx}x${G.ny}x${G.nz} grid=${SAND?SAND.W+'x'+SAND.H+'x'+SAND.D:'NONE'}`);
  R.push(G.state==='play' ? 'ok' : 'FAULT: did not start');

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 400);
