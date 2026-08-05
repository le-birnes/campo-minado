/* Every board the game actually builds, in blocks and in metres — and the body
   that walks around in them. The voxel scale question is meaningless without
   both: a cell size is only "right" relative to the player standing next to it. */
(function(){
  const out = [];
  out.push(`PLAYER height ${P_H} m, radius ${P_R} m, eye ${EYE} m | BLOCK ${BLOCK} m`);
  const names = ['Apprentice','Sorcerer','Arcane'];
  for (const mode of [MODE_SWEEP, MODE_DUNGEON]){
    for (let d=0; d<3; d++){
      const zs = (mode===MODE_DUNGEON) ? [1,2,4] : [0];
      for (const z of zs){
        if (mode===MODE_DUNGEON) setDungeonLevels(z);
        G.mode = mode;
        genWorld(d);
        let solid=0, rock=0, air=0, mines=0;
        for (let i=0;i<G.nx*G.ny*G.nz;i++){
          if (G.st[i]===ROCK) rock++;
          else if (G.st[i]===SOLID){ solid++; if (G.mine[i]) mines++; }
          else air++;
        }
        const cells = G.nx*G.ny*G.nz;
        out.push(`${(mode===MODE_DUNGEON?'DUNGEON z'+z:'SWEEPER  ')} ${names[d].padEnd(10)} `+
                 `${G.nx}x${G.ny}x${G.nz} = ${String(cells).padStart(6)} blocks | `+
                 `${(G.nx*BLOCK).toFixed(0)}x${(G.ny*BLOCK).toFixed(0)}x${(G.nz*BLOCK).toFixed(0)} m = `+
                 `${String(Math.round(cells*Math.pow(BLOCK,3))).padStart(7)} m3 | `+
                 `solid ${solid} (${mines} mines), rock ${rock}, air ${air}`);
      }
    }
  }
  document.body.dataset.r = out.join('~');
})();
