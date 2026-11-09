export const DEFAULT_MOLECULE = "H2O";

export const MOLECULES = Object.freeze({
  H2O: Object.freeze({
    key: "H2O",
    formula: "H₂O",
    name: "Wasser",
    bondPolarity: "polar",
    chargeDistribution: "ungleich",
    comparisonHint: "Polare O–H-Bindungen führen zu einer deutlich ungleichen Ladungsverteilung.",
    zoom: Object.freeze({
      min: 0.6,
      max: 2.1,
      step: 0.1,
      default: 1.0
    }),
    implemented: true
  }),

  CH4: Object.freeze({
    key: "CH4",
    formula: "CH₄",
    name: "Methan",
    bondPolarity: "nahezu unpolar",
    chargeDistribution: "nahezu gleichmäßig",
    comparisonHint: "Die C–H-Bindungen sind nahezu unpolar; die Ladungsverteilung ist deshalb fast überall ähnlich.",
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
