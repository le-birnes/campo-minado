/* WHICH WAY IS UP, AND WHAT IS OVER HIS HEAD?

   agy watched the video and said the world is "the inner surfaces of a large
   cube surrounding the player, with sharp corner seams OVERHEAD, light blue
   with white square cloud patterns on the sides and orange-tinted squares on
   the flat ceiling", and that there is NO WATER and NO SUN OR MOON anywhere.

   Blue tiles with pink squares is the SEA, drawn as blocks. So the ocean is
   being drawn above him and around him, hiding the sky shader entirely - and
   there are only two ways that happens. Either the camera's up does not agree
   with gravity's up, or the sea genuinely is over his head.

   This asks both, in numbers. Prefixed ud. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
document.body.dataset.r='STAGE start';
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=5; genWorld(0); G.state='play';
  G.noWin=true; G.gravK=-1; rollReset(); G.outerLive=true;
  revealIsland(); bossHole((G.holeX+0.5)*BLOCK,(G.holeZ+0.5)*BLOCK);
  G.island=true;

  /* stand him on the beach: walk out from the middle until there is sand under
     his feet and air at his head */
  const udC=(G.nx*0.5)|0;
  let ux=-1, uy=-1, uz=udC;
  for(let r=1;r<G.nx*0.5 && ux<0;r++){
    const x=udC+r;
    for(let y=1;y<G.ny-1;y++){
      if(G.st[idx(x,y,uz)]===AIR && G.st[idx(x,y+sandDir(),uz)]!==AIR){ ux=x; uy=y; break; }   /* the FLOOR is one step along gravity, and down is +Y here */
    }
  }
  if(ux<0){ ux=udC; uy=(G.seaY-1)|0; }
  P.x=(ux+0.5)*BLOCK; P.y=uy*BLOCK+0.1; P.z=(uz+0.5)*BLOCK;
  P.vx=P.vy=P.vz=0; P.yaw=0; P.pitch=0;

  R.push('gravK ' + G.gravK + ', gsign ' + gsign() + ', sandDir ' + sandDir() +
         ' | SKY.up ' + (typeof SKY!=='undefined' ? SKY.up : '?') +
         ' | standing at cell ' + ux + ',' + uy + ',' + uz + ', waterline ' + G.seaY);
  R.push('  so DOWN is ' + (gsign()>0 ? '-Y' : '+Y') +
         ' and UP is ' + (gsign()>0 ? '+Y' : '-Y') +
         '; the sea fills y >= ' + G.seaY + ', which is ' +
         (gsign()>0 ? 'ABOVE him' : 'BELOW him') + ' in world terms');

  /* what is actually over his head, walked in the direction HIS UP points */
  const udUp = -sandDir();                     // one block toward his ceiling
  let udSaw = 'nothing but air';
  for(let k=1;k<G.ny;k++){
    const y = uy + udUp*k;
    if(y<0||y>=G.ny) break;
    const i = idx(ux,y,uz);
    if(G.st[i]!==AIR){ udSaw = 'a block of ' + (G.mat[i]) + ' at y ' + y; break; }
    if(G.seaB && G.seaB.indexOf(i)>=0){ udSaw = 'SEA at y ' + y; break; }
  }
  R.push('  above his head, in his own up: ' + udSaw);

  /* and what the CAMERA thinks up is */
  const b = (typeof viewBasis === "function") ? viewBasis() : null;
  if(b) R.push('  camera up vector y = ' + (b.uy!==undefined ? b.uy.toFixed(2) : '?') +
               ' (his up is y ' + udUp + ') ' +
               ((b.uy!==undefined && Math.sign(b.uy)===Math.sign(udUp)) || b.uy===undefined
                ? 'ok, they agree' : 'FAULT: THE CAMERA IS UPSIDE DOWN'));

  /* HOW MUCH SEA IS BEING DRAWN, and where it is relative to him. This is the
     number that says whether the ocean is the box. */
  let udAbove=0, udBelow=0, udSide=0;
  const LIM2 = LIQ_FAR*LIQ_FAR;
  for(let bi=0; bi<LADM.length; bi++){
    if(LADM[bi]!==S_SALT) continue;
    const x=bi%LNX, q=(bi/LNX)|0, z=q%LNZ, y=(q/LNZ)|0;
    const ex=(x+0.5)*LAT_M-P.x, ey=(y+0.5)*LAT_M-P.y, ez=(z+0.5)*LAT_M-P.z;
    if(ex*ex+ey*ey+ez*ez > LIM2) continue;
    const overhead = (ey*udUp) > 0;            // toward his ceiling
    if(Math.abs(ey) > Math.hypot(ex,ez)) { if(overhead) udAbove++; else udBelow++; }
    else udSide++;
  }
  R.push('SEA WITHIN ' + LIQ_FAR + ' m OF HIM: ' + udAbove + ' lattice blocks OVERHEAD, ' +
         udBelow + ' underfoot, ' + udSide + ' around him ' +
         (udAbove > 50 ? '<- THE OCEAN IS OVER HIS HEAD, and that is the box'
                       : 'ok, none of it is above him'));
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW at '+(document.body.dataset.r||'?')+
  ': '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
