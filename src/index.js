/* ==========================================================================
   Astra — the four-section site.

     1  the sky: a lit Earth, the grahas floating above it, then the Kundali
     2  the walkthrough: the app's own screens, rebuilt and running
     3  three reports you can open and turn
     4  the close

   Nothing on the walkthrough is a screenshot. Every panel is the real engine
   running in this browser — the same modules the app runs.
   ========================================================================== */
import { SEAT, renderChart } from "./chart.js";
import { transitInto, guessPlace } from "./kundali.js";
import { asset } from "./asset.js";
import { ashtakoota } from "../vendor/astro/match.js";
import { dayPanel, timelinePanel, universePanel, skyPanel, askPanel, muhurtaPanel, matchPanel } from "./live.js";
import { lunarMonth } from "./today.js";
import { mountBook } from "./book.js";
import { freeKundali } from "./free.js";

const SAMPLE = await fetch("src/sample.json").then(r => r.json());
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CLASSICAL = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const NODES = ["Rahu", "Ketu"];
const GRAHAS = [...CLASSICAL, ...NODES];
const clamp = (v,a=0,b=1) => v<a?a:v>b?b:v;
const smooth = v => { const x = clamp(v); return x*x*(3-2*x); };
const glide = v => { const x = clamp(v); return x<.5 ? 4*x**3 : 1-(-2*x+2)**3/2; };
const lerp = (a,b,k) => a+(b-a)*k;

