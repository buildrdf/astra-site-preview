/* ==========================================================================
   The continuity stage — the audit's first build step and its highest-impact
   change: ONE chart, alive from the sky through today's transits into a
   reading. Nothing is torn down and rebuilt at a scene boundary.

   There is exactly one chart element and exactly eighteen graha elements
   (nine natal, nine transiting) for the whole section. Scenes are ranges of a
   single scroll progress, so scrolling back reconstructs what you left.

   t          scene
   0.00-0.10  the horizon, at rest. Nothing waits on animation.
   0.10-0.34  the nine leave the sky and take their houses; the chart draws
   0.34-0.46  hold: the completed chart
   0.46-0.60  one house lights and says what it covers
   0.60-0.76  today's grahas arrive on the outer edge of the cells they cross
   0.76-1.00  the reading appears, naming the crossing you can see

   Determinism: position is a pure function of t. The only time-based motion is
   the pre-assembly drift in the open sky, which stops entirely once the grahas
   are seated — so every composition the reader is asked to hold still is
   reproducible, and the page never disagrees with itself on the way back up.
   ========================================================================== */
import { SEAT, LABEL, HOUSE_PATH, renderChart } from "./chart.js";
import { transitInto } from "./kundali.js";
import { dailyInsight, HOUSE_THEME } from "./insight.js";
import { asset } from "./asset.js";

const SAMPLE = await fetch("src/sample.json").then(r => r.json());
const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const ORD = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
const glide = v => { const x = clamp(v); return x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };
const lerp = (a, b, k) => a + (b - a) * k;

/* the house this scene stops on: the one the reading will be about, so the
   two scenes are about the same place in the chart rather than two places */
const NOW = new Date();
const TRANSITS = transitInto(NOW, SAMPLE.lagna.sign);
const INSIGHT = dailyInsight(TRANSITS, SAMPLE.planets);
const FOCUS = INSIGHT ? INSIGHT.house : 10;

/* ---------- starfield ------------------------------------------------- */
{
  const c = $("stars"), ctx = c.getContext("2d");
  let pts = [], W, H, dpr;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round(W * H / 7000) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() < .1 ? 1.2 : .6, a: .2 + Math.random() * .45 }));
    for (const p of pts) { ctx.globalAlpha = p.a; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  };
  addEventListener("resize", size, { passive: true }); size();
}

/* ---------- the one chart, drawn once --------------------------------- */
const svg = $("oneChart");
renderChart(svg, SAMPLE, { assets: "assets" });
svg.querySelectorAll(".k-planet").forEach(p => p.remove());     /* the stage owns the grahas */
const lines = [...svg.querySelectorAll(".k-line")];
const signs = [...svg.querySelectorAll(".k-sign, .k-asc")];
const cells = Object.fromEntries([...svg.querySelectorAll(".k-cell")].map(c => [c.dataset.house, c]));
for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;

/* ---------- the eighteen bodies, created once -------------------------- */
const box = $("chartBox"), bodies = $("bodies");
const natal = {}, transit = {};
const SIZE = { Sun: 1.14, Moon: 1, Mars: 1, Mercury: .97, Jupiter: 1.1, Venus: 1, Saturn: 1.22, Rahu: 1.04, Ketu: 1.04 };
for (const g of GRAHAS) {
  for (const [store, cls] of [[natal, ""], [transit, " transit"]]) {
    const d = document.createElement("div");
    d.className = "body" + cls;
    const im = new Image(); im.src = asset(`assets/graha/${g.toLowerCase()}.png`); im.alt = "";
    d.append(im); bodies.append(d); store[g] = d;
  }
}

