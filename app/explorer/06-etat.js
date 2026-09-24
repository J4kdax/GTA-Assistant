/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 3. STATE
 * ========================================================================*/
const STATE = {
  rules: [],          // [{id, rule_type, libelle, ..., deps, rdeps}]
  byId: new Map(),    // id -> rule
  edges: [],          // [{from,to}]
  dayTypes: new Map(),// id -> dayType ref
  typeColor: new Map(),
  activeTypes: new Set(),
  activeAffect: '',
  selected: null,
  showDtLayer: false,
  stabilized: false,  // true une fois la mise en page initiale figée
  pendingFileTarget: 'rules',
  network: null,
  nodeDS: null,
  edgeDS: null
};
