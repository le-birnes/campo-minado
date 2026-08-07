/* WHERE DID THE BEADS GO?

   His photographs from the island show the sea as ONE FLAT TRANSLUCENT SLAB
   with a visible edge, and no beads anywhere. h_batch says the pass returns
   5,000 instances, which is exactly LAD_DRAW_MAX - so the mass pass is spending
   the entire budget and the bead pass is drawing nothing at all.

   This stands him on the beach and reports the two passes separately, with
   every radius that gates them, so the answer is a number rather than a guess.
   Prefixed dr. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.noWin=true; G.gravK=-1; rollReset(); G.outerLive=true;
  revealIsland(); bossHole((G.holeX+0.5)*BLOCK, (G.holeZ+0.5)*BLOCK);
  G.island=true;

  /* stand on the beach, at the waterline, looking out to sea */
  const drCx=(G.nx*0.5)|0, drCz=(G.nz*0.5)|0;
  let drBx=drCx, drBz=drCz;
  /* walk outward until we are on sand at the waterline */
  for(let r=0;r<G.nx*0.5;r++){
    const x=drCx+r;
    if(x>=G.nx) break;
    if(G.st[idx(x,G.seaY,drCz)]!==AIR){ drBx=x; break; }
  }
  P.x=(drBx+0.5)*BLOCK; P.z=(drBz+0.5)*BLOCK; P.y=(G.seaY-1)*BLOCK;
  P.vx=P.vy=P.vz=0; P.yaw=0; P.pitch=0;
  G.dirty=true; rebuildWorld();

  const R=[];
  const w=SAND;
  R.push(`radii: bead ${SAND_BEAD_R} m, mass ${LAD_MASS_R} m, far ${LAD_DRAW_R} m, ` +
         `chunk draw ${SAND_DRAW_R} m | a chunk is ${(SCS*CELL_M).toFixed(2)} m, ` +
         `a cell ${BLOCK} m, a bead ${CELL_M.toFixed(4)} m`);

  /* the two passes, separately */
  const d = sandB.data;
  const drMass = ladDraw(d, 0);
  const drTotal = sandDraw();
  R.push(`MASS pass ${drMass} instances (cap ${LAD_DRAW_MAX}) | ` +
         `WHOLE pass ${drTotal} (cap ${SAND_DRAW_MAX}) | ` +
         `so the BEAD pass drew ${drTotal - drMass} ` +
         (drTotal - drMass > 0 ? 'ok' : '  <- NO BEADS AT ALL'));

  /* why: how many chunks are even candidates */
  let drCl=0, drNear=0;
  const CM = SCS*CELL_M;
  for(let c=0;c<w.nc;c++){
    if(!w.cl[c]) continue;
    drCl++;
    const cx=c%w.CW, q=(c/w.CW)|0, cz=q%w.CD, cy=(q/w.CD)|0;
    const ex=(cx+0.5)*CM-P.x, ey=(cy+0.5)*CM-P.y, ez=(cz+0.5)*CM-P.z;
    if(ex*ex+ey*ey+ez*ez < SAND_DRAW_R*SAND_DRAW_R) drNear++;
  }
  R.push(`chunks flagged drawable ${drCl} of ${w.nc}, within the draw radius ${drNear} ` +
         (drNear > 0 ? 'ok, there are candidates' : '  <- nothing near enough to draw'));

  /* and how much sea is within arm's reach, in LAT blocks */
  let drSea=0, drSeaNear=0;
  for(let bi=0; bi<LADM.length; bi++){
    if(LADM[bi] !== S_SALT) continue;
    drSea++;
    const x=bi%LNX, q=(bi/LNX)|0, z=q%LNZ, y=(q/LNZ)|0;
    const ex=(x+0.5)*LAT_M-P.x, ey=(y+0.5)*LAT_M-P.y, ez=(z+0.5)*LAT_M-P.z;
    if(ex*ex+ey*ey+ez*ez < SAND_BEAD_R*SAND_BEAD_R) drSeaNear++;
  }
  R.push(`sea promoted ${drSea} lattice blocks, ${drSeaNear} of them inside the bead radius`);

  /* the masses, and whether one of them is being drawn as a single box */
  const drBig = MASSES.filter(m=>m && !m.dead && m.n>=LAD_MASS_MIN);
  R.push('masses ' + drBig.length + ': ' + drBig.slice(0,3).map(m=>{
    const bw=m.x1-m.x0+1, bh=m.y1-m.y0+1, bd=m.z1-m.z0+1;
    return `${SMAT[m.mat]?SMAT[m.mat].n:m.mat} n=${m.n} box ${bw}x${bh}x${bd} ` +
           `fill=${(m.n/(bw*bh*bd)).toFixed(2)}${m.n >= bw*bh*bd*0.55 ? ' DRAWN AS ONE BOX' : ''}`;
  }).join(' | '));

  R.push(`you are at ${(P.x/BLOCK).toFixed(1)},${(P.y/BLOCK).toFixed(1)},${(P.z/BLOCK).toFixed(1)} cells, ` +
         `waterline ${G.seaY}, in ${SMAT[w.at(sandCell(P.x),sandCell(P.y),sandCell(P.z))]?SMAT[w.at(sandCell(P.x),sandCell(P.y),sandCell(P.z))].n:'?'}`);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
