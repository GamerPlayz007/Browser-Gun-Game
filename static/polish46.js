// CROSSFIRE 04.6: read-only visual/GPU telemetry. No physics or net hooks.
// Renderer.info must use autoReset=false and reset exactly once per game frame.
export function captureRenderHealth46(renderer,scene,world,display){
 const info=renderer?.info||{},render=info.render||{},memory=info.memory||{};
 let meshes=0,visibleMeshes=0,points=0,instancedObjects=0,visibleInstances=0,shadowCasters=0;
 function walk(node,parentsVisible=true){
  const visible=parentsVisible&&node.visible!==false;
  if(node.isMesh){meshes++;if(visible)visibleMeshes++;}
  if(node.isPoints&&visible)points++;
  if(node.isInstancedMesh){
   instancedObjects++;
   if(visible)visibleInstances+=Math.max(0,node.count||0);
  }
  if(visible&&node.castShadow)shadowCasters++;
  for(const child of node.children||[])walk(child,visible);
 }
 if(scene)walk(scene);
 const n=v=>Number.isFinite(v)&&v>=0?v:undefined;
 return {
  drawCalls:n(render.calls),triangles:n(render.triangles),textures:n(memory.textures),
  geometries:n(memory.geometries),shaderPrograms:n(info.programs?.length),
  visibleMeshes,meshes,points,instancedObjects,visibleInstances,shadowCasters,
  quality:display?.label?.()||'--',
  pixelWidth:n(display?.buffer?.width),pixelHeight:n(display?.buffer?.height),
  atmosphereRain:world?.atmosphere44?.rain?.geometry?.drawRange?.count,
  atmosphereMotes:world?.atmosphere44?.motes?.geometry?.drawRange?.count,
  activeAds:world?.living45?.ads?.filter(a=>a.mesh.visible).length,
  activeDrones:world?.living45?.drones?.filter(a=>a.group.visible).length
 };
}
export function assessFrameBudget46(stats){
 const calls=stats?.drawCalls,triangles=stats?.triangles,frame=stats?.p95Ms;
 const warnings=[];
 if(Number.isFinite(calls)&&calls>600)warnings.push('High GPU draw-call pressure');
 if(Number.isFinite(triangles)&&triangles>1500000)warnings.push('High geometry load');
 if(Number.isFinite(frame)&&frame>22)warnings.push('Low 95th-percentile frame pacing');
 return {warnings,healthy:warnings.length===0};
}
