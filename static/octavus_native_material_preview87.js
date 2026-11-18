/* Octavus Phase 1.6 source texture display — STAGING VIEW ONLY.
 * The native MPZ's 223 VSlot lineage was decoded from source r829.
 * Diffuse image URLs are preexisting attributed Red Eclipse assets.
 * This implements the engine's TEX_SCALE=8, six axis projections and
 * rotation/flip table for axis-dominant faces; sloped/merged faces and
 * layered materials are not guaranteed native-renderer equivalent.
 *
 * Data: /static/maps/octavus.native-materials87.json
 * Source: redeclipse/base src/engine/octarender.cpp calctexgen,
 * src/engine/texture.cpp texrotations[8].
 */
import * as THREE from 'three';

const MANIFEST='/static/maps/octavus.native-materials87.json';
const ROTATIONS=[
 [false,false,false],[false,true,true],[true,true,false],[true,false,true],
 [true,false,false],[false,true,false],[false,false,true],[true,true,true]
];
const MAX_TEXTURE_IMAGES=90;

function texgenShader(shader,configuration){
  const {rotation,scale,offset,originalSize}=configuration;
  const [flipX,flipY,swapXY]=ROTATIONS[rotation];
  const sx=8/(scale*originalSize[0])*(flipX?-1:1);
  const sy=8/(scale*originalSize[1])*(flipY?-1:1);
  const ox=-(swapXY?offset[1]:offset[0])/originalSize[0];
  const oy=-(swapXY?offset[0]:offset[1])/originalSize[1];
  shader.uniforms.uOctavusTexScale={value:new THREE.Vector2(sx,sy)};
  shader.uniforms.uOctavusTexOffset={value:new THREE.Vector2(ox,oy)};
  shader.uniforms.uOctavusSwap={value:swapXY?1:0};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vOctavusLocal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvOctavusLocal = position;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',[
     '#include <common>',
     'varying vec3 vOctavusLocal;',
     'uniform vec2 uOctavusTexScale;',
     'uniform vec2 uOctavusTexOffset;',
     'uniform int uOctavusSwap;',
   ].join('\n'))
   .replace('#include <map_fragment>',[
    '#ifdef USE_MAP',
    // Convert Three's X=source X, Y=source Z, Z=source Y:
    'vec3 npos = vec3(vOctavusLocal.x/0.05 + 4096.0, vOctavusLocal.z/0.05 + 4096.0, vOctavusLocal.y/0.05 + 2816.0);',
    'vec3 dfp = normalize(cross(dFdx(vOctavusLocal), dFdy(vOctavusLocal)));',
    'vec3 a = abs(dfp);',
    // Original orient 0/1 is negative/positive world X,
    // orient 2/3 negative/positive world Y,
    // orient 4/5 negative/positive world Z.
    'int faceOrient = 0;',
    'if (a.x > max(a.y,a.z)) faceOrient = dfp.x >= 0.0 ? 1 : 0;',
    'else if (a.z > a.y) faceOrient = dfp.z >= 0.0 ? 3 : 2;',
    'else faceOrient = dfp.y >= 0.0 ? 5 : 4;',
    'vec2 nativeUV;',
    'if(uOctavusSwap==0){',
      'if(faceOrient==0) nativeUV=vec2(npos.y,-npos.z);',
      'else if(faceOrient==1) nativeUV=vec2(-npos.y,-npos.z);',
      'else if(faceOrient==2) nativeUV=vec2(-npos.x,-npos.z);',
      'else if(faceOrient==3) nativeUV=vec2(npos.x,-npos.z);',
      'else if(faceOrient==4) nativeUV=vec2(npos.x,-npos.y);',
      'else nativeUV=vec2(npos.x,npos.y);',
    '}else{',
      'if(faceOrient==0) nativeUV=vec2(-npos.z,npos.y);',
      'else if(faceOrient==1) nativeUV=vec2(-npos.z,-npos.y);',
      'else if(faceOrient==2) nativeUV=vec2(-npos.z,-npos.x);',
      'else if(faceOrient==3) nativeUV=vec2(-npos.z,npos.x);',
      'else if(faceOrient==4) nativeUV=vec2(-npos.y,npos.x);',
      'else nativeUV=vec2(npos.y,npos.x);',
    '}',
    'vec2 uvOctavus = nativeUV*uOctavusTexScale + uOctavusTexOffset;',
    'vec4 sourceDiffuse = texture2D(map,uvOctavus);',
    'diffuseColor *= sourceDiffuse;',
    '#endif'
   ].join('\n'));
}

