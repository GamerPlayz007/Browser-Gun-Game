// Offline glTF 2.0 sculpture exporter. Original nonfunctional fictional game art.
// Run with node tools/aether-s9-art.mjs to reproduce the embedded asset.
export function buildS9(){
 const mats=[
 ['Basalt ceramic',[.065,.085,.105,1],.3,.36],
 ['Satin alloy',[.37,.45,.51,1],.83,.27],
 ['Recessed graphite',[.018,.026,.038,1],.21,.66],
 ['Anodized copper',[.77,.31,.09,1],.69,.32],
 ['Photon crystal',[.035,.65,.8,1],.2,.22,[.035,.7,.9]],
 ['Pale edge enamel',[.73,.79,.8,1],.35,.3],
 ['Deep teal alloy',[.035,.19,.22,1],.63,.37]
 ];
 const batches=mats.map(()=>({p:[],n:[],uv:[]}));
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 function tri(m,a,b,c,uvs=[[0,0],[1,0],[1,1]]){
  const u=sub(b,a),v=sub(c,a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);
  if(len<1e-9)return;
  const dst=batches[m];dst.p.push(...a,...b,...c);for(let i=0;i<3;i++)dst.n.push(...n.map(x=>x/len));dst.uv.push(...uvs.flat());
 }
 const quad=(m,a,b,c,d)=>{tri(m,a,b,c);tri(m,a,c,d,[[0,0],[1,1],[0,1]]);};
 // Chamfered cross-section shells, with deliberate bevel faces and hard facet transitions.
 function shell(m,sections,cy=0,cz=0,roll=0){
  const ring=([x,h,d])=>[[-.69,-1],[.69,-1],[1,-.69],[1,.69],[.69,1],[-.69,1],[-1,.69],[-1,-.69]].map(([y,z])=>[x,cy+y*h*Math.cos(roll)-z*d*Math.sin(roll),cz+y*h*Math.sin(roll)+z*d*Math.cos(roll)]);
  const rr=sections.map(ring);
  for(let j=0;j<rr.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;quad(m,rr[j][i],rr[j+1][i],rr[j+1][k],rr[j][k]);}
  for(let i=1;i<7;i++){tri(m,rr[0][0],rr[0][i],rr[0][i+1]);const r=rr[rr.length-1];tri(m,r[0],r[i+1],r[i]);}
 }
 function panel(m,x,y,z,l,h,d,roll=0){const bevel=Math.min(.06,l*.16);shell(m,[[x-l/2,h*.68,d*.7],[x-l/2+bevel,h,d],[x+l/2-bevel,h,d],[x+l/2,h*.68,d*.7]],y,z,roll);}
 function torus(m,x,rad,tube,segments=48,sides=10){
  const v=(i,j)=>{const a=i*Math.PI*2/segments,b=j*Math.PI*2/sides;return [x+tube*Math.sin(b),(rad+tube*Math.cos(b))*Math.cos(a),(rad+tube*Math.cos(b))*Math.sin(a)];};
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++)quad(m,v(i,j),v(i+1,j),v(i+1,j+1),v(i,j+1));
 }
 // Longitudinal crystal prism, suspended inside a visibly open sculptural cage.
 const crystal=(m,x0,x1,r)=>shell(m,[[x0,r*.07,r*.07],[x0+.17,r,r],[x1-.17,r,r],[x1,r*.07,r*.07]],0,0,Math.PI/4);
 crystal(4,-.65,.65,.23);
 torus(1,-.62,.39,.065);torus(1,.62,.39,.065);torus(4,-.51,.343,.022);torus(4,.51,.343,.022);
 torus(2,-.73,.35,.05);torus(2,.73,.35,.05);
 // Four radial ceramic bridges, airy rather than a closed rectangular body.
 for(let i=0;i<4;i++){
  const a=Math.PI*.25+i*Math.PI*.5, y=.38*Math.cos(a),z=.38*Math.sin(a);
  shell(0,[[-.94,.065,.10],[-.78,.145,.125],[-.49,.12,.11],[.47,.12,.11],[.78,.145,.125],[.94,.065,.10]],y,z,a);
  panel(6,0,y*1.12,z*1.12,1.03,.047,.055,a);
  panel(4,0,y*1.25,z*1.25,.74,.015,.018,a);
  for(const sign of [-1,1]){panel(1,sign*.69,y*1.17,z*1.17,.14,.058,.062,a);panel(3,sign*.81,y*1.12,z*1.12,.075,.05,.05,a);}
 }
 // Swept, stepped end caps; solid octagonal terminal sculptures, no functional internals.
 for(const sign of [-1,1]){
  const at=sign*1.07;
  shell(0,[[at-.33,.17,.22],[at-.23,.30,.31],[at+.17,.30,.31],[at+.30,.16,.22]],0,0,Math.PI/8);
  panel(1,at,.0,.0,.14,.33,.34,Math.PI/8);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3;
   panel(2,at+sign*.12,.29*Math.cos(a),.29*Math.sin(a),.22,.036,.05,a);
   panel(5,at+sign*.12,.326*Math.cos(a),.326*Math.sin(a),.08,.012,.018,a);
  }
  torus(4,sign*1.36,.135,.021,32,8);
 }
 // Offset armor fins and decorative ID tiles interrupt the otherwise radial symmetry.
 for(const z of [-1,1]){
  shell(0,[[-.72,.08,.035],[-.48,.17,.055],[.22,.14,.055],[.60,.025,.03]],.34,z*.31,.25*z);
  panel(1,-.12,.42,z*.36,.57,.035,.025,.25*z);
  panel(3,.29,.39,z*.35,.14,.032,.022,.25*z);
  for(let i=0;i<5;i++)panel(i===0?3:5,-.43+i*.07,.36,z*.386,.045,.017,.014,.25*z);
 }
 // Actual authored texture maps: small seamless procedural color-grain PNGs.
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const b64=a=>{let s='';for(let i=0;i<a.length;i+=3){const n=(a[i]<<16)|((a[i+1]||0)<<8)|(a[i+2]||0);s+=alphabet[n>>18]+alphabet[(n>>12)&63]+(i+1<a.length?alphabet[(n>>6)&63]:'=')+(i+2<a.length?alphabet[n&63]:'=');}return s;};
 const be=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const crc=a=>{let c=~0;for(const v of a){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return ~c>>>0;};
 const chunk=(s,data)=>{const a=[...s].map(c=>c.charCodeAt(0)).concat(data);return [...be(data.length),...a,...be(crc(a))];};
 function texture(kind){
  const w=32,h=32,raw=[];let seed=827,adA=1,adB=0;
  for(let y=0;y<h;y++){raw.push(0);for(let x=0;x<w;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=(seed>>>24)%17;const v=kind===1?219+Math.round(10*Math.sin(y*Math.PI/4))+noise:228+noise;raw.push(v,v,v);}}
  for(const v of raw){adA=(adA+v)%65521;adB=(adB+adA)%65521;}
  const len=raw.length,z=[0x78,0x01,0x01,len&255,len>>>8,(~len)&255,((~len)>>>8)&255,...raw,...be((adB<<16)|adA)];
  const png=[137,80,78,71,13,10,26,10,...chunk('IHDR',[...be(w),...be(h),8,2,0,0,0]),...chunk('IDAT',z),...chunk('IEND',[])];
  return 'data:image/png;base64,'+b64(png);
 }
 const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[];let size=0;
 function accessor(array,width){
  const typed=new Float32Array(array),bytes=new Uint8Array(typed.buffer);
  const view=bufferViews.length;bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length,target:34962});chunks.push(bytes);size+=bytes.length;
  const min=Array(width).fill(Infinity),max=Array(width).fill(-Infinity);
  for(let i=0;i<typed.length;i++){let d=i%width;min[d]=Math.min(min[d],typed[i]);max[d]=Math.max(max[d],typed[i]);}
  const index=accessors.length;accessors.push({bufferView:view,componentType:5126,count:array.length/width,type:width===3?'VEC3':'VEC2',min,max});return index;
 }
 batches.forEach((b,i)=>{if(!b.p.length)return;const idx=meshes.length;meshes.push({name:mats[i][0],primitives:[{attributes:{POSITION:accessor(b.p,3),NORMAL:accessor(b.n,3),TEXCOORD_0:accessor(b.uv,2)},material:i,mode:4}]});nodes.push({name:mats[i][0],mesh:idx});});
 const bytes=new Uint8Array(size);let off=0;for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.length;}
 return {asset:{version:'2.0',generator:'AETHER offline art exporter'},scene:0,scenes:[{name:'S9 Photonic Sculpture',nodes:nodes.map((_,i)=>i)}],nodes,meshes,accessors,bufferViews,buffers:[{byteLength:size,uri:'data:application/octet-stream;base64,'+b64(bytes)}],images:[{uri:texture(0)},{uri:texture(1)}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],textures:[{sampler:0,source:0},{sampler:0,source:1}],materials:mats.map(([name,color,metal,rough,emissive],i)=>({name,pbrMetallicRoughness:{baseColorFactor:color,metallicFactor:metal,roughnessFactor:rough,...(i===0||i===1?{baseColorTexture:{index:i}}:{})},...(emissive?{emissiveFactor:emissive}:{}),doubleSided:true}))};
}

import { writeFileSync } from 'node:fs';
if(process.argv[1]&&process.argv[1].endsWith('aether-s9-art.mjs'))writeFileSync('static/assets/aether-s9-photonic.gltf',JSON.stringify(buildS9()));
