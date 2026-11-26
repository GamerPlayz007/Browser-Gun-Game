import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id),canvas=$('view'),status=$('status');
try{
 const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
 const scene=new T.Scene();scene.background=new T.Color(0x101c28);const camera=new T.PerspectiveCamera(37,1,.05,50);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.autoRotateSpeed=.65;controls.minDistance=2.7;controls.maxDistance=12;
 const place=()=>{camera.position.set(3.7,2,5.2);controls.target.set(0,.93,0);controls.update()};place();
 const key=new T.DirectionalLight(0xe9faff,4);key.position.set(3,5,4);scene.add(key);const rim=new T.DirectionalLight(0x64d9ff,3);rim.position.set(-3,2,-4);scene.add(rim);const fill=new T.DirectionalLight(0xffb57a,1.25);fill.position.set(-4,1,3);scene.add(fill,new T.HemisphereLight(0xd2efff,0x2b303c,2.1));
 const platform=new T.Mesh(new T.CylinderGeometry(1.65,1.8,.13,80),new T.MeshStandardMaterial({color:0x182a38,roughness:.38,metalness:.62}));platform.position.y=.04;scene.add(platform);
 const ring=new T.Mesh(new T.RingGeometry(1.49,1.51,96),new T.MeshBasicMaterial({color:0x4bbacc,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.112;scene.add(ring);
 const matSet=new Set();let wire=false,alternate=false,asset=null;
 $('spin').setAttribute('aria-pressed',String(controls.autoRotate));$('spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('spin').setAttribute('aria-pressed',String(controls.autoRotate));};
 $('wire').onclick=()=>{wire=!wire;matSet.forEach(m=>m.wireframe=wire);$('wire').setAttribute('aria-pressed',String(wire));};
 $('reset').onclick=place;$('light').onclick=()=>{alternate=!alternate;key.intensity=alternate?2:4;rim.intensity=alternate?6:3;fill.intensity=alternate?2:1.25;$('light').setAttribute('aria-pressed',String(alternate));};
 new GLTFLoader().load('/static/assets/aether-s9-photonic.gltf',gltf=>{
  asset=gltf.scene;const bounds=new T.Box3().setFromObject(asset);asset.position.sub(bounds.getCenter(new T.Vector3()));asset.position.y+=.93;scene.add(asset);let triangles=0;
  asset.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){matSet.add(m);m.wireframe=wire;}}});
  $('tris').textContent=Math.round(triangles).toLocaleString();$('mats').textContent=matSet.size;status.textContent='ASSET LOADED · GLTF 2.0';
 },undefined,error=>{console.error(error);status.classList.add('error');status.textContent='Asset failed to load; download remains available.';});
 function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
 new ResizeObserver(resize).observe(canvas);resize();
 renderer.setAnimationLoop(()=>{if(document.hidden)return;controls.update();renderer.render(scene,camera);});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics context lost. Refresh to retry.';});
}catch(error){console.error(error);status.classList.add('error');status.textContent='WebGL unavailable. Download the asset to inspect in Blender.';}
