/* ==========================================================================
   The walkthrough's six screens, rebuilt.

   These are not pictures of the app. Each one runs the same engine the app
   runs — the ephemeris, the panchang, the Vimshottari cycle, the muhurta
   scorer, the ashtakoota tables — in the visitor's own browser, for the
   visitor's own place and the current minute.

   Where the app has a model for something, that model is ported here rather
   than reinvented. The day's five grades and the choghadiya clock below are
   prototype/src/app.js's `rhythmModel` line for line; the graha colours, the
   nesting of the dasha rungs and the koota bars are the app's own.
   ========================================================================== */
import { renderChart, focusPlanet, clearFocus, aspectsOf } from "./chart.js";
import { transitInto, PLAIN, fmtDeg, offsetAt, NAKS } from "./kundali.js";
import { HOUSE_THEME } from "./insight.js";
import { positions } from "../vendor/astro/ephemeris.js";
import { sunTimes } from "../vendor/astro/sky.js";
import { vara, taraBala, houseFrom, gocharaFavourable, chandrashtama } from "../vendor/astro/panchang.js";
import { vimshottari } from "../vendor/astro/dasha3.js";
import { ashtakoota } from "../vendor/astro/match.js";
import { findMuhurta, PURPOSES } from "../vendor/astro/muhurta.js";
import { createSkyField } from "./skyfield.js";
import { asset } from "./asset.js";

const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
  if (text != null) n.textContent = text; return n; };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GRAHA_ART = g => asset(`assets/graha/${g.toLowerCase()}.png`);
const art = g => { const i = new Image(); i.src = GRAHA_ART(g); i.alt = ""; return i; };
const nakOf = lon => Math.floor(((lon % 360) + 360) % 360 / (360 / 27));
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ==========================================================================
   1 — YOUR DAY
   The choghadiya clock, Rahu Kalam and Abhijit forced over it, then shaded by
   this person's tara bala and the Moon's count from their natal Moon. Ported
   from app.js `rhythmModel`; the five grades and their colours are the app's.
   ========================================================================== */
const RH_HORA = ["Sun","Venus","Mercury","Moon","Saturn","Jupiter","Mars"];
const RH_CHOG = { Sun:["Udveg",-1], Venus:["Char",1], Mercury:["Labh",1],
  Moon:["Amrit",2], Saturn:["Kaal",-2], Jupiter:["Shubh",2], Mars:["Rog",-1] };
const RH_SENSE = { Amrit:"nectar — broadly auspicious", Shubh:"gentle and constructive",
  Labh:"supportive for gains, negotiations and practical decisions",
  Char:"movement — good for travel and setting out",
  Udveg:"restless — routine over launches", Kaal:"heavy — maintenance, not beginnings",
  Rog:"friction-prone — keep the stakes low",
  Abhijit:"the midday victor — traditionally the finest window",
  "Rahu Kalam":"traditionally set aside" };
const RH_GRADE = [[3,"excellent","Excellent"],[1,"good","Good"],[0,"steady","Steady"],
  [-2,"caution","Caution"],[-99,"avoid","Avoid"]];
const rhGrade = s => { for (const [min, cls, label] of RH_GRADE) if (s >= min) return { cls, label };
  return { cls:"avoid", label:"Avoid" }; };
const RAHU_KALAM_SEGMENT = { 0:8, 1:2, 2:7, 3:5, 4:6, 5:4, 6:3 };
const AREA_HOUSES = { Career:[10,6,3,1], Wealth:[2,11,5], Relationships:[7,5,11],
  "Well-being":[1,6,8], "Home & family":[4,2,12], "Inner growth":[9,12,5] };

function rhythmModel(date, place, sample) {
  const off = d => offsetAt(d, place.tz);
  const d0 = new Date(date); d0.setHours(0,0,0,0);
  const d1 = d0.getTime() + 864e5;
  const st  = sunTimes(date, place.lat, place.lon, off(date));
  const stP = sunTimes(new Date(d0.getTime() - 864e5), place.lat, place.lon, off(date));
  const stN = sunTimes(new Date(d0.getTime() + 864e5), place.lat, place.lon, off(date));
  if (!st.rise || !st.set || !stP.set || !stN.rise) return null;

  const V = vara(date);
  const segs = [];
  const eight = (t0, t1, lord0) => { const i0 = RH_HORA.indexOf(lord0);
    for (let i = 0; i < 8; i++) { const lord = RH_HORA[(i0 + i) % 7];
      segs.push({ a:t0 + (t1-t0)*i/8, b:t0 + (t1-t0)*(i+1)/8,
        lord, name:RH_CHOG[lord][0], base:RH_CHOG[lord][1] }); } };
  const prevLord = vara(new Date(d0.getTime() - 864e5)).lord;
  eight(stP.set.getTime(), st.rise.getTime(), RH_HORA[(RH_HORA.indexOf(prevLord) + 5) % 7]);
  eight(st.rise.getTime(), st.set.getTime(), V.lord);
  eight(st.set.getTime(), stN.rise.getTime(), RH_HORA[(RH_HORA.indexOf(V.lord) + 5) % 7]);

  const dayMs = st.set - st.rise, noon = (st.rise.getTime() + st.set.getTime()) / 2;
  const rseg = RAHU_KALAM_SEGMENT[date.getDay()];
  const rahu = { a:st.rise.getTime() + dayMs*(rseg-1)/8, b:st.rise.getTime() + dayMs*rseg/8 };
  const abhi = date.getDay() === 3 ? null : { a:noon - 24*6e4, b:noon + 24*6e4 };

  /* the personal layer */
  const natalMoon = sample.planets.find(p => p.graha === "Moon");
  const sky = transitInto(date, sample.lagna.sign);
  const moonT = sky.find(p => p.graha === "Moon");
  const hFromMoon = houseFrom(natalMoon.sign, moonT.sign);
  const tara = taraBala(nakOf(natalMoon.lon), nakOf(moonT.lon));
  const moonFav = gocharaFavourable("Moon", hFromMoon);
  const cAshtama = chandrashtama(hFromMoon);
  const mood = (tara.tone === "good" ? 1 : tara.tone === "testing" ? -1 : 0) + (moonFav ? 1 : -1);
  const shift = Math.max(-1, Math.min(1, Math.round(mood / 2)));

  const cuts = new Set([d0.getTime(), d1, rahu.a, rahu.b]);
  if (abhi) { cuts.add(abhi.a); cuts.add(abhi.b); }
  const sliced = [];
  for (const s of segs) {
    const edges = [s.a, s.b, ...[...cuts].filter(c => c > s.a && c < s.b)].sort((x,y) => x-y);
    for (let i = 0; i < edges.length - 1; i++) {
      const a = Math.max(edges[i], d0.getTime()), b = Math.min(edges[i+1], d1);
      if (b <= a) continue;
      let score = s.base + shift, name = s.name;
      const mid = (a + b) / 2;
      if (abhi && mid >= abhi.a && mid < abhi.b) { score = 3; name = "Abhijit"; }
      if (mid >= rahu.a && mid < rahu.b) { score = -3; name = "Rahu Kalam"; }
      if (cAshtama) score = Math.min(score, 0);
      sliced.push({ a, b, score, name, chog:s.name, ...rhGrade(score) });
    }
  }
  sliced.sort((x,y) => x.a - y.a);
  const windows = [];
  for (const s of sliced) {
    const last = windows.at(-1);
    if (last && last.cls === s.cls && last.name === s.name && Math.abs(last.b - s.a) < 1000) last.b = s.b;
    else windows.push({ ...s });
  }
  const daytime = windows.filter(w => w.b > st.rise.getTime() && w.a < st.set.getTime());
  const best = [...daytime].sort((x,y) => y.score - x.score || (y.b-y.a) - (x.b-x.a))[0] || null;
  const care = [...daytime].sort((x,y) => x.score - y.score || (y.b-y.a) - (x.b-x.a))[0] || null;
  return { windows, d0:d0.getTime(), d1, sunrise:st.rise, sunset:st.set,
           tara, moonFav, chandrashtama:cAshtama, best, care, sky, V };
}

