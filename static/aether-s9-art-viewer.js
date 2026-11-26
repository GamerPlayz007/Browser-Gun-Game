import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id),canvas=$('view'),status=$('status');
try{
 const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
 const scene=new T.Scene();scene.background=new T.Color(0x101c28);const camera=new T.PerspectiveCamera(37,1,.05,50);
 const controls={autoRotate:!matchMedia('(prefers-reduced-motion: reduce)').matches};
 const orbit={yaw:.64,pitch:.2,distance:5.6};let pointer=null;
 const place=()=>{orbit.yaw=.64;orbit.pitch=.2;orbit.distance=5.6;};
 canvas.addEventListener('pointerdown',e=>{if(pointer)return;canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY};controls.autoRotate=false;$('spin').setAttribute('aria-pressed','false');});
 canvas.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;orbit.yaw-=(e.clientX-pointer.x)*.008;orbit.pitch=T.MathUtils.clamp(orbit.pitch+(e.clientY-pointer.y)*.006,-1.15,1.15);pointer.x=e.clientX;pointer.y=e.clientY;});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(pointer?.id===e.pointerId)pointer=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.distance=T.MathUtils.clamp(orbit.distance*Math.exp(e.deltaY*.001),2.7,12);},{passive:false});
 function updateCamera(dt){if(controls.autoRotate&&!pointer)orbit.yaw+=dt*.24;const h=Math.cos(orbit.pitch)*orbit.distance;camera.position.set(Math.sin(orbit.yaw)*h,.93+Math.sin(orbit.pitch)*orbit.distance,Math.cos(orbit.yaw)*h);camera.lookAt(0,.93,0);}
 place();updateCamera(0);
 const key=new T.DirectionalLight(0xe9faff,4);key.position.set(3,5,4);scene.add(key);const rim=new T.DirectionalLight(0x64d9ff,3);rim.position.set(-3,2,-4);scene.add(rim);const fill=new T.DirectionalLight(0xffb57a,1.25);fill.position.set(-4,1,3);scene.add(fill,new T.HemisphereLight(0xd2efff,0x2b303c,2.1));
 const platform=new T.Mesh(new T.CylinderGeometry(1.65,1.8,.13,80),new T.MeshStandardMaterial({color:0x182a38,roughness:.38,metalness:.62}));platform.position.y=.04;scene.add(platform);
 const ring=new T.Mesh(new T.RingGeometry(1.49,1.51,96),new T.MeshBasicMaterial({color:0x4bbacc,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.112;scene.add(ring);
 const matSet=new Set();let wire=false,alternate=false,asset=null;
 $('spin').setAttribute('aria-pressed',String(controls.autoRotate));$('spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('spin').setAttribute('aria-pressed',String(controls.autoRotate));};
 $('wire').onclick=()=>{wire=!wire;matSet.forEach(m=>m.wireframe=wire);$('wire').setAttribute('aria-pressed',String(wire));};
 $('reset').onclick=place;$('light').onclick=()=>{alternate=!alternate;key.intensity=alternate?2:4;rim.intensity=alternate?6:3;fill.intensity=alternate?2:1.25;$('light').setAttribute('aria-pressed',String(alternate));};
 let sequence=0;
 function dispose(root){if(!root)return;const g=new Set(),m=new Set(),t=new Set();root.traverse(o=>{if(o.geometry)g.add(o.geometry);if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material]){m.add(mat);for(const v of Object.values(mat))if(v?.isTexture)t.add(v);}});root.removeFromParent();for(const x of g)x.dispose();for(const x of t)x.dispose();for(const x of m)x.dispose();}
 async function loadFinish(){
  const seq=++sequence,finish=$('finish').value,path='/static/assets/aether-s9-'+finish+'.glb';
  $('download').hidden=true;$('render').hidden=true;status.classList.remove('error');status.textContent='Checking Blender export…';
  try{
   const res=await fetch('/static/assets/aether-s9-build.json',{cache:'no-cache'});if(!res.ok)throw Error('Blender build not published');const report=await res.json();if(!report.variants?.[finish])throw Error('Finish not published');
   if(seq!==sequence)return;status.textContent='Loading Blender GLB…';
   const gltf=await new GLTFLoader().loadAsync(path);if(seq!==sequence){dispose(gltf.scene);return;}
   dispose(asset);matSet.clear();asset=new T.Group();asset.add(gltf.scene);
   const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const scale=2.8/Math.max(size.x,size.y,size.z);asset.scale.setScalar(scale);asset.position.copy(center.multiplyScalar(-scale));asset.position.y+=.93;scene.add(asset);
   let triangles=0;asset.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){matSet.add(m);m.wireframe=wire;}}});
   $('tris').textContent=Math.round(triangles).toLocaleString();$('mats').textContent=matSet.size;
   $('download').href=path;$('download').hidden=false;$('render').href='/static/previews/aether-s9-'+finish+'.png';$('render').hidden=false;status.textContent='BLENDER GLB LOADED';
  }catch(error){if(seq!==sequence)return;status.classList.add('error');status.textContent='New Blender export not available: '+error.message;}
 }
 $('finish').addEventListener('change',loadFinish);loadFinish();
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
 new ResizeObserver(resize).observe(canvas);resize();
 let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden)return;updateCamera(dt);renderer.render(scene,camera);});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics context lost. Refresh to retry.';});
}catch(error){console.error(error);status.classList.add('error');status.textContent='WebGL unavailable. Download the asset to inspect in Blender.';}
