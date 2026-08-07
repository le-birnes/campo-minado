/* WHAT IS THE SQUARE?

   From high above the world he sees a light blue SQUARE with stepped edges,
   floating in dark navy. Stepped edges means BLOCKS, so something is drawing
   geometry up there. This asks each pass separately what it emitted and WHERE
   - the bounding box of the instances, in metres - because "a flat plate at
   the waterline" and "a cube around him" and "the island" are three different
   answers and they look the same from inside a screenshot. Prefixed hi. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.noWin=true; G.gravK=-1; rollReset(); ROLL_T=0; G.outerLive=true;
  revealIsland(); bossHole((G.holeX+0.5)*BLOCK,(G.holeZ+0.5)*BLOCK);
  G.island=true;
  const R=[];

  /* the instance buffer holds a mat4 whose translation is at 12,13,14 */
  const hiBox = (buf, n) => {
    if(!n) return 'nothing';
    let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;
    for(let i=0;i<n;i++){
      const o=i*CUBE_STRIDE, x=buf[o+12], y=buf[o+13], z=buf[o+14];
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z;
    }
    return n + ' instances spanning ' + (x1-x0).toFixed(0) + ' x ' + (y1-y0).toFixed(0) +
           ' x ' + (z1-z0).toFixed(0) + ' m, at y ' + y0.toFixed(0) + '..' + y1.toFixed(0);
  };

  for(const hiUp of [10, 60, 200, 1200]){
    /* small y is UP once down is +Y */
    P.x=(G.nx*0.5)*BLOCK; P.z=(G.nz*0.5)*BLOCK;
    P.y=(G.seaY*BLOCK) - hiUp;
    P.vx=P.vy=P.vz=0; P.yaw=0; P.pitch=0;
    G.dirty=true; rebuildWorld();
    const nWorld = worldB.count;
    const nSand  = sandDraw();
    const nMass  = ladDraw(sandB.data, 0);
    R.push(hiUp + " m above the waterline:");
    R.push('   BLOCK pass ' + hiBox(worldB.data, nWorld));
    R.push('   BEAD+MASS  ' + hiBox(sandB.data, nSand) + '  (of which the mass pass drew ' + nMass + ')');
  }
  R.push('for scale: the world is ' + (G.nx*BLOCK).toFixed(0) + ' m across, ' +
         'the waterline is at y ' + (G.seaY*BLOCK).toFixed(0) + ' m, ' +
         'and the sea is ' + (G.seaB?G.seaB.length:0) + ' cell-blocks');

  /* WHAT IS ACTUALLY OVERHEAD, layer by layer. Down is +Y, so small y is UP -
     and the island's top face is at G.rock0. Anything solid ABOVE that line is
     a ceiling over the world, and its material says what built it. */
  R.push('LAYERS, from the sky down (small y is UP):');
  for(let y=0; y<G.ny; y++){
    let n=0; const kind={};
    for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      const i=idx(x,y,z);
      if(G.st[i]===AIR) continue;
      n++; const k=G.mat[i]; kind[k]=(kind[k]||0)+1;
    }
    if(!n) continue;
    const top = Object.keys(kind).sort((a,b)=>kind[b]-kind[a]).slice(0,2)
                  .map(k=>'mat'+k+' x'+kind[k]).join(', ');
    const tag = y < G.rock0 ? '   <- ABOVE THE ISLAND: this is a ceiling' : '';
    R.push('  y ' + y + (y===G.rock0?' (beach)':'') + (y===G.seaY?' (waterline)':'') +
           ': ' + n + ' blocks, ' + top + tag);
  }
  R.push('G.lava is ' + (G.lava?'ON':'off') + ', hull ' +
         (G.hull?G.hull.reduce((a,b)=>a+b,0):0) + ' blocks, island top y ' + G.rock0);
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message; }}, 300);

