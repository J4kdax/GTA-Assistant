/* Explorer — issu du Cartographe GTA v3.5.2 (Yannick Trioux, it4culture).
 * Découpé en modules pour l'Atelier GTA : les fichiers se chargent dans l'ordre
 * de leur numéro et partagent la portée globale, comme l'ancien fichier unique. */
"use strict";

/* ========================================================================
 * 2. CONSTANTS
 * ========================================================================*/
/* Palette des types de règle — une déclinaison par thème.
 * Sombre : teintes claires et lumineuses. Clair : teintes plus denses,
 * lisibles sur fond blanc. Même ordre dans les deux, donc un type de règle
 * garde « sa » couleur d'un thème à l'autre. */
const PALETTE_DARK = [
  '#58a6ff','#3fb950','#f0883e','#bc8cff','#ff7b72','#79c0ff',
  '#ffa657','#56d4dd','#d2a8ff','#ffb454','#a5d6ff','#ff9492',
  '#7ee787','#ffdf5d','#cf9eff','#65b585','#ff6b9d','#69e8ff',
  '#ff8c42','#a371f7','#3dd9c8','#f47983','#9d4edd','#06d6a0'
];
const PALETTE_LIGHT = [
  '#0071e3','#1a9641','#e06c00','#8b5cf6','#d63b30','#0a84c4',
  '#b07500','#00868f','#a855c7','#c2410c','#2563eb','#db2777',
  '#15803d','#92700a','#7c3aed','#0e7490','#be185d','#0284c7',
  '#b45309','#6d28d9','#047857','#dc2626','#4f46e5','#a16207'
];
function palette(){ return THEME.current === 'dark' ? PALETTE_DARK : PALETTE_LIGHT; }

/* ------------------------------------------------------------------
 * THEME — bascule clair / sombre.
 * L'habillage passe par [data-theme] sur <html> (variables CSS) ;
 * le graphe, lui, est dessiné sur un canvas et doit être recoloré
 * explicitement — sans jamais relancer le calcul de disposition.
 * ------------------------------------------------------------------ */
const THEME = {
  current: 'light',
  T: {
    light: { edge:'#c9c9ce', edgeDt:'#b0b0b6', edgeDim:'#e6e6ea', edgeDimDt:'#dedee3',
             hl:'#ff9500', nodeFont:'#1d1d1f', nodeStroke:'#fbfbfd', nodeStrokeW:0,
             shadow:{enabled:true, size:9, x:0, y:2, color:'rgba(0,0,0,0.12)'} },
    dark:  { edge:'#48484a', edgeDt:'#5a5a5e', edgeDim:'#2e2e30', edgeDimDt:'#3a3a3c',
             hl:'#ff9f0a', nodeFont:'#f5f5f7', nodeStroke:'#141416', nodeStrokeW:3,
             shadow:{enabled:false} }
  },
  get t(){ return this.T[this.current]; },
  nodeBorder(c){ return shade(c, this.current === 'dark' ? -22 : -14); },
  read(){ try { return localStorage.getItem('gta-carto-theme-v33'); } catch(_) { return null; } },
  save(v){ try { localStorage.setItem('gta-carto-theme-v33', v); } catch(_) {} },

  set(name, opts) {
    const persist = !opts || opts.persist !== false;
    this.current = (name === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.current);
    const btn = document.getElementById('btn-theme');
    if (btn) {
      const label = this.current === 'dark' ? L('Passer en thème clair', 'Switch to light theme') : L('Passer en thème sombre', 'Switch to dark theme');
      btn.innerHTML = this.current === 'dark' ? '&#9788;' : '&#9790;';
      btn.title = label;
      btn.setAttribute('aria-label', label);
    }
    if (persist) this.save(this.current);
    this.repaintGraph();
  },
  toggle(){ this.set(this.current === 'dark' ? 'light' : 'dark'); },

  repaintGraph() {
    if (!STATE.typeColor || !STATE.typeColor.size) return;
    const pal = palette();
    [...STATE.typeColor.keys()].forEach((t,i) => STATE.typeColor.set(t, pal[i % pal.length]));
    if (STATE.network) {
      STATE.network.setOptions({
        nodes: { font:{color:this.t.nodeFont, strokeWidth:this.t.nodeStrokeW, strokeColor:this.t.nodeStroke},
                 shadow:this.t.shadow }
      });
    }
    if (STATE.nodeDS) {
      const upd = [];
      STATE.nodeDS.forEach(n => {
        if (n._kind === 'rule') {
          const r = STATE.byId.get(n.id);
          const c = (r && STATE.typeColor.get(r.rule_type)) || '#888';
          upd.push({id:n.id,
                    color:{background:c, border:this.nodeBorder(c),
                           highlight:{background:c, border:this.t.hl}},
                    font:{color:this.t.nodeFont, strokeWidth:this.t.nodeStrokeW, strokeColor:this.t.nodeStroke}});
        } else if (n._kind === 'daytype') {
          const bg = (n.color && n.color.background) || '#888';
          upd.push({id:n.id, color:{background:bg, border:shade(bg,-25),
                                    highlight:{background:bg, border:this.t.hl}}});
        }
      });
      if (upd.length) STATE.nodeDS.update(upd);
    }
    try { UI.renderLegend(); } catch(_) {}
    try { UI.refreshHighlights(); } catch(_) {}
    try { if (typeof STATE.selected === 'number') UI.renderDetail(STATE.byId.get(STATE.selected)); } catch(_) {}
  }
};

