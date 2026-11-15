#!/usr/bin/env python3
"""Fabrique la version « un seul fichier » du site, à envoyer sur l'hébergement (OVH).

    python3 tools/build_single.py           # écrit dist/index.html, dist/cac40.json, dist/dax.json et dist/c/
    python3 tools/build_single.py --check   # vérifie que dist/ est à jour (code 1 sinon)

Le style, les scripts, le texte About, les drapeaux et l'icône du robot sont copiés
dans dist/index.html. Seuls les deux JSON restent à côté, car le moteur les remplace.
Ne pas modifier dist/index.html à la main : modifier les sources, puis relancer ce script.

dist/c/ reçoit une copie de la fonction C qui écrit les JSON (tools/c/), pour la personne
qui s'occupe du moteur. Ce dossier n'a pas besoin d'être mis en ligne.
"""
import base64
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
JSON_FILES = ["cac40.json", "dax.json"]
C_FILES = ["companion_json.h", "companion_json.c", "exemple.c"]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def data_uri(rel, mime):
    return f"data:{mime};base64," + base64.b64encode((ROOT / rel).read_bytes()).decode("ascii")


def inline_js(code):
    # Un « </script » dans le code fermerait la balise trop tôt.
    return code.replace("</script", "<\\/script")


def build():
    html = read("index.html")

    # Feuille de style
    link = '<link rel="stylesheet" href="assets/style.css">'
    assert link in html, "lien vers style.css introuvable dans index.html"
    html = html.replace(link, "<style>\n" + read("assets/style.css").strip() + "\n</style>")

    # Icônes du robot, intégrées dans la page (aucun fichier en plus) :
    # PNG pour tous les navigateurs, SVG (s'éclaircit sur les onglets sombres), icône d'écran d'accueil iPhone
    icons = {
        '<link rel="icon" href="favicon.ico" sizes="32x32">':
            f'<link rel="icon" href="{data_uri("assets/img/robot-32.png", "image/png")}" sizes="32x32" type="image/png">',
        '<link rel="icon" href="assets/img/robot.svg" type="image/svg+xml">':
            f'<link rel="icon" href="{data_uri("assets/img/robot.svg", "image/svg+xml")}" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="assets/img/robot-180.png">':
            f'<link rel="apple-touch-icon" href="{data_uri("assets/img/robot-180.png", "image/png")}">',
    }
    for tag, inlined in icons.items():
        assert tag in html, f"{tag} introuvable dans index.html"
        html = html.replace(tag, inlined)

    # Scripts : retirés de <head> et copiés en fin de <body>, dans le même ordre
    # (équivalent de « defer » : ils s'exécutent une fois la page lue).
    srcs = re.findall(r'<script defer src="([^"]+)"></script>', html)
    assert srcs, "aucun script trouvé dans index.html"
    html = re.sub(r'\s*<script defer src="[^"]+"></script>', "", html)
    scripts = []
    for src in srcs:
        code = read(src)
        if src == "assets/app.js":
            for flag in ("us", "fr"):
                path = f"assets/img/{flag}.svg"
                assert path in code, f"{path} introuvable dans app.js"
                code = code.replace(path, data_uri(path, "image/svg+xml"))
        scripts.append(f"<script>\n/* {src} */\n{inline_js(code.strip())}\n</script>")
    html = html.replace("</body>", "\n".join(scripts) + "\n</body>")

    banner = ("<!-- Companion Stock : fichier généré par tools/build_single.py à partir des sources du dépôt.\n"
              "     Ne pas modifier à la main. À déposer avec cac40.json et dax.json dans le même dossier. -->\n")
    html = html.replace("<!doctype html>\n", "<!doctype html>\n" + banner, 1)

    leftover = re.findall(r'(?:src|href)="(?!data:|#|https?:|\$\{)[^"]+"', html)
    assert not leftover, f"références externes restantes : {leftover}"
    return html


def main():
    html = build()
    out = DIST / "index.html"
    if "--check" in sys.argv:
        stale = [] if out.exists() and out.read_text(encoding="utf-8") == html else ["index.html"]
        for name in C_FILES:
            copy = DIST / "c" / name
            if not copy.exists() or copy.read_bytes() != (ROOT / "tools" / "c" / name).read_bytes():
                stale.append("c/" + name)
        if stale:
            print(f"dist/ n'est pas à jour ({', '.join(stale)}) : lancer python3 tools/build_single.py")
            return 1
        print("dist/ est à jour.")
        return 0
    DIST.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    for name in JSON_FILES:
        shutil.copyfile(ROOT / name, DIST / name)
    (DIST / "c").mkdir(exist_ok=True)
    for name in C_FILES:
        shutil.copyfile(ROOT / "tools" / "c" / name, DIST / "c" / name)
    print(f"dist/index.html ({len(html.encode('utf-8')) // 1024} Ko) + {', '.join(JSON_FILES)} + c/ ({', '.join(C_FILES)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
