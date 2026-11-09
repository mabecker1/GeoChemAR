import * as THREE from "../libs/three.module.min.js";
import {
  WATER_SURFACE_POSITIONS,
  WATER_SURFACE_INDICES,
  WATER_SURFACE_COLORS
} from "./waterSurfaceData.js";
import { HEXANE_SURFACE_DATA } from "./hexaneSurfaceData.js";

/*
  GeoChemAR – Ablenkungsversuch 1a
  Makroebene: feiner senkrechter Flüssigkeitsstrahl, horizontaler negativ geladener Stab.
  Submikroebene: bewegte Molekülreihe im Strahl.
*/

const ANGSTROM_TO_SCENE = 0.033;
const SURFACE_OPACITY = 0.86; // weniger transparent als EN1

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({ H:0.0070, C:0.0110, O:0.0100 }),
  color: Object.freeze({ H:0xffffff, C:0x202020, O:0xd93636, bond:0xb8bec7 }),
  bondRadius: 0.0020
});

function v(x,y,z){ return new THREE.Vector3(x,y,z); }

function atomMaterial(element){
  return new THREE.MeshStandardMaterial({
    color:DISPLAY.color[element],
    roughness:element==="H"?0.48:0.58,
    metalness:0
  });
}

function createAtom(element,position){
  const r=DISPLAY.atomRadius[element];
  const mesh=new THREE.Mesh(
    new THREE.SphereGeometry(r,element==="H"?28:36,element==="H"?20:26),
    atomMaterial(element)
  );
  mesh.position.copy(position);
  mesh.userData.kind="atom";
  return mesh;
}

function createBond(start,end,elementA,elementB){
  const axis=end.clone().sub(start);
  const len=axis.length();
  if(len<1e-9)return null;
  const dir=axis.clone().normalize();
  const a=start.clone().addScaledVector(dir,DISPLAY.atomRadius[elementA]);
  const b=end.clone().addScaledVector(dir,-DISPLAY.atomRadius[elementB]);
  const segment=b.clone().sub(a);
  const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(DISPLAY.bondRadius,DISPLAY.bondRadius,segment.length(),22,1,false),
    new THREE.MeshStandardMaterial({color:DISPLAY.color.bond,roughness:0.62,metalness:0})
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),segment.normalize());
  mesh.userData.kind="bond";
  return mesh;
}

function buildWater(){
  const g=new THREE.Group();
  g.name="H2O";
  const gamma=THREE.MathUtils.degToRad(104.5);
  const half=gamma/2;
  const d=0.958*ANGSTROM_TO_SCENE;
  // Gleiche zentrierte Geometrie wie die in EN1 verwendete Wasser-Oberfläche.
  const rawO=v(0,0,0);
  const rawH1=v( Math.sin(half)*d,0,-Math.cos(half)*d);
  const rawH2=v(-Math.sin(half)*d,0,-Math.cos(half)*d);
  const center=new THREE.Box3().setFromPoints([rawO,rawH1,rawH2]).getCenter(new THREE.Vector3());
  const O=rawO.clone().sub(center);
  const H1=rawH1.clone().sub(center);
  const H2=rawH2.clone().sub(center);
  g.add(createBond(O,H1,"O","H"));
  g.add(createBond(O,H2,"O","H"));
  g.add(createAtom("O",O));
  g.add(createAtom("H",H1));
  g.add(createAtom("H",H2));
  return g;
}

const HEXANE_ATOMS = [
  ["C",[-3.125,-0.445,0.000]],["C",[-1.875,0.445,0.000]],["C",[-0.625,-0.445,0.000]],
  ["C",[0.625,0.445,0.000]],["C",[1.875,-0.445,0.000]],["C",[3.125,0.445,0.000]],
  ["H",[-2.92132,-1.35750,-0.56033]],["H",[-3.95225,0.09044,-0.46589]],["H",[-3.38935,-0.70015,1.02621]],
  ["H",[-1.875,1.07431,0.88998]],["H",[-1.875,1.07431,-0.88998]],
  ["H",[-0.625,-1.07431,-0.88998]],["H",[-0.625,-1.07431,0.88998]],
  ["H",[0.625,1.07431,0.88998]],["H",[0.625,1.07431,-0.88998]],
  ["H",[1.875,-1.07431,-0.88998]],["H",[1.875,-1.07431,0.88998]],
  ["H",[3.72396,0.23020,0.88499]],["H",[2.82496,1.49284,0.00990]],["H",[3.71401,0.24417,-0.89489]]
];

