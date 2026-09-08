/* ==========================================================================
   The opening stage: nine grahas in orbit above the Earth, which then leave
   orbit and take their seats in the chart.

   One number drives all of it. The sticky viewport reports how far you have
   scrolled through it as t (0 → 1); every element reads t and nothing else.
   That is why the sequence can be scrubbed backwards, interrupted, or
   resumed halfway without any state to unwind — the constitution's rule that
   motion must be interruptible, met by construction rather than by cleanup.

   t          what happens
   0.00-0.30  the grahas orbit; Earth fills the lower frame
   0.30-0.50  Earth sinks and fades, the orbit rings go out, the chart draws
   0.46-0.88  each graha leaves its ring and flies to its house, in turn
   0.88-1.00  the houses take their sign numbers; the chart is live

   The flight is an arc, not a line: a graha carries a sideways bulge that
   peaks halfway and falls to nothing on arrival, so nine objects crossing at
   once read as nine separate journeys rather than a collapse toward a point.
   ========================================================================== */
import { SEAT } from "./chart.js";
import { asset } from "./asset.js";

const GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

/* Each graha's ring and where it sits on it. Rings are ellipses seen from
   above the pole, so they foreshorten; angles are chosen to spread the nine
   across the sky rather than to model real orbital distance — the true
   positions are the ones in the chart they fly into. */
/* Ring index (0 = closest to Earth) and the angle each graha holds on it.
   Angles run 190°-350°, the half of the ellipse ABOVE its centre, so every
   graha rides in the open sky between the Earth's limb and the headline. The
   spread across that arc is chosen for the composition; the true positions
   are the ones in the chart they fly into. */
const RING = {
  Moon:    { i: 0, a: 292 }, Mercury: { i: 1, a: 224 }, Venus:   { i: 2, a: 316 },
  Sun:     { i: 3, a: 254 }, Mars:    { i: 4, a: 218 }, Jupiter: { i: 5, a: 302 },
  Saturn:  { i: 6, a: 240 }, Rahu:    { i: 7, a: 324 }, Ketu:    { i: 8, a: 216 }
};
const SIZE = { Sun: 1.16, Moon: 1.0, Mars: 1.0, Mercury: .98, Jupiter: 1.12,
               Venus: 1.0, Saturn: 1.26, Rahu: 1.06, Ketu: 1.06 };

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const smooth = v => { const x = clamp(v); return x * x * (3 - 2 * x); };
/* slow at both ends, like something under its own weight */
const glide = v => { const x = clamp(v); return x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };
const lerp = (a, b, k) => a + (b - a) * k;

