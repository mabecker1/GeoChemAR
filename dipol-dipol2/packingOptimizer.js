import * as THREE from "../libs/three.module.min.js";
import { ANGSTROM_TO_SCENE } from "./ethanalBuilder.js";
import { poseStateFromInstance,evaluateStatePair,contactsForStatePair } from "./interactionModel.js";

// Published periodic pure-acetaldehyde structure prediction (USPEX/VASP,
// followed by PBEsol0-3c): 2 molecules/cell, cell dimensions below. The exact
// published basis coordinates are not available in the accessible article, so
// the manually fixed antiparallel pair is used as the two-molecule basis. The
// automatic growth retains those two orientations exactly and optimizes only
// translations around the existing cluster.
export const BULK_CELL=Object.freeze({
  moleculesPerCell:2,
  a:4.960,b:5.655,c:4.536,
  alphaDeg:89.55,betaDeg:89.70,gammaDeg:127.17
});

const CONTACT_DISTANCES_A=[3.05,3.18,3.30];
const APPROACH_ANGLES_DEG=[78,90,102];
const AZIMUTH_STEP_DEG=30;
const MAX_CENTER_RADIUS_A=13.5;
const MIN_CENTER_SEPARATION_A=2.70;
const MAX_TOTAL_MOLECULES=20;

const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3();
function toA(sceneDistance){return sceneDistance/ANGSTROM_TO_SCENE;}
function localState(instance){return poseStateFromInstance(instance,instance.position,instance.quaternion);}
function perpendicularFrame(axis){
  const u=_v1.set(0,0,1);
  if(Math.abs(axis.dot(u))>.90)u.set(0,1,0);
  const p=new THREE.Vector3().crossVectors(axis,u).normalize();
  const q=new THREE.Vector3().crossVectors(axis,p).normalize();
  return {p,q};
}
function directionAt(axis,thetaDeg,phiDeg){
  const {p,q}=perpendicularFrame(axis);
  const th=THREE.MathUtils.degToRad(thetaDeg),ph=THREE.MathUtils.degToRad(phiDeg);
  return axis.clone().multiplyScalar(Math.cos(th))
    .addScaledVector(p,Math.sin(th)*Math.cos(ph))
    .addScaledVector(q,Math.sin(th)*Math.sin(ph)).normalize();
}
function stateCarbonylAxis(state){return state.carbonylO.clone().sub(state.carbonylC).normalize();}
function rotatedLocalPoint(instance,key,quaternion){return instance.userData[key].clone().applyQuaternion(quaternion);}

