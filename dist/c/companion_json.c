/*
 * companion_json.c — voir companion_json.h pour le mode d'emploi.
 * C99 standard, aucune bibliothèque externe.
 */
#if defined(_MSC_VER) && !defined(_CRT_SECURE_NO_WARNINGS)
#define _CRT_SECURE_NO_WARNINGS /* fopen, snprintf : fonctions standard, sans avertissement Visual Studio */
#endif

#include "companion_json.h"

#include <stdio.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h> /* MoveFileExA : remplace le fichier existant d'un coup */
#endif

#define TAG "[companion_json] "

/* ------------------------------------------------------------------ heures */

/* Nombre de jours depuis le 1er janvier 1970 (calendrier grégorien). */
static long long days_from_civil(long long y, int m, int d)
{
    y -= m <= 2;
    long long era = (y >= 0 ? y : y - 399) / 400;
    long long yoe = y - era * 400;
    long long doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
    long long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return era * 146097 + doe - 719468;
}

/* Inverse de days_from_civil. */
static void civil_from_days(long long z, long long *y, int *m, int *d)
{
    z += 719468;
    long long era = (z >= 0 ? z : z - 146096) / 146097;
    long long doe = z - era * 146097;
    long long yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    long long doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    long long mp = (5 * doy + 2) / 153;
    *d = (int)(doy - (153 * mp + 2) / 5 + 1);
    *m = (int)(mp < 10 ? mp + 3 : mp - 9);
    *y = yoe + era * 400 + (*m <= 2);
}

static long long floor_div(long long a, long long b)
{
    return a / b - ((a % b != 0) && ((a < 0) != (b < 0)));
}

/* Jour du dernier dimanche du mois (mois de 31 jours : mars, octobre). */
static long long last_sunday_31(long long y, int m)
{
    long long last = days_from_civil(y, m, 31);
    long long weekday = ((last + 4) % 7 + 7) % 7; /* 0 = dimanche ; le 01/01/1970 était un jeudi */
    return last - weekday;
}

void cs_time(char out[CS_TIME_LEN], int year, int month, int day, int hour, int minute)
{
    snprintf(out, CS_TIME_LEN, "%04d-%02d-%02d %02d:%02d", year, month, day, hour, minute);
}

/* Heure de Paris : UTC+1 en hiver, UTC+2 du dernier dimanche de mars au dernier dimanche
   d'octobre (changement à 01:00 UTC), règle européenne. */
void cs_paris_time(time_t t, char out[CS_TIME_LEN])
{
    long long s = (long long)t;
    long long y;
    int m, d;
    civil_from_days(floor_div(s, 86400), &y, &m, &d);

    long long summer_start = last_sunday_31(y, 3) * 86400 + 3600;
    long long summer_end = last_sunday_31(y, 10) * 86400 + 3600;
    long long local = s + ((s >= summer_start && s < summer_end) ? 7200 : 3600);

    long long day = floor_div(local, 86400);
    long long sec = local - day * 86400;
    civil_from_days(day, &y, &m, &d);
    cs_time(out, (int)y, m, d, (int)(sec / 3600), (int)(sec % 3600 / 60));
}

/* ------------------------------------------------------------ vérification */

typedef struct {
    int errors;
} checker;

static void problem(checker *c, const char *where, const char *what, const char *value)
{
    c->errors++;
    if (value)
        fprintf(stderr, TAG "%s : \"%s\" %s\n", where, value, what);
    else
        fprintf(stderr, TAG "%s : %s\n", where, what);
}

static int is_digit(char ch) { return ch >= '0' && ch <= '9'; }

static int num2(const char *s) { return (s[0] - '0') * 10 + (s[1] - '0'); }

/* "AAAA-MM-JJ HH:MM" avec des valeurs plausibles. */
static int valid_time(const char *s)
{
    static const char pattern[] = "dddd-dd-dd dd:dd";
    for (int i = 0; i < 16; i++) {
        if (pattern[i] == 'd' ? !is_digit(s[i]) : s[i] != pattern[i])
            return 0;
    }
    if (s[16] != '\0')
        return 0;
    int month = num2(s + 5), day = num2(s + 8), hour = num2(s + 11), minute = num2(s + 14);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59;
}

