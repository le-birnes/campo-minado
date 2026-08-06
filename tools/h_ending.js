window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  R.push(`gravity starts at ${gnow().toFixed(1)} (want 20.0)`);

  bossBlows((G.nx/2)*BLOCK, (G.ny/2)*BLOCK, (G.nz/2)*BLOCK);
  R.push(`blast: gravity now ${gnow().toFixed(1)} ${gnow()<0?'(UP)':'FAULT: still down'}`+
         `, player vy ${P.vy.toFixed(1)}, emerge timer ${G.emerge.toFixed(1)}s`);

  /* run the clock until it lands */
  let t=0;
  for(let k=0;k<1200 && !G.island;k++){ frame(performance.now()+k*16.7); t+=1/60; }
  R.push(`emerged after ~${t.toFixed(1)}s: island=${!!G.island}, gravity back to ${gnow().toFixed(1)}`);

  if(G.island){
    let salt=0, wet=0, dry=0, wood=0, leaf=0, air=0;
    for(let i=0;i<G.nx*G.ny*G.nz;i++){
      if(G.st[i]===AIR){ air++; continue; }
      if(!G.scenery[i]) continue;
      const m=G.mat[i];
      if(m===M_SALT) salt++; else if(m===M_WETSAND) wet++; else if(m===M_DRYSAND) dry++;
      else if(m===M_WOOD) wood++; else if(m===M_LEAF) leaf++;
    }
    R.push(`island blocks: ${salt} salt water, ${wet} wet sand, ${dry} dry sand, `+
           `${wood} wood, ${leaf} leaf`);
    R.push(`has all five: ${salt&&wet&&dry&&wood&&leaf ? 'yes' : 'NO'}`);
    /* the player must be standing on something, above the sea */
    const px=Math.floor(P.x/BLOCK), py=Math.floor(P.y/BLOCK), pz=Math.floor(P.z/BLOCK);
    const under = inside(px,py-1,pz) ? G.st[idx(px,py-1,pz)] : -1;
    R.push(`player at block y=${py}, ground under: ${under===ROCK?'solid':'NOTHING (FAULT)'}`);
    R.push(`dungeon flag cleared: ${G.dungeon===false?'yes':'NO'}`);
    rebuildWorld();
    R.push(`renders ${worldB.count} of ${worldB.max} instances `+
           `${worldB.count<worldB.max?'ok':'FAULT OVERFLOW'}`);
  }
  R.push(window.__err.length?('FAULT '+window.__err.join(' | ')):'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 400);
