// Phase 4.2 — cinematic night lighting for the single playable Cyberpunk City.
// Render-only module: creates no colliders and never affects multiplayer state.
export const LIGHTING_PRESETS={
 performance:{pointBudget:2,signBudget:0,spots:0,shadow:false,shadowSize:1024,groundGlow:0,key:1.0,ambient:.94,fog:.0064},
 auto:{pointBudget:4,signBudget:2,spots:1,shadow:true,shadowSize:1536,groundGlow:2,key:1.65,ambient:.78,fog:.0085},
 high:{pointBudget:4,signBudget:4,spots:2,shadow:true,shadowSize:1536,groundGlow:4,key:1.65,ambient:.78,fog:.0085},
 ultra:{pointBudget:4,signBudget:6,spots:4,shadow:true,shadowSize:2048,groundGlow:4,key:1.85,ambient:.72,fog:.0092},
 native:{pointBudget:4,signBudget:4,spots:2,shadow:true,shadowSize:1536,groundGlow:4,key:1.65,ambient:.78,fog:.0085}
};
export const DISTRICT_LIGHTS=[
 {zone:'market',x:-24,y:5.5,z:6,color:'#ff559f',power:17,radius:23},
 {zone:'plaza',x:0.5,y:5.8,z:22,color:'#57eaff',power:18,radius:22},
 {zone:'atrium',x:25,y:6.8,z:12,color:'#53dac4',power:19,radius:22},
 {zone:'transit',x:4,y:13.2,z:-23,color:'#ffbd6f',power:17,radius:23}
];
// Each authored district receives its own color, without moving its geometry.
export function createCinematicLighting(T,scene,root,map){
 const hemi=new T.HemisphereLight('#8ea6cc','#3a2438',.78);
 const moon=new T.DirectionalLight('#a4d5ff',1.65);
 moon.position.set(-40,75,-28);moon.target.position.set(0,0,0);
 moon.shadow.mapSize.set(1536,1536);
 Object.assign(moon.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:2,far:210});
 moon.shadow.bias=-.00016;moon.shadow.normalBias=.042;
 if('radius' in moon.shadow)moon.shadow.radius=2.2;
 const rim=new T.DirectionalLight('#ba72ab',.55);
 rim.position.set(38,21,35);
 root.add(hemi,moon,moon.target,rim);
 // A few honest light sources are better than dozens of costly shadow casters.
 const districtLights=DISTRICT_LIGHTS.map((p,i)=>{
  const light=new T.PointLight(p.color,p.power,p.radius,2);
  light.position.set(p.x,p.y,p.z);light.castShadow=false;
  light.userData={cinematic42:true,zone:p.zone,baseIntensity:p.power,phase:i*2.13,kind:'district'};
  root.add(light);return light;
 });
 const signs=(map.signs||[]).slice(0,6);
 const signLights=signs.map((s,i)=>{
  const angle=s.rotationY||0,dx=Math.sin(angle),dz=Math.cos(angle);
  const color=map.palette?.[s.color]||'#7bdcf4';
  const light=new T.PointLight(color,9.4,8,2);
  light.position.set(s.x+dx*.65,s.y-.25,s.z+dz*.65);
  light.castShadow=false;
  light.userData={cinematic42:true,baseIntensity:9.4,phase:i*1.67,kind:'sign'};
  root.add(light);return light;
 });
 const spotAnchors=DISTRICT_LIGHTS.map((p,i)=>{
  // Wall wash washes architectural volumes, without extra shadow maps.
  const spot=new T.SpotLight(p.color,24,28,Math.PI/4,0.75,2);
  spot.position.set(p.x+(i%2?4:-4),p.y+4,p.z-4);
  spot.target.position.set(p.x,p.zone==='transit'?9:1,p.z+2);
  spot.castShadow=false;
  spot.userData={cinematic42:true,baseIntensity:24,kind:'wash'};
  root.add(spot,spot.target);return spot;
 });
 // Thin emissive housings anchor the existing authored signs in the scene,
 // making the sources visually plausible instead of unmotivated color spots.
 const strips=new T.Group();strips.name='phase42-neon-sign-housings';
 const stripMaterials=new Map();
 signs.forEach(s=>{
  const name=s.color||'cyan',color=map.palette?.[name]||'#80dfff';
  if(!stripMaterials.has(name))
   stripMaterials.set(name,new T.MeshBasicMaterial({color,toneMapped:false,side:T.DoubleSide}));
  const geo=new T.PlaneGeometry(Math.max(.45,s.w-.12),.075);
  const mesh=new T.Mesh(geo,stripMaterials.get(name));
  const rotation=s.rotationY||0;
  mesh.rotation.y=rotation;
  mesh.position.set(s.x+Math.sin(rotation)*.045,s.y+s.h*.45,s.z+Math.cos(rotation)*.045);
  mesh.userData.collidable=false;
  strips.add(mesh);
 });
 root.add(strips);
 // Shader-based, low-opacity glow pools: no textures to download, no geometry
 // registered with collision and no extra real-time shadow pass.
 const glowShader={
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec2 vUv;uniform vec3 glowColor;uniform float opacity; void main(){vec2 p=vUv*2.0-1.0; float d=length(p); float alpha=(1.0-smoothstep(0.05,1.0,d))*opacity; gl_FragColor=vec4(glowColor,alpha);}'
 };
 const pools=DISTRICT_LIGHTS.map((p,i)=>{
  const mat=new T.ShaderMaterial({
   ...glowShader,uniforms:{glowColor:{value:new T.Color(p.color)},opacity:{value:.17}},
   transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,
   blending:T.AdditiveBlending,toneMapped:false
  });
  const mesh=new T.Mesh(new T.PlaneGeometry(11,11),mat);
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(p.x,p.zone==='transit'?9.045:p.zone==='plaza'?.055:1.045,p.z);
  mesh.renderOrder=2;mesh.userData.collidable=false;mesh.userData.cinematicGlow=true;
  root.add(mesh);return mesh;
 });
 let active='high';
 function setQuality(mode='high'){
  active=LIGHTING_PRESETS[mode]?mode:'high';
  const cfg=LIGHTING_PRESETS[active];
  hemi.intensity=cfg.ambient;moon.intensity=cfg.key;rim.intensity=active==='performance'?.23:.55;
  moon.castShadow=cfg.shadow;
  if(moon.shadow.mapSize.width!==cfg.shadowSize){
   moon.shadow.mapSize.set(cfg.shadowSize,cfg.shadowSize);
   // Changing an existing shadow-map size needs reallocation.
   moon.shadow.map?.dispose();moon.shadow.map=null;
  }
  for(let i=0;i<districtLights.length;i++)districtLights[i].visible=i<cfg.pointBudget;
  for(let i=0;i<signLights.length;i++)signLights[i].visible=i<cfg.signBudget;
  for(let i=0;i<spotAnchors.length;i++)spotAnchors[i].visible=i<cfg.spots;
  for(let i=0;i<pools.length;i++)pools[i].visible=i<cfg.groundGlow;
  strips.visible=true;
  if(scene.fog)scene.fog.density=cfg.fog;
 }
 function animate(time){
  if(!Number.isFinite(time))return;
  // Tiny deterministic power variations, restrained to avoid strobe effects.
  for(const light of districtLights){
   const phase=light.userData.phase;
   light.intensity=light.userData.baseIntensity*(.965+.027*Math.sin(time*.82+phase)+.008*Math.sin(time*2.7+phase));
  }
  for(const light of signLights){
   const phase=light.userData.phase;
   light.intensity=light.userData.baseIntensity*(.975+.02*Math.sin(time*1.5+phase));
  }
 }
 function dispose(){
  for(const mesh of strips.children)mesh.geometry.dispose();
  for(const material of stripMaterials.values())material.dispose();
  for(const mesh of pools){mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();}
  root.remove(hemi,moon,moon.target,rim,strips);
  for(const light of [...districtLights,...signLights,...spotAnchors]){
   light.target?.removeFromParent();light.removeFromParent();
   if(light.shadow?.map)light.shadow.map.dispose();
  }
  if(moon.shadow.map)moon.shadow.map.dispose();
 }
 setQuality('high');
 return {moon,hemi,rim,districtLights,signLights,spotAnchors,pools,strips,
   setQuality,animate,dispose,get quality(){return active;}};
}
