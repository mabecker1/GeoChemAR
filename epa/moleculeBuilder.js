import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR EPA – moleculeBuilder.js
  Fachlicher 3D-Inhalt ist bewusst vom stabilen Tracking-Core getrennt.

  Winkelvorgaben für diese Unterrichts-App:
  CH4  = 109,5°
  H2CO = 120°
  CO2  = 180°
  NH3  = 106,5°
  H2O  = 104,5°
  HCl  = kein Bindungswinkel

  Freie Elektronenpaare, Geometrie-Overlays und Winkelbögen kommen
  in späteren Schritten. Diese Datei erzeugt zunächst nur die Moleküle.
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
    bond: 0xb8bec7
  }),
  bondRadius: 0.0020,
  doubleBondRadius: 0.00155,
  doubleBondSeparation: 0.0034
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

  for (const d of dirs) addAtomAndBond(g, "C", "H", d, distance);
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

  addAtomAndBond(
    g, "C", "O", oDir,
    BOND_LENGTH_A.FORMALDEHYDE_CO * ANGSTROM_TO_SCENE,
    2, v(0,0,1)
  );
  addAtomAndBond(
    g, "C", "H", h1Dir,
    BOND_LENGTH_A.FORMALDEHYDE_CH * ANGSTROM_TO_SCENE
  );
  addAtomAndBond(
    g, "C", "H", h2Dir,
    BOND_LENGTH_A.FORMALDEHYDE_CH * ANGSTROM_TO_SCENE
  );
  return g;
}

function buildCO2(data) {
  const g = new THREE.Group();
  g.name = "CO2";
  g.add(createAtom("C", v(0,0,0)));

  const distance = BOND_LENGTH_A.CO2_CO * ANGSTROM_TO_SCENE;
  addAtomAndBond(g, "C", "O", v(1,0,0), distance, 2, v(0,0,1));
  addAtomAndBond(g, "C", "O", v(-1,0,0), distance, 2, v(0,0,1));
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

  for (const phiDeg of [0,120,240]) {
    const phi = THREE.MathUtils.degToRad(phiDeg);
    const d = v(
      sinAlpha * Math.cos(phi),
      sinAlpha * Math.sin(phi),
      cosAlpha
    );
    addAtomAndBond(g, "N", "H", d, distance);
  }
  return g;
}

function buildH2O(data) {
  const g = new THREE.Group();
  g.name = "H2O";
  g.add(createAtom("O", v(0,0,0)));

  const gamma = THREE.MathUtils.degToRad(data.representativeBondAngle?.value ?? 104.5);
  const half = gamma / 2;
  const distance = BOND_LENGTH_A.OH * ANGSTROM_TO_SCENE;

  const h1 = v( Math.sin(half), 0, -Math.cos(half));
  const h2 = v(-Math.sin(half), 0, -Math.cos(half));

  addAtomAndBond(g, "O", "H", h1, distance);
  addAtomAndBond(g, "O", "H", h2, distance);
  return g;
}

function buildHCl(data) {
  const g = new THREE.Group();
  g.name = "HCl";
  g.add(createAtom("Cl", v(0,0,0)));
  addAtomAndBond(
    g, "Cl", "H", v(1,0,0),
    BOND_LENGTH_A.HCl * ANGSTROM_TO_SCENE
  );
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

export function disposeMolecule(root) {
  if (!root) return;
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material?.dispose?.();
    }
  });
}
