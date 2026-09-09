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

export function dayPanel(host, place, sample) {
  let offset = 0, held = null, model = null;
  host.replaceChildren();
  const wrap = el("div", "lv lv-day");

  const top = el("div", "lv-daytop");
  const prev = el("button", "lv-step", "‹"); prev.type = "button"; prev.setAttribute("aria-label", "Previous day");
  const next = el("button", "lv-step", "›"); next.type = "button"; next.setAttribute("aria-label", "Next day");
  const when = el("p", "lv-when");
  const today = el("button", "lv-today", "Today"); today.type = "button"; today.hidden = true;
  top.append(prev, when, next, today);

  const track = el("div", "rhytrack"); track.tabIndex = 0;
  track.setAttribute("role", "slider"); track.setAttribute("aria-label", "The day, midnight to midnight");
  const sunlabels = el("div", "rsunlabels");
  const scale = el("div", "rscale");
  for (const t of ["12 AM","6 AM","12 PM","6 PM","12 AM"]) scale.append(el("span", null, t));
  const read = el("div", "rread");
  const areas = el("div", "lv-areas");
  const dohold = el("div", "lv-dohold");
  wrap.append(top, track, sunlabels, scale, read, areas, dohold);
  host.append(wrap);

  const hhmm = t => new Date(t).toLocaleTimeString("en-GB",
    { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:place.tz });

  function paintRead(w, atNow) {
    if (!w) { read.replaceChildren(); return; }
    const sense = RH_SENSE[w.name] || RH_SENSE[w.chog] || "";
    const g = el("p", "rgrade " + "g-" + w.cls, w.label);
    g.append(el("span", null, `${hhmm(w.a)} – ${hhmm(w.b)}`));
    const nm = el("p", "rname");
    nm.append(el("b", null, w.name), document.createTextNode(sense ? " · " + sense : ""));
    const why = el("p", "rwhy", `Why: the ${w.name} window, shaded by your tara bala (${model.tara.name}) `
      + `and the Moon's ${model.moonFav ? "supportive" : "unsupportive"} count from your natal Moon`
      + `${model.chandrashtama ? ", with the whole day capped by Chandrashtama" : ""}.`);
    read.replaceChildren(g, nm, why);
    if (atNow && model.best && model.care) {
      const s = el("p", "lv-thin");
      s.append(document.createTextNode("Best window "), el("b", "g-good", `${hhmm(model.best.a)}–${hhmm(model.best.b)}`),
               document.createTextNode("  ·  Take care "), el("b", "g-caution", `${hhmm(model.care.a)}–${hhmm(model.care.b)}`));
      read.append(s);
    }
  }

  function render() {
    const date = new Date(Date.now() + offset * 864e5);
    today.hidden = offset === 0;
    when.textContent = date.toLocaleDateString("en-GB",
      { weekday:"long", day:"numeric", month:"long", timeZone:place.tz })
      + ` · ${place.name}`;

    model = rhythmModel(date, place, sample);
    if (!model) { track.replaceChildren(); read.replaceChildren(el("p", "lv-note", "The Sun does not rise or set here today.")); return; }
    const span = model.d1 - model.d0, pct = t => (t - model.d0) / span * 100;

    track.replaceChildren();
    for (const w of model.windows) {
      const i = el("i", "rw " + w.cls);
      i.style.left = pct(w.a) + "%"; i.style.width = Math.max(.2, pct(w.b) - pct(w.a)) + "%";
      track.append(i);
    }
    for (const [t, cls] of [[model.sunrise, "rsun"], [model.sunset, "rsun set"]]) {
      const s = el("i", cls); s.style.left = pct(t.getTime()) + "%"; track.append(s);
    }
    const now = Date.now();
    if (now >= model.d0 && now < model.d1) { const n = el("i", "rnow"); n.style.left = pct(now) + "%"; track.append(n); }
    const seek = el("i", "rseek"); track.append(seek);

    sunlabels.replaceChildren(el("span", null, `☀ ${hhmm(model.sunrise)} sunrise`),
                              el("span", null, `${hhmm(model.sunset)} sunset ☾`));

    const at = held ?? (now >= model.d0 && now < model.d1 ? now : model.d0 + span * .5);
    seek.style.left = pct(at) + "%";
    paintRead(model.windows.find(w => at >= w.a && at < w.b), held === null);

    /* the six areas of life, from where the grahas actually are */
    areas.replaceChildren();
    for (const [name, houses] of Object.entries(AREA_HOUSES)) {
      const here = model.sky.filter(p => houses.includes(p.house) && p.graha !== "Moon");
      const natalMoon = sample.planets.find(p => p.graha === "Moon");
      const good = here.filter(p => gocharaFavourable(p.graha, houseFrom(natalMoon.sign, p.sign))).length;
      const state = !here.length ? ["steady","Steady"]
        : good >= here.length - good + 1 ? ["strong","Supportive"]
        : good === 0 ? ["care","Caution"] : ["steady","Steady"];
      const c = el("div", "lacard");
      c.append(el("div", "laname", name), el("div", "lastatus " + state[0], state[1]));
      const row = el("div", "lagrahas");
      for (const p of here.slice(0, 3)) row.append(art(p.graha));
      c.append(row);
      areas.append(c);
    }

    /* one thing to start, one to leave alone — both taken from the windows */
    dohold.replaceChildren();
    const d = el("div", "do"), h = el("div", "hold");
    d.append(el("b", null, "Do"), el("span", null, model.best
      ? `Put the thing that matters into ${hhmm(model.best.a)}–${hhmm(model.best.b)} — the day's ${model.best.label.toLowerCase()} stretch, and ${RH_SENSE[model.best.name] || "the strongest window it has"}.`
      : "Keep to the routine; today has no standout window."));
    h.append(el("b", null, "Hold"), el("span", null, model.care
      ? `Leave ${hhmm(model.care.a)}–${hhmm(model.care.b)} for maintenance rather than beginnings — ${RH_SENSE[model.care.name] || "the tradition sets it aside"}.`
      : "Nothing today is especially set aside."));
    dohold.append(d, h);

    /* dragging the day */
    const atX = clientX => { const r = track.getBoundingClientRect();
      return model.d0 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span; };
    let dragging = false;
    const move = x => { held = atX(x); seek.style.left = pct(held) + "%";
      paintRead(model.windows.find(w => held >= w.a && held < w.b), false); };
    track.onpointerdown = e => { dragging = true; track.setPointerCapture(e.pointerId); move(e.clientX); };
    track.onpointermove = e => { if (dragging) move(e.clientX); };
    track.onpointerup = () => { dragging = false; };
    track.onkeydown = e => {
      const step = span / 48;
      if (e.key === "ArrowRight") { held = Math.min(model.d1 - 1, (held ?? now) + step); }
      else if (e.key === "ArrowLeft") { held = Math.max(model.d0, (held ?? now) - step); }
      else return;
      e.preventDefault(); seek.style.left = pct(held) + "%";
      paintRead(model.windows.find(w => held >= w.a && held < w.b), false);
    };
  }

  prev.onclick = () => { offset -= 1; held = null; render(); };
  next.onclick = () => { offset += 1; held = null; render(); };
  today.onclick = () => { offset = 0; held = null; render(); };
  render();
}

