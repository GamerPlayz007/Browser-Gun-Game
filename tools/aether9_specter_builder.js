/**
 * CROSSFire SPECTER / AETHER-9 - ORIGINAL NONFUNCTIONAL SCI-FI GAME PROP
 * Offline GLB asset authoring script; the browser only loads the resulting file.
 * Requires no Blender/Node/dependencies to build. Blender can import the .glb.
 * This mesh represents fictional game art, not an operational mechanism.
 */
function makeSpecterGLB(){
 const materials=[
  {name:"SPECTER / Midnight ceramic",pbrMetallicRoughness:{baseColorFactor:[.075,.136,.183,1],metallicFactor:.26,roughnessFactor:.51},extensions:{KHR_materials_clearcoat:{clearcoatFactor:.26,clearcoatRoughnessFactor:.42}},doubleSided:true},
  {name:"SPECTER / Satin titanium",pbrMetallicRoughness:{baseColorFactor:[.40,.59,.65,1],metallicFactor:.86,roughnessFactor:.34},extensions:{KHR_materials_clearcoat:{clearcoatFactor:.12,clearcoatRoughnessFactor:.32}},doubleSided:true},
  {name:"SPECTER / Deep gunmetal",pbrMetallicRoughness:{baseColorFactor:[.10,.19,.26,1],metallicFactor:.74,roughnessFactor:.39},doubleSided:true},
  {name:"SPECTER / Underbody carbon",pbrMetallicRoughness:{baseColorFactor:[.055,.085,.115,1],metallicFactor:.15,roughnessFactor:.78},doubleSided:true},
  {name:"SPECTER / Luminous cyan",pbrMetallicRoughness:{baseColorFactor:[.055,.67,.90,1],metallicFactor:.18,roughnessFactor:.20},emissiveFactor:[.09,.75,.98],doubleSided:true},
  {name:"SPECTER / Recessed optics",pbrMetallicRoughness:{baseColorFactor:[.105,.38,.53,.74],metallicFactor:.35,roughnessFactor:.14},emissiveFactor:[.01,.10,.18],alphaMode:"BLEND",doubleSided:true},
  {name:"SPECTER / Silver edge",pbrMetallicRoughness:{baseColorFactor:[.75,.87,.91,1],metallicFactor:.91,roughnessFactor:.24},doubleSided:true},
  {name:"SPECTER / Graphite grip",pbrMetallicRoughness:{baseColorFactor:[.075,.10,.13,1],metallicFactor:.06,roughnessFactor:.90},doubleSided:true},
  {name:"SPECTER / Warning copper",pbrMetallicRoughness:{baseColorFactor:[.95,.46,.23,1],metallicFactor:.52,roughnessFactor:.38},emissiveFactor:[.22,.035,.012],doubleSided:true},
  {name:"SPECTER / Pearlescent armor",pbrMetallicRoughness:{baseColorFactor:[.31,.51,.60,1],metallicFactor:.38,roughnessFactor:.39},extensions:{KHR_materials_clearcoat:{clearcoatFactor:.58,clearcoatRoughnessFactor:.22}},doubleSided:true}
 ];
 const names=["ceramic","titanium","gunmetal","carbon","energy","glass","silver","grip","copper","pearl"];
 const meshes=[],pi=Math.PI;
 const add=(name,mat)=>{const m={name,mat,p:[],n:[],u:[],idx:[]};meshes.push(m);return m};
 const vsub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const len=a=>Math.hypot(...a);
 const norm=a=>{const l=len(a)||1;return a.map(v=>v/l)};
 const add3=(a,b)=>a.map((v,i)=>v+b[i]);
 const mul=(a,k)=>a.map(v=>v*k);
 function tri(m,a,b,c,uv=[[0,0],[1,0],[0,1]]){
  const n=norm(cross(vsub(b,a),vsub(c,a)));if(len(cross(vsub(b,a),vsub(c,a)))<1e-8)return;
  const base=m.p.length/3;for(let i=0;i<3;i++){const p=[a,b,c][i];m.p.push(...p);m.n.push(...n);m.u.push(...uv[i])}
  m.idx.push(base,base+1,base+2);
 }
 function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
 function loft(m,frames,facets=12,shape=.69,caps=true){
  const rings=frames.map(f=>{
   const points=[];
   for(let i=0;i<facets;i++){
    const a=2*pi*i/facets;
    const xx=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),shape);
    const yy=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),shape);
    points.push([(f.x||0)+xx*f.w,f.y+yy*f.h,f.z]);
   }return points;
  });
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<facets;j++){
   const a=rings[k][j],b=rings[k][(j+1)%facets],c=rings[k+1][(j+1)%facets],d=rings[k+1][j];
   quad(m,a,b,c,d);
  }
  if(caps)for(const end of [0,rings.length-1]){
   const f=frames[end],center=[f.x||0,f.y,f.z],ring=rings[end];
   for(let j=0;j<facets;j++){
    if(end===0)tri(m,center,ring[(j+1)%facets],ring[j]);
    else tri(m,center,ring[j],ring[(j+1)%facets]);
   }
  }
 }
 function cylinderBetween(m,a,b,r=0.02,seg=9){
  const axis=norm(vsub(b,a));
  let ref=Math.abs(axis[1])<.88?[0,1,0]:[1,0,0],basis=norm(cross(axis,ref)),second=norm(cross(axis,basis));
  const rings=[];
  for(const pos of [a,b]){
   const ring=[];for(let k=0;k<seg;k++){
    const t=2*pi*k/seg;ring.push(add3(pos,add3(mul(basis,Math.cos(t)*r),mul(second,Math.sin(t)*r))));
   }rings.push(ring);
  }
  for(let j=0;j<seg;j++)quad(m,rings[0][j],rings[0][(j+1)%seg],rings[1][(j+1)%seg],rings[1][j]);
  for(let j=0;j<seg;j++){tri(m,a,rings[0][j],rings[0][(j+1)%seg]);tri(m,b,rings[1][(j+1)%seg],rings[1][j])}
 }
 function pathTube(m,pts,r=.011,seg=9){for(let i=1;i<pts.length;i++)cylinderBetween(m,pts[i-1],pts[i],r,seg)}
 function box(m,x,y,z,w,h,d){
  const a=[x-w/2,y-h/2,z-d/2],b=[x+w/2,y+h/2,z+d/2];
  const v=[[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],b[1],a[2]],[a[0],b[1],a[2]],
   [a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]];
  for(const q of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])quad(m,...q.map(i=>v[i]));
 }
 function outlinePlate(m,side,x,points,width=.025){
  const xf=x*side; // The plate contour is authored in (longitudinal z, vertical y).
  const back=(x-width)*side;
  const ring=points.map(([z,y])=>[xf,y,z]),lower=points.map(([z,y])=>[back,y,z]);
  // All contours here are intentionally convex. Fan caps for light-weight UV-able polygons.
  for(let i=1;i<points.length-1;i++){
   tri(m,ring[0],ring[i],ring[i+1]);tri(m,lower[0],lower[i+1],lower[i]);
  }
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length;quad(m,ring[i],lower[i],lower[j],ring[j])}
 }
 function torusZ(m,rx,ry,t,center,seg=32,rings=7){
  const [cx,cy,cz]=center;
  const points=[];
  for(let i=0;i<seg;i++){
   const a=i*2*pi/seg,cs=Math.cos(a),sn=Math.sin(a),ring=[];
   for(let j=0;j<rings;j++){
    const b=j*2*pi/rings,rr=t*Math.cos(b),ax=t*Math.sin(b);
    ring.push([cx+(rx+rr)*cs,cy+(ry+rr)*sn,cz+ax]);
   }points.push(ring);
  }
  for(let i=0;i<seg;i++)for(let j=0;j<rings;j++){
   const ni=(i+1)%seg,nj=(j+1)%rings;
   quad(m,points[i][j],points[ni][j],points[ni][nj],points[i][nj]);
  }
 }
 function torusY(m,r,t,y,seg=40,rings=7){
  const pts=[];for(let i=0;i<seg;i++){
   const a=i*2*pi/seg,row=[];
   for(let j=0;j<rings;j++){
    const b=j*2*pi/rings,rr=r+t*Math.cos(b);
    row.push([rr*Math.cos(a),y+t*Math.sin(b),rr*Math.sin(a)]);
   }pts.push(row);
  }
  for(let i=0;i<seg;i++)for(let j=0;j<rings;j++){
   const ni=(i+1)%seg,nj=(j+1)%rings;quad(m,pts[i][j],pts[ni][j],pts[ni][nj],pts[i][nj]);
  }
 }
 // 1. HERO SILHOUETTE: uninterrupted tapered carbon-fiber ceramic chassis.
 const main=add("01 / Monocoque silhouette - original digital game artwork",0);
 loft(main,[
  {z:.63,w:.134,h:.130,y:.17},{z:.44,w:.218,h:.165,y:.183},
  {z:.17,w:.286,h:.184,y:.19},{z:-.17,w:.314,h:.202,y:.183},
  {z:-.60,w:.321,h:.204,y:.187},{z:-1.08,w:.304,h:.188,y:.200},
  {z:-1.48,w:.280,h:.169,y:.209},{z:-1.91,w:.243,h:.145,y:.205},
  {z:-2.23,w:.165,h:.125,y:.192},{z:-2.51,w:.105,h:.090,y:.179},
  {z:-2.62,w:.063,h:.064,y:.180}
 ],18,.68);
 const top=add("02 / Continuous machined dorsal blade",1);
 loft(top,[
  {z:.59,w:.082,h:.044,y:.310},{z:.12,w:.159,h:.071,y:.385},
  {z:-.53,w:.166,h:.070,y:.410},{z:-1.15,w:.135,h:.068,y:.401},
  {z:-1.80,w:.103,h:.060,y:.361},{z:-2.40,w:.039,h:.023,y:.271}
 ],16,.56);
 const spine=add("03 / Single photonic dorsal seam",4);
 pathTube(spine,[[0,.432,.37],[0,.460,-.02],[0,.493,-.55],
  [0,.477,-1.14],[0,.426,-1.75],[0,.362,-2.30]],.008,9);
 // 2. FLOATING, FACETED EXTERIOR: recognizable 3/4 view.
 for(const side of [-1,1]){
  const sh=add((side<0?"L":"R")+" / Broad titanium cheek plate",1);
  outlinePlate(sh,side,.348,[[-1.09,.292],[-.65,.337],[-.12,.311],
   [.35,.220],[.43,.145],[.27,.049],[-.32,.023],[-.93,.092]],.035);
  const inlay=add((side<0?"L":"R")+" / Recessed charcoal channel",3);
  outlinePlate(inlay,side,.393,[[-.78,.251],[-.44,.279],[-.10,.245],
   [-.21,.181],[-.64,.166]],.008);
  const highlight=add((side<0?"L":"R")+" / Satin silver crest",6);
  outlinePlate(highlight,side,.409,[[-.77,.257],[-.47,.297],[-.18,.274],[-.37,.234]],.016);
  const belly=add((side<0?"L":"R")+" / Lower textured support",2);
  outlinePlate(belly,side,.334,[[-.90,-.022],[-.26,-.060],
   [.19,-.155],[.35,-.107],[.21,-.019],[-.27,.026]],.024);
  const light=add((side<0?"L":"R")+" / Tracer under armor",4);
  pathTube(light,[[side*.409,.074,-.95],[side*.420,.048,-.70],
   [side*.421,.035,-.38],[side*.412,.063,.03]],.008,8);
  const marks=add((side<0?"L":"R")+" / Three warm identification marks",8);
  for(let k=0;k<3;k++)box(marks,side*.420,.287,-.62+k*.13,.009,.024,.045);
 }
 // 3. HOLLOW SPACE and engineered negative silhouette on futuristic forebody.
 for(const side of [-1,1]){
  const wing=add((side<0?"L":"R")+" / Floating aero fin and bridges",9);
  outlinePlate(wing,side,.272,[[-2.42,.190],[-2.22,.342],
    [-1.86,.355],[-1.58,.307],[-1.62,.236],[-2.13,.110]],.050);
  const voids=add((side<0?"L":"R")+" / Three open shadowed slits",3);
  for(let k=0;k<3;k++){
   const z=-2.24+k*.17;
   box(voids,side*.330,.229,z,.012,.020,.092);
  }
  const ventGlow=add((side<0?"L":"R")+" / Four cyan inlet markers",4);
  for(let k=0;k<4;k++)box(ventGlow,side*.338,.287,-2.32+k*.14,.009,.019,.032);
  const crown=add((side<0?"L":"R")+" / Forward edge trim",6);
  pathTube(crown,[[side*.274,.342,-2.20],[side*.276,.351,-1.88],
   [side*.273,.323,-1.60]],.015,8);
 }
 // 4. FANTASTICAL RADIANT FRONT — decorative energy emitter, not a mechanical tube.
 const luminous=add("07 / Faceted radiant emitter",4);
 loft(luminous,[{z:-2.40,y:.190,w:.105,h:.105},
  {z:-2.60,y:.190,w:.085,h:.085},{z:-2.76,y:.19,w:.043,h:.043},
  {z:-2.83,y:.19,w:.007,h:.007}],16,.92);
 const collar=add("08 / Translucent emitter light rings",5);
 for(let z of [-2.43,-2.56,-2.66])torusZ(collar,.104,.106,.011,[0,.19,z],36,7);
 const fan=add("09 / Four floating front stabilizing vanes",1);
 for(const side of [-1,1])for(const h of [-1,1]){
  outlinePlate(fan,side,.145,[[-2.53,.20+h*.072],[-2.46,.20+h*.105],
   [-2.31,.20+h*.104],[-2.35,.20+h*.072]],.025);
 }
 // 5. OPEN-CANTILEVER REAR, clearly hollow and sculptural.
 for(const side of [-1,1]){
  const rear=add((side<0?"L":"R")+" / One-piece rear alloy arch",0);
  loft(rear,[
   {z:.41,x:side*.225,y:.275,w:.052,h:.044},
   {z:.72,x:side*.239,y:.302,w:.068,h:.058},
   {z:1.10,x:side*.249,y:.302,w:.072,h:.052},
   {z:1.45,x:side*.250,y:.261,w:.059,h:.040},
   {z:1.65,x:side*.243,y:.199,w:.045,h:.034}
  ],12,.62);
  const openBeam=add((side<0?"L":"R")+" / Diagonal open strut",1);
  pathTube(openBeam,[[side*.23,.116,.48],[side*.245,.058,.92],
   [side*.255,.055,1.24],[side*.254,.171,1.65]],.027,8);
  const led=add((side<0?"L":"R")+" / Continuous rear cyan fiber",4);
  pathTube(led,[[side*.259,.356,.78],[side*.261,.367,1.09],
   [side*.265,.316,1.42]],.007,8);
 }
 const butt=add("12 / Polymer rear pad",7);
 loft(butt,[{z:1.60,y:.207,w:.252,h:.166},
  {z:1.70,y:.203,w:.270,h:.168},
  {z:1.78,y:.201,w:.266,h:.159}],14,.63);
 const cuff=add("12A / Rear satin frame",6);
 torusZ(cuff,.274,.165,.012,[0,.203,1.75],36,7);
 // 6. Stylized, clearly fictional grip and lower armor design.
 const handle=add("13 / Ergonomic graphite handgrip",7);
 loft(handle,[
  {z:.40,y:-.18,w:.151,h:.070},
  {z:.47,y:-.36,w:.166,h:.107},
  {z:.62,y:-.61,w:.162,h:.155},
  {z:.69,y:-.78,w:.149,h:.093}
 ],14,.61);
 const gripRidges=add("14 / Grip diagonal satin rib texture",2);
 for(const side of [-1,1])for(let k=0;k<9;k++){
  box(gripRidges,side*.165,-.48-k*.033,.46+k*.027,.010,.015,.081);
 }
 // 7. An illuminated prismatic energy capsule and supporting cradle.
 const module=add("15 / Deep prismatic core",4);
 loft(module,[
  {z:-.53,y:-.205,w:.045,h:.130},
  {z:-.32,y:-.205,w:.134,h:.176},
  {z:.07,y:-.205,w:.139,h:.178},
  {z:.28,y:-.205,w:.048,h:.139}
 ],16,.86);
 const glass=add("16 / Double floating glass shells",5);
 for(const side of [-1,1]){
  loft(glass,[
   {z:-.36,x:side*.160,y:-.202,w:.021,h:.156},
   {z:.08,x:side*.161,y:-.196,w:.026,h:.171},
   {z:.28,x:side*.151,y:-.193,w:.020,h:.126}
  ],10,.72);
 }
 const coreTrim=add("17 / Core brace cradle",1);
 for(const side of [-1,1]){
  pathTube(coreTrim,[[side*.165,-.074,.29],[side*.193,-.28,.18],
   [side*.192,-.37,-.04],[side*.166,-.10,-.43]],.025,9);
 }
 const smallLight=add("18 / Stripes within the prismatic energy capsule",4);
 for(let k=0;k<5;k++)box(smallLight,0,-.20,-.28+k*.11,.232,.024,.028);
 const arc=add("19 / Hollow photonic emblem rings",4);
 torusZ(arc,.085,.085,.013,[0,-.206,-.475],32,8);
 // 8. Low-profile fictional holographic visor integrated in upper contour.
 const optic=add("20 / Integrated optic crown",1);
 loft(optic,[{z:-.77,y:.465,w:.185,h:.042},
  {z:-.60,y:.489,w:.203,h:.062},
  {z:-.30,y:.49,w:.191,h:.057},{z:-.18,y:.466,w:.165,h:.040}],12,.58);
 for(const side of [-1,1]){
  const arms=add((side<0?"L":"R")+" / Floating visor cheek",0);
  outlinePlate(arms,side,.192,[[-.60,.466],[-.51,.626],
    [-.34,.640],[-.27,.511]],.025);
 }
 const opticGlass=add("21 / Floating holographic optic pane",5);
 box(opticGlass,0,.546,-.624,.326,.170,.024);
 const opticRings=add("22 / Elegant luminous optic reticle",4);
 torusZ(opticRings,.061,.061,.006,[0,.551,-.651],32,7);
 const arch=add("23 / Upper ribbon",6);
 pathTube(arch,[[-.193,.573,-.64],[-.192,.662,-.54],
   [0,.679,-.49],[.192,.662,-.54],[.193,.573,-.64]],.014,8);
 // 9. Textureless detail expressed through authored geometry, not runtime JS.
 const fins=add("24 / Top dorsal micro-grooves",3);
 for(let k=0;k<12;k++)box(fins,0,.484,-1.85+k*.118,.143,.013,.031);
 const bolts=add("25 / 48 low-relief alloy rivets",6);
 for(const side of [-1,1]){
  for(let k=0;k<12;k++){
   const z=-2.31+k*.19;
   box(bolts,side*(z< -1.50?.278:.355),.267,z,.009,.012,.012);
  }
  for(let k=0;k<12;k++){
   const z=.67+k*.083;
   box(bolts,side*.249,.288,z,.008,.009,.008);
  }
 }
 const stencil=add("26 / Signature SPECTER glyphs",4);
 // Art-deco linework on either cheek, with a rounded slash emblem.
 for(const side of [-1,1]){
  for(let k=0;k<3;k++)pathTube(stencil,[
   [side*.423,.142,-.22+k*.075],
   [side*.424,.187,-.26+k*.075],
   [side*.425,.189,-.31+k*.075]],.006,5);
 }
 // 10. Export triangles into GLB 2.0, retaining material names and UV channels.
 const buffer=[],bufferViews=[],accessors=[],exportedMeshes=[],nodes=[];
 const minMax3=a=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<a.length;i+=3)for(let j=0;j<3;j++){
   lo[j]=Math.min(lo[j],a[i+j]);hi[j]=Math.max(hi[j],a[i+j]);
  }return {lo,hi};};
 const view=(data,target)=>{
  while(buffer.length%4)buffer.push(0);const offset=buffer.length;
  for(const v of data)buffer.push(v);
  bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target});
  return bufferViews.length-1;
 };
 const numArray=(arr,type)=>{
  const bytes=new Uint8Array(arr.length*4),dv=new DataView(bytes.buffer);
  arr.forEach((value,i)=>type===5126?dv.setFloat32(i*4,value,true):dv.setUint32(i*4,value,true));
  return bytes;
 };
 const accessor=(values,type,size,componentType,target,minmax=false)=>{
  const idx=view(numArray(values,componentType),target);
  const a={bufferView:idx,componentType,count:values.length/size,type};
  if(minmax){const t=minMax3(values);a.min=t.lo;a.max=t.hi}
  accessors.push(a);return accessors.length-1;
 };
 let tris=0,vertices=0;
 for(const mesh of meshes){
  if(!mesh.idx.length)continue;
  const p=accessor(mesh.p,"VEC3",3,5126,34962,true);
  const n=accessor(mesh.n,"VEC3",3,5126,34962);
  const u=accessor(mesh.u,"VEC2",2,5126,34962);
  const idx=accessor(mesh.idx,"SCALAR",1,5125,34963);
  const mi=exportedMeshes.length;
  exportedMeshes.push({name:mesh.name,primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:u},indices:idx,material:mesh.mat,mode:4}]});
  nodes.push({name:mesh.name,mesh:mi});
  tris+=mesh.idx.length/3;vertices+=mesh.p.length/3;
 }
 while(buffer.length%4)buffer.push(0);
 const gltf={asset:{version:"2.0",generator:"CROSSFire / Specter custom GLB art pipeline"},
  extensionsUsed:["KHR_materials_clearcoat"],scene:0,scenes:[{name:"SPECTER / original game art",nodes:nodes.map((_,i)=>i)}],
  nodes,meshes:exportedMeshes,materials,
  buffers:[{byteLength:buffer.length}],bufferViews,accessors,
  extras:{asset:"AETHER-9 SPECTER",intendedUse:"fictional digital game art",
    editableIn:"Blender",pipeline:"glTF 2.0",version:"asset-pipeline-1"}};
 const ascii=st=>{const arr=[];for(let i=0;i<st.length;i++){const n=st.charCodeAt(i);if(n>127)throw Error("Non-ASCII JSON");arr.push(n)}return arr};
 let json=ascii(JSON.stringify(gltf));while(json.length%4)json.push(32);
 const glb=new Uint8Array(12+8+json.length+8+buffer.length);
 const data=new DataView(glb.buffer);let o=0;
 const u32=v=>{data.setUint32(o,v,true);o+=4};
 u32(0x46546c67);u32(2);u32(glb.length);
 u32(json.length);u32(0x4e4f534a);
 glb.set(json,o);o+=json.length;
 u32(buffer.length);u32(0x004e4942);glb.set(buffer,o);o+=buffer.length;
 if(o!==glb.length)throw Error("GLB length mismatch");
 if(exportedMeshes.length<40||tris<5000||vertices<12000)throw Error("Model too simple");
 for(const a of accessors)if(a.count<=0)throw Error("Empty geometry");
 return {glb,gltf,stats:{asset:"AETHER-9 Specter",meshes:exportedMeshes.length,materials:materials.length,vertices,
  triangles:tris,bytes:glb.length,uv:true,normals:true,format:"GLB 2.0",head:[...glb.slice(0,12)]}};
}
