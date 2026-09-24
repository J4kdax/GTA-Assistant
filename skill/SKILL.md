---
name: dossier-parametrage-gta
description: "Génère le dossier de paramétrage GTA #Dièse : un classeur Excel remis au client qui liste toutes les règles GTA de son environnement, dans leur ordre d'exécution, avec pour chacune une explication en langage clair, en français ou en anglais, de ce qu'elle calcule. Déclenche dès que l'utilisateur demande un dossier de paramétrage, un référentiel de règles GTA, une documentation client du module GTA, ou fournit un export #Dièse « Règles GTA » / « Contrats-GTA-Règles » en demandant d'en faire une synthèse lisible. Also triggers in English: GTA configuration report, rule catalogue or client documentation of #Dièse time-and-activity rules."
---

# Dossier de paramétrage GTA #Dièse

Livrable statique remis aux équipes RH / paie / planification d'un client une fois son
environnement #Dièse paramétré. Il répond à une seule question, règle par règle :
**qu'est-ce que ça calcule, et pour qui ?**

Depuis la v2.0, le moteur de ce skill est aussi celui de l'**Atelier GTA #Dièse**, la page web
qui réunit l'Explorer (ex-Cartographe GTA), l'audit, le catalogue à l'écran et le dossier client.
Le dépôt `atelier-gta` porte les deux : `engine/` (ce qui devient `scripts/` dans le paquet
.skill), `app/` (l'interface), `skill/` (ce fichier et ses références). Une correction du moteur
profite donc à la fois à Claude et à l'équipe qui utilise l'Atelier.

Le générateur vit dans `scripts/` et se lance en ligne de commande :

```
python3 scripts/build_xlsx.py \
  --input  Contrats-GTA-Règles-*.xlsx \
  --daytypes Contrats-GTA-Absences-présences-*.xlsx \
  --client "Nom du client" \
  --langue fr
```

`--output` est facultatif : par défaut `Dossier-parametrage-GTA_<client>_<date>.xlsx` à côté de
l'export. `--contrats` : `contrats` (une colonne par type de contrat — le choix retenu, valeur
par défaut depuis la v1.9) ou `non`. `--sample 12,45,78` restreint la
génération à quelques règles pendant la mise au point : **toujours travailler sur un
échantillon réduit avant de relancer sur le fichier complet.**

`python3 scripts/model.py --input … [--daytypes …] [--ref …]` produit le **modèle
d'environnement** en JSON : la lecture unique des exports que consomment tous les onglets de
l'Atelier (règles normalisées dans l'ordre d'exécution, dépendances, descriptions FR et EN,
contrats, types de jour, audit). Voir « Moteur unique et Atelier » plus bas.

**Avant de modifier un handler ou d'en écrire un nouveau, lire `references/moteur-diese.md`** :
anatomie des fichiers de règle #Dièse, pièges des libellés de paramètres, syntaxe des barèmes,
réglages portés par l'affectation (coefficient, crédit, conditions) et couverture réelle du parc.

## Déroulé d'une génération

À suivre quand quelqu'un demande un dossier de paramétrage pour un client.

**0. Demander la langue de sortie.** Français ou anglais, jamais deviné : le format de colonnes
détecté indique la langue de l'interface du client, pas celle du destinataire du dossier. Passer
`--langue fr|en`.

**1. Réunir les entrées.** `identify_files()` range une liste de fichiers déposés en vrac en
lisant leurs en-têtes de colonnes, jamais leur nom : export de règles, export de types de jour,
référentiel, ou non reconnu. Le nom de fichier ne sert qu'à deviner la famille d'un référentiel,
parce que les clients renomment leurs exports. Réclamer l'export « Règles GTA » s'il n'est pas fourni, et demander
l'export « Types de jour » dans la foulée : sans lui, toutes les mentions de types de jour
restent en chevrons, ce qui est le défaut de lisibilité le plus visible du document.

**2. Diagnostiquer avant de générer — obligatoire.** `build_xlsx.py --diagnostic` lit le
fichier sans rien écrire et restitue : format de colonnes détecté, volumétrie, types de règle
sans traduction dédiée, identifiants de types de jour non résolus, et référentiels manquants
classés par rendement. **Présenter ce relevé à l'utilisateur et lui demander les référentiels
qui valent la peine avant de produire le classeur**, pas après. Le générateur affiche
systématiquement ce contrôle, même en génération normale.

**2 bis. Réclamer les référentiels, sans jamais bloquer.** Le diagnostic classe les référentiels
manquants par nombre d'occurrences. Présenter cette liste à l'utilisateur et lui demander les
exports qui en valent la peine — sur un environnement type, les taux ou les types d'activité
pèsent plusieurs centaines d'occurrences, les tâches trois. S'il les fournit, les passer en
`--ref`. **S'il ne les fournit pas, ou s'ils n'existent pas, générer quand même** : le dossier
sort avec les chevrons, ce qui reste exploitable. Ne jamais faire de la fourniture d'un
référentiel une condition pour produire le document.

