setTimeout(()=>{ try{
  const q=new URLSearchParams(location.search);
  if(q.get('m')==='1'){ G.mode=MODE_DUNGEON; }
  if(q.get('d')) G.diff=+q.get('d');
  syncCustom(); updateDiffNote();
  document.title='ok';
}catch(e){ document.title='THROW '+e.message; } }, 600);
