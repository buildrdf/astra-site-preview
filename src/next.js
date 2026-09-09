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

{
  const svg = $("introChart"), box = $("introBox"), layer = $("introBodies");
  renderChart(svg, SAMPLE, { assets: "assets" });
  svg.querySelectorAll(".k-planet").forEach(p => p.remove());
  const lines = [...svg.querySelectorAll(".k-line")];
  const signs = [...svg.querySelectorAll(".k-sign,.k-asc")];
  const cell = svg.querySelector(`.k-cell[data-house="${FOCUS}"]`);
  for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;

  const el = {};
  for (const g of GRAHAS) {
    const d = document.createElement("div"); d.className = "body";
    const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
    d.append(im); layer.append(d); el[g] = d;
  }
  const SIZE = { Sun:1.14, Moon:1, Mars:1, Mercury:.97, Jupiter:1.1, Venus:1, Saturn:1.22, Rahu:1.04, Ketu:1.04 };
  const seatOf = {};
  for (const p of SAMPLE.planets) {
    const share = SAMPLE.planets.filter(q => q.house === p.house);
    const i = share.indexOf(p), n = share.length;
    const [sx, sy] = SEAT[p.house];
    const off = n > 1 ? (i - (n-1)/2) * (n > 2 ? 7 : 8.5) : 0;
    const along = p.house % 3 === 1 ? [1,0] : [.72,.69];
    seatOf[p.graha] = [sx + along[0]*off, sy + along[1]*off*(p.house > 6 ? -1 : 1)];
  }

  let S = 0, disc = 0;
  const measure = () => { S = box.clientWidth; disc = Math.max(24, S * .115);
    for (const l of lines) l.dataset.px = l.dataset.len * (S / 104); };

  /* one short sequence, on a timer rather than on scroll: this is the first
     frame of the site and must never wait for a gesture */
  let t0 = 0;
  function frame(now) {
    if (!t0) t0 = now;
    const t = reduce ? 1 : clamp((now - t0) / 2600);
    const drawn = smooth(t / .45);
    for (const l of lines) l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
    for (const s of signs) s.style.opacity = smooth((t - .45) / .18).toFixed(3);
    GRAHAS.forEach((g, i) => {
      const k = glide((t - .18 - i * .045) / .3);
      const [tx, ty] = seatOf[g] ?? [50,50];
      /* they come in from just outside the frame, each on its own line */
      const a = (i * 40 + 200) * Math.PI / 180;
      const ox = 50 + Math.cos(a) * 96, oy = 50 + Math.sin(a) * 96;
      const x = lerp(ox, tx, k) / 100 * S, y = lerp(oy, ty, k) / 100 * S;
      const size = disc * SIZE[g] * lerp(1.5, 1, k);
      const e = el[g];
      e.style.width = e.style.height = size.toFixed(1) + "px";
      e.style.transform = `translate(${(x - size/2).toFixed(1)}px,${(y - size/2).toFixed(1)}px)`;
      e.classList.toggle("in", k > .02);
    });
    if (cell) cell.classList.toggle("lit", t > .82);
    if (t < 1) requestAnimationFrame(frame);
  }
  measure();
  for (const l of lines) { l.style.strokeDasharray = l.dataset.px; l.style.strokeDashoffset = l.dataset.px; }
  for (const s of signs) s.style.opacity = 0;
  addEventListener("resize", () => { measure(); }, { passive: true });
  requestAnimationFrame(frame);

  $("stamp").textContent = `Example chart · ${SAMPLE.moment.local} ${SAMPLE.moment.tz} · ${SAMPLE.moment.name}`;
  if (INSIGHT) {
    $("sayHead").textContent = `What a chart is for`;
    $("sayBody").textContent = `${INSIGHT.line} That sentence came from three facts about this chart, and Astra will show you all three.`;
  }
}

/* ==========================================================================
   2 — the walkthrough
   ========================================================================== */
const FEATURES = [
  { id:"day", tab:"Your day", head:"A day that reads differently for you.",
    a:"Your horoscope, the life areas it touches, the panchang beneath it, and the hours the tradition favours or cautions.",
    b:"Guidance first. The working that produced it, second.",
    shots:["assets/app/app-today-horoscope.png","assets/app/app-today-panchang.png"],
    note:"Today · horoscope and panchang" },
  { id:"time", tab:"Your timeline", head:"Time contains time.",
    a:"Mahadasha, antardasha and pratyantardasha, each opening into the next, with Sade Sati shown as an overlay rather than an alarm.",
    b:"Your own life events sit on the same line.",
    shots:["assets/app/app-timeline.png"], note:"Timeline · three nested periods" },
  { id:"universe", tab:"Your universe", head:"Birth, today, and the sky above you.",
    a:"Switch the chart between the sky you were born under and the one overhead now. Touch a planet to open it.",
    b:"Then find that same planet in tonight's sky, drawn with the twenty-seven nakshatras.",
    shots:["assets/app/app-universe.png","assets/app/app-sky.png"],
    note:"Universe · chart, then the sky" },
  { id:"ask", tab:"Ask Astra", head:"Ask, and the chart answers.",
    a:"A question about your own chart, answered from your real placements and your current period, with the entities it used attached.",
    b:"By text, or by voice with a live transcript.",
    shots:["assets/app/app-guide.png"], note:"Guide · an answer with its sources" },
  { id:"moment", tab:"Find your moment", head:"Some things are better begun at one hour than another.",
    a:"Muhurta for a marriage, a venture, a home, a journey. Astra reads the window you give it and explains the score.",
    b:"For a birth it scores only inside the window your doctor has already set. That decision is never the app's.",
    shots:["assets/app/app-muhurta.png"], note:"Find a good time · what it is for" },
  { id:"you", tab:"You & your people", head:"Your details, and the people they connect to.",
    a:"One birth profile unlocks the depth: the full Kundali, your reports, and the periods that shaped your years.",
    b:"Add someone else and read the two charts together.",
    shots:["assets/app/app-you.png"], note:"You · profile and people" }
];

{
  const nav = $("tourNav"), phone = $("phone"), tour = $("tour");
  /* one screen-height of travel per feature, plus a little to settle */
  tour.style.height = (FEATURES.length * 88 + 30) + "vh";

  /* every screenshot exists from the start; only opacity changes */
  const imgs = [];
  FEATURES.forEach((f, i) => {
    f.shots.forEach((src, j) => {
      const im = new Image();
      im.src = src; im.alt = ""; im.loading = i < 2 ? "eager" : "lazy";
      im.dataset.f = i; im.dataset.j = j;
      phone.append(im); imgs.push(im);
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
    /* a feature with two screens shows its second one in its later half */
    const j = f.shots.length > 1 && sub > .55 ? 1 : 0;
    for (const im of imgs) im.classList.toggle("on", +im.dataset.f === i && +im.dataset.j === j);
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
  const a = $("pairA"), b = $("pairB");
  renderChart(a, SAMPLE, { assets:"assets", size:"small" }); a.classList.add("on-paper");
  const second = { ...SAMPLE, planets: transitInto(new Date(+new Date(SAMPLE.moment.iso) + 864e5 * 4000), SAMPLE.lagna.sign) };
  renderChart(b, second, { assets:"assets", size:"small" }); b.classList.add("on-paper");

  /* the dots follow the swipe on a phone */
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
  const nav = $("nav"), lights = [...document.querySelectorAll(".shelf-act")];
  const f = () => { nav.classList.toggle("solid", scrollY > 50);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}
