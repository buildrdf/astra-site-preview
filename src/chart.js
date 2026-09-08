/* The North Indian chart, drawn the way the app draws it.
   RHOMBUS_D and the cell outlines are copied verbatim from prototype/src/app.js so the
   web page draws the identical onion-dome ogee the app draws. Seats are each cell's deep
   point (diamond centre, triangle incentre) — the same rule the report covers use. */

export const RHOMBUS_D =
  "M 50 0 C 43.07 11.46 29.38 13.83 25 25 C 13.83 29.38 11.46 43.07 0 50 " +
  "C 11.46 56.93 13.83 70.62 25 75 C 29.38 86.17 43.07 88.54 50 100 " +
  "C 56.93 88.54 70.62 86.17 75 75 C 86.17 70.62 88.54 56.93 100 50 " +
  "C 88.54 43.07 86.17 29.38 75 25 C 70.62 13.83 56.93 11.46 50 0 Z";

export const HOUSE_PATH = {
  1:"M 50 0 C 56.93 11.46 70.62 13.83 75 25 L 50 50 L 25 25 C 29.38 13.83 43.07 11.46 50 0 Z",
  2:"M 0 0 L 50 0 C 43.07 11.46 29.38 13.83 25 25 L 0 0 Z",
  3:"M 0 0 L 25 25 C 13.83 29.38 11.46 43.07 0 50 L 0 0 Z",
  4:"M 0 50 C 11.46 43.07 13.83 29.38 25 25 L 50 50 L 25 75 C 13.83 70.62 11.46 56.93 0 50 Z",
  5:"M 0 100 L 0 50 C 11.46 56.93 13.83 70.62 25 75 L 0 100 Z",
  6:"M 0 100 L 25 75 C 29.38 86.17 43.07 88.54 50 100 L 0 100 Z",
  7:"M 50 100 C 43.07 88.54 29.38 86.17 25 75 L 50 50 L 75 75 C 70.62 86.17 56.93 88.54 50 100 Z",
  8:"M 100 100 L 50 100 C 56.93 88.54 70.62 86.17 75 75 L 100 100 Z",
  9:"M 100 100 L 75 75 C 86.17 70.62 88.54 56.93 100 50 L 100 100 Z",
  10:"M 100 50 C 88.54 56.93 86.17 70.62 75 75 L 50 50 L 75 25 C 86.17 29.38 88.54 43.07 100 50 Z",
  11:"M 100 0 L 100 50 C 88.54 43.07 86.17 29.38 75 25 L 100 0 Z",
  12:"M 100 0 L 75 25 C 70.62 13.83 56.93 11.46 50 0 L 100 0 Z" };

export const SEAT = {
  1:[50,25],  2:[25,10.35],  3:[10.35,25], 4:[25,50],
  5:[10.35,75], 6:[25,89.65], 7:[50,75],   8:[75,89.65],
  9:[89.65,75], 10:[75,50],  11:[89.65,25], 12:[75,10.35] };

/* where the sign number sits: pulled toward the cell's outer corner */
export const LABEL = {
  1:[50,7], 2:[16,4.5], 3:[4.5,16], 4:[7,50], 5:[4.5,84], 6:[16,95.5],
  7:[50,93], 8:[84,95.5], 9:[95.5,84], 10:[93,50], 11:[95.5,16], 12:[84,4.5] };

/* the direction a crowded house spreads along: diamonds sideways, triangles along
   their long edge (the same instinct as chart-layout.js) */
const AXIS = {
  1:[1,0], 4:[0,1], 7:[1,0], 10:[0,1],
  2:[1,-0.35], 12:[1,0.35], 3:[-0.35,1], 5:[0.35,1],
  6:[1,0.35], 8:[1,-0.35], 9:[-0.35,-1], 11:[-0.35,1] };

const DISC = {Sun:12.8, Moon:11.2, Mars:11.4, Mercury:11.4, Jupiter:12.4,
              Venus:11.2, Saturn:13.8, Rahu:12.6, Ketu:12.6};

import { asset } from "./asset.js";

const NS = "http://www.w3.org/2000/svg";
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

/* Vedic drishti: every graha sees the 7th from itself; Mars adds 4 & 8, Jupiter 5 & 9,
   Saturn 3 & 10. The nodes' special aspects differ between schools, so only the 7th
   is drawn for them. */
export function aspectsOf(graha, house) {
  const from = n => ((house - 1 + n - 1) % 12) + 1;
  const list = [7];
  if (graha === "Mars") list.push(4, 8);
  if (graha === "Jupiter") list.push(5, 9);
  if (graha === "Saturn") list.push(3, 10);
  return list.map(from);
}

/* seat positions for the planets in one house */
export function seats(house, n, scale = 1) {
  const [cx, cy] = SEAT[house], [ax, ay] = AXIS[house];
  const len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len;
  const gap = (house % 3 === 1 ? 11 : 8.5) * scale;
  return Array.from({ length: n }, (_, i) => {
    const t = (i - (n - 1) / 2) * gap;
    const x = cx + ux * t, y = cy + uy * t;
    return [Math.min(94, Math.max(6, x)), Math.min(94, Math.max(6, y))];
  });
}

/* chart = { lagna:{sign}, houses:[{house,sign}], planets:[{graha,house,...}] }
   opts = { assets, interactive, art:true, size:"hero"|"small", onSelect } */
