/* IS THERE A WORLD DRAWN PAST THE STORED PATCH

   Marcelo, three photographs from the edge and one from above it: "This shows
   how the world is only being generated up to an extent and beyond this is
   emptyness."

   He could already STAND out there - collision and materials have come from
   universeAt since the last change - but nothing drew it, so the array was a
   square plate with its underside showing and a painted wash behind it.

   Counting cubes, not looking at them:
     1. are there any at all past the array, and how far out do they reach
     2. do they follow him when he walks
     3. do they sit at the height the GROUND is at - the same bodyH() the
        collision and the horizon use
     4. is the sea out there drawn at the waterline, in the ocean's colour
     5. and does it stay inside the instance budget

   Prefixed fa.                                                              */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_WORLD; seed=5; genWorld(0); G.state='play'; G.noWin=true;
  const sy = G.seaY*BLOCK, gs = gsign();
  const inArray = (x,z) => x > -BLOCK && x < (G.nx+1)*BLOCK &&
                           z > -BLOCK && z < (G.nz+1)*BLOCK;

  /* every cube in the batch, as {x,y,z,s} - the instance matrix is column
     major and composeAA puts the translation in 12..14 and the scale on the
     diagonal */
  function faCubes(){
    const d = worldB.data, out = [];
    for(let i=0;i<worldB.count;i++){
      const o=i*CUBE_STRIDE;
      out.push({x:d[o+12], y:d[o+13], z:d[o+14], s:d[o],
                r:d[o+16], g:d[o+17], b:d[o+18]});
    }
    return out;
  }

  /* ---- 1. ANYTHING OUT THERE, AND HOW FAR --------------------------- */
  G.dirty = true; rebuildWorld();
  {
    const all = faCubes();
    const far = all.filter(c => !inArray(c.x, c.z));
    let reach = 0;
    for(const c of far) reach = Math.max(reach,
      Math.max(Math.abs(c.x - P.x), Math.abs(c.z - P.z)));
    R.push('CUBES DRAWN: ' + all.length + ' in all, ' + far.length +
           ' of them PAST the stored patch, reaching ' + reach.toFixed(0) + ' m ' +
           (far.length > 2000 && reach > 700
            ? 'ok, THERE IS A WORLD OUT THERE NOW'
            : 'FAULT: ' + far.length + ' cubes, ' + reach.toFixed(0) + ' m'));
    const sizes = {};
    for(const c of far) sizes[c.s.toFixed(1)] = (sizes[c.s.toFixed(1)]||0)+1;
    R.push('  and it coarsens with distance: ' +
           Object.keys(sizes).sort((a,b)=>a-b).map(k=>k+' m x'+sizes[k]).join(', '));
  }

  /* ---- 2. IT FOLLOWS HIM ---------------------------------------------- */
  {
    const before = faCubes().filter(c=>!inArray(c.x,c.z)).length;
    P.x += 300*BLOCK;                       // a long way off the patch
    G.dirty = true; rebuildWorld();
    const after = faCubes().filter(c=>!inArray(c.x,c.z));
    let near = 0;
    for(const c of after) if(Math.abs(c.x-P.x) < 40 && Math.abs(c.z-P.z) < 40) near++;
    R.push('WALKED 1350 m OFF THE PATCH: ' + before + ' cubes -> ' + after.length +
           ', of which ' + near + ' are within 40 m of him ' +
           (near > 100 ? 'ok, THE WORLD MOVES WITH HIM'
                       : 'FAULT: only ' + near + ' near him'));
  }

  /* ---- 3. AT THE HEIGHT THE GROUND ACTUALLY IS ------------------------ */
  {
    const pb = bodyPlanet();
    let n=0, bad=0, worst=0, sample='';
    for(const c of faCubes()){
      if(inArray(c.x,c.z)) continue;
      const h = bodyH(pb, Math.hypot(c.x-pb.fx, c.z-pb.fz));
      /* land sits with its top face at the ground; sea sits at the waterline */
      const wantTop = sy + gs*Math.max(h, 0);
      /* the UP face, and up is +gsign() in Y - the first version of this
         subtracted and was measuring the bottom of every cube */
      const top = c.y + gs*c.s*0.5;
      const err = Math.abs(top - wantTop);
      n++; if(err > 0.01){ bad++; if(err>worst){ worst=err;
        sample = 'at ' + c.x.toFixed(0) + ',' + c.z.toFixed(0) + ' top ' +
                 top.toFixed(2) + ' wanted ' + wantTop.toFixed(2); } }
    }
    R.push('EVERY CUBE SITS ON bodyH(): ' + (n-bad) + ' of ' + n + ' exact' +
           (bad ? ', worst ' + worst.toFixed(2) + ' m ' + sample : '') + ' ' +
           (bad === 0 ? 'ok, THE SAME CURVE THE COLLISION AND THE HORIZON USE'
                      : 'FAULT: ' + bad + ' are not on the ground'));
  }

  /* ---- 4. AND THE SEA IS THE SEA -------------------------------------- */
  {
    const pb = bodyPlanet(), seaC = MATS[M_SALT].c;
    let sea=0, land=0, wrong=0;
    for(const c of faCubes()){
      if(inArray(c.x,c.z)) continue;
      const h = bodyH(pb, Math.hypot(c.x-pb.fx, c.z-pb.fz));
      const isSeaCol = Math.abs(c.r-seaC[0])<1e-4 && Math.abs(c.g-seaC[1])<1e-4;
      if(h < 0){ sea++; if(!isSeaCol) wrong++; }
      else     { land++; if(isSeaCol) wrong++; }
    }
    R.push('THE DONUT IS DRAWN AS SEA: ' + sea + ' water columns, ' + land +
           ' land, ' + wrong + ' the wrong colour ' +
           (sea > 500 && wrong === 0
            ? 'ok, ONE OCEAN, ONE COLOUR - the hard line in the photograph was '
              + 'one sea drawn two ways'
            : 'FAULT: ' + wrong + ' wrong'));
  }

  /* ---- 5. AND IT FITS ------------------------------------------------- */
  R.push('THE BUDGET: ' + worldB.count + ' of ' + worldB.max + ' instances (' +
         (100*worldB.count/worldB.max).toFixed(0) + '%) ' +
         (worldB.count < worldB.max*0.9 ? 'ok, room to spare'
                                        : 'FAULT: the batch is nearly full'));
  {
    const t0 = Date.now(); for(let i=0;i<10;i++){ G.dirty=true; rebuildWorld(); }
    R.push('  and a rebuild costs ' + ((Date.now()-t0)/10).toFixed(1) +
           ' ms, which happens when he crosses a 4.5 m block');
  }

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
