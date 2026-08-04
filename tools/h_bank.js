/* Does the sound bank decode inside the game, and does the gun behave?

   Three separate things, and they fail in different ways:

     1. THE BANK. 18 recordings, base64 -> Opus -> AudioBuffer. Proved
        standalone already; this checks it survives being inside index.html
        and being kicked off from ensure().
     2. THE SHAPE OF A SHOT. Rendered offline and measured: a shell at zero
        and a rack about a third of a second behind it. If the rack is
        missing the render is nearly silent after 0.3 s, and that is a
        number, not an opinion.
     3. THE RISKY PATHS. Firing again while the rack is still in the air
        stops a source that was started for a time that has not arrived yet,
        and a burst of twelve shots trips the voice cap. Both of those throw
        rather than sound wrong when they are wrong.

   Decode is asynchronous and Chrome's virtual clock does not wait for it,
   so this polls instead of assuming, and reports what it got either way. */
let R = [], polls = 0;

function bang(){
  try{
    G.muted = false;
    G.mode = MODE_DUNGEON; G.diff = 0;
    startGame();
    seed = 909; genWorld(0); G.state='play'; try{ setScreen('play'); }catch(e){}
    enemies.length = 0;
    snd.resume();                       // this is what creates the context
  }catch(err){ document.body.dataset.r = 'THROW setup '+err.message; }
}

/* Everything that can only be judged once the buffers are real. */
function measure(){
  const info = snd.bankInfo();
  R.push('bank ' + info.state + ' ' + info.have + '/' + info.want +
         ' decoded, ' + info.bad + ' failed, after ' + polls + ' polls');
  if(info.have === 0){
    R.push('NO BUFFERS — everything below is the synth fallback');
  }

  /* --- the risky paths, on the live context --- */
  try{
    snd.shotgun();
    const one = snd.bankInfo().pumped;
    snd.shotgun();                       // interrupts a rack that has not begun
    const two = snd.bankInfo().pumped;
    R.push('rack after 1 shot=' + one + ', after an interrupting 2nd=' + two);
  }catch(err){ R.push('THROW on the interrupt: ' + err.message); }
  try{
    for(let i=0;i<12;i++) snd.shotgun();
    R.push('12 fast shots -> ' + snd.bankInfo().shells + ' live shells (cap 4)');
  }catch(err){ R.push('THROW on the voice cap: ' + err.message); }
  try{
    R.push('right click played a recording: ' + snd.rclick());
  }catch(err){ R.push('THROW on rclick: ' + err.message); }

  /* --- the shape of one shot, rendered and measured --- */
  const jobs = [];
  for(const name of ['shotgun', 'shotgunSynth']){
    let p = null;
    try{ p = snd.render(name, 2.0); }catch(err){ R.push(name+' render THREW '+err.message); }
    if(!p){ R.push(name + ': no render'); continue; }
    jobs.push(p.then(buf => {
      const d = buf.getChannelData(0), sr = buf.sampleRate;
      const db = x => x<=1e-9 ? -99 : 20*Math.log10(x);
      const win = (a,b) => {              // RMS between two times, in dBFS
        const i0=Math.max(0,(a*sr)|0), i1=Math.min(d.length,(b*sr)|0);
        let s=0; for(let i=i0;i<i1;i++) s+=d[i]*d[i];
        return db(Math.sqrt(s/Math.max(1,i1-i0)));
      };
      let pk=0, at=0;
      for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>pk){ pk=a; at=i/sr; } }
      /* The rack lives between 0.34 and 0.41 s plus its own length. Against
         the shell's own reverb at the same moment, which is what the
         "quiet" window is for. */
      R.push(name + ': peak ' + db(pk).toFixed(1) + ' dBFS at ' + at.toFixed(3) +
             's | blast ' + win(0, 0.25).toFixed(1) +
             ' | rack window ' + win(0.34, 0.75).toFixed(1) +
             ' | tail ' + win(1.2, 2.0).toFixed(1));
    }).catch(err => { R.push(name + ' render failed: ' + err.message); }));
  }
  Promise.all(jobs).then(()=>{ document.body.dataset.r = R.join(' | '); })
                   .catch(e => { document.body.dataset.r = R.join(' | ') + ' | THROW '+e.message; });
}

/* Poll, because decodeAudioData finishes on its own schedule and the virtual
   clock will happily run to the end of the budget without it. */
function waitBank(){
  polls++;
  const st = snd.bankInfo().state;
  if(st === 'done' || polls > 300){ measure(); return; }
  setTimeout(waitBank, 20);
}

setTimeout(bang, 200);
setTimeout(waitBank, 500);