/* Copie sûre d'un champ heure (il peut ne pas être terminé par '\0' si on a débordé). */
static const char *time_text(const char *field, char buf[CS_TIME_LEN + 4])
{
    memcpy(buf, field, CS_TIME_LEN);
    buf[CS_TIME_LEN] = '\0';
    return buf;
}

static void check_time(checker *c, const char *where, const char *field)
{
    char buf[CS_TIME_LEN + 4];
    const char *s = time_text(field, buf);
    if (s[0] == '\0')
        problem(c, where, "heure vide (oubliée ?) ; format attendu \"AAAA-MM-JJ HH:MM\"", NULL);
    else if (!valid_time(s))
        problem(c, where, "n'est pas une heure \"AAAA-MM-JJ HH:MM\"", s);
}

/* Nombre utilisable (ni NaN ni infini), sans dépendre de math.h. */
static int is_finite_number(double v) { return v == v && v - v == 0.0; }

static void check_number(checker *c, const char *where, double v)
{
    if (!is_finite_number(v))
        problem(c, where, "n'est pas un nombre valide (NaN ou infini)", NULL);
}

static void check_type(checker *c, const char *where, cs_type t)
{
    if (t != CS_CALL && t != CS_PUT)
        problem(c, where, "doit valoir CS_CALL ou CS_PUT (laissé à zéro ?)", NULL);
}

static void warning(const char *where, const char *what)
{
    fprintf(stderr, TAG "attention, %s : %s (le fichier est quand même écrit)\n", where, what);
}

static int check(const cs_data *d)
{
    checker c = {0};
    char where[64];

    if (!d->index || !d->index[0])
        problem(&c, "index", "nom de l'indice vide (oublié ?), par exemple \"CAC 40\" ou \"DAX\"", NULL);
    if (d->updated[0])
        check_time(&c, "updated", d->updated);

    check_number(&c, "price_value", d->price_value);
    check_number(&c, "price_change_pct", d->price_change_pct);
    check_time(&c, "price_time", d->price_time);
    if (d->price_value == 0.0)
        warning("price_value", "le cours vaut 0 (oublié ?)");

    if (d->position.open) {
        check_type(&c, "position.type", d->position.type);
        check_number(&c, "position.price", d->position.price);
        check_time(&c, "position.time", d->position.time);
        check_number(&c, "position.pnl_pct", d->position.pnl_pct);
    }

    if (d->curve_count < 0)
        problem(&c, "curve_count", "ne peut pas être négatif", NULL);
    else if (d->curve_count > 0 && !d->curve)
        problem(&c, "curve", "tableau absent (NULL) alors que curve_count > 0", NULL);
    else if (d->curve_count == 0)
        warning("curve", "aucun point, le site affichera « Pas de données de courbe »");
    else {
        char prev[CS_TIME_LEN + 4] = "", buf[CS_TIME_LEN + 4];
        for (int i = 0; i < d->curve_count; i++) {
            int before = c.errors;
            snprintf(where, sizeof where, "curve[%d].time", i);
            check_time(&c, where, d->curve[i].time);
            snprintf(where, sizeof where, "curve[%d].value", i);
            check_number(&c, where, d->curve[i].value);
            if (c.errors > before)
                break; /* un seul message suffit, inutile d'en afficher 500 */
            const char *t = time_text(d->curve[i].time, buf);
            if (prev[0] && strcmp(t, prev) <= 0) {
                snprintf(where, sizeof where, "curve[%d].time", i);
                problem(&c, where, "n'est pas après le point précédent (ordre : du plus ancien au plus récent)", t);
                break;
            }
            memcpy(prev, buf, sizeof prev);
        }
    }

    const cs_perf *perf[3] = {&d->week, &d->month, &d->year};
    const char *perf_name[3] = {"week", "month", "year"};
    for (int k = 0; k < 3; k++) {
        if (perf[k]->trades < 0) {
            snprintf(where, sizeof where, "%s.trades", perf_name[k]);
            problem(&c, where, "ne peut pas être négatif", NULL);
        }
        snprintf(where, sizeof where, "%s.pnl_pct", perf_name[k]);
        check_number(&c, where, perf[k]->pnl_pct);
    }

    if (d->trades_count < 0)
        problem(&c, "trades_count", "ne peut pas être négatif", NULL);
    else if (d->trades_count > 0 && !d->trades)
        problem(&c, "trades", "tableau absent (NULL) alors que trades_count > 0", NULL);
    else {
        char prev[CS_TIME_LEN + 4] = "", buf[CS_TIME_LEN + 4], open_buf[CS_TIME_LEN + 4];
        for (int i = 0; i < d->trades_count; i++) {
            const cs_trade *t = &d->trades[i];
            int before = c.errors;
            snprintf(where, sizeof where, "trades[%d].type", i);
            check_type(&c, where, t->type);
            snprintf(where, sizeof where, "trades[%d].open_time", i);
            check_time(&c, where, t->open_time);
            snprintf(where, sizeof where, "trades[%d].open_price", i);
            check_number(&c, where, t->open_price);
            snprintf(where, sizeof where, "trades[%d].close_time", i);
            check_time(&c, where, t->close_time);
            snprintf(where, sizeof where, "trades[%d].close_price", i);
            check_number(&c, where, t->close_price);
            snprintf(where, sizeof where, "trades[%d].pnl_pct", i);
            check_number(&c, where, t->pnl_pct);
            if (c.errors > before)
                continue;
            const char *close = time_text(t->close_time, buf);
            if (strcmp(time_text(t->open_time, open_buf), close) > 0) {
                snprintf(where, sizeof where, "trades[%d].close_time", i);
                problem(&c, where, "est avant l'heure d'achat (open_time)", close);
            }
            if (prev[0] && strcmp(close, prev) > 0) {
                snprintf(where, sizeof where, "trades[%d].close_time", i);
                problem(&c, where, "est après le trade précédent (ordre : du plus récent au plus ancien)", close);
            }
            memcpy(prev, buf, sizeof prev);
        }
        if (d->trades_count > 50)
            warning("trades", "plus de 50 trades ; les 50 derniers suffisent au site");
    }

    return c.errors;
}