**3. Générer sur un échantillon réduit** (`--sample`) si le fichier présente des nouveautés —
convention de contrat inhabituelle, types de règle inconnus, idiomes de formule non rencontrés.
Vérifier une vingtaine de descriptions avant de lancer le fichier complet.

**4. Générer, puis restituer.** Livrer le classeur avec, en clair :
- les référentiels manquants et leur poids, en indiquant lesquels valent la peine d'être
  réclamés au client (les taux arrivent presque toujours en tête) ;
- le nombre de règles tombées en repli faute de handler, avec les types concernés ;
- les fragments non traduits, s'il y en a ;
- les anomalies de paramétrage repérées au passage : règles mortes, contrats de test,
  références de règles incomplètes. Ce sont des constats à remonter au client, jamais des
  motifs de masquer quoi que ce soit.

**5. Capitaliser.** Tout nouvel idiome de formule, tout nouveau type de règle traité, toute
convention de nommage inédite repart dans ce skill. C'est ce qui fait que le résultat s'améliore
d'un client à l'autre au lieu de se réinventer.

## Contrôles avant livraison

- Le nombre de colonnes de contrat est-il égal au nombre de types de contrat distincts de
  l'export ? Un écart signale une collision de codes — deux contrats fusionnés en une colonne.
- Reste-t-il des balises HTML visibles dans une cellule ?
- Les descriptions les plus longues sont-elles passées en écriture raccourcie ?
- Les renvois entre règles se résolvent-ils tous, y compris en génération partielle ?
- Le jeu de test de référence donne-t-il toujours ses 4 fragments non traduits, pas davantage ?
- `tests/jeu_reduit.py` sort-il ses 20 descriptions (10 règles × 2 langues), dont exactement
  deux replis (#9002, tranche illisible volontaire, en français et en anglais) ?
- `tests/robustesse.py` passe-t-il ses 16 cas sans échec, et `tests/modele.py` ses 6 contrôles ?
- Après toute modification de l'interface ou du moteur : `tests/navigateur.py` (Chromium) fait le
  parcours complet de l'Atelier et vérifie que le dossier téléchargé est identique, cellule par
  cellule, à celui de la ligne de commande.
- Le diagnostic signale-t-il des « Export corrigé à la lecture » (lignes sans identifiant,
  doublons) ? Ce sont des défauts d'export à remonter, pas à masquer.

## Robustesse aux exports (depuis v1.9)

Un export abîmé ne doit jamais produire une trace Python. Deux issues seulement :

- **Anomalie tolérable → le dossier sort, et l'anomalie est dite.** `load_rules` corrige à la
  lecture et consigne dans `df.attrs['anomalies']`, restitué par le diagnostic : feuille de
  notes placée devant la feuille des règles (toutes les feuilles sont examinées), lignes sans
  identifiant ou à identifiant illisible (ignorées), doublons exacts (retirés), même `#` avec
  deux contenus (première ligne gardée, ids cités), cases `Compteur ?` / `Affiché dièse ?` en
  texte (`Oui`, `Yes`, `x`… ramenés à 1 / 0), `Ordre` non numérique (traité comme 0), valeurs
  vides partout. Une exception dans le traducteur de formules ne coûte qu'une ligne
  (`‹traduction impossible : …›`), jamais le dossier.
- **Entrée inexploitable → `ExportError`**, message destiné à l'utilisateur : fichier absent,
  fichier qui n'est pas un classeur, mauvais export (l'export des types de jour déposé à la
  place des règles est reconnu et nommé), colonne obligatoire absente. En ligne de commande :
  `ERREUR — …`, code de sortie 2.

`tests/robustesse.py` fabrique ces exports à la volée (aucune donnée client) : 16 cas, dont 9
faisaient planter la v1.8. Tout nouveau défaut d'export rencontré chez un client devient un cas.

## Moteur unique et Atelier (depuis v2.0)

- **Une seule lecture des exports.** `model.build_model()` est le seul point d'entrée des
  interfaces : l'Explorer ne lit plus les classeurs lui-même (l'ancien lecteur SheetJS du
  Cartographe est supprimé) et reçoit les dépendances calculées par `rule_dependencies()`, dont
  les motifs reprennent à l'identique ceux du Cartographe v3.5.2 (0 écart sur 174 règles réelles).
