/* Coquille de l'Atelier GTA : dépôt des fichiers, état partagé, navigation.
 *
 * Un seul modèle d'environnement (produit par engine/model.py) alimente tous
 * les onglets. Les fichiers déposés s'accumulent : ajouter un référentiel
 * après coup relance simplement l'analyse sur l'ensemble.
 */
"use strict";

const Shell = {
  VERSION: '2.0',
  lang: 'fr',              // langue des descriptions affichées (catalogue, détail)
  files: [],               // File[] déposés
  tri: null,               // classement des fichiers par le moteur
  model: null,             // modèle d'environnement
  view: 'accueil',
  engineReady: false,
  explorerOk: true,

  init() {
    this.bindTabs();
    this.bindFiles();
    this.loadSpecs();
    Engine.onProgress(step => this.status(step));
    Engine.boot(this.VERSION).then(version => {
      this.engineReady = true;
      document.getElementById('version-label').textContent = '#Dièse · v' + version;
      this.status(this.files.length ? 'Analyse…' : 'Prêt — déposez les exports du client.', 'ok');
      if (this.files.length) this.refresh();
    }).catch(err => {
      this.status("Le moteur n'a pas démarré : " + err.message +
        ". Rechargez la page ; le démarrage dépend du CDN jsDelivr.", 'err');
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
    if (!this.explorerOk) { ex.disabled = true; ex.title = 'Graphe indisponible : vis-network n\'a pas pu être chargé'; }
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
    this.paintFiles(this.files.map(f => ({ name: f.name, role: 'en attente', cls: '' })));
    if (this.engineReady) this.refresh();
    else this.status('Les fichiers seront analysés dès que le moteur sera prêt…');
  },

  paintFiles(entries) {
    const ul = document.getElementById('file-list');
    ul.innerHTML = '';
    for (const e of entries) {
      const li = document.createElement('li');
      if (e.cls) li.className = e.cls;
      const a = document.createElement('span'); a.className = 'fname'; a.textContent = e.name;
      const b = document.createElement('span'); b.className = 'frole'; b.textContent = e.role;
      li.append(a, b); ul.appendChild(li);
    }
  },

  async refresh() {
    try {
      this.status('Identification des fichiers…');
      const tri = await Engine.load(this.files);
      const entries = tri.rapport.map(line => {
        const [name, role] = line.split(' → ');
        return { name: name.replace(/^\/entrees\//, ''), role: role || '',
                 cls: /ignoré|non reconnu|inconnue/.test(role || '') ? 'ignored' : 'ok' };
      });
      for (const m of tri.manque) entries.push({ name: 'Manquant', role: m, cls: 'missing' });
      this.paintFiles(entries);
      this.tri = tri;
      if (!tri.regles) {
        this.status("Il manque l'export des règles GTA : rien ne peut être analysé sans lui.", 'warn');
        return;
      }
      this.status('Analyse du paramétrage…');
      const t0 = performance.now();
      const model = await Engine.analyse(tri);
      this.setModel(model);
      this.status(`Environnement analysé en ${((performance.now() - t0) / 1000).toFixed(1)} s.`, 'ok');
    } catch (err) {
      this.status('Analyse impossible : ' + err.message, 'err');
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

  status(text, kind) {
    const el = document.getElementById('engine-status');
    el.textContent = text;
    el.dataset.kind = kind || '';
  },
};

document.addEventListener('DOMContentLoaded', () => { Shell.init(); Shell.fromHash(); });
