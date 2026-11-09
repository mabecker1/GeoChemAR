import * as THREE from "../libs/three.module.min.js";

const ANGSTROM_TO_SCENE = 0.033;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    H: 0.0070,
    C: 0.0110,
    O: 0.0100
  }),
  color: Object.freeze({
    H: 0xffffff,
    C: 0x202020,
    O: 0xd93636,
    bond: 0xb8bec7
  }),
  bondRadius: 0.0020
});

const BOND_LENGTH_A = Object.freeze({
  CH: 1.087,
  OH: 0.958
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

function addBond(group, atomA, atomB, elementA, elementB) {
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

  group.add(createBondCylinder(start, end, DISPLAY.bondRadius, material));
}

function addAtomAndBond(group, centralElement, outerElement, direction, distance) {
  const center = v(0,0,0);
  const outer = direction.clone().normalize().multiplyScalar(distance);
  addBond(group, center, outer, centralElement, outerElement);
  group.add(createAtom(outerElement, outer));
  return outer;
}

function buildCH4() {
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

  for (const d of dirs) addAtomAndBond(g, "C", "H", d, distance);
  return g;
}

function buildH2O() {
  const g = new THREE.Group();
  g.name = "H2O";
  g.add(createAtom("O", v(0,0,0)));

  const gamma = THREE.MathUtils.degToRad(104.5);
  const half = gamma / 2;
  const distance = BOND_LENGTH_A.OH * ANGSTROM_TO_SCENE;

  const h1Dir = v( Math.sin(half), 0, -Math.cos(half)).normalize();
  const h2Dir = v(-Math.sin(half), 0, -Math.cos(half)).normalize();
  addAtomAndBond(g, "O", "H", h1Dir, distance);
  addAtomAndBond(g, "O", "H", h2Dir, distance);
  return g;
}

export function buildMolecule(data) {
  switch (data?.key) {
    case "CH4": return buildCH4();
    case "H2O": return buildH2O();
    default: throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
}

function makeSurfaceMesh(positions, indices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  const correctedIndices = [];
  for (let i = 0; i < indices.length; i += 3) {
    correctedIndices.push(indices[i], indices[i + 2], indices[i + 1]);
  }
  geometry.setIndex(correctedIndices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.74,
    shininess: 72,
    specular: 0x555555,
    side: THREE.FrontSide,
    depthWrite: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.userData.kind = "electron-density-surface";
  return mesh;
}

export async function createElectronDensitySurfaceOverlay(data) {
  switch (data?.key) {
    case "CH4": {
      const m = await import("./methaneSurfaceData.js");
      return makeSurfaceMesh(m.METHANE_SURFACE_POSITIONS, m.METHANE_SURFACE_INDICES, m.METHANE_SURFACE_COLORS);
    }
    case "H2O": {
      const m = await import("./waterSurfaceData.js");
      return makeSurfaceMesh(m.WATER_SURFACE_POSITIONS, m.WATER_SURFACE_INDICES, m.WATER_SURFACE_COLORS);
    }
    default:
      throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
}

export function disposeObject3D(root) {
  if (!root) return;
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m?.map) m.map.dispose?.();
        m?.dispose?.();
      }
    }
  });
}

export function disposeMolecule(root) {
  disposeObject3D(root);
}
