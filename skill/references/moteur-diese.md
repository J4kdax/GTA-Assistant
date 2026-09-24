# Ce que le code et les bases #Dièse nous ont appris

Analyse menée le 22/09/2026 sur quatre bases (develop, marseille, chatelet, villette) et sur
le code des règles (`_app/demoparis/_reglesTypesContrats/`, `includes/functions/rule.php`).
Les connecteurs Dièse ne sont **pas** utilisés par le générateur : ce fichier en consigne les
enseignements pour que l'outil reste autonome, alimenté par les seuls exports.

## 1. Les jeux de référence ne représentent pas le parc

Proportion de règles sans handler avec la v1.4 :

| Base | Règles | Sans handler | Types manquants |
|---|---|---|---|
| chatelet | 207 | 50 (24 %) | 16 |
| develop | 359 | 73 (20 %) | 47 |
| villette | 174 | 14 (8 %) | 6 |
| marseille | 46 | 1 (2 %) | 1 |

Le catalogue du code compte environ 150 types numérotés, plus une trentaine de fichiers
hérités `_xxx_…`. Châtelet est à dominante « règles standard » (une seule formule), alors
que les jeux de référence sont à dominante formules. **Tout nouvel environnement doit passer
par `--diagnostic` avant génération.**

Types manquants classés par rendement (nombre de règles, nombre de bases) :
`_003` Count_Hours_Per_Shift (24, 3) — traité en v1.7 · `_045` Bank_holiday_hours_worked
(7, 4) — traité en v1.7 · `_064` Consecutive_days_worked (9, 2) · `_105` Work_on_time_range
(7, 2) · `_012` Count_Monthly_Hours (5, 2) · `_078` Panier_bonus (5, 2) · `_051`
Sunday_bank_holiday_worked (5, 2) · `_036` Additionnal_weekly_hours (4, 2) · `_013`
Count_Weekly_Hours_With_Excluded_Hours (3, 2) · `_053` Sunday_saturday_worked (3, 2) ·
`_066`, `_048`, puis une longue traîne à une occurrence.

## 2. Anatomie d'un fichier de règle

Chaque fichier expose un bloc `informationsGenerales` :

- `parametres` : liste indexée. Chaque entrée porte `libelleParam` (libellé affiché, suffixé `*`
  si obligatoire), `parametre` (**clé technique**), `typeEditeur` (`text`, `number`,
  `timepicker`, `combo`, `multi`, `grid`), et selon le cas `store_values` (valeurs de combo
  sérialisées `id → intitule`) ou `store_values_sql` (table du référentiel : `gta_typesAbsences`,
  `typesProduction`, `gta_taches`…).
