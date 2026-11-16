import * as THREE from "../libs/three.module.min.js";
import { ANGSTROM_TO_SCENE } from "./ethanalBuilder.js";

const COULOMB=138.935456; // kJ mol^-1 for q[e], r[nm]
const ELECTROSTATIC_SCREEN=2.5;
const VDW=Object.freeze({H:1.20,C:1.70,O:1.52});
const EPS=Object.freeze({H:0.06,C:0.30,O:0.65});
const MAX_ENERGY_DISTANCE_A=9.0;
const CLASH_MIN_A=1.75;

// Carbonyl–carbonyl contact geometry. Short C=O···C=O contacts in molecular
// crystals are commonly found below 3.6 Å; sheared antiparallel motifs often
// place O···C near ~3.0–3.3 Å. The visible line and the score use exactly the
// same strength function.
const CONTACT_IDEAL_A=3.15;
const CONTACT_SIGMA_A=0.30;
const CONTACT_MIN_A=2.80;
const CONTACT_MAX_A=3.65;
const CONTACT_ANGLE_IDEAL_DEG=90;
const CONTACT_ANGLE_SIGMA_DEG=20;
const CONTACT_ANGLE_MIN_DEG=65;
const CONTACT_ANGLE_MAX_DEG=120;
const CONTACT_VISIBLE_MIN=0.22;
const CONTACT_LOCK_MIN=0.72;

function worldPoint(root,local,out=new THREE.Vector3()){return out.copy(local).applyMatrix4(root.matrixWorld);}
function distanceA(a,b){return a.distanceTo(b)/ANGSTROM_TO_SCENE;}
function angleDeg(a,b){return THREE.MathUtils.radToDeg(a.angleTo(b));}

function instanceState(instance){
  const d=instance.userData;
  return {
    root:instance,
    atoms:d.atomLocalPositions.map(p=>worldPoint(instance,p,new THREE.Vector3())),
    elements:d.atomElements,
    charges:d.atomCharges,
    center:worldPoint(instance,d.moleculeLocalCenter,new THREE.Vector3()),
    carbonylC:worldPoint(instance,d.carbonylCLocal,new THREE.Vector3()),
    carbonylO:worldPoint(instance,d.carbonylOLocal,new THREE.Vector3())
  };
}

export function poseStateFromInstance(template,position,quaternion){
  const d=template.userData;
  const transform=(p)=>p.clone().applyQuaternion(quaternion).add(position);
  return {
    root:null,
    atoms:d.atomLocalPositions.map(transform),
    elements:d.atomElements,
    charges:d.atomCharges,
    center:transform(d.moleculeLocalCenter),
    carbonylC:transform(d.carbonylCLocal),
    carbonylO:transform(d.carbonylOLocal)
  };
}

function carbonylAxis(state){return state.carbonylO.clone().sub(state.carbonylC).normalize();}

export function evaluateStatePair(A,B){
  const centerDistanceA=distanceA(A.center,B.center);
  let coulomb=0,lj=0,minAtomDistanceA=Infinity;
  if(centerDistanceA>MAX_ENERGY_DISTANCE_A){
    return {energy:0,coulomb:0,lj:0,minAtomDistanceA,centerDistanceA,A,B,clash:false};
  }
  for(let i=0;i<A.atoms.length;i++){
    for(let j=0;j<B.atoms.length;j++){
      const rA=distanceA(A.atoms[i],B.atoms[j]);
      minAtomDistanceA=Math.min(minAtomDistanceA,rA);
      const safeR=Math.max(.45,rA),rNm=safeR*.1;
      coulomb+=COULOMB*A.charges[i]*B.charges[j]/(ELECTROSTATIC_SCREEN*rNm);
      const rmin=VDW[A.elements[i]]+VDW[B.elements[j]];
      const sigma=rmin/Math.pow(2,1/6);
      const eps=Math.sqrt(EPS[A.elements[i]]*EPS[B.elements[j]]);
      const sr=sigma/safeR,sr6=Math.pow(sr,6);
      lj+=4*eps*(sr6*sr6-sr6);
    }
  }
  const energy=coulomb+lj;
  return {energy,coulomb,lj,minAtomDistanceA,centerDistanceA,A,B,clash:minAtomDistanceA<CLASH_MIN_A};
}

export function evaluatePair(instanceA,instanceB){return evaluateStatePair(instanceState(instanceA),instanceState(instanceB));}

