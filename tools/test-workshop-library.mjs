import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WORKSHOP_CATALOG,matchCatalog,personalToEntry,validateGLBHeader,validatePersonalGLB,PERSONAL_MAX_BYTES} from '../static/workshop-library.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const get=p=>readFileSync(path.join(root,p),'utf8');
const html=get('static/workshop.html'),workshop=get('static/workshop.js'),ui=get('static/workshop-library-ui.js');
assert.equal(WORKSHOP_CATALOG.length,13);
assert.ok(WORKSHOP_CATALOG.some(x=>x.id==='s12-v04'&&x.status==='In game'));
assert.ok(!WORKSHOP_CATALOG.some(x=>x.id==='l7-native'));
assert.ok(WORKSHOP_CATALOG.some(x=>x.id==='awp01-v03'&&x.status==='In game'&&x.profiles.length===1));
assert.ok(WORKSHOP_CATALOG.find(x=>x.id==='awp01-v03').title.includes('v0.3 ORIGINAL'));
assert.equal(WORKSHOP_CATALOG.find(x=>x.id==='awp01-v03').profiles[0].bytes,4682872);
const art10=WORKSHOP_CATALOG.find(x=>x.id==='awp01-v10');
assert.ok(art10&&art10.status==='Workshop preview'&&art10.profiles.length===2);
const perf10=art10.profiles.find(p=>p.id==='PERFORMANCE');
const hero10=art10.profiles.find(p=>p.id==='HERO');
assert.equal(perf10.bytes,1576912);
assert.equal(hero10.bytes,3674152);
assert.equal(hero10.type,'split');
assert.equal(hero10.parts.length,3);
const perf10Buffer=readFileSync(path.join(root,perf10.url.slice(1)));
assert.equal(createHash('sha256').update(perf10Buffer).digest('hex'),'86494775b34af5f69a6df685a587f5405eb78027656984804f25eef48d266203');
const hero10Buffer=Buffer.concat(hero10.parts.map(p=>readFileSync(path.join(root,p.slice(1)))));
assert.equal(hero10Buffer.length,hero10.bytes);
assert.equal(createHash('sha256').update(hero10Buffer).digest('hex'),'5557f8625c242e8047979a28e155528a4a016baef8b35a48ae3d9a986a2ba076');
assert.equal(hero10Buffer.subarray(0,4).toString('ascii'),'glTF');
assert.equal(hero10Buffer.readUInt32LE(8),hero10Buffer.length);
assert.equal(workshop.includes('readSplitAssetBytes(profile.parts'),true);



assert.ok(WORKSHOP_CATALOG.some(x=>x.id==='fox-reference'&&x.profiles.length===2));
for(const entry of WORKSHOP_CATALOG)for(const p of entry.profiles){
 if(p.url)assert.ok(existsSync(path.join(root,p.url.slice(1))),`Missing repo asset: ${p.url}`);
 assert.ok(Number.isInteger(p.bytes)&&p.bytes>0,`Unverified asset size: ${entry.title}`);
}
// The AWP model must remain byte-for-byte identical to the recovered original artwork.
const awpPath=path.join(root,'static/assets/CROSSFIRE_AWP_ReferenceInspired_v03.glb');
const awpBytes=readFileSync(awpPath);
const awpDataView=new DataView(awpBytes.buffer,awpBytes.byteOffset,awpBytes.byteLength);
assert.equal(awpBytes.length,4682872,'AWP original bytes changed');
assert.equal(awpDataView.getUint32(0,true),0x46546c67,'AWP is not a GLB');
assert.equal(awpDataView.getUint32(8,true),awpBytes.length,'AWP GLB size mismatch');
const awpChunkLength=awpDataView.getUint32(12,true);
const awpDoc=JSON.parse(awpBytes.subarray(20,20+awpChunkLength).toString('utf8'));
assert.equal(awpDoc.meshes.length,396,'AWP original mesh count changed');
assert.equal(awpDoc.materials.length,23,'AWP original material count changed');
assert.equal(awpDoc.images.length,59,'AWP original embedded image count changed');
assert.equal(createHash('sha256').update(awpBytes).digest('hex'),
 'a227f177bc1d5398ec5919aaf537a8a29ab48a2c10b9c9c51b73b74366351b4b',
 'AWP original model checksum changed');

assert.ok(matchCatalog(WORKSHOP_CATALOG,{query:'glacier'}).some(x=>x.id==='specter-glacier'));
assert.ok(matchCatalog(WORKSHOP_CATALOG,{category:'production'}).every(x=>x.category==='production'));
assert.ok(matchCatalog(WORKSHOP_CATALOG,{query:'nonsense-no-asset'}).length===0);
const personal=personalToEntry({id:'personal-1',name:'My Test.glb',size:28000});
assert.equal(personal.profiles[0].type,'local');
assert.equal(personal.category,'personal');
const hdr=new ArrayBuffer(12),view=new DataView(hdr);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,128,true);
assert.equal(validateGLBHeader(hdr,128),true);
assert.throws(()=>validateGLBHeader(hdr,129),/complete/);
assert.throws(()=>validateGLBHeader(new ArrayBuffer(5),128),/Invalid/);
const good={name:'test.glb',size:128,slice:()=>({arrayBuffer:async()=>hdr})};
await validatePersonalGLB(good);
await assert.rejects(validatePersonalGLB({...good,name:'test.exe'}),/\.glb/);
await assert.rejects(validatePersonalGLB({...good,size:PERSONAL_MAX_BYTES+1}),/30 MB/);
for(const id of ['modeWall','mode360','modeParts','partTools','partList','spread','savedImports','downloadAsset','importAsset','quality','workbench','stress','file','fps','benchmark','measure'])assert.ok(html.includes(`id="${id}"`),`Missing UI ${id}`);
assert.ok(workshop.includes("from './workshop-library.js'"));
assert.ok(workshop.includes("from './workshop-wall-racks.js'"));
assert.ok(workshop.includes("from './workshop-component-inspector.js'"));
assert.ok(workshop.includes('savePersonalAsset('));
assert.ok(workshop.includes('readAssetBytes('));
assert.ok(workshop.includes('getPersonalAsset('));
assert.ok(ui.includes('removePersonalAsset(')); // The older Library module stays available for migration.
assert.ok(!workshop.includes('new WebSocket('));
assert.ok(!workshop.includes("fetch('/api/rooms"));
console.log('PASS workshop asset library: 13 catalog entries, repository file existence, GLB validation, search/filter, UI, personal storage and multiplayer isolation');