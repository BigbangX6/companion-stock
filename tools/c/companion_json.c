/*
 * companion_json.c : écrit le fichier JSON lu par le site Companion Stock.
 */
#define _CRT_SECURE_NO_WARNINGS /* Visual Studio : autorise fopen */

#include <stdio.h>
#include "companion_json.h"

int cs_write_json(const char *filename, const cs_data *d)
{
    FILE *f = fopen(filename, "w");
    if (f == NULL)
        return -1;

    fprintf(f, "{\n");
    fprintf(f, "  \"index\": \"%s\",\n", d->index);
    fprintf(f, "  \"updated\": \"%s\",\n", d->updated);

    /* Cours de l'indice */
    fprintf(f, "  \"price\": { \"value\": %.2f, \"change_pct\": %.2f, \"time\": \"%s\" },\n",
            d->price_value, d->price_change_pct, d->price_time);

    /* Position en cours, ou null */
    if (d->position == NULL) {
        fprintf(f, "  \"position\": null,\n");
    } else {
        fprintf(f, "  \"position\": { \"type\": \"%s\", \"price\": %.2f, \"time\": \"%s\", \"pnl_pct\": %.2f },\n",
                d->position->type, d->position->price, d->position->time, d->position->pnl_pct);
    }

    /* Courbe : une ligne par point, une virgule après chaque point sauf le dernier */
    fprintf(f, "  \"curve\": [\n");
    for (int i = 0; i < d->curve_count; i++) {
        fprintf(f, "    [\"%s\", %.2f]%s\n",
                d->curve[i].time, d->curve[i].value,
                i < d->curve_count - 1 ? "," : "");
    }
    fprintf(f, "  ],\n");

    /* Tableau « Profit and Loss » */
    fprintf(f, "  \"performance\": {\n");
    fprintf(f, "    \"week\":  { \"trades\": %d, \"pnl_pct\": %.2f },\n", d->week.trades, d->week.pnl_pct);
    fprintf(f, "    \"month\": { \"trades\": %d, \"pnl_pct\": %.2f },\n", d->month.trades, d->month.pnl_pct);
    fprintf(f, "    \"year\":  { \"trades\": %d, \"pnl_pct\": %.2f }\n", d->year.trades, d->year.pnl_pct);
    fprintf(f, "  },\n");

    /* Trades terminés : une ligne par trade, une virgule après chaque trade sauf le dernier */
    fprintf(f, "  \"trades\": [\n");
    for (int i = 0; i < d->trades_count; i++) {
        const cs_trade *t = &d->trades[i];
        fprintf(f, "    { \"type\": \"%s\", \"open_time\": \"%s\", \"open_price\": %.2f, "
                   "\"close_time\": \"%s\", \"close_price\": %.2f, \"pnl_pct\": %.2f }%s\n",
                t->type, t->open_time, t->open_price, t->close_time, t->close_price, t->pnl_pct,
                i < d->trades_count - 1 ? "," : "");
    }
    fprintf(f, "  ]\n");

    fprintf(f, "}\n");
    fclose(f);
    return 0;
}
