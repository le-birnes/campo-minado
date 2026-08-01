window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=606; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;

  /* dig out EVERY safe block and leave the mines standing: the old trigger */
  for(let i=0;i<n;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  checkWin();
  R.push('every safe block gone, no flags: finale='+G.finale+' (want false), state '+
         G.state+' (want play), hell enemies '+enemies.filter(e=>e.hell).length+' (want 0)');

  /* now flag them */
  let flagged=0;
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; flagged++; }
  checkWin();
  const hell=enemies.filter(e=>e.hell);
  R.push(flagged+' mines flagged: finale='+G.finale+' (want true), hell enemies '+
         hell.length+' (want 1)'+(hell[0]?' = '+hell[0].hell.name+' '+hell[0].dhp+' hp':'')+
         ', state '+G.state+' (want play, the run is not won until it dies)');

  /* the cave has to have changed colour */
  G.dirty=true; rebuildWorld();
  const d=worldB.data; let hot=0, dim=0, cold=0, sand=0;
  for(let k=0;k<worldB.count;k++){
    const o=k*CUBE_STRIDE, r=d[o+16], g=d[o+17], e=d[o+20];
    if(e>0.5) hot++; else if(e>0.1) dim++; else if(r<0.2 && g<0.2) cold++;
    if(r>0.5 && g>0.35) sand++;                 // the old sandstone
  }
  R.push('cave after the change: '+worldB.count+' cubes, '+cold+' cold grey, '+
         dim+' smouldering, '+hot+' running hot, '+sand+' still sandstone (want 0)');

  /* and killing it wins the run */
  for(const e of hell) killEnemy(e);
  checkWin();
  R.push('boss dead: state '+G.state+' (want over), win='+G.win+' (want true)');

  /* the plain arena must be untouched by any of this */
  G.mode=MODE_SWEEP; seed=5; genWorld(0); G.state='play'; G.finale=false;
  for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]===SOLID && !G.mine[i]){ G.st[i]=AIR; G.revealed++; }
  checkWin();
  R.push('3D Minesweeper dug out: state '+G.state+' (want over), finale='+G.finale+' (want false)');
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
