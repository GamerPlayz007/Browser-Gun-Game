/**
 * CROSSFIRE Stage 2.3 collision adaptation — portable, deterministic-ish browser collision laboratory.
 * All measurements are metres; player position is CENTER X/Z and FEET Y.
 * Box convention: x,z centre, y BOTTOM, w/h/d full dimensions.
 * This is a KINEMATIC movement prototype; not hooked to a live game server.
 * It contains no weapon or network code.
 */
export const DEFAULTS=Object.freeze({
  radius:0.32, height:1.80, stepHeight:0.245, snapDown:0.30,
  gravity:18, jumpSpeed:6.5, skin:0.0025, maxSubstep:0.12,
  fixedMaxDt:0.10, maxSubsteps:96, cellSize:6,
  groundProbeRadius:0.19, maxSlopeDeg:48,
});

const WALKABLE=new Set(['floor','routeFloor','stairTread','stairLanding','deck','ramp','building','atriumShell']);
const NOT_PHYSICAL=new Set(['urbanContext','decoration','sign','light']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sq=(v)=>v*v;

export function boxExtents(b){
  return {xmin:b.x-b.w/2,xmax:b.x+b.w/2,zmin:b.z-b.d/2,zmax:b.z+b.d/2,
    ymin:b.y,ymax:b.y+b.h};
}
export function surfaceTop(b,x,z){
  if(b.kind!=='ramp')return b.y+b.h;
  const along=b.axis==='x'?x:z;
  const center=b.axis==='x'?b.x:b.z;
  const span=b.axis==='x'?b.w:b.d;
  const t=clamp((along-center)/span+0.5,0,1);
  return b.low+b.rise*(b.direction>0?t:1-t);
}
export function surfaceBottom(b,x,z){return b.kind==='ramp'?surfaceTop(b,x,z)-b.thickness:b.y;}

export function circleRectOverlap(x,z,r,b){
  const q=boxExtents(b);
  const cx=clamp(x,q.xmin,q.xmax),cz=clamp(z,q.zmin,q.zmax);
  return sq(cx-x)+sq(cz-z)<sq(r-1e-7);
}

export function validateMapBoxes(boxes){
  const errors=[];
  for(let i=0;i<boxes.length;i++){
    const b=boxes[i];
    for(const v of ['x','y','z','w','h','d']){
      if(typeof b[v]!=='number'||!Number.isFinite(b[v]))errors.push(`${i}: nonfinite ${v}`);
    }
    if(!(b.w>0&&b.h>0&&b.d>0))errors.push(`${i}: non-positive dimension`);
    if(b.kind==='ramp' && (!(b.axis==='x'||b.axis==='z')||!Number.isFinite(b.low)||!Number.isFinite(b.rise)||!(b.rise>=0)||!(b.thickness>0)))errors.push(`${i}: invalid ramp`);
  }
  return errors;
}

export class CollisionWorld{
  constructor(map,options={}){
    if(!map||!Array.isArray(map.boxes))throw new Error('Expected map.boxes array');
    const errs=validateMapBoxes(map.boxes); if(errs.length)throw new Error(errs.slice(0,4).join('; '));
    this.settings={...DEFAULTS,...options}; this.map=map;
    this.boxes=map.boxes.filter(b=>b.collidable!==false&&!NOT_PHYSICAL.has(b.kind));
    const cs=this.settings.cellSize;
    this.cells=new Map();
    for(let i=0;i<this.boxes.length;i++){
      const b=this.boxes[i],q=boxExtents(b);
      for(let gx=Math.floor(q.xmin/cs);gx<=Math.floor(q.xmax/cs);gx++){
        for(let gz=Math.floor(q.zmin/cs);gz<=Math.floor(q.zmax/cs);gz++){
          const key=`${gx},${gz}`;
          if(!this.cells.has(key))this.cells.set(key,[]);
          this.cells.get(key).push(i);
        }
      }
    }
  }
  near(x,z,r=this.settings.radius){
    const cs=this.settings.cellSize,found=new Set();
    const x0=Math.floor((x-r)/cs),x1=Math.floor((x+r)/cs);
    const z0=Math.floor((z-r)/cs),z1=Math.floor((z+r)/cs);
    for(let gx=x0;gx<=x1;gx++)for(let gz=z0;gz<=z1;gz++){
      for(const i of this.cells.get(`${gx},${gz}`)||[])found.add(i);
    }
    return [...found].sort((a,b)=>a-b).map(i=>this.boxes[i]);
  }
  blockers(x,y,z,extra={}){
    const s={...this.settings,...extra},res=[];
    for(const b of this.near(x,z,s.radius)){
      if(!circleRectOverlap(x,z,s.radius,b))continue;
      const low=surfaceBottom(b,x,z),high=surfaceTop(b,x,z);
      if(y<high-s.skin && y+s.height>low+s.skin)res.push(b);
    }
    return res;
  }
  /** Highest physical supporting surface in [feet-maxDrop, feet+maxRise]. */
  supporting(x,feet,z,maxDrop,maxRise=0.008){
    const s=this.settings,near=this.near(x,z,s.groundProbeRadius);
    let best=null;
    for(const b of near){
      if(!WALKABLE.has(b.kind)||!circleRectOverlap(x,z,s.groundProbeRadius,b))continue;
      if(b.kind==='ramp'){
        const slope=Math.atan2(b.rise,b.axis==='x'?b.w:b.d)*180/Math.PI;
        if(slope>s.maxSlopeDeg)continue;
      }
      const top=surfaceTop(b,x,z);
      if(top>feet+maxRise+s.skin||top<feet-maxDrop-s.skin)continue;
      if(!best||top>best.y)best={box:b,y:top};
    }
    return best;
  }
  inspectPose(pos,settings={}){
    const blocks=this.blockers(pos.x,pos.y,pos.z,settings);
    const floor=this.supporting(pos.x,pos.y,pos.z,0.06,0.01);
    return {clear:blocks.length===0,blockers:blocks.map(b=>({kind:b.kind,structure:b.structure||null,route:b.route||null})),
      supported:!!floor, groundY:floor?.y??null};
  }
}

function tryHorizontal(world,pos,axis,stepLength,info,bodyHeight){
  const s=world.settings;
  if(Math.abs(stepLength)<1e-10)return;
  const cx=pos.x+(axis==='x'?stepLength:0),cz=pos.z+(axis==='z'?stepLength:0);
  const b=world.blockers(cx,pos.y,cz,{height:bodyHeight});
  if(!b.length){pos[axis]+=stepLength;return;}
  // A low stair riser is a climbable step, but only if the entire new pose is clear.
  let nextHeight=-Infinity,canStep=true;
  for(const collider of b){
    const rise=surfaceTop(collider,cx,cz)-pos.y;
    if(!WALKABLE.has(collider.kind)||rise<-.003||rise>s.stepHeight+s.skin){canStep=false;break;}
    nextHeight=Math.max(nextHeight,surfaceTop(collider,cx,cz));
  }
  if(canStep && Number.isFinite(nextHeight)){
    if(!world.blockers(cx,nextHeight,cz,{height:bodyHeight}).length){
      pos[axis]+=stepLength;pos.y=nextHeight;info.steps++;return;
    }
  }
  // Exact-ish slide to last valid X or Z using a monotonic bisection of this small substep.
  let lo=0,hi=1;
  for(let i=0;i<12;i++){
    const mid=(lo+hi)*.5;
    const tx=pos.x+(axis==='x'?stepLength*mid:0);
    const tz=pos.z+(axis==='z'?stepLength*mid:0);
    if(world.blockers(tx,pos.y,tz,{height:bodyHeight}).length)hi=mid;else lo=mid;
  }
  pos[axis]+=stepLength*lo;
  info.collisions++;
  info.axes.add(axis);
}

/**
 * Stateful basic character step. state={x,y,z,vx,vy,vz,grounded} and input={jump:boolean}.
 * The caller owns horizontal velocity; this module owns vertical gravity/jump only.
 * Use exactly the same collision map and parameters for server/client parity tests.
 * subSteps move at <=maxSubstep metres per microstep, limiting tunnelling.
 */
export function moveCharacter(world,state,input={},dt=1/60){
  const s=world.settings;
  if(!Number.isFinite(dt)||dt<=0)throw new Error('dt must be finite and positive');
  if(dt>s.fixedMaxDt)throw new Error(`dt ${dt} above max ${s.fixedMaxDt}: pass fixed smaller ticks`);
  const pos={x:state.x,y:state.y,z:state.z};
  let vx=state.vx??0,vy=state.vy??0,vz=state.vz??0;
  if(![pos.x,pos.y,pos.z,vx,vy,vz].every(Number.isFinite))throw new Error('Nonfinite character state');
  let grounded=!!state.grounded;
  const bodyHeight=state.bodyHeight??s.height;
  if(!Number.isFinite(bodyHeight)||bodyHeight<0.65||bodyHeight>s.height)throw new Error("Invalid bodyHeight");
  if(input.jump&&grounded){vy=s.jumpSpeed;grounded=false;}
  const expected=Math.max(Math.hypot(vx,vz)*dt,Math.abs(vy*dt+0.5*s.gravity*dt*dt));
  let count=Math.max(1,Math.ceil(expected/s.maxSubstep),Math.ceil(dt/(1/60)));
  if(count>s.maxSubsteps)throw new Error('Too much motion for safe collision stepping; reduce dt/velocity');
  const h=dt/count,info={steps:0,collisions:0,ceilings:0,landings:0,axes:new Set(),substeps:count};
  for(let i=0;i<count;i++){
    // Step separately along both axes to provide wall sliding.
    tryHorizontal(world,pos,'x',vx*h,info,bodyHeight);
    tryHorizontal(world,pos,'z',vz*h,info,bodyHeight);
    if(grounded){
      const support=world.supporting(pos.x,pos.y,pos.z,s.snapDown,s.stepHeight);
      // Do not walk through an overhead floor; support was already constrained.
      if(support && support.y<=pos.y+s.stepHeight+s.skin && !world.blockers(pos.x,support.y,pos.z,{height:bodyHeight}).length){
        pos.y=support.y;vy=0;
      }else{grounded=false;}
    }
    if(!grounded){
      const prev=pos.y,prevHead=prev+bodyHeight;
      const nextVy=vy-s.gravity*h;
      const proposed=prev+vy*h-0.5*s.gravity*h*h;
      const radius=s.radius;
      const near=world.near(pos.x,pos.z,radius).filter(b=>circleRectOverlap(pos.x,pos.z,radius,b));
      if(proposed<prev){
        let bestFloor=null;
        for(const b of near){
          if(!WALKABLE.has(b.kind))continue;
          const top=surfaceTop(b,pos.x,pos.z);
          if(top<=prev+s.skin&&top>=proposed-s.skin){
            if(!bestFloor||top>bestFloor.y)bestFloor={y:top,b};
          }
        }
        if(bestFloor){
          pos.y=bestFloor.y;vy=0;grounded=true;info.landings++;
        }else{pos.y=proposed;vy=nextVy;}
      }else{
        let nearest=null;
        for(const b of near){
          const bottom=surfaceBottom(b,pos.x,pos.z);
          if(bottom>=prevHead-s.skin && bottom<=proposed+bodyHeight+s.skin){
            if(nearest===null||bottom<nearest)nearest=bottom;
          }
        }
        if(nearest!==null){pos.y=nearest-bodyHeight-s.skin;vy=0;info.ceilings++;}
        else{pos.y=proposed;vy=nextVy;}
      }
    }
  }
  // Defensive check: static map must not put the avatar into a solid collider.
  const remaining=world.blockers(pos.x,pos.y,pos.z,{height:bodyHeight});
  return {state:{x:pos.x,y:pos.y,z:pos.z,vx,vy,vz,grounded,bodyHeight},
    diagnostics:{...info,axes:[...info.axes],penetrating:remaining.length>0,
      penetratingKinds:[...new Set(remaining.map(b=>b.kind))]}};
}

export function mapCollisionFingerprint(map){
  // Stable *non-cryptographic* FNV-1a useful for detecting local accidental changes;
  // NOT an anti-cheat guarantee or cryptographic integrity check.
  let hash=2166136261>>>0;
  for(const b of map.boxes||[]){
    const line=['x','y','z','w','h','d'].map(k=>String(b[k])).join(',')+'|'+String(b.kind||'')+';';
    for(let i=0;i<line.length;i++){hash^=line.charCodeAt(i);hash=Math.imul(hash,16777619)>>>0;}
  }
  return hash.toString(16).padStart(8,'0');
}