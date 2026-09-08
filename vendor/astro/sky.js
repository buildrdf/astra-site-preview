/* GENERATED from prototype/src/sky.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ---------------------------------------------------------------
   SKY - where to look for a graha in the real sky.

   Takes the engine's sidereal longitudes back to tropical (add
   Lahiri ayanamsa), assumes ecliptic latitude 0, converts to
   RA/Dec with the mean obliquity, then to alt/az via GMST
   (IAU 1982) and the observer's lat/lon.

   The beta=0 approximation costs at most the body's ecliptic
   latitude: ~2 deg for the planets, up to ~5.1 deg for the Moon.
   Fine for "look south-west, about halfway up"; not for a
   telescope. Rahu/Ketu are points, not bodies - alt/az says
   where the node direction sits, nothing is visible there.

   Verified against the Sun: solar noon at the reference place puts it
   high in the south, sunrise puts it low in the east, midnight
   puts it below the horizon; near-full Moon is up at 21:00 IST.
   --------------------------------------------------------------- */

import { positions, ayanamsa, jd, sunTropical } from './ephemeris.js';

const D = Math.PI/180;
const norm = d => ((d % 360) + 360) % 360;

/* Tropical ecliptic longitude of a graha, degrees. */
function tropicalLon(graha, date){
  const J = jd(date);
  if (graha === 'Sun') return sunTropical(J);
  const sid = positions(date)[graha];
  if (sid === undefined) throw new Error(`unknown graha: ${graha}`);
  return norm(sid + ayanamsa(J));
}

/* Ecliptic (lambda, beta=0) -> equatorial RA/Dec, degrees.
   Mean obliquity: eps = 23.439281 - 0.0130042 T (T = centuries from J2000). */
function raDec(lambda, J){
  const T = (J - 2451545) / 36525;
  const eps = 23.439281 - 0.0130042 * T;
  const ra  = norm(Math.atan2(Math.sin(lambda*D)*Math.cos(eps*D), Math.cos(lambda*D)) / D);
  const dec = Math.asin(Math.sin(eps*D)*Math.sin(lambda*D)) / D;
  return { ra, dec };
}

/* Greenwich mean sidereal time, degrees (IAU 1982, good to ~0.1s).
   Exported for the report generator's birth-sky block (local sidereal
   time = gmst + east longitude). */
export function gmst(J){
  const J0 = Math.floor(J - 0.5) + 0.5;      // previous 0h UT
  const D0 = J0 - 2451545;
  const UT = (J - J0) * 24;                   // hours since 0h UT
  const T  = (J - 2451545) / 36525;
  const h  = 6.697374558 + 0.06570982441908*D0 + 1.00273790935*UT + 0.000026*T*T;
  return norm(h * 15);
}

/* Where is this graha in the sky right now, from lat/lon (degrees,
   east-positive lon)? -> { alt, az, up }; az 0=N, 90=E. */
export function altAz(graha, date, lat, lon){
  const J = jd(date);
  const { ra, dec } = raDec(tropicalLon(graha, date), J);
  const lst = norm(gmst(J) + lon);            // local sidereal time, degrees
  const H = norm(lst - ra);                   // hour angle, degrees
  const sinAlt = Math.sin(lat*D)*Math.sin(dec*D)
               + Math.cos(lat*D)*Math.cos(dec*D)*Math.cos(H*D);
  const alt = Math.asin(sinAlt) / D;
  /* Azimuth from north, clockwise through east. Verified numerically
     against the Sun (noon->south, sunrise->east). */
  const az = norm(Math.atan2(
    -Math.cos(dec*D)*Math.sin(H*D),
    Math.sin(dec*D)*Math.cos(lat*D) - Math.cos(dec*D)*Math.sin(lat*D)*Math.cos(H*D)
  ) / D);
  return { alt, az, up: alt > 0 };
}

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                 'S','SSW','SW','WSW','W','WNW','NW','NNW'];