- **Pas de pandas.** Le moteur ne dépend que d'openpyxl (`tables.py` lit les classeurs) : dans le
  navigateur, Pyodide démarre sans télécharger pandas ni numpy, et openpyxl est installé depuis
  les wheels du dépôt (`vendor/`), sans PyPI. Démarrage mesuré : environ 4 s hors téléchargement,
  0,5 s d'analyse pour 174 règles. `tables.py` reproduit les conventions implicites de pandas
  (cellule vide → None, 10.0 → 10, en-têtes nettoyés) : v1.9 → v2.0 donne des classeurs
  identiques cellule par cellule. **Ne jamais réintroduire pandas dans `engine/`** (contrôlé par
  la CI).
- **Le moteur tourne dans un Web Worker** (`app/engine-worker.js`) : commandes `boot`, `load`
  (identification des fichiers déposés), `analyse` (modèle) et `dossier` (classeur). Un champ du
  modèle renommé casse l'interface sans erreur Python : `tests/modele.py` fige sa forme.
- **L'audit du modèle** classe les constats en « à corriger » (renvois vers une règle absente,
  `rule` sans numéro dans une formule, anomalies d'export) et « à savoir » (règles mortes, sans
  affectation, décrites en repli, types de jour inutilisés). La recherche de `rule` sans numéro
  ne porte que sur le corps des formules : « Source rule* » est un libellé de paramètre.
- **`data/rule_specs.json`** : 185 spécifications officielles de types de règle (libellés, clés et
  caractère obligatoire des paramètres, lien KB), extraites du code PHP par le Cartographe. Elles
  sont affichées par l'Explorer ; elles sont la source à exploiter pour les prochains handlers.

## Pièges rencontrés en production

Chaque nouvel environnement a invalidé une hypothèse tirée du précédent. À traiter comme des
avertissements, pas comme des cas résolus une fois pour toutes :

- **La convention de nommage des contrats n'est pas universelle.** Le premier environnement
  utilisait `FAMILLE_NN` (`TECH_16_…`), le second des libellés libres (`CDI modulation Adm`,
  `CDD U plus d'un mois modulation`). Un code dérivé du libellé tronqué provoque des collisions
  silencieuses. **L'identité d'un contrat est son id, jamais son libellé.**
- **Les regroupements par famille ne valent que là où la convention existe.** Sur le second
  environnement, tous les contrats sauf trois tomberaient dans « AUTRE ».
- **Les balises HTML apparaissent là où on ne les attend pas**, y compris dans les libellés
  d'affectation de contrat.
- **`SA : Ordre technique` peut être renseigné massivement sans rien changer** : sur le second
  environnement, 93 règles en portent une valeur, mais 88 sont identiques à l'ordre standard.
  Compter les écarts réels avant de s'en inquiéter.
- **Nos jeux de référence sont à dominante formules ; le parc ne l'est pas.** Sur Châtelet,
  24 % des règles relèvent de types standard encore sans handler. Toujours passer par
  `--diagnostic` sur un nouvel environnement.
- **Un libellé de paramètre peut désigner deux paramètres.** `_045` déclare « Day start time* »
  pour l'heure de début et l'heure de fin. `parse_params` garde toutes les lignes
  (`Params.lines`), `pick()` lève `AmbiguousParam` sur un libellé ambigu, `nth()` lit par
  position. Ne jamais revenir à un simple dict.
- **Les barèmes acceptent `reel`** (durée réelle conservée). Toute tranche illisible lève
  `UnreadableParam` : ignorer une tranche en silence produit une description fausse
  d'apparence complète (règle #203 de Châtelet avant la v1.7).
- **La colonne `Code` est tantôt vide et bruitée, tantôt réellement utilisée** (77 règles sur
  173 dans le second environnement). Elle reste obligatoire dans tous les cas.

## Entrées

1. **Export « Règles GTA »** (obligatoire) — `Contrats-GTA-Règles-*.xlsx`. #Dièse l'exporte sous
   **trois habillages de colonnes** selon l'ancienneté et la langue du client : français récent,
   anglais récent, anglais ancien. Le chargeur les détecte et les ramène au modèle interne ; ne
   jamais supposer qu'un seul format est possible. Les colonnes optionnelles absentes (`Code`,
   `Affiché dièse ?`…) sont créées vides.
2. **Export « Types de jour »** (optionnel, fortement recommandé) —
   `Contrats-GTA-Absences-présences-*.xlsx`, feuille « Export DIESE ». Permet d'écrire
   « Campo presté » au lieu de « type de jour #9 ».
3. **Référentiels complémentaires** (optionnels) — taux, éléments financiers, fonctions, types
   d'activité, tâches, champs personnalisés… Chacun se passe en `--ref famille=fichier.xlsx`, ou
   simplement `--ref fichier.xlsx` quand le nom du fichier permet de deviner la famille. Sans
   eux, les références concernées sortent entre chevrons : **c'est une dégradation de lisibilité,
   jamais un blocage**.

Si l'export « Règles GTA » n'a pas été fourni, le demander avant toute chose.

## Structure du classeur : trois onglets au plus

