/* Shoot a heap of sand. Before this, nothing happened at all: the shot raycast
   walked the BLOCK world and a heap of beads was not in it, so a shot passed
   through a pile as if it were smoke and the pile never found out. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>v.toFixed(2);
  G.mode=MODE_SWEEP; seed=9; genWorld(0); G.state='play';
  const cx=(G.nx/2)|0, cz=(G.nz/2)|0;
  for(let y=0;y<G.ny;y++) for(let z=cz-4;z<=cz+4;z++) for(let x=cx-6;x<=cx+6;x++){
    if(!inside(x,y,z)) continue;
    const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; sandDig(x,y,z); }
  }
  const w=SAND;
  const bx0=Math.floor((cx+1.2)*SAND_DIV), by0=SAND_DIV, bz0=Math.floor((cz+0.5)*SAND_DIV);
  for(let y=0;y<14;y++) for(let z=-7;z<=7;z++) for(let x=0;x<14;x++) w.put(bx0+x, by0+y, bz0+z, S_SAND);
  for(let k=0;k<600 && w.awake.length;k++) sandTick(w,-1);
  const before = w.count(S_SAND);

  /* AIM AT WHERE THE SAND ENDED UP, not where it was put. A free-standing brick
     of sand is not a wall - it slumps the moment it is ticked - and the first
     version of this fired two metres over the top of a heap that had already
     collapsed. Its own bounding box is the only thing that knows. */
  let x0=1e9,x1=-1,y0=1e9,y1=-1,z0=1e9,z1=-1;
  for(let y=0;y<w.H;y++) for(let z=0;z<w.D;z++) for(let x=0;x<w.W;x++)
    if(w.at(x,y,z)===S_SAND){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; if(z<z0)z0=z; if(z>z1)z1=z; }
  R.push(`heap: ${before} cells in x ${x0}-${x1} y ${y0}-${y1} z ${z0}-${z1}`);

  P.x = x0*CELL_M - 5.0;
  P.y = ((y0+y1)/2)*CELL_M - EYE;
  P.z = ((z0+z1)/2)*CELL_M;
  P.yaw = -Math.PI/2; P.pitch = 0;
  const r0 = aimRay();
  const sh = sandRayHit(r0.ox,r0.oy,r0.oz, r0.dx,r0.dy,r0.dz, REACH);
  R.push(`the ray finds it: ${sh ? f2(sh.t)+' m away, '+SMAT[sh.m].n : 'NO - it goes straight through'}`);

  shoot();
  let air=0; for(let i=0;i<GRIT.n;i++) if(GRIT.live[i]) air++;
  const after = w.count(S_SAND);
  R.push(`one shot: ${before-after} cells left the heap, ${air} of them in the air ` +
         ((before-after)>50 ? 'ok' : 'FAULT: nothing happened'));

  /* and it goes AWAY from the shot. The shot is +x, so the beads must be too. */
  let away=0, back=0;
  for(let i=0;i<GRIT.n;i++){ if(!GRIT.live[i]) continue; if(GRIT.vx[i]>0) away++; else back++; }
  R.push(`thrown: ${away} down-range, ${back} back at me ` + (away>back ? 'ok' : 'FAULT: backwards'));

  /* MATERIAL IS CONSERVED, so counting it after five shots counts the same
     2,940 beads and says nothing. What five shots do is move the heap: the
     front face gets a crater and the sand ends up further down-range. */
  for(let k=0;k<4;k++){ shoot(); for(let q=0;q<20;q++) sandStep(1/60); }
  for(let q=0;q<400;q++) sandStep(1/60);
  let nx0=1e9,nx1=-1,gone=0;
  for(let y=0;y<w.H;y++) for(let z=0;z<w.D;z++) for(let x=0;x<w.W;x++)
    if(w.at(x,y,z)===S_SAND){ if(x<nx0)nx0=x; if(x>nx1)nx1=x; }
  for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++) for(let x=x0;x<=x0+3;x++)
    if(w.at(x,y,z)!==S_SAND) gone++;
  R.push(`five shots: heap was x ${x0}-${x1}, now x ${nx0}-${nx1}; ` +
         `${gone} cells gone from the face it was shot in ` + (gone>200 ? 'ok' : 'FAULT: no crater'));

  /* fired from INSIDE it, the blast has to go outward on every side */
  GRIT.n=0; GRIT.next=0; GRIT.live.fill(0);
  P.x=((x0+x1)/2)*CELL_M; P.y=((y0+y1)/2)*CELL_M - EYE; P.z=((z0+z1)/2)*CELL_M;
  shoot();
  let px=0,nx=0,pz=0,nz=0,tot=0;
  for(let i=0;i<GRIT.n;i++){ if(!GRIT.live[i]) continue; tot++;
    if(GRIT.vx[i]>0) px++; else nx++;
    if(GRIT.vz[i]>0) pz++; else nz++; }
  R.push(`from inside: ${tot} beads, ${px}/${nx} on x and ${pz}/${nz} on z ` +
         (tot>20 && px>2 && nx>2 && pz>2 && nz>2 ? 'ok, it goes every way' : 'FAULT: one-sided'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