/* ----------------------------------------------------------------- écriture */

/* Nombre avec un POINT décimal, même si le programme a choisi une langue (locale) où
   printf écrit une virgule : « 8123,40 » rendrait le JSON illisible. */
static void put_number(FILE *f, double v, int decimals)
{
    char buf[64];
    snprintf(buf, sizeof buf, "%.*f", decimals, v);
    for (char *p = buf; *p; p++) {
        if (*p == ',')
            *p = '.';
    }
    if (strcmp(buf, "-0") == 0 || strcmp(buf, "-0.00") == 0)
        memmove(buf, buf + 1, strlen(buf)); /* pas de « -0.00 » */
    fputs(buf, f);
}

/* Texte entre guillemets, avec les caractères spéciaux échappés. */
static void put_string(FILE *f, const char *s)
{
    fputc('"', f);
    for (; *s; s++) {
        unsigned char ch = (unsigned char)*s;
        if (ch == '"' || ch == '\\')
            fprintf(f, "\\%c", ch);
        else if (ch < 0x20)
            fprintf(f, "\\u%04x", ch);
        else
            fputc(ch, f);
    }
    fputc('"', f);
}

static void put_time(FILE *f, const char *field)
{
    char buf[CS_TIME_LEN + 4];
    put_string(f, time_text(field, buf));
}

static const char *type_name(cs_type t) { return t == CS_PUT ? "put" : "call"; }

