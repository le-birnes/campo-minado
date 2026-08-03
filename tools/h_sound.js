/* Measure a sound instead of arguing about it.

   "It sounds like a hit in a drum, a single beat" is a real defect and it had
   no test behind it, because sound was the last thing in this game that was
   only ever judged by opinion. snd.render() hands back the actual shipping
   effect as samples, so the things that make a gunshot a gunshot can be
   counted:

     peak / clip     it must be the loudest thing and must not clip
     attack          time to peak. A gun is under 3 ms. A drum is 5-15 ms.
     body            how long it stays above a tenth of peak
     tail            how long until it is properly gone
     onsets          HOW MANY separate arrivals there are. This is the whole
                     complaint: one onset is a beat, a shower is an explosion
                     with fragments in it.
     brightness      where the energy sits, early and late. A blast starts
                     bright and collapses; a drum starts dark and stays there.
     variation       two pulls of the same trigger must not be identical

   Two things about running it. The identifier prefix is not decoration: a
   name this file shares with the game is a parse error and NOTHING runs, in
   silence. And the render is started at load and reported from its callback,
   never awaited — under Chrome's virtual clock an await is a deadlock,
   because virtual time runs out the whole budget while the audio thread is
   still working and the continuation never gets a turn.

   ?snd=shotgun   which effect (default shotgun)                            */
const sndMark = m => { try{ document.body.dataset.r = m; }catch(e){} };
const sndBufs = [];
let sndDone = 0, sndFail = '';
const SND_NAME = (location.search.match(/[?&]snd=(\w+)/) || [0,'shotgun'])[1];
sndMark('starting ' + SND_NAME);
try{
  G.muted = false;
  for(let k=0;k<2;k++){
    const p = snd.render(SND_NAME, 1.2);
    if(!p){ sndFail = 'snd.render returned null'; break; }
    p.then(b => { sndBufs[k] = b; if(++sndDone === 2) sndMeasure(); },
           e => { sndFail = 'rejected: ' + (e && e.message); });
  }
}catch(e){ sndFail = 'threw at start: ' + e.message; }
setTimeout(()=>{
  if(sndDone < 2)
    sndMark('rendered ' + sndDone + '/2 — ' + (sndFail || 'never resolved'));
}, 900);

function sndMeasure(){
  const R = [];
  try{
    const d = sndBufs[0].getChannelData(0), sr = sndBufs[0].sampleRate;

    // ---- level ----
    let peak=0, peakAt=0, clipped=0;
    for(let i=0;i<d.length;i++){
      const a = Math.abs(d[i]);
      if(a>peak){ peak=a; peakAt=i; }
      if(a>=0.999) clipped++;
    }
    R.push('peak=' + peak.toFixed(3) + (clipped ? ' CLIPPED x'+clipped : ''));
    R.push('attack=' + (peakAt/sr*1000).toFixed(1) + 'ms');

    // ---- shape: RMS in 5 ms windows ----
    const win = (sr*0.005)|0, rms = [];
    for(let i=0;i+win<=d.length;i+=win){
      let s=0; for(let j=0;j<win;j++) s += d[i+j]*d[i+j];
      rms.push(Math.sqrt(s/win));
    }
    const top = Math.max.apply(null, rms);
    const above = f => { let n=0; for(const v of rms) if(v > top*f) n++; return n*5; };
    R.push('body=' + above(0.10) + 'ms above -20dB');
    R.push('tail=' + above(0.01) + 'ms above -40dB');

    /* ---- the count that matters ----
       An onset is a window whose energy jumps well clear of the one before.
       A single beat produces exactly one. A shell full of burning fragments
       produces a shower, and the shower is what "punch and flavour" means.
       1.5 ms windows, because 5 ms ones average the fragments away. */
    const fine = Math.max(1,(sr*0.0015)|0);
    const onsetsIn = (t0,t1) => {
      let n=0, prev=0;
      for(let i=(sr*t0)|0; i+fine<=Math.min(d.length,(sr*t1)|0); i+=fine){
        let s=0; for(let j=0;j<fine;j++) s += d[i+j]*d[i+j];
        const e = Math.sqrt(s/fine);
        if(e > prev*1.9 && e > top*0.03) n++;
        prev = e;
      }
      return n;
    };
    R.push('onsets=' + onsetsIn(0,0.25) + ' in the first 250ms');
    R.push('after the crack=' + onsetsIn(0.02,0.25));

    /* ---- brightness, by zero crossings: cheap, no FFT, and monotonic in
       the one thing being asked about ---- */
    const bright = (t0,t1) => {
      const a=(sr*t0)|0, b=Math.min(d.length,(sr*t1)|0);
      let z=0; for(let i=a+1;i<b;i++) if((d[i-1]<0) !== (d[i]<0)) z++;
      return Math.round(z/((b-a)/sr)/2);
    };
    R.push('bright ' + bright(0,0.02) + '/' + bright(0.06,0.14) + '/' +
           bright(0.30,0.60) + 'Hz early/mid/late');

    // ---- two shots must not be the same shot ----
    const e0 = sndBufs[0].getChannelData(0), e1 = sndBufs[1].getChannelData(0);
    let same=0, n=Math.min(e0.length, e1.length), seen=0;
    for(let i=0;i<n;i+=17){ seen++; if(Math.abs(e0[i]-e1[i]) < 1e-9) same++; }
    R.push('identical=' + (same/seen*100).toFixed(0) + '%');

    document.body.dataset.r = R.join(' | ');
  } catch(err){
    document.body.dataset.r = R.join(' | ') + ' | THROW ' + err.message + ' @ ' +
      ((err.stack||'').split('\n')[1]||'').trim();
  }
}
