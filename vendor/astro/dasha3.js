/* GENERATED from prototype/src/dasha3.js by tools/bundle_functions.mjs — edit the source, not this copy */
/* ===================================================================
   VIMSHOTTARI DASHA - all three levels.

   The 120-year cycle divided among the nine grahas, seeded entirely
   by where the Moon sat within its nakshatra at birth. The nakshatra
   picks the first lord; the fraction already traversed decides how
   much of that lord's period was spent before the native arrived.

   Levels:
     mahadasha       - the major period, YEARS[lord] long
     antardasha      - nine sub-periods inside each maha, same order
                       starting from the maha lord, each sized
                       maha-span x YEARS[sub]/120
     pratyantardasha - the same subdivision applied once more, so the
                       texture shifts every few weeks to months

   The first mahadasha is returned in FULL, starting before birth -
   exactly how the classical tables print it (the pre-birth antars are
   real table rows; only the balance was lived). balanceYears carries
   what remained at birth.

   Year length: 365.25 days. Validated against two independently
   printed professional tables - 9 maha starts, all 81 antardasha end
   dates across the whole 120-year cycle, and the running pratyantar -
   in prototype/tools/validate_dasha3.mjs. The Gregorian-year variant
   (365.2425) drifts up to a day by the cycle's far end; 365.25 is
   what the printed tables use.

   Nothing here consults an ephemeris: the one astronomical input is
   the Moon's sidereal longitude, which the caller takes from
   ephemeris.js (moonSidereal). A dasha date moves by roughly
   YEARS[birthLord]/13deg20' per degree of Moon error - about 3 days
   per arcminute for a Rahu-born chart - so feed this the best Moon
   you have.
   =================================================================== */

export const DASHA_ORDER=["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
export const DASHA_YEARS={Ketu:7,Venus:20,Sun:6,Moon:10,Mars:7,Rahu:18,Jupiter:16,Saturn:19,Mercury:17};
export const YEAR_DAYS=365.25;

const NSPAN=360/27, DAY=86400000;
const norm=d=>((d%360)+360)%360;

export function vimshottari(moonSiderealLongitude, birthDate, yearDays=YEAR_DAYS){
  const L=norm(moonSiderealLongitude);
  const li=Math.floor(L/NSPAN)%9;                 /* birth lord index   */
  const birthLord=DASHA_ORDER[li];
  const frac=(L%NSPAN)/NSPAN;                     /* nakshatra traversed */
  const yms=yearDays*DAY;                         /* one dasha year, ms */
  const t0=birthDate.getTime()-DASHA_YEARS[birthLord]*frac*yms;

  /* The Vimshottari does not stop after 120 years — it begins again from the
     same lord. One cycle was enough for every chart the app had been tested
     with, but a birth before about 1906 runs out of sequence before today:
     dasha.at(now) returned null, and Today rendered blank with an uncaught
     TypeError on `.maha`. Build as many cycles as the chart actually needs to
     reach a few years past now, so an ordinary chart still has exactly nine
     mahadashas and the Timeline spine is unchanged. */
  const needTo=Math.max(t0+120*yms, Date.now()+5*365.2425*DAY);
  const cycles=Math.max(1,Math.min(4,Math.ceil((needTo-t0)/(120*yms))));
  const mahadashas=[]; let mc=t0;
  for(let i=0;i<9*cycles;i++){
    const lord=DASHA_ORDER[(li+i)%9], years=DASHA_YEARS[lord];
    const mEnd=mc+years*yms;
    const antardashas=[]; let ac=mc;
    const ai=DASHA_ORDER.indexOf(lord);
    for(let j=0;j<9;j++){
      const aLord=DASHA_ORDER[(ai+j)%9];
      const aSpan=years*(DASHA_YEARS[aLord]/120)*yms;
      const aEnd=ac+aSpan;
      const pratyantardashas=[]; let pc=ac;
      const pi=DASHA_ORDER.indexOf(aLord);
      for(let k=0;k<9;k++){
        const pLord=DASHA_ORDER[(pi+k)%9];
        const pEnd=pc+aSpan*(DASHA_YEARS[pLord]/120);
        pratyantardashas.push({lord:pLord,start:new Date(pc),end:new Date(pEnd)});
        pc=pEnd;
      }
      antardashas.push({lord:aLord,start:new Date(ac),end:new Date(aEnd),pratyantardashas});
      ac=aEnd;
    }
    mahadashas.push({lord,start:new Date(mc),end:new Date(mEnd),years,antardashas});
    mc=mEnd;
  }

  const at=d=>{
    const t=d.getTime();
    const maha=mahadashas.find(m=>t>=m.start&&t<m.end);
    if(!maha)return null;
    const antar=maha.antardashas.find(a=>t>=a.start&&t<a.end)||null;
    const pratyantar=antar&&antar.pratyantardashas.find(p=>t>=p.start&&t<p.end)||null;
    return {maha,antar,pratyantar};
  };

  const balanceYears=DASHA_YEARS[birthLord]*(1-frac);
  return {birthLord,balanceYears,balanceDays:balanceYears*yearDays,mahadashas,at};
}
