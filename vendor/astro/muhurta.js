/* ====================================================================
   MUHURTA — searching a window for the moments the tradition favours
   --------------------------------------------------------------------
   THE RULE THAT SHAPES EVERYTHING HERE: over a window of days or weeks,
   almost nothing in a chart moves. Measured from our own ephemeris, Jupiter
   holds a sign for 11.8 months and Saturn for 2.44 years; even the Moon, the
   quickest graha, holds one for 2.3 days. What actually changes is the LAGNA
   — the sign rising on the eastern horizon — and at Bengaluru it moves a
   degree every 4.2 minutes and changes sign 11 times a day. So a muhurta
   search is really a search over the lagna, and the useful step is minutes,
   not hours. (tools/validate_muhurta.mjs measures both and fails if this
   stops being true.)

   WHAT THIS IS NOT. It does not predict outcomes and must never be made to.
   Every point below is a NAMED classical rule, carried with the score, so a
   person reads "Vishti karana runs" and not a number out of a black box.
   Where the schools differ the note says so. Childbirth is scored inside a
   window the DOCTOR has given — the medical decision is never ours.
   ==================================================================== */
import { positions } from "./ephemeris.js";
import { limbs, vara, taraBala, houseFrom } from "./panchang.js";
import { ascendant, sunTimes } from "./sky.js";
import { dignityOf } from "./dignity.js";

const norm = d => ((d % 360) + 360) % 360;
const signOf = L => Math.floor(norm(L) / 30);              /* 0..11 */
const nakOf  = L => Math.floor(norm(L) / (360 / 27));      /* 0..26 */
const ord = n => n + (["th","st","nd","rd"][(n % 100 >> 3 ^ 1) && n % 10] || "th");

export const NAK = ["Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu",
  "Pushya","Ashlesha","Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati",
  "Vishakha","Anuradha","Jyeshtha","Moola","Purvashadha","Uttarashadha","Shravana","Dhanishta",
  "Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"];
export const SIGN = ["Mesha","Vrishabha","Mithuna","Karka","Simha","Kanya",
  "Tula","Vrischika","Dhanu","Makara","Kumbha","Meena"];

/* The seven classical nakshatra classes (Muhurta Chintamani). Each purpose
   below names the classes it wants; nothing is invented. */
const NAK_CLASS = {
  Dhruva:  [3,11,20,25],                 /* fixed — building, planting, anything meant to last */
  Chara:   [6,14,21,22,23],              /* movable — travel, vehicles, trade journeys */
  Mridu:   [4,13,16,26],                 /* soft — marriage, ornament, the arts */
  Kshipra: [0,7,12],                     /* swift — commerce, medicine, learning */
  Ugra:    [1,9,10,19,24],               /* fierce — set aside for auspicious beginnings */
  Tikshna: [5,8,17,18],                  /* sharp — set aside */
  Mishra:  [2,15],                       /* mixed */
};
const classOf = n => Object.keys(NAK_CLASS).find(k => NAK_CLASS[k].includes(n)) || "Mishra";
/* what each class is held to suit — the Moon's star colours the whole moment */
const CLASS_IS = {
  Dhruva:"fixed stars, held to suit what is meant to last — building, planting, taking office",
  Chara:"movable stars, held to suit motion — journeys, vehicles, anything that travels",
  Mridu:"soft stars, held to suit gentleness — marriage, ornament, the arts, friendship",
  Kshipra:"swift stars, held to suit quickness — trade, medicine, learning, anything begun lightly",
  Ugra:"fierce stars, which the tradition keeps for hard undertakings and away from auspicious beginnings",
  Tikshna:"sharp stars, which the tradition keeps for severing and away from beginnings",
  Mishra:"mixed stars, read as ordinary — neither lent to this nor set against it",
};

/* the nine nitya yogas the tradition sets aside */
const YOGA_AVOID = new Set(["Vishkambha","Atiganda","Shula","Ganda","Vyaghata",
                            "Vajra","Vyatipata","Parigha","Vaidhriti"]);