/* ==========================================================================
   2 — YOUR TIMELINE
   The app stacks the three periods vertically down a spine; here the spine
   lies on its side, but it is the same map: one band per mahadasha, sized by
   its years, and the three rungs you are standing on redrawn beneath it.
   ========================================================================== */
const COLOUR = g => `var(--${g.toLowerCase()})`;

export function timelinePanel(host, sample) {
  const moon = sample.planets.find(p => p.graha === "Moon");
  const birth = new Date(sample.moment.iso);
  const cycle = vimshottari(moon.lon, birth);
  const mahas = cycle.mahadashas;
  const t0 = +new Date(mahas[0].start), t1 = +new Date(mahas.at(-1).end);
  const now = Date.now();
  let at = Math.min(Math.max(now, t0), t1);

  host.replaceChildren();
  const wrap = el("div", "lv lv-time");
  const spine = el("div", "spine"); spine.tabIndex = 0;
  spine.setAttribute("role", "slider"); spine.setAttribute("aria-label", "A hundred and twenty years of dasha");
  const scale = el("div", "spine-scale");
  const stack = el("div", "dstack");
  const say = el("p", "dsay");
  wrap.append(spine, scale, stack, say);
  host.append(wrap);

  const bands = [];
  for (const m of mahas) {
    const b = el("div", "band");
    b.style.flex = String(m.years);
    b.style.background = `linear-gradient(180deg, color-mix(in srgb, ${COLOUR(m.lord)} 26%, transparent), color-mix(in srgb, ${COLOUR(m.lord)} 6%, transparent))`;
    b.append(art(m.lord), el("span", "blabel", m.lord));
    spine.append(b); bands.push(b);
  }
  const mark = el("i", "spinemark"); spine.append(mark);
  const tick = el("i", "nowtick"); spine.append(tick);
  scale.append(el("span", null, new Date(t0).getFullYear()), el("span", null, new Date(t1).getFullYear()));

  const pct = t => (t - t0) / (t1 - t0) * 100;
  const fmt = d => new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
  const ageAt = d => Math.floor((+new Date(d) - +birth) / (365.25 * 864e5));

  function rung(level, p, parentColour) {
    const noun = ["mahadasha","antardasha","pratyantardasha"][level - 1];
    const s = +new Date(p.start), e = +new Date(p.end);
    const frac = Math.min(1, Math.max(0, (at - s) / (e - s)));
    const d = el("div", `dlvl l${level}`);
    if (parentColour) d.style.borderLeftColor = parentColour;

    const head = el("div", "dhead");
    const im = art(p.lord);
    const b = el("b", null, p.lord); b.style.color = COLOUR(p.lord);
    head.append(im, b, el("span", "dnoun", noun));

    const span = el("div", "dspan");
    span.append(el("span", null, `${fmt(p.start)} → ${fmt(p.end)}`));
    if (level === 1) span.append(el("span", "dage", `age ${ageAt(p.start)}–${ageAt(p.end)}`));

    const bar = el("div", "dbar");
    const fill = el("i"); fill.style.width = (frac * 100).toFixed(1) + "%"; fill.style.background = COLOUR(p.lord);
    bar.append(fill);

    d.append(head, span, bar, el("p", "dpct", `${Math.round(frac * 100)}% through`));
    return d;
  }

  function draw() {
    const maha = mahas.find(m => at >= +new Date(m.start) && at < +new Date(m.end)) ?? mahas.at(-1);
    const antar = maha.antardashas.find(a => at >= +new Date(a.start) && at < +new Date(a.end)) ?? maha.antardashas[0];
    const prat = (antar.pratyantardashas || []).find(p => at >= +new Date(p.start) && at < +new Date(p.end))
      ?? (antar.pratyantardashas || [])[0];

    bands.forEach((b, i) => b.classList.toggle("on", mahas[i] === maha));
    mark.style.left = pct(at) + "%";
    tick.style.left = pct(now) + "%";

    stack.replaceChildren(rung(1, maha, null), rung(2, antar, COLOUR(maha.lord)));
    if (prat) stack.append(rung(3, prat, COLOUR(antar.lord)));

    const when = at > now ? "lies ahead" : at < now - 864e5 ? "has passed" : "is running now";
    say.textContent = `${maha.lord} over ${maha.years} years, ${antar.lord} within it`
      + `${prat ? `, and ${prat.lord} for these few weeks` : ""} — this stretch ${when}. `
      + `The whole sequence, and its starting point, come from the Moon sitting in ${moon.nakshatra} at birth.`;
  }

  const atX = clientX => { const r = spine.getBoundingClientRect();
    return t0 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (t1 - t0); };
  let dragging = false;
  spine.addEventListener("pointerdown", e => { dragging = true; spine.setPointerCapture(e.pointerId); at = atX(e.clientX); draw(); });
  spine.addEventListener("pointermove", e => { if (dragging) { at = atX(e.clientX); draw(); } });
  spine.addEventListener("pointerup", () => { dragging = false; });
  spine.addEventListener("keydown", e => {
    const step = (t1 - t0) / (e.shiftKey ? 40 : 220);
    if (e.key === "ArrowRight") at = Math.min(t1 - 1, at + step);
    else if (e.key === "ArrowLeft") at = Math.max(t0, at - step);
    else if (e.key === "Home") at = now;
    else return;
    e.preventDefault(); draw();
  });
  draw();
}

