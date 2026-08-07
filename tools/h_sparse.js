/* THE SPARSE GRID: a world ten times wider must cost the same at rest.

   Marcelo: "why is it so hard to build a cylinder like 100 m wide and 1000 m
   tall with the dungeon inside? We won't be able to have an open interactive
   world if we can't have ULTRA LARGE STRUCTURES to enter and explore."

   The cylinder was never the problem. One flat Uint8Array over the whole world
   at BLOCK/16 was: 576 x 5712 x 576 cells is 1.9 BILLION bytes, and today's
   little 18x24x18 dungeon already paid 31 MB of it up front for a world which
   is almost entirely one thing.

   So this asks four questions and none of them is "did the code run":

     1. does a fresh world of any size allocate NOTHING
     2. does a world TEN TIMES WIDER cost the same at rest
     3. can a hundred-metre-by-thousand-metre structure be built at all
     4. and does the matter still behave - poured, settled, conserved

   Careful with the identifiers: the game already declares mark, set, landY and
   idx, and a duplicate const is a SyntaxError, which means nothing runs and
   Chrome sits out its whole virtual-time budget in silence. Everything here is
   prefixed. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r = 'STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const spMB = w => (w.bytes()/1048576);
  const spMark = s => { document.body.dataset.r = 'STAGE '+s; };

  /* ---- 1. a fresh world allocates nothing ------------------------------- */
  spMark('fresh');
  const spW1 = new SandWorld(288, 384, 288);            // today's dungeon
  R.push(`FRESH ${spW1.W}x${spW1.H}x${spW1.D} cells: ${spW1.pgn} pages, ` +
         `${spMB(spW1).toFixed(2)} MB ` +
         (spW1.pgn===0 ? 'ok, nothing exists until something moves'
                       : 'FAULT: it allocated up front'));

  /* ---- 2. ten times wider, at rest -------------------------------------- */
  spMark('wide');
  const spW2 = new SandWorld(2880, 384, 2880);          // a hundred times the volume
  const spDense1 = 290*386*290/1048576, spDense2 = 2882*386*2882/1048576;
  R.push(`TEN TIMES WIDER ${spW2.W}x${spW2.H}x${spW2.D}: ${spMB(spW2).toFixed(2)} MB ` +
         `where the flat grid would have been ${spDense2.toFixed(0)} MB ` +
         (spMB(spW2) < spDense2/50 ? 'ok' : 'FAULT: still paying for the volume'));
  R.push(`  the flat grid was ${spDense1.toFixed(0)} MB at the small size and ` +
         `${spDense2.toFixed(0)} MB at this one; paged is ` +
         `${spMB(spW1).toFixed(2)} and ${spMB(spW2).toFixed(2)}`);

  /* ---- 3. HIS CYLINDER. 100 m wide, 1000 m tall ------------------------- */
  spMark('cylinder');
  {
    const nbx = Math.round(100/BLOCK), nby = Math.round(1000/BLOCK);
    const spCyl = new SandWorld(nbx*SAND_DIV, nby*SAND_DIV, nbx*SAND_DIV);
    const spCells = spCyl.W*spCyl.H*spCyl.D;
    R.push(`THE CYLINDER ${nbx}x${nby}x${nbx} blocks = ` +
           `${spCyl.W}x${spCyl.H}x${spCyl.D} cells (${(spCells/1e9).toFixed(2)} billion): ` +
           `${spMB(spCyl).toFixed(1)} MB against ${(spCells/1048576/1024).toFixed(2)} GB flat`);
    /* and it is a WORLD, not a declaration: write the shell as blocks and read
       it back. A shell of solid rock is uniform blocks, so it costs no pages. */
    const spR = nbx*0.5 - 1.5;
    let spShell = 0;
    for(let by=0; by<nby; by+=17){                        // every 17th layer, to keep it quick
      for(let bz=0; bz<nbx; bz++) for(let bx=0; bx<nbx; bx++){
        const ex=bx-nbx*0.5+0.5, ez=bz-nbx*0.5+0.5;
        const dd=Math.sqrt(ex*ex+ez*ez);
        if(dd > spR || dd < spR-3) continue;
        cFreeBlock(spCyl, bx,by,bz, S_ROCK); spShell++;
      }
    }
    const spMid = (nby>>1) - ((nby>>1)%17);
    const spProbe = spCyl.at(Math.round(nbx*0.5*SAND_DIV), spMid*SAND_DIV+8,
                             Math.round((nbx*0.5 + spR - 1)*SAND_DIV));
    R.push(`  shell: ${spShell} blocks written, still ${spCyl.pgn} pages, ` +
           `${spMB(spCyl).toFixed(1)} MB ` +
           (spCyl.pgn===0 ? 'ok, a solid shell is free' : 'FAULT: uniform blocks allocated'));
    /* one cell of it, read back through the same path the physics uses */
    R.push(`  a cell of the wall reads ${spProbe===S_ROCK?'ROCK':'mat '+spProbe} ` +
           (spProbe===S_ROCK ? 'ok' : 'FAULT: the shell is not there'));
  }

  /* ---- 4. and matter still behaves -------------------------------------- */
  spMark('matter');
  {
    const spW = new SandWorld(96, 96, 96);
    /* a sealed tank of air with a floor, then a block of water dropped in it */
    for(let by=0;by<6;by++) for(let bz=0;bz<6;bz++) for(let bx=0;bx<6;bx++)
      if(by>0) cFreeBlock(spW, bx,by,bz, S_AIR);
    const spBefore = spW.pgn;
    /* SAND FIRST, and on purpose: it is the material with no way out of the
       world. Water is MORTAL - a sheet with open sky over it evaporates, which
       is a feature and would make "beads lost" mean two things at once. */
    let spPour=0;
    for(let y=64;y<80;y++) for(let z=40;z<56;z++) for(let x=40;x<56;x++){ spW.put(x,y,z,S_SAND); spPour++; }
    R.push(`POURED ${spPour} beads of sand: pages ${spBefore} -> ${spW.pgn}, ` +
           `${spMB(spW).toFixed(2)} MB`);
    const spN0 = spW.count(S_SAND);
    const spG = LAD_ON; LAD_ON = false;                 // no ladder: just the physics
    for(let t=0;t<400;t++) sandTick(spW, -1);
    const spN1 = spW.count(S_SAND);
    R.push(`  after 400 ticks: ${spN0} -> ${spN1} beads ` +
           (spN1 === spN0 ? 'ok, matter conserved through the page faults'
                          : `FAULT: ${spN0-spN1} beads lost`));
    let spHeap=0, spDeep=0;
    for(let x=0;x<96;x++) if(spW.at(x, 17, 48)===S_SAND) spHeap++;
    for(let y=0;y<96;y++) if(spW.at(48, y, 48)===S_SAND) spDeep++;
    R.push(`  the heap is ${spHeap} cells across and ${spDeep} deep ` +
           (spHeap > 16 && spDeep > 2 ? 'ok, it fell and it piled' : 'FAULT: it did not move'));

    /* AND WATER, which must find its LEVEL and may legitimately evaporate. So
       the books are balanced against water plus the steam it became. */
    const spW3 = new SandWorld(96, 96, 96);
    for(let by=0;by<6;by++) for(let bz=0;bz<6;bz++) for(let bx=0;bx<6;bx++)
      if(by>0) cFreeBlock(spW3, bx,by,bz, S_AIR);
    for(let y=64;y<80;y++) for(let z=40;z<56;z++) for(let x=40;x<56;x++) spW3.put(x,y,z,S_WATER);
    const spV0 = spW3.count(S_WATER);
    for(let t=0;t<400;t++) sandTick(spW3, -1);
    LAD_ON = spG;
    const spV1 = spW3.count(S_WATER), spSteam = spW3.count(SM_VAP[S_WATER]);
    let spWide=0;
    for(let x=0;x<96;x++) if(spW3.at(x, 17, 48)===S_WATER) spWide++;
    R.push(`  water: ${spV0} -> ${spV1} beads with ${spSteam} of steam, spread ${spWide} across ` +
           (spWide > 16 && spV0-spV1 < spV0*0.1 ? 'ok, it found its level and only its skin went'
                                                : 'FAULT'));
    for(let t=0;t<60;t++) sandTick(spW, -1);
    R.push(`  and 60 more ticks of the heap scan ${spW.stats.scanned} cells ` +
           (spW.stats.scanned < 20000 ? 'ok, it is settling' : 'FAULT: it never settles'));
  }

  /* ---- 5. the real dungeon, end to end ---------------------------------- */
  spMark('dungeon');
  document.querySelector('.diffs [data-m="1"]').click();
  document.querySelector('.diffs [data-d="0"]').click();
  document.getElementById('btnStart').click();
  seed=11; genWorld(0); G.state='play';
  {
    const w = SAND;
    R.push(`DUNGEON ${w.W}x${w.H}x${w.D} cells, ${w.pgn} of ${w.nb} pages live, ` +
           `${spMB(w).toFixed(2)} MB where the flat grid was ` +
           `${(w.W*w.H*w.D/1048576).toFixed(0)} MB`);
    R.push(`  ladder: ${ladStats.blocks} promoted blocks, ${ladStats.masses} masses`);
    let spPeak = 0, spDef = 0;
    for(let t=0;t<90;t++){
      sandTick(w, sandDir()); ladTick();
      if(w.stats.scanned > spPeak) spPeak = w.stats.scanned;
      spDef = w.stats.deferred;
    }
    R.push(`  90 ticks: ${w.stats.scanned} cells scanned on the last, ${w.pgn} pages, ` +
           `${spMB(w).toFixed(2)} MB ` +
           (w.stats.scanned < 5000 ? 'ok, a settled world costs nothing' : 'note: still moving'));
    /* THE SEVEN-METRE SPHERE, measured where it matters: the moment gravity
       reverses and SIX MILLION CELLS OF OCEAN all wake at once. A world at rest
       proves nothing about a ceiling. So: the same 90 ticks twice, once with
       the sphere and once without, and the difference is the whole feature. */
    const spRun = (on) => {
      SIM_SPHERE = on;
      G.gravK = -1; sandWakeLoose();
      let peak=0, tot=0, def=0;
      for(let t=0;t<90;t++){
        sandTick(w, sandDir()); ladTick();
        if(w.stats.scanned > peak) peak = w.stats.scanned;
        tot += w.stats.scanned; def = w.stats.deferred;
      }
      return {peak, tot, def};
    };
    const spOff = spRun(false);
    seed=11; genWorld(0); G.state='play';           // put it back as it was
    const spOn = spRun(true);
    SIM_SPHERE = true;
    R.push(`  THE SPHERE, on the tick the ocean wakes: 7 m holds ${SIM_BEADS} beads.` +
           ` WITHOUT it the busiest tick looked at ${spOff.peak} cells (${spOff.tot} over 90);` +
           ` WITH it, ${spOn.peak} (${spOn.tot} over 90) and ${spOn.def} chunks left for when you walk over ` +
           (spOn.peak <= SIM_BEADS && spOn.peak < spOff.peak
            ? 'ok, under his ceiling and it was over it before'
            : 'FAULT: the ceiling is not holding'));
    /* AND A SHOT STILL BREAKS IT, which is the whole loop: a solid block is one
       byte until it is opened, the page faults in, the beads fly, and when what
       is left of it settles it goes back to being a record. */
    let spBi = -1;
    for(let by=0; by<G.ny && spBi<0; by++) for(let bz=0; bz<G.nz && spBi<0; bz++)
      for(let bx=0; bx<G.nx && spBi<0; bx++)
        if(G.st[idx(bx,by,bz)]!==AIR) spBi = idx(bx,by,bz);
    const spB = cellXYZ(spBi), p0 = w.pgn;
    const spFull = () => { let k=0, o=spB[0]*PGS, oy2=spB[1]*PGS, oz2=spB[2]*PGS;
      for(let ly=0;ly<PGS;ly++) for(let lz=0;lz<PGS;lz++) for(let lx=0;lx<PGS;lx++)
        if(w.at(o+lx, oy2+ly, oz2+lz) !== S_AIR) k++;
      return k; };
    voxelise(spBi);
    const spOpened = w.pgn;
    const spSolid = spFull();
    voxCarve(spBi, 8,8,8, 1,0,0, 40000, null, true);
    const spAfter = spFull();
    for(let t=0;t<180;t++){ sandTick(w, sandDir()); ladTick(); gritStep(1/60); }
    R.push(`  opening one block: pages ${p0} -> ${spOpened} (+${spOpened-p0}), ` +
           `${spMB(w).toFixed(2)} MB ` +
           (spOpened === p0+1 ? 'ok, exactly one block became real' : 'FAULT'));
    R.push(`  shooting it: ${spSolid} beads -> ${spAfter}, ${spSolid-spAfter} taken out ` +
           (spAfter < spSolid ? 'ok, the shot reached the cells' : 'FAULT: the shot did nothing'));
  }

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
