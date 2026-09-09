/* ==========================================================================
   The walkthrough's live pieces.

   Not screenshots. Each of these is the actual element, rebuilt on the page and
   driven by the same engine the app uses, so a visitor can take hold of it:
   press a time window and it explains itself, open a life period and find the
   periods inside it, touch a planet and the chart answers, drag the sky.

   Everything here computes. Nothing is written into the markup.
   ========================================================================== */
import { renderChart, focusPlanet, clearFocus, aspectsOf } from "./chart.js";
import { transitInto, PLAIN, fmtDeg, fmtDate } from "./kundali.js";
import { dayShape, moonAt, lunarMonth } from "./today.js";
import { HOUSE_THEME } from "./insight.js";
import { vimshottari } from "../vendor/astro/dasha3.js";
import { createSkyField } from "./skyfield.js";
import { asset } from "./asset.js";

const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
  if (text != null) n.textContent = text; return n; };
const hhmm = (d, tz) => d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:tz });

/* ==========================================================================
   THE DAY'S RHYTHM — a real bar for a real place, with windows you can press
   ========================================================================== */
export function dayRhythm(host, place) {
  const now = new Date();
  const d = dayShape(now, place);
  host.replaceChildren();
  const wrap = el("div", "lv lv-day");

  if (d.polar) { wrap.append(el("p", "lv-note", d.polar)); host.append(wrap); return; }

  wrap.append(el("p", "lv-kicker", now.toLocaleDateString("en-GB",
    { weekday:"long", day:"numeric", month:"long", timeZone:place.tz }) + " · " + place.name));

  /* the bar: sunrise to sunset, with the two named windows laid on it */
  const bar = el("div", "lv-bar");
  const band = (w, cls, label) => {
    const b = el("button", "lv-band " + cls);
    b.style.left = w.left + "%"; b.style.width = Math.max(w.width, 2.5) + "%";
    b.type = "button"; b.setAttribute("aria-label", `${label}, ${w.text}`);
    b.dataset.k = cls;
    bar.append(b); return b;
  };
  band(d.abhijit, "good", "Abhijit");
  band(d.rahu, "hold", "Rahu Kalam");
  if (d.nowPct != null) { const n = el("i", "lv-now"); n.style.left = d.nowPct + "%"; bar.append(n); }
  wrap.append(bar);

  const scale = el("div", "lv-scale");
  scale.append(el("span", null, d.riseText + " sunrise"), el("span", null, d.setText + " sunset"));
  wrap.append(scale);

  /* pressing a window explains it — the whole point of the element */
  const say = el("div", "lv-say");
  const LINES = {
    good: [`Abhijit · ${d.abhijit.text}`,
      "The eighth of the day's fifteen muhurtas, the one that straddles local noon. Traditionally the steadiest hour of the day for beginning something."],
    hold: [`Rahu Kalam · ${d.rahu.text}`,
      `Daylight cut into eight; this is the ${ORD(d.vara.rk)} part, which the classical table assigns to ${d.vara.day}. Traditionally kept for routine rather than for launches.`]
  };
  const pick = k => {
    const [h, b] = LINES[k];
    say.replaceChildren(el("b", null, h), el("p", null, b));
    bar.querySelectorAll(".lv-band").forEach(x => x.classList.toggle("on", x.dataset.k === k));
  };
  bar.addEventListener("click", e => { const b = e.target.closest(".lv-band"); if (b) pick(b.dataset.k); });
  wrap.append(say);

  /* the Moon, computed, with the phase image that is actually tonight's */
  const m = moonAt(now);
  const moon = el("div", "lv-moon");
  const mi = new Image(); mi.src = asset(m.file); mi.alt = "";
  const mt = el("div");
  mt.append(el("b", null, `${m.name} · ${Math.round(m.illum * 100)}% lit`),
            el("span", null, `${m.paksha} ${m.tithi} — from the Moon's distance ahead of the Sun right now.`));
  moon.append(mi, mt);
  wrap.append(moon);

  wrap.append(el("p", "lv-foot", "Press either window. Everything here is computed for where you are."));
  host.append(wrap);
  pick("good");
}

/* ==========================================================================
   TIME CONTAINS TIME — open a period and find the periods inside it
   ========================================================================== */
