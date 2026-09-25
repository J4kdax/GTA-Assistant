# Historique

## v2.2 — 25/09/2026 — Nouvelle page d'accueil, remise à zéro

**Nouveau**

- Page d'accueil refaite (maquette B validée) : accroche courte « Un export #Dièse. Quatre
  outils. », zone de dépôt animée, trois étapes, et quatre cartes d'outils avec un aperçu animé.
  Une fois l'environnement chargé, les cartes affichent ses vrais chiffres (règles, dépendances,
  règles décrites en clair, points à corriger, colonnes de contrat) et leurs aperçus reprennent
  ses premières règles et ses principaux constats ; un clic ouvre l'outil.
- Bouton **Réinitialiser / Reset** dans l'en-tête : après confirmation, vide l'environnement
  (fichiers, graphe, catalogue, audit, formulaire du dossier) pour charger celui d'un autre
  client. La fenêtre de confirmation se ferme avec Échap ou Annuler ; rien n'est supprimé de
  l'ordinateur. Une analyse en cours au moment du vidage est ignorée.
- Anglais : l'onglet « Client dossier » devient « Client file », et les textes de l'interface
  parlent de *file* (le classeur lui-même garde son titre).
- Le bouton « Reset » du graphe, qui efface la sélection et les filtres, s'appelle désormais
  « Désélectionner / Deselect » pour ne pas être confondu avec la remise à zéro.

**Qualité**

- `tests/navigateur.py` couvre aussi les cartes de l'accueil et la remise à zéro (annulation,
  Échap, vidage, chargement d'un autre environnement).

## v2.1.1 — 25/09/2026 — Balises dans les libellés

- Toute balise HTML des libellés (règles, libellés courts, codes, affectations, types de jour) est
  retirée et son texte gardé : `<small>GEN</small><br>Credit` donne « GEN » puis « Credit » sur
  la ligne suivante. Auparavant seules `<b>`, `<i>`, `<u>`, `<strong>`, `<em>`, `<span>`, `<div>` et
  `<p>` l'étaient, et `<small>` restait visible dans le classeur.
- Les comparaisons écrites dans les libellés (« 00h < H < 08h ») ne sont pas prises pour des
  balises. Les espaces insécables (`&nbsp;`) deviennent des espaces.
- `tests/robustesse.py` : 17 cas.

## v2.1 — 24/09/2026 — Interface bilingue

**Nouveau**

- Interface entièrement disponible en anglais : slider **FR | EN** dans l'en-tête, utilisable à
  tout moment (clic, ou flèches du clavier). Tous les onglets, l'Explorer, ses fenêtres
  d'analyse, les pastilles d'audit du graphe, le panneau de détail et l'export PDF d'une règle
  basculent sans recharger l'environnement ni perdre la disposition du graphe.
- La langue est mémorisée d'une visite à l'autre ; à la première visite, elle suit celle du
  navigateur.
- Le dossier client prend par défaut la langue de l'interface (toujours modifiable dans
  l'onglet Dossier client).
- Dictionnaire anglais des 64 types de règle documentés de l'Explorer
  (`app/explorer/02b-constantes-en.js`).
- Le catalogue suit la langue de l'interface : le sélecteur FR / EN propre au catalogue disparaît.

**Moteur**

- Le modèle fournit aussi en anglais ce qui n'existait qu'en français : constats d'audit
  (`titre_en`, `note_en`), relevé du diagnostic (`diagnostic_texte_en`), référentiels manquants
  (`referentiels_manquants`, libellés et exports à demander dans les deux langues), rapport de
  chargement des référentiels (`referentiels_en`), format détecté (`format_en`), catégorie des
  types de jour (`categorie_en`), anomalies d'export.
- `identify_files` renvoie aussi un classement structuré (`fichiers`, `manque_codes`), traduit
  par l'interface.
- `format_diagnosis(d, lang)` et `load_referentials(specs, lang)` acceptent une langue ; la ligne
  de commande reste en français.
- Classeurs identiques à la v2.0 cellule par cellule.

**Qualité**

- `tests/navigateur.py` bascule en anglais, parcourt tous les onglets et l'audit du graphe en
  cherchant des mots français restés visibles (hors libellés du client), vérifie la mémorisation
  après rechargement et compare les dossiers FR et EN téléchargés à la ligne de commande.

## v2.0 — 24/09/2026 — Atelier GTA

Première version de l'Atelier : fusion du Cartographe GTA v3.5.2 et du Dossier de paramétrage
v1.9 sur un moteur unique.

**Nouveau**

- Une page, cinq onglets : Accueil, Explorer, Catalogue, Audit, Dossier client.
- Dépôt des exports en vrac, n'importe où dans la fenêtre ; ajouter un référentiel relance
  l'analyse.
- Explorer : la phrase en clair de chaque règle (celle du dossier client) en tête du panneau de
  détail.
- Catalogue à l'écran : recherche, filtre par type de contrat, compteurs, descriptions en
  français ou en anglais, lien vers le graphe.
- Audit unifié : renvois vers une règle absente, `rule` sans numéro, anomalies d'export, règles
  mortes, règles sans affectation, replis, types de jour inutilisés, référentiels à réclamer.
- Modèle d'environnement (`engine/model.py`), utilisable aussi en ligne de commande.

**Moteur**

- Plus de pandas : lecture des classeurs par openpyxl (`engine/tables.py`). Le moteur démarre
  dans le navigateur sans télécharger pandas ni numpy, et openpyxl est installé depuis `vendor/`.
- Le moteur tourne dans un Web Worker : la page reste fluide pendant son chargement.
- Classeurs identiques à la v1.9, cellule par cellule, sur le jeu synthétique et sur 174 règles
  réelles, en français et en anglais.

**Explorer (ex-Cartographe)**

- Le fichier unique de 331 Ko est découpé en modules (`app/explorer/`), sans changement de
  comportement.
- La lecture SheetJS des classeurs est supprimée : les règles, types de jour et dépendances
  viennent du modèle. Dépendances identiques à celles du Cartographe sur 174 règles réelles.
- `RULE_SPECS` sort du HTML : `data/rule_specs.json` (185 types de règle).

**Qualité**

- CI : version cohérente, absence de pandas, analyse statique, catalogue bilingue, jeu réduit,
  contrôle `_003`/`_045`, robustesse (16 cas), contrat du modèle (6 contrôles), parcours complet
  dans Chromium, paquet `.skill`.

## Avant la v2.0

- Dossier de paramétrage : v1.0 à v1.9, voir l'historique de `skill/SKILL.md`.
- Cartographe GTA : v1 à v3.5.2, dépôt `GTA-Assistant`.