function directedContact(donor,acceptor,pair){
  if(pair.clash)return null;
  const from=donor.carbonylO;
  const to=acceptor.carbonylC;
  const distance=distanceA(from,to);
  if(distance<CONTACT_MIN_A||distance>CONTACT_MAX_A)return null;

  // Winkel am positiven Carbonyl-C: C_acceptor -> O_acceptor versus
  // C_acceptor -> O_donor. Sheared/reciprocal carbonyl contacts cluster
  // around roughly perpendicular approaches rather than along C–CH3.
  const acceptorAxis=carbonylAxis(acceptor);
  const approach=from.clone().sub(to).normalize();
  const approachAngle=angleDeg(acceptorAxis,approach);
  if(approachAngle<CONTACT_ANGLE_MIN_DEG||approachAngle>CONTACT_ANGLE_MAX_DEG)return null;

  const donorAxis=carbonylAxis(donor);
  const antiparallel=THREE.MathUtils.clamp((1-donorAxis.dot(acceptorAxis))/2,0,1);
  const distanceQuality=Math.exp(-0.5*Math.pow((distance-CONTACT_IDEAL_A)/CONTACT_SIGMA_A,2));
  const angleQuality=Math.exp(-0.5*Math.pow((approachAngle-CONTACT_ANGLE_IDEAL_DEG)/CONTACT_ANGLE_SIGMA_DEG,2));
  const attractionQuality=THREE.MathUtils.clamp((-pair.energy+1.0)/7.0,0.35,1.0);
  const strength=THREE.MathUtils.clamp(distanceQuality*angleQuality*(0.35+0.65*antiparallel)*attractionQuality,0,1);
  return {from,to,distanceA:distance,approachAngleDeg:approachAngle,strength,type:"O···C(=O)"};
}

export function contactsForStatePair(pair,{includeWeak=false}={}){
  const candidates=[directedContact(pair.A,pair.B,pair),directedContact(pair.B,pair.A,pair)].filter(Boolean);
  const threshold=includeWeak?0:CONTACT_VISIBLE_MIN;
  return candidates.filter(c=>c.strength>threshold).sort((a,b)=>b.strength-a.strength);
}

export function contactsForPair(pair,options={}){return contactsForStatePair(pair,options);}

export function evaluateActive(active,fixed){
  let collision=false,totalEnergy=0;
  const links=[];
  for(const other of fixed){
    const pair=evaluatePair(active,other);
    totalEnergy+=pair.energy;
    collision=collision||pair.clash;
    links.push(...contactsForStatePair(pair));
  }
  links.sort((a,b)=>b.strength-a.strength);
  const score=collision?0:THREE.MathUtils.clamp(50*links.reduce((sum,l)=>sum+l.strength,0),0,100);
  const lockContactCount=links.filter(l=>l.strength>=CONTACT_LOCK_MIN).length;
  return {totalEnergy,collision,links,score,lockContactCount};
}

export function collectAllLinks(instances){
  const links=[];
  for(let i=0;i<instances.length;i++){
    for(let j=i+1;j<instances.length;j++){
      links.push(...contactsForStatePair(evaluatePair(instances[i],instances[j])));
    }
  }
  links.sort((a,b)=>b.strength-a.strength);
  return links;
}

export function evaluateCluster(instances){
  let collision=false,totalEnergy=0;
  const links=[];
  for(let i=0;i<instances.length;i++){
    for(let j=i+1;j<instances.length;j++){
      const pair=evaluatePair(instances[i],instances[j]);
      totalEnergy+=pair.energy;
      collision=collision||pair.clash;
      links.push(...contactsForStatePair(pair));
    }
  }
  links.sort((a,b)=>b.strength-a.strength);
  const avg=links.length?links.reduce((sum,l)=>sum+l.strength,0)/links.length:0;
  return {score:collision?0:THREE.MathUtils.clamp(avg*100,0,100),links,totalEnergy,collision};
}

export const INTERACTION_CONSTANTS=Object.freeze({
  electrostaticScreen:ELECTROSTATIC_SCREEN,
  contactIdealA:CONTACT_IDEAL_A,
  contactSigmaA:CONTACT_SIGMA_A,
  contactMinA:CONTACT_MIN_A,
  contactMaxA:CONTACT_MAX_A,
  contactAngleIdealDeg:CONTACT_ANGLE_IDEAL_DEG,
  contactAngleMinDeg:CONTACT_ANGLE_MIN_DEG,
  contactAngleMaxDeg:CONTACT_ANGLE_MAX_DEG,
  contactVisibleMin:CONTACT_VISIBLE_MIN,
  contactLockMin:CONTACT_LOCK_MIN,
  clashMinA:CLASH_MIN_A,
  maxEnergyDistanceA:MAX_ENERGY_DISTANCE_A
});
