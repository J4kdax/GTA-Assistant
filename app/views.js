/* Onglets Accueil (synthèse), Catalogue, Audit et Dossier client.
 * Tous lisent le modèle d'environnement ; aucun ne relit les fichiers. */
"use strict";

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const Views = {
  render(model) {
    Summary.render(model);
    Catalogue.render(model);
    Audit.render(model);
    Dossier.render(model);
  },
};

/* ---- Accueil : synthèse de l'environnement ---------------------------------- */
const Summary = {
  render(m) {
    const d = m.diagnostic;
    const findings = m.audit.a_corriger.length;
    const el = document.getElementById('env-summary');
    const tiles = [
      [m.regles.length, 'règles'],
      [d.types, 'types de règle'],
      [m.contrats.length, 'types de contrat'],
      [d.compteurs, 'compteurs'],
      [m.types_jour.length || '—', 'types de jour'],
    ];
    el.innerHTML = `
      <div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <p class="muted">Export au format « ${esc(m.format)} » · moteur v${esc(m.moteur)}${
        findings ? ` · <a href="#audit" class="warn-link">${findings} point(s) à corriger</a>` : ''}</p>
      <div class="btn-row">
        <button data-go="explorer">Explorer le graphe</button>
        <button data-go="catalogue">Lire le catalogue</button>
        <button data-go="audit">Voir l'audit</button>
        <button data-go="dossier" class="primary">Produire le dossier client</button>
      </div>`;
    el.hidden = false;
    el.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => Shell.setView(b.dataset.go)));
    const badge = document.getElementById('audit-badge');
    badge.hidden = !findings; badge.textContent = findings;
  },
};

