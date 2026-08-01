/* How tall is each thing, in players? The complaint was that a boss read as
   architecture. */
setTimeout(()=>{ try{
  const R=[]; const rows=[];
  for(const h of HELL){
    const V=hellVoxels(h);
    const height = Math.min(HELL_MAXH, HELL_UNIT*h.s);
    rows.push(`${h.name} ${height.toFixed(1)}m (${(height/P_H).toFixed(2)}x you)`);
  }
  R.push(`player ${P_H}m | ` + rows.join(', '));
  let mx=0, mn=99;
  for(const h of HELL){ const ht=Math.min(HELL_MAXH, HELL_UNIT*h.s); mx=Math.max(mx,ht); mn=Math.min(mn,ht); }
  R.push(`smallest ${mn.toFixed(1)}m (${(mn/P_H).toFixed(2)}x), biggest ${mx.toFixed(1)}m `+
         `(${(mx/P_H).toFixed(2)}x) — cap is 3.00x`);
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message; } }, 400);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 4000);
