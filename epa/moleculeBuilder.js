import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR EPA – moleculeBuilder.js

  Unterrichtswerte:
  CH4  = 109,5°
  H2CO = 120°
  CO2  = 180°
  NH3  = 106,5°
  H2O  = 104,5°
  HCl  = kein Bindungswinkel

  EPA-3 ergänzt:
  - Molekülgeometrie als ein-/ausblendbares 3D-Hilfsgerüst
  - automatisch ausgewählten Bindungswinkel mit Winkelbogen + Wert

  Freie Elektronenpaare folgen im nächsten Schritt.
*/

const ANGSTROM_TO_SCENE = 0.033;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    H: 0.0070,
    C: 0.0110,
    N: 0.0105,
    O: 0.0100,
    Cl: 0.0130
  }),
  color: Object.freeze({
    H: 0xffffff,
    C: 0x202020,
    N: 0x3057d5,
    O: 0xd93636,
    Cl: 0x39a852,
    bond: 0xb8bec7,
    geometry: 0x46d7c0,
    angle: 0xffd54a
  }),
  bondRadius: 0.0020,
  doubleBondRadius: 0.00155,
  doubleBondSeparation: 0.0034,
  geometryEdgeRadius: 0.00062,
  angleRadiusFactor: 0.53
});

const BOND_LENGTH_A = Object.freeze({
  CH: 1.087,
  FORMALDEHYDE_CH: 1.116,
  FORMALDEHYDE_CO: 1.208,
  CO2_CO: 1.162,
  NH: 1.012,
  OH: 0.958,
  HCl: 1.275
});

function v(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

function materialForElement(element) {
  return new THREE.MeshStandardMaterial({
    color: DISPLAY.color[element],
    roughness: element === "H" ? 0.50 : 0.62,
    metalness: 0
  });
}

function createAtom(element, position) {
  const radius = DISPLAY.atomRadius[element];
  const geometry = new THREE.SphereGeometry(
    radius,
    element === "H" ? 40 : 48,
    element === "H" ? 28 : 32
  );
  const mesh = new THREE.Mesh(geometry, materialForElement(element));
  mesh.position.copy(position);
  mesh.userData.kind = "atom";
  mesh.userData.element = element;
  return mesh;
}

function perpendicularTo(direction, preferred = null) {
  if (preferred) {
    const p = preferred.clone();
    p.addScaledVector(direction, -p.dot(direction));
    if (p.lengthSq() > 1e-10) return p.normalize();
  }

  const refs = [v(1,0,0), v(0,1,0), v(0,0,1)];
  refs.sort((a,b) => Math.abs(a.dot(direction)) - Math.abs(b.dot(direction)));
  const p = refs[0].clone();
  p.addScaledVector(direction, -p.dot(direction));
  return p.normalize();
}

function createBondCylinder(start, end, radius, material) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  const direction = delta.clone().normalize();

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 32, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0), direction);
  mesh.userData.kind = "bond";
  return mesh;
}

function addBond(group, atomA, atomB, elementA, elementB, order = 1, preferredDoubleAxis = null) {
  const pa = atomA.clone();
  const pb = atomB.clone();
  const axis = pb.clone().sub(pa);
  if (axis.lengthSq() <= 1e-12) return;

  const direction = axis.clone().normalize();
  const ra = DISPLAY.atomRadius[elementA];
  const rb = DISPLAY.atomRadius[elementB];
  const start = pa.clone().addScaledVector(direction, ra);
  const end = pb.clone().addScaledVector(direction, -rb);

  const material = new THREE.MeshStandardMaterial({
    color: DISPLAY.color.bond,
    roughness: 0.65,
    metalness: 0
  });

  if (order === 1) {
    group.add(createBondCylinder(start, end, DISPLAY.bondRadius, material));
    return;
  }

  const offsetDir = perpendicularTo(direction, preferredDoubleAxis);
  const offset = offsetDir.multiplyScalar(DISPLAY.doubleBondSeparation / 2);
  group.add(createBondCylinder(
    start.clone().add(offset),
    end.clone().add(offset),
    DISPLAY.doubleBondRadius,
    material
  ));
  group.add(createBondCylinder(
    start.clone().sub(offset),
    end.clone().sub(offset),
    DISPLAY.doubleBondRadius,
    material.clone()
  ));
}

function addAtomAndBond(group, centralElement, outerElement, direction, distance, order = 1, preferredDoubleAxis = null) {
  const center = v(0,0,0);
  const outer = direction.clone().normalize().multiplyScalar(distance);
  addBond(group, center, outer, centralElement, outerElement, order, preferredDoubleAxis);
  group.add(createAtom(outerElement, outer));
  return outer;
}

