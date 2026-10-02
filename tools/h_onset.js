/* How long after the trigger does a shell actually make noise?

   "It sounds late" is a number. Render the shipping shot offline a dozen
   times (the pick is random, so that covers most of the ten shells) and
   report when the output first reaches -40, -20 and -6 dB of its own peak. */
let R = [], polls = 0;
function bang(){
  try{
    G.muted = false; G.mode = MODE_DUNGEON; G.diff = 0;
    startGame(); seed = 909; genWorld(0); G.state='play';
    try{ setScreen('play'); }catch(e){}
    enemies.length = 0; snd.resume();
  }catch(err){ document.body.dataset.r = 'THROW setup '+err.message; }
}
function measure(){
  const info = snd.bankInfo();
  R.push('bank ' + info.have + '/' + info.want);
  const jobs = [];
  for(let k=0;k<12;k++){
    const p = snd.render('shotgun', 0.6);
    if(!p) continue;
    jobs.push(p.then(buf => {
      const d = buf.getChannelData(0), sr = buf.sampleRate;
      let pk=0, at=0;
      for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>pk){ pk=a; at=i; } }
      const first = db => { const th = pk*Math.pow(10, db/20);
        for(let i=0;i<d.length;i++) if(Math.abs(d[i])>=th) return (i/sr*1000).toFixed(1);
        return '-'; };
      return [first(-40), first(-20), first(-6), (at/sr*1000).toFixed(1)].join('/');
    }));
  }
  Promise.all(jobs).then(a => {
    R.push('ms to -40/-20/-6/peak: ' + a.join('  '));
    document.body.dataset.r = R.join(' | ');
  }).catch(e => { document.body.dataset.r = R.join(' | ') + ' | THROW '+e.message; });
}
function waitBank(){
  polls++;
  if(snd.bankInfo().state === 'done' || polls > 300){ measure(); return; }
  setTimeout(waitBank, 20);
}
setTimeout(bang, 200);
setTimeout(waitBank, 500);
