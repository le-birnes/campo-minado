setTimeout(()=>{ try{
  G.muted=true; try{snd.setMute(true);}catch(e){}
  const R=[];
  for(const [m,d,name] of [[MODE_SWEEP,0,'sweep Apprentice'],[MODE_SWEEP,1,'sweep Sorcerer'],
                           [MODE_SWEEP,2,'sweep Arcane'],[MODE_DUNGEON,0,'dungeon Apprentice']]){
    G.mode=m; seed=5; genWorld(d);
    R.push(name+' ambient '+darkNow().toFixed(2));
  }
  document.body.dataset.r=R.join(' | ');
}catch(e){ document.body.dataset.r='THROW '+e.message; } }, 250);
