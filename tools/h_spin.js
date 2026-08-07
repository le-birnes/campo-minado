/* SPIN THE PLAYER, NOT THE CAMERA.

   Marcelo, twice: "you can't just flip the camera like that, you should spin
   the player around, I didn't ask for a visual flip only."

   The old code negated the right and up vectors in viewFrom. That is a real
   rotation and it is still wrong, because it turns the PICTURE about the view
   axis while the body it belongs to never changes: the mouse kept yawing in
   the old frame and the strafe key kept pushing the old way, so turning right
   went left and walking right went left.

   What has to be true:
     1. TURN RIGHT GOES RIGHT under both signs of gravity. Measured in the
        BODY's frame, which is the only frame the question means anything in:
        after a turn-right, the new forward must lean toward the old right.
     2. STRAFE RIGHT GOES RIGHT under both, the same way.
     3. THE CROSSHAIR IS WHERE THE CAMERA LOOKS. viewFrom used to negate the
        pitch and aimRay did not, so under reversed gravity the shot and the
        picture disagreed about how high they were aiming.
     4. IT IS A TURN AND IT TAKES TIME - the roll goes 0 to pi over ROLL_DUR
        and is somewhere in between while it is happening.
     5. The basis stays orthonormal and right-handed all the way through. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>(+v).toFixed(3);
  G.mode=MODE_SWEEP; seed=3; genWorld(0); G.state='play';
  const M=new Float32Array(16);
  const basis=()=>viewFrom(P.x,eyeY(),P.z, P.yaw, P.pitch, M, rollNow());
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

  for(const k of [1,-1]){
    G.gravK=k; rollReset();
    P.yaw=0.7; P.pitch=0.2;
    const name = k>0 ? 'upright' : 'upside down';

    /* 1. TURN RIGHT */
    const b0=basis();
    const r0=[b0.rx,b0.ry,b0.rz], f0=[b0.fx,b0.fy,b0.fz], u0=[b0.ux,b0.uy,b0.uz];
    turnedThisFrame = 0;                      // the per-frame turn budget is not this test's subject
    turnView(-0.30, 0);                       // what the mouse sends for "right"
    const b1=basis();
    const lean = dot([b1.fx,b1.fy,b1.fz], r0);
    R.push(`${name}: turn right -> forward leans ${f2(lean)} toward the old right ` +
           (lean > 0.15 ? 'ok' : 'FAULT: it turned the other way'));

    /* 2. LOOK UP */
    P.yaw=0.7; P.pitch=0.0;
    const b2=basis(), u2=[b2.ux,b2.uy,b2.uz];
    turnedThisFrame = 0;
    turnView(0, 0.30);                        // what the mouse sends for "up"
    const b3=basis();
    const rise = dot([b3.fx,b3.fy,b3.fz], u2);
    R.push(`${name}: look up -> forward leans ${f2(rise)} toward the old up ` +
           (rise > 0.15 ? 'ok' : 'FAULT: looking up looks down'));

    /* 3. STRAFE RIGHT */
    P.yaw=0.7; P.pitch=0;
    const b4=basis();
    IN.f=IN.b=IN.l=0; IN.r=1; IN.mf=IN.ms=0; IN.sprint=false;
    P.vx=P.vz=0; P.ground=true;
    for(let i=0;i<10;i++) physics(1/60);
    IN.r=0;
    const mv = [P.vx,0,P.vz], ln = Math.hypot(P.vx,P.vz)||1;
    const along = dot([mv[0]/ln,0,mv[2]/ln], [b4.rx,b4.ry,b4.rz]);
    R.push(`${name}: strafe right -> moving ${f2(along)} along the body's right ` +
           (along > 0.8 ? 'ok' : 'FAULT: walking right walks left'));

    /* 4. the crosshair and the camera agree */
    P.yaw=0.7; P.pitch=0.45;
    const b5=basis(), ar=aimRay();
    const agree = dot([ar.dx,ar.dy,ar.dz],[b5.fx,b5.fy,b5.fz]);
    R.push(`${name}: aim vs camera ${f2(agree)} ` +
           (agree > 0.9999 ? 'ok, the same direction' : 'FAULT: the shot and the picture disagree'));

    /* 5. still a proper frame */
    const b6=basis();
    const rr=Math.hypot(b6.rx,b6.ry,b6.rz), uu=Math.hypot(b6.ux,b6.uy,b6.uz);
    const ru=b6.rx*b6.ux+b6.ry*b6.uy+b6.rz*b6.uz;
    const crx=[b6.ry*b6.fz-b6.rz*b6.fy, b6.rz*b6.fx-b6.rx*b6.fz, b6.rx*b6.fy-b6.ry*b6.fx];
    const hand=dot(crx,[b6.ux,b6.uy,b6.uz]);
    R.push(`${name}: |r| ${f2(rr)} |u| ${f2(uu)} r.u ${f2(ru)} handedness ${f2(hand)} ` +
           (Math.abs(rr-1)<1e-6 && Math.abs(uu-1)<1e-6 && Math.abs(ru)<1e-6 && hand>0.999
            ? 'ok, orthonormal and right-handed' : 'FAULT: the basis is bent'));
  }

  /* 6. AND IT IS A TURN, NOT A CUT. */
  G.gravK=1; rollReset();
  R.push(`settled upright: roll ${f2(rollNow())} upSign ${upSign()}`);
  G.gravK=-1;
  rollTick(1/60);
  const mid=[];
  for(let i=0;i<Math.round(ROLL_DUR*60)+2;i++){ mid.push(rollNow()); rollTick(1/60); }
  const started=mid[0], half=mid[(mid.length/2)|0], ended=mid[mid.length-1];
  R.push(`the turn: ${f2(started)} -> ${f2(half)} -> ${f2(ended)} rad over ${ROLL_DUR}s ` +
         (started < 0.4 && half > 0.8 && half < 2.4 && Math.abs(ended-Math.PI) < 0.01
          ? 'ok, it goes over rather than cutting' : 'FAULT: it snaps'));
  R.push(`and the controls follow the body: upSign ${upSign()} ` +
         (upSign() === -1 ? 'ok' : 'FAULT'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
