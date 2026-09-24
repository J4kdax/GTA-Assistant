/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 6. UI
 * ========================================================================*/
const UI = {
  renderLegend() {
    const counts = new Map();
    for (const r of STATE.rules) counts.set(r.rule_type, (counts.get(r.rule_type)||0)+1);
    const sorted = [...STATE.typeColor.entries()].sort((a,b)=>(counts.get(b[0])||0)-(counts.get(a[0])||0));
    document.getElementById('legend-count').textContent = sorted.length;
    const html = sorted.map(([t,c]) => {
      const cnt = counts.get(t)||0;
      const off = STATE.activeTypes.has(t) ? '' : 'off';
      return `<div class="legend-item ${off}" data-type="${escapeAttr(t)}">
        <span class="legend-color" style="background:${c}"></span>
        <span title="${escapeAttr(t)}">${escapeHtml(t.replace(/^_/, '').replace(/_STD_/,'_'))}</span>
        <span class="legend-count">${cnt}</span>
      </div>`;
    }).join('');
    document.getElementById('legend').innerHTML = html;
    document.querySelectorAll('.legend-item').forEach(el => {
      el.addEventListener('click', () => {
        const t = el.dataset.type;
        if (STATE.activeTypes.has(t)) STATE.activeTypes.delete(t); else STATE.activeTypes.add(t);
        el.classList.toggle('off');
        UI.applyFilters();
      });
    });
  },

  renderDayTypePanel() {
    const status = document.getElementById('dt-status');
    const grid = document.getElementById('dt-grid');
    const count = STATE.dayTypes.size;
    document.getElementById('dt-count').textContent = count;
    if (!count) {
      status.textContent = L('Aucun référentiel chargé', 'No reference data loaded');
      status.classList.remove('ok');
      grid.innerHTML = '';
      return;
    }
    // Used in current rule set?
    const used = new Set();
    for (const r of STATE.rules) for (const id of (r.dtRefs || [])) used.add(id);
    status.innerHTML = `<span class="ok">✔</span> ${Ln(count, 'type de jour', 'types de jour', 'day type', 'day types')} · <span style="color:var(--muted)">${L(`${used.size} référencés par les règles`, `${used.size} used by rules`)}</span>`;
    status.classList.add('ok');
    const list = [...STATE.dayTypes.values()]
      .sort((a,b)=>(a.ordre||999)-(b.ordre||999) || a.id-b.id);
    grid.innerHTML = list.map(dt => UI.dayTypeChipHTML(dt, used.has(dt.id))).join('');
    UI.bindDayTypeChips(grid);
  },

  // Chip HTML for a day type (resolved or not). Toujours cliquable pour
  // déclencher la mise en évidence des règles consommatrices.
  dayTypeChipHTML(dt, used = true) {
    if (!dt) return '';
    const cat = CAT_CLASS[dt.categorie] || '';
    const op = used ? '1' : '.45';
    const tooltip = `${dt.libelle || ''}${dt.libelle_interne && dt.libelle_interne !== dt.libelle ? ' / '+dt.libelle_interne : ''} — ${dt.categorie || ''}` +
                    '\n' + L("Cliquez pour mettre en évidence les règles qui l'utilisent", 'Click to highlight the rules that use it');
    return `<span class="dt-chip ${cat}" data-dt="${dt.id}" style="background:${dt.hex_bg};color:${dt.hex_fg};opacity:${op}" title="${escapeAttr(tooltip)}">
      <span class="num">#${dt.id}</span><span class="dt-name">${richText(dt.libelle_court || dt.libelle || '')}</span>
    </span>`;
  },

  unknownDayTypeChipHTML(id) {
    return `<span class="dt-chip unknown" data-dt="${id}" title="${L('Type de jour', 'Day type')} #${id} — ${L('non trouvé dans le référentiel', 'not found in the reference data')}"><span class="num">#${id}</span><span class="dt-name">?</span></span>`;
  },

  // Sélection d'un type de jour : met en évidence toutes les règles
  // qui le référencent (Day types ou htimeN), ouvre le panneau détail dédié.
  selectDayType(id) {
    STATE.selected = 'dt-' + id;
    UI.refreshHighlights();
    UI.renderDayTypeDetail(STATE.dayTypes.get(id), id);
    if (STATE.network && STATE.showDtLayer) {
      try { STATE.network.selectNodes(['dt-' + id], false); } catch(_) {}
    }
  },

  bindDayTypeChips(rootEl) {
    rootEl.querySelectorAll('.dt-chip[data-dt]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = parseInt(el.dataset.dt, 10);
        if (Number.isFinite(id)) UI.selectDayType(id);
      });
    });
  },

  applyFilters() {
    if (!STATE.nodeDS) return;
    const aff = STATE.activeAffect;
    const updates = STATE.rules.map(r => {
      const typeOK = STATE.activeTypes.has(r.rule_type);
      const affOK = !aff || (r.affectations && String(r.affectations).split('\n').some(line => {
        const m = line.match(/(.+?)\s*\(#\d+\)/);
        return m && m[1].replace(/<[^>]+>/g,'').trim() === aff;
      }));
      return {id: r.id, hidden: !(typeOK && affOK)};
    });
    STATE.nodeDS.update(updates);
    const hidden = new Set(updates.filter(u=>u.hidden).map(u=>u.id));
    const eu = [];
    STATE.edgeDS.forEach(e => {
      if (typeof e.id === 'string' && e.id.startsWith('dte-')) {
        eu.push({id: e.id, hidden: hidden.has(e.from)});
      } else {
        eu.push({id: e.id, hidden: hidden.has(e.from) || hidden.has(e.to)});
      }
    });
    STATE.edgeDS.update(eu);
    UI.refreshHighlights();
  },

  onClick(e) {
    if (e.nodes && e.nodes.length) {
      const nid = e.nodes[0];
      if (typeof nid === 'string' && nid.startsWith('dt-')) {
        const dtId = parseInt(nid.slice(3),10);
        UI.renderDayTypeDetail(STATE.dayTypes.get(dtId), dtId);
        STATE.selected = nid;
        UI.refreshHighlights();
      } else {
        STATE.selected = nid;
        UI.refreshHighlights();
        UI.renderDetail(STATE.byId.get(nid));
      }
    } else if (e.edges && e.edges.length) {
      // Clic sur une arête : afficher détail du lien dans le panneau droit
      const eid = e.edges[0];
      UI.renderEdgeDetail(eid);
    } else {
      STATE.selected = null;
      UI.refreshHighlights();
      UI.renderDetail(null);
    }
  },

  refreshHighlights() {
    if (!STATE.nodeDS) return;
    const showAnc = document.getElementById('toggle-ancestors').checked;
    const showDes = document.getElementById('toggle-descendants').checked;
    const sel = STATE.selected;
    if (!sel) {
      const upd = [];
      STATE.nodeDS.forEach(n => upd.push({id:n.id, opacity:1.0}));
      STATE.nodeDS.update(upd);
      const eu = [];
      STATE.edgeDS.forEach(e => {
        const isDt = typeof e.id === 'string' && e.id.startsWith('dte-');
        eu.push({id:e.id, color:{color: isDt ? THEME.t.edgeDt : THEME.t.edge, highlight:THEME.t.hl}, width:1});
      });
      STATE.edgeDS.update(eu);
      return;
    }
    // === Cas type de jour : on met en évidence toutes les règles qui le référencent ===
    if (typeof sel === 'string' && sel.startsWith('dt-')) {
      const dtId = parseInt(sel.slice(3), 10);
      const consumerIds = new Set();
      for (const r of STATE.rules) {
        if ((r.dtRefs || []).includes(dtId)) consumerIds.add(r.id);
      }
      const upd = [];
      STATE.nodeDS.forEach(n => {
        let isHigh = false;
        if (n._kind === 'daytype') isHigh = (n.id === sel);
        else isHigh = consumerIds.has(n.id);
        upd.push({id:n.id, opacity: isHigh ? 1.0 : 0.18});
      });
      STATE.nodeDS.update(upd);
      const eu = [];
      STATE.edgeDS.forEach(e => {
        const isDtEdge = typeof e.id === 'string' && e.id.startsWith('dte-');
        if (isDtEdge && e.to === sel) {
          eu.push({id:e.id, color:{color:THEME.t.hl, highlight:THEME.t.hl}, width:2.5});
        } else if (!isDtEdge && consumerIds.has(e.from) && consumerIds.has(e.to)) {
          eu.push({id:e.id, color:{color:THEME.t.edge, highlight:THEME.t.hl}, width:1});
        } else {
          eu.push({id:e.id, color:{color: isDtEdge ? THEME.t.edgeDimDt : THEME.t.edgeDim, highlight:THEME.t.hl}, width:1});
        }
      });
      STATE.edgeDS.update(eu);
      return;
    }
    // === Cas règle : voisins DIRECTS uniquement (1 saut amont + 1 saut aval) ===
    const high = new Set([sel]);
    if (typeof sel === 'number' || (typeof sel === 'string' && /^\d+$/.test(sel))) {
      const seedId = typeof sel === 'number' ? sel : parseInt(sel,10);
      const r = STATE.byId.get(seedId);
      if (r) {
        if (showAnc) for (const d of r.deps||[]) high.add(d);
        if (showDes) for (const d of r.rdeps||[]) high.add(d);
      }
    }
    const upd = [];
    STATE.nodeDS.forEach(n => upd.push({id:n.id, opacity: high.has(n.id) || high.has(typeof n.id==='string'?parseInt(n.id,10):n.id) ? 1.0 : 0.18}));
    STATE.nodeDS.update(upd);
    const eu = [];
    STATE.edgeDS.forEach(e => {
      const onPath = high.has(e.from) && high.has(e.to);
      eu.push({id:e.id, color:{color: onPath ? THEME.t.hl : THEME.t.edgeDim, highlight:THEME.t.hl}, width: onPath ? 2.5 : 1});
    });
    STATE.edgeDS.update(eu);
  },

  renderDetail(r) {
    const root = document.getElementById('detail');
    if (!r) {
      root.innerHTML = `<div class="placeholder">${L('Cliquez sur une règle pour voir ses détails', 'Click a rule to see its details')}</div>`;
      return;
    }
    const color = STATE.typeColor.get(r.rule_type) || '#888';
    const affHtml = (r.affectations ? String(r.affectations).split('\n').map(line => {
      const m = line.match(/(.+?)\s*\(#(\d+)\)/);
      if (!m) return '';
      const lib = m[1].replace(/<[^>]+>/g,'').trim();
      return `<span class="affect"><span class="num">#${m[2]}</span>${escapeHtml(lib)}</span>`;
    }).join('') : '');
    const paramsHtml = UI.formatParams(r.parametres, r.id);
    const depsHtml = (r.deps||[]).length
      ? r.deps.map(d => `<a data-jump="${d}">#${d} ${richText((STATE.byId.get(d)||{}).libelle_court || '')}</a>`).join('')
      : `<span class="empty">${L('Aucune dépendance amont', 'No upstream dependency')}</span>`;
    const rdepsHtml = (r.rdeps||[]).length
      ? r.rdeps.map(d => `<a data-jump="${d}">#${d} ${richText((STATE.byId.get(d)||{}).libelle_court || '')}</a>`).join('')
      : `<span class="empty">${L('Aucune dépendance aval', 'No downstream dependency')}</span>`;
    // Lecture humaine du rule_type
    // Pour les règles _039_STD_GTA_Formula, on essaie d'analyser dynamiquement
    // la formule pour produire une description spécifique à cette règle.
    const doc = (I18N.lang === 'en' && RULE_TYPE_DOC_EN[r.rule_type]) || RULE_TYPE_DOC[r.rule_type];
    const spec = (typeof RULE_SPECS !== 'undefined') ? RULE_SPECS[r.rule_type] : null;
    // Lien KB officiel + description anglaise du PHPDoc, à afficher en bas du bloc rt-doc
    const kbBtn = (spec && spec.kb_link)
      ? `<a class="rt-doc-kb" href="${escapeAttr(spec.kb_link)}" target="_blank" rel="noopener" title="${L('Documentation officielle #Dièse', 'Official #Dièse documentation')}">Doc #Dièse ↗</a>`
      : '';
    const enDesc = (spec && spec.description_en && I18N.lang !== 'en')
      ? `<div class="rt-doc-en">${escapeHtml(spec.description_en)}</div>`
      : '';
    let docHtml;
    // La phrase du moteur remplace l'analyse statique de l'ancien Cartographe.
    if (!r.description && r.rule_type === '_039_STD_GTA_Formula' && typeof FormulaAnalyzer !== 'undefined') {
      const interp = FormulaAnalyzer.interpret(r, STATE.byId, STATE.dayTypes);
      if (interp) {
        docHtml = `<div class="rt-doc">
          ${kbBtn}
          <div class="rt-doc-title">${L('Que fait cette formule ?', 'What does this formula do?')}</div>
          <div class="rt-doc-desc">${escapeHtml(interp)}</div>
          ${enDesc}
          <div class="rt-doc-foot">${escapeHtml(doc ? doc.title : L('Formule de calcul', 'Calculation formula'))} · ${L('analyse statique', 'static analysis')}</div>
        </div>`;
      } else {
        docHtml = `<div class="rt-doc" style="border-left-color:var(--muted-2);background:var(--panel-2)">
          ${kbBtn}
          <div class="rt-doc-desc" style="color:var(--muted)">${L('Formule trop imbriquée pour une lecture automatique fiable — reportez-vous au bloc « Paramètres » ci-dessous.', 'Formula too nested for a reliable automatic reading — see the “Settings” block below.')}</div>
        </div>`;
      }
    }
    if (!docHtml) {
      if (doc) {
        docHtml = `<div class="rt-doc">${kbBtn}<div class="rt-doc-title">${escapeHtml(doc.title)}</div><div class="rt-doc-desc">${escapeHtml(doc.desc)}</div>${enDesc}</div>`;
      } else if (spec && (spec.description_en || spec.kb_link)) {
        // Pas dans RULE_TYPE_DOC mais on a une spec officielle : on l'utilise
        docHtml = `<div class="rt-doc">${kbBtn}<div class="rt-doc-title">${escapeHtml(r.rule_type)}</div>${I18N.lang === 'en' && spec.description_en ? `<div class="rt-doc-desc">${escapeHtml(spec.description_en)}</div>` : (enDesc || `<div class="rt-doc-desc">${L('Description française non disponible pour ce type ; voir la doc officielle.', 'No description available for this type; see the official documentation.')}</div>`)}</div>`;
      } else {
        docHtml = `<div class="rt-doc" style="border-left-color:var(--muted-2)"><div class="rt-doc-title" style="color:var(--muted-2)">${L('Type non documenté', 'Undocumented type')}</div><div class="rt-doc-desc">${escapeHtml(r.rule_type || '')} — ${L('type sans entrée dans RULE_TYPE_DOC ni dans les sources PHP.', 'type with no entry in RULE_TYPE_DOC nor in the PHP sources.')}</div></div>`;
      }
    }
    // Ce que fait la règle, en clair : même phrase que dans le dossier client.
    if (r.description && r.description.fr) {
      const lang = I18N.lang;
      const txt = r.description[lang] || r.description.fr;
      docHtml = `<div class="rt-human">
          <div class="rt-doc-title">${L('Ce que fait la règle', 'What the rule calculates')}</div>
          <div class="rt-human-desc">${escapeHtml(txt)}</div>
          ${r.repli ? `<div class="rt-human-note">${L('Type de règle sans traduction dédiée : paramétrage restitué tel quel.', 'Rule type without a dedicated translation: settings shown as they are.')}</div>` : ''}
        </div>` + docHtml;
    }
    root.innerHTML = `
      <button id="btn-export-rule" class="export-rule-btn" title="${L('Exporter cette règle en PDF (ouverture nouvelle fenêtre + impression)', 'Export this rule to PDF (opens a new window and prints)')}">📄 ${L('Exporter', 'Export')}</button>
      <h3 style="border-left:3px solid ${color};padding-left:8px">${richText(r.libelle || '')}</h3>
      <div class="rid">
        <span class="pill">#${r.id}</span>
        <span class="pill">${escapeHtml(r.rule_type || '')}</span>
        ${r.code ? `<span class="pill">code: ${escapeHtml(r.code)}</span>` : ''}
        ${(() => { const o = Analyse.effOrder(r); return o.value === null ? '' :
            `<span class="pill" title="${L(`Ordre d'évaluation effectif : « SA : Ordre technique » s'il diffère de zéro, sinon la colonne « Ordre ». Ici : ${o.source === 'technique' ? 'ordre technique' : 'colonne Ordre'}.`, `Effective evaluation order: “SA: Technical order” when it is not zero, otherwise the “Order” column. Here: ${o.source === 'technique' ? 'technical order' : 'Order column'}.`)}">${L('ordre', 'order')} ${o.value}${o.source === 'technique' ? ' tech.' : ''}</span>`; })()}
        ${r.compteur ? `<span class="pill" style="background:var(--ok-soft);color:var(--ok)">${L('compteur', 'counter')}</span>`:''}
      </div>
      ${docHtml}
      <div class="field">
        <div class="field-label">${L('Période', 'Period')}</div>
        <div>${escapeHtml(r.periode || '—')}</div>
      </div>
      <div class="field">
        <div class="field-label">${L('Paramètres', 'Settings')}</div>
        <div class="params">${paramsHtml || '<span class="empty">—</span>'}</div>
        ${(spec && spec.params && spec.params.length) ? `
          <details class="spec-params" style="margin-top:6px">
            <summary>${L('Paramètres officiels attendus (depuis le source #Dièse', 'Official expected settings (from the #Dièse source')}, ${spec.params.length})</summary>
            <div class="spec-params-list">${spec.params.map(p => `<div class="spec-param-item${p.mandatory ? ' mand' : ''}"><span class="spec-param-label">${escapeHtml(p.label)}${p.mandatory ? ' <span class="spec-mand">*</span>' : ''}</span><span class="spec-param-type">${escapeHtml(p.editor || '?')}</span></div>`).join('')}</div>
          </details>` : ''}
      </div>
      <div class="field deps">
        <div class="field-label">${L('Dépend de (amont)', 'Depends on (upstream)')}</div>
        ${depsHtml}
      </div>
      <div class="field rdeps">
        <div class="field-label">${L('Utilisé par (aval)', 'Used by (downstream)')}</div>
        ${rdepsHtml}
        <button id="btn-chain" class="chain-btn" title="${L('Dépendances sur plusieurs niveaux, amont et aval', 'Dependencies over several levels, upstream and downstream')}">${L('Voir la chaîne de calcul complète', 'See the full calculation chain')}</button>
      </div>
      <details class="field" open>
        <summary class="field-label">${L('Affectations', 'Assignments')} <span class="hint">${L('types de contrats rattachés', 'contract types attached')}</span></summary>
        <div class="affect-list">${affHtml || '<span class="empty">—</span>'}</div>
      </details>
`;

    root.querySelectorAll('a[data-jump]').forEach(a => {
      a.addEventListener('click', () => UI.jumpTo(parseInt(a.dataset.jump,10)));
    });
    root.querySelectorAll('.params .ruleref:not(.dead)').forEach(el => {
      el.addEventListener('click', () => UI.jumpTo(parseInt(el.dataset.rule,10)));
    });
    // chips type de jour (Day types ou htimeN) -> sélection + highlight
    UI.bindDayTypeChips(root);
    // Bouton export PDF
    const expBtn = root.querySelector('#btn-export-rule');
    if (expBtn) expBtn.addEventListener('click', () => UI.exportRulePDF(r));
    // Chaîne de calcul multi-niveaux
    const chainBtn = root.querySelector('#btn-chain');
    if (chainBtn) chainBtn.addEventListener('click', () => Analyse.chain(r.id));
  },

  renderDayTypeDetail(dt, fallbackId) {
    const root = document.getElementById('detail');
    if (!dt) {
      root.innerHTML = `<h3>${L('Type de jour', 'Day type')} #${fallbackId}</h3>
        <div class="rid"><span class="pill" style="background:var(--err-soft);color:var(--err)">${L('non résolu', 'unresolved')}</span></div>
        <div class="smallnote">${L("Ce type de jour est référencé par au moins une règle mais n'est pas présent dans le référentiel chargé. Déposez l'export Excel « Contrats-GTA-Absences-présences » dans l'Atelier.", 'This day type is used by at least one rule but is not in the loaded reference data. Drop the “Contrats-GTA-Absences-présences” Excel export into the Atelier.')}</div>`;
      return;
    }
    // Liste des règles qui consomment ce type de jour
    const consumers = STATE.rules.filter(r => (r.dtRefs||[]).includes(dt.id));
    const consHtml = consumers.length
      ? consumers.slice().sort((a,b)=>a.id-b.id).map(r => `<a data-jump="${r.id}">#${r.id} ${richText(r.libelle_court || r.libelle || '')}</a>`).join('')
      : `<span class="empty">${L('Aucune règle ne référence ce type de jour', 'No rule uses this day type')}</span>`;
    root.innerHTML = `
      <h3 style="border-left:6px solid ${dt.hex_bg};padding-left:8px">${richText(dt.libelle || '')}</h3>
      <div class="rid">
        <span class="pill">${L('type de jour', 'day type')} #${dt.id}</span>
        <span class="pill" style="background:${dt.hex_bg};color:${dt.hex_fg};border-color:transparent">${richText(dt.libelle_court || '')}</span>
        ${dt.actif ? `<span class="pill" style="background:var(--ok-soft);color:var(--ok)">${L('actif', 'active')}</span>` : `<span class="pill" style="opacity:.6">${L('inactif', 'inactive')}</span>`}
      </div>
      <div class="field"><div class="field-label">${L('Catégorie', 'Category')}</div><div>${escapeHtml(dt.categorie || '—')}</div></div>
      <div class="field"><div class="field-label">${L('Libellé interne', 'Internal label')}</div><div>${escapeHtml(dt.libelle_interne || dt.libelle || '—')}</div></div>
      <div class="field"><div class="field-label">${L('Durée par défaut', 'Default duration')}</div><div>${dt.duree_min != null ? dt.duree_min+' min' : '—'}</div></div>
      <div class="field deps"><div class="field-label">${L('Règles qui le référencent', 'Rules that use it')} <span class="hint">(${consumers.length})</span></div>${consHtml}</div>
    `;
    root.querySelectorAll('a[data-jump]').forEach(a => {
      a.addEventListener('click', () => UI.jumpTo(parseInt(a.dataset.jump,10)));
    });
  },

  // Reformatte le bloc "parametres" en HTML structuré : un bloc par paramètre,
  // avec clé en label, valeur sur sa propre ligne. Cas spéciaux :
  //  - "Day types" et clés numériques équivalentes -> chips colorés
  //  - clés de la forme "_NNN_STD_..._Formula" -> rendu formule (côté valeur)
  //  - ruleN et htimeN -> liens / chips inline cliquables
  //  - valeur vide ou "-" -> rendu "non défini" en italique muted
  formatParams(params, ruleId) {
    if (!params) return '';
    const ids = new Set(STATE.rules.map(r => r.id));

    // Décompose une clé "Mode*" en {label:'Mode', sub:'(obligatoire)'}
    const splitKey = (raw) => {
      const k = raw.trim();
      let sub = '';
      let label = k;
      if (k.endsWith('*')) {
        label = k.slice(0, -1).trim();
        sub = '*';
      }
      // Renomme les clés "_NNN_STD_..._Formula" en "Formule"
      if (/^_\d+_.*Formula/i.test(label)) {
        return { label: L('Formule', 'Formula'), sub: label };
      }
      return { label, sub };
    };

    const inlineLinks = (escaped) => {
      // ruleN cliquable
      let s = escaped.replace(/rule(\d+)/g, (mm, n) => {
        const nid = parseInt(n, 10);
        const dead = !ids.has(nid);
        return `<a class="ruleref ${dead?'dead':''}" data-rule="${nid}" title="${dead?L('Référence cassée : rule'+nid+' inexistant', 'Broken reference: rule'+nid+' does not exist'):L('Aller à la règle #', 'Go to rule #')+nid}">rule${n}</a>`;
      });
      // htimeN -> chip type de jour
      s = s.replace(/htime(\d+)/g, (mm, n) => {
        const nid = parseInt(n, 10);
        const dt = STATE.dayTypes.get(nid);
        if (dt) {
          const cat = CAT_CLASS[dt.categorie] || '';
          const tip = `htime${nid} → ${plainText(dt.libelle)}${dt.categorie?' ('+dt.categorie+')':''}\n${L("Cliquez pour mettre en évidence les règles qui l'utilisent", 'Click to highlight the rules that use it')}`;
          return `<span class="dt-chip dt-inline ${cat}" data-dt="${nid}" style="background:${dt.hex_bg};color:${dt.hex_fg}" title="${escapeAttr(tip)}">htime<span class="num">${nid}</span></span>`;
        }
        return `<span class="dt-chip dt-inline unknown" data-dt="${nid}" title="htime${nid} — ${L('type de jour absent du référentiel', 'day type missing from the reference data')}">htime${nid}</span>`;
      });
      return s;
    };

    const blocks = String(params).split('\n').map(line => {
      if (!line.trim()) return '';
      const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
      if (!m) return `<div class="pline-free">${escapeHtml(line)}</div>`;

      const rawKey = m[1].trim();
      const rawVal = m[2].trim();
      const { label, sub } = splitKey(rawKey);
      const keyHtml = `<span class="pkey">${escapeHtml(label)}${sub ? `<span class="ksub">${escapeHtml(sub)}</span>` : ''}</span>`;

      // Valeur vide
      if (!rawVal || rawVal === '-') {
        return `<div class="pline">${keyHtml}<div class="pval pval-empty">—</div></div>`;
      }

      // Liste de types de jour -> chips
      if (DT_KEYS_NUMERIC.has(rawKey)) {
        const chips = rawVal.split(',').map(tok => {
          const t = tok.trim();
          if (!/^\d+$/.test(t)) return escapeHtml(tok);
          const id = parseInt(t, 10);
          const dt = STATE.dayTypes.get(id);
          return dt ? UI.dayTypeChipHTML(dt) : UI.unknownDayTypeChipHTML(id);
        }).join('');
        return `<div class="pline">${keyHtml}<div class="pval pval-chips">${chips}</div></div>`;
      }

      // Thresholds / Seuils -> mini-tableau (anglais et français)
      if (/^Thresholds?\*?$/i.test(rawKey) || /^Seuils?\*?$/i.test(rawKey) || /^Seuil\s+max\*?$/i.test(rawKey)) {
        const rows = decodeThresholds(rawVal);
        if (rows.length) {
          const trs = rows.map(r => `<tr><td>${r.from}</td><td>${r.to}</td><td class="tval">${r.value}</td></tr>`).join('');
          const tbl = `<table class="thresh"><thead><tr><th>${L('de', 'from')}</th><th>${L('à', 'to')}</th><th>${L('valeur', 'value')}</th></tr></thead><tbody>${trs}</tbody></table>`;
          return `<div class="pline">${keyHtml}<div class="pval">${tbl}</div></div>`;
        }
      }

      // Formule -> bloc "code" pretty-printed
      const isFormula = /^_\d+_.*Formula/i.test(rawKey);
      let prepared = rawVal;
      if (isFormula) prepared = prettyFormula(rawVal);
      const linked = inlineLinks(escapeHtml(prepared));
      const valClass = isFormula ? 'pval pval-formula' : 'pval';
      const styleAttr = isFormula ? ' style="white-space:pre-wrap"' : '';
      return `<div class="pline">${keyHtml}<div class="${valClass}"${styleAttr}>${linked}</div></div>`;
    }).filter(Boolean);

    return blocks.join('');
  },

  jumpTo(ruleId) {
    if (!STATE.byId.get(ruleId)) {
      toast(L('Règle #', 'Rule #')+ruleId+L(' introuvable', ' not found'), 'warn');
      return;
    }
    STATE.selected = ruleId;
    UI.refreshHighlights();
    UI.renderDetail(STATE.byId.get(ruleId));
    if (STATE.network) {
      STATE.network.selectNodes([ruleId]);
      STATE.network.focus(ruleId, {scale:1.0, animation:{duration:350}});
    }
  },

  onSearchInput(q) {
    const root = document.getElementById('search-results');
    q = (q||'').trim().toLowerCase();
    if (q.length < 1) { root.innerHTML = ''; return; }
    // Recherche étendue : id, libellé, code, rule_type, ET paramètres.
    // Tri par pertinence (du plus probable au moins probable) plutôt que l'ordre
    // brut du fichier source :
    //   0. correspondance exacte sur l'ID ou le code
    //   1. libellé/libellé court/code commençant par le texte tapé
    //   2. rule_type commençant par le texte tapé
    //   3. libellé/libellé court/code contenant le texte tapé
    //   4. rule_type ou ID contenant le texte tapé
    //   5. trouvé uniquement dans les paramètres (repli le moins précis)
    // À rang égal, tri par ID croissant pour un ordre stable et prévisible.
    const scored = [];
    for (const r of STATE.rules) {
      const idStr = String(r.id);
      // Recherche sur le texte sans balise : une requête peut ainsi
      // enjamber un <small> sans jamais correspondre au balisage lui-même.
      const lib = plainText(r.libelle).toLowerCase();
      const libCourt = plainText(r.libelle_court).toLowerCase();
      const code = (r.code || '').toLowerCase();
      const rtype = (r.rule_type || '').toLowerCase();
      const params = (r.parametres || '').toLowerCase();

      let rank;
      if (idStr === q || (code && code === q)) rank = 0;
      else if (lib.startsWith(q) || libCourt.startsWith(q) || (code && code.startsWith(q))) rank = 1;
      else if (rtype.startsWith(q)) rank = 2;
      else if (lib.includes(q) || libCourt.includes(q) || (code && code.includes(q))) rank = 3;
      else if (rtype.includes(q) || idStr.includes(q)) rank = 4;
      else if (params.includes(q)) rank = 5;
      else continue;
      scored.push({ r, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || a.r.id - b.r.id);
    const matches = scored.slice(0, 30).map(s => s.r);
    if (!matches.length) { root.innerHTML = `<div class="placeholder" style="padding:8px">${L('Aucun résultat', 'No result')}</div>`; return; }
    root.innerHTML = matches.map(r => {
      let ctx = '';
      if (r.parametres) {
        const p = String(r.parametres).toLowerCase();
        const idx = p.indexOf(q);
        if (idx >= 0) {
          const start = Math.max(0, idx - 20);
          const end = Math.min(p.length, idx + q.length + 30);
          ctx = '…' + String(r.parametres).substring(start, end).replace(/\n/g, ' / ') + '…';
        }
      }
      return `<div class="res" data-id="${r.id}">
        #${r.id} ${richText(r.libelle_court || r.libelle || '')}
        <span class="rt">${escapeHtml(r.rule_type || '')}${ctx ? ' · '+escapeHtml(ctx) : ''}</span>
      </div>`;
    }).join('');
    root.querySelectorAll('.res').forEach(el => {
      el.addEventListener('click', () => UI.jumpTo(parseInt(el.dataset.id,10)));
    });
  },

  // Analyse comment srcId est référencée dans les paramètres de dst.
  // Renvoie [{type:'inline'|'param', key, val, line, ids?}, ...]
  analyzeRef(srcId, dstParams) {
    if (!dstParams) return [];
    const out = [];
    const refKeyRe = /(?:Source\s+[Rr]ule\(?s?\)?\*?|Id\s+Source\s+Rule|Source\s+Rule|Rule\(s\)\*?|Rules\*?|Rule\s+annual\s+credit\*?|Rule\s+total\s+worked\s+hours\*?|Règle\s+source|Id\s+règle\s+source|Règle\(s\)(?:\s+à\s+additionner|\s+crédit\s+annuel)?|Règle\s+(?:total\s+effectué|crédit\s+annuel))/i;
    const ruleRe = new RegExp('\\brule' + srcId + '\\b', 'g');
    for (const line of String(dstParams).split('\n')) {
      const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      const inlineMatches = (val.match(ruleRe) || []).length;
      if (inlineMatches) {
        out.push({ type:'inline', key, val, line, count: inlineMatches });
      }
      if (refKeyRe.test(key)) {
        const ids = val.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(Number);
        if (ids.includes(srcId)) {
          out.push({ type:'param', key, val, line, ids });
        }
      }
    }
    return out;
  },

  // Rendu du panneau de détail pour une arête (lien entre deux règles)
  renderEdgeDetail(edgeId) {
    if (!STATE.edgeDS) return;
    // Cas spécial : arête rule -> day type
    if (typeof edgeId === 'string' && edgeId.startsWith('dte-')) {
      const edge = STATE.edgeDS.get(edgeId);
      if (!edge) return;
      const srcId = edge.from;
      const dtId = parseInt(String(edge.to).slice(3), 10);
      const src = STATE.byId.get(srcId);
      const dt = STATE.dayTypes.get(dtId);
      if (!src || !dt) return;
      const root = document.getElementById('detail');
      root.innerHTML = `
        <h3 style="border-left:3px solid #5d6675;padding-left:8px">${L('Lien règle → type de jour', 'Rule → day type link')}</h3>
        <div class="rid">
          <span class="pill">${L('arête', 'edge')}</span>
          <span class="pill" style="background:rgba(93,102,117,.2);border-color:#5d6675">${L('consommation type de jour', 'day type use')}</span>
        </div>
        <div class="field">
          <div class="field-label">${L('Règle consommatrice', 'Consuming rule')}</div>
          <div><a data-jump="${src.id}">#${src.id} ${richText(src.libelle_court || src.libelle || '')}</a> · <span style="color:var(--muted-2);font-size:11px">${escapeHtml(src.rule_type || '')}</span></div>
        </div>
        <div class="field">
          <div class="field-label">${L('Type de jour référencé', 'Day type used')}</div>
          <div><span class="dt-chip" data-dt="${dt.id}" style="background:${dt.hex_bg};color:${dt.hex_fg}"><span class="num">#${dt.id}</span>${richText(dt.libelle_court || dt.libelle || '')}</span></div>
          <div class="smallnote">${escapeHtml(dt.categorie || '')}</div>
        </div>`;
      root.querySelectorAll('a[data-jump]').forEach(a => a.addEventListener('click', () => UI.jumpTo(parseInt(a.dataset.jump,10))));
      UI.bindDayTypeChips(root);
      STATE.selected = edgeId;
      return;
    }
    // Arête classique règle → règle (convention v2.11.2+ : from=source, to=consumer)
    const edge = STATE.edgeDS.get(edgeId);
    if (!edge) return;
    const srcId = edge.from;
    const dstId = edge.to;
    const src = STATE.byId.get(srcId);
    const dst = STATE.byId.get(dstId);
    if (!src || !dst) return;
    const findings = UI.analyzeRef(srcId, dst.parametres);
    const root = document.getElementById('detail');
    const srcColor = STATE.typeColor.get(src.rule_type) || '#888';
    const dstColor = STATE.typeColor.get(dst.rule_type) || '#888';
    // Co-références : autres règles citées dans la même formule / le même paramètre
    const coRefs = new Set();
    for (const f of findings) {
      const val = f.val || '';
      for (const m of String(val).matchAll(/\brule(\d+)\b/g)) {
        const nid = parseInt(m[1], 10);
        if (nid !== srcId && STATE.byId.has(nid)) coRefs.add(nid);
      }
      if (f.type === 'param' && Array.isArray(f.ids)) {
        for (const nid of f.ids) {
          if (nid !== srcId && STATE.byId.has(nid)) coRefs.add(nid);
        }
      }
    }
    const findingHtml = findings.length ? findings.map(f => {
      if (f.type === 'inline') {
        return `<div class="edge-finding">
          <div class="ef-type">${L('Inline dans formule', 'Inline in formula')}</div>
          <div class="ef-key">${escapeHtml(f.key)}</div>
          <div class="ef-line"><code>${escapeHtml(f.line)}</code></div>
          <div class="smallnote">${L(`${f.count} occurrence${f.count>1?'s':''} de <code>rule${srcId}</code> dans cette ligne.`, `${f.count} occurrence${f.count>1?'s':''} of <code>rule${srcId}</code> in this line.`)}</div>
        </div>`;
      } else {
        return `<div class="edge-finding">
          <div class="ef-type">${L('Paramètre dédié', 'Dedicated setting')}</div>
          <div class="ef-key">${escapeHtml(f.key)}</div>
          <div class="ef-line">${L('Valeur : ', 'Value: ')}<code>${escapeHtml(f.val)}</code></div>
          <div class="smallnote">${L(`Référence #${srcId} déclarée explicitement comme entrée de ce paramètre.`, `Reference #${srcId} explicitly declared as an input of this setting.`)}</div>
        </div>`;
      }
    }).join('') : `<span class="empty">${L('Aucun référencement direct détecté — le lien pourrait être indirect ou via un sous-paramètre non analysé.', 'No direct reference found — the link may be indirect or through a sub-setting that is not analysed.')}</span>`;
    const coRefsList = [...coRefs].sort((a,b)=>a-b);
    root.innerHTML = `
      <h3 style="border-left:3px solid var(--accent);padding-left:8px">${L('Lien de dépendance', 'Dependency link')}</h3>
      <div class="rid">
        <span class="pill">${L('arête', 'edge')}</span>
        <span class="pill">${L('source → consommateur', 'source → consumer')}</span>
      </div>
      <div class="field edge-endpoints">
        <div class="field-label">${L('Règle source', 'Source rule')} <span class="hint">${L('(produit la valeur)', '(produces the value)')}</span></div>
        <div class="edge-rule" style="border-left:3px solid ${srcColor}">
          <a data-jump="${src.id}"><strong>#${src.id} ${richText(src.libelle_court || src.libelle || '')}</strong></a>
          <div class="smallnote">${escapeHtml(src.rule_type || '')}${src.compteur ? ' · ' + L('compteur', 'counter') : ''}</div>
        </div>
      </div>
      <div class="field edge-endpoints">
        <div class="field-label">${L('Règle consommatrice', 'Consuming rule')} <span class="hint">${L('(utilise la valeur)', '(uses the value)')}</span></div>
        <div class="edge-rule" style="border-left:3px solid ${dstColor}">
          <a data-jump="${dst.id}"><strong>#${dst.id} ${richText(dst.libelle_court || dst.libelle || '')}</strong></a>
          <div class="smallnote">${escapeHtml(dst.rule_type || '')}${dst.compteur ? ' · ' + L('compteur', 'counter') : ''}</div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">${L('Mode de référencement', 'How it is referenced')}</div>
        <div class="edge-findings">${findingHtml}</div>
      </div>
      ${coRefsList.length ? `<div class="field">
        <div class="field-label">${L('Co-références', 'Co-references')} <span class="hint">${L('(autres règles consommées dans le même paramètre)', '(other rules used in the same setting)')}</span></div>
        <div class="deps">${coRefsList.map(id => {
          const r = STATE.byId.get(id);
          return `<a data-jump="${id}">#${id} ${richText(r ? (r.libelle_court || r.libelle || '') : '')}</a>`;
        }).join('')}</div>
      </div>` : ''}
      <div class="field">
        <div class="field-label">${L('Paramètres complets de la règle consommatrice', 'Full settings of the consuming rule')}</div>
        <div class="params">${UI.formatParams(dst.parametres, dst.id) || '<span class="empty">—</span>'}</div>
      </div>`;
    root.querySelectorAll('a[data-jump]').forEach(a => a.addEventListener('click', () => UI.jumpTo(parseInt(a.dataset.jump,10))));
    root.querySelectorAll('.params .ruleref:not(.dead)').forEach(el => el.addEventListener('click', () => UI.jumpTo(parseInt(el.dataset.rule,10))));
    UI.bindDayTypeChips(root);
    STATE.selected = edgeId;
  },

  // Export PDF d'une règle : ouvre une nouvelle fenêtre avec un rapport HTML
  // autonome, puis déclenche window.print() pour que le navigateur propose
  // l'enregistrement en PDF. Format A4-friendly, thème clair.
  exportRulePDF(r) {
    if (!r) return;
    const html = UI.buildPrintableHTML(r);
    const win = window.open('', '_blank');
    if (!win) {
      toast(L('Le navigateur a bloqué la nouvelle fenêtre. Autorise les pop-ups pour ce site.', 'The browser blocked the new window. Allow pop-ups for this site.'), 'err');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch(_) {} }, 400);
  },

  // Construit le HTML autonome du rapport pour une règle
  buildPrintableHTML(r) {
    const esc = (s) => String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const doc = (I18N.lang === 'en' && RULE_TYPE_DOC_EN[r.rule_type]) || RULE_TYPE_DOC[r.rule_type];
    const spec = (typeof RULE_SPECS !== 'undefined') ? RULE_SPECS[r.rule_type] : null;
    // Phrase du moteur (celle du dossier client) ; à défaut, l'analyse statique historique.
    const human = r.description ? (r.description[I18N.lang] || r.description.fr) : null;
    const interp = human || ((r.rule_type === '_039_STD_GTA_Formula' && typeof FormulaAnalyzer !== 'undefined')
      ? FormulaAnalyzer.interpret(r, STATE.byId, STATE.dayTypes)
      : null);
    const typeColor = STATE.typeColor.get(r.rule_type) || '#888';
    const affectations = (r.affectations ? String(r.affectations).split('\n').map(line => {
      const m = line.match(/(.+?)\s*\(#(\d+)\)/);
      if (!m) return null;
      return { id: m[2], lib: m[1].replace(/<[^>]+>/g, '').trim(), bold: /<b>/i.test(m[1]) };
    }).filter(Boolean) : []);
    const resolveDeps = (ids) => (ids || []).map(id => {
      const dep = STATE.byId.get(id);
      return { id, lib: dep ? richText(dep.libelle_court || dep.libelle || '') : L('(absente)', '(missing)') };
    });
    const deps = resolveDeps(r.deps);
    const rdeps = resolveDeps(r.rdeps);
    const paramsBlocks = UI.buildExportParams(r.parametres);
    const generatedAt = new Date().toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const titleStr = `${L('Règle', 'Rule')} #${r.id} — ${plainText(r.libelle_court || r.libelle || '')}`;
    // Formule dont la lecture automatique a été écartée : on n'imprime que le
    // renvoi aux paramètres, pas le rappel générique de la syntaxe _039.
    const noRead = (!interp && r.rule_type === '_039_STD_GTA_Formula');
    return `<!DOCTYPE html>
<html lang="${I18N.lang}">
<head>
<meta charset="UTF-8">
<title>${esc(titleStr)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
    max-width: 900px; margin: 0 auto; padding: 26px 30px; color: #1d1d1f;
    line-height: 1.5; font-size: 12.5px; background: #fff;
    -webkit-font-smoothing: antialiased; letter-spacing: -.005em;
  }
  h1 {
    font-size: 21px; margin: 0 0 4px 0; color: #1d1d1f; font-weight: 650;
    letter-spacing: -.025em; line-height: 1.25;
    border-left: 4px solid ${typeColor}; padding-left: 12px; border-radius: 2px;
  }
  h2 {
    font-size: 10.5px; margin: 20px 0 6px 0; color: #6e6e73; text-transform: none;
    letter-spacing: -.005em; font-weight: 600; border: none; padding: 0;
  }
  .meta-sub { color: #6e6e73; font-size: 11.5px; margin: 0 0 8px 16px; }
  .pills { margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 5px; }
  .pill {
    display: inline-block; background: #f0f0f3; border: none; padding: 3px 10px;
    border-radius: 999px; font-size: 10.5px; color: #3a3a3c; font-weight: 500;
  }
  .pill.counter { background: rgba(52,199,89,.14); color: #1c7a34; }
  .pill.code { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; }
  /* Marque en tête de fiche */
  .doc-brand { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  .doc-brand img { height: 30px; width: auto; }
  /* Mise en forme autorisée dans les libellés #Dièse */
  small { font-size: .86em; opacity: .75; font-weight: inherit; }
  mark { background: rgba(255,149,0,.22); color: inherit; border-radius: 4px; padding: 0 3px; }
  sub, sup { font-size: .72em; line-height: 0; }
  s, strike { opacity: .7; }
  /* Lecture humaine du rule_type */
  .doc-box {
    position: relative; background: rgba(0,113,227,.07); border: none;
    border-left: 3px solid #0071e3; padding: 11px 14px; border-radius: 0 10px 10px 0; margin: 8px 0 14px 0;
  }
  .doc-box .doc-title {
    color: #0071e3; font-weight: 600; font-size: 10px; text-transform: none;
    letter-spacing: -.005em; margin-bottom: 4px; padding-right: 78px;
  }
  .doc-box .doc-text { font-size: 12.5px; line-height: 1.55; }
  .doc-box .doc-en { color: #6e6e73; font-size: 11px; font-style: normal; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,.07); }
  .doc-box .kb-link {
    position: absolute; top: 10px; right: 12px; background: #fff; color: #0071e3;
    padding: 3px 10px; border-radius: 999px; font-size: 10px; text-decoration: none;
    border: none; font-weight: 550; box-shadow: 0 1px 2px rgba(0,0,0,.10);
  }
  /* Affectations */
  .affect-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; margin: 6px 0; }
  .affect-grid .affect {
    background: #f5f5f7; border: none; padding: 3px 10px; border-radius: 999px;
    font-size: 10.5px; display: flex; align-items: center; gap: 5px; min-width: 0; font-weight: 500;
  }
  .affect-grid .affect.bold { background: rgba(255,149,0,.14); color: #9a5b00; font-weight: 600; }
  .affect-grid .affect .num { color: #8e8e93; font-size: 9.5px; font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; flex-shrink: 0; }
  .affect-grid .affect .lib { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Paramètres */
  .params { background: #fafafc; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; padding: 0; margin: 6px 0; overflow: hidden; }
  .params .pline { padding: 5px 12px; border-bottom: 1px solid rgba(0,0,0,.05); display: grid; grid-template-columns: 168px 1fr; gap: 10px; align-items: baseline; }
  .params .pline:last-child { border-bottom: none; }
  .params .pline.formula { grid-template-columns: 1fr; padding: 7px 12px; }
  .params .pline.formula .pkey { margin-bottom: 4px; }
  .params .pkey { color: #6e6e73; font-size: 9.5px; font-weight: 600; text-transform: none; letter-spacing: -.005em; line-height: 1.45; }
  .params .pval { color: #1d1d1f; font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 11px; word-break: break-word; line-height: 1.5; }
  .params .pval.formula {
    color: #0a4a8f; background: rgba(0,113,227,.07); padding: 6px 9px;
    border-left: 2px solid #0071e3; border-radius: 0 8px 8px 0; white-space: pre-wrap;
  }
  .params .pval.empty { color: #a1a1a6; font-style: normal; font-family: inherit; }
  /* Tableau de seuils */
  .params table.thresh { border-collapse: collapse; font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 10.5px; margin: 0; }
  .params table.thresh th {
    text-align: left; background: transparent; padding: 2px 8px; border: none;
    border-bottom: 1px solid rgba(0,0,0,.10); font-size: 9px; text-transform: none;
    letter-spacing: 0; font-weight: 600; color: #6e6e73;
  }
  .params table.thresh td { padding: 3px 8px; border: none; border-bottom: 1px solid rgba(0,0,0,.05); }
  .params table.thresh td.tval { color: #0a4a8f; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  /* Pastilles types de jour */
  .dt-chip {
    display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px;
    font-size: 10px; margin: 0 2px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    border: 1px solid rgba(0,0,0,.08); font-weight: 500;
  }
  .dt-chip .num { opacity: .6; font-size: 9px; margin-right: 4px; }
  /* Spec officielle */
  .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; margin: 6px 0; }
  .spec-grid .spec-item {
    background: #fafafc; border: 1px solid rgba(0,0,0,.06); padding: 3px 10px; border-radius: 8px;
    font-size: 10.5px; display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0;
  }
  .spec-grid .spec-item.mand { background: rgba(255,149,0,.12); border-color: rgba(255,149,0,.28); }
  .spec-grid .spec-item .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spec-grid .spec-item .spec-mand { color: #b26a00; font-weight: 700; }
  .spec-grid .spec-item .spec-editor { color: #8e8e93; font-size: 9.5px; font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; flex-shrink: 0; }
  /* Dépendances */
  .deps-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 6px; }
  .deps-row .deps-col h3 {
    font-size: 10px; margin: 0 0 5px 0; color: #6e6e73; text-transform: none;
    letter-spacing: -.005em; font-weight: 600; border: none; padding: 0;
  }
  .deps-row .deps-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .deps-row .deps-list .dep {
    background: rgba(0,113,227,.09); color: #0071e3; padding: 3px 10px; border-radius: 999px;
    font-size: 10.5px; border: none; display: inline-flex; gap: 5px; align-items: center; font-weight: 500;
  }
  .deps-row .deps-list .dep .num { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-weight: 600; font-size: 10px; }
  .deps-row .deps-list .dep .lib { color: #1d1d1f; font-weight: 450; }
  .empty { color: #a1a1a6; font-style: normal; font-size: 10.5px; padding: 1px 4px; }
  footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,.08); color: #8e8e93; font-size: 9.5px; line-height: 1.5; }
  @media print {
    body { padding: 8mm 10mm; max-width: none; font-size: 11.5px; }
    h2 { page-break-after: avoid; }
    .params .pline, .deps-row, .affect-grid .affect, .spec-grid .spec-item { page-break-inside: avoid; }
    .doc-box, .params, .spec-grid, .deps-row { page-break-inside: avoid; }
    footer { page-break-before: auto; }
  }
</style>
</head>
<body>
<div class="doc-brand"><img src="${BRAND_LOGO.light}" alt="it4culture"></div>
<h1>${richText(r.libelle || '')}</h1>
${r.libelle_court && r.libelle_court !== r.libelle ? `<div class="meta-sub">${richText(r.libelle_court)}</div>` : ''}
<div class="pills">
  <span class="pill code">#${r.id}</span>
  <span class="pill code">${esc(r.rule_type || '')}</span>
  ${r.code ? `<span class="pill">${L('code : ', 'code: ')}${esc(r.code)}</span>` : ''}
  ${r.compteur ? `<span class="pill counter">${L('Compteur paie', 'Payroll counter')}</span>` : `<span class="pill">${L('Intermédiaire', 'Intermediate')}</span>`}
  ${r.periode ? `<span class="pill">${L('Période : ', 'Period: ')}${esc(r.periode)}</span>` : ''}
  ${r.ordre != null ? `<span class="pill">${L('Ordre : ', 'Order: ')}${r.ordre}</span>` : ''}
</div>
${(interp || doc || (spec && (spec.description_en || spec.kb_link))) ? `<div class="doc-box">
  ${spec && spec.kb_link ? `<a class="kb-link" href="${esc(spec.kb_link)}" target="_blank" rel="noopener">Doc #Dièse ↗</a>` : ''}
  ${noRead ? '' : `<div class="doc-title">${esc(human ? L('Ce que fait la règle', 'What the rule calculates') : interp ? L('Que fait cette formule ?', 'What does this formula do?') : (doc ? doc.title : (r.rule_type || 'Description')))}</div>`}
  ${noRead
    ? `<div class="doc-text" style="color:#6e6e73">${L('Formule trop imbriquée pour une lecture automatique fiable — voir le bloc « Paramètres » ci-dessous.', 'Formula too nested for a reliable automatic reading — see the “Settings” block below.')}</div>`
    : `<div class="doc-text">${esc(interp || (doc && doc.desc) || (spec && spec.description_en) || L('Description française non disponible.', 'No description available.'))}</div>`}
  ${(!noRead && spec && spec.description_en && doc && I18N.lang !== 'en') ? `<div class="doc-en">${esc(spec.description_en)}</div>` : ''}
  ${interp && !human ? `<div class="doc-en">${L('Source : ', 'Source: ')}${esc(doc ? doc.title : L('Formule de calcul', 'Calculation formula'))} · ${L('analyse statique', 'static analysis')}</div>` : ''}
</div>` : ''}
<h2>${L('Affectations', 'Assignments')}</h2>
${affectations.length
  ? `<div class="affect-grid">${affectations.map(a => `<div class="affect ${a.bold ? 'bold' : ''}"><span class="num">#${esc(a.id)}</span><span class="lib">${esc(a.lib)}</span></div>`).join('')}</div>`
  : `<div class="empty">${L('Aucune affectation', 'No assignment')}</div>`}
<h2>${L('Paramètres', 'Settings')}</h2>
${paramsBlocks || `<div class="empty">${L('Aucun paramètre', 'No setting')}</div>`}
${(spec && spec.params && spec.params.length) ? `<h2>${L('Spec officielle', 'Official spec')} (${spec.params.length}) · * = ${L('obligatoire', 'required')}</h2>
<div class="spec-grid">${spec.params.map(p => `<div class="spec-item${p.mandatory ? ' mand' : ''}"><span class="label">${esc(p.label)}${p.mandatory ? ' <span class="spec-mand">*</span>' : ''}</span><span class="spec-editor">${esc(p.editor || '')}</span></div>`).join('')}</div>` : ''}
<h2>${L('Dépendances', 'Dependencies')}</h2>
<div class="deps-row">
  <div class="deps-col">
    <h3>${L('Amont (dépend de)', 'Upstream (depends on)')}</h3>
    ${deps.length
      ? `<div class="deps-list">${deps.map(d => `<span class="dep"><span class="num">#${d.id}</span><span class="lib">${d.lib}</span></span>`).join('')}</div>`
      : '<div class="empty">Aucune</div>'}
  </div>
  <div class="deps-col">
    <h3>${L('Aval (utilisée par)', 'Downstream (used by)')}</h3>
    ${rdeps.length
      ? `<div class="deps-list">${rdeps.map(d => `<span class="dep"><span class="num">#${d.id}</span><span class="lib">${d.lib}</span></span>`).join('')}</div>`
      : '<div class="empty">Aucune</div>'}
  </div>
</div>
<footer>${L(`Rapport généré le ${esc(generatedAt)} par l'Atelier GTA #Dièse.`, `Report generated on ${esc(generatedAt)} by the #Dièse GTA Atelier.`)}</footer>
</body>
</html>`;
  },

  buildExportParams(params) {
    if (!params) return '';
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const blocks = String(params).split('\n').map(line => {
      if (!line.trim()) return '';
      const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
      if (!m) return `<div class="pline"><div class="pval">${esc(line)}</div></div>`;
      const rawKey = m[1].trim();
      const rawVal = m[2].trim();
      const isFormula = /^_\d+_.*Formula/i.test(rawKey);
      const displayKey = isFormula ? 'Formule' : rawKey;
      if (!rawVal || rawVal === '-') {
        return `<div class="pline"><div class="pkey">${esc(displayKey)}</div><div class="pval empty">— ${L('(non défini)', '(not set)')}</div></div>`;
      }
      if (typeof DT_KEYS_NUMERIC !== 'undefined' && DT_KEYS_NUMERIC.has(rawKey)) {
        const chips = rawVal.split(',').map(tok => {
          const t = tok.trim();
          if (!/^\d+$/.test(t)) return esc(tok);
          const id = parseInt(t, 10);
          const dt = STATE.dayTypes.get(id);
          if (dt) return `<span class="dt-chip" style="background:${dt.hex_bg};color:${dt.hex_fg}"><span class="num">#${id}</span>${richText(dt.libelle_court || dt.libelle || '')}</span>`;
          return `<span class="dt-chip"><span class="num">#${id}</span>?</span>`;
        }).join('');
        return `<div class="pline"><div class="pkey">${esc(displayKey)}</div><div class="pval">${chips}</div></div>`;
      }
      if (/^Thresholds?\*?$/i.test(rawKey) || /^Seuils?\*?$/i.test(rawKey)) {
        const rows = decodeThresholds(rawVal);
        if (rows.length) {
          const trs = rows.map(r => `<tr><td>${r.from}</td><td>${r.to}</td><td class="tval">${r.value}</td></tr>`).join('');
          return `<div class="pline"><div class="pkey">${esc(displayKey)}</div><div class="pval"><table class="thresh"><thead><tr><th>${L('de', 'from')}</th><th>${L('à', 'to')}</th><th>${L('valeur', 'value')}</th></tr></thead><tbody>${trs}</tbody></table></div></div>`;
        }
      }
      let displayVal;
      const lineClass = isFormula ? 'pline formula' : 'pline';
      if (isFormula) {
        const pretty = prettyFormula(rawVal);
        let s = esc(pretty);
        s = s.replace(/rule(\d+)/g, (mm, n) => {
          const nid = parseInt(n, 10);
          const ru = STATE.byId.get(nid);
          if (!ru) return `<span style="color:#cf222e">rule${n} ${L('(absent)', '(missing)')}</span>`;
          return `<span style="color:#0a4a8f;background:rgba(0,113,227,.09);padding:1px 5px;border-radius:5px"><span style="font-size:10.5px;opacity:.75">#${n}</span> ${richText(ru.libelle_court || ru.libelle || '')}</span>`;
        });
        s = s.replace(/htime(\d+)/g, (mm, n) => {
          const nid = parseInt(n, 10);
          if (nid === 0) return `<span style="background:#f6f8fa;padding:0 4px;border-radius:3px">htime0 <span style="font-size:10.5px;color:#656d76">${L('(h. standard)', '(standard h.)')}</span></span>`;
          const dt = STATE.dayTypes.get(nid);
          const tip = dt ? esc(plainText(dt.libelle_court || dt.libelle || '')) : `${L('type', 'type')} ${nid}`;
          const bg = dt && dt.hex_bg ? dt.hex_bg : '#f6f8fa';
          const fg = dt && dt.hex_fg ? dt.hex_fg : '#1a1a1a';
          return `<span style="background:${bg};color:${fg};padding:0 4px;border-radius:3px">htime${n} <span style="font-size:10.5px;opacity:.75">${tip}</span></span>`;
        });
        displayVal = `<div class="pval formula">${s}</div>`;
      } else {
        let s = esc(rawVal);
        s = s.replace(/rule(\d+)/g, (mm, n) => {
          const nid = parseInt(n, 10);
          const ru = STATE.byId.get(nid);
          if (!ru) return `<span style="color:#cf222e">rule${n} ${L('(absent)', '(missing)')}</span>`;
          return `<span style="color:#0a4a8f">rule${n}</span> <span style="font-size:11px;color:#6e6e73">(${richText(ru.libelle_court || ru.libelle || '')})</span>`;
        });
        displayVal = `<div class="pval">${s}</div>`;
      }
      return `<div class="${lineClass}"><div class="pkey">${esc(displayKey)}</div>${displayVal}</div>`;
    }).filter(Boolean);
    return blocks.length ? `<div class="params">${blocks.join('')}</div>` : '';
  }
};
