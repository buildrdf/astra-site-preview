/* ==========================================================================
   The walkthrough's live pieces.

   Not screenshots. Each of these is the actual element, rebuilt on the page and
   driven by the same engine the app uses: scrub a date and the day recomputes,
   drag a period open and the periods inside it appear, touch a planet and the
   chart answers, drag the sky, calculate a real match between two charts.

   Everything here computes. Nothing is written into the markup as a guess.
   ========================================================================== */
import { renderChart, focusPlanet, clearFocus, aspectsOf } from "./chart.js";
import { transitInto, castChart, PLAIN, fmtDeg, fmtDate } from "./kundali.js";
import { dayShape, moonAt } from "./today.js";
import { HOUSE_THEME } from "./insight.js";
import { vimshottari } from "../vendor/astro/dasha3.js";
import { ashtakoota } from "../vendor/astro/match.js";
import { createSkyField } from "./skyfield.js";
import { asset } from "./asset.js";

const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
  if (text != null) n.textContent = text; return n; };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   THE DAY'S RHYTHM — scrub the date, get a verdict, watch the areas of life
   ========================================================================== */
const LIFE_AREAS = [
  { name: "Career", houses: [10, 6, 2] },
  { name: "Wealth", houses: [2, 11] },
  { name: "Relationships", houses: [7, 5] },
  { name: "Wellbeing", houses: [1, 6] },
  { name: "Growth", houses: [9, 5] }
];
/* a slow graha crossing a life-area's houses reads as that area's weather for
   the day; the same house-theme table the "Ask Astra" reading uses */
function areaState(transits, houses) {
  const heavy = ["Saturn", "Rahu", "Mars"];
  const hit = transits.find(p => houses.includes(p.house) && heavy.includes(p.graha));
  if (hit) return { cls: hit.graha === "Saturn" ? "hold" : "mixed", why: `${hit.graha} is crossing here` };
  const soft = transits.find(p => houses.includes(p.house) && ["Jupiter","Venus","Moon"].includes(p.graha));
  if (soft) return { cls: "good", why: `${soft.graha} is crossing here` };
  return { cls: "mixed", why: "no strong crossing today" };
}

