/* ==========================================================================
   The page's wiring. Each act gets one small block below and owns nothing
   outside it.

   Two rules run through all of it. Every number shown is computed by the
   engine at the moment it is shown — none is written into the markup. And
   nothing claims more than it can prove: where delivery or payment is not
   built yet, the page says so rather than pretending to succeed.
   ========================================================================== */
import { renderChart, focusPlanet, clearFocus, aspectsOf } from "./chart.js";
import { castChart, transitInto, geocode, guessPlace, utcFromLocal, PLAIN, fmtDeg, fmtDate } from "./kundali.js";
import { buildStage } from "./stage.js";
import { createSkyField } from "./skyfield.js";
import { dayShape, lunarMonth } from "./today.js";
import { asset } from "./asset.js";

const SAMPLE = await fetch("src/sample.json").then(r => r.json());
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const ORD = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const art = g => asset(`assets/graha/${g.toLowerCase()}.png`);
const GRAHAS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const HERE = guessPlace();

/* ---------- the star field behind the opening act -------------------- */
{
  const c = $("stars"), ctx = c.getContext("2d");
  let pts = [], W, H, dpr;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round(W * H / 6200) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() < .1 ? 1.25 : .65, a: .25 + Math.random() * .5 }));
    draw();
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of pts) { ctx.globalAlpha = p.a; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  };
  addEventListener("resize", size, { passive: true }); size();
}

