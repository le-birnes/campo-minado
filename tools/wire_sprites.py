import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_sprites as G

G.validate()
ART = G.emit()

p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'index.html')
s = open(p, encoding='utf-8').read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, 'matched %d: %.70r' % (s.count(a), a)
    s = s.replace(a, b)


# ---- 1. the roster carries a drawing and a tile ---------------------------
OLD = """const HELL = [
  {name:'Zombieman',        hp:  20, sil:SIL_WALK,  col:[0.45,0.32,0.26], s:0.85},
  {name:'Shotgun Guy',      hp:  30, sil:SIL_WALK,  col:[0.30,0.28,0.24], s:0.88},
  {name:'Imp',              hp:  60, sil:SIL_WALK,  col:[0.62,0.42,0.24], s:0.95},
  {name:'Lost Soul',        hp: 100, sil:SIL_FLOAT, col:[0.94,0.62,0.18], s:0.70},
  {name:'Demon',            hp: 150, sil:SIL_WALK,  col:[0.78,0.36,0.34], s:1.10},
  {name:'Spectre',          hp: 150, sil:SIL_WALK,  col:[0.55,0.55,0.58], s:1.10},
  {name:'Revenant',         hp: 300, sil:SIL_WALK,  col:[0.86,0.84,0.78], s:1.15},
  {name:'Cacodemon',        hp: 400, sil:SIL_FLOAT, col:[0.80,0.16,0.16], s:1.35},
  {name:'Pain Elemental',   hp: 400, sil:SIL_FLOAT, col:[0.68,0.50,0.34], s:1.30},
  {name:'Hell Knight',      hp: 500, sil:SIL_WALK,  col:[0.66,0.52,0.34], s:1.30},
  {name:'Arachnotron',      hp: 500, sil:SIL_LEGS,  col:[0.72,0.62,0.44], s:1.25},
  {name:'Mancubus',         hp: 600, sil:SIL_WALK,  col:[0.74,0.50,0.30], s:1.45},
  {name:'Archvile',         hp: 700, sil:SIL_WALK,  col:[0.80,0.66,0.44], s:1.20},
  {name:'Baron of Hell',    hp:1000, sil:SIL_WALK,  col:[0.72,0.30,0.24], s:1.45},
  {name:'Spider Mastermind',hp:3000, sil:SIL_LEGS,  col:[0.74,0.66,0.50], s:1.80},
  {name:'Cyberdemon',       hp:4000, sil:SIL_WALK,  col:[0.70,0.22,0.18], s:1.90}
];"""
NEW = """const HELL = [
  {name:'Zombieman',        hp:  20, sil:SIL_WALK,  col:[0.45,0.42,0.26], s:0.85, art:'zombie'},
  {name:'Shotgun Guy',      hp:  30, sil:SIL_WALK,  col:[0.34,0.32,0.30], s:0.88, art:'sarge'},
  {name:'Imp',              hp:  60, sil:SIL_WALK,  col:[0.62,0.38,0.20], s:0.95, art:'imp'},
  {name:'Lost Soul',        hp: 100, sil:SIL_FLOAT, col:[0.94,0.62,0.18], s:0.70, art:'soul'},
  {name:'Demon',            hp: 150, sil:SIL_WALK,  col:[0.78,0.36,0.34], s:1.10, art:'demon'},
  {name:'Spectre',          hp: 150, sil:SIL_WALK,  col:[0.52,0.54,0.58], s:1.10, art:'spectre', ghost:true},
  {name:'Revenant',         hp: 300, sil:SIL_WALK,  col:[0.86,0.84,0.78], s:1.15, art:'revenant'},
  {name:'Cacodemon',        hp: 400, sil:SIL_FLOAT, col:[0.72,0.14,0.12], s:1.35, art:'caco'},
  {name:'Pain Elemental',   hp: 400, sil:SIL_FLOAT, col:[0.62,0.46,0.32], s:1.30, art:'pain'},
  {name:'Hell Knight',      hp: 500, sil:SIL_WALK,  col:[0.60,0.50,0.36], s:1.30, art:'knight'},
  {name:'Arachnotron',      hp: 500, sil:SIL_LEGS,  col:[0.70,0.58,0.40], s:1.25, art:'arach'},
  {name:'Mancubus',         hp: 600, sil:SIL_WALK,  col:[0.74,0.48,0.28], s:1.45, art:'mancubus'},
  {name:'Archvile',         hp: 700, sil:SIL_WALK,  col:[0.78,0.62,0.40], s:1.20, art:'vile'},
  {name:'Baron of Hell',    hp:1000, sil:SIL_WALK,  col:[0.72,0.26,0.20], s:1.45, art:'baron'},
  {name:'Spider Mastermind',hp:3000, sil:SIL_LEGS,  col:[0.74,0.66,0.50], s:1.80, art:'spider'},
  {name:'Cyberdemon',       hp:4000, sil:SIL_WALK,  col:[0.70,0.24,0.18], s:1.90, art:'cyber'}
];
HELL.forEach((h,i)=>{ h.tile=i; });

/* ==========================================================================
   THE OLD SPRITES

   These are drawn, not modelled. Everything else in this game is cubes, and
   cubes were exactly the problem: a creature assembled out of boxes reads as
   a creature assembled out of boxes, which is the one thing the finale must
   not look like. What made those enemies what they were is that they were
   PAINTED — a single flat frame, hand-shaded, hard-edged, turning to face you
   however you circled it. So that is what these are.

   The pixels are ours. Nothing is lifted from anyone's sprite sheet; what is
   borrowed is the idiom, which is a small grid of big pixels, a hard alpha
   edge and no lighting at all. Shape lives in the drawing, colour comes from
   each creature's own ramp — the same trick the originals used, where the
   Baron and the Hell Knight are one drawing in two palettes and the Spectre
   is the Demon rendered almost invisible.
   ========================================================================== */
"""
NEW += ART + """

const SPR_N=4, SPR_TILE=256, SPR_PX=SPR_N*SPR_TILE;
/* Fixed colours: bone, metal, eye-light, blood and fire look wrong if they
   drift with the body, so they never do. */
const SPR_FIXED = {
  w:[0.94,0.93,0.87], g:[0.26,0.27,0.30], G:[0.60,0.62,0.66],
  e:[1.00,0.93,0.32],  r:[0.40,0.04,0.05], R:[0.88,0.13,0.10], y:[1.00,0.68,0.14]
};
function hellPalette(c){
  const mul = k => [Math.min(1,c[0]*k), Math.min(1,c[1]*k), Math.min(1,c[2]*k)];
  return Object.assign({k:mul(0.20), d:mul(0.55), m:mul(1.00), l:mul(1.30), h:mul(1.62)},
                       SPR_FIXED);
}
function buildSprites(){
  const cv=document.createElement('canvas'); cv.width=cv.height=SPR_PX;
  const x=cv.getContext('2d');
  x.clearRect(0,0,SPR_PX,SPR_PX);
  for(const h of HELL){
    const rows = HELL_ART[h.art] || HELL_ART[HELL_SHARE[h.art]];
    if(!rows) continue;
    const W=rows[0].length, H=rows.length;
    /* Integer scale only. A fractional one puts half-pixels down the edge of
       every limb, and half a pixel is the difference between pixel art and a
       photograph of pixel art. */
    const px = Math.max(1, Math.floor(Math.min(SPR_TILE/W, SPR_TILE/H)));
    const ox = (h.tile%SPR_N)*SPR_TILE + ((SPR_TILE - W*px)>>1);
    const oy = Math.floor(h.tile/SPR_N)*SPR_TILE + ((SPR_TILE - H*px)>>1);
    const pal = hellPalette(h.col);
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){
      const ch=rows[r][c];
      if(ch==='.') continue;
      const col=pal[ch]; if(!col) continue;
      x.fillStyle='rgb('+((col[0]*255)|0)+','+((col[1]*255)|0)+','+((col[2]*255)|0)+')';
      x.fillRect(ox+c*px, oy+r*px, px, px);
    }
  }
  return cv;
}
const spriteTex = gl.createTexture();
{
  const cv = buildSprites();
  gl.bindTexture(gl.TEXTURE_2D, spriteTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  /* NEAREST, and no mipmaps. Every smoothing step this texture could get is
     a step away from the thing it is imitating. */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
const SPR_UV=[];
for(let i=0;i<SPR_N*SPR_N;i++){
  const cx=(i%SPR_N)*SPR_TILE, cy=Math.floor(i/SPR_N)*SPR_TILE;
  SPR_UV.push([cx/SPR_PX, 1-(cy+SPR_TILE)/SPR_PX, (cx+SPR_TILE)/SPR_PX, 1-cy/SPR_PX]);
}"""
rep(OLD, NEW)

