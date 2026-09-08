/* GENERATED from prototype/src/cusps.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ===================================================================
   PLACIDUS CUSPS + BHAV CHALIT - the unequal house frame the
   benchmark vendor prints (KP-style), used here for the Bhav Chalit
   chart: a planet's bhava is the cusp interval that contains it.

   Method (derived from the semi-arc definition; validated against
   the 12 printed cusp longitudes and all 9 printed planet->cusp
   assignments of the reference chart - tools/validate_cusps.mjs):

     RAMC from sidereal time; MC = ecliptic point on the meridian;
     Asc = standard rising point. For the intermediate cusps the
     ecliptic point is found by fixed-point iteration on
       XI :  a = RAMC + 30 + AD/3
       XII:  a = RAMC + 60 + 2AD/3
       II :  a = RAMC + 120 + 2AD/3
       III:  a = RAMC + 150 + AD/3
     where a is right ascension, AD = asin(tan(phi) tan(dec)) the
     ascensional difference of the trial point. Opposite cusps
     mirror (+180). Longitudes are computed tropically and reduced
     to sidereal with the same Lahiri ayanamsa as everything else.
   =================================================================== */
import { jd, ayanamsa, norm } from "./ephemeris.js";
import { gmst } from "./sky.js";

const D = Math.PI / 180;

function obliquity(J) {
  const T = (J - 2451545) / 36525;
  return 23.439291 - 0.0130042 * T;
}

/* ecliptic longitude of the ecliptic point with right ascension a,
   kept in a's quadrant */
function lonOfRA(a, eps) {
  let lam = Math.atan2(Math.sin(a * D), Math.cos(a * D) * Math.cos(eps * D)) / D;
  return norm(lam);
}

export function placidusCusps(date, lat, lon) {
  const J = jd(date);
  const eps = obliquity(J);
  const ramc = norm(gmst(J) + lon);
  const ay = ayanamsa(J);
  const phi = lat * D;

  /* MC: ecliptic point culminating */
  const mc = lonOfRA(ramc, eps);

  /* Asc: standard formula */
  let ascT = norm(Math.atan2(
    Math.cos(ramc * D),
    -(Math.sin(ramc * D) * Math.cos(eps * D) + Math.tan(phi) * Math.sin(eps * D))
  ) / D);   /* rising ecliptic point (the +180 variant is the DESCENDANT
               - caught by the printed-cusp validator on first run) */
  /* above the polar circle the quadrant no longer tracks the horizon and
     this can be the setting point — the same test sky.js ascendant()
     applies: a horizon point west of the meridian is setting, so take
     its antipode. Never fires below ~66.56°, so the printed-cusp
     benchmark is untouched. */
  {
    const ra = Math.atan2(Math.sin(ascT * D) * Math.cos(eps * D), Math.cos(ascT * D)) / D;
    const H = norm(ramc - ra);
    if (H > 0 && H < 180) ascT = norm(ascT + 180);
  }

  const inter = (offset, k) => {          /* k = 1/3 or 2/3 */
    let a = ramc + offset;                /* trial right ascension */
    for (let i = 0; i < 30; i++) {
      const lam = lonOfRA(a, eps);
      const dec = Math.asin(Math.sin(eps * D) * Math.sin(lam * D));
      const ad = Math.asin(Math.min(1, Math.max(-1,
        Math.tan(phi) * Math.tan(dec)))) / D;
      const a2 = ramc + offset + k * ad;
      if (Math.abs(norm(a2 - a + 180) - 180) < 1e-6) { a = a2; break; }
      a = a2;
    }
    return lonOfRA(a, eps);
  };

  const c11 = inter(30, 1 / 3);
  const c12 = inter(60, 2 / 3);
  const c2  = inter(120, 2 / 3);
  const c3  = inter(150, 1 / 3);

  const trop = [ascT, c2, c3, norm(mc + 180), norm(c11 + 180), norm(c12 + 180),
    norm(ascT + 180), norm(c2 + 180), norm(c3 + 180), mc, c11, c12];
  return trop.map(t => norm(t - ay));     /* sidereal, house 1..12 */
}

/* the bhava that contains a sidereal longitude: the interval from
   cusp k to cusp k+1 (KP convention, as the vendor prints) */
export function chalitHouseOf(L, cusps) {
  const x = norm(L);
  for (let h = 0; h < 12; h++) {
    const a = cusps[h], b = cusps[(h + 1) % 12];
    const span = norm(b - a), off = norm(x - a);
    if (off < span) return h + 1;
  }
  return 12;
}
