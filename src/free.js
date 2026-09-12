/* ==========================================================================
   The free Kundali.

   Date, time, place and an email in. The chart is cast on this device by the
   same engine the app runs (kundali.js → vendor/astro) — proof that it was —
   and the sixteen-page report goes to the inbox. The chart itself is shown in
   the app, where signing in with the same email finds it already waiting.
   Only the birthplace is looked up online, to turn its name into coordinates.
   Email delivery is not connected yet, and the page says so.
   ========================================================================== */
import { castChart, geocode, utcFromLocal } from "./kundali.js";
import { asset } from "./asset.js";

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls;
  if (text != null) n.textContent = text; return n; };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function freeKundali(root) {
  const $ = s => root.querySelector(s);
  const form = $("#freeForm"), place = $("#fPlace"), suggest = $("#suggest"), status = $("#fStatus"), result = $("#freeResult");
  const what = result.firstElementChild;
  const storeRow = what.querySelector(".store-row");

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
    const name = $("#fName").value.trim(), d = $("#fDate").value, t = $("#fTime").value, mail = $("#fMail").value.trim();
    if (!name) return say("We need the name to print on the report.");
    if (!d || !t) return say("We need both the date and the time of birth.");
    if (!picked) {
      const list = place.value.trim().length > 1 ? await geocode(place.value.trim()).catch(() => []) : [];
      if (!list.length) return say("Pick your birthplace from the list, so we know where the sky was.");
      picked = list[0];
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return say("We need an email to send the report to.");
    say("");
    const chart = castChart(utcFromLocal(d, t, picked.tz), picked.lat, picked.lon);
    show(chart, { name, place: picked, mail });
  });

  /* what the visitor sees once it is cast: that it WAS cast — one true line from the
     chart — and where the rest of it goes */
  function show(chart, meta) {
    const moon = chart.planets.find(p => p.graha === "Moon");
    const card = el("div", "fr-done");
    const seal = el("div", "fr-seal");
    const im = new Image(); im.src = asset(`assets/graha/${moon.graha.toLowerCase()}.png`); im.alt = "";
    seal.append(im);
    card.append(seal,
      el("b", null, `${meta.name}'s Kundali is cast.`),
      el("p", "fr-cast", `${chart.lagna.signName} rising · Moon in ${moon.nakshatra} · ${chart.now ? chart.now.maha.lord + " mahadasha" : ""}`.replace(/ · $/, "")),
      el("p", null, `The sixteen-page report is on its way to ${meta.mail}. Sign in to the app with the same email and the whole chart is already there.`),
      el("span", "fr-tag", "Preview build · delivery connects at launch"));
    card.append(storeRow.cloneNode(true));
    result.replaceChildren(card);
    result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }
}
