# Jeux de test

Six niveaux de contrôle, du plus rapide au plus complet. Les cinq premiers tournent sans
fichier client et sont rejoués par le workflow `ci.yml` à chaque push.

## 1. Jeu réduit, rejouable sans fichier client

`python tests/jeu_reduit.py` décrit 10 règles, en français et en anglais : 7 règles réelles de
Châtelet remises au format de l'export, plus 3 cas synthétiques. Ces cas couvrent les barèmes
`reel`, les libellés de paramètres dupliqués (`_045`) et une tranche de barème volontairement
illisible.

Attendu : 20 descriptions, dont exactement 2 replis (la règle #9002, dans chaque langue).
À lancer après toute modification de `humanizer.py` ou de `dossier_common.py`.

## 2. Contrôle `_003` / `_045`

`python tests/controle_003_045.py` rejoue 32 règles réelles extraites de quatre bases
(24/09/2026, libellés anonymisés) et vérifie le sens des descriptions contre le code #Dièse
(`skill/references/moteur-diese.md` § 9). Attendu : 0 repli, 0 échec. Code de sortie non nul
en cas d'écart.

## 3. Robustesse aux exports abîmés

`python tests/robustesse.py` fabrique dans un dossier temporaire des exports synthétiques
« abîmés » et vérifie que le générateur produit un classeur exploitable ou refuse avec un
message clair (`ExportError`), jamais une trace Python : trois habillages de colonnes, export
vide, valeurs vides, cases Compteur en texte, lignes sans identifiant, doublons, feuille de notes
en tête, panne simulée du traducteur, export de types de jour illisible, échantillon hors
fichier, sortie par défaut, mauvais fichier, colonne absente, fichier absent ou non Excel, et
balises HTML dans les libellés (`<small>`, `<font>`…) sans toucher aux comparaisons « < »,
alignement du Lisez-moi sur les colonnes du catalogue. Attendu : 17 cas, 0 échec (9 échouaient
en v1.8).

## 4. Contrat du modèle d'environnement

`python tests/modele.py` vérifie la forme du modèle que lisent tous les onglets de l'Atelier
(`engine/model.py`) : champs de chaque règle et de chaque type de jour, ordre d'exécution,
dépendances, contrats, constats d'audit. Un champ renommé casserait l'interface sans erreur
Python. Attendu : 6 contrôles, 0 échec.

## 5. Parcours complet dans le navigateur

`python tests/navigateur.py` (Playwright + Chromium) sert le dépôt en local, dépose deux exports
synthétiques, parcourt Accueil, Catalogue (FR / EN), Explorer, Audit et Dossier client, bascule le
thème, télécharge le dossier et vérifie qu'il est identique, cellule par cellule, au classeur
produit en ligne de commande. Échoue sur toute erreur de console. Sans accès à jsDelivr,
`ATELIER_CDN_LOCAL=<dossier>` sert Pyodide et vis-network depuis des copies des paquets npm.

## 6. Non-régression sur les exports de référence

Les exports de référence ne sont **pas** versionnés dans ce dépôt : ils contiennent du
paramétrage client. Ils sont rangés dans l'espace interne IT4culture et déposés manuellement au
moment des tests, un sous-dossier par environnement :

```
tests/
├── client-1/  Contrats-GTA-Règles-20260921234349.xlsx  +  Contrats-GTA-Absences-présences-*.xlsx
├── client-2/  Contrats-GTA-Règles-20260922010759.xlsx  +  …
└── client-3/  Contrats-GTA-Règles-20260922082411.xlsx  +  …
```

(`tests/client-*/` est à ajouter au `.gitignore`.)

**Méthode : comparaison différentielle.** Passer la version précédente et la nouvelle sur les
mêmes exports, puis comparer les descriptions règle par règle. Un texte modifié hors des types
de règle touchés par la version est une régression ; un texte modifié sur un type touché se
vérifie contre le code #Dièse.

### Attendu, en français comme en anglais (validé en v1.8, le 24/09/2026)

En v2.0, la comparaison v1.9 → v2.0 a été faite sur un export de La Villette reconstitué depuis
la base (174 règles, 37 types de jour) : classeurs identiques cellule par cellule. Les trois
exports de référence ci-dessous restent à rejouer.

| Mesure | Attendu |
|---|---|
| Règles décrites | 967 (636 + 173 + 158) |
| Replis en paramétrage brut | 0 |
| Descriptions dégradées | 0 — jamais |
| Fragments de formule non traduits | 4, tous sur le client 1 (3 calculs de dates, 1 `rule` sans numéro) |

Le « 967 / 967 correctes » des versions antérieures était surévalué : jusqu'à la v1.6, trois
barèmes à virgule décimale (`0,5`) étaient lus `0` sans alerte (client 1 #722, client 3 #13 et
#173). Corrigé depuis la v1.7.

Les chiffres doivent être identiques en français et en anglais. Une divergence signale une
formulation absente du catalogue `M` de `humanizer.py`.