/* ---------- nav: solid once you leave the opening, light over light --- */
{
  const nav = $("nav");
  const lights = [...document.querySelectorAll(".act-light,.act-grey")];
  const onScroll = () => {
    nav.classList.toggle("solid", scrollY > 60);
    nav.classList.toggle("light", lights.some(s => {
      const r = s.getBoundingClientRect(); return r.top < 48 && r.bottom > 48; }));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
}

/* ---------- reveals: visible at rest, script only adds the arrival ---- */
{
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll("[data-in]").forEach(el => io.observe(el));
}

/* ---------- ACT 1 + 2 — orbit into the chart ------------------------- */
renderChart($("stageChart"), SAMPLE, { assets: "assets", art: false });
$("stageChart").querySelectorAll(".k-planet").forEach(p => p.remove());   /* the stage flies its own */
buildStage($("stage"), SAMPLE, { assets: "assets" });

/* ---------- ACT 3 — birth and today ---------------------------------- */
{
  const svg = $("thenNow"), facts = $("chartFacts");
  const birthT = new Date(SAMPLE.moment.iso).getTime();
  const nowT = Date.now();
  /* "Today" means today. It used to mean the birth moment plus sixty years, which with a
     sample chart dated 2093 put the label on the year 2153. */
  const spanYears = Math.max(1, Math.round((nowT - birthT) / (365.25 * 864e5)));
  let mode = "birth";

  const fact = (k, v) => `<div class="fact"><span>${k}</span><b>${v}</b></div>`;
  const showFacts = planets => {
    const moon = planets.find(p => p.graha === "Moon");
    const sun = planets.find(p => p.graha === "Sun");
    facts.innerHTML =
      fact("Ascendant", `${SAMPLE.lagna.signName} · ${SAMPLE.lagna.sanskrit}`) +
      fact("Moon", `${moon.signName} ${fmtDeg(moon.deg)} · ${moon.nakshatra}`) +
      fact("Sun", `${sun.signName} ${fmtDeg(sun.deg)}`) +
      fact("Retrograde", planets.filter(p => p.retro && p.graha !== "Rahu" && p.graha !== "Ketu").map(p => p.graha).join(", ") || "None") +
      fact("Ayanamsa", "Lahiri");
  };

  const paint = (planets, when, label) => {
    renderChart(svg, { ...SAMPLE, planets }, { assets: "assets" });
    $("scrubYear").textContent = new Date(when).getUTCFullYear();
    $("scrubSub").textContent = label;
    showFacts(planets);
  };

  const atFraction = f => {
    const when = birthT + f * (nowT - birthT);
    return { when, planets: transitInto(new Date(when), SAMPLE.lagna.sign) };
  };

  const setMode = m => {
    mode = m;
    $("tabBirth").setAttribute("aria-selected", m === "birth");
    $("tabNow").setAttribute("aria-selected", m === "now");
    const thumb = $("segThumb"), on = m === "birth" ? $("tabBirth") : $("tabNow");
    thumb.style.left = on.offsetLeft + "px"; thumb.style.width = on.offsetWidth + "px";
    if (m === "birth") { $("scrubber").value = 0; paint(SAMPLE.planets, birthT, "the chart, as cast"); }
    else { $("scrubber").value = 1000; paint(transitInto(new Date(nowT), SAMPLE.lagna.sign), nowT, "today's sky, laid into that chart"); }
  };

  $("tabBirth").onclick = () => setMode("birth");
  $("tabNow").onclick = () => setMode("now");
  $("scrubber").addEventListener("input", e => {
    const f = e.target.value / 1000;
    if (f === 0) return setMode("birth");
    mode = "now";
    $("tabBirth").setAttribute("aria-selected", "false");
    $("tabNow").setAttribute("aria-selected", "true");
    const thumb = $("segThumb"), on = $("tabNow");
    thumb.style.left = on.offsetLeft + "px"; thumb.style.width = on.offsetWidth + "px";
    const a = atFraction(f);
    const age = Math.round(f * spanYears);
    paint(a.planets, a.when, age === 0 ? "the chart, as cast" : `${age} year${age === 1 ? "" : "s"} after that birth`);
  });

  $("tickA").textContent = new Date(birthT).getUTCFullYear();
  $("tickB").textContent = new Date(nowT).getUTCFullYear();
  requestAnimationFrame(() => setMode("birth"));
}

/* ---------- ACT 4 — touch -------------------------------------------- */
let chosen = SAMPLE.planets.find(p => p.graha === "Saturn");
{
  const svg = $("touchChart");
  const read = p => {
    chosen = p;
    $("plateArt").src = art(p.graha);
    $("plateName").textContent = p.graha;
    $("plateWhere").textContent = `${ORD(p.house)} house · ${p.signName}`;
    $("plateText").textContent = PLAIN[p.graha];
    $("plateTech").textContent = `${fmtDeg(p.deg)} ${p.signName} · ${p.nakshatra} ${p.pada}`
      + `${p.retro ? " · retrograde" : ""}${p.dignity ? " · " + p.dignity : ""}`
      + ` · aspects the ${aspectsOf(p.graha, p.house).map(ORD).join(", ")}`;
    $("toSky").textContent = `See ${p.graha} in tonight's sky`;
    $("touchHint").style.opacity = "0";
  };
  renderChart(svg, SAMPLE, { assets: "assets", interactive: true, onSelect: p => { focusPlanet(svg, p); read(p); } });
  focusPlanet(svg, chosen); read(chosen); $("touchHint").style.opacity = "";
  svg.addEventListener("click", e => { if (e.target === svg) clearFocus(svg); });
}

/* ---------- ACT 5 — tonight's sky ------------------------------------ */
{
  const field = createSkyField($("skyCanvas"), { place: HERE, when: new Date() });
  const imgs = {};
  for (const g of GRAHAS) { const i = new Image(); i.src = art(g); imgs[g] = i; }

  const NODE = { Rahu: "the Moon's north node", Ketu: "the Moon's south node" };
  const say = r => {
    if (!r) return;
    const where = r.up
      ? `${r.alt.toFixed(0)}° above the horizon, ${r.compass}, over ${r.place} right now.`
      : `below the horizon over ${r.place} right now — ${Math.abs(r.alt).toFixed(0)}° down, ${r.compass}.`;
    $("skyWhere").textContent = NODE[r.graha]
      ? `${r.graha} is ${NODE[r.graha]}: a computed point, ${where} There is nothing there to see.`
      : `${r.graha} is ${where}`;
    $("skyPicks").querySelectorAll("button").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.g === r.graha));
  };

  const picks = $("skyPicks");
  for (const g of GRAHAS) {
    const b = document.createElement("button");
    b.className = "pick"; b.dataset.g = g; b.type = "button"; b.setAttribute("aria-pressed", "false");
    const pi = new Image(); pi.src = art(g); pi.alt = ""; b.append(pi, g);
    b.onclick = () => say(field.show(g, imgs[g]));
    picks.append(b);
  }
  $("skyLede").textContent = `The twenty-seven nakshatras, standing over ${HERE.name} right now.`;

  /* the button in the previous act carries the chosen graha into this one */
  $("toSky").onclick = () => {
    $("sky").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    setTimeout(() => say(field.show(chosen.graha, imgs[chosen.graha])), reduce ? 0 : 620);
  };
  /* Opening on whatever was last tapped in the chart often meant opening on a
     graha that is below the horizon at this hour — a true statement, but a dead
     frame. Arriving by scroll shows whichever graha actually stands highest;
     arriving by the button still honours the one you chose. */
  new IntersectionObserver((es, o) => es.forEach(e => {
    if (!e.isIntersecting) return;
    const g = field.highest();
    say(field.show(g, imgs[g]));
    o.disconnect();
  }), { threshold: .3 }).observe($("sky"));
}

