/* CAN A BODY GET THERE, not can a BLOCK reach a block.

   The player is 2 m and a lattice block is 1.5 m, so he is TALLER THAN THE
   WORLD'S SMALLEST UNIT. Every connectivity test until now has flood-filled
   block to block, which cannot see a corridor you do not fit down - and that
   is exactly the bug he hit: "structures rapidly falling out of vision and the
   game leaves me flying in the nowhere."

   So this floods with his ACTUAL BOUNDING BOX: radius 0.52, height 2.0,
   standing on the floor of each block, and it reports the difference between
   what a point can reach and what a person can. Prefixed ft: the game already
   declares mark, set, idx and landY. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  let ftTight=0, ftSeeds=0;

  /* does a 2 m body with a 0.52 m radius stand here without touching stone?
     Nine columns of the cylinder, three heights each - the corners of the box
     are outside the radius, so testing the box would reject legal cells. */
  const ftFree = (bx,by,bz) => {
    const cx=(bx+0.5)*BLOCK, cz=(bz+0.5)*BLOCK, fy=by*BLOCK;
    for(let a=0;a<8;a++){
      const th=a*Math.PI/4, ox=Math.cos(th)*P_R*0.92, oz=Math.sin(th)*P_R*0.92;
      for(const h of [0.15, P_H*0.5, P_H-0.12])
        if(solidAtWorld(cx+ox, fy+h, cz+oz)) return false;
    }
    for(const h of [0.15, P_H*0.5, P_H-0.12]) if(solidAtWorld(cx, fy+h, cz)) return false;
    return true;
  };

  /* SWEEP FIRST, because that is what he says is broken and it is the mode
     where you WALK IN THE HOLES YOU MAKE: every cell you dig has to hold you,
     not just the one you start in. */
  for(const ftD of [0,1,2]){
    document.body.dataset.r='STAGE sweep '+ftD;
    G.mode=MODE_SWEEP; seed=5; genWorld(ftD); G.state='play';
    const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
    const ok = ftFree(sx,sy,sz);
    /* and the whole opened face, which is where the first moves happen */
    let face=0, faceOk=0;
    for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      if(G.st[idx(x,sy,z)]!==AIR) continue;
      face++; if(ftFree(x,sy,z)) faceOk++;
    }
    R.push(`SWEEP ${DIFFS[ftD].name} ${G.nx}x${G.ny}x${G.nz} cells of ${BLOCK} m: ` +
           `spawn ${ok?'HOLDS YOU':'IS TOO SHORT FOR YOU'}, ` +
           `open face ${faceOk} of ${face} cells hold you` +
           (ok && faceOk===face ? ' ok' : '  <- FAULT'));
    if(!ok || faceOk!==face) ftTight++;
  }

  for(const ftSeed of [3,11,23]){
    document.body.dataset.r='STAGE seed '+ftSeed;
    G.mode=MODE_DUNGEON; seed=ftSeed; genWorld(0); G.state='play';
    ftSeeds++;
    const L=G.lump;
    const ftIn=(x,y,z)=> L && y>=L.y0 && y<=L.y1 && Math.hypot(x-L.cx, z-L.cz)<=L.r;

    /* every open block inside the shell, and which of them a BODY can occupy */
    const ftOpen=new Set(), ftStand=new Set();
    for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      if(!ftIn(x,y,z)) continue;
      const i=idx(x,y,z);
      if(G.st[i]!==AIR || (G.hull&&G.hull[i])) continue;
      ftOpen.add(i);
      if(ftFree(x,y,z)) ftStand.add(i);
    }

    /* flood from where he actually starts, through cells a body fits in */
    const px=Math.floor(P.x/BLOCK), py=Math.floor(P.y/BLOCK), pz=Math.floor(P.z/BLOCK);
    const ftStart=idx(px,py,pz);
    let ftReach=0;
    const ftSpawnOk = ftStand.has(ftStart);
    if(ftSpawnOk){
      const st=[ftStart], seen=new Set(st);
      while(st.length){
        const c=cellXYZ(st.pop()); ftReach++;
        for(let k=0;k<6;k++){
          const ax=c[0]+NB26X[k], ay=c[1]+NB26Y[k], az=c[2]+NB26Z[k];
          if(!inside(ax,ay,az)) continue;
          const j=idx(ax,ay,az);
          if(!ftStand.has(j) || seen.has(j)) continue;
          seen.add(j); st.push(j);
        }
      }
    }
    const ftPct = ftStand.size ? (ftReach/ftStand.size*100) : 0;
    if(!ftSpawnOk || ftPct < 99.9) ftTight++;
    R.push(`seed ${ftSeed}: ${ftOpen.size} open blocks, ${ftStand.size} a BODY fits in ` +
           `(${(ftStand.size/Math.max(1,ftOpen.size)*100).toFixed(0)}%), ` +
           `you reach ${ftReach} of those (${ftPct.toFixed(0)}%), ` +
           `spawn ${ftSpawnOk ? 'ok' : 'IS INSIDE THE STONE'}`);
  }
  R.push(`ACROSS ${ftSeeds} SEEDS: ${ftTight} where a body cannot go everywhere a point can ` +
         (ftTight===0 ? 'ok, he fits down every corridor he can see'
                      : 'FAULT: there are places only a point can reach'));
  R.push(`player ${P_H} m by ${(P_R*2).toFixed(2)} m, lattice block ${BLOCK} m, ` +
         `so he is ${(P_H/BLOCK).toFixed(2)} blocks tall - nothing may be one block high`);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
