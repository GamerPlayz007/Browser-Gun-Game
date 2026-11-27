/** CROSSFire Workshop / real GLB component inspector.
 * Visual explode and mesh selection; does NOT modify or export source mesh data.
 */
import * as T from 'three';

export function createWorkshopComponentInspector({onSelection=()=>{},onCount=()=>{}}={}){
 const box=new T.Box3(),c=new T.Vector3(),mid=new T.Vector3(),world=new T.Vector3();
 const ray=new T.Raycaster(),pointer=new T.Vector2();
 let items=[],selected=null,amount=0,enabled=false,root=null,highlight=null;
 function clearHighlight(){
   if(!selected||!highlight)return;
   selected.object.material=highlight.original;
   for(const m of highlight.materials)m.dispose();
   highlight=null;
 }
 function reset(){
   clearHighlight();for(const item of items)item.object.position.copy(item.origin);
   items=[];selected=null;root=null;enabled=false;amount=0;onSelection(null);onCount(0);
 }
 function attach(instance){
   reset();if(!instance)return;
   root=instance;instance.updateMatrixWorld(true);
   box.setFromObject(instance);const globalCenter=box.getCenter(mid).clone();
   const meshes=[];instance.traverse(node=>{if(node.isMesh)meshes.push(node)});
   for(let i=0;i<meshes.length;i++){
     const object=meshes[i],bounds=new T.Box3().setFromObject(object);
     if(bounds.isEmpty())continue;
     const center=bounds.getCenter(c).clone();
     const direction=center.clone().sub(globalCenter);
     // Deterministic stagger for nested small parts sharing a center.
     const angle=i*2.399963229728653;
     const z=1-2*(i+.5)/Math.max(1,meshes.length),radius=Math.sqrt(Math.max(0,1-z*z));
     const jitter=new T.Vector3(Math.cos(angle)*radius,z,Math.sin(angle)*radius);
     if(direction.lengthSq()<1e-7)direction.copy(jitter);
     direction.normalize().multiplyScalar(.65).addScaledVector(jitter,.35).normalize();
     const desiredWorld=center.clone().addScaledVector(direction,2.5);
     const local0=object.parent.worldToLocal(center.clone());
     const local1=object.parent.worldToLocal(desiredWorld);
     const delta=local1.sub(local0);
     const geometry=object.geometry;
     const tris=Math.round((geometry?.index?.count??geometry?.attributes?.position?.count??0)/3);
     const materials=(Array.isArray(object.material)?object.material:[object.material])
        .filter(Boolean).map(mat=>mat.name||'Unnamed material');
     items.push({object,name:object.name||object.parent?.name||'Component '+String(i+1),
       index:items.length,origin:object.position.clone(),delta,triangles:tris,materials});
   }
   onCount(items.length);
 }
 function setSpread(percent){
   amount=Math.min(1,Math.max(0,Number(percent)/100||0));
   enabled=amount>.001;
   for(const item of items)item.object.position.copy(item.origin).addScaledVector(item.delta,amount);
   root?.updateMatrixWorld(true);
 }
 function select(index){
   clearHighlight();selected=items[index]??null;
   if(!selected){onSelection(null);return null}
   const originals=selected.object.material;
   const clones=(Array.isArray(originals)?originals:[originals]).map(m=>{
     if(!m)return m;
     const clone=m.clone();if(clone.color)clone.color.lerp(new T.Color(0xc5f5ff),.34);
     if(clone.emissive){clone.emissive.set(0x6be0f5);clone.emissiveIntensity=.5}
     return clone;
   });
   selected.object.material=Array.isArray(originals)?clones:clones[0];
   highlight={original:originals,materials:clones.filter(Boolean)};
   onSelection(selected);return selected;
 }
 function pick(camera,canvas,x,y){
   if(!root||!items.length)return null;
   const rect=canvas.getBoundingClientRect();
   pointer.set((x-rect.left)/rect.width*2-1,-((y-rect.top)/rect.height*2-1));
   ray.setFromCamera(pointer,camera);
   const targets=items.map(v=>v.object);
   const hit=ray.intersectObjects(targets,false)[0];
   if(!hit)return null;
   const found=items.find(i=>i.object===hit.object);
   if(!found)return null;
   return select(found.index);
 }
 function focusPoint(){
   if(!selected)return null;
   return new T.Box3().setFromObject(selected.object).getCenter(new T.Vector3());
 }
 function list(query='',limit=80){
   const term=String(query).trim().toLowerCase();
   const found=term?items.filter(i=>i.name.toLowerCase().includes(term)):items;
   return{matches:found.length,items:found.slice(0,limit)};
 }
 return{attach,reset,setSpread,select,pick,focusPoint,list,
   get selected(){return selected},get length(){return items.length},get enabled(){return enabled},get spread(){return amount}};
}