window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON; seed=20000; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  let m=-1;
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]===SOLID){ m=i; break; }
  const c=cellXYZ(m);
  G.digAdj[m]=3;
  G.st[m]=MARKED; G.marked++;
  hatchMine(m, c[0],c[1],c[2]);
  R.push(`hatched: G.hatch=${G.hatch[m]} state=${G.st[m]}(MARKED=${MARKED}) solid=${isSolidCell(c[0],c[1],c[2])}`);
  // does the cube batch still contain it?
  rebuildWorld();
  const cx=(c[0]+0.5)*BLOCK, cy=(c[1]+0.5)*BLOCK, cz=(c[2]+0.5)*BLOCK;
  let found=0;
  for(let k=0;k<worldB.count;k++){
    const o=k*CUBE_STRIDE;
    if(Math.abs(worldB.data[o+12]-cx)<0.01 && Math.abs(worldB.data[o+13]-cy)<0.01 &&
       Math.abs(worldB.data[o+14]-cz)<0.01) found++;
  }
  R.push(`cubes drawn at that cell: ${found} (want 0)`);
  // and the glyph pass: a flag rune is still emitted for a MARKED cell
  R.push(`still counted as a flag: marked=${G.marked}, correctFlags=${correctFlags()}`);
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
