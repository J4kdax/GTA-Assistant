/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 5. GRAPH BUILDER
 * ========================================================================*/
const Graph = {
  loadDataset({rules}) {
    // Index, deps, rdeps
    STATE.rules = rules.map(r => ({...r}));
    STATE.byId = new Map(STATE.rules.map(r => [r.id, r]));
    const ids = new Set(STATE.rules.map(r => r.id));
    const edges = [];
    for (const r of STATE.rules) {
      r.deps = Array.isArray(r.deps) ? r.deps : [];   // calculées par le moteur
      r.dtRefs = Parser.extractDayTypeRefs(r.parametres);
      // Convention visuelle : la flèche part de la règle source vers la règle qui la consomme.
      for (const d of r.deps) if (ids.has(d)) edges.push({from:d, to:r.id});
    }
    STATE.edges = edges;
    const rdep = new Map();
    for (const r of STATE.rules) rdep.set(r.id, []);
    for (const e of edges) rdep.get(e.from).push(e.to);
    for (const r of STATE.rules) r.rdeps = rdep.get(r.id);

    // Couleurs par rule_type
    const types = [...new Set(STATE.rules.map(r => r.rule_type))].sort();
    STATE.typeColor = new Map();
    const pal = palette();
    types.forEach((t,i) => STATE.typeColor.set(t, pal[i % pal.length]));
    STATE.activeTypes = new Set(types);

    // Filtre affectations
    const affectSet = new Set();
    for (const r of STATE.rules) {
      if (r.affectations) {
        for (const line of String(r.affectations).split(/\n/)) {
          const m = line.match(/(.+?)\s*\(#\d+\)/);
          if (m) affectSet.add(m[1].replace(/<[^>]+>/g,'').trim());
        }
      }
    }
    const affSel = document.getElementById('filter-affect');
    affSel.innerHTML = `<option value="">${L('— Toutes les affectations —', '— All assignments —')}</option>` +
      [...affectSet].sort().map(a=>`<option value="${escapeAttr(a)}">${escapeHtml(a)}</option>`).join('');

    // Construction des datasets vis
    const visNodes = STATE.rules.map(r => Graph.makeRuleNode(r));
    const visEdges = edges.map((e,i) => Graph.makeRuleEdge(e, i));

    STATE.nodeDS = new vis.DataSet(visNodes);
    STATE.edgeDS = new vis.DataSet(visEdges);

    Graph.paintStats();

    // Cache l'écran d'accueil dès qu'un dataset est chargé
    const welcome = document.getElementById('welcome-overlay');
    if (welcome) welcome.hidden = true;

    UI.renderLegend();
    Graph.create();
    Graph.stabilizeAndLock();
    if (typeof BrokenRefs !== 'undefined') BrokenRefs.render();
    if (typeof Optimizations !== 'undefined') Optimizations.render();
  },

  loadDayTypes(dts) {
    STATE.dayTypes = new Map(dts.map(d => [d.id, d]));
    UI.renderDayTypePanel();
    Graph.paintStats();
    if (STATE.showDtLayer) Graph.refreshDayTypeLayer();
    if (STATE.selected) UI.renderDetail(STATE.byId.get(STATE.selected));
  },

  paintStats() {
    const n = STATE.rules.length, e = STATE.edges.length, d = STATE.dayTypes.size;
    document.getElementById('stats').textContent =
      Ln(n, 'règle', 'règles', 'rule', 'rules') + ' · ' +
      Ln(e, 'dépendance', 'dépendances', 'dependency', 'dependencies') +
      (d ? ' · ' + Ln(d, 'type de jour', 'types de jour', 'day type', 'day types') : '');
  },

  makeRuleNode(r) {
    const color = STATE.typeColor.get(r.rule_type) || '#888';
    const label = `#${r.id} ${plainText(r.libelle_court || r.libelle || '')}`;
    return {
      id: r.id,
      label,
      title: htmlTooltip(`<b>#${r.id} · ${richText(r.libelle || '')}</b><br>${escapeHtml(r.rule_type || '')}<br>${(r.deps && r.deps.length) ? L('Dépend de : ', 'Depends on: ')+r.deps.map(d => '#'+d).join(', ') : L('Aucune dépendance', 'No dependency')}`),
      color: { background: color, border: THEME.nodeBorder(color), highlight:{background:color, border:THEME.t.hl} },
      font: {color:THEME.t.nodeFont, strokeWidth:THEME.t.nodeStrokeW, strokeColor:THEME.t.nodeStroke},
      _kind: 'rule'
    };
  },

  makeRuleEdge(e, i) {
    return {id:'e'+i, from:e.from, to:e.to,
      arrows:{ to:{enabled:false}, middle:{enabled:true, scaleFactor:.7, type:'arrow'} },
      color:{color:THEME.t.edge, highlight:THEME.t.hl},
      smooth:{type:'cubicBezier'}};
  },

  makeDayTypeNode(dt) {
    return {
      id: 'dt-' + dt.id,
      label: `#${dt.id} ${plainText(dt.libelle_court || dt.libelle || '')}`,
      shape: 'box',
      color: { background: dt.hex_bg || '#888', border: shade(dt.hex_bg || '#888',-25), highlight:{background: dt.hex_bg || '#888', border:THEME.t.hl} },
      // Pas d'entourage sombre (strokeWidth) : ces nœuds ont déjà un fond coloré
      // qui donne le contraste nécessaire. Le stroke hérité des règles de type
      // "dot" (fond sombre) rendait le texte flou/peu lisible ici.
      font: {color: dt.hex_fg || '#000', size:11, strokeWidth:0, face:'-apple-system,sans-serif'},
      title: htmlTooltip(`<b>${L('Type de jour', 'Day type')} #${dt.id} · ${richText(dt.libelle || '')}</b><br>${escapeHtml(dt.categorie || '')}`),
      _kind: 'daytype'
    };
  },

  refreshDayTypeLayer() {
    if (!STATE.nodeDS) return;
    // 1. retire les nœuds et arêtes types de jour existants (sans toucher aux règles)
    const toRemoveN = [], toRemoveE = [];
    STATE.nodeDS.forEach(n => { if (n._kind === 'daytype') toRemoveN.push(n.id); });
    STATE.edgeDS.forEach(e => { if (typeof e.id === 'string' && e.id.startsWith('dte-')) toRemoveE.push(e.id); });
    STATE.nodeDS.remove(toRemoveN);
    STATE.edgeDS.remove(toRemoveE);
    if (!STATE.showDtLayer || !STATE.dayTypes.size) return;

    // 2. collecte des ids de types de jour référencés
    const refIds = new Set();
    for (const r of STATE.rules) for (const id of (r.dtRefs || [])) refIds.add(id);
    if (!refIds.size) return;

    // 3. positions actuelles des règles (figées)
    const positions = STATE.network ? STATE.network.getPositions() : {};
    // centre du graphe (moyenne des positions règles)
    let gcx = 0, gcy = 0, gn = 0;
    for (const r of STATE.rules) {
      const p = positions[r.id];
      if (p) { gcx += p.x; gcy += p.y; gn++; }
    }
    gcx = gn ? gcx/gn : 0;
    gcy = gn ? gcy/gn : 0;

    // 4. position déterministe par type de jour : centroïde des consommateurs
    //    poussé vers l'extérieur du graphe (effet halo) pour ne pas masquer les règles.
    const OUT = 380;  // décalage radial
    const newNodes = [];
    for (const id of refIds) {
      const dt = STATE.dayTypes.get(id) || {id, libelle:`Inconnu (#${id})`, libelle_court:`#${id}`, hex_bg:'#444', hex_fg:'#aaa'};
      const consumers = STATE.rules.filter(r => (r.dtRefs||[]).includes(id));
      let cx = 0, cy = 0, n = 0;
      for (const c of consumers) {
        const p = positions[c.id];
        if (p) { cx += p.x; cy += p.y; n++; }
      }
      cx = n ? cx/n : gcx;
      cy = n ? cy/n : gcy;
      // vecteur depuis le centre du graphe vers le centroïde des consommateurs
      let dx = cx - gcx, dy = cy - gcy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const tx = cx + dx * OUT;
      const ty = cy + dy * OUT;
      const node = Graph.makeDayTypeNode(dt);
      node.x = tx; node.y = ty;
      node.fixed = {x:true, y:true};
      node.physics = false;
      newNodes.push(node);
    }
    STATE.nodeDS.add(newNodes);

    // 5. arêtes pointillées rule -> day type, sans déclencher de re-layout
    let i = 0;
    const newEdges = [];
    for (const r of STATE.rules) {
      for (const id of (r.dtRefs || [])) {
        if (!refIds.has(id)) continue;
        newEdges.push({id:'dte-'+(i++), from:r.id, to:'dt-'+id,
          arrows:{ to:{enabled:false}, middle:{enabled:true, scaleFactor:.6, type:'arrow'} },
          dashes:true, color:{color:THEME.t.edgeDt, highlight:THEME.t.hl},
          smooth:{type:'cubicBezier'}, physics:false});
      }
    }
    STATE.edgeDS.add(newEdges);
  },

  create() {
    if (STATE.network) STATE.network.destroy();
    // libère les positions pour que le solveur de stabilisation place les règles
    if (STATE.nodeDS) {
      const reset = [];
      STATE.nodeDS.forEach(n => {
        if (n._kind === 'daytype') return; // les types de jour seront repositionnés ensuite
        reset.push({id:n.id, x:null, y:null, fixed:false, physics:true});
      });
      if (reset.length) STATE.nodeDS.update(reset);
    }
    const container = document.getElementById('graph-canvas');
    const options = {
      nodes: { shape:'dot', size:15,
               font:{color:THEME.t.nodeFont, size:11.5, face:'-apple-system,BlinkMacSystemFont,sans-serif', strokeWidth:THEME.t.nodeStrokeW, strokeColor:THEME.t.nodeStroke},
               borderWidth:2, borderWidthSelected:4, shadow:THEME.t.shadow },
      edges: { width:1, arrows:{ to:{enabled:false}, middle:{enabled:true, scaleFactor:.7, type:'arrow'} } },
      interaction: {
        hover:true, tooltipDelay:200, navigationButtons:false,
        hideEdgesOnDrag:false, dragNodes:false  // <-- on n'autorise pas le déplacement manuel
      },
      layout: { hierarchical:false, improvedLayout:true },
      physics: {
        enabled:true,
        solver:'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant:-180,    // plus de répulsion -> plus d'espace
          centralGravity:.005,
          springLength:200,              // ressorts plus longs -> règles plus écartées
          springConstant:.10,
          avoidOverlap:.6
        },
        stabilization:{ enabled:true, iterations:600, fit:true }
      }
    };
    STATE.network = new vis.Network(container, {nodes:STATE.nodeDS, edges:STATE.edgeDS}, options);
    STATE.network.on('click', UI.onClick);
    STATE.network.on('doubleClick', () => { STATE.selected = null; UI.refreshHighlights(); UI.renderDetail(null); });
  },

  // Lance la stabilisation puis fige toutes les positions des règles.
  // À partir de ce moment, plus rien ne bouge dans le graphe — les ajouts
  // (couche types de jour) sont positionnés explicitement.
  stabilizeAndLock() {
    if (!STATE.network) return;
    STATE.stabilized = false;
    const onDone = () => {
      const pos = STATE.network.getPositions();
      const upd = [];
      STATE.nodeDS.forEach(n => {
        if (n._kind === 'daytype') return;
        const p = pos[n.id];
        if (p) upd.push({id:n.id, x:p.x, y:p.y, fixed:{x:true,y:true}, physics:false});
      });
      STATE.nodeDS.update(upd);
      // Désactive complètement la physique : aucune itération ne se relancera.
      STATE.network.setOptions({ physics:{enabled:false}, interaction:{dragNodes:false, hover:true, tooltipDelay:200} });
      STATE.stabilized = true;
      // Recadre proprement
      try { STATE.network.fit({animation:{duration:300}}); } catch(_){}
      // Si la couche types de jour était activée, la repositionner par rapport aux règles figées
      if (STATE.showDtLayer) Graph.refreshDayTypeLayer();
      // Rétablit les filtres et highlights
      UI.applyFilters();
    };
    STATE.network.once('stabilizationIterationsDone', onDone);
    // Failsafe : si l'évènement ne se déclenche pas, on force au bout de 4s
    setTimeout(() => { if (!STATE.stabilized) onDone(); }, 4000);
    STATE.network.stabilize();
  }
};
