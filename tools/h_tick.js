window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
const note=t=>{ try{ document.body.dataset.r=t; }catch(e){} };
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[]; const DT=1/30;
  note('a: before genWorld');
  G.mode=MODE_DUNGEON; seed=20000; genWorld(0); G.state='play';
  R.push('genWorld ok '+G.nx+'x'+G.ny+'x'+G.nz+' boss '+G.boss);
  note('b: generated');

  let t=Date.now();
  for(let k=0;k<200;k++){ updateJump(DT); physics(DT); tickGround(DT); }
  R.push('200 physics ticks: '+(Date.now()-t)+' ms');
  note('c: physics ok');

  t=Date.now();
  for(let k=0;k<200;k++){ tGlobal+=DT; updateEnemies(DT); }
  R.push('200 enemy ticks (none alive): '+(Date.now()-t)+' ms');
  note('d: enemies ok');

  // the clue scan the bot does every step
  t=Date.now();
  const n=G.nx*G.ny*G.nz;
  let clues=0;
  for(let k=0;k<5;k++)
    for(let i=0;i<n;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      for(const j of nbrsOf(i)) if(G.st[j]===SOLID) clues++;
    }
  R.push('5 full clue scans: '+(Date.now()-t)+' ms ('+clues+' hits)');
  note('e: scan ok');

  // a walk: the thing that costs the most
  t=Date.now();
  IN.f=1;
  for(let k=0;k<600;k++){ updateJump(DT); physics(DT); tickGround(DT); }
  IN.f=0;
  R.push('600 walking ticks: '+(Date.now()-t)+' ms, player at '+P.x.toFixed(1)+','+P.y.toFixed(1)+','+P.z.toFixed(1));
  note('f: walk ok');

  // one render, which in software GL is the expensive part
  t=Date.now(); rebuildWorld();
  R.push('rebuildWorld: '+(Date.now()-t)+' ms, '+worldB.count+' cubes');

  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 600);
