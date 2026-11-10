# Companion Stock

Site statique du démonstrateur Companion Stock : une IA suit le CAC 40 et le DAX et simule des trades (fictifs, aucun ordre n'est passé).

Le moteur, qui tourne sur un PC, dépose toutes les 45 secondes par SFTP deux fichiers, `cac40.json` et `dax.json`, à la racine du site. Le site relit ces fichiers toutes les 45 secondes et affiche ce qu'ils contiennent.

- Format des fichiers JSON : [FORMAT_JSON.md](FORMAT_JSON.md)
- Exemples complets : [cac40.json](cac40.json) (avec position ouverte) et [dax.json](dax.json) (sans position)

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page CAC 40 |
| `dax.html` | Page DAX |
| `assets/app.js` | Chargement des JSON et affichage |
| `assets/curve.js` | Courbe SVG (jours placés bout à bout, sans trou la nuit) |
| `assets/about.js` | Texte de la page About (FR / EN) |
| `assets/style.css` | Styles (clair / sombre, mobile) |
| `tools/make_sample.py` | Génère des JSON d'exemple aléatoires |

Aucune librairie ni étape de compilation : on copie les fichiers tels quels sur l'hébergement.

## Tester en local

```bash
python3 -m http.server 8737
```

Puis ouvrir http://localhost:8737.

## Déployer

Copier tous les fichiers (sauf `tools/`, `README.md` et `FORMAT_JSON.md`) sur l'hébergement. Le moteur remplace ensuite `cac40.json` et `dax.json`.