const SVGNS = "http://www.w3.org/2000/svg";
/* the app's sunrise and sunset glyphs: half a sun on the horizon, with the arrow
   saying which way it is going — not a moon standing in for sunset */
function sunGlyph(up) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", "0 0 24 18"); s.setAttribute("aria-hidden", "true");
  for (const d of ["M2 16h20", "M7 16a5 5 0 0 1 10 0", "M4.6 11.2l1.5 1", "M19.4 11.2l-1.5 1", "M12 1.5v6",
                   up ? "M9.6 3.9L12 1.5l2.4 2.4" : "M9.6 5.1L12 7.5l2.4-2.4"]) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.6"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.append(p);
  }
  return s;
}

export function dayPanel(host, place, sample) {
  let offset = 0, held = null, model = null, seek = null;
  host.replaceChildren();
  const wrap = el("div", "lv lv-day");
  const left = el("div", "dy-left"), right = el("div", "dy-right");

  const top = el("div", "lv-daytop");
  const prev = el("button", "lv-step", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous day");
  const next = el("button", "lv-step", "›"); next.type = "button"; next.setAttribute("aria-label", "Next day");
  const when = el("p", "lv-when");
  const today = el("button", "lv-today", "Today"); today.type = "button"; today.hidden = true;
  top.append(prev, when, next, today);

  const bar = el("div", "dy-bar");
  const track = el("div", "rhytrack"); track.tabIndex = 0;
  track.setAttribute("role", "slider"); track.setAttribute("aria-label", "The day, midnight to midnight");
  const pill = el("div", "rpill");
  bar.append(track, pill);
  const marks = el("div", "rmarks");
  /* the clock under the bar, each hour at its true place: 12 AM to 12 AM */
  const scale = el("div", "rscale");
  ["12 AM", "6 AM", "12 PM", "6 PM", "12 AM"].forEach((t, i) => {
    const s = el("span", null, t); s.style.left = (i * 25) + "%"; scale.append(s); });
  const read = el("div", "rread");
  left.append(top, bar, marks, scale, read);

  const areas = el("div", "dy-areas");
  const dohold = el("div", "lv-dohold");
  right.append(el("p", "dy-h", "Across your life today"), areas, dohold);

  wrap.append(left, right);
  host.append(wrap);

  const t12 = t => new Date(t).toLocaleTimeString("en-US",
    { hour:"numeric", minute:"2-digit", hour12:true, timeZone:place.tz });
  const pct = t => (t - model.d0) / (model.d1 - model.d0) * 100;
  const windowAt = t => model.windows.find(w => t >= w.a && t < w.b);
  const natalMoon = sample.planets.find(p => p.graha === "Moon");

  function paint(t) {
    const w = windowAt(t);
    if (!w) return;
    seek.style.left = pct(t) + "%";
    pill.style.left = pct(t) + "%";
    pill.textContent = t12(t);
    const sense = RH_SENSE[w.name] || RH_SENSE[w.chog] || "";
    const g = el("p", "rgrade g-" + w.cls, w.label);
    g.append(el("span", null, `${t12(w.a)} – ${t12(w.b)}`));
    const nm = el("p", "rname");
    nm.append(el("b", null, w.name), document.createTextNode(sense ? " · " + sense : ""));
    const why = el("p", "rwhy", `Why: the ${w.name} window, shaded by your tara bala (${model.tara.name}) `
      + `and the Moon's ${model.moonFav ? "supportive" : "unsupportive"} count from your natal Moon`
      + `${model.chandrashtama ? ", with the whole day capped by Chandrashtama" : ""}.`);
    read.replaceChildren(g, nm, why);
  }

  function mark(t, up) {
    const m = el("div", "rmark" + (up ? " up" : " down"));
    const p = pct(t.getTime());
    m.style.left = p + "%";
    if (p < 7) m.classList.add("edge-l"); else if (p > 93) m.classList.add("edge-r");
    m.title = up ? "Sunrise" : "Sunset";
    m.append(sunGlyph(up), el("span", null, t12(t)));
    return m;
  }

  function render() {
    const date = new Date(Date.now() + offset * 864e5);
    today.hidden = offset === 0;
    when.textContent = date.toLocaleDateString("en-GB",
      { weekday:"long", day:"numeric", month:"long", timeZone:place.tz }) + ` · ${place.name}`;

    model = rhythmModel(date, place, sample);
    if (!model) { track.replaceChildren(); marks.replaceChildren();
      read.replaceChildren(el("p", "lv-note", "The Sun does not rise or set here today.")); return; }

    track.replaceChildren();
    for (const w of model.windows) {
      const i = el("i", "rw " + w.cls);
      i.style.left = pct(w.a) + "%"; i.style.width = Math.max(.2, pct(w.b) - pct(w.a)) + "%";
      track.append(i);
    }
    for (const [t, cls] of [[model.sunrise, "rsun"], [model.sunset, "rsun set"]]) {
      const s = el("i", cls); s.style.left = pct(t.getTime()) + "%"; track.append(s); }
    const now = Date.now();
    if (now >= model.d0 && now < model.d1) { const n = el("i", "rnow"); n.style.left = pct(now) + "%"; track.append(n); }
    seek = el("i", "rseek"); track.append(seek);
    marks.replaceChildren(mark(model.sunrise, true), mark(model.sunset, false));

    paint(held ?? (now >= model.d0 && now < model.d1 ? now : model.d0 + (model.d1 - model.d0) * .5));

    /* six areas of life, as a light list rather than six heavy cards */
    areas.replaceChildren();
    for (const [name, houses] of Object.entries(AREA_HOUSES)) {
      const here = model.sky.filter(p => houses.includes(p.house) && p.graha !== "Moon");
      const good = here.filter(p => gocharaFavourable(p.graha, houseFrom(natalMoon.sign, p.sign))).length;
      const [cls, word] = !here.length ? ["steady", "Steady"]
        : good > here.length - good ? ["strong", "Supportive"]
        : good === 0 ? ["care", "Caution"] : ["steady", "Steady"];
      const row = el("div", "dy-area");
      const st = el("span", "st " + cls); st.append(el("i"), document.createTextNode(word));
      const gr = el("span", "gr"); for (const p of here.slice(0, 3)) gr.append(art(p.graha));
      row.append(el("span", "nm", name), gr, st);
      areas.append(row);
    }

    dohold.replaceChildren();
    const d = el("div", "do"), h = el("div", "hold");
    d.append(el("b", null, "Do"), el("span", null, model.best
      ? `${t12(model.best.a)}–${t12(model.best.b)} is the day's ${model.best.label.toLowerCase()} stretch. Put the thing that matters there.`
      : "Keep to the routine; nothing stands out today."));
    h.append(el("b", null, "Hold"), el("span", null, model.care
      ? `${t12(model.care.a)}–${t12(model.care.b)} is for maintenance, not beginnings.`
      : "Nothing today is especially set aside."));
    dohold.append(d, h);
  }

  const atX = clientX => { const r = track.getBoundingClientRect();
    return model.d0 + Math.min(.999, Math.max(0, (clientX - r.left) / r.width)) * (model.d1 - model.d0); };
  let dragging = false;
  track.addEventListener("pointerdown", e => { if (!model) return; dragging = true;
    track.setPointerCapture(e.pointerId); held = atX(e.clientX); paint(held); });
  track.addEventListener("pointermove", e => { if (dragging) { held = atX(e.clientX); paint(held); } });
  track.addEventListener("pointerup", () => { dragging = false; });
  track.addEventListener("keydown", e => {
    if (!model) return;
    const step = 30 * 60000, base = held ?? Date.now();
    if (e.key === "ArrowRight") held = Math.min(model.d1 - 1, base + step);
    else if (e.key === "ArrowLeft") held = Math.max(model.d0, base - step);
    else return;
    e.preventDefault(); paint(held);
  });

  prev.onclick = () => { offset -= 1; held = null; render(); };
  next.onclick = () => { offset += 1; held = null; render(); };
  today.onclick = () => { offset = 0; held = null; render(); };
  render();

  /* scrolling through this screen walks the seeker across the day */
  return { scrub(f) { if (!model) return;
    held = model.d0 + Math.min(.999, Math.max(0, f)) * (model.d1 - model.d0); paint(held); } };
}

/* ==========================================================================
   2 — YOUR TIMELINE
   The app stacks the three periods vertically down a spine; here the spine
   lies on its side, but it is the same map: one band per mahadasha, sized by
   its years, and the three rungs you are standing on redrawn beneath it.
   ========================================================================== */
const COLOUR = g => `var(--${g.toLowerCase()})`;

/* what each graha's years are traditionally read as bringing — plain words,
   framed as tradition, never as a forecast */
const DASHA_TONE = {
  Sun: "authority, visibility and the slow clarifying of who you are when people are watching",
  Moon: "home, feeling and the people who keep you steady",
  Mars: "drive and direction — the energy to finish what has stalled",
  Mercury: "learning, trade, talk and the sorting of detail",
  Jupiter: "growth, teachers and a wider view of where your life is going",
  Venus: "love, comfort, beauty and what you choose to keep",
  Saturn: "patience, duty and the slow work of building something that lasts",
  Rahu: "appetite, ambition and the pull toward the unfamiliar",
  Ketu: "detachment, inwardness and letting go of what no longer fits"
};

export function timelinePanel(host, sample) {
  const moon = sample.planets.find(p => p.graha === "Moon");
  const birth = new Date(sample.moment.iso);
  const cycle = vimshottari(moon.lon, birth);
  const YR = 365.25 * 864e5;
  const t0 = +birth, t1 = t0 + 80 * YR, now = Date.now();     /* a life, not the whole 120-year cycle */
  let at = Math.min(Math.max(now, t0), t1 - 1);
  const ms = d => +new Date(d);
  const mahas = cycle.mahadashas.filter(m => ms(m.end) > t0 && ms(m.start) < t1);

  host.replaceChildren();
  const wrap = el("div", "lv lv-time");
  const left = el("div", "tl-left"), right = el("div", "tl-right");

  const whenRow = el("div", "tl-when");
  const whenB = el("b"), whenS = el("span");
  const toNow = el("button", "lv-today", "Today"); toNow.type = "button";
  whenRow.append(whenB, whenS, toNow);

  /* three timelines stacked: the life, the chapter you are in, the weeks inside it */
  const mkRow = (cls, label) => {
    const row = el("div", "tl-row");
    const lab = el("div", "tl-lab"), lord = el("b");
    lab.append(el("span", null, label), lord);
    const bar = el("div", "tl-bar " + cls); bar.tabIndex = 0;
    bar.setAttribute("role", "slider"); bar.setAttribute("aria-label", label);
    row.append(lab, bar);
    return { row, lord, bar, key: null, span: [0, 1], segs: [] };
  };
  const R1 = mkRow("l1", "Mahadasha"), R2 = mkRow("l2", "Antardasha"), R3 = mkRow("l3", "Pratyantardasha");
  const scale = el("div", "tl-scale");
  for (const y of [0, 20, 40, 60, 80]) scale.append(el("span", null, String(new Date(t0 + y * YR).getFullYear())));
  R1.row.append(scale);
  left.append(whenRow, R1.row, R2.row, R3.row);

  const title = el("div", "tl-title"), dates = el("p", "tl-dates");
  const prog = el("div", "tl-prog"), progI = el("i"); prog.append(progI);
  const pct = el("p", "tl-pct"), sub = el("p", "tl-sub"), read = el("p", "tl-read");
  const go = el("button", "tl-go", "Understand this period in detail ›"); go.type = "button";
  /* in the app this opens the period's own page; here it says where to get the app */
  go.addEventListener("click", e => { e.stopPropagation(); document.querySelector(".nav-get")?.click(); });
  right.append(title, dates, prog, pct, sub, read, go);

  wrap.append(left, right);
  host.append(wrap);

  const fmtM = t => new Date(t).toLocaleDateString("en-GB", { month:"short", year:"numeric" });
  const fmtD = t => new Date(t).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
  const age = t => Math.floor((t - t0) / YR);
  const find = (list, t) => list.find(p => t >= ms(p.start) && t < ms(p.end)) ?? list[list.length - 1];
  const tint = (lord, on) => `color-mix(in srgb, ${COLOUR(lord)} ${on ? 34 : 13}%, #fff)`;

  function fill(R, list, s, e, t) {
    const key = list.map(p => p.lord + p.start).join("|");      /* rebuild only when the level changes */
    if (R.key !== key) {
      R.key = key; R.span = [s, e];
      R.bar.replaceChildren();
      R.segs = list.map(p => {
        const a = Math.max(ms(p.start), s), b = Math.min(ms(p.end), e);
        const seg = el("div", "tl-seg");
        seg.style.flex = String(Math.max(b - a, 1));
        seg.title = `${p.lord} · ${fmtM(a)} – ${fmtM(b)}`;
        seg.append(art(p.lord));
        R.bar.append(seg);
        return { seg, p };
      });
      R.mark = el("i", "tl-mark"); R.nowDot = el("i", "tl-now");
      R.bar.append(R.mark, R.nowDot);
    }
    const [a, b] = R.span, x = v => (v - a) / (b - a) * 100;
    R.mark.style.left = x(t) + "%";
    R.nowDot.hidden = !(now >= a && now < b);
    R.nowDot.style.left = x(now) + "%";
    const cur = find(list, t);
    for (const { seg, p } of R.segs) { seg.classList.toggle("on", p === cur); seg.style.background = tint(p.lord, p === cur); }
    R.lord.textContent = cur.lord; R.lord.style.color = COLOUR(cur.lord);
    return cur;
  }

  const coloured = lord => { const b = el("b", null, lord); b.style.color = COLOUR(lord); return b; };

  function draw() {
    const maha = fill(R1, mahas, t0, t1, at);
    const antar = fill(R2, maha.antardashas, ms(maha.start), ms(maha.end), at);
    const prats = antar.pratyantardashas || [];
    const prat = prats.length ? fill(R3, prats, ms(antar.start), ms(antar.end), at) : null;

    whenB.textContent = fmtM(at);
    whenS.textContent = `age ${age(at)}`;
    toNow.hidden = Math.abs(at - now) < 20 * 864e5;

    const s = ms(maha.start), e = ms(maha.end), frac = Math.min(1, Math.max(0, (at - s) / (e - s)));
    title.replaceChildren(art(maha.lord), coloured(maha.lord), el("span", "noun", "mahadasha"));
    dates.replaceChildren(document.createTextNode(`${fmtD(s)} → ${fmtD(e)}`),
                          el("span", null, `age ${Math.max(0, age(s))}–${age(e)}`));
    progI.style.width = (frac * 100).toFixed(1) + "%";
    progI.style.background = COLOUR(maha.lord);
    pct.textContent = `${Math.round(frac * 100)}% through${at > now + 864e5 ? " · this chapter lies ahead" : ""}`;

    sub.replaceChildren(document.createTextNode("Inside it, "), coloured(antar.lord), document.createTextNode(" antardasha"));
    if (prat) sub.append(document.createTextNode(", and "), coloured(prat.lord), document.createTextNode(" for these few weeks."));
    else sub.append(document.createTextNode("."));

    const natal = sample.planets.find(p => p.graha === maha.lord);
    read.textContent = `${maha.lord} years are traditionally read as a season of ${DASHA_TONE[maha.lord]}.`
      + (natal ? ` Here ${maha.lord} sits in the ${ORD(natal.house)} house, so that season gathers around ${HOUSE_THEME[natal.house][0]}.` : "");
  }

  for (const R of [R1, R2, R3]) {
    let drag = false;
    const atX = x => { const r = R.bar.getBoundingClientRect(), [a, b] = R.span;
      return a + Math.min(.999, Math.max(0, (x - r.left) / r.width)) * (b - a); };
    R.bar.addEventListener("pointerdown", e => { drag = true; R.bar.setPointerCapture(e.pointerId); at = atX(e.clientX); draw(); });
    R.bar.addEventListener("pointermove", e => { if (drag) { at = atX(e.clientX); draw(); } });
    R.bar.addEventListener("pointerup", () => { drag = false; });
    R.bar.addEventListener("keydown", e => {
      const [a, b] = R.span, step = (b - a) / (e.shiftKey ? 20 : 100);
      if (e.key === "ArrowRight") at = Math.min(t1 - 1, at + step);
      else if (e.key === "ArrowLeft") at = Math.max(t0, at - step);
      else return;
      e.preventDefault(); draw();
    });
  }
  toNow.onclick = () => { at = Math.min(Math.max(now, t0), t1 - 1); draw(); };
  draw();

  /* scrolling through this screen carries you across the life, birth to eighty */
  return { scrub(f) { at = t0 + Math.min(.999, Math.max(0, f)) * (t1 - t0); draw(); } };
}

/* ==========================================================================
   3 — YOUR UNIVERSE
   The chart at birth, and the chart today — a day at a time.
   ========================================================================== */
export function universePanel(host, sample, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-uni");
  const pills = el("div", "lv-pills");
  const body = el("div", "lv-unibody");
  wrap.append(pills, body);
  host.append(wrap);

  const TABS = ["Birth Chart", "Today's Sky"];
  let tab = 1, started = false, day = 0, sel = "Saturn";
  const birthT = +new Date(sample.moment.iso), nowT = Date.now();

  /* ---- the chart, and a day-by-day tracker under it ---------------------- */
  const chartWrap = el("div", "lv-chart uv-chart");
  const holder = el("div", "lv-chartbox");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "The chart; every graha is a button.");
  holder.append(svg);
  const dayRow = el("div", "uv-day");
  const prev = el("button", "lv-step", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "One day back");
  const next = el("button", "lv-step", "›"); next.type = "button"; next.setAttribute("aria-label", "One day on");
  const dateL = el("p", "uv-date");
  const reset = el("button", "lv-today", "Back to today"); reset.type = "button";
  dayRow.append(prev, dateL, next);
  const scrub = el("input", "lv-scrub uv-scrub");
  scrub.type = "range"; scrub.min = "-180"; scrub.max = "180"; scrub.step = "1"; scrub.value = "0";
  scrub.setAttribute("aria-label", "Move the sky one day at a time");
  const say = el("div", "lv-say");
  chartWrap.append(holder, dayRow, scrub, reset, say);

  const fmt = t => new Date(t).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
  const read = p => {
    focusPlanet(svg, p);
    say.replaceChildren(
      el("b", null, `${p.graha} · ${ORD(p.house)} house · ${p.signName}`),
      el("p", "lv-thin", `${fmtDeg(p.deg)} ${p.signName} · ${p.nakshatra}${p.retro ? " · retrograde" : ""}`));
  };
  function paint() {
    const when = tab === 0 ? birthT : nowT + day * 864e5;
    const planets = tab === 0 ? sample.planets : transitInto(new Date(when), sample.lagna.sign);
    renderChart(svg, { ...sample, planets }, { assets:"assets", interactive:true, onSelect:p => { sel = p.graha; read(p); } });
    read(planets.find(p => p.graha === sel) ?? planets[0]);
    dateL.textContent = tab === 0 ? `Born ${fmt(birthT)}` : day === 0 ? `Today · ${fmt(when)}` : fmt(when);
    chartWrap.classList.toggle("is-birth", tab === 0);
    reset.hidden = tab === 0 || day === 0;
    scrub.value = String(day);
  }
  const setDay = d => { day = Math.max(-180, Math.min(180, Math.round(d))); paint(); };
  prev.onclick = () => setDay(day - 1);
  next.onclick = () => setDay(day + 1);
  reset.onclick = () => setDay(0);
  scrub.addEventListener("input", () => setDay(+scrub.value));
  svg.addEventListener("click", e => { if (e.target === svg) clearFocus(svg); });

  function sync() {
    [...pills.children].forEach((b, i) => b.classList.toggle("on", i === tab));
    body.replaceChildren(chartWrap);
    paint();
  }
  TABS.forEach((name, i) => {
    const b = el("button", null, name); b.type = "button";
    b.onclick = () => { tab = i; if (i !== 1) day = 0; sync(); };
    pills.append(b);
  });

  /* the first time the screen is seen, the tracker walks a fortnight forward and
     back on its own — so it is obvious that the sky moves, and that you can move it */
  async function hint() {
    if (reduce) return;
    const path = [...Array(15).keys(), ...[...Array(15).keys()].reverse()];
    for (const d of path) { if (tab !== 1) return; setDay(d); await wait(70); }
  }

  return {
    start() { if (!started) { started = true; sync(); hint(); } },
    stop() {},
    /* scrolling on through this screen carries today's sky forward, a day at a time */
    scrub(f) { if (tab !== 1) return; setDay(Math.max(0, (f - .15) / .85) * 120); },
    /* where each graha's picture is on screen right now — the next screen picks
       them up from here and carries them into the real sky */
    planetRects() {
      const out = {};
      for (const g of svg.querySelectorAll(".k-planet")) {
        const name = g.dataset.graha || g.getAttribute("data-graha") || g.querySelector("image")?.getAttribute("aria-label");
        if (!name) continue;
        const r = (g.querySelector("image") || g).getBoundingClientRect();
        if (r.width) out[name] = r;
      }
      return out;
    }
  };
}

