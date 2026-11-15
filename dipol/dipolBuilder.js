
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

const DENSITY_SURFACE_SCALE=0.68;
const ETHYNE_NEUTRAL_GREEN=[92,204,88];
const ETHYNE_COOL_GREEN=[67,193,174];
const ETHYNE_WARM_GREEN=[186,214,84];

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

function computeBondTrim(atomRadius,offsetLength){
  const inside=Math.max(0,atomRadius*atomRadius-offsetLength*offsetLength);
  return Math.sqrt(inside);
}

function createBondCylinder(start,end,{radius=0.00185,startRadius=0.010,endRadius=0.010,offset=null}={}){
  const a=start.clone();
  const b=end.clone();
  const offsetLength=offset?offset.length():0;
  if(offset){a.add(offset);b.add(offset);}
  const fullSegment=b.clone().sub(a);
  const fullLength=fullSegment.length();
  if(fullLength<1e-8)return null;

  const direction=fullSegment.clone().normalize();
  const startTrim=computeBondTrim(startRadius,offsetLength);
  const endTrim=computeBondTrim(endRadius,offsetLength);
  const safetyGap=Math.max(0.00025,radius*0.18);
  const trimmedA=a.clone().addScaledVector(direction,startTrim+safetyGap);
  const trimmedB=b.clone().addScaledVector(direction,-(endTrim+safetyGap));

  const segment=trimmedB.clone().sub(trimmedA);
  const len=segment.length();
  if(len<1e-8)return null;

  const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,len,20,1,false),
    new THREE.MeshStandardMaterial({color:STYLE.bondColor,roughness:0.60,metalness:0})
  );
  mesh.position.copy(trimmedA).add(trimmedB).multiplyScalar(0.5);
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
  const startRadius=STYLE.atomRadius[data.atoms[bond.a].element] ?? 0.010;
  const endRadius=STYLE.atomRadius[data.atoms[bond.b].element] ?? 0.010;

  if(bond.order===1){
    group.add(createBondCylinder(start,end,{radius:0.00185,startRadius,endRadius}));
  }else if(bond.order===2){
    group.add(createBondCylinder(start,end,{radius:0.00155,startRadius,endRadius,offset:side.clone().multiplyScalar(-spacing/2)}));
    group.add(createBondCylinder(start,end,{radius:0.00155,startRadius,endRadius,offset:side.clone().multiplyScalar( spacing/2)}));
  }else{
    group.add(createBondCylinder(start,end,{radius:0.00142,startRadius,endRadius,offset:side.clone().multiplyScalar(-spacing)}));
    group.add(createBondCylinder(start,end,{radius:0.00142,startRadius,endRadius}));
    group.add(createBondCylinder(start,end,{radius:0.00142,startRadius,endRadius,offset:side.clone().multiplyScalar( spacing)}));
  }
  return group;
}

function createTextSprite(text,{fg="#ffffff",bg="rgba(0,0,0,.78)",worldWidth=0.066,worldHeight=0.027,font="700 136px Arial"}={}){
  const canvas=document.createElement("canvas");
  canvas.width=2048;canvas.height=512;
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=bg;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(22,52,2004,408,84);
  else ctx.rect(22,52,2004,408);
  ctx.fill();

  ctx.font=font;
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.lineJoin="round";
  ctx.miterLimit=2;
  ctx.strokeStyle="rgba(0,0,0,0.55)";
  ctx.lineWidth=24;
  ctx.strokeText(text,1024,263,1880);
  ctx.fillStyle=fg;
  ctx.fillText(text,1024,263,1880);

  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.generateMipmaps=true;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.magFilter=THREE.LinearFilter;
  tex.needsUpdate=true;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
    map:tex,transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:true
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
    // Nur die Geometrie-Hilfslinien – kein Winkelbogen.
    group.add(lineSegmentsGeometry([center,p1,center,p2,p1,p2]));
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

  const box=new THREE.Box3().setFromPoints(positions);
  const top=box.max.clone();
  const labelAnchor=new THREE.Object3D();
  labelAnchor.name="geometry-label-anchor";
  labelAnchor.position.set(0,top.y+0.031,0);
  labelAnchor.userData.labelText=data.geometryLabel;
  group.add(labelAnchor);

  return group;
}

