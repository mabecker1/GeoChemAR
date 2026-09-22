import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Ethanol Testversion 1b

  Didaktisch idealisierte Geometrie:
  - beide C-Atome exakt tetraedrisch: 109,47°
  - O-Atom sauber gewinkelt: C–O–H = 105,4°
  - Bindungslängen nahe experimentellen Ethanol-Werten

  Diese Version ist bewusst NICHT die leicht verzerrte experimentelle
  Gasphasengeometrie. Für den Unterricht soll die sp3-Tetraedergeometrie
  an beiden C-Atomen klar und eindeutig sichtbar sein.
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
  CC: 1.512,
  CO: 1.431,
  OH: 0.971,
  TETRAHEDRAL_DEG: 109.47122063449069,
  COH_DEG: 105.4
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
  Für einen idealen Tetraeder gilt:
  cos(109,47°) = -1/3.

  Liegt eine Bindung eines sp3-C-Atoms entlang +x, dann können die drei
  übrigen Bindungen deshalb die x-Komponente -1/3 besitzen und sind
  um die x-Achse jeweils um 120° gegeneinander versetzt.

  Analog gilt dies gespiegelt für das zweite C-Atom.
*/
function idealTetrahedralThree(oppositeXSign){
  const x = oppositeXSign / 3;
  const radial = 2*Math.sqrt(2)/3;

  return [0,120,240].map(phiDeg=>{
    const phi=THREE.MathUtils.degToRad(phiDeg);
    return v(
      x,
      radial*Math.cos(phi),
      radial*Math.sin(phi)
    ).normalize();
  });
}

function ethanolCoordinates(){
  const s=ANGSTROM_TO_SCENE;

  // C–C-Achse bewusst horizontal und symmetrisch um den Ursprung.
  const C1=v(-BOND.CC*s/2,0,0);
  const C2=v( BOND.CC*s/2,0,0);

  /*
    C1:
    Die C1→C2-Bindung zeigt nach +x.
    Die drei C–H-Bindungen müssen daher jeweils x=-1/3 besitzen.
  */
  const methylDirs=idealTetrahedralThree(-1);
  const H1=C1.clone().addScaledVector(methylDirs[0],BOND.CH*s);
  const H2=C1.clone().addScaledVector(methylDirs[1],BOND.CH*s);
  const H3=C1.clone().addScaledVector(methylDirs[2],BOND.CH*s);

  /*
    C2:
    Die C2→C1-Bindung zeigt nach -x.
    O und die beiden H-Atome liegen in den drei übrigen exakten
    Tetraederrichtungen mit x=+1/3.
  */
  const methyleneDirs=idealTetrahedralThree(+1);
  const dirO=methyleneDirs[0];
  const dirH4=methyleneDirs[1];
  const dirH5=methyleneDirs[2];

  const O =C2.clone().addScaledVector(dirO, BOND.CO*s);
  const H4=C2.clone().addScaledVector(dirH4,BOND.CH*s);
  const H5=C2.clone().addScaledVector(dirH5,BOND.CH*s);

  /*
    O-Atom:
    O→C zeigt zurück entlang -dirO.
    O→H wird in derselben Ebene so angeordnet, dass C–O–H exakt 105,4°
    beträgt. Die gewinkelte Geometrie ist dadurch klar sichtbar.
  */
  const oToC=dirO.clone().negate();

  // Senkrechte Richtung in der xy-Ebene; Vorzeichen so gewählt,
  // dass das Hydroxy-H vom Kohlenstoffgerüst weg zeigt.
  const perpendicular=v(
    dirO.y,
    -dirO.x,
    0
  ).normalize();

  const theta=THREE.MathUtils.degToRad(BOND.COH_DEG);
  const oToH=oToC.clone().multiplyScalar(Math.cos(theta))
    .add(perpendicular.multiplyScalar(Math.sin(theta)))
    .normalize();

  const HO=O.clone().addScaledVector(oToH,BOND.OH*s);

  const points={C1,C2,O,H1,H2,H3,H4,H5,HO};

  // Gesamtes Molekül exakt um seinen Bounding-Box-Mittelpunkt zentrieren.
  const box=new THREE.Box3().setFromPoints(Object.values(points));
  const center=box.getCenter(new THREE.Vector3());
  for(const p of Object.values(points))p.sub(center);

  return points;
}

export function buildMolecule(data){
  if(data?.key!=="ETHANOL"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  const g=new THREE.Group();
  g.name="ETHANOL";

  const p=ethanolCoordinates();

  // Bindungsgerüst CH3–CH2–OH
  addBond(g,p.C1,p.C2,"C","C");
  addBond(g,p.C2,p.O,"C","O");
  addBond(g,p.O,p.HO,"O","H");

  // CH3-Gruppe
  addBond(g,p.C1,p.H1,"C","H");
  addBond(g,p.C1,p.H2,"C","H");
  addBond(g,p.C1,p.H3,"C","H");

  // CH2-Gruppe
  addBond(g,p.C2,p.H4,"C","H");
  addBond(g,p.C2,p.H5,"C","H");

  // Atome
  g.add(createAtom("C",p.C1));
  g.add(createAtom("C",p.C2));
  g.add(createAtom("O",p.O));

  g.add(createAtom("H",p.H1));
  g.add(createAtom("H",p.H2));
  g.add(createAtom("H",p.H3));
  g.add(createAtom("H",p.H4));
  g.add(createAtom("H",p.H5));
  g.add(createAtom("H",p.HO));

  return g;
}



export async function createEspSurfaceOverlay(data){
  if(data?.key!=="ETHANOL"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  // Lazy Loading: die quantenchemisch berechnete Oberflächendatei
  // wird erst beim Einblenden geladen.
  const surfaceModule = await import("./ethanolSurfaceData.js");
  const { ETHANOL_ESP_POSITIONS, ETHANOL_ESP_INDICES, ETHANOL_ESP_COLORS } = surfaceModule;

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(ETHANOL_ESP_POSITIONS,3)
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(ETHANOL_ESP_COLORS,3)
  );
  geometry.setIndex(ETHANOL_ESP_INDICES);
  geometry.computeVertexNormals();

  const material=new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:0.74,
    shininess:72,
    specular:0x555555,
    side:THREE.FrontSide,
    depthWrite:true
  });

  const mesh=new THREE.Mesh(geometry,material);
  mesh.renderOrder=3;
  mesh.userData.kind="esp-surface";
  return mesh;
}


export function disposeObject3D(root){
  if(!root)return;
  root.traverse(obj=>{
    if(obj.geometry)obj.geometry.dispose();
    if(obj.material){
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const m of mats){
        if(m?.map)m.map.dispose?.();
        m?.dispose?.();
      }
    }
  });
}

export function disposeMolecule(root){
  if(!root)return;
  root.traverse(obj=>{
    if(obj.geometry)obj.geometry.dispose();
    if(obj.material){
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const m of mats){
        if(m?.map)m.map.dispose?.();
        m?.dispose?.();
      }
    }
  });
}
