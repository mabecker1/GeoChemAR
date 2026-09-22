import * as THREE from "../libs/three.module.min.js";

const ANGSTROM_TO_SCENE = 0.026;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({ H: 0.0068, C: 0.0108, O: 0.0100 }),
  color: Object.freeze({ H: 0xffffff, C: 0x202020, O: 0xd93636, bond: 0xb8bec7 }),
  bondRadius: 0.00195
});

const BOND = Object.freeze({
  CH: 1.09, CC: 1.512, CO: 1.431, OH: 0.971, WATER_OH: 0.958,
  TETRAHEDRAL_DEG: 109.47122063449069, COH_DEG: 105.4, HOH_DEG: 104.5
});

function v(x,y,z){ return new THREE.Vector3(x,y,z); }
function materialForElement(element){ return new THREE.MeshStandardMaterial({ color: DISPLAY.color[element], roughness: element==="H" ? 0.50 : 0.62, metalness: 0 }); }
function createAtom(element, position){
  const radius = DISPLAY.atomRadius[element];
  const geometry = new THREE.SphereGeometry(radius, element==="H" ? 40 : 48, element==="H" ? 28 : 32);
  const mesh = new THREE.Mesh(geometry, materialForElement(element));
  mesh.position.copy(position); mesh.userData.kind="atom"; mesh.userData.element=element; return mesh;
}
function createBondCylinder(start, end, radius, material){
  const delta=end.clone().sub(start), length=delta.length(), direction=delta.clone().normalize();
  const geometry=new THREE.CylinderGeometry(radius, radius, length, 28, 1, false);
  const mesh=new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0), direction);
  mesh.userData.kind="bond"; return mesh;
}
function addBond(group, atomA, atomB, elementA, elementB){
  const axis=atomB.clone().sub(atomA); if(axis.lengthSq()<=1e-12)return;
  const direction=axis.clone().normalize();
  const start=atomA.clone().addScaledVector(direction, DISPLAY.atomRadius[elementA]);
  const end=atomB.clone().addScaledVector(direction, -DISPLAY.atomRadius[elementB]);
  const material=new THREE.MeshStandardMaterial({color:DISPLAY.color.bond, roughness:0.65, metalness:0});
  group.add(createBondCylinder(start,end,DISPLAY.bondRadius,material));
}
function idealTetrahedralThree(oppositeXSign){
  const x=oppositeXSign/3, radial=2*Math.sqrt(2)/3;
  return [0,120,240].map(phiDeg=>{ const phi=THREE.MathUtils.degToRad(phiDeg); return v(x, radial*Math.cos(phi), radial*Math.sin(phi)).normalize(); });
}
function centerPoints(points){ const box=new THREE.Box3().setFromPoints(Object.values(points)); const center=box.getCenter(new THREE.Vector3()); for(const p of Object.values(points))p.sub(center); return points; }
function ethanolCoordinates(){
  const s=ANGSTROM_TO_SCENE;
  const C1=v(-BOND.CC*s/2,0,0), C2=v(BOND.CC*s/2,0,0);
  const methylDirs=idealTetrahedralThree(-1);
  const H1=C1.clone().addScaledVector(methylDirs[0],BOND.CH*s), H2=C1.clone().addScaledVector(methylDirs[1],BOND.CH*s), H3=C1.clone().addScaledVector(methylDirs[2],BOND.CH*s);
  const methyleneDirs=idealTetrahedralThree(+1), dirO=methyleneDirs[0], dirH4=methyleneDirs[1], dirH5=methyleneDirs[2];
  const O=C2.clone().addScaledVector(dirO,BOND.CO*s), H4=C2.clone().addScaledVector(dirH4,BOND.CH*s), H5=C2.clone().addScaledVector(dirH5,BOND.CH*s);
  const oToC=dirO.clone().negate(), perpendicular=v(dirO.y,-dirO.x,0).normalize();
  const theta=THREE.MathUtils.degToRad(BOND.COH_DEG);
  const oToH=oToC.clone().multiplyScalar(Math.cos(theta)).add(perpendicular.multiplyScalar(Math.sin(theta))).normalize();
  const HO=O.clone().addScaledVector(oToH,BOND.OH*s);
  return centerPoints({C1,C2,O,H1,H2,H3,H4,H5,HO});
}
function waterCoordinates(){
  const s=ANGSTROM_TO_SCENE, O=v(0,0,0); const half=THREE.MathUtils.degToRad(BOND.HOH_DEG/2);
  const H1=v(Math.sin(half),Math.cos(half),0).multiplyScalar(BOND.WATER_OH*s);
  const H2=v(-Math.sin(half),Math.cos(half),0).multiplyScalar(BOND.WATER_OH*s);
  return centerPoints({O,H1,H2});
}
function buildEthanol(){
  const g=new THREE.Group(); g.name="ETHANOL"; const p=ethanolCoordinates();
  addBond(g,p.C1,p.C2,"C","C"); addBond(g,p.C2,p.O,"C","O"); addBond(g,p.O,p.HO,"O","H"); addBond(g,p.C1,p.H1,"C","H"); addBond(g,p.C1,p.H2,"C","H"); addBond(g,p.C1,p.H3,"C","H"); addBond(g,p.C2,p.H4,"C","H"); addBond(g,p.C2,p.H5,"C","H");
  g.add(createAtom("C",p.C1)); g.add(createAtom("C",p.C2)); g.add(createAtom("O",p.O)); g.add(createAtom("H",p.H1)); g.add(createAtom("H",p.H2)); g.add(createAtom("H",p.H3)); g.add(createAtom("H",p.H4)); g.add(createAtom("H",p.H5)); g.add(createAtom("H",p.HO));
  return g;
}
function buildWater(){
  const g=new THREE.Group(); g.name="H2O"; const p=waterCoordinates();
  addBond(g,p.O,p.H1,"O","H"); addBond(g,p.O,p.H2,"O","H");
  g.add(createAtom("O",p.O)); g.add(createAtom("H",p.H1)); g.add(createAtom("H",p.H2));
  return g;
}
export function buildMolecule(data){
  switch(data?.key){ case "ETHANOL": return buildEthanol(); case "H2O": return buildWater(); default: throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`); }
}
function createSurfaceMesh(positions, indices, colors, {flipWinding=false}={}){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors,3));
  let finalIndices=indices;
  if(flipWinding){ finalIndices=[]; for(let i=0;i<indices.length;i+=3) finalIndices.push(indices[i],indices[i+2],indices[i+1]); }
  geometry.setIndex(finalIndices); geometry.computeVertexNormals();
  const material=new THREE.MeshPhongMaterial({ vertexColors:true, transparent:true, opacity:0.88, shininess:72, specular:0x555555, side:THREE.FrontSide, depthWrite:true });
  const mesh=new THREE.Mesh(geometry,material); mesh.renderOrder=3; mesh.userData.kind="esp-surface"; return mesh;
}
export async function createEspSurfaceOverlay(data){
  switch(data?.key){
    case "ETHANOL": { const surfaceModule=await import("./ethanolSurfaceData.js"); const { ETHANOL_ESP_POSITIONS, ETHANOL_ESP_INDICES, ETHANOL_ESP_COLORS }=surfaceModule; return createSurfaceMesh(ETHANOL_ESP_POSITIONS,ETHANOL_ESP_INDICES,ETHANOL_ESP_COLORS,{flipWinding:true}); }
    case "H2O": { const surfaceModule=await import("./waterSurfaceData.js"); const { WATER_ESP_POSITIONS, WATER_ESP_INDICES, WATER_ESP_COLORS }=surfaceModule; return createSurfaceMesh(WATER_ESP_POSITIONS,WATER_ESP_INDICES,WATER_ESP_COLORS,{flipWinding:false}); }
    default: throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
}
export function disposeObject3D(root){ if(!root)return; root.traverse(obj=>{ if(obj.geometry)obj.geometry.dispose(); if(obj.material){ const mats=Array.isArray(obj.material)?obj.material:[obj.material]; for(const m of mats){ if(m?.map)m.map.dispose?.(); m?.dispose?.(); } } }); }
export function disposeMolecule(root){ disposeObject3D(root); }
