import * as THREE from "../libs/three.module.min.js";
import { MOLECULES, ORDER } from "./moleculeData.js";
import { SURFACES, SURFACE_META } from "./surfaceData.js";

const ANGSTROM_TO_SCENE=0.0125;
const POSITIONS=Object.freeze({
  PROPANE:new THREE.Vector3(-0.082,0.032,0),
  ETHANAL:new THREE.Vector3(0,0.032,0),
  ETHANOL:new THREE.Vector3(0.082,0.032,0)
});
const DISPLAY=Object.freeze({
  atomRadius:Object.freeze({H:0.0066,C:0.0100,O:0.0096}),
  atomColor:Object.freeze({H:0xf8f8f8,C:0x22252b,O:0xd93636}),
  bondColor:0xb9c0c9,
  bondRadius:0.0017
});

function v(x=0,y=0,z=0){return new THREE.Vector3(x,y,z);}
function decodeB64(b64){const bin=atob(b64);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}

function atomMat(element){return new THREE.MeshStandardMaterial({color:DISPLAY.atomColor[element],roughness:element==="H"?0.48:0.60,metalness:0});}
function atomRadius(element){return DISPLAY.atomRadius[element]??0.008;}
function createAtom(element,p){const r=atomRadius(element);const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),atomMat(element));m.position.copy(p);return m;}
function offsetDir(axis){const ref=Math.abs(axis.y)<0.86?v(0,1,0):v(1,0,0);return new THREE.Vector3().crossVectors(axis,ref).normalize();}
function createCylinder(a,b,r,offset=null){const p1=a.clone(),p2=b.clone();if(offset){p1.add(offset);p2.add(offset);}const d=p2.clone().sub(p1);const len=d.length();if(len<1e-7)return null;const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,18,1,false),new THREE.MeshStandardMaterial({color:DISPLAY.bondColor,roughness:.65,metalness:0}));m.position.copy(p1).add(p2).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());return m;}
function trimmedEndpoints(a,b,rA,rB,offset=null){const p1=a.clone(),p2=b.clone();const offLen=offset?offset.length():0;if(offset){p1.add(offset);p2.add(offset);}const dir=p2.clone().sub(p1).normalize();const trimA=Math.sqrt(Math.max(0,rA*rA-offLen*offLen));const trimB=Math.sqrt(Math.max(0,rB*rB-offLen*offLen));const gap=.00025;return [p1.addScaledVector(dir,trimA+gap),p2.addScaledVector(dir,-trimB-gap)];}
function addBond(group,data,b,pts){const [ia,ib,order]=b;const a=pts[ia],c=pts[ib];const ra=atomRadius(data.atoms[ia][0]),rb=atomRadius(data.atoms[ib][0]);const axis=c.clone().sub(a).normalize(),side=offsetDir(axis),sep=.0026;const add=(rad,off)=>{const [x,y]=trimmedEndpoints(a,c,ra,rb,off);const m=createCylinder(x,y,rad);if(m)group.add(m);};if(order===1)add(DISPLAY.bondRadius,null);else if(order===2){add(.00135,side.clone().multiplyScalar(-sep/2));add(.00135,side.clone().multiplyScalar(sep/2));}else{add(.0012,side.clone().multiplyScalar(-sep));add(.0012,null);add(.0012,side.clone().multiplyScalar(sep));}}
function moleculeCenter(data){const pts=data.atoms.map(a=>v(...a[1]));return new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());}
function scenePts(data,center){return data.atoms.map(a=>v(...a[1]).sub(center).multiplyScalar(ANGSTROM_TO_SCENE));}
function buildModel(data){const g=new THREE.Group();const c=moleculeCenter(data);const pts=scenePts(data,c);for(const b of data.bonds)addBond(g,data,b,pts);for(let i=0;i<data.atoms.length;i++)g.add(createAtom(data.atoms[i][0],pts[i]));return {group:g,center:c};}
function createSurface(key,center){const raw=SURFACES[key];const pb=decodeB64(raw.positionsB64),src=new Float32Array(pb.buffer),pos=new Float32Array(src.length);for(let i=0;i<src.length;i+=3){pos[i]=(src[i]-center.x)*ANGSTROM_TO_SCENE;pos[i+1]=(src[i+1]-center.y)*ANGSTROM_TO_SCENE;pos[i+2]=(src[i+2]-center.z)*ANGSTROM_TO_SCENE;}const cb=decodeB64(raw.colorsB64),ib=decodeB64(raw.indicesB64),idx=new Uint32Array(ib.buffer),corr=new Uint32Array(idx.length);for(let i=0;i<idx.length;i+=3){corr[i]=idx[i];corr[i+1]=idx[i+2];corr[i+2]=idx[i+1];}const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(pos,3));geo.setAttribute("color",new THREE.BufferAttribute(cb,3,true));geo.setIndex(new THREE.BufferAttribute(corr,1));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:.86,shininess:72,specular:0x555555,side:THREE.FrontSide,depthWrite:false}));mesh.renderOrder=3;return mesh;}

export function buildComparison(){const root=new THREE.Group();const entries={};for(const key of ORDER){const data=MOLECULES[key],wrap=new THREE.Group();wrap.position.copy(POSITIONS[key]);const built=buildModel(data),model=built.group,surface=createSurface(key,built.center);wrap.add(model,surface);root.add(wrap);entries[key]={wrap,model,surface,data};}root.userData.entries=entries;root.userData.surfaceMeta=SURFACE_META;return root;}
export function setComparisonState(root,{surfaces=true,mode="PROPANE"}={}){const entries=root?.userData?.entries;if(!entries)return;for(const key of ORDER){const on=mode===key;entries[key].wrap.visible=on;entries[key].wrap.position.copy(on?new THREE.Vector3(0,0.032,0):POSITIONS[key]);entries[key].model.visible=on;entries[key].surface.visible=on&&surfaces;}}
export function disposeObject3D(root){if(!root)return;const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))ms.add(m);}});for(const g of gs)g.dispose?.();for(const m of ms)m.dispose?.();}
