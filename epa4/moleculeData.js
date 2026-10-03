export const DEFAULT_MOLECULE = "HOCl";

export const QUIZ_ORDER = Object.freeze(["HOCl", "PF3", "H2S", "HCOOH"]);

const ZOOM = Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 });

export const MOLECULES = Object.freeze({
  HOCl: Object.freeze({
    key: "HOCl",
    formula: "HOCl",
    name: "Hypochlorige Säure",
    epaAtom: "O",
    bondingPartnersOnEpaAtom: 2,
    lonePairsOnEpaAtom: 2,
    molecularGeometry: "gewinkelt",
    representativeBondAngle: Object.freeze({ label: "H–O–Cl", value: 104.5, unit: "°" }),
    geometryOverlay: "bent",
    geometryQuestions: Object.freeze([
      Object.freeze({ id: "O", atomLabel: "O-Atom", correct: "gewinkelt" })
    ]),
    zoom: ZOOM,
    implemented: true
  }),

  PF3: Object.freeze({
    key: "PF3",
    formula: "PF₃",
    name: "Phosphortrifluorid",
    epaAtom: "P",
    bondingPartnersOnEpaAtom: 3,
    lonePairsOnEpaAtom: 1,
    molecularGeometry: "trigonal-pyramidal",
    representativeBondAngle: Object.freeze({ label: "F–P–F", value: 106.5, unit: "°" }),
    geometryOverlay: "trigonalPyramidal",
    geometryQuestions: Object.freeze([
      Object.freeze({ id: "P", atomLabel: "P-Atom", correct: "trigonal-pyramidal" })
    ]),
    zoom: ZOOM,
    implemented: true
  }),

  H2S: Object.freeze({
    key: "H2S",
    formula: "H₂S",
    name: "Schwefelwasserstoff",
    epaAtom: "S",
    bondingPartnersOnEpaAtom: 2,
    lonePairsOnEpaAtom: 2,
    molecularGeometry: "gewinkelt",
    representativeBondAngle: Object.freeze({ label: "H–S–H", value: 104.5, unit: "°" }),
    geometryOverlay: "bent",
    geometryQuestions: Object.freeze([
      Object.freeze({ id: "S", atomLabel: "S-Atom", correct: "gewinkelt" })
    ]),
    zoom: ZOOM,
    implemented: true
  }),

  HCOOH: Object.freeze({
    key: "HCOOH",
    formula: "HCO(OH)",
    name: "Methansäure",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 3,
    lonePairsOnEpaAtom: 0,
    molecularGeometry: "trigonal-planar",
    representativeBondAngle: Object.freeze({ label: "Bindungswinkel am C", value: 120.0, unit: "°" }),
    geometryOverlay: "trigonalPlanar",
    geometryQuestions: Object.freeze([
      Object.freeze({ id: "C", atomLabel: "C-Atom", correct: "trigonal-planar" }),
      Object.freeze({ id: "O", atomLabel: "O-Atom der OH-Gruppe", correct: "gewinkelt" })
    ]),
    epaCenters: Object.freeze([
      Object.freeze({
        id: "C", atomLabel: "C", epaAtom: "C",
        bondingPartnersOnEpaAtom: 3, lonePairsOnEpaAtom: 0,
        molecularGeometry: "trigonal-planar",
        representativeBondAngle: Object.freeze({ label: "Bindungswinkel am C", value: 120.0, unit: "°" })
      }),
      Object.freeze({
        id: "O", atomLabel: "O(OH)", epaAtom: "O",
        bondingPartnersOnEpaAtom: 2, lonePairsOnEpaAtom: 2,
        molecularGeometry: "gewinkelt",
        representativeBondAngle: Object.freeze({ label: "C–O–H", value: 104.5, unit: "°" })
      })
    ]),
    zoom: ZOOM,
    implemented: true
  })
});

export function getMoleculeData(key) {
  return MOLECULES[key] ?? MOLECULES[DEFAULT_MOLECULE];
}
