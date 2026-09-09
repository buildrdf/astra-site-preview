/* ==========================================================================
   Astra — the four-section site.

     1  the introduction: a birth moment becomes a chart, and one interpretation
        says what the chart is FOR
     2  the walkthrough: six features, one product stage, real app screens
     3  the reports shelf
     4  the close

   The walkthrough carries the experience. Every screen on its stage is a real
   screenshot of the running app in its own sample mode — not a mockup, not a
   drawing of a mockup.
   ========================================================================== */
import { SEAT, renderChart } from "./chart.js";
import { transitInto } from "./kundali.js";
import { dailyInsight, HOUSE_THEME } from "./insight.js";
import { asset } from "./asset.js";
import { dayRhythm, dashaStack, chartPanel, skyPanel, askPanel } from "./live.js";
import { guessPlace } from "./kundali.js";

const SAMPLE = await fetch("src/sample.json").then(r => r.json());
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GRAHAS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const clamp = (v,a=0,b=1) => v<a?a:v>b?b:v;
const smooth = v => { const x = clamp(v); return x*x*(3-2*x); };
const glide = v => { const x = clamp(v); return x<.5 ? 4*x**3 : 1-(-2*x+2)**3/2; };
const lerp = (a,b,k) => a+(b-a)*k;

/* ==========================================================================
   1 — the introduction
   ========================================================================== */
const INSIGHT = dailyInsight(transitInto(new Date(), SAMPLE.lagna.sign), SAMPLE.planets);
const FOCUS = INSIGHT ? INSIGHT.house : 10;