function buildHexane(){
  const g=new THREE.Group();
  g.name="C6H14";
  const atoms=HEXANE_ATOMS.map(([el,p])=>({el,p:v(p[0],p[1],p[2]).multiplyScalar(ANGSTROM_TO_SCENE)}));
  const carbonIndices=[];
  atoms.forEach((a,i)=>{if(a.el==="C")carbonIndices.push(i);});
  for(let i=0;i<carbonIndices.length-1;i++){
    const a=atoms[carbonIndices[i]],b=atoms[carbonIndices[i+1]];
    g.add(createBond(a.p,b.p,"C","C"));
  }
  atoms.forEach((a,i)=>{
    if(a.el!=="H")return;
    let best=null,bestD=Infinity;
    for(const ci of carbonIndices){
      const d=a.p.distanceToSquared(atoms[ci].p);
      if(d<bestD){bestD=d;best=atoms[ci];}
    }
    g.add(createBond(best.p,a.p,"C","H"));
  });
  for(const a of atoms)g.add(createAtom(a.el,a.p));
  return g;
}

function flattenNested(arr){
  if(!Array.isArray(arr))return arr;
  if(!arr.length)return [];
  return Array.isArray(arr[0])?arr.flat():arr;
}

function createSurfaceMesh(positions,indices,colors,scale=1){
  const rawPos=flattenNested(positions);
  const pos=new Float32Array(rawPos.length);
  for(let i=0;i<rawPos.length;i++)pos[i]=rawPos[i]*scale;
  const rawCol=flattenNested(colors);
  const rawIdx=flattenNested(indices);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(rawCol,3));
  geometry.setIndex(rawIdx);
  geometry.computeVertexNormals();
  const material=new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:SURFACE_OPACITY,
    shininess:72,
    specular:0x555555,
    side:THREE.DoubleSide,
    depthWrite:false
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.renderOrder=4;
  mesh.userData.kind="density-surface";
  return mesh;
}

function createDensitySurface(data){
  if(data.key==="water"){
    return createSurfaceMesh(WATER_SURFACE_POSITIONS,WATER_SURFACE_INDICES,WATER_SURFACE_COLORS,1);
  }
  return createSurfaceMesh(
    HEXANE_SURFACE_DATA.positions,
    HEXANE_SURFACE_DATA.indices,
    HEXANE_SURFACE_DATA.colors,
    ANGSTROM_TO_SCENE
  );
}

function createMoleculePrototype(data,withSurface){
  const g=data.key==="water"?buildWater():buildHexane();
  if(withSurface)g.add(createDensitySurface(data));
  return g;
}

function createMinusSprite(worldSize=0.010){
  const canvas=document.createElement("canvas");
  canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,64,64);
  ctx.fillStyle="#ffffff";
  ctx.font="700 54px Arial, sans-serif";
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText("−",32,31);
  const tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false}));
  sprite.scale.set(worldSize,worldSize,1);
  sprite.renderOrder=20;
  return sprite;
}

function createChargedRod({x=0.072,y=-0.004,z=0,length=0.135,radius=0.0085}={}){
  const g=new THREE.Group();
  const rod=new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,length,26,1,false),
    new THREE.MeshStandardMaterial({color:0x344054,roughness:0.5,metalness:0.1})
  );
  rod.rotation.z=-Math.PI/2;
  rod.position.set(x,y,z);
  g.add(rod);

  // Viele kleine negative Ladungszeichen entlang des Stabs.
  const count=18;
  for(let i=0;i<count;i++){
    const s=createMinusSprite(0.0105);
    const sx=(x-length*0.5+0.010)+(i/(count-1))*(length-0.020);
    const row=(i%2===0)?0.0056:-0.0056;
    s.position.set(sx,y+row,z+radius+0.0025);
    g.add(s);
  }
  return g;
}

