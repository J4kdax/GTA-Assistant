/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 6.b ANALYSE — audit du paramétrage, règles isolées, chaîne de calcul
 *
 * Trois lectures transversales que le graphe et le panneau de détail ne
 * donnent pas :
 *  - Audit    : ce qui cloche vraiment dans le paramétrage (références
 *               cassées, cycles de dépendances, règles jamais affectées)
 *               plus quelques mesures de complexité.
 *  - Isolées  : règles sans dépendance entrante ni sortante. Information,
 *               PAS une anomalie — une règle compteur qui alimente la paie
 *               sans être consommée par une autre règle est parfaitement
 *               normale en GTA.
 *  - Chaîne   : dépendances sur plusieurs niveaux (le panneau de détail
 *               n'affiche que les voisins directs).
 * ========================================================================*/
const Analyse = {
  /* --- Fenêtre --- */
  modal(title, subtitle, html) {
    document.getElementById('an-title').textContent = title || '';
    document.getElementById('an-subtitle').textContent = subtitle || '';
    document.getElementById('an-body').innerHTML = html || '';
    document.getElementById('an-modal').hidden = false;
    Analyse.bindJumps();
  },
  close() {
    const m = document.getElementById('an-modal');
    if (m) m.hidden = true;
  },
  bindJumps() {
    document.querySelectorAll('#an-modal [data-jump]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.jump, 10);
        Analyse.close();
        UI.jumpTo(id);
      });
    });
  },
  node(id, extraClass) {
    const r = STATE.byId.get(id);
    const lib = r ? richText(r.libelle_court || r.libelle || '') : '<span class="empty">absente</span>';
    const jump = r ? ` data-jump="${id}"` : '';
    return `<span class="an-node ${extraClass || ''}"${jump}><span class="id">#${id}</span><span class="lib">${lib}</span></span>`;
  },

  /* --- Imbrication réelle des if() ---
   * On suit les parenthèses et on compte combien de if() sont ouverts
   * simultanément. À ne pas confondre avec le NOMBRE de if() : deux if()
   * côte à côte donnent une imbrication de 1, pas de 2. */
  ifDepth(body) {
    const s = String(body || '');
    const stack = [];
    let depth = 0, max = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        const word = s.slice(i, j).toLowerCase();
        let k = j;
        while (k < s.length && s[k] === ' ') k++;
        if (s[k] === '(') {
          const isIf = (word === 'if');
          stack.push(isIf);
          if (isIf) { depth++; if (depth > max) max = depth; }
          i = k;
        } else {
          i = j - 1;
        }
      } else if (c === '(') {
        stack.push(false);
      } else if (c === ')') {
        if (stack.pop()) depth--;
      }
    }
    return max;
  },

  /* --- Cycles de dépendances (Tarjan) --- */
  cycles() {
    const rules = STATE.rules || [];
    const adj = new Map(rules.map(r => [r.id, []]));
    for (const e of (STATE.edges || [])) if (adj.has(e.from)) adj.get(e.from).push(e.to);
    let counter = 0;
    const index = new Map(), low = new Map(), stack = [], onStack = new Set(), found = [];
    const walk = (v) => {
      index.set(v, counter); low.set(v, counter++); stack.push(v); onStack.add(v);
      for (const w of (adj.get(v) || [])) {
        if (!index.has(w)) { walk(w); low.set(v, Math.min(low.get(v), low.get(w))); }
        else if (onStack.has(w)) { low.set(v, Math.min(low.get(v), index.get(w))); }
      }
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        // Tarjan renvoie la composante sans ordre utile : on la réordonne en
        // suivant les arêtes, pour qu'elle se lise dans le sens des appels.
        const asPath = (c) => {
          const set = new Set(c), used = new Set([c[0]]), path = [c[0]];
          let cur = c[0];
          while (path.length < c.length) {
            const next = (adj.get(cur) || []).find(x => set.has(x) && !used.has(x));
            if (next === undefined) return c;
            path.push(next); used.add(next); cur = next;
          }
          return path;
        };
        if (comp.length > 1) found.push(asPath(comp));
        else if ((adj.get(v) || []).includes(v)) found.push(comp); // auto-référence
      }
    };
    for (const r of rules) if (!index.has(r.id)) walk(r.id);
    return found;
  },

  /* --- Mesures --- */
  stats() {
    const rules = STATE.rules || [];
    const inDeg = new Map(rules.map(r => [r.id, 0]));
    const outDeg = new Map(rules.map(r => [r.id, 0]));
    for (const e of (STATE.edges || [])) {
      if (outDeg.has(e.from)) outDeg.set(e.from, outDeg.get(e.from) + 1);
      if (inDeg.has(e.to)) inDeg.set(e.to, inDeg.get(e.to) + 1);
    }
    const isolates = rules.filter(r => !inDeg.get(r.id) && !outDeg.get(r.id));
    // Une règle sans aucune affectation n'est rattachée à aucun type de
    // contrat : elle ne s'exécute jamais. C'est un vrai signal d'audit.
    const unassigned = rules.filter(r => !String(r.affectations || '').trim());
    // Formules : on compte celles que l'analyseur sait expliquer.
    // ATTENTION : interpret() attend l'OBJET règle (il extrait lui-même le
    // corps depuis r.parametres), pas la chaîne de la formule.
    const formulaRules = rules.filter(r => Optimizations.isFormulaType(r.rule_type) && Optimizations.body(r));
    let explained = 0, maxIf = 0, deepest = null;
    for (const r of formulaRules) {
      const d = Analyse.ifDepth(Optimizations.body(r));
      if (d > maxIf) { maxIf = d; deepest = r; }
      try { if (FormulaAnalyzer.interpret(r, STATE.byId, STATE.dayTypes)) explained++; } catch (_) {}
    }
    return {
      rules, inDeg, outDeg, isolates, unassigned, formulaRules, explained, maxIf, deepest,
      broken: BrokenRefs.compute(),
      cycles: Analyse.cycles(),
      order: Analyse.orderIssues(),
      opt: Optimizations.cats || {}
    };
  },

  /* --- Audit --- */
  audit() {
    if (!STATE.rules || !STATE.rules.length) { toast('Chargez d\'abord un export de règles', 'warn'); return; }
    const s = Analyse.stats();
    const degRows = (map, emptyMsg) => {
      const top = [...map.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 10);
      if (!top.length) return `<div class="an-empty">${emptyMsg}</div>`;
      return `<table class="an-table"><thead><tr><th>Règle</th><th class="num">Nombre</th></tr></thead><tbody>${
        top.map(([id, n]) => `<tr><td>${Analyse.node(id)}</td><td class="num">${n}</td></tr>`).join('')
      }</tbody></table>`;
    };
    const cov = s.formulaRules.length ? Math.round(100 * s.explained / s.formulaRules.length) : null;
    Analyse.modal('Audit du paramétrage',
      `${s.rules.length} règles · ${(STATE.edges || []).length} dépendances · ${s.formulaRules.length} formules`, `
      <div class="an-kpis">
        <div class="an-kpi ${s.broken.length ? 'err' : 'ok'}">
          <div class="k">Références cassées</div><div class="v">${s.broken.length}</div>
          <div class="hint">Appels <code>ruleN</code> vers une règle absente de l'export</div>
        </div>
        <div class="an-kpi ${s.cycles.length ? 'err' : 'ok'}">
          <div class="k">Cycles de dépendances</div><div class="v">${s.cycles.length}</div>
          <div class="hint">Règles qui finissent par s'appeler entre elles</div>
        </div>
        <div class="an-kpi ${s.order.late.length ? 'err' : 'ok'}">
          <div class="k">Règles lues trop tard</div><div class="v">${s.order.late.length}</div>
          <div class="hint">Lisent une règle calculée après elles : valeur du jour absente</div>
        </div>
        <div class="an-kpi ${s.unassigned.length ? 'warn' : 'ok'}">
          <div class="k">Règles sans affectation</div><div class="v">${s.unassigned.length}</div>
          <div class="hint">Rattachées à aucun type de contrat, donc jamais calculées</div>
        </div>
        <div class="an-kpi">
          <div class="k">Règles isolées</div><div class="v">${s.isolates.length}</div>
          <div class="hint">Ni amont ni aval — normal pour une règle compteur</div>
        </div>
      </div>

      <div class="an-section">
        <h3>Complexité des formules</h3>
        <p class="an-note">Ces mesures décrivent la difficulté de lecture du paramétrage, pas sa justesse.</p>
        <table class="an-table"><thead><tr><th>Indicateur</th><th class="num">Valeur</th><th>Lecture</th></tr></thead><tbody>
          <tr><td>Formules du paramétrage</td><td class="num">${s.formulaRules.length}</td>
              <td>${cov === null ? 'Aucune formule détectée' : `${s.explained} traduites automatiquement en français (${cov} %) — les autres restent affichées telles quelles`}</td></tr>
          <tr><td>Imbrication maximale de <code>if()</code></td><td class="num">${s.maxIf}</td>
              <td>${s.maxIf >= 3
                    ? `<span class="an-tag warn">Difficile à relire</span>${s.deepest ? ' ' + Analyse.node(s.deepest.id) : ''}`
                    : '<span class="an-tag ok">Lisible</span>'}</td></tr>
          <tr><td>Formules identiques entre règles</td><td class="num">${(s.opt.identical || []).length}</td>
              <td><span class="an-tag info">Similarité — pas forcément une erreur</span></td></tr>
          <tr><td>Sous-expressions répétées</td><td class="num">${(s.opt.repeated || []).length}</td>
              <td><span class="an-tag info">Piste de rationalisation</span></td></tr>
        </tbody></table>
      </div>

      ${(s.order.late.length || s.order.tie.length) ? `<div class="an-section"><h3>Ordre d'évaluation</h3>
        <p class="an-note">L'ordre effectif est « SA : Ordre technique » quand il diffère de zéro, sinon la colonne « Ordre ». La documentation du type <code>_039</code> le rappelle : une règle citée par <code>ruleN</code> doit être calculée <strong>avant</strong> celle qui la lit, sinon la valeur du jour n'est pas encore disponible.</p>
        ${s.order.late.length ? `<h3 style="margin-top:12px">Lues trop tard <span class="an-tag err">${s.order.late.length}</span></h3>
          <p class="an-note">La règle qui lit est calculée avant la règle qu'elle lit. À corriger en priorité quand l'origine est une référence en formule.</p>
          ${Analyse.orderTable(s.order.late)}` : ''}
        ${s.order.tie.length ? `<h3 style="margin-top:16px">Même rang d'évaluation <span class="an-tag warn">${s.order.tie.length}</span></h3>
          <p class="an-note">Les deux règles portent le même ordre effectif : la séquence entre elles n'est pas garantie. À départager si la dépendance compte.</p>
          ${Analyse.orderTable(s.order.tie)}` : ''}
        ${s.order.unknown.length ? `<p class="an-note">${s.order.unknown.length} dépendance(s) dont l'ordre n'a pu être établi (colonne « Ordre » absente de l'export).</p>` : ''}
      </div>` : ''}

      ${s.broken.length ? `<div class="an-section"><h3>Références cassées</h3>
        <table class="an-table"><thead><tr><th>Règle appelante</th><th>Appel</th></tr></thead><tbody>${
          s.broken.map(x => `<tr><td>${Analyse.node(x.from)}</td><td><span class="an-tag err">rule${x.to}</span></td></tr>`).join('')
        }</tbody></table></div>` : ''}

      ${s.cycles.length ? `<div class="an-section"><h3>Cycles de dépendances</h3>
        <p class="an-note">Un cycle empêche un ordre de calcul déterministe : à vérifier en priorité.</p>${
          s.cycles.map(c => `<div>${c.map(id => Analyse.node(id)).join('<span class="an-tag">→</span>')}<span class="an-tag">→</span>${Analyse.node(c[0])}</div>`).join('')
        }</div>` : ''}

      ${s.unassigned.length ? `<div class="an-section"><h3>Règles sans affectation</h3>
        <p class="an-note">Aucun type de contrat ne porte ces règles : elles ne produisent rien tant qu'une affectation n'est pas ajoutée.</p>
        <div>${s.unassigned.slice(0, 60).map(r => Analyse.node(r.id)).join('')}</div>
        ${s.unassigned.length > 60 ? `<p class="an-note">… et ${s.unassigned.length - 60} autres.</p>` : ''}</div>` : ''}

      <div class="an-section"><h3>Règles les plus consommées</h3>
        <p class="an-note">Modifier l'une de ces règles se répercute sur beaucoup d'autres.</p>
        ${degRows(s.inDeg, 'Aucune règle n\'est consommée par une autre.')}</div>

      <div class="an-section"><h3>Règles qui consomment le plus d'autres règles</h3>
        ${degRows(s.outDeg, 'Aucune règle ne dépend d\'une autre.')}</div>
    `);
  },

  /* --- Règles isolées --- */
  isolates() {
    if (!STATE.rules || !STATE.rules.length) { toast('Chargez d\'abord un export de règles', 'warn'); return; }
    const list = Analyse.stats().isolates;
    if (!list.length) { toast('Aucune règle isolée', 'ok'); return; }
    Analyse.modal('Règles isolées',
      `${list.length} règle(s) sur ${STATE.rules.length} sans dépendance entrante ni sortante`, `
      <p class="an-note">Ce n'est pas une anomalie en soi : une règle compteur alimentant directement la paie n'a pas besoin d'être consommée par une autre règle. La liste sert à repérer celles qu'on aurait oublié de brancher.</p>
      <table class="an-table"><thead><tr><th>Règle</th><th>Libellé</th><th>Type</th></tr></thead><tbody>${
        list.map(r => `<tr><td>${Analyse.node(r.id)}</td><td>${richText(r.libelle || '')}</td><td>${escapeHtml(r.rule_type || '')}</td></tr>`).join('')
      }</tbody></table>`);
  },

  /* --- Chaîne de calcul sur plusieurs niveaux --- */
  chain(id) {
    const root = STATE.byId.get(id);
    if (!root) return;
    const layers = (dir, max = 8) => {
      const seen = new Set([id]);
      let cur = [id];
      const out = [];
      for (let d = 0; d < max; d++) {
        const next = [];
        for (const x of cur) {
          const r = STATE.byId.get(x);
          const vals = (dir === 'up' ? (r && r.deps) : (r && r.rdeps)) || [];
          for (const y of vals) if (!seen.has(y)) { seen.add(y); next.push(y); }
        }
        if (!next.length) break;
        out.push(next.sort((a, b) => a - b));
        cur = next;
      }
      return out;
    };
    const up = layers('up'), down = layers('down');
    // Quand il n'y a rien, la phrase d'introduction suffit : pas de bloc vide.
    const render = (arr, label) => arr.map((ids, i) =>
      `<div class="an-layer"><div class="an-layer-label">${label} ${i + 1}</div><div class="an-layer-nodes">${ids.map(x => Analyse.node(x)).join('')}</div></div>`).join('');
    const totalUp = up.reduce((n, a) => n + a.length, 0);
    const totalDown = down.reduce((n, a) => n + a.length, 0);
    Analyse.modal(`Chaîne de calcul — règle #${id}`,
      plainText(root.libelle_court || root.libelle || ''), `
      <div class="an-chain">
        <div class="an-layer"><div class="an-layer-label">Règle</div><div class="an-layer-nodes">${Analyse.node(id, 'self')}</div></div>
      </div>
      <div class="an-section"><h3>Amont — ce dont cette règle a besoin</h3>
        <p class="an-note">${totalUp ? `${totalUp} règle(s) sur ${up.length} niveau(x). Le niveau 1 correspond aux dépendances directes.` : 'Cette règle ne dépend d\'aucune autre.'}</p>
        <div class="an-chain">${render(up, 'Niveau')}</div></div>
      <div class="an-section"><h3>Aval — ce que cette règle impacte</h3>
        <p class="an-note">${totalDown ? `${totalDown} règle(s) sur ${down.length} niveau(x). Une modification ici se propage à toute cette liste.` : 'Aucune autre règle ne consomme cette règle.'}</p>
        <div class="an-chain">${render(down, 'Niveau')}</div></div>`);
  },

  /* --- Ordre d'évaluation ----------------------------------------------
   * #Dièse calcule les règles dans l'ordre de « SA : Ordre technique »
   * lorsque celui-ci est différent de 0, et sinon dans l'ordre de la
   * colonne « Ordre » (règle confirmée par Yannick, 2026-09-10).
   * La documentation officielle du type _039 est explicite sur l'enjeu :
   * « Rule X must run BEFORE this formula in the rule order ». Une règle
   * qui lit ruleN alors que N est calculée après elle ne lit donc pas la
   * valeur du jour — le calcul est faux, silencieusement.
   * -------------------------------------------------------------------- */
  effOrder(r) {
    if (!r) return { value: null, source: null };
    const tech = r.sa_ordre_technique;
    if (Number.isFinite(tech) && tech !== 0) return { value: tech, source: 'technique' };
    if (Number.isFinite(r.ordre)) return { value: r.ordre, source: 'ordre' };
    return { value: null, source: null };
  },
  effOrderLabel(r) {
    const o = Analyse.effOrder(r);
    if (o.value === null) return '—';
    return o.source === 'technique' ? `${o.value}<span class="an-hint"> tech.</span>` : `${o.value}`;
  },

  // Croise le graphe de dépendances avec l'ordre effectif.
  orderIssues() {
    const late = [], tie = [], unknown = [];
    for (const e of (STATE.edges || [])) {
      const src = STATE.byId.get(e.from);   // règle LUE
      const cons = STATE.byId.get(e.to);    // règle QUI LIT
      if (!src || !cons) continue;
      const os = Analyse.effOrder(src), oc = Analyse.effOrder(cons);
      // Origine de la référence : une référence inline ruleN dans une
      // formule est celle que la doc encadre explicitement. Une référence
      // par paramètre (« Règle source », « Règle(s) à additionner »…) peut
      // relever d'un cumul sur la période : on la signale à part.
      const inline = new RegExp('\\brule' + src.id + '\\b').test(String(cons.parametres || ''));
      const row = { cons, src, oc, os, inline };
      if (oc.value === null || os.value === null) unknown.push(row);
      else if (oc.value < os.value) late.push(row);
      else if (oc.value === os.value) tie.push(row);
    }
    const by = (a, b) => (a.cons.id - b.cons.id) || (a.src.id - b.src.id);
    return { late: late.sort(by), tie: tie.sort(by), unknown: unknown.sort(by) };
  },

  orderTable(rows) {
    return `<table class="an-table">
      <thead><tr><th>Règle qui lit</th><th class="num">Ordre</th><th>Règle lue</th><th class="num">Ordre</th><th>Origine</th></tr></thead>
      <tbody>${rows.map(x => `<tr>
        <td>${Analyse.node(x.cons.id)}</td>
        <td class="num">${Analyse.effOrderLabel(x.cons)}</td>
        <td>${Analyse.node(x.src.id)}</td>
        <td class="num">${Analyse.effOrderLabel(x.src)}</td>
        <td>${x.inline
              ? `<span class="an-tag err">rule${x.src.id} en formule</span>`
              : `<span class="an-tag">paramètre</span>`}</td>
      </tr>`).join('')}</tbody></table>`;
  },

  /* --- Index inversé des variables -------------------------------------
   * Familles et noms conformes à la référence officielle des variables de
   * formule _039 (article support #Dièse 185) et à la référence SBS _163.
   * On tokenise le CORPS des formules, jamais les libellés de paramètres :
   * sinon un mot de la clé « Day types » serait pris pour une variable.
   * -------------------------------------------------------------------- */
  VAR_FAMILIES: [
    ['temps',      'Temps et plages',                'Heures et minutes par type de jour, durées et bornes par plage.'],
    ['calendrier', 'Calendrier',                     'Position de la journée dans la semaine, le mois, l\'année.'],
    ['regles',     'Autres règles et historique',    'Valeurs d\'autres règles du même jour, et report de la veille.'],
    ['contrat',    'Contrat',                        'Taux, éléments financiers, champs personnalisés, type de contrat.'],
    ['activite',   'Activité, tâche, production',    'Filtres par tâche, type d\'activité, production, rôle — surtout en SBS.'],
    ['mapping',    'Table de correspondance',        'Valeurs issues des tables de conversion (latest_*).'],
    ['parametres', 'Références par paramètre',       'Identifiants cités dans les paramètres structurés, hors formule.'],
    ['inconnu',    'Identifiants non reconnus',      'Ne correspondent à aucune variable ni fonction documentée : faute de frappe ou variable inexistante à vérifier.'],
    ['fonctions',  'Fonctions et mots-clés',         'Pour information : quelles fonctions le paramétrage utilise réellement.']
  ],

  classifyToken(t) {
    let m;
    if ((m = t.match(/^htime(\d+)$/)))                 return { fam: 'temps', key: t };
    if ((m = t.match(/^mtime(\d+)$/)))                 return { fam: 'temps', key: t };
    if (/^(worktime|breaktime|starttime|endtime)\d+$/.test(t)) return { fam: 'temps', key: t };
    if (/^(weekDay|day|month|year|monthNbDays)$/.test(t))      return { fam: 'calendrier', key: t };
    if (/^rule\d+$/.test(t))                           return { fam: 'regles', key: t };
    if (/^(dayBeforeValue|dayBeforeContactValue)$/.test(t))    return { fam: 'regles', key: t };
    if (/^fieldactivity\d+_wt\d+$/.test(t))            return { fam: 'activite', key: t };
    if (/^fieldactivity\d+max$/.test(t))               return { fam: 'activite', key: t };
    if (/^(idactivitytype|idtask|idprod|idpredefinedrole|idvenue|idproductiontype)\d*$/.test(t)) return { fam: 'activite', key: t };
    if (/^element\d+$/.test(t))                        return { fam: 'contrat', key: t };
    if (/^fieldSystem\d+$/.test(t))                    return { fam: 'contrat', key: t };
    if (/^fieldContact\d+$/.test(t))                   return { fam: 'contrat', key: t };
    if (/^field\d+$/.test(t))                          return { fam: 'contrat', key: t };
    if (/^(rate|duration|contractTypeId|contractFirstWeekDay|contractLastWeekDay|contractStartDate|contractEndDate|departmentId)$/.test(t)) return { fam: 'contrat', key: t };
    if (/^latest_[A-Z0-9_]+$/.test(t))                 return { fam: 'mapping', key: t };
    if (/^(if|and|or|min|max|ceil|floor|abs|round|in_array|intdiv|new|DateTime|diff|days|array)$/.test(t)) return { fam: 'fonctions', key: t };
    return { fam: 'inconnu', key: t };
  },

  // Une clé de paramètre désigne-t-elle une entité référencée ?
  isReferenceKey(key) {
    if (DT_KEYS_NUMERIC.has(key)) return true;
    return /(t[âa]che|task|activity\s*type|type\s*d.activit|source\s*rule|r[èe]gle|\brules?\b|venue|lieu|production|r[ôo]le|\brole\b|jour\s*(?:inclu|exclu)|to\s*exclude)/i.test(key);
  },

  scanVariables() {
    const idx = new Map();
    const add = (fam, key, id) => {
      if (!idx.has(fam)) idx.set(fam, new Map());
      const fm = idx.get(fam);
      if (!fm.has(key)) fm.set(key, new Set());
      fm.get(key).add(id);
    };
    for (const r of (STATE.rules || [])) {
      if (Optimizations.isFormulaType(r.rule_type)) {
        const body = Optimizations.body(r) || '';
        for (const m of body.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
          const c = Analyse.classifyToken(m[0]);
          add(c.fam, c.key, r.id);
        }
      }
      // Références structurées : « clé : 12, 43, 60 ». On ne retient que les
      // clés qui désignent une ENTITÉ du paramétrage (type de jour, tâche,
      // type d'activité, règle source, lieu, production, rôle). Sans ce
      // filtre, « Mode* : 1 » ou « Value max : 8 » entreraient dans l'index
      // comme s'il s'agissait de références, ce qui n'a aucun sens.
      for (const line of String(r.parametres || '').split('\n')) {
        const mm = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
        if (!mm) continue;
        const key = mm[1].trim(), val = mm[2].trim();
        if (!val || !/^[\d,\s]+$/.test(val)) continue;
        if (!Analyse.isReferenceKey(key)) continue;
        for (const tok of val.split(',')) {
          const t = tok.trim();
          if (/^\d+$/.test(t)) add('parametres', `${key} → ${t}`, r.id);
        }
      }
    }
    return idx;
  },

  variables() {
    if (!STATE.rules || !STATE.rules.length) { toast('Chargez d\'abord un export de règles', 'warn'); return; }
    const idx = Analyse.scanVariables();
    const total = [...idx.values()].reduce((n, m) => n + m.size, 0);
    const sections = Analyse.VAR_FAMILIES.map(([fam, label, note]) => {
      const fm = idx.get(fam);
      if (!fm || !fm.size) return '';
      const rows = [...fm.entries()]
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'fr', { numeric: true }))
        .map(([key, ids]) => {
          const list = [...ids].sort((a, b) => a - b);
          const shown = list.slice(0, 10).map(id => Analyse.node(id)).join('');
          const more = list.length > 10 ? `<span class="an-tag">+${list.length - 10}</span>` : '';
          return `<tr data-k="${escapeAttr(key.toLowerCase())}">
            <td><code>${escapeHtml(key)}</code></td>
            <td class="num">${list.length}</td>
            <td>${shown}${more}</td>
          </tr>`;
        }).join('');
      return `<div class="an-section" data-fam="${fam}">
        <h3>${escapeHtml(label)} <span class="an-tag">${fm.size}</span></h3>
        <p class="an-note">${escapeHtml(note)}</p>
        <table class="an-table"><thead><tr><th>Variable</th><th class="num">Règles</th><th>Utilisée par</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }).join('');
    Analyse.modal('Index des variables',
      `${total} identifiants distincts relevés dans ${STATE.rules.length} règles`,
      `<input id="an-var-filter" class="an-filter" type="text" placeholder="Filtrer : htime, rule12, field, idtask…" autocomplete="off">
       <div id="an-var-body">${sections || '<div class="an-empty">Aucune variable relevée.</div>'}</div>`);
    const inp = document.getElementById('an-var-filter');
    if (inp) {
      inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        document.querySelectorAll('#an-var-body tr[data-k]').forEach(tr => {
          tr.hidden = q ? !tr.dataset.k.includes(q) : false;
        });
        document.querySelectorAll('#an-var-body .an-section').forEach(sec => {
          const any = [...sec.querySelectorAll('tr[data-k]')].some(tr => !tr.hidden);
          sec.hidden = !any;
        });
      });
      inp.focus();
    }
  },

  /* --- Lectures orientées métier ---------------------------------------
   * Le graphe montre la structure ; ces deux vues montrent le calcul.
   *  - Par compteur : chaque règle marquée « compteur » est un résultat qui
   *    part en paie. On déroule tout ce qui l'alimente, dans l'ordre
   *    d'évaluation, pour lire la fabrication du résultat de haut en bas.
   *  - Par type de contrat : la séquence de calcul réellement applicable à
   *    un CDDU, un CDI technique… c'est la question que pose un client.
   * Les deux fenêtres sont imprimables telles quelles (voir @media print).
   * -------------------------------------------------------------------- */

  // Ensemble transitif amont, avec la distance minimale au point de départ.
  upstreamLevels(id, max = 12) {
    const level = new Map();
    const seen = new Set([id]);
    let cur = [id];
    for (let d = 1; d <= max && cur.length; d++) {
      const next = [];
      for (const x of cur) {
        const r = STATE.byId.get(x);
        for (const y of ((r && r.deps) || [])) {
          if (seen.has(y)) continue;
          seen.add(y); level.set(y, d); next.push(y);
        }
      }
      cur = next;
    }
    return level;
  },

  // Tri par ordre d'évaluation effectif, les ordres inconnus en dernier.
  byEffOrder(a, b) {
    const oa = Analyse.effOrder(a).value, ob = Analyse.effOrder(b).value;
    if (oa === null && ob === null) return a.id - b.id;
    if (oa === null) return 1;
    if (ob === null) return -1;
    return oa - ob || a.id - b.id;
  },

  ruleTypeShort(rt) {
    const doc = (typeof RULE_TYPE_DOC !== 'undefined') && RULE_TYPE_DOC[rt];
    if (doc && doc.title) return doc.title;
    return String(rt || '').replace(/^_\d+_(STD|AIX|COB|IND|SBS)_/, '').replace(/_/g, ' ');
  },

  affectChips(r) {
    const list = Analyse.parseAffect(r);
    if (!list.length) return '<span class="an-tag warn">aucune affectation</span>';
    return list.map(a => `<span class="an-tag">${richText(a.lib)}</span>`).join(' ');
  },

  parseAffect(r) {
    const out = [];
    for (const line of String(r.affectations || '').split('\n')) {
      const m = line.match(/(.+?)\s*\(#(\d+)\)/);
      if (!m) continue;
      out.push({ id: parseInt(m[2], 10), lib: plainText(m[1]) });
    }
    return out;
  },

  // Tableau « séquence de calcul » commun aux deux vues.
  sequenceTable(rules, levels) {
    return `<table class="an-table">
      <thead><tr><th class="num">Ordre</th><th>Règle</th><th>Type de calcul</th>${levels ? '<th class="num">Niveau</th>' : '<th>Compteur</th>'}</tr></thead>
      <tbody>${rules.map(r => `<tr>
        <td class="num">${Analyse.effOrderLabel(r)}</td>
        <td>${Analyse.node(r.id)}</td>
        <td>${escapeHtml(Analyse.ruleTypeShort(r.rule_type))}</td>
        ${levels
          ? `<td class="num">${levels.get(r.id) || ''}</td>`
          : `<td>${r.compteur ? '<span class="an-tag ok">compteur</span>' : ''}</td>`}
      </tr>`).join('')}</tbody></table>`;
  },

  /* --- Vue par compteur --- */
  counters() {
    if (!STATE.rules || !STATE.rules.length) { toast('Chargez d\'abord un export de règles', 'warn'); return; }
    const counters = STATE.rules.filter(r => r.compteur).sort(Analyse.byEffOrder);
    if (!counters.length) {
      Analyse.modal('Vue par compteur', `${STATE.rules.length} règles`,
        `<div class="an-empty">Aucune règle n'est marquée « compteur » dans cet export. Le paramétrage n'expose donc aucun résultat par ce biais — à vérifier avec le client.</div>`);
      return;
    }
    // Règles qui ne contribuent à aucun compteur : information utile, souvent
    // le signe d'un reste de paramétrage abandonné.
    const contributing = new Set(counters.map(c => c.id));
    const blocks = counters.map(c => {
      const levels = Analyse.upstreamLevels(c.id);
      for (const k of levels.keys()) contributing.add(k);
      const feeders = [...levels.keys()].map(id => STATE.byId.get(id)).filter(Boolean).sort(Analyse.byEffOrder);
      return `<div class="an-section">
        <h3>${Analyse.node(c.id)} <span class="an-tag ok">compteur</span></h3>
        <p class="an-note">
          ${escapeHtml(Analyse.ruleTypeShort(c.rule_type))}
          ${c.periode ? ' · période ' + escapeHtml(c.periode) : ''}
          · ordre d'évaluation ${Analyse.effOrderLabel(c)}
          · ${feeders.length ? `${feeders.length} règle(s) en amont` : 'se calcule seule, sans dépendance'}
          <br>${Analyse.affectChips(c)}
        </p>
        ${feeders.length ? Analyse.sequenceTable(feeders, levels) : ''}
      </div>`;
    }).join('');
    const orphans = STATE.rules.filter(r => !contributing.has(r.id)).sort(Analyse.byEffOrder);
    Analyse.modal('Vue par compteur',
      `${counters.length} compteur(s) sur ${STATE.rules.length} règles`, `
      <p class="an-note">Chaque compteur est un résultat exploité en paie ou en suivi. Sous chacun, tout ce qui l'alimente, du premier calcul au dernier, dans l'ordre où #Dièse les exécute. La colonne « Niveau » indique la distance au compteur : 1 pour une dépendance directe.</p>
      ${blocks}
      ${orphans.length ? `<div class="an-section"><h3>Ne contribuent à aucun compteur <span class="an-tag">${orphans.length}</span></h3>
        <p class="an-note">Ces règles sont calculées mais leur valeur n'alimente aucun compteur. Souvent un reste de paramétrage, parfois une règle lue ailleurs que dans la GTA — à passer en revue.</p>
        ${Analyse.sequenceTable(orphans, null)}</div>` : ''}`);
  },

  /* --- Vue par type de contrat --- */
  contractTypes() {
    const map = new Map();
    for (const r of (STATE.rules || [])) {
      for (const a of Analyse.parseAffect(r)) {
        if (!map.has(a.id)) map.set(a.id, { id: a.id, lib: a.lib, rules: [] });
        map.get(a.id).rules.push(r);
      }
    }
    return [...map.values()].sort((x, y) => x.lib.localeCompare(y.lib, 'fr'));
  },

  contracts(preselect) {
    if (!STATE.rules || !STATE.rules.length) { toast('Chargez d\'abord un export de règles', 'warn'); return; }
    const types = Analyse.contractTypes();
    if (!types.length) {
      Analyse.modal('Vue par type de contrat', `${STATE.rules.length} règles`,
        `<div class="an-empty">Aucune affectation n'est renseignée dans cet export : impossible de reconstituer une séquence par type de contrat.</div>`);
      return;
    }
    const sel = types.find(t => String(t.id) === String(preselect)) || types[0];
    Analyse.modal('Vue par type de contrat',
      `${types.length} type(s) de contrat dans cet export`, `
      <div class="an-toolbar">
        <label for="an-contract-sel">Type de contrat</label>
        <select id="an-contract-sel">${types.map(t =>
          `<option value="${t.id}"${t.id === sel.id ? ' selected' : ''}>${escapeHtml(t.lib)} — ${t.rules.length} règle(s)</option>`).join('')}</select>
      </div>
      <div id="an-contract-body"></div>`);
    const paint = (id) => {
      const t = Analyse.contractTypes().find(x => x.id === id);
      const body = document.getElementById('an-contract-body');
      if (!t || !body) return;
      const rules = t.rules.slice().sort(Analyse.byEffOrder);
      const counters = rules.filter(r => r.compteur);
      body.innerHTML = `<div class="an-section">
        <h3>${escapeHtml(t.lib)} <span class="an-tag">#${t.id}</span></h3>
        <p class="an-note">${rules.length} règle(s) applicables, dans l'ordre où #Dièse les exécute${counters.length ? `, dont ${counters.length} compteur(s) : ${counters.map(c => Analyse.node(c.id)).join('')}` : ', dont aucun compteur'}</p>
        ${Analyse.sequenceTable(rules, null)}
      </div>`;
      Analyse.bindJumps();
    };
    paint(sel.id);
    const s = document.getElementById('an-contract-sel');
    if (s) s.addEventListener('change', () => paint(parseInt(s.value, 10)));
  }
};