/* altAz plus a 16-point compass word. */
export function whereIs(graha, date, lat, lon){
  const p = altAz(graha, date, lat, lon);
  return { ...p, compass: COMPASS[Math.round(p.az / 22.5) % 16] };
}

/* Sample the coming hours: [{ t, alt, az }, ...]. */
export function skyPath(graha, date, lat, lon, hours = 24, stepMin = 30){
  const out = [];
  for (let m = 0; m <= hours * 60; m += stepMin){
    const t = new Date(date.getTime() + m * 60000);
    const { alt, az } = altAz(graha, t, lat, lon);
    out.push({ t, alt, az });
  }
  return out;
}

/* HH:MM in the runtime's local zone (the observer's zone on-device). */
function hhmm(t){
  const p = n => String(n).padStart(2, '0');
  return `${p(t.getHours())}:${p(t.getMinutes())}`;
}

/* One-line rise/set hint: "up now, sets ~21:40" / "rises ~03:10".
   Crossing time is a linear interpolation between 10-minute samples,
   so ~ really means approximately - refraction is ignored too. */
export function riseSetHint(graha, date, lat, lon){
  const path = skyPath(graha, date, lat, lon, 24, 10);
  const upNow = path[0].alt > 0;
  for (let i = 1; i < path.length; i++){
    const a = path[i-1], b = path[i];
    if ((a.alt > 0) !== (b.alt > 0)){
      const f = a.alt / (a.alt - b.alt);      // fraction of step to the horizon
      const t = new Date(a.t.getTime() + f * (b.t.getTime() - a.t.getTime()));
      return upNow ? `up now, sets ~${hhmm(t)}` : `rises ~${hhmm(t)}`;
    }
  }
  return upNow ? 'up now' : 'below the horizon';
}

/* ---------------------------------------------------------------
   ASCENDANT - the sidereal lagna for any birth, anywhere.

   RAMC is the local sidereal time in degrees; the rising point of
   the ecliptic follows the standard relation

     tan(lambda_asc) = -cos(RAMC) / (sin(RAMC) cos(eps) + tan(phi) sin(eps))

   resolved with atan2 into the correct quadrant, then taken
   sidereal by subtracting the Lahiri ayanamsa. Until this existed
   the app could only cast one person's chart.
   --------------------------------------------------------------- */
export function ascendant(date, lat, lon){
  const J = jd(date);
  const T = (J - 2451545) / 36525;
  const eps = (23.439281 - 0.0130042 * T) * D;
  const ramc = norm(gmst(J) + lon) * D;      /* east-positive */
  const phi = lat * D;
  /* atan2 signs chosen so this is the RISING point, not the setting one */
  let lambda = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc)*Math.cos(eps) + Math.tan(phi)*Math.sin(eps))) / D;
  /* ...except above the polar circle (|lat| > 90° − ε, about 66.56°),
     where tan(phi)·sin(eps) outweighs the RAMC term and the quadrant
     stops tracking the horizon: for a sixth of every day at Tromsø and
     a third at Svalbard the formula handed back the SETTING point — the
     chart's lagna was the descendant, and only three signs ever "rose"
     at 78N. A point on the horizon that is west of the meridian is
     setting, so the rising point is its antipode. Below the polar
     circle this never fires: bit-identical over a million samples
     (tools/validate_report_edges.mjs). */
  const ra = Math.atan2(Math.sin(lambda*D)*Math.cos(eps), Math.cos(lambda*D)) / D;
  const H = norm(ramc/D - ra);                /* hour angle, 0..360 */
  if (H > 0 && H < 180) lambda += 180;
  return norm(norm(lambda) - ayanamsa(J));   /* sidereal, 0..360 */
}

/* ---------------------------------------------------------------
   SUNRISE / SUNSET - Sun's centre at -0.833 deg altitude (standard
   refraction + semidiameter), found by bisection on the day's
   altitude curve. Feeds the muhurta windows (Rahu Kalam, Abhijit).
   --------------------------------------------------------------- */