# ---- 2. the shader learns a third mode ------------------------------------
rep("""in vec2 vUV; in vec4 vCol; in float vMode;
uniform sampler2D uTex;
out vec4 frag;
void main(){
  vec4 t = texture(uTex, vUV);""",
"""in vec2 vUV; in vec4 vCol; in float vMode;
uniform sampler2D uTex;
uniform sampler2D uSpr;
out vec4 frag;
void main(){
  /* mode 2: a painted sprite. The texture IS the art — no channel tricks, no
     lighting, and a hard alpha cut, because a soft edge on one of these is a
     sprite from the wrong decade. */
  if(vMode > 1.5){
    vec4 sp = texture(uSpr, vUV);
    if(sp.a < 0.45) discard;
    frag = vec4(sp.rgb * vCol.rgb, vCol.a);
    return;
  }
  vec4 t = texture(uTex, vUV);""")
rep("""  tex:gl.getUniformLocation(pBB,'uTex')
};""",
"""  tex:gl.getUniformLocation(pBB,'uTex'),
  spr:gl.getUniformLocation(pBB,'uSpr')
};""")

# ---- 3. a batch of its own ------------------------------------------------
rep("""const boomB   = makeBBBatch(4);   // the hit mine, drawn over everything""",
"""const boomB   = makeBBBatch(4);   // the hit mine, drawn over everything
const sprB    = makeBBBatch(8);   // the old things, painted""")

