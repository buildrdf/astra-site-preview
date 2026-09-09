/* ==========================================================================
   Astra — the four-section site.

     1  the sky: seven grahas on dotted orbits above a real Earth, then the chart
     2  the walkthrough: a top heading, a pure nav rail, one product stage
     3  the reports shelf, with a small flipping preview of the free Kundali
     4  the close

   The walkthrough carries the experience. Everything on its stage is either
   the app's real engine running live on this page, or — where that engine
   is not vendored here — a real screenshot of the running app, labelled as one.
   ========================================================================== */
import { SEAT, renderChart } from "./chart.js";
import { transitInto } from "./kundali.js";
import { dailyInsight, HOUSE_THEME } from "./insight.js";
import { asset } from "./asset.js";
import { dayRhythm, dashaStack, chartPanel, skyPanel, askPanel, matchPanel } from "./live.js";
import { guessPlace } from "./kundali.js";

const SAMPLE = await fetch("src/sample.json").then(r => r.json());
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
/* the seven classical grahas ride visible orbits; Rahu and Ketu are the Moon's
   nodes, not physical bodies, so they carry no ring — they still take their
   real place in the finished chart, arriving without one */
const CLASSICAL = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const NODES = ["Rahu", "Ketu"];
const GRAHAS = [...CLASSICAL, ...NODES];
const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const clamp = (v,a=0,b=1) => v<a?a:v>b?b:v;
const smooth = v => { const x = clamp(v); return x*x*(3-2*x); };
const glide = v => { const x = clamp(v); return x<.5 ? 4*x**3 : 1-(-2*x+2)**3/2; };
const lerp = (a,b,k) => a+(b-a)*k;

const INSIGHT = dailyInsight(transitInto(new Date(), SAMPLE.lagna.sign), SAMPLE.planets);
const FOCUS = INSIGHT ? INSIGHT.house : 10;

