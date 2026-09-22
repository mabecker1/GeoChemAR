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
const HYDROGEN_BOND_MAX_HO = 3.2 * ANGSTROM_TO_SCENE;

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

function addDashedHydrogenBond(group, startPoint, endPoint){
  const axis = endPoint.clone().sub(startPoint);
  const length = axis.length();
  if(length <= 1e-9) return;
  const direction = axis.clone().normalize();
  const start = startPoint.clone().addScaledVector(direction, DISPLAY.atomRadius.H + 0.0006);
  const end = endPoint.clone().addScaledVector(direction, -(DISPLAY.atomRadius.O + 0.0006));
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

function addGraphEdge(adjacency, degrees, edges, i, j, distance){
  if(i === j) return false;
  if(adjacency[i].has(j)) return false;
  adjacency[i].add(j); adjacency[j].add(i);
  degrees[i]++; degrees[j]++;
  edges.push({ i, j, distance });
  return true;
}

function buildFourNeighborGraph(oxygenPositions){
  const n = oxygenPositions.length;
  const targetDegree = 4;
  const degrees = Array(n).fill(0);
  const adjacency = Array.from({length:n}, ()=>new Set());
  const candidateEdges = [];
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      candidateEdges.push({ i, j, distance: oxygenPositions[i].distanceTo(oxygenPositions[j]) });
    }
  }
  candidateEdges.sort((a,b)=>a.distance-b.distance);

  // Phase 1: greedily connect nearest neighbors while both endpoints still need degree.
  for(const edge of candidateEdges){
    if(degrees[edge.i] >= targetDegree || degrees[edge.j] >= targetDegree) continue;
    addGraphEdge(adjacency, degrees, [], edge.i, edge.j, edge.distance);
  }

  // Rebuild actual edge list from adjacency after phase 1.
  let edges = [];
  for(let i=0;i<n;i++){
    for(const j of adjacency[i]) if(i < j) edges.push({ i, j, distance: oxygenPositions[i].distanceTo(oxygenPositions[j]) });
  }

  // Phase 2: repair underfilled vertices by connecting them to the best available partners.
  let guard = 0;
  while(degrees.some(d=>d < targetDegree) && guard < 5000){
    guard++;
    let progress = false;
    for(let u=0; u<n; u++){
      while(degrees[u] < targetDegree){
        let best = null;
        for(const edge of candidateEdges){
          const usesU = edge.i === u || edge.j === u;
          if(!usesU) continue;
          const v = edge.i === u ? edge.j : edge.i;
          if(adjacency[u].has(v)) continue;
          const penalty = Math.max(0, degrees[v] - (targetDegree - 1)) * 1000;
          const score = edge.distance + penalty;
          if(best === null || score < best.score) best = { v, distance: edge.distance, score };
        }
        if(!best) break;
        if(degrees[best.v] < targetDegree){
          addGraphEdge(adjacency, degrees, edges, u, best.v, best.distance);
          progress = true;
          continue;
        }
        // Swap out the worst edge of v if possible to free one degree slot.
        let replace = null;
        for(const w of adjacency[best.v]){
          if(w === u) continue;
          if(degrees[w] <= targetDegree) continue;
          const d = oxygenPositions[best.v].distanceTo(oxygenPositions[w]);
          if(replace === null || d > replace.distance) replace = { w, distance: d };
        }
        if(!replace) break;
        adjacency[best.v].delete(replace.w); adjacency[replace.w].delete(best.v);
        degrees[best.v]--; degrees[replace.w]--;
        edges = edges.filter(e => !((e.i === best.v && e.j === replace.w) || (e.i === replace.w && e.j === best.v)));
        addGraphEdge(adjacency, degrees, edges, u, best.v, best.distance);
        progress = true;
      }
    }
    if(!progress) break;
  }

  // Final edge list normalized.
  edges = [];
  for(let i=0;i<n;i++){
    for(const j of adjacency[i]) if(i < j) edges.push({ i, j, distance: oxygenPositions[i].distanceTo(oxygenPositions[j]) });
  }
  return { edges, adjacency, degrees };
}

