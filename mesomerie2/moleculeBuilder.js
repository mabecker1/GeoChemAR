import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Mesomerie2
  Carbonat-Anion CO3²−
*/

const ANGSTROM_TO_SCENE = 0.026;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    C: 0.0108,
    O: 0.0100
  }),
  color: Object.freeze({
    C: 0x202020,
    O: 0xd93636,
    bond: 0xb8bec7
  }),
  bondRadius: 0.00195,
  doubleBondSeparation: 0.00265
});

const BOND = Object.freeze({ CO: 1.281 });
function v(x,y,z){ return new THREE.Vector3(x,y,z); }

function materialForElement(element){
  return new THREE.MeshStandardMaterial({
    color: DISPLAY.color[element],
    roughness: element==="O" ? 0.55 : 0.62,
    metalness: 0
  });
}

function createAtom(element, position){
  const radius=DISPLAY.atomRadius[element];
  const geometry=new THREE.SphereGeometry(radius,48,32);
  const mesh=new THREE.Mesh(geometry,materialForElement(element));
  mesh.position.copy(position);
  mesh.userData.kind="atom";
  mesh.userData.element=element;
  return mesh;
}

function createBondCylinder(start,end,radius,material){
  const delta=end.clone().sub(start);
  const length=delta.length();
  const direction=delta.clone().normalize();
  const geometry=new THREE.CylinderGeometry(radius,radius,length,28,1,false);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),direction);
  mesh.userData.kind="bond";
  return mesh;
}

function bondMaterial(){
  return new THREE.MeshStandardMaterial({
    color:DISPLAY.color.bond,
    roughness:0.65,
    metalness:0
  });
}

function addBond(group,atomA,atomB,elementA,elementB){
  const axis=atomB.clone().sub(atomA);
  if(axis.lengthSq()<=1e-12)return;
  const direction=axis.clone().normalize();
  const start=atomA.clone().addScaledVector(direction,DISPLAY.atomRadius[elementA]);
  const end=atomB.clone().addScaledVector(direction,-DISPLAY.atomRadius[elementB]);
  group.add(createBondCylinder(start,end,DISPLAY.bondRadius,bondMaterial()));
}

function addDoubleBond(group,atomA,atomB,elementA,elementB,planeNormal){
  const axis=atomB.clone().sub(atomA);
  if(axis.lengthSq()<=1e-12)return;
  const direction=axis.clone().normalize();
  let offset = planeNormal.clone().cross(direction);
  if(offset.lengthSq() < 1e-12){
    offset = new THREE.Vector3(0,0,1).cross(direction);
  }
  offset.normalize().multiplyScalar(DISPLAY.doubleBondSeparation);
  const startBase=atomA.clone().addScaledVector(direction,DISPLAY.atomRadius[elementA]);
  const endBase=atomB.clone().addScaledVector(direction,-DISPLAY.atomRadius[elementB]);
  group.add(createBondCylinder(startBase.clone().add(offset), endBase.clone().add(offset), DISPLAY.bondRadius*0.88, bondMaterial()));
  group.add(createBondCylinder(startBase.clone().sub(offset), endBase.clone().sub(offset), DISPLAY.bondRadius*0.88, bondMaterial()));
}

function carbonateCoordinates(){
  const s=ANGSTROM_TO_SCENE;
  const r=BOND.CO*s;
  const C=v(0,0,0);
  const O1=v(r,0,0);
  const O2=v(-r/2,(Math.sqrt(3)/2)*r,0);
  const O3=v(-r/2,-(Math.sqrt(3)/2)*r,0);
  const points={C,O1,O2,O3};
  const box=new THREE.Box3().setFromPoints(Object.values(points));
  const center=box.getCenter(new THREE.Vector3());
  for(const p of Object.values(points))p.sub(center);
  return points;
}

function createChargeSprite(text, scale=0.020){
  const size=168;
  const canvas=document.createElement("canvas");
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,size,size);
  ctx.beginPath();
  ctx.arc(size/2,size/2,size*0.36,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.98)";
  ctx.fill();
  ctx.lineWidth=6;
  ctx.strokeStyle="rgba(20,20,20,0.95)";
  ctx.stroke();
  ctx.fillStyle="#111111";
  ctx.font="bold 110px Arial, sans-serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(text,size/2,size/2-2);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({
    map:texture,
    transparent:true,
    depthTest:false,
    depthWrite:false
  });
  const sprite=new THREE.Sprite(material);
  sprite.scale.set(scale,scale,1);
  sprite.renderOrder=20;
  sprite.userData.kind="charge-label";
  return sprite;
}

export function buildMolecule(data){
  if(data?.key!=="CARBONATE"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
  const g=new THREE.Group();
  g.name="CARBONATE";
  const p=carbonateCoordinates();
  const planeNormal = new THREE.Vector3(0,0,1);

  // Eine mesomere Grenzstruktur: eine Doppelbindung und zwei negativ geladene O-Atome.
  addDoubleBond(g,p.C,p.O1,"C","O",planeNormal);
  addBond(g,p.C,p.O2,"C","O");
  addBond(g,p.C,p.O3,"C","O");

  g.add(createAtom("C",p.C));
  g.add(createAtom("O",p.O1));
  g.add(createAtom("O",p.O2));
  g.add(createAtom("O",p.O3));

  const minus2 = createChargeSprite("−",0.0185);
  minus2.position.copy(p.O2.clone().add(p.O2.clone().sub(p.C).normalize().multiplyScalar(0.018)).add(new THREE.Vector3(0,0,0.004)));
  g.add(minus2);

  const minus3 = createChargeSprite("−",0.0185);
  minus3.position.copy(p.O3.clone().add(p.O3.clone().sub(p.C).normalize().multiplyScalar(0.018)).add(new THREE.Vector3(0,0,0.004)));
  g.add(minus3);

  return g;
}

export async function createElectronDensitySurfaceOverlay(data){
  if(data?.key!=="CARBONATE"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }
  const surfaceModule=await import("./carbonateSurfaceData.js");
  const { CARBONATE_SURFACE_POSITIONS, CARBONATE_SURFACE_INDICES, CARBONATE_SURFACE_COLORS } = surfaceModule;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(CARBONATE_SURFACE_POSITIONS,3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(CARBONATE_SURFACE_COLORS,3));
  const correctedIndices=[];
  for(let i=0;i<CARBONATE_SURFACE_INDICES.length;i+=3){
    correctedIndices.push(
      CARBONATE_SURFACE_INDICES[i],
      CARBONATE_SURFACE_INDICES[i+2],
      CARBONATE_SURFACE_INDICES[i+1]
    );
  }
  geometry.setIndex(correctedIndices);
  geometry.computeVertexNormals();
  const material=new THREE.MeshPhongMaterial({
    vertexColors:true,
    transparent:true,
    opacity:0.88,
    shininess:72,
    specular:0x555555,
    side:THREE.FrontSide,
    depthWrite:true
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.renderOrder=3;
  mesh.userData.kind="electron-density-surface";
  return mesh;
}

export function disposeObject3D(root){
  if(!root)return;
  root.traverse(obj=>{
    if(obj.geometry)obj.geometry.dispose();
    if(obj.material){
      const mats=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const m of mats){
        if(m?.map)m.map.dispose?.();
        m?.dispose?.();
      }
    }
  });
}

export function disposeMolecule(root){
  disposeObject3D(root);
}
