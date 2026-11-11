# Companion Stock

Site statique du démonstrateur Companion Stock : une IA suit le CAC 40 et le DAX et simule des trades (fictifs, aucun ordre n'est passé).

Le moteur, qui tourne sur un PC, dépose toutes les 45 secondes par SFTP deux fichiers, `cac40.json` et `dax.json`, à la racine du site. Le site relit ces fichiers toutes les 45 secondes et affiche ce qu'ils contiennent.

- Format des fichiers JSON : [FORMAT_JSON.md](FORMAT_JSON.md)
- Exemples complets : [cac40.json](cac40.json) (avec position ouverte) et [dax.json](dax.json) (sans position)

## Contenu

| Fichier | Rôle |
| --- | --- |
| `index.html` | Le site (une seule page : CAC 40, et DAX à l'adresse `#dax`) |
| `assets/app.js` | Chargement des JSON et affichage |
| `assets/curve.js` | Courbe SVG (jours placés bout à bout, sans trou la nuit) |
| `assets/about.js` | Texte de la page About (FR / EN) |
| `assets/style.css` | Styles (clair / sombre, mobile) |
| `assets/img/robot.svg` | Robot du logo (icône d'onglet) |
| `assets/logo/` | Propositions de logo et page de test du robot animé (`test-anime.html`), non nécessaires en ligne |
| `dist/` | **Les 3 fichiers à envoyer sur OVH**, générés par `tools/build_single.py` |
| `tools/build_single.py` | Fabrique `dist/index.html`, le site en un seul fichier |
| `tools/make_sample.py` | Génère des JSON d'exemple aléatoires |
| `tools/send_json.py` | Vérifie les JSON et les envoie sur le site par SFTP |
| `tools/send_json.example.ini` | Modèle de configuration SFTP |

Aucune librairie. Les sources restent en plusieurs fichiers pour le développement. Pour l'hébergement, `tools/build_single.py` les rassemble en un seul `index.html`.

## Robot du logo

Le robot à côté du nom (yeux en bougies) est dessiné dans `assets/app.js` et animé en CSS : regard qui glisse légèrement, clignement à intervalle aléatoire. Son antenne indique l'état du moteur d'après l'heure `updated` du JSON :

| Antenne | État | Âge des données |
| --- | --- | --- |
| Verte, qui pulse | IA en ligne | 3 min ou moins |
| Orange, qui pulse | IA en retard | 15 min ou moins |
| Rouge, fixe | IA hors ligne | plus de 15 min, ou JSON illisible |

Le détail s'affiche au survol du logo.

## Tester en local

```bash
python3 -m http.server 8737
```

Puis ouvrir http://localhost:8737.

## Envoyer les JSON depuis le PC du moteur

Une seule fois :

1. Installer Python 3, puis la bibliothèque SFTP :
   ```bash
   pip install paramiko
   ```
2. Copier `tools/send_json.example.ini` en `tools/send_json.ini` et le remplir (serveur, identifiant, dossier du site). Le mot de passe peut aussi être mis dans la variable d'environnement `COMPANION_SFTP_PASSWORD`. Ne jamais publier `send_json.ini`.

Ensuite, après chaque écriture des fichiers, le moteur lance :

```bash
python tools/send_json.py cac40.json dax.json
```

Pour chaque fichier, le script vérifie le format, l'envoie sous `<fichier>.tmp`, puis le renomme. Un fichier mal formé n'est pas envoyé : le site garde la version précédente et le problème est écrit dans la console.

| Code de sortie | Signification |
| --- | --- |
| 0 | Tout est envoyé |
| 1 | Au moins un fichier est invalide (les autres sont envoyés) |
| 2 | L'envoi a échoué (réseau, identifiants, clé du serveur) |

Autres usages :

- `python tools/send_json.py --check cac40.json dax.json` : vérifier sans envoyer.
- `python tools/send_json.py --loop 45 cac40.json dax.json` : envoyer toutes les 45 s sans s'arrêter, si le moteur ne peut pas lancer le script lui-même.

À la première connexion, la clé du serveur est mémorisée dans `tools/known_hosts`. Si elle change ensuite, l'envoi est refusé : supprimer ce fichier si le changement est normal.

## Déployer

### Sur GitHub Pages

Le site est publié à l'adresse https://bigbangx6.github.io/companion-stock/ une fois GitHub Pages activé (Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`). Chaque modification poussée sur `main` est republiée en une minute environ. Le fichier `.nojekyll` demande à GitHub de servir les fichiers tels quels.

Sur GitHub Pages, le site affiche les `cac40.json` et `dax.json` présents dans le dépôt : ce sont des exemples figés, et le robot indique donc « IA hors ligne ».

### Sur l'hébergement principal (OVH)

Le site en ligne tient en **3 fichiers**, tous dans le dossier `dist/` :

| Fichier | Contenu |
| --- | --- |
| `index.html` | Tout le site : pages, style, scripts, texte About, drapeaux, robot |
| `cac40.json` | Données du CAC 40 (exemple ; le moteur le remplace) |
| `dax.json` | Données du DAX (exemple ; le moteur le remplace) |

Les déposer à la racine du site. Pour une mise à jour du site, seul `index.html` change.

Après toute modification des sources, régénérer ce fichier et committer `dist/` :

```bash
python3 tools/build_single.py
```

Une vérification GitHub (« Fichier unique à jour ») échoue si on a oublié de le faire. `dist/` est aussi visible sur GitHub Pages, à l'adresse https://bigbangx6.github.io/companion-stock/dist/ : c'est exactement ce qui partira chez OVH.

Adresses : `companionstock.ai` affiche le CAC 40, `companionstock.ai/#dax` le DAX, et `#about` (ou `#dax/about`) ouvre la fenêtre À propos.

L'ancienne méthode, qui consiste à copier tous les fichiers sources, marche toujours :

Copier tous les fichiers (sauf `tools/`, `assets/logo/`, `README.md` et `FORMAT_JSON.md`) sur l'hébergement. Le moteur remplace ensuite `cac40.json` et `dax.json`.
