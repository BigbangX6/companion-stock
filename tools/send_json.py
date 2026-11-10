"""Envoie cac40.json / dax.json sur le site par SFTP.

Le moteur écrit ses fichiers en local, puis lance :

    python send_json.py cac40.json dax.json

Pour chaque fichier, le script :
  1. vérifie qu'il respecte le format (voir FORMAT_JSON.md) ; sinon il ne l'envoie pas,
     pour ne jamais casser le site ;
  2. l'envoie sous le nom <fichier>.tmp ;
  3. le renomme en <fichier>, pour qu'un visiteur ne lise jamais un fichier à moitié écrit.

Options :
  --check          vérifie seulement les fichiers, sans rien envoyer
  --loop 45        renvoie les fichiers toutes les 45 s, sans s'arrêter (Ctrl+C pour quitter)
  --config FICHIER fichier de configuration (par défaut : send_json.ini à côté du script)

Code de sortie : 0 si tout est envoyé, 1 si un fichier est invalide, 2 si l'envoi échoue.

Installation (une fois) :  pip install paramiko
"""
import argparse
import configparser
import json
import logging
import os
import re
import sys
import time
from pathlib import Path

log = logging.getLogger("send_json")
TIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$")


# ---------------------------------------------------------------- vérification

def check(data):
    """Renvoie la liste des problèmes trouvés (vide si le fichier est bon)."""
    errors = []

    def num(v):
        return isinstance(v, (int, float)) and not isinstance(v, bool)

    def need(obj, key, kind, where):
        if not isinstance(obj, dict) or key not in obj:
            errors.append(f"{where}{key} : champ manquant")
            return None
        v = obj[key]
        ok = {"num": num(v), "time": isinstance(v, str) and bool(TIME_RE.match(v)),
              "text": isinstance(v, str) and v != "", "opt": v in ("call", "put")}[kind]
        if not ok:
            hint = {"num": "un nombre sans guillemets", "time": 'une heure "AAAA-MM-JJ HH:MM"',
                    "text": "un texte", "opt": '"call" ou "put" (en minuscules)'}[kind]
            errors.append(f"{where}{key} : {json.dumps(v, ensure_ascii=False)} n'est pas {hint}")
        return v

    if not isinstance(data, dict):
        return ["le fichier doit contenir un objet { ... }"]

    need(data, "index", "text", "")
    need(data, "updated", "time", "")

    price = data.get("price")
    if not isinstance(price, dict):
        errors.append("price : objet manquant")
    else:
        need(price, "value", "num", "price.")
        need(price, "change_pct", "num", "price.")
        need(price, "time", "time", "price.")

    if "position" not in data:
        errors.append("position : champ manquant (mettre null s'il n'y a pas de position)")
    elif data["position"] is not None:
        pos = data["position"]
        need(pos, "type", "opt", "position.")
        need(pos, "price", "num", "position.")
        need(pos, "time", "time", "position.")
        need(pos, "pnl_pct", "num", "position.")

    curve = data.get("curve")
    if not isinstance(curve, list):
        errors.append("curve : liste manquante")
    else:
        prev = ""
        for i, p in enumerate(curve):
            if not (isinstance(p, list) and len(p) == 2 and isinstance(p[0], str)
                    and TIME_RE.match(p[0]) and num(p[1])):
                errors.append(f"curve[{i}] : attendu [\"AAAA-MM-JJ HH:MM\", nombre], reçu {json.dumps(p)}")
                break
            if p[0] <= prev:
                errors.append(f"curve[{i}] : {p[0]} n'est pas après {prev} (ordre du plus ancien au plus récent)")
                break
            prev = p[0]

    perf = data.get("performance")
    if not isinstance(perf, dict):
        errors.append("performance : objet manquant")
    else:
        for k in ("week", "month", "year"):
            if not isinstance(perf.get(k), dict):
                errors.append(f"performance.{k} : objet manquant")
                continue
            need(perf[k], "trades", "num", f"performance.{k}.")
            need(perf[k], "pnl_pct", "num", f"performance.{k}.")

    trades = data.get("trades")
    if not isinstance(trades, list):
        errors.append("trades : liste manquante (mettre [] s'il n'y en a pas)")
    else:
        prev = None
        for i, t in enumerate(trades):
            w = f"trades[{i}]."
            need(t, "type", "opt", w)
            need(t, "open_time", "time", w)
            need(t, "open_price", "num", w)
            close = need(t, "close_time", "time", w)
            need(t, "close_price", "num", w)
            need(t, "pnl_pct", "num", w)
            if isinstance(close, str) and prev is not None and close > prev:
                errors.append(f"{w}close_time : {close} est après le trade précédent (ordre du plus récent au plus ancien)")
            prev = close if isinstance(close, str) else prev

    return errors