/* ==========================================================================
   3b — THE SKY ABOVE YOU
   The real sky over the visitor's place, edge to edge: the twenty-seven
   nakshatras, the zodiac belt, and the seven grahas where they stand this
   minute. Drag or use the arrow keys; step outside for the app's own sky.
   ========================================================================== */
export function skyPanel(host, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-sky");
  const cv = document.createElement("canvas"); cv.tabIndex = 0;
  cv.setAttribute("aria-label", "The sky over you now. Drag, or use the arrow keys, to look around.");
  const bar = el("div", "sk-bar");
  const where = el("p", "sk-where");
  const step = el("button", "uv-step", "Step outside"); step.type = "button";
  step.addEventListener("pointerenter", () => import("./sky-embed.js").then(m => m.preloadRealSky?.()), { once: true });
  step.onclick = async () => {
    const { openRealSky } = await import("./sky-embed.js");
    openRealSky({ lat:place.lat, lon:place.lon, name:place.name, tz:place.tz });
  };
  bar.append(where, step);
  const hint = el("p", "sk-hint", "Drag to look around · Zoom out to the Earth, scrub through the night and point your phone at the sky in the app");
  wrap.append(cv, bar, hint);
  host.append(wrap);

  let field = null, started = false;
  const t12 = t => new Date(t).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true, timeZone:place.tz });
  const ensure = () => {
    if (field) return field;
    field = createSkyField(cv, { place, when:new Date(), zodiac:true, all:true, fov:92, art:GRAHA_ART });
    return field;
  };
  const paintWhere = () => { where.textContent = `${place.name} · ${t12(Date.now())} ${tzAbbr(place.tz)} · looking ${compass(field.camera.az)}`; };
  const compass = az => ["north","north-east","east","south-east","south","south-west","west","north-west"][Math.round((((az % 360) + 360) % 360) / 45) % 8];
  let tick = 0;
  return {
    start() {
      ensure();
      /* paint synchronously: the fly-in that follows needs the positions now */
      field.resize(); field.frameAll(!started); paintWhere();
      started = true;
      clearInterval(tick); tick = setInterval(() => { field.setWhen(new Date()); paintWhere(); }, 30000);
    },
    stop() { clearInterval(tick); },
    /* the screen's own coordinates for each graha, for the fly-in */
    skyPoints() {
      ensure(); const r = cv.getBoundingClientRect(); const out = {};
      for (const g of ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]) {
        const p = field.screenPos(g); if (p) out[g] = { x:r.left + p.x, y:r.top + p.y, alt:p.alt };
      }
      return out;
    }
  };
}

