// Courbe SVG faite main.
// Les points sont posés les uns après les autres (pas sur un axe de temps réel) :
// les nuits et les week-ends ne créent donc pas de longs paliers plats.
// Un séparateur vertical marque chaque nouveau jour.
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceTicks(min, max, count) {
    const raw = (max - min) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  // opts: { position, fmtNumber(v, decimals), fmtDay("YYYY-MM-DD"), fmtPoint("YYYY-MM-DD HH:MM"), labels: { entry } }
  function drawCurve(box, curve, opts) {
    box.innerHTML = "";
    const pts = (curve || []).filter((p) => Array.isArray(p) && typeof p[1] === "number");
    if (pts.length < 2) {
      box.innerHTML = '<p class="curve-empty">' + (opts.labels.empty || "") + "</p>";
      return;
    }

    const W = Math.max(box.clientWidth, 280);
    const H = W < 600 ? 230 : 320;
    const pad = { l: 8, r: 70, t: 14, b: 30 };
    const n = pts.length;
    const pos = opts.position && typeof opts.position.price === "number" ? opts.position : null;

    let lo = Math.min(...pts.map((p) => p[1]));
    let hi = Math.max(...pts.map((p) => p[1]));
    if (pos) { lo = Math.min(lo, pos.price); hi = Math.max(hi, pos.price); }
    const margin = (hi - lo) * 0.08 || hi * 0.001 || 1;
    lo -= margin; hi += margin;

    const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (n - 1);
    const y = (v) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
    const step = (W - pad.l - pad.r) / (n - 1);

    const svg = el("svg", { width: W, height: H, class: "curve", role: "img" }, box);

    // Grille horizontale + valeurs à droite
    const ticks = niceTicks(lo, hi, 4);
    for (const v of ticks) {
      el("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: "grid" }, svg);
      const t = el("text", { x: W - pad.r + 8, y: y(v) + 4, class: "axis" }, svg);
      t.textContent = opts.fmtNumber(v, 0);
    }

    // Séparateurs de jours + date
    const day = (i) => pts[i][0].slice(0, 10);
    const starts = [0];
    for (let i = 1; i < n; i++) if (day(i) !== day(i - 1)) starts.push(i);
    // Libellé long ("mer 04/11") si la place le permet, sinon court ("04/11"), sinon rien.
    const minSeg = Math.min(...starts.map((s, k) => ((k + 1 < starts.length ? starts[k + 1] : n) - s) * step).slice(0, -1).concat([Infinity]));
    const longLabels = minSeg >= 72;
    starts.forEach((s, k) => {
      const end = k + 1 < starts.length ? starts[k + 1] : n;
      const xs = s === 0 ? pad.l : (x(s - 1) + x(s)) / 2;
      if (s > 0) el("line", { x1: xs, x2: xs, y1: pad.t, y2: H - pad.b, class: "day-sep" }, svg);
      const room = (end - s) * step;
      if (room >= (longLabels ? 72 : 40)) {
        const t = el("text", { x: xs + 5, y: H - 10, class: "axis" }, svg);
        t.textContent = longLabels ? opts.fmtDay(day(s)) : day(s).slice(8, 10) + "/" + day(s).slice(5, 7);
      }
    });

    // Zone sous la courbe + courbe
    const line = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p[1]).toFixed(1)).join(" ");
    const gid = "g" + Math.random().toString(36).slice(2, 8);
    const defs = el("defs", {}, svg);
    const grad = el("linearGradient", { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el("stop", { offset: "0%", class: "area-top" }, grad);
    el("stop", { offset: "100%", class: "area-bottom" }, grad);
    el("path", { d: line + ` L${x(n - 1)} ${H - pad.b} L${x(0)} ${H - pad.b} Z`, fill: `url(#${gid})` }, svg);
    el("path", { d: line, class: "line" }, svg);

    // Position en cours : ligne du prix d'entrée + point d'entrée
    if (pos) {
      const yp = y(pos.price);
      el("line", { x1: pad.l, x2: W - pad.r, y1: yp, y2: yp, class: "entry-line " + pos.side }, svg);
      const idx = pts.findIndex((p) => p[0] >= pos.time);
      if (idx >= 0) el("circle", { cx: x(idx), cy: yp, r: 5, class: "entry-dot " + pos.side }, svg);
      const lbl = el("g", { class: "tag entry " + pos.side }, svg);
      el("rect", { x: W - pad.r + 2, y: yp - 10, width: pad.r - 4, height: 20, rx: 10 }, lbl);
      const t = el("text", { x: W - pad.r / 2, y: yp + 4, "text-anchor": "middle" }, lbl);
      t.textContent = opts.fmtNumber(pos.price, 0);
    }

    // Dernier point
    const last = pts[n - 1];
    el("circle", { cx: x(n - 1), cy: y(last[1]), r: 4, class: "last-dot" }, svg);
    const lastTag = el("g", { class: "tag last" }, svg);
    el("rect", { x: W - pad.r + 2, y: y(last[1]) - 10, width: pad.r - 4, height: 20, rx: 10 }, lastTag);
    const lt = el("text", { x: W - pad.r / 2, y: y(last[1]) + 4, "text-anchor": "middle" }, lastTag);
    lt.textContent = opts.fmtNumber(last[1], 0);

    // Survol : valeur et heure du point le plus proche
    const guide = el("line", { y1: pad.t, y2: H - pad.b, class: "hover-line", visibility: "hidden" }, svg);
    const dot = el("circle", { r: 4, class: "hover-dot", visibility: "hidden" }, svg);
    const tip = document.createElement("div");
    tip.className = "curve-tip";
    tip.hidden = true;
    box.appendChild(tip);
    const hit = el("rect", { x: pad.l, y: 0, width: W - pad.l - pad.r, height: H, fill: "transparent" }, svg);

    function show(evt) {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.round((evt.clientX - r.left - pad.l) / step)));
      const cx = x(i), cy = y(pts[i][1]);
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx);
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
      guide.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = "<b>" + opts.fmtNumber(pts[i][1], 1) + "</b><span>" + opts.fmtPoint(pts[i][0]) + "</span>";
      const left = Math.min(Math.max(cx - tip.offsetWidth / 2, 0), W - tip.offsetWidth);
      tip.style.left = left + "px";
      tip.style.top = Math.max(cy - tip.offsetHeight - 12, 0) + "px";
    }
    function hide() {
      guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden");
      tip.hidden = true;
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", hide);
  }

  window.drawCurve = drawCurve;
})();