function setEpaMetadata(group, data, {
  center = v(0,0,0),
  outerPositions = [],
  geometryVertices = [],
  geometryEdges = [],
  geometryFaces = [],
  angleDirections = null
} = {}) {
  group.userData.epa = {
    key: data.key,
    center: center.clone(),
    outerPositions: outerPositions.map(p => p.clone()),
    geometryVertices: geometryVertices.map(p => p.clone()),
    geometryEdges: geometryEdges.map(([a,b]) => [a,b]),
    geometryFaces: geometryFaces.map(face => [...face]),
    angleDirections: angleDirections
      ? angleDirections.map(d => d.clone().normalize())
      : null
  };
}

function buildCH4(data) {
  const g = new THREE.Group();
  g.name = "CH4";
  g.add(createAtom("C", v(0,0,0)));

  const distance = BOND_LENGTH_A.CH * ANGSTROM_TO_SCENE;
  const dirs = [
    v( 1, 1, 1),
    v( 1,-1,-1),
    v(-1, 1,-1),
    v(-1,-1, 1)
  ].map(d => d.normalize());

  const h = [];
  for (const d of dirs) h.push(addAtomAndBond(g, "C", "H", d, distance));

  setEpaMetadata(g, data, {
    outerPositions: h,
    geometryVertices: h,
    geometryEdges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    geometryFaces: [[0,1,2],[0,1,3],[0,2,3],[1,2,3]],
    angleDirections: [dirs[0], dirs[1]]
  });
  return g;
}

function buildH2CO(data) {
  const g = new THREE.Group();
  g.name = "H2CO";
  g.add(createAtom("C", v(0,0,0)));

  const angle = THREE.MathUtils.degToRad(data.representativeBondAngle?.value ?? 120);
  const oDir = v(1,0,0);
  const h1Dir = v(Math.cos(angle), Math.sin(angle), 0);
  const h2Dir = v(Math.cos(angle), -Math.sin(angle), 0);

  const o = addAtomAndBond(
    g, "C", "O", oDir,
    BOND_LENGTH_A.FORMALDEHYDE_CO * ANGSTROM_TO_SCENE,
    2, v(0,0,1)
  );
  const h1 = addAtomAndBond(
    g, "C", "H", h1Dir,
    BOND_LENGTH_A.FORMALDEHYDE_CH * ANGSTROM_TO_SCENE
  );
  const h2 = addAtomAndBond(
    g, "C", "H", h2Dir,
    BOND_LENGTH_A.FORMALDEHYDE_CH * ANGSTROM_TO_SCENE
  );

  setEpaMetadata(g, data, {
    outerPositions: [o,h1,h2],
    geometryVertices: [o,h1,h2],
    geometryEdges: [[0,1],[1,2],[2,0]],
    geometryFaces: [[0,1,2]],
    angleDirections: [oDir,h1Dir]
  });
  return g;
}

function buildCO2(data) {
  const g = new THREE.Group();
  g.name = "CO2";
  g.add(createAtom("C", v(0,0,0)));

  const distance = BOND_LENGTH_A.CO2_CO * ANGSTROM_TO_SCENE;
  const o1 = addAtomAndBond(g, "C", "O", v(1,0,0), distance, 2, v(0,0,1));
  const o2 = addAtomAndBond(g, "C", "O", v(-1,0,0), distance, 2, v(0,0,1));

  setEpaMetadata(g, data, {
    outerPositions: [o1,o2],
    geometryVertices: [o1,o2],
    geometryEdges: [[0,1]],
    geometryFaces: [],
    angleDirections: [v(1,0,0),v(-1,0,0)]
  });
  return g;
}

function buildNH3(data) {
  const g = new THREE.Group();
  g.name = "NH3";
  g.add(createAtom("N", v(0,0,0)));

  const gamma = THREE.MathUtils.degToRad(data.representativeBondAngle?.value ?? 106.5);
  const cos2Alpha = THREE.MathUtils.clamp((Math.cos(gamma) + 0.5) / 1.5, 0, 1);
  const cosAlpha = -Math.sqrt(cos2Alpha);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha*cosAlpha));
  const distance = BOND_LENGTH_A.NH * ANGSTROM_TO_SCENE;

  const dirs = [];
  const h = [];
  for (const phiDeg of [0,120,240]) {
    const phi = THREE.MathUtils.degToRad(phiDeg);
    const d = v(
      sinAlpha * Math.cos(phi),
      sinAlpha * Math.sin(phi),
      cosAlpha
    ).normalize();
    dirs.push(d);
    h.push(addAtomAndBond(g, "N", "H", d, distance));
  }

  const center = v(0,0,0);
  setEpaMetadata(g, data, {
    outerPositions: h,
    geometryVertices: [center,...h],
    geometryEdges: [[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]],
    geometryFaces: [[0,1,2],[0,2,3],[0,3,1],[1,2,3]],
    angleDirections: [dirs[0],dirs[1]]
  });
  return g;
}

