window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];

  /* Play a board the way a perfect logician would: take every deduction the
     game's OWN hint solver can find — arrows, counts and the subset rule —
     and only when it returns nothing is the player genuinely forced to guess.
     That is the honest number. The bot's own count is much higher because its
     solver knows two rules and this one knows five. */
  function play(diff, mode, seedv){
    G.mode=mode; seed=seedv; genWorld(diff); G.state='play';
    const n=G.nx*G.ny*G.nz;
    let forced=0, deduced=0, guard=0, tiers=[];
    hover = {hit:false};
    while(guard++ < 4000){
      if(G.revealed>=G.safeTotal) break;
      if(G.dungeon && G.marked===G.mines && correctFlags()===G.mines) break;
      const h = findHint();
      if(h){
        deduced++;
        if(h.mine){
          if(G.st[h.target]===SOLID){
            if(G.dungeon) tiers.push(G.digAdj[h.target]);   // what it would hatch as
            G.st[h.target]=MARKED; G.marked++;
          }
        } else {
          if(G.st[h.target]===SOLID){ revealAt(h.target,true); noteDigNear(h.target); }
        }
        continue;
      }
      // nothing provable: a real guess
      forced++;
      let t=-1;
      for(let i=0;i<n;i++){
        if(G.st[i]!==SOLID || G.mine[i]) continue;         // survive, to keep counting
        for(const j of nbrsOf(i)) if(G.st[j]===AIR){ t=i; break; }
        if(t>=0) break;
      }
      if(t<0) break;
      revealAt(t,true); noteDigNear(t);
    }
    return {forced, deduced, done:(G.revealed>=G.safeTotal)||(G.dungeon&&correctFlags()===G.mines), tiers};
  }

  for(const [d,mode,label] of [[0,MODE_SWEEP,'Apprentice 6%'],[1,MODE_SWEEP,'Sorcerer 11%'],
                               [2,MODE_SWEEP,'Arcane 20%'],[0,MODE_DUNGEON,'Dungeon']]){
    let F=[], D=0, done=0, allTiers=[];
    const B=12;
    for(let k=0;k<B;k++){
      const r=play(d,mode,3000+k*7919);
      F.push(r.forced); D+=r.deduced; if(r.done) done++;
      allTiers=allTiers.concat(r.tiers);
    }
    F.sort((a,b)=>a-b);
    R.push(`${label}: forced guesses per board ${F[0]}-${F[B-1]}, median ${F[B>>1]} `+
           `(${D} deductions across ${B} boards, ${done} solved)`);
    if(allTiers.length){
      const band=[0,0,0,0,0,0];
      for(const t of allTiers){ const i=MINE_TIERS.indexOf(mineTier(t)); band[i]++; }
      R.push(`  mine tiers a logician would face: ` +
             MINE_TIERS.map((t,i)=>`<=${t.upTo}:${band[i]}`).join(' ') +
             ` (${allTiers.length} mines flagged)`);
    }
  }
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
