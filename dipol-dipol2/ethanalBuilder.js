import * as THREE from "../libs/three.module.min.js";
import { MOLECULES } from "./moleculeData.js";
import { SURFACES } from "./surfaceData.js";

export const ANGSTROM_TO_SCENE=0.0125;
const DATA=MOLECULES.ETHANAL;

const DISPLAY=Object.freeze({
  atomRadius:Object.freeze({H:0.0066,C:0.0100,O:0.0096}),
  atomColor:Object.freeze({H:0xf8f8f8,C:0x22252b,O:0xd93636}),
  bondColor:0xb9c0c9,
  bondRadius:0.0017
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

function v(x=0,y=0,z=0){return new THREE.Vector3(x,y,z);}
function decodeB64(b64){const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function atomRadius(element){return DISPLAY.atomRadius[element]??0.008;}
function atomMat(element){return new THREE.MeshStandardMaterial({color:DISPLAY.atomColor[element],roughness:element==="H"?.48:.60,metalness:0});}
function createAtom(element,p){const r=atomRadius(element);const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),atomMat(element));m.position.copy(p);m.userData.element=element;return m;}
function offsetDir(axis){const ref=Math.abs(axis.y)<.86?v(0,1,0):v(1,0,0);return new THREE.Vector3().crossVectors(axis,ref).normalize();}
function createCylinder(a,b,r){const d=b.clone().sub(a);const len=d.length();if(len<1e-7)return null;const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,18,1,false),new THREE.MeshStandardMaterial({color:DISPLAY.bondColor,roughness:.65,metalness:0}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());return m;}
function trimmedEndpoints(a,b,rA,rB,offset=null){const p1=a.clone(),p2=b.clone();const offLen=offset?offset.length():0;if(offset){p1.add(offset);p2.add(offset);}const dir=p2.clone().sub(p1).normalize();const trimA=Math.sqrt(Math.max(0,rA*rA-offLen*offLen));const trimB=Math.sqrt(Math.max(0,rB*rB-offLen*offLen));const gap=.00025;return [p1.addScaledVector(dir,trimA+gap),p2.addScaledVector(dir,-trimB-gap)];}
function addBond(group,b,pts){const [ia,ib,order]=b;const a=pts[ia],c=pts[ib];const ra=atomRadius(DATA.atoms[ia][0]),rb=atomRadius(DATA.atoms[ib][0]);const axis=c.clone().sub(a).normalize(),side=offsetDir(axis),sep=.0026;const add=(rad,off)=>{const [x,y]=trimmedEndpoints(a,c,ra,rb,off);const m=createCylinder(x,y,rad);if(m)group.add(m);};if(order===1)add(DISPLAY.bondRadius,null);else if(order===2){add(.00135,side.clone().multiplyScalar(-sep/2));add(.00135,side.clone().multiplyScalar(sep/2));}else{add(.0012,side.clone().multiplyScalar(-sep));add(.0012,null);add(.0012,side.clone().multiplyScalar(sep));}}
function moleculeCenter(){const pts=DATA.atoms.map(a=>v(...a[1]));return new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());}
function rawScenePts(center){return DATA.atoms.map(a=>v(...a[1]).sub(center).multiplyScalar(ANGSTROM_TO_SCENE));}
function buildModel(center){const g=new THREE.Group();const pts=rawScenePts(center);for(const b of DATA.bonds)addBond(g,b,pts);for(let i=0;i<DATA.atoms.length;i++)g.add(createAtom(DATA.atoms[i][0],pts[i]));return {group:g,pts};}
function createSurface(center){const raw=SURFACES.ETHANAL;const pb=decodeB64(raw.positionsB64),src=new Float32Array(pb.buffer),pos=new Float32Array(src.length);for(let i=0;i<src.length;i+=3){pos[i]=(src[i]-center.x)*ANGSTROM_TO_SCENE;pos[i+1]=(src[i+1]-center.y)*ANGSTROM_TO_SCENE;pos[i+2]=(src[i+2]-center.z)*ANGSTROM_TO_SCENE;}const cb=decodeB64(raw.colorsB64),ib=decodeB64(raw.indicesB64),idx=new Uint32Array(ib.buffer),corr=new Uint32Array(idx.length);for(let i=0;i<idx.length;i+=3){corr[i]=idx[i];corr[i+1]=idx[i+2];corr[i+2]=idx[i+1];}const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(cb,3,true));geo.setIndex(new THREE.BufferAttribute(corr,1));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:.86,shininess:72,specular:0x555555,side:THREE.FrontSide,depthWrite:false,depthTest:true}));mesh.renderOrder=3;return mesh;}

export function buildEthanalInstance(){
  const root=new THREE.Group();
  const content=new THREE.Group();
  const center=moleculeCenter();
  const built=buildModel(center);
  const model=built.group;
  const surface=createSurface(center);
  content.add(model,surface);root.add(content);

  // Center the actual visible union (model + density surface) on the instance origin.
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
  root.userData.isEthanalInstance=true;
  return root;
}

export function setSurfaceVisible(root,visible){if(root?.userData?.surface)root.userData.surface.visible=!!visible;}
export function disposeObject3D(root){if(!root)return;const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))ms.add(m);}});for(const g of gs)g.dispose?.();for(const m of ms)m.dispose?.();}