function buildH2O(data) {
  const g = new THREE.Group();
  g.name = "H2O";
  g.add(createAtom("O", v(0,0,0)));

  const gamma = THREE.MathUtils.degToRad(data.representativeBondAngle?.value ?? 104.5);
  const half = gamma / 2;
  const distance = BOND_LENGTH_A.OH * ANGSTROM_TO_SCENE;

  const h1Dir = v( Math.sin(half), 0, -Math.cos(half)).normalize();
  const h2Dir = v(-Math.sin(half), 0, -Math.cos(half)).normalize();
  const h1 = addAtomAndBond(g, "O", "H", h1Dir, distance);
  const h2 = addAtomAndBond(g, "O", "H", h2Dir, distance);

  const center = v(0,0,0);
  setEpaMetadata(g, data, {
    outerPositions: [h1,h2],
    geometryVertices: [center,h1,h2],
    geometryEdges: [[0,1],[0,2],[1,2]],
    geometryFaces: [[0,1,2]],
    angleDirections: [h1Dir,h2Dir]
  });
  return g;
}

function buildHCl(data) {
  const g = new THREE.Group();
  g.name = "HCl";
  g.add(createAtom("Cl", v(0,0,0)));
  const h = addAtomAndBond(
    g, "Cl", "H", v(1,0,0),
    BOND_LENGTH_A.HCl * ANGSTROM_TO_SCENE
  );

  setEpaMetadata(g, data, {
    outerPositions: [h],
    geometryVertices: [v(0,0,0),h],
    geometryEdges: [[0,1]],
    geometryFaces: [],
    angleDirections: null
  });
  return g;
}

export function buildMolecule(data) {
  switch (data?.key) {
    case "CH4":  return buildCH4(data);
    case "H2CO": return buildH2CO(data);
    case "CO2":  return buildCO2(data);
    case "NH3":  return buildNH3(data);
    case "H2O":  return buildH2O(data);
    case "HCl":  return buildHCl(data);
    default: throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
}

/* -----------------------------------------------------
   Overlay-Helfer
   ----------------------------------------------------- */

function createOverlayCylinder(a, b, radius, color, opacity = 0.9) {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false
  });
  const mesh = createBondCylinder(a, b, radius, material);
  mesh.renderOrder = 10;
  return mesh;
}

function createFaceMesh(points, indices) {
  const positions = [];
  for (const i of indices) {
    const p = points[i];
    positions.push(p.x,p.y,p.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: DISPLAY.color.geometry,
    transparent: true,
    opacity: 0.085,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true
  });

  const mesh = new THREE.Mesh(geometry,material);
  mesh.renderOrder = 5;
  return mesh;
}