function orientBalancedEuler(nodeCount, edges){
  const adjacency = Array.from({length:nodeCount}, ()=>[]);
  edges.forEach((e, id)=>{
    adjacency[e.i].push({ id, other: e.j });
    adjacency[e.j].push({ id, other: e.i });
  });
  const ptr = Array(nodeCount).fill(0);
  const used = Array(edges.length).fill(false);
  const orientation = Array(edges.length).fill(null);

  for(let start=0; start<nodeCount; start++){
    if(ptr[start] >= adjacency[start].length) continue;
    const stack = [{ v:start, via:null }];
    const tour = [];
    while(stack.length){
      const top = stack[stack.length - 1];
      const list = adjacency[top.v];
      while(ptr[top.v] < list.length && used[list[ptr[top.v]].id]) ptr[top.v]++;
      if(ptr[top.v] < list.length){
        const step = list[ptr[top.v]++];
        if(used[step.id]) continue;
        used[step.id] = true;
        stack.push({ v: step.other, via: { id: step.id, from: top.v, to: step.other } });
      }else{
        const popped = stack.pop();
        if(popped.via) tour.push(popped.via);
      }
    }
    tour.reverse();
    for(const step of tour) orientation[step.id] = { from: step.from, to: step.to };
  }
  return orientation;
}

function computeHydrogenDirectionsFromTargets(targetDir1, targetDir2){
  const d1 = targetDir1.clone().normalize();
  const d2 = targetDir2.clone().normalize();
  let bisector = d1.clone().add(d2);
  if(bisector.lengthSq() < 1e-10) bisector = d1.clone();
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
  return [h1, h2];
}

function makeWaterReferenceCoordinates(scale = 0.026){
  const O = v(0,0,0);
  const half = THREE.MathUtils.degToRad(H_O_H_DEG / 2);
  const H1 = v(Math.sin(half), Math.cos(half), 0).multiplyScalar(O_H * scale);
  const H2 = v(-Math.sin(half), Math.cos(half), 0).multiplyScalar(O_H * scale);
  const points = { O, H1, H2 };
  const box = new THREE.Box3().setFromPoints([O,H1,H2]);
  const center = box.getCenter(new THREE.Vector3());
  for(const p of Object.values(points)) p.sub(center);
  return points;
}

function frameFromWater(O, H1, H2){
  const x = H1.clone().sub(H2).normalize();
  const mid = H1.clone().add(H2).multiplyScalar(0.5);
  const y = mid.clone().sub(O).normalize();
  let z = new THREE.Vector3().crossVectors(x, y);
  if(z.lengthSq() < 1e-12) z = v(0,0,1);
  else z.normalize();
  const xOrtho = new THREE.Vector3().crossVectors(y, z).normalize();
  return { origin: O.clone(), x: xOrtho, y: y.clone(), z };
}

