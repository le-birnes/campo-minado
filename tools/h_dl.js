/* Does a SHRUNKEN dungeon generate at all?

   ?zones=1 on the bot page hangs before it takes a single step; ?dungeon,
   which is the same code without setDungeonLevels, finishes in a second. The
   only thing between them is DUNGEON.ny — 6 instead of 24. So: call the
   generator directly, at each level count, and see which ones come back.

   Reports after every single one, so a hang leaves behind the number it hung
   on rather than an empty page. */
document.body.dataset.r = 'starting';
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    G.mode = MODE_DUNGEON;
    for(const n of [4,3,2,1]){
      document.body.dataset.r = R.join(' | ') + ' | HUNG generating ' + n + ' level(s)';
      setDungeonLevels(n);
      seed = 2200 + n;
      genWorld(0);
      let air=0, solid=0, rock=0;
      const N = G.nx*G.ny*G.nz;
      for(let i=0;i<N;i++){
        if(G.st[i]===AIR) air++; else if(G.st[i]===ROCK) rock++; else solid++;
      }
      R.push(n + ' level(s): ny=' + G.ny + ' ' + N + ' cells, ' +
             air + ' air, ' + solid + ' puzzle, ' + rock + ' rock, ' +
             G.mines + ' mines, spawn y=' + (P.y/BLOCK).toFixed(1) +
             ', groups=' + (G.shafts ? G.shafts.length : '?') + ' shafts');
      document.body.dataset.r = R.join(' | ');
    }
    setDungeonLevels(DL_N);            // put it back
    document.body.dataset.r = R.join(' | ');
  }catch(err){
    document.body.dataset.r = R.join(' | ') + ' | THROW ' + err.message +
                              ' @ ' + ((err.stack||'').split('\n')[1]||'');
  }
}, 250);
