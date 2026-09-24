# Passer des deux anciens outils à l'Atelier

L'Atelier remplace le Cartographe GTA (`GTA-Assistant`) et le Dossier de paramétrage
(`GTA_ParamFile`). Les deux anciennes adresses restent en ligne le temps que l'équipe change ses
favoris.

## 1. Publier l'Atelier

Pousser ce dépôt, activer GitHub Pages (branche `main`, racine), puis vérifier sur l'URL publiée :
dépôt d'un export, les cinq onglets, téléchargement du dossier. La CI (`ci.yml`) doit être verte,
y compris le job `navigateur`.

## 2. Signaler le changement sur l'ancien Cartographe

Dans `GTA-Assistant/index.html`, juste après `<body>`, ajouter ce bandeau en remplaçant l'URL :

```html
<div style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;
  background:#1d1d1f;color:#fff;padding:10px 16px;border-radius:10px;font:13px -apple-system,sans-serif">
  Le Cartographe évolue : il fait désormais partie de
  <a href="https://URL-DE-L-ATELIER/" style="color:#6cb4ff">l'Atelier GTA</a>.
</div>
```

Après quelques semaines, remplacer le contenu de la page par une redirection :

```html
<meta http-equiv="refresh" content="0; url=https://URL-DE-L-ATELIER/#explorer">
```

## 3. Archiver le dépôt du Dossier de paramétrage

`GTA_ParamFile` n'a plus de raison d'évoluer : le moteur vit dans `engine/` et le skill dans
`skill/`. Ajouter en tête de son README un renvoi vers ce dépôt, puis l'archiver
(*Settings → Archive this repository*).

## 4. Mettre à jour le skill Claude

Télécharger l'artefact `dossier-parametrage-gta-v2.0` produit par la CI, puis l'importer dans
Claude (*Paramètres → Skills*), à la place de la version 1.x.
