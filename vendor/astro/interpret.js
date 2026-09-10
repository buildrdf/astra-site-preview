/* Planet meanings, transit senses, the day's lines, the special transits and the
   planet stories live on the server (supabase/functions/_shared/astro/interpret.js)
   and arrive once per session through readings.js. Shells here; fillInterpret()
   populates them. */
export const GRAHA_MEANING = {};
export const GOCHARA_FEEL = {};
export const HOUSE_TRANSIT_SENSE = {};
export const SPECIAL = {};
export const DAY_DO = {};
export const DAY_AVOID = {};
export const VARA_PRACTICE = {};
export const PLANET_STORY = {};
const SHELLS = { GRAHA_MEANING, GOCHARA_FEEL, HOUSE_TRANSIT_SENSE, SPECIAL, DAY_DO, DAY_AVOID, VARA_PRACTICE, PLANET_STORY };
export function fillInterpret(d) { if (d) for (const k of Object.keys(SHELLS)) if (d[k]) Object.assign(SHELLS[k], d[k]); }
