import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page=read('../static/workshop.html');
const js=read('../static/workshop.js');
const compare=read('../static/workshop-comparison.js');
const catalog=read('../static/workshop-library.js');
const blender=read('../tools/blender_lantern_stage2.py');
for (const id of [
 'openComparison','comparisonBay','comparisonCanvas','comparisonAssetA','comparisonAssetB',
 'comparisonProfileA','comparisonProfileB','comparisonClose','comparisonReset',
 'comparisonExport','comparisonStatusA','comparisonStatusB','comparisonStatsA','comparisonStatsB',
 'comparisonFps','comparisonDelta'
]) assert.ok(page.includes('id="'+id+'"'),'Missing comparison UI: '+id);
assert.ok(js.includes("import('./workshop-comparison.js')"));
assert.ok(compare.includes('renderer.setScissorTest(true)'), 'Two split views required');
assert.ok(compare.includes('renderer.setViewport(x,0,width,h)'), 'Viewport split missing');
assert.ok(compare.includes('const orbit={'), 'Shared camera state required');
assert.ok(compare.includes('getPersonalAsset('), 'Personal GLB compare missing');
assert.ok(compare.includes('readAssetBytes('), 'Repository asset compare missing');
assert.ok(compare.includes('sourceDimensions:'), 'Keep original dimensions in stats');
assert.ok(compare.includes('dispose(side)'), 'Clean GPU assets');
assert.ok(!compare.includes('WebSocket(') && !compare.includes('/api/rooms'));
assert.ok(catalog.includes("'industrial-lantern'"));
assert.ok(!page.includes('GET OFFICIAL SOURCE GLB'), 'Retired Lantern feature must not clutter the Workshop');
assert.ok(page.includes('id="modeParts"'), 'Component inspection should be visible');
assert.ok(blender.includes('bpy.ops.import_scene.gltf('));
assert.ok(blender.includes('bpy.ops.wm.save_as_mainfile('));
assert.ok(blender.includes('bpy.ops.export_scene.gltf('));
assert.ok(blender.includes('blob_sha(data) != GIT_BLOB'));
console.log('PASS: Phase 2 Stage 2 comparison and Blender source validation.');
