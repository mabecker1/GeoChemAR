
export const POLAR_LIMIT = 0.4;

export const ELECTRONEGATIVITY = Object.freeze({
  H: 2.1,
  C: 2.5,
  O: 3.5,
  P: 2.1,
  Cl: 3.0,
  Br: 2.8,
  F: 4.0
});

export const GEOMETRY_OPTIONS = Object.freeze([
  Object.freeze({ value:"linear", label:"linear" }),
  Object.freeze({ value:"bent", label:"gewinkelt" }),
  Object.freeze({ value:"trigonal-planar", label:"trigonal-planar" }),
  Object.freeze({ value:"trigonal-pyramidal", label:"trigonal-pyramidal" }),
  Object.freeze({ value:"tetrahedral", label:"tetraedrisch" })
]);

function atom(element,x,y,z){
  return Object.freeze({ element, position:Object.freeze([x,y,z]) });
}
function bond(a,b,order=1){
  return Object.freeze({ a,b,order });
}
function bondType(label,a,b){
  const delta=Math.abs(ELECTRONEGATIVITY[a]-ELECTRONEGATIVITY[b]);
  return Object.freeze({label,a,b,delta:Number(delta.toFixed(1)),polar:delta>POLAR_LIMIT});
}

const h2oHalf=104.5*Math.PI/360;
const h2oL=0.958;
const h2oX=Math.sin(h2oHalf)*h2oL;
const h2oY=Math.cos(h2oHalf)*h2oL;

const pcl3L=2.04;
const pcl3C=0.460;
const pcl3R=Math.sqrt(1-pcl3C*pcl3C);

const phL=1.42;
const pclL=2.04;
const phC=0.410;
const phR=Math.sqrt(1-phC*phC);

const tetra = [
  [ 1, 1, 1],
  [-1,-1, 1],
  [ 1,-1,-1],
  [-1, 1,-1]
].map(p=>{
  const s=1/Math.sqrt(3);
  return p.map(v=>v*s);
});

