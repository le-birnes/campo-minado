window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const N=()=>G.nx*G.ny*G.nz;

  /* Marcelo's report: the eye stayed on the HUD and never fired. So the
     question is not "what spent it" but "when does a right click on a number
     that looks incomplete fail to use it". Play it the way he did — flag some
     mines, then right-click numbers — and classify every single outcome. */
  const why = {};
  const bump = k => why[k] = (why[k]||0)+1;

  let tried=0, fired=0;
  for(let b=0;b<10;b++){
    seed=55000+b*7919; genWorld(1); G.state='play';
    const n=N();
    // open a good part of the board
    for(let k=0;k<70;k++){
      let t=-1;
      for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ t=i; break; }
      if(t<0) break; revealAt(t,true);
    }
    // flag every mine the board proves, the way a player would
    for(let pass=0; pass<3; pass++)
      for(let i=0;i<n;i++){
        if(G.st[i]!==AIR || G.cnt[i]===0) continue;
        let f=0; const h=[];
        for(const j of nbrsOf(i)){ if(G.st[j]===MARKED) f++; else if(G.st[j]===SOLID) h.push(j); }
        if(h.length && G.cnt[i]-f===h.length)
          for(const j of h){ G.st[j]=MARKED; G.marked++; }
      }

    for(let i=0;i<n;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      // what the player sees: flags around it vs the digit
      let flags=0, hidden=0, rock=0;
      for(const j of nbrsOf(i)){
        const st=G.st[j];
        if(st===MARKED) flags++; else if(st===SOLID) hidden++; else if(st===ROCK) rock++;
      }
      if(hidden===0) continue;                 // nothing left to reveal here
      if(flags===G.cnt[i]) continue;           // satisfied: chords, and should not use the eye
      // this is an "incomplete number with blocks around it" — the eye's case
      tried++;
      G.eye = true;
      const before = G.eye;
      const c = cellXYZ(i);
      hitNumber(c[0], c[1], c[2]);
      if(!G.eye) { fired++; bump('fired'); }
      else bump(`NOT fired: flags=${flags} of ${G.cnt[i]}, hidden=${hidden}, rock=${rock}`);
      if(G.state!=='play'){ bump('board ended'); break; }
    }
  }
  R.push(`right-clicked ${tried} incomplete numbers holding the eye: it fired ${fired} `+
         `(${(100*fired/tried).toFixed(1)}%)`);
  const keys=Object.keys(why).filter(k=>k!=='fired').sort((a,b)=>why[b]-why[a]).slice(0,6);
  R.push(keys.length ? 'failures: '+keys.map(k=>`${k} x${why[k]}`).join(' ; ') : 'no failures');

  /* And the whole path a player actually uses: aim, hold right, release. */
  {
    seed=55000; genWorld(1); G.state='play';
    const n=N();
    for(let k=0;k<70;k++){
      let t=-1;
      for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ t=i; break; }
      if(t<0) break; revealAt(t,true);
    }
    let want=-1;
    for(let i=0;i<n;i++){
      if(G.st[i]!==AIR || G.cnt[i]===0) continue;
      let f=0,h=0;
      for(const j of nbrsOf(i)){ if(G.st[j]===MARKED) f++; else if(G.st[j]===SOLID) h++; }
      if(h>0 && f!==G.cnt[i]){ want=i; break; }
    }
    const c=cellXYZ(want);
    // stand where the number is squarely in view and aim at it
    let placed=false;
    for(let r=1;r<=4 && !placed;r++)
    for(let dy=-r;dy<=r && !placed;dy++) for(let dz=-r;dz<=r && !placed;dz++) for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))!==r) continue;
      const X=c[0]+dx, Y=c[1]+dy, Z=c[2]+dz;
      if(!inside(X,Y,Z) || G.st[idx(X,Y,Z)]!==AIR) continue;
      P.x=(X+0.5)*BLOCK; P.y=(Y+0.5)*BLOCK-EYE; P.z=(Z+0.5)*BLOCK; P.vx=P.vy=P.vz=0;
      const ax=(c[0]+0.5)*BLOCK, ay=(c[1]+0.5)*BLOCK, az=(c[2]+0.5)*BLOCK;
      const ddx=ax-P.x, ddy=ay-(P.y+EYE), ddz=az-P.z;
      P.yaw=Math.atan2(-ddx,-ddz); P.pitch=Math.atan2(ddy,Math.hypot(ddx,ddz));
      const rr=aimRay();
      const h2=raycast(rr.ox,rr.oy,rr.oz,rr.dx,rr.dy,rr.dz,REACH,true);
      if(h2.hit && h2.kind==='num' && h2.x===c[0] && h2.y===c[1] && h2.z===c[2]) placed=true;
    }
    G.eye=true;
    const rr=aimRay();
    const seenAs=raycast(rr.ox,rr.oy,rr.oz,rr.dx,rr.dy,rr.dz,REACH,true);
    startThink(); endThink();
    R.push(`aimed squarely at an incomplete number (found a spot: ${placed}), the right `+
           `button saw "${seenAs.hit?seenAs.kind:'nothing'}" and the eye is now `+
           `${G.eye?'STILL HELD — did not fire':'spent'}`);
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 25000);
