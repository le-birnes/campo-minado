window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  const R=[];
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const N=()=>G.nx*G.ny*G.nz;

  /* The bot's own definitions, so this measures the bot's world model and not
     some idealised one. */
  const passable =(x,y,z)=> inside(x,y,z) && G.st[idx(x,y,z)]===AIR;
  const supported=(x,y,z)=> y<=0 || !inside(x,y-1,z) || G.st[idx(x,y-1,z)]!==AIR;
  const standable=(x,y,z)=> passable(x,y,z) && supported(x,y,z);
  function seesFrom(x,y,z, cell){
    const [tx,ty,tz]=cellXYZ(cell);
    const ex=(x+0.5)*BLOCK, ey=y*BLOCK+EYE, ez=(z+0.5)*BLOCK;
    const ax=(tx+0.5)*BLOCK, ay=(ty+0.5)*BLOCK, az=(tz+0.5)*BLOCK;
    let vx=ax-ex, vy=ay-ey, vz=az-ez;
    const d=Math.hypot(vx,vy,vz)||1;
    if(d>13*BLOCK) return false;
    const h=raycast(ex,ey,ez, vx/d,vy/d,vz/d, 13*BLOCK, false);
    return !!(h.hit && h.x===tx && h.y===ty && h.z===tz);
  }

  /* Question: when the bot says "nothing it could reach", is that the level or
     the search? Take frontier blocks on a partly-dug board and ask, for each,
     whether ANY standable cell in the whole world can see it — then whether one
     exists inside the radius the bot actually searches. */
  for(const [diff,label] of [[2,'Arcane'],[BOSS,'Dungeon']]){
    let tot=0, anywhere=0, withinR=0, standNear=0, noStandAtAll=0;
    const radHist={};
    for(let b=0;b<2;b++){
      seed=70000+b*7919; genWorld(diff); G.state='play';
      // dig a while so the board looks like one the bot gave up on
      for(let k=0;k<45;k++){
        const f=[];
        for(let i=0;i<N();i++){
          if(G.st[i]!==SOLID || G.mine[i]) continue;
          for(const j of nbrsOf(i)) if(G.st[j]===AIR){ f.push(i); break; }
          if(f.length>40) break;
        }
        if(!f.length) break;
        revealAt(f[(f.length*0.5)|0], true);
      }
      // frontier blocks: what the bot would be trying to act on
      const front=[];
      for(let i=0;i<N();i++){
        if(G.st[i]!==SOLID) continue;
        for(const j of nbrsOf(i)) if(G.st[j]===AIR){ front.push(i); break; }
      }
      for(const cell of front.slice(0,40)){
        tot++;
        const [tx,ty,tz]=cellXYZ(cell);
        let best=-1, sawStand=false;
        for(let r=1;r<=8 && best<0;r++){
          for(let dy=-r;dy<=r && best<0;dy++) for(let dz=-r;dz<=r && best<0;dz++) for(let dx=-r;dx<=r;dx++){
            if(Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz))!==r) continue;
            const X=tx+dx,Y=ty+dy,Z=tz+dz;
            if(!standable(X,Y,Z)) continue;
            sawStand=true;
            if(seesFrom(X,Y,Z,cell)){ best=r; break; }
          }
        }
        if(!sawStand) noStandAtAll++;
        else standNear++;
        if(best>=0){ anywhere++; if(best<=5) withinR++; radHist[best]=(radHist[best]||0)+1; }
      }
    }
    const pc=v=>(100*v/tot).toFixed(1)+'%';
    R.push(`${label}: ${tot} frontier blocks | somewhere to stand that SEES it: ${anywhere} (${pc(anywhere)}) | `+
           `within the radius-5 the bot searches: ${withinR} (${pc(withinR)}) | `+
           `no standable cell anywhere near it at all: ${noStandAtAll} (${pc(noStandAtAll)})`);
    R.push(`${label} distance to the nearest spot that can see it: `+
           Object.keys(radHist).sort((a,b)=>a-b).map(k=>`${k}:${radHist[k]}`).join(' '));
  }
  window.__st=R.join(' | ');
}catch(e){ window.__err.push('THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]); } }, 700);
setTimeout(()=>{
  document.body.dataset.r=(window.__st||'DID NOT RUN')+
    ' || errors: '+(window.__err.length?window.__err.join(' ; '):'NONE');
}, 30000);
