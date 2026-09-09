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

{
  /* The hero shows the Earth the app itself draws — the sky view zoomed out to the
     zodiac ring. It is a picture, so it costs nothing and cannot fail to load a
     chart engine before the first frame. The interpretation beside it is still
     computed, from today's real transits. */
  $("stamp").textContent = `Astra, seen from above the Earth · ${SAMPLE.moment.name}`;
  if (INSIGHT) {
    $("sayHead").textContent = "What a chart is for";
    $("sayBody").textContent = `${INSIGHT.line} That sentence came from three facts about a chart, and Astra shows you all three.`;
  }
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
  const nav = $("nav"), lights = [...document.querySelectorAll(".tour,.shelf-act")];
  const f = () => { nav.classList.toggle("solid", scrollY > 50);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}
