/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 2.d FORMULA ANALYZER
 * Interprète en français le contenu d'une règle _039_STD_GTA_Formula
 * en analysant sa formule, ses dépendances et les types de jour cités.
 *
 * Patterns reconnus (best-effort, non exhaustif) :
 *  - Référence unique : rule123                        -> "Reprend la valeur de [libellé]"
 *  - Somme/sous linéaire : rule1+rule2-rule3           -> "Somme de A, B, déduction faite de C"
 *  - Multiplication par taux : rule1*rate              -> "[libellé] multiplié par le taux contractuel"
 *  - Arrondi 0.5 : ceil(x*2)/2 ou floor(x*2)/2         -> "Arrondi de X au demi sup./inf."
 *  - Min/Max plafonné : min(expr, N)                   -> "[expr] plafonné(e) à N"
 *  - Conditionnelle if(cond|then||else) avec aplatissement de chaîne
 *  - Conditions courantes : weekDay=N, weekDay<6, rule>0, htime>N, field>0
 *
 * Cas non reconnu -> renvoie null, le panneau retombe sur la description
 * générique de RULE_TYPE_DOC.
 * ========================================================================*/
const FormulaAnalyzer = {
  // Extrait le corps de la formule depuis la chaîne paramètres
  extractBody(rule) {
    if (!rule || !rule.parametres) return null;
    const m = String(rule.parametres).match(/^[^:]+:\s*([\s\S]+)$/);
    if (!m) return null;
    return m[1].replace(/\s+/g, ' ').trim();
  },

  // Résout une référence ruleN vers son libellé court
  nameOfRule(n, byId) {
    const r = byId && byId.get(n);
    if (r) return plainText(r.libelle_court || r.libelle) || `règle #${n}`;
    return `règle #${n}`;
  },

  // Résout htimeN vers le nom du type de jour.
  // htimeN représente le cumul des heures (en décimal) sur les plages dont
  // l'idTypeAbsence vaut N. htime0 = heures travaillées sur plages standards
  // (sans type d'absence) ; htime8 = heures de CP posés sur la journée, etc.
  nameOfHtime(n, dayTypes) {
    if (n === 0) return 'les heures de travail standard (sans type d\'absence)';
    const dt = dayTypes && dayTypes.get(n);
    if (dt) return `les heures sur « ${plainText(dt.libelle_court || dt.libelle)} »`;
    return `les heures du type de jour #${n}`;
  },

  // Retire les parenthèses englobantes si balancées
  stripOuterParens(s) {
    s = s.trim();
    if (!s.startsWith('(') || !s.endsWith(')')) return s;
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') d++;
      else if (s[i] === ')') { d--; if (d === 0 && i < s.length - 1) return s; }
    }
    return s.slice(1, -1).trim();
  },

  // Parse if(cond|then||else) au niveau racine. Retourne {cond, then, else} ou null.
  parseTopLevelIf(f) {
    f = f.trim();
    if (!f.startsWith('if(') || !f.endsWith(')')) return null;
    let depth = 1, i = 3;
    while (i < f.length && depth > 0) {
      if (f[i] === '(') depth++;
      else if (f[i] === ')') { depth--; if (depth === 0) break; }
      i++;
    }
    if (depth !== 0 || i !== f.length - 1) return null;
    const inner = f.slice(3, i);
    let dd = 0, p1 = -1, p2 = -1, k = 0;
    while (k < inner.length) {
      const c = inner[k];
      if (c === '(') dd++;
      else if (c === ')') dd--;
      else if (dd === 0 && c === '|') {
        if (k + 1 < inner.length && inner[k+1] === '|') {
          if (p1 !== -1 && p2 === -1) { p2 = k; break; }
          k++;
        } else if (p1 === -1) p1 = k;
      }
      k++;
    }
    if (p1 === -1 || p2 === -1) return null;
    return {
      cond: inner.slice(0, p1).trim(),
      then: inner.slice(p1 + 1, p2).trim(),
      else: inner.slice(p2 + 2).trim()
    };
  },

  // Décrit en français une condition simple (best-effort).
  // Convention : la fonction NE préfixe PAS par "si " — c'est interpret() qui le fait,
  // sinon on aboutit à "Si si X" lorsqu'on concatène.
  describeCondition(c, byId, dayTypes) {
    const s = FormulaAnalyzer.stripOuterParens(c);
    const days = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    let m;
    // Temporel
    if ((m = s.match(/^weekDay\s*=\s*([1-7])$/))) {
      const d = days[parseInt(m[1], 10)];
      // article approprié : "le lundi", "le mardi"... "le dimanche"
      return `c'est ${d}`;
    }
    if (s.match(/^weekDay\s*<\s*6$/)) return `on est en semaine (lundi-vendredi)`;
    if (s.match(/^weekDay\s*<\s*7$/)) return `on est du lundi au samedi`;
    if (s.match(/^weekDay\s*>\s*5$/) || s.match(/^weekDay\s*>=\s*6$/)) return `c'est le week-end (samedi-dimanche)`;
    if (s.match(/^weekDay\s*=\s*6\s+or\s+weekDay\s*=\s*7$/i) || s.match(/^weekDay\s*=\s*7\s+or\s+weekDay\s*=\s*6$/i)) return `c'est le week-end`;
    // Règles (sans préfixe "si")
    if ((m = s.match(/^rule(\d+)\s*>\s*0$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} est positive`;
    if ((m = s.match(/^rule(\d+)\s*=\s*0$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} vaut zéro`;
    if ((m = s.match(/^rule(\d+)\s*=\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} vaut ${m[2]}`;
    if ((m = s.match(/^rule(\d+)\s*>\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} dépasse ${m[2]}`;
    if ((m = s.match(/^rule(\d+)\s*<\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} est inférieure à ${m[2]}`;
    if ((m = s.match(/^rule(\d+)\s*>=\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} atteint au moins ${m[2]}`;
    if ((m = s.match(/^rule(\d+)\s*<=\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} ne dépasse pas ${m[2]}`;
    if ((m = s.match(/^htime(\d+)\s*>\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfHtime(+m[1], dayTypes)} dépasse ${m[2]}h`;
    if ((m = s.match(/^htime(\d+)\s*<=\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfHtime(+m[1], dayTypes)} ne dépasse pas ${m[2]}h`;
    if ((m = s.match(/^fieldContact(\d+)\s*>\s*0$/))) return `le champ contact #${m[1]} est renseigné`;
    if ((m = s.match(/^field(\d+)\s*>\s*0$/))) return `le champ contrat #${m[1]} est renseigné`;
    // Conjonctions (N parts, case-insensitive)
    if (/\s+(?:and|AND)\s+/i.test(s)) {
      const parts = s.split(/\s+(?:and|AND)\s+/i).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 5) {
        const descs = parts.map(p => FormulaAnalyzer.describeCondition(p, byId, dayTypes));
        // Si une description est restée brute (avec backticks), on n'invente pas — on laisse tel quel
        return descs.join(' et ');
      }
    }
    if (/\s+(?:or|OR)\s+/i.test(s)) {
      const parts = s.split(/\s+(?:or|OR)\s+/i).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 5) {
        const descs = parts.map(p => FormulaAnalyzer.describeCondition(p, byId, dayTypes));
        return descs.join(' ou ');
      }
    }
    return `\`${c}\``;
  },

  // Décrit en français une expression (membre then ou else d'un if, terme d'une somme)
  describeExpression(e, byId, dayTypes) {
    const s = FormulaAnalyzer.stripOuterParens(e);
    if (/^\d+(\.\d+)?$/.test(s)) return s;
    if (s === 'htime0') return 'le total des heures du jour';
    let m;
    if ((m = s.match(/^rule(\d+)$/))) return FormulaAnalyzer.nameOfRule(+m[1], byId);
    if ((m = s.match(/^htime(\d+)$/))) return FormulaAnalyzer.nameOfHtime(+m[1], dayTypes);
    // Multiplication simple rule*rate
    if ((m = s.match(/^rule(\d+)\s*\*\s*rate$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} × taux contractuel`;
    if ((m = s.match(/^rule(\d+)\s*\*\s*rate(\d+)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} × taux #${m[2]}`;
    if ((m = s.match(/^rule(\d+)\s*\*\s*element(\d+)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} × élément #${m[2]}`;
    // Majoration / prorata par une constante : la forme la plus fréquente en
    // GTA (rule12*1.25). Sans ces trois lignes, elle ressortait en formule
    // brute au milieu d'une phrase par ailleurs correctement traduite.
    if ((m = s.match(/^rule(\d+)\s*\*\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} × ${m[2]}`;
    if ((m = s.match(/^(\d+(?:\.\d+)?)\s*\*\s*rule(\d+)$/))) return `${FormulaAnalyzer.nameOfRule(+m[2], byId)} × ${m[1]}`;
    if ((m = s.match(/^rule(\d+)\s*\/\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} ÷ ${m[2]}`;
    if ((m = s.match(/^htime(\d+)\s*\*\s*(\d+(?:\.\d+)?)$/))) return `${FormulaAnalyzer.nameOfHtime(+m[1], dayTypes)} × ${m[2]}`;
    // Plafonnement / plancher par min et max.
    // La capture du 1er argument est gourmande (.*) et non « tout sauf une
    // virgule » : l'ancre finale « , nombre ) » fixe la découpe sur la
    // DERNIÈRE virgule, ce qui permet de décrire des min/max imbriqués
    // comme max(min(rule10,10),2). Quand l'expression interne est elle-même
    // déjà bornée, on enchaîne avec « , puis » pour rester lisible.
    const bounded = (inner, verb, n) => {
      const d = FormulaAnalyzer.describeExpression(inner, byId, dayTypes);
      return /plafonné à|minoré à/.test(d) ? `${d}, puis ${verb} ${n}` : `${d} ${verb} ${n}`;
    };
    if ((m = s.match(/^min\((.*),\s*([+-]?\d+(?:\.\d+)?)\s*\)$/))) {
      return bounded(m[1], 'plafonné à', m[2]);
    }
    if ((m = s.match(/^max\((.*),\s*([+-]?\d+(?:\.\d+)?)\s*\)$/))) {
      return bounded(m[1], 'minoré à', m[2]);
    }
    // Arrondi au demi
    if ((m = s.match(/^ceil\(([^)]+)\s*\*\s*2\s*\)\s*\/\s*2$/))) {
      return `${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} arrondi au demi-supérieur`;
    }
    if ((m = s.match(/^floor\(([^)]+)\s*\*\s*2\s*\)\s*\/\s*2$/))) {
      return `${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} arrondi au demi-inférieur`;
    }
    if ((m = s.match(/^ceil\(([^)]+)\)$/))) return `${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} arrondi à l'unité supérieure`;
    if ((m = s.match(/^floor\(([^)]+)\)$/))) return `${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} arrondi à l'unité inférieure`;
    // Somme/sous de ruleN
    if (/^[+-]?\s*rule\d+(\s*[+-]\s*rule\d+)+$/.test(s)) {
      return FormulaAnalyzer.describeLinearSum(s, byId);
    }
    // Fallback
    return `\`${s}\``;
  },

  // Décrit en français une somme/sous linéaire de ruleN
  describeLinearSum(s, byId) {
    const tokens = s.match(/[+-]?\s*rule\d+/g) || [];
    const pos = [], neg = [];
    for (const t of tokens) {
      const sign = t.trim().startsWith('-') ? '-' : '+';
      const m = t.match(/rule(\d+)/);
      if (!m) continue;
      const name = FormulaAnalyzer.nameOfRule(+m[1], byId);
      (sign === '+' ? pos : neg).push(name);
    }
    let r = '';
    if (pos.length === 1) r = pos[0];
    else if (pos.length > 1) r = `Somme de ${pos.join(', ')}`;
    if (neg.length === 1) r += ` (moins ${neg[0]})`;
    else if (neg.length > 1) r += ` (moins ${neg.join(', ')})`;
    return r;
  },

  // Découpe une expression en termes additifs au niveau racine (en respectant les parenthèses).
  // Retourne [{sign:'+'|'-', expr:'...'}, ...]
  splitTopLevelSum(f) {
    const terms = [];
    let depth = 0;
    let start = 0;
    let sign = '+';
    let i = 0;
    // Saute un éventuel signe en tête
    while (i < f.length && (f[i] === ' ' || f[i] === '\t')) i++;
    if (i < f.length && (f[i] === '+' || f[i] === '-')) {
      sign = f[i]; i++; start = i;
    } else {
      start = i;
    }
    for (; i < f.length; i++) {
      const c = f[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && (c === '+' || c === '-')) {
        const expr = f.slice(start, i).trim();
        if (expr) terms.push({ sign, expr });
        sign = c;
        start = i + 1;
      }
    }
    const last = f.slice(start).trim();
    if (last) terms.push({ sign, expr: last });
    return terms;
  },

  // Aplatit une cascade d'if pour décrire "Si A: X. Sinon si B: Y. Sinon: Z."
  flattenIfChain(f) {
    const branches = [];
    let current = f;
    let safety = 12;
    while (safety-- > 0) {
      const r = FormulaAnalyzer.parseTopLevelIf(current);
      if (!r) break;
      branches.push({ cond: r.cond, then: r.then });
      current = r.else;
    }
    return { branches, fallback: current };
  },

  // Entrée principale : renvoie une description française ou null si non reconnu
  // Enveloppe publique. L'analyse brute produit parfois une phrase qui
  // recrache des pans entiers de formule entre accents graves : sur une
  // formule très imbriquée, le résultat est moins lisible que la formule
  // elle-même. Dans ce cas on renvoie null, et l'appelant affiche un renvoi
  // vers le bloc « Paramètres » plutôt qu'une fausse explication.
  interpret(rule, byId, dayTypes) {
    let txt = null;
    try { txt = FormulaAnalyzer.interpretRaw(rule, byId, dayTypes); } catch (_) { return null; }
    if (!txt) return null;
    return FormulaAnalyzer.isReadable(txt) ? txt : null;
  },

  // Une lecture est retenue si elle explique vraiment, c'est-à-dire si elle
  // ne se contente pas de recopier la formule. Les seuils sont volontairement
  // stricts : mieux vaut renvoyer aux paramètres qu'afficher une bouillie.
  isReadable(text) {
    const s = String(text || '');
    if (!s) return false;
    if (s.length > 700) return false;                       // phrase à rallonge
    const raw = s.match(/`[^`]*`/g) || [];                  // segments bruts
    if (raw.length > 4) return false;                       // trop de morceaux non traduits
    if (raw.some(x => x.length - 2 > 44)) return false;     // un bloc brut trop long
    const rawChars = raw.reduce((n, x) => n + x.length - 2, 0);
    if (rawChars > s.length * 0.4) return false;            // majorité de formule brute
    return true;
  },

  interpretRaw(rule, byId, dayTypes) {
    const body = FormulaAnalyzer.extractBody(rule);
    if (!body) return null;
    const f = body;

    // 1. Référence unique
    let m;
    if ((m = f.match(/^rule(\d+)$/))) {
      return `Reprend simplement la valeur de ${FormulaAnalyzer.nameOfRule(+m[1], byId)} (indirection).`;
    }

    // 2. Multiplication par taux
    if ((m = f.match(/^rule(\d+)\s*\*\s*rate$/))) {
      return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} multiplié par le taux contractuel.`;
    }
    if ((m = f.match(/^rule(\d+)\s*\*\s*rate(\d+)$/))) {
      return `${FormulaAnalyzer.nameOfRule(+m[1], byId)} multiplié par le taux #${m[2]}.`;
    }

    // 3. Somme/sous linéaire de règles uniquement
    if (/^[+-]?\s*rule\d+(\s*[+-]\s*rule\d+)+$/.test(f.replace(/\s+/g, ''))) {
      return FormulaAnalyzer.describeLinearSum(f, byId) + '.';
    }

    // 3.5. Somme mixte : règles + termes conditionnels au top niveau
    // (couvre les cas type "rule63+rule5+...-if(...)" ET "if(...)+if(...)" purs)
    const terms = FormulaAnalyzer.splitTopLevelSum(f);
    if (terms.length >= 2) {
      const hasIf = terms.some(t => t.expr.startsWith('if('));
      const hasRule = terms.some(t => /^rule\d+$/.test(t.expr));
      if (hasIf || (hasRule && terms.length >= 3)) {
        const rulePos = terms.filter(t => t.sign === '+' && /^rule\d+$/.test(t.expr))
          .map(t => FormulaAnalyzer.nameOfRule(+t.expr.match(/^rule(\d+)$/)[1], byId));
        const ruleNeg = terms.filter(t => t.sign === '-' && /^rule\d+$/.test(t.expr))
          .map(t => FormulaAnalyzer.nameOfRule(+t.expr.match(/^rule(\d+)$/)[1], byId));
        const ifTerms = terms.filter(t => t.expr.startsWith('if('));
        const otherTerms = terms.filter(t => !/^rule\d+$/.test(t.expr) && !t.expr.startsWith('if('));
        const parts = [];
        if (rulePos.length === 1) parts.push(`reprend ${rulePos[0]}`);
        else if (rulePos.length > 1) parts.push(`cumule ${rulePos.length} compteurs (${rulePos.join(', ')})`);
        if (ruleNeg.length) parts.push(`déduit ${ruleNeg.join(', ')}`);
        if (ifTerms.length) {
          const ifDescs = ifTerms.map(t => {
            const parsed = FormulaAnalyzer.parseTopLevelIf(t.expr);
            if (!parsed) return null;
            const cd = FormulaAnalyzer.describeCondition(parsed.cond, byId, dayTypes);
            const td = FormulaAnalyzer.describeExpression(parsed.then, byId, dayTypes);
            const action = t.sign === '+' ? 'ajoute' : 'retire';
            return `${action} ${td} si ${cd}`;
          }).filter(Boolean);
          if (ifDescs.length) parts.push(ifDescs.join(' ; '));
        }
        if (otherTerms.length) {
          parts.push(otherTerms.map(t => `${t.sign === '+' ? '+' : '-'} ${FormulaAnalyzer.describeExpression(t.expr, byId, dayTypes)}`).join(' '));
        }
        if (parts.length) {
          let s = parts.join(', ');
          s = s.charAt(0).toUpperCase() + s.slice(1) + '.';
          return s;
        }
      }
    }

    // 4. Cascade d'if
    const chain = FormulaAnalyzer.flattenIfChain(f);
    if (chain.branches.length > 0) {
      const parts = [];
      chain.branches.forEach((b, i) => {
        const condDesc = FormulaAnalyzer.describeCondition(b.cond, byId, dayTypes);
        const thenDesc = FormulaAnalyzer.describeExpression(b.then, byId, dayTypes);
        const prefix = i === 0 ? 'Si ' : 'sinon si ';
        parts.push(`${prefix}${condDesc} : ${thenDesc}`);
      });
      const fb = chain.fallback.trim();
      if (fb === '0') parts.push('sinon 0');
      else if (fb === '') parts.push('sinon rien');
      else parts.push(`sinon ${FormulaAnalyzer.describeExpression(fb, byId, dayTypes)}`);
      let s = parts.join('. ');
      s = s.charAt(0).toUpperCase() + s.slice(1) + '.';
      return s;
    }

    // 5. Fonction d'arrondi simple
    if ((m = f.match(/^ceil\(([^)]+)\s*\*\s*2\s*\)\s*\/\s*2$/))) {
      return `Arrondit ${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} au demi-supérieur (par tranche de 0,5).`;
    }
    if ((m = f.match(/^floor\(([^)]+)\s*\*\s*2\s*\)\s*\/\s*2$/))) {
      return `Arrondit ${FormulaAnalyzer.describeExpression(m[1], byId, dayTypes)} au demi-inférieur (par tranche de 0,5).`;
    }

    // Dernier repli : le corps n'est pas une conditionnelle reconnue, mais
    // describeExpression sait peut-être le décrire (min/max, arrondis,
    // produits par un taux, sommes de règles…). On ne garde le résultat que
    // s'il apporte quelque chose : quand l'expression n'est pas reconnue,
    // describeExpression renvoie la formule brute entre accents graves.
    const plain = FormulaAnalyzer.describeExpression(f, byId, dayTypes);
    if (plain && !/^`[^`]*`$/.test(plain.trim())) {
      return plain.charAt(0).toUpperCase() + plain.slice(1) + '.';
    }

    // Aucun motif reconnu
    return null;
  }
};
