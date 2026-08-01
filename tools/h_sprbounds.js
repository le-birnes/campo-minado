/* Does any drawing run off its tile? A clipped sprite loses its feet in game
   and the sheet is too small on screen to be sure by eye. Measure the opaque
   bounding box of every tile and report anything touching an edge. */
setTimeout(()=>{ try{
  const cv = buildSprites();
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const px = g.getImageData(0,0,W,H).data;
  const R=[];
  R.push(`sheet ${W}x${H}, roster ${HELL.length}`);
  // tile grid: however buildSprites lays it out, SPR_N per row
  const cols = SPR_N, tw = SPR_TILE, th = SPR_TILE;
  let clipped=[], empty=[];
  for(let i=0;i<HELL.length;i++){
    const tl=HELL[i].tile, tx=(tl%cols)*tw, ty=((tl/cols)|0)*th;
    let x0=1e9,y0=1e9,x1=-1,y1=-1, opaque=0;
    for(let y=0;y<th;y++) for(let x=0;x<tw;x++){
      const a = px[(((ty+y)*W)+(tx+x))*4+3];
      if(a<10) continue;
      opaque++;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
    }
    if(!opaque){ empty.push(HELL[i].name); continue; }
    const touch = (x0<=0?'L':'')+(x1>=tw-1?'R':'')+(y0<=0?'T':'')+(y1>=th-1?'B':'');
    if(touch) clipped.push(`${HELL[i].name}[${touch}]`);
  }
  R.push(`tile ${tw}x${th} | drawings running to the tile edge: `+
         (clipped.length ? clipped.join(' ') : 'none'));
  R.push(`empty tiles: ${empty.length ? empty.join(' ') : 'none'}`);
  window.__st = R.join(' | ');
}catch(e){ window.__st = 'THROW '+e.message; } }, 600);
setTimeout(()=>{ document.body.dataset.r = window.__st || 'DID NOT RUN'; }, 4000);