export function dayRhythm(host, place, sample) {
  let offset = 0;                                   /* days from today, scrubbed */
  host.replaceChildren();
  const wrap = el("div", "lv lv-day");

  const datebar = el("div", "lv-datebar");
  const prev = el("button", null, "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous day");
  const next = el("button", null, "›"); next.type = "button"; next.setAttribute("aria-label", "Next day");
  const kicker = el("p", "lv-kicker");
  const today = el("button", "lv-today", "Today"); today.type = "button"; today.hidden = true;
  datebar.append(prev, kicker, next, today);

  const bar = el("div", "lv-bar");
  const legend = el("div", "lv-legend");
  const legGood = el("span"); legGood.append(el("i", "good"), document.createTextNode("Favoured"));
  const legHold = el("span"); legHold.append(el("i", "hold"), document.createTextNode("Held back"));
  legend.append(legGood, legHold);
  const scale = el("div", "lv-scale");
  const summary = el("div", "lv-summary");
  const pillsWrap = el("div", "lv-pills-wrap");
  const pills = el("div", "lv-pills" + (reduce ? " reduce-static" : ""));
  pillsWrap.append(pills);
  const pillsCap = el("p", "lv-pills-cap", "How your day reads across every area of life.");
  const moon = el("div", "lv-moon");
  const foot = el("p", "lv-foot", "Drag the days. Everything here is computed for where you are.");

  wrap.append(datebar, bar, legend, scale, summary, pillsWrap, pillsCap, moon, foot);
  host.append(wrap);

  function render() {
    const date = new Date(Date.now() + offset * 864e5);
    const d = dayShape(date, place);
    const isToday = offset === 0;
    today.hidden = isToday;
    kicker.textContent = (isToday ? "" : offset > 0 ? "In " + offset + " day" + (offset > 1 ? "s" : "") + " · " : offset + " day" + (offset < -1 ? "s" : "") + " ago · ")
      + date.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", timeZone: place.tz });

    if (d.polar) {
      bar.replaceChildren(); scale.replaceChildren(); summary.replaceChildren(el("p", null, d.polar));
      pillsWrap.hidden = true; moon.replaceChildren();
      return;
    }
    pillsWrap.hidden = false;

    bar.replaceChildren();
    const good = el("div", "lv-band good"); good.style.left = d.abhijit.left + "%"; good.style.width = Math.max(d.abhijit.width, 2.5) + "%";
    good.title = "Abhijit " + d.abhijit.text;
    const hold = el("div", "lv-band hold"); hold.style.left = d.rahu.left + "%"; hold.style.width = Math.max(d.rahu.width, 2.5) + "%";
    hold.title = "Rahu Kalam " + d.rahu.text;
    bar.append(good, hold);
    if (isToday && d.nowPct != null) { const n = el("i", "lv-now"); n.style.left = d.nowPct + "%"; bar.append(n); }

    scale.replaceChildren(el("span", null, d.riseText + " sunrise"), el("span", null, d.setText + " sunset"));

    /* the day's verdict: the weekday's own ruler, plus whether the crossing
       slow grahas favour or caution today across the life areas */
    const transits = transitInto(date, sample.lagna.sign);
    const states = LIFE_AREAS.map(a => ({ ...a, ...areaState(transits, a.houses) }));
    const bad = states.filter(s => s.cls === "hold").length, goodN = states.filter(s => s.cls === "good").length;
    const verdictCls = bad >= 3 ? "hold" : goodN >= 3 ? "good" : "mixed";
    const verdictWord = verdictCls === "good" ? "A favourable day" : verdictCls === "hold" ? "A day to hold steady" : "A mixed day";
    const career = states.find(s => s.name === "Career");
    summary.replaceChildren(
      (() => { const v = el("div", "verdict"); v.append(el("i", verdictCls), document.createTextNode(verdictWord)); return v; })(),
      el("p", null, `${d.vara.day} is traditionally ruled by ${d.vara.lord}. Career reads ${career.cls === "good" ? "favourable" : career.cls === "hold" ? "held back" : "mixed"} today — ${career.why}.`)
    );

    pills.replaceChildren();
    const build = () => states.forEach(s => {
      const p = el("span", "lv-pill"); p.append(el("i", s.cls), document.createTextNode(s.name)); pills.append(p);
    });
    build(); build();      /* doubled, so the marquee loop has no seam */

    const m = moonAt(date);
    moon.replaceChildren();
    const mi = new Image(); mi.src = asset(m.file); mi.alt = "";
    const mt = el("div");
    mt.append(el("b", null, `${m.name} · ${Math.round(m.illum * 100)}% lit`),
              el("span", null, `${m.paksha} ${m.tithi}`));
    moon.append(mi, mt);
  }

  prev.onclick = () => { offset -= 1; render(); };
  next.onclick = () => { offset += 1; render(); };
  today.onclick = () => { offset = 0; render(); };
  render();
}

/* ==========================================================================
   TIME CONTAINS TIME — open a period, or drag / arrow through the line
   ========================================================================== */