- `regleColHeader` : 1 = colonne magique. **La base peut contredire le fichier** : `_003` se
  déclare colonne magique, aucune de ses 12 instances Châtelet ne l'est
  (`regles_typesContrat.estColMagique = 0`). Pour le dossier, la base (donc l'export) fait foi.
- `manuelle` : 1 = rien n'est calculé, valeur saisie à la main.
- Drapeaux plus rares : `noPAAnoCalcul` (pas de service ce jour-là → 0 sans calcul),
  `flagRegleCumul` (paramètre de règle cumulée).

Les valeurs stockées (`regles_typesContrat.parametres`, PHP sérialisé) **recopient le libellé
au moment de la création de la règle**. C'est la cause de la dérive de langue des clés : une
règle créée par un utilisateur francophone garde `Types jour`, sa voisine créée en anglais
garde `Day types`, pour la même clé technique `typeJour`.

## 3. Le libellé n'est pas une identité fiable

Mesuré sur Châtelet, 46 couples (fichier, clé technique) portent plusieurs libellés. Plus
grave, un même libellé peut désigner deux paramètres :

- `_045` : « Day start time* » pour `heureDebut` **et** `heureFin` (erreur de déclaration
  #Dièse, recopiée dans chaque règle créée en anglais) ;
- `_001` : « H réelles / H publiées » porté par `hReeleesHpubliees` et, sur des règles
  anciennes, par `idContactidRole` ;
- `_027` : la clé `heureFin` contient en réalité un seuil (libellé « Seuil » / « Threshold »).

Conséquences dans le générateur (v1.7) : `parse_params` conserve toutes les lignes
(`Params.lines`) et repère les libellés ambigus (`Params.ambiguous`). `pick()` lève
`AmbiguousParam` quand le libellé demandé porte deux valeurs différentes ; `nth()` lit la
n-ième occurrence quand l'ordre du fichier est connu (cas `_045`).

**Piste non réalisée** : un catalogue statique `rule_catalog.json` (fichier → index → clé,
libellé, type, combos, référentiel), extrait une fois hors ligne du code, remplacerait les
listes d'alias de `pick()`.

## 4. Barèmes (`seuils`)

Syntaxe : `a>b:v;` répété. `v` est un nombre **ou le mot-clé `reel`** (conserver la durée
réelle). Avant la v1.7, `reel` était ignoré en silence : la règle #203 de Châtelet
(`0>210:3.5;210>1440:reel;`) sortait avec la moitié de son barème, sous une description
d'apparence complète. `parse_scale()` lève désormais `UnreadableParam` sur toute tranche
illisible.

Deux modes coexistent dans `_003` (et d'autres comptages par service) :

- *Thresholds* (id 0) — un seul palier s'applique : la durée du service tombe dans `]a, b]`
  et vaut `v` ;
- *Broken down thresholds* (id 1) — tranches cumulées : chaque tranche atteinte apporte `v`
  (ou la durée effectuée dans la tranche si `reel`).

Dans `_003`, `a`, `b` et `v` sont en minutes (le total est divisé par 60 à la fin). Dans
`_001` mode *Thresholds*, `v` est la valeur retournée pour la journée, sans unité imposée.

## 5. Ce que porte le lien règle ↔ type de contrat

Table `reglesAffectees_typesContrat`, appliquée par `batchClotureGTA()` :

| Colonne | Effet | Usage mesuré |
|---|---|---|
| `coef` | total mensuel × coef | −1 sur 217 liens Châtelet (28 règles), 12 Marseille, 14 Develop |
| `idRegleCreditee`, `coefCredit`, `regleCreditee_de` / `_a` | crédite une autre règle (compteur), éventuellement dans une fourchette | Marseille : « JNT acquis (#30) » → « Solde JNT (#22) » ; 3 liens Develop |
| `coefCumul` | coefficient des corrections reportées sur les règles cumulées | 11 liens Châtelet |
| `ordre`, `code` | ordre et code propres au lien | quasi inutilisés |

Un coefficient −1 transforme « compte les heures » en « déduit les heures ». Une même
règle peut valoir +1 pour un contrat et −1 pour d'autres (« JNPF à poser » : 1 contre 18).

Table `reglesAffectees_typesContrat_reglesConditionnelles` — une règle A (lien
`idLienRegleAconditionner`) voit son résultat modifié selon la valeur d'une règle B (lien
`idLienRegleAexecuter`), **contrat par contrat** :

- `operateur` : 1 `=`, 2 `>`, 3 `≥`, 4 `<`, 5 `≤`, 6 `≠` (comparaison de la valeur de B à
  `valeur`) ;
- `retour` : `zero`, `remplacer` (prend la valeur de B), `plusGrandeValeur`,
  `plusPetiteValeur`.

Exemple Châtelet : « Pause supprimée Midi (#60) » vaut 0 si « Pause décalée matin (#212) »
est supérieure à 0. Volumes : 137 conditions valides sur Châtelet, 27 sur Villette, 24 sur
Develop. **58 conditions orphelines** sur Châtelet pointent vers des liens supprimés : un
constat à remonter au client.

La condition n'agit que si le fichier de la règle appelle `regleContrat_checkerConditions()`
(c'est le cas de `_003` et `_045`).

**À trancher avant tout développement** : l'export « Règles GTA » porte-t-il ces réglages ?
Si non, il faut un export complémentaire ou une demande d'évolution #Dièse — le générateur
ne lira pas la base.

## 6. Valorisation budgétaire

`calculBudget > 0` active `batchExtraRuleCalculation()`, qui multiplie la valeur par, dans
l'ordre : `cb_constante`, taux de charges du type de contrat, taux de charges de la fonction,
taux horaire du contrat, taux fixe, élément financier, total d'élément, champ de contrat,
valeur système d'un champ. Une phrase de type « Valorisée au budget : × taux horaire du
contrat × charges » serait utile aux services financiers.

## 7. Ordre d'exécution réel

Le batch trie par `ORDER BY ordreTech, ordre`. Le dossier trie sur l'ordre standard (choix
client assumé, voir règle absolue n° 1) : les règles dont `ordreTech` diffère s'exécutent
ailleurs dans la chaîne.

## 8. Limites des connecteurs

Le serveur de données est en mode « référentiel seul » : `temp_gta_valeurs` et les autres
tables de résultats sont fermées, les valeurs sentinelles 99 / 999 / 9999 ne peuvent pas être
contrôlées par ce biais. `REGEXP_SUBSTR` n'accepte que deux arguments (MariaDB) et les CTE
sont refusées : passer par `SUBSTRING_INDEX` et des tables dérivées.

## 9. Contrôle du 24/09/2026 : `_003` et `_045` confrontés au code

32 règles extraites des quatre bases (13 Châtelet, 9 Villette, 1 Marseille, 6 Develop, plus la
#203 `_001` de Châtelet), passées dans la v1.6 et la v1.7. Aucun repli, aucune erreur ; la
lecture du code a révélé cinq écarts de sens, corrigés en v1.8.

**Extraction SQL réutilisable** (paramètres remis au format « Libellé = valeur » de l'export) :
découper `parametres` sur `CONCAT('s:12:"libelleParam"', CHAR(59))` avec une table de nombres
1..15, puis lire le libellé entre les deux premiers `"` et la valeur après
`CONCAT('s:6:"valeur"', CHAR(59))` (`N` = vide). Le serveur refuse tout `;` littéral, y
compris dans une chaîne : passer par `CHAR(59)`.

### `_003` Count_Hours_Per_Shift (mode journalier, `estColMagique = 0`)

| Paramètre (index) | Ce que fait le moteur |
|---|---|
| `heureDebut` (1) | heure pivot : un service qui commence avant est rattaché à la veille |
| `heureFin` (2) | **inutilisé** en mode journalier |
| `valeurMax` (4) | plafond **journalier en heures** (comparé au total ÷ 60) ; vide ou 0 = sans plafond |
| `seuils` (5) | `a>b:v`, minutes ; mode 0 : si la durée ne tombe dans aucune tranche `]a, b]`, **elle garde sa valeur réelle** |
| `HN` (6) | id 0 = Yes. Sans type de jour : Yes → services classiques **uniquement** (le code force l'id fictif `123456`) ; No → tous les types de jour hors disponibilités |
| `plageCollees` (13) | id 0 = Yes ; vide forcé à 1 (No) |
| `compterApartirDe` (14) | libellé « … x hours » trompeur : valeur en **minutes**, retranchée de chaque service (plancher 0) |

Subtilité non rendue dans le dossier : quand `Exclude hours from/to` est renseigné, le barème
s'applique au cumul de la journée recalculé service après service, pas à chaque service isolé.
Sans effet avec un service par jour ; à garder en tête si un client conteste un résultat.

### `_045` Bank_holiday_hours_worked

- Jour férié = date présente dans `productions_activites_specialDays` avec `idType = 2`.
- Début ≥ fin → la plage court jusqu'au lendemain (`00:00 / 00:00` = la journée entière,
  `05:00 / 05:00` = 24 h de 05:00 à 05:00).
- `HN` = Yes ajoute l'id 0 (services classiques) à la liste des types de jour ; sans type de
  jour, seuls les services classiques comptent.
- **Défaut moteur** : quand début < fin (plage dans la journée), le filtre types de jour / HN
  n'est **pas appliqué** à la requête. Aucune règle observée dans ce cas ; à signaler si un
  client en paramètre une.

### Anomalies de paramétrage client relevées (pour le consultant)

- Develop #580 : tranche `480>1440:8` en mode cumulé → 8 **minutes**, probablement 480 voulu.
- Villette #29, #31, #49, #223 : borne `14440` (sans effet, 1440 visé).
- Châtelet #278 / #279 : plafond 60 h par jour, inopérant.

### Barèmes à virgule décimale

Les exports écrivent les décimales à la française (`1>240:0,5`). Jusqu'à la v1.6, la tranche
était lue `0` sans alerte (3 règles sur les jeux de référence). `parse_scale()` accepte la
virgule depuis la v1.7 ; tout nouveau lecteur de valeur numérique doit faire de même.
