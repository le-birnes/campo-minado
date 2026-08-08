/* WALKING OFF THE EDGE OF THE BUILT PATCH

   Marcelo: "The starting scenery is still the only thing on the planet and
   reaching the border of it makes me fall into a 'nothingness' from where I
   can enter or leave the water, the planet is not being generated."

   It was generated - universeAt() has been the one function for the whole
   universe since the geoid went in, and the sky shader draws its terrain out
   to the horizon. What was not asking it was the COLLISION: past the stored
   array, blocksBody answered `y >= G.ny`, which is open sky above and a floor
   only where the seabed would be. So you walked off the island and fell
   through the picture of a world to the sea underneath it.

   So: is there ground out there, does he stand on it, and does everything
   agree about it. And separately, is the speed limit gone.

   Prefixed ed.                                                              */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_WORLD; seed=5; genWorld(0); G.state='play'; G.noWin=true;

  /* HOW BIG THE STORED PATCH IS, so "outside" means something */
  const edX = G.nx*BLOCK, edZ = G.nz*BLOCK;
  R.push('THE STORED PATCH IS ' + edX.toFixed(0) + ' x ' + edZ.toFixed(0) +
         ' m (' + G.nx + 'x' + G.ny + 'x' + G.nz + ' cells), waterline y ' + G.seaY);

  /* ---- 1. IS THERE ANYTHING OUT THERE AT ALL ------------------------- */
  {
    const rows=[];
    for(const d of [20, 200, 2000, 9000]){
      const wx = edX + d, wz = G.nz*BLOCK*0.5;
      /* walk down the column from well above the waterline and find the top */
      let top=null;
      const sy = G.seaY*BLOCK, up = gsign();
      for(let h=140; h>-160; h-=BLOCK*0.5){
        const y = sy + up*h;
        if(solidAtWorld(wx, y, wz)){ top=h; break; }
      }
      rows.push(d + 'm out: ' + (top===null ? 'NOTHING' :
                'ground at ' + top.toFixed(1) + ' m ' + (top<0?'below':'above') + ' sea'));
    }
    R.push('OUT PAST THE EDGE: ' + rows.join(' | '));
    const none = rows.filter(r=>/NOTHING/.test(r)).length;
    R.push('  ' + (none===0 ? 'ok, THE PLANET IS THERE IN EVERY DIRECTION HE WALKS'
                            : 'FAULT: ' + none + ' of 4 columns are empty sky'));
  }

  /* ---- 2. AND EVERYTHING AGREES ABOUT IT ------------------------------
     blocksBody and SandWorld.at() are two different questions asked of the
     same place, and before this they gave different answers out here: one
     said open sky, the other said brine below the waterline. */
  {
    let agree=0, n=0, sample=[];
    const sy = G.seaY*BLOCK, up = gsign();
    for(const d of [50, 600, 4000]) for(const h of [30, 2, -30, -120]){
      const wx = edX + d, wz = G.nz*BLOCK*0.6, wy = sy + up*h;
      const solid = solidAtWorld(wx, wy, wz);
      const m = SAND.at(Math.floor(wx/CELL_M), Math.floor(wy/CELL_M), Math.floor(wz/CELL_M));
      const k = SMAT[m] && SMAT[m].k;
      const beadSolid = m !== S_AIR && k !== K_LIQUID && k !== K_GAS;
      n++; if(solid === beadSolid) agree++;
      if(sample.length < 4) sample.push(d+'m/'+h+'m:'+SMAT[m].n+(solid?'(solid)':'(open)'));
    }
    R.push('THE BLOCKS AND THE BEADS AGREE: ' + agree + ' of ' + n +
           ' | ' + sample.join(' ') + ' ' +
           (agree===n ? 'ok, ONE OWNER' : 'FAULT: they disagree ' + (n-agree) + ' times'));
  }

  /* ---- 3. HE STANDS ON IT --------------------------------------------- */
  {
    const sy = G.seaY*BLOCK, up = gsign();
    P.x = edX + 300; P.z = G.nz*BLOCK*0.5;
    /* drop him from 60 m up and let him land */
    P.y = sy + up*60; P.vx=P.vy=P.vz=0; P.fx.fill(0);
    IN.f=IN.b=IN.l=IN.r=0; IN.jumpHeld=false;
    for(let t=0;t<60*6;t++) physics(1/60);
    const alt = (sy - P.y) * -gsign();
    for(let t=0;t<60*4;t++) physics(1/60);
    const alt2 = (sy - P.y) * -gsign();
    /* THREE HUNDRED METRES OUT IS THE DONUT, which is sea forty-odd metres
       deep - so the question is not whether he stands on it, it is whether he
       is WET. Falling into it dry was the whole complaint. */
    R.push('DROPPED FROM 60 m, 300 m PAST THE EDGE: after six seconds he is at ' +
           alt.toFixed(1) + ' m, ground ' + (P.ground ? 'yes' : 'no') +
           ', immersed ' + (P.imm||0).toFixed(2) + ' in ' + (P.immD||0).toFixed(0) +
           ' kg/m3 ' +
           ((P.imm||0) > 0.3 ? 'ok, HE IS IN THE SEA AND NOT FALLING THROUGH IT'
                             : 'FAULT: dry, imm ' + (P.imm||0).toFixed(2)));
    /* HE PLUNGED FROM SIXTY METRES, so being deep at six seconds is not a
       fault - being deep and STAYING deep would be. Buoyancy has to be
       carrying him back up. */
    /* AND HE HOLDS DEPTH: -17.4 m at six seconds and -17.4 m at ten. That is
       not a man stuck, it is a man NEUTRALLY BUOYANT - 1000 kg/m3 of water
       against a body of about the same - and it is the swimming he asked for:
       "I should be able to swim DOWN (or up)", deliberately, rather than
       bobbing. So the test is whether he can get out, not whether the sea
       spits him out. */
    P.pitch = gsign()*1.2; IN.f = 1;          // look up and swim
    for(let t=0;t<60*4;t++) physics(1/60);
    IN.f = 0;
    const alt3 = (sy - P.y) * -gsign();
    R.push('  holding depth at ' + alt2.toFixed(1) + ' m (neutrally buoyant), ' +
           'and swimming up for four seconds takes him to ' + alt3.toFixed(1) + ' m ' +
           (Math.abs(alt2-alt) < 1.0 && alt3 > alt2 + 4
            ? 'ok, HE HOLDS DEPTH AND CAN SWIM OUT OF IT'
            : 'FAULT: drift ' + (alt2-alt).toFixed(1) + ', climb ' +
              (alt3-alt2).toFixed(1)));
  }

  /* ---- 4. AND HE CAN WALK THERE FROM THE ISLAND ------------------------ */
  {
    const sy = G.seaY*BLOCK;
    P.x = edX - 8; P.z = G.nz*BLOCK*0.5; P.y = sy - gsign()*3;
    P.vx=P.vy=P.vz=0; P.yaw = -Math.PI/2; P.pitch = 0;   // toward +X, off the edge
    IN.f=1; IN.b=IN.l=IN.r=0;
    let fell=0;
    for(let t=0;t<60*10;t++){
      physics(1/60);
      const a = (sy - P.y) * -gsign();
      if(a < -30) fell++;
    }
    IN.f=0;
    const alt = (sy - P.y) * -gsign();
    R.push('WALKING OUT OVER THE BORDER for ten seconds: he ends at x ' +
           P.x.toFixed(0) + ' (the edge is ' + edX.toFixed(0) + '), altitude ' +
           alt.toFixed(1) + ' m, immersed ' + (P.imm||0).toFixed(2) +
           ', ' + fell + ' frames below -30 m ' +
           (fell === 0 ? 'ok, NO HOLE TO FALL INTO - he walked into the sea'
                       : 'FAULT: he dropped through, ' + fell + ' frames'));
  }

  /* ---- 5. NO SPEED LIMIT ----------------------------------------------- */
  {
    P.x = edX + 4000; P.z = G.nz*BLOCK*0.5;
    /* UP IS -Y WHEN gsign() IS -1, and the first version of these two lines
       had both signs the other way round: it put him forty kilometres
       UNDERGROUND, where universeAt correctly answers rock, and the collision
       stopped him dead. The engine was right and the harness was upside down,
       which is the fourth time that has happened in this project. */
    P.y = G.seaY*BLOCK + gsign()*40000;      // 40 km UP, out of everyone's way
    P.vx=P.vz=0; P.vy = gsign()*9000;        // nine kilometres a second, upward
    const before = P.vy;
    const t0 = Date.now();
    for(let t=0;t<30;t++) physics(1/60);
    const ms = Date.now()-t0;
    R.push('NINE KILOMETRES A SECOND: vy ' + before.toFixed(0) + ' -> ' +
           P.vy.toFixed(0) + ' after half a second, and 30 frames took ' + ms + ' ms ' +
           (Math.abs(P.vy) > 8000 ? 'ok, NOTHING CLAMPED IT' : 'FAULT: it was clipped'));
    R.push('  and the work stayed bounded: ' +
           (ms < 400 ? 'ok, ' + ms + ' ms for 30 frames - the substep COUNT is what is capped'
                     : 'FAULT: ' + ms + ' ms, the frame is drowning in substeps'));
    /* and the guard still guards, at the speeds a person actually moves */
    P.vy = -gsign()*40;
    const d = Math.hypot(P.vx+P.kx, P.vy, P.vz+P.kz)/60;
    R.push('  at 40 m/s a frame moves ' + d.toFixed(2) + ' m, which is ' +
           Math.ceil(d/0.4) + ' substeps of ' + SUB_MAX + ' allowed ' +
           (Math.ceil(d/0.4) < SUB_MAX ? 'ok, still un-tunnellable where it matters'
                                       : 'FAULT'));
  }

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