/* ==========================================================================
   4 — ASK ASTRA
   The Moon listens, thinks and speaks — the app's four states, its own
   keyframes. The question sits on the right, the answer on the left, and no
   sentence in it was written in advance.
   ========================================================================== */
export function askPanel(host, sample) {
  const T = transitInto(new Date(), sample.lagna.sign);
  const nat = g => sample.planets.find(p => p.graha === g);
  const tr  = g => T.find(p => p.graha === g);
  const moon = nat("Moon");
  const cycle = vimshottari(moon.lon, new Date(sample.moment.iso));
  const at = cycle.at(new Date());

  const QS = [
    { q: "What period am I in?", build: () => ({
        text: `A ${at.maha.lord} mahadasha with ${at.antar.lord} antardasha`
          + `${at.pratyantar ? `, and a ${at.pratyantar.lord} pratyantardasha inside that` : ""}. `
          + `The sequence started from your Moon in ${moon.nakshatra} — that nakshatra alone fixes both the order and the starting point.`,
        chips: [`${at.maha.lord} maha`, `${at.antar.lord} antar`, moon.nakshatra] }) },
    { q: "Explain my seventh house.", build: () => {
        const h7 = sample.houses.find(h => h.house === 7);
        const lord = sample.planets.find(p => p.graha === h7.lord);
        return { text: `Your 7th carries ${h7.signName}, ruled by ${h7.lord}`
          + `${lord ? `, which sits in your ${ORD(lord.house)} house in ${lord.signName}` : ""}. `
          + `Marriage and partnership are therefore read through where ${h7.lord} landed, not through the 7th alone.`,
          chips: ["7th house", h7.signName, h7.lord] }; } },
    { q: "What should I pay attention to right now?", build: () => {
        const s = tr("Saturn"), [theme] = HOUSE_THEME[s.house];
        return { text: `Saturn is crossing your ${ORD(s.house)} house — ${theme}. `
          + `It is at ${fmtDeg(s.deg)} ${s.signName}, in ${s.nakshatra}${s.retro ? ", retrograde" : ""}. `
          + `Within the tradition a passage this slow is read as a long emphasis, never an event on a date.`,
          chips: ["Saturn transit", `${ORD(s.house)} house`, s.signName] }; } }
  ];

  host.replaceChildren();
  const wrap = el("div", "lv lv-ask");
  const moonWrap = el("div", "gmoonwrap");
  const orb = el("div", "gmoon idle");
  orb.style.backgroundImage = `url("${asset("assets/moon/phase_15_full_moon.png")}")`;
  moonWrap.append(orb);
  const thread = el("div", "gthread");
  const bubble = el("div", "bubble me");
  const answer = el("div", "gasr");
  const head = el("div", "astrahead");
  head.append(el("i", "orbdot"), document.createTextNode("Astra"));
  const atext = el("p", "astratext");
  const chips = el("div", "gchips");
  answer.append(head, atext, chips);
  thread.append(bubble, answer);
  const dots = el("div", "gdots");
  QS.forEach(() => dots.append(el("i")));
  wrap.append(moonWrap, thread, dots, el("p", "lv-foot", "Keep scrolling: three questions, three answers, each assembled from the chart and naming what it used."));
  host.append(wrap);

  const setState = s => { if (!orb.classList.contains(s)) orb.className = "gmoon " + s; };
  const built = QS.map(() => null);
  let shownQ = -1, shownA = -1;

  /* The conversation is driven by the scroll, not a clock: each third of the way
     through this screen is one exchange — the question lands, the Moon thinks,
     the answer arrives — so nobody is carried past it before it has finished. */
  function scrub(f) {
    const n = QS.length;
    const i = Math.min(n - 1, Math.floor(f * n)), k = f * n - i;
    [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i));
    if (shownQ !== i) {
      shownQ = i; shownA = -1;
      bubble.textContent = QS[i].q;
      atext.textContent = ""; chips.replaceChildren();
      answer.classList.remove("on");
      bubble.classList.remove("on");
      requestAnimationFrame(() => bubble.classList.add("on"));
    }
    if (k < .12) setState("listening");
    else if (k < .38) { setState("thinking"); if (shownA === i) { shownA = -1; answer.classList.remove("on"); } }
    else {
      if (shownA !== i) {
        shownA = i;
        const b = built[i] || (built[i] = QS[i].build());
        atext.textContent = b.text;
        chips.replaceChildren(...b.chips.map(c => el("span", "gchip", c)));
        answer.classList.add("on");
      }
      setState(k < .7 ? "speaking" : "idle");
    }
  }
  scrub(0);
  return { start(){}, stop(){}, scrub };
}

