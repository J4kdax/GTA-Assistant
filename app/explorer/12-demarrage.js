/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 8. BOOT
 * ========================================================================*/
function init() {
  if (typeof vis === 'undefined' || !vis.Network) {
    document.getElementById('load-error').classList.add('show');
    return;
  }
  // 1. Load embedded data (peut être vide pour la version publique)
  const hasEmbeddedRules = EMBEDDED_RULES && Array.isArray(EMBEDDED_RULES.nodes) && EMBEDDED_RULES.nodes.length > 0;
  if (hasEmbeddedRules) {
    Graph.loadDataset({rules: EMBEDDED_RULES.nodes});
  }
  if (Array.isArray(EMBEDDED_DAY_TYPES) && EMBEDDED_DAY_TYPES.length > 0) {
    Graph.loadDayTypes(EMBEDDED_DAY_TYPES);
  }
  // Affiche l'écran d'accueil si aucune règle au démarrage
  const welcome = document.getElementById('welcome-overlay');
  if (welcome) {
    welcome.hidden = hasEmbeddedRules;
    const wbtn = document.getElementById('welcome-load');
    if (wbtn) wbtn.addEventListener('click', () => Shell.pickFiles());
  }

  // 2. Wire actions
  document.getElementById('btn-relayout').addEventListener('click', () => {
    Graph.create();
    Graph.stabilizeAndLock();
    toast(L('Disposition recalculée', 'Layout recomputed'), 'ok');
  });
  paintBrand();
  THEME.set(THEME.read() || 'light', {persist:false});
  document.getElementById('btn-audit').addEventListener('click', () => Analyse.audit());
  document.getElementById('btn-audit-side').addEventListener('click', () => Analyse.audit());
  document.getElementById('btn-isolates').addEventListener('click', () => Analyse.isolates());
  document.getElementById('btn-variables').addEventListener('click', () => Analyse.variables());
  document.getElementById('btn-counters').addEventListener('click', () => Analyse.counters());
  // La vue par contrat s'ouvre sur l'affectation déjà filtrée, s'il y en a une.
  document.getElementById('btn-contracts').addEventListener('click', () => {
    const cur = Analyse.contractTypes().find(t => t.lib === STATE.activeAffect);
    Analyse.contracts(cur ? cur.id : null);
  });
  document.getElementById('an-close').addEventListener('click', () => Analyse.close());
  document.getElementById('an-modal').addEventListener('click', (e) => {
    if (e.target.id === 'an-modal') Analyse.close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Analyse.close(); });
  document.getElementById('btn-theme').addEventListener('click', () => THEME.toggle());
  document.getElementById('btn-fit').addEventListener('click', () => {
    if (STATE.network) STATE.network.fit({animation:{duration:300}});
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    STATE.selected = null;
    STATE.activeAffect = '';
    document.getElementById('filter-affect').value = '';
    document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('off'));
    STATE.activeTypes = new Set([...STATE.typeColor.keys()]);
    document.getElementById('search').value='';
    document.getElementById('search-results').innerHTML='';
    UI.applyFilters();
    UI.renderDetail(null);
  });

  // Dépôt de fichiers : géré par la coquille de l'Atelier (app/shell.js).

  document.getElementById('toggle-dt-layer').addEventListener('change', e => {
    STATE.showDtLayer = e.target.checked;
    Graph.refreshDayTypeLayer();
  });
  document.getElementById('toggle-ancestors').addEventListener('change', UI.refreshHighlights);
  document.getElementById('toggle-descendants').addEventListener('change', UI.refreshHighlights);

  document.getElementById('filter-affect').addEventListener('change', e => {
    STATE.activeAffect = e.target.value || '';
    UI.applyFilters();
  });
  document.getElementById('search').addEventListener('input', e => UI.onSearchInput(e.target.value));

  // Indicateur appels caducs : clic sur le pill -> popover, clic ailleurs -> ferme
  const indEl = document.getElementById('indicator-anom');
  if (indEl) indEl.addEventListener('click', (e) => {
    e.stopPropagation();
    Optimizations.close();
    BrokenRefs.toggle();
  });
  const popEl = document.getElementById('indicator-anom-panel');
  if (popEl) popEl.addEventListener('click', (e) => e.stopPropagation());

  // Indicateur optimisations
  const optEl = document.getElementById('indicator-opti');
  if (optEl) optEl.addEventListener('click', (e) => {
    e.stopPropagation();
    BrokenRefs.close();
    Optimizations.toggle();
  });
  const optPopEl = document.getElementById('indicator-opti-panel');
  if (optPopEl) optPopEl.addEventListener('click', (e) => e.stopPropagation());

  // Clic ailleurs = ferme les deux popovers
  document.body.addEventListener('click', () => {
    BrokenRefs.close();
    Optimizations.close();
  });

  // Calcul initial après stabilisation
  setTimeout(() => { BrokenRefs.render(); Optimizations.render(); }, 200);
}

