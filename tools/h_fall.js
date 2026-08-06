window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  /* A SHAFT: clear a tall column so grains burst at the top have a long way to
     fall and one obvious place to end up. If they stop in mid-air here, they
     are stopping on each other. */
  const cx=(G.nx/2)|0, cz=(G.nz/2)|0;
  for(let y=0;y<G.ny;y++){
    const i=idx(cx,y,cz);
    if(inside(cx,y,cz) && G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
  }
  const topY = G.ny-1;
  const floorY = 0;
  RAW.n=0; RAW.occ.clear();
  rawBurst(cx, topY, cz, 0,0,1, 150, 0);
  const spawnY = RAW.y[0];
  for(let k=0;k<1200;k++){ rawStep(1/60); if(k>10 && RAW.moving===0) break; }
  let lo=1e9, hi=-1e9, above=0;
  for(let i=0;i<RAW.n;i++){
    lo=Math.min(lo,RAW.y[i]); hi=Math.max(hi,RAW.y[i]);
    if(RAW.y[i] > BLOCK*2) above++;
  }
  R.push(`burst at y=${(topY*BLOCK).toFixed(1)}m in an empty shaft`);
  R.push(`landed between ${lo.toFixed(2)} and ${hi.toFixed(2)} m`);
  R.push(`${above} of ${RAW.n} stopped ABOVE 2 blocks up ${above>RAW.n*0.5?'FAULT: they are hanging':'ok'}`);
  R.push(`pile height ${(hi-lo).toFixed(2)} m ${hi-lo>0.3?'(it is a heap)':'(flat layer)'}`);
  /* THE GHOST TEST: burst far more than the cap, recycling slots many times
     over, then drop a fresh handful down the same shaft. If recycled grains
     leave their occupancy claims behind, these land on nothing and hang. */
  for(let b=0;b<14;b++){ rawBurst(cx, topY, cz, 0,0,1, 150, 0);
    for(let k=0;k<400;k++){ rawStep(1/60); if(k>5&&RAW.moving===0) break; } }
  R.push(`after ${RAW.n} grains (cap ${RAW_MAX}), occ holds ${RAW.occ.size} `+
         `${RAW.occ.size<=RAW_MAX?'ok':'FAULT: '+(RAW.occ.size-RAW_MAX)+' ghosts'}`);
  let hang=0;
  for(let i=0;i<RAW.n;i++) if(RAW.rest[i] && RAW.y[i] > BLOCK*3) hang++;
  R.push(`${hang} grains resting above 3 blocks ${hang===0?'ok':'FAULT: hanging'}`);
  R.push(window.__err.length?('FAULT '+window.__err.join(' | ')):'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