/* where each graha is going: its seat, spread when a house is shared */
const seatOf = (list, key) => {
  const out = {};
  const inside = v => Math.max(9, Math.min(91, v));
  for (const p of list) {
    const share = list.filter(q => q.house === p.house);
    const i = share.indexOf(p), n = share.length;
    /* Natal grahas sit at the cell's deep point. Transits ride nearer its outer
       edge so the two can never be confused — but only PART of the way there:
       the sign-number corners themselves are so close to the chart's border that
       markers placed on them, with their rings, fell outside the square. */
    const seat = SEAT[p.house], label = LABEL[p.house];
    const base = key === "natal" ? seat
      : [seat[0] + (label[0] - seat[0]) * .58, seat[1] + (label[1] - seat[1]) * .58];
    const gap = key === "natal" ? (n > 2 ? 7 : 8.5) : (n > 2 ? 5 : 6.5);
    const off = n > 1 ? (i - (n - 1) / 2) * gap : 0;
    const along = p.house % 3 === 1 ? [1, 0] : [.72, .69];
    out[p.graha] = [inside(base[0] + along[0] * off),
                    inside(base[1] + along[1] * off * (p.house > 6 ? -1 : 1))];
  }
  return out;
};
const NATAL_SEAT = seatOf(SAMPLE.planets, "natal");
const TRANSIT_SEAT = seatOf(TRANSITS, "transit");

/* where each graha starts: out in the open sky above the horizon */
const SKY = {};
GRAHAS.forEach((g, i) => {
  const a = (200 + i * 17.5) * Math.PI / 180;         /* fixed, so the sky is reproducible */
  SKY[g] = { a, ring: i };
});

/* ---------- geometry --------------------------------------------------- */
let W = 0, H = 0, S = 0, bx = 0, by = 0, disc = 0, small = false;
function measure() {
  const view = document.querySelector(".story-view");
  W = view.clientWidth; H = view.clientHeight;
  small = W < 860;
  const r = box.getBoundingClientRect(), v = view.getBoundingClientRect();
  S = r.width; bx = r.left - v.left; by = r.top - v.top;
  disc = Math.max(26, Math.min(W, H) * (small ? .052 : .058));
  const k = S / 104;                                   /* the chart's viewBox is 104 wide */
  for (const l of lines) l.dataset.px = l.dataset.len * k;
}

/* a point inside the chart's 0-100 space, in stage pixels */
const inChart = (x, y) => [bx + x / 100 * S, by + y / 100 * S];

/* a point out in the sky, above the horizon, for the pre-assembly frame */
function inSky(g, drift) {
  const { a, ring } = SKY[g];
  const rx = Math.min(W * .46, 620) * (1 + ring * .055);
  const ry = rx * .34;
  const cx = W / 2, cy = H * 1.02;
  const ang = a + drift * (1 / (1 + ring * .3)) * Math.PI / 180;
  return [cx + rx * Math.cos(ang), cy + ry * Math.sin(ang)];
}

/* ---------- the frame -------------------------------------------------- */
let t = 0, target = 0, raf = 0, drift = 0, lastMs = 0, beatShown = -1, whyOpen = false;
const beats = [...document.querySelectorAll(".beat")];

function frame() {
  /* the horizon leaves as the grahas do */
  const gone = smooth((t - .12) / .18);
  const hz = document.querySelector(".horizon");
  hz.style.opacity = (1 - gone * .92).toFixed(3);
  hz.style.transform = `translate(-50%,${(gone * 14).toFixed(2)}%)`;

  /* the chart draws itself while they travel */
  const drawn = smooth((t - .12) / .20);
  for (const l of lines) {
    l.style.strokeDasharray = l.dataset.px;
    l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
  }
  const signOn = smooth((t - .30) / .08) * (1 - smooth((t - .60) / .08) * .55);
  for (const s of signs) s.style.opacity = signOn.toFixed(3);

  /* the nine natal grahas: sky → seat, one after another, then still */
  GRAHAS.forEach((g, i) => {
    const k = glide((t - .12 - i * .016) / .18);
    const [ox, oy] = inSky(g, k < 1 ? drift : 0);
    const [sx, sy] = inChart(...(NATAL_SEAT[g] ?? [50, 50]));
    const dx = sx - ox, dy = sy - oy, len = Math.hypot(dx, dy) || 1;
    const bulge = Math.sin(k * Math.PI) * len * .11 * (i % 2 ? -1 : 1);
    const x = lerp(ox, sx, k) + (-dy / len) * bulge;
    const y = lerp(oy, sy, k) + (dx / len) * bulge;
    const size = disc * SIZE[g] * lerp(1, .42, k);
    place(natal[g], x, y, size, true);
  });

  /* one house lights, and says what it covers */
  const lit = t > .46 && t < .78;
  for (const h in cells) cells[h].classList.toggle("lit", lit && +h === FOCUS);

  /* today's grahas arrive on the outer edge of the cells they cross */
  const tin = smooth((t - .60) / .12);
  TRANSITS.forEach((p, i) => {
    const el = transit[p.graha];
    const [sx, sy] = inChart(...(TRANSIT_SEAT[p.graha] ?? [50, 50]));
    const size = disc * .30;
    /* they drop in from just outside the chart, staggered */
    const k = smooth((t - .60 - i * .012) / .10);
    const y = lerp(sy - S * .10, sy, k);
    place(el, sx, y, size, tin > .04 && k > .02);
    el.style.opacity = (tin * k).toFixed(2);
  });

  /* the words */
  const want = t < .12 ? 0 : t < .46 ? 1 : t < .60 ? 2 : t < .76 ? 3 : 4;
  if (want !== beatShown) {
    beats.forEach((b, i) => b.dataset.on = i === want ? "1" : "0");
    beatShown = want;
  }
  $("reading").classList.toggle("on", t >= .78);
  $("stamp").classList.toggle("on", t > .34);
  $("cue").style.opacity = (1 - smooth(t / .05)).toFixed(2);
}

