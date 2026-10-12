export const DEFAULT_MOLECULE = "METHOXIDE";

export const MOLECULES = Object.freeze({
  METHOXIDE: Object.freeze({
    key: "METHOXIDE",
    formula: "CH₃O⁻",
    name: "Methanolat-Anion",
    charge: -1,
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