def load_and_check(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return [f"fichier introuvable : {path}"]
    except json.JSONDecodeError as e:
        return [f"JSON invalide, ligne {e.lineno} colonne {e.colno} : {e.msg}"]
    return check(data)


# ---------------------------------------------------------------------- envoi

def read_config(path):
    cfg = configparser.ConfigParser()
    if not cfg.read(path, encoding="utf-8"):
        sys.exit(f"Configuration introuvable : {path}\n"
                 f"Copier send_json.example.ini en send_json.ini et le remplir.")
    s = cfg["sftp"]
    password = os.environ.get("COMPANION_SFTP_PASSWORD") or s.get("password", "")
    return {
        "host": s["host"],
        "port": s.getint("port", 22),
        "user": s["user"],
        "password": password or None,
        "key_file": s.get("key_file") or None,
        "remote_dir": s.get("remote_dir", "www").rstrip("/"),
        "timeout": s.getint("timeout", 20),
    }


def upload(files, conf):
    import paramiko  # importé ici pour que --check marche sans paramiko

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    known = Path(__file__).with_name("known_hosts")
    if known.exists():
        client.load_host_keys(str(known))
    # Première connexion : on mémorise la clé du serveur dans known_hosts (à côté du script).
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(conf["host"], port=conf["port"], username=conf["user"], password=conf["password"],
                   key_filename=conf["key_file"], timeout=conf["timeout"],
                   allow_agent=False, look_for_keys=conf["key_file"] is None and conf["password"] is None)
    try:
        client.save_host_keys(str(known))
    except OSError:
        pass
    try:
        sftp = client.open_sftp()
        for f in files:
            name = Path(f).name
            final = f"{conf['remote_dir']}/{name}"
            tmp = final + ".tmp"
            sftp.put(str(f), tmp)
            try:
                sftp.posix_rename(tmp, final)  # remplace l'ancien fichier en une seule opération
            except IOError:
                try:
                    sftp.remove(final)
                except IOError:
                    pass
                sftp.rename(tmp, final)
            log.info("envoyé : %s", final)
        sftp.close()
    finally:
        client.close()


def run_once(files, conf, check_only):
    good = []
    for f in files:
        errors = load_and_check(f)
        if errors:
            log.error("%s NON envoyé, %d problème(s) :", f, len(errors))
            for e in errors[:20]:
                log.error("   - %s", e)
        else:
            good.append(f)
            log.info("%s : format correct", f)
    if check_only:
        return 0 if len(good) == len(files) else 1
    if good:
        try:
            upload(good, conf)
        except Exception as e:  # réseau, identifiants, droits...
            if type(e).__name__ == "BadHostKeyException":
                log.error("échec de l'envoi : la clé du serveur %s a changé depuis la dernière connexion. "
                          "Si l'hébergeur l'a changée (migration...), supprimer le fichier %s et relancer.",
                          conf["host"], Path(__file__).with_name("known_hosts"))
            elif type(e).__name__ == "AuthenticationException":
                log.error("échec de l'envoi : identifiant ou mot de passe refusé par %s", conf["host"])
            else:
                log.error("échec de l'envoi : %s", e)
            return 2
    return 0 if len(good) == len(files) else 1


def main():
    ap = argparse.ArgumentParser(description="Envoie les JSON de Companion Stock par SFTP.")
    ap.add_argument("files", nargs="+", help="fichiers à envoyer, ex. cac40.json dax.json")
    ap.add_argument("--check", action="store_true", help="vérifier seulement, sans envoyer")
    ap.add_argument("--loop", type=int, metavar="SECONDES", help="renvoyer en boucle toutes les N secondes")
    ap.add_argument("--config", default=str(Path(__file__).with_name("send_json.ini")))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%Y-%m-%d %H:%M:%S")
    logging.getLogger("paramiko").setLevel(logging.WARNING)
    conf = None if args.check else read_config(args.config)

    if not args.loop:
        sys.exit(run_once(args.files, conf, args.check))
    while True:
        start = time.monotonic()
        run_once(args.files, conf, args.check)
        time.sleep(max(1, args.loop - (time.monotonic() - start)))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