/* ==========================================================================
   1 — the hero
   ========================================================================== */
{
  const view = document.querySelector(".hero-view");
  const hero = $("hero"), cv = $("earth");
  const box = document.querySelector(".hero-chart"), svg = $("heroChart"), layer = $("heroBodies");
  const orbitsSvg = $("orbits");
  const beats = [...document.querySelectorAll(".hero-say .beat")];
  const SIZE = { Sun:1.16, Moon:1, Mars:1, Mercury:.97, Jupiter:1.12, Venus:1, Saturn:1.24, Rahu:1.05, Ketu:1.05 };

  renderChart(svg, SAMPLE, { assets:"assets" });
  svg.querySelectorAll(".k-planet").forEach(p => p.remove());
  const lines = [...svg.querySelectorAll(".k-line")];
  const signs = [...svg.querySelectorAll(".k-sign,.k-asc")];
  for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;
  for (const s of signs) s.style.opacity = 0;

  const el = {};
  for (const g of GRAHAS) {
    const d = document.createElement("div"); d.className = "body";
    const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
    d.append(im); layer.append(d); el[g] = d;
  }

  /* The seven that are bodies ride dotted orbits across the sky. Rahu and Ketu are
     the Moon's two nodes — points where its path crosses the Sun's, with nothing
     there to see — so they have no orbit and do not travel: they simply appear in
     their houses once the chart has formed. */
  const RING  = { Moon:0, Mercury:1, Venus:2, Sun:3, Mars:4, Jupiter:5, Saturn:6 };
  /* spread right across the frame, not bunched over the horizon */
  const ANGLE = { Moon:250, Mercury:233, Venus:299, Sun:266, Mars:243, Jupiter:320, Saturn:286 };

  /* where each graha finally sits: its real house in this chart, sharing the seat
     with whatever else is in that house */
  const seatOf = {};
  for (const p of SAMPLE.planets) {
    const share = SAMPLE.planets.filter(q => q.house === p.house);
    const k = share.indexOf(p), n = share.length;
    const [sx, sy] = SEAT[p.house];
    const off = n > 1 ? (k - (n - 1) / 2) * (n > 2 ? 7 : 8.5) : 0;
    const along = p.house % 3 === 1 ? [1,0] : [.72,.69];
    seatOf[p.graha] = [sx + along[0]*off, sy + along[1]*off*(p.house > 6 ? -1 : 1)];
  }

  let W=0, H=0, S=0, bx=0, by=0, disc=0;
  let ocx=0, ocy=0, ringRX=()=>0, ringRY=()=>0;

  function measure() {
    W = view.clientWidth; H = view.clientHeight;
    const r = box.getBoundingClientRect(), v = view.getBoundingClientRect();
    S = r.width; bx = r.left - v.left; by = r.top - v.top;
    disc = Math.max(30, Math.min(W, H) * .062);
    /* The dash pattern has to be rewritten on EVERY measure, not just once at load:
       it is what hides the undrawn part of each line. Left at its first value, a
       resize — or a page that loaded while hidden, at zero size — leaves a dash of
       0, which draws the whole chart solid before the story has reached it. */
    for (const l of lines) { l.dataset.px = l.dataset.len * (S / 104); l.style.strokeDasharray = l.dataset.px; }

    /* The orbit centre sits well below the frame and the rings are large, so the
       seven ride high across the whole sky instead of hugging the horizon. */
    ocx = W / 2; ocy = H * 1.32;
    ringRY = i => H * (.50 + i * .085);
    ringRX = i => Math.min(ringRY(i) * 1.8, W * .54);

    orbitsSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    orbitsSvg.replaceChildren();
    for (const g of CLASSICAL) {
      const i = RING[g];
      const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      e.setAttribute("cx", ocx); e.setAttribute("cy", ocy);
      e.setAttribute("rx", ringRX(i).toFixed(1)); e.setAttribute("ry", ringRY(i).toFixed(1));
      orbitsSvg.append(e);
    }
  }

  let t = 0, target = 0, raf = 0, drift = 0, last = 0, shown = -1;
  let px = 0, py = 0, tpx = 0, tpy = 0;

  function skyPos(g) {
    const i = RING[g];
    const speed = 1 / (1 + i * .32);          /* the outer ones move slower, as they do */
    const a = (ANGLE[g] + (drift * .62 + t * 24) * speed) * Math.PI / 180;
    const depth = .4 + i * .12;
    return [ocx + ringRX(i) * Math.cos(a) + px * depth * 28,
            ocy + ringRY(i) * Math.sin(a) + py * depth * 20];
  }

  function frame() {
    /* the Earth sinks away as the chart rises */
    const sink = smooth((t - .20) / .26);
    cv.style.opacity = (1 - sink * .72).toFixed(3);
    cv.style.transform = `translateX(-50%) translateY(${(sink * 17).toFixed(1)}%)`;
    orbitsSvg.style.opacity = (1 - smooth((t - .16) / .2)).toFixed(3);

    const drawn = smooth((t - .24) / .26);
    for (const l of lines) l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
    for (const s of signs) s.style.opacity = smooth((t - .74) / .14).toFixed(3);

    GRAHAS.forEach((g, i) => {
      const seat = seatOf[g] ?? [50,50];
      const sxp = bx + seat[0] / 100 * S, syp = by + seat[1] / 100 * S;
      const e = el[g];
      if (NODES.includes(g)) {
        const size = disc * SIZE[g] * .40;
        e.style.width = e.style.height = size.toFixed(1) + "px";
        e.style.transform = `translate(${(sxp - size/2).toFixed(1)}px,${(syp - size/2).toFixed(1)}px)`;
        e.style.opacity = smooth((t - .6) / .12).toFixed(3);
        return;
      }
      const [ox, oy] = skyPos(g);
      const delay = .26 + i * .026;
      const k = glide((t - delay) / .30);
      const dx = sxp - ox, dy = syp - oy, len = Math.hypot(dx, dy) || 1;
      const bulge = Math.sin(k * Math.PI) * len * .12 * (i % 2 ? -1 : 1);
      const x = lerp(ox, sxp, k) + (-dy / len) * bulge;
      const y = lerp(oy, syp, k) + (dx / len) * bulge;
      const size = disc * SIZE[g] * lerp(1, .40, k);
      e.style.width = e.style.height = size.toFixed(1) + "px";
      e.style.transform = `translate(${(x - size/2).toFixed(1)}px,${(y - size/2).toFixed(1)}px)`;
      e.classList.add("in");
    });

    const want = t < .22 ? 0 : t < .62 ? 1 : 2;
    if (want !== shown) { beats.forEach((b, i) => b.dataset.on = i === want ? "1" : "0"); shown = want; }
    const cue = $("cue"); if (cue) cue.style.opacity = (1 - smooth(t / .06)).toFixed(2);
  }

  function tick(now) {
    const d = target - t;
    t += Math.abs(d) < .0004 ? d : d * .13;
    const ms = last ? Math.min(now - last, 64) : 16; last = now;
    drift += ms / 1000 * 3.2;
    px += (tpx - px) * .08; py += (tpy - py) * .08;
    frame();
    const settled = Math.abs(d) < .0004 && Math.abs(tpx - px) < .002 && Math.abs(tpy - py) < .002 && t >= .3;
    raf = settled ? (last = 0) : requestAnimationFrame(tick);
  }
  function onScroll() {
    const span = (hero.offsetHeight - view.clientHeight) * .88;
    target = clamp(span > 0 ? -hero.getBoundingClientRect().top / span : 0);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  measure();
  for (const l of lines) { l.style.strokeDasharray = l.dataset.px; l.style.strokeDashoffset = l.dataset.px; }
  if (reduce) { t = target = 1; frame(); orbitsSvg.style.display = "none"; }
  else {
    onScroll();
    addEventListener("scroll", onScroll, { passive:true });
    addEventListener("resize", () => { measure(); frame(); }, { passive:true });
    if (!matchMedia("(pointer: coarse)").matches)
      view.addEventListener("pointermove", e => {
        const r = view.getBoundingClientRect();
        tpx = (e.clientX - r.left) / r.width - .5; tpy = (e.clientY - r.top) / r.height - .5;
        if (!raf) raf = requestAnimationFrame(tick);
      });
  }

}

/* ==========================================================================
   2 — the walkthrough.  The heading carries the words; the stage carries the
   thing itself, and never scrolls.
   ========================================================================== */
const HERE = guessPlace();

/* One label, one short headline, one line. Anything longer and nobody reads it —
   the detail belongs on the screen itself, where it is computed. */
const FEATURES = [
  { id:"day", tab:"Your Horoscope", eyebrow:"Your Horoscope",
    head:"Not one of twelve. Only you.",
    a:"A sun-sign horoscope is written for 680 million people at once. Yours is cast for the minute you were born, and read against today's sky.",
    live: h => dayPanel(h, HERE, SAMPLE) },

  { id:"time", tab:"Your Timeline", eyebrow:"Timeline",
    head:"Your life, in chapters.",
    a:"Vedic astrology divides a life into planetary periods, each nested inside the last. Keep scrolling and watch yours unfold.",
    live: h => timelinePanel(h, SAMPLE) },

  { id:"universe", tab:"Your Universe", eyebrow:"Universe",
    head:"Your chart, then and now.",
    a:"Touch any graha and the chart answers. Keep scrolling and today's sky moves a day at a time.",
    live: h => universePanel(h, SAMPLE, HERE) },

  /* the same grahas leave the chart and take their real places overhead */
  { id:"sky", tab:"The Sky Above You", eyebrow:"The Sky Above You", w:.8,
    head:"Now look up.",
    a:"The same grahas, where they stand over you this minute. Drag to look around.",
    live: h => skyPanel(h, HERE) },

  /* three exchanges, each given its own stretch of scroll so none is skipped */
  { id:"ask", tab:"Ask Astra", eyebrow:"Ask", w:2.2,
    head:"Ask your chart.",
    a:"Every answer is built from it — and names exactly what it used.",
    live: h => askPanel(h, SAMPLE) },

  { id:"moment", tab:"Find Muhurat", eyebrow:"Muhurat",
    head:"Find Muhurat.",
    a:"The most auspicious time to begin something that matters.",
    live: h => muhurtaPanel(h, HERE) },

  { id:"match", tab:"Relationship Compatibility", eyebrow:"Compatibility",
    head:"How two charts meet.",
    a:"Eight kootas. Thirty-six points.",
    live: h => matchPanel(h, SAMPLE) }
];

/* each screen owns a stretch of the scroll in proportion to its weight */
const WEIGHTS = FEATURES.map(f => f.w ?? 1), WSUM = WEIGHTS.reduce((a, b) => a + b, 0);
const CUM = WEIGHTS.reduce((acc, w) => (acc.push(acc[acc.length - 1] + w), acc), [0]);

{
  const nav = $("tourNav"), panel = $("panel"), tour = $("tour"), say = document.querySelector(".tour-say");
  tour.style.height = (WSUM * 92 + 30) + "vh";

  FEATURES.forEach((f, i) => {
    const host = document.createElement("div");
    host.className = "livehost surface"; host.dataset.f = i;
    panel.append(host);
    const api = f.live(host);
    host._start = api?.start; host._stop = api?.stop; host._scrub = api?.scrub; host._api = api;
  });
  const surfaces = [...panel.children];
  const iUni = FEATURES.findIndex(f => f.id === "universe"), iSky = FEATURES.findIndex(f => f.id === "sky");

  FEATURES.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = f.tab; b.setAttribute("role", "tab");
    b.setAttribute("aria-current", i === 0 ? "true" : "false");
    b.onclick = () => {
      const span = tour.offsetHeight - innerHeight;
      const top = tour.offsetTop + ((CUM[i] + WEIGHTS[i] * .35) / WSUM) * span;
      scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    };
    nav.append(b);
  });

  /* The grahas leave the chart and fly to their real places in the sky — and
     come back when the visitor scrolls up. A picture of each is carried across
     the stage; the sky underneath is already drawing them where they land. */
  const prod = document.querySelector(".prod");
  function fly(from, to) {
    if (reduce) return;
    const pr = prod.getBoundingClientRect();
    const layer = document.createElement("div"); layer.className = "flight"; prod.append(layer);
    let n = 0;
    for (const g of Object.keys(from)) {
      const a = from[g], b = to[g];
      const ax = a.x ?? a.left + a.width / 2, ay = a.y ?? a.top + a.height / 2, as = a.width ?? 36;
      const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
      im.style.width = im.style.height = as + "px";
      im.style.transform = `translate(${ax - pr.left - as / 2}px,${ay - pr.top - as / 2}px)`;
      layer.append(im); n++;
      const bs = b ? (b.width ?? 36) : as;
      const frames = b
        ? [{ transform: im.style.transform, opacity: 1 },
           { transform: `translate(${(ax + (b.x ?? b.left + b.width / 2)) / 2 - pr.left - as / 2}px,${Math.min(ay, b.y ?? b.top + b.height / 2) - 60 - pr.top - as / 2}px) scale(${(1 + bs / as) / 2})`, opacity: 1, offset: .5 },
           { transform: `translate(${(b.x ?? b.left + b.width / 2) - pr.left - as / 2}px,${(b.y ?? b.top + b.height / 2) - pr.top - as / 2}px) scale(${bs / as})`, opacity: 1, offset: .9 },
           { transform: `translate(${(b.x ?? b.left + b.width / 2) - pr.left - as / 2}px,${(b.y ?? b.top + b.height / 2) - pr.top - as / 2}px) scale(${bs / as})`, opacity: 0 }]
        : [{ opacity: 1 }, { opacity: 0, transform: im.style.transform + " scale(.6)" }];
      im.animate(frames, { duration: b ? 1150 : 500, delay: (n % 7) * 40, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
    }
    setTimeout(() => layer.remove(), 1500);
  }

  let shown = -1, swapTimer = 0;
  function show(i) {
    if (i === shown) return;
    const f = FEATURES[i];
    const was = shown;
    const paint = () => { $("tourEyebrow").textContent = f.eyebrow;
      $("tourHead").textContent = f.head; $("tourLine").textContent = f.a; };
    if (shown < 0 || reduce) paint();
    else {
      say.classList.add("swap");
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => { paint(); say.classList.remove("swap"); }, 320);
    }
    [...nav.children].forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
    const on = nav.children[i];
    if (on && nav.scrollWidth > nav.clientWidth + 4) {
      const want = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
      nav.scrollTo({ left: Math.max(0, want), behavior: reduce ? "auto" : "smooth" });
    }
    /* where the grahas are before the switch, if they are about to fly */
    const flying = (was === iUni && i === iSky) || (was === iSky && i === iUni);
    const from = flying ? (was === iUni ? surfaces[iUni]._api.planetRects() : surfaces[iSky]._api.skyPoints()) : null;
    surfaces.forEach((s, k) => {
      const isOn = k === i;
      s.classList.toggle("on", isOn);
      if (isOn && !s.dataset.started) { s.dataset.started = "1"; s._start?.(); }
      if (!isOn && s.dataset.started) s._stop?.();
      else if (isOn && s.dataset.started) s._start?.();
    });
    if (flying) fly(from, i === iSky ? surfaces[iSky]._api.skyPoints() : surfaces[iUni]._api.planetRects());
    shown = i;
  }

  function onScroll() {
    const span = tour.offsetHeight - innerHeight;
    const t = clamp(span > 0 ? -tour.getBoundingClientRect().top / span : 0);
    const at = t * WSUM;
    let i = 0; while (i < FEATURES.length - 1 && at >= CUM[i + 1]) i++;
    show(i);
    /* the rest of the scroll through a screen drives that screen: the day's seeker
       walks across the hours, the timeline across the years, Ask through its questions */
    const sub = (at - CUM[i]) / WEIGHTS[i];
    surfaces[i]._scrub?.(clamp((sub - .1) / .8));
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  show(0); onScroll();
}

/* ==========================================================================
   3 — the bento.

   Six screens got the walkthrough; this is the rest of the app in one glance.
   Every tile is something that exists, and the numbers are counted out of the
   engine — 81 yogas in the catalogue, 27 lessons, the vargas from D1 to D60 —
   never rounded up for the sake of a nicer tile.
   ========================================================================== */
{
  /* Three rows. The first is the lunar month — thirty true phases with tonight's
     lit — then the seven things that matter most, in two rows of four. */
  const TILES = [
    { moons:true, cls:"w4 lunar" },
    { big:"81", unit:"yogas", sub:"Each one named, with the rule that formed it", cls:"w2", art:"jupiter" },
    { b:"Divisional charts", sub:"D1 through D60, Parashari rules" },
    { b:"Sade Sati", sub:"Saturn's seven and a half years", art:"saturn" },
    { b:"Panchang, in full", sub:"Tithi, nakshatra, yoga, karana, vara" },
    { b:"Festivals & vrats", sub:"Amanta months, adhika included" },
    { big:"27", unit:"lessons", sub:"Learn the craft, three levels deep" },
    { b:"Reports in Hindi", sub:"The whole thing, not a summary", cls:"accent" }
  ];

  const bento = $("bento");
  const moonRow = () => {
    const w = document.createElement("div"); w.className = "moons";
    const now = new Date();
    for (const p of lunarMonth(now)) {
      const f = document.createElement("figure");
      if (p.isToday) f.className = "on";
      const mi = new Image(); mi.src = asset(p.file); mi.alt = ""; mi.loading = "lazy";
      const cap = document.createElement("figcaption"); cap.textContent = p.isToday ? "Tonight" : p.date.getDate();
      f.append(mi, cap); w.append(f);
    }
    /* tonight in the middle — measured once the row has a width, and again when
       the tile comes into view, since a row measured while unseen centres on nothing */
    w._centre = () => { const on = w.querySelector(".on");
      if (on && w.clientWidth) w.scrollLeft = on.offsetLeft - w.clientWidth / 2 + on.clientWidth / 2; };
    setTimeout(w._centre, 60); addEventListener("load", w._centre);
    return w;
  };
  for (const t of TILES) {
    if (t.moons) {
      const d = document.createElement("div"); d.className = "bt " + t.cls;
      const b = document.createElement("b"); b.textContent = "The lunar month";
      const s = document.createElement("span"); s.textContent = "Thirty phases, each the true one for its night. Tonight's is lit.";
      d.append(b, s, moonRow()); bento.append(d); continue;
    }
    const d = document.createElement("div");
    d.className = "bt" + (t.cls ? " " + t.cls : "");
    if (t.art) { const im = new Image(); im.className = "art";
      im.src = asset(`assets/graha/${t.art}.png`); im.alt = ""; d.append(im); }
    if (t.big) {
      const n = document.createElement("p"); n.className = "big";
      n.append(document.createTextNode(t.big));
      const u = document.createElement("em"); u.textContent = t.unit; n.append(u);
      d.append(n);
    } else {
      const b = document.createElement("b"); b.textContent = t.b; d.append(b);
    }
    const s = document.createElement("span"); s.textContent = t.sub; d.append(s);
    bento.append(d);
  }

  /* staggered reveal, in reading order */
  const tiles = [...bento.children];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = tiles.indexOf(e.target);
    setTimeout(() => { e.target.classList.add("shown"); e.target.querySelector(".moons")?._centre(); },
      reduce ? 0 : (i % 4) * 55 + Math.floor(i / 4) * 40);
    io.unobserve(e.target);
  }), { threshold: .1, rootMargin: "0px 0px -6% 0px" });
  tiles.forEach(t => io.observe(t));
}

