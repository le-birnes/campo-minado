/* DO THE BEADS LAND ON THE GROUND, AND CAN YOU SEE THEM?

   "Block mechanic is broken, beads no longer interact with the ground when
   falling from block (look visual only)."

   h_sand says grit lands and piles in a tank, so it is something about the
   REAL world - a floor that is a BLOCK rather than beads. This shoots a wall
   in an actual dungeon, lets everything settle, and then asks three separate
   questions that "it does not work" runs together: did the beads come to rest,
   are they in the grid, and is anything DRAWING them. Prefixed pl. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  const R=[];
  const w=SAND;

  /* an air block with a floor under it - down is -Y here, so the floor is y+1
     in array terms only if gravity says so; ask sandDir */
  const dn = sandDir();
  let ax=-1, ay=-1, az=-1, wallI=-1;
  outer:
  for(let y=2;y<G.ny-2;y++) for(let z=2;z<G.nz-2;z++) for(let x=2;x<G.nx-3;x++){
    if(G.st[idx(x,y,z)]!==AIR) continue;
    if(G.st[idx(x,y+dn,z)]===AIR) continue;              // needs a floor
    if(G.st[idx(x+1,y,z)]===AIR) continue;               // and a wall beside it
    if(G.hull && (G.hull[idx(x,y+dn,z)]||G.hull[idx(x+1,y,z)])) continue;
    ax=x; ay=y; az=z; wallI=idx(x+1,y,z); break outer;
  }
  if(ax<0){ R.push('no air block with a floor and a wall - nothing to test'); }
  else {
    R.push('standing in air block ' + ax+','+ay+','+az +
           ', floor below at y ' + (ay+dn) + ', wall at x ' + (ax+1));
    P.x=(ax+0.5)*BLOCK; P.y=ay*BLOCK+0.2; P.z=(az+0.5)*BLOCK;
    P.vx=P.vy=P.vz=0;

    /* count over a 5x5x5 BLOCK neighbourhood - the debris is thrown ALONG the
       shot, into the wall, so looking only where he stands is looking in the
       wrong place, and the first version of this reported 0 while the wall held
       eight thousand cells */
    const cellsIn = (bx,by,bz) => {
      let n=0;
      for(let dy=-2;dy<=2;dy++) for(let dz=-2;dz<=2;dz++) for(let dx=-2;dx<=2;dx++){
        const X=bx+dx, Y=by+dy, Z=bz+dz;
        if(X<0||Y<0||Z<0||X>=G.nx||Y>=G.ny||Z>=G.nz) continue;
        for(let ly=0;ly<SAND_DIV;ly++) for(let lz=0;lz<SAND_DIV;lz++) for(let lx=0;lx<SAND_DIV;lx++){
          const m = w.at(X*SAND_DIV+lx, Y*SAND_DIV+ly, Z*SAND_DIV+lz);
          if(m!==S_AIR && m!==S_ROCK) n++;
        }
      }
      return n;
    };
    const before = cellsIn(ax,ay,az);
    const wallCells = () => { let n=0;
      for(let ly=0;ly<SAND_DIV;ly++) for(let lz=0;lz<SAND_DIV;lz++) for(let lx=0;lx<SAND_DIV;lx++){
        const m=w.at((ax+1)*SAND_DIV+lx, ay*SAND_DIV+ly, az*SAND_DIV+lz);
        if(m!==S_AIR && m!==S_ROCK) n++; }
      return n; };
    const thrown0 = [];
    R.push('  the wall holds ' + wallCells() + ' loose cells BEFORE the shot (voxelised: ' +
           VOXD.has(wallI) + ')');
    /* shoot the wall from inside the air block */
    for(let k=0;k<3;k++){
      thrown0.push(sandBlast((ax+0.9)*BLOCK,(ay+0.5)*BLOCK,(az+0.5)*BLOCK, 1,0,0, 1.0));
      for(let t=0;t<60;t++){ gritStep(1/60); sandTick(w, dn); ladTick(); }
    }
    R.push('  the three shots threw ' + thrown0.join(', ') + ' beads; ' +
           'the wall now holds ' + wallCells() + ' loose cells (voxelised: ' +
           VOXD.has(wallI) + ', G.st says ' + (G.st[wallI]===AIR?'AIR':'SOLID') + ')');
    R.push('  ' + LOG.filter(l=>/blast:/.test(l)).slice(-1)[0] || '  the blast logged nothing');
    for(let t=0;t<240;t++){ gritStep(1/60); sandTick(w, dn); ladTick(); }
    const after = cellsIn(ax,ay,az);
    R.push('loose beads in the 5x5x5 around him: ' + before + ' -> ' + after + ' ' +
           (after > 500 ? 'ok, A PILE FORMED ON THE FLOOR'
                        : 'FAULT: nothing came to rest here'));
    R.push('  grit still in the air: ' + (GRIT.moving||0) +
           ' | pages ' + w.pgn + ' | the floor block is ' +
           (G.st[idx(ax,ay+dn,az)]===AIR ? 'GONE (collapsed)' : 'still solid'));

    /* and can anything SEE them? the bead pass, standing right there */
    P.x=(ax+0.5)*BLOCK; P.y=ay*BLOCK+0.2; P.z=(az+0.5)*BLOCK;
    const drew = sandDraw();
    const mass = ladDraw(sandB.data, 0);
    R.push('  the bead pass drew ' + drew + ' instances (' + mass + ' of them the mass pass), ' +
           'so ' + (drew-mass) + ' beads are visible ' +
           ((drew-mass) > 50 ? 'ok, you can see the pile' : 'FAULT: THE PILE IS INVISIBLE'));
    /* WHY does the bead pass see nothing? It only ever considers chunks whose
       cl flag is set and which are inside SAND_DRAW_R. Count both. */
    {
      let clN=0, near=0, CM=SCS*CELL_M;
      for(let c=0;c<w.nc;c++){
        if(!w.cl[c]) continue;
        clN++;
        const cx2=c%w.CW, q2=(c/w.CW)|0, cz2=q2%w.CD, cy2=(q2/w.CD)|0;
        const ex=(cx2+0.5)*CM-P.x, ey=(cy2+0.5)*CM-P.y, ez=(cz2+0.5)*CM-P.z;
        if(ex*ex+ey*ey+ez*ez < SAND_DRAW_R*SAND_DRAW_R) near++;
      }
      R.push('  chunks flagged drawable: ' + clN + ' of ' + w.nc +
             ', of those within ' + SAND_DRAW_R.toFixed(0) + ' m of him: ' + near +
             ' | a chunk is ' + CM.toFixed(2) + ' m, he is at ' +
             (P.x/CM).toFixed(1)+','+(P.y/CM).toFixed(1)+','+(P.z/CM).toFixed(1) + ' chunks');
    }
    R.push('  the air block is voxelised: ' + VOXD.has(idx(ax,ay,az)) +
           ', hollow-flagged: ' + VOXHOLLOW.has(idx(ax,ay,az)) +
           ' | chunk drawable flag set: ' +
           (!!w.cl[ladChunkOf(w, ax*LAT_DIV, ay*LAT_DIV, az*LAT_DIV)]));
  }
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
