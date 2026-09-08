/* The free Kundali: computed in the visitor's browser by the same engine the app uses.
   No sign-in, nothing sent to a server — the ephemeris, cusps and dasha modules are the
   modules are vendored under website/vendor/astro so the dev server can be scoped to
   website/ alone; website/tools/sync-engine.mjs copies them byte for byte from
   supabase/functions/_shared/astro and fails the build if that copy ever drifts. */
import { positions, retrograde } from "../vendor/astro/ephemeris.js";
import { placidusCusps } from "../vendor/astro/cusps.js";
import { vimshottari } from "../vendor/astro/dasha3.js";

export const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
export const SANSKRIT = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya","Tula","Vrischika","Dhanu","Makara","Kumbha","Meena"];
export const NAKS = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha","Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
export const SIGN_LORD = {1:"Mars",2:"Venus",3:"Mercury",4:"Moon",5:"Sun",6:"Mercury",7:"Venus",8:"Mars",9:"Jupiter",10:"Saturn",11:"Saturn",12:"Jupiter"};
const GRAHAS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];
const EXALT = {Sun:1,Moon:2,Mars:10,Mercury:6,Jupiter:4,Venus:12,Saturn:7};
const DEBIL = {Sun:7,Moon:8,Mars:4,Mercury:12,Jupiter:10,Venus:6,Saturn:1};
const OWN = {Sun:[5],Moon:[4],Mars:[1,8],Mercury:[3,6],Jupiter:[9,12],Venus:[2,7],Saturn:[10,11]};
const norm = d => ((d % 360) + 360) % 360;
const signOf = L => Math.floor(norm(L) / 30) + 1;

/* One plain sentence per graha for the web. Traditional associations only — no
   certainty, no outcomes (constitution §51, §143). */
export const PLAIN = {
  Sun: "The Sun is traditionally read as vitality, purpose and the self you show the world.",
  Moon: "The Moon is read as the mind and its moods — how you feel your way through a day.",
  Mars: "Mars is associated with drive, courage and the energy to act.",
  Mercury: "Mercury is associated with speech, learning and the way you connect ideas.",
  Jupiter: "Jupiter is read as wisdom, growth and what you come to believe.",
  Venus: "Venus is associated with love, beauty and what you take pleasure in.",
  Saturn: "Saturn is read as discipline, patience and structure built over time.",
  Rahu: "Rahu, the north node, is associated with appetite, novelty and the unfamiliar.",
  Ketu: "Ketu, the south node, is associated with detachment and what already feels known."
};

/* local birth time → UTC, using the browser's own knowledge of the zone's history */
export function utcFromLocal(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) {
    const off = offsetAt(new Date(guess), tz);
    const next = Date.UTC(y, m - 1, d, hh, mm) - off * 60000;
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}
export function offsetAt(date, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  const p = Object.fromEntries(f.formatToParts(date).filter(x => x.type !== "literal").map(x => [x.type, +x.value]));
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/* A short list of cities that answers instantly and still works when the geocoder is
   unreachable (offline, or a page served under a strict content policy). */
export const CITIES = [
  ["Mumbai","Maharashtra","India",19.076,72.8777,"Asia/Kolkata"],["Delhi","Delhi","India",28.6139,77.209,"Asia/Kolkata"],
  ["Bengaluru","Karnataka","India",12.9716,77.5946,"Asia/Kolkata"],["Hyderabad","Telangana","India",17.385,78.4867,"Asia/Kolkata"],
  ["Chennai","Tamil Nadu","India",13.0827,80.2707,"Asia/Kolkata"],["Kolkata","West Bengal","India",22.5726,88.3639,"Asia/Kolkata"],
  ["Pune","Maharashtra","India",18.5204,73.8567,"Asia/Kolkata"],["Ahmedabad","Gujarat","India",23.0225,72.5714,"Asia/Kolkata"],
  ["Jaipur","Rajasthan","India",26.9124,75.7873,"Asia/Kolkata"],["Lucknow","Uttar Pradesh","India",26.8467,80.9462,"Asia/Kolkata"],
  ["Chandigarh","Chandigarh","India",30.7333,76.7794,"Asia/Kolkata"],["Kochi","Kerala","India",9.9312,76.2673,"Asia/Kolkata"],
  ["Varanasi","Uttar Pradesh","India",25.3176,82.9739,"Asia/Kolkata"],["Ujjain","Madhya Pradesh","India",23.1765,75.7885,"Asia/Kolkata"],
  ["Kathmandu","","Nepal",27.7172,85.324,"Asia/Kathmandu"],["Colombo","","Sri Lanka",6.9271,79.8612,"Asia/Colombo"],
  ["Dubai","","United Arab Emirates",25.2048,55.2708,"Asia/Dubai"],["Singapore","","Singapore",1.3521,103.8198,"Asia/Singapore"],
  ["London","England","United Kingdom",51.5074,-0.1278,"Europe/London"],["Paris","","France",48.8566,2.3522,"Europe/Paris"],
  ["Berlin","","Germany",52.52,13.405,"Europe/Berlin"],["Toronto","Ontario","Canada",43.6532,-79.3832,"America/Toronto"],
  ["New York","New York","United States",40.7128,-74.006,"America/New_York"],["Chicago","Illinois","United States",41.8781,-87.6298,"America/Chicago"],
  ["Houston","Texas","United States",29.7604,-95.3698,"America/Chicago"],["San Francisco","California","United States",37.7749,-122.4194,"America/Los_Angeles"],
  ["Los Angeles","California","United States",34.0522,-118.2437,"America/Los_Angeles"],["Seattle","Washington","United States",47.6062,-122.3321,"America/Los_Angeles"],
  ["Sydney","New South Wales","Australia",-33.8688,151.2093,"Australia/Sydney"],["Melbourne","Victoria","Australia",-37.8136,144.9631,"Australia/Melbourne"],
  ["Auckland","","New Zealand",-36.8485,174.7633,"Pacific/Auckland"],["Tokyo","","Japan",35.6762,139.6503,"Asia/Tokyo"],
  ["Nairobi","","Kenya",-1.2921,36.8219,"Africa/Nairobi"],["Johannesburg","Gauteng","South Africa",-26.2041,28.0473,"Africa/Johannesburg"],
  ["São Paulo","","Brazil",-23.5505,-46.6333,"America/Sao_Paulo"],["Mexico City","","Mexico",19.4326,-99.1332,"America/Mexico_City"]
].map(([name, admin, country, lat, lon, tz]) => ({ name, admin, country, lat, lon, tz }));

export async function geocode(q) {
  const local = CITIES.filter(c => c.name.toLowerCase().startsWith(q.toLowerCase()));
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    if (!r.ok) throw new Error("geocoding failed");
    const j = await r.json();
    const remote = (j.results || []).map(x => ({ name: x.name, admin: x.admin1, country: x.country, lat: x.latitude, lon: x.longitude, tz: x.timezone }));
    return remote.length ? remote : local;
  } catch (e) {
    if (local.length) return local;
    throw e;
  }
}

