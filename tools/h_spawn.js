/* Is the start actually safe? Generate many boards at each size and check the
   player is standing in open air with something solid under their feet, and
   not inside the minefield. */
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  for(const z of [1,2,3,4]){
    setDungeonLevels(z);
    let inRock=0, noFloor=0, inMass=0, ok=0;
    for(let k=0;k<60;k++){
      seed=3000+k*7919; G.mode=MODE_DUNGEON; genWorld(0);
      const x=Math.floor(P.x/BLOCK), y=Math.floor(P.y/BLOCK), zz=Math.floor(P.z/BLOCK);
      const here = inside(x,y,zz) ? G.st[idx(x,y,zz)] : -1;
      const below = inside(x,y-1,zz) ? G.st[idx(x,y-1,zz)] : -1;
      const head = inside(x,y+1,zz) ? G.st[idx(x,y+1,zz)] : -1;
      if(here!==AIR){ inRock++; if(here===SOLID) inMass++; continue; }
      if(below===AIR){ noFloor++; continue; }
      ok++;
    }
    R.push(`zones=${z}: ${ok}/60 safe starts | inside rock ${inRock} (of which in the `+
           `minefield ${inMass}) | standing over a hole ${noFloor}`);
  }
  setDungeonLevels(4);
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message; } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 20000);