# ---- 4. hell enemies are drawn, not built --------------------------------
rep("""    const d=enemyB.data; let n=0;
    for(const e of enemies){
      const T=ETYPES[e.t], parts=EBODY[e.t];""",
"""    const d=enemyB.data; let n=0;
    for(const e of enemies){
      if(e.hell) continue;                        // painted instead, see sprB
      const T=ETYPES[e.t], parts=EBODY[e.t];""")
rep("""    enemyB.count=n;
    gl.uniform1f(uC.outline, 1.25);
    drawCubes(enemyB);
    gl.uniform1f(uC.outline, 1.0);
  }""",
"""    enemyB.count=n;
    gl.uniform1f(uC.outline, 1.25);
    drawCubes(enemyB);
    gl.uniform1f(uC.outline, 1.0);
  }

  /* The finale, painted. One quad, always square: the drawing is letterboxed
     inside a square tile, so a square quad keeps its proportions without the
     draw code having to know anything about how wide the creature is. */
  {
    const d=sprB.data; let n=0;
    for(const e of enemies){
      if(!e.hell || n>=sprB.max) continue;
      const grow = (e.state==='emerge' ? 0.25+0.75*e.emerge : 1) * (e.mScale||1);
      const size = 2.9*grow;
      const flash = e.flash>0 ? e.flash/0.25 : 0;
      const aimK = e.aim ? 1 - e.lock/Math.max(0.05,e.lockMax) : 0;
      const uv = SPR_UV[e.hell.tile];
      const o=n*BB_STRIDE;
      d[o]=e.x; d[o+1]=e.y; d[o+2]=e.z; d[o+3]=size; d[o+4]=size;
      d[o+5]=uv[0]; d[o+6]=uv[1]; d[o+7]=uv[2]; d[o+8]=uv[3];
      /* It whitens when hit and warms as the shot charges — the same tells the
         cube bodies give, moved onto the paint. */
      d[o+9] =1+flash*1.3+aimK*0.45; d[o+10]=1+flash*1.3; d[o+11]=1+flash*1.3;
      /* The Spectre is the Demon you can hardly see, which is the entire joke
         of the Spectre, and it shimmers so it is not mistaken for a ghost of
         the renderer. */
      d[o+12]=e.hell.ghost ? 0.30+0.10*Math.sin(tGlobal*5.0) : 1;
      d[o+13]=0; d[o+14]=2; d[o+15]=0;
      n++;
    }
    sprB.count=n;
  }""")

# ---- 5. draw it with the sprite sheet bound ------------------------------
rep("""  gl.disable(gl.CULL_FACE);
  drawBBs(glyphB);""",
"""  gl.disable(gl.CULL_FACE);
  drawBBs(glyphB);

  if(sprB.count){
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, spriteTex);
    gl.uniform1i(uB.spr, 1);
    drawBBs(sprB);
    gl.activeTexture(gl.TEXTURE0);
  }""")

open(p, 'w', encoding='utf-8').write(s)
print('sprites wired')
