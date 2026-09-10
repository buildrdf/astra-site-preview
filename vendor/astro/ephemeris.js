/* GENERATED from prototype/src/ephemeris.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ---------------------------------------------------------------
   EPHEMERIS - geocentric sidereal longitudes for all nine grahas.

   Planets: JPL 'Approximate Positions of the Planets' (Standish),
   Keplerian elements with secular rates, valid 1800-2050.
   Sun: Meeus Ch.25. Earth's heliocentric position is taken from the
   solar solution rather than Standish's Earth element, which carries
   a ~6 arcmin longitude error at recent epochs.
   Moon: full Meeus ch.47 series (59 periodic + 3 additive terms, E
   factors) - see the block comment above moonTropical for the time
   convention. Nodes: true node.
   Ayanamsa: Lahiri.

   ACCURACY, MEASURED against JPL Horizons at 1990, 2026 and 2045
   (tools/jpl_reference.mjs, tools/validate_ephemeris_accuracy.mjs), worst error:
     Sun 0.2'  Moon 0.9'  Mercury 0.6'  Venus 0.4'  Mars 0.3'  Jupiter 3.6'  Saturn 6.4'
   Until 10 Sep 2026 those read 5.6 / 15.6 / 22.1 / 28.2 / 44.2 for Mercury..Saturn,
   and it was blamed on Standish's approximation. It was not: the elements are referred
   to the ecliptic of J2000 while the Sun subtracted from them is of date, so the whole
   precession since J2000 sat in the answer. See positions(). Standish's own bound for
   1800-2050 is roughly 10' on Saturn, and we are inside it now.

   WHAT THIS STILL MEANS FOR SLOW GRAHAS. A pada is 200 arcmin wide, so signs,
   nakshatras and padas are safe. But Saturn near a station moves under 2 arcmin a day,
   so 5 arcmin of longitude is still DAYS of ingress timing. Measured against Drik
   Panchang: Makara ingress 23 Jan 2020 23:35 IST vs 24 Jan (was 26 Jan); Kumbha 27 Apr
   2022 vs 29 Apr (was 3 May); retrograde return 14 Jul 2022 vs 12 Jul (was 7 Jul). Do
   not claim hour-level Saturn boundaries. Some residual is convention: Drik publishes
   several Lahiri variants.
   --------------------------------------------------------------- */

/* Planetary positions from JPL's "Approximate Positions of the Planets"
   (Standish, keplerian elements + secular rates, valid 1800-2050).
   Geocentric ecliptic longitude, then sidereal via Lahiri. */
const D=Math.PI/180, sin=x=>Math.sin(x*D), cos=x=>Math.cos(x*D);
export const norm=d=>((d%360)+360)%360;
export const jd=date=>date.getTime()/86400000+2440587.5;

