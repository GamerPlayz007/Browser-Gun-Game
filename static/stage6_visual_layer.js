/**
 * CROSSFIRE Stage 6 — OPTIONAL instanced context renderer.
 *
 * This visual-only helper draws the extended 160m urban context without
 * registering collisions. It never changes the Stage 6 120m physical map.
 * If your existing world.js draws all map.decor, do NOT draw twice.
 * This module is not automatically plugged into the game.
 */
export function createStage6VisualLayer(THREE, map, quality='high') {
  const level={performance:0,high:1,ultra:2}[quality];
  if(level===undefined) throw new Error(`Invalid quality setting: ${quality}`);
  const entries=(map?.decor||[]).filter(b=>b.stage6VisualOnly && (b.stage6Tier||0)<=level);
  const groups=new Map();
  for (const b of entries) {
    const key=`${b.kind}:${b.style}:${b.urbanFamily||'none'}:tier${b.stage6Tier||0}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(b);
  }
  const sceneGroup=new THREE.Group();sceneGroup.name='stage6-visual-city-context';
  sceneGroup.userData.collidable=false;
  const geo=new THREE.BoxGeometry(1,1,1);
  const matrix=new THREE.Matrix4();
  const position=new THREE.Vector3();
  const quaternion=new THREE.Quaternion();
  const scale=new THREE.Vector3();
  const families={market:'#9c6584',industrial:'#778796',corporate:'#4b8da9',
                  transit:'#a99772',civic:'#74a6a1'};
  for(const [key,items] of groups){
    const sample=items[0];
    const color=families[sample.urbanFamily] || map?.palette?.[sample.style] || '#8293a4';
    const isGlass=sample.style==='glass';
    const material=new THREE.MeshStandardMaterial({
      color,roughness: isGlass ? 0.28 : 0.78, metalness: isGlass ? 0.18 : 0.08,
      transparent:false
    });
    const mesh=new THREE.InstancedMesh(geo,material,items.length);
    mesh.name=`stage6-context-${key}`;
    mesh.userData.collidable=false;mesh.userData.stage6VisualOnly=true;
    mesh.userData.stage6Tier=sample.stage6Tier||0;
    for(let i=0;i<items.length;i++){
      const b=items[i];position.set(b.x,b.y+b.h/2,b.z);
      scale.set(b.w,b.h,b.d);matrix.compose(position,quaternion,scale);
      mesh.setMatrixAt(i,matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.frustumCulled=false;sceneGroup.add(mesh);
  }
  sceneGroup.userData.disposeStage6=()=>{
    sceneGroup.traverse(node=>{if(node.isMesh)node.material?.dispose()});
    geo.dispose();
  };
  return sceneGroup;
}

export function excludeStage6FromLegacyDecor(map){
  return (map?.decor||[]).filter(box=>!box.stage6VisualOnly);
}