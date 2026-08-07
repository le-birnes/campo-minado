/* MORTAL: water -> vapour -> air, and the humidity that comes off it.

   Marcelo, three times: "beads which are MORTAL in the sense they become beads
   of vapor after a while (baseline t, if afflicted by pressure and heat, t
   changes accordingly), and the beads of vapor are mortal when surrounded by
   air, thus becoming air itself (increasing the air humidity by some %)".

   What has to be true:
     1. scattered beads go, and they go at about the baseline t
     2. a BODY of water does not - and this is the one that decides whether the
        feature is affordable, because a mortal cell refuses to settle
     3. heat shortens t, pressure lengthens it
     4. the vapour becomes air and the humidity goes up
     5. humid air stops taking more, which is the loop closing
     6. an ocean at rest still costs nothing */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[], f2=v=>(+v).toFixed(3);
  G.mode=MODE_SWEEP; seed=4; genWorld(0); G.state='play';
  const w=SAND;
  const room=(x0,y0,z0,x1,y1,z1)=>{
    for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++) for(let x=x0;x<=x1;x++){
      if(!inside(x,y,z)) continue;
      const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
      sandDig(x,y,z);
    }
  };
  room(1,1,1, G.nx-2, G.ny-1, G.nz-2);
  let HMAX=0;
  const run=(n)=>{ for(let k=0;k<n;k++){ sandTick(w,-1); ladTick();
                     if(HUMID>HMAX) HMAX=HUMID;
                     if(HUMID>0) HUMID=Math.max(0,HUMID-HUMID_DECAY); } };

  /* 1. SCATTERED BEADS. Twelve of them, well apart, on the floor. */
  HUMID = 0;
  const fy = SAND_DIV+1;
  const spots=[];
  for(let k=0;k<12;k++){
    const x = SAND_DIV*2 + k*7, z = SAND_DIV*2 + (k%3)*9;
    w.put(x, fy, z, S_WATER); spots.push([x,fy,z]);
  }
  /* THEY FALL. Counting the cell you dropped a bead into counts an empty cell
     one tick later and reports that everything evaporated instantly - which is
     what the first run of this said. Count the MATERIAL, wherever it got to. */
  const alive=()=>w.count(S_WATER);
  R.push(`12 scattered beads, none touching`);
  let t=0;
  for(; t<4000 && alive()>0; t++) run(1);
  R.push(`all gone after ${t} ticks (${(t/60).toFixed(1)} s) ` +
         (t>200 && t<4000 ? 'ok, about the baseline' : t>=4000 ? 'FAULT: they are immortal' : 'FAULT: too fast'));

  /* 4. and what they became */
  const steam = w.count(S_STEAM);
  R.push(`steam in the air: ${steam} cells, humidity ${f2(HUMID)} ` +
         (steam>0 || HUMID>0 ? 'ok, it turned into something' : 'FAULT: it just vanished'));
  run(2000);
  /* THE PEAK, not the end. Twelve beads put a fiftieth onto the humidity and it
     disperses over seven minutes, so reading it after two thousand ticks reads
     the dispersal rather than the event. */
  R.push(`2000 ticks later: steam ${w.count(S_STEAM)}, humidity peaked at ${f2(HMAX)} ` +
         (HMAX > 0 ? 'ok, the vapour became air and the air was wetter for it' : 'FAULT: no humidity'));

  /* 2. A BODY OF WATER IS NOT MORTAL, and it must not even be scanned.
        A SEALED tank, and that is the case that matters: a free-standing brick
        of water in open air is not a body of water, it is a collapse, and
        measuring the cost of one tells you nothing about the cost of an ocean.
        The edge of a spreading puddle IS mortal and IS meant to cost - that is
        the feature - so the question a body of water answers is the other one. */
  seed=4; genWorld(0); G.state='play';
  const w2=SAND;
  HUMID = 0;
  const bx0=1, by0=1, bz0=1, BW=Math.min(4,G.nx-2), BH=Math.min(1,G.ny-2), BD=Math.min(4,G.nz-2);
  for(let y=by0;y<by0+BH;y++) for(let z=bz0;z<bz0+BD;z++) for(let x=bx0;x<bx0+BW;x++){
    const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
    sandDig(x,y,z);
  }
  /* AND IT IS SEALED. A sweep board has air pockets in it, so a tank dug into
     one has open sky over part of its lid - and the cells under that sky are
     exposed, which makes them mortal, which is correct and is not what this
     test is asking about. Stone over the top, so the question is only whether
     the INSIDE of a body of water is mortal. */
  for(let z=bz0-1;z<=bz0+BD;z++) for(let x=bx0-1;x<=bx0+BW;x++)
    sandFill(x,by0-1,z, S_ROCK, false);
  for(let y=by0;y<by0+BH;y++) for(let z=bz0;z<bz0+BD;z++) for(let x=bx0;x<bx0+BW;x++)
    sandFill(x,y,z, S_WATER, true);
  const body0 = w2.count(S_WATER);
  let settle=0; for(; settle<800 && w2.awake.length; settle++){ sandTick(w2,-1); ladTick(); }
  w2.stats.scanned=0;
  let scan=0; for(let k=0;k<300;k++){ sandTick(w2,-1); ladTick(); scan+=w2.stats.scanned; }
  const body1 = w2.count(S_WATER);
  const lost = body0-body1;
  R.push(`a body of ${body0} cells: settled in ${settle} ticks, ` +
         `${lost} cells lost over 300 more (${(100*lost/body0).toFixed(2)}%), ${scan} scanned`);
  R.push(lost < body0*0.02 && scan < body0
         ? 'ok: the inside of a body of water is not going anywhere and is not being asked'
         : 'FAULT: the ocean is boiling away, or being simulated to find out that it is not');

  /* 3. HEAT. The same lone bead, with fire beside it. */
  /* one bead, dropped on the floor of the room, and it is followed by COUNT
     rather than by position because it falls before it evaporates */
  /* A FRESH WORLD EACH TIME. The first version measured against a count that
     still had the tank in it, so "the bead went in three ticks" was the tank
     losing a cell at its edge. One bead, one world, one number. */
  const hot=(withFire)=>{
    seed=4; genWorld(0); G.state='play';
    const wh=SAND;
    for(let y=1;y<G.ny;y++) for(let z=1;z<G.nz-1;z++) for(let x=1;x<G.nx-1;x++){
      const i=idx(x,y,z); if(G.st[i]!==AIR){ G.st[i]=AIR; G.revealed++; }
      sandDig(x,y,z);
    }
    const cx=(wh.W/2)|0, cz=(wh.D/2)|0, cy=SAND_DIV+2;
    wh.put(cx,cy,cz,S_WATER);
    /* AN EMBER, NOT LAVA, and the reason is worth keeping: lava next to water
       is a REACTION - srx(lava, water -> rock, steam) - so it would fire on
       contact and prove nothing about the heat term. The heat term is for what
       is hot and has no reaction row with water. An ember is exactly that. */
    if(withFire){ for(let d=-1;d<=1;d++){ wh.put(cx+1,cy,cz+d,S_EMBER); wh.put(cx-1,cy,cz+d,S_EMBER); } }
    let n=0;
    for(; n<6000 && wh.count(S_WATER) > 0; n++){ sandTick(wh,-1); ladTick();
      if(HUMID>0) HUMID=Math.max(0,HUMID-HUMID_DECAY); }
    return n;
  };
  HUMID = 0;
  const cold = hot(false);
  HUMID = 0;
  const warm = hot(true);
  R.push(`one bead: ${cold} ticks cold, ${warm} ticks beside embers ` +
         (warm < cold*0.75 ? 'ok, heat shortens t' : 'FAULT: heat does nothing'));

  /* 5. SATURATION. Air that is already full cannot take more. */
  HUMID = 0;
  const dry = hot(false);
  HUMID = 0.95;
  const wet = hot(false);
  R.push(`one bead: ${dry} ticks in dry air, ${wet} in air at 95% ` +
         (wet > dry*1.5 ? 'ok, saturated air stops taking it' : 'FAULT: humidity is a counter nobody reads'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
