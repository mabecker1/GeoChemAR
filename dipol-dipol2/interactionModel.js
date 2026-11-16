import * as THREE from "../libs/three.module.min.js";
import { ANGSTROM_TO_SCENE } from "./ethanalBuilder.js";

// Atomzentrierte ESP-Ladungen + kurzreichweitiger LJ-Term.
const COULOMB=138.935456; // kJ mol^-1 for q[e], r[nm]
const ELECTROSTATIC_SCREEN=2.5;
const VDW=Object.freeze({H:1.20,C:1.70,O:1.52});
const EPS=Object.freeze({H:0.06,C:0.30,O:0.65});
const MAX_ENERGY_DISTANCE_A=9.0;
const CLASH_MIN_A=1.45;

/*
  Eine sichtbare Dipol-Dipol-WW ist IMMER ein O···C(=O)-Kontakt.
  Günstigkeit und Linien verwenden exakt dieselbe Kontaktstärke.

  Die Kontaktmetrik wurde auf die stabile P21/c-Packung kalibriert:
  in der berechneten, an die experimentelle 5-K-Einheitszelle gebundenen
  Referenzpackung liegen die stärksten O···C-Kontakte bei ca. 4.07 Å.
*/
const CONTACT_IDEAL_A=4.08;
const CONTACT_SIGMA_A=0.58;
const CONTACT_MIN_A=2.70;
const CONTACT_MAX_A=5.15;
const CONTACT_VISIBLE_MIN=0.20;
const CONTACT_LOCK_MIN=0.68;
const PAIR_ATTRACTION_ONSET=0.25;  // kJ/mol attractive magnitude
const PAIR_ATTRACTION_FULL=1.55;   // kJ/mol -> full energetic weight

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

function contactStrength(distanceAng,pair){
  if(pair.clash||distanceAng<CONTACT_MIN_A||distanceAng>CONTACT_MAX_A||!Number.isFinite(pair.energy))return 0;
  const distanceQuality=Math.exp(-0.5*Math.pow((distanceAng-CONTACT_IDEAL_A)/CONTACT_SIGMA_A,2));
  const attraction=Math.max(0,-pair.energy);
  const energyQuality=THREE.MathUtils.clamp(
    (attraction-PAIR_ATTRACTION_ONSET)/(PAIR_ATTRACTION_FULL-PAIR_ATTRACTION_ONSET),
    0,1
  );
  return THREE.MathUtils.clamp(distanceQuality*energyQuality,0,1);
}

export function contactsForPair(pair,{includeWeak=false}={}){
  const candidates=[
    {from:pair.A.carbonylO,to:pair.B.carbonylC,distanceA:distanceA(pair.A.carbonylO,pair.B.carbonylC),type:"O···C(=O)"},
    {from:pair.B.carbonylO,to:pair.A.carbonylC,distanceA:distanceA(pair.B.carbonylO,pair.A.carbonylC),type:"O···C(=O)"}
  ];
  for(const c of candidates)c.strength=contactStrength(c.distanceA,pair);
  return candidates.filter(c=>includeWeak?c.strength>0:c.strength>=CONTACT_VISIBLE_MIN);
}

function scoreFromVisibleContacts(contacts,collision=false){
  if(collision)return 0;
  const strengths=contacts.map(c=>c.strength).filter(s=>s>=CONTACT_VISIBLE_MIN).sort((a,b)=>b-a);
  // Zwei ideale sichtbare O···C-Kontakte entsprechen 100 %. Ein einzelner
  // Kontakt kann daher höchstens 50 % liefern. So sind Linien und Anzeige
  // unmittelbar und jederzeit stringent gekoppelt.
  const s1=strengths[0]??0;
  const s2=strengths[1]??0;
  return THREE.MathUtils.clamp(50*(s1+s2),0,100);
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
    links.push(...contactsForPair(pair));
  }
  links.sort((a,b)=>b.strength-a.strength);
  const score=scoreFromVisibleContacts(links,collision);
  const lockContacts=links.filter(l=>l.strength>=CONTACT_LOCK_MIN);
  return {totalEnergy,score,collision,links,pairs,lineCount:links.length,lockContactCount:lockContacts.length};
}

export function collectAllLinks(instances){
  const links=[];
  for(let i=0;i<instances.length;i++){
    for(let j=i+1;j<instances.length;j++){
      links.push(...contactsForPair(evaluatePair(instances[i],instances[j])));
    }
  }
  links.sort((a,b)=>b.strength-a.strength);
  return links;
}

export function evaluateCluster(instances){
  let collision=false;
  const links=[];
  let totalEnergy=0;
  for(let i=0;i<instances.length;i++){
    for(let j=i+1;j<instances.length;j++){
      const pair=evaluatePair(instances[i],instances[j]);
      totalEnergy+=pair.energy;
      collision=collision||pair.clash;
      links.push(...contactsForPair(pair));
    }
  }
  links.sort((a,b)=>b.strength-a.strength);
  return {score:scoreFromVisibleContacts(links,collision),links,totalEnergy,collision};
}

export const INTERACTION_CONSTANTS=Object.freeze({
  electrostaticScreen:ELECTROSTATIC_SCREEN,
  contactIdealA:CONTACT_IDEAL_A,
  contactSigmaA:CONTACT_SIGMA_A,
  contactMinA:CONTACT_MIN_A,
  contactMaxA:CONTACT_MAX_A,
  contactVisibleMin:CONTACT_VISIBLE_MIN,
  contactLockMin:CONTACT_LOCK_MIN,
  clashMinA:CLASH_MIN_A,
  maxEnergyDistanceA:MAX_ENERGY_DISTANCE_A
});
