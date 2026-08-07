/* The reveal: gravity flips and STAYS, the rock you were inside is still there,
   the ocean is around it, and the island is above with the shaft lining up. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>v.toFixed(2);
  G.mode=MODE_DUNGEON; seed=5; genWorld(0,true); G.state='play';
  const N=G.nx*G.ny*G.nz;
  let rock0=0; for(let i=0;i<N;i++) if(G.st[i]!==AIR) rock0++;
  bossBlows(9*BLOCK, 4*BLOCK, 9*BLOCK);
  R.push(`boss: gravK ${f2(G.gravK)} gsign ${gsign()} ` + (gsign()<0?'ok, inverted':'FAULT'));
  /* THE WORLD IS BUILT BY genWorld NOW. All the boss does is let gravity go
     and open the last blocks of a well that has been full of sea the whole
     time - which is the fix for "the whole scenario is changing". */
  revealIsland();
  bossHole((G.holeX+0.5)*BLOCK, (G.holeZ+0.5)*BLOCK);
  R.push(`after the island: gravK ${f2(G.gravK)} ` + (G.gravK<0 ? 'ok, it STAYED' : 'FAULT: put back'));
  let rock=0, sea=0, sand=0, wood=0, air=0;
  for(let i=0;i<N;i++){
    if(G.st[i]===AIR){ air++; continue; }
    const m=G.mat[i];
    if(m===M_SALT) sea++; else if(m===M_DRYSAND||m===M_WETSAND) sand++;
    else if(m===M_WOOD) wood++; else rock++;
  }
  R.push(`the world now: ${rock} rock, ${sea} ocean, ${sand} island sand, ${wood} wood, ${air} air`);
  /* it is TRIMMED to a chunk on purpose, so a fifth of the dungeon was never
     the target - what matters is that a real body of rock is still there */
  R.push(`the rock chunk survived: ${rock} blocks of the dungeon's ${rock0} ` +
         (rock>800 ? 'ok, a chunk' : 'FAULT: wiped'));
  R.push(`it is IN the ocean: ${sea} salt blocks ` + (sea>rock ? 'ok' : 'FAULT: not surrounded'));
  /* the island has to be ABOVE the rock in world y, since down is +Y now */
  let ry=0, iy=0, rn=0, iN=0;
  for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i=idx(x,y,z); if(G.st[i]===AIR) continue;
    const m=G.mat[i];
    if(m===M_DRYSAND||m===M_WETSAND){ iy+=y; iN++; }
    else if(m!==M_SALT && m!==M_WOOD){ ry+=y; rn++; }
  }
  if(rn) ry/=rn; if(iN) iy/=iN;
  R.push(`rock sits at y ${f2(ry)}, island at y ${f2(iy)} ` +
         (iy>ry ? 'ok, the island is toward the new down' : 'FAULT: wrong way up'));
  /* the shaft lines up */
  let openAt=0;
  for(let y=0;y<G.ny;y++) if(G.st[idx(G.holeX,y,G.holeZ)]===AIR) openAt++;
  R.push(`the shaft at ${G.holeX},${G.holeZ}: open on ${openAt} of ${G.ny} ` +
         (openAt>G.ny*0.5 ? 'ok, one hole both ends' : 'FAULT: it does not line up'));
  R.push(`vials ${VIALS.length}`);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
