window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}

  /* The bot guessed 75 times and chorded 0 on a board it finished. Either the
     board never offers a provable safe move, or the solver is not seeing them.
     Count the clue population directly, the way analyse() does, at every stage
     of a real game. */
  function census(diff, label, sd){
    seed=sd; genWorld(diff); G.state='play';
    const n=G.nx*G.ny*G.nz;
    let steps=0, everChord=0, everSafe=0, everMine=0, everNothing=0;
    let hiddenAtEnd=0;
    for(let step=0; step<220; step++){
      let mines=0, chords=0, safes=0, clues=0, cluesWithHidden=0;
      for(let i=0;i<n;i++){
        if(G.st[i]!==AIR || G.cnt[i]===0) continue;
        let f=0; const h=[];
        for(const j of nbrsOf(i)){ const st=G.st[j]; if(st===MARKED) f++; else if(st===SOLID) h.push(j); }
        clues++;
        if(!h.length) continue;
        cluesWithHidden++;
        const need=G.cnt[i]-f;
        if(need===h.length) mines+=h.length;
        else if(need===0){ chords++; safes+=h.length; }
      }
      steps++;
      if(chords) everChord++;
      if(safes) everSafe++;
      if(mines) everMine++;
      if(!chords && !safes && !mines) everNothing++;

      // play the same priority the bot does, but without any walking
      let acted=false;
      for(let i=0;i<n && !acted;i++){
        if(G.st[i]!==AIR || G.cnt[i]===0) continue;
        let f=0; const h=[];
        for(const j of nbrsOf(i)){ const st=G.st[j]; if(st===MARKED) f++; else if(st===SOLID) h.push(j); }
        if(!h.length) continue;
        const need=G.cnt[i]-f;
        if(need===h.length){ G.st[h[0]]=MARKED; G.marked++; acted=true; }
        else if(need===0){ revealAt(h[0],true); acted=true; }
      }
      if(!acted){
        // forced guess: take a frontier block that is not a mine, to keep going
        let t=-1;
        for(let i=0;i<n;i++){
          if(G.st[i]!==SOLID || G.mine[i]) continue;
          for(const j of nbrsOf(i)) if(G.st[j]===AIR){ t=i; break; }
          if(t>=0) break;
        }
        if(t<0) break;
        revealAt(t,true);
      }
      if(G.revealed>=G.safeTotal) break;
    }
    for(let i=0;i<n;i++) if(G.st[i]===SOLID) hiddenAtEnd++;
    return {steps, everChord, everNothing, done:G.revealed>=G.safeTotal};
  }
  for(const [d,label] of [[0,'Apprentice 6%'],[1,'Sorcerer 11%'],[2,'Arcane 20%']]){
    let boards=0, noChordBoards=0, steps=0, chordPos=0, nothingPos=0, done=0;
    for(let k=0;k<6;k++){
      const r=census(d,label,4000+k*7919);
      boards++; steps+=r.steps; chordPos+=r.everChord; nothingPos+=r.everNothing;
      if(!r.everChord) noChordBoards++;
      if(r.done) done++;
    }
    R.push(`${label} over ${boards} boards: a chord was available on `+
           `${(100*chordPos/steps).toFixed(0)}% of positions, nothing was provable on `+
           `${(100*nothingPos/steps).toFixed(0)}% | boards that never once offered a chord: `+
           `${noChordBoards} | solved by pure logic+forced guesses: ${done}`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 55000);
