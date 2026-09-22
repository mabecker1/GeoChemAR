import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Wasser-Version 4
  - 100 Wassermoleküle im EPA-Ball-and-Stick-Stil
  - intermolekulare Abstände gegenüber Version 3 halbiert
  - Wasserstoffbrücken als optionales Overlay
  - zusätzliche einfache gemeinsame Cluster-Oberfläche
*/

const ANGSTROM_TO_SCENE = 0.033;
const O_H = 0.958;
const H_O_H_DEG = 104.5;
const O_O_TARGET = 2.90;
const MOLECULE_COUNT = 100;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    H: 0.0070,
    O: 0.0100
  }),
  color: Object.freeze({
    H: 0xffffff,
    O: 0xd93636,
    bond: 0xbfc7d2,
    hbond: 0x7fb8ff,
    surface: 0xa7dbff
  }),
  bondRadius: 0.0020,
  hBondRadius: 0.00070
});

function v(x,y,z){ return new THREE.Vector3(x,y,z); }

function materialForElement(element){
  return new THREE.MeshStandardMaterial({
    color: DISPLAY.color[element],
    roughness: element === "H" ? 0.43 : 0.58,
    metalness: 0
  });
}

function createAtom(element, position){
  const radius = DISPLAY.atomRadius[element];
  const geometry = new THREE.SphereGeometry(radius, element === "H" ? 40 : 48, element === "H" ? 28 : 32);
  const mesh = new THREE.Mesh(geometry, materialForElement(element));
  mesh.position.copy(position);
  mesh.userData.kind = "atom";
  mesh.userData.element = element;
  return mesh;
}

function createCylinder(start, end, radius, material){
  const delta = end.clone().sub(start);
  const length = delta.length();
  const direction = delta.clone().normalize();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 32, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0), direction);
  return mesh;
}

function addBond(group, atomA, atomB, elementA, elementB){
  const axis = atomB.clone().sub(atomA);
  if(axis.lengthSq() <= 1e-12) return;
  const direction = axis.clone().normalize();
  const start = atomA.clone().addScaledVector(direction, DISPLAY.atomRadius[elementA]);
  const end = atomB.clone().addScaledVector(direction, -DISPLAY.atomRadius[elementB]);
  const material = new THREE.MeshStandardMaterial({ color: DISPLAY.color.bond, roughness: 0.65, metalness: 0 });
  const mesh = createCylinder(start, end, DISPLAY.bondRadius, material);
  mesh.userData.kind = "bond";
  group.add(mesh);
}

function addDashedHydrogenBond(group, oxygenA, oxygenB){
  const axis = oxygenB.clone().sub(oxygenA);
  const length = axis.length();
  if(length <= 1e-9) return;
  const direction = axis.clone().normalize();
  const start = oxygenA.clone().addScaledVector(direction, DISPLAY.atomRadius.O + 0.0005);
  const end = oxygenB.clone().addScaledVector(direction, -(DISPLAY.atomRadius.O + 0.0005));
  const usable = end.clone().sub(start);
  const usableLength = usable.length();
  if(usableLength <= 1e-9) return;
  const dashCount = Math.max(3, Math.min(7, Math.round(usableLength / 0.012)));
  const gapFactor = 0.42;
  const segment = usableLength / dashCount;
  const dashLength = segment * (1 - gapFactor);
  const material = new THREE.MeshStandardMaterial({ color: DISPLAY.color.hbond, transparent: true, opacity: 0.84, roughness: 0.55, metalness: 0 });
  for(let i=0;i<dashCount;i++){
    const a = start.clone().addScaledVector(direction, i * segment + segment * gapFactor * 0.5);
    const b = a.clone().addScaledVector(direction, dashLength);
    const dash = createCylinder(a, b, DISPLAY.hBondRadius, material.clone());
    dash.userData.kind = "hbond";
    group.add(dash);
  }
}

let cachedCluster = null;

