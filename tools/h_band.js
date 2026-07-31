window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  for(const d of [0,1,2]){
    const B=10, got=[], mines=[], spawns=new Set(); let t0=Date.now();
    for(let k=0;k<B;k++){
      G.mode=MODE_SWEEP; seed=6000+k*7919; genWorld(d);
      got.push(G.guesses===null?-1:G.guesses);
      mines.push(G.mines);
      spawns.add(Math.floor(P.x/BLOCK)+','+Math.floor(P.z/BLOCK));
    }
    const ms=(Date.now()-t0)/B;
    got.sort((a,b)=>a-b);
    const want=DIFFS[d].guess;
    const inBand=got.filter(g=>g>=want[0]&&g<=want[1]).length;
    R.push(`${DIFFS[d].name} wants ${want[0]}-${want[1]}: got ${got.join(',')} — `+
           `${inBand}/${B} in band | mines ${Math.min(...mines)}-${Math.max(...mines)} | `+
           `${spawns.size}/${B} distinct starts | ${ms.toFixed(0)} ms a board`);
  }
  // the density gradient: is there actually a gradient?
  {
    G.mode=MODE_SWEEP; seed=99; genWorld(2);
    const sx=Math.floor(P.x/BLOCK), sy=Math.floor(P.y/BLOCK), sz=Math.floor(P.z/BLOCK);
    let near=[0,0], far=[0,0];
    for(let i=0;i<G.nx*G.ny*G.nz;i++){
      if(G.st[i]===ROCK) continue;
      const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
      const r=Math.hypot(x-sx,y-sy,z-sz)*BLOCK;
      const b = r<=20 ? near : far;
      b[0]++; if(G.mine[i]) b[1]++;
    }
    R.push(`gradient on one Arcane (exp ${densExp.toFixed(2)}): within 20 m `+
           `${(100*near[1]/near[0]).toFixed(1)}% mines, beyond `+
           `${(100*far[1]/far[0]).toFixed(1)}%`);
    // the quiet interval
    let q=0, qm=0;
    for(let i=0;i<G.nx*G.ny*G.nz;i++){
      const x=i%G.nx, z=((i/G.nx)|0)%G.nz, y=(i/(G.nx*G.nz))|0;
      if(Math.hypot(x-sx,y-sy,z-sz)*BLOCK > 6) continue;
      q++; if(G.mine[i]) qm++;
    }
    R.push(`the quiet 6 m: ${qm} mines in ${q} blocks`);
  }
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
