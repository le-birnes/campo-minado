/* Does sand.js live in the game, and did 26 neighbours make the pile round?
   Everything here runs on the grid itself, not on the picture. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const f2=v=>v.toFixed(2);

  /* ---- a bare box to pour into, so nothing but the rule is being measured */
  function box(W,H,D){
    const w = new SandWorld(W,H,D);
    for(let y=1;y<H;y++) for(let z=0;z<D;z++) for(let x=0;x<W;x++){
      const r=(y+1)*w.SY+(z+1)*w.SZ+(x+1); w.m[r]=S_AIR;
    }
    return w;                                    // y=0 is the floor, and stays rock
  }
  /* Pour from one cell until it stops accepting, then let it settle. */
  function pour(w, mat, grains, cap){
    const cx=w.W>>1, cz=w.D>>1, top=w.H-3;
    let left=grains, t=0;
    while(t++ < cap){
      for(let k=0;k<6 && left>0;k++) if(w.at(cx,top,cz)===S_AIR){ w.put(cx,top,cz,mat); left--; }
      sandTick(w,-1);
      if(!left && !w.awake.length) break;
    }
    for(let k=0;k<200 && w.awake.length;k++) sandTick(w,-1);
    return t;
  }
  /* How far the base of the heap reaches along a direction, in CELLS of real
     distance, so an axis run and a corner run are comparable. */
  function reach(w, mat, dx, dz){
    const cx=w.W>>1, cz=w.D>>1, len=Math.hypot(dx,dz);
    let r=0;
    for(let s=1;s<(w.W>>1)-1;s++){
      let any=0;
      for(let y=1;y<6 && !any;y++) if(w.at(cx+dx*s,y,cz+dz*s)===mat) any=1;
      if(any) r=s*len;
    }
    return r;
  }
  function shape(w, mat){
    const ax=(reach(w,mat,1,0)+reach(w,mat,-1,0)+reach(w,mat,0,1)+reach(w,mat,0,-1))/4;
    const dg=(reach(w,mat,1,1)+reach(w,mat,1,-1)+reach(w,mat,-1,1)+reach(w,mat,-1,-1))/4;
    return {ax, dg, ratio: ax>0 ? dg/ax : 0};
  }

  /* ================= 1. IS THE PILE ROUND ================= */
  /* A round heap has the same radius in every direction, so diagonal/axis is
     1.00. Four lateral directions can only make a DIAMOND - the reachable set
     is |dx|+|dz| <= n - and a diamond measures 0.71. Eight with equal weight
     would overshoot to a SQUARE at 1.41, which is why the corner is taken at
     1/sqrt(2). */
  const GR = 2600;
  SAND_LAT = 4;
  const w4 = box(80,44,80); pour(w4, S_SAND, GR, 900);
  const s4 = shape(w4, S_SAND);
  SAND_LAT = 8;
  const w8 = box(80,44,80); pour(w8, S_SAND, GR, 900);
  const s8 = shape(w8, S_SAND);
  R.push(`PILE 4 lateral: axis ${f2(s4.ax)} diag ${f2(s4.dg)} cells, diag/axis ${f2(s4.ratio)} (a diamond is 0.71)`);
  R.push(`PILE 8 lateral: axis ${f2(s8.ax)} diag ${f2(s8.dg)} cells, diag/axis ${f2(s8.ratio)} (round is 1.00)`);
  const roundErr4=Math.abs(s4.ratio-1), roundErr8=Math.abs(s8.ratio-1);
  R.push(`ROUNDNESS: 26 neighbours is off by ${f2(roundErr8)}, 6 by ${f2(roundErr4)} - ` +
         (roundErr8 < roundErr4 ? 'ROUNDER' : 'NO BETTER'));

  /* ================= 2. LIQUID FINDS ITS LEVEL ================= */
  SAND_LAT = 8;
  const wl = box(80,44,80); pour(wl, S_WATER, GR, 900);
  const sl = shape(wl, S_WATER);
  /* HEIGHT is the honest test, not width. A powder HEAPS and a liquid does
     not, and that is the one bit of difference between them; comparing radii
     compares two different shapes of the same volume and says less. */
  function peak(w, mat){
    const cx=w.W>>1, cz=w.D>>1; let top=0;
    for(let x=cx-2;x<=cx+2;x++) for(let z=cz-2;z<=cz+2;z++)
      for(let y=1;y<w.H-1;y++) if(w.at(x,y,z)===mat && y>top) top=y;
    return top;
  }
  const hw=peak(wl,S_WATER), hs=peak(w8,S_SAND);
  R.push(`WATER: ${f2(sl.ax)} cells across, ${hw} tall; SAND: ${f2(s8.ax)} across, ${hs} tall ` +
         (hw*2 < hs ? 'ok, the liquid does not heap' : 'FAULT: liquid heaps'));
  R.push(`WATER isotropy: diag/axis ${f2(sl.ratio)} (powder is ${f2(s8.ratio)})`);

  /* ================= 3. SETTLED COSTS NOTHING ================= */
  const before = w8.stats.scanned;
  let awake=0; for(let k=0;k<30;k++){ sandTick(w8,-1); awake+=w8.stats.awake; }
  R.push(`DIRTY RECT: ${GR} beads at rest, ${awake} chunks awake over 30 ticks, ` +
         `${w8.stats.scanned} cells scanned ` + (awake===0 ? 'ok' : 'FAULT'));

  /* ================= 4. WHAT 26 COSTS =================
     NOT in nanoseconds: run_harness drives Chrome under a virtual time budget,
     which freezes performance.now(), so every timing taken in here reads 0.00.
     The 3.7x (49.4 ns a particle against 13.1) is measured on a real page in
     voxel/storm.html and stands. What CAN be counted under virtual time is
     work, so this counts it: cells looked at, and moves got out of them. */
  function work(lat){
    SAND_LAT=lat;
    const w=box(64,64,64);
    const cx=w.W>>1, cz=w.D>>1;
    for(let y=20;y<44;y++) for(let z=cz-10;z<cz+10;z++) for(let x=cx-10;x<cx+10;x++) w.put(x,y,z,S_SAND);
    let cells=0, moves=0;
    for(let k=0;k<60;k++){ const m0=w.stats.moves; sandTick(w,-1); cells+=w.stats.scanned; moves+=w.stats.moves-m0; }
    return {cells, moves, settled: w.awake.length===0};
  }
  const k4=work(4), k8=work(8);
  SAND_LAT=8;
  R.push(`WORK 4 lateral: ${k4.cells} cells scanned, ${k4.moves} moves, settled ${k4.settled}`);
  R.push(`WORK 8 lateral: ${k8.cells} cells scanned, ${k8.moves} moves, settled ${k8.settled}`);

  /* ================= 5. REACTIONS, WHICH THE GAME NEVER HAD ================= */
  function rxTest(a,b,want){
    const w=box(36,36,36);
    const cx=18,cz=18;
    for(let x=cx-3;x<=cx+3;x++) for(let z=cz-3;z<=cz+3;z++){ w.put(x,3,z,b); w.put(x,4,z,a); }
    for(let k=0;k<80;k++) sandTick(w,-1);
    return w.count(want);
  }
  R.push(`RX water on fire -> steam: ${rxTest(S_FIRE,S_WATER,S_STEAM)} cells`);
  R.push(`RX lava on sand -> glass: ${rxTest(S_LAVA,S_SAND,S_GLASS)} cells`);
  R.push(`RX water on sand -> wet sand: ${rxTest(S_WATER,S_SAND,S_WETSND)} cells`);
  R.push(`RX acid on rock -> air: ${rxTest(S_ACID,S_ROCK,S_AIR)>0?'eaten':'FAULT'}`);

  /* ================= 6. AND IT IS IN THE GAME ================= */
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  R.push(`GRID: ${SAND.W}x${SAND.H}x${SAND.D} cells, ${(SAND.N/1048576).toFixed(1)} MB, ` +
         `${SAND.nc} chunks, bead ${f2(CELL_M)} m`);
  let tgt=-1, air=-1;
  for(let y=0;y<G.ny&&tgt<0;y++) for(let z=0;z<G.nz&&tgt<0;z++) for(let x=0;x<G.nx&&tgt<0;x++){
    const i=idx(x,y,z);
    if(G.st[i]!==SOLID||G.mine[i]) continue;
    for(const j of nbrsOf(i)) if(G.st[j]===AIR){ tgt=i; air=j; break; }
  }
  const tc=cellXYZ(tgt), ac=cellXYZ(air);
  const loose0 = SAND.count(S_SAND)+SAND.count(S_RUBBLE)+SAND.count(S_WATER);
  R.push(`a fresh board holds ${loose0} loose cells (should be 0)`);
  sandBurst(tc[0],tc[1],tc[2], Math.sign(tc[0]-ac[0]),Math.sign(tc[1]-ac[1]),Math.sign(tc[2]-ac[2]), 150);
  let live=0; for(let i=0;i<GRIT.n;i++) if(GRIT.live[i]) live++;
  R.push(`one block burst -> ${live} beads in the air`);
  for(let k=0;k<420;k++) sandStep(1/60);
  const sd=SAND.count(S_SAND), rb=SAND.count(S_RUBBLE), wt=SAND.count(S_WATER), ws=SAND.count(S_WETSND);
  R.push(`landed into the grid: ${sd} sand, ${rb} rubble, ${wt} water, ${ws} wet sand`);
  live=0; for(let i=0;i<GRIT.n;i++) if(GRIT.live[i]) live++;
  R.push(`still in the air: ${live} ` + (live===0?'ok':'some never landed'));
  for(let k=0;k<600;k++) sandStep(1/60);
  const sd2=SAND.count(S_SAND)+SAND.count(S_RUBBLE)+SAND.count(S_WATER)+SAND.count(S_WETSND);
  R.push(`PERSISTENCE: ${sd2} cells still there after 10 more seconds ` +
         (sd2>=sd+rb+wt+ws-2 ? 'ok' : 'FADED'));

  /* the picture has a budget and the simulation does not */
  P.x=(tc[0]+0.5)*BLOCK; P.y=(tc[1]+0.5)*BLOCK; P.z=(tc[2]+0.5)*BLOCK;
  const drawn = sandDraw();
  R.push(`DRAWN: ${drawn} of ${SAND_DRAW_MAX} instances, ${sandB.count} in the batch ` +
         (drawn<=SAND_DRAW_MAX ? 'ok' : 'OVERFLOW'));

  /* opening a block is the mountain becoming beads, and not before */
  R.push(`OPEN BLOCKS: ${VOXD.size} of ${G.nx*G.ny*G.nz}`);

  /* ================= 7. AND THE BIG ONE ================= */
  G.mode=MODE_DUNGEON; seed=11; genWorld(2, true); G.state='play';
  R.push(`DUNGEON GRID: ${SAND.W}x${SAND.H}x${SAND.D}, ${(SAND.N/1048576).toFixed(0)} MB, ` +
         `${SAND.nc} chunks, ${SAND.awake.length} awake at rest`);
  let t0=SAND.stats.scanned;
  for(let k=0;k<60;k++) sandStep(1/60);
  R.push(`a quiet dungeon: ${SAND.stats.scanned} cells scanned on the last of 60 ticks, ` +
         `${SAND.awake.length} chunks awake ` + (SAND.awake.length===0?'ok':'FAULT'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r = R.join(' ~ ');
}catch(err){
  document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'');
}}, 300);
