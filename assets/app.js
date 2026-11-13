// Companion Stock : toutes les données viennent de <indice>.json, relu toutes les 45 s.
// Une seule page : l'indice affiché est choisi par l'adresse (#dax pour le DAX, rien pour le CAC 40),
// et « /about » ajouté à l'adresse ouvre la fenêtre À propos (#about, #dax/about).
(function () {
  const REFRESH_MS = 45000;
  const PAGES = [
    { id: "cac40", label: "CAC 40", json: "cac40.json" },
    { id: "dax", label: "DAX", json: "dax.json" },
  ];

  // ---------- Adresse (#…) ----------
  function readRoute() {
    const parts = location.hash.replace(/^#\/?/, "").toLowerCase().split("/");
    return {
      page: PAGES.find((p) => p.id !== PAGES[0].id && parts.includes(p.id)) || PAGES[0],
      about: parts.includes("about"),
    };
  }
  function routeHash(pageId, about) {
    const h = [pageId !== PAGES[0].id && pageId, about && "about"].filter(Boolean).join("/");
    return h ? "#" + h : location.pathname + location.search;
  }
  let page = readRoute().page;

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
      tagline: "Suivez les trades de l’IA",
      aiOnline: "IA en ligne", aiLate: "IA en retard", aiOffline: "IA hors ligne",
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
      tagline: "Follow the AI’s trades",
      aiOnline: "AI online", aiLate: "AI delayed", aiOffline: "AI offline",
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

  // ---------- Robot du logo ----------
  // Yeux en bougies (rouge = baisse, vert = hausse). Animations dans style.css.
  // L'antenne indique l'état du moteur, d'après l'heure « updated » du JSON.
  const ROBOT = `
    <svg class="robot" viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
      <line class="r-stroke" x1="32" y1="8" x2="32" y2="16" stroke-width="3" stroke-linecap="round"/>
      <circle class="r-ring" cx="32" cy="6" r="4"/>
      <circle class="r-dot" cx="32" cy="6" r="4"/>
      <rect class="r-ear" x="4" y="30" width="5" height="12" rx="2.5"/>
      <rect class="r-ear" x="55" y="30" width="5" height="12" rx="2.5"/>
      <rect class="r-head" x="9" y="16" width="46" height="40" rx="13"/>
      <g class="r-gaze">
        <g class="r-eye r-down">
          <line x1="23" y1="25" x2="23" y2="41" stroke-width="2" stroke-linecap="round"/>
          <rect x="19.5" y="29" width="7" height="8" rx="1.5"/>
        </g>
        <g class="r-eye r-up">
          <line x1="41" y1="22" x2="41" y2="39" stroke-width="2" stroke-linecap="round"/>
          <rect x="37.5" y="25" width="7" height="10" rx="1.5"/>
        </g>
      </g>
      <path class="r-mouth" d="M27 46.5 Q32 50.5 37 46.5" fill="none" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;

  // Minutes écoulées depuis une heure de Paris "YYYY-MM-DD HH:MM"
  function ageMinutes(s) {
    const p = parts(s);
    if (!p) return Infinity;
    const now = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).forEach((x) => (now[x.type] = x.value));
    const a = Date.UTC(+p.y, +p.mo - 1, +p.d, +p.h, +p.mi);
    const b = Date.UTC(+now.year, +now.month - 1, +now.day, +now.hour, +now.minute);
    return (b - a) / 60000;
  }

  // En ligne : données de moins de 3 min ; en retard : moins de 15 min ; sinon hors ligne
  function updateStatus() {
    const brand = document.querySelector(".brand");
    if (!brand) return;
    const age = data ? ageMinutes(data.updated) : Infinity;
    const status = !data && !failed ? "online" : age <= 3 ? "online" : age <= 15 ? "late" : "offline";
    brand.dataset.status = status;
    const label = t(status === "online" ? "aiOnline" : status === "late" ? "aiLate" : "aiOffline");
    brand.title = data ? `${label} · ${t("updated", { d: fmtDate(data.updated), t: fmtTime(data.updated) })}` : label;
  }

  // Clignement à intervalle aléatoire, parfois double
  function blink() {
    const r = document.querySelector(".robot");
    if (!r) return;
    r.classList.remove("blink");
    void r.getBBox();
    r.classList.add("blink");
    setTimeout(() => r.classList.remove("blink"), 200);
  }
  (function blinkLoop() {
    setTimeout(() => {
      if (!document.hidden) {
        blink();
        if (Math.random() < 0.25) setTimeout(blink, 280);
      }
      blinkLoop();
    }, 2500 + Math.random() * 4000);
  })();

  // ---------- Squelette de page ----------
  function renderShell() {
    document.documentElement.lang = lang;
    document.title = `${page.label} · Companion Stock`;
    document.getElementById("app").innerHTML = `
      <header class="top">
        <a class="brand" href="#">
          ${ROBOT}
          <span class="brand-text">
            <span class="brand-name">Companion <span>Stock</span></span>
            <span class="brand-tagline">${t("tagline")}</span>
          </span>
        </a>
        <nav class="tabs">${PAGES.map((p) => `<a href="${p.id === PAGES[0].id ? "#" : "#" + p.id}"${p.id === page.id ? ' aria-current="page"' : ""}>${p.label}</a>`).join("")}</nav>
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
    document.getElementById("about-btn").onclick = () => { dlg.showModal(); history.replaceState(null, "", routeHash(page.id, true)); };
    document.getElementById("about-close").onclick = () => dlg.close();
    dlg.addEventListener("close", () => { if (readRoute().about) history.replaceState(null, "", routeHash(page.id, false)); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => setLang(b.dataset.lang, true)));
    document.getElementById("theme-btn").onclick = toggleTheme;
    if (readRoute().about) dlg.showModal();
    updateStatus();
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
    updateStatus();
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
    const target = page;
    try {
      const res = await fetch(target.json + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (target !== page) return; // l'onglet a changé pendant le chargement
      data = json;
      failed = false;
    } catch (e) {
      if (target !== page) return;
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
  setInterval(updateStatus, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  // Changement d'onglet (#dax ↔ CAC 40) ou bouton Précédent / Suivant du navigateur
  window.addEventListener("hashchange", () => {
    const r = readRoute();
    if (r.page !== page) {
      page = r.page;
      data = null;
      failed = false;
      renderShell();
      renderData();
      load();
      window.scrollTo(0, 0);
    } else {
      const dlg = document.getElementById("about");
      if (r.about && !dlg.open) dlg.showModal();
      if (!r.about && dlg.open) dlg.close();
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawChart, 150); });
})();