function place(el, x, y, size, visible) {
  el.style.width = el.style.height = size.toFixed(1) + "px";
  el.style.transform = `translate(${(x - size / 2).toFixed(1)}px,${(y - size / 2).toFixed(1)}px)`;
  el.classList.toggle("in", !!visible);
}

/* ---------- scroll ----------------------------------------------------- */
function tick(now) {
  const d = target - t;
  t += Math.abs(d) < .0004 ? d : d * .14;
  const ms = lastMs ? Math.min(now - lastMs, 64) : 16;
  lastMs = now;
  drift += ms / 1000 * 2.2;                 /* about 2 degrees a second, and only pre-assembly */
  frame();
  raf = Math.abs(d) > .0004 || t < .12 ? requestAnimationFrame(tick) : (lastMs = 0);
}
function onScroll() {
  const story = $("story"), view = document.querySelector(".story-view");
  const span = (story.offsetHeight - view.clientHeight) * .92;
  target = clamp(span > 0 ? -story.getBoundingClientRect().top / span : 0);
  if (!raf) raf = requestAnimationFrame(tick);
}

/* ---------- the text the stage carries --------------------------------- */
$("stamp").textContent = `Example chart · ${SAMPLE.moment.local} ${SAMPLE.moment.tz} · ${SAMPLE.moment.name} · ${SAMPLE.lagna.signName} rising`;
$("houseLede").textContent = `Your ${ORD(FOCUS)} house is ${HOUSE_THEME[FOCUS][0]} — ${HOUSE_THEME[FOCUS][1]}.`;
if (INSIGHT) {
  $("readWhen").textContent = NOW.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  $("readLine").textContent = INSIGHT.line;
  $("whyList").replaceChildren(...INSIGHT.because.map(b => { const li = document.createElement("li"); li.textContent = b; return li; }));
}
$("whyBtn").addEventListener("click", () => {
  whyOpen = !whyOpen;
  $("whyList").hidden = !whyOpen;
  $("whyBtn").setAttribute("aria-expanded", String(whyOpen));
  $("whyBtn").textContent = whyOpen ? "Hide the working" : "Why this reading?";
});

/* ---------- reveals on the closing act --------------------------------- */
{
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); }
  }), { threshold: .15 });
  document.querySelectorAll("[data-in]").forEach(el => io.observe(el));
}
{
  const nav = $("nav"), lights = [...document.querySelectorAll(".act-light,.act-grey")];
  const f = () => { nav.classList.toggle("solid", scrollY > 60);
    nav.classList.toggle("light", lights.some(s => { const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; })); };
  addEventListener("scroll", f, { passive: true }); f();
}

/* ---------- start ------------------------------------------------------ */
function start() {
  measure();
  if (reduce) { t = target = 1; drift = 0; frame(); document.querySelector(".horizon").style.display = "none";
    addEventListener("resize", () => { measure(); frame(); }, { passive: true }); return; }
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measure(); frame(); }, { passive: true });
}
/* the first frame must not wait on the network: lay out immediately, and let
   each graha fade in as its own artwork lands */
start();
for (const g of GRAHAS) for (const store of [natal, transit]) {
  const im = store[g].querySelector("img");
  if (!im.complete) im.addEventListener("load", () => frame(), { once: true });
}
