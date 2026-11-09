import * as THREE from "../libs/three.module.min.js";
import { WATER_SURFACE_DATA } from "./waterSurfaceData.js";
import { HEXANE_SURFACE_DATA } from "./hexaneSurfaceData.js";

const WATER_MODEL=[["O", [0.0, 0.0, 0.0]], ["H", [0.58773, 0.75906, 0.0]], ["H", [0.58773, -0.75906, 0.0]]];
const HEXANE_MODEL=[["C", [-3.125, -0.445, 0.0]], ["C", [-1.875, 0.445, 0.0]], ["C", [-0.625, -0.445, 0.0]], ["C", [0.625, 0.445, 0.0]], ["C", [1.875, -0.445, 0.0]], ["C", [3.125, 0.445, 0.0]], ["H", [-2.92132, -1.3575, -0.56033]], ["H", [-3.95225, 0.09044, -0.46589]], ["H", [-3.38935, -0.70015, 1.02621]], ["H", [-1.875, 1.07431, 0.88998]], ["H", [-1.875, 1.07431, -0.88998]], ["H", [-0.625, -1.07431, -0.88998]], ["H", [-0.625, -1.07431, 0.88998]], ["H", [0.625, 1.07431, 0.88998]], ["H", [0.625, 1.07431, -0.88998]], ["H", [1.875, -1.07431, -0.88998]], ["H", [1.875, -1.07431, 0.88998]], ["H", [3.72396, 0.2302, 0.88499]], ["H", [2.82496, 1.49284, 0.0099]], ["H", [3.71401, 0.24417, -0.89489]]];

const ATOM_STYLE={
  O: { color:0xd83b3b, radius:0.020 },
  C: { color:0x1f2937, radius:0.0185 },
  H: { color:0xffffff, radius:0.0135 }
};

const BOND_STYLE={ color:0xcbd5e1, radius:0.0055 };
const SURFACE_OPACITY=0.84;

function createAtom(symbol){
  const style=ATOM_STYLE[symbol];
  const geom=new THREE.SphereGeometry(style.radius, 24, 18);
  const mat=new THREE.MeshStandardMaterial({
    color:style.color, roughness:0.34, metalness:0.05
  });
  return new THREE.Mesh(geom,mat);
}

function createBond(a,b){
  const start=new THREE.Vector3(...a);
  const end=new THREE.Vector3(...b);
  const delta=new THREE.Vector3().subVectors(end,start);
  const len=delta.length();
  const geom=new THREE.CylinderGeometry(BOND_STYLE.radius,BOND_STYLE.radius,len,18,1,true);
  const mat=new THREE.MeshStandardMaterial({ color:BOND_STYLE.color, roughness:0.45, metalness:0.0 });
  const mesh=new THREE.Mesh(geom,mat);
  const mid=start.clone().add(end).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
  return mesh;
}

function buildWaterBallStick(){
  const group=new THREE.Group();
  const oxygen=WATER_MODEL[0][1];
  const h1=WATER_MODEL[1][1];
  const h2=WATER_MODEL[2][1];
  group.add(createBond(oxygen,h1));
  group.add(createBond(oxygen,h2));
  for(const [sym,pos] of WATER_MODEL){
    const atom=createAtom(sym);
    atom.position.set(...pos);
    group.add(atom);
  }
  return group;
}

function buildHexaneBallStick(){
  const group=new THREE.Group();
  const carbons=[];
  const hydrogens=[];
  for(const [sym,pos] of HEXANE_MODEL){
    if(sym==='C')carbons.push(pos);
    else hydrogens.push(pos);
  }
  // Carbon-carbon bonds
  for(let i=0;i<5;i++)group.add(createBond(carbons[i],carbons[i+1]));
  // Carbon-hydrogen bonds: each hydrogen belongs to nearest carbon
  for(const [sym,pos] of HEXANE_MODEL){
    if(sym!=='H')continue;
    let bestIdx=0,best=Infinity;
    for(let i=0;i<6;i++){
      const dx=pos[0]-carbons[i][0],dy=pos[1]-carbons[i][1],dz=pos[2]-carbons[i][2];
      const d=dx*dx+dy*dy+dz*dz;
      if(d<best){best=d;bestIdx=i;}
    }
    group.add(createBond(carbons[bestIdx],pos));
  }
  for(const [sym,pos] of HEXANE_MODEL){
    const atom=createAtom(sym);
    atom.position.set(...pos);
    group.add(atom);
  }
  return group;
}

function buildMolecule(data){
  const group = data.key==='water' ? buildWaterBallStick() : buildHexaneBallStick();
  group.traverse(obj=>{ obj.userData.moleculePart=true; });
  return group;
}

