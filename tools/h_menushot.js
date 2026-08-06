/* Just the menu, with a mode and a difficulty picked, so the way in is visible. */
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  document.querySelector('.diffs [data-m="0"]').click();
  document.querySelector('.diffs [data-d="0"]').click();
  document.body.dataset.r='menu';
}catch(err){ document.body.dataset.r='THREW '+err.message; }}, 300);
