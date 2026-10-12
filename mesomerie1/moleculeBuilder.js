import * as THREE from "../libs/three.module.min.js";

/*
  GeoChemAR – Mesomerie1
  Methanolat-Anion CH3O−

  Sichtbares Ball-and-Stick-Modell und quantenchemische Oberfläche
  verwenden exakt dieselbe idealisierte Geometrie:
  - C-Atom tetraedrisch
  - C–O = 1.410 Å
  - C–H = 1.090 Å
  - Gesamtladung −1, im Modell sichtbar am O-Atom markiert
*/

const ANGSTROM_TO_SCENE = 0.026;

const DISPLAY = Object.freeze({
  atomRadius: Object.freeze({
    H: 0.0068,
    C: 0.0108,
    O: 0.0100
  }),
  color: Object.freeze({
    H: 0xffffff,
    C: 0x202020,
    O: 0xd93636,
    bond: 0xb8bec7
  }),
  bondRadius: 0.00195
});

const BOND = Object.freeze({
  CH: 1.090,
  CO: 1.410
});

function v(x,y,z){ return new THREE.Vector3(x,y,z); }

function materialForElement(element){
  return new THREE.MeshStandardMaterial({
    color: DISPLAY.color[element],
    roughness: element==="H" ? 0.50 : 0.62,
    metalness: 0
  });
}

function createAtom(element, position){
  const radius=DISPLAY.atomRadius[element];
  const geometry=new THREE.SphereGeometry(
    radius,
    element==="H" ? 40 : 48,
    element==="H" ? 28 : 32
  );
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

function addBond(group,atomA,atomB,elementA,elementB){
  const axis=atomB.clone().sub(atomA);
  if(axis.lengthSq()<=1e-12)return;
  const direction=axis.clone().normalize();
  const start=atomA.clone().addScaledVector(direction,DISPLAY.atomRadius[elementA]);
  const end=atomB.clone().addScaledVector(direction,-DISPLAY.atomRadius[elementB]);
  const material=new THREE.MeshStandardMaterial({
    color:DISPLAY.color.bond,
    roughness:0.65,
    metalness:0
  });
  group.add(createBondCylinder(start,end,DISPLAY.bondRadius,material));
}

function idealTetrahedralThree(){
  // Eine Bindung liegt entlang +x (C→O).
  // Die drei C–H-Richtungen haben deshalb x = -1/3.
  const x=-1/3;
  const radial=2*Math.sqrt(2)/3;
  return [0,120,240].map(phiDeg=>{
    const phi=THREE.MathUtils.degToRad(phiDeg);
    return v(
      x,
      radial*Math.cos(phi),
      radial*Math.sin(phi)
    ).normalize();
  });
}

function methoxideCoordinates(){
  const s=ANGSTROM_TO_SCENE;

  const C=v(0,0,0);
  const O=v(BOND.CO*s,0,0);

  const dirs=idealTetrahedralThree();
  const H1=C.clone().addScaledVector(dirs[0],BOND.CH*s);
  const H2=C.clone().addScaledVector(dirs[1],BOND.CH*s);
  const H3=C.clone().addScaledVector(dirs[2],BOND.CH*s);

  const points={C,O,H1,H2,H3};

  // Exakt dieselbe Bounding-Box-Zentrierung wie bei der RHF-Rechnung.
  const box=new THREE.Box3().setFromPoints(Object.values(points));
  const center=box.getCenter(new THREE.Vector3());
  for(const p of Object.values(points))p.sub(center);

  return points;
}

function createChargeSprite(text){
  const size=160;
  const canvas=document.createElement("canvas");
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext("2d");

  ctx.clearRect(0,0,size,size);
  ctx.beginPath();
  ctx.arc(size/2,size/2,size*0.39,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.lineWidth=7;
  ctx.strokeStyle="rgba(20,20,20,0.95)";
  ctx.stroke();

  ctx.fillStyle="#111111";
  ctx.font="bold 118px Arial, sans-serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText(text,size/2,size/2-7);

  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;

  const material=new THREE.SpriteMaterial({
    map:texture,
    transparent:true,
    depthTest:false,
    depthWrite:false
  });

  const sprite=new THREE.Sprite(material);
  sprite.scale.set(0.020,0.020,1);
  sprite.renderOrder=20;
  sprite.userData.kind="charge-label";
  return sprite;
}

export function buildMolecule(data){
  if(data?.key!=="METHOXIDE"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  const g=new THREE.Group();
  g.name="METHOXIDE";

  const p=methoxideCoordinates();

  addBond(g,p.C,p.O,"C","O");
  addBond(g,p.C,p.H1,"C","H");
  addBond(g,p.C,p.H2,"C","H");
  addBond(g,p.C,p.H3,"C","H");

  g.add(createAtom("C",p.C));
  g.add(createAtom("O",p.O));
  g.add(createAtom("H",p.H1));
  g.add(createAtom("H",p.H2));
  g.add(createAtom("H",p.H3));

  // Negative Gesamtladung sichtbar am O-Atom markieren.
  const charge=createChargeSprite("−");
  charge.position.copy(p.O).add(v(0.006,0.020,0.006));
  g.add(charge);

  return g;
}

export async function createElectronDensitySurfaceOverlay(data){
  if(data?.key!=="METHOXIDE"){
    throw new Error(`Unbekanntes Molekül: ${data?.key ?? "?"}`);
  }

  // Lazy Loading: die berechnete Oberflächendatei wird erst
  // beim Einblenden geladen.
  const surfaceModule=await import("./methoxideSurfaceData.js");
  const {
    METHOXIDE_SURFACE_POSITIONS,
    METHOXIDE_SURFACE_INDICES,
    METHOXIDE_SURFACE_COLORS
  }=surfaceModule;

  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(METHOXIDE_SURFACE_POSITIONS,3)
  );
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(METHOXIDE_SURFACE_COLORS,3)
  );

  // marching_cubes liefert für diese Dichte die Dreiecke nach innen.
  // Um nur die vordere Außenseite zu rendern, Winding umkehren.
  const correctedIndices=[];
  for(let i=0;i<METHOXIDE_SURFACE_INDICES.length;i+=3){
    correctedIndices.push(
      METHOXIDE_SURFACE_INDICES[i],
      METHOXIDE_SURFACE_INDICES[i+2],
      METHOXIDE_SURFACE_INDICES[i+1]
    );
  }

  geometry.setIndex(correctedIndices);
  geometry.computeVertexNormals();

  // Entspricht der akzeptierten Ethanol-Darstellung.
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