export function dashaStack(host, sample) {
  const moon = sample.planets.find(p => p.graha === "Moon");
  const cycle = vimshottari(moon.lon, new Date(sample.moment.iso));
  const now = Date.now();
  let path = [];                       /* [] · [maha] · [maha, antar] */

  host.replaceChildren();
  const wrap = el("div", "lv lv-time");
  const crumb = el("div", "lv-crumb");
  const rows = el("div", "lv-rows");
  const say = el("div", "lv-say");
  wrap.append(crumb, rows, say, el("p", "lv-foot",
    "Press a period to open the periods inside it. Three levels, each computed from the Moon's exact place at birth."));
  host.append(wrap);

  const levelOf = () => {
    if (!path.length) return { list: cycle.mahadashas, label: "Mahadasha", of: "a life" };
    if (path.length === 1) return { list: path[0].antardashas, label: "Antardasha", of: path[0].lord + " mahadasha" };
    return { list: path[1].pratyantardashas || [], label: "Pratyantardasha", of: path[1].lord + " antardasha" };
  };

  function draw() {
    const { list, label, of } = levelOf();
    /* the breadcrumb, which is also the way back up */
    crumb.replaceChildren();
    const root = el("button", "lv-crumb-b" + (path.length ? "" : " on"), "Your life");
    root.type = "button"; root.onclick = () => { path = []; draw(); };
    crumb.append(root);
    path.forEach((p, i) => {
      crumb.append(el("span", "lv-sep", "›"));
      const b = el("button", "lv-crumb-b" + (i === path.length - 1 ? " on" : ""), p.lord);
      b.type = "button"; b.onclick = () => { path = path.slice(0, i + 1); draw(); };
      crumb.append(b);
    });

    if (!list.length) { rows.replaceChildren(el("p", "lv-note", "This level is not divided further.")); return; }

    const t0 = +new Date(list[0].start), t1 = +new Date(list.at(-1).end);
    rows.replaceChildren();
    const track = el("div", "lv-track");
    list.forEach(p => {
      const s = +new Date(p.start), e = +new Date(p.end);
      const seg = el("button", "lv-seg");
      seg.type = "button";
      seg.style.width = ((e - s) / (t1 - t0) * 100) + "%";
      const running = now >= s && now < e;
      if (running) seg.classList.add("running");
      const im = new Image(); im.src = asset(`assets/graha/${p.lord.toLowerCase()}.png`); im.alt = "";
      seg.append(im);
      seg.setAttribute("aria-label", `${p.lord} ${label}, ${fmtDate(p.start)} to ${fmtDate(p.end)}`);
      seg.onclick = () => {
        if (path.length < 2) { path = [...path, p]; draw(); }
        else tell(p, label, of);
      };
      seg.onmouseenter = () => tell(p, label, of);
      track.append(seg);
      if (running) { const n = el("i", "lv-now");
        n.style.left = ((now - t0) / (t1 - t0) * 100) + "%"; track.append(n); }
    });
    rows.append(track);
    /* a hundred years wants years; two months wants months, or both ends read 2026 */
    const span = t1 - t0, yr = 365.25 * 864e5;
    const fmt = t => new Date(t).toLocaleDateString("en-GB", span > 3 * yr
      ? { year: "numeric" } : span > 60 * 864e5 ? { month: "short", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" });
    const ticks = el("div", "lv-scale");
    ticks.append(el("span", null, fmt(t0)), el("span", null, fmt(t1)));
    rows.append(ticks);

    const run = list.find(p => now >= +new Date(p.start) && now < +new Date(p.end)) || list[0];
    tell(run, label, of);
  }

  function tell(p, label, of) {
    const s = +new Date(p.start), e = +new Date(p.end);
    const pct = Math.round((Math.min(Math.max(now, s), e) - s) / (e - s) * 100);
    say.replaceChildren(
      el("b", null, `${p.lord} ${label.toLowerCase()}`),
      el("p", null, `${fmtDate(p.start)} → ${fmtDate(p.end)}${p.years ? ` · ${p.years} years` : ""} · within ${of}.`),
      el("p", "lv-thin", now >= s && now < e ? `Running now, ${pct}% through.`
        : path.length < 2 ? "Press it to see the periods inside." : "")
    );
  }
  draw();
}

/* ==========================================================================
   THE CHART — birth and today, and a planet you can pick up
   ========================================================================== */
export function chartPanel(host, sample) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-chart");
  const seg = el("div", "lv-seg2");
  const bBirth = el("button", "on", "Birth"), bNow = el("button", null, "Today's sky");
  bBirth.type = bNow.type = "button";
  seg.append(bBirth, bNow);
  const hold = el("div", "lv-chartbox");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "An example birth chart. Each planet is a button.");
  hold.append(svg);
  const say = el("div", "lv-say");
  wrap.append(seg, hold, say, el("p", "lv-foot", "Touch a planet. Switch between the sky at birth and the sky today."));
  host.append(wrap);

  let mode = "birth";
  const read = p => {
    focusPlanet(svg, p);
    say.replaceChildren(
      el("b", null, `${p.graha} · ${ORD(p.house)} house · ${p.signName}`),
      el("p", null, PLAIN[p.graha]),
      el("p", "lv-thin", `${fmtDeg(p.deg)} ${p.signName} · ${p.nakshatra} ${p.pada}`
        + `${p.retro ? " · retrograde" : ""}${p.dignity ? " · " + p.dignity : ""}`
        + ` · aspects the ${aspectsOf(p.graha, p.house).map(ORD).join(", ")}`)
    );
  };
  const paint = () => {
    const planets = mode === "birth" ? sample.planets : transitInto(new Date(), sample.lagna.sign);
    renderChart(svg, { ...sample, planets }, { assets:"assets", interactive:true, onSelect:read });
    bBirth.classList.toggle("on", mode === "birth");
    bNow.classList.toggle("on", mode === "now");
    read(planets.find(p => p.graha === "Saturn") ?? planets[0]);
  };
  bBirth.onclick = () => { mode = "birth"; paint(); };
  bNow.onclick   = () => { mode = "now";   paint(); };
  svg.addEventListener("click", e => { if (e.target === svg) clearFocus(svg); });
  paint();
}

