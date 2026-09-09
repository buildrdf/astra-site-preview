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
import { dayPanel, timelinePanel, universePanel, askPanel, muhurtaPanel, matchPanel } from "./live.js";

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

  /* The seven that are bodies ride shallow dotted orbits over the limb. Rahu and
     Ketu are the Moon's two nodes — points where its path crosses the Sun's, with
     nothing there to see — so they carry no orbit and begin outside the frame
     entirely, arriving only when the chart calls for them. */
  const RING  = { Moon:0, Mercury:1, Venus:2, Sun:3, Mars:4, Jupiter:5, Saturn:6 };
  /* spread right across the frame, not bunched over the horizon */
  const ANGLE = { Moon:250, Mercury:233, Venus:299, Sun:266, Mars:243, Jupiter:320, Saturn:286 };
  const FROM_OUTSIDE = { Rahu:{ x:-.22, y:.22 }, Ketu:{ x:1.22, y:.16 } };

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
    for (const l of lines) l.dataset.px = l.dataset.len * (S / 104);

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
    if (NODES.includes(g)) {
      const n = FROM_OUTSIDE[g];
      return [W * n.x + px * 24, H * n.y + py * 16];
    }
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
      const [ox, oy] = skyPos(g);
      const seat = seatOf[g] ?? [50,50];
      const sxp = bx + seat[0] / 100 * S, syp = by + seat[1] / 100 * S;
      /* the nodes come in late, from off-frame */
      const delay = NODES.includes(g) ? .40 : .26 + i * .026;
      const k = glide((t - delay) / .30);
      const dx = sxp - ox, dy = syp - oy, len = Math.hypot(dx, dy) || 1;
      const bulge = Math.sin(k * Math.PI) * len * .12 * (i % 2 ? -1 : 1);
      const x = lerp(ox, sxp, k) + (-dy / len) * bulge;
      const y = lerp(oy, syp, k) + (dx / len) * bulge;
      const size = disc * SIZE[g] * lerp(1, .40, k);
      const e = el[g];
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

  $("stamp").textContent = `Example chart · ${SAMPLE.moment.local}, ${SAMPLE.moment.name}`;
}

/* ==========================================================================
   2 — the walkthrough.  The heading carries the words; the stage carries the
   thing itself, and never scrolls.
   ========================================================================== */
const HERE = guessPlace();

/* One label, one short headline, one line. Anything longer and nobody reads it —
   the detail belongs on the screen itself, where it is computed. */
const FEATURES = [
  { id:"day", tab:"Your day", eyebrow:"Today",
    head:"Your day has a shape.",
    a:"The hours tradition favours, and the ones it sets aside. Drag across any of them.",
    live: h => dayPanel(h, HERE, SAMPLE) },

  { id:"time", tab:"Your timeline", eyebrow:"Timeline",
    head:"Time contains time.",
    a:"A hundred and twenty years, three periods deep. Drag the band.",
    live: h => timelinePanel(h, SAMPLE) },

  { id:"universe", tab:"Your universe", eyebrow:"Universe",
    head:"Your chart. Your sky.",
    a:"Touch any graha and the chart answers. Then go outside and drag the real one.",
    live: h => universePanel(h, SAMPLE, HERE) },

  { id:"ask", tab:"Ask Astra", eyebrow:"Ask",
    head:"Ask your chart.",
    a:"Every answer is built from it — and names exactly what it used.",
    live: h => askPanel(h, SAMPLE) },

  { id:"moment", tab:"Find your moment", eyebrow:"Muhurta",
    head:"Begin at the right hour.",
    a:"Thousands of windows scored in milliseconds, each with its reasons.",
    live: h => muhurtaPanel(h, HERE) },

  { id:"match", tab:"Relationship compatibility", eyebrow:"Compatibility",
    head:"How two charts meet.",
    a:"Eight kootas. Thirty-six points. Every one of them explained.",
    live: h => matchPanel(h, SAMPLE) }
];

