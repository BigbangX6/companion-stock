"""Génère des fichiers cac40.json et dax.json d'exemple au format Companion Stock.

Usage : python3 tools/make_sample.py [dossier_de_sortie]   (par défaut : racine du dépôt)
Les valeurs sont aléatoires ; seul le format compte.
"""
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
NOW = datetime(2026, 11, 10, 15, 42)  # heure de Paris de l'exemple


def trading_days(end, count):
    days, d = [], end
    while len(days) < count:
        if d.weekday() < 5:
            days.append(d)
        d -= timedelta(days=1)
    return sorted(days)


def make_curve(start_value, seed):
    rnd = random.Random(seed)
    v, curve = start_value, []
    for day in trading_days(NOW.date(), 5):
        t = datetime(day.year, day.month, day.day, 9, 0)
        close = datetime(day.year, day.month, day.day, 17, 30)
        while t <= close and t <= NOW:
            v += rnd.gauss(0, start_value * 0.0009)
            curve.append([t.strftime("%Y-%m-%d %H:%M"), round(v, 1)])
            t += timedelta(minutes=5)
    return curve


def pct(a, b, opt):
    """Variation de l'indice entre achat (a) et maintenant/vente (b), vue par un Call ou un Put."""
    p = (b - a) / a * 100
    return round(p if opt == "call" else -p, 2)


def market_time(rnd, day):
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    minutes = rnd.randint(9 * 12 + 1, 17 * 12 + 5) * 5  # entre 09:05 et 17:25
    return datetime(day.year, day.month, day.day) + timedelta(minutes=minutes)


def make_trades(curve, seed, n=8):
    rnd = random.Random(seed)
    trades, day = [], date(2026, 11, 3)
    level = curve[0][1]
    for _ in range(n):
        opt = rnd.choice(["call", "put"])
        c_t = market_time(rnd, day)
        o_t = market_time(rnd, day - timedelta(days=rnd.randint(0, 3)))
        if o_t >= c_t:
            o_t = c_t - timedelta(minutes=rnd.randint(30, 300))
        o_p = round(level + rnd.gauss(0, level * 0.006))
        c_p = round(o_p + rnd.gauss(0, o_p * 0.006))
        trades.append({
            "type": opt,
            "open_time": o_t.strftime("%Y-%m-%d %H:%M"),
            "open_price": o_p,
            "close_time": c_t.strftime("%Y-%m-%d %H:%M"),
            "close_price": c_p,
            "pnl_pct": pct(o_p, c_p, opt),
        })
        day = o_t.date() - timedelta(days=rnd.randint(1, 3))
        level = o_p
    return trades  # du plus récent au plus ancien


def build(name, start_value, seed, with_position):
    curve = make_curve(start_value, seed)
    last_time, last_value = curve[-1]
    first_today = next(v for t, v in curve if t.startswith(NOW.strftime("%Y-%m-%d")))
    position = None
    if with_position:
        entry_t, entry_v = next((t, v) for t, v in curve if t >= "2026-11-06 10:15")
        position = {"type": "call", "price": round(entry_v, 1), "time": entry_t,
                    "pnl_pct": pct(entry_v, last_value, "call")}
    return {
        "index": name,
        "updated": NOW.strftime("%Y-%m-%d %H:%M"),
        "price": {"value": last_value,
                  "change_pct": round((last_value - first_today) / first_today * 100, 2),
                  "time": last_time},
        "position": position,
        "curve": curve,
        "performance": {
            "week": {"trades": 2, "pnl_pct": -0.10},
            "month": {"trades": 4, "pnl_pct": -2.12},
            "year": {"trades": 44, "pnl_pct": 11.51},
        },
        "trades": make_trades(curve, seed + 1),
    }


def write(path, data):
    # Points de courbe sur une ligne chacun : lisible par un humain, compact.
    text = json.dumps(data, ensure_ascii=False, indent=2)
    curve_lines = ",\n".join("    " + json.dumps(p, ensure_ascii=False) for p in data["curve"])
    start = text.index('"curve": [') + len('"curve": [')
    end = text.index("]\n  ]", start) + len("]\n  ]")
    text = text[:start] + "\n" + curve_lines + "\n  ]" + text[end:]
    json.loads(text)  # vérifie que le fichier reste du JSON valide
    path.write_text(text + "\n", encoding="utf-8")


OUT.mkdir(parents=True, exist_ok=True)
write(OUT / "cac40.json", build("CAC 40", 8090.0, 40, with_position=True))
write(OUT / "dax.json", build("DAX", 24600.0, 30, with_position=False))
print("Écrit :", OUT / "cac40.json", OUT / "dax.json")