/* ==========================================================================
   4 — the reports.  Rest a pointer on a cover and the book opens where it
   stands: the board swings back, the first page turns. Move to another book
   and this one closes again. On a touchscreen, a tap does the same.
   ========================================================================== */
{
  const shelf = $("shelf"), dots = [...$("shelfDots").children];
  shelf.addEventListener("scroll", () => {
    const i = Math.round(shelf.scrollLeft / (shelf.scrollWidth / dots.length));
    dots.forEach((d, k) => d.classList.toggle("on", k === Math.min(dots.length - 1, i)));
  }, { passive: true });

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
    if (text != null) n.textContent = text; return n; };
  const row = (a, b) => { const d = document.createElement("div");
    d.append(el("b", null, a), el("span", null, b)); return d; };
  const contents = items => { const w = el("div", "rd-index");
    for (const [name, page] of items) w.append(row(name, String(page))); return w; };
  const chartPage = () => { const w = el("div", "rd-chart");
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); w.append(s);
    requestAnimationFrame(() => renderChart(s, SAMPLE, { assets:"assets" })); return w; };
  const dashaPage = () => { const w = el("div", "rd-rows");
    for (const m of SAMPLE.dasha.mahadashas.slice(0, 8)) w.append(row(m.lord, `${m.start.slice(0,4)} – ${m.end.slice(0,4)}`));
    return w; };
  const kootaPage = () => {
    const moonA = SAMPLE.planets.find(p => p.graha === "Moon").lon;
    const k = ashtakoota({ moonL: moonA }, { moonL: (moonA + 137.5) % 360 });
    const w = el("div", "rd-rows");
    for (const it of k.kootas) w.append(row(it.name, `${it.got} / ${it.max}`));
    w.append(row("Total", `${k.total} / 36`));
    return w;
  };

  const planetPage = () => { const w = el("div", "rd-rows");
    for (const p of SAMPLE.planets) w.append(row(p.graha, `${p.signName} · ${ORDS(p.house)} house`));
    return w; };
  const housePage = () => { const w = el("div", "rd-rows");
    for (const h of SAMPLE.houses.slice(0, 8)) w.append(row(`${ORDS(h.house)} house`, `${h.signName} · ${h.lord}`));
    return w; };
  const ORDS = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
  const page = (tag, title, body) => () => { const w = el("div", "rd-page");
    w.append(el("p", "rd-tag", tag), el("p", "rd-title", title), body()); return w; };
  const title = name => () => { const w = el("div", "rd-tp");
    w.append(el("b", null, "Astra"), el("p", null, name), el("span", null, "Prepared for Aarav · 9 May 2007 · Mumbai")); return w; };
  const last = () => { const w = el("div", "rd-last");
    w.append(el("b", null, "The rest is yours to read."), el("span", null, "Every page is computed from the birth details, then written in plain language."));
    const a = el("a", "btn", "Get my free Kundali"); a.href = "#free"; w.append(a); return w; };

  /* the pages under each cover: contents, then real pages, computed */
  const BOOKS = {
    essential: { name: "Essential Vedic Kundali", sheets: [
      { name: ["Contents", "The birth chart"], front: page("Contents", "Essential Vedic Kundali", () => contents([["Your birth details", 3], ["The birth chart", 4],
          ["Ascendant & Moon", 5], ["The nine grahas", 6], ["House by house", 8], ["Vimshottari dasha", 13], ["Glossary", 16]])),
        back: page("Page 4", "The birth chart", chartPage) },
      { name: ["The nine grahas", "House by house"], front: page("Page 6", "The nine grahas", planetPage), back: page("Page 8", "House by house", housePage) } ] },
    complete: { name: "The Complete Vedic Kundali", sheets: [
      { name: ["Contents", "The chart, read whole"], front: page("Contents", "The Complete Vedic Kundali", () => contents([["The chart, read whole", 4], ["Every graha in turn", 9],
          ["The twelve houses", 21], ["Yogas in your chart", 34], ["The dasha years ahead", 41], ["Remedies", 57], ["Glossary", 62]])),
        back: page("Page 4", "The chart, read whole", chartPage) },
      { name: ["Every graha in turn", "The dasha years ahead"], front: page("Page 9", "Every graha in turn", planetPage), back: page("Page 41", "The dasha years ahead", dashaPage) } ] },
    milan: { name: "Vedic Kundali Milan", sheets: [
      { name: ["Contents", "Both charts"], front: page("Contents", "Vedic Kundali Milan", () => contents([["Both charts, side by side", 4], ["The eight kootas", 7],
          ["Gun Milan score", 12], ["Manglik, read carefully", 15], ["Where you differ", 19], ["Guidance", 24]])),
        back: page("Page 4", "Both charts, side by side", chartPage) },
      { name: ["The eight kootas", "Gun Milan score"], front: page("Page 7", "The eight kootas", kootaPage), back: page("Page 12", "Gun Milan score", kootaPage) } ] }
  };

  const touch = matchMedia("(hover: none)").matches;
  document.querySelectorAll(".book").forEach(book => {
    const img = book.querySelector(".cover img");
    const spec = BOOKS[book.dataset.report];
    mountBook(book, { cover: img, touch, title: title(spec.name), sheets: spec.sheets, base: last });
  });
}

