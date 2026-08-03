/* Photograph the relit cave, and count what is lighting it.

   The spec was given in numbers — full to five blocks, three tenths at six and
   seven, nothing past seven; fireflies at a tenth out to four; overlaps add —
   so the harness checks the numbers and takes the picture. A screenshot alone
   cannot tell you whether a corner is dark because the falloff is right or
   because the light list is empty.

   ?flags=n   plant n flags near the player before looking
   ?dark=x    override LIT_DARK, to see what the knob does                   */
setTimeout(()=>{ try{
  G.muted = true; try{ snd.setMute(true); }catch(e){}
  const q = location.search;
  const num = (k,d) => { const m=q.match(new RegExp('[?&]'+k+'=(-?[\\d.]+)')); return m?+m[1]:d; };

  G.mode = MODE_DUNGEON; G.diff = 0;
  startGame();
  seed = 606; genWorld(0); G.state='play'; try{ setScreen('play'); }catch(e){}

  /* Open a chamber around the player so there is something to be dark IN, and
     flag a handful of the mines around it so there is something lighting it. */
  const px=Math.floor(P.x/BLOCK), py=Math.floor(P.y/BLOCK), pz=Math.floor(P.z/BLOCK);
  const R = 7;
  for(let y=py-1;y<=py+4;y++) for(let z=pz-R;z<=pz+R;z++) for(let x=px-R;x<=px+R;x++)
    if(inside(x,y,z) && G.st[idx(x,y,z)]===SOLID && !G.mine[idx(x,y,z)]){
      G.st[idx(x,y,z)]=AIR; G.revealed++;
    }
  const want = num('flags', 6);
  let planted = 0;
  for(let y=py-2;y<=py+5 && planted<want;y++)
    for(let z=pz-9;z<=pz+9 && planted<want;z++)
      for(let x=px-9;x<=px+9 && planted<want;x++){
        if(!inside(x,y,z)) continue;
        const i=idx(x,y,z);
        if(G.mine[i] && G.st[i]===SOLID){ G.st[i]=MARKED; G.marked++; planted++; }
      }
  G.dirty = true;
  try{ hurtPlayer = function(){}; }catch(e){}
  enemies.length = 0;
  P.pitch = 0.02;
}catch(err){ document.body.dataset.r='THROW '+err.message; } }, 300);

setTimeout(()=>{
  const R=[];
  try{
    if((document.body.dataset.r||'').startsWith('THROW')) return;
    /* Without --shot the harness stubs requestAnimationFrame, so frame() never
       runs and the light list is never gathered. Gather it here: the numbers
       being measured are the ones the draw would have used. */
    collectLights(P.x, P.y+EYE, P.z);
    R.push('flags=' + G.marked);
    R.push('fireflies=' + flies.length);
    R.push('lightsThisFrame=' + lightN + '/' + MAXL);
    R.push('dark=' + LIT_DARK);
    /* The falloff, sampled straight out from the first flag: it must be flat
       to five blocks, three tenths at six and seven, and zero past seven. */
    const out=[0,0,0];
    let flag=-1;
    for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]===MARKED){ flag=i; break; }
    if(flag>=0){
      const [fx,fy,fz]=cellXYZ(flag);
      const prof=[];
      for(let b=0;b<=9;b++){
        lightAt((fx+0.5)*BLOCK + b*BLOCK, (fy+0.5)*BLOCK, (fz+0.5)*BLOCK, out);
        prof.push(b+':'+(out[0]+out[1]+out[2]).toFixed(2));
      }
      R.push('falloff from a flag, by block ' + prof.join(' '));
    }
    /* Overlap has to ADD. Two flags in range of the same spot must read
       brighter than either alone. */
    let a=-1,b2=-1;
    for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]===MARKED){ if(a<0)a=i; else {b2=i;break;} }
    if(a>=0&&b2>=0){
      const A=cellXYZ(a), B=cellXYZ(b2);
      const mx=((A[0]+B[0])/2+0.5)*BLOCK, my=((A[1]+B[1])/2+0.5)*BLOCK, mz=((A[2]+B[2])/2+0.5)*BLOCK;
      lightAt(mx,my,mz,out); const mid=out[0]+out[1]+out[2];
      lightAt((A[0]+0.5)*BLOCK+BLOCK, (A[1]+0.5)*BLOCK, (A[2]+0.5)*BLOCK, out);
      R.push('overlap mid=' + mid.toFixed(2) + ' vs one=' + (out[0]+out[1]+out[2]).toFixed(2));
    }
    document.body.dataset.r = R.join(' | ');
  } catch(err){
    document.body.dataset.r = R.join(' | ') + ' | THROW ' + err.message;
  }
}, 1500);
