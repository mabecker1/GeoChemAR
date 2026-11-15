
import * as THREE from "../libs/three.module.min.js";
import { ELECTRONEGATIVITY, POLAR_LIMIT, calculateChargeCenters } from "./dipolData.js";
import { SURFACE_DATA } from "./surfaceData.js";

const ANGSTROM_TO_SCENE=0.033;

const STYLE=Object.freeze({
  atomRadius:Object.freeze({
    H:0.0070, C:0.0110, O:0.0100, P:0.0132, Cl:0.0138, Br:0.0148, F:0.0095
  }),
  atomColor:Object.freeze({
    H:0xf7f7f7, C:0x24272d, O:0xd93b36, P:0xf28c28, Cl:0x35ad55, Br:0x8f3b2f, F:0xa7e76b
  }),
  bondColor:0xbfc5ce,
  geometryColor:0x56d45d,
  positiveColor:0x2575e6,
  negativeColor:0xe53935
});

function v(x=0,y=0,z=0){return new THREE.Vector3(x,y,z);}

function getDisplayCenter(data){
  const box=new THREE.Box3();
  for(const a of data.atoms){
    box.expandByPoint(v(...a.position));
  }
  return box.getCenter(new THREE.Vector3());
}

function toScenePoint(arr,displayCenter){
  return v(...arr).sub(displayCenter).multiplyScalar(ANGSTROM_TO_SCENE);
}

function atomMaterial(element){
  return new THREE.MeshStandardMaterial({
    color:STYLE.atomColor[element] ?? 0xaaaaaa,
    roughness:element==="H"?0.42:0.56,
    metalness:0
  });
}

function createAtom(atom,position){
  const radius=STYLE.atomRadius[atom.element] ?? 0.010;
  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(radius,32,24),
    atomMaterial(atom.element)
  );
  sphere.position.copy(position);
  sphere.userData.kind="atom";
  sphere.userData.element=atom.element;
  sphere.userData.atomRadius=radius;
  return sphere;
}

function bondOffsetDirection(axis){
  const ref=Math.abs(axis.y)<0.86?v(0,1,0):v(1,0,0);
  return new THREE.Vector3().crossVectors(axis,ref).normalize();
}

function createBondCylinder(start,end,radius=0.00185,offset=null){
  const a=start.clone();
  const b=end.clone();
  if(offset){a.add(offset);b.add(offset);}
  const segment=b.clone().sub(a);
  const len=segment.length();
  if(len<1e-8)return null;
  const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,len,20,1,false),
    new THREE.MeshStandardMaterial({color:STYLE.bondColor,roughness:0.60,metalness:0})
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),segment.clone().normalize());
  mesh.userData.kind="bond";
  return mesh;
}

function createBond(data,bond,positions){
  const group=new THREE.Group();
  const start=positions[bond.a],end=positions[bond.b];
  const axis=end.clone().sub(start).normalize();
  const side=bondOffsetDirection(axis);
  const spacing=0.0030;

  if(bond.order===1){
    group.add(createBondCylinder(start,end));
  }else if(bond.order===2){
    group.add(createBondCylinder(start,end,0.00155,side.clone().multiplyScalar(-spacing/2)));
    group.add(createBondCylinder(start,end,0.00155,side.clone().multiplyScalar( spacing/2)));
  }else{
    group.add(createBondCylinder(start,end,0.00142,side.clone().multiplyScalar(-spacing)));
    group.add(createBondCylinder(start,end,0.00142));
    group.add(createBondCylinder(start,end,0.00142,side.clone().multiplyScalar( spacing)));
  }
  return group;
}

function createTextSprite(text,{fg="#ffffff",bg="rgba(0,0,0,.70)",worldWidth=0.055,worldHeight=0.022,font="700 34px Arial"}={}){
  const canvas=document.createElement("canvas");
  canvas.width=420;canvas.height=150;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=bg;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(6,18,408,114,26);
  else ctx.rect(6,18,408,114);
  ctx.fill();
  ctx.fillStyle=fg;
  ctx.font=font;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(text,210,76);
  const tex=new THREE.CanvasTexture(canvas);
  tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
    map:tex,transparent:true,depthTest:false,depthWrite:false
  }));
  sprite.scale.set(worldWidth,worldHeight,1);
  sprite.renderOrder=40;
  return sprite;
}

