# Companion Stock — Format du fichier JSON

## Principe

Le moteur écrit deux fichiers, `cac40.json` et `dax.json`, et les dépose sur le site par SFTP toutes les 45 secondes. Ces fichiers sont la seule source de données du site : cours de l'indice, position en cours, courbe, performances et historique. Le site ne calcule rien, il affiche ce qu'il reçoit.

Les deux fichiers ont exactement la même structure. Seuls le nom de l'indice et les valeurs changent.

Le moteur achète un **Call** (gain si l'indice monte) ou un **Put** (gain si l'indice baisse), puis le revend. Le champ `type` dit lequel des deux ; l'achat et la vente sont décrits par les heures et les prix.

## Exemple complet

Voici un `cac40.json` valide. La courbe est raccourcie ici à quelques points ; en réalité elle en contient environ 500. Des fichiers complets sont fournis à la racine du dépôt : [`cac40.json`](cac40.json) et [`dax.json`](dax.json).

```json
{
  "index": "CAC 40",
  "updated": "2026-11-10 15:42",

  "price": {
    "value": 8123.4,
    "change_pct": 0.42,
    "time": "2026-11-10 15:42"
  },

  "position": {
    "type": "call",
    "price": 8090.0,
    "time": "2026-11-07 10:15",
    "pnl_pct": 0.41
  },

  "curve": [
    ["2026-11-07 09:00", 8075.0],
    ["2026-11-07 09:05", 8081.6],
    ["2026-11-10 15:35", 8119.9],
    ["2026-11-10 15:40", 8123.4]
  ],

  "performance": {
    "week":  { "trades": 2,  "pnl_pct": -0.10 },
    "month": { "trades": 4,  "pnl_pct": -2.12 },
    "year":  { "trades": 44, "pnl_pct": 11.51 }
  },

  "trades": [
    {
      "type": "put",
      "open_time": "2026-11-05 14:20",
      "open_price": 8342,
      "close_time": "2026-11-06 11:05",
      "close_price": 8350,
      "pnl_pct": -0.10
    }
  ]
}
```

Quand il n'y a pas de position ouverte, on écrit `"position": null`.

## Les champs

Tous les champs sont obligatoires. Seul `position` peut valoir `null`.

| Champ | Type | Ce que c'est | Ce que le site affiche |
| --- | --- | --- | --- |
| `index` | texte | Nom de l'indice : `"CAC 40"` ou `"DAX"` | Titre de la page |
| `updated` | heure | Heure à laquelle le moteur a écrit le fichier | « Données mises à jour le 10/11/2026 à 15:42 », en petit |
| `price.value` | nombre | Dernier cours de l'indice, en points | Gros chiffre en haut de page |
| `price.change_pct` | nombre | Variation du jour en %, négative si l'indice baisse | Pastille verte ou rouge |
| `price.time` | heure | Heure de ce cours | « Cours de 15:42 le 10/11/2026 » |
| `position` | objet ou `null` | Call ou Put acheté et pas encore revendu ; `null` s'il n'y en a pas | Bloc « Position en cours », ou « Aucune position en cours » |
| `position.type` | `"call"` ou `"put"` | Produit acheté, en minuscules | Pastille « ▲ Call » ou « ▼ Put » |
| `position.price` | nombre | Niveau de l'indice à l'achat, en points | Ligne pointillée « Call 8 223 » sur la courbe |
| `position.time` | heure | Heure d'achat | Point sur la courbe et durée de la position |
| `position.pnl_pct` | nombre | Gain ou perte actuel en % | Pastille verte ou rouge |
| `curve` | liste | Paires `[heure, valeur]`, de la plus ancienne à la plus récente | La courbe, tracée telle quelle |
| `performance.week` / `month` / `year` | objet | `trades` = nombre de trades, `pnl_pct` = résultat cumulé en % | Tableau « Profit and Loss » |
| `trades` | liste | Trades terminés (achetés puis revendus), du plus récent au plus ancien | Tableau « Derniers trades » |
| `trades[].type` | `"call"` ou `"put"` | Produit acheté puis revendu, en minuscules | Colonne « Produit » |
| `trades[].open_time` / `open_price` | heure / nombre | Achat : heure et niveau de l'indice | Colonne « Achat » |
| `trades[].close_time` / `close_price` | heure / nombre | Revente : heure et niveau de l'indice | Colonne « Vente » |
| `trades[].pnl_pct` | nombre | Résultat du trade en % | Pastille verte ou rouge |

Le site ne déduit jamais une valeur d'une autre : si `pnl_pct` est faux, il affiche une valeur fausse.

## Règles d'écriture

- **Heures** : toujours à l'heure de Paris, au format `"AAAA-MM-JJ HH:MM"`, entre guillemets. Exemple : `"2026-11-10 09:05"`.
- **Nombres** : avec un point décimal, sans guillemets, sans espace ni symbole. On écrit `8123.4`, pas `"8 123,4"`. Les pourcentages sont déjà en % : `0.42` signifie +0,42 %.
- **Courbe** : un point toutes les 5 minutes pendant les heures de bourse sur les 5 derniers jours, soit environ 500 points. Pas de points la nuit ni le week-end. Le site place les jours bout à bout avec un séparateur de date.
- **Ordre des listes** : `curve` va du plus ancien au plus récent ; `trades` va du plus récent au plus ancien.
- **Historique** : les 50 derniers trades suffisent.
- **Envoi** : déposer le fichier sous `cac40.json.tmp`, puis le renommer en `cac40.json`. Sinon un visiteur peut lire un fichier à moitié écrit.
- **Nuit et week-end** : rien de spécial à faire. Le moteur peut continuer d'envoyer le dernier état ou s'arrêter ; le site affiche simplement l'heure des données.

## Vérification avant envoi

- [ ] Le fichier s'ouvre sans erreur dans un validateur JSON
- [ ] `updated` et `price.time` sont à l'heure de Paris
- [ ] Aucun nombre n'est entre guillemets
- [ ] `type` vaut `"call"` ou `"put"`, en minuscules
- [ ] `position` vaut `null` quand aucun trade n'est ouvert
- [ ] `curve` est triée du plus ancien au plus récent
- [ ] `trades` est trié du plus récent au plus ancien
- [ ] Le fichier est envoyé en `.tmp` puis renommé
