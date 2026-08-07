/* CAN HE SHOOT UNDERWATER YET?

   Asked three times: "I can't seem to be able to shoot inside water." The
   reason was that sandRayHit returned the first LOOSE cell, and standing in
   water that cell is AT YOUR OWN FACE - so the blast went off half a metre in
   front of your eyes and shoot() returned before it reached anything.

   So: stand him in a tank of water with a wall of sand in front, and ask what
   the shot reaches. Prefixed ws. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  SIM_SPHERE = false;
  const R=[];
  const w = new SandWorld(96,96,96);
  const NB = 96/PGS;
  for(let by=0;by<NB;by++) for(let bz=0;bz<NB;bz++) for(let bx=0;bx<NB;bx++)
    if(by>0) cFreeBlock(w, bx,by,bz, S_AIR);
  /* water from x 40 on, and a wall of sand at x 70 */
  for(let y=30;y<60;y++) for(let z=30;z<60;z++){
    for(let x=40;x<70;x++) w.put(x,y,z,S_WATER);
    for(let x=70;x<74;x++) w.put(x,y,z,S_SAND);
  }
  const eye = [44*CELL_M, 45*CELL_M, 45*CELL_M];   // INSIDE the water
  const save = SAND; SAND = w;

  const hit = sandRayHit(eye[0],eye[1],eye[2], 1,0,0, 20);
  R.push('standing IN water, firing along +x at a wall of sand 4.9 m away:');
  R.push('  the ray reports: ' + (hit ? (
     'material ' + (SMAT[hit.m]?SMAT[hit.m].n:hit.m) +
     ' at t=' + hit.t.toFixed(2) + ' m, after ' + hit.wet.toFixed(2) +
     ' m of fluid, with ' + (hit.e*100).toFixed(0) + '% of its energy left' +
     (hit.stopped ? ' (THE WATER ATE IT)' : '') +
     (hit.through ? ' (nothing solid in reach)' : '')
   ) : 'nothing at all'));
  R.push('  ' + (hit && !hit.stopped && SM_K[hit.m]===K_POWDER
    ? 'ok, IT REACHED THE SAND THROUGH THE WATER'
    : 'FAULT: it did not get past the water'));

  /* and the energy really does fall off with distance through it */
  const near = sandRayHit(68*CELL_M,45*CELL_M,45*CELL_M, 1,0,0, 20);
  R.push('  fired from 0.4 m away instead of 4.9: ' +
         (near ? (near.e*100).toFixed(0) + '% left' : '-') +
         ' against ' + (hit ? (hit.e*100).toFixed(0) + '%' : '-') + ' from far ' +
         (near && hit && near.e > hit.e ? 'ok, the water takes its share with distance'
                                        : 'FAULT: distance through it does nothing'));

  /* a shot into deep water with nothing behind it must still be absorbed */
  const deep = sandRayHit(41*CELL_M,45*CELL_M,45*CELL_M, 0,0,1, 40);
  R.push('  fired sideways into open water: ' +
         (deep ? (deep.stopped ? 'THE WATER ATE IT ok' : 'reached ' +
            (SMAT[deep.m]?SMAT[deep.m].n:deep.m)) : 'nothing'));
  SAND = save;
  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message; }}, 300);