function decodeBase64Bytes(b64){
  const bin=atob(b64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}

function mixRGB(a,b,t){
  return [
    Math.round(a[0]*(1-t)+b[0]*t),
    Math.round(a[1]*(1-t)+b[1]*t),
    Math.round(a[2]*(1-t)+b[2]*t)
  ];
}

function recolorEthyneSurface(colorBytes){
  const recolored=new Uint8Array(colorBytes.length);
  for(let i=0;i<colorBytes.length;i+=3){
    const r=colorBytes[i], g=colorBytes[i+1], b=colorBytes[i+2];
    const warm=Math.max(0,(r-b)/255);
    const cool=Math.max(0,(b-r)/255);
    let c=ETHYNE_NEUTRAL_GREEN;
    if(warm>0.06)c=mixRGB(ETHYNE_NEUTRAL_GREEN,ETHYNE_WARM_GREEN,Math.min(0.35,warm*0.45));
    else if(cool>0.06)c=mixRGB(ETHYNE_NEUTRAL_GREEN,ETHYNE_COOL_GREEN,Math.min(0.35,cool*0.45));
    recolored[i]=c[0]; recolored[i+1]=c[1]; recolored[i+2]=c[2];
  }
  return recolored;
}

function createDensitySurface(data,displayCenter){
  const raw=SURFACE_DATA[data.key];
  if(!raw)return new THREE.Group();

  const pBytes=decodeBase64Bytes(raw.positionsB64);
  const sourcePos=new Float32Array(pBytes.buffer);
  const positions=new Float32Array(sourcePos.length);
  for(let i=0;i<sourcePos.length;i+=3){
    positions[i]=(sourcePos[i]-displayCenter.x)*ANGSTROM_TO_SCENE*DENSITY_SURFACE_SCALE;
    positions[i+1]=(sourcePos[i+1]-displayCenter.y)*ANGSTROM_TO_SCENE*DENSITY_SURFACE_SCALE;
    positions[i+2]=(sourcePos[i+2]-displayCenter.z)*ANGSTROM_TO_SCENE*DENSITY_SURFACE_SCALE;
  }

  let cBytes=decodeBase64Bytes(raw.colorsB64);
  if(data.key==="C2H2")cBytes=recolorEthyneSurface(cBytes);
  const iBytes=decodeBase64Bytes(raw.indicesB64);
  const indices=raw.indexType==="u32"?new Uint32Array(iBytes.buffer):new Uint16Array(iBytes.buffer);

  const geo=new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.BufferAttribute(cBytes,3,true));

  // Wie in Mesomerie1 liefert marching_cubes die Dreiecke für dieses
  // Dichtefeld mit nach innen gerichtetem Winding. Für die sichtbare
  // Außenseite wird die Orientierung deshalb explizit umgedreht.
  const IndexArray=raw.indexType==="u32"?Uint32Array:Uint16Array;
  const correctedIndices=new IndexArray(indices.length);
  for(let i=0;i<indices.length;i+=3){
    correctedIndices[i]=indices[i];
    correctedIndices[i+1]=indices[i+2];
    correctedIndices[i+2]=indices[i+1];
  }
  geo.setIndex(new THREE.BufferAttribute(correctedIndices,1));
  geo.computeVertexNormals();

  const mesh=new THREE.Mesh(geo,new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:0.82,
    shininess:72,
    specular:0x555555,
    side:THREE.FrontSide,
    // Die Oberfläche bleibt transparent und schreibt nicht in den Tiefenpuffer.
    // Dadurch können die Schwerpunktkugeln weiterhin durch die Oberfläche
    // gesehen werden, während Atome ihre räumliche Verdeckung korrekt behalten.
    depthTest:true,
    depthWrite:false
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

function createMarkerShell(radius,color,opacity=0.96){
  const shell=new THREE.Mesh(
    new THREE.SphereGeometry(radius,26,20),
    new THREE.MeshBasicMaterial({
      color,transparent:true,opacity,depthTest:true,depthWrite:false,side:THREE.BackSide
    })
  );
  shell.renderOrder=5;
  return shell;
}

function createPreciseCenterMarker(position,kind){
  const color=kind==="plus"?STYLE.positiveColor:STYLE.negativeColor;
  const group=new THREE.Group();
  group.position.copy(position);

  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(0.0029,28,22),
    new THREE.MeshPhongMaterial({
      color,emissive:color,emissiveIntensity:0.32,shininess:92,specular:0xffffff,transparent:false,depthTest:true,depthWrite:true
    })
  );
  sphere.renderOrder=6;
  sphere.name=kind==="plus"?"positive-charge-center":"negative-charge-center";
  group.add(sphere);
  group.add(createMarkerShell(0.0036,0xffffff,0.92));
  group.add(createMarkerShell(0.0042,color,0.55));
  return group;
}

function createCoincidentCenterMarker(position){
  const group=new THREE.Group();
  group.position.copy(position);
  group.name="coincident-charge-centers";

  const plusHalf=new THREE.Mesh(
    new THREE.SphereGeometry(0.0031,28,20,0,Math.PI),
    new THREE.MeshPhongMaterial({
      color:STYLE.positiveColor,emissive:STYLE.positiveColor,emissiveIntensity:0.26,shininess:92,specular:0xffffff,depthTest:true,depthWrite:true,
      side:THREE.DoubleSide
    })
  );
  plusHalf.renderOrder=6;
  group.add(plusHalf);

  const minusHalf=new THREE.Mesh(
    new THREE.SphereGeometry(0.0031,28,20,Math.PI,Math.PI),
    new THREE.MeshPhongMaterial({
      color:STYLE.negativeColor,emissive:STYLE.negativeColor,emissiveIntensity:0.26,shininess:92,specular:0xffffff,depthTest:true,depthWrite:true,
      side:THREE.DoubleSide
    })
  );
  minusHalf.renderOrder=6;
  group.add(minusHalf);
  group.add(createMarkerShell(0.0038,0xffffff,0.92));
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
  line.material.depthTest=true;
  line.renderOrder=5;
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
  root.userData.geometryLabelAnchor=geometryGroup.getObjectByName("geometry-label-anchor") ?? null;
  root.userData.geometryLabelText=data.geometryLabel;
  root.userData.atomMeshes=atomMeshes;
  root.userData.centerAtomIndices=new Set(centerBuild.fadeAtomIndices);
  root.userData.centerInsideAtom=centerBuild.fadeAtomIndices.length>0;
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

  // Liegt mindestens ein Schwerpunkt in einem Atomzentrum, wird das GESAMTE
  // Ball-and-Stick-Modell moderat transparent. Die Schwerpunktkugel bleibt
  // exakt an ihrer räumlichen Position im Atominneren. Durch die moderate
  // Transparenz bleibt die Molekülgeometrie weiterhin gut erkennbar.
  const fadeWholeModel=showCenters&&!!root.userData.centerInsideAtom;
  groups.modelGroup.traverse(obj=>{
    if(!obj.material)return;
    const mats=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const mat of mats){
      mat.transparent=fadeWholeModel;
      mat.opacity=fadeWholeModel?0.62:1.0;
      mat.depthWrite=!fadeWholeModel;
      mat.needsUpdate=true;
    }
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
