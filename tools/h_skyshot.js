/* PHOTOGRAPH THE SKY. Counters cannot see a sky - they can say the sun is at
   23 degrees and nothing about whether the picture reads as a morning.

     ?hour=0.16  the middle of a morning - where the reveal starts
     ?hour=0.44  the sun low over the sea
     ?hour=0.78  night, the moon and the stars
     ?view=sea | house | up | down

   THINGS THIS HARNESS GOT WRONG, kept because each one cost a run:
     1. setting G.state='play' leaves the MENU sitting over the canvas, so the
        photograph is of the menu. Go through the button.
     2. buildIsland zeroes mines and safeTotal, so the next checkWin() declares
        the board solved and generates a fresh cave over the top of the island.
        bossBlows sets G.noWin first; a harness that skips the boss must too.
     3. computing a camera position from the waterline put it three blocks
        INSIDE the island and photographed the inside of a hill. The arrival
        spot is in open air by construction - use it, and change only the aim.
     4. --screenshot cannot show you dataset.r, so the state and any exception
        go into an overlay that is built FIRST and updated for ever. A picture
        that cannot say why it is wrong costs a whole run to interpret. */
(function(){
  var dbg = document.createElement('div');
  dbg.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;color:#7f7;'
    + 'font:11px monospace;background:#000d;padding:4px 6px;white-space:pre;line-height:1.35';
  dbg.textContent = 'harness: waiting';
  var err = '';
  function attach(){ if(document.body && !dbg.parentNode) document.body.appendChild(dbg); }
  attach();
  var f = 0;
  setInterval(function(){
    attach();
    var L = [];
    if(err) L.push('THREW: ' + err);
    try{
      L.push('island=' + G.island + ' grav=' + G.gravK + ' noWin=' + G.noWin + ' state=' + G.state);
      L.push('P ' + P.x.toFixed(1) + ',' + P.y.toFixed(1) + ',' + P.z.toFixed(1)
           + '  blk ' + Math.floor(P.x/BLOCK) + ',' + Math.floor(P.y/BLOCK) + ',' + Math.floor(P.z/BLOCK));
      L.push('seaY=' + G.seaY + ' rock0=' + G.rock0 + ' sea=' + (G.seaB ? G.seaB.length : 0)
           + ' bulk=' + ladStats.blocks + ' massDrawn=' + ladStats.drawn);
      L.push('yaw=' + P.yaw.toFixed(2) + ' pitch=' + P.pitch.toFixed(2)
           + ' roll=' + rollNow().toFixed(2) + ' sunY=' + _sun[1].toFixed(2)
           + ' dark=' + darkNow().toFixed(2) + ' f=' + (f++));
      L.push('skyDrew=' + SKY_DREW + (SKY_LAST
           ? ('  el=' + SKY_LAST.el.toFixed(2) + ' night=' + SKY_LAST.night.toFixed(2)
              + ' zen=' + SKY_LAST.zen.map(function(v){return v.toFixed(2);}).join(',')
              + ' hor=' + SKY_LAST.hor.map(function(v){return v.toFixed(2);}).join(','))
           : '  SKY_LAST null'));
    }catch(e){ L.push('overlay: ' + e.message); }
    dbg.textContent = L.join('\n');
  }, 40);

  setTimeout(function(){ try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    document.querySelector('.diffs [data-m="1"]').click();
    document.querySelector('.diffs [data-d="0"]').click();
    document.getElementById('btnStart').click();
    seed = 11; genWorld(0); G.state = 'play';
    G.holeX = (G.nx/2)|0; G.holeZ = (G.nz/2)|0;
    G.noWin = true;
    G.gravK = -1; rollReset();
    buildIsland();

    var hr = parseFloat((location.search.match(/hour=([\d.]+)/) || [])[1]);
    if(isFinite(hr)) SKY_T0 = tGlobal - (hr - 0.16)*SKY_DAY;

    var which = (location.search.match(/view=(\w+)/) || [])[1] || 'sea';
    if(which === 'sea'){ P.yaw += Math.PI; P.pitch = 0.05; }
    else if(which === 'up'){ P.pitch = 0.80; }
    else if(which === 'down'){ P.pitch = -0.50; }
    P.vx = P.vy = P.vz = 0; P.ground = true;
    G.dirty = true;
    document.body.dataset.r = 'sky ' + (isFinite(hr) ? hr : 0.16) + ' view ' + which;
  }catch(e){
    err = e.message + ' @ ' + ((e.stack||'').split('\n')[1]||'');
    document.body.dataset.r = 'THREW: ' + err;
  }}, 200);
})();
