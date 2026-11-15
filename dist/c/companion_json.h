/*
 * companion_json.h — écrit le fichier JSON lu par le site Companion Stock.
 *
 * Deux fichiers à copier dans le projet : companion_json.h et companion_json.c.
 * Aucune bibliothèque externe : C99 standard (et windows.h sous Windows).
 *
 * Utilisation, en 3 étapes :
 *
 *     #include "companion_json.h"
 *
 *     cs_data d = {0};                          // 1. tout à zéro (en C++ : cs_data d = {};)
 *     d.index = "CAC 40";                       // 2. remplir les champs
 *     d.price_value = 8123.4;
 *     ...
 *     if (cs_write_json("cac40.json", &d) != 0) // 3. écrire le fichier
 *         ... // un problème : le message est déjà affiché, le fichier n'est pas écrit
 *
 * Avant d'écrire, cs_write_json vérifie les données (heures au bon format, type Call/Put,
 * courbe dans l'ordre...). S'il manque quelque chose, rien n'est écrit et chaque problème
 * est expliqué sur la sortie d'erreur (stderr), par exemple :
 *     [companion_json] curve[12].time : "2026-11-1 9:05" n'est pas une heure "AAAA-MM-JJ HH:MM"
 *
 * Le fichier est écrit sous "cac40.json.tmp" puis renommé en "cac40.json" : le fichier
 * n'est jamais à moitié écrit, même si le programme s'arrête au milieu.
 *
 * Voir exemple.c pour un programme complet.
 */
#ifndef COMPANION_JSON_H
#define COMPANION_JSON_H

#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Une heure s'écrit toujours "AAAA-MM-JJ HH:MM", à l'heure de Paris : 16 caractères + fin. */
#define CS_TIME_LEN 17

/* Produit acheté. Commence à 1 : un type laissé à zéro (oublié) est signalé. */
typedef enum {
    CS_CALL = 1, /* gain si l'indice monte */
    CS_PUT  = 2  /* gain si l'indice baisse */
} cs_type;

/* Un point de la courbe : heure + valeur de l'indice. */
typedef struct {
    char   time[CS_TIME_LEN]; /* "2026-11-10 09:05" */
    double value;             /* 8123.4 */
} cs_point;

/* Position en cours (Call ou Put acheté et pas encore revendu). */
typedef struct {
    int     open;              /* 1 = une position est ouverte, 0 = aucune (le reste est ignoré) */
    cs_type type;              /* CS_CALL ou CS_PUT */
    double  price;             /* niveau de l'indice à l'achat */
    char    time[CS_TIME_LEN]; /* heure d'achat */
    double  pnl_pct;           /* gain ou perte actuel en % (0.41 = +0,41 %) */
} cs_position;

/* Une ligne du tableau « Profit and Loss ». */
typedef struct {
    int    trades;  /* nombre de trades */
    double pnl_pct; /* résultat cumulé en % */
} cs_perf;

/* Un trade terminé (acheté puis revendu). */
typedef struct {
    cs_type type;                    /* CS_CALL ou CS_PUT */
    char    open_time[CS_TIME_LEN];  /* achat : heure */
    double  open_price;              /* achat : niveau de l'indice */
    char    close_time[CS_TIME_LEN]; /* revente : heure */
    double  close_price;             /* revente : niveau de l'indice */
    double  pnl_pct;                 /* résultat du trade en % */
} cs_trade;

/* Tout le contenu du fichier. Commencer par  cs_data d = {0};  (en C++ : cs_data d = {};)  puis remplir. */
typedef struct {
    const char *index;               /* "CAC 40" ou "DAX" */
    char updated[CS_TIME_LEN];       /* heure d'écriture ; laisser vide = heure de Paris actuelle */

    double price_value;              /* dernier cours de l'indice, en points */
    double price_change_pct;         /* variation du jour en % (négative si l'indice baisse) */
    char   price_time[CS_TIME_LEN];  /* heure de ce cours */

    cs_position position;            /* position.open = 0 s'il n'y a pas de position */

    const cs_point *curve;           /* tableau de points, du plus ANCIEN au plus récent */
    int curve_count;                 /* nombre de points (environ 500 : 5 jours, 1 point / 5 min) */

    cs_perf week, month, year;       /* tableau « Profit and Loss » */

    const cs_trade *trades;          /* trades terminés, du plus RÉCENT au plus ancien (50 suffisent) */
    int trades_count;                /* 0 s'il n'y en a pas */
} cs_data;

/*
 * Vérifie les données puis écrit le fichier (par exemple "cac40.json") dans le dossier courant,
 * ou au chemin donné.
 * Renvoie 0 si le fichier est écrit,
 *         1 si les données ont un problème (rien n'est écrit, explication sur stderr),
 *         2 si l'écriture sur le disque a échoué (dossier absent, disque plein, droits...).
 */
int cs_write_json(const char *filename, const cs_data *data);

/* Écrit une heure dans out au bon format : cs_time(p.time, 2026, 11, 10, 9, 5) -> "2026-11-10 09:05". */
void cs_time(char out[CS_TIME_LEN], int year, int month, int day, int hour, int minute);

/* Convertit un time_t (par exemple time(NULL)) en heure de Paris, été/hiver compris
   (règle européenne actuelle, exacte pour toutes les dates depuis 1996). */
void cs_paris_time(time_t t, char out[CS_TIME_LEN]);

#ifdef __cplusplus
}
#endif

#endif /* COMPANION_JSON_H */