const RIKTA = new Set(["Chaturthi","Navami","Chaturdashi"]);
const BENEFIC = new Set(["Jupiter","Venus","Mercury"]);
const MALEFIC = new Set(["Sun","Mars","Saturn","Rahu","Ketu"]);
const KENDRA = new Set([1,4,7,10]), TRIKONA = new Set([1,5,9]);
/* Rahu Kalam occupies one eighth of the daylight, by weekday (Sun..Sat) */
const RAHU_SEG = [8,2,7,5,6,4,3];
const GULIKA_SEG = [7,6,5,4,3,2,1];
const YAMA_SEG  = [5,4,3,2,1,7,6];

/* Gandanta: the seam where a water sign ends and a fire sign begins — the last
   3°20' of Karka, Vrischika, Meena and the first 3°20' of Simha, Dhanu, Mesha.
   Classically a knot; the tradition asks that beginnings avoid it. */
function gandanta(L){
  const s = signOf(L), d = norm(L) % 30;
  if ((s === 3 || s === 7 || s === 11) && d > 26.6667) return true;
  if ((s === 0 || s === 4 || s === 8)  && d < 3.3333)  return true;
  return false;
}

/* WHAT EACH GRAHA CARRIES, and what each house is about. A reason that names a graha
   now carries the graha with it, so the app can show its own body beside the line, and a
   second line saying what the tradition reads INTO that placement — Sangram, 9 Sep:
   "give the icon of Mercury, and say Mercury occupies this house. In the second line
   give the benefit." Kept to what the tradition holds, never to an outcome. */
export const KARAKA = {
  Sun:"authority, the father, and standing", Moon:"the mind, the mother, and comfort",
  Mars:"drive, land and courage", Mercury:"speech, accounts and agreements",
  Jupiter:"counsel, learning and expansion", Venus:"pleasure, beauty and partnership",
  Saturn:"labour, patience and what endures", Rahu:"appetite, novelty and the unfamiliar",
  Ketu:"detachment and what is already finished",
};
export const HOUSE_IS = {
  1:"the body and the beginning itself", 2:"wealth, family and speech",
  3:"effort, courage and the near journey", 4:"home, foundations and the mother",
  5:"children, learning and what you make", 6:"debts, illness and rivals",
  7:"partnership and the other person", 8:"what is hidden, and what is inherited",
  9:"fortune, the teacher and the long journey", 10:"work, standing and the public act",
  11:"gains and what comes in", 12:"loss, distant places and release",
};
const benefitOf = (g, h, good) => {
  if (!KARAKA[g] || !HOUSE_IS[h]) return null;
  return good
    ? `${g} carries ${KARAKA[g]}; in the ${ord(h)} the tradition reads that as lending itself to ${HOUSE_IS[h]}.`
    : `${g} carries ${KARAKA[g]}; in the ${ord(h)} the tradition reads it as pressing on ${HOUSE_IS[h]}.`;
};

