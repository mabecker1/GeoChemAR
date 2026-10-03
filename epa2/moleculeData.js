export const DEFAULT_MOLECULE = "NH3";

export const MOLECULES = Object.freeze({
  NH3: Object.freeze({
    key: "NH3",
    formula: "NH₃",
    name: "Ammoniak",
    epaAtom: "N",
    bondingPartnersOnEpaAtom: 3,
    molecularGeometry: "trigonal-pyramidal",
    representativeBondAngle: Object.freeze({
      label: "H–N–H",
      value: 106.5,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 1,
    geometryOverlay: "trigonalPyramidal",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.0,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  }),

  H2O: Object.freeze({
    key: "H2O",
    formula: "H₂O",
    name: "Wasser",
    epaAtom: "O",
    bondingPartnersOnEpaAtom: 2,
    molecularGeometry: "gewinkelt",
    representativeBondAngle: Object.freeze({
      label: "H–O–H",
      value: 104.5,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 2,
    geometryOverlay: "bent",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.0,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  }),

  HCl: Object.freeze({
    key: "HCl",
    formula: "HCl",
    name: "Chlorwasserstoff",
    epaAtom: "Cl",
    bondingPartnersOnEpaAtom: 1,
    molecularGeometry: "linear (zweiatomig)",
    representativeBondAngle: null,
    lonePairsOnEpaAtom: 3,
    geometryOverlay: "diatomic",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.0,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  })
});

export function getMoleculeData(key) {
  return MOLECULES[key] ?? MOLECULES[DEFAULT_MOLECULE];
}
