/*
 * companion_json.h : écrit le fichier JSON lu par le site Companion Stock.
 *
 * Règles (voir FORMAT_JSON.md) :
 *   - les heures sont des textes "AAAA-MM-JJ HH:MM", à l'heure de Paris ;
 *   - les pourcentages sont déjà en % : 0.42 veut dire +0,42 % ;
 *   - type vaut "call" ou "put" ;
 *   - la courbe va du plus ancien au plus récent, les trades du plus récent au plus ancien.
 *
 * Voir exemple.c.
 */
#ifndef COMPANION_JSON_H
#define COMPANION_JSON_H

#ifdef __cplusplus
extern "C" {
#endif

/* Un point de la courbe. */
typedef struct {
    const char *time;   /* "2026-11-10 09:05" */
    double value;       /* 8123.4 */
} cs_point;

/* La position en cours (Call ou Put acheté, pas encore revendu). */
typedef struct {
    const char *type;   /* "call" ou "put" */
    double price;       /* niveau de l'indice à l'achat */
    const char *time;   /* heure d'achat */
    double pnl_pct;     /* gain ou perte actuel, en % */
} cs_position;

/* Une ligne du tableau « Profit and Loss ». */
typedef struct {
    int trades;         /* nombre de trades */
    double pnl_pct;     /* résultat cumulé, en % */
} cs_perf;

/* Un trade terminé (acheté puis revendu). */
typedef struct {
    const char *type;        /* "call" ou "put" */
    const char *open_time;   /* achat : heure */
    double open_price;       /* achat : niveau de l'indice */
    const char *close_time;  /* revente : heure */
    double close_price;      /* revente : niveau de l'indice */
    double pnl_pct;          /* résultat, en % */
} cs_trade;

/* Tout le contenu du fichier. */
typedef struct {
    const char *index;            /* "CAC 40" ou "DAX" */
    const char *updated;          /* heure d'écriture du fichier */

    double price_value;           /* dernier cours de l'indice */
    double price_change_pct;      /* variation du jour, en % */
    const char *price_time;       /* heure de ce cours */

    const cs_position *position;  /* NULL s'il n'y a pas de position en cours */

    const cs_point *curve;        /* tableau des points de la courbe */
    int curve_count;              /* nombre de points */

    cs_perf week, month, year;    /* tableau « Profit and Loss » */

    const cs_trade *trades;       /* tableau des trades terminés */
    int trades_count;             /* nombre de trades (0 s'il n'y en a pas) */
} cs_data;

/* Écrit le fichier, par exemple "cac40.json".
   Renvoie 0 si c'est fait, -1 si le fichier n'a pas pu être créé. */
int cs_write_json(const char *filename, const cs_data *d);

#ifdef __cplusplus
}
#endif

#endif