export function dashaStack(host, sample) {
  const moon = sample.planets.find(p => p.graha === "Moon");
  const cycle = vimshottari(moon.lon, new Date(sample.moment.iso));
  const now = Date.now();
  let path = [];

  host.replaceChildren();
  const wrap = el("div", "lv lv-time");
  const crumb = el("div", "lv-crumb");
  const rows = el("div", "lv-rows lv-full");
  const say = el("div", "lv-say");
  const hint = el("p", "lv-scrub-hint", "Drag the line, or focus it and use the arrow keys.");
  wrap.append(crumb, rows, say, hint);
  host.append(wrap);

  const levelOf = () => {
    if (!path.length) return { list: cycle.mahadashas, label: "Mahadasha", of: "a life" };
    if (path.length === 1) return { list: path[0].antardashas, label: "Antardasha", of: path[0].lord + " mahadasha" };
    return { list: path[1].pratyantardashas || [], label: "Pratyantardasha", of: path[1].lord + " antardasha" };
  };

  let track = null, focusI = 0, list = [];

  function draw() {
    const lvl = levelOf(); list = lvl.list;
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
    track = el("div", "lv-track"); track.tabIndex = 0;
    track.setAttribute("role", "slider"); track.setAttribute("aria-label", `${lvl.label} timeline`);
    const segEls = [];
    list.forEach((p, i) => {
      const s = +new Date(p.start), e = +new Date(p.end);
      const seg = el("div", "lv-seg");
      seg.style.width = ((e - s) / (t1 - t0) * 100) + "%";
      const running = now >= s && now < e;
      if (running) seg.classList.add("running");
      const im = new Image(); im.src = asset(`assets/graha/${p.lord.toLowerCase()}.png`); im.alt = "";
      seg.append(im);
      track.append(seg); segEls.push(seg);
      if (running) { const n = el("i", "lv-now"); n.style.left = ((now - t0) / (t1 - t0) * 100) + "%"; track.append(n); }
    });
    rows.append(track);

    const span = t1 - t0, yr = 365.25 * 864e5;
    const fmt = t => new Date(t).toLocaleDateString("en-GB", span > 3 * yr
      ? { year: "numeric" } : span > 60 * 864e5 ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
    const ticks = el("div", "lv-scale");
    ticks.append(el("span", null, fmt(t0)), el("span", null, fmt(t1)));
    rows.append(ticks);

    focusI = Math.max(0, list.findIndex(p => now >= +new Date(p.start) && now < +new Date(p.end)));
    focusOn(focusI, segEls);

    /* opening a level: click a segment; scrubbing: drag along the track */
    let dragging = false;
    const segAt = clientX => {
      const r = track.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return Math.min(list.length - 1, Math.floor(frac * list.length));
    };
    const onMove = x => { const i = segAt(x); if (i !== focusI) focusOn(i, segEls); };
    track.addEventListener("pointerdown", e => { dragging = true; track.setPointerCapture(e.pointerId); onMove(e.clientX); });
    track.addEventListener("pointermove", e => { if (dragging) onMove(e.clientX); });
    track.addEventListener("pointerup", e => { if (dragging) { dragging = false;
      if (path.length < 2) { path = [...path, list[focusI]]; draw(); } } });
    track.addEventListener("click", () => { if (path.length < 2) { path = [...path, list[focusI]]; draw(); } });
    track.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { focusOn(Math.min(list.length - 1, focusI + 1), segEls); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { focusOn(Math.max(0, focusI - 1), segEls); e.preventDefault(); }
      else if (e.key === "Enter" && path.length < 2) { path = [...path, list[focusI]]; draw(); }
    });
  }

  function focusOn(i, segEls) {
    focusI = i;
    segEls.forEach((s, k) => s.classList.toggle("focus", k === i));
    const lvl = levelOf();
    tell(list[i], lvl.label, lvl.of);
  }

  function tell(p, label, of) {
    const s = +new Date(p.start), e = +new Date(p.end);
    const running = now >= s && now < e;
    const pct = Math.round((Math.min(Math.max(now, s), e) - s) / (e - s) * 100);
    say.replaceChildren(
      el("b", null, `${p.lord} ${label.toLowerCase()}`),
      el("p", null, `${fmtDate(p.start)} → ${fmtDate(p.end)}${p.years ? ` · ${p.years} years` : ""} · within ${of}.`),
      el("p", "lv-thin", running ? `Running now, ${pct}% through.` : path.length < 2 ? "Press or press Enter to open it." : "")
    );
  }
  draw();
}

/* ==========================================================================
   THE CHART — birth, today, and a slider across the years between
   ========================================================================== */
export function chartPanel(host, sample) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-chart");
  const seg = el("div", "lv-seg2");
  const bBirth = el("button", null, "Birth"), bNow = el("button", "on", "Today's sky");
  bBirth.type = bNow.type = "button";
  seg.append(bBirth, bNow);
  const hold = el("div", "lv-chartbox");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "An example birth chart. Each planet is a button.");
  hold.append(svg);
  const slider = el("input", "lv-yearslider lv-full");
  slider.type = "range"; slider.min = "0"; slider.max = "1000"; slider.value = "1000";
  slider.setAttribute("aria-label", "Move through the years since birth");
  const say = el("div", "lv-say");
  wrap.append(seg, hold, slider, say, el("p", "lv-foot", "Touch a planet, or drag the slider through the years."));
  host.append(wrap);

  const birthT = +new Date(sample.moment.iso), nowT = Date.now();
  let mode = "now";

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
  function paint(when) {
    const planets = mode === "birth" ? sample.planets : transitInto(when, sample.lagna.sign);
    renderChart(svg, { ...sample, planets }, { assets:"assets", interactive:true, onSelect:read });
    bBirth.classList.toggle("on", mode === "birth");
    bNow.classList.toggle("on", mode === "now");
    read(planets.find(p => p.graha === "Saturn") ?? planets[0]);
  }
  bBirth.onclick = () => { mode = "birth"; slider.value = "0"; paint(new Date(birthT)); };
  bNow.onclick   = () => { mode = "now";   slider.value = "1000"; paint(new Date(nowT)); };
  slider.addEventListener("input", () => {
    mode = "now";
    const f = +slider.value / 1000;
    paint(new Date(birthT + f * (nowT - birthT)));
  });
  svg.addEventListener("click", e => { if (e.target === svg) clearFocus(svg); });
  paint(new Date(nowT));
}

/* ==========================================================================
   THE SKY — the real one, over the visitor's own place, draggable
   ========================================================================== */
