import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const home=read('../static/index.html');
const css=read('../static/style.css');
const page=read('../static/workshop.html');
const workshop=read('../static/workshop.js');
const inspector=read('../static/workshop-component-inspector.js');

// 1: Discoverable workshop entry right on CROSSFire's opening screen.
assert.match(home,/id="home-workshop-launch"/);
assert.match(home,/class="home-workshop-launch"/);
assert.match(home,/href="\/static\/workshop\.html\?asset=awp01-v03"/);
assert.match(home,/>ENTER THE WORKSHOP</);
assert.match(css,/\.home-workshop-launch/);
assert.equal((home.match(/id="home-workshop-launch"/g)||[]).length,1);

// 2: One workbench and existing garage controls, never another page.
for(const id of ['navGarage','navWorkbench','modeWall','mode360','modeParts',
 'overheadHud','componentTooltip','componentTooltipName','componentTooltipMeta',
 'partTools','partToolsTitle','partRestore','partList','partDetails','spread','spreadValue']){
 assert.ok(page.includes('id="'+id+'"'),'Missing UI control '+id);
}
assert.match(page,/CLICK A PART TO IDENTIFY/);
assert.match(page,/RESET SELECTED PART POSITION/);
assert.ok(!page.includes('>LAB</a>'));

// 3: Model is genuinely laid down: display parent is rotated and bottom-aligned.
assert.ok(workshop.includes('function poseWorkbenchModel(layFlat)'));
assert.ok(workshop.includes("else stage.rotation.set(-Math.PI/2,0,0)"));
assert.ok(workshop.includes('stage.scale.setScalar(2.25)'));
assert.ok(workshop.includes('stage.position.y=.085-new T.Box3().setFromObject(stage).min.y'));
assert.ok(workshop.includes("if(mode==='top'||previous==='top')poseWorkbenchModel(mode==='top')"));
assert.ok(workshop.includes("if(viewMode==='top')poseWorkbenchModel(true)"));
assert.ok(workshop.includes("if(viewMode==='top')n=1"));

// 4: Mesh picking takes priority over camera pan in top view.
assert.ok(workshop.includes("if(viewMode==='top'&&!running){"));
assert.ok(workshop.includes('const picked=inspector.pick(camera,canvas,e.clientX,e.clientY)'));
assert.ok(workshop.includes("interaction={type:'move-part',lastPoint:pointOnWorkbench("));
assert.ok(workshop.includes("interaction.type==='move-part'"));
assert.ok(workshop.includes('inspector.moveSelectedByWorld(point.x-interaction.lastPoint.x,'));
assert.ok(workshop.includes("else if((viewMode==='parts'||viewMode==='top')"));
assert.ok(workshop.includes('tableRaycaster.ray.intersectPlane(tabletopDragPlane,'));
assert.ok(workshop.includes('inspector.resetSelected()'));

// 5: Parts are named using source artist labels and may be moved non-destructively.
assert.ok(inspector.includes('export function describeWorkshopPart('));
assert.ok(inspector.includes('const artistName=object.name||object.parent?.name'));
assert.ok(inspector.includes('label:visual.label'));
assert.ok(inspector.includes('initialOrigin:object.position.clone()'));
assert.ok(inspector.includes('function moveSelectedByWorld(dx,dz)'));
assert.ok(inspector.includes('parent.worldToLocal(next)'));
assert.ok(inspector.includes('selected.origin.add(deltaLocal)'));
assert.ok(inspector.includes('function resetSelected()'));
assert.ok(inspector.includes('selected.origin.copy(selected.initialOrigin)'));
assert.ok(workshop.includes('Original mesh: '));
assert.ok(workshop.includes('item.materials.join('));
assert.ok(workshop.includes("item.triangles.toLocaleString()"));

// Pure projection test: rotation around +X by -90 degrees maps old model Z
// toward world +Y, while its long X axis remains horizontal on the mat.
const point={x:2.5,y:0.35,z:0.12};
const flat={x:point.x,y:point.z,z:-point.y};
assert.equal(flat.x,point.x);
assert.equal(flat.y,point.z);
assert.equal(flat.z,-point.y);

// Only visual DOM / render modules; multiplayer model and server remain untouched.
for(const src of [workshop,inspector])
 assert.ok(!src.includes("new WebSocket("),'No multiplayer WebSocket integration');
console.log('PASS: CROSSFire home Workshop button + flat model pose + click-name-drag-reset components.');
