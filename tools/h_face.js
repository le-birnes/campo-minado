/* The opening face, and what the change to the guess bands cost.

   Four things have to be true and every one of them is a count:

     1. The whole face is open -- every non-ROCK cell of one layer, top or
        bottom, and NOTHING outside it. If cells elsewhere are open the
        reveal cascaded, which would mean the game solves a chunk of itself
        before you touch it.
     2. No mine is in the face. The board you are handed to read must be
        readable.
     3. You are standing in that face, pitched towards the board rather than
        across it.
     4. Both faces actually come up. A coin toss that always lands the same
        way is not a coin toss, and one bad rnd() call would hide it.

   Plus the load cost that started all this, counted as solver runs. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    const real = countForcedGuesses;
    let calls = 0;
    countForcedGuesses = function(){ calls++; return real.apply(this, arguments); };

    G.mode = MODE_SWEEP;
    for(let d=0; d<DIFFS.length; d++){
      const D = DIFFS[d];
      const solves=[], bands=[], tops=[];
      let bad = [];
      for(let k=0;k<6;k++){
        seed = 4400 + k*911;
        calls = 0;
        genWorld(d);
        solves.push(calls);
        bands.push((G.guesses===null?'-':G.guesses)+'/'+(G.depth||0).toFixed(2));

        /* Which layer did it open, and did it open ONLY that one? */
        const openBy = new Array(G.ny).fill(0);
        const rockBy = new Array(G.ny).fill(0);
        for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
          const i = idx(x,y,z);
          if(G.st[i]===AIR) openBy[y]++;
          if(G.st[i]===ROCK) rockBy[y]++;
        }
        const face = openBy.findIndex(n=>n>0);
        const stray = openBy.reduce((a,n,y)=>a + (y===face?0:n), 0);
        const want = G.nx*G.nz - rockBy[face];
        if(face!==0 && face!==G.ny-1) bad.push('face at layer '+face+' of '+G.ny);
        if(openBy[face] !== want) bad.push('face '+openBy[face]+'/'+want+' open');
        if(stray) bad.push(stray+' open outside the face');
        tops.push(face===G.ny-1 ? 'T' : 'B');

        let mines=0;
        for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++) if(G.mine[idx(x,face,z)]) mines++;
        if(mines) bad.push(mines+' mines IN the face');

        const py = Math.round(P.y/BLOCK);
        if(py !== face) bad.push('spawn in layer '+py+' not '+face);
        const wantSign = face===G.ny-1 ? -1 : 1;
        if(Math.sign(P.pitch) !== wantSign || Math.abs(P.pitch) < 0.2)
          bad.push('pitch '+P.pitch.toFixed(2)+' for a '+(face?'top':'bottom')+' face');
      }
      /* What the free face costs in difficulty. Every mine now lives in the
         cells that are still shut, so the density where you are actually
         working is higher than the density the menu quotes. */
      const shut = G.safeTotal - G.revealed + G.mines;
      R.push(D.name + ': ' + solves.join(',') + ' solves | ' + bands.join(' ') +
             ' | faces ' + tops.join('') +
             ' | ' + G.mines + ' mines, ' + G.revealed + ' given, ' + shut +
             ' still shut = ' + (100*G.mines/shut).toFixed(1) + '% where you dig' +
             ' (menu says ' + (100*D.dens).toFixed(0) + '%)' +
             (bad.length ? ' | BAD: ' + bad.slice(0,3).join('; ') : ' | ok'));
    }
    /* And the text, which is the other half of what was asked for. */
    for(const d of [0,2]){
      G.diff = d; G.mode = MODE_SWEEP; updateDiffNote();
      R.push('note[' + DIFFS[d].name + '] ' +
             (document.getElementById('dNote').textContent.match(/cave [^·]*/)||['?'])[0].trim());
    }
    G.mode = MODE_DUNGEON; updateDiffNote();
    R.push('note[dungeon] ' +
           (document.getElementById('dNote').textContent.match(/down a [^·]*/)||['?'])[0].trim());
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message+' @ '+(err.stack||'').split('\n')[1]; }
}, 250);
