window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  seed=99; G.mode=MODE_SWEEP; genWorld(0); G.state='play';
  const mm=(dx,dy)=>document.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,movementY:dy,bubbles:true}));
  dragLook=true; dragging=true;

  // a normal flick still arrives intact
  turnedThisFrame=0; P.yaw=0; mm(100,0);
  R.push(`one 100 px move: ${(-P.yaw).toFixed(4)} rad (expected ${(100*G.sens).toFixed(4)})`);

  // a burst inside ONE frame is what the per-event clamp could not stop
  turnedThisFrame=0; P.yaw=0; turnClamped=0;
  for(let k=0;k<40;k++) mm(250,0);
  R.push(`40 clamped events in one frame: ${(-P.yaw).toFixed(3)} rad `+
         `(unbounded that is ${(40*250*G.sens).toFixed(1)} rad, ~${(40*250*G.sens/6.283).toFixed(1)} full spins), `+
         `clamp fired ${turnClamped}x`);

  // and the budget comes back next frame
  turnedThisFrame=0; P.yaw=0;
  for(let f=0;f<5;f++){ turnedThisFrame=0; mm(200,0); }
  R.push(`200 px across 5 frames: ${(-P.yaw).toFixed(3)} rad (should be 5 x ${(200*G.sens).toFixed(3)})`);

  // pitch still cannot go over the top
  turnedThisFrame=0; P.pitch=0;
  for(let f=0;f<80;f++){ turnedThisFrame=0; mm(0,-300); }
  R.push(`80 hard upward flicks: pitch ${P.pitch.toFixed(3)} (clamped at 1.5)`);
  R.push(`finite: ${isFinite(P.yaw+P.pitch)}`);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 600);