/* ---------- ACT 6 — how rare, measured ------------------------------- */
{
  const r = SAMPLE.rarity;
  $("rareNum").textContent = r.otherDays.toLocaleString();
  $("rareDays").textContent = r.daysScanned.toLocaleString();
  $("rareWindow").textContent = r.windowYears.toLocaleString();
  $("rareHits").textContent = r.otherDays.toLocaleString();
}

/* ---------- ACT 7 — your day ----------------------------------------- */
{
  const now = new Date();
  const d = dayShape(now, HERE);
  $("dayDate").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: HERE.tz });
  $("varaLord").textContent = d.vara.lord;
  $("varaLine").textContent = `${d.vara.day} is traditionally ruled by ${d.vara.lord}.`;
  $("varaColour").textContent = d.vara.colour;
  $("varaNum").textContent = `Colour and number traditionally associated with ${d.vara.lord}. Number ${d.vara.num}.`;

  if (d.polar) {
    $("dayArc").innerHTML = ""; $("dayKeys").innerHTML = "";
    $("dayNote").textContent = d.polar;
  } else {
    /* The two windows can overlap, and painting their names inside them made the labels
       collide and clip. The bands stay wordless; the legend below names them. */
    $("dayArc").innerHTML =
      `<div class="band good" style="left:${d.abhijit.left}%;width:${d.abhijit.width}%" title="Abhijit ${d.abhijit.text}"></div>` +
      `<div class="band hold" style="left:${d.rahu.left}%;width:${d.rahu.width}%" title="Rahu Kalam ${d.rahu.text}"></div>` +
      (d.nowPct == null ? "" : `<div class="nowline" style="left:${d.nowPct}%"></div>`);
    $("dayScale").innerHTML = `<span>${d.riseText} sunrise</span><span>${d.setText} sunset</span>`;
    $("dayKeys").innerHTML =
      `<span class="key"><i class="sw good"></i>Abhijit · ${d.abhijit.text}</span>` +
      `<span class="key"><i class="sw hold"></i>Rahu Kalam · ${d.rahu.text}</span>` +
      (d.nowPct == null ? "" : `<span class="key"><i class="sw now"></i>Now</span>`);
    $("dayNote").textContent = `Abhijit ${d.abhijit.text}, the eighth muhurta of fifteen. `
      + `Rahu Kalam ${d.rahu.text}, the ${ORD(d.vara.rk)} eighth of daylight. Computed for ${HERE.name}.`;
  }

  const m = d.moon;
  $("moonPhase").textContent = `${Math.round(m.illum * 100)}%`;
  $("moonLine").textContent = `${m.name} · ${m.paksha} ${m.tithi} · lit fraction, computed from the Moon's distance ahead of the Sun.`;

  const strip = $("moonStrip");
  for (const p of lunarMonth(now)) {
    const f = document.createElement("figure");
    if (p.isToday) f.className = "on";
    const mi = new Image(); mi.src = asset(p.file); mi.alt = ""; mi.loading = "lazy";
    const cap = document.createElement("figcaption"); cap.textContent = p.isToday ? "Tonight" : p.date.getDate();
    f.append(mi, cap);
    strip.append(f);
  }
  requestAnimationFrame(() => {
    const on = strip.querySelector(".on");
    if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
  });

  $("dayDo").innerHTML = d.vara.favoured.map(t => `<li>${t}</li>`).join("");
  $("dayDont").innerHTML = d.vara.held.map(t => `<li>${t}</li>`).join("");
}

