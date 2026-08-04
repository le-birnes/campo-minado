/* Did opening the whole face change the DIFFICULTY, or only the density?

   Those are not the same question here and the file has said so for a while:
   difficulty is how hard the logic is. It is measured, per board, by the
   game's own solver — `guesses` is how many genuine 50/50s survive it and
   `depth` is the share of moves where nothing simpler than the two-clue
   subset rule will do — and the generator deals boards until both land in
   the difficulty's band. Mine density is not in that loop anywhere.

   So: same seeds, same bands, one variable. openFace is a function
   declaration in the game's own scope, so the binding can be swapped for
   the old 3x3 patch and the identical seeds replayed through it.

   If the face mattered to difficulty, the two columns come out different.  */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    const realSolve = countForcedGuesses;
    let calls = 0;
    countForcedGuesses = function(){ calls++; return realSolve.apply(this, arguments); };
    const realFace = openFace;
    const SEEDS = [4400, 5311, 6222, 7133, 8044, 8955, 9866, 10777];

    function sweep(label){
      const out = {};
      for(let d=0; d<DIFFS.length; d++){
        const g=[], dp=[], sv=[];
        for(const sd of SEEDS){
          seed = sd; calls = 0;
          G.mode = MODE_SWEEP;
          genWorld(d);
          g.push(G.guesses===null?0:G.guesses);
          dp.push(G.depth||0);
          sv.push(calls);
        }
        const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
        const band = DIFFS[d].guess, dband = DIFFS[d].depth||[0,1];
        const inBand = g.filter((v,i)=>
          (!band || (v>=band[0] && v<=band[1])) &&
          dp[i]>=dband[0] && dp[i]<=dband[1]).length;
        out[DIFFS[d].name] = {g:mean(g), dp:mean(dp), sv:mean(sv), inBand, n:g.length};
      }
      return out;
    }

    const withFace = sweep('face');
    /* The opening as it was: a 3x3 patch, and the flood left switched on. */
    openFace = function(L, cy){
      const cx = 1 + ((rnd()*(G.nx-2))|0), cz = 1 + ((rnd()*(G.nz-2))|0);
      for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++){
        const X=cx+dx, Z=cz+dz;
        if(inside(X,cy,Z) && G.st[idx(X,cy,Z)]!==ROCK) L.safe.add(idx(X,cy,Z));
      }
      L.flat = false; L.pitch = 0;
    };
    const without = sweep('patch');

    for(const k in withFace){
      const a = withFace[k], b = without[k];
      R.push(k + ': guesses ' + b.g.toFixed(2) + ' -> ' + a.g.toFixed(2) +
             ' | depth ' + b.dp.toFixed(3) + ' -> ' + a.dp.toFixed(3) +
             ' | in band ' + b.inBand + '/' + b.n + ' -> ' + a.inBand + '/' + a.n +
             ' | solves ' + b.sv.toFixed(1) + ' -> ' + a.sv.toFixed(1));
    }
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message; }
}, 250);
