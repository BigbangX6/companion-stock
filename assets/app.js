// Companion Stock : toutes les données viennent de <indice>.json, relu toutes les 45 s.
(function () {
  const REFRESH_MS = 45000;
  const PAGES = [
    { id: "cac40", label: "CAC 40", href: "index.html", json: "cac40.json" },
    { id: "dax", label: "DAX", href: "dax.html", json: "dax.json" },
  ];
  const page = PAGES.find((p) => p.id === document.body.dataset.page) || PAGES[0];

  const T = {
    fr: {
      priceAt: "Cours de {t} le {d}",
      updated: "Données mises à jour le {d} à {t}",
      chart: "Évolution",
      position: "Position en cours",
      none: "Aucune position en cours",
      call: "Call", put: "Put",
      callHint: "gain si l'indice monte", putHint: "gain si l'indice baisse",
      bought: "Acheté à", since: "Depuis", result: "Résultat", product: "Produit",
      buyCol: "Achat", sellCol: "Vente",
      perf: "Profit and Loss", week: "Semaine", month: "Mois", year: "Année", trades: "trades",
      history: "Derniers trades", noTrades: "Aucun trade terminé",
      loading: "Chargement des données…",
      unavailable: "Données indisponibles pour le moment.",
      emptyCurve: "Pas de données de courbe.",
      demo: "Démonstrateur : trades fictifs, aucun ordre n'est passé sur les marchés.",
      about: "À propos", theme: "Changer de thème",
      days: "j", hours: "h", min: "min",
      locale: "fr-FR",
    },
    en: {
      priceAt: "Price at {t} on {d}",
      updated: "Data updated on {d} at {t}",
      chart: "Chart",
      position: "Open position",
      none: "No open position",
      call: "Call", put: "Put",
      callHint: "gains if the index rises", putHint: "gains if the index falls",
      bought: "Bought at", since: "Since", result: "Result", product: "Product",
      buyCol: "Buy", sellCol: "Sell",
      perf: "Profit and Loss", week: "Week", month: "Month", year: "Year", trades: "trades",
      history: "Recent trades", noTrades: "No closed trades",
      loading: "Loading data…",
      unavailable: "Data unavailable at the moment.",
      emptyCurve: "No chart data.",
      demo: "Demonstrator: simulated trades, no orders are placed on the markets.",
      about: "About", theme: "Toggle theme",
      days: "d", hours: "h", min: "min",
      locale: "en-GB",
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };

  let lang = store.get("lang") || ((navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en");
  if (!T[lang]) lang = "fr";
  let data = null;
  let failed = false;

  const t = (k, vars) => (T[lang][k] || k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v]) || "");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = (v) => typeof v === "number" && isFinite(v);

  // ---------- Formats ----------
  function fmtNumber(v, decimals) {
    if (!isNum(v)) return "—";
    return v.toLocaleString(T[lang].locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtPct(v) {
    if (!isNum(v)) return "—";
    return (v > 0 ? "+" : v < 0 ? "−" : "") + fmtNumber(Math.abs(v), 2) + " %";
  }
  function pill(v) {
    const cls = !isNum(v) ? "" : v > 0 ? "up" : v < 0 ? "down" : "flat";
    return `<span class="pill ${cls}">${fmtPct(v)}</span>`;
  }
  // "YYYY-MM-DD HH:MM" (heure de Paris, affichée telle quelle)
  function parts(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s || "");
    return m ? { y: m[1], mo: m[2], d: m[3], h: m[4] || "00", mi: m[5] || "00" } : null;
  }
  const fmtDate = (s) => { const p = parts(s); return p ? `${p.d}/${p.mo}/${p.y}` : "—"; };
  const fmtTime = (s) => { const p = parts(s); return p ? `${p.h}:${p.mi}` : "—"; };
  const fmtDateTime = (s) => { const p = parts(s); return p ? `${p.d}/${p.mo}/${p.y} ${p.h}:${p.mi}` : "—"; };
  function fmtDay(s) {
    const p = parts(s);
    if (!p) return "";
    const d = new Date(Date.UTC(+p.y, +p.mo - 1, +p.d));
    const wd = d.toLocaleDateString(T[lang].locale, { weekday: "short", timeZone: "UTC" }).replace(".", "");
    return `${wd} ${p.d}/${p.mo}`;
  }
  const fmtPoint = (s) => { const p = parts(s); return p ? `${fmtDay(s)} ${p.h}:${p.mi}` : ""; };
  function duration(from, to) {
    const a = parts(from), b = parts(to);
    if (!a || !b) return "";
    const ms = Date.UTC(+b.y, +b.mo - 1, +b.d, +b.h, +b.mi) - Date.UTC(+a.y, +a.mo - 1, +a.d, +a.h, +a.mi);
    if (!(ms > 0)) return "";
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    if (d) return `${d} ${t("days")} ${h} ${t("hours")}`;
    if (h) return `${h} ${t("hours")} ${m % 60} ${t("min")}`;
    return `${m} ${t("min")}`;
  }

  // ---------- Squelette de page ----------
  function renderShell() {
    document.documentElement.lang = lang;
    document.title = `${page.label} · Companion Stock`;
    document.getElementById("app").innerHTML = `
      <header class="top">
        <a class="brand" href="index.html">Companion Stock</a>
        <nav class="tabs">${PAGES.map((p) => `<a href="${p.href}"${p.id === page.id ? ' aria-current="page"' : ""}>${p.label}</a>`).join("")}</nav>
        <div class="actions">
          <button class="icon-btn" id="theme-btn" title="${t("theme")}" aria-label="${t("theme")}">◐</button>
          <button class="about-btn" id="about-btn">? <span>${t("about")}</span></button>
        </div>
      </header>
      <main id="main"></main>
      <footer class="foot">
        <p id="updated"></p>
        <p>${t("demo")}</p>
      </footer>
      <dialog id="about">
        <div class="about-head">
          <div class="flags">
            <button data-lang="en" class="flag${lang === "en" ? " on" : ""}" title="English"><img src="assets/img/us.svg" alt="English"></button>
            <button data-lang="fr" class="flag${lang === "fr" ? " on" : ""}" title="Français"><img src="assets/img/fr.svg" alt="Français"></button>
          </div>
          <button class="close" id="about-close" aria-label="Close">✕</button>
        </div>
        <article class="about-body"><h1>Companion Stock</h1>${window.ABOUT[lang]}</article>
      </dialog>`;

    const dlg = document.getElementById("about");
    document.getElementById("about-btn").onclick = () => { dlg.showModal(); history.replaceState(null, "", "#about"); };
    document.getElementById("about-close").onclick = () => dlg.close();
    dlg.addEventListener("close", () => { if (location.hash === "#about") history.replaceState(null, "", location.pathname); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => setLang(b.dataset.lang, true)));
    document.getElementById("theme-btn").onclick = toggleTheme;
    if (location.hash === "#about") dlg.showModal();
  }

  function setLang(l, keepAbout) {
    lang = l;
    store.set("lang", l);
    renderShell();
    renderData();
    if (keepAbout) document.getElementById("about").showModal();
  }

  function toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store.set("theme", root.dataset.theme);
    renderData();
  }

  // ---------- Contenu ----------
  function renderData() {
    const main = document.getElementById("main");
    if (!data) {
      main.innerHTML = `<p class="status">${failed ? t("unavailable") : t("loading")}</p>`;
      document.getElementById("updated").textContent = "";
      return;
    }
    const d = data, price = d.price || {}, pos = d.position, perf = d.performance || {};
    // Call / Put : pastille neutre + flèche. Le vert et le rouge restent réservés aux gains et pertes.
    const optChip = (type) => type === "put"
      ? `<span class="opt">▼ ${t("put")}</span>`
      : type === "call" ? `<span class="opt">▲ ${t("call")}</span>` : `<span class="opt">—</span>`;

    main.innerHTML = `
      <section class="hero">
        <h1>${esc(d.index || page.label)}</h1>
        <div class="price-row">
          <span class="price">${fmtNumber(price.value, 2)} <small>Pts</small></span>
          ${pill(price.change_pct)}
        </div>
        <p class="price-time">${t("priceAt", { t: fmtTime(price.time), d: fmtDate(price.time) })}</p>
      </section>

      <section class="card">
        <h2>${t("chart")}</h2>
        <div class="curve-box" id="curve"></div>
      </section>

      <div class="grid2">
        <section class="card">
          <h2>${t("position")}</h2>
          ${pos ? `
            <div class="pos">
              ${optChip(pos.type)}
              <span class="hint">${pos.type === "put" ? t("putHint") : pos.type === "call" ? t("callHint") : ""}</span>
              ${pill(pos.pnl_pct)}
            </div>
            <dl class="facts">
              <div><dt>${t("bought")}</dt><dd>${fmtNumber(pos.price, 2)} Pts</dd></div>
              <div><dt>${t("since")}</dt><dd>${fmtDateTime(pos.time)}<small>${duration(pos.time, price.time)}</small></dd></div>
            </dl>` : `<p class="muted">${t("none")}</p>`}
        </section>

        <section class="card">
          <h2>${t("perf")}</h2>
          <table class="perf">
            ${["week", "month", "year"].map((k) => {
              const r = perf[k] || {};
              return `<tr><th>${t(k)}</th><td>${isNum(r.trades) ? r.trades : "—"} ${t("trades")}</td><td>${pill(r.pnl_pct)}</td></tr>`;
            }).join("")}
          </table>
        </section>
      </div>

      <section class="card">
        <h2>${t("history")}</h2>
        ${Array.isArray(d.trades) && d.trades.length ? `
          <div class="table-scroll">
            <table class="trades">
              <thead><tr><th>${t("product")}</th><th>${t("buyCol")}</th><th>${t("sellCol")}</th><th>${t("result")}</th></tr></thead>
              <tbody>${d.trades.map((r) => `
                <tr>
                  <td>${optChip(r.type)}</td>
                  <td>${fmtNumber(r.open_price, 0)}<small>${fmtDateTime(r.open_time)}</small></td>
                  <td>${fmtNumber(r.close_price, 0)}<small>${fmtDateTime(r.close_time)}</small></td>
                  <td>${pill(r.pnl_pct)}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>` : `<p class="muted">${t("noTrades")}</p>`}
      </section>`;

    document.getElementById("updated").textContent = t("updated", { d: fmtDate(d.updated), t: fmtTime(d.updated) });
    drawChart();
  }

  function drawChart() {
    const box = document.getElementById("curve");
    if (!box || !data) return;
    window.drawCurve(box, data.curve, {
      position: data.position,
      fmtNumber, fmtDay, fmtPoint,
      labels: { empty: t("emptyCurve"), call: t("call"), put: t("put") },
    });
  }

  // ---------- Chargement ----------
  async function load() {
    try {
      const res = await fetch(page.json + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      data = json;
      failed = false;
    } catch (e) {
      // On garde les dernières données affichées : l'heure affichée montre leur âge.
      failed = true;
      console.warn("[CompanionStock] chargement impossible :", e.message);
    }
    renderData();
  }

  const savedTheme = store.get("theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  renderShell();
  renderData();
  load();
  setInterval(load, REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 150); });
})();