function chooseDonorDirections(position, neighborDirections){
  if(neighborDirections.length < 2) return [v(1,0,0), v(-0.25,0.96,0).normalize()];
  const outward = position.lengthSq() > 1e-12 ? position.clone().normalize() : v(0,0,1);
  let bestPair = [neighborDirections[0], neighborDirections[1]];
  let bestScore = -Infinity;
  for(let i=0;i<neighborDirections.length;i++){
    for(let j=i+1;j<neighborDirections.length;j++){
      const a = neighborDirections[i], b = neighborDirections[j];
      const radialScore = a.dot(outward) + b.dot(outward);
      const separationScore = -Math.abs(a.dot(b) + 1/3);
      const score = radialScore + 0.65 * separationScore;
      if(score > bestScore){ bestScore = score; bestPair = [a,b]; }
    }
  }
  return bestPair;
}

function computeHydrogenDirections(position, neighborDirections){
  const [d1,d2] = chooseDonorDirections(position, neighborDirections);
  const bisector = d1.clone().add(d2);
  if(bisector.lengthSq() < 1e-10) return [d1.clone(), d2.clone()];
  bisector.normalize();
  let planeAxis = d1.clone().sub(d2);
  if(planeAxis.lengthSq() < 1e-10){
    planeAxis = new THREE.Vector3(1,0,0).cross(bisector);
    if(planeAxis.lengthSq() < 1e-10) planeAxis = new THREE.Vector3(0,1,0).cross(bisector);
  }
  planeAxis.normalize();
  const halfAngle = THREE.MathUtils.degToRad(H_O_H_DEG * 0.5);
  const c = Math.cos(halfAngle), s = Math.sin(halfAngle);
  const h1 = bisector.clone().multiplyScalar(c).add(planeAxis.clone().multiplyScalar(s)).normalize();
  const h2 = bisector.clone().multiplyScalar(c).add(planeAxis.clone().multiplyScalar(-s)).normalize();
  return [h1,h2];
}

function generateDiamondPoints(targetCount = MOLECULE_COUNT){
  const a = O_O_TARGET * 4 / Math.sqrt(3);
  const basis = [[0,0,0],[0.25,0.25,0.25],[0,0.5,0.5],[0.25,0.75,0.75],[0.5,0,0.5],[0.75,0.25,0.75],[0.5,0.5,0],[0.75,0.75,0.25]];
  const points = [];
  for(let i=-3;i<=3;i++){ for(let j=-3;j<=3;j++){ for(let k=-3;k<=3;k++){ for(const b of basis){ points.push(v((i+b[0])*a,(j+b[1])*a,(k+b[2])*a)); } } } }
  points.sort((p,q)=>p.lengthSq()-q.lengthSq());
  const selected = points.slice(0, targetCount).map(p=>p.clone());
  for(let idx=0; idx<selected.length; idx++){
    const p = selected[idx];
    if(p.length() < 1e-9) continue;
    const n = p.clone().normalize();
    const tangent = new THREE.Vector3(-n.y, n.x, 0);
    if(tangent.lengthSq() < 1e-10) tangent.set(1,0,0);
    tangent.normalize();
    const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();
    const wobble1 = Math.sin(idx * 1.73) * 0.11;
    const wobble2 = Math.cos(idx * 1.11) * 0.09;
    p.addScaledVector(tangent, wobble1);
    p.addScaledVector(bitangent, wobble2);
  }
  const center = selected.reduce((acc,p)=>acc.add(p), new THREE.Vector3()).multiplyScalar(1/selected.length);
  for(const p of selected) p.sub(center);
  return selected;
}

