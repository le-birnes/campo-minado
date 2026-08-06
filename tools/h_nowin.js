window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  /* the board fully flagged, which is the state the boss fight starts from */
  const n=G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  for(let i=0;i<n;i++) if(!G.mine[i] && G.st[i]===SOLID){ G.st[i]=AIR; G.revealed++; }
  bossBlows((G.nx/2)*BLOCK,(G.ny/2)*BLOCK,(G.nz/2)*BLOCK);
  R.push(`after the blast: noWin=${G.noWin}, state=${G.state}`);
  /* hammer checkWin from every angle: this is what was winning the game */
  for(let k=0;k<40;k++) checkWin();
  R.push(`40 x checkWin(): state=${G.state} win=${!!G.win} ${G.state==='play'?'ok':'FAULT: it ended'}`);
  for(let k=0;k<1200 && !G.island;k++) frame(performance.now()+k*16.7);
  for(let k=0;k<40;k++) checkWin();
  R.push(`on the island, 40 more: state=${G.state} win=${!!G.win} island=${!!G.island} `+
         `${G.state==='play'?'ok':'FAULT: it ended'}`);
  /* and a fresh game must clear it */
  genWorld(0);
  R.push(`new game clears it: noWin=${G.noWin} island=${G.island} gravK=${G.gravK}`);
  R.push(window.__err.length?('FAULT '+window.__err.join(' | ')):'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 400);
