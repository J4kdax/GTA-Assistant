/* Coquille de l'Atelier GTA : dépôt des fichiers, état partagé, navigation.
 *
 * Un seul modèle d'environnement (produit par engine/model.py) alimente tous
 * les onglets. Les fichiers déposés s'accumulent : ajouter un référentiel
 * après coup relance simplement l'analyse sur l'ensemble.
 */
"use strict";

const Shell = {
  VERSION: '2.3',
  get lang() { return I18N.lang; },   // langue de l'interface (slider FR | EN)
  files: [],               // File[] déposés
  tri: null,               // classement des fichiers par le moteur
  model: null,             // modèle d'environnement
  view: 'accueil',
  engineReady: false,
  explorerOk: true,

  statusMsg: null,         // () => [texte, genre] : réécrit à chaque changement de langue
  entries: null,           // () => lignes de la liste des fichiers
  busyPhase: null,         // étape de l'analyse affichée dans la zone de dépôt (v2.3)
  lastSecs: null,          // durée de la dernière analyse, affichée dans la carte « prêt »
  toastMsg: null,          // () => texte du message de confirmation, tant qu'il est affiché

  init() {
    I18N.bindSwitch();
    I18N.onChange(() => this.relabel());
    document.getElementById('d-langue').value = I18N.lang;
    Summary.idle();
    this.setHome('idle');
    this.bindClear();
    this.bindTabs();
    this.bindFiles();
    this.loadSpecs();
    Engine.onProgress(step => this.status(step));
    Engine.boot(this.VERSION).then(version => {
      this.engineReady = true;
      document.getElementById('version-label').textContent = '#Dièse · v' + version;
      this.status(() => this.files.length ? L('Analyse…', 'Analysing…')
        : L('Prêt — déposez les exports du client.', 'Ready — drop the client\'s exports.'), 'ok');
      if (this.busyPhase === 1) this.setBusy(2);
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
    document.querySelectorAll('.tool-card[data-go]').forEach(c => {
      c.disabled = !on || (c.dataset.go === 'explorer' && !this.explorerOk);
    });
    document.getElementById('app').classList.toggle('loaded', !!on);
    document.getElementById('btn-clear-env').disabled = !on && !this.files.length;
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

  // ---- état de l'accueil (v2.3) --------------------------------------------
  // idle : zone de dépôt ; busy : progression dans la zone ; ready : carte « prêt ».
  setHome(state) {
    const app = document.getElementById('app');
    app.dataset.home = state;
    if (state !== 'busy') this.busyPhase = null;
    // la liste des fichiers se replie quand tout est prêt : la carte résume l'essentiel
    document.getElementById('files-fold').open = state !== 'ready';
  },

  BUSY_STEPS: [
    n => Ln(n, 'fichier reçu', 'fichiers reçus', 'file received', 'files received'),
    () => L('Démarrage du moteur', 'Starting the engine'),
    () => L('Identification des fichiers', 'Identifying the files'),
    () => L('Lecture des règles et de leurs dépendances', 'Reading the rules and their dependencies'),
    () => L('Préparation de l\'Explorer, du catalogue et de l\'audit', 'Preparing the Explorer, catalogue and audit'),
  ],

  setBusy(phase) {
    this.setHome('busy');
    this.busyPhase = phase;
    this.paintBusy();
  },

  paintBusy() {
    if (this.busyPhase == null) return;
    const phase = this.busyPhase;
    document.getElementById('busy-title').textContent = phase <= 1
      ? L('Démarrage du moteur…', 'Starting the engine…')
      : L('Analyse de l\'environnement…', 'Analysing the environment…');
    const ul = document.getElementById('busy-steps');
    ul.innerHTML = '';
    this.BUSY_STEPS.forEach((label, i) => {
      const li = document.createElement('li');
      const done = i < phase, now = i === phase;
      li.className = done ? 'done' : now ? 'now' : '';
      const dot = document.createElement('i');
      dot.textContent = done ? '✓' : now ? '•' : '';
      const tx = document.createElement('span');
      tx.textContent = label(this.files.length) + (now ? '…' : '');
      li.append(dot, tx); ul.appendChild(li);
    });
    document.getElementById('busy-bar').style.width =
      Math.round(100 * (phase + 0.5) / this.BUSY_STEPS.length) + '%';
  },

  // Message bref sous l'en-tête, une fois l'analyse terminée.
  toast(text) {
    const el = document.getElementById('home-toast');
    clearTimeout(this.toastTimer);
    this.toastMsg = text;
    if (!text) { el.classList.remove('show'); el.hidden = true; return; }
    this.paintToast();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    this.toastTimer = setTimeout(() => {
      el.classList.remove('show');
      this.toastTimer = setTimeout(() => { el.hidden = true; this.toastMsg = null; }, 400);
    }, 3800);
  },

  paintToast() {
    if (!this.toastMsg) return;
    const el = document.getElementById('home-toast');
    el.innerHTML = '<span class="ok" aria-hidden="true">✓</span>';
    el.appendChild(document.createTextNode(this.toastMsg()));
  },

  // Allumage en cascade des cartes et des onglets, juste après une analyse.
  flash() {
    const app = document.getElementById('app');
    app.classList.remove('fresh'); void app.offsetWidth;
    app.classList.add('fresh');
    clearTimeout(this.freshTimer);
    this.freshTimer = setTimeout(() => app.classList.remove('fresh'), 2600);
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

  // ---- remise à zéro : vider l'environnement pour en charger un autre ---------
  bindClear() {
    const modal = document.getElementById('confirm-clear');
    const ok = document.getElementById('confirm-ok');
    const close = () => { modal.hidden = true; document.getElementById('btn-clear-env').focus(); };
    document.getElementById('btn-clear-env').addEventListener('click', () => {
      modal.hidden = false;
      document.getElementById('confirm-cancel').focus();
    });
    document.getElementById('confirm-cancel').addEventListener('click', close);
    ok.addEventListener('click', () => { modal.hidden = true; this.clear(); });
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {                      // le focus reste dans la fenêtre
        const f = [document.getElementById('confirm-cancel'), ok];
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    });
  },

  clear() {
    this.gen = (this.gen || 0) + 1;              // une analyse en cours sera ignorée
    this.files = []; this.tri = null; this.model = null; this.entries = null;
    document.getElementById('file-list').innerHTML = '';
    ['cat-search', 'd-client'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cat-counters').checked = false;
    Dossier.msg = null;
    const st = document.getElementById('dossier-status'); st.textContent = ''; st.dataset.kind = '';
    document.getElementById('d-langue').value = I18N.lang;
    if (typeof Explorer !== 'undefined') Explorer.clear();
    this.lastSecs = null;
    this.toast(null);
    Summary.idle();
    this.setHome('idle');
    this.enableTabs(false);
    this.setView('accueil');
    this.status(() => L('Environnement vidé — déposez les exports d\'un autre client.',
                        'Environment cleared — drop another client\'s exports.'), 'ok');
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
    document.getElementById('btn-clear-env').disabled = false;
    this.paintFiles(() => this.files.map(f => ({ name: f.name, role: L('en attente', 'waiting'), cls: '' })));
    if (this.engineReady) this.refresh();
    else {
      this.setBusy(1);
      this.status(() => L('Les fichiers seront analysés dès que le moteur sera prêt…',
                          'The files will be analysed as soon as the engine is ready…'));
    }
  },

  paintFiles(entries) {
    if (entries) this.entries = entries;
    if (!this.entries) return;
    const ul = document.getElementById('file-list');
    ul.innerHTML = '';
    const list = this.entries();
    const found = list.filter(e => e.cls === 'ok').length;
    const missing = list.filter(e => e.cls === 'missing').length;
    const waiting = list.every(e => !e.cls);
    document.getElementById('files-sum').textContent = waiting
      ? Ln(list.length, 'fichier déposé', 'fichiers déposés', 'file dropped', 'files dropped')
      : Ln(found, 'fichier reconnu', 'fichiers reconnus', 'file recognised', 'files recognised') +
        (missing ? ' · ' + Ln(missing, 'manquant', 'manquants', 'missing', 'missing') : '');
    for (const e of list) {
      const li = document.createElement('li');
      if (e.cls) li.className = e.cls;
      const a = document.createElement('span'); a.className = 'fname'; a.textContent = e.name;
      const b = document.createElement('span'); b.className = 'frole'; b.textContent = e.role;
      li.append(a, b); ul.appendChild(li);
    }
  },

  async refresh() {
    const gen = this.gen = (this.gen || 0) + 1;
    const stale = () => gen !== this.gen;
    try {
      this.setBusy(2);
      this.status(() => L('Identification des fichiers…', 'Identifying the files…'));
      const tri = await Engine.load(this.files);
      if (stale()) return;
      this.paintFiles(() => Shell.fileEntries(tri));
      this.tri = tri;
      if (!tri.regles) {
        this.setHome('idle');
        this.status(() => L("Il manque l'export des règles GTA : rien ne peut être analysé sans lui.",
                            'The GTA rules export is missing: nothing can be analysed without it.'), 'warn');
        return;
      }
      this.setBusy(3);
      this.status(() => L('Analyse du paramétrage…', 'Analysing the configuration…'));
      const t0 = performance.now();
      const model = await Engine.analyse(tri);
      if (stale()) return;
      this.setBusy(4);
      await new Promise(r => setTimeout(r, 30));   // laisse la dernière étape s'afficher
      if (stale()) return;
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      this.lastSecs = secs;
      this.status(() => L(`Environnement analysé en ${secs.replace('.', ',')} s.`,
                          `Environment analysed in ${secs} s.`), 'ok');
      this.setModel(model);
      const n = model.regles.length;
      this.toast(() => L(`Environnement prêt — ${Ln(n, 'règle analysée', 'règles analysées', 'rule analysed', 'rules analysed')}. Vous pouvez commencer.`,
                         `Environment ready — ${Ln(n, 'règle analysée', 'règles analysées', 'rule analysed', 'rules analysed')}. You can start.`));
      this.flash();
    } catch (err) {
      if (stale()) return;
      this.setHome('idle');
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
    this.setHome('ready');
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
    this.paintBusy();
    this.paintToast();
    this.enableTabs(!!this.model);
    if (this.model) {
      Views.render(this.model);
      if (this.explorerOk) Explorer.relabel(this.model);
    } else {
      Summary.idle();
      if (typeof Explorer !== 'undefined' && Explorer.relabelEmpty) Explorer.relabelEmpty();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => { Shell.init(); Shell.fromHash(); });