**Onglet 1 — Lisez-moi.** Bandeau de titre rouge pleine largeur (titre, nom du client,
date de génération), puis :

1. **« À quoi sert ce document »** — un paragraphe d'introduction qui explique l'objet du
   document, l'ordre d'exécution, et replie en deux phrases les conventions `« Libellé (#12) »`
   et `‹ chevrons ›`.
2. **« Les colonnes du catalogue »** (v1.9, demandé par le client) — une ligne par colonne, dans
   l'ordre du catalogue, lignes alternées en rouge pâle : ce que contient la colonne, en langage
   courant. Une ligne « Colonnes de contrat » s'ajoute quand elles sont présentes, avec trois
   exemples tirés de l'environnement ; puis une astuce de filtrage en italique. Les textes vivent
   dans `COLUMN_GUIDE` / `CONTRACT_GUIDE` de `build_xlsx.py`, dont les clés **doivent** reprendre
   exactement les en-têtes de `COLUMNS` (vérifié par `tests/robustesse.py`).
3. **« Les colonnes du lexique des types de jour »** — seulement si l'onglet lexique existe
   (`GLOSSARY_GUIDE`).

Pied de page IT4culture. Les sections « Chiffres clés » et « Référentiels utilisés » restent
exclues. Les hauteurs de ligne des cellules fusionnées sont calculées (`_height`) : Excel ne les
ajuste pas seul.

**Impression.** Chaque onglet tient sur la largeur d'une page A4 (Lisez-moi en portrait,
catalogue et lexique en paysage, ligne d'en-tête répétée) : le dossier est souvent converti en
PDF avant d'être transmis.

**Onglet 3 — Lexique des types de jour.** Présent uniquement si l'export des types de jour a été
fourni ; son absence laisse un classeur à deux onglets, sans message d'erreur. Une ligne par type
de jour **déclaré** — pas seulement ceux utilisés : un type visible dans l'interface du client mais
absent du lexique créerait un doute. Colonnes : intitulé public · intitulé court · # · couleur ·
nature · durée par défaut · actif · règles concernées.

Trois partis pris :

- **Tri alphabétique** sur l'intitulé public. Un lexique se consulte par le mot ; l'ordre d'écran
  de #Dièse comporte des doublons et des valeurs aberrantes (jusqu'à 100 000).
- **La cellule Couleur est remplie de la couleur réelle** du type de jour, extraite du HTML de
  l'export (`background-color:#87CEFA`), avec l'encre que l'export précise. C'est le repère visuel
  que le client a dans ses plannings.
- **La colonne « Règles concernées » fait le lien avec le catalogue** et rend visibles les types
  déclarés que plus aucune règle n'utilise — 15 sur 102 dans le premier environnement. Constat à
  remonter au client, jamais un motif de les masquer.

