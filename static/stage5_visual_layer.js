/**
 * CROSSFIRE Phase 1 Stage 5 — optional *batched visual-only* renderer.
 *
 * Call createStage5VisualLayer(THREE,map,"high") from the existing world
 * renderer's scene construction. DO NOT also let world.js draw the Stage 5
 * entries from map.decor, or you'll see duplicated models.
 *
 * This helper only constructs Three.js meshes. It never registers physics,
 * modifies player movement, or changes any map collision records.
 */
export function createStage5VisualLayer(THREE, map, quality = "high") {
  const level = { performance: 0, high: 1, ultra: 2 }[quality];
  if (level === undefined) throw new Error(`Unknown Stage 5 visual quality: ${quality}`);
  const finishes = map?.stage5?.material_finishes || {};
  const boxes = (map?.decor || []).filter((b) => b.stage5VisualOnly && b.qualityTier <= level);
  const byFinishTier = new Map();
  for (const b of boxes) {
    const key = `${b.finish}::${b.qualityTier}`;
    if (!byFinishTier.has(key)) byFinishTier.set(key, []);
    byFinishTier.get(key).push(b);
  }
  const group = new THREE.Group();
  group.name = "stage5-noncolliding-architecture";
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const matrices = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const size = new THREE.Vector3();
  for (const [key, entries] of byFinishTier) {
    const [finish, tierText] = key.split("::");
    const tier = Number(tierText);
    const isGlass = finish.startsWith("glass_");
    const isMetal = ["iron", "light_metal", "pipe"].includes(finish);
    const mat = new THREE.MeshStandardMaterial({
      color: finishes[finish] || "#7d8795",
      roughness: isGlass ? 0.27 : isMetal ? 0.57 : 0.89,
      metalness: isGlass ? 0.1 : isMetal ? 0.48 : 0.04,
      emissive: isGlass ? (finishes[finish] || "#000000") : "#000000",
      emissiveIntensity: isGlass ? 0.04 : 0,
    });
    const instances = new THREE.InstancedMesh(geometry, mat, entries.length);
    instances.name = `stage5-${finish}-tier${tier}`;
    instances.userData.stage5VisualOnly = true;
    instances.userData.stage5Tier = tier;
    instances.userData.collidable = false;
    for (let i = 0; i < entries.length; i++) {
      const b = entries[i];
      position.set(b.x, b.y + b.h / 2, b.z);
      size.set(b.w, b.h, b.d);
      matrices.compose(position, quaternion, size);
      instances.setMatrixAt(i, matrices);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.frustumCulled = false;
    group.add(instances);
  }
  group.userData.disposeStage5 = () => {
    group.traverse((mesh) => {
      if (mesh.isMesh) mesh.material?.dispose();
    });
    geometry.dispose();
  };
  return group;
}

export function filterStage5FromLegacyDecor(map) {
  // Use if the existing world renderer already renders all map.decor items.
  return (map?.decor || []).filter((b) => !b.stage5VisualOnly);
}