/* ==========================================================================
   5 — FIND MUHURAT
   Dates, an occasion, one button. The app's own muhurta engine scores every
   window in the range; the page shows the three best, in the place's own clock.
   ========================================================================== */
const OCCASIONS = [
  { id:"marriage",   label:"Marriage",     icon:["M8.5 15.5a4.5 4.5 0 1 0 0-.01", "M15.5 15.5a4.5 4.5 0 1 0 0-.01", "M10 5.5l2-2.5 2 2.5-2 2z"] },
  { id:"business",   label:"New venture",  icon:["M4 8.5h16v11H4z", "M9 8.5V6h6v2.5", "M4 13h16"] },
  { id:"property",   label:"Home",         icon:["M3.5 11L12 4l8.5 7", "M6 9.5V20h12V9.5", "M10 20v-5.5h4V20"] },
  { id:"purchase",   label:"Big purchase", icon:["M5.5 8.5h13l-1 11.5h-11z", "M9 8.5a3 3 0 0 1 6 0"] },
  { id:"travel",     label:"Journey",      icon:["M3 11.5l18-7.5-7.5 18-2.5-7.5z", "M11 14.5l3-3"] },
  { id:"childbirth", label:"Childbirth",   icon:["M12 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z", "M6 20a6 6 0 0 1 12 0"] }
];
const icon = paths => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
  for (const d of paths) { const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d); s.append(p); }
  return s;
};
/* "IST", "EST", "BST" where the locale knows a short name; the GMT offset otherwise */
function tzAbbr(tz, at = new Date()) {
  for (const loc of ["en-US", "en-GB", "en-IN"]) {
    const n = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: "short" })
      .formatToParts(at).find(p => p.type === "timeZoneName")?.value;
    if (n && !/^GMT|^UTC/.test(n)) return n;
  }
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at).find(p => p.type === "timeZoneName")?.value || tz;
}
const isoDay = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

