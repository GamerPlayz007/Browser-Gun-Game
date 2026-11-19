/**
 * CROSSFire — Weapon Visuals 2.1
 * Purely visual, stylized 3D viewmodels: no weapon stats or hit detection.
 * Four custom silhouettes; low-cost base meshes + instanced detail by quality.
 */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const palettes=[
 {shell:0x303e48,poly:0x202b34,metal:0x85949b,accent:0xe9b864,trim:0x151f27},
 {shell:0x2c3b43,poly:0x1c2931,metal:0x7e9495,accent:0x50ddc6,trim:0x14232c},
 {shell:0x42464b,poly:0x292c30,metal:0x9b9490,accent:0xd6946d,trim:0x1f242a},
 {shell:0x333c47,poly:0x212a36,metal:0x9aa9b5,accent:0xb7b4ea,trim:0x141e29}
];
const surfaces=new Map();
function finish(color,roughness=.68,metalness=.22){
 const key=color+':'+roughness+':'+metalness;
 if(!surfaces.has(key))surfaces.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));
 return surfaces.get(key);
}
function slab(parent,w,h,d,color,x,y,z,r=.012){
 const geometry=r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d);
 const mesh=new T.Mesh(geometry,finish(color));
 mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
// Draw a side silhouette in (forward, height) and extrude it sideways.
// Positive forward faces -Z in the first-person camera.
function contour(parent,outline,width,color){
 const shape=new T.Shape();
 for(let i=0;i<outline.length;i++){
  const [forward,height]=outline[i];
  if(!i)shape.moveTo(forward,height);else shape.lineTo(forward,height);
 }
 shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth:width,steps:1,bevelEnabled:true,
  bevelThickness:.006,bevelSize:.006,bevelSegments:1,curveSegments:1});
 geometry.translate(0,0,-width/2);geometry.rotateY(Math.PI/2);
 const mesh=new T.Mesh(geometry,finish(color));
 parent.add(mesh);return mesh;
}
function tube(parent,radius,length,color,x,y,z,segments=12){
 const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,length,segments,1),
  finish(color,.38,.65));
 mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function ring(parent,radius,thickness,color,x,y,z){
 const mesh=new T.Mesh(new T.TorusGeometry(radius,thickness,6,24),finish(color,.36,.65));
 mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function arrayDetail(parent,color,tier,items){
 const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),finish(color),items.length);
 const dummy=new T.Object3D();
 for(let i=0;i<items.length;i++){
  const [x,y,z,w,h,d,tilt=0]=items[i];
  dummy.position.set(x,y,z);dummy.rotation.set(0,0,tilt);dummy.scale.set(w,h,d);
  dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;
 mesh.userData.detailTier67=tier;mesh.userData.collidable=false;parent.add(mesh);
 return mesh;
}
function grip(parent,c,z=-.14){
 const handle=slab(parent,.087,.19,.102,c,0,-.138,z,.017);
 handle.rotation.x=-.24;
 slab(parent,.098,.02,.107,0x121d24,0,-.227,z+.025,.005);
}
function magazineBlock(group,c,style='standard'){
 const length=style==='smg'?.195:style==='sniper'?.11:.235;
 const w=style==='smg'?.077:.095;
 const mag=slab(group,w,length,.11,c,0,-.095,0,.012);
 mag.rotation.x=style==='smg'?.18:.10;
 slab(group,w+.008,.024,.12,0x7f9297,0,-.095-length*.48,.014,.005);
}
function topRail(parent,color,a,b,y){
 slab(parent,.105,.018,b-a,color,0,y,-(a+b)/2,.003);
 const items=[];
 for(let u=a+.02;u<b-.01;u+=.039)items.push([0,y+.011,-u,.099,.009,.011]);
 if(items.length)arrayDetail(parent,0x111b22,1,items);
}
function redDot(parent,y=.145){
 // Keep the sight center at camera height during ADS (root offset = -0.145).
 slab(parent,.094,.018,.115,0x18232b,0,y-.066,-.105,.005);
 slab(parent,.015,.062,.028,0x667980,-.040,y-.032,-.105,.003);
 slab(parent,.015,.062,.028,0x667980,.040,y-.032,-.105,.003);
 ring(parent,.046,.007,0x1b2831,0,y,-.114);
 const lens=new T.Mesh(new T.CircleGeometry(.038,24),
  new T.MeshBasicMaterial({color:0x92e2f2,transparent:true,opacity:.08,
   depthWrite:false,side:T.DoubleSide}));
 lens.position.set(0,y,-.116);parent.add(lens);
}
function ironSights(parent,foreU){
 // Shotgun: a U-shaped rear notch and a pale front bead, no illuminated reticle.
 slab(parent,.117,.013,.035,0x859099,0,.12,.11,.004);
 slab(parent,.016,.062,.026,0x1c252d,-.050,.151,.11,.003);
 slab(parent,.016,.062,.026,0x1c252d,.050,.151,.11,.003);
 slab(parent,.023,.055,.022,0x1a2229,0,.119,-foreU,.003);
 const bead=new T.Mesh(new T.SphereGeometry(.010,8,6),
  new T.MeshBasicMaterial({color:0xf0e3c7}));
 bead.position.set(0,.153,-foreU);parent.add(bead);
}
function originalSniperScope(parent){
 // Retain CROSSFire's existing sniper tube and teal lens coordinates.
 tube(parent,.062,.25,0x17252b,0,.17,-.01);
 tube(parent,.05,.008,0x5abbb9,0,.17,.12);
 slab(parent,.045,.08,.09,0x667b7e,0,.10,0,.008);
 ring(parent,.065,.012,0x151e28,0,.17,.12);
 ring(parent,.065,.012,0x687b86,0,.17,-.125);
}
function rifle(body,magazine,p,action){
 // VANGUARD: angular receiver, split buttstock, free-floating handguard.
 contour(body,[[-.25,-.046],[-.20,.035],[-.09,.097],[.095,.106],
  [.19,.045],[.185,-.040],[.048,-.095],[-.17,-.094]],.154,p.shell);
 contour(body,[[.155,-.018],[.22,.071],[.47,.077],[.53,.030],
  [.52,-.034],[.34,-.058],[.18,-.067]],.128,p.poly);
 contour(body,[[-.22,-.040],[-.39,.001],[-.44,.038],[-.38,.072],
  [-.28,.035]],.105,p.trim);
 slab(body,.116,.095,.058,p.poly,0,-.027,.394,.018);
 slab(body,.146,.016,.37,p.metal,0,.077,-.33,.005);
 tube(body,.024,.33,p.metal,0,-.004,-.56);
 tube(body,.035,.052,p.trim,0,-.004,-.735);
 ring(body,.031,.006,p.metal,0,-.004,-.74);
 grip(body,p.poly,.132);
 magazineBlock(magazine,p.poly);
 topRail(body,p.trim,-.02,.46,.121);
 redDot(body);
 arrayDetail(body,p.metal,1,[[-.067,.009,-.30,.009,.031,.20],
  [.067,.009,-.30,.009,.031,.20],[-.078,.01,-.04,.008,.054,.13],
  [.078,.01,-.04,.008,.054,.13],[.078,.049,.15,.009,.02,.067]]);
 arrayDetail(body,p.accent,1,[[.078,.029,-.18,.008,.011,.19],
  [-.078,.029,-.18,.008,.011,.19],[.076,-.047,-.05,.009,.012,.063]]);
 arrayDetail(body,p.trim,2,Array.from({length:7},(_,i)=>[
  .069,.013,-.24-i*.038,.012,.022,.016]));
 action.bolt=slab(body,.018,.027,.105,p.metal,.084,.028,.035,.004);
 return -.76;
}
function smg(body,magazine,p,action){
 // SHIFT: stepped compact receiver, short front, slim folding stock.
 contour(body,[[-.20,-.056],[-.18,.061],[-.095,.091],
  [.29,.081],[.385,.028],[.325,-.063],[.10,-.085],[-.13,-.094]],.144,p.shell);
 contour(body,[[.12,-.036],[.175,.062],[.352,.054],
  [.40,-.009],[.38,-.045]],.151,p.poly);
 contour(body,[[-.21,.005],[-.36,.032],[-.39,.015],[-.27,-.038]],.085,p.metal);
 slab(body,.133,.07,.051,p.poly,0,-.042,.367,.012);
 tube(body,.032,.20,p.metal,0,.001,-.43);
 tube(body,.041,.059,p.trim,0,.001,-.549);
 grip(body,p.poly,.073);
 magazineBlock(magazine,p.poly,'smg');
 topRail(body,p.trim,.02,.30,.119);
 redDot(body);
 arrayDetail(body,p.accent,1,[[.075,.035,-.205,.009,.012,.16],
  [-.075,.035,-.205,.009,.012,.16],[.078,-.035,-.095,.008,.012,.062]]);
 arrayDetail(body,p.trim,1,[[.081,.01,-.24,.008,.032,.076],
  [-.081,.01,-.24,.008,.032,.076],
  [.076,.037,.09,.006,.038,.050]]);
 arrayDetail(body,p.metal,2,Array.from({length:5},(_,i)=>[
  -.078,.034,-.11-i*.044,.006,.013,.013]));
 action.bolt=slab(body,.017,.027,.068,p.metal,.085,.037,-.065,.003);
 return -.58;
}
function shotgun(body,magazine,p,action){
 // BREACH: heavier rear, sculpted pump, distinctive parallel front tubes.
 contour(body,[[-.29,-.075],[-.26,.050],[-.16,.081],
  [.13,.086],[.21,.035],[.195,-.084],[-.10,-.094]],.174,p.shell);
 contour(body,[[.18,-.031],[.22,.052],[.52,.056],
  [.56,-.005],[.53,-.064],[.27,-.074]],.154,p.poly);
 contour(body,[[-.275,-.030],[-.41,-.005],[-.46,.048],
  [-.40,.076],[-.31,.034]],.130,p.trim);
 slab(body,.136,.10,.055,p.poly,0,-.039,.395,.012);
 tube(body,.047,.59,p.metal,0,.010,-.483,14);
 tube(body,.031,.51,p.trim,0,-.082,-.453,12);
 const pump=new T.Group();body.add(pump);
 contour(pump,[[.29,-.09],[.33,-.025],[.49,-.025],
  [.55,-.080],[.48,-.126],[.33,-.125]],.178,p.shell);
 action.pump=pump;
 arrayDetail(pump,p.accent,1,[
  [-.09,-.081,-.38,.007,.046,.085],[.09,-.081,-.38,.007,.046,.085]]);
 grip(body,p.poly,.160);
 topRail(body,p.trim,-.02,.18,.115);
 ironSights(body,.65);
 // The shotgun uses a built-in tubular profile rather than a detachable box mag.
 arrayDetail(body,p.metal,1,[[-.093,.031,.05,.010,.042,.08],
  [.093,.031,.05,.010,.042,.08],[.091,-.02,.015,.009,.045,.05]]);
 arrayDetail(body,p.accent,2,Array.from({length:5},(_,i)=>[
  -.09,-.08,-.34-i*.036,.008,.028,.014]));
 return -.79;
}
function sniper(body,magazine,p,action){
 // LANCER: long tapered chassis, precise narrow handguard, original optic.
 contour(body,[[-.29,-.06],[-.23,.048],[-.13,.086],
  [.22,.096],[.34,.045],[.29,-.058],[.07,-.108],[-.18,-.091]],.159,p.shell);
 contour(body,[[.275,-.028],[.36,.058],[.55,.060],[.62,.019],
  [.59,-.045],[.40,-.063]],.111,p.poly);
 contour(body,[[-.275,-.040],[-.45,-.045],[-.48,.025],
  [-.39,.069],[-.29,.029]],.115,p.trim);
 slab(body,.12,.11,.061,p.poly,0,-.035,.445,.013);
 tube(body,.026,.60,p.metal,0,.012,-.72);
 tube(body,.043,.08,p.trim,0,.012,-1.035);
 ring(body,.038,.008,p.metal,0,.012,-1.055);
 grip(body,p.poly,.154);
 magazineBlock(magazine,p.poly,'sniper');
 topRail(body,p.trim,-.10,.34,.121);
 originalSniperScope(body);
 arrayDetail(body,p.metal,1,[[-.059,.004,-.46,.009,.031,.18],
  [.059,.004,-.46,.009,.031,.18],
  [.081,-.032,.12,.012,.025,.07]]);
 arrayDetail(body,p.accent,1,[[.085,.036,.15,.010,.012,.10],
  [-.085,.036,.15,.010,.012,.10]]);
 arrayDetail(body,p.trim,2,Array.from({length:6},(_,i)=>[
  .062,.008,-.35-i*.038,.010,.019,.012]));
 action.bolt=slab(body,.020,.031,.093,p.metal,.095,.036,.060,.004);
 return -1.07;
}
export function buildWeaponVisuals21(model,magazine,id){
 const palette=palettes[id]||palettes[0],action={};
 const muzzle=[rifle,smg,shotgun,sniper][id]?.(model,magazine,palette,action)??-.7;
 const flash=new T.Mesh(new T.OctahedronGeometry(.08,0),
  new T.MeshBasicMaterial({color:0xffe1a0}));
 flash.position.set(0,.015,muzzle);flash.scale.z=2;flash.visible=false;model.add(flash);
 return {flash,action};
}