//            a           e          I          L            longPeri     longNode
const EL={
 Mercury:[[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],
          [0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],
 Venus:  [[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],
          [0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],
 Earth:  [[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],
          [0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]],
 Mars:   [[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],
          [0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],
 Jupiter:[[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],
          [-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],
 Saturn: [[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],
          [-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]]
};

function heliocentric(name,T){
  const [e0,r]=EL[name];
  const a=e0[0]+r[0]*T, ec=e0[1]+r[1]*T, I=e0[2]+r[2]*T;
  const L=e0[3]+r[3]*T, wbar=e0[4]+r[4]*T, om=e0[5]+r[5]*T;
  const w=wbar-om;
  let M=norm(L-wbar); if(M>180) M-=360;
  const estar=180/Math.PI*ec;
  let E=M+estar*sin(M);
  for(let i=0;i<12;i++){
    const dM=M-(E-estar*sin(E));
    E+=dM/(1-ec*cos(E));
  }
  const xp=a*(cos(E)-ec), yp=a*Math.sqrt(1-ec*ec)*sin(E);
  const x=(cos(w)*cos(om)-sin(w)*sin(om)*cos(I))*xp+(-sin(w)*cos(om)-cos(w)*sin(om)*cos(I))*yp;
  const y=(cos(w)*sin(om)+sin(w)*cos(om)*cos(I))*xp+(-sin(w)*sin(om)+cos(w)*cos(om)*cos(I))*yp;
  const z=(sin(w)*sin(I))*xp+(cos(w)*sin(I))*yp;
  return [x,y,z];
}


/* Moon: full Meeus ch.47 longitude solution (abridged ELP-2000/82).
   All 59 longitude terms of table 47.A with the E eccentricity factor on
   solar-anomaly (M) terms, plus the additive A1 (Venus), A2 (Jupiter) and
   L'-F (flattening) corrections. Verified digit-for-digit against Meeus's
   worked example 47.a. Intrinsic accuracy ~10 arcsec.

   Time argument stays the module's UT-based JD (no deltaT step): the
   Lahiri polynomial below was tuned against professionally printed
   sidereal charts computed the standard way (TD + true ayanamsa), so it
   already absorbs the near-constant UT->TD Moon offset (~0.5' at late-
   20th-century epochs). Do NOT add deltaT here alone - that reopens a
   +0.45' error unless the ayanamsa is retuned in the same commit.
   Residual vs two independent printed charts (1988, 1992): <0.05'. */
const LTERMS=[            /* [D, M, M', F, coeff in 1e-6 deg] */
[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],
[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],
[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],
[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],
[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
[2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],
[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
[4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],
[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],
[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]];
export function moonTropical(J){
  const T=(J-2451545)/36525;
  const Lp=norm(218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841-T*T*T*T/65194000);
  const Dd=norm(297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868-T*T*T*T/113065000);
  const M =norm(357.5291092+35999.0502909*T-0.0001536*T*T+T*T*T/24490000);
  const Mp=norm(134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699-T*T*T*T/14712000);
  const F =norm(93.2720950+483202.0175233*T-0.0036539*T*T-T*T*T/3526000+T*T*T*T/863310000);
  const E=1-0.002516*T-0.0000074*T*T, E2=E*E;
  const A1=119.75+131.849*T, A2=53.09+479264.290*T;
  let sl=3958*sin(A1)+1962*sin(Lp-F)+318*sin(A2);
  for(const [d,m,mp,f,c] of LTERMS)
    sl+=c*(m===0?1:m===1||m===-1?E:E2)*sin(d*Dd+m*M+mp*Mp+f*F);
  return norm(Lp+sl/1e6);
}
/* Moon ecliptic latitude: Meeus ch.47 table 47.B (60 terms) with the E
   factor on solar-anomaly terms, plus the A1/A3/L' additive corrections.
   Used only by the Sky so planets sit NEAR the ecliptic ribbon rather than
   snapped onto it; positions() (longitudes) is untouched. */
const BTERMS=[[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],
[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],
[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],
[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],
[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],
[2,-1,1,-1,491],[2,0,-2,1,-451],[0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],
[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],
[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],[0,1,-2,-1,-220],
[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],
[4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],
[2,-2,0,1,107]];
export function moonLatitude(J){
  const T=(J-2451545)/36525;
  const Lp=norm(218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841-T*T*T*T/65194000);
  const Dd=norm(297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868-T*T*T*T/113065000);
  const M =norm(357.5291092+35999.0502909*T-0.0001536*T*T+T*T*T/24490000);
  const Mp=norm(134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699-T*T*T*T/14712000);
  const F =norm(93.2720950+483202.0175233*T-0.0036539*T*T-T*T*T/3526000+T*T*T*T/863310000);
  const E=1-0.002516*T-0.0000074*T*T, E2=E*E;
  const A1=119.75+131.849*T, A3=313.45+481266.484*T;
  let sb=-2235*sin(Lp)+382*sin(A3)+175*sin(A1-F)+175*sin(A1+F)+127*sin(Lp-Mp)-115*sin(Lp+Mp);
  for(const [d,m,mp,f,c] of BTERMS)
    sb+=c*(m===0?1:m===1||m===-1?E:E2)*sin(d*Dd+m*M+mp*Mp+f*F);
  return sb/1e6;
}
/* Geocentric ecliptic latitude per body, degrees. Sun and the nodes are on
   the ecliptic by definition; planets from the heliocentric z of their
   orbital elements against Earth in the ecliptic plane. */
export function eclipticLatitudes(date){
  const J=jd(date), T=(J-2451545)/36525;
  const sg=sunGeo(J);
  const earth=[-sg.R*cos(sg.lon), -sg.R*sin(sg.lon), 0];
  const out={Sun:0, Moon:moonLatitude(J), Rahu:0, Ketu:0};
  for(const p of ['Mercury','Venus','Mars','Jupiter','Saturn']){
    const h=heliocentric(p,T);
    const dx=h[0]-earth[0], dy=h[1]-earth[1], dz=h[2]-earth[2];
    out[p]=Math.atan2(dz, Math.hypot(dx,dy))/D;
  }
  return out;
}
/* True lunar node (mean node plus the dominant periodic term) */
function rahuTropical(J){
  const T=(J-2451545)/36525;
  const om=125.0445479-1934.1362891*T+0.0020754*T*T+T*T*T/467441;
  const Dd=297.8501921+445267.1114034*T, M=357.5291092+35999.0502909*T;
  const Mp=134.9633964+477198.8675055*T, F=93.2720950+483202.0175233*T;
  return norm(om-1.4979*sin(2*(Dd-F))-0.1500*sin(M)-0.1226*sin(2*Dd)
              +0.1176*sin(2*F)-0.0801*sin(2*(Mp-F)));
}
export function ayanamsa(J){ /* Lahiri */
  const T=(J-2451545)/36525;
  return 23.85+1.39721*T+0.000308*T*T;
}

/* Solar longitude and radius vector, Meeus Ch.25. Accurate to well under an
   arcminute, and better here than the Standish Earth element - which carried a
   ~6 arcmin longitude error at this epoch. Earth's heliocentric position is
   simply the reverse of this. */
export function sunGeo(J){
  const T=(J-2451545)/36525;
  const L0=280.46646+36000.76983*T+0.0003032*T*T;
  const M=357.52911+35999.05029*T-0.0001537*T*T;
  const C=(1.914602-0.004817*T-0.000014*T*T)*sin(M)
         +(0.019993-0.000101*T)*sin(2*M)+0.000289*sin(3*M);
  const e=0.016708634-0.000042037*T-0.0000001267*T*T;
  const v=M+C;
  const R=1.000001018*(1-e*e)/(1+e*cos(v));
  return {lon:norm(L0+C), R};
}

export function positions(date){
  const J=jd(date), T=(J-2451545)/36525;
  const sg=sunGeo(J);
  /* Earth heliocentric = opposite the Sun as seen from Earth */
  const earth=[-sg.R*cos(sg.lon), -sg.R*sin(sg.lon), 0];
  const out={};
  out.Sun=sg.lon;
  out.Moon=moonTropical(J);
  /* TWO FRAMES, AND THEY MUST BE THE SAME ONE.
     Standish's elements are referred to the ECLIPTIC AND EQUINOX OF J2000. The Sun's
     longitude from sunGeo — and therefore the Earth vector built from it — is referred to
     the equinox OF DATE. Subtracting one from the other left the whole difference of
     precession in the answer: measured against JPL Horizons the outer planets were out by
     about minus the precession since J2000, which is 22' at 2026 and 38' at 2045, and it
     was mistaken for the method's own error. Standish publishes roughly 10' for Saturn over
     1800-2050; we were at 44'.
     The planet vector is rotated into the ecliptic of date before the subtraction. To this
     accuracy the general precession in longitude is a rotation about the ecliptic pole. */
  const pA=(5029.0966*T + 1.11113*T*T - 0.000006*T*T*T)/3600;
  const cp=cos(pA), sp=sin(pA);
  for(const p of ['Mercury','Venus','Mars','Jupiter','Saturn']){
    const h=heliocentric(p,T);
    const hx=h[0]*cp-h[1]*sp, hy=h[0]*sp+h[1]*cp;
    out[p]=norm(Math.atan2(hy-earth[1],hx-earth[0])/D);
  }
  out.Rahu=rahuTropical(J);
  out.Ketu=norm(out.Rahu+180);
  const ay=ayanamsa(J);
  const sid={}; for(const k in out) sid[k]=norm(out[k]-ay);
  return sid;
}
export function retrograde(date){
  const a=positions(date), b=positions(new Date(date.getTime()+864e5));
  const r={};
  for(const k in a){
    let d=b[k]-a[k]; if(d>180)d-=360; if(d<-180)d+=360;
    r[k]= d<0;
  }
  /* The TRUE node wobbles: its day-to-day motion turns forward for a few days each
     fortnight, so this difference called Rahu and Ketu "direct" on about a quarter of
     all dates while the generated report — and every classical text — hold the nodes to
     be perpetually retrograde. The convention wins; the measured speed is reported
     separately by stationInfo() and is left alone. */
  r.Rahu=r.Ketu=true;
  return r;
}

export const sunTropical = J => sunGeo(J).lon;
export const moonSidereal = date => norm(moonTropical(jd(date)) - ayanamsa(jd(date)));
export const sunSidereal  = date => norm(sunTropical(jd(date))  - ayanamsa(jd(date)));
