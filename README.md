# Atelier GTA #Dièse

Les outils GTA d'IT4culture réunis sur une seule page : on dépose une fois les exports #Dièse
d'un client, et l'Atelier en tire le graphe des règles, l'audit du paramétrage, le catalogue des
règles en langage clair et le dossier de paramétrage à remettre au client.

Il succède à deux outils qui lisaient les mêmes exports chacun de leur côté :

- le **Cartographe GTA** v3.5.2 (dépôt `GTA-Assistant`), devenu l'onglet **Explorer** ;
- le **Dossier de paramétrage** v1.9 (dépôt `GTA_ParamFile`), devenu les onglets **Catalogue** et
  **Dossier client**, ainsi que le skill Claude `dossier-parametrage-gta`.

**Tout s'exécute dans le navigateur.** Aucun fichier client n'est envoyé à un serveur.

L'interface existe en **français et en anglais** : le slider FR | EN de l'en-tête bascule toute
la page à n'importe quel moment, et le dossier client prend par défaut la même langue. Les
libellés venant de l'environnement du client (règles, contrats, types de jour) restent dans leur
langue d'origine, pour qu'on les retrouve à l'identique dans #Dièse.

---

## Les onglets

| Onglet | Ce qu'il fait |
|---|---|
| Accueil | Dépôt des exports en vrac, reconnus à leurs colonnes ; synthèse de l'environnement |
| Explorer | Graphe des dépendances entre règles (ex-Cartographe), avec la phrase en clair de chaque règle dans le panneau de détail |
| Catalogue | Le contenu du dossier client à l'écran, filtrable par type de contrat et par compteur, en français ou en anglais ; un clic sur le # ouvre la règle dans le graphe |
| Audit | Constats à corriger et à savoir, référentiels à réclamer, et les analyses détaillées du graphe |
| Dossier client | Le classeur Excel (Lisez-moi, catalogue, lexique des types de jour), en français ou en anglais |

Entrées acceptées :

- l'export **Règles GTA** (`Contrats-GTA-Règles-*.xlsx`), obligatoire, dans ses trois habillages
  de colonnes (français récent, anglais récent, anglais ancien) ;
