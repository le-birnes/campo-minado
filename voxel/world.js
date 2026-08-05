/* ============================================================================
   THE WORLD, MADE OF PARTICLES
   ============================================================================
   Marcelo: "make the world made of such particles, in BLOCK/16, full world -
   dungeon and sweeper. Each shot burns 2 particles radius (each pellet made of
   1 tetrahedric voxel). When blocks are destroyed they fall apart, becoming air
   after 3 seconds."

   So: every block of the real board becomes 16x16x16 cubes of six tetrahedra —
   24,576 particles a block — and the game's own numbers apply to it.

     Arcane SWEEPER   900 blocks    22,118,400 particles     22 MB
     DUNGEON 4 levels 7,776 blocks 191,102,976 particles    191 MB

   Two things make that runnable rather than theoretical, and they are the same
   two things the benchmarks have been pointing at all along:

     THE DIRTY RECT — a chunk that did not change is never looked at. A world of
     191 million particles standing still costs nothing per frame.

     THE ACTIVE RADIUS — chunks far from the player are not simulated at all.
     They are not deleted, not unloaded, not approximated: they are simply not
     ticked, and they resume exactly where they were the moment anything comes
     near. That is Marcelo's "situational computing", and this file measures it.
   ========================================================================== */

const W_AIR=0, W_ROCK=1, W_SAND=2, W_DEBRIS=3, W_CINDER=4;
/* Debris is what a destroyed block turns into: it falls, and it has three
   seconds to live. That lifetime is the entire reason a collapse does not leave
   the world permanently full of rubble to simulate. */
const DEBRIS_LIFE = 3.0;

class VoxWorld {
  /* bx,by,bz — the board in BLOCKS. div — cubes per block edge. */
  constructor(bx,by,bz,div){
    this.bx=bx; this.by=by; this.bz=bz; this.div=div;
    this.nx=bx*div; this.ny=by*div; this.nz=bz*div;   // in cubes
    this.n = this.nx*this.ny*this.nz*6;               // in particles
    this.m = new Uint8Array(this.n);
    this.age = new Float32Array(0);                   // allocated lazily, debris only
    /* Chunks of 16 cubes so a block is exactly one chunk at div=16: the unit the
       game already thinks in becomes the unit the simulation wakes. */
    this.cs = 16;
    this.cx=Math.ceil(this.nx/this.cs); this.cy=Math.ceil(this.ny/this.cs); this.cz=Math.ceil(this.nz/this.cs);
    this.nchunk = this.cx*this.cy*this.cz;
    this.wake = new Uint8Array(this.nchunk);          // 1 = simulate next tick
    this.mesh = new Uint8Array(this.nchunk);          // 1 = geometry is stale
    this.debris = [];                                 // {i, t} particles on the clock
    this.stats = {particles:this.n, awake:0, inRange:0, scanned:0, moved:0,
                  burned:0, collapsed:0, meshed:0};
  }
  idx(x,y,z,t){ return (((y*this.nz + z)*this.nx + x)*6) + t; }
  inside(x,y,z){ return x>=0&&y>=0&&z>=0&&x<this.nx&&y<this.ny&&z<this.nz; }
  chunkOf(x,y,z){ return (((y/this.cs)|0)*this.cz + ((z/this.cs)|0))*this.cx + ((x/this.cs)|0); }
  touch(x,y,z){
    const c = this.chunkOf(x,y,z);
    this.wake[c]=1; this.mesh[c]=1;
    /* Wake the neighbours on a boundary or material stops dead at chunk seams,
       which looks like a shelf and is the classic falling-sand bug. */
    const lx=x%this.cs, ly=y%this.cs, lz=z%this.cs;
    if(lx===0&&x>0) this.wake[this.chunkOf(x-1,y,z)]=1;
    if(ly===0&&y>0) this.wake[this.chunkOf(x,y-1,z)]=1;
    if(lz===0&&z>0) this.wake[this.chunkOf(x,y,z-1)]=1;
    if(lx===this.cs-1&&x<this.nx-1) this.wake[this.chunkOf(x+1,y,z)]=1;
    if(ly===this.cs-1&&y<this.ny-1) this.wake[this.chunkOf(x,y+1,z)]=1;
    if(lz===this.cs-1&&z<this.nz-1) this.wake[this.chunkOf(x,y,z+1)]=1;
  }

  /* Fill one BLOCK of the board with a material — the bridge from the game's
     grid to the particle grid. */
  fillBlock(bxi,byi,bzi,v){
    const d=this.div, x0=bxi*d, y0=byi*d, z0=bzi*d;
    for(let y=y0;y<y0+d;y++) for(let z=z0;z<z0+d;z++) for(let x=x0;x<x0+d;x++)
      for(let t=0;t<6;t++) this.m[this.idx(x,y,z,t)] = v;
  }

  /* ---- the shot ----
     A pellet is ONE tetrahedron and it burns a radius of two particles. At
     BLOCK/16 a particle is 9.6 cm, so a pellet takes a hole about 19 cm across
     and a full eighteen-pellet shot chews a real bite out of a wall. */
  burn(cx,cy,cz,r){
    let n=0;
    const R=Math.ceil(r);
    for(let dy=-R;dy<=R;dy++) for(let dz=-R;dz<=R;dz++) for(let dx=-R;dx<=R;dx++){
      if(dx*dx+dy*dy+dz*dz > r*r) continue;
      const x=cx+dx, y=cy+dy, z=cz+dz;
      if(!this.inside(x,y,z)) continue;
      for(let t=0;t<6;t++){
        const i=this.idx(x,y,z,t);
        if(this.m[i]===W_AIR) continue;
        this.m[i]=W_AIR; n++;
      }
      this.touch(x,y,z);
    }
    this.stats.burned += n;
    return n;
  }

