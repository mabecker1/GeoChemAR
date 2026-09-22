import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Ethanol Testversion 1a

  Geometrie:
  Experimentelle Strukturkoordinaten aus der NIST CCCBDB für Ethanol.
  Dadurch sind beide C-Atome realistisch annähernd tetraedrisch und
  das O-Atom sauber gewinkelt.

  Verwendete experimentelle Kernwerte:
  C-C = 1.512 Å
  C-O = 1.431 Å
  O-H = 0.971 Å
  C-C-O = 107.8°
  C-O-H = 105.4°
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
  const geometry = new THREE.SphereGeometry(
    radius,
    element==="H" ? 40 : 48,
    element==="H" ? 28 : 32
  );
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

/*
  Experimentelle NIST-CCCBDB-Koordinaten (Å):
  C1  1.1879  -0.3829   0.0000
  C2  0.0000   0.5526   0.0000
  O  -1.1867  -0.2472   0.0000
  HO -1.9237   0.3850   0.0000
  H1  2.0985   0.2306   0.0000
  H2  1.1184  -1.0093   0.8869
  H3  1.1184  -1.0093  -0.8869
  H4 -0.0227   1.1812   0.8852
  H5 -0.0227   1.1812  -0.8852

  Das entspricht dem trans-Konformer. Die gesamte Struktur wird nur
  zum Würfelzentrum verschoben und einheitlich skaliert; Winkel und
  relative Abstände bleiben unverändert.
*/
function experimentalEthanolCoordinates(){
  const raw = {
    C1: v( 1.1879, -0.3829,  0.0000),
    C2: v( 0.0000,  0.5526,  0.0000),
    O:  v(-1.1867, -0.2472,  0.0000),
    HO: v(-1.9237,  0.3850,  0.0000),
    H1: v( 2.0985,  0.2306,  0.0000),
    H2: v( 1.1184, -1.0093,  0.8869),
    H3: v( 1.1184, -1.0093, -0.8869),
    H4: v(-0.0227,  1.1812,  0.8852),
    H5: v(-0.0227,  1.1812, -0.8852)
  };

  const points = Object.values(raw);
  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());

  const result = {};
  for(const [key,p] of Object.entries(raw)){
    result[key] = p.clone().sub(center).multiplyScalar(ANGSTROM_TO_SCENE);
  }
  return result;
}

export function buildMolecule(data){
  if(data?.key !== "ETHANOL"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  const g = new THREE.Group();
  g.name = "ETHANOL";

  const p = experimentalEthanolCoordinates();

  // Bindungsgerüst: CH3-CH2-OH
  addBond(g, p.C1, p.C2, "C", "C");
  addBond(g, p.C2, p.O,  "C", "O");
  addBond(g, p.O,  p.HO, "O", "H");

  // CH3-Gruppe
  addBond(g, p.C1, p.H1, "C", "H");
  addBond(g, p.C1, p.H2, "C", "H");
  addBond(g, p.C1, p.H3, "C", "H");

  // CH2-Gruppe
  addBond(g, p.C2, p.H4, "C", "H");
  addBond(g, p.C2, p.H5, "C", "H");

  // Atome
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
