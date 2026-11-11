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
| `assets/img/robot.svg` | Robot du logo (icône d'onglet) |
| `assets/logo/` | Propositions de logo et page de test du robot animé (`test-anime.html`), non nécessaires en ligne |
| `tools/make_sample.py` | Génère des JSON d'exemple aléatoires |
| `tools/send_json.py` | Vérifie les JSON et les envoie sur le site par SFTP |
| `tools/send_json.example.ini` | Modèle de configuration SFTP |

Aucune librairie ni étape de compilation : on copie les fichiers tels quels sur l'hébergement.

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

### Sur l'hébergement principal

Copier tous les fichiers (sauf `tools/`, `assets/logo/`, `README.md` et `FORMAT_JSON.md`) sur l'hébergement. Le moteur remplace ensuite `cac40.json` et `dax.json`.
