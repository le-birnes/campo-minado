/* Put the sprite sheet on screen so it can be photographed and judged. The
   8-ball lesson: never ship art you have not looked at. */
setTimeout(()=>{
  const cv = buildSprites();
  cv.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px;'+
                     'z-index:99999;background:#1a1a24;image-rendering:pixelated';
  document.body.appendChild(cv);
  document.body.dataset.r = 'sheet up';
}, 500);