/* ==========================================================================
   3 — YOUR UNIVERSE
   Birth, today, and the real sky over the visitor — the last one filling the
   whole stage, because that is the point of it.
   ========================================================================== */
export function universePanel(host, sample, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-uni");
  const pills = el("div", "lv-pills");
  const body = el("div", "lv-unibody");
  wrap.append(pills, body);
  host.append(wrap);

  const TABS = ["Birth chart", "Today's sky", "The sky above you"];
  let tab = 1, field = null, started = false;

  const chartWrap = el("div", "lv-chart"); chartWrap.style.display = "grid";
  chartWrap.style.gap = "10px"; chartWrap.style.justifyItems = "center";
  const holder = el("div", "lv-chartbox");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "An example birth chart; every graha is a button.");
  holder.append(svg);
  const scrub = el("input", "lv-scrub"); scrub.type = "range"; scrub.min = "0"; scrub.max = "1000"; scrub.value = "1000";
  scrub.setAttribute("aria-label", "Move through the years between birth and today");
  const say = el("div", "lv-say");
  chartWrap.append(holder, scrub, say);

  const skyWrap = el("div", "lv-skywrap");
  const cv = document.createElement("canvas"); cv.tabIndex = 0;
  cv.setAttribute("aria-label", "The sky over you now. Drag it, or use the arrow keys.");
  const chip = el("div", "sky-chip");
  const clock = el("div", "sky-time");
  const picks = el("div", "sky-picks");
  skyWrap.append(cv, chip, clock, picks);

  const birthT = +new Date(sample.moment.iso), nowT = Date.now();
  const read = p => {
    focusPlanet(svg, p);
    say.replaceChildren(
      el("b", null, `${p.graha} · ${ORD(p.house)} house · ${p.signName}`),
      el("p", null, PLAIN[p.graha]),
      el("p", "lv-thin", `${fmtDeg(p.deg)} ${p.signName} · ${p.nakshatra} pada ${p.pada}`
        + `${p.retro ? " · retrograde" : ""}${p.dignity ? " · " + p.dignity : ""}`
        + ` · aspects the ${aspectsOf(p.graha, p.house).map(ORD).join(", ")}`));
  };
  function paintChart(when) {
    const planets = tab === 0 ? sample.planets : transitInto(when, sample.lagna.sign);
    renderChart(svg, { ...sample, planets }, { assets:"assets", interactive:true, onSelect:read });
    read(planets.find(p => p.graha === "Saturn") ?? planets[0]);
  }
  scrub.addEventListener("input", () => {
    if (tab === 0) { tab = 1; sync(); }
    paintChart(new Date(birthT + (+scrub.value / 1000) * (nowT - birthT)));
  });
  svg.addEventListener("click", e => { if (e.target === svg) clearFocus(svg); });

  const GR = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];
  const imgs = {};
  for (const g of GR) { const i = new Image(); i.src = GRAHA_ART(g); imgs[g] = i; }
  const tellSky = r => {
    if (!r) return;
    picks.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.g === r.graha)));
  };
  for (const g of GR) {
    const b = el("button", "sky-pick"); b.type = "button"; b.dataset.g = g;
    const i = new Image(); i.src = GRAHA_ART(g); i.alt = "";
    b.append(i, document.createTextNode(g));
    b.onclick = () => tellSky(field?.show(g, imgs[g]));
    picks.append(b);
  }

  function sync() {
    [...pills.children].forEach((b, i) => b.classList.toggle("on", i === tab));
    body.replaceChildren(tab === 2 ? skyWrap : chartWrap);
    if (tab === 2) {
      if (!field) {
        field = createSkyField(cv, { place, when:new Date(), zodiac:true });
        chip.textContent = `${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})} · ${place.name}`;
        clock.textContent = new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:place.tz});
      }
      /* a timeout, not an animation frame: the canvas has just been attached and
         needs one layout pass, but rAF never fires while the tab is in the
         background, and the sky would then be a black rectangle on return */
      setTimeout(() => {
        field.resize();                        /* paints synchronously */
        const g = field.highest(); tellSky(field.show(g, imgs[g]));
        clock.textContent = new Date().toLocaleTimeString("en-GB",
          { hour:"2-digit", minute:"2-digit", timeZone:place.tz });
      }, 0);
    } else {
      scrub.value = tab === 0 ? "0" : "1000";
      paintChart(new Date(tab === 0 ? birthT : nowT));
    }
  }

  TABS.forEach((name, i) => {
    const b = el("button", null, name); b.type = "button";
    b.onclick = () => { tab = i; sync(); };
    pills.append(b);
  });

  return { start(){ if (!started) { started = true; sync(); } else if (tab === 2) sync(); } };
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
  wrap.append(moonWrap, thread, el("p", "lv-foot", "Playing on its own. Every answer is assembled from the chart, and names what it used."));
  host.append(wrap);

  const setState = s => { orb.className = "gmoon " + s; };
  let i = 0, live = false, running = false;

  async function loop() {
    if (running) return; running = true;
    while (live) {
      const { q, build } = QS[i];
      bubble.classList.remove("on"); answer.classList.remove("on");
      setState("listening");
      await wait(reduce ? 100 : 700);
      if (!live) break;
      bubble.textContent = q; bubble.classList.add("on");
      await wait(reduce ? 100 : 600);
      setState("thinking");
      atext.textContent = "";
      chips.replaceChildren();
      await wait(reduce ? 150 : 1500);
      if (!live) break;
      const { text, chips: cs } = build();
      setState("speaking");
      atext.textContent = text;
      chips.replaceChildren(...cs.map(c => el("span", "gchip", c)));
      answer.classList.add("on");
      await wait(reduce ? 400 : 2400);
      setState("idle");
      await wait(reduce ? 400 : 3400);
      i = (i + 1) % QS.length;
    }
    running = false;
  }
  return { start(){ if (!live) { live = true; loop(); } }, stop(){ live = false; } };
}

