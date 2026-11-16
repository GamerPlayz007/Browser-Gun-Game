#!/usr/bin/env python3
"""Make the PINNED original Neon Zenith renderer cheaper for CROSSFIRE.

No mesh is reconstructed. The School tier omits distant draw geometry and
optional high-resolution/vehicle passes while keeping genuine nearby models.
A failed upstream anchor aborts the build instead of silently shipping a
partly broken map.
"""
from pathlib import Path
import sys

base = Path(sys.argv[1])
main = base / "src/main.js"
buildings = base / "src/city/buildings.js"
post = base / "src/core/post.js"

def replace_once(source, old, new, tag):
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{tag}: expected 1 upstream anchor, found {count}")
    return source.replace(old, new, 1)

s = main.read_text()
s = replace_once(s,
    "const params = new URLSearchParams(location.search);",
    """const params = new URLSearchParams(location.search);
// Only CROSSFIRE uses these presets. The author's normal game is unchanged.
const cfMode = params.has('crossfire-mp') || params.has('crossfire');
const requestedCfProfile = params.get('cfquality');
const cfProfile = cfMode
  ? (['school', 'balanced', 'high'].includes(requestedCfProfile)
      ? requestedCfProfile : 'balanced')
  : null;
// Culling distant original objects rather than replacing them with fake boxes.
if (cfMode) globalThis.__cfNeonProfile = {
  cx: -745.469, cz: -202.350,
  radius: cfProfile === 'school' ? 760 : cfProfile === 'balanced' ? 1500 : Infinity
};""",
    "presets")

s = replace_once(s,
    "const dpr = Math.min(window.devicePixelRatio || 1, 1.5);",
    """// Fewer pixels to shade: original native appearance, adaptive internal resolution.
  const dpr = cfMode && cfProfile !== 'high'
    ? Math.min(window.devicePixelRatio || 1, 1)
    : Math.min(window.devicePixelRatio || 1, 1.5);""",
    "pixel ratio")

s = replace_once(s,
    "const [tex, city, kits, shopKitData, districtData] = await Promise.all([loadTextures(), Promise.resolve(generateCity()), loadFacadeKits(), loadShopKit(), loadDistrict(renderer, { small: isTouch() })]);",
    """// School avoids downloading large detailed facade kit meshes and uses the
  // original authored 2K lightmap / 1K district textures, not placeholders.
  const [tex, city, kits, shopKitData, districtData] = await Promise.all([
    loadTextures(), Promise.resolve(generateCity()),
    cfMode && cfProfile === 'school' ? Promise.resolve([]) : loadFacadeKits(),
    loadShopKit(),
    loadDistrict(renderer, { small: isTouch() || cfMode && cfProfile === 'school' })
  ]);
  if (cfMode) camera.position.set(-745.469, 2.6, -202.350);""",
    "asset loading")

s = replace_once(s,
    """const traffic = new Traffic(city, lightmap);
  await traffic.load();
  scene.add(traffic.group);
  const sky2 = new SkyTraffic(city);
  scene.add(sky2.group);""",
    """const traffic = new Traffic(city, lightmap);
  // Vehicle models and aerial traffic are optional in School mode.
  if (!(cfMode && cfProfile === 'school')) await traffic.load();
  scene.add(traffic.group);
  const sky2 = cfMode && cfProfile === 'school'
    ? { group: new THREE.Group() } : new SkyTraffic(city);
  scene.add(sky2.group);""",
    "traffic")

s = replace_once(s,
    "const post = createPost(renderer, scene, camera);",
    "const post = createPost(renderer, scene, camera, { lite: cfMode && cfProfile === 'school' });",
    "post processing")

s = replace_once(s,
    "const gov = new Governor((s) => post.setScale(s), { min: 0.5, max: 1 });",
    """const gov = new Governor((s) => post.setScale(s), {
    min: cfMode && cfProfile === 'school' ? 0.42 : 0.5,
    max: cfMode && cfProfile === 'school' ? 0.62
      : cfMode && cfProfile === 'balanced' ? 0.82 : 1,
    start: cfMode && cfProfile === 'school' ? 0.58
      : cfMode && cfProfile === 'balanced' ? 0.75 : 1
  });""",
    "adaptive governor")

s = replace_once(s,
    """const probe = createReflectionProbe(128);
  const model = createKiteModel(probe.texture);
  await model.userData.build(lightmap);
  scene.add(model);""",
    """// The original game's million-triangle flying car and cubemap probe are
  // unnecessary in CROSSFIRE (players use the FPS weapon/viewmodel instead).
  const probe = cfMode ? null : createReflectionProbe(128);
  const model = cfMode ? new THREE.Group() : createKiteModel(probe.texture);
  if (cfMode) {
    model.visible = false;
    model.userData.uniforms = {
      fanSpin: { value: 0 }, brake: { value: 0 }, boost: { value: 0 }
    };
  } else {
    await model.userData.build(lightmap);
    scene.add(model);
  }""",
    "unused car model")