- l'export **Types de jour** (`Contrats-GTA-Absences-présences-*.xlsx`), recommandé ;
- des **référentiels** facultatifs (taux, fonctions, types d'activité…), qui remplacent les
  `‹ chevrons ›` par des noms. Ils ne bloquent jamais la génération.

---

## Architecture

Un moteur Python unique, exécuté dans le navigateur par [Pyodide](https://pyodide.org) dans un
Web Worker, lit les exports **une seule fois** et produit un *modèle d'environnement*. Tous les
onglets lisent ce modèle ; aucun ne relit les fichiers. Une évolution des exports #Dièse se
corrige donc à un seul endroit.

```
exports déposés ──► engine/ (Python, Web Worker) ──► modèle d'environnement (JSON)
                                                    ├─► Explorer   (app/explorer/)
                                                    ├─► Catalogue  (app/views.js)
                                                    ├─► Audit      (app/views.js)
                                                    └─► Dossier    (engine/build_xlsx.py → .xlsx)
```

```
.
├── index.html               coquille : en-tête, onglets, vues
├── app/
│   ├── i18n.js              langue de l'interface : slider FR | EN, L('fr', 'en'), data-en
│   ├── shell.js             dépôt des fichiers, état partagé, navigation
│   ├── engine.js            pont vers le moteur (une promesse par commande)
│   ├── engine-worker.js     Web Worker : Pyodide, openpyxl, modules d'engine/
│   ├── views.js             Accueil, Catalogue, Audit, Dossier client
│   ├── atelier.css          styles de la coquille
│   └── explorer/            le Cartographe GTA v3.5.2, découpé en modules numérotés
├── engine/                  moteur Python (dépend d'openpyxl seulement, pas de pandas)
│   ├── tables.py            lecture des classeurs
│   ├── dossier_common.py    chargement, normalisation, contrats, référentiels, diagnostic
│   ├── humanizer.py         traduction des règles et des formules, catalogue bilingue
│   ├── build_xlsx.py        construction du classeur client
│   └── model.py             modèle d'environnement : règles, dépendances, audit
├── data/rule_specs.json     185 spécifications officielles de types de règle
├── vendor/                  wheels openpyxl + et_xmlfile, installées sans PyPI
├── skill/                   skill Claude : SKILL.md et références (le paquet embarque engine/)
├── tests/                   six niveaux de contrôle (voir tests/LISEZ-MOI.md)
└── .github/workflows/ci.yml contrôles, test navigateur, paquet .skill
```

Aucune étape de construction : le dépôt se publie tel quel.

---

## Mise en ligne

1. Pousser le dépôt sur GitHub.
2. *Settings → Pages* : servir la branche `main`, dossier racine.
3. Ouvrir l'URL publiée.

Premier chargement : Pyodide (environ 6 Mo) est téléchargé depuis jsDelivr, puis mis en cache
par le navigateur. Le moteur démarre en quelques secondes, en arrière-plan : on peut déposer les
fichiers pendant ce temps.

**Confidentialité du dépôt.** `data/rule_specs.json` est extrait du code source de #Dièse.
Vérifier qu'il peut être publié avant de rendre le dépôt public ; sinon, garder le dépôt privé
(GitHub Pages sur un dépôt privé demande une offre payante).

---

## Ligne de commande et Claude

Le moteur s'utilise aussi sans navigateur (`pip install openpyxl`) :

```bash
cd engine
python3 build_xlsx.py --input Contrats-GTA-Règles.xlsx --daytypes Contrats-GTA-Absences-présences.xlsx --diagnostic
python3 build_xlsx.py --input … --daytypes … --client "Opéra de …" --langue fr
python3 model.py --input … --daytypes … > modele.json
```

Le skill Claude `dossier-parametrage-gta` est fabriqué par la CI à partir de `skill/` et
d'`engine/` (artefact `dossier-parametrage-gta-vX.Y`). Pour le mettre à jour dans Claude,
importer ce fichier `.skill` dans les paramètres (Skills). Le site et le skill exécutent le même
code : une correction profite aux deux.

---

## Faire évoluer l'Atelier

- **Avant de toucher au moteur**, lire `skill/SKILL.md` (règles métier, pièges de production, ce
  qu'il ne faut pas réintroduire) et `skill/references/moteur-diese.md`.
- **Un nouvel outil** = une vue dans `index.html` (`<section class="view" data-view="…">`), un
  onglet dans `nav.tabs`, et un objet `render(model)` appelé par `Views.render`. Il lit le modèle,
  jamais les fichiers.
- **Un champ ajouté au modèle** se déclare dans `tests/modele.py`.
- **Tout texte affiché** existe en français et en anglais : `L('Texte', 'Text')` dans le code,
  `data-en="Text"` (ou `data-en-html`, `data-en-title`, `data-en-placeholder`, `data-en-aria`) dans
  le HTML. Un texte produit par du code doit être refait dans `Shell.relabel()` ou
  `Explorer.relabel()` quand la langue change. `tests/navigateur.py` échoue si un mot français
  reste visible en anglais.
- **La version** se change à quatre endroits, vérifiés par la CI : `engine/build_xlsx.py`
  (`VERSION`), `app/shell.js`, le `<title>` d'`index.html`, l'historique de `skill/SKILL.md` et
  `CHANGELOG.md`.
- **Les exports clients ne vont jamais dans le dépôt** (`.gitignore`). Les jeux de référence sont
  rangés dans l'espace interne IT4culture.

---

Conçu par Yannick Trioux, IT4culture. Licence MIT (voir `LICENSE`).