export const PURPOSES = {
  childbirth: { label:"Birth of a child",
    note:"Scored only INSIDE the window your doctor has given you. The medical decision is theirs, never this app's.",
    want:["Dhruva","Mridu","Kshipra"], avoid:["Ugra","Tikshna"], nak:4,
    houses:{5:"the house of children", 1:"the rising sign itself", 9:"the house of fortune"},
    weights:{ lagnaStrength:4, moonStrength:2, gandanta:5, benKendra:3 } },
  business: { label:"Starting a business or launching",
    note:"Weighted toward the swift and the fixed stars, and toward clean 10th and 11th houses.",
    want:["Kshipra","Dhruva","Chara"], avoid:["Ugra","Tikshna"], nak:3,
    houses:{10:"the house of work and standing", 11:"the house of gains", 3:"the house of effort"},
    weights:{ lagnaStrength:2, moonStrength:2, gandanta:2, benKendra:3 } },
  marriage: { label:"Marriage",
    note:"Uses both partners' Moons for chandra bala and tara bala, as the tradition asks.",
    want:["Mridu","Dhruva"], avoid:["Ugra","Tikshna","Mishra"], nak:5,
    houses:{7:"the house of partnership", 2:"the house of family", 4:"the house of home"},
    weights:{ lagnaStrength:2, moonStrength:4, gandanta:5, benKendra:2 } },
  property: { label:"A home or property",
    note:"The fixed stars, and the 4th house of home and foundations.",
    want:["Dhruva","Mridu"], avoid:["Ugra","Tikshna"], nak:4,
    houses:{4:"the house of home and foundations", 2:"the house of holdings", 11:"the house of gains"},
    weights:{ lagnaStrength:2, moonStrength:2, gandanta:3, benKendra:2 } },
  purchase: { label:"A major purchase or investment",
    note:"The swift and movable stars, and a clean 2nd and 11th.",
    want:["Kshipra","Chara","Dhruva"], avoid:["Ugra","Tikshna"], nak:3,
    houses:{2:"the house of wealth", 11:"the house of gains", 10:"the house of standing"},
    weights:{ lagnaStrength:2, moonStrength:2, gandanta:2, benKendra:2 } },
  travel: { label:"A journey",
    note:"The movable stars; the tradition also watches the direction of travel, which this does not yet read.",
    want:["Chara","Kshipra","Mridu"], avoid:["Ugra","Tikshna"], nak:4,
    houses:{3:"the house of short journeys", 9:"the house of long journeys", 12:"the house of distant places"},
    weights:{ lagnaStrength:1, moonStrength:2, gandanta:2, benKendra:2 } },
};

