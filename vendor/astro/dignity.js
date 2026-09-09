/* The one function muhurta.js needs out of the app's objectmodel.js.

   objectmodel.js is 888 lines and pulls in zodiac.js and ashtakavarga.js; muhurta.js
   reaches into all of that for `dignityOf`, and reads nothing from the result but `.id`.
   So this is that function and its four tables, and nothing else.

   The tables and the order they are tested in are copied from
   prototype/src/objectmodel.js — exalted, then moolatrikona, then own sign, then
   debilitated, then natural friendship. The order matters: a graha inside its
   moolatrikona band is NOT read as "own sign", and muhurta.js scores those two
   differently. The `why` prose the app builds alongside each verdict is left out,
   because nothing on the website reads it. */

const SIGN_LORD = ["Mars","Venus","Mercury","Moon","Sun","Mercury",
                   "Venus","Mars","Jupiter","Saturn","Saturn","Jupiter"];

const EXALTATION = {
  Sun:     { sign: 1  },              /* Aries       */
  Moon:    { sign: 2  },              /* Taurus      */
  Mars:    { sign: 10 },              /* Capricorn   */
  Mercury: { sign: 6, maxDeg: 15 },   /* Virgo 0–15  */
  Jupiter: { sign: 4  },              /* Cancer      */
  Venus:   { sign: 12 },              /* Pisces      */
  Saturn:  { sign: 7  }               /* Libra       */
};
/* debilitation is the seventh sign from exaltation, by definition */
const DEBILITATION = Object.fromEntries(
  Object.entries(EXALTATION).map(([g, e]) => [g, ((e.sign - 1 + 6) % 12) + 1]));

const MOOLATRIKONA = {
  Sun:     { sign: 5,  from: 0,  to: 20 },
  Moon:    { sign: 2,  from: 3,  to: 30 },
  Mars:    { sign: 1,  from: 0,  to: 12 },
  Mercury: { sign: 6,  from: 15, to: 20 },
  Jupiter: { sign: 9,  from: 0,  to: 10 },
  Venus:   { sign: 7,  from: 0,  to: 15 },
  Saturn:  { sign: 11, from: 0,  to: 20 }
};

const OWN = { Sun:[5], Moon:[4], Mars:[1,8], Mercury:[3,6], Jupiter:[9,12], Venus:[2,7], Saturn:[10,11] };

/* Parashari natural friendship: 1 friend, 0 neutral, -1 enemy.
   The Moon has no natural enemy in this scheme. */
const NATURAL_FRIENDSHIP = {
  Sun:     { Moon: 1, Mars: 1, Jupiter: 1, Mercury: 0, Venus: -1, Saturn: -1 },
  Moon:    { Sun: 1, Mercury: 1, Mars: 0, Jupiter: 0, Venus: 0, Saturn: 0 },
  Mars:    { Sun: 1, Moon: 1, Jupiter: 1, Venus: 0, Saturn: 0, Mercury: -1 },
  Mercury: { Sun: 1, Venus: 1, Mars: 0, Jupiter: 0, Saturn: 0, Moon: -1 },
  Jupiter: { Sun: 1, Moon: 1, Mars: 1, Saturn: 0, Mercury: -1, Venus: -1 },
  Venus:   { Mercury: 1, Saturn: 1, Mars: 0, Jupiter: 0, Sun: -1, Moon: -1 },
  Saturn:  { Mercury: 1, Venus: 1, Jupiter: 0, Sun: -1, Moon: -1, Mars: -1 }
};

const norm = d => ((d % 360) + 360) % 360;

export function dignityOf(g, L) {
  if (g === "Rahu" || g === "Ketu") return { id: null };
  const ex = EXALTATION[g];
  if (!ex) return { id: null };

  const l = norm(L), s = Math.floor(l / 30) + 1, d = l % 30;
  const mt = MOOLATRIKONA[g];

  if (ex.sign === s && (ex.maxDeg === undefined || d < ex.maxDeg)) return { id: "exalted" };
  if (mt && mt.sign === s && d >= mt.from && d < mt.to) return { id: "moolatrikona" };
  if (OWN[g].includes(s)) return { id: "own" };
  if (DEBILITATION[g] === s) return { id: "debilitated" };

  const rel = NATURAL_FRIENDSHIP[g]?.[SIGN_LORD[s - 1]];
  return { id: rel === 1 ? "friend" : rel === -1 ? "enemy" : "neutral" };
}
