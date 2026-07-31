window.__err=[];
window.addEventListener('error',e=>window.__err.push('ERR '+e.message));
setTimeout(()=>{ try{
  G.muted=true; try{ snd.setMute(true); }catch(e){}
  const R=[];
  R.push('roster '+HELL.length+' | shell '+SHELL+' | '+
         HELL.map(h=>h.name.split(' ')[0]+':'+h.hp+'='+Math.ceil(h.hp/SHELL)+'sh').join(' '));

  // flag every mine on a dungeon and see what happens
  G.mode=MODE_DUNGEON; seed=20000; genWorld(0); G.state='play';
  const n=G.nx*G.ny*G.nz;
  enemies.length=0;
  for(let i=0;i<n;i++) if(G.mine[i] && G.st[i]!==MARKED){ G.st[i]=MARKED; G.marked++; }
  const before=G.state;
  checkWin();
  const boss=enemies.find(e=>e.hell);
  R.push(`all ${G.mines} flagged: state ${before}->${G.state} (must stay play), finale ${G.finale}, `+
         `lava ${G.lava}, boss ${boss?boss.hell.name+' '+boss.dhp+'hp':'NONE'}`);
  if(boss){
    // shooting it costs Doom hit points, not one-per-hit
    const shots=Math.ceil(boss.dmax/SHELL);
    for(let k=0;k<shots;k++){
      boss.dhp -= SHELL;
      if(boss.dhp<=0){ killEnemy(boss, enemies.indexOf(boss)); break; }
    }
    R.push(`${shots} shells killed a ${boss.hell.name} (${boss.dmax} hp): enemies left ${enemies.length}`);
    checkWin();
    R.push(`with it dead: state ${G.state}, win ${G.win} (want over / true)`);
  }
  // and one of its shots costs a whole heart
  {
    seed=20000; genWorld(0); G.state='play'; P.hp=4;
    hurtPlayer(1); const half=P.hp;
    hurtPlayer(2); const whole=P.hp;
    R.push(`damage: 4 -> ${half} for an ordinary shot, -> ${whole} for one of theirs`);
  }
  document.body.dataset.r=R.join(' | ')+' || errors: '+(window.__err.join(';')||'NONE');
}catch(e){ document.body.dataset.r='THROW '+e.message+' @ '+(e.stack||'').split('\n')[1]; } }, 700);