/* ==========================================================================
   1 — the pinned hero: orbits above a real Earth, then the chart
   ========================================================================== */
{
  const view = document.querySelector(".hero-view");
  const hero = $("hero"), earth = document.querySelector(".earth");
  const box = document.querySelector(".hero-chart"), svg = $("heroChart"), layer = $("heroBodies");
  const orbitsSvg = $("orbits");
  const beats = [...document.querySelectorAll(".hero-say .beat")];
  const SIZE = { Sun:1.16, Moon:1, Mars:1, Mercury:.97, Jupiter:1.12, Venus:1, Saturn:1.24, Rahu:1.05, Ketu:1.05 };

  renderChart(svg, SAMPLE, { assets:"assets" });
  svg.querySelectorAll(".k-planet").forEach(p => p.remove());
  const lines = [...svg.querySelectorAll(".k-line")];
  const signs = [...svg.querySelectorAll(".k-sign,.k-asc")];
  for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;
  for (const s2 of signs) s2.style.opacity = 0;

  const el2 = {};
  for (const g of GRAHAS) {
    const d = document.createElement("div"); d.className = "body";
    const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
    d.append(im); layer.append(d); el2[g] = d;
  }

  /* Each classical graha rides its own elliptical ring, centred just below the
     frame — the same "orrery" geometry an armillary sphere uses. Rings are
     nested by index so the seven read as a family of orbits, not a scatter. */
  const RING = { Moon:0, Mercury:1, Venus:2, Sun:3, Mars:4, Jupiter:5, Saturn:6 };
  const ANGLE = { Moon:250, Mercury:205, Venus:315, Sun:275, Mars:230, Jupiter:340, Saturn:290 };
  /* the nodes hang independently, low in the frame, with no ring of their own */
  const NODE_POS = { Rahu: { x: 10, y: 30 }, Ketu: { x: 90, y: 26 } };

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

    ocx = W / 2; ocy = H * 1.05;
    ringRY = i => H * (.30 + i * .038);
    ringRX = i => Math.min(ringRY(i) * 2.3, W * .48);

    orbitsSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    orbitsSvg.innerHTML = "";
    for (const g of CLASSICAL) {
      const i = RING[g];
      const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      e.setAttribute("cx", ocx); e.setAttribute("cy", ocy);
      e.setAttribute("rx", ringRX(i).toFixed(1)); e.setAttribute("ry", ringRY(i).toFixed(1));
      orbitsSvg.append(e);
    }
  }

  let t = 0, target = 0, raf = 0, drift = 0, last = 0, shown = -1;
  let px = 0, py = 0;                                  /* pointer parallax, eased */
  let tpx = 0, tpy = 0;

  function skyPos(g) {
    if (NODES.includes(g)) {
      const n = NODE_POS[g];
      return [W * (n.x / 100) + px * 20, H * (n.y / 100) + py * 14];
    }
    const i = RING[g];
    const speed = 1 / (1 + i * .32);
    const a = (ANGLE[g] + (drift * .3 + t * 24) * speed) * Math.PI / 180;
    const rx = ringRX(i), ry = ringRY(i);
    const depth = .4 + i * .12;
    return [ocx + rx * Math.cos(a) + px * depth * 26, ocy + ry * Math.sin(a) + py * depth * 18];
  }

  function frame() {
    const goneEarth = smooth((t - .22) / .24);
    earth.style.opacity = (1 - goneEarth * .55).toFixed(3);
    earth.style.transform = `translate(-50%,${(goneEarth * 16).toFixed(1)}%) scale(${(1 + goneEarth * .06).toFixed(3)})`;
    orbitsSvg.style.opacity = (1 - smooth((t - .18) / .2)).toFixed(3);

    const drawn = smooth((t - .24) / .26);
    for (const l of lines) l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
    for (const s2 of signs) s2.style.opacity = smooth((t - .74) / .14).toFixed(3);

    GRAHAS.forEach((g, i) => {
      const [ox, oy] = skyPos(g);
      const seat = seatOf[g] ?? [50,50];
      const sxp = bx + seat[0] / 100 * S, syp = by + seat[1] / 100 * S;
      const k = glide((t - .26 - i * .026) / .30);
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
    /* the pointer's pull eases in, so the parallax feels weighted, not jumpy */
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
  if (reduce) { t = target = 1; frame(); earth.style.opacity = ".45"; orbitsSvg.style.display = "none"; }
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
   2 — the walkthrough
   ========================================================================== */
const HERE = guessPlace();

const FEATURES = [
  { id:"day", tab:"Your day", head:"A day that reads differently for you.",
    a:"The hours the tradition favours and the hours it cautions — computed for where you are, scrubbed across dates, with a verdict for the day.",
    live: host => dayRhythm(host, HERE, SAMPLE), note:"live · computed for your own place" },

  { id:"time", tab:"Your timeline", head:"Time contains time.",
    a:"A hundred and twenty years, one graha at a time. Open a period to see the periods inside it, or drag the line to move through them.",
    live: host => dashaStack(host, SAMPLE), note:"live · drag the line or press a period" },

  { id:"universe", tab:"Your universe", head:"Birth, today, and the sky above you.",
    a:"Your placements, today's sky over them, and a slider that carries the years between. Touch any planet and the chart answers.",
    live: host => chartPanel(host, SAMPLE),
    live2: host => skyPanel(host, HERE),
    note:"live · scrub the years, then drag the sky" },

  { id:"ask", tab:"Ask Astra", head:"Ask, and the chart answers.",
    a:"Every answer is assembled from the chart in front of you — your placements, today's transits — and names what it used.",
    live: host => askPanel(host, SAMPLE), note:"live · plays on a loop" },

  { id:"moment", tab:"Find your moment", head:"Some things are better begun at one hour than another.",
    a:"Muhurta for a marriage, a venture, a home, a journey. Astra reads the window you give it and shows its score with reasons.",
    shots:["assets/app/muhurta.png"], note:"a screenshot — this engine is not yet on the website" },

  { id:"you", tab:"You & your people", head:"How two charts meet.",
    a:"Add a partner's birth details and Astra reads the two charts together — every koota, and the reasons behind each one.",
    live: host => matchPanel(host, SAMPLE), note:"live · press calculate" }
];

{
  const nav = $("tourNav"), panel = $("panel"), tour = $("tour");
  tour.style.height = (FEATURES.length * 88 + 30) + "vh";

  const surfaces = [];
  FEATURES.forEach((f, i) => {
    const add = node => { node.dataset.f = i; node.dataset.j = surfaces.filter(s => s.f === i).length;
      node.classList.add("surface"); panel.append(node); surfaces.push({ f:i, node }); return node; };
    if (f.live)  { const h = document.createElement("div"); h.className = "livehost"; const n = add(h);
      const api = f.live(h); n.dataset.startable = api?.start ? "1" : ""; n._start = api?.start; }
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
      [...nav.children].forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
      const on = nav.children[i];
      if (on && nav.scrollWidth > nav.clientWidth + 4) {
        const want = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
        nav.scrollTo({ left: Math.max(0, want), behavior: reduce ? "auto" : "smooth" });
      }
      shown = i;
    }
    const mine = surfaces.filter(s => s.f === i);
    const n = mine.length;
    const j = Math.min(n - 1, Math.floor(sub * n));
    let darkOn = false;
    for (const s of surfaces) {
      const on = s.f === i && +s.node.dataset.j === j;
      s.node.classList.toggle("on", on);
      if (on) {
        darkOn = s.node.classList.contains("dark");
        if (s.node.dataset.startable && !s.node.dataset.started) {
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
   3 — the reports shelf, and a small flip-through of the free Kundali
   ========================================================================== */
{
  const shelf = $("shelf"), dots = [...$("shelfDots").children];
  shelf.addEventListener("scroll", () => {
    const i = Math.round(shelf.scrollLeft / (shelf.scrollWidth / dots.length));
    dots.forEach((d, k) => d.classList.toggle("on", k === Math.min(dots.length - 1, i)));
  }, { passive: true });
}
{
  /* three real pages from the free Kundali — an index, the actual computed
     chart, and the actual dasha ladder — turning on their own, then a lock
     screen: the report is sixteen pages, this preview is three of them. */
  const host = $("flipbook");
  const PAGES = [
    { tag: "01 · Contents", build: p => {
        p.className = "fp-page front";
        p.innerHTML = `<div class="fp-tag">Essential Vedic Kundali</div>
          <div class="fp-title">Contents</div>
          <div class="fp-index">
            <div><span>Your birth details</span><span>3</span></div>
            <div><span>The birth chart</span><span>4</span></div>
            <div><span>Ascendant &amp; Moon</span><span>5</span></div>
            <div><span>The nine grahas</span><span>6</span></div>
            <div><span>House by house</span><span>8</span></div>
            <div><span>Vimshottari dasha</span><span>13</span></div>
            <div><span>Glossary</span><span>16</span></div>
          </div>`; } },
    { tag: "04 · Birth chart", build: p => {
        p.innerHTML = `<div class="fp-tag">The birth chart</div>
          <div class="fp-title">${SAMPLE.moment.name}, ${SAMPLE.moment.local}</div>
          <div class="fp-chart"><svg id="fpChart"></svg></div>`;
        requestAnimationFrame(() => renderChart(p.querySelector("#fpChart"), SAMPLE, { assets:"assets" })); } },
    { tag: "13 · Vimshottari dasha", build: p => {
        p.innerHTML = `<div class="fp-tag">Vimshottari dasha</div>
          <div class="fp-title">Your nine mahadashas</div>
          <div class="fp-dash" id="fpDash"></div>`;
        const wrap = p.querySelector("#fpDash");
        for (const m of SAMPLE.dasha.mahadashas.slice(0, 6))
          wrap.insertAdjacentHTML("beforeend", `<div><b>${m.lord}</b><span>${m.start.slice(0,4)}–${m.end.slice(0,4)}</span></div>`);
        const lock = document.createElement("div"); lock.className = "fp-lock on";
        lock.innerHTML = `<b>16 pages in the full Kundali</b><span>This preview shows three.</span>`;
        p.append(lock); } }
  ];
  const nodes = PAGES.map((pg, i) => { const p = document.createElement("div");
    p.className = "fp-page" + (i === 0 ? " front" : " behind"); pg.build(p); host.append(p); return p; });
  let idx = 0;
  function cycle() {
    if (reduce) return;
    const cur = nodes[idx];
    cur.classList.add("turning");
    setTimeout(() => {
      cur.classList.remove("turning"); cur.classList.add("behind"); cur.classList.remove("front");
      idx = (idx + 1) % nodes.length;
      nodes[idx].classList.add("front"); nodes[idx].classList.remove("behind");
      host.append(nodes[idx]);
    }, 900);
  }
  if (!reduce) setInterval(cycle, 3600);
  host.insertAdjacentHTML("afterend", `<p class="fp-pages-total">Three pages of sixteen · <a href="index.html#free" style="color:inherit;text-decoration:underline">get the full Kundali free</a></p>`);
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
