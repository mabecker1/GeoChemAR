export const DEFAULT_MOLECULE = "ETHANOL";

export const MOLECULES = Object.freeze({
  ETHANOL: Object.freeze({
    key: "ETHANOL",
    formula: "C₂H₆O",
    name: "Ethanol",
    zoom: Object.freeze({
      min: 0.55,
      max: 2.2,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  })
});

export function getMoleculeData(key){
  const molecule = MOLECULES[key];
  if(!molecule) throw new Error(`Unbekanntes Molekül: ${key}`);
  return molecule;
}