/* ---------- ACT 8 — the long periods --------------------------------- */
{
  const mahas = SAMPLE.dasha.mahadashas;
  const t0 = new Date(mahas[0].start).getTime(), t1 = new Date(mahas.at(-1).end).getTime();
  const river = $("river");
  for (const m of mahas) {
    const e = document.createElement("div");
    e.className = "era"; e.dataset.lord = m.lord; e.title = `${m.lord} mahadasha`;
    e.style.width = (new Date(m.end) - new Date(m.start)) / (t1 - t0) * 100 + "%";
    const ei = new Image(); ei.src = art(m.lord); ei.alt = ""; e.append(ei);
    river.append(e);
  }
  $("perTicks").innerHTML = [mahas[0], mahas[3], mahas[6]].map(m => `<span>${m.start.slice(0, 4)}</span>`).join("")
    + `<span>${mahas.at(-1).end.slice(0, 4)}</span>`;

  const setF = f => {
    const t = t0 + f * (t1 - t0);
    const m = mahas.find(m => t >= +new Date(m.start) && t < +new Date(m.end)) ?? mahas.at(-1);
    const a = m.antardashas.find(a => t >= +new Date(a.start) && t < +new Date(a.end)) ?? m.antardashas[0];
    $("perLord").textContent = `${m.lord} mahadasha`;
    $("perSpan").textContent = `${fmtDate(m.start)} → ${fmtDate(m.end)} · ${m.years} years · within it, ${a.lord} until ${fmtDate(a.end)}`;
    $("perCursor").style.left = (f * 100).toFixed(2) + "%";
    river.querySelectorAll(".era").forEach(e => e.classList.toggle("on", e.dataset.lord === m.lord));
  };
  setF(.02);

  /* the river fills as the act crosses the screen; the range input stays for
     keyboard and for anyone who has asked for less motion */
  const range = $("perRange");
  range.addEventListener("input", e => setF(e.target.value / 1000));
  if (!reduce) {
    const sec = $("periods");
    addEventListener("scroll", () => {
      const r = sec.getBoundingClientRect();
      const p = (innerHeight - r.top) / (innerHeight + r.height);
      if (p >= 0 && p <= 1) { const f = Math.max(.02, Math.min(.98, (p - .15) / .7)); setF(f); range.value = f * 1000; }
    }, { passive: true });
  } else range.classList.remove("sr");
}

/* ---------- ACT 9 — the relationship cover uses two real charts ------- */
{
  const a = $("pairA"), b = $("pairB");
  renderChart(a, SAMPLE, { assets: "assets", size: "small" }); a.classList.add("on-paper");
  const second = castChart(new Date(+new Date(SAMPLE.moment.iso) + 6 * 3600e3), 28.6139, 77.209);
  renderChart(b, second, { assets: "assets", size: "small" }); b.classList.add("on-paper");
}