{
  const nav = $("tourNav"), panel = $("panel"), tour = $("tour"), say = document.querySelector(".tour-say");
  tour.style.height = (FEATURES.length * 92 + 30) + "vh";

  FEATURES.forEach((f, i) => {
    const host = document.createElement("div");
    host.className = "livehost surface"; host.dataset.f = i;
    panel.append(host);
    const api = f.live(host);
    host._start = api?.start; host._stop = api?.stop;
  });
  const surfaces = [...panel.children];

  FEATURES.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = f.tab; b.setAttribute("role", "tab");
    b.setAttribute("aria-current", i === 0 ? "true" : "false");
    b.onclick = () => {
      const span = tour.offsetHeight - innerHeight;
      const top = tour.offsetTop + ((i + .35) / FEATURES.length) * span;
      scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    };
    nav.append(b);
  });

  let shown = -1, swapTimer = 0;
  function show(i) {
    if (i === shown) return;
    const f = FEATURES[i];
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
    surfaces.forEach((s, k) => {
      const isOn = k === i;
      s.classList.toggle("on", isOn);
      if (isOn && !s.dataset.started) { s.dataset.started = "1"; s._start?.(); }
      if (!isOn && s.dataset.started) s._stop?.();
      else if (isOn && s.dataset.started) s._start?.();
    });
    shown = i;
  }

  function onScroll() {
    const span = tour.offsetHeight - innerHeight;
    const t = clamp(span > 0 ? -tour.getBoundingClientRect().top / span : 0);
    show(Math.min(FEATURES.length - 1, Math.floor(t * FEATURES.length)));
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  show(0); onScroll();
}

