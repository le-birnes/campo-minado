/* The three: down is a sign, beads have weight, and the hole has two sides. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>v.toFixed(2);
  G.mode=MODE_DUNGEON; seed=5; genWorld(0, true); G.state='play';

  /* ---- 1. down is a sign ---- */
  R.push(`normal: gsign ${gsign()}`);
  const vA=new Float32Array(16); viewFrom(0,0,0, 0,0, vA, 1);
  G.gravK=-0.42;
  const vB=new Float32Array(16); viewFrom(0,0,0, 0,0, vB, gsign());
  R.push(`flipped: gsign ${gsign()}, camera up ${f2(vA[5])} -> ${f2(vB[5])} ` +
         (vA[5]*vB[5] < 0 ? 'ok, it rolls over' : 'FAULT: same way up'));
  P.vy=-3; P.ground=false;
  const wasJump = (()=>{ P.vy = V_LO*gsign(); return P.vy; })();
  R.push(`jump under reversed gravity: vy ${f2(wasJump)} ` + (wasJump<0 ? 'ok, away from the ceiling' : 'FAULT'));
  G.gravK=1;

  /* ---- 2. beads weigh on you ---- */
  const w=SAND;
  P.x=8*BLOCK; P.y=8*BLOCK; P.z=8*BLOCK; P.load=0;
  sandLoad(1/60);
  R.push(`in open air: imm ${f2(P.imm)} load ${f2(P.load)}`);
  const c0=sandCell(P.x), c1=sandCell(P.y), c2=sandCell(P.z);
  for(let y=-2;y<14;y++) for(let z=-3;z<=3;z++) for(let x=-3;x<=3;x++) w.put(c0+x,c1+y,c2+z,S_WETSND);
  for(let k=0;k<90;k++) sandLoad(1/60);
  const immWet=P.imm, loadWet=P.load;
  R.push(`buried in wet sand: imm ${f2(immWet)} load ${f2(loadWet)} ` + (immWet>0.5 && loadWet>0.4 ? 'ok' : 'FAULT'));
  sandShed(0.5);
  R.push(`a shot sheds: ${f2(loadWet)} -> ${f2(P.load)} ` + (P.load < loadWet*0.6 ? 'ok, in chunks' : 'FAULT'));
  /* water is wet but it does not cling */
  for(let y=-2;y<14;y++) for(let z=-3;z<=3;z++) for(let x=-3;x<=3;x++) w.put(c0+x,c1+y,c2+z,S_WATER);
  P.load=0; for(let k=0;k<90;k++) sandLoad(1/60);
  R.push(`buried in water: imm ${f2(P.imm)} load ${f2(P.load)} ` +
         (P.load < loadWet*0.5 ? 'ok, water does not stick' : 'FAULT: as sticky as wet sand'));

  /* ---- 3. the hole, and what is through it ---- */
  G.mode=MODE_DUNGEON; seed=5; genWorld(0, true); G.state='play';
  const solidBefore=(()=>{ let n=0; for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]!==AIR) n++; return n; })();
  bossBlows(9*BLOCK, 4*BLOCK, 9*BLOCK);
  let open=0;
  for(let y=0;y<G.ny;y++) if(G.st[idx(G.holeX,y,G.holeZ)]===AIR) open++;
  R.push(`the hole: ${G.holeR} blocks wide and open on ${open} of ${G.ny} levels ` +
         (open===G.ny ? 'ok, all the way through the floor' : 'FAULT: it stops somewhere'));
  R.push(`gravity after the boss: ${f2(G.gravK)}, gsign ${gsign()} ` + (gsign()<0 ? 'ok' : 'FAULT'));

  G.emerge=0.001; G.gravK=1; buildIsland();
  R.push(`the island: ${VIALS.length} vials, ${VIALS.map(v=>v.name).slice(0,4).join('/')}...`);
  let wood=0; for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.scenery&&G.scenery[i]&&G.mat[i]===M_WOOD) wood++;
  R.push(`the house: ${wood} wooden blocks ` + (wood>60 ? 'ok' : 'FAULT: no house'));
  R.push(`every registered material has one: ${VIALS.length} of ${SMAT.length-1} ` +
         (VIALS.length>=12 ? 'ok' : 'FAULT'));
  P.x=(VIALS[0].x+0.5)*BLOCK; P.y=(VIALS[0].y+0.5)*BLOCK-EYE; P.z=(VIALS[0].z+0.5)*BLOCK;
  vialNear=-1; tickVials();
  R.push(`standing at one: it named ${vialNear>=0 ? VIALS[vialNear].name : 'NOTHING'}`);

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