export function sunTimes(date, lat, lon, tzMinutes){
  /* The 24-hour scan has to start at the PLACE's civil midnight. Anchored on the DEVICE's
     midnight it straddled the wrong night whenever the two zones were far apart — an
     Indian chart opened in New York came back with a sunrise LATER than its sunset, and
     every consumer (day length, choghadiya, rahu kalam, shadbala's day/night, the festival
     day rules) inherited the inversion. With no zone given, the place's own mean solar
     time (longitude ÷ 15) is the honest anchor. */
  const offMs=(tzMinutes==null?Math.round(lon*4):tzMinutes)*60000;
  const day0=new Date(Math.floor((date.getTime()+offMs)/864e5)*864e5-offMs);
  const altAt=h=>altAz("Sun", new Date(day0.getTime()+h*36e5), lat, lon).alt;
  const cross=(h1,h2,rising)=>{
    let a=h1,b=h2;
    for(let i=0;i<24;i++){
      const m=(a+b)/2, up=altAt(m)>-0.833;
      if(up===rising) b=m; else a=m;
    }
    return new Date(day0.getTime()+((a+b)/2)*36e5);
  };
  /* coarse scan for the two crossings */
  let rise=null,set=null,prev=altAt(0);
  let everUp=prev>-0.833, everDown=prev<=-0.833;
  for(let h=1;h<=24;h++){
    const cur=altAt(h);
    if(prev<=-0.833&&cur>-0.833) rise=cross(h-1,h,true);
    if(prev>-0.833&&cur<=-0.833) set=cross(h-1,h,false);
    if(cur>-0.833) everUp=true; else everDown=true;
    prev=cur;
  }
  /* Above the polar circles there is no crossing for weeks at a time, and a
     caller that only sees {rise:null,set:null} cannot tell midnight sun from
     polar night. It is already sampling every hour — say which. */
  return {rise, set, alwaysUp: everUp&&!everDown, alwaysDown: everDown&&!everUp};
}

/* ---------------------------------------------------------------
   SKY-VIEW SUPPORT - generic projections for the magic-window sky.
   --------------------------------------------------------------- */
export function raDecToAltAz(ra, dec, date, lat, lon){
  const J=jd(date);
  const H=(norm(gmst(J)+lon)-ra);
  const phi=lat*D, dd=dec*D, HH=H*D;
  const alt=Math.asin(Math.sin(phi)*Math.sin(dd)+Math.cos(phi)*Math.cos(dd)*Math.cos(HH))/D;
  const az=norm(Math.atan2(-Math.cos(dd)*Math.sin(HH),
      Math.sin(dd)*Math.cos(phi)-Math.cos(dd)*Math.sin(phi)*Math.cos(HH))/D);
  return {alt,az,up:alt>0};
}
/* a point ON the ecliptic by SIDEREAL longitude (rashi space) */
/* ecliptic (lambda, beta) → equatorial, mean obliquity of date */
function raDecB(lambda, beta, J){
  const T = (J - 2451545) / 36525;
  const eps = (23.439281 - 0.0130042 * T) * D;
  const l = lambda * D, b = beta * D;
  const ra  = norm(Math.atan2(Math.sin(l)*Math.cos(eps) - Math.tan(b)*Math.sin(eps), Math.cos(l)) / D);
  const dec = Math.asin(Math.sin(b)*Math.cos(eps) + Math.cos(b)*Math.sin(eps)*Math.sin(l)) / D;
  return { ra, dec };
}
/* a sidereal point WITH ecliptic latitude - planets sit near the ribbon, not on it */
export function siderealPointAltAzB(lambdaSid, beta, date, lat, lon){
  const J=jd(date);
  const {ra,dec}=raDecB(norm(lambdaSid+ayanamsa(J)), beta||0, J);
  return raDecToAltAz(ra, dec, date, lat, lon);
}
export function siderealPointAltAz(lambdaSid, date, lat, lon){
  const J=jd(date);
  const {ra,dec}=raDec(norm(lambdaSid+ayanamsa(J))*1, J);
  return raDecToAltAz(ra, dec, date, lat, lon);
}