/* ==========================================================================
   3 — the reports.  Press a cover and the book opens; the pages turn.
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
    for (const [name, page] of items) w.append(row(name, page)); return w; };

  const chartPage = () => { const w = el("div", "rd-chart");
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); w.append(s);
    requestAnimationFrame(() => renderChart(s, SAMPLE, { assets:"assets" })); return w; };

  const dashaPage = () => { const w = el("div", "rd-rows");
    for (const m of SAMPLE.dasha.mahadashas.slice(0, 8))
      w.append(row(m.lord, `${m.start.slice(0,4)} – ${m.end.slice(0,4)}`));
    return w; };

  const kootaPage = () => {
    const moonA = SAMPLE.planets.find(p => p.graha === "Moon").lon;
    const k = ashtakoota({ moonL: moonA }, { moonL: (moonA + 137.5) % 360 });
    const w = el("div", "rd-rows");
    for (const it of k.kootas) w.append(row(it.name, `${it.got} / ${it.max}`));
    w.append(row("Total", `${k.total} / 36`));
    return w;
  };

  /* three real pages out of each report, then the honest lock */
  const REPORTS = {
    essential: { cover:"assets/covers/essential.png", pages:16, pages_: [
      { tag:"Contents", title:"Essential Vedic Kundali", body: () => contents([
        ["Your birth details", 3], ["The birth chart", 4], ["Ascendant & Moon", 5],
        ["The nine grahas", 6], ["House by house", 8], ["Vimshottari dasha", 13], ["Glossary", 16]]) },
      { tag:"Page 4", title:`${SAMPLE.moment.name}, ${SAMPLE.moment.local}`, body: chartPage },
      { tag:"Page 13", title:"Vimshottari dasha", body: dashaPage } ] },
    complete: { cover:"assets/covers/complete.png", pages:64, pages_: [
      { tag:"Contents", title:"The Complete Vedic Kundali", body: () => contents([
        ["The chart, read whole", 4], ["Every graha in turn", 9], ["The twelve houses", 21],
        ["Yogas in your chart", 34], ["The dasha years ahead", 41], ["Remedies", 57], ["Glossary", 62]]) },
      { tag:"Page 4", title:`${SAMPLE.moment.name}, ${SAMPLE.moment.local}`, body: chartPage },
      { tag:"Page 41", title:"The dasha years ahead", body: dashaPage } ] },
    milan: { cover:"assets/covers/milan.png", pages:28, pages_: [
      { tag:"Contents", title:"Vedic Kundali Milan", body: () => contents([
        ["Both charts, side by side", 4], ["The eight kootas", 7], ["Gun Milan score", 12],
        ["Manglik, read carefully", 15], ["Where you differ", 19], ["Guidance", 24]]) },
      { tag:"Page 7", title:"The eight kootas", body: kootaPage },
      { tag:"Page 12", title:"Gun Milan score", body: kootaPage } ] }
  };

  const reader = $("reader"), rdBook = $("rdBook"), rdCount = $("rdCount");
  const rdPrev = $("rdPrev"), rdNext = $("rdNext");
  let pages = [], at = 0, busy = false;

  function build(key) {
    const r = REPORTS[key];
    rdBook.replaceChildren();
    pages = [];
    /* the cover first, then the three real pages, then the lock */
    const sheets = [
      { cover: r.cover },
      ...r.pages_,
      { lock: r.pages }
    ];
    sheets.forEach((s, i) => {
      const p = el("div", "rd-page" + (s.cover ? " cover-page" : ""));
      p.style.zIndex = String(sheets.length - i);
      if (s.cover) { const im = new Image(); im.src = s.cover; im.alt = ""; p.append(im); }
      else if (s.lock) {
        const w = el("div", "rd-lock");
        w.append(el("b", null, `${s.lock} pages in the full report`),
                 el("span", null, "This preview shows three of them."));
        const a = el("a", null, "Get the free Kundali →"); a.href = "index.html#free"; w.append(a);
        p.append(w);
      } else {
        p.append(el("p", "rd-tag", s.tag), el("p", "rd-title", s.title), s.body());
      }
      rdBook.append(p); pages.push(p);
    });
    at = 0; count();
  }
  function count() {
    rdCount.textContent = `${Math.min(at + 1, pages.length)} of ${pages.length}`;
    rdPrev.disabled = at === 0; rdNext.disabled = at >= pages.length - 1;
  }
  function turn(dir) {
    if (busy) return;
    const i = dir > 0 ? at : at - 1;
    if (i < 0 || i >= pages.length - (dir > 0 ? 1 : 0)) return;
    busy = true;
    const p = pages[i];
    p.classList.add("turning");
    p.classList.toggle("turned", dir > 0);
    p.style.zIndex = String(dir > 0 ? i : pages.length - i);
    at += dir; count();
    setTimeout(() => { p.classList.remove("turning"); busy = false; }, reduce ? 10 : 840);
  }
  function open(key) {
    build(key);
    reader.hidden = false;
    requestAnimationFrame(() => reader.classList.add("on"));
    document.body.style.overflow = "hidden";
    $("rdClose").focus();
  }
  function close() {
    reader.classList.remove("on");
    document.body.style.overflow = "";
    setTimeout(() => { reader.hidden = true; }, reduce ? 10 : 380);
  }

  document.querySelectorAll(".book .cover").forEach(b =>
    b.addEventListener("click", () => open(b.closest(".book").dataset.report)));
  rdNext.onclick = () => turn(1);
  rdPrev.onclick = () => turn(-1);
  rdBook.addEventListener("click", () => turn(1));
  $("rdClose").onclick = close;
  reader.querySelector("[data-close]").addEventListener("click", close);
  addEventListener("keydown", e => {
    if (reader.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowLeft") turn(-1);
  });
}

/* ==========================================================================
   4 — the close, and the page's small manners
   ========================================================================== */
$("wlForm").addEventListener("submit", e => {
  e.preventDefault();
  $("wlStatus").textContent = "Preview build: the waitlist is connected before the site goes live. Nothing was sent.";
});
{
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -5% 0px" });
  document.querySelectorAll("[data-in]").forEach(el => io.observe(el));
}
{
  const nav = $("nav"), lights = [...document.querySelectorAll(".tour,.shelf-act,.close-act")];
  const f = () => { nav.classList.toggle("solid", scrollY > 50);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}