/* ==========================================================================
   5 — FIND YOUR MOMENT
   The app's own muhurta engine, running here. Pick what it is for, say how
   long you have, and it scores every window in the range and shows its working.
   ========================================================================== */
export function muhurtaPanel(host, place) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-muh");
  const grid = el("div", "muhgrid");
  const row = el("div", "muhrow");
  const results = el("div", "muhres");
  const scanned = el("p", "muhscan");
  wrap.append(grid, row, results, scanned);
  host.append(wrap);

  let purpose = "business";
  for (const [id, p] of Object.entries(PURPOSES)) {
    const b = el("button", "muhpick"); b.type = "button"; b.dataset.id = id;
    b.setAttribute("aria-pressed", String(id === purpose));
    b.append(el("b", null, p.label), el("span", null, p.note));
    b.onclick = () => { purpose = id;
      grid.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.id === id)));
      results.replaceChildren(); scanned.textContent = ""; };
    grid.append(b);
  }

  const seg = el("div", "feelseg");
  let days = 7;
  for (const [label, n] of [["1 week",7],["2 weeks",14],["1 month",30]]) {
    const b = el("button", n === days ? "on" : null, label); b.type = "button";
    b.onclick = () => { days = n; [...seg.children].forEach(x => x.classList.toggle("on", x === b)); };
    seg.append(b);
  }
  const go = el("button", "muhgo", "Find the times"); go.type = "button";
  row.append(el("label", null, "How long you have"), seg, go);

  const hhmm = t => new Date(t).toLocaleTimeString("en-GB",
    { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:place.tz });
  const dayname = t => new Date(t).toLocaleDateString("en-GB",
    { weekday:"short", day:"numeric", month:"short", timeZone:place.tz });

  go.onclick = () => {
    go.disabled = true; go.textContent = "Reading the window…";
    results.replaceChildren(); scanned.textContent = "";
    setTimeout(() => {
      const from = new Date(), to = new Date(Date.now() + days * 864e5);
      const t0 = performance.now();
      const r = findMuhurta({ from, to, lat:place.lat, lon:place.lon,
        tzMinutes: offsetAt(from, place.tz), purpose, top:5 });
      const ms = Math.round(performance.now() - t0);
      go.disabled = false; go.textContent = "Find the times";

      const best = r.best[0]?.score ?? 1;
      r.best.forEach((w, i) => {
        const c = el("div", "muhcard" + (i === 0 ? " top" : ""));
        const top = el("div", "muhtop");
        top.append(el("span", "mdate", dayname(w.windowFrom)),
                   el("span", "mwin", `${hhmm(w.windowFrom)} – ${hhmm(w.windowTo)}`),
                   el("span", "mlen", `${w.minutes} min`));
        if (i === 0) top.append(el("span", "mflag", "Strongest"));
        const meter = el("div", "muhmeter"); const bar = el("i"); meter.append(bar);
        const panch = el("p", "muhpanch",
          `${w.lagna} lagna · ${w.nakshatra} (${w.nakClass}) · ${w.paksha} ${w.tithi} · ${w.vara}`);
        c.append(top, meter, panch);

        /* the two strongest reasons for, and the strongest against */
        const up = w.reasons.filter(x => x.pts > 0).sort((a,b) => b.pts - a.pts).slice(0, 2);
        const down = w.reasons.filter(x => x.pts < 0).sort((a,b) => a.pts - b.pts).slice(0, 1);
        for (const x of [...up, ...down]) {
          const p = el("p", "muhwhy");
          const pts = el("b", "pts " + (x.pts > 0 ? "up" : "down"), (x.pts > 0 ? "+" : "") + x.pts);
          p.append(pts, document.createTextNode("  " + x.text));
          c.append(p);
        }
        results.append(c);
        setTimeout(() => { c.classList.add("on");
          bar.style.width = Math.max(8, Math.min(100, 100 * (w.score + 6) / (best + 6))) + "%"; }, i * 90);
      });
      scanned.textContent = `${r.scanned.toLocaleString()} windows between ${dayname(from)} and ${dayname(to)} `
        + `at ${place.name}, read in ${ms} ms. Each is a stretch in which the chart itself does not change — ${r.grainAbout}.`;
    }, 30);
  };
}