/* ---------- ACT 10 — the free chart ---------------------------------- */
{
  renderChart($("emptyChart"), { lagna: SAMPLE.lagna, houses: SAMPLE.houses, planets: [] }, { assets: "assets" });
  const place = $("fPlace"), suggest = $("suggest"), status = $("status");
  let picked = null, timer = 0;
  const say = (m) => { status.textContent = m; };

  place.addEventListener("input", () => {
    picked = null; clearTimeout(timer);
    const q = place.value.trim();
    if (q.length < 2) { suggest.hidden = true; return; }
    timer = setTimeout(async () => {
      try {
        const list = await geocode(q);
        suggest.replaceChildren();
        suggest.hidden = !list.length;
        for (const p of list) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.append(p.name);
          const s = document.createElement("small");
          s.textContent = [p.admin, p.country].filter(Boolean).join(", ");
          btn.append(s);
          btn.onclick = () => { picked = p; place.value = `${p.name}, ${p.country}`; suggest.hidden = true;
            say(`${p.name} · ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}° · ${p.tz}`); };
          suggest.append(btn);
        }
      } catch { say("Could not look that place up. Check your connection and try again."); }
    }, 260);
  });
  document.addEventListener("click", e => { if (!suggest.contains(e.target) && e.target !== place) suggest.hidden = true; });

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const d = $("fDate").value, t = $("fTime").value;
    if (!d || !t) return say("We need both the date and the time of birth.");
    if (!picked) {
      const list = place.value.trim().length > 1 ? await geocode(place.value.trim()).catch(() => []) : [];
      if (!list.length) return say("Pick your birthplace from the list, so we know where the sky was.");
      picked = list[0];
    }
    say("");
    show(castChart(utcFromLocal(d, t, picked.tz), picked.lat, picked.lon),
         { name: $("fName").value.trim(), when: `${d} ${t}`, place: picked });
  });

  function show(chart, meta) {
    const res = $("result");
    const who = meta.name ? `${meta.name}'s chart` : "Your chart";
    res.replaceChildren();

    const hold = document.createElement("div");
    hold.className = "chart-hold";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", `${who}. Each planet is a button.`);
    hold.append(svg);

    const line = document.createElement("p");
    line.className = "fine";
    line.textContent = `${who} · ${meta.when} · ${meta.place.name} · ${chart.lagna.signName} rising · Lahiri`;

    const grid = document.createElement("div");
    grid.className = "facts";
    const add = (k, v) => { const f = document.createElement("div"); f.className = "fact";
      const a = document.createElement("span"); a.textContent = k;
      const b = document.createElement("b"); b.textContent = v; f.append(a, b); grid.append(f); };
    add("Ascendant", `${chart.lagna.signName} · ${chart.lagna.sanskrit} · lord ${chart.lagna.lord}`);
    if (chart.now) { add("Today's period", `${chart.now.maha.lord} mahadasha`);
      add("Within it", `${chart.now.antar.lord} until ${fmtDate(chart.now.antar.end)}`); }

    const plain = document.createElement("p");
    plain.className = "plain";
    plain.textContent = "Tap a planet, here or in the chart, to read what it carries.";

    const list = document.createElement("div");
    list.className = "placements";

    const select = p => {
      focusPlanet(svg, p);
      plain.textContent = `${PLAIN[p.graha]} Here it sits in the ${ORD(p.house)} house, in ${p.signName} (${p.sanskrit}), in ${p.nakshatra} nakshatra, pada ${p.pada}.`;
      list.querySelectorAll(".pl").forEach(el => el.classList.toggle("on", el.dataset.g === p.graha));
    };

    for (const p of chart.planets) {
      const row = document.createElement("button");
      row.type = "button"; row.className = "pl"; row.dataset.g = p.graha;
      const img = document.createElement("img"); img.src = art(p.graha); img.alt = "";
      const mid = document.createElement("div");
      const b = document.createElement("b"); b.textContent = p.graha;
      if (p.retro) { const r = document.createElement("span"); r.className = "rr"; r.textContent = "R"; b.append(r); }
      const s = document.createElement("span");
      s.textContent = `${p.signName} ${fmtDeg(p.deg)} · ${p.nakshatra} ${p.pada}${p.dignity ? " · " + p.dignity : ""}`;
      mid.append(b, s);
      const h = document.createElement("span"); h.className = "h"; h.textContent = `${ORD(p.house)} house`;
      row.append(img, mid, h);
      row.onclick = () => select(p);
      list.append(row);
    }

    /* the free report by email — not wired yet, and the page says exactly that */
    const box = document.createElement("form");
    box.className = "email";
    const bt = document.createElement("b"); bt.textContent = "Want the sixteen-page Kundali Report?";
    const bs = document.createElement("p"); bs.className = "fine";
    bs.textContent = "No sign-up. No card. It arrives in your inbox and your details are deleted afterwards.";
    const send = document.createElement("div"); send.className = "send";
    const inp = document.createElement("input");
    inp.type = "email"; inp.required = true; inp.placeholder = "you@example.com";
    inp.setAttribute("aria-label", "Email");
    inp.style.cssText = "height:50px;border-radius:12px;border:1px solid var(--hair);background:rgba(255,255,255,.05);padding:0 15px;font-size:16px;color:var(--paper)";
    const go = document.createElement("button"); go.className = "btn"; go.type = "submit"; go.textContent = "Send it";
    send.append(inp, go);
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "Preview build · delivery connects at launch";
    const st = document.createElement("p"); st.className = "status"; st.setAttribute("aria-live", "polite");
    box.append(bt, bs, send, tag, st);
    box.addEventListener("submit", ev => { ev.preventDefault();
      st.textContent = "This is the preview build: email delivery is connected when the apps launch. Nothing was sent."; });

    res.append(hold, line, grid, plain, list, box);
    renderChart(svg, chart, { assets: "assets", interactive: true, onSelect: select });
    res.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

/* ---------- the waitlist --------------------------------------------- */
$("wlForm").addEventListener("submit", e => {
  e.preventDefault();
  $("wlStatus").textContent = "Preview build: the waitlist is connected before the site goes live. Nothing was sent.";
});
