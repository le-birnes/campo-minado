/* THE OCEAN, AND THE CONTAINER THAT OPENS INTO IT.

   Asked for, in these words, more times than anything else in the project:
   "fix not just gravity but the dungeon being a BREACHABLE CONTAINER INSIDE
   THE OCEAN", and "I want to be able to see the damn beads on the water".

   Five things have to be true and every one of them has been false:
     1. the world is the RIGHT WAY UP - sky at small y, sea floor at large y,
        because gravity is reversed and down is +Y. Built mirrored, the chunk
        of rock you climbed out of ends up overhead like a lid, which is what
        "a box of wall/lava/stone" was.
     2. the sea is WATER IN THE GRID, not blocks you stand on
     3. it costs nothing, because it is promoted the moment it is poured
     4. you arrive ON THE BEACH, in open air, with the house in front of you
     5. shooting the wall lets the sea in */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>(+v).toFixed(2);
  G.mode=MODE_DUNGEON; seed=11; genWorld(1); G.state='play';

  /* the ending, without the boss: gravity reverses and stays reversed */
  const bx=(G.nx/2)|0, bz=(G.nz/2)|0;
  G.holeX=bx; G.holeZ=bz;
  G.gravK=-1; sandWakeLoose();
  /* THE WORLD IS BUILT BY genWorld NOW. All the boss does is let gravity go
     and open the last blocks of a well that has been full of sea the whole
     time - which is the fix for "the whole scenario is changing". */
  revealIsland();
  bossHole((G.holeX+0.5)*BLOCK, (G.holeZ+0.5)*BLOCK);
  const w=SAND;
  R.push(`gravity ${G.gravK} gsign ${gsign()} sandDir ${sandDir()} ` + (gsign()<0 ? 'ok, down is +Y' : 'FAULT'));

  /* 1. THE RIGHT WAY UP. Rock deep, island shallow, sky above it. */
  let rockY=0, rockN=0, landY=0, landN=0, skyN=0;
  for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
    const i=idx(x,y,z);
    if(G.st[i]===AIR){ if(y<G.seaY) skyN++; continue; }
    if(G.mat[i]===M_STONE && y>=G.rock0){ rockY+=y; rockN++; }
    else if(G.mat[i]===M_DRYSAND||G.mat[i]===M_WETSAND){ landY+=y; landN++; }
  }
  R.push(`chunk ${rockN} blocks at mean y ${f2(rockN?rockY/rockN:0)}, ` +
         `beach ${landN} at ${f2(landN?landY/landN:0)}, waterline ${G.seaY}, sky ${skyN} blocks`);
  R.push(rockN>200 && landN>40 && (rockY/rockN) > (landY/landN)
         ? 'ok: the rock is BELOW the beach, which is what down being +Y means'
         : 'FAULT: the world is upside down - this is the box with the tree in it');

  /* 2 and 3. the sea is brine in the grid, and it is promoted */
  const brine = w.count(S_SALT);
  R.push(`sea: ${G.seaB.length} blocks, ${brine} cells of brine, ${ladStats.blocks} promoted, ` +
         `${MASSES.filter(m=>m.n>=LAD_MASS_MIN).length} masses` +
         (G.seaB.length>50 && brine>100000 ? ' ok' : ' FAULT: no ocean'));
  const surf = MASSES.length ? Math.max(...MASSES.map(m=>m.n)) : 0;
  R.push(`biggest mass ${surf} blocks ` + (surf>=LAD_MASS_MIN ? 'ok, one body of water' : 'FAULT'));

  w.stats.scanned=0;
  let scan=0;
  for(let k=0;k<90;k++){ sandTick(w, sandDir()); ladTick(); scan+=w.stats.scanned; }
  R.push(`90 ticks with an ocean in the world: ${scan} cells scanned, ${w.awake.length} awake ` +
         (scan < 400000 ? 'ok' : 'FAULT: the sea is being simulated bead by bead'));

  /* 4. YOU CRAWL OUT. NOTHING MOVES YOU.
        Marcelo: "I get TELEPORTED outside the tree/house/sand monstro, instead
        of CRAWLING OUT of the dungeon where I can finally see the scenery."

        So the test is no longer "were you put somewhere sensible" - there is
        no placement left to check. It is: from the bottom of the shaft, under
        the physics the game actually runs, holding the key a player would
        hold, DO YOU GET OUT. */
  {
    const hx=G.holeX, hz=G.holeZ;
    /* at the bottom of the funnel, where the blast leaves you */
    let sy=G.ny-2;
    while(sy>0 && G.st[idx(hx,sy,hz)]!==AIR) sy--;
    const y0=sy;
    P.x=(hx+0.5)*BLOCK; P.z=(hz+0.5)*BLOCK; P.y=sy*BLOCK+0.4;
    P.vx=P.vz=0; P.vy=24*gsign();           // what bossBlows gives you
    P.fx.fill(0); P.hp=P.hpMax=HP_START; P.air=AIR_MAX;
    IN.f=IN.b=IN.l=IN.r=0; IN.mf=IN.ms=0; IN.jumpHeld=true;
    P.yaw=0; P.pitch=-1.2;                  // looking the way you are going
    let t=0, best=sy, surfaced=-1;
    for(; t<60*60 && surfaced<0; t++){
      physics(1/60); sandStep(1/60);
      const by=Math.floor(P.y/BLOCK);
      if(by<best) best=by;
      if(by < G.seaY && P.sub<=0) surfaced=t;
      if(P.hp<=0) break;
    }
    IN.jumpHeld=false;
    R.push(`THE WAY OUT: started at y ${y0}, best y ${best}, waterline ${G.seaY}, ` +
           `hp ${P.hp.toFixed(0)}, air ${P.air.toFixed(0)} s`);
    R.push(surfaced>=0
           ? `surfaced after ${(surfaced/60).toFixed(1)} s of swimming ok, YOU CRAWLED OUT`
           : `FAULT: still at y ${Math.floor(P.y/BLOCK)} after 60 s - there is no way out`);
    /* and the house is somewhere you can see from up here */
    let hw=0;
    for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      const i=idx(x,y,z);
      if(G.st[i]!==AIR && G.mat[i]===M_WOOD) hw++;
    }
    R.push(`wood in the world: ${hw} blocks ` + (hw>60 ? 'ok, the house and the tree are built' : 'FAULT'));
    R.push(`vials ${VIALS.length} of ${SMAT.length-1} materials ` +
           (VIALS.length >= 18 ? 'ok' : 'FAULT: the census is short'));
  }

  /* 5. THE BREACH. Find a wall of the seamount with sea on one side and a
        dungeon void on the other, stand in the void, and shoot it. */
  {
    let found=null;
    const seaSet=new Set(G.seaB);
    outer:
    for(let y=G.rock0; y<G.ny-1; y++) for(let z=1;z<G.nz-1;z++) for(let x=1;x<G.nx-2;x++){
      const a=idx(x,y,z), b=idx(x+1,y,z), c=idx(x+2,y,z);
      if(G.st[a]===AIR && !seaSet.has(a) && G.st[b]!==AIR && seaSet.has(c)){ found=[x,y,z]; break outer; }
      const a2=idx(x+2,y,z), b2=idx(x+1,y,z), c2=idx(x,y,z);
      if(G.st[a2]===AIR && !seaSet.has(a2) && G.st[b2]!==AIR && seaSet.has(c2)){ found=[x+2,y,z,-1]; break outer; }
    }
    if(!found) R.push('BREACH: no wall with a dry void on one side and sea on the other - nothing to test');
    else {
      const [fx,fy,fz,sgn] = [found[0],found[1],found[2],found[3]||1];
      P.x=(fx+0.5)*BLOCK; P.z=(fz+0.5)*BLOCK;
      P.y = fy*BLOCK + 0.40;   /* inside the void block, not above it */
      P.vx=P.vy=P.vz=0;
      P.yaw = sgn>0 ? -Math.PI/2 : Math.PI/2;  P.pitch = 0;
      /* WATER THAT HAS GOT SOMEWHERE IT WAS NOT. Counting one block is too
         narrow - it pours in and then keeps going down - so this counts every
         cell of brine that is outside the sea as the builder drew it. */
      const escaped=()=>{
        let n=0;
        for(let by=0;by<G.ny;by++) for(let bzz=0;bzz<G.nz;bzz++) for(let bxx=0;bxx<G.nx;bxx++){
          if(seaSet.has(idx(bxx,by,bzz))) continue;
          const S=SAND_DIV, ox=bxx*S, oy=by*S, oz=bzz*S;
          /* one byte when the block is one thing, which is nearly always */
          const bulk = cBlockBulk(w, bxx, by, bzz);
          if(bulk >= 0){ if(bulk===S_SALT) n += S*S*S; continue; }
          for(let cy=0;cy<S;cy++) for(let cz=0;cz<S;cz++)
            for(let cx=0;cx<S;cx++) if(w.at(ox+cx,oy+cy,oz+cz)===S_SALT) n++;
        }
        return n;
      };
      const b0 = ladStats.blocks;
      const before = escaped();
      let shots=0, opened=false;
      for(let k=0;k<10 && !opened;k++){
        shoot(); shots++;
        for(let q=0;q<12;q++){ sandTick(w, sandDir()); ladTick(); }
        opened = G.st[idx(fx+sgn,fy,fz)]===AIR;
      }
      const dem0 = b0 - ladStats.blocks;
      let mv=0;
      for(let q=0;q<1500;q++){ sandTick(w, sandDir()); ladTick(); }
      mv = w.stats.moves;
      const after = escaped();
      R.push(`BREACH at ${fx},${fy},${fz} facing ${sgn>0?'+x':'-x'}: ${shots} shots, wall ${opened?'OPEN':'still shut'}, ` +
             `${dem0} blocks demoted, ${w.awake.length} chunks still awake`);
      R.push(`brine outside the sea as drawn: ${before} -> ${after} ` +
             (after > before + 500 ? 'ok, THE SEA CAME IN' : 'FAULT: it did not flood'));
    }
  }

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