function buildClusterData(){
  if(cachedCluster) return cachedCluster;
  const oxygenPositions = generateDiamondPoints(MOLECULE_COUNT);
  const moleculeInfos = oxygenPositions.map((p,index)=>({ index, O: p.clone(), H1: null, H2: null }));
  const neighborThreshold = 3.25;
  const edges = [];
  const neighbors = Array.from({length: oxygenPositions.length}, ()=>[]);
  for(let i=0;i<oxygenPositions.length;i++){
    for(let j=i+1;j<oxygenPositions.length;j++){
      const d = oxygenPositions[i].distanceTo(oxygenPositions[j]);
      if(d <= neighborThreshold){
        edges.push([i,j,d]);
        neighbors[i].push({index:j, distance:d, dir:oxygenPositions[j].clone().sub(oxygenPositions[i]).normalize()});
        neighbors[j].push({index:i, distance:d, dir:oxygenPositions[i].clone().sub(oxygenPositions[j]).normalize()});
      }
    }
  }
  for(const arr of neighbors) arr.sort((a,b)=>a.distance-b.distance);
  for(let i=0;i<moleculeInfos.length;i++){
    const info = moleculeInfos[i];
    const neighborDirs = neighbors[i].slice(0,4).map(n=>n.dir.clone());
    const [hDir1,hDir2] = computeHydrogenDirections(info.O, neighborDirs);
    info.H1 = info.O.clone().addScaledVector(hDir1, O_H);
    info.H2 = info.O.clone().addScaledVector(hDir2, O_H);
  }
  for(const m of moleculeInfos){
    m.O.multiplyScalar(ANGSTROM_TO_SCENE);
    m.H1.multiplyScalar(ANGSTROM_TO_SCENE);
    m.H2.multiplyScalar(ANGSTROM_TO_SCENE);
  }
  const scaledEdges = edges.map(([i,j,d])=>({ i, j, distance: d * ANGSTROM_TO_SCENE }));
  cachedCluster = { moleculeInfos, hydrogenBondEdges: scaledEdges };
  return cachedCluster;
}

export function buildMolecule(data){
  if(data?.key !== "WATER_CLUSTER") throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  const { moleculeInfos } = buildClusterData();
  const root = new THREE.Group();
  root.name = "WATER_CLUSTER";
  for(const info of moleculeInfos){
    addBond(root, info.O, info.H1, "O", "H");
    addBond(root, info.O, info.H2, "O", "H");
    root.add(createAtom("O", info.O));
    root.add(createAtom("H", info.H1));
    root.add(createAtom("H", info.H2));
  }
  return root;
}

export async function createHydrogenBondOverlay(data){
  if(data?.key !== "WATER_CLUSTER") throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  const { moleculeInfos, hydrogenBondEdges } = buildClusterData();
  const group = new THREE.Group();
  group.name = "WATER_HBONDS";
  for(const edge of hydrogenBondEdges){
    addDashedHydrogenBond(group, moleculeInfos[edge.i].O, moleculeInfos[edge.j].O);
  }
  return group;
}

export async function createSimpleSurfaceOverlay(data){
  if(data?.key !== "WATER_CLUSTER") throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  const mod = await import("./waterClusterSurfaceData.js");
  const { WATER_CLUSTER_SURFACE_POSITIONS, WATER_CLUSTER_SURFACE_INDICES } = mod;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(WATER_CLUSTER_SURFACE_POSITIONS, 3));
  const flipped = [];
  for(let i=0;i<WATER_CLUSTER_SURFACE_INDICES.length;i+=3){
    flipped.push(WATER_CLUSTER_SURFACE_INDICES[i], WATER_CLUSTER_SURFACE_INDICES[i+2], WATER_CLUSTER_SURFACE_INDICES[i+1]);
  }
  geometry.setIndex(flipped);
  geometry.computeVertexNormals();
  const material = new THREE.MeshPhongMaterial({
    color: DISPLAY.color.surface,
    transparent: true,
    opacity: 0.26,
    shininess: 60,
    specular: 0x7aa8c8,
    side: THREE.FrontSide,
    depthWrite: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "WATER_CLUSTER_SURFACE";
  mesh.renderOrder = 3;
  mesh.userData.kind = "surface";
  return mesh;
}

export function disposeObject3D(root){
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

export function disposeMolecule(root){ disposeObject3D(root); }