function lineGeometry(points){
  const geo=new THREE.BufferGeometry().setFromPoints(points);
  const mat=new THREE.LineBasicMaterial({
    color:STYLE.geometryColor,transparent:true,opacity:0.95,depthTest:false,depthWrite:false
  });
  const line=new THREE.Line(geo,mat);
  line.renderOrder=22;
  return line;
}

function lineSegmentsGeometry(points){
  const geo=new THREE.BufferGeometry().setFromPoints(points);
  const mat=new THREE.LineBasicMaterial({
    color:STYLE.geometryColor,transparent:true,opacity:0.92,depthTest:false,depthWrite:false
  });
  const lines=new THREE.LineSegments(geo,mat);
  lines.renderOrder=22;
  return lines;
}

function createGeometryOverlay(data,positions){
  const group=new THREE.Group();
  group.name="geometry-overlay";

  const centerIndex=data.geometryCenter;
  const center=centerIndex===null?v(0,0,0):positions[centerIndex];
  const terminals=data.terminalAtoms.map(i=>positions[i]);

  if(data.geometry==="linear"){
    const a=terminals[0].clone();
    const b=terminals[terminals.length-1].clone();
    const dir=b.clone().sub(a).normalize();
    const ext=0.010;
    group.add(lineGeometry([
      a.clone().addScaledVector(dir,-ext),
      b.clone().addScaledVector(dir, ext)
    ]));
  }

  if(data.geometry==="bent"){
    const p1=terminals[0],p2=terminals[1];
    group.add(lineSegmentsGeometry([center,p1,center,p2,p1,p2]));

    const d1=p1.clone().sub(center).normalize();
    const d2=p2.clone().sub(center).normalize();
    const axis=new THREE.Vector3().crossVectors(d1,d2).normalize();
    const angle=d1.angleTo(d2);
    const arc=[];
    const radius=0.021;
    for(let i=0;i<=28;i++){
      const q=d1.clone().applyAxisAngle(axis,angle*i/28).multiplyScalar(radius).add(center);
      arc.push(q);
    }
    group.add(lineGeometry(arc));
  }

  if(data.geometry==="trigonal-planar"){
    const seg=[];
    for(let i=0;i<terminals.length;i++){
      const a=terminals[i],b=terminals[(i+1)%terminals.length];
      seg.push(a,b,center,a);
    }
    group.add(lineSegmentsGeometry(seg));

    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(terminals.flatMap(p=>[p.x,p.y,p.z]),3));
    geo.setIndex([0,1,2]);
    geo.computeVertexNormals();
    const plane=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
      color:STYLE.geometryColor,transparent:true,opacity:0.11,side:THREE.DoubleSide,
      depthTest:false,depthWrite:false
    }));
    plane.renderOrder=19;
    group.add(plane);
  }

  if(data.geometry==="tetrahedral"){
    const seg=[];
    for(let i=0;i<terminals.length;i++){
      for(let j=i+1;j<terminals.length;j++)seg.push(terminals[i],terminals[j]);
      seg.push(center,terminals[i]);
    }
    group.add(lineSegmentsGeometry(seg));

    const indices=[0,1,2,0,1,3,0,2,3,1,2,3];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(terminals.flatMap(p=>[p.x,p.y,p.z]),3));
    geo.setIndex(indices);geo.computeVertexNormals();
    const faces=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
      color:STYLE.geometryColor,transparent:true,opacity:0.07,side:THREE.DoubleSide,
      depthTest:false,depthWrite:false
    }));
    faces.renderOrder=18;
    group.add(faces);
  }

  if(data.geometry==="trigonal-pyramidal"){
    const seg=[];
    for(let i=0;i<3;i++){
      seg.push(terminals[i],terminals[(i+1)%3]);
      seg.push(center,terminals[i]);
    }
    group.add(lineSegmentsGeometry(seg));

    const arr=[center,...terminals];
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(arr.flatMap(p=>[p.x,p.y,p.z]),3));
    geo.setIndex([0,1,2,0,2,3,0,3,1,1,2,3]);geo.computeVertexNormals();
    const faces=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
      color:STYLE.geometryColor,transparent:true,opacity:0.08,side:THREE.DoubleSide,
      depthTest:false,depthWrite:false
    }));
    faces.renderOrder=18;
    group.add(faces);
  }

  const label=createTextSprite(data.geometryLabel,{
    fg:"#effff0",bg:"rgba(20,105,29,.88)",
    worldWidth:Math.max(0.050,0.012+data.geometryLabel.length*0.0033),
    worldHeight:0.020
  });
  const box=new THREE.Box3().setFromPoints(positions);
  const top=box.max.clone();
  label.position.set(0,top.y+0.025,0);
  group.add(label);

  return group;
}

