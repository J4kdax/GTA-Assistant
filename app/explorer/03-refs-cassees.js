/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 2.b BROKEN REFS — détection des références ruleN cassées
 * Affiche un indicateur permanent dans l'en-tête + popover détaillé.
 * ========================================================================*/
const BrokenRefs = {
  list: [],

  compute() {
    if (!STATE.rules || !STATE.rules.length) return [];
    const ids = new Set(STATE.rules.map(r => r.id));
    const out = [];
    for (const r of STATE.rules) {
      if (!r.parametres) continue;
      const seen = new Set();
      for (const m of String(r.parametres).matchAll(/rule(\d+)/g)) {
        const t = parseInt(m[1], 10);
        if (!ids.has(t) && !seen.has(t)) {
          seen.add(t);
          out.push({ from: r.id, fromLib: r.libelle_court || r.libelle || '', to: t });
        }
      }
    }
    BrokenRefs.list = out;
    return out;
  },

  render() {
    const list = BrokenRefs.compute();
    const ind = document.getElementById('indicator-anom');
    if (!ind) return;
    const ico = ind.querySelector('.ind-icon');
    const txt = ind.querySelector('.ind-text');
    if (list.length === 0) {
      ind.classList.remove('warn');
      ico.textContent = '✓';
      txt.textContent = L('Aucun appel caduc', 'No broken reference');
      ind.title = L('Aucune référence ruleN cassée — la chaîne de calcul est complète.', 'No broken ruleN reference — the calculation chain is complete.');
    } else {
      ind.classList.add('warn');
      ico.textContent = '⚠';
      txt.textContent = Ln(list.length, 'appel caduc', 'appels caducs', 'broken reference', 'broken references');
      ind.title = L(`${list.length} référence${list.length>1?'s':''} ruleN qui pointe${list.length>1?'nt':''} vers une règle inexistante. Cliquez pour détailler.`,
                    `${list.length} ruleN reference${list.length>1?'s':''} pointing to a rule that does not exist. Click for details.`);
    }
    const stats = document.getElementById('anom-pop-stats');
    const pop = document.getElementById('indicator-anom-list');
    if (!pop) return;
    if (stats) stats.textContent = list.length === 0 ? '' : Ln(list.length, 'référence cassée', 'références cassées', 'broken reference', 'broken references');
    if (list.length === 0) {
      pop.innerHTML = `<div class="br-empty">✓ ${L('Aucune référence vers une règle inexistante.', 'No reference to a rule that does not exist.')}</div>`;
      return;
    }
    const sorted = list.slice().sort((a, b) => a.from - b.from || a.to - b.to);
    pop.innerHTML = sorted.map(b => `<div class="br-item" data-jump="${b.from}">
      <span class="br-from">#${b.from}</span>
      <span class="br-from-lib" title="${escapeAttr(b.fromLib)}">${escapeHtml(b.fromLib)}</span>
      <span class="br-arrow">→</span>
      <span class="br-to">rule${b.to}</span>
      <span style="color:var(--muted);font-size:11px">(introuvable)</span>
    </div>`).join('');
    pop.querySelectorAll('.br-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.jump, 10);
        if (Number.isFinite(id)) UI.jumpTo(id);
        BrokenRefs.close();
      });
    });
  },

  open() {
    BrokenRefs.render();
    document.getElementById('indicator-anom-panel').hidden = false;
  },
  close() {
    const p = document.getElementById('indicator-anom-panel');
    if (p) p.hidden = true;
  },
  toggle() {
    const pop = document.getElementById('indicator-anom-panel');
    if (pop.hidden) BrokenRefs.open(); else BrokenRefs.close();
  }
};