/* ---- Catalogue : le dossier client, à l'écran ------------------------------- */
const Catalogue = {
  bound: false,

  render(m) {
    this.model = m;
    const sel = document.getElementById('cat-contract');
    sel.innerHTML = '<option value="">Tous les types de contrat</option>' +
      m.contrats.map(c => `<option value="${esc(c.cle)}">${esc(c.libelle || c.titre)}</option>`).join('');
    this.titles = new Map(m.contrats.map(c => [c.cle, c.libelle || c.titre]));
    if (!this.bound) this.bind();
    this.paint();
  },

  bind() {
    this.bound = true;
    ['cat-search', 'cat-contract', 'cat-counters'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => this.paint()));
    document.querySelectorAll('#view-catalogue .seg button').forEach(b => b.addEventListener('click', () => {
      Shell.lang = b.dataset.lang;
      document.querySelectorAll('#view-catalogue .seg button').forEach(x =>
        x.setAttribute('aria-pressed', String(x === b)));
      this.paint();
    }));
    document.querySelector('#cat-table tbody').addEventListener('click', e => {
      const a = e.target.closest('[data-rule]');
      if (a) { e.preventDefault(); Shell.openRule(Number(a.dataset.rule)); }
    });
  },

  paint() {
    const m = this.model;
    const q = document.getElementById('cat-search').value.trim().toLowerCase();
    const contract = document.getElementById('cat-contract').value;
    const counters = document.getElementById('cat-counters').checked;
    const lang = Shell.lang;
    const rows = m.regles.filter(r => {
      if (contract && !r.contrats.includes(contract)) return false;
      if (counters && r.compteur !== 1) return false;
      if (!q) return true;
      const hay = [r.id, r.libelle, r.libelle_court, r.code, r.description[lang]].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const tb = document.querySelector('#cat-table tbody');
    tb.innerHTML = rows.map(r => {
      const contracts = r.contrats.map(k => this.titles.get(k) || k);
      return `<tr class="${r.repli ? 'repli' : ''}">
        <td class="c">${r.ordre == null ? '' : esc(r.ordre)}</td>
        <td class="c"><a href="#explorer" data-rule="${r.id}" title="Ouvrir dans l'Explorer">${r.id}</a></td>
        <td class="lib">${esc(r.libelle)}</td>
        <td class="short">${esc(r.libelle_court_lignes).replace(/\n/g, '<br>')}</td>
        <td>${esc(r.code || '')}</td>
        <td class="desc">${esc(r.description[lang])}</td>
        <td class="c">${r.compteur === 1 ? (lang === 'fr' ? 'Oui' : 'Yes') : ''}</td>
        <td>${r.compteur === 1 ? esc(r.periode || '') : '—'}</td>
        <td class="c" title="${esc(contracts.join('\n'))}">${contracts.length || '<span class="muted">aucun</span>'}</td>
      </tr>`;
    }).join('');
    document.getElementById('cat-count').textContent = `${rows.length} / ${m.regles.length} règles`;
  },
};

/* ---- Audit : constats du moteur + analyses du graphe ------------------------ */
const Audit = {
  bound: false,

  render(m) {
    const byId = new Map(m.regles.map(r => [r.id, r]));
    const days = new Map(m.types_jour.map(d => [d.id, d]));
    const chip = (f, id) => {
      if (f.objet === 'type_jour') {
        const d = days.get(id);
        return `<span class="chip">#${id} ${esc(d ? d.libelle || d.libelle_court : '')}</span>`;
      }
      const r = byId.get(id);
      return `<a class="chip" href="#explorer" data-rule="${id}">#${id} ${esc(r ? r.libelle_court || r.libelle : '')}</a>`;
    };
    const block = (title, cls, list) => list.length ? `
      <h3 class="subhead ${cls}">${title}</h3>
      ${list.map(f => `<div class="finding ${cls}">
          <div class="f-head"><b>${esc(f.titre)}</b><span class="count">${f.nombre}</span></div>
          ${f.note ? `<p class="muted">${esc(f.note)}</p>` : ''}
          ${f.ids.length ? `<div class="chips">${f.ids.map(id => chip(f, id)).join('')}</div>` : ''}
        </div>`).join('')}` : '';
    const refs = m.diagnostic.referentiels || [];
    document.getElementById('audit-body').innerHTML = `
      <h2>Audit du paramétrage</h2>
      <p class="muted">Ce qui est à corriger dans le paramétrage, puis ce qui est à savoir avant de livrer le dossier au client.</p>
      ${block('À corriger', 'err', m.audit.a_corriger) ||
        '<div class="finding ok"><b>Aucun point bloquant</b><p class="muted">Pas de renvoi cassé ni de référence incomplète.</p></div>'}
      ${block('À savoir', 'warn', m.audit.a_savoir)}
      ${refs.length ? `<h3 class="subhead">Référentiels à réclamer au client</h3>
        <table class="grid small"><thead><tr><th>Référentiel</th><th class="c">Occurrences</th><th class="c">Règles</th><th>Export à demander</th></tr></thead>
        <tbody>${refs.map(([f, occ, n, ask]) => `<tr><td>${esc(f)}</td><td class="c">${occ}</td><td class="c">${n}</td><td>${esc(ask)}</td></tr>`).join('')}</tbody></table>
        <p class="muted">Sans eux, les éléments concernés restent notés ‹ entre chevrons › : le dossier reste exploitable.</p>` : ''}
      <details class="fold-plain"><summary>Relevé complet du diagnostic</summary><pre>${esc(m.diagnostic_texte)}</pre></details>`;
    if (!this.bound) this.bind();
  },

  bind() {
    this.bound = true;
    document.getElementById('audit-body').addEventListener('click', e => {
      const a = e.target.closest('[data-rule]');
      if (a) { e.preventDefault(); Shell.openRule(Number(a.dataset.rule)); }
    });
    document.querySelectorAll('#view-audit [data-analyse]').forEach(b => b.addEventListener('click', () => {
      if (!Shell.explorerOk) return;
      const fn = b.dataset.analyse;
      if (fn === 'contracts') Analyse.contracts(null); else Analyse[fn]();
    }));
  },
};

/* ---- Dossier client : le classeur Excel ----------------------------------- */
const Dossier = {
  bound: false,

  render(m) {
    const refs = m.diagnostic.referentiels || [];
    const given = m.referentiels || [];
    document.getElementById('dossier-refs').innerHTML = `
      ${given.length ? `<h3 class="subhead">Référentiels fournis</h3><ul class="plain">${given.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${refs.length ? `<h3 class="subhead">Référentiels encore manquants</h3>
        <p class="muted">Ils améliorent la lisibilité mais ne bloquent jamais la génération. Déposez-les dans l'Atelier s'ils sont disponibles : l'analyse est relancée automatiquement.</p>
        <ul class="plain">${refs.map(([f, occ, n, ask]) => `<li><b>${esc(f)}</b> — ${occ} occurrences dans ${n} règles → ${esc(ask)}</li>`).join('')}</ul>` : ''}
      ${m.types_jour.length ? '' : '<p class="warn-text">Export des types de jour non fourni : les journées apparaîtront sous forme de numéros et le lexique sera absent.</p>'}`;
    if (!this.bound) this.bind();
  },

  bind() {
    this.bound = true;
    document.getElementById('dossier-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('d-generate');
      const st = document.getElementById('dossier-status');
      const opts = {
        client: document.getElementById('d-client').value.trim(),
        langue: document.getElementById('d-langue').value,
        contrats: document.getElementById('d-contrats').checked,
      };
      btn.disabled = true; st.textContent = 'Génération du classeur…'; st.dataset.kind = '';
      try {
        const bytes = await Engine.dossier(Shell.tri, opts);
        const slug = (opts.client || 'environnement').normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'environnement';
        const stem = opts.langue === 'en' ? 'GTA-configuration-dossier' : 'Dossier-parametrage-GTA';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        a.download = `${stem}_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        st.textContent = `Dossier téléchargé (${a.download}). Relisez l'audit avant de le transmettre.`;
        st.dataset.kind = 'ok';
      } catch (err) {
        st.textContent = 'Génération impossible : ' + err.message; st.dataset.kind = 'err';
      } finally { btn.disabled = false; }
    });
  },
};
