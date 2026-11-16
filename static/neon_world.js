/**
 * Neon Zenith — CROSSFIRE-NATIVE environment adapter.
 *
 * Uses precise building tiers, sign/prop footprints and original coordinate
 * layout exported from billpwchan/neon-zenith (MIT code with separate credits).
 * No remote game runtime, WebGPU, vehicle engine, KTX2 city load or second canvas.
 *
 * The expensive original TSL shaders are deliberately replaced by light
 * WebGL materials. It will NOT look pixel-identical to the original scene;
 * the shapes and placements remain sourced from the actual original city.
 */
import * as T from 'three';

const hash=(x,z,k=0)=>{
  let n=Math.imul(Math.round(x*13+z*7),374761393)^Math.imul(Math.round(z*11-x*3)+k,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
};
const COLOR=['#55718a','#4c6478','#566675','#666782','#52677a'];
function makeFacadeTexture(density=1){
  const w=256,h=384,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#17202f';ctx.fillRect(0,0,w,h);
  const cols=8,rows=16,stepX=w/cols,stepY=h/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const seed=hash(c*19+r*3,r*21+c*7),x=c*stepX,y=r*stepY;
    ctx.fillStyle=r%4===0?'#303d4f':'#243347';
    ctx.fillRect(x,y+stepY-2,stepX,2);
    ctx.fillStyle='#374457';ctx.fillRect(x+stepX-2,y,2,stepY);
    ctx.fillStyle=seed<.18?'#d9b88a':seed<.38?'#77aab7':seed<.47?'#b5a9c0':'#111a28';
    ctx.fillRect(x+5,y+4,stepX-10,stepY-8);
    if(seed>.47){ctx.fillStyle='#172238';ctx.fillRect(x+5,y+4,stepX-10,stepY-8);}
    if(seed<.40){ctx.fillStyle='#f0d9a0';ctx.globalAlpha=.17;ctx.fillRect(x+6,y+4,3,stepY-9);ctx.globalAlpha=1;}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=1;texture.magFilter=T.LinearFilter;
  return texture;
}
function createNeonWorld(scene,map,{quality='performance'}={}){
  const root=new T.Group();root.name='neon-zenith-original-layout';scene.add(root);
  const center=map.center||{x:0,z:0};
  const oldFog=scene.fog,oldBackground=scene.background;
  scene.background=new T.Color('#091425');
  scene.fog=new T.FogExp2('#091425',.0025);
  const resources=[];
  const own=o=>{resources.push(o);return o;};
  const hemi=own(new T.HemisphereLight('#8fa4e6','#121526',1.35));
  const moon=own(new T.DirectionalLight('#b1c4ff',1.65));
  moon.position.set(-80,180,65);scene.add(hemi,moon);
  const geometry=own(new T.BoxGeometry(1,1,1));
  const facadeTex=own(makeFacadeTexture());
  const buildingMaterial=Array.from({length:3},(_,i)=>own(new T.MeshLambertMaterial({
    map:facadeTex,color:[0xaabaca,0x899fb5,0x9cadb9][i],emissive:'#102036',
    emissiveIntensity:.55
  })));
  const poleMat=own(new T.MeshLambertMaterial({color:'#2c435c'}));
  const trimMat=own(new T.MeshLambertMaterial({color:'#25384d'}));
  const roofMat=own(new T.MeshLambertMaterial({color:'#34465d'}));
  const neonMats=['#65eaff','#ff66c4','#ffce8c'].map(c=>own(new T.MeshBasicMaterial({color:c,toneMapped:false})));
  const groundMat=own(new T.MeshLambertMaterial({color:'#202637'}));
  const streetMat=own(new T.MeshLambertMaterial({color:'#151e2c'}));
  const stripeMat=own(new T.MeshBasicMaterial({color:'#8b8c9e'}));
  const sidewalkMat=own(new T.MeshLambertMaterial({color:'#33384b'}));

  // Exact original coordinates and dimensions from the upstream city generator.
  // The visuals are batched into a few InstancedMesh calls, not 1,997 draw calls.
  const batches=new Map();
  function batch(key,b,mat){
    if(!batches.has(key))batches.set(key,{items:[],material:mat});
    batches.get(key).items.push(b);
  }
  const buildings=map.boxes.filter(b=>b.kind==='building');
  for(const b of map.boxes){
    if(b.kind==='floor'||b.kind==='boundary')continue;
    if(b.kind==='building'){
      batch('b'+Math.floor(hash(b.x,b.z)*3),b,buildingMaterial[Math.floor(hash(b.x,b.z)*3)]);
    }else if(b.kind==='deck'){batch('roof',b,roofMat);}
    else if(b.kind==='pillar'){
      // Original exporter also retains signs, awnings and poles.
      if(b.h<3&&b.w>2)batch('awning',b,trimMat);
      else if(b.h>4&&Math.min(b.w,b.d)<.7)batch('poles',b,poleMat);
      else if(b.y>3&&b.h<12&&hash(b.x,b.z)>.7)batch('neon'+Math.floor(hash(b.x,b.z,5)*3),b,neonMats[Math.floor(hash(b.x,b.z,5)*3)]);
      else batch('street-detail',b,trimMat);
    }
  }
  const dummy=new T.Object3D();
  const instances=[];
  function addInstances(key,items,material){
    if(!items.length)return;
    const mesh=new T.InstancedMesh(geometry,material,items.length);
    mesh.name='neon-original-'+key;
    mesh.instanceMatrix.setUsage(T.StaticDrawUsage);
    for(let i=0;i<items.length;i++){
      const b=items[i];dummy.position.set(b.x,b.y+b.h/2,b.z);
      dummy.rotation.set(0,0,0);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;mesh.receiveShadow=false;mesh.castShadow=false;
    root.add(mesh);instances.push(mesh);
  }
  for(const [key,group] of batches)addInstances(key,group.items,group.material);

  function plane(x,y,z,w,d,material){
    const mesh=new T.Mesh(own(new T.PlaneGeometry(w,d)),material);
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);root.add(mesh);return mesh;
  }
  plane(center.x,-.055,center.z,map.size,map.size,groundMat);

  // Road crossings follow the actual original street grid. The original
  // collision data already leaves the broad X/Z avenues unobstructed.
  const roads=[
    {x:center.x,z:center.z,w:22,d:map.size},
    {x:center.x,z:center.z,w:map.size,d:22}
  ];
  for(const r of roads)plane(r.x,-.039,r.z,r.w,r.d,streetMat);
  // Physically raised pavement is intentionally VISUAL-ONLY: moving and
  // spawning use the unchanged upstream-exported server collision geometry.
  const pavement=[
    [center.x-14,center.z,1.5,map.size],
    [center.x+14,center.z,1.5,map.size],
    [center.x,center.z-14,map.size,1.5],
    [center.x,center.z+14,map.size,1.5]
  ];
  for(const [x,z,w,d] of pavement)plane(x,-.03,z,w,d,sidewalkMat);
  // Shared geometry to draw lane markers in two cheap batches.
  const lane=[];
  for(let j=-Math.floor(map.size/16);j<=Math.floor(map.size/16);j++){
    lane.push({x:center.x,y:0.004,z:center.z+j*8,w:.16,h:.014,d:3.1});
    lane.push({x:center.x+j*8,y:0.004,z:center.z,w:3.1,h:.014,d:.16});
  }
  addInstances('lane-stripes',lane,stripeMat);

  // Lightweight city identity: derived from actual original building facades.
  // Colored building-edge signs are meshes, never extra collision boxes.
  const signs=[];
  for(const b of buildings){
    if(b.h<9||hash(b.x,b.z,11)>.21)continue;
    const dX=b.x-center.x,dZ=b.z-center.z;
    if(Math.abs(dX)>90||Math.abs(dZ)>90)continue;
    const alongX=Math.abs(dX)>Math.abs(dZ);
    const w=Math.min(4.8,Math.max(2.2,(alongX?b.d:b.w)*.55));
    const sign=own(new T.PlaneGeometry(w,Math.min(2.8,Math.max(1.1,b.h*.1))));
    const mat=neonMats[Math.floor(hash(b.x,b.z,13)*3)];
    const mesh=new T.Mesh(sign,mat);
    mesh.position.set(b.x,b.y+Math.min(b.h-2,3.5),b.z);
    if(alongX){mesh.position.x+=dX<0?b.w/2+.03:-b.w/2-.03;mesh.rotation.y=dX<0?Math.PI/2:-Math.PI/2;}
    else{mesh.position.z+=dZ<0?b.d/2+.03:-b.d/2-.03;mesh.rotation.y=dZ<0?0:Math.PI;}
    root.add(mesh);signs.push(mesh);
  }

  // The same C/F player, controls, minimap, spawn rules and effects as Daybreak.
  const targets=new Map();
  for(let i=0;i<(map.practiceTargets||[]).length;i++){
    const t=map.practiceTargets[i];
    const cylinder=new T.Mesh(own(new T.CylinderGeometry(.32,.4,1.65,8)),roofMat);
    cylinder.position.set(t[0],t[1]+.825,t[2]);root.add(cylinder);
    targets.set('t'+i,cylinder);
  }
  let detail=true,mode=quality;
  const resourceProfile68={atlasSize68:256,atlasRebuilds:1,
    staticInstances:instances.reduce((n,m)=>n+m.count,0),
    fullArchitecture:false,hasEnvironment:false,stage5Meshes:0,stage6Meshes:0};
  function setDetail(value){
    detail=!!value;for(const sign of signs)sign.visible=detail&&mode!=='performance';
  }
  function setQuality(value){
    mode=value;setDetail(detail);
  }
  setQuality(quality);
  return {
    root,sun:moon,targets,staticBatches:instances.length,
    featureCount:signs.length,environmentCount:0,environmentSigns:signs.length,
    resourceProfile68,setQuality,setDetail,animate(){},
    dispose(){
      for(const r of resources){if(r?.dispose)r.dispose();else if(r?.isLight)r.removeFromParent();}
      root.removeFromParent();hemi.removeFromParent();moon.removeFromParent();
      scene.fog=oldFog;scene.background=oldBackground;
    }
  };
}
export {createNeonWorld};
