/* Why does Arcane take a while to start?

   genWorld deals boards until one lands inside the difficulty's promised
   band of forced guesses, grading every deal with the game's own solver.
   TRIES is 80. A difficulty whose band is easy to hit breaks out after a
   deal or two; one whose band is nearly impossible burns all eighty, and
   each of those eighty is a full solve of the whole board.

   So the thing to count is SOLVER RUNS, not seconds -- and it has to be
   counted rather than timed, because performance.now() does not advance
   under Chrome's virtual clock and every duration here would read zero.

   Also reports what the sampler actually settled on, because "80 deals"
   is only bad news if it ALSO failed to hit the band. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    /* countForcedGuesses is a function declaration in this same scope, so
       the binding can be replaced -- no need to instrument the game. */
    const real = countForcedGuesses;
    let calls = 0;
    countForcedGuesses = function(){ calls++; return real.apply(this, arguments); };

    G.mode = MODE_SWEEP;
    for(let d=0; d<DIFFS.length; d++){
      if(DIFFS[d].custom) continue;
      const runs=[], got=[];
      for(let k=0;k<4;k++){
        seed = 4400 + k*911;
        calls = 0;
        genWorld(d);
        runs.push(calls);
        got.push((G.guesses===null?'-':G.guesses) + '/' + (G.depth||0).toFixed(2));
      }
      const D = DIFFS[d];
      const cells = D.nx*D.ny*D.nz;
      R.push(D.name + ' [' + cells + ' cells, band ' + (D.guess?D.guess.join('-'):'none') +
             ']: ' + runs.join(',') + ' solves' +
             ' -> guesses/depth ' + got.join(' '));
    }
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message; }
}, 250);
