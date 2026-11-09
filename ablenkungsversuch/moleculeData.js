export const MOLECULES = {
  water: {
    key: "water",
    name: "Wasser",
    formula: "H₂O",
    zoom: { default: 1.0, min: 0.72, max: 1.95, step: 0.08 },
    macroDeflection: true,
    microCount: 11
  },
  hexane: {
    key: "hexane",
    name: "Hexan",
    formula: "C₆H₁₄",
    zoom: { default: 0.92, min: 0.58, max: 1.65, step: 0.07 },
    macroDeflection: false,
    microCount: 8
  }
};

export const DEFAULT_MOLECULE = "water";

export function getMoleculeData(key){
  return MOLECULES[key] || MOLECULES[DEFAULT_MOLECULE];
}
