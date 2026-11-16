import * as THREE from "../libs/three.module.min.js";
import { ANGSTROM_TO_SCENE } from "./ethanalBuilder.js";

// Electrostatic term in kJ mol^-1 for q[e], r[nm].
const COULOMB=138.935456;
const ELECTROSTATIC_SCREEN=2.5;
const VDW=Object.freeze({H:1.20,C:1.70,O:1.52});
const EPS=Object.freeze({H:0.06,C:0.30,O:0.65});
const MAX_ENERGY_DISTANCE_A=8.0;

// Sichtbare Dipol-Dipol-Kontakte werden ausschließlich als O···C(=O)
// zwischen zwei verschiedenen Ethanal-Molekülen dargestellt.
const LINK_MIN_A=2.45;
const LINK_MAX_A=3.85;
const LINK_PAIR_MAX_ENERGY=-1.8;
const CLASH_MIN_A=1.45;

function worldPoint(root,local,out=new THREE.Vector3()){return out.copy(local).applyMatrix4(root.matrixWorld);}
function getState(instance){
  const root=instance;
  const d=root.userData;
  const atoms=d.atomLocalPositions.map(p=>worldPoint(root,p,new THREE.Vector3()));
  return {
    root,
    atoms,
    elements:d.atomElements,
    charges:d.atomCharges,
    plus:worldPoint(root,d.plusLocal,new THREE.Vector3()),
    minus:worldPoint(root,d.minusLocal,new THREE.Vector3()),
    center:worldPoint(root,d.moleculeLocalCenter,new THREE.Vector3()),
    carbonylC:worldPoint(root,d.carbonylCLocal,new THREE.Vector3()),
    carbonylO:worldPoint(root,d.carbonylOLocal,new THREE.Vector3())
  };
}
function distanceA(a,b){return a.distanceTo(b)/ANGSTROM_TO_SCENE;}

export function evaluatePair(instanceA,instanceB){
  const A=getState(instanceA),B=getState(instanceB);
  const centerDistanceA=distanceA(A.center,B.center);
  let coulomb=0,lj=0,minAtomDistanceA=Infinity;
  if(centerDistanceA>MAX_ENERGY_DISTANCE_A){
    return {energy:0,coulomb:0,lj:0,minAtomDistanceA,centerDistanceA,A,B,clash:false};
  }
  for(let i=0;i<A.atoms.length;i++){
    for(let j=0;j<B.atoms.length;j++){
      const rA=distanceA(A.atoms[i],B.atoms[j]);
      minAtomDistanceA=Math.min(minAtomDistanceA,rA);
      const safeR=Math.max(.45,rA);
      const rNm=safeR*.1;
      coulomb+=COULOMB*A.charges[i]*B.charges[j]/(ELECTROSTATIC_SCREEN*rNm);
      const rmin=VDW[A.elements[i]]+VDW[B.elements[j]];
      const sigma=rmin/Math.pow(2,1/6);
      const eps=Math.sqrt(EPS[A.elements[i]]*EPS[B.elements[j]]);
      const sr=sigma/safeR;
      const sr6=Math.pow(sr,6);
      lj+=4*eps*(sr6*sr6-sr6);
    }
  }
  const energy=coulomb+lj;
  return {energy,coulomb,lj,minAtomDistanceA,centerDistanceA,A,B,clash:minAtomDistanceA<CLASH_MIN_A};
}

export function linksForPair(pair){
  if(pair.clash||pair.energy>LINK_PAIR_MAX_ENERGY)return [];
  const candidates=[
    {
      from:pair.A.carbonylO,
      to:pair.B.carbonylC,
      distanceA:distanceA(pair.A.carbonylO,pair.B.carbonylC),
      type:"O···C(=O)"
    },
    {
      from:pair.B.carbonylO,
      to:pair.A.carbonylC,
      distanceA:distanceA(pair.B.carbonylO,pair.A.carbonylC),
      type:"O···C(=O)"
    }
  ];
  return candidates.filter(x=>x.distanceA>=LINK_MIN_A&&x.distanceA<=LINK_MAX_A);
}

export function evaluateActive(active,fixed){
  let totalEnergy=0;
  let collision=false;
  const links=[];
  const pairs=[];
  for(const other of fixed){
    const pair=evaluatePair(active,other);
    pairs.push(pair);
    if(pair.centerDistanceA<=MAX_ENERGY_DISTANCE_A)totalEnergy+=pair.energy;
    if(pair.clash)collision=true;
    links.push(...linksForPair(pair));
  }
  const attraction=Math.max(0,-totalEnergy);
  let score=100*(1-Math.exp(-attraction/3.5));
  if(collision||!Number.isFinite(score))score=0;
  score=THREE.MathUtils.clamp(score,0,100);
  return {totalEnergy,score,collision,links,pairs,lineCount:links.length};
}

export function collectAllLinks(instances){
  const links=[];
  for(let i=0;i<instances.length;i++){
    for(let j=i+1;j<instances.length;j++)links.push(...linksForPair(evaluatePair(instances[i],instances[j]))
  }
  return links;
}

export const INTERACTION_CONSTANTS=Object.freeze({
  electrostaticScreen:ELECTROSTATIC_SCREEN,
  linkMinA:LINK_MIN_A,
  linkMaxA:LINK_MAX_A,
  clashMinA:CLASH_MIN_A,
  maxEnergyDistanceA:MAX_ENERGY_DISTANCE_A
});
