/* The menu opens closed, and opens up as you answer it.

   Three states to check, and the point of checking them in the DOM rather
   than by looking is that "the difficulties are hidden" and "the difficulties
   are hidden AND Enter still starts a game with whatever was left over" look
   identical in a screenshot.

     nothing picked   two mode buttons, no difficulties, Enter dead
     3D Minesweeper   four difficulties including Custom, Enter live
     Dungeon Mode     three difficulties, only Apprentice pressable, no Custom

   Plus: the manual is behind its button, and the three settings Marcelo asked
   to keep are still on the page. */
setTimeout(()=>{
  const R=[];
  try{
    G.muted = true; try{ snd.setMute(true); }catch(e){}
    const $$ = id => document.getElementById(id);
    const isOn = id => $$(id).classList.contains('on');
    const diffs = () => Array.from(document.querySelectorAll('.diffs [data-d]'));
    const shown = el => el && el.offsetParent !== null;
    const state = () => diffs().map(b =>
        (b.disabled ? 'x' : (b.classList.contains('sel') ? '*' : '-'))).join('');

    /* --- as it loads --- */
    R.push('cold: difficulties ' + (isOn('diffBox')?'SHOWN':'hidden') +
           ', manual ' + (isOn('howBox')?'SHOWN':'hidden') +
           ', Enter ' + ($$('btnStart').disabled ? 'dead' : 'LIVE') +
           ', modes selected ' +
           document.querySelectorAll('.diffs [data-m].sel').length);

    /* --- 3D Minesweeper --- */
    document.querySelector('.diffs [data-m="0"]').click();
    R.push('sweep: difficulties ' + (isOn('diffBox')?'shown':'HIDDEN') +
           ' [' + state() + '] Custom ' + (shown($$('bCustom'))?'offered':'HIDDEN') +
           ', Enter ' + ($$('btnStart').disabled ? 'DEAD' : 'live') +
           ', mode=' + G.mode);
    /* a difficulty click has to take */
    document.querySelector('.diffs [data-d="2"]').click();
    R.push('  picked Arcane -> G.diff=' + G.diff + ' [' + state() + ']');

    /* --- Dungeon --- */
    document.querySelector('.diffs [data-m="1"]').click();
    const lockedIds = diffs().filter(b=>b.disabled).map(b=>b.dataset.d).join(',');
    R.push('dungeon: [' + state() + '] locked=' + (lockedIds||'none') +
           ', Custom ' + (shown($$('bCustom'))?'STILL OFFERED':'withdrawn') +
           ', G.diff=' + G.diff + (G.diff===0 ? ' (forced back to Apprentice)' : ' — NOT FORCED'));
    /* a locked one must not take */
    document.querySelector('.diffs [data-d="1"]').click();
    R.push('  clicked locked Sorcerer -> G.diff=' + G.diff +
           (G.diff===0 ? ' (refused, correct)' : ' — IT TOOK'));

    /* --- the manual --- */
    const keysBefore = shown(document.querySelector('.keys'));
    $$('btnHow').click();
    R.push('how-to: keys ' + (keysBefore?'WERE ALREADY SHOWING':'hidden') +
           ' -> ' + (shown(document.querySelector('.keys'))?'shown':'STILL HIDDEN') +
           ', label "' + $$('btnHow').textContent + '"');
    $$('btnHow').click();
    R.push('  closed again: ' + (isOn('howBox')?'STILL OPEN':'ok'));

    /* --- what had to survive --- */
    const keep = ['sens','inv','mus','btnMusic','btnForge','btnStart'];
    R.push('kept: ' + keep.map(k => k + (shown($$(k))?'':' MISSING')).join(' '));
    /* and the Forge button is the small one now */
    R.push('forge button font ' +
           getComputedStyle($$('btnForge')).fontSize + ' vs Enter ' +
           getComputedStyle($$('btnStart')).fontSize);
    document.body.dataset.r = R.join(' | ');
  }catch(err){ document.body.dataset.r = 'THROW '+err.message+' @ '+(err.stack||'').split('\n')[1]; }
}, 350);
