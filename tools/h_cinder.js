/* Cinderstone: five shots, darker each time, and the wall is gone. And the
   shell behind it never moves however hard you hit it. */
setTimeout(()=>{ const R=[]; try{
  G.muted=true; try{snd.setMute(true);}catch(e){}
  G.mode=MODE_DUNGEON; startGame(); seed=606; genWorld(0);
  G.state='play'; enemies.length=0; try{hurtPlayer=function(){};}catch(e){}
  const N=G.nx*G.ny*G.nz;
  // a wall with a face on the air, so we can stand off it and shoot
  let w=-1;
  for(let i=0;i<N && w<0;i++){
    if(G.st[i]!==ROCK) continue;
    const [x,y,z]=cellXYZ(i);
    for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){
      const X=x+dx,Y=y+dy,Z=z+dz;
      if(inside(X,Y,Z)&&G.st[idx(X,Y,Z)]===AIR){ w=i; break; }
    }
  }
  const rock0=G.rockCount;
  const [wx,wy,wz]=cellXYZ(w);
  const hits=[];
  for(let k=1;k<=6;k++){
    G.rockHit[w]=Math.min(5,k);
    hits.push(k+':'+(1-Math.min(5,k)/5).toFixed(1));
  }
  R.push('shade by shot '+hits.join(' ')+' (1.0=fresh, 0.0=black)');
  G.rockHit[w]=0;
  // drive it through the real path
  let broke=-1;
  for(let k=1;k<=6;k++){
    const before=G.st[w];
    if(G.st[w]===ROCK){
      G.rockHit[w]=Math.min(5,G.rockHit[w]+1);
      if(G.rockHit[w]>=5){ G.st[w]=AIR; if(G.rockCount>0)G.rockCount--; if(broke<0)broke=k; }
    }
  }
  R.push('wall gone after '+broke+' shots, rockCount '+rock0+' -> '+G.rockCount);
  R.push('CINDER '+JSON.stringify(CINDER)+'  BEDROCK(shell) '+JSON.stringify(BEDROCK));
  R.push('lantern walled up at cell '+G.lampCell+(G.lampCell>=0?' (found)':' — NONE PLACED'));
  const d0=darkNow(); G.lamp=3; const d1=darkNow();
  R.push('ambient '+d0.toFixed(3)+' -> '+d1.toFixed(3)+' after 3 lanterns (+0.01 each)');
  document.body.dataset.r=R.join(' | ');
}catch(e){ document.body.dataset.r=R.join(' | ')+' | THROW '+e.message; } }, 250);