export function buildStage(root, chart, opts = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const assets = opts.assets ?? "assets";
  const stage = root.querySelector(".stage");
  const earth = root.querySelector(".earth");
  const orbits = root.querySelector(".orbits");
  const bodies = root.querySelector(".bodies");
  const chartBox = root.querySelector(".stage-chart");
  const svg = chartBox.querySelector("svg");
  const beats = [...root.querySelectorAll(".beat")];
  const cue = root.querySelector(".cue");

  /* The nine, as one img each — the same artwork the chart and the app use.
     Each body starts at zero size (see .body in the stylesheet) and shows itself
     only once its own image has landed. The first build waited for all nine
     before sizing anything, so on a phone network the artwork sat on screen at
     its full 320px for seconds, and if one image stalled the opening never ran. */
  const el = {};
  for (const g of GRAHAS) {
    const d = document.createElement("div");
    d.className = "body";
    const im = new Image();
    im.alt = "";
    im.decoding = "async";
    const arrive = () => d.classList.add("in");
    im.onload = arrive; im.onerror = arrive;
    im.src = asset(`${assets}/graha/${g.toLowerCase()}.png`);
    if (im.complete && im.naturalWidth) arrive();
    d.append(im);
    bodies.append(d);
    el[g] = d;
  }

  /* the rings, drawn once per resize */
  let W = 0, H = 0, geom = null;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    /* The Earth's own arc meets the frame at top:68%. The ORBITS are drawn about a
       point just below the frame, sized so their apexes land between 76% and 48% of
       the viewport — the band of open sky above the limb and below the headline.
       Sizing them off the Earth's true radius put every ring, and every graha on it,
       several hundred pixels below the fold: the opening frame was empty. */
    const phone = W < 640;
    const ocx = W / 2, ocy = H * (phone ? 1.02 : 1.06);
    const ringRY = i => H * (phone ? .24 + i * .046 : .30 + i * .035);
    const ringRX = i => Math.min(ringRY(i) * (phone ? 1.25 : 1.6), W * (phone ? .46 : .48));
    const cx = ocx, cy = ocy;
    /* the chart sits in the lower two thirds, clear of the headline above it */
    const S = Math.min(H * .48, W * .70, 520);
    const chartCX = W / 2, chartCY = H * .615;
    chartBox.style.width = chartBox.style.height = S + "px";
    chartBox.style.left = chartCX + "px";
    chartBox.style.top = chartCY + "px";
    geom = { cx, cy, ringRX, ringRY, S, chartX: chartCX - S / 2, chartY: chartCY - S / 2,
             disc: phone ? 30 : Math.max(30, Math.min(W, H) * .058) };
    scaleDashes(S);

    orbits.setAttribute("viewBox", `0 0 ${W} ${H}`);
    orbits.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      e.setAttribute("cx", ocx); e.setAttribute("cy", ocy);
      e.setAttribute("rx", ringRX(i).toFixed(1)); e.setAttribute("ry", ringRY(i).toFixed(1));
      orbits.append(e);
    }
  }

  /* The chart's own lines, ready to be drawn on by t.

     getTotalLength() answers in viewBox units, but these strokes carry
     vector-effect:non-scaling-stroke, which makes the browser lay the dash
     pattern out in SCREEN units instead. Handing it the user-unit length left
     a dash far longer than the line, so the "undrawn" chart was in fact fully
     visible behind the opening headline. The dash has to be scaled by however
     many pixels one viewBox unit currently occupies, which changes with the
     stage, so it is recomputed on every measure. */
  const VB = 104;                                   /* the chart's viewBox side */
  const lines = [...svg.querySelectorAll(".k-line")];
  for (const l of lines) l.dataset.len = l.getTotalLength?.() ?? 400;
  let drawn = 0;                                    /* the last progress applied */
  function scaleDashes(S) {
    const k = S / VB;
    for (const l of lines) {
      const px = l.dataset.len * k;
      l.style.strokeDasharray = px;
      l.style.strokeDashoffset = px * (1 - drawn);
      l.dataset.px = px;
    }
  }
  const labels = [...svg.querySelectorAll(".k-sign, .k-asc")];
  for (const l of labels) l.style.opacity = 0;

  /* which seat each graha is flying to */
  const seatOf = {};
  for (const p of chart.planets) {
    const share = chart.planets.filter(q => q.house === p.house);
    const i = share.indexOf(p), n = share.length;
    const [sx, sy] = SEAT[p.house];
    const spread = n > 1 ? (i - (n - 1) / 2) * (n > 2 ? 7.5 : 9) : 0;
    const along = p.house % 3 === 1 ? [1, 0] : [.72, .69];
    seatOf[p.graha] = [sx + along[0] * spread, sy + along[1] * spread * (p.house > 6 ? -1 : 1)];
  }

  let t = 0, shown = 0, raf = 0, idle = 0;
  /* the opening, in seconds since the stage started: the Earth rises into the
     frame and the grahas arrive one after another, with no scroll needed */
  let born = 0;

  function frame() {
    const { cx, cy, ringRX, ringRY, S, chartX, chartY, disc } = geom;
    const age = born ? (performance.now() - born) / 1000 : 9;
    const rise = glide(age / 1.6);

    /* Act one: the Earth rises, holds the frame, then leaves it */
    const gone = smooth((t - .30) / .20);
    earth.style.opacity = (1 - gone).toFixed(3);
    earth.style.transform = `translate(-50%,${((1 - rise) * 14 + gone * 16).toFixed(2)}%)`;
    orbits.style.opacity = (1 - smooth((t - .26) / .18)).toFixed(3);

    /* the chart draws itself as the sky empties */
    drawn = smooth((t - .34) / .26);
    for (const l of lines) l.style.strokeDashoffset = (l.dataset.px * (1 - drawn)).toFixed(1);
    const lab = smooth((t - .86) / .12);
    for (const l of labels) l.style.opacity = lab.toFixed(3);

    /* Act two: nine journeys, one after another */
    GRAHAS.forEach((g, i) => {
      const ring = RING[g];
      /* an inner ring drifts faster than an outer one, as it should */
      const speed = 1 / (1 + ring.i * .35);
      const a = (ring.a + (idle * .34 + t * 30) * speed) * Math.PI / 180;
      const rx = ringRX(ring.i), ry = ringRY(ring.i);
      const ox = cx + rx * Math.cos(a), oy = cy + ry * Math.sin(a);

      const seat = seatOf[g] ?? [50, 50];
      const sxp = chartX + seat[0] / 100 * S, syp = chartY + seat[1] / 100 * S;

      /* The whole flight must finish inside t = 1, stagger included. The first
         schedule ran to 1.008, so the ninth graha — Ketu — was still in transit
         when the scroll ran out and simply hung outside the chart. */
      const k = glide((t - .40 - i * .028) / .26);
      /* the sideways bulge that makes it a flight and not a slide */
      const dx = sxp - ox, dy = syp - oy, len = Math.hypot(dx, dy) || 1;
      const bulge = Math.sin(k * Math.PI) * len * .13 * (i % 2 ? -1 : 1);
      const x = lerp(ox, sxp, k) + (-dy / len) * bulge;
      const y = lerp(oy, syp, k) + (dx / len) * bulge;

      /* each graha arrives a beat after the last, growing from a point */
      const born_k = glide((age - .35 - i * .11) / .9);
      const size = disc * SIZE[g] * lerp(1, .40, k) * lerp(.2, 1, born_k);
      const spin = lerp(0, (i % 2 ? 8 : -8), k);
      const e = el[g];
      e.style.width = e.style.height = size.toFixed(1) + "px";
      e.style.transform = `translate(${(x - size / 2).toFixed(1)}px,${(y - size / 2).toFixed(1)}px) rotate(${spin.toFixed(2)}deg)`;
    });

    /* the words: one line at a time, never two */
    const want = t < .26 ? 0 : t < .62 ? 1 : 2;
    if (want !== shown) { beats.forEach((b, i) => b.dataset.on = i === want ? "1" : "0"); shown = want; }
    if (cue) cue.style.opacity = (1 - smooth(t / .08)).toFixed(2);
  }

  /* t follows the scroll, but eases toward it, so a flicked trackpad still
     lands softly instead of snapping through the whole sequence */
  let target = 0;
  function tick() {
    const d = target - t;
    t += Math.abs(d) < .0004 ? d : d * .13;
    frame();
    idle += .28;
    const opening = born && performance.now() - born < 2400;
    raf = Math.abs(d) > .0004 || t < .30 || opening ? requestAnimationFrame(tick) : 0;
  }
  function onScroll() {
    const r = root.getBoundingClientRect();
    /* the sequence completes in the first four fifths of the pinned range; the
       last fifth holds the finished chart on screen instead of whipping it away */
    const span = (root.offsetHeight - stage.clientHeight) * .8;
    target = clamp(span > 0 ? -r.top / span : 0);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function start() {
    measure();
    if (reduce) {                     /* the finished frame, with nothing in motion */
      t = target = 1; idle = 0; born = 0; frame();
      earth.style.display = "none";
      addEventListener("resize", () => { measure(); frame(); }, { passive: true });
      return;
    }
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => { measure(); frame(); }, { passive: true });
  }

  born = performance.now();
  start();

  return { get progress() { return t; } };
}