export function skyPanel(host, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-sky lv-full");
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
   ASK — real answers, playing on their own on a loop
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
          + `Within Vedic tradition a passage like this is read as a long, slow emphasis rather than an event.`,
          chips: ["Saturn transit", `${ORD(s.house)} house`, s.signName] }; } },
    { q: "Where is the Moon today, and does it touch my chart?", build: () => {
        const m = tr("Moon"), nm = nat("Moon");
        return { text: `The Moon is in ${m.signName} today, in ${m.nakshatra}, crossing your ${ORD(m.house)} house. `
          + `You were born with it in ${nm.signName} — so today's Moon is `
          + `${m.house === nm.house ? "back over its own natal house" : `${ORD(((m.house - nm.house + 12) % 12) + 1)} from where it began`}.`,
          chips: ["Moon", m.nakshatra, `${ORD(m.house)} house`] }; } }
  ];

  host.replaceChildren();
  const wrap = el("div", "lv lv-ask");
  const orb = el("div", "lv-orb");
  const thread = el("div", "lv-thread");
  const q = el("div", "lv-q"); const a = el("div", "lv-a");
  const ap = el("p"); const chips = el("div", "lv-chips");
  a.append(ap, chips);
  thread.append(q, a);
  wrap.append(orb, thread, el("p", "lv-foot", "Playing on its own — every answer is assembled from the chart in front of you."));
  host.append(wrap);

  let i = 0, cancelled = false, started = false;
  async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function loop() {
    while (!cancelled) {
      const { q: question, build } = QS[i];
      q.classList.remove("on"); a.classList.remove("on");
      await wait(400);
      q.textContent = question; q.classList.add("on");
      orb.classList.add("think");
      await wait(reduce ? 200 : 1400);
      const { text, chips: cs } = build();
      ap.textContent = text;
      chips.replaceChildren(...cs.map(c => el("span", "lv-chip", c)));
      orb.classList.remove("think");
      a.classList.add("on");
      await wait(reduce ? 800 : 5200);
      i = (i + 1) % QS.length;
    }
  }
  return { start(){ if (!started) { started = true; loop(); } }, stop(){ cancelled = true; } };
}

/* ==========================================================================
   RELATIONSHIP MATCHING — two real charts, calculated live
   ========================================================================== */
export function matchPanel(host, sample) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-match");
  const pair = el("div", "lv-pair");
  const chartA = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const link = el("span", "lv-linklabel", "＋");
  const chartB = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const wrapA = el("div", "lv-pchart"); wrapA.append(chartA);
  const wrapB = el("div", "lv-pchart b"); wrapB.append(chartB);
  pair.append(wrapA, link, wrapB);
  const calc = el("button", null, "Calculate compatibility"); calc.type = "button"; calc.className = "lv-calc";
  const resultWrap = el("div", "lv-full");
  wrap.append(pair, calc, resultWrap, el("p", "lv-foot", "A second, real chart — born in Delhi, twelve hours later — read against yours."));
  host.append(wrap);

  renderChart(chartA, sample, { assets:"assets", size:"small" });
  /* the partner: a genuinely different, independently cast chart, not a copy — a
     real Delhi birth twelve hours on, so the koota reading is a real calculation
     between two distinct charts, not a demo dressed up */
  const partnerUTC = new Date(+new Date(sample.moment.iso) + 12 * 3600e3);
  const partner = castChart(partnerUTC, 28.6139, 77.2090);
  renderChart(chartB, partner, { assets:"assets", size:"small" });

  let calculated = false;
  calc.onclick = () => {
    if (calculated) return;
    calculated = true; calc.disabled = true; calc.textContent = "Calculating…";
    const moonA = sample.planets.find(p => p.graha === "Moon");
    const moonB = partner.planets.find(p => p.graha === "Moon");
    setTimeout(() => {
      const result = ashtakoota({ moonL: moonA.lon }, { moonL: moonB.lon });
      calc.textContent = "Calculated";
      const score = el("div", "lv-score");
      score.append(el("b", null, `${result.total} / 36`), el("span", null, result.verdict));
      const kootas = el("div", "lv-kootas");
      resultWrap.replaceChildren(score, kootas);
      result.kootas.forEach((k, i) => {
        const c = el("div", "lv-koota");
        c.append(el("div", "name", k.name), el("div", "val" + (k.got === 0 ? " zero" : ""), `${k.got}/${k.max}`));
        kootas.append(c);
        setTimeout(() => c.classList.add("on"), i * 90);
      });
    }, reduce ? 50 : 900);
  };
}