/* Point d'entrée de l'Atelier : le modèle vient du moteur (engine/model.py). */
const Explorer = {
  // Types de jour avec la catégorie dans la langue de l'interface.
  dayTypes(model) {
    const en = I18N.lang === 'en';
    return (model.types_jour || []).map(d => ({ ...d, categorie: en ? (d.categorie_en || d.categorie) : d.categorie }));
  },

  load(model) {
    Graph.loadDataset({ rules: model.regles });
    Graph.loadDayTypes(Explorer.dayTypes(model));
    STATE.selected = null;
    UI.renderDetail(null);
  },

  // vis-network mesure son conteneur : on recadre quand l'onglet redevient visible.
  shown() {
    if (STATE.network) { STATE.network.redraw(); STATE.network.fit({ animation: false }); }
  },

  // Changement de langue : on refait tout ce que l'Explorer a écrit lui-même,
  // sans reconstruire le graphe (la disposition et la sélection sont gardées).
  relabel(model) {
    Analyse.close();
    THEME.set(THEME.current || 'light', { persist: false });
    const affect = document.getElementById('filter-affect');
    if (affect && affect.options.length) affect.options[0].textContent = L('— Toutes les affectations —', '— All assignments —');
    if (STATE.nodeDS) {
      STATE.nodeDS.update(STATE.rules.map(r => ({ id: r.id, title: Graph.makeRuleNode(r).title })));
    }
    Graph.loadDayTypes(Explorer.dayTypes(model));   // panneau, pastilles, décompte, détail
    if (STATE.showDtLayer) Graph.refreshDayTypeLayer();
    Graph.paintStats();
    BrokenRefs.render();
    Optimizations.render();
    const sel = STATE.selected;
    UI.renderDetail(typeof sel === 'number' ? STATE.byId.get(sel) : null);
  },

  // Remise à zéro : le graphe et tous les panneaux reviennent à l'état initial.
  clear() {
    Analyse.close();
    if (STATE.network) { STATE.network.destroy(); STATE.network = null; }
    Object.assign(STATE, {
      rules: [], byId: new Map(), edges: [], dayTypes: new Map(), typeColor: new Map(),
      activeTypes: new Set(), activeAffect: '', selected: null, showDtLayer: false,
      stabilized: false, nodeDS: null, edgeDS: null,
    });
    const affect = document.getElementById('filter-affect');
    affect.innerHTML = `<option value="">${L('— Toutes les affectations —', '— All assignments —')}</option>`;
    document.getElementById('search').value = '';
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('toggle-dt-layer').checked = false;
    document.getElementById('legend').innerHTML = '';
    document.getElementById('legend-count').textContent = '0';
    document.getElementById('stats').textContent = '';
    UI.renderDayTypePanel();
    UI.renderDetail(null);
    BrokenRefs.render();
    Optimizations.render();
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) welcome.hidden = false;
  },

  relabelEmpty() {
    THEME.set(THEME.current || 'light', { persist: false });
    UI.renderDetail(null);
    if (typeof BrokenRefs !== 'undefined') BrokenRefs.render();
    if (typeof Optimizations !== 'undefined') Optimizations.render();
  },
};

document.addEventListener('DOMContentLoaded', init);