function createMagnifierSprite(){
  const canvas=document.createElement("canvas");
  canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,256,256);
  ctx.lineCap="round";
  ctx.strokeStyle="rgba(255,255,255,.98)";
  ctx.lineWidth=20;
  ctx.beginPath();ctx.arc(105,103,58,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(147,145);ctx.lineTo(214,212);ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.14)";
  ctx.beginPath();ctx.arc(105,103,48,0,Math.PI*2);ctx.fill();
  const texture=new THREE.CanvasTexture(canvas);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));
  sprite.scale.set(0.063,0.063,1);
  sprite.renderOrder=15;
  sprite.userData.interactive="magnifier";
  sprite.userData.baseScale=0.063;
  return sprite;
}

function createTube(points,{radius=0.005,color=0x9bd7ff,opacity=0.72}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>v(...p)),false,"catmullrom",0.45);
  const geometry=new THREE.TubeGeometry(curve,64,radius,20,false);
  const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity,shininess:80,specular:0xffffff,depthWrite:false});
  return {curve,mesh:new THREE.Mesh(geometry,material)};
}

function createNozzle(x){
  const g=new THREE.Group();
  const glass=new THREE.Mesh(
    new THREE.CylinderGeometry(0.012,0.008,0.052,22,1,false),
    new THREE.MeshPhongMaterial({color:0xdce9f5,transparent:true,opacity:0.62,shininess:90,specular:0xffffff})
  );
  glass.position.set(x,0.156,0);
  g.add(glass);
  const tip=new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075,0.0052,0.026,20,1,false),
    new THREE.MeshPhongMaterial({color:0xcfd8e3,transparent:true,opacity:0.78,shininess:85,specular:0xffffff})
  );
  tip.position.set(x,0.118,0);
  g.add(tip);
  return g;
}

export function buildMacroScene(data){
  const group=new THREE.Group();
  const startX=-0.058;
  group.add(createNozzle(startX));
  group.add(createChargedRod({x:0.074,y:-0.004,length:0.135,radius:0.0085}));

  const points=data.key==="water"
    ? [[startX,0.108,0],[startX,0.070,0],[-0.056,0.038,0],[-0.049,0.014,0],[-0.034,-0.010,0],[-0.018,-0.040,0],[-0.002,-0.080,0],[0.006,-0.122,0]]
    : [[startX,0.108,0],[startX,0.064,0],[startX,0.018,0],[startX,-0.028,0],[startX,-0.076,0],[startX,-0.122,0]];

  const main=createTube(points,{
    radius:data.key==="water"?0.0052:0.0048,
    color:data.key==="water"?0x9edaff:0xdde6ed,
    opacity:data.key==="water"?0.74:0.63
  });
  group.add(main.mesh);
  const highlight=createTube(points,{radius:data.key==="water"?0.0016:0.0014,color:0xffffff,opacity:0.30});
  highlight.mesh.position.z=0.0036;
  group.add(highlight.mesh);

  const magnifier=createMagnifierSprite();
  magnifier.position.set(data.key==="water"?-0.040:startX,0.040,0.018);
  group.add(magnifier);

  return {group,magnifier,interactiveObjects:[magnifier]};
}

function seededEuler(i){
  const a=(i*1.73)%6.28;
  const b=(i*2.41+0.7)%6.28;
  const c=(i*0.93+1.1)%6.28;
  return new THREE.Euler(a,b,c,"XYZ");
}

function createMicroCurve(data){
  const x=-0.052;
  const pts=data.key==="water"
    ? [[x,0.125,0],[x,0.086,0],[-0.051,0.050,0],[-0.043,0.018,0],[-0.028,-0.010,0],[-0.012,-0.044,0],[0.000,-0.086,0],[0.006,-0.126,0]]
    : [[x,0.125,0],[x,0.082,0],[x,0.036,0],[x,-0.010,0],[x,-0.058,0],[x,-0.104,0],[x,-0.126,0]];
  return new THREE.CatmullRomCurve3(pts.map(p=>v(...p)),false,"catmullrom",0.45);
}