function decodeBase64Bytes(b64){
  const bin=atob(b64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}

function createDensitySurface(data,displayCenter){
  const raw=SURFACE_DATA[data.key];
  if(!raw)return new THREE.Group();

  const pBytes=decodeBase64Bytes(raw.positionsB64);
  const sourcePos=new Float32Array(pBytes.buffer);
  const positions=new Float32Array(sourcePos.length);
  for(let i=0;i<sourcePos.length;i+=3){
    positions[i]=(sourcePos[i]-displayCenter.x)*ANGSTROM_TO_SCENE;
    positions[i+1]=(sourcePos[i+1]-displayCenter.y)*ANGSTROM_TO_SCENE;
    positions[i+2]=(sourcePos[i+2]-displayCenter.z)*ANGSTROM_TO_SCENE;
  }

  const cBytes=decodeBase64Bytes(raw.colorsB64);
  const iBytes=decodeBase64Bytes(raw.indicesB64);
  const indices=new Uint16Array(iBytes.buffer);

  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.BufferAttribute(cBytes,3,true));
  geo.setIndex(new THREE.BufferAttribute(indices,1));
  geo.computeVertexNormals();

  const mesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:0.66,
    shininess:72,
    specular:0x666666,
    side:THREE.FrontSide,
    depthWrite:true
  }));
  mesh.name="density-surface";
  mesh.renderOrder=8;
  return mesh;
}

function nearestAtomAtPosition(point,positions){
  let bestIndex=-1;
  let bestDistance=Infinity;
  for(let i=0;i<positions.length;i++){
    const d=point.distanceTo(positions[i]);
    if(d<bestDistance){bestDistance=d;bestIndex=i;}
  }
  return {index:bestIndex,distance:bestDistance};
}

function createPreciseCenterMarker(position,kind){
  const color=kind==="plus"?STYLE.positiveColor:STYLE.negativeColor;
  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(0.0028,22,16),
    new THREE.MeshBasicMaterial({
      color,transparent:true,opacity:0.98,depthTest:false,depthWrite:false
    })
  );
  sphere.position.copy(position);
  sphere.renderOrder=60;
  sphere.name=kind==="plus"?"positive-charge-center":"negative-charge-center";
  return sphere;
}

function createCoincidentCenterMarker(position){
  const group=new THREE.Group();
  group.position.copy(position);
  group.name="coincident-charge-centers";

  // Eine gemeinsame Kugel mit zwei Farbhälften: beide Schwerpunkte liegen
  // exakt am selben Ort, ohne einen zusätzlichen Text oder einen Versatz.
  const plusHalf=new THREE.Mesh(
    new THREE.SphereGeometry(0.0030,24,16,0,Math.PI),
    new THREE.MeshBasicMaterial({
      color:STYLE.positiveColor,transparent:true,opacity:0.98,depthTest:false,depthWrite:false,
      side:THREE.DoubleSide
    })
  );
  plusHalf.renderOrder=60;
  group.add(plusHalf);

  const minusHalf=new THREE.Mesh(
    new THREE.SphereGeometry(0.0030,24,16,Math.PI,Math.PI),
    new THREE.MeshBasicMaterial({
      color:STYLE.negativeColor,transparent:true,opacity:0.98,depthTest:false,depthWrite:false,
      side:THREE.DoubleSide
    })
  );
  minusHalf.renderOrder=60;
  group.add(minusHalf);
  return group;
}

function createCenterConnection(plus,minus){
  const direction=minus.clone().sub(plus);
  const distance=direction.length();
  if(distance<1e-6)return null;
  const dashCount=Math.max(3,Math.floor(distance/0.006));
  const points=[];
  for(let i=0;i<dashCount;i++){
    const a=(i+0.12)/dashCount;
    const b=(i+0.55)/dashCount;
    points.push(
      plus.clone().lerp(minus,a),
      plus.clone().lerp(minus,Math.min(b,0.96))
    );
  }
  const line=lineSegmentsGeometry(points);
  line.material.color.set(0xffffff);
  line.material.opacity=0.42;
  line.material.depthTest=false;
  line.renderOrder=50;
  return line;
}