export class OctavusNativeMaterialPreview{
 constructor(){
  this.manifest=null;
  this.manifestRequest=null;
  this.textures=new Map();
  this.textureRequests=new Map();
 }
 async getManifest(){
  if(this.manifest)return this.manifest;
  if(!this.manifestRequest){
   this.manifestRequest=fetch(MANIFEST,{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw Error('Native material manifest missing ('+r.status+')');return r.json()})
    .then(j=>{
      if(j.format!=='OCTAVUS-NATIVE-MATERIALS87'||j.nativeVSlots!==223||
         j.originalCFGRoots!==68||j.status!=='staging-only-not-live'){
        throw Error('Native texture registry does not match original MPZ');
      }
      this.manifest=j;
      return j;
    });
  }
  try{return await this.manifestRequest}
  catch(e){this.manifestRequest=null;throw e}
 }
 async fetchTexture(url){
  if(this.textures.has(url))return this.textures.get(url);
  if(!this.textureRequests.has(url)){
   const pending=new Promise((resolve,reject)=>{
    new THREE.TextureLoader().load(url,t=>{
     t.wrapS=THREE.RepeatWrapping;
     t.wrapT=THREE.RepeatWrapping;
     t.colorSpace=THREE.SRGBColorSpace;
     t.anisotropy=2;
     t.needsUpdate=true;
     this.textures.set(url,t);
     resolve(t);
    },undefined,()=>reject(Error('Original source image unavailable: '+url)));
   });
   this.textureRequests.set(url,pending);
  }
  return this.textureRequests.get(url);
 }
 reset(meshInfo){
  if(!meshInfo)return;
  for(const material of meshInfo.materials){
   if(material.map||material.userData?.sourceTexture){
     material.map=null;
     material.userData.sourceTexture=null;
     material.onBeforeCompile=()=>{};
     material.needsUpdate=true;
   }
  }
 }
 async apply(meshInfo,stillActive=()=>true){
  const manifest=await this.getManifest();
  if(!stillActive())return null;
  const infos=meshInfo.slots.map((slot,i)=>({
   mat:meshInfo.materials[i],
   slot,
   rec:manifest.materials[String(slot)]
  }));
  const requested=[...new Set(infos
   .filter(x=>x.rec?.image&&x.slot!==1)
   .map(x=>x.rec.image))];
  if(requested.length>MAX_TEXTURE_IMAGES)
   throw Error('Native material preview exceeds safe source texture budget');
  const settled=await Promise.allSettled(requested.map(url=>this.fetchTexture(url)));
  if(!stillActive())return null;
  const resolved=new Map();
  for(let i=0;i<requested.length;i++){
   const result=settled[i];
   if(result.status==='fulfilled')resolved.set(requested[i],result.value);
  }
  if(!meshInfo.geometry.getAttribute('uv')){
   // Three.js MeshStandardMaterial exposes USE_MAP with a UV attribute.
   // Native texgen is calculated directly from 3D source coordinates in
   // onBeforeCompile; the attribute itself is deliberately unused.
   const n=meshInfo.geometry.getAttribute('position').count;
   meshInfo.geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
  }
  let mappedSlots=0,missingSlots=0,sourceTriangles=0;
  for(const {mat,slot,rec} of infos){
   if(!rec||!rec.image||!resolved.has(rec.image)||slot===1){
    missingSlots++;
    continue;
   }
   const texture=resolved.get(rec.image);
   const sourceSize=rec.sourceImageSize;
   if(!sourceSize||sourceSize.some(x=>x<1))continue;
   const config={
    rotation:rec.rotation,
    scale:rec.scale,
    offset:rec.offset,
    originalSize:sourceSize
   };
   mat.map=texture;
   mat.vertexColors=false;
   mat.color.setRGB(...rec.color);
   mat.userData.sourceTexture=rec.sourceDiffuse;
   mat.onBeforeCompile=shader=>texgenShader(shader,config);
   mat.needsUpdate=true;
   mappedSlots++;
   sourceTriangles+=rec.triangleCount;
  }
  return {
   mappedSlots,missingSlots,
   distinctSourceImages:resolved.size,
   appliedTriangles:sourceTriangles,
   missingImages:requested.length-resolved.size,
   isExactRenderer:false,
  };
 }
}