function buildWaterSurfaceTransform(localRef, actualInfo){
  const localFrame = frameFromWater(localRef.O, localRef.H1, localRef.H2);
  const worldFrame = frameFromWater(actualInfo.O, actualInfo.H1, actualInfo.H2);
  const localBond = localRef.O.distanceTo(localRef.H1);
  const worldBond = actualInfo.O.distanceTo(actualInfo.H1);
  const scale = worldBond / localBond;
  const Bworld = new THREE.Matrix4().makeBasis(worldFrame.x, worldFrame.y, worldFrame.z);
  const BlocalInv = new THREE.Matrix4().makeBasis(localFrame.x, localFrame.y, localFrame.z).invert();
  const S = new THREE.Matrix4().makeScale(scale, scale, scale);
  const Tlocal = new THREE.Matrix4().makeTranslation(-localFrame.origin.x, -localFrame.origin.y, -localFrame.origin.z);
  const Tworld = new THREE.Matrix4().makeTranslation(worldFrame.origin.x, worldFrame.origin.y, worldFrame.origin.z);
  return new THREE.Matrix4().multiply(Tworld).multiply(Bworld).multiply(S).multiply(BlocalInv).multiply(Tlocal);
}

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

  const { edges, degrees } = buildFourNeighborGraph(oxygenPositions);
  const orientation = orientBalancedEuler(oxygenPositions.length, edges);
  const donorTargets = Array.from({length: oxygenPositions.length}, ()=>[]);
  const incomingDonors = Array.from({length: oxygenPositions.length}, ()=>[]);

  orientation.forEach((dir, edgeIndex)=>{
    if(!dir) return;
    donorTargets[dir.from].push({ target: dir.to, edgeIndex });
    incomingDonors[dir.to].push({ donor: dir.from, edgeIndex });
  });

  for(let i=0;i<moleculeInfos.length;i++){
    const info = moleculeInfos[i];
    let outgoing = donorTargets[i].slice(0,2);
    if(outgoing.length < 2){
      const fallback = edges.filter(e => e.i === i || e.j === i).map(e => ({ target: e.i === i ? e.j : e.i }));
      for(const candidate of fallback){
        if(outgoing.length >= 2) break;
        if(!outgoing.some(o => o.target === candidate.target)) outgoing.push(candidate);
      }
    }
    if(outgoing.length < 2){
      // Last-resort artificial directions keep the molecule valid.
      const [hDir1, hDir2] = computeHydrogenDirections(info.O, [v(1,0,0), v(-0.25,0.96,0).normalize()]);
      info.H1 = info.O.clone().addScaledVector(hDir1, O_H);
      info.H2 = info.O.clone().addScaledVector(hDir2, O_H);
      continue;
    }
    const dir1 = oxygenPositions[outgoing[0].target].clone().sub(info.O).normalize();
    const dir2 = oxygenPositions[outgoing[1].target].clone().sub(info.O).normalize();
    const [hDir1, hDir2] = computeHydrogenDirectionsFromTargets(dir1, dir2);
    info.H1 = info.O.clone().addScaledVector(hDir1, O_H);
    info.H2 = info.O.clone().addScaledVector(hDir2, O_H);
    outgoing[0].hydrogen = 1;
    outgoing[1].hydrogen = 2;
  }

  for(const m of moleculeInfos){
    m.O.multiplyScalar(ANGSTROM_TO_SCENE);
    m.H1.multiplyScalar(ANGSTROM_TO_SCENE);
    m.H2.multiplyScalar(ANGSTROM_TO_SCENE);
  }

  const hydrogenBonds = [];
  for(let donor=0; donor<donorTargets.length; donor++){
    const outs = donorTargets[donor].slice(0,2);
    for(let k=0; k<outs.length; k++){
      const acceptor = outs[k].target;
      hydrogenBonds.push({ donor, acceptor, hydrogen: k === 0 ? 1 : 2 });
    }
  }

  cachedCluster = {
    moleculeInfos,
    hydrogenBonds,
    stats: {
      minDegree: Math.min(...degrees),
      maxDegree: Math.max(...degrees),
      donorOutMin: Math.min(...donorTargets.map(x=>x.length)),
      donorOutMax: Math.max(...donorTargets.map(x=>x.length)),
      acceptInMin: Math.min(...incomingDonors.map(x=>x.length)),
      acceptInMax: Math.max(...incomingDonors.map(x=>x.length))
    }
  };
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
  const { moleculeInfos, hydrogenBonds } = buildClusterData();
  const group = new THREE.Group();
  group.name = "WATER_HBONDS";

  for(const hb of hydrogenBonds){
    const donor = moleculeInfos[hb.donor];
    const acceptor = moleculeInfos[hb.acceptor];
    const donorH = hb.hydrogen === 1 ? donor.H1 : donor.H2;
    const hToODistance = donorH.distanceTo(acceptor.O);
    // An Randmolekülen dürfen Bindungen fehlen; unplausibel lange H-Brücken werden nicht gezeichnet.
    if(hToODistance <= HYDROGEN_BOND_MAX_HO){
      addDashedHydrogenBond(group, donorH, acceptor.O);
    }
  }
  return group;
}

export async function createSimpleSurfaceOverlay(data){
  if(data?.key !== "WATER_CLUSTER") throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  const mod = await import("./waterSurfaceData.js");
  const { WATER_ESP_POSITIONS, WATER_ESP_INDICES, WATER_ESP_COLORS } = mod;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(WATER_ESP_POSITIONS, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(WATER_ESP_COLORS, 3));
  const flipped = [];
  for(let i=0;i<WATER_ESP_INDICES.length;i+=3){
    flipped.push(WATER_ESP_INDICES[i], WATER_ESP_INDICES[i+2], WATER_ESP_INDICES[i+1]);
  }
  geometry.setIndex(flipped);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    shininess: 72,
    specular: 0x555555,
    side: THREE.FrontSide,
    depthWrite: true
  });

  const group = new THREE.Group();
  group.name = "WATER_CLUSTER_SURFACE";
  const localRef = makeWaterReferenceCoordinates(0.026);
  const { moleculeInfos } = buildClusterData();
  for(const info of moleculeInfos){
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 3;
    mesh.userData.kind = "surface";
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(buildWaterSurfaceTransform(localRef, info));
    group.add(mesh);
  }
  return group;
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
