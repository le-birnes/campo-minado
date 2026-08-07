/* THE HUD CHANGES WHEN THE PUZZLE ENDS.

   Marcelo: "Dungeon mode actually has NO WINNING CONDITIONS. When the dungeon
   is completed and the boss is killed, the HUD should change - only health
   should remain, and add a thumb with a pixelated shotgun to indicate equipped
   weapon and two empty slots for belt equipment."

   Mines left, safe blocks and a clock are what a PUZZLE needs to be told. A
   world needs to be told what is in your hands. So: before the boss it is a
   puzzle's HUD, after it is a world's, and the belt is there with something
   actually drawn in the first slot.

   Asked of the LAYOUT rather than the markup - offsetParent is null for
   anything display:none anywhere up its ancestors, which is the only question
   that means "can he see it". */
window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  const shown = el => !!(el && el.offsetParent !== null);
  const $$ = id => document.getElementById(id);

  document.querySelector('.diffs [data-m="1"]').click();
  document.querySelector('.diffs [data-d="0"]').click();
  document.getElementById('btnStart').click();
  seed=11; genWorld(0); G.state='play';

  R.push(`in the dungeon: mines ${shown($$('sMines'))?'shown':'hidden'}, ` +
         `safe ${shown($$('sLeft'))?'shown':'hidden'}, ` +
         `clock ${shown($$('sTime'))?'shown':'hidden'}, ` +
         `belt ${shown($$('belt'))?'SHOWN':'hidden'}`);
  R.push(shown($$('sMines')) && shown($$('sLeft')) && shown($$('sTime')) && !shown($$('belt'))
         ? 'ok, it is a puzzle and it says so'
         : 'FAULT: the dungeon is not wearing the puzzle HUD');

  G.noWin = true; G.gravK = -1; rollReset();
  revealIsland();

  R.push(`after the boss: mines ${shown($$('sMines'))?'SHOWN':'hidden'}, ` +
         `safe ${shown($$('sLeft'))?'SHOWN':'hidden'}, ` +
         `clock ${shown($$('sTime'))?'SHOWN':'hidden'}, ` +
         `life ${shown($$('sLife'))?'shown':'HIDDEN'}, ` +
         `belt ${shown($$('belt'))?'shown':'HIDDEN'}`);
  R.push(!shown($$('sMines')) && !shown($$('sLeft')) && !shown($$('sTime')) &&
         shown($$('sLife')) && shown($$('belt'))
         ? 'ok: health and the belt, and nothing the puzzle needed'
         : 'FAULT: the HUD did not change');

  /* three slots, one of them holding something */
  const slots = document.querySelectorAll('#belt .slot');
  const held  = document.querySelectorAll('#belt .slot.held');
  R.push(`belt: ${slots.length} slots, ${held.length} holding something ` +
         (slots.length===3 && held.length===1 ? 'ok, a weapon and two empty' : 'FAULT'));

  /* and the thumb is DRAWN, not an empty canvas. Count the pixels that are
     not transparent - a shotgun that failed to draw is a slot with nothing in
     it and looks exactly like the empty ones. */
  const c = $$('wpn'), cx = c.getContext('2d');
  const d = cx.getImageData(0,0,20,20).data;
  let ink=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) ink++;
  R.push(`the shotgun thumb: ${ink} of 400 pixels painted ` +
         (ink > 60 && ink < 340 ? 'ok, there is a gun in there' : 'FAULT: blank or solid'));

  /* HP survives, because it is the one thing a world still has to tell you */
  R.push(`life reads "${$$('sLife').textContent}" hp ${P.hp}/${P.hpMax} ` +
         (P.hp===HP_START ? 'ok' : 'FAULT'));

  R.push(window.__err.length ? ('FAULT '+window.__err.join(' | ')) : 'no errors');
  document.body.dataset.r=R.join(' ~ ');
}catch(err){ document.body.dataset.r='THREW: '+err.message+' @ '+((err.stack||'').split('\n')[1]||''); }}, 300);