export function castChart(utc, lat, lon) {
  const pos = positions(utc), retro = retrograde(utc);
  const cusps = placidusCusps(utc, lat, lon);
  const lagna = signOf(cusps[0]);
  const planets = GRAHAS.map(g => {
    const L = norm(pos[g]), s = signOf(L), ni = Math.floor(L / (360 / 27));
    const pada = Math.floor((L % (360 / 27)) / (360 / 108)) + 1;
    const dignity = EXALT[g] === s ? "exalted" : DEBIL[g] === s ? "debilitated" : OWN[g]?.includes(s) ? "own sign" : null;
    return { graha: g, lon: L, sign: s, signName: SIGNS[s - 1], sanskrit: SANSKRIT[s - 1], deg: L % 30,
             house: ((s - lagna + 12) % 12) + 1, nakshatra: NAKS[ni], pada, retro: !!retro[g], dignity };
  });
  const houses = Array.from({ length: 12 }, (_, i) => { const s = ((lagna - 1 + i) % 12) + 1; return { house: i + 1, sign: s, signName: SIGNS[s - 1], sanskrit: SANSKRIT[s - 1], lord: SIGN_LORD[s] }; });
  const moon = planets.find(p => p.graha === "Moon");
  const dasha = vimshottari(moon.lon, utc);
  const now = dasha.at(new Date());
  return { lagna: { sign: lagna, signName: SIGNS[lagna - 1], sanskrit: SANSKRIT[lagna - 1], deg: norm(cusps[0]) % 30, lord: SIGN_LORD[lagna] },
           houses, planets, dasha, now };
}

export const fmtDeg = d => `${Math.floor(d)}°${String(Math.round((d % 1) * 60)).padStart(2, "0")}′`;
export const fmtDate = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* Today's sky laid into a fixed chart's houses. The birth chart never moves: the
   ascendant stays where it was, and the transiting grahas fall into whichever house
   their current sign occupies. This is what the Birth | Today switch swaps between. */
export function transitInto(date, lagnaSign) {
  const pos = positions(date), retro = retrograde(date);
  return GRAHAS.map(g => {
    const L = norm(pos[g]), s = signOf(L), ni = Math.floor(L / (360 / 27));
    return { graha: g, lon: L, sign: s, signName: SIGNS[s - 1], sanskrit: SANSKRIT[s - 1], deg: L % 30,
             house: ((s - lagnaSign + 12) % 12) + 1, nakshatra: NAKS[ni],
             pada: Math.floor((L % (360 / 27)) / (360 / 108)) + 1,
             retro: !!retro[g],
             dignity: EXALT[g] === s ? "exalted" : DEBIL[g] === s ? "debilitated" : OWN[g]?.includes(s) ? "own sign" : null };
  });
}

/* The visitor's own place, guessed from their time zone — no permission prompt, and
   named on screen so it can be corrected rather than assumed.

   Browsers still report plenty of historical zone aliases: a phone in India commonly
   says "Asia/Calcutta", not "Asia/Kolkata". Matching on the string alone silently sent
   those visitors to London and then rendered London's day in Indian clock time. So the
   match is: the exact name, then a known alias, and finally whichever city currently
   shares the visitor's real UTC offset. */
const TZ_ALIAS = {
  "Asia/Calcutta": "Asia/Kolkata", "Asia/Saigon": "Asia/Ho_Chi_Minh", "Asia/Katmandu": "Asia/Kathmandu",
  "Europe/Kiev": "Europe/Kyiv", "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Asia/Rangoon": "Asia/Yangon", "Pacific/Honolulu": "Pacific/Honolulu", "US/Eastern": "America/New_York",
  "US/Pacific": "America/Los_Angeles", "US/Central": "America/Chicago", "Europe/Belfast": "Europe/London",
  "Asia/Dacca": "Asia/Dhaka", "Atlantic/Faeroe": "Atlantic/Faroe"
};

export function guessPlace(now = new Date()) {
  const raw = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = TZ_ALIAS[raw] ?? raw;
  const exact = CITIES.find(c => c.tz === tz);
  if (exact) return exact;
  try {
    const mine = offsetAt(now, raw);
    const near = CITIES.filter(c => offsetAt(now, c.tz) === mine);
    if (near.length) return near[0];
  } catch { /* an unknown zone name: fall through */ }
  return CITIES.find(c => c.name === "London");
}