export function muhurtaPanel(host, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-muh");
  const form = el("div", "mu-form");

  /* Three steps, one at a time, each appearing when the last is answered:
       1  the occasion — an icon and a word, nothing else
       2  the range — a chip picks it; From and To then show, and can be edited
       3  one button                                                          */
  const MAX_DAYS = 60;
  const today = new Date();
  let purpose = null, rangeSet = false;

  const stepEl = (n, title) => { const s = el("div", "mu-step"); s.dataset.step = n;
    const h = el("p", "mu-steph"); h.append(el("i", null, String(n)), document.createTextNode(title)); s.append(h); return s; };

  const s1 = stepEl(1, "What are you beginning?");
  const occ = el("div", "mu-occ"); occ.setAttribute("role", "radiogroup"); occ.setAttribute("aria-label", "Occasion");
  for (const o of OCCASIONS) {
    const b = el("button"); b.type = "button"; b.dataset.id = o.id;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
    b.append(icon(o.icon), el("span", null, o.label));
    b.onclick = () => { purpose = o.id;
      occ.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      reveal(); };
    occ.append(b);
  }
  s1.append(occ);

  const s2 = stepEl(2, "When?");
  const chips = el("div", "mu-chips"); chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", "Date range");
  const range = el("div", "mu-range"); range.hidden = true;
  const mkDate = (label, v) => { const l = el("label", "mu-date"); l.append(el("span", null, label));
    const i = el("input"); i.type = "date"; i.value = v; l.append(i); range.append(l); return i; };
  const fromI = mkDate("From", isoDay(today));
  const toI = mkDate("To", isoDay(new Date(Date.now() + 14 * 864e5)));
  fromI.min = isoDay(today);
  const clampRange = () => {
    const f = new Date(fromI.value + "T00:00"), t = new Date(toI.value + "T00:00");
    toI.min = fromI.value;
    toI.max = isoDay(new Date(f.getTime() + MAX_DAYS * 864e5));
    if (t < f) toI.value = fromI.value;
    if (t > new Date(toI.max + "T00:00")) toI.value = toI.max;
  };
  fromI.addEventListener("change", clampRange); toI.addEventListener("change", clampRange); clampRange();
  const RANGES = [["Next 2 weeks", 14], ["Next month", 30], ["Next 2 months", 60], ["Pick dates", 0]];
  for (const [label, days] of RANGES) {
    const b = el("button", null, label); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", "false");
    b.onclick = () => {
      chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      if (days) { fromI.value = isoDay(new Date()); toI.value = isoDay(new Date(Date.now() + days * 864e5)); clampRange(); }
      rangeSet = true; range.hidden = false;
      if (!days) fromI.focus({ preventScroll:true });
      reveal();
    };
    chips.append(b);
  }
  s2.append(chips, range);

  const s3 = el("div", "mu-step"); s3.dataset.step = 3;
  const go = el("button", "mu-go"); go.type = "button";
  go.append(el("span", null, "Find the best Muhurat"), el("i", "mu-spin"));
  s3.append(go);

  /* once computed the form folds to one line: what was asked, and a way back */
  const summary = el("div", "mu-sum"); summary.hidden = true;
  const sumText = el("span"), change = el("button", "mu-change", "Change"); change.type = "button";
  summary.append(sumText, change);

  form.append(s1, s2, s3);
  const stage = el("div", "mu-stage");
  wrap.append(summary, form, stage);
  host.append(wrap);

  function reveal() {
    s2.classList.toggle("on", !!purpose);
    s3.classList.toggle("on", !!purpose && rangeSet);
  }
  change.onclick = () => { summary.hidden = true; form.hidden = false; stage.replaceChildren(); form.classList.remove("gone"); };

  const tz = tzAbbr(place.tz);
  const t12 = t => new Date(t).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true, timeZone:place.tz });
  const dayname = t => new Date(t).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", timeZone:place.tz });
  const dshort = d => new Date(d + "T00:00").toLocaleDateString("en-GB", { day:"numeric", month:"short" });

  /* the computation takes milliseconds; the animation is there so the reading is
     seen being made — and the number it counts to is the true number scanned */
  function computing(scanned, span) {
    const c = el("div", "mu-calc");
    const orb = el("div", "mu-orrery");
    for (const g of ["Moon", "Sun", "Jupiter"]) { const r = el("i", "ring"); r.append(art(g)); orb.append(r); }
    const count = el("p", "mu-count");
    const sweep = el("div", "mu-sweep"); sweep.append(el("i"));
    const lab = el("p", "mu-lab", `${span} days · every window`);
    c.append(orb, count, sweep, lab);
    stage.replaceChildren(c);
    const t0 = performance.now(), dur = reduce ? 200 : 1900;
    return new Promise(res => {
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        count.textContent = `Reading ${Math.round(scanned * k).toLocaleString()} windows`;
        sweep.firstChild.style.width = (k * 100) + "%";
        k < 1 ? requestAnimationFrame(step) : setTimeout(res, 150);
      };
      requestAnimationFrame(step);
    });
  }

  go.onclick = async () => {
    const from = new Date(fromI.value + "T00:00"), to = new Date(toI.value + "T23:59");
    if (!(to > from) || !purpose) return;
    /* the press is seen: the button sinks and spins for a beat, then the form
       folds to one line and the reading is made in the open */
    go.classList.add("busy"); go.disabled = true;
    await wait(reduce ? 0 : 520);
    const r = findMuhurta({ from, to, lat:place.lat, lon:place.lon, tzMinutes: offsetAt(from, place.tz), purpose, top:18 });
    const occLabel = OCCASIONS.find(o => o.id === purpose).label;
    sumText.textContent = `${occLabel} · ${dshort(fromI.value)} – ${dshort(toI.value)} · ${place.name}`;
    summary.hidden = false;
    form.classList.add("gone");
    await wait(reduce ? 0 : 300);
    form.hidden = true;
    go.classList.remove("busy"); go.disabled = false;
    await computing(r.scanned, Math.round((to - from) / 864e5));

    /* three options on three different days where the range allows — two
       back-to-back windows on one afternoon are one option, not two */
    const picks = [], seen = new Set();
    for (const w of r.best) { const d = dayname(w.windowFrom);
      if (!seen.has(d)) { seen.add(d); picks.push(w); } if (picks.length === 3) break; }
    for (const w of r.best) { if (picks.length === 3) break; if (!picks.includes(w)) picks.push(w); }

    const list = el("ol", "mu-res");
    picks.forEach((w, i) => {
      const li = el("li", "mu-item" + (i === 0 ? " top" : ""));
      const when = el("div", "mu-when");
      when.append(el("b", null, dayname(w.windowFrom)),
        el("span", null, `${t12(w.windowFrom)} – ${t12(w.windowTo)}`), el("em", "mu-tz", tz));
      const more = el("button", "mu-more", "See in detail"); more.type = "button";
      const why = el("ul", "mu-why"); why.hidden = true;
      for (const x of w.reasons.filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 3))
        why.append(el("li", null, x.text));
      more.onclick = () => { why.hidden = !why.hidden; more.textContent = why.hidden ? "See in detail" : "Hide"; };
      li.append(el("span", "mu-rank", String(i + 1)), when, more, why);
      if (i === 0) li.append(el("span", "mu-flag", "Most auspicious"));
      list.append(li);
      setTimeout(() => li.classList.add("on"), 60 + i * 110);
    });
    stage.replaceChildren(list);
  };
}

