# GTA Cartographe

> Visualisation interactive du paramétrage GTA (Gestion du Temps et des Activités) du logiciel **#Dièse**, à partir des exports Excel client.

Outil destiné aux chargés de mission, consultants et responsables paie qui auditent ou paramètrent #Dièse pour des structures du secteur culturel (théâtres, opéras, festivals, structures de spectacle).

## À quoi ça sert

Tu disposes d'un export Excel des règles GTA d'un client #Dièse et tu veux comprendre rapidement comment ses calculs sont chaînés ? Cet outil produit une **cartographie graphique interactive** : graphe des règles, dépendances entre elles, types de jour utilisés, anomalies détectées, optimisations possibles. Pratique pour :

- préparer un audit du paramétrage,
- identifier les références cassées et les optimisations possibles,
- présenter un calcul à un client ou un nouveau collaborateur,
- archiver une vue d'un paramétrage à une date donnée.

## Comment l'utiliser

1. Ouvrir la page dans un navigateur récent (Chrome, Firefox, Safari, Edge).
2. Cliquer sur **Charger règles…** et choisir l'export Excel des règles GTA #Dièse.
3. Optionnel mais recommandé : cliquer sur **Charger types de jour…** et charger l'export *Contrats-GTA-Absences-présences* du même client. Ça active les chips colorés des types de jour et la cohérence des références.
4. Naviguer dans le graphe. Quelques actions utiles :
   - clic sur une règle → met en évidence ses antécédents (amont) et descendants (aval)
   - clic sur un type de jour dans le panneau gauche → met en évidence toutes les règles qui le consomment
   - filtre par affectation (contrat) → isole le paramétrage d'un type de contrat
   - bouton **Réorganiser** → recalcule la disposition si jamais tu n'aimes pas celle proposée

## Formats d'export acceptés

L'outil détecte automatiquement deux formats #Dièse :

- **Format anglais** (export ancien) — colonnes `id`, `rule_type`, `libelle`, `parametres`, `affectations`, `compteur`, `periode`…
- **Format français** (export récent) — colonnes `#`, `Règle`, `Paramètres`, `Libellé`, `Code`, `Compteur ?`, `Période`, `Affectations`, `Règle manuelle`, `Calcul budget ?`, `Affiché dièse ?`…

Les types de jour sont lus depuis l'onglet `Export DIESE` du fichier *Contrats-GTA-Absences-présences*.

## Vie privée

L'outil tourne **entièrement dans ton navigateur**. Il n'y a pas de serveur, pas de base de données, pas de télémétrie. Les fichiers Excel que tu charges restent sur ta machine — ils ne sont **jamais envoyés ailleurs**. Tu peux ouvrir la page hors-ligne après son premier chargement (les bibliothèques JavaScript sont mises en cache par le navigateur).

## Fonctionnalités

**Visualisation**
- Graphe stable verrouillé après mise en page (les positions ne bougent plus pendant ta session de travail)
- Filtre par type de règle et par affectation contractuelle
- Recherche full-text sur libellés, codes, types et **paramètres** (« qui utilise rule77 ? », « qui a un seuil 1440 ? »)
- Couche optionnelle « Types de jour » : ajoute en halo radial les types de jour autour des règles qui les consomment

**Lecture des règles**
- Dictionnaire FR de 56 `rule_type` documentés (description métier de chaque type)
- Paramètres rendus en blocs lisibles (un paramètre par ligne)
- Formules `_039` indentées sur les opérateurs de niveau 0
- Seuils décodés en mini-tableau « de | à | valeur »
- Chips colorés pour les types de jour (couleur réelle du référentiel #Dièse)
- `ruleN` et `htimeN` cliquables dans les formules pour naviguer

**Audit**
- Indicateur d'**appels caducs** dans l'en-tête : pill vert si aucune référence cassée, rouge avec popover détaillé sinon
- Indicateur d'**optimisations possibles** sur les formules : formules identiques entre règles, branches `if(then == else)` constantes, sous-expressions `ruleA+ruleB+ruleC` apparaissant dans 3+ formules, profondeur d'imbrication `if` excessive

## Fichiers Excel d'exemple

L'outil démarre vide — la première utilisation passe par le chargement de tes propres exports. Pour avoir un exemple à essayer, demande à ton équipe l'export d'un client référence.

## Tech

- HTML/CSS/JavaScript autonome, aucun build step
- [vis-network](https://visjs.org/) pour la visualisation interactive du graphe
- [SheetJS](https://sheetjs.com/) pour la lecture des fichiers Excel côté navigateur
- Chargé depuis CDN public — aucun backend, aucun build
- Compatible navigateurs modernes (Chrome / Firefox / Safari / Edge récents)

## Hébergement

Cette page peut être hébergée tel quel sur n'importe quel hébergeur statique (GitHub Pages, Netlify, Vercel, S3, Apache/Nginx). Aucun environnement d'exécution serveur requis.

## Crédit

Conçu et maintenu par **Yannick Trioux** chez [it4culture](https://it4culture.com), pour faciliter le travail d'audit et de paramétrage des modules GTA #Dièse au sein de l'équipe et chez les clients du secteur culturel.

## Licence

À définir par l'auteur (MIT recommandé pour un usage public).

---

*Pour toute remarque, suggestion d'amélioration ou bug rencontré : ouvrir un Issue sur ce dépôt ou contacter directement Yannick.*