Les intitulés *internes* sont écartés : vides dans la majorité des cas, et destinés aux équipes de
paramétrage, pas au client. Les colonnes `Type` (constante) et `SA : Afficher Horaires` (réglage
d'affichage) n'apportent rien.

**Onglet 2 — Catalogue des règles.** Une ligne par règle, dans l'ordre d'exécution.
Colonnes, dans cet ordre exact :

| Colonne | Largeur | Notes |
|---|---|---|
| Ordre | 8 | ordre standard, centré |
| # | 7 | identifiant de la règle, centré |
| Libellé | 40 | en gras, renvoi à la ligne |
| Libellé court | 22 | **obligatoire** — c'est le repère du client dans ses écrans |
| Code | 12 | **obligatoire** même si majoritairement vide |
| Ce que fait la règle | 100 | la colonne centrale |
| Compteur | 10 | « Oui » ou vide |
| Période | 18 | exercice du compteur, « — » sinon |
| *un colonne par type de contrat* | 4,6 | en-tête vertical, croix `X` rouge |

Filtre automatique sur toute la plage, volets figés en `D2` quand les colonnes de contrat
sont présentes (Ordre, # et Libellé restent visibles au défilement horizontal), en `A2` sinon.

## Charte graphique IT4culture

| Usage | Couleur |
|---|---|
| Bandeaux, en-têtes de colonne, croix de contrat | `B3202C` |
| Titres de section, texte des compteurs | `7E1620` |
| Fond des cellules Compteur / Période | `F8E7E9` |
| Lignes alternées du catalogue | `F3F4F6` |
| Filets | `E4E6EA` |
| Texte courant | `2B2B2B` |

Police Arial partout. Le rouge est le seul accent : ne pas réintroduire d'autre teinte.

## Deux langues, deux vintages : le piège des paramètres

Les **clés de paramètres** changent de langue d'un client à l'autre — `Rule(s)*` ici, `Règle(s)`
là — **et parfois à l'intérieur d'un même fichier** : sur le troisième environnement testé,
`_027` a ses clés en français pendant que `_069` garde les siennes en anglais. Les jeux de
paramètres diffèrent aussi selon l'ancienneté : le `_025` d'un vieux client porte des filtres de
classification (`Id classif contact`, `Inclure fériés`) absents des environnements récents, et sa
valeur s'appelle `Nb h/j` au lieu de `Value*`.

Conséquences, toutes deux impératives :

1. **Tout accès à un paramètre passe par `pick(params, 'Alias EN', 'Alias FR', …)`**, qui
   compare en ignorant la casse et l'astérisque de champ obligatoire. Un handler qui lit
   `p.get('Day types')` en dur est un handler cassé pour la moitié du parc.
2. **Un paramètre obligatoire absent lève `MissingParam`**, et la règle bascule sur le repli en
   paramétrage brut. C'est le garde-fou le plus important du générateur : sans lui, un handler
   construit une phrase autour d'une valeur vide et produit des descriptions d'apparence normale
   mais vides de sens — *« Vaut 1 une fois par . »*, *« Compte les heures au-delà de None h »*.
   Ce mode de défaillance est le plus dangereux du projet : il est invisible à la relecture
   rapide. Il a touché 28 règles sur 158 avant correction.

Les valeurs aussi sont bilingues : jours de la semaine (`Monday` / `Lundi`, avec la coquille
`Thursady` observée en production), modes (`Actual hours` / `Réel en heures`), périodes
(`Week` / `Semaine`, `A la période`). Les tables `_DAYS_ALIASES`, `MODE_FR` et `PERIOD_FR`
centralisent ces équivalences : les compléter plutôt que de les contourner.

## Deux langues de sortie : ce qui se traduit et ce qui ne se traduit pas

Le dossier se génère en français ou en anglais (`--langue`). **La langue doit être demandée à
l'utilisateur**, jamais déduite de l'export.

**Traduit** : les ~44 phrases des handlers, les tournures du traducteur de formules, les noms de
familles de référentiels (`‹taux #521›` → `‹rate #521›`), les en-têtes de colonnes, le Lisez-moi,
les jours et les mois, les clés de paramètres du repli via `PARAM_GLOSSARY`. La typographie suit
aussi : guillemets `« »` en français, `“ ”` en anglais ; virgule décimale en français, point en
anglais ; connecteur de liste « et » / « and ».

**Jamais traduit** : les libellés de règles, les libellés courts, les codes, les noms de types de
contrat et de types de jour. Ils viennent de l'environnement du client et le lecteur doit pouvoir
les retrouver à l'identique dans ses écrans #Dièse. Un dossier anglais est donc **bilingue par
nature** — phrases anglaises, vocabulaire client d'origine — et le Lisez-moi anglais le dit
explicitement au lecteur.

**Conséquence pour toute évolution** : les formulations vivent dans le catalogue `M` de
`humanizer.py`, une entrée par clé, un tuple `(français, anglais)`. Ajouter un type de règle,
c'est ajouter sa phrase **dans les deux langues** ; une clé absente lève une erreur explicite
plutôt que de retomber silencieusement en français. Aucun littéral de phrase ne doit subsister
dans un handler.

## Règles métier absolues

1. **Tri sur l'ordre standard, pas sur `SA : Ordre technique`.** Choix client explicite. Les
   ex aequo (fréquents : ~165 règles sur 636 sur le jeu de test) sont départagés par le `#`,
   pour un tri stable et reproductible d'une génération à l'autre. Conséquence assumée : les
   quelques règles dont l'ordre technique diffère s'exécutent en réalité ailleurs dans la
   chaîne.
2. **Renvois vers une autre règle : `« Libellé (#id) »`**, jamais `ruleN`, jamais le numéro
   seul. En mode raccourci, le libellé court remplace le libellé long.
3. **Références non résolues : `‹ famille #id ›`**, jamais la syntaxe brute, jamais une
   explication inventée. Les listes d'ids d'une même famille sont regroupées :
   `‹types d'activité #11, 12, 13›` et non une suite de chevrons isolés.
4. **Décrire ce que la règle calcule, jamais pourquoi elle existe.** Toute interprétation du
   besoin métier est de l'invention.
5. **Nettoyage HTML strictement limité aux colonnes de libellé.** Les `<br>` du `Libellé court`
   (210 cas sur le jeu de test) deviennent de vrais retours à la ligne — ils reproduisent
   l'affichage écran de #Dièse, qui est le repère du lecteur. Les `<b>` sont retirés. **Ne
   jamais appliquer de nettoyeur de balises à la colonne `Paramètres`** : les formules
   contiennent des `<` et `>` de comparaison qu'un tel nettoyage détruit silencieusement
   (`<4)|4||if(rule31>` est un fragment de formule valide, pas une balise). Quand un libellé est
   cité à l'intérieur d'une phrase, ses retours à la ligne redeviennent des espaces.
6. **Mode raccourci au-delà de 380 caractères.** La formule est retraduite en écriture
   condensée : symboles de comparaison (`>`, `=`, `≥`), `→` à la place de « alors », libellés
   courts pour les renvois, phrases abrégées (`la fonction occupée` → `fonction`). **Tous les
   éléments sont conservés** — c'est une réécriture, pas une troncature. Sur le jeu de test,
   la description la plus longue passe de 1 170 à 554 caractères.
7. **Une colonne par type de contrat**, en fin de tableau, croix `X` en rouge, en-tête vertical,
   contenu centré verticalement et horizontalement. Le code du contrat est extrait du libellé
   d'affectation selon le motif `FAMILLE_NN` (`TECH_16_FLEX RECUP - temps plein` → `TECH_16`).
   Les libellés hors convention sont conservés tronqués à 14 caractères et rangés dans la
   famille `AUTRE`.
8. **Type de contrat = colonne `Affectations`, jamais le préfixe du libellé de la règle.**
   Format d'une ligne d'affectation : `Libellé (#id)`. Une règle peut viser 0, 1 ou tous les
   types de contrat.
9. **Les règles sans affectation sont conservées dans le catalogue.** Elles existent dans le
   paramétrage et sont parfois encore référencées par des formules actives (10 cas sur 30 dans
   le jeu de test) : les masquer casserait des renvois. Les colonnes de contrat les rendent
   visibles d'elles-mêmes — une ligne sans aucune croix.
10. **Le dictionnaire de résolution est construit sur tout le fichier**, jamais sur le
    sous-ensemble filtré, sinon les renvois entre règles cessent de se résoudre hors périmètre.

## Idiomes de formule #Dièse à connaître

La syntaxe officielle est documentée dans le skill `gta-diese` / `diese-gta-suite`. Les cas
ci-dessous ont été rencontrés en production et cassent un traducteur naïf :

- **`(rule32>0)` employé comme terme de calcul** — booléen converti en 1 ou 0. À rendre
  « 1 lorsque … est supérieur à 0, 0 sinon ».
- **`(cond|a||b)` écrit sans le mot-clé `if`** — le moteur l'accepte.
- **`(rule308=0)or(rule309=0)`** — `and` / `or` collés aux parenthèses, sans espaces. Le
  découpage logique doit être fait par expression régulière avec limites de mots, pas par
  recherche de `" or "`.
- **Variables propres aux formules par service (`_163` SBS)** : `htime` nu (durée du service
  courant), `tauxSupp`, `tauxInstSupp`, `breaktimebefore`, `breaktimeafter`, `idvenue`,
  `sbsruleN`. Absentes des formules standard.
- **`rule` sans numéro** — défaut de paramétrage client réel. Sortir
  `‹référence de règle incomplète dans la formule›` et le signaler, jamais deviner.
- **Types de jour non résolus** : regroupés dans un seul chevron, libellé traduit
  (`‹types de jour #25, 26, 46›` / `‹day types #25, 26, 46›`).
- **Calculs de dates** (`new DateTime(...)->diff(...)->days`) — non traduits volontairement,
  rendus `‹calcul de dates non traduit›`.

**Critère de non-régression**, mesuré sur les trois environnements de référence (636, 173 et
158 règles, soit 967 au total) :

| Mesure | Attendu |
|---|---|
| Descriptions correctes | 967 / 967 |
| Replis en paramétrage brut | 0 |
| Descriptions dégradées (phrase construite sur une valeur vide) | 0 — **jamais** |
| Fragments de formule non traduits | 4, tous sur le premier environnement (3 calculs de dates, 1 défaut de paramétrage client) |

Dernière validation : **v1.8, le 24/09/2026**, sur ces mêmes exports (sans les exports de types
de jour). Comparaison v1.6 → v1.8 : 0 repli, 0 erreur, 0 description dégradée, les 4 mêmes
fragments, dans les deux langues. Seuls écarts, tous attendus : regroupement des types de jour
non résolus, libellé anglais de ces chevrons, et **3 barèmes à virgule décimale corrigés**
(`0,5` était lu `0` par la v1.6 : client 1 #722, client 3 #13 et #173 — le « 967 / 967 »
d'origine les comptait à tort comme corrects). Aucune règle `_003` / `_045` dans ces exports :
les corrections de la v1.8 y sont sans effet (v1.7 → v1.8 : 0 écart).

Ces chiffres doivent être identiques en français et en anglais : une divergence signale une
formulation manquante dans le catalogue.

Toute évolution qui dégrade l'une de ces lignes est une régression. La ligne « dégradées » est
non négociable : elle doit rester à zéro par construction, grâce au garde-fou `MissingParam`.

**Méthode : comparaison différentielle, pas chiffres absolus.** Les chiffres ci-dessus datent
des exports du 21-22/09/2026, qui ne sont plus disponibles. Un nouvel export reflète le
paramétrage du jour : les compteurs attendus peuvent bouger sans que le code soit en cause.
La non-régression se fait donc en passant **la version précédente et la nouvelle sur les mêmes
exports**, puis en comparant règle par règle :

- un texte modifié hors des types de règle touchés par la version est une régression ;
- un texte modifié sur un type touché est vérifié contre le code #Dièse (fichier de la règle) ;
- aucun repli ni description dégradée supplémentaire, en français comme en anglais.

Le résultat devient la nouvelle référence : mettre à jour le tableau ci-dessus avec la date des
exports. **Conserver les exports de référence** dans un espace interne privé et versionné
(SharePoint IT4culture), jamais dans le dépôt GitHub : ce sont des données clients.

**Contrôle intermédiaire sans exports** : `tests/controle_003_045.py` rejoue 32 règles `_003`,
`_045` et barèmes `reel` extraites des quatre bases le 24/09/2026 (libellés anonymisés). Il
valide un handler modifié ; il ne remplace pas la comparaison différentielle.

## Référentiels : demander, mais ne jamais bloquer

Le générateur recense automatiquement ce qu'il ne sait pas nommer et le restitue par ordre de
poids (occurrences, nombre de règles, export à demander). Familles gérées : taux (`rateN`),
fonctions (`idjob`), types d'activité, champs de contrat (`fieldN`), champs système, types de
production, éléments financiers, tables de conversion (`latest_*`), champs contact, départements,
champs d'activité, tâches, rôles prédéfinis, classifications.

**Chargement.** `--ref famille=fichier.xlsx`, répétable. Sans préfixe de famille, elle est
devinée d'après le nom du fichier (`Taux-horaires-2026.xlsx` → `taux`). Le lecteur est
volontairement tolérant : il parcourt les feuilles du classeur, cherche une colonne
d'identifiant (`#`, `id`, `identifiant`…) et une colonne de libellé (`Libellé`, `Intitulé`,
`Name`, `Label`…), et ignore tout le reste. Fichier absent, illisible ou sans couple
identifiant / libellé exploitable : il est signalé dans le rapport et la génération continue.

**Principe non négociable** : l'absence d'un référentiel dégrade la lisibilité, elle n'empêche
jamais de produire le dossier. Un `‹taux #521›` est un résultat acceptable ; une génération
refusée faute de fichier ne l'est pas.

**Effet.** Sur une valorisation de cachet du premier environnement :

> sans référentiel — *si fonction = ‹fonction #175› → ‹taux #521›*
> avec référentiels — *si fonction = ‹fonction #175› → « Cachet répétition A »*

**Vigilance.** Le lecteur accepte tout classeur comportant un identifiant et un libellé : passer
par erreur l'export des règles comme référentiel de taux « fonctionnerait » et produirait des
noms faux. Le rapport affiche le nombre d'entrées chargées par famille — un total aberrant
(des centaines de « taux ») signale une erreur de fichier.

## Ce qu'il ne faut jamais réintroduire

- La mise en gras des mots-clés de formule à l'intérieur des cellules : testé, rejeté par le
  client, pas probant visuellement.
- Un onglet par type de contrat, ou une matrice sur un onglet séparé : le client a explicitement
  abandonné le regroupement par contrat au profit des colonnes de filtre.
- Les colonnes « Type de règle », « Visible dans #Dièse », « Nombre de contrats concernés »,
  « Familles concernées », « Dépend de », « Utilisée par » : retirées, le Cartographe GTA joue
  ce rôle.
- Les sections « Chiffres clés » et « Référentiels utilisés » dans le Lisez-moi. (Le mode
  d'emploi des colonnes, retiré auparavant, a été réintroduit en v1.9 à la demande du client.)
- La détection du type de contrat par préfixe du libellé de la règle.
- De la syntaxe de formule brute ou du jargon technique dans la colonne « Ce que fait la règle ».
- Des données d'un client précédent codées en dur dans les scripts : tout se pilote par les
  entrées.

## Note de lecture utile au client

`Affiché dièse ? = 0` ne signifie pas qu'une règle est inactive : elle s'exécute, son résultat
n'apparaît simplement pas à l'écran. Sur le jeu de test, 277 règles sont dans ce cas, dont 237
servent de calcul intermédiaire à d'autres règles. Celles qui ne sont ni affichées, ni
référencées, ni affectées (8 cas) sont en revanche de vraies règles mortes : un constat à
remonter au client, jamais un motif de les masquer du dossier.

## Versions

- **v2.0** — Atelier GTA : fusion du Cartographe GTA v3.5.2 et du dossier de paramétrage dans
  une seule page, sur un moteur unique. Moteur sans pandas (`tables.py`), modèle
  d'environnement (`model.py`) avec dépendances et audit, Web Worker Pyodide et openpyxl embarqué,
  Explorer alimenté par le modèle avec la phrase en clair dans le panneau de détail, onglets
  Catalogue, Audit et Dossier client. Tests `modele.py` et `navigateur.py`. Non-régression :
  classeurs identiques à la v1.9 cellule par cellule (jeu synthétique et 174 règles réelles de La
  Villette reconstituées depuis la base, français et anglais), jeu réduit, contrôle `_003`/`_045`
  et robustesse inchangés ; dépendances identiques au Cartographe sur les mêmes 174 règles.

- **v1.9** — stabilité et Lisez-moi. Robustesse aux exports abîmés (`ExportError`, anomalies
  consignées et restituées par le diagnostic, garde-fou sur le traducteur de formules), 16 cas
  de test synthétiques (`tests/robustesse.py`, rejoué par le workflow). Lisez-moi : mode d'emploi
  des colonnes du catalogue et du lexique, hauteurs de ligne calculées. Mise en page
  d'impression sur les trois onglets. Sortie par défaut nommée d'après le client et la date ;
  `--contrats contrats` par défaut. Code mort retiré (mise en gras des mots-clés, `PLURALS`,
  `PARAM_FR`, `Resolver.other`). Catalogue et lexique inchangés par rapport à la v1.8 sur le jeu
  réduit, le contrôle `_003` / `_045` et un export synthétique ; comparaison sur les exports de
  référence complets à rejouer quand ils seront à disposition.

- **v1.8** — `_003` et `_045` recalés sur le code #Dièse, après contrôle de 32 règles réelles
  (quatre bases). Services classiques et types de jour combinés comme le moteur (sans type de
  jour, « Yes » = services classiques uniquement) ; services accolés reconnus sur l'id `0` ;
  palier à 0 rendu « ne compte pas » ; durée hors barème signalée (valeur réelle conservée) ;
  plage `_045` début ≥ fin lue jusqu'au lendemain. Méthode de non-régression différentielle.
  Voir `references/moteur-diese.md` § 9. Non-régression validée sur les trois environnements
  de référence (967 règles, français et anglais).

- **v1.7** — enseignements tirés du code et de quatre bases #Dièse (`references/moteur-diese.md`).
  Barèmes : mot-clé `reel` lu, modes palier / tranches cumulées distingués, tranche illisible →
  repli explicite (`UnreadableParam`). Paramètres : doublons de libellés conservés (`Params`),
  lecture par position (`nth`), détection d'ambiguïté (`AmbiguousParam`). Nouveaux handlers
  `_003` Count_Hours_Per_Shift et `_045` Bank_holiday_hours_worked (46 types couverts). Types
  de jour non résolus regroupés et traduits ; nom de type du repli traduit. Jeu réduit
  `tests/jeu_reduit.py`. Jamais publiée au catalogue : remplacée par la v1.8.

- **v1.6** — onglet « Lexique des types de jour », alimenté par `load_daytype_details()` (lecture
  bilingue des colonnes, extraction de la couleur depuis le HTML de l'export) et
  `daytype_usage()` (nombre de règles s'appuyant sur chaque type). Favicon du Cartographe sur
  l'outil web.
- **v1.5** — `identify_files()` : identification d'un lot de fichiers par leur contenu, pour le
  dépôt en vrac de l'outil web comme pour une session Claude.
- **v1.4** — chargement des référentiels complémentaires fournis par l'utilisateur (`--ref`),
  avec détection de la famille par nom de fichier, lecture tolérante des colonnes, rapport de
  chargement et diagnostic qui ne réclame plus que ce qui manque encore. Non bloquant par
  construction.
- **v1.3** — sortie bilingue français / anglais : catalogue de formulations `M`, typographie et
  séparateurs décimaux localisés, noms de familles de référentiels traduits, glossaire des clés
  de paramètres pour le repli, en-têtes et Lisez-moi anglais. La langue est demandée à
  l'utilisateur, jamais déduite. Vérifié sur les trois environnements dans les deux langues.
- **v1.2** — détection des trois habillages de colonnes #Dièse (français récent, anglais récent,
  anglais ancien) ; lecture bilingue des clés et des valeurs de paramètres ; garde-fou
  `MissingParam` contre les descriptions dégradées ; 25 nouveaux types de règle traités, portant
  la couverture à 44 types ; contrôle préalable `--diagnostic` qui réclame les référentiels
  manquants avant génération. Validé sur trois environnements, 967 règles, zéro repli.
- **v1.1** — identité des contrats par id (correction des collisions de colonnes), nettoyage
  HTML des libellés d'affectation, hauteur d'en-tête adaptée aux libellés longs, retrait de
  l'option de regroupement par famille. Validé sur deux environnements : 636 et 173 règles.
- **v1.0** — première version, calibrée sur un environnement unique de 636 règles.
