import * as T from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const palette={sand:0xe1c49a,rose:0xc88771,teal:0x347d80,tile:0x7eafaa,crate:0xa98251,trunk:0x8b6c48};
export function buildWorld(scene,map){
  scene.background=new T.Color(0xaedbdc);scene.fog=new T.Fog(0xc8dcd5,90,210);
  const sky=new Sky();sky.scale.setScalar(450);sky.material.uniforms.turbidity.value=2;sky.material.uniforms.rayleigh.value=.85;sky.material.uniforms.sunPosition.value.set(-.6,.65,.4);scene.add(sky);
  scene.add(new T.HemisphereLight(0xe1f5ff,0xb09773,2.1));
  const sun=new T.DirectionalLight(0xffefd3,3.3);sun.position.set(-45,70,32);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-72,right:72,top:72,bottom:-72,near:1,far:180});sun.shadow.bias=-.0003;sun.shadow.normalBias=.04;scene.add(sun);
  const root=new T.Group();scene.add(root);const materials=new Map();
  function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.92}));return materials.get(c);}
  function mesh(geometry,color,x,y,z){const m=new T.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  function box(w,h,d,c,x,y,z){return mesh(new T.BoxGeometry(w,h,d),c,x,y,z);}
  function cyl(top,bottom,h,c,x,y,z,segments=12){return mesh(new T.CylinderGeometry(top,bottom,h,segments),c,x,y,z);}
  const half=map.size/2;
  box(map.size+90,.4,map.size+90,0xcdbd96,0,-.21,0);
  box(map.size-1,.03,map.size-1,0xd2c4a8,0,-.005,0);
  // Broad roads link the five districts. Simple surfaces keep the GPU cost low.
  box(12,.025,map.size-2,0xe5d9bc,0,.02,0);
  box(map.size-2,.027,9,0xe5d9bc,0,.022,0);
  for(const x of [-26,26])box(7,.025,92,0xddd1b3,x,.02,0);
  for(const z of [-25,25])box(92,.025,6,0xddd1b3,0,.02,z);
  for(let i=-48;i<=48;i+=4){box(map.size-2,.009,.025,0xbeb69e,0,.012,i);box(.025,.009,map.size-2,0xbeb69e,i,.012,0);}
  // Garden mosaic, freight markings and a terracotta bazaar square.
  box(19,.025,14,0xb6c4a2,0,.025,43);
  box(20,.025,18,0xc8aa8b,-38,.025,0);
  for(let z=-8;z<13;z+=4)box(17,.01,.18,0xe8cd87,38,.04,z);
  for(const b of map.boxes){if(b.kind==='palm')continue;const c=palette[b.style];box(b.w,b.h,b.d,c,b.x,b.y+b.h/2,b.z);
    if(b.kind==='building'){
      box(b.w+.25,.19,b.d+.25,0xf2dfb7,b.x,3.88,b.z);box(b.w+.1,.24,b.d+.1,0xc29f78,b.x,.17,b.z);
      const z=b.z+b.d/2+.018;
      for(const x of [b.x-2,b.x+2]){box(1.2,1.6,.08,0x366967,x,2.3,z);for(const dx of [-.62,.62])box(.1,1.75,.11,0xf2d7ab,x+dx,2.3,z+.02);box(1.4,.12,.3,0xf2d7ab,x,1.45,z+.04);for(let j=0;j<5;j++)box(1.05,.045,.04,0x568c81,x,1.8+j*.23,z+.06);}
      const side=b.x<0?b.x+b.w/2+.025:b.x-b.w/2-.025;
      for(const zz of [b.z-2,b.z+2]){box(.1,1.8,1.15,0x306a71,side,1.5,zz);box(.22,.14,1.4,0xf0d7ad,side,2.45,zz);}
      box(2.7,.06,1,0xc66c4d,b.x,3.05,z+.48).rotation.x=.16;

    }
    if(b.kind==='boundary'){
      box(b.w+.2,.22,b.d+.2,0xf1d6a8,b.x,b.h,b.z);
      for(let t=-48;t<=48;t+=8)box(b.w>10?.5:1.15,b.h+.25,b.w>10?1.15:.5,0xd2ad7e,b.w>10?t:b.x,(b.h+.25)/2,b.w>10?b.z:t);
    }
    if(b.kind==='container'){
      for(let x=-b.w/2+.4;x<b.w/2;x+=.7)for(const side of [-1,1])box(.055,b.h-.2,.045,0x28666c,b.x+x,b.h/2,b.z+side*(b.d/2+.02));
      box(b.w+.06,.12,b.d+.06,0xc2cbb4,b.x,b.h-.06,b.z);
    }
    if(b.kind==='planter')box(b.w-.25,.04,b.d-.25,0x729a59,b.x,b.h+.01,b.z);
    if(b.kind==='tower'){
      const dome=mesh(new T.SphereGeometry(1.7,12,8,0,Math.PI*2,0,Math.PI/2),0x347d80,b.x,b.y+b.h,b.z);
      box(3.3,.2,3.3,0xf2dfb7,b.x,b.y+b.h,b.z);
      for(const side of [-1,1])box(1,2,.04,0x366967,b.x,b.y+2.9,b.z+side*1.52);
    }
    if(b.kind==='cover'){for(const x of [-b.w/2+.1,b.w/2-.1])box(.12,b.h+.05,b.d+.08,0x685b40,b.x+x,b.h/2,b.z);box(b.w+.06,.12,b.d+.06,0x685b40,b.x,.15,b.z);}
  }
  // Fountain, decorative column, and a shallow turquoise basin.
  const water=new T.Mesh(new T.PlaneGeometry(4.7,4.7),new T.MeshStandardMaterial({color:0x53b1b4,roughness:.3,metalness:.2,transparent:true,opacity:.85}));water.rotation.x=-Math.PI/2;water.position.set(0,.67,1);scene.add(water);
  for(const x of [-2.5,2.5])box(.25,.22,5.2,0xefdcbb,x,.76,1);for(const z of [-1.5,3.5])box(5.2,.22,.25,0xefdcbb,0,.76,z);
  cyl(.9,.62,.2,0xf0d6a6,0,2.08,1);const jewel=mesh(new T.OctahedronGeometry(.55),0x3c9392,0,2.7,1);jewel.rotation.y=.3;
  // Non-solid awnings are safely above the maximum standing jump height.
  for(const stall of map.boxes.filter(b=>b.kind==='market')){
    for(const x of [stall.x-stall.w/2,stall.x+stall.w/2])cyl(.045,.045,3.8,0x68513c,x,1.9,stall.z);
    for(let i=0;i<10;i++)box(stall.w/10,.055,2.7,i%2?0xf0d7a7:0xd16d4f,stall.x-stall.w/2+(i+.5)*stall.w/10,3.8,stall.z).rotation.x=.12;
    for(let i=0;i<6;i++)cyl(.13,.16,.25,i%2?0xda9b41:0x739348,stall.x-stall.w/2+.5+i*(stall.w-1)/5,1.28,stall.z);
  }
  function palm(x,z,scale=1){const trunk=cyl(.16*scale,.3*scale,6*scale,0x8b6c48,x,3*scale,z,7);trunk.rotation.z=0;for(let j=0;j<7;j++){const a=j*Math.PI*2/7;const verts=[];for(let k=0;k<5;k++){const r=k*.65*scale,r2=(k+1)*.65*scale,w=(1-k/5)*.45*scale,y=6*scale+Math.sin(k/5*Math.PI)*.65*scale-k*.16*scale,y2=6*scale+Math.sin((k+1)/5*Math.PI)*.65*scale-(k+1)*.16*scale;const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,qx=x+Math.cos(a)*r2,qz=z+Math.sin(a)*r2;verts.push(px-Math.sin(a)*w,y,pz+Math.cos(a)*w,px+Math.sin(a)*w,y,pz-Math.cos(a)*w,qx,y2,qz);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const leaf=mesh(geo,j%2?0x4f8155:0x729a59,0,0,0);leaf.material.side=T.DoubleSide;}}
  for(const [x,z,scale] of map.palms)palm(x,z,scale);
  // Gate silhouettes are outside the playable loop, never closing a route.
  for(const z of [-half+.6,half-.6]){box(3.7,4.1,.12,0x3b797b,0,2.05,z);const arch=new T.Mesh(new T.TorusGeometry(1.8,.22,6,18,Math.PI),mat(0xf0d7ad));arch.position.set(0,3.7,z+(z<0?.12:-.12));root.add(arch);for(const x of [-1.8,1.8])box(.4,3.7,.3,0xf0d7ad,x,1.85,z);}
  for(let i=0;i<18;i++){const x=-68+i*8,h=8+i%4*2,z=-half-13-(i%3)*3;box(7,h,7,i%2?0xbba889:0xcdb69b,x,h/2,z);if(i%4===0){cyl(1.9,1.9,6,0xcfb390,x,h+2,z);mesh(new T.SphereGeometry(2,12,6,0,Math.PI*2,0,Math.PI/2),0x538585,x,h+5,z);}}
  for(let i=0;i<9;i++){const hill=mesh(new T.ConeGeometry(22,28+i%3*7,5),0xb3beb0,-100+i*25,5,-half-65);hill.rotation.y=i;}
  // Batch static geometry by material: lightweight scene, including on integrated GPUs.
  root.updateMatrixWorld(true);const batches=new Map();for(const m of [...root.children]){if(!m.isMesh)continue;const g=m.geometry.clone().applyMatrix4(m.matrixWorld);g.deleteAttribute('uv');g.deleteAttribute('tangent');const list=batches.get(m.material)||[];list.push(g);batches.set(m.material,list);m.geometry.dispose();root.remove(m);}
  for(const [material,geometries] of batches){const geo=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g));const m=new T.Mesh(geo,material);m.castShadow=m.receiveShadow=true;root.add(m);for(const g of geometries)g.dispose();}
  function sign(text,x,y,z,rot=0){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#267779';ctx.fillRect(0,0,512,160);ctx.strokeStyle='#dec49b';ctx.lineWidth=7;ctx.strokeRect(12,12,488,136);ctx.fillStyle='#fff0ce';ctx.font='bold '+(text.length>12?44:56)+'px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,105);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(3.6,1.12),new T.MeshStandardMaterial({map:tex,roughness:1}));m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);}
  sign('SOLSTICE',0,5.5,-51.35);sign('OLD QUARTER',-8.97,3,-9,Math.PI/2);sign('OBSERVATORY',-13,2.7,-28.94);sign('GARDENS',13,2.7,39.06);sign('BAZAAR',-31.94,2.7,-16,Math.PI/2);sign('FREIGHT YARD',31.94,2.7,16,-Math.PI/2);
  const targetMeshes=new Map();for(const [i,p] of map.practiceTargets.entries()){const g=new T.Group();const body=new T.Mesh(new T.CylinderGeometry(.36,.4,1.05,8),mat(0xe19450));body.position.y=.95;g.add(body);const head=new T.Mesh(new T.IcosahedronGeometry(.25,1),mat(0x366f72));head.position.y=1.62;g.add(head);const base=new T.Mesh(new T.CylinderGeometry(.15,.4,.4,8),mat(0x456665));base.position.y=.2;g.add(base);g.position.set(...p);scene.add(g);targetMeshes.set('t'+i,g);}
  return {sun,targets:targetMeshes,animate(t){water.material.color.setHSL(.49,.4,.49+Math.sin(t*1.4)*.018);}};
}
