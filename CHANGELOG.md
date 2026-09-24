# Historique

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