s = replace_once(s,
    "const settings = loadSettings();",
    """const settings = loadSettings();
  if (cfMode) {
    settings.quality = cfProfile === 'school' ? 'low'
      : cfProfile === 'balanced' ? 'medium' : 'high';
    settings.rain = cfProfile === 'school' ? 0.45 : 1;
  }""",
    "startup quality")

s = replace_once(s,
    "  applySetting('all');\n\n  const fly = new FlyCam(camera, canvas);",
    """  applySetting('all');
  if (cfMode) {
    gov.scale = cfProfile === 'school' ? 0.58
      : cfProfile === 'balanced' ? 0.75 : 1;
    gov.locked = cfProfile === 'high';
    post.setScale(gov.scale);
  }

  const fly = new FlyCam(camera, canvas);""",
    "adaptive mode")

s = replace_once(s,
    """  // warm-up: compile every pipeline and upload every buffer now, so nothing hitches the first time it comes into view
  {""",
    """  // The original full-city, three-pass warmup is hugely expensive on FPS
  // startup (and compiles an unused vehicle reflection probe). Preserve it
  // ONLY for the original flying-car game.
  if (!cfMode) {""",
    "upstream warmup")

s = replace_once(s,
    """  }

  window.addEventListener('resize', () => {""",
    """  } else {
    // Compiling the *entire* megacity is not a prerequisite for entering FPS.
    // The normal native renderer compiles visible shaders on first use.
    await progress(0.83, 'PREPARING PLAYABLE DISTRICT');
    district.update(camera);
  }

  window.addEventListener('resize', () => {""",
    "upstream warmup end")

s = replace_once(s,
    "    traffic.update(dt, camera.position, U.time.value, kite);",
    "    if (!(cfMode && cfProfile === 'school')) traffic.update(dt, camera.position, U.time.value, kite);",
    "traffic loop")

s = replace_once(s,
    """    probe.update(renderer, scene, kite.model.position, [kite.model, rain.group], 2);
    ground.updateReflection(renderer, scene, camera);
    post.render();""",
    """    if (probe) probe.update(renderer, scene, kite.model.position, [kite.model, rain.group], 2);
    // Wet road reflections are retained on Balanced/High. Updating a static
    // view every third frame on Balanced saves the extra scene render passes.
    if (!cfMode || cfProfile === 'high' ||
        (cfProfile === 'balanced' && (++reflectFrame % 3 === 1)))
      ground.updateReflection(renderer, scene, camera);
    post.render();""",
    "reflection loop")

s = replace_once(s,
    "  let last = performance.now();\n  let prevCam = camera.position.clone();",
    "  let last = performance.now();\n  let reflectFrame = 0;\n  let prevCam = camera.position.clone();",
    "reflection counter")

s = replace_once(s,
    "  probe.update(renderer, scene, kite.model.position, [kite.model, rain.group], 6);",
    "  if (probe) probe.update(renderer, scene, kite.model.position, [kite.model, rain.group], 6);",
    "probe startup")

main.write_text(s)

s = buildings.read_text()
s = replace_once(s,
    "  const all = [...city.buildings, ...city.outer];",
    """  const profile = globalThis.__cfNeonProfile;
  const all = [...city.buildings, ...city.outer].filter((b) => {
    if (!profile || !Number.isFinite(profile.radius)) return true;
    // Keep full, unmodified original geometry for the local district.
    const dx = Math.max(0, Math.abs(b.x - profile.cx) - b.w * 0.5);
    const dz = Math.max(0, Math.abs(b.z - profile.cz) - b.d * 0.5);
    return dx * dx + dz * dz <= profile.radius * profile.radius;
  });""",
    "far architecture culling")
buildings.write_text(s)

s = post.read_text()
s = replace_once(s,
    "export function createPost(renderer, scene, camera) {",
    "export function createPost(renderer, scene, camera, { lite = false } = {}) {",
    "lite flag")
s = replace_once(s,
    "const bloomPass = bloom(sceneColor, P.bloomStrength, P.bloomRadius, P.bloomThreshold);",
    "const bloomPass = lite ? { rgb: vec3(0) } : bloom(sceneColor, P.bloomStrength, P.bloomRadius, P.bloomThreshold);",
    "bloom")
s = replace_once(s,
    "const aa = fxaa(display);",
    "const aa = lite ? display : fxaa(display);",
    "FXAA")
post.write_text(s)

print("[CROSSFIRE] Native Neon profiles patched: School, Balanced, High.")