function buildSurfaceMesh(surfaceData){
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(surfaceData.positions.flat());
  const colors=new Float32Array(surfaceData.colors.flat());
  const indices=new Uint32Array(surfaceData.indices.flat());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  const material=new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:SURFACE_OPACITY,
    side:THREE.FrontSide,
    shininess:64,
    specular:new THREE.Color(0xffffff),
    depthWrite:false
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.renderOrder=4;
  mesh.userData.kind='density-surface';
  return mesh;
}

export function createDensitySurfaceFor(data){
  return buildSurfaceMesh(data.key==='water' ? WATER_SURFACE_DATA : HEXANE_SURFACE_DATA);
}

function createNegativeRod(height=0.30){
  const group=new THREE.Group();
  const rod=new THREE.Mesh(
    new THREE.CylinderGeometry(0.008,0.008,height,22),
    new THREE.MeshStandardMaterial({ color:0x4b5563, roughness:0.55, metalness:0.18 })
  );
  rod.rotation.z=Math.PI/16;
  group.add(rod);
  const positions=[0.09,0,-0.09];
  for(const y of positions){
    const badge=createTextBadge('−',{
      fill:'#111827',
      text:'#ffffff',
      ring:'#ffffff',
      size:160,
      font:'bold 118px Arial'
    });
    badge.scale.set(0.048,0.048,0.048);
    badge.position.set(0.028,y,0.0);
    group.add(badge);
  }
  return group;
}

function createTextBadge(text, options={}){
  const size=options.size||160;
  const canvas=document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.beginPath();
  ctx.arc(size/2,size/2,size*0.38,0,Math.PI*2);
  ctx.fillStyle=options.fill||'#ffffff';
  ctx.fill();
  ctx.lineWidth=size*0.04;
  ctx.strokeStyle=options.ring||'#111827';
  ctx.stroke();
  ctx.fillStyle=options.text||'#111827';
  ctx.font=options.font||`bold ${Math.floor(size*0.55)}px Arial`;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,size/2,size/2+size*0.02);
  const texture=new THREE.CanvasTexture(canvas);
  texture.needsUpdate=true;
  const material=new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false });
  const sprite=new THREE.Sprite(material);
  sprite.renderOrder=8;
  return sprite;
}

function createMagnifierSprite(){
  const size=256;
  const canvas=document.createElement('canvas');
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.strokeStyle='rgba(255,255,255,0.98)';
  ctx.lineWidth=22;
  ctx.beginPath();
  ctx.arc(108,108,62,0,Math.PI*2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(152,152); ctx.lineTo(212,212); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(108,108,52,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.font='bold 40px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('Lupe', 116, 232);
  const tex=new THREE.CanvasTexture(canvas);
  tex.needsUpdate=true;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false }));
  sprite.scale.set(0.105,0.105,0.105);
  sprite.userData.interactive='magnifier';
  sprite.renderOrder=10;
  return sprite;
}

function createStreamTube(points, color, radius=0.012, opacity=0.75){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const geom=new THREE.TubeGeometry(curve, 60, radius, 18, false);
  const mat=new THREE.MeshPhongMaterial({
    color, transparent:true, opacity, shininess:60, specular:new THREE.Color(0xffffff)
  });
  const mesh=new THREE.Mesh(geom,mat);
  return {curve, mesh};
}