/* ---- one moment, scored ------------------------------------------- */
export function scoreMoment(date, opts){
  const { lat, lon, purpose="business", natal=null, partner=null, day=null } = opts;
  const P = PURPOSES[purpose] || PURPOSES.business;
  const W = P.weights;
  const p = positions(date);
  const asc = ascendant(date, lat, lon);
  const ascSign = signOf(asc);
  const L = limbs(p.Sun, p.Moon);
  const V = vara(date);
  const moonNak = nakOf(p.Moon), moonSign = signOf(p.Moon);
  const cls = classOf(moonNak);
  const reasons = [];
  let s = 0;
  const add = (pts, text, extra) => { s += pts; reasons.push({ pts, text, ...(extra || {}) }); };

  /* --- the five limbs ------------------------------------------------ */
  if (L.karana.vishti) add(-5, "Vishti karana (Bhadra) runs — the tradition sets it aside for beginnings.");
  if (RIKTA.has(L.tithi.name)) add(-3, `${L.tithi.name} is a rikta tithi — traditionally empty-handed for beginnings.`);
  if (L.tithi.name === "Amavasya") add(-4, "Amavasya — the dark moon, kept for the ancestors rather than for beginnings.");
  if (YOGA_AVOID.has(L.yoga.name)) add(-3, `${L.yoga.name} yoga — one of the nine the tradition sets aside.`);
  if (BENEFIC.has(V.lord)) add(+1, `${V.name} belongs to ${V.lord}, a gentle day lord.`,
    { graha:V.lord, benefit:`The day itself is coloured by ${V.lord} — ${KARAKA[V.lord]}.` });
  else if (V.lord === "Saturn" || V.lord === "Mars") add(-1, `${V.name} belongs to ${V.lord} — workable, but weightier.`,
    { graha:V.lord, benefit:`The day is coloured by ${V.lord} — ${KARAKA[V.lord]} — which asks more of a beginning.` });

  /* --- the Moon's star, matched to the purpose ----------------------- */
  if (P.want.includes(cls)) add(+P.nak, `The Moon rides ${NAK[moonNak]}, a ${cls} star — the class this asks for.`,
    { graha:"Moon", benefit:`${cls} are the ${CLASS_IS[cls]}.` });
  else if (P.avoid.includes(cls)) add(-P.nak, `The Moon rides ${NAK[moonNak]}, a ${cls} star — set aside for this.`,
    { graha:"Moon", benefit:`${cls} are the ${CLASS_IS[cls]}.` });

  /* --- the seams ------------------------------------------------------ */
  if (gandanta(p.Moon)) add(-W.gandanta, "The Moon sits in gandanta, the seam between a water sign and a fire one.",
    { graha:"Moon", benefit:"A knot in the zodiac where one element ends and the next has not begun; the tradition asks beginnings to step over it." });
  if (gandanta(asc)) add(-W.gandanta, "The rising degree sits in gandanta.");

  /* --- the Moon's own condition -------------------------------------- */
  /* The tradition favours the WAXING half for beginnings — a Moon growing toward full, not
     one emptying toward the dark. An earlier version of this rule read the elongation alone
     and called a Krishna Panchami Moon "waxing past the first quarter": it was bright, but it
     was waning, and the text said the opposite of the truth. Paksha decides the direction;
     the elongation only decides whether there is enough light to lean on at all. */
  const elong = norm(p.Moon - p.Sun);
  const waxing = L.tithi.paksha === "Shukla";
  const MN = { graha:"Moon" };
  if (elong < 12 || elong > 348) add(-W.moonStrength, "The Moon is within twelve degrees of the Sun — dark, and weak to lean on.",
    { ...MN, benefit:"The Moon carries the mind and its comfort; close to the Sun it is burnt, and the tradition asks for a brighter one." });
  else if (waxing && L.tithi.inPaksha >= 5) add(+W.moonStrength, `The Moon is waxing — ${L.tithi.paksha} ${L.tithi.name}, growing toward full.`,
    { ...MN, benefit:"A growing Moon is the tradition's own image of a thing that grows after it begins." });
  else if (waxing) add(+W.moonStrength * 0.4, `The Moon is waxing, though still thin — ${L.tithi.paksha} ${L.tithi.name}.`,
    { ...MN, benefit:"Growing, but young — the direction is right and the light is not yet full." });
  else if (L.tithi.inPaksha >= 10) add(-W.moonStrength * 0.6, `The Moon is emptying toward the dark — ${L.tithi.paksha} ${L.tithi.name}.`,
    { ...MN, benefit:"A waning Moon is held to suit endings and clearing rather than beginnings." });

  /* --- the rising sign and who sits in the angles --------------------- */
  const houseOfL = Lx => houseFrom(ascSign + 1, signOf(Lx) + 1);
  let benK = 0, malL = 0;
  for (const g of ["Jupiter","Venus","Mercury"]) { const h = houseOfL(p[g]); if (KENDRA.has(h) || TRIKONA.has(h)) benK++; }
  for (const g of ["Mars","Saturn","Rahu","Ketu","Sun"]) { const h = houseOfL(p[g]); if (h === 1) malL++; }
  const benNames = ["Jupiter","Venus","Mercury"].filter(g => { const h = houseOfL(p[g]); return KENDRA.has(h) || TRIKONA.has(h); });
  const malNames = ["Mars","Saturn","Rahu","Ketu","Sun"].filter(g => houseOfL(p[g]) === 1);
  if (benK) add(+Math.min(W.benKendra, benK * 1.5),
    `${benNames.join(" and ")} ${benK===1?"stands":"stand"} in an angle or trine from the rising sign.`,
    { graha:benNames[0], benefit:`The angles and trines are the chart's strong seats; a benefic in one lends ${benNames.map(g=>KARAKA[g]).join(", and ")} to the whole moment.` });
  if (malL) add(-malL * 1.5, `${malNames.join(" and ")} ${malL===1?"sits":"sit"} in the rising sign itself.`,
    { graha:malNames[0], benefit:`The rising sign is the body of the moment; ${malNames.join(" and ")} sitting there presses on it from the start.` });
  /* THE HOUSES THIS PURPOSE WATCHES. This is what makes one purpose differ from another —
     without it every purpose converges on whatever moment has the cleanest panchanga, and the
     picker is theatre. A benefic standing in the house the matter belongs to is a point for it;
     a malefic there is a point against. Ordinary classical practice. */
  for (const [hStr, what] of Object.entries(P.houses || {})) {
    const h = +hStr;
    for (const g of ["Jupiter","Venus","Mercury","Moon"]) if (houseOfL(p[g]) === h) {
      add(+2, `${g} occupies the ${ord(h)}, ${what}.`, { graha:g, house:h, benefit:benefitOf(g,h,true) }); break; }
    for (const g of ["Saturn","Mars","Rahu","Ketu"]) if (houseOfL(p[g]) === h) {
      add(-2, `${g} occupies the ${ord(h)}, ${what}.`, { graha:g, house:h, benefit:benefitOf(g,h,false) }); break; }
  }

  /* the lagna lord's own dignity */
  const LORD = ["Mars","Venus","Mercury","Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];
  const ll = LORD[ascSign];
  if (p[ll] != null) { const d = dignityOf(ll, p[ll]);
    const LB = { graha:ll };
    if (d && d.id === "exalted") add(+W.lagnaStrength, `${ll}, lord of the rising sign, is exalted.`,
      { ...LB, benefit:`The whole chart hangs from its rising sign, and its lord — ${ll}, ${KARAKA[ll]} — is at its strongest here.` });
    else if (d && d.id === "own") add(+W.lagnaStrength * 0.6, `${ll}, lord of the rising sign, stands in its own sign.`,
      { ...LB, benefit:`${ll} rules the moment and stands on its own ground — ${KARAKA[ll]}, at ease.` });
    else if (d && d.id === "debilitated") add(-W.lagnaStrength, `${ll}, lord of the rising sign, is debilitated.`,
      { ...LB, benefit:`${ll} rules the moment but stands at its weakest — ${KARAKA[ll]}, with little to draw on.` }); }

  /* --- the day's forbidden and favoured stretches --------------------- */
  if (day) {
    const t = date.getTime(), span = day.set - day.rise, e8 = span / 8;
    const seg = i => ({ a: day.rise + (i - 1) * e8, b: day.rise + i * e8 });
    const wd = date.getDay();
    const rk = seg(RAHU_SEG[wd]), gk = seg(GULIKA_SEG[wd]), ym = seg(YAMA_SEG[wd]);
    if (t >= rk.a && t < rk.b) add(-5, "Rahu Kalam runs.",
      { graha:"Rahu", benefit:"One eighth of the daylight belongs to Rahu each day; the tradition begins nothing inside it." });
    if (t >= gk.a && t < gk.b) add(-3, "Gulika Kalam runs.",
      { graha:"Saturn", benefit:"Gulika is Saturn's own son in the tradition, and its stretch is kept clear of beginnings." });
    if (t >= ym.a && t < ym.b) add(-2, "Yamaganda runs.",
      { graha:"Saturn", benefit:"A stretch the tradition names for Yama and sets aside." });
    const noon = (day.rise + day.set) / 2;
    if (wd !== 3 && t >= noon - 24 * 6e4 && t < noon + 24 * 6e4)
      add(+3, "Abhijit muhurta — the midday victor, traditionally the finest window of the day.",
        { graha:"Sun", benefit:"The eighth of fifteen muhurtas, straddling the Sun's highest point; held to be unconquered, and good for almost anything but a Wednesday." });
    if (t < day.rise || t > day.set) add(-1, "The Sun is below the horizon; most beginnings are held for daylight.");
    /* SANDHYA — the junctions. The tradition sets aside the roughly half hour around
       sunrise and sunset for prayer rather than for beginnings, and a window that opens
       four minutes before sunset is no use to anyone even when it scores well. */
    const SJ = 24 * 6e4;
    if (Math.abs(t - day.rise) < SJ) add(-3, "Sandhya — the junction at sunrise, kept for prayer rather than for beginnings.",
      { graha:"Sun", benefit:"The half hour either side of the Sun crossing the horizon belongs to sandhya vandana in the tradition, not to undertakings." });
    if (Math.abs(t - day.set)  < SJ) add(-3, "Sandhya — the junction at sunset, kept for prayer rather than for beginnings.",
      { graha:"Sun", benefit:"The half hour either side of the Sun crossing the horizon belongs to sandhya vandana in the tradition, not to undertakings." });
  }

  /* --- the personal layer, when a chart is offered -------------------- */
  /* two forms of the same name: one to say "good for YOU", one to say "from YOUR natal
     Moon". A single string served both and produced "a supportive star for your". */
  const personal = (chart, who, poss) => {
    if (!chart) return;
    const nm = nakOf(chart.moon), hm = houseFrom(signOf(chart.moon) + 1, moonSign + 1);
    const tb = taraBala(nm + 1, moonNak + 1);
    const MB = { graha:"Moon" };
    if (hm === 8) add(-6, `The Moon crosses the 8th from ${poss} natal Moon — chandrashtama; the tradition sets such days aside.`,
      { ...MB, benefit:`The transiting Moon standing eighth from the one ${who} were born under; the tradition treats it as a low day and asks for another.` });
    else if ([1,3,6,7,10,11].includes(hm)) add(+2, `Chandra bala is good for ${who} — the Moon rides the ${ord(hm)} from ${poss} natal Moon.`,
      { ...MB, benefit:`Chandra bala counts the transiting Moon from the natal one; the ${ord(hm)} is among the places the tradition calls supportive.` });
    if (tb.tone === "good") add(+2, `Tara bala counts ${tb.name} for ${who} — a supportive star.`,
      { ...MB, benefit:`Tara bala counts nine steps from ${poss} birth star to today's; ${tb.name} is one the tradition reads kindly.` });
    else if (tb.tone === "testing") add(-2, `Tara bala counts ${tb.name} for ${who} — a testing star.`,
      { ...MB, benefit:`Tara bala counts nine steps from ${poss} birth star to today's; ${tb.name} is one the tradition reads as testing.` });
  };
  personal(natal, partner ? "the first partner" : "you", partner ? "the first partner's" : "your");
  personal(partner, "the second partner", "the second partner's");

  /* the whole chart at this moment, so a detail screen can draw it without recomputing */
  const chart = GRAHAS.map(g => ({ graha:g, L:+norm(p[g]).toFixed(3), sign:SIGN[signOf(p[g])],
    signN:signOf(p[g]) + 1, deg:+(norm(p[g]) % 30).toFixed(2), nak:NAK[nakOf(p[g])],
    house:houseOfL(p[g]), retro:g === "Rahu" || g === "Ketu" }));
  return { date, score: +s.toFixed(2), reasons, chart,
    ascL: +norm(asc).toFixed(3), ascSign: ascSign + 1,
    lagna: SIGN[ascSign], lagnaDeg: +(norm(asc) % 30).toFixed(2),
    nakshatra: NAK[moonNak], nakClass: cls,
    tithi: L.tithi.name, paksha: L.tithi.paksha, yoga: L.yoga.name,
    karana: L.karana.name, vara: V.name };
}

/* ---- WHEN IS IT STILL THE SAME KUNDALI? -----------------------------
   Sangram, 9 Sep: "what is the time period in which a given kundali remains the
   same… the window should also be significant enough." The old code merged
   whatever neighbouring minutes happened to score alike, which is arbitrary — a
   window has to be a span in which the CHART DOES NOT CHANGE.

   Measured at ten-second resolution over a full day at Bengaluru:
     every graha's sign + the lagna's sign (D-1)  12 changes a day, median 2.0 h
     + the lagna's nakshatra                      36 changes a day, median 44 min
     + every graha's nakshatra                    37 changes a day, median 44 min
     + the lagna's pada (the D-9 lagna)          109 changes a day, median 14 min
   Rows two and three are nearly identical, which answers the question underneath
   the question: the Moon is not what governs this. It changes nakshatra once a
   day. The LAGNA governs, and everything else is standing still beside it.

   Default grain is `nakshatra` — a median of 44 minutes, long enough to act
   inside and short enough to be a real answer. */
export const GRAIN = {
  rashi:     { label:"the rashi chart", about:"about 2 hours",
               key:(p,a)=>GRAHAS.map(g=>signOf(p[g])).join()+"|"+signOf(a) },
  nakshatra: { label:"the chart with the rising nakshatra", about:"about 45 minutes",
               key:(p,a)=>GRAHAS.map(g=>nakOf(p[g])).join()+"|"+signOf(a)+"|"+nakOf(a) },
  pada:      { label:"the chart down to the Navamsa lagna", about:"about 15 minutes",
               key:(p,a)=>GRAHAS.map(g=>nakOf(p[g])).join()+"|"+Math.floor(norm(a)/(360/108)) },
};
const GRAHAS = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn","Rahu","Ketu"];

/* the edges of the day's own named stretches. A segment must not straddle one, or
   its score would describe a moment that is only true for part of it. */
function dayEdges(day, wd){
  if (!day) return [];
  const span = day.set - day.rise, e8 = span / 8, out = [day.rise, day.set];
  const seg = i => [day.rise + (i - 1) * e8, day.rise + i * e8];
  for (const s of [RAHU_SEG[wd], GULIKA_SEG[wd], YAMA_SEG[wd]]) out.push(...seg(s));
  const noon = (day.rise + day.set) / 2;
  if (wd !== 3) out.push(noon - 24 * 6e4, noon + 24 * 6e4);
  out.push(day.rise + 24 * 6e4, day.set - 24 * 6e4);       /* the sandhya edges */
  return out;
}

/* ---- a window, searched -------------------------------------------- */
export function findMuhurta(opts){
  const { from, to, lat, lon, tzMinutes = 330, top = 5,
          daylightOnly = true, grain = "nakshatra", minWindowMin = 12 } = opts;
  const G = GRAIN[grain] || GRAIN.nakshatra;
  const dayCache = new Map();
  const dayOf = d => {
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!dayCache.has(k)) { const st = sunTimes(d, lat, lon, tzMinutes);
      dayCache.set(k, st && st.rise && st.set ? { rise: st.rise.getTime(), set: st.set.getTime() } : null); }
    return dayCache.get(k);
  };
  const sig = t => { const d = new Date(t); return G.key(positions(d), ascendant(d, lat, lon)); };

  /* 1. find every instant the chart changes, to ten seconds. Detection walks in
        two-minute strides — nothing at this grain is shorter than five minutes —
        and each crossing is then bisected rather than rounded. */
  const STRIDE = 2 * 60000;
  const cuts = new Set([from.getTime(), to.getTime()]);
  let prev = sig(from.getTime()), prevT = from.getTime();
  for (let t = from.getTime() + STRIDE; t <= to.getTime(); t += STRIDE) {
    const cur = sig(t);
    if (cur !== prev) {
      /* bisect to a fifth of a second. Ten seconds was not tight enough: the cut is the
         first sample that reads NEW, so whatever slack the bisection leaves is slack of the
         next chart sitting at the end of this window — the validator caught it as "the
         chart changes inside a 24-min window". */
      let lo = prevT, hi = t;
      while (hi - lo > 200) { const mid = (lo + hi) / 2; if (sig(mid) === prev) lo = mid; else hi = mid; }
      cuts.add(Math.round(hi));
      prev = cur;
    }
    prevT = t;
  }
  /* 2. add the day's own edges, so no segment straddles Rahu Kalam or Abhijit */
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 864e5))
    for (const e of dayEdges(dayOf(d), d.getDay()))
      if (e > from.getTime() && e < to.getTime()) cuts.add(Math.round(e));

  /* 3. every segment is now homogeneous: score it once, at its middle */
  const edges = [...cuts].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < edges.length - 1; i++) {
    let a = edges[i], b = edges[i + 1];
    const mid = (a + b) / 2, d = new Date(mid), day = dayOf(d);
    if (daylightOnly && day) { a = Math.max(a, day.rise); b = Math.min(b, day.set); if (b <= a) continue; }
    if (b - a < minWindowMin * 60000) continue;
    const m = scoreMoment(new Date((a + b) / 2), { ...opts, day });
    segs.push({ ...m, windowFrom: new Date(a), windowTo: new Date(b), minutes: Math.round((b - a) / 60000) });
  }
  segs.sort((x, y) => y.score - x.score);
  return { best: segs.slice(0, top), scanned: segs.length, grain,
           grainLabel: G.label, grainAbout: G.about };
}
