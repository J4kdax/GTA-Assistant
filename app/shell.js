/* Coquille de l'Atelier GTA : dépôt des fichiers, état partagé, navigation.
 *
 * Un seul modèle d'environnement (produit par engine/model.py) alimente tous
 * les onglets. Les fichiers déposés s'accumulent : ajouter un référentiel
 * après coup relance simplement l'analyse sur l'ensemble.
 */
"use strict";

const Shell = {
  VERSION: '2.1',
  get lang() { return I18N.lang; },   // langue de l'interface (slider FR | EN)
  files: [],               // File[] déposés
  tri: null,               // classement des fichiers par le moteur
  model: null,             // modèle d'environnement
  view: 'accueil',
  engineReady: false,
  explorerOk: true,

  statusMsg: null,         // () => [texte, genre] : réécrit à chaque changement de langue
  entries: null,           // () => lignes de la liste des fichiers

  init() {
    I18N.bindSwitch();
    I18N.onChange(() => this.relabel());
    document.getElementById('d-langue').value = I18N.lang;
    this.bindTabs();
    this.bindFiles();
    this.loadSpecs();
    Engine.onProgress(step => this.status(step));
    Engine.boot(this.VERSION).then(version => {
      this.engineReady = true;
      document.getElementById('version-label').textContent = '#Dièse · v' + version;
      this.status(() => this.files.length ? L('Analyse…', 'Analysing…')
        : L('Prêt — déposez les exports du client.', 'Ready — drop the client\'s exports.'), 'ok');
      if (this.files.length) this.refresh();
    }).catch(err => {
      this.status(() => L("Le moteur n'a pas démarré : ", 'The engine did not start: ') + err.message +
        L('. Rechargez la page ; le démarrage dépend du CDN jsDelivr.',
          '. Reload the page; start-up depends on the jsDelivr CDN.'), 'err');
    });
  },

  async loadSpecs() {
    try {
      const res = await fetch('data/rule_specs.json');
      if (res.ok) Object.assign(RULE_SPECS, await res.json());
    } catch (_) { /* détail enrichi seulement : jamais bloquant */ }
  },

  // ---- navigation --------------------------------------------------------
  bindTabs() {
    document.querySelectorAll('nav.tabs [role=tab]').forEach(btn =>
      btn.addEventListener('click', () => this.setView(btn.dataset.view)));
    window.addEventListener('hashchange', () => this.fromHash());
  },

  fromHash() {
    const v = location.hash.replace('#', '');
    if (v && v !== this.view) this.setView(v, false);
  },

  setView(view, pushHash = true) {
    const tab = document.querySelector(`nav.tabs [data-view="${view}"]`);
    if (!tab || tab.disabled) view = 'accueil';
    this.view = view;
    document.getElementById('app').dataset.view = view;
    document.querySelectorAll('nav.tabs [role=tab]').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.view === view)));
    document.querySelectorAll('#views .view').forEach(s => { s.hidden = s.dataset.view !== view; });
    document.getElementById('views').hidden = view === 'explorer';
    if (view === 'explorer' && this.explorerOk) Explorer.shown();
    if (pushHash && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  },

  enableTabs(on) {
    document.querySelectorAll('nav.tabs [role=tab]').forEach(b => {
      if (b.dataset.view !== 'accueil') b.disabled = !on;
    });
    const ex = document.querySelector('nav.tabs [data-view="explorer"]');
    if (!this.explorerOk) {
      ex.disabled = true;
      ex.title = L('Graphe indisponible : vis-network n\'a pas pu être chargé',
                   'Graph unavailable: vis-network could not be loaded');
    }
  },

  openRule(id) {
    if (!this.explorerOk) return;
    this.setView('explorer');
    setTimeout(() => UI.jumpTo(id), 30);
  },

  // ---- fichiers ------------------------------------------------------------
  bindFiles() {
    const input = document.getElementById('files-input');
    document.getElementById('btn-add-files').addEventListener('click', () => this.pickFiles());
    input.addEventListener('change', () => { this.addFiles(input.files); input.value = ''; });
    const zone = document.getElementById('dropzone');
    zone.addEventListener('click', () => this.pickFiles());
    zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pickFiles(); }
    });
    // dépôt n'importe où dans la fenêtre
    const veil = document.getElementById('global-drop');
    let hide = null;
    const show = e => {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault(); clearTimeout(hide); veil.classList.add('show');
    };
    window.addEventListener('dragenter', show);
    window.addEventListener('dragover', show);
    window.addEventListener('dragleave', () => { clearTimeout(hide); hide = setTimeout(() => veil.classList.remove('show'), 100); });
    window.addEventListener('drop', e => {
      e.preventDefault(); clearTimeout(hide); veil.classList.remove('show');
      if (e.dataTransfer.files && e.dataTransfer.files.length) this.addFiles(e.dataTransfer.files);
    });
  },

  pickFiles() { document.getElementById('files-input').click(); },

  addFiles(list) {
    let added = 0;
    for (const f of list) {
      if (!this.files.some(g => g.name === f.name && g.size === f.size && g.lastModified === f.lastModified)) {
        // un fichier du même nom remplace l'ancien (export ré-extrait)
        this.files = this.files.filter(g => g.name !== f.name);
        this.files.push(f); added++;
      }
    }
    if (!added) return;
    this.paintFiles(() => this.files.map(f => ({ name: f.name, role: L('en attente', 'waiting'), cls: '' })));
    if (this.engineReady) this.refresh();
    else this.status(() => L('Les fichiers seront analysés dès que le moteur sera prêt…',
                             'The files will be analysed as soon as the engine is ready…'));
  },

  paintFiles(entries) {
    if (entries) this.entries = entries;
    if (!this.entries) return;
    const ul = document.getElementById('file-list');
    ul.innerHTML = '';
    for (const e of this.entries()) {
      const li = document.createElement('li');
      if (e.cls) li.className = e.cls;
      const a = document.createElement('span'); a.className = 'fname'; a.textContent = e.name;
      const b = document.createElement('span'); b.className = 'frole'; b.textContent = e.role;
      li.append(a, b); ul.appendChild(li);
    }
  },

  async refresh() {
    try {
      this.status(() => L('Identification des fichiers…', 'Identifying the files…'));
      const tri = await Engine.load(this.files);
      this.paintFiles(() => Shell.fileEntries(tri));
      this.tri = tri;
      if (!tri.regles) {
        this.status(() => L("Il manque l'export des règles GTA : rien ne peut être analysé sans lui.",
                            'The GTA rules export is missing: nothing can be analysed without it.'), 'warn');
        return;
      }
      this.status(() => L('Analyse du paramétrage…', 'Analysing the configuration…'));
      const t0 = performance.now();
      const model = await Engine.analyse(tri);
      this.setModel(model);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      this.status(() => L(`Environnement analysé en ${secs.replace('.', ',')} s.`,
                          `Environment analysed in ${secs} s.`), 'ok');
    } catch (err) {
      this.status(() => L('Analyse impossible : ', 'Analysis failed: ') + err.message, 'err');
    }
  },

  setModel(model) {
    this.model = model;
    try {
      if (typeof vis === 'undefined' || !vis.Network) throw new Error('vis-network absent');
      Explorer.load(model);
      this.explorerOk = true;
    } catch (err) {
      console.error(err);
      this.explorerOk = false;
    }
    Views.render(model);
    this.enableTabs(true);
  },

  // Rôle de chaque fichier déposé, tel que le moteur l'a reconnu.
  fileEntries(tri) {
    const kinds = {
      'regles': L('export des règles GTA', 'GTA rules export'),
      'types de jour': L('export des types de jour', 'day types export'),
    };
    const out = (tri.fichiers || []).map(f => {
      let role;
      if (f.type === 'referentiel') {
        role = f.famille ? L(`référentiel « ${f.famille} »`, `reference data “${f.famille}”`)
          : L('référentiel de famille inconnue : renommer le fichier (taux, fonctions, activites…)',
              'reference data of unknown family: rename the file (rates, jobs, activities…)');
      } else if (f.type && f.ignore) {
        role = L('second export du même type, ignoré', 'second export of the same kind, ignored');
      } else {
        role = kinds[f.type] || L('non reconnu, ignoré', 'not recognised, ignored');
      }
      return { name: f.nom, role, cls: f.ignore || !f.type ? 'ignored' : 'ok' };
    });
    for (const code of tri.manque_codes || []) {
      out.push({ name: L('Manquant', 'Missing'), cls: 'missing', role: code === 'regles'
        ? L("l'export des règles GTA, sans lequel rien ne peut être produit",
            'the GTA rules export, without which nothing can be produced')
        : L("l'export des types de jour : sans lui les journées apparaîtront sous forme d'identifiants",
            'the day types export: without it, days will appear as numbers') });
    }
    return out;
  },

  // text : une chaîne, ou une fonction qui la produit dans la langue courante.
  status(text, kind) {
    this.statusMsg = [typeof text === 'function' ? text : () => text, kind || ''];
    this.paintStatus();
  },

  paintStatus() {
    if (!this.statusMsg) return;
    const el = document.getElementById('engine-status');
    el.textContent = this.statusMsg[0]();
    el.dataset.kind = this.statusMsg[1];
  },

  // Changement de langue : tout ce qui a été produit par du code est refait.
  relabel() {
    document.getElementById('d-langue').value = I18N.lang;   // le dossier suit l'interface
    this.paintStatus();
    this.paintFiles();
    this.enableTabs(!!this.model);
    if (this.model) {
      Views.render(this.model);
      if (this.explorerOk) Explorer.relabel(this.model);
    } else if (typeof Explorer !== 'undefined' && Explorer.relabelEmpty) {
      Explorer.relabelEmpty();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => { Shell.init(); Shell.fromHash(); });
