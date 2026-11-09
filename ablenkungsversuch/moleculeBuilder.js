import * as THREE from "../libs/three.module.min.js";
import {
  WATER_SURFACE_POSITIONS,
  WATER_SURFACE_INDICES,
  WATER_SURFACE_COLORS
} from "./waterSurfaceData.js";
import { HEXANE_SURFACE_DATA } from "./hexaneSurfaceData.js";

/*
  GeoChemAR – Ablenkungsversuch 1g
  Makroebene: feiner senkrechter Flüssigkeitsstrahl und schräg geführter negativ geladener Stab.
  Der Wasserstrahl wird nun deutlich stärker und weiterhin geometrisch korrekt zur Stabmantelfläche hin abgelenkt.
  Für Wasser und Hexan wird der Stababstand getrennt gewählt; bei Hexan ist er extra groß, damit keine Moleküle den Stab schneiden.
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

const STREAM_X=-0.058;
const STREAM_Z=0;
const ROD_AXIS=v(1,0.27,0.08).normalize();
const ROD_BASE_CENTER=v(0.018,-0.012,-0.010);
const ROD_LENGTH=0.190;
const ROD_RADIUS=0.0085;

/* 1f: Der Stab bleibt exakt in der in 1e korrigierten Orientierung.
   Nur sein Abstand zum Strahl wird vergrößert. Weil der Stab in der
   Projektion am Strahl vorbeilaufen soll, liegt der reale Abstand vor
   allem in der Tiefe. Wir verschieben daher entlang der echten kürzesten
   Verbindung zwischen senkrechter Strahlachse und Stabachse. */
function getRodGapDirection(center=ROD_BASE_CENTER){
  const denom=ROD_AXIS.x*ROD_AXIS.x+ROD_AXIS.z*ROD_AXIS.z;
  if(denom<1e-10)return v(0,0,-1);
  const half=ROD_LENGTH*0.5;
  const t=THREE.MathUtils.clamp(
    -(((center.x-STREAM_X)*ROD_AXIS.x)+((center.z-STREAM_Z)*ROD_AXIS.z))/denom,
    -half,half
  );
  const closest=center.clone().addScaledVector(ROD_AXIS,t);
  const dir=v(closest.x-STREAM_X,0,closest.z-STREAM_Z);
  return dir.lengthSq()>1e-12?dir.normalize():v(0,0,-1);
}

const ROD_GAP_DIRECTION=getRodGapDirection();
const WATER_ROD_DISTANCE_INCREASE=0.018;  // größerer Abstand, aber sichtbare Ablenkung bleibt gut erkennbar
const HEXANE_ROD_DISTANCE_INCREASE=0.028; // besonders groß, damit Hexan-Moleküle den Stab sicher nicht schneiden

function getRodCenterForKey(key="water"){
  const distanceIncrease=key==="hexane"?HEXANE_ROD_DISTANCE_INCREASE:WATER_ROD_DISTANCE_INCREASE;
  return ROD_BASE_CENTER.clone().addScaledVector(ROD_GAP_DIRECTION,distanceIncrease);
}

function createChargedRod({center=getRodCenterForKey("water"),axis=ROD_AXIS,length=ROD_LENGTH,radius=ROD_RADIUS}={}){
  const g=new THREE.Group();
  g.position.copy(center);
  g.quaternion.setFromUnitVectors(v(0,1,0),axis.clone().normalize());

  const rod=new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,length,30,1,false),
    new THREE.MeshStandardMaterial({color:0x344054,roughness:0.5,metalness:0.1})
  );
  g.add(rod);

  // Viele kleine negative Ladungszeichen entlang der sichtbaren Mantelfläche.
  // Die Zeichen liegen im lokalen Stab-Koordinatensystem und drehen sich daher
  // exakt mit der schrägen Stabachse mit.
  const count=22;
  for(let i=0;i<count;i++){
    const s=createMinusSprite(0.0078);
    const sy=(-length*0.5+0.012)+(i/(count-1))*(length-0.024);
    const sideOffset=(i%2===0)?-0.0028:0.0028;
    s.position.set(sideOffset,sy,radius+0.0020);
    g.add(s);
  }
  return g;
}