// Clés de paramètres dont les valeurs numériques référencent le réf. types de jour.
// Couvre les exports anglais (Day types) et français (Types jour).
const DT_KEYS_NUMERIC = new Set([
  'Day types','Day type(s)','Day types*','Day(s) to exclude',
  'Types jour','Type(s) jour','Types jour*','Types jour inclu'
]);
// Clés dont les valeurs ne sont PAS des types de jour (jours de semaine, etc.)
const DT_KEYS_BLACKLIST = new Set([
  'Day(s)*','Days*','Days','Special days included','Spacial day type*',
  'Jours de la semaine','Jours de la semaine *','Jours à exclure',
  'Jours de la semaine','Day(s) to exclude *','Spacial day type'
]);

// Catégorie d'absence -> classe CSS pour bord du chip
const CAT_CLASS = {
  'Temps de travail effectif':'pal-cat-eff',
  'Temps de travail non effectif':'pal-cat-noneff',
  'Absence (non comptabilisée)':'pal-cat-abs',
  // Équivalents anglais (mêmes classes CSS) — cf. export types de jour du client 2026-09
  'Counted worktime':'pal-cat-eff',
  'Uncounted worktime':'pal-cat-noneff',
  'Absence (not counted)':'pal-cat-abs',
  // Libellés anglais produits par le moteur de l'Atelier (categorie_en)
  'Effective working time':'pal-cat-eff',
  'Non-effective working time':'pal-cat-noneff'
};

