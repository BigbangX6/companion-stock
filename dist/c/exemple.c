/*
 * exemple.c : écrit cac40.json et dax.json avec cs_write_json.
 *
 * Compiler et lancer :
 *     gcc exemple.c companion_json.c -o exemple && ./exemple
 * ou, avec Visual Studio, ajouter exemple.c et companion_json.c au projet.
 *
 * Les valeurs sont inventées : le moteur met les vraies.
 */
#include <stdio.h>
#include "companion_json.h"

int main(void)
{
    /* ---------------------------------------------------------- CAC 40 */

    /* La courbe, du plus ancien au plus récent (en vrai : environ 500 points). */
    cs_point cac_curve[] = {
        { "2026-11-10 09:00", 8075.0 },
        { "2026-11-10 09:05", 8081.6 },
        { "2026-11-10 09:10", 8090.2 },
    };

    /* La position en cours. */
    cs_position cac_position = { "call", 8090.0, "2026-11-07 10:15", 0.41 };

    /* Les trades terminés, du plus récent au plus ancien. */
    cs_trade cac_trades[] = {
        { "put",  "2026-11-05 14:20", 8342, "2026-11-06 11:05", 8350, -0.10 },
        { "call", "2026-11-03 10:00", 8200, "2026-11-04 16:30", 8290,  1.10 },
    };

    cs_data cac;
    cac.index = "CAC 40";
    cac.updated = "2026-11-10 09:10";
    cac.price_value = 8090.2;
    cac.price_change_pct = 0.42;
    cac.price_time = "2026-11-10 09:10";
    cac.position = &cac_position;
    cac.curve = cac_curve;
    cac.curve_count = 3;
    cac.week.trades = 2;   cac.week.pnl_pct = -0.10;
    cac.month.trades = 4;  cac.month.pnl_pct = -2.12;
    cac.year.trades = 44;  cac.year.pnl_pct = 11.51;
    cac.trades = cac_trades;
    cac.trades_count = 2;

    if (cs_write_json("cac40.json", &cac) != 0)
        printf("Impossible de créer cac40.json\n");

    /* ------------------------------------------------------------- DAX */

    cs_point dax_curve[] = {
        { "2026-11-10 09:00", 24610.0 },
        { "2026-11-10 09:05", 24598.5 },
    };

    cs_data dax;
    dax.index = "DAX";
    dax.updated = "2026-11-10 09:05";
    dax.price_value = 24598.5;
    dax.price_change_pct = -0.45;
    dax.price_time = "2026-11-10 09:05";
    dax.position = NULL;              /* aucune position en cours */
    dax.curve = dax_curve;
    dax.curve_count = 2;
    dax.week.trades = 1;   dax.week.pnl_pct = 0.30;
    dax.month.trades = 3;  dax.month.pnl_pct = 1.05;
    dax.year.trades = 38;  dax.year.pnl_pct = 7.80;
    dax.trades = NULL;                /* aucun trade terminé */
    dax.trades_count = 0;

    if (cs_write_json("dax.json", &dax) != 0)
        printf("Impossible de créer dax.json\n");

    return 0;
}
