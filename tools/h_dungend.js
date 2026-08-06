window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  /* THE REAL PATH, not bossBlows() called by hand. That is exactly the gap
     Marcelo hit: h_ending.js proved the sequence works and never proved that
     anything REACHES it. Complete a dungeon the way a player does and see
     what actually happens. */
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(!G.mine[i] && G.st[i]===SOLID){ G.st[i]=AIR; G.revealed++; }
  checkWin();
  R.push(`board dug out: state=${G.state} finale=${!!G.finale} noWin=${!!G.noWin} `+
         `foes=${enemies.length} emerge=${(G.emerge||0).toFixed(1)}`);
  R.push(`no win screen: ${G.state==='play' ? 'ok' : 'FAULT it ended'}`);
  /* the boss is gone - however it went. killEnemy needs a hit context this
     harness has no business faking, and what is being tested is what happens
     AFTER, which is where the win screen was leaking in. */
  enemies.length = 0;
  checkWin(); checkWin();
  R.push(`after the fight: state=${G.state} noWin=${!!G.noWin} emerge=${(G.emerge||0).toFixed(1)}`);
  for(let k=0;k<1200 && !G.island;k++) frame(performance.now()+k*16.7);
  R.push(`island=${!!G.island} state=${G.state} ${G.island && G.state==='play' ? 'ok' : 'FAULT'}`);
  for(let k=0;k<30;k++) checkWin();
  R.push(`still no screen after 30 more checkWin: ${G.state==='play'?'ok':'FAULT'}`);
  R.push(window.__err.length?('FAULT '+window.__err.join(' | ')):'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 400);
