/* Open the Creature Forge on a known creature and photograph it, so "does the
   pencil land where the cursor is" and "can you see the plane you are painting
   on" are answered by looking rather than by argument.

   ?fzax=0|1|2  which plane      ?fzs=n  which slice
   ?fzsolo=1    isolate the plane
   ?fzhov=x,y   fake a cursor at a grid cell, to check the highlight
   ?fzpaint=1   draw a shape through three planes, to check painting works  */
setTimeout(()=>{ try{
  G.muted = true; try{ snd.setMute(true); }catch(e){}
  const q = location.search;
  const num = (k,d) => { const m=q.match(new RegExp('[?&]'+k+'=(-?[\\d.]+)')); return m ? +m[1] : d; };
  fzOpen('imp');
  FZ.axis = num('fzax', 2);
  FZ.slice = num('fzs', FZ.axis===1 ? 8 : 12);
  FZ.solo = !!num('fzsolo', 0);
  FZ.yaw  = num('fzyaw', 0.55);
  FZ.pitch= num('fzpitch', 0.24);
  FZ.dist = num('fzdist', 46);

  const hx = num('fzhovx', -1), hy = num('fzhovy', -1);
  if(hx >= 0) FZ.hov = {x:hx, y:hy,
    z: FZ.axis===2 ? FZ.slice : 12};

  /* Paint a horn on it, on three different planes, with the mirror on. If the
     model that comes back out is symmetric and the horn is where it was put,
     the whole loop — pick, set, mirror, trim, serialise — is honest. */
  if(num('fzpaint',1)){
    FZ.mirror = true; FZ.ink = FZ_CH.indexOf('G');
    for(let k=0;k<6;k++) fzSet(7, 22+((k/2)|0), 12+k, FZ.ink+1);
    FZ.ink = FZ_CH.indexOf('y');
    for(let k=0;k<5;k++) fzSet(4+k, 6, 18, FZ.ink+1);
  }
  fzSyncUI();
}catch(err){ document.title = 'THROW ' + err.message; } }, 300);

setTimeout(()=>{
  const R = [];
  const say = (k,v) => R.push(k + '=' + v);
  const ok  = (k,cond,detail) => R.push(k + '=' + (cond ? 'ok' : 'FAIL') +
                                        (detail ? '(' + detail + ')' : ''));
  try{
    say('state', G.state);
    say('batch', fzB.count + '/' + fzB.max);
    say('plane', 'XYZ'[FZ.axis] + FZ.slice);

    /* --- mirror, on an empty grid so nothing else can be mistaken for it --- */
    const keep = FZ.grid.slice();
    FZ.grid.fill(0); FZ.mirror = true;
    fzSet(5, 9, 13, FZ_CH.indexOf('y')+1);
    ok('mirror', fzGet(FZ_W-1-5, 9, 13) === FZ_CH.indexOf('y')+1,
       'x5 -> x' + (FZ_W-1-5));
    FZ.mirror = false;
    fzSet(2, 9, 13, FZ_CH.indexOf('R')+1);
    ok('mirrorOff', fzGet(FZ_W-1-2, 9, 13) === 0);
    FZ.grid.set(keep); FZ.mirror = true;

    /* --- the round trip: grid -> serialised -> what the cave would draw ---
       The horn the harness painted is at x=7,y=22..24,z=12..17 in metal. If it
       comes out of forgeVoxels() at the matching local coordinate then paint,
       trim, serialise and rebuild all agree, which is the only thing that
       makes this tool worth having. */
    const M = fzModel();
    say('model', M ? M.w+'x'+M.h+'x'+M.d : 'EMPTY');
    const b = fzBounds();
    const V = forgeVoxels(M);
    say('drawn', V.vox.length);
    say('culled', (function(){ let n=0; for(let i=0;i<FZ_N;i++) if(FZ.grid[i]) n++;
                               return n - V.vox.length; })());

    /* X is exported symmetric about the Forge's mirror line, so local x is
       just the grid column measured from that line — no bounding box in it.
       Z is trimmed hard, so that one does go through the box. */
    const wantX = 7 - (FZ_W-1)/2;                  // the horn, in model-local x
    const wantZ = 17 - b.z0 - (M.d-1)/2;           // its far tip
    const horn = V.vox.filter(v => (v.ch==='G') && Math.abs(v.x-wantX)<0.01);
    ok('hornKept', horn.length > 0, horn.length + ' voxels');
    ok('hornDepth', horn.some(v => Math.abs(v.z-wantZ)<0.01),
       'want z ' + wantZ.toFixed(1) + ', got ' +
       horn.map(v=>v.z.toFixed(1)).join('/'));
    ok('hornMirrored', V.vox.some(v => v.ch==='G' && Math.abs(v.x+wantX)<0.01));
    ok('depthIsReal', new Set(V.vox.map(v=>v.z)).size > 1,
       new Set(V.vox.map(v=>v.z)).size + ' distinct z');

    /* --- and the cave itself: does hellVoxels hand back the forged one? --- */
    FORGE_ART.imp = M; delete HELL_VOX.imp;
    const back = hellVoxels(HELL.find(h=>h.art==='imp'));
    ok('caveUsesIt', back.forged === true && back.vox.length === V.vox.length,
       back.vox.length + ' vs ' + V.vox.length);
    delete FORGE_ART.imp; delete HELL_VOX.imp;

    say('export', fzExport().length + ' chars');
    document.body.dataset.r = R.join(' | ');
  } catch(err){
    document.body.dataset.r = R.join(' | ') + ' | THROW ' + err.message + ' @ ' +
      ((err.stack||'').split('\n')[1]||'').trim();
  }
}, 1400);
