/*
  dipol-dipol2h – dreidimensionales Ethanal-Wachstumsgitter

  Ausgangspunkt ist die für dipol-dipol2 verwendete P21/c-Packungsrechnung
  (stabile Tieftemperaturphase, Z = 4). Die vier optimierten Basislagen wurden
  periodisch mit den experimentellen Zellvektoren fortgesetzt. Aus diesem
  periodischen Gitter wurde um ein Referenzmolekül ein kompakter 10er-Cluster
  gewählt, der
    - in allen drei Raumrichtungen wächst,
    - bei jedem neuen Molekül an den vorhandenen Cluster angebunden bleibt,
    - viele günstige O···C(=O)-Nachbarschaften enthält.

  Target 0 = festes Ausgangsmolekül.
  Target 1 = Zielposition des EINZIGEN mit dem Würfel ausgerichteten Moleküls.
  Targets 2…9 = acht automatisch, nacheinander hinzugefügte Moleküle.

  Die Koordinaten sind in Å relativ zu Target 0; die Quaternionen sind relativ
  zur Orientierung von Target 0. In der vollständigen 10er-Struktur ergeben
  sich mit der in interactionModel.js verwendeten Kontaktmetrik 16 sichtbare
  O···C(=O)-Nachbarschaften.
*/
export const CRYSTAL_REFERENCE=Object.freeze({
  spaceGroup:"P21/c",
  Z:4,
  cell:Object.freeze({a:3.9069,b:5.4224,c:12.1868,betaDeg:94.2970}),
  source:"P21/c-periodic packing derived from the dipol-dipol2 packing calculation",
  totalMolecules:10,
  manualTargetIndex:1,
  automaticTargetStart:2,
  expectedFullContactCount:16,
  targets:Object.freeze([
    Object.freeze({centerA:Object.freeze([ 0.0000000000, 0.0000000000, 0.0000000000]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 0.0000000000, 1.0000000000])}),
    Object.freeze({centerA:Object.freeze([ 1.8711473773, 3.1824358619, 2.3932004861]),quaternion:Object.freeze([-0.5702216611,-0.7568529944, 0.3194069538, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([-1.2208225580,-0.9215238147, 4.1251527524]),quaternion:Object.freeze([-0.5702216611,-0.7568529944, 0.3194069538, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([-3.0919699353,-4.1039596766, 1.7319522663]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 0.0000000000, 1.0000000000])}),
    Object.freeze({centerA:Object.freeze([-4.3127924933,-5.0254834912, 5.8571050188]),quaternion:Object.freeze([-0.5702216611,-0.7568529944, 0.3194069538, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([ 3.0919699353, 4.1039596766,-1.7319522663]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 0.0000000000, 1.0000000000])}),
    Object.freeze({centerA:Object.freeze([ 4.9631173126, 7.2863955384, 0.6612482197]),quaternion:Object.freeze([-0.5702216611,-0.7568529944, 0.3194069538, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([ 0.9067004574, 1.9402649075,-4.9709603274]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 1.0000000000, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([-2.1852694779,-2.1636947691,-3.2390080611]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 1.0000000000, 0.0000000000])}),
    Object.freeze({centerA:Object.freeze([-5.2772394131,-6.2676544456,-1.5070557947]),quaternion:Object.freeze([ 0.0000000000, 0.0000000000, 1.0000000000, 0.0000000000])})
  ])
});
