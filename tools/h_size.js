/* How much room is left? rebuildWorld pushes one instance per non-AIR cell
   plus the whole bedrock shell, into a batch with a HARD cap — overflow drops
   geometry silently, which is the worst way for a limit to announce itself.
   So: what does the biggest board we ship actually use, and how much of that
   is buried where nobody can see it. */
setTimeout(()=>{ try{
  G.muted=true; try{snd.setMute(true);}catch(e){}
  const R=[];
  G.mode=MODE_DUNGEON;
  for(const n of [1,2,4]){
    setDungeonLevels(n); seed=99; genWorld(0);
    rebuildWorld();
    const N=G.nx*G.ny*G.nz;
    let solidish=0, surface=0;
    for(let y=0;y<G.ny;y++)for(let z=0;z<G.nz;z++)for(let x=0;x<G.nx;x++){
      const i=idx(x,y,z);
      if(G.st[i]===AIR) continue;
      solidish++;
      /* visible only if some neighbour is open or off-grid */
      let open=false;
      for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
        const X=x+dx,Y=y+dy,Z=z+dz;
        if(!inside(X,Y,Z) || G.st[idx(X,Y,Z)]===AIR){ open=true; break; }
      }
      if(open) surface++;
    }
    const shell=(G.nx+2)*(G.ny+2)*(G.nz+2)-N;
    R.push(n+'lv: '+N+' cells | drawn '+worldB.count+'/'+worldB.max+
           ' ('+(100*worldB.count/worldB.max).toFixed(0)+'% full)'+
           ' | shell '+shell+' | solid '+solidish+' of which only '+surface+
           ' have an open face ('+(100*surface/Math.max(1,solidish)).toFixed(0)+'%)');
  }
  setDungeonLevels(DL_N);
  document.body.dataset.r=R.join(' | ');
}catch(e){ document.body.dataset.r='THROW '+e.message; } }, 250);
