import * as THREE from "../libs/three.module.min.js";
import { MOLECULES } from "./moleculeData.js";
import { SURFACES } from "./surfaceData.js";

/*
  Ball-and-Stick-Darstellung aus GeoChemAR epa1.
  Die gesamte EPA-1-Geometrie wird für den Mehrmolekül-Cluster nur
  gleichmäßig auf 50 % skaliert; Proportionen, Kugel-/Stabradien,
  Segmentierung und Materialien bleiben damit exakt im EPA-1-Verhältnis.
*/
const EPA_UNIFORM_SCALE=0.50;
export const ANGSTROM_TO_SCENE=0.033*EPA_UNIFORM_SCALE;
const DATA=MOLECULES.ETHANAL;

const DISPLAY=Object.freeze({
  atomRadius:Object.freeze({
    H:0.0070*EPA_UNIFORM_SCALE,
    C:0.0110*EPA_UNIFORM_SCALE,
    O:0.0100*EPA_UNIFORM_SCALE
  }),
  color:Object.freeze({
    H:0xffffff,
    C:0x202020,
    O:0xd93636,
    bond:0xb8bec7
  }),
  bondRadius:0.0020*EPA_UNIFORM_SCALE,
  doubleBondRadius:0.00155*EPA_UNIFORM_SCALE,
  doubleBondSeparation:0.0034*EPA_UNIFORM_SCALE
});

// ESP-fitted RHF/STO-3G charges, uniformly calibrated so the molecular
// dipole magnitude equals 2.69 D. Atom order matches moleculeData.js ETHANAL.
export const ETHANAL_CHARGES=Object.freeze([
  -0.74898317, 0.80751800, -0.54760863,
   0.15698331, 0.21186732, 0.21195320, -0.09173003
]);
export const POSITIVE_CENTER_ANG=Object.freeze([0.17793577,-0.13195663,0.11047179]);
export const NEGATIVE_CENTER_ANG=Object.freeze([-0.08011782,-0.44194984,0.10411029]);
export const DIPOLE_VECTOR_DEBYE=Object.freeze([1.72080298,2.06715688,0.04242101]);
export const CARBONYL_C_INDEX=1;
export const CARBONYL_O_INDEX=2;

function v(x=0,y=0,z=0){return new THREE.Vector3(x,y,z);}
function decodeB64(b64){const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function atomRadius(element){return DISPLAY.atomRadius[element]??0.004;}

function materialForElement(element){
  return new THREE.MeshStandardMaterial({
    color:DISPLAY.color[element],
    roughness:element==="H"?0.50:0.62,
    metalness:0
  });
}

function createAtom(element,position){
  const radius=atomRadius(element);
  const geometry=new THREE.SphereGeometry(
    radius,
    element==="H"?40:48,
    element==="H"?28:32
  );
  const mesh=new THREE.Mesh(geometry,materialForElement(element));
  mesh.position.copy(position);
  mesh.userData.kind="atom";
  mesh.userData.element=element;
  return mesh;
}

function perpendicularTo(direction,preferred=null){
  if(preferred){
    const p=preferred.clone();
    p.addScaledVector(direction,-p.dot(direction));
    if(p.lengthSq()>1e-10)return p.normalize();
  }
  const refs=[v(1,0,0),v(0,1,0),v(0,0,1)];
  refs.sort((a,b)=>Math.abs(a.dot(direction))-Math.abs(b.dot(direction)));
  const p=refs[0].clone();
  p.addScaledVector(direction,-p.dot(direction));
  return p.normalize();
}

function createBondCylinder(start,end,radius,material){
  const delta=end.clone().sub(start);
  const length=delta.length();
  if(length<=1e-10)return null;
  const direction=delta.clone().normalize();
  const geometry=new THREE.CylinderGeometry(radius,radius,length,32,1,false);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),direction);
  mesh.userData.kind="bond";
  return mesh;
}

function addBond(group,atomA,atomB,elementA,elementB,order=1,preferredDoubleAxis=null){
  const pa=atomA.clone();
  const pb=atomB.clone();
  const axis=pb.clone().sub(pa);
  if(axis.lengthSq()<=1e-12)return;

  const direction=axis.clone().normalize();
  const ra=atomRadius(elementA);
  const rb=atomRadius(elementB);
  const start=pa.clone().addScaledVector(direction,ra);
  const end=pb.clone().addScaledVector(direction,-rb);

  const material=new THREE.MeshStandardMaterial({
    color:DISPLAY.color.bond,
    roughness:0.65,
    metalness:0
  });

  if(order===1){
    const cylinder=createBondCylinder(start,end,DISPLAY.bondRadius,material);
    if(cylinder)group.add(cylinder);
    return;
  }

  const offsetDir=perpendicularTo(direction,preferredDoubleAxis);
  const offset=offsetDir.multiplyScalar(DISPLAY.doubleBondSeparation/2);
  const c1=createBondCylinder(start.clone().add(offset),end.clone().add(offset),DISPLAY.doubleBondRadius,material);
  const c2=createBondCylinder(start.clone().sub(offset),end.clone().sub(offset),DISPLAY.doubleBondRadius,material.clone());
  if(c1)group.add(c1);
  if(c2)group.add(c2);
}