  /* How much of a block is left. The game asks this to decide whether the block
     it knows about has been destroyed. */
  blockSolid(bxi,byi,bzi){
    const d=this.div, x0=bxi*d, y0=byi*d, z0=bzi*d;
    let n=0;
    for(let y=y0;y<y0+d;y++) for(let z=z0;z<z0+d;z++) for(let x=x0;x<x0+d;x++)
      for(let t=0;t<6;t++) if(this.m[this.idx(x,y,z,t)]!==W_AIR) n++;
    return n;
  }

  /* ---- the block falls apart ----
     Everything still standing in it becomes debris: it falls, and it has three
     seconds. Without the clock a collapsed level leaves rubble that is simulated
     for the rest of the run. */
  collapse(bxi,byi,bzi){
    const d=this.div, x0=bxi*d, y0=byi*d, z0=bzi*d;
    let n=0;
    for(let y=y0;y<y0+d;y++) for(let z=z0;z<z0+d;z++) for(let x=x0;x<x0+d;x++){
      let any=false;
      for(let t=0;t<6;t++){
        const i=this.idx(x,y,z,t);
        if(this.m[i]===W_AIR||this.m[i]===W_DEBRIS) continue;
        this.m[i]=W_DEBRIS; this.debris.push({i, t:DEBRIS_LIFE}); n++; any=true;
      }
      if(any) this.touch(x,y,z);
    }
    this.stats.collapsed++;
    return n;
  }

  /* ---- one tick ----
     px,py,pz — where the player is, in METRES. radius — how far from them the
     world is alive, also in metres. Beyond it nothing is scanned: the material
     is still there, still exact, simply not moving. */
  step(dt, px,py,pz, radius, blockSize){
    const S=this.stats;
    S.awake=0; S.inRange=0; S.scanned=0; S.moved=0;
    const cw = blockSize/this.div*this.cs;          // chunk edge in metres
    const r2 = radius*radius;
    const live=[];
    for(let c=0;c<this.nchunk;c++){
      if(!this.wake[c]) continue;
      S.awake++;
      const cxi=c%this.cx, czi=((c/this.cx)|0)%this.cz, cyi=(c/(this.cx*this.cz))|0;
      const wx=(cxi+0.5)*cw, wy=(cyi+0.5)*cw, wz=(czi+0.5)*cw;
      const dx=wx-px, dy=wy-py, dz=wz-pz;
      /* THE ACTIVE RADIUS. Out of range is not out of existence — the chunk
         keeps its wake flag and resumes untouched when the player returns. */
      if(radius>0 && dx*dx+dy*dy+dz*dz > r2) continue;
      S.inRange++;
      live.push([c,cxi,cyi,czi]);
    }
    for(const [c,cxi,cyi,czi] of live){
      this.wake[c]=0;
      const x0=cxi*this.cs, y0=cyi*this.cs, z0=czi*this.cs;
      const x1=Math.min(x0+this.cs,this.nx), y1=Math.min(y0+this.cs,this.ny), z1=Math.min(z0+this.cs,this.nz);
      for(let y=y0;y<y1;y++) for(let z=z0;z<z1;z++) for(let x=x0;x<x1;x++){
        for(let t=0;t<6;t++){
          const i=this.idx(x,y,z,t);
          const v=this.m[i];
          if(v===W_AIR||v===W_ROCK||v===W_CINDER) continue;
          S.scanned++;
          /* Straight down first, then the four diagonals: the moves this
             lattice offers going downhill. */
          if(y>0){
            const below=this.idx(x,y-1,z,t);
            if(this.m[below]===W_AIR){
              this.m[below]=v; this.m[i]=W_AIR; S.moved++;
              this.touch(x,y,z); this.touch(x,y-1,z);
              continue;
            }
            const D=[[1,0],[-1,0],[0,1],[0,-1]];
            for(let k=0;k<4;k++){
              const X=x+D[k][0], Z=z+D[k][1];
              if(!this.inside(X,y-1,Z)) continue;
              const j=this.idx(X,y-1,Z,t);
              if(this.m[j]!==W_AIR) continue;
              this.m[j]=v; this.m[i]=W_AIR; S.moved++;
              this.touch(x,y,z); this.touch(X,y-1,Z);
              break;
            }
          }
        }
      }
    }
    /* Debris on the clock. Three seconds and it is air, whether it landed or
       not — which is what stops a collapse from becoming permanent load. */
    if(this.debris.length){
      let w=0;
      for(let k=0;k<this.debris.length;k++){
        const d=this.debris[k];
        d.t-=dt;
        if(d.t<=0){
          if(this.m[d.i]===W_DEBRIS) this.m[d.i]=W_AIR;
          continue;
        }
        this.debris[w++]=d;
      }
      this.debris.length=w;
    }
  }
  wakeAll(){ this.wake.fill(1); this.mesh.fill(1); }
  count(){ let n=0; for(let i=0;i<this.n;i++) if(this.m[i]!==W_AIR) n++; return n; }
}
