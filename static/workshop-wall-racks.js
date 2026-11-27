/** CROSSFire Workshop Wall Racks · nonfunctional 3D game-art gallery.
 * Three real repository GLBs; mounts are scenery with pointer hit targets.
 * No gameplay/network/collision imports. */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WORKSHOP_CATALOG} from './workshop-library.js';
import {readAssetBytes} from './gallery-assets.js';

export const WALL_MODELS=Object.freeze([
 {id:'awp01-v03',profile:'ORIGINAL',label:'AWP-01',revision:'ORIGINAL · v0.3',x:-8.2,accent:0x96d1a6},
 {id:'s12-v04',profile:'PERFORMANCE',label:'S-12',revision:'GAME MODEL · v0.4',x:0,accent:0xeab980},
 {id:'specter-midnight',profile:'PERFORMANCE',label:'SPECTER',revision:'MIDNIGHT · STUDIO',x:8.2,accent:0x87c8f0}
]);

const labelMaterial=(title,subtitle,accent)=>{
 const c=document.createElement('canvas');c.width=1024;c.height=256;
 const g=c.getContext('2d');
 g.fillStyle='#111e29';g.fillRect(0,0,1024,256);
 g.strokeStyle='#'+new T.Color(accent).getHexString();g.lineWidth=10;g.strokeRect(12,12,1000,232);
 g.fillStyle='#f6fcff';g.font='bold 94px Arial';g.textAlign='left';g.fillText(title,50,114);
 g.fillStyle='#9ebdca';g.font='bold 37px Arial';g.fillText(subtitle,52,190);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
 return new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
};

export function createWorkshopWallRacks({scene,onChoose,onMessage,isBusy=()=>false}){
 const root=new T.Group();root.name='GARAGE_3D_WALL_RACKS';scene.add(root);
 const loader=new GLTFLoader();const racks=[];
 const raycaster=new T.Raycaster(),ndc=new T.Vector2();
 const dark=new T.MeshStandardMaterial({color:0x0b1721,roughness:.82,metalness:.25});
 const steel=new T.MeshStandardMaterial({color:0x526571,roughness:.42,metalness:.68});
 const bolts=new T.MeshStandardMaterial({color:0x889ba5,roughness:.36,metalness:.78});
 function piece(parent,name,geometry,material,x,y,z){
   const object=new T.Mesh(geometry,material);object.name=name;object.position.set(x,y,z);parent.add(object);return object;
 }
 for(const spec of WALL_MODELS){
  const rack=new T.Group();rack.name='WALL_RACK_'+spec.id;
  rack.position.set(spec.x,4.2,-9.25);rack.userData.wallAssetId=spec.id;root.add(rack);
  // Actual 3D wall-mounted brushed steel showcase with broad hit area.
  piece(rack,'Powder-coated mounting panel',new T.BoxGeometry(7.3,3.3,.22),dark,0,0,0);
  piece(rack,'Display shelf - upper',new T.BoxGeometry(7.05,.045,.20),steel,0,1.52,.16);
  piece(rack,'Display shelf - lower',new T.BoxGeometry(7.05,.045,.20),steel,0,-1.52,.16);
  piece(rack,'Mount vertical rail left',new T.BoxGeometry(.06,3.13,.13),steel,-3.46,0,.17);
  piece(rack,'Mount vertical rail right',new T.BoxGeometry(.06,3.13,.13),steel,3.46,0,.17);
  const accentMat=new T.MeshBasicMaterial({color:spec.accent});
  const activeStrip=piece(rack,'Selected asset illumination',new T.BoxGeometry(7,.042,.12),accentMat,0,-1.42,.22);
  activeStrip.visible=false;
  for(const x of [-3.27,3.27])for(const y of [-1.3,1.3]){
   piece(rack,'Wall mounting bolt',new T.SphereGeometry(.06,7,6),bolts,x,y,.22);
  }
  // Label is mounted ON the wall as a mesh, not a sidebar list.
  const label=piece(rack,'Model wall nameplate',new T.PlaneGeometry(4.9,1.22),labelMaterial(spec.label,spec.revision,spec.accent),0,-2.23,.17);
  label.userData.wallAssetId=spec.id;
  const preview=new T.Group();preview.name='AUTHORED_GLB_WALL_DISPLAY';preview.position.z=.30;rack.add(preview);
  racks.push({spec,rack,preview,activeStrip,status:'loading',model:null});
 }

 async function loadRack(item){
   const {spec,preview}=item;
   const entry=WORKSHOP_CATALOG.find(a=>a.id===spec.id);
   const profile=entry?.profiles.find(p=>p.id===spec.profile);
   if(!profile?.url){item.status='missing';return}
   try{
     const data=await readAssetBytes(profile.url,{maxBytes:65_000_000});
     if(data.byteLength!==profile.bytes)throw Error('Asset checksum size mismatch');
     const gltf=await loader.parseAsync(data,'');
     const model=gltf.scene;if(!model)throw Error('3D scene missing');
     // Turn the longest authored axis horizontal for a realistic wall exhibition.
     model.updateMatrixWorld(true);
     let box=new T.Box3().setFromObject(model),sz=box.getSize(new T.Vector3());
     if(box.isEmpty())throw Error('Model geometry missing');
     if(sz.y>=sz.x&&sz.y>=sz.z)model.rotation.z=Math.PI/2;
     else if(sz.z>=sz.x&&sz.z>=sz.y)model.rotation.y=Math.PI/2;
     model.updateMatrixWorld(true);
     box=new T.Box3().setFromObject(model);sz=box.getSize(new T.Vector3());
     const factor=Math.min(6.25/Math.max(sz.x,.001),2.32/Math.max(sz.y,.001),1.75/Math.max(sz.z,.001));
     model.scale.multiplyScalar(factor);model.updateMatrixWorld(true);
     box=new T.Box3().setFromObject(model);
     const center=box.getCenter(new T.Vector3());model.position.sub(center);model.updateMatrixWorld(true);
     model.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;n.frustumCulled=true}});
     preview.add(model);item.model=model;item.status='ready';
   }catch(err){item.status='error';onMessage?.('WALL RACK / '+spec.label+': '+err.message)}
 }
 // Sequential loading avoids spikes on the target school laptops.
 async function loadAll(){for(const item of racks)await loadRack(item)}
 function pick(camera,canvas,x,y){
  const b=canvas.getBoundingClientRect();
  ndc.set((x-b.left)/b.width*2-1,-((y-b.top)/b.height*2-1));
  raycaster.setFromCamera(ndc,camera);
  const hits=raycaster.intersectObjects(racks.map(r=>r.rack),true);
  for(const hit of hits){
    let n=hit.object;
    while(n){if(n.userData?.wallAssetId)return n.userData.wallAssetId;n=n.parent}
  }
  return null;
 }
 function choose(id){
   if(isBusy())return;
   const rack=racks.find(r=>r.spec.id===id);
   if(rack){onChoose?.(id);return true}return false;
 }
 function setActive(id){for(const rack of racks)rack.activeStrip.visible=rack.spec.id===id}
 return {loadAll,pick,choose,setActive,getStatus:()=>racks.map(r=>({id:r.spec.id,status:r.status})),root};
}