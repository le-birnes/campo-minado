/* The whole loop, end to end: draw something in the Forge, save it, and meet
   it in the cave. The Forge can be right about its own grid and still be
   useless if what arrives downstairs is the old drawing, so this photographs
   the creature in the finale rather than in the editor.

   What it draws is deliberately impossible for the extruded path to produce:
   a barrel that runs NINE cells forward off the right arm and nothing on the
   left. Depth is symmetric by construction in a distance transform, so if the
   thing in the arena has a barrel on one side only, the model went through.

   ?ang=n   orbit n degrees around it     ?raw=1   skip the forging, for A/B  */
setTimeout(()=>{ try{
  G.muted = true; try{ snd.setMute(true); }catch(e){}
  const q = location.search;
  const num = (k,d)=>{ const m=q.match(new RegExp('[?&]'+k+'=(-?[\\d.]+)')); return m?+m[1]:d; };
  const ANG = num('ang', 0);

  if(!num('raw',0)){
    fzOpen('imp');
    FZ.mirror = false;
    FZ.ink = FZ_CH.indexOf('G');
    for(let k=0;k<9;k++){                    // the barrel, forward off one arm
      fzSet(17, 14, 13+k, FZ.ink+1);
      fzSet(17, 15, 13+k, FZ.ink+1);
      fzSet(18, 14, 13+k, FZ.ink+1);
      fzSet(18, 15, 13+k, FZ.ink+1);
    }
    FZ.ink = FZ_CH.indexOf('y');
    fzSet(17,14,22, FZ.ink+1); fzSet(18,14,22, FZ.ink+1);   // a lit muzzle
    fzSet(17,15,22, FZ.ink+1); fzSet(18,15,22, FZ.ink+1);
    if(!fzSave()) throw new Error('fzSave refused');
    $('forge').classList.remove('on');
  }

  G.mode = MODE_DUNGEON; G.diff = 0;
  startGame();
  seed = 606; genWorld(0); G.state='play'; try{ setScreen('play'); }catch(e){}
  const n = G.nx*G.ny*G.nz;
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  checkWin();
  try{ hurtPlayer = function(){}; }catch(e){}

  const e = enemies.find(x=>x.hell);
  if(!e){ document.body.dataset.r = 'no finale creature spawned'; return; }
  e.hell = HELL.find(h=>h.art==='imp');
  e.dhp = e.dmax = e.hell.hp; e.mScale = 1.9;   // big, so the barrel is legible
  e.state='alive'; e.emerge=1; e.aim=false; e.mFirst=1e9; e.mRate=1e9;
  e.gait = 0;

  const ex=Math.floor(e.x/BLOCK), ey=Math.floor(e.y/BLOCK), ez=Math.floor(e.z/BLOCK);
  for(let y=ey;y<=ey+6;y++) for(let z=ez-8;z<=ez+8;z++) for(let x=ex-8;x<=ex+8;x++)
    if(inside(x,y,z)) G.st[idx(x,y,z)]=AIR;
  for(let z=ez-8;z<=ez+8;z++) for(let x=ex-8;x<=ex+8;x++)
    if(inside(x,ey-1,z)) G.st[idx(x,ey-1,z)]=ROCK;
  G.dirty = true;

  const r=10, a=ANG*Math.PI/180;
  P.x=e.x+Math.sin(a)*r; P.z=e.z+Math.cos(a)*r; P.y=ey*BLOCK;
  P.vx=P.vy=P.vz=0; P.ground=true;
  P.yaw=Math.atan2(-(e.x-P.x), -(e.z-P.z)); P.pitch=0.06;
}catch(err){ document.title='THROW '+err.message;
             document.body.dataset.r='THROW '+err.message; } }, 400);

setTimeout(()=>{
  try{
    if((document.body.dataset.r||'').startsWith('THROW')) return;
    const e = enemies.find(x=>x.hell);
    const V = e ? hellVoxels(e.hell) : null;
    /* Two questions and no others: is the cave drawing the FORGED model, and
       does that model actually break symmetry the way the drawing cannot? */
    let left=0, right=0, maxZ=-99;
    for(const v of ((V&&V.vox)||[])){
      if(v.ch==='G'||v.ch==='y'){ if(v.x<0) left++; else right++; maxZ=Math.max(maxZ, v.z||0); }
    }
    document.body.dataset.r =
      'forged=' + !!(V && V.forged) +
      ' | size ' + (V ? V.W+'x'+V.H+'x'+V.D : '-') +
      ' | vox ' + (V ? V.vox.length : 0) +
      ' | batch ' + hellB.count + '/' + hellB.max +
      ' | barrel left ' + left + ' right ' + right +
      ' | reaches z ' + maxZ +
      ' | asymmetric ' + (left !== right) +
      ' | ' + (e ? e.hell.name : '-') + ' at ' +
        e.x.toFixed(1)+','+e.y.toFixed(1)+','+e.z.toFixed(1);
  } catch(err){
    document.body.dataset.r = 'THROW ' + err.message + ' @ ' +
      ((err.stack||'').split('\n')[1]||'').trim();
  }
}, 2600);
