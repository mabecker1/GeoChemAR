import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Ethanol Testversion 1

  Diese erste Ethanol-Version enthält:
  - korrekt wirkendes Ball-and-Stick-Modell von Ethanol
  - Zoom-Unterstützung
  - Nutzung des stabilen EPA-6a-Tracking-Kerns

  Die Elektronendichteoberfläche mit elektrostatischem Potenzial
  folgt im nächsten Entwicklungsschritt.
*/

const ANGSTROM_TO_SCENE = 0.026;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    H: 0.0068,
    C: 0.0108,
    O: 0.0100
  }),
  color: Object.freeze({
    H: 0xffffff,
    C: 0x202020,
    O: 0xd93636,
    bond: 0xb8bec7
  }),
  bondRadius: 0.00195
});

const BOND = Object.freeze({
  CH: 1.09,
  CC: 1.54,
  CO: 1.43,
  OH: 0.96,
  COH_ANGLE_DEG: 108.5
});

function v(x,y,z){ return new THREE.Vector3(x,y,z); }

function materialForElement(element){
  return new THREE.MeshStandardMaterial({
    color: DISPLAY.color[element],
    roughness: element==="H" ? 0.50 : 0.62,
    metalness: 0
  });
}

function createAtom(element, position){
  const radius = DISPLAY.atomRadius[element];
  const geometry = new THREE.SphereGeometry(radius, element==="H" ? 40 : 48, element==="H" ? 28 : 32);
  const mesh = new THREE.Mesh(geometry, materialForElement(element));
  mesh.position.copy(position);
  mesh.userData.kind = "atom";
  mesh.userData.element = element;
  return mesh;
}

function createBondCylinder(start, end, radius, material){
  const delta = end.clone().sub(start);
  const length = delta.length();
  const direction = delta.clone().normalize();

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 28, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0), direction);
  mesh.userData.kind = "bond";
  return mesh;
}

function addBond(group, atomA, atomB, elementA, elementB){
  const axis = atomB.clone().sub(atomA);
  if(axis.lengthSq() <= 1e-12) return;

  const direction = axis.clone().normalize();
  const start = atomA.clone().addScaledVector(direction, DISPLAY.atomRadius[elementA]);
  const end = atomB.clone().addScaledVector(direction, -DISPLAY.atomRadius[elementB]);

  const material = new THREE.MeshStandardMaterial({
    color: DISPLAY.color.bond,
    roughness: 0.65,
    metalness: 0
  });

  group.add(createBondCylinder(start, end, DISPLAY.bondRadius, material));
}

function tetrahedralFollowersForBondDirection(bondDir){
  const u = bondDir.clone().normalize().negate();
  const helper = Math.abs(u.z) < 0.9 ? v(0,0,1) : v(0,1,0);

  const e2 = helper.clone().sub(u.clone().multiplyScalar(helper.dot(u))).normalize();
  const e3 = new THREE.Vector3().crossVectors(u, e2).normalize();

  const x = -1/3;
  const r = 2*Math.sqrt(2)/3;

  const dirs = [];
  for(const phiDeg of [0,120,240]){
    const phi = THREE.MathUtils.degToRad(phiDeg);
    const dir = u.clone().multiplyScalar(x)
      .add(e2.clone().multiplyScalar(r*Math.cos(phi)))
      .add(e3.clone().multiplyScalar(r*Math.sin(phi)))
      .normalize();
    dirs.push(dir);
  }
  return dirs;
}

function perpendicularTo(direction){
  const refs = [v(1,0,0), v(0,1,0), v(0,0,1)];
  refs.sort((a,b)=>Math.abs(a.dot(direction))-Math.abs(b.dot(direction)));
  const p = refs[0].clone();
  p.addScaledVector(direction, -p.dot(direction));
  return p.normalize();
}

function ethanolCoordinates(){
  const C1 = v(0,0,0);
  const C1_to_C2 = v(1,0,0).normalize();
  const C2 = C1.clone().addScaledVector(C1_to_C2, BOND.CC * ANGSTROM_TO_SCENE);

  const [C2_to_O, C2_to_H4, C2_to_H5] = tetrahedralFollowersForBondDirection(C1.clone().sub(C2));
  const O  = C2.clone().addScaledVector(C2_to_O,  BOND.CO * ANGSTROM_TO_SCENE);
  const H4 = C2.clone().addScaledVector(C2_to_H4, BOND.CH * ANGSTROM_TO_SCENE);
  const H5 = C2.clone().addScaledVector(C2_to_H5, BOND.CH * ANGSTROM_TO_SCENE);

  const [C1_to_H1, C1_to_H2, C1_to_H3] = tetrahedralFollowersForBondDirection(C2.clone().sub(C1));
  const H1 = C1.clone().addScaledVector(C1_to_H1, BOND.CH * ANGSTROM_TO_SCENE);
  const H2 = C1.clone().addScaledVector(C1_to_H2, BOND.CH * ANGSTROM_TO_SCENE);
  const H3 = C1.clone().addScaledVector(C1_to_H3, BOND.CH * ANGSTROM_TO_SCENE);

  const O_to_C2 = C2.clone().sub(O).normalize();
  const perp = perpendicularTo(O_to_C2);
  const theta = THREE.MathUtils.degToRad(BOND.COH_ANGLE_DEG);
  const O_to_HO = O_to_C2.clone().multiplyScalar(Math.cos(theta))
    .add(perp.multiplyScalar(Math.sin(theta)))
    .normalize();
  const HO = O.clone().addScaledVector(O_to_HO, BOND.OH * ANGSTROM_TO_SCENE);

  return { C1, C2, O, H1, H2, H3, H4, H5, HO };
}

export function buildMolecule(data){
  if(data?.key !== "ETHANOL"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  const g = new THREE.Group();
  g.name = "ETHANOL";

  const p = ethanolCoordinates();

  addBond(g, p.C1, p.C2, "C", "C");
  addBond(g, p.C2, p.O,  "C", "O");
  addBond(g, p.O,  p.HO, "O", "H");

  addBond(g, p.C1, p.H1, "C", "H");
  addBond(g, p.C1, p.H2, "C", "H");
  addBond(g, p.C1, p.H3, "C", "H");

  addBond(g, p.C2, p.H4, "C", "H");
  addBond(g, p.C2, p.H5, "C", "H");

  g.add(createAtom("C", p.C1));
  g.add(createAtom("C", p.C2));
  g.add(createAtom("O", p.O));
  g.add(createAtom("H", p.H1));
  g.add(createAtom("H", p.H2));
  g.add(createAtom("H", p.H3));
  g.add(createAtom("H", p.H4));
  g.add(createAtom("H", p.H5));
  g.add(createAtom("H", p.HO));

  return g;
}

export function disposeMolecule(root){
  if(!root) return;
  root.traverse(obj=>{
    if(obj.geometry) obj.geometry.dispose();
    if(obj.material){
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for(const m of mats){
        if(m?.map) m.map.dispose?.();
        m?.dispose?.();
      }
    }
  });
}