function anchorAxes(fixed){
  const first=fixed[0],d=first.userData;
  const c=d.atomLocalPositions[1].clone().applyQuaternion(first.quaternion).add(first.position);
  const o=d.atomLocalPositions[2].clone().applyQuaternion(first.quaternion).add(first.position);
  const methyl=d.atomLocalPositions[0].clone().applyQuaternion(first.quaternion).add(first.position);
  const x=o.clone().sub(c).normalize();
  const z=new THREE.Vector3().crossVectors(o.clone().sub(c),methyl.clone().sub(c)).normalize();
  const y=new THREE.Vector3().crossVectors(z,x).normalize();
  return {x,y,z,origin:localState(first).center};
}
function axisRanges(states,axes){
  const ranges=[];
  for(const axis of [axes.x,axes.y,axes.z]){
    let lo=Infinity,hi=-Infinity;
    for(const s of states){
      const val=toA(s.center.clone().sub(axes.origin).dot(axis));
      lo=Math.min(lo,val);hi=Math.max(hi,val);
    }
    ranges.push({lo,hi,range:Math.max(0,hi-lo)});
  }
  return ranges;
}
function threeDimensionalGrowthBonus(existingStates,candidateState,axes){
  const before=axisRanges(existingStates,axes);
  const after=axisRanges([...existingStates,candidateState],axes);

  // Reales 3D-Wachstum statt möglichst großer Ausdehnung: bis etwa zwei
  // Molekülschichten pro Achse wird zusätzliche Breite belohnt; danach wird
  // weiteres Auseinanderziehen gebremst. So bleibt der 20er-Cluster kompakt.
  const targetSpanA=10.5,softMaxSpanA=14.0;
  let compactSpread=0;
  for(let i=0;i<3;i++){
    compactSpread+=0.62*(Math.min(after[i].range,targetSpanA)-Math.min(before[i].range,targetSpanA));
    compactSpread-=1.10*(Math.max(0,after[i].range-softMaxSpanA)-Math.max(0,before[i].range-softMaxSpanA));
  }

  // Die jeweils dünnste Raumrichtung wird bevorzugt aufgefüllt, bis dort
  // mindestens mehrere Molekülschichten entstanden sind.
  const thinnestIndex=before.reduce((best,r,i,a)=>r.range<a[best].range?i:best,0);
  const thinBefore=before[thinnestIndex].range;
  const thinGain=Math.max(0,Math.min(after[thinnestIndex].range,8.0)-Math.min(thinBefore,8.0));
  const layerBoost=1.15*thinGain;

  // Beide Seiten jeder lokalen Achse besetzen: oben/unten, links/rechts und
  // vorne/hinten. Eine noch völlig leere Gegenseite erhält gezielt Vorrang.
  const rel=candidateState.center.clone().sub(axes.origin);
  let balanceGain=0;
  const axisList=[axes.x,axes.y,axes.z];
  for(let ai=0;ai<3;ai++){
    const axis=axisList[ai];
    let neg=0,pos=0;
    for(const st of existingStates){
      const v=toA(st.center.clone().sub(axes.origin).dot(axis));
      if(v<-0.9)neg++;else if(v>0.9)pos++;
    }
    const cv=toA(rel.dot(axis));
    const beforeImbalance=Math.abs(pos-neg);
    if(cv>0.9){
      balanceGain+=0.62*(beforeImbalance-Math.abs((pos+1)-neg));
      if(pos===0&&neg>=2)balanceGain+=5.0;
      if(neg===0&&pos>=2)balanceGain-=1.6;
    }else if(cv<-0.9){
      balanceGain+=0.62*(beforeImbalance-Math.abs(pos-(neg+1)));
      if(neg===0&&pos>=2)balanceGain+=5.0;
      if(pos===0&&neg>=2)balanceGain-=1.6;
    }
  }

  // Neue lokale Gitterzellen bevorzugen, damit benachbarte Schichten wirklich
  // aufgefüllt werden und nicht mehrere Moleküle dieselbe Richtung verlängern.
  const cellSizeA=4.2;
  const occupied=new Set(existingStates.map(st=>{
    const d=st.center.clone().sub(axes.origin);
    return axisList.map(a=>Math.round(toA(d.dot(a))/cellSizeA)).join(":");
  }));
  const cd=candidateState.center.clone().sub(axes.origin);
  const ckey=axisList.map(a=>Math.round(toA(cd.dot(a))/cellSizeA)).join(":");
  const novelty=occupied.has(ckey)?0:0.65;
  return compactSpread+layerBoost+balanceGain+novelty;
}
function candidateKey(position,orientationIndex){
  const s=1/ANGSTROM_TO_SCENE;
  return `${orientationIndex}:${Math.round(position.x*s*10)}:${Math.round(position.y*s*10)}:${Math.round(position.z*s*10)}`;
}