function createTextSprite(text, {
  background = "rgba(255,255,255,0.94)",
  foreground = "#1f2937",
  border = "rgba(0,0,0,0.20)",
  fontPx = 54,
  paddingX = 30,
  paddingY = 18,
  worldHeight = 0.012
} = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  ctx.font = `700 ${fontPx}px Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const width = Math.ceil(metrics.width + 2*paddingX);
  const height = Math.ceil(fontPx + 2*paddingY);

  canvas.width = width;
  canvas.height = height;

  ctx.font = `700 ${fontPx}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const r = Math.min(18, height/4);
  ctx.fillStyle = background;
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(r,0);
  ctx.lineTo(width-r,0);
  ctx.quadraticCurveTo(width,0,width,r);
  ctx.lineTo(width,height-r);
  ctx.quadraticCurveTo(width,height,width-r,height);
  ctx.lineTo(r,height);
  ctx.quadraticCurveTo(0,height,0,height-r);
  ctx.lineTo(0,r);
  ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = foreground;
  ctx.fillText(text,width/2,height/2+1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(material);
  const aspect = width/height;
  sprite.scale.set(worldHeight*aspect,worldHeight,1);
  sprite.renderOrder = 20;
  return sprite;
}

function overlayLabelPosition(points) {
  if (!points.length) return v(0,0.045,0.01);
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  return v(center.x, box.max.y + 0.016, box.max.z + 0.006);
}

export function createGeometryOverlay(molecule, data) {
  const meta = molecule?.userData?.epa;
  if (!meta) return null;

  const group = new THREE.Group();
  group.name = "moleculeGeometryOverlay";
  const points = meta.geometryVertices;

  for (const [a,b] of meta.geometryEdges) {
    if (!points[a] || !points[b]) continue;
    group.add(createOverlayCylinder(
      points[a],points[b],
      DISPLAY.geometryEdgeRadius,
      DISPLAY.color.geometry,
      0.84
    ));
  }

  for (const face of meta.geometryFaces) {
    if (face.length === 3 && face.every(i => points[i])) {
      group.add(createFaceMesh(points,face));
    }
  }

  const label = createTextSprite(data.molecularGeometry,{
    background:"rgba(235,255,250,0.95)",
    foreground:"#0f6154",
    border:"rgba(70,215,192,0.55)",
    fontPx:46,
    worldHeight:0.0105
  });
  label.position.copy(overlayLabelPosition(points));
  group.add(label);

  return group;
}

function angleAxis(a,b) {
  const axis = a.clone().cross(b);
  if (axis.lengthSq() > 1e-10) return axis.normalize();

  /* 180°: eine stabile Ebene für den Halbkreis wählen. */
  const candidate = Math.abs(a.z) < 0.8 ? v(0,0,1) : v(0,1,0);
  return a.clone().cross(candidate).normalize();
}

function formatAngle(value) {
  const rounded = Math.round(value*10)/10;
  const isInteger = Math.abs(rounded-Math.round(rounded)) < 1e-9;
  const text = isInteger ? String(Math.round(rounded)) : rounded.toFixed(1).replace(".",",");
  return `${text}°`;
}

export function createAngleOverlay(molecule, data) {
  const meta = molecule?.userData?.epa;
  const angleData = data?.representativeBondAngle;
  if (!meta?.angleDirections || !angleData) return null;

  const a = meta.angleDirections[0].clone().normalize();
  const b = meta.angleDirections[1].clone().normalize();
  const dot = THREE.MathUtils.clamp(a.dot(b),-1,1);
  const geometricAngle = Math.acos(dot);
  const axis = angleAxis(a,b);

  const lengths = meta.outerPositions
    .map(p => p.length())
    .filter(n => Number.isFinite(n) && n > 0);
  const minBondLength = lengths.length ? Math.min(...lengths) : 0.035;
  const radius = THREE.MathUtils.clamp(
    minBondLength*DISPLAY.angleRadiusFactor,
    0.014,
    0.022
  );

  const arcPoints = [];
  const segments = Math.max(28,Math.round(geometricAngle/Math.PI*72));
  for (let i=0;i<=segments;i++) {
    const t = geometricAngle*(i/segments);
    const q = new THREE.Quaternion().setFromAxisAngle(axis,t);
    arcPoints.push(a.clone().applyQuaternion(q).multiplyScalar(radius));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const material = new THREE.LineBasicMaterial({
    color:DISPLAY.color.angle,
    transparent:true,
    opacity:0.98,
    depthTest:false,
    depthWrite:false
  });
  const arc = new THREE.Line(geometry,material);
  arc.renderOrder = 15;

  const group = new THREE.Group();
  group.name = "bondAngleOverlay";
  group.add(arc);

  /* Kleine Endmarken erhöhen die Lesbarkeit des Winkelbogens. */
  const tickLength = 0.0032;
  for (const endpoint of [arcPoints[0],arcPoints[arcPoints.length-1]]) {
    const radial = endpoint.clone().normalize();
    group.add(createOverlayCylinder(
      endpoint.clone().addScaledVector(radial,-tickLength/2),
      endpoint.clone().addScaledVector(radial, tickLength/2),
      0.00058,
      DISPLAY.color.angle,
      0.98
    ));
  }

  const midQ = new THREE.Quaternion().setFromAxisAngle(axis,geometricAngle/2);
  const midDir = a.clone().applyQuaternion(midQ).normalize();

  const label = createTextSprite(formatAngle(angleData.value),{
    background:"rgba(255,250,220,0.97)",
    foreground:"#6b5200",
    border:"rgba(255,213,74,0.72)",
    fontPx:58,
    worldHeight:0.0115
  });
  label.position.copy(midDir.multiplyScalar(radius+0.010));
  group.add(label);

  return group;
}

export function disposeMolecule(root) {
  if (!root) return;
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material?.map) material.map.dispose?.();
        material?.dispose?.();
      }
    }
  });
}
