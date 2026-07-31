window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  function run(cfg,label){
    Object.assign(ZONE, cfg);
    let tiers=[], forced=0, mines=0;
    for(let k=0;k<8;k++){
      G.mode=MODE_DUNGEON; seed=3000+k*7919; genWorld(0); G.state='play';
      hover={hit:false};
      let guard=0;
      while(guard++<4000){
        if(G.marked===G.mines && correctFlags()===G.mines) break;
        if(G.revealed>=G.safeTotal) break;
        const h=findHint();
        if(h){
          if(h.mine){ if(G.st[h.target]===SOLID){ tiers.push(G.digAdj[h.target]); G.st[h.target]=MARKED; G.marked++; } }
          else if(G.st[h.target]===SOLID){ revealAt(h.target,true); noteDigNear(h.target); }
          continue;
        }
        forced++;
        let t=-1;
        for(let i=0;i<G.nx*G.ny*G.nz;i++){
          if(G.st[i]!==SOLID || G.mine[i]) continue;
          for(const j of nbrsOf(i)) if(G.st[j]===AIR){ t=i; break; }
          if(t>=0) break;
        }
        if(t<0) break;
        revealAt(t,true); noteDigNear(t);
      }
      mines+=G.mines;
    }
    const band=[0,0,0,0,0,0];
    for(const t of tiers) band[MINE_TIERS.indexOf(mineTier(t))]++;
    const pc=v=>tiers.length?Math.round(100*v/tiers.length)+'%':'-';
    R.push(`${label} drop ${ZONE.drop} h ${ZONE.hMin}-${ZONE.hMax}: `+
           `none ${pc(band[0])} t1 ${pc(band[1])} t2-3 ${pc(band[2])} t4-5 ${pc(band[3])} `+
           `t6-7 ${pc(band[4])} FLYING ${pc(band[5])} | ${tiers.length} mines, ${forced} forced guesses`);
  }
  const base={drop:0.17,hMin:2,hMax:5};
  run(base, 'as shipped ');
  run({drop:0.35,hMin:2,hMax:3}, 'open+shallow');
  run({drop:0.05,hMin:4,hMax:5}, 'dense+tall  ');
  Object.assign(ZONE, base);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
