/* Onglets Accueil (synthèse), Catalogue, Audit et Dossier client.
 * Tous lisent le modèle d'environnement ; aucun ne relit les fichiers.
 * Les textes passent par L('français', 'English') : Views.render() est rappelé
 * à chaque changement de langue. */
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

const en = () => I18N.lang === 'en';

/* ---- Accueil : synthèse de l'environnement ---------------------------------- */
const Summary = {
  render(m) {
    const d = m.diagnostic;
    const findings = m.audit.a_corriger.length;
    const el = document.getElementById('env-summary');
    const tiles = [
      [m.regles.length, L('règles', 'rules')],
      [d.types, L('types de règle', 'rule types')],
      [m.contrats.length, L('types de contrat', 'contract types')],
      [d.compteurs, L('compteurs', 'counters')],
      [m.types_jour.length || '—', L('types de jour', 'day types')],
    ];
    const fmt = en() ? m.format_en : m.format;
    el.innerHTML = `
      <div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
      <p class="muted">${L(`Export au format « ${esc(fmt)} »`, `Export in “${esc(fmt)}” format`)} · ${L('moteur', 'engine')} v${esc(m.moteur)}${
        findings ? ` · <a href="#audit" class="warn-link">${esc(Ln(findings, 'point à corriger', 'points à corriger', 'item to fix', 'items to fix'))}</a>` : ''}</p>
      <div class="btn-row">
        <button data-go="explorer">${L('Explorer le graphe', 'Explore the graph')}</button>
        <button data-go="catalogue">${L('Lire le catalogue', 'Read the catalogue')}</button>
        <button data-go="audit">${L("Voir l'audit", 'See the audit')}</button>
        <button data-go="dossier" class="primary">${L('Produire le dossier client', 'Produce the client dossier')}</button>
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
    const current = sel.value;
    sel.innerHTML = `<option value="">${L('Tous les types de contrat', 'All contract types')}</option>` +
      m.contrats.map(c => `<option value="${esc(c.cle)}">${esc(c.libelle || c.titre)}</option>`).join('');
    sel.value = m.contrats.some(c => c.cle === current) ? current : '';
    this.titles = new Map(m.contrats.map(c => [c.cle, c.libelle || c.titre]));
    if (!this.bound) this.bind();
    this.paint();
  },

  bind() {
    this.bound = true;
    ['cat-search', 'cat-contract', 'cat-counters'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => this.paint()));
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
    const lang = I18N.lang;
    const rows = m.regles.filter(r => {
      if (contract && !r.contrats.includes(contract)) return false;
      if (counters && r.compteur !== 1) return false;
      if (!q) return true;
      const hay = [r.id, r.libelle, r.libelle_court, r.code, r.description[lang]].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const open = L("Ouvrir dans l'Explorer", 'Open in the Explorer');
    const tb = document.querySelector('#cat-table tbody');
    tb.innerHTML = rows.map(r => {
      const contracts = r.contrats.map(k => this.titles.get(k) || k);
      return `<tr class="${r.repli ? 'repli' : ''}">
        <td class="c">${r.ordre == null ? '' : esc(r.ordre)}</td>
        <td class="c"><a href="#explorer" data-rule="${r.id}" title="${esc(open)}">${r.id}</a></td>
        <td class="lib">${esc(r.libelle)}</td>
        <td class="short">${esc(r.libelle_court_lignes).replace(/\n/g, '<br>')}</td>
        <td>${esc(r.code || '')}</td>
        <td class="desc">${esc(r.description[lang])}</td>
        <td class="c">${r.compteur === 1 ? L('Oui', 'Yes') : ''}</td>
        <td>${r.compteur === 1 ? esc(r.periode || '') : '—'}</td>
        <td class="c" title="${esc(contracts.join('\n'))}">${contracts.length || `<span class="muted">${L('aucun', 'none')}</span>`}</td>
      </tr>`;
    }).join('');
    document.getElementById('cat-count').textContent =
      `${rows.length} / ${m.regles.length} ${L('règles', 'rules')}`;
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
    const title = f => en() ? f.titre_en : f.titre;
    const note = f => en() ? f.note_en : f.note;
    const block = (heading, cls, list) => list.length ? `
      <h3 class="subhead ${cls}">${heading}</h3>
      ${list.map(f => `<div class="finding ${cls}">
          <div class="f-head"><b>${esc(title(f))}</b><span class="count">${f.nombre}</span></div>
          ${note(f) ? `<p class="muted">${esc(note(f))}</p>` : ''}
          ${f.ids.length ? `<div class="chips">${f.ids.map(id => chip(f, id)).join('')}</div>` : ''}
        </div>`).join('')}` : '';
    const refs = m.referentiels_manquants || [];
    const lang = I18N.lang;
    document.getElementById('audit-body').innerHTML = `
      <h2>${L('Audit du paramétrage', 'Configuration audit')}</h2>
      <p class="muted">${L('Ce qui est à corriger dans le paramétrage, puis ce qui est à savoir avant de livrer le dossier au client.',
                           'What needs fixing in the configuration, then what to know before handing the dossier over to the client.')}</p>
      ${block(L('À corriger', 'To fix'), 'err', m.audit.a_corriger) ||
        `<div class="finding ok"><b>${L('Aucun point bloquant', 'Nothing blocking')}</b><p class="muted">${
          L('Pas de renvoi cassé ni de référence incomplète.', 'No broken or incomplete rule reference.')}</p></div>`}
      ${block(L('À savoir', 'Good to know'), 'warn', m.audit.a_savoir)}
      ${refs.length ? `<h3 class="subhead">${L('Référentiels à réclamer au client', 'Reference data to request from the client')}</h3>
        <table class="grid small"><thead><tr><th>${L('Référentiel', 'Reference data')}</th><th class="c">${L('Occurrences', 'Occurrences')}</th><th class="c">${L('Règles', 'Rules')}</th><th>${L('Export à demander', 'Export to request')}</th></tr></thead>
        <tbody>${refs.map(r => `<tr><td>${esc(r.libelle[lang])}</td><td class="c">${r.occurrences}</td><td class="c">${r.regles}</td><td>${esc(r.demande[lang])}</td></tr>`).join('')}</tbody></table>
        <p class="muted">${L('Sans eux, les éléments concernés restent notés ‹ entre chevrons › : le dossier reste exploitable.',
                             'Without them, the items concerned stay ‹ in angle brackets ›: the dossier remains usable.')}</p>` : ''}
      <details class="fold-plain"><summary>${L('Relevé complet du diagnostic', 'Full diagnostic report')}</summary><pre>${
        esc(en() ? m.diagnostic_texte_en : m.diagnostic_texte)}</pre></details>`;
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
    const lang = I18N.lang;
    const refs = m.referentiels_manquants || [];
    const given = (en() ? m.referentiels_en : m.referentiels) || [];
    document.getElementById('dossier-refs').innerHTML = `
      ${given.length ? `<h3 class="subhead">${L('Référentiels fournis', 'Reference data supplied')}</h3><ul class="plain">${given.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${refs.length ? `<h3 class="subhead">${L('Référentiels encore manquants', 'Reference data still missing')}</h3>
        <p class="muted">${L("Ils améliorent la lisibilité mais ne bloquent jamais la génération. Déposez-les dans l'Atelier s'ils sont disponibles : l'analyse est relancée automatiquement.",
                             'They improve readability but never block generation. Drop them into the Atelier if you have them: the analysis runs again automatically.')}</p>
        <ul class="plain">${refs.map(r => `<li><b>${esc(r.libelle[lang])}</b> — ${
          L(`${r.occurrences} occurrences dans ${r.regles} règles`, `${r.occurrences} occurrences in ${r.regles} rules`)} → ${esc(r.demande[lang])}</li>`).join('')}</ul>` : ''}
      ${m.types_jour.length ? '' : `<p class="warn-text">${L('Export des types de jour non fourni : les journées apparaîtront sous forme de numéros et le lexique sera absent.',
                                                           'Day types export not supplied: days will appear as numbers and the glossary will be missing.')}</p>`}`;
    if (!this.bound) this.bind();
  },

  bind() {
    this.bound = true;
    document.getElementById('dossier-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('d-generate');
      const opts = {
        client: document.getElementById('d-client').value.trim(),
        langue: document.getElementById('d-langue').value,
        contrats: document.getElementById('d-contrats').checked,
      };
      btn.disabled = true;
      this.status(() => L('Génération du classeur…', 'Building the workbook…'), '');
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
        const name = a.download;
        this.status(() => L(`Dossier téléchargé (${name}). Relisez l'audit avant de le transmettre.`,
                            `Dossier downloaded (${name}). Review the audit before sending it.`), 'ok');
      } catch (err) {
        this.status(() => L('Génération impossible : ', 'Generation failed: ') + err.message, 'err');
      } finally { btn.disabled = false; }
    });
    I18N.onChange(() => this.paintStatus());
  },

  status(text, kind) { this.msg = [text, kind]; this.paintStatus(); },

  paintStatus() {
    if (!this.msg) return;
    const st = document.getElementById('dossier-status');
    st.textContent = this.msg[0]();
    st.dataset.kind = this.msg[1];
  },
};
