/*
 * exemple.c — montre comment remplir les données et écrire cac40.json et dax.json.
 *
 * Compiler et lancer :
 *     gcc exemple.c companion_json.c -o exemple        (Linux, macOS, MinGW sous Windows)
 *     cl exemple.c companion_json.c                     (Visual Studio)
 *     ./exemple
 *
 * Les valeurs ci-dessous sont inventées : dans le moteur, on met les vraies.
 */
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#include "companion_json.h"

/* La courbe : un point toutes les 5 minutes, de 09:00 à 17:30, sur les 5 derniers jours
   de bourse (sans le week-end). Ici une valeur au hasard ; le moteur met les vrais cours. */
static int fill_curve(cs_point *curve, int max, double start)
{
    int n = 0;
    double value = start;
    time_t now = time(NULL);
    int days_found = 0;

    /* On cherche les 5 derniers jours ouvrés, du plus ancien au plus récent. */
    time_t days[5];
    for (int back = 0; days_found < 5 && back < 14; back++) {
        time_t t = now - (time_t)back * 86400;
        struct tm *g = gmtime(&t);
        if (g->tm_wday != 0 && g->tm_wday != 6) /* ni dimanche ni samedi */
            days[4 - days_found++] = t;
    }

    for (int k = 0; k < days_found; k++) {
        struct tm *g = gmtime(&days[k]);
        int year = g->tm_year + 1900, month = g->tm_mon + 1, day = g->tm_mday;
        for (int minutes = 9 * 60; minutes <= 17 * 60 + 30 && n < max; minutes += 5) {
            value += (rand() % 200 - 100) / 10.0; /* marche au hasard, pour l'exemple */
            cs_time(curve[n].time, year, month, day, minutes / 60, minutes % 60);
            curve[n].value = value;
            n++;
        }
    }
    return n;
}

int main(void)
{
    static cs_point curve[600];
    srand((unsigned)time(NULL));

    /* ------------------------------------------------------------ CAC 40 */
    cs_data cac = {0};                       /* 1. tout à zéro */

    cac.index = "CAC 40";                    /* 2. remplir */
    /* cac.updated : laissé vide = heure de Paris actuelle, remplie automatiquement */

    cac.curve = curve;
    cac.curve_count = fill_curve(curve, 600, 8100.0);

    cac.price_value = curve[cac.curve_count - 1].value;     /* dernier cours */
    cac.price_change_pct = 0.27;
    cs_paris_time(time(NULL), cac.price_time);              /* heure du cours */

    cac.position.open = 1;                   /* une position est ouverte */
    cac.position.type = CS_CALL;
    cac.position.price = curve[200].value;
    snprintf(cac.position.time, CS_TIME_LEN, "%s", curve[200].time); /* heure d'achat */
    cac.position.pnl_pct = 0.60;

    cac.week.trades = 2;   cac.week.pnl_pct = -0.10;
    cac.month.trades = 4;  cac.month.pnl_pct = -2.12;
    cac.year.trades = 44;  cac.year.pnl_pct = 11.51;

    /* Trades terminés, du plus récent au plus ancien. */
    cs_trade cac_trades[2] = {
        {CS_PUT,  "2026-11-02 10:50", 8115, "2026-11-03 12:35", 8087,  0.35},
        {CS_CALL, "2026-10-27 13:45", 8301, "2026-10-27 16:05", 8255, -0.55},
    };
    cac.trades = cac_trades;
    cac.trades_count = 2;

    if (cs_write_json("cac40.json", &cac) != 0)  /* 3. écrire */
        return 1;
    printf("cac40.json écrit (%d points de courbe)\n", cac.curve_count);

    /* --------------------------------------------------------------- DAX */
    cs_data dax = {0};
    dax.index = "DAX";
    dax.curve = curve;
    dax.curve_count = fill_curve(curve, 600, 24600.0);
    dax.price_value = curve[dax.curve_count - 1].value;
    dax.price_change_pct = -0.45;
    cs_paris_time(time(NULL), dax.price_time);

    dax.position.open = 0;                   /* aucune position : le site affiche « Aucune position en cours » */

    dax.week.trades = 2;   dax.week.pnl_pct = -0.10;
    dax.month.trades = 4;  dax.month.pnl_pct = -2.12;
    dax.year.trades = 44;  dax.year.pnl_pct = 11.51;

    dax.trades = NULL;                       /* aucun trade terminé */
    dax.trades_count = 0;

    if (cs_write_json("dax.json", &dax) != 0)
        return 1;
    printf("dax.json écrit (%d points de courbe)\n", dax.curve_count);
    return 0;
}
