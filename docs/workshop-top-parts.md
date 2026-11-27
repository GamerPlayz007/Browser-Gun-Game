# CROSSFire — Workshop entry and hands-on overhead inspection

The main CROSSFire homepage contains an obvious **ENTER THE WORKSHOP** button. It links directly to the existing permanent workshop with the approved AWP-01 v0.3 selected. The small redundant header shortcut is removed.

## Top-down Workbench
Select WORKBENCH in the existing garage. The currently selected real GLB asset is rotated **on its display parent group** and laid flat across the virtual inspection table. Its source mesh vertices, glTF data, materials and saved files are never edited by this mode.

- Click any visible GLB mesh: the selected decorative component highlights; its artist-assigned category, original mesh name, material names and triangle count appear in the right-side inspector and an overlay label
- Drag the highlighted part: it moves in the tabletop plane; other components remain in place
- Click an empty area and drag to pan the workbench camera
- Scroll to zoom
- Use **RESET SELECTED PART POSITION** to undo the selected display movement
- Use **ASSEMBLE MODEL** to undo spread/explode offsets
- Use GARAGE to restore the normal upright model preview
- Switch to COMPONENTS for the existing exploded-assembly inspection

The entire interaction is temporary browser display state. It is not a CAD editor or physical weapon design and does not write any changes into the GLB. "What is this?" labels come from the artwork's own node names; a generic mesh may have only a generic description.

## Safety and isolation
Only static/index.html, static/style.css, static/workshop.html, static/workshop.js, static/workshop-component-inspector.js and Workshop tests/documentation change. No game.js, server, multiplayer physics, collision or runtime combat files are modified.