function closestPointOnRodAxis(point,rodCenter,target=new THREE.Vector3()){
  const rel=point.clone().sub(rodCenter);
  const half=ROD_LENGTH*0.5;
  const along=THREE.MathUtils.clamp(rel.dot(ROD_AXIS),-half,half);
  return target.copy(rodCenter).addScaledVector(ROD_AXIS,along);
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

function createWaterStreamPoints({micro=false}={}){
  /*
    Die Screenshots des realen Versuchs zeigen:
    - oberhalb des Stabs zunächst nahezu senkrechter Verlauf,
    - erst im Nahbereich zunehmende Krümmung,
    - danach einseitiges Weiterlaufen in der bereits aufgebauten Ablenkungsrichtung.

    Die Richtung ist NICHT mehr fest +x wie in 1e, sondern die tatsächliche
    kürzeste 3D-Richtung vom Strahl zur Stabachse. Dadurch passt die Kurve
    auch beim Drehen des Aufbaus immer zur sichtbaren Stabseite.
  */
  const ys=micro
    ? [0.125,0.093,0.064,0.038,0.014,-0.012,-0.041,-0.078,-0.126]
    : [0.108,0.078,0.052,0.030,0.008,-0.016,-0.043,-0.077,-0.122];
  const offsets=micro
    ? [0,0,0.0003,0.0012,0.0046,0.0105,0.0190,0.0300,0.0430]
    : [0,0,0.0003,0.0013,0.0048,0.0108,0.0185,0.0280,0.0400];

  return ys.map((y,i)=>[
    STREAM_X+ROD_GAP_DIRECTION.x*offsets[i],
    y,
    STREAM_Z+ROD_GAP_DIRECTION.z*offsets[i]
  ]);
}

export function buildMacroScene(data){
  const group=new THREE.Group();
  const startX=STREAM_X;
  const rodCenter=getRodCenterForKey(data.key);
  group.add(createNozzle(startX));
  group.add(createChargedRod({center:rodCenter}));

  const points=data.key==="water"
    ? createWaterStreamPoints()
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
  const x=STREAM_X;
  const pts=data.key==="water"
    ? createWaterStreamPoints({micro:true})
    : [[x,0.125,0],[x,0.082,0],[x,0.036,0],[x,-0.010,0],[x,-0.058,0],[x,-0.104,0],[x,-0.126,0]];
  return new THREE.CatmullRomCurve3(pts.map(p=>v(...p)),false,"catmullrom",0.45);
}

export function buildSubmicroScene(data,showSurface=false){
  const group=new THREE.Group();
  const rodCenter=getRodCenterForKey(data.key);
  group.add(createChargedRod({center:rodCenter}));

  const curve=createMicroCurve(data);
  const count=data.key==="water"?12:8;
  const prototype=createMoleculePrototype(data,showSurface);
  const molecules=[];

  for(let i=0;i<count;i++){
    const m=prototype.clone(true);
    const scale=data.key==="water"?0.66:0.24;
    m.scale.setScalar(scale);
    m.userData.progress=i/count;
    m.userData.speedPerSecond=data.key==="water"?0.145:0.125;
    m.userData.baseEuler=seededEuler(i);
    m.userData.tumbleSpeed=0.00016+(i%4)*0.000045;
    m.userData.spinAxis=v(0.35+0.11*(i%3),0.48+0.07*((i+1)%3),0.60+0.05*(i%2)).normalize();
    group.add(m);
    molecules.push(m);
  }

  const localWaterPositiveAxis=v(0,0,-1);
  const rodAxisPoint=new THREE.Vector3();
  const alignedQuat=new THREE.Quaternion();
  const rollQuat=new THREE.Quaternion();
  const randomQuat=new THREE.Quaternion();
  const desiredQuat=new THREE.Quaternion();
  const q0=new THREE.Quaternion();
  const tempDir=new THREE.Vector3();
  let lastNow=null;

  group.userData.update=(now)=>{
    const dt=Math.min(lastNow===null?1/60:Math.max((now-lastNow)/1000,0),0.05);
    lastNow=now;

    for(let i=0;i<molecules.length;i++){
      const m=molecules[i];
      const previousProgress=m.userData.progress;
      let progress=previousProgress+dt*m.userData.speedPerSecond;
      const wrapped=progress>=1;
      if(wrapped)progress-=Math.floor(progress);
      m.userData.progress=progress;

      const p=curve.getPointAt(progress);
      m.position.copy(p);

      if(data.key==="water"){
        // Oberhalb des Feldbereichs: kontinuierliche, zufällige Rotation in allen drei Raumrichtungen.
        q0.setFromEuler(m.userData.baseEuler);
        randomQuat.setFromAxisAngle(m.userData.spinAxis,now*m.userData.tumbleSpeed);
        randomQuat.multiply(q0).normalize();

        // Im Feld: positive H-Seite richtet sich kontinuierlich zur negativen Staboberfläche aus.
        closestPointOnRodAxis(p,rodCenter,rodAxisPoint);
        tempDir.copy(rodAxisPoint).sub(p).normalize();
        alignedQuat.setFromUnitVectors(localWaterPositiveAxis,tempDir);
        rollQuat.setFromAxisAngle(tempDir,0.055*Math.sin(now*0.0015+i*1.31));
        alignedQuat.premultiply(rollQuat).normalize();

        const alignStart=0.28;
        const alignEnd=0.62;
        const alignment=THREE.MathUtils.smoothstep(progress,alignStart,alignEnd);
        desiredQuat.copy(randomQuat).slerp(alignedQuat,alignment).normalize();

        if(!m.userData.currentQuaternion||wrapped){
          // Nach dem Wiedereintritt oben ist es ein neues, zufällig orientiertes Molekül.
          m.userData.currentQuaternion=randomQuat.clone();
        }

        // Maximaler Drehwinkel pro Frame: verhindert jedes schlagartige "Springen".
        const maxAngularSpeed=2.6+3.8*alignment; // rad/s
        m.userData.currentQuaternion.rotateTowards(desiredQuat,maxAngularSpeed*dt).normalize();
        m.quaternion.copy(m.userData.currentQuaternion);
      }else{
        q0.setFromEuler(m.userData.baseEuler);
        const qSpin=new THREE.Quaternion().setFromAxisAngle(m.userData.spinAxis,now*m.userData.tumbleSpeed);
        m.quaternion.copy(qSpin).multiply(q0).normalize();
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
