#!/usr/bin/env python3
"""Fabrique la version « un seul fichier » du site, à envoyer sur l'hébergement (OVH).

    python3 tools/build_single.py           # écrit dist/index.html, dist/cac40.json, dist/dax.json
    python3 tools/build_single.py --check   # vérifie que dist/index.html est à jour (code 1 sinon)

Le style, les scripts, le texte About, les drapeaux et l'icône du robot sont copiés
dans dist/index.html. Seuls les deux JSON restent à côté, car le moteur les remplace.
Ne pas modifier dist/index.html à la main : modifier les sources, puis relancer ce script.
"""
import base64
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
JSON_FILES = ["cac40.json", "dax.json"]


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

    # Icônes : le robot en SVG intégré ; favicon.ico serait un fichier de plus, on le retire
    html = html.replace(
        '<link rel="icon" href="assets/img/robot.svg" type="image/svg+xml">',
        f'<link rel="icon" href="{data_uri("assets/img/robot.svg", "image/svg+xml")}" type="image/svg+xml">',
    )
    html = re.sub(r'\s*<link rel="icon" href="favicon\.ico"[^>]*>', "", html)

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
        if not out.exists() or out.read_text(encoding="utf-8") != html:
            print("dist/index.html n'est pas à jour : lancer python3 tools/build_single.py")
            return 1
        print("dist/index.html est à jour.")
        return 0
    DIST.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    for name in JSON_FILES:
        shutil.copyfile(ROOT / name, DIST / name)
    print(f"dist/index.html ({len(html.encode('utf-8')) // 1024} Ko) + {', '.join(JSON_FILES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
