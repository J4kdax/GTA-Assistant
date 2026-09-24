# Bibliothèques embarquées

Wheels Python pures installées par le moteur dans le navigateur (`app/engine-worker.js`), sans
passer par PyPI ni par micropip :

| Fichier | Rôle | Source |
|---|---|---|
| `openpyxl-3.1.5-py2.py3-none-any.whl` | lecture et écriture des classeurs Excel | PyPI |
| `et_xmlfile-2.0.0-py3-none-any.whl` | dépendance d'openpyxl | PyPI |

Pour changer de version : remplacer le fichier, mettre à jour `WHEELS` dans
`app/engine-worker.js` et la version épinglée dans `.github/workflows/ci.yml`, puis rejouer
`tests/navigateur.py`.
