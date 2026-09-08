/* ==========================================================================
   The day, computed rather than described.

   Everything on the "your day" act comes from here, and every value has a
   derivation you could check by hand:

     sunrise / sunset   the engine's own solar altitude scan for this place
     Rahu Kalam         daylight cut into eight; which eighth depends on the
                        weekday, by the classical table
     Abhijit            the eighth of the day's fifteen muhurtas, the one
                        that straddles local noon
     the Moon           its elongation from the Sun right now, which gives
                        both the tithi and which of the thirty phase images
                        is the true picture of tonight's Moon

   The weekday's colour and number are traditional associations, not
   computations, and the page says so where it prints them. Nothing here
   predicts anything.
   ========================================================================== */
import { positions } from "../vendor/astro/ephemeris.js";
import { sunTimes } from "../vendor/astro/sky.js";
import { offsetAt } from "./kundali.js";

const norm = d => ((d % 360) + 360) % 360;

export const VARA = [
  { day: "Sunday",    lord: "Sun",     colour: "Copper",  num: 1, rk: 8,
    favoured: ["Beginnings that need visibility", "Speaking with authority", "Time in daylight"],
    held:     ["Working entirely unseen", "Deferring a decision that is yours"] },
  { day: "Monday",    lord: "Moon",    colour: "White",   num: 2, rk: 2,
    favoured: ["Anything to do with home", "Listening", "Rest that is actually rest"],
    held:     ["Arguments taken personally", "Signing while unsettled"] },
  { day: "Tuesday",   lord: "Mars",    colour: "Red",     num: 9, rk: 7,
    favoured: ["Physical effort", "Finishing what stalled", "Direct conversations"],
    held:     ["Haste dressed as courage", "Picking the fight"] },
  { day: "Wednesday", lord: "Mercury", colour: "Green",   num: 5, rk: 5,
    favoured: ["Writing and study", "Negotiation", "Detail work"],
    held:     ["Over-explaining", "Committing before reading it"] },
  { day: "Thursday",  lord: "Jupiter", colour: "Yellow",  num: 3, rk: 6,
    favoured: ["Teaching and learning", "Generosity", "Long-range planning"],
    held:     ["Promising more than the week holds", "Excess of any kind"] },
  { day: "Friday",    lord: "Venus",   colour: "White",   num: 6, rk: 4,
    favoured: ["Making something beautiful", "Repairing a relationship", "Pleasure taken well"],
    held:     ["Spending to feel better", "Avoiding the honest conversation"] },
  { day: "Saturday",  lord: "Saturn",  colour: "Deep blue", num: 8, rk: 3,
    favoured: ["Slow, structural work", "Keeping a promise", "Service to someone older"],
    held:     ["Rushing", "Starting what you cannot sustain"] }
];

const TITHI = ["Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami",
               "Navami","Dashami","Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Purnima",
               "Pratipada","Dwitiya","Tritiya","Chaturthi","Panchami","Shashthi","Saptami","Ashtami",
               "Navami","Dashami","Ekadashi","Dwadashi","Trayodashi","Chaturdashi","Amavasya"];

const PHASE_NAME = ["New Moon","Waxing crescent","First quarter","Waxing gibbous","Full Moon",
                    "Waning gibbous","Last quarter","Waning crescent"];
const FILES = ["phase_00_new_moon","phase_01_waxing_crescent","phase_02_waxing_crescent","phase_03_waxing_crescent",
  "phase_04_waxing_crescent","phase_05_waxing_crescent","phase_06_waxing_crescent","phase_07_first_quarter",
  "phase_08_first_quarter","phase_09_waxing_gibbous","phase_10_waxing_gibbous","phase_11_waxing_gibbous",
  "phase_12_waxing_gibbous","phase_13_waxing_gibbous","phase_14_waxing_gibbous","phase_15_full_moon",
  "phase_16_waning_gibbous","phase_17_waning_gibbous","phase_18_waning_gibbous","phase_19_waning_gibbous",
  "phase_20_waning_gibbous","phase_21_waning_gibbous","phase_22_last_quarter","phase_23_last_quarter",
  "phase_24_waning_crescent","phase_25_waning_crescent","phase_26_waning_crescent","phase_27_waning_crescent",
  "phase_28_waning_crescent","phase_29_waning_crescent"];

export const phaseFile = i => `assets/moon/${FILES[((i % 30) + 30) % 30]}.png`;

/* the Moon's angular distance ahead of the Sun: 0 at new, 180 at full */
export function moonAt(date) {
  const p = positions(date);
  const elong = norm(p.Moon - p.Sun);
  const idx = Math.floor(elong / 360 * 30) % 30;
  return {
    elong,
    index: idx,
    illum: (1 - Math.cos(elong * Math.PI / 180)) / 2,
    tithi: TITHI[Math.floor(elong / 12) % 30],
    paksha: elong < 180 ? "Shukla" : "Krishna",
    name: PHASE_NAME[Math.round(elong / 45) % 8],
    file: phaseFile(idx)
  };
}

/* the whole lunar month around today, for the strip of thirty */
export function lunarMonth(date) {
  const SYN = 29.530588 * 86400000;
  const today = moonAt(date);
  return Array.from({ length: 30 }, (_, i) => {
    const t = new Date(date.getTime() + (i - today.index) * SYN / 30);
    const m = moonAt(t);
    return { ...m, date: t, isToday: i === today.index };
  });
}

/* Times are shown on the CLOCK OF THE PLACE, not the device's. A phone in London
   looking at Mumbai's day should read Mumbai's sunrise as Mumbai reads it. */
const hhmm = (d, tz) => d ? d.toLocaleTimeString("en-GB",
  { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }) : "—";

export function dayShape(date, place) {
  const { lat, lon, tz } = place;
  /* the weekday, and the day itself, belong to the place */
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  const vara = VARA[local.getDay()];
  const { rise, set, alwaysUp, alwaysDown } = sunTimes(date, lat, lon, offsetAt(date, tz));
  if (!rise || !set) return { vara, polar: alwaysUp ? "The Sun does not set here today." : "The Sun does not rise here today.", moon: moonAt(date) };

  const day = set - rise, eighth = day / 8, muhurta = day / 15;
  const rk = { from: new Date(rise.getTime() + (vara.rk - 1) * eighth), to: new Date(rise.getTime() + vara.rk * eighth) };
  const ab = { from: new Date(rise.getTime() + 7 * muhurta), to: new Date(rise.getTime() + 8 * muhurta) };

  /* where each window sits along the daylight bar, as a percentage */
  const pct = d => Math.max(0, Math.min(100, (d - rise) / day * 100));
  const now = new Date();
  return {
    vara, rise, set, moon: moonAt(date),
    riseText: hhmm(rise, tz), setText: hhmm(set, tz), local,
    abhijit: { ...ab, text: `${hhmm(ab.from, tz)}–${hhmm(ab.to, tz)}`, left: pct(ab.from), width: pct(ab.to) - pct(ab.from) },
    rahu:    { ...rk, text: `${hhmm(rk.from, tz)}–${hhmm(rk.to, tz)}`, left: pct(rk.from), width: pct(rk.to) - pct(rk.from) },
    nowPct: now >= rise && now <= set ? pct(now) : null
  };
}
