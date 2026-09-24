/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 2.c OPTIMIZATIONS — détection des optimisations possibles sur les formules
 *  - identical: deux règles avec exactement le même corps de formule
 *  - constant : if(cond | then || else) avec then == else => résultat constant
 *  - repeated : sous-expression ruleN±ruleM±... apparaissant dans 3+ formules
 *  - deep     : profondeur d'imbrication if() supérieure ou égale à 3
 * ========================================================================*/
const Optimizations = {
  cats: { identical: [], constant: [], repeated: [], deep: [] },
  totalFormulas: 0,

  isFormulaType(rt) { return /Formula/i.test(rt || ''); },

  // Le corps d'une règle formule est la valeur après "<rule_type> : "
  body(r) {
    if (!r.parametres) return null;
    const m = String(r.parametres).match(/^[^:]+:\s*([\s\S]*)$/);
    return m ? m[1].trim() : null;
  },

  norm(b) { return (b || '').replace(/\s+/g, '').toLowerCase(); },

  // (1) Formules identiques entre règles
  identicalFormulas(formulas) {
    const groups = new Map();
    for (const f of formulas) {
      const key = Optimizations.norm(f.body);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    return [...groups.values()]
      .filter(arr => arr.length >= 2)
      .map(arr => ({ body: arr[0].body, count: arr.length, rules: arr }))
      .sort((a, b) => b.count - a.count);
  },

  // (2) Branches if(cond | then || else) avec then == else
  findConstantIfs(formula) {
    if (!formula) return [];
    const out = [];
    for (let i = 0; i <= formula.length - 3; i++) {
      if (formula.slice(i, i + 3) !== 'if(') continue;
      let d = 1, j = i + 3;
      while (j < formula.length && d > 0) {
        if (formula[j] === '(') d++;
        else if (formula[j] === ')') { d--; if (d === 0) break; }
        j++;
      }
      if (d !== 0) continue;
      const inner = formula.slice(i + 3, j);
      // Repère le premier `|` de profondeur 0 (NON suivi d'un autre `|`) puis le `||` suivant
      let dd = 0, p1 = -1, p2 = -1, k = 0;
      while (k < inner.length) {
        const c = inner[k];
        if (c === '(') dd++;
        else if (c === ')') dd--;
        else if (dd === 0 && c === '|') {
          if (k + 1 < inner.length && inner[k + 1] === '|') {
            if (p1 !== -1 && p2 === -1) { p2 = k; break; }
            k++; // saute le 2e |
          } else if (p1 === -1) {
            p1 = k;
          }
        }
        k++;
      }
      if (p1 !== -1 && p2 !== -1) {
        const thenE = inner.slice(p1 + 1, p2).trim();
        const elseE = inner.slice(p2 + 2).trim();
        if (thenE !== '' && thenE === elseE) {
          out.push({ snippet: 'if(' + inner + ')', value: thenE });
        }
      }
    }
    return out;
  },

  constantBranches(formulas) {
    const out = [];
    for (const f of formulas) {
      const matches = Optimizations.findConstantIfs(f.body);
      for (const m of matches) {
        out.push({ ruleId: f.id, libelle: f.libelle, snippet: m.snippet, value: m.value });
      }
    }
    return out;
  },

  // (3) Sous-expressions ruleN±ruleM±... apparaissant dans 3+ formules
  repeatedSubExpressions(formulas) {
    const counter = new Map();
    for (const f of formulas) {
      const body = (f.body || '').replace(/\s+/g, '');
      const re = /rule\d+(?:[+\-]rule\d+)+/g;
      let m;
      while ((m = re.exec(body)) !== null) {
        const chain = m[0];
        // Découpe en tokens en gardant les opérateurs au début du token suivant : ['rule5','+rule6','-rule17']
        const tokens = chain.split(/(?=[+\-])/);
        for (let len = 2; len <= tokens.length; len++) {
          for (let start = 0; start + len <= tokens.length; start++) {
            let sub = tokens.slice(start, start + len).join('');
            if (sub.startsWith('+')) sub = sub.slice(1);
            if (!counter.has(sub)) counter.set(sub, new Set());
            counter.get(sub).add(f.id);
          }
        }
      }
    }
    const repeated = [];
    for (const [sub, ids] of counter) {
      if (ids.size >= 3) {
        const ruleCount = (sub.match(/rule\d+/g) || []).length;
        repeated.push({ expr: sub, ruleCount, count: ids.size, formulas: [...ids].sort((a, b) => a - b) });
      }
    }
    repeated.sort((a, b) => b.ruleCount - a.ruleCount || b.count - a.count);
    // Élimine les sous-expressions strictement contenues dans une plus longue à count identique
    const filtered = [];
    for (const item of repeated) {
      const covered = filtered.some(parent => parent.expr.includes(item.expr) && parent.count === item.count);
      if (!covered) filtered.push(item);
    }
    return filtered.slice(0, 20);
  },

  // (4) Profondeur d'imbrication if()
  ifDepth(formula) {
    if (!formula) return 0;
    let depth = 0, max = 0;
    const stack = [];
    for (let i = 0; i < formula.length; i++) {
      if (i + 2 < formula.length && formula.slice(i, i + 3) === 'if(') {
        stack.push('if');
        depth++;
        if (depth > max) max = depth;
        i += 2;
      } else if (formula[i] === '(') {
        stack.push('(');
      } else if (formula[i] === ')') {
        const top = stack.pop();
        if (top === 'if') depth--;
      }
    }
    return max;
  },

  deepFormulas(formulas, threshold) {
    threshold = threshold || 3;
    const out = [];
    for (const f of formulas) {
      const d = Optimizations.ifDepth(f.body);
      if (d >= threshold) out.push({ ruleId: f.id, libelle: f.libelle, depth: d, length: (f.body || '').length });
    }
    return out.sort((a, b) => b.depth - a.depth || b.length - a.length).slice(0, 20);
  },

  compute() {
    const formulas = (STATE.rules || [])
      .filter(r => Optimizations.isFormulaType(r.rule_type))
      .map(r => ({
        id: r.id,
        libelle: r.libelle_court || r.libelle || '',
        type: r.rule_type,
        body: Optimizations.body(r)
      }))
      .filter(f => f.body);
    Optimizations.totalFormulas = formulas.length;
    Optimizations.cats = {
      identical: Optimizations.identicalFormulas(formulas),
      constant: Optimizations.constantBranches(formulas),
      repeated: Optimizations.repeatedSubExpressions(formulas),
      deep: Optimizations.deepFormulas(formulas)
    };
    return Optimizations.cats;
  },

  render() {
    Optimizations.compute();
    const ind = document.getElementById('indicator-opti');
    if (!ind) return;
    const c = Optimizations.cats;
    const total = c.identical.length + c.constant.length + c.repeated.length + c.deep.length;
    const ico = ind.querySelector('.ind-icon');
    const txt = ind.querySelector('.ind-text');
    if (total === 0 || Optimizations.totalFormulas === 0) {
      ind.classList.remove('info');
      ico.textContent = '✓';
      txt.textContent = L('Aucune piste d\'optimisation', 'No optimisation hint');
      ind.title = Optimizations.totalFormulas === 0
        ? L('Aucune règle de type formule dans le dataset.', 'No formula rule in the dataset.')
        : L('Aucune piste d\'optimisation détectée sur les formules.', 'No optimisation hint found in the formulas.');
    } else {
      ind.classList.add('info');
      ico.textContent = 'ℹ';
      const parts = [];
      if (c.identical.length) parts.push(`${c.identical.length} ident.`);
      if (c.constant.length) parts.push(`${c.constant.length} const.`);
      if (c.repeated.length) parts.push(`${c.repeated.length} factor.`);
      if (c.deep.length) parts.push(`${c.deep.length} ${L('prof.', 'depth')}`);
      txt.textContent = parts.join(' · ');
      ind.title = L(`${total} pistes d'optimisation sur ${Optimizations.totalFormulas} formules. Cliquez pour détailler.`,
                    `${total} optimisation hints across ${Optimizations.totalFormulas} formulas. Click for details.`);
    }
    Optimizations.renderPopover();
  },

  renderPopover() {
    const root = document.getElementById('indicator-opti-list');
    if (!root) return;
    const c = Optimizations.cats;
    const stats = document.getElementById('opti-pop-stats');
    if (stats) stats.textContent = Optimizations.totalFormulas + L(' formules analysées', ' formulas analysed');
    const sections = [];

    // (1) Identiques
    sections.push(`<div class="opt-section">
      <h4>${L('Formules identiques entre règles', 'Identical formulas across rules')} <span class="cnt ${c.identical.length?'has':''}">${c.identical.length}</span></h4>
      ${c.identical.length === 0 ? `<div class="opt-empty">${L('Aucune formule en doublon.', 'No duplicated formula.')}</div>` :
        c.identical.slice(0, 10).map(g => {
          const bodyShort = g.body.length > 130 ? g.body.slice(0, 130) + '…' : g.body;
          const ruleList = g.rules.slice(0, 12).map(r =>
            `<a class="opt-jump" data-jump="${r.id}" title="${escapeAttr(plainText(r.libelle))}">#${r.id}</a>`).join(' ');
          const more = g.rules.length > 12 ? ` <span style="color:var(--muted);font-size:10.5px">+${g.rules.length - 12}</span>` : '';
          return `<div class="opt-item">
            <div class="opt-meta">${L(`${g.count} règles partagent cette formule — candidat à factorisation`, `${g.count} rules share this formula — candidate for factoring`)}</div>
            <code class="opt-code">${escapeHtml(bodyShort)}</code>
            <div class="opt-jumps">${ruleList}${more}</div>
          </div>`;
        }).join('')
      }
    </div>`);

    // (2) Constantes
    sections.push(`<div class="opt-section">
      <h4>${L('Branches if(then == else) — résultat constant', 'if(then == else) branches — constant result')} <span class="cnt ${c.constant.length?'has':''}">${c.constant.length}</span></h4>
      ${c.constant.length === 0 ? `<div class="opt-empty">${L('Aucune branche if avec then == else.', 'No if branch with then == else.')}</div>` :
        c.constant.slice(0, 15).map(it => `<div class="opt-item opt-clickable" data-jump="${it.ruleId}">
          <span class="opt-rid">#${it.ruleId}</span>
          <span class="opt-lib">${richText(it.libelle)}</span>
          <code class="opt-code-inline">${escapeHtml(it.snippet.length > 80 ? it.snippet.slice(0, 80) + '…' : it.snippet)}</code>
          <span class="opt-tag">→ ${L('toujours', 'always')} ${escapeHtml(it.value)}</span>
        </div>`).join('')
      }
    </div>`);

    // (3) Sous-expressions répétées
    sections.push(`<div class="opt-section">
      <h4>${L('Sous-expressions partagées', 'Shared sub-expressions')} <span class="cnt ${c.repeated.length?'has':''}">${c.repeated.length}</span></h4>
      ${c.repeated.length === 0 ? `<div class="opt-empty">${L('Aucune sous-expression apparaissant dans 3+ formules.', 'No sub-expression found in 3+ formulas.')}</div>` :
        c.repeated.slice(0, 10).map(it => {
          const exprShort = it.expr.length > 130 ? it.expr.slice(0, 130) + '…' : it.expr;
          const ruleList = it.formulas.slice(0, 12).map(id =>
            `<a class="opt-jump" data-jump="${id}">#${id}</a>`).join(' ');
          const more = it.formulas.length > 12 ? ` <span style="color:var(--muted);font-size:10.5px">+${it.formulas.length - 12}</span>` : '';
          return `<div class="opt-item">
            <code class="opt-code">${escapeHtml(exprShort)}</code>
            <div class="opt-meta">${L(`apparaît dans ${it.count} formules · ${it.ruleCount} règles cumulées — candidate à factoriser en règle intermédiaire`, `appears in ${it.count} formulas · ${it.ruleCount} rules in total — candidate for an intermediate rule`)}</div>
            <div class="opt-jumps">${ruleList}${more}</div>
          </div>`;
        }).join('')
      }
    </div>`);

    // (4) Profondeur excessive
    sections.push(`<div class="opt-section">
      <h4>${L('Profondeur d\'imbrication ≥ 3', 'Nesting depth ≥ 3')} <span class="cnt ${c.deep.length?'has':''}">${c.deep.length}</span></h4>
      ${c.deep.length === 0 ? `<div class="opt-empty">${L('Aucune formule avec plus de 3 if imbriqués.', 'No formula with more than 3 nested ifs.')}</div>` :
        c.deep.slice(0, 15).map(it => `<div class="opt-item opt-clickable" data-jump="${it.ruleId}">
          <span class="opt-rid">#${it.ruleId}</span>
          <span class="opt-lib">${richText(it.libelle)}</span>
          <span class="opt-tag">${L(`profondeur ${it.depth} · ${it.length} caractères`, `depth ${it.depth} · ${it.length} characters`)}</span>
        </div>`).join('')
      }
    </div>`);

    root.innerHTML = sections.join('');
    root.querySelectorAll('[data-jump]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(el.dataset.jump, 10);
        if (Number.isFinite(id)) { UI.jumpTo(id); Optimizations.close(); }
      });
    });
  },

  open() {
    Optimizations.render();
    document.getElementById('indicator-opti-panel').hidden = false;
  },
  close() {
    const p = document.getElementById('indicator-opti-panel');
    if (p) p.hidden = true;
  },
  toggle() {
    const pop = document.getElementById('indicator-opti-panel');
    if (pop.hidden) Optimizations.open(); else Optimizations.close();
  }
};
