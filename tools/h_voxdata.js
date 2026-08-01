/* The draw call needs a running frame loop, which the harness cannot give.
   The DATA does not. Verify the sculpting itself: every creature builds, the
   depths are rounded rather than slabbed, and nothing exceeds the batch. */
setTimeout(()=>{ try{
  const R=[]; let worst=0, worstName='';
  const hist={};
  for(const h of HELL){
    const V=hellVoxels(h);
    if(!V.vox || !V.vox.length){ R.push(h.name+': NO VOXELS'); continue; }
    let minD=99,maxD=0,sum=0;
    let xmin=1e9,xmax=-1e9,ymin=1e9,ymax=-1e9;
    for(const v of V.vox){
      minD=Math.min(minD,v.depth); maxD=Math.max(maxD,v.depth); sum+=v.depth;
      hist[v.depth]=(hist[v.depth]||0)+1;
      xmin=Math.min(xmin,v.x); xmax=Math.max(xmax,v.x);
      ymin=Math.min(ymin,v.y); ymax=Math.max(ymax,v.y);
    }
    if(V.vox.length>worst){ worst=V.vox.length; worstName=h.name; }
    R.push(`${h.name}: ${V.vox.length} voxels, depth ${minD}-${maxD} (avg ${(sum/V.vox.length).toFixed(1)}), `+
           `${V.W}x${V.H} px, x ${xmin.toFixed(1)}..${xmax.toFixed(1)} y ${ymin.toFixed(1)}..${ymax.toFixed(1)}`);
  }
  R.push(`worst case ${worst} voxels (${worstName}) against a batch of ${hellB.max} — `+
         (worst<=hellB.max ? 'fits' : 'OVERFLOWS'));
  R.push('depth spread: '+Object.keys(hist).sort((a,b)=>a-b).map(k=>k+':'+hist[k]).join(' ')+
         ' (a slab would be one number; a sculpted body is several)');
  /* caching: the distance transform must run once per drawing, not per frame */
  const t0=performance.now(); for(let i=0;i<500;i++) hellVoxels(HELL[12]);
  R.push(`500 repeat builds took ${(performance.now()-t0).toFixed(1)} ms (cached)`);
  window.__st=R.join(' | ');
}catch(e){ window.__st='THROW '+e.message; } }, 500);
setTimeout(()=>{ document.body.dataset.r=window.__st||'DID NOT RUN'; }, 3000);