/* ==========================================================================
   1 — the pinned hero: nine grahas in the sky, then in the chart
   ========================================================================== */
{
  const view = document.querySelector(".hero-view");
  const hero = $("hero"), earth = document.querySelector(".earth");
  const box = document.querySelector(".hero-chart"), svg = $("heroChart"), layer = $("heroBodies");
  const beats = [...document.querySelectorAll(".hero-say .beat")];
  const GR = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
  const SIZE = { Sun:1.16, Moon:1, Mars:1, Mercury:.97, Jupiter:1.12, Venus:1, Saturn:1.24, Rahu:1.05, Ketu:1.05 };

  renderChart(svg, SAMPLE, { assets:"assets" });
  svg.querySelectorAll(".k-planet").forEach(p => p.remove());
  const lines = [...svg.querySelectorAll(".k-line")];
  const signs = [...svg.querySelectorAll(".k-sign,.k-asc")];
  for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;
  for (const s2 of signs) s2.style.opacity = 0;

  const el2 = {};
  for (const g of GR) {
    const d = document.createElement("div"); d.className = "body";
    const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
    d.append(im); layer.append(d); el2[g] = d;
  }
  /* where each graha hangs in the sky before it comes down: fixed angles, so the
     opening frame is the same every time, spread across the dark upper half */
  const SKY = GR.map((g, i) => ({ g, x: 7 + i * 10.8 + (i % 2 ? 3 : -3), y: 34 + (i % 3) * 12 + (i % 2 ? 4 : 0) }));
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
  function measure() {
    W = view.clientWidth; H = view.clientHeight;
    const r = box.getBoundingClientRect(), v = view.getBoundingClientRect();
    S = r.width; bx = r.left - v.left; by = r.top - v.top;
    disc = Math.max(30, Math.min(W, H) * .062);
    for (const l of lines) l.dataset.px = l.dataset.len * (S / 104);
  }

  let t = 0, target = 0, raf = 0, drift = 0, last = 0, shown = -1;
  let px = 0, py = 0;                                  /* pointer parallax */

  function frame() {
    const gone = smooth((t - .22) / .24);
    earth.style.opacity = (1 - gone * .55).toFixed(3);
    earth.style.transform = `translate(-50%,${(gone * 16).toFixed(1)}%) scale(${(1 + gone * .06).toFixed(3)})`;

    const drawn = smooth((t - .24) / .26);
    for (const l of lines) l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
    for (const s2 of signs) s2.style.opacity = smooth((t - .74) / .14).toFixed(3);

    GR.forEach((g, i) => {
      const sky = SKY[i];
      /* in the sky: a slow drift, and a little parallax under the pointer */
      const depth = .5 + (i % 3) * .3;
      const ox = W * (sky.x / 100) + Math.sin((drift + i * 40) / 60) * 7 + px * depth * 16;
      const oy = H * (sky.y / 100) + Math.cos((drift + i * 55) / 70) * 5 + py * depth * 12;
      const seat = seatOf[g] ?? [50,50];
      const sxp = bx + seat[0] / 100 * S, syp = by + seat[1] / 100 * S;
      const k = glide((t - .26 - i * .028) / .30);
      const dx = sxp - ox, dy = syp - oy, len = Math.hypot(dx, dy) || 1;
      const bulge = Math.sin(k * Math.PI) * len * .12 * (i % 2 ? -1 : 1);
      const x = lerp(ox, sxp, k) + (-dy / len) * bulge;
      const y = lerp(oy, syp, k) + (dx / len) * bulge;
      const size = disc * SIZE[g] * lerp(1, .40, k);
      const e = el2[g];
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
    frame();
    raf = Math.abs(d) > .0004 || t < .26 ? requestAnimationFrame(tick) : (last = 0);
  }
  function onScroll() {
    const span = (hero.offsetHeight - view.clientHeight) * .88;
    target = clamp(span > 0 ? -hero.getBoundingClientRect().top / span : 0);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  measure();
  for (const l of lines) { l.style.strokeDasharray = l.dataset.px; l.style.strokeDashoffset = l.dataset.px; }
  if (reduce) { t = target = 1; frame(); earth.style.opacity = ".45"; }
  else {
    onScroll();
    addEventListener("scroll", onScroll, { passive:true });
    addEventListener("resize", () => { measure(); frame(); }, { passive:true });
    if (!matchMedia("(pointer: coarse)").matches)
      view.addEventListener("pointermove", e => {
        const r = view.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5;
        if (!raf) raf = requestAnimationFrame(tick);
      });
  }

  $("stamp").textContent = `Example chart · ${SAMPLE.moment.local}, ${SAMPLE.moment.name}`;
}

/* ==========================================================================
   2 — the walkthrough
   ========================================================================== */
const HERE = guessPlace();

/* A feature either MOUNTS a live element — the app's own thing rebuilt here, so it
   can be pressed, opened and dragged — or, where its engine is not on this page,
   shows a real screenshot of the running app and says which it is. */
const FEATURES = [
  { id:"day", tab:"Your day", head:"A day that reads differently for you.",
    a:"The hours the tradition favours and the hours it cautions, computed for where you are, with the Moon's real phase tonight.",
    b:"Press either window and it explains itself.",
    live: host => dayRhythm(host, HERE), note:"live · computed for your own place" },

  { id:"time", tab:"Your timeline", head:"Time contains time.",
    a:"A hundred and twenty years handed to one graha at a time. Open a period and the periods inside it appear; open one of those and you are three levels down.",
    b:"Mahadasha, antardasha, pratyantardasha — all from the Moon's exact place at birth.",
    live: host => dashaStack(host, SAMPLE), note:"live · press a period to open it" },

  { id:"universe", tab:"Your universe", head:"Birth, today, and the sky above you.",
    a:"Switch between the sky you were born under and the one overhead now. Touch any planet and the chart answers.",
    b:"Then look up: the same sky over your city, with the twenty-seven nakshatras, and you can drag it.",
    live: host => chartPanel(host, SAMPLE),
    live2: host => skyPanel(host, HERE),
    note:"live · touch a planet, then drag the sky" },

  { id:"ask", tab:"Ask Astra", head:"Ask, and the chart answers.",
    a:"Every answer is assembled from the chart on this page — your real placements, today's transits — and names what it used.",
    b:"In the app the same thing happens by voice, with the Moon listening and a live transcript.",
    live: host => askPanel(host, SAMPLE),
    shots:["assets/app/voice.png"], note:"live · pick a question" },

  { id:"moment", tab:"Find your moment", head:"Some things are better begun at one hour than another.",
    a:"Muhurta for a marriage, a venture, a home, a journey. Astra reads the window you give it and shows its score with reasons.",
    b:"For a birth it scores only inside the window your doctor has already set. That decision is never the app's.",
    shots:["assets/app/muhurta.png"], note:"a screenshot — this engine is not on the website" },

  { id:"you", tab:"You & your people", head:"Your details, and the people they connect to.",
    a:"One birth profile unlocks the depth: the full Kundali, your reports, and the periods that shaped your years.",
    b:"Add someone else and read the two charts together.",
    shots:["assets/app/you.png"], note:"a screenshot of the app" }
];

{
  const nav = $("tourNav"), panel = $("panel"), tour = $("tour");
  /* one screen-height of travel per feature, plus a little to settle */
  tour.style.height = (FEATURES.length * 88 + 30) + "vh";

  /* every surface is built once and kept — a live element must not lose the
     period you opened just because you scrolled past and came back */
  const surfaces = [];                       /* [{f, j, node, dark, wide, start}] */
  FEATURES.forEach((f, i) => {
    const add = node => { node.dataset.f = i; node.dataset.j = surfaces.filter(s => s.f === i).length;
      node.classList.add("surface"); panel.append(node); surfaces.push({ f:i, node }); return node; };
    if (f.live)  { const h = document.createElement("div"); h.className = "livehost"; add(h); f.live(h); }
    if (f.live2) { const h = document.createElement("div"); h.className = "livehost dark"; const n = add(h);
      const api = f.live2(h); n.dataset.startable = "1"; n._start = api?.start; }
    (f.shots || []).forEach(src => {
      const im = new Image(); im.src = src; im.alt = ""; im.loading = i < 2 ? "eager" : "lazy";
      im.classList.add("shot"); add(im);
    });
  });

  FEATURES.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = f.tab; b.setAttribute("role", "tab");
    b.setAttribute("aria-current", i === 0 ? "true" : "false");
    b.onclick = () => {
      /* the reader maps scroll to feature over the SCROLLABLE span, not the
         section's full height — using the wrong one landed a tab click one
         feature late every time */
      const span = tour.offsetHeight - innerHeight;
      const top = tour.offsetTop + ((i + .35) / FEATURES.length) * span;
      scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    };
    nav.append(b);
  });

  let shown = -1;
  function show(i, sub) {
    const f = FEATURES[i];
    if (i !== shown) {
      $("tourHead").textContent = f.head;
      $("tourLine1").textContent = f.a;
      $("tourLine2").textContent = f.b;
      $("stageNote").textContent = f.note;
      [...nav.children].forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
      /* on a phone the list is a horizontal rail: keep the active label in view,
         or the reader loses track of where they are in the tour */
      const on = nav.children[i];
      if (on && nav.scrollWidth > nav.clientWidth + 4) {
        const want = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, want), behavior: reduce ? "auto" : "smooth" });
      }
      shown = i;
    }
    /* a feature's surfaces are spread across its own stretch of scroll */
    const mine = surfaces.filter(s => s.f === i);
    const n = mine.length;
    const j = Math.min(n - 1, Math.floor(sub * n));
    let darkOn = false;
    for (const s of surfaces) {
      const on = s.f === i && +s.node.dataset.j === j;
      s.node.classList.toggle("on", on);
      if (on) {
        darkOn = s.node.classList.contains("dark");
        if (on && s.node.dataset.startable && !s.node.dataset.started) {
          s.node.dataset.started = "1"; s.node._start?.();
        }
      }
    }
    panel.classList.toggle("is-dark", darkOn);
    panel.classList.remove("is-wide");
  }

  function onScroll() {
    const r = tour.getBoundingClientRect();
    const span = tour.offsetHeight - innerHeight;
    const t = clamp(span > 0 ? -r.top / span : 0);
    const raw = t * FEATURES.length;
    show(Math.min(FEATURES.length - 1, Math.floor(raw)), raw % 1);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  show(0, 0); onScroll();
}

/* ==========================================================================
   3 — the shelf: the relationship cover uses two real charts
   ========================================================================== */
{
  /* the Milan cover is the real one now, so nothing is drawn here — only the
     dots that follow the swipe on a phone */
  const shelf = $("shelf"), dots = [...$("shelfDots").children];
  shelf.addEventListener("scroll", () => {
    const i = Math.round(shelf.scrollLeft / (shelf.scrollWidth / dots.length));
    dots.forEach((d, k) => d.classList.toggle("on", k === Math.min(dots.length - 1, i)));
  }, { passive: true });
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
  const nav = $("nav"), lights = [...document.querySelectorAll(".tour,.shelf-act")];
  const f = () => { nav.classList.toggle("solid", scrollY > 50);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}
