export const DEFAULT_MOLECULE = "CS2";

export const QUIZ_ORDER = Object.freeze(["CS2", "CF4", "HCN", "COCl2"]);

export const MOLECULES = Object.freeze({
  CS2: Object.freeze({
    key: "CS2",
    formula: "CS₂",
    name: "Schwefelkohlenstoff",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 2,
    molecularGeometry: "linear",
    representativeBondAngle: Object.freeze({
      label: "S–C–S",
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
  }),

  CF4: Object.freeze({
    key: "CF4",
    formula: "CF₄",
    name: "Tetrafluormethan",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 4,
    molecularGeometry: "tetraedrisch",
    representativeBondAngle: Object.freeze({
      label: "F–C–F",
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

  HCN: Object.freeze({
    key: "HCN",
    formula: "HCN",
    name: "Cyanwasserstoff",
    epaAtom: "C",
    bondingPartnersOnEpaAtom: 2,
    molecularGeometry: "linear",
    representativeBondAngle: Object.freeze({
      label: "H–C–N",
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
  }),

  COCl2: Object.freeze({
    key: "COCl2",
    formula: "COCl₂",
    name: "Phosgen",
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
  })
});

export function getMoleculeData(key) {
  return MOLECULES[key] ?? MOLECULES[DEFAULT_MOLECULE];
}