function moleculeCenter(){
  const pts=DATA.atoms.map(a=>v(...a[1]));
  return new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
}
function rawScenePts(center){return DATA.atoms.map(a=>v(...a[1]).sub(center).multiplyScalar(ANGSTROM_TO_SCENE));}

function buildModel(center){
  const group=new THREE.Group();
  const pts=rawScenePts(center);
  for(const [ia,ib,order] of DATA.bonds){
    const preferred=order===2?v(0,0,1):null;
    addBond(group,pts[ia],pts[ib],DATA.atoms[ia][0],DATA.atoms[ib][0],order,preferred);
  }
  for(let i=0;i<DATA.atoms.length;i++)group.add(createAtom(DATA.atoms[i][0],pts[i]));
  return {group,pts};
}

function createSurface(center){
  const raw=SURFACES.ETHANAL;
  const pb=decodeB64(raw.positionsB64);
  const src=new Float32Array(pb.buffer);
  const pos=new Float32Array(src.length);
  for(let i=0;i<src.length;i+=3){
    pos[i]=(src[i]-center.x)*ANGSTROM_TO_SCENE;
    pos[i+1]=(src[i+1]-center.y)*ANGSTROM_TO_SCENE;
    pos[i+2]=(src[i+2]-center.z)*ANGSTROM_TO_SCENE;
  }
  const cb=decodeB64(raw.colorsB64);
  const ib=decodeB64(raw.indicesB64);
  const idx=new Uint32Array(ib.buffer);
  const corrected=new Uint32Array(idx.length);
  for(let i=0;i<idx.length;i+=3){
    corrected[i]=idx[i];corrected[i+1]=idx[i+2];corrected[i+2]=idx[i+1];
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.BufferAttribute(cb,3,true));
  geo.setIndex(new THREE.BufferAttribute(corrected,1));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({
    vertexColors:true,transparent:true,opacity:.86,shininess:72,specular:0x555555,
    side:THREE.FrontSide,depthWrite:false,depthTest:true
  }));
  mesh.renderOrder=3;
  return mesh;
}

export function buildEthanalInstance(){
  const root=new THREE.Group();
  const content=new THREE.Group();
  const center=moleculeCenter();
  const built=buildModel(center);
  const model=built.group;
  const surface=createSurface(center);
  content.add(model,surface);
  root.add(content);

  // Das vollständige sichtbare Objekt wird auf seinen tatsächlichen Mittelpunkt
  // zentriert. Modell und Dichtefläche behalten dabei exakt dieselbe Skalierung.
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().expandByObject(model).expandByObject(surface);
  const visualCenter=box.getCenter(new THREE.Vector3());
  content.position.sub(visualCenter);
  root.updateMatrixWorld(true);

  const shift=visualCenter.clone().multiplyScalar(-1);
  const atomLocalPositions=built.pts.map(p=>p.clone().add(shift));
  const plusLocal=v(...POSITIVE_CENTER_ANG).sub(center).multiplyScalar(ANGSTROM_TO_SCENE).add(shift);
  const minusLocal=v(...NEGATIVE_CENTER_ANG).sub(center).multiplyScalar(ANGSTROM_TO_SCENE).add(shift);
  const moleculeLocalCenter=plusLocal.clone().add(minusLocal).multiplyScalar(.5);

  root.userData.model=model;
  root.userData.surface=surface;
  root.userData.atomLocalPositions=atomLocalPositions;
  root.userData.atomElements=DATA.atoms.map(a=>a[0]);
  root.userData.atomCharges=[...ETHANAL_CHARGES];
  root.userData.plusLocal=plusLocal;
  root.userData.minusLocal=minusLocal;
  root.userData.moleculeLocalCenter=moleculeLocalCenter;
  root.userData.dipoleLocal=v(...DIPOLE_VECTOR_DEBYE).normalize();
  root.userData.carbonylCLocal=atomLocalPositions[CARBONYL_C_INDEX].clone();
  root.userData.carbonylOLocal=atomLocalPositions[CARBONYL_O_INDEX].clone();
  root.userData.isEthanalInstance=true;
  return root;
}

export function setSurfaceVisible(root,visible){if(root?.userData?.surface)root.userData.surface.visible=!!visible;}
export function disposeObject3D(root){
  if(!root)return;
  const gs=new Set(),ms=new Set();
  root.traverse(o=>{
    if(o.geometry)gs.add(o.geometry);
    if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))ms.add(m);}
  });
  for(const g of gs)g.dispose?.();
  for(const m of ms)m.dispose?.();
}
