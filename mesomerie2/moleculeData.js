export const DEFAULT_MOLECULE = "CARBONATE";

export const MOLECULES = Object.freeze({
  CARBONATE: Object.freeze({
    key: "CARBONATE",
    formula: "CO₃²⁻",
    name: "Carbonat-Anion",
    charge: -2,
    zoom: Object.freeze({
      min: 0.6,
      max: 2.1,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  })
});

export function getMoleculeData(key) {
  return MOLECULES[key] ?? MOLECULES[DEFAULT_MOLECULE];
}
