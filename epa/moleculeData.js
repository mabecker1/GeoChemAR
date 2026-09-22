export const DEFAULT_MOLECULE = "CH4";

export const MOLECULES = Object.freeze({
  CH4: Object.freeze({
    key: "CH4",
    formula: "CH₄",
    name: "Methan",
    epaAtom: "C",
    molecularGeometry: "tetraedrisch",
    representativeBondAngle: Object.freeze({
      label: "H–C–H",
      value: 109.5,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 0,
    geometryOverlay: "tetrahedral",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.0,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  }),

  H2CO: Object.freeze({
    key: "H2CO",
    formula: "H₂CO",
    name: "Formaldehyd",
    epaAtom: "C",
    molecularGeometry: "trigonal-planar",
    representativeBondAngle: Object.freeze({
      label: "Bindungswinkel am C",
      value: 120.0,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 0,
    geometryOverlay: "trigonalPlanar",
    zoom: Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 }),
    implemented: false
  }),

  CO2: Object.freeze({
    key: "CO2",
    formula: "CO₂",
    name: "Kohlenstoffdioxid",
    epaAtom: "C",
    molecularGeometry: "linear",
    representativeBondAngle: Object.freeze({
      label: "O–C–O",
      value: 180.0,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 0,
    geometryOverlay: "linear",
    zoom: Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 }),
    implemented: false
  }),

  NH3: Object.freeze({
    key: "NH3",
    formula: "NH₃",
    name: "Ammoniak",
    epaAtom: "N",
    molecularGeometry: "trigonal-pyramidal",
    representativeBondAngle: Object.freeze({
      label: "H–N–H",
      value: 106.5,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 1,
    geometryOverlay: "trigonalPyramidal",
    zoom: Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 }),
    implemented: false
  }),

  H2O: Object.freeze({
    key: "H2O",
    formula: "H₂O",
    name: "Wasser",
    epaAtom: "O",
    molecularGeometry: "gewinkelt",
    representativeBondAngle: Object.freeze({
      label: "H–O–H",
      value: 104.5,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 2,
    geometryOverlay: "bent",
    zoom: Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 }),
    implemented: false
  }),

  HCl: Object.freeze({
    key: "HCl",
    formula: "HCl",
    name: "Chlorwasserstoff",
    epaAtom: "Cl",
    molecularGeometry: "linear (zweiatomig)",
    representativeBondAngle: null,
    lonePairsOnEpaAtom: 3,
    geometryOverlay: "diatomic",
    zoom: Object.freeze({ min: 0.6, max: 2.0, step: 0.1, default: 1.0 }),
    implemented: false
  })
});

export function getMoleculeData(key) {
  return MOLECULES[key] ?? MOLECULES[DEFAULT_MOLECULE];
}