/* ==========================================================================
   6 — RELATIONSHIP COMPATIBILITY
   Ashtakoota Milan on two real charts, with the reasoning behind each point.
   ========================================================================== */
export function matchPanel(host, sample) {
  host.replaceChildren();
  const wrap = el("div", "lv lv-match");
  const two = el("div", "mtwo");
  const go = el("button", "mgo", "Compute the match"); go.type = "button";
  const out = el("div", "lv-full");
  out.style.display = "grid"; out.style.gap = "11px"; out.style.justifyItems = "center";
  wrap.append(two, go, out, el("p", "lv-foot",
    "Gun Milan is one traditional method among several, and a score is not a verdict on a relationship."));
  host.append(wrap);

  /* two real births: the example chart, and a second one cast from its own
     moment — different day, different Moon, so the reading is a real one */
  const moonA = sample.planets.find(p => p.graha === "Moon");
  const bornB = new Date(+new Date(sample.moment.iso) + 2153 * 864e5 + 7 * 36e5);
  const moonBL = ((positions(bornB).Moon % 360) + 360) % 360;

  const person = (name, born, lon) => {
    const c = el("div", "mperson");
    c.append(el("div", "mname", name), el("div", "mborn", born));
    const m = el("div", "mmoon");
    m.append(art("Moon"), document.createTextNode(`Moon in ${NAKS[nakOf(lon)]}`));
    c.append(m);
    return c;
  };
  two.append(
    person("You", `${sample.moment.local}, ${sample.moment.name}`, moonA.lon),
    el("div", "mjoin", "+"),
    person("Them", bornB.toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }) + ", Delhi", moonBL));

  let done = false;
  go.onclick = () => {
    if (done) return; done = true;
    go.disabled = true; go.textContent = "Counting the eight…";
    setTimeout(() => {
      const k = ashtakoota({ moonL: moonA.lon }, { moonL: moonBL });
      go.textContent = "Computed";
      const low = k.total < 18;

      const card = el("div", "scorecard");
      const num = el("div", "scorenum" + (low ? " low" : ""), String(k.total));
      num.append(el("small", null, " / 36"));
      const side = el("div", "scoreside");
      const bar = el("div", "bar" + (low ? " low" : ""));
      const fill = el("i"); const gate = el("b"); gate.style.left = "50%";
      bar.append(fill, gate);
      side.append(bar, el("p", "scoreverdict", `${k.verdict}. The tick is the eighteen-point threshold the tradition treats as acceptable.`));
      card.append(num, side);

      const grid = el("div", "kootas");
      k.kootas.forEach((it, i) => {
        const c = el("div", "koota");
        const top = el("div", "ktop");
        top.append(el("b", null, it.name), el("span", "kscore", `${it.got}/${it.max}`));
        const kb = el("div", "kbar");
        const f = el("i", it.got === 0 ? "none" : it.got === it.max ? "full" : "part");
        kb.append(f);
        c.append(top, kb, el("p", "kabout", it.why));
        grid.append(c);
        setTimeout(() => { c.classList.add("on"); f.style.width = (it.got / it.max * 100) + "%"; }, 120 + i * 80);
      });

      out.replaceChildren(card, grid);
      requestAnimationFrame(() => { fill.style.width = (k.total / 36 * 100) + "%"; });
    }, reduce ? 30 : 700);
  };
}
