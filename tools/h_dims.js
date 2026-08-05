/* What is a four-level dungeon, in blocks and in metres? The voxel scale
   question turns on the real volume, not on the largest board the game can
   build. */
(function(){
  const out = [];
  for (const z of [1,2,4]){
    setDungeonLevels(z);
    G.mode = MODE_DUNGEON;
    genWorld(0);
    let solid=0, rock=0, air=0, mines=0;
    for (let i=0;i<G.nx*G.ny*G.nz;i++){
      if (G.st[i]===ROCK) rock++;
      else if (G.st[i]===SOLID){ solid++; if (G.mine[i]) mines++; }
      else air++;
    }
    const cells = G.nx*G.ny*G.nz;
    const vol = cells * Math.pow(BLOCK,3);
    out.push(`zones=${z}: ${G.nx}x${G.ny}x${G.nz} = ${cells} blocks, `+
             `${(G.nx*BLOCK).toFixed(0)}x${(G.ny*BLOCK).toFixed(0)}x${(G.nz*BLOCK).toFixed(0)} m, `+
             `${vol.toFixed(0)} m3 | solid ${solid} (mines ${mines}), rock ${rock}, air ${air}`);
  }
  document.body.dataset.r = out.join('~');
})();
