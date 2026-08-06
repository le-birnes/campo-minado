window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];

  /* Shift+H is insta_dungeon_solve, and what has to be true of it:
       - it plays real moves, so revealed+marked must climb
       - it STOPS ONE SHORT, so it must never fire the finale
       - it must terminate, and quickly, on every mode it can be pressed in
       - pressing it twice must be safe: the second call finds nothing left
     Apprentice first, because 300 cells shows all of that in a fiftieth of the
     work; then the dungeon, because that is what it is for. */

  function trial(label, mode, diff){
    G.mode = mode; seed = 5; genWorld(diff); G.state='play';
    const before = {rev:G.revealed, mk:G.marked, safe:G.safeTotal, mines:G.mines};
    const t0 = performance.now();
    insta_dungeon_solve();
    const ms = performance.now()-t0;
    const safeLeft = G.safeTotal-G.revealed, mineLeft = G.mines-G.marked;
    /* the second press: it must be harmless and must not run away */
    const t1 = performance.now();
    insta_dungeon_solve();
    const ms2 = performance.now()-t1;
    const moved2 = (G.revealed-(before.rev+ (G.revealed-before.rev)));
    R.push(`${label}: opened ${G.revealed-before.rev}/${before.safe-before.rev} `+
           `flagged ${G.marked-before.mk}/${before.mines-before.mk} in ${ms.toFixed(0)}ms`+
           ` | left ${safeLeft} safe ${mineLeft} mines`+
           ` | state ${G.state}${G.win?' WON':''}`+
           ` | 2nd press ${ms2.toFixed(0)}ms`);
    return {safeLeft, mineLeft, state:G.state, win:!!G.win, ms};
  }

  const ap = trial('Apprentice', MODE_SWEEP, 0);
  const dg = trial('Dungeon   ', MODE_DUNGEON, 0);

  /* THE ONE THING THAT MUST NOT HAPPEN: it finishes the game for you. The
     whole point is to be left standing in front of the boss, not past it. */
  const fired = [];
  if (ap.win || ap.state!=='play') fired.push('Apprentice ended');
  if (dg.win || dg.state!=='play') fired.push('Dungeon ended');
  R.push(fired.length ? 'FAULT: it ran past the finale — '+fired.join(', ')
                      : 'stopped short on both, as intended');

  /* and it has to be FAST, or it is not a shortcut */
  const slow = [ap,dg].filter(x=>x.ms>4000);
  R.push(slow.length ? `FAULT: ${slow.length} run(s) over 4 s` : 'both under 4 s');

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r = 'THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 300);
