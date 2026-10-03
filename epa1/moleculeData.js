export const DEFAULT_MOLECULE = "CH4";

export const MOLECULES = Object.freeze({
  CH4: Object.freeze({
    key: "CH4",
    formula: "CH₄",
    name: "Methan",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 4,
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
    bondingPartnersOnEpaAtom: 3,
    molecularGeometry: "trigonal-planar",
    representativeBondAngle: Object.freeze({
      label: "Bindungswinkel am C",
      value: 120.0,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 0,
    geometryOverlay: "trigonalPlanar",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.0,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  }),

  CO2: Object.freeze({
    key: "CO2",
    formula: "CO₂",
    name: "Kohlenstoffdioxid",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 2,
    molecularGeometry: "linear",
    representativeBondAngle: Object.freeze({
      label: "O–C–O",
      value: 180.0,
      unit: "°"
    }),
    lonePairsOnEpaAtom: 0,
    geometryOverlay: "linear",
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