/* ==========================================================================
   THE SKY — the real one, over the visitor's own place, draggable
   ========================================================================== */
export function skyPanel(host, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-sky");
  const cv = document.createElement("canvas");
  cv.tabIndex = 0;
  cv.setAttribute("aria-label", "Tonight's sky. Drag or use the arrow keys to look around.");
  const say = el("div", "lv-say");
  const row = el("div", "lv-picks");
  wrap.append(cv, row, say, el("p", "lv-foot", "Drag it. Arrow keys work too."));
  host.append(wrap);

  const field = createSkyField(cv, { place, when: new Date() });
  const imgs = {};
  const GR = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
  for (const g of GR) { const i = new Image(); i.src = asset(`assets/graha/${g.toLowerCase()}.png`); imgs[g] = i; }
  const tell = r => {
    if (!r) return;
    say.replaceChildren(el("b", null, r.graha), el("p", null, r.up
      ? `${r.alt.toFixed(0)}° above the horizon, ${r.compass}, over ${r.place} right now.`
      : `Below the horizon over ${r.place} right now — ${Math.abs(r.alt).toFixed(0)}° down, ${r.compass}.`));
    row.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.g === r.graha)));
  };
  for (const g of GR) {
    const b = el("button", "lv-pick"); b.type = "button"; b.dataset.g = g;
    const i = new Image(); i.src = imgs[g].src; i.alt = "";
    b.append(i, document.createTextNode(g));
    b.onclick = () => tell(field.show(g, imgs[g]));
    row.append(b);
  }
  return { start(){ const g = field.highest(); tell(field.show(g, imgs[g])); } };
}

/* ==========================================================================
   ASK — a real question, answered from the chart in front of you
   ========================================================================== */
export function askPanel(host, sample) {
  const T = transitInto(new Date(), sample.lagna.sign);
  const nat = g => sample.planets.find(p => p.graha === g);
  const tr  = g => T.find(p => p.graha === g);

  const QS = [
    { q: "What does Saturn mean in my chart?", build: () => {
        const s = nat("Saturn");
        return { text: `Your Saturn is in ${s.signName}, the ${ORD(s.house)} house, at ${fmtDeg(s.deg)}`
          + `${s.dignity ? " — " + s.dignity : ""}${s.retro ? ", and retrograde" : ""}. `
          + `${PLAIN.Saturn} From here it aspects the ${aspectsOf("Saturn", s.house).map(ORD).join(", ")}.`,
          chips: ["Saturn", `${ORD(s.house)} house`, s.nakshatra] }; } },
    { q: "What should I pay attention to right now?", build: () => {
        const s = tr("Saturn");
        const [theme] = HOUSE_THEME[s.house];
        return { text: `Saturn is crossing your ${ORD(s.house)} house — ${theme}. `
          + `Within Vedic tradition a passage like this is read as a long, slow emphasis rather than an event: `
          + `it asks for patience with whatever that house covers.`,
          chips: ["Saturn transit", `${ORD(s.house)} house`, s.signName] }; } },
    { q: "Where is the Moon today, and does it touch my chart?", build: () => {
        const m = tr("Moon"), nm = nat("Moon");
        return { text: `The Moon is in ${m.signName} today, in ${m.nakshatra}, crossing your ${ORD(m.house)} house. `
          + `You were born with it in ${nm.signName}, in ${nm.nakshatra} — so today's Moon is `
          + `${m.house === nm.house ? "back over its own natal house" : `${ORD(((m.house - nm.house + 12) % 12) + 1)} from where it began`}.`,
          chips: ["Moon", m.nakshatra, `${ORD(m.house)} house`] }; } }
  ];

  host.replaceChildren();
  const wrap = el("div", "lv lv-ask");
  const row = el("div", "lv-qs");
  const thread = el("div", "lv-thread");
  wrap.append(row, thread, el("p", "lv-foot",
    "Pick a question. Every answer is assembled from the chart on this page, and names what it used."));
  host.append(wrap);

  const answer = i => {
    const { q, build } = QS[i];
    const { text, chips } = build();
    thread.replaceChildren();
    thread.append(el("div", "lv-q", q));
    const a = el("div", "lv-a");
    a.append(el("small", null, "ASTRA"), el("p", null, text));
    const cs = el("div", "lv-chips");
    chips.forEach(c => cs.append(el("span", "lv-chip", c)));
    a.append(cs);
    thread.append(a);
    row.querySelectorAll("button").forEach((b, k) => b.classList.toggle("on", k === i));
  };
  QS.forEach((x, i) => { const b = el("button", "lv-q-b", x.q); b.type = "button";
    b.onclick = () => answer(i); row.append(b); });
  answer(0);
}