function createCenters(data,positions,displayCenter){
  const group=new THREE.Group();
  group.name="charge-centers";
  const fadeAtomIndices=new Set();

  // Ohne polare Bindung existiert in diesem didaktischen Modell keine
  // Trennung von Ladungsschwerpunkten; entsprechend wird nichts gezeichnet.
  if(!data.polarBonds)return {group,fadeAtomIndices:[]};

  const result=calculateChargeCenters(data);
  const plus=toScenePoint(result.plus,displayCenter);
  const minus=toScenePoint(result.minus,displayCenter);
  const coincident=plus.distanceTo(minus)<0.003;

  const markAtomIfInside=(point)=>{
    const nearest=nearestAtomAtPosition(point,positions);
    if(nearest.index>=0&&nearest.distance<0.0018)fadeAtomIndices.add(nearest.index);
  };

  if(coincident){
    markAtomIfInside(plus);
    group.add(createCoincidentCenterMarker(plus));
  }else{
    markAtomIfInside(plus);
    markAtomIfInside(minus);
    group.add(createPreciseCenterMarker(plus,"plus"));
    group.add(createPreciseCenterMarker(minus,"minus"));
    const connection=createCenterConnection(plus,minus);
    if(connection)group.add(connection);
  }
  return {group,fadeAtomIndices:[...fadeAtomIndices]};
}

export function buildDipoleScene(data){
  const root=new THREE.Group();
  root.name=`dipol-${data.key}`;

  const displayCenter=getDisplayCenter(data);
  const positions=data.atoms.map(a=>toScenePoint(a.position,displayCenter));

  const modelGroup=new THREE.Group();
  modelGroup.name="model";
  for(const b of data.bonds)modelGroup.add(createBond(data,b,positions));
  const atomMeshes=[];
  for(let i=0;i<data.atoms.length;i++){
    const atomMesh=createAtom(data.atoms[i],positions[i]);
    atomMeshes.push(atomMesh);
    modelGroup.add(atomMesh);
  }

  const geometryGroup=createGeometryOverlay(data,positions);
  const centerBuild=createCenters(data,positions,displayCenter);
  const centersGroup=centerBuild.group;
  const densityGroup=new THREE.Group();
  densityGroup.name="density";
  densityGroup.add(createDensitySurface(data,displayCenter));

  root.add(modelGroup,geometryGroup,centersGroup,densityGroup);
  root.position.y=0.040;
  root.scale.setScalar(data.zoom??1);

  modelGroup.visible=false;
  geometryGroup.visible=false;
  centersGroup.visible=false;
  densityGroup.visible=false;

  root.userData.visualGroups={modelGroup,geometryGroup,centersGroup,densityGroup};
  root.userData.atomMeshes=atomMeshes;
  root.userData.centerAtomIndices=new Set(centerBuild.fadeAtomIndices);
  root.userData.hasPolarBonds=!!data.polarBonds;
  return root;
}

export function setDipoleVisualState(root,{model=false,geometry=false,centers=false,density=false}={}){
  const groups=root?.userData?.visualGroups;
  if(!groups)return;
  const showCenters=!!centers&&!!root.userData.hasPolarBonds;
  groups.modelGroup.visible=!!model;
  groups.geometryGroup.visible=!!geometry;
  groups.centersGroup.visible=showCenters;
  groups.densityGroup.visible=!!density;

  // Liegt ein Schwerpunkt exakt in einem Atomzentrum, wird nur dieses Atom
  // während der Schwerpunktdarstellung transparent. Die kleine Kugel bleibt
  // unverändert am exakten Schwerpunktort im Inneren.
  const faded=root.userData.centerAtomIndices??new Set();
  (root.userData.atomMeshes??[]).forEach((atomMesh,index)=>{
    const shouldFade=showCenters&&faded.has(index);
    atomMesh.material.transparent=shouldFade;
    atomMesh.material.opacity=shouldFade?0.20:1.0;
    atomMesh.material.depthWrite=!shouldFade;
    atomMesh.material.needsUpdate=true;
  });
}

export function disposeObject3D(root){
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(obj=>{
    if(obj.geometry)geometries.add(obj.geometry);
    const mats=obj.material?(Array.isArray(obj.material)?obj.material:[obj.material]):[];
    for(const mat of mats){
      if(!mat)continue;
      materials.add(mat);
      for(const value of Object.values(mat)){
        if(value?.isTexture)textures.add(value);
      }
    }
  });
  for(const t of textures)t.dispose?.();
  for(const g of geometries)g.dispose?.();
  for(const m of materials)m.dispose?.();
}
