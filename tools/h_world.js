/* Does the world build, and how many times?

   The build-once change hung the dungeon at 151 s with no output at all, and
   the first suspect is that genWorld is re-entered by the rejection sampler -
   which would build a ten-million-cell ocean once per deal.

   The name is hmark and not mark because the GAME declares mark - the exact
   collision NEXT.md warns about, which is a parse error, so nothing runs at
   all and Chrome sits out its budget in silence.

   MARKERS ARE WRITTEN AS IT GOES. A harness that only writes at the end says
   nothing when it hangs; one that writes as it passes each stage says WHERE. */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
const hmark=(t)=>{ document.body.dataset.r=(document.body.dataset.r||'')+' ~ '+t; };
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  document.body.dataset.r='start';
  G.mode=MODE_DUNGEON; seed=11;
  genWorld(0);
  hmark(`genWorld done, buildOuterWorld ran ${OUTER_N}x`);
  hmark(`grid ${G.nx}x${G.ny}x${G.nz} seaY=${G.seaY} rock0=${G.rock0} sea=${G.seaB?G.seaB.length:0}`);
  hmark(`mines ${G.mines} safe ${G.safeTotal} bulk ${ladStats.blocks}`);
  const py=Math.floor(P.y/BLOCK);
  hmark(`spawn blk ${Math.floor(P.x/BLOCK)},${py},${Math.floor(P.z/BLOCK)} ` +
       (py>=G.rock0 ? 'ok, inside the rock' : 'FAULT: spawned in the sea'));
  let wood=0; for(let i=0;i<G.nx*G.ny*G.nz;i++) if(G.st[i]!==AIR && G.mat[i]===M_WOOD) wood++;
  hmark(`wood ${wood} vials ${VIALS.length} ` + (wood>60 ? 'ok, the house is built' : 'FAULT'));
  hmark(`shaft above the rock: ${G.st[idx(G.holeX, G.rock0-1, G.holeZ)]===AIR ? 'open ok' : 'SHUT'}` +
       `, into the dungeon: ${G.st[idx(G.holeX, G.rock0+1, G.holeZ)]!==AIR ? 'sealed ok' : 'ALREADY OPEN'}`);
  /* IS IT ACTUALLY SEALED? Flood the world's air from the sea and see whether
     the water can reach where the player is standing. This is the claim -
     "we start locked in the dungeon and it is sealed from the ocean around
     it" - and it is the only one that cannot be argued with. */
  {
    const N=G.nx*G.ny*G.nz, seen=new Uint8Array(N), q=[];
    const push=(x,y,z)=>{
      if(x<0||y<0||z<0||x>=G.nx||y>=G.ny||z>=G.nz) return;
      const i=idx(x,y,z);
      if(seen[i] || G.st[i]!==AIR) return;
      seen[i]=1; q.push(i);
    };
    for(const bi of (G.seaB||[])){ const c=cellXYZ(bi); push(c[0],c[1],c[2]); }
    for(let h=0;h<q.length;h++){
      const i=q[h], c=cellXYZ(i);
      push(c[0]+1,c[1],c[2]); push(c[0]-1,c[1],c[2]);
      push(c[0],c[1]+1,c[2]); push(c[0],c[1]-1,c[2]);
      push(c[0],c[1],c[2]+1); push(c[0],c[1],c[2]-1);
    }
    const si=idx(Math.floor(P.x/BLOCK), Math.floor(P.y/BLOCK), Math.floor(P.z/BLOCK));
    let inside_=0;
    for(let y=G.rock0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      const i=idx(x,y,z);
      if(G.st[i]===AIR && !seen[i]) inside_++;
    }
    hmark(`sealed ${G.sealed} blocks; ${inside_} air blocks the sea cannot reach; ` +
          `where you stand is ${seen[si] ? 'REACHABLE - FAULT, the dungeon is open water' : 'DRY ok, you are locked in'}`);
  }
  /* CAN YOU GET OUT OF THE ROOM YOU START IN? Flood the dungeon's air from
     where the player stands and compare it with all the air inside the
     cylinder. Anything unreachable is a room with no exit, and it does not
     matter whether the player happens to be in it - somebody will be. */
  {
    const N=G.nx*G.ny*G.nz, seen=new Uint8Array(N), q=[];
    const L=G.lump;
    const interior=(x,y,z)=>{
      if(x<0||y<0||z<0||x>=G.nx||y>=G.ny||z>=G.nz) return false;
      if(G.hull && G.hull[idx(x,y,z)]) return false;
      return y>=L.y0-L.hull && Math.hypot(x-L.cx, z-L.cz) <= L.r;
    };
    const push=(x,y,z)=>{
      if(!interior(x,y,z)) return;
      const i=idx(x,y,z);
      if(seen[i] || G.st[i]!==AIR) return;
      seen[i]=1; q.push(i);
    };
    push(Math.floor(P.x/BLOCK), Math.floor(P.y/BLOCK), Math.floor(P.z/BLOCK));
    for(let h=0;h<q.length;h++){
      const c=cellXYZ(q[h]);
      push(c[0]+1,c[1],c[2]); push(c[0]-1,c[1],c[2]);
      push(c[0],c[1]+1,c[2]); push(c[0],c[1]-1,c[2]);
      push(c[0],c[1],c[2]+1); push(c[0],c[1],c[2]-1);
    }
    let tot=0, got=0;
    for(let y=0;y<G.ny;y++) for(let z=0;z<G.nz;z++) for(let x=0;x<G.nx;x++){
      if(!interior(x,y,z)) continue;
      const i=idx(x,y,z);
      if(G.st[i]!==AIR) continue;
      tot++; if(seen[i]) got++;
    }
    hmark(`pockets before repair ${G.pockets}; from where you stand you can reach ` +
          `${got} of ${tot} air blocks ` +
          (tot>0 && got===tot ? 'ok, ONE CONNECTED DUNGEON'
           : `FAULT: ${tot-got} blocks walled off - rooms with no exit`));
  }
  hmark(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
}catch(err){ hmark('THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||'')); }}, 200);
