/* ==========================================================================
   The free Kundali.

   Date, time and place in; the chart out — cast on this device by the same
   engine the app runs (kundali.js → vendor/astro). Only the birthplace is
   looked up online, to turn its name into coordinates and a time zone. The
   sixteen-page PDF by email is not connected yet, and the page says so.
   ========================================================================== */
import { castChart, geocode, utcFromLocal, PLAIN, fmtDeg, fmtDate } from "./kundali.js";
import { renderChart, focusPlanet } from "./chart.js";
import { asset } from "./asset.js";

const ORD = n => n + (["th","st","nd","rd"][(n % 100 - 20) % 10] || ["th","st","nd","rd"][n % 100] || "th");
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
  if (text != null) n.textContent = text; return n; };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function freeKundali(root, sample) {
  const $ = s => root.querySelector(s);
  const form = $("#freeForm"), place = $("#fPlace"), suggest = $("#suggest"), status = $("#fStatus"), result = $("#freeResult");
  renderChart($("#emptyChart"), { lagna: sample.lagna, houses: sample.houses, planets: [] }, { assets: "assets" });

  let picked = null, timer = 0;
  const say = m => { status.textContent = m; };

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
          const b = el("button"); b.type = "button";
          b.append(p.name, el("small", null, [p.admin, p.country].filter(Boolean).join(", ")));
          b.onclick = () => { picked = p; place.value = `${p.name}, ${p.country}`; suggest.hidden = true;
            say(`${p.name} · ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}° · ${p.tz}`); };
          suggest.append(b);
        }
      } catch { say("Could not look that place up. Check your connection and try again."); }
    }, 260);
  });
  document.addEventListener("click", e => { if (!suggest.contains(e.target) && e.target !== place) suggest.hidden = true; });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const d = $("#fDate").value, t = $("#fTime").value;
    if (!d || !t) return say("We need both the date and the time of birth.");
    if (!picked) {
      const list = place.value.trim().length > 1 ? await geocode(place.value.trim()).catch(() => []) : [];
      if (!list.length) return say("Pick your birthplace from the list, so we know where the sky was.");
      picked = list[0];
    }
    say("");
    show(castChart(utcFromLocal(d, t, picked.tz), picked.lat, picked.lon),
         { name: $("#fName").value.trim(), when: `${d} ${t}`, place: picked });
  });

  function show(chart, meta) {
    const who = meta.name ? `${meta.name}'s chart` : "Your chart";
    result.replaceChildren();
    result.classList.add("has");

    const hold = el("div", "fr-chart");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("role", "group"); svg.setAttribute("aria-label", `${who}. Each planet is a button.`);
    hold.append(svg);

    const line = el("p", "fr-line", `${who} · ${meta.when} · ${meta.place.name} · ${chart.lagna.signName} rising · Lahiri`);

    const facts = el("div", "fr-facts");
    const add = (k, v) => { const f = el("div"); f.append(el("span", null, k), el("b", null, v)); facts.append(f); };
    add("Ascendant", `${chart.lagna.signName} · ${chart.lagna.sanskrit} · lord ${chart.lagna.lord}`);
    if (chart.now) { add("Today's period", `${chart.now.maha.lord} mahadasha`);
      add("Within it", `${chart.now.antar.lord} until ${fmtDate(chart.now.antar.end)}`); }

    const plain = el("p", "fr-plain", "Tap a planet, here or in the chart, to read what it carries.");
    const list = el("div", "fr-list");
    const select = p => {
      focusPlanet(svg, p);
      plain.textContent = `${PLAIN[p.graha]} Here it sits in the ${ORD(p.house)} house, in ${p.signName} (${p.sanskrit}), in ${p.nakshatra} nakshatra, pada ${p.pada}.`;
      list.querySelectorAll(".fr-pl").forEach(x => x.classList.toggle("on", x.dataset.g === p.graha));
    };
    for (const p of chart.planets) {
      const row = el("button", "fr-pl"); row.type = "button"; row.dataset.g = p.graha;
      const img = new Image(); img.src = asset(`assets/graha/${p.graha.toLowerCase()}.png`); img.alt = "";
      const mid = el("div");
      const b = el("b", null, p.graha); if (p.retro) b.append(el("span", "rr", "R"));
      mid.append(b, el("span", null, `${p.signName} ${fmtDeg(p.deg)} · ${p.nakshatra} ${p.pada}${p.dignity ? " · " + p.dignity : ""}`));
      row.append(img, mid, el("span", "h", `${ORD(p.house)} house`));
      row.onclick = () => select(p);
      list.append(row);
    }

    /* the free report by email — not wired yet, and the page says exactly that */
    const box = el("form", "fr-email");
    const send = el("div", "send");
    const inp = el("input"); inp.type = "email"; inp.required = true; inp.placeholder = "you@example.com"; inp.setAttribute("aria-label", "Email");
    const go = el("button", "btn", "Send it"); go.type = "submit";
    send.append(inp, go);
    const st = el("p", "fr-status"); st.setAttribute("aria-live", "polite");
    box.append(el("b", null, "Want the sixteen-page Kundali Report?"),
      el("p", null, "No sign-up. No card. It arrives in your inbox and your details are deleted afterwards."),
      send, el("span", "fr-tag", "Preview build · delivery connects at launch"), st);
    box.addEventListener("submit", ev => { ev.preventDefault();
      st.textContent = "This is the preview build: email delivery is connected when the apps launch. Nothing was sent."; });

    result.append(hold, line, facts, plain, list, box);
    renderChart(svg, chart, { assets: "assets", interactive: true, onSelect: select });
    result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}
