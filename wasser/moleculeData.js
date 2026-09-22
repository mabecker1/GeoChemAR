export const DEFAULT_MOLECULE = "WATER_CLUSTER";

export const MOLECULES = Object.freeze({
  WATER_CLUSTER: Object.freeze({
    key: "WATER_CLUSTER",
    formula: "(H₂O)₁₀₀",
    name: "Wasser-Ausschnitt",
    zoom: Object.freeze({
      min: 0.35,
      max: 2.3,
      step: 0.1,
      default: 0.80
    }),
    implemented: true
  })
});

export function getMoleculeData(key){
  const molecule = MOLECULES[key];
  if(!molecule) throw new Error(`Unbekanntes Molekül: ${key}`);
  return molecule;
}
