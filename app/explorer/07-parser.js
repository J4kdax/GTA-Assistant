/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 4. PARSER
 * ========================================================================*/
const Parser = {
  // La lecture des classeurs et le calcul des dépendances sont faits par le
  // moteur Python (engine/model.py) : une seule lecture des exports pour tous
  // les outils. Reste ici ce qui ne sert qu'au graphe.

  // Extrait les ids de types de jour référencés dans les paramètres d'une règle.
  // Sources :
  //  - clés "Day types", "Day type(s)", "Day types*", "Day(s) to exclude" -> liste d'ids séparés par virgule
  //  - références inline "htimeN" dans les formules _039_STD_GTA_Formula
  extractDayTypeRefs(params) {
    if (!params) return [];
    const ids = new Set();
    const p = String(params);
    // Pattern 1 : clés numériques
    for (const line of p.split('\n')) {
      const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (!val || val === '-') continue;
      if (DT_KEYS_BLACKLIST.has(key)) continue;
      if (!DT_KEYS_NUMERIC.has(key)) continue;
      for (const tok of val.split(',')) {
        const t = tok.trim();
        if (/^\d+$/.test(t)) ids.add(parseInt(t,10));
      }
    }
    // Pattern 2 : htimeN inline dans les formules
    for (const m of p.matchAll(/htime(\d+)/g)) {
      ids.add(parseInt(m[1],10));
    }
    return [...ids].sort((a,b)=>a-b);
  }
};
