/* MOMENTUM IS A LAW, AND THIS IS WHAT THAT HAS TO MEAN.

   Marcelo, twice: "shooting a bead should make it fly forward very fast, LIKE
   A ROCK PELLET SHOT BY A REAL GUN would, IF NOT DESTROYED. If gun surpasses
   bead integrity, then cool, but if not, item should be PROPELLED (inelastic
   collision, those rules should apply as I intend to, later, build damn
   rockets burning fuel and flying to the moon)."

   So four questions, and none of them is "did it run":

     1. does the SAME impulse do different things to different materials
     2. does a bead that SURVIVES leave at v = p/m, still itself
     3. does a bead in flight BREAK OR PROPEL what it hits - the chain
     4. and is any of it written inside shoot()? It must not be.

   Prefixed mo: the game already declares mark, set, idx and landY. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  SIM_SPHERE = false;
  const R=[];

  /* ---- 1. the table itself: one impulse, four materials ----------------- */
  const moImp = BLAST_P;
  /* AT THE CENTRE AND AT THE EDGE, because the falloff is half the rule: a
     shot that shatters what it touches should still only SHOVE what it grazes,
     and testing one radius would hide that entirely. */
  const moRow = (m,k) => {
    const imp = moImp*k, mass = SM_MASS[m], v = imp/mass, e = 0.5*imp*v;
    return {n:SMAT[m].n, mass, v, e, integ:SM_INTEG[m], breaks: e >= SM_INTEG[m]};
  };
  const moMats = [S_SAND, S_RUBBLE, S_WATER, S_WOOD].filter(m=>m!==undefined);
  R.push('ONE IMPULSE OF ' + moImp + ' kg m/s, four materials:');
  let moB=0, moS=0;
  for(const m of moMats){
    const c = moRow(m,1), g = moRow(m,0.5);
    if(c.breaks) moB++; else moS++;
    if(g.breaks) moB++; else moS++;
    R.push('  ' + c.n.padEnd(8) + (c.mass*1000).toFixed(0) + ' g, integrity ' +
           c.integ.toFixed(0) + ' J | CENTRE ' + c.v.toFixed(1) + ' m/s ' +
           c.e.toFixed(0) + ' J ' + (c.breaks?'BREAKS':'PROPELLED') +
           ' | EDGE ' + g.v.toFixed(1) + ' m/s ' + g.e.toFixed(0) + ' J ' +
           (g.breaks?'BREAKS':'PROPELLED'));
  }
  R.push('  ' + moB + ' break, ' + moS + ' are propelled ' + (moB && moS
    ? 'ok, the same shot does different things to different things'
    : 'FAULT: everything does the same thing, so integrity decides nothing'));

  /* ---- 2. and mass is not a tuned number ------------------------------- */
  R.push('mass is density x bead volume: sand ' + SM_D[S_SAND] + ' kg/m3 x ' +
         (CELL_M*CELL_M*CELL_M*1e6).toFixed(1) + ' cm3 = ' +
         (SM_MASS[S_SAND]*1000).toFixed(2) + ' g ' +
         (Math.abs(SM_MASS[S_SAND] - SM_D[S_SAND]*Math.pow(CELL_M,3)) < 1e-9
          ? 'ok, it follows the bead size' : 'FAULT'));

  /* ---- 3. THE CHAIN, in a tank, with nothing else in it ----------------- */
  document.body.dataset.r='STAGE chain';
  {
    const moW = new SandWorld(96,96,96);
    const moNB = 96/PGS;
    for(let by=0;by<moNB;by++) for(let bz=0;bz<moNB;bz++) for(let bx=0;bx<moNB;bx++)
      if(by>0) cFreeBlock(moW, bx,by,bz, S_AIR);
    /* a wall of sand for something to be driven through */
    let moWall=0;
    for(let y=40;y<56;y++) for(let z=40;z<56;z++) for(let x=60;x<64;x++){ moW.put(x,y,z,S_SAND); moWall++; }
    const moBefore = moW.count(S_SAND);
    /* fire ONE bead of rubble into it at forty metres a second - no gun
       anywhere, just a bead with momentum */
    const moSave = SAND; SAND = moW;
    GRIT.n=0; GRIT.next=0; GRIT.live.fill(0); GRIT_HITS=0;
    gritAdd(48*CELL_M, 48*CELL_M, 48*CELL_M, 40, 0, 0, S_RUBBLE);
    for(let t=0;t<120;t++){ gritStep(1/60); sandTick(moW,-1); }
    const moAfter = moW.count(S_SAND);
    SAND = moSave;
    R.push('THE CHAIN: one bead of rubble at 40 m/s into a wall of ' + moWall +
           ' sand beads -> ' + GRIT_HITS + ' collisions, ' +
           (moBefore-moAfter) + ' of the wall displaced ' +
           (GRIT_HITS > 0 ? 'ok, it hit things and passed its momentum on'
                          : 'FAULT: it went through as if the wall were smoke'));
  }

  /* ---- 4. and the law is not inside the gun ---------------------------- */
  {
    const moSrc = sandBlast.toString() + gritStep.toString();
    const moGun = /BLAST_P|SM_INTEG|SM_MASS/.test(moSrc);
    const moShoot = /SM_INTEG|SM_MASS/.test(shoot.toString());
    R.push('the law lives in the blast and the flight: ' + (moGun ? 'yes' : 'NO') +
           ' | shoot() knows about integrity or mass: ' + (moShoot ? 'YES - IT IS A GUN FEATURE' : 'no') +
           ' ' + (moGun && !moShoot ? 'ok, a rocket can use the same rule' : 'FAULT'));
  }


  /* ---- 5. AND A BLOCK THAT HAS BEEN EATEN STOPS BEING A BLOCK ----------- */
  document.body.dataset.r='STAGE collapse';
  {
    G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
    /* find a solid block with air beside it and stand in that air */
    let moBi=-1, moAir=-1;
    for(let y=1;y<G.ny-1 && moBi<0;y++) for(let z=1;z<G.nz-1 && moBi<0;z++)
      for(let x=1;x<G.nx-1 && moBi<0;x++){
        const a=idx(x,y,z), b=idx(x+1,y,z);
        if(G.st[a]===AIR && G.st[b]!==AIR && !(G.hull&&G.hull[b])){ moAir=a; moBi=b; }
      }
    if(moBi<0) R.push('COLLAPSE: no block with air beside it - nothing to test');
    else {
      const c = cellXYZ(moBi);
      const solidBefore = solidAtWorld((c[0]+0.5)*BLOCK,(c[1]+0.5)*BLOCK,(c[2]+0.5)*BLOCK);
      voxelise(moBi);
      /* blast it from its own middle, hard enough to hollow it out */
      for(let k=0;k<6;k++)
        sandBlast((c[0]+0.5)*BLOCK,(c[1]+0.5)*BLOCK,(c[2]+0.5)*BLOCK, 1,0,0, 2.2);
      R.push('  what the blast itself reported: ' +
             LOG.filter(l=>/blast razed/.test(l)).slice(-2).join(' / ') +
             ' | candidates cap ' + BLAST_CAND.length + ', throw cap ' + BLAST_MAX);
      /* how much of it actually went, and what it was made of - because
         "it did not collapse" has two very different causes */
      let moAirN=0, moKind={};
      for(let ly=0;ly<SAND_DIV;ly++) for(let lz=0;lz<SAND_DIV;lz++) for(let lx=0;lx<SAND_DIV;lx++){
        const m2 = SAND.at(c[0]*SAND_DIV+lx, c[1]*SAND_DIV+ly, c[2]*SAND_DIV+lz);
        if(m2===S_AIR) moAirN++; else moKind[SMAT[m2].n]=(moKind[SMAT[m2].n]||0)+1;
      }
      R.push('  after six blasts the block is ' +
             (moAirN*100/(SAND_DIV*SAND_DIV*SAND_DIV)).toFixed(0) + '% air; what is left: ' +
             Object.keys(moKind).map(k=>k+' '+moKind[k]+' (integrity '+
               SM_INTEG[SMAT.findIndex(mm=>mm&&mm.n===k)].toFixed(0)+' J)').join(', '));
      const solidAfter = solidAtWorld((c[0]+0.5)*BLOCK,(c[1]+0.5)*BLOCK,(c[2]+0.5)*BLOCK);
      const stAfter = G.st[moBi]===AIR;
      R.push('COLLAPSE: block ' + c.join(',') +
             ' solid before ' + solidBefore + ', after ' + solidAfter +
             ', G.st says ' + (stAfter?'AIR':'still SOLID') + ' ' +
             (solidBefore && !solidAfter && stAfter
              ? 'ok, what you cannot see you can walk through'
              : 'FAULT: it is invisible and still in your way'));
    }
  }
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
