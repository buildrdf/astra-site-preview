/* ===================================================================
   ZODIAC GRIDS — the two coordinate systems laid over one sidereal
   circle, derived from longitude and nothing else.

     12 rashis      x 30°      = 360°
     27 nakshatras  x 13°20′   = 360°
     4 padas each   x 3°20′    = 13°20′

   A point is stored as a longitude; sign, nakshatra and pada are
   derived from it here (spec parts 2-3, 48). Ranges are half-open
   [start, end) with the last wrapping to 360. Every screen that names
   a nakshatra or pada must come through this file (part 54).
   =================================================================== */

export const NAK_SPAN = 360 / 27;        /* 13°20′ */
export const PADA_SPAN = NAK_SPAN / 4;   /*  3°20′ */
const EPS = 1e-9;                        /* boundary arithmetic is exact in
                                            decimal, not in binary */
export const norm = d => ((d % 360) + 360) % 360;

export const SIGN_NAMES = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
export const SIGN_SANSKRIT = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
  "Tula","Vrishchika","Dhanu","Makara","Kumbha","Meena"];
export const SIGN_LORDS = ["Mars","Venus","Mercury","Moon","Sun","Mercury",
  "Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
export const SIGN_ELEMENT = ["Fire","Earth","Air","Water","Fire","Earth",
  "Air","Water","Fire","Earth","Air","Water"];
export const SIGN_MODALITY = ["Movable","Fixed","Dual","Movable","Fixed","Dual",
  "Movable","Fixed","Dual","Movable","Fixed","Dual"];

/* Nakshatra reference: Vimshottari lord follows the classical cycle
   from Ketu at Ashwini. Deity and symbol are the widely attested
   Parashari / Hora Sastra associations; meanings are traditional
   keywords, hedged in the UI as associations rather than verdicts. */
export const NAK_META = [
  {n:"Ashwini",         deity:"The Ashvini Kumaras",   symbol:"a horse's head",            means:"speed, healing, fresh starts"},
  {n:"Bharani",         deity:"Yama",                  symbol:"the yoni",                   means:"bearing, restraint, transformation"},
  {n:"Krittika",        deity:"Agni",                  symbol:"a razor or flame",           means:"sharpness, purification, cutting through"},
  {n:"Rohini",          deity:"Brahma (Prajapati)",    symbol:"a cart or chariot",          means:"growth, fertility, beauty, abundance"},
  {n:"Mrigashira",      deity:"Soma",                  symbol:"a deer's head",              means:"searching, curiosity, gentle restlessness"},
  {n:"Ardra",           deity:"Rudra",                 symbol:"a teardrop or gem",          means:"storms, clearing, feeling deeply"},
  {n:"Punarvasu",       deity:"Aditi",                 symbol:"a bow and quiver",           means:"return, renewal, safe homecoming"},
  {n:"Pushya",          deity:"Brihaspati",            symbol:"a cow's udder or flower",    means:"nourishment, care, steady support"},
  {n:"Ashlesha",        deity:"The Nagas",             symbol:"a coiled serpent",           means:"insight, entwining, hidden depth"},
  {n:"Magha",           deity:"The Pitris",            symbol:"a throne or palanquin",      means:"ancestry, authority, inheritance"},
  {n:"Purva Phalguni",  deity:"Bhaga",                 symbol:"the front legs of a bed",    means:"pleasure, rest, creative enjoyment"},
  {n:"Uttara Phalguni", deity:"Aryaman",               symbol:"the back legs of a bed",     means:"patronage, contracts, kindness that lasts"},
  {n:"Hasta",           deity:"Savitr",                symbol:"a hand",                     means:"skill, craft, dexterity"},
  {n:"Chitra",          deity:"Tvashtar (Vishvakarma)",symbol:"a bright jewel",             means:"design, brilliance, making things beautiful"},
  {n:"Swati",           deity:"Vayu",                  symbol:"a young shoot in the wind",  means:"independence, movement, flexibility"},
  {n:"Vishakha",        deity:"Indra and Agni",        symbol:"a triumphal archway",        means:"purpose, ambition, the fork in the road"},
  {n:"Anuradha",        deity:"Mitra",                 symbol:"a lotus",                    means:"friendship, devotion, loyalty"},
  {n:"Jyeshtha",        deity:"Indra",                 symbol:"an earring or umbrella",     means:"seniority, protection, hard-won authority"},
  {n:"Mula",            deity:"Nirriti",               symbol:"a bundle of roots",          means:"roots, uprooting, getting to the bottom of things"},
  {n:"Purva Ashadha",   deity:"Apas (the Waters)",     symbol:"an elephant's tusk or fan",  means:"invincibility, early victory, purification"},
  {n:"Uttara Ashadha",  deity:"The Vishvedevas",       symbol:"an elephant's tusk",         means:"lasting victory, principle, endurance"},
  {n:"Shravana",        deity:"Vishnu",                symbol:"an ear, or three footprints",means:"listening, learning, connection"},
  {n:"Dhanishta",       deity:"The eight Vasus",       symbol:"a drum",                     means:"rhythm, wealth, generosity"},
  {n:"Shatabhisha",     deity:"Varuna",                symbol:"an empty circle",            means:"healing, secrecy, the hundred physicians"},
  {n:"Purva Bhadrapada",deity:"Aja Ekapada",           symbol:"a sword, or a funeral cot's front legs", means:"intensity, transformation, fierce idealism"},
  {n:"Uttara Bhadrapada",deity:"Ahir Budhnya",         symbol:"the back legs of a funeral cot, or a deep-sea serpent", means:"depth, stability, wisdom in stillness"},
  {n:"Revati",          deity:"Pushan",                symbol:"a fish, or a drum",          means:"safe passage, nourishment, journeys' end"}
];
const LORD_CYCLE = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
export const NAK_NAMES = NAK_META.map(m => m.n);
export const nakLord = i => LORD_CYCLE[i % 9];

export const nakIndex = L => Math.min(26, Math.floor(norm(L) / NAK_SPAN + EPS));
/* measured from the nakshatra's own start, never via `%` - the binary
   remainder of 120 % 13.33.. is 13.33..25, which is pada 4, not 1 */
export const padaIndex = L => {
  const Ln = norm(L), inNak = Ln - nakIndex(Ln) * NAK_SPAN;
  return Math.min(4, Math.floor(inNak / PADA_SPAN + EPS) + 1);
};
export const signIndex = L => Math.min(11, Math.floor(norm(L) / 30 + EPS));

/* Everything a point is, from its longitude alone. */
export function pointGrid(L) {
  const Ln = norm(L);
  const s = signIndex(Ln), n = nakIndex(Ln), p = padaIndex(Ln);
  return {
    longitude: Ln,
    sign: s + 1, signName: SIGN_NAMES[s], degInSign: Ln - s * 30,
    nak: n, nakName: NAK_NAMES[n], degInNak: Ln - n * NAK_SPAN,
    pada: p, lord: nakLord(n)
  };
}

/* The nakshatra's range, its four padas and which sign each pada
   belongs to - the fact that some straddle two signs is the lesson. */
export function nakshatraRange(i) {
  const start = i * NAK_SPAN, end = (i + 1) * NAK_SPAN;
  const padas = [0, 1, 2, 3].map(k => {
    const a = start + k * PADA_SPAN, b = a + PADA_SPAN;
    return { pada: k + 1, start: a, end: b, sign: signIndex(a + EPS * 10) + 1 };
  });
  const signs = [...new Set(padas.map(p => p.sign))];
  return { index: i, name: NAK_NAMES[i], start, end, padas, signs, straddles: signs.length > 1 };
}

/* Which nakshatra portions a sign holds - the Part-33 table, derived. */
export function signNakshatras(sign) {
  const a = (sign - 1) * 30, b = sign * 30, out = [];
  for (let i = 0; i < 27; i++) {
    const r = nakshatraRange(i);
    const padas = r.padas.filter(p => p.start + EPS >= a && p.end - EPS <= b).map(p => p.pada);
    if (padas.length) out.push({ index: i, name: r.name, padas,
      from: Math.max(r.start, a), to: Math.min(r.end, b) });
  }
  return out;
}

/* ONE ROUNDING CONVENTION FOR THE WHOLE APP.
   There were two: this rounded the minutes while app.js's fmtDeg floored them, so the same
   Sun read 12°02′ in its detail and 12°01′ in the chart and index (Codex review, 9 Sep).
   Rounding is the better convention — it is nearer the truth — but it must CARRY, or
   12.9999° prints as "12°60′", which this did.
   `capDeg` exists for degree-within-a-sign, where a carry to 30°00′ would name a position
   that cannot occur inside a sign; there the display holds at 29°59′ rather than claim the
   next sign. The sign itself is always taken from the unrounded longitude. */
export function dmsParts(deg, capDeg) {
  let t = Math.round(deg * 60);                       /* total minutes, rounded once */
  let d = Math.floor(t / 60), m = t - d * 60;
  if (capDeg != null && d >= capDeg) { d = capDeg - 1; m = 59; }
  return { d, m };
}
export function fmtDMS(deg) {
  const { d, m } = dmsParts(deg);
  return `${d}°${String(m).padStart(2, "0")}′`;
}