/* ==========================================================================
   4b — the free Kundali, on this page
   ========================================================================== */
freeKundali($("free"), SAMPLE);

/* ==========================================================================
   5 — the close, and the page's small manners
   ========================================================================== */
$("wlForm").addEventListener("submit", e => {
  e.preventDefault();
  $("wlStatus").textContent = "Preview build: the waitlist is connected before the site goes live. Nothing was sent.";
});
$("contactForm").addEventListener("submit", e => {
  e.preventDefault();
  $("cfStatus").textContent = "Preview build: messages are connected before launch. Nothing was sent.";
});
{
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -5% 0px" });
  document.querySelectorAll("[data-in]").forEach(el => io.observe(el));
}
/* the nav's two small sheets, and the phone's menu */
{
  const pop = $("navPop"), menu = $("menu"), burger = $("burger");
  const STORE = `<div class="store-row">${document.querySelector(".menu .store-row").innerHTML}</div>`;
  const SHEETS = {
    get: `<b>Astra is coming to iPhone and Android.</b><p>Both stores on launch day. Until then, the free Kundali is sent by email, and it will be waiting in the app when you sign in with the same address.</p>${STORE}`
  };
  let openKey = null;
  const closePop = () => { pop.classList.remove("on"); openKey = null;
    setTimeout(() => { if (!openKey) pop.hidden = true; }, 250); };
  document.querySelectorAll("[data-pop]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const k = b.dataset.pop;
    if (openKey === k) return closePop();
    if (!menu.hidden) closeMenu();
    pop.innerHTML = SHEETS[k];           /* static strings written above, no user input */
    pop.hidden = false; openKey = k;
    requestAnimationFrame(() => pop.classList.add("on"));
  }));
  pop.addEventListener("click", e => e.stopPropagation());
  addEventListener("click", () => { if (openKey) closePop(); });

  const openMenu = () => { menu.hidden = false; burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden"; requestAnimationFrame(() => menu.classList.add("on")); };
  function closeMenu() { menu.classList.remove("on"); burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = ""; setTimeout(() => { if (!menu.classList.contains("on")) menu.hidden = true; }, 300); }
  burger.addEventListener("click", e => { e.stopPropagation(); menu.hidden ? openMenu() : closeMenu(); });
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));
  addEventListener("keydown", e => { if (e.key !== "Escape") return; if (openKey) closePop(); if (!menu.hidden) closeMenu(); });
}
{
  const nav = $("nav"), lights = [...document.querySelectorAll(".tour,.shelf-act,.close-act")];
  /* the bento is dark, so the nav must go back to its dark treatment over it */
  const f = () => { nav.classList.toggle("solid", scrollY > 50);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}
