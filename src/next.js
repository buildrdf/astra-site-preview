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
const FEATURES = [
  { id:"day", tab:"Your day", head:"A day that reads differently for you.",
    a:"Your horoscope, the life areas it touches, the panchang beneath it, and the hours the tradition favours or cautions.",
    b:"Guidance first. The working that produced it, second.",
    shots:["assets/app/day-rhythm.png","assets/app/day-areas.png"],
    wide:[0,1],
    note:"the day's rhythm, then the life areas it touches" },
  { id:"time", tab:"Your timeline", head:"Time contains time.",
    a:"Mahadasha, antardasha and pratyantardasha, each opening into the next, with Sade Sati shown as an overlay rather than an alarm.",
    b:"Your own life events sit on the same line.",
    shots:["assets/app/timeline.png"], wide:[0],
    note:"mahadasha, antardasha, pratyantardasha" },
  { id:"universe", tab:"Your universe", head:"Birth, today, and the sky above you.",
    a:"Switch the chart between the sky you were born under and the one overhead now. Touch a planet to open it.",
    b:"Then raise the phone: the same planet, in tonight's real sky, among the twenty-seven nakshatras — and pinch out to see the whole zodiac from above the Earth.",
    shots:["assets/app/universe.png","assets/app/sky.png","assets/app/earth.png"],
    dark:[1,2],
    note:"the chart, the sky above you, then the zodiac from orbit" },
  { id:"ask", tab:"Ask Astra", head:"Ask, and the chart answers.",
    a:"A question about your own chart, answered from your real placements and your current period, with the entities it used attached.",
    b:"Then hold the microphone and talk to it instead. The Moon listens, answers aloud, and stops the moment you speak.",
    shots:["assets/app/guide.png","assets/app/voice.png"], wide:[1],
    note:"an answer with its sources, then the same thing by voice" },
  { id:"moment", tab:"Find your moment", head:"Some things are better begun at one hour than another.",
    a:"Muhurta for a marriage, a venture, a home, a journey. Astra reads the window you give it and explains the score.",
    b:"For a birth it scores only inside the window your doctor has already set. That decision is never the app's.",
    shots:["assets/app/muhurta.png"], note:"what the window is for, and how it is scored" },
  { id:"you", tab:"You & your people", head:"Your details, and the people they connect to.",
    a:"One birth profile unlocks the depth: the full Kundali, your reports, and the periods that shaped your years.",
    b:"Add someone else and read the two charts together.",
    shots:["assets/app/you.png"], note:"one profile, and the people it connects to" }
];

{
  const nav = $("tourNav"), panel = $("panel"), tour = $("tour");
  /* one screen-height of travel per feature, plus a little to settle */
  tour.style.height = (FEATURES.length * 88 + 30) + "vh";

  /* every screenshot exists from the start; only opacity changes */
  const imgs = [];
  FEATURES.forEach((f, i) => {
    f.shots.forEach((src, j) => {
      const im = new Image();
      im.src = src; im.alt = ""; im.loading = i < 2 ? "eager" : "lazy";
      im.dataset.f = i; im.dataset.j = j;
      if (f.dark?.includes(j)) im.classList.add("dark");
      panel.append(im); imgs.push(im);
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
    /* a feature's graphics are spread evenly across its own stretch of scroll,
       so a tab with three screens shows all three on the way past */
    const n = f.shots.length;
    const j = Math.min(n - 1, Math.floor(sub * n));
    for (const im of imgs) im.classList.toggle("on", +im.dataset.f === i && +im.dataset.j === j);
    panel.classList.toggle("is-dark", !!f.dark?.includes(j));
    /* a wide graphic gets a wide panel instead of floating in a tall one */
    panel.classList.toggle("is-wide", !!f.wide?.includes(j));
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