function scoreCandidate(candidateState,existingStates,axes){
  let totalStrength=0,lineCount=0,totalEnergy=0;
  let nearestCenterA=Infinity;
  for(const other of existingStates){
    const pair=evaluateStatePair(candidateState,other);
    if(pair.clash)return null;
    const centerD=toA(candidateState.center.distanceTo(other.center));
    nearestCenterA=Math.min(nearestCenterA,centerD);
    if(centerD<MIN_CENTER_SEPARATION_A)return null;
    totalEnergy+=pair.energy;
    const links=contactsForStatePair(pair);
    lineCount+=links.length;
    totalStrength+=links.reduce((sum,l)=>sum+l.strength,0);
  }
  if(lineCount<1)return null;
  const radiusA=toA(candidateState.center.distanceTo(axes.origin));
  if(radiusA>MAX_CENTER_RADIUS_A)return null;
  const densityQuality=Math.exp(-0.5*Math.pow((nearestCenterA-4.7)/1.25,2));
  const growth3D=threeDimensionalGrowthBonus(existingStates,candidateState,axes);
  const score=
    4.6*totalStrength+
    1.00*lineCount+
    0.34*densityQuality+
    growth3D+
    0.015*Math.max(0,-totalEnergy)-
    0.040*Math.max(0,totalEnergy)-
    0.025*radiusA;
  return {score,totalStrength,lineCount,totalEnergy,radiusA,nearestCenterA};
}

export function findBestNextPose(fixed){
  if(!Array.isArray(fixed)||fixed.length<2||fixed.length>=MAX_TOTAL_MOLECULES)return null;
  const template=fixed[0];
  const orientationQuats=[fixed[0].quaternion.clone(),fixed[1].quaternion.clone()];
  const existingStates=fixed.map(localState);
  const axes=anchorAxes(fixed);
  const candidates=new Map();

  for(const existing of existingStates){
    const existingAxis=stateCarbonylAxis(existing);
    for(let oi=0;oi<orientationQuats.length;oi++){
      const q=orientationQuats[oi];
      const localO=rotatedLocalPoint(template,"carbonylOLocal",q);
      const localC=rotatedLocalPoint(template,"carbonylCLocal",q);
      const candidateAxis=localO.clone().sub(localC).normalize();

      // Candidate O (δ−) approaches existing carbonyl C (δ+).
      for(const dA of CONTACT_DISTANCES_A){
        for(const theta of APPROACH_ANGLES_DEG){
          for(let phi=0;phi<360;phi+=AZIMUTH_STEP_DEG){
            const dir=directionAt(existingAxis,theta,phi);
            const targetO=existing.carbonylC.clone().addScaledVector(dir,dA*ANGSTROM_TO_SCENE);
            const position=targetO.sub(localO);
            const key=candidateKey(position,oi);
            if(!candidates.has(key))candidates.set(key,{position:position.clone(),quaternion:q.clone(),orientationIndex:oi});
          }
        }
      }

      // Existing O (δ−) approaches candidate carbonyl C (δ+).
      for(const dA of CONTACT_DISTANCES_A){
        for(const theta of APPROACH_ANGLES_DEG){
          for(let phi=0;phi<360;phi+=AZIMUTH_STEP_DEG){
            const dir=directionAt(candidateAxis,theta,phi);
            const targetC=existing.carbonylO.clone().addScaledVector(dir,-dA*ANGSTROM_TO_SCENE);
            const position=targetC.sub(localC);
            const key=candidateKey(position,oi);
            if(!candidates.has(key))candidates.set(key,{position:position.clone(),quaternion:q.clone(),orientationIndex:oi});
          }
        }
      }
    }
  }

  let best=null;
  for(const cand of candidates.values()){
    const state=poseStateFromInstance(template,cand.position,cand.quaternion);
    const meta=scoreCandidate(state,existingStates,axes);
    if(!meta)continue;
    if(!best||meta.score>best.meta.score)best={position:cand.position,quaternion:cand.quaternion,meta};
  }
  return best;
}

export const PACKING_CONSTANTS=Object.freeze({
  totalMolecules:MAX_TOTAL_MOLECULES,
  contactDistancesA:Object.freeze([...CONTACT_DISTANCES_A]),
  approachAnglesDeg:Object.freeze([...APPROACH_ANGLES_DEG]),
  bulkCell:BULK_CELL
});