export const MOLECULES = Object.freeze({
  H2O: Object.freeze({
    key:"H2O", formula:"H₂O", name:"Wasser",
    geometry:"bent", geometryLabel:"gewinkelt",
    atoms:Object.freeze([
      atom("O",0,0,0),
      atom("H", h2oX,h2oY,0),
      atom("H",-h2oX,h2oY,0)
    ]),
    bonds:Object.freeze([bond(0,1),bond(0,2)]),
    bondTypes:Object.freeze([bondType("O–H","O","H")]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    electronPairDirection:Object.freeze([0,-1,0]),
    zoom:1.25
  }),

  PCl3: Object.freeze({
    key:"PCl3", formula:"PCl₃", name:"Phosphortrichlorid",
    geometry:"trigonal-pyramidal", geometryLabel:"trigonal-pyramidal",
    atoms:Object.freeze([
      atom("P",0,0,0),
      atom("Cl", pcl3L*pcl3R,0,-pcl3L*pcl3C),
      atom("Cl", pcl3L*pcl3R*Math.cos(2*Math.PI/3), pcl3L*pcl3R*Math.sin(2*Math.PI/3),-pcl3L*pcl3C),
      atom("Cl", pcl3L*pcl3R*Math.cos(4*Math.PI/3), pcl3L*pcl3R*Math.sin(4*Math.PI/3),-pcl3L*pcl3C)
    ]),
    bonds:Object.freeze([bond(0,1),bond(0,2),bond(0,3)]),
    bondTypes:Object.freeze([bondType("P–Cl","P","Cl")]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2,3]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    electronPairDirection:Object.freeze([0,0,1]),
    zoom:0.86
  }),

  CO2: Object.freeze({
    key:"CO2", formula:"CO₂", name:"Kohlenstoffdioxid",
    geometry:"linear", geometryLabel:"linear",
    atoms:Object.freeze([
      atom("C",0,0,0),
      atom("O",-1.16,0,0),
      atom("O", 1.16,0,0)
    ]),
    bonds:Object.freeze([bond(0,1,2),bond(0,2,2)]),
    bondTypes:Object.freeze([bondType("C–O","C","O")]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2]),
    polarBonds:true,
    centersCoincide:true,
    dipole:false,
    zoom:1.05
  }),

  C2H2: Object.freeze({
    key:"C2H2", formula:"C₂H₂", name:"Ethin",
    geometry:"linear", geometryLabel:"linear",
    atoms:Object.freeze([
      atom("H",-1.66,0,0),
      atom("C",-0.60,0,0),
      atom("C", 0.60,0,0),
      atom("H", 1.66,0,0)
    ]),
    bonds:Object.freeze([bond(0,1),bond(1,2,3),bond(2,3)]),
    bondTypes:Object.freeze([
      bondType("C–H","C","H"),
      bondType("C–C","C","C")
    ]),
    geometryCenter:null,
    terminalAtoms:Object.freeze([0,3]),
    polarBonds:false,
    centersCoincide:true,
    dipole:false,
    zoom:0.96
  }),

  H2CO: Object.freeze({
    key:"H2CO", formula:"H₂CO", name:"Methanal (Formaldehyd)",
    geometry:"trigonal-planar", geometryLabel:"trigonal-planar",
    atoms:Object.freeze([
      atom("C",0,0,0),
      atom("O",1.21,0,0),
      atom("H",-0.58, 0.94,0),
      atom("H",-0.58,-0.94,0)
    ]),
    bonds:Object.freeze([bond(0,1,2),bond(0,2),bond(0,3)]),
    bondTypes:Object.freeze([
      bondType("C–O","C","O"),
      bondType("C–H","C","H")
    ]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2,3]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    zoom:1.03
  }),

  BrF: Object.freeze({
    key:"BrF", formula:"BrF", name:"Bromfluorid",
    geometry:"linear", geometryLabel:"linear",
    atoms:Object.freeze([
      atom("Br",-0.88,0,0),
      atom("F", 0.88,0,0)
    ]),
    bonds:Object.freeze([bond(0,1)]),
    bondTypes:Object.freeze([bondType("Br–F","Br","F")]),
    geometryCenter:null,
    terminalAtoms:Object.freeze([0,1]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    zoom:1.12
  }),

  CH2F2: Object.freeze({
    key:"CH2F2", formula:"CH₂F₂", name:"Difluormethan",
    geometry:"tetrahedral", geometryLabel:"tetraedrisch",
    atoms:Object.freeze([
      atom("C",0,0,0),
      atom("F",tetra[0][0]*1.35,tetra[0][1]*1.35,tetra[0][2]*1.35),
      atom("F",tetra[1][0]*1.35,tetra[1][1]*1.35,tetra[1][2]*1.35),
      atom("H",tetra[2][0]*1.09,tetra[2][1]*1.09,tetra[2][2]*1.09),
      atom("H",tetra[3][0]*1.09,tetra[3][1]*1.09,tetra[3][2]*1.09)
    ]),
    bonds:Object.freeze([bond(0,1),bond(0,2),bond(0,3),bond(0,4)]),
    bondTypes:Object.freeze([
      bondType("C–F","C","F"),
      bondType("C–H","C","H")
    ]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2,3,4]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    zoom:1.00
  }),

  PH2Cl: Object.freeze({
    key:"PH2Cl", formula:"PH₂Cl", name:"Chlorphosphan",
    geometry:"trigonal-pyramidal", geometryLabel:"trigonal-pyramidal",
    atoms:Object.freeze([
      atom("P",0,0,0),
      atom("Cl", pclL*phR,0,-pclL*phC),
      atom("H", phL*phR*Math.cos(2*Math.PI/3), phL*phR*Math.sin(2*Math.PI/3),-phL*phC),
      atom("H", phL*phR*Math.cos(4*Math.PI/3), phL*phR*Math.sin(4*Math.PI/3),-phL*phC)
    ]),
    bonds:Object.freeze([bond(0,1),bond(0,2),bond(0,3)]),
    bondTypes:Object.freeze([
      bondType("P–Cl","P","Cl"),
      bondType("P–H","P","H")
    ]),
    geometryCenter:0,
    terminalAtoms:Object.freeze([1,2,3]),
    polarBonds:true,
    centersCoincide:false,
    dipole:true,
    electronPairDirection:Object.freeze([0,0,1]),
    zoom:0.94
  })
});

export const MOLECULE_ORDER = Object.freeze(["H2O","PCl3","CO2","C2H2","H2CO","BrF","CH2F2","PH2Cl"]);

export function getMolecule(key){
  return MOLECULES[key] ?? MOLECULES.H2O;
}

export function parseGermanNumber(value){
  const cleaned=String(value??"").trim().replace(",",".");
  if(!cleaned)return NaN;
  return Number(cleaned);
}

export function expectedDelta(type){
  return Math.abs(ELECTRONEGATIVITY[type.a]-ELECTRONEGATIVITY[type.b]);
}

export function isPolarDelta(delta){
  return Number.isFinite(delta) && delta>POLAR_LIMIT;
}

export function calculateChargeCenters(data){
  const charges=new Array(data.atoms.length).fill(0);

  for(const b of data.bonds){
    const aAtom=data.atoms[b.a];
    const bAtom=data.atoms[b.b];
    const enA=ELECTRONEGATIVITY[aAtom.element];
    const enB=ELECTRONEGATIVITY[bAtom.element];
    const delta=Math.abs(enA-enB);
    if(delta<=POLAR_LIMIT)continue;

    // Didaktisches Ladungsmodell: Betrag proportional zu ΔEN.
    // Die Bindungsordnung ändert die Richtung nicht; sie wird daher bewusst
    // nicht als zusätzlicher Faktor verwendet.
    const q=delta;
    if(enA>enB){
      charges[b.a]-=q;
      charges[b.b]+=q;
    }else{
      charges[b.a]+=q;
      charges[b.b]-=q;
    }
  }

  let qPlus=0,qMinus=0;
  const plus=[0,0,0],minus=[0,0,0];

  for(let i=0;i<charges.length;i++){
    const q=charges[i];
    const p=data.atoms[i].position;
    if(q>0){
      qPlus+=q;
      plus[0]+=p[0]*q;plus[1]+=p[1]*q;plus[2]+=p[2]*q;
    }else if(q<0){
      const w=-q;
      qMinus+=w;
      minus[0]+=p[0]*w;minus[1]+=p[1]*w;minus[2]+=p[2]*w;
    }
  }

  if(qPlus<1e-9 || qMinus<1e-9){
    const center=[0,0,0];
    for(const a of data.atoms){
      center[0]+=a.position[0];
      center[1]+=a.position[1];
      center[2]+=a.position[2];
    }
    center[0]/=data.atoms.length;
    center[1]/=data.atoms.length;
    center[2]/=data.atoms.length;
    return Object.freeze({
      plus:Object.freeze(center.slice()),
      minus:Object.freeze(center.slice()),
      charges:Object.freeze(charges.slice()),
      coincident:true
    });
  }

  plus[0]/=qPlus;plus[1]/=qPlus;plus[2]/=qPlus;
  minus[0]/=qMinus;minus[1]/=qMinus;minus[2]/=qMinus;

  const dx=plus[0]-minus[0],dy=plus[1]-minus[1],dz=plus[2]-minus[2];
  const distance=Math.hypot(dx,dy,dz);

  return Object.freeze({
    plus:Object.freeze(plus),
    minus:Object.freeze(minus),
    charges:Object.freeze(charges.slice()),
    coincident:distance<0.08
  });
}