export function buildSubmicroScene(data,showSurface=false){
  const group=new THREE.Group();
  group.add(createChargedRod({x:0.074,y:-0.004,length:0.135,radius:0.0085}));

  const curve=createMicroCurve(data);
  const count=data.key==="water"?12:8;
  const prototype=createMoleculePrototype(data,showSurface);
  const molecules=[];

  for(let i=0;i<count;i++){
    const m=prototype.clone(true);
    const scale=data.key==="water"?0.66:0.24;
    m.scale.setScalar(scale);
    m.userData.phase=i/count;
    m.userData.speed=data.key==="water"?0.000115:0.000100;
    m.userData.baseEuler=seededEuler(i);
    m.userData.tumbleSpeed=0.00016+(i%4)*0.000045;
    m.userData.spinAxis=v(0.35+0.11*(i%3),0.48+0.07*((i+1)%3),0.60+0.05*(i%2)).normalize();
    group.add(m);
    molecules.push(m);
  }

  const localWaterPositiveAxis=v(0,0,-1);
  const rodTip=v(0.022,-0.004,0);
  const alignedQuat=new THREE.Quaternion();
  const rollQuat=new THREE.Quaternion();
  const randomQuat=new THREE.Quaternion();
  const desiredQuat=new THREE.Quaternion();
  const q0=new THREE.Quaternion();
  const tempDir=new THREE.Vector3();
  let lastNow=null;

  group.userData.update=(now)=>{
    const dt=Math.min(lastNow===null?0.016:Math.max((now-lastNow)/1000,0),0.05);
    lastNow=now;

    for(let i=0;i<molecules.length;i++){
      const m=molecules[i];
      const t=(m.userData.phase+now*m.userData.speed)%1;
      const p=curve.getPointAt(t);
      m.position.copy(p);

      if(data.key==="water"){
        q0.setFromEuler(m.userData.baseEuler);
        randomQuat.setFromAxisAngle(m.userData.spinAxis,now*m.userData.tumbleSpeed);
        randomQuat.multiply(q0);

        tempDir.copy(rodTip).sub(p).normalize();
        alignedQuat.setFromUnitVectors(localWaterPositiveAxis,tempDir);
        // kleine Drehung um die Dipolachse, die H-Seite bleibt zum negativen Stab gerichtet
        rollQuat.setFromAxisAngle(tempDir,0.06*Math.sin(now*0.0016+i*1.3));
        alignedQuat.premultiply(rollQuat);

        const alignStart=0.26;
        const alignEnd=0.58;
        const s=THREE.MathUtils.smoothstep(t,alignStart,alignEnd);
        desiredQuat.copy(randomQuat).slerp(alignedQuat,s).normalize();

        if(!m.userData.currentQuaternion){
          m.userData.currentQuaternion=desiredQuat.clone();
        }
        const current=m.userData.currentQuaternion;
        if(current.dot(desiredQuat)<0)desiredQuat.multiplyScalar(-1);
        const turnSpeed=2.8+3.6*s;
        current.rotateTowards(desiredQuat,turnSpeed*dt);
        current.normalize();
        m.quaternion.copy(current);
      }else{
        q0.setFromEuler(m.userData.baseEuler);
        const qSpin=new THREE.Quaternion().setFromAxisAngle(m.userData.spinAxis,now*m.userData.tumbleSpeed);
        m.quaternion.copy(qSpin).multiply(q0);
      }
    }
  };

  group.userData.densityVisible=showSurface;
  return group;
}

export function setDensityVisibility(root,visible){
  root.traverse(obj=>{
    if(obj.userData?.kind==="density-surface")obj.visible=visible;
  });
  root.userData.densityVisible=visible;
}

export function disposeObject3D(root){
  if(!root)return;
  const geometries=new Set();
  const materials=new Set();
  const textures=new Set();
  root.traverse(obj=>{
    if(obj.geometry)geometries.add(obj.geometry);
    const mats=obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[];
    for(const m of mats){
      materials.add(m);
      if(m.map)textures.add(m.map);
    }
  });
  for(const t of textures)t.dispose?.();
  for(const m of materials)m.dispose?.();
  for(const g of geometries)g.dispose?.();
}