static void write_all(FILE *f, const cs_data *d, const char *updated)
{
    fputs("{\n  \"index\": ", f);
    put_string(f, d->index);
    fputs(",\n  \"updated\": ", f);
    put_string(f, updated);

    fputs(",\n  \"price\": { \"value\": ", f);
    put_number(f, d->price_value, 2);
    fputs(", \"change_pct\": ", f);
    put_number(f, d->price_change_pct, 2);
    fputs(", \"time\": ", f);
    put_time(f, d->price_time);
    fputs(" },\n  \"position\": ", f);

    if (d->position.open) {
        fprintf(f, "{ \"type\": \"%s\", \"price\": ", type_name(d->position.type));
        put_number(f, d->position.price, 2);
        fputs(", \"time\": ", f);
        put_time(f, d->position.time);
        fputs(", \"pnl_pct\": ", f);
        put_number(f, d->position.pnl_pct, 2);
        fputs(" }", f);
    } else {
        fputs("null", f);
    }

    fputs(",\n  \"curve\": [", f);
    for (int i = 0; i < d->curve_count; i++) {
        fputs(i ? ",\n    [" : "\n    [", f);
        put_time(f, d->curve[i].time);
        fputs(", ", f);
        put_number(f, d->curve[i].value, 2);
        fputc(']', f);
    }
    fputs(d->curve_count ? "\n  ],\n" : "],\n", f);

    fputs("  \"performance\": {\n", f);
    const cs_perf *perf[3] = {&d->week, &d->month, &d->year};
    const char *perf_name[3] = {"week", "month", "year"};
    for (int k = 0; k < 3; k++) {
        fprintf(f, "    \"%s\": { \"trades\": %d, \"pnl_pct\": ", perf_name[k], perf[k]->trades);
        put_number(f, perf[k]->pnl_pct, 2);
        fputs(k < 2 ? " },\n" : " }\n", f);
    }

    fputs("  },\n  \"trades\": [", f);
    for (int i = 0; i < d->trades_count; i++) {
        const cs_trade *t = &d->trades[i];
        fprintf(f, "%s    { \"type\": \"%s\", \"open_time\": ", i ? ",\n" : "\n", type_name(t->type));
        put_time(f, t->open_time);
        fputs(", \"open_price\": ", f);
        put_number(f, t->open_price, 2);
        fputs(", \"close_time\": ", f);
        put_time(f, t->close_time);
        fputs(", \"close_price\": ", f);
        put_number(f, t->close_price, 2);
        fputs(", \"pnl_pct\": ", f);
        put_number(f, t->pnl_pct, 2);
        fputs(" }", f);
    }
    fputs(d->trades_count ? "\n  ]\n}\n" : "]\n}\n", f);
}

int cs_write_json(const char *filename, const cs_data *data)
{
    if (!filename || !filename[0] || !data) {
        fprintf(stderr, TAG "cs_write_json : nom de fichier ou données absents\n");
        return 1;
    }

    int errors = check(data);
    if (errors) {
        fprintf(stderr, TAG "%s NON écrit : %d problème%s ci-dessus\n", filename, errors, errors > 1 ? "s" : "");
        return 1;
    }

    char updated[CS_TIME_LEN];
    if (data->updated[0])
        memcpy(updated, data->updated, CS_TIME_LEN);
    else
        cs_paris_time(time(NULL), updated);

    char tmp[1024];
    if (snprintf(tmp, sizeof tmp, "%s.tmp", filename) >= (int)sizeof tmp) {
        fprintf(stderr, TAG "%s : chemin trop long\n", filename);
        return 2;
    }

    FILE *f = fopen(tmp, "wb");
    if (!f) {
        fprintf(stderr, TAG "impossible de créer %s (le dossier existe-t-il ? droits d'écriture ?)\n", tmp);
        return 2;
    }
    write_all(f, data, updated);
    int write_error = ferror(f);
    if (fclose(f) != 0 || write_error) {
        fprintf(stderr, TAG "erreur d'écriture de %s (disque plein ?)\n", tmp);
        remove(tmp);
        return 2;
    }

#ifdef _WIN32
    int renamed = MoveFileExA(tmp, filename, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
#else
    int renamed = rename(tmp, filename) == 0;
#endif
    if (!renamed) {
        fprintf(stderr, TAG "impossible de remplacer %s (fichier ouvert dans un autre programme ?)\n", filename);
        remove(tmp);
        return 2;
    }
    return 0;
}