// Lecture humaine des rule_type — dictionnaire métier #Dièse.
// Chaque entrée : { title, desc } affichés en tête du panneau détail.
// Note : les descriptions sont des inférences à partir du nom + signatures de paramètres
// observées sur les exports clients ; à ajuster au fil des audits.
const RULE_TYPE_DOC = {
  '_001_STD_GTA_Count_Hours': {
    title: 'Comptage d\'heures',
    desc: 'Compte les heures effectuées sur les types de jour listés, dans une fenêtre horaire (Day start / Day end), avec un plafond Value max et différents modes (heures réelles, jours, seuils).'
  },
  '_010_STD_GTA_Count_Weekly_Hours': {
    title: 'Comptage hebdomadaire',
    desc: 'Compte les heures hebdomadaires entre deux bornes (Count from x weekly hours / Count to). Sert au calcul des heures supplémentaires ou des seuils hebdomadaires.'
  },
  '_015_STD_GTA_Count_Hours_On_Time_Range': {
    title: 'Comptage sur plage horaire',
    desc: 'Compte les heures uniquement dans une plage horaire spécifique de la journée (Time range start / end). Utile pour les majorations dimanche-soir, nuit, etc.'
  },
  '_017_STD_GTA_Count_Shifts_Per_Task': {
    title: 'Comptage de shifts par tâche',
    desc: 'Compte le nombre de shifts assignés à une ou plusieurs tâches données.'
  },
  '_018_STD_GTA_Count_Breaks': {
    title: 'Comptage de pauses',
    desc: 'Compte les pauses respectant un seuil de durée (entre Break duration min et max).'
  },
  '_028_STD_GTA_Constant_end_contract': {
    title: 'Constante en fin de contrat',
    desc: 'Affecte une valeur constante en fin de contrat, éventuellement proratisée.'
  },
  '_031_STD_GTA_Sum_rule_per_month_week': {
    title: 'Cumul d\'une règle par mois ou semaine',
    desc: 'Cumule la valeur d\'une règle source sur un agrégat temporel (Sum per : month / week).'
  },
  '_037_STD_GTA_Additionnal_hours_end_contract_period': {
    title: 'Heures supplémentaires en fin de période',
    desc: 'Calcule les heures supplémentaires en comparant le compteur "heures travaillées" au "crédit annuel", entre un coefficient de départ (Coef from) et d\'arrivée (Coef to).'
  },
  '_039_STD_GTA_Formula': {
    title: 'Formule de calcul (par jour)',
    desc: 'Formule libre évaluée UNE FOIS par jour. Références : ruleN (valeur d\'une autre règle ce jour), htimeN (cumul des heures sur les plages dont idTypeAbsence=N — htime0 pour les plages standards), rateN, fieldN, weekDay, day, month, etc. Syntaxe : if(cond|then||else), opérateurs + - * / = < > <= >= != and or, fonctions ceil floor round min max intdiv in_array. Parenthèses obligatoires autour des or/and dans un if.'
  },
  '_040_STD_GTA_Special_days': {
    title: 'Jours spéciaux',
    desc: 'Identifie les jours spéciaux (fériés, exceptionnels) selon une transcodification table.'
  },
  '_042_STD_GTA_Bank_holiday_worked': {
    title: 'Jour férié travaillé',
    desc: 'Compte les heures travaillées sur un jour férié (Spacial day type).'
  },
  '_057_STD_GTA_Manual_Bonus': {
    title: 'Prime manuelle',
    desc: 'Prime saisie manuellement, non calculée automatiquement. Le code et le libellé sont remontés tels quels.'
  },
  '_060_STD_GTA_Daily_non_rest_hours': {
    title: 'Heures hors repos quotidien',
    desc: 'Compte les heures qui ne respectent pas le repos quotidien (Count from / to x hours of rest).'
  },
  '_069_STD_GTA_Night_hours': {
    title: 'Heures de nuit',
    desc: 'Compte les heures effectuées dans la plage de nuit (Day start time → Night end time).'
  },
  '_076_STD_GTA_Month_prorata_working_days_with_coef': {
    title: 'Proratisation mensuelle (jours ouvrés)',
    desc: 'Proratisation d\'une valeur mensuelle sur les jours ouvrés, avec coefficient.'
  },
  '_081_STD_GTA_Panier_bonus_without_break': {
    title: 'Panier-repas (sans condition de pause)',
    desc: 'Octroie un panier-repas si la durée du shift respecte un seuil, indépendamment de la pause.'
  },
  '_088_STD_GTA_Ticket_restaurant_with_break': {
    title: 'Ticket restaurant (conditionné à la pause)',
    desc: 'Octroie un ticket restaurant si une pause minimale est prise (Break between, Break duration more than).'
  },
  '_116_STD_COB_Count_Hours': {
    title: 'Comptage d\'heures (Cobalt)',
    desc: 'Variante Cobalt du comptage d\'heures — paramétrage proche de _001 mais sur un périmètre Cobalt (cachet, intermittents).'
  },
  '_123_STD_COB_Nb_shifts_per_period': {
    title: 'Nombre de shifts par période (Cobalt)',
    desc: 'Compte le nombre de shifts (cachets) sur une période donnée.'
  },
  '_124_STD_IND_Total_Rule': {
    title: 'Total règle (Indemnités)',
    desc: 'Cumule la valeur d\'une règle source sur la période complète. Utilisé pour les compteurs d\'indemnités.'
  },
  '_125_STD_IND_Worked_hours': {
    title: 'Heures travaillées (Indemnités)',
    desc: 'Agrège les heures travaillées sur la période (volet Indemnités).'
  },
  '_140_STD_GTA_Month_prorata_30th': {
    title: 'Proratisation mensuelle base 30e',
    desc: 'Proratise une valeur mensuelle sur la base de 30e (jours calendaires).'
  },
  '_160_STD_GTA_cycledate': {
    title: 'Date de cycle',
    desc: 'Détermine la date de cycle pour le calcul des heures cycliques.'
  },
  '_162_STD_IND_totalCycle': {
    title: 'Total cycle (Indemnités)',
    desc: 'Cumule la valeur d\'une règle source sur le cycle complet (volet Indemnités).'
  },
  // === Types ajoutés v2.9 (rencontrés dans les exports clients A/B/C) ===
  '_005_STD_GTA_Count_Shift_Per_Day_Types': {
    title: 'Comptage de shifts par type de jour',
    desc: 'Compte le nombre de shifts qui couvrent les types de jour listés.'
  },
  '_016_STD_GTA_Count_Shifts': {
    title: 'Comptage de shifts',
    desc: 'Compte le nombre de shifts éligibles selon le périmètre (lieux, tâches, rôles, types de jour).'
  },
  '_019_STD_GTA_Count_Days_Worked': {
    title: 'Comptage de jours travaillés',
    desc: 'Compte les jours travaillés sur la période (différent de _001 qui compte des heures).'
  },
  '_020_STD_GTA_Count_1_between_two_dates': {
    title: 'Constante 1 entre deux dates',
    desc: 'Affecte la valeur 1 à chaque jour compris entre deux dates de début et de fin (From / To).'
  },
  '_021_STD_GTA_Constant_per_month': {
    title: 'Constante mensuelle',
    desc: 'Affecte une valeur constante chaque mois (versement régulier type prime).'
  },
  '_025_STD_GTA_Constant_per_day': {
    title: 'Constante journalière',
    desc: 'Affecte une valeur constante par jour éligible (selon types de jour, fenêtre horaire, jours de semaine).'
  },
  '_026_STD_GTA_Constant_per_day_2': {
    title: 'Constante journalière (variante)',
    desc: 'Variante de _025 avec un paramétrage différent — souvent utilisé pour les indemnités spécifiques.'
  },
  '_027_STD_GTA_Combine_rules': {
    title: 'Combinaison de règles',
    desc: 'Combine la valeur de plusieurs règles sources (Règle(s) à additionner) avec un coefficient.'
  },
  '_029_STD_GTA_End_contract_compensation': {
    title: 'Indemnité de fin de contrat',
    desc: 'Indemnité versée en fin de contrat, calculée à partir d\'une règle source et d\'un coefficient.'
  },
  '_030_STD_GTA_Sum_values_by_day_over_the_week': {
    title: 'Somme journalière sur la semaine',
    desc: 'Somme jour par jour sur la semaine, avec affichage de la valeur sur le dernier jour de la semaine ou un jour fixe.'
  },
  '_032_STD_GTA_Sum_rule_per_month_week_per_contact': {
    title: 'Cumul par mois ou semaine, par contact',
    desc: 'Variante de _031 qui agrège la règle source par contact (par salarié) sur une période.'
  },
  '_033_STD_GTA_Sum_rule_total_per_contract_or_period': {
    title: 'Cumul par contrat ou période',
    desc: 'Cumule une règle source soit sur la durée du contrat, soit sur une période fixe.'
  },
  '_035_STD_GTA_Count_weekly_hours_depending_on_day': {
    title: 'Comptage hebdomadaire selon le jour',
    desc: 'Compte les heures hebdomadaires en pondérant selon le jour de la semaine.'
  },
  '_046_STD_GTA_Constant_Bank_holiday_worked': {
    title: 'Constante jour férié travaillé',
    desc: 'Affecte une valeur constante quand un jour férié est travaillé.'
  },
  '_047_AIX_GTA_Heures_jours_feries_intermittents': {
    title: 'Heures férié pour intermittents (AIX)',
    desc: 'Calcul spécifique du Festival d\'Aix : heures effectuées les jours fériés pour les intermittents.'
  },
  '_056_STD_GTA_Count_hours_day_on_dates': {
    title: 'Heures sur dates spécifiques',
    desc: 'Compte les heures travaillées sur une liste de dates calendaires (ex. fériés non chômés).'
  },
  '_058_STD_GTA_Empty_rule': {
    title: 'Règle vide',
    desc: 'Règle servant de placeholder ou d\'espace réservé. Aucun calcul effectif.'
  },
  '_059_STD_GTA_Credit_counter': {
    title: 'Compteur de crédit',
    desc: 'Compteur destiné à suivre un crédit (heures, jours, indemnités) accumulé/débité au fil du temps.'
  },
  '_062_STD_GTA_Daily_non_rest_hours_2': {
    title: 'Heures hors repos quotidien (variante)',
    desc: 'Variante de _060 — calcul des heures qui ne respectent pas le repos quotidien selon une autre logique.'
  },
  '_070_STD_GTA_Constant_hours_worked_time_range': {
    title: 'Constante heures travaillées sur plage',
    desc: 'Affecte une constante si des heures sont travaillées dans une plage horaire donnée.'
  },
  '_075_STD_GTA_Month_prorata': {
    title: 'Proratisation mensuelle',
    desc: 'Proratise une valeur sur les jours du mois (variante simple par rapport à _076 qui pondère selon les jours ouvrés).'
  },
  '_078_STD_GTA_Panier_bonus': {
    title: 'Panier-repas',
    desc: 'Octroie un panier-repas selon des conditions de durée de shift et de plage horaire.'
  },
  '_087_STD_GTA_Ticket_restaurant': {
    title: 'Ticket restaurant',
    desc: 'Octroie un ticket restaurant selon les jours travaillés (sans condition de pause spécifique).'
  },
  '_092_AIX_GTA_Indemnite_transport_7_zones': {
    title: 'Indemnité transport 7 zones (AIX)',
    desc: 'Calcul spécifique du Festival d\'Aix : indemnité transport selon la zone de résidence (A à G).'
  },
  '_093_STD_GTA_Month_prorata_3': {
    title: 'Proratisation mensuelle (variante 3)',
    desc: 'Variante de proratisation mensuelle, paramétrée pour un cas de figure particulier.'
  },
  '_095_AIX_GTA_Indemnites_logement': {
    title: 'Indemnité logement (AIX)',
    desc: 'Indemnité logement spécifique au Festival d\'Aix.'
  },
  '_096_AIX_GTA_Indemnites_logement_anticipees': {
    title: 'Indemnité logement anticipée (AIX)',
    desc: 'Indemnité logement versée par anticipation, spécifique au Festival d\'Aix.'
  },
  '_097_AIX_GTA_Variables_module_auto': {
    title: 'Variables module auto (AIX)',
    desc: 'Module de variables dynamiques spécifique au Festival d\'Aix.'
  },
  '_098_STD_GTA_Full_week': {
    title: 'Semaine complète',
    desc: 'Détecte si la semaine est intégralement travaillée selon des critères donnés.'
  },
  '_099_STD_GTA_Source_rule_divided_by_nb_month_days': {
    title: 'Règle source divisée par nb jours du mois',
    desc: 'Divise la valeur d\'une règle source par le nombre de jours du mois (proratisation inverse).'
  },
  '_104_STD_GTA_Annual_leave_acquisition': {
    title: 'Acquisition de congés annuels',
    desc: 'Calcul de l\'acquisition de congés payés (Nb jours acquis mois plein, présence minimale, fériés).'
  },
  '_106_STD_GTA_Combine_rule_time_range': {
    title: 'Combinaison de règles sur plage horaire',
    desc: 'Combine plusieurs règles avec restriction sur une plage horaire de la journée.'
  },
  '_122_STD_COB_Xth_daily_activity_type': {
    title: 'Xème activité du jour (Cobalt)',
    desc: 'Identifie la Xème activité (cachet) de la journée parmi les types listés. Volet Cobalt/cachets.'
  },
  '_126_STD_IND_Suivi_modulation': {
    title: 'Suivi de modulation (Indemnités)',
    desc: 'Compteur de suivi de modulation côté Indemnités (heures effectivement reportées).'
  },
  '_133_AIX_IND_Suivi_modulation': {
    title: 'Suivi modulation (AIX, Indemnités)',
    desc: 'Variante du suivi de modulation propre au Festival d\'Aix sur le volet Indemnités.'
  },
  '_142_STD_GTA_Source_rule_value_other_day': {
    title: 'Valeur d\'une règle source un autre jour',
    desc: 'Récupère la valeur d\'une règle source pour un jour décalé (Day(s) before/after).'
  },
  '_143_STD_COB_FormulaRoles': {
    title: 'Formule par rôle (Cobalt)',
    desc: 'Formule libre Cobalt qui calcule par rôle (ex. tauxInstSupp1+tauxInstSupp2).'
  },
  '_163_STD_GTA_SBSFormula': {
    title: 'Formule SBS (par plage)',
    desc: 'Formule évaluée séparément pour CHAQUE plage horaire du jour, puis somme automatique des résultats. Variables relatives au shift courant : idtask, idactivitytype, idvenue, idproductiontype, starttime/endtime (décimal heures), htimeN/mtimeN (durée du shift en heures/minutes, défini uniquement si idTypeAbsence=N pour ce shift — htime0 pour un shift standard). Variables jour identiques à _039 : weekDay, day, ruleN, rate, field, etc. Plus puissant que _039 pour les calculs par activité (filtrage par tâche, plage, lieu).'
  },
  '_165_STD_GTA_Source_rule_total_period': {
    title: 'Total règle source sur la période',
    desc: 'Cumule la valeur d\'une règle source sur la totalité de la période contractuelle.'
  },
  '_xxx_AixIndemniteTransport': {
    title: 'Indemnité transport (AIX, ad-hoc)',
    desc: 'Calcul ad-hoc d\'indemnité de transport spécifique au Festival d\'Aix (préfixe non standardisé).'
  }
};

// Décode "0>240:0.5;240>1440:1" en [{from:0,to:240,value:0.5}, …]
function decodeThresholds(s) {
  if (!s) return [];
  return String(s).split(';').map(seg => {
    const m = seg.trim().match(/^(-?[0-9.]+)\s*>\s*(-?[0-9.]+)\s*:\s*(-?[0-9.]+)$/);
    if (!m) return null;
    return { from: parseFloat(m[1]), to: parseFloat(m[2]), value: parseFloat(m[3]) };
  }).filter(Boolean);
}

// Pretty-print d'une formule _039 : retours à la ligne sur les opérateurs
// de niveau 0 (paren depth = 0). Préserve la chaîne pour rendu HTML.
function prettyFormula(s) {
  if (!s) return '';
  let out = '';
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') { depth++; out += c; continue; }
    if (c === ')') { depth--; out += c; continue; }
    if (depth === 0 && (c === '+' || c === '-') && i > 0) {
      // évite de couper sur un signe collé à un nombre négatif après opérateur
      const prev = s[i-1];
      if (prev !== '(' && prev !== '|' && prev !== ',' && prev !== '*' && prev !== '/') {
        out += '\n' + c + ' ';
        continue;
      }
    }
    out += c;
  }
  return out;
}