export function renderChart(svg, chart, opts = {}) {
  const assets = opts.assets ?? "assets";
  svg.innerHTML = "";
  svg.setAttribute("viewBox", "-2 -2 104 104");
  svg.classList.add("kchart");

  const frame = el("g", { class: "k-frame" });
  frame.append(el("rect", { x: 0, y: 0, width: 100, height: 100, class: "k-line k-outer" }));
  frame.append(el("line", { x1: 0, y1: 0, x2: 100, y2: 100, class: "k-line k-diag" }));
  frame.append(el("line", { x1: 100, y1: 0, x2: 0, y2: 100, class: "k-line k-diag" }));
  frame.append(el("path", { d: RHOMBUS_D, class: "k-line k-dome" }));
  svg.append(frame);

  /* cell washes: invisible until a house is focused */
  const cells = el("g", { class: "k-cells" });
  for (let h = 1; h <= 12; h++) cells.append(el("path", { d: HOUSE_PATH[h], class: "k-cell", "data-house": h }));
  svg.append(cells);

  /* sign numbers */
  const labels = el("g", { class: "k-labels" });
  for (const hs of chart.houses) {
    const [x, y] = LABEL[hs.house];
    const t = el("text", { x, y, class: "k-sign", "data-house": hs.house, "text-anchor": "middle", "dominant-baseline": "central" });
    t.textContent = hs.sign;
    labels.append(t);
  }
  const asc = el("text", { x: 50, y: 14.5, class: "k-asc", "text-anchor": "middle" });
  asc.textContent = "ASC";
  labels.append(asc);
  svg.append(labels);

  /* aspect lines live under the planets */
  svg.append(el("g", { class: "k-aspects" }));

  /* planets */
  const byHouse = {};
  for (const p of chart.planets) (byHouse[p.house] ??= []).push(p);
  const planets = el("g", { class: "k-planets" });
  const small = opts.size === "small";
  for (const h in byHouse) {
    const list = byHouse[h];
    const scale = list.length > 2 ? 0.74 : list.length > 1 ? 0.88 : 1;
    const pts = seats(+h, list.length, scale);
    list.forEach((p, i) => {
      const [x, y] = pts[i];
      const d = DISC[p.graha] * scale * (small ? 0.92 : 1);
      const g = el("g", { class: "k-planet", "data-graha": p.graha, "data-house": p.house,
        transform: `translate(${x} ${y})`, tabindex: opts.interactive ? 0 : -1, role: opts.interactive ? "button" : null,
        "aria-label": `${p.graha}, ${p.signName ?? ""} ${p.deg != null ? p.deg.toFixed(1) + " degrees" : ""}, house ${p.house}${p.retro ? ", retrograde" : ""}` });
      if (g.getAttribute("role") === null) g.removeAttribute("role");
      g.append(el("circle", { r: d / 2 + 1.6, class: "k-halo" }));
      const href = asset(`${assets}/graha/${p.graha.toLowerCase()}.png`);
      const img = el("image", { href, x: -d / 2, y: -d / 2, width: d, height: d, class: "k-art" });
      img.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
      g.append(img);
      if (p.retro) { const r = el("text", { x: d / 2 - 0.5, y: -d / 2 + 2.2, class: "k-retro", "text-anchor": "middle" }); r.textContent = "R"; g.append(r); }
      planets.append(g);
      if (opts.interactive) {
        g.addEventListener("click", () => opts.onSelect?.(p));
        g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onSelect?.(p); } });
      }
    });
  }
  svg.append(planets);
  return svg;
}

/* focus one planet: it lifts, its house lights, its aspects draw */
export function focusPlanet(svg, p) {
  clearFocus(svg);
  if (!p) return;
  svg.classList.add("focused");
  svg.querySelector(`.k-planet[data-graha="${p.graha}"]`)?.classList.add("lifted");
  svg.querySelector(`.k-cell[data-house="${p.house}"]`)?.classList.add("lit");
  const seat = seatOf(svg, p.graha);
  const layer = svg.querySelector(".k-aspects");
  for (const h of aspectsOf(p.graha, p.house)) {
    const [x, y] = SEAT[h];
    const line = el("line", { x1: seat[0], y1: seat[1], x2: x, y2: y, class: "k-aspect" });
    const len = Math.hypot(x - seat[0], y - seat[1]);
    line.style.setProperty("--len", len.toFixed(2));
    layer.append(line);
    svg.querySelector(`.k-cell[data-house="${h}"]`)?.classList.add("seen");
  }
}

export function focusHouse(svg, h) {
  clearFocus(svg);
  svg.classList.add("focused");
  svg.querySelector(`.k-cell[data-house="${h}"]`)?.classList.add("lit");
}

export function clearFocus(svg) {
  svg.classList.remove("focused");
  svg.querySelectorAll(".lifted,.lit,.seen").forEach(e => e.classList.remove("lifted", "lit", "seen"));
  const layer = svg.querySelector(".k-aspects"); if (layer) layer.innerHTML = "";
}

function seatOf(svg, graha) {
  const g = svg.querySelector(`.k-planet[data-graha="${graha}"]`);
  const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g?.getAttribute("transform") || "");
  return m ? [+m[1], +m[2]] : [50, 50];
}
