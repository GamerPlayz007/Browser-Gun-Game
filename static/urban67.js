import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** DAYBREAK 6.7: outer-district dressing in a few GPU-instanced batches.
 * Furniture collision proxies come from Python; this is presentation only.
 * Everything in this group is rendered, never registered as a new collider.
 */
export const URBAN_QUALITY67=Object.freeze({performance:0,auto:1,high:1,ultra:2,native:2});
const palette={concrete:'concrete',road:'road',stone:'pale',metal:'metal',
 glass:'glass',wood:'wood',green:'garden',dark:'dark',accent:'tile'};
const rotation67={east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0};
export function createUrbanDetails67(T,map,library){
 const root=new T.Group();root.name='daybreak67-lively-outer-city';
 root.userData.collidable=false;
 const parts=[],facades=map.daybreak67?.facades||[],items=map.daybreak67?.furnishings||[];
 const add=(x,y,z,w,h,d,style,tier=0,shape='box',rz=0)=>{
  if(![x,y,z,w,h,d].every(Number.isFinite)||Math.min(w,h,d)<=0)throw Error('Invalid 6.7 visual part');
  parts.push({x,y,z,w,h,d,style,tier,shape,rz});
 };
 for(const f of items){
  const {x,z,w,d,type}=f,y=f.y;
  if(type==='planter'){
   add(x,y+.3,z,w,.58,d,'concrete');
   add(x,y+.64,z,w*.84,.11,d*.84,'stone',1);
   add(x,y+.92,z,1.0,.92,1.0,'green',0,'sphere');
   add(x+.28,y+1.34,z-.2,.67,.76,.66,'green',2,'sphere');
  }else if(type==='bench'){
   add(x,y+.46,z,w,.12,d,'wood');
   add(x,y+.65,z+d*.35,w,.36,.13,'wood');
   for(const side of [-1,1])add(x+side*w*.37,y+.24,z,.13,.41,.47,'metal',1);
   add(x,y+.50,z-.1,w*.8,.05,.38,'stone',2);
  }else if(type==='kiosk'){
   add(x,y+.98,z,w,1.94,d,'stone');
   add(x,y+2.22,z,w+0.4,.17,d+.35,'wood');
   add(x,y+1.17,z+d*.506,w*.75,1.17,.05,'glass',0);
   add(x,y+2.03,z+d*.51,w*.84,.22,.08,'accent',1);
   add(x+.35,y+.38,z+d*.54,.48,.65,.07,'dark',2);
  }else if(type==='car'){
   add(x,y+.48,z,w,.72,d,'metal');
   add(x-.08,y+1.00,z,w*.49,.52,d*.76,'glass');
   add(x+w*.36,y+.71,z,w*.24,.18,d*.78,'stone',1);
   for(const sx of [-1,1])for(const sz of [-1,1])
    add(x+sx*w*.34,y+.3,z+sz*d*.48,.5,.5,.15,'dark',0,'cylinder',Math.PI/2);
   add(x+w*.48,y+.53,z,w*.04,.22,d*.7,'accent',2);
  }else if(type==='barrier'){
   add(x,y+.45,z,w,.9,d,'concrete');
   add(x,y+.78,z,w*.9,.13,d+.02,'accent');
   add(x,y+.25,z,w*.87,.09,d+.03,'dark',1);
  }
 }
 // Existing building envelopes receive roof furniture and readable storefronts.
 for(let i=0;i<facades.length;i++){
  const p=facades[i];
  const side=p.face,axis=side==='east'||side==='west';
  const sx=axis?.48:2.6,sz=axis?2.6:.48;
  add(p.x,p.y+.74,p.z,sx,.11,sz,'wood',1);
  add(p.x,p.y+.2,p.z,axis?.11:2.5,.26,axis?2.5:.11,'stone',2);
 }
 for(let i=0;i<(map.stage6?.physical_parcels||[]).length;i++){
  const p=map.stage6.physical_parcels[i];
  if(p.status!=='constructed shell'||i%2)continue;
  const [x0,z0,x1,z1]=p.footprint,rx=(x0+x1)/2,rz=(z0+z1)/2,y=p.roof_y;
  add(rx,y+.27,rz,1.35,.54,1.1,'metal',2);
  add(rx-.36,y+.61,rz,.18,.23,.18,'dark',2);
 }
 const batches=new Map();
 for(const b of parts){const key=[b.style,b.tier,b.shape].join(':');
  if(!batches.has(key))batches.set(key,[]);
  batches.get(key).push(b);
 }
 const unit=new T.BoxGeometry(1,1,1),foliage=new T.SphereGeometry(.5,8,6),
       tire=new T.CylinderGeometry(.5,.5,1,10);
 const geometryByShape={box:unit,sphere:foliage,cylinder:tire};
 const dummy=new T.Object3D(),renderBatches=[];
 for(const [key,boxes] of batches){
  const [style,tierText,shape]=key.split(':');
  const mesh=new T.InstancedMesh(geometryByShape[shape],library.get(palette[style]),boxes.length);
  mesh.name='daybreak67-'+key;mesh.userData={collidable:false,daybreak67Tier:Number(tierText)};
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;
  for(let i=0;i<boxes.length;i++){
   const b=boxes[i];dummy.position.set(b.x,b.y,b.z);
   dummy.rotation.set(0,0,b.rz||0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();
   mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;root.add(mesh);renderBatches.push(mesh);
 }
 // Two tiny shared printed atlases, rather than one canvas/texture per shop.
 const signParts=[],signTextures=[],signMaterials=[];
 for(let offset=0;offset<facades.length;offset+=16){
  const signs=facades.slice(offset,offset+16),canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d');
  const gs=[];
  signs.forEach((f,i)=>{
   const col=i%4,row=Math.floor(i/4),x=col*128,y=row*128;
   ctx.fillStyle='#ece9e0';ctx.fillRect(x,y,128,128);
   ctx.fillStyle='#426c76';ctx.fillRect(x+3,y+6,122,7);
   ctx.fillStyle='#233e48';ctx.font='bold 14px sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.text,x+64,y+62,118);
   ctx.fillStyle='#8e9e99';ctx.fillRect(x+13,y+106,102,4);
   const geo=new T.PlaneGeometry(2.5,.65),uv=geo.attributes.uv;
   for(let j=0;j<uv.count;j++){
    uv.setXY(j,(col+uv.getX(j))/4,(3-row+uv.getY(j))/4);
   }
   geo.rotateY(rotation67[f.face]||0);geo.translate(f.x,f.y,f.z);
   gs.push(geo);
  });
  const merged=mergeGeometries(gs,false);gs.forEach(g=>g.dispose());
  if(!merged)throw Error('Daybreak street sign batching failed');
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  tex.anisotropy=2;tex.needsUpdate=true;
  const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:true});
  const mesh=new T.Mesh(merged,mat);mesh.name='daybreak67-printed-facade-signs';
  mesh.userData={collidable:false,daybreak67Tier:offset===0?0:1};
  mesh.frustumCulled=false;root.add(mesh);signParts.push(mesh);signTextures.push(tex);signMaterials.push(mat);
 }
 let mode='high',detail=true;
 function refresh(){
  const limit=detail?URBAN_QUALITY67[mode]:0;
  for(const child of root.children)child.visible=(child.userData.daybreak67Tier||0)<=limit;
 }
 function setQuality(value){mode=value in URBAN_QUALITY67?value:'high';refresh();}
 function setDetail(value){detail=!!value;refresh();}
 setQuality('high');
 return {root,items,facades,stats:{streetFurniture:items.length,shops:facades.length,
    parts:parts.length,batches:renderBatches.length,signBatches:signParts.length},
  setQuality,setDetail,dispose(){
   unit.dispose();foliage.dispose();tire.dispose();
   for(const sign of signParts)sign.geometry.dispose();
   for(const t of signTextures)t.dispose();
   for(const m of signMaterials)m.dispose();
   root.removeFromParent();
  }};
}