export function buildMacroScene(data){
  const group=new THREE.Group();
  const rod=createNegativeRod(0.28);
  rod.position.set(0.12,0.005,0.0);
  group.add(rod);

  const streamPoints = data.key==='water'
    ? [[-0.09,0.20,0],[-0.09,0.10,0],[-0.075,0.02,0],[-0.045,-0.06,0],[-0.015,-0.15,0]]
    : [[-0.085,0.20,0],[-0.085,0.10,0],[-0.083,0.02,0],[-0.082,-0.07,0],[-0.081,-0.15,0]];
  const streamColor = data.key==='water' ? 0x9bd7ff : 0xe5eef6;
  const streamOpacity = data.key==='water' ? 0.72 : 0.58;
  const mainStream=createStreamTube(streamPoints, streamColor, data.key==='water'?0.012:0.011, streamOpacity);
  group.add(mainStream.mesh);
  const highlight=createStreamTube(streamPoints, 0xffffff, data.key==='water'?0.005:0.004, data.key==='water'?0.26:0.18);
  group.add(highlight.mesh);

  const magnifier=createMagnifierSprite();
  magnifier.position.set(data.key==='water' ? -0.055 : -0.062, 0.015, 0.03);
  magnifier.userData.baseScale=0.105;
  group.add(magnifier);

  const subtleMolecule = buildMolecule(data);
  subtleMolecule.scale.setScalar(data.key==='water'?0.18:0.075);
  subtleMolecule.position.copy(magnifier.position).add(new THREE.Vector3(0.0,0.0,-0.002));
  if(data.key==='water'){
    subtleMolecule.rotation.z=0.25;
  } else {
    subtleMolecule.rotation.set(0.5,-0.3,0.7);
  }
  subtleMolecule.traverse(obj=>{
    if(obj.material){
      obj.material=obj.material.clone();
      obj.material.transparent=true;
      obj.material.opacity=0.78;
      if(obj.material.color&&obj.material.color.getHex()===0xffffff)obj.material.opacity=0.92;
    }
  });
  group.add(subtleMolecule);

  const topNozzle=new THREE.Mesh(
    new THREE.CylinderGeometry(0.018,0.013,0.04,18),
    new THREE.MeshStandardMaterial({ color:0x6b7280, roughness:0.6, metalness:0.22 })
  );
  topNozzle.position.set(streamPoints[0][0],0.23,0);
  group.add(topNozzle);

  return { group, magnifier, interactiveObjects:[magnifier] };
}

function cloneMoleculeWithOptionalSurface(data, showSurface){
  const group=buildMolecule(data);
  if(showSurface){
    const surface=createDensitySurfaceFor(data);
    group.add(surface);
  }
  return group;
}

const WATER_ROTATIONS=[
  [0.0,0.0,0.0],[0.0,0.0,0.08],[0.0,0.0,-0.10],[0.10,0.0,0.02],[-0.08,0.0,0.05],
  [0.06,0.0,-0.03],[-0.06,0.0,0.03],[0.03,0.04,0.02],[-0.03,-0.04,-0.02],[0.05,-0.03,0.04],[-0.05,0.03,-0.02]
];
const HEXANE_ROTATIONS=[
  [0.3,0.2,0.8],[-0.45,0.1,1.2],[0.18,-0.55,0.35],[-0.25,0.48,-0.75],[0.6,-0.2,0.95],[-0.35,-0.4,0.3],[0.2,0.55,-1.0],[-0.52,0.18,-0.15]
];

export function buildSubmicroScene(data, showSurface=false){
  const group=new THREE.Group();
  const rod=createNegativeRod(0.34);
  rod.position.set(0.165,0.0,0.0);
  group.add(rod);

  const streamGuidePoints = data.key==='water'
    ? [[-0.11,0.19,0],[-0.10,0.11,0],[-0.085,0.03,0],[-0.055,-0.05,0],[-0.02,-0.14,0]]
    : [[-0.09,0.19,0],[-0.088,0.10,0],[-0.086,0.02,0],[-0.084,-0.06,0],[-0.082,-0.14,0]];
  const ghost=createStreamTube(streamGuidePoints, data.key==='water'?0x9bd7ff:0xe6eef7, data.key==='water'?0.048:0.055, data.key==='water'?0.08:0.06);
  group.add(ghost.mesh);

  const curve=new THREE.CatmullRomCurve3(streamGuidePoints.map(p=>new THREE.Vector3(...p)));
  const count=data.key==='water'?11:8;
  for(let i=0;i<count;i++){
    const t=(i+0.5)/count;
    const pos=curve.getPoint(t);
    const molecule=cloneMoleculeWithOptionalSurface(data,showSurface);
    if(data.key==='water'){
      molecule.scale.setScalar(0.22);
      const [rx,ry,rz]=WATER_ROTATIONS[i % WATER_ROTATIONS.length];
      molecule.rotation.set(rx,ry,rz);
    } else {
      molecule.scale.setScalar(0.082);
      const [rx,ry,rz]=HEXANE_ROTATIONS[i % HEXANE_ROTATIONS.length];
      molecule.rotation.set(rx,ry,rz);
    }
    molecule.position.copy(pos);
    molecule.userData.kind='micro-molecule';
    group.add(molecule);
  }

  return group;
}

export function setDensityVisibility(root, visible){
  root.traverse(obj=>{ if(obj.userData&&obj.userData.kind==='density-surface') obj.visible=visible; });
}

export function disposeObject3D(root){
  root.traverse(obj=>{
    if(obj.geometry) obj.geometry.dispose();
    if(obj.material){
      if(Array.isArray(obj.material)) obj.material.forEach(m=>{ if(m.map)m.map.dispose(); m.dispose(); });
      else { if(obj.material.map)obj.material.map.dispose(); obj.material.dispose(); }
    }
  });
}
