/*
  Referenzstruktur für den Button „Günstigste Anordnung“.

  Experimentelle Randbedingung:
  stabile Tieftemperaturphase von Acetaldehyd-d4 bei 5 K,
  P21/c (Nr. 14), Z=4,
  a=3.9069 Å, b=5.4224 Å, c=12.1868 Å, beta=94.2970°.

  Die vier Moleküle wurden mit diesen festen Zellparametern und den P21/c-
  Symmetrieoperationen aus EINEM unabhängigen Molekül erzeugt. Dessen
  fraktionelle Lage und Orientierung wurden global (Differential Evolution)
  mit demselben ESP-Ladungs-/Lennard-Jones-Modell wie in der Anwendung
  optimiert. Für die beiden improper Symmetrieabbildungen wird bei der
  Darstellung die äquivalente Spiegelung an der Molekülebene durch eine
  proper Rotation ersetzt; Ethanal ist achiral und die Carbonylorientierung
  bleibt dabei erhalten.
*/
export const CRYSTAL_REFERENCE=Object.freeze({
  spaceGroup:"P21/c",
  temperatureK:5,
  Z:4,
  cell:Object.freeze({a:3.9069,b:5.4224,c:12.1868,betaDeg:94.2970}),
  source:"Ibberson, Yamamuro & Matsuo, J. Mol. Struct. 520 (2000) 265–272",
  optimization:"P21/c-constrained global packing optimization; ESP charges + LJ",
  targets:Object.freeze([
    Object.freeze({centerA:Object.freeze([-0.9494726121,-1.7866374208,-1.7675551427]),quaternion:Object.freeze([0.3451212756,0.8745868366,-0.0496468322,0.3369337656])}),
    Object.freeze({centerA:Object.freeze([ 1.4060298339, 0.9245625792,-4.3087166636]),quaternion:Object.freeze([0.0496468322,-0.3369337656,0.3451212756,0.8745868366])}),
    Object.freeze({centerA:Object.freeze([ 0.9494726121, 1.7866374208, 1.7675551427]),quaternion:Object.freeze([0.8745868366,-0.3451212756,0.3369337656,0.0496468322])}),
    Object.freeze({centerA:Object.freeze([-1.4060298339,-0.9245625792, 4.3087166636]),quaternion:Object.freeze([-0.3369337656,-0.0496468322,0.8745868366,-0.3451212756])})
  ])
});
