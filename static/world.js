import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function buildWorld(scene,map){
 const colors=map.palette,materials=new Map(),root=new T.Group();scene.add(root);
 function mat(key){if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:colors[key]||key,roughness:.88}));return materials.get(key);}
 function mesh(g,key,x=0,y=0,z=0){const m=new T.Mesh(g,mat(key));m.position.set(x,y,z);root.add(m);return m;}
 function box(w,h,d,key,x,y,z){return mesh(new T.BoxGeometry(w,h,d),key,x,y,z);}
 scene.background=new T.Color('#9cdae9');scene.fog=new T.Fog('#bedde0',85,180);
 const sky=new Sky();sky.scale.setScalar(400);sky.material.uniforms.turbidity.value=2;sky.material.uniforms.rayleigh.value=.7;sky.material.uniforms.sunPosition.value.set(-.6,.7,.4);scene.add(sky);
 scene.add(new T.HemisphereLight('#e9f6ff','#80988e',2));
 const sun=new T.DirectionalLight('#fff1d8',3);sun.position.set(-40,65,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-58,right:58,top:58,bottom:-58,near:1,far:160});sun.shadow.bias=-.0003;sun.shadow.normalBias=.04;scene.add(sun);
 box(170,.4,170,'stone',0,-.21,0);
 for(const zone of map.zones)box(zone.w,.02,78,zone.x<0?'amber':zone.x>0?'slate':'ivory',zone.x,-.005,0);
 // Bright paths sit flush on the floor; no cosmetic steps or random grid lines.
 box(9,.016,74,'ivory',-22,.01,0);box(19,.016,34,'ivory',0,.01,0);
 for(const z of [-7,16,33])box(70,.017,5,'stone',0,.012,z);
 for(const b of map.boxes){
  if(['rampStep','ringSegment'].includes(b.kind))continue;
  box(b.w,b.h,b.d,b.style,b.x,b.y+b.h/2,b.z);
  if(['facade','boundary'].includes(b.kind)){
   box(b.w+.03,.15,b.d+.03,b.style==='slate'?'jade':'ivory',b.x,b.y+b.h-.08,b.z);
   // Plinths are flush to the wall so they cannot snag movement.
   box(b.w+.02,.25,b.d+.02,'stone',b.x,b.y+.13,b.z);
  }
  if(b.kind==='pier')box(b.w+.05,.22,b.d+.05,'gold',b.x,b.y+b.h-.12,b.z);
  if(b.kind==='planter'){
   box(b.w-.2,.06,b.d-.2,'emerald',b.x,b.y+b.h+.02,b.z);
   // Low plant mounds remain within the planter silhouette.
   for(let i=-1;i<=1;i++)mesh(new T.IcosahedronGeometry(.45,0),'jade',b.x,b.y+b.h+.25,b.z+i*.8);
  }
  if(b.kind==='terrace'&&b.style==='slate')box(b.w-.1,.035,b.d-.1,'emerald',b.x,b.y+b.h+.016,b.z);
 }
 // A continuous wedge covers the fine collision risers. Maximum mismatch 12.5 cm.
 for(const r of map.ramps){
  const w=r.width/2,z0=r.z,z1=r.z-r.length,y0=r.base,y1=r.base+r.rise,x=r.x;
  const v=[x-w,y0,z0,x+w,y0,z0,x+w,y1,z1,x-w,y0,z0,x+w,y1,z1,x-w,y1,z1,
   x-w,y0,z0,x-w,y1,z1,x-w,y0,z1,x+w,y0,z0,x+w,y0,z1,x+w,y1,z1,
   x-w,y0,z1,x-w,y1,z1,x+w,y1,z1,x-w,y0,z1,x+w,y1,z1,x+w,y0,z1];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();mesh(g,r.style);
 }
 // Arch bands sit above the collision-accurate 5.2 m clear opening.
 for(const a of map.arches){
  const arc=mesh(new T.TorusGeometry(a.width/2,.16,4,16,Math.PI),'gold',a.x,a.base+5.3-a.width/2,a.z);
  // Flatten the arc to fit its lintel; bottom stays above clear opening height.
  arc.scale.y=.28;arc.position.y=a.base+5.35;
  if(a.axis==='z')arc.rotation.y=Math.PI/2;
 }
 const ring=mesh(new T.TorusGeometry(2.3,.16,6,24,5.25),'gold',0,4.8,1);ring.rotation.z=.5;
 // Azure water and the waterfall share one opaque material; no reflection passes.
 box(6.7,.025,5.7,'water',0,.515,1);
 box(.04,3,3.8,'water',28.97,7.1,-24);
 box(3,.025,6,'water',27,5.52,-24);
 // Bell and pavilion roof silhouette, both integrated into structural architecture.
 mesh(new T.CylinderGeometry(.8,1.15,1.4,10),'gold',-24,10.5,-34);
 const crown=mesh(new T.ConeGeometry(8.4,2.1,4),'emerald',24,12.1,-25);crown.rotation.y=Math.PI/4;
 // Ribbing and coloured cornices read at a distance without texture downloads.
 for(const z of [-29,-24,-19,-14,-8,-3,2,8,12])box(17,.025,.07,'gold',-26,5.52,z);
 // Beyond the playable boundary: sparse skyline, no collision or interactive props.
 for(let i=0;i<13;i++)box(7,10+i%3*3,8,i%2?'ivory':'amber',-50+i*8,3,-51-i%2*6);
 for(let i=0;i<6;i++)mesh(new T.ConeGeometry(20,26,5),'stone',-75+i*30,0,-90);
 // All static scenery, landmarks and colours are merged into shared-material batches.
 root.updateMatrixWorld(true);const batches=new Map();
 for(const m of [...root.children]){
  let g=m.geometry.clone().applyMatrix4(m.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('tangent');
  if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}
  if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(g);m.geometry.dispose();root.remove(m);
 }
 for(const [material,geos] of batches){const g=mergeGeometries(geos);if(!g)throw Error('Map geometry batching failed');g.computeBoundingSphere();const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;root.add(m);for(const geo of geos)geo.dispose();}
 const targets=new Map();for(const [i,p] of map.practiceTargets.entries()){
  const g=new T.Group();for(const [geo,key,y] of [[new T.CylinderGeometry(.36,.4,1.05,8),'amber',.95],[new T.IcosahedronGeometry(.25,1),'blue',1.62],[new T.CylinderGeometry(.15,.4,.4,8),'slate',.2]]){const m=new T.Mesh(geo,mat(key));m.position.y=y;g.add(m);}g.position.set(...p);scene.add(g);targets.set('t'+i,g);
 }
 return {sun,targets,staticBatches:batches.size,animate(){}};
}