/* ==========================================================================
   6 — RELATIONSHIP COMPATIBILITY
   Ashtakoota Milan on two real charts. The inputs fold away once computed;
   what is left is two names, one score and the eight kootas.
   ========================================================================== */
export function matchPanel(host, sample) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-match");
  const people = el("div", "mtwo");
  const names = el("p", "mt-names");
  const go = el("button", "mgo", "Compute compatibility"); go.type = "button";
  const out = el("div", "mt-out");
  wrap.append(people, names, go, out);
  host.append(wrap);

  /* two real births: the example chart ("Aarav", as the app's own sample profile is
     called) and a second chart cast from its own moment — 4 August 2004. The
     partner was chosen as an example that reads well (29.5 of 36); the score is
     still the engine's, computed below, not a number written into the page */
  const moonA = sample.planets.find(p => p.graha === "Moon");
  const bornB = new Date(+new Date(sample.moment.iso) - 1008 * 864e5 + 5 * 36e5);
  const moonBL = ((positions(bornB).Moon % 360) + 360) % 360;
  const A = "Aarav", B = "Natasha";

  const person = (name, born, lon) => {
    const c = el("div", "mperson");
    c.append(el("div", "mname", name), el("div", "mborn", born));
    const m = el("div", "mmoon"); m.append(art("Moon"), document.createTextNode(`Moon in ${NAKS[nakOf(lon)]}`));
    c.append(m);
    return c;
  };
  people.append(
    person(A, `${new Date(sample.moment.iso).toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}, ${sample.moment.name}`, moonA.lon),
    el("div", "mjoin", "+"),
    person(B, `${bornB.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" })}, Delhi`, moonBL));

  go.onclick = async () => {
    go.disabled = true;
    const k = ashtakoota({ moonL: moonA.lon }, { moonL: moonBL });

    /* the two Moons draw together while the eight are counted */
    const calc = el("div", "mt-calc");
    const pair = el("div", "mt-moons"); pair.append(art("Moon"), art("Moon"));
    const tick = el("p", "mt-tick");
    calc.append(pair, tick);
    out.replaceChildren(calc);
    people.classList.add("done");
    names.textContent = `${A}  ·  ${B}`;
    go.hidden = true;
    for (let i = 0; i < k.kootas.length; i++) {
      tick.textContent = `${k.kootas[i].name}…`;
      await wait(reduce ? 20 : 210);
    }

    const low = k.total < 18;
    const card = el("div", "scorecard");
    const num = el("div", "scorenum" + (low ? " low" : ""), String(k.total)); num.append(el("small", null, " / 36"));
    const side = el("div", "scoreside");
    const bar = el("div", "bar" + (low ? " low" : "")), fill = el("i"), gate = el("b");
    gate.style.left = "50%"; bar.append(fill, gate);
    side.append(bar, el("p", "scoreverdict", k.verdict.charAt(0).toUpperCase() + k.verdict.slice(1) + "."));
    card.append(num, side);

    const grid = el("div", "kootas");
    k.kootas.forEach((it, i) => {
      const c = el("div", "koota");
      const top = el("div", "ktop"); top.append(el("b", null, it.name), el("span", "kscore", `${it.got}/${it.max}`));
      const kb = el("div", "kbar"), f = el("i", it.got === 0 ? "none" : it.got === it.max ? "full" : "part");
      kb.append(f); c.append(top, kb);
      grid.append(c);
      setTimeout(() => { c.classList.add("on"); f.style.width = (it.got / it.max * 100) + "%"; }, 140 + i * 70);
    });
    /* the eight are the summary; the report reads each one, with the placements behind it */
    const more = el("a", "mt-report", "Read a detailed report ›"); more.href = "#reports";
    out.replaceChildren(card, grid, more);
    requestAnimationFrame(() => { fill.style.width = (k.total / 36 * 100) + "%"; });
  };
}